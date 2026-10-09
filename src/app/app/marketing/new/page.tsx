import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton } from "@/components/submit-button";
import { createKitAction } from "../../actions/vision";
import { marketingError } from "../_components/shared";
import { MoneyInput } from "@/components/money-input";

/**
 * /app/marketing/new (Wellmix): cria o kit a partir de um produto ativo.
 * Cliente opcional (obrigatório para oferecer); preço e moeda com o padrão
 * das configurações, editáveis até a compra. O nome em branco é gerado pelo serviço.
 */
export default async function NewMarketingKitPage({
  searchParams,
}: PageProps<"/app/marketing/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isWellmix(user)) redirect("/app/marketing");
  const params = await searchParams;
  const presetProductId =
    typeof params.productId === "string" ? params.productId : "";
  const presetCustomerId =
    typeof params.customerId === "string" ? params.customerId : "";
  const t = await getT();
  const store = getStore();
  const [settings, products, customers] = await Promise.all([
    getSettings(),
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    store.list("parties", {
      filter: { type: "customer", active: true },
      orderBy: "name",
    }),
  ]);
  const errorText = marketingError(t, params.error);
  // Em caso de erro a ação volta para cá mantendo produto e cliente pré-selecionados.
  const backQuery = new URLSearchParams();
  if (presetProductId) backQuery.set("productId", presetProductId);
  if (presetCustomerId) backQuery.set("customerId", presetCustomerId);
  const back = `/app/marketing/new${backQuery.size ? `?${backQuery}` : ""}`;

  return (
    <>
      <PageHeader
        help={{
          body: "marketing.new.help.body",
          steps: "marketing.new.help.steps",
        }}
        t={t}
        title={t("marketing.new.title")}
        actions={
          <LinkButton href="/app/marketing">{t("common.back")}</LinkButton>
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {!settings.marketingEnabled ? (
        <div className="mt-4">
          <Alert tone="warning">{t("marketing.disabled")}</Alert>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-4">
          <Alert tone="warning">{t("marketing.new.noProducts")}</Alert>
        </div>
      ) : (
        <Card className="mt-4 max-w-2xl">
          <form action={createKitAction} className="space-y-4">
            <input type="hidden" name="back" value={back} />
            <Field label={t("marketing.new.product")}>
              <Select name="productId" required defaultValue={presetProductId}>
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("marketing.new.customer")}
              hint={t("marketing.new.customerHint")}
            >
              <Select name="customerId" defaultValue={presetCustomerId}>
                <option value="">{t("marketing.noCustomer")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("marketing.new.name")}
              hint={t("marketing.new.nameHint")}
            >
              <Input name="name" maxLength={160} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field
                  label={t("marketing.new.price")}
                  hint={t("marketing.new.priceHint")}
                >
                  <MoneyInput
                    locale={t.intl}
                    name="price"
                    watchField="currency"
                    required
                    defaultAmount={settings.marketingKitDefaultPrice}
                  />
                </Field>
              </div>
              <Field label={t("marketing.new.currency")}>
                <CurrencySelect
                  name="currency"
                  value={settings.marketingKitCurrency}
                  t={t}
                  required
                />
              </Field>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <SubmitButton
                pendingText="..."
                className="w-full py-2.5 sm:w-auto sm:py-2"
              >
                {t("marketing.new.submit")}
              </SubmitButton>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
