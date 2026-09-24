import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWillmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { IMPORT_COLUMNS } from "@/lib/services/import";
import { Alert, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { importCsvAction } from "../actions";

export default async function ImportPage({
  searchParams,
}: PageProps<"/app/import">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWillmix(user);
  const { entity, created, skipped, error } = await searchParams;
  const t = await getT();
  const current =
    typeof entity === "string" && entity in IMPORT_COLUMNS ? entity : "parties";

  return (
    <>
      <PageHeader title={t("import.title")} />
      {created !== undefined ? (
        <Alert tone="success">
          {t("import.result", {
            created: String(created),
            skipped: String(skipped ?? 0),
          })}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}
      <Card className="mt-4 max-w-xl">
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
          <SubmitButton>{t("parties.import")}</SubmitButton>
        </form>
      </Card>
    </>
  );
}
