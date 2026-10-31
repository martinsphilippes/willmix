import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { SCREENS, SCREEN_LABEL, type Screen } from "@/lib/auth/screens";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getSettings } from "@/lib/settings";
import {
  canBuyOnStorefront,
  canExplore,
  EXPLORE_SORTS,
  exploreCatalog,
  type ExploreSort,
} from "@/lib/services/catalog-explore";
import { cartCount } from "@/lib/services/cart";
import { ExploreHero, ProductCard, TrustStrip } from "@/components/explore-ui";
import { Alert, cx } from "@/components/ui";

/*
 * Vitrine do cliente (Explorar): busca, categorias, ordem e a grade de
 * produtos com preço estimado. O cliente adiciona ao carrinho direto do card;
 * a Wellmix vê a mesma vitrine (para conferir) e o que falta para cada preço.
 */
export default async function ExplorePage({
  searchParams,
}: PageProps<"/app/explore">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/explore");
  requireScreen(user, "explore");
  // Cliente sem empresa vai às solicitações (o início, /app, o mandaria de volta).
  if (!canExplore(user))
    redirect(user.role === "customer" ? "/app/requests" : "/app");
  const params = await searchParams;
  // Tela negada no caminho até aqui (?denied=…): aviso, só com chave conhecida.
  const deniedScreen = (SCREENS as readonly string[]).includes(
    String(params.denied ?? ""),
  )
    ? (params.denied as Screen)
    : null;
  const q = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const lineId =
    typeof params.line === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.line)
      ? params.line
      : null;
  const sort = EXPLORE_SORTS.includes(params.sort as ExploreSort)
    ? (params.sort as ExploreSort)
    : null;
  const added = typeof params.added === "string" ? params.added : null;
  const addedQty =
    typeof params.qty === "string" && /^\d{1,9}$/.test(params.qty)
      ? Number(params.qty)
      : null;
  const error = typeof params.error === "string" ? params.error : null;
  const t = await getT();
  const wellmix = isWellmix(user);
  const [{ items, lines, total }, count, settings, canBuy] = await Promise.all([
    exploreCatalog(user, { q, lineId, sort }),
    cartCount(user),
    getSettings(),
    canBuyOnStorefront(user),
  ]);
  const addedProduct = added ? items.find((p) => p.id === added) : null;

  /** Link da vitrine mantendo a busca e mudando só o que for passado. */
  const hrefWith = (change: {
    line?: string | null;
    sort?: string | null;
    q?: string | null;
  }) => {
    const next = new URLSearchParams();
    const nq = change.q !== undefined ? change.q : q;
    const nl = change.line !== undefined ? change.line : lineId;
    const ns = change.sort !== undefined ? change.sort : sort;
    if (nq) next.set("q", nq);
    if (nl) next.set("line", nl);
    if (ns && ns !== "relevance") next.set("sort", ns);
    const s = next.toString();
    return s ? `/app/explore?${s}` : "/app/explore";
  };
  const back = hrefWith({});
  const errorKey = `explore.error.${error ?? ""}` as DictionaryKey;
  const errorText = error
    ? t(errorKey) !== errorKey
      ? t(errorKey)
      : t("common.error")
    : null;
  const totalInLines = lines.reduce((sum, l) => sum + l.count, 0);

  return (
    <div className="space-y-4" data-explore="">
      {wellmix ? (
        <Alert tone="info">{t("explore.preview.banner")}</Alert>
      ) : null}
      <ExploreHero
        t={t}
        q={q}
        sort={sort}
        cartCount={count}
        showCart={canBuy}
      />
      {!wellmix && !canBuy ? (
        <Alert tone="warning">{t("explore.disabled")}</Alert>
      ) : null}
      {added ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200"
          role="status"
          data-explore-added={added}
        >
          <span className="font-semibold">
            {addedProduct && addedQty
              ? t("explore.addedQty", {
                  name: addedProduct.name,
                  n: addedQty.toLocaleString(t.intl),
                })
              : t("explore.added")}
          </span>
          <Link
            href="/app/explore/cart"
            className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            {t("explore.viewCart")}
          </Link>
        </div>
      ) : null}
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {deniedScreen ? (
        <Alert tone="warning">
          {t("access.denied", { screen: t(SCREEN_LABEL[deniedScreen]) })}
        </Alert>
      ) : null}
      <TrustStrip t={t} slaDays={settings.quoteSlaBusinessDays} />

      {/* Categorias (linhas de produto), com a contagem da busca atual. */}
      <nav
        aria-label={t("explore.categories")}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        <CategoryChip
          href={hrefWith({ line: null })}
          active={!lineId}
          label={t("explore.allCategories")}
          count={totalInLines}
        />
        {lines.map((l) => (
          <CategoryChip
            key={l.id}
            href={hrefWith({ line: l.id })}
            active={lineId === l.id}
            label={l.name}
            count={l.count}
          />
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600" data-explore-count={items.length}>
          {q
            ? items.length === 1
              ? t("explore.results.forOne", { q })
              : t("explore.results.for", { n: items.length, q })
            : items.length === 1
              ? t("explore.results.one")
              : t("explore.results", { n: items.length })}
          {q ? (
            <>
              {" · "}
              <Link
                href={hrefWith({ q: null })}
                className="font-medium text-brand-700 hover:underline"
              >
                {t("explore.clear")}
              </Link>
            </>
          ) : null}
        </p>
        <div
          className="flex flex-wrap items-center gap-1 rounded-2xl bg-zinc-100 p-1 text-xs"
          role="group"
          aria-label={t("explore.sort.label")}
        >
          {EXPLORE_SORTS.map((s) => {
            const active = (sort ?? "relevance") === s;
            return (
              <Link
                key={s}
                href={hrefWith({ sort: s })}
                aria-current={active ? "true" : undefined}
                className={cx(
                  "whitespace-nowrap rounded-full px-3 py-1.5 font-semibold transition",
                  active
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                {t(`explore.sort.${s}`)}
              </Link>
            );
          })}
        </div>
      </div>

      {items.length ? (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          data-explore-grid={total}
        >
          {items.map((product) => (
            <ProductCard
              key={product.id}
              t={t}
              product={product}
              canBuy={canBuy}
              back={back}
              addedQty={added === product.id ? addedQty : null}
            />
          ))}
          {canBuy || wellmix ? <RequestOtherCard t={t} /> : null}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
            <p className="text-base font-semibold text-zinc-900">
              {t("explore.empty")}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {t("explore.empty.hint")}
            </p>
            {q || lineId ? (
              <Link
                href="/app/explore"
                className="mt-3 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                {t("explore.clearFilters")}
              </Link>
            ) : null}
          </div>
          {canBuy || wellmix ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <RequestOtherCard t={t} />
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-brand-600 bg-brand-600 text-white shadow-sm"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
      )}
    >
      {label}
      <span
        className={cx(
          "rounded-full px-1.5 text-[11px] font-semibold",
          active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

/** Último card da grade: pedir um produto que não está no catálogo. */
function RequestOtherCard({ t }: { t: Awaited<ReturnType<typeof getT>> }) {
  return (
    <li className="flex min-w-0">
      <Link
        href="/app/requests/new"
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50"
        data-explore-request-other=""
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-light text-brand-600 shadow-sm">
          +
        </span>
        <span className="text-sm font-semibold text-brand-800">
          {t("explore.requestOther")}
        </span>
        <span className="text-xs text-zinc-600">
          {t("explore.requestOther.hint")}
        </span>
      </Link>
    </li>
  );
}
