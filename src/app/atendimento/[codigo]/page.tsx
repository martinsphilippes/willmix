import type { Metadata } from "next";
import { WellmixLogo } from "@/components/brand";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { publicAttendanceView } from "@/lib/services/portfolio";
import { answerAttendanceAction } from "@/app/app/actions/attendance-public";
import {
  dateTimeBr,
  portfolioError,
} from "@/app/app/portfolio/_components/shared";

/*
 * Confirmação do atendimento pelo cliente (dono, 18/11/2026: o atendimento só
 * vale confirmado por quem atendeu e por quem foi atendido;
 * docs/TRADE_COMERCIAL.md). Página pública: o link é assinado pelo servidor e
 * vale uma vez; aberto, mostra quem atendeu, quando, o canal e o resumo.
 * Respondido, vencido, trocado ou cancelado, só a situação.
 */

/** O código do endereço (base64url e ponto); sequência "%" quebrada vira inválido. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("portfolio.public.title"),
    robots: { index: false, follow: false },
  };
}

export default async function AttendanceConfirmPage({
  params,
  searchParams,
}: PageProps<"/atendimento/[codigo]">) {
  const t = await getT();
  const { codigo } = await params;
  const { done, error } = await searchParams;
  const token = safeDecode(codigo);
  const view = await publicAttendanceView(token);
  const errorText = portfolioError(t, error);
  const finished =
    done === "confirmed"
      ? t("portfolio.public.done.confirmed")
      : done === "disputed"
        ? t("portfolio.public.done.disputed")
        : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 sm:px-6">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8"
        data-attendance-public={view.state}
      >
        <WellmixLogo className="mb-6 h-9" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {t("portfolio.public.title")}
        </h1>
        {finished ? (
          <div className="mt-4" data-attendance-public-done={done}>
            <Alert tone="success">{finished}</Alert>
          </div>
        ) : view.state !== "open" ? (
          <div className="mt-4">
            <Alert tone={view.state === "confirmed" ? "success" : "warning"}>
              {t(`portfolio.public.state.${view.state}` as DictionaryKey)}
            </Alert>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-700">
              {t("portfolio.public.intro", {
                attendant: view.attendantName ?? "—",
                customer: view.customerName ?? "—",
              })}
            </p>
            <dl className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("portfolio.public.when")}
                </dt>
                <dd className="text-zinc-900">
                  {dateTimeBr(t, view.occurredAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("portfolio.public.channel")}
                </dt>
                <dd className="text-zinc-900">
                  {view.channel
                    ? t(`portfolio.channel.${view.channel}` as DictionaryKey)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("portfolio.public.summary")}
                </dt>
                <dd className="whitespace-pre-line text-zinc-900">
                  {view.summary ?? "—"}
                </dd>
              </div>
            </dl>
            {errorText ? (
              <div className="mt-4">
                <Alert tone="danger">{errorText}</Alert>
              </div>
            ) : null}
            <form
              action={answerAttendanceAction}
              className="mt-4 grid gap-3"
              data-attendance-answer
            >
              <input type="hidden" name="token" value={token} />
              <Field label={t("portfolio.public.name")}>
                <Input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="name"
                />
              </Field>
              <Field label={t("portfolio.public.note")}>
                <Textarea name="note" maxLength={2000} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton
                  name="answer"
                  value="confirm"
                  data-attendance-confirm
                >
                  {t("portfolio.public.confirm")}
                </SubmitButton>
                <SubmitButton
                  name="answer"
                  value="dispute"
                  variant="secondary"
                  data-attendance-dispute
                >
                  {t("portfolio.public.dispute")}
                </SubmitButton>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
