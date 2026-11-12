import type {
  AiReferenceAsset,
  AiReferenceKind,
  AiReferencePrompts,
  BookingItem,
} from "@/lib/db/schema";

/*
 * Referências por IA na escolha do grupo (docs/SUPPLIER_REQUESTS.md,
 * "Referências por IA"): três prompts (duas imagens aproximadas do produto
 * ao final da produção e uma ficha em texto) que a OpenAI transforma em
 * arquivos anexados à solicitação ao fornecedor. Puro: sem rede nem banco.
 */

export const AI_REFERENCE_KINDS = ["product", "detail", "sheet"] as const;
/** Tamanho máximo de cada prompt. */
export const AI_PROMPT_MAX = 2000;

/** O que cada prompt gera. */
export const AI_REFERENCE_OUTPUT: Record<AiReferenceKind, "image" | "text"> = {
  product: "image",
  detail: "image",
  sheet: "text",
};

export interface AiPromptDefaults {
  aiPromptProduct: string;
  aiPromptDetail: string;
  aiPromptSheet: string;
}

/** Os prompts padrão das Configurações. */
export function defaultPrompts(s: AiPromptDefaults): AiReferencePrompts {
  return {
    product: s.aiPromptProduct,
    detail: s.aiPromptDetail,
    sheet: s.aiPromptSheet,
  };
}

/**
 * Prompts digitados na escolha: em branco ou igual ao padrão não é gravado
 * (vale o padrão do dia). Nulo quando os três são o padrão.
 */
export function promptsToSave(
  typed: Partial<Record<AiReferenceKind, string | null>>,
  defaults: AiReferencePrompts,
): AiReferencePrompts | null {
  const out = { ...defaults };
  let custom = false;
  for (const kind of AI_REFERENCE_KINDS) {
    const v = (typed[kind] ?? "").trim().slice(0, AI_PROMPT_MAX);
    if (v && v !== defaults[kind].trim()) {
      out[kind] = v;
      custom = true;
    }
  }
  return custom ? out : null;
}

/** Os prompts que valem para a escolha: os dela ou os padrão. */
export function effectivePrompts(
  saved: AiReferencePrompts | null | undefined,
  defaults: AiReferencePrompts,
): AiReferencePrompts {
  return {
    product: saved?.product?.trim() || defaults.product,
    detail: saved?.detail?.trim() || defaults.detail,
    sheet: saved?.sheet?.trim() || defaults.sheet,
  };
}

type ItemData = Pick<
  BookingItem,
  | "description"
  | "productName"
  | "factoryItemCode"
  | "itemNumber"
  | "material"
  | "colorAssortment"
  | "lengthCm"
  | "widthCm"
  | "heightCm"
  | "capacityMl"
  | "sizeText"
  | "packageType"
  | "powerDetail"
  | "masterCartonQty"
  | "innerQty"
>;

/** Os dados do item que vão junto com cada prompt (só o que a planilha tem). */
export function itemContext(item: ItemData, needs: string | null): string {
  const size = [item.lengthCm, item.widthCm, item.heightCm].every(
    (n) => n !== null,
  )
    ? `${item.lengthCm} x ${item.widthCm} x ${item.heightCm} cm`
    : null;
  const lines: Array<[string, string | number | null]> = [
    ["Product", item.description ?? item.productName],
    ["Name", item.description ? item.productName : null],
    ["Factory code", item.factoryItemCode],
    ["Item number", item.itemNumber],
    ["Material", item.material],
    ["Colors", item.colorAssortment],
    ["Dimensions", size],
    ["Capacity (ml)", item.capacityMl],
    ["Size", item.sizeText],
    ["Packaging", item.packageType],
    ["Function / power", item.powerDetail],
    ["Pieces per master carton", item.masterCartonQty],
    ["Inner pack", item.innerQty],
  ];
  const data = lines
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim())
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`);
  const need = (needs ?? "").trim();
  return [
    "Product data (from the supplier's booking sheet):",
    ...(data.length ? data : ["- (no data)"]),
    ...(need ? ["", "What Wellmix needs in the product:", need] : []),
  ].join("\n");
}

/** O pedido completo à IA: o prompt editado e os dados do item. */
export function buildReferencePrompt(
  kind: AiReferenceKind,
  prompt: string,
  item: ItemData,
  needs: string | null,
): string {
  const tail =
    AI_REFERENCE_OUTPUT[kind] === "image"
      ? "The image is an approximate reference of the finished product, not a photo of a real sample."
      : "Answer in plain text (no markdown tables).";
  return [prompt.trim(), "", itemContext(item, needs), "", tail].join("\n");
}

/** Nome do arquivo gerado. */
export function referenceFileName(
  kind: AiReferenceKind,
  code: string | null,
  mime: string,
): string {
  const base = (code ?? "item")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ext = mime === "text/plain" ? "txt" : mime.split("/")[1] || "png";
  return `ia-${kind}-${base || "item"}.${ext}`;
}

/** Os arquivos de cada tipo, o mais novo primeiro. */
export function assetsByKind(
  assets: AiReferenceAsset[] | null | undefined,
): Partial<Record<AiReferenceKind, AiReferenceAsset>> {
  const out: Partial<Record<AiReferenceKind, AiReferenceAsset>> = {};
  for (const a of [...(assets ?? [])].sort((x, y) => y.at.localeCompare(x.at)))
    if (!out[a.kind]) out[a.kind] = a;
  return out;
}
