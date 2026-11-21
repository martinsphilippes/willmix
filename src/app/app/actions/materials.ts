"use server";

import { z } from "zod";
import { assertScreen } from "@/lib/auth/screens";
import { requireUser, run, str } from "./helpers";

/*
 * Catálogo de materiais (dono, 21/11/2026; Cadastros → Materiais): incluir,
 * renomear, desativar e reativar. Aqui só o formato; o serviço confere a
 * ação "Manter o catálogo de materiais" (padrão: Cadastro). Nada é apagado.
 */

const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
const NAME = z.string().trim().min(1).max(80);

const names = (form: FormData) => ({
  namePt: NAME.parse(str(form, "namePt")),
  nameEn: NAME.parse(str(form, "nameEn")),
  nameZh: NAME.parse(str(form, "nameZh")),
});

/** Volta para a lista como estava (busca e filtro). */
function back(form: FormData, extra = "") {
  const q = str(form, "q").slice(0, 80);
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (str(form, "show") === "all") params.set("show", "all");
  if (extra) for (const [k, v] of new URLSearchParams(extra)) params.set(k, v);
  const query = params.toString();
  return query ? `/app/materials?${query}` : "/app/materials";
}

export async function createMaterialAction(form: FormData) {
  const user = await requireUser();
  await run(back(form), async () => {
    assertScreen(user, "products");
    const { createMaterial } = await import("@/lib/services/materials");
    await createMaterial(user, names(form));
    return back(form, "created=1");
  });
}

export async function updateMaterialAction(form: FormData) {
  const user = await requireUser();
  await run(back(form), async () => {
    assertScreen(user, "products");
    const id = ID.parse(str(form, "id"));
    const { updateMaterial } = await import("@/lib/services/materials");
    await updateMaterial(user, id, names(form));
    return back(form, "updated=1");
  });
}

export async function toggleMaterialAction(form: FormData) {
  const user = await requireUser();
  await run(back(form), async () => {
    assertScreen(user, "products");
    const id = ID.parse(str(form, "id"));
    const active = str(form, "active") === "1";
    const { setMaterialActive } = await import("@/lib/services/materials");
    await setMaterialActive(user, id, active);
    return back(form, "toggled=1");
  });
}
