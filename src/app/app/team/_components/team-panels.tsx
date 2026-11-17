import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { TeamArea, TeamPosition, User } from "@/lib/db";
import { SCREEN_LABEL, WELLMIX_BASE } from "@/lib/auth/screens";
import type { FunctionDef } from "@/lib/auth/function-access";
import { isRetiredAction } from "@/lib/auth/permission-modules";
import { loginLabel } from "@/lib/auth/login-id";
import {
  directReports,
  levelInversions,
  managerChain,
} from "@/lib/team-hierarchy";
import { Alert, Badge } from "@/components/ui";
import { SidePanel } from "@/components/side-panel";
import { SubmitButton } from "@/components/submit-button";
import { reactivateTeamMemberAction } from "../../actions/access-state";

/*
 * Painéis da Equipe Interna (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa
 * 5), abertos por parâmetro no endereço (?panel=position|area|function|
 * manager&id=…): o detalhe do registro, as pessoas ligadas a ele e os atalhos
 * para gerenciar as telas no escopo e para editar (só o administrador grava;
 * a página e as ações conferem de novo). Fechar volta à lista como estava.
 * O painel da pessoa é o Editar acessos (team-access-drawer.tsx).
 */

const linkClass =
  "font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600";

export interface PanelLinks {
  closeHref: string;
  person: (id: string) => string;
  position: (id: string) => string;
  area: (id: string) => string;
  fn: (key: string) => string;
  manager: (id: string, of?: string) => string;
  screens: (scope: string, id: string) => string;
}

function Section({
  title,
  children,
  ...rest
}: {
  title: ReactNode;
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  return (
    <section className="space-y-2" {...rest}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Status({ t, active }: { t: Translate; active: boolean }) {
  return active ? (
    <Badge tone="success">{t("internalTeam.panel.status.active")}</Badge>
  ) : (
    <Badge>{t("internalTeam.panel.status.inactive")}</Badge>
  );
}

/** As pessoas ligadas ao registro, cada uma abrindo o painel dela. */
function People({
  t,
  people,
  links,
  meta,
}: {
  t: Translate;
  people: User[];
  links: PanelLinks;
  meta?: (member: User) => ReactNode;
}) {
  return (
    <Section
      title={t("internalTeam.panel.people", { n: people.length })}
      data-team-panel-people={String(people.length)}
    >
      {people.length ? (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {people.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
              data-team-panel-person={m.id}
            >
              <Link href={links.person(m.id)} className={linkClass}>
                {m.name}
              </Link>
              <span className="text-xs text-zinc-500">
                {meta ? meta(m) : loginLabel(m.email)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          {t("internalTeam.panel.people.none")}
        </p>
      )}
    </Section>
  );
}

function NotFound({
  t,
  title,
  links,
}: {
  t: Translate;
  title: string;
  links: PanelLinks;
}) {
  return (
    <SidePanel
      title={title}
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      data-team-panel="missing"
    >
      <Alert tone="warning">{t("internalTeam.panel.notFound")}</Alert>
    </SidePanel>
  );
}

/* ------------------------------- Cargo -------------------------------- */

export function PositionPanel({
  t,
  position,
  areas,
  team,
  links,
  admin,
  suggestion = null,
}: {
  t: Translate;
  position: TeamPosition | null;
  areas: TeamArea[];
  team: User[];
  links: PanelLinks;
  admin: boolean;
  /** O que o cargo sugere (D13): funções (nomes) e nível; não libera nada. */
  suggestion?: { functions: string[]; level: string } | null;
}) {
  if (!position)
    return (
      <NotFound t={t} title={t("internalTeam.position.title")} links={links} />
    );
  const area = areas.find((a) => a.id === position.areaId) ?? null;
  const people = team.filter((m) => m.positionId === position.id);
  return (
    <SidePanel
      title={position.name}
      subtitle={t("internalTeam.position.title")}
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      data-team-panel="position"
      data-team-panel-id={position.id}
      footer={
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={links.screens("position", position.id)}
            className={linkClass}
            data-team-panel-screens
          >
            {t("internalTeam.panel.manageScreens")}
          </Link>
          {admin ? (
            <Link
              href={`/app/team?tab=positions#p-${position.id}`}
              className={linkClass}
              data-team-panel-edit
            >
              {t("internalTeam.position.edit")}
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-zinc-500">{t("internalTeam.col.area")}</dt>
          <dd>
            {area ? (
              <Link href={links.area(area.id)} className={linkClass}>
                {area.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-zinc-500">{t("internalTeam.panel.status")}</dt>
          <dd>
            <Status t={t} active={position.active} />
          </dd>
          {suggestion ? (
            <>
              <dt className="text-zinc-500">
                {t("internalTeam.position.suggests")}
              </dt>
              <dd data-team-panel-suggestion>
                {t("internalTeam.position.suggestion", {
                  functions: suggestion.functions.join(", ") || "—",
                  level: suggestion.level,
                })}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="text-xs text-zinc-500">
          {t("internalTeam.position.note")}
        </p>
        <People t={t} people={people} links={links} />
      </div>
    </SidePanel>
  );
}

/* -------------------------------- Área -------------------------------- */

export function AreaPanel({
  t,
  area,
  positions,
  team,
  links,
  admin,
}: {
  t: Translate;
  area: TeamArea | null;
  positions: TeamPosition[];
  team: User[];
  links: PanelLinks;
  admin: boolean;
}) {
  if (!area)
    return (
      <NotFound t={t} title={t("internalTeam.area.title")} links={links} />
    );
  const inArea = positions.filter((p) => p.areaId === area.id);
  const people = team.filter((m) => m.areaId === area.id);
  const positionName = (id: string | null | undefined) =>
    (id && positions.find((p) => p.id === id)?.name) || "—";
  return (
    <SidePanel
      title={area.name}
      subtitle={t("internalTeam.area.title")}
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      data-team-panel="area"
      data-team-panel-id={area.id}
      footer={
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={links.screens("area", area.id)}
            className={linkClass}
            data-team-panel-screens
          >
            {t("internalTeam.panel.manageScreens")}
          </Link>
          {admin ? (
            <Link
              href={`/app/team?tab=areas#a-${area.id}`}
              className={linkClass}
              data-team-panel-edit
            >
              {t("internalTeam.area.edit")}
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-zinc-500">{t("internalTeam.panel.status")}</dt>
          <dd>
            <Status t={t} active={area.active} />
          </dd>
        </dl>
        <p className="text-xs text-zinc-500">{t("internalTeam.area.note")}</p>
        <Section
          title={t("internalTeam.area.positions", { n: inArea.length })}
          data-team-panel-positions={String(inArea.length)}
        >
          {inArea.length ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {inArea.map((p) => (
                <Link
                  key={p.id}
                  href={links.position(p.id)}
                  className={linkClass}
                >
                  {p.active
                    ? p.name
                    : `${p.name} ${t("position.inactiveSuffix")}`}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("internalTeam.area.positions.none")}
            </p>
          )}
        </Section>
        <People
          t={t}
          people={people}
          links={links}
          meta={(m) => positionName(m.positionId)}
        />
      </div>
    </SidePanel>
  );
}

/* ------------------------------- Função ------------------------------- */

export function FunctionPanel({
  t,
  def,
  label,
  description,
  team,
  links,
  admin,
}: {
  t: Translate;
  def: FunctionDef | null;
  label: string;
  description: string | null;
  team: User[];
  links: PanelLinks;
  admin: boolean;
}) {
  if (!def)
    return (
      <NotFound t={t} title={t("internalTeam.function.title")} links={links} />
    );
  const people = team.filter((m) => (m.functions ?? []).includes(def.key));
  const screens = [
    ...WELLMIX_BASE.filter((s) => !def.baseOff.includes(s)),
    ...def.screens.filter((s) => !WELLMIX_BASE.includes(s)),
  ];
  const actions = def.actions.filter((a) => !isRetiredAction(a));
  const kind = def.archived
    ? t("fn.archived")
    : def.builtin
      ? t("fn.builtin")
      : t("fn.custom");
  return (
    <SidePanel
      title={label}
      subtitle={`${t("internalTeam.function.title")} · ${kind}`}
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      data-team-panel="function"
      data-team-panel-id={def.key}
      footer={
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={links.screens("function", def.key)}
            className={linkClass}
            data-team-panel-screens
          >
            {t("internalTeam.panel.manageScreens")}
          </Link>
          {admin ? (
            <Link
              href={`/app/team?tab=functions&fn=${encodeURIComponent(def.key)}`}
              className={linkClass}
              data-team-panel-edit
            >
              {t("internalTeam.function.edit")}
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {description ? (
          <p className="text-sm text-zinc-600">{description}</p>
        ) : null}
        <Section
          title={t("internalTeam.function.screens", { n: screens.length })}
          data-team-panel-fn-screens={String(screens.length)}
        >
          {screens.length ? (
            <div className="flex flex-wrap gap-1.5">
              {screens.map((s) => (
                <Badge key={s}>{t(SCREEN_LABEL[s])}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("internalTeam.function.none")}
            </p>
          )}
          {def.baseOff.length ? (
            <p className="text-xs text-zinc-500">
              {t("internalTeam.function.baseOff", {
                list: def.baseOff.map((s) => t(SCREEN_LABEL[s])).join(", "),
              })}
            </p>
          ) : null}
        </Section>
        <Section
          title={t("internalTeam.function.actions", { n: actions.length })}
          data-team-panel-fn-actions={String(actions.length)}
        >
          {actions.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-zinc-700">
              {actions.map((a) => (
                <li key={a}>{t(`action.${a}` as DictionaryKey)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("internalTeam.function.none")}
            </p>
          )}
        </Section>
        <People t={t} people={people} links={links} />
      </div>
    </SidePanel>
  );
}

/* ----------------------------- Hierarquia ----------------------------- */

export function ManagerPanel({
  t,
  manager,
  member,
  team,
  links,
  admin,
}: {
  t: Translate;
  /** O gestor aberto (null: a pessoa responde a alguém fora da equipe). */
  manager: User | null;
  /** A pessoa da linha (de quem o vínculo é editado). */
  member: User | null;
  team: User[];
  links: PanelLinks;
  admin: boolean;
}) {
  const level = (m: User) =>
    m.jobLevel ? t(`level.${m.jobLevel}` as DictionaryKey) : "—";
  if (!manager) {
    if (!member)
      return (
        <NotFound t={t} title={t("internalTeam.manager.title")} links={links} />
      );
    return (
      <SidePanel
        title={member.name}
        subtitle={t("internalTeam.manager.title")}
        closeHref={links.closeHref}
        closeLabel={t("internalTeam.panel.close")}
        data-team-panel="manager"
        data-team-panel-id={member.id}
      >
        <div className="space-y-3">
          <Alert tone="warning">{t("internalTeam.manager.missing")}</Alert>
          {admin ? (
            <Link href={links.person(member.id)} className={linkClass}>
              {t("internalTeam.manager.edit", { name: member.name })}
            </Link>
          ) : null}
        </div>
      </SidePanel>
    );
  }
  const { chain, cycle, missing } = managerChain(manager.id, team);
  const reports = directReports(manager.id, team);
  const warnings = levelInversions(team).filter(
    (p) => p.manager.id === manager.id,
  );
  return (
    <SidePanel
      title={manager.name}
      subtitle={
        member && member.id !== manager.id
          ? t("internalTeam.manager.of", {
              name: member.name,
              manager: manager.name,
            })
          : t("internalTeam.manager.title")
      }
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      data-team-panel="manager"
      data-team-panel-id={manager.id}
      footer={
        member && admin ? (
          <div className="space-y-1 text-sm">
            <Link
              href={links.person(member.id)}
              className={linkClass}
              data-team-panel-edit
            >
              {t("internalTeam.manager.edit", { name: member.name })}
            </Link>
            <p className="text-xs text-zinc-500">
              {t("internalTeam.manager.editHint")}
            </p>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {warnings.map((w) => (
          <div key={w.member.id} data-team-level-warning={w.member.id}>
            <Alert tone="warning">
              {t("internalTeam.manager.levelWarning", {
                manager: w.manager.name,
                managerLevel: level(w.manager),
                member: w.member.name,
                memberLevel: level(w.member),
              })}
            </Alert>
          </div>
        ))}
        <Section title={t("internalTeam.manager.chain")} data-team-panel-chain>
          <ol className="space-y-1 text-sm">
            <li className="font-semibold text-zinc-900">
              {manager.name}{" "}
              <span className="font-normal text-zinc-500">
                · {level(manager)}
              </span>
            </li>
            {chain.map((m, i) => (
              <li
                key={m.id}
                style={{ paddingLeft: `${(i + 1) * 0.75}rem` }}
                data-team-chain-step={m.id}
              >
                ↑{" "}
                <Link href={links.manager(m.id)} className={linkClass}>
                  {m.name}
                </Link>{" "}
                <span className="text-zinc-500">· {level(m)}</span>
              </li>
            ))}
          </ol>
          {!chain.length && !cycle && !missing ? (
            <p className="text-xs text-zinc-500">
              {t("internalTeam.manager.top")}
            </p>
          ) : null}
          {cycle ? (
            <Alert tone="danger">{t("internalTeam.manager.cycle")}</Alert>
          ) : null}
          {missing ? (
            <Alert tone="warning">{t("internalTeam.manager.missing")}</Alert>
          ) : null}
        </Section>
        <Section
          title={t("internalTeam.manager.reports", { n: reports.length })}
          data-team-panel-reports={String(reports.length)}
        >
          {reports.length ? (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {reports.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                  data-team-report={m.id}
                >
                  <Link href={links.person(m.id)} className={linkClass}>
                    {m.name}
                  </Link>
                  <span className="text-xs text-zinc-500">{level(m)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("internalTeam.manager.reports.none")}
            </p>
          )}
        </Section>
      </div>
    </SidePanel>
  );
}

/* --------------------------- Quem saiu --------------------------- */

/**
 * Quem saiu da equipe (Excluir acesso), com "Reativar" (D8 e R7; só o
 * administrador): volta com as funções e as telas de antes.
 */
export function FormerPanel({
  t,
  former,
  links,
  admin,
  selfHref,
  notice,
}: {
  t: Translate;
  former: User[];
  links: PanelLinks;
  admin: boolean;
  /** O endereço deste painel (a volta do Reativar). */
  selfHref: string;
  notice: string | null;
}) {
  return (
    <SidePanel
      title={t("team.former.title")}
      subtitle={t("internalTeam.nav")}
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      data-team-panel="former"
    >
      <div className="space-y-3">
        {notice ? (
          <div data-team-former-saved>
            <Alert tone="success">{notice}</Alert>
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">{t("team.former.hint")}</p>
        {former.length ? (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {former.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                data-team-former={m.id}
              >
                <span>
                  <span className="font-medium text-zinc-900">{m.name}</span>{" "}
                  <span className="text-xs text-zinc-500">
                    · {loginLabel(m.email)}
                  </span>
                </span>
                {admin ? (
                  <form action={reactivateTeamMemberAction}>
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="back" value={selfHref} />
                    <SubmitButton
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      data-team-former-reactivate={m.id}
                    >
                      {t("team.former.reactivate")}
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{t("team.former.none")}</p>
        )}
        {!admin ? (
          <p className="text-xs text-zinc-500">{t("team.former.adminOnly")}</p>
        ) : null}
      </div>
    </SidePanel>
  );
}
