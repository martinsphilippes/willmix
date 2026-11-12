import type { SupplierRequest, SupplierRequestEvent } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { requestTimeline, type TimelineEntry } from "@/lib/supplier-requests";
import { Card, cx } from "@/components/ui";
import { dateTime } from "./negotiation";

/*
 * Linha do tempo da solicitação (docs/SUPPLIER_REQUESTS.md, "Linha do
 * tempo"): cada interação com data e hora, quem fez e o que ficou resolvido
 * nela (abertura, respostas, contrapropostas, mensagens, decisão, produto).
 */

const DOT: Record<string, string> = {
  opened: "bg-zinc-500",
  answer: "bg-sky-500",
  proposal: "bg-violet-500",
  accept: "bg-emerald-500",
  counter: "bg-amber-500",
  reject: "bg-red-500",
  message: "bg-zinc-300",
  decided: "bg-brand-600",
  product: "bg-emerald-600",
  showcase: "bg-emerald-600",
  erp: "bg-emerald-600",
  sampling: "bg-amber-500",
};

const DECIDED_DOT: Record<string, string> = {
  approved: "bg-emerald-600",
  declined: "bg-red-600",
  cancelled: "bg-zinc-500",
};

export function RequestTimeline({
  request: r,
  legacyAnswers = [],
  t,
}: {
  request: SupplierRequest;
  /** Respostas antigas (auditoria): hora e se faz. */
  legacyAnswers?: Array<{ at: string; canDo: "yes" | "no" | null }>;
  t: Translate;
}) {
  const entries = requestTimeline(r, legacyAnswers);
  const k = (key: string, vars?: Record<string, string | number>) =>
    t(`supplierRequests.timeline.${key}` as DictionaryKey, vars);
  const num = (n: number | null | undefined, digits = 4) =>
    n === null || n === undefined
      ? null
      : n.toLocaleString(t.intl, { maximumFractionDigits: digits });

  /** Os valores de um passo em pedaços curtos ("1,40 USD", "MOQ 1.000"…). */
  const values = (e: SupplierRequestEvent) =>
    [
      num(e.price) !== null
        ? `${num(e.price)} ${e.currency ?? ""}`.trim()
        : null,
      e.incoterm ?? null,
      num(e.moq, 0) !== null ? `MOQ ${num(e.moq, 0)}` : null,
      num(e.leadTimeDays, 0) !== null
        ? k("days", { n: num(e.leadTimeDays, 0)! })
        : null,
    ].filter((v): v is string => !!v);

  /** O que ficou resolvido no passo, numa frase. */
  const resolved = (entry: TimelineEntry): string => {
    const e = entry.event;
    switch (entry.kind) {
      case "opened":
        return k("opened", { n: r.quantity.toLocaleString(t.intl) });
      case "answer":
        return e?.canDo === "no"
          ? k("answerNo")
          : k(e?.onBehalf ? "answerYesOnBehalf" : "answerYes");
      case "proposal":
        return k("proposal");
      case "accept":
        return k("accept");
      case "counter":
        return k("counter");
      case "reject":
        return k("reject");
      case "message":
        return e?.documentId && !e.text ? k("file") : k("message");
      case "keep":
        return k("keep");
      case "decided":
        return k(`decided.${entry.outcome ?? "approved"}`);
      case "product":
        return k(
          entry.outcome === "linked" ? "productLinked" : "productCreated",
        );
      case "showcase":
        return k("showcase");
      case "erp":
        return k("erp");
      case "sampling":
        return t(
          `sampling.timeline.${entry.outcome ?? "submit"}` as DictionaryKey,
        );
    }
  };

  return (
    <Card title={k("title")}>
      <ol className="relative ml-2 border-l-2 border-zinc-200" data-timeline>
        {entries.map((entry) => {
          const e = entry.event;
          const chips = e ? values(e) : [];
          const dot =
            entry.kind === "sampling"
              ? entry.outcome === "approve"
                ? "bg-emerald-600"
                : entry.outcome === "reject"
                  ? "bg-red-600"
                  : DOT.sampling
              : entry.kind === "decided"
                ? (DECIDED_DOT[entry.outcome ?? ""] ?? DOT.decided)
                : (DOT[entry.kind] ?? "bg-zinc-400");
          return (
            <li
              key={entry.key}
              className="relative pb-5 pl-6 last:pb-0"
              data-timeline-entry={entry.kind}
            >
              <span
                aria-hidden
                className={cx(
                  "absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-white",
                  dot,
                )}
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <time
                  dateTime={entry.at}
                  className="text-xs font-medium tabular-nums text-zinc-500"
                >
                  {dateTime(entry.at, t)}
                </time>
                <span
                  className={cx(
                    "rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                    entry.side === "wellmix"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-amber-100 text-amber-900",
                  )}
                >
                  {t(`supplierRequests.negotiation.side.${entry.side}`)}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                {resolved(entry)}
              </p>
              {chips.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs tabular-nums text-zinc-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
              {e?.text ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                  {e.text}
                </p>
              ) : null}
              {entry.note ? (
                <p className="mt-1 text-sm text-zinc-700">{entry.note}</p>
              ) : null}
              {e?.documentId ? (
                <a
                  href={`/api/files/${e.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-sky-700 underline"
                  data-negotiation-file
                >
                  {e.fileName ?? t("supplierRequests.negotiation.file")}
                </a>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
