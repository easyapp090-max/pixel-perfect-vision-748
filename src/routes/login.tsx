import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { signInCustomer } from "@/lib/auth";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await signInCustomer(form.email, form.password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError("");
      navigate({ to: "/account" });
    } catch (cause) {
      setError(getUserFacingError(cause, "Sign in could not be completed. Please try again."));
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Account</p>
      <h1 className="mt-3 font-display text-5xl uppercase md:text-6xl">Sign in</h1>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <input
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email"
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        <input
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Password"
          type="password"
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <button
          type="submit"
          className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          Continue
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <Link to="/register" className="underline underline-offset-4">
          Create account
        </Link>
        <Link to="/forgot-password" className="underline underline-offset-4">
          Forgot password
        </Link>
      </div>
    </div>
  );
}
