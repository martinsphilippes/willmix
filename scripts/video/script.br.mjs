/*
 * Roteiro do vídeo completo em português do Brasil (pedido do dono, 16/11/2026):
 * telas do portal em português, narração por voz feminina em português, SEM
 * legenda. Gêmeo de VIDEOS.full (script.mjs): mesmas cenas, mesma ordem, mesmos
 * tipos de cena (film/scenes.js); muda o texto.
 *
 * - `say[i].pt` é o texto falado (e o que a pessoa lê na tela, quando vira
 *   ponto da cena). Para a voz, `speak()` troca nomes e siglas por como se
 *   pronunciam (Wellmix, BL, ERP, SLA...); `say[i].say` escreve a fala inteira
 *   do jeito que a voz deve ler, quando um caso pede.
 * - `props` é o que a cena desenha, já em português. Nos textos da tela,
 *   *assim* sai em vermelho.
 * - `ui` troca os rótulos fixos das cenas (mapa, canais soltos, acesso).
 * - Só afirma o que o portal faz hoje (docs/videos/institucional/README.md,
 *   seção "O que os vídeos não prometem"): sem e-mail ou WhatsApp automáticos,
 *   sem chat direto entre parceiros, sem pagamento on-line.
 */

const ROLES = [
  { icon: "store", label: "Cliente" },
  { icon: "factory", label: "Fornecedor" },
  { icon: "pen-tool", label: "Agência de arte" },
  { icon: "badge-check", label: "Certificadora" },
  { icon: "camera", label: "Agência de marketing" },
  { icon: "container", label: "Agente de carga" },
  { icon: "ship", label: "Companhia marítima" },
  { icon: "briefcase", label: "Assessoria de comex" },
  { icon: "landmark", label: "Despachante" },
  { icon: "truck", label: "Transportador" },
  { icon: "scale", label: "Jurídico" },
  { icon: "users", label: "Equipe Wellmix" },
];

const HANDOFFS = [
  { icon: "factory", label: "Fornecedor" },
  { icon: "pen-tool", label: "Agência de arte" },
  { icon: "badge-check", label: "Certificação" },
  { icon: "ship", label: "Frete" },
  { icon: "landmark", label: "Alfândega" },
  { icon: "truck", label: "Transportador" },
];

/**
 * Como a voz deve ler o que o texto escreve de outro jeito. Cada par é
 * [expressão, leitura]; a ordem importa. As leituras foram escolhidas medindo
 * o que a voz fala (tts/tts_pt.py e a conferência por transcrição do Whisper:
 * "Uélmiks", "bê-éle", "érre-pê" e "ésse-éle-á" foram entendidos em todas as
 * tentativas; "Control Tower", "Book" e "e-mail" saem bem como estão escritos
 * ou com a leitura abaixo). Se a voz mudar, meça de novo.
 */
const LEXICON = [
  [/Wellmix/g, "Uélmiks"],
  [/\bBL\b/g, "bê-éle"],
  [/\bERP\b/g, "érre-pê"],
  [/\bSLA\b/g, "ésse-éle-á"],
  [/\bPlanners?\b/g, (m) => (m.endsWith("s") ? "Plânners" : "Plânner")],
  [/Packing list/g, "Pékin list"],
  [/\binvoice\b/g, "ínvóis"],
  [/e-mails?/g, (m) => (m.endsWith("s") ? "imeius" : "imeiu")],
  [/\bcomex\b/gi, "cômex"],
  [/\bcontainers?\b/g, (m) => (m.endsWith("s") ? "contêineres" : "contêiner")],
];
export const speak = (text) =>
  LEXICON.reduce((t, [from, to]) => t.replace(from, to), text);

const END = {
  id: "end",
  type: "end",
  noBrand: true,
  // Folgas da cena final: a marca entra junto com o acorde final da música
  // (tts/track.py mostra a diferença).
  pre: 0.2,
  post: 0.55,
  props: {
    lines: ["Um portal.", "Todos os parceiros.", "Cada etapa."],
    tagline: "Importação do pedido à entrega",
  },
};

export const VIDEOS_BR = {
  full_br: {
    title: "Portal Wellmix · O que cada papel faz",
    voice: "pt",
    noSubs: true,
    // Folga depois da última fala de cada cena (padrão 0,75 s): ajustada com
    // tts/track.py para o acorde final da música cair na marca com a narração do
    // ElevenLabs (16/11/2026).
    post: 0.6,
    lang: "pt",
    // Telas do portal em português (shots.mjs pt --out br, inspection/flow.mjs
    // com LANGUAGE=pt); a cena dos três idiomas usa as mesmas telas em pt, en e zh.
    shots: "br",
    speak,
    ui: {
      brazil: "Brasil",
      sees: "Vê",
      neverSees: "Nunca vê",
      chaos: {
        mail: "E-mail",
        sheet: "Planilha",
        chat: "Grupo de chat",
        phone: "Ligação",
        pdf: "PDF",
        attach: "Anexo",
      },
    },
    scenes: [
      {
        id: "route",
        type: "route",
        cls: "first",
        pre: 1.0,
        props: {
          kicker: "O desafio",
          title: "Uma importação.\nDezenas de *mãos.*",
          handoffs: HANDOFFS,
          handoffsC: 1,
        },
        say: [
          {
            pt: "Trazer um produto de uma fábrica no exterior até um cliente no Brasil é uma longa corrida de revezamento.",
          },
          {
            pt: "Fornecedores, agências, certificadoras, frete, alfândega, transportadoras.",
          },
        ],
      },
      {
        id: "chaos",
        type: "chaos",
        props: {
          title: "E-mails,\nplanilhas\ne *chats* soltos.",
        },
        say: [
          { pt: "Cada um com seus e-mails, planilhas e grupos de conversa." },
          { pt: "E ninguém enxerga o quadro completo." },
        ],
      },
      {
        id: "hub",
        type: "hub",
        noBrand: true,
        props: {
          title: "Um portal. *Um fluxo.*",
          roles: ROLES,
          note: "13 papéis de login · cada um vê só a sua parte",
          noteC: 2,
        },
        say: [
          { pt: "O Portal Wellmix reúne toda a operação em um só lugar." },
          {
            pt: "Um único fluxo, compartilhado pela Wellmix, seus fornecedores, seus parceiros de serviço e seus clientes.",
          },
          { pt: "Cada login vê apenas a sua parte." },
        ],
      },
      {
        id: "journey",
        type: "journey",
        chapter: "A jornada",
        props: {
          title: "Do primeiro book à *entrega final*",
          blocks: [
            {
              icon: "file-spreadsheet",
              name: "Book",
              steps: [
                "Books dos fornecedores",
                "Seleção de itens",
                "Negociação",
                "Amostras",
              ],
            },
            {
              icon: "file-signature",
              name: "Pedido",
              steps: [
                "Pedido de compra",
                "Arte",
                "Certificação",
                "Contrato assinado",
              ],
            },
            {
              icon: "factory",
              name: "Produção",
              steps: [
                "Acompanhamento",
                "Inspeção",
                "Carregamento",
                "Documentos de carga",
              ],
            },
            {
              icon: "truck",
              name: "Entrega",
              steps: ["Desembaraço", "Transporte", "Recebimento"],
            },
            {
              icon: "tag",
              name: "Vendas",
              steps: ["Ofertas", "Ordens de venda", "Agenda de entregas"],
            },
            {
              icon: "wallet",
              name: "Financeiro",
              steps: [
                "Contas a pagar",
                "Contas a receber",
                "Fluxo de caixa",
                "Comissões",
              ],
            },
          ],
          footer: [
            { icon: "user-cog", label: "Um responsável" },
            { icon: "clock", label: "Um prazo" },
            { icon: "list-checks", label: "Uma situação" },
          ],
          footerC: 7,
        },
        say: [
          {
            pt: "O portal acompanha a importação do começo ao fim, em seis blocos.",
          },
          {
            pt: "Book: planilhas dos fornecedores, seleção de itens, negociação e amostras.",
          },
          {
            pt: "Pedido: o pedido de compra, a arte, a certificação e o contrato assinado.",
          },
          {
            pt: "Produção: acompanhamento, inspeção, carregamento e documentos de carga.",
          },
          { pt: "Entrega: desembaraço, transporte e recebimento." },
          { pt: "Vendas: ofertas, ordens de venda e a agenda de entregas." },
          {
            pt: "E o Financeiro: contas a pagar ao fornecedor, contas a receber do cliente, fluxo de caixa e comissões.",
          },
          { pt: "Cada etapa tem um responsável, um prazo e uma situação." },
        ],
      },
      {
        id: "customer",
        type: "role",
        chapter: "Quem faz o quê",
        props: {
          role: "Cliente",
          icon: "store",
          title: "Situação do pedido sem uma única ligação",
          shot: "customer",
          oy: "18%",
          bullets: [
            { t: "<b>Faz pedidos</b> e acompanha cada etapa", c: 0, d: 1.4 },
            { t: "<b>Forma de pagamento</b>, parcelas e boletos", c: 1 },
            { t: "<b>Confirma o recebimento</b> e avalia a compra", c: 2 },
          ],
        },
        say: [
          {
            pt: "O cliente faz o pedido e acompanha cada etapa sem precisar telefonar.",
          },
          {
            pt: "A forma de pagamento, as parcelas e os boletos ficam na mesma tela.",
          },
          { pt: "Na chegada, ele confirma o recebimento e avalia a compra." },
        ],
      },
      {
        id: "supplier",
        type: "role",
        cls: "flip",
        props: {
          role: "Fornecedor",
          icon: "factory",
          title: "Uma lista de tarefas, em chinês ou inglês",
          shot: "supplier",
          oy: "16%",
          bullets: [
            {
              t: "Responde com <b>preço, pedido mínimo e prazo</b>",
              c: 1,
            },
            {
              t: "<b>Fotos e vídeos das amostras</b>, datas de produção, inspeção",
              c: 2,
            },
            { t: "<b>Previsão de pagamento</b> de cada pedido", c: 3 },
          ],
        },
        say: [
          {
            pt: "O fornecedor trabalha com uma única lista de tarefas, em chinês ou em inglês.",
          },
          {
            pt: "Responde às solicitações com preço, pedido mínimo e prazo.",
          },
          {
            pt: "Envia fotos e vídeos das amostras, datas de produção e os dados da inspeção.",
          },
          { pt: "E consulta a previsão de pagamento de cada pedido." },
        ],
      },
      {
        id: "agency",
        type: "role",
        props: {
          role: "Agência de arte",
          icon: "pen-tool",
          title: "Briefing, arquivos e retorno em uma só mesa",
          shot: "agency",
          oy: "30%",
          bullets: [
            {
              t: "Recebe a <b>faca e as fotos do produto</b>",
              c: 0,
              d: 1.6,
            },
            {
              t: "Envia a arte e recebe o <b>retorno com o motivo</b>",
              c: 1,
            },
            { t: "Entrega a <b>arte final com o selo</b>", c: 2 },
            {
              t: "<b>Arquivos da fábrica</b> chegam como pendências; dúvidas vão à Wellmix pelo chat",
              c: 3,
            },
          ],
        },
        say: [
          {
            pt: "A agência de arte recebe da fábrica a faca e as fotos do produto, na sua mesa de trabalho.",
          },
          { pt: "Envia a arte e recebe o retorno com o motivo." },
          { pt: "Depois entrega a arte final com o selo de certificação." },
          {
            // Não há chat direto entre agência e fornecedor: cada empresa
            // conversa com a Wellmix; o que passa de um para o outro são as
            // pendências e os arquivos do pedido (docs/PURCHASE_ORDER.md).
            pt: "Agência no Brasil, fábrica no exterior: arquivos e pendências correm pelo portal, e cada um conversa com a Wellmix. Sem e-mails.",
          },
        ],
      },
      {
        id: "ocp",
        type: "role",
        cls: "flip",
        props: {
          role: "Certificadora",
          icon: "badge-check",
          title: "Uma fila de certificados a emitir",
          shot: "ocp",
          oy: "14%",
          bullets: [
            {
              t: "Consulta a <b>ficha de compra</b> e as fotos do produto",
              c: 1,
            },
            {
              t: "Envia o <b>memorial descritivo, o selo e o certificado</b>",
              c: 1,
              d: 2.2,
            },
          ],
        },
        say: [
          {
            pt: "A certificadora tem uma fila única de certificados a emitir.",
          },
          {
            pt: "Consulta a ficha de compra e envia o memorial descritivo, o selo e o certificado.",
          },
        ],
      },
      {
        // Inspeção pelo celular: telas reais do passo Produção > Inspeção com o
        // login do fornecedor (inspection/flow.mjs com LANGUAGE=pt). `tap` é o
        // ponto tocado em pixels da janela de 390 × 844; vêm de out/insp/state.json.
        id: "inspect",
        type: "mobile",
        post: 0.85,
        props: {
          role: "Fornecedor · chão de fábrica",
          icon: "smartphone",
          title: "Inspeção, *direto do celular*",
          screens: [
            { shot: "m-insp-1", tap: [132, 378] },
            { shot: "m-insp-2", c: 1, d: 1.5, tap: [132, 490] },
            { shot: "m-insp-3", c: 2, d: 0.5, tap: [194, 602] },
            { shot: "m-insp-4", c: 3, d: -0.2 },
          ],
          desk: {
            before: "insp-desk-0",
            shot: "insp-desk",
            c: 3,
            d: 0.35,
            ox: "46%",
            oy: "45%",
            zoom0: 1.45,
            zoom: 1.6,
            icon: "eye",
            label: "O que a Wellmix vê",
          },
          bullets: [
            { t: "<b>Fotos</b> tiradas na hora, salvas na hora", c: 1 },
            { t: "<b>Peso medido</b> e medidas digitados", c: 2 },
            { t: "A <b>Wellmix vê</b> cada item no pedido", c: 3 },
          ],
        },
        say: [
          { pt: "No chão de fábrica, a inspeção é feita pelo celular." },
          { pt: "O fornecedor tira cada foto, e o portal salva na hora." },
          { pt: "Depois digita o peso medido e toca em enviar." },
          { pt: "Do outro lado, a Wellmix vê cada item no pedido." },
        ],
      },
      {
        id: "marketing",
        type: "role",
        cls: "flip",
        props: {
          role: "Agência de marketing · na origem",
          icon: "camera",
          title: "Fotos reais antes de a carga embarcar",
          shot: "marketing",
          oy: "40%",
          bullets: [
            { t: "Confirma que a <b>amostra chegou</b>", c: 0, d: 1.2 },
            { t: "Envia <b>fotos e vídeos reais</b> de cada produto", c: 1 },
            {
              t: "<b>Devolve a amostra</b> para embarcar com o pedido",
              c: 1,
              d: 2.6,
            },
          ],
        },
        say: [
          {
            pt: "Na origem, a agência de marketing confirma a chegada da amostra.",
          },
          {
            pt: "Envia fotos e vídeos reais de cada produto e devolve a amostra.",
          },
        ],
      },
      {
        id: "freight",
        type: "duo",
        props: {
          items: [
            {
              role: "Agente de carga",
              icon: "container",
              title: "Reserva no navio e container na origem",
              shot: "forwarder",
              oy: "40%",
              c: 0,
            },
            {
              role: "Companhia marítima",
              icon: "ship",
              title: "Cotações de frete, BL, embarque",
              shot: "line",
              oy: "10%",
              c: 1,
            },
          ],
        },
        say: [
          {
            pt: "O agente de carga registra a reserva no navio e acompanha o container na origem.",
          },
          {
            pt: "A companhia marítima responde às cotações de frete, emite o BL e confirma o embarque.",
          },
        ],
      },
      {
        id: "customs",
        type: "duo",
        props: {
          items: [
            {
              role: "Assessoria de comex",
              icon: "briefcase",
              title: "Licenças, numerário e declaração de importação",
              shot: "comex",
              oy: "40%",
              c: 0,
            },
            {
              role: "Despachante",
              icon: "landmark",
              title: "Classificação fiscal e desembaraço",
              shot: "broker",
              oy: "14%",
              c: 0,
              d: 1.6,
            },
          ],
          note: "Cada passo mostra quem faz e quem valida",
          noteC: 1,
        },
        say: [
          {
            pt: "No Brasil, a assessoria de comex e o despachante cuidam de licenças, documentos e desembaraço.",
          },
          { pt: "Cada passo mostra quem faz e quem valida." },
        ],
      },
      {
        id: "carrier",
        type: "role",
        cls: "flip",
        props: {
          role: "Transportador",
          icon: "truck",
          title: "Do porto à porta do cliente",
          shot: "carrier",
          oy: "22%",
          phone: "m-carrier",
          bullets: [
            {
              t: "<b>Carga e endereço de entrega</b> em um só cartão",
              c: 0,
              d: 1.2,
            },
            { t: "Atualiza a <b>situação na estrada</b>", c: 1 },
            { t: "<b>Confirma a entrega</b> pelo celular", c: 1, d: 2.0 },
          ],
        },
        say: [
          {
            pt: "O transportador vê a carga e o endereço de entrega em um só cartão.",
          },
          {
            pt: "Atualiza a situação na estrada e confirma a entrega pelo celular.",
          },
        ],
      },
      {
        id: "team1",
        type: "team",
        props: {
          kicker: "Dentro da Wellmix",
          title: "Cada função tem *a sua visão*",
          tiles: [
            {
              icon: "shopping-cart",
              name: "Comprador",
              text: "Importa books de fornecedores, seleciona itens, negocia",
              c: 1,
            },
            {
              icon: "package",
              name: "Gerente de produto",
              text: "Avalia amostras e cuida da ficha do produto",
              c: 2,
            },
            {
              icon: "calendar-check",
              name: "Planner",
              text: "Datas de produção, containers e frete",
              c: 3,
            },
            {
              icon: "database",
              name: "Cadastro",
              text: "Valida classificação fiscal e ficha mestre",
              c: 4,
            },
            {
              icon: "palette",
              name: "Designer",
              text: "Arte e aprovação das fotos reais",
              c: 4,
              d: 1.6,
            },
            {
              icon: "scale",
              name: "Jurídico",
              text: "Multas e a situação delas",
              c: 4,
              d: 2.0,
            },
          ],
        },
        say: [
          {
            pt: "Dentro da Wellmix, cada função tem as suas telas e pendências.",
          },
          {
            pt: "Compradores importam os books, selecionam itens e negociam.",
          },
          {
            pt: "Gerentes de produto avaliam amostras e cuidam da ficha do produto.",
          },
          {
            pt: "Planners acompanham datas de produção, containers e fretes.",
          },
          {
            pt: "O cadastro valida a classificação fiscal e a ficha mestre.",
          },
        ],
      },
      {
        id: "team2",
        type: "team",
        props: {
          kicker: "Dentro da Wellmix",
          title: "Do financeiro à *diretoria*",
          tiles: [
            {
              icon: "wallet",
              name: "Financeiro",
              text: "Valida custos de importação, registra a nota fiscal",
              c: 0,
            },
            {
              icon: "clipboard-check",
              name: "Qualidade",
              text: "Confere cada container: lacre, fotos, contagem",
              c: 1,
            },
            {
              icon: "tag",
              name: "Vendas",
              text: "Ofertas, ordens de venda e datas de entrega",
              c: 2,
            },
            {
              icon: "handshake",
              name: "Diretoria",
              text: "Aprova a estratégia de compra, assina o contrato",
              c: 3,
            },
            {
              icon: "key-round",
              name: "Administrador",
              text: "Acessos, prazos e configurações",
              c: 4,
            },
            {
              icon: "ship",
              name: "Comex · interno",
              text: "Situação diária do rastreio dos containers",
              c: 4,
              d: 1.8,
            },
          ],
        },
        say: [
          {
            pt: "O financeiro valida os custos de importação e registra a nota fiscal.",
          },
          {
            pt: "A qualidade confere cada container na chegada: lacre, fotos e contagem.",
          },
          {
            pt: "Vendas registra ofertas, abre ordens de venda e agenda as entregas.",
          },
          {
            pt: "A diretoria aprova a estratégia de compra e assina o contrato.",
          },
          { pt: "E o administrador controla acessos, prazos e configurações." },
        ],
      },
      {
        // O chat do portal no lugar dos e-mails (pedido do dono, 15/11/2026):
        // a tela real de Mensagens, com a conversa de seed-chat.mjs.
        id: "chat",
        type: "chat",
        chapter: "Uma só conversa",
        post: 0.85,
        props: {
          kicker: "Comunicação",
          title: "A troca de e-mails\n*termina aqui.*",
          shot: "messages",
          phone: "m-messages",
          phoneAt: { c: 2, d: 1.2 },
          ox: "100%",
          oy: "50%",
          zoom0: 1.14,
          zoom: 1.3,
          gone: [
            { icon: "mail", label: "Troca de e-mails", c: 1 },
            { icon: "message-circle", label: "Grupos de chat", c: 1 },
            { icon: "file-spreadsheet", label: "Arquivos soltos", c: 1 },
          ],
          chips: [
            {
              icon: "messages-square",
              label: "Uma conversa por empresa, com a Wellmix",
              c: 2,
            },
            {
              icon: "list-checks",
              label: "Organizado por pedido e por item",
              c: 2,
              d: 2.0,
            },
            {
              icon: "paperclip",
              label: "Fotos, vídeos e arquivos na conversa",
              c: 3,
            },
          ],
        },
        say: [
          { pt: "Toda a comunicação acontece dentro do portal." },
          { pt: "Os e-mails espalhados terminam aqui." },
          {
            pt: "Cada empresa tem uma só conversa com a Wellmix, organizada por pedido e por item.",
          },
          {
            pt: "Fotos, vídeos e arquivos ficam junto do assunto a que pertencem.",
          },
          { pt: "Nada se perde. Sem bagunça." },
        ],
      },
      {
        id: "comms",
        type: "focus",
        cls: "flip",
        post: 0.75,
        props: {
          kicker: "Pendências e avisos",
          title: "Todos sabem *o que está pendente*",
          shots: [
            // Pendências do despachante: lista limpa (as internas ainda têm
            // rótulos sem tradução no portal).
            { shot: "broker", ox: "55%", oy: "18%", zoom: 1.12, c: 0 },
            {
              shot: "messages-control",
              ox: "55%",
              oy: "22%",
              zoom: 1.12,
              c: 1,
            },
          ],
          chips: [
            { icon: "bell", label: "Sino de notificações", c: 0, d: 0.6 },
            {
              icon: "inbox",
              label: "Minhas pendências · o que depende de você",
              c: 0,
              d: 2.2,
            },
            {
              icon: "clock",
              label: "A Wellmix vê quem deve a resposta · 1 dia útil",
              c: 1,
            },
          ],
        },
        say: [
          {
            pt: "O sino de notificações e as pendências mostram a cada pessoa o que está à espera dela.",
          },
          { pt: "E a Wellmix vê quem deve a resposta." },
        ],
      },
      {
        id: "langs",
        type: "trio",
        chapter: "Feito para o controle",
        props: {
          kicker: "Três idiomas",
          title: "Português. English. *中文.*",
          shot: "supplier",
          dirs: { pt: "br-pt", en: "br-en", zh: "br-zh" },
        },
        say: [{ pt: "O portal fala português, inglês e chinês." }],
      },
      {
        id: "access",
        type: "access",
        props: {
          kicker: "Acesso por papel",
          title: "Cada parceiro vê *os seus pedidos.*\nNada além disso.",
          views: [
            {
              role: "Cliente",
              icon: "store",
              sees: [
                "Pedidos e situação próprios",
                "Forma de pagamento e boletos",
              ],
              hidden: ["Fornecedor", "Preço de compra", "Margem"],
              c: 1,
            },
            {
              role: "Fornecedor",
              icon: "factory",
              sees: [
                "Solicitações e pedidos próprios",
                "Previsão de pagamento",
              ],
              hidden: ["Preço de venda ao cliente", "Margem"],
              c: 1,
              d: 0.5,
            },
            {
              role: "Parceiros de serviço",
              icon: "handshake",
              sees: [
                "Só os pedidos em que trabalham",
                "Suas pendências e prazos",
              ],
              hidden: ["Pedidos de outras empresas", "Margem"],
              c: 1,
              d: 1.0,
            },
          ],
        },
        say: [
          { pt: "O acesso é definido pelo papel." },
          { pt: "Cada parceiro vê os seus pedidos, e nada além disso." },
          {
            pt: "O cliente nunca vê o fornecedor, o preço de compra nem a margem.",
          },
        ],
      },
      {
        id: "evidence",
        type: "focus",
        post: 0.4,
        cls: "flip",
        props: {
          kicker: "Qualidade",
          title: "Documentado *em cada etapa*",
          shots: [
            {
              shot: "order-inspection",
              ox: "55%",
              oy: "20%",
              zoom: 1.12,
              c: 0,
            },
            { shot: "order-container", ox: "55%", oy: "34%", zoom: 1.12, c: 2 },
            { shot: "shipping-docs", ox: "55%", oy: "30%", zoom: 1.12, c: 3 },
          ],
          chips: [
            {
              icon: "video",
              label: "Inspeção · fotos, peso, vídeo",
              c: 1,
            },
            {
              icon: "container",
              label: "Carregamento · fotos, lacre, número do container",
              c: 2,
            },
            {
              icon: "file-check",
              label: "Documentos · conferidos linha a linha",
              c: 3,
            },
          ],
        },
        say: [
          { pt: "A qualidade fica documentada em cada etapa." },
          { pt: "Inspeção com fotos, peso e vídeo." },
          {
            pt: "Carregamento do container com fotos, lacre e número do container.",
          },
          { pt: "Packing list, invoice e BL, conferidos linha a linha." },
        ],
      },
      {
        id: "control",
        type: "focus",
        post: 0.45,
        props: {
          kicker: "Para a gestão",
          title: "O processo todo, *por etapa*",
          shots: [
            { shot: "tower", ox: "62%", oy: "34%", zoom: 1.12, c: 0 },
            { shot: "sla", ox: "55%", oy: "24%", zoom: 1.1, c: 1 },
            { shot: "audit", ox: "55%", oy: "30%", zoom: 1.1, c: 2 },
          ],
          chips: [
            { icon: "layout-dashboard", label: "Control Tower", c: 0, d: 0.8 },
            {
              icon: "gauge",
              label: "Painel de SLA · atrasos, vence hoje, responsável",
              c: 1,
            },
            { icon: "history", label: "Painéis e trilha de auditoria", c: 2 },
          ],
        },
        say: [
          {
            pt: "Para a gestão, a Control Tower mostra todo o processo por etapa.",
          },
          {
            pt: "O painel de SLA mostra o que atrasou, o que vence hoje e quem é o responsável.",
          },
          { pt: "Painéis e uma trilha de auditoria completam o quadro." },
        ],
      },
      {
        id: "devices",
        type: "devices",
        post: 0.55,
        props: {
          kicker: "Em qualquer lugar",
          title: "Qualquer tela.\n*Instala como app.*",
          shot: "tower",
          phones: ["m-tower", "m-supplier"],
          chip: {
            icon: "link",
            label: "Feito para o ERP da Wellmix",
            c: 1,
          },
        },
        say: [
          {
            pt: "Funciona em qualquer tela e se instala como aplicativo no celular.",
          },
          { pt: "E foi feito para trabalhar com o ERP da Wellmix." },
        ],
      },
      {
        ...END,
        say: [
          { pt: "Um portal. Todos os parceiros. Cada etapa da jornada." },
          { pt: "Wellmix. Importação do pedido à entrega." },
        ],
      },
    ],
  },
};
