"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DemoAccount {
  email: string;
  label: string;
}

/**
 * Troca de conta em um toque, só quando as contas de demonstração estão ligadas.
 * Faz logout e login com a senha de demonstração; nunca aparece com dados reais.
 */
export function DemoSwitcher({
  accounts,
  current,
  password,
  label,
  variant = "header",
}: {
  accounts: DemoAccount[];
  current: string;
  password: string;
  label: string;
  /** "header": no fundo vermelho; "light": no painel branco do celular. */
  variant?: "header" | "light";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function switchTo(email: string) {
    if (!email || email === current) return;
    setPending(true);
    await fetch("/api/auth/session", { method: "DELETE" });
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (response.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-lg py-0.5 pl-2 pr-0.5 ${
        variant === "light"
          ? "bg-zinc-100 text-zinc-700"
          : "bg-black/15 text-white"
      }`}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          variant === "light" ? "text-zinc-500" : "text-white/80"
        }`}
      >
        Demo
      </span>
      <select
        aria-label={label}
        value={current}
        disabled={pending}
        onChange={(e) => switchTo(e.target.value)}
        className={`max-w-40 rounded-md border-0 bg-white font-medium text-zinc-900 disabled:opacity-60 sm:max-w-48 ${
          variant === "light"
            ? "px-2.5 py-2 text-sm"
            : "px-2 py-1 text-xs focus-visible:outline-white"
        }`}
      >
        {accounts.map((a) => (
          <option key={a.email} value={a.email}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
