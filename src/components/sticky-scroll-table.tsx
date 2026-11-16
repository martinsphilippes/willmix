"use client";

import { useEffect, useRef, type ReactNode } from "react";

/*
 * Tabela larga de consulta (dono, 16/11/2026; Meus books → Book):
 * - o cabeçalho fica logo abaixo da barra do Portal enquanto a página rola,
 *   até o fim da tabela (sticky com top = --wm-header, dentro do bloco da
 *   tabela);
 * - as colunas que não cabem rolam de lado dentro da tabela, e os títulos
 *   rolam junto (as duas caixas, título e corpo, ficam com a mesma posição
 *   lateral: rolar uma move a outra, com o dedo no iPad também);
 * - título e célula usam as mesmas larguras de coluna (table-layout fixed,
 *   o mesmo <colgroup>), então ficam sempre alinhados;
 * - as colunas congeladas (sticky, left) ficam paradas na rolagem lateral; a
 *   borda da última ganha uma sombra leve quando a tabela está rolada.
 *
 * O cabeçalho visível é uma cópia (aria-hidden); a tabela de verdade traz os
 * títulos para leitores de tela.
 */
export function StickyScrollTable({
  head,
  children,
  label,
  ...data
}: {
  /** A tabela só com o cabeçalho (mesmo <colgroup> do corpo). */
  head: ReactNode;
  /** A tabela com o corpo. */
  children: ReactNode;
  /** Nome da região que rola (leitores de tela). */
  label: string;
} & Record<`data-${string}`, string>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    const head = headRef.current;
    const body = bodyRef.current;
    if (!wrap || !head || !body) return;
    const mark = (left: number) => {
      wrap.dataset.scrolled = left > 0 ? "true" : "false";
    };
    // Valores iguais não disparam outro evento: sem laço entre as duas.
    const fromBody = () => {
      if (head.scrollLeft !== body.scrollLeft)
        head.scrollLeft = body.scrollLeft;
      mark(body.scrollLeft);
    };
    const fromHead = () => {
      if (body.scrollLeft !== head.scrollLeft)
        body.scrollLeft = head.scrollLeft;
      mark(head.scrollLeft);
    };
    fromBody();
    body.addEventListener("scroll", fromBody, { passive: true });
    head.addEventListener("scroll", fromHead, { passive: true });
    return () => {
      body.removeEventListener("scroll", fromBody);
      head.removeEventListener("scroll", fromHead);
    };
  }, []);
  return (
    <div ref={wrapRef} className="group/sheet" data-scrolled="false" {...data}>
      <div
        className="sticky z-20 border-b border-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
        style={{ top: "var(--wm-header)" }}
        aria-hidden
        data-sticky-head
      >
        {/* A barra de rolagem lateral fica aqui, logo abaixo dos títulos
            presos: sempre à mão durante a rolagem (a do corpo some). */}
        <div ref={headRef} className="overflow-x-auto [scrollbar-width:thin]">
          {head}
        </div>
      </div>
      <div
        ref={bodyRef}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label={label}
        tabIndex={0}
        data-sticky-body
      >
        {children}
      </div>
    </div>
  );
}
