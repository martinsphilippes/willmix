import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWillmix } from "@/lib/auth/permissions";
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
  if (!(isWillmix(user) || user.role === "customer")) redirect("/app");
  const { error } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [products, customers] = await Promise.all([
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    isWillmix(user)
      ? store.list("parties", {
          filter: { type: "customer", active: true },
          orderBy: "name",
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title={t("requests.new")} />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <Card className="mt-4 max-w-2xl">
        <form action={createRequestAction} className="space-y-4">
          {isWillmix(user) ? (
            <Field label={t("common.customer")}>
              <Select name="customerId" required defaultValue="">
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
            <Select name="productId" defaultValue="">
              <option value="">{t("common.select")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </Select>
          </Field>
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
              />
            </Field>
            <Field label={t("requests.unit")}>
              <Input name="unit" defaultValue="un" required />
            </Field>
            <Field label={t("requests.deadline")}>
              <Input name="deadline" type="date" />
            </Field>
          </div>
          <Field label={t("requests.attachments")}>
            <Input name="attachments" type="file" multiple />
          </Field>
          <Field label={t("common.note")}>
            <Textarea name="notes" />
          </Field>
          <SubmitButton pendingText="...">{t("common.send")}</SubmitButton>
        </form>
      </Card>
    </>
  );
}
