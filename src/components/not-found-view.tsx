import { getT } from "@/i18n/server";
import { WellmixLogo } from "./brand";
import { LinkButton } from "./ui";

/** 404 com a marca: endereço inexistente ou recurso fora do alcance do papel do usuário. */
export async function NotFoundView({ withLogo = false }: { withLogo?: boolean }) {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      {withLogo ? <WellmixLogo className="mb-10 h-12" /> : null}
      <p className="text-6xl font-bold tracking-tight text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
        {t("notFound.title")}
      </h1>
      <p className="mt-3 leading-relaxed text-zinc-600">{t("notFound.body")}</p>
      <LinkButton href="/app" variant="primary" className="mt-8">
        {t("notFound.back")}
      </LinkButton>
    </div>
  );
}
