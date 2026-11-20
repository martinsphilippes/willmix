"use server";

import { z } from "zod";
import {
  changeLoginEmail,
  reactivateTeamMember,
  setPartnerLoginActive,
  setRequireActiveParty,
  setTeamLoginActive,
} from "@/lib/services/access-state";
import { loginLabel } from "@/lib/auth/login-id";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7): desativar e reativar login de parceiro e ligar ou desligar a regra
 * "cadastro e login ativos". Só o administrador (o serviço confere). Voltam
 * para a Equipe Externa como estava (busca, filtros e o painel aberto).
 */

/** Volta só para a Equipe Externa ou para a ficha do cliente/fornecedor. */
function backOf(form: FormData): string {
  const back = str(form, "back");
  // A lista da Equipe Externa ou a ficha do cliente ou do fornecedor.
  return /^\/app\/(parties|customers\/[A-Za-z0-9_-]{1,64}|suppliers\/[A-Za-z0-9_-]{1,64})(\?[^#\s]*)?$/.test(
    back,
  )
    ? back
    : "/app/parties";
}

export async function setPartnerLoginActiveAction(form: FormData) {
  const user = await requireUser();
  const back = backOf(form);
  await run(back, async () => {
    const userId = z.string().min(1).max(100).parse(str(form, "userId"));
    const active = str(form, "active") === "1";
    const target = await setPartnerLoginActive(user, userId, active);
    return withQuery(
      withQuery(back, "saved", active ? "login_on" : "login_off"),
      "login",
      target.name.slice(0, 120),
    );
  });
}

/**
 * Alterar o e-mail do login de cliente ou parceiro (dono, 20/11/2026;
 * docs/EQUIPE_ACESSOS.md): só o administrador (o serviço confere). Volta
 * para a ficha com o login novo na mensagem; a senha não muda.
 */
export async function changeLoginEmailAction(form: FormData) {
  const user = await requireUser();
  const back = backOf(form);
  await run(back, async () => {
    const userId = z.string().min(1).max(100).parse(str(form, "userId"));
    const login = z.string().min(3).max(254).parse(str(form, "login"));
    const updated = await changeLoginEmail(user, userId, login);
    return withQuery(
      withQuery(
        withQuery(back, "saved", "login_email"),
        "login",
        loginLabel(updated.email).slice(0, 254),
      ),
      "who",
      updated.name.slice(0, 120),
    );
  });
}

export async function setAccessRuleAction(form: FormData) {
  const user = await requireUser();
  const back = backOf(form);
  await run(back, async () => {
    const on = str(form, "on") === "1";
    const { blockedLogins } = await setRequireActiveParty(user, on);
    const saved = withQuery(back, "saved", on ? "rule_on" : "rule_off");
    return on ? withQuery(saved, "n", String(blockedLogins)) : saved;
  });
}

/** Volta só para a Equipe Interna ou para a página da pessoa. */
function teamBackOf(form: FormData): string {
  const back = str(form, "back");
  return /^\/app\/team(\/[A-Za-z0-9_-]{1,64})?(\?[^#\s]*)?$/.test(back)
    ? back
    : "/app/team";
}

/**
 * Suspender e reativar o login da equipe da Wellmix (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, D8): a pessoa segue na equipe. Só o
 * administrador, e não o próprio login (o serviço confere).
 */
export async function setTeamLoginActiveAction(form: FormData) {
  const user = await requireUser();
  const back = teamBackOf(form);
  await run(back, async () => {
    const userId = z.string().min(1).max(100).parse(str(form, "userId"));
    const active = str(form, "active") === "1";
    const target = await setTeamLoginActive(user, userId, active);
    return withQuery(
      withQuery(back, "saved", active ? "login_on" : "login_off"),
      "login",
      target.name.slice(0, 120),
    );
  });
}

/** Trazer de volta para a equipe quem saiu (Excluir acesso). Só o administrador. */
export async function reactivateTeamMemberAction(form: FormData) {
  const user = await requireUser();
  const back = teamBackOf(form);
  await run(back, async () => {
    const userId = z.string().min(1).max(100).parse(str(form, "userId"));
    const target = await reactivateTeamMember(user, userId);
    return withQuery(
      withQuery(back, "saved", "reactivated"),
      "login",
      target.name.slice(0, 120),
    );
  });
}
