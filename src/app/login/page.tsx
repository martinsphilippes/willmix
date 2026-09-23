import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Placeholder da tela de login. A tela real (Firebase Auth no browser +
 * POST /api/auth/session) entra junto com o módulo de usuários.
 */
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="text-zinc-600">
        Autenticação ainda não habilitada. Configure o Firebase Auth e as
        variáveis de ambiente para ativar o login.
      </p>
    </main>
  );
}
