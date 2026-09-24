/* eslint-disable @next/next/no-img-element -- SVG estático e leve; next/image não agrega aqui. */

/**
 * Logomarca Wellmix.
 * - "color": selo vermelho original, para fundos claros.
 * - "white": só a marca em branco, para fundos vermelhos ou escuros.
 * A altura define o tamanho; a largura segue a proporção do logo (59,2 × 25,1).
 */
export function WellmixLogo({
  variant = "color",
  className = "h-8",
  title = "Wellmix",
}: {
  variant?: "color" | "white";
  className?: string;
  title?: string;
}) {
  return (
    <img
      src={
        variant === "white"
          ? "/brand/wellmix-logo-white.svg"
          : "/brand/wellmix-logo.svg"
      }
      alt={title}
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
