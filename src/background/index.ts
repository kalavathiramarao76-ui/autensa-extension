import { MessageType, Session, Message, ClaudeMessage, ClaudeContent, UsageData } from '@/shared/types';
import { uid } from '@/shared/message-bus';
import { saveSession, getSessions, getSettings } from '@/shared/storage';
import { estimateTokens } from '@/shared/tokenizer';
import { runAgent } from './agent-executor';
import { getFromCache, addToCache, clearCache, getCacheStats, isCacheable } from '@/shared/cache';

// Session state
let currentSession: Session | null = null;

// ─── Rate Limit Tracking ───
const requestTimestamps: number[] = [];
const RATE_WINDOW_MS = 60_000; // 1 minute window

function trackRequest(): number {
  const now = Date.now();
  requestTimestamps.push(now);
  // Prune old entries
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  return requestTimestamps.length;
}

function ensureSession(): Session {
  if (!currentSession) {
    currentSession = {
      id: uid(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  return currentSession;
}

function sessionToClaudeHistory(session: Session): ClaudeMessage[] {
  const history: ClaudeMessage[] = [];
  for (const msg of session.messages) {
    const content: ClaudeContent[] = [{ type: 'text', text: msg.content }];
    history.push({ role: msg.role, content });
  }
  return history;
}

// ─── Simulated streaming for cached responses ───
async function streamCachedResponse(
  port: chrome.runtime.Port,
  requestId: string,
  cachedText: string,
  session: Session,
  query: string,
): Promise<void> {
  // Chunk the cached response into small pieces for a natural streaming feel
  const CHUNK_SIZE = 12; // ~12 chars per chunk
  const CHUNK_DELAY = 2; // 2ms between chunks

  for (let i = 0; i < cachedText.length; i += CHUNK_SIZE) {
    const chunk = cachedText.slice(i, i + CHUNK_SIZE);
    try {
      port.postMessage({ type: 'AGENT_STREAM_CHUNK', payload: { text: chunk, id: requestId } });
    } catch { return; }
    if (i + CHUNK_SIZE < cachedText.length) {
      await new Promise(r => setTimeout(r, CHUNK_DELAY));
    }
  }

  // Build estimated usage (zero API cost)
  const usage: UsageData = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimated: true,
  };

  const assistantMsg: Message = {
    id: uid(),
    role: 'assistant',
    content: cachedText,
    timestamp: Date.now(),
    cached: true,
    usage,
  };
  session.messages.push(assistantMsg);
  session.updatedAt = Date.now();
  saveSession(session);

  try {
    port.postMessage({ type: 'AGENT_COMPLETE', payload: { finalText: cachedText, id: requestId, cached: true } });
    port.postMessage({ type: 'AGENT_USAGE', payload: { usage, id: requestId } } as MessageType);
  } catch {}
}

// Handle port connections for streaming
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'autensa-stream') return;

  port.onMessage.addListener(async (msg: MessageType) => {
    if (msg.type !== 'AGENT_REQUEST') return;

    const session = ensureSession();
    const requestId = uid();

    // Add user message
    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: msg.payload.message,
      timestamp: Date.now(),
    };
    session.messages.push(userMsg);

    // Set title from first message
    if (!session.title) {
      session.title = msg.payload.message.slice(0, 60);
    }

    // ─── Cache check ───
    const settings = await getSettings();
    const model = settings.model;
    const query = msg.payload.message;

    if (isCacheable(query)) {
      const cached = getFromCache(query, model);
      if (cached) {
        await streamCachedResponse(port, requestId, cached.response, session, query);
        return;
      }
    }

    let assistantText = '';
    const toolCalls: Message['toolCalls'] = [];
    let accumulatedUsage: UsageData | null = null;

    // Track this request for rate limiting
    const rpm = trackRequest();
    if (rpm > 15) {
      try {
        port.postMessage({ type: 'AGENT_RATE_LIMIT', payload: { requestsPerMinute: rpm } } as MessageType);
      } catch {}
    }

    try {
      await runAgent(
        msg.payload.message,
        msg.payload.context,
        sessionToClaudeHistory({ ...session, messages: session.messages.slice(0, -1) }),
        {
          onText(text) {
            assistantText += text;
            try {
              port.postMessage({ type: 'AGENT_STREAM_CHUNK', payload: { text, id: requestId } });
            } catch {}
          },
          onToolStart(id, name, args) {
            toolCalls.push({ id, name, args, status: 'running' });
            try {
              port.postMessage({ type: 'AGENT_TOOL_START', payload: { toolName: name, args, id } });
            } catch {}
          },
          onToolResult(id, name, result, success) {
            const tc = toolCalls.find(t => t.id === id);
            if (tc) { tc.status = success ? 'success' : 'error'; tc.result = result; }
            try {
              port.postMessage({ type: 'AGENT_TOOL_RESULT', payload: { toolName: name, result, id, success } });
            } catch {}
          },
          onUsage(usage) {
            // Accumulate usage across iterations
            if (!accumulatedUsage) {
              accumulatedUsage = { ...usage };
            } else {
              accumulatedUsage.promptTokens += usage.promptTokens;
              accumulatedUsage.completionTokens += usage.completionTokens;
              accumulatedUsage.totalTokens += usage.totalTokens;
              if (!usage.estimated) accumulatedUsage.estimated = false;
            }
          },
          onRateLimited(retryAfter) {
            try {
              port.postMessage({ type: 'AGENT_RATE_LIMIT', payload: { requestsPerMinute: rpm, retryAfter } } as MessageType);
            } catch {}
          },
          onComplete(finalText) {
            const content = finalText || assistantText;

            // Build usage — use API data if available, else estimate
            const usage: UsageData = accumulatedUsage || {
              promptTokens: estimateTokens(msg.payload.message),
              completionTokens: estimateTokens(content),
              totalTokens: estimateTokens(msg.payload.message) + estimateTokens(content),
              estimated: true,
            };

            // Cache the response if no tool calls were made
            if (toolCalls.length === 0) {
              addToCache(query, {
                response: content,
                timestamp: Date.now(),
                model,
              });
            }

            const assistantMsg: Message = {
              id: uid(),
              role: 'assistant',
              content,
              timestamp: Date.now(),
              toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
              usage,
            };
            session.messages.push(assistantMsg);
            session.updatedAt = Date.now();
            saveSession(session);
            try {
              port.postMessage({ type: 'AGENT_COMPLETE', payload: { finalText: content, id: requestId } });
              port.postMessage({ type: 'AGENT_USAGE', payload: { usage, id: requestId } } as MessageType);
            } catch {}
          },
          onError(error) {
            try {
              port.postMessage({ type: 'AGENT_ERROR', payload: { error, id: requestId } });
            } catch {}
          },
        }
      );
    } catch (err) {
      try {
        port.postMessage({
          type: 'AGENT_ERROR',
          payload: { error: err instanceof Error ? err.message : 'Unknown error', id: requestId },
        });
      } catch {}
    }
  });
});

// Handle one-shot messages
chrome.runtime.onMessage.addListener((msg: MessageType, _sender, sendResponse) => {
  if (msg.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        (chrome.sidePanel as any).open({ tabId: tabs[0].id });
      }
    });
    sendResponse({ ok: true });
  } else if (msg.type === 'QUICK_ACTION') {
    // New session for quick actions
    currentSession = null;
    sendResponse({ ok: true });
  } else if (msg.type === 'CACHE_GET_STATS') {
    sendResponse(getCacheStats());
  } else if (msg.type === 'CACHE_CLEAR') {
    clearCache();
    sendResponse({ ok: true });
  }
  return true;
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-command-palette') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_COMMAND_PALETTE' });
      }
    });
  }
});

// Open side panel on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});
