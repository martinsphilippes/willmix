"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isActiveHref, type NavIcon } from "@/lib/nav";
import { UserMenu } from "@/components/user-menu";

/*
 * Menu lateral (decisão do dono, 12/11/2026). No computador: barra fixa à
 * esquerda, abaixo do cabeçalho, com os links do dia a dia no alto, os grupos
 * que abrem e fecham (o da tela atual abre sozinho) e, fixos embaixo,
 * Configurações, Equipe e acessos e Auditoria. O botão « recolhe a barra para
 * só os ícones (o nome aparece ao passar o mouse); a escolha e os grupos
 * abertos ficam guardados no navegador. No celular: botão "Menu" que abre o
 * mesmo menu num painel e, no fim, idioma, conta de demonstração e Sair.
 */

export interface NavItemView {
  href: string;
  label: string;
  icon?: NavIcon;
  /** Contador (ex.: mensagens não lidas); zero ou ausente não aparece. */
  badge?: number;
  /** Texto do contador para leitores de tela ("3 esperando ação"). */
  badgeLabel?: string;
  /** Alguma já passou do prazo: o contador fica vermelho. */
  badgeAlert?: boolean;
}
export interface NavEntryView {
  /** Chave estável do grupo (para lembrar se está aberto). */
  id?: string;
  label: string;
  /** Link solto; num grupo, a tela do item pai (o nome abre, a seta abre e fecha). */
  href?: string;
  icon?: NavIcon;
  items?: NavItemView[];
  badge?: number;
  badgeLabel?: string;
  badgeAlert?: boolean;
  /** Item pai: nome da seta para leitores de tela (mostrar / ocultar os subitens). */
  toggle?: { show: string; hide: string };
}

const ICON_PATHS: Record<NavIcon, ReactNode> = {
  tower: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  tasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  messages: <path d="M4 5h16v11H9l-5 4V5Z" />,
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0v4.5l1.6 2.4a.6.6 0 0 1-.5.9H4.9a.6.6 0 0 1-.5-.9L6 13.5V9Z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6" />
      <circle cx="9.5" cy="19.5" r="1.2" />
      <circle cx="17" cy="19.5" r="1.2" />
    </>
  ),
  ship: (
    <>
      <path d="M3 15h18l-2.5 4.5h-13L3 15Z" />
      <path d="M6 15V9h12v6" />
      <path d="M9 9V5h6v4" />
    </>
  ),
  money: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </>
  ),
  folder: (
    <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9.5" r="2.3" />
      <path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 3 7.8 7 9.5 4-1.7 7-5.3 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 9.5V20h12V9.5" />
    </>
  ),
  box: (
    <>
      <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" />
      <path d="M4 7.5 12 11l8-3.5M12 11v9" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.2 7.2a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0l-7.2-7.2a1 1 0 0 1-.3-.7Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  factory: (
    <>
      <path d="M4 20V10.5l5 3v-3l5 3V6h4v14" />
      <path d="M3 20h18" />
      <path d="M7 17h2M11 17h2M15.5 17h1" />
    </>
  ),
};

function Icon({ name, className }: { name?: NavIcon; className?: string }) {
  if (!name) return <span aria-hidden className={className} />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** Selo com o contador ao lado do item (no grupo, a soma dos itens). */
function CountBadge({
  n,
  label,
  dot,
  alert,
}: {
  n?: number;
  label?: string;
  /** Menu recolhido: só um ponto sobre o ícone. */
  dot?: boolean;
  /** Alguma atrasada: vermelho (dono, 14/11/2026). */
  alert?: boolean;
}) {
  if (!n || n <= 0) return null;
  const tone = alert ? "bg-red-600" : "bg-brand-600";
  if (dot)
    return (
      <span
        aria-label={label}
        data-nav-badge={n}
        data-nav-badge-alert={alert ? "1" : undefined}
        className={`absolute right-1.5 top-1 h-2 w-2 rounded-full ${tone} ring-2 ring-white`}
      />
    );
  return (
    <span
      aria-label={label}
      data-nav-badge={n}
      data-nav-badge-alert={alert ? "1" : undefined}
      className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full ${tone} px-1.5 text-[10px] font-bold leading-5 text-white`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

const groupBadge = (items: NavItemView[]) =>
  items.reduce((sum, i) => sum + (i.badge ?? 0), 0);
const groupAlert = (items: NavItemView[]) => items.some((i) => i.badgeAlert);

/** Fecha quando a rota muda (voltar/avançar, navegação por código). */
function useCloseOnNavigate(close: () => void) {
  const pathname = usePathname();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current !== pathname) {
      last.current = pathname;
      close();
    }
  }, [pathname, close]);
}

const COLLAPSED_KEY = "wm-nav-collapsed";
const OPEN_KEY = "wm-nav-open";

function readOpen(): string[] {
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento (aba privada): o menu só não lembra.
  }
}

const rowBase =
  "relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const rowIdle = "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900";
const rowActive = "bg-brand-50 font-semibold text-brand-700";

/** Link do menu (solto ou dentro do grupo). */
function NavRow({
  item,
  collapsed,
  nested,
  onNavigate,
}: {
  item: NavItemView;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = isActiveHref(item.href, pathname);
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      onClick={onNavigate}
      data-nav-link={item.href}
      className={`${rowBase} ${current ? rowActive : rowIdle} ${
        nested ? "py-1.5 pl-10" : ""
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {nested ? null : <Icon name={item.icon} className="h-5 w-5 shrink-0" />}
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      <CountBadge
        n={item.badge}
        label={item.badgeLabel}
        dot={collapsed}
        alert={item.badgeAlert}
      />
    </Link>
  );
}

/** Grupo que abre e fecha; o da tela atual abre sozinho. */
function NavGroupRow({
  entry,
  items,
  open,
  collapsed,
  onToggle,
  onNavigate,
}: {
  entry: NavEntryView;
  items: NavItemView[];
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const id = useId();
  const active = items.some((i) => isActiveHref(i.href, pathname));
  const badge = groupBadge(items);
  const alert = groupAlert(items);
  if (entry.href)
    return (
      <ParentGroupRow
        entry={{ ...entry, href: entry.href }}
        items={items}
        open={open}
        collapsed={collapsed}
        childActive={active}
        badge={badge}
        alert={alert}
        listId={id}
        onToggle={onToggle}
        onNavigate={onNavigate}
      />
    );
  return (
    <div data-nav-group={entry.label}>
      <button
        type="button"
        aria-expanded={collapsed ? undefined : open}
        aria-controls={collapsed ? undefined : id}
        title={collapsed ? entry.label : undefined}
        aria-label={collapsed ? entry.label : undefined}
        onClick={onToggle}
        className={`${rowBase} ${
          active ? "font-semibold text-brand-700" : rowIdle
        } ${active && collapsed ? "bg-brand-50" : ""} ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <Icon name={entry.icon} className="h-5 w-5 shrink-0" />
        {collapsed ? (
          <CountBadge n={badge} dot alert={alert} />
        ) : (
          <>
            <span className="truncate">{entry.label}</span>
            {open ? null : <CountBadge n={badge} alert={alert} />}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
              className={`h-4 w-4 shrink-0 text-zinc-400 transition ${
                badge > 0 && !open ? "" : "ml-auto"
              } ${open ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z"
                clipRule="evenodd"
              />
            </svg>
          </>
        )}
      </button>
      {open && !collapsed ? (
        <div id={id} role="group" className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              collapsed={false}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Item pai com tela própria (ex.: Produção): o nome é o link da tela, com o
 * ícone, alinhado aos outros itens do primeiro nível; a seta ao lado abre e
 * fecha os subitens. Menu recolhido: só o ícone, que abre a tela.
 */
function ParentGroupRow({
  entry,
  items,
  open,
  collapsed,
  childActive,
  badge,
  alert,
  listId,
  onToggle,
  onNavigate,
}: {
  entry: NavEntryView & { href: string };
  items: NavItemView[];
  open: boolean;
  collapsed: boolean;
  childActive: boolean;
  badge: number;
  alert: boolean;
  listId: string;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const here = !childActive && isActiveHref(entry.href, pathname);
  const toggleLabel = open ? entry.toggle?.hide : entry.toggle?.show;
  return (
    <div data-nav-group={entry.label} data-nav-parent={entry.href}>
      <div className="flex items-center gap-0.5">
        <Link
          href={entry.href}
          aria-current={here ? "page" : undefined}
          title={collapsed ? entry.label : undefined}
          aria-label={collapsed ? entry.label : undefined}
          onClick={onNavigate}
          data-nav-link={entry.href}
          className={`${rowBase} min-w-0 flex-1 ${
            here
              ? rowActive
              : childActive
                ? "font-semibold text-brand-700 hover:bg-zinc-100"
                : rowIdle
          } ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Icon name={entry.icon} className="h-5 w-5 shrink-0" />
          {collapsed ? (
            <CountBadge n={badge} dot alert={alert} />
          ) : (
            <>
              <span className="truncate">{entry.label}</span>
              {open ? null : <CountBadge n={badge} alert={alert} />}
            </>
          )}
        </Link>
        {collapsed ? null : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={onToggle}
            data-nav-group-toggle={entry.href}
            className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
              className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
      {open && !collapsed ? (
        <div id={listId} role="group" className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              collapsed={false}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Lista do menu (computador e celular). */
function NavList({
  entries,
  footer,
  label,
  collapsed,
  onExpand,
  onNavigate,
  bottom,
  scroll = true,
}: {
  entries: NavEntryView[];
  footer: NavItemView[];
  label: string;
  collapsed: boolean;
  /** Barra do computador: a lista rola por dentro e o pé fica fixo. */
  scroll?: boolean;
  /** Clicar num grupo com o menu recolhido abre o menu. */
  onExpand?: () => void;
  onNavigate?: () => void;
  bottom?: ReactNode;
}) {
  const pathname = usePathname();
  const current = entries.find(
    (e) =>
      e.items?.some((i) => isActiveHref(i.href, pathname)) ||
      (!!e.items && !!e.href && isActiveHref(e.href, pathname)),
  )?.id;
  // Já no servidor o grupo da tela atual vem aberto (sem piscar).
  const [open, setOpen] = useState<string[]>(current ? [current] : []);
  // Grupos abertos guardados; ao entrar numa tela, o grupo dela abre.
  useEffect(() => {
    const saved = readOpen();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador
    setOpen(current && !saved.includes(current) ? [...saved, current] : saved);
  }, [current]);
  function toggle(id: string) {
    const opened = open.includes(id);
    const next =
      opened && !collapsed
        ? open.filter((v) => v !== id)
        : opened
          ? open
          : [...open, id];
    setOpen(next);
    save(OPEN_KEY, JSON.stringify(next));
    // Com o menu recolhido, clicar no grupo abre o menu já com ele aberto.
    if (collapsed) onExpand?.();
  }
  return (
    <>
      <nav
        aria-label={label}
        className={`space-y-0.5 px-2 py-3 ${
          scroll ? "flex-1 overflow-y-auto overscroll-contain" : ""
        }`}
        data-sidebar-nav
      >
        {entries.map((entry, i) =>
          entry.items ? (
            <div key={entry.id ?? entry.label} className={i > 0 ? "pt-1" : ""}>
              <NavGroupRow
                entry={entry}
                items={entry.items}
                open={open.includes(entry.id ?? entry.label)}
                collapsed={collapsed}
                onToggle={() => toggle(entry.id ?? entry.label)}
                onNavigate={onNavigate}
              />
            </div>
          ) : (
            <NavRow
              key={entry.href}
              item={{
                href: entry.href!,
                label: entry.label,
                icon: entry.icon,
                badge: entry.badge,
                badgeLabel: entry.badgeLabel,
                badgeAlert: entry.badgeAlert,
              }}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>
      {footer.length > 0 || bottom ? (
        <div
          className="space-y-0.5 border-t border-zinc-200 px-2 py-3"
          data-sidebar-footer
        >
          {footer.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
          {bottom}
        </div>
      ) : null}
    </>
  );
}

/** Barra lateral do computador (a partir do tablet). */
export function AppSidebar({
  entries,
  footer,
  labels,
  account,
}: {
  entries: NavEntryView[];
  footer: NavItemView[];
  labels: { main: string; collapse: string; expand: string };
  /** Conta no pé do menu (nome, papel e o cartão com senha e Sair). */
  account?: {
    name: string;
    role: string;
    email: string;
    label: string;
    menu: ReactNode;
  };
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Sem armazenamento: começa aberto.
    }
  }, []);
  function setAndSave(value: boolean) {
    setCollapsed(value);
    save(COLLAPSED_KEY, value ? "1" : "0");
  }
  return (
    <aside
      data-sidebar
      data-sidebar-collapsed={collapsed ? "1" : "0"}
      className={`sticky top-(--wm-header) hidden h-[calc(100dvh-var(--wm-header))] shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-150 md:flex print:hidden ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div
        className={`flex px-2 pt-2 ${collapsed ? "justify-center" : "justify-end"}`}
      >
        <button
          type="button"
          onClick={() => setAndSave(!collapsed)}
          aria-label={collapsed ? labels.expand : labels.collapse}
          title={collapsed ? labels.expand : labels.collapse}
          data-sidebar-toggle
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`}
          >
            <path d="m11 5-5 5 5 5M16 5l-5 5 5 5" />
          </svg>
        </button>
      </div>
      <NavList
        entries={entries}
        footer={footer}
        label={labels.main}
        collapsed={collapsed}
        onExpand={() => setAndSave(false)}
        bottom={
          account ? (
            <div className="mt-2 border-t border-zinc-100 pt-2">
              <UserMenu
                name={account.name}
                role={account.role}
                email={account.email}
                label={account.label}
                placement="sidebar"
                compact={collapsed}
              >
                {account.menu}
              </UserMenu>
            </div>
          ) : null
        }
      />
    </aside>
  );
}

/** Celular: botão que abre o painel com todo o menu e, no fim, os "extras" (idioma, demo, Sair). */
export function MobileNav({
  entries,
  footer,
  labels,
  extras,
}: {
  entries: NavEntryView[];
  footer: NavItemView[];
  labels: { open: string; close: string; main: string };
  extras?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnNavigate(close);
  useEffect(() => {
    if (!open) return;
    // Painel modal: Esc fecha, o resto da página fica inerte, foco entra no
    // painel e volta ao botão ao fechar; crescer a tela (tablet girado) fecha.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMedia = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMedia);
    document.body.style.overflow = "hidden";
    const outside = Array.from(
      document.querySelectorAll<HTMLElement>("main, footer"),
    );
    for (const el of outside) el.setAttribute("inert", "");
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const trigger = button.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMedia);
      document.body.style.overflow = "";
      for (const el of outside) el.removeAttribute("inert");
      trigger?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((v) => !v)}
        data-mobile-menu
        className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10 focus-visible:outline-white"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
          className="h-6 w-6"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open ? (
        <div
          id={id}
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={labels.main}
          data-mobile-panel
          className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col overflow-y-auto bg-white text-zinc-900"
        >
          <NavList
            entries={entries}
            footer={footer}
            label={labels.main}
            collapsed={false}
            onNavigate={close}
            scroll={false}
          />
          {extras ? (
            <div className="space-y-4 border-t border-zinc-200 px-3 py-4">
              {extras}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
