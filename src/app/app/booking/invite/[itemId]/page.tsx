import { isWellmix } from "@/lib/auth/permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { fallbackError } from "@/i18n/error-text";
import { inviteLate, inviteScreen } from "@/lib/services/booking-invites";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Empty,
  Field,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
  formatDate,
  linkClass,
  rowClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  cancelInviteAction,
  inviteForItemAction,
} from "../../../actions/booking-invites";

/*
 * Convite para booking concorrente de um item (docs/BOOKING_INVITES.md): a
 * Wellmix escolhe fornecedores e tradings; cada um recebe o aviso e a
 * pendência, com o prazo do SLA, e sobe a planilha do booking.
 */

const STATUS_TONE: Record<string, Tone> = {
  open: "warning",
  answered: "success",
  cancelled: "neutral",
};

export default async function BookingInvitePage({
  params,
  searchParams,
}: PageProps<"/app/booking/invite/[itemId]">) {
  const user = await getCurrentUser();
  const { itemId } = await params;
  if (!user) redirect(`/login?next=/app/booking/invite/${itemId}`);
  requireScreen(user, "booking");
  // Só a Wellmix: o login externo com a tela Booking vê só os bookings dele.
  if (!isWellmix(user)) redirect("/app/booking");
  const query = await searchParams;
  const one = (k: string) => {
    const v = query[k];
    return typeof v === "string" ? v : "";
  };
  const t = await getT();
  const screen = await inviteScreen(user, itemId).catch((error: unknown) => {
    if (error instanceof Error && error.message === "schema_outdated")
      return "schema" as const;
    throw error;
  });
  if (screen === "schema")
    return (
      <Alert tone="warning">
        {t("supplierRequests.selection.schemaMissing")}
      </Alert>
    );
  if (!screen) notFound();
  const { item, lot, supplier, partners, invites, slaDays } = screen;
  const partnerName = (id: string) =>
    partners.find((p) => p.id === id)?.name ?? id;
  const openFor = new Set(
    invites.filter((i) => i.status === "open").map((i) => i.partnerId),
  );
  const error = one("error");
  const errorKey = [`bookingInvites.error.${error}`, `common.${error}`].find(
    (k) => k in dictionaries.pt,
  ) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);
  const invited = Number(one("invited")) || 0;
  const label = item.description ?? item.productName ?? "—";

  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingInvites.invite.title")}
        subtitle={label}
        actions={
          <LinkButton href="/app/booking/selection">
            {t("bookingInvites.invite.back")}
          </LinkButton>
        }
      />
      <div className="mb-3 space-y-2">
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {invited ? (
          <Alert tone="success">
            {t("bookingInvites.invite.sent", { n: invited })}
          </Alert>
        ) : null}
        {one("cancelled") ? (
          <Alert tone="success">{t("bookingInvites.invite.cancelled")}</Alert>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <Card title={t("bookingInvites.invite.item")}>
            <div className="flex flex-wrap gap-4">
              {item.photoDocumentId ? (
                // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão
                <img
                  src={`/api/files/${item.photoDocumentId}`}
                  alt=""
                  className="h-28 w-28 rounded-lg border border-zinc-200 object-cover"
                />
              ) : null}
              <div className="min-w-60 flex-1">
                <DescriptionList
                  items={[
                    [t("bookingInvites.col.item"), label],
                    [t("bookingInvites.col.code"), item.factoryItemCode ?? "—"],
                    [
                      t("bookingInvites.col.booking"),
                      <Link
                        key="l"
                        href={`/app/booking/lots/${lot.id}`}
                        className={linkClass}
                      >
                        nº {lot.number}
                        {supplier ? ` · ${supplier.name}` : ""}
                      </Link>,
                    ],
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card title={t("bookingInvites.invite.list")}>
            {invites.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("bookingInvites.col.number")}</Th>
                    <Th>{t("bookingInvites.col.partner")}</Th>
                    <Th>{t("bookingInvites.col.status")}</Th>
                    <Th>{t("bookingInvites.col.due")}</Th>
                    <Th>{t("bookingInvites.col.answer")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr
                      key={i.id}
                      className={rowClass}
                      data-booking-invite-row={i.status}
                    >
                      <Td className="tabular-nums">{i.number}</Td>
                      <Td>{partnerName(i.partnerId)}</Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={STATUS_TONE[i.status]}>
                            {t(
                              `bookingInvites.status.${i.status}` as DictionaryKey,
                            )}
                          </Badge>
                          {inviteLate(i) ? (
                            <Badge tone="danger">
                              {t("bookingInvites.late")}
                            </Badge>
                          ) : null}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDate(i.dueAt, t)}
                      </Td>
                      <Td>
                        {i.answeredLotId ? (
                          <Link
                            href={`/app/booking/lots/${i.answeredLotId}`}
                            className={linkClass}
                            data-booking-invite-lot
                          >
                            {t("bookingInvites.invite.openLot")}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-right">
                        {i.status === "open" ? (
                          <form action={cancelInviteAction}>
                            <input
                              type="hidden"
                              name="itemId"
                              value={item.id}
                            />
                            <input type="hidden" name="inviteId" value={i.id} />
                            <SubmitButton variant="secondary">
                              {t("bookingInvites.invite.cancel")}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty>{t("bookingInvites.invite.none")}</Empty>
            )}
          </Card>
        </div>

        <Card title={t("bookingInvites.invite.form")} dense>
          <form
            action={inviteForItemAction}
            className="space-y-3"
            data-booking-invite-form
          >
            <input type="hidden" name="itemId" value={item.id} />
            <p className="text-xs text-zinc-500">
              {t("bookingInvites.invite.hint", { days: slaDays })}
            </p>
            {partners.length ? (
              <fieldset className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 text-sm">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("bookingInvites.invite.partners")}
                </legend>
                {partners.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2"
                    data-booking-invite-partner={p.id}
                  >
                    <input
                      type="checkbox"
                      name="partnerIds"
                      value={p.id}
                      disabled={openFor.has(p.id)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span>
                      {p.name}{" "}
                      <span className="text-xs text-zinc-500">
                        {t(`party.${p.type}` as DictionaryKey)}
                        {openFor.has(p.id)
                          ? ` · ${t("bookingInvites.invite.already")}`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-sm text-zinc-500">
                {t("bookingInvites.invite.noPartners")}
              </p>
            )}
            <Field label={t("bookingInvites.invite.message")}>
              <Textarea name="message" rows={3} maxLength={4000} />
            </Field>
            <SubmitButton
              pendingText={t("bookingInvites.invite.sending")}
              data-booking-invite-submit
            >
              {t("bookingInvites.invite.submit")}
            </SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
