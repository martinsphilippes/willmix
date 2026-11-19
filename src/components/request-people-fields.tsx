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
  /**
   * Cliente sem RCA (dono, 19/11/2026; docs/CUSTOMER_RCA.md seção 7): o
   * campo abre para escolher; o que fechar a venda fica padrão por 30 dias.
   */
  rcaChoose?: string;
  rcaOpenHint?: string;
  rcaCandidates?: string;
  rcaOthers?: string;
  /** "Padrão até {date}: fechou a última venda." */
  rcaLocked?: string;
  rcaNoList?: string;
  intl?: string;
  access: string;
  accessHint: string;
  accessNone: string;
  accessPick: string;
  accessNoLogins: string;
  accessStock: string;
  /** Venda ao cliente: o login é obrigatório (é ele quem confirma). */
  accessRequired?: string;
  accessChoose?: string;
  /** "Todos os logins do cliente ({n})" (dono, 18/11/2026). */
  accessAll?: string;
  accessAllHint?: string;
}

export interface CustomerLogin {
  id: string;
  name: string;
  email: string;
}

interface RcaOption {
  code: string;
  label: string;
}

interface RcaResult {
  key: string;
  failed: boolean;
  rca: {
    code: string;
    name: string | null;
    partnerCode?: string | null;
  } | null;
  /** O RCA que fechou a última venda: padrão até a data. */
  locked?: { until: string } | null;
  /** Cliente sem RCA: os cadastrados para ele e os demais vendedores. */
  open?: { candidates: RcaOption[]; sellers: RcaOption[] } | null;
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
  loginRequired = false,
  initialLogin = "",
  allLogins = false,
  initialRca = "",
}: {
  requesterName: string;
  loginsByCustomer: Record<string, CustomerLogin[]>;
  labels: RequestPeopleLabels;
  /**
   * Venda ao cliente (dono, 15/11/2026; docs/ORDER_TERMS.md): o login do
   * cliente com acesso é obrigatório (é ele quem confirma o pedido).
   */
  loginRequired?: boolean;
  /**
   * Venda da Wellmix ao cliente (dono, 18/11/2026): sem escolher login, a
   * solicitação vai para todos os logins do cliente; o campo só mostra.
   */
  allLogins?: boolean;
  /** Login já escolhido (rascunho). */
  initialLogin?: string;
  /** RCA já escolhido (rascunho; cliente sem RCA). */
  initialRca?: string;
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
        const body = (await res.json()) as Omit<RcaResult, "key" | "failed">;
        setLoaded({
          key: customerId,
          failed: false,
          rca: body.rca ?? null,
          locked: body.locked ?? null,
          open: body.open ?? null,
        });
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
                ? // "CODPARC - APELIDO" (dono, 16/11/2026): o código do
                  // vendedor na empresa e o nome; o CODVEND é interno do
                  // Sankhya e não aparece.
                  mine!.rca!.partnerCode
                  ? `${mine!.rca!.partnerCode} - ${mine!.rca!.name}`
                  : mine!.rca!.name
                : labels.rcaUnknown;

  // Login do cliente com acesso: só os logins do cliente escolhido; trocar
  // de cliente recria o campo e ele volta para "Nenhum" (key).
  const logins = customerId ? (loginsByCustomer[customerId] ?? []) : [];
  const accessHint = stock
    ? labels.accessStock
    : !customerId
      ? labels.accessPick
      : !logins.length
        ? labels.accessNoLogins
        : loginRequired && labels.accessRequired
          ? labels.accessRequired
          : labels.accessHint;

  const accessField =
    allLogins && labels.accessAll ? (
      <Field
        label={labels.access}
        hint={
          stock
            ? labels.accessStock
            : !customerId
              ? labels.accessPick
              : !logins.length
                ? labels.accessNoLogins
                : labels.accessAllHint
        }
      >
        <Input
          readOnly
          value={
            customerId && !stock && logins.length
              ? labels.accessAll.replace("{n}", String(logins.length))
              : ""
          }
          className="bg-zinc-50 text-zinc-700"
          data-request-access-all={logins.length}
        />
      </Field>
    ) : null;

  return (
    <>
      {accessField ?? (
        <Field label={labels.access} hint={accessHint}>
          <Select
            key={customerId ?? (stock ? "stock" : "none")}
            name="requestedForUserId"
            defaultValue={
              logins.some((u) => u.id === initialLogin) ? initialLogin : ""
            }
            required={loginRequired && !stock}
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
            <option value="" disabled={loginRequired}>
              {loginRequired && labels.accessChoose
                ? labels.accessChoose
                : labels.accessNone}
            </option>
            {logins.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={labels.requester} hint={labels.requesterHint}>
        <Input
          readOnly
          value={requesterName}
          className="bg-zinc-50 text-zinc-700"
          data-request-requester
        />
      </Field>
      {rcaState === "none" && mine?.open && labels.rcaChoose ? (
        // Cliente sem RCA: o vendedor escolhe (ou cadastra outro); o que
        // fechar a venda fica como padrão do cliente por 30 dias.
        <Field
          label={labels.rca}
          hint={
            mine.open.candidates.length || mine.open.sellers.length
              ? labels.rcaOpenHint
              : labels.rcaNoList
          }
        >
          <Select
            key={customerId ?? "none"}
            name="rcaCode"
            defaultValue={
              [...mine.open.candidates, ...mine.open.sellers].some(
                (o) => o.code === initialRca,
              )
                ? initialRca
                : mine.open.candidates.length === 1
                  ? mine.open.candidates[0].code
                  : ""
            }
            data-request-rca
            data-request-rca-state="open"
          >
            <option value="">{labels.rcaChoose}</option>
            {mine.open.candidates.length ? (
              <optgroup label={labels.rcaCandidates}>
                {mine.open.candidates.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {mine.open.sellers.length ? (
              <optgroup label={labels.rcaOthers}>
                {mine.open.sellers.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>
      ) : (
        <Field
          label={labels.rca}
          hint={
            rcaState === "ready" && mine?.locked && labels.rcaLocked
              ? labels.rcaLocked.replace(
                  "{date}",
                  new Date(mine.locked.until).toLocaleDateString(
                    labels.intl ?? "pt-BR",
                  ),
                )
              : labels.rcaHint
          }
        >
          <Input
            readOnly
            value={rcaText}
            className="bg-zinc-50 text-zinc-700"
            data-request-rca
            data-request-rca-state={
              rcaState === "ready" && mine?.locked ? "locked" : rcaState
            }
          />
        </Field>
      )}
    </>
  );
}
