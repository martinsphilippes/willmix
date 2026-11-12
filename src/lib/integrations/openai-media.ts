import "server-only";

/**
 * Adaptador da OpenAI para as referências por IA da escolha do grupo
 * (docs/SUPPLIER_REQUESTS.md, "Referências por IA"): imagens aproximadas do
 * produto ao final da produção e a ficha em texto para o fornecedor.
 * Modos (o mesmo `aiMode` das Configurações):
 * - api: OPENAI_API_KEY (só no servidor) chama a API da OpenAI;
 * - mock: exemplo claramente rotulado "EXEMPLO MOCK", nunca passa por IA;
 * - manual: sem chave ou IA desligada; os prompts ficam gravados e nada é gerado.
 * EXTERNAL DEPENDENCY PENDING: OPENAI_API_KEY na Vercel para o modo api.
 */
export type MediaMode = "api" | "mock" | "manual";

export interface MediaImage {
  bytes: Uint8Array;
  mime: string;
}

export interface MediaAdapter {
  readonly mode: MediaMode;
  readonly imageModel: string | null;
  readonly textModel: string | null;
  /** Imagem a partir do prompt; com `reference` (a foto do booking), parte dela. */
  image(prompt: string, reference?: MediaImage | null): Promise<MediaImage>;
  text(prompt: string): Promise<string>;
}

export class MediaError extends Error {
  constructor(
    readonly code: "off" | "auth" | "rate_limit" | "rejected" | "failed",
    readonly status: number | null = null,
  ) {
    super(`openai_${code}`);
  }
}

function failure(status: number): MediaError {
  if (status === 401 || status === 403) return new MediaError("auth", status);
  if (status === 429) return new MediaError("rate_limit", status);
  if (status === 400) return new MediaError("rejected", status);
  return new MediaError("failed", status);
}

const OPENAI = "https://api.openai.com/v1";
/** Uma imagem pode levar mais de um minuto. */
const TIMEOUT_MS = 150_000;

export class OpenAiMediaAdapter implements MediaAdapter {
  readonly mode = "api" as const;
  constructor(
    private readonly key: string,
    readonly imageModel: string,
    readonly textModel: string,
  ) {}

  private async check(response: Response, what: string) {
    if (response.ok) return;
    const body = await response.text().catch(() => "");
    // Só status e o começo da resposta (nunca a chave) para os logs.
    console.error("openai_failed", what, response.status, body.slice(0, 300));
    throw failure(response.status);
  }

  async image(prompt: string, reference?: MediaImage | null) {
    const headers = { authorization: `Bearer ${this.key}` };
    let response: Response;
    if (reference) {
      const form = new FormData();
      form.set("model", this.imageModel);
      form.set("prompt", prompt);
      form.set("size", "1024x1024");
      form.set(
        "image",
        new Blob([Buffer.from(reference.bytes)], { type: reference.mime }),
        `reference.${reference.mime.split("/")[1] || "png"}`,
      );
      response = await fetch(`${OPENAI}/images/edits`, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else {
      response = await fetch(`${OPENAI}/images/generations`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.imageModel,
          prompt,
          size: "1024x1024",
          n: 1,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    }
    await this.check(response, "image");
    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const first = data.data?.[0];
    if (first?.b64_json)
      return {
        bytes: new Uint8Array(Buffer.from(first.b64_json, "base64")),
        mime: "image/png",
      };
    if (first?.url) {
      const file = await fetch(first.url, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!file.ok) throw new MediaError("failed", file.status);
      return {
        bytes: new Uint8Array(await file.arrayBuffer()),
        mime: file.headers.get("content-type") || "image/png",
      };
    }
    throw new MediaError("failed");
  }

  async text(prompt: string) {
    const response = await fetch(`${OPENAI}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.textModel, input: prompt }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await this.check(response, "text");
    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };
    const text =
      data.output_text ??
      (data.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text" && c.text)
        .map((c) => c.text)
        .join("\n");
    if (!text?.trim()) throw new MediaError("failed");
    return text.trim();
  }
}

const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

/** Exemplo rotulado: imagem cinza com "EXEMPLO MOCK" e o começo do prompt. */
export class MockMediaAdapter implements MediaAdapter {
  readonly mode = "mock" as const;
  readonly imageModel = null;
  readonly textModel = null;

  async image(prompt: string) {
    const words = prompt.replace(/\s+/g, " ").trim().slice(0, 180);
    const lines = words.match(/.{1,45}(\s|$)/g) ?? [words];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
<rect width="512" height="512" fill="#f4f4f5"/>
<rect x="16" y="16" width="480" height="480" fill="none" stroke="#a1a1aa" stroke-width="4" stroke-dasharray="12 8"/>
<text x="256" y="120" font-family="sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#b91c1c">EXEMPLO MOCK</text>
<text x="256" y="160" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#52525b">Imagem de IA de exemplo (não é o produto)</text>
${lines
  .slice(0, 5)
  .map(
    (l, i) =>
      `<text x="256" y="${240 + i * 28}" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#3f3f46">${escapeXml(l.trim())}</text>`,
  )
  .join("\n")}
</svg>`;
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return { bytes: new Uint8Array(png), mime: "image/png" };
  }

  async text(prompt: string) {
    return [
      "[EXEMPLO MOCK: texto de exemplo, não passou por IA]",
      "",
      prompt,
    ].join("\n");
  }
}

export class ManualMediaAdapter implements MediaAdapter {
  readonly mode = "manual" as const;
  readonly imageModel = null;
  readonly textModel = null;
  async image(): Promise<MediaImage> {
    throw new MediaError("off");
  }
  async text(): Promise<string> {
    throw new MediaError("off");
  }
}

export interface MediaSettings {
  aiMode: "AUTO" | "MOCK" | "MANUAL";
  openaiImageModel: string;
  openaiTextModel: string;
}

/** MOCK/MANUAL pelas Configurações; AUTO usa a OpenAI se houver OPENAI_API_KEY. */
export function getMediaAdapter(settings: MediaSettings): MediaAdapter {
  if (settings.aiMode === "MOCK") return new MockMediaAdapter();
  if (settings.aiMode === "MANUAL") return new ManualMediaAdapter();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return new ManualMediaAdapter();
  return new OpenAiMediaAdapter(
    key,
    settings.openaiImageModel || "gpt-image-1",
    settings.openaiTextModel || "gpt-5-mini",
  );
}
