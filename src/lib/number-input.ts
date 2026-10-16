/*
 * Número digitado num campo de formulário, do jeito que as pessoas digitam no
 * Brasil, nos EUA e na China: "1.000", "1,000", "1.234,56", "1,234.56",
 * "0,050", "0.4 kg", "24 pcs", "24个", "45 dias". Sem banco nem Intl: roda no
 * navegador (conta ao vivo da ficha) e no servidor (o que se grava), com a
 * mesma regra dos dois lados.
 *
 * - Espaços e a unidade no fim são ignorados.
 * - Com ponto e vírgula, o último é o decimal ("1.234,56" e "1,234.56").
 * - Só um tipo de separador: em número inteiro (caixas, peças, MOQ), grupos
 *   de 3 dígitos são milhar ("1.000" = 1000); nos demais é decimal
 *   ("0.050" = 0,05; "1,5" = 1,5).
 * Devolve null para vazio e NaN para o que não dá para ler.
 */
export function parseNumberInput(
  raw: string | null | undefined,
  opts: { int?: boolean } = {},
): number | null {
  if (raw === null || raw === undefined) return null;
  let t = String(raw)
    .replace(/[\s  _]/g, "")
    .trim();
  if (!t) return null;
  // Unidade no fim ("kg", "pcs", "m³", "个", "dias"...): fica só o número.
  const m = /^([+-]?[\d.,]+)[^\d.,]*$/.exec(t);
  if (!m) return NaN;
  t = m[1];
  if (/[^\d]$/.test(t)) t = t.slice(0, -1); // "1.000." / "1,5,"
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Os dois: o último é o decimal; o outro, milhar.
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    normalized = t.split(thousands).join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const grouped = new RegExp(`^[+-]?\\d{1,3}(\\${sep}\\d{3})+$`).test(t);
    const parts = t.split(sep).length;
    if (opts.int && grouped) normalized = t.split(sep).join("");
    else if (parts > 2)
      // "1.000.000" num campo decimal: também é milhar.
      normalized = grouped ? t.split(sep).join("") : "";
    else normalized = t.replace(sep, ".");
  } else normalized = t;
  if (!normalized || !/^[+-]?\d*\.?\d+$/.test(normalized)) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}
