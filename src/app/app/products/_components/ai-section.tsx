import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { isAdmin } from "@/lib/auth/permissions";
import type {
  AiSource,
  AiSuggestion,
  AiSuggestionStatus,
  Document as DocumentRow,
  ProductPhoto,
  User,
} from "@/lib/db";
import type { AiMode } from "@/lib/integrations/ai";
import type { ProductFieldSuggestion } from "@/lib/services/ai-suggestions";
import {
  Alert,
  Badge,
  Empty,
  Field,
  Input,
  Select,
  TextLink,
  Textarea,
  cx,
  formatDate,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  applyProductSuggestionAction,
  discardSuggestionAction,
  requestProductSuggestionAction,
} from "../../actions/vision";
import { big, catalogError, userNameFor } from "./shared";

/*
 * Seção "Sugestão por foto (IA)" da ficha do produto e do item de sourcing.
 * FOTO → ANÁLISE → SUGESTÃO → HUMANO CONFIRMA campo a campo → CADASTRO.
 * Nada é aplicado automaticamente: cada campo tem uma caixa "aplicar"
 * desmarcada por padrão e o valor editável. Modo mock é rotulado; modo manual
 * (sem chave) explica a configuração e não inventa valores.
 */

/** Foto candidata à análise (product_photos ou documento com mime de imagem). */
export interface AiPhoto {
  documentId: string;
  label: string;
  primary: boolean;
}

/** Fotos do produto/item (galeria + documentos de imagem), a principal primeiro. */
export function collectAiPhotos(
  photos: ProductPhoto[],
  documents: DocumentRow[],
  primaryDocumentId: string | null,
  kindLabel: (kind: ProductPhoto["kind"]) => string,
): AiPhoto[] {
  const seen = new Set<string>();
  const out: AiPhoto[] = [];
  for (const p of [...photos].sort((a, b) =>
    (a.takenAt ?? a.createdAt).localeCompare(b.takenAt ?? b.createdAt),
  )) {
    if (seen.has(p.documentId)) continue;
    seen.add(p.documentId);
    out.push({
      documentId: p.documentId,
      label: p.caption
        ? `${kindLabel(p.kind)} · ${p.caption}`
        : kindLabel(p.kind),
      primary: p.isPrimary || p.documentId === primaryDocumentId,
    });
  }
  for (const d of documents) {
    if (!d.mime.startsWith("image/") || seen.has(d.id)) continue;
    seen.add(d.id);
    out.push({
      documentId: d.id,
      label: d.name,
      primary: d.id === primaryDocumentId,
    });
  }
  return out.sort((a, b) => Number(b.primary) - Number(a.primary));
}

/** Mensagem de ?error= dos códigos deste módulo (vision.error.*); null quando o código é de outro módulo. */
export function visionError(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  if (typeof code !== "string" || !code) return null;
  const key = `vision.error.${code}` as DictionaryKey;
  const text = t(key);
  return text === key ? null : text;
}

/** vision.error.* → catalog.error.* → genérica (mesmo padrão de catalogError). */
export function visionOrCatalogError(
  t: Translate,
  code: string | string[] | undefined,
): string | null {
  return visionError(t, code) ?? catalogError(t, code);
}

const sourceTone: Record<AiSource, Tone> = { mock: "warning", api: "success" };
const statusTone: Record<AiSuggestionStatus, Tone> = {
  suggested: "brand",
  applied: "success",
  discarded: "neutral",
};
const checkboxClass =
  "h-5 w-5 shrink-0 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

function when(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${formatDate(value)} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Valores atuais da ficha, para mostrar "Atual: …" ao lado de cada sugestão. */
export interface AiCurrentValues {
  category: string | null;
  description: string | null;
  material: string | null;
  color: string | null;
}

export function AiSection({
  entity,
  entityId,
  photos,
  suggestions,
  mode,
  model,
  user,
  users = [],
  current,
  t,
  back,
}: {
  entity: "product" | "sourcing_item";
  entityId: string;
  photos: AiPhoto[];
  suggestions: AiSuggestion[];
  mode: AiMode;
  model: string | null;
  user: User;
  users?: Array<{ id: string; name: string }>;
  current?: AiCurrentValues;
  t: Translate;
  /** Caminho da própria página (o descarte volta para cá, âncora #ai). */
  back: string;
}) {
  const userName = userNameFor(users);
  const defaultPhoto = photos[0] ?? null;
  const pending = suggestions.find((s) => s.status === "suggested") ?? null;
  const hidden = (
    <>
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="entityId" value={entityId} />
    </>
  );

  return (
    <div className="space-y-4">
      <div id="ai" className="scroll-mt-4" />
      <p className="text-sm text-zinc-600">{t("vision.ai.hint")}</p>

      {mode === "manual" ? (
        <Alert tone="warning">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("vision.ai.notConfigured")}</span>
            {isAdmin(user) ? (
              <TextLink href="/app/settings">
                {t("vision.ai.openSettings")}
              </TextLink>
            ) : null}
          </span>
        </Alert>
      ) : (
        <>
          {mode === "mock" ? (
            <Alert tone="warning">
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{t("vision.ai.source.mock")}</Badge>
                <span>{t("vision.ai.mockNotice")}</span>
              </span>
            </Alert>
          ) : null}
          {photos.length === 0 && mode === "api" ? (
            <Alert tone="info">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>{t("vision.ai.photo.none")}</span>
                <a href="#photos" className="font-medium underline">
                  {t("catalog.photos")}
                </a>
              </span>
            </Alert>
          ) : null}
          <form
            action={requestProductSuggestionAction}
            className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
          >
            {hidden}
            <div className="flex items-start gap-3">
              {defaultPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
                <img
                  src={`/api/files/${defaultPhoto.documentId}`}
                  alt={defaultPhoto.label}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <Field
                  label={t("vision.ai.photo")}
                  hint={
                    photos.length === 0 && mode === "mock"
                      ? t("vision.ai.photo.noneMock")
                      : undefined
                  }
                >
                  <Select
                    name="photoDocumentId"
                    defaultValue={defaultPhoto?.documentId ?? ""}
                    className={big}
                    disabled={photos.length === 0}
                  >
                    {photos.length === 0 ? (
                      <option value="">{t("vision.ai.noImage")}</option>
                    ) : null}
                    {photos.map((p) => (
                      <option key={p.documentId} value={p.documentId}>
                        {p.label}
                        {p.primary ? ` (${t("vision.ai.photo.primary")})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <Field
              label={t("vision.ai.context")}
              hint={t("vision.ai.contextHint")}
            >
              <Textarea
                name="context"
                rows={2}
                maxLength={2000}
                className={cx(big, "min-h-0")}
              />
            </Field>
            <SubmitButton
              pendingText="…"
              disabled={mode === "api" && photos.length === 0}
              className="w-full sm:w-auto"
            >
              {t("vision.ai.request")}
              {model && model !== mode ? (
                <span className="font-normal opacity-80">· {model}</span>
              ) : null}
            </SubmitButton>
          </form>
        </>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("vision.ai.history")}
        </h3>
        {suggestions.length === 0 ? (
          <Empty>{t("vision.ai.history.empty")}</Empty>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const fields = s.fields as ProductFieldSuggestion;
              const isPending = pending?.id === s.id;
              return (
                <li
                  key={s.id}
                  className={cx(
                    "rounded-xl border p-3 sm:p-4",
                    isPending
                      ? "border-brand-200 bg-brand-50/40"
                      : "border-zinc-200/80 bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium tabular-nums text-zinc-900">
                      {when(s.createdAt)}
                    </span>
                    <span className="text-zinc-500">
                      {t("vision.ai.requestedBy")}{" "}
                      {userName(s.requestedByUserId)}
                    </span>
                    <Badge tone={sourceTone[s.source] ?? "neutral"}>
                      {t(`vision.ai.source.${s.source}` as DictionaryKey)}
                      {s.model && s.model !== s.source ? ` · ${s.model}` : ""}
                    </Badge>
                    <Badge tone={statusTone[s.status] ?? "neutral"}>
                      {t(`vision.ai.status.${s.status}` as DictionaryKey)}
                    </Badge>
                    {s.imageDocumentId ? (
                      <a
                        href={`/api/files/${s.imageDocumentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                        <img
                          src={`/api/files/${s.imageDocumentId}`}
                          alt={t("vision.ai.photo")}
                          loading="lazy"
                          className="h-8 w-8 rounded border border-zinc-200 object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        ({t("vision.ai.noImage")})
                      </span>
                    )}
                  </div>
                  {s.status !== "suggested" ? (
                    <p className="mt-1 text-xs text-zinc-600">
                      {t("vision.ai.decidedBy")} {userName(s.decidedByUserId)}
                      {s.decidedAt ? ` · ${when(s.decidedAt)}` : ""}
                      {s.note
                        ? ` · ${s.status === "applied" ? t("vision.ai.applied") : t("common.note")}: ${s.note}`
                        : ""}
                    </p>
                  ) : null}

                  {isPending ? (
                    <PendingForms
                      suggestion={s}
                      fields={fields}
                      entity={entity}
                      entityId={entityId}
                      current={current}
                      back={back}
                      t={t}
                    />
                  ) : s.status === "suggested" ? (
                    <form
                      action={discardSuggestionAction}
                      className="mt-2 flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="back" value={back} />
                      <SubmitButton
                        variant="danger"
                        pendingText="…"
                        className="px-3 py-1.5 text-xs"
                      >
                        {t("vision.ai.discard")}
                      </SubmitButton>
                    </form>
                  ) : (
                    <SuggestedSummary fields={fields} t={t} />
                  )}

                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-medium text-zinc-600">
                      {t("vision.ai.prompt")}
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700">
                      {s.prompt}
                    </pre>
                    {s.rawText ? (
                      <>
                        <p className="mt-2 font-medium text-zinc-600">
                          {t("vision.ai.rawText")}
                        </p>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 font-mono text-[11px] text-zinc-700">
                          {s.rawText}
                        </pre>
                      </>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Resumo do que foi sugerido (histórico de sugestões já decididas). */
function SuggestedSummary({
  fields,
  t,
}: {
  fields: ProductFieldSuggestion;
  t: Translate;
}) {
  const rows: Array<[string, string]> = [];
  if (fields.category) rows.push([t("catalog.category"), fields.category]);
  if (fields.description)
    rows.push([t("vision.ai.apply.description"), fields.description]);
  if (fields.materials?.length)
    rows.push([t("catalog.material"), fields.materials.join(", ")]);
  if (fields.colors?.length)
    rows.push([t("catalog.color"), fields.colors.join(", ")]);
  const attrs = Object.entries(fields.attributes ?? {});
  if (attrs.length)
    rows.push([
      t("vision.lines.requiredAttributes"),
      attrs.map(([k, v]) => `${k}: ${String(v)}`).join("; "),
    ]);
  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-zinc-500">{k}</dt>
          <dd className="break-words text-zinc-700">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Campo sugerido: caixa "aplicar" (desmarcada) + valor editável + valor atual. */
function ApplyRow({
  name,
  label,
  current,
  t,
  children,
}: {
  name: "category" | "description" | "material" | "color";
  label: string;
  current: string | null | undefined;
  t: Translate;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-900">
        <input
          type="checkbox"
          name="apply"
          value={name}
          className={checkboxClass}
        />
        {t("vision.ai.apply.check")}: {label}
      </label>
      <div className="mt-2">{children}</div>
      <p className="mt-1 text-xs text-zinc-500">
        {t("vision.ai.apply.current")}:{" "}
        {current?.trim() ? (
          <span className="text-zinc-700">{current}</span>
        ) : (
          <span className="italic">{t("vision.ai.apply.empty")}</span>
        )}
      </p>
    </div>
  );
}

/**
 * Escolha explícita entre as opções sugeridas (rádio) ou outro valor (texto),
 * sem JavaScript: os rádios e o texto compartilham o `name`; o formulário só
 * envia o rádio marcado e a action lê a primeira entrada, então um rádio
 * marcado prevalece e, sem rádio, vale o texto "Outro". Nada vem escolhido.
 */
function ChoiceInput({
  name,
  options,
  label,
  t,
}: {
  name: "material" | "color";
  options: string[];
  label: string;
  t: Translate;
}) {
  return (
    <fieldset aria-label={label} className="space-y-1.5">
      <p className="text-xs text-zinc-500">{t("vision.ai.apply.suggested")}:</p>
      {options.map((o) => (
        <label
          key={o}
          className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800"
        >
          <input type="radio" name={name} value={o} className={checkboxClass} />
          <span className="break-words">{o}</span>
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <span className="shrink-0 text-zinc-500">
          {t("vision.ai.apply.other")}:
        </span>
        <Input
          name={name}
          aria-label={`${label} · ${t("vision.ai.apply.other")}`}
          maxLength={name === "material" ? 120 : 60}
          className={cx(big, "min-w-0 flex-1")}
        />
      </label>
      <p className="text-xs text-zinc-500">{t("vision.ai.apply.choiceHint")}</p>
    </fieldset>
  );
}

/** Formulários da sugestão pendente: aplicar (campo a campo) e descartar. */
function PendingForms({
  suggestion,
  fields,
  entity,
  entityId,
  current,
  back,
  t,
}: {
  suggestion: AiSuggestion;
  fields: ProductFieldSuggestion;
  entity: "product" | "sourcing_item";
  entityId: string;
  current?: AiCurrentValues;
  back: string;
  t: Translate;
}) {
  const attrs = Object.entries(fields.attributes ?? {});
  const hasAny =
    !!fields.category ||
    !!fields.description ||
    !!fields.materials?.length ||
    !!fields.colors?.length ||
    attrs.length > 0;
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        {fields.confidence ? (
          <span>
            {t("vision.ai.confidence")}:{" "}
            <Badge
              tone={
                fields.confidence === "high"
                  ? "success"
                  : fields.confidence === "medium"
                    ? "info"
                    : "warning"
              }
            >
              {t(`vision.ai.confidence.${fields.confidence}` as DictionaryKey)}
            </Badge>
          </span>
        ) : null}
        {fields.notes ? (
          <span>
            {t("vision.ai.notes")}: {fields.notes}
          </span>
        ) : null}
      </div>

      {!hasAny ? (
        <p className="text-sm text-zinc-600">{t("vision.ai.apply.nothing")}</p>
      ) : (
        <form action={applyProductSuggestionAction} className="space-y-3">
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="id" value={suggestion.id} />
          <h4 className="text-sm font-semibold text-zinc-900">
            {t("vision.ai.apply.title")}
          </h4>
          <p className="text-xs text-zinc-600">{t("vision.ai.apply.hint")}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {fields.category ? (
              <ApplyRow
                name="category"
                label={t("catalog.category")}
                current={current?.category}
                t={t}
              >
                <Input
                  name="category"
                  defaultValue={fields.category}
                  maxLength={120}
                  aria-label={t("catalog.category")}
                  className={big}
                />
              </ApplyRow>
            ) : null}
            {fields.materials?.length ? (
              <ApplyRow
                name="material"
                label={t("catalog.material")}
                current={current?.material}
                t={t}
              >
                <ChoiceInput
                  name="material"
                  options={fields.materials}
                  label={t("catalog.material")}
                  t={t}
                />
              </ApplyRow>
            ) : null}
            {fields.colors?.length ? (
              <ApplyRow
                name="color"
                label={t("catalog.color")}
                current={current?.color}
                t={t}
              >
                <ChoiceInput
                  name="color"
                  options={fields.colors}
                  label={t("catalog.color")}
                  t={t}
                />
              </ApplyRow>
            ) : null}
            {fields.description ? (
              <div className="lg:col-span-2">
                <ApplyRow
                  name="description"
                  label={t("vision.ai.apply.description")}
                  current={current?.description}
                  t={t}
                >
                  <Textarea
                    name="description"
                    defaultValue={fields.description}
                    rows={3}
                    maxLength={2000}
                    aria-label={t("vision.ai.apply.description")}
                    className={cx(big, "min-h-0")}
                  />
                </ApplyRow>
              </div>
            ) : null}
            {attrs.length ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 lg:col-span-2">
                <ul className="mb-2 flex flex-wrap gap-1.5 text-xs">
                  {attrs.map(([k, v]) => (
                    <li
                      key={k}
                      className="rounded-full bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                    >
                      {k}: {String(v)}
                    </li>
                  ))}
                </ul>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-900">
                  <input
                    type="checkbox"
                    name="apply"
                    value="attributes"
                    className={checkboxClass}
                  />
                  {t("vision.ai.apply.attributes")}
                </label>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("vision.ai.apply.attributesHint")}
                </p>
              </div>
            ) : null}
          </div>
          <SubmitButton pendingText="…" className="w-full sm:w-auto">
            {t("vision.ai.apply.submit")}
          </SubmitButton>
        </form>
      )}

      <form
        action={discardSuggestionAction}
        className="flex flex-col gap-2 border-t border-zinc-200/70 pt-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="id" value={suggestion.id} />
        <input type="hidden" name="back" value={back} />
        <div className="min-w-0 flex-1">
          <Field label={t("vision.ai.discard.note")}>
            <Input name="note" maxLength={2000} className={big} />
          </Field>
        </div>
        <SubmitButton
          variant="danger"
          pendingText="…"
          className="w-full shrink-0 sm:w-auto"
        >
          {t("vision.ai.discard")}
        </SubmitButton>
      </form>
    </div>
  );
}
