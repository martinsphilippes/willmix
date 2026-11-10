import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { cx } from "@/components/ui";

/*
 * Abas de Configurações (só o administrador vê as do Sankhya): Geral,
 * Integração Sankhya (credenciais, códigos do ERP e testes), Carga do Sankhya
 * (mapeamento e amostra do histórico) e Sankhya:
 * explorar dados (dicionário, consultas, SQL e gravações avulsas).
 */

export type SettingsTab = "general" | "integration" | "load" | "explore";

const TABS: Array<{ key: SettingsTab; href: string }> = [
  { key: "general", href: "/app/settings" },
  { key: "integration", href: "/app/settings/sankhya" },
  { key: "load", href: "/app/settings/sankhya?tab=load" },
  { key: "explore", href: "/app/settings/sankhya?tab=explore" },
];

export function SettingsTabs({
  t,
  active,
  admin,
}: {
  t: Translate;
  active: SettingsTab;
  admin: boolean;
}) {
  if (!admin) return null;
  return (
    <nav
      aria-label={t("settings.title")}
      className="mb-3 flex flex-wrap gap-2"
      data-settings-tabs
    >
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          data-settings-tab={tab.key}
          className={cx(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition",
            active === tab.key
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 hover:text-brand-700",
          )}
        >
          {t(`sankhyaInt.tab.${tab.key}` as DictionaryKey)}
        </Link>
      ))}
    </nav>
  );
}
