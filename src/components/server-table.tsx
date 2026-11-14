import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import {
  nextServerSort,
  type ServerSort,
  type ServerTablePage,
} from "@/lib/server-table";
import { cx } from "./ui";

/*
 * Cabeçalho que ordena e rodapé que pagina uma tabela feita no servidor
 * (src/lib/server-table.ts), com a mesma aparência da TableTools: a seta do
 * cabeçalho (`data-table-sort`, globals.css), "16–30 de 42" e ‹ ›. Tudo é
 * link: a lista inteira é ordenada e paginada no servidor.
 */

/** Cabeçalho que ordena a lista inteira (crescente → decrescente → original). */
export function SortTh({
  label,
  column,
  sort,
  href,
  t,
  className,
}: {
  label: ReactNode;
  column: string;
  sort: ServerSort | null;
  /** Endereço da lista com a ordem dada (nula: a original). */
  href: (sort: string | null) => string;
  t: Translate;
  className?: string;
}) {
  const state = sort?.key === column ? (sort.desc ? "desc" : "asc") : "none";
  return (
    <th
      className={cx(
        "border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500",
        className,
      )}
      data-table-sort={state}
      data-server-sort={column}
      aria-sort={
        state === "asc" ? "ascending" : state === "desc" ? "descending" : "none"
      }
    >
      <Link
        href={href(nextServerSort(sort, column))}
        title={t("tableTools.sortHint")}
        className="uppercase hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-brand-600"
        scroll={false}
      >
        {label}
      </Link>
    </th>
  );
}

const pagerLink =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-base leading-none text-zinc-700 hover:bg-zinc-50";

/** "16–30 de 42" e ‹ › (links para a página anterior e a seguinte). */
export function ServerPager({
  page,
  href,
  t,
}: {
  page: Pick<
    ServerTablePage<unknown>,
    "page" | "pages" | "from" | "to" | "matched"
  >;
  /** Endereço da página dada (base 0). */
  href: (page: number) => string;
  t: Translate;
}) {
  if (page.matched === 0) return null;
  const prev = page.page > 0;
  const next = page.page < page.pages - 1;
  const disabled = cx(pagerLink, "cursor-not-allowed opacity-40");
  return (
    <div
      className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[13px] text-zinc-600"
      data-server-pager
    >
      <span data-server-range>
        {t("tableTools.range", {
          from: page.from,
          to: page.to,
          total: page.matched,
        })}
      </span>
      <span className="flex items-center gap-1">
        {prev ? (
          <Link
            href={href(page.page - 1)}
            aria-label={t("tableTools.prev")}
            title={t("tableTools.prev")}
            className={pagerLink}
            data-server-prev
          >
            ‹
          </Link>
        ) : (
          <span aria-hidden className={disabled}>
            ‹
          </span>
        )}
        {next ? (
          <Link
            href={href(page.page + 1)}
            aria-label={t("tableTools.next")}
            title={t("tableTools.next")}
            className={pagerLink}
            data-server-next
          >
            ›
          </Link>
        ) : (
          <span aria-hidden className={disabled}>
            ›
          </span>
        )}
      </span>
    </div>
  );
}
