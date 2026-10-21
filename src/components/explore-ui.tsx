import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { ExploreProduct } from "@/lib/services/catalog-explore";
import type { CatalogEstimate } from "@/lib/services/catalog-price-calc";
import { addToCartAction } from "@/app/app/actions/cart";
import { SubmitButton } from "@/components/submit-button";
import { cx } from "@/components/ui";

/*
 * Peças da vitrine do cliente (Explorar): faixa de busca com o carrinho,
 * selos de confiança, card do produto e bloco de preço. Tudo do servidor;
 * só o que o cliente pode ver chega aqui (sem fornecedor nem preço de compra).
 */

/* ---------------------------------- Ícones --------------------------------- */

const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CartIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={cx("h-5 w-5", className)}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={cx("h-5 w-5", className)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function ShipIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M3 17.5c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" />
      <path d="M5 14.5 4 10h16l-1.5 4.5M8 10V6h8v4M12 3v3" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    </svg>
  );
}

export function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-300">
      <svg {...iconProps} className="h-10 w-10">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m21 16-5-5-8 9" />
      </svg>
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
    </div>
  );
}

/* ---------------------------------- Preço ---------------------------------- */

export function brl(t: Translate, n: number) {
  return new Intl.NumberFormat(t.intl, {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

/** Preço grande em destaque, com centavos menores (como nas lojas). */
export function PriceTag({
  t,
  value,
  size = "md",
}: {
  t: Translate;
  value: number;
  size?: "md" | "lg";
}) {
  const parts = new Intl.NumberFormat(t.intl, {
    style: "currency",
    currency: "BRL",
  }).formatToParts(value);
  const fraction = parts.find((p) => p.type === "fraction")?.value ?? "";
  const main = parts
    .filter((p) => p.type !== "fraction" && p.type !== "decimal")
    .map((p) => p.value)
    .join("");
  return (
    <span
      className="inline-flex items-start font-semibold tracking-tight text-zinc-900"
      data-explore-price={value}
    >
      <span className="sr-only">
        {t("explore.price.sr", {
          price: new Intl.NumberFormat(t.intl, {
            style: "currency",
            currency: "BRL",
          }).format(value),
        })}
      </span>
      <span aria-hidden className={size === "lg" ? "text-4xl" : "text-xl"}>
        {main.trim()}
      </span>
      {fraction ? (
        <span
          aria-hidden
          className={cx(
            "ml-0.5 font-semibold",
            size === "lg" ? "mt-1 text-lg" : "mt-0.5 text-xs",
          )}
        >
          {fraction}
        </span>
      ) : null}
      <span
        aria-hidden
        className={cx(
          "ml-1 self-end font-normal text-zinc-500",
          size === "lg" ? "mb-1 text-base" : "mb-0.5 text-xs",
        )}
      >
        {t("explore.price.unit")}
      </span>
    </span>
  );
}

/** O que falta no cadastro para o preço aparecer (só a Wellmix vê). */
export function MissingReasons({
  t,
  estimate,
}: {
  t: Translate;
  estimate: CatalogEstimate;
}) {
  if (estimate.ok || !estimate.missing.length) return null;
  return (
    <p
      className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-900 ring-1 ring-inset ring-amber-200"
      data-explore-missing={estimate.missing.join(",")}
    >
      {t("explore.missing.title")}{" "}
      {estimate.missing.map((m) => t(`explore.missing.${m}`)).join(", ")}
    </p>
  );
}

/* --------------------------------- Topo ----------------------------------- */

/** Faixa da marca com a busca e o carrinho (topo da vitrine). */
export function ExploreHero({
  t,
  q,
  sort,
  cartCount,
  showCart,
  children,
}: {
  t: Translate;
  q: string;
  sort: string | null;
  cartCount: number;
  showCart: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-4 py-5 text-white shadow-lg shadow-brand-900/20 sm:px-6 sm:py-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("explore.title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/85">
            {t("explore.subtitle")}
          </p>
        </div>
        {showCart ? (
          <Link
            href="/app/explore/cart"
            className="relative inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
            data-explore-cart-link={cartCount}
          >
            <CartIcon />
            {t("explore.cartButton")}
            {cartCount > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white"
                aria-label={t("explore.cartCount", { n: cartCount })}
              >
                {cartCount}
              </span>
            ) : null}
          </Link>
        ) : null}
      </div>
      <form
        action="/app/explore"
        method="get"
        role="search"
        className="relative mt-4 flex gap-2"
      >
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
        <label className="sr-only" htmlFor="explore-q">
          {t("explore.search.label")}
        </label>
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            id="explore-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("explore.search.placeholder")}
            className="h-11 w-full rounded-xl border-0 bg-white pl-10 pr-3 text-[15px] text-zinc-900 shadow-sm outline-none ring-2 ring-transparent placeholder:text-zinc-500 focus:ring-4 focus:ring-zinc-900/40"
            data-explore-search=""
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {t("explore.search.button")}
        </button>
      </form>
      {children}
    </section>
  );
}

/** Três selos do que o preço inclui e de como a compra segue. */
export function TrustStrip({ t, slaDays }: { t: Translate; slaDays: number }) {
  const items = [
    {
      icon: <ReceiptIcon />,
      title: t("explore.trust.estimate"),
      hint: t("explore.trust.estimateHint"),
    },
    {
      icon: <ShipIcon />,
      title: t("explore.trust.proposal", { days: slaDays }),
      hint: t("explore.trust.proposalHint"),
    },
    {
      icon: <RouteIcon />,
      title: t("explore.trust.tracking"),
      hint: t("explore.trust.trackingHint"),
    },
  ];
  return (
    <ul className="hidden gap-2 sm:grid sm:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.title}
          className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-3 py-2.5 shadow-sm shadow-zinc-900/[0.03]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            {item.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-900">
              {item.title}
            </span>
            <span className="block text-xs text-zinc-500">{item.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- Card ----------------------------------- */

export function ProductCard({
  t,
  product,
  canBuy,
  back,
  addedQty,
}: {
  t: Translate;
  product: ExploreProduct;
  /** Só o cliente (com pedidos pela vitrine ligados) adiciona ao carrinho. */
  canBuy: boolean;
  /** Tela atual (com a busca), para voltar a ela depois de adicionar. */
  back: string;
  /** Acabou de entrar no carrinho (quantidade adicionada). */
  addedQty: number | null;
}) {
  const href = `/app/explore/${encodeURIComponent(product.id)}`;
  const photo = product.photos[0];
  const quantity = product.estimate.ok
    ? product.estimate.quantity
    : product.moq && product.moq > 0
      ? product.moq
      : 1;
  return (
    <li
      id={`p-${product.id}`}
      className={cx(
        "group flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm shadow-zinc-900/[0.03] transition hover:-translate-y-0.5 hover:shadow-md",
        addedQty
          ? "border-emerald-400 ring-2 ring-emerald-100"
          : "border-zinc-200/80 hover:border-zinc-300",
      )}
      data-explore-product={product.id}
    >
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative aspect-square bg-zinc-50">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */
            <img
              src={`/api/files/${photo.documentId}`}
              alt={photo.caption}
              loading="lazy"
              className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <PhotoPlaceholder label={t("explore.noPhoto")} />
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.inStock ? (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
                {t("explore.badge.inStock")}
              </span>
            ) : product.onTheWay ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200">
                {t("explore.badge.onTheWay")}
              </span>
            ) : null}
            {product.boughtBefore ? (
              <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-brand-700 shadow-sm ring-1 ring-brand-200">
                {t("explore.badge.bought")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t border-zinc-100 px-3 pb-2 pt-2.5">
          {product.lineName ? (
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {product.lineName}
            </span>
          ) : null}
          <h3 className="line-clamp-2 min-h-[2.5rem] break-words text-sm leading-5 text-zinc-800 group-hover:text-zinc-950">
            {product.name}
          </h3>
          <div className="mt-auto pt-1">
            {product.estimate.ok ? (
              <>
                <PriceTag t={t} value={product.estimate.unitBrl} />
                <span className="block text-[11px] text-emerald-800">
                  {t("explore.price.estimated")}
                </span>
              </>
            ) : (
              <span className="block text-sm font-semibold text-zinc-700">
                {t("explore.price.onRequest")}
              </span>
            )}
            {product.moq ? (
              <span className="mt-0.5 block text-xs text-zinc-600">
                {t("explore.moq", {
                  n: product.moq.toLocaleString(t.intl),
                })}
              </span>
            ) : null}
            <MissingReasons t={t} estimate={product.estimate} />
          </div>
        </div>
      </Link>
      {canBuy ? (
        <div className="px-3 pb-3">
          {addedQty ? (
            <Link
              href="/app/explore/cart"
              className="mb-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
              data-explore-in-cart={product.id}
            >
              ✓ {t("explore.inCart")} · {t("explore.viewCart")}
            </Link>
          ) : null}
          <form action={addToCartAction}>
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="quantity" value={quantity} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton
              variant="secondary"
              className="w-full rounded-xl border-brand-200 px-2 text-brand-700 hover:border-brand-300 hover:bg-brand-50"
              data-explore-add={product.id}
            >
              <CartIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {t("explore.addQty", { n: quantity.toLocaleString(t.intl) })}
              </span>
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}
