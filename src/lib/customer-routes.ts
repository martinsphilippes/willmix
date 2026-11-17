/*
 * Clientes com telas próprias (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * etapa 4): o cadastro do cliente abre em Cadastros → Clientes, não mais em
 * Parceiros. Os endereços de antes (/app/parties/<id> e
 * /app/parties/new?type=customer) levam para cá, com os parâmetros.
 */

type Query = Record<string, string | string[] | undefined>;

/** O endereço com os parâmetros de antes (os de texto). */
function withParams(path: string, query: Query, drop: string[] = []): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (drop.includes(key)) continue;
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) for (const v of value) params.append(key, v);
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** Cadastro do cliente (edição, RCA e quadro de acesso). */
export function customerEditHref(id: string, query: Query = {}): string {
  return withParams(`/app/customers/${encodeURIComponent(id)}/edit`, query);
}

/** Novo cliente (o tipo já vem marcado). */
export function customerNewHref(query: Query = {}): string {
  return withParams("/app/customers/new", query, ["type"]);
}
