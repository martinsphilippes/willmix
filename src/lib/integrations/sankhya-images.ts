import "server-only";

import {
  getStore,
  type PhotoKind,
  type Product,
  type SankhyaImagesState,
  type User,
} from "@/lib/db";
import { audit } from "@/lib/services/audit";
import { imageHashOf } from "@/lib/services/image-hash";
import { executeQuery, SankhyaError, type SankhyaRow } from "./sankhya-client";
import type { FullLoadProgress } from "./sankhya-full-load";
import { readSetting, writeSetting } from "./sankhya-settings";

/*
 * Fotos dos produtos do Sankhya (docs/SANKHYA.md, "Fotos dos produtos"), como
 * o técnico da Sankhya orientou (14/11/2026):
 *
 * - A foto fica em TGFPRO.IMAGEM, em hexadecimal, lida por
 *   DbExplorerSP.executeQuery; nula = produto sem foto. As outras imagens do
 *   cadastro são as colunas AD_IMAGEM05 (arte 800x800), AD_IMAGEM02 (origem
 *   China), AD_IMAGEM03 (arte) e AD_IMAGEM04 (balança).
 * - Uma foto por chamada (a resposta passa de 1 MB), sempre pelo servidor.
 * - Atualização: lista CODPROD e NUVERSAOIMG (sem a imagem) e baixa de novo só
 *   quando NUVERSAOIMG muda. A lista diz também quais colunas têm imagem
 *   (CASE ... IS NULL, vale no SQL Server e no Oracle), para não pedir foto
 *   que não existe.
 * - O portal guarda o arquivo original (até 3000x3000) e gera a miniatura
 *   (lado maior 640 px, JPEG). Serve em /produto/{CODPROD}.jpg.
 *
 * Roda como mais uma entidade da Carga completa (`productImages`), por faixa
 * de CODPROD e com cursor, inclusive na fila do servidor. O job diário
 * recomeça a passada (só baixa o que mudou).
 */

export interface SankhyaImageColumn {
  column: string;
  kind: PhotoKind;
  /** Vira a foto principal do produto quando ele não tem outra. */
  primary: boolean;
  /** Legenda da foto no cadastro. */
  caption: string;
  /** Sufixo do link /produto/{CODPROD}-{slug}.jpg (vazio = a principal). */
  slug: string;
}

export const SANKHYA_IMAGE_COLUMNS: SankhyaImageColumn[] = [
  {
    column: "IMAGEM",
    kind: "commercial",
    primary: true,
    caption: "Sankhya: foto do produto",
    slug: "",
  },
  {
    column: "AD_IMAGEM05",
    kind: "commercial",
    primary: false,
    caption: "Sankhya: arte 800x800",
    slug: "arte800",
  },
  {
    column: "AD_IMAGEM02",
    kind: "supplier",
    primary: false,
    caption: "Sankhya: origem China",
    slug: "china",
  },
  {
    column: "AD_IMAGEM03",
    kind: "other",
    primary: false,
    caption: "Sankhya: arte",
    slug: "arte",
  },
  {
    column: "AD_IMAGEM04",
    kind: "weight_scale",
    primary: false,
    caption: "Sankhya: balança",
    slug: "balanca",
  },
];

/** Lado maior da miniatura (cabe na prévia ao passar o mouse, 640 px). */
export const THUMB_SIZE = 640;
/** Downloads em paralelo (cada um é uma chamada com uma foto). */
const PARALLEL = 3;
/** Produtos por faixa da lista de versões. */
const ROWS = { min: 60, max: 200 };

const int0 = (n: number) => Math.max(0, Math.trunc(Number(n) || 0));
const flag = (column: string) => `H_${column}`;

/* ---- SQL (somente leitura) ---- */

/** Próximo CODPROD com alguma imagem e quantos faltam. */
export function imageProbeSql(after: number, columns: string[]): string {
  return `SELECT MIN(CODPROD) AS NEXTCODE, COUNT(*) AS REMAINING FROM TGFPRO WHERE CODPROD > ${int0(after)} AND (${anyImage(columns)})`;
}

/** CODPROD, NUVERSAOIMG e quais colunas têm imagem (sem baixar a imagem). */
export function imageVersionsSql(
  after: number,
  upTo: number,
  columns: string[],
): string {
  const flags = columns
    .map((c) => `CASE WHEN ${c} IS NULL THEN 0 ELSE 1 END AS ${flag(c)}`)
    .join(", ");
  return `SELECT CODPROD, NUVERSAOIMG, ${flags} FROM TGFPRO WHERE CODPROD > ${int0(after)} AND CODPROD <= ${int0(upTo)} AND (${anyImage(columns)}) ORDER BY CODPROD`;
}

/** Uma imagem de um produto (a chamada que o técnico passou). */
export function imageSql(codProd: number, column: string): string {
  if (!SANKHYA_IMAGE_COLUMNS.some((c) => c.column === column))
    throw new Error(`coluna de imagem inválida: ${column}`);
  return `SELECT CODPROD, NUVERSAOIMG, ${column} FROM TGFPRO WHERE CODPROD = ${int0(codProd)}`;
}

/** A coluna existe no ERP? (consulta vazia, só para o banco validar o nome). */
function columnProbeSql(column: string): string {
  return `SELECT COUNT(*) AS N FROM TGFPRO WHERE CODPROD < 0 AND ${column} IS NULL`;
}

const anyImage = (columns: string[]) =>
  columns.map((c) => `${c} IS NOT NULL`).join(" OR ");

/* ---- Bytes da imagem ---- */

export interface DecodedImage {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

/** Formato pelos primeiros bytes (JPEG na maioria, alguns PNG). */
export function sniffImage(
  bytes: Uint8Array,
): { mime: string; ext: string } | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  )
    return { mime: "image/png", ext: "png" };
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return { mime: "image/gif", ext: "gif" };
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d)
    return { mime: "image/bmp", ext: "bmp" };
  return null;
}

/**
 * Valor da coluna IMAGEM (hexadecimal, às vezes com "0x" na frente) em bytes.
 * Nulo, vazio ou que não é imagem = sem foto.
 */
export function decodeSankhyaImage(
  value: string | number | null | undefined,
): DecodedImage | null {
  if (value == null) return null;
  let text = String(value).trim();
  if (text.startsWith("0x") || text.startsWith("0X")) text = text.slice(2);
  if (!text || text.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(text))
    return null;
  const bytes = new Uint8Array(Buffer.from(text, "hex"));
  const kind = sniffImage(bytes);
  return kind ? { bytes, ...kind } : null;
}

/** Miniatura JPEG (lado maior THUMB_SIZE, fundo branco no lugar da transparência). */
export async function makeThumbnail(
  bytes: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

/* ---- Gravação ---- */

export type ImageOutcome =
  "created" | "updated" | "existing" | "skipped" | "failed";

/** Fotos que falharam guardadas no progresso (as mais recentes). */
const MAX_FAILED = 100;

interface ImageCtx {
  user: User;
  counts: Partial<Record<ImageOutcome, number>>;
  photos: number;
  /** Espera antes da nova tentativa (0 nos testes). */
  retryMs: number;
  /** "CODPROD COLUNA: erro" das fotos que o Sankhya não entregou nesta rodada. */
  failed: string[];
}

/** Grava uma imagem como documento + foto do produto (com a miniatura). */
async function storeImage(
  ctx: ImageCtx,
  product: Product,
  col: SankhyaImageColumn,
  image: DecodedImage,
  makePrimary: boolean,
): Promise<string> {
  const store = getStore();
  const code = product.sankhyaCode!;
  const base = col.slug ? `${code}-${col.slug}` : code;
  const stored = await store.putFile(
    image.bytes,
    `${base}.${image.ext}`,
    image.mime,
  );
  const thumb = await makeThumbnail(image.bytes);
  const thumbStored = thumb
    ? await store.putFile(thumb, `${base}-mini.jpg`, "image/jpeg")
    : null;
  const doc = await store.create("documents", {
    orderId: null,
    requestId: null,
    requirementId: null,
    type: "photo",
    name: stored.name,
    mime: stored.mime,
    size: stored.size,
    storageKey: stored.key,
    version: 1,
    previousDocumentId: null,
    uploadedByUserId: ctx.user.id,
    visibility: "all",
    productId: product.id,
    sourcingItemId: null,
    kitId: null,
    imageHash: (await imageHashOf(thumb ?? image.bytes)) ?? "-",
    thumbKey: thumbStored?.key ?? null,
  });
  const photo = await store.create("product_photos", {
    productId: product.id,
    sourcingItemId: null,
    orderId: null,
    documentId: doc.id,
    kind: col.kind,
    caption: col.caption,
    takenAt: null,
    takenByUserId: null,
    derivedFromPhotoId: null,
    isPrimary: makePrimary,
  });
  ctx.photos++;
  return photo.id;
}

/**
 * A foto anterior da coluna sai do cadastro do produto (a linha de
 * product_photos). O documento e o arquivo ficam: podem ter sido copiados
 * para uma ficha ou pedido.
 */
async function unlinkPhoto(photoId: string): Promise<boolean> {
  const store = getStore();
  const photo = await store.get("product_photos", photoId);
  if (!photo) return false;
  await store.remove("product_photos", photoId);
  return photo.isPrimary;
}

/**
 * O gateway da Sankhya respondeu com erro do servidor (HTTP 5xx) ou caiu a
 * conexão: problema daquela chamada (em 14/11/2026, uma foto dava HTTP 500
 * toda vez e parava a fila). Erro de permissão ou de SQL não entra aqui.
 */
function transient(error: unknown): error is SankhyaError {
  return (
    error instanceof SankhyaError &&
    (error.code === "sankhya_network" ||
      (error.code === "sankhya_http" && (error.status ?? 0) >= 500))
  );
}

/**
 * Baixa uma imagem com uma nova tentativa depois de 1 s; se falhar de novo,
 * devolve o erro para a foto ser pulada (a próxima passada tenta de novo).
 */
async function fetchImageOrFail(
  codProd: number,
  column: string,
  retryMs = 1_000,
): Promise<
  { image: DecodedImage | null; version: string | null } | { error: string }
> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchImage(codProd, column);
    } catch (error) {
      if (!transient(error)) throw error;
      if (attempt >= 1)
        return {
          error: `${error.code} ${error.status ?? ""} ${error.detail}`
            .replace(/\s+/g, " ")
            .slice(0, 200),
        };
      if (retryMs > 0) await new Promise((r) => setTimeout(r, retryMs));
    }
  }
}

/** Baixa uma imagem do Sankhya (uma por chamada). */
async function fetchImage(
  codProd: number,
  column: string,
): Promise<{ image: DecodedImage | null; version: string | null }> {
  const table = await executeQuery(imageSql(codProd, column));
  const row = table.rows[0];
  if (!row) return { image: null, version: null };
  const key =
    Object.keys(row).find((k) => k.toUpperCase() === column) ?? column;
  return {
    image: decodeSankhyaImage(row[key]),
    version: versionOf(row),
  };
}

function versionOf(row: SankhyaRow): string | null {
  const key = Object.keys(row).find((k) => k.toUpperCase() === "NUVERSAOIMG");
  const v = key ? row[key] : null;
  return v == null || v === "" ? null : String(v);
}

const hasFlag = (row: SankhyaRow, column: string) => {
  const key = Object.keys(row).find((k) => k.toUpperCase() === flag(column));
  return key ? Number(row[key]) === 1 : false;
};

/**
 * Um produto: compara a versão e as colunas com imagem com o que o portal
 * guardou; baixa só o que mudou ou falta e tira a foto da coluna que ficou
 * vazia no Sankhya.
 */
async function syncProduct(
  ctx: ImageCtx,
  product: Product,
  row: SankhyaRow,
  columns: SankhyaImageColumn[],
): Promise<ImageOutcome> {
  const store = getStore();
  const codProd = Number(product.sankhyaCode);
  const version = versionOf(row);
  const before: SankhyaImagesState | null = product.sankhyaImages ?? null;
  const photos: Record<string, string> = { ...(before?.photos ?? {}) };
  const sameVersion = !!before && before.version === version;
  let changed = false;
  let primaryDocumentId: string | null | undefined;
  let primaryLost = false;
  let failed = false;

  for (const col of columns) {
    const has = hasFlag(row, col.column);
    const previous = photos[col.column];
    if (sameVersion && has === !!previous) continue;
    if (!has) {
      if (previous) {
        if (await unlinkPhoto(previous)) primaryLost = true;
        delete photos[col.column];
        changed = true;
      }
      continue;
    }
    const fetched = await fetchImageOrFail(codProd, col.column, ctx.retryMs);
    if ("error" in fetched) {
      // Fica como estava (a foto anterior, se havia); a próxima passada tenta de novo.
      console.warn(
        `[sankhya-images] CODPROD ${codProd} ${col.column}: ${fetched.error}`,
      );
      ctx.failed.push(`${codProd} ${col.column}: ${fetched.error}`);
      failed = true;
      continue;
    }
    const { image } = fetched;
    if (!image) {
      // Coluna preenchida com algo que não é imagem: fica sem foto.
      if (previous) {
        if (await unlinkPhoto(previous)) primaryLost = true;
        delete photos[col.column];
      }
      changed = true;
      continue;
    }
    let wasPrimary = false;
    if (previous) wasPrimary = await unlinkPhoto(previous);
    const makePrimary =
      col.primary &&
      (wasPrimary ||
        !(
          await store.list("product_photos", {
            filter: { productId: product.id, isPrimary: true },
            limit: 1,
          })
        ).length);
    const photoId = await storeImage(ctx, product, col, image, makePrimary);
    photos[col.column] = photoId;
    if (makePrimary) {
      const photo = await store.get("product_photos", photoId);
      primaryDocumentId = photo?.documentId ?? null;
    } else if (wasPrimary) primaryLost = true;
    changed = true;
  }

  const state: SankhyaImagesState = {
    // Com foto pulada, guarda a versão anterior: a próxima passada vê a
    // versão diferente e tenta de novo.
    version: failed ? (before?.version ?? null) : version,
    photos,
    syncedAt: new Date().toISOString(),
  };
  const patch: Partial<Product> = { sankhyaImages: state };
  if (primaryDocumentId) patch.primaryPhotoDocumentId = primaryDocumentId;
  else if (primaryLost) patch.primaryPhotoDocumentId = null;
  // Sem nada novo, só grava a versão quando ela mudou (evita uma gravação
  // por produto na passada diária).
  if (changed || (!sameVersion && !failed))
    await store.update("products", product.id, patch);
  if (failed) return "failed";
  if (!changed) return "existing";
  return before && Object.keys(before.photos).length ? "updated" : "created";
}

/* ---- Carga por faixa (entidade productImages da Carga completa) ---- */

const KEY = "sankhya.load.productImages";

const EMPTY: FullLoadProgress = {
  after: 0,
  span: 500,
  done: false,
  remaining: null,
  counts: {},
  missing: [],
  startedAt: null,
  updatedAt: null,
};

/** Colunas de imagem que o ERP tem (as AD_ são personalizadas; confere uma vez por passada). */
async function availableColumns(
  progress: FullLoadProgress,
): Promise<SankhyaImageColumn[]> {
  if (progress.startedAt == null) {
    const missing: string[] = [];
    for (const col of SANKHYA_IMAGE_COLUMNS) {
      try {
        await executeQuery(columnProbeSql(col.column));
      } catch (error) {
        // Gateway fora não diz nada sobre a coluna: a rodada para e tenta depois.
        if (transient(error)) throw error;
        missing.push(col.column);
      }
    }
    // Sem a IMAGEM, a consulta da lista falha de novo e mostra o erro do Sankhya.
    progress.missing = missing.filter((c) => c !== "IMAGEM");
  }
  return SANKHYA_IMAGE_COLUMNS.filter(
    (c) => !progress.missing.includes(c.column),
  );
}

/**
 * Processa faixas de CODPROD até `budgetMs` e grava o cursor a cada produto
 * concluído; chamar de novo continua.
 */
export async function runImageLoad(
  user: User,
  budgetMs = 30_000,
  now: () => number = () => Date.now(),
  retryMs = 1_000,
): Promise<FullLoadProgress> {
  const started = now();
  const progress: FullLoadProgress = {
    ...EMPTY,
    ...((await readSetting<FullLoadProgress>(KEY)) ?? {}),
  };
  if (progress.done) return progress;
  const columns = await availableColumns(progress);
  progress.startedAt ??= new Date().toISOString();
  const names = columns.map((c) => c.column);
  const ctx: ImageCtx = { user, counts: {}, photos: 0, retryMs, failed: [] };
  const persist = async () => {
    for (const [o, n] of Object.entries(ctx.counts))
      progress.counts[o as ImageOutcome] =
        (progress.counts[o as ImageOutcome] ?? 0) + (n ?? 0);
    ctx.counts = {};
    if (ctx.failed.length)
      progress.failed = [...(progress.failed ?? []), ...ctx.failed].slice(
        -MAX_FAILED,
      );
    ctx.failed = [];
    progress.updatedAt = new Date().toISOString();
    await writeSetting(KEY, progress);
  };
  // Pelo menos um grupo por chamada, para sempre andar.
  let worked = false;
  const timeLeft = () => (worked ? budgetMs - (now() - started) : 1);

  outer: while (timeLeft() > 0) {
    const probe = await executeQuery(imageProbeSql(progress.after, names));
    const next = Number(probe.rows[0]?.NEXTCODE);
    progress.remaining = Number(probe.rows[0]?.REMAINING) || 0;
    if (!Number.isFinite(next) || !progress.remaining) {
      progress.done = true;
      break;
    }
    const from = next - 1;
    const upTo = from + progress.span;
    const all = (await executeQuery(imageVersionsSql(from, upTo, names))).rows;
    if (all.length > ROWS.max)
      progress.span = Math.max(1, Math.floor(progress.span / 2));
    else if (all.length < ROWS.min)
      progress.span = Math.min(1_000_000, progress.span * 2);
    const rows = all.slice(0, ROWS.max);
    const codeOf = (r: SankhyaRow) =>
      Number(r[Object.keys(r).find((k) => k.toUpperCase() === "CODPROD")!]);
    const products = rows.length
      ? await getStore().list("products", {
          filter: { sankhyaCode: rows.map((r) => String(codeOf(r))) },
        })
      : [];
    const byCode = new Map(products.map((p) => [p.sankhyaCode!, p]));

    // Em grupos de PARALLEL produtos; o cursor anda até o último grupo inteiro.
    for (let i = 0; i < rows.length; i += PARALLEL) {
      if (timeLeft() <= 0) break outer;
      const group = rows.slice(i, i + PARALLEL);
      const outcomes = await Promise.all(
        group.map(async (row) => {
          const product = byCode.get(String(codeOf(row)));
          if (!product) return "skipped" as const;
          return syncProduct(ctx, product, row, columns);
        }),
      );
      for (const o of outcomes) ctx.counts[o] = (ctx.counts[o] ?? 0) + 1;
      progress.after = codeOf(group[group.length - 1]);
      worked = true;
      await persist();
    }
    if (rows.length === all.length)
      progress.after = Math.max(progress.after, upTo);
    await persist();
  }
  await persist();
  if (ctx.photos)
    await audit(
      user,
      "sankhya.images",
      "system",
      "sankhya",
      `Fotos do Sankhya: ${ctx.photos} gravadas (até CODPROD ${progress.after})`,
    );
  return progress;
}

/* ---- Link /produto/{CODPROD}.jpg ---- */

/**
 * Documento da foto do Sankhya de um produto pelo nome do link:
 * "23756.jpg" (IMAGEM), "23756-arte800.jpg" (AD_IMAGEM05) etc.; com
 * "-mini" no fim, a miniatura.
 */
export function parseImageLink(
  file: string,
): { code: string; column: string; thumb: boolean } | null {
  const m =
    /^(\d{1,12})(?:-([a-z0-9]+))?(-mini)?\.(?:jpe?g|png|gif|webp|bmp)$/i.exec(
      file,
    );
  if (!m) return null;
  const slug = (m[2] ?? "").toLowerCase();
  const thumb = !!m[3] || slug === "mini";
  const col = SANKHYA_IMAGE_COLUMNS.find(
    (c) => c.slug === (slug === "mini" ? "" : slug),
  );
  if (!col) return null;
  return { code: m[1], column: col.column, thumb };
}

/** Id do documento da foto daquela coluna para o produto do CODPROD. */
export async function sankhyaImageDocument(
  code: string,
  column: string,
): Promise<string | null> {
  const store = getStore();
  const [product] = await store.list("products", {
    filter: { sankhyaCode: code },
    limit: 1,
  });
  const photoId = product?.sankhyaImages?.photos?.[column];
  if (!photoId) return null;
  const photo = await store.get("product_photos", photoId);
  return photo?.documentId ?? null;
}

/* ---- Passada diária (job /api/jobs/reminders) ---- */

/** Uma passada terminada há mais que isto recomeça (só baixa o que mudou). */
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

/**
 * Recomeça a passada das fotos e põe na fila do servidor, com a pessoa que
 * ligou a fila da última vez (admin ativo). Só depois da carga inicial
 * terminada; nada acontece se a integração nunca rodou a carga das fotos.
 */
export async function scheduleImageRefresh(
  now: () => number = () => Date.now(),
): Promise<"queued" | "not_due" | "no_user"> {
  const progress = {
    ...EMPTY,
    ...((await readSetting<FullLoadProgress>(KEY)) ?? {}),
  };
  if (!progress.done || !progress.updatedAt) return "not_due";
  if (now() - Date.parse(progress.updatedAt) < REFRESH_AFTER_MS)
    return "not_due";
  const queue = await import("./sankhya-load-queue");
  const server = await queue.getServerLoad();
  if (server.active && server.queue.includes("productImages")) return "not_due";
  const user = server.userId
    ? await getStore().get("users", server.userId)
    : null;
  const { isAdmin } = await import("@/lib/auth/permissions");
  if (!user || !user.active || !isAdmin(user)) return "no_user";
  await writeSetting(KEY, { ...EMPTY, missing: [] });
  await queue.startServerLoad(user, ["productImages"]);
  return "queued";
}
