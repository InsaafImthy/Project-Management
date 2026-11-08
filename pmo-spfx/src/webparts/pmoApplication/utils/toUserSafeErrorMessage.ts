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
    if (sharePointError.classification === "conflict") {
      return "This record changed after you opened it. Reload the latest version before saving again.";
    }
    if (sharePointError.classification === "authorization") {
      return "You do not have permission to complete this action.";
    }
    if (sharePointError.classification === "validation") {
      return "SharePoint rejected one or more values. Review the form and try again.";
    }
  }
  return "The requested operation could not be completed. Please try again or contact support.";
};
