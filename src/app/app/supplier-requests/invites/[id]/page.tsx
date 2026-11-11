import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { getInvite, inviteLate } from "@/lib/services/booking-invites";
import { getStore, SHEET_CURRENCIES } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  LinkButton,
  PageHeader,
  Select,
  formatDate,
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SheetFileInput } from "@/components/sheet-file-input";
import { answerInviteAction } from "../../../actions/booking-invites";

/*
 * Um convite para booking concorrente (docs/BOOKING_INVITES.md): o parceiro
 * vê o item, o que a Wellmix precisa e o prazo, e responde subindo a
 * planilha do booking dele (as mesmas colunas do Booking por planilha).
 */

const STATUS_TONE: Record<string, Tone> = {
  open: "warning",
  answered: "success",
  cancelled: "neutral",
};

export default async function BookingInviteDetailPage({
  params,
  searchParams,
}: PageProps<"/app/supplier-requests/invites/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/app/supplier-requests/invites/${id}`);
  requireScreen(user, "quotes");
  const query = await searchParams;
  const one = (k: string) => {
    const v = query[k];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  const invite = await getInvite(user, id).catch(() => null);
  if (!invite) notFound();
  const wellmix = isWellmix(user);
  const it = invite.item;
  const intl = t.intl;
  const num = (n: number | null | undefined, digits = 2) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString(intl, { maximumFractionDigits: digits });
  const answeredLot = invite.answeredLotId
    ? await getStore().get("booking_lots", invite.answeredLotId)
    : null;
  const error = one("error");
  const errorKey = [
    `bookingInvites.error.${error}`,
    `sheetImport.error.${error}`,
    `common.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingInvites.detail.title", { n: invite.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[invite.status]}>
              {t(`bookingInvites.status.${invite.status}` as DictionaryKey)}
            </Badge>
            {inviteLate(invite) ? (
              <Badge tone="danger">{t("bookingInvites.late")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <LinkButton href="/app/supplier-requests/invites">
            {t("bookingInvites.detail.back")}
          </LinkButton>
        }
      />
      <div className="mb-3 space-y-2">
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {one("answered") ? (
          <Alert tone="success">{t("bookingInvites.detail.answered")}</Alert>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card title={t("bookingInvites.detail.item")} className="lg:col-span-2">
          <div className="flex flex-wrap gap-4">
            {it.photoDocumentId ? (
              // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
              <img
                src={`/api/files/${it.photoDocumentId}`}
                alt=""
                className="h-32 w-32 rounded-lg border border-zinc-200 object-cover"
              />
            ) : null}
            <div className="min-w-60 flex-1">
              <DescriptionList
                items={[
                  [
                    t("bookingInvites.col.item"),
                    it.description ?? it.productName ?? "—",
                  ],
                  [t("bookingInvites.col.code"), it.factoryItemCode ?? "—"],
                  [t("bookingInvites.col.quantity"), num(it.quantity, 0)],
                  [t("bookingInvites.detail.material"), it.material ?? "—"],
                  [
                    t("bookingInvites.detail.size"),
                    [it.lengthCm, it.widthCm, it.heightCm]
                      .map((n) => num(n))
                      .join(" × "),
                  ],
                  [t("bookingInvites.detail.capacity"), num(it.capacityMl, 0)],
                  [t("bookingInvites.detail.package"), it.packageType ?? "—"],
                  [
                    t("bookingInvites.detail.colors"),
                    it.colorAssortment ?? "—",
                  ],
                  [t("bookingInvites.col.due"), formatDate(invite.dueAt, t)],
                ]}
              />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("bookingInvites.detail.message")}
            </h3>
            <p
              className="mt-1 whitespace-pre-wrap text-sm text-zinc-900"
              data-booking-invite-message
            >
              {invite.message ?? t("bookingInvites.detail.messageNone")}
            </p>
          </div>
        </Card>

        <Card title={t("bookingInvites.detail.answer")} dense>
          {invite.status === "answered" ? (
            <p className="text-sm" data-booking-invite-answered>
              {t("bookingInvites.detail.sentLot", {
                n: answeredLot?.number ?? "—",
                date: formatDate(invite.answeredAt, t),
              })}
              {wellmix && answeredLot ? (
                <>
                  {" "}
                  <Link
                    href={`/app/booking/lots/${answeredLot.id}`}
                    className={linkClass}
                  >
                    {t("bookingInvites.invite.openLot")}
                  </Link>
                </>
              ) : null}
            </p>
          ) : invite.status === "cancelled" ? (
            <p className="text-sm text-zinc-500">
              {t("bookingInvites.detail.cancelled")}
            </p>
          ) : (
            <form
              action={answerInviteAction}
              className="space-y-3"
              data-booking-invite-answer-form
            >
              <input type="hidden" name="inviteId" value={invite.id} />
              <p className="text-xs text-zinc-500">
                {t("bookingInvites.detail.answerHint")}
              </p>
              <Field label={t("bookingLots.import.file")}>
                <SheetFileInput
                  label={t("bookingLots.import.file")}
                  uploadingLabel={t("sheetImport.uploading")}
                  failedLabel={t("sheetImport.uploadFailed")}
                  chosenLabel={t("sheetImport.uploaded")}
                  required={false}
                />
              </Field>
              <Field label={t("bookingLots.import.currency")}>
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
                data-booking-invite-answer-submit
              >
                {t("bookingInvites.detail.submit")}
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
