import { redirect } from "next/navigation";
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
  const { filter, sent } = await searchParams;
  if (isWellmix(user)) {
    return (
      <ControlTower
        user={user}
        filter={typeof filter === "string" ? filter : undefined}
      />
    );
  }
  if (user.role === "customer") redirect("/app/requests");
  // Cotação recém-enviada pelo fornecedor: confirmação e próxima a responder.
  return (
    <TaskList
      user={user}
      sent={typeof sent === "string" ? sent.slice(0, 64) : null}
    />
  );
}
