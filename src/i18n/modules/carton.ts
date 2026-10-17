/**
 * Dicionário do módulo "carton" (caixa master, inner e embalagem: atalhos e
 * conferências ao vivo na ficha, no cadastro do produto e no sourcing): mesmas
 * chaves em pt, en e zh.
 */
export const pt = {
  "carton.inner.none": "Sem caixa inner",
  "carton.inner.noneTitle": "As peças vão direto na caixa master",
  "carton.inner.options": "Opções que fecham a caixa master",
  "carton.inner.optionTitle": "{boxes} caixas inner de {inner} na master",
  "carton.inner.isNone": "Sem caixa inner: as peças vão direto na master.",
  "carton.inner.fits":
    "{boxes} caixas inner × {inner} = {master} peças por master.",
  "carton.inner.same": "Igual à master: é o mesmo que sem caixa inner.",
  "carton.inner.bigger":
    "A caixa inner ({inner}) tem mais peças que a master ({master}). Confira.",
  "carton.inner.rest":
    "{master} peças não dividem em caixas inner de {inner} (resto {rest}). Confira.",
  "carton.size.size":
    "Confira as medidas: {size} cm dá {cbm} m³ por caixa. Uma caixa master costuma ter até ~60 cm por lado e até 0,3 m³.",
  "carton.size.side":
    "Confira as medidas: {side} cm num lado é muito para uma caixa master (costuma ter até ~60 cm por lado). Estão em cm?",
  "carton.size.cbm":
    "Confira o CBM: {cbm} m³ por caixa é muito para uma caixa master (costuma ter até 0,3 m³).",
  "carton.size.fit": "Num {type} ({capacity} m³) cabem só ~{n} caixas.",
  "carton.size.fitOne": "Num {type} ({capacity} m³) cabe só 1 caixa.",
  "carton.size.noFit": "Não cabe nem uma caixa num {type} ({capacity} m³).",
  "carton.package.options": "Tipos comuns de embalagem",
  "carton.package.colorLike":
    "“{value}” parece uma cor. Aqui vai o tipo de embalagem (ex.: COLOR BOX); a cor vai em “Cor / sortimento”.",
  "carton.package.colorBox": "Caixa colorida impressa",
  "carton.package.whiteBox": "Caixa branca",
  "carton.package.brownBox": "Caixa parda (kraft)",
  "carton.package.giftBox": "Caixa de presente",
  "carton.package.pvcBox": "Caixa de PVC transparente",
  "carton.package.blister": "Blister (cartela com bolha plástica)",
  "carton.package.oppBag": "Saco OPP (plástico transparente)",
  "carton.package.peBag": "Saco PE (plástico)",
};

export const en: Record<keyof typeof pt, string> = {
  "carton.inner.none": "No inner box",
  "carton.inner.noneTitle": "Pieces go straight into the master carton",
  "carton.inner.options": "Options that fill the master carton",
  "carton.inner.optionTitle": "{boxes} inner boxes of {inner} per master",
  "carton.inner.isNone": "No inner box: pieces go straight into the master.",
  "carton.inner.fits":
    "{boxes} inner boxes × {inner} = {master} pieces per master.",
  "carton.inner.same": "Same as the master: this means no inner box.",
  "carton.inner.bigger":
    "The inner box ({inner}) holds more pieces than the master ({master}). Please check.",
  "carton.inner.rest":
    "{master} pieces do not split into inner boxes of {inner} ({rest} left over). Please check.",
  "carton.size.size":
    "Check the size: {size} cm gives {cbm} m³ per carton. A master carton is usually up to ~60 cm per side and up to 0.3 m³.",
  "carton.size.side":
    "Check the size: {side} cm on one side is a lot for a master carton (usually up to ~60 cm per side). Is it in cm?",
  "carton.size.cbm":
    "Check the CBM: {cbm} m³ per carton is a lot for a master carton (usually up to 0.3 m³).",
  "carton.size.fit": "A {type} ({capacity} m³) holds only ~{n} cartons.",
  "carton.size.fitOne": "A {type} ({capacity} m³) holds only 1 carton.",
  "carton.size.noFit": "Not even one carton fits in a {type} ({capacity} m³).",
  "carton.package.options": "Common package types",
  "carton.package.colorLike":
    "“{value}” looks like a color. This field is the package type (e.g. COLOR BOX); the color goes in “Color / assortment”.",
  "carton.package.colorBox": "Printed color box",
  "carton.package.whiteBox": "White box",
  "carton.package.brownBox": "Brown (kraft) box",
  "carton.package.giftBox": "Gift box",
  "carton.package.pvcBox": "Clear PVC box",
  "carton.package.blister": "Blister (card with plastic bubble)",
  "carton.package.oppBag": "OPP bag (clear plastic)",
  "carton.package.peBag": "PE bag (plastic)",
};

export const zh: Record<keyof typeof pt, string> = {
  "carton.inner.none": "无内盒",
  "carton.inner.noneTitle": "产品直接装入外箱",
  "carton.inner.options": "能装满外箱的选项",
  "carton.inner.optionTitle": "每外箱 {boxes} 个内盒，每盒 {inner} 件",
  "carton.inner.isNone": "无内盒：产品直接装入外箱。",
  "carton.inner.fits": "{boxes} 个内盒 × {inner} = 每外箱 {master} 件。",
  "carton.inner.same": "与外箱相同：即无内盒。",
  "carton.inner.bigger":
    "内盒件数（{inner}）多于外箱件数（{master}），请核对。",
  "carton.inner.rest":
    "{master} 件不能平均分装为每盒 {inner} 件的内盒（余 {rest} 件），请核对。",
  "carton.size.size":
    "请核对尺寸：{size} 厘米，每箱 {cbm} 立方米。外箱通常每边不超过约 60 厘米、不超过 0.3 立方米。",
  "carton.size.side":
    "请核对尺寸：一边 {side} 厘米对外箱来说过大（通常每边不超过约 60 厘米）。单位是厘米吗？",
  "carton.size.cbm":
    "请核对体积：每箱 {cbm} 立方米对外箱来说过大（通常不超过 0.3 立方米）。",
  "carton.size.fit": "一个 {type}（{capacity} 立方米）只能装约 {n} 箱。",
  "carton.size.fitOne": "一个 {type}（{capacity} 立方米）只能装 1 箱。",
  "carton.size.noFit": "一个 {type}（{capacity} 立方米）连一箱都装不下。",
  "carton.package.options": "常用包装类型",
  "carton.package.colorLike":
    "“{value}”看起来是颜色。此处填写包装类型（例如 COLOR BOX）；颜色请填在“颜色 / 搭配”。",
  "carton.package.colorBox": "彩盒",
  "carton.package.whiteBox": "白盒",
  "carton.package.brownBox": "牛皮纸盒",
  "carton.package.giftBox": "礼盒",
  "carton.package.pvcBox": "透明 PVC 盒",
  "carton.package.blister": "吸塑（卡纸加塑料泡壳）",
  "carton.package.oppBag": "OPP 袋（透明塑料）",
  "carton.package.peBag": "PE 袋（塑料）",
};
