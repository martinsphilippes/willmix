import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Textarea,
  Th,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  canManagePortfolio,
  loadCustomerGroups,
} from "@/lib/services/portfolio";
import { createCustomerGroupAction } from "../../actions/portfolio";
import { portfolioError } from "../_components/shared";

/*
 * Grupos econômicos da carteira (dono, 18/11/2026: "monta a lista na mão";
 * docs/TRADE_COMERCIAL.md): o administrador e quem tem "Gerir carteira e
 * trade" criam o grupo, escolhem o responsável e incluem os clientes.
 */

export default async function PortfolioGroupsPage({
  searchParams,
}: PageProps<"/app/portfolio/groups">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  if (!canManagePortfolio(user)) redirect("/app/portfolio");
  const t = await getT();
  const sp = await searchParams;
  const view = await loadCustomerGroups(user);
  const errorText = portfolioError(t, sp.error);

  const groupTable = (rows: typeof view.active) => (
    <Table>
      <thead>
        <tr>
          <Th>{t("portfolio.groups.name")}</Th>
          <Th>{t("portfolio.groups.owner")}</Th>
          <Th>{t("portfolio.groups.customers")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.id} className={rowClass} data-portfolio-group={g.id}>
            <Td>
              <TextLink href={`/app/portfolio/groups/${g.id}`}>
                {g.name}
              </TextLink>
              {g.notes ? (
                <span className="block text-xs text-zinc-500">{g.notes}</span>
              ) : null}
            </Td>
            <Td>{g.ownerName ?? t("portfolio.owner.none")}</Td>
            <Td>{t("portfolio.groups.count", { n: g.customers })}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );

  return (
    <>
      <PageHeader
        title={t("portfolio.groups.title")}
        subtitle={t("portfolio.groups.subtitle")}
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {view.active.length ? (
            groupTable(view.active)
          ) : (
            <Empty>{t("portfolio.groups.empty")}</Empty>
          )}
          {view.archived.length ? (
            <details className="rounded-xl border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                {t("portfolio.groups.archived")} ({view.archived.length})
              </summary>
              <div className="mt-3">{groupTable(view.archived)}</div>
            </details>
          ) : null}
        </div>
        <Card dense title={t("portfolio.groups.new")}>
          <form
            action={createCustomerGroupAction}
            className="grid gap-3"
            id="new"
            data-portfolio-group-new
          >
            <Field label={t("portfolio.groups.name")}>
              <Input name="name" required minLength={2} maxLength={160} />
            </Field>
            <Field label={t("portfolio.groups.owner")}>
              <Select name="ownerUserId" defaultValue="">
                <option value="">{t("portfolio.owner.none")}</option>
                {view.team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("portfolio.groups.notes")}>
              <Textarea name="notes" maxLength={2000} />
            </Field>
            <div>
              <SubmitButton data-portfolio-group-create>
                {t("portfolio.groups.create")}
              </SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
