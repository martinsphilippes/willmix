import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WellmixLogo } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { dataMode } from "@/lib/env";
import {
  DEMO_PASSWORD,
  DEMO_USERS,
  existingDemoAccounts,
  seedDemo,
} from "@/lib/seed";
import { demoAccountsEnabled } from "@/lib/demo";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("login.title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target =
    typeof next === "string" && next.startsWith("/") ? next : "/app";
  if (await getCurrentUser()) redirect(target);
  const t = await getT();

  const memory = dataMode() === "memory";
  // Modo memória: banco vazio ganha a carga inicial; banco antigo (de antes
  // de um papel novo) ganha só as contas de demonstração que faltam.
  if (memory) await seedDemo();
  // Contas de demonstração: sempre no modo memória; em produção só com a variável
  // ligada. Só as que existem no banco (papel novo entra depois de criada).
  const showDemo = demoAccountsEnabled();
  const demoExisting = showDemo
    ? await existingDemoAccounts().catch(() => new Set<string>())
    : new Set<string>();
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* Painel da marca: só a identidade. A explicação do fluxo saiu da
          tela inicial (pedido do dono, 10/11/2026). */}
      <section
        className="flex flex-col justify-center bg-gradient-to-b from-brand-700 to-brand-600 px-6 py-8 text-white sm:px-10 lg:py-12 xl:px-16"
        data-login-brand
      >
        <WellmixLogo variant="white" className="h-10 self-start sm:h-12" />
        <h1 className="mt-6 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {t("app.name")}
        </h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-white/80">
          {t("app.tagline")}
        </p>
      </section>

      <section className="flex flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:border-l lg:border-zinc-200 xl:px-14">
        <div className="mx-auto w-full max-w-md">
          <WellmixLogo className="mb-6 hidden h-9 lg:block" />
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            {t("login.title")}
          </h2>
          <p className="mb-5 mt-1 text-sm text-zinc-600">{t("app.name")}</p>
          <LoginForm
            next={target}
            labels={{
              email: t("portalAccess.login.field"),
              password: t("login.password"),
              submit: t("login.submit"),
              pending: t("login.pending"),
              invalid: t("login.invalid"),
              unavailable: t("login.unavailable"),
              paused: t("login.paused"),
              demoTitle: t("help.login.demo"),
              demoHint: t("help.login.demoHint", { password: DEMO_PASSWORD }),
            }}
            demo={
              showDemo
                ? DEMO_USERS.filter((u) => demoExisting.has(u.email)).map(
                    (u) => ({
                      email: u.email,
                      name: u.name,
                      role: t(`role.${u.role}`),
                      password: DEMO_PASSWORD,
                    }),
                  )
                : []
            }
          />
          {dataMode() === "supabase" ? (
            <p className="mt-4 text-sm">
              <a
                href="/login/forgot"
                className="font-medium text-brand-700 underline"
              >
                {t("pwReset.forgotLink")}
              </a>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
