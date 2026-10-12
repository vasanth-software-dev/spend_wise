import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SpendWise Caught Unhandled UI Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#070b13] flex flex-col items-center justify-center p-4 selection:bg-brand-500 selection:text-white">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/60 shadow-sm">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                SpendWise encountered an unexpected rendering issue. You can reload the application or reset your session below.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-left border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-words line-clamp-3">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleHardReset}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Reset &amp; Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
