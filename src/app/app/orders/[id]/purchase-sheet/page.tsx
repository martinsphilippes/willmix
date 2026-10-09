import { notFound, redirect } from "next/navigation";
import { fallbackError } from "@/i18n/error-text";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Alert, Badge, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PurchaseSheetFields } from "@/components/purchase-sheet-fields";
import { getSheetForUser } from "@/lib/services/purchase-sheet";
import {
  ncmChipsView,
  ncmSuggestionsFor,
} from "@/lib/services/ncm-suggestions";
import { SheetPhotosCard } from "@/components/sheet-photos";
import { MissingFields } from "@/components/missing-fields";
import { missingFieldsView } from "@/components/missing-fields-view";
import {
  addPurchaseSheetPhotosAction,
  adoptSheetIntoProductAction,
  removePurchaseSheetPhotoAction,
  savePurchaseSheetAction,
} from "../../../actions/purchase-sheet";

/*
 * Ficha de compra (planilha COMPRAS) da Preparação. Pensada para o celular do
 * comprador/fornecedor em Yiwu: campos grandes, teclado numérico, salvar a
 * qualquer momento. Peças, CBM, containers e datas são calculados no servidor.
 */
export default async function PurchaseSheetPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/purchase-sheet">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const {
    saved,
    error,
    photos: photosSent,
    photoRemoved,
    adopted,
  } = await searchParams;
  const view = await getSheetForUser(user, id);
  if (!view) notFound();
  const t = await getT();
  const request = await getStore().get("requests", view.order.requestId);
  const [item] = await getStore().list("order_items", {
    filter: { orderId: id },
    limit: 1,
  });
  const { sheet, access, plan, missing } = view;
  // Quem pode editar vê o que falta em vermelho e o aviso leva até cada campo.
  const canFill = access.editSupplier || access.editCustoms;
  const shownMissing = canFill ? missing : [];
  const errorKey = `sheet.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string"
      ? t(errorKey as DictionaryKey) !== errorKey
        ? t(errorKey as DictionaryKey)
        : fallbackError(t, String(error))
      : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("sheet.title")}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t("sheet.subtitle", {
              number: String(view.order.number),
              product: item?.name ?? "—",
            })}
            {missing.length === 0 ? (
              <Badge tone="success">{t("sheet.complete")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <LinkButton href={`/app/orders/${id}`}>{t("sheet.back")}</LinkButton>
        }
      />
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-600">
        {t("sheet.intro")}
      </p>
      <div className="mb-4 space-y-3">
        {saved === "complete" ? (
          <Alert tone="success">{t("sheet.saved.complete")}</Alert>
        ) : missing.length ? (
          <MissingFields
            {...missingFieldsView(
              t,
              saved === "partial" ? "sheet.saved.partial" : "sheet.missing",
              missing,
            )}
            tone={saved === "partial" ? "warning" : "info"}
            autoFocus={saved === "partial" && canFill}
          />
        ) : null}
        {photoRemoved === "1" ? (
          <Alert tone="success">{t("sheet.photos.removed")}</Alert>
        ) : null}
        {typeof adopted === "string" && adopted ? (
          <Alert tone="success">
            {t("productSheet.adopted")}{" "}
            <LinkButton href={`/app/products/${adopted}#product-sheet`}>
              {t("common.product")}
            </LinkButton>
          </Alert>
        ) : null}
        {typeof photosSent === "string" ? (
          <Alert tone="success">{t("sheet.photos.sent")}</Alert>
        ) : null}
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {!view.saved && access.editSupplier ? (
          <Alert tone={view.prefillSource === "catalog" ? "neutral" : "info"}>
            {view.prefillSource === "quote" ||
            view.prefillSource === "previous" ||
            view.prefillSource === "master"
              ? t(`sheet.prefilledNotice.${view.prefillSource}`)
              : t("sheet.prefilled")}
          </Alert>
        ) : null}
        {!access.editSupplier && !access.editCustoms ? (
          <Alert tone="neutral">{t("sheet.readOnly")}</Alert>
        ) : null}
      </div>

      {/* Ordem da ficha: campos, fotos e, por último, Salvar. O card de fotos tem
          formulários próprios (cada foto sobe na hora, no lugar), por isso o botão
          fica fora do <form> e aponta para ele pelo atributo `form`.
          Grade de 2 colunas: Fornecedor | Produto, Caixa | Preço, Programação | Fotos;
          o <form> é display: contents para os cards entrarem na grade. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          id="purchase-sheet"
          action={savePurchaseSheetAction}
          className="contents"
        >
          <input type="hidden" name="orderId" value={id} />

          <PurchaseSheetFields
            t={t}
            sheet={sheet}
            plan={plan}
            containerType={view.containerType}
            containerTypes={view.containerTypes}
            editSupplier={access.editSupplier}
            editCustoms={access.editCustoms}
            requestSchedule={request?.schedule ?? null}
            requestUnit={request?.unit ?? "un"}
            records={view.records}
            missing={shownMissing}
            ncmSuggestions={
              access.editCustoms
                ? ncmChipsView(
                    t,
                    await ncmSuggestionsFor(
                      view.sheet.productId ?? request?.productId ?? null,
                    ),
                  )
                : []
            }
          />
        </form>

        <SheetPhotosCard
          t={t}
          photos={view.photos}
          canEdit={view.access.addPhotos}
          ownerField="orderId"
          ownerId={id}
          addAction={addPurchaseSheetPhotosAction}
          removeAction={removePurchaseSheetPhotoAction}
          coveredKinds={view.catalogPhotoKinds}
          className="lg:order-4"
          missing={shownMissing}
        />

        {/* Wellmix: a ficha deste pedido vira a ficha mestre do produto (cadastro). */}
        {view.saved && isWellmix(user) && view.sheet.productId ? (
          <form
            action={adoptSheetIntoProductAction}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm lg:order-7 lg:col-span-2"
            data-adopt-sheet
          >
            <input type="hidden" name="ownerId" value={id} />
            <input
              type="hidden"
              name="back"
              value={`/app/orders/${id}/purchase-sheet`}
            />
            <span className="min-w-0 flex-1 text-xs text-zinc-600">
              {t("productSheet.adoptHint")}
            </span>
            <SubmitButton variant="secondary">
              {t("productSheet.adopt")}
            </SubmitButton>
          </form>
        ) : null}

        {/* Rodapé (fixo no celular): Salvar, para quem edita, e Voltar ao pedido. */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex gap-3 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 lg:order-8 lg:col-span-2">
          {access.editSupplier || access.editCustoms ? (
            <SubmitButton
              form="purchase-sheet"
              className="flex-1 py-3 text-base sm:flex-none"
            >
              {t("sheet.save")}
            </SubmitButton>
          ) : null}
          <LinkButton
            href={`/app/orders/${id}`}
            className="flex-1 py-3 text-base sm:flex-none"
          >
            {t("sheet.back")}
          </LinkButton>
        </div>
      </div>
    </>
  );
}
