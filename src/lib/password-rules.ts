/*
 * Regras da senha nova na troca de senha (função pura; a tela e o serviço
 * usam a mesma). O Appwrite exige 8 ou mais caracteres.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const PASSWORD_ERRORS = [
  "password_short",
  "password_long",
  "password_same",
  "password_mismatch",
  "password_wrong",
] as const;
export type PasswordError = (typeof PASSWORD_ERRORS)[number];

/** O que impede a troca, ou nulo. A senha atual é conferida à parte. */
export function newPasswordError(input: {
  current: string;
  next: string;
  confirm: string;
}): PasswordError | null {
  if (input.next.length < PASSWORD_MIN) return "password_short";
  if (input.next.length > PASSWORD_MAX) return "password_long";
  if (input.next === input.current) return "password_same";
  if (input.next !== input.confirm) return "password_mismatch";
  return null;
}
