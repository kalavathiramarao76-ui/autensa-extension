import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ToolCallDisplay, PageContext, MessageType, Session, UsageData } from '@/shared/types';
import { uid } from '@/shared/message-bus';
import { saveSession } from '@/shared/storage';

export interface RateLimitState {
  warning: boolean;          // true when >15 req/min
  limited: boolean;          // true when 429 received
  retryAfter: number;        // seconds remaining
  requestsPerMinute: number;
}

export interface PortStatus {
  connected: boolean;
  reconnecting: boolean;
  failedMessage: string | null; // message text that was in-flight when disconnect happened
}

interface UseAgentReturn {
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  activeTools: ToolCallDisplay[];
  sessionId: string;
  sessionUsage: UsageData;
  rateLimit: RateLimitState;
  portStatus: PortStatus;
  sendMessage: (text: string, context?: PageContext) => void;
  clearMessages: () => void;
  restoreSession: (session: Session) => void;
  newSession: () => void;
  retryFailedMessage: () => void;
  dismissFailedMessage: () => void;
}

const PORT_RECONNECT_DELAY = 1000;
const PORT_RECONNECT_MAX_ATTEMPTS = 3;

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeTools, setActiveTools] = useState<ToolCallDisplay[]>([]);
  const [sessionId, setSessionId] = useState(() => uid());
  const [sessionUsage, setSessionUsage] = useState<UsageData>({
    promptTokens: 0, completionTokens: 0, totalTokens: 0, estimated: true,
  });
  const [rateLimit, setRateLimit] = useState<RateLimitState>({
    warning: false, limited: false, retryAfter: 0, requestsPerMinute: 0,
  });
  const [portStatus, setPortStatus] = useState<PortStatus>({
    connected: false, reconnecting: false, failedMessage: null,
  });
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<Session>({
    id: sessionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Queue for messages sent during reconnection
  const messageQueueRef = useRef<Array<{ text: string; context?: PageContext }>>([]);
  const inFlightMessageRef = useRef<string | null>(null);
  const portReconnectAttemptRef = useRef(0);

  // Signal active conversation to background for keep-alive
  const signalActivity = useCallback((active: boolean) => {
    try {
      chrome.runtime.sendMessage({
        type: 'CONVERSATION_ACTIVITY',
        payload: { active },
      } as any);
    } catch {
      // Background may not be listening yet
    }
  }, []);

  useEffect(() => {
    // Check for pending message from command palette
    const checkPending = async () => {
      const result = await chrome.storage.local.get('autensa_pending_message');
      if (result.autensa_pending_message) {
        await chrome.storage.local.remove('autensa_pending_message');
        sendMessage(result.autensa_pending_message);
      }
    };
    checkPending();

    return () => {
      portRef.current?.disconnect();
      signalActivity(false);
    };
  }, []);

  const persistSession = useCallback((msgs: Message[]) => {
    const session = sessionRef.current;
    session.messages = msgs;
    session.updatedAt = Date.now();
    if (!session.title && msgs.length > 0) {
      const firstUserMsg = msgs.find(m => m.role === 'user');
      if (firstUserMsg) {
        session.title = firstUserMsg.content.slice(0, 80);
      }
    }
    saveSession({ ...session });
  }, []);

  const setupPortListeners = useCallback((port: chrome.runtime.Port, messageText: string) => {
    const handleMessage = (msg: MessageType) => {
      switch (msg.type) {
        case 'AGENT_STREAM_CHUNK':
          setStreamingText(prev => prev + msg.payload.text);
          break;

        case 'AGENT_TOOL_START':
          setActiveTools(prev => [...prev, {
            id: msg.payload.id,
            name: msg.payload.toolName,
            args: msg.payload.args,
            status: 'running',
          }]);
          break;

        case 'AGENT_TOOL_RESULT':
          setActiveTools(prev => prev.map(t =>
            t.id === msg.payload.id
              ? { ...t, status: msg.payload.success ? 'success' : 'error', result: msg.payload.result }
              : t
          ));
          setStreamingText('');
          break;

        case 'AGENT_COMPLETE': {
          const assistantMsg: Message = {
            id: uid(),
            role: 'assistant',
            content: msg.payload.finalText,
            timestamp: Date.now(),
            toolCalls: undefined,
            cached: msg.payload.cached || false,
          };
          setMessages(prev => {
            const next = [...prev, assistantMsg];
            persistSession(next);
            return next;
          });
          setIsStreaming(false);
          setStreamingText('');
          setActiveTools([]);
          inFlightMessageRef.current = null;
          port.disconnect();
          break;
        }

        case 'AGENT_USAGE': {
          const u = msg.payload.usage;
          setSessionUsage(prev => ({
            promptTokens: prev.promptTokens + u.promptTokens,
            completionTokens: prev.completionTokens + u.completionTokens,
            totalTokens: prev.totalTokens + u.totalTokens,
            estimated: prev.estimated && u.estimated,
          }));
          break;
        }

        case 'AGENT_RATE_LIMIT': {
          const { requestsPerMinute, retryAfter } = msg.payload;
          if (retryAfter) {
            setRateLimit({ warning: true, limited: true, retryAfter, requestsPerMinute });
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            cooldownRef.current = setInterval(() => {
              setRateLimit(prev => {
                const next = prev.retryAfter - 1;
                if (next <= 0) {
                  if (cooldownRef.current) clearInterval(cooldownRef.current);
                  cooldownRef.current = null;
                  return { warning: false, limited: false, retryAfter: 0, requestsPerMinute: 0 };
                }
                return { ...prev, retryAfter: next };
              });
            }, 1000);
          } else {
            setRateLimit(prev => ({ ...prev, warning: true, requestsPerMinute }));
          }
          break;
        }

        case 'AGENT_ERROR':
          setMessages(prev => {
            const errorMsg: Message = {
              id: uid(),
              role: 'assistant',
              content: `Error: ${msg.payload.error}`,
              timestamp: Date.now(),
            };
            const next = [...prev, errorMsg];
            persistSession(next);
            return next;
          });
          setIsStreaming(false);
          setStreamingText('');
          setActiveTools([]);
          inFlightMessageRef.current = null;
          port.disconnect();
          break;
      }
    };

    port.onMessage.addListener(handleMessage);

    // Detect unexpected port disconnect (service worker killed)
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      // Only handle unexpected disconnects (while streaming)
      if (inFlightMessageRef.current && isStreaming) {
        const failedMsg = inFlightMessageRef.current;
        inFlightMessageRef.current = null;

        setPortStatus({
          connected: false,
          reconnecting: false,
          failedMessage: failedMsg,
        });

        // Add error message to chat
        setMessages(prev => {
          const errorMsg: Message = {
            id: uid(),
            role: 'assistant',
            content: 'Connection to background service was interrupted. You can retry the message.',
            timestamp: Date.now(),
          };
          return [...prev, errorMsg];
        });

        setIsStreaming(false);
        setStreamingText('');
        setActiveTools([]);
      }
    });
  }, [persistSession, isStreaming]);

  const sendMessage = useCallback((text: string, context?: PageContext) => {
    // Signal active conversation for keep-alive
    signalActivity(true);

    // Add user message
    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => {
      const next = [...prev, userMsg];
      return next;
    });
    setIsStreaming(true);
    setStreamingText('');
    setActiveTools([]);

    // Track in-flight message for disconnect recovery
    inFlightMessageRef.current = text;

    // Connect port for streaming
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: 'autensa-stream' });
    } catch {
      // Service worker may be dead, try to wake it
      setPortStatus({ connected: false, reconnecting: true, failedMessage: text });
      attemptPortReconnect(text, context);
      return;
    }

    portRef.current = port;
    setPortStatus({ connected: true, reconnecting: false, failedMessage: null });

    setupPortListeners(port, text);

    // Get page context and send
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
          const ctx = response?.payload || context;
          try {
            port.postMessage({
              type: 'AGENT_REQUEST',
              payload: { message: text, context: ctx },
            });
          } catch {
            handlePortSendError(text, context);
          }
        });
      } else {
        try {
          port.postMessage({
            type: 'AGENT_REQUEST',
            payload: { message: text, context },
          });
        } catch {
          handlePortSendError(text, context);
        }
      }
    });
  }, [persistSession, setupPortListeners, signalActivity]);

  const attemptPortReconnect = useCallback((text: string, context?: PageContext) => {
    if (portReconnectAttemptRef.current >= PORT_RECONNECT_MAX_ATTEMPTS) {
      setPortStatus({ connected: false, reconnecting: false, failedMessage: text });
      setIsStreaming(false);
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant' as const,
        content: 'Unable to connect to background service. Please try again.',
        timestamp: Date.now(),
      }]);
      portReconnectAttemptRef.current = 0;
      return;
    }

    portReconnectAttemptRef.current++;
    setPortStatus({ connected: false, reconnecting: true, failedMessage: null });

    setTimeout(() => {
      try {
        const port = chrome.runtime.connect({ name: 'autensa-stream' });
        portRef.current = port;
        portReconnectAttemptRef.current = 0;
        setPortStatus({ connected: true, reconnecting: false, failedMessage: null });

        setupPortListeners(port, text);

        // Send the queued message
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
              const ctx = response?.payload || context;
              try {
                port.postMessage({
                  type: 'AGENT_REQUEST',
                  payload: { message: text, context: ctx },
                });
              } catch {
                attemptPortReconnect(text, context);
              }
            });
          } else {
            try {
              port.postMessage({
                type: 'AGENT_REQUEST',
                payload: { message: text, context },
              });
            } catch {
              attemptPortReconnect(text, context);
            }
          }
        });

        // Drain any queued messages
        const queue = [...messageQueueRef.current];
        messageQueueRef.current = [];
        for (const queued of queue) {
          sendMessage(queued.text, queued.context);
        }
      } catch {
        attemptPortReconnect(text, context);
      }
    }, PORT_RECONNECT_DELAY * portReconnectAttemptRef.current);
  }, [setupPortListeners, sendMessage]);

  const handlePortSendError = useCallback((text: string, context?: PageContext) => {
    inFlightMessageRef.current = null;
    setPortStatus({ connected: false, reconnecting: true, failedMessage: null });
    attemptPortReconnect(text, context);
  }, [attemptPortReconnect]);

  const retryFailedMessage = useCallback(() => {
    const msg = portStatus.failedMessage;
    if (msg) {
      setPortStatus({ connected: false, reconnecting: false, failedMessage: null });
      // Remove the error message that was added
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' &&
            prev[prev.length - 1].content.includes('interrupted')) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      sendMessage(msg);
    }
  }, [portStatus.failedMessage, sendMessage]);

  const dismissFailedMessage = useCallback(() => {
    setPortStatus(prev => ({ ...prev, failedMessage: null }));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    setActiveTools([]);
    setIsStreaming(false);
    signalActivity(false);
  }, [signalActivity]);

  const restoreSession = useCallback((session: Session) => {
    portRef.current?.disconnect();
    setSessionId(session.id);
    setMessages(session.messages);
    setStreamingText('');
    setActiveTools([]);
    setIsStreaming(false);
    const restored: UsageData = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimated: true };
    for (const m of session.messages) {
      if (m.usage) {
        restored.promptTokens += m.usage.promptTokens;
        restored.completionTokens += m.usage.completionTokens;
        restored.totalTokens += m.usage.totalTokens;
        if (!m.usage.estimated) restored.estimated = false;
      }
    }
    setSessionUsage(restored);
    setRateLimit({ warning: false, limited: false, retryAfter: 0, requestsPerMinute: 0 });
    sessionRef.current = { ...session };
  }, []);

  const newSession = useCallback(() => {
    portRef.current?.disconnect();
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
    const newId = uid();
    setSessionId(newId);
    setMessages([]);
    setStreamingText('');
    setActiveTools([]);
    setIsStreaming(false);
    setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0, estimated: true });
    setRateLimit({ warning: false, limited: false, retryAfter: 0, requestsPerMinute: 0 });
    setPortStatus({ connected: false, reconnecting: false, failedMessage: null });
    sessionRef.current = {
      id: newId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    signalActivity(false);
    chrome.runtime.sendMessage({ type: 'QUICK_ACTION', payload: { action: 'new_chat' } });
  }, [signalActivity]);

  return {
    messages, isStreaming, streamingText, activeTools, sessionId,
    sessionUsage, rateLimit, portStatus,
    sendMessage, clearMessages, restoreSession, newSession,
    retryFailedMessage, dismissFailedMessage,
  };
}
