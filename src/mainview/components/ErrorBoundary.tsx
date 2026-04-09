import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <AlertTriangle className="mx-auto mb-4 size-12 text-red-500" />
            <h1 className="mb-2 text-lg font-semibold">
              Qualcosa è andato storto
            </h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Si è verificato un errore imprevisto. Puoi provare a ricaricare
              l'applicazione.
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-32 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-4" />
              Riprova
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
