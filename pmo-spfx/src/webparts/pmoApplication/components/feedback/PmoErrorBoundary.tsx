import * as React from "react";
import { FatalErrorPage } from "../layout";

interface IPmoErrorBoundaryProps {
  readonly children: React.ReactNode;
}

interface IPmoErrorBoundaryState {
  readonly hasError: boolean;
}

export class PmoErrorBoundary extends React.Component<
  IPmoErrorBoundaryProps,
  IPmoErrorBoundaryState
> {
  public state: IPmoErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): IPmoErrorBoundaryState {
    return { hasError: true };
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return <FatalErrorPage onRetry={() => window.location.reload()} />;
    }

    return this.props.children;
  }
}
