#!/usr/bin/env python3
"""Gera index.html (página completa) a partir de web/pagina.html (conteúdo).

    python web/montar.py
"""
from pathlib import Path
from urllib.parse import quote

raiz = Path(__file__).resolve().parent.parent
conteudo = (raiz / "web" / "pagina.html").read_text(encoding="utf-8")
icone = quote((raiz / "divulgacao" / "logo" / "simbolo.svg").read_text(encoding="utf-8"))
cabeca = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Sumaúma RPA: gestão à vista das Metas Nacionais do Poder Judiciário por unidade judiciária.">
<meta name="theme-color" content="#0b3d2e">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{icone}">
</head>
<body style="margin:0">
"""
(raiz / "index.html").write_text(cabeca + conteudo + "</body>\n</html>\n", encoding="utf-8")
print("index.html gerado")
