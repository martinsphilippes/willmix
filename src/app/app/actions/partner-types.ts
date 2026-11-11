"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { PARTY_DRAFT_COOKIE, PARTY_DRAFT_FIELDS } from "@/lib/party-draft";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Tipos de parceiro (docs/PARTNER_TYPES.md): criar, renomear e inativar. Só o
 * administrador; o serviço confere de novo.
 */

const VALUE = z
  .string()
  .regex(/^(custom:)?[A-Za-z0-9_-]{1,64}$/)
  .nullable();

function input(form: FormData) {
  return {
    value: VALUE.parse(str(form, "value") || null),
    name: str(form, "name"),
    nameEn: str(form, "nameEn") || null,
    nameZh: str(form, "nameZh") || null,
    description: str(form, "description") || null,
    // Tipo novo nasce ativo; na edição, o hidden "off" vem antes da caixa.
    active: form.has("active") ? form.getAll("active").includes("on") : true,
    // Caixa "pode ter login" (só aparece nos tipos criados no painel).
    ...(form.has("allowLogin")
      ? { allowLogin: form.getAll("allowLogin").includes("on") }
      : {}),
  };
}

/** Da tela de tipos: cria ou altera e volta para ela. */
export async function savePartnerTypeAction(form: FormData) {
  const user = await requireUser();
  await run("/app/parties/types", async () => {
    const { savePartnerType } = await import("@/lib/services/partner-types");
    const data = input(form);
    await savePartnerType(user, data);
    return withQuery("/app/parties/types", "saved", data.value ? "1" : "new");
  });
}

/**
 * Do formulário "Novo parceiro": cria o tipo e volta ao formulário com ele
 * selecionado e com o que já estava digitado (guardado por 5 minutos num
 * cookie do servidor; e-mail e telefone não vão para o endereço).
 */
export async function quickPartnerTypeAction(form: FormData) {
  const user = await requireUser();
  const draft: Record<string, string> = {};
  for (const field of PARTY_DRAFT_FIELDS) {
    const value = str(form, field).slice(0, field === "notes" ? 2000 : 255);
    if (value) draft[field] = value;
  }
  const jar = await cookies();
  jar.set(PARTY_DRAFT_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/app/parties",
    maxAge: 300,
  });
  await run(withQuery("/app/parties/new", "draft", "1"), async () => {
    const { savePartnerType } = await import("@/lib/services/partner-types");
    const entry = await savePartnerType(user, {
      value: null,
      name: str(form, "newTypeName"),
      nameEn: null,
      nameZh: null,
      description: null,
      active: true,
    });
    let to = withQuery("/app/parties/new", "type", entry.value);
    to = withQuery(to, "draft", "1");
    return withQuery(to, "typeCreated", "1");
  });
}
