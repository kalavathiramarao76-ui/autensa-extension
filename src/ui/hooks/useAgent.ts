import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ToolCallDisplay, PageContext, MessageType, Session } from '@/shared/types';
import { uid } from '@/shared/message-bus';
import { saveSession } from '@/shared/storage';

interface UseAgentReturn {
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  activeTools: ToolCallDisplay[];
  sessionId: string;
  sendMessage: (text: string, context?: PageContext) => void;
  clearMessages: () => void;
  restoreSession: (session: Session) => void;
  newSession: () => void;
}

export function useAgent(): UseAgentReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activeTools, setActiveTools] = useState<ToolCallDisplay[]>([]);
  const [sessionId, setSessionId] = useState(() => uid());
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const sessionRef = useRef<Session>({
    id: sessionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

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

    return () => { portRef.current?.disconnect(); };
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

  const sendMessage = useCallback((text: string, context?: PageContext) => {
    // Add user message
    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => {
      const next = [...prev, userMsg];
      return next;
    });
    setIsStreaming(true);
    setStreamingText('');
    setActiveTools([]);

    // Connect port for streaming
    const port = chrome.runtime.connect({ name: 'autensa-stream' });
    portRef.current = port;

    port.onMessage.addListener((msg: MessageType) => {
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
          // Reset streaming text for next iteration
          setStreamingText('');
          break;

        case 'AGENT_COMPLETE': {
          const assistantMsg: Message = {
            id: uid(),
            role: 'assistant',
            content: msg.payload.finalText,
            timestamp: Date.now(),
            toolCalls: undefined,
          };
          setMessages(prev => {
            const next = [...prev, assistantMsg];
            persistSession(next);
            return next;
          });
          setIsStreaming(false);
          setStreamingText('');
          setActiveTools([]);
          port.disconnect();
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
          port.disconnect();
          break;
      }
    });

    // Get page context and send
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
          const ctx = response?.payload || context;
          port.postMessage({
            type: 'AGENT_REQUEST',
            payload: { message: text, context: ctx },
          });
        });
      } else {
        port.postMessage({
          type: 'AGENT_REQUEST',
          payload: { message: text, context },
        });
      }
    });
  }, [persistSession]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    setActiveTools([]);
    setIsStreaming(false);
  }, []);

  const restoreSession = useCallback((session: Session) => {
    portRef.current?.disconnect();
    setSessionId(session.id);
    setMessages(session.messages);
    setStreamingText('');
    setActiveTools([]);
    setIsStreaming(false);
    sessionRef.current = { ...session };
  }, []);

  const newSession = useCallback(() => {
    portRef.current?.disconnect();
    const newId = uid();
    setSessionId(newId);
    setMessages([]);
    setStreamingText('');
    setActiveTools([]);
    setIsStreaming(false);
    sessionRef.current = {
      id: newId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Reset background session
    chrome.runtime.sendMessage({ type: 'QUICK_ACTION', payload: { action: 'new_chat' } });
  }, []);

  return {
    messages, isStreaming, streamingText, activeTools, sessionId,
    sendMessage, clearMessages, restoreSession, newSession,
  };
}
