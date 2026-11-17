import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { functionLabel } from "@/lib/auth/function-access";
import { JOB_LEVELS } from "@/lib/db/schema";
import { loadFunctionDefs } from "@/lib/services/team-functions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { PageHeader, TextLink } from "@/components/ui";
import { TeamAreaNav } from "@/components/team-area-nav";
import { TeamImport } from "../_components/team-import";

/*
 * Importar equipe (Equipe Acessos e Parceiros → Equipe → "Importar da
 * planilha"; dono, 16/11/2026; docs/ACCESS.md, "Importar equipe"): só o
 * administrador. A tela fica aberta enquanto os logins são criados em lotes
 * (cada login abre a conta de acesso; até 5 minutos por clique).
 */
export const maxDuration = 300;

export default async function TeamImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "team");
  if (!isAdmin(user)) redirect("/app/team");
  const t = await getT();
  const defs = await loadFunctionDefs();
  const k = (key: string) => t(key as DictionaryKey);
  const functionLabels = Object.fromEntries(
    defs.map((d) => [d.key, functionLabel(d.key, defs, k)]),
  );
  const levelLabels = Object.fromEntries(
    JOB_LEVELS.map((l) => [l, t(`level.${l}` as DictionaryKey)]),
  );
  return (
    <>
      <PageHeader
        t={t}
        title={t("nav.teamAccess")}
        subtitle={t("teamImport.subtitle")}
        actions={
          <TextLink href="/app/team?tab=team" data-team-import-back>
            {t("teamImport.back")}
          </TextLink>
        }
      />
      <TeamAreaNav t={t} user={user} active="team" />
      <TeamImport
        functionLabels={functionLabels}
        levelLabels={levelLabels}
        texts={{
          title: t("teamImport.title"),
          hint: t("teamImport.hint"),
          rows: t("teamImport.rows"),
          password: t("teamImport.password"),
          passwordHint: t("teamImport.passwordHint"),
          preview: t("teamImport.preview"),
          run: t("teamImport.run"),
          working: t("teamImport.working"),
          colLine: t("teamImport.col.line"),
          colName: t("teamImport.col.name"),
          colEmail: t("teamImport.col.email"),
          colPosition: t("team.col.position"),
          colArea: t("team.col.area"),
          colFunctions: t("team.col.functions"),
          colLevel: t("team.col.level"),
          colStatus: t("teamImport.col.status"),
          colReview: t("teamImport.col.review"),
          unknownPosition: t("teamImport.unknownPosition"),
          none: t("team.none"),
          previewDone: t("teamImport.previewDone"),
          runDone: t("teamImport.runDone"),
          remaining: t("teamImport.remaining"),
          failed: t("teamImport.failed"),
          invalidName: t("teamImport.invalid.name"),
          invalidEmail: t("teamImport.invalid.email"),
          repeated: t("teamImport.repeated"),
          header: t("teamImport.header"),
          status: {
            new: t("teamImport.status.new"),
            existing: t("teamImport.status.existing"),
            partner: t("teamImport.status.partner"),
            inactive: t("teamImport.status.inactive"),
          },
          skipped: {
            has_place: t("teamImport.skipped.has_place"),
            partner: t("teamImport.status.partner"),
            inactive: t("teamImport.status.inactive"),
          },
          review: t("teamImport.review"),
          noReview: t("teamImport.noReview"),
          keep: t("teamImport.keep"),
          pendingTitle: t("teamImport.pending.title"),
          pendingHint: t("teamImport.pending.hint"),
          pendingAlready: t("teamImport.pending.already"),
          pendingDone: t("teamImport.pendingDone"),
        }}
      />
    </>
  );
}
