"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Labels {
  email: string;
  password: string;
  submit: string;
  pending: string;
  invalid: string;
}

export function LoginForm({ next, labels }: { next: string; labels: Labels }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    if (response.ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setError(labels.invalid);
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium">{labels.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{labels.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={6}
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
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
        className="w-full rounded-md bg-zinc-900 px-3 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? labels.pending : labels.submit}
      </button>
    </form>
  );
}
