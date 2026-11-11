import { redirect } from "next/navigation";
import { canOpen } from "@/lib/auth/screens";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { ControlTower } from "@/components/control-tower";
import { TaskList } from "@/components/task-list";

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
  return (
    <TaskList user={user} denied={typeof denied === "string" ? denied : null} />
  );
}
