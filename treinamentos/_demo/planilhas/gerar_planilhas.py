#!/usr/bin/env python3
"""Planilhas de book 100% fictícias para o treinamento (modelo de colunas do portal).

Empresas das contas de demonstração do modo memória; produtos, preços e medidas inventados.
Uso: _pipeline/.venv-stt/bin/python _demo/planilhas/gerar_planilhas.py
"""
from pathlib import Path
from openpyxl import Workbook

AQUI = Path(__file__).resolve().parent
CABECALHO = ["DATE", "LOCAL", "SUPPLIER NAME", "SKU/FACTORY ITEM CODE", "DESCRIPTION", "FOB/EXW",
             "CONI US $/RMB", "PRICE", "QTY/BOX", "QTY/INNER", "N.W./PC", "G.W./PC", "CBM",
             "SIZE(CM) LENGTH", "SIZE(CM) WIDTH", "SIZE(CM) HEIGHT", "CAPACITY(ML)", "PACKAGE",
             "MATERIAL", "MOQ", "PURCHASE QTY IN PCS"]

BOOKS = {
    "book-shenzhen-supplier-a.xlsx": [
        ["2026.11.10", "Shenzhen", "Shenzhen Supplier A", "SZ-JR15", "Glass jar 1.5L with lid", "FOB", "USD",
         2.10, 12, 6, 0.62, 0.70, 0.069, 12, 12, 25, 1500, "color box", "glass", 1200, 2400],
        ["2026.11.10", "Shenzhen", "Shenzhen Supplier A", "SZ-CP35", "Glass cup 350ml", "FOB", "USD",
         1.25, 48, 12, 0.30, 0.35, 0.12, 8, 8, 12, 350, "color box", "glass", 1000, 3000],
        ["2026.11.10", "Shenzhen", "Shenzhen Supplier A", "SZ-BW50", "Glass bowl 500ml", "FOB", "USD",
         0.95, 36, 6, 0.28, 0.33, 0.085, 14, 14, 7, 500, "brown box", "glass", 1500, 3600],
    ],
    # O que o fornecedor A envia quando é convidado a cotar o copo com alça.
    "book-convite-copo-com-alca.xlsx": [
        ["2026.11.14", "Shenzhen", "Shenzhen Supplier A", "SZ-CP30H", "Glass cup 300ml with handle", "FOB", "USD",
         1.32, 48, 12, 0.31, 0.36, 0.125, 9, 8, 11, 300, "color box", "glass", 1000, 2880],
    ],
    "book-guangzhou-supplier-b.xlsx": [
        ["2026.11.08", "Guangzhou", "Guangzhou Supplier B", "GZ-J150", "Glass jar 1.5L with bamboo lid", "FOB",
         "USD", 2.35, 12, 6, 0.65, 0.74, 0.072, 12, 12, 26, 1500, "color box", "glass", 1000, 2400],
        ["2026.11.08", "Guangzhou", "Guangzhou Supplier B", "GZ-C300", "Glass cup 300ml with handle", "FOB",
         "USD", 1.40, 48, 12, 0.32, 0.37, 0.13, 9, 8, 11, 300, "color box", "glass", 1000, 2880],
    ],
}

# Planilha FORA do modelo (sem o cabeçalho esperado): serve para mostrar o erro mais comum.
wb = Workbook()
ws = wb.active
ws.title = "Lista"
ws.append(["Produto", "Valor", "Obs"])
ws.append(["Copo com alça 300 ml", "1,32", "caixa colorida"])
wb.save(AQUI / "planilha-fora-do-modelo.xlsx")

for nome, linhas in BOOKS.items():
    wb = Workbook()
    ws = wb.active
    ws.title = "BOOKING"
    ws.append(CABECALHO)
    for linha in linhas:
        ws.append(linha)
    wb.save(AQUI / nome)
    print(nome, len(linhas), "itens")
