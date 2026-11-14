# Container na origem (pedido de compra)

Mapa do processo, etapa Produção: R19 (container no depósito da fábrica, onde começa o rastreio), R20 (fotos e vídeos do container vazio), R7 (carregamento com o check de carga), R25 (lacre e número do container) e R26 (container volta ao porto). Decisão do dono (13/11/2026): o rastreio do container, enquanto não há API contratada, é uma **pendência diária do time interno de Comex** (não é o despachante), que confere a mudança de status todos os dias.

## Cartão "Container na origem"

No pedido de compra, da Inspeção em diante (`/app/orders/{id}#container-origin`). Usa o mesmo mecanismo dos passos de embarque (docs/IMPORT_FLOW.md): quem faz, quem valida, quem vê, recusa com motivo, quem enviou não valida o próprio envio.

| Passo | Faz | Valida | Depois de | Pede |
| --- | --- | --- | --- | --- |
| Container vazio no depósito da fábrica | fornecedor (ou a trading) | — | booking | data |
| Fotos e vídeos do container vazio | fornecedor | — | container na fábrica | arquivo (foto ou vídeo) |
| Carregamento: fotos, vídeos e check de carga | fornecedor | Wellmix | container vazio | arquivo + texto do check |
| Lacre: foto e número do container | fornecedor | — | carregamento conferido | nº do container + foto |
| Container lacrado no porto | fornecedor | — | lacre | data |
| Rastreio do container (status do dia) | Comex interno | — | container na fábrica | texto |

- **Rastreio diário**: com o container na fábrica, quem tem a ação **"Rastrear o container (todo dia)"** (Equipe → Funções e acessos; padrão: a função nova **Comex (interno)**; o administrador sempre pode) recebe a pendência "Rastreio do container". Registrado o status do dia, ela some e volta no dia seguinte (dia em Brasília), até o pedido sair do Desembaraço. Cada registro fica na auditoria.
- **Vídeos**: o container vazio e o carregamento aceitam vídeo (MP4, MOV, WebM), além de foto e PDF.
- **Quem vê**: a Wellmix, o fornecedor, o agente de carga e o comex (o rastreio, só a Wellmix).
- Só no pedido de compra; os outros fluxos não mudam.

O embarque esperar o container no porto e o BL conferido (R27) vem com os documentos (packing list, invoice e BL), na próxima entrega.

## Dados

Seis valores novos em `import_steps.key` (`container_at_factory`, `container_empty`, `container_loaded`, `container_sealed`, `container_at_port`, `container_tracking`) e a função `comex_internal`. No Supabase a coluna é texto: nada a migrar.

Código: `src/lib/services/import-flow.ts` (passos, `comex_internal`, rastreio em `importTasks`), cartão em `src/app/app/orders/[id]/page.tsx`. Teste: `tests/unit/purchase-order.test.ts` ("container na origem").
