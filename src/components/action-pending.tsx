"use client";

import { createContext } from "react";

/*
 * Envio em andamento de um `ActionForm` (src/components/action-form.tsx).
 * O formulário dele envia pelo próprio `onSubmit` (para não limpar os campos
 * quando a ação devolve um erro), e o `useFormStatus` do React não enxerga
 * esse envio: o `SubmitButton` lê este contexto para mostrar o indicador e o
 * texto de "Enviando…", como em qualquer outro formulário do portal.
 */
export const ActionPendingContext = createContext(false);
