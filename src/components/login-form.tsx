"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Labels {
  email: string;
  password: string;
  submit: string;
  pending: string;
  invalid: string;
  demoTitle: string;
  demoHint: string;
}

interface DemoAccount {
  email: string;
  name: string;
  role: string;
  password: string;
}

export function LoginForm({
  next,
  labels,
  demo,
}: {
  next: string;
  labels: Labels;
  demo: DemoAccount[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setError(labels.invalid);
    setPending(false);
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm transition hover:border-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100";

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-800">
            {labels.email}
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-800">
            {labels.password}
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-3 py-2.5 font-semibold text-white shadow-sm shadow-brand-900/20 transition hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {pending ? labels.pending : labels.submit}
        </button>
      </form>

      {demo.length > 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-zinc-900">
            <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Demo
            </span>
            {labels.demoTitle}
          </p>
          <p className="mt-1 text-xs text-zinc-600">{labels.demoHint}</p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {demo.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError(null);
                  }}
                  aria-pressed={email === account.email}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition hover:border-brand-300 hover:bg-white ${email === account.email ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-zinc-200 bg-white"}`}
                >
                  <span className="block font-medium text-zinc-900">
                    {account.role}
                  </span>
                  <span className="block truncate text-xs text-zinc-600">
                    {account.name} · {account.email}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
