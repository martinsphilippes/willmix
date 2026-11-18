"use server";

import { z } from "zod";
import { getStore } from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Grupo de produto (família) do parceiro (dono, 18/11/2026;
 * docs/PARTNER_FAMILIES.md): gravar as famílias que o parceiro atende e
 * atualizar o cadastro de famílias pelo Sankhya (administrador). As regras
 * ficam no serviço (src/lib/services/product-families.ts).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const CODE = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

/**
 * Volta para a tela de onde a seção foi gravada (`screen`): o Fornecedor tem
 * a dele (aba Informações) e também abre pela ficha de parceiros. Sem a
 * indicação, a do tipo.
 */
async function partyBack(partyId: string, screen: string): Promise<string> {
  const party = ID.safeParse(partyId).success
    ? await getStore().get("parties", partyId)
    : null;
  if (!party) return "/app/parties";
  const supplierScreen = party.type === "supplier" && screen !== "parties";
  return supplierScreen
    ? `/app/suppliers/${party.id}?tab=info#families`
    : `/app/parties/${party.id}#families`;
}

export async function setPartyFamiliesAction(form: FormData) {
  const user = await requireUser();
  const partyId = str(form, "partyId");
  const back = await partyBack(partyId, str(form, "screen"));
  await run(back, async () => {
    assertWellmix(user);
    assertScreen(user, "parties");
    const codes = z
      .array(CODE)
      .max(500)
      .parse(form.getAll("familyCode").map(String).filter(Boolean));
    const { setPartyFamilies } =
      await import("@/lib/services/product-families");
    await setPartyFamilies(user, ID.parse(partyId), codes);
    return withQuery(back, "families", "saved");
  });
}

/** Atualizar o cadastro de famílias pelo Sankhya (administrador). */
export async function refreshPartyFamiliesAction(form: FormData) {
  const user = await requireUser();
  const back = await partyBack(str(form, "partyId"), str(form, "screen"));
  await run(back, async () => {
    assertWellmix(user);
    const { refreshFamiliesFromSankhya } =
      await import("@/lib/services/product-families");
    const result = await refreshFamiliesFromSankhya(user);
    return withQuery(
      withQuery(back, "families", "synced"),
      "n",
      String(result.families),
    );
  });
}
