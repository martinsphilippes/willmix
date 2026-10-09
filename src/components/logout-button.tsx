"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({
  label,
  variant = "header",
}: {
  label: string;
  /** "header": no fundo vermelho; "light": dentro de cartão branco (menu da conta, painel do celular). */
  variant?: "header" | "light";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        variant === "light"
          ? "inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-60"
          : "rounded-lg border border-white/30 px-2.5 py-1 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-white disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}
