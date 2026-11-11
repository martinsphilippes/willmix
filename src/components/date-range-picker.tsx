"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx, inputClass } from "@/components/ui";

/*
 * Intervalo de datas num campo só: abre um calendário (dois meses na tela
 * larga, um no celular), o primeiro clique marca o início e o segundo o fim,
 * com o intervalo destacado; atalhos (últimos 7 e 30 dias, este mês, mês
 * passado). "Aplicar" grava nos campos escondidos (AAAA-MM-DD) e envia o
 * formulário; "Limpar" tira o filtro. Esc ou clicar fora fecha sem mudar.
 */

export interface DateRangeLabels {
  placeholder: string;
  apply: string;
  clear: string;
  last7: string;
  last30: string;
  thisMonth: string;
  lastMonth: string;
  previous: string;
  next: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

export function DateRangePicker({
  nameFrom = "from",
  nameTo = "to",
  from,
  to,
  locale,
  labels,
}: {
  nameFrom?: string;
  nameTo?: string;
  /** AAAA-MM-DD ou null. */
  from: string | null;
  to: string | null;
  /** Para os nomes dos meses e dias (ex.: "pt-BR"). */
  locale: string;
  labels: DateRangeLabels;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(from);
  const [end, setEnd] = useState<string | null>(to);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const d = parse(from) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const box = useRef<HTMLDivElement>(null);
  const fromInput = useRef<HTMLInputElement>(null);
  const toInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) cancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cancel lê o estado gravado
  }, [open]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    // 7/1/2024 foi domingo.
    return Array.from({ length: 7 }, (_, i) =>
      f.format(new Date(2024, 0, 7 + i)),
    );
  }, [locale]);

  function cancel() {
    setOpen(false);
    setStart(from);
    setEnd(to);
    setHover(null);
  }

  function submit(nextFrom: string | null, nextTo: string | null) {
    if (fromInput.current) fromInput.current.value = nextFrom ?? "";
    if (toInput.current) toInput.current.value = nextTo ?? "";
    setOpen(false);
    fromInput.current?.form?.requestSubmit();
  }

  function pick(day: string) {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  }

  function preset(kind: "last7" | "last30" | "thisMonth" | "lastMonth") {
    const today = new Date();
    let a: Date;
    let b: Date = today;
    if (kind === "last7") a = new Date(today.getTime() - 6 * 86_400_000);
    else if (kind === "last30") a = new Date(today.getTime() - 29 * 86_400_000);
    else if (kind === "thisMonth")
      a = new Date(today.getFullYear(), today.getMonth(), 1);
    else {
      a = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      b = new Date(today.getFullYear(), today.getMonth(), 0);
    }
    setStart(iso(a));
    setEnd(iso(b));
    setMonth(new Date(a.getFullYear(), a.getMonth(), 1));
  }

  const shownEnd = end ?? (start && hover && hover >= start ? hover : null);
  const label =
    from || to
      ? `${from ? fmt.format(parse(from)!) : "…"} – ${to ? fmt.format(parse(to)!) : "…"}`
      : labels.placeholder;

  function renderMonth(base: Date) {
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const cells: Array<string | null> = [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: days }, (_, i) =>
        iso(new Date(base.getFullYear(), base.getMonth(), i + 1)),
      ),
    ];
    const today = iso(new Date());
    return (
      <div className="w-64">
        <p className="mb-2 text-center text-sm font-semibold text-zinc-800 first-letter:uppercase">
          {monthFmt.format(first)}
        </p>
        <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase text-zinc-400">
          {weekdays.map((w, i) => (
            <span key={i} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
          {cells.map((day, i) => {
            if (!day) return <span key={`e${i}`} />;
            const edge = day === start || day === shownEnd;
            const inside = start && shownEnd && day > start && day < shownEnd;
            return (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                onMouseEnter={() => setHover(day)}
                className={cx(
                  "h-8 transition",
                  inside && "bg-brand-50 text-brand-800",
                  edge
                    ? "rounded-md bg-brand-600 font-semibold text-white"
                    : "rounded-md hover:bg-zinc-100",
                  !edge && day === today && "font-semibold text-brand-700",
                )}
                aria-pressed={edge || !!inside}
                data-range-day={day}
              >
                {Number(day.slice(8))}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={box} className="relative" data-date-range>
      <input
        ref={fromInput}
        type="hidden"
        name={nameFrom}
        defaultValue={from ?? ""}
      />
      <input
        ref={toInput}
        type="hidden"
        name={nameTo}
        defaultValue={to ?? ""}
      />
      <button
        type="button"
        onClick={() => (open ? cancel() : setOpen(true))}
        className={cx(
          inputClass,
          "flex min-w-56 items-center gap-2 text-left",
          !(from || to) && "text-zinc-400",
        )}
        aria-expanded={open}
        data-date-range-toggle
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M3 8h14M7 3v3M13 3v3" />
        </svg>
        <span className="truncate">{label}</span>
      </button>
      {open ? (
        <div
          className="absolute left-0 z-30 mt-2 max-w-[calc(100vw-2rem)] rounded-xl sm:left-auto sm:right-0 border border-zinc-200 bg-white p-4 shadow-xl"
          data-date-range-panel
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-row flex-wrap gap-1 sm:w-32 sm:flex-col">
              {(["last7", "last30", "thisMonth", "lastMonth"] as const).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => preset(k)}
                    className="rounded-md px-2 py-1 text-left text-xs font-medium text-zinc-600 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {labels[k]}
                  </button>
                ),
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, -1))}
                  className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                  aria-label={labels.previous}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, 1))}
                  className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                  aria-label={labels.next}
                >
                  ›
                </button>
              </div>
              <div className="flex gap-6" onMouseLeave={() => setHover(null)}>
                {renderMonth(month)}
                <div className="hidden sm:block">
                  {renderMonth(addMonths(month, 1))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
            <span className="mr-auto text-xs text-zinc-500">
              {start ? fmt.format(parse(start)!) : "…"} –{" "}
              {end ? fmt.format(parse(end)!) : "…"}
            </span>
            <button
              type="button"
              onClick={() => submit(null, null)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              data-date-range-clear
            >
              {labels.clear}
            </button>
            <button
              type="button"
              onClick={() => submit(start, end ?? start)}
              disabled={!start}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              data-date-range-apply
            >
              {labels.apply}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
