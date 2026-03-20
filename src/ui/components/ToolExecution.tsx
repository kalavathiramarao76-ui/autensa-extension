import React, { useState, useMemo } from 'react';
import { ToolCallDisplay } from '@/shared/types';
import { marked, Renderer } from 'marked';

/* ── Tool result renderer: links open in new tab ── */
const toolRenderer = new Renderer();
toolRenderer.link = function ({ href, text }: { href: string; text: string }) {
  const escaped = (text || href || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
};

interface Props {
  tools: ToolCallDisplay[];
}

const TOOL_ICONS: Record<string, string> = {
  github_list_issues: '\ud83d\udccb',
  github_list_repos: '\ud83d\udccb',
  github_list_pull_requests: '\ud83d\udccb',
  github_search_code: '\ud83d\udd0d',
  github_create_issue: '\u2795',
  vercel_list_projects: '\ud83d\udccb',
  vercel_list_deployments: '\ud83d\ude80',
  vercel_get_deployment: '\ud83d\ude80',
  vercel_get_deployment_logs: '\ud83d\udcdc',
  vercel_redeploy: '\ud83d\ude80',
};

function ToolResultCard({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = result.length > 120;

  const html = useMemo(() => {
    return marked.parse(result, { breaks: true, gfm: true, renderer: toolRenderer }) as string;
  }, [result]);

  return (
    <div className="tool-result-container">
      {expanded ? (
        <div
          className="tool-result-rendered prose prose-sm max-w-none
            prose-a:text-[#6366f1] prose-a:no-underline hover:prose-a:underline prose-a:cursor-pointer
            prose-p:text-text-secondary prose-p:my-1
            prose-strong:text-text-primary
            prose-li:text-text-secondary prose-li:my-0.5
            prose-code:text-accent prose-code:bg-surface-3 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div
          className={`tool-result-preview`}
          onClick={() => isLong && setExpanded(true)}
          style={isLong ? { cursor: 'pointer' } : { cursor: 'default' }}
        >
          {result.slice(0, 200)}
        </div>
      )}
      {isLong && (
        <div className="tool-result-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? '\u25b2 Collapse' : '\u25bc Show more'}
        </div>
      )}
    </div>
  );
}

export function ToolExecution({ tools }: Props) {
  if (tools.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      {tools.map(tool => (
        <div key={tool.id} className={`tool-card ${
              tool.status === 'running' ? 'tool-card-running' :
              tool.status === 'success' ? 'tool-card-success' : 'tool-card-error'
            }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              tool.status === 'running' ? 'bg-warning animate-pulse-soft' :
              tool.status === 'success' ? 'bg-success' : 'bg-error'
            }`} />
            <span className="text-sm select-none" aria-hidden="true">
              {TOOL_ICONS[tool.name] || '\u2699\ufe0f'}
            </span>
            <span className="text-sm font-medium text-text-primary">
              {formatToolName(tool.name)}
            </span>
            {tool.status === 'running' && (
              <span className="text-2xs text-text-tertiary">executing...</span>
            )}
          </div>
          {tool.result && tool.status !== 'running' && (
            <ToolResultCard result={tool.result} />
          )}
        </div>
      ))}
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/^(github|vercel)_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
