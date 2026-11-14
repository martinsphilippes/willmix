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
