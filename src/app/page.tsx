import {
  isAppwriteClientConfigured,
  isAppwriteServerConfigured,
} from "@/lib/env";

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      <span>{label}</span>
      <span className="ml-auto text-sm text-zinc-500">
        {ok ? "configurado" : "pendente"}
      </span>
    </li>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Willmix</h1>
        <p className="text-zinc-600">
          Ambiente base pronto. Next.js na Vercel com Appwrite.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Integrações
        </h2>
        <ul className="space-y-3">
          <Status ok={isAppwriteClientConfigured} label="Appwrite (browser)" />
          <Status
            ok={isAppwriteServerConfigured()}
            label="Appwrite (servidor)"
          />
        </ul>
      </section>

      <p className="text-sm text-zinc-500">
        Diagnóstico completo em <code className="font-mono">/api/health</code>.
      </p>
    </main>
  );
}
