import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { Alert, PageHeader, TextLink, formatDate } from "@/components/ui";
import { ItemForm, type ItemPreset } from "../../_components/item-form";
import { errorMessage } from "../../_components/shared";

export default async function NewSourcingItemPage({
  searchParams,
}: PageProps<"/app/sourcing/items/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error, visitId } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [suppliers, lines, visit] = await Promise.all([
    store.list("parties", { filter: { type: "supplier" }, orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
    typeof visitId === "string" && visitId
      ? store.get("supplier_visits", visitId)
      : Promise.resolve(null),
  ]);
  // Item nascido de uma visita herda fornecedor, cidade, local e data.
  const preset: ItemPreset | undefined = visit
    ? {
        visitId: visit.id,
        supplierId: visit.supplierId,
        supplierName: visit.supplierName,
        city: visit.city,
        location: visit.location,
        foundAt: visit.visitedAt,
      }
    : undefined;
  const errorText = errorMessage(t, error);
  return (
    <>
      <PageHeader
        help={{
          body: "help.sourcing.itemNew.body",
          steps: "help.sourcing.itemNew.steps",
        }}
        t={t}
        title={t("sourcing.newItem")}
        subtitle={
          visit ? (
            <span>
              {t("sourcing.item.visit")}:{" "}
              <TextLink href={`/app/sourcing/visits/${visit.id}`}>
                {visit.supplierName ?? visit.factoryName ?? visit.id}
              </TextLink>{" "}
              · {formatDate(visit.visitedAt, t)}
            </span>
          ) : undefined
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {/* Largura toda: num espaço largo as seções do formulário ficam duas a duas. */}
      <div className="min-w-0">
        <ItemForm t={t} suppliers={suppliers} lines={lines} preset={preset} />
      </div>
    </>
  );
}
