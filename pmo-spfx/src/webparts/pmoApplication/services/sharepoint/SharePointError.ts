export type SharePointRetryClassification =
  | "conflict"
  | "throttled"
  | "temporary"
  | "authentication"
  | "authorization"
  | "validation"
  | "notFound"
  | "permanent";

export class SharePointError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly correlationId: string | undefined,
    public readonly classification: SharePointRetryClassification,
    public readonly serverCode?: string,
  ) {
    super(message);
    this.name = "SharePointError";
  }

  public get isRetryable(): boolean {
    return (
      this.classification === "throttled" ||
      this.classification === "temporary"
    );
  }
}
