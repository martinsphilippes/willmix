import { redirect } from "next/navigation";
import { STOCK_OPTION, isStockCustomer } from "@/lib/services/stock-party";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  TextLink,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { RequestItems } from "@/components/request-items";
import { RequestCustomerField } from "@/components/request-customer-field";
import {
  partyPickerLabels,
  productPickerLabels,
} from "@/components/party-picker-labels";
import { requestProductFills } from "@/lib/services/request-product-fill";
import { getSettings } from "@/lib/settings";
import { quoteSlaDeadline } from "@/lib/sla";
import { getAiAdapter } from "@/lib/integrations/ai";
import { getLookup, STRONG_REASONS } from "@/lib/services/product-lookup";
import { hiddenBookingProductIds } from "@/lib/services/booking-visibility";
import type { LookupField } from "@/lib/db";
import { createRequestAction } from "../../actions";
import { canAddProducts } from "@/lib/services/requests";
import { lookupProductAction } from "../../actions/lookup";
import { aiErrorText } from "@/i18n/ai-error";

export default async function NewRequestPage({
  searchParams,
}: PageProps<"/app/requests/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "requests");
  // Só o cliente e a Wellmix criam solicitação. Outro login que receba a tela
  // (Gestão de telas) fica na lista, vazia para ele: o catálogo de produtos
  // deste formulário não vai para quem não compra.
  if (!isWellmix(user) && user.role !== "customer") redirect("/app/requests");
  const {
    error,
    productId,
    variantId,
    quantity,
    scheduleId,
    customerId,
    lookup,
    addTo,
  } = await searchParams;
  const t = await getT();
  const store = getStore();
  // "Adicionar produto" numa solicitação que ainda não virou pedido (Wellmix):
  // os produtos entram no mesmo lote, com o mesmo número e cliente.
  const addToRequest =
    typeof addTo === "string" && isWellmix(user)
      ? await store.get("requests", addTo)
      : null;
  if (typeof addTo === "string" && !addToRequest) redirect("/app/requests");
  if (addToRequest && !canAddProducts(user, addToRequest))
    redirect(`/app/requests/${addToRequest.id}?error=invalid_status`);
  const addToCustomer = addToRequest
    ? await store.get("parties", addToRequest.customerId)
    : null;
  // Pré-preenchimento vindo da ficha do produto ou de uma programação de compra.
  // A programação de compra é da Wellmix: só ela abre o formulário por uma.
  const schedule =
    typeof scheduleId === "string" && isWellmix(user)
      ? await store.get("purchase_schedules", scheduleId)
      : null;
  const presetProductId =
    schedule?.productId ?? (typeof productId === "string" ? productId : "");
  // Variação pré-escolhida (vitrine, página do produto): vale com o produto.
  const presetVariantId = typeof variantId === "string" ? variantId : "";
  const presetQuantity =
    schedule?.quantity ?? (typeof quantity === "string" ? quantity : "");
  const presetCustomerId =
    schedule?.customerId ?? (typeof customerId === "string" ? customerId : "");
  // Produto e cliente são escolhidos por busca (auditoria de performance,
  // 14/11/2026): o catálogo inteiro (~15 mil produtos, com a ficha de cada
  // um) e os ~26 mil clientes deixavam a página com 15 MB. Aqui só o que já
  // chega escolhido; a ficha de cada produto escolhido vem de
  // /api/products/fill (src/lib/services/request-product-fill.ts).
  const [hiddenByBooking, customerUsers, presetCustomer] = await Promise.all([
    // Booking: produto ainda não aprovado lá não é oferecido aqui, nem ao
    // cliente nem à Wellmix (para ela, a porta é "Gerar solicitação" no Booking).
    hiddenBookingProductIds(),
    // Logins de cliente, para a Wellmix indicar o solicitante (só ele verá o pedido).
    isWellmix(user)
      ? store.list("users", {
          filter: { role: "customer", active: true },
          orderBy: "name",
        })
      : Promise.resolve([]),
    isWellmix(user) &&
    presetCustomerId &&
    presetCustomerId !== STOCK_OPTION &&
    !isStockCustomer(presetCustomerId)
      ? store.get("parties", presetCustomerId)
      : Promise.resolve(null),
  ]);
  // Produto do catálogo: ativo e fora do Booking (a regra da lista antiga).
  const inCatalog = (p: { active: boolean; id: string } | null | undefined) =>
    !!p && p.active && !hiddenByBooking.has(p.id);
  // Empresas dos logins de cliente (grupos do campo "solicitante"): só os
  // clientes ativos, em ordem alfabética, como a lista antiga.
  const requesterCustomers = isWellmix(user)
    ? (
        await listByIds(
          store,
          "parties",
          customerUsers.map((u) => u.partyId),
        )
      )
        .filter((p) => p.type === "customer" && p.active)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  // Cliente pré-escolhido (programação de compra, endereço): só cliente ativo.
  const initialCustomer =
    presetCustomer &&
    presetCustomer.type === "customer" &&
    presetCustomer.active &&
    !isStockCustomer(presetCustomer.id)
      ? { id: presetCustomer.id, name: presetCustomer.name }
      : null;

  /* Busca por foto ou link: resultado guardado em product_lookups (só de quem buscou ou Wellmix). */
  const found =
    typeof lookup === "string" ? await getLookup(user, lookup) : null;
  // Produtos sugeridos pela busca por foto/link e o pré-escolhido: só eles.
  const listedProducts = (
    await listByIds(store, "products", [
      ...(found?.matches ?? []).map((m) => m.productId),
      presetProductId,
    ])
  ).filter(inCatalog);
  const productById = new Map(listedProducts.map((p) => [p.id, p]));
  const settings = await getSettings();
  // Cliente com "Cliente pode criar solicitação" desligado: explica em vez de
  // mostrar um formulário que seria recusado só no envio.
  if (user.role === "customer" && !settings.customerCanCreateRequest)
    return (
      <>
        <PageHeader t={t} title={t("requests.new")} />
        <Alert tone="warning">{t("explore.disabled")}</Alert>
      </>
    );
  const slaDate = quoteSlaDeadline(settings.quoteSlaBusinessDays);
  const aiMode = found ? getAiAdapter(settings).mode : null;
  /* Busca por foto/link pausada até a IA externa ter cartão (Configurações → lookupPaused). */
  const lookupPaused = settings.lookupPaused;
  const matched = (found?.matches ?? [])
    .map((m) => ({ m, p: productById.get(m.productId) }))
    .filter((x) => !!x.p);
  /* "Parece ser o seu" (mesma foto, nome, IA) × "relacionado" (mesma categoria, palavra em comum). */
  const strong = matched.filter(({ m }) =>
    m.reasons.some((r) => STRONG_REASONS.has(r)),
  );
  const related = matched.filter(
    ({ m }) => !m.reasons.some((r) => STRONG_REASONS.has(r)),
  );
  const optionsFor = (field: LookupField) => found?.suggestions[field] ?? [];
  const hasSuggestions =
    !!found &&
    (["productName", "description", "specification"] as const).some(
      (f) => optionsFor(f).length > 0,
    );
  const sourceLabels = {
    link: t("lookup.source.link"),
    catalog: t("lookup.source.catalog"),
    ai: t("lookup.source.ai"),
    mock: t("lookup.source.mock"),
  };
  const pickHref = (pid: string) => {
    const params = new URLSearchParams({ lookup: found!.id, productId: pid });
    if (presetCustomerId) params.set("customerId", presetCustomerId);
    return `/app/requests/new?${params.toString()}`;
  };
  const errorKey = `lookup.error.${typeof error === "string" ? error : ""}`;
  const accessKey = `access.error.${typeof error === "string" ? error : ""}`;
  const batchKey = `reqBatch.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string" && t(errorKey as DictionaryKey) !== errorKey
      ? t(errorKey as DictionaryKey)
      : typeof error === "string" && t(accessKey as DictionaryKey) !== accessKey
        ? t(accessKey as DictionaryKey)
        : typeof error === "string" && t(batchKey as DictionaryKey) !== batchKey
          ? t(batchKey as DictionaryKey)
          : t("common.error");
  /* Ficha do produto que já chega escolhido (vitrine, busca por foto,
     programação de compra): preenche a primeira linha sem esperar a busca. */
  const presetProduct = productById.get(presetProductId);
  const productFills = presetProduct
    ? await requestProductFills(user, t, [presetProduct])
    : [];

  const renderMatches = (items: typeof matched) => (
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
      {items.map(({ m, p }) => {
        const selected = presetProductId === p!.id;
        return (
          <li
            key={m.productId}
            className={cx(
              "flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
              selected && "bg-brand-50/60",
            )}
          >
            <div className="min-w-0">
              <p className="font-medium text-zinc-900">
                {p!.name}
                {p!.sku ? (
                  <span className="text-zinc-500"> ({p!.sku})</span>
                ) : null}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {m.reasons.map((r) => (
                  <Badge key={r} tone="info">
                    {t(`lookup.reason.${r}` as DictionaryKey)}
                  </Badge>
                ))}
              </div>
            </div>
            {selected ? (
              <Badge tone="success">{t("lookup.using")}</Badge>
            ) : (
              <LinkButton href={pickHref(p!.id)} variant="secondary">
                {t("lookup.use")}
              </LinkButton>
            )}
          </li>
        );
      })}
    </ul>
  );
  const referenceNote = found?.url
    ? `${t("lookup.referenceNote")} ${found.url}`
    : "";

  return (
    <>
      <PageHeader
        help={{
          body: "help.requests.new.body",
          steps: "help.requests.new.steps",
        }}
        t={t}
        title={
          addToRequest
            ? addToRequest.number
              ? t("reqAdd.titleNumbered", { n: addToRequest.number })
              : t("reqAdd.title")
            : t("requests.new")
        }
      />
      {error ? <Alert tone="danger">{errorText}</Alert> : null}
      {addToRequest ? (
        <div className="mt-3" data-add-to-request>
          <Alert tone="info">
            {t("reqAdd.intro", {
              customer: addToCustomer?.name ?? "—",
            })}{" "}
            <TextLink href={`/app/requests/${addToRequest.id}`}>
              {t("reqAdd.back")}
            </TextLink>
          </Alert>
        </div>
      ) : null}

      {/* Telas grandes: busca por foto/link (estreita) ao lado do formulário. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Busca do produto por foto ou link: procura no catálogo e sugere os campos.
          Fora do modo "adicionar à solicitação" (a busca recarrega a tela sem ele). */}
        {addToRequest ? null : (
          <Card title={t("lookup.title")} className="max-w-2xl lg:max-w-none">
            <div id="lookup" className="scroll-mt-4" />
            <p className="mb-2 text-sm text-zinc-600">{t("lookup.intro")}</p>
            {lookupPaused ? (
              <Alert tone="warning">{t("lookup.paused")}</Alert>
            ) : null}
            <form action={lookupProductAction} className="space-y-2.5">
              {isWellmix(user) && presetCustomerId ? (
                <input
                  type="hidden"
                  name="customerId"
                  value={presetCustomerId}
                />
              ) : null}
              <PhotoInput
                name="photo"
                multiple={false}
                capture={false}
                autoSubmit
                disabled={lookupPaused}
                label={t("lookup.photo")}
                hint={t("lookup.photoHint")}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Field label={t("lookup.url")}>
                    <Input
                      name="url"
                      disabled={lookupPaused}
                      type="url"
                      inputMode="url"
                      placeholder={t("lookup.urlPlaceholder")}
                    />
                  </Field>
                </div>
                <SubmitButton
                  variant="secondary"
                  pendingText={t("lookup.searching")}
                  disabled={lookupPaused}
                >
                  {t("lookup.search")}
                </SubmitButton>
              </div>
            </form>

            {found ? (
              <div className="mt-4 space-y-3 border-t border-zinc-100 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {t("lookup.result")}
                  </h3>
                  {found.aiSource === "api" ? (
                    <Badge tone="success">{t("lookup.ai.api")}</Badge>
                  ) : found.aiSource === "mock" ? (
                    <Badge tone="warning">{t("lookup.ai.mock")}</Badge>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {found.imageDocumentId ? (
                    <a
                      href={`/api/files/${found.imageDocumentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                      <img
                        src={`/api/files/${found.imageDocumentId}`}
                        alt={t("lookup.yourPhoto")}
                        className="h-24 w-24 rounded-xl border border-zinc-200 bg-zinc-50 object-cover"
                      />
                    </a>
                  ) : null}
                  {found.url ? (
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("lookup.link")}
                        {found.linkSiteName ? ` · ${found.linkSiteName}` : ""}
                      </p>
                      {found.linkTitle ? (
                        <p className="font-medium text-zinc-900">
                          {found.linkTitle}
                        </p>
                      ) : null}
                      <a
                        href={found.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block break-all text-xs text-brand-700 underline"
                      >
                        {found.url}
                      </a>
                      {found.linkPrice ? (
                        <p className="text-xs text-zinc-500">
                          {t("lookup.linkPrice")}: {found.linkPrice}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {found.linkStatus && found.linkStatus !== "ok" ? (
                  <Alert tone="warning">
                    {t(
                      `lookup.linkStatus.${found.linkStatus}` as DictionaryKey,
                    )}
                  </Alert>
                ) : null}
                {/* Falha da IA: a Wellmix vê o motivo traduzido; o cliente, só a mensagem simples. */}
                {found.aiError && isWellmix(user) ? (
                  <Alert tone="warning">
                    {aiErrorText(t, found.aiError) ?? t("lookup.ai.failed")}
                  </Alert>
                ) : null}
                {found.aiError && !isWellmix(user) && strong.length === 0 ? (
                  <p className="text-xs leading-relaxed text-zinc-500">
                    {t("lookup.ai.customerManual")}
                  </p>
                ) : null}
                {aiMode === "manual" && !found.aiError ? (
                  isWellmix(user) ? (
                    <Alert tone="warning">{t("lookup.ai.manual")}</Alert>
                  ) : strong.length === 0 && found.imageDocumentId ? (
                    <p className="text-xs leading-relaxed text-zinc-500">
                      {t("lookup.ai.customerManual")}
                    </p>
                  ) : null
                ) : null}

                {strong.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-800">
                      {t("lookup.matches")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t("lookup.matchesHint")}
                    </p>
                    {renderMatches(strong)}
                  </div>
                ) : (
                  <Alert tone="info">
                    {related.length > 0
                      ? t("lookup.noExact")
                      : t("lookup.noMatch")}
                  </Alert>
                )}
                {related.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-800">
                      {t("lookup.related")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t("lookup.relatedHint")}
                    </p>
                    {renderMatches(related)}
                  </div>
                ) : null}
                {presetProductId ? (
                  <TextLink
                    href={`/app/requests/new?${new URLSearchParams({ lookup: found.id, ...(presetCustomerId ? { customerId: presetCustomerId } : {}) }).toString()}`}
                    className="text-xs"
                  >
                    {t("lookup.none")}
                  </TextLink>
                ) : null}
                <TextLink
                  href={`/app/requests/new${presetCustomerId ? `?customerId=${encodeURIComponent(presetCustomerId)}` : ""}`}
                  className="text-xs"
                >
                  {t("lookup.new")}
                </TextLink>
              </div>
            ) : null}
          </Card>
        )}

        <Card
          className={cx(
            "max-w-2xl lg:max-w-none",
            addToRequest && "lg:col-span-2",
          )}
        >
          {/* key: ao escolher um produto da busca (mesma rota, outro ?productId) o formulário
            é recriado, senão o navegador mantém o valor anterior dos campos. */}
          <form
            key={`${found?.id ?? "none"}-${presetProductId}-${presetVariantId}-${presetCustomerId}`}
            action={createRequestAction}
            className="space-y-3"
          >
            {found ? (
              <input type="hidden" name="lookupId" value={found.id} />
            ) : null}
            {addToRequest ? (
              <input type="hidden" name="addTo" value={addToRequest.id} />
            ) : null}
            {schedule ? (
              <input type="hidden" name="scheduleId" value={schedule.id} />
            ) : null}
            {/* Cliente e solicitante lado a lado (Wellmix). */}
            {isWellmix(user) && !addToRequest ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Cliente por busca ou origem interna: compra para estoque,
                    sem cliente nem sinal (o mesmo campo customerId). Fora do
                    <label> do Field: o bloco tem a caixa de estoque. */}
                <div className="min-w-0 space-y-1">
                  <span
                    className="block text-xs font-medium leading-5 text-zinc-700"
                    data-field-label=""
                  >
                    {t("common.customer")}
                  </span>
                  <RequestCustomerField
                    stockValue={STOCK_OPTION}
                    stockLabel={t("purchaseFlow.stock.option")}
                    initial={initialCustomer}
                    initialStock={
                      isStockCustomer(presetCustomerId) ||
                      presetCustomerId === STOCK_OPTION
                    }
                    ariaLabel={t("common.customer")}
                    labels={partyPickerLabels(t)}
                  />
                </div>
                <Field
                  label={t("access.requester")}
                  hint={t("access.requesterHint")}
                >
                  <Select name="requestedForUserId" defaultValue="">
                    <option value="">{t("access.requesterNone")}</option>
                    {requesterCustomers.map((c) => {
                      const logins = customerUsers.filter(
                        (u) => u.partyId === c.id,
                      );
                      return logins.length ? (
                        <optgroup key={c.id} label={c.name}>
                          {logins.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                  </Select>
                </Field>
              </div>
            ) : null}
            {/* Produtos: uma linha por produto ("+ Adicionar outro produto"); cada um vira uma solicitação do mesmo lote.
              Em cada linha: "fora do catálogo" primeiro; escolher um produto preenche os campos com a ficha; anexos só fora do catálogo. */}
            <RequestItems
              products={productFills}
              presetProductId={presetProductId}
              presetVariantId={presetVariantId}
              presetQuantity={String(presetQuantity)}
              defaultNotInCatalog={
                !!found && strong.length === 0 && !presetProductId
              }
              suggestions={hasSuggestions ? found!.suggestions : {}}
              sourceLabels={sourceLabels}
              labels={{
                products: t("reqBatch.products"),
                productN: t("reqBatch.productN"),
                add: t("reqBatch.add"),
                remove: t("reqBatch.remove"),
                hint: t("reqBatch.hint"),
                quantity: t("common.quantity"),
                unit: t("requests.unit"),
                moq: t("reqProduct.moq", { n: "{n}", unit: "{unit}" }),
                belowMoq: t("reqProduct.belowMoq", {
                  n: "{n}",
                  unit: "{unit}",
                }),
                intl: t.intl,
                schedule: {
                  intl: t.intl,
                  toggle: t("reqSchedule.toggle"),
                  ask: t("reqSchedule.ask"),
                  hint: t("reqSchedule.hint"),
                  interval: t("reqSchedule.interval"),
                  days: t("reqSchedule.days", { n: "{n}" }),
                  custom: t("reqSchedule.custom"),
                  firstDate: t("reqSchedule.firstDate"),
                  n: t("reqSchedule.n", { n: "{n}" }),
                  quantity: t("reqSchedule.quantity"),
                  expected: t("reqSchedule.expected"),
                  add: t("reqSchedule.add"),
                  remove: t("reqSchedule.remove", { n: "{n}" }),
                  total: t("reqSchedule.total", {
                    total: "{total}",
                    unit: "{unit}",
                  }),
                  off: t("reqSchedule.off"),
                },
                fromCatalog: t("reqProduct.fromCatalog"),
                inStock: t("reqProduct.inStock"),
                noStock: t("reqProduct.noStock"),
                change: t("reqProduct.change"),
                notInCatalog: t("requests.sourcingDemand.label"),
                // Sourcing em espera: o pedido vira só a solicitação.
                notInCatalogHint: t(
                  settings.sourcingEnabled
                    ? "requests.sourcingDemand.hint"
                    : "requests.sourcingDemand.hintStandby",
                ),
                product: t("common.product"),
                variant: t("reqProduct.variant"),
                variantChoose: t("reqProduct.variantChoose"),
                variantHint: t("reqProduct.variantHint"),
                variantPhoto: t("reqProduct.variantPhoto"),
                filledHint: t("lookup.fill.hint"),
                filledBadge: t("lookup.fill.badge"),
                photos: t("lookup.fill.photos"),
                photosNone: t("lookup.fill.photosNone"),
                productName: `${t("common.product")} (${t("common.name")})`,
                placeholder: t("ph.request.productName"),
                description: t("requests.description"),
                specification: t("requests.specification"),
                attachments: t("requests.attachments"),
                attachmentsHint: t("lookup.fill.attachmentsHint"),
                suggestionsHint: t("lookup.suggestionsHint"),
                none: t("lookup.noneOption"),
                fillLoading: t("productPicker.fillLoading"),
                fillError: t("productPicker.fillError"),
              }}
              pickerLabels={productPickerLabels(t)}
            />
            {/* Prazo (data, estreito) ao lado da observação. Adicionando a uma
              solicitação: o prazo é o SLA e a observação fica a dela. */}
            {addToRequest ? null : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="min-w-0">
                  {/* Prazo = SLA da Wellmix (Configurações); o servidor recalcula para o cliente. */}
                  {isWellmix(user) ? (
                    <Field
                      label={t("requests.deadline")}
                      hint={t("sla.wellmixHint", {
                        days: settings.quoteSlaBusinessDays,
                      })}
                    >
                      <Input
                        name="deadline"
                        type="date"
                        defaultValue={slaDate}
                      />
                    </Field>
                  ) : (
                    <Field
                      label={t("requests.deadline")}
                      hint={t("sla.customerHint", {
                        days: settings.quoteSlaBusinessDays,
                      })}
                    >
                      <Input
                        type="date"
                        value={slaDate}
                        readOnly
                        aria-readonly="true"
                        className="bg-zinc-50 text-zinc-700"
                      />
                    </Field>
                  )}
                </div>
                <Field label={t("common.note")}>
                  <Textarea
                    name="notes"
                    defaultValue={referenceNote}
                    rows={2}
                  />
                </Field>
              </div>
            )}
            <div className="border-t border-zinc-100 pt-3">
              <SubmitButton pendingText="...">
                {addToRequest ? t("reqAdd.submit") : t("common.send")}
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
