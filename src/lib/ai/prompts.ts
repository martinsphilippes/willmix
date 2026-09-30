import type { LinePrompts, Product, ProductLine, SourcingItem } from "@/lib/db";

/*
 * Prompts centralizados: Prompt Base + Product Line + Produto + Contexto.
 * Nenhum componente ou action monta prompt por conta própria; tudo passa por
 * buildPrompt. A resposta pedida é sempre JSON, validada no serviço, e
 * nenhum valor sugerido vira cadastro sem confirmação humana.
 */
export type PromptKind =
  "registration" | "description" | "marketing" | "image" | "ncm" | "lookup";

export const BASE_PROMPTS: Record<PromptKind, string> = {
  registration: [
    "Você apoia o cadastro de produtos importados da China para o Brasil.",
    "Analise a foto e responda SOMENTE um JSON com o formato:",
    '{"category": string|null, "description": string|null, "materials": string[], "colors": string[], "attributes": {"nome": "valor"}, "confidence": "low"|"medium"|"high", "notes": string|null}',
    "Descreva o que é visível. Não invente dimensões, peso, preço, MOQ nem certificações.",
    "Materiais são hipóteses: liste os prováveis; a confirmação é humana.",
    "Quando não tiver certeza, use null ou lista vazia.",
  ].join("\n"),
  description: [
    "Escreva uma descrição comercial curta (até 400 caracteres), em português do Brasil, clara e sem exageros,",
    'baseada apenas nos dados informados. Responda SOMENTE um JSON: {"description": string}.',
  ].join("\n"),
  marketing: [
    "Você é redator de marketing para um importador brasileiro.",
    "Com base nos dados do produto, proponha material comercial em português do Brasil.",
    'Responda SOMENTE um JSON: {"concept": string, "slogan": string, "description": string, "campaign": string, "colors": string[]}',
    "Não invente certificações, prêmios, preços ou promessas técnicas que não estejam nos dados.",
  ].join("\n"),
  lookup: [
    "Você ajuda um cliente de um importador brasileiro a descrever o produto que quer comprar, a partir da foto e/ou do link de referência.",
    'Responda SOMENTE um JSON: {"catalogMatches": [{"id": string, "reason": string}], "productName": [string], "description": [string], "specification": [string]}',
    "catalogMatches: só ids da lista CATÁLOGO que sejam o mesmo produto ou muito provavelmente o mesmo; lista vazia se nenhum.",
    "productName: até 3 nomes curtos e comerciais em português do Brasil.",
    "description: até 3 descrições de uma ou duas frases do produto.",
    "specification: até 3 especificações do que é visível ou informado (material provável, cor, formato, tamanho aparente).",
    "Não invente medidas, peso, preço, marca ou certificações que não estejam na foto ou no link.",
  ].join("\n"),
  ncm: [
    "Você apoia a classificação fiscal (NCM, Mercosul) de produtos importados da China para o Brasil.",
    "Com base nos dados do produto, proponha até 3 códigos NCM prováveis, do mais provável ao menos provável.",
    'Responda SOMENTE um JSON: {"candidates": [{"ncm": "0000.00.00", "description": string, "reason": string}]}',
    "Use o formato 0000.00 ou 0000.00.00. Na dúvida, prefira a posição de 4 ou 6 dígitos.",
    "É uma sugestão: a validação é sempre do despachante.",
  ].join("\n"),
  image: [
    "Escreva um prompt de imagem comercial (fundo neutro, iluminação de estúdio, produto em destaque)",
    'para o produto descrito. Responda SOMENTE um JSON: {"imagePrompt": string}.',
  ].join("\n"),
};

/** Qual prompt da linha complementa cada tipo. */
function linePromptFor(kind: PromptKind, prompts: LinePrompts | null) {
  if (!prompts) return null;
  switch (kind) {
    case "marketing":
      return prompts.marketingPrompt;
    case "image":
      return prompts.imagePrompt;
    default:
      return prompts.descriptionPrompt;
  }
}

/** Fatos do produto ou do item de sourcing em texto (só o que está preenchido). */
export function productFacts(
  p: Partial<Pick<Product, keyof Product>> | Partial<SourcingItem> | null,
): string {
  if (!p) return "";
  const rows: Array<[string, unknown]> = [
    ["Nome", p.name],
    ["Categoria", p.category],
    ["Material", p.material],
    ["Cor", p.color],
    ["Pantone", p.pantone],
    ["Especificação", "specification" in p ? p.specification : null],
    ["Descrição", "description" in p ? p.description : null],
    ["Observações", p.notes],
  ];
  return rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join("\n");
}

export interface BuildPromptInput {
  /** Prompt base vindo das configurações (vazio = o padrão em código). */
  base?: string | null;
  line?: Pick<ProductLine, "name" | "prompts"> | null;
  product?: Partial<Product> | Partial<SourcingItem> | null;
  /** Contexto livre: cliente, campanha, mercado, instruções do operador. */
  context?: string | null;
}

/** Prompt final = base + linha (prompt, atributos, regras) + produto + contexto. */
export function buildPrompt(kind: PromptKind, input: BuildPromptInput = {}) {
  const parts: string[] = [input.base?.trim() || BASE_PROMPTS[kind]];
  if (input.line) {
    parts.push(`Linha de produto: ${input.line.name}.`);
    const extra = linePromptFor(kind, input.line.prompts);
    if (extra?.trim()) parts.push(extra.trim());
    const required = input.line.prompts?.requiredAttributes ?? [];
    if (required.length)
      parts.push(`Atributos que a linha exige: ${required.join(", ")}.`);
    const rules = input.line.prompts?.validationRules ?? [];
    if (rules.length) parts.push(`Regras: ${rules.join("; ")}.`);
  }
  const facts = productFacts(input.product ?? null);
  if (facts) parts.push(`Dados já cadastrados:\n${facts}`);
  if (input.context?.trim()) parts.push(`Contexto: ${input.context.trim()}`);
  return parts.join("\n\n");
}

/**
 * Atributos exigidos pela linha × ficha do produto (determinístico, sem IA).
 * Chaves conhecidas mapeiam para colunas; as demais só podem ser conferidas
 * manualmente e são devolvidas em `manual`.
 */
const ATTRIBUTE_CHECKS: Record<string, (p: Product) => boolean> = {
  material: (p) => !!p.material,
  cor: (p) => !!p.color,
  color: (p) => !!p.color,
  pantone: (p) => !!p.pantone,
  categoria: (p) => !!p.category,
  category: (p) => !!p.category,
  descricao: (p) => !!p.specification,
  descrição: (p) => !!p.specification,
  description: (p) => !!p.specification,
  especificacao: (p) => !!p.specification,
  especificação: (p) => !!p.specification,
  sku: (p) => !!p.sku,
  fornecedor: (p) => !!p.supplierId,
  supplier: (p) => !!p.supplierId,
  moq: (p) => p.moq !== null,
  preco: (p) => p.price !== null,
  preço: (p) => p.price !== null,
  price: (p) => p.price !== null,
  dimensoes: (p) =>
    p.lengthCm !== null && p.widthCm !== null && p.heightCm !== null,
  dimensões: (p) =>
    p.lengthCm !== null && p.widthCm !== null && p.heightCm !== null,
  dimensions: (p) =>
    p.lengthCm !== null && p.widthCm !== null && p.heightCm !== null,
  peso: (p) => p.netWeightKg !== null,
  weight: (p) => p.netWeightKg !== null,
  cbm: (p) =>
    p.cbm !== null ||
    (p.boxLengthCm !== null && p.boxWidthCm !== null && p.boxHeightCm !== null),
  ncm: (p) => !!p.ncm,
  foto: (p) => !!p.primaryPhotoDocumentId,
  photo: (p) => !!p.primaryPhotoDocumentId,
};

export interface AttributeCheck {
  required: string[];
  present: string[];
  missing: string[];
  /** Exigidos pela linha mas sem coluna correspondente: conferência humana. */
  manual: string[];
}

export function checkRequiredAttributes(
  product: Product,
  line: Pick<ProductLine, "prompts"> | null,
): AttributeCheck {
  const required = (line?.prompts?.requiredAttributes ?? [])
    .map((a) => a.trim())
    .filter(Boolean);
  const present: string[] = [];
  const missing: string[] = [];
  const manual: string[] = [];
  for (const attr of required) {
    const check = ATTRIBUTE_CHECKS[attr.toLowerCase()];
    if (!check) manual.push(attr);
    else if (check(product)) present.push(attr);
    else missing.push(attr);
  }
  return { required, present, missing, manual };
}

/** Texto (uma regra ou atributo por linha) → lista limpa, sem duplicatas. */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\n;,]/)
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
