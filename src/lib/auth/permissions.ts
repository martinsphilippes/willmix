import type { Order, Request, Role, User } from "@/lib/db/schema";

export const WILLMIX_ROLES: Role[] = ["admin", "operator"];

export const isWillmix = (user: Pick<User, "role">) =>
  WILLMIX_ROLES.includes(user.role);
export const isAdmin = (user: Pick<User, "role">) => user.role === "admin";

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
  }
}

export function assertWillmix(user: User) {
  if (!isWillmix(user)) throw new ForbiddenError();
}

export function assertRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) throw new ForbiddenError();
}

/** Cliente vê apenas as próprias solicitações; Willmix vê todas. */
export function canViewRequest(user: User, request: Request): boolean {
  if (isWillmix(user)) return true;
  if (user.role === "customer") return request.customerId === user.partyId;
  return false;
}

/** Fornecedor vê uma solicitação apenas por meio da própria cotação. */
export function canViewQuote(
  user: User,
  quote: { supplierId: string },
): boolean {
  if (isWillmix(user)) return true;
  return user.role === "supplier" && quote.supplierId === user.partyId;
}

/**
 * Quem pode abrir um pedido:
 * - Willmix: todos;
 * - cliente: os seus;
 * - fornecedor: os seus;
 * - agência, despachante, armador, transportador: os pedidos em que foram designados;
 * - jurídico: todos (somente leitura, multas).
 */
export function canViewOrder(user: User, order: Order): boolean {
  if (isWillmix(user) || user.role === "legal") return true;
  const party = user.partyId;
  if (!party) return false;
  switch (user.role) {
    case "customer":
      return order.customerId === party;
    case "supplier":
      return order.supplierId === party;
    case "agency":
      return order.agencyId === party;
    case "broker":
      return order.brokerId === party;
    case "shipping_line":
      return order.shippingLineId === party;
    case "carrier":
      return order.carrierId === party;
    default:
      return false;
  }
}

/** Campos financeiros internos: só Willmix. */
export const canSeeInternalCosts = (user: User) => isWillmix(user);
/** Identidade do fornecedor: cliente nunca vê. */
export const canSeeSupplier = (user: User) => user.role !== "customer";
/** Valor de venda ao cliente: fornecedor nunca vê. */
export const canSeeSellPrice = (user: User) =>
  isWillmix(user) || user.role === "customer";
