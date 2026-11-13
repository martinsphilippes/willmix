import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { AiReferenceAsset, AiReferencePrompts } from "@/lib/db/schema";
import {
  AI_PROMPT_MAX,
  AI_REFERENCE_KINDS,
  AI_REFERENCE_OUTPUT,
  assetsByKind,
} from "@/lib/ai-references";
import {
  Alert,
  Badge,
  Card,
  Field,
  Textarea,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * Painel logo abaixo de "Gravar a escolha do grupo" (docs/SUPPLIER_REQUESTS.md,
 * "Referências por IA"): os três prompts (padrão das Configurações, editáveis
 * na escolha), o botão que grava e gera com a OpenAI e os arquivos gerados.
 * Fica dentro do formulário da escolha: os prompts vão com ela. O cartão
 * ocupa a largura toda da área de conteúdo e os três prompts ficam lado a
 * lado (pela largura do cartão, @container); em tela estreita, um por linha.
 */

export function SelectionAiPrompts({
  prompts,
  assets,
  mode,
  models,
  generated,
  error,
  t,
}: {
  /** Os que valem para a escolha (os dela ou os padrão). */
  prompts: AiReferencePrompts;
  assets: AiReferenceAsset[] | null | undefined;
  mode: "api" | "mock" | "manual";
  models: { image: string | null; text: string | null };
  /** Resultado da última geração (da volta da ação). */
  generated: number | null;
  error: string | null;
  t: Translate;
}) {
  const byKind = assetsByKind(assets);
  const errorKey = error ? (`aiRefs.error.${error}` as DictionaryKey) : null;
  return (
    <div id="ai-references" className="min-w-0" data-ai-prompts>
      <Card title={t("aiRefs.panel.title")}>
        <p className="mb-2 text-sm text-zinc-600">{t("aiRefs.panel.body")}</p>
        <p className="mb-3 text-xs text-zinc-500">
          {mode === "api"
            ? t("aiRefs.mode.api", {
                image: models.image ?? "",
                text: models.text ?? "",
              })
            : t(`aiRefs.mode.${mode}`)}
        </p>
        {generated !== null || errorKey ? (
          <div className="mb-3 space-y-2" data-ai-result={generated ?? 0}>
            {generated ? (
              <Alert tone="success">
                {t("aiRefs.generated", { n: generated })}
              </Alert>
            ) : null}
            {errorKey ? (
              <Alert tone={generated ? "warning" : "danger"}>
                {t(errorKey) !== errorKey
                  ? t(errorKey)
                  : t("aiRefs.error.openai_failed")}
              </Alert>
            ) : null}
          </div>
        ) : null}
        <div className="@container">
          <div className="grid gap-3 @3xl:grid-cols-3" data-ai-prompt-grid>
            {AI_REFERENCE_KINDS.map((kind) => {
              const asset = byKind[kind];
              return (
                <div key={kind} className="space-y-1.5">
                  <Field label={t(`aiRefs.kind.${kind}`)}>
                    <Textarea
                      name={`aiPrompt.${kind}`}
                      // Lado a lado a caixa é mais estreita: mais linhas à vista.
                      rows={5}
                      maxLength={AI_PROMPT_MAX}
                      defaultValue={prompts[kind]}
                      data-ai-prompt={kind}
                    />
                  </Field>
                  {asset ? (
                    <div
                      className="flex items-center gap-2"
                      data-ai-asset={kind}
                    >
                      {AI_REFERENCE_OUTPUT[kind] === "image" ? (
                        <a
                          href={`/api/files/${asset.documentId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                          <img
                            src={`/api/files/${asset.documentId}`}
                            alt={t(`aiRefs.kind.${kind}`)}
                            className="h-20 w-20 rounded-lg border border-zinc-200 object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={`/api/files/${asset.documentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className={linkClass}
                        >
                          {t("aiRefs.openSheet")}
                        </a>
                      )}
                      {asset.mode === "mock" ? (
                        <Badge tone="warning">{t("aiRefs.mockBadge")}</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {t("aiRefs.panel.dataHint")} {t("aiRefs.panel.saveHint")}
        </p>
        <div className="mt-3">
          <SubmitButton
            name="generate"
            value="1"
            variant="secondary"
            disabled={mode === "manual"}
            pendingText={t("aiRefs.panel.generating")}
            data-ai-generate
          >
            {t("aiRefs.panel.generate")}
          </SubmitButton>
        </div>
      </Card>
    </div>
  );
}

/** As referências da solicitação (a Wellmix e o fornecedor veem). */
export function RequestAiReferences({
  assets,
  t,
}: {
  assets: AiReferenceAsset[] | null | undefined;
  t: Translate;
}) {
  const byKind = assetsByKind(assets);
  const list = AI_REFERENCE_KINDS.map((k) => byKind[k]).filter(
    (a): a is AiReferenceAsset => !!a,
  );
  if (!list.length) return null;
  return (
    <Card title={t("aiRefs.request.title")}>
      <div data-request-ai-references>
        <p className="mb-3 text-sm text-zinc-600">{t("aiRefs.request.body")}</p>
        <div className="flex flex-wrap items-start gap-4">
          {list.map((a) => (
            <figure key={a.documentId} className="space-y-1">
              {AI_REFERENCE_OUTPUT[a.kind] === "image" ? (
                <a
                  href={`/api/files/${a.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                  <img
                    src={`/api/files/${a.documentId}`}
                    alt={t(`aiRefs.kind.${a.kind}`)}
                    className="h-40 w-40 rounded-lg border border-zinc-200 object-cover"
                  />
                </a>
              ) : (
                <a
                  href={`/api/files/${a.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {t("aiRefs.openSheet")}
                </a>
              )}
              <figcaption className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                {t(`aiRefs.kind.${a.kind}`)}
                {a.mode === "mock" ? (
                  <Badge tone="warning">{t("aiRefs.mockBadge")}</Badge>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Card>
  );
}
