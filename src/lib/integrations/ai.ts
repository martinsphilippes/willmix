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
  /** Texto enviado logo antes da imagem (ex.: "CATÁLOGO id=… · nome"), para a IA saber o que é cada foto. */
  label?: string;
}

/** Aceita uma imagem, várias ou nenhuma. */
export type AiImages = AiImage | AiImage[] | null | undefined;
const asList = (images: AiImages): AiImage[] =>
  !images ? [] : Array.isArray(images) ? images : [images];

export interface AiResult {
  text: string;
  json: Record<string, unknown> | null;
}

export interface AiAdapter {
  readonly mode: AiMode;
  readonly model: string | null;
  /** Envia o prompt (e as imagens, se houver) e devolve o texto e o JSON extraído. null = modo manual. */
  complete(prompt: string, images?: AiImages): Promise<AiResult | null>;
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
  async complete(prompt: string, images?: AiImages): Promise<AiResult> {
    const image = asList(images)[0] ?? null;
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

/** Motivos de falha da IA, traduzidos na tela (ai.error.*). */
export const AI_ERROR_CODES = [
  "card_required",
  "unauthorized",
  "no_credit",
  "rate_limited",
  "model_not_found",
  "timeout",
  "service_down",
  "unknown",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** Falha da IA com motivo conhecido; a mensagem é "ai_<código>". */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly status: number | null = null,
  ) {
    super(`ai_${code}`);
  }
}

/** Traduz a resposta de erro (status + corpo) da Anthropic/AI Gateway num motivo. */
export function classifyAiFailure(status: number, body: string): AiErrorCode {
  let type = "";
  let message = "";
  try {
    const json = JSON.parse(body) as {
      error?: { type?: unknown; message?: unknown };
    };
    type = String(json.error?.type ?? "");
    message = String(json.error?.message ?? "");
  } catch {
    message = body;
  }
  const text = `${type} ${message}`.toLowerCase();
  if (type === "customer_verification_required" || text.includes("credit card"))
    return "card_required";
  if (status === 402 || /insufficient|credit balance|billing|quota/.test(text))
    return "no_credit";
  if (
    status === 401 ||
    status === 403 ||
    type === "authentication_error" ||
    type === "permission_error"
  )
    return "unauthorized";
  if (status === 429 || type === "rate_limit_error") return "rate_limited";
  if (
    status === 404 ||
    type === "not_found_error" ||
    (status === 400 && text.includes("model"))
  )
    return "model_not_found";
  if (status >= 500) return "service_down";
  return "unknown";
}

/** Motivo de qualquer erro vindo de uma chamada à IA. */
export function aiErrorCode(error: unknown): AiErrorCode {
  if (error instanceof AiError) return error.code;
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  )
    return "timeout";
  if (error instanceof TypeError) return "service_down";
  return "unknown";
}

/** De onde vem a IA real: chave direta da Anthropic ou AI Gateway da Vercel (chave ou OIDC do projeto). */
export type AiProvider = "anthropic" | "gateway";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/messages";
const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

/** "claude-sonnet-5-5" → "anthropic/claude-sonnet-5.5" (formato do gateway). */
export function toGatewayModel(model: string): string {
  if (model.includes("/")) return model;
  return `anthropic/${model.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`;
}

/** Ordena versões ("…-4.5" < "…-5" < "…-5.5") para escolher a mais nova. */
const versionOf = (id: string) =>
  (id.match(/(\d+(?:\.\d+)?)$/)?.[1] ?? "0").split(".").map(Number);
function newest(ids: string[]) {
  return [...ids].sort((a, b) => {
    const va = versionOf(a);
    const vb = versionOf(b);
    return (vb[0] ?? 0) - (va[0] ?? 0) || (vb[1] ?? 0) - (va[1] ?? 0);
  })[0];
}

let gatewayFallback: string | null = null;
/** Modelo do gateway quando o configurado não existe: o Sonnet mais novo do catálogo público. */
async function pickGatewayModel(): Promise<string | null> {
  if (gatewayFallback) return gatewayFallback;
  try {
    const res = await fetch(GATEWAY_MODELS_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (data.data ?? []).map((m) => m.id);
    const sonnet = ids.filter((id) =>
      /^anthropic\/claude-sonnet-\d+(\.\d+)?$/.test(id),
    );
    const any = ids.filter((id) => id.startsWith("anthropic/claude-"));
    gatewayFallback = newest(sonnet.length ? sonnet : any) ?? null;
  } catch {
    gatewayFallback = null;
  }
  return gatewayFallback;
}

/** API Messages da Anthropic (direta ou pelo AI Gateway da Vercel) via fetch, sem SDK. */
export class AnthropicAiAdapter implements AiAdapter {
  readonly mode = "api" as const;
  model: string;
  constructor(
    readonly provider: AiProvider,
    private readonly auth: () => Promise<Record<string, string>>,
    model: string,
    private readonly timeoutMs = 60_000,
  ) {
    this.model = provider === "gateway" ? toGatewayModel(model) : model;
  }

  private async send(content: Array<Record<string, unknown>>) {
    let auth: Record<string, string>;
    try {
      auth = await this.auth();
    } catch {
      // Token do projeto indisponível (OIDC desligado) = credencial recusada.
      throw new AiError("unauthorized");
    }
    return fetch(this.provider === "gateway" ? GATEWAY_URL : ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        ...auth,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  async complete(prompt: string, images?: AiImages): Promise<AiResult> {
    const content: Array<Record<string, unknown>> = [];
    for (const image of asList(images)) {
      if (image.label) content.push({ type: "text", text: image.label });
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mime,
          data: Buffer.from(image.bytes).toString("base64"),
        },
      });
    }
    content.push({ type: "text", text: prompt });
    let response = await this.send(content);
    // Gateway: nome de modelo desconhecido → usa o Sonnet mais novo disponível.
    if (
      !response.ok &&
      this.provider === "gateway" &&
      (response.status === 400 || response.status === 404)
    ) {
      const fallback = await pickGatewayModel();
      if (fallback && fallback !== this.model) {
        console.warn("ai model fallback", this.model, "→", fallback);
        this.model = fallback;
        response = await this.send(content);
      }
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const code = classifyAiFailure(response.status, body);
      // Só status, motivo e início da resposta (nunca a credencial) para os logs.
      console.error(
        "ai_request_failed",
        this.provider,
        this.model,
        response.status,
        code,
        body.slice(0, 300),
      );
      throw new AiError(code, response.status);
    }
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

/**
 * Escolhe o adaptador: MOCK/MANUAL pelas configurações; senão a primeira
 * credencial disponível: ANTHROPIC_API_KEY (direto), AI_GATEWAY_API_KEY
 * (gateway) ou, rodando na Vercel, o token OIDC do projeto (gateway, sem chave).
 */
export function getAiAdapter(settings: AiSettings): AiAdapter {
  if (settings.aiMode === "MOCK") return new MockAiAdapter();
  if (settings.aiMode === "MANUAL") return new ManualAiAdapter();
  const model = settings.aiModel || "claude-sonnet-5-5";
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey)
    return new AnthropicAiAdapter(
      "anthropic",
      async () => ({ "x-api-key": anthropicKey }),
      model,
    );
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey || process.env.VERCEL === "1")
    return new AnthropicAiAdapter(
      "gateway",
      async () => {
        const token =
          gatewayKey ??
          (await import("@vercel/oidc").then((m) => m.getVercelOidcToken()));
        return { authorization: `Bearer ${token}` };
      },
      model,
    );
  return new ManualAiAdapter();
}

/** Onde está a IA (para diagnóstico; nunca expõe credencial). */
export function aiStatus(settings: AiSettings) {
  const adapter = getAiAdapter(settings);
  return {
    mode: adapter.mode,
    provider: adapter instanceof AnthropicAiAdapter ? adapter.provider : null,
    model: adapter.model,
  };
}
