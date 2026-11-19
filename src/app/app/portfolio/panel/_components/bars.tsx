/**
 * Barras horizontais simples (as do painel do Projeto Campineira): o rótulo,
 * a barra proporcional ao maior valor e o número. Sem biblioteca de gráfico.
 */
export function Bars({
  items,
  format,
  empty,
  testId,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  format: (n: number) => string;
  empty: string;
  testId?: string;
}) {
  if (!items.length) return <p className="text-sm text-zinc-500">{empty}</p>;
  const top = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-1.5" data-panel-bars={testId ?? ""}>
      {items.map((i, n) => (
        <li
          key={`${i.label}-${n}`}
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
          title={i.hint ?? i.label}
        >
          <span className="truncate text-zinc-700">{i.label}</span>
          <span className="h-2.5 overflow-hidden rounded bg-zinc-100">
            <span
              className="block h-2.5 rounded bg-brand-600"
              style={{ width: `${Math.max(1, (i.value / top) * 100)}%` }}
            />
          </span>
          <span className="tabular-nums text-zinc-800">{format(i.value)}</span>
        </li>
      ))}
    </ul>
  );
}
