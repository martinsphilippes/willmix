"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ label }: { label: string }) {
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
      className="rounded-lg border border-white/30 px-2.5 py-1 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-white disabled:opacity-60"
    >
      {label}
    </button>
  );
}
