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
  product: {
    name: string | null;
    description: string | null;
    brand: string | null;
    material: string | null;
    color: string | null;
    sku: string | null;
    size: string | null;
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
async function safeFetch(raw: string, accept: string) {
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
    product: {
      name: clean(product?.name),
      description: clean(product?.description, 1000),
      brand: clean(nameOf(product?.brand), 120),
      material: clean(product?.material, 120),
      color: clean(product?.color, 60),
      sku: clean(product?.sku ?? product?.mpn, 80),
      size: size || null,
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
};

/** Lê o link com segurança. Nunca lança: o status diz o que aconteceu. */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
  const base = {
    url: raw,
    title: null,
    description: null,
    siteName: null,
    imageUrl: null,
    price: null,
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
  try {
    const { res, url } = await safeFetch(
      parsedUrl.toString(),
      "text/html,application/xhtml+xml",
    );
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return { ...base, status: "blocked" };
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
    if (!/html|xml/i.test(type)) return { ...base, status: "blocked" };
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      await readLimited(res, MAX_HTML),
    );
    const meta = parseLinkHtml(html, url.toString());
    let image: LinkPreview["image"] = null;
    if (meta.imageUrl) {
      try {
        const img = await safeFetch(meta.imageUrl, "image/*");
        const imgType = img.res.headers.get("content-type") ?? "";
        if (img.res.ok && imgType.startsWith("image/"))
          image = {
            bytes: await readLimited(img.res, MAX_IMAGE),
            mime: imgType.split(";")[0],
          };
      } catch {
        image = null;
      }
    }
    const nothing = !meta.title && !meta.description && !meta.imageUrl;
    return {
      ...base,
      ...meta,
      url: url.toString(),
      status: nothing ? "blocked" : "ok",
      image,
    };
  } catch {
    return { ...base, status: "failed" };
  }
}
