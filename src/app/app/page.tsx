import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/** Área autenticada. O proxy faz a checagem otimista; aqui a validação é real. */
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Olá, {user.email ?? user.uid}
      </h1>
      <p className="mt-2 text-zinc-600">
        Sessão válida. Área interna do Willmix.
      </p>
    </main>
  );
}
