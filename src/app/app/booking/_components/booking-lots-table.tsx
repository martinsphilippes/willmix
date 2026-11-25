"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  searchBookingLots,
  sortBookingLots,
  type BookingLotRow,
  type BookingLotSortKey,
} from "@/lib/booking-lots";
import {
  bookClock,
  bookClockText,
  durationText,
  type BookClockLabels,
  type BookClockStage,
} from "@/lib/booking-locks";
import {
  Badge,
  cx,
  Empty,
  inputClass,
  linkClass,
  type Tone,
} from "@/components/ui";
import { TableTools } from "@/components/table-tools";
import { ClampText } from "@/components/clamp-text";
import {
  lockBookingLotAction,
  unlockBookingAction,
} from "../../actions/booking-lots";

/*
 * Tabela dos bookings já carregados: a busca filtra por qualquer campo
 * enquanto se digita, e cada cabeçalho ordena (clicar de novo inverte). Tudo
 * no navegador: a lista inteira vem do servidor.
 *
 * Linha fina (dono, 24/11/2026, com o print do Supplier em sete linhas): letra
 * menor e cada célula numa linha só; o texto longo (Supplier, Fábrica,
 * Origem, Planilha, Responsável) corta com "…" e o "ver mais" ao
 * lado abre o texto inteiro ("ver menos" fecha), com o texto também na dica.
 */

export interface BookingLotsTableLabels {
  search: string;
  searchPlaceholder: string;
  /** "{n} de {total} bookings". */
  count: string;
  noMatch: string;
  sortBy: string;
  factoryNone: string;
  signalsNone: string;
  /** "ver mais" e "ver menos" do texto longo numa linha. */
  more: string;
  less: string;
  signal: { viable: string; below: string; loss: string; missing: string };
  cols: Record<BookingLotSortKey, string>;
  /** Travar, liberar, "Livre", "pelo tipo" e os selos do prazo. */
  lock: string;
  unlock: string;
  free: string;
  byType: string;
  slaOk: string;
  slaLate: string;
  /**
   * O prazo explicado ("Faltam {t}", "até {d}"…), com os marcadores; e o
   * balão: "Com {name} há {time}." e o do feito.
   */
  clock: BookClockLabels & { heldBy: string; doneHint: string };
}

/** Cor de cada situação do prazo: o ponto e o texto principal. */
const CLOCK_TONE: Record<BookClockStage, { dot: string; text: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700" },
  soon: { dot: "bg-amber-500", text: "text-amber-700" },
  late: { dot: "bg-red-500", text: "text-red-700" },
  done: { dot: "", text: "text-zinc-600" },
};

/**
 * A hora de agora, andando a cada 30 s. Começa na hora em que o servidor leu
 * a lista: a primeira pintura sai igual no servidor e no navegador.
 */
function useNow(start: number, everyMs = 30_000): number {
  const [now, setNow] = useState(start);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * As três primeiras colunas fixas (Nº, Supplier, Status): largura fixa e o
 * deslocamento à esquerda de cada uma, somando as anteriores.
 */
const FROZEN: Partial<Record<BookingLotSortKey, string>> = {
  number: "sticky left-0 z-10 w-14 min-w-14 max-w-14",
  supplier: "sticky left-14 z-10 w-44 min-w-44 max-w-44",
  status:
    "sticky left-58 z-10 w-32 min-w-32 max-w-32 shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]",
};

const STATUS_TONE: Record<BookingLotRow["status"], Tone> = {
  // Em preenchimento pelo parceiro: a Wellmix não lista (só por completude).
  preparing: "neutral",
  draft: "warning",
  closed: "info",
  in_progress: "brand",
  done: "success",
  cancelled: "neutral",
};

/*
 * Dono, 25/11/2026: Supplier na 2ª coluna e Fábrica na 7ª (antes "Fornecedor"
 * trazia a fábrica e "Loja / Supplier" misturava o código da fábrica com o
 * Supplier); as três primeiras ficam fixas ao rolar para o lado, e o Prazo
 * em duas linhas, com todas as linhas na altura das duas.
 */
const COLUMNS: Array<{ key: BookingLotSortKey; numeric?: boolean }> = [
  { key: "number", numeric: true },
  { key: "supplier" },
  { key: "status" },
  // Com quem está e há quanto tempo, logo depois do status (à vista sem
  // rolar a tabela para o lado).
  { key: "holder" },
  { key: "heldMinutes", numeric: true },
  { key: "origin" },
  { key: "factory" },
  { key: "itemType" },
  { key: "date" },
  { key: "fileName" },
  { key: "itemCount", numeric: true },
  { key: "workedPct", numeric: true },
  { key: "pendingItems", numeric: true },
  { key: "viable" },
  { key: "owner" },
  { key: "createdAt" },
];

export function BookingLotsTable({
  rows,
  labels,
  showSignals = true,
  slaHours,
  renderedAt,
}: {
  rows: BookingLotRow[];
  labels: BookingLotsTableLabels;
  /** Prazo do book travado (horas, Configurações). */
  slaHours: number;
  /** A hora em que o servidor leu a lista (ms): o relógio do prazo parte dela. */
  renderedAt: number;
  /**
   * Sinais da previsão de preço: falso sem "Ver preço de compra" (dono, 15/11/2026;
   * docs/LINHA_DE_VISAO.md, seção 7).
   */
  showSignals?: boolean;
}) {
  const columns = showSignals
    ? COLUMNS
    : COLUMNS.filter((c) => c.key !== "viable");
  const now = useNow(renderedAt);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{
    key: BookingLotSortKey;
    dir: "asc" | "desc";
  }>({ key: "number", dir: "desc" });
  const shown = useMemo(
    () => sortBookingLots(searchBookingLots(rows, query), sort.key, sort.dir),
    [rows, query, sort],
  );
  const toggle = (key: BookingLotSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir: columns.find((c) => c.key === key)?.numeric ? "desc" : "asc",
          },
    );

  const muted = <span className="text-zinc-400">—</span>;
  /** Texto longo numa linha só, com "ver mais" quando não cabe. */
  const clamp = (text: string, width: string) =>
    text ? (
      <ClampText
        text={text}
        lines={1}
        more={labels.more}
        less={labels.less}
        className={width}
      />
    ) : (
      muted
    );
  const cell = (row: BookingLotRow, key: BookingLotSortKey) => {
    switch (key) {
      case "number":
        return (
          <Link href={`/app/booking/lots/${row.id}`} className={linkClass}>
            {row.number}
          </Link>
        );
      case "status":
        // Numa linha só ("Em andamento" quebrava em duas).
        return (
          <Badge tone={STATUS_TONE[row.status]} className="whitespace-nowrap">
            {row.statusLabel}
          </Badge>
        );
      case "supplier":
        return clamp(row.supplier, "max-w-[10rem]");
      case "factory":
        // O cadastro da fábrica; sem ele, o nº da loja (o código da fábrica).
        return row.factory || row.factoryStore ? (
          clamp(row.factory || row.factoryStore, "max-w-[11rem]")
        ) : (
          <span className="whitespace-nowrap text-zinc-500">
            {labels.factoryNone}
          </span>
        );
      case "origin":
        return clamp(row.origin, "max-w-[8rem]");
      case "itemType":
        return clamp(row.itemType, "max-w-[8rem]");
      case "owner":
        return clamp(row.owner, "max-w-[9rem]");
      case "date":
        return row.dateText ? (
          <span className="whitespace-nowrap">{row.dateText}</span>
        ) : (
          muted
        );
      case "createdAt":
        return row.createdText ? (
          <span className="whitespace-nowrap">{row.createdText}</span>
        ) : (
          muted
        );
      case "fileName":
        return clamp(row.fileName, "max-w-[11rem]");
      case "workedPct":
        // Itens trabalhados na Seleção de itens: percentual e "3 de 10".
        return (
          <span
            className="inline-flex items-baseline gap-1 whitespace-nowrap"
            data-booking-lot-worked={row.workedPct}
          >
            <span className="font-semibold">{row.workedPct}%</span>
            <span className="text-[11px] text-zinc-500">{row.workedText}</span>
          </span>
        );
      case "holder":
        // Com quem está: livre (com "Travar") ou a pessoa (com "Liberar"
        // para ela mesma e para quem supervisiona), lado a lado, para a
        // linha ficar fina (dono, 24/11/2026).
        return (
          <span
            className="flex items-baseline gap-2 whitespace-nowrap"
            data-booking-lot-holder={row.lockId ?? "free"}
          >
            {row.lockId ? (
              <span>
                {row.holder}
                {row.lockByType ? (
                  <span className="text-[11px] text-zinc-500">
                    {" "}
                    ({labels.byType})
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-zinc-500">{labels.free}</span>
            )}
            {row.lockId ? (
              // A trava pelo tipo é liberada na faixa de cima (vale para
              // todos os books do tipo).
              row.lockCanRelease && !row.lockByType ? (
                <form action={unlockBookingAction}>
                  <input type="hidden" name="lockId" value={row.lockId} />
                  <button
                    type="submit"
                    className={cx(linkClass, "text-xs")}
                    data-booking-unlock-row
                  >
                    {labels.unlock}
                  </button>
                </form>
              ) : null
            ) : // Só depois do rascunho (dono, 24/11/2026).
            ["closed", "in_progress", "done"].includes(row.status) ? (
              <form action={lockBookingLotAction}>
                <input type="hidden" name="lotId" value={row.id} />
                <button
                  type="submit"
                  className={cx(linkClass, "text-xs")}
                  data-booking-lock-row
                >
                  {labels.lock}
                </button>
              </form>
            ) : null}
          </span>
        );
      case "heldMinutes": {
        // O prazo explicado numa linha (dono, 24/11/2026): quanto falta e até
        // quando, quanto está atrasado e desde quando venceu, ou há quanto
        // tempo está feito e quando. No balão, o prazo e há quanto tempo está
        // com a pessoa.
        const clock = bookClock(
          { since: row.heldSince, workDoneAt: row.workDoneAt },
          slaHours,
          now,
        );
        if (!clock) return muted;
        const text = bookClockText(clock, labels.clock);
        const tone = CLOCK_TONE[clock.stage];
        const title =
          clock.stage === "done"
            ? labels.clock.doneHint
            : `${clock.stage === "late" ? labels.slaLate : labels.slaOk} · ${labels.clock.heldBy
                .replace("{name}", row.holder || "—")
                .replace("{time}", durationText(clock.elapsed))}`;
        return (
          // Duas linhas (dono, 25/11/2026): "Atrasado 17 h 21 min" em cima e
          // "venceu 24/11 21:37" embaixo.
          <span
            className="inline-flex flex-col items-end whitespace-nowrap"
            title={title}
            data-booking-sla={clock.stage}
          >
            <span className="inline-flex items-center gap-1.5">
              {clock.stage === "done" ? (
                <span aria-hidden className="text-[11px] text-emerald-600">
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cx("size-1.5 shrink-0 rounded-full", tone.dot)}
                />
              )}
              <span className={cx("font-medium", tone.text)}>{text.main}</span>
            </span>
            <span
              className="text-[11px] tabular-nums text-zinc-500"
              data-booking-sla-at
            >
              {text.at}
            </span>
          </span>
        );
      }
      case "pendingItems":
        return row.pendingItems ? (
          <Badge tone="warning">{row.pendingItems}</Badge>
        ) : (
          muted
        );
      case "viable": {
        const parts = (
          [
            ["viable", "success"],
            ["below", "warning"],
            ["loss", "danger"],
            ["missing", "neutral"],
          ] as const
        ).filter(([k]) => row[k] > 0);
        if (!parts.length)
          return (
            <span className="whitespace-nowrap text-zinc-500">
              {labels.signalsNone}
            </span>
          );
        // Os selos lado a lado, cada um numa linha ("1 Falta dado" quebrava
        // em duas e esticava a linha; dono, 24/11/2026).
        return (
          <span className="flex gap-1 whitespace-nowrap">
            {parts.map(([k, tone]) => (
              <span key={k} title={labels.signal[k]}>
                <Badge tone={tone} className="whitespace-nowrap">
                  {row[k]} {labels.signal[k]}
                </Badge>
              </span>
            ))}
          </span>
        );
      }
      default: {
        // Os números (os textos têm o seu caso, numa linha só).
        const v: unknown = row[key];
        return v === "" || v === null || v === undefined ? muted : String(v);
      }
    }
  };

  return (
    <div className="space-y-2" data-booking-lots>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex w-full max-w-md flex-col gap-1 text-xs font-medium text-zinc-700">
          {labels.search}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className={inputClass}
            data-booking-lots-search
          />
        </label>
        <span className="text-xs text-zinc-500" data-booking-lots-count>
          {labels.count
            .replace("{n}", String(shown.length))
            .replace("{total}", String(rows.length))}
        </span>
      </div>
      {shown.length ? (
        <TableTools
          tableClassName="min-w-[76rem]"
          sortable={false}
          searchable={false}
        >
          <thead>
            <tr>
              {columns.map(({ key, numeric }) => {
                const active = sort.key === key;
                return (
                  <th
                    key={key}
                    aria-sort={
                      active
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cx(
                      "border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500",
                      numeric && "text-right",
                      FROZEN[key],
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      title={labels.sortBy.replace("{col}", labels.cols[key])}
                      className={cx(
                        "inline-flex items-center gap-1 uppercase hover:text-brand-700",
                        active && "text-brand-700",
                      )}
                      data-booking-lots-sort={key}
                    >
                      {labels.cols[key]}
                      <span aria-hidden className="text-[10px]">
                        {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr
                key={row.id}
                className="group transition hover:bg-brand-50/40"
                data-booking-lot-row={row.id}
              >
                {columns.map(({ key, numeric }) => (
                  <td
                    key={key}
                    className={cx(
                      // h-11: toda linha na altura das duas linhas do Prazo.
                      "h-11 border-b border-zinc-100 px-2 py-1.5 align-top text-xs leading-snug text-zinc-800",
                      numeric && "text-right tabular-nums",
                      FROZEN[key] &&
                        cx(FROZEN[key], "bg-white group-hover:bg-brand-50"),
                    )}
                    data-booking-frozen={FROZEN[key] ? key : undefined}
                  >
                    {cell(row, key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableTools>
      ) : (
        <Empty>{labels.noMatch}</Empty>
      )}
    </div>
  );
}
