import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  Select,
  TextLink,
  Textarea,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import { TRADE_ACTIVITY_STATUSES } from "@/lib/db/schema";
import { loadPortfolio } from "@/lib/services/portfolio";
import {
  MAX_EVIDENCE_FILES,
  isOpenStatus,
  loadTradeActivity,
} from "@/lib/services/trade-plan";
import {
  setTradeActivityStatusAction,
  updateTradeActivityAction,
} from "../../../actions/trade-plan";
import {
  currentTime,
  dateBr,
  dateTimeBr,
  portfolioError,
} from "../../_components/shared";
import { TradeStatus } from "../_components/activity-list";

/*
 * Uma ação do Plano de ação Trade (docs/TRADE_COMERCIAL.md, PR 2): o que é, de
 * quem é e o prazo; a situação com a resposta e as evidências (o responsável
 * ou quem gere a carteira); e a edição (quem gere, enquanto aberta).
 */

export default async function TradeActivityPage({
  params,
  searchParams,
}: PageProps<"/app/portfolio/plan/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  const t = await getT();
  const { id } = await params;
  const sp = await searchParams;
  const now = currentTime();
  const view = await loadTradeActivity(user, id, now);
  if (!view) notFound();
  const { row } = view;
  const errorText = portfolioError(t, sp.error);
  const notice = sp.created
    ? t("tradePlan.notice.created")
    : sp.saved
      ? t("tradePlan.notice.saved")
      : sp.status
        ? t("tradePlan.notice.status")
        : null;
  const open = isOpenStatus(row.status);
  const statuses = TRADE_ACTIVITY_STATUSES.filter(
    (s) => s !== "cancelled" || view.canManage,
  );
  const scopeHref = row.customerId
    ? `/app/portfolio/${row.customerId}`
    : view.canManage && row.groupId
      ? `/app/portfolio/groups/${row.groupId}`
      : null;
  const customers =
    view.canManage && open
      ? (await loadPortfolio(user, {}, now)).rows.map((r) => ({
          id: r.customerId,
          name: r.name,
          code: r.code,
        }))
      : [];
  if (
    row.customerId &&
    !customers.some((c) => c.id === row.customerId) &&
    view.canManage
  )
    customers.unshift({ id: row.customerId, name: row.scopeName, code: null });

  return (
    <>
      <PageHeader
        title={row.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {scopeHref ? (
              <TextLink href={scopeHref}>{row.scopeName}</TextLink>
            ) : (
              <span>{row.scopeName}</span>
            )}
            <TradeStatus t={t} row={row} />
          </span>
        }
        actions={
          <TextLink href="/app/portfolio/plan">{t("tradePlan.back")}</TextLink>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3" data-trade-notice>
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card dense title={t("tradePlan.col.title")}>
            <DescriptionList
              items={[
                [t("tradePlan.col.responsible"), row.responsibleName ?? "—"],
                [t("tradePlan.col.due"), dateBr(t, row.dueDate)],
                ...(row.productName
                  ? ([
                      [
                        t("tradePlan.field.product"),
                        [row.productCode, row.productName]
                          .filter(Boolean)
                          .join(" · "),
                      ],
                    ] as Array<[string, string]>)
                  : []),
                [
                  t("tradePlan.col.status"),
                  row.doneAt
                    ? t("tradePlan.doneBy", { date: dateTimeBr(t, row.doneAt) })
                    : t(`tradePlan.status.${row.status}` as DictionaryKey),
                ],
              ]}
            />
            {row.description ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("tradePlan.detail.description")}
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-800">
                  {row.description}
                </p>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-zinc-500">
              {t("tradePlan.detail.created", {
                name: view.createdByName ?? "—",
                date: dateTimeBr(t, row.createdAt),
              })}
            </p>
          </Card>

          {view.canManage && open ? (
            <Card dense title={t("tradePlan.edit.title")}>
              <form
                action={updateTradeActivityAction}
                className="grid gap-3"
                id="edit"
                data-trade-edit
              >
                <input type="hidden" name="activityId" value={row.id} />
                <Field label={t("tradePlan.field.title")}>
                  <Input
                    name="title"
                    required
                    minLength={3}
                    maxLength={200}
                    defaultValue={row.title}
                  />
                </Field>
                <Field label={t("tradePlan.field.description")}>
                  <Textarea
                    name="description"
                    maxLength={4000}
                    defaultValue={row.description ?? ""}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t("tradePlan.field.group")}
                    hint={t("tradePlan.field.scopeHint")}
                  >
                    <Select name="groupId" defaultValue={row.groupId ?? ""}>
                      <option value="">{t("tradePlan.field.none")}</option>
                      {view.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("tradePlan.field.customer")}>
                    <Select
                      name="customerId"
                      defaultValue={row.customerId ?? ""}
                    >
                      <option value="">{t("tradePlan.field.none")}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `${c.name} (${c.code})` : c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("tradePlan.field.responsible")}>
                    <Select
                      name="responsibleUserId"
                      defaultValue={row.responsibleUserId}
                      required
                    >
                      {view.team.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t("tradePlan.field.due")}>
                    <Input
                      type="date"
                      name="dueDate"
                      required
                      defaultValue={row.dueDate}
                    />
                  </Field>
                </div>
                <div>
                  <SubmitButton variant="secondary" data-trade-save>
                    {t("tradePlan.save")}
                  </SubmitButton>
                </div>
              </form>
            </Card>
          ) : null}
        </div>

        <Card dense title={t("tradePlan.update.title")}>
          <div id="status" />
          {view.files.length ? (
            <p className="mb-3 flex flex-wrap gap-x-2 text-xs text-zinc-600">
              <span>{t("tradePlan.files")}:</span>
              {view.files.map((f) => (
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
          {view.canUpdate ? (
            <form
              action={setTradeActivityStatusAction}
              className="grid gap-3"
              data-trade-status-form
            >
              <input type="hidden" name="activityId" value={row.id} />
              <Field label={t("tradePlan.update.status")}>
                <Select name="status" defaultValue={row.status} required>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`tradePlan.status.${s}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("tradePlan.update.notes")}
                hint={t("tradePlan.update.notesHint")}
              >
                <Textarea
                  name="notes"
                  maxLength={4000}
                  defaultValue={row.notes ?? ""}
                />
              </Field>
              {view.files.length < MAX_EVIDENCE_FILES ? (
                <PhotoInput
                  name="files"
                  label={t("tradePlan.update.files")}
                  capture={false}
                  compact
                />
              ) : null}
              <div>
                <SubmitButton data-trade-status-save>
                  {t("tradePlan.update.save")}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <>
              {row.notes ? (
                <p className="mb-2 whitespace-pre-line text-sm text-zinc-800">
                  {row.notes}
                </p>
              ) : null}
              <p className="text-xs text-zinc-500">
                {t("tradePlan.update.readonly")}
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
