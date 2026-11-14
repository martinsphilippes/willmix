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

const TYPES = "/app/parties/types";

/**
 * Painel lateral de onde veio o formulário (aba Tipos de parceiro): com erro,
 * volta para ele aberto, com o aviso; deu certo, fecha e mostra o aviso.
 */
function panelBack(panel: "new" | "edit" | "rename", value: string | null) {
  const back = withQuery(TYPES, "panel", panel);
  return value ? withQuery(back, "type", value) : back;
}

/** Da tela de tipos: cria ou altera e volta para ela. */
export async function savePartnerTypeAction(form: FormData) {
  const user = await requireUser();
  const back = str(form, "panel") === "new" ? panelBack("new", null) : TYPES;
  await run(back, async () => {
    const { savePartnerType } = await import("@/lib/services/partner-types");
    const data = input(form);
    await savePartnerType(user, data);
    return withQuery(TYPES, "saved", data.value ? "1" : "new");
  });
}

/*
 * Menu ⋯ de cada tipo (Editar, Renomear, Inativar/Reativar): cada um muda só
 * o que é seu e o servidor completa o resto com o que está gravado (nada de
 * apagar descrição ou tradução por um campo que não veio).
 */
const typeValue = (form: FormData) =>
  z
    .string()
    .regex(/^(custom:)?[A-Za-z0-9_-]{1,64}$/)
    .parse(str(form, "value"));

/** Editar: nomes, descrição e (nos criados no painel) o login. */
export async function editPartnerTypeAction(form: FormData) {
  const user = await requireUser();
  const value = str(form, "value");
  await run(panelBack("edit", value), async () => {
    const { updatePartnerType } = await import("@/lib/services/partner-types");
    await updatePartnerType(user, typeValue(form), {
      name: str(form, "name"),
      nameEn: str(form, "nameEn") || null,
      nameZh: str(form, "nameZh") || null,
      description: str(form, "description") || null,
      ...(form.has("allowLogin")
        ? { allowLogin: form.getAll("allowLogin").includes("on") }
        : {}),
    });
    return withQuery(TYPES, "saved", "1");
  });
}

/** Renomear: só os nomes (português, inglês e chinês). */
export async function renamePartnerTypeAction(form: FormData) {
  const user = await requireUser();
  const value = str(form, "value");
  await run(panelBack("rename", value), async () => {
    const { updatePartnerType } = await import("@/lib/services/partner-types");
    await updatePartnerType(user, typeValue(form), {
      name: str(form, "name"),
      nameEn: str(form, "nameEn") || null,
      nameZh: str(form, "nameZh") || null,
    });
    return withQuery(TYPES, "saved", "renamed");
  });
}

/** Inativar ou reativar: só a situação. */
export async function setPartnerTypeActiveAction(form: FormData) {
  const user = await requireUser();
  await run(TYPES, async () => {
    const active = z.enum(["on", "off"]).parse(str(form, "active")) === "on";
    const { updatePartnerType } = await import("@/lib/services/partner-types");
    await updatePartnerType(user, typeValue(form), { active });
    return withQuery(TYPES, "saved", active ? "activated" : "deactivated");
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
