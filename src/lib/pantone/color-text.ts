/*
 * Texto da cor ("Cor / sortimento" da ficha, "Cor" do produto) acompanhando o
 * seletor Pantone: cada cor escolhida entra como "PANTONE <código>" e sai ao
 * ser removida. O que a pessoa escreveu à mão (ex.: "BRANCO") fica. Sem a
 * tabela de cores: roda no navegador sem carregar as ~6 mil cores.
 */

const SEP = " / ";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();
const token = (code: string) => `PANTONE ${code}`;

/**
 * Novo texto da cor depois de a seleção passar de `prev` para `next`:
 * - remove o "PANTONE X" de cada cor que saiu;
 * - acrescenta, no fim e na ordem escolhida, o "PANTONE X" de cada cor nova
 *   que ainda não está no texto;
 * - mantém os demais trechos (separados por "/") como estão;
 * - não passa de `max` caracteres (a cor que não cabe fica só no seletor).
 */
export function syncColorText(
  text: string,
  prev: ReadonlyArray<{ code: string }>,
  next: ReadonlyArray<{ code: string }>,
  max = 200,
): string {
  const nextCodes = new Set(next.map((c) => norm(c.code)));
  const removed = new Set(
    prev.map((c) => norm(c.code)).filter((code) => !nextCodes.has(code)),
  );
  const parts = text
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const m = /^PANTONE\s+(.+)$/i.exec(p);
      return !(m && removed.has(norm(m[1])));
    });
  const present = new Set(parts.map(norm));
  let out = parts.join(SEP);
  for (const c of next) {
    const add = token(c.code.trim().replace(/\s+/g, " "));
    if (present.has(norm(add))) continue;
    const candidate = out ? `${out}${SEP}${add}` : add;
    if (candidate.length > max) break;
    out = candidate;
    present.add(norm(add));
  }
  return out;
}
