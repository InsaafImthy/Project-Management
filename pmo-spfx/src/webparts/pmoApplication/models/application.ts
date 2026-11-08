export interface IPmoCurrentUser {
  readonly displayName: string;
}

export type PmoApplicationStatus =
  | "ready"
  | "loading"
  | "accessDenied"
  | "error";
