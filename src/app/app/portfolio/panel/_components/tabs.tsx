import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Card,
  Empty,
  Field,
  Select,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  rowClass,
  Button,
} from "@/components/ui";
import {
  DIAGNOSIS_FOCUS,
  RECENCIES,
  abc,
  compareYears,
  customers as customersOf,
  diagnosis,
  executive,
  frequency,
  lifecycle,
  mix,
  periods,
  stock as stockOf,
  type AbcClass,
  type DiagnosisFocus,
  type ProductTotal,
  type SaleRow,
  type StockInfo,
} from "@/lib/sales-panel";
import type { PanelData } from "@/lib/services/sales-panel";
import type { TradeActivityStatus } from "@/lib/db/schema";
import { Bars } from "./bars";
import type { Formatters } from "./format";

export interface TabContext {
  t: Translate;
  f: Formatters;
  data: PanelData;
  rows: SaleRow[];
  totals: ProductTotal[];
  customerName: ReadonlyMap<string, string>;
  /** AAAA-MM-DD (Brasília). */
  today: string;
  /** Parâmetros atuais (escopo, aba e filtros), para os formulários. */
  params: Record<string, string>;
  stock?: ReadonlyMap<string, StockInfo>;
  /** Ações do plano por produto (diagnóstico). */
  plan?: ReadonlyMap<string, { id: string; status: TradeActivityStatus }>;
}

const productLabel = (p: Pick<ProductTotal, "sku" | "code" | "name">) =>
  `${p.sku ?? p.code} · ${p.name}`;

function Kpis({ items }: { items: Array<[string, string, string?]> }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value, key]) => (
        <Stat
          key={label}
          compact
          label={label}
          value={<span data-panel-kpi={key ?? ""}>{value}</span>}
        />
      ))}
    </div>
  );
}

/** Campos escondidos com os parâmetros atuais (menos os que o formulário troca). */
function Hidden({
  params,
  except,
}: {
  params: Record<string, string>;
  except: string[];
}) {
  return (
    <>
      {Object.entries(params)
        .filter(([k, v]) => v && !except.includes(k))
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
    </>
  );
}

function ProductTable({
  c,
  rows,
  extra,
}: {
  c: TabContext;
  rows: ProductTotal[];
  extra?: {
    head: string[];
    cells: (p: ProductTotal) => Array<string | number>;
  };
}) {
  const { t, f, data } = c;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("salesPanel.col.sku")}</Th>
          <Th>{t("salesPanel.col.product")}</Th>
          <Th>{t("salesPanel.col.group")}</Th>
          <Th>{t("salesPanel.col.pieces")}</Th>
          <Th>{t("salesPanel.col.customers")}</Th>
          <Th>{t("salesPanel.col.orders")}</Th>
          <Th>{t("salesPanel.col.last")}</Th>
          {data.money ? <Th>{t("salesPanel.col.value")}</Th> : null}
          {extra?.head.map((h) => (
            <Th key={h}>{h}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.code} className={rowClass} data-panel-product={p.code}>
            <Td>
              {p.sku ?? "—"}
              <span className="block text-xs text-zinc-500">{p.code}</span>
            </Td>
            <Td>{p.name}</Td>
            <Td>{p.group}</Td>
            <Td>{f.int(p.pieces)}</Td>
            <Td>{p.customers.size}</Td>
            <Td>{p.orders}</Td>
            <Td>{f.day(p.lastOrderDate)}</Td>
            {data.money ? <Td>{f.brl(p.valueBrl)}</Td> : null}
            {extra?.cells(p).map((v, i) => (
              <Td key={i}>{v}</Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/* 01 · Visão executiva */
export function ExecutiveTab({ c }: { c: TabContext }) {
  const { t, f, data } = c;
  const e = executive(c.totals);
  return (
    <>
      <Kpis
        items={[
          [t("salesPanel.kpi.pieces"), f.int(e.pieces), "pieces"],
          [t("salesPanel.kpi.skus"), f.int(e.skus), "skus"],
          [t("salesPanel.kpi.customers"), f.int(e.customers), "customers"],
          [t("salesPanel.kpi.top10"), f.pct(e.top10Share), "top10"],
          [t("salesPanel.kpi.orders"), f.int(e.orders), "orders"],
          ...(data.money
            ? ([
                [t("salesPanel.kpi.value"), f.brlShort(e.valueBrl), "value"],
              ] as Array<[string, string, string]>)
            : []),
        ]}
      />
      {e.unconverted ? (
        <p className="mb-3 text-xs text-amber-800">
          {t("salesPanel.unconverted", { n: e.unconverted })}
        </p>
      ) : null}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card dense title={t("salesPanel.chart.top10")}>
          <Bars
            testId="top10"
            items={e.top10.map((p) => ({
              label: productLabel(p),
              value: p.pieces,
            }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
        <Card dense title={t("salesPanel.chart.groups")}>
          <Bars
            items={e.groups
              .slice(0, 12)
              .map((g) => ({ label: g.label, value: g.value }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
      </div>
      {c.totals.length ? (
        <ProductTable c={c} rows={c.totals.slice(0, 20)} />
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}

/* 02 · Ranking de produtos */
export function RankingTab({ c }: { c: TabContext }) {
  const { t, f } = c;
  const a = abc(c.totals);
  const share = new Map(a.rows.map((r) => [r.code, r]));
  return c.totals.length ? (
    <ProductTable
      c={c}
      rows={c.totals}
      extra={{
        head: [t("salesPanel.col.share"), t("salesPanel.col.cumulative")],
        cells: (p) => [
          f.pct(share.get(p.code)?.share ?? 0),
          f.pct(share.get(p.code)?.cumulative ?? 0),
        ],
      }}
    />
  ) : (
    <Empty>{t("salesPanel.empty")}</Empty>
  );
}

/* 03 · Curva ABC */
export function AbcTab({ c }: { c: TabContext }) {
  const { t, f, params } = c;
  const a = abc(c.totals);
  const cls = (["A", "B", "C"] as AbcClass[]).includes(params.cls as AbcClass)
    ? (params.cls as AbcClass)
    : null;
  const shown = cls ? a.rows.filter((r) => r.cls === cls) : a.rows;
  return (
    <>
      <p className="mb-3 text-xs text-zinc-600">{t("salesPanel.abc.note")}</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(["A", "B", "C"] as AbcClass[]).map((k) => (
          <Stat
            key={k}
            compact
            label={t("salesPanel.abc.class", { c: k })}
            value={
              <span data-panel-abc={k}>
                {f.pct(a.total > 0 ? a.classes[k].pieces / a.total : 0)}
              </span>
            }
            tone={k === "A" ? "success" : "neutral"}
          />
        ))}
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card dense title={t("salesPanel.chart.top10")}>
          <Bars
            items={a.rows
              .slice(0, 15)
              .map((p) => ({ label: productLabel(p), value: p.pieces }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
        <Card dense title={t("salesPanel.abc.filter")}>
          <ul className="space-y-1 text-sm">
            {(["A", "B", "C"] as AbcClass[]).map((k) => (
              <li key={k}>
                {t("salesPanel.abc.class", { c: k })}:{" "}
                {t("salesPanel.abc.skus", { n: a.classes[k].skus })} ·{" "}
                {f.int(a.classes[k].pieces)}
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex items-end gap-2"
            action="/app/portfolio/panel"
          >
            <Hidden params={params} except={["cls"]} />
            <Field label={t("salesPanel.abc.filter")}>
              <Select name="cls" defaultValue={cls ?? ""}>
                <option value="">{t("salesPanel.abc.all")}</option>
                {(["A", "B", "C"] as AbcClass[]).map((k) => (
                  <option key={k} value={k}>
                    {t("salesPanel.abc.class", { c: k })}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              {t("salesPanel.filter.apply")}
            </Button>
          </form>
        </Card>
      </div>
      {shown.length ? (
        <ProductTable
          c={c}
          rows={shown}
          extra={{
            head: [
              t("salesPanel.col.class"),
              t("salesPanel.col.share"),
              t("salesPanel.col.cumulative"),
            ],
            cells: (p) => {
              const r = a.rows.find((x) => x.code === p.code);
              return [
                r?.cls ?? "—",
                f.pct(r?.share ?? 0),
                f.pct(r?.cumulative ?? 0),
              ];
            },
          }}
        />
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}

/* 04 · Frequência por SKU */
export function FrequencyTab({ c }: { c: TabContext }) {
  const { t, f } = c;
  const q = frequency(c.rows, c.totals);
  return (
    <>
      <Kpis
        items={[
          [t("salesPanel.kpi.customers"), f.int(q.customers)],
          [t("salesPanel.freq.pairs"), f.int(q.pairs)],
          [t("salesPanel.freq.multi"), f.int(q.multiCustomerSkus)],
          [t("salesPanel.freq.avg"), f.dec(q.avgSkusPerCustomer)],
          [
            t("salesPanel.freq.repurchase"),
            f.pct(q.repurchaseRate),
            "repurchase",
          ],
        ]}
      />
      <p className="mb-3 text-xs text-zinc-600">
        {t("salesPanel.freq.repurchaseHint", {
          n: q.repurchased,
          total: q.pairs,
        })}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card dense title={t("salesPanel.chart.reach")}>
          <Bars
            items={q.topReach.map((p) => ({
              label: productLabel(p),
              value: p.customers.size,
            }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
        <Card dense title={t("salesPanel.chart.variety")}>
          <Bars
            items={q.topVariety.slice(0, 10).map((v) => ({
              label: c.customerName.get(v.customerId) ?? v.customerId,
              value: v.skus,
            }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
      </div>
    </>
  );
}

/* 05 · Análise por período */
export function PeriodTab({ c }: { c: TabContext }) {
  const { t, f, data } = c;
  const p = periods(c.rows);
  return (
    <>
      <p className="mb-3 text-xs text-zinc-600">
        {t("salesPanel.period.note")}
      </p>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card dense title={t("salesPanel.chart.months")}>
          <Bars
            testId="months"
            items={p.months
              .slice(-24)
              .map((m) => ({ label: f.month(m.key), value: m.pieces }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
        <Card dense title={t("salesPanel.chart.quarters")}>
          <Bars
            items={p.quarters
              .slice(-12)
              .map((m) => ({ label: m.key, value: m.pieces }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
      </div>
      {p.months.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("salesPanel.col.month")}</Th>
              <Th>{t("salesPanel.col.pieces")}</Th>
              <Th>{t("salesPanel.col.orders")}</Th>
              {data.money ? <Th>{t("salesPanel.col.value")}</Th> : null}
            </tr>
          </thead>
          <tbody>
            {[...p.months].reverse().map((m) => (
              <tr key={m.key} className={rowClass}>
                <Td>{f.month(m.key)}</Td>
                <Td>{f.int(m.pieces)}</Td>
                <Td>{m.orders}</Td>
                {data.money ? <Td>{f.brl(m.valueBrl)}</Td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}

/* 06 · Comparativo anual */
export function CompareTab({ c }: { c: TabContext }) {
  const { t, f, data, params } = c;
  const years = data.years;
  const yb = years.includes(params.yb) ? params.yb : (years[0] ?? "");
  const ya = years.includes(params.ya)
    ? params.ya
    : (years.find((y) => y < yb) ?? "");
  if (!ya || !yb || ya === yb)
    return (
      <>
        <CompareForm c={c} ya={ya} yb={yb} />
        <Empty>{t("salesPanel.compare.none")}</Empty>
      </>
    );
  const cmp = compareYears(c.rows, ya, yb);
  return (
    <>
      <CompareForm c={c} ya={ya} yb={yb} />
      <p className="mb-1 text-sm text-zinc-800" data-panel-compare>
        {t("salesPanel.compare.total", {
          n: cmp.sameMonths,
          a: f.int(cmp.totalA),
          b: f.int(cmp.totalB),
          ya,
          yb,
        })}
      </p>
      {cmp.change !== null ? (
        <p className="mb-3 text-sm font-semibold text-zinc-900">
          {t("salesPanel.compare.change", { pct: f.pct(cmp.change) })}
        </p>
      ) : null}
      <Table tools={false}>
        <thead>
          <tr>
            <Th>{t("salesPanel.col.month")}</Th>
            <Th>{ya}</Th>
            <Th>{yb}</Th>
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((r, i) => (
            <tr key={r.month} className={rowClass}>
              <Td>{r.month}</Td>
              <Td>{f.int(r.a)}</Td>
              {/* Meses depois do último com venda no ano comparado: ainda não houve. */}
              <Td>{i < cmp.sameMonths ? f.int(r.b) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

function CompareForm({ c, ya, yb }: { c: TabContext; ya: string; yb: string }) {
  const { t, data, params } = c;
  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-2"
      action="/app/portfolio/panel"
    >
      <Hidden params={params} except={["ya", "yb"]} />
      <Field label={t("salesPanel.compare.yearA")}>
        <Select name="ya" defaultValue={ya}>
          {data.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("salesPanel.compare.yearB")}>
        <Select name="yb" defaultValue={yb}>
          {data.years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary">
        {t("salesPanel.filter.apply")}
      </Button>
    </form>
  );
}

/* 07 · Mix e categorias */
export function MixTab({ c }: { c: TabContext }) {
  const { t, f } = c;
  const m = mix(c.totals);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card dense title={t("salesPanel.chart.groups")}>
        <Bars
          items={m.groups.map((g) => ({ label: g.label, value: g.value }))}
          format={f.int}
          empty={t("salesPanel.empty")}
        />
      </Card>
      <Card dense title={t("salesPanel.chart.categories")}>
        <Bars
          items={m.categories
            .slice(0, 25)
            .map((g) => ({ label: g.label, value: g.value }))}
          format={f.int}
          empty={t("salesPanel.empty")}
        />
      </Card>
    </div>
  );
}

/* 08 · Estoque e disponibilidade */
export function StockTab({ c }: { c: TabContext }) {
  const { t, f } = c;
  const s = stockOf(c.totals, c.stock ?? new Map());
  return (
    <>
      <Kpis
        items={[
          [t("salesPanel.stock.with"), f.int(s.withStock)],
          [t("salesPanel.stock.without"), f.int(s.withoutStock)],
          [
            t("salesPanel.stock.soldWithout"),
            f.int(s.soldWithoutStock),
            "soldWithout",
          ],
          [t("salesPanel.stock.coming"), f.int(s.coming)],
        ]}
      />
      <p className="mb-3 text-xs text-zinc-600">{t("salesPanel.stock.note")}</p>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card dense title={t("salesPanel.chart.stockTop")}>
          <Bars
            items={[...s.rows]
              .sort((a, b) => b.free - a.free)
              .filter((r) => r.free > 0)
              .slice(0, 10)
              .map((r) => ({ label: productLabel(r), value: r.free }))}
            format={f.int}
            empty={t("salesPanel.stock.none")}
          />
        </Card>
        <Card dense title={t("salesPanel.chart.noStock")}>
          <Bars
            items={s.rows
              .filter((r) => r.free <= 0 && r.pieces > 0)
              .slice(0, 10)
              .map((r) => ({ label: productLabel(r), value: r.pieces }))}
            format={f.int}
            empty={t("salesPanel.stock.allStocked")}
          />
        </Card>
      </div>
      {s.rows.length ? (
        <ProductTable
          c={c}
          rows={s.rows}
          extra={{
            head: [
              t("salesPanel.col.free"),
              t("salesPanel.col.transit"),
              t("salesPanel.col.production"),
            ],
            cells: (p) => {
              const r = s.rows.find((x) => x.code === p.code)!;
              return r.inCatalog
                ? [f.int(r.free), f.int(r.transit), f.int(r.production)]
                : [t("salesPanel.stock.outCatalog"), "—", "—"];
            },
          }}
        />
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}

/* 09 · Ciclo de vida */
export function LifecycleTab({ c }: { c: TabContext }) {
  const { t, f } = c;
  const l = lifecycle(c.totals, c.today);
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RECENCIES.map((r) => (
          <Stat
            key={r}
            compact
            label={t(`salesPanel.life.${r}` as DictionaryKey)}
            value={<span data-panel-recency={r}>{f.int(l.counts[r])}</span>}
            tone={r === "older" && l.counts[r] ? "warning" : "neutral"}
          />
        ))}
      </div>
      <p className="mb-3 text-xs text-zinc-600">{t("salesPanel.life.note")}</p>
      {l.rows.length ? (
        <ProductTable
          c={c}
          rows={l.rows}
          extra={{
            head: [t("salesPanel.col.days"), t("salesPanel.col.recency")],
            cells: (p) => {
              const r = l.rows.find((x) => x.code === p.code)!;
              return [
                r.days,
                t(`salesPanel.life.${r.recency}` as DictionaryKey),
              ];
            },
          }}
        />
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}

/* 10 · Clientes */
export function CustomersTab({ c }: { c: TabContext }) {
  const { t, f } = c;
  const list = customersOf(c.rows, c.today);
  return (
    <>
      <p className="mb-3 text-xs text-zinc-600">
        {t("salesPanel.customers.note")}
      </p>
      <div className="mb-4">
        <Card dense title={t("salesPanel.chart.customersPieces")}>
          <Bars
            items={list.map((x) => ({
              label: c.customerName.get(x.customerId) ?? x.customerId,
              value: x.pieces,
            }))}
            format={f.int}
            empty={t("salesPanel.empty")}
          />
        </Card>
      </div>
      {list.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("salesPanel.col.customer")}</Th>
              <Th>{t("salesPanel.col.pieces")}</Th>
              <Th>{t("salesPanel.col.skus")}</Th>
              <Th>{t("salesPanel.col.orders")}</Th>
              <Th>{t("salesPanel.col.last")}</Th>
              <Th>{t("salesPanel.col.days")}</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr
                key={x.customerId}
                className={rowClass}
                data-panel-customer={x.customerId}
              >
                <Td>
                  <TextLink href={`/app/portfolio/${x.customerId}`}>
                    {c.customerName.get(x.customerId) ?? x.customerId}
                  </TextLink>
                </Td>
                <Td>{f.int(x.pieces)}</Td>
                <Td>{x.skus}</Td>
                <Td>{x.orders}</Td>
                <Td>{f.day(x.lastOrderDate)}</Td>
                <Td>{x.daysWithoutPurchase ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}

/* 11 · Diagnóstico (cria a ação no plano) */
export function DiagnosisTab({ c }: { c: TabContext }) {
  const { t, f, data, params } = c;
  const focus: DiagnosisFocus = (DIAGNOSIS_FOCUS as readonly string[]).includes(
    params.focus,
  )
    ? (params.focus as DiagnosisFocus)
    : "leaders";
  const list = diagnosis(c.totals, focus, c.today, data.scope.kind === "group");
  const scopeQuery =
    data.scope.kind === "group"
      ? `newGroup=${data.scope.id}`
      : `customer=${data.scope.id}`;
  return (
    <>
      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        action="/app/portfolio/panel"
      >
        <Hidden params={params} except={["focus"]} />
        <Field label={t("salesPanel.diag.focus")}>
          <Select name="focus" defaultValue={focus}>
            {DIAGNOSIS_FOCUS.map((k) => (
              <option key={k} value={k}>
                {t(`salesPanel.diag.focus.${k}` as DictionaryKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          {t("salesPanel.filter.apply")}
        </Button>
      </form>
      <p className="mb-1 text-xs text-zinc-600">{t("salesPanel.diag.note")}</p>
      <p className="mb-3 text-xs font-semibold text-zinc-700">
        {t("salesPanel.diag.count", { n: list.length })}
      </p>
      {list.length ? (
        <div
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          data-panel-diagnosis
        >
          {list.slice(0, 18).map((p) => {
            const k = p.focus;
            const title = t(`salesPanel.diag.${k}.title` as DictionaryKey);
            const prompt = t(`salesPanel.diag.${k}.prompt` as DictionaryKey);
            const action = t(`salesPanel.diag.${k}.action` as DictionaryKey);
            const evidence = t(
              `salesPanel.diag.${k}.evidence` as DictionaryKey,
            );
            const inPlan = c.plan?.get(p.code);
            const href = `/app/portfolio/plan?new=1&${scopeQuery}&${new URLSearchParams(
              {
                title: `${title}: ${p.sku ?? p.code}`,
                description: `${prompt}\n${t("salesPanel.diag.action")}: ${action}\n${t("salesPanel.diag.evidence")}: ${evidence}`,
                product: p.code,
                productName: p.name,
                focus: k,
              },
            ).toString()}#new`;
            return (
              <article
                key={p.code}
                className="rounded-xl border border-zinc-200 bg-white p-3 text-sm"
                data-panel-card={p.code}
              >
                <p className="text-xs text-zinc-500">
                  {p.sku ?? p.code} · {p.group}
                </p>
                <h3 className="mt-0.5 font-semibold text-zinc-900">{title}</h3>
                <p className="text-xs text-zinc-700">{p.name}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {t("salesPanel.diag.line", {
                    pieces: f.int(p.pieces),
                    customers: p.customers.size,
                    date: f.day(p.lastOrderDate),
                  })}
                </p>
                <p className="mt-2 italic text-zinc-800">{prompt}</p>
                <p className="mt-1 text-xs">
                  <b>{t("salesPanel.diag.action")}:</b> {action}
                  <br />
                  <b>{t("salesPanel.diag.evidence")}:</b> {evidence}
                </p>
                <p className="mt-2 text-xs">
                  {inPlan ? (
                    <TextLink href={`/app/portfolio/plan/${inPlan.id}`}>
                      {t("salesPanel.diag.inPlan", {
                        status: t(
                          `tradePlan.status.${inPlan.status}` as DictionaryKey,
                        ),
                      })}
                    </TextLink>
                  ) : data.canManage ? (
                    <TextLink href={href} data-panel-create>
                      {t("salesPanel.diag.create")}
                    </TextLink>
                  ) : null}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty>{t("salesPanel.empty")}</Empty>
      )}
    </>
  );
}
