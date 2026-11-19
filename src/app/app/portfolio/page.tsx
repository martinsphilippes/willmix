import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
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
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  rowClass,
} from "@/components/ui";
import {
  STANDINGS,
  loadPortfolio,
  searchPortfolioCustomers,
  type Standing,
} from "@/lib/services/portfolio";
import {
  STANDING_TONE,
  dateBr,
  daysText,
  portfolioError,
} from "./_components/shared";

/*
 * Carteira e atendimento (dono, 18/11/2026; docs/TRADE_COMERCIAL.md): os
 * clientes acompanhados (num grupo econômico ou com responsável escolhido),
 * os dias sem atendimento confirmado pelos dois lados e a situação pelo
 * prazo único das Configurações. Quem gere a carteira vê todos; os outros, a
 * própria carteira e a da equipe abaixo deles. A busca abre qualquer cliente
 * para registrar um atendimento.
 */

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim().slice(0, 120) : "";

const isStanding = (v: string): v is Standing =>
  (STANDINGS as readonly string[]).includes(v);

function portfolioHref(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/app/portfolio?${qs}` : "/app/portfolio";
}

export default async function PortfolioPage({
  searchParams,
}: PageProps<"/app/portfolio">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "portfolio");
  const t = await getT();
  const sp = await searchParams;
  const owner = one(sp.owner);
  const group = one(sp.group);
  const rawStatus = one(sp.status);
  const status = isStanding(rawStatus) ? rawStatus : undefined;
  const q = one(sp.q);
  const find = one(sp.find);
  const [view, found] = await Promise.all([
    loadPortfolio(user, {
      ownerId: owner || undefined,
      groupId: group || undefined,
      status,
      q: q || undefined,
    }),
    find ? searchPortfolioCustomers(user, find) : Promise.resolve([]),
  ]);
  const errorText = portfolioError(t, sp.error);
  const filtered = !!(owner || group || status || q);
  const base = { owner, group, q };

  return (
    <>
      <PageHeader
        title={t("portfolio.title")}
        subtitle={t("portfolio.subtitle", { days: view.slaDays })}
        actions={
          <>
            <LinkButton href="/app/portfolio/panel" data-portfolio-panel-link>
              {t("nav.salesPanel")}
            </LinkButton>
            {view.canManage ? (
              <LinkButton
                href="/app/portfolio/groups"
                data-portfolio-groups-link
              >
                {t("portfolio.groups.link")}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STANDINGS.map((s) => (
          <Stat
            key={s}
            compact
            label={t(`portfolio.status.${s}` as DictionaryKey)}
            value={<span data-portfolio-count={s}>{view.counts[s]}</span>}
            tone={
              s === "overdue" ? "danger" : s === "never" ? "warning" : "neutral"
            }
            active={status === s}
            href={portfolioHref({ ...base, status: status === s ? "" : s })}
          />
        ))}
      </div>

      <form
        action="/app/portfolio"
        className="mb-3 grid gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end"
        data-portfolio-filters
      >
        <Field label={t("portfolio.filter.owner")}>
          <Select name="owner" defaultValue={owner}>
            <option value="">{t("portfolio.filter.all")}</option>
            <option value="none">{t("portfolio.owner.none")}</option>
            {view.owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("portfolio.filter.group")}>
          <Select name="group" defaultValue={group}>
            <option value="">{t("portfolio.filter.all")}</option>
            {view.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("portfolio.filter.status")}>
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">{t("portfolio.filter.all")}</option>
            {STANDINGS.map((s) => (
              <option key={s} value={s}>
                {t(`portfolio.status.${s}` as DictionaryKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("portfolio.filter.search")}>
          <Input name="q" defaultValue={q} />
        </Field>
        <Button type="submit" variant="secondary">
          {t("portfolio.filter.apply")}
        </Button>
      </form>

      {view.rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("portfolio.col.customer")}</Th>
              <Th>{t("portfolio.col.group")}</Th>
              <Th>{t("portfolio.col.owner")}</Th>
              <Th>{t("portfolio.col.last")}</Th>
              <Th>{t("portfolio.col.days")}</Th>
              <Th>{t("portfolio.col.lastPurchase")}</Th>
              <Th>{t("portfolio.col.status")}</Th>
              <Th>{t("portfolio.col.pending")}</Th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr
                key={r.customerId}
                className={rowClass}
                data-portfolio-row={r.customerId}
              >
                <Td>
                  <TextLink href={`/app/portfolio/${r.customerId}`}>
                    {r.name}
                  </TextLink>
                  {r.code ? (
                    <span className="block text-xs text-zinc-500">
                      {r.code}
                    </span>
                  ) : null}
                  {/* Celular: a situação junto do nome (a tabela rola para o lado). */}
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500 sm:hidden">
                    <Badge tone={STANDING_TONE[r.status]}>
                      {t(`portfolio.status.${r.status}` as DictionaryKey)}
                    </Badge>
                    {r.days !== null ? (
                      <span>{daysText(t, r.days)}</span>
                    ) : null}
                  </span>
                </Td>
                <Td>{r.groupName ?? "—"}</Td>
                <Td>
                  {r.ownerName ?? (
                    <span className="text-zinc-500">
                      {t("portfolio.owner.none")}
                    </span>
                  )}
                  {r.ownerSource ? (
                    <span className="block text-xs text-zinc-500">
                      {t(
                        `portfolio.owner.source.${r.ownerSource}` as DictionaryKey,
                      )}
                    </span>
                  ) : null}
                </Td>
                <Td>{dateBr(t, r.lastConfirmedAt)}</Td>
                <Td>{r.days ?? "—"}</Td>
                <Td>
                  {r.lastPurchaseDate ? (
                    <>
                      {dateBr(t, r.lastPurchaseDate)}
                      <span className="block text-xs text-zinc-500">
                        {t("portfolio.daysSince", {
                          n: r.daysWithoutPurchase ?? 0,
                        })}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <span data-portfolio-status={r.status}>
                    <Badge tone={STANDING_TONE[r.status]}>
                      {t(`portfolio.status.${r.status}` as DictionaryKey)}
                    </Badge>
                  </span>
                </Td>
                <Td>
                  {r.pending ? t("portfolio.pending", { n: r.pending }) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>
          {filtered ? t("portfolio.emptyFilter") : t("portfolio.empty")}
        </Empty>
      )}

      <Card className="mt-5" title={t("portfolio.search.title")} dense>
        <form
          action="/app/portfolio#search"
          className="flex flex-wrap items-end gap-2"
          id="search"
          data-portfolio-search
        >
          <div className="min-w-0 flex-1 basis-64">
            <Field label={t("portfolio.search.hint")}>
              <Input name="find" defaultValue={find} minLength={2} required />
            </Field>
          </div>
          <Button type="submit" variant="secondary">
            {t("portfolio.search.submit")}
          </Button>
        </form>
        {find ? (
          found.length ? (
            <ul className="mt-3 divide-y divide-zinc-100" data-portfolio-found>
              {found.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  data-portfolio-found-row={c.id}
                >
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-900">{c.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {[c.code, c.taxId].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <LinkButton
                    href={`/app/portfolio/${c.id}#register`}
                    className="px-2.5 py-1 text-xs"
                  >
                    {t("portfolio.search.open")}
                  </LinkButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              {t("portfolio.search.none")}
            </p>
          )
        ) : null}
      </Card>
    </>
  );
}
