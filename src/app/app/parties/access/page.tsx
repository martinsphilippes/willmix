import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { isScreen, type Screen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import type { CopyPreviewRow, ScreenChange } from "@/lib/partner-access";
import {
  panelHref,
  parseAccessUrl,
  viewHref,
  type AccessView,
} from "@/lib/partner-access-view";
import {
  listAccessProfiles,
  previewCopyRows,
} from "@/lib/services/partner-access";
import { Alert, Card, LinkButton, cx } from "@/components/ui";
import { PartiesHeader } from "../_components/parties-header";
import { ProfileView } from "./_components/profile-view";
import { ScreenView } from "./_components/screen-view";
import { ComparePanel } from "./_components/compare-panel";
import { CopyPanel } from "./_components/copy-panel";
import { profileLabel } from "./_components/shared";

/*
 * Acessos externos (docs/PARTNER_ACCESS.md), a aba de Cadastros → Parceiros
 * que reúne a antiga Gestão de telas (dono, 14/11/2026): as visões "Por tipo
 * ou perfil" e "Por tela" no mesmo quadro; "Comparar acessos" e "Copiar
 * acesso" em painéis laterais por cima, que ao fechar devolvem a visão e os
 * filtros. Tudo lido das permissões efetivas no servidor (as mesmas que a
 * sessão do login externo usa). Só o administrador.
 */

const SWITCH: { view: AccessView; label: DictionaryKey }[] = [
  { view: "profile", label: "partnerAccess.tab.profile" },
  { view: "screen", label: "partnerAccess.tab.screen" },
];

export default async function PartnerAccessPage({
  searchParams,
}: PageProps<"/app/parties/access">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const t = await getT();
  const sp = await searchParams;
  if (!isAdmin(user))
    return (
      <>
        <PartiesHeader t={t} user={user} active="access" />
        <Alert tone="info">{t("partnerAccess.adminOnly")}</Alert>
      </>
    );

  const url = parseAccessUrl(sp);
  const one = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";
  const profiles = await listAccessProfiles();
  const byKey = (key: string) => profiles.find((p) => p.key === key) ?? null;
  const current = byKey(url.profile) ?? profiles[0];
  const screen: Screen = isScreen(url.screen) ? url.screen : "orders";

  const error = one("error");
  const errorText = (code: string) => {
    const key = `partnerAccess.error.${code}`;
    return key in dictionaries.pt ? t(key as DictionaryKey) : t("common.error");
  };
  const saved = one("saved");
  const copied = byKey(one("copied"));

  /* --------------------------- Painel: comparar --------------------------- */
  const compareA = byKey(url.a) ?? current;
  const compareB =
    byKey(url.b) ??
    (compareA.key !== "role:supplier"
      ? byKey("role:supplier")
      : profiles.find((p) => p.key !== compareA.key)) ??
    profiles[0];

  /* ---------------------------- Painel: copiar ---------------------------- */
  const copyTo = byKey(url.to) ?? current;
  const copyFrom =
    byKey(url.from) ??
    (copyTo.key !== "role:supplier"
      ? byKey("role:supplier")
      : profiles.find((p) => p.key !== copyTo.key)) ??
    null;
  let preview: { rows: CopyPreviewRow[]; changes: ScreenChange[] } | null =
    null;
  let previewError = "";
  if (url.panel === "copy" && copyFrom && url.screens.length) {
    try {
      preview = await previewCopyRows(
        copyFrom.key,
        copyTo.key,
        url.screens,
        url.mode,
      );
    } catch (e) {
      previewError = e instanceof Error ? e.message : "unexpected";
    }
  }

  return (
    <>
      <PartiesHeader
        t={t}
        user={user}
        active="access"
        subtitle={t("partnerAccess.subtitle")}
        actions={
          <>
            <LinkButton
              href={panelHref(url, "compare", { a: current.key })}
              scroll={false}
              data-access-open-compare
            >
              <span aria-hidden>⇄</span>
              {t("partnerAccess.compare.title")}
            </LinkButton>
            <LinkButton
              href={panelHref(url, "copy", { to: current.key })}
              scroll={false}
              data-access-open-copy
            >
              <span aria-hidden>⧉</span>
              {t("partnerAccess.copy.title")}
            </LinkButton>
          </>
        }
      />
      <div className="mb-3 space-y-2">
        {error && url.panel !== "copy" ? (
          <Alert tone="danger">{errorText(error)}</Alert>
        ) : null}
        {saved ? (
          <div data-access-saved={saved}>
            <Alert tone="success">
              {saved === "reset"
                ? t("partnerAccess.saved.reset")
                : saved === "0"
                  ? t("partnerAccess.saved.none")
                  : copied
                    ? t("partnerAccess.saved.copy", {
                        profile: profileLabel(copied, t),
                        n: saved,
                      })
                    : t("partnerAccess.saved.profile", {
                        profile: profileLabel(current, t),
                        n: saved,
                      })}
            </Alert>
          </div>
        ) : null}
      </div>

      <Card>
        <nav
          aria-label={t("partnerAccess.view.label")}
          className="mb-4 inline-flex rounded-lg bg-zinc-100 p-1"
          data-access-tabs
        >
          {SWITCH.map((v) => (
            <Link
              key={v.view}
              href={viewHref(url, v.view)}
              aria-current={url.view === v.view ? "page" : undefined}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                url.view === v.view
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-zinc-700 hover:bg-white hover:text-zinc-900",
              )}
              data-access-tab={v.view}
            >
              {t(v.label)}
            </Link>
          ))}
        </nav>
        {url.view === "screen" ? (
          <ScreenView t={t} profiles={profiles} screen={screen} url={url} />
        ) : (
          <ProfileView t={t} profiles={profiles} current={current} url={url} />
        )}
      </Card>

      {url.panel === "compare" ? (
        <ComparePanel
          t={t}
          profiles={profiles}
          a={compareA}
          b={compareB}
          url={url}
        />
      ) : null}
      {url.panel === "copy" ? (
        <CopyPanel
          t={t}
          profiles={profiles}
          from={copyFrom}
          to={copyTo}
          url={url}
          preview={preview}
          previewError={previewError}
          actionError={error}
        />
      ) : null}
    </>
  );
}
