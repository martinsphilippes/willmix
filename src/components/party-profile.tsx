import type { ReactNode } from "react";
import type { ManufacturerCard, Party, User } from "@/lib/db";
import { loginLabel } from "@/lib/auth/login-id";
import { LOCALE_NAMES, type Translate } from "@/i18n";
import { Badge, Card, TextLink, formatDate } from "@/components/ui";

/**
 * Perfil do cadastro (fornecedor e os demais parceiros): quem é, a loja, o
 * contato e o acesso ao portal, tudo num quadro só, só de leitura. Os dados
 * são os mesmos dos formulários da página; o que falta aparece como "—". A
 * senha não aparece: ela não é guardada à vista (só o login).
 */
export function PartyProfile({
  party,
  users,
  ownerName,
  productCount,
  card,
  t,
}: {
  party: Party;
  users: User[];
  /** Responsável na Wellmix (quando o cadastro tem). */
  ownerName: string | null;
  /** Produtos do fornecedor (nulo: não é fornecedor). */
  productCount: number | null;
  /** Cartão do fabricante mais recente (fornecedor). */
  card: ManufacturerCard | null;
  t: Translate;
}) {
  const none = <span className="text-zinc-400">—</span>;
  const row = (label: ReactNode, value: ReactNode, key: string) => (
    <div
      key={key}
      className="flex items-baseline justify-between gap-3 py-1"
      data-profile-field={key}
    >
      <dt className="shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-zinc-900">
        {value || none}
      </dd>
    </div>
  );
  const block = (title: string, rows: ReactNode[]) => (
    <section className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <dl className="divide-y divide-zinc-200/70">{rows}</dl>
    </section>
  );
  const active = users.filter((u) => u.active);
  return (
    <div className="mt-3" data-party-profile>
      <Card title={t("partyProfile.title")}>
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          {block(t("partyProfile.identity"), [
            row(t("common.name"), party.name, "name"),
            row(t("parties.type"), t(`party.${party.type}`), "type"),
            row(
              t("common.status"),
              <Badge tone={party.active ? "success" : "neutral"}>
                {t(
                  party.active
                    ? "partyProfile.active"
                    : "partyProfile.inactive",
                )}
              </Badge>,
              "status",
            ),
            row(t("parties.taxId"), party.taxId, "taxId"),
            row(
              t("partyProfile.since"),
              formatDate(party.createdAt, t),
              "since",
            ),
            ...(ownerName
              ? [row(t("partyProfile.owner"), ownerName, "owner")]
              : []),
            ...(productCount !== null
              ? [
                  row(
                    t("partyProfile.products"),
                    String(productCount),
                    "products",
                  ),
                ]
              : []),
          ])}
          {block(t("partyProfile.store"), [
            row(t("catalog.party.storeNumber"), party.storeNumber, "store"),
            row(t("catalog.party.city"), party.city, "city"),
            row(t("parties.country"), party.country, "country"),
            row(t("catalog.party.address"), party.address, "address"),
            ...(card?.storeAddress && card.storeAddress !== party.address
              ? [
                  row(
                    t("partyProfile.cardStore"),
                    card.storeAddress,
                    "cardStore",
                  ),
                ]
              : []),
            ...(card?.factoryAddress
              ? [
                  row(
                    t("partyProfile.cardFactory"),
                    card.factoryAddress,
                    "cardFactory",
                  ),
                ]
              : []),
          ])}
          {block(t("partyProfile.contact"), [
            row(
              t("catalog.party.contactName"),
              party.contactName ?? card?.contactName,
              "contact",
            ),
            row(t("parties.phone"), party.phone ?? card?.phone, "phone"),
            row(t("catalog.party.wechat"), party.wechat, "wechat"),
            row(t("common.email"), party.email ?? card?.email, "email"),
            ...(card
              ? [
                  row(
                    t("partyProfile.card"),
                    <TextLink
                      href={`/api/files/${card.documentId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("partyProfile.cardOpen")}
                    </TextLink>,
                    "card",
                  ),
                ]
              : []),
          ])}
          <section
            className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3"
            data-profile-access
          >
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("partyProfile.access")}
            </h3>
            {users.length ? (
              <ul className="divide-y divide-zinc-200/70">
                {users.map((u) => (
                  <li key={u.id} className="py-1.5" data-profile-login={u.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 break-all font-mono text-sm font-semibold text-zinc-900">
                        {loginLabel(u.email)}
                      </span>
                      {u.active ? null : (
                        <Badge tone="neutral">
                          {t("partyProfile.inactive")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {u.name} · {LOCALE_NAMES[u.locale]}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {!active.length ? (
              <p className="flex flex-wrap items-center gap-2 py-1">
                <span data-profile-no-access>
                  <Badge tone="warning">{t("portalAccess.none")}</Badge>
                </span>
                <TextLink href="#access">{t("portalAccess.create")} →</TextLink>
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                {t("partyProfile.passwordNote")}
              </p>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
