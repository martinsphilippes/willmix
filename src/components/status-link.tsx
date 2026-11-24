import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, cx, type Tone } from "./ui";

/*
 * O status leva ao lugar de agir (dono, 24/11/2026: "o status tem que ser
 * clicável e direcionar para o local certo... padrão em toda linha de tabela
 * que tenha status"). O selo de quem está com a vez ("Aguardando Wellmix") é
 * um link para onde se faz a etapa em aguardo, o mesmo lugar da pendência.
 * A seta "›" mostra que dá para tocar (no iPad não há o passar do mouse).
 * Sem lugar de agir (ou sem acesso a ele), fica o selo de sempre.
 */
export function StatusLink({
  href,
  tone,
  children,
  title,
  className,
}: {
  href: string | null | undefined;
  tone: Tone;
  children: ReactNode;
  /** Dica: para onde o toque leva ("Abrir onde se faz: …"). */
  title?: string;
  className?: string;
}) {
  if (!href)
    return (
      <Badge tone={tone} className={className}>
        {children}
      </Badge>
    );
  return (
    <Link
      href={href}
      title={title}
      className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      data-status-link=""
    >
      <Badge
        tone={tone}
        className={cx(
          // A seta é do CSS: aparece, mas não entra no texto do selo (a
          // busca e a ordem da tabela leem o texto de sempre).
          "cursor-pointer underline-offset-2 after:content-['›'] hover:underline",
          className,
        )}
      >
        {children}
      </Badge>
    </Link>
  );
}
