import "server-only";

/**
 * Adaptador de IA (cadastro por foto, textos de marketing).
 * Modos:
 * - api: chama a API da Anthropic com ANTHROPIC_API_KEY (nunca no browser);
 * - mock: devolve um exemplo claramente rotulado, para demonstração e testes;
 * - manual: sem sugestão (o sistema informa que a IA não está configurada).
 * IA ≠ regra de negócio: o resultado é sempre uma sugestão que um humano
 * confirma campo a campo (src/lib/services/ai-suggestions.ts).
 * EXTERNAL DEPENDENCY PENDING: ANTHROPIC_API_KEY na Vercel para o modo api.
 */
export type AiMode = "api" | "mock" | "manual";

export interface AiImage {
  bytes: Uint8Array;
  mime: string;
}

export interface AiResult {
  text: string;
  json: Record<string, unknown> | null;
}

export interface AiAdapter {
  readonly mode: AiMode;
  readonly model: string | null;
  /** Envia o prompt (e a imagem, se houver) e devolve o texto e o JSON extraído. null = modo manual. */
  complete(prompt: string, image?: AiImage | null): Promise<AiResult | null>;
}

export class ManualAiAdapter implements AiAdapter {
  readonly mode = "manual" as const;
  readonly model = null;
  async complete() {
    return null;
  }
}

/** Exemplo rotulado "(exemplo mock)" em todos os campos: nunca passa por dado real. */
export class MockAiAdapter implements AiAdapter {
  readonly mode = "mock" as const;
  readonly model = "mock";
  async complete(prompt: string, image?: AiImage | null): Promise<AiResult> {
    const json: Record<string, unknown> = prompt.includes('"catalogMatches"')
      ? {
          catalogMatches: [],
          productName: ["Nome de exemplo (mock)"],
          description: ["Descrição de exemplo (mock), para revisão humana."],
          specification: ["Especificação de exemplo (mock)"],
        }
      : prompt.includes('"concept"')
        ? {
            concept: "Conceito de exemplo (mock): praticidade para o dia a dia",
            slogan: "Slogan de exemplo (mock)",
            description:
              "Descrição comercial de exemplo (mock), para revisão humana.",
            campaign: "Campanha de exemplo (mock)",
            colors: ["cor de exemplo (mock)"],
          }
        : prompt.includes('"imagePrompt"')
          ? { imagePrompt: "Prompt de imagem de exemplo (mock)" }
          : prompt.includes('"materials"')
            ? {
                category: "Categoria de exemplo (mock)",
                description: image
                  ? "Descrição de exemplo (mock) gerada a partir da foto."
                  : "Descrição de exemplo (mock) sem foto.",
                materials: ["material de exemplo (mock)"],
                colors: ["cor de exemplo (mock)"],
                attributes: { atributo: "valor de exemplo (mock)" },
                confidence: "low",
                notes: "Modo mock: nenhum dado real foi analisado.",
              }
            : { description: "Descrição de exemplo (mock)." };
    return { text: JSON.stringify(json), json };
  }
}

/** API Messages da Anthropic via fetch (sem SDK); texto + imagem em base64. */
export class AnthropicAiAdapter implements AiAdapter {
  readonly mode = "api" as const;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs = 45_000,
  ) {}

  async complete(prompt: string, image?: AiImage | null): Promise<AiResult> {
    const content: Array<Record<string, unknown>> = [];
    if (image)
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mime,
          data: Buffer.from(image.bytes).toString("base64"),
        },
      });
    content.push({ type: "text", text: prompt });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error("ai_request_failed");
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text as string)
      .join("\n")
      .trim();
    return { text, json: extractJson(text) };
  }
}

/** Primeiro objeto JSON do texto (a resposta pode vir dentro de ```json ... ```). */
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface AiSettings {
  aiMode: "AUTO" | "MOCK" | "MANUAL";
  aiModel: string;
}

/** Escolhe o adaptador pelas configurações e pela chave presente no ambiente. */
export function getAiAdapter(settings: AiSettings): AiAdapter {
  if (settings.aiMode === "MOCK") return new MockAiAdapter();
  if (settings.aiMode === "MANUAL") return new ManualAiAdapter();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key
    ? new AnthropicAiAdapter(key, settings.aiModel || "claude-sonnet-5-5")
    : new ManualAiAdapter();
}
