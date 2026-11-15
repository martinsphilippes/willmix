# Recebimento (Fase E)

Cartão **Recebimento** no pedido, só para a Wellmix, do desembaraço em diante (Desembaraço, Transporte, Entrega, Encerrado).

1. **Descarga**:
   - nº do lacre e se chegou íntegro ou violado (violado alerta a equipe);
   - foto do lacre e fotos do container;
   - checklist: lacre confere com o BL, container sem avarias, sem umidade, paletes/caixas íntegros, etiquetas conferidas, volumes contados.
2. **Conferência por SKU**:
   - recebido, avariado e observação de cada item do pedido;
   - recebido diferente do esperado, ou avaria, é **divergência**: avisa o analista do pedido, os compradores e o fornecedor (para a reclamação);
   - avariado não pode passar do recebido.
3. **RIC**: nº e arquivo do registro de inspeção do container.
4. **Devolução do container**: data e comprovante.
5. **Fechamento**:
   - mostra, do lado do cliente, o pago (sinal e pagamentos confirmados) × o total, com o que falta;
   - do lado do fornecedor, o pago × o FOB;
   - "Encerrar recebimento" exige tudo acima e avisa o financeiro;
   - depois de encerrado, fica só leitura.

O cartão não muda as etapas do pedido (a confirmação de entrega continua na etapa Entrega). Fotos e arquivos são documentos internos do pedido (só a Wellmix abre). Tudo vai para a auditoria (`receiving.*`).

## Lote com divergência (mapa E21, E24 a E27; desde 15/11/2026)

Decisões do dono (15/11/2026), pelo mapa. Cada contagem por SKU que acha
divergências novas abre um **lote** (`divergence_lots`, número próprio) com os
itens e as quantidades com problema: falta, sobra ou avaria. Um pedido pode ter
mais de um lote. Os quatro passos ficam dentro do lote:

| Passo | Faz | Aprova | Depende de |
| --- | --- | --- | --- |
| E24 Compras avisada | o sistema, sozinho: avisa a Diretoria de compras e os compradores (`approve.purchasingDirector`, `receiving.follow`) | — | — |
| E25 Fornecedor comunicado | Diretoria de compras: o que foi comunicado | a Trading responde: aceita, contesta ou repõe, com texto | — |
| E26 Evidências | Compras com a Logística (`receiving.follow`, `receiving.quality` ou a diretoria): texto e fotos, vídeos ou arquivos (obrigatórios) | a Trading aprova ou devolve com o motivo | — |
| E27 Mitigação financeira | Financeiro (tela Financeiro ou `numerario.manage`) ou o Agente de carga do pedido: desconto, crédito em conta corrente, multa ou sem valor, com o valor e a moeda | a Trading aprova o Acordo de Divergência (fecha o lote) ou devolve | E25 respondido **e** E26 aprovado |

Regras:

- A **Trading** é o fornecedor do pedido, com o login dele. O administrador
  age por todos, também pela Trading quando ela não tem login.
- Sem ninguém com a ação na equipe, a Wellmix faz o passo e os avisos vão aos
  administradores.
- Quem faz é avisado quando chega a sua vez. A Trading é avisada a cada envio.
- No passo devolvido, quem faz é avisado e reenvia. Os arquivos anteriores
  ficam.
- Uma nova contagem do mesmo item (por exemplo, uma avaria a mais) não abre
  outro lote. Um item novo com divergência abre outro lote.

Onde aparece:

- Cartão **Lotes com divergência** no pedido, antes do cartão da divergência
  antiga.
- Tela do lote `/app/orders/<id>/lots/<lote>`.
- Lista `/app/lots`: a Wellmix vê todos; a Trading e o Agente de carga, os dos
  seus pedidos.
- Pendências: quem faz o passo e quem decide (a Trading e o Agente de carga
  também).
- Menu: as pendências dos lotes contam no passo **Armazenagem** (bloco Entrega,
  marco 16), com o tipo próprio `divergence_lot`.

Código: `src/lib/services/divergence-lots.ts` e
`src/app/app/actions/divergence-lots.ts`. Teste:
`tests/unit/divergence-lots.test.ts`.

A trilha abaixo, com os quatro passos por pedido, continua valendo só para os
pedidos que já a tinham.

## Divergência no recebimento (mapa E24 a E27)

Decisão do dono (14/11/2026). Quando a conferência por SKU acha a **primeira divergência** (recebido diferente do esperado ou avaria), nascem no pedido quatro passos, em "pendente" (`openDivergenceSteps` em `src/lib/services/import-flow.ts`, chamado por `saveCounts`). Uma nova contagem não recria nada. Sem divergência os passos não existem ("não se aplicam"): não aparecem no pedido, nas pendências, no menu nem nos marcos.

| Passo                                             | O que pede                                                                                                        | Faz                                                           | Valida                                                | Depende de                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| E24 Comunicar a Compras (`divergence_purchasing`) | texto (o que foi comunicado)                                                                                      | Qualidade                                                     | Planner                                               | —                              |
| E25 Fornecedor (`divergence_supplier`)            | aceita, contesta ou repõe + texto; arquivo opcional                                                               | Comprador; o fornecedor do pedido também responde pelo portal | — (o envio conclui)                                   | E24 validado                   |
| E26 Evidência (`divergence_evidence`)             | texto + arquivo (fotos, vídeos ou laudo)                                                                          | Qualidade                                                     | Analista (Wellmix; o aviso vai ao analista do pedido) | E24 validado                   |
| E27 Financeiro (`divergence_finance`)             | desconto, crédito em conta corrente, multa ao fornecedor ou sem valor; valor e arquivo (opcionais em "sem valor") | Financeiro                                                    | Diretoria de compras                                  | E25 enviado **e** E26 validado |

Quem é cada um (pela ação em Equipe → Funções e acessos; o administrador age por todos):

- Qualidade: "Concluir a conferência da qualidade" (`receiving.quality`, padrão: função Qualidade (CD)).
- Comprador: "Acompanhar o recebimento" (`receiving.follow`, padrão: Comprador), os mesmos avisados da divergência.
- Planner: `approve.planner`; Diretoria de compras: `approve.purchasingDirector`; Financeiro: `numerario.manage`.

Sem ninguém com a ação na equipe, os avisos vão aos administradores (o passo fica com eles).

Onde aparece:

- Cartão **Divergência no recebimento** no pedido, logo depois do Recebimento (âncora `#divergence-flow`). A Wellmix vê os quatro; o fornecedor do pedido vê só a resposta dele (E25).
- Menu: passo **Armazenagem** (bloco Entrega, marco 16), com contador e a tela do passo.
- Pendências: fazer e validar, de quem age por cada papel, nas situações Desembaraço, Transporte e Entregue. Do pedido entregue, só estes passos viram pendência da Wellmix (o resumo do pedido guarda os mesmos). Pedido encerrado: só leitura.
- Avisos: ao nascer, a qualidade (E24); com E24 validado, o comprador e o fornecedor (E25) e a qualidade (E26); com E25 enviado e E26 validado, o financeiro (E27). Cada envio a validar avisa quem valida.

O financeiro depende de dois passos (`alsoAfter` no modelo do passo): a tela diz qual dos dois ainda falta.
