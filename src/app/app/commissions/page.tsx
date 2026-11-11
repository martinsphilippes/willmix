import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore, type CommissionEntry } from "@/lib/db";
import { COMMISSION_ENTRY_STATUSES } from "@/lib/db/schema";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import {
  COMMISSION_EVENTS,
  type CommissionEvent,
  type CommissionResult,
  type MemoryLine,
  type Operation,
  type ReplacedRule,
} from "@/lib/commission";
import { partnerTypeName } from "@/lib/partner-types";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";
import {
  buildOperation,
  findParty,
  listAgreements,
  listEntries,
  listPayments,
  orderByNumber,
  simulate,
} from "@/lib/services/commissions";
import {
  accrueOrderAction,
  approveEntriesAction,
  settleEntriesAction,
} from "../actions/commissions";
import { CommissionMemory, fmtMoney } from "./_components/memory";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  cx,
  rowClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * Gestão → Acordos e comissões (docs/COMMISSIONS.md): acordos, lançamentos
 * (apuração e aprovação), extrato por beneficiário com a liquidação e o
 * simulador. Só o administrador.
 */

const BASE = "/app/commissions";
const TABS = ["agreements", "entries", "statement", "simulator"] as const;
type Tab = (typeof TABS)[number];

const AGREEMENT_TONE: Record<string, Tone> = {
  draft: "neutral",
  active: "success",
  suspended: "warning",
  ended: "neutral",
};
const ENTRY_TONE: Record<string, Tone> = {
  estimated: "neutral",
  eligible: "info",
  approved: "brand",
  partially_paid: "warning",
  paid: "success",
  reversed: "danger",
};

const tabClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

interface Memory {
  lines?: MemoryLine[];
  replaced?: ReplacedRule[];
  pending?: string[];
}

export default async function CommissionsPage({
  searchParams,
}: PageProps<"/app/commissions">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "finance");
  const t = await getT();
  if (!isAdmin(user))
    return (
      <>
        <PageHeader t={t} title={t("commission.title")} />
        <Alert tone="info">{t("commission.adminOnly")}</Alert>
      </>
    );
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const many = (key: string) => {
    const v = query[key];
    return (Array.isArray(v) ? v : v ? [v] : []).filter(
      (x): x is string => typeof x === "string",
    );
  };
  const tab: Tab = (TABS as readonly string[]).includes(one("tab"))
    ? (one("tab") as Tab)
    : "agreements";
  const store = getStore();
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(t.intl) : "—";

  const error = one("error");
  const errorKey = `commission.error.${error}`;
  const [savedKind, ...savedArgs] = one("saved").split(":");
  const savedText = !one("saved")
    ? null
    : savedKind === "accrue"
      ? t("commission.saved.accrue", {
          created: savedArgs[0] ?? 0,
          updated: savedArgs[1] ?? 0,
          adjusted: savedArgs[2] ?? 0,
        })
      : savedKind === "approve"
        ? t("commission.saved.approve", { n: savedArgs[0] ?? 0 })
        : savedKind === "settle"
          ? t("commission.saved.settle", { n: savedArgs[0] ?? "" })
          : t("commission.saved");

  /* ------------------------------- Acordos ------------------------------- */
  const agreements =
    tab === "agreements" || tab === "simulator"
      ? await listAgreements(user)
      : [];
  const catalog = await getPartnerTypeCatalog();
  const typeLabel = (value: string | null) => {
    if (!value) return "—";
    const entry = catalog.find((e) => e.value === value);
    return entry
      ? partnerTypeName(entry, t.locale)
      : value === "customer" || value === "supplier"
        ? t(`party.${value}`)
        : value;
  };
  const beneficiaryIds = [
    ...new Set(
      agreements
        .map((a) => a.beneficiaryPartyId)
        .filter((x): x is string => !!x),
    ),
  ];
  const beneficiaryParties = beneficiaryIds.length
    ? await store.list("parties", { filter: { id: beneficiaryIds } })
    : [];

  /* ----------------------------- Lançamentos ----------------------------- */
  const allEntries =
    tab === "entries" || tab === "statement" ? await listEntries(user) : [];
  const fStatus = one("status");
  const fWho = one("who").trim().toLowerCase();
  const fFrom = one("from");
  const fTo = one("to");
  const entries = allEntries.filter(
    (v) =>
      (!fStatus || v.entry.status === fStatus) &&
      (!fWho || (v.beneficiary?.name ?? "").toLowerCase().includes(fWho)) &&
      (!fFrom || v.entry.createdAt.slice(0, 10) >= fFrom) &&
      (!fTo || v.entry.createdAt.slice(0, 10) <= fTo),
  );
  const sum = (list: CommissionEntry[], pick: (e: CommissionEntry) => number) =>
    Math.round(list.reduce((s, e) => s + pick(e) * 100, 0)) / 100;
  const byCurrency = (list: CommissionEntry[]) =>
    [...new Set(list.map((e) => e.currency))]
      .map((c) =>
        fmtMoney(
          t,
          sum(
            list.filter((e) => e.currency === c && e.status !== "reversed"),
            (e) => e.amount,
          ),
          c,
        ),
      )
      .join(" · ") || "—";

  /* ------------------------------- Extrato ------------------------------- */
  const holders = [
    ...new Map(
      allEntries
        .filter((v) => v.beneficiary)
        .map((v) => [v.beneficiary!.id, v.beneficiary!]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const holder = holders.find((p) => p.id === one("party")) ?? holders[0];
  const own = holder
    ? allEntries.filter((v) => v.entry.beneficiaryPartyId === holder.id)
    : [];
  const payments =
    tab === "statement" && holder
      ? (await listPayments(user)).filter(
          (p) => p.beneficiaryPartyId === holder.id,
        )
      : [];
  const payable = own.filter((v) => v.payable !== 0);
  const totals = (currency: string) => {
    const list = own.map((v) => v.entry).filter((e) => e.currency === currency);
    const of = (statuses: string[]) =>
      list.filter((e) => statuses.includes(e.status));
    return {
      estimated: sum(of(["estimated"]), (e) => e.amount),
      eligible: sum(of(["eligible"]), (e) => e.amount),
      approved: sum(
        of(["approved", "partially_paid"]),
        (e) => e.released - e.paidAmount,
      ),
      paid: sum(list, (e) => e.paidAmount),
    };
  };

  /* ------------------------------ Simulador ------------------------------ */
  const lines =
    tab === "simulator"
      ? await store.list("product_lines", { orderBy: "name" })
      : [];
  let sim: CommissionResult | null = null;
  let simCurrency = "BRL";
  let simError = "";
  let simNames = new Map<string, string>();
  if (tab === "simulator" && one("run")) {
    try {
      let op: Operation;
      const orderNumber = Number(one("orderNumber"));
      if (orderNumber) {
        const order = await orderByNumber(orderNumber);
        if (!order) throw new Error("commission_order_unknown");
        op = await buildOperation(order);
      } else {
        const amount = (key: string) =>
          Number(one(key).replace(/\./g, "").replace(",", ".")) || 0;
        const type = one("type") || "carrier";
        const party = one("party") ? await findParty(one("party")) : null;
        const events = many("events").filter((e): e is CommissionEvent =>
          (COMMISSION_EVENTS as readonly string[]).includes(e),
        );
        const a = amount("sampleA");
        const b = amount("sampleB");
        op = {
          orderId: "exemplo",
          refDate: new Date().toISOString(),
          currency: one("currency") || "BRL",
          customerId: null,
          supplierId: null,
          items: [
            {
              id: "a",
              name: t("commission.sim.lineA"),
              lineId: one("lineA") || null,
              quantity: 1,
              amount: a,
            },
            {
              id: "b",
              name: t("commission.sim.lineB"),
              lineId: one("lineB") || null,
              quantity: 1,
              amount: b,
            },
          ].filter((i) => i.amount > 0),
          sellTotal: a + b,
          fobTotal: null,
          received: amount("received"),
          events: ["order_created", ...events],
          partiesByType: { [type]: party?.id ?? "exemplo" },
          cancelled: false,
        };
      }
      simCurrency = op.currency;
      sim = await simulate(user, op, one("draft") || null);
      const ids = [...new Set(sim.entries.map((e) => e.beneficiaryPartyId))];
      const found = ids.length
        ? await store.list("parties", { filter: { id: ids } })
        : [];
      simNames = new Map(found.map((p) => [p.id, p.name]));
    } catch (e) {
      simError = e instanceof Error ? e.message : "unexpected";
    }
  }
  const simErrorKey = `commission.error.${simError}`;

  return (
    <>
      <PageHeader
        t={t}
        title={t("commission.title")}
        subtitle={t("commission.subtitle")}
        actions={
          <LinkButton
            href={`${BASE}/agreements/new`}
            variant="primary"
            data-commission-new
          >
            + {t("commission.new")}
          </LinkButton>
        }
      />
      <div className="mb-3 space-y-2">
        {error ? (
          <Alert tone="danger">
            {errorKey in dictionaries.pt
              ? t(errorKey as DictionaryKey)
              : t("common.error")}
          </Alert>
        ) : null}
        {savedText ? (
          <div data-commission-saved>
            <Alert tone="success">{savedText}</Alert>
          </div>
        ) : null}
      </div>
      <nav className="mb-4 flex flex-wrap gap-2">
        {TABS.map((v) => (
          <Link
            key={v}
            href={`${BASE}?tab=${v}`}
            aria-current={tab === v ? "page" : undefined}
            className={tabClass(tab === v)}
            data-commission-tab={v}
          >
            {t(`commission.tab.${v}`)}
          </Link>
        ))}
      </nav>

      {tab === "agreements" ? (
        agreements.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("commission.col.number")}</Th>
                <Th>{t("commission.col.name")}</Th>
                <Th>{t("commission.col.beneficiary")}</Th>
                <Th>{t("commission.col.category")}</Th>
                <Th>{t("commission.col.validity")}</Th>
                <Th>{t("commission.col.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((a) => (
                <tr key={a.id} className={rowClass} data-agreement-row={a.id}>
                  <Td className="tabular-nums">
                    {a.number} · v{a.version}
                  </Td>
                  <Td>
                    <Link
                      href={`${BASE}/agreements/${a.id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {a.name}
                    </Link>
                  </Td>
                  <Td>
                    <span className="block max-w-72 whitespace-normal">
                      {a.beneficiaryPartyId
                        ? (beneficiaryParties.find(
                            (p) => p.id === a.beneficiaryPartyId,
                          )?.name ?? "—")
                        : t("commission.beneficiary.type", {
                            type: typeLabel(a.beneficiaryType),
                          })}
                    </span>
                  </Td>
                  <Td>{a.category}</Td>
                  <Td>
                    {!a.validFrom && !a.validTo
                      ? t("commission.validity.open")
                      : [
                          a.validFrom
                            ? t("commission.validity.from", {
                                from: date(a.validFrom),
                              })
                            : null,
                          a.validTo
                            ? t("commission.validity.until", {
                                to: date(a.validTo),
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                  </Td>
                  <Td>
                    <Badge tone={AGREEMENT_TONE[a.status]}>
                      {t(`commission.status.${a.status}`)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("commission.empty")}</Empty>
        )
      ) : null}

      {tab === "entries" ? (
        <div className="space-y-4">
          <Card title={t("commission.entries.accrue")}>
            <form
              action={accrueOrderAction}
              className="flex flex-wrap items-end gap-3"
              data-commission-accrue
            >
              <div className="basis-36">
                <Field label={t("commission.entries.orderNumber")}>
                  <Input name="orderNumber" inputMode="numeric" required />
                </Field>
              </div>
              <div className="min-w-0 flex-1 basis-72">
                <Field label={t("commission.entries.manualNote")}>
                  <Input name="manualNote" maxLength={500} />
                </Field>
              </div>
              <SubmitButton>{t("commission.entries.accrue")}</SubmitButton>
            </form>
          </Card>
          <Card>
            <form
              method="get"
              action={BASE}
              className="mb-3 flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="tab" value="entries" />
              <div className="basis-44">
                <Field label={t("commission.entries.filter.status")}>
                  <Select name="status" defaultValue={fStatus}>
                    <option value="">
                      {t("commission.entries.filter.all")}
                    </option>
                    {COMMISSION_ENTRY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`commission.entry.${s}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="basis-52">
                <Field label={t("commission.entries.filter.who")}>
                  <Input name="who" defaultValue={one("who")} />
                </Field>
              </div>
              <div className="basis-40">
                <Field label={t("commission.entries.filter.from")}>
                  <Input name="from" type="date" defaultValue={fFrom} />
                </Field>
              </div>
              <div className="basis-40">
                <Field label={t("commission.entries.filter.to")}>
                  <Input name="to" type="date" defaultValue={fTo} />
                </Field>
              </div>
              <Button type="submit" variant="secondary">
                {t("commission.entries.filter.apply")}
              </Button>
            </form>
            {entries.length ? (
              <form action={approveEntriesAction} data-commission-entries>
                <p className="mb-2 text-sm text-zinc-600">
                  {t("commission.entries.total", {
                    n: entries.length,
                    total: byCurrency(entries.map((v) => v.entry)),
                  })}
                </p>
                <Table>
                  <thead>
                    <tr>
                      <Th />
                      <Th>{t("commission.col.order")}</Th>
                      <Th>{t("commission.col.beneficiary")}</Th>
                      <Th>{t("commission.col.status")}</Th>
                      <Th>{t("commission.col.amount")}</Th>
                      <Th>{t("commission.col.released")}</Th>
                      <Th>{t("commission.col.paid")}</Th>
                      <Th>{t("commission.col.due")}</Th>
                      <Th>{t("commission.col.memory")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(({ entry: e, beneficiary, orderNumber }) => {
                      const memory = (e.memory ?? {}) as Memory;
                      return (
                        <tr
                          key={e.id}
                          className={rowClass}
                          data-commission-entry={e.status}
                        >
                          <Td>
                            {e.status === "eligible" ? (
                              <input
                                type="checkbox"
                                name="entries"
                                value={e.id}
                                defaultChecked
                                aria-label={t("commission.entries.approve")}
                                className="h-4 w-4 accent-brand-600"
                              />
                            ) : null}
                          </Td>
                          <Td className="tabular-nums">
                            <Link
                              href={`/app/orders/${e.orderId}`}
                              className="text-brand-700 underline"
                            >
                              {orderNumber ?? "—"}
                            </Link>
                          </Td>
                          <Td>
                            <span className="block max-w-56 whitespace-normal">
                              {beneficiary?.name ?? "—"}
                            </span>
                          </Td>
                          <Td>
                            <span className="flex flex-wrap gap-1">
                              <Badge tone={ENTRY_TONE[e.status]}>
                                {t(`commission.entry.${e.status}`)}
                              </Badge>
                              {e.kind === "adjustment" ? (
                                <Badge>{t("commission.kind.adjustment")}</Badge>
                              ) : null}
                            </span>
                            {e.note ? (
                              <span className="mt-0.5 block text-xs text-zinc-500">
                                {e.note}
                              </span>
                            ) : null}
                          </Td>
                          <Td className="whitespace-nowrap tabular-nums">
                            {fmtMoney(t, e.amount, e.currency)}
                          </Td>
                          <Td className="whitespace-nowrap tabular-nums">
                            {fmtMoney(t, e.released, e.currency)}
                          </Td>
                          <Td className="whitespace-nowrap tabular-nums">
                            {fmtMoney(t, e.paidAmount, e.currency)}
                          </Td>
                          <Td className="whitespace-nowrap">{date(e.dueAt)}</Td>
                          <Td>
                            <details>
                              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                                {t("commission.col.memory")}
                              </summary>
                              <div className="mt-2 min-w-80">
                                <CommissionMemory
                                  lines={memory.lines ?? []}
                                  replaced={memory.replaced ?? []}
                                  pending={memory.pending ?? []}
                                  currency={e.currency}
                                  t={t}
                                />
                              </div>
                            </details>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                {entries.some((v) => v.entry.status === "eligible") ? (
                  <div className="mt-3">
                    <SubmitButton data-commission-approve>
                      {t("commission.entries.approve")}
                    </SubmitButton>
                  </div>
                ) : null}
              </form>
            ) : (
              <Empty>{t("commission.entries.empty")}</Empty>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "statement" ? (
        holder ? (
          <div className="space-y-4">
            <Card>
              <form
                method="get"
                action={BASE}
                className="mb-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="tab" value="statement" />
                <div className="min-w-0 basis-80">
                  <Field label={t("commission.statement.pick")}>
                    <Select name="party" defaultValue={holder.id}>
                      {holders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button type="submit" variant="secondary">
                  {t("commission.entries.filter.apply")}
                </Button>
              </form>
              {[...new Set(own.map((v) => v.entry.currency))].map((c) => {
                const x = totals(c);
                return (
                  <dl
                    key={c}
                    className="grid gap-3 sm:grid-cols-4"
                    data-commission-totals={c}
                  >
                    {(
                      ["estimated", "eligible", "approved", "paid"] as const
                    ).map((k) => (
                      <div
                        key={k}
                        className="rounded-xl border border-zinc-200/80 p-3"
                      >
                        <dt className="text-xs text-zinc-500">
                          {t(`commission.statement.total.${k}`)}
                        </dt>
                        <dd
                          className="text-lg font-semibold tabular-nums text-zinc-900"
                          data-commission-total={k}
                        >
                          {fmtMoney(t, x[k], c)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                );
              })}
            </Card>
            <Card title={t("commission.statement.settle")}>
              {payable.length ? (
                <form
                  action={settleEntriesAction}
                  className="space-y-3"
                  data-commission-settle
                >
                  <input type="hidden" name="party" value={holder.id} />
                  <p className="text-sm text-zinc-600">
                    {t("commission.statement.settleHint")}
                  </p>
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t("commission.col.order")}</Th>
                        <Th>{t("commission.col.status")}</Th>
                        <Th>{t("commission.col.amount")}</Th>
                        <Th>{t("commission.col.paid")}</Th>
                        <Th>{t("commission.col.payable")}</Th>
                        <Th>{t("commission.statement.payNow")}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {payable.map(
                        ({ entry: e, orderNumber, payable: open }) => (
                          <tr key={e.id} className={rowClass}>
                            <Td className="tabular-nums">
                              <input
                                type="hidden"
                                name="entryId"
                                value={e.id}
                              />
                              {orderNumber ?? "—"}
                            </Td>
                            <Td>
                              <Badge tone={ENTRY_TONE[e.status]}>
                                {t(`commission.entry.${e.status}`)}
                              </Badge>
                            </Td>
                            <Td className="whitespace-nowrap tabular-nums">
                              {fmtMoney(t, e.amount, e.currency)}
                            </Td>
                            <Td className="whitespace-nowrap tabular-nums">
                              {fmtMoney(t, e.paidAmount, e.currency)}
                            </Td>
                            <Td className="whitespace-nowrap tabular-nums">
                              {fmtMoney(t, open, e.currency)}
                            </Td>
                            <Td>
                              <Input
                                name={`pay.${e.id}`}
                                inputMode="decimal"
                                className="w-32"
                                aria-label={t("commission.statement.payNow")}
                                data-commission-pay
                              />
                            </Td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </Table>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t("commission.statement.paidAt")}>
                      <Input
                        name="paidAt"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().slice(0, 10)}
                      />
                    </Field>
                    <Field label={t("commission.statement.reference")}>
                      <Input name="reference" maxLength={120} />
                    </Field>
                    <Field label={t("commission.statement.note")}>
                      <Input name="note" maxLength={500} />
                    </Field>
                  </div>
                  <SubmitButton data-commission-settle-submit>
                    {t("commission.statement.settle")}
                  </SubmitButton>
                </form>
              ) : (
                <Empty>{t("commission.statement.nothing")}</Empty>
              )}
            </Card>
            {payments.length ? (
              <Card title={t("commission.statement.payments")}>
                <ul className="divide-y divide-zinc-100 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="py-2" data-commission-payment>
                      {t("commission.statement.payment", {
                        n: p.number,
                        date: date(p.paidAt),
                        amount: fmtMoney(t, p.amount, p.currency),
                      })}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : (
          <Empty>{t("commission.statement.none")}</Empty>
        )
      ) : null}

      {tab === "simulator" ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card title={t("commission.tab.simulator")}>
            <form
              method="get"
              action={BASE}
              className="space-y-3"
              data-commission-sim
            >
              <input type="hidden" name="tab" value="simulator" />
              <input type="hidden" name="run" value="1" />
              <Field label={t("commission.sim.order")}>
                <Input
                  name="orderNumber"
                  inputMode="numeric"
                  defaultValue={one("orderNumber")}
                />
              </Field>
              <fieldset className="space-y-3 rounded-xl border border-zinc-200/80 p-3">
                <legend className="px-1 text-sm font-medium text-zinc-800">
                  {t("commission.sim.sample")}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["A", "B"] as const).map((k) => (
                    <div key={k} className="space-y-3">
                      <Field label={t(`commission.sim.line${k}`)}>
                        <Select
                          name={`line${k}`}
                          defaultValue={one(`line${k}`)}
                        >
                          <option value="">—</option>
                          {lines.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={t(`commission.sim.sample${k}`)}>
                        <Input
                          name={`sample${k}`}
                          inputMode="decimal"
                          defaultValue={one(`sample${k}`)}
                        />
                      </Field>
                    </div>
                  ))}
                  <Field label={t("commission.sim.type")}>
                    <Select name="type" defaultValue={one("type") || "carrier"}>
                      {catalog.map((e) => (
                        <option key={e.value} value={e.value}>
                          {partnerTypeName(e, t.locale)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("commission.sim.party")}>
                    <Input name="party" defaultValue={one("party")} />
                  </Field>
                  <Field label={t("commission.sim.received")}>
                    <Input
                      name="received"
                      inputMode="decimal"
                      defaultValue={one("received")}
                    />
                  </Field>
                  <Field label={t("commission.form.currency")}>
                    <Select
                      name="currency"
                      defaultValue={one("currency") || "BRL"}
                    >
                      {["BRL", "USD", "CNY"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-800">
                    {t("commission.sim.events")}
                  </p>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {COMMISSION_EVENTS.filter((e) => e !== "order_created").map(
                      (e) => (
                        <label
                          key={e}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="events"
                            value={e}
                            defaultChecked={many("events").includes(e)}
                            className="h-4 w-4 accent-brand-600"
                          />
                          {t(`commission.event.${e}`)}
                        </label>
                      ),
                    )}
                  </div>
                </div>
              </fieldset>
              <Field label={t("commission.sim.draft")}>
                <Select name="draft" defaultValue={one("draft")}>
                  <option value="">—</option>
                  {agreements
                    .filter((a) => a.status === "draft")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.number} · v{a.version} · {a.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Button type="submit" data-commission-sim-run>
                {t("commission.sim.run")}
              </Button>
              <p className="text-xs text-zinc-500">
                {t("commission.sim.hint")}
              </p>
            </form>
          </Card>
          {one("run") ? (
            <Card title={t("commission.form.section.review")}>
              {simError ? (
                <Alert tone="danger">
                  {simErrorKey in dictionaries.pt
                    ? t(simErrorKey as DictionaryKey)
                    : t("common.error")}
                </Alert>
              ) : sim && sim.entries.length ? (
                <div className="space-y-4" data-commission-sim-result>
                  {sim.entries.map((e) => (
                    <div
                      key={`${e.agreementId}:${e.beneficiaryPartyId}`}
                      className="rounded-xl border border-zinc-200/80 p-3"
                    >
                      <p className="mb-2 text-sm font-semibold text-zinc-900">
                        {simNames.get(e.beneficiaryPartyId) ??
                          t("commission.col.beneficiary")}{" "}
                        · {e.agreementName} · v{e.version}
                      </p>
                      <CommissionMemory
                        lines={e.lines}
                        replaced={[]}
                        pending={e.pending}
                        currency={simCurrency}
                        t={t}
                      />
                      <p className="mt-2 text-sm text-zinc-700">
                        {t("commission.sim.total", {
                          total: fmtMoney(t, e.amount, simCurrency),
                        })}{" "}
                        ·{" "}
                        {t("commission.sim.released", {
                          released: fmtMoney(t, e.released, simCurrency),
                        })}
                      </p>
                    </div>
                  ))}
                  <p
                    className="text-base font-semibold text-zinc-900"
                    data-commission-sim-total={
                      Math.round(
                        sim.entries.reduce((s, e) => s + e.amount * 100, 0),
                      ) / 100
                    }
                  >
                    {t("commission.sim.total", {
                      total: fmtMoney(
                        t,
                        Math.round(
                          sim.entries.reduce((s, e) => s + e.amount * 100, 0),
                        ) / 100,
                        simCurrency,
                      ),
                    })}
                  </p>
                  <CommissionMemory
                    lines={[]}
                    replaced={sim.replaced}
                    pending={[]}
                    currency={simCurrency}
                    t={t}
                  />
                </div>
              ) : (
                <Empty>{t("commission.sim.none")}</Empty>
              )}
              {sim ? (
                <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                  {sim.waiting.map((w, i) => (
                    <li key={`w${i}`}>
                      {t("commission.sim.waiting", {
                        event: t(`commission.event.${w.event}`),
                        agreement: w.agreementName,
                      })}
                    </li>
                  ))}
                  {sim.conflicts.map((c, i) => (
                    <li key={`c${i}`} className="text-amber-800">
                      {t("commission.sim.conflict", c)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
