import { initializeIcons } from "@fluentui/react";

let initialized = false;

/** Registers the Fluent UI v8 icon font once for controls used by the PMO app. */
export const initializePmoIcons = (): void => {
  if (!initialized) {
    initializeIcons();
    initialized = true;
  }
};
