"""
Processamento de Linguagem Natural sobre textos de movimentações processuais.

Funcionalidades:
- Tokenização e limpeza de textos jurídicos
- Extração de features TF-IDF para clustering/classificação
- Identificação de tipos de decisão (procedente, improcedente, etc.)
"""

from __future__ import annotations

import re
from typing import Optional

import pandas as pd
import numpy as np


# ---------------------------------------------------------------------------
# Listas de referência para classificação de movimentos
# ---------------------------------------------------------------------------

PALAVRAS_PROCEDENTE = [
    "procedente", "procedência", "deferido", "deferimento",
    "provido", "provimento", "acolhido", "procedência total",
]

PALAVRAS_IMPROCEDENTE = [
    "improcedente", "improcedência", "indeferido", "indeferimento",
    "improvido", "desprovido", "não provido", "negado provimento",
]

PALAVRAS_EXTINCAO = [
    "extinção", "extinto", "homologação de desistência", "desistência",
    "acordo", "conciliação", "perempção", "prescrição", "decadência",
]

STOPWORDS_JURIDICAS = {
    "processo", "autos", "fls", "mm", "juiz", "juíza", "vara",
    "comarca", "art", "lei", "código", "parágrafo", "inciso",
    "nos", "às", "ao", "da", "de", "do", "em", "na", "no",
    "por", "para", "com", "que", "se", "um", "uma", "os", "as",
}


# ---------------------------------------------------------------------------
# Pré-processamento
# ---------------------------------------------------------------------------

def limpar_texto(texto: str) -> str:
    """Limpa e normaliza um texto jurídico."""
    if not isinstance(texto, str):
        return ""
    texto = texto.lower()
    texto = re.sub(r"\d+", " ", texto)
    texto = re.sub(r"[^\w\sáéíóúãõâêîôûàèìòùç]", " ", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto


def tokenizar(texto: str, remover_stopwords: bool = True) -> list[str]:
    """Tokeniza e remove stopwords de um texto jurídico."""
    tokens = limpar_texto(texto).split()
    if remover_stopwords:
        tokens = [t for t in tokens if t not in STOPWORDS_JURIDICAS and len(t) > 2]
    return tokens


def tokenizar_movimentos(df: pd.DataFrame, coluna: str = "mov_nome") -> pd.DataFrame:
    """
    Aplica tokenização à coluna de texto de movimentos.

    Args:
        df     : DataFrame com coluna de texto
        coluna : Nome da coluna a tokenizar

    Returns:
        DataFrame com nova coluna 'tokens'
    """
    df = df.copy()
    df["texto_limpo"] = df[coluna].apply(limpar_texto)
    df["tokens"] = df["texto_limpo"].apply(tokenizar)
    return df


# ---------------------------------------------------------------------------
# Classificação de resultado
# ---------------------------------------------------------------------------

def classificar_resultado(texto: str) -> str:
    """
    Classifica uma movimentação em: PROCEDENTE, IMPROCEDENTE, EXTINTO ou OUTROS.
    Baseado em palavras-chave do texto.
    """
    if not isinstance(texto, str):
        return "OUTROS"
    t = texto.lower()

    if any(p in t for p in PALAVRAS_PROCEDENTE):
        return "PROCEDENTE"
    if any(p in t for p in PALAVRAS_IMPROCEDENTE):
        return "IMPROCEDENTE"
    if any(p in t for p in PALAVRAS_EXTINCAO):
        return "EXTINTO"
    return "OUTROS"


def extrair_resultado_processos(df_movimentos: pd.DataFrame) -> pd.DataFrame:
    """
    A partir do DataFrame de movimentos, identifica o resultado final
    de cada processo (última movimentação classificável).

    Args:
        df_movimentos : DataFrame de movimentos (resultado de coletar_movimentos_dataframe)

    Returns:
        DataFrame com colunas: numero_processo, resultado, mov_data_final
    """
    df = df_movimentos.copy()
    df["resultado"] = df["mov_nome"].apply(classificar_resultado)
    df = df[df["resultado"] != "OUTROS"]

    if df.empty:
        return pd.DataFrame(columns=["numero_processo", "resultado", "mov_data_final"])

    idx_ultimo = df.groupby("numero_processo")["mov_data"].idxmax()
    resultado_final = df.loc[idx_ultimo, ["numero_processo", "resultado", "mov_data"]].copy()
    resultado_final = resultado_final.rename(columns={"mov_data": "mov_data_final"})
    return resultado_final.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Features TF-IDF para ML/clustering
# ---------------------------------------------------------------------------

def extrair_features_nlp(
    df: pd.DataFrame,
    coluna_texto: str = "mov_nome",
    max_features: int = 500,
    agrupar_por_processo: bool = True,
) -> tuple:
    """
    Extrai features TF-IDF do texto de movimentações.

    Args:
        df                   : DataFrame de movimentos
        coluna_texto         : Coluna com o texto
        max_features         : Número máximo de features
        agrupar_por_processo : Se True, concatena todos os movimentos de cada processo

    Returns:
        Tupla (matriz_tfidf, vetorizador, df_agrupado)
    """
    from sklearn.feature_extraction.text import TfidfVectorizer

    if agrupar_por_processo and "numero_processo" in df.columns:
        df_agg = (
            df.groupby("numero_processo")[coluna_texto]
            .apply(lambda x: " ".join(x.dropna().astype(str)))
            .reset_index()
        )
        textos = df_agg[coluna_texto].apply(limpar_texto).tolist()
    else:
        df_agg = df.copy()
        textos = df[coluna_texto].apply(limpar_texto).tolist()

    vetorizador = TfidfVectorizer(
        max_features=max_features,
        min_df=2,
        ngram_range=(1, 2),
        sublinear_tf=True,
    )
    matriz = vetorizador.fit_transform(textos)
    return matriz, vetorizador, df_agg
