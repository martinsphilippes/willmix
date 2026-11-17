import type { Translate } from "@/i18n";
import type { Party, User } from "@/lib/db";
import { loginLabel } from "@/lib/auth/login-id";
import { SidePanel } from "@/components/side-panel";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Badge, LinkButton } from "@/components/ui";
import { setPartnerLoginActiveAction } from "@/app/app/actions/access-state";

/*
 * Login de Acesso de um parceiro (Equipe Externa, dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md): os logins ligados ao cadastro, cada um com o
 * estado (ativo, desativado, senha provisória). Abre por cima da lista, pelo
 * endereço (?panel=logins&party=…); fechar volta à lista como estava (busca,
 * filtros, página e rolagem). Gerar, desativar e reativar login é só do
 * administrador (R5, R7).
 */
export function PartyLoginsPanel({
  t,
  party,
  typeLabel,
  logins,
  admin,
  closeHref,
  selfHref,
  requireActiveParty,
  notice,
}: {
  t: Translate;
  party: Pick<Party, "id" | "name" | "active">;
  typeLabel: string;
  logins: Pick<
    User,
    "id" | "name" | "email" | "active" | "mustChangePassword"
  >[];
  admin: boolean;
  closeHref: string;
  /** O endereço deste painel (a volta de desativar e reativar). */
  selfHref: string;
  /** A regra "cadastro e login ativos" está ligada. */
  requireActiveParty: boolean;
  /** Aviso da última ação (salvo ou erro). */
  notice?: { tone: "success" | "danger"; text: string } | null;
}) {
  const status = party.active
    ? t("externalTeam.status.active")
    : t("externalTeam.status.inactive");
  const blockedByParty = requireActiveParty && !party.active;
  return (
    <SidePanel
      title={t("externalTeam.panel.title")}
      subtitle={t("externalTeam.panel.subtitle", {
        name: party.name,
        type: typeLabel,
        status: status.toLowerCase(),
      })}
      closeHref={closeHref}
      closeLabel={t("externalTeam.panel.close")}
      data-party-logins-panel={party.id}
      footer={
        <>
          <LinkButton href={`/app/parties/${party.id}`}>
            {t("externalTeam.panel.openParty")}
          </LinkButton>
          {admin ? (
            <LinkButton
              href={`/app/parties/${party.id}#access`}
              variant="primary"
              data-party-logins-create
            >
              + {t("externalTeam.panel.create")}
            </LinkButton>
          ) : null}
        </>
      }
    >
      {notice ? (
        <div className="mb-3" data-party-logins-notice={notice.tone}>
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      ) : null}
      {!admin ? (
        <div className="mb-3" data-party-logins-admin-only>
          <Alert tone="info">{t("externalTeam.panel.adminOnly")}</Alert>
        </div>
      ) : null}
      {logins.length === 0 ? (
        <p className="text-sm text-zinc-600" data-party-logins-empty>
          {t("externalTeam.panel.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
          {logins.map((u) => (
            <li
              key={u.id}
              className="px-3 py-2"
              data-party-login={u.id}
              data-party-login-state={u.active ? "active" : "inactive"}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words">
                  <span className="font-medium text-zinc-900">{u.name}</span>{" "}
                  <span className="text-zinc-500">· {loginLabel(u.email)}</span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-1">
                  <Badge tone={u.active ? "success" : "neutral"}>
                    {u.active
                      ? t("externalTeam.panel.state.active")
                      : t("externalTeam.panel.state.inactive")}
                  </Badge>
                  {u.mustChangePassword ? (
                    <Badge tone="warning">
                      {t("externalTeam.panel.state.provisional")}
                    </Badge>
                  ) : null}
                  {admin ? (
                    <form action={setPartnerLoginActiveAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={u.active ? "0" : "1"}
                      />
                      <input type="hidden" name="back" value={selfHref} />
                      <SubmitButton
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        confirmText={
                          u.active
                            ? t("access.login.confirmOff", { name: u.name })
                            : undefined
                        }
                        data-party-login-toggle={u.active ? "off" : "on"}
                      >
                        {u.active
                          ? t("access.login.deactivate")
                          : t("access.login.reactivate")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </span>
              </div>
              {u.active && blockedByParty ? (
                <p
                  className="mt-1 text-xs text-red-700"
                  data-party-login-blocked-by-party
                >
                  {t("access.login.blockedByParty")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}
