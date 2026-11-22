import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { SupplierRequestSampling } from "@/lib/db/schema";
import { samplingRoundFiles } from "@/lib/supplier-request-sampling";
import { Badge, Card } from "@/components/ui";
import { CopyImageButton } from "@/components/copy-image-button";
import { SAMPLING_TONE } from "./status";

/*
 * Imagens na tela do item da cotação (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Imagens na tela do item"): na coluna da
 * direita, sempre à vista enquanto se negocia, em grupos com nome:
 * - "Referência da Wellmix": o que a Wellmix mandou ao fornecedor (as fotos
 *   do cadastro do produto ou a foto do item do book);
 * - "Amostra de <fornecedor>": o que cada fornecedor já subiu na rodada
 *   atual, com a situação, mesmo antes de aprovada.
 * Cada foto abre grande num clique e tem o botão de copiar, para colar no
 * chat e citar um ponto. Fora do chat, que fica só com as mensagens.
 */

export interface ItemSample {
  key: string;
  supplierName: string;
  /** Nula: sem amostragem (dispensada ou recusou a cotação). */
  sampling: SupplierRequestSampling | null;
  /** Fornecedor conhecido do produto: a amostragem é dispensada. */
  skipped?: boolean;
}

function Thumb({
  src,
  video = false,
  alt,
  t,
}: {
  src: string;
  video?: boolean;
  alt: string;
  t: Translate;
}) {
  return (
    <li className="relative" data-item-image={video ? "video" : "photo"}>
      {video ? (
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          className="h-20 w-full rounded-md border border-zinc-200 bg-black object-contain"
        />
      ) : (
        <>
          <a href={src} target="_blank" rel="noreferrer" title={alt}>
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={src}
              alt={alt}
              className="h-20 w-full rounded-md border border-zinc-200 object-cover"
            />
          </a>
          <CopyImageButton
            src={src}
            label={t("itemImages.copy")}
            doneLabel={t("itemImages.copied")}
          />
        </>
      )}
    </li>
  );
}

const Group = ({
  title,
  mark,
  children,
}: {
  title: ReactNode;
  mark: string;
  children: ReactNode;
}) => (
  <section data-item-images-group={mark}>
    <h3 className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-700">
      {title}
    </h3>
    {children}
  </section>
);

const grid = "grid grid-cols-3 gap-1.5";

export function ItemImagesCard({
  reference,
  referenceFrom,
  samples,
  t,
}: {
  /** Documentos das fotos que a Wellmix mandou ao fornecedor. */
  reference: string[];
  referenceFrom: "product" | "book";
  samples: ItemSample[];
  t: Translate;
}) {
  const sampled = samples.filter((x) => x.sampling || x.skipped);
  if (!reference.length && !sampled.length) return null;
  return (
    <Card title={t("itemImages.title")} dense>
      <div className="space-y-3" data-item-images>
        <p className="text-[11px] text-zinc-500">{t("itemImages.hint")}</p>
        <Group
          mark="reference"
          title={
            <>
              {t("itemImages.reference")}
              <span className="font-normal text-zinc-500">
                {t(`itemImages.from.${referenceFrom}`)}
              </span>
            </>
          }
        >
          {reference.length ? (
            <ul className={grid}>
              {reference.map((id) => (
                <Thumb
                  key={id}
                  src={`/api/files/${id}`}
                  alt={t("itemImages.reference")}
                  t={t}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">
              {t("itemImages.noReference")}
            </p>
          )}
        </Group>
        {sampled.map((x) => {
          const files = x.sampling ? samplingRoundFiles(x.sampling) : [];
          return (
            <Group
              key={x.key}
              mark={x.key}
              title={
                <>
                  {t("itemImages.sampleOf", { name: x.supplierName })}
                  {x.sampling ? (
                    <Badge tone={SAMPLING_TONE[x.sampling.status]}>
                      {t(
                        `sampling.status.${x.sampling.status}` as DictionaryKey,
                      )}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{t("quoteSampling.skipped")}</Badge>
                  )}
                </>
              }
            >
              {files.length ? (
                <ul className={grid}>
                  {files.map((f) => (
                    <Thumb
                      key={f.documentId}
                      src={`/api/files/${f.documentId}`}
                      video={f.kind === "video"}
                      alt={f.fileName}
                      t={t}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">
                  {t(
                    x.skipped
                      ? "quoteSampling.skippedHint"
                      : "itemImages.noSample",
                  )}
                </p>
              )}
            </Group>
          );
        })}
      </div>
    </Card>
  );
}
