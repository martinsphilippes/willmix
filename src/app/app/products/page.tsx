import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { SHEET_PHOTO_KINDS } from "@/lib/services/purchase-sheet";
import { missingForCompletion } from "@/lib/services/purchase-sheet-calc";
import { getT } from "@/i18n/server";
import { listLinksForProducts } from "@/lib/services/product-suppliers";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Textarea,
  Th,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveProductAction } from "../actions";

/** Origem do produto: manual, sourcing (visita na China) ou importação de planilha. */
const sourceTone = {
  manual: "neutral",
  sourcing: "brand",
  import: "info",
} as const;

export default async function ProductsPage({
  searchParams,
}: PageProps<"/app/products">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [products, lines, suppliers] = await Promise.all([
    store.list("products", { orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
    store.list("parties", { filter: { type: "supplier" } }),
  ]);
  // Ficha mestre de cada produto (uma consulta): completa, parcial ou sem ficha.
  const masters = products.length
    ? await store.list("purchase_sheets", {
        filter: { orderId: products.map((p) => p.id) },
      })
    : [];
  const masterState = (productId: string) => {
    const m = masters.find((x) => x.orderId === productId);
    if (!m) return "none" as const;
    const missing = missingForCompletion(m, SHEET_PHOTO_KINDS).filter(
      (k) => k !== "lot1" && k !== "productionStartAt",
    );
    return missing.length ? ("partial" as const) : ("complete" as const);
  };
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "—") : "—";
  // Outros fornecedores de cada produto (além do principal), numa consulta.
  const links = await listLinksForProducts(products.map((p) => p.id));
  const otherSuppliers = (p: { id: string; supplierId: string | null }) =>
    new Set(
      links
        .filter((l) => l.productId === p.id && l.supplierId !== p.supplierId)
        .map((l) => l.supplierId),
    ).size;

  return (
    <>
      <PageHeader
        help={{
          body: "help.products.body",
          steps: "help.catalog.products.steps",
        }}
        t={t}
        title={t("products.title")}
        actions={
          <LinkButton href="/app/import?entity=products">
            {t("parties.import")}
          </LinkButton>
        }
      />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {products.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.name")}</Th>
                  <Th>SKU</Th>
                  <Th>{t("nav.lines")}</Th>
                  <Th>{t("common.supplier")}</Th>
                  <Th className="text-right">{t("common.price")}</Th>
                  <Th className="text-right">{t("catalog.moq")}</Th>
                  <Th className="text-right">{t("catalog.cbmPerBox")}</Th>
                  <Th>{t("catalog.source")}</Th>
                  <Th>{t("productSheet.column")}</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className={rowClass}>
                    <Td className="font-medium">
                      <TextLink
                        href={`/app/products/${p.id}`}
                        className="text-zinc-900"
                        title={t("catalog.open")}
                      >
                        {p.name}
                      </TextLink>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-zinc-700">
                        {p.sku ?? "—"}
                      </span>
                    </Td>
                    <Td>{lines.find((l) => l.id === p.lineId)?.name ?? "—"}</Td>
                    <Td className="whitespace-nowrap">
                      {supplierName(p.supplierId)}
                      {otherSuppliers(p) ? (
                        <span
                          className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600"
                          title={t("productSuppliers.moreTitle", {
                            n: otherSuppliers(p),
                          })}
                        >
                          {t("productSuppliers.more", { n: otherSuppliers(p) })}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {p.price !== null
                        ? formatMoney(p.price, p.currency, t)
                        : "—"}
                    </Td>
                    <Td className="text-right tabular-nums">{p.moq ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {p.cbm !== null
                        ? `${p.cbm.toLocaleString(t.intl, { maximumFractionDigits: 4 })} m³`
                        : "—"}
                    </Td>
                    <Td>
                      {p.source ? (
                        <Badge tone={sourceTone[p.source]}>
                          {t(`catalog.source.${p.source}` as DictionaryKey)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      {masterState(p.id) === "complete" ? (
                        <Badge tone="success">
                          {t("productSheet.badge.complete")}
                        </Badge>
                      ) : masterState(p.id) === "partial" ? (
                        <Badge tone="warning">
                          {t("productSheet.badge.partial")}
                        </Badge>
                      ) : (
                        t("productSheet.badge.none")
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card title={`${t("common.new")} ${t("common.product").toLowerCase()}`}>
          <form action={saveProductAction} className="space-y-3">
            <Field label={t("common.name")}>
              <Input name="name" required />
            </Field>
            <Field label="SKU">
              <Input name="sku" />
            </Field>
            <Field label={t("nav.lines")}>
              <Select name="lineId" required defaultValue="">
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("requests.specification")}>
              <Textarea name="specification" />
            </Field>
            <SubmitButton>{t("common.save")}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
