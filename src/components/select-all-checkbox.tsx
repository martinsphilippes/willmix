"use client";

/*
 * "Marcar todos" de uma operação em lote: marca ou desmarca as caixas
 * `name` ligadas ao formulário `formId` (atributo form), estejam onde estiverem
 * na tabela.
 */
export function SelectAllCheckbox({
  formId,
  name,
  label,
}: {
  formId: string;
  name: string;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      title={label}
      data-select-all={formId}
      className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
      onChange={(e) => {
        for (const box of document.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][form="${CSS.escape(formId)}"][name="${CSS.escape(name)}"]`,
        ))
          box.checked = e.currentTarget.checked;
      }}
    />
  );
}
