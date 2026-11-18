import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";

/**
 * Título e detalhe de uma pendência por chave e valores: a tela traduz no
 * idioma de quem lê (`Task.text`, src/lib/services/tasks.ts). Sem isto valem
 * `title` e `detail`, gravados em português.
 */
export interface TaskText {
  title: DictionaryKey;
  detail: DictionaryKey;
  /** Frase a mais no detalhe (ex.: o que falta designar e onde). */
  detailExtra?: DictionaryKey;
  values: Record<string, string | number>;
  /**
   * Números escritos no idioma da tela (quantidade: 4.800 em pt, 4,800 em
   * en). O número do pedido e os outros identificadores ficam em `values`,
   * sem separador de milhar.
   */
  numbers?: Record<string, number>;
}

/** Os valores do texto, com os números de `numbers` no idioma de `t`. */
export function taskTextValues(
  t: Translate,
  text: Pick<TaskText, "values" | "numbers">,
): Record<string, string | number> {
  if (!text.numbers) return text.values;
  const values = { ...text.values };
  for (const [name, n] of Object.entries(text.numbers))
    values[name] = n.toLocaleString(t.intl);
  return values;
}
