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
import {
  BOOK_COMPACT_FIELD,
  BookMetaFields,
} from "../_components/book-meta-fields";
import { bookingItemTypes } from "@/lib/services/booking-lots";

/** Botão "Escolher arquivos" compacto: 36 px (40 px no toque), cantos de 10 px. */
const COMPACT_FILE =
  "file:mr-3 file:rounded-[10px] file:px-3 file:py-[7px] pointer-coarse:file:py-[9px]";
const CURRENCY_HINT_ID = "book-import-currency-hint";
const ITEM_TYPE_HINT_ID = "book-import-item-type-hint";

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
  const types = await bookingItemTypes();

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
        {/* Card compacto (dono, 24/11/2026; docs/BOOKING.md, "Card Planilha
            do book"): título de 20 px, rótulos de 13 px, campos de 36 px
            (40 px no toque), cantos de 10 px e card de 22 px, e a linha
            Moeda padrão | Nº da loja | Nome do supplier | Tipo de item. Só
            a apresentação: os campos, os nomes e a ação são os de sempre. */}
        <Card
          title={
            <span className="text-xl">{t("bookingLots.import.form")}</span>
          }
          className="rounded-[22px] p-5 sm:p-5 lg:col-span-2 xl:p-6"
        >
          <form
            action={importBookingAction}
            className="space-y-3.5 break-words [&_[data-field-label]]:text-[13px]"
            data-booking-import-form
          >
            <Field
              label={t("bookingLots.import.file")}
              hint={
                <span className="text-zinc-600">
                  {t("bookingLots.import.fileHintCompact")}
                </span>
              }
            >
              <SheetFileInput
                label={t("bookingLots.import.file")}
                uploadingLabel={t("sheetImport.uploading")}
                failedLabel={t("sheetImport.uploadFailed")}
                chosenLabel={t("sheetImport.uploaded")}
                required={false}
                multiple
                countLabel={t("bookWork.import.files")}
                className={COMPACT_FILE}
              />
            </Field>
            <Field
              label={t("sheetImport.url")}
              hint={
                <span className="text-zinc-600">
                  {t("bookingLots.import.urlHintCompact")}
                </span>
              }
            >
              <Input
                name="sheetUrl"
                type="url"
                inputMode="url"
                placeholder={t("sheetImport.urlPlaceholder")}
                maxLength={600}
                className={BOOK_COMPACT_FIELD}
              />
            </Field>
            {/* Os quatro campos numa linha quando o card tem espaço (pela
                largura do card, não da tela: computador e iPad deitado);
                mais estreito, duas linhas, com a moeda sempre compacta. */}
            <div className="@container">
              <div
                className="grid grid-cols-2 gap-3 @[470px]:grid-cols-[minmax(110px,120px)_repeat(3,minmax(108px,130px))]"
                data-book-import-row
              >
                <Field label={t("bookingLots.import.currencyDefault")}>
                  <Select
                    name="currency"
                    defaultValue="USD"
                    aria-describedby={CURRENCY_HINT_ID}
                    className={`${BOOK_COMPACT_FIELD} w-full max-w-[120px]`}
                    data-book-import-currency
                  >
                    {SHEET_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <BookMetaFields
                  t={t}
                  types={types}
                  layout="inline"
                  itemTypeHintId={ITEM_TYPE_HINT_ID}
                />
              </div>
              <div className="mt-1.5 space-y-1 text-xs text-zinc-600">
                <p id={CURRENCY_HINT_ID} data-book-import-currency-hint>
                  <span className="font-medium text-zinc-700">
                    {t("bookingLots.import.currencyDefault")}
                  </span>{" "}
                  · {t("bookingLots.import.currencyDefaultHint")}
                </p>
                <p id={ITEM_TYPE_HINT_ID}>
                  <span className="font-medium text-zinc-700">
                    {t("bookWork.itemType")}
                  </span>{" "}
                  · {t("bookWork.itemTypeHint")}
                </p>
              </div>
            </div>
            <SubmitButton
              pendingText={t("bookingLots.import.submitting")}
              className="h-9 rounded-[10px] px-4 pointer-coarse:h-10"
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
