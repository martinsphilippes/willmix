import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requirementLabel, type Translate } from "@/i18n";
import type { ProductLine } from "@/lib/db";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  cx,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveLineAction } from "../actions";
import {
  setLineAgencyAction,
  setLineCertificationsAction,
} from "../actions/compliance";
import { saveLinePromptsAction } from "../actions/vision";
import { catalogError } from "../products/_components/shared";
import { visionError } from "../products/_components/ai-section";

/** Linhas de produto: nome, manual e checklist de preparação herdado pelos pedidos. */
export default async function LinesPage({
  searchParams,
}: PageProps<"/app/lines">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "lines");
  const { error, edit, saved, agencyApplied } = await searchParams;
  const t = await getT();
  const store = getStore();
  const lines = await store.list("product_lines", { orderBy: "name" });
  // Linha aberta (editar ou recém-salva): os campos aparecem logo abaixo dela.
  const openId =
    typeof edit === "string"
      ? edit
      : typeof saved === "string" && lines.some((l) => l.id === saved)
        ? saved
        : null;
  const products = await store.list("products", { filter: { active: true } });
  // Agências ativas (Parceiros): a agência de arte de cada linha.
  const agencies = await store.list("parties", {
    filter: { type: "agency", active: true },
  });
  const productCount = new Map<string, number>();
  for (const p of products)
    productCount.set(p.lineId, (productCount.get(p.lineId) ?? 0) + 1);
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
      {saved ? (
        <Alert tone="success">
          {typeof agencyApplied === "string"
            ? t("catalog.lines.agency.applied", { n: agencyApplied })
            : t("catalog.saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">
          {visionError(t, error) ?? catalogError(t, error) ?? t("common.error")}
        </Alert>
      ) : null}
      {/* Nova linha: formulário curto que abre sob o botão; a tabela usa a largura toda. */}
      <details
        open={lines.length === 0}
        className="mt-3 rounded-2xl border border-zinc-200/80 bg-white shadow-sm"
        data-line-new
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
          + {t("lines.new")}
        </summary>
        <div className="border-t border-zinc-200/80 p-4">
          <LineForm t={t} toText={toText} />
        </div>
      </details>
      {lines.length === 0 ? (
        <div className="mt-4">
          <Empty>{t("common.none")}</Empty>
        </div>
      ) : (
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>{t("common.name")}</Th>
                <Th>{t("lines.requirements")}</Th>
                <Th>{t("catalog.lines.certifications")}</Th>
                <Th>{t("vision.lines.title")}</Th>
                <Th className="text-right">{t("lines.products")}</Th>
                <Th>{t("lines.manual")}</Th>
                <Th className="text-right">{t("lines.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const open = openId === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr
                      className={cx(rowClass, open && "bg-brand-50/60")}
                      data-line-row={l.id}
                    >
                      <Td className="min-w-40 font-semibold text-zinc-900">
                        <a
                          href={open ? "/app/lines" : `/app/lines?edit=${l.id}`}
                          className="hover:text-brand-700"
                          aria-expanded={open}
                        >
                          {l.name}
                        </a>
                      </Td>
                      <Td>
                        <ul className="flex flex-wrap gap-1 text-xs">
                          {l.requirements.map((r) => (
                            <li
                              key={r.key}
                              className="rounded-full bg-zinc-50 px-2 py-0.5 font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                            >
                              {requirementLabel(t, r)}
                              {!r.required ? "*" : ""}
                            </li>
                          ))}
                        </ul>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1 text-xs">
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
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          {l.prompts?.requiredAttributes?.length
                            ? l.prompts.requiredAttributes.map((a) => (
                                <Badge key={a} tone="info">
                                  {a}
                                </Badge>
                              ))
                            : null}
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
                            <Badge tone="success">
                              {t("vision.lines.configured")}
                            </Badge>
                          ) : (
                            <Badge>{t("vision.lines.notConfigured")}</Badge>
                          )}
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums">
                        <a
                          href={`/app/products?line=${l.id}`}
                          className={linkClass}
                        >
                          {productCount.get(l.id) ?? 0}
                        </a>
                      </Td>
                      <Td>
                        {l.manualDocumentId ? (
                          <a
                            href={`/api/files/${l.manualDocumentId}`}
                            className={cx(linkClass, "text-sm")}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            PDF
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        <a
                          href={open ? "/app/lines" : `/app/lines?edit=${l.id}`}
                          className={cx(linkClass, "text-sm")}
                          data-line-open={l.id}
                        >
                          {open ? t("lines.close") : t("common.edit")}
                        </a>
                      </Td>
                    </tr>
                    {open ? (
                      <tr data-line-detail={l.id}>
                        <td
                          colSpan={7}
                          className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-4"
                        >
                          <div className="grid items-start gap-4 lg:grid-cols-3">
                            <Card title={`${t("common.edit")}: ${l.name}`}>
                              <LineForm t={t} toText={toText} line={l} />
                            </Card>
                            <Card title={t("catalog.lines.certifications")}>
                              <form action={setLineCertificationsAction}>
                                <input
                                  type="hidden"
                                  name="lineId"
                                  value={l.id}
                                />
                                <div className="flex gap-2">
                                  <Input
                                    name="certifications"
                                    maxLength={500}
                                    placeholder={t("ph.line.certifications")}
                                    aria-label={t(
                                      "catalog.lines.certifications",
                                    )}
                                    defaultValue={(
                                      l.requiredCertifications ?? []
                                    ).join(", ")}
                                    className="flex-1"
                                  />
                                  <SubmitButton
                                    variant="secondary"
                                    className="shrink-0"
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
                            <Card title={t("catalog.lines.agency")}>
                              <form
                                action={setLineAgencyAction}
                                data-line-agency={l.id}
                              >
                                <input
                                  type="hidden"
                                  name="lineId"
                                  value={l.id}
                                />
                                <div className="flex gap-2">
                                  <Select
                                    name="agencyId"
                                    defaultValue={l.agencyId ?? ""}
                                    aria-label={t("catalog.lines.agency")}
                                    className="min-w-0 flex-1"
                                  >
                                    <option value="">
                                      {t("catalog.lines.agency.none")}
                                    </option>
                                    {agencies.map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {a.name}
                                      </option>
                                    ))}
                                  </Select>
                                  <SubmitButton
                                    variant="secondary"
                                    className="shrink-0"
                                    pendingText="…"
                                  >
                                    {t("common.save")}
                                  </SubmitButton>
                                </div>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {t("catalog.lines.agencyHint")}
                                </p>
                              </form>
                            </Card>
                            <Card
                              title={t("vision.lines.title")}
                              className="@container"
                            >
                              <form
                                action={saveLinePromptsAction}
                                className="space-y-3"
                              >
                                <input
                                  type="hidden"
                                  name="lineId"
                                  value={l.id}
                                />
                                <p className="text-xs text-zinc-500">
                                  {t("vision.lines.hint")}
                                </p>
                                <Field
                                  label={t("vision.lines.descriptionPrompt")}
                                >
                                  <Textarea
                                    name="descriptionPrompt"
                                    rows={2}
                                    maxLength={4000}
                                    defaultValue={
                                      l.prompts?.descriptionPrompt ?? ""
                                    }
                                    className="min-h-0"
                                  />
                                </Field>
                                <Field
                                  label={t("vision.lines.marketingPrompt")}
                                >
                                  <Textarea
                                    name="marketingPrompt"
                                    rows={2}
                                    maxLength={4000}
                                    defaultValue={
                                      l.prompts?.marketingPrompt ?? ""
                                    }
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
                                <div className="grid gap-3 @md:grid-cols-2">
                                  <Field
                                    label={t("vision.lines.requiredAttributes")}
                                    hint={t(
                                      "vision.lines.requiredAttributesHint",
                                    )}
                                  >
                                    <Textarea
                                      name="requiredAttributes"
                                      rows={3}
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
                                      rows={3}
                                      defaultValue={(
                                        l.prompts?.validationRules ?? []
                                      ).join("\n")}
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
                            </Card>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}

/** Nome, manual e checklist da linha (nova ou a aberta na tabela). */
function LineForm({
  t,
  toText,
  line,
}: {
  t: Translate;
  toText: (reqs: ProductLine["requirements"]) => string;
  line?: ProductLine;
}) {
  return (
    <form action={saveLineAction} className="space-y-3">
      {line ? <input type="hidden" name="id" value={line.id} /> : null}
      <Field label={t("common.name")}>
        <Input name="name" required defaultValue={line?.name ?? ""} />
      </Field>
      <Field label={`${t("lines.manual")} (PDF)`}>
        <Input name="manual" type="file" accept="application/pdf" />
      </Field>
      <Field label={t("lines.requirements")} hint={t("lines.requirementsHint")}>
        <Textarea
          name="requirements"
          rows={5}
          className="font-mono text-xs"
          defaultValue={
            line ? toText(line.requirements) : t("lines.requirementsExample")
          }
        />
      </Field>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </form>
  );
}
