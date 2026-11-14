"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Caixas "Abre" e "No menu" da aba Acessos externos (dono, 14/11/2026):
 * "No menu" só fica marcada com a tela aberta. Desmarcar "Abre" desmarca e
 * trava "No menu"; marcar "Abre" destrava e já põe a tela no menu (o padrão
 * de uma tela liberada), e o administrador tira se quiser só o endereço
 * direto. Mostra "Alterações não salvas" enquanto o formulário difere do que
 * veio do servidor. O servidor confere tudo de novo ao salvar.
 */
export function AccessMatrix({ unsavedLabel }: { unsavedLabel: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    const boxes = () =>
      [
        ...form.querySelectorAll<HTMLInputElement>(
          "input[type=checkbox][data-access-open], input[type=checkbox][data-access-menu]",
        ),
      ].filter((el) => !el.closest("[data-access-locked]"));
    const snapshot = () =>
      boxes()
        .map((el) => `${el.name}:${el.value}:${el.checked ? 1 : 0}`)
        .join("|");
    const initial = snapshot();
    const onChange = (event: Event) => {
      const el = event.target as HTMLInputElement | null;
      const screen = el?.getAttribute("data-access-open");
      if (el && screen) {
        const menu = form.querySelector<HTMLInputElement>(
          `input[type=checkbox][data-access-menu="${screen}"]`,
        );
        if (menu) {
          menu.disabled = !el.checked;
          menu.checked = el.checked;
        }
      }
      setDirty(snapshot() !== initial);
    };
    form.addEventListener("change", onChange);
    // Hidratado: as caixas já respondem (os testes esperam por esta marca).
    form.setAttribute("data-access-ready", "1");
    return () => {
      form.removeEventListener("change", onChange);
      form.removeAttribute("data-access-ready");
    };
  }, []);
  return (
    <span
      ref={marker}
      role="status"
      className="text-xs font-semibold text-amber-800"
      data-access-unsaved={dirty ? "1" : "0"}
    >
      {dirty ? unsavedLabel : ""}
    </span>
  );
}
