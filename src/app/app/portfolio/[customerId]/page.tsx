import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  Select,
  TextLink,
  Textarea,
  linkClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { ATTENDANCE_CHANNELS, type AttendanceStatus } from "@/lib/db/schema";
import {
  MAX_BACKDATE_DAYS,
  loadPortfolioCustomer,
} from "@/lib/services/portfolio";
import {
  cancelAttendanceAction,
  registerAttendanceAction,
  renewAttendanceLinkAction,
  saveCustomerPortfolioAction,
} from "../../actions/portfolio";
import { CopyLink } from "../_components/copy-link";
import {
  STANDING_TONE,
  brasiliaLocal,
  currentTime,
  dateBr,
  dateTimeBr,
  portfolioError,
} from "../_components/shared";

/*
 * O cliente na carteira (dono, 18/11/2026; docs/TRADE_COMERCIAL.md): a
 * situação pelo último atendimento confirmado pelos dois lados, a carteira
 * (grupo e responsável, para quem gere), o registro do atendimento por quem
 * atendeu e o histórico, com o link para o cliente confirmar sem login.
 */

const ATT_TONE: Record<AttendanceStatus, Tone> = {
  pending_customer: "warning",
  confirmed: "success",
  disputed: "danger",
  cancelled: "neutral",
};

export default async function PortfolioCustomerPage({
  params,
  searchParams,
}: PageProps<"/app/portfolio/[customerId]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  const t = await getT();
  const { customerId } = await params;
  const sp = await searchParams;
  const now = currentTime();
  const view = await loadPortfolioCustomer(user, customerId, now);
  if (!view) notFound();
  const { customer, row } = view;
  const errorText = portfolioError(t, sp.error);
  const nowIso = now.toISOString();
  const maxLocal = brasiliaLocal(now);
  const minLocal = brasiliaLocal(
    new Date(now.getTime() - MAX_BACKDATE_DAYS * 86_400_000),
  );
  const notice =
    typeof sp.registered === "string"
      ? t("portfolio.notice.registered")
      : typeof sp.renewed === "string"
        ? t("portfolio.notice.renewed")
        : sp.cancelled
          ? t("portfolio.notice.cancelled")
          : sp.saved
            ? t("portfolio.notice.saved")
            : null;

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {customer.sankhyaCode ? <span>{customer.sankhyaCode}</span> : null}
            <span data-portfolio-standing={row.status}>
              <Badge tone={STANDING_TONE[row.status]}>
                {t(`portfolio.status.${row.status}` as DictionaryKey)}
              </Badge>
            </span>
          </span>
        }
        actions={
          <TextLink href="/app/portfolio">
            {t("portfolio.customer.back")}
          </TextLink>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3" data-portfolio-notice>
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {!view.followed ? (
        <div className="mb-3" data-portfolio-not-followed>
          <Alert tone="warning">{t("portfolio.customer.notFollowed")}</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <Card dense title={t("portfolio.col.status")}>
            <DescriptionList
              items={[
                [
                  t("portfolio.customer.last"),
                  row.lastConfirmedAt ? (
                    <span>
                      {dateBr(t, row.lastConfirmedAt)}
                      <span className="block text-xs text-zinc-500">
                        {t("portfolio.customer.days", { n: row.days ?? 0 })}
                      </span>
                    </span>
                  ) : (
                    t("portfolio.customer.never")
                  ),
                ],
                [
                  t("portfolio.customer.dueLabel"),
                  row.dueDay ? dateBr(t, row.dueDay) : "—",
                ],
                [
                  t("portfolio.col.owner"),
                  row.ownerName ? (
                    <span>
                      {row.ownerName}
                      {row.ownerSource ? (
                        <span className="block text-xs text-zinc-500">
                          {t(
                            `portfolio.owner.source.${row.ownerSource}` as DictionaryKey,
                          )}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    t("portfolio.owner.none")
                  ),
                ],
                [
                  t("portfolio.col.group"),
                  row.groupName ?? t("portfolio.manage.groupNone"),
                ],
              ]}
            />
          </Card>

          {view.canManage ? (
            <Card dense title={t("portfolio.manage.title")}>
              <form
                action={saveCustomerPortfolioAction}
                className="grid gap-3"
                id="manage"
                data-portfolio-manage
              >
                <input type="hidden" name="customerId" value={customer.id} />
                <Field label={t("portfolio.manage.group")}>
                  <Select name="groupId" defaultValue={row.groupId ?? ""}>
                    <option value="">{t("portfolio.manage.groupNone")}</option>
                    {view.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("portfolio.manage.owner")}>
                  <Select
                    name="ownerUserId"
                    defaultValue={view.ownerUserId ?? ""}
                  >
                    <option value="">{t("portfolio.manage.ownerRule")}</option>
                    {view.team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <SubmitButton variant="secondary" data-portfolio-manage-save>
                    {t("portfolio.manage.save")}
                  </SubmitButton>
                </div>
              </form>
            </Card>
          ) : null}

          <Card dense title={t("portfolio.register.title")}>
            <form
              action={registerAttendanceAction}
              className="grid gap-3"
              id="register"
              data-portfolio-register
            >
              <input type="hidden" name="customerId" value={customer.id} />
              <p className="text-xs text-zinc-600">
                {t("portfolio.register.hint")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("portfolio.register.channel")}>
                  <Select name="channel" defaultValue="visit" required>
                    {ATTENDANCE_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {t(`portfolio.channel.${c}` as DictionaryKey)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("portfolio.register.when")}>
                  <Input
                    type="datetime-local"
                    name="occurredAt"
                    defaultValue={maxLocal}
                    min={minLocal}
                    max={maxLocal}
                    required
                  />
                </Field>
              </div>
              <Field label={t("portfolio.register.summary")}>
                <Textarea
                  name="summary"
                  required
                  minLength={3}
                  maxLength={4000}
                />
              </Field>
              <Field label={t("portfolio.register.next")}>
                <Textarea name="nextStep" maxLength={2000} />
              </Field>
              <PhotoInput
                name="files"
                label={t("portfolio.register.files")}
                capture={false}
                compact
              />
              <div>
                <SubmitButton data-portfolio-register-submit>
                  {t("portfolio.register.submit")}
                </SubmitButton>
              </div>
            </form>
          </Card>
        </div>

        <Card dense title={t("portfolio.history.title")}>
          <div id="history" />
          {view.attendances.length ? (
            <ul className="space-y-3" data-portfolio-history>
              {view.attendances.map((a) => {
                const expired =
                  a.status === "pending_customer" &&
                  !!a.linkExpiresAt &&
                  a.linkExpiresAt < nowIso;
                const canCancel =
                  a.canAct &&
                  a.status !== "cancelled" &&
                  (a.status !== "confirmed" || view.canManage);
                return (
                  <li
                    key={a.id}
                    id={`att-${a.id}`}
                    className="scroll-mt-24 rounded-xl border border-zinc-200 p-3"
                    data-attendance={a.id}
                    data-attendance-status={a.status}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-zinc-900">
                        {dateTimeBr(t, a.occurredAt)}
                      </span>
                      <Badge>
                        {t(`portfolio.channel.${a.channel}` as DictionaryKey)}
                      </Badge>
                      <Badge tone={ATT_TONE[a.status]}>
                        {t(`portfolio.att.status.${a.status}` as DictionaryKey)}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {t("portfolio.history.by", {
                          name: a.attendedByName ?? "—",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">
                      {a.summary}
                    </p>
                    {a.nextStep ? (
                      <p className="mt-1 whitespace-pre-line text-xs text-zinc-600">
                        {t("portfolio.history.next", { text: a.nextStep })}
                      </p>
                    ) : null}
                    {a.files.length ? (
                      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-600">
                        <span>{t("portfolio.history.files")}:</span>
                        {a.files.map((f) => (
                          <a
                            key={f.id}
                            href={`/api/files/${f.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className={linkClass}
                          >
                            {f.name}
                          </a>
                        ))}
                      </p>
                    ) : null}
                    {a.status === "confirmed" ? (
                      <p className="mt-1 text-xs text-emerald-800">
                        {t("portfolio.att.confirmedBy", {
                          name: a.customerName ?? "—",
                          date: dateTimeBr(t, a.customerAnsweredAt),
                        })}
                      </p>
                    ) : null}
                    {a.status === "disputed" ? (
                      <p className="mt-1 text-xs text-red-800">
                        {t("portfolio.att.disputedBy", {
                          name: a.customerName ?? "—",
                          note: a.customerNote ?? "—",
                        })}
                      </p>
                    ) : null}
                    {a.linkPath && !expired ? (
                      <div
                        className="mt-2 space-y-1 rounded-lg bg-amber-50/70 p-2"
                        data-attendance-link-box
                      >
                        <p className="text-xs font-semibold text-zinc-800">
                          {t("portfolio.link.title")}
                        </p>
                        <CopyLink
                          path={a.linkPath}
                          labels={{
                            copy: t("portfolio.link.copy"),
                            copied: t("portfolio.link.copied"),
                          }}
                        />
                        <p className="text-xs text-zinc-600">
                          {t("portfolio.link.hint", {
                            date: dateTimeBr(t, a.linkExpiresAt),
                          })}
                        </p>
                      </div>
                    ) : null}
                    {a.canAct && expired ? (
                      <p
                        className="mt-2 text-xs text-amber-800"
                        data-attendance-expired
                      >
                        {t("portfolio.link.expired", {
                          date: dateTimeBr(t, a.linkExpiresAt),
                        })}
                      </p>
                    ) : null}
                    {(a.canAct && a.status === "pending_customer") ||
                    canCancel ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {a.canAct && a.status === "pending_customer" ? (
                          <form action={renewAttendanceLinkAction}>
                            <input
                              type="hidden"
                              name="customerId"
                              value={customer.id}
                            />
                            <input
                              type="hidden"
                              name="attendanceId"
                              value={a.id}
                            />
                            <SubmitButton
                              variant="secondary"
                              className="px-2.5 py-1 text-xs"
                              data-attendance-renew
                            >
                              {t("portfolio.link.renew")}
                            </SubmitButton>
                          </form>
                        ) : null}
                        {canCancel ? (
                          <form action={cancelAttendanceAction}>
                            <input
                              type="hidden"
                              name="customerId"
                              value={customer.id}
                            />
                            <input
                              type="hidden"
                              name="attendanceId"
                              value={a.id}
                            />
                            <SubmitButton
                              variant="danger"
                              className="px-2.5 py-1 text-xs"
                              confirmText={t("portfolio.att.cancel")}
                              data-attendance-cancel
                            >
                              {t("portfolio.att.cancel")}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("portfolio.history.empty")}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
