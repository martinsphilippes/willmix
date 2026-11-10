/*
 * Login por nome de usuário (sem e-mail). O administrador cria o acesso do
 * fornecedor com um nome de usuário e uma senha e passa os dois a ele.
 *
 * O armazenamento e o Appwrite continuam identificando a conta por e-mail
 * (coluna `users.email`, única): o nome de usuário vira um endereço interno
 * num domínio reservado (.invalid, RFC 2606), que nunca recebe mensagem. Quem
 * já entra por e-mail continua entrando igual. Função pura: serve na tela de
 * login, no cadastro e nos testes.
 */

/** Domínio interno dos logins sem e-mail (nunca recebe e-mail). */
export const LOGIN_DOMAIN = "login.wellmix.invalid";

/** Nome de usuário: 3 a 40 caracteres; letras minúsculas, números, ponto, hífen e sublinhado. */
const LOGIN_NAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O que a pessoa digitou (nome de usuário ou e-mail) como o endereço que
 * identifica a conta. Nulo: não é nem um nome de usuário nem um e-mail.
 */
export function loginToEmail(typed: string): string | null {
  const value = typed.trim().toLowerCase();
  if (!value || value.length > 254) return null;
  if (value.includes("@")) return EMAIL.test(value) ? value : null;
  return LOGIN_NAME.test(value) ? `${value}@${LOGIN_DOMAIN}` : null;
}

/** A conta entra por nome de usuário (não tem e-mail de verdade). */
export function isLoginName(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${LOGIN_DOMAIN}`);
}

/** O login como a pessoa digita: o nome de usuário, ou o e-mail. */
export function loginLabel(email: string | null | undefined): string {
  if (!email) return "";
  return isLoginName(email) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email;
}

/**
 * Sugestão de nome de usuário a partir do nome da empresa (e, sem letras
 * latinas, do número da loja): "Fábrica Nova Yiwu" vira "fabrica.nova.yiwu".
 * Já em uso: ganha um número no fim.
 */
export function suggestLoginName(
  name: string,
  fallback: string | null | undefined,
  taken: Iterable<string> = [],
): string {
  const slug = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 30)
      .replace(/\.+$/g, "");
  let base = slug(name);
  if (base.length < 3) {
    const extra = slug(fallback ?? "");
    base = extra ? `loja.${extra}` : "fornecedor";
  }
  const used = new Set([...taken].map((e) => loginLabel(e).toLowerCase()));
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++)
    if (!used.has(`${base}${n}`)) return `${base}${n}`;
  return base;
}
