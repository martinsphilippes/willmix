/*
 * Rascunho do formulário "Novo parceiro" enquanto o administrador cria um
 * tipo pelo atalho (docs/PARTNER_TYPES.md): os campos digitados voltam
 * preenchidos. Cookie do servidor, 5 minutos.
 */
export const PARTY_DRAFT_COOKIE = "wm_party_draft";
export const PARTY_DRAFT_FIELDS = [
  "name",
  "country",
  "email",
  "phone",
  "taxId",
  "notes",
] as const;
export type PartyDraft = Partial<
  Record<(typeof PARTY_DRAFT_FIELDS)[number], string>
>;

export function parsePartyDraft(raw: string | undefined): PartyDraft {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return {};
    const out: PartyDraft = {};
    for (const field of PARTY_DRAFT_FIELDS) {
      const value = (data as Record<string, unknown>)[field];
      if (typeof value === "string") out[field] = value.slice(0, 2000);
    }
    return out;
  } catch {
    return {};
  }
}
