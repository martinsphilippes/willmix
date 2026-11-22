import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { SankhyaProjectionRow, User } from "@/lib/db";
import { Alert, Badge, Card, Empty, Table, Td, Th } from "@/components/ui";
import {
  listProjection,
  PROJECTION_SITUATIONS,
  projectionCounts,
  projectionDetail,
} from "@/lib/services/sankhya-projection";
import { one } from "./_shared";
import { AutoContinue } from "./_auto";
import { SubmitButton } from "@/components/submit-button";
import { sankhyaOrdersLoadAction } from "@/app/app/actions/sankhya-integration";
import {
  ordersLoadProgress,
  type OrdersLoadProgress,
} from "@/lib/services/sankhya-orders-load";

/*
 * Configurações → Sankhya → Pedidos do Sankhya (ensaio), só o administrador
 * (21/11/2026; docs/SANKHYA_INTEGRACAO.md, seção 9, etapa 3). Mostra como os
 * pedidos de compra ficariam no portal pela regra nova (um pedido por cadeia
 * 1100 → 1104, embarques 35 à parte), para conferir casos reais antes de
 * apagar os pedidos antigos. Só leitura.
 */

type Params = Record<string, string | string[] | undefined>;

const TONE: Record<string, "info" | "success" | "warning" | "neutral"> = {
  in_progress: "info",
  closed: "success",
  awaiting_definition: "warning",
  interrupted: "neutral",
  legacy_path: "neutral",
};

/** "05022025 00:00:00" → "05/02/2025". */
export function viewDay(value: unknown): string {
  const s = String(value ?? "").trim();
  const m = /^(\d{2})\/?(\d{2})\/?(\d{4})/.exec(s);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : s || "—";
}

const num = (v: unknown, intl: string) => {
  const n = Number(v);
  return v == null || !Number.isFinite(n) ? "—" : n.toLocaleString(intl);
};

function link(q: Params, patch: Record<string, string | null>) {
  const p = new URLSearchParams();
  p.set("tab", "orders");
  for (const k of ["kind", "situation", "milestone", "reason", "s"]) {
    const v = k in patch ? patch[k] : one(q[k]);
    if (v) p.set(k, v);
  }
  if (patch.open) p.set("open", patch.open);
  return `/app/settings/sankhya?${p.toString()}#orders`;
}

export async function OrdersTab({
  t,
  q,
  user,
}: {
  t: Translate;
  q: Params;
  user: User;
}) {
  const kind = one(q.kind) === "shipment" ? "shipment" : "order";
  const counts = await projectionCounts(user);
  const total = Object.values(counts.orders).reduce((a, b) => a + b, 0);
  const sit = (k: string) => t(`sankhyaOrders.situation.${k}` as DictionaryKey);
  const ms = (k: string | null) =>
    k ? t(`milestone.${k}` as DictionaryKey) : "—";
  const reason = (k: string | null | undefined) =>
    k ? t(`sankhyaOrders.reason.${k}` as DictionaryKey) : "—";

  if (!total)
    return (
      <Card title={t("sankhyaOrders.title")}>
        <Empty>{t("sankhyaOrders.empty")}</Empty>
      </Card>
    );

  const {
    rows,
    total: found,
    limited,
  } = await listProjection(user, {
    kind,
    situation: one(q.situation) || null,
    milestone: one(q.milestone) || null,
    reason: one(q.reason) || null,
    search: one(q.s) || null,
  });
  const open = one(q.open);
  const detail = open ? await projectionDetail(user, kind, open) : null;
  const load = await ordersLoadProgress(user);

  return (
    <div className="space-y-4" id="orders">
      <Alert tone="info">
        {t("sankhyaOrders.hint", {
          at: counts.computedAt
            ? new Date(counts.computedAt).toLocaleString(t.intl, {
                timeZone: "America/Sao_Paulo",
              })
            : "—",
        })}
      </Alert>

      <LoadCard t={t} q={q} load={load} />

      <Card title={t("sankhyaOrders.ordersBySituation", { n: total })}>
        <div className="flex flex-wrap gap-2" data-projection-counts>
          {PROJECTION_SITUATIONS.map((s) => (
            <Link
              key={s}
              href={link(q, {
                kind: "order",
                situation: s,
                milestone: null,
                reason: null,
              })}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-brand-300"
              data-projection-situation={s}
            >
              <Badge tone={TONE[s]}>{sit(s)}</Badge>{" "}
              <span className="font-semibold tabular-nums">
                {num(counts.orders[s] ?? 0, t.intl)}
              </span>
            </Link>
          ))}
          <Link
            href={link(q, {
              kind: "shipment",
              situation: null,
              milestone: null,
              reason: null,
            })}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-brand-300"
          >
            {t("sankhyaOrders.shipments")}{" "}
            <span className="font-semibold tabular-nums">
              {num(
                Object.values(counts.shipments).reduce((a, b) => a + b, 0),
                t.intl,
              )}
            </span>{" "}
            <span className="text-xs text-zinc-500">
              ({sit("in_progress")}:{" "}
              {num(counts.shipments.in_progress ?? 0, t.intl)})
            </span>
          </Link>
        </div>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-zinc-700">
              {t("sankhyaOrders.byMilestone")}
            </p>
            <ul className="space-y-0.5">
              {Object.entries(counts.milestones)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => (
                  <li key={k}>
                    <Link
                      href={link(q, {
                        kind: "order",
                        situation: "in_progress",
                        milestone: k,
                        reason: null,
                      })}
                      className="text-brand-700 hover:underline"
                    >
                      {ms(k)}
                    </Link>{" "}
                    <span className="tabular-nums text-zinc-600">{n}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-zinc-700">
              {t("sankhyaOrders.byReason")}
            </p>
            <ul className="space-y-0.5">
              {Object.entries(counts.reasons).map(([k, n]) => (
                <li key={k}>
                  <Link
                    href={link(q, {
                      kind: "order",
                      situation: "awaiting_definition",
                      milestone: null,
                      reason: k,
                    })}
                    className="text-brand-700 hover:underline"
                  >
                    {reason(k === "—" ? null : k)}
                  </Link>{" "}
                  <span className="tabular-nums text-zinc-600">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card
        title={
          kind === "shipment"
            ? t("sankhyaOrders.shipments")
            : t("sankhyaOrders.orders")
        }
      >
        <form
          method="get"
          action="/app/settings/sankhya"
          className="mb-3 flex flex-wrap items-end gap-2 text-sm"
        >
          <input type="hidden" name="tab" value="orders" />
          <input type="hidden" name="kind" value={kind} />
          {one(q.situation) ? (
            <input type="hidden" name="situation" value={one(q.situation)} />
          ) : null}
          {one(q.milestone) ? (
            <input type="hidden" name="milestone" value={one(q.milestone)} />
          ) : null}
          {one(q.reason) ? (
            <input type="hidden" name="reason" value={one(q.reason)} />
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-600">
              {t("sankhyaOrders.search")}
            </span>
            <input
              name="s"
              defaultValue={one(q.s)}
              className="rounded-md border border-zinc-300 px-2 py-1"
              placeholder={t("sankhyaOrders.searchPlaceholder")}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white"
          >
            {t("sankhyaOrders.filter")}
          </button>
          <Link
            href="/app/settings/sankhya?tab=orders#orders"
            className="self-center text-xs text-zinc-600 underline"
          >
            {t("sankhyaOrders.clear")}
          </Link>
        </form>
        <p className="mb-2 text-xs text-zinc-500">
          {t(limited ? "sankhyaOrders.foundLimited" : "sankhyaOrders.found", {
            n: found,
          })}
          {one(q.situation) ? ` · ${sit(one(q.situation))}` : ""}
          {one(q.milestone) ? ` · ${ms(one(q.milestone))}` : ""}
          {one(q.reason) ? ` · ${reason(one(q.reason))}` : ""}
        </p>
        {rows.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("sankhyaOrders.col.nunota")}</Th>
                <Th>TOP</Th>
                <Th>{t("sankhyaOrders.col.supplier")}</Th>
                <Th>{t("sankhyaOrders.col.situation")}</Th>
                <Th>{t("sankhyaOrders.col.milestone")}</Th>
                {kind === "order" ? (
                  <Th>{t("sankhyaOrders.col.shipment")}</Th>
                ) : null}
                <Th>{t("sankhyaOrders.col.date")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-projection-row={r.key}>
                  <Td className="font-mono text-xs">{r.key}</Td>
                  <Td className="text-xs">{r.top ?? "—"}</Td>
                  <Td className="text-xs">
                    {r.supplierName ?? r.supplierCode ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={TONE[r.situation ?? ""] ?? "neutral"}>
                      {r.situation ? sit(r.situation) : "—"}
                    </Badge>
                    {r.situation === "awaiting_definition" ? (
                      <span className="mt-0.5 block text-[11px] text-amber-700">
                        {reason((r.data as { reason?: string } | null)?.reason)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-xs">{ms(r.milestone)}</Td>
                  {kind === "order" ? (
                    <Td className="text-xs">
                      {r.shipmentState
                        ? t(
                            `sankhyaOrders.shipState.${r.shipmentState}` as DictionaryKey,
                          )
                        : "—"}
                    </Td>
                  ) : null}
                  <Td className="whitespace-nowrap text-xs">
                    {viewDay(r.data?.orderedAt)}
                  </Td>
                  <Td>
                    <Link
                      href={link(q, { open: r.key })}
                      className="text-xs font-semibold text-brand-700 underline"
                    >
                      {t("sankhyaOrders.details")}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("sankhyaOrders.none")}</Empty>
        )}
      </Card>

      {detail?.row ? (
        <ProjectionDetail
          t={t}
          row={detail.row}
          related={detail.related}
          q={q}
        />
      ) : null}
    </div>
  );
}

function ProjectionDetail({
  t,
  row,
  related,
  q,
}: {
  t: Translate;
  row: SankhyaProjectionRow;
  related: SankhyaProjectionRow[];
  q: Params;
}) {
  const d = (row.data ?? {}) as Record<string, unknown>;
  const ms = (k: string | null) =>
    k ? t(`milestone.${k}` as DictionaryKey) : "—";
  const chain = (d.chain ?? []) as Array<Record<string, unknown>>;
  const items = (d.items ?? []) as Array<Record<string, unknown>>;
  const orders = (d.orders ?? []) as Array<Record<string, unknown>>;
  const facts: Array<[string, string]> = [
    [t("sankhyaOrders.fact.statusShipping"), String(d.statusShipping ?? "—")],
    [t("sankhyaOrders.fact.quality"), String(d.quality ?? "—")],
    [t("sankhyaOrders.fact.inspectedAt"), viewDay(d.inspectedAt)],
    [t("sankhyaOrders.fact.receipt"), String(d.receipt ?? "—")],
    [t("sankhyaOrders.fact.receivedAt"), viewDay(d.receivedAt)],
    [t("sankhyaOrders.fact.channel"), String(d.customsChannel ?? "—")],
    ["ETD / ETA", `${viewDay(d.etd)} / ${viewDay(d.eta)}`],
    [
      t("sankhyaOrders.fact.total"),
      d.total != null
        ? `${Number(d.total).toLocaleString(t.intl)} ${String(d.currency ?? "")}`
        : "—",
    ],
    ["Incoterm", String(d.incoterm ?? "—")],
  ];
  return (
    <Card
      title={t(
        row.kind === "shipment"
          ? "sankhyaOrders.detailShipment"
          : "sankhyaOrders.detailOrder",
        { key: row.key },
      )}
    >
      <div data-projection-detail={row.key} className="space-y-4 text-sm">
        <p>
          {row.supplierName ?? row.supplierCode} · {ms(row.milestone)}
        </p>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-zinc-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {chain.length ? (
          <div>
            <p className="mb-1 font-medium">{t("sankhyaOrders.chain")}</p>
            <ol className="flex flex-wrap gap-2">
              {chain.map((c) => (
                <li
                  key={String(c.nunota)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                >
                  <span className="font-semibold">TOP {String(c.top)}</span> ·{" "}
                  <span className="font-mono">{String(c.nunota)}</span> ·{" "}
                  {viewDay(c.date)}
                  {c.pending ? (
                    <Badge tone="info" className="ml-1">
                      {t("sankhyaOrders.pending")}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {items.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>Seq</Th>
                <Th>CODPROD</Th>
                <Th>{t("sankhyaOrders.col.product")}</Th>
                <Th>{t("sankhyaOrders.col.qty")}</Th>
                <Th>{t("sankhyaOrders.col.shipped")}</Th>
                <Th>{t("sankhyaOrders.col.pendingQty")}</Th>
                <Th>{t("sankhyaOrders.col.price")}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={String(i.seq)}>
                  <Td className="text-xs">{String(i.seq)}</Td>
                  <Td className="font-mono text-xs">{String(i.codprod)}</Td>
                  <Td className="text-xs">
                    {String(i.name ?? "")}{" "}
                    <span className="text-zinc-500">{String(i.ref ?? "")}</span>
                  </Td>
                  <Td className="text-xs tabular-nums">
                    {num(i.qty, t.intl)} {String(i.unit ?? "")}
                  </Td>
                  <Td className="text-xs tabular-nums">
                    {num(i.shipped, t.intl)}
                  </Td>
                  <Td className="text-xs tabular-nums">
                    {num(i.pendingQty, t.intl)}
                  </Td>
                  <Td className="text-xs tabular-nums">
                    {num(i.price, t.intl)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
        {orders.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("sankhyaOrders.col.order")}</Th>
                <Th>Seq</Th>
                <Th>{t("sankhyaOrders.col.qty")}</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={i}>
                  <Td className="font-mono text-xs">{String(o.order)}</Td>
                  <Td className="text-xs">{String(o.seq)}</Td>
                  <Td className="text-xs tabular-nums">{num(o.qty, t.intl)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
        {related.length ? (
          <div>
            <p className="mb-1 font-medium">
              {t(
                row.kind === "order"
                  ? "sankhyaOrders.relatedShipments"
                  : "sankhyaOrders.relatedOrders",
              )}
            </p>
            <ul className="flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    href={link(q, {
                      kind: r.kind,
                      situation: null,
                      milestone: null,
                      reason: null,
                      open: r.key,
                    })}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-brand-700 hover:underline"
                  >
                    {r.key} · {ms(r.milestone)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Carga real no portal (seção 9, etapa 5): grava os pedidos e embarques do
 * ensaio. "Carregar" começa do início; enquanto não termina, a tela segue
 * sozinha (sair da página para).
 */
function LoadCard({
  t,
  q,
  load,
}: {
  t: Translate;
  q: Params;
  load: OrdersLoadProgress;
}) {
  const running = load.phase === "orders" || load.phase === "shipments";
  const auto = one(q.load) === "auto" && running;
  const error = one(q.load) === "error";
  const pct = load.total ? Math.round((load.done / load.total) * 100) : 0;
  return (
    <Card title={t("sankhyaOrders.load.title")}>
      <div className="space-y-3 text-sm" id="orders-load" data-orders-load>
        <p className="text-zinc-600">{t("sankhyaOrders.load.hint")}</p>
        {error ? (
          <Alert tone="danger">
            {t("sankhyaOrders.load.error", { detail: one(q.detail) || "—" })}
          </Alert>
        ) : null}
        {load.phase !== "idle" ? (
          <div data-orders-load-phase={load.phase}>
            <p>
              {t(`sankhyaOrders.load.phase.${load.phase}` as DictionaryKey)}
              {running ? ` · ${load.done}/${load.total} (${pct}%)` : ""}
            </p>
            <p className="text-zinc-600">
              {t("sankhyaOrders.load.counts", {
                created: load.created,
                updated: load.updated,
                pending: load.withPending,
                containers: load.containers,
              })}
            </p>
            {load.replenishments ||
            load.removedOrders ||
            load.rejectedPreOrders ? (
              <p className="text-zinc-600">
                {t("sankhyaOrders.load.replenishments", {
                  n: load.replenishments ?? 0,
                  rejected: load.rejectedPreOrders ?? 0,
                  removed: load.removedOrders ?? 0,
                })}
              </p>
            ) : null}
            {load.finishedAt ? (
              <p className="text-zinc-600">
                {t("sankhyaOrders.load.finished", {
                  at: new Date(load.finishedAt).toLocaleString(t.intl, {
                    timeZone: "America/Sao_Paulo",
                  }),
                })}
              </p>
            ) : null}
            {load.skipped.length ? (
              <details>
                <summary>
                  {t("sankhyaOrders.load.skipped", {
                    n: load.skipped.length,
                  })}
                </summary>
                <ul className="mt-1 list-disc pl-5">
                  {load.skipped.map((s) => (
                    <li key={s.key}>
                      {s.key}: {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <form action={sankhyaOrdersLoadAction}>
            <input type="hidden" name="restart" value="1" />
            <input type="hidden" name="auto" value="1" />
            <SubmitButton pendingText="…" data-orders-load-start>
              {load.phase === "idle"
                ? t("sankhyaOrders.load.start")
                : t("sankhyaOrders.load.restart")}
            </SubmitButton>
          </form>
          {running ? (
            <form id="orders-load-auto" action={sankhyaOrdersLoadAction}>
              <input type="hidden" name="auto" value="1" />
              <SubmitButton variant="secondary" pendingText="…">
                {t("sankhyaOrders.load.continue")}
              </SubmitButton>
            </form>
          ) : null}
          {auto ? (
            <Link
              href="/app/settings/sankhya?tab=orders#orders-load"
              className="self-center text-sm underline"
            >
              {t("sankhyaOrders.load.stop")}
            </Link>
          ) : null}
        </div>
        {auto ? <AutoContinue formId="orders-load-auto" /> : null}
      </div>
    </Card>
  );
}
