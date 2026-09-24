import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { dataMode } from "@/lib/env";
import { getStore, STAGE_KEYS } from "@/lib/db";
import { DEMO_PASSWORD, DEMO_USERS, seedDemo } from "@/lib/seed";
import { getT } from "@/i18n/server";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target =
    typeof next === "string" && next.startsWith("/") ? next : "/app";
  if (await getCurrentUser()) redirect(target);
  const t = await getT();

  const memory = dataMode() === "memory";
  if (memory) {
    const users = await getStore().list("users", { limit: 1 });
    if (users.length === 0) await seedDemo();
  }
  // Contas de demonstração: sempre no modo memória; em produção só com a variável ligada.
  const showDemo = memory || process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "1";
  const roles = t("help.login.roles").split("\n").filter(Boolean);
  const flow = t("help.flow.steps").split("\n").filter(Boolean);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 lg:grid-cols-5 lg:py-16">
      <section className="lg:col-span-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
          {t("app.name")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
          {t("help.flow.title")}
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-zinc-700">
          {t("help.login.body")}
        </p>
        <p className="mt-2 max-w-2xl leading-relaxed text-zinc-700">
          {t("help.rule")}
        </p>

        <ol className="mt-6 grid gap-2 sm:grid-cols-2">
          {flow.map((line, i) => {
            const [label, ...rest] = line.split(":");
            return (
              <li
                key={i}
                className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span>
                  <strong className="text-zinc-900">{label}</strong>
                  <span className="text-zinc-600">
                    {rest.length ? `:${rest.join(":")}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <details className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-zinc-900">
            {t("common.role")}s
          </summary>
          <ul className="mt-3 space-y-1.5 text-zinc-700">
            {roles.map((line, i) => {
              const [label, ...rest] = line.split(":");
              return (
                <li key={i}>
                  <strong className="text-zinc-900">{label}:</strong>
                  {rest.join(":")}
                </li>
              );
            })}
          </ul>
        </details>
        <p className="mt-4 text-xs text-zinc-500">
          {STAGE_KEYS.length} {t("orders.stage").toLowerCase()}s · pt · en ·
          中文
        </p>
      </section>

      <section className="lg:col-span-2">
        <h2 className="mb-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {t("login.title")}
        </h2>
        <LoginForm
          next={target}
          labels={{
            email: t("login.email"),
            password: t("login.password"),
            submit: t("login.submit"),
            pending: t("login.pending"),
            invalid: t("login.invalid"),
            demoTitle: t("help.login.demo"),
            demoHint: t("help.login.demoHint", { password: DEMO_PASSWORD }),
          }}
          demo={
            showDemo
              ? DEMO_USERS.map((u) => ({
                  email: u.email,
                  name: u.name,
                  role: t(`role.${u.role}`),
                  password: DEMO_PASSWORD,
                }))
              : []
          }
        />
      </section>
    </main>
  );
}
