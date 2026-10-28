import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { sendPasswordRecovery } from "@/lib/auth";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await sendPasswordRecovery(email);
      setMessage(result.message);
    } catch (cause) {
      setMessage(getUserFacingError(cause, "Password recovery failed. Please try again."));
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Account</p>
      <h1 className="mt-3 font-display text-5xl uppercase md:text-6xl">Reset password</h1>
      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          required
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <button
          type="submit"
          className="w-full border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
        >
          Send reset link
        </button>
      </form>

      <div className="mt-6 text-sm text-muted-foreground">
        Back to{" "}
        <Link to="/login" className="underline underline-offset-4">
          sign in
        </Link>
      </div>
    </div>
  );
}
