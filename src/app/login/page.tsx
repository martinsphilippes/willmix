import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { dataMode } from "@/lib/env";
import { getStore } from "@/lib/db";
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
    // Primeiro acesso em desenvolvimento: cria os dados de demonstração.
    const users = await getStore().list("users", { limit: 1 });
    if (users.length === 0) await seedDemo();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          {t("app.name")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("login.title")}
        </h1>
      </div>
      <LoginForm
        next={target}
        labels={{
          email: t("login.email"),
          password: t("login.password"),
          submit: t("login.submit"),
          pending: t("login.pending"),
          invalid: t("login.invalid"),
        }}
      />
      {memory ? (
        <details className="rounded-md border border-zinc-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            {t("login.demo", { password: DEMO_PASSWORD })}
          </summary>
          <ul className="mt-3 space-y-1 font-mono text-xs text-zinc-700">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                {u.email}{" "}
                <span className="text-zinc-400">· {t(`role.${u.role}`)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </main>
  );
}
