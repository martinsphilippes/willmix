import { milestoneTitle } from "@/lib/milestones";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { blockLabelKey, overviewHref } from "@/lib/flow";
import {
  PROGRESS_BLOCKS,
  orderProgress,
  type MilestoneProgressRow,
  type MilestoneProgressView,
  type ProgressBlock,
  type StageProgressState,
} from "@/lib/flow-progress";
import { PercentBar } from "./flow-entities";
import { OrderProgressBlocks } from "./order-progress-blocks";
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
 * cor (os marcos, o atraso e a completude) e os outros em cinza, com o
 * percentual; em cima, a completude geral do pedido. As etapas de cada bloco
 * ficam recolhidas até o clique no bloco (dono, 27/11/2026).
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
  milestones,
  rows,
  focus: focusParam,
  t,
  locale,
  now = new Date(),
}: {
  /** Os 16 marcos do pedido (fase 5g: no lugar das etapas). */
  milestones: readonly MilestoneProgressView[];
  /** Linhas gravadas dos marcos (prazo, início e conclusão). */
  rows: readonly MilestoneProgressRow[];
  /** Bloco de onde o pedido foi aberto (?from=…); sem ele, o bloco atual. */
  focus: ProgressBlock | null;
  t: Translate;
  locale?: Parameters<typeof formatDate>[1];
  now?: Date;
}) {
  const progress = orderProgress(milestones, rows, now);
  const focus = focusParam ?? progress.current ?? "order";
  type Block = (typeof progress.blocks)[number];
  const detail = (p: Block) => (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p
          className={cx(
            "text-sm",
            p.lateDays ? "font-medium text-red-700" : "text-zinc-700",
          )}
          data-order-progress-report
        >
          {t("flow.progress.report", {
            late: p.lateDays,
            doneLate: p.doneLate,
          })}
        </p>
        <TextLink href={overviewHref(p.block)} className="text-xs">
          {t("flow.progress.backToOverview", {
            block: t(blockLabelKey(p.block)),
          })}
        </TextLink>
      </div>
      {p.milestones.length ? (
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
            {p.milestones.map((s) => (
              <tr
                key={s.id}
                className={rowClass}
                data-order-progress-stage={s.key}
                data-order-progress-milestone={s.key}
              >
                <Td className="whitespace-nowrap font-medium text-zinc-900">
                  {milestoneTitle(t, s.key)}
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
    </>
  );
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
      <OrderProgressBlocks
        blocks={PROGRESS_BLOCKS.map((b, i) => {
          const p = progress.blocks.find((x) => x.block === b)!;
          const here = b === focus;
          return {
            key: b,
            here,
            percent: p.percent,
            face: (
              <>
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
              </>
            ),
            detail: detail(p),
          };
        })}
      />
    </Card>
  );
}
