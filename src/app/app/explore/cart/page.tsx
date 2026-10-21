import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getSettings } from "@/lib/settings";
import { quoteSlaDeadline } from "@/lib/sla";
import { brazilDay } from "@/lib/supplier-terms";
import { canBuyOnStorefront } from "@/lib/services/catalog-explore";
import { cartView, type CartView } from "@/lib/services/cart";
import {
  checkoutCartAction,
  removeCartItemAction,
  updateCartItemAction,
} from "@/app/app/actions/cart";
import { brl, CartIcon, PhotoPlaceholder } from "@/components/explore-ui";
import { CartLineForm } from "@/components/cart-line-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert, cx, formatDate } from "@/components/ui";

/*
 * Carrinho da vitrine: itens com quantidade, personalização e preço
 * estimado; ao enviar, cada produto vira uma solicitação de orçamento (lote).
 * Mudar ou remover um item grava sem trocar de tela (a data e as observações
 * do envio, já digitadas, ficam). Só o cliente tem carrinho.
 */
export default async function CartPage({
  searchParams,
}: PageProps<"/app/explore/cart">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/explore/cart");
  if (user.role !== "customer") redirect("/app/explore");
  // Cliente sem empresa: lista de solicitações (a vitrine o mandaria de volta).
  if (!user.partyId) redirect("/app/requests");
  const sp = await searchParams;
  const t = await getT();
  const [settings, canBuy] = await Promise.all([
    getSettings(),
    canBuyOnStorefront(user),
  ]);
  let cart: CartView | null = null;
  let loadError: string | null = null;
  try {
    cart = await cartView(user);
  } catch {
    // Ex.: carrinho ainda não publicado no banco: explica em vez de quebrar a tela.
    loadError = "schema_outdated";
  }
  const proposalBy = quoteSlaDeadline(settings.quoteSlaBusinessDays);
  const today = brazilDay(new Date()) ?? undefined;
  const error = typeof sp.error === "string" ? sp.error : (loadError ?? null);
  const errorKey = `explore.error.${error ?? ""}` as DictionaryKey;
  const errorText = error
    ? t(errorKey) !== errorKey
      ? t(errorKey)
      : t("explore.error.unexpected")
    : null;
  const input =
    "rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  const lines = cart?.lines ?? [];

  return (
    <div className="space-y-4" data-explore-cart={lines.length}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/app/explore"
            className="text-sm font-medium text-zinc-500 hover:text-brand-700"
          >
            ← {t("explore.cart.continue")}
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900">
            <CartIcon className="h-6 w-6 text-brand-600" />
            {t("explore.cart.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {t("explore.cart.subtitle")}
          </p>
        </div>
      </div>
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {!canBuy ? <Alert tone="warning">{t("explore.disabled")}</Alert> : null}

      {!cart ? null : !lines.length ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CartIcon className="h-7 w-7" />
          </span>
          <p className="mt-3 text-base font-semibold text-zinc-900">
            {t("explore.cart.empty")}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {t("explore.cart.emptyHint")}
          </p>
          <Link
            href="/app/explore"
            className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {t("explore.cart.continue")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-2">
            <ul className="space-y-3">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className={cx(
                    "rounded-3xl border bg-white p-3 shadow-sm shadow-zinc-900/[0.03] sm:p-4",
                    line.unavailable
                      ? "border-amber-300"
                      : "border-zinc-200/80",
                  )}
                  data-cart-line={line.productId}
                  data-cart-qty={line.quantity}
                >
                  <div className="flex gap-3">
                    <Link
                      href={`/app/explore/${encodeURIComponent(line.productId)}`}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 sm:h-24 sm:w-24"
                    >
                      {line.photo ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */
                        <img
                          src={`/api/files/${line.photo}`}
                          alt={line.name}
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <PhotoPlaceholder label={t("explore.noPhoto")} />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <Link
                            href={`/app/explore/${encodeURIComponent(line.productId)}`}
                            className="line-clamp-2 break-words font-semibold text-zinc-900 hover:text-brand-700"
                          >
                            {line.name}
                          </Link>
                          {line.category ? (
                            <p className="text-xs text-zinc-500">
                              {line.category}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm text-zinc-700">
                            {line.estimate.ok
                              ? t("explore.cart.unitPrice", {
                                  price: brl(t, line.estimate.unitBrl),
                                })
                              : t("explore.price.onRequest")}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-xs text-zinc-500">
                            {t("explore.cart.subtotal")}
                          </p>
                          <p
                            className="text-lg font-semibold tabular-nums text-zinc-900"
                            data-cart-subtotal={line.subtotal ?? ""}
                          >
                            {line.subtotal !== null
                              ? brl(t, line.subtotal)
                              : t("explore.cart.noTotal")}
                          </p>
                        </div>
                      </div>
                      {line.unavailable ? (
                        <p className="mt-2 text-xs font-medium text-amber-800">
                          {t("explore.cart.unavailable")}
                        </p>
                      ) : null}
                      {line.belowMoq && line.moq ? (
                        <p className="mt-2 text-xs text-amber-800">
                          {t("explore.product.belowMoq", {
                            n: line.moq.toLocaleString(t.intl),
                          })}
                        </p>
                      ) : null}
                      {/* key: depois de gravar, o formulário recomeça do valor salvo. */}
                      <CartLineForm
                        key={`${line.id}:${line.quantity}:${line.notes ?? ""}`}
                        action={updateCartItemAction}
                        itemId={line.id}
                        productId={line.productId}
                        quantity={line.quantity}
                        notes={line.notes}
                        labels={{
                          quantity: t("explore.cart.quantity"),
                          notes: t("explore.cart.notesLabel"),
                          notesPlaceholder: t(
                            "explore.product.notesPlaceholder",
                          ),
                          update: t("explore.cart.update"),
                        }}
                      />
                      <form action={removeCartItemAction} className="mt-1">
                        <input type="hidden" name="itemId" value={line.id} />
                        <SubmitButton
                          variant="ghost"
                          className="-ml-2 px-2 py-2 text-xs font-semibold text-zinc-500 hover:text-red-700"
                          data-cart-remove={line.productId}
                        >
                          {t("explore.cart.remove")}
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="px-1 text-xs text-zinc-500">
              {t("explore.cart.autosave")}
            </p>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-5">
              <h2 className="text-base font-semibold text-zinc-900">
                {t("explore.cart.summary")}
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-600">
                    {t("explore.cart.items", { n: lines.length })}
                  </dt>
                </div>
                <div className="flex items-end justify-between gap-3 border-t border-zinc-100 pt-3">
                  <dt className="font-semibold text-zinc-900">
                    {t("explore.cart.total")}
                  </dt>
                  <dd
                    className="text-2xl font-semibold tabular-nums text-zinc-900"
                    data-cart-total={cart.anyPriced ? cart.estimatedTotal : ""}
                  >
                    {cart.anyPriced
                      ? brl(t, cart.estimatedTotal)
                      : t("explore.cart.noTotal")}
                  </dd>
                </div>
              </dl>
              {!cart.anyPriced ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {t("explore.cart.noTotalHint")}
                </p>
              ) : !cart.complete ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {t("explore.cart.partial")}
                </p>
              ) : null}
              {canBuy ? (
                <form action={checkoutCartAction} className="mt-4 space-y-3">
                  <label className="block text-xs font-medium text-zinc-700">
                    <span className="mb-1 block">
                      {t("explore.cart.deadline")}
                    </span>
                    <input
                      type="date"
                      name="deadline"
                      min={today}
                      className={cx(input, "w-full")}
                      data-cart-deadline=""
                    />
                  </label>
                  <label className="block text-xs font-medium text-zinc-700">
                    <span className="mb-1 block">
                      {t("explore.cart.notes")}
                    </span>
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={2000}
                      className={cx(input, "w-full")}
                      data-cart-notes=""
                    />
                  </label>
                  <SubmitButton
                    className="h-12 w-full rounded-xl text-base"
                    data-cart-checkout=""
                  >
                    {t("explore.cart.checkout")}
                  </SubmitButton>
                  <p className="text-center text-xs text-zinc-500">
                    {t("explore.cart.checkoutHint", {
                      date: formatDate(proposalBy, t),
                    })}
                  </p>
                </form>
              ) : null}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
