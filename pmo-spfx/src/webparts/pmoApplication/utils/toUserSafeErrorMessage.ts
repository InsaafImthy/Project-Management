import { PmoBusinessError } from "../services/domain/ConfigurationManagementService";
import { SharePointError } from "../services/sharepoint/SharePointError";

const sanitizedDetail = (value: string): string | undefined => {
  const sanitized = value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized ? sanitized.slice(0, 320) : undefined;
};

const requestSource = (error: SharePointError): string => {
  if (!error.requestUrl) return "SharePoint";
  try {
    const path = new URL(error.requestUrl).pathname;
    return `SharePoint ${error.requestMethod ?? "request"} ${path}`;
  } catch {
    return "SharePoint";
  }
};

export const toUserSafeErrorMessage = (error?: unknown): string => {
  if (error instanceof PmoBusinessError) return error.message;
  const sharePointError =
    error instanceof SharePointError ||
    (typeof error === "object" &&
      error !== null &&
      "classification" in error &&
      typeof (error as { readonly classification?: unknown }).classification ===
        "string")
      ? (error as SharePointError)
      : undefined;
  if (sharePointError) {
    const source = requestSource(sharePointError);
    const responseStatus = sharePointError.status
      ? ` (HTTP ${sharePointError.status})`
      : "";
    const supportReference = sharePointError.correlationId
      ? ` Support reference: ${sharePointError.correlationId}.`
      : "";
    if (sharePointError.classification === "conflict") {
      return `This record changed after you opened it. Reload the latest version before saving again.${supportReference}`;
    }
    if (sharePointError.classification === "authorization") {
      return `You do not have permission to complete this action.${supportReference}`;
    }
    if (sharePointError.classification === "validation") {
      const detail = sanitizedDetail(sharePointError.message);
      return detail
        ? `${source} rejected the request${responseStatus}: ${detail}${supportReference}`
        : `${source} rejected the request${responseStatus}. Review the form and try again.${supportReference}`;
    }
    if (sharePointError.classification === "authentication") {
      return `Your Microsoft 365 session could not be verified. Refresh the page and sign in again if prompted.${supportReference}`;
    }
    if (sharePointError.classification === "notFound") {
      return `The requested SharePoint record or container is not available.${supportReference}`;
    }
    if (
      sharePointError.classification === "throttled" ||
      sharePointError.classification === "temporary"
    ) {
      return `SharePoint is temporarily unavailable. Wait briefly and retry.${supportReference}`;
    }
    return `${source} could not complete the operation${responseStatus}.${supportReference}`;
  }
  return "The requested operation could not be completed. Please try again or contact support.";
};
