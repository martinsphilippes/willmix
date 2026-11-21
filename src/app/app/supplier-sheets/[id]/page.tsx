import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { supplierSheetView } from "@/lib/services/supplier-sheets";
import { baselineFromProduct } from "@/lib/supplier-sheet";
import { materialCatalog } from "@/lib/services/materials";
import { materialsText } from "@/lib/materials";
import type {
  SupplierSheetBaseline,
  SupplierSheetData,
  SupplierSheetField,
} from "@/lib/db/schema";
import {
  Alert,
  Badge,
  Card,
  Field,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { reviewSupplierSheetAction } from "../../actions/supplier-sheets";

/*
 * Uma ficha técnica de fornecedor (dono, 20/11/2026; docs/PURCHASE_DEMAND.md,
 * "Ficha técnica na cotação"): o nosso cadastro ao lado do que ele
 * informou, campo a campo, e a revisão do Cadastro (aceitar ou recusar a
 * correção). Nada aqui muda o cadastro do produto nem o Sankhya.
 */

type Row = {
  key: string;
  label: DictionaryKey;
  fields: SupplierSheetField[];
};

const ROWS: Row[] = [
  {
    key: "masterBoxQty",
    label: "supplierSheet.field.masterBoxQty",
    fields: ["masterBoxQty"],
  },
  {
    key: "innerBoxQty",
    label: "supplierSheet.field.innerBoxQty",
    fields: ["innerBoxQty"],
  },
  {
    key: "dims",
    label: "supplierSheet.board.col.dims",
    fields: ["boxLengthCm", "boxWidthCm", "boxHeightCm"],
  },
  { key: "cbm", label: "supplierSheet.field.cbm", fields: ["cbm"] },
  {
    key: "netWeightKg",
    label: "supplierSheet.field.netWeightKg",
    fields: ["netWeightKg"],
  },
  {
    key: "grossWeightBoxKg",
    label: "supplierSheet.field.grossWeightBoxKg",
    fields: ["grossWeightBoxKg"],
  },
  {
    key: "material",
    label: "supplierSheet.field.material",
    fields: ["material"],
  },
  {
    key: "factoryItemCode",
    label: "supplierSheet.field.factoryItemCode",
    fields: ["factoryItemCode"],
  },
];

export default async function SupplierSheetPage({
  params,
  searchParams,
}: PageProps<"/app/supplier-sheets/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getT();
  const [view, catalog] = await Promise.all([
    supplierSheetView(user, id),
    // Os materiais da ficha pelo nome no idioma de quem lê (21/11/2026).
    materialCatalog(),
  ]);
  if (!view) notFound();
  const { sheet, product, supplier, quote, canReview } = view;
  const errorCode = typeof sp.error === "string" ? sp.error : "";
  const errorKey = `supplierSheet.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const reviewed =
    sp.reviewed === "accepted" || sp.reviewed === "rejected"
      ? sp.reviewed
      : null;
  const n = (v: number, digits = 3) =>
    v.toLocaleString(t.intl, { maximumFractionDigits: digits });
  // O que tínhamos: o gravado quando ele confirmou (quem já vendia) ou, para
  // a ficha informada em branco, o cadastro de hoje (só para comparar).
  const ours: SupplierSheetBaseline | null =
    sheet.baseline ?? (product ? baselineFromProduct(product) : null);
  const valueOf = (
    v: SupplierSheetBaseline | SupplierSheetData | null,
    row: Row,
    theirs: boolean,
  ): string => {
    if (!v) return "—";
    if (row.key === "dims")
      return v.boxLengthCm !== null &&
        v.boxWidthCm !== null &&
        v.boxHeightCm !== null
        ? `${n(v.boxLengthCm, 2)} × ${n(v.boxWidthCm, 2)} × ${n(v.boxHeightCm, 2)}`
        : "—";
    if (row.key === "innerBoxQty")
      return v.innerBoxQty === null
        ? "—"
        : v.innerBoxQty === 0
          ? t("supplierSheet.noInner")
          : n(v.innerBoxQty, 0);
    if (row.key === "factoryItemCode")
      return v.factoryItemCode ?? (theirs ? t("supplierSheet.noCode") : "—");
    // "Sem peso" declarado e o material do catálogo (dono, 21/11/2026): a
    // ficha antiga, de texto livre, fica marcada para revisar.
    if (theirs && row.key === "grossWeightBoxKg" && v.grossWeightBoxKg === null)
      return (v as SupplierSheetData).grossWeightUnknown
        ? t("quote.sheet.grossUnknownDeclared")
        : "—";
    if (theirs && row.key === "material") {
      const d = v as SupplierSheetData;
      if (d.materialIds?.length)
        return materialsText(d.materialIds, catalog, t.intl) || d.material;
      return d.material
        ? `${d.material} (${t("quote.material.outside")})`
        : "—";
    }
    const raw = v[row.fields[0]];
    if (raw === null || raw === undefined) return "—";
    if (typeof raw === "number")
      return n(raw, row.key === "cbm" ? 4 : row.key === "masterBoxQty" ? 0 : 3);
    return raw;
  };
  const changed = new Set(sheet.changedFields ?? []);
  return (
    <div
      data-supplier-sheet={sheet.id}
      data-supplier-sheet-review={sheet.review ?? ""}
    >
      <PageHeader
        t={t}
        title={t("supplierSheet.view.title", {
          product: product ? productNameText(t, product.name) : sheet.productId,
        })}
        subtitle={t("supplierSheet.view.subtitle", {
          supplier: supplier?.name ?? sheet.supplierId,
          kind: t(`supplierSheet.kind.${sheet.kind}`),
          date: formatDate(sheet.confirmedAt, t),
        })}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {reviewed ? (
        <div
          className="mb-3"
          role="status"
          data-supplier-sheet-notice={reviewed}
        >
          <Alert tone="success">{t(`supplierSheet.notice.${reviewed}`)}</Alert>
        </div>
      ) : null}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
          <Badge tone="neutral">
            {sheet.soldBefore
              ? t("supplierSheet.view.soldBefore")
              : t("supplierSheet.view.firstTime")}
          </Badge>
          {quote ? (
            <Link
              href={`/app/purchase-quotes/${quote.id}`}
              className={linkClass}
              data-supplier-sheet-quote
            >
              {t("supplierSheet.view.source.quote", { n: quote.number })}
            </Link>
          ) : sheet.orderId ? (
            <Link
              href={`/app/orders/${sheet.orderId}/purchase-sheet`}
              className={linkClass}
            >
              {t("supplierSheet.view.source.purchase_sheet")}
            </Link>
          ) : null}
          {sheet.review ? (
            <Badge
              tone={
                sheet.review === "pending"
                  ? "warning"
                  : sheet.review === "accepted"
                    ? "success"
                    : "neutral"
              }
            >
              {sheet.reviewedAt
                ? t("supplierSheet.view.reviewed", {
                    review: t(`supplierSheet.review.${sheet.review}`),
                    date: formatDate(sheet.reviewedAt, t),
                  })
                : t(`supplierSheet.review.${sheet.review}`)}
            </Badge>
          ) : null}
        </div>
        {sheet.reviewNote ? (
          <p className="mb-3 text-sm text-zinc-700" data-supplier-sheet-note>
            {sheet.reviewNote}
          </p>
        ) : null}
        <Table tools={false}>
          <thead>
            <tr>
              <Th>{t("supplierSheet.view.col.field")}</Th>
              <Th>{t("supplierSheet.view.col.ours")}</Th>
              <Th>{t("supplierSheet.view.col.theirs")}</Th>
              <Th>
                <span className="sr-only">
                  {t("supplierSheet.view.changed")}
                </span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const mine = valueOf(ours, row, false);
              const theirs = valueOf(sheet.data, row, true);
              const isChanged = row.fields.some((f) => changed.has(f));
              const filled = !isChanged && mine === "—" && theirs !== "—";
              return (
                <tr
                  key={row.key}
                  className={rowClass}
                  data-supplier-sheet-field={row.key}
                  data-changed={isChanged ? "true" : undefined}
                >
                  <Td className="font-medium">{t(row.label)}</Td>
                  <Td className="tabular-nums">{mine}</Td>
                  <Td
                    className={
                      isChanged
                        ? "tabular-nums font-semibold text-amber-900"
                        : "tabular-nums"
                    }
                  >
                    {theirs}
                  </Td>
                  <Td>
                    {isChanged ? (
                      <Badge tone="warning">
                        {t("supplierSheet.view.changed")}
                      </Badge>
                    ) : filled ? (
                      <Badge tone="neutral">
                        {t("supplierSheet.view.filled")}
                      </Badge>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="mt-3">
          <p className="text-sm font-medium text-zinc-900">
            {t("supplierSheet.view.photo")}
          </p>
          {sheet.scalePhotoDocumentId ? (
            <a
              href={`/api/files/${sheet.scalePhotoDocumentId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block overflow-hidden rounded-lg border border-zinc-200"
              data-supplier-sheet-photo
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
              <img
                src={`/api/files/${sheet.scalePhotoDocumentId}`}
                alt={t("supplierSheet.view.photo")}
                className="h-24 w-24 object-cover"
              />
            </a>
          ) : (
            <p className="text-sm text-zinc-600">
              {t("supplierSheet.view.noPhoto")}
            </p>
          )}
        </div>
      </Card>
      {canReview ? (
        <Card>
          <p className="mb-3 text-sm text-zinc-700">
            {t("supplierSheet.view.noSankhya")}
          </p>
          <form
            action={reviewSupplierSheetAction}
            className="space-y-2"
            data-supplier-sheet-review-form
          >
            <input type="hidden" name="sheetId" value={sheet.id} />
            <Field label={t("supplierSheet.rejectNote")}>
              <Textarea name="note" rows={2} maxLength={2000} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                name="decision"
                value="accept"
                data-supplier-sheet-accept
              >
                {t("supplierSheet.accept")}
              </SubmitButton>
              <SubmitButton
                name="decision"
                value="reject"
                variant="secondary"
                data-supplier-sheet-reject
              >
                {t("supplierSheet.reject")}
              </SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}
      <p className="mt-3 text-xs">
        <Link href="/app/supplier-sheets" className={linkClass}>
          {t("supplierSheet.openList")}
        </Link>
      </p>
    </div>
  );
}
