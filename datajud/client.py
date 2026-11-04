"""
Cliente para a API Pública do Datajud (CNJ).

A API é baseada em Elasticsearch. Cada tribunal tem seu próprio índice:
  https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search

Tribunais disponíveis:
  Estaduais : tjac, tjal, tjam, tjap, tjba, tjce, tjdft, tjes, tjgo,
              tjma, tjmg, tjms, tjmt, tjpa, tjpb, tjpe, tjpi, tjpr,
              tjrj, tjrn, tjro, tjrr, tjrs, tjsc, tjse, tjsp, tjto
  Federais  : trf1, trf2, trf3, trf4, trf5, trf6
  Trabalho  : trt1 … trt24
  Superiores: tst, stj, stf
  Especiais : tjmmg, tjmrs, tjmsp
"""

import os
import time
from typing import Optional, Iterator

import requests

from .models import Processo


BASE_URL = "https://api-publica.datajud.cnj.jus.br"
DEFAULT_API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="


class DatajudClient:
    """
    Cliente HTTP para a API Pública do Datajud.

    Exemplo de uso:
        client = DatajudClient()

        # Buscar por número de processo
        processos = client.buscar_por_numero("0000001-11.2020.8.26.0001", "tjsp")

        # Buscar por classe e tribunal com paginação
        for processo in client.buscar_todos(tribunal="tjsp", classe_codigo=436, max_docs=500):
            print(processo.numero_processo)
    """

    def __init__(self, api_key: Optional[str] = None, timeout: int = 30):
        self.api_key = api_key or os.getenv("DATAJUD_API_KEY", DEFAULT_API_KEY)
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"APIKey {self.api_key}",
            "Content-Type": "application/json",
        })

    def _endpoint(self, tribunal: str) -> str:
        tribunal = tribunal.lower().strip()
        return f"{BASE_URL}/api_publica_{tribunal}/_search"

    def _post(self, tribunal: str, query: dict) -> dict:
        """Executa uma requisição POST e retorna o JSON."""
        url = self._endpoint(tribunal)
        resp = self.session.post(url, json=query, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Métodos de busca
    # ------------------------------------------------------------------

    def buscar_por_numero(self, numero_processo: str, tribunal: str) -> list[Processo]:
        """Busca processo pelo número único (CNJ)."""
        query = {
            "query": {
                "match": {"numeroProcesso": numero_processo}
            }
        }
        data = self._post(tribunal, query)
        hits = data.get("hits", {}).get("hits", [])
        return [Processo.from_dict(h) for h in hits]

    def buscar(
        self,
        tribunal: str,
        *,
        classe_codigo: Optional[int] = None,
        assunto_codigo: Optional[int] = None,
        grau: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        tamanho: int = 10,
        from_: int = 0,
        sort_field: str = "dataAjuizamento",
        sort_order: str = "asc",
    ) -> dict:
        """
        Busca processos com filtros.

        Args:
            tribunal       : Sigla do tribunal (ex: 'tjsp')
            classe_codigo  : Código da classe (tabela unificada CNJ)
            assunto_codigo : Código do assunto (tabela unificada CNJ)
            grau           : Grau de jurisdição (G1, G2, JE, SUP)
            data_inicio    : Data de ajuizamento inicial (YYYY-MM-DD)
            data_fim       : Data de ajuizamento final (YYYY-MM-DD)
            tamanho        : Número de resultados por página (max 10.000)
            from_          : Offset para paginação
            sort_field     : Campo de ordenação
            sort_order     : Direção de ordenação (asc/desc)

        Returns:
            dict com 'total' e 'processos' (lista de Processo)
        """
        must = []

        if classe_codigo is not None:
            must.append({"match": {"classe.codigo": classe_codigo}})

        if assunto_codigo is not None:
            must.append({"match": {"assuntos.codigo": assunto_codigo}})

        if grau is not None:
            must.append({"match": {"grau": grau.upper()}})

        if data_inicio or data_fim:
            range_filter: dict = {"dataAjuizamento": {}}
            if data_inicio:
                range_filter["dataAjuizamento"]["gte"] = data_inicio
            if data_fim:
                range_filter["dataAjuizamento"]["lte"] = data_fim
            must.append({"range": range_filter})

        query: dict = {
            "size": tamanho,
            "from": from_,
            "sort": [{sort_field: {"order": sort_order}}],
            "query": {"bool": {"must": must}} if must else {"match_all": {}},
        }

        data = self._post(tribunal, query)
        hits = data.get("hits", {})
        total = hits.get("total", {})
        total_value = total.get("value", 0) if isinstance(total, dict) else total

        return {
            "total": total_value,
            "processos": [Processo.from_dict(h) for h in hits.get("hits", [])],
        }

    def buscar_todos(
        self,
        tribunal: str,
        *,
        classe_codigo: Optional[int] = None,
        assunto_codigo: Optional[int] = None,
        grau: Optional[str] = None,
        data_inicio: Optional[str] = None,
        data_fim: Optional[str] = None,
        max_docs: int = 1000,
        tamanho_pagina: int = 100,
        sleep_entre_paginas: float = 0.5,
    ) -> Iterator[Processo]:
        """
        Gerador que itera sobre todos os processos retornados pela busca,
        paginando automaticamente.

        Args:
            max_docs           : Limite máximo de documentos a retornar
            tamanho_pagina     : Registros por requisição (max 10.000)
            sleep_entre_paginas: Pausa entre requisições (segundos)

        Yields:
            Processo
        """
        coletados = 0
        from_ = 0

        while coletados < max_docs:
            tamanho = min(tamanho_pagina, max_docs - coletados)
            resultado = self.buscar(
                tribunal,
                classe_codigo=classe_codigo,
                assunto_codigo=assunto_codigo,
                grau=grau,
                data_inicio=data_inicio,
                data_fim=data_fim,
                tamanho=tamanho,
                from_=from_,
            )

            processos = resultado["processos"]
            if not processos:
                break

            for p in processos:
                yield p
                coletados += 1

            from_ += tamanho

            if len(processos) < tamanho:
                break

            if sleep_entre_paginas > 0:
                time.sleep(sleep_entre_paginas)

    def buscar_query_raw(self, tribunal: str, query: dict) -> dict:
        """
        Executa uma query Elasticsearch bruta.
        Útil para consultas avançadas com aggregations, scripts, etc.
        """
        return self._post(tribunal, query)

    def contar(self, tribunal: str, **kwargs) -> int:
        """Retorna o total de processos para um conjunto de filtros."""
        resultado = self.buscar(tribunal, tamanho=0, **kwargs)
        return resultado["total"]
