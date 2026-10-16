/**
 * Dicionário do módulo "product-spec" (especificação do produto montada com
 * os dados do cadastro): mesmas chaves em pt, en e zh. O texto gravado no
 * cadastro usa o português (é o do catálogo).
 */
export const pt = {
  "productSpec.material": "Material",
  "productSpec.color": "Cor",
  "productSpec.capacity": "Capacidade",
  "productSpec.size": "Medidas do produto",
  "productSpec.sizeOrder": "C × L × A",
  "productSpec.weight": "Peso por unidade",
  "productSpec.net": "líquido",
  "productSpec.gross": "bruto",
  "productSpec.power": "Energia",
  "productSpec.packaging": "Embalagem",
  "productSpec.masterBox": "Caixa master",
  "productSpec.piece": "{n} peça",
  "productSpec.pieces": "{n} peças",
  "productSpec.inner": "{n} por caixa interna",
  "productSpec.hint.auto":
    "Montada com os dados do produto: acompanha o que você preencher até ser editada à mão.",
  "productSpec.hint.manual": "Texto editado à mão.",
  "productSpec.rebuild": "Montar de novo com os dados do produto",
  "productSpec.empty":
    "Preencha material, cor, medidas, peso e caixa: a especificação se monta sozinha.",
};

export const en: Record<keyof typeof pt, string> = {
  "productSpec.material": "Material",
  "productSpec.color": "Color",
  "productSpec.capacity": "Capacity",
  "productSpec.size": "Product size",
  "productSpec.sizeOrder": "L × W × H",
  "productSpec.weight": "Weight per unit",
  "productSpec.net": "net",
  "productSpec.gross": "gross",
  "productSpec.power": "Power",
  "productSpec.packaging": "Packaging",
  "productSpec.masterBox": "Master carton",
  "productSpec.piece": "{n} piece",
  "productSpec.pieces": "{n} pieces",
  "productSpec.inner": "{n} per inner box",
  "productSpec.hint.auto":
    "Built from the product data: it follows what you fill in until you edit it by hand.",
  "productSpec.hint.manual": "Edited by hand.",
  "productSpec.rebuild": "Rebuild from the product data",
  "productSpec.empty":
    "Fill in material, color, size, weight and carton: the specification builds itself.",
};

export const zh: Record<keyof typeof pt, string> = {
  "productSpec.material": "材质",
  "productSpec.color": "颜色",
  "productSpec.capacity": "容量",
  "productSpec.size": "产品尺寸",
  "productSpec.sizeOrder": "长 × 宽 × 高",
  "productSpec.weight": "单件重量",
  "productSpec.net": "净重",
  "productSpec.gross": "毛重",
  "productSpec.power": "电源",
  "productSpec.packaging": "包装",
  "productSpec.masterBox": "外箱",
  "productSpec.piece": "{n} 件",
  "productSpec.pieces": "{n} 件",
  "productSpec.inner": "每内盒 {n} 件",
  "productSpec.hint.auto":
    "根据产品资料自动生成：在您手动修改之前会随填写内容更新。",
  "productSpec.hint.manual": "已手动修改。",
  "productSpec.rebuild": "根据产品资料重新生成",
  "productSpec.empty": "填写材质、颜色、尺寸、重量和外箱后，规格会自动生成。",
};
