import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  bestMinimumItem,
  priceInUsd,
  sheetQuantity,
  similarQuery,
} from "@/lib/supplier-requests";
import { listSelectionItems } from "@/lib/services/supplier-requests";
import { getFxRates } from "@/lib/services/fx";
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
  Textarea,
  cx,
  formatDate,
  formatMoney,
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { openSupplierRequestAction } from "../../actions/supplier-requests";
import { SupplierNoLoginAlert } from "@/components/supplier-no-login";
import { canOpen } from "@/lib/auth/screens";
import { partiesWithoutLogin } from "@/lib/services/portal-access";

/*
 * Seleção de itens (docs/SUPPLIER_REQUESTS.md): itens dos bookings fechados,
 * filtrados por parte da descrição, lado a lado para comparar. A Wellmix
 * marca o escolhido e as alternativas e abre a solicitação ao fornecedor do
 * escolhido. Nada de produto, cliente ou estoque nasce aqui.
 */

const SIGNAL_TONE: Record<string, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
};
const FORM = "selection-form";

export default async function BookingSelectionPage({
  searchParams,
}: PageProps<"/app/booking/selection">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/booking/selection");
  requireScreen(user, "booking");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 200) : "";
  const error = typeof query.error === "string" ? query.error : "";
  const t = await getT();
  const [result, fx] = await Promise.all([
    listSelectionItems(user, q),
    getFxRates(),
  ]);
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
  const rows = result?.rows ?? [];
  const best = bestMinimumItem(rows.map((r) => r.item));
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
          <Card>
            <form
              method="get"
              className="flex flex-wrap items-end gap-2"
              data-selection-search
            >
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
                  />
                </Field>
              </div>
              <SubmitButton variant="secondary">
                {t("supplierRequests.selection.filter")}
              </SubmitButton>
              {q ? (
                <LinkButton href="/app/booking/selection" variant="ghost">
                  {t("supplierRequests.selection.clear")}
                </LinkButton>
              ) : null}
            </form>
            <p className="mt-2 text-xs text-zinc-500" data-selection-count>
              {result.total > rows.length
                ? t("supplierRequests.selection.truncated", {
                    shown: rows.length,
                    n: result.total,
                  })
                : t("supplierRequests.selection.count", { n: result.total })}
            </p>
          </Card>

          {rows.length ? (
            <form
              id={FORM}
              action={openSupplierRequestAction}
              className="space-y-4"
              data-selection-form
            >
              <input type="hidden" name="q" value={q} />
              <div className="relative -mx-4 overflow-x-auto border-y border-zinc-200/80 bg-white sm:mx-0 sm:rounded-xl sm:border">
                <table
                  className="w-full text-left text-sm"
                  data-selection-items
                >
                  <thead>
                    <tr>
                      {[
                        "choose",
                        "alternative",
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
                    {rows.map(({ item, lot, supplier, activeRequest }) => {
                      const a = item.analysis;
                      const busy = !!activeRequest;
                      const priceUsd = priceInUsd(
                        item.price,
                        item.currency,
                        rmbPerUsd,
                      );
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
                            <input
                              type="radio"
                              name="chosen"
                              value={item.id}
                              disabled={busy}
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
                          </td>
                          <td className={td}>
                            <span className="block max-w-40 min-w-28 whitespace-normal">
                              {supplier?.name ?? "—"}
                            </span>
                            {supplier && noLoginIds.has(supplier.id) ? (
                              <span data-selection-no-login={supplier.id}>
                                <Badge tone="warning">
                                  {t("portalAccess.none")}
                                </Badge>
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
                            <span className="block text-xs text-zinc-500">
                              {formatDate(lot.bookingDate, t)}
                            </span>
                          </td>
                          <td
                            className={cx(td, "whitespace-nowrap tabular-nums")}
                          >
                            {num(item.price)} {item.currency ?? ""}
                            {item.incoterm ? (
                              <span className="block text-xs text-zinc-500">
                                {item.incoterm}
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cx(td, "whitespace-nowrap tabular-nums")}
                          >
                            {priceUsd === null
                              ? "—"
                              : `US$ ${num(priceUsd, 3)}`}
                          </td>
                          <td className={cx(td, "tabular-nums")}>
                            {num(item.moq, 0)}
                          </td>
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
                          <td
                            className={cx(td, "whitespace-nowrap tabular-nums")}
                          >
                            {[item.lengthCm, item.widthCm, item.heightCm]
                              .map((n) => num(n, 2))
                              .join(" × ")}
                          </td>
                          <td className={cx(td, "tabular-nums")}>
                            {num(item.capacityMl, 0)}
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
                          <td className={td}>
                            {a ? (
                              <span className="flex flex-col items-start gap-0.5">
                                <Badge
                                  tone={
                                    a.verdict
                                      ? SIGNAL_TONE[a.verdict]
                                      : "neutral"
                                  }
                                >
                                  {t(
                                    `booking.signal.${a.verdict ?? "missing"}` as DictionaryKey,
                                  )}
                                </Badge>
                                {a.minimumBrl !== null ? (
                                  <span className="text-xs whitespace-nowrap text-zinc-600">
                                    {t("bookingLots.item.minimum", {
                                      price: formatMoney(
                                        a.minimumBrl,
                                        "BRL",
                                        t,
                                      ),
                                    })}
                                  </span>
                                ) : null}
                                {item.id === best ? (
                                  <Badge tone="success">
                                    {t("supplierRequests.selection.best")}
                                  </Badge>
                                ) : null}
                              </span>
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
                </table>
              </div>

              <Card title={t("supplierRequests.selection.form.title")}>
                <p className="mb-3 text-sm text-zinc-600">
                  {t("supplierRequests.selection.form.body")}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field
                    label={t("supplierRequests.selection.form.quantity")}
                    hint={t("supplierRequests.selection.form.quantityHint")}
                  >
                    <Input
                      name="quantity"
                      inputMode="numeric"
                      autoComplete="off"
                      data-selection-quantity
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field
                      label={t("supplierRequests.selection.form.needs")}
                      hint={t("supplierRequests.selection.form.needsHint")}
                    >
                      <Textarea
                        name="needs"
                        rows={3}
                        maxLength={4000}
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
          ) : (
            <Empty>
              {q
                ? t("supplierRequests.selection.empty")
                : t("supplierRequests.selection.noItems")}
            </Empty>
          )}
        </div>
      )}
    </>
  );
}
