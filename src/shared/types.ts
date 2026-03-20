// === Usage / Token Tracking ===
export interface UsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean; // true = heuristic, false = from API
}

// === Message Protocol ===
export type MessageType =
  | { type: 'AGENT_REQUEST'; payload: { message: string; context?: PageContext; sessionId?: string } }
  | { type: 'AGENT_STREAM_CHUNK'; payload: { text: string; id: string } }
  | { type: 'AGENT_TOOL_START'; payload: { toolName: string; args: unknown; id: string } }
  | { type: 'AGENT_TOOL_RESULT'; payload: { toolName: string; result: string; id: string; success: boolean } }
  | { type: 'AGENT_COMPLETE'; payload: { finalText: string; id: string; cached?: boolean } }
  | { type: 'AGENT_USAGE'; payload: { usage: UsageData; id: string } }
  | { type: 'AGENT_ERROR'; payload: { error: string; id: string; retryAfter?: number } }
  | { type: 'AGENT_RATE_LIMIT'; payload: { requestsPerMinute: number; retryAfter?: number } }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'PAGE_CONTEXT_RESULT'; payload: PageContext }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'OPEN_COMMAND_PALETTE' }
  | { type: 'QUICK_ACTION'; payload: { action: string; data?: unknown } }
  | { type: 'CACHE_GET_STATS' }
  | { type: 'CACHE_CLEAR' };

// === Page Context ===
export interface PageContext {
  url: string;
  title: string;
  content: string;
  selection?: string;
  type: 'github' | 'vercel' | 'general';
  meta?: Record<string, string>;
}

// === Conversation ===
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallDisplay[];
  usage?: UsageData;
  cached?: boolean;
}

export interface ToolCallDisplay {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  status: 'running' | 'success' | 'error';
}

export interface Session {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}

// === Claude API ===
export interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: ClaudeContent[];
}

export type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

// === Tool System ===
export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (args: any) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: string;
}

// === Settings ===
export type ApiProvider = 'claude' | 'ollama';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface Settings {
  provider: ApiProvider;
  claudeApiKey: string;
  githubToken: string;
  vercelToken: string;
  maxIterations: number;
  model: string;
  ollamaEndpoint: string;
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'ollama',
  claudeApiKey: '',
  githubToken: '',
  vercelToken: '',
  maxIterations: 10,
  model: 'gpt-oss:120b',
  ollamaEndpoint: 'https://sai.sharedllm.com/v1',
  theme: 'system',
};
