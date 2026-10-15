import { AppwriteException } from "node-appwrite";

/**
 * Login: separa "e-mail ou senha errados" de "o banco de dados não respondeu"
 * (projeto pausado, fora do ar, rede). Assim a tela não diz "credenciais
 * inválidas" quando a senha está certa e o problema é do serviço.
 */
export type LoginFailure = "invalid" | "unavailable";

export function classifyLoginError(error: unknown): LoginFailure {
  if (error instanceof AppwriteException) {
    // Erros de usuário/sessão (senha errada, bloqueado, limite de tentativas).
    if (
      error.type?.startsWith("user_") ||
      error.type === "general_rate_limit_exceeded"
    )
      return "invalid";
    return "unavailable";
  }
  // AuthError (usuário inexistente/inativo, senha errada no modo memória) é
  // tratado antes, na rota; aqui o resto é falha do serviço.
  return "unavailable";
}

/**
 * Projeto Appwrite pausado (plano gratuito sem atividade no console). Não volta
 * sozinho: alguém precisa restaurar no console. Por isso a tela diz o que fazer
 * em vez de "tente em alguns minutos".
 */
export function isProjectPaused(error: unknown): boolean {
  return (
    error instanceof AppwriteException &&
    (error.type === "project_paused" || /paused/i.test(error.message))
  );
}

/** Motivo curto (sem segredo) para log e diagnóstico. */
export function serviceErrorCode(error: unknown): string {
  if (error instanceof AppwriteException) {
    if (isProjectPaused(error)) return "appwrite_paused";
    return `appwrite_${error.type || error.code || "error"}`.slice(0, 60);
  }
  return error instanceof Error ? error.name : "error";
}
