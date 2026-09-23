import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { isAppwriteServerConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target =
    typeof next === "string" && next.startsWith("/") ? next : "/app";

  if (await getCurrentUser()) redirect(target);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      {isAppwriteServerConfigured() ? (
        <LoginForm next={target} />
      ) : (
        <p className="text-zinc-600">
          Appwrite ainda não configurado. Preencha as variáveis de ambiente
          descritas em <code className="font-mono">.env.example</code>.
        </p>
      )}
    </main>
  );
}
