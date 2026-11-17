"use server";

import { z } from "zod";
import {
  setPartnerLoginActive,
  setRequireActiveParty,
} from "@/lib/services/access-state";
import { requireUser, run, str, withQuery } from "./helpers";

/*
 * Estados de cadastro e login (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7): desativar e reativar login de parceiro e ligar ou desligar a regra
 * "cadastro e login ativos". Só o administrador (o serviço confere). Voltam
 * para a Equipe Externa como estava (busca, filtros e o painel aberto).
 */

/** Volta só para a lista da Equipe Externa, com os parâmetros dela. */
function backOf(form: FormData): string {
  const back = str(form, "back");
  return /^\/app\/parties(\?[^#\s]*)?$/.test(back) ? back : "/app/parties";
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
