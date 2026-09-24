import { redirect } from "next/navigation";

/** Raiz: envia para a área autenticada (o proxy redireciona ao login se preciso). */
export default function Home() {
  redirect("/app");
}
