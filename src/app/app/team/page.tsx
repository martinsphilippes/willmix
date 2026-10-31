import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import {
  SCREEN_LABEL,
  WELLMIX_BASE,
  hasNoFunction,
  screensFor,
} from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { DIVISIONS, JOB_LEVELS, WELLMIX_FUNCTIONS } from "@/lib/db/schema";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Th,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { descendantsOf, wellmixTeam } from "@/lib/services/team";
import {
  distributeUnassignedAction,
  saveTeamMemberAction,
  setLineDivisionAction,
} from "../actions/team";

/*
 * Equipe e divisões (só o administrador): cargo, chefe e divisão de cada
 * login da Wellmix e a divisão de cada linha de produto. A solicitação nova
 * cai sozinha no analista da divisão da linha (o de menos pendências); é o
 * que monta o Painel de SLA (quem vê quem e de quem é cada pendência).
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
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {team.map((member) => {
                const below = descendantsOf(member.id, team);
                const formId = `member-${member.id}`;
                return (
                  <tr
                    key={member.id}
                    id={`u-${member.id}`}
                    className={rowClass}
                    data-team-member={member.id}
                  >
                    <Td>
                      <div className="font-medium text-zinc-900">
                        {member.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {t(`role.${member.role}` as DictionaryKey)} ·{" "}
                        {member.email}
                      </div>
                    </Td>
                    <Td>
                      <Select
                        dense
                        name="jobLevel"
                        form={formId}
                        defaultValue={member.jobLevel ?? ""}
                        aria-label={`${t("team.col.level")}: ${member.name}`}
                      >
                        <option value="">{t("team.none")}</option>
                        {JOB_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {t(`level.${l}` as DictionaryKey)}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        dense
                        name="division"
                        form={formId}
                        defaultValue={member.division ?? ""}
                        aria-label={`${t("team.col.division")}: ${member.name}`}
                      >
                        {divisionOptions}
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        dense
                        name="managerUserId"
                        form={formId}
                        defaultValue={member.managerUserId ?? ""}
                        aria-label={`${t("team.col.manager")}: ${member.name}`}
                      >
                        <option value="">{t("team.none")}</option>
                        {team
                          // Nem ele mesmo nem quem está abaixo dele (ciclo).
                          .filter((m) => m.id !== member.id && !below.has(m.id))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </Select>
                    </Td>
                    <Td>
                      {/* Funções: quem compra, planeja e aprova (aprovação do pré-custo). */}
                      <input
                        type="hidden"
                        name="functions.__form"
                        value="1"
                        form={formId}
                      />
                      <div className="grid min-w-56 grid-cols-2 gap-x-3 gap-y-1">
                        {WELLMIX_FUNCTIONS.map((f) => (
                          <label
                            key={f}
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-700"
                          >
                            <input
                              type="checkbox"
                              name="functions"
                              value={f}
                              form={formId}
                              defaultChecked={(member.functions ?? []).includes(
                                f,
                              )}
                              className="h-4 w-4 accent-brand-600"
                            />
                            {t(`function.${f}` as DictionaryKey)}
                          </label>
                        ))}
                      </div>
                    </Td>
                    <Td
                      className="max-w-60 text-xs text-zinc-600"
                      data-team-screens={member.id}
                    >
                      {/* Telas que o login abre, calculadas das funções (docs/ACCESS.md). */}
                      {isAdmin(member)
                        ? t("team.screens.all")
                        : hasNoFunction(member)
                          ? t("team.screens.base")
                          : [...screensFor(member)]
                              .filter(
                                (screen) => !WELLMIX_BASE.includes(screen),
                              )
                              .map((screen) => t(SCREEN_LABEL[screen]))
                              .join(", ")}
                    </Td>
                    <Td>
                      <form id={formId} action={saveTeamMemberAction}>
                        <input type="hidden" name="userId" value={member.id} />
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
        </Card>

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
