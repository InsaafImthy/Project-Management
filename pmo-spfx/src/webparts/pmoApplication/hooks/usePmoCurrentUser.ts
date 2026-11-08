import * as React from "react";
import { PmoApplicationContext } from "../context/PmoApplicationContext";
import type { IPmoCurrentUser } from "../models/application";

export const usePmoCurrentUser = (): IPmoCurrentUser => {
  const currentUser = React.useContext(PmoApplicationContext);
  if (!currentUser) {
    throw new Error(
      "usePmoCurrentUser must be used inside PmoApplicationProvider.",
    );
  }

  return currentUser;
};
