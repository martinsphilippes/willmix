"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  LIST_RETURN_PATHS,
  isFresh,
  parseTableView,
  readListReturn,
  writeListReturn,
  type ReturnList,
} from "@/lib/list-return";
import { TextLink } from "./ui";

/*
 * Volta para a lista como ela estava (dono, 19/11/2026; src/lib/list-return.ts):
 * - `ListReturnMemory`, na lista: ao abrir uma linha (links com
 *   `data-list-return`), guarda o endereço, a vista da tabela e a rolagem; ao
 *   voltar para o mesmo endereço, devolve a rolagem (a TableTools devolve a
 *   busca, a ordem e a página dela);
 * - `ListReturnLink`, nos detalhes: "Voltar às solicitações" para o endereço
 *   guardado; sem nada guardado, a lista do início.
 */

const noSubscribe = () => () => {};
/** O que a pessoa faz que interrompe a volta da rolagem (ela já está rolando). */
const USER_INPUT = ["wheel", "touchstart", "keydown", "mousedown"] as const;

export function ListReturnMemory({ list }: { list: ReturnList }) {
  useEffect(() => {
    const here = window.location.pathname + window.location.search;
    const saved = readListReturn(list);
    let frame = 0;
    let stopped = false;
    const onInput = () => stop();
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      for (const type of USER_INPUT)
        window.removeEventListener(type, onInput, true);
    };
    if (saved && saved.url === here && isFresh(saved, Date.now())) {
      for (const type of USER_INPUT)
        window.addEventListener(type, onInput, {
          capture: true,
          passive: true,
        });
      /* A tabela ainda vai para a página guardada e a navegação pode rolar ao
         topo depois desta tela montar: insiste por alguns quadros, até a
         rolagem ficar no lugar. */
      let tries = 0;
      const step = () => {
        if (stopped) return;
        tries += 1;
        if (Math.abs(window.scrollY - saved.y) > 1)
          window.scrollTo({ top: saved.y, left: 0, behavior: "instant" });
        const placed = Math.abs(window.scrollY - saved.y) <= 1;
        if ((placed && tries >= 12) || tries >= 90) {
          stop();
          writeListReturn(list, null);
          return;
        }
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    } else if (saved) {
      // Outra vista da lista (outro filtro, outra página): o guardado não vale.
      writeListReturn(list, null);
    }
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        "a[data-list-return]",
      );
      if (!link) return;
      const raw = document.querySelector<HTMLElement>(
        `[data-table-return="${list}"]`,
      )?.dataset.tableState;
      let table = null;
      try {
        table = raw ? parseTableView(JSON.parse(raw)) : null;
      } catch {
        table = null;
      }
      writeListReturn(list, {
        url: window.location.pathname + window.location.search,
        y: Math.round(window.scrollY),
        at: Date.now(),
        table,
      });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      stop();
      document.removeEventListener("click", onClick, true);
    };
  }, [list]);
  return null;
}

/** O endereço guardado da lista (ainda valendo), ou nulo. */
function savedUrl(list: ReturnList): string | null {
  const saved = readListReturn(list);
  return saved && isFresh(saved, Date.now()) ? saved.url : null;
}

export function ListReturnLink({
  list,
  children,
  className,
  ...rest
}: {
  list: ReturnList;
  children: ReactNode;
  className?: string;
} & { [key: `data-${string}`]: string | undefined }) {
  const path = LIST_RETURN_PATHS[list];
  const saved = useSyncExternalStore(
    noSubscribe,
    () => savedUrl(list),
    () => null,
  );
  return (
    <TextLink
      href={saved ?? path}
      // Com a vista guardada, a lista devolve a rolagem (sem ir ao topo).
      scroll={saved ? false : undefined}
      className={className}
      data-list-return-link={saved ? "saved" : "start"}
      {...rest}
    >
      {children}
    </TextLink>
  );
}
