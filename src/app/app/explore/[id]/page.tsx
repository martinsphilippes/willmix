import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  canBuyOnStorefront,
  canExplore,
  exploreProduct,
} from "@/lib/services/catalog-explore";
import { cartCount } from "@/lib/services/cart";
import { addToCartAction, requestNowAction } from "@/app/app/actions/cart";
import {
  brl,
  CartIcon,
  MissingReasons,
  PriceTag,
} from "@/components/explore-ui";
import { ExploreGallery } from "@/components/explore-gallery";
import { QuantityStepper } from "@/components/quantity-stepper";
import { SubmitButton } from "@/components/submit-button";
import { Alert, formatDate } from "@/components/ui";

/*
 * Página do produto na vitrine: fotos, preço estimado (e por quantidade),
 * pedido mínimo, quantidade e personalização, e os botões de carrinho. Sem
 * fornecedor nem preço de compra (o serviço já não traz).
 */
export default async function ExploreProductPage({
  params,
  searchParams,
}: PageProps<"/app/explore/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user)
    redirect(`/login?next=${encodeURIComponent(`/app/explore/${id}`)}`);
  if (!canExplore(user))
    redirect(user.role === "customer" ? "/app/requests" : "/app");
  const sp = await searchParams;
  const t = await getT();
  const product = await exploreProduct(user, id, t);
  if (!product) notFound();
  const wellmix = isWellmix(user);
  const [count, canBuy] = await Promise.all([
    cartCount(user),
    canBuyOnStorefront(user),
  ]);
  const added = typeof sp.added === "string";
  const error = typeof sp.error === "string" ? sp.error : null;
  const errorKey = `explore.error.${error ?? ""}` as DictionaryKey;
  const errorText = error
    ? t(errorKey) !== errorKey
      ? t(errorKey)
      : t("common.error")
    : null;
  const back = `/app/explore/${encodeURIComponent(product.id)}`;
  const startQty = product.estimate.ok
    ? product.estimate.quantity
    : product.moq && product.moq > 0
      ? product.moq
      : 1;

  return (
    <div className="space-y-4" data-explore-detail={product.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-500">
          <Link href="/app/explore" className="hover:text-brand-700">
            {t("explore.title")}
          </Link>
          {product.lineName ? (
            <>
              <span aria-hidden>›</span>
              <Link
                href={`/app/explore?line=${encodeURIComponent(product.lineId)}`}
                className="truncate hover:text-brand-700"
              >
                {product.lineName}
              </Link>
            </>
          ) : null}
        </nav>
        {canBuy ? (
          <Link
            href="/app/explore/cart"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 shadow-sm hover:border-zinc-300"
            data-explore-cart-link={count}
          >
            <CartIcon className="h-4 w-4 text-brand-600" />
            {t("explore.cartButton")}
            {count > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                {count}
              </span>
            ) : null}
          </Link>
        ) : null}
      </div>
      {wellmix ? (
        <Alert tone="info">{t("explore.preview.banner")}</Alert>
      ) : null}
      {added ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200"
          role="status"
          data-explore-added={product.id}
        >
          <span className="font-semibold">{t("explore.added")}</span>
          <Link
            href="/app/explore/cart"
            className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            {t("explore.viewCart")}
          </Link>
        </div>
      ) : null}
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Celular: fotos, depois preço e botões, depois as características. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ExploreGallery
            photos={product.photos}
            noPhotoLabel={t("explore.noPhoto")}
            photoLabel={t("explore.product.photo", {
              n: "{n}",
              total: "{total}",
            })}
          />
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-6">
            <div className="flex flex-wrap gap-1.5">
              {product.inStock ? (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {t("explore.badge.inStock")}
                </span>
              ) : product.onTheWay ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
                  {t("explore.badge.onTheWay")}
                </span>
              ) : null}
              {product.boughtBefore ? (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
                  {t("explore.badge.bought")}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-xl font-semibold leading-tight text-zinc-900 sm:text-2xl">
              {product.name}
            </h1>
            {product.category ? (
              <p className="mt-1 text-sm text-zinc-500">{product.category}</p>
            ) : null}

            <div className="mt-4">
              {product.estimate.ok ? (
                <>
                  <PriceTag t={t} value={product.estimate.unitBrl} size="lg" />
                  <p className="mt-1 text-sm font-medium text-emerald-700">
                    {t("explore.price.estimated")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-zinc-800">
                    {t("explore.price.onRequest")}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {t("explore.price.onRequestHint")}
                  </p>
                  <MissingReasons t={t} estimate={product.estimate} />
                </>
              )}
              {product.moq ? (
                <p className="mt-2 text-sm text-zinc-700">
                  {t("explore.moq", {
                    n: product.moq.toLocaleString(t.intl),
                  })}
                </p>
              ) : null}
            </div>

            {product.tiers.length ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
                <p className="bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("explore.product.tiers")}
                </p>
                <ul
                  className="divide-y divide-zinc-100 text-sm"
                  data-explore-tiers=""
                >
                  {product.tiers.map((tier) => (
                    <li
                      key={tier.minQty}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span className="text-zinc-600">
                        {t("explore.product.tierRow", {
                          n: tier.minQty.toLocaleString(t.intl),
                        })}
                      </span>
                      <span className="font-semibold tabular-nums text-zinc-900">
                        {brl(t, tier.unitBrl)}
                        <span className="font-normal text-zinc-500">
                          {t("explore.price.unit")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!wellmix && !canBuy ? (
              <div className="mt-5">
                <Alert tone="warning">{t("explore.disabled")}</Alert>
              </div>
            ) : null}
            {canBuy ? (
              <form action={addToCartAction} className="mt-5 space-y-3">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="back" value={back} />
                <QuantityStepper
                  id="explore-quantity"
                  defaultValue={startQty}
                  moq={product.moq}
                  label={t("explore.product.quantity")}
                  decreaseLabel={t("explore.product.decrease")}
                  increaseLabel={t("explore.product.increase")}
                  belowMoqText={t("explore.product.belowMoq", {
                    n: (product.moq ?? 0).toLocaleString(t.intl),
                  })}
                />
                <div>
                  <label
                    htmlFor="explore-notes"
                    className="mb-1 block text-xs font-medium text-zinc-700"
                  >
                    {t("explore.product.notes")}
                  </label>
                  <textarea
                    id="explore-notes"
                    name="notes"
                    rows={2}
                    maxLength={500}
                    placeholder={t("explore.product.notesPlaceholder")}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <SubmitButton
                    className="h-11 rounded-xl text-[15px]"
                    data-explore-add-detail=""
                  >
                    <CartIcon className="h-4 w-4" />
                    {t("explore.product.addToCart")}
                  </SubmitButton>
                  {/* Só este produto, direto para orçamento (o carrinho fica como está). */}
                  <SubmitButton
                    variant="secondary"
                    formAction={requestNowAction}
                    className="h-11 rounded-xl border-brand-200 text-[15px] text-brand-700 hover:bg-brand-50"
                    data-explore-buy-now=""
                  >
                    {t("explore.product.buyNow")}
                  </SubmitButton>
                </div>
              </form>
            ) : null}
            {product.estimate.ok ? (
              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                {t("explore.product.estimateNote")}
              </p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-5">
            <h2 className="text-base font-semibold text-zinc-900">
              {t("explore.product.how.title")}
            </h2>
            <ol className="mt-3 space-y-3 text-sm text-zinc-700">
              {[
                t("explore.product.how.1"),
                t("explore.product.how.2", {
                  date: formatDate(product.proposalBy, t),
                }),
                t("explore.product.how.3"),
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <section className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03] sm:p-5">
            <h2 className="text-base font-semibold text-zinc-900">
              {t("explore.product.spec")}
            </h2>
            {product.specification.length ? (
              <dl className="mt-3 divide-y divide-zinc-100 text-sm">
                {product.specification.map((line, i) => {
                  const at = line.indexOf(":");
                  const label = at > 0 ? line.slice(0, at) : null;
                  const value = at > 0 ? line.slice(at + 1).trim() : line;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 py-2"
                    >
                      <dt className="text-zinc-500">{label ?? "•"}</dt>
                      <dd className="text-zinc-900">{value}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                {t("explore.product.noSpec")}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
