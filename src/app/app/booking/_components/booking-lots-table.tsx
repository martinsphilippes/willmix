"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  searchBookingLots,
  sortBookingLots,
  type BookingLotRow,
  type BookingLotSortKey,
} from "@/lib/booking-lots";
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
 * menor e cada célula numa linha só; o texto longo (Loja / Supplier,
 * Fornecedor, Origem, Planilha, Responsável) corta com "…" e o "ver mais" ao
 * lado abre o texto inteiro ("ver menos" fecha), com o texto também na dica.
 */

export interface BookingLotsTableLabels {
  search: string;
  searchPlaceholder: string;
  /** "{n} de {total} bookings". */
  count: string;
  noMatch: string;
  sortBy: string;
  supplierNone: string;
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
}

const STATUS_TONE: Record<BookingLotRow["status"], Tone> = {
  // Em preenchimento pelo parceiro: a Wellmix não lista (só por completude).
  preparing: "neutral",
  draft: "warning",
  closed: "info",
  in_progress: "brand",
  done: "success",
  cancelled: "neutral",
};

const COLUMNS: Array<{ key: BookingLotSortKey; numeric?: boolean }> = [
  { key: "number", numeric: true },
  { key: "status" },
  // Com quem está e há quanto tempo, logo depois do status (à vista sem
  // rolar a tabela para o lado).
  { key: "holder" },
  { key: "heldMinutes", numeric: true },
  { key: "origin" },
  { key: "supplier" },
  { key: "sourceKind" },
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
}: {
  rows: BookingLotRow[];
  labels: BookingLotsTableLabels;
  /**
   * Sinais da previsão de preço: falso sem "Ver preço de compra" (dono, 15/11/2026;
   * docs/LINHA_DE_VISAO.md, seção 7).
   */
  showSignals?: boolean;
}) {
  const columns = showSignals
    ? COLUMNS
    : COLUMNS.filter((c) => c.key !== "viable");
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
        return row.supplier ? (
          clamp(row.supplier, "max-w-[11rem]")
        ) : (
          <span className="whitespace-nowrap text-zinc-500">
            {labels.supplierNone}
          </span>
        );
      case "sourceKind":
        return clamp(row.sourceKind, "max-w-[11rem]");
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
      case "heldMinutes":
        return row.lockId ? (
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span>{row.heldText}</span>
            {/* Só a data e a hora do fim do prazo, pequenas: verde no prazo,
                vermelha atrasada (dono, 24/11/2026; antes o selo "No prazo
                (3 h)", que quebrava em três linhas). O texto do prazo fica
                no balão e para o leitor de tela. */}
            <span
              className={cx(
                "whitespace-nowrap text-[11px] leading-4 tabular-nums",
                row.heldLate ? "text-red-700" : "text-emerald-700",
              )}
              title={row.heldLate ? labels.slaLate : labels.slaOk}
              aria-label={`${row.heldLate ? labels.slaLate : labels.slaOk}: ${row.heldDueText}`}
              data-booking-sla={row.heldLate ? "late" : "ok"}
            >
              {row.heldDueText}
            </span>
          </span>
        ) : (
          muted
        );
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
          return <span className="text-zinc-500">{labels.signalsNone}</span>;
        return (
          <span className="flex flex-wrap gap-1">
            {parts.map(([k, tone]) => (
              <span key={k} title={labels.signal[k]}>
                <Badge tone={tone}>
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
                      "border-b border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500",
                      numeric && "text-right",
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
                className="transition hover:bg-brand-50/40"
                data-booking-lot-row={row.id}
              >
                {columns.map(({ key, numeric }) => (
                  <td
                    key={key}
                    className={cx(
                      "border-b border-zinc-100 px-2 py-1.5 align-top text-xs leading-snug text-zinc-800",
                      numeric && "text-right tabular-nums",
                    )}
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
