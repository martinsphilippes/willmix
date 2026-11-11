import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { TABLES, type TableName } from "@/lib/db";
import { dataMode, supabaseEnv } from "@/lib/env";
import {
  COPY_CONFIRM_WORD,
  getCopyProgress,
} from "@/lib/services/supabase-copy";
import {
  resetSupabaseCopyAction,
  runSupabaseCopyAction,
} from "../../actions/supabase-copy";
import { AutoContinue } from "../sankhya/_auto";

export const maxDuration = 60;

/**
 * Configurações → Supabase (docs/SUPABASE.md, etapa 4): copia o Appwrite
 * para o Supabase (tabelas, arquivos e contas) antes da virada. Só admin.
 */
export default async function SupabaseCopyPage({
  searchParams,
}: PageProps<"/app/settings/supabase">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "settings");
  if (user.role !== "admin") redirect("/app/settings");
  const t = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const ran = one(sp.ran);
  const auto = one(sp.auto) === "1" && ran === "partial";
  const error = one(sp.error);
  const mode = dataMode();
  const configured = !!supabaseEnv();
  const progress = await getCopyProgress().catch(() => null);
  const tables = Object.keys(TABLES) as TableName[];
  const totalRows = progress
    ? Object.values(progress.rows).reduce((a, b) => a + b, 0)
    : 0;
  const fmt = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString(t.intl, { timeZone: "America/Sao_Paulo" })
      : "—";
  const phaseLabel = progress ? t(`supaCopy.phase.${progress.phase}`) : "—";

  return (
    <>
      <PageHeader
        title={t("supaCopy.title")}
        subtitle={t("supaCopy.subtitle")}
        actions={
          <TextLink href="/app/settings" className="text-sm">
            {t("reset.back")}
          </TextLink>
        }
      />
      {mode === "supabase" ? (
        <Alert tone="success">{t("supaCopy.onSupabase")}</Alert>
      ) : !configured ? (
        <Alert tone="warning">{t("supaCopy.notConfigured")}</Alert>
      ) : null}
      {error ? (
        <Alert tone="danger">{t("supaCopy.error", { detail: error })}</Alert>
      ) : null}
      {ran === "done" ? (
        <Alert tone="success">{t("supaCopy.done")}</Alert>
      ) : ran === "partial" ? (
        <Alert tone="info">{t("supaCopy.partial")}</Alert>
      ) : null}
      {one(sp.reset) ? (
        <Alert tone="info">{t("supaCopy.wasReset")}</Alert>
      ) : null}

      <Card className="mt-3" title={t("supaCopy.status")}>
        <dl className="grid max-w-xl grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-zinc-600">{t("supaCopy.phase")}</dt>
          <dd>
            <Badge tone={progress?.phase === "done" ? "success" : "info"}>
              {phaseLabel}
            </Badge>
          </dd>
          <dt className="text-zinc-600">{t("supaCopy.rows")}</dt>
          <dd className="text-right tabular-nums">
            {totalRows.toLocaleString(t.intl)} ·{" "}
            {t("supaCopy.tablesOf", {
              n: Math.min(progress?.tableIndex ?? 0, tables.length),
              total: tables.length,
            })}
          </dd>
          <dt className="text-zinc-600">{t("supaCopy.files")}</dt>
          <dd className="text-right tabular-nums">
            {t("supaCopy.filesCounts", {
              copied: progress?.files.copied ?? 0,
              existing: progress?.files.existing ?? 0,
              missing: progress?.files.missing ?? 0,
            })}
          </dd>
          <dt className="text-zinc-600">{t("supaCopy.accounts")}</dt>
          <dd className="text-right tabular-nums">
            {t("supaCopy.accountsCounts", {
              created: progress?.accounts.created ?? 0,
              existing: progress?.accounts.existing ?? 0,
              failed: progress?.accounts.failed ?? 0,
            })}
          </dd>
          <dt className="text-zinc-600">{t("supaCopy.updated")}</dt>
          <dd className="text-right">{fmt(progress?.updatedAt)}</dd>
        </dl>
        {progress?.errors.length ? (
          <ul className="mt-3 list-disc pl-5 text-xs text-red-700">
            {progress.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : null}
        {mode !== "supabase" && configured ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {progress?.phase !== "done" ? (
              <>
                <form action={runSupabaseCopyAction}>
                  <SubmitButton pendingText="…">
                    {progress?.startedAt
                      ? t("supaCopy.continue")
                      : t("supaCopy.start")}
                  </SubmitButton>
                </form>
                <form id="supabase-copy-auto" action={runSupabaseCopyAction}>
                  <input type="hidden" name="auto" value="1" />
                  <SubmitButton variant="secondary" pendingText="…">
                    {t("sankhyaLoad.full.auto")}
                  </SubmitButton>
                </form>
                {auto ? (
                  <>
                    <AutoContinue formId="supabase-copy-auto" />
                    <a
                      href="/app/settings/supabase"
                      className="text-xs font-semibold text-red-700 underline"
                    >
                      {t("sankhyaLoad.full.stop")}
                    </a>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      {progress && Object.keys(progress.rows).length ? (
        <Card className="mt-3" title={t("supaCopy.perTable")}>
          <Table>
            <thead>
              <tr>
                <Th>{t("supaCopy.table")}</Th>
                <Th className="text-right">{t("supaCopy.rows")}</Th>
              </tr>
            </thead>
            <tbody>
              {tables
                .filter((tb) => progress.rows[tb] !== undefined)
                .map((tb) => (
                  <tr key={tb}>
                    <Td className="font-mono text-xs">{tb}</Td>
                    <Td className="text-right tabular-nums">
                      {progress.rows[tb].toLocaleString(t.intl)}
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {mode !== "supabase" && configured ? (
        <Card className="mt-3" title={t("supaCopy.resetTitle")}>
          <p className="mb-3 text-sm text-zinc-600">
            {t("supaCopy.resetHint")}
          </p>
          <form
            action={resetSupabaseCopyAction}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="w-full sm:w-64">
              <Field label={t("supaCopy.confirmLabel")}>
                <Input
                  name="confirm"
                  required
                  autoComplete="off"
                  placeholder={COPY_CONFIRM_WORD}
                />
              </Field>
            </div>
            <SubmitButton variant="danger" pendingText="…">
              {t("supaCopy.reset")}
            </SubmitButton>
          </form>
        </Card>
      ) : null}
    </>
  );
}
