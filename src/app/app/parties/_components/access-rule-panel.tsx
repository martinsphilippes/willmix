import type { Translate } from "@/i18n";
import type { AccessRules } from "@/lib/access-state";
import type { InactivePartyLogins } from "@/lib/services/access-state";
import { loginLabel } from "@/lib/auth/login-id";
import { SidePanel } from "@/components/side-panel";
import { SubmitButton } from "@/components/submit-button";
import { setAccessRuleAction } from "@/app/app/actions/access-state";

/*
 * Regra "cadastro e login ativos" (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md,
 * R7 e D9): antes de ligar, o administrador vê os parceiros com o cadastro
 * inativo e login ativo (hoje entram) e os logins que deixam de entrar. A
 * regra só vale depois de ligada aqui; desligar volta ao de antes.
 */
export function AccessRulePanel({
  t,
  rules,
  affected,
  closeHref,
  when,
}: {
  t: Translate;
  rules: AccessRules;
  affected: InactivePartyLogins[];
  closeHref: string;
  /** Data e hora da última mudança, já no formato da tela. */
  when: string;
}) {
  const on = rules.requireActiveParty;
  return (
    <SidePanel
      title={t("access.rule.title")}
      subtitle={
        on
          ? t("access.rule.on", { date: when, name: rules.changedBy ?? "—" })
          : t("access.rule.off")
      }
      closeHref={closeHref}
      closeLabel={t("access.rule.close")}
      data-access-rule-panel={on ? "on" : "off"}
      footer={
        <form action={setAccessRuleAction}>
          <input type="hidden" name="back" value={closeHref} />
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <SubmitButton
            variant={on ? "secondary" : "primary"}
            data-access-rule-toggle={on ? "off" : "on"}
          >
            {on ? t("access.rule.turnOff") : t("access.rule.turnOn")}
          </SubmitButton>
        </form>
      }
    >
      {affected.length === 0 ? (
        <p className="text-sm text-zinc-600" data-access-rule-none>
          {t("access.rule.none")}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-zinc-700">
            {t(on ? "access.rule.blockedNow" : "access.rule.affected", {
              n: affected.length,
            })}
          </p>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
            {affected.map((a) => (
              <li
                key={a.party.id}
                className="px-3 py-2"
                data-access-rule-party={a.party.id}
              >
                <span className="font-medium text-zinc-900">
                  {a.party.name}
                </span>
                <span className="block text-xs text-zinc-500">
                  {a.logins.map((l) => loginLabel(l.email)).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {!on ? (
        <p className="mt-3 text-xs text-zinc-500">
          {t("access.rule.turnOnHint")}
        </p>
      ) : null}
    </SidePanel>
  );
}
