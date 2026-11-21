import type {
  SupplierSheetBaseline,
  SupplierSheetData,
  SupplierSheetField,
} from "@/lib/db/schema";

/*
 * Ficha técnica do par produto × fornecedor na cotação de compra (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Ficha técnica na cotação"). Regras
 * puras, as mesmas na tela (o que falta, os avisos, o que mudou) e no
 * servidor (que confere de novo antes de gravar).
 *
 * - Peças por caixa master, medidas da caixa master ou o CBM dela, peso
 *   líquido por peça, peso bruto da caixa master (ou "Sem peso"), material
 *   do catálogo e código do item na fábrica (ou "Sem código").
 * - O inner não é do fornecedor (dono, 21/11/2026): é exigência do cliente,
 *   vem da cotação travada e só entra nos avisos (inner que não fecha a
 *   master dele).
 * - "Sem peso" não grava zero: o peso fica nulo e a marca diz que ele não
 *   sabe; o número digitado continua no rascunho.
 * - O CBM das medidas vai sem arredondar (como na ficha e nos totais).
 */

export const SUPPLIER_SHEET_FIELDS: readonly SupplierSheetField[] = [
  "masterBoxQty",
  "innerBoxQty",
  "boxLengthCm",
  "boxWidthCm",
  "boxHeightCm",
  "cbm",
  "netWeightKg",
  "grossWeightBoxKg",
  "material",
  "factoryItemCode",
];

/** O que falta, como a tela mostra ("box" = medidas ou CBM da caixa master). */
export const SHEET_REQUIREMENTS = [
  "masterBoxQty",
  "box",
  "netWeightKg",
  "grossWeightBoxKg",
  "material",
  "factoryItemCode",
] as const;
export type SheetRequirement = (typeof SHEET_REQUIREMENTS)[number];

/** O formulário de um produto, como veio (números já lidos; vazio = nulo). */
export interface SupplierSheetDraft {
  masterBoxQty: number | null;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  cbm: number | null;
  netWeightKg: number | null;
  /** O número digitado; com "Sem peso" fica guardado, sem valer. */
  grossWeightBoxKg: number | null;
  /** "Sem peso": ele não sabe o peso bruto. */
  grossUnknown: boolean;
  /** Materiais escolhidos no catálogo (ids, na ordem da escolha). */
  materialIds: string[];
  /**
   * Material por extenso, sem catálogo: só a ficha de compra (o campo dela é
   * texto). A cotação nunca manda texto.
   */
  materialText?: string;
  factoryItemCode: string;
  noFactoryCode: boolean;
}

/** Os nomes de um material do catálogo (o português vai para a ficha). */
export type MaterialNames = { namePt: string };

export interface SheetTolerances {
  /** Peso (%), a mesma tolerância da inspeção. */
  weightPercent: number;
  /** Medidas da caixa (%). */
  dimensionPercent: number;
  /** CBM (%). */
  cbmPercent: number;
}

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;
const wholePositive = (n: number | null | undefined): n is number =>
  positive(n) && Number.isInteger(n);

/** m³ da caixa pelas medidas em cm, sem arredondar; nulo sem as três. */
export function dimsCbm(
  lengthCm: number | null | undefined,
  widthCm: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!positive(lengthCm) || !positive(widthCm) || !positive(heightCm))
    return null;
  return (lengthCm * widthCm * heightCm) / 1_000_000;
}

const hasDims = (
  d: Pick<SupplierSheetDraft, "boxLengthCm" | "boxWidthCm" | "boxHeightCm">,
) =>
  positive(d.boxLengthCm) && positive(d.boxWidthCm) && positive(d.boxHeightCm);

/**
 * Os materiais escolhidos que existem no catálogo dado (sem catálogo, todos
 * os escolhidos), sem repetir.
 */
function knownMaterialIds(
  draft: Pick<SupplierSheetDraft, "materialIds">,
  catalog?: ReadonlyMap<string, MaterialNames>,
): string[] {
  const out: string[] = [];
  for (const id of draft.materialIds)
    if ((!catalog || catalog.has(id)) && !out.includes(id)) out.push(id);
  return out;
}

/**
 * O que falta para enviar a ficha de um produto. Com o catálogo, só valem os
 * materiais dele (a tela e o servidor passam o catálogo ativo).
 */
export function missingSheet(
  draft: SupplierSheetDraft,
  catalog?: ReadonlyMap<string, MaterialNames>,
): SheetRequirement[] {
  const out: SheetRequirement[] = [];
  if (!wholePositive(draft.masterBoxQty)) out.push("masterBoxQty");
  if (!hasDims(draft) && !positive(draft.cbm)) out.push("box");
  if (!positive(draft.netWeightKg)) out.push("netWeightKg");
  if (!draft.grossUnknown && !positive(draft.grossWeightBoxKg))
    out.push("grossWeightBoxKg");
  if (
    !knownMaterialIds(draft, catalog).length &&
    !(draft.materialText ?? "").trim()
  )
    out.push("material");
  if (!draft.noFactoryCode && !draft.factoryItemCode.trim())
    out.push("factoryItemCode");
  return out;
}

/**
 * A ficha completa, pronta para gravar; nula enquanto falta algo. O material
 * por extenso sai dos nomes em português do catálogo ("Plástico / Papel");
 * sem materiais do catálogo, do texto da ficha de compra.
 */
export function normalizeSheet(
  draft: SupplierSheetDraft,
  catalog?: ReadonlyMap<string, MaterialNames>,
): SupplierSheetData | null {
  if (missingSheet(draft, catalog).length) return null;
  const dims = hasDims(draft);
  const cbm = positive(draft.cbm)
    ? draft.cbm
    : dimsCbm(draft.boxLengthCm, draft.boxWidthCm, draft.boxHeightCm)!;
  const ids = knownMaterialIds(draft, catalog);
  const names = catalog
    ? ids.map((id) => catalog.get(id)!.namePt).join(" / ")
    : "";
  return {
    masterBoxQty: draft.masterBoxQty!,
    innerBoxQty: null,
    boxLengthCm: dims ? draft.boxLengthCm : null,
    boxWidthCm: dims ? draft.boxWidthCm : null,
    boxHeightCm: dims ? draft.boxHeightCm : null,
    cbm,
    netWeightKg: draft.netWeightKg!,
    grossWeightBoxKg: draft.grossUnknown ? null : draft.grossWeightBoxKg!,
    grossWeightUnknown: draft.grossUnknown,
    material: (ids.length && names ? names : (draft.materialText ?? ""))
      .trim()
      .slice(0, 200),
    materialIds: ids.length ? ids : null,
    factoryItemCode: draft.noFactoryCode
      ? null
      : draft.factoryItemCode.trim().slice(0, 80),
  };
}

export type SheetWarning =
  | { key: "cbm_dims_mismatch"; dimsCbm: number; cbm: number }
  | { key: "inner_above_master" }
  | { key: "inner_not_closing" }
  | { key: "gross_below_net"; netBoxKg: number };

/**
 * Avisos que não impedem o envio (ele confirma ou corrige): medidas e CBM
 * que não batem, o inner exigido pelo cliente maior que a master dele ou que
 * não fecha a master (a regra da Estratégia) e caixa mais leve que as peças
 * dentro dela (só com o peso informado).
 */
export function sheetWarnings(
  draft: SupplierSheetDraft,
  tol: Pick<SheetTolerances, "cbmPercent">,
  /** Peças por inner exigidas pelo cliente (nulo = sem exigência). */
  innerRequired: number | null = null,
): SheetWarning[] {
  const out: SheetWarning[] = [];
  const fromDims = dimsCbm(
    draft.boxLengthCm,
    draft.boxWidthCm,
    draft.boxHeightCm,
  );
  if (fromDims !== null && positive(draft.cbm)) {
    const diff = (Math.abs(fromDims - draft.cbm) / draft.cbm) * 100;
    if (diff > tol.cbmPercent)
      out.push({ key: "cbm_dims_mismatch", dimsCbm: fromDims, cbm: draft.cbm });
  }
  const master = draft.masterBoxQty;
  const inner = innerRequired;
  if (wholePositive(master) && wholePositive(inner)) {
    if (inner > master) out.push({ key: "inner_above_master" });
    else if (master % inner !== 0) out.push({ key: "inner_not_closing" });
  }
  if (
    !draft.grossUnknown &&
    wholePositive(master) &&
    positive(draft.netWeightKg) &&
    positive(draft.grossWeightBoxKg)
  ) {
    const netBoxKg = draft.netWeightKg * master;
    if (draft.grossWeightBoxKg < netBoxKg)
      out.push({ key: "gross_below_net", netBoxKg });
  }
  return out;
}

/** Diferença relativa (%) de `value` em relação a `base`. */
export function percentDiff(value: number, base: number): number {
  if (!base) return value ? Infinity : 0;
  return (Math.abs(value - base) / Math.abs(base)) * 100;
}

const sortedDims = (d: {
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
}) =>
  positive(d.boxLengthCm) && positive(d.boxWidthCm) && positive(d.boxHeightCm)
    ? [d.boxLengthCm, d.boxWidthCm, d.boxHeightCm].sort((a, b) => a - b)
    : null;

/** Diferença pequena demais para ser correção (arredondamento do que mostramos). */
const SAME_PERCENT = 0.5;

const sameText = (a: string | null, b: string | null) =>
  (a ?? "").trim().toLocaleLowerCase() === (b ?? "").trim().toLocaleLowerCase();

/**
 * O que ele mudou em relação ao que tínhamos (só onde tínhamos o dado; o
 * campo que estava vazio e ele preencheu não é correção). Medidas em outra
 * ordem (comprimento e largura trocados) são a mesma caixa.
 */
export function changedSheetFields(
  data: SupplierSheetData,
  baseline: SupplierSheetBaseline | null,
): SupplierSheetField[] {
  if (!baseline) return [];
  const out: SupplierSheetField[] = [];
  if (
    baseline.masterBoxQty !== null &&
    data.masterBoxQty !== baseline.masterBoxQty
  )
    out.push("masterBoxQty");
  // Inner: só nas fichas antigas, em que ele informava (nulo = não perguntado).
  if (
    baseline.innerBoxQty !== null &&
    data.innerBoxQty !== null &&
    data.innerBoxQty !== baseline.innerBoxQty
  )
    out.push("innerBoxQty");
  const ours = sortedDims(baseline);
  const theirs = sortedDims(data);
  if (
    ours &&
    theirs &&
    ours.some((v, i) => percentDiff(theirs[i], v) > SAME_PERCENT)
  )
    out.push("boxLengthCm", "boxWidthCm", "boxHeightCm");
  if (
    baseline.cbm !== null &&
    percentDiff(data.cbm, baseline.cbm) > SAME_PERCENT
  )
    out.push("cbm");
  if (
    baseline.netWeightKg !== null &&
    percentDiff(data.netWeightKg, baseline.netWeightKg) > SAME_PERCENT
  )
    out.push("netWeightKg");
  // "Sem peso" com o nosso peso: ele não confirma o que temos.
  if (
    baseline.grossWeightBoxKg !== null &&
    (data.grossWeightBoxKg === null ||
      percentDiff(data.grossWeightBoxKg, baseline.grossWeightBoxKg) >
        SAME_PERCENT)
  )
    out.push("grossWeightBoxKg");
  if (baseline.material !== null && !sameText(data.material, baseline.material))
    out.push("material");
  if (
    baseline.factoryItemCode !== null &&
    !sameText(data.factoryItemCode, baseline.factoryItemCode)
  )
    out.push("factoryItemCode");
  return out;
}

/**
 * O que mudou enquanto ele digita (a ficha ainda incompleta): a mesma regra
 * de `changedSheetFields`, campo a campo, só onde os dois valores existem.
 */
export function draftChangedFields(
  draft: SupplierSheetDraft,
  baseline: SupplierSheetBaseline | null,
  /** Os materiais escolhidos por extenso (em português), para comparar. */
  materialText = "",
): SupplierSheetField[] {
  if (!baseline) return [];
  const out: SupplierSheetField[] = [];
  const num = (field: SupplierSheetField, value: number | null) => {
    const base = baseline[field];
    if (typeof base !== "number" || !positive(value)) return;
    const whole = field === "masterBoxQty";
    if (whole ? value !== base : percentDiff(value, base) > SAME_PERCENT)
      out.push(field);
  };
  num("masterBoxQty", draft.masterBoxQty);
  const ours = sortedDims(baseline);
  const theirs = sortedDims(draft);
  if (
    ours &&
    theirs &&
    ours.some((v, i) => percentDiff(theirs[i], v) > SAME_PERCENT)
  )
    out.push("boxLengthCm", "boxWidthCm", "boxHeightCm");
  const cbm = positive(draft.cbm)
    ? draft.cbm
    : dimsCbm(draft.boxLengthCm, draft.boxWidthCm, draft.boxHeightCm);
  num("cbm", cbm);
  num("netWeightKg", draft.netWeightKg);
  if (draft.grossUnknown) {
    if (baseline.grossWeightBoxKg !== null) out.push("grossWeightBoxKg");
  } else num("grossWeightBoxKg", draft.grossWeightBoxKg);
  if (
    baseline.material !== null &&
    materialText.trim() &&
    !sameText(materialText, baseline.material)
  )
    out.push("material");
  if (baseline.factoryItemCode !== null) {
    if (draft.noFactoryCode) out.push("factoryItemCode");
    else if (
      draft.factoryItemCode.trim() &&
      !sameText(draft.factoryItemCode, baseline.factoryItemCode)
    )
      out.push("factoryItemCode");
  }
  return out;
}

export type CatalogAlert =
  | { key: "other_box"; theirs: number; ours: number }
  | { key: "weight"; percent: number; theirs: number; ours: number }
  | { key: "cbm"; percent: number; theirs: number; ours: number }
  | { key: "dims"; percent: number };

/**
 * Comparativo da Wellmix: onde a ficha do fornecedor foge do nosso cadastro
 * além da tolerância da inspeção (peso, medidas e CBM das Configurações).
 * Outra quantidade por caixa é sempre aviso (a cubagem muda).
 */
export function catalogAlerts(
  data: SupplierSheetData,
  ours: SupplierSheetBaseline | null,
  tol: SheetTolerances,
): CatalogAlert[] {
  if (!ours) return [];
  const out: CatalogAlert[] = [];
  if (ours.masterBoxQty !== null && data.masterBoxQty !== ours.masterBoxQty)
    out.push({
      key: "other_box",
      theirs: data.masterBoxQty,
      ours: ours.masterBoxQty,
    });
  if (ours.netWeightKg !== null) {
    const percent = percentDiff(data.netWeightKg, ours.netWeightKg);
    if (percent > tol.weightPercent)
      out.push({
        key: "weight",
        percent,
        theirs: data.netWeightKg,
        ours: ours.netWeightKg,
      });
  }
  // Com a mesma caixa: o CBM e as medidas comparam a mesma coisa.
  if (ours.masterBoxQty === null || data.masterBoxQty === ours.masterBoxQty) {
    if (ours.cbm !== null) {
      const percent = percentDiff(data.cbm, ours.cbm);
      if (percent > tol.cbmPercent)
        out.push({ key: "cbm", percent, theirs: data.cbm, ours: ours.cbm });
    }
    const a = sortedDims(data);
    const b = sortedDims(ours);
    if (a && b) {
      const percent = Math.max(...a.map((v, i) => percentDiff(v, b[i])));
      if (percent > tol.dimensionPercent) out.push({ key: "dims", percent });
    }
  }
  return out;
}

/** O que tínhamos, vazio. */
export const EMPTY_BASELINE: SupplierSheetBaseline = {
  masterBoxQty: null,
  innerBoxQty: null,
  boxLengthCm: null,
  boxWidthCm: null,
  boxHeightCm: null,
  cbm: null,
  netWeightKg: null,
  grossWeightBoxKg: null,
  material: null,
  factoryItemCode: null,
};

const numOrNull = (n: number | null | undefined, allowZero = false) =>
  typeof n === "number" && Number.isFinite(n) && (allowZero ? n >= 0 : n > 0)
    ? n
    : null;
const textOrNull = (s: string | null | undefined) => {
  const v = (s ?? "").trim();
  return v ? v : null;
};

/** O que tínhamos de uma ficha (de compra ou mestre), nos nomes da ficha de compra. */
export function baselineFromSheet(s: {
  masterCartonQty?: number | null;
  innerQty?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  cbmPerCarton?: number | null;
  netWeightPcKg?: number | null;
  grossWeightPcKg?: number | null;
  material?: string | null;
  factoryItemCode?: string | null;
}): SupplierSheetBaseline {
  const master = numOrNull(s.masterCartonQty);
  const gross = numOrNull(s.grossWeightPcKg);
  const l = numOrNull(s.lengthCm);
  const w = numOrNull(s.widthCm);
  const h = numOrNull(s.heightCm);
  return {
    masterBoxQty: master,
    innerBoxQty: numOrNull(s.innerQty, true),
    boxLengthCm: l,
    boxWidthCm: w,
    boxHeightCm: h,
    cbm: numOrNull(s.cbmPerCarton) ?? dimsCbm(l, w, h),
    netWeightKg: numOrNull(s.netWeightPcKg),
    // A ficha guarda o bruto por peça; a caixa é a conta (peça × peças).
    grossWeightBoxKg: master !== null && gross !== null ? gross * master : null,
    material: textOrNull(s.material),
    factoryItemCode: textOrNull(s.factoryItemCode),
  };
}

/** O que tínhamos no cadastro do produto (o código da fábrica vem à parte). */
export function baselineFromProduct(p: {
  masterBoxQty: number | null;
  innerBoxQty: number | null;
  boxLengthCm: number | null;
  boxWidthCm: number | null;
  boxHeightCm: number | null;
  cbm: number | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  material: string | null;
}): SupplierSheetBaseline {
  return baselineFromSheet({
    masterCartonQty: p.masterBoxQty,
    innerQty: p.innerBoxQty,
    lengthCm: p.boxLengthCm,
    widthCm: p.boxWidthCm,
    heightCm: p.boxHeightCm,
    cbmPerCarton: p.cbm,
    netWeightPcKg: p.netWeightKg,
    grossWeightPcKg: p.grossWeightKg,
    material: p.material,
    factoryItemCode: null,
  });
}

/**
 * Junta as fontes na ordem (a primeira manda). A caixa vem inteira de uma
 * fonte só: peças por master da primeira que tem; inner, medidas, CBM e peso
 * da caixa só de fontes com a mesma caixa (ou sem a quantidade informada),
 * a regra "CBM só da mesma caixa contada". As três medidas vêm juntas.
 */
export function mergeBaselines(
  ...list: Array<SupplierSheetBaseline | null | undefined>
): SupplierSheetBaseline {
  const sources = list.filter((b): b is SupplierSheetBaseline => !!b);
  const out: SupplierSheetBaseline = { ...EMPTY_BASELINE };
  for (const s of sources) {
    if (out.netWeightKg === null) out.netWeightKg = s.netWeightKg;
    if (out.material === null) out.material = s.material;
    if (out.factoryItemCode === null) out.factoryItemCode = s.factoryItemCode;
  }
  const box = sources.find((s) => s.masterBoxQty !== null);
  out.masterBoxQty = box?.masterBoxQty ?? null;
  for (const s of sources) {
    if (box && s.masterBoxQty !== null && s.masterBoxQty !== box.masterBoxQty)
      continue;
    if (
      out.boxLengthCm === null &&
      s.boxLengthCm !== null &&
      s.boxWidthCm !== null &&
      s.boxHeightCm !== null
    ) {
      out.boxLengthCm = s.boxLengthCm;
      out.boxWidthCm = s.boxWidthCm;
      out.boxHeightCm = s.boxHeightCm;
    }
    if (out.innerBoxQty === null) out.innerBoxQty = s.innerBoxQty;
    if (out.cbm === null) out.cbm = s.cbm;
    if (out.grossWeightBoxKg === null)
      out.grossWeightBoxKg = s.grossWeightBoxKg;
  }
  return out;
}

/**
 * O rascunho do formulário a partir do que tínhamos (quem já vendeu). Os
 * materiais: os do catálogo que o nosso texto cita (quem chama acha).
 */
export function draftFromBaseline(
  b: SupplierSheetBaseline | null,
  materialIds: readonly string[] = [],
): SupplierSheetDraft {
  return {
    masterBoxQty: b?.masterBoxQty ?? null,
    boxLengthCm: b?.boxLengthCm ?? null,
    boxWidthCm: b?.boxWidthCm ?? null,
    boxHeightCm: b?.boxHeightCm ?? null,
    // Medidas e CBM do cadastro vêm os dois: se não batem, o aviso aparece
    // e ele acerta um deles (não escondemos a diferença do nosso cadastro).
    cbm: b?.cbm ?? null,
    netWeightKg: b?.netWeightKg ?? null,
    grossWeightBoxKg: b?.grossWeightBoxKg ?? null,
    grossUnknown: false,
    materialIds: [...materialIds],
    factoryItemCode: b?.factoryItemCode ?? "",
    noFactoryCode: false,
  };
}

/** O rascunho a partir da ficha que ele já mandou nesta cotação (para corrigir). */
export function draftFromData(d: SupplierSheetData): SupplierSheetDraft {
  // CBM igual ao das medidas = ele não digitou o CBM (saiu das medidas).
  const fromDims = dimsCbm(d.boxLengthCm, d.boxWidthCm, d.boxHeightCm);
  const dims = fromDims !== null && percentDiff(d.cbm, fromDims) < 1e-6;
  return {
    masterBoxQty: d.masterBoxQty,
    boxLengthCm: d.boxLengthCm,
    boxWidthCm: d.boxWidthCm,
    boxHeightCm: d.boxHeightCm,
    cbm: dims ? null : d.cbm,
    netWeightKg: d.netWeightKg,
    grossWeightBoxKg: d.grossWeightBoxKg,
    grossUnknown: !!d.grossWeightUnknown,
    materialIds: d.materialIds ? [...d.materialIds] : [],
    // Ficha antiga, de texto livre: o texto aparece para ele escolher no
    // catálogo (não vale sozinho na cotação).
    ...(d.materialIds?.length ? {} : { materialText: d.material }),
    factoryItemCode: d.factoryItemCode ?? "",
    noFactoryCode: d.factoryItemCode === null,
  };
}

/**
 * Caixas master e m³ da quantidade pedida pela caixa dele: com programação,
 * uma conta por programação (caixas inteiras para cima), como a ficha.
 */
export function boxesForSheet(
  rounds: readonly number[],
  data: Pick<SupplierSheetData, "masterBoxQty" | "cbm">,
): { boxes: number; cbm: number } | null {
  if (!wholePositive(data.masterBoxQty) || !rounds.length) return null;
  const boxes = rounds.reduce(
    (sum, q) => sum + (q > 0 ? Math.ceil(q / data.masterBoxQty) : 0),
    0,
  );
  return { boxes, cbm: boxes * data.cbm };
}
