import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Wordmark } from "@/components/Wordmark";
import { signInAdmin } from "@/lib/auth";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await signInAdmin(form.email, form.password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError("");
      navigate({ to: "/admin" });
    } catch (cause) {
      setError(getUserFacingError(cause, "Administrator sign in failed. Please try again."));
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:px-8">
      <Link to="/" aria-label="5ADSH home" className="inline-block">
        <Wordmark className="text-3xl md:text-4xl" />
      </Link>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Admin access
      </p>
      <h1 className="mt-3 font-display text-5xl uppercase md:text-6xl">Sign in</h1>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <input
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Admin email"
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
          Enter dashboard
        </button>
      </form>
    </div>
  );
}
