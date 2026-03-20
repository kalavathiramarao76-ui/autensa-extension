import { MessageType, Session, Message, ClaudeMessage, ClaudeContent } from '@/shared/types';
import { uid } from '@/shared/message-bus';
import { saveSession, getSessions } from '@/shared/storage';
import { runAgent } from './agent-executor';

// Session state
let currentSession: Session | null = null;

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

    let assistantText = '';
    const toolCalls: Message['toolCalls'] = [];

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
          onComplete(finalText) {
            const assistantMsg: Message = {
              id: uid(),
              role: 'assistant',
              content: finalText || assistantText,
              timestamp: Date.now(),
              toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
            };
            session.messages.push(assistantMsg);
            session.updatedAt = Date.now();
            saveSession(session);
            try {
              port.postMessage({ type: 'AGENT_COMPLETE', payload: { finalText: finalText || assistantText, id: requestId } });
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
