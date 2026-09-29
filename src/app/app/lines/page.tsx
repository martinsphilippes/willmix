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
import { catalogError } from "../products/_components/shared";

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
          {catalogError(t, error) ?? t("common.error")}
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
                    placeholder="Inmetro, Anvisa"
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
              hint="chave | rótulo | tipo (file, photo, text, number, date, confirm) | obrigatório (1/0)"
            >
              <Textarea
                name="requirements"
                rows={7}
                className="font-mono text-xs"
                defaultValue={
                  editing
                    ? toText(editing.requirements)
                    : "dieline | Dieline | file | 1\nphoto_pro | Foto profissional | photo | 1\nweight | Peso (kg) | number | 1\nphoto_scale | Foto na balança | photo | 1\nlabel | Etiqueta | file | 1"
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
