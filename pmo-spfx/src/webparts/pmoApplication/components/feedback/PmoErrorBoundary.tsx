import * as React from "react";
import { FatalErrorPage } from "../layout";
import { toUserSafeErrorMessage } from "../../utils/toUserSafeErrorMessage";

interface IPmoErrorBoundaryProps {
  readonly children: React.ReactNode;
}

interface IPmoErrorBoundaryState {
  readonly hasError: boolean;
  readonly message?: string;
}

export class PmoErrorBoundary extends React.Component<
  IPmoErrorBoundaryProps,
  IPmoErrorBoundaryState
> {
  public state: IPmoErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(
    error: unknown,
  ): IPmoErrorBoundaryState {
    return { hasError: true, message: toUserSafeErrorMessage(error) };
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <FatalErrorPage
          message={this.state.message}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
