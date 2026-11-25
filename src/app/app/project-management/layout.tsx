import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import {
  canSeeProjectManagement,
  PROJECT_MANAGEMENT_PATH,
} from "@/lib/project-management";
import { ProjectFrame } from "./_components/project-frame";

/**
 * Gestão do projeto (dono, 25/11/2026; docs/PROJECT_MANAGEMENT.md): a
 * Plataforma Wellmix v2 inteira num iframe, com as abas dela no menu
 * lateral. O iframe fica no layout, para trocar de aba sem recarregar a
 * plataforma; cada aba é só o endereço (/app/project-management/<aba>).
 */
export default async function ProjectManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${PROJECT_MANAGEMENT_PATH}`);
  if (!canSeeProjectManagement(user)) notFound();
  const t = await getT();
  return (
    <>
      <ProjectFrame
        src={`${PROJECT_MANAGEMENT_PATH}/frame`}
        title={t("pm.frame.title")}
      />
      {children}
    </>
  );
}
