"""Pós-processamento do CSV baixado do portal (passos feitos à mão no Excel no vídeo):
abrir CSV -> filtrar coluna `var` (Casos Novos / Julgados / Pendentes / Suspensos)
-> uma aba por categoria em um único .xlsx.

IDs (id_processo, id_orgao...) são lidos como TEXTO para o Excel não converter em
notação científica (ex.: 8,15E+10), problema visível no vídeo.
"""
from __future__ import annotations
import csv
from pathlib import Path
import pandas as pd


def ler_csv(caminho: Path) -> pd.DataFrame:
    for enc in ("utf-8-sig", "latin-1"):
        try:
            amostra = caminho.read_text(encoding=enc)[:4096]
            break
        except UnicodeDecodeError:
            continue
    try:
        sep = csv.Sniffer().sniff(amostra, delimiters=";,\t|").delimiter
    except csv.Error:
        sep = ";"
    return pd.read_csv(caminho, sep=sep, encoding=enc, dtype=str, keep_default_na=False)


def gerar_xlsx(csv_path: Path, xlsx_path: Path, coluna: str = "var") -> dict[str, int]:
    df = ler_csv(csv_path)
    if coluna not in df.columns:
        raise ValueError(f"Coluna '{coluna}' ausente. Colunas: {list(df.columns)}")
    contagem: dict[str, int] = {}
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as w:
        df.to_excel(w, sheet_name="Todos", index=False)
        for valor, parte in df.groupby(coluna, sort=True):
            nome = (str(valor) or "vazio")[:31]
            parte.to_excel(w, sheet_name=nome, index=False)
            contagem[str(valor)] = len(parte)
        for ws in w.book.worksheets:  # evita "########" nas datas: autoajusta largura
            ws.freeze_panes = "A2"
            for col in ws.columns:
                larg = max(len(str(c.value or "")) for c in col[:200])
                ws.column_dimensions[col[0].column_letter].width = min(max(larg + 2, 10), 50)
    return contagem
