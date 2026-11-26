import { notFound } from "next/navigation";
import { isPmTab } from "@/lib/project-management";

/**
 * Uma aba da plataforma: a tela é o iframe do layout, que lê a aba pelo
 * endereço. Aqui só se confere que a aba existe.
 */
export default async function ProjectManagementTab({
  params,
}: PageProps<"/app/project-management/[tab]">) {
  const { tab } = await params;
  if (!isPmTab(tab)) notFound();
  return null;
}
