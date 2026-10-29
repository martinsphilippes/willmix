# Certificação com o OCP (Fase F)

- **OCP (organismo de certificação)**: novo login (papel `ocp`, empresa do tipo OCP), designado no pedido em "Parceiros" (`orders.ocpId`). Vê só os pedidos em que está e, neles, só os passos da certificação.
- O cartão **Certificação** aparece no pedido quando há OCP designado, quando a ficha da cotação/pedido marca "Precisa de certificação" ou quando algum passo já começou.

| Passo | Faz | Valida | Vê (além da Wellmix) | Depois de |
|---|---|---|---|---|
| Memorial descritivo (arquivo) | Wellmix | OCP | OCP | — |
| Ensaio em laboratório (laboratório/nº do laudo + arquivo) | OCP | — | OCP | memorial |
| Número de registro (nº + certificado) | OCP | Wellmix | OCP, comex | laudo |

Usa o mesmo mecanismo dos passos de embarque (docs/IMPORT_FLOW.md):
- recusar exige motivo;
- quem enviou não valida;
- o arquivo só abre para quem vê o passo;
- as pendências vão para o OCP e para quem valida.
