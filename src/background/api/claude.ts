import { ClaudeMessage, ClaudeToolDef } from '@/shared/types';
import { CLAUDE_API_URL, SYSTEM_PROMPT } from '@/shared/constants';
import { getSettings } from '@/shared/storage';

interface StreamCallbacks {
  onText: (text: string) => void;
  onToolUse: (id: string, name: string, input: unknown) => void;
  onComplete: (stopReason: string) => void;
  onError: (error: string) => void;
}

export async function streamClaude(
  messages: ClaudeMessage[],
  tools: ClaudeToolDef[],
  callbacks: StreamCallbacks
): Promise<void> {
  const settings = await getSettings();

  if (settings.provider === 'ollama') {
    return streamOllama(messages, tools, callbacks);
  }

  // === Claude (Anthropic) path ===
  if (!settings.claudeApiKey) {
    callbacks.onError('Claude API key not configured. Open Autensa settings.');
    return;
  }

  const body = {
    model: settings.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    stream: true,
  };

  let response: Response;
  try {
    response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.claudeApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    callbacks.onError(`Network error: ${e instanceof Error ? e.message : 'Unknown'}`);
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    callbacks.onError(`Claude API error ${response.status}: ${errText}`);
    return;
  }

  await parseAnthropicStream(response, callbacks);
}

// === Ollama / OpenAI-compatible path ===
async function streamOllama(
  messages: ClaudeMessage[],
  tools: ClaudeToolDef[],
  callbacks: StreamCallbacks
): Promise<void> {
  const settings = await getSettings();
  const endpoint = settings.ollamaEndpoint.replace(/\/$/, '');

  // Convert Claude message format to OpenAI format
  const openaiMessages = convertToOpenAI(messages);

  // Convert Claude tools to OpenAI function calling format
  const openaiTools = tools.length > 0 ? tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  })) : undefined;

  const body: any = {
    model: settings.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...openaiMessages,
    ],
    stream: true,
    max_tokens: 4096,
  };

  if (openaiTools) {
    body.tools = openaiTools;
  }

  let response: Response;
  try {
    response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    callbacks.onError(`Network error connecting to ${endpoint}: ${e instanceof Error ? e.message : 'Unknown'}`);
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    callbacks.onError(`Ollama API error ${response.status}: ${errText}`);
    return;
  }

  await parseOpenAIStream(response, callbacks);
}

function convertToOpenAI(messages: ClaudeMessage[]): Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> {
  const result: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Check if this is a tool_result message
      const toolResults = msg.content.filter(c => c.type === 'tool_result');
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          if (tr.type === 'tool_result') {
            result.push({
              role: 'tool',
              content: tr.content,
              tool_call_id: tr.tool_use_id,
            });
          }
        }
      } else {
        const textParts = msg.content.filter(c => c.type === 'text');
        result.push({
          role: 'user',
          content: textParts.map(t => t.type === 'text' ? t.text : '').join('\n'),
        });
      }
    } else if (msg.role === 'assistant') {
      const textParts = msg.content.filter(c => c.type === 'text');
      const toolUses = msg.content.filter(c => c.type === 'tool_use');

      const assistantMsg: any = {
        role: 'assistant',
        content: textParts.map(t => t.type === 'text' ? t.text : '').join('\n') || null,
      };

      if (toolUses.length > 0) {
        assistantMsg.tool_calls = toolUses.map(tu => {
          if (tu.type !== 'tool_use') return null;
          return {
            id: tu.id,
            type: 'function',
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input),
            },
          };
        }).filter(Boolean);
      }

      result.push(assistantMsg);
    }
  }

  return result;
}

async function parseOpenAIStream(response: Response, callbacks: StreamCallbacks): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) { callbacks.onError('No response stream'); return; }

  const decoder = new TextDecoder();
  let buffer = '';
  let toolCallId = '';
  let toolCallName = '';
  let toolCallArgs = '';
  let hasToolCall = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          // Flush any pending tool call
          if (hasToolCall && toolCallName) {
            let input: unknown = {};
            try { input = JSON.parse(toolCallArgs); } catch {}
            callbacks.onToolUse(toolCallId || `tool_${Date.now()}`, toolCallName, input);
          }
          callbacks.onComplete('stop');
          return;
        }

        let chunk: any;
        try { chunk = JSON.parse(data); } catch { continue; }

        const delta = chunk.choices?.[0]?.delta;
        const finishReason = chunk.choices?.[0]?.finish_reason;

        if (!delta) {
          if (finishReason) {
            if (hasToolCall && toolCallName) {
              let input: unknown = {};
              try { input = JSON.parse(toolCallArgs); } catch {}
              callbacks.onToolUse(toolCallId || `tool_${Date.now()}`, toolCallName, input);
            }
            callbacks.onComplete(finishReason === 'tool_calls' ? 'tool_use' : finishReason);
          }
          continue;
        }

        // Text content
        if (delta.content) {
          callbacks.onText(delta.content);
        }

        // Tool calls (OpenAI format)
        if (delta.tool_calls) {
          hasToolCall = true;
          for (const tc of delta.tool_calls) {
            if (tc.id) toolCallId = tc.id;
            if (tc.function?.name) toolCallName = tc.function.name;
            if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
          }
        }

        if (finishReason) {
          if (hasToolCall && toolCallName) {
            let input: unknown = {};
            try { input = JSON.parse(toolCallArgs); } catch {}
            callbacks.onToolUse(toolCallId || `tool_${Date.now()}`, toolCallName, input);
            hasToolCall = false;
            toolCallId = '';
            toolCallName = '';
            toolCallArgs = '';
          }
          callbacks.onComplete(finishReason === 'tool_calls' ? 'tool_use' : finishReason);
        }
      }
    }
  } catch (e) {
    callbacks.onError(`Stream read error: ${e instanceof Error ? e.message : 'Unknown'}`);
  }
}

async function parseAnthropicStream(response: Response, callbacks: StreamCallbacks): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) { callbacks.onError('No response stream'); return; }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentToolId = '';
  let currentToolName = '';
  let toolInputJson = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        let event: any;
        try { event = JSON.parse(data); } catch { continue; }

        switch (event.type) {
          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              currentToolId = event.content_block.id;
              currentToolName = event.content_block.name;
              toolInputJson = '';
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta') {
              callbacks.onText(event.delta.text);
            } else if (event.delta?.type === 'input_json_delta') {
              toolInputJson += event.delta.partial_json;
            }
            break;

          case 'content_block_stop':
            if (currentToolName) {
              let input: unknown = {};
              try { input = JSON.parse(toolInputJson); } catch {}
              callbacks.onToolUse(currentToolId, currentToolName, input);
              currentToolId = '';
              currentToolName = '';
              toolInputJson = '';
            }
            break;

          case 'message_delta':
            if (event.delta?.stop_reason) {
              callbacks.onComplete(event.delta.stop_reason);
            }
            break;

          case 'error':
            callbacks.onError(event.error?.message || 'Stream error');
            break;
        }
      }
    }
  } catch (e) {
    callbacks.onError(`Stream read error: ${e instanceof Error ? e.message : 'Unknown'}`);
  }
}
