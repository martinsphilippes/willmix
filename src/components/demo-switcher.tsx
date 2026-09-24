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
}: {
  accounts: DemoAccount[];
  current: string;
  password: string;
  label: string;
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
    <label className="flex items-center gap-1.5 rounded-lg bg-black/15 py-0.5 pl-2 pr-0.5 text-white">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
        Demo
      </span>
      <select
        aria-label={label}
        value={current}
        disabled={pending}
        onChange={(e) => switchTo(e.target.value)}
        className="max-w-40 rounded-md sm:max-w-44 border-0 bg-white px-2 py-1 text-xs font-medium text-zinc-900 focus-visible:outline-white disabled:opacity-60"
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
