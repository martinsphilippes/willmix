import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { ControlTower } from "@/components/control-tower";
import { TaskList } from "@/components/task-list";

/** Início: Control Tower para a Wellmix; pendências para os demais papéis. */
export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const { filter } = await searchParams;
  if (isWellmix(user)) {
    return (
      <ControlTower
        user={user}
        filter={typeof filter === "string" ? filter : undefined}
      />
    );
  }
  return <TaskList user={user} />;
}
