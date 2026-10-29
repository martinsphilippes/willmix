import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { JOB_LEVELS } from "@/lib/db/schema";
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
import { descendantsOf, ownerOf, wellmixTeam } from "@/lib/services/team";
import { saveTeamMemberAction, setCustomerOwnerAction } from "../actions/team";

/*
 * Equipe e carteira (só o administrador): cargo e chefe de cada login da
 * Wellmix e o operador responsável por cada cliente. É o que monta o Painel
 * de SLA (quem vê quem e de quem é cada pendência).
 */

export default async function TeamPage({
  searchParams,
}: PageProps<"/app/team">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isWellmix(user)) redirect("/app");
  if (!isAdmin(user)) redirect("/app/sla");
  const t = await getT();
  const { saved, error } = await searchParams;
  const [team, customers] = await Promise.all([
    wellmixTeam(),
    getStore().list("parties", {
      filter: { type: "customer", active: true },
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
      {saved === "member" || saved === "portfolio" ? (
        <div className="mb-3" data-team-saved={saved}>
          <Alert tone="success">
            {saved === "member"
              ? t("team.saved.member")
              : t("team.saved.portfolio")}
          </Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card title={t("team.members")}>
          <Table>
            <thead>
              <tr>
                <Th>{t("team.col.name")}</Th>
                <Th>{t("team.col.level")}</Th>
                <Th>{t("team.col.manager")}</Th>
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

        <Card title={t("team.portfolio")}>
          <div id="portfolio" className="scroll-mt-4" />
          <p className="mb-2 text-sm text-zinc-600">
            {t("team.portfolioIntro")}
          </p>
          <Table>
            <thead>
              <tr>
                <Th>{t("team.col.customer")}</Th>
                <Th>{t("team.col.owner")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customers.map((c) => {
                const formId = `owner-${c.id}`;
                return (
                  <tr
                    key={c.id}
                    id={`c-${c.id}`}
                    className={rowClass}
                    data-team-customer={c.id}
                  >
                    <Td className="font-medium text-zinc-900">{c.name}</Td>
                    <Td>
                      <Select
                        dense
                        name="ownerUserId"
                        form={formId}
                        defaultValue={ownerOf(c, team) ?? ""}
                        aria-label={`${t("team.col.owner")}: ${c.name}`}
                      >
                        <option value="">{t("team.ownerNone")}</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <form id={formId} action={setCustomerOwnerAction}>
                        <input type="hidden" name="partyId" value={c.id} />
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
      </div>
    </>
  );
}
