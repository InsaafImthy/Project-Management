export interface IPmoCurrentUser {
  readonly displayName: string;
  readonly email: string;
  readonly capabilities: readonly string[];
}

export type PmoApplicationStatus =
  | "ready"
  | "loading"
  | "accessDenied"
  | "error";
