/*
 * Prompt da arte da embalagem (tela do briefing, /app/packaging/[id]): junta
 * o que o briefing já sabe do produto com o que a pessoa escreveu, num texto
 * para copiar e colar no ChatGPT (ou outra IA de imagem). Função pura: nada
 * é enviado a IA nenhuma daqui e nada é gravado.
 */

export const ART_PROMPT_WISH_MAX = 2000;

export interface ArtPromptInput {
  /** Frase de abertura (o pedido). */
  intro: string;
  /** Dados do briefing, já com o rótulo traduzido; vazios ficam de fora. */
  facts: Array<[label: string, value: string | null | undefined]>;
  /** Rótulo do que a pessoa escreveu. */
  wishLabel: string;
  /** O que a pessoa quer na arte (texto livre). */
  wish: string;
  /** Regras finais (formato, não inventar dado, fotos de referência). */
  closing: string;
}

const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

/** Valor de várias linhas vai recuado, embaixo do rótulo. */
const line = (label: string, value: string) =>
  value.includes("\n")
    ? `${label}:\n${value
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n")}`
    : `${label}: ${value}`;

export function buildArtPrompt(input: ArtPromptInput): string {
  const facts = input.facts
    .map(([label, value]) => [label, clean(value)] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => line(label, value));
  const wish = clean(input.wish).slice(0, ART_PROMPT_WISH_MAX);
  return [
    input.intro,
    facts.join("\n"),
    wish ? line(input.wishLabel, wish) : "",
    input.closing,
  ]
    .filter(Boolean)
    .join("\n\n");
}
