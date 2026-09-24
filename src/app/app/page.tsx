import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { ControlTower } from "@/components/control-tower";
import { TaskList } from "@/components/task-list";

/** Início: Control Tower para a Wellmix; pendências para os demais papéis. */
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  if (isWellmix(user)) return <ControlTower user={user} />;
  return <TaskList user={user} />;
}
