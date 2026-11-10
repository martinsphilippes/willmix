import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { SHEET_CURRENCIES } from "@/lib/db";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import {
  Alert,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SheetFileInput } from "@/components/sheet-file-input";
import { importBookingAction } from "../../actions/booking-lots";

/*
 * Importar booking (docs/BOOKING.md, "Booking por planilha"): a planilha de
 * um fornecedor vira um booking em rascunho, com os itens. Nenhum produto do
 * cadastro é criado. Erros de leitura usam os textos da ficha técnica (o
 * leitor é o mesmo).
 */
export default async function BookingImportPage({
  searchParams,
}: PageProps<"/app/booking/import">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/booking/import");
  requireScreen(user, "booking");
  const { error } = await searchParams;
  const t = await getT();
  const code = typeof error === "string" ? error : "";
  const known = [`bookingLots.error.${code}`, `sheetImport.error.${code}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !code ? null : known ? t(known) : fallbackError(t, code);

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingLots.import.title")}
        subtitle={t("bookingLots.import.subtitle")}
        actions={
          <LinkButton href="/app/booking">
            {t("bookingLots.backToList")}
          </LinkButton>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("bookingLots.import.form")} className="lg:col-span-2">
          <form
            action={importBookingAction}
            className="space-y-3"
            data-booking-import-form
          >
            <Field
              label={t("bookingLots.import.file")}
              hint={t("bookingLots.import.fileHint")}
            >
              <SheetFileInput
                label={t("bookingLots.import.file")}
                uploadingLabel={t("sheetImport.uploading")}
                failedLabel={t("sheetImport.uploadFailed")}
                chosenLabel={t("sheetImport.uploaded")}
                required={false}
              />
            </Field>
            <Field label={t("sheetImport.url")} hint={t("sheetImport.urlHint")}>
              <Input
                name="sheetUrl"
                type="url"
                inputMode="url"
                placeholder={t("sheetImport.urlPlaceholder")}
                maxLength={600}
              />
            </Field>
            <Field
              label={t("bookingLots.import.currency")}
              hint={t("bookingLots.import.currencyHint")}
            >
              <Select name="currency" defaultValue="USD">
                {SHEET_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton
              pendingText={t("bookingLots.import.submitting")}
              data-booking-import-submit
            >
              {t("bookingLots.import.submit")}
            </SubmitButton>
          </form>
        </Card>
        <Card title={t("bookingLots.import.columns.title")}>
          <div className="space-y-2 text-sm text-zinc-700">
            <p>{t("bookingLots.import.columns.body")}</p>
            <p className="text-zinc-600">
              {t("bookingLots.import.columns.extra")}
            </p>
            <p className="text-zinc-600">{t("bookingLots.import.after")}</p>
          </div>
        </Card>
      </div>
    </>
  );
}
