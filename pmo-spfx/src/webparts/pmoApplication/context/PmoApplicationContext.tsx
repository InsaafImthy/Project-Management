import * as React from "react";
import type { IPmoCurrentUser } from "../models/application";

export const PmoApplicationContext = React.createContext<
  IPmoCurrentUser | undefined
>(undefined);

export interface IPmoApplicationProviderProps {
  readonly currentUser: IPmoCurrentUser;
  readonly children: React.ReactNode;
}

export const PmoApplicationProvider = ({
  currentUser,
  children,
}: IPmoApplicationProviderProps): React.ReactElement => (
  <PmoApplicationContext.Provider value={currentUser}>
    {children}
  </PmoApplicationContext.Provider>
);
