export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

type SupabaseLikeError = {
  code?: unknown;
};

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const code = (error as SupabaseLikeError).code;
  return typeof code === "string" ? code : "";
}

export function getUserFacingError(error: unknown, fallback: string) {
  return error instanceof UserInputError ? error.message : fallback;
}

export function getSafeAuthError(error: unknown) {
  switch (errorCode(error)) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Please verify your email before signing in.";
    case "user_already_exists":
    case "email_exists":
      return "An account may already exist for this email address.";
    case "weak_password":
      return "Choose a stronger password and try again.";
    case "same_password":
      return "Choose a different password and try again.";
    case "over_email_send_rate_limit":
      return "Too many email requests. Please try again later.";
    default:
      return "Authentication could not be completed. Please check your details and try again.";
  }
}
