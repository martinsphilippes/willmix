import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requirementLabel } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Textarea,
  cx,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveLineAction } from "../actions";
import { setLineCertificationsAction } from "../actions/compliance";
import { saveLinePromptsAction } from "../actions/vision";
import { catalogError } from "../products/_components/shared";
import { visionError } from "../products/_components/ai-section";

/** Linhas de produto: nome, manual e checklist de preparação herdado pelos pedidos. */
export default async function LinesPage({
  searchParams,
}: PageProps<"/app/lines">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error, edit, saved } = await searchParams;
  const t = await getT();
  const store = getStore();
  const lines = await store.list("product_lines", { orderBy: "name" });
  const editing =
    typeof edit === "string" ? lines.find((l) => l.id === edit) : null;
  const toText = (
    reqs: { key: string; label: string; type: string; required: boolean }[],
  ) =>
    reqs
      .map((r) => `${r.key} | ${r.label} | ${r.type} | ${r.required ? 1 : 0}`)
      .join("\n");

  return (
    <>
      <PageHeader
        help={{ body: "help.lines.body", steps: "help.catalog.lines.steps" }}
        t={t}
        title={t("lines.title")}
      />
      {saved ? <Alert tone="success">{t("catalog.saved")}</Alert> : null}
      {error ? (
        <Alert tone="danger">
          {visionError(t, error) ?? catalogError(t, error) ?? t("common.error")}
        </Alert>
      ) : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {lines.length === 0 ? <Empty>{t("common.none")}</Empty> : null}
          {lines.map((l) => (
            <Card
              key={l.id}
              title={l.name}
              className={editing?.id === l.id ? "ring-2 ring-brand-600" : ""}
              actions={
                <a
                  href={`/app/lines?edit=${l.id}`}
                  aria-current={editing?.id === l.id ? "true" : undefined}
                  className={cx(linkClass, "text-sm")}
                >
                  {t("common.edit")}
                </a>
              }
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("lines.requirements")}
              </p>
              <ul className="flex flex-wrap gap-1.5 text-xs">
                {l.requirements.map((r) => (
                  <li
                    key={r.key}
                    className="rounded-full bg-zinc-50 px-2.5 py-1 font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                  >
                    {requirementLabel(t, r)}
                    {!r.required ? "*" : ""}
                  </li>
                ))}
              </ul>
              {l.manualDocumentId ? (
                <a
                  href={`/api/files/${l.manualDocumentId}`}
                  className={cx(linkClass, "mt-3 inline-block text-sm")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("lines.manual")}
                </a>
              ) : null}
              {/* Segunda Onda: certificações obrigatórias da linha (gate de conformidade). */}
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("catalog.lines.certifications")}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {l.requiredCertifications?.length ? (
                  l.requiredCertifications.map((c) => (
                    <Badge key={c} tone="brand">
                      {c}
                    </Badge>
                  ))
                ) : (
                  <span className="text-zinc-500">
                    {t("catalog.lines.certifications.none")}
                  </span>
                )}
              </div>
              <form action={setLineCertificationsAction} className="mt-2">
                <input type="hidden" name="lineId" value={l.id} />
                <div className="flex gap-2">
                  <Input
                    name="certifications"
                    maxLength={500}
                    placeholder={t("ph.line.certifications")}
                    aria-label={t("catalog.lines.certifications")}
                    defaultValue={(l.requiredCertifications ?? []).join(", ")}
                    className="flex-1 py-1.5"
                  />
                  <SubmitButton
                    variant="secondary"
                    className="shrink-0 px-3 py-1.5 text-xs"
                    pendingText="…"
                  >
                    {t("common.save")}
                  </SubmitButton>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("catalog.lines.certificationsHint")}
                </p>
              </form>
              {/* Visão de Produto: prompts por linha, atributos exigidos e regras (IA só sugere). */}
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("vision.lines.title")}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {l.prompts?.requiredAttributes?.length ? (
                  l.prompts.requiredAttributes.map((a) => (
                    <Badge key={a} tone="info">
                      {a}
                    </Badge>
                  ))
                ) : (
                  <span className="text-zinc-500">
                    {t("vision.lines.requiredAttributes.none")}
                  </span>
                )}
                {l.prompts?.validationRules?.length ? (
                  <Badge tone="warning">
                    {t("vision.lines.rules.count", {
                      count: l.prompts.validationRules.length,
                    })}
                  </Badge>
                ) : null}
                {l.prompts?.descriptionPrompt ||
                l.prompts?.marketingPrompt ||
                l.prompts?.imagePrompt ? (
                  <Badge tone="success">{t("vision.lines.configured")}</Badge>
                ) : (
                  <Badge>{t("vision.lines.notConfigured")}</Badge>
                )}
              </div>
              <details
                open={saved === l.id}
                className="group mt-2 rounded-xl border border-zinc-200/80 bg-zinc-50/70"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-zinc-800 [&::-webkit-details-marker]:hidden">
                  {t("common.edit")}: {t("vision.lines.title")}
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base font-normal text-zinc-500 transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <form
                  action={saveLinePromptsAction}
                  className="space-y-3 border-t border-zinc-200/80 px-3 py-3"
                >
                  <input type="hidden" name="lineId" value={l.id} />
                  <p className="text-xs text-zinc-500">
                    {t("vision.lines.hint")}
                  </p>
                  <Field label={t("vision.lines.descriptionPrompt")}>
                    <Textarea
                      name="descriptionPrompt"
                      rows={2}
                      maxLength={4000}
                      defaultValue={l.prompts?.descriptionPrompt ?? ""}
                      className="min-h-0"
                    />
                  </Field>
                  <Field label={t("vision.lines.marketingPrompt")}>
                    <Textarea
                      name="marketingPrompt"
                      rows={2}
                      maxLength={4000}
                      defaultValue={l.prompts?.marketingPrompt ?? ""}
                      className="min-h-0"
                    />
                  </Field>
                  <Field label={t("vision.lines.imagePrompt")}>
                    <Textarea
                      name="imagePrompt"
                      rows={2}
                      maxLength={4000}
                      defaultValue={l.prompts?.imagePrompt ?? ""}
                      className="min-h-0"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label={t("vision.lines.requiredAttributes")}
                      hint={t("vision.lines.requiredAttributesHint")}
                    >
                      <Textarea
                        name="requiredAttributes"
                        rows={4}
                        placeholder={t(
                          "vision.lines.requiredAttributesPlaceholder",
                        )}
                        defaultValue={(
                          l.prompts?.requiredAttributes ?? []
                        ).join("\n")}
                        className="min-h-0 font-mono text-xs"
                      />
                    </Field>
                    <Field
                      label={t("vision.lines.validationRules")}
                      hint={t("vision.lines.validationRulesHint")}
                    >
                      <Textarea
                        name="validationRules"
                        rows={4}
                        defaultValue={(l.prompts?.validationRules ?? []).join(
                          "\n",
                        )}
                        className="min-h-0 text-xs"
                      />
                    </Field>
                  </div>
                  <SubmitButton
                    variant="secondary"
                    className="w-full sm:w-auto"
                    pendingText="…"
                  >
                    {t("vision.lines.save")}
                  </SubmitButton>
                </form>
              </details>
            </Card>
          ))}
        </div>
        <Card
          className={editing ? "order-first lg:order-none" : undefined}
          title={
            editing
              ? `${t("common.edit")}: ${editing.name}`
              : `${t("common.new")}`
          }
        >
          <form action={saveLineAction} className="space-y-3">
            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}
            <Field label={t("common.name")}>
              <Input name="name" required defaultValue={editing?.name ?? ""} />
            </Field>
            <Field label={`${t("lines.manual")} (PDF)`}>
              <Input name="manual" type="file" accept="application/pdf" />
            </Field>
            <Field
              label={t("lines.requirements")}
              hint={t("lines.requirementsHint")}
            >
              <Textarea
                name="requirements"
                rows={7}
                className="font-mono text-xs"
                defaultValue={
                  editing
                    ? toText(editing.requirements)
                    : t("lines.requirementsExample")
                }
              />
            </Field>
            <SubmitButton>{t("common.save")}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
