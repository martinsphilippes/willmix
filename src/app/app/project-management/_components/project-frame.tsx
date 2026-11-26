"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import {
  pmDeleteAction,
  pmListAction,
  pmMeAction,
  pmProfilesAction,
  pmSetAction,
  pmUpdateAction,
  pmUploadAction,
  type PmResult,
} from "@/app/app/actions/project-management";
import {
  isPmTab,
  PM_TABS,
  PROJECT_MANAGEMENT_PATH,
} from "@/lib/project-management";

type Request = {
  wmPm: 1;
  id: number;
  op: string;
  args: Record<string, unknown>;
};

/* Cada pedido da plataforma (src/lib/project-management/shim.ts) vira uma Server Action. */
async function handle(op: string, a: Record<string, unknown>) {
  const s = (k: string) => String(a[k] ?? "");
  const obj = (k: string) => (a[k] ?? {}) as Record<string, unknown>;
  switch (op) {
    case "list":
      return pmListAction({ collection: s("collection") });
    case "set":
      return pmSetAction({
        collection: s("collection"),
        id: s("id"),
        data: obj("data"),
      });
    case "update":
      return pmUpdateAction({
        collection: s("collection"),
        id: s("id"),
        patch: obj("patch"),
      });
    case "delete":
      return pmDeleteAction({ collection: s("collection"), id: s("id") });
    case "me":
      return pmMeAction();
    case "profiles":
      return pmProfilesAction({
        ids: Array.isArray(a.ids) ? a.ids.map(String) : [],
      });
    case "upload": {
      const form = new FormData();
      if (a.file instanceof File) form.set("file", a.file);
      return pmUploadAction(form);
    }
    default:
      return { ok: false, error: "unknown_op" } as PmResult<never>;
  }
}

export function ProjectFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const tab = isPmTab(segment) ? segment : PM_TABS[0];
  // O endereço inicial do iframe não muda: trocar de aba não recarrega a plataforma.
  const [initial] = useState(() => `${src}#${tab}`);
  const current = useRef(tab);

  // Altura: do topo do iframe até o pé da janela, para a plataforma (e a
  // gaveta da atividade, fixa dentro dela) caber sem rolar a página.
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(480, window.innerHeight - top + window.scrollY - 16));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    current.current = tab;
    ref.current?.contentWindow?.postMessage(
      { wmPmGo: tab },
      window.location.origin,
    );
  }, [tab]);

  useEffect(() => {
    const onMessage = async (ev: MessageEvent) => {
      const frame = ref.current?.contentWindow;
      if (ev.origin !== window.location.origin || !frame || ev.source !== frame)
        return;
      const m = ev.data as Partial<Request> & { wmPmTab?: string };
      if (typeof m.wmPmTab === "string") {
        // Aba trocada dentro da plataforma: o endereço e o menu acompanham.
        if (isPmTab(m.wmPmTab) && m.wmPmTab !== current.current) {
          current.current = m.wmPmTab;
          router.replace(`${PROJECT_MANAGEMENT_PATH}/${m.wmPmTab}`, {
            scroll: false,
          });
        }
        return;
      }
      if (m.wmPm !== 1 || typeof m.id !== "number" || !m.op) return;
      let result: PmResult<unknown>;
      try {
        result = await handle(m.op, m.args ?? {});
      } catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : "failed",
        };
      }
      frame.postMessage(
        { wmPmReply: 1, id: m.id, ...result },
        window.location.origin,
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <iframe
      ref={ref}
      src={initial}
      title={title}
      data-project-frame
      className="block w-full rounded-lg border border-zinc-200 bg-white"
      style={{
        height: height
          ? `${height}px`
          : "calc(100dvh - var(--wm-header, 4rem) - 6rem)",
      }}
    />
  );
}
