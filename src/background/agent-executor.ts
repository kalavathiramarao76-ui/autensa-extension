import { ClaudeMessage, ClaudeContent, PageContext } from '@/shared/types';
import { streamClaude } from './api/claude';
import { registry } from './tools/registry';
import { getSettings } from '@/shared/storage';

interface AgentCallbacks {
  onText: (text: string) => void;
  onToolStart: (id: string, name: string, args: unknown) => void;
  onToolResult: (id: string, name: string, result: string, success: boolean) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

export async function runAgent(
  userMessage: string,
  context: PageContext | undefined,
  history: ClaudeMessage[],
  callbacks: AgentCallbacks
): Promise<void> {
  const settings = await getSettings();
  const maxIterations = settings.maxIterations || 10;

  // Build user content with context
  let userContent = userMessage;
  if (context) {
    userContent = `[Current page: ${context.title} — ${context.url}]\n`;
    if (context.selection) {
      userContent += `[Selected text: ${context.selection}]\n`;
    }
    if (context.content) {
      userContent += `[Page content (truncated):\n${context.content.slice(0, 3000)}\n]\n\n`;
    }
    userContent += userMessage;
  }

  const messages: ClaudeMessage[] = [
    ...history,
    { role: 'user', content: [{ type: 'text', text: userContent }] },
  ];

  const toolDefs = registry.getToolDefinitions();
  let fullText = '';
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    let iterText = '';
    let toolCalls: Array<{ id: string; name: string; input: unknown }> = [];
    let stopReason = '';

    await new Promise<void>((resolve, reject) => {
      streamClaude(messages, toolDefs, {
        onText(text) {
          iterText += text;
          fullText += text;
          callbacks.onText(text);
        },
        onToolUse(id, name, input) {
          toolCalls.push({ id, name, input });
        },
        onComplete(reason) {
          stopReason = reason;
          resolve();
        },
        onError(error) {
          reject(new Error(error));
        },
      });
    });

    // If no tool calls, we're done
    if (toolCalls.length === 0 || stopReason === 'end_turn') {
      if (toolCalls.length === 0) {
        callbacks.onComplete(fullText);
        return;
      }
    }

    // Build assistant message with text + tool_use blocks
    const assistantContent: ClaudeContent[] = [];
    if (iterText) {
      assistantContent.push({ type: 'text', text: iterText });
    }
    for (const tc of toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute tools and build tool_result messages
    const toolResults: ClaudeContent[] = [];
    for (const tc of toolCalls) {
      callbacks.onToolStart(tc.id, tc.name, tc.input);
      const result = await registry.execute(tc.name, tc.input);
      callbacks.onToolResult(tc.id, tc.name, result.data, result.success);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: result.data,
        is_error: !result.success,
      });
    }
    messages.push({ role: 'user', content: toolResults });

    // If stop reason was end_turn (with tool calls), still continue
    // The loop will call Claude again with tool results
  }

  callbacks.onComplete(fullText);
}
