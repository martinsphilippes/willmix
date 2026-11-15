/*
 * Especificação gravada na solicitação, lida para a ficha completa
 * (dono, 15/11/2026; docs/REQUEST_SHEET.md). O texto é o registro principal
 * do produto pedido ("Composição: …", "Dimensões (A x L x P)", "Lança
 * Bolhas: 14,5cm x 3,5cm x 2,5cm"): cada linha "Título: valor" vira um
 * campo; as medidas viram eixos com unidade; peso líquido, peso bruto e a
 * caixa master (peças, caixa interna, medidas e CBM) viram números, para a
 * ficha usar o que a solicitação gravou antes da ficha atual do produto.
 *
 * Sem banco nem servidor: puro e testado à parte. Nada é inventado: medida
 * sem eixo declarado fica sem eixo; número sem unidade fica sem unidade.
 */

export type Axis =
  | "height"
  | "width"
  | "depth"
  | "length"
  | "diameter"
  | "thickness";

export interface AxisValue {
  /** Nulo: a especificação não diz qual eixo é. */
  axis: Axis | null;
  value: number;
  /** "cm", "mm" ou "m"; nulo: a especificação não diz. */
  unit: string | null;
}

export interface SpecMeasure {
  /** Título da linha ("Lança Bolhas", "Dimensões"), sem a unidade entre parênteses. */
  label: string;
  values: AxisValue[];
}

export interface SpecLine {
  /** Nulo: linha solta (título do produto, "3 Sortimentos de cores"). */
  label: string | null;
  value: string;
}

export interface SpecWeight {
  value: number;
  unit: "kg" | "g";
}

export interface ParsedSpec {
  /** Linhas que não viraram número, na ordem do texto. */
  lines: SpecLine[];
  /** Medidas da peça, com os eixos quando o texto os declara. */
  measures: SpecMeasure[];
  netWeight: SpecWeight | null;
  grossWeight: SpecWeight | null;
  /** Peças por caixa master. */
  perBox: number | null;
  /** Peças por caixa (embalagem) interna. */
  innerQty: number | null;
  /** Medidas da caixa master. */
  boxDims: SpecMeasure | null;
  /** m³ por caixa master. */
  cbmPerBox: number | null;
}

/** Sem acento, minúsculas, espaços simples (para comparar títulos). */
export function normLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Título sem o que vem entre parênteses ("Peso líquido (kg)" → "peso liquido"). */
const bareLabel = (label: string) =>
  normLabel(label.replace(/\([^)]*\)/g, " "));

/* Letras dos eixos. Português: A altura, L largura, P profundidade, C
   comprimento, D/Ø diâmetro, E espessura. Inglês (quando aparece W ou H):
   L length, W width, H height, D depth, T thickness. Chinês: 长 宽 高 深 厚 直径. */
const PT_AXES: Record<string, Axis> = {
  a: "height",
  l: "width",
  p: "depth",
  c: "length",
  d: "diameter",
  ø: "diameter",
  e: "thickness",
};
const EN_AXES: Record<string, Axis> = {
  l: "length",
  w: "width",
  h: "height",
  d: "depth",
  t: "thickness",
};
const ZH_AXES: Record<string, Axis> = {
  长: "length",
  宽: "width",
  高: "height",
  深: "depth",
  厚: "thickness",
  直径: "diameter",
  径: "diameter",
};

const SEPARATOR = /\s*[x×X*]\s*/;

/** Eixos declarados entre parênteses: "(A x L x P)", "(C × L × A)", "(L × W × H)". */
export function axesIn(text: string): Axis[] | null {
  for (const m of text.matchAll(/\(([^()]*)\)/g)) {
    const tokens = m[1]
      .split(SEPARATOR)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length < 2) continue;
    const dict = tokens.some((tk) => tk in ZH_AXES)
      ? ZH_AXES
      : tokens.some((tk) => tk === "w" || tk === "h")
        ? EN_AXES
        : PT_AXES;
    const axes = tokens.map((tk) => dict[tk] ?? null);
    if (axes.every((a): a is Axis => a !== null)) return axes;
  }
  return null;
}

/** Título que é o nome de um eixo ("Altura", "Diâmetro", "Height", "直径"). */
const AXIS_WORDS: Record<string, Axis> = {
  altura: "height",
  largura: "width",
  profundidade: "depth",
  comprimento: "length",
  diametro: "diameter",
  espessura: "thickness",
  height: "height",
  width: "width",
  depth: "depth",
  length: "length",
  diameter: "diameter",
  thickness: "thickness",
  高: "height",
  高度: "height",
  宽: "width",
  宽度: "width",
  深: "depth",
  深度: "depth",
  长: "length",
  长度: "length",
  直径: "diameter",
  厚: "thickness",
  厚度: "thickness",
};

/** Número escrito com vírgula ou ponto decimal ("14,5", "35.1", "1.234,5"). */
export function decimalOf(text: string): number | null {
  let s = text.trim();
  if (!/^\d+(?:[.,]\d+)*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Os dois: o último é o decimal; o outro, milhar.
    s =
      lastComma > lastDot
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Quantidade inteira ("1.000", "1,000", "192"): pontos e vírgulas são milhar. */
function countOf(text: string): number | null {
  const s = text.trim();
  if (!/^\d{1,3}(?:[.,\s]\d{3})*$|^\d+$/.test(s)) return null;
  const n = Number(s.replace(/[.,\s]/g, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Unidade de medida entre parênteses no título ("Dimensões do produto (cm)"). */
const unitIn = (label: string) =>
  /\((mm|cm|m)\)/i.exec(label)?.[1].toLowerCase() ?? null;

/**
 * Os números de uma medida ("14,5cm x 3,5cm x 2,5cm", "13 × 19 × 15 cm (C × L
 * × A)", "20 × 11 × 35.1"): 1 a 4 partes, cada uma número com unidade
 * opcional. A unidade do fim vale para as partes sem unidade. Nulo: não é
 * uma medida.
 */
function measureNumbers(
  value: string,
): { value: number; unit: string | null }[] | null {
  const core = value.replace(/\([^()]*\)\s*$/, "").trim();
  if (!core) return null;
  const parts = core.split(SEPARATOR);
  if (parts.length > 4) return null;
  const out: { value: number; unit: string | null }[] = [];
  for (const part of parts) {
    const m = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i.exec(part.trim());
    if (!m) return null;
    const n = decimalOf(m[1]);
    if (n === null || n <= 0) return null;
    out.push({ value: n, unit: m[2]?.toLowerCase() ?? null });
  }
  const last = out[out.length - 1].unit;
  return out.map((o) => ({ ...o, unit: o.unit ?? last }));
}

const NET_LABEL = /peso liquido|net weight|净重/;
const GROSS_LABEL = /peso bruto|gross weight|毛重/;
const WEIGHT_LABEL = /^(peso|weight|重量|单件重量)( por unidade| per unit)?$/;
const CARTON_LABEL = /^(caixa master|master carton|外箱)$/;
const PER_BOX_LABEL =
  /(unidades|pecas|pieces|units) (por|per) (caixa master|master carton)|每外箱装量/;
const INNER_LABEL =
  /(unidades|pecas|pieces|units) (por|per) (inner box|caixa interna|embalagem interna)|每内盒装量/;

function weightOf(text: string, labelUnit: string | null): SpecWeight | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g)?\b/i.exec(text);
  if (!m) return null;
  const n = decimalOf(m[1]);
  if (n === null || n <= 0) return null;
  const unit = (m[2]?.toLowerCase() ?? labelUnit ?? null) as "kg" | "g" | null;
  return unit ? { value: n, unit } : null;
}

/**
 * Lê a especificação gravada. `portalOrderLabels`: títulos que o portal
 * escreve com as medidas na ordem comprimento × largura × altura sem dizer
 * os eixos (o "Dimensões do produto (cm)" da Nova solicitação, montado das
 * colunas do cadastro), já normalizados com `normLabel`.
 */
export function parseRequestSpec(
  text: string | null | undefined,
  portalOrderLabels: readonly string[] = [],
): ParsedSpec {
  const out: ParsedSpec = {
    lines: [],
    measures: [],
    netWeight: null,
    grossWeight: null,
    perBox: null,
    innerQty: null,
    boxDims: null,
    cbmPerBox: null,
  };
  if (!text) return out;
  // Eixos de um cabeçalho ("Dimensões (A x L x P)") valem até a linha em branco.
  let headerAxes: Axis[] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      headerAxes = null;
      continue;
    }
    const m = /^([^:]{1,60}):\s*(.*)$/.exec(line);
    const label = m ? m[1].trim() : null;
    const value = m ? m[2].trim() : line;
    // Cabeçalho de medidas: os eixos entre parênteses e nenhum número
    // ("Dimensões (A x L x P)", "Medidas: (C x L x A)").
    const header =
      !m || !value || /^\([^()]*\)$/.test(value) ? axesIn(line) : null;
    if (header) {
      headerAxes = header;
      continue;
    }
    if (m && !value) {
      out.lines.push({ label: null, value: line });
      continue;
    }
    if (label) {
      const bare = bareLabel(label);
      const labelUnit = /\((kg|g)\)/i.exec(label)?.[1].toLowerCase() ?? null;
      // Pesos: "Peso líquido (kg): 0.3728", "Peso por unidade: 0,011 kg líquido · 0,054 kg bruto".
      if (NET_LABEL.test(bare) || GROSS_LABEL.test(bare)) {
        const w = weightOf(value, labelUnit);
        if (w) {
          if (NET_LABEL.test(bare)) out.netWeight = w;
          else out.grossWeight = w;
          continue;
        }
      }
      if (WEIGHT_LABEL.test(bare)) {
        const net = /(\d+(?:[.,]\d+)?)\s*(kg|g)\s*(liquido|líquido|net|净重)/i.exec(
          value,
        );
        const gross = /(\d+(?:[.,]\d+)?)\s*(kg|g)\s*(bruto|gross|毛重)/i.exec(
          value,
        );
        if (net || gross) {
          if (net) out.netWeight = weightOf(`${net[1]} ${net[2]}`, null);
          if (gross) out.grossWeight = weightOf(`${gross[1]} ${gross[2]}`, null);
          continue;
        }
      }
      // Caixa master do portal: "48 peças · 4 por caixa interna · 52 × 34 × 68 cm · 0,1202 m³".
      if (CARTON_LABEL.test(bare)) {
        let used = false;
        for (const part of value.split(/\s*·\s*/)) {
          const pcs = /^([\d.,\s]+)\s*(pecas?|peças?|pieces?|件)$/i.exec(part);
          const inner =
            /([\d.,]+)\s*(por caixa interna|per inner box)/i.exec(part) ??
            /每内盒\s*([\d.,]+)\s*件/.exec(part);
          const cbm = /(\d+(?:[.,]\d+)?)\s*m³/i.exec(part);
          const dims = measureNumbers(part);
          if (pcs && countOf(pcs[1])) {
            out.perBox = countOf(pcs[1]);
            used = true;
          } else if (inner && countOf(inner[1])) {
            out.innerQty = countOf(inner[1]);
            used = true;
          } else if (cbm && decimalOf(cbm[1])) {
            out.cbmPerBox = decimalOf(cbm[1]);
            used = true;
          } else if (dims && dims.length === 3) {
            // A ficha do portal escreve a caixa como comprimento × largura × altura.
            const order: Axis[] = ["length", "width", "height"];
            out.boxDims = {
              label,
              values: dims.map((d, i) => ({ ...d, axis: order[i] })),
            };
            used = true;
          }
        }
        if (used) continue;
      }
      if (PER_BOX_LABEL.test(bare) && countOf(value)) {
        out.perBox = countOf(value);
        continue;
      }
      if (INNER_LABEL.test(bare) && countOf(value)) {
        out.innerQty = countOf(value);
        continue;
      }
      // Medidas: duas ou mais partes, ou uma parte com o título de um eixo.
      const nums = measureNumbers(value);
      const axisWord = AXIS_WORDS[bare] ?? null;
      if (nums && (nums.length >= 2 || axisWord)) {
        const unit = unitIn(label);
        const axes =
          nums.length === 1
            ? [axisWord]
            : (axesIn(label) ??
              axesIn(value) ??
              headerAxes ??
              (nums.length === 3 && portalOrderLabels.includes(normLabel(label))
                ? (["length", "width", "height"] as Axis[])
                : null));
        out.measures.push({
          label: label.replace(/\s*\([^)]*\)\s*/g, " ").trim() || label,
          values: nums.map((n, i) => ({
            axis:
              axes && axes.length === nums.length ? (axes[i] ?? null) : null,
            value: n.value,
            unit: n.unit ?? unit,
          })),
        });
        continue;
      }
      out.lines.push({ label, value });
      continue;
    }
    out.lines.push({ label: null, value: line });
  }
  return out;
}
