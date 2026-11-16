"""Gravação no banco (Supabase) pela API REST, com a chave de serviço.

Variáveis de ambiente: SUPABASE_URL e SUPABASE_SERVICE_KEY. A chave de serviço ignora
a segurança por linha; ela só existe na rotina de carga, nunca na página.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

LOTE = 2000


class Banco:
    def __init__(self, url: str | None = None, chave: str | None = None):
        self.url = (url or os.environ["SUPABASE_URL"]).rstrip("/") + "/rest/v1/"
        self.chave = chave or os.environ["SUPABASE_SERVICE_KEY"]

    def _pedir(self, metodo: str, caminho: str, corpo=None, prefer: str = ""):
        dados = json.dumps(corpo, ensure_ascii=False).encode() if corpo is not None else None
        req = urllib.request.Request(self.url + caminho, data=dados, method=metodo, headers={
            "apikey": self.chave, "Authorization": f"Bearer {self.chave}",
            "Content-Type": "application/json", "Prefer": prefer})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                texto = r.read().decode()
                return json.loads(texto) if texto else None
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{metodo} {caminho.split('?')[0]}: HTTP {e.code} {e.read().decode()[:300]}") from None

    def gravar(self, tabela: str, linhas: list[dict], conflito: str) -> None:
        """Insere ou atualiza em lotes, usando `conflito` (colunas da chave) para decidir."""
        for i in range(0, len(linhas), LOTE):
            self._pedir("POST", f"{tabela}?on_conflict={conflito}", linhas[i:i + LOTE],
                        "resolution=merge-duplicates,return=minimal")

    def inserir(self, tabela: str, linhas: list[dict]) -> None:
        for i in range(0, len(linhas), LOTE):
            self._pedir("POST", tabela, linhas[i:i + LOTE], "return=minimal")

    def apagar(self, tabela: str, filtro: str) -> None:
        self._pedir("DELETE", f"{tabela}?{filtro}", prefer="return=minimal")

    def ler(self, tabela: str, consulta: str) -> list[dict]:
        saida, inicio = [], 0
        while True:
            pagina = self._pedir("GET", f"{tabela}?{consulta}&limit=1000&offset={inicio}") or []
            saida += pagina
            if len(pagina) < 1000:
                return saida
            inicio += 1000

    def ids_das_unidades(self, unidades: dict[str, str]) -> dict[str, int]:
        """Garante o cadastro das unidades (nome -> município) e devolve nome -> id."""
        self.gravar("unidades", [{"nome": n, "municipio": m or None} for n, m in sorted(unidades.items())], "nome")
        return {u["nome"]: u["id"] for u in self.ler("unidades", "select=id,nome")}
