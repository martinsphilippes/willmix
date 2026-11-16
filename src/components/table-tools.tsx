"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import * as copy from "@/i18n/modules/table-tools";
import {
  PAGE_SIZES,
  TABLE_REVEAL_EVENT,
  compareKeys,
  matchesQuery,
  pageOfIndex,
  pageRange,
  sortKey,
  type PageSize,
} from "@/lib/table-tools";
import { twMerge } from "tailwind-merge";

/*
 * Busca, ordenação e paginação de qualquer tabela do portal (padrão do
 * <Table> em ui.tsx). A tabela continua sendo renderizada pelo servidor; este
 * componente só age sobre as linhas já na tela:
 * - clicar no cabeçalho ordena (de novo inverte, a terceira volta à ordem
 *   original);
 * - a busca filtra ao digitar, em todas as colunas (inclui o valor de campos);
 * - 15, 25 ou 50 linhas por página (a escolha fica guardada no aparelho).
 *
 * Linhas são escondidas com `hidden` e reordenadas dentro do mesmo <tbody>;
 * o React continua dono delas (atualiza texto e atributos no lugar) e, quando
 * linhas entram ou saem, um MutationObserver reaplica busca e ordem.
 *
 * Uma linha pode pedir para aparecer (evento TABLE_REVEAL_EVENT, disparado
 * nela): a busca que a esconde é limpa e a tabela vai à página dela.
 *
 * Tabelas que não são lista (célula com rowSpan, mais de um <tbody>, linhas
 * de grupo com colSpan) ficam como estão. Com menos de MIN_ROWS linhas só a
 * ordenação aparece: busca e paginação em 3 linhas só ocupam espaço. Grade
 * de edição (tabela dentro de um <form> com campos nas linhas) não pagina.
 *
 * Cabeçalho congelado (`stickyHead`; dono, 16/11/2026, tabela de itens do
 * Book): o <thead> vai para uma tabela própria, presa logo abaixo da barra
 * vermelha enquanto a tabela passa e que sai junto com ela no fim. Na
 * rolagem para o lado as duas partes andam juntas (cada título fica sobre a
 * coluna dele). As duas usam o mesmo <colgroup> (obrigatório, com a largura
 * de cada coluna) e `table-layout: fixed`. Com mais de uma linha no
 * cabeçalho, a dos títulos (a que ordena) leva `data-table-sort-row`.
 */

const MIN_ROWS = 6;
const STORAGE_KEY = "wellmix.table.pageSize";

type Copy = typeof copy.pt;
type Labels = Record<keyof Copy, string>;

function labelsFor(lang: string): Labels {
  if (lang.startsWith("zh")) return copy.zh;
  if (lang.startsWith("en")) return copy.en;
  return copy.pt;
}

function readPageSize(): PageSize {
  if (memoryPageSize) return memoryPageSize;
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));
    return (PAGE_SIZES as readonly number[]).includes(saved)
      ? (saved as PageSize)
      : PAGE_SIZES[0];
  } catch {
    return PAGE_SIZES[0];
  }
}

const noSubscribe = () => () => {};

/* Tamanho da página compartilhado pelas tabelas da tela e guardado no
   aparelho; sem armazenamento (aba anônima) vale só enquanto a tela está aberta. */
let memoryPageSize: PageSize | null = null;
const pageSizeListeners = new Set<() => void>();

function subscribePageSize(listener: () => void) {
  pageSizeListeners.add(listener);
  return () => {
    pageSizeListeners.delete(listener);
  };
}

function savePageSize(size: PageSize) {
  memoryPageSize = size;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // Sem armazenamento: fica só na memória.
  }
  pageSizeListeners.forEach((listener) => listener());
}

/** Texto da célula para busca e ordem: `data-sort` vence; campos entram pelo valor. */
function cellText(cell: HTMLTableCellElement) {
  const explicit = cell.dataset.sort;
  if (explicit !== undefined) return explicit;
  let text = cell.textContent ?? "";
  for (const field of cell.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input, select, textarea")) {
    if (field instanceof HTMLInputElement) {
      if (
        ["hidden", "checkbox", "radio", "file", "submit", "button"].includes(
          field.type,
        )
      )
        continue;
      text += ` ${field.value}`;
    } else if (field instanceof HTMLSelectElement) {
      text += ` ${field.selectedOptions[0]?.textContent ?? ""}`;
    } else {
      text += ` ${field.value}`;
    }
  }
  return text;
}

function rowText(row: HTMLTableRowElement) {
  return Array.from(row.cells, cellText).join(" ");
}

type Shape = {
  body: HTMLTableSectionElement;
  rows: HTMLTableRowElement[];
  /** Cabeçalhos clicáveis, pela posição da coluna. */
  headers: Map<number, HTMLTableCellElement>;
  /** Linha única de "nada encontrado" (célula com colSpan): fica de fora. */
  emptyRow: boolean;
};

/**
 * Linha dos títulos (a que ordena): a marcada com `data-table-sort-row`
 * (cabeçalho de mais de uma linha) ou a única.
 */
function titleRow(head: HTMLCollectionOf<HTMLTableRowElement> | undefined) {
  if (!head?.length) return null;
  const marked = Array.from(head).find(
    (row) => row.dataset.tableSortRow !== undefined,
  );
  return marked ?? (head.length === 1 ? head[0] : null);
}

/**
 * Lê a forma da tabela; null quando ela não é uma lista simples de linhas.
 * `headTable`: o cabeçalho congelado, numa tabela à parte.
 */
function readShape(
  table: HTMLTableElement,
  sortable: boolean,
  headTable: HTMLTableElement | null = null,
): Shape | null {
  if (table.tBodies.length !== 1) return null;
  const body = table.tBodies[0];
  const rows = Array.from(body.rows);
  if (
    rows.length === 1 &&
    rows[0].cells.length === 1 &&
    rows[0].cells[0].colSpan > 1
  )
    return { body, rows: [], headers: new Map(), emptyRow: true };
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.rowSpan > 1 || cell.colSpan > 1) return null;
    }
  }
  const headers = new Map<number, HTMLTableCellElement>();
  const headRow = titleRow((headTable ?? table).tHead?.rows);
  const width = rows[0]?.cells.length ?? 0;
  if (
    sortable &&
    headRow &&
    rows.length > 1 &&
    headRow.cells.length === width &&
    rows.every((row) => row.cells.length === width)
  ) {
    Array.from(headRow.cells).forEach((cell, index) => {
      if (cell.colSpan > 1) return;
      if (!(cell.textContent ?? "").trim()) return;
      // Cabeçalho com botão, link ou campo (ex.: marcar todas) tem ação própria.
      if (cell.querySelector("a, button, input, select, label")) return;
      if (cell.dataset.sortable === "false") return;
      headers.set(index, cell);
    });
  }
  return { body, rows, headers, emptyRow: false };
}

type Sort = { column: number; desc: boolean } | null;

export function TableTools({
  children,
  className,
  tableClassName,
  sortable = true,
  searchable = true,
  paginated = true,
  stickyHead = false,
  stickyBar,
  ...tableAttrs
}: {
  children: ReactNode;
  /** Classes da moldura com rolagem (a mesma do <Table> antigo). */
  className?: string;
  tableClassName?: string;
  /** Desliga a ordenação (tabelas que já ordenam por conta própria). */
  sortable?: boolean;
  /** Desliga a busca (tabelas que já têm filtro próprio). */
  searchable?: boolean;
  paginated?: boolean;
  /**
   * Cabeçalho congelado abaixo da barra vermelha (veja o comentário do
   * arquivo). Os filhos são o <colgroup>, o <thead> e o <tbody>, direto.
   */
  stickyHead?: boolean;
  /** Faixa no alto do cabeçalho congelado (ex.: o aviso do "Carregar"). */
  stickyBar?: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const tableRef = useRef<HTMLTableElement>(null);
  /** Cabeçalho congelado: a tabela dele, a moldura de cada parte e o quadro. */
  const headTableRef = useRef<HTMLTableElement>(null);
  const headScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const original = useRef(new WeakMap<HTMLTableRowElement, number>());
  const counter = useRef(0);
  const lang = useSyncExternalStore(
    noSubscribe,
    () => document.documentElement.lang || "pt",
    () => "pt",
  );
  const labels = labelsFor(lang);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const pageSize = useSyncExternalStore(
    subscribePageSize,
    readPageSize,
    () => PAGE_SIZES[0],
  );
  const [page, setPage] = useState(0);
  /** Linhas da tabela e quantas passam na busca (para a barra e o rodapé). */
  const [stats, setStats] = useState<{
    rows: number;
    matched: number;
    paged: boolean;
  } | null>(null);
  const [version, setVersion] = useState(0);
  /** Linhas que passam na busca, na ordem da tela (para achar a página de uma linha). */
  const matchedRef = useRef<HTMLTableRowElement[]>([]);
  /** Linha que pediu para aparecer (TABLE_REVEAL_EVENT), até a tabela ir à página dela. */
  const revealRef = useRef<HTMLTableRowElement | null>(null);

  const apply = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const shape = readShape(table, sortable, headTableRef.current);
    if (!shape) {
      setStats(null);
      return;
    }
    const { body, rows, headers } = shape;
    const decimalComma = !/^(en|zh)/.test(document.documentElement.lang);

    for (const row of rows) {
      if (!original.current.has(row))
        original.current.set(row, counter.current++);
    }

    // Cabeçalhos: cursor, teclado e indicação da ordem atual.
    headers.forEach((cell, index) => {
      cell.dataset.tableSort =
        sort?.column === index ? (sort.desc ? "desc" : "asc") : "none";
      cell.setAttribute(
        "aria-sort",
        sort?.column === index
          ? sort.desc
            ? "descending"
            : "ascending"
          : "none",
      );
      if (!cell.hasAttribute("tabindex")) cell.tabIndex = 0;
      if (!cell.title) cell.title = labels["tableTools.sortHint"];
    });

    const ordered = [...rows];
    if (sort && headers.has(sort.column)) {
      const keys = new Map(
        rows.map((row) => [
          row,
          sortKey(cellText(row.cells[sort.column]), decimalComma),
        ]),
      );
      ordered.sort(
        (a, b) =>
          compareKeys(keys.get(a)!, keys.get(b)!, sort.desc) ||
          original.current.get(a)! - original.current.get(b)!,
      );
    } else {
      ordered.sort(
        (a, b) => original.current.get(a)! - original.current.get(b)!,
      );
    }
    if (ordered.some((row, i) => row !== rows[i])) {
      for (const row of ordered) body.appendChild(row);
    }

    const useTools = rows.length >= MIN_ROWS;
    // Grade de edição (a tabela inteira é um formulário com um "Salvar"):
    // busca e ordem sim, página não, para nenhum campo ficar fora da vista.
    const editGrid =
      !!table.closest("form") &&
      rows.some((row) => row.querySelector("input, select, textarea"));
    const paged = useTools && paginated && !editGrid;
    const matched = ordered.filter(
      (row) => !useTools || !searchable || matchesQuery(rowText(row), query),
    );
    matchedRef.current = matched;
    let { current } = pageRange(page, pageSize, matched.length);
    // Linha que pediu para aparecer: a página dela.
    const wanted = revealRef.current;
    if (wanted && matched.includes(wanted)) {
      revealRef.current = null;
      if (paged) current = pageOfIndex(matched.indexOf(wanted), pageSize);
    }
    const start = current * pageSize;
    const visible = new Set(
      paged ? matched.slice(start, start + pageSize) : matched,
    );
    // Fora da busca (não só fora da página): quem marca "todas" as linhas
    // (preenchimento em massa do Book) pula estas.
    const kept = new Set(matched);
    for (const row of ordered) {
      const hide = !visible.has(row);
      if (row.hidden !== hide) row.hidden = hide;
      const out = !kept.has(row);
      if (row.hasAttribute("data-table-filtered") !== out)
        row.toggleAttribute("data-table-filtered", out);
    }
    if (current !== page) setPage(current);
    setStats((prev) =>
      prev?.rows === rows.length &&
      prev.matched === matched.length &&
      prev.paged === paged
        ? prev
        : { rows: rows.length, matched: matched.length, paged },
    );
  }, [sortable, searchable, paginated, sort, query, page, pageSize, labels]);

  // Uma linha pede para aparecer: limpa a busca que a esconde e reaplica.
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const onReveal = (event: Event) => {
      const row = (event.target as Element | null)?.closest?.("tr");
      if (!row || row.closest("table") !== table) return;
      revealRef.current = row;
      if (!matchedRef.current.includes(row)) setQuery("");
      setVersion((v) => v + 1);
    };
    table.addEventListener(TABLE_REVEAL_EVENT, onReveal);
    return () => table.removeEventListener(TABLE_REVEAL_EVENT, onReveal);
  }, []);

  // Reaplica quando o React troca as linhas (nova consulta, item excluído).
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let busy = false;
    const observer = new MutationObserver((records) => {
      if (busy) return;
      const changed = records.some((r) =>
        Array.from(r.addedNodes)
          .concat(Array.from(r.removedNodes))
          .some((node) => node.nodeName === "TR" || node.nodeName === "TBODY"),
      );
      if (changed) setVersion((v) => v + 1);
    });
    observer.observe(table, { childList: true, subtree: true });
    busy = true;
    apply();
    // Os movimentos feitos por apply() chegam como registros: descarta.
    observer.takeRecords();
    busy = false;
    return () => observer.disconnect();
  }, [apply, version]);

  // Clique e teclado nos cabeçalhos ordenáveis (no congelado, a tabela dele).
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const head = headTableRef.current;
    const pick = (target: EventTarget | null) => {
      const cell = (target as HTMLElement | null)?.closest?.(
        "th[data-table-sort]",
      ) as HTMLTableCellElement | null;
      const owner = cell?.closest("table");
      if (!cell || (owner !== table && owner !== head)) return null;
      return cell.cellIndex;
    };
    const toggle = (column: number) => {
      setSort((prev) =>
        prev?.column !== column
          ? { column, desc: false }
          : prev.desc
            ? null
            : { column, desc: true },
      );
      setPage(0);
    };
    const onClick = (event: MouseEvent) => {
      const column = pick(event.target);
      if (column !== null) toggle(column);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const column = pick(event.target);
      if (column === null) return;
      event.preventDefault();
      toggle(column);
    };
    const targets = head ? [table, head] : [table];
    for (const el of targets) {
      el.addEventListener("click", onClick);
      el.addEventListener("keydown", onKey);
    }
    return () => {
      for (const el of targets) {
        el.removeEventListener("click", onClick);
        el.removeEventListener("keydown", onKey);
      }
    };
  }, []);

  // Cabeçalho congelado: as duas partes rolam juntas para o lado (arrastar
  // a tabela ou o cabeçalho, o foco num campo fora da vista) e a altura dele
  // fica em --wm-table-head (os campos da tabela não param embaixo dele).
  useEffect(() => {
    const sticky = headScrollRef.current;
    const head = sticky?.querySelector<HTMLElement>(
      "[data-table-sticky-scroll]",
    );
    const body = bodyScrollRef.current;
    const frame = frameRef.current;
    if (!sticky || !head || !body || !frame) return;
    const follow = (from: HTMLElement, to: HTMLElement) => () => {
      if (Math.abs(to.scrollLeft - from.scrollLeft) > 0.5)
        to.scrollLeft = from.scrollLeft;
    };
    const fromBody = follow(body, head);
    const fromHead = follow(head, body);
    body.addEventListener("scroll", fromBody, { passive: true });
    head.addEventListener("scroll", fromHead, { passive: true });
    const size = () =>
      frame.style.setProperty("--wm-table-head", `${sticky.offsetHeight}px`);
    size();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(size);
    observer?.observe(sticky);
    return () => {
      body.removeEventListener("scroll", fromBody);
      head.removeEventListener("scroll", fromHead);
      observer?.disconnect();
    };
  }, []);

  const showTools = !!stats && stats.rows >= MIN_ROWS;
  const parts = stickyHead ? splitTable(children) : null;
  const range = stats ? pageRange(page, pageSize, stats.matched) : null;

  return (
    <div data-table-tools>
      {showTools && searchable ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={labels["tableTools.search"]}
            aria-label={labels["tableTools.search"]}
            className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 sm:w-64"
            data-table-search
          />
        </div>
      ) : null}
      {stickyHead ? (
        <div ref={frameRef} className="relative" data-table-frame>
          <div
            ref={headScrollRef}
            className="sticky top-(--wm-header) z-20 -mx-4 overflow-hidden border-t border-zinc-200/80 bg-white sm:mx-0 sm:rounded-t-xl sm:border-x"
            data-table-sticky-head
          >
            {stickyBar}
            <div
              className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-table-sticky-scroll
            >
              <table
                ref={headTableRef}
                className={twMerge(
                  "w-full min-w-[32rem] table-fixed text-left text-sm",
                  tableClassName,
                )}
              >
                {parts?.colgroup}
                {parts?.head}
              </table>
            </div>
          </div>
          <div
            ref={bodyScrollRef}
            className={twMerge(
              "relative -mx-4 overflow-x-auto border-b border-zinc-200/80 bg-white sm:mx-0 sm:rounded-b-xl sm:border-x",
              className,
            )}
            data-table-sticky-body
          >
            <table
              ref={tableRef}
              {...tableAttrs}
              className={twMerge(
                "w-full min-w-[32rem] table-fixed text-left text-sm",
                tableClassName,
              )}
            >
              {parts?.colgroup}
              {parts?.rest}
            </table>
          </div>
        </div>
      ) : (
        <div
          className={twMerge(
            "relative -mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border",
            className,
          )}
        >
          <table
            ref={tableRef}
            {...tableAttrs}
            className={twMerge(
              "w-full min-w-[32rem] text-left text-sm",
              tableClassName,
            )}
          >
            {children}
          </table>
        </div>
      )}
      {showTools && stats.matched === 0 ? (
        <p className="mt-2 text-[13px] text-zinc-500" data-table-none>
          {labels["tableTools.none"]}
        </p>
      ) : null}
      {showTools && stats.paged && range && stats.matched > 0 ? (
        <div
          className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[13px] text-zinc-600"
          data-table-pager
        >
          <label className="flex items-center gap-2">
            {labels["tableTools.perPage"]}
            <select
              value={pageSize}
              onChange={(event) => {
                const size = Number(event.target.value) as PageSize;
                setPage(0);
                savePageSize(size);
              }}
              className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-[13px]"
              data-table-page-size
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span data-table-range>
            {labels["tableTools.range"]
              .replace("{from}", String(range.from))
              .replace("{to}", String(range.to))
              .replace("{total}", String(stats.matched))}
          </span>
          <span className="flex items-center gap-1">
            <PagerButton
              label={labels["tableTools.prev"]}
              disabled={range.current === 0}
              onClick={() => setPage(range.current - 1)}
              data-table-prev
            >
              ‹
            </PagerButton>
            <PagerButton
              label={labels["tableTools.next"]}
              disabled={range.current >= range.pages - 1}
              onClick={() => setPage(range.current + 1)}
              data-table-next
            >
              ›
            </PagerButton>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
  ...rest
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
} & { [key: `data-${string}`]: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-base leading-none text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}

/** Os filhos da tabela congelada: <colgroup>, <thead> e o resto (<tbody>). */
function splitTable(children: ReactNode) {
  let colgroup: ReactNode = null;
  let head: ReactNode = null;
  const rest: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === "colgroup") colgroup = child;
    else if (isValidElement(child) && child.type === "thead") head = child;
    else rest.push(child);
  });
  return { colgroup, head, rest };
}
