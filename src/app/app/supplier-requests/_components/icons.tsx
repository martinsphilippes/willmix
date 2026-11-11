/*
 * Ícones das ações rápidas da solicitação ao fornecedor (tabela e chat):
 * traço simples, cor do texto, sem palavras (o nome vai no aria-label).
 */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ChatBubbleIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}

/** Resposta sim/não: visto e xis. */
export function AnswerIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base} className={className}>
      <path d="m3 12 3.5 3.5L13 9" />
      <path d="m15 9 6 6M21 9l-6 6" />
    </svg>
  );
}

/** Abrir a tela do produto da solicitação. */
export function OpenIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base} className={className}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function SendIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12 20 4l-6 16-3-7-7-1Z" />
    </svg>
  );
}

export function ClipIcon({ className = "h-4 w-4" }) {
  return (
    <svg {...base} className={className}>
      <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" />
    </svg>
  );
}
