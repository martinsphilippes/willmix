import { redirect } from "next/navigation";
import { fallbackError } from "@/i18n/error-text";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { IMPORT_COLUMNS } from "@/lib/services/import";
import { IMPORT_ENTITIES } from "@/lib/services/import-batches";
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
  TextLink,
  Th,
  formatDate,
  rowClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { importCsvAction } from "../actions";
import { createImportBatchAction } from "../actions/import-batches";

const statusTone: Record<string, Tone> = {
  uploaded: "info",
  mapped: "warning",
  imported: "success",
  cancelled: "neutral",
};

export default async function ImportPage({
  searchParams,
}: PageProps<"/app/import">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { entity, created, skipped, error } = await searchParams;
  const t = await getT();
  const current =
    typeof entity === "string" && entity in IMPORT_COLUMNS ? entity : "parties";
  const batchEntity =
    typeof entity === "string" &&
    (IMPORT_ENTITIES as readonly string[]).includes(entity)
      ? entity
      : "products";
  const batches = await getStore().list("import_batches", {
    orderBy: "createdAt",
    direction: "desc",
    limit: 50,
  });

  return (
    <>
      <PageHeader
        help={{
          body: "help.import.batch.body",
          steps: "help.import.batch.steps",
        }}
        t={t}
        title={t("import.title")}
      />
      {created !== undefined ? (
        <Alert tone="success">
          {t("import.result", {
            created: String(created),
            skipped: String(skipped ?? 0),
          })}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">{fallbackError(t, String(error))}</Alert>
      ) : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("import.batch.title")}>
          <p className="mb-4 text-sm text-zinc-600">
            {t("import.batch.intro")}
          </p>
          <form action={createImportBatchAction} className="space-y-4">
            <Field label={t("import.batch.entity")}>
              <Select name="entity" defaultValue={batchEntity}>
                {IMPORT_ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {t(`import.entity.${e}` as DictionaryKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("import.batch.file")}>
              <Input
                name="file"
                type="file"
                accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                required
              />
            </Field>
            <Field
              label={t("import.batch.sheet")}
              hint={t("import.batch.sheetHint")}
            >
              <Input name="sheet" maxLength={80} />
            </Field>
            <SubmitButton>{t("import.batch.start")}</SubmitButton>
          </form>
        </Card>
        <Card title={t("import.batch.direct")}>
          <form action={importCsvAction} className="space-y-4">
            <Field label={t("parties.type")}>
              <Select name="entity" defaultValue={current}>
                <option value="parties">{t("parties.title")}</option>
                <option value="products">{t("products.title")}</option>
                <option value="lines">{t("lines.title")}</option>
              </Select>
            </Field>
            <Field
              label="CSV"
              hint={t("import.help", {
                columns: Object.values(IMPORT_COLUMNS)
                  .map((c) => c.join(", "))
                  .join(" / "),
              })}
            >
              <Input name="file" type="file" accept=".csv,text/csv" required />
            </Field>
            <SubmitButton variant="secondary">
              {t("parties.import")}
            </SubmitButton>
          </form>
        </Card>
      </div>

      <Card title={t("import.batch.previous")} className="mt-6">
        {batches.length === 0 ? (
          <Empty>{t("import.batch.previous.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("common.date")}</Th>
                <Th>{t("import.batch.entity")}</Th>
                <Th>{t("import.batch.file.column")}</Th>
                <Th className="text-right">{t("import.batch.rows")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("import.batch.summary")}</Th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className={rowClass}>
                  <Td className="whitespace-nowrap">
                    {formatDate(b.createdAt, t)}
                  </Td>
                  <Td>{t(`import.entity.${b.entity}` as DictionaryKey)}</Td>
                  <Td className="font-medium">
                    <TextLink
                      href={`/app/import/${b.id}`}
                      className="text-zinc-900"
                    >
                      {b.fileName}
                    </TextLink>
                    {b.sheetName ? (
                      <span className="block text-xs font-normal text-zinc-500">
                        {b.sheetName}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{b.rowCount}</Td>
                  <Td>
                    <Badge tone={statusTone[b.status] ?? "neutral"}>
                      {t(`import.status.${b.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-zinc-600">
                    {b.summary
                      ? t("import.done.summary", {
                          created: b.summary.created ?? 0,
                          updated: b.summary.updated ?? 0,
                          skipped: b.summary.skipped ?? 0,
                          errors: b.summary.errors ?? 0,
                        })
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
