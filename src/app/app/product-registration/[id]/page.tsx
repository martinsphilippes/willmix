import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { getStore } from "@/lib/db";
import { registrationContext } from "@/lib/services/product-registration";
import { samplingOf } from "@/lib/supplier-request-sampling";
import {
  REGISTRATION_FIELDS,
  registrationField,
} from "@/lib/product-registration";
import { FieldErrors } from "@/components/field-errors";
import { fieldNamesParam } from "@/components/action-error";
import { PhotoGallery } from "@/components/photo-gallery";
import {
  Alert,
  Badge,
  Card,
  Input,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  DealSummary,
  ItemList,
  RequestProductCard,
  type RequestProductData,
} from "../../supplier-requests/_components/request-product";
import { RegistrationForm } from "../_components/registration-form";
import {
  loadRegistrationDictionaryAction,
  saveRegistrationFieldMapAction,
} from "../../actions/product-registration";

/*
 * Cadastrar produto: um produto (docs/PRODUCT_REGISTRATION.md). No alto, o
 * que o processo juntou (fotos, cotação, book, fornecedor e condições); no
 * meio, o cadastro do Sankhya já preenchido; depois, associar a um produto
 * que já existe (ou, com o produto, a vitrine e o CODPROD) e, para o
 * administrador, o de-para dos campos com as colunas do Sankhya.
 */
export default async function ProductRegistrationDetailPage({
  params,
  searchParams,
}: PageProps<"/app/product-registration/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/product-registration/${id}`);
  requireScreen(user, "productRegistration");
  if (!isWellmix(user)) notFound();
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  const ctx = await registrationContext(user, id);
  if (!ctx) notFound();
  const r = ctx.request;
  const it = r.item;
  const seesPrice = canSeePurchasePrice(user);

  // Avisos da volta das ações.
  const error = one("error");
  const errorKey = [
    `productRegistration.error.${error}`,
    `supplierRequests.error.${error}`,
    `common.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);
  const errorFields = fieldNamesParam(sp.fields);
  const notices: string[] = [];
  if (one("registration") === "saved")
    notices.push(t("productRegistration.notice.saved"));
  const productNotice = one("product");
  if (productNotice === "created")
    notices.push(t("productRegistration.notice.created"));
  else if (["linked", "items", "released"].includes(productNotice))
    notices.push(t(`srProduct.notice.${productNotice}` as DictionaryKey));
  const erp = one("erp");
  if (["checked", "unchecked", "cleared"].includes(erp))
    notices.push(t(`srProduct.notice.erp.${erp}` as DictionaryKey));
  else if (erp === "done") notices.push(t("productRegistration.erp.done"));
  if (one("dictionary"))
    notices.push(
      t("productRegistration.notice.dictionary", { n: one("dictionary") }),
    );
  if (one("map") === "saved") notices.push(t("productRegistration.notice.map"));
  const last = r.registration;
  const offReason =
    last?.sendStatus === "off" &&
    (last.sendDetail === "not_configured" ||
      last.sendDetail === "execution_off")
      ? t(`productRegistration.erp.reason.${last.sendDetail}`)
      : null;

  // O quadro de associar / vitrine / CODPROD (as regras da Cotação: também
  // a tela Cotação).
  let productData: RequestProductData | null = null;
  if (canOpen(user, "quotes") && ctx.state !== "waiting_sample") {
    const svc = await import("@/lib/services/supplier-request-product");
    const store = getStore();
    const q = {
      items: one("iq").slice(0, 80),
      products: one("pq").slice(0, 80),
      erp: one("eq").slice(0, 80),
    };
    const [choices, catalog, erpSearch, linked] = await Promise.all([
      svc.requestItemChoices(r, q.items),
      ctx.product
        ? Promise.resolve([])
        : q.products
          ? svc.searchCatalogProducts(q.products)
          : svc.suggestCatalogProducts(r),
      ctx.product && q.erp ? svc.searchSankhyaProducts(q.erp) : null,
      ctx.product
        ? store.list("booking_items", {
            filter: { productId: ctx.product.id },
          })
        : Promise.resolve([]),
    ]);
    productData = {
      request: r,
      product: ctx.product,
      linkedCount: linked.length,
      lines: ctx.lines,
      choices,
      catalog,
      erp: erpSearch,
      query: q,
      suggestedName: ctx.values.descrPt ?? "",
      deal: seesPrice
        ? svc.agreedConditions(r)
        : { ...svc.agreedConditions(r), price: null, currency: null },
      readiness: [],
    };
  }
  const { agreedConditions } =
    await import("@/lib/services/supplier-request-product");
  const deal = seesPrice
    ? agreedConditions(r)
    : { ...agreedConditions(r), price: null, currency: null };

  // Fotos: a do item (book) e as da amostra.
  const sampling = samplingOf(r);
  const photos = [
    ...ctx.photoDocumentIds.map((pid) => ({ id: pid, label: null })),
    ...(sampling?.files ?? [])
      .filter((f) => f.kind === "photo")
      .map((f) => ({ id: f.documentId, label: f.fileName })),
  ];
  const name = ctx.product?.name ?? ctx.values.descrPt ?? it.description ?? "—";

  // Itens do book a ligar (antes de o produto existir).
  let items = null;
  if (!ctx.product && r.bookingItemId) {
    const svc = await import("@/lib/services/supplier-request-product");
    const choices =
      productData?.choices ?? (await svc.requestItemChoices(r, ""));
    const suggested = new Set(choices.suggested.map((c) => c.item.id));
    const all = [
      ...choices.suggested,
      ...choices.found.filter((c) => !c.item.productId),
    ];
    items = (
      <Card dense title={t("productRegistration.items")}>
        <p className="mb-2 text-xs text-zinc-500">{t("srProduct.itemsHint")}</p>
        <ItemList
          choices={all}
          chosenId={r.bookingItemId}
          checkedIds={suggested}
          t={t}
        />
      </Card>
    );
  }

  return (
    <div data-product-registration={r.id}>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-900">
        {t("productRegistration.detail.title", { n: r.number })}
      </h1>
      <p className="mb-3 text-sm text-zinc-600">{productNameText(t, name)}</p>

      <div className="mb-3 space-y-2" data-registration-notices>
        {errorText ? (
          errorFields.length ? (
            <FieldErrors
              names={errorFields}
              before={t("form.invalid.before")}
              fallback={errorText}
              hint={t("sheet.missingHint")}
              token={one("at") || undefined}
            />
          ) : (
            <Alert tone="danger">{errorText}</Alert>
          )
        ) : null}
        {notices.map((n) => (
          <Alert key={n} tone="success">
            {n}
          </Alert>
        ))}
        {erp === "error" ? (
          <Alert tone="danger">{t("productRegistration.erp.error")}</Alert>
        ) : null}
        {erp === "off" && offReason ? (
          <Alert tone="warning">
            {t("productRegistration.erp.off", { reason: offReason })}
          </Alert>
        ) : null}
        {ctx.state === "waiting_sample" ? (
          <Alert tone="info">
            {t("productRegistration.detail.waitingSample")}
          </Alert>
        ) : null}
      </div>

      <Card dense className="mb-3">
        <div className="flex flex-wrap items-start gap-4">
          <PhotoGallery
            photos={photos}
            name={name}
            className="h-24 w-24"
            labels={{
              title: t("supplierRequests.table.photo"),
              close: t("supplierRequests.table.close"),
              open: t("supplierRequests.table.photoOpen"),
              count: t("productRegistration.photos"),
              noPhoto: t("supplierRequests.table.noPhoto"),
            }}
          />
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span data-registration-state={ctx.state}>
                <Badge
                  tone={
                    ctx.state === "done"
                      ? "success"
                      : ctx.state === "to_register"
                        ? "warning"
                        : ctx.state === "to_send"
                          ? "info"
                          : "neutral"
                  }
                >
                  {t(`productRegistration.state.${ctx.state}`)}
                </Badge>
              </span>
              <Link
                href={`/app/supplier-requests/${r.id}?view=item`}
                className={linkClass}
              >
                {t("productRegistration.detail.quote")}
              </Link>
              {ctx.lot ? (
                <Link
                  href={`/app/booking/lots/${ctx.lot.id}`}
                  className={linkClass}
                >
                  {t("productRegistration.detail.book", {
                    n: ctx.lot.number,
                  })}
                </Link>
              ) : null}
              {ctx.product ? (
                <Link
                  href={`/app/products/${ctx.product.id}`}
                  className={linkClass}
                  data-registration-product
                >
                  {productNameText(t, ctx.product.name)}
                  {ctx.product.sankhyaCode
                    ? ` · CODPROD ${ctx.product.sankhyaCode}`
                    : ""}
                </Link>
              ) : null}
            </p>
            <p className="text-zinc-700">
              {[ctx.supplier?.name, it.factoryItemCode]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            <DealSummary deal={deal} t={t} />
            {last?.sentAt && last.sendStatus ? (
              <p
                className="text-xs text-zinc-600"
                data-registration-last-send={last.sendStatus}
              >
                {t("productRegistration.lastSend", {
                  date: formatDate(last.sentAt, t),
                  status: t(`productRegistration.lastSend.${last.sendStatus}`),
                })}
                {last.sendDetail && last.sendStatus !== "off"
                  ? ` · ${last.sendDetail}`
                  : offReason
                    ? ` · ${offReason}`
                    : ""}
              </p>
            ) : null}
            {last?.skipped?.length ? (
              <p className="text-xs text-amber-800">
                {t("productRegistration.skipped", {
                  fields: last.skipped
                    .map((s) => s.split(":")[0])
                    .map((fid) =>
                      registrationField(fid)
                        ? t(`productRegistration.field.${fid}` as DictionaryKey)
                        : fid,
                    )
                    .join(", "),
                })}
              </p>
            ) : null}
            {last?.savedAt ? (
              <p className="text-xs text-zinc-500">
                {t("productRegistration.savedAt", {
                  date: formatDate(last.savedAt, t),
                })}
              </p>
            ) : null}
            <p className="text-xs text-zinc-500">
              {t("productRegistration.photos.hint")}
            </p>
          </div>
        </div>
      </Card>

      <p className="mb-3 text-sm text-zinc-600">
        {t("productRegistration.detail.intro")}
      </p>

      <RegistrationForm
        requestId={r.id}
        values={ctx.values}
        columns={ctx.columns}
        lines={ctx.lines}
        state={ctx.state}
        items={items}
        t={t}
      />

      {productData ? (
        <div className="mt-4" data-request-product>
          <RequestProductCard data={productData} t={t} home="registration" />
        </div>
      ) : null}

      {isAdmin(user) ? (
        <div className="mt-4" id="campos-sankhya">
          <Card dense title={t("productRegistration.map.title")}>
            <p className="mb-2 text-xs text-zinc-600">
              {t("productRegistration.map.intro")}
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-700" data-registration-dictionary>
                {ctx.dictionary
                  ? t("productRegistration.map.loaded", {
                      date: formatDate(ctx.dictionary.loadedAt, t),
                      n: ctx.dictionary.fields.length,
                    })
                  : t("productRegistration.map.notLoaded")}
              </span>
              <form action={loadRegistrationDictionaryAction}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton
                  variant="secondary"
                  pendingText={t("productRegistration.pending")}
                >
                  {t("productRegistration.map.load")}
                </SubmitButton>
              </form>
            </div>
            <form action={saveRegistrationFieldMapAction}>
              <input type="hidden" name="id" value={r.id} />
              <Table tools={false}>
                <thead>
                  <tr>
                    <Th>{t("productRegistration.map.col.field")}</Th>
                    <Th>{t("productRegistration.map.col.column")}</Th>
                    <Th>{t("productRegistration.map.col.source")}</Th>
                    <Th>{t("productRegistration.map.col.options")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {REGISTRATION_FIELDS.map((field) => {
                    const res = ctx.columns[field.id];
                    return (
                      <tr key={field.id} data-registration-map={field.id}>
                        <Td>
                          {t(
                            `productRegistration.field.${field.id}` as DictionaryKey,
                          )}
                        </Td>
                        <Td>
                          <Input
                            name={`map.${field.id}`}
                            defaultValue={ctx.overrides[field.id] ?? ""}
                            placeholder={res?.column ?? field.column ?? ""}
                            maxLength={40}
                            className="w-44 font-mono"
                            aria-label={t(
                              `productRegistration.field.${field.id}` as DictionaryKey,
                            )}
                          />
                        </Td>
                        <Td className="text-xs">
                          {t(
                            `productRegistration.map.source.${res?.source ?? "none"}` as DictionaryKey,
                          )}
                          {res?.absent
                            ? ` (${t("productRegistration.map.absent")})`
                            : ""}
                        </Td>
                        <Td className="text-xs">
                          {res?.options.length
                            ? t("productRegistration.map.options", {
                                n: res.options.length,
                              })
                            : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="mt-2">
                <SubmitButton pendingText={t("productRegistration.pending")}>
                  {t("productRegistration.map.save")}
                </SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
