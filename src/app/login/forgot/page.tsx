import type { Metadata } from "next";
import { WellmixLogo } from "@/components/brand";
import { Alert, Field, Input, TextLink } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { dataMode } from "@/lib/env";
import { getT } from "@/i18n/server";
import { requestPasswordResetAction } from "@/app/app/actions/password-reset";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pwReset.forgot.title") };
}

/** Esqueci minha senha: o Supabase manda o link por e-mail. */
export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/login/forgot">) {
  const { sent, error } = await searchParams;
  const t = await getT();
  const available = dataMode() === "supabase";
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <WellmixLogo className="mb-6 h-9" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {t("pwReset.forgot.title")}
        </h1>
        {!available || error === "unavailable" ? (
          <p className="mt-3 text-sm text-zinc-600">
            {t("pwReset.unavailable")}
          </p>
        ) : sent ? (
          <Alert tone="success">{t("pwReset.forgot.sent")}</Alert>
        ) : (
          <>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              {t("pwReset.forgot.hint")}
            </p>
            {error === "rate" ? (
              <Alert tone="warning">{t("pwReset.forgot.rate")}</Alert>
            ) : error ? (
              <Alert tone="danger">{t("pwReset.forgot.invalid")}</Alert>
            ) : null}
            <form action={requestPasswordResetAction} className="grid gap-3">
              <Field label={t("portalAccess.login.field")}>
                <Input name="email" required autoComplete="username" />
              </Field>
              <SubmitButton pendingText="…">
                {t("pwReset.forgot.submit")}
              </SubmitButton>
            </form>
          </>
        )}
        <p className="mt-6 text-sm">
          <TextLink href="/login">{t("pwReset.back")}</TextLink>
        </p>
      </div>
    </main>
  );
}
