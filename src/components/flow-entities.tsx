import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import { stepLabelKey, type FlowBlock } from "@/lib/flow";
import { blockOf } from "@/lib/flow-progress";
import type { FlowBlockEntity } from "@/lib/services/flow";
import { Badge, Empty, Table, Td, TextLink, Th, cx, rowClass } from "./ui";

/*
 * Pedidos do bloco no Overview (dono, 14/11/2026; docs/FLOW_MENU.md): todos
 * os que estão no bloco agora (ou só no passo escolhido), com os passos, há
 * quantos dias, o atraso e a completude do bloco e do pedido inteiro. O
 * pedido abre na visão entre os blocos (linha do tempo do pedido).
 */

const DAY = 86_400_000;
/** Linhas montadas no servidor; a tabela pagina e busca no navegador. */
export const ENTITY_ROWS = 500;

export const daysSince = (iso: string | null, now: Date) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms)
    ? Math.max(0, Math.floor((now.getTime() - ms) / DAY))
    : null;
};

/** Percentual com a barra; cinza fora do bloco em foco. */
export function PercentBar({
  percent,
  muted,
  ...rest
}: {
  percent: number;
  muted?: boolean;
} & { [key: `data-${string}`]: string | number | undefined }) {
  const value = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <span className="flex min-w-[6rem] items-center gap-2" {...rest}>
      <span
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${value}%`}
      >
        <span
          className={cx(
            "block h-full rounded-full",
            muted
              ? "bg-zinc-400"
              : value >= 100
                ? "bg-emerald-500"
                : "bg-brand-600",
          )}
          style={{ width: `${value}%` }}
        />
      </span>
      <span
        className={cx(
          "w-9 text-right text-xs tabular-nums",
          muted ? "text-zinc-500" : "font-semibold text-zinc-800",
        )}
      >
        {value}%
      </span>
    </span>
  );
}

export async function FlowEntities({
  block,
  entities,
  showSteps,
  t,
  now = new Date(),
}: {
  block: FlowBlock;
  entities: FlowBlockEntity[];
  /** Mostra a coluna dos passos (visão do bloco inteiro). */
  showSteps: boolean;
  t: Translate;
  now?: Date;
}) {
  if (!entities.length) return <Empty>{t("flow.entities.empty")}</Empty>;
  const lateOf = (e: FlowBlockEntity) =>
    (e.progress ? blockOf(e.progress, block)?.lateDays : 0) ?? 0;
  const rows = [...entities]
    .sort((a, b) => lateOf(b) - lateOf(a) || a.order.number - b.order.number)
    .slice(0, ENTITY_ROWS);
  const supplierIds = [
    ...new Set(rows.map((e) => e.order.supplierId).filter(Boolean)),
  ];
  const parties = supplierIds.length
    ? await getStore().list("parties", { filter: { id: supplierIds } })
    : [];
  const nameOf = new Map(parties.map((p) => [p.id, p.name]));
  return (
    <>
      {entities.length > rows.length ? (
        <p className="mb-2 text-xs text-zinc-500">
          {t("flow.entities.capped", {
            n: rows.length,
            total: entities.length,
          })}
        </p>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("flow.all.order")}</Th>
            <Th>{t("flow.all.supplier")}</Th>
            {showSteps ? <Th>{t("flow.entities.steps")}</Th> : null}
            <Th>{t("flow.all.stage")}</Th>
            <Th>{t("flow.all.since")}</Th>
            <Th>{t("flow.entities.late")}</Th>
            <Th>{t("flow.entities.blockPercent")}</Th>
            <Th>{t("flow.entities.overall")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const mine = e.progress ? blockOf(e.progress, block) : null;
            const days = daysSince(mine?.startedAt ?? e.since, now);
            const late = mine?.lateDays ?? 0;
            return (
              <tr
                key={e.order.id}
                className={rowClass}
                data-flow-entity={e.order.id}
                data-flow-entity-late={late}
              >
                <Td className="whitespace-nowrap font-medium">
                  <TextLink
                    href={`/app/orders/${e.order.id}?from=${block}#order-progress`}
                    data-flow-entity-open
                  >
                    {t("orders.number", { number: e.order.number })}
                  </TextLink>
                </Td>
                <Td>{nameOf.get(e.order.supplierId) ?? "—"}</Td>
                {showSteps ? (
                  <Td className="text-xs text-zinc-600">
                    {e.steps
                      .map((key) => t(stepLabelKey({ block, key })))
                      .join(", ")}
                  </Td>
                ) : null}
                <Td className="whitespace-nowrap">
                  {t(`stage.${e.order.status}` as DictionaryKey)}
                </Td>
                <Td className="whitespace-nowrap">
                  {days === null ? "—" : t("flow.cases.days", { n: days })}
                </Td>
                <Td className="whitespace-nowrap">
                  {late > 0 ? (
                    <Badge tone="danger">
                      {t("flow.entities.lateDays", { n: late })}
                    </Badge>
                  ) : (
                    <span className="text-xs text-zinc-500">
                      {t("flow.entities.onTime")}
                    </span>
                  )}
                </Td>
                <Td>
                  <PercentBar
                    percent={mine?.percent ?? 0}
                    data-flow-entity-block={mine?.percent ?? 0}
                  />
                </Td>
                <Td>
                  <PercentBar
                    percent={e.progress?.overall ?? 0}
                    muted
                    data-flow-entity-overall={e.progress?.overall ?? 0}
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
