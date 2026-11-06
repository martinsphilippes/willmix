"use client";

import { Button } from "./ui";

/** Abre a impressão do navegador (a página já é a versão para imprimir). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => window.print()}
      data-print
    >
      {label}
    </Button>
  );
}
