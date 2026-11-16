import { WELLMIX_TIERS } from "@/lib/order-terms";
import { redirect } from "next/navigation";
import {
  generateLabels,
  purchaseScheduleLabels,
} from "@/components/generate-labels";
import { STOCK_OPTION, isStockCustomer } from "@/lib/services/stock-party";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canSeeMoney } from "@/lib/auth/function-access";
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
  Textarea,
  TextLink,
  cx,
  formatDate,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { RequestItems } from "@/components/request-items";
import { RequestCustomerField } from "@/components/request-customer-field";
import { RequestCustomerProvider } from "@/components/request-customer-context";
import {
  RequestPeopleFields,
  type CustomerLogin,
  type RequestPeopleLabels,
} from "@/components/request-people-fields";
import { CustomerPurchaseHistory } from "@/components/customer-purchase-history";
import { RequestCustomerContacts } from "@/components/request-customer-contacts";
import { RequestOrderTerms } from "@/components/request-order-terms";
import {
  compositionLabels,
  customerContactsLabels,
  orderTermsLabels,
  productBrowserLabels,
} from "@/components/order-terms-labels";
import { ContainerComposition } from "@/components/container-composition";
import { SankhyaPurchaseHistory } from "@/components/sankhya-purchase-history";
import { sankhyaHistoryLabels } from "@/components/sankhya-history-labels";
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
import {
  createRequestAction,
  createSaleRequestAction,
  createTsRequestAction,
} from "../actions";
import {
  deleteRequestDraftAction,
  deleteScreenRequestDraftAction,
  saveRequestDraftAction,
  saveScreenRequestDraftAction,
} from "../actions/request-drafts";
import { parseRequestItems } from "../actions/request-items";
import {
  draftForm,
  getRequestDraft,
  listRequestDrafts,
} from "@/lib/services/request-drafts";
import type { InitialRequestRow } from "@/components/request-items";
import { canAddProducts } from "@/lib/services/requests";
import { launchDateOf, minFirstDate } from "@/lib/workflow/request-schedule";
import { lookupProductAction } from "../actions/lookup";
import { aiErrorText } from "@/i18n/ai-error";
import {
  REQUEST_SCREEN,
  REQUEST_SCREEN_FIELD,
  type RequestScreenMode,
} from "@/lib/request-screens";

/** O formulário da solicitação (o bloco do cliente fica fora dele, ligado pelo `form`). */
const FORM_ID = "new-request-form";

/** Parâmetros da URL da tela (os de `searchParams`, já lidos). */
export type NewRequestQuery = Record<string, string | string[] | undefined>;

/**
 * A Nova solicitação (dono, 15/11/2026; docs/ORDER_TERMS.md), em três telas
 * com o mesmo formulário (docs/REQUEST_SCREENS.md):
 *
 * - `mode` nulo: a de Encomendas (/app/requests/new), como sempre: Wellmix e
 *   cliente, compra para estoque, "Adicionar produto" e o tipo de operação
 *   escolhido no formulário (hoje só TS).
 * - "ts" e "sale": TS - Trading Sales e Venda - Encomenda (menu Produto
 *   novo), só da Wellmix vendendo ao cliente. O tipo de operação é o da tela
 *   (o servidor grava o dela), sem compra para estoque nem "Adicionar
 *   produto"; os rascunhos são os da tela.
 *
 * Função (e não componente) para a página manter o mesmo caminho de antes:
 * os `redirect` e `notFound` saem da própria página.
 */
export async function renderNewRequest({
  mode,
  query,
}: {
  mode: RequestScreenMode | null;
  query: NewRequestQuery;
}) {
  const screenDef = mode ? REQUEST_SCREEN[mode] : null;
  /** Endereço da tela (rascunhos, busca e avisos voltam para ela). */
  const basePath = screenDef?.path ?? "/app/requests/new";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (screenDef) {
    // TS e Venda (docs/REQUEST_SCREENS.md): quem abre a tela, e só a Wellmix.
    requireScreen(user, screenDef.screen);
    if (!isWellmix(user)) redirect("/app");
  } else {
    requireScreen(user, "requests");
    // Só o cliente e a Wellmix criam solicitação. Outro login que receba a tela
    // (Gestão de telas) fica na lista, vazia para ele: o catálogo de produtos
    // deste formulário não vai para quem não compra.
    if (!isWellmix(user) && user.role !== "customer") redirect("/app/requests");
  }
  const {
    error,
    productId,
    variantId,
    quantity,
    scheduleId,
    customerId: customerIdParam,
    lookup,
    addTo: addToParam,
    draft: draftParam,
    draftSaved,
    draftDeleted,
    created: createdParam,
  } = query;
  // "Adicionar produto" é só da tela de Encomendas.
  const addTo = screenDef ? undefined : addToParam;
  // Compra para estoque também (as telas de TS e de Venda vendem ao cliente).
  const customerId =
    screenDef &&
    typeof customerIdParam === "string" &&
    (customerIdParam === STOCK_OPTION || isStockCustomer(customerIdParam))
      ? undefined
      : customerIdParam;
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
  // Lançamento da solicitação (dono, 15/11/2026): a 1ª programação vale a
  // partir dele + 120 dias. Reaberta para acrescentar produtos, o gravado
  // nela; nova, hoje (ela é lançada ao enviar).
  const launchDate = launchDateOf(addToRequest?.createdAt ?? null);
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
  // Rascunho do vendedor (docs/ORDER_TERMS.md seção 9): o formulário volta
  // como foi salvo. Só de quem criou; nada é conferido até o envio.
  const draft =
    typeof draftParam === "string" && isWellmix(user) && !addTo
      ? await getRequestDraft(user, draftParam, mode)
      : null;
  const draftFields = draft ? draftForm(draft) : null;
  const draftValue = (key: string) => {
    const v = draftFields?.get(key);
    return typeof v === "string" ? v : "";
  };
  const draftRows: InitialRequestRow[] = (() => {
    if (!draftFields) return [];
    try {
      return parseRequestItems(draftFields).map((r) => ({
        productId: r.productId ?? "",
        variantId: r.variantId ?? "",
        notInCatalog: r.sourcingDemand && !r.productId,
        quantity: r.quantity === null ? "" : String(r.quantity),
        texts: {
          productName: r.productName,
          description: r.description,
          specification: r.specification ?? "",
        },
        schedule: r.schedule,
      }));
    } catch {
      return [];
    }
  })();
  const scheduleCustomerId =
    screenDef && schedule?.customerId && isStockCustomer(schedule.customerId)
      ? null
      : schedule?.customerId;
  const presetCustomerId =
    scheduleCustomerId ??
    (typeof customerId === "string" ? customerId : "") ??
    "";
  const initialCustomerId = presetCustomerId || draftValue("customerId");
  // Produto e cliente são escolhidos por busca (auditoria de performance,
  // 14/11/2026): o catálogo inteiro (~15 mil produtos, com a ficha de cada
  // um) e os ~26 mil clientes deixavam a página com 15 MB. Aqui só o que já
  // chega escolhido; a ficha de cada produto escolhido vem de
  // /api/products/fill (src/lib/services/request-product-fill.ts).
  const [hiddenByBooking, customerUsers, presetCustomer] = await Promise.all([
    // Booking: produto ainda não aprovado lá não é oferecido aqui, nem ao
    // cliente nem à Wellmix (para ela, a porta é "Gerar solicitação" no Booking).
    hiddenBookingProductIds(),
    // Logins de cliente, para a Wellmix indicar o login do cliente com
    // acesso (só ele, do lado do cliente, verá a solicitação e o pedido).
    isWellmix(user)
      ? store.list("users", {
          filter: { role: "customer", active: true },
          orderBy: "name",
        })
      : Promise.resolve([]),
    isWellmix(user) &&
    initialCustomerId &&
    initialCustomerId !== STOCK_OPTION &&
    !isStockCustomer(initialCustomerId)
      ? store.get("parties", initialCustomerId)
      : Promise.resolve(null),
  ]);
  // Produto do catálogo: ativo e fora do Booking (a regra da lista antiga).
  const inCatalog = (p: { active: boolean; id: string } | null | undefined) =>
    !!p && p.active && !hiddenByBooking.has(p.id);
  // Empresas dos logins de cliente: só os clientes ativos (a regra da
  // lista antiga do campo).
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
  // Logins de cada cliente, para o campo "Login do cliente com acesso": só
  // os do cliente escolhido aparecem (o servidor recusa login de outro).
  const loginsByCustomer: Record<string, CustomerLogin[]> = {};
  for (const c of requesterCustomers) {
    const logins = customerUsers
      .filter((u) => u.partyId === c.id)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }));
    if (logins.length) loginsByCustomer[c.id] = logins;
  }
  const requestPeopleLabels: RequestPeopleLabels = {
    requester: t("requestPeople.requester"),
    requesterHint: t("requestPeople.requesterHint"),
    rca: t("requestPeople.rca"),
    rcaHint: t("requestPeople.rcaHint"),
    rcaNone: t("requestPeople.rcaNone"),
    rcaPick: t("requestPeople.rcaPick"),
    rcaLoading: t("requestPeople.rcaLoading"),
    rcaError: t("requestPeople.rcaError"),
    rcaStock: t("requestPeople.rcaStock"),
    rcaUnknown: t("requestPeople.rcaUnknown", { code: "{code}" }),
    access: t("requestPeople.access"),
    accessHint: t("requestPeople.accessHint"),
    accessNone: t("requestPeople.accessNone"),
    accessPick: t("requestPeople.accessPick"),
    accessNoLogins: t("requestPeople.accessNoLogins"),
    accessStock: t("requestPeople.accessStock"),
    accessRequired: t("requestPeople.accessRequired"),
    accessChoose: t("requestPeople.accessChoose"),
  };
  // Cliente pré-escolhido (programação de compra, endereço): só cliente ativo.
  const initialCustomer =
    presetCustomer &&
    presetCustomer.type === "customer" &&
    presetCustomer.active &&
    !isStockCustomer(presetCustomer.id)
      ? {
          id: presetCustomer.id,
          name: presetCustomer.name,
          code: presetCustomer.sankhyaCode ?? null,
        }
      : null;

  /* Busca por foto ou link: resultado guardado em product_lookups (só de quem buscou ou Wellmix). */
  const found =
    typeof lookup === "string" ? await getLookup(user, lookup) : null;
  // Produtos sugeridos pela busca por foto/link e o pré-escolhido: só eles.
  const listedProducts = (
    await listByIds(store, "products", [
      ...(found?.matches ?? []).map((m) => m.productId),
      presetProductId,
      ...draftRows.map((r) => r.productId).filter(Boolean),
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
    return `${basePath}?${params.toString()}`;
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
          ? t(batchKey as DictionaryKey, {
              // A 1ª data permitida (schedule_too_soon).
              date: formatDate(minFirstDate(launchDate), t),
            })
          : t("common.error");
  /* Ficha do produto que já chega escolhido (vitrine, busca por foto,
     programação de compra): preenche a primeira linha sem esperar a busca. */
  const presetProduct = productById.get(presetProductId);
  const fillProducts = [
    ...(presetProduct ? [presetProduct] : []),
    ...draftRows
      .map((r) => productById.get(r.productId))
      .filter((p): p is NonNullable<typeof p> => !!p && p !== presetProduct),
  ];
  const productFills = fillProducts.length
    ? await requestProductFills(user, t, fillProducts)
    : [];
  // Os rascunhos do vendedor (a lista no alto da tela).
  const drafts =
    isWellmix(user) && !addToRequest ? await listRequestDrafts(user, mode) : [];

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
  // Venda ao cliente pela Wellmix (nova solicitação): bloco do cliente e
  // condições do pedido (docs/ORDER_TERMS.md). Fora da compra para estoque
  // (a tela esconde quando a caixa de estoque é marcada).
  const sellsToCustomer = isWellmix(user) && !addToRequest;
  // Textos do histórico gravado no portal (o card de sempre).
  const historyLabels = {
    title: t("purchaseHistory.title"),
    select: t("purchaseHistory.select"),
    loading: t("purchaseHistory.loading"),
    empty: t("purchaseHistory.empty"),
    error: t("purchaseHistory.error"),
    retry: t("purchaseHistory.retry"),
    more: t("purchaseHistory.more"),
    hint: t("purchaseHistory.hint"),
    current: t("purchaseHistory.current"),
    currentHint: t("purchaseHistory.currentHint"),
    rounds: t("purchaseHistory.rounds"),
    noItems: t("purchaseHistory.noItems"),
    details: t("purchaseHistory.details", { n: "{n}" }),
    open: t("purchaseHistory.open", { n: "{n}" }),
    // Histórico → pedido (docs/ORDER_TERMS.md seção 10): só na venda pela
    // Wellmix (o login do cliente vê o histórico sem acrescentar).
    ...(sellsToCustomer
      ? {
          pick: {
            add: t("historyPick.add"),
            inOrder: t("historyPick.inOrder"),
            filtered: t("historyPick.filtered", { n: "{n}" }),
          },
        }
      : {}),
  };
  const referenceNote = found?.url
    ? `${t("lookup.referenceNote")} ${found.url}`
    : "";
  // Telas de TS e de Venda: o estoque não vale (sem cliente não há venda).
  const startsStock =
    !screenDef &&
    (isStockCustomer(initialCustomerId) || initialCustomerId === STOCK_OPTION);
  const createdNumber =
    screenDef &&
    typeof createdParam === "string" &&
    /^\d{1,9}$/.test(createdParam)
      ? createdParam
      : null;

  return (
    <>
      <PageHeader
        help={{
          body: "help.requests.new.body",
          steps: "help.requests.new.steps",
        }}
        t={t}
        title={
          mode
            ? t(`requestScreen.${mode}.title`)
            : addToRequest
              ? addToRequest.number
                ? t("reqAdd.titleNumbered", { n: addToRequest.number })
                : t("reqAdd.title")
              : t("requests.new")
        }
        subtitle={
          mode ? (
            <span data-request-screen={mode}>
              {t(`requestScreen.${mode}.subtitle`)}
            </span>
          ) : undefined
        }
      />
      {createdNumber || (screenDef && createdParam === "ok") ? (
        <Alert tone="success">
          <span data-request-screen-created>
            {createdNumber
              ? t("requestScreen.createdNumbered", { n: createdNumber })
              : t("requestScreen.created")}
          </span>
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{errorText}</Alert> : null}
      {draftSaved === "1" && draft ? (
        <Alert tone="success">{t("requestDraft.saved")}</Alert>
      ) : null}
      {draftDeleted === "1" ? (
        <Alert tone="info">{t("requestDraft.deleted")}</Alert>
      ) : null}
      {/* Rascunhos do vendedor (dono, 15/11/2026; docs/ORDER_TERMS.md
          seção 9): reabrir para completar ou apagar. */}
      {drafts.length ? (
        <div className="mt-3" data-request-drafts>
          <Card title={t("requestDraft.title")}>
            <ul className="divide-y divide-zinc-100 text-sm">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className={cx(
                    "flex flex-wrap items-center justify-between gap-2 py-2",
                    draft?.id === d.id && "font-semibold",
                  )}
                  data-request-draft={d.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-zinc-900">
                      {d.title}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {[
                        d.customerName ?? t("requestDraft.noCustomer"),
                        t("requestDraft.updated", {
                          date: formatDate(d.updatedAt, t),
                        }),
                      ].join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {draft?.id === d.id ? (
                      <Badge tone="info">{t("requestDraft.open")}</Badge>
                    ) : (
                      <LinkButton
                        href={`${basePath}?draft=${encodeURIComponent(d.id)}`}
                        variant="secondary"
                        data-request-draft-open
                      >
                        {t("requestDraft.resume")}
                      </LinkButton>
                    )}
                    <form
                      action={
                        mode
                          ? deleteScreenRequestDraftAction
                          : deleteRequestDraftAction
                      }
                    >
                      <input type="hidden" name="draftId" value={d.id} />
                      {mode ? (
                        <input
                          type="hidden"
                          name={REQUEST_SCREEN_FIELD}
                          value={mode}
                        />
                      ) : null}
                      <button
                        type="submit"
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        data-request-draft-delete
                      >
                        {t("requestDraft.delete")}
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
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

      {/* Telas grandes: o formulário à esquerda (as duas linhas) e, à
          direita, a busca por foto/link e, embaixo dela, o histórico de
          compras do cliente, com as larguras de sempre (dono, 15/11/2026; antes
          a coluna estreita ficava à esquerda). No celular e no iPad em pé:
          busca, formulário e, por último, o histórico. A grade é o próprio
          provedor do cliente escolhido (o histórico lê). */}
      <RequestCustomerProvider
        className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]"
        initial={initialCustomer}
        initialStock={startsStock}
        originTerms={sellsToCustomer}
      >
        {/* Bloco do cliente (dono, 15/11/2026; docs/ORDER_TERMS.md): no lugar
            da busca por foto ou link, a Wellmix atualiza os contatos do
            cliente (às cegas na primeira vez; depois, com "Editar"). */}
        {sellsToCustomer ? (
          <RequestCustomerContacts
            key={draft?.id ?? "new"}
            formId={FORM_ID}
            initialValues={Object.fromEntries(
              [...(draftFields?.entries() ?? [])].filter(
                (e): e is [string, string] =>
                  e[0].startsWith("contact.") && typeof e[1] === "string",
              ),
            )}
            labels={customerContactsLabels(t)}
            className="max-w-2xl lg:col-start-2 lg:row-start-1 lg:max-w-none"
          />
        ) : null}
        {/* Busca do produto por foto ou link: procura no catálogo e sugere os campos.
          Fora do modo "adicionar à solicitação" (a busca recarrega a tela sem ele)
          e, na Wellmix, trocada pelo bloco do cliente (acima). O cliente segue com ela. */}
        {addToRequest || sellsToCustomer ? null : (
          <Card
            title={t("lookup.title")}
            className="max-w-2xl lg:col-start-2 lg:row-start-1 lg:max-w-none"
          >
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
                    href={`${basePath}?${new URLSearchParams({ lookup: found.id, ...(presetCustomerId ? { customerId: presetCustomerId } : {}) }).toString()}`}
                    className="text-xs"
                  >
                    {t("lookup.none")}
                  </TextLink>
                ) : null}
                <TextLink
                  href={`${basePath}${presetCustomerId ? `?customerId=${encodeURIComponent(presetCustomerId)}` : ""}`}
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
            addToRequest
              ? "lg:col-span-2"
              : "lg:col-start-1 lg:row-span-2 lg:row-start-1",
          )}
        >
          {/* key: ao escolher um produto da busca (mesma rota, outro ?productId) o formulário
            é recriado, senão o navegador mantém o valor anterior dos campos. */}
          <form
            id={FORM_ID}
            key={`${found?.id ?? "none"}-${presetProductId}-${presetVariantId}-${initialCustomerId}-${draft?.id ?? ""}-${draft?.updatedAt ?? ""}`}
            action={
              mode === "ts"
                ? createTsRequestAction
                : mode === "sale"
                  ? createSaleRequestAction
                  : createRequestAction
            }
            className="space-y-3"
            data-request-screen-form={mode ?? "requests"}
          >
            {/* Tela de TS ou de Venda: o rascunho fica marcado com ela (o
                servidor confere a tela de quem envia). */}
            {mode ? (
              <input type="hidden" name={REQUEST_SCREEN_FIELD} value={mode} />
            ) : null}
            {found ? (
              <input type="hidden" name="lookupId" value={found.id} />
            ) : null}
            {draft ? (
              <input type="hidden" name="draftId" value={draft.id} />
            ) : null}
            {addToRequest ? (
              <input type="hidden" name="addTo" value={addToRequest.id} />
            ) : null}
            {schedule ? (
              <input type="hidden" name="scheduleId" value={schedule.id} />
            ) : null}
            {/* Cliente e as pessoas da solicitação (Wellmix; dono,
                15/11/2026, docs/CUSTOMER_RCA.md): Cliente | Login do cliente
                com acesso; Solicitante | RCA do cliente. */}
            {isWellmix(user) && !addToRequest ? (
              <div className="grid gap-3 sm:grid-cols-2" data-request-people>
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
                    allowStock={!screenDef}
                    initial={initialCustomer}
                    initialStock={startsStock}
                    ariaLabel={t("common.customer")}
                    labels={partyPickerLabels(t, true)}
                    summary={{
                      code: t("orderTerms.summaryCode", { code: "{code}" }),
                      none: "—",
                    }}
                  />
                </div>
                <RequestPeopleFields
                  requesterName={user.name}
                  loginsByCustomer={loginsByCustomer}
                  labels={requestPeopleLabels}
                  loginRequired={sellsToCustomer}
                  initialLogin={draftValue("requestedForUserId")}
                />
              </div>
            ) : null}
            {/* Condições do pedido (dono, 15/11/2026; docs/ORDER_TERMS.md):
                tipo de operação, formato de venda, entrega, país de origem e
                grupo (antes dos produtos: a busca só oferece os deles) e o
                aviso de que não há devoluções. */}
            {sellsToCustomer ? (
              <RequestOrderTerms
                labels={
                  screenDef
                    ? {
                        ...orderTermsLabels(t),
                        operationFixed: t(`requestScreen.${mode!}.fixed`),
                      }
                    : orderTermsLabels(t)
                }
                fixedOperation={screenDef?.operation}
                initial={{
                  operationType: draftValue("operationType"),
                  saleFormat: draftValue("saleFormat"),
                  wellmixTier: draftValue("wellmixTier"),
                  carrier: draftValue("carrier"),
                  redispatchCarrier: draftValue("redispatchCarrier"),
                  deliveryFreightBrl: draftValue("deliveryFreightBrl"),
                  carrierCaller: draftValue("carrierCaller"),
                  redispatch: draftValue("redispatch"),
                  originCountry: draftValue("originCountry"),
                  productFamily: draftValue("productFamily"),
                }}
              />
            ) : null}
            {/* O próprio cliente (dono, 15/11/2026): ele é o solicitante e o
                login com acesso (o servidor grava pela sessão). */}
            {user.role === "customer" && !addToRequest ? (
              <div
                className="grid gap-3 sm:grid-cols-2"
                data-request-people="self"
              >
                <Field
                  label={t("requestPeople.requester")}
                  hint={t("requestPeople.requesterHint")}
                >
                  <Input
                    readOnly
                    value={user.name}
                    className="bg-zinc-50 text-zinc-700"
                    data-request-requester
                  />
                </Field>
                <Field
                  label={t("requestPeople.access")}
                  hint={t("requestPeople.self")}
                >
                  <Input
                    readOnly
                    value={`${user.name} (${user.email})`}
                    className="bg-zinc-50 text-zinc-700"
                    data-request-access="self"
                  />
                </Field>
              </div>
            ) : null}
            {/* Produtos: uma linha por produto ("+ Adicionar outro produto"); cada um vira uma solicitação do mesmo lote.
              Em cada linha: "fora do catálogo" primeiro; escolher um produto preenche os campos com a ficha; anexos só fora do catálogo. */}
            <RequestItems
              containerTypes={settings.containerTypes.map((c) => ({
                code: c.code,
                capacityCbm: c.capacityCbm,
              }))}
              launchDate={launchDate}
              initialPlan={
                addToRequest?.schedule ??
                draftRows.find((r) => r.schedule)?.schedule ??
                null
              }
              initialRows={draftRows}
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
                inOrder: {
                  title: t("reqBatch.inOrder"),
                  hint: t("reqBatch.inOrderHint"),
                  expand: t("reqBatch.expand"),
                  collapse: t("reqBatch.collapse"),
                  product: t("reqBatch.colProduct"),
                  variant: t("reqBatch.colVariant"),
                  quantity: t("reqBatch.colQuantity"),
                  status: t("reqBatch.colStatus"),
                  complete: t("reqBatch.complete"),
                  incomplete: t("reqBatch.incomplete"),
                  incompleteHint: t("reqBatch.incompleteHint"),
                  outside: t("reqBatch.outside"),
                  noProduct: t("reqBatch.noProduct"),
                },
                hint: t("reqBatch.hint"),
                quantity: t("common.quantity"),
                unit: t("requests.unit"),
                moq: t("reqProduct.moq", { n: "{n}", unit: "{unit}" }),
                belowMoq: t("reqProduct.belowMoq", {
                  n: "{n}",
                  unit: "{unit}",
                }),
                moqCartons: t("reqProduct.moqCartons", {
                  n: "{n}",
                  unit: "{unit}",
                  cartons: "{cartons}",
                }),
                belowMoqCartons: t("reqProduct.belowMoqCartons", {
                  n: "{n}",
                  unit: "{unit}",
                  cartons: "{cartons}",
                }),
                intl: t.intl,
                // O bloco "Programação de compra" da Seleção de itens (dono,
                // 14/11/2026): os mesmos textos; a explicação diz para onde a
                // programação da solicitação vai.
                schedule: purchaseScheduleLabels(
                  t,
                  t.intl,
                  t("purchaseRounds.form.hintRequest"),
                ),
                // O card "Gerar programação pela quantidade" da Seleção de
                // itens, com os textos do produto escolhido acima.
                generate: {
                  ...generateLabels(t, t("reqSchedule.gen.chooseProduct")),
                  noPieces: t("reqSchedule.gen.noPieces"),
                  noCarton: t("reqSchedule.gen.noCarton"),
                  noData: t("reqSchedule.gen.noData"),
                  regenerate: t("reqSchedule.gen.regenerate"),
                  roundsFixed: t("orderPlan.roundsFixed"),
                },
                plan: {
                  title: t("orderPlan.title"),
                  hint: t("orderPlan.hint"),
                  count: t("orderPlan.count"),
                  countHint: t("orderPlan.countHint"),
                  single: t("orderPlan.single"),
                  interval: t("purchaseRounds.form.interval"),
                  days: t("purchaseRounds.form.days", { n: "{n}" }),
                  custom: t("purchaseRounds.form.custom"),
                  firstDate: t("purchaseRounds.form.firstDate"),
                  n: t("orderPlan.n", { n: "{n}" }),
                  dates: t("orderPlan.dates"),
                  minDate: t("orderPlan.minDate", {
                    date: "{date}",
                    launch: "{launch}",
                  }),
                  tooSoon: t("orderPlan.tooSoon", { date: "{date}" }),
                  datesHint: t("orderPlan.datesHint"),
                  manual: t("orderPlan.manual"),
                  edit: t("orderPlan.edit", { n: "{n}" }),
                  unpin: t("orderPlan.unpin", { n: "{n}" }),
                  issues: t("orderPlan.issues"),
                  issue: t("orderPlan.issue", {
                    n: "{n}",
                    prev: "{prev}",
                    date: "{date}",
                  }),
                },
                generateOutside: t("reqSchedule.gen.outside"),
                pieces: t("reqSchedule.pieces"),
                piecesHint: t("reqSchedule.piecesHint"),
                piecesScheduledHint: t("purchaseRounds.form.quantityOff"),
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
                lockedHint: t("orderPlan.lockedHint"),
                originFirst: t("orderTerms.originFirst"),
                ...(isWellmix(user)
                  ? { browser: productBrowserLabels(t) }
                  : {}),
                ...(isWellmix(user)
                  ? {
                      forecast: {
                        intl: t.intl,
                        title: t("priceForecast.title"),
                        hint: t("priceForecast.hint"),
                        view: t("priceForecast.view"),
                        target: t("priceForecast.target"),
                        targetField: t("priceForecast.targetField"),
                        calculate: t("priceForecast.calculate"),
                        loading: t("priceForecast.loading"),
                        noProduct: t("priceForecast.noProduct"),
                        manual: t("priceForecast.manual"),
                        error: t("priceForecast.error"),
                        sale: t("priceForecast.sale"),
                        table: t("priceForecast.table"),
                        wholesale: t("priceForecast.wholesale"),
                        retail: t("priceForecast.retail"),
                        goal: t("priceForecast.goal"),
                        cost: t("priceForecast.cost"),
                        profit: t("priceForecast.profit"),
                        profitValue: t("priceForecast.profitValue", {
                          profit: "{profit}",
                          goal: "{goal}",
                        }),
                        resultTarget: t("priceForecast.resultTarget", {
                          target: "{target}",
                        }),
                        source: t("priceForecast.source"),
                        auditTitle: t("priceForecast.auditTitle"),
                        auditInputs: t("priceForecast.auditInputs", {
                          fn: "{fn}",
                        }),
                        auditDefaults: t("priceForecast.auditDefaults"),
                        auditOutputs: t("priceForecast.auditOutputs"),
                        canSolve: canSeeMoney(user),
                        productPrice: t("priceForecast.productPrice"),
                        freightUnit: t("priceForecast.freightUnit"),
                        withFreight: t("priceForecast.withFreight"),
                        wdPrice: t("priceForecast.wdPrice"),
                        wdWithFreight: t("priceForecast.wdWithFreight"),
                        wdBase: t("priceForecast.wdBase"),
                        wdPercent: t("priceForecast.wdPercent"),
                        goalReached: t("priceForecast.goalReached"),
                        goalYes: t("priceForecast.goalYes"),
                        goalNo: t("priceForecast.goalNo"),
                        freightPending: t("priceForecast.freightPending"),
                        quotePending: t("priceForecast.quotePending"),
                        sent: t("priceForecast.sent", {
                          format: "{format}",
                          vip: "{vip}",
                          route: "{route}",
                          freight: "{freight}",
                        }),
                        freightNull: t("priceForecast.freightNull"),
                        price: t("priceForecast.price"),
                        rowTotal: t("priceForecast.rowTotal"),
                        noQuantity: t("priceForecast.noQuantity"),
                        formats: {
                          wd: t("orderTerms.format.wd"),
                          wellmix: t("orderTerms.format.wellmix"),
                          ...Object.fromEntries(
                            WELLMIX_TIERS.map((k) => [
                              k,
                              `${t("orderTerms.format.wellmix")} · ${t(`orderTerms.tier.${k}`)}`,
                            ]),
                          ),
                        },
                      },
                    }
                  : {}),
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
                        defaultValue={draftValue("deadline") || slaDate}
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
                    defaultValue={draftValue("notes") || referenceNote}
                    rows={2}
                  />
                </Field>
              </div>
            )}
            <div className="border-t border-zinc-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <SubmitButton pendingText="...">
                  {addToRequest ? t("reqAdd.submit") : t("common.send")}
                </SubmitButton>
                {/* Rascunho (dono, 15/11/2026): grava como está, sem
                    conferir; o vendedor completa depois. */}
                {sellsToCustomer ? (
                  <button
                    type="submit"
                    formAction={
                      mode
                        ? saveScreenRequestDraftAction
                        : saveRequestDraftAction
                    }
                    formNoValidate
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                    data-request-draft-save
                  >
                    {t("requestDraft.save")}
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </Card>

        {/* Lateral fixa (dono, 15/11/2026): a Composição de containers e,
            embaixo dela, o Histórico de compras do cliente acompanham a
            rolagem da página (sticky), sempre na lateral nas telas grandes.
            Fora do "adicionar à solicitação". */}
        {addToRequest ? null : (
          <div
            className="min-w-0 max-w-2xl lg:col-start-2 lg:row-start-2 lg:max-w-none lg:self-stretch"
            data-request-side
          >
            {/* Composição fixa no alto; só o histórico rola, dentro do
                espaço que sobra (dono, 15/11/2026): ver os produtos mais
                abaixo no histórico não tira a composição da tela. */}
            <div
              className="space-y-4 lg:sticky lg:top-[4.75rem] lg:z-20 lg:flex lg:max-h-[calc(100dvh-5.75rem)] lg:flex-col lg:gap-4 lg:space-y-0"
              data-request-side-sticky
            >
              <div className="lg:max-h-[60%] lg:shrink-0 lg:overflow-y-auto">
                <ContainerComposition labels={compositionLabels(t)} />
              </div>
              <div
                className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
                data-request-history-scroll
              >
                {/* Histórico de compras do cliente (dono, 14/11/2026;
            docs/PURCHASE_HISTORY.md): os pedidos do cliente escolhido; o login
            do cliente vê os dele. Fora do "adicionar à solicitação" (o cliente
            já é o da solicitação). */}
                {addToRequest ? null : isWellmix(user) ? (
                  // Wellmix (dono, 15/11/2026): o histórico lido na hora no Sankhya
                  // (docs/PURCHASE_HISTORY.md seção 9); sem Sankhya configurado ou
                  // sem o código do cliente, o histórico gravado no portal.
                  <SankhyaPurchaseHistory
                    labels={sankhyaHistoryLabels(t)}
                    fallback={
                      <CustomerPurchaseHistory labels={historyLabels} />
                    }
                  />
                ) : (
                  <CustomerPurchaseHistory self labels={historyLabels} />
                )}
              </div>
            </div>
          </div>
        )}
      </RequestCustomerProvider>
    </>
  );
}
