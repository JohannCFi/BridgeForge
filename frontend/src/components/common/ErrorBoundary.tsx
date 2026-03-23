import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-zinc-900 border border-white/[0.08] rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">⚠</div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-zinc-400 mb-6">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            {this.state.error && (
              <p className="text-xs text-zinc-600 font-mono mb-6 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-white text-black font-medium rounded-xl hover:bg-zinc-200 transition-colors"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
