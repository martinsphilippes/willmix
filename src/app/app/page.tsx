import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";

/** Área autenticada. O proxy faz a checagem otimista; aqui a validação é real. */
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Olá, {user.name || user.email}
      </h1>
      <p className="mt-2 text-zinc-600">
        Sessão válida. Área interna do Willmix.
      </p>
      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}
