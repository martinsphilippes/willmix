import type { DictionaryKey } from "@/i18n/dictionaries";
import { requirementLabel, type Translate } from "@/i18n";
import type { InspectionReport } from "@/lib/services/inspection-report";
import {
  Badge,
  Card,
  Empty,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  rowClass,
} from "./ui";

/*
 * Relatório da inspeção (só Wellmix), saído do detalhe do pedido para ser
 * usado também na tela do passo Produção → Inspeção (docs/FLOW_MENU.md).
 */

export function formatDateTime(
  value: string | null | undefined,
  intl = "pt-BR",
) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo traduzido de um atributo do snapshot (cai no nome técnico se faltar chave). */
export function attrLabel(t: Translate, attribute: string) {
  const key = `orders.inspection.attr.${attribute}` as DictionaryKey;
  const translated = t(key);
  return translated === key ? attribute : translated;
}

/**
 * Relatório da inspeção (só Wellmix): resultado, medidas × comprado, fotos,
 * decisão da revisão, divergências registradas e linha do tempo.
 */
export function InspectionResultCard({
  t,
  report,
  userName,
}: {
  t: Translate;
  report: InspectionReport;
  userName: (id: string | null) => string;
}) {
  const outcomeTone = {
    waiting: "neutral",
    approved: "success",
    accepted: "success",
    divergent: "danger",
    remeasure: "warning",
  } as const;
  const review = report.review;
  const decision = !review
    ? t("inspReport.decision.none")
    : review.status === "pending"
      ? t("inspReport.decision.pending")
      : review.status === "rejected"
        ? t("inspReport.decision.rejected")
        : review.value === "auto"
          ? t("inspReport.decision.auto")
          : t("inspReport.decision.approved");
  const openCount = report.reviews.filter((r) => r.status === "open").length;
  const eventLabel = (action: string) => {
    const key = `inspReport.event.${action}` as DictionaryKey;
    const text = t(key);
    return text === key ? action : text;
  };
  return (
    <Card
      title={t("orders.inspection.title")}
      actions={
        <Badge tone={outcomeTone[report.outcome]}>
          {t(`inspReport.outcome.${report.outcome}`)}
        </Badge>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("inspReport.hint")}
      </p>

      <h3 className="mb-2 text-sm font-semibold text-zinc-900">
        {t("inspReport.measures")}
      </h3>
      {report.rows.length === 0 ? (
        <Empty>{t("inspReport.noMeasures")}</Empty>
      ) : (
        <>
          {!report.hasReference ? (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("inspReport.noReference")}
            </p>
          ) : null}
          <Table>
            <thead>
              <tr>
                <Th>{t("orders.inspection.attribute")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.expected")}
                </Th>
                <Th className="text-right">{t("orders.inspection.found")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.tolerance")}
                </Th>
                <Th>{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => {
                const c = row.comparison;
                return (
                  <tr key={row.requirement.id} className={rowClass}>
                    <Td className="font-medium">
                      {attrLabel(t, row.attribute)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {row.attribute === "innerBoxQty" && c?.expected === 0
                        ? t("carton.inner.none")
                        : typeof c?.expected === "number"
                          ? c.expected.toLocaleString(t.intl, {
                              maximumFractionDigits: 4,
                            })
                          : (c?.expected ?? "—")}
                    </Td>
                    <Td
                      className={cx(
                        "text-right tabular-nums",
                        c && !c.ok && "font-semibold text-red-700",
                      )}
                    >
                      {row.requirement.value}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {c?.tolerancePercent != null
                        ? `${c.tolerancePercent.toLocaleString(t.intl, { maximumFractionDigits: 2 })}%`
                        : "—"}
                    </Td>
                    <Td>
                      {row.awaitingRemeasure ? (
                        <Badge tone="warning">
                          {t("inspReport.awaitingRemeasure")}
                        </Badge>
                      ) : !c ? (
                        <Badge tone="neutral">
                          {t("inspReport.noExpected")}
                        </Badge>
                      ) : (
                        <Badge tone={c.ok ? "success" : "danger"}>
                          {c.ok
                            ? t("orders.inspection.ok")
                            : t("orders.inspection.divergent")}
                        </Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-zinc-500">
            {t("orders.inspection.measuredBy")}:{" "}
            {userName(report.rows[0].requirement.submittedByUserId)} ·{" "}
            {formatDateTime(report.rows[0].requirement.submittedAt, t.intl)}
          </p>
        </>
      )}

      {report.photos.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">
            {t("inspReport.photos")}
          </h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {report.photos.map((p) => (
              <li key={p.id}>
                <a
                  href={`/api/files/${p.documentId}`}
                  target="_blank"
                  className="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition hover:border-brand-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${p.documentId}`}
                    alt={requirementLabel(t, p)}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>
                <p className="mt-1 text-xs text-zinc-600">
                  {requirementLabel(t, p)}
                  {p.status === "rejected" ? (
                    <span className="ml-1 text-amber-700">
                      · {t("inspReport.awaitingRemeasure")}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Decisão da revisão numa linha. */}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">
          {t("inspReport.decision")}
        </h3>
        <Table>
          <thead>
            <tr>
              <Th>{t("inspReport.decision")}</Th>
              <Th>{t("orderView.col.trail")}</Th>
            </tr>
          </thead>
          <tbody>
            <tr className={rowClass} data-inspection-decision>
              <Td className="min-w-56 text-zinc-800">{decision}</Td>
              <Td className="text-xs text-zinc-500">
                {review && review.status !== "pending" ? (
                  <>
                    {review.value !== "auto"
                      ? `${userName(review.submittedByUserId)} · `
                      : ""}
                    {formatDateTime(review.submittedAt, t.intl)}
                    {review.note ? ` · ${review.note}` : ""}
                  </>
                ) : (
                  "—"
                )}
              </Td>
            </tr>
          </tbody>
        </Table>
      </div>

      {/* Divergências: uma por linha. */}
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("inspReport.divergences")}
            {openCount > 0 ? (
              <span className="ml-2">
                <Badge tone="warning">{openCount}</Badge>
              </span>
            ) : null}
          </h3>
          {openCount > 0 ? (
            <TextLink href="/app/reviews" className="text-xs">
              {t("orders.inspection.reviewsLink")} →
            </TextLink>
          ) : null}
        </div>
        {report.reviews.length === 0 ? (
          <p className="text-xs text-zinc-500">
            {t("inspReport.noDivergences")}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("inspReport.col.problem")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.expected")}
                </Th>
                <Th className="text-right">{t("orders.inspection.found")}</Th>
                <Th>{t("inspReport.col.when")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("inspReport.resolvedBy")}</Th>
              </tr>
            </thead>
            <tbody>
              {report.reviews.map((r) => (
                <tr
                  key={r.id}
                  className={cx(
                    rowClass,
                    r.status === "open" && "bg-amber-50/60",
                  )}
                >
                  <Td className="min-w-44 font-medium text-zinc-900">
                    {r.problem}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {r.expected ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium tabular-nums text-red-700">
                    {r.found ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-zinc-600">
                    {formatDateTime(r.createdAt, t.intl)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={r.status === "open" ? "warning" : "success"}>
                      {t(`reviews.status.${r.status}`)}
                    </Badge>
                  </Td>
                  <Td className="min-w-40 text-xs text-zinc-500">
                    {r.status !== "open" ? (
                      <>
                        {userName(r.resolvedByUserId)} ·{" "}
                        {formatDateTime(r.resolvedAt, t.intl)}
                        {r.resolutionNote ? ` · ${r.resolutionNote}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {report.timeline.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
            {t("inspReport.timeline")} ({report.timeline.length})
          </summary>
          <div className="mt-2">
            <Table>
              <thead>
                <tr>
                  <Th>{t("inspReport.col.event")}</Th>
                  <Th>{t("inspReport.col.detail")}</Th>
                  <Th>{t("inspReport.col.who")}</Th>
                </tr>
              </thead>
              <tbody>
                {report.timeline.map((e) => (
                  <tr key={e.id} className={rowClass}>
                    <Td className="whitespace-nowrap font-medium text-zinc-800">
                      {eventLabel(e.action)}
                    </Td>
                    <Td className="min-w-56 text-xs text-zinc-600">
                      {e.summary.replace(/^INSPECTION:\s*/, "")}
                      {e.action === "requirement.submit" &&
                      e.after &&
                      typeof e.after === "object" &&
                      "value" in e.after &&
                      (e.after as { value: unknown }).value
                        ? ` = ${String((e.after as { value: unknown }).value)}`
                        : ""}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-zinc-500">
                      {userName(e.userId)} ·{" "}
                      {formatDateTime(e.createdAt, t.intl)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
