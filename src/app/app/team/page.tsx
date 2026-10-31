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
import { DIVISIONS } from "@/lib/db/schema";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
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
import { wellmixTeam } from "@/lib/services/team";
import {
  distributeUnassignedAction,
  setLineDivisionAction,
} from "../actions/team";

/*
 * Equipe e divisões (só o administrador): a lista da equipe em linhas (cargo,
 * divisão, chefe, funções e quantas telas cada login abre) com "Editar
 * acessos" para a página da pessoa (/app/team/[id]); e a divisão de cada
 * linha de produto. A solicitação nova cai sozinha no analista da divisão da
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
                      {member.email}
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
