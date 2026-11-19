import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  TextLink,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  canManagePortfolio,
  loadCustomerGroup,
} from "@/lib/services/portfolio";
import {
  addCustomerToGroupAction,
  archiveCustomerGroupAction,
  removeCustomerFromGroupAction,
  updateCustomerGroupAction,
} from "../../../actions/portfolio";
import { customersText, portfolioError } from "../../_components/shared";
import { tradeActivitiesFor } from "@/lib/services/trade-plan";
import { ActivityList } from "../../plan/_components/activity-list";

/*
 * Um grupo econômico (docs/TRADE_COMERCIAL.md): nome, responsável e
 * observação; os clientes do grupo (um grupo por cliente: incluir aqui tira
 * do grupo anterior); arquivar tira o grupo da carteira sem apagar nada.
 */

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim().slice(0, 120) : "";

export default async function PortfolioGroupPage({
  params,
  searchParams,
}: PageProps<"/app/portfolio/groups/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  if (!canManagePortfolio(user)) redirect("/app/portfolio");
  const t = await getT();
  const { id } = await params;
  const sp = await searchParams;
  const find = one(sp.find);
  const view = await loadCustomerGroup(user, id, find);
  if (!view) notFound();
  const activities = await tradeActivitiesFor(user, { groupId: id });
  const { group } = view;
  const errorText = portfolioError(t, sp.error);
  const notice = sp.created
    ? t("portfolio.groups.notice.created")
    : sp.saved
      ? t("portfolio.groups.notice.saved")
      : sp.archived
        ? t("portfolio.groups.notice.archived")
        : sp.restored
          ? t("portfolio.groups.notice.restored")
          : sp.added
            ? t("portfolio.groups.notice.added")
            : sp.removed
              ? t("portfolio.groups.notice.removed")
              : null;
  const archived = !!group.archivedAt;

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{customersText(t, group.customers)}</span>
            {archived ? <Badge>{t("portfolio.groups.archived")}</Badge> : null}
          </span>
        }
        actions={
          <>
            <LinkButton
              href={`/app/portfolio/panel?scope=g:${group.id}`}
              data-portfolio-group-panel
            >
              {t("portfolio.groups.panelLink")}
            </LinkButton>
            <TextLink href="/app/portfolio/groups">
              {`← ${t("portfolio.groups.title")}`}
            </TextLink>
          </>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3" data-portfolio-group-notice>
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card dense title={t("portfolio.groups.edit")}>
          <form
            action={updateCustomerGroupAction}
            className="grid gap-3"
            data-portfolio-group-edit
          >
            <input type="hidden" name="groupId" value={group.id} />
            <Field label={t("portfolio.groups.name")}>
              <Input
                name="name"
                defaultValue={group.name}
                required
                minLength={2}
                maxLength={160}
              />
            </Field>
            <Field label={t("portfolio.groups.owner")}>
              <Select name="ownerUserId" defaultValue={group.ownerUserId ?? ""}>
                <option value="">{t("portfolio.owner.none")}</option>
                {view.team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("portfolio.groups.notes")}>
              <Textarea
                name="notes"
                defaultValue={group.notes ?? ""}
                maxLength={2000}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton data-portfolio-group-save>
                {t("portfolio.groups.save")}
              </SubmitButton>
            </div>
          </form>
          <form action={archiveCustomerGroupAction} className="mt-3">
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="archived" value={archived ? "0" : "1"} />
            <SubmitButton
              variant={archived ? "secondary" : "danger"}
              className="px-2.5 py-1 text-xs"
              confirmText={archived ? undefined : t("portfolio.groups.archive")}
              data-portfolio-group-archive={archived ? "restore" : "archive"}
            >
              {archived
                ? t("portfolio.groups.restore")
                : t("portfolio.groups.archive")}
            </SubmitButton>
          </form>
        </Card>

        <Card dense title={t("portfolio.groups.customers")}>
          <div id="customers" />
          {view.customers.length ? (
            <ul
              className="divide-y divide-zinc-100"
              data-portfolio-group-customers
            >
              {view.customers.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  data-portfolio-group-customer={c.id}
                >
                  <span className="min-w-0">
                    <TextLink href={`/app/portfolio/${c.id}`}>
                      {c.name}
                    </TextLink>
                    {c.code ? (
                      <span className="block text-xs text-zinc-500">
                        {c.code}
                      </span>
                    ) : null}
                  </span>
                  <form action={removeCustomerFromGroupAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="customerId" value={c.id} />
                    <SubmitButton
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      data-portfolio-group-remove
                    >
                      {t("portfolio.groups.remove")}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t("portfolio.groups.noCustomers")}</Empty>
          )}

          {!archived ? (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <form
                action={`/app/portfolio/groups/${group.id}#customers`}
                className="flex flex-wrap items-end gap-2"
                data-portfolio-group-find
              >
                <div className="min-w-0 flex-1 basis-64">
                  <Field
                    label={t("portfolio.groups.add")}
                    hint={t("portfolio.groups.addHint")}
                  >
                    <Input
                      name="find"
                      defaultValue={find}
                      minLength={2}
                      required
                    />
                  </Field>
                </div>
                <Button type="submit" variant="secondary">
                  {t("portfolio.search.submit")}
                </Button>
              </form>
              {find ? (
                view.candidates.length ? (
                  <ul className="mt-2 divide-y divide-zinc-100">
                    {view.candidates.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                        data-portfolio-group-candidate={c.id}
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-zinc-900">
                            {c.name}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            {[c.code, c.taxId].filter(Boolean).join(" · ") ||
                              "—"}
                            {c.otherGroupName
                              ? ` · ${t("portfolio.groups.inOther", { name: c.otherGroupName })}`
                              : ""}
                          </span>
                        </span>
                        {c.inThisGroup ? (
                          <Badge tone="success">
                            {t("portfolio.groups.already")}
                          </Badge>
                        ) : (
                          <form action={addCustomerToGroupAction}>
                            <input
                              type="hidden"
                              name="groupId"
                              value={group.id}
                            />
                            <input
                              type="hidden"
                              name="customerId"
                              value={c.id}
                            />
                            <SubmitButton
                              variant="secondary"
                              className="px-2.5 py-1 text-xs"
                              data-portfolio-group-add
                            >
                              {t("portfolio.groups.add")}
                            </SubmitButton>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    {t("portfolio.search.none")}
                  </p>
                )
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <Card
        className="mt-4"
        dense
        title={t("tradePlan.section.title")}
        actions={
          <span className="flex flex-wrap gap-3 text-xs">
            <TextLink
              href={`/app/portfolio/plan?new=1&newGroup=${group.id}#new`}
              data-trade-new-link
            >
              {t("tradePlan.section.new")}
            </TextLink>
            <TextLink href={`/app/portfolio/plan?group=${group.id}`}>
              {t("tradePlan.section.all")}
            </TextLink>
          </span>
        }
      >
        {activities.length ? (
          <ActivityList t={t} rows={activities} />
        ) : (
          <p className="text-sm text-zinc-500">
            {t("tradePlan.section.emptyGroup")}
          </p>
        )}
      </Card>
    </>
  );
}
