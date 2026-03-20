import { Tool, ClaudeToolDef } from '@/shared/types';
import { githubTools } from './github-tools';
import { vercelTools } from './vercel-tools';

/* ── Relative date formatting ── */
function relativeDate(dateInput: string | number | undefined): string {
  if (!dateInput) return '—';
  const now = Date.now();
  const then = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(then)) return '—';
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ── Truncate long strings ── */
function truncate(str: string | undefined | null, max = 50): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

/* ── Status emoji helpers ── */
function stateEmoji(state: string | undefined): string {
  if (!state) return '';
  const s = state.toLowerCase();
  if (s === 'open') return '\ud83d\udfe2';
  if (s === 'closed' || s === 'merged') return '\ud83d\udd34';
  if (s === 'ready' || s === 'ready' ) return '\u2705';
  if (s === 'building' || s === 'queued' || s === 'initializing') return '\ud83d\udd04';
  if (s === 'error' || s === 'canceled') return '\u274c';
  return '';
}

/* ── Markdown table builder ── */
function mdTable(headers: string[], rows: string[][]): string {
  const sep = headers.map(() => '---');
  const lines = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + sep.join(' | ') + ' |',
    ...rows.map(r => '| ' + r.join(' | ') + ' |'),
  ];
  return lines.join('\n');
}

/* ── Format tool results as clean markdown ── */
function formatToolResult(toolName: string, data: any): string {
  if (typeof data === 'string') return data;
  if (!data) return 'No data returned.';

  switch (toolName) {
    case 'github_list_issues': {
      if (!Array.isArray(data) || data.length === 0) return 'No issues found.';
      const rows = data.map((i: any) => [
        `${stateEmoji(i.state)} #${i.number}`,
        truncate(i.title, 48),
        i.state || '—',
        (i.labels && i.labels.length > 0) ? i.labels.slice(0, 3).map((l: string) => `\`${l}\``).join(' ') : '—',
        relativeDate(i.created),
      ]);
      return mdTable(['#', 'Title', 'State', 'Labels', 'Created'], rows);
    }

    case 'github_list_repos': {
      if (!Array.isArray(data) || data.length === 0) return 'No repositories found.';
      const rows = data.map((r: any) => [
        `[${truncate(r.name, 40)}](${r.url || '#'})`,
        r.language || '—',
        r.stars != null ? String(r.stars) : '0',
        relativeDate(r.updated),
      ]);
      return mdTable(['Repo', 'Language', 'Stars', 'Updated'], rows);
    }

    case 'github_list_pull_requests': {
      if (!Array.isArray(data) || data.length === 0) return 'No pull requests found.';
      const rows = data.map((pr: any) => [
        `${stateEmoji(pr.state)} #${pr.number}`,
        truncate(pr.title, 44),
        pr.author || '—',
        pr.draft ? 'Draft' : '—',
        relativeDate(pr.created),
      ]);
      return mdTable(['#', 'Title', 'Author', 'Draft', 'Created'], rows);
    }

    case 'github_search_code': {
      if (!Array.isArray(data) || data.length === 0) return 'No results found.';
      const rows = data.map((item: any) => [
        truncate(item.name, 30),
        truncate(item.path, 45),
        truncate(item.repo, 30),
      ]);
      return mdTable(['File', 'Path', 'Repo'], rows);
    }

    case 'github_create_issue': {
      if (!data) return 'Issue created.';
      return [
        `**Issue Created** \u2705`,
        '',
        `- **Number:** #${data.number}`,
        `- **Title:** ${data.title || '—'}`,
        `- **URL:** ${data.url || '—'}`,
      ].join('\n');
    }

    case 'vercel_list_projects': {
      if (!Array.isArray(data) || data.length === 0) return 'No projects found.';
      const rows = data.map((p: any) => [
        truncate(p.name, 30),
        p.framework || '—',
        p.url ? `[Link](${p.url})` : '—',
      ]);
      return mdTable(['Project', 'Framework', 'URL'], rows);
    }

    case 'vercel_list_deployments': {
      if (!Array.isArray(data) || data.length === 0) return 'No deployments found.';
      const rows = data.map((d: any) => [
        truncate(d.name, 28),
        `${stateEmoji(d.state)} ${d.state || '—'}`,
        d.target || '—',
        d.url ? `[Link](${d.url})` : '—',
        relativeDate(d.created),
      ]);
      return mdTable(['Name', 'State', 'Target', 'URL', 'Created'], rows);
    }

    case 'vercel_get_deployment': {
      if (!data) return 'No deployment data.';
      return [
        `**Deployment Details** ${stateEmoji(data.state)}`,
        '',
        `- **ID:** \`${data.id || '—'}\``,
        `- **Name:** ${data.name || '—'}`,
        `- **State:** ${stateEmoji(data.state)} ${data.state || '—'}`,
        `- **Target:** ${data.target || '—'}`,
        `- **URL:** ${data.url || '—'}`,
        `- **Created:** ${relativeDate(data.created)}`,
        data.error ? `- **Error:** ${data.error}` : '',
      ].filter(Boolean).join('\n');
    }

    case 'vercel_redeploy': {
      if (!data) return 'Redeployment triggered.';
      return [
        `**Redeployment Triggered** \ud83d\ude80`,
        '',
        `- **ID:** \`${data.id || '—'}\``,
        data.url ? `- **URL:** ${data.url}` : '',
      ].filter(Boolean).join('\n');
    }

    default:
      // Fallback: if it's an array, try a generic table; otherwise key-value
      if (Array.isArray(data)) {
        if (data.length === 0) return 'No results.';
        const keys = Object.keys(data[0]).slice(0, 5);
        const rows = data.map((item: any) => keys.map(k => truncate(String(item[k] ?? '—'), 40)));
        return mdTable(keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), rows);
      }
      if (typeof data === 'object') {
        return Object.entries(data)
          .map(([k, v]) => `- **${k}:** ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n');
      }
      return String(data);
  }
}

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
        data: typeof result.data === 'string' ? result.data : formatToolResult(name, result.data),
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
