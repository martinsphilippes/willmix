# Track ID: como seguir um pedido de importação no Sankhya da Wellmix

Conferido no banco de produção em 21/11/2026. Banco SQL Server. Todas as consultas abaixo são só leitura.

## 1. O que é

`TGFCAB.AD_TRACKID` (inteiro, rótulo "Track Id.") é o número que identifica o pedido de importação do começo ao fim.
Cada etapa do fluxo gera um documento novo (NUNOTA nova), mas o track continua o mesmo.

**Para o portal, o pedido é o TRACK_ID. A NUNOTA é só a etapa.**

## 2. Etapas e onde o track aparece

| TOP       | Etapa                                | Track no cabeçalho                  |
| --------- | ------------------------------------ | ----------------------------------- |
| 1002      | (IMP) Cotação                        | sim, 100%                           |
| 1003      | (IMP) Amostra                        | sim, 34 de 43                       |
| 140       | Pedido amostra importação            | sim, 100%                           |
| 1100      | (IMP) Pre-order                      | sim, 100%                           |
| 1101      | (IMP) Pedido de compra               | sim, 100%                           |
| 1102      | (IMP) Marketing                      | sim, 100%                           |
| 1103      | (IMP) Check ETD/ETA                  | sim, 3.618 de 3.619                 |
| 1104      | (IMP) Ativação financeira / produção | sim, 100%                           |
| 35        | Pedido de compra: embarque           | **não** (vem pelo item, ver item 3) |
| 1         | Pedido de compra: pré-nota           | **não** (vem pelo item)             |
| 37 e 1201 | Nota de compra importação            | **não** (vem pelo item)             |
| 18        | Nota importação filha WMS            | **não** (vem pelo item)             |

Da 1002 até a 1104 o track passa igual de uma etapa para a outra, sem nenhum caso divergente:

| Ligação        | Documentos | Mesmo track |
| -------------- | ---------- | ----------- |
| 1002 para 1100 | 766        | 766         |
| 1100 para 1101 | 4.475      | 4.475       |
| 1101 para 1102 | 3.891      | 3.891       |
| 1102 para 1103 | 3.614      | 3.614       |
| 1103 para 1104 | 3.521      | 3.521       |

## 3. Do embarque em diante: o track vem pelo item

Um embarque (35) junta vários pedidos. Dos 1.225 embarques ligados a uma 1104, 941 trazem mais de um track (162 trazem 21 ou mais). Por isso o cabeçalho do embarque não tem track.

O item, porém, tem um track só. Subindo item a item pela `TGFVAR` (`NUNOTA`/`SEQUENCIA` do item para `NUNOTAORIG`/`SEQUENCIAORIG`) até o item da 1104, cada item recebe o track daquele pedido. Desde 2025:

| TOP  | Itens  | Com 1 track | Sem track | Com mais de 1 |
| ---- | ------ | ----------- | --------- | ------------- |
| 35   | 14.379 | 14.338      | 41        | 0             |
| 1    | 13.531 | 13.490      | 41        | 0             |
| 37   | 11.711 | 11.656      | 55        | 0             |
| 1201 | 1.335  | 1.330       | 5         | 0             |

Os poucos itens sem track são itens de embarque que não vieram de uma 1104 (ligação de origem ausente).

## 4. Regras para a consulta

1. **Sempre filtrar pelas TOPs de importação.** O campo `AD_TRACKID` também é usado em outros documentos do Sankhya (vendas, por exemplo) e 1.874 números de track se repetem fora da importação. Track sozinho, sem filtro de TOP, mistura documentos.
2. O pedido de importação é o track; a fase atual é a maior etapa que ele alcançou.
3. Um track pode ter mais de uma 1104 (58 tracks têm de 2 a 5): é o mesmo pedido dividido. Some as quantidades.
4. Um track pode ter vários embarques (parcial). A soma das peças embarcadas do track contra as peças da 1104 dá o embarque parcial ou total.
5. Para saber o andamento depois do embarque, siga o item (consulta B), nunca o cabeçalho do embarque.

## 5. Consultas (SQL Server)

### A. Etapas do pedido até a 1104

Troque `:TRACK` pelo número.

```sql
SELECT C.AD_TRACKID AS TRACK_ID, C.CODTIPOPER, C.NUNOTA, C.DTNEG, C.STATUSNOTA, C.PENDENTE,
       C.CODPARC, C.VLRNOTA,
       (SELECT SUM(I.QTDNEG) FROM TGFITE I WHERE I.NUNOTA = C.NUNOTA) AS QTD_PECAS
FROM TGFCAB C
WHERE C.AD_TRACKID = :TRACK
  AND C.CODTIPOPER IN (1002, 1003, 140, 1100, 1101, 1102, 1103, 1104)
ORDER BY C.DTNEG, C.NUNOTA
```

### B. Embarques, pré-notas e notas de entrada de um track

Parte dos itens da 1104 do track e desce pela `TGFVAR`. Mostra só os itens e as peças daquele track em cada documento.

```sql
WITH ITENS AS (
    SELECT I.NUNOTA, I.SEQUENCIA, 0 AS NIVEL
    FROM TGFITE I
    JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA
    WHERE C.AD_TRACKID = :TRACK AND C.CODTIPOPER = 1104
    UNION ALL
    SELECT V.NUNOTA, V.SEQUENCIA, R.NIVEL + 1
    FROM ITENS R
    JOIN TGFVAR V ON V.NUNOTAORIG = R.NUNOTA AND V.SEQUENCIAORIG = R.SEQUENCIA
    WHERE R.NIVEL < 5
),
DESC_ITENS AS (
    SELECT DISTINCT NUNOTA, SEQUENCIA FROM ITENS WHERE NIVEL > 0
)
SELECT :TRACK AS TRACK_ID, C.CODTIPOPER, C.NUNOTA, C.DTNEG, C.DTENTSAI, C.STATUSNOTA, C.PENDENTE,
       COUNT(*) AS ITENS_DO_TRACK, SUM(I.QTDNEG) AS QTD_PECAS_DO_TRACK
FROM DESC_ITENS D
JOIN TGFITE I ON I.NUNOTA = D.NUNOTA AND I.SEQUENCIA = D.SEQUENCIA
JOIN TGFCAB C ON C.NUNOTA = D.NUNOTA
GROUP BY C.CODTIPOPER, C.NUNOTA, C.DTNEG, C.DTENTSAI, C.STATUSNOTA, C.PENDENTE
ORDER BY C.DTNEG, C.NUNOTA
```

### C. Track de cada item de embarque, pré-nota e entrada (carga em lote)

Para a sincronização: devolve, para cada item de 35, 1, 37 e 1201 a partir de uma data, o track e a 1104 de origem. Troque `:DESDE` pela data (`'20261101'`). Roda em cerca de 1 segundo para um mês.

```sql
WITH R AS (
    SELECT I.NUNOTA, I.SEQUENCIA, I.NUNOTA AS CN, I.SEQUENCIA AS CS, 0 AS NIVEL
    FROM TGFITE I
    JOIN TGFCAB C ON C.NUNOTA = I.NUNOTA
    WHERE C.CODTIPOPER IN (35, 1, 37, 1201) AND C.DTNEG >= :DESDE
    UNION ALL
    SELECT R.NUNOTA, R.SEQUENCIA, V.NUNOTAORIG, V.SEQUENCIAORIG, R.NIVEL + 1
    FROM R
    JOIN TGFVAR V ON V.NUNOTA = R.CN AND V.SEQUENCIA = R.CS
    WHERE R.NIVEL < 6
)
SELECT R.NUNOTA, R.SEQUENCIA, E.CODTIPOPER, I.CODPROD, I.QTDNEG,
       MAX(P.AD_TRACKID) AS TRACK_ID, MAX(P.NUNOTA) AS NUNOTA_1104,
       COUNT(DISTINCT P.AD_TRACKID) AS QTD_TRACKS
FROM R
JOIN TGFCAB E ON E.NUNOTA = R.NUNOTA
JOIN TGFITE I ON I.NUNOTA = R.NUNOTA AND I.SEQUENCIA = R.SEQUENCIA
LEFT JOIN TGFCAB P ON P.NUNOTA = R.CN AND P.CODTIPOPER = 1104
GROUP BY R.NUNOTA, R.SEQUENCIA, E.CODTIPOPER, I.CODPROD, I.QTDNEG
ORDER BY R.NUNOTA, R.SEQUENCIA
```

`QTD_TRACKS` = 1 é o normal; 0 é item sem origem numa 1104.

## 6. Exemplos conferidos

**Track 118487 (pedido 1494364, embarque parcial)**

- A: uma 1104, 3.750 peças, pendente.
- B: um embarque 35 (1494608) com 1.302 peças do track. Faltam 2.448.

**Track 106225 (pedido 1335043, recebido)**

- A: uma 1104, 6.960 peças, sem pendência.
- B: dois embarques. 1362475 com 60 peças, seguido de pré-nota 1399860, nota 37 nº 1400818 e filha WMS 1400827. 1491247 com 6.900 peças, seguido de pré-nota 1530717, nota 1201 nº 1532798 e filha WMS 1532799. Total 6.960 = pedido inteiro.

**Pedidos parecidos (mesmo fornecedor, valor e quantidade) têm track diferente**

| Pedido        | Track  |
| ------------- | ------ |
| 1308842       | 101848 |
| 1308844       | 101849 |
| 1479663       | 116655 |
| 1479689       | 116657 |
| 268823 (1100) | 25736  |
| 278155 (1104) | 25738  |

Pelo track, cada um é um pedido separado. Se algum deles foi relançamento de outro, quem confirma é a Wellmix.

## 7. Já está nas views (no ar desde 21/11/2026 12:13)

Colunas novas no fim das views; as antigas não mudaram.

**VW_AD_PEDCOMPRA_ITEM_WELL** (itens)

- `TRACK_ID`: track do próprio documento; no embarque, pré-nota e entrada, o track herdado do item da 1104.
- Só nos itens da 1104: `QTD_EMBARCADA`, `QTD_PRENOTA`, `QTD_ENTRADA` e `ETAPA_EMBARQUE`, `ETAPA_PRENOTA`, `ETAPA_ENTRADA` (N = nada, P = parcial, S = completo, contra a quantidade negociada). Aqui a quantidade é a bruta: se um embarque foi refeito, a soma pode passar do pedido.

**VW_AD_PEDCOMPRA_CAB_WELL** (cabeçalho)

- `TRACK_ID` e `QTD_TRACKS`. Embarque ou pré-nota que junta vários pedidos fica com `TRACK_ID` vazio e `QTD_TRACKS` maior que 1; nesse caso o track está no item.
- `ETAPA_PREORDER`, `ETAPA_PEDIDO_COMPRA`, `ETAPA_MARKETING`, `ETAPA_CHECK_ETD_ETA`, `ETAPA_PRODUCAO`: S/N pela etapa mais avançada do track. Se o pedido chegou numa etapa, as anteriores ficam S.
- `ETAPA_EMBARQUE`, `ETAPA_PRENOTA`, `ETAPA_ENTRADA`: N/P/S somando todas as 1104 do track, com cada item limitado à quantidade pedida.
- Os mesmos valores aparecem em todos os documentos do mesmo track.

Para o portal: um pedido = um `TRACK_ID`. Leia a CAB filtrando as TOPs 1100 a 1104 (uma linha por documento, todas com as mesmas etapas) e o detalhe do embarque pela ITEM, por `TRACK_ID`. As consultas A, B e C acima continuam valendo para conferência.

Exemplos no ar: 1494364 (track 118487) com embarque P; 1335043 (track 106225) com tudo S; embarque 1363560 com 44 tracks.
