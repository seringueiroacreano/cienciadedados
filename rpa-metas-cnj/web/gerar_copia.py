#!/usr/bin/env python3
"""Gera a cópia da base usada pela página quando ela está hospedada onde não
pode acessar o TJAC (ex.: artefato do Claude).

    python gerar_copia.py PASTA_DESTINO

Cria PASTA_DESTINO/dados/manifest.json e dados/meta_NN_pK.json. Cada parte é um
JSON por colunas: colunas com poucos valores distintos viram dicionário + índices,
o que deixa o arquivo com cerca de um terço do CSV e abaixo de 15 MB por parte.
"""
from __future__ import annotations

import csv
import email.utils
import io
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

METAS = [1, 2, 3, 4, 5, 6, 7, 8, 10]
URL = "https://exportar-bi.tjac.jus.br/download/Metas_Nacionais_SAJ__meta_{:02d}"
USER_AGENT = "rpa-metas-cnj/1.0 (extracao automatizada de dados publicos)"
LIMITE = 14 * 1024 * 1024  # bytes por parte


def baixar(meta: int) -> tuple[str, str]:
    req = urllib.request.Request(URL.format(meta), headers={"User-Agent": USER_AGENT})
    for n in range(1, 8):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                dados = r.read()
                esperado = int(r.headers.get("Content-Length") or len(dados))
                if len(dados) != esperado:
                    raise ConnectionError("download incompleto")
                quando = email.utils.parsedate_to_datetime(r.headers["Last-Modified"]).isoformat()
                return dados.decode("utf-8-sig"), quando
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if n == 7:
                raise
            print(f"  meta {meta}: {e}; nova tentativa {n + 1}/7")
            time.sleep(2 * n)


def codificar(cabecalho: list[str], linhas: list[list[str]]) -> str:
    colunas = []
    for i in range(len(cabecalho)):
        valores = [l[i] if i < len(l) else "" for l in linhas]
        distintos = list(dict.fromkeys(valores))
        if len(distintos) <= len(valores) // 2:
            pos = {v: k for k, v in enumerate(distintos)}
            colunas.append({"d": distintos, "i": [pos[v] for v in valores]})
        else:
            colunas.append({"v": valores})
    return json.dumps({"cabecalho": cabecalho, "linhas": len(linhas), "colunas": colunas},
                      ensure_ascii=False, separators=(",", ":"))


def partes(cabecalho: list[str], linhas: list[list[str]]) -> list[str]:
    texto = codificar(cabecalho, linhas)
    if len(texto.encode()) <= LIMITE or len(linhas) < 2:
        return [texto]
    meio = len(linhas) // 2
    return partes(cabecalho, linhas[:meio]) + partes(cabecalho, linhas[meio:])


def main() -> None:
    destino = Path(sys.argv[1]) / "dados"
    destino.mkdir(parents=True, exist_ok=True)
    manifesto = {"gerado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "metas": {}}
    for meta in METAS:
        texto, quando = baixar(meta)
        tabela = list(csv.reader(io.StringIO(texto), delimiter=";"))
        cabecalho, linhas = tabela[0], [l for l in tabela[1:] if l]
        nomes = []
        for k, parte in enumerate(partes(cabecalho, linhas), 1):
            nome = f"dados/meta_{meta:02d}_p{k}.json"
            (destino.parent / nome).write_text(parte, encoding="utf-8")
            nomes.append(nome)
        manifesto["metas"][str(meta)] = {"partes": nomes, "linhas": len(linhas), "atualizado": quando}
        print(f"meta {meta}: {len(linhas)} linhas em {len(nomes)} parte(s), base de {quando}")
    (destino / "manifest.json").write_text(json.dumps(manifesto, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
