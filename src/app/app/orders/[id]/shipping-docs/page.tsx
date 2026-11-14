import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type ShippingDoc, type ShippingDocLine } from "@/lib/db";
import { linesTotals } from "@/lib/shipping-docs";
import { shippingDocsView } from "@/lib/services/shipping-docs";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import {
  addLoadAction,
  submitBlAction,
  submitInvoiceAction,
  submitPackingListAction,
} from "../../../actions/shipping-docs";

type T = Awaited<ReturnType<typeof getT>>;
type DocKind = "packing_list" | "invoice" | "bl";

/*
 * Documentos do embarque do pedido de compra (docs/SHIPPING_DOCS.md): check
 * list de carga, packing list, invoice e BL, na ordem do mapa. Abrem a
 * Wellmix, o fornecedor (e a trading, que entra como ele) e a marítima.
 */
export default async function ShippingDocsPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/shipping-docs">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "orders");
  const { id } = await params;
  const { error, done } = await searchParams;
  const view = await shippingDocsView(user, id);
  if (!view) notFound();
  const t = await getT();
  const { order, docs, load, open, can } = view;
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `shippingDocs.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const doneKey = `shippingDocs.done.${typeof done === "string" ? done : ""}`;
  const authors = new Map<string, string>();
  for (const d of Object.values(docs))
    if (d?.submittedByUserId && !authors.has(d.submittedByUserId)) {
      const u = await getStore()
        .get("users", d.submittedByUserId)
        .catch(() => null);
      authors.set(d.submittedByUserId, u?.name ?? "");
    }
  const sentBy = (d: ShippingDoc | null) =>
    d?.submittedAt ? (
      <p className="mt-2 text-xs text-zinc-500">
        {t("shippingDocs.sentBy", {
          name: authors.get(d.submittedByUserId ?? "") ?? "",
          date: formatDate(d.submittedAt, t),
        })}
        {d.number ? ` · ${d.number}` : ""}
        {d.containerNumber ? ` · ${d.containerNumber}` : ""}
      </p>
    ) : null;
  const statusOf = (kind: "load" | DocKind) => {
    const d = docs[kind];
    if (kind === "load")
      return view.loadDone ? "accepted" : open.load ? "draft" : "waiting";
    return d ? d.status : open[kind] ? "draft" : "waiting";
  };
  const badge = (kind: "load" | DocKind) => {
    const s = statusOf(kind);
    return (
      <Badge
        tone={
          s === "accepted" ? "success" : s === "rejected" ? "danger" : "neutral"
        }
      >
        <span data-shipping-status={s}>
          {t(`shippingDocs.status.${s}` as DictionaryKey)}
        </span>
      </Badge>
    );
  };

  return (
    <>
      <PageHeader
        t={t}
        title={t("shippingDocs.title", { n: String(order.number) })}
        subtitle={t("shippingDocs.subtitle")}
        actions={
          <Link href={`/app/orders/${order.id}`} className={linkClass}>
            {t("shippingDocs.back")}
          </Link>
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {t(doneKey as DictionaryKey) !== doneKey ? (
        <Alert tone="success">{t(doneKey as DictionaryKey)}</Alert>
      ) : null}

      <div id="load" data-shipping-doc="load">
        <Card title={t("shippingDocs.load.title")} actions={badge("load")}>
          <p className="mb-3 text-sm text-zinc-600">
            {view.loadDone
              ? t("shippingDocs.load.done")
              : open.load
                ? t("shippingDocs.load.hint")
                : t("shippingDocs.load.waiting")}
          </p>
          <form action={addLoadAction} data-shipping-load-form>
            <input type="hidden" name="orderId" value={order.id} />
            <Table tools={false}>
              <thead>
                <tr>
                  <Th>{t("shippingDocs.col.item")}</Th>
                  <Th className="text-right">
                    {t("shippingDocs.col.expected")}
                  </Th>
                  <Th className="text-right">{t("shippingDocs.col.loaded")}</Th>
                  <Th className="text-right">
                    {t("shippingDocs.col.remaining")}
                  </Th>
                  {can.load ? (
                    <Th className="text-right">{t("shippingDocs.col.add")}</Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {load.map((l) => (
                  <tr key={l.itemId} data-load-line={l.itemId}>
                    <Td>
                      {productNameText(t, l.name)}
                      {l.expected === null ? (
                        <span className="ml-1 text-xs text-amber-700">
                          ({t("shippingDocs.noBox")})
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right">{l.expected ?? "—"}</Td>
                    <Td className="text-right" data-load-loaded>
                      {l.loaded}
                    </Td>
                    <Td className="text-right font-medium" data-load-remaining>
                      {l.remaining ?? "—"}
                    </Td>
                    {can.load ? (
                      <Td className="text-right">
                        <input type="hidden" name="itemId" value={l.itemId} />
                        <Input
                          dense
                          type="number"
                          min={0}
                          max={l.remaining ?? undefined}
                          step={1}
                          name={`add_${l.itemId}`}
                          aria-label={t("shippingDocs.col.add")}
                          className="w-24 text-right"
                          disabled={l.remaining === 0}
                        />
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
            {can.load ? (
              <div className="mt-3">
                <SubmitButton>{t("shippingDocs.load.submit")}</SubmitButton>
              </div>
            ) : null}
          </form>
        </Card>
      </div>

      <DocCard
        t={t}
        kind="packing_list"
        orderId={order.id}
        doc={docs.packing_list}
        open={open.packing_list}
        can={can.packing_list}
        suggestion={view.suggestion}
        badge={badge("packing_list")}
        sentBy={sentBy(docs.packing_list)}
      />
      <DocCard
        t={t}
        kind="invoice"
        orderId={order.id}
        doc={docs.invoice}
        open={open.invoice}
        can={can.invoice}
        suggestion={view.suggestion}
        badge={badge("invoice")}
        sentBy={sentBy(docs.invoice)}
        currency={order.fobCurrency ?? null}
      />
      <DocCard
        t={t}
        kind="bl"
        orderId={order.id}
        doc={docs.bl}
        open={open.bl}
        can={can.bl}
        suggestion={view.suggestion}
        badge={badge("bl")}
        sentBy={sentBy(docs.bl)}
      />
    </>
  );
}

const TITLE: Record<DocKind, DictionaryKey> = {
  packing_list: "shippingDocs.packing.title",
  invoice: "shippingDocs.invoice.title",
  bl: "shippingDocs.bl.title",
};
const HINT: Record<DocKind, DictionaryKey> = {
  packing_list: "shippingDocs.packing.hint",
  invoice: "shippingDocs.invoice.hint",
  bl: "shippingDocs.bl.hint",
};
const SUBMIT: Record<DocKind, DictionaryKey> = {
  packing_list: "shippingDocs.packing.submit",
  invoice: "shippingDocs.invoice.submit",
  bl: "shippingDocs.bl.submit",
};
const ACTION = {
  packing_list: submitPackingListAction,
  invoice: submitInvoiceAction,
  bl: submitBlAction,
} as const;

function DocCard({
  t,
  kind,
  orderId,
  doc,
  open,
  can,
  suggestion,
  badge,
  sentBy,
  currency,
}: {
  t: T;
  kind: DocKind;
  orderId: string;
  doc: ShippingDoc | null;
  open: boolean;
  can: boolean;
  suggestion: ShippingDocLine[];
  badge: React.ReactNode;
  sentBy: React.ReactNode;
  currency?: string | null;
}) {
  // Refazendo (ou ainda por fazer): o formulário vem com o último envio ou com o documento anterior.
  const lines = can
    ? doc?.lines.length
      ? doc.lines
      : suggestion
    : (doc?.lines ?? []);
  const name = (itemId: string) =>
    suggestion.find((s) => s.itemId === itemId)?.name ??
    lines.find((s) => s.itemId === itemId)?.name ??
    itemId;
  const withPrice = kind === "invoice";
  const totals = linesTotals(lines);
  const cell = (
    l: ShippingDocLine,
    field: "cartons" | "pieces" | "netKg" | "grossKg" | "unitPrice",
    readOnly = false,
  ) => {
    const value = l[field];
    if (!can || readOnly)
      return (
        <>
          {value ?? "—"}
          {readOnly && can ? (
            <input
              type="hidden"
              name={`${field}_${l.itemId}`}
              value={value ?? ""}
            />
          ) : null}
        </>
      );
    return (
      <Input
        dense
        type="number"
        min={0}
        step={field === "cartons" || field === "pieces" ? 1 : 0.01}
        name={`${field}_${l.itemId}`}
        defaultValue={value ?? ""}
        aria-label={t(`shippingDocs.col.${field}` as DictionaryKey)}
        className="w-28 text-right"
        required={field !== "unitPrice"}
      />
    );
  };
  return (
    <div id={kind} data-shipping-doc={kind}>
      <Card title={t(TITLE[kind])} actions={badge}>
        <p className="mb-3 text-sm text-zinc-600">
          {open || doc ? t(HINT[kind]) : t("shippingDocs.waitPrevious")}
        </p>
        {doc?.status === "rejected" && doc.mismatches?.length ? (
          <Alert tone="danger">
            <p className="font-medium">{t("shippingDocs.mismatch.title")}</p>
            <ul className="mt-1 list-disc pl-5" data-shipping-mismatches>
              {doc.mismatches.map((m, i) => (
                <li key={i}>
                  {t("shippingDocs.mismatch.row", {
                    item: productNameText(t, name(m.itemId)),
                    field: t(`shippingDocs.field.${m.field}` as DictionaryKey),
                    expected: String(m.expected ?? "—"),
                    found: String(m.found ?? "—"),
                  })}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {lines.length ? (
          <form
            action={ACTION[kind]}
            className="space-y-3"
            data-shipping-form={kind}
          >
            <input type="hidden" name="orderId" value={orderId} />
            <Table tools={false}>
              <thead>
                <tr>
                  <Th>{t("shippingDocs.col.item")}</Th>
                  <Th className="text-right">
                    {t("shippingDocs.col.cartons")}
                  </Th>
                  <Th className="text-right">{t("shippingDocs.col.pieces")}</Th>
                  <Th className="text-right">{t("shippingDocs.col.netKg")}</Th>
                  <Th className="text-right">
                    {t("shippingDocs.col.grossKg")}
                  </Th>
                  {withPrice ? (
                    <Th className="text-right">
                      {t("shippingDocs.col.unitPrice")}
                      {currency ? ` (${currency})` : ""}
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.itemId} data-doc-line={l.itemId}>
                    <Td>
                      {can ? (
                        <input type="hidden" name="itemId" value={l.itemId} />
                      ) : null}
                      {productNameText(t, name(l.itemId))}
                    </Td>
                    <Td className="text-right">
                      {/* No packing list as caixas são as do check list. */}
                      {cell(l, "cartons", kind === "packing_list")}
                    </Td>
                    <Td className="text-right">{cell(l, "pieces")}</Td>
                    <Td className="text-right">{cell(l, "netKg")}</Td>
                    <Td className="text-right">{cell(l, "grossKg")}</Td>
                    {withPrice ? (
                      <Td className="text-right">{cell(l, "unitPrice")}</Td>
                    ) : null}
                  </tr>
                ))}
                {!can ? (
                  <tr>
                    <Td className="font-semibold">{t("shippingDocs.total")}</Td>
                    <Td className="text-right font-semibold">
                      {totals.cartons}
                    </Td>
                    <Td className="text-right font-semibold">
                      {totals.pieces}
                    </Td>
                    <Td className="text-right font-semibold">{totals.netKg}</Td>
                    <Td className="text-right font-semibold">
                      {totals.grossKg}
                    </Td>
                    {withPrice ? <Td /> : null}
                  </tr>
                ) : null}
              </tbody>
            </Table>
            {can ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {kind !== "packing_list" ? (
                    <Field
                      label={t(
                        kind === "bl"
                          ? "shippingDocs.bl.number"
                          : "shippingDocs.invoice.number",
                      )}
                    >
                      <Input
                        name="number"
                        required
                        maxLength={80}
                        defaultValue={doc?.number ?? ""}
                      />
                    </Field>
                  ) : null}
                  {kind === "bl" ? (
                    <Field label={t("shippingDocs.bl.container")}>
                      <Input
                        name="containerNumber"
                        required
                        maxLength={20}
                        defaultValue={doc?.containerNumber ?? ""}
                      />
                    </Field>
                  ) : null}
                  {kind === "invoice" && currency ? (
                    <input type="hidden" name="currency" value={currency} />
                  ) : null}
                  <Field
                    label={t(
                      kind === "packing_list" || doc?.documentId
                        ? "shippingDocs.fileOptional"
                        : "shippingDocs.file",
                    )}
                  >
                    <Input
                      type="file"
                      name="file"
                      required={kind !== "packing_list" && !doc?.documentId}
                    />
                  </Field>
                </div>
                <SubmitButton>{t(SUBMIT[kind])}</SubmitButton>
              </>
            ) : null}
          </form>
        ) : null}
        {sentBy}
      </Card>
    </div>
  );
}
