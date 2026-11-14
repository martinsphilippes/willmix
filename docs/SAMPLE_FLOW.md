# Amostras depois da inspeção e fotos reais

Mapa do processo, etapa Produção (R12 a R16 e R5). Decisões do dono em
14/11/2026, a partir do pedido de amostras (docs/SAMPLE_ORDER.md, 5 × 3 × Nm
por produto, Nm = variantes):

- **Divisão fixa:** de cada 5, **4 vão ao show room no Brasil** e **1 à
  agência de marketing na China**, ou seja, 4 × 3 × Nm e 1 × 3 × Nm.
- **Agência de marketing (China):** parceiro novo, com login próprio
  (papel `marketing_agency`), designado no pedido em Parceiros do pedido.
  Sem agência designada, a Wellmix faz a parte dela.
- **Fotos reais:** o **marketing aprova e ativa**. Ao aprovar, as fotos
  reais viram as principais do catálogo e o produto é liberado para venda.
- **Fotos de referência** (IA, fornecedor, originais): **guardadas e
  escondidas**. Saem da vitrine e continuam no cadastro.
- **"Devolve":** a amostra que foi para a China volta à trading, que a
  embarca com o pedido completo.

## Sequência (cartão Amostras do pedido)

Abre no pedido de compra **com pedido de amostras gerado**, depois do SKU
aprovado (pedido no Embarque ou adiante). Pedido "sem amostras" não tem nada
disto.

| Passo                                                 | Quem faz                              | Depois de                                |
| ----------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| Retirada das amostras (data)                          | Trading (fornecedor)                  | SKU aprovado                             |
| Envio ao show room no Brasil (rastreio + comprovante) | Trading                               | Retirada                                 |
| Envio à agência na China (rastreio + comprovante)     | Trading                               | Retirada                                 |
| Amostras recebidas pela agência (data)                | Agência (China)                       | Envio à China                            |
| Fotos e vídeos reais de cada produto                  | Agência (China)                       | Recebimento                              |
| Aprovação (troca as fotos e ativa a venda)            | Marketing                             | Envio das fotos do produto               |
| Amostra devolvida à trading                           | Agência; a trading valida que recebeu | Fotos de **todos** os produtos aprovadas |

**Carregamento do container** (cartão Container na origem): no pedido com
amostras, só depois da devolução validada pela trading
(`samples_return_required`), porque a amostra segue com o pedido.

O cartão mostra a divisão por produto (Brasil, China, total).

## Fotos e vídeos reais (`/app/orders/<id>/real-media`)

- A agência envia por produto: várias fotos e vídeos de uma vez. Precisa de
  ao menos uma foto, porque só vídeo não troca a foto do catálogo.
- O marketing tem a permissão "Aprovar as fotos e vídeos reais" em Equipe →
  Funções e acessos. O padrão é a função designer (marketing); o
  administrador também aprova. O marketing aprova ou pede para refazer, com
  motivo, e a agência é avisada.
- **Aprovado:**
  - as fotos entram no cadastro como `kind = "real"`, e a primeira vira a
    principal;
  - a vitrine mostra só as reais quando existem (`realFirst`);
  - o produto fica ativo;
  - a Wellmix é avisada de que o produto está à venda com fotos reais.
- Os vídeos ficam guardados como documentos do produto, visíveis para a
  Wellmix e para quem enviou.
- Pendências: "Fotos e vídeos reais" para a agência (sem agência designada,
  para quem aprova) e "Aprovar fotos reais" para o marketing.

## Dados

- `orders.marketingAgencyId` (novo, opcional).
- Tipo de parceiro e papel `marketing_agency`.
- Passos `samples_picked`, `samples_brazil`, `samples_china`,
  `samples_china_received` e `samples_returned` em `import_steps`, grupo
  "samples".
- Tabela nova `real_media`, uma linha por item do pedido: `status`
  (`sent`/`approved`/`rejected`), `documentIds`, `reason`, quem e quando.
- Documento tipo `real_media` e foto `real`.

Serviço em `src/lib/services/sample-flow.ts`; divisão em
`src/lib/sample-order.ts` (`sampleSplit`).

## Fica para depois

- Recebimento das amostras no show room do Brasil (conferência e aviso a
  vendas).
