"""
Gera os dados do formulário de recursos do Prêmio TJAC de Qualidade 2026.

O que este script faz, em ordem:
  1. Lê a lista de unidades ativas (dados/Unidades_Ativas_TJAC_Competencias.csv).
  2. Classifica cada unidade numa "categoria de avaliação" (1º grau, gabinete de
     desembargador, SEJUD, Vice-Presidência ou fora da abrangência), conforme o
     art. 4º da Portaria PRESI nº 1.961/2026.
  3. Monta a matriz de indicadores (Anexo I, com as alterações das Portarias
     nº 4.335/2026 e nº 4.919/2026), agrupada em "eixos" no mesmo formato das
     perguntas do formulário do CNJ.
  4. Grava:
       - dados/unidades.json e dados/indicadores.json (para conferência);
       - dados/Unidades_BD.csv (planilha inicial do banco no Google Drive);
       - apps-script/Formulario.html e site/index.html (o formulário, com os
         dados embutidos).

Como rodar (na pasta premio-tjac-recursos):
    python scripts/build.py

Não precisa instalar nada: usa apenas a biblioteca padrão do Python.
"""

from __future__ import annotations

import csv
import json
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV_UNIDADES = RAIZ / "dados" / "Unidades_Ativas_TJAC_Competencias.csv"
MODELO_HTML = RAIZ / "scripts" / "formulario_modelo.html"

# ---------------------------------------------------------------------------
# 1. Matriz de indicadores (Anexo I consolidado)
# ---------------------------------------------------------------------------
# "dica" = códigos de competência (MPM) que sugerem que o indicador temático é
# aplicável. É só uma indicação visual no formulário: TODOS os itens do grau
# aparecem, como no formulário do CNJ, porque a aplicabilidade é decidida pela
# Unidade Gestora (art. 10, § 1º), não pelo formulário.
JUIZO_UNICO = "1"

EIXOS = {
    "1G_GERAIS": {
        "titulo": "Indicadores Gerais do 1º Grau",
        "fonte": "Anexo I, quadro A",
        "itens": [
            (1, "IAD-C", "Índice de Atendimento à Demanda - Critério Conjugado", 120, None),
            (2, "TPL", "Tempo Médio de Duração dos Processos Pendentes Líquidos", 60, None),
            (3, "METAS", "Índice de Cumprimento das Metas Nacionais do CNJ", 130, None),
            (4, "IREA", "Índice de Redução de Processos Antigos", 40, None),
            (5, "ISU", "Índice de Saneamento e/ou Consistência de Dados", 70, None),
            (6, "IRASP", "Índice de Alimentação e Correção de Sistemas Prioritários - CNIUPS/SNA e CNIEP", 120, None),
        ],
    },
    "1G_TEMATICOS": {
        "titulo": "Indicadores Temáticos do 1º Grau",
        "fonte": "Anexo I, quadro B",
        "itens": [
            (7, "TPL-VDF", "Tempo Médio do Pendente Líquido nos Processos de Violência Doméstica e Familiar contra a Mulher", 30, ["22"]),
            (8, "TPL-FEM", "Tempo Médio do Pendente Líquido nos Processos de Feminicídio", 30, ["16", "22"]),
            (9, "TM-MPU", "Tempo Médio de Medidas Protetivas de Urgência", 40, ["22"]),
            (10, "TPL-Saúde", "Tempo Médio do Pendente Líquido nos Processos de Judicialização da Saúde", 40, ["46", "7", "35"]),
            (11, "ICAP", "Índice de Celeridade Processual na Tramitação das Ações Penais", 40, ["3", "12", "15", "16", "22", "27", "43", "44"]),
            (12, "IAD-Amb", "Índice de Atendimento à Demanda - Ambiental", 30, ["29", "7"]),
            (13, "IJ-Amb", "Índice de Julgamento de Ações Ambientais Ingressadas até 31.12.2022", 30, ["29", "7"]),
            (14, "IPV-PR/LC-SEEU", "Índice de Julgamento dos Incidentes de Progressão de Regime e Livramento Condicional Vencidos no SEEU", 60, ["20"]),
            (15, "IEP-TP", "Índice de Extinção da Pena", 30, ["20"]),
            (16, "I-ACS", "Índice de Realização de Audiências Concentradas Infracionais em 30.11.2026", 20, ["45", "50"]),
            (17, "C-AI", "Celeridade processual na tramitação de ato infracional (percentual de casos concluídos em até 180 dias)", 20, ["50"]),
        ],
    },
    "2G_GERAIS": {
        "titulo": "Indicadores Gerais do 2º Grau - Gabinetes",
        "fonte": "Anexo I, quadro C",
        "itens": [
            (18, "IAD-C-2G", "Índice de Atendimento à Demanda - Critério Conjugado (2º grau)", 120, None),
            (19, "TPL-2G", "Tempo Médio de Duração dos Processos Pendentes Líquidos (2º grau)", 60, None),
            (20, "METAS-2G", "Índice de Cumprimento das Metas Nacionais do CNJ (2º grau)", 160, None),
            (21, "IREA-2G", "Índice de Redução de Processos Antigos (2º grau)", 70, None),
            (22, "ISU-2G", "Índice de Saneamento e/ou Consistência de Dados (2º grau)", 50, None),
        ],
    },
    "2G_TEMATICOS": {
        "titulo": "Indicadores Temáticos do 2º Grau",
        "fonte": "Anexo I, quadro D",
        "itens": [
            (23, "TPL-Saúde-2G", "Tempo Médio do Pendente Líquido nos Processos de Judicialização da Saúde (2º grau)", 20, None),
            (24, "IAD-Amb-2G", "Índice de Atendimento à Demanda Ambiental (2º grau)", 30, None),
            (25, "IJ-Amb-2G", "Índice de Julgamento de Ações Ambientais Ingressadas até 31.12.2022 (2º grau)", 20, None),
        ],
    },
    "2G_PRECEDENTES": {
        "titulo": "Precedentes Qualificados (2º Grau)",
        "fonte": "Anexo I, quadro E",
        "itens": [
            (26, "IRDR/IAC-SUS", "IRDR/IAC suscitado/admitido no período (10 pts por evento, até 2)", 20, None),
            (27, "IRDR/IAC-TESE", "IRDR/IAC julgado com tese fixada no período (25 pts por evento, até 2)", 50, None),
        ],
    },
    "SEJUD": {
        "titulo": "Índice de Desempenho da Secretaria Judiciária (SEJUD)",
        "fonte": "Anexo I, quadro F",
        "itens": [
            (28, "ISJ", "Índice de Desempenho da Secretaria Judiciária", 650, None),
        ],
    },
    "VPRES": {
        "titulo": "Índice de Desempenho da Vice-Presidência",
        "fonte": "Anexo I, quadro G",
        "itens": [
            (29, "IAD-VPRES", "Índice de Atendimento à Demanda - VPRES", 120, None),
            (30, "TPL-VPRES", "Tempo Médio do Pendente Líquido - VPRES", 120, None),
            (31, "TPL-Saúde-VPRES", "Tempo Médio do Pendente Líquido - Saúde - VPRES", 40, None),
            (32, "ISU-VPRES", "Índice de Saneamento e/ou Consistência de Dados - VPRES", 70, None),
        ],
    },
}

# Quais "eixos" (perguntas Sim/Não) cada categoria responde.
CATEGORIAS = {
    "1G": {"rotulo": "Unidade judiciária de 1º grau", "eixos": ["1G_GERAIS", "1G_TEMATICOS"], "avaliada": True},
    "2G_GAB": {"rotulo": "Gabinete de Desembargador(a)", "eixos": ["2G_GERAIS", "2G_TEMATICOS", "2G_PRECEDENTES"], "avaliada": True},
    "SEJUD": {"rotulo": "Secretaria Judiciária", "eixos": ["SEJUD"], "avaliada": True},
    "VPRES": {"rotulo": "Vice-Presidência", "eixos": ["VPRES"], "avaliada": True},
    "EXCLUIDA": {"rotulo": "Excluída (art. 4º, § 3º - Presidência, Vice-Presidência ou Corregedoria)", "eixos": [], "avaliada": False},
    "FORA": {"rotulo": "Fora da abrangência do Prêmio (art. 4º)", "eixos": [], "avaliada": False},
}

# ---------------------------------------------------------------------------
# 2. Classificação das unidades
# ---------------------------------------------------------------------------
PREFIXOS_ADMINISTRATIVOS = (
    "ASSESSORIA", "CENTRAL", "CONSELHO", "CONTADORIA", "COORDENA", "DIRETORIA",
    "DISTRIBUIDOR", "DIVISAO", "NUCLEO DE APOIO", "NUCLEO DE GERENCIAMENTO",
    "OUVIDORIA", "PRESIDENCIA", "SECRETARIA DE APOIO", "VARA DE APOIO",
    "GABINETE DA CORREGEDORIA", "GABINETE DA VICE", "GABINETE DO VICE",
    "PLANTAO",
)
ORGAOS_COLEGIADOS = ("CAMARA", "1CAMARA", "2CAMARA", "TRIBUNAL PLENO", "TURMA DE UNIFORMIZACAO")

# Códigos com decisão expressa (revisáveis na aba "Unidades" do banco).
SECRETARIA_JUDICIARIA = "81518"
VICE_PRESIDENCIA = "74296"          # GABINETE DA VICE-PRESIDÊNCIA
# Presidente que assina a Portaria 1.961/2026 (art. 4º, § 3º). Vice-Presidente e
# Corregedor(a)-Geral NÃO estão identificados na lista: marcar na planilha.
GABINETES_EXCLUIDOS = {"33553": "Presidente (Des. Laudivon Nogueira)"}


def sem_acento(texto: str) -> str:
    base = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in base if not unicodedata.combining(c)).upper().strip()


def classificar(codigo: str, nome: str) -> tuple[str, str]:
    """Devolve (categoria, observação) para uma unidade."""
    n = sem_acento(nome)
    if codigo == SECRETARIA_JUDICIARIA:
        return "SEJUD", "Avaliada pela média dos gabinetes (art. 4º, § 2º)."
    if codigo == VICE_PRESIDENCIA:
        return "VPRES", "Indicadores específicos (art. 9º, parágrafo único)."
    if codigo in GABINETES_EXCLUIDOS:
        return "EXCLUIDA", f"Art. 4º, § 3º: gabinete do {GABINETES_EXCLUIDOS[codigo]}."
    if n.startswith("GABINETE DO DES"):
        return "2G_GAB", "Conferir se é gabinete do Vice-Presidente ou do Corregedor (art. 4º, § 3º)."
    if n.startswith(PREFIXOS_ADMINISTRATIVOS):
        return "FORA", "Unidade administrativa/de apoio."
    if n.startswith(ORGAOS_COLEGIADOS) or "CAMARAS" in n:
        return "FORA", "Órgão colegiado: a avaliação do 2º grau é feita por gabinete."
    if "CEJUSC" in n or n.startswith("CENTRO JUDICIARIO"):
        return "1G", "CEJUSC: confirmar com a Unidade Gestora se há acervo avaliável."
    if "TURMA RECURSAL" in n:
        return "1G", "Turma Recursal tratada como 1º grau (Sistema dos Juizados): confirmar."
    return "1G", ""


def comarca(nome: str) -> str:
    n = nome.upper()
    cidades = [
        "ACRELÂNDIA", "ASSIS BRASIL", "BRASILÉIA", "BRASILEIA", "BUJARI", "CAPIXABA",
        "CRUZEIRO DO SUL", "EPITACIOLÂNDIA", "FEIJÓ", "JORDÃO", "JORDAO", "MÂNCIO LIMA",
        "MANOEL URBANO", "MARECHAL THAUMATURGO", "PLÁCIDO DE CASTRO", "PORTO ACRE",
        "PORTO WALTER", "RIO BRANCO", "RODRIGUES ALVES", "SANTA ROSA", "SENADOR GUIOMARD",
        "SENA MADUREIRA", "TARAUACÁ", "XAPURI",
    ]
    for c in cidades:
        if c in n:
            return c.title().replace(" Do ", " do ").replace(" De ", " de ").replace("Brasileia", "Brasiléia").replace("Jordao", "Jordão")
    return "2º Grau / Sede" if "GABINETE" in n or "CÂMARA" in n else "Rio Branco"


def ler_unidades() -> list[dict]:
    unidades = []
    with CSV_UNIDADES.open(encoding="utf-8-sig", newline="") as f:
        for linha in csv.DictReader(f, delimiter=";"):
            codigo = linha["codigo_serventia"].strip()
            nome = " ".join(linha["nome_serventia"].split())
            categoria, obs = classificar(codigo, nome)
            unidades.append({
                "codigo": codigo,
                "nome": nome,
                "status": linha["status"].strip(),
                "competencias": [c.strip() for c in linha["codigos_competencias"].split(",") if c.strip()],
                "competencias_descritivas": linha["competencias_descritivas"].strip(),
                "categoria": categoria,
                "comarca": comarca(nome),
                "observacao": obs,
            })
    unidades.sort(key=lambda u: sem_acento(u["nome"]))
    return unidades


def montar_indicadores() -> dict:
    eixos = {}
    for chave, eixo in EIXOS.items():
        eixos[chave] = {
            "titulo": eixo["titulo"],
            "fonte": eixo["fonte"],
            "itens": [
                {
                    "n": n, "sigla": sigla, "nome": nome, "pontos": pontos,
                    "dica": (dica + [JUIZO_UNICO]) if dica else None,
                }
                for (n, sigla, nome, pontos, dica) in eixo["itens"]
            ],
        }
    return {"eixos": eixos, "categorias": CATEGORIAS}


def gravar_csv_banco(unidades: list[dict]) -> Path:
    """Planilha inicial (aba Unidades) do banco no Google Drive."""
    destino = RAIZ / "dados" / "Unidades_BD.csv"
    with destino.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "nome", "comarca", "categoria", "competencias", "competencias_descritivas", "observacao"])
        for u in unidades:
            w.writerow([u["codigo"], u["nome"], u["comarca"], u["categoria"],
                        " ; ".join(u["competencias"]), u["competencias_descritivas"], u["observacao"]])
    return destino


def gerar_html(dados: dict) -> list[Path]:
    modelo = MODELO_HTML.read_text(encoding="utf-8")
    json_txt = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = modelo.replace("/*__DADOS__*/null", json_txt)
    saidas = [RAIZ / "apps-script" / "Formulario.html", RAIZ / "site" / "index.html"]
    for s in saidas:
        s.write_text(html, encoding="utf-8")
    return saidas


def main() -> None:
    unidades = ler_unidades()
    indicadores = montar_indicadores()
    (RAIZ / "dados" / "unidades.json").write_text(json.dumps(unidades, ensure_ascii=False, indent=2), encoding="utf-8")
    (RAIZ / "dados" / "indicadores.json").write_text(json.dumps(indicadores, ensure_ascii=False, indent=2), encoding="utf-8")
    gravar_csv_banco(unidades)
    enxuto = [{k: u[k] for k in ("codigo", "nome", "comarca", "categoria", "competencias")} for u in unidades]
    saidas = gerar_html({"unidades": enxuto, **indicadores})

    contagem: dict[str, int] = {}
    for u in unidades:
        contagem[u["categoria"]] = contagem.get(u["categoria"], 0) + 1
    print(f"{len(unidades)} unidades lidas.")
    for cat, qtd in sorted(contagem.items()):
        print(f"  {cat:<9} {qtd:>3}  {CATEGORIAS[cat]['rotulo']}")
    for s in saidas:
        print("Gerado:", s.relative_to(RAIZ))


if __name__ == "__main__":
    main()
