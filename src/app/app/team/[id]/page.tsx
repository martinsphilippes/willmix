import { loginLabel } from "@/lib/auth/login-id";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { WELLMIX_BASE } from "@/lib/auth/screens";
import { loadFunctionDefs } from "@/lib/services/team-functions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Alert, Button, PageHeader, TextLink } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { QuickDialog } from "@/components/quick-dialog";
import { teamMemberRemoval, wellmixTeam } from "@/lib/services/team";
import { removeTeamMemberAction } from "../../actions/team";
import { TeamAccessEditor } from "../_components/team-access-editor";
import {
  editorFunctions,
  editorMember,
  editorOptions,
  editorTexts,
  permissionGroups,
} from "../_components/access-payload";

/*
 * Acessos de uma pessoa da equipe (só o administrador), na página própria: o
 * mesmo editor do painel lateral da lista (TeamAccessEditor; dono,
 * 14/11/2026): cargo, funções, divisão, "Responde a", o modo das telas e a
 * prévia de "Acessos efetivos" (telas e ações, com a origem de cada uma).
 * Regra em docs/ACCESS.md.
 *
 * "Excluir acesso" (pedido do dono, 13/11/2026), só para o administrador:
 * abre a confirmação com o nome e o login da pessoa; confirmado, o login sai
 * da equipe e não entra mais, sem apagar histórico nem autoria. Não exclui o
 * próprio acesso nem o último administrador ativo (o servidor confere).
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
  const { error, created } = await searchParams;
  const [team, defs] = await Promise.all([wellmixTeam(), loadFunctionDefs()]);
  const member = team.find((m) => m.id === id);
  // Já excluído (por outra pessoa, ou na tentativa que voltou com erro): a
  // lista mostra o motivo, sem cair na página de "não encontrado".
  if (!member) {
    if (typeof error === "string" && error)
      redirect(`/app/team?error=${encodeURIComponent(error.slice(0, 60))}`);
    notFound();
  }
  const groups = permissionGroups(t);
  const errorKey = `team.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string" && error
      ? t(errorKey as DictionaryKey) !== errorKey
        ? t(errorKey as DictionaryKey)
        : t("common.error")
      : null;
  // Excluir acesso: só o administrador vê; o próprio acesso e o último
  // administrador ativo aparecem desligados, com o motivo.
  const removal = isAdmin(user) ? await teamMemberRemoval(member, team) : null;
  const blockedReason = !removal
    ? null
    : member.id === user.id
      ? t("team.delete.self")
      : removal.lastAdmin
        ? t("team.delete.lastAdmin")
        : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("team.person.title", { name: member.name })}
        subtitle={`${t(`role.${member.role}` as DictionaryKey)} · ${loginLabel(member.email)}`}
        actions={
          <>
            {removal ? (
              <span
                className="flex flex-col items-end gap-0.5"
                data-team-delete={blockedReason ? "blocked" : "on"}
              >
                <QuickDialog
                  label={t("team.delete.open")}
                  title={t("team.delete.title")}
                  closeLabel={t("team.delete.close")}
                  tone="danger"
                  disabled={!!blockedReason}
                  data-team-delete-open=""
                >
                  <div
                    className="space-y-3 text-sm text-zinc-700"
                    data-team-delete-dialog
                  >
                    <p
                      className="font-semibold text-zinc-900"
                      data-team-delete-who
                    >
                      {member.name} · {loginLabel(member.email)}
                    </p>
                    <p>{t("team.delete.body")}</p>
                    {/* Opções (marcadas por padrão): os subordinados vão para o
                        chefe dela e as pendências, para a divisão. Desmarcada,
                        aparece o que fazer depois. Sem chefe ativo, só o aviso. */}
                    {removal.reports && removal.moveTo ? (
                      <div className="group space-y-1" data-team-delete-reports>
                        <label className="flex items-start gap-2 font-medium text-zinc-800">
                          <input
                            type="checkbox"
                            name="moveReports"
                            form="team-delete-form"
                            defaultChecked
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                            data-team-delete-move
                          />
                          <span>
                            {t("team.delete.moveReports", {
                              n: removal.reports,
                              name: removal.moveTo.name,
                            })}
                          </span>
                        </label>
                        <p className="pl-6 text-amber-800 group-has-[:checked]:hidden">
                          {t("team.delete.reports", { n: removal.reports })}
                        </p>
                      </div>
                    ) : removal.reports ? (
                      <p className="text-amber-800" data-team-delete-reports>
                        {t("team.delete.reports", { n: removal.reports })}
                      </p>
                    ) : null}
                    {removal.openWork ? (
                      <div
                        className="group space-y-1"
                        data-team-delete-open-work
                      >
                        <label className="flex items-start gap-2 font-medium text-zinc-800">
                          <input
                            type="checkbox"
                            name="redistribute"
                            form="team-delete-form"
                            defaultChecked
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                            data-team-delete-redistribute
                          />
                          <span>
                            {t("team.delete.redistribute", {
                              n: removal.openWork,
                            })}
                          </span>
                        </label>
                        <p className="pl-6 text-amber-800 group-has-[:checked]:hidden">
                          {t("team.delete.openWork", { n: removal.openWork })}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <form method="dialog">
                        <Button
                          type="submit"
                          variant="secondary"
                          data-team-delete-cancel
                        >
                          {t("common.cancel")}
                        </Button>
                      </form>
                      <form
                        id="team-delete-form"
                        action={removeTeamMemberAction}
                      >
                        <input type="hidden" name="userId" value={member.id} />
                        <SubmitButton variant="danger" data-team-delete-confirm>
                          {t("team.delete.confirm")}
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </QuickDialog>
                {blockedReason ? (
                  <span
                    className="max-w-60 text-right text-[11px] leading-tight text-zinc-500"
                    data-team-delete-why
                  >
                    {blockedReason}
                  </span>
                ) : null}
              </span>
            ) : null}
            <TextLink href="/app/team">{t("team.person.back")}</TextLink>
          </>
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {typeof created === "string" && created ? (
        <div className="mb-3" data-team-created>
          <Alert tone="success">
            {t("team.new.created", { login: created.slice(0, 254) })}
          </Alert>
        </div>
      ) : null}
      {/* O mesmo editor do painel lateral da lista (dono, 14/11/2026). */}
      <section
        className="rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-sm shadow-zinc-900/[0.03] sm:p-4"
        data-team-form
      >
        <TeamAccessEditor
          member={editorMember(member, team, defs)}
          functions={editorFunctions(defs, t)}
          screenGroups={groups.screens}
          actionGroups={groups.actions}
          base={[...WELLMIX_BASE]}
          options={editorOptions(team, t)}
          texts={editorTexts(t)}
          mode="page"
        />
      </section>
    </>
  );
}
