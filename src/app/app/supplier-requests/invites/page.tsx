import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import { isWellmix } from "@/lib/auth/permissions";
import { LinkButton, PageHeader } from "@/components/ui";
import { InvitesTable } from "../_components/invites-table";

/*
 * Convites para booking concorrente (docs/BOOKING_INVITES.md): o parceiro vê
 * os dele e responde subindo o booking; a Wellmix vê todos. Para a Wellmix,
 * a mesma tabela está na aba "Convites de book" da Cotação (dono,
 * 22/11/2026; docs/QUOTATION.md); este endereço continua abrindo.
 */

export default async function BookingInvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/supplier-requests/invites");
  requireScreen(user, "quotes");
  const t = await getT();
  const wellmix = isWellmix(user);
  return (
    <>
      <PageHeader
        t={t}
        title={t("bookingInvites.list.title")}
        subtitle={t(
          wellmix
            ? "bookingInvites.list.subtitleWellmix"
            : "bookingInvites.list.subtitle",
        )}
        actions={
          <LinkButton href="/app/supplier-requests">
            {t(wellmix ? "nav.quotation" : "nav.supplierRequests")}
          </LinkButton>
        }
      />
      <InvitesTable user={user} t={t} />
    </>
  );
}
