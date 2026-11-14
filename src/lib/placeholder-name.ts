/*
 * Nome de exemplo gravado como se fosse dado (docs/PURCHASE_ORDER.md,
 * "Nome de exemplo"): "XPTO" e "Produto novo XPTO" foram digitados como
 * marcador de um nome que o fluxo preencheria depois, e o sistema copiou o
 * texto para o item do pedido e para o rótulo das tarefas. Aqui fica a regra
 * única: esse texto vale como nome ausente. Regras puras, sem banco.
 */

/** Separador entre o título da tarefa e o produto ("Arte · Jarra de vidro"). */
export const NAME_SEPARATOR = " · ";

/** Palavras que, juntas de "xpto", não formam um nome ("Produto novo XPTO"). */
const FILLER_WORDS = new Set(["produto", "produtos", "novo", "novos", "nova"]);
const MARKER = "xpto";

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * O texto é só o marcador de exemplo? "XPTO", "Produto XPTO", "Produto novo
 * XPTO" (em qualquer caixa). Nome real que só contém a palavra ("Xpto Cargo")
 * não é marcador.
 */
export function isPlaceholderName(value: string | null | undefined): boolean {
  const words = fold(value ?? "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return (
    words.includes(MARKER) &&
    words.every((w) => w === MARKER || FILLER_WORDS.has(w))
  );
}

/** O nome, ou nulo quando está vazio ou é o marcador de exemplo. */
export function realName(value: string | null | undefined): string | null {
  const name = (value ?? "").trim();
  return name && !isPlaceholderName(name) ? name : null;
}

/** "Título · Nome" com nome real; só o título quando o nome falta. */
export function titleWithName(
  title: string,
  name: string | null | undefined,
): string {
  const real = realName(name);
  return real ? `${title}${NAME_SEPARATOR}${real}` : title;
}

/**
 * Tira o marcador de um texto montado com ele, sem deixar separador
 * sobrando: "Faca (die cut) · Produto novo XPTO" → "Faca (die cut)";
 * "…nº 3 (Produto novo XPTO)" → "…nº 3"; numa lista separada por vírgula,
 * cada parte é tratada sozinha. Com `name`, o marcador dá lugar ao nome
 * real. Só sai a parte que é inteira o marcador: texto real fica como está.
 */
export function withoutPlaceholder(text: string, name?: string | null): string {
  if (!fold(text).includes(MARKER)) return text;
  const real = realName(name);
  const part = (piece: string) =>
    piece
      .split(NAME_SEPARATOR)
      .map((p) => (isPlaceholderName(p) ? real : p))
      .filter((p): p is string => p !== null)
      .join(NAME_SEPARATOR);
  return (
    text
      // "(Produto novo XPTO)" → "" ou "(Nome real)".
      .replace(/\s*\(([^()]*)\)/g, (whole, inner: string) =>
        isPlaceholderName(inner) ? (real ? ` (${real})` : "") : whole,
      )
      .split(", ")
      .map(part)
      .filter((p) => p.trim())
      .join(", ")
      .trim()
  );
}

/** O que vem depois do título num rótulo de tarefa (o produto), ou "". */
export function nameOfLabel(label: string): string {
  return (
    realName(label.split(NAME_SEPARATOR).slice(1).join(NAME_SEPARATOR)) ?? ""
  );
}

/** O título de um rótulo de tarefa (o que vem antes do produto). */
export const titleOfLabel = (label: string) =>
  label.split(NAME_SEPARATOR)[0].trim();

/** Código do erro quando alguém tenta gravar o marcador como nome. */
export const PLACEHOLDER_NAME_ERROR = "product_name_placeholder";

/**
 * Recusa o marcador como nome de produto: a tela trata "XPTO" como nome
 * ausente, então aceitar na entrada faria o que foi digitado sumir.
 */
export function assertRealProductName(name: string | null | undefined) {
  if (isPlaceholderName(name)) throw new Error(PLACEHOLDER_NAME_ERROR);
}
