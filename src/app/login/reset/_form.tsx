"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { setNewPasswordAction } from "@/app/app/actions/password-reset";

interface Labels {
  password: string;
  confirm: string;
  submit: string;
  pending: string;
  noToken: string;
  done: string;
  login: string;
  errors: Record<string, string>;
}

/** Lê o token do link (#access_token=...) e grava a nova senha. */
export function ResetPasswordForm({ labels }: { labels: Labels }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    // Tira o token da barra de endereço (não fica no histórico).
    if (window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
    // O token só existe no navegador (depois do "#"): lido uma vez ao abrir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(hash.get("access_token"));
    if (hash.get("error")) setError("expired");
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await setNewPasswordAction({
      token,
      password: String(data.get("password") ?? ""),
      confirm: String(data.get("confirm") ?? ""),
    });
    setPending(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  }

  if (token === undefined) return null;
  if (done)
    return (
      <p className="text-sm text-emerald-700">
        {labels.done}{" "}
        <Link href="/login" className="font-semibold underline">
          {labels.login}
        </Link>
      </p>
    );
  if (!token)
    return (
      <p className="text-sm text-zinc-600">
        {error ? labels.errors.expired : labels.noToken}
      </p>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        {labels.password}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        {labels.confirm}
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {labels.errors[error] ?? labels.errors.failed}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {pending ? labels.pending : labels.submit}
      </button>
    </form>
  );
}
