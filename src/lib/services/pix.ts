/**
 * Pix "copia e cola" (BR Code estático do Banco Central, padrão EMV QRCPS).
 *
 * Gera o código com chave, recebedor, cidade, valor e referência do pagamento.
 * Não fala com banco nenhum: a confirmação do recebimento continua manual
 * (a Wellmix confere o extrato ou o comprovante e confirma o sinal).
 */

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export class PixError extends Error {}

/** Recebedor (até 25) e cidade (até 15): sem acento, só caracteres seguros. */
function clean(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

/** Valida e normaliza a chave. CPF e CNPJ aceitam pontuação; telefone vira +55... */
export function normalizePixKey(raw: string): {
  key: string;
  type: PixKeyType;
} {
  const value = raw.trim();
  if (!value) throw new PixError("pix_key_empty");
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return { key: value.toLowerCase(), type: "random" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    if (value.length > 77) throw new PixError("pix_key_invalid");
    return { key: value.toLowerCase(), type: "email" };
  }
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) {
    if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 12 || digits.length > 13)
      throw new PixError("pix_key_invalid");
    return { key: `+${digits}`, type: "phone" };
  }
  if (/^[\d.\-/\s]+$/.test(value)) {
    if (digits.length === 11 && validCpf(digits))
      return { key: digits, type: "cpf" };
    if (digits.length === 14 && validCnpj(digits))
      return { key: digits, type: "cnpj" };
  }
  throw new PixError("pix_key_invalid");
}

function validCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function validCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

function field(id: string, value: string): string {
  if (value.length > 99) throw new PixError("pix_field_too_long");
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Referência do pagamento (txid): só letras e números, até 25. */
export function pixReference(prefix: string, id: string): string {
  return `${prefix}${id}`.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
}

export interface PixInput {
  key: string;
  receiverName: string;
  receiverCity: string;
  /** Valor em reais; sem valor, o pagador digita. */
  amount?: number | null;
  reference?: string | null;
  description?: string | null;
}

export function buildPixPayload(input: PixInput): string {
  const { key } = normalizePixKey(input.key);
  const name = clean(input.receiverName, 25);
  const city = clean(input.receiverCity, 15);
  if (!name) throw new PixError("pix_name_empty");
  if (!city) throw new PixError("pix_city_empty");
  if (input.amount !== undefined && input.amount !== null) {
    if (!Number.isFinite(input.amount) || input.amount <= 0)
      throw new PixError("pix_amount_invalid");
  }
  const description = input.description ? clean(input.description, 40) : "";
  const merchant =
    field("00", "br.gov.bcb.pix") +
    field("01", key) +
    (description ? field("02", description) : "");
  const reference = input.reference
    ? pixReference("", input.reference)
    : "***";
  const payload =
    field("00", "01") +
    field("26", merchant) +
    field("52", "0000") +
    field("53", "986") +
    (input.amount ? field("54", input.amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", name) +
    field("60", city) +
    field("62", field("05", reference)) +
    "6304";
  return payload + crc16(payload);
}
