/*
 * Texto da cor ("Cor / sortimento" da ficha, "Cor" do produto) acompanhando o
 * seletor Pantone: cada cor escolhida entra como "PANTONE <código>" e sai ao
 * ser removida. O que a pessoa escreveu à mão fica exatamente como está
 * (espaços, barras, "BRANCO (PANTONE 11-0601 TCX)"). Sem a tabela de cores:
 * roda no navegador sem carregar as ~6 mil cores.
 */

const SEP = " / ";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Código com espaços flexíveis: "Cool Gray 11 C" casa "cool  gray 11 c". */
const codePattern = (code: string) =>
  code.trim().split(/\s+/).map(escape).join("\\s+");

/** O texto já cita a cor (como trecho próprio ou dentro de outro, ex.: "(PANTONE 185 C)")? */
function mentions(text: string, code: string): boolean {
  return new RegExp(`PANTONE\\s+${codePattern(code)}(?![\\w-])`, "i").test(
    text,
  );
}

/** Tira o trecho "PANTONE <código>" inteiro (entre barras), com uma barra vizinha. */
function removeSegment(text: string, code: string): string {
  const c = codePattern(code);
  // No começo: o trecho e a barra seguinte.
  let out = text.replace(
    new RegExp(`^\\s*PANTONE\\s+${c}\\s*(?:\\/\\s*|$)`, "i"),
    "",
  );
  // No meio ou no fim: a barra anterior e o trecho.
  out = out.replace(
    new RegExp(`\\s*\\/\\s*PANTONE\\s+${c}(?=\\s*(?:\\/|$))`, "gi"),
    "",
  );
  return out;
}

/**
 * Novo texto da cor depois de a seleção passar de `prev` para `next`:
 * - cada cor que saiu: some o trecho "PANTONE X" dela (só o trecho exato;
 *   citação dentro de outro texto fica);
 * - cada cor que entrou: vai para o fim ("… / PANTONE X"), se o texto ainda
 *   não a cita e se couber em `max` (a que não cabe fica só no seletor);
 * - o resto do texto não muda.
 */
export function syncColorText(
  text: string,
  prev: ReadonlyArray<{ code: string }>,
  next: ReadonlyArray<{ code: string }>,
  max = 200,
): string {
  const prevCodes = new Set(prev.map((c) => norm(c.code)));
  const nextCodes = new Set(next.map((c) => norm(c.code)));
  let out = text;
  for (const c of prev)
    if (!nextCodes.has(norm(c.code))) out = removeSegment(out, c.code);
  for (const c of next) {
    if (prevCodes.has(norm(c.code)) || mentions(out, c.code)) continue;
    const add = `PANTONE ${c.code.trim().replace(/\s+/g, " ")}`;
    const base = out.replace(/\s+$/, "");
    const candidate = base.trim() ? `${base}${SEP}${add}` : add;
    if (candidate.length <= max) out = candidate;
  }
  return out;
}

/**
 * Corta um texto "A / B / C" no limite sem partir um trecho ao meio (ex.:
 * a Cor do produto, de 60 caracteres, vinda da ficha, de 200). Um trecho
 * sozinho maior que o limite é cortado nele.
 */
export function cutAtSeparator(text: string, max: number): string {
  if (text.length <= max) return text;
  const parts = text
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  let out = "";
  for (const part of parts) {
    const candidate = out ? `${out}${SEP}${part}` : part;
    if (candidate.length > max) break;
    out = candidate;
  }
  return out || text.slice(0, max);
}
