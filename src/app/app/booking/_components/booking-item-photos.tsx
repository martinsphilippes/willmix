/*
 * Foto e cartão do fornecedor de um item do book: as imagens que vieram na
 * linha da planilha. A mesma célula na tela da Wellmix e na do parceiro que
 * lançou o book (o leitor da planilha é um só: services/booking-lots.ts).
 * Clique abre a imagem inteira em outra aba.
 */
export function BookingItemPhotos({
  photoDocumentId,
  cardDocumentId,
  photoLabel,
  cardLabel,
}: {
  photoDocumentId: string | null | undefined;
  cardDocumentId: string | null | undefined;
  photoLabel: string;
  cardLabel: string;
}) {
  const docs = [
    photoDocumentId ? { id: photoDocumentId, label: photoLabel } : null,
    cardDocumentId ? { id: cardDocumentId, label: cardLabel } : null,
  ].filter((d): d is { id: string; label: string } => !!d);
  if (!docs.length) return <span className="text-zinc-400">—</span>;
  return (
    <span className="flex gap-1" data-booking-item-photos={docs.length}>
      {docs.map((doc) => (
        <a
          key={doc.id}
          href={`/api/files/${doc.id}`}
          target="_blank"
          rel="noreferrer"
          title={doc.label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
          <img
            src={`/api/files/${doc.id}`}
            alt={doc.label}
            className="h-10 w-10 rounded border border-zinc-200 object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </span>
  );
}
