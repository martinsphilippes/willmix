import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWillmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveProductAction } from "../actions";

export default async function ProductsPage({
  searchParams,
}: PageProps<"/app/products">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWillmix(user);
  const { error } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [products, lines] = await Promise.all([
    store.list("products", { orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
  ]);

  return (
    <>
      <PageHeader
        title={t("products.title")}
        actions={
          <LinkButton href="/app/import?entity=products">
            {t("parties.import")}
          </LinkButton>
        }
      />
      {error ? <Alert tone="danger">{t("common.error")}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {products.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.name")}</Th>
                  <Th>SKU</Th>
                  <Th>{t("nav.lines")}</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium">{p.name}</Td>
                    <Td>{p.sku ?? "—"}</Td>
                    <Td>{lines.find((l) => l.id === p.lineId)?.name ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card title={`${t("common.new")} ${t("common.product").toLowerCase()}`}>
          <form action={saveProductAction} className="space-y-3">
            <Field label={t("common.name")}>
              <Input name="name" required />
            </Field>
            <Field label="SKU">
              <Input name="sku" />
            </Field>
            <Field label={t("nav.lines")}>
              <Select name="lineId" required defaultValue="">
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("requests.specification")}>
              <Textarea name="specification" />
            </Field>
            <SubmitButton>{t("common.save")}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
