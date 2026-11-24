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
import { InfoTip } from "@/components/info-tip";
import { importBookingAction } from "../../actions/booking-lots";
import { PartnerBookingLaunch } from "../_components/partner-booking";
import {
  BOOK_COMPACT_FIELD,
  BookMetaFields,
  bookIncotermLabels,
} from "../_components/book-meta-fields";
import { BookIncotermFields } from "@/components/book-incoterm-fields";
import {
  bookingItemTypes,
  bookingPartnerOptions,
} from "@/lib/services/booking-lots";
import type { DictionaryKey as PartyKey } from "@/i18n/dictionaries";

/**
 * Botão "Escolher arquivos" compacto, como no desenho: 32 px (40 px no
 * toque), cantos de 10 px e letra média.
 */
const COMPACT_FILE =
  "file:mr-3 file:rounded-[10px] file:px-3.5 file:py-[5px] file:font-medium pointer-coarse:file:py-[9px]";
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
              label={t("bookingLots.import.urlLabelCompact")}
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
            {/* FOB ou EXW (#674, obrigatório na importação) numa linha
                própria, acima da linha do desenho: o seletor estreito e,
                com EXW, o valor ao lado; as dicas abaixo. */}
            <BookIncotermFields
              required
              compact
              fieldClassName={BOOK_COMPACT_FIELD}
              labels={bookIncotermLabels(t)}
            />
            {/* Moeda padrão | Nº da loja | Nome do supplier | Tipo de item
                numa linha (desenho do dono, 24/11/2026): moeda e loja
                estreitas, supplier e tipo dividem o resto. A troca segue a
                largura do card, não a da tela (computador e iPad deitado
                numa linha; celular em duas, com a moeda compacta). Com o
                card largo, a dica da moeda fica sob as três primeiras
                colunas e a do tipo sob o próprio campo; mais estreito, as
                duas ficam abaixo da linha. */}
            <div className="@container">
              <div
                className="grid grid-cols-2 gap-x-3 gap-y-2.5 @[470px]:grid-cols-[110px_110px_minmax(0,1fr)_minmax(0,1fr)] @[590px]:grid-cols-[112px_124px_minmax(0,1fr)_minmax(0,1fr)] @[590px]:gap-x-4"
                data-book-import-row
              >
                <div className="min-w-0 space-y-1">
                  {/* Rótulo fora do <label> do campo: o ⓘ é um botão e o
                      toque nele não pode abrir o seletor de moeda. */}
                  <div className="flex items-center gap-1">
                    <label
                      htmlFor="book-import-currency"
                      className="block text-xs font-medium leading-5 text-zinc-700"
                      data-field-label=""
                    >
                      {t("bookingLots.import.currencyDefault")}
                    </label>
                    <InfoTip label={t("bookingLots.import.currencyInfo")}>
                      {t("bookingLots.import.currencyDefaultHint")}
                    </InfoTip>
                  </div>
                  <Select
                    id="book-import-currency"
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
                </div>
                <BookMetaFields
                  t={t}
                  types={types}
                  layout="inline"
                  itemTypeHintId={ITEM_TYPE_HINT_ID}
                />
                <p
                  id={CURRENCY_HINT_ID}
                  className="col-span-2 text-xs text-zinc-600 @[470px]:col-span-4 @[590px]:col-span-3"
                  data-book-import-currency-hint
                >
                  {t("bookingLots.import.currencyDefaultNote")}
                </p>
                <p
                  id={ITEM_TYPE_HINT_ID}
                  className="col-span-2 -mt-1 text-xs text-zinc-600 @[470px]:col-span-4 @[590px]:col-span-1 @[590px]:mt-0"
                  data-book-import-type-hint
                >
                  {/* Longe do campo (abaixo da linha), a dica diz de qual é. */}
                  <span className="@[590px]:hidden">
                    {t("bookingLots.import.itemTypeHintPrefix")}{" "}
                  </span>
                  {t("bookingLots.import.itemTypeHintCompact")}
                </p>
              </div>
            </div>
            {/* Fornecedor (o Supplier, dono do book): escolhido no cadastro
                ou, se ainda não existe, cadastrado pelo nome (dono,
                24/11/2026). A Fábrica é a da planilha. */}
            <div className="grid gap-3 sm:grid-cols-2" data-book-partner>
              <Field
                label={t("bookWork.partner")}
                hint={t("bookWork.partnerHint")}
              >
                <Select
                  name="partnerId"
                  defaultValue=""
                  className={BOOK_COMPACT_FIELD}
                  data-book-partner-id
                >
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
                  className={BOOK_COMPACT_FIELD}
                  data-book-partner-new
                />
              </Field>
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
