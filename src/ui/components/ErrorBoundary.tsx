import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[Autensa ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage = this.state.error?.message || 'An unexpected error occurred';

    return (
      <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in bg-surface-0">
        {/* Error icon */}
        <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-text-primary mb-1">Something went wrong</h2>
        <p className="text-sm text-text-secondary text-center mb-2 max-w-[280px]">
          Autensa hit an unexpected error. Your data is safe.
        </p>

        {/* Collapsed error detail */}
        <div className="w-full max-w-[300px] mb-6">
          <details className="group">
            <summary className="text-2xs text-text-tertiary cursor-pointer hover:text-text-secondary transition-colors text-center list-none">
              <span className="group-open:hidden">Show details</span>
              <span className="hidden group-open:inline">Hide details</span>
            </summary>
            <div className="mt-2 p-3 bg-surface-2 border border-border rounded-xl overflow-auto max-h-[120px]">
              <code className="text-2xs text-error/80 font-mono break-all leading-relaxed">
                {errorMessage}
              </code>
            </div>
          </details>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={this.handleReset} className="btn-primary flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Try Again
          </button>
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.reload();
              } else {
                window.location.reload();
              }
            }}
            className="btn-ghost"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
