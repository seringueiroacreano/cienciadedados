"""
Análise de tempo de tramitação processual.

Fornece funções para calcular e visualizar o tempo médio de tramitação
por tribunal, classe, grau e órgão julgador.
"""

from __future__ import annotations

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Optional


def calcular_duracao(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adiciona a coluna 'duracao_dias' ao DataFrame.
    Requer colunas 'data_ajuizamento' e 'ultima_atualizacao' em datetime.
    """
    df = df.copy()
    df["duracao_dias"] = (
        df["ultima_atualizacao"] - df["data_ajuizamento"]
    ).dt.days
    df["duracao_dias"] = df["duracao_dias"].clip(lower=0)
    return df


def analise_tempo_tramitacao(
    df: pd.DataFrame,
    agrupar_por: str = "classe_nome",
    percentis: list[float] = [0.25, 0.50, 0.75, 0.90],
    top_n: int = 20,
    plot: bool = True,
) -> pd.DataFrame:
    """
    Calcula estatísticas de tempo de tramitação agrupadas por uma variável.

    Args:
        df          : DataFrame com colunas de data (resultado de coletar_dataframe)
        agrupar_por : Coluna de agrupamento (ex: 'classe_nome', 'orgao_julgador', 'tribunal')
        percentis   : Percentis a calcular
        top_n       : Exibir apenas os N grupos com mais processos
        plot        : Gerar boxplot automaticamente

    Returns:
        DataFrame com estatísticas de duração por grupo
    """
    df = calcular_duracao(df)
    df_valido = df.dropna(subset=["duracao_dias", agrupar_por])

    stats = (
        df_valido.groupby(agrupar_por)["duracao_dias"]
        .agg(
            contagem="count",
            media="mean",
            mediana="median",
            desvio_padrao="std",
            minimo="min",
            maximo="max",
        )
        .reset_index()
    )

    for p in percentis:
        label = f"p{int(p * 100)}"
        stats[label] = (
            df_valido.groupby(agrupar_por)["duracao_dias"]
            .quantile(p)
            .values
        )

    stats = stats.sort_values("contagem", ascending=False).head(top_n)

    if plot:
        _plot_boxplot(df_valido, agrupar_por, stats[agrupar_por].tolist())

    return stats


def _plot_boxplot(df: pd.DataFrame, agrupar_por: str, grupos: list) -> None:
    df_plot = df[df[agrupar_por].isin(grupos)].copy()

    ordem = (
        df_plot.groupby(agrupar_por)["duracao_dias"]
        .median()
        .sort_values()
        .index.tolist()
    )

    fig, ax = plt.subplots(figsize=(12, max(6, len(grupos) * 0.5)))
    sns.boxplot(
        data=df_plot,
        x="duracao_dias",
        y=agrupar_por,
        order=ordem,
        palette="Blues_r",
        showfliers=False,
        ax=ax,
    )
    ax.set_xlabel("Duração (dias)")
    ax.set_ylabel(agrupar_por.replace("_", " ").title())
    ax.set_title(f"Tempo de tramitação por {agrupar_por.replace('_', ' ').title()}")
    plt.tight_layout()
    plt.show()


def evolucao_mensal(df: pd.DataFrame) -> pd.DataFrame:
    """
    Retorna o volume de ajuizamentos por mês/ano.
    Útil para detectar sazonalidade ou crescimento de demanda.
    """
    df = df.copy()
    df = df.dropna(subset=["data_ajuizamento"])
    df["ano_mes"] = df["data_ajuizamento"].dt.to_period("M")
    return (
        df.groupby("ano_mes")
        .size()
        .reset_index(name="total_processos")
        .sort_values("ano_mes")
    )
