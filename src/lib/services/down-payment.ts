import "server-only";

import QRCode from "qrcode";
import { getStore, type Payment, type Request, type User } from "@/lib/db";
import { canViewRequest } from "@/lib/auth/permissions";
import { getSettings, type Settings } from "@/lib/settings";
import { audit } from "./audit";
import { uploadDocument } from "./documents";
import { notifyWellmix } from "./notifications";
import { buildPixPayload, normalizePixKey, pixReference } from "./pix";

export class DownPaymentError extends Error {}

export type PixUnavailable = "not_configured" | "not_brl" | "no_amount";

export interface PixForRequest {
  payload: string;
  /** QR Code do mesmo código, como imagem SVG (data URL). */
  qrDataUrl: string;
  key: string;
  receiverName: string;
  receiverCity: string;
  amount: number;
  reference: string;
}

/**
 * Pix do sinal da solicitação, com valor e referência. Só para valor em reais e
 * com a chave configurada pelo admin; caso contrário diz por que não há Pix.
 */
export async function pixForRequest(
  request: Request,
  settings?: Settings,
): Promise<PixForRequest | { unavailable: PixUnavailable }> {
  const s = settings ?? (await getSettings());
  if (!s.pixKey || !s.pixReceiverName || !s.pixReceiverCity)
    return { unavailable: "not_configured" };
  if ((request.sellCurrency ?? "").toUpperCase() !== "BRL")
    return { unavailable: "not_brl" };
  const amount = request.downPaymentAmount;
  if (!amount || amount <= 0) return { unavailable: "no_amount" };
  const reference = pixReference("WMX", request.id);
  const payload = buildPixPayload({
    key: s.pixKey,
    receiverName: s.pixReceiverName,
    receiverCity: s.pixReceiverCity,
    amount,
    reference,
  });
  const svg = await QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
  return {
    payload,
    qrDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    key: normalizePixKey(s.pixKey).key,
    receiverName: s.pixReceiverName,
    receiverCity: s.pixReceiverCity,
    amount,
    reference,
  };
}

/** Pagamento do sinal (entrada do cliente) da solicitação, se houver. */
export async function downPaymentOf(
  requestId: string,
): Promise<Payment | null> {
  const [payment] = await getStore().list("payments", {
    filter: { requestId, direction: "customer_in" },
    limit: 1,
  });
  return payment ?? null;
}

/**
 * Cliente anexa o comprovante do sinal. Só o login que vê a solicitação, só
 * enquanto ela aguarda o sinal. O pagamento segue pendente: quem confirma é a
 * Wellmix (o comprovante não é prova de crédito na conta).
 */
export async function submitDownPaymentProof(
  user: User,
  requestId: string,
  file: File,
): Promise<Payment> {
  if (user.role !== "customer") throw new DownPaymentError("forbidden");
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request || !canViewRequest(user, request))
    throw new DownPaymentError("not_found");
  if (request.status !== "WAITING_DOWN_PAYMENT")
    throw new DownPaymentError("invalid_status");
  if (!(file instanceof File) || file.size === 0)
    throw new DownPaymentError("proof_required");
  const payment = await downPaymentOf(requestId);
  if (!payment || payment.status !== "pending")
    throw new DownPaymentError("invalid_status");
  const doc = await uploadDocument(user, file, {
    requestId,
    type: "proof",
    // Cliente e Wellmix abrem; fornecedor não.
    visibility: "customer",
  });
  const updated = await store.update("payments", payment.id, {
    proofDocumentId: doc.id,
  });
  await audit(
    user,
    "payment.proof",
    "request",
    requestId,
    `Comprovante do sinal enviado pelo cliente: ${doc.name}`,
  );
  await notifyWellmix({
    subject: `Comprovante do sinal: ${request.productName}`,
    body: "O cliente anexou o comprovante do sinal. Confira o recebimento e confirme o sinal para criar o pedido.",
    link: `/app/requests/${requestId}`,
  });
  return updated;
}
