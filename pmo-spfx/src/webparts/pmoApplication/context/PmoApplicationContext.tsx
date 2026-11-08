import * as React from "react";
import type { IPmoCurrentUser } from "../models/application";
import { PmoRouteProvider } from "../routing/pmoRoutes";

export const PmoApplicationContext = React.createContext<
  IPmoCurrentUser | undefined
>(undefined);

export interface IPmoDisplayPreferences {
  readonly sidebarCollapsed: boolean;
  readonly setSidebarCollapsed: (collapsed: boolean) => void;
}

export const PmoDisplayPreferencesContext = React.createContext<
  IPmoDisplayPreferences | undefined
>(undefined);

export type PmoMessageTone = "information" | "success" | "warning" | "danger";
export interface IPmoApplicationMessage {
  readonly id: string;
  readonly text: string;
  readonly tone: PmoMessageTone;
}

export interface IPmoDialogRequest {
  readonly title: string;
  readonly message: React.ReactNode;
  readonly confirmLabel?: string;
  readonly destructive?: boolean;
}

export interface IPmoInteractionContext {
  readonly messages: readonly IPmoApplicationMessage[];
  readonly publishMessage: (
    message: Omit<IPmoApplicationMessage, "id">,
  ) => string;
  readonly dismissMessage: (id: string) => void;
  readonly dialogRequest?: IPmoDialogRequest;
  readonly requestConfirmation: (
    request: IPmoDialogRequest,
  ) => Promise<boolean>;
  readonly resolveConfirmation: (confirmed: boolean) => void;
}

export const PmoInteractionContext = React.createContext<
  IPmoInteractionContext | undefined
>(undefined);

export interface IPmoApplicationProviderProps {
  readonly currentUser: IPmoCurrentUser;
  readonly children: React.ReactNode;
}

/** Minimal app state only: identity/capabilities, display preference, messages/dialogs, and route. */
export const PmoApplicationProvider = ({
  currentUser,
  children,
}: IPmoApplicationProviderProps): React.ReactElement => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [messages, setMessages] = React.useState<
    readonly IPmoApplicationMessage[]
  >([]);
  const [dialogRequest, setDialogRequest] = React.useState<IPmoDialogRequest>();
  const resolver = React.useRef<(confirmed: boolean) => void>();
  const publishMessage = React.useCallback(
    (message: Omit<IPmoApplicationMessage, "id">): string => {
      const id = `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setMessages((current) => [...current, { ...message, id }]);
      return id;
    },
    [],
  );
  const dismissMessage = React.useCallback((id: string): void => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);
  const requestConfirmation = React.useCallback(
    (request: IPmoDialogRequest): Promise<boolean> => {
      setDialogRequest(request);
      return new Promise((resolve) => {
        resolver.current = resolve;
      });
    },
    [],
  );
  const resolveConfirmation = React.useCallback((confirmed: boolean): void => {
    resolver.current?.(confirmed);
    resolver.current = undefined;
    setDialogRequest(undefined);
  }, []);
  return (
    <PmoApplicationContext.Provider value={currentUser}>
      <PmoDisplayPreferencesContext.Provider
        value={{ sidebarCollapsed, setSidebarCollapsed }}
      >
        <PmoInteractionContext.Provider
          value={{
            messages,
            publishMessage,
            dismissMessage,
            dialogRequest,
            requestConfirmation,
            resolveConfirmation,
          }}
        >
          <PmoRouteProvider>{children}</PmoRouteProvider>
        </PmoInteractionContext.Provider>
      </PmoDisplayPreferencesContext.Provider>
    </PmoApplicationContext.Provider>
  );
};

export const usePmoDisplayPreferences = (): IPmoDisplayPreferences => {
  const value = React.useContext(PmoDisplayPreferencesContext);
  if (!value)
    throw new Error(
      "usePmoDisplayPreferences must be used inside PmoApplicationProvider.",
    );
  return value;
};

export const usePmoInteractions = (): IPmoInteractionContext => {
  const value = React.useContext(PmoInteractionContext);
  if (!value)
    throw new Error(
      "usePmoInteractions must be used inside PmoApplicationProvider.",
    );
  return value;
};
