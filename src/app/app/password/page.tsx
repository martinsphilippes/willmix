import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import { Alert, PageHeader } from "@/components/ui";
import { PasswordChangeCard } from "@/components/password-change-card";

/**
 * Trocar senha: qualquer login troca a própria. No primeiro acesso com senha
 * provisória o layout mostra a troca no lugar de toda tela (inclusive desta).
 */
export default async function PasswordPage({
  searchParams,
}: PageProps<"/app/password">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/password");
  const { saved } = await searchParams;
  const t = await getT();
  return (
    <>
      <PageHeader t={t} title={t("password.title")} />
      {saved ? (
        <div className="mb-3" data-password-saved>
          <Alert tone="success">{t("password.saved")}</Alert>
        </div>
      ) : null}
      <PasswordChangeCard t={t} firstAccess={false} />
    </>
  );
}
