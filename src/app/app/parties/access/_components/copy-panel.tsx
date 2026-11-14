import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { SCREEN_GROUPS } from "@/lib/auth/screens";
import {
  ALWAYS_OPEN,
  changesKey,
  isGrantable,
  type AccessCell,
  type CopyPreviewRow,
  type ScreenChange,
} from "@/lib/partner-access";
import {
  ACCESS_BASE,
  baseParams,
  closePanelHref,
  type AccessUrlState,
} from "@/lib/partner-access-view";
import type { AccessProfileInfo } from "@/lib/services/partner-access";
import { copyPartnerAccessAction } from "../../../actions/partner-access";
import { Alert, Field, LinkButton, Select, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AutoApply } from "@/components/auto-apply";
import { SidePanel } from "@/components/side-panel";
import { ProfileOptions, kindLabel, profileLabel, screenName } from "./shared";

/*
 * Painel "Copiar acesso" (dono, 14/11/2026): origem, destino, telas e o modo
 * (adicionar ou substituir). A prévia, tela a tela, mostra o valor atual do
 * destino e o que será gravado em "Abre" e "No menu", calculada no servidor
 * com a mesma conta da aplicação. Aplica só depois da confirmação, só no
 * destino e só nas telas escolhidas; sem mudança, "Aplicar cópia" fica
 * desligado. Se a configuração mudar entre a prévia e o clique, nada é
 * gravado e a prévia é refeita.
 */

const checkClass =
  "h-4 w-4 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export function CopyPanel({
  t,
  profiles,
  from,
  to,
  url,
  preview,
  previewError,
  actionError,
}: {
  t: Translate;
  profiles: AccessProfileInfo[];
  from: AccessProfileInfo | null;
  to: AccessProfileInfo | null;
  url: AccessUrlState;
  preview: { rows: CopyPreviewRow[]; changes: ScreenChange[] } | null;
  /** Código do erro da prévia (perfil inválido, nenhuma tela...). */
  previewError: string;
  /** Erro da aplicação (volta da ação), ex.: a prévia ficou velha. */
  actionError: string;
}) {
  const errorText = (code: string) => {
    const key = `partnerAccess.error.${code}`;
    return key in dictionaries.pt
      ? t(key as DictionaryKey)
      : t("partnerAccess.error.partner_access_profile");
  };
  const hidden = baseParams(url);
  const picked = new Set(url.screens);
  const changes = preview?.changes ?? [];
  const canApply = !!(from && to && preview && changes.length);
  const value = (c: AccessCell, field: "open" | "menu") => {
    const v = field === "open" ? c.open : c.menu;
    return v === null
      ? t("partnerAccess.notApplicable")
      : t(v ? "partnerAccess.yes" : "partnerAccess.no");
  };
  const th =
    "border-b border-zinc-200 bg-zinc-50/80 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const td = "border-b border-zinc-100 px-2 py-2 align-middle text-[13px]";
  const arrow = (before: string, after: string, changed: boolean) => (
    <span
      className={cx(
        "inline-flex flex-wrap items-center gap-1 whitespace-nowrap",
        changed ? "font-semibold text-zinc-900" : "text-zinc-500",
      )}
    >
      <span>{before}</span>
      <span aria-hidden>→</span>
      <span className="sr-only">{t("partnerAccess.copy.becomes")}</span>
      <span
        className={cx(
          changed &&
            "rounded bg-amber-100 px-1 ring-1 ring-inset ring-amber-300",
        )}
      >
        {after}
      </span>
    </span>
  );

  return (
    <SidePanel
      title={t("partnerAccess.copy.title")}
      subtitle={t("partnerAccess.copy.hint")}
      closeHref={closePanelHref(url)}
      closeLabel={t("partnerAccess.panel.close")}
      wide
      data-access-panel="copy"
      footer={
        <>
          <LinkButton href={closePanelHref(url)} replace scroll={false}>
            {t("partnerAccess.panel.close")}
          </LinkButton>
          <SubmitButton
            form="access-copy-apply"
            disabled={!canApply}
            confirmText={
              canApply && from && to
                ? t("partnerAccess.copy.confirm", {
                    from: profileLabel(from, t),
                    to: profileLabel(to, t),
                    n: changes.length,
                    users: to.users,
                  })
                : undefined
            }
            data-access-copy-apply
          >
            {t("partnerAccess.copy.applyButton")}
          </SubmitButton>
        </>
      }
    >
      {actionError ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText(actionError)}</Alert>
        </div>
      ) : null}
      <form
        method="get"
        action={ACCESS_BASE}
        className="space-y-4"
        data-access-copy-form
      >
        <input type="hidden" name="panel" value="copy" />
        <input type="hidden" name="preview" value="1" />
        {[...hidden.entries()].map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("partnerAccess.copy.from")}>
            <Select
              name="from"
              defaultValue={from?.key ?? ""}
              data-access-copy-from
            >
              <ProfileOptions profiles={profiles} t={t} />
            </Select>
          </Field>
          <Field label={t("partnerAccess.copy.to")}>
            <Select name="to" defaultValue={to?.key ?? ""} data-access-copy-to>
              <ProfileOptions profiles={profiles} t={t} />
            </Select>
          </Field>
        </div>
        <Field
          label={t("partnerAccess.copy.mode")}
          hint={t("partnerAccess.copy.mode.hint")}
        >
          <Select name="mode" defaultValue={url.mode} data-access-copy-mode>
            <option value="add">{t("partnerAccess.copy.mode.add")}</option>
            <option value="replace">
              {t("partnerAccess.copy.mode.replace")}
            </option>
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-zinc-900">
            {t("partnerAccess.copy.selected")}
          </legend>
          <div className="space-y-2">
            {SCREEN_GROUPS.map((g) => {
              const screens = g.screens.filter(
                (s) => isGrantable(s) && !ALWAYS_OPEN.includes(s),
              );
              if (!screens.length) return null;
              return (
                <div key={g.key}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t(g.key)}
                  </p>
                  <div className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {screens.map((s) => (
                      <label
                        key={s}
                        className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-zinc-800"
                      >
                        <input
                          type="checkbox"
                          name="screens"
                          value={s}
                          defaultChecked={picked.has(s)}
                          className={checkClass}
                          data-access-copy-screen={s}
                        />
                        {screenName(t, s)}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
        <button
          type="submit"
          className="text-sm font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600"
          data-access-copy-preview
        >
          {t("partnerAccess.copy.preview")}
        </button>
        <AutoApply />
      </form>

      <section className="mt-5 border-t border-zinc-200 pt-4">
        <h3 className="text-base font-semibold text-zinc-900">
          {t("partnerAccess.copy.whatChanges")}
        </h3>
        {previewError ? (
          <div className="mt-2">
            <Alert tone="danger">{errorText(previewError)}</Alert>
          </div>
        ) : !preview || !from || !to ? (
          <p className="mt-2 text-sm text-zinc-500" data-access-copy-empty>
            {t("partnerAccess.copy.pickHint")}
          </p>
        ) : (
          <div className="mt-2 space-y-3" data-access-copy-result>
            <p className="text-sm text-zinc-700">
              <strong>{profileLabel(from, t)}</strong> ({kindLabel(from, t)}) →{" "}
              <strong>{profileLabel(to, t)}</strong> ({kindLabel(to, t)})
            </p>
            {changes.length ? (
              <p
                className="text-sm text-zinc-700"
                data-access-copy-count={changes.length}
              >
                {t("partnerAccess.copy.summary", {
                  n: changes.length,
                  to: profileLabel(to, t),
                  users: to.users,
                })}
              </p>
            ) : (
              <div
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
                data-access-copy-none
              >
                <span aria-hidden className="text-lg leading-none">
                  ✓
                </span>
                <span>
                  <strong className="block">
                    {t("partnerAccess.copy.noChange.title")}
                  </strong>
                  {t("partnerAccess.copy.noChange.body", {
                    to: profileLabel(to, t),
                  })}
                </span>
              </div>
            )}
            <div className="-mx-4 overflow-x-auto border-y border-zinc-200 sm:mx-0 sm:rounded-xl sm:border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t("partnerAccess.col.screen")}</th>
                    <th className={th}>{t("partnerAccess.col.open")}</th>
                    <th className={th}>{t("partnerAccess.col.menu")}</th>
                    <th className={cx(th, "hidden sm:table-cell")}>
                      {t("partnerAccess.copy.result")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const change = changes.find((c) => c.screen === r.screen);
                    return (
                      <tr
                        key={r.screen}
                        className={cx(r.changed && "bg-amber-50/60")}
                        data-access-copy-row={r.screen}
                        data-changed={r.changed ? "1" : "0"}
                      >
                        <td className={cx(td, "font-medium text-zinc-900")}>
                          {screenName(t, r.screen)}
                          <span className="mt-0.5 block text-xs font-normal text-zinc-600 sm:hidden">
                            {change
                              ? t(`partnerAccess.change.${change.change}`)
                              : t("partnerAccess.copy.unchanged")}
                          </span>
                        </td>
                        <td className={td}>
                          {arrow(
                            value(r.before, "open"),
                            value(r.after, "open"),
                            r.before.open !== r.after.open,
                          )}
                        </td>
                        <td className={td}>
                          {arrow(
                            value(r.before, "menu"),
                            value(r.after, "menu"),
                            r.before.menu !== r.after.menu,
                          )}
                        </td>
                        <td className={cx(td, "hidden sm:table-cell")}>
                          {change
                            ? t(`partnerAccess.change.${change.change}`)
                            : t("partnerAccess.copy.unchanged")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* A aplicação: só o destino, só as telas escolhidas, só o que a prévia mostrou. */}
      {canApply && from && to ? (
        <form id="access-copy-apply" action={copyPartnerAccessAction} hidden>
          <input type="hidden" name="from" value={from.key} />
          <input type="hidden" name="to" value={to.key} />
          <input type="hidden" name="mode" value={url.mode} />
          <input type="hidden" name="expect" value={changesKey(changes)} />
          {url.screens.map((s) => (
            <input key={s} type="hidden" name="screens" value={s} />
          ))}
          {[...hidden.entries()].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      ) : null}
    </SidePanel>
  );
}
