"""Tratamento do CSV das Metas Nacionais (o que era feito à mão no Excel no vídeo):
filtrar a unidade judiciária -> separar a coluna `var`
(Casos Novos / Julgados / Pendentes / Suspensos) -> uma aba por categoria.

IDs são lidos como TEXTO para o Excel não converter em notação científica
(ex.: 8,15E+10), problema visível no vídeo.
"""
from __future__ import annotations

import unicodedata
from pathlib import Path

import pandas as pd

COL_UNIDADE = "nome_orgao_julgador"
COL_MUNICIPIO = "nome_municipio"
COL_VAR = "var"


def normalizar(texto: str) -> str:
    """minúsculas e sem acento, para comparar 'Cível' com 'civel'."""
    sem_acento = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def ler_csv(caminho: Path) -> pd.DataFrame:
    return pd.read_csv(caminho, sep=None, engine="python", dtype=str,
                       keep_default_na=False, encoding="utf-8-sig")


def filtrar(df: pd.DataFrame, unidades: list[str], municipios: list[str]) -> pd.DataFrame:
    """Mantém linhas cuja unidade (ou município) CONTÉM algum dos termos informados."""
    for coluna, termos in ((COL_UNIDADE, unidades), (COL_MUNICIPIO, municipios)):
        if not termos:
            continue
        if coluna not in df.columns:
            raise ValueError(f"Coluna '{coluna}' não existe neste arquivo. Colunas: {list(df.columns)}")
        alvo = df[coluna].map(normalizar)
        mascara = pd.Series(False, index=df.index)
        for termo in termos:
            mascara |= alvo.str.contains(normalizar(termo), regex=False)
        df = df[mascara]
    return df


def gerar_xlsx(df: pd.DataFrame, xlsx_path: Path) -> dict[str, int]:
    df = df.copy()
    if "dt_evento" in df.columns:  # vira data de verdade no Excel
        df["dt_evento"] = pd.to_datetime(df["dt_evento"], errors="coerce").dt.date
    contagem: dict[str, int] = {}
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as w:
        df.to_excel(w, sheet_name="Todos", index=False)
        if COL_VAR in df.columns:
            for valor, parte in df.groupby(COL_VAR, sort=True):
                parte.to_excel(w, sheet_name=(str(valor) or "vazio")[:31], index=False)
                contagem[str(valor)] = len(parte)
        for ws in w.book.worksheets:
            ws.freeze_panes = "A2"
            ws.auto_filter.ref = ws.dimensions
            for col in ws.iter_cols(min_row=1, max_row=min(ws.max_row, 200)):
                larg = max(len(str(c.value or "")) for c in col)
                ws.column_dimensions[col[0].column_letter].width = min(max(larg + 2, 10), 50)
    return contagem
