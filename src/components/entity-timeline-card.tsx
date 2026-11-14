import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { blockLabelKey, overviewHref, stepLabelKey } from "@/lib/flow";
import type {
  EntityStepState,
  EntityTimeline,
} from "@/lib/services/entity-timeline";
import { PercentBar } from "./flow-entities";
import { Badge, Card, cx } from "./ui";

/*
 * Linha do tempo do book e da solicitação ao fornecedor (dono, 14/11/2026;
 * docs/FLOW_MENU.md): os passos do Produto novo em cor, com a situação e o
 * atraso; Pedido, Produção e Entrega em cinza, com o percentual dos pedidos
 * que nasceram da entidade; em cima, a completude geral.
 */

const TONE: Record<EntityStepState, "success" | "brand" | "neutral"> = {
  done: "success",
  current: "brand",
  pending: "neutral",
};

export function EntityTimelineCard({
  timeline,
  t,
}: {
  timeline: EntityTimeline;
  t: Translate;
}) {
  return (
    <Card
      className="mb-4 scroll-mt-20"
      title={
        <span id="entity-timeline" data-entity-timeline>
          {t("flow.np.timeline")}
        </span>
      }
      actions={
        <span
          className="flex w-56 items-center gap-2 text-xs text-zinc-600"
          data-entity-timeline-overall={timeline.overall}
        >
          <span className="whitespace-nowrap">
            {t("flow.progress.overall")}
          </span>
          <PercentBar percent={timeline.overall} />
        </span>
      }
    >
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <li
          className="rounded-xl border border-brand-300 bg-brand-50 px-3 py-2"
          data-entity-timeline-block="new-product"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brand-700">
              1. {t(blockLabelKey("new-product"))}
            </span>
            {timeline.lateDays > 0 ? (
              <Badge tone="danger">
                {t("flow.progress.lateNow", { n: timeline.lateDays })}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1.5">
            <PercentBar percent={timeline.percent} />
          </div>
          <ul className="mt-2 space-y-1">
            {timeline.steps.map((s) => (
              <li
                key={s.key}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                data-entity-timeline-step={s.key}
                data-entity-timeline-state={s.state}
              >
                <Badge tone={TONE[s.state]}>
                  {t(stepLabelKey({ block: "new-product", key: s.key }))}
                </Badge>
                {s.detail ? (
                  s.href ? (
                    <Link href={s.href} className="text-brand-700 underline">
                      {t(s.detail.key as DictionaryKey, s.detail.values)}
                    </Link>
                  ) : (
                    <span className="text-zinc-600">
                      {t(s.detail.key as DictionaryKey, s.detail.values)}
                    </span>
                  )
                ) : null}
                {s.lateDays > 0 ? (
                  <span className="font-semibold text-red-700">
                    {t("flow.progress.lateNow", { n: s.lateDays })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
        {timeline.blocks.map((b, i) => (
          <li key={b.block}>
            <Link
              href={overviewHref(b.block)}
              className="block h-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500 transition hover:shadow-sm"
              data-entity-timeline-block={b.block}
              data-entity-timeline-percent={b.percent}
            >
              <span className="text-sm text-zinc-600">
                {i + 2}. {t(blockLabelKey(b.block))}
              </span>
              <div className="mt-1.5">
                <PercentBar percent={b.percent} muted />
              </div>
              <div className={cx("mt-1 text-xs text-zinc-500")}>
                {timeline.orders
                  ? t("flow.np.orders", { n: timeline.orders })
                  : t("flow.np.noOrder")}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
