import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { registerCustomer } from "@/lib/auth";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await registerCustomer(form);
      if (!result.ok) {
        setError(result.message);
        setMessage("");
        return;
      }
      setError("");
      setMessage(result.message);
      if (result.user) navigate({ to: "/account" });
    } catch (cause) {
      setError(getUserFacingError(cause, "Registration could not be completed. Please try again."));
      setMessage("");
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Account</p>
      <h1 className="mt-3 font-display text-5xl uppercase md:text-6xl">Register</h1>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <input
          value={form.fullName}
          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          placeholder="Full name"
          required
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        <input
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email"
          type="email"
          required
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        <input
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="Phone"
          required
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        <input
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Password"
          type="password"
          required
          className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <button
          type="submit"
          className="w-full border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
        >
          Create account
        </button>
      </form>

      <div className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </div>
    </div>
  );
}
