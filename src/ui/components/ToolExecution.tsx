import React from 'react';
import { ToolCallDisplay } from '@/shared/types';

interface Props {
  tools: ToolCallDisplay[];
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
            <span className="text-sm font-medium text-text-primary">
              {formatToolName(tool.name)}
            </span>
            {tool.status === 'running' && (
              <span className="text-2xs text-text-tertiary">executing...</span>
            )}
          </div>
          {tool.result && tool.status !== 'running' && (
            <div className="mt-2 text-xs text-text-secondary font-mono bg-surface-2 rounded-lg p-2 max-h-24 overflow-y-auto">
              {tool.result.slice(0, 500)}
            </div>
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
