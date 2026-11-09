import { PmoBusinessError } from "../services/domain/ConfigurationManagementService";
import { SharePointError } from "../services/sharepoint/SharePointError";

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
      return `SharePoint rejected one or more values. Review the form and try again.${supportReference}`;
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
    return `The SharePoint operation could not be completed.${supportReference}`;
  }
  return "The requested operation could not be completed. Please try again or contact support.";
};
