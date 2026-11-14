"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";

/*
 * Lista de permissões em linhas compactas, por módulo do portal, com seções
 * que abrem e fecham (Funções e acessos e o painel Editar acessos; dono,
 * 14/11/2026). Cada linha é uma caixa: quem usa diz o que está marcado, o que
 * fica só para leitura e o selo de origem. A busca filtra as linhas e abre as
 * seções que têm resultado.
 */

export interface PermissionItem {
  key: string;
  label: string;
  note?: string | null;
}

export interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionItem[];
}

/** Sem acento e sem diferença de maiúsculas, para a busca. */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function filterGroups(
  groups: PermissionGroup[],
  query: string,
): PermissionGroup[] {
  const q = fold(query.trim());
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          fold(i.label).includes(q) ||
          fold(i.note ?? "").includes(q) ||
          fold(g.label).includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cx(
        "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
        open && "rotate-90",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 5l5 5-5 5" />
    </svg>
  );
}

export function PermissionList({
  groups,
  query,
  open,
  onToggleGroup,
  checked,
  disabled,
  onChange,
  badges,
  attr,
  countLabel,
  emptyText,
}: {
  groups: PermissionGroup[];
  query: string;
  /** Seções abertas (com busca, todas as que têm resultado abrem). */
  open: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  checked: (key: string) => boolean;
  disabled?: (key: string) => boolean;
  onChange?: (key: string, on: boolean) => void;
  /** Selos ao lado da linha (de onde vem a permissão). */
  badges?: (key: string) => ReactNode;
  /** Atributo de dados da caixa (ex.: "data-fn-screen"), para testes. */
  attr: string;
  countLabel: (selected: number, total: number) => string;
  emptyText: string;
}) {
  const shown = filterGroups(groups, query);
  const searching = query.trim().length > 0;
  if (!shown.length)
    return (
      <p
        className="rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500"
        data-perm-empty
      >
        {emptyText}
      </p>
    );
  return (
    <div className="space-y-2">
      {shown.map((group) => {
        const all = groups.find((g) => g.key === group.key)?.items ?? [];
        const selected = all.filter((i) => checked(i.key)).length;
        const isOpen = searching || open.has(group.key);
        const panelId = `perm-${attr}-${group.key}`;
        return (
          <section
            key={group.key}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            data-perm-group={group.key}
          >
            <button
              type="button"
              onClick={() => onToggleGroup(group.key)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex min-h-11 w-full items-center gap-2 bg-zinc-50 px-3 py-2 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
              data-perm-section={group.key}
            >
              <Chevron open={isOpen} />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              <span
                className="shrink-0 text-xs font-medium tabular-nums text-zinc-500"
                data-perm-count={group.key}
              >
                {countLabel(selected, all.length)}
              </span>
            </button>
            {isOpen ? (
              <ul id={panelId} className="divide-y divide-zinc-100">
                {group.items.map((item) => {
                  const off = disabled?.(item.key) ?? false;
                  return (
                    <li key={item.key}>
                      <label
                        className={cx(
                          "flex min-h-11 items-center gap-3 px-3 py-1.5 text-sm",
                          off
                            ? "cursor-default text-zinc-600"
                            : "cursor-pointer text-zinc-800 hover:bg-zinc-50",
                        )}
                        data-perm-row={item.key}
                      >
                        <input
                          type="checkbox"
                          checked={checked(item.key)}
                          disabled={off}
                          onChange={(e) =>
                            onChange?.(item.key, e.target.checked)
                          }
                          className="h-4 w-4 shrink-0 accent-brand-600"
                          {...{ [attr]: item.key }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block leading-tight">
                            {item.label}
                          </span>
                          {item.note ? (
                            <span className="block text-xs leading-tight text-zinc-500">
                              {item.note}
                            </span>
                          ) : null}
                        </span>
                        {badges ? (
                          <span className="flex shrink-0 flex-wrap justify-end gap-1">
                            {badges(item.key)}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
