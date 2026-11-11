/*
 * NCM do item do booking por aproximação (docs/BOOKING.md, "NCM do item"):
 * o nome do item é comparado com os nomes dos produtos do cadastro que têm
 * NCM. Vale o NCM do produto mais provável; com vários igualmente
 * prováveis, a moda entre eles. Sem produto provável (ou com empate na
 * moda), não há correspondência e o despachante preenche. Regras puras.
 */

/** Semelhança mínima (0 a 1) para um produto contar como provável. */
export const NCM_MATCH_MIN = 0.5;
/** Diferença até a qual duas semelhanças contam como iguais. */
const TIE = 1e-9;

/** Palavras que não identificam o produto (artigos, unidades, embalagem genérica). */
const STOP = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "sem",
  "para",
  "e",
  "em",
  "o",
  "a",
  "the",
  "of",
  "with",
  "for",
  "and",
  "in",
  "to",
  "a",
  "an",
  "pcs",
  "pc",
  "set",
  "new",
  "ml",
  "cm",
  "mm",
  "kg",
  "g",
  "l",
]);

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palavras significativas de um nome (sem números, medidas e palavras vazias). */
export function nameTokens(name: string | null | undefined): Set<string> {
  return new Set(
    fold(name ?? "")
      .split(/[^a-z0-9一-鿿]+/)
      .filter((w) => w.length >= 2 && !/\d/.test(w) && !STOP.has(w)),
  );
}

/** Semelhança entre dois conjuntos de palavras (Jaccard: comuns ÷ todas). */
export function tokenSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / (a.size + b.size - common);
}

const codeKey = (c: string | null | undefined) =>
  (c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Um produto do cadastro com NCM e os nomes e códigos pelos quais é reconhecido. */
export interface NcmCandidate {
  productId: string;
  ncm: string;
  /** Nome do produto e descrições dos itens de booking já ligados a ele. */
  names: string[];
  /** Códigos de fábrica do produto (dele, dos fornecedores e dos itens ligados). */
  codes: string[];
}

export interface NcmMatch {
  ncm: string;
  /** Semelhança do(s) produto(s) mais provável(is). */
  score: number;
  /** Produtos igualmente prováveis (que deram a moda). */
  productIds: string[];
}

/**
 * NCM do item por aproximação. Código de fábrica igual conta como
 * semelhança 1. Nulo quando nenhum produto passa de `NCM_MATCH_MIN` ou
 * quando os mais prováveis empatam entre NCMs diferentes.
 */
export function matchNcm(
  item: { names: Array<string | null | undefined>; code: string | null },
  candidates: NcmCandidate[],
): NcmMatch | null {
  const tokens = new Set<string>();
  for (const n of item.names) for (const w of nameTokens(n)) tokens.add(w);
  const code = codeKey(item.code);
  let best = 0;
  let top: NcmCandidate[] = [];
  for (const c of candidates) {
    let score = 0;
    if (code.length >= 3 && c.codes.some((k) => codeKey(k) === code)) score = 1;
    else
      for (const n of c.names)
        score = Math.max(score, tokenSimilarity(tokens, nameTokens(n)));
    if (score < NCM_MATCH_MIN) continue;
    if (score > best + TIE) {
      best = score;
      top = [c];
    } else if (Math.abs(score - best) <= TIE) top.push(c);
  }
  if (!top.length) return null;
  // Moda dos NCMs entre os igualmente prováveis; empate = sem correspondência.
  const count = new Map<string, number>();
  for (const c of top) count.set(c.ncm, (count.get(c.ncm) ?? 0) + 1);
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  const ncm = ranked[0][0];
  return {
    ncm,
    score: Number(best.toFixed(4)),
    productIds: top.filter((c) => c.ncm === ncm).map((c) => c.productId),
  };
}

/**
 * Grupo de itens parecidos para o despachante (classifica de uma vez): as
 * duas primeiras palavras significativas do nome, em ordem alfabética.
 */
export function ncmGroupKey(name: string | null | undefined): string {
  const words = [...nameTokens(name)].filter((w) => w.length >= 3);
  return words.slice(0, 2).sort().join(" ") || "—";
}

/*
 * Sugestões de NCM (docs/BOOKING.md, "NCM do item"): quando a aproximação não
 * tem certeza, a tabela do booking mostra até 3 NCMs prováveis para a Wellmix
 * escolher com um clique (nada é gravado sozinho). A planilha costuma vir em
 * inglês e o cadastro do Sankhya em português: cada palavra do item vale
 * também pela tradução do glossário. A nota é a parte das palavras do item
 * que aparecem no nome do produto (≥ 50%); código de fábrica igual vale 100%.
 */

/** Glossário inglês → português (sem acento), das palavras de utilidades e brinquedos. */
export const EN_PT: Record<string, string[]> = {
  marble: ["marmore", "marmorizado"],
  stone: ["pedra"],
  stripe: ["listra", "listras", "listrado"],
  striped: ["listra", "listras", "listrado"],
  stripes: ["listra", "listras", "listrado"],
  wood: ["madeira"],
  wooden: ["madeira"],
  bamboo: ["bambu"],
  glass: ["vidro"],
  crystal: ["cristal"],
  ceramic: ["ceramica"],
  porcelain: ["porcelana"],
  stoneware: ["ceramica", "gres"],
  plastic: ["plastico"],
  acrylic: ["acrilico"],
  silicone: ["silicone"],
  steel: ["aco", "inox"],
  stainless: ["inox", "aco"],
  iron: ["ferro"],
  metal: ["metal", "metalico"],
  aluminum: ["aluminio"],
  aluminium: ["aluminio"],
  paper: ["papel"],
  cotton: ["algodao"],
  fabric: ["tecido"],
  rubber: ["borracha"],
  cup: ["copo", "xicara"],
  mug: ["caneca"],
  tumbler: ["copo"],
  bottle: ["garrafa"],
  jar: ["pote", "jarra"],
  pot: ["pote", "panela", "vaso"],
  pan: ["frigideira", "panela", "forma"],
  plate: ["prato"],
  dish: ["prato", "travessa"],
  bowl: ["tigela", "bowl"],
  tray: ["bandeja"],
  board: ["tabua"],
  cutting: ["tabua", "corte"],
  chopping: ["tabua", "corte"],
  knife: ["faca"],
  fork: ["garfo"],
  spoon: ["colher"],
  ladle: ["concha"],
  spatula: ["espatula"],
  whisk: ["batedor", "fouet"],
  brush: ["pincel", "escova"],
  container: ["pote"],
  box: ["caixa"],
  basket: ["cesto", "cesta"],
  bag: ["sacola", "bolsa", "saco"],
  lid: ["tampa"],
  cover: ["capa", "tampa"],
  vase: ["vaso"],
  candle: ["vela"],
  holder: ["porta", "suporte"],
  rack: ["suporte", "escorredor"],
  hook: ["gancho"],
  hanger: ["cabide"],
  mirror: ["espelho"],
  frame: ["porta", "retrato", "moldura"],
  clock: ["relogio"],
  lamp: ["luminaria", "abajur"],
  light: ["luz", "luminaria"],
  towel: ["toalha"],
  rug: ["tapete"],
  mat: ["tapete", "esteira"],
  curtain: ["cortina"],
  pillow: ["almofada", "travesseiro"],
  cushion: ["almofada"],
  blanket: ["manta", "cobertor"],
  kitchen: ["cozinha"],
  bath: ["banho", "banheiro"],
  bathroom: ["banheiro"],
  soap: ["saboneteira", "sabonete"],
  dispenser: ["dispenser", "porta"],
  organizer: ["organizador"],
  storage: ["organizador", "armazenamento"],
  hermetic: ["hermetico"],
  airtight: ["hermetico"],
  thermal: ["termico"],
  thermos: ["garrafa", "termica"],
  lunch: ["marmita", "lancheira"],
  baking: ["forma", "assadeira"],
  mold: ["forma"],
  mould: ["forma"],
  cake: ["bolo"],
  grater: ["ralador"],
  strainer: ["peneira", "escorredor"],
  colander: ["escorredor"],
  scissors: ["tesoura"],
  toy: ["brinquedo"],
  doll: ["boneca"],
  ball: ["bola"],
  car: ["carro", "carrinho"],
  puzzle: ["quebra", "cabeca"],
  game: ["jogo"],
  pen: ["caneta"],
  pencil: ["lapis"],
  notebook: ["caderno"],
  umbrella: ["guarda", "chuva"],
  hair: ["cabelo"],
  comb: ["pente"],
  clip: ["presilha", "prendedor"],
  peg: ["prendedor"],
  flower: ["flor", "flores", "floral"],
  floral: ["floral", "flor"],
  heart: ["coracao"],
  star: ["estrela"],
  round: ["redondo", "redonda"],
  square: ["quadrado", "quadrada"],
  rectangular: ["retangular"],
  oval: ["oval"],
  small: ["pequeno", "pequena"],
  large: ["grande"],
  big: ["grande"],
  white: ["branco", "branca"],
  black: ["preto", "preta"],
  red: ["vermelho", "vermelha"],
  blue: ["azul"],
  green: ["verde"],
  yellow: ["amarelo", "amarela"],
  pink: ["rosa"],
  gray: ["cinza"],
  grey: ["cinza"],
  gold: ["dourado", "dourada"],
  golden: ["dourado", "dourada"],
  silver: ["prata", "prateado"],
  wall: ["parede"],
  table: ["mesa"],
  chair: ["cadeira"],
  shelf: ["prateleira"],
  handle: ["cabo", "alca"],
  decorative: ["decorativo", "decorativa"],
  christmas: ["natal", "natalino"],
};

/** Materiais da planilha → palavras do cadastro (desempate das sugestões). */
const MATERIAL_PT: Array<[RegExp, string[]]> = [
  [/\b(pp|ps|pvc|pe|abs|pet|plastic|resin)\b/, ["plastico"]],
  [/\bacryl/, ["acrilico"]],
  [/\bglass\b/, ["vidro"]],
  [/\b(ceramic|porcelain|stoneware)\b/, ["ceramica", "porcelana"]],
  [/\b(steel|stainless|iron|metal)\b/, ["aco", "inox", "ferro", "metal"]],
  [/\b(wood|bamboo|mdf)\b/, ["madeira", "bambu"]],
  [/\bsilicone\b/, ["silicone"]],
  [/\bpaper\b/, ["papel"]],
];

export interface NcmSuggestion {
  ncm: string;
  /** Parte das palavras do item que aparecem no produto (0 a 1). */
  score: number;
  /** Produtos com esse NCM e essa nota. */
  products: number;
  /** Um produto de exemplo (para a pessoa conferir). */
  example: string;
}

export interface NcmIndex {
  candidates: NcmCandidate[];
  tokens: Array<Set<string>>;
  byToken: Map<string, number[]>;
  byCode: Map<string, number[]>;
}

/** Índice das palavras e códigos dos candidatos (montado uma vez por tela). */
export function buildNcmIndex(candidates: NcmCandidate[]): NcmIndex {
  const tokens: Array<Set<string>> = [];
  const byToken = new Map<string, number[]>();
  const byCode = new Map<string, number[]>();
  candidates.forEach((c, i) => {
    const set = new Set<string>();
    for (const n of c.names) for (const w of nameTokens(n)) set.add(w);
    tokens.push(set);
    for (const w of set) {
      const list = byToken.get(w);
      if (list) list.push(i);
      else byToken.set(w, [i]);
    }
    for (const k of c.codes) {
      const key = codeKey(k);
      if (key.length < 3) continue;
      const list = byCode.get(key);
      if (list) list.push(i);
      else byCode.set(key, [i]);
    }
  });
  return { candidates, tokens, byToken, byCode };
}

/** Até `max` NCMs prováveis para o item (melhor nota, depois mais produtos). */
export function suggestNcms(
  item: {
    names: Array<string | null | undefined>;
    code: string | null;
    material?: string | null;
  },
  index: NcmIndex,
  max = 3,
): NcmSuggestion[] {
  const words = new Set<string>();
  for (const n of item.names) for (const w of nameTokens(n)) words.add(w);
  const variants = [...words].map((w) => [w, ...(EN_PT[w] ?? [])]);
  const materialWords = new Set<string>();
  const mat = fold(item.material ?? "");
  for (const [re, pt] of MATERIAL_PT)
    if (re.test(mat)) for (const w of pt) materialWords.add(w);

  const score = new Map<number, number>();
  const code = codeKey(item.code);
  if (code.length >= 3)
    for (const i of index.byCode.get(code) ?? []) score.set(i, 1);
  if (variants.length) {
    const hits = new Map<number, number>();
    for (const forms of variants) {
      const seen = new Set<number>();
      for (const f of forms)
        for (const i of index.byToken.get(f) ?? []) seen.add(i);
      for (const i of seen) hits.set(i, (hits.get(i) ?? 0) + 1);
    }
    for (const [i, h] of hits) {
      const s = h / variants.length;
      if (s >= NCM_MATCH_MIN && s > (score.get(i) ?? 0)) score.set(i, s);
    }
  }
  const byNcm = new Map<
    string,
    { score: number; products: number; material: number; example: string }
  >();
  for (const [i, s] of score) {
    const c = index.candidates[i];
    const matHit = [...materialWords].some((w) => index.tokens[i].has(w))
      ? 1
      : 0;
    const cur = byNcm.get(c.ncm);
    if (!cur || s > cur.score + TIE)
      byNcm.set(c.ncm, {
        score: s,
        products: 1,
        material: matHit,
        example: c.names[0] ?? "",
      });
    else if (Math.abs(s - cur.score) <= TIE) {
      cur.products++;
      cur.material = Math.max(cur.material, matHit);
    }
  }
  return [...byNcm.entries()]
    .sort(
      ([, a], [, b]) =>
        b.score - a.score || b.material - a.material || b.products - a.products,
    )
    .slice(0, max)
    .map(([ncm, v]) => ({
      ncm,
      score: Number(v.score.toFixed(2)),
      products: v.products,
      example: v.example,
    }));
}
