import { ClaudeMessage, ClaudeContent, PageContext, UsageData } from '@/shared/types';
import { streamClaude } from './api/claude';
import { registry } from './tools/registry';
import { getSettings } from '@/shared/storage';

interface AgentCallbacks {
  onText: (text: string) => void;
  onToolStart: (id: string, name: string, args: unknown) => void;
  onToolResult: (id: string, name: string, result: string, success: boolean) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
  onUsage?: (usage: UsageData) => void;
  onRateLimited?: (retryAfter: number) => void;
}

export async function runAgent(
  userMessage: string,
  context: PageContext | undefined,
  history: ClaudeMessage[],
  callbacks: AgentCallbacks
): Promise<void> {
  const settings = await getSettings();
  const maxIterations = settings.maxIterations || 10;

  // Build user content with page context
  let userContent = userMessage;
  if (context && context.url) {
    const parts: string[] = [];
    parts.push(`[Page: ${context.title} — ${context.url}]`);
    if (context.selection) parts.push(`[Selected: ${context.selection}]`);
    if (context.content) parts.push(`[Content:\n${context.content.slice(0, 3000)}\n]`);
    userContent = parts.join('\n') + '\n\n' + userMessage;
  }

  const messages: ClaudeMessage[] = [
    ...history,
    { role: 'user', content: [{ type: 'text', text: userContent }] },
  ];

  const toolDefs = registry.getToolDefinitions();
  let fullText = '';

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let iterText = '';
    const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];
    let stopReason = '';

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Request timed out (60s)')), 60000);

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
            clearTimeout(timeout);
            stopReason = reason;
            resolve();
          },
          onError(error) {
            clearTimeout(timeout);
            reject(new Error(error));
          },
          onUsage(usage) {
            callbacks.onUsage?.(usage);
          },
          onRateLimited(retryAfter) {
            callbacks.onRateLimited?.(retryAfter);
          },
        });
      });
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : 'Unknown error');
      return;
    }

    // No tool calls → done
    if (toolCalls.length === 0) {
      callbacks.onComplete(fullText);
      return;
    }

    // Build assistant message with text + tool_use blocks
    const assistantContent: ClaudeContent[] = [];
    if (iterText) assistantContent.push({ type: 'text', text: iterText });
    for (const tc of toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute each tool
    const toolResults: ClaudeContent[] = [];
    for (const tc of toolCalls) {
      callbacks.onToolStart(tc.id, tc.name, tc.input);
      try {
        const result = await registry.execute(tc.name, tc.input);
        callbacks.onToolResult(tc.id, tc.name, result.data, result.success);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: result.data,
          is_error: !result.success,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Tool execution failed';
        callbacks.onToolResult(tc.id, tc.name, errMsg, false);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: errMsg,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: toolResults });

    // Reset for next iteration
    fullText += '\n';
  }

  callbacks.onComplete(fullText);
}
