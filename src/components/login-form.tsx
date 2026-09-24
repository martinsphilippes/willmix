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
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200";

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-sky-700 px-3 py-2 font-medium text-white hover:bg-sky-600 disabled:opacity-60"
        >
          {pending ? labels.pending : labels.submit}
        </button>
      </form>

      {demo.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">{labels.demoTitle}</p>
          <p className="mt-1 text-xs text-amber-800">{labels.demoHint}</p>
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
                  className={`w-full rounded-md border px-2 py-1.5 text-left transition hover:border-amber-400 hover:bg-white ${email === account.email ? "border-amber-500 bg-white" : "border-amber-200 bg-amber-100/50"}`}
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
