import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getCurrentCustomer, registerCustomer, signInCustomer, signOutCustomer } from "@/lib/auth";
import type { CustomerSession } from "@/lib/auth";
import { loadCustomerOrders } from "@/lib/store-api";
import { getUserFacingError } from "@/lib/user-messages";

type AccountOrder = {
  id: string;
  status?: string;
  total?: number | string;
};

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"signin" | "register">("signin");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });

  useEffect(() => {
    let active = true;
    getCurrentCustomer()
      .then(async (current) => {
        if (!active) return;
        setCustomer(current);
        if (current) setOrders(await loadCustomerOrders());
      })
      .catch((cause: unknown) => {
        if (active)
          setError(getUserFacingError(cause, "Could not load account data. Please try again."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await signInCustomer(form.email, form.password);
      if (!result.ok) {
        setError(result.message);
        setMessage("");
        return;
      }
      setError("");
      setCustomer(result.user ?? null);
      setOrders(await loadCustomerOrders());
      navigate({ to: "/account" });
    } catch (cause) {
      setError(getUserFacingError(cause, "Sign in failed. Please try again."));
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await registerCustomer({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
      });
      if (result.ok) {
        setError("");
        setMessage(result.message);
      } else {
        setError(result.message);
        setMessage("");
      }
      if (result.user) {
        setCustomer(result.user);
        navigate({ to: "/account" });
      }
    } catch (cause) {
      setError(getUserFacingError(cause, "Registration failed. Please try again."));
      setMessage("");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutCustomer();
      setCustomer(null);
      setOrders([]);
      navigate({ to: "/login" });
    } catch (cause) {
      setError(getUserFacingError(cause, "Sign out failed. Please try again."));
    }
  };

  if (loading)
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 text-sm text-muted-foreground">
        Loading account…
      </div>
    );

  if (customer) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Account
            </p>
            <h1 className="font-display text-5xl uppercase md:text-7xl">Welcome back</h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="border p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Profile
            </p>
            <h2 className="mt-3 font-display text-3xl uppercase">{customer.fullName}</h2>
            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              <p>{customer.email}</p>
              <p>{customer.phone}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground">
                {customer.role}
              </p>
            </div>
          </div>

          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Order history</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No orders have been placed yet. Once you place an order, it will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((order: AccountOrder) => (
                  <div key={order.id} className="border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          #{order.id}
                        </p>
                        <p className="mt-1 text-sm uppercase">{order.status}</p>
                      </div>
                      <span className="font-mono text-sm">
                        EGP {Number(order.total ?? 0).toLocaleString("en-US")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Account
          </p>
          <h1 className="font-display text-5xl uppercase md:text-7xl">Your profile</h1>
        </div>
        <Link to="/" className="border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          Continue shopping
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border p-5">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setView("signin")}
              className={`flex-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${view === "signin" ? "bg-primary text-primary-foreground" : ""}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setView("register")}
              className={`flex-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${view === "register" ? "bg-primary text-primary-foreground" : ""}`}
            >
              Register
            </button>
          </div>

          {error ? <p className="mb-3 text-sm text-red-500">{error}</p> : null}
          {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}

          {view === "signin" ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
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
              <button
                type="submit"
                className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Sign in
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegister}>
              <input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                placeholder="Full name"
                className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="Email"
                className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="Phone"
                className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Password"
                type="password"
                className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              />
              <button
                type="submit"
                className="w-full border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
              >
                Create account
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Guest checkout remains available at checkout and confirmation pages are only visible to
            the purchasing customer.
          </p>
        </div>

        <div className="border p-5">
          <h2 className="mb-4 font-display text-3xl uppercase">Order history</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No orders have been placed yet. Once you place an order, it will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order: AccountOrder) => (
                <div key={order.id} className="border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        #{order.id}
                      </p>
                      <p className="mt-1 text-sm uppercase">{order.status}</p>
                    </div>
                    <span className="font-mono text-sm">
                      EGP {Number(order.total ?? 0).toLocaleString("en-US")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
