import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWillmix } from "@/lib/auth/permissions";
import { ControlTower } from "@/components/control-tower";
import { TaskList } from "@/components/task-list";

/** Início: Control Tower para a Willmix; pendências para os demais papéis. */
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  if (isWillmix(user)) return <ControlTower user={user} />;
  return <TaskList user={user} />;
}
