import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-screen items-center justify-center bg-bg-primary p-6 font-sans">
          <div className="w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-8 text-center shadow-2xl backdrop-blur-xl animate-slide-up">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger border border-danger/25">
              <AlertTriangle className="h-8 w-8" />
            </div>
            
            <h1 className="mb-3 text-xl font-bold tracking-tight text-text-primary">
              Something went wrong
            </h1>
            
            <p className="mb-6 text-sm leading-relaxed text-text-secondary">
              An unexpected error occurred in the application. Please try reloading the page or contact support if the issue persists.
            </p>

            {this.state.error && (
              <div className="mb-6 max-h-32 overflow-y-auto rounded-lg bg-bg-secondary p-3 text-left font-mono text-xs text-text-secondary border border-card-border/40 scrollbar-thin">
                <span className="font-bold text-danger">Error:</span> {this.state.error.message}
                {this.state.error.stack && (
                  <pre className="mt-1.5 whitespace-pre-wrap text-xs text-text-tertiary leading-relaxed">
                    {this.state.error.stack.split('\n').slice(1, 4).join('\n')}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
