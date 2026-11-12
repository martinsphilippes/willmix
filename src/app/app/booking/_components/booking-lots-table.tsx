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

/*
 * Tabela dos bookings já carregados: a busca filtra por qualquer campo
 * enquanto se digita, e cada cabeçalho ordena (clicar de novo inverte). Tudo
 * no navegador: a lista inteira vem do servidor.
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
  signal: { viable: string; below: string; loss: string; missing: string };
  cols: Record<BookingLotSortKey, string>;
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
  { key: "origin" },
  { key: "supplier" },
  { key: "date" },
  { key: "fileName" },
  { key: "itemCount", numeric: true },
  { key: "pendingItems", numeric: true },
  { key: "viable" },
  { key: "owner" },
  { key: "createdAt" },
];

export function BookingLotsTable({
  rows,
  labels,
}: {
  rows: BookingLotRow[];
  labels: BookingLotsTableLabels;
}) {
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
            dir: COLUMNS.find((c) => c.key === key)?.numeric ? "desc" : "asc",
          },
    );

  const muted = <span className="text-zinc-400">—</span>;
  const cell = (row: BookingLotRow, key: BookingLotSortKey) => {
    switch (key) {
      case "number":
        return (
          <Link href={`/app/booking/lots/${row.id}`} className={linkClass}>
            {row.number}
          </Link>
        );
      case "status":
        return <Badge tone={STATUS_TONE[row.status]}>{row.statusLabel}</Badge>;
      case "supplier":
        return row.supplier ? (
          <span className="block max-w-48 truncate" title={row.supplier}>
            {row.supplier}
          </span>
        ) : (
          <span className="text-zinc-500">{labels.supplierNone}</span>
        );
      case "date":
        return row.dateText || muted;
      case "createdAt":
        return row.createdText || muted;
      case "fileName":
        return (
          <span className="block max-w-48 truncate" title={row.fileName}>
            {row.fileName}
          </span>
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
        const v = row[key];
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
        <div className="relative -mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr>
                {COLUMNS.map(({ key, numeric }) => {
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
                        "border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500",
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
                  {COLUMNS.map(({ key, numeric }) => (
                    <td
                      key={key}
                      className={cx(
                        "border-b border-zinc-100 px-2.5 py-2 align-top text-[13px] text-zinc-800",
                        numeric && "text-right tabular-nums",
                      )}
                    >
                      {cell(row, key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{labels.noMatch}</Empty>
      )}
    </div>
  );
}
