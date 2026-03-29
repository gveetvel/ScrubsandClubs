"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface ClientErrorBoundaryProps {
  children: ReactNode;
}

interface ClientErrorBoundaryState {
  error: Error | null;
}

export class ClientErrorBoundary extends Component<ClientErrorBoundaryProps, ClientErrorBoundaryState> {
  state: ClientErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ClientErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Scrubs & Clubs Studio client error", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-moss/40 px-4 py-10">
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-ember/20 bg-white p-8 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ember">Client Error</p>
            <h1 className="mt-3 text-2xl font-bold text-ink">The app hit a client-side rendering problem.</h1>
            <p className="mt-3 text-sm text-slate-600">
              Refresh the page once. If it still happens, the error details below will make the next fix much faster.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
