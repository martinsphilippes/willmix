import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { listContainers } from "@/lib/services/containers";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Table,
  Td,
  Textarea,
  TextLink,
  Th,
  cx,
  formatDate,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createContainerAction } from "../actions/logistics";
import {
  bigField,
  containerTone,
  errorMessage,
  formatNumber,
  formatPercent,
} from "./_components/shared";

/** Containers (Wellmix): lista com ocupação e visão comercial + novo container. */
export default async function ContainersPage({
  searchParams,
}: PageProps<"/app/containers">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error } = await searchParams;
  const t = await getT();
  const [rows, settings, customers] = await Promise.all([
    listContainers(),
    getSettings(),
    getStore().list("parties", {
      filter: { type: "customer", active: true },
      orderBy: "name",
    }),
  ]);
  const errorText = errorMessage(t, error);

  return (
    <>
      <PageHeader
        help={{ body: "help.containers.body", steps: "help.containers.steps" }}
        t={t}
        title={t("containers.title")}
        subtitle={t("containers.subtitle")}
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2" title={t("containers.title")}>
          {rows.length === 0 ? (
            <Empty>{t("containers.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("containers.code")}</Th>
                  <Th>{t("containers.type")}</Th>
                  <Th>{t("common.customer")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th className="min-w-40">
                    {t("containers.occupancy")}
                    <span className="block text-[10px] font-medium normal-case tracking-normal text-zinc-400">
                      {t("containers.cbmUsed")}
                    </span>
                  </Th>
                  <Th className="text-right">{t("containers.boxes")}</Th>
                  <Th>{t("containers.soldAvailable")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.container.id} className={rowClass}>
                    <Td className="whitespace-nowrap">
                      <TextLink href={`/app/containers/${row.container.id}`}>
                        {row.container.code}
                      </TextLink>
                      <span className="block text-xs text-zinc-500">
                        ETD {formatDate(row.container.etd)}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {row.container.type}
                      <span className="block text-xs text-zinc-500">
                        {formatNumber(row.container.capacityCbm)} m³
                      </span>
                    </Td>
                    <Td>{row.customerName ?? t("containers.noCustomer")}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={containerTone(row.container.status)}>
                        {t(`containers.status.${row.container.status}`)}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Progress
                          percent={row.usage.occupancyPercent}
                          tone="danger"
                        />
                        <span
                          className={cx(
                            "w-14 shrink-0 text-right text-xs font-semibold tabular-nums",
                            row.usage.overCapacity
                              ? "text-red-700"
                              : "text-zinc-700",
                          )}
                        >
                          {formatPercent(row.usage.occupancyPercent)}
                        </span>
                      </div>
                      <span className="mt-1 block whitespace-nowrap text-xs tabular-nums text-zinc-500">
                        {formatNumber(row.usage.totalCbm, 4)} /{" "}
                        {formatNumber(row.container.capacityCbm)} m³
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {row.usage.boxes}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      <span className="font-medium text-emerald-700">
                        {formatPercent(row.split.soldPercent)}
                      </span>{" "}
                      <span className="text-zinc-400">/</span>{" "}
                      <span className="text-zinc-700">
                        {formatPercent(row.split.availablePercent)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="min-w-0" title={t("containers.new")}>
          <form action={createContainerAction} className="space-y-3">
            <Field label={t("containers.code")} hint={t("containers.codeHint")}>
              <Input
                name="code"
                required
                maxLength={40}
                className={bigField}
                placeholder={t("ph.container.number")}
              />
            </Field>
            <Field label={t("containers.type")}>
              <Select name="type" required className={bigField}>
                {settings.containerTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {t("containers.typeOption", {
                      code: type.code,
                      cbm: formatNumber(type.capacityCbm),
                      kg: formatNumber(type.maxWeightKg),
                    })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("containers.customerOptional")}
              hint={t("containers.customerHint")}
            >
              <Select name="customerId" defaultValue="" className={bigField}>
                <option value="">{t("containers.noCustomer")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("containers.etd")}>
                <Input name="etd" type="date" className={bigField} />
              </Field>
              <Field label={t("containers.eta")}>
                <Input name="eta" type="date" className={bigField} />
              </Field>
            </div>
            <Field label={t("containers.notes")}>
              <Textarea name="notes" rows={2} className={bigField} />
            </Field>
            <SubmitButton className="w-full py-2.5 text-base sm:w-auto sm:py-2 sm:text-sm">
              {t("containers.create")}
            </SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
