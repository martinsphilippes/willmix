import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore, PRODUCT_EXTRA_DEFAULTS, type Product } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { autoProductSpec } from "@/lib/services/product-sheet";
import { productApproverFor } from "@/lib/services/product-approval";
import { getT } from "@/i18n/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FormDraftGuard } from "@/components/form-draft-guard";
import { ActionError } from "@/components/action-error";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import { createProductSheetAction } from "../../actions/catalog";
import { catalogError } from "../_components/shared";
import {
  NEW_PRODUCT_DRAFT_KEY,
  ProductFormCards,
} from "../_components/product-form-cards";

/*
 * Novo produto (dono, 17/11/2026; docs/NEW_PRODUCT.md): a ficha do produto
 * em branco, com os mesmos quadros da tela do produto (Produto, Fornecedor e
 * negociação, Embalagem e Observações), no lugar do quadro curto da lista.
 * Ao criar, o produto nasce inativo e vai para a aprovação do administrador
 * ou do superior de quem criou; abre na tela dele, onde o resto da ficha
 * (fotos, medições, fornecedores, variações, NCM...) é completado.
 */

/** Produto em branco: o que a ficha mostra antes de qualquer dado. */
function blankProduct(): Product {
  return {
    ...PRODUCT_EXTRA_DEFAULTS,
    id: "",
    createdAt: "",
    updatedAt: "",
    lineId: "",
    name: "",
    sku: null,
    specification: null,
    active: false,
    source: "manual",
    brand: null,
    colorPantones: null,
    notesToEcommerce: null,
  };
}

export default async function NewProductPage({
  searchParams,
}: PageProps<"/app/products/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  // Preço de compra: só com "Ver preço de compra" (docs/LINHA_DE_VISAO.md).
  const seesPrice = canSeePurchasePrice(user);
  const { error, at: saveToken, fields: invalidFields } = await searchParams;
  const t = await getT();
  const store = getStore();
  // Administrador: o produto que ele cria não passa pela aprovação (dono,
  // 17/11/2026, D2); nasce ativo e segue para o Sankhya.
  const byAdmin = isAdmin(user);
  const [lines, superior] = await Promise.all([
    // Só o nome das linhas (a linha tem prompts e requisitos que a lista não usa).
    listColumns(store, "product_lines", ["name"], { orderBy: "name" }),
    // Quem aprova: o superior no "Responde a" que abre Produtos (o aviso da tela).
    byAdmin ? null : productApproverFor(user.id),
  ]);
  const product = blankProduct();
  // Campos que a ficha mestre também usa: a âncora e o asterisco (ainda nada
  // preenchido, nada em vermelho).
  const sheetField = (...keys: string[]) => ({ anchor: keys.join(" ") });
  const sheetRequired = (...keys: string[]) => ({
    anchor: keys.join(" "),
    required: true,
    requiredTitle: t("sheet.required"),
  });
  const errorText = catalogError(t, error);
  return (
    <>
      <PageHeader
        help={{
          body: "help.newProduct.body",
          steps: "help.newProduct.steps",
        }}
        t={t}
        title={t("newProduct.title")}
        subtitle={t(
          byAdmin ? "newProduct.subtitle.admin" : "newProduct.subtitle",
        )}
      />
      <ActionError
        t={t}
        code={error}
        text={errorText}
        fields={invalidFields}
        token={saveToken}
      />
      <div
        className="mt-4"
        data-new-product-approver={
          byAdmin ? "self" : superior ? "superior" : "admins"
        }
      >
        <Alert tone="info">
          {byAdmin
            ? t("newProduct.approver.self")
            : superior
              ? t("newProduct.approver", { name: superior.name })
              : t("newProduct.approver.admins")}
        </Alert>
      </div>
      <FormDraftGuard
        formId="product-form"
        storageKey={NEW_PRODUCT_DRAFT_KEY}
        userId={user.id}
        failed={typeof error === "string" && !!error}
        saved={false}
        token="new"
        message={t("sheet.draftRestored")}
        discardLabel={t("sheet.draftDiscard")}
      />
      <form
        id="product-form"
        action={createProductSheetAction}
        className="mt-4 space-y-4"
        data-new-product-form
      >
        <ProductFormCards
          t={t}
          product={product}
          isNew
          lines={lines}
          seesPrice={seesPrice}
          autoSpec={autoProductSpec(product, null)}
          specExtras={{
            capacityMl: null,
            packageType: null,
            powerSource: null,
            powerDetail: null,
          }}
          pantones={[]}
          notesView={{ text: "", toEcommerce: false }}
          cbmComputed={null}
          cbmShown={null}
          sheetField={sheetField}
          sheetRequired={sheetRequired}
          supplier={null}
          supplierControl={
            <PartyPicker
              name="supplierId"
              type="supplier"
              activeOnly
              dense
              ariaLabel={t("common.supplier")}
              labels={{
                ...partyPickerLabels(t),
                placeholder: t("catalog.noSupplier"),
              }}
            />
          }
          status={
            <p
              className={
                byAdmin
                  ? "text-[13px] font-medium text-emerald-800"
                  : "text-[13px] font-medium text-amber-800"
              }
              data-new-product-status={byAdmin ? "active" : "pending"}
            >
              {t(byAdmin ? "newProduct.status.admin" : "newProduct.status")}
            </p>
          }
          sourcing={null}
        />
        {/* O resto da ficha precisa do produto criado (fotos, medições...). */}
        <Card title={t("newProduct.after.title")} dense>
          <p className="text-sm text-zinc-600">{t("newProduct.after.body")}</p>
        </Card>
        {/* Botão principal no fim, fixo ao alcance do polegar no celular. */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <SubmitButton
            className="w-full py-3 sm:w-auto sm:py-2"
            data-new-product-submit
          >
            {t(byAdmin ? "newProduct.create.admin" : "newProduct.create")}
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
