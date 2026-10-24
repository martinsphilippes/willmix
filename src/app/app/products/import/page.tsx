import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore, SHEET_CURRENCIES } from "@/lib/db";
import { SHEET_IMPORT_ENTITY } from "@/lib/services/product-sheet-import";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { dictionaries } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  TextLink,
  formatDate,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { importProductSheetAction } from "../../actions/product-sheet-import";

/*
 * Importar a planilha da ficha técnica: os produtos nascem cadastrados (ficha
 * mestre e fotos) e a tela de resultado mostra o que falta em cada um.
 */
export default async function ProductSheetImportPage({
  searchParams,
}: PageProps<"/app/products/import">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [lines, batches] = await Promise.all([
    store.list("product_lines", { orderBy: "name" }),
    store.list("import_batches", {
      filter: { entity: SHEET_IMPORT_ENTITY },
      orderBy: "createdAt",
      direction: "desc",
      limit: 20,
    }),
  ]);
  const errorKey = `sheetImport.error.${error}`;
  const errorText =
    typeof error === "string" && error
      ? errorKey in dictionaries.pt
        ? t(errorKey as DictionaryKey)
        : fallbackError(t, error)
      : null;

  return (
    <>
      <PageHeader
        help={{ body: "help.sheetImport.body" }}
        t={t}
        title={t("sheetImport.title")}
        subtitle={t("sheetImport.subtitle")}
        actions={
          <LinkButton href="/app/products">{t("products.title")}</LinkButton>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("sheetImport.form.title")} className="lg:col-span-2">
          <form
            action={importProductSheetAction}
            className="space-y-3"
            data-sheet-import-form
          >
            <Field
              label={t("sheetImport.file")}
              hint={t("sheetImport.fileHint")}
            >
              <input
                type="file"
                name="file"
                required
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-800"
                data-sheet-import-file
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("sheetImport.line")}
                hint={t("sheetImport.lineHint")}
              >
                <Select name="lineId" required defaultValue="">
                  <option value="" disabled>
                    {t("common.select")}
                  </option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("sheetImport.currency")}
                hint={t("sheetImport.currencyHint")}
              >
                <Select name="currency" defaultValue="USD">
                  {SHEET_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label={t("sheetImport.prefix")}
              hint={t("sheetImport.prefixHint")}
            >
              <Input
                name="namePrefix"
                maxLength={60}
                placeholder={t("sheetImport.prefixPlaceholder")}
                data-sheet-import-prefix
              />
            </Field>
            <SubmitButton
              pendingText={t("sheetImport.pending")}
              data-sheet-import-submit
            >
              {t("sheetImport.submit")}
            </SubmitButton>
          </form>
        </Card>
        <Card title={t("sheetImport.how.title")}>
          <p className="text-sm text-zinc-700">{t("sheetImport.how.body")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
            <li>{t("sheetImport.how.columns")}</li>
            <li>{t("sheetImport.how.groups")}</li>
            <li>{t("sheetImport.how.photos")}</li>
            <li>{t("sheetImport.how.supplier")}</li>
            <li>{t("sheetImport.how.missing")}</li>
          </ul>
        </Card>
      </div>
      <Card title={t("sheetImport.previous")} className="mt-4">
        {batches.length === 0 ? (
          <Empty>{t("sheetImport.previous.empty")}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {batches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0 flex-1 truncate">
                  <TextLink href={`/app/products/import/${b.id}`}>
                    {b.fileName}
                  </TextLink>
                  <span className="ml-2 text-zinc-500">
                    {formatDate(b.createdAt, t.locale)}
                  </span>
                </span>
                <span className="text-xs text-zinc-600">
                  {t("sheetImport.previous.line", {
                    created: b.summary?.created ?? 0,
                    updated: b.summary?.updated ?? 0,
                    errors: b.summary?.errors ?? 0,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
