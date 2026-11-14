import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { hiddenBookingProductIds } from "@/lib/services/booking-visibility";
import {
  hasCatalogProducts,
  productOptionLabel,
} from "@/lib/services/product-search";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import {
  partyPickerLabels,
  productPickerLabels,
} from "@/components/party-picker-labels";
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
  requireScreen(user, "marketing");
  if (!isWellmix(user)) redirect("/app/marketing");
  const params = await searchParams;
  const presetProductId =
    typeof params.productId === "string" ? params.productId : "";
  const presetCustomerId =
    typeof params.customerId === "string" ? params.customerId : "";
  const t = await getT();
  const store = getStore();
  // Produto e cliente são escolhidos por busca (~17 mil produtos e ~26 mil
  // clientes não cabem numa lista; a página saía com 12 MB). Aqui só o que
  // veio pré-escolhido no endereço.
  const [settings, hiddenByBooking, presetProduct, presetCustomer] =
    await Promise.all([
      getSettings(),
      hiddenBookingProductIds(),
      presetProductId ? store.get("products", presetProductId) : null,
      presetCustomerId ? store.get("parties", presetCustomerId) : null,
    ]);
  // Produto ainda em análise no Booking não vira kit (o cliente ainda não o vê).
  const anyProduct = await hasCatalogProducts(hiddenByBooking);
  const initialProduct =
    presetProduct &&
    presetProduct.active &&
    !hiddenByBooking.has(presetProduct.id)
      ? { id: presetProduct.id, name: productOptionLabel(t, presetProduct) }
      : null;
  // Como na lista antiga: só cliente ativo vem pré-escolhido.
  const initialCustomer =
    presetCustomer &&
    presetCustomer.type === "customer" &&
    presetCustomer.active
      ? { id: presetCustomer.id, name: presetCustomer.name }
      : null;
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
        <div className="mt-3">
          <Alert tone="warning">{t("marketing.disabled")}</Alert>
        </div>
      ) : !anyProduct ? (
        <div className="mt-3">
          <Alert tone="warning">{t("marketing.new.noProducts")}</Alert>
        </div>
      ) : (
        <Card className="mt-3 max-w-3xl">
          {/* Duas colunas a partir do tablet: produto | cliente, nome | preço e moeda. */}
          <form
            action={createKitAction}
            className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2"
          >
            <input type="hidden" name="back" value={back} />
            <Field label={t("marketing.new.product")}>
              <ProductPicker
                name="productId"
                scope="catalog"
                required
                initial={initialProduct}
                ariaLabel={t("marketing.new.product")}
                labels={productPickerLabels(t)}
              />
            </Field>
            <Field
              label={t("marketing.new.customer")}
              hint={t("marketing.new.customerHint")}
            >
              {/* Vazio = sem cliente, como a opção da lista antiga. */}
              <PartyPicker
                name="customerId"
                type="customer"
                activeOnly
                includeStock
                initial={initialCustomer}
                ariaLabel={t("marketing.new.customer")}
                labels={{
                  ...partyPickerLabels(t),
                  placeholder: t("marketing.noCustomer"),
                }}
              />
            </Field>
            <Field
              label={t("marketing.new.name")}
              hint={t("marketing.new.nameHint")}
            >
              <Input name="name" maxLength={160} />
            </Field>
            <div className="grid min-w-0 grid-cols-5 gap-3">
              <div className="col-span-3 min-w-0">
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
              <div className="col-span-2 min-w-0">
                <Field label={t("marketing.new.currency")}>
                  <CurrencySelect
                    name="currency"
                    value={settings.marketingKitCurrency}
                    t={t}
                    required
                  />
                </Field>
              </div>
            </div>
            <div className="border-t border-zinc-100 pt-3 sm:col-span-2">
              <SubmitButton
                pendingText="..."
                className="w-full py-2.5 sm:w-auto sm:py-1.5"
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
