/**
 * Dicionário do módulo "freight-tariff" (tarifário de frete marítimo
 * importado da planilha das companhias marítimas, CSV do Sankhya e frete por
 * m³): mesmas chaves em pt, en e zh.
 */
export const pt = {
  "nav.freightTariff": "Tarifário de frete",
  "tariff.title": "Tarifário de frete",
  "tariff.subtitle":
    "Tabelas de frete das companhias marítimas lado a lado: frete por rota, taxas, PTAX/IOF e prazo de pagamento. Só a Wellmix vê o comparativo.",
  "tariff.help.body":
    "Cada companhia marítima envia a própria planilha de estimativa de frete (abas COMPARATIVO - NVT, ITJ e IOA) pelo portal; a Wellmix também pode importar em nome de uma companhia ou a planilha consolidada. O portal junta as tabelas vigentes num comparativo com o mesmo câmbio para todas (dólar do dia), refaz cada total em R$ com as taxas, o PTAX e o IOF da própria companhia (frete e taxas em US$ × câmbio × (1 + PTAX) × (1 + IOF) + frete até o CD + taxas em R$), mostra o menor custo de cada porto, avisa o que estiver estranho nas planilhas, gera o CSV do Sankhya (AD_FREINT) sem macro e atualiza o frete por m³ do preço.",
  "tariff.help.steps":
    "Peça a cada companhia para enviar a tabela dela pelo portal (menu Minha tabela de frete ou o botão no Embarque do pedido).\nSe a tabela chegou por e-mail, importe aqui escolhendo a companhia; a planilha consolidada vale para quem ainda não mandou a própria.\nLeia a conferência: ela aponta fórmulas e taxas que não batem.\nBaixe o CSV do Sankhya e importe no ERP.\nO frete por m³ atualiza sozinho a cada tabela; variação grande espera o admin conferir.",
  "tariff.import.title": "Importar planilha da companhia marítima",
  "tariff.import.hint":
    "Planilha de estimativa de frete (.xlsx ou .xlsm) no modelo com as abas COMPARATIVO - NVT, ITJ e IOA (e FORNECEDORES e PORTOS, se tiver). A planilha de uma companhia substitui só a anterior dela. Macros não são executadas.",
  "tariff.import.file": "Planilha (.xlsx ou .xlsm)",
  "tariff.import.date": "Data de referência",
  "tariff.import.dateHint": "Vai para a DTREFERENCIA do Sankhya.",
  "tariff.import.submit": "Importar planilha",
  "tariff.imported":
    "Planilha importada ({source}): {rates} tarifas de {forwarders} companhias. O comparativo já usa ela.",
  "tariff.backToOrder": "← Voltar ao pedido",
  "tariff.empty": "Nenhum tarifário importado ainda. Importe a planilha acima.",
  "tariff.status.active": "Vigente",
  "tariff.status.replaced": "Substituído",
  "tariff.viewingOld":
    "Você está vendo um tarifário antigo (referência {date}).",
  "tariff.viewCurrent": "Ver o vigente",
  "tariff.stat.date": "Data de referência",
  "tariff.stat.fx": "Câmbio da planilha",
  "tariff.stat.fxDetail": "US$ 1 = R$ {base} + spread {spread} · {dest}",
  "tariff.stat.road": "Frete até o CD",
  "tariff.stat.roadDetail": "por container · {dest}",
  "tariff.stat.rates": "Tarifas",
  "tariff.stat.ratesDetail":
    "{forwarders} companhias · {destinations} destinos",
  "tariff.download": "Baixar CSV do Sankhya (AD_FREINT)",
  "tariff.downloadHint":
    "Uma tarifa por companhia, porto e destino (rota direta; sem ela, a longa), no formato da macro, com o destino no AD_IDEXTERNO para o Sankhya guardar todos os destinos da mesma rota.",
  "tariff.original": "Planilha original",
  "tariff.warnings.title": "Conferência da planilha ({n})",
  "tariff.warnings.ok":
    "Conferência sem avisos: os totais da planilha batem com a conta.",
  "tariff.warning.fees_other_agent":
    "{sheet}: na planilha, o total em R$ de {forwarder} soma as taxas de {other} ({n} rotas). O portal recalculou com as taxas da própria {forwarder}.",
  "tariff.warning.total_mismatch":
    "{sheet}: {n} totais em R$ de {forwarder} na planilha não batem com a conta (frete × câmbio + frete até o CD + taxas). O portal usa a conta.",
  "tariff.warning.fees_copied":
    "{sheet}: as taxas são iguais, coluna por coluna, às da aba {otherSheet}, mas as companhias mudaram de lugar ({pairs}). Confira se foram copiadas sem ajustar.",
  "tariff.warning.ptax_iof_unused":
    "PTAX ({ptax}%) e IOF ({iof}%) estão na planilha, mas não entram em nenhum total (nem lá, nem aqui).",
  "tariff.warning.forwarder_no_code":
    "{forwarder} não tem código (CODPARC) na aba FORNECEDORES: fica fora do CSV do Sankhya.",
  "tariff.warning.port_no_id":
    "Porto {port} sem ID na aba PORTOS: fica fora do CSV do Sankhya.",
  "tariff.warning.destination_unknown":
    '{sheet}: destino "{code}" desconhecido; usado como está.',
  "tariff.warning.params_differ":
    "{sheet}: câmbio de R$ {fx}, diferente da aba {first} (R$ {firstFx}). Cada aba usa o próprio câmbio; confira se é o do mesmo dia.",
  "tariff.warning.sankhya_tab_outdated":
    "A aba AD_FREINT da planilha está diferente dos comparativos ({n} linhas). Use o CSV gerado aqui.",
  "tariff.warning.sankhya_duplicate_ids":
    "No CSV do Sankhya, {n} códigos AD_IDEXTERNO se repetem (mesma companhia, porto e destino duas vezes). Confira os códigos (CODPARC) e os IDs de porto.",
  "tariff.warning.cell_error":
    "{sheet}: erro na célula {cell} (#REF!/#VALUE!); esse valor ficou de fora.",
  "tariff.dest.label": "Destino",
  "tariff.table.caption":
    "Custo total por container {type} em R$: frete e taxas em US$ × câmbio × (1 + PTAX) × (1 + IOF) da companhia + frete até o CD + taxas em R$. Em verde, o menor custo de cada porto.",
  "tariff.table.origin": "Porto de origem",
  "tariff.table.best": "Menor custo",
  "tariff.table.term": "prazo {n} dias",
  "tariff.table.noTerm": "sem prazo",
  "tariff.table.noRates": "Sem tarifas para este destino.",
  "tariff.route.direct": "direta",
  "tariff.route.long": "longa",
  "tariff.fees.title": "Taxas por companhia",
  "tariff.fees.fee": "Taxa",
  "tariff.fees.total": "Total das taxas (planilha)",
  "tariff.fees.totalBrl": "Taxas em R$ no embarque",
  "tariff.fees.perShipment": "por embarque",
  "tariff.perCbm.title": "Frete por m³",
  "tariff.perCbm.body":
    "Mediana do menor custo de {ports} portos até {dest}: R$ {container} por container ÷ {capacity} m³ ({type}) = R$ {perCbm} por m³.",
  "tariff.perCbm.current": "Hoje nas Configurações: {value}.",
  "tariff.perCbm.none": "não informado",
  "tariff.perCbm.apply": "Usar R$ {perCbm}/m³ ({dest}) no preço",
  "tariff.perCbm.applyHint":
    "Vale quando a companhia ainda não informou o frete do produto (vitrine e valor ao cliente). Aplicar à mão é do admin; o destino escolhido passa a valer nas próximas atualizações automáticas.",
  "tariff.perCbm.applied": "Frete por m³ atualizado nas Configurações.",
  "tariff.perCbm.noCapacity":
    "Cadastre o container 40HC nas Configurações para calcular o frete por m³.",
  "tariff.history.title": "Importações",
  "tariff.history.date": "Referência",
  "tariff.history.file": "Arquivo",
  "tariff.history.by": "Por",
  "tariff.history.when": "Importado em",
  "tariff.history.rates": "Tarifas",
  "tariff.history.status": "Situação",
  "tariff.history.view": "Ver",
  "tariff.error.tariff_file_required": "Escolha a planilha.",
  "tariff.error.tariff_too_large": "Planilha grande demais (máximo 4 MB).",
  "tariff.error.tariff_xls":
    "Formato .xls antigo: abra no Excel e salve como .xlsx ou .xlsm.",
  "tariff.error.tariff_invalid":
    "Não consegui ler o arquivo. Envie a planilha em .xlsx ou .xlsm.",
  "tariff.error.tariff_no_sheets":
    'Não achei as abas "COMPARATIVO - NVT/ITJ/IOA" com a linha "USD POR 40HQ". Use a planilha modelo.',
  "tariff.error.tariff_fx_missing":
    "Não achei o câmbio (fica abaixo da lista de portos, na coluna dos portos).",
  "tariff.error.tariff_empty": "A planilha não tem nenhum frete preenchido.",
  "tariff.error.tariff_date_invalid": "Data de referência inválida.",
  "tariff.error.tariff_not_found": "Tarifário não encontrado.",
  "tariff.error.tariff_no_suggestion":
    "Sem tarifas para calcular o frete por m³ deste destino.",
  "tariff.error.forbidden":
    "Sem permissão. Mudar o frete por m³ das Configurações é só do admin.",
  "tariff.error.schema_outdated":
    "A tabela do tarifário ainda não foi publicada no banco. Publique o esquema do Appwrite e tente de novo.",
  "tariff.error.invalid_input": "Dados inválidos.",
  "tariff.order.title": "Frete pelo tarifário",
  "tariff.order.import": "Importar planilha da companhia marítima",
  "tariff.order.viewAll": "Ver tarifário completo",
  "tariff.order.none":
    "Nenhuma tabela de frete ainda. Cada companhia envia a dela pelo portal; você também pode importar.",
  "tariff.order.from": "Tabelas até {date} · origem {origin}",
  "tariff.order.noLocation":
    "A ficha de compra ainda não tem o local do fornecedor. Escolha abaixo o porto de embarque.",
  "tariff.order.noRates": "Sem tarifas para {origin} nas tabelas vigentes.",
  "tariff.order.assigned": "companhia do pedido",
  "tariff.order.hint":
    "Só a Wellmix vê. Data de embarque, chegada, navio e BL abaixo são opcionais: confirme o embarque para avançar.",
  "tariff.order.unavailable":
    "O tarifário não pôde ser lido agora. Abra de novo daqui a pouco.",
  "tariff.order.containers": "{n} × 40HQ",
  "tariff.order.pickOrigin": "Porto de embarque",
  "tariff.order.pickSubmit": "Ver frete",
  "tariff.order.noOrigin":
    'O local do fornecedor na ficha ("{location}") não é um porto do tarifário. Escolha abaixo o porto de embarque.',
  "tariff.error.tariff_encrypted":
    "A planilha está protegida por senha. Abra no Excel, tire a senha de abertura (Arquivo → Informações → Proteger pasta de trabalho) e envie de novo.",
  "tariff.table.captionShipment":
    "Custo total do embarque ({type}) em R$: frete e taxas em US$ × câmbio × (1 + PTAX) × (1 + IOF) da companhia + frete até o CD + taxas em R$. Em verde, o menor custo de cada porto.",
  "tariff.notes.title": "Para saber ({n})",
  "tariff.warning.road_freight_missing":
    '{sheet}: sem "FRETE (CD)"; os totais usam R$ {value} de frete até o CD.',
  "tariff.warning.port_no_id_similar":
    'Porto {port} sem ID na aba PORTOS. Lá existe "{similar}" (ID {id}): se for o mesmo porto, corrija o nome para ele entrar no CSV do Sankhya.',
  "tariff.warning.fx_missing":
    "{sheet}: câmbio vazio ou com erro; os totais usam R$ {fx} (de outra aba). Confira a célula do dólar.",
  "tariff.warning.containers_differ":
    "{sheet}: {n} container(s) na estimativa, e a aba {first} tem {firstN}. Os totais são do embarque inteiro; no pedido, as opções são comparadas por container.",
  "tariff.warning.destination_fixed_id":
    "{port} não está na aba PORTOS; o CSV do Sankhya usa o ID {id}, o mesmo da macro.",
  "tariff.order.perContainer": "{value} por container",
  "nav.myFreightTariff": "Minha tabela de frete",
  "tariff.range": "{min} a {max}",
  "tariff.mine.title": "Minha tabela de frete",
  "tariff.mine.subtitle":
    "Envie sua planilha de fretes para a Wellmix. Só você e a Wellmix veem; as outras companhias, não.",
  "tariff.mine.help.body":
    "Use a planilha de estimativa de frete da Wellmix (abas COMPARATIVO - NVT, ITJ e IOA) com os seus preços: frete por container 40HQ de cada porto de origem, rota direta ou longa, taxas em US$ e R$, PTAX, IOF e prazo de pagamento. O portal confere a planilha e mostra o que estiver estranho.",
  "tariff.mine.help.steps":
    "Preencha a planilha com os seus preços.\nEnvie aqui (a nova substitui a anterior).\nLeia a conferência e, se apontar algo, corrija e envie de novo.",
  "tariff.mine.importTitle": "Enviar minha planilha de fretes",
  "tariff.mine.importHint":
    "Planilha de estimativa de frete (.xlsx ou .xlsm) no modelo da Wellmix, com os seus preços. Tudo o que estiver nela entra como seu; a nova substitui a anterior. Macros não são executadas.",
  "tariff.mine.dateHint": "Data da sua cotação.",
  "tariff.mine.submit": "Enviar planilha",
  "tariff.mine.empty":
    "Você ainda não enviou sua tabela de frete. Envie a planilha acima.",
  "tariff.mine.imported":
    "Planilha enviada: {rates} tarifas. A Wellmix já recebeu.",
  "tariff.import.company": "De quem é a planilha",
  "tariff.import.companyPick": "Escolha…",
  "tariff.import.consolidated": "Várias companhias (planilha consolidada)",
  "tariff.import.companyHint":
    "A planilha inteira entra como preços da companhia escolhida (o nome no arquivo não importa) e substitui só a anterior dela.",
  "tariff.error.tariff_company_required":
    "Escolha de quem é a planilha: a companhia ou a consolidada.",
  "tariff.error.tariff_company_invalid":
    "Companhia marítima não encontrada no cadastro.",
  "tariff.backToCompare": "← Voltar ao comparativo",
  "tariff.viewingSource":
    "Você está vendo só a planilha de {source} (referência {date}), com o câmbio dela.",
  "tariff.compare.consolidated": "Planilha consolidada",
  "tariff.compare.viewOne": "Ver só esta planilha",
  "tariff.compare.sources": "Tabelas no comparativo",
  "tariff.compare.warnings": "Avisos",
  "tariff.compare.missing": "Ainda não enviaram a própria tabela: {names}.",
  "tariff.compare.sourceHeading": "{source} · {date}",
  "tariff.compare.downloadHint":
    "Uma tarifa por companhia, porto e destino (rota direta; sem ela, a longa), cada companhia com a data da tabela dela, com o destino no AD_IDEXTERNO para o Sankhya guardar todos os destinos da mesma rota.",
  "tariff.stat.updated": "Tabela mais nova",
  "tariff.stat.fxCompare": "Câmbio do comparativo",
  "tariff.stat.fxPortalDetail":
    "dólar do dia (PTAX de {date}) + spread da planilha da Wellmix, o mesmo para todas",
  "tariff.stat.fxSheetDetail": "da planilha (sem o dólar do dia no portal)",
  "tariff.history.company": "Companhia",
  "tariff.warning.ptax_iof_added":
    "PTAX ({ptax}%) e IOF ({iof}%) de cada companhia entram nos totais: o que é pago em US$ (frete e taxas) vale US$ × câmbio × (1 + PTAX) × (1 + IOF). A planilha não soma os dois, por isso os totais daqui ficam maiores que os dela.",
  "tariff.warning.ptax_iof_missing":
    "{sheet}: {forwarder} sem {missing} na planilha; o total dele fica sem esse acréscimo.",
  "tariff.fees.ptaxIof": "PTAX / IOF",
  "tariff.perCbm.auto":
    "Atualiza sozinho a cada tabela importada, pelo destino {dest}. Se a variação passar de {max}%, o valor antigo continua até o admin conferir.",
  "tariff.perCbm.autoApplied":
    "Última atualização automática ({date}): R$ {perCbm}/m³ aplicado.",
  "tariff.perCbm.autoHeld":
    "Última atualização automática ({date}): R$ {perCbm}/m³ não aplicado (antes {previous}; variação grande). Confira as tabelas e, se estiver certo, aplique.",
  "tariff.perCbm.autoSkipped.no_capacity":
    "Última atualização automática ({date}): sem cálculo (cadastre o container 40HC nas Configurações).",
  "tariff.perCbm.autoSkipped.no_rates":
    "Última atualização automática ({date}): sem cálculo (nenhuma tarifa no destino).",
  "tariff.perCbm.applyHintOperator":
    "Vale quando a companhia ainda não informou o frete do produto (vitrine e valor ao cliente). Aplicar à mão é só do admin.",
  "tariff.upload.title": "Sua tabela de frete",
  "tariff.upload.button": "Importar planilha",
  "tariff.upload.last": "Última enviada: referência {date}, {rates} tarifas.",
  "tariff.upload.none":
    "Você ainda não enviou sua tabela de frete para a Wellmix.",
  "tariff.upload.hint":
    "Data de embarque, chegada, navio e BL abaixo são opcionais: confirme o embarque para avançar.",
  "tariff.error.tariff_other_companies":
    "Envie a planilha de novo: ela entra inteira para a companhia escolhida, com qualquer nome no arquivo.",
  "tariff.warning.other_blocks_ignored":
    "Entraram só os preços de {kept}; os blocos de outras companhias ({ignored}) ficaram de fora.",
  "tariff.sheet.fxDetail": "dólar {base} + spread {spread}",
  "tariff.sheet.formulaTitle": "Pela conta da planilha: {value}",
  "tariff.sheet.formulaShort": "conta: {value}",
  "tariff.sheet.country": "País",
  "tariff.sheet.usdDirect": "US$ 40HQ direta",
  "tariff.sheet.usdLong": "US$ 40HQ longa",
  "tariff.sheet.brlDirect": "Total R$ direta",
  "tariff.sheet.brlLong": "Total R$ longa",
  "tariff.sheet.side": "Lado",
  "tariff.sheet.feesTotals": "Totais das taxas (US$ · R$)",
  "tariff.sheet.feesSheet": "Taxas em R$ (conta da planilha)",
  "tariff.sheet.feesPortal": "Taxas em R$ com PTAX e IOF (portal)",
  "tariff.sheet.paramsTitle": "Parâmetros da aba {dest}",
  "tariff.sheet.fx": "Câmbio (dólar + spread)",
  "tariff.sheet.road": "Frete (CD), por container",
  "tariff.sheet.containers": "Qtd. de containers",
  "tariff.sheet.date": "Data de referência",
  "tariff.sheet.ratesTitle": "Comparativo {dest} (como na planilha)",
  "tariff.sheet.ratesHint":
    "Valores como estão na planilha, com todos os portos e companhias. Os totais em R$ são os da planilha (sem PTAX e IOF); o Resumo mostra os totais do portal, com PTAX e IOF.",
  "tariff.sheet.legendBestDirect": "Menor custo: rota direta",
  "tariff.sheet.legendBestLong": "Menor custo: rota longa",
  "tariff.sheet.legendWorst": "Maior custo: ambas as rotas",
  "tariff.sheet.legendMismatch": "Total diferente da conta da planilha",
  "tariff.sheet.mismatches":
    "{n} totais da planilha não batem com a conta dela (frete × câmbio + frete até o CD + taxas): o valor pela conta aparece embaixo, em amarelo.",
  "tariff.sheet.feesTitle": "Taxas {dest} (como na planilha)",
  "tariff.sheet.codesTitle": "Códigos do Sankhya (abas FORNECEDORES e PORTOS)",
  "tariff.sheet.company": "Companhia",
  "tariff.sheet.noCode": "sem código",
  "tariff.sheet.port": "Porto",
  "tariff.sheet.destination": "destino",
  "tariff.sheet.noId": "sem ID",
  "tariff.sheet.sankhyaTitle": "Arquivo do Sankhya: {n} linhas de {dest}",
  "tariff.sheet.sankhyaHint":
    "As linhas que vão no AD_FREINT.CSV para este destino. O AD_IDEXTERNO leva o destino, para o Sankhya guardar todos os destinos da mesma rota.",
  "tariff.sheet.sankhyaShow": "Ver as {n} linhas",
  "tariff.sheet.sankhyaNone":
    "Nenhuma linha: falta código (CODPARC) ou ID de porto. Veja os códigos acima.",
  "tariff.view.sheet": "Como na planilha",
  "tariff.view.summary": "Resumo (com PTAX e IOF)",
  "tariff.compare.viewSheet": "Ver planilha",
  "tariff.warning.several_blocks":
    "A planilha tem {n} blocos ({blocks}) e todos entraram como preços de {company}. Se algum não for dela, apague-o da planilha e envie de novo.",
  "tariff.mine.goesTo": "Esta planilha vai para",
  "tariff.mine.goesToHint":
    "Sua companhia; o nome dos blocos na planilha não importa.",
  "tariff.warning.line_no_code":
    "{company} não tem código do Sankhya: nenhum bloco das planilhas da Wellmix é dela (cadastre a companhia com o nome do bloco dela na planilha consolidada). Os preços dela ficam fora do CSV.",
  "tariff.warning.block_owner_ambiguous":
    "O bloco {block} da planilha consolidada bate com mais de uma companhia do cadastro ({companies}): continua no comparativo e no CSV como da consolidada, sem ir para nenhuma delas. Deixe só um cadastro ativo com esse nome.",
};

export const en: Record<keyof typeof pt, string> = {
  "nav.freightTariff": "Freight tariff",
  "tariff.title": "Freight tariff",
  "tariff.subtitle":
    "Shipping lines' freight tables side by side: freight per route, fees, PTAX/IOF and payment terms. Only Wellmix sees the comparison.",
  "tariff.help.body":
    "Each shipping line sends its own freight estimate spreadsheet (COMPARATIVO - NVT, ITJ and IOA tabs) through the portal; Wellmix can also import one on a line's behalf, or the consolidated spreadsheet. The portal joins the current tables into one comparison with the same FX for all (today's dollar), recomputes each BRL total with the line's own fees, PTAX and IOF (USD freight and fees × FX × (1 + PTAX) × (1 + IOF) + road freight to the DC + BRL fees), shows the cheapest cost per port, flags anything odd in the spreadsheets, builds the Sankhya CSV (AD_FREINT) without a macro and updates the freight per m³ used in prices.",
  "tariff.help.steps":
    "Ask each shipping line to send its table through the portal (My freight table menu or the button in the order's Shipping stage).\nIf a table came by e-mail, import it here choosing the line; the consolidated spreadsheet covers lines that have not sent their own yet.\nRead the check: it points out formulas and fees that do not add up.\nDownload the Sankhya CSV and import it into the ERP.\nThe freight per m³ updates by itself with each table; a big change waits for the admin to check.",
  "tariff.import.title": "Import the shipping line spreadsheet",
  "tariff.import.hint":
    "Freight estimate spreadsheet (.xlsx or .xlsm) in the template with the COMPARATIVO - NVT, ITJ and IOA tabs (and FORNECEDORES and PORTOS, if present). A line's spreadsheet only replaces that line's previous one. Macros are never run.",
  "tariff.import.file": "Spreadsheet (.xlsx or .xlsm)",
  "tariff.import.date": "Reference date",
  "tariff.import.dateHint": "Goes to Sankhya's DTREFERENCIA.",
  "tariff.import.submit": "Import spreadsheet",
  "tariff.imported":
    "Spreadsheet imported ({source}): {rates} rates from {forwarders} lines. The comparison already uses it.",
  "tariff.backToOrder": "← Back to the order",
  "tariff.empty": "No tariff imported yet. Import the spreadsheet above.",
  "tariff.status.active": "Current",
  "tariff.status.replaced": "Replaced",
  "tariff.viewingOld": "You are viewing an old tariff (reference {date}).",
  "tariff.viewCurrent": "View the current one",
  "tariff.stat.date": "Reference date",
  "tariff.stat.fx": "Spreadsheet FX",
  "tariff.stat.fxDetail": "USD 1 = BRL {base} + spread {spread} · {dest}",
  "tariff.stat.road": "Freight to the DC",
  "tariff.stat.roadDetail": "per container · {dest}",
  "tariff.stat.rates": "Rates",
  "tariff.stat.ratesDetail":
    "{forwarders} shipping lines · {destinations} destinations",
  "tariff.download": "Download Sankhya CSV (AD_FREINT)",
  "tariff.downloadHint":
    "One rate per line, port and destination (direct route; without it, the long one), in the macro's format, with the destination in AD_IDEXTERNO so Sankhya keeps every destination of the same route.",
  "tariff.original": "Original spreadsheet",
  "tariff.warnings.title": "Spreadsheet check ({n})",
  "tariff.warnings.ok":
    "Check passed: the spreadsheet totals match the calculation.",
  "tariff.warning.fees_other_agent":
    "{sheet}: in the spreadsheet, the BRL total for {forwarder} adds {other}'s fees ({n} routes). The portal recomputed it with {forwarder}'s own fees.",
  "tariff.warning.total_mismatch":
    "{sheet}: {n} BRL totals for {forwarder} in the spreadsheet do not match the calculation (freight × FX + freight to the DC + fees). The portal uses the calculation.",
  "tariff.warning.fees_copied":
    "{sheet}: the fees are identical, column by column, to the {otherSheet} tab, but the shipping lines changed places ({pairs}). Check whether they were copied without adjusting.",
  "tariff.warning.ptax_iof_unused":
    "PTAX ({ptax}%) and IOF ({iof}%) are in the spreadsheet but are not part of any total (neither there nor here).",
  "tariff.warning.forwarder_no_code":
    "{forwarder} has no code (CODPARC) in the FORNECEDORES tab: left out of the Sankhya CSV.",
  "tariff.warning.port_no_id":
    "Port {port} has no ID in the PORTOS tab: left out of the Sankhya CSV.",
  "tariff.warning.destination_unknown":
    '{sheet}: unknown destination "{code}"; used as is.',
  "tariff.warning.params_differ":
    "{sheet}: FX of BRL {fx}, different from the {first} tab (BRL {firstFx}). Each tab uses its own FX; check that it is the same day's rate.",
  "tariff.warning.sankhya_tab_outdated":
    "The spreadsheet's AD_FREINT tab differs from the comparison tabs ({n} rows). Use the CSV built here.",
  "tariff.warning.sankhya_duplicate_ids":
    "In the Sankhya CSV, {n} AD_IDEXTERNO codes repeat (same line, port and destination twice). Check the codes (CODPARC) and port IDs.",
  "tariff.warning.cell_error":
    "{sheet}: error in cell {cell} (#REF!/#VALUE!); that value was left out.",
  "tariff.dest.label": "Destination",
  "tariff.table.caption":
    "Total cost per {type} container in BRL: USD freight and fees × FX × (1 + PTAX) × (1 + IOF) of the line + road freight to the DC + BRL fees. In green, the cheapest cost per port.",
  "tariff.table.origin": "Origin port",
  "tariff.table.best": "Cheapest",
  "tariff.table.term": "{n}-day terms",
  "tariff.table.noTerm": "no terms",
  "tariff.table.noRates": "No rates for this destination.",
  "tariff.route.direct": "direct",
  "tariff.route.long": "long",
  "tariff.fees.title": "Fees per shipping line",
  "tariff.fees.fee": "Fee",
  "tariff.fees.total": "Fees total (spreadsheet)",
  "tariff.fees.totalBrl": "Fees in BRL per shipment",
  "tariff.fees.perShipment": "per shipment",
  "tariff.perCbm.title": "Freight per m³",
  "tariff.perCbm.body":
    "Median of the cheapest cost from {ports} ports to {dest}: BRL {container} per container ÷ {capacity} m³ ({type}) = BRL {perCbm} per m³.",
  "tariff.perCbm.current": "Currently in Settings: {value}.",
  "tariff.perCbm.none": "not set",
  "tariff.perCbm.apply": "Use BRL {perCbm}/m³ ({dest}) in prices",
  "tariff.perCbm.applyHint":
    "Used when the line has not quoted the product freight yet (storefront and customer price). Applying by hand is for the admin; the chosen destination is used in the next automatic updates.",
  "tariff.perCbm.applied": "Freight per m³ updated in Settings.",
  "tariff.perCbm.noCapacity":
    "Add the 40HC container in Settings to compute the freight per m³.",
  "tariff.history.title": "Imports",
  "tariff.history.date": "Reference",
  "tariff.history.file": "File",
  "tariff.history.by": "By",
  "tariff.history.when": "Imported on",
  "tariff.history.rates": "Rates",
  "tariff.history.status": "Status",
  "tariff.history.view": "View",
  "tariff.error.tariff_file_required": "Choose the spreadsheet.",
  "tariff.error.tariff_too_large": "Spreadsheet too large (max 4 MB).",
  "tariff.error.tariff_xls":
    "Old .xls format: open it in Excel and save as .xlsx or .xlsm.",
  "tariff.error.tariff_invalid":
    "Could not read the file. Send the spreadsheet as .xlsx or .xlsm.",
  "tariff.error.tariff_no_sheets":
    'Could not find the "COMPARATIVO - NVT/ITJ/IOA" tabs with the "USD POR 40HQ" row. Use the template spreadsheet.',
  "tariff.error.tariff_fx_missing":
    "Could not find the FX rate (below the port list, in the ports column).",
  "tariff.error.tariff_empty": "The spreadsheet has no freight filled in.",
  "tariff.error.tariff_date_invalid": "Invalid reference date.",
  "tariff.error.tariff_not_found": "Tariff not found.",
  "tariff.error.tariff_no_suggestion":
    "No rates to compute the freight per m³ for this destination.",
  "tariff.error.forbidden":
    "Not allowed. Only the admin can change the freight per m³ in Settings.",
  "tariff.error.schema_outdated":
    "The tariff table is not published in the database yet. Publish the Appwrite schema and try again.",
  "tariff.error.invalid_input": "Invalid data.",
  "tariff.order.title": "Freight from the tariff",
  "tariff.order.import": "Import the shipping line spreadsheet",
  "tariff.order.viewAll": "View the full tariff",
  "tariff.order.none":
    "No freight table yet. Each line sends its own through the portal; you can also import one.",
  "tariff.order.from": "Tables up to {date} · origin {origin}",
  "tariff.order.noLocation":
    "The purchase sheet has no supplier location yet. Choose the loading port below.",
  "tariff.order.noRates": "No rates for {origin} in the current tables.",
  "tariff.order.assigned": "order's shipping line",
  "tariff.order.hint":
    "Only Wellmix sees this. Shipping date, arrival, vessel and BL below are optional: confirm the shipment to move on.",
  "tariff.order.unavailable":
    "The tariff could not be read right now. Open the order again in a moment.",
  "tariff.order.containers": "{n} × 40HQ",
  "tariff.order.pickOrigin": "Loading port",
  "tariff.order.pickSubmit": "Show freight",
  "tariff.order.noOrigin":
    'The supplier location on the sheet ("{location}") is not a port in the tariff. Choose the loading port below.',
  "tariff.error.tariff_encrypted":
    "The spreadsheet is password-protected. Open it in Excel, remove the opening password (File → Info → Protect Workbook) and send it again.",
  "tariff.table.captionShipment":
    "Total shipment cost ({type}) in BRL: USD freight and fees × FX × (1 + PTAX) × (1 + IOF) of the line + road freight to the DC + BRL fees. In green, the cheapest cost per port.",
  "tariff.notes.title": "Good to know ({n})",
  "tariff.warning.road_freight_missing":
    '{sheet}: no "FRETE (CD)"; totals use BRL {value} for freight to the DC.',
  "tariff.warning.port_no_id_similar":
    'Port {port} has no ID in the PORTOS tab. It lists "{similar}" (ID {id}): if it is the same port, fix the name so it goes into the Sankhya CSV.',
  "tariff.warning.fx_missing":
    "{sheet}: FX empty or with an error; totals use BRL {fx} (from another tab). Check the dollar cell.",
  "tariff.warning.containers_differ":
    "{sheet}: {n} container(s) in the estimate, while the {first} tab has {firstN}. Totals are for the whole shipment; on the order, options are compared per container.",
  "tariff.warning.destination_fixed_id":
    "{port} is not in the PORTOS tab; the Sankhya CSV uses ID {id}, the same as the macro.",
  "tariff.order.perContainer": "{value} per container",
  "nav.myFreightTariff": "My freight table",
  "tariff.range": "{min} to {max}",
  "tariff.mine.title": "My freight table",
  "tariff.mine.subtitle":
    "Send your freight spreadsheet to Wellmix. Only you and Wellmix see it; other lines do not.",
  "tariff.mine.help.body":
    "Use Wellmix's freight estimate spreadsheet (COMPARATIVO - NVT, ITJ and IOA tabs) with your prices: freight per 40HQ container from each origin port, direct or long route, fees in USD and BRL, PTAX, IOF and payment terms. The portal checks the spreadsheet and shows anything odd.",
  "tariff.mine.help.steps":
    "Fill in the spreadsheet with your prices.\nSend it here (the new one replaces the previous one).\nRead the check and, if it points something out, fix it and send again.",
  "tariff.mine.importTitle": "Send my freight spreadsheet",
  "tariff.mine.importHint":
    "Freight estimate spreadsheet (.xlsx or .xlsm) in the Wellmix template, with your prices. Everything in it comes in as yours; the new one replaces the previous one. Macros are not run.",
  "tariff.mine.dateHint": "Date of your quotation.",
  "tariff.mine.submit": "Send spreadsheet",
  "tariff.mine.empty":
    "You have not sent your freight table yet. Send the spreadsheet above.",
  "tariff.mine.imported":
    "Spreadsheet sent: {rates} rates. Wellmix has received it.",
  "tariff.import.company": "Whose spreadsheet",
  "tariff.import.companyPick": "Choose…",
  "tariff.import.consolidated": "Several lines (consolidated spreadsheet)",
  "tariff.import.companyHint":
    "The whole spreadsheet comes in as the chosen line's prices (names in the file do not matter) and only replaces that line's previous one.",
  "tariff.error.tariff_company_required":
    "Choose whose spreadsheet it is: the line or the consolidated one.",
  "tariff.error.tariff_company_invalid":
    "Shipping line not found in the registry.",
  "tariff.backToCompare": "← Back to the comparison",
  "tariff.viewingSource":
    "You are viewing only {source}'s spreadsheet (reference {date}), with its own FX.",
  "tariff.compare.consolidated": "Consolidated spreadsheet",
  "tariff.compare.viewOne": "View this spreadsheet only",
  "tariff.compare.sources": "Tables in the comparison",
  "tariff.compare.warnings": "Warnings",
  "tariff.compare.missing": "Not sent their own table yet: {names}.",
  "tariff.compare.sourceHeading": "{source} · {date}",
  "tariff.compare.downloadHint":
    "One rate per line, port and destination (direct route; without it, the long one), each line with its own table's date, with the destination in AD_IDEXTERNO so Sankhya keeps every destination of the same route.",
  "tariff.stat.updated": "Newest table",
  "tariff.stat.fxCompare": "Comparison FX",
  "tariff.stat.fxPortalDetail":
    "today's dollar (PTAX of {date}) + spread from Wellmix's spreadsheet, the same for all",
  "tariff.stat.fxSheetDetail":
    "from the spreadsheet (no daily dollar in the portal)",
  "tariff.history.company": "Line",
  "tariff.warning.ptax_iof_added":
    "Each line's PTAX ({ptax}%) and IOF ({iof}%) are in the totals: what is paid in USD (freight and fees) counts as USD × FX × (1 + PTAX) × (1 + IOF). The spreadsheet does not add them, so the totals here are higher than its own.",
  "tariff.warning.ptax_iof_missing":
    "{sheet}: {forwarder} has no {missing} in the spreadsheet; its total goes without that surcharge.",
  "tariff.fees.ptaxIof": "PTAX / IOF",
  "tariff.perCbm.auto":
    "Updates by itself with each imported table, using the {dest} destination. If the change is above {max}%, the old value stays until the admin checks.",
  "tariff.perCbm.autoApplied":
    "Last automatic update ({date}): BRL {perCbm}/m³ applied.",
  "tariff.perCbm.autoHeld":
    "Last automatic update ({date}): BRL {perCbm}/m³ not applied (before {previous}; big change). Check the tables and, if it is right, apply it.",
  "tariff.perCbm.autoSkipped.no_capacity":
    "Last automatic update ({date}): not computed (register the 40HC container in Settings).",
  "tariff.perCbm.autoSkipped.no_rates":
    "Last automatic update ({date}): not computed (no rates for the destination).",
  "tariff.perCbm.applyHintOperator":
    "Used when the line has not quoted the product freight yet (storefront and customer price). Only the admin applies it by hand.",
  "tariff.upload.title": "Your freight table",
  "tariff.upload.button": "Import spreadsheet",
  "tariff.upload.last": "Last sent: reference {date}, {rates} rates.",
  "tariff.upload.none": "You have not sent your freight table to Wellmix yet.",
  "tariff.upload.hint":
    "Shipping date, arrival, vessel and BL below are optional: confirm the shipment to move on.",
  "tariff.error.tariff_other_companies":
    "Send the spreadsheet again: it comes in whole for the chosen line, whatever the names in the file.",
  "tariff.warning.other_blocks_ignored":
    "Only {kept}'s prices came in; other lines' blocks ({ignored}) were left out.",
  "tariff.sheet.fxDetail": "dollar {base} + spread {spread}",
  "tariff.sheet.formulaTitle": "By the spreadsheet's own formula: {value}",
  "tariff.sheet.formulaShort": "formula: {value}",
  "tariff.sheet.country": "Country",
  "tariff.sheet.usdDirect": "USD 40HQ direct",
  "tariff.sheet.usdLong": "USD 40HQ long",
  "tariff.sheet.brlDirect": "Total BRL direct",
  "tariff.sheet.brlLong": "Total BRL long",
  "tariff.sheet.side": "Side",
  "tariff.sheet.feesTotals": "Fee totals (USD · BRL)",
  "tariff.sheet.feesSheet": "Fees in BRL (spreadsheet formula)",
  "tariff.sheet.feesPortal": "Fees in BRL with PTAX and IOF (portal)",
  "tariff.sheet.paramsTitle": "{dest} tab parameters",
  "tariff.sheet.fx": "FX (dollar + spread)",
  "tariff.sheet.road": "Road freight (DC), per container",
  "tariff.sheet.containers": "Containers",
  "tariff.sheet.date": "Reference date",
  "tariff.sheet.ratesTitle": "{dest} comparison (as in the spreadsheet)",
  "tariff.sheet.ratesHint":
    "Values as they are in the spreadsheet, with every port and line. BRL totals are the spreadsheet's (without PTAX and IOF); the Summary shows the portal's totals, with PTAX and IOF.",
  "tariff.sheet.legendBestDirect": "Lowest cost: direct route",
  "tariff.sheet.legendBestLong": "Lowest cost: long route",
  "tariff.sheet.legendWorst": "Highest cost: both routes",
  "tariff.sheet.legendMismatch": "Total differs from the spreadsheet's formula",
  "tariff.sheet.mismatches":
    "{n} spreadsheet totals don't match its own formula (freight × FX + road freight to the DC + fees): the formula value is shown below, in yellow.",
  "tariff.sheet.feesTitle": "{dest} fees (as in the spreadsheet)",
  "tariff.sheet.codesTitle": "Sankhya codes (FORNECEDORES and PORTOS tabs)",
  "tariff.sheet.company": "Line",
  "tariff.sheet.noCode": "no code",
  "tariff.sheet.port": "Port",
  "tariff.sheet.destination": "destination",
  "tariff.sheet.noId": "no ID",
  "tariff.sheet.sankhyaTitle": "Sankhya file: {n} rows for {dest}",
  "tariff.sheet.sankhyaHint":
    "The rows that go into AD_FREINT.CSV for this destination. AD_IDEXTERNO carries the destination, so Sankhya keeps every destination of the same route.",
  "tariff.sheet.sankhyaShow": "Show the {n} rows",
  "tariff.sheet.sankhyaNone":
    "No rows: a code (CODPARC) or port ID is missing. See the codes above.",
  "tariff.view.sheet": "As in the spreadsheet",
  "tariff.view.summary": "Summary (with PTAX and IOF)",
  "tariff.compare.viewSheet": "View spreadsheet",
  "tariff.warning.several_blocks":
    "The spreadsheet has {n} blocks ({blocks}) and all came in as {company}'s prices. If any is not theirs, delete it from the spreadsheet and send it again.",
  "tariff.mine.goesTo": "This spreadsheet goes to",
  "tariff.mine.goesToHint":
    "Your line; block names in the spreadsheet do not matter.",
  "tariff.warning.line_no_code":
    "{company} has no Sankhya code: no block in Wellmix's spreadsheets belongs to it (register the line with its block name from the consolidated spreadsheet). Its prices stay out of the CSV.",
  "tariff.warning.block_owner_ambiguous":
    "Block {block} of the consolidated spreadsheet matches more than one registered line ({companies}): it stays in the comparison and the CSV as consolidated and goes to none of them. Keep only one active registration with that name.",
};

export const zh: Record<keyof typeof pt, string> = {
  "nav.freightTariff": "运价表",
  "tariff.title": "海运运价表",
  "tariff.subtitle":
    "各船公司的运价表并排对比：各航线运费、费用、PTAX/IOF 和付款期限。只有 Wellmix 能看到对比。",
  "tariff.help.body":
    "每家船公司通过门户上传自己的运费估算表（COMPARATIVO - NVT、ITJ、IOA 工作表）；Wellmix 也可以代某家船公司导入，或导入汇总表。门户把现行的表合并成一个对比，所有船公司使用同一汇率（当日美元），用船公司自己的费用、PTAX 和 IOF 重新计算每个雷亚尔总额（美元运费和费用 × 汇率 × (1 + PTAX) × (1 + IOF) + 到配送中心的陆运费 + 雷亚尔费用），显示每个港口的最低成本，提示表中的异常，无需宏即可生成 Sankhya CSV（AD_FREINT），并更新报价用的每立方米运费。",
  "tariff.help.steps":
    "请每家船公司通过门户上传自己的运价表（“我的运价表”菜单或订单装运阶段的按钮）。\n如果运价表是通过邮件收到的，在这里选择船公司后导入；汇总表用于还没上传自己运价表的船公司。\n查看核对结果：它会指出对不上的公式和费用。\n下载 Sankhya CSV 并导入 ERP。\n每立方米运费随每张表自动更新；变化太大时等管理员核对。",
  "tariff.import.title": "导入船公司表格",
  "tariff.import.hint":
    "模板格式的运费估算表（.xlsx 或 .xlsm），含 COMPARATIVO - NVT、ITJ、IOA 工作表（如有，还有 FORNECEDORES 和 PORTOS）。某家船公司的表只替换它自己的上一张。不会运行宏。",
  "tariff.import.file": "表格（.xlsx 或 .xlsm）",
  "tariff.import.date": "参考日期",
  "tariff.import.dateHint": "写入 Sankhya 的 DTREFERENCIA。",
  "tariff.import.submit": "导入表格",
  "tariff.imported":
    "已导入（{source}）：{forwarders} 家船公司的 {rates} 条运价。对比已使用这张表。",
  "tariff.backToOrder": "← 返回订单",
  "tariff.empty": "尚未导入运价表。请在上方导入表格。",
  "tariff.status.active": "当前",
  "tariff.status.replaced": "已替换",
  "tariff.viewingOld": "您正在查看旧运价表（参考日期 {date}）。",
  "tariff.viewCurrent": "查看当前运价表",
  "tariff.stat.date": "参考日期",
  "tariff.stat.fx": "表格汇率",
  "tariff.stat.fxDetail": "1 美元 = {base} 雷亚尔 + 点差 {spread} · {dest}",
  "tariff.stat.road": "到配送中心的陆运",
  "tariff.stat.roadDetail": "每柜 · {dest}",
  "tariff.stat.rates": "运价",
  "tariff.stat.ratesDetail": "{forwarders} 家船公司 · {destinations} 个目的港",
  "tariff.download": "下载 Sankhya CSV（AD_FREINT）",
  "tariff.downloadHint":
    "每家船公司、每个港口和目的港一条运价（直达航线；没有时用长航线），格式与宏相同，AD_IDEXTERNO 包含目的港，Sankhya 会保留同一航线的所有目的港。",
  "tariff.original": "原始表格",
  "tariff.warnings.title": "表格核对（{n}）",
  "tariff.warnings.ok": "核对无提示：表格总额与计算一致。",
  "tariff.warning.fees_other_agent":
    "{sheet}：表格中 {forwarder} 的雷亚尔总额加的是 {other} 的附加费（{n} 条航线）。系统已用 {forwarder} 自己的附加费重新计算。",
  "tariff.warning.total_mismatch":
    "{sheet}：表格中 {forwarder} 有 {n} 个雷亚尔总额与计算不符（运费 × 汇率 + 陆运 + 附加费）。系统采用计算结果。",
  "tariff.warning.fees_copied":
    "{sheet}：附加费与 {otherSheet} 工作表逐列相同，但船公司位置不同（{pairs}）。请确认是否复制后未调整。",
  "tariff.warning.ptax_iof_unused":
    "表格中有 PTAX（{ptax}%）和 IOF（{iof}%），但未计入任何总额（表格和系统都没有）。",
  "tariff.warning.forwarder_no_code":
    "{forwarder} 在 FORNECEDORES 工作表中没有代码（CODPARC）：不会写入 Sankhya CSV。",
  "tariff.warning.port_no_id":
    "港口 {port} 在 PORTOS 工作表中没有 ID：不会写入 Sankhya CSV。",
  "tariff.warning.port_no_id_similar":
    "港口 {port} 在 PORTOS 工作表中没有 ID。表中有“{similar}”（ID {id}）：如果是同一港口，请修正名称以写入 Sankhya CSV。",
  "tariff.warning.destination_unknown":
    "{sheet}：未知目的港“{code}”，按原样使用。",
  "tariff.warning.road_freight_missing":
    "{sheet}：没有“FRETE (CD)”；总额按 {value} 雷亚尔的陆运计算。",
  "tariff.warning.params_differ":
    "{sheet}：汇率为 {fx} 雷亚尔，与 {first} 工作表（{firstFx} 雷亚尔）不同。每个工作表使用自己的汇率；请确认是否为同一天的汇率。",
  "tariff.warning.sankhya_tab_outdated":
    "表格的 AD_FREINT 工作表与比较表不一致（{n} 行）。请使用此处生成的 CSV。",
  "tariff.warning.sankhya_duplicate_ids":
    "Sankhya CSV 中有 {n} 个 AD_IDEXTERNO 重复（同一船公司、港口和目的港出现两次）。请核对代码（CODPARC）和港口 ID。",
  "tariff.warning.cell_error":
    "{sheet}：单元格 {cell} 有错误（#REF!/#VALUE!），该值已忽略。",
  "tariff.dest.label": "目的港",
  "tariff.table.caption":
    "每个 {type} 集装箱的雷亚尔总成本：美元运费和费用 × 汇率 × (1 + 船公司的 PTAX) × (1 + IOF) + 到配送中心的陆运费 + 雷亚尔费用。绿色为每个港口的最低成本。",
  "tariff.table.origin": "起运港",
  "tariff.table.best": "最低成本",
  "tariff.table.term": "账期 {n} 天",
  "tariff.table.noTerm": "无账期",
  "tariff.table.noRates": "该目的港没有运价。",
  "tariff.route.direct": "直航",
  "tariff.route.long": "中转",
  "tariff.fees.title": "各船公司附加费",
  "tariff.fees.fee": "费用",
  "tariff.fees.total": "附加费合计（表格）",
  "tariff.fees.totalBrl": "每票附加费（雷亚尔）",
  "tariff.fees.perShipment": "每票",
  "tariff.perCbm.title": "每立方米运费",
  "tariff.perCbm.body":
    "{ports} 个港口到 {dest} 的最低成本中位数：每柜 {container} 雷亚尔 ÷ {capacity} 立方米（{type}）= 每立方米 {perCbm} 雷亚尔。",
  "tariff.perCbm.current": "当前设置：{value}。",
  "tariff.perCbm.none": "未设置",
  "tariff.perCbm.apply": "在报价中使用 R$ {perCbm}/m³（{dest}）",
  "tariff.perCbm.applyHint":
    "船公司还没报该产品运费时使用（商品展示和客户报价）。手动应用仅限管理员；所选目的港用于之后的自动更新。",
  "tariff.perCbm.applied": "已在设置中更新每立方米运费。",
  "tariff.perCbm.noCapacity": "请在设置中添加 40HC 柜型以计算每立方米运费。",
  "tariff.history.title": "导入记录",
  "tariff.history.date": "参考日期",
  "tariff.history.file": "文件",
  "tariff.history.by": "导入人",
  "tariff.history.when": "导入时间",
  "tariff.history.rates": "运价",
  "tariff.history.status": "状态",
  "tariff.history.view": "查看",
  "tariff.error.tariff_file_required": "请选择表格。",
  "tariff.error.tariff_too_large": "表格过大（最大 4 MB）。",
  "tariff.error.tariff_xls":
    "旧版 .xls 格式：请在 Excel 中另存为 .xlsx 或 .xlsm。",
  "tariff.error.tariff_invalid": "无法读取文件。请发送 .xlsx 或 .xlsm 表格。",
  "tariff.error.tariff_no_sheets":
    "未找到包含“USD POR 40HQ”行的“COMPARATIVO - NVT/ITJ/IOA”工作表。请使用模板表格。",
  "tariff.error.tariff_fx_missing": "未找到汇率（在港口列表下方的港口列中）。",
  "tariff.error.tariff_empty": "表格中没有填写任何运费。",
  "tariff.error.tariff_date_invalid": "参考日期无效。",
  "tariff.error.tariff_not_found": "未找到运价表。",
  "tariff.error.tariff_no_suggestion":
    "该目的港没有可用于计算每立方米运费的运价。",
  "tariff.error.forbidden": "无权限。只有管理员可以修改设置中的每立方米运费。",
  "tariff.error.schema_outdated":
    "运价表数据表尚未发布到数据库。请发布 Appwrite 架构后重试。",
  "tariff.error.invalid_input": "数据无效。",
  "tariff.order.title": "运价表运费",
  "tariff.order.import": "导入船公司表格",
  "tariff.order.viewAll": "查看完整运价表",
  "tariff.order.none":
    "还没有运价表。每家船公司通过门户上传自己的表；你也可以导入。",
  "tariff.order.from": "截至 {date} 的运价表 · 起运港 {origin}",
  "tariff.order.noLocation": "采购单尚未填写供应商所在地。请在下方选择起运港。",
  "tariff.order.noOrigin":
    "采购单上的供应商所在地（“{location}”）不是运价表中的港口。请在下方选择起运港。",
  "tariff.order.noRates": "现行运价表中没有 {origin} 的运价。",
  "tariff.order.assigned": "本订单的船公司",
  "tariff.order.hint":
    "仅 Wellmix 可见。下面的装运日期、到达、船名和提单都是可选的：确认已装运即可继续。",
  "tariff.order.unavailable": "暂时无法读取运价表，请稍后重新打开。",
  "tariff.order.containers": "{n} × 40HQ",
  "tariff.order.pickOrigin": "起运港",
  "tariff.order.pickSubmit": "查看运费",
  "tariff.error.tariff_encrypted":
    "表格设有打开密码。请在 Excel 中取消打开密码（文件 → 信息 → 保护工作簿）后重新上传。",
  "tariff.table.captionShipment":
    "整批货（{type}）的雷亚尔总成本：美元运费和费用 × 汇率 × (1 + 船公司的 PTAX) × (1 + IOF) + 到配送中心的陆运费 + 雷亚尔费用。绿色为每个港口的最低成本。",
  "tariff.notes.title": "提示（{n}）",
  "tariff.warning.fx_missing":
    "{sheet}：汇率为空或有错误；总额使用 {fx} 雷亚尔（来自其他工作表）。请检查美元单元格。",
  "tariff.warning.containers_differ":
    "{sheet}：估算为 {n} 个柜，而 {first} 工作表为 {firstN} 个。总额为整票运输；订单中按每柜比较各选项。",
  "tariff.warning.destination_fixed_id":
    "{port} 不在 PORTOS 工作表中；Sankhya CSV 使用 ID {id}，与宏相同。",
  "tariff.order.perContainer": "每柜 {value}",
  "nav.myFreightTariff": "我的运价表",
  "tariff.range": "{min} 至 {max}",
  "tariff.mine.title": "我的运价表",
  "tariff.mine.subtitle":
    "把你的运费表发给 Wellmix。只有你和 Wellmix 能看到，其他船公司看不到。",
  "tariff.mine.help.body":
    "使用 Wellmix 的运费估算表（COMPARATIVO - NVT、ITJ、IOA 工作表）填写你的价格：各起运港每个 40HQ 集装箱的运费、直达或长航线、美元和雷亚尔费用、PTAX、IOF 和付款期限。门户会核对表格并显示异常。",
  "tariff.mine.help.steps":
    "在表中填写你的价格。\n在这里上传（新表替换旧表）。\n查看核对结果，如有问题，修改后重新上传。",
  "tariff.mine.importTitle": "上传我的运费表",
  "tariff.mine.importHint":
    "Wellmix 模板的运费估算表（.xlsx 或 .xlsm），填入你的价格。表中所有内容都作为你的价格导入；新表替换旧表。不会执行宏。",
  "tariff.mine.dateHint": "你的报价日期。",
  "tariff.mine.submit": "上传表格",
  "tariff.mine.empty": "你还没有上传运价表。请在上方上传表格。",
  "tariff.mine.imported": "已上传：{rates} 条运价。Wellmix 已收到。",
  "tariff.import.company": "这张表属于",
  "tariff.import.companyPick": "请选择…",
  "tariff.import.consolidated": "多家船公司（汇总表）",
  "tariff.import.companyHint":
    "整张表作为所选船公司的价格导入（文件中的名称无关紧要），只替换该公司的上一张。",
  "tariff.error.tariff_company_required":
    "请选择这张表属于哪家船公司，或选择汇总表。",
  "tariff.error.tariff_company_invalid": "登记中找不到该船公司。",
  "tariff.backToCompare": "← 返回对比",
  "tariff.viewingSource":
    "你正在查看 {source} 的单张表（参考日期 {date}），使用该表自己的汇率。",
  "tariff.compare.consolidated": "汇总表",
  "tariff.compare.viewOne": "只看这张表",
  "tariff.compare.sources": "对比中的运价表",
  "tariff.compare.warnings": "提示",
  "tariff.compare.missing": "还没上传自己运价表的：{names}。",
  "tariff.compare.sourceHeading": "{source} · {date}",
  "tariff.compare.downloadHint":
    "每家船公司、每个港口和目的港一条运价（直达航线；没有时用长航线），每家船公司使用自己表的日期，AD_IDEXTERNO 包含目的港，Sankhya 会保留同一航线的所有目的港。",
  "tariff.stat.updated": "最新的表",
  "tariff.stat.fxCompare": "对比汇率",
  "tariff.stat.fxPortalDetail":
    "当日美元（{date} 的 PTAX）+ Wellmix 表中的点差，所有船公司相同",
  "tariff.stat.fxSheetDetail": "来自表格（门户没有当日美元）",
  "tariff.history.company": "船公司",
  "tariff.warning.ptax_iof_added":
    "各船公司的 PTAX（{ptax}%）和 IOF（{iof}%）计入总额：以美元支付的部分（运费和费用）按 美元 × 汇率 × (1 + PTAX) × (1 + IOF) 计算。表格本身不加这两项，所以这里的总额比表中的高。",
  "tariff.warning.ptax_iof_missing":
    "{sheet}：{forwarder} 在表中没有 {missing}；其总额不含这项加价。",
  "tariff.fees.ptaxIof": "PTAX / IOF",
  "tariff.perCbm.auto":
    "每导入一张表就按目的港 {dest} 自动更新。变化超过 {max}% 时保留原值，等管理员核对。",
  "tariff.perCbm.autoApplied":
    "最近一次自动更新（{date}）：已应用 R$ {perCbm}/m³。",
  "tariff.perCbm.autoHeld":
    "最近一次自动更新（{date}）：R$ {perCbm}/m³ 未应用（原为 {previous}；变化太大）。请核对运价表，确认无误后再应用。",
  "tariff.perCbm.autoSkipped.no_capacity":
    "最近一次自动更新（{date}）：未计算（请在设置中登记 40HC 集装箱）。",
  "tariff.perCbm.autoSkipped.no_rates":
    "最近一次自动更新（{date}）：未计算（该目的港没有运价）。",
  "tariff.perCbm.applyHintOperator":
    "船公司还没报该产品运费时使用（商品展示和客户报价）。只有管理员能手动应用。",
  "tariff.upload.title": "你的运价表",
  "tariff.upload.button": "导入表格",
  "tariff.upload.last": "最近上传：参考日期 {date}，{rates} 条运价。",
  "tariff.upload.none": "你还没有把运价表发给 Wellmix。",
  "tariff.upload.hint":
    "下面的装运日期、到达、船名和提单都是可选的：确认已装运即可继续。",
  "tariff.error.tariff_other_companies":
    "请重新上传表格：整张表会导入所选船公司，文件中的名称无关紧要。",
  "tariff.warning.other_blocks_ignored":
    "只导入了 {kept} 的价格；其他船公司的区块（{ignored}）未导入。",
  "tariff.sheet.fxDetail": "美元 {base} + 点差 {spread}",
  "tariff.sheet.formulaTitle": "按表格自己的公式：{value}",
  "tariff.sheet.formulaShort": "公式：{value}",
  "tariff.sheet.country": "国家",
  "tariff.sheet.usdDirect": "美元 40HQ 直达",
  "tariff.sheet.usdLong": "美元 40HQ 长航线",
  "tariff.sheet.brlDirect": "雷亚尔总额 直达",
  "tariff.sheet.brlLong": "雷亚尔总额 长航线",
  "tariff.sheet.side": "端",
  "tariff.sheet.feesTotals": "费用合计（美元 · 雷亚尔）",
  "tariff.sheet.feesSheet": "雷亚尔费用（表格公式）",
  "tariff.sheet.feesPortal": "含 PTAX 和 IOF 的雷亚尔费用（门户）",
  "tariff.sheet.paramsTitle": "{dest} 工作表参数",
  "tariff.sheet.fx": "汇率（美元 + 点差）",
  "tariff.sheet.road": "陆运费（配送中心），每箱",
  "tariff.sheet.containers": "集装箱数量",
  "tariff.sheet.date": "参考日期",
  "tariff.sheet.ratesTitle": "{dest} 对比（与表格相同）",
  "tariff.sheet.ratesHint":
    "数值与表格中一致，包含所有港口和船公司。雷亚尔总额为表格中的数值（不含 PTAX 和 IOF）；“摘要”显示门户计算的含 PTAX 和 IOF 的总额。",
  "tariff.sheet.legendBestDirect": "最低成本：直达航线",
  "tariff.sheet.legendBestLong": "最低成本：长航线",
  "tariff.sheet.legendWorst": "最高成本：两种航线",
  "tariff.sheet.legendMismatch": "总额与表格公式不符",
  "tariff.sheet.mismatches":
    "表格中有 {n} 个总额与其公式不符（运费 × 汇率 + 到配送中心的陆运费 + 费用）：公式计算的值以黄色显示在下方。",
  "tariff.sheet.feesTitle": "{dest} 费用（与表格相同）",
  "tariff.sheet.codesTitle": "Sankhya 代码（FORNECEDORES 和 PORTOS 工作表）",
  "tariff.sheet.company": "船公司",
  "tariff.sheet.noCode": "无代码",
  "tariff.sheet.port": "港口",
  "tariff.sheet.destination": "目的港",
  "tariff.sheet.noId": "无 ID",
  "tariff.sheet.sankhyaTitle": "Sankhya 文件：{dest} 的 {n} 行",
  "tariff.sheet.sankhyaHint":
    "此目的港写入 AD_FREINT.CSV 的行。AD_IDEXTERNO 包含目的港，Sankhya 会保留同一航线的所有目的港。",
  "tariff.sheet.sankhyaShow": "查看 {n} 行",
  "tariff.sheet.sankhyaNone":
    "没有行：缺少代码（CODPARC）或港口 ID。请查看上方代码。",
  "tariff.view.sheet": "与表格相同",
  "tariff.view.summary": "摘要（含 PTAX 和 IOF）",
  "tariff.compare.viewSheet": "查看表格",
  "tariff.warning.several_blocks":
    "表中有 {n} 个区块（{blocks}），全部作为 {company} 的价格导入。如有不属于该公司的区块，请从表中删除后重新上传。",
  "tariff.mine.goesTo": "此表上传至",
  "tariff.mine.goesToHint": "你的船公司；表中区块的名称无关紧要。",
  "tariff.warning.line_no_code":
    "{company} 没有 Sankhya 代码：Wellmix 的表中没有属于它的区块（请按汇总表中的区块名称登记该船公司）。它的价格不会进入 CSV。",
  "tariff.warning.block_owner_ambiguous":
    "汇总表中的区块 {block} 与多家登记的船公司匹配（{companies}）：它作为汇总表数据保留在比较和 CSV 中，不归属任何一家。请只保留一个使用该名称的有效登记。",
};
