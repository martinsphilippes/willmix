import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import {
  WELLMIX_BASE,
  hasCustomScreens,
  hasNoFunction,
  screensFor,
} from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { loginLabel } from "@/lib/auth/login-id";
import { DIVISIONS, JOB_LEVELS, WELLMIX_FUNCTIONS } from "@/lib/db/schema";
import {
  PORTAL_MIN_PASSWORD,
  suggestPassword,
} from "@/lib/services/portal-access";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Th,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { wellmixTeam } from "@/lib/services/team";
import {
  createTeamLoginAction,
  distributeUnassignedAction,
  setLineDivisionAction,
} from "../actions/team";

/*
 * Equipe e divisões (só o administrador): a lista da equipe em linhas (cargo,
 * divisão, chefe, funções e quantas telas cada login abre) com "Editar
 * acessos" para a página da pessoa (/app/team/[id]); o formulário "Novo
 * login da equipe" (nome, login, senha e o lugar na hierarquia); e a divisão
 * de cada linha de produto. A solicitação nova cai sozinha no analista da divisão da
 * linha (o de menos pendências); é o que monta o Painel de SLA.
 */

export default async function TeamPage({
  searchParams,
}: PageProps<"/app/team">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "team");
  const t = await getT();
  const { saved, error, distributed } = await searchParams;
  const [team, lines] = await Promise.all([
    wellmixTeam(),
    getStore().list("product_lines", {
      filter: { active: true },
      orderBy: "name",
    }),
  ]);
  const errorKey = `team.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string" && error
      ? t(errorKey as DictionaryKey) !== errorKey
        ? t(errorKey as DictionaryKey)
        : t("common.error")
      : null;
  const savedText =
    saved === "member"
      ? t("team.saved.member")
      : saved === "line"
        ? t("team.saved.line")
        : null;
  const distributedCount =
    typeof distributed === "string" && /^\d+$/.test(distributed)
      ? Number(distributed)
      : null;
  const nameOf = (id: string | null | undefined) =>
    (id && team.find((m) => m.id === id)?.name) || t("team.none");
  // Telas além do básico (as que de fato dependem de função ou de liberação).
  const extraScreens = (member: (typeof team)[number]) =>
    [...screensFor(member)].filter((s) => !WELLMIX_BASE.includes(s)).length;
  const divisionOptions = (
    <>
      <option value="">{t("team.none")}</option>
      {DIVISIONS.map((d) => (
        <option key={d} value={d}>
          {t(`division.${d}` as DictionaryKey)}
        </option>
      ))}
    </>
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t("team.title")}
        subtitle={t("team.intro")}
        actions={<TextLink href="/app/sla">{t("nav.sla")}</TextLink>}
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {savedText ? (
        <div className="mb-3" data-team-saved={saved}>
          <Alert tone="success">{savedText}</Alert>
        </div>
      ) : null}
      {distributedCount !== null ? (
        <div className="mb-3" data-team-distributed={distributedCount}>
          <Alert tone="success">
            {t("team.distributed", { n: distributedCount })}
          </Alert>
        </div>
      ) : null}

      {team.filter(hasNoFunction).length > 0 ? (
        <div className="mb-3" data-team-no-function>
          <Alert tone="warning">
            {t("team.noFunction.notice", {
              n: String(team.filter(hasNoFunction).length),
            })}
          </Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-4">
        <Card title={t("team.members")}>
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
                          <Badge key={f}>
                            {t(`function.${f}` as DictionaryKey)}
                          </Badge>
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
                          ? t("team.screens.custom", {
                              n: extraScreens(member),
                            })
                          : hasNoFunction(member)
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

        {/* Novo login da equipe: só o administrador cria. */}
        {isAdmin(user) ? (
          <Card title={t("team.new.title")}>
            <span id="new-login" className="block scroll-mt-24" />
            <p className="mb-3 text-sm text-zinc-600">{t("team.new.hint")}</p>
            <form
              action={createTeamLoginAction}
              className="space-y-4"
              data-team-new-login
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={t("team.new.name")}>
                  <Input name="name" required minLength={2} maxLength={120} />
                </Field>
                <Field
                  label={t("team.new.login")}
                  hint={t("team.new.login.hint")}
                >
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
                  hint={t("team.new.password.hint", {
                    n: PORTAL_MIN_PASSWORD,
                  })}
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
                    <option value="operator">
                      {t("team.new.role.operator")}
                    </option>
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
                    {divisionOptions}
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
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {WELLMIX_FUNCTIONS.map((f) => (
                    <label
                      key={f}
                      className="inline-flex items-start gap-2 text-sm text-zinc-800"
                    >
                      <input
                        type="checkbox"
                        name="functions"
                        value={f}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span>{t(`function.${f}` as DictionaryKey)}</span>
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
              <div>
                <SubmitButton>{t("team.new.submit")}</SubmitButton>
              </div>
            </form>
          </Card>
        ) : null}

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
                          {divisionOptions}
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
          <form action={distributeUnassignedAction} className="mt-3">
            <p className="mb-2 text-xs text-zinc-500">
              {t("team.distributeHint")}
            </p>
            <SubmitButton variant="secondary" data-team-distribute>
              {t("team.distribute")}
            </SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
