"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import type { PermissionGroup } from "./permission-list";
import {
  TeamAccessEditor,
  type EditorFunction,
  type EditorMember,
  type EditorOptions,
  type EditorTexts,
} from "./team-access-editor";

/*
 * "Editar acessos" em painel lateral na própria lista da equipe (dono,
 * 14/11/2026). O link "Editar acessos" da lista continua apontando para
 * /app/team/[id] (nova aba, sem JavaScript): com o painel, o toque abre a
 * pessoa aqui mesmo, por cima da lista, sem trocar de tela. O nome continua
 * abrindo a página da pessoa (com "Excluir acesso"). Assim, ao fechar, a lista
 * fica como estava (busca, ordem, página e rolagem). No celular o painel
 * ocupa a largura toda. Salvar atualiza a lista no lugar e fecha o painel com
 * o aviso.
 */
export function TeamAccessDrawer({
  members,
  functions,
  screenGroups,
  actionGroups,
  base,
  options,
  texts,
  savedText,
}: {
  members: EditorMember[];
  functions: EditorFunction[];
  screenGroups: PermissionGroup[];
  actionGroups: PermissionGroup[];
  base: string[];
  options: EditorOptions;
  texts: EditorTexts;
  /** "Acessos de {name} salvos." */
  savedText: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dirty = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const member = members.find((m) => m.id === openId) ?? null;

  const close = useCallback(
    (force = false) => {
      if (!force && dirty.current && !window.confirm(texts.discard)) return;
      dirty.current = false;
      setOpenId(null);
      // Volta o foco a quem abriu (a lista fica onde estava).
      window.setTimeout(
        () => trigger.current?.focus({ preventScroll: true }),
        0,
      );
    },
    [texts.discard],
  );

  // Os links da lista abrem o painel (o endereço continua para abrir em nova
  // aba ou sem JavaScript).
  useEffect(() => {
    // Na captura, antes do Link do Next (que navegaria para a página).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-team-open]",
      );
      const id = link?.getAttribute("data-team-open");
      if (!link || !id || !members.some((m) => m.id === id)) return;
      e.preventDefault();
      e.stopPropagation();
      trigger.current = link;
      dirty.current = false;
      setToast(null);
      setOpenId(id);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [members]);

  // Aberto: a página de baixo não rola (a posição da lista fica), Esc fecha
  // e o foco vai para o título do painel.
  useEffect(() => {
    if (!openId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    heading.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [openId, close]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <>
      {toast ? (
        // Aviso fixo no pé da tela: aparece onde quer que a lista esteja.
        <div
          className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md shadow-lg"
          data-team-saved-toast
        >
          <Alert tone="success">{toast}</Alert>
        </div>
      ) : null}
      {member ? (
        <div className="fixed inset-0 z-50 flex justify-end" data-team-drawer>
          <button
            type="button"
            aria-label={texts.close}
            tabIndex={-1}
            onClick={() => close()}
            className="absolute inset-0 bg-zinc-900/40"
            data-team-drawer-backdrop
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-drawer-title"
            className="relative flex h-full w-full flex-col bg-white shadow-2xl md:max-w-xl"
            data-team-drawer-panel={member.id}
          >
            <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <h2
                  id="team-drawer-title"
                  ref={heading}
                  tabIndex={-1}
                  className="text-lg font-semibold tracking-tight text-zinc-900 focus:outline-none"
                >
                  {texts.title}
                </h2>
                <p className="truncate text-sm text-zinc-600">
                  <span className="font-medium text-zinc-800">
                    {member.name}
                  </span>{" "}
                  · {member.login}
                </p>
              </div>
              <button
                type="button"
                onClick={() => close()}
                aria-label={texts.close}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-xl leading-none text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                data-team-drawer-close
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <TeamAccessEditor
              key={member.id}
              member={member}
              functions={functions}
              screenGroups={screenGroups}
              actionGroups={actionGroups}
              base={base}
              options={options}
              texts={texts}
              mode="drawer"
              deleteHref={`/app/team/${member.id}`}
              onDirtyChange={(d) => {
                dirty.current = d;
              }}
              onCancel={() => close()}
              onSaved={() => {
                setToast(savedText.replace("{name}", member.name));
                close(true);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
