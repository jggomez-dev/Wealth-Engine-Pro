import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 dark:bg-rose-900/10 dark:border-rose-800/30">
          <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-400">Something went wrong</h2>
          <p className="text-sm text-rose-600 dark:text-rose-500 mt-2">Try refreshing the page or checking your internet connection.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            Refresh App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
