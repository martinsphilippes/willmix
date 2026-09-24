# Escopo

Portal Operacional de Importações da Wellmix. O portal organiza o fluxo entre cliente, Wellmix, fornecedores na China e parceiros (agência, despachante, companhia marítima, transportador, jurídico). **O Sankhya continua sendo o ERP**; o portal cuida do workflow, das solicitações, cotações, checklists, documentos, pagamentos ligados ao fluxo, inspeção, embarque, desembaraço, transporte, timeline e Control Tower.

## Macrofluxo

```
CLIENTE → SOLICITAÇÃO → RFQ → COTAÇÕES → SELEÇÃO → SINAL → PEDIDO → (SANKHYA)
→ PREPARAÇÃO → PAGAMENTO AO FORNECEDOR → ARTE/EMBALAGEM → INSPEÇÃO → EMBARQUE
→ DESEMBARAÇO → TRANSPORTE → ENTREGA → ENCERRAMENTO
```

## Papéis

| Papel              | Faz                                                                                      | Não vê                            |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------- |
| Admin Wellmix      | Tudo, inclusive configurações e usuários internos                                        |                                   |
| Operador           | Cadastros, RFQ, seleção, pagamentos, designação de parceiros, exceções, multas           | Configurações                     |
| Cliente            | Cria e acompanha solicitação, vê proposta e sinal, timeline, confirma recebimento        | Fornecedor, FOB, margem, cotações |
| Fornecedor         | Responde RFQ, cumpre checklists, envia fotos e peso, confirma pagamentos, conta corrente | Cliente final, valor de venda     |
| Agência            | Aprova ou reprova a arte                                                                 | Valores                           |
| Despachante        | Número do processo, documentos, custos, liberação                                        | Valores comerciais                |
| Companhia marítima | Data de embarque, previsão, navio, BL                                                    | Valores comerciais                |
| Transportador      | Placa, previsão, situação, entrega                                                       | Valores comerciais                |
| Jurídico           | Visualiza e muda status de multas                                                        |                                   |

## Vertical slice 1 (entregue)

Login → solicitação (cliente ou Wellmix) → RFQ para fornecedores → resposta → comparação e seleção com preço ao cliente → sinal em modo manual → pedido com etapas e requisitos → checklist de preparação → pagamento ao fornecedor (registro + confirmação) → arte com aprovação da agência → inspeção com comparação de peso e bloqueio por divergência → embarque → desembaraço → transporte → confirmação de recebimento → encerramento. Control Tower, pendências por papel, notificações in-app, conta corrente do fornecedor, multas, cadastros com importação CSV, configurações e lembretes por prazo.

## Fora do escopo agora

Aplicativo nativo, booking automático, integração aduaneira externa, scraping, IA sofisticada, microserviços, BI complexo, event sourcing, motor BPMN genérico, migração histórica completa. Veja `BACKLOG_FUTURO.md`.
