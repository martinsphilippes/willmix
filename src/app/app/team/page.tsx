import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { WELLMIX_BASE, hasCustomScreens, screensFor } from "@/lib/auth/screens";
import {
  accessFromFunctions,
  functionDescription,
  functionLabel,
  type FunctionDef,
} from "@/lib/auth/function-access";
import {
  getStore,
  type ProductLine,
  type TeamArea,
  type TeamPosition,
  type User,
} from "@/lib/db";
import { loginLabel } from "@/lib/auth/login-id";
import { DIVISIONS, JOB_LEVELS } from "@/lib/db/schema";
import {
  PORTAL_MIN_PASSWORD,
  suggestPassword,
} from "@/lib/services/portal-access";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Th,
  rowClass,
} from "@/components/ui";
import { listTeamAreas } from "@/lib/services/team-areas";
import { listTeamPositions } from "@/lib/services/team-positions";
import { TeamAreaNav } from "@/components/team-area-nav";
import { SubmitButton } from "@/components/submit-button";
import { wellmixTeam } from "@/lib/services/team";
import { loadFunctionDefs } from "@/lib/services/team-functions";
import { isRetiredAction } from "@/lib/auth/permission-modules";
import {
  createTeamAreaAction,
  createTeamLoginAction,
  createTeamPositionAction,
  distributeUnassignedAction,
  renameTeamAreaAction,
  renameTeamPositionAction,
  setLineDivisionAction,
  setTeamAreaActiveAction,
  setTeamPositionActiveAction,
  setTeamPositionAreaAction,
} from "../actions/team";
import { TeamBulkForm } from "./_components/team-bulk-form";
import { FunctionList } from "./_components/function-list";
import { FunctionPermissions } from "./_components/function-permissions";
import { TeamAccessDrawer } from "./_components/team-access-drawer";
import {
  editorFunctions,
  editorMember,
  editorOptions,
  editorTexts,
  functionScreenMarks,
  permissionGroups,
} from "./_components/access-payload";

/*
 * Equipe (só o administrador), em três abas (docs/ACCESS.md):
 *
 * - Equipe: a equipe interna da Wellmix em linhas (cargo, divisão, chefe,
 *   funções e quantas telas cada login abre), "Editar acessos" de cada pessoa
 *   (/app/team/[id]) e o botão "Novo usuário", que abre o formulário num
 *   modal (?new=1).
 * - Funções e acessos: as funções à esquerda (2/12) e, no resto, a função
 *   escolhida (?fn=) com duas abas: as telas e links que ela abre e as ações
 *   que ela pode fazer dentro das telas. O que não é liberado nem aparece; a
 *   página e as Server Actions recusam. Criar, renomear, voltar ao padrão e
 *   desativar (as criadas).
 * - Linha de produto e divisão: a divisão de cada linha (a solicitação nova
 *   cai no analista da divisão) e a distribuição das pendências.
 * - Áreas (dono, 16/11/2026): as áreas da empresa (Marketing, Comex...),
 *   nova área, renomear, desativar e o cadastro em massa (só as que faltam).
 *   Cada pessoa fica em uma área (coluna "Área" e "Editar acessos").
 * - Cargos (dono, 16/11/2026): Analista Financeiro Jr, Vendedor Sênior...,
 *   cada um em uma área; novo cargo, renomear, mudar a área (quem tem o
 *   cargo vai junto), desativar e o cadastro em massa (a área pode vir na
 *   mesma linha). A pessoa recebe o cargo em "Editar acessos" e a área vem
 *   junto. O campo de antes, de Analista a Diretor, passou a se chamar Nível.
 */

const TABS = ["team", "areas", "positions", "functions", "lines"] as const;
type Tab = (typeof TABS)[number];

export default async function TeamPage({
  searchParams,
}: PageProps<"/app/team">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "team");
  const t = await getT();
  const sp = await searchParams;
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : null;
  const tab: Tab = (TABS as readonly string[]).includes(one("tab") ?? "")
    ? (one("tab") as Tab)
    : "team";
  const saved = one("saved");
  const error = one("error");
  const [team, lines, defs, areas, positions] = await Promise.all([
    wellmixTeam(),
    getStore().list("product_lines", {
      filter: { active: true },
      orderBy: "name",
    }),
    loadFunctionDefs(),
    listTeamAreas(),
    listTeamPositions(),
  ]);
  const errorKey = `team.error.${error ?? ""}`;
  const errorText = error
    ? t(errorKey as DictionaryKey) !== errorKey
      ? t(errorKey as DictionaryKey)
      : t("common.error")
    : null;
  const savedKey = saved
    ? ((
        {
          member: "team.saved.member",
          line: "team.saved.line",
          deleted: "team.saved.deleted",
          area_created: "area.saved.area_created",
          area_renamed: "area.saved.area_renamed",
          area_deactivated: "area.saved.area_deactivated",
          area_activated: "area.saved.area_activated",
          position_created: "position.saved.position_created",
          position_renamed: "position.saved.position_renamed",
          position_area: "position.saved.position_area",
          position_deactivated: "position.saved.position_deactivated",
          position_activated: "position.saved.position_activated",
        } as Record<string, DictionaryKey>
      )[saved] ?? (`fn.saved.${saved}` as DictionaryKey))
    : null;
  const savedText = savedKey && t(savedKey) !== savedKey ? t(savedKey) : null;
  // Resumo de "Excluir acesso": quem passou para o novo chefe, as pendências
  // redistribuídas e as que ficaram sem responsável.
  const count = (key: string) => {
    const value = one(key);
    return value && /^\d{1,6}$/.test(value) ? Number(value) : 0;
  };
  const deleted =
    saved === "deleted"
      ? {
          reports: count("reports"),
          to: team.find((m) => m.id === one("to"))?.name ?? null,
          work: count("work"),
          left: count("left"),
        }
      : null;
  const distributed = one("distributed");
  const distributedCount =
    distributed && /^\d+$/.test(distributed) ? Number(distributed) : null;
  const label = (key: string) =>
    functionLabel(key, defs, (k) => t(k as DictionaryKey));

  return (
    <>
      {/* Equipe Acessos e Parceiros (dono, 15/11/2026): o nome da área no
          título; as seções Equipe, Funções e acessos, Linha de produto e
          divisão e Parceiros (src/components/team-area-nav.tsx). */}
      <PageHeader
        t={t}
        title={t("nav.teamAccess")}
        subtitle={t("team.intro")}
        actions={<TextLink href="/app/sla">{t("nav.sla")}</TextLink>}
      />
      <TeamAreaNav t={t} user={user} active={tab} />
      {errorText && !(tab === "team" && one("new")) ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {savedText ? (
        <div className="mb-3" data-team-saved={saved}>
          <Alert tone="success">
            <span className="block" data-team-saved-text>
              {savedText}
            </span>
            {deleted?.reports && deleted.to ? (
              <span className="mt-1 block" data-team-deleted-reports>
                {t("team.saved.deleted.reports", {
                  n: deleted.reports,
                  name: deleted.to,
                })}
              </span>
            ) : null}
            {deleted?.work ? (
              <span className="mt-1 block" data-team-deleted-work>
                {t("team.saved.deleted.work", { n: deleted.work })}
              </span>
            ) : null}
            {saved === "position_area" && count("moved") ? (
              <span className="mt-1 block" data-position-moved>
                {t("position.saved.moved", { n: count("moved") })}
              </span>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {deleted?.left ? (
        <div className="mb-3" data-team-deleted-left>
          <Alert tone="warning">
            {t("team.saved.deleted.left", { n: deleted.left })}
          </Alert>
        </div>
      ) : null}
      {distributedCount !== null ? (
        <div className="mb-3" data-team-distributed={distributedCount}>
          <Alert tone="success">
            {t("team.distributed", { n: distributedCount })}
          </Alert>
        </div>
      ) : null}

      {tab === "team" ? (
        <TeamTab
          t={t}
          team={team}
          defs={defs}
          areas={areas}
          positions={positions}
          label={label}
          canCreate={isAdmin(user)}
          onlyReview={one("review") === "1"}
          modalOpen={one("new") === "1"}
          modalError={one("new") === "1" ? errorText : null}
        />
      ) : null}
      {tab === "functions" ? (
        <FunctionsTab
          t={t}
          team={team}
          defs={defs}
          label={label}
          selected={one("fn")}
          view={one("view") === "actions" ? "actions" : "screens"}
        />
      ) : null}
      {tab === "lines" ? <LinesTab t={t} lines={lines} /> : null}
      {tab === "areas" ? (
        <AreasTab t={t} team={team} areas={areas} positions={positions} />
      ) : null}
      {tab === "positions" ? (
        <PositionsTab
          t={t}
          team={team}
          areas={areas}
          positions={positions}
          areaFilter={one("area")}
        />
      ) : null}
    </>
  );
}

/* ---------------- Equipe ---------------- */

function TeamTab({
  t,
  team,
  defs,
  areas,
  positions,
  label,
  canCreate,
  onlyReview,
  modalOpen,
  modalError,
}: {
  t: Translate;
  team: User[];
  defs: FunctionDef[];
  areas: TeamArea[];
  positions: TeamPosition[];
  label: (key: string) => string;
  canCreate: boolean;
  /** Só os logins "a conferir" (?review=1). */
  onlyReview: boolean;
  modalOpen: boolean;
  modalError: string | null;
}) {
  const toReview = team.filter((m) => m.reviewNote);
  const shown = onlyReview ? toReview : team;
  const nameOf = (id: string | null | undefined) =>
    (id && team.find((m) => m.id === id)?.name) || t("team.none");
  const areaOf = (id: string | null | undefined) =>
    (id && areas.find((a) => a.id === id)?.name) || t("team.none");
  const positionOf = (id: string | null | undefined) =>
    (id && positions.find((p) => p.id === id)?.name) || t("team.none");
  const accessOf = (m: User) => accessFromFunctions(m.functions, defs);
  // Telas além do básico (as que de fato dependem de função ou de liberação).
  const extraScreens = (m: User) =>
    [...screensFor(m, accessOf(m))].filter((s) => !WELLMIX_BASE.includes(s))
      .length;
  const noFunction = team.filter(
    (m) =>
      !isAdmin(m) &&
      !hasCustomScreens(m) &&
      [...screensFor(m, accessOf(m))].every((s) => WELLMIX_BASE.includes(s)),
  );
  const groups = permissionGroups(t);
  return (
    <>
      {/* Editar acessos em painel lateral, por cima da lista (dono,
          14/11/2026). */}
      <TeamAccessDrawer
        members={team.map((m) => editorMember(m, team, defs))}
        functions={editorFunctions(defs, t)}
        screenGroups={groups.screens}
        actionGroups={groups.actions}
        base={[...WELLMIX_BASE]}
        options={editorOptions(team, t, areas, positions)}
        texts={editorTexts(t)}
        savedText={t("access.savedFor")}
      />
      {noFunction.length > 0 ? (
        <div className="mb-3" data-team-no-function>
          <Alert tone="warning">
            {t("team.noFunction.notice", { n: String(noFunction.length) })}
          </Alert>
        </div>
      ) : null}
      <Card
        title={t("team.members")}
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              {/* Importar da planilha (dono, 16/11/2026). */}
              <LinkButton
                href="/app/team/import"
                variant="secondary"
                data-team-import-open
              >
                {t("teamImport.open")}
              </LinkButton>
              <LinkButton
                href="/app/team?tab=team&new=1"
                variant="primary"
                data-team-new-user
              >
                + {t("team.newUser")}
              </LinkButton>
            </div>
          ) : undefined
        }
      >
        <p className="mb-2 text-xs text-zinc-500">{t("team.screens.hint")}</p>
        {/* "A conferir": os logins com cargo, área ou funções para conferir à mão. */}
        {toReview.length || onlyReview ? (
          <div className="mb-2" data-team-review-filter>
            <Alert tone="warning">
              {onlyReview ? (
                <>
                  {t("team.review.only", { n: toReview.length })}{" "}
                  <TextLink href="/app/team?tab=team">
                    {t("team.review.all")}
                  </TextLink>
                </>
              ) : (
                <>
                  {t("team.review.notice", { n: toReview.length })}{" "}
                  <TextLink href="/app/team?tab=team&review=1">
                    {t("team.review.show")}
                  </TextLink>
                </>
              )}
            </Alert>
          </div>
        ) : null}
        <Table>
          <thead>
            <tr>
              <Th>{t("team.col.name")}</Th>
              <Th>{t("team.col.position")}</Th>
              <Th>{t("team.col.level")}</Th>
              <Th>{t("team.col.area")}</Th>
              <Th>{t("team.col.division")}</Th>
              <Th>{t("team.col.manager")}</Th>
              <Th>{t("team.col.functions")}</Th>
              <Th>{t("team.col.screens")}</Th>
              <Th className="text-right">
                <span className="sr-only">{t("team.edit")}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((member) => (
              <tr
                key={member.id}
                id={`u-${member.id}`}
                className={rowClass}
                data-team-member={member.id}
              >
                <Td>
                  <TextLink
                    href={`/app/team/${member.id}`}
                    className="font-semibold"
                  >
                    {member.name}
                  </TextLink>
                  <div className="text-xs text-zinc-500">
                    {t(`role.${member.role}` as DictionaryKey)} ·{" "}
                    {loginLabel(member.email)}
                  </div>
                  {member.reviewNote ? (
                    <span
                      className="mt-0.5 inline-block"
                      title={member.reviewNote}
                      data-team-member-review={member.id}
                    >
                      <Badge tone="warning">{t("team.review.badge")}</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td
                  className="whitespace-nowrap"
                  data-team-member-position={member.id}
                >
                  {positionOf(member.positionId)}
                </Td>
                <Td className="whitespace-nowrap">
                  {member.jobLevel
                    ? t(`level.${member.jobLevel}` as DictionaryKey)
                    : t("team.none")}
                </Td>
                <Td
                  className="whitespace-nowrap"
                  data-team-member-area={member.id}
                >
                  {areaOf(member.areaId)}
                </Td>
                <Td className="whitespace-nowrap">
                  {member.division
                    ? t(`division.${member.division}` as DictionaryKey)
                    : t("team.none")}
                </Td>
                <Td className="whitespace-nowrap">
                  {nameOf(member.managerUserId)}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {(member.functions ?? []).length ? (
                      (member.functions ?? []).map((f) => (
                        <Badge key={f}>{label(f)}</Badge>
                      ))
                    ) : (
                      <span className="text-zinc-400">{t("team.none")}</span>
                    )}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-zinc-700">
                  <span data-team-screens={member.id}>
                    {isAdmin(member)
                      ? t("team.screens.all")
                      : hasCustomScreens(member)
                        ? t("team.screens.custom", { n: extraScreens(member) })
                        : extraScreens(member) === 0
                          ? t("team.screens.base")
                          : t("team.screens.default", {
                              n: extraScreens(member),
                            })}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <TextLink
                    href={`/app/team/${member.id}`}
                    className="text-xs"
                    data-team-edit={member.id}
                    data-team-open={member.id}
                  >
                    {t("team.edit")}
                  </TextLink>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {canCreate && modalOpen ? (
        <NewUserModal
          t={t}
          team={team}
          defs={defs}
          areas={areas}
          positions={positions}
          label={label}
          error={modalError}
        />
      ) : null}
    </>
  );
}

/** Novo usuário num modal (sem JavaScript: ?new=1 abre, "Fechar" volta à lista). */
function NewUserModal({
  t,
  team,
  defs,
  areas,
  positions,
  label,
  error,
}: {
  t: Translate;
  team: User[];
  defs: FunctionDef[];
  areas: TeamArea[];
  positions: TeamPosition[];
  label: (key: string) => string;
  error: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-user-title"
      data-team-modal
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="new-user-title" className="text-lg font-bold text-zinc-900">
            {t("team.new.title")}
          </h2>
          <TextLink href="/app/team?tab=team" data-team-modal-close>
            {t("team.modal.close")}
          </TextLink>
        </div>
        {error ? (
          <div className="mb-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        <p className="mb-3 text-sm text-zinc-600">{t("team.new.hint")}</p>
        <form
          action={createTeamLoginAction}
          className="space-y-4"
          data-team-new-login
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("team.new.name")}>
              <Input name="name" required minLength={2} maxLength={120} />
            </Field>
            <Field label={t("team.new.login")} hint={t("team.new.login.hint")}>
              <Input
                name="login"
                required
                minLength={3}
                maxLength={254}
                autoComplete="off"
                autoCapitalize="none"
              />
            </Field>
            <Field
              label={t("team.new.password")}
              hint={t("team.new.password.hint", { n: PORTAL_MIN_PASSWORD })}
            >
              <Input
                name="password"
                required
                minLength={PORTAL_MIN_PASSWORD}
                maxLength={128}
                autoComplete="off"
                defaultValue={suggestPassword()}
              />
            </Field>
            <Field label={t("team.new.role")}>
              <Select name="role" defaultValue="operator">
                <option value="operator">{t("team.new.role.operator")}</option>
                <option value="admin">{t("team.new.role.admin")}</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("team.col.level")}>
              <Select name="jobLevel" defaultValue="">
                <option value="">{t("team.none")}</option>
                {JOB_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`level.${l}` as DictionaryKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("team.col.position")}
              hint={t("position.pick.hint")}
            >
              <Select name="positionId" defaultValue="" data-team-new-position>
                <PositionOptions t={t} areas={areas} positions={positions} />
              </Select>
            </Field>
            <Field label={t("team.col.area")}>
              <Select name="areaId" defaultValue="" data-team-new-area>
                <option value="">{t("team.none")}</option>
                {areas
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t("team.col.division")}>
              <Select name="division" defaultValue="">
                <DivisionOptions t={t} />
              </Select>
            </Field>
            <Field label={t("team.col.manager")}>
              <Select name="managerUserId" defaultValue="">
                <option value="">{t("team.none")}</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-zinc-800">
              {t("team.col.functions")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {defs
                .filter((d) => !d.archived)
                .map((d) => (
                  <label
                    key={d.key}
                    className="inline-flex items-start gap-2 text-sm text-zinc-800"
                  >
                    <input
                      type="checkbox"
                      name="functions"
                      value={d.key}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                    />
                    <span>{label(d.key)}</span>
                  </label>
                ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {t("team.new.functions.hint")}
            </p>
          </fieldset>
          <label className="inline-flex items-start gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              name="mustChange"
              defaultChecked
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
            />
            <span>{t("team.new.mustChange")}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>{t("team.new.submit")}</SubmitButton>
            <TextLink href="/app/team?tab=team">
              {t("team.modal.close")}
            </TextLink>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Funções e acessos ---------------- */

function FunctionsTab({
  t,
  team,
  defs,
  label,
  selected,
  view,
}: {
  t: Translate;
  team: User[];
  defs: FunctionDef[];
  label: (key: string) => string;
  selected: string | null;
  view: "screens" | "actions";
}) {
  const ordered = [
    ...defs.filter((d) => !d.archived),
    ...defs.filter((d) => d.archived),
  ];
  const current = defs.find((d) => d.key === selected) ?? ordered[0] ?? null;
  const members = (key: string) =>
    team.filter((m) => (m.functions ?? []).includes(key)).length;
  const membersText = (n: number) =>
    n === 1 ? t("fn.members.one") : t("fn.members.many", { n });
  const kindOf = (d: FunctionDef) =>
    d.archived
      ? t("fn.archived")
      : d.builtin
        ? t("fn.builtin")
        : t("fn.custom");
  const groups = permissionGroups(t);
  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <FunctionList
          items={ordered.map((d) => ({
            key: d.key,
            label: label(d.key),
            meta: `${kindOf(d)} · ${membersText(members(d.key))}`,
            href: `/app/team?tab=functions&fn=${encodeURIComponent(d.key)}`,
            active: current?.key === d.key,
            archived: d.archived,
          }))}
          texts={{
            title: t("fn.list"),
            search: t("fn.searchFunction"),
            none: t("perm.empty"),
            add: t("fn.new"),
            name: t("fn.new.name"),
            create: t("fn.new.submit"),
            cancel: t("common.cancel"),
          }}
        />
      </div>
      <div className="min-w-0 lg:col-span-9">
        {!current ? (
          <Card>
            <p className="text-sm text-zinc-500">{t("fn.choose")}</p>
          </Card>
        ) : (
          <FunctionPermissions
            key={current.key}
            fn={{
              key: current.key,
              label: label(current.key),
              builtin: current.builtin,
              archived: current.archived,
              customName: current.builtin ? current.name : null,
              description: current.builtin
                ? functionDescription(current.key, (k) => t(k as DictionaryKey))
                : null,
              members:
                members(current.key) === 1
                  ? t("fn.membersIn.one")
                  : t("fn.membersIn.many", { n: members(current.key) }),
              kind: kindOf(current),
            }}
            screenGroups={groups.screens}
            actionGroups={groups.actions}
            initialScreens={functionScreenMarks(current)}
            initialActions={current.actions.filter((a) => !isRetiredAction(a))}
            initialView={view}
            texts={{
              screensTab: t("fn.view.screens"),
              actionsTab: t("fn.view.actions"),
              search: t("perm.search"),
              empty: t("perm.empty"),
              count: t("perm.count"),
              save: t("fn.savePermissions"),
              saving: t("access.saving"),
              saved: t("fn.permissionsSaved"),
              dirty: t("access.dirty"),
              menu: t("fn.menu"),
              rename: t("fn.menu.rename"),
              renameLabel: t("fn.new.name"),
              renameHint: t("fn.rename.hint"),
              renameSave: t("fn.menu.renameSave"),
              cancel: t("common.cancel"),
              restoreName: t("fn.menu.restoreName"),
              restoreNameNone: t("fn.menu.restoreNameNone"),
              reset: t("fn.menu.reset"),
              resetConfirm: t("fn.reset.hint"),
              archive: t("fn.archive"),
              archiveConfirm: t("fn.archive.hint"),
              unarchive: t("fn.restore"),
              discard: t("access.discard"),
              screensHint: t("fn.screens.hint"),
              actionsHint: t("fn.actions.hint"),
              adminNote: t("fn.adminNote"),
              intl: t.intl,
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Linha de produto e divisão ---------------- */

function DivisionOptions({ t }: { t: Translate }) {
  return (
    <>
      <option value="">{t("team.none")}</option>
      {DIVISIONS.map((d) => (
        <option key={d} value={d}>
          {t(`division.${d}` as DictionaryKey)}
        </option>
      ))}
    </>
  );
}

function LinesTab({ t, lines }: { t: Translate; lines: ProductLine[] }) {
  return (
    <Card title={t("team.lines")}>
      <div id="lines" className="scroll-mt-4" />
      <p className="mb-2 text-sm text-zinc-600">{t("team.linesIntro")}</p>
      <Table>
        <thead>
          <tr>
            <Th>{t("team.col.line")}</Th>
            <Th>{t("team.col.division")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {lines.map((line) => {
            const formId = `line-${line.id}`;
            return (
              <tr
                key={line.id}
                id={`l-${line.id}`}
                className={rowClass}
                data-team-line={line.id}
              >
                <Td className="font-medium text-zinc-900">{line.name}</Td>
                <Td>
                  <div className="w-32">
                    <Select
                      dense
                      name="division"
                      form={formId}
                      defaultValue={line.division ?? ""}
                      aria-label={`${t("team.col.division")}: ${line.name}`}
                    >
                      <DivisionOptions t={t} />
                    </Select>
                  </div>
                </Td>
                <Td>
                  <form id={formId} action={setLineDivisionAction}>
                    <input type="hidden" name="lineId" value={line.id} />
                    <SubmitButton
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                    >
                      {t("team.save")}
                    </SubmitButton>
                  </form>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <form
        id="distribute"
        action={distributeUnassignedAction}
        className="mt-3 scroll-mt-24"
      >
        <p className="mb-2 text-xs text-zinc-500">{t("team.distributeHint")}</p>
        <SubmitButton variant="secondary" data-team-distribute>
          {t("team.distribute")}
        </SubmitButton>
      </form>
    </Card>
  );
}

/* ---------------- Áreas ---------------- */

function AreasTab({
  t,
  team,
  areas,
  positions,
}: {
  t: Translate;
  team: User[];
  areas: TeamArea[];
  positions: TeamPosition[];
}) {
  const people = (id: string) => team.filter((m) => m.areaId === id).length;
  const positionsIn = (id: string) =>
    positions.filter((p) => p.areaId === id).length;
  const peopleText = (n: number) =>
    n === 0
      ? t("area.people.none")
      : n === 1
        ? t("area.people.one")
        : t("area.people.many", { n });
  const active = areas.filter((a) => a.active).length;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-12" data-team-areas>
      <div className="min-w-0 lg:col-span-7">
        <Card title={t("area.title")}>
          <p className="mb-2 text-sm text-zinc-600">{t("area.intro")}</p>
          {areas.length === 0 ? (
            <p className="text-sm text-zinc-500" data-area-empty>
              {t("area.empty")}
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-zinc-500" data-area-count>
                {t("area.count", { n: areas.length, active })}
              </p>
              <Table paginated={false}>
                <thead>
                  <tr>
                    <Th>{t("area.col.name")}</Th>
                    <Th>{t("area.col.positions")}</Th>
                    <Th>{t("area.col.people")}</Th>
                    <Th>{t("area.col.status")}</Th>
                    <Th className="text-right">
                      <span className="sr-only">{t("area.rename")}</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area) => (
                    <tr
                      key={area.id}
                      id={`a-${area.id}`}
                      className={`${rowClass} scroll-mt-24`}
                      data-area={area.id}
                      data-area-name={area.name}
                      data-area-active={area.active ? "1" : "0"}
                    >
                      <Td className="font-medium text-zinc-900">{area.name}</Td>
                      <Td className="whitespace-nowrap">
                        {positionsIn(area.id) ? (
                          <TextLink
                            href={`/app/team?tab=positions&area=${area.id}`}
                            className="text-sm"
                          >
                            {t("area.positions.count", {
                              n: positionsIn(area.id),
                            })}
                          </TextLink>
                        ) : (
                          <span className="text-zinc-400">
                            {t("team.none")}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {peopleText(people(area.id))}
                      </Td>
                      <Td>
                        {area.active ? (
                          <Badge tone="success">
                            {t("area.status.active")}
                          </Badge>
                        ) : (
                          <Badge>{t("area.status.inactive")}</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="flex flex-wrap items-start justify-end gap-2">
                          <details data-area-rename={area.id}>
                            <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                              {t("area.rename")}
                            </summary>
                            <form
                              action={renameTeamAreaAction}
                              className="mt-2 flex flex-wrap items-center justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="areaId"
                                value={area.id}
                              />
                              <Input
                                dense
                                name="name"
                                defaultValue={area.name}
                                required
                                minLength={2}
                                maxLength={120}
                                autoComplete="off"
                                aria-label={t("area.rename.label", {
                                  name: area.name,
                                })}
                                className="w-48"
                              />
                              <SubmitButton
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                              >
                                {t("area.rename.save")}
                              </SubmitButton>
                            </form>
                          </details>
                          <form action={setTeamAreaActiveAction}>
                            <input
                              type="hidden"
                              name="areaId"
                              value={area.id}
                            />
                            <input
                              type="hidden"
                              name="active"
                              value={area.active ? "0" : "1"}
                            />
                            <SubmitButton
                              variant="secondary"
                              className="px-2.5 py-1 text-xs"
                              data-area-toggle={area.id}
                            >
                              {area.active
                                ? t("area.deactivate")
                                : t("area.activate")}
                            </SubmitButton>
                          </form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="mt-2 text-xs text-zinc-500">
                {t("area.deactivate.hint")}
              </p>
            </>
          )}
        </Card>
      </div>
      <div className="min-w-0 space-y-4 lg:col-span-5">
        <Card title={t("area.new")}>
          <form
            id="area-new"
            action={createTeamAreaAction}
            className="flex scroll-mt-24 flex-wrap items-end gap-2"
            data-area-new
          >
            <div className="min-w-0 flex-1">
              <Field label={t("area.new.name")}>
                <Input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="off"
                />
              </Field>
            </div>
            <SubmitButton>{t("area.new.submit")}</SubmitButton>
          </form>
        </Card>
        <TeamBulkForm
          kind="area"
          texts={{
            title: t("area.bulk.title"),
            hint: t("area.bulk.hint"),
            label: t("area.bulk.label"),
            submit: t("area.bulk.submit"),
          }}
        />
      </div>
    </div>
  );
}

/* ---------------- Cargos ---------------- */

/** As escolhas de cargo, por área (ativos; o desativado só em quem já tem). */
function PositionOptions({
  t,
  areas,
  positions,
  current = null,
}: {
  t: Translate;
  areas: TeamArea[];
  positions: TeamPosition[];
  current?: string | null;
}) {
  const shown = positions.filter((p) => p.active || p.id === current);
  const inArea = (areaId: string | null) =>
    shown.filter((p) => (p.areaId ?? null) === areaId);
  const label = (p: TeamPosition) =>
    p.active ? p.name : `${p.name} ${t("position.inactiveSuffix")}`;
  return (
    <>
      <option value="">{t("team.none")}</option>
      {areas
        .filter((a) => inArea(a.id).length)
        .map((a) => (
          <optgroup key={a.id} label={a.name}>
            {inArea(a.id).map((p) => (
              <option key={p.id} value={p.id}>
                {label(p)}
              </option>
            ))}
          </optgroup>
        ))}
      {inArea(null).length ? (
        <optgroup label={t("position.noArea")}>
          {inArea(null).map((p) => (
            <option key={p.id} value={p.id}>
              {label(p)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}

/** A área de um cargo: as ativas (a desativada só no cargo que já está nela). */
function AreaOptions({
  t,
  areas,
  current = null,
  noneLabel,
}: {
  t: Translate;
  areas: TeamArea[];
  current?: string | null;
  noneLabel?: string;
}) {
  return (
    <>
      <option value="">{noneLabel ?? t("position.noArea")}</option>
      {areas
        .filter((a) => a.active || a.id === current)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.active ? a.name : `${a.name} ${t("area.inactiveSuffix")}`}
          </option>
        ))}
    </>
  );
}

function PositionsTab({
  t,
  team,
  areas,
  positions,
  areaFilter,
}: {
  t: Translate;
  team: User[];
  areas: TeamArea[];
  positions: TeamPosition[];
  areaFilter: string | null;
}) {
  const filter = areas.find((a) => a.id === areaFilter) ?? null;
  const shown = filter
    ? positions.filter((p) => p.areaId === filter.id)
    : positions;
  const people = (id: string) => team.filter((m) => m.positionId === id).length;
  const peopleText = (n: number) =>
    n === 0
      ? t("area.people.none")
      : n === 1
        ? t("area.people.one")
        : t("area.people.many", { n });
  const active = positions.filter((p) => p.active).length;
  const noArea = positions.filter((p) => p.active && !p.areaId).length;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-12" data-team-positions>
      <div className="min-w-0 lg:col-span-8">
        <Card title={t("position.title")}>
          <p className="mb-2 text-sm text-zinc-600">{t("position.intro")}</p>
          {positions.length === 0 ? (
            <p className="text-sm text-zinc-500" data-position-empty>
              {t("position.empty")}
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500" data-position-count>
                  {t("position.count", { n: positions.length, active })}
                </p>
                {/* Filtro por área (sem JavaScript: o endereço guarda a área). */}
                <form
                  action="/app/team"
                  className="flex items-center gap-2"
                  data-position-filter
                >
                  <input type="hidden" name="tab" value="positions" />
                  <Select
                    dense
                    name="area"
                    defaultValue={filter?.id ?? ""}
                    aria-label={t("position.filter")}
                  >
                    <option value="">{t("position.filter.all")}</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    {t("position.filter.apply")}
                  </button>
                </form>
              </div>
              {noArea ? (
                <div className="mb-2" data-position-no-area>
                  <Alert tone="warning">
                    {t("position.noArea.notice", { n: noArea })}
                  </Alert>
                </div>
              ) : null}
              <Table paginated={false}>
                <thead>
                  <tr>
                    <Th>{t("position.col.name")}</Th>
                    <Th>{t("position.col.area")}</Th>
                    <Th>{t("area.col.people")}</Th>
                    <Th>{t("area.col.status")}</Th>
                    <Th className="text-right">
                      <span className="sr-only">{t("area.rename")}</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((position) => {
                    const areaForm = `position-area-${position.id}`;
                    return (
                      <tr
                        key={position.id}
                        id={`p-${position.id}`}
                        className={`${rowClass} scroll-mt-24`}
                        data-position={position.id}
                        data-position-name={position.name}
                        data-position-active={position.active ? "1" : "0"}
                      >
                        <Td className="font-medium text-zinc-900">
                          {position.name}
                        </Td>
                        <Td>
                          {/* A área do cargo na própria linha: escolhe e salva. */}
                          <div className="flex items-center gap-1.5">
                            <div className="w-48">
                              <Select
                                dense
                                name="areaId"
                                form={areaForm}
                                defaultValue={position.areaId ?? ""}
                                aria-label={t("position.area.label", {
                                  name: position.name,
                                })}
                                data-position-area-select={position.id}
                              >
                                <AreaOptions
                                  t={t}
                                  areas={areas}
                                  current={position.areaId}
                                />
                              </Select>
                            </div>
                            <form
                              id={areaForm}
                              action={setTeamPositionAreaAction}
                            >
                              <input
                                type="hidden"
                                name="positionId"
                                value={position.id}
                              />
                              <SubmitButton
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                data-position-area-save={position.id}
                              >
                                {t("team.save")}
                              </SubmitButton>
                            </form>
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {peopleText(people(position.id))}
                        </Td>
                        <Td>
                          {position.active ? (
                            <Badge tone="success">
                              {t("area.status.active")}
                            </Badge>
                          ) : (
                            <Badge>{t("area.status.inactive")}</Badge>
                          )}
                        </Td>
                        <Td className="text-right">
                          <div className="flex flex-wrap items-start justify-end gap-2">
                            <details data-position-rename={position.id}>
                              <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                                {t("area.rename")}
                              </summary>
                              <form
                                action={renameTeamPositionAction}
                                className="mt-2 flex flex-wrap items-center justify-end gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="positionId"
                                  value={position.id}
                                />
                                <Input
                                  dense
                                  name="name"
                                  defaultValue={position.name}
                                  required
                                  minLength={2}
                                  maxLength={120}
                                  autoComplete="off"
                                  aria-label={t("area.rename.label", {
                                    name: position.name,
                                  })}
                                  className="w-48"
                                />
                                <SubmitButton
                                  variant="secondary"
                                  className="px-2.5 py-1 text-xs"
                                >
                                  {t("area.rename.save")}
                                </SubmitButton>
                              </form>
                            </details>
                            <form action={setTeamPositionActiveAction}>
                              <input
                                type="hidden"
                                name="positionId"
                                value={position.id}
                              />
                              <input
                                type="hidden"
                                name="active"
                                value={position.active ? "0" : "1"}
                              />
                              <SubmitButton
                                variant="secondary"
                                className="px-2.5 py-1 text-xs"
                                data-position-toggle={position.id}
                              >
                                {position.active
                                  ? t("area.deactivate")
                                  : t("area.activate")}
                              </SubmitButton>
                            </form>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <p className="mt-2 text-xs text-zinc-500">
                {t("position.deactivate.hint")}
              </p>
            </>
          )}
        </Card>
      </div>
      <div className="min-w-0 space-y-4 lg:col-span-4">
        <Card title={t("position.new")}>
          <form
            id="position-new"
            action={createTeamPositionAction}
            className="scroll-mt-24 space-y-2"
            data-position-new
          >
            <Field label={t("position.new.name")}>
              <Input
                name="name"
                required
                minLength={2}
                maxLength={120}
                autoComplete="off"
              />
            </Field>
            <Field label={t("position.col.area")}>
              <Select name="areaId" defaultValue={filter?.id ?? ""}>
                <AreaOptions t={t} areas={areas} />
              </Select>
            </Field>
            <SubmitButton>{t("position.new.submit")}</SubmitButton>
          </form>
        </Card>
        <TeamBulkForm
          kind="position"
          texts={{
            title: t("position.bulk.title"),
            hint: t("position.bulk.hint"),
            label: t("position.bulk.label"),
            submit: t("position.bulk.submit"),
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-700">
              {t("position.bulk.area")}
            </span>
            <Select
              name="areaId"
              defaultValue={filter?.id ?? ""}
              data-position-bulk-area
            >
              <AreaOptions
                t={t}
                areas={areas}
                noneLabel={t("position.bulk.area.none")}
              />
            </Select>
          </label>
        </TeamBulkForm>
      </div>
    </div>
  );
}
