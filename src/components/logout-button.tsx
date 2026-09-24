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
      className="rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-60"
    >
      {label}
    </button>
  );
}
