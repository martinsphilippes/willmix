import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui";
import { TRAINING_PATH } from "@/lib/training";

/**
 * Treinamento do Portal (docs/TRAINING.md): todo login abre, pelo capelo da
 * barra vermelha ou pelo endereço. Só exige estar logado (sem controle de
 * telas). Nesta etapa, só o título: a área de conteúdo fica em branco, à
 * espera dos vídeos, quizzes e provas.
 */
export default async function TrainingPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${TRAINING_PATH}`);
  const t = await getT();
  return (
    <>
      <PageHeader title={t("training.title")} />
      {/* Área de conteúdo do treinamento: em branco nesta etapa. */}
      <div data-training-content />
    </>
  );
}
