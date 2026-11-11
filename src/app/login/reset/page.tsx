import type { Metadata } from "next";
import { WellmixLogo } from "@/components/brand";
import { TextLink } from "@/components/ui";
import { getT } from "@/i18n/server";
import { ResetPasswordForm } from "./_form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("pwReset.reset.title") };
}

/**
 * Definir nova senha: chega pelo link do e-mail do Supabase, com o token na
 * parte da URL depois de "#" (só o navegador lê; o formulário o envia à ação).
 */
export default async function ResetPasswordPage() {
  const t = await getT();
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <WellmixLogo className="mb-6 h-9" />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-zinc-900">
          {t("pwReset.reset.title")}
        </h1>
        <ResetPasswordForm
          labels={{
            password: t("pwReset.reset.password"),
            confirm: t("pwReset.reset.confirm"),
            submit: t("pwReset.reset.submit"),
            pending: "…",
            noToken: t("pwReset.reset.noToken"),
            done: t("pwReset.reset.done"),
            login: t("pwReset.back"),
            errors: {
              short: t("pwReset.reset.short"),
              mismatch: t("pwReset.reset.mismatch"),
              expired: t("pwReset.reset.expired"),
              failed: t("pwReset.reset.failed"),
              unavailable: t("pwReset.unavailable"),
            },
          }}
        />
        <p className="mt-6 text-sm">
          <TextLink href="/login/forgot">{t("pwReset.reset.again")}</TextLink>
        </p>
      </div>
    </main>
  );
}
