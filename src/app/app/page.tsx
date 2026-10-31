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
  const { filter, sent, denied } = await searchParams;
  if (isWellmix(user)) {
    return (
      <ControlTower
        user={user}
        filter={typeof filter === "string" ? filter : undefined}
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
  if (user.role === "customer")
    redirect(
      user.partyId ? `/app/explore${deniedQs}` : `/app/requests${deniedQs}`,
    );
  // Cotação recém-enviada pelo fornecedor: confirmação e próxima a responder.
  return (
    <TaskList
      user={user}
      denied={typeof denied === "string" ? denied : null}
      sent={
        typeof sent === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/.test(sent)
          ? sent
          : null
      }
    />
  );
}
