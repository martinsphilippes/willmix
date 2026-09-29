import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createRequestAction } from "../../actions";

export default async function NewRequestPage({
  searchParams,
}: PageProps<"/app/requests/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWellmix(user) || user.role === "customer")) redirect("/app");
  const { error, productId, quantity, scheduleId, customerId } =
    await searchParams;
  const t = await getT();
  const store = getStore();
  // Pré-preenchimento vindo da ficha do produto ou de uma programação de compra.
  const schedule =
    typeof scheduleId === "string"
      ? await store.get("purchase_schedules", scheduleId)
      : null;
  const presetProductId =
    schedule?.productId ?? (typeof productId === "string" ? productId : "");
  const presetQuantity =
    schedule?.quantity ?? (typeof quantity === "string" ? quantity : "");
  const presetCustomerId =
    schedule?.customerId ??
    (typeof customerId === "string" ? customerId : "");
  const [products, customers] = await Promise.all([
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    isWellmix(user)
      ? store.list("parties", {
          filter: { type: "customer", active: true },
          orderBy: "name",
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        help={{
          body: "help.requests.new.body",
          steps: "help.requests.new.steps",
        }}
        t={t}
        title={t("requests.new")}
      />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <Card className="mt-4 max-w-2xl">
        <form action={createRequestAction} className="space-y-4">
          {schedule ? (
            <input type="hidden" name="scheduleId" value={schedule.id} />
          ) : null}
          {isWellmix(user) ? (
            <Field label={t("common.customer")}>
              <Select
                name="customerId"
                required
                defaultValue={presetCustomerId}
              >
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label={t("common.product")} hint={t("requests.specification")}>
            <Select name="productId" defaultValue={presetProductId}>
              <option value="">{t("common.select")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {/* Sourcing sob demanda: produto fora do catálogo (só faz sentido sem produto selecionado). */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <input
              type="checkbox"
              name="sourcingDemand"
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-800">
                {t("requests.sourcingDemand.label")}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                {t("requests.sourcingDemand.hint")}
              </span>
            </span>
          </label>
          <Field label={`${t("common.product")} (${t("common.name")})`}>
            <Input name="productName" placeholder="Ex.: Jarra de vidro 1,5 L" />
          </Field>
          <Field label={t("requests.description")}>
            <Textarea name="description" required minLength={2} />
          </Field>
          <Field label={t("requests.specification")}>
            <Textarea name="specification" />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t("common.quantity")}>
              <Input
                name="quantity"
                type="number"
                min="0.01"
                step="any"
                required
                defaultValue={presetQuantity}
              />
            </Field>
            <Field label={t("requests.unit")}>
              <Input name="unit" defaultValue="un" required />
            </Field>
            <div className="col-span-2 sm:col-span-1">
              <Field label={t("requests.deadline")}>
                <Input name="deadline" type="date" />
              </Field>
            </div>
          </div>
          <Field label={t("requests.attachments")}>
            <Input name="attachments" type="file" multiple />
          </Field>
          <Field label={t("common.note")}>
            <Textarea name="notes" />
          </Field>
          <div className="border-t border-zinc-100 pt-4">
            <SubmitButton pendingText="...">{t("common.send")}</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
