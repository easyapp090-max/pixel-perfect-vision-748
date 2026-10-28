import { describe, expect, it } from "vitest";

import { getSafeAuthError, getUserFacingError, UserInputError } from "@/lib/user-messages";

describe("user-facing error messages", () => {
  it("keeps intentional input validation messages", () => {
    const error = new UserInputError("Enter the phone number used for the order.");

    expect(getUserFacingError(error, "The request could not be completed.")).toBe(
      "Enter the phone number used for the order.",
    );
  });

  it("hides arbitrary service and database details", () => {
    const error = new Error("PostgREST private order detail 123");

    expect(getUserFacingError(error, "The request could not be completed.")).toBe(
      "The request could not be completed.",
    );
    expect(getUserFacingError(error, "The request could not be completed.")).not.toContain(
      "private order detail",
    );
  });

  it("maps known auth codes without exposing the provider message", () => {
    expect(
      getSafeAuthError({
        code: "invalid_credentials",
        message: "provider details for user@example.com",
      }),
    ).toBe("Email or password is incorrect.");
    expect(getSafeAuthError({ message: "database connection details" })).not.toContain(
      "database connection",
    );
  });
});
