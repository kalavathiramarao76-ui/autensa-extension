import { Tool, ClaudeToolDef } from '@/shared/types';
import { githubTools } from './github-tools';
import { vercelTools } from './vercel-tools';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tools: Tool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  getToolDefinitions(): ClaudeToolDef[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  async execute(name: string, args: unknown): Promise<{ success: boolean; data: string }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, data: `Unknown tool: ${name}` };
    }
    try {
      const result = await tool.execute(args);
      return {
        success: result.success,
        data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
      };
    } catch (err) {
      return {
        success: false,
        data: `Tool error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}

export const registry = new ToolRegistry();
registry.register(githubTools);
registry.register(vercelTools);
