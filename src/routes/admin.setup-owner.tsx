import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/Wordmark";
import { getCurrentCustomer, isFirstOwnerSetupAvailable, registerFirstOwner } from "@/lib/auth";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/admin/setup-owner")({
  component: FirstOwnerSetupPage,
});

function FirstOwnerSetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "available" | "closed" | "pending">("loading");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmation: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([isFirstOwnerSetupAvailable(), getCurrentCustomer()])
      .then(async ([available, user]) => {
        if (!active) return;
        if (!available) {
          setStatus("closed");
          return;
        }
        if (user?.role === "owner") {
          navigate({ to: "/admin" });
          return;
        }
        if (user) {
          setForm((current) => ({ ...current, email: user.email }));
          setMessage(
            `معرّف الحساب: ${user.id}. يجب على مسؤول قاعدة بيانات موثوق منح صلاحية المالك بعد التحقق من البريد الإلكتروني.`,
          );
          setStatus("pending");
          return;
        }
        setStatus("available");
      })
      .catch((cause: unknown) => {
        if (active) {
          setStatus("closed");
          setError(
            getUserFacingError(cause, "إعداد المالك غير متاح حاليًا. حاول مرة أخرى لاحقًا."),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (status !== "pending") return;
    let active = true;
    const checkOwner = async () => {
      try {
        const user = await getCurrentCustomer();
        if (active && user?.role === "owner") navigate({ to: "/admin" });
      } catch {
        // The status message remains visible; a later check or explicit sign-in can recover.
      }
    };
    const timer = window.setInterval(checkOwner, 4000);
    void checkOwner();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [navigate, status]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    const result = await registerFirstOwner(form);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.needsEmailVerification) {
      setMessage(result.message);
      setStatus("pending");
      return;
    }
    setMessage(result.message);
    setStatus("pending");
  };

  return (
    <main dir="auto" className="min-h-screen bg-background px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-xl">
        <Link to="/" aria-label="5ADSH home" className="inline-block">
          <Wordmark className="text-3xl md:text-4xl" />
        </Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          First owner setup · إعداد المالك الأول
        </p>
        <h1 className="mt-3 font-display text-5xl uppercase leading-none md:text-7xl">
          Your store starts here
        </h1>
        <p className="mt-5 max-w-lg text-muted-foreground">
          Create the first owner account. This page closes permanently after the first owner is
          created.
        </p>

        {status === "loading" ? (
          <p className="mt-8 font-mono text-xs uppercase">Checking setup status…</p>
        ) : null}
        {status === "closed" ? (
          <section className="mt-8 border border-input p-6">
            <h2 className="font-display text-3xl uppercase">Setup already complete</h2>
            <p className="mt-3 text-muted-foreground">
              A first owner is already configured. New owner registrations are disabled.
            </p>
            {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
            <Link
              to="/admin/login"
              className="mt-6 inline-block bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
            >
              Go to admin login
            </Link>
          </section>
        ) : null}

        {status === "available" ? (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Full name / الاسم الكامل"
              autoComplete="name"
              className="w-full border border-input bg-background px-4 py-3 outline-none"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Email / البريد الإلكتروني"
              autoComplete="email"
              className="w-full border border-input bg-background px-4 py-3 outline-none"
            />
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Password / كلمة المرور"
              autoComplete="new-password"
              className="w-full border border-input bg-background px-4 py-3 outline-none"
            />
            <input
              required
              minLength={8}
              type="password"
              value={form.confirmation}
              onChange={(event) => setForm({ ...form, confirmation: event.target.value })}
              placeholder="Confirm password / تأكيد كلمة المرور"
              autoComplete="new-password"
              className="w-full border border-input bg-background px-4 py-3 outline-none"
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            <button
              disabled={submitting}
              type="submit"
              className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create owner account"}
            </button>
          </form>
        ) : null}
        {status === "pending" ? (
          <section className="mt-8 border border-input p-6" role="status">
            <h2 className="font-display text-3xl uppercase">Verification and approval required</h2>
            <p className="mt-3 text-muted-foreground">{message}</p>
            {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
            <p className="mt-4 text-sm text-muted-foreground">
              تُمنح صلاحية المالك عبر إجراء مسؤول قاعدة البيانات الموثوق فقط. لا يمكن لهذه الصفحة
              منح الصلاحيات.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
