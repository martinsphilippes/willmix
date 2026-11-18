#!/usr/bin/env python3
"""Arquivos fictícios das trilhas da Agência de arte e da Certificadora: a arte da caixa
(duas versões), a arte final com o selo, a arte corrigida, o selo, o memorial descritivo e o
certificado. Nada aqui é documento real: o selo é um desenho de exemplo, sem a marca de
nenhum órgão, e todo arquivo leva o aviso "exemplo para treinamento".

Uso: python3 gerar_arquivos_arte.py     (precisa de Pillow e reportlab)
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from gerar_arquivos import FONTE, FONTE_B, pdf

AQUI = Path(__file__).resolve().parent
VERMELHO = (0.75, 0.13, 0.15)
GRAFITE = (0.09, 0.09, 0.11)


def selo_no_pdf(c: canvas.Canvas, x: float, y: float, lado: float):
    """Desenho do selo de exemplo (o mesmo do PNG), para a arte final."""
    c.saveState()
    c.setStrokeColorRGB(*GRAFITE); c.setFillColorRGB(1, 1, 1); c.setLineWidth(1.4)
    c.roundRect(x, y, lado, lado * 0.72, 2 * mm, stroke=1, fill=1)
    c.setFillColorRGB(*GRAFITE); c.setFont("Helvetica-Bold", lado * 0.105)
    c.drawCentredString(x + lado / 2, y + lado * 0.52, "SELO DE")
    c.drawCentredString(x + lado / 2, y + lado * 0.39, "CERTIFICAÇÃO")
    c.setFont("Helvetica", lado * 0.075)
    c.drawCentredString(x + lado / 2, y + lado * 0.24, "Registro 000115/2026")
    c.drawCentredString(x + lado / 2, y + lado * 0.12, "exemplo · treinamento")
    c.restoreState()


def codigo_de_barras(c: canvas.Canvas, x: float, y: float, largura: float, altura: float, margem: float):
    c.saveState()
    c.setFillColorRGB(1, 1, 1); c.rect(x - margem, y - 3 * mm, largura + 2 * margem, altura + 6 * mm, stroke=0, fill=1)
    c.setFillColorRGB(*GRAFITE)
    passo = largura / 46
    for i, grosso in enumerate([1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1]):
        if grosso:
            c.rect(x + i * passo, y, passo * 0.9, altura, stroke=0, fill=1)
    c.setFont("Helvetica", 6); c.drawCentredString(x + largura / 2, y - 2.4 * mm, "7 890000 011501")
    c.restoreState()


def arte(nome: str, titulo: str, marca_mm: float, *, selo: bool = False, margem_barras: float = 0.0, nota: str = ""):
    """A arte da caixa sobre a faca do fornecedor: quatro faces, abas e a marca na frente."""
    c = canvas.Canvas(str(AQUI / nome), pagesize=landscape(A4))
    w, h = landscape(A4)
    c.setFont("Helvetica-Bold", 14); c.setFillColorRGB(*GRAFITE); c.drawString(15 * mm, h - 15 * mm, titulo)
    c.setFont("Helvetica", 9); c.drawString(15 * mm, h - 21 * mm, "Arte de exemplo para treinamento · caixa 130 × 130 × 260 mm · sobre a faca do fornecedor" + (f" · {nota}" if nota else ""))
    x, y, a, alt, aba = 22 * mm, 42 * mm, 58 * mm, 105 * mm, 26 * mm
    faces = ["FRENTE", "LATERAL", "VERSO", "LATERAL"]
    for i, face in enumerate(faces):
        fx = x + i * a
        c.setFillColorRGB(*(VERMELHO if i % 2 == 0 else (0.96, 0.96, 0.97))); c.setStrokeColorRGB(*GRAFITE); c.setLineWidth(0.8)
        c.rect(fx, y, a, alt, stroke=1, fill=1)
        c.setFillColorRGB(0.99, 0.99, 0.99); c.rect(fx, y + alt, a, aba * (1 if i % 2 == 0 else 0.55), stroke=1, fill=1)
        c.rect(fx, y - aba * (1 if i % 2 else 0.55), a, aba * (1 if i % 2 else 0.55), stroke=1, fill=1)
        c.setFont("Helvetica", 6); c.setFillColorRGB(0.45, 0.45, 0.5); c.drawString(fx + 2 * mm, y + alt + 2 * mm, face)
        if i == 0:  # frente: a marca e o nome do produto
            c.setFillColorRGB(1, 1, 1); c.setFont("Helvetica-Bold", marca_mm * mm * 0.36)
            c.drawCentredString(fx + a / 2, y + alt * 0.66, "Wellmix")
            c.setFont("Helvetica", 9); c.drawCentredString(fx + a / 2, y + alt * 0.30, "Pote de vidro com tampa")
            c.setFont("Helvetica-Bold", 16); c.drawCentredString(fx + a / 2, y + alt * 0.18, "1,5 L")
        elif i == 2:  # verso: texto legal e código de barras
            c.setFillColorRGB(1, 1, 1); c.setFont("Helvetica", 6.5)
            for k, ln in enumerate(["Pote de vidro com tampa · 1,5 L", "Importado por Wellmix", "Não usar no forno. Lavar antes de usar.", "Composição: vidro e polipropileno"]):
                c.drawString(fx + 5 * mm, y + alt * 0.82 - k * 4 * mm, ln)
            codigo_de_barras(c, fx + 13 * mm, y + 12 * mm, 32 * mm, 13 * mm, margem_barras * mm)
        elif i == 1 and selo:
            selo_no_pdf(c, fx + 11 * mm, y + 14 * mm, 36 * mm)
        elif i == 3:
            c.setFillColorRGB(*GRAFITE); c.setFont("Helvetica-Bold", 10); c.drawCentredString(fx + a / 2, y + alt * 0.5, "Wellmix")
    c.setFillColorRGB(0.98, 0.98, 0.98); c.rect(x + 4 * a, y + 6 * mm, 9 * mm, alt - 12 * mm, stroke=1, fill=1)
    c.setFont("Helvetica", 8); c.setFillColorRGB(0.4, 0.4, 0.45)
    c.drawString(15 * mm, 10 * mm, "Dados fictícios. Sem valor comercial ou legal.")
    c.save(); print("pdf", nome)


def selo(nome: str, registro: str):
    L, A = 1200, 860
    img = Image.new("RGB", (L, A), (255, 255, 255)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 40, L - 40, A - 40], radius=46, outline=(23, 24, 28), width=14)
    d.rounded_rectangle([78, 78, L - 78, A - 78], radius=30, outline=(23, 24, 28), width=4)
    f1, f2, f3 = ImageFont.truetype(FONTE_B, 118), ImageFont.truetype(FONTE, 62), ImageFont.truetype(FONTE, 46)
    for texto, fonte, yy in (("SELO DE", f1, 150), ("CERTIFICAÇÃO", f1, 290), (registro, f2, 480), ("Certifica OCP · exemplo", f3, 590), ("Imagem de exemplo · treinamento", f3, 670)):
        larg = d.textlength(texto, font=fonte); d.text(((L - larg) / 2, yy), texto, font=fonte, fill=(23, 24, 28))
    img.save(AQUI / nome); print("imagem", nome)


def main():
    arte("arte-caixa-pote-1500ml.pdf", "Arte da caixa · Glass jar 1.5L with lid (versão 1)", 26)
    arte("arte-caixa-pote-1500ml-v2.pdf", "Arte da caixa · Glass jar 1.5L with lid (versão 2)", 34, nota="marca maior na frente")
    arte("arte-final-com-selo-pote-1500ml.pdf", "Arte final com o selo · Glass jar 1.5L with lid", 34, selo=True, nota="selo na lateral")
    arte("arte-final-com-selo-pote-1500ml-v2.pdf", "Arte final com o selo · Glass jar 1.5L with lid (versão 2)", 34, selo=True,
         nota="selo na lateral, longe do código de barras")
    arte("arte-corrigida-pote-1500ml.pdf", "Arte final corrigida · Glass jar 1.5L with lid", 34, selo=True, margem_barras=4.0,
         nota="margem branca no código de barras")
    selo("selo-de-certificacao-pote-1500ml.png", "Registro 000115/2026")
    selo("selo-de-certificacao-pote-1500ml-v2.png", "Registro 000115/2026 · rev. 1")
    pdf("certificado-de-conformidade-pote-1500ml.pdf", "Certificado de conformidade (exemplo)",
        ["Organismo: Certifica OCP", "Solicitante: Wellmix", "Fabricante: Shenzhen Supplier A", "Produto: Glass jar 1.5L with lid (SZ-JR15)",
         "Número do certificado: CERT-2026-0115", "Emissão: 15/11/2026 · Validade: 15/11/2029", "", "Certificado de exemplo, usado só no treinamento do portal."])
    pdf("memorial-descritivo-pote-1500ml.pdf", "Memorial descritivo (exemplo)",
        ["Produto: Glass jar 1.5L with lid (SZ-JR15)", "Fabricante: Shenzhen Supplier A", "Materiais: vidro sodo-cálcico; tampa de polipropileno preta",
         "Capacidade: 1,5 L · Peso líquido: 0,62 kg · Medidas: 12 × 12 × 25 cm", "Embalagem: caixa individual 130 × 130 × 260 mm; 12 peças por caixa master",
         "Uso: armazenamento de alimentos secos. Não usar no forno.", "", "Documento de exemplo, usado só no treinamento do portal."])
    (AQUI / "arquivo-vazio.pdf").write_bytes(b""); print("vazio arquivo-vazio.pdf")
    # Certificado em Word: o formato que o portal recusa (para a cena "Cuidado" da certificadora).
    import zipfile
    with zipfile.ZipFile(AQUI / "certificado-de-conformidade.docx", "w") as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
        z.writestr("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Certificado de exemplo para treinamento.</w:t></w:r></w:p></w:body></w:document>')
    print("word certificado-de-conformidade.docx")


if __name__ == "__main__":
    main()
