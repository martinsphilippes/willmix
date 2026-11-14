import "server-only";
import { productNameText, type Translate } from "@/i18n";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore, type User } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { searchText } from "@/lib/db/store";
import type { Settings } from "@/lib/settings";
import { hiddenBookingProductIds } from "./booking-visibility";

/*
 * Busca de produtos para os campos de produto (auditoria de performance,
 * 14/11/2026): o cadastro tem ~17 mil produtos, e as telas que mostravam
 * todos numa lista de seleção (nova solicitação, novo kit, filtro do
 * Marketing, Superplan) saíam com 4–15 MB. O campo busca pelo nome ou pelo
 * código (SKU) a partir de 2 letras, em /api/products/search.
 */

/** Quantos produtos a busca devolve por vez (o campo mostra os primeiros). */
export const PRODUCT_SEARCH_LIMIT = 20;

/**
 * Que produtos cada campo oferece (o mesmo que a lista antiga mostrava):
 * - `all`: todos, ativos e desativados (filtro do Marketing);
 * - `active`: só os ativos (Superplan);
 * - `catalog`: os ativos menos os ainda em análise no Booking (nova
 *   solicitação e novo kit de marketing: o cliente ainda não os vê).
 */
export const PRODUCT_SCOPES = ["all", "active", "catalog"] as const;
export type ProductScope = (typeof PRODUCT_SCOPES)[number];

export interface ProductHit {
  id: string;
  name: string;
  sku: string | null;
}

/** "Nome (SKU)", como as listas de produto mostravam; nome de exemplo: "Produto sem nome". */
export function productOptionLabel(
  t: Translate,
  product: { name: string | null; sku: string | null },
): string {
  return `${productNameText(t, product.name)}${product.sku ? ` (${product.sku})` : ""}`;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Quem pede a solicitação abre o catálogo do formulário: a Wellmix e o
 * cliente (com "Cliente pode criar solicitação" ligado), na tela de
 * solicitações. As mesmas regras da página /app/requests/new.
 */
export function canPickRequestProducts(
  user: User,
  settings: Pick<Settings, "customerCanCreateRequest">,
): boolean {
  if (!canOpen(user, "requests")) return false;
  if (isWellmix(user)) return true;
  return user.role === "customer" && settings.customerCanCreateRequest;
}

/**
 * Quem pode buscar produtos em cada escopo: só quem abre uma tela que já
 * mostrava aquela lista inteira.
 * - `all`: filtro do Marketing (Wellmix);
 * - `active`: Superplan;
 * - `catalog`: nova solicitação (Wellmix e cliente) e novo kit (Wellmix).
 * O cliente só busca no catálogo (nunca vê desativados nem os do Booking).
 */
export function canSearchProducts(
  user: User,
  scope: ProductScope,
  settings: Pick<Settings, "customerCanCreateRequest">,
): boolean {
  if (scope === "catalog")
    return (
      canPickRequestProducts(user, settings) ||
      (isWellmix(user) && canOpen(user, "marketing"))
    );
  if (!isWellmix(user)) return false;
  return scope === "all"
    ? canOpen(user, "marketing")
    : canOpen(user, "superplan");
}

/**
 * Produtos cujo nome ou código contém o texto (sem diferenciar caixa), em
 * ordem alfabética; o código igual ao digitado vem primeiro.
 */
export async function searchProducts(input: {
  q: string;
  scope: ProductScope;
}): Promise<ProductHit[]> {
  const text = searchText(input.q).slice(0, 80);
  if (text.length < 2) return [];
  const hidden =
    input.scope === "catalog"
      ? await hiddenBookingProductIds()
      : new Set<string>();
  const store = getStore();
  // Nome e código em duas consultas (o banco devolve só id, nome e código).
  const [byName, bySku] = await Promise.all(
    (["name", "sku"] as const).map((column) =>
      listColumns(store, "products", ["name", "sku"], {
        filter: input.scope === "all" ? {} : { active: true },
        search: { column, text },
        orderBy: "name",
        limit: PRODUCT_SEARCH_LIMIT + hidden.size,
      }),
    ),
  );
  const wanted = fold(text);
  const exact = (p: { sku: string | null }) =>
    !!p.sku && fold(p.sku) === wanted ? 0 : 1;
  const seen = new Set<string>();
  return [...byName, ...bySku]
    .filter((p) => {
      if (hidden.has(p.id) || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .sort(
      (a, b) =>
        exact(a) - exact(b) ||
        fold(a.name ?? "").localeCompare(fold(b.name ?? "")) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, PRODUCT_SEARCH_LIMIT)
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? null }));
}

/**
 * Há algum produto no catálogo (ativo e fora do Booking)? Para o aviso
 * "nenhum produto" do novo kit, sem ler o cadastro inteiro.
 */
export async function hasCatalogProducts(
  hidden?: ReadonlySet<string>,
): Promise<boolean> {
  const skip = hidden ?? (await hiddenBookingProductIds());
  const rows = await listColumns(getStore(), "products", ["active"], {
    filter: { active: true },
    limit: skip.size + 1,
  });
  return rows.some((p) => !skip.has(p.id));
}
