import { Tool, ClaudeToolDef } from '@/shared/types';
import { githubTools } from './github-tools';
import { vercelTools } from './vercel-tools';

/* ── Safe string helper — never return undefined ── */
function safe(val: any, fallback = '—'): string {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
}

/* ── Relative date formatting ── */
function relativeDate(dateInput: any): string {
  if (dateInput === null || dateInput === undefined) return '—';
  const now = Date.now();
  let then: number;
  if (typeof dateInput === 'number') {
    // Handle both seconds and milliseconds timestamps
    then = dateInput > 1e12 ? dateInput : dateInput * 1000;
  } else {
    then = new Date(String(dateInput)).getTime();
  }
  if (isNaN(then)) return '—';
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
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
function truncate(str: any, max = 50): string {
  if (str === null || str === undefined || str === '') return '—';
  const s = String(str);
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
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
  if (data === null || data === undefined) return 'No data returned.';

  try {
    switch (toolName) {
      case 'github_list_issues': {
        if (!Array.isArray(data) || data.length === 0) return 'No issues found.';
        const hasLabels = data.some((i: any) => i.labels && i.labels.length > 0);
        const headers = hasLabels ? ['Issue', 'Title', 'Labels', 'Age'] : ['Issue', 'Title', 'Age'];
        const rows = data.map((i: any) => {
          const base = [
            `${stateEmoji(i.state)} #${safe(i.number)}`,
            truncate(i.title, 40),
          ];
          if (hasLabels) {
            base.push(
              (i.labels && i.labels.length > 0) ? i.labels.slice(0, 2).map((l: any) => `\`${safe(l)}\``).join(' ') : '—'
            );
          }
          base.push(relativeDate(i.created));
          return base;
        });
        return mdTable(headers, rows);
      }

      case 'github_list_repos': {
        if (!Array.isArray(data) || data.length === 0) return 'No repositories found.';
        const rows = data.map((r: any) => [
          r.url ? `[${truncate(r.name, 30)}](${r.url})` : truncate(r.name, 30),
          safe(r.language),
          r.stars != null ? String(r.stars) : '0',
          relativeDate(r.updated),
        ]);
        return mdTable(['Repo', 'Lang', 'Stars', 'Updated'], rows);
      }

      case 'github_list_pull_requests': {
        if (!Array.isArray(data) || data.length === 0) return 'No pull requests found.';
        const rows = data.map((pr: any) => [
          `${stateEmoji(pr.state)} #${safe(pr.number)}`,
          truncate(pr.title, 36) + (pr.draft ? ' `draft`' : ''),
          safe(pr.author),
          relativeDate(pr.created),
        ]);
        return mdTable(['PR', 'Title', 'Author', 'Age'], rows);
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
        return [
          `**Issue Created** \u2705`,
          '',
          `- **Number:** #${safe(data.number)}`,
          `- **Title:** ${safe(data.title)}`,
          `- **URL:** ${safe(data.url)}`,
        ].join('\n');
      }

      case 'vercel_list_projects': {
        if (!Array.isArray(data) || data.length === 0) return 'No projects found.';
        const rows = data.map((p: any) => [
          safe(p.name),
          safe(p.framework),
          p.url ? `[Open](${p.url})` : '—',
        ]);
        return mdTable(['Project', 'Framework', 'URL'], rows);
      }

      case 'vercel_list_deployments': {
        if (!Array.isArray(data) || data.length === 0) return 'No deployments found.';
        const rows = data.map((d: any) => [
          safe(d.name),
          `${stateEmoji(d.state)} ${safe(d.state)}`,
          d.url ? `[${safe(d.target, 'View')}](${d.url})` : safe(d.target),
          relativeDate(d.created),
        ]);
        return mdTable(['Name', 'Status', 'Link', 'Age'], rows);
      }

      case 'vercel_get_deployment': {
        return [
          `**Deployment** ${stateEmoji(data.state)}`,
          '',
          `- **ID:** \`${safe(data.id)}\``,
          `- **Name:** ${safe(data.name)}`,
          `- **State:** ${stateEmoji(data.state)} ${safe(data.state)}`,
          `- **Target:** ${safe(data.target)}`,
          `- **URL:** ${safe(data.url)}`,
          `- **Created:** ${relativeDate(data.created)}`,
          data.error ? `- **Error:** ${data.error}` : '',
        ].filter(Boolean).join('\n');
      }

      case 'vercel_redeploy': {
        return [
          `**Redeployment Triggered** \ud83d\ude80`,
          '',
          `- **ID:** \`${safe(data.id)}\``,
          data.url ? `- **URL:** ${data.url}` : '',
        ].filter(Boolean).join('\n');
      }

      default:
        if (Array.isArray(data)) {
          if (data.length === 0) return 'No results.';
          const keys = Object.keys(data[0]).slice(0, 5);
          const rows = data.map((item: any) => keys.map(k => truncate(item[k], 40)));
          return mdTable(keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), rows);
        }
        if (typeof data === 'object') {
          return Object.entries(data)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `- **${k}:** ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join('\n');
        }
        return String(data);
    }
  } catch (err) {
    // Fallback: if formatting fails, return raw JSON
    return JSON.stringify(data, null, 2);
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
