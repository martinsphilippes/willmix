/*
 * Tela do produto (/app/products/[id]): o cadastro e a ficha de compra mestre
 * guardavam o mesmo dado em duas caixas (um copiava para o outro ao salvar).
 * Decisão do dono (11/11/2026): caixa repetida fica só no CADASTRO. A ficha
 * mestre continua, na mesma tela, só com o que não existe no cadastro.
 *
 * Os dados continuam gravados nos dois lugares (o cadastro espelha na ficha
 * mestre ao salvar; pedidos e cotações nascem dela): some só a caixa
 * repetida. A ficha do pedido e a da cotação não mudam.
 */

/** Campos da ficha mestre digitados só no cadastro do produto. */
export const REGISTRATION_SHEET_FIELDS = [
  // Fornecedor e negociação
  "supplierName",
  "factoryItemCode",
  "currency",
  "price",
  "moq",
  // Produto
  "netWeightPcKg",
  "grossWeightPcKg",
  "colorPantones",
  "colorAssortment",
  "material",
  // Embalagem
  "masterCartonQty",
  "innerQty",
  "heightCm",
  "widthCm",
  "lengthCm",
  "cbmPerCarton",
  // NCM: só pelo quadro "Classificação fiscal" (incluir e validar)
  "ncm",
  // Observações (um texto só, com a caixa "Vai para o e-commerce")
  "ecommerceDescription",
  "notes",
] as const;

export type RegistrationSheetField = (typeof REGISTRATION_SHEET_FIELDS)[number];

export const isRegistrationField = (key: string): boolean =>
  (REGISTRATION_SHEET_FIELDS as readonly string[]).includes(key);

const clean = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Texto único das observações do produto. Depois da primeira gravação pelo
 * cadastro unificado (`notesToEcommerce` é verdadeiro ou falso), vale o texto
 * do produto. Antes dela, junta o que existia nos três lugares (observações
 * do cadastro, observações da ficha mestre e descrição para e-commerce), sem
 * repetir e sem perder nada.
 */
export function unifiedProductNotes(
  product: { notes?: string | null; notesToEcommerce?: boolean | null },
  master:
    | { notes?: string | null; ecommerceDescription?: string | null }
    | null
    | undefined,
): { text: string; toEcommerce: boolean } {
  const own = clean(product.notes);
  if (typeof product.notesToEcommerce === "boolean")
    return { text: own, toEcommerce: product.notesToEcommerce };
  const parts: string[] = [];
  for (const raw of [
    own,
    clean(master?.notes),
    clean(master?.ecommerceDescription),
  ])
    if (raw && !parts.some((p) => p.includes(raw))) parts.push(raw);
  return {
    text: parts.join("\n\n"),
    // Só havia a descrição para e-commerce: continua indo para o e-commerce.
    toEcommerce:
      !own && !clean(master?.notes) && !!clean(master?.ecommerceDescription),
  };
}

/**
 * Como o texto único fica na ficha mestre (de onde pedidos e cotações
 * nascem): marcado, é a descrição para e-commerce; desmarcado, é observação.
 */
export function sheetNotesFromProduct(product: {
  notes?: string | null;
  notesToEcommerce?: boolean | null;
}): { ecommerceDescription: string | null; notes: string | null } | null {
  // Produto ainda não gravado pelo cadastro unificado: a ficha fica como está.
  if (typeof product.notesToEcommerce !== "boolean") return null;
  const text = clean(product.notes);
  return product.notesToEcommerce
    ? { ecommerceDescription: text ? text.slice(0, 4000) : null, notes: null }
    : { ecommerceDescription: null, notes: text ? text.slice(0, 2000) : null };
}
