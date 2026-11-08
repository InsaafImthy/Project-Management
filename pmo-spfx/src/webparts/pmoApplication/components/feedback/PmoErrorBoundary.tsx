import * as React from "react";
import { MessageBar, MessageBarType } from "@fluentui/react";

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
      return (
        <MessageBar messageBarType={MessageBarType.error} role="alert">
          The PMO application could not be displayed. Refresh the page and
          contact support if the problem continues.
        </MessageBar>
      );
    }

    return this.props.children;
  }
}
