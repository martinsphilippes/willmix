import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import {
  SCREEN_GROUPS,
  SCREEN_LABEL,
  WELLMIX_BASE,
  functionScreensFor,
  hasCustomScreens,
  screensFor,
} from "@/lib/auth/screens";
import { DIVISIONS, JOB_LEVELS, WELLMIX_FUNCTIONS } from "@/lib/db/schema";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  Field,
  PageHeader,
  Select,
  TextLink,
  cx,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { descendantsOf, wellmixTeam } from "@/lib/services/team";
import { saveTeamMemberAction } from "../../actions/team";

/*
 * Acessos de uma pessoa da equipe (só o administrador): três blocos, um
 * embaixo do outro. Dados (cargo, divisão, a quem responde); Funções (o que
 * ela faz no processo: aprova, libera dumping, valida numerário…); Telas
 * (todas as telas do portal nos grupos do menu, com uma caixa por tela).
 * "Padrão das funções" segue as funções marcadas; "Personalizado" grava só
 * as caixas marcadas (o básico fica sempre). Regra em docs/ACCESS.md.
 */

export default async function TeamMemberPage({
  params,
  searchParams,
}: PageProps<"/app/team/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "team");
  const t = await getT();
  const { id } = await params;
  const { error } = await searchParams;
  const team = await wellmixTeam();
  const member = team.find((m) => m.id === id);
  if (!member) notFound();
  const below = descendantsOf(member.id, team);
  const admin = isAdmin(member);
  const custom = hasCustomScreens(member);
  const effective = screensFor(member);
  const byFunctions = functionScreensFor(member);
  const errorKey = `team.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string" && error
      ? t(errorKey as DictionaryKey) !== errorKey
        ? t(errorKey as DictionaryKey)
        : t("common.error")
      : null;
  const block = "space-y-3";
  const option = "inline-flex items-start gap-2 text-sm text-zinc-800";

  return (
    <>
      <PageHeader
        t={t}
        title={t("team.person.title", { name: member.name })}
        subtitle={`${t(`role.${member.role}` as DictionaryKey)} · ${member.email}`}
        actions={<TextLink href="/app/team">{t("team.person.back")}</TextLink>}
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <form action={saveTeamMemberAction} className="space-y-4" data-team-form>
        <input type="hidden" name="userId" value={member.id} />

        <Card title={t("team.block.data")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("team.col.level")}>
              <Select name="jobLevel" defaultValue={member.jobLevel ?? ""}>
                <option value="">{t("team.none")}</option>
                {JOB_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`level.${l}` as DictionaryKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("team.col.division")}>
              <Select name="division" defaultValue={member.division ?? ""}>
                <option value="">{t("team.none")}</option>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {t(`division.${d}` as DictionaryKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("team.col.manager")}>
              <Select
                name="managerUserId"
                defaultValue={member.managerUserId ?? ""}
              >
                <option value="">{t("team.none")}</option>
                {team
                  // Nem ela mesma nem quem está abaixo dela (ciclo).
                  .filter((m) => m.id !== member.id && !below.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card title={t("team.block.functions")}>
          <input type="hidden" name="functions.__form" value="1" />
          <div className={cx(block, "grid gap-2 sm:grid-cols-2")}>
            {WELLMIX_FUNCTIONS.map((f) => (
              <label key={f} className={option}>
                <input
                  type="checkbox"
                  name="functions"
                  value={f}
                  defaultChecked={(member.functions ?? []).includes(f)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                  data-team-function={f}
                />
                <span>
                  <span className="font-medium">
                    {t(`function.${f}` as DictionaryKey)}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {t(`function.desc.${f}` as DictionaryKey)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card title={t("team.block.screens")}>
          {admin ? (
            <Alert tone="info">{t("team.screens.adminNote")}</Alert>
          ) : (
            <>
              <input type="hidden" name="screens.__form" value="1" />
              <p className="mb-3 text-xs text-zinc-500">
                {t("team.screens.mode.hint")}
              </p>
              <div className="mb-4 flex flex-wrap gap-4">
                <label className={option}>
                  <input
                    type="radio"
                    name="screensMode"
                    value="default"
                    defaultChecked={!custom}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    data-team-screens-mode="default"
                  />
                  <span>
                    {t("team.screens.mode.default")}
                    <span className="block text-xs text-zinc-500">
                      {[...byFunctions]
                        .filter((s) => !WELLMIX_BASE.includes(s))
                        .map((s) => t(SCREEN_LABEL[s]))
                        .join(", ") || t("team.screens.base")}
                    </span>
                  </span>
                </label>
                <label className={option}>
                  <input
                    type="radio"
                    name="screensMode"
                    value="custom"
                    defaultChecked={custom}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                    data-team-screens-mode="custom"
                  />
                  <span>{t("team.screens.mode.custom")}</span>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {SCREEN_GROUPS.map((group) => (
                  <fieldset
                    key={group.key}
                    className="rounded-xl border border-zinc-200/80 p-3"
                  >
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t(group.key)}
                    </legend>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {group.screens.map((screen) => {
                        const base = WELLMIX_BASE.includes(screen);
                        return (
                          <label key={screen} className={option}>
                            <input
                              type="checkbox"
                              name="screens"
                              value={screen}
                              defaultChecked={effective.has(screen)}
                              disabled={base}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                              data-team-screen={screen}
                            />
                            <span>
                              {t(SCREEN_LABEL[screen])}
                              {base ? (
                                <span className="ml-1 text-xs text-zinc-400">
                                  ({t("team.screens.alwaysOn")})
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton data-team-save>{t("team.save")}</SubmitButton>
          <span className="text-xs text-zinc-500">
            {t("team.screens.saveHint")}
          </span>
        </div>
      </form>
    </>
  );
}
