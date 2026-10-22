import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Qualcosa è andato storto</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Si è verificato un errore imprevisto nell'interfaccia. I tuoi file su Google Drive non sono
            stati modificati.
          </p>
          <pre className="mt-5 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left font-mono text-xs break-words whitespace-pre-wrap text-muted-foreground">
            {error.message}
          </pre>
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              <RotateCcw className="size-4" />
              Ricarica l'app
            </button>
            <button
              onClick={this.handleReset}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-4" />
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }
}
