import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import {
  ADMIN_ONLY,
  SCREEN_GROUPS,
  SCREEN_LABEL,
  WELLMIX_BASE,
  hasCustomScreens,
  screensFor,
} from "@/lib/auth/screens";
import {
  ACTION_GROUPS,
  accessFromFunctions,
  functionLabel,
  type FunctionDef,
} from "@/lib/auth/function-access";
import { getStore, type ProductLine, type User } from "@/lib/db";
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
  cx,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { wellmixTeam } from "@/lib/services/team";
import { loadFunctionDefs } from "@/lib/services/team-functions";
import {
  archiveFunctionAction,
  createFunctionAction,
  createTeamLoginAction,
  distributeUnassignedAction,
  renameFunctionAction,
  resetFunctionAction,
  saveFunctionActionsAction,
  saveFunctionScreensAction,
  setLineDivisionAction,
} from "../actions/team";

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
 */

const TABS = ["team", "functions", "lines"] as const;
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
  const [team, lines, defs] = await Promise.all([
    wellmixTeam(),
    getStore().list("product_lines", {
      filter: { active: true },
      orderBy: "name",
    }),
    loadFunctionDefs(),
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

  const tabLink = (key: Tab, text: string) => (
    <Link
      key={key}
      href={`/app/team?tab=${key}`}
      aria-current={tab === key ? "page" : undefined}
      className={cx(
        "rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition",
        tab === key
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-zinc-500 hover:text-zinc-800",
      )}
      data-team-tab={key}
    >
      {text}
    </Link>
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t("team.title")}
        subtitle={t("team.intro")}
        actions={<TextLink href="/app/sla">{t("nav.sla")}</TextLink>}
      />
      <nav
        aria-label={t("team.title")}
        className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200"
      >
        {tabLink("team", t("team.tab.team"))}
        {tabLink("functions", t("team.tab.functions"))}
        {tabLink("lines", t("team.tab.lines"))}
      </nav>
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
          label={label}
          canCreate={isAdmin(user)}
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
    </>
  );
}

/* ---------------- Equipe ---------------- */

function TeamTab({
  t,
  team,
  defs,
  label,
  canCreate,
  modalOpen,
  modalError,
}: {
  t: Translate;
  team: User[];
  defs: FunctionDef[];
  label: (key: string) => string;
  canCreate: boolean;
  modalOpen: boolean;
  modalError: string | null;
}) {
  const nameOf = (id: string | null | undefined) =>
    (id && team.find((m) => m.id === id)?.name) || t("team.none");
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
  return (
    <>
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
            <LinkButton
              href="/app/team?tab=team&new=1"
              variant="primary"
              data-team-new-user
            >
              + {t("team.newUser")}
            </LinkButton>
          ) : undefined
        }
      >
        <p className="mb-2 text-xs text-zinc-500">{t("team.screens.hint")}</p>
        <Table>
          <thead>
            <tr>
              <Th>{t("team.col.name")}</Th>
              <Th>{t("team.col.level")}</Th>
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
            {team.map((member) => (
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
                </Td>
                <Td className="whitespace-nowrap">
                  {member.jobLevel
                    ? t(`level.${member.jobLevel}` as DictionaryKey)
                    : t("team.none")}
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
  label,
  error,
}: {
  t: Translate;
  team: User[];
  defs: FunctionDef[];
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
  const href = (key: string, v = view) =>
    `/app/team?tab=functions&fn=${encodeURIComponent(key)}&view=${v}`;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <aside className="lg:col-span-2" data-fn-list>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {t("fn.list")}
        </h2>
        <ul className="space-y-1">
          {ordered.map((d) => {
            const active = current?.key === d.key;
            return (
              <li key={d.key}>
                <Link
                  href={href(d.key)}
                  aria-current={active ? "true" : undefined}
                  className={cx(
                    "block rounded-lg border px-3 py-2 text-sm transition",
                    active
                      ? "border-brand-600 bg-brand-50 font-semibold text-brand-800"
                      : "border-zinc-200/80 bg-white text-zinc-800 hover:border-zinc-300",
                    d.archived && "opacity-60",
                  )}
                  data-fn-item={d.key}
                >
                  <span className="block leading-tight">{label(d.key)}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                    {d.archived
                      ? t("fn.archived")
                      : d.builtin
                        ? t("fn.builtin")
                        : t("fn.custom")}{" "}
                    · {membersText(members(d.key))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <form
          action={createFunctionAction}
          className="mt-3 space-y-2 rounded-lg border border-dashed border-zinc-300 p-2"
          data-fn-new
        >
          <Field label={t("fn.new")}>
            <Input
              name="name"
              required
              minLength={2}
              maxLength={60}
              placeholder={t("fn.new.name")}
              dense
            />
          </Field>
          <SubmitButton variant="secondary" className="w-full text-xs">
            {t("fn.new.submit")}
          </SubmitButton>
        </form>
      </aside>

      <section className="min-w-0 lg:col-span-10" data-fn-detail={current?.key}>
        {!current ? (
          <Card>
            <p className="text-sm text-zinc-500">{t("fn.choose")}</p>
          </Card>
        ) : (
          <Card
            title={
              <span className="flex flex-wrap items-center gap-2">
                {label(current.key)}
                <Badge tone={current.archived ? "warning" : "neutral"}>
                  {current.archived
                    ? t("fn.archived")
                    : current.builtin
                      ? t("fn.builtin")
                      : t("fn.custom")}
                </Badge>
              </span>
            }
          >
            {current.builtin ? (
              <p className="mb-3 text-sm text-zinc-600">
                {t(`function.desc.${current.key}` as DictionaryKey)}
              </p>
            ) : null}
            <p className="mb-4 text-xs text-zinc-500">{t("fn.adminNote")}</p>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <form
                action={renameFunctionAction}
                className="flex flex-wrap items-end gap-2"
                data-fn-rename
              >
                <input type="hidden" name="key" value={current.key} />
                <Field
                  label={t("fn.rename")}
                  hint={current.builtin ? t("fn.rename.hint") : undefined}
                >
                  <Input
                    name="name"
                    defaultValue={current.name ?? ""}
                    placeholder={label(current.key)}
                    maxLength={60}
                    dense
                  />
                </Field>
                <SubmitButton variant="secondary" className="text-xs">
                  {t("fn.save")}
                </SubmitButton>
              </form>
              {current.builtin ? (
                <form action={resetFunctionAction} data-fn-reset>
                  <input type="hidden" name="key" value={current.key} />
                  <SubmitButton
                    variant="secondary"
                    className="text-xs"
                    confirmText={t("fn.reset.hint")}
                  >
                    {t("fn.reset")}
                  </SubmitButton>
                </form>
              ) : (
                <form action={archiveFunctionAction} data-fn-archive>
                  <input type="hidden" name="key" value={current.key} />
                  <input
                    type="hidden"
                    name="archived"
                    value={current.archived ? "0" : "1"}
                  />
                  <SubmitButton
                    variant="secondary"
                    className="text-xs"
                    confirmText={
                      current.archived ? undefined : t("fn.archive.hint")
                    }
                  >
                    {current.archived ? t("fn.restore") : t("fn.archive")}
                  </SubmitButton>
                </form>
              )}
            </div>

            <nav className="mb-4 flex gap-1 border-b border-zinc-200">
              {(["screens", "actions"] as const).map((v) => (
                <Link
                  key={v}
                  href={href(current.key, v)}
                  aria-current={view === v ? "page" : undefined}
                  className={cx(
                    "border-b-2 px-3 py-1.5 text-sm font-semibold",
                    view === v
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-zinc-500 hover:text-zinc-800",
                  )}
                  data-fn-view={v}
                >
                  {v === "screens"
                    ? t("fn.view.screens")
                    : t("fn.view.actions")}
                </Link>
              ))}
            </nav>

            {view === "screens" ? (
              <ScreensForm t={t} def={current} />
            ) : (
              <ActionsForm t={t} def={current} />
            )}
          </Card>
        )}
      </section>
    </div>
  );
}

function CheckRow({
  name,
  value,
  checked,
  disabled,
  title,
  note,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  title: ReactNode;
  note?: ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex items-start gap-2 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-sm text-zinc-800",
        disabled && "bg-zinc-50 text-zinc-500",
      )}
    >
      <input
        type="checkbox"
        name={disabled ? undefined : name}
        value={value}
        defaultChecked={checked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
      />
      <span className="min-w-0">
        <span className="block font-medium leading-tight">{title}</span>
        {note ? (
          <span className="mt-0.5 block text-xs text-zinc-500">{note}</span>
        ) : null}
      </span>
    </label>
  );
}

function ScreensForm({ t, def }: { t: Translate; def: FunctionDef }) {
  return (
    <form
      action={saveFunctionScreensAction}
      className="space-y-4"
      data-fn-screens={def.key}
    >
      <input type="hidden" name="key" value={def.key} />
      <p className="text-xs text-zinc-500">{t("fn.screens.hint")}</p>
      {SCREEN_GROUPS.map((group) => (
        <fieldset key={group.key}>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {t(group.key)}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {group.screens.map((s) => {
              // Telas do Início: configuráveis por função (marcadas por
              // padrão; desmarcadas ficam em baseOff).
              const base = WELLMIX_BASE.includes(s);
              return (
                <CheckRow
                  key={s}
                  name="screens"
                  value={s}
                  checked={
                    base ? !def.baseOff.includes(s) : def.screens.includes(s)
                  }
                  title={t(SCREEN_LABEL[s])}
                  note={
                    base
                      ? t("fn.screens.baseDefault")
                      : ADMIN_ONLY.includes(s)
                        ? t("fn.screens.adminOnly")
                        : undefined
                  }
                />
              );
            })}
          </div>
        </fieldset>
      ))}
      <SubmitButton data-fn-save-screens>{t("fn.save")}</SubmitButton>
    </form>
  );
}

function ActionsForm({ t, def }: { t: Translate; def: FunctionDef }) {
  return (
    <form
      action={saveFunctionActionsAction}
      className="space-y-4"
      data-fn-actions={def.key}
    >
      <input type="hidden" name="key" value={def.key} />
      <p className="text-xs text-zinc-500">{t("fn.actions.hint")}</p>
      {ACTION_GROUPS.map((group) => (
        <fieldset key={group.key}>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {t(`action.group.${group.key}` as DictionaryKey)}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.actions.map((a) => (
              <CheckRow
                key={a}
                name="actions"
                value={a}
                checked={(def.actions as string[]).includes(a)}
                title={t(`action.${a}` as DictionaryKey)}
                note={t(`action.desc.${a}` as DictionaryKey)}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <SubmitButton data-fn-save-actions>{t("fn.save")}</SubmitButton>
    </form>
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
