import { redirect } from "next/navigation";
import {
  SCREENS,
  SCREEN_LABEL,
  canOpen,
  type Screen,
} from "@/lib/auth/screens";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { ControlTower } from "@/components/control-tower";
import { TaskList } from "@/components/task-list";
import { Alert, Empty, PageHeader } from "@/components/ui";

/**
 * Início: Control Tower para a Wellmix; Solicitações para o cliente (com as
 * pendências e os pedidos em andamento no topo); pendências para os demais papéis.
 */
export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const { filter, card, stage, group, denied } = await searchParams;
  if (isWellmix(user)) {
    return (
      <ControlTower
        user={user}
        filter={typeof filter === "string" ? filter : undefined}
        card={typeof card === "string" ? card : undefined}
        stage={typeof stage === "string" ? stage : undefined}
        group={typeof group === "string" ? group : undefined}
        denied={typeof denied === "string" ? denied : undefined}
      />
    );
  }
  // Tela negada (?denied=…): o aviso segue para o início de cada papel.
  const deniedQs =
    typeof denied === "string" && /^[a-zA-Z]{1,30}$/.test(denied)
      ? `?denied=${denied}`
      : "";
  // Cliente: a vitrine; sem empresa vinculada, a lista de solicitações.
  // Sem a vitrine no perfil (Gestão de telas), vai às solicitações; sem as
  // duas, fica aqui, nas pendências (não entra em ciclo).
  if (user.role === "customer") {
    if (user.partyId && canOpen(user, "explore"))
      redirect(`/app/explore${deniedQs}`);
    if (canOpen(user, "requests")) redirect(`/app/requests${deniedQs}`);
  }
  // Sem Pendências no perfil (Gestão de telas): o início fica com a saudação
  // e o aviso da tela negada; a lista de pendências não aparece aqui também.
  if (!canOpen(user, "tasks")) {
    const t = await getT();
    const deniedScreen =
      typeof denied === "string" &&
      (SCREENS as readonly string[]).includes(denied)
        ? (denied as Screen)
        : null;
    return (
      <>
        <PageHeader
          t={t}
          title={t("nav.home")}
          subtitle={t("home.welcome", { name: user.name })}
        />
        {deniedScreen ? (
          <Alert tone="warning">
            {t("access.denied", { screen: t(SCREEN_LABEL[deniedScreen]) })}
          </Alert>
        ) : null}
        <Empty>
          <span data-home-no-tasks="">{t("partnerAccess.home.noTasks")}</span>
        </Empty>
      </>
    );
  }
  return (
    <TaskList user={user} denied={typeof denied === "string" ? denied : null} />
  );
}
