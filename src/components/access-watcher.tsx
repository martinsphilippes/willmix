"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 * Mantém o menu e os atalhos do cabeçalho de uma sessão aberta em dia com as
 * permissões (dono, 14/11/2026; src/lib/auth/access-stamp.ts). O layout não
 * é desenhado de novo numa navegação comum, então uma tela liberada ou
 * retirada só apareceria no menu ao recarregar. A cada navegação, quando a
 * aba volta ao foco e a cada minuto com a aba visível, confere o carimbo do
 * acesso; diferente do que o layout desenhou, refaz a tela (menu, cabeçalho
 * e a página, que recusa o que não abre mais).
 */
const EVERY_MS = 60_000;

export function AccessWatcher({ stamp }: { stamp: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useRef(stamp);
  const busy = useRef(false);

  useEffect(() => {
    current.current = stamp;
  }, [stamp]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      try {
        const res = await fetch("/api/access/stamp", { cache: "no-store" });
        if (!alive) return;
        if (res.status === 401) {
          router.refresh();
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { stamp?: string | null };
        if (body.stamp && body.stamp !== current.current) {
          current.current = body.stamp;
          router.refresh();
        }
      } catch {
        // Sem conexão: confere de novo na próxima vez.
      } finally {
        busy.current = false;
      }
    };
    void check();
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(check, EVERY_MS);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [pathname, router]);

  return null;
}
