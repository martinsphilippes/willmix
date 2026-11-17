"use server";

import { z } from "zod";
import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import { refreshRcaList } from "@/lib/services/rca";
import { requireUser, run, str } from "./helpers";

/*
 * RCA do cliente (dono, 15/11/2026; docs/CUSTOMER_RCA.md): o botão "Trazer
 * a lista do Sankhya" do campo "RCA responsável" no cadastro do cliente.
 * Traz os vendedores do Sankhya (TGFVEN) e volta para o mesmo cadastro. O
 * vínculo do cliente com o RCA é gravado junto com o cadastro
 * (`savePartyAction`).
 */

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function refreshRcaListAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id").slice(0, 64);
  // O RCA fica no cadastro do cliente, em Cadastros → Clientes (etapa 4).
  const back = `/app/customers/${encodeURIComponent(id)}/edit`;
  await run(`${back}#party-rca`, async () => {
    assertWellmix(user);
    assertScreen(user, "parties");
    ID.parse(id);
    const list = await refreshRcaList(user);
    return `${back}?rca=listed&n=${list.sellers.length}#party-rca`;
  });
}
