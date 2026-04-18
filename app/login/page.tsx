"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace("/");
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);

    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${appUrl}/auth/callback?recovery=1`,
    });

    if (error) {
      setForgotError(error.message);
    } else {
      setForgotSuccess(true);
    }
    setForgotLoading(false);
  }

  if (view === "forgot") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="font-mono text-2xl font-semibold text-ink tracking-tight">
              kallchatt
            </h1>
            <p className="text-sm text-muted mt-1">Reset your password</p>
          </div>

          {forgotSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-ink border border-border bg-surface-2 px-3 py-2">
                If that email exists, a reset link has been sent. Check your inbox.
              </p>
              <button
                onClick={() => {
                  setView("login");
                  setForgotSuccess(false);
                  setForgotEmail("");
                }}
                className="font-mono text-xs text-muted hover:text-ink transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block font-mono text-xs font-medium text-muted uppercase tracking-wider mb-2"
                >
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink transition-colors"
                />
              </div>

              {forgotError && (
                <p className="text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2">
                  {forgotError}
                </p>
              )}

              <button
                type="submit"
                disabled={forgotLoading || !forgotEmail}
                className="w-full bg-ink text-surface font-mono text-sm font-medium py-2.5 px-4 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
              >
                {forgotLoading ? "Sending..." : "Send reset link"}
              </button>

              <button
                type="button"
                onClick={() => setView("login")}
                className="font-mono text-xs text-muted hover:text-ink transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="font-mono text-2xl font-semibold text-ink tracking-tight">
            kallchatt
          </h1>
          <p className="text-sm text-muted mt-1">
            Threads. Groups. Status. Nothing else.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-xs font-medium text-muted uppercase tracking-wider mb-2"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs font-medium text-muted uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-ink text-surface font-mono text-sm font-medium py-2.5 px-4 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => setView("forgot")}
            className="font-mono text-xs text-muted hover:text-ink transition-colors"
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}
