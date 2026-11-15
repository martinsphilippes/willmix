"use client";

import { useEffect, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Field, Input, Select } from "./ui";

/** Textos dos campos (no idioma de quem vê). */
export interface RequestPeopleLabels {
  requester: string;
  requesterHint: string;
  rca: string;
  rcaHint: string;
  rcaNone: string;
  rcaPick: string;
  rcaLoading: string;
  rcaError: string;
  rcaStock: string;
  /** "Vendedor {code}" (o código fora da lista do Sankhya). */
  rcaUnknown: string;
  access: string;
  accessHint: string;
  accessNone: string;
  accessPick: string;
  accessNoLogins: string;
  accessStock: string;
}

export interface CustomerLogin {
  id: string;
  name: string;
  email: string;
}

interface RcaResult {
  key: string;
  failed: boolean;
  rca: { code: string; name: string | null } | null;
}

/**
 * Solicitante, RCA do cliente e Login do cliente com acesso na Nova
 * solicitação (dono, 15/11/2026; docs/CUSTOMER_RCA.md), ao lado do campo
 * Cliente (lêem o cliente escolhido do RequestCustomerProvider):
 * - Solicitante: o login que está criando (o servidor grava pela sessão;
 *   o campo só mostra);
 * - RCA do cliente: o do cadastro do cliente, só consulta; troca junto com
 *   o cliente; "Sem RCA vinculado" quando não há;
 * - Login do cliente com acesso: o seletor de antes (`requestedForUserId`,
 *   só esse login do cliente vê), agora só com os logins do cliente
 *   escolhido (o servidor recusa login de outro cliente). Troca de cliente
 *   volta para "Nenhum"; compra para estoque limpa o RCA e o acesso.
 */
export function RequestPeopleFields({
  requesterName,
  loginsByCustomer,
  labels,
}: {
  requesterName: string;
  loginsByCustomer: Record<string, CustomerLogin[]>;
  labels: RequestPeopleLabels;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  const customerId = stock ? null : (shared?.customer?.id ?? null);

  const [loaded, setLoaded] = useState<RcaResult | null>(null);
  useEffect(() => {
    if (!customerId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/parties/rca?customer=${encodeURIComponent(customerId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { rca: RcaResult["rca"] };
        setLoaded({ key: customerId, failed: false, rca: body.rca ?? null });
      } catch {
        if (controller.signal.aborted) return;
        setLoaded({ key: customerId, failed: true, rca: null });
      }
    })();
    return () => controller.abort();
  }, [customerId]);
  // Só vale o resultado do cliente escolhido agora (a troca limpa na hora).
  const mine = customerId && loaded?.key === customerId ? loaded : null;
  const rcaState = stock
    ? "stock"
    : !customerId
      ? "pick"
      : !mine
        ? "loading"
        : mine.failed
          ? "error"
          : mine.rca
            ? "ready"
            : "none";
  const rcaText =
    rcaState === "stock"
      ? labels.rcaStock
      : rcaState === "pick"
        ? labels.rcaPick
        : rcaState === "loading"
          ? labels.rcaLoading
          : rcaState === "error"
            ? labels.rcaError
            : rcaState === "none"
              ? labels.rcaNone
              : mine!.rca!.name
                ? `${mine!.rca!.name} (${mine!.rca!.code})`
                : labels.rcaUnknown.replace("{code}", mine!.rca!.code);

  // Login do cliente com acesso: só os logins do cliente escolhido; trocar
  // de cliente recria o campo e ele volta para "Nenhum" (key).
  const logins = customerId ? (loginsByCustomer[customerId] ?? []) : [];
  const accessHint = stock
    ? labels.accessStock
    : !customerId
      ? labels.accessPick
      : !logins.length
        ? labels.accessNoLogins
        : labels.accessHint;

  return (
    <>
      <Field label={labels.access} hint={accessHint}>
        <Select
          key={customerId ?? (stock ? "stock" : "none")}
          name="requestedForUserId"
          defaultValue=""
          disabled={!customerId || !logins.length}
          data-request-access
          data-request-access-state={
            stock
              ? "stock"
              : !customerId
                ? "pick"
                : logins.length
                  ? "ready"
                  : "none"
          }
        >
          <option value="">{labels.accessNone}</option>
          {logins.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </Select>
      </Field>
      <Field label={labels.requester} hint={labels.requesterHint}>
        <Input
          readOnly
          value={requesterName}
          className="bg-zinc-50 text-zinc-700"
          data-request-requester
        />
      </Field>
      <Field label={labels.rca} hint={labels.rcaHint}>
        <Input
          readOnly
          value={rcaText}
          className="bg-zinc-50 text-zinc-700"
          data-request-rca
          data-request-rca-state={rcaState}
        />
      </Field>
    </>
  );
}
