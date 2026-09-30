import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";

/**
 * Leitura de um link de produto (loja, marketplace, catálogo do fornecedor):
 * título, descrição, imagem e dados de produto (Open Graph e JSON-LD).
 * Segurança (SSRF): só http/https nas portas padrão, nunca endereços internos
 * (checado de novo a cada redirecionamento), tempo e tamanho limitados.
 * Nada de scraping com navegador: muitos marketplaces chineses bloqueiam
 * leitura automática; nesse caso o status é "blocked" e a pessoa segue pela
 * foto ou preenche.
 */
export interface LinkPreview {
  status: "ok" | "blocked" | "failed" | "invalid";
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  price: string | null;
  /** Categoria da loja (ex.: "Celulares e Telefones > Celulares e Smartphones"). */
  category: string | null;
  product: {
    name: string | null;
    description: string | null;
    brand: string | null;
    material: string | null;
    color: string | null;
    sku: string | null;
    size: string | null;
    model: string | null;
  };
  image: { bytes: Uint8Array; mime: string } | null;
}

const TIMEOUT_MS = 8000;
const MAX_HTML = 1_500_000;
const MAX_IMAGE = 6_000_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; WellmixBot/1.0; +https://portal-wellmix.vercel.app)";

/** IPv4/IPv6 privado, loopback, link-local, CGNAT, multicast ou reservado. */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const v = address.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

/** Só http/https, portas padrão e host que resolve para endereço público. */
export async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("invalid");
  if (url.port && url.port !== "80" && url.port !== "443")
    throw new Error("invalid");
  if (url.username || url.password) throw new Error("invalid");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    throw new Error("invalid");
  const addresses = net.isIP(host)
    ? [host]
    : (await dnsLookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress))
    throw new Error("invalid");
}

async function readLimited(res: Response, max: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** fetch com redirecionamento manual (cada destino passa pela checagem de endereço). */
async function safeFetch(
  raw: string,
  accept: string,
  extraHeaders?: Record<string, string>,
) {
  let url = new URL(raw);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8,zh;q=0.6",
        ...extraHeaders,
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return { res, url };
  }
  throw new Error("too_many_redirects");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  reg: "®",
  trade: "™",
};
/* Acentos do português: &ccedil; &atilde; &Eacute; … (maiúscula preservada). */
const ACCENTS: Record<string, string> = {
  acute: "\u0301",
  grave: "\u0300",
  circ: "\u0302",
  tilde: "\u0303",
  uml: "\u0308",
  cedil: "\u0327",
};
function namedEntity(name: string): string | null {
  const plain = ENTITIES[name.toLowerCase()];
  if (plain) return plain;
  const m = name.match(/^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil)$/);
  return m ? (m[1] + ACCENTS[m[2]]).normalize("NFC") : null;
}
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return namedEntity(e) ?? m;
  });
}

const clean = (s: unknown, max = 500): string | null => {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const v = decodeEntities(String(s)).replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

/** Primeiro objeto Product em JSON-LD (aceita lista e @graph). */
function findProduct(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findProduct(n, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && /product/i.test(t)))
    return obj;
  return findProduct(obj["@graph"], depth + 1);
}

const nameOf = (v: unknown) =>
  typeof v === "string"
    ? v
    : v && typeof v === "object" && "name" in v
      ? (v as { name: unknown }).name
      : null;
const firstImage = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (v && typeof v === "object" && "url" in v)
    return firstImage((v as { url: unknown }).url);
  return null;
};

/** Extrai metadados do HTML (Open Graph, Twitter, <title>, JSON-LD Product). */
export function parseLinkHtml(
  html: string,
  baseUrl: string,
): Omit<LinkPreview, "status" | "url" | "image"> {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(
      /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
    ))
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
    const key = (attrs.property || attrs.name || attrs.itemprop || "")
      .toLowerCase()
      .trim();
    if (key && attrs.content !== undefined && !(key in meta))
      meta[key] = attrs.content;
  }
  let product: Record<string, unknown> | null = null;
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      product = findProduct(JSON.parse(m[1].trim()));
    } catch {
      product = null;
    }
    if (product) break;
  }
  const offers = product?.offers as Record<string, unknown> | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const absolute = (u: string | null) => {
    if (!u) return null;
    try {
      const url = new URL(decodeEntities(u), baseUrl);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  };
  const priceAmount =
    clean(offer?.price, 30) ?? clean(meta["product:price:amount"], 30);
  const priceCurrency =
    clean(offer?.priceCurrency, 5) ?? clean(meta["product:price:currency"], 5);
  const size = [product?.size, product?.width, product?.height, product?.depth]
    .map((v) => clean(nameOf(v), 60))
    .filter(Boolean)
    .join(" × ");
  return {
    title:
      clean(meta["og:title"]) ??
      clean(meta["twitter:title"]) ??
      clean(titleTag) ??
      clean(product?.name),
    description:
      clean(meta["og:description"], 1000) ??
      clean(meta["twitter:description"], 1000) ??
      clean(meta.description, 1000) ??
      clean(product?.description, 1000),
    siteName: clean(meta["og:site_name"], 160),
    imageUrl: absolute(
      meta["og:image"] ??
        meta["og:image:url"] ??
        meta["twitter:image"] ??
        firstImage(product?.image),
    ),
    price: priceAmount
      ? `${priceCurrency ? `${priceCurrency} ` : ""}${priceAmount}`
      : null,
    category: clean(nameOf(product?.category), 200),
    product: {
      name: clean(product?.name),
      description: clean(product?.description, 1000),
      brand: clean(nameOf(product?.brand), 120),
      material: clean(product?.material, 120),
      color: clean(product?.color, 60),
      sku: clean(product?.sku ?? product?.mpn, 80),
      size: size || null,
      model: clean(nameOf(product?.model), 120),
    },
  };
}

const EMPTY_PRODUCT: LinkPreview["product"] = {
  name: null,
  description: null,
  brand: null,
  material: null,
  color: null,
  sku: null,
  size: null,
  model: null,
};

/* ------------------------------------------------------------------------ */
/* Mercado Livre: API pública oficial (a página costuma barrar leitura)       */
/* ------------------------------------------------------------------------ */

const ML_HOST = /(^|\.)mercadoli(vre|bre)\.com(\.[a-z]{2})?$/i;
const ML_API = "https://api.mercadolibre.com";

/** Ids de anúncio (MLB123…) e de produto de catálogo (/p/MLB…) e palavras do endereço. */
export function mercadoLivreIds(url: URL) {
  if (!ML_HOST.test(url.hostname)) return null;
  const all = `${url.pathname} ${decodeURIComponent(url.search)} ${decodeURIComponent(url.hash)}`;
  const productId =
    url.pathname.match(/\/p\/([A-Z]{3}\d{5,})/i)?.[1]?.toUpperCase() ?? null;
  const itemIds = new Set<string>();
  for (const m of all.matchAll(/(?:item_id[:=]|wid=)([A-Z]{3}\d{5,})/gi))
    itemIds.add(m[1].toUpperCase());
  const pathItem = url.pathname.match(/\/([A-Z]{3})-(\d{5,})-([^/]*)/i);
  if (pathItem) itemIds.add(`${pathItem[1]}${pathItem[2]}`.toUpperCase());
  const slug = pathItem?.[3]
    ? pathItem[3]
        .replace(/-_J[MP].*$/i, "")
        .replace(/-/g, " ")
        .trim()
    : null;
  if (!productId && itemIds.size === 0 && !slug) return null;
  return { productId, itemIds: [...itemIds], slug: slug || null };
}

type MlAttr = { id?: string; value_name?: string | null };
const mlAttr = (attrs: unknown, ...ids: string[]) =>
  (Array.isArray(attrs) ? (attrs as MlAttr[]) : []).find(
    (a) => a.id && ids.includes(a.id) && a.value_name,
  )?.value_name ?? null;

/** Converte a resposta de /items ou /products da API do Mercado Livre. */
export function mapMercadoLivre(
  json: Record<string, unknown>,
  categoryPath: string | null,
): Omit<LinkPreview, "status" | "url" | "image"> {
  const pictures = Array.isArray(json.pictures)
    ? (json.pictures as Array<{ secure_url?: string; url?: string }>)
    : [];
  const shortDescription = (json.short_description as { content?: string })
    ?.content;
  const price =
    typeof json.price === "number"
      ? `${typeof json.currency_id === "string" ? `${json.currency_id} ` : ""}${json.price}`
      : null;
  return {
    title: clean(json.title ?? json.name, 300),
    description: clean(shortDescription, 1000),
    siteName: "Mercado Livre",
    imageUrl: pictures[0]?.secure_url ?? pictures[0]?.url ?? null,
    price,
    category: categoryPath,
    product: {
      name: clean(json.title ?? json.name, 300),
      description: clean(shortDescription, 1000),
      brand: clean(mlAttr(json.attributes, "BRAND"), 120),
      material: clean(
        mlAttr(json.attributes, "MATERIAL", "MAIN_MATERIAL"),
        120,
      ),
      color: clean(mlAttr(json.attributes, "COLOR", "MAIN_COLOR"), 60),
      sku: clean(mlAttr(json.attributes, "SELLER_SKU", "GTIN"), 80),
      size: null,
      model: clean(mlAttr(json.attributes, "MODEL", "LINE"), 120),
    },
  };
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const token = process.env.MERCADOLIVRE_ACCESS_TOKEN?.trim();
    const { res } = await safeFetch(
      url,
      "application/json",
      token ? { authorization: `Bearer ${token}` } : undefined,
    );
    if (!res.ok) {
      console.warn("mercadolivre api", res.status, url.replace(ML_API, ""));
      return null;
    }
    return JSON.parse(
      new TextDecoder().decode(await readLimited(res, MAX_HTML)),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Dados do anúncio/produto pela API; null se a API não responder. */
async function fetchMercadoLivre(
  ids: NonNullable<ReturnType<typeof mercadoLivreIds>>,
) {
  let json: Record<string, unknown> | null = null;
  for (const id of ids.itemIds) {
    json = await fetchJson(`${ML_API}/items/${id}`);
    if (json?.title) break;
  }
  if (!json?.title && ids.productId)
    json = await fetchJson(`${ML_API}/products/${ids.productId}`);
  if (!json || !(json.title || json.name)) return null;
  let categoryPath: string | null = null;
  if (typeof json.category_id === "string") {
    const cat = await fetchJson(`${ML_API}/categories/${json.category_id}`);
    const path = Array.isArray(cat?.path_from_root)
      ? (cat.path_from_root as Array<{ name?: string }>)
          .map((c) => c.name)
          .filter(Boolean)
          .join(" > ")
      : null;
    categoryPath = path || (typeof cat?.name === "string" ? cat.name : null);
  }
  return mapMercadoLivre(json, categoryPath);
}

/** Título que é só o nome da loja ("Mercado Libre", "Amazon.com.br"…) não descreve o produto. */
export function isGenericTitle(
  title: string | null,
  siteName: string | null,
): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (siteName && t === siteName.trim().toLowerCase()) return true;
  return /^(mercado ?(libre|livre)|amazon(\.com)?(\.br)?|aliexpress|shopee|alibaba(\.com)?|1688|temu|shein|magazine luiza|magalu|americanas|casas bahia|kabum!?)( ?[-|:].*)?$/i.test(
    t,
  );
}

async function downloadImage(url: string | null) {
  if (!url) return null;
  try {
    const img = await safeFetch(url, "image/*");
    const type = img.res.headers.get("content-type") ?? "";
    if (img.res.ok && type.startsWith("image/"))
      return {
        bytes: await readLimited(img.res, MAX_IMAGE),
        mime: type.split(";")[0],
      };
  } catch {
    return null;
  }
  return null;
}

/** Lê o link com segurança. Nunca lança: o status diz o que aconteceu. */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
  const base = {
    url: raw,
    title: null,
    description: null,
    siteName: null,
    imageUrl: null,
    price: null,
    category: null,
    product: EMPTY_PRODUCT,
    image: null,
  };
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(raw);
    await assertPublicUrl(parsedUrl);
  } catch {
    return { ...base, status: "invalid" };
  }
  // Mercado Livre: API oficial primeiro; o endereço também dá o nome do anúncio.
  const ml = mercadoLivreIds(parsedUrl);
  if (ml) {
    const data = await fetchMercadoLivre(ml);
    if (data)
      return {
        ...base,
        ...data,
        status: "ok",
        image: await downloadImage(data.imageUrl),
      };
  }
  const fromSlug = ml?.slug
    ? {
        ...base,
        status: "ok" as const,
        title: ml.slug,
        siteName: "Mercado Livre",
      }
    : null;
  try {
    const { res, url } = await safeFetch(
      parsedUrl.toString(),
      "text/html,application/xhtml+xml",
    );
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return fromSlug ?? { ...base, status: "blocked" };
    // Link direto para uma imagem: vale como foto.
    if (type.startsWith("image/")) {
      const bytes = await readLimited(res, MAX_IMAGE);
      return {
        ...base,
        status: "ok",
        imageUrl: url.toString(),
        image: { bytes, mime: type.split(";")[0] },
      };
    }
    if (!/html|xml/i.test(type))
      return fromSlug ?? { ...base, status: "blocked" };
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      await readLimited(res, MAX_HTML),
    );
    const meta = parseLinkHtml(html, url.toString());
    // Página de verificação/bloqueio: o título é só o nome da loja.
    if (isGenericTitle(meta.title, meta.siteName) && !meta.product.name)
      meta.title = ml?.slug ?? null;
    const image = await downloadImage(meta.imageUrl);
    const nothing = !meta.title && !meta.description && !meta.imageUrl;
    if (nothing && fromSlug) return fromSlug;
    return {
      ...base,
      ...meta,
      url: url.toString(),
      status: nothing ? "blocked" : "ok",
      image,
    };
  } catch {
    return fromSlug ?? { ...base, status: "failed" };
  }
}
