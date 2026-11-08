import * as React from "react";
import { MessageBar, MessageBarType } from "@fluentui/react";

export const PmoAccessDeniedState = (): React.ReactElement => (
  <MessageBar messageBarType={MessageBarType.error} role="alert">
    You do not have permission to use the PMO application. Contact the PMO
    administrator if you believe this is incorrect.
  </MessageBar>
);
