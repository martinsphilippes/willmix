import type { Translate } from "@/i18n";
import {
  partnerLogins,
  responsibleLine,
  type Person,
  type Responsible,
  type ResponsibleFix,
  type StepDue,
} from "@/lib/request-responsible";
import { PORTAL_MIN_PASSWORD } from "@/lib/services/portal-access";
import { turnNameKey, type TurnParty } from "@/lib/turn";
import { InfoTip } from "./info-tip";
import { CustomerLoginFix } from "./request-responsible-fix";
import { LinkButton, cx, formatDate } from "./ui";

/*
 * Quem age na próxima ação de uma encomenda (dono, 19/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seções 6 e 7): a 2ª linha da Próxima ação, com
 * a informação complementar (os nomes, o login para o administrador e o que
 * falta no cadastro) num balão. A mesma peça na lista de Encomendas, na
 * página da encomenda e nos detalhes do rascunho.
 */

/** Fuso dos prazos (o dia de hoje e as horas dos SLA). */
export const DUE_TIME_ZONE = "America/Sao_Paulo";

/** O dia do prazo; no SLA (instante), o dia em Brasília. */
export function dueDayText(t: Translate, due: StepDue): string {
  return due.day
    ? formatDate(due.at, t)
    : new Date(due.at).toLocaleDateString(t.intl, {
        timeZone: DUE_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

/** A hora de um instante, em Brasília. */
export function dueHourText(t: Translate, at: string): string {
  return new Date(at).toLocaleTimeString(t.intl, {
    timeZone: DUE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** O prazo numa linha: o dia; no SLA, o dia e a hora. */
export function dueText(t: Translate, due: StepDue): string {
  return due.day
    ? dueDayText(t, due)
    : `${dueDayText(t, due)} ${dueHourText(t, due.at)}`;
}

/** Os rótulos da 2ª linha (responsibleLine). */
export function responsibleLabels(t: Translate) {
  return {
    undefined: t("reqList.resp.undefined"),
    people: (n: number) => t("reqList.resp.people", { n }),
    partners: (n: number) => t("reqList.resp.partners", { n }),
    party: (p: TurnParty) => t(turnNameKey(p)),
  };
}

function PersonItem({ p }: { p: Person }) {
  return (
    <li>
      {p.name}
      {p.login ? <span className="text-zinc-500"> · {p.login}</span> : null}
    </li>
  );
}

const fixButton = "min-h-7 px-2 py-0.5 text-xs";

/**
 * O botão que resolve a falta ali mesmo (dono, 20/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 10): o formulário curto do login do
 * cliente ou o caminho até onde se resolve.
 */
export function ResponsibleFixBlock({
  fix,
  t,
  bare = false,
}: {
  fix: ResponsibleFix;
  t: Translate;
  /** O formulário sozinho no balão (Pendências). */
  bare?: boolean;
}) {
  switch (fix.kind) {
    case "customer_login":
      return (
        <CustomerLoginFix
          bare={bare}
          requestId={fix.requestId}
          login={fix.login}
          name={fix.name}
          password={fix.password}
          minPassword={PORTAL_MIN_PASSWORD}
          texts={{
            title: fix.customer
              ? t("reqFix.customerLogin.title", { customer: fix.customer })
              : t("reqFix.customerLogin.titleNoName"),
            login: t("reqFix.customerLogin.login"),
            loginHint: t("reqFix.customerLogin.loginHint"),
            name: t("reqFix.customerLogin.name"),
            password: t("reqFix.customerLogin.password"),
            passwordHint: t("reqFix.customerLogin.passwordHint", {
              n: PORTAL_MIN_PASSWORD,
            }),
            submit: t("reqFix.customerLogin.submit"),
            working: t("reqFix.customerLogin.working"),
            done: t("reqFix.customerLogin.done"),
            portal: t("reqFix.portal"),
            loginLabel: t("reqFix.login"),
            passwordLabel: t("reqFix.customerLogin.password"),
            copy: t("reqFix.copy"),
            copied: t("reqFix.copied"),
            copyFailed: t("reqFix.copyFailed"),
            changeHint: t("reqFix.customerLogin.changeHint"),
            reassigned: t("reqFix.customerLogin.reassigned"),
            refresh: t("reqFix.refresh"),
          }}
        />
      );
    case "choose_login":
      return (
        <LinkButton
          href={fix.href}
          variant="primary"
          className={fixButton}
          data-request-fix="choose_login"
        >
          {t("reqFix.chooseLogin")}
        </LinkButton>
      );
    case "partner_login":
      return (
        <div
          className="flex flex-wrap gap-1.5"
          data-request-fix="partner_login"
        >
          {fix.partners.map((p) => (
            <LinkButton
              key={p.id}
              href={p.href}
              variant="primary"
              className={fixButton}
              data-request-fix-partner={p.id}
            >
              {t("reqFix.partnerLogin", { name: p.name })}
            </LinkButton>
          ))}
        </div>
      );
    case "function":
      return (
        <LinkButton
          href={fix.href}
          variant="primary"
          className={fixButton}
          data-request-fix="function"
        >
          {t("reqFix.function")}
        </LinkButton>
      );
  }
}

/**
 * O mesmo botão na pendência "Login do cliente a definir" (dono,
 * 20/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 10): "Criar login do
 * cliente…" abre o formulário num balão; "Escolher o login na encomenda"
 * leva direto ao campo.
 */
export function TaskFixButton({
  fix,
  t,
}: {
  fix: ResponsibleFix;
  t: Translate;
}) {
  if (fix.kind !== "customer_login")
    return <ResponsibleFixBlock fix={fix} t={t} />;
  return (
    <InfoTip
      interactive
      label={
        fix.customer
          ? t("reqFix.customerLogin.title", { customer: fix.customer })
          : t("reqFix.customerLogin.titleNoName")
      }
      className="inline-flex min-h-7 cursor-pointer items-center rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white no-underline shadow-sm hover:bg-brand-700"
      trigger={
        <span data-task-fix-open="">{t("reqFix.customerLogin.open")}</span>
      }
    >
      <ResponsibleFixBlock fix={fix} t={t} bare />
    </InfoTip>
  );
}

/** A informação complementar: os nomes, o login (admin) e o que falta. */
function ResponsibleDetail({ r, t }: { r: Responsible; t: Translate }) {
  return (
    <div className="space-y-1.5" data-request-responsible-detail="">
      <p className="font-semibold text-zinc-900">{t("reqList.resp.title")}</p>
      {r.partners.length > 1 ? (
        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {r.partners.map((p) => (
            <li key={p.id}>
              <span className="font-medium text-zinc-900">{p.name}</span>
              {p.dueAt
                ? ` · ${t("reqList.resp.due", { date: dueText(t, { at: p.dueAt, day: false }) })}`
                : ""}
              {p.people.length ? (
                <ul className="ml-3 list-disc">
                  {p.people.map((person) => (
                    <PersonItem key={person.id} p={person} />
                  ))}
                </ul>
              ) : (
                <span className="text-amber-700">
                  {" "}
                  · {t("reqList.resp.noLogin")}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : r.people.length ? (
        <>
          {r.group && r.party !== "wellmix" ? (
            <p className="font-medium text-zinc-900">{r.group}</p>
          ) : null}
          <ul className="max-h-60 list-disc space-y-0.5 overflow-y-auto pl-4">
            {r.people.map((person) => (
              <PersonItem key={person.id} p={person} />
            ))}
          </ul>
        </>
      ) : r.group ? (
        <p className="font-medium text-zinc-900">{r.group}</p>
      ) : null}
      {r.party === "wellmix" && r.group ? (
        <p>{t("reqList.resp.functions", { list: r.group })}</p>
      ) : null}
      {r.missing ? (
        <p
          className="text-amber-800"
          data-request-responsible-missing={r.missing}
        >
          {t(`reqList.resp.missing.${r.missing}`)}
        </p>
      ) : null}
      {r.fix ? <ResponsibleFixBlock fix={r.fix} t={t} /> : null}
      {r.admins.length ? (
        <p className="text-zinc-500">
          {t("reqList.resp.admins", {
            list: r.admins.map((a) => a.name).join(", "),
          })}
        </p>
      ) : null}
    </div>
  );
}

/** 2ª linha da Próxima ação: quem age, com a informação complementar. */
export function ResponsibleTip({
  r,
  t,
  className = "mt-0.5 block max-w-full",
}: {
  r: Responsible | null;
  t: Translate;
  className?: string;
}) {
  if (!r) return null;
  const line = responsibleLine(r, responsibleLabels(t));
  const text = line.where ? `${line.who} · ${line.where}` : line.who;
  return (
    <InfoTip
      label={t("reqList.resp.label", { who: text })}
      className={className}
      // Com o botão que resolve a falta: o balão tem campos e botões.
      interactive={!!r.fix}
      trigger={
        <span
          className={cx(
            "text-xs",
            line.warn ? "font-medium text-amber-700" : "text-zinc-600",
          )}
          data-request-responsible={r.missing ?? "ok"}
        >
          {text}
        </span>
      }
    >
      <ResponsibleDetail r={r} t={t} />
    </InfoTip>
  );
}

/**
 * O login de quem vai agir, à vista (dono, 24/11/2026; docs/TURNS.md): na
 * vez do fornecedor (responder, enviar a amostragem), a linha "Login: …"
 * embaixo de quem age, na tabela da cotação e na lista de cotações, sem
 * precisar abrir o balão. Só para quem vê o login (o administrador).
 */
export function ResponsibleLogins({
  r,
  t,
  className,
}: {
  r: Responsible | null | undefined;
  t: Translate;
  className?: string;
}) {
  const logins = partnerLogins(r);
  if (!logins.length) return null;
  return (
    <span
      className={cx(
        "mt-0.5 block whitespace-normal break-all text-[11px] text-zinc-600",
        className,
      )}
      data-responsible-logins=""
    >
      {t("reqList.resp.logins", { list: logins.join(", ") })}
    </span>
  );
}

/**
 * Quem age num rascunho (dono, 19/11/2026): só quem o salvou, da Wellmix
 * (o rascunho é privado). O login (e-mail) só para o administrador.
 */
export function draftResponsible(
  owner: { id: string; name: string; email?: string | null },
  showLogin: boolean,
): Responsible {
  return {
    party: "wellmix",
    group: null,
    people: [
      {
        id: owner.id,
        name: owner.name,
        login: showLogin ? (owner.email ?? null) : null,
      },
    ],
    admins: [],
    partners: [],
    missing: null,
  };
}
