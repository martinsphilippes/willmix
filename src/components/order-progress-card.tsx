import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Stage } from "@/lib/db/schema";
import { blockLabelKey, overviewHref } from "@/lib/flow";
import {
  PROGRESS_BLOCKS,
  orderProgress,
  type ProgressBlock,
  type StageProgressState,
} from "@/lib/flow-progress";
import { PercentBar } from "./flow-entities";
import {
  Badge,
  Card,
  Empty,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  rowClass,
} from "./ui";

/*
 * Linha do tempo do pedido entre os blocos (dono, 14/11/2026;
 * docs/FLOW_MENU.md): o pedido aberto pelo Overview de um bloco mostra a
 * viagem inteira (Pedido → Produção → Entrega), com o bloco de onde veio em
 * cor (as etapas, o atraso e a completude) e os outros em cinza, com o
 * percentual; em cima, a completude geral do pedido.
 */

const TONE: Record<
  StageProgressState,
  "success" | "brand" | "danger" | "neutral"
> = {
  done: "success",
  active: "brand",
  blocked: "danger",
  pending: "neutral",
};

export function OrderProgressCard({
  orderId,
  stages,
  focus: focusParam,
  t,
  locale,
  now = new Date(),
}: {
  orderId: string;
  stages: Stage[];
  /** Bloco de onde o pedido foi aberto (?from=…); sem ele, o bloco atual. */
  focus: ProgressBlock | null;
  t: Translate;
  locale?: Parameters<typeof formatDate>[1];
  now?: Date;
}) {
  const progress = orderProgress(stages, now);
  const focus = focusParam ?? progress.current ?? "order";
  const mine = progress.blocks.find((b) => b.block === focus)!;
  return (
    <Card
      className="mb-4 scroll-mt-20"
      title={
        <span id="order-progress" data-order-progress={focus}>
          {t("flow.progress.title")}
        </span>
      }
      actions={
        <span
          className="flex w-56 items-center gap-2 text-xs text-zinc-600"
          data-order-progress-overall={progress.overall}
        >
          <span className="whitespace-nowrap">
            {t("flow.progress.overall")}
          </span>
          <PercentBar percent={progress.overall} />
        </span>
      }
    >
      <p className="mb-3 text-xs text-zinc-500">{t("flow.progress.hint")}</p>
      <ol className="mb-4 grid gap-2 sm:grid-cols-3" data-order-progress-blocks>
        {PROGRESS_BLOCKS.map((b, i) => {
          const p = progress.blocks.find((x) => x.block === b)!;
          const here = b === focus;
          return (
            <li key={b}>
              <Link
                href={`/app/orders/${orderId}?from=${b}#order-progress`}
                scroll={false}
                aria-current={here ? "step" : undefined}
                data-order-progress-block={b}
                data-order-progress-percent={p.percent}
                className={cx(
                  "block rounded-xl border px-3 py-2 transition hover:shadow-sm",
                  here
                    ? "border-brand-300 bg-brand-50"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cx(
                      "text-sm",
                      here ? "font-semibold text-brand-700" : "text-zinc-600",
                    )}
                  >
                    {i + 1}. {t(blockLabelKey(b))}
                  </span>
                  <span className="flex gap-1">
                    {progress.current === b ? (
                      <Badge tone={here ? "brand" : "neutral"}>
                        {t("flow.progress.now")}
                      </Badge>
                    ) : null}
                    {p.lateDays > 0 ? (
                      <Badge tone={here ? "danger" : "neutral"}>
                        {t("flow.progress.lateNow", { n: p.lateDays })}
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <div className="mt-1.5">
                  <PercentBar percent={p.percent} muted={!here} />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p
          className={cx(
            "text-sm",
            mine.lateDays ? "font-medium text-red-700" : "text-zinc-700",
          )}
          data-order-progress-report
        >
          {t("flow.progress.report", {
            late: mine.lateDays,
            doneLate: mine.doneLate,
          })}
        </p>
        <TextLink href={overviewHref(focus)} className="text-xs">
          {t("flow.progress.backToOverview", {
            block: t(blockLabelKey(focus)),
          })}
        </TextLink>
      </div>
      {mine.stages.length ? (
        <Table tools={false}>
          <thead>
            <tr>
              <Th>{t("flow.progress.stage")}</Th>
              <Th>{t("flow.progress.state")}</Th>
              <Th>%</Th>
              <Th>{t("flow.progress.due")}</Th>
              <Th>{t("flow.progress.done")}</Th>
              <Th>{t("flow.progress.delay")}</Th>
            </tr>
          </thead>
          <tbody>
            {mine.stages.map((s) => (
              <tr
                key={s.id}
                className={rowClass}
                data-order-progress-stage={s.key}
              >
                <Td className="whitespace-nowrap font-medium text-zinc-900">
                  {t(`stage.${s.key}` as DictionaryKey)}
                </Td>
                <Td>
                  <Badge tone={TONE[s.state]}>
                    {t(`flow.progress.state.${s.state}` as DictionaryKey)}
                  </Badge>
                </Td>
                <Td>
                  <PercentBar percent={s.percent} />
                </Td>
                <Td className="whitespace-nowrap">
                  {s.dueAt ? formatDate(s.dueAt, locale) : "—"}
                </Td>
                <Td className="whitespace-nowrap">
                  {s.completedAt ? formatDate(s.completedAt, locale) : "—"}
                </Td>
                <Td className="whitespace-nowrap">
                  {s.lateDays > 0 ? (
                    <Badge tone="danger">
                      {t("flow.progress.lateNow", { n: s.lateDays })}
                    </Badge>
                  ) : s.doneLateDays > 0 ? (
                    <span className="text-xs text-amber-700">
                      {t("flow.progress.lateDone", { n: s.doneLateDays })}
                    </span>
                  ) : s.dueAt ? (
                    <span className="text-xs text-zinc-500">
                      {t("flow.progress.onTime")}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t("flow.progress.noStages")}</Empty>
      )}
    </Card>
  );
}
