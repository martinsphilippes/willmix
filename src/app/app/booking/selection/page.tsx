import { isWellmix } from "@/lib/auth/permissions";
import { LiveSearch } from "@/components/live-search";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  bestCostItem,
  priceInUsd,
  sheetQuantity,
  similarQuery,
} from "@/lib/supplier-requests";
import {
  listSelectionItems,
  type SelectionRow,
} from "@/lib/services/supplier-requests";
import {
  DEFAULT_SELECTION_STATUSES,
  SELECTION_STATUSES,
  filtersToParams,
  groupForBlock,
  parseGroupIds,
  parseSelectionFilters,
  searchSuggestions,
  suggestBlocks,
} from "@/lib/booking-selection";
import { DateRangePicker } from "@/components/date-range-picker";
import { SelectionBasket } from "@/components/selection-basket";
import { AutoSubmit } from "@/components/auto-submit";
import { getFxRates } from "@/lib/services/fx";
import { getSettings } from "@/lib/settings";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  cx,
  formatDate,
  formatMoney,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SelectionQuantity } from "@/components/selection-quantity";
import {
  openGroupRequestsAction,
  saveSelectionGroupAction,
} from "../../actions/supplier-requests";
import { listSelectionGroups } from "@/lib/services/selection-groups";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
import { canOpen } from "@/lib/auth/screens";
import { partiesWithoutLogin } from "@/lib/services/portal-access";
import { TableTools } from "@/components/table-tools";
import {
  BookingItemSuperplan,
  bookingItemCost,
} from "@/components/booking-item-superplan";

/*
 * Seleção de itens (docs/SUPPLIER_REQUESTS.md): duas abas.
 * - Itens: os itens dos bookings (rascunho incluído) com filtros de status,
 *   intervalo de datas, fornecedor e origem e a busca por qualquer campo;
 *   cada linha entra na cesta (uma a uma ou todas as da tela) e "Agrupar"
 *   leva os marcados, de vários fornecedores, para a aba Seleção.
 * - Seleção: o grupo para comparar e os blocos sugeridos de itens parecidos
 *   pelo nome. A Wellmix marca o escolhido e as alternativas e abre a
 *   solicitação ao fornecedor do escolhido (o booking precisa estar fechado).
 * Nada de produto, cliente ou estoque nasce aqui.
 */

const FORM = "selection-form";

export default async function BookingSelectionPage({
  searchParams,
}: PageProps<"/app/booking/selection">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/booking/selection");
  requireScreen(user, "booking");
  // Só a Wellmix: o login externo com a tela Booking vê só os bookings dele.
  if (!isWellmix(user)) redirect("/app/booking");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 200) : "";
  const error = typeof query.error === "string" ? query.error : "";
  const tab = query.tab === "selection" ? "selection" : "items";
  const filters = parseSelectionFilters(query);
  const groupIds = parseGroupIds(query.ids);
  const t = await getT();
  const [result, group, fx, savedGroups, settings] = await Promise.all([
    listSelectionItems(user, q, { filters }),
    groupIds.length
      ? listSelectionItems(user, "", { ids: groupIds })
      : Promise.resolve(null),
    getFxRates(),
    tab === "selection" ? listSelectionGroups(user) : Promise.resolve([]),
    getSettings(),
  ]);
  const containerTypes = settings.containerTypes.map((c) => ({
    code: c.code,
    capacityCbm: c.capacityCbm,
  }));
  const usd = fx.rates.USD ?? null;
  const rmb = fx.rates.RMB ?? null;
  const rmbPerUsd = usd && rmb ? usd / rmb : null;

  const errorKey = [`supplierRequests.error.${error}`, `common.${error}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);

  const intl = t.intl;
  const num = (n: number | null, digits = 4) =>
    n === null
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const col = (k: string) =>
    t(`supplierRequests.selection.col.${k}` as DictionaryKey);
  const listRows = result?.rows ?? [];
  const groupRows = group?.rows ?? [];
  // A tabela de comparação: na aba Seleção, o grupo; na aba Itens, a lista.
  const rows = tab === "selection" ? groupRows : listRows;
  const best = bestCostItem(rows.map((r) => r.item));
  const blocks =
    tab === "selection" && result
      ? suggestBlocks(
          result.all.map((r) => ({
            item: r.item,
            supplierId: r.lot.supplierId,
          })),
        )
      : [];
  const rowById = new Map((result?.all ?? []).map((r) => [r.item.id, r]));
  // Escolha gravada (ainda não enviada) do grupo aberto: volta preenchida.
  const current =
    tab === "selection" && groupIds.length
      ? groupForBlock(
          groupIds,
          savedGroups.map((e) => e.group).filter((g) => g.status === "saved"),
        )
      : null;
  // Blocos sugeridos com a escolha de cada um; depois, as escolhas de grupos
  // montados à mão (que não batem com nenhum bloco).
  const blockCards = blocks.map((b) => ({
    key: b.ids.join(","),
    label: b.label.join(" ") || "—",
    ids: b.ids,
    suppliers: b.suppliers as number | null,
    entry:
      savedGroups.find(
        (e) =>
          e.group ===
          groupForBlock(
            b.ids,
            savedGroups.map((x) => x.group),
          ),
      ) ?? null,
  }));
  const usedGroups = new Set(blockCards.map((c) => c.entry?.group.id));
  const cards = [
    ...blockCards,
    ...savedGroups
      .filter((e) => !usedGroups.has(e.group.id))
      .map((e) => ({
        key: e.group.id,
        label:
          e.chosen?.description ??
          e.chosen?.productName ??
          e.chosen?.factoryItemCode ??
          "—",
        ids: e.group.itemIds,
        suppliers: null as number | null,
        entry: e as (typeof savedGroups)[number] | null,
      })),
  ];
  // Em cima os resolvidos (esperando a solicitação), depois os blocos por
  // resolver e, separados embaixo, os que já têm solicitação aberta.
  const cardSections = (["saved", "pending", "requested"] as const).map(
    (key) => ({
      key,
      cards: cards.filter((c) => (c.entry?.group.status ?? "pending") === key),
    }),
  );
  const savedCount = savedGroups.filter(
    (e) => e.group.status === "saved",
  ).length;
  const savedNotice = query.saved === "1";
  const openedCount =
    typeof query.opened === "string" ? Number(query.opened) || 0 : null;
  const failedCount =
    typeof query.failed === "string" ? Number(query.failed) || 0 : 0;
  const why = typeof query.why === "string" ? query.why : "";
  const whyKey = `supplierRequests.error.${why}`;
  const whyText =
    failedCount && whyKey in dictionaries.pt
      ? t(whyKey as DictionaryKey)
      : null;
  // Fornecedores sem login: a solicitação aberta a eles fica parada.
  const rowSuppliers = new Map(
    rows
      .filter((r) => r.supplier)
      .map((r) => [r.supplier!.id, r.supplier!.name] as const),
  );
  const noLoginIds = await partiesWithoutLogin([...rowSuppliers.keys()]);
  const noLogin = [...noLoginIds]
    .map((id) => ({ id, name: rowSuppliers.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const th =
    "border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap text-zinc-500";
  const td =
    "border-b border-zinc-100 px-2 py-2 align-top text-[13px] text-zinc-800";

  const filterParams = filtersToParams(filters, q);
  const tabHref = (k: "items" | "selection") => {
    const p = new URLSearchParams(filterParams);
    if (k === "selection") {
      p.set("tab", "selection");
      if (groupIds.length) p.set("ids", groupIds.join(","));
    }
    const qs = p.toString();
    return qs ? `/app/booking/selection?${qs}` : "/app/booking/selection";
  };
  const groupHref = (ids: string[]) => {
    const p = new URLSearchParams(filterParams);
    p.set("tab", "selection");
    p.set("ids", ids.join(","));
    return `/app/booking/selection?${p.toString()}`;
  };
  const statuses = filters.statuses.length
    ? filters.statuses
    : DEFAULT_SELECTION_STATUSES;
  const suggestions = result
    ? searchSuggestions(
        result.all.flatMap((r) => [
          r.item.description,
          r.item.productName,
          r.item.factoryItemCode,
          r.item.material,
          r.item.packageType,
          r.supplier?.name,
          r.lot.origin,
        ]),
      )
    : [];
  const filtered =
    !!q ||
    filters.statuses.length > 0 ||
    !!filters.from ||
    !!filters.to ||
    !!filters.supplierId ||
    !!filters.origin;

  /**
   * Tabela dos itens. Na aba Itens (`basket`) ela só agrupa: sem "Escolher",
   * sem "Alternativa" e sem o quadro de abrir a solicitação (decisão do dono:
   * a solicitação abre só na aba Seleção, com o grupo).
   */
  const comparison = (list: SelectionRow[], basket: boolean) => {
    const costHint = (
      <p className="text-xs text-zinc-500" data-selection-cost-hint>
        {t("supplierRequests.selection.costHint")}
      </p>
    );
    const table = (
      <TableTools className="" tableClassName="min-w-0" data-selection-items="">
        <thead>
          <tr>
            <th className={th}>
              {basket ? (
                <input
                  type="checkbox"
                  data-basket-all
                  aria-label={t("supplierRequests.selection.pickAll")}
                  title={t("supplierRequests.selection.pickAll")}
                />
              ) : null}
            </th>
            {[
              ...(basket ? [] : ["choose", "alternative"]),
              "photo",
              "item",
              "supplier",
              "booking",
              "price",
              "priceUsd",
              "moq",
              "box",
              "cbm",
              "size",
              "capacity",
              "material",
              "sheetQty",
              "costPiece",
              "superplan",
              "situation",
            ].map((k) => (
              <th key={k} className={th}>
                {col(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map(({ item, lot, supplier, activeRequest }) => {
            const a = item.analysis;
            const cost = bookingItemCost(a);
            const draft = lot.status === "draft";
            const busy = !!activeRequest || draft;
            const priceUsd = priceInUsd(item.price, item.currency, rmbPerUsd);
            const similar = similarQuery(item);
            return (
              <tr
                key={item.id}
                className={cx(
                  "transition hover:bg-brand-50/40",
                  item.id === best && "bg-emerald-50/50",
                )}
                data-selection-item={item.id}
              >
                <td className={cx(td, "text-center")}>
                  {basket ? (
                    <input
                      type="checkbox"
                      value={item.id}
                      data-basket-item
                      aria-label={`${t("supplierRequests.selection.pick")} ${item.description ?? item.factoryItemCode ?? ""}`}
                    />
                  ) : null}
                </td>
                {basket ? null : (
                  <>
                    <td className={cx(td, "text-center")}>
                      <input
                        type="radio"
                        name="chosen"
                        value={item.id}
                        disabled={busy}
                        defaultChecked={
                          !busy && current?.chosenItemId === item.id
                        }
                        title={
                          draft
                            ? t("supplierRequests.selection.draftHint")
                            : undefined
                        }
                        aria-label={`${col("choose")} ${item.description ?? item.factoryItemCode ?? ""}`}
                        data-selection-choose={item.id}
                      />
                    </td>
                    <td className={cx(td, "text-center")}>
                      <input
                        type="checkbox"
                        name="alternatives"
                        value={item.id}
                        aria-label={`${col("alternative")} ${item.description ?? item.factoryItemCode ?? ""}`}
                        data-selection-alternative={item.id}
                      />
                    </td>
                  </>
                )}
                <td className={td}>
                  {item.photoDocumentId ? (
                    <a
                      href={`/api/files/${item.photoDocumentId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                      <img
                        src={`/api/files/${item.photoDocumentId}`}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 rounded border border-zinc-200 object-cover"
                      />
                    </a>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className={td}>
                  <span className="block max-w-64 min-w-44 whitespace-normal font-medium">
                    {item.description ?? item.productName ?? "—"}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {[item.factoryItemCode, item.colorAssortment]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {similar ? (
                    <Link
                      href={`/app/booking/selection?q=${encodeURIComponent(similar)}`}
                      className={cx(linkClass, "text-xs")}
                      data-selection-similar={item.id}
                    >
                      {t("supplierRequests.selection.similar")}
                    </Link>
                  ) : null}
                  {basket && lot.status !== "cancelled" ? (
                    <Link
                      href={`/app/booking/invite/${item.id}`}
                      className={cx(linkClass, "ml-2 text-xs")}
                      title={t("bookingInvites.selection.inviteHint")}
                      data-selection-invite={item.id}
                    >
                      {t("bookingInvites.selection.invite")}
                    </Link>
                  ) : null}
                </td>
                <td className={td}>
                  <span className="block max-w-40 min-w-28 whitespace-normal">
                    {supplier?.name ?? "—"}
                  </span>
                  {supplier && noLoginIds.has(supplier.id) ? (
                    <span data-selection-no-login={supplier.id}>
                      <Badge tone="warning">{t("portalAccess.none")}</Badge>
                    </span>
                  ) : null}
                  <span className="block text-xs text-zinc-500">
                    {lot.origin ?? ""}
                  </span>
                </td>
                <td className={cx(td, "whitespace-nowrap")}>
                  <Link
                    href={`/app/booking/lots/${lot.id}`}
                    className={linkClass}
                  >
                    nº {lot.number}
                  </Link>
                  {lot.status !== "closed" ? (
                    <span
                      className="block"
                      data-selection-lot-status={lot.status}
                    >
                      <Badge tone={draft ? "warning" : "neutral"}>
                        {t(`bookingLots.status.${lot.status}` as DictionaryKey)}
                      </Badge>
                    </span>
                  ) : null}
                  <span className="block text-xs text-zinc-500">
                    {formatDate(lot.bookingDate, t)}
                  </span>
                </td>
                <td className={cx(td, "whitespace-nowrap tabular-nums")}>
                  {num(item.price)} {item.currency ?? ""}
                  {item.incoterm ? (
                    <span className="block text-xs text-zinc-500">
                      {item.incoterm}
                    </span>
                  ) : null}
                </td>
                <td className={cx(td, "whitespace-nowrap tabular-nums")}>
                  {priceUsd === null ? "—" : `US$ ${num(priceUsd, 3)}`}
                </td>
                <td className={cx(td, "tabular-nums")}>{num(item.moq, 0)}</td>
                <td className={cx(td, "tabular-nums")}>
                  {num(item.masterCartonQty, 0)}
                  {item.innerQty ? (
                    <span className="block text-xs text-zinc-500">
                      inner {num(item.innerQty, 0)}
                    </span>
                  ) : null}
                </td>
                <td className={cx(td, "tabular-nums")}>
                  {num(item.cbmPerCarton)}
                </td>
                <td className={cx(td, "whitespace-nowrap tabular-nums")}>
                  {[item.lengthCm, item.widthCm, item.heightCm]
                    .map((n) => num(n, 2))
                    .join(" × ")}
                </td>
                <td className={cx(td, "tabular-nums")}>
                  {item.capacityMl === null && item.sizeText
                    ? item.sizeText
                    : num(item.capacityMl, 0)}
                </td>
                <td className={td}>
                  <span className="block max-w-36 whitespace-normal">
                    {item.material ?? "—"}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {item.packageType ?? ""}
                  </span>
                </td>
                <td className={cx(td, "tabular-nums")}>
                  {num(sheetQuantity(item), 0)}
                </td>
                <td
                  className={cx(td, "whitespace-nowrap tabular-nums")}
                  data-sort={cost ?? ""}
                  data-selection-cost={item.id}
                >
                  {cost !== null ? (
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-semibold text-zinc-900">
                        {formatMoney(cost, "BRL", t)}
                      </span>
                      {item.id === best ? (
                        <Badge tone="success">
                          {t("supplierRequests.selection.best")}
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className={td}>
                  {a ? (
                    <BookingItemSuperplan analysis={a} t={t} />
                  ) : (
                    <span className="text-zinc-500">
                      {t("booking.signal.none")}
                    </span>
                  )}
                </td>
                <td className={td}>
                  {activeRequest ? (
                    <Link
                      href={`/app/supplier-requests/${activeRequest.id}`}
                      className={linkClass}
                    >
                      {t("supplierRequests.selection.inRequest", {
                        n: activeRequest.number,
                      })}
                    </Link>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableTools>
    );
    if (basket)
      return (
        <div className="space-y-4" data-selection-list>
          {costHint}
          {table}
        </div>
      );
    return (
      <form
        id={FORM}
        action={saveSelectionGroupAction}
        className="space-y-4"
        data-selection-form
      >
        <input type="hidden" name="filters" value={filterParams.toString()} />
        <input
          type="hidden"
          name="group"
          value={list.map((r) => r.item.id).join(",")}
        />
        {costHint}
        {table}

        <Card title={t("supplierRequests.selection.form.title")}>
          <p className="mb-3 text-sm text-zinc-600">
            {t("supplierRequests.selection.form.body")}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <SelectionQuantity
              label={t("supplierRequests.selection.form.quantity")}
              hint={t("supplierRequests.selection.form.quantityHint")}
              scheduledHint={t("purchaseRounds.form.quantityOff")}
              defaultQuantity={current?.quantity ?? null}
              schedule={current?.schedule ?? null}
              chosenItemId={current?.chosenItemId ?? null}
              containerTypes={containerTypes}
              items={list.map(({ item }) => ({
                id: item.id,
                masterCartonQty: item.masterCartonQty,
                cbmPerCarton:
                  item.cbmPerCarton ??
                  cbmFromDimensions(item.lengthCm, item.widthCm, item.heightCm),
                sheetQty: sheetQuantity(item),
              }))}
              gen={{
                title: t("purchaseRounds.gen.title"),
                hint: t("purchaseRounds.gen.hint"),
                total: t("purchaseRounds.gen.total"),
                container: t("purchaseRounds.gen.container"),
                perRound: t("purchaseRounds.gen.perRound"),
                rounds: t("purchaseRounds.gen.rounds"),
                submit: t("purchaseRounds.gen.submit"),
                item: t("purchaseRounds.gen.item", {
                  pcs: "{pcs}",
                  cbm: "{cbm}",
                  cartons: "{cartons}",
                  pieces: "{pieces}",
                  container: "{container}",
                }),
                noItem: t("purchaseRounds.gen.noItem"),
                noCarton: t("purchaseRounds.gen.noCarton"),
                tooBig: t("purchaseRounds.gen.tooBig", {
                  cbm: "{cbm}",
                  container: "{container}",
                  cap: "{cap}",
                }),
                errorTotal: t("purchaseRounds.gen.errorTotal"),
                result: t("purchaseRounds.gen.result", {
                  rounds: "{rounds}",
                  cartons: "{cartons}",
                  cbm: "{cbm}",
                  containers: "{containers}",
                  container: "{container}",
                }),
                extra: t("purchaseRounds.gen.extra", { extra: "{extra}" }),
                raised: t("purchaseRounds.gen.raised", {
                  max: "{max}",
                  n: "{n}",
                }),
                last: t("purchaseRounds.gen.last", { pct: "{pct}" }),
                fillUp: t("purchaseRounds.gen.fillUp", { pieces: "{pieces}" }),
                trim: t("purchaseRounds.gen.trim", { pieces: "{pieces}" }),
                load: t("purchaseRounds.gen.load", {
                  cartons: "{cartons}",
                  cbm: "{cbm}",
                  containers: "{containers}",
                  container: "{container}",
                }),
              }}
              labels={{
                intl,
                toggle: t("purchaseRounds.form.toggle"),
                ask: t("purchaseRounds.form.ask"),
                hint: t("purchaseRounds.form.hint"),
                interval: t("purchaseRounds.form.interval"),
                days: t("purchaseRounds.form.days", { n: "{n}" }),
                custom: t("purchaseRounds.form.custom"),
                firstDate: t("purchaseRounds.form.firstDate"),
                n: t("purchaseRounds.form.n", { n: "{n}" }),
                quantity: t("purchaseRounds.form.quantity"),
                expected: t("purchaseRounds.form.expected"),
                add: t("purchaseRounds.form.add"),
                remove: t("purchaseRounds.form.remove", { n: "{n}" }),
                total: t("purchaseRounds.form.total", {
                  total: "{total}",
                  unit: "{unit}",
                }),
                off: t("purchaseRounds.form.off"),
              }}
            />
            <div className="md:col-span-3">
              <Field
                label={t("supplierRequests.selection.form.needs")}
                hint={t("supplierRequests.selection.form.needsHint")}
              >
                <Textarea
                  name="needs"
                  rows={3}
                  maxLength={4000}
                  defaultValue={current?.needs ?? undefined}
                  data-selection-needs
                />
              </Field>
            </div>
          </div>
          <div className="mt-3">
            <SubmitButton
              pendingText={t("supplierRequests.selection.form.pending")}
              data-selection-submit
            >
              {t("supplierRequests.selection.form.submit")}
            </SubmitButton>
          </div>
        </Card>
      </form>
    );
  };

  return (
    <>
      <PageHeader
        t={t}
        title={t("supplierRequests.selection.title")}
        subtitle={t("supplierRequests.selection.subtitle")}
        actions={
          <>
            <LinkButton href="/app/booking">
              {t("bookingLots.backToList")}
            </LinkButton>
            <LinkButton href="/app/supplier-requests">
              {t("nav.supplierRequests")}
            </LinkButton>
          </>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {savedNotice ? (
        <div className="mb-3" data-selection-saved>
          <Alert tone="success">{t("supplierRequests.selection.saved")}</Alert>
        </div>
      ) : null}
      {openedCount !== null ? (
        <div className="mb-3" data-selection-opened={openedCount}>
          <Alert tone={failedCount ? "warning" : "success"}>
            {t("supplierRequests.selection.opened", { n: openedCount })}
            {failedCount
              ? ` ${t("supplierRequests.selection.openFailed", { n: failedCount })}${whyText ? ` ${whyText}` : ""}`
              : ""}
          </Alert>
        </div>
      ) : null}
      {noLogin.length ? (
        <div className="mb-3">
          <SupplierNoLoginAlert
            suppliers={noLogin}
            canParties={canOpen(user, "parties")}
            t={t}
            title="supplierRequests.noLogin.selection"
          />
        </div>
      ) : null}
      {result === null ? (
        <Alert tone="warning">
          {t("supplierRequests.selection.schemaMissing")}
        </Alert>
      ) : (
        <div className="space-y-4">
          <nav
            className="flex gap-1 border-b border-zinc-200"
            data-selection-tabs
          >
            {(["items", "selection"] as const).map((k) => (
              <Link
                key={k}
                href={tabHref(k)}
                className={cx(
                  "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition",
                  tab === k
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-zinc-500 hover:text-zinc-800",
                )}
                aria-current={tab === k ? "page" : undefined}
                data-selection-tab={k}
              >
                {t(`supplierRequests.selection.tab.${k}` as DictionaryKey)}
              </Link>
            ))}
          </nav>

          <Card>
            <form method="get" className="space-y-3" data-selection-search>
              {tab === "selection" ? (
                <input type="hidden" name="tab" value="selection" />
              ) : null}
              {tab === "selection" && groupIds.length ? (
                <input type="hidden" name="ids" value={groupIds.join(",")} />
              ) : null}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-64 flex-1">
                  <Field label={t("supplierRequests.selection.search")}>
                    <Input
                      name="q"
                      type="search"
                      defaultValue={q}
                      placeholder={t(
                        "supplierRequests.selection.searchPlaceholder",
                      )}
                      maxLength={200}
                      list="selection-suggestions"
                      autoComplete="off"
                    />
                  </Field>
                  <datalist id="selection-suggestions">
                    {suggestions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                  <LiveSearch />
                </div>
                <Field label={t("supplierRequests.selection.filter.period")}>
                  <DateRangePicker
                    from={filters.from}
                    to={filters.to}
                    locale={t.intl}
                    labels={{
                      placeholder: t(
                        "supplierRequests.selection.filter.anyDate",
                      ),
                      apply: t("supplierRequests.selection.filter.apply"),
                      clear: t("supplierRequests.selection.filter.clearDates"),
                      last7: t("supplierRequests.selection.filter.last7"),
                      last30: t("supplierRequests.selection.filter.last30"),
                      thisMonth: t(
                        "supplierRequests.selection.filter.thisMonth",
                      ),
                      lastMonth: t(
                        "supplierRequests.selection.filter.lastMonth",
                      ),
                      previous: t("supplierRequests.selection.filter.previous"),
                      next: t("supplierRequests.selection.filter.next"),
                    }}
                  />
                </Field>
                <Field label={t("supplierRequests.selection.filter.supplier")}>
                  <Select
                    name="supplier"
                    defaultValue={filters.supplierId ?? ""}
                    data-auto-submit
                    data-selection-filter-supplier
                  >
                    <option value="">
                      {t("supplierRequests.selection.filter.all")}
                    </option>
                    {result.suppliers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("supplierRequests.selection.filter.origin")}>
                  <Select
                    name="origin"
                    defaultValue={filters.origin ?? ""}
                    data-auto-submit
                    data-selection-filter-origin
                  >
                    <option value="">
                      {t("supplierRequests.selection.filter.all")}
                    </option>
                    {result.origins.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("supplierRequests.selection.filter.status")}
                </span>
                {SELECTION_STATUSES.map((st) => (
                  <label
                    key={st}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800"
                  >
                    <input
                      type="checkbox"
                      name="status"
                      value={st}
                      defaultChecked={statuses.includes(st)}
                      className="h-3.5 w-3.5"
                      data-auto-submit
                      data-selection-filter-status={st}
                    />
                    {t(`bookingLots.status.${st}` as DictionaryKey)}
                  </label>
                ))}
                <span className="ml-auto flex gap-2">
                  <SubmitButton variant="secondary">
                    {t("supplierRequests.selection.filter")}
                  </SubmitButton>
                  {filtered ? (
                    <LinkButton
                      href={
                        tab === "selection"
                          ? "/app/booking/selection?tab=selection"
                          : "/app/booking/selection"
                      }
                      variant="ghost"
                    >
                      {t("supplierRequests.selection.clear")}
                    </LinkButton>
                  ) : null}
                </span>
              </div>
              <AutoSubmit />
            </form>
            <p className="mt-2 text-xs text-zinc-500" data-selection-count>
              {result.total > listRows.length
                ? t("supplierRequests.selection.truncated", {
                    shown: listRows.length,
                    n: result.total,
                  })
                : t("supplierRequests.selection.count", { n: result.total })}
            </p>
          </Card>

          {tab === "items" ? (
            listRows.length ? (
              <>
                <p className="text-sm text-zinc-600">
                  {t("supplierRequests.selection.pickHint")}
                </p>
                {comparison(listRows, true)}
                <SelectionBasket
                  pageKey={filterParams.toString()}
                  labels={{
                    count: t("supplierRequests.selection.basket.count"),
                    group: t("supplierRequests.selection.basket.group"),
                    clear: t("supplierRequests.selection.basket.clear"),
                    limit: t("supplierRequests.selection.basket.limit"),
                  }}
                />
              </>
            ) : (
              <Empty>
                {filtered
                  ? t("supplierRequests.selection.empty")
                  : t("supplierRequests.selection.noItems")}
              </Empty>
            )
          ) : (
            <>
              {groupIds.length ? (
                <Card
                  title={t("supplierRequests.selection.group.title", {
                    n: groupRows.length,
                    suppliers: new Set(
                      groupRows.map((r) => r.lot.supplierId ?? r.item.id),
                    ).size,
                  })}
                >
                  <div data-selection-group-view={groupRows.length}>
                    {groupRows.length ? (
                      comparison(groupRows, false)
                    ) : (
                      <Empty>
                        {t("supplierRequests.selection.group.empty")}
                      </Empty>
                    )}
                  </div>
                  <p className="mt-3">
                    <Link href={tabHref("items")} className={linkClass}>
                      {t("supplierRequests.selection.group.back")}
                    </Link>
                  </p>
                </Card>
              ) : null}
              <span id="blocks" className="block scroll-mt-24" />
              <Card title={t("supplierRequests.selection.blocks.title")}>
                <p className="mb-3 text-sm text-zinc-600">
                  {t("supplierRequests.selection.blocks.hint")}
                </p>
                {cards.length ? (
                  <form
                    action={openGroupRequestsAction}
                    data-selection-open-form
                  >
                    <input
                      type="hidden"
                      name="filters"
                      value={filterParams.toString()}
                    />
                    <div
                      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3"
                      data-selection-open-bar={savedCount}
                    >
                      <span className="mr-auto text-sm text-zinc-700">
                        {savedCount
                          ? t("supplierRequests.selection.open.ready", {
                              n: savedCount,
                            })
                          : t("supplierRequests.selection.open.none")}
                      </span>
                      <SubmitButton
                        name="scope"
                        value="marked"
                        variant="secondary"
                        disabled={!savedCount}
                        pendingText={t(
                          "supplierRequests.selection.form.pending",
                        )}
                        data-selection-open-marked
                      >
                        {t("supplierRequests.selection.open.marked")}
                      </SubmitButton>
                      <SubmitButton
                        name="scope"
                        value="all"
                        disabled={!savedCount}
                        pendingText={t(
                          "supplierRequests.selection.form.pending",
                        )}
                        data-selection-open-all
                      >
                        {t("supplierRequests.selection.open.all", {
                          n: savedCount,
                        })}
                      </SubmitButton>
                    </div>
                    <div className="space-y-5" data-selection-blocks>
                      {cardSections.map((section) =>
                        section.cards.length ? (
                          <section
                            key={section.key}
                            data-selection-section={section.key}
                          >
                            <h3 className="mb-2 text-sm font-semibold text-zinc-800">
                              {t(
                                `supplierRequests.selection.section.${section.key}`,
                                { n: section.cards.length },
                              )}
                            </h3>
                            <div className="grid gap-3 lg:grid-cols-2">
                              {section.cards.map((b) => {
                                const g = b.entry?.group ?? null;
                                const saved = g?.status === "saved";
                                const request = b.entry?.request ?? null;
                                // O ganhador primeiro, para aparecer sempre.
                                const ids = g
                                  ? [
                                      g.chosenItemId,
                                      ...b.ids.filter(
                                        (i) => i !== g.chosenItemId,
                                      ),
                                    ]
                                  : b.ids;
                                return (
                                  <div
                                    key={b.key}
                                    className={cx(
                                      "rounded-xl border p-3",
                                      g
                                        ? "border-emerald-300 bg-emerald-50/40"
                                        : "border-zinc-200",
                                    )}
                                    data-selection-block={b.ids.length}
                                    data-selection-resolved={
                                      g?.status ?? undefined
                                    }
                                  >
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      {saved ? (
                                        <input
                                          type="checkbox"
                                          name="groups"
                                          value={g!.id}
                                          defaultChecked
                                          className="h-5 w-5"
                                          aria-label={t(
                                            "supplierRequests.selection.open.mark",
                                          )}
                                          data-selection-group-mark={g!.id}
                                        />
                                      ) : null}
                                      <span className="font-semibold capitalize text-zinc-900">
                                        {b.label}
                                      </span>
                                      <Badge tone="info">
                                        {b.suppliers === null
                                          ? t(
                                              "supplierRequests.selection.blocks.sizeManual",
                                              { n: b.ids.length },
                                            )
                                          : t(
                                              "supplierRequests.selection.blocks.size",
                                              {
                                                n: b.ids.length,
                                                suppliers: b.suppliers,
                                              },
                                            )}
                                      </Badge>
                                      {saved ? (
                                        <Badge tone="success">
                                          {t(
                                            "supplierRequests.selection.resolved",
                                          )}
                                        </Badge>
                                      ) : null}
                                      {g?.status === "requested" ? (
                                        request ? (
                                          <Link
                                            href={`/app/supplier-requests/${request.id}`}
                                            className={linkClass}
                                            data-selection-request-link
                                          >
                                            {t(
                                              "supplierRequests.selection.requested",
                                              {
                                                n: request.number,
                                              },
                                            )}
                                          </Link>
                                        ) : (
                                          <Badge tone="success">
                                            {t(
                                              "supplierRequests.selection.requestedNoLink",
                                            )}
                                          </Badge>
                                        )
                                      ) : null}
                                    </div>
                                    <ul className="mb-3 space-y-1 text-[13px] text-zinc-700">
                                      {ids.slice(0, 6).map((id) => {
                                        const item =
                                          rowById.get(id)?.item ??
                                          (b.entry?.chosen?.id === id
                                            ? b.entry.chosen
                                            : null);
                                        if (!item) return null;
                                        const winner = g?.chosenItemId === id;
                                        const usdPrice = priceInUsd(
                                          item.price,
                                          item.currency,
                                          rmbPerUsd,
                                        );
                                        return (
                                          <li
                                            key={id}
                                            className={cx(
                                              "flex items-center gap-2",
                                              winner &&
                                                "rounded-md bg-emerald-100 px-1.5 py-1 font-semibold text-emerald-900",
                                            )}
                                            data-selection-winner={
                                              winner || undefined
                                            }
                                          >
                                            <span className="min-w-0 flex-1 truncate">
                                              {winner ? "✓ " : ""}
                                              {item.description ??
                                                item.productName ??
                                                "—"}
                                            </span>
                                            {winner ? (
                                              <span className="shrink-0 text-xs">
                                                {t(
                                                  "supplierRequests.selection.winner",
                                                  {
                                                    qty: g!.quantity.toLocaleString(
                                                      intl,
                                                    ),
                                                  },
                                                )}
                                                {g!.schedule?.items.length
                                                  ? ` · ${t(
                                                      "purchaseRounds.summary.short",
                                                      {
                                                        rounds:
                                                          g!.schedule.items
                                                            .length,
                                                        days: g!.schedule
                                                          .intervalDays,
                                                      },
                                                    )}`
                                                  : null}
                                              </span>
                                            ) : (
                                              <span className="shrink-0 text-zinc-500">
                                                {rowById.get(id)?.supplier
                                                  ?.name ?? "—"}
                                              </span>
                                            )}
                                            <span className="w-20 shrink-0 text-right tabular-nums">
                                              {usdPrice === null
                                                ? "—"
                                                : `US$ ${num(usdPrice, 3)}`}
                                            </span>
                                          </li>
                                        );
                                      })}
                                      {ids.length > 6 ? (
                                        <li className="text-xs text-zinc-500">
                                          {t(
                                            "supplierRequests.selection.blocks.more",
                                            {
                                              n: ids.length - 6,
                                            },
                                          )}
                                        </li>
                                      ) : null}
                                    </ul>
                                    <LinkButton
                                      href={groupHref(b.ids)}
                                      data-selection-block-open
                                    >
                                      {g
                                        ? t(
                                            "supplierRequests.selection.blocks.reopen",
                                          )
                                        : t(
                                            "supplierRequests.selection.blocks.open",
                                          )}
                                    </LinkButton>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ) : null,
                      )}
                    </div>
                  </form>
                ) : (
                  <Empty>{t("supplierRequests.selection.blocks.empty")}</Empty>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
