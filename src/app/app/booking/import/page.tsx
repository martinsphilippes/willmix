import { isWellmix } from "@/lib/auth/permissions";
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
import { PartnerBookingLaunch } from "../_components/partner-booking";
import { BookMetaFields } from "../_components/book-meta-fields";
import {
  bookingItemTypes,
  bookingPartnerOptions,
} from "@/lib/services/booking-lots";
import type { DictionaryKey as PartyKey } from "@/i18n/dictionaries";

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
  // Login externo (Trading): lança o booking dele, num formulário próprio.
  // Quem só consulta a tela (não pode responder por booking) volta à lista.
  if (!isWellmix(user)) {
    const launch = await PartnerBookingLaunch({ user, t, error: code });
    if (!launch) redirect("/app/booking");
    return launch;
  }
  const known = [`bookingLots.error.${code}`, `sheetImport.error.${code}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !code ? null : known ? t(known) : fallbackError(t, code);
  const [types, partners] = await Promise.all([
    bookingItemTypes(),
    bookingPartnerOptions(),
  ]);

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
              hint={`${t("bookingLots.import.fileHint")} ${t("bookWork.import.multiHint")}`}
            >
              <SheetFileInput
                label={t("bookingLots.import.file")}
                uploadingLabel={t("sheetImport.uploading")}
                failedLabel={t("sheetImport.uploadFailed")}
                chosenLabel={t("sheetImport.uploaded")}
                required={false}
                multiple
                countLabel={t("bookWork.import.files")}
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
            <BookMetaFields t={t} types={types} />
            {/* Fornecedor (o Supplier, dono do book): escolhido no cadastro
                ou, se ainda não existe, cadastrado pelo nome (dono,
                24/11/2026). A Fábrica é a da planilha. */}
            <div className="grid gap-3 sm:grid-cols-2" data-book-partner>
              <Field
                label={t("bookWork.partner")}
                hint={t("bookWork.partnerHint")}
              >
                <Select name="partnerId" defaultValue="" data-book-partner-id>
                  <option value="">{t("bookWork.partner.none")}</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[p.name, t(`party.${p.type}` as PartyKey), p.city]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("bookWork.partner.new")}
                hint={t("bookWork.partner.newHint")}
              >
                <Input
                  name="newPartnerName"
                  maxLength={160}
                  autoComplete="off"
                  data-book-partner-new
                />
              </Field>
            </div>
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
