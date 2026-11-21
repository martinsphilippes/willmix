#!/usr/bin/env python3
"""Arquivos fictícios que o fornecedor envia nos vídeos de treinamento: fotos desenhadas,
vídeos curtos e PDFs de exemplo. Nada aqui é de produto, pessoa ou empresa real; toda
imagem leva a legenda "Imagem de exemplo · treinamento".

Uso: python3 gerar_arquivos.py     (precisa de Pillow, reportlab e ffmpeg)
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

AQUI = Path(__file__).resolve().parent
FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTE_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
L, A = 1600, 1200


def fonte(tam: int, negrito: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONTE_B if negrito else FONTE, tam)


def fundo(cor_cima=(236, 238, 242), cor_baixo=(206, 210, 218)) -> Image.Image:
    img = Image.new("RGB", (L, A))
    d = ImageDraw.Draw(img)
    for y in range(A):
        t = y / A
        d.line([(0, y), (L, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(cor_cima, cor_baixo)))
    d.rectangle([0, int(A * 0.78), L, A], fill=(188, 192, 200))  # bancada
    return img


def legenda(img: Image.Image, titulo: str) -> Image.Image:
    d = ImageDraw.Draw(img)
    d.rectangle([0, A - 70, L, A], fill=(23, 24, 28))
    d.text((30, A - 54), titulo, font=fonte(30, True), fill=(255, 255, 255))
    txt = "Imagem de exemplo · treinamento"
    w = d.textlength(txt, font=fonte(26))
    d.text((L - w - 30, A - 52), txt, font=fonte(26), fill=(200, 203, 210))
    return img


def sombra(img: Image.Image, caixa, raio=40):
    s = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(s).ellipse(caixa, fill=(0, 0, 0, 70))
    img.paste(s.filter(ImageFilter.GaussianBlur(raio)), (0, 0), s.filter(ImageFilter.GaussianBlur(raio)))


def pote(img: Image.Image, cx: int, base: int, escala: float = 1.0, tampa=(28, 28, 32)):
    """Pote de vidro com tampa (desenho simples)."""
    d = ImageDraw.Draw(img, "RGBA")
    w, h = int(300 * escala), int(520 * escala)
    sombra(img, [cx - w // 2 - 30, base - 30, cx + w // 2 + 30, base + 30])
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([cx - w // 2, base - h, cx + w // 2, base], radius=int(46 * escala),
                        fill=(214, 232, 240, 150), outline=(120, 150, 165, 255), width=5)
    d.rounded_rectangle([cx - w // 2 + 26, base - h + 40, cx - w // 2 + 60, base - 50], radius=14, fill=(255, 255, 255, 120))
    tw, th = int(w * 0.92), int(86 * escala)
    d.rounded_rectangle([cx - tw // 2, base - h - th + 18, cx + tw // 2, base - h + 18], radius=18, fill=tampa + (255,))
    d.rounded_rectangle([cx - 46, base - h - th - 16, cx + 46, base - h - th + 22], radius=16, fill=tampa + (255,))


def copo(img: Image.Image, cx: int, base: int, escala: float = 1.0):
    d = ImageDraw.Draw(img, "RGBA")
    w, h = int(230 * escala), int(330 * escala)
    sombra(img, [cx - w // 2 - 20, base - 24, cx + w // 2 + 20, base + 24])
    d = ImageDraw.Draw(img, "RGBA")
    d.polygon([(cx - w // 2, base - h), (cx + w // 2, base - h), (cx + int(w * 0.40), base), (cx - int(w * 0.40), base)],
              fill=(214, 232, 240, 150), outline=(120, 150, 165, 255))
    d.line([(cx - w // 2, base - h), (cx + w // 2, base - h)], fill=(120, 150, 165, 255), width=6)


def caixa_papelao(img: Image.Image, cx: int, base: int, w=520, h=420, texto="WELLMIX"):
    d = ImageDraw.Draw(img, "RGBA")
    sombra(img, [cx - w // 2 - 30, base - 26, cx + w // 2 + 30, base + 26])
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([cx - w // 2, base - h, cx + w // 2, base], fill=(191, 32, 38, 255), outline=(140, 20, 26, 255), width=4)
    d.rectangle([cx - w // 2, base - h, cx + w // 2, base - h + 70], fill=(155, 24, 29, 255))
    tw = d.textlength(texto, font=fonte(64, True))
    d.text((cx - tw / 2, base - h // 2 - 20), texto, font=fonte(64, True), fill=(255, 255, 255, 255))
    d.text((cx - w // 2 + 24, base - 60), "Glass jar 1.5L · 12 pcs", font=fonte(26), fill=(255, 235, 235, 255))


def balanca(img: Image.Image, cx: int, base: int, leitura="0,62 kg"):
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([cx - 330, base - 60, cx + 330, base + 40], radius=24, fill=(70, 74, 84, 255))
    d.rounded_rectangle([cx - 290, base - 84, cx + 290, base - 56], radius=10, fill=(150, 154, 164, 255))
    d.rounded_rectangle([cx - 120, base - 30, cx + 120, base + 26], radius=10, fill=(190, 230, 200, 255))
    tw = d.textlength(leitura, font=fonte(40, True))
    d.text((cx - tw / 2, base - 26), leitura, font=fonte(40, True), fill=(20, 60, 30, 255))


def container(img: Image.Image, aberto=True, carga=0, lacre=False, numero="WMXU 482913 5"):
    d = ImageDraw.Draw(img, "RGBA")
    x0, y0, x1, y1 = 230, 250, 1370, 930
    d.rectangle([x0, y0, x1, y1], fill=(34, 86, 132, 255), outline=(20, 52, 84, 255), width=8)
    if aberto:
        d.rectangle([x0 + 40, y0 + 40, x1 - 40, y1 - 20], fill=(52, 46, 40, 255))  # interior
        for i in range(8):
            x = x0 + 40 + i * (x1 - x0 - 80) // 8
            d.line([(x, y0 + 40), (x, y1 - 20)], fill=(70, 62, 54, 255), width=3)
        cols, lin = 6, 4
        cw, ch = (x1 - x0 - 120) // cols, 120
        n = 0
        for r in range(lin):
            for c in range(cols):
                if n >= carga:
                    break
                bx, by = x0 + 60 + c * cw, y1 - 30 - (r + 1) * ch
                d.rectangle([bx, by, bx + cw - 10, by + ch - 8], fill=(191, 32, 38, 255), outline=(140, 20, 26, 255), width=3)
                n += 1
    else:
        for i in range(1, 12):
            x = x0 + i * (x1 - x0) // 12
            d.line([(x, y0 + 10), (x, y1 - 10)], fill=(26, 68, 108, 255), width=6)
        d.line([((x0 + x1) // 2, y0), ((x0 + x1) // 2, y1)], fill=(20, 52, 84, 255), width=10)
        for dx in (-70, 70):
            d.rectangle([(x0 + x1) // 2 + dx - 8, y0 + 60, (x0 + x1) // 2 + dx + 8, y1 - 60], fill=(180, 186, 196, 255))
        d.text((x0 + 60, y0 + 40), numero, font=fonte(44, True), fill=(255, 255, 255, 255))
        if lacre:
            cx, cy = (x0 + x1) // 2 + 70, (y0 + y1) // 2 + 40
            d.rounded_rectangle([cx - 46, cy - 30, cx + 46, cy + 30], radius=12, fill=(240, 196, 32, 255), outline=(120, 96, 10, 255), width=4)
            d.text((cx - 38, cy - 16), "LACRE", font=fonte(22, True), fill=(60, 48, 6, 255))
            d.text((x0 + 60, y1 - 100), "Lacre nº SL-0098431", font=fonte(36, True), fill=(255, 255, 255, 255))


def salvar(img: Image.Image, nome: str, titulo: str):
    legenda(img, titulo).save(AQUI / nome, quality=88)
    print("imagem", nome)


def video(nome: str, imagem: str, segundos: int = 4):
    """Vídeo curto: a mesma imagem com um zoom lento (H.264, sem áudio)."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", str(AQUI / imagem), "-t", str(segundos),
                    "-vf", f"scale=1280:960,zoompan=z='min(1+0.0015*on,1.12)':d={segundos * 25}:s=1280x960:fps=25",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(AQUI / nome)], check=True)
    print("vídeo", nome)


def pdf(nome: str, titulo: str, linhas: list[str], tabela: list[list[str]] | None = None, carimbo: str | None = None):
    c = canvas.Canvas(str(AQUI / nome), pagesize=A4)
    w, h = A4
    c.setFillColorRGB(0.75, 0.13, 0.15); c.rect(0, h - 28 * mm, w, 28 * mm, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1); c.setFont("Helvetica-Bold", 17); c.drawString(18 * mm, h - 17 * mm, titulo)
    c.setFont("Helvetica", 9); c.drawRightString(w - 18 * mm, h - 17 * mm, "Documento de exemplo para treinamento")
    c.setFillColorRGB(0.1, 0.1, 0.12); c.setFont("Helvetica", 11)
    y = h - 42 * mm
    for ln in linhas:
        c.drawString(18 * mm, y, ln); y -= 6.5 * mm
    if tabela:
        y -= 4 * mm
        larg = (w - 36 * mm) / len(tabela[0])
        for i, linha in enumerate(tabela):
            c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 10)
            for j, cel in enumerate(linha):
                c.drawString(18 * mm + j * larg, y, cel)
            c.line(18 * mm, y - 2 * mm, w - 18 * mm, y - 2 * mm); y -= 8 * mm
    if carimbo:
        c.saveState(); c.translate(w - 75 * mm, 55 * mm); c.rotate(12)
        c.setStrokeColorRGB(0.1, 0.25, 0.6); c.setFillColorRGB(0.1, 0.25, 0.6); c.setLineWidth(2)
        c.roundRect(0, 0, 58 * mm, 24 * mm, 4 * mm, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 11); c.drawCentredString(29 * mm, 14 * mm, carimbo)
        c.setFont("Helvetica", 8); c.drawCentredString(29 * mm, 7 * mm, "assinado e carimbado (exemplo)")
        c.restoreState()
        c.setFont("Helvetica-Oblique", 16); c.setFillColorRGB(0.1, 0.2, 0.5); c.drawString(22 * mm, 50 * mm, "Li Wei")
        c.setFillColorRGB(0.1, 0.1, 0.12); c.line(18 * mm, 47 * mm, 80 * mm, 47 * mm)
        c.setFont("Helvetica", 9); c.drawString(18 * mm, 42 * mm, "Li Wei · Shenzhen Supplier A")
    c.setFont("Helvetica", 8); c.setFillColorRGB(0.4, 0.4, 0.45)
    c.drawString(18 * mm, 14 * mm, "Dados fictícios. Sem valor comercial ou legal.")
    c.save(); print("pdf", nome)


def main():
    # Amostragem (Módulo 3): amostra feita em impressora 3D
    im = fundo(); pote(im, 800, 930, 1.25, tampa=(120, 124, 132)); salvar(im, "amostra-3d-frente.jpg", "Amostra 3D · pote 1,5 L · frente")
    im = fundo(); pote(im, 560, 930, 0.9, tampa=(120, 124, 132)); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([900, 760, 1250, 850], radius=22, fill=(28, 28, 32, 255)); d.rounded_rectangle([1030, 720, 1120, 770], radius=16, fill=(28, 28, 32, 255))
    salvar(im, "amostra-3d-tampa.jpg", "Amostra 3D · tampa preta e encaixe")
    video("amostra-3d-video.mp4", "amostra-3d-frente.jpg")
    im = fundo(); copo(im, 800, 930, 1.5); salvar(im, "amostra-copo-frente.jpg", "Amostra 3D · copo 350 ml · frente")
    im = fundo(); copo(im, 800, 930, 2.1); salvar(im, "amostra-copo-borda.jpg", "Amostra 3D · copo 350 ml · borda")
    im = fundo(); copo(im, 800, 760, 1.8); salvar(im, "amostra-copo-fundo.jpg", "Amostra 3D · copo 350 ml · fundo")
    # Conversa (Módulo 2)
    im = fundo(); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([450, 520, 1150, 760], radius=60, fill=(28, 28, 32, 255)); d.rounded_rectangle([700, 420, 900, 540], radius=40, fill=(28, 28, 32, 255))
    salvar(im, "tampa-preta-referencia.jpg", "Referência · tampa na cor preta")
    # Die Cut (Módulo 4)
    im = fundo(); pote(im, 800, 930, 1.3); salvar(im, "foto-alta-pote-1500ml.jpg", "Foto em alta · Glass jar 1.5L with lid")
    c = canvas.Canvas(str(AQUI / "faca-caixa-pote-1500ml.pdf"), pagesize=A4); w, h = A4
    c.setFont("Helvetica-Bold", 14); c.drawString(18 * mm, h - 20 * mm, "Die cut (faca) · caixa do Glass jar 1.5L with lid")
    c.setFont("Helvetica", 9); c.drawString(18 * mm, h - 26 * mm, "Desenho de exemplo para treinamento · medidas em mm · 130 × 130 × 260")
    c.setLineWidth(1.2); x, y, a, b, alt = 30 * mm, 60 * mm, 36 * mm, 36 * mm, 110 * mm
    for i in range(4):
        c.rect(x + i * a, y, a, alt)
        c.setDash(4, 3); c.line(x + i * a, y, x + i * a, y + alt); c.setDash()
        c.rect(x + i * a, y + alt, a, b * (0.9 if i % 2 == 0 else 0.5)); c.rect(x + i * a, y - b * (0.9 if i % 2 else 0.5), a, b * (0.9 if i % 2 else 0.5))
    c.rect(x + 4 * a, y + 6 * mm, 10 * mm, alt - 12 * mm)
    c.setFont("Helvetica", 8); c.drawString(18 * mm, 14 * mm, "Dados fictícios. Sem valor comercial ou legal."); c.save(); print("pdf faca-caixa-pote-1500ml.pdf")
    # Contrato assinado (Módulo 4)
    pdf("contrato-assinado-e-carimbado.pdf", "Contrato do pedido de compra · via assinada",
        ["Fornecedor: Shenzhen Supplier A", "Produto: Glass jar 1.5L with lid (SZ-JR15)", "Quantidade: 2.400 peças · Preço: USD 2,18 por peça · FOB",
         "Pedido mínimo: 1.200 peças · Prazo de produção: 35 dias", "", "Esta é a via impressa, assinada e carimbada pelo fornecedor."],
        carimbo="SHENZHEN SUPPLIER A")
    # Inspeção (Módulo 5)
    im = fundo(); pote(im, 800, 930, 1.25); salvar(im, "inspecao-sem-embalagem.jpg", "Inspeção · produto sem embalagem")
    im = fundo(); caixa_papelao(im, 800, 930); salvar(im, "inspecao-com-embalagem.jpg", "Inspeção · produto com embalagem")
    im = fundo(); balanca(im, 800, 900); pote(im, 800, 816, 0.95); salvar(im, "inspecao-na-balanca.jpg", "Inspeção · produto na balança")
    video("producao-video.mp4", "inspecao-sem-embalagem.jpg", 5)
    im = fundo(); pote(im, 800, 930, 1.25); d = ImageDraw.Draw(im, "RGBA"); d.ellipse([650, 330, 950, 480], outline=(191, 32, 38, 255), width=8)
    salvar(im, "inspecao-tampa-corrigida.jpg", "Inspeção · tampa corrigida")
    # Amostras do pedido (Módulo 6)
    for nome, titulo, linhas in (
        ("amostras-envio-brasil.pdf", "Comprovante de envio · amostras ao show room (Brasil)",
         ["Remetente: Shenzhen Supplier A", "Destino: show room Wellmix · Brasil", "Conteúdo: 12 peças de amostra · Glass jar 1.5L with lid", "Rastreio / AWB: 784-5521 9034"]),
        ("amostras-envio-china.pdf", "Comprovante de envio · amostras à agência (China)",
         ["Remetente: Shenzhen Supplier A", "Destino: agência de marketing · China", "Conteúdo: 3 peças de amostra · Glass jar 1.5L with lid", "Rastreio: SF 1029 3847 5566"])):
        pdf(nome, titulo, linhas)
    # Container na origem (Módulo 6)
    im = fundo((226, 232, 238), (190, 198, 206)); container(im, aberto=True, carga=0); salvar(im, "container-vazio.jpg", "Container vazio no depósito da fábrica")
    video("container-vazio-video.mp4", "container-vazio.jpg")
    im = fundo((226, 232, 238), (190, 198, 206)); container(im, aberto=True, carga=20); salvar(im, "container-carregamento.jpg", "Carregamento do container")
    im = fundo((226, 232, 238), (190, 198, 206)); container(im, aberto=False, lacre=True); salvar(im, "container-lacre.jpg", "Container lacrado · número e lacre")
    # Documentos de carga (Módulo 7)
    itens = [["Item", "Caixas", "Peças", "Peso líq. (kg)", "Peso bruto (kg)"], ["SZ-JR15 Glass jar 1.5L with lid", "200", "2.400", "1.488,00", "1.680,00"]]
    pdf("packing-list-PL-2026-0115.pdf", "Packing list PL-2026-0115", ["Fornecedor: Shenzhen Supplier A", "Container: WMXU 482913 5 · Lacre: SL-0098431"], itens)
    pdf("invoice-INV-2026-0115.pdf", "Commercial invoice INV-2026-0115", ["Fornecedor: Shenzhen Supplier A", "Comprador: Wellmix", "Condição: FOB Shenzhen"],
        [["Item", "Caixas", "Peças", "Preço (USD)", "Total (USD)"], ["SZ-JR15 Glass jar 1.5L with lid", "200", "2.400", "2,18", "5.232,00"]])
    # Certificações (avançado)
    pdf("recibo-transporte-na-origem.pdf", "Recibo · transporte na origem (fábrica ao porto)",
        ["Transportadora: Shenzhen Port Trucking", "Trajeto: fábrica (Shenzhen) ao porto de Yantian", "Pedido Wellmix: #1 · 60 caixas", "Valor: USD 380,00"])
    pdf("certificado-iso-9001.pdf", "Certificado ISO 9001 (exemplo)", ["Empresa: Shenzhen Supplier A", "Escopo: fabricação de utensílios de vidro", "Número: QMS-2026-04471", "Validade: 30/06/2028"])


if __name__ == "__main__":
    main()
