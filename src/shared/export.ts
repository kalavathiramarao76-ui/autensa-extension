import { Session, Message, ToolCallDisplay } from './types';
import { formatTokenCount } from './tokenizer';

/**
 * Escape markdown special characters in user-provided text.
 * Preserves intentional formatting but prevents injection.
 */
function escapeMarkdown(text: string): string {
  // Escape characters that could break markdown structure
  // but preserve common formatting users might intend
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([*_~`|])/g, '\\$1')
    .replace(/^(#{1,6})\s/gm, '\\$1 ')
    .replace(/^>/gm, '\\>')
    .replace(/^-\s/gm, '\\- ')
    .replace(/^\d+\.\s/gm, (m) => '\\' + m);
}

/**
 * Format a timestamp as a readable date string.
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a timestamp as a compact inline time (HH:MM).
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Render tool calls as inline markdown blocks.
 */
function renderToolCalls(tools: ToolCallDisplay[]): string {
  if (!tools || tools.length === 0) return '';

  return tools.map(tool => {
    const statusIcon = tool.status === 'success' ? '✓' : tool.status === 'error' ? '✗' : '⋯';
    const statusLabel = tool.status === 'success' ? 'completed' : tool.status === 'error' ? 'failed' : 'running';
    let block = `\n> 🔧 Tool: **${tool.name}** — ${statusIcon} ${statusLabel}`;

    if (tool.result) {
      // Truncate very long results for readability
      const preview = tool.result.length > 500 ? tool.result.slice(0, 500) + '…' : tool.result;
      // Try to detect if it's JSON and format accordingly
      let formatted: string;
      try {
        const parsed = JSON.parse(preview);
        formatted = JSON.stringify(parsed, null, 2);
      } catch {
        formatted = preview;
      }
      block += `\n> \`\`\`\n> ${formatted.split('\n').join('\n> ')}\n> \`\`\``;
    }

    return block;
  }).join('\n');
}

/**
 * Convert a Session to clean, professional markdown.
 */
export function exportSessionToMarkdown(session: Session, model?: string): string {
  const title = session.title || 'Untitled Conversation';
  const exportDate = formatDate(Date.now());
  const lines: string[] = [];

  lines.push(`# Autensa Chat — ${title}`);
  lines.push(`*Exported ${exportDate}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Compute total tokens from message-level usage
  let totalTokens = 0;
  for (const msg of session.messages) {
    if (msg.usage) {
      totalTokens += msg.usage.totalTokens;
    }
  }

  for (const msg of session.messages) {
    const time = formatTime(msg.timestamp);

    if (msg.role === 'user') {
      lines.push(`**You:** *(${time})* ${escapeMarkdown(msg.content)}`);
    } else {
      lines.push(`**Autensa:** *(${time})*`);
      lines.push('');
      // Assistant content is already markdown — include verbatim
      lines.push(msg.content);

      // Render any tool calls inline
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        lines.push(renderToolCalls(msg.toolCalls));
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Footer stats
  const msgCount = session.messages.length;
  const statsSegments: string[] = [
    `${msgCount} message${msgCount !== 1 ? 's' : ''}`,
  ];
  if (totalTokens > 0) {
    statsSegments.push(`${formatTokenCount(totalTokens)} tokens`);
  }
  if (model) {
    statsSegments.push(model);
  }
  lines.push(`*${statsSegments.join(' · ')}*`);

  return lines.join('\n');
}

/**
 * Trigger a file download in the browser.
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Copy text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for contexts where clipboard API is unavailable
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Generate a filename for the exported markdown.
 */
export function exportFilename(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `autensa-chat-${date}.md`;
}
