import { ListingIdentityCollisionError } from "../reconciliation.ts";
import { CarPartSearchError } from "../types.ts";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

export function parseLimitParam(
  param: string | null,
  defaultValue = 50,
  max = 100,
): number {
  if (!param) return defaultValue;
  const num = Number(param);
  if (!Number.isFinite(num) || num < 1) return defaultValue;
  return Math.min(Math.floor(num), max);
}

export function mapErrorToResponse(error: unknown): Response {
  let status = 500;
  let message = "Request failed";
  let code: string | undefined;

  if (error instanceof ListingIdentityCollisionError) {
    status = 409;
    message = error.message;
    code = error.code;
  } else if (error instanceof CarPartSearchError) {
    code = error.code;
    message = error.message;
    switch (error.code) {
      case "RUN_TIMEOUT":
      case "REMOTE_BROWSER_TIMEOUT":
        status = 504;
        break;
      case "ACCESS_CHALLENGE":
        status = 503;
        break;
      case "REMOTE_BROWSER_CREATE_FAILED":
      case "REMOTE_CDP_CONNECTION_FAILED":
      case "REMOTE_BROWSER_DISCONNECTED":
      case "PAGE_LOAD_FAILED":
      case "FORM_SUBMIT_FAILED":
      case "CDP_CONNECTION_FAILED":
        status = 502;
        break;
      case "REFINEMENT_REQUIRED":
      case "SEARCH_OPTION_NOT_FOUND":
      case "REFINEMENT_OPTION_NOT_FOUND":
        status = 400;
        break;
      default:
        status = 502;
    }
  } else if (error instanceof Error) {
    message = error.message;
    if (message === "Watch not found" || message === "Not found") {
      status = 404;
    } else if (
      message.includes("is required") ||
      message.includes("Watch criteria are not present") ||
      message.includes("Postal code is required") ||
      message.includes("Catalog is not initialized")
    ) {
      status = 400;
    } else if (
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
    ) {
      status = (error as { status: number }).status;
    }
  }

  return json({
    error: message,
    ...(code ? { code } : {}),
  }, status);
}
