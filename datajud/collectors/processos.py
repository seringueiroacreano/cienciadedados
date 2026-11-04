"""
Coleta dados da API Datajud e retorna DataFrames prontos para análise.
"""

from __future__ import annotations

from typing import Optional
import pandas as pd
from tqdm import tqdm

from ..client import DatajudClient
from ..models import Processo


def coletar_dataframe(
    tribunal: str,
    *,
    classe_codigo: Optional[int] = None,
    assunto_codigo: Optional[int] = None,
    grau: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    max_docs: int = 1000,
    client: Optional[DatajudClient] = None,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Coleta processos e retorna um DataFrame com as colunas principais.

    Colunas retornadas:
        id, numero_processo, tribunal, grau, classe_codigo, classe_nome,
        assunto_principal_codigo, assunto_principal_nome,
        orgao_julgador, data_ajuizamento, ultima_atualizacao,
        total_movimentos, situacao

    Exemplo:
        df = coletar_dataframe("tjsp", classe_codigo=436, max_docs=500)
    """
    if client is None:
        client = DatajudClient()

    registros = []
    iterador = client.buscar_todos(
        tribunal,
        classe_codigo=classe_codigo,
        assunto_codigo=assunto_codigo,
        grau=grau,
        data_inicio=data_inicio,
        data_fim=data_fim,
        max_docs=max_docs,
    )

    if verbose:
        iterador = tqdm(iterador, total=max_docs, desc=f"Coletando {tribunal.upper()}")

    for p in iterador:
        assunto_cod = assunto_nom = None
        if p.assuntos:
            assunto_cod = p.assuntos[0].get("codigo")
            assunto_nom = p.assuntos[0].get("nome")

        registros.append({
            "id": p.id,
            "numero_processo": p.numero_processo,
            "tribunal": p.tribunal or tribunal.upper(),
            "grau": p.grau,
            "classe_codigo": p.classe.get("codigo") if p.classe else None,
            "classe_nome": p.classe_nome,
            "assunto_principal_codigo": assunto_cod,
            "assunto_principal_nome": assunto_nom,
            "orgao_julgador": p.orgao_julgador_nome,
            "data_ajuizamento": p.data_ajuizamento,
            "ultima_atualizacao": p.ultima_atualizacao,
            "total_movimentos": len(p.movimentos),
            "situacao": p.situacao,
        })

    df = pd.DataFrame(registros)

    # Converter datas
    for col in ["data_ajuizamento", "ultima_atualizacao"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    return df


def coletar_movimentos_dataframe(
    tribunal: str,
    *,
    classe_codigo: Optional[int] = None,
    assunto_codigo: Optional[int] = None,
    grau: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    max_docs: int = 500,
    client: Optional[DatajudClient] = None,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Coleta movimentos processuais e retorna um DataFrame com uma linha por
    movimentação (formato longo — útil para NLP e análise temporal).

    Colunas retornadas:
        numero_processo, tribunal, grau, classe_nome,
        mov_codigo, mov_nome, mov_data, mov_complemento
    """
    if client is None:
        client = DatajudClient()

    registros = []
    iterador = client.buscar_todos(
        tribunal,
        classe_codigo=classe_codigo,
        assunto_codigo=assunto_codigo,
        grau=grau,
        data_inicio=data_inicio,
        data_fim=data_fim,
        max_docs=max_docs,
    )

    if verbose:
        iterador = tqdm(iterador, total=max_docs, desc=f"Coletando movimentos {tribunal.upper()}")

    for p in iterador:
        for m in p.movimentos:
            registros.append({
                "numero_processo": p.numero_processo,
                "tribunal": p.tribunal or tribunal.upper(),
                "grau": p.grau,
                "classe_nome": p.classe_nome,
                "mov_codigo": m.codigo,
                "mov_nome": m.nome,
                "mov_data": m.data_hora,
                "mov_complemento": m.complemento,
            })

    df = pd.DataFrame(registros)
    if "mov_data" in df.columns:
        df["mov_data"] = pd.to_datetime(df["mov_data"], errors="coerce", utc=True)

    return df
