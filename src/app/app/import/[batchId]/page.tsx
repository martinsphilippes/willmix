import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore, type ImportBatch } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import { pt as dictionaryPt, type DictionaryKey } from "@/i18n/dictionaries";
import {
  previewBatch,
  TARGET_FIELDS,
  type ImportEntity,
  type PreviewRow,
} from "@/lib/services/import-batches";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  LinkButton,
  PageHeader,
  Select,
  StepDot,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  linkClass,
  rowClass,
  type StepState,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  applyImportBatchAction,
  cancelImportBatchAction,
  setBatchMappingAction,
} from "../../actions/import-batches";

const CURRENCIES = ["USD", "CNY", "BRL", "EUR"];
const LIST_URL: Record<ImportEntity, string> = {
  products: "/app/products",
  sourcing_items: "/app/sourcing",
  parties: "/app/parties",
  lines: "/app/lines",
};

const hasKey = (key: string): key is DictionaryKey => key in dictionaryPt;

/** "missing:name" → "Falta: Nome"; códigos desconhecidos aparecem como vieram. */
function problemLabel(t: Translate, code: string) {
  const [kind, field] = code.split(":");
  const fieldKey = `import.field.${field ?? ""}`;
  const fieldLabel = field ? (hasKey(fieldKey) ? t(fieldKey) : field) : "";
  const key = `import.problem.${kind}`;
  return hasKey(key) ? t(key, { field: fieldLabel }) : code;
}

function fieldLabel(t: Translate, key: string) {
  const k = `import.field.${key}`;
  return hasKey(k) ? t(k) : key;
}

function Steps({ t, current }: { t: Translate; current: 1 | 2 | 3 }) {
  const items: Array<[number, DictionaryKey]> = [
    [1, "import.step.mapping"],
    [2, "import.step.preview"],
    [3, "import.step.done"],
  ];
  const state = (n: number): StepState =>
    n < current ? "done" : n === current ? "active" : "pending";
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {items.map(([n, key]) => (
        <li key={n} className="flex items-center gap-2">
          <StepDot state={state(n)}>{n}</StepDot>
          <span
            className={cx(
              state(n) === "active"
                ? "font-semibold text-zinc-900"
                : "text-zinc-600",
            )}
          >
            {t(key)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CancelForm({ batch, t }: { batch: ImportBatch; t: Translate }) {
  return (
    <form action={cancelImportBatchAction}>
      <input type="hidden" name="batchId" value={batch.id} />
      <SubmitButton variant="danger">{t("import.cancel")}</SubmitButton>
    </form>
  );
}

/** Mesma forma de PageProps<"/app/import/[batchId]"> (tipo gerado pelo Next ao rodar `next typegen`). */
interface BatchPageProps {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ImportBatchPage({
  params,
  searchParams,
}: BatchPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { batchId } = await params;
  const { error, step } = await searchParams;
  const store = getStore();
  const batch = await store.get("import_batches", batchId);
  if (!batch) notFound();
  const t = await getT();
  const entity = batch.entity as ImportEntity;
  const fields = TARGET_FIELDS[entity] ?? [];
  const lines =
    entity === "products"
      ? await store.list("product_lines", { orderBy: "name" })
      : [];
  const view =
    batch.status === "cancelled"
      ? "cancelled"
      : batch.status === "imported"
        ? "done"
        : batch.status === "uploaded" || step === "mapping"
          ? "mapping"
          : "preview";
  const preview: PreviewRow[] =
    view === "preview" ? await previewBatch(batch) : [];
  const counts = preview.reduce(
    (acc, r) => {
      acc[r.suggested]++;
      return acc;
    },
    { create: 0, update: 0, skip: 0 },
  );

  return (
    <>
      <PageHeader
        help={{
          body: "help.import.review.body",
          steps: "help.import.review.steps",
        }}
        t={t}
        title={t("import.batch.of", { file: batch.fileName })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              {t(`import.entity.${entity}` as DictionaryKey)}
            </Badge>
            {batch.sheetName ? <span>{batch.sheetName}</span> : null}
            <span>
              {batch.rowCount} {t("import.batch.rows").toLowerCase()}
            </span>
            {batch.fileDocumentId ? (
              <a
                href={`/api/files/${batch.fileDocumentId}`}
                className={cx(linkClass, "text-xs")}
              >
                {t("common.download")}
              </a>
            ) : null}
          </span>
        }
        actions={<LinkButton href="/app/import">{t("common.back")}</LinkButton>}
      />
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}

      {view === "cancelled" ? (
        <Alert tone="warning">{t("import.cancelled")}</Alert>
      ) : null}

      {view === "done" ? (
        <Card title={t("import.done.title")}>
          <Steps t={t} current={3} />
          <Alert tone="success">
            {t("import.done.summary", {
              created: batch.summary?.created ?? 0,
              updated: batch.summary?.updated ?? 0,
              skipped: batch.summary?.skipped ?? 0,
              errors: batch.summary?.errors ?? 0,
            })}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={LIST_URL[entity] ?? "/app"} variant="primary">
              {t("import.done.goList")}
            </LinkButton>
            <LinkButton href="/app/import">{t("import.title")}</LinkButton>
          </div>
        </Card>
      ) : null}

      {/* ---- Passo 1: mapeamento ---- */}
      {view === "mapping" ? (
        <Card title={t("import.step.mapping")}>
          <Steps t={t} current={1} />
          <form action={setBatchMappingAction} className="space-y-4">
            <input type="hidden" name="batchId" value={batch.id} />
            <input type="hidden" name="entity" value={entity} />
            {entity === "products" || entity === "sourcing_items" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {entity === "products" ? (
                  <Field
                    label={t("import.mapping.defaultLine")}
                    hint={t("import.mapping.defaultLineHint")}
                  >
                    <Select
                      name="__defaultLineId"
                      defaultValue={batch.mapping.__defaultLineId ?? ""}
                    >
                      <option value="">{t("common.select")}</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label={t("import.mapping.defaultCurrency")}>
                  <Select
                    name="__defaultCurrency"
                    defaultValue={batch.mapping.__defaultCurrency ?? "USD"}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}
            <Table>
              <thead>
                <tr>
                  <Th>{t("import.mapping.column")}</Th>
                  <Th>{t("import.mapping.sample")}</Th>
                  <Th>{t("import.mapping.target")}</Th>
                </tr>
              </thead>
              <tbody>
                {batch.headers.map((header, i) => {
                  const samples = batch.rows
                    .map((r) => r[header])
                    .filter((v) => v && v.trim() !== "")
                    .slice(0, 3);
                  return (
                    <tr key={`${header}-${i}`} className={rowClass}>
                      <Td className="font-medium text-zinc-900">
                        {header}
                        <input type="hidden" name={`h_${i}`} value={header} />
                      </Td>
                      <Td className="max-w-[16rem] text-xs text-zinc-600">
                        {samples.length === 0
                          ? "—"
                          : samples.map((s, j) => (
                              <span key={j} className="block truncate">
                                {s}
                              </span>
                            ))}
                      </Td>
                      <Td>
                        <Select
                          name={`f_${i}`}
                          defaultValue={batch.mapping[header] ?? ""}
                          aria-label={header}
                          className="min-w-[12rem]"
                        >
                          <option value="">{t("import.mapping.ignore")}</option>
                          {fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {fieldLabel(t, f.key)}
                              {f.required
                                ? ` (${t("import.mapping.required")})`
                                : ""}
                            </option>
                          ))}
                        </Select>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton>{t("import.mapping.preview")}</SubmitButton>
            </div>
          </form>
          <div className="mt-4">
            <CancelForm batch={batch} t={t} />
          </div>
        </Card>
      ) : null}

      {/* ---- Passo 2: conferência ---- */}
      {view === "preview" ? (
        <Card
          title={t("import.step.preview")}
          actions={
            <TextLink href={`/app/import/${batch.id}?step=mapping`}>
              {t("import.mapping.back")}
            </TextLink>
          }
        >
          <Steps t={t} current={2} />
          <Alert tone="info">
            {t("import.preview.summary", {
              create: counts.create,
              update: counts.update,
              skip: counts.skip,
            })}
          </Alert>
          {preview.length === 0 ? (
            <div className="mt-4">
              <Empty>{t("import.preview.empty")}</Empty>
            </div>
          ) : (
            <form action={applyImportBatchAction} className="mt-4 space-y-4">
              <input type="hidden" name="batchId" value={batch.id} />
              <Table>
                <thead>
                  <tr>
                    <Th>{t("import.preview.row")}</Th>
                    <Th>{t("import.preview.data")}</Th>
                    <Th>{t("import.preview.match")}</Th>
                    <Th>{t("import.preview.problems")}</Th>
                    <Th>{t("import.preview.decision")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => {
                    const name = row.fields.name;
                    const others = fields.filter(
                      (f) =>
                        f.key !== "name" &&
                        row.fields[f.key] !== undefined &&
                        row.fields[f.key] !== null &&
                        row.fields[f.key] !== "",
                    );
                    return (
                      <tr key={row.index} className={rowClass}>
                        <Td className="tabular-nums text-zinc-500">
                          {row.index + 1}
                        </Td>
                        <Td className="min-w-[16rem]">
                          <span className="font-medium text-zinc-900">
                            {name ? String(name) : "—"}
                          </span>
                          {others.length > 0 ? (
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-600">
                              {others.map((f) => (
                                <span key={f.key}>
                                  <span className="text-zinc-400">
                                    {fieldLabel(t, f.key)}:
                                  </span>{" "}
                                  {String(row.fields[f.key])}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </Td>
                        <Td className="min-w-[12rem]">
                          {row.match ? (
                            <>
                              <span className="block text-zinc-900">
                                {row.match.label}
                              </span>
                              <Badge tone="info">
                                {hasKey(`import.reason.${row.match.reason}`)
                                  ? t(
                                      `import.reason.${row.match.reason}` as DictionaryKey,
                                    )
                                  : row.match.reason}
                              </Badge>
                            </>
                          ) : (
                            <Badge tone="success">
                              {t("import.preview.noMatch")}
                            </Badge>
                          )}
                        </Td>
                        <Td className="min-w-[12rem]">
                          {row.problems.length === 0 ? (
                            <span className="text-zinc-400">—</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {row.problems.map((p) => (
                                <Badge
                                  key={p}
                                  tone={
                                    row.suggested === "skip"
                                      ? "danger"
                                      : "warning"
                                  }
                                >
                                  {problemLabel(t, p)}
                                </Badge>
                              ))}
                            </span>
                          )}
                        </Td>
                        <Td>
                          <Select
                            name={`d_${row.index}`}
                            defaultValue={row.suggested}
                            aria-label={`${t("import.preview.decision")} ${row.index + 1}`}
                            className="min-w-[8rem]"
                          >
                            <option value="create">
                              {t("import.decision.create")}
                            </option>
                            {row.match ? (
                              <option value="update">
                                {t("import.decision.update")}
                              </option>
                            ) : null}
                            <option value="skip">
                              {t("import.decision.skip")}
                            </option>
                          </Select>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                <SubmitButton className="w-full sm:w-auto">
                  {t("import.preview.apply")}
                </SubmitButton>
              </div>
            </form>
          )}
          <div className="mt-4">
            <CancelForm batch={batch} t={t} />
          </div>
        </Card>
      ) : null}
    </>
  );
}
