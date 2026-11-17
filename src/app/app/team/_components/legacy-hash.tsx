"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { legacyTeamHash } from "@/lib/team-list";

/*
 * Endereços antigos da Equipe com "#" (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, etapa 5): o servidor não vê o "#", então o
 * navegador converte ao chegar. `#u-<id>` (a linha da pessoa, depois de
 * salvar) abre o painel da pessoa; `#distribute` (o link "Distribuir" do
 * pedido e dos cartões) leva a Linhas e divisões, no ponto da distribuição.
 * As âncoras das abas (área, cargo, linha) continuam rolando até a linha.
 */
export function LegacyTeamHash() {
  const router = useRouter();
  useEffect(() => {
    const target = legacyTeamHash(window.location.hash, window.location.search);
    if (target) router.replace(target, { scroll: !target.includes("panel=") });
  }, [router]);
  return null;
}
