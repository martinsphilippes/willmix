import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertRole, isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { listTaxClassifications } from "@/lib/services/taxes";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { TaxSection } from "../../_components/tax-section";
import { catalogError } from "../../_components/shared";

/**
 * Classificação fiscal (NCM) de um produto: só esta seção, acessível à Wellmix
 * e ao despachante (a ficha completa continua só Wellmix). O despachante vê o
 * contexto necessário para classificar (nome, linha, material, especificação),
 * sem preço, fornecedor nem cliente.
 */
export default async function ProductTaxPage({
  params,
  searchParams,
}: PageProps<"/app/products/[id]/tax">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertRole(user, ["admin", "operator", "broker"]);
  const { id } = await params;
  const { error } = await searchParams;
  const store = getStore();
  const product = await store.get("products", id);
  if (!product) notFound();
  const t = await getT();
  const [rows, users, line] = await Promise.all([
    listTaxClassifications(id),
    store.list("users"),
    store.get("product_lines", product.lineId),
  ]);
  const errorText = catalogError(t, error);

  return (
    <>
      <PageHeader
        help={{
          body: "help.catalog.tax.body",
          steps: "help.catalog.tax.steps",
        }}
        t={t}
        title={product.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t("catalog.tax.subtitle")}</span>
            {product.sku ? (
              <span className="font-mono text-xs text-zinc-700">
                {product.sku}
              </span>
            ) : null}
            {line ? <Badge>{line.name}</Badge> : null}
          </span>
        }
        actions={
          isWellmix(user) ? (
            <LinkButton href={`/app/products/${product.id}`}>
              {t("catalog.tax.backToProduct")}
            </LinkButton>
          ) : (
            <LinkButton href="/app">{t("common.back")}</LinkButton>
          )
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("catalog.tax.title")} className="lg:col-span-2">
          <TaxSection
            product={product}
            rows={rows}
            users={users}
            user={user}
            t={t}
            back="tax"
          />
        </Card>
        <Card title={t("common.product")}>
          <DescriptionList
            items={[
              [t("common.name"), product.name],
              ["SKU", product.sku ?? "—"],
              [t("catalog.line"), line?.name ?? "—"],
              [t("catalog.category"), product.category ?? "—"],
              [t("catalog.material"), product.material ?? "—"],
              [t("catalog.color"), product.color ?? "—"],
              [
                t("catalog.netWeight"),
                product.netWeightKg !== null
                  ? `${product.netWeightKg} kg`
                  : "—",
              ],
              [
                t("catalog.dimensions"),
                [product.lengthCm, product.widthCm, product.heightCm].some(
                  (v) => v !== null,
                )
                  ? `${product.lengthCm ?? "—"} × ${product.widthCm ?? "—"} × ${product.heightCm ?? "—"}`
                  : "—",
              ],
            ]}
          />
          {product.specification ? (
            <div className="mt-3 border-t border-zinc-100 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("requests.specification")}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">
                {product.specification}
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
