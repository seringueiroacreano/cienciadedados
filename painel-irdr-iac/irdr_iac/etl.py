"""Lê a matriz da SEJUD e as extrações de sobrestamento e grava as tabelas do painel (CSV UTF-8, ';').

Tabelas geradas (modelo estrela do Power BI):
  dParametros.csv          datas de extração, início, encerramento e corte; pontos SUS/TESE
  dGabinete.csv            gabinetes da matriz + chave de ligação com as extrações
  fIncidente.csv           um incidente por linha, com SUS/TESE/potencial/seleção (regras.py)
  fPontuacaoGabinete.csv   consolidado por gabinete (= aba Relatório Parcial)
  fSobrestamento.csv       processos sobrestados por tema (IRDR.csv), com tema classificado
  dTema.csv                um tema por linha: tribunal, espécie, nº de processos
  bRelator.csv             ponte processo -> relator (MAGISTRADOS.csv), sem duplicatas
  qualidade.csv            achados de qualidade dos dados (o painel tem uma página só para isso)
"""
import re
import unicodedata
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from . import regras

SEP = ";"


# ----------------------------------------------------------------- utilidades
def chave_nome(texto: str) -> str:
    """'Gabinete do Des. Roberto Barros' -> 'ROBERTO BARROS' (sem acento, sem cargo)."""
    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().upper()
    t = re.sub(r"\bGABINETE\b|\bD[OA]\b|\bDES\b\.?|\bDESA?\b|\bJUIZ[A]?\b|\bDE DIREI?R?TO\b|[ª.ºº]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def casar_gabinete(nome_extracao: str, chaves_matriz: dict[str, str]) -> str | None:
    """Liga o nome do órgão julgador da extração ao gabinete da matriz (tokens contidos)."""
    tok = set(chave_nome(nome_extracao).split())
    if len(tok) < 2:
        return None
    for chave, gabinete in chaves_matriz.items():
        if tok <= set(chave.split()):
            return gabinete
    return None


def para_data(v) -> date | None:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return pd.to_datetime(v, dayfirst=True).date()
    except (ValueError, TypeError):
        return None


def sim(v) -> bool:
    return str(v or "").strip().lower() in ("sim", "s", "1", "true", "x")


def ler_csv(caminho: Path) -> pd.DataFrame:
    d = pd.read_csv(caminho, sep=";", encoding="utf-8-sig", dtype=str)
    d.columns = [c.lstrip("﻿") for c in d.columns]
    d[d.columns[0]] = d[d.columns[0]].str.lstrip("﻿")   # BOM repetido no início das linhas
    return d


def _bloco(df: pd.DataFrame, rotulo: str, ate: str | None = None) -> pd.DataFrame:
    """Recorta a tabela da aba cujo cabeçalho começa com `rotulo` na coluna A."""
    linha = df.index[df.iloc[:, 0].astype(str).str.strip() == rotulo][0]
    cab = df.loc[linha].tolist()
    fim = cab.index(ate) + 1 if ate else len([c for c in cab if pd.notna(c)])
    corpo = df.loc[linha + 1:, :fim - 1].copy()
    corpo.columns = [str(c).strip() for c in cab[:fim]]
    return corpo[corpo.iloc[:, 0].notna() & (corpo.iloc[:, 0].astype(str).str.strip() != "")]


# ----------------------------------------------------------------- matriz SEJUD
def ler_matriz(caminho: Path, corte: date | None = None):
    abas = pd.read_excel(caminho, sheet_name=None, header=None)
    rel = abas["Relatorio Parcial"]
    lin = rel.index[rel.iloc[:, 0].astype(str).str.startswith("Data de extra")][0]
    cols = [c for c in rel.columns if pd.notna(rel.loc[lin, c])]   # células mescladas: usa as colunas do rótulo
    v = [rel.loc[lin + 1, c] for c in cols] + [None] * 4
    param = {
        "data_extracao": para_data(v[0]), "inicio": para_data(v[1]) or regras.INICIO,
        "encerramento": para_data(v[2]) or regras.ENCERRAMENTO,
        "corte": corte or para_data(v[3]) or date.today(),
        "pontos_sus": regras.PONTOS_SUS, "pontos_tese": regras.PONTOS_TESE,
        "max_incidentes": regras.MAX_INCIDENTES,
        "teto_gabinete": regras.MAX_INCIDENTES * (regras.PONTOS_SUS + regras.PONTOS_TESE),
    }

    gab = _bloco(abas["Gabinetes"], "Gabinete", ate="Situação da aferição")
    gab = gab[~gab["Gabinete"].astype(str).str.contains("Fonte|Portaria|Anexo|http", regex=True)]
    gab = gab[gab["Gabinete"].astype(str).str.upper().str.startswith("GABINETE")]
    dgab = pd.DataFrame({
        "gabinete": gab["Gabinete"].str.strip(),
        "elegivel": [sim(e) and not regras.fora_do_escopo(g) for e, g in zip(gab["Elegível?"], gab["Gabinete"])],
        "manifestacao": gab["Manifestação SEJUD"],
        "responsavel": gab["Responsável pela informação"],
        "fonte": gab["Documento ou fonte da informação"],
        "serventia": gab["Observações"].astype(str).str.extract(r"Serventia (\d+)")[0],
    })
    dgab["chave"] = dgab["gabinete"].map(chave_nome)

    mi = abas["Matriz Incidentes"]
    inc_df = _bloco(mi, "Número do processo", ate="Observações") if (
        mi.iloc[:, 0].astype(str).str.strip() == "Número do processo").any() else pd.DataFrame()
    incidentes = [
        regras.Incidente(
            ordem=n, numero=str(r.get("Número do processo", "")).strip(), especie=r.get("Espécie"),
            gabinete=str(r.get("Gabinete", "")).strip(),
            data_suscitamento=para_data(r.get("Data de suscitamento")),
            data_admissao=para_data(r.get("Data de admissão")), marco_sus=r.get("Marco SUS adotado"),
            data_julgamento=para_data(r.get("Data do julgamento")), tese_fixada=sim(r.get("Tese fixada?")),
            evidencia_sus=None if pd.isna(r.get("Evidência do ato SUS")) else r.get("Evidência do ato SUS"),
            evidencia_julgamento=None if pd.isna(r.get("Evidência do julgamento")) else r.get("Evidência do julgamento"),
        )
        for n, (_, r) in enumerate(inc_df.iterrows(), start=1)
    ]
    return param, dgab, incidentes, inc_df


def consolidar(dgab: pd.DataFrame, finc: pd.DataFrame) -> pd.DataFrame:
    linhas = []
    for _, g in dgab.iterrows():
        f = finc[finc["gabinete"] == g["gabinete"]] if len(finc) else finc
        reg = len(f)
        pend = int((f["pendencias"] != "").sum()) if reg else 0
        total = int(f["total"].sum()) if reg else 0
        linhas.append({
            "gabinete": g["gabinete"], "elegivel": g["elegivel"], "registros": reg, "pendencias_qtd": pend,
            "sus_elegiveis": int(f["sus"].sum()) if reg else 0,
            "tese_elegiveis": int(f["tese"].sum()) if reg else 0,
            "incidentes_pontuados": int(f["selecionado"].sum()) if reg else 0,
            "pontos_sus": int(f["pontos_sus"].sum()) if reg else 0,
            "pontos_tese": int(f["pontos_tese"].sum()) if reg else 0,
            "total": total,
            "situacao": regras.situacao(g["elegivel"], g["manifestacao"] if pd.notna(g["manifestacao"]) else None,
                                        reg, pend, total),
        })
    return pd.DataFrame(linhas)


# ----------------------------------------------------------------- extrações de sobrestamento
def classificar_tema(rotulo: str) -> tuple[str, str]:
    """Rótulo livre do sistema -> (espécie padronizada, tribunal)."""
    r = unicodedata.normalize("NFKD", str(rotulo)).encode("ascii", "ignore").decode().lower()
    if "fora de uso" in r:
        return "Rótulo fora de uso", "Indefinido"
    if "demandas repetitivas" in r:
        return "IRDR", "TJAC"
    if "assuncao de competencia" in r:
        return "IAC", "TJAC"
    if "tst" in r:
        return "Recurso de Revista Repetitivo", "TST"
    if "extraordinario" in r:
        return "Repercussão Geral", "STF"
    if "especial" in r:
        return "Recurso Especial Repetitivo", "STJ"
    return "Outro", "Indefinido"


def preparar_sobrestamento(irdr: pd.DataFrame, dgab: pd.DataFrame, corte: date) -> pd.DataFrame:
    d = irdr.drop_duplicates().copy()
    d[["especie", "tribunal"]] = d["tema_resumido"].apply(lambda s: pd.Series(classificar_tema(s)))
    d["data_recebimento"] = pd.to_datetime(d["data_recebimento"], errors="coerce")
    d["data_ajuizamento"] = pd.to_datetime(d["data_ajuizamento"], errors="coerce")
    d["ano_recebimento"] = d["data_recebimento"].dt.year
    d["dias_desde_recebimento"] = (pd.Timestamp(corte) - d["data_recebimento"]).dt.days
    d["julgado"] = d["julgamento"].eq("Julgado")
    chaves = dict(zip(dgab["chave"], dgab["gabinete"]))
    d["gabinete_matriz"] = d["nome"].map(lambda n: casar_gabinete(n, chaves)) if "nome" in d else None
    # o mesmo nº de tema aparece com espécies diferentes -> sinal de rótulo errado no cadastro
    especies_por_tema = d.dropna(subset=["numero_tema"]).groupby("numero_tema")["especie"].nunique()
    d["tema_com_rotulo_conflitante"] = d["numero_tema"].map(especies_por_tema).fillna(0).gt(1)
    d["comarca"] = d["comarca"].fillna("(sem comarca — 2º grau/Turma Recursal)")
    cols = ["id_processo", "numero", "sigilo", "grau", "sistema", "classe_processual", "id_orgao_julgador",
            "nome", "gabinete_matriz", "comarca", "data_ajuizamento", "data_recebimento", "ano_recebimento",
            "dias_desde_recebimento", "codigo_nacional", "tema_resumido", "especie", "tribunal", "numero_tema",
            "tema_com_rotulo_conflitante", "fase", "julgado"]
    return d[[c for c in cols if c in d.columns]]


def montar_dtema(fs: pd.DataFrame) -> pd.DataFrame:
    t = fs.dropna(subset=["numero_tema"]).copy()
    moda = t.groupby("numero_tema")["especie"].agg(lambda s: s.value_counts().index[0])
    trib = t.groupby("numero_tema")["tribunal"].agg(lambda s: s.value_counts().index[0])
    g = t.groupby("numero_tema").agg(
        processos=("numero", "nunique"), registros=("numero", "size"),
        suspensos=("fase", lambda s: (s == "Suspenso").sum()),
        primeiro_recebimento=("data_recebimento", "min"), ultimo_recebimento=("data_recebimento", "max"),
        especies_distintas=("especie", "nunique"))
    g["especie_predominante"] = moda
    g["tribunal_predominante"] = trib
    return g.reset_index().sort_values("processos", ascending=False)


def diagnostico(fs: pd.DataFrame, irdr_bruto: pd.DataFrame, mag: pd.DataFrame | None,
                dgab: pd.DataFrame, finc: pd.DataFrame) -> pd.DataFrame:
    ach = []

    def a(gravidade, achado, valor, impacto):
        ach.append({"gravidade": gravidade, "achado": achado, "valor": valor, "impacto": impacto})

    n = len(fs)
    irdr_ext = fs[fs["especie"] == "IRDR"]
    a("Crítica", "Registros de IRDR com data de recebimento em 2026", int((irdr_ext["ano_recebimento"] == 2026).sum()),
      "A extração não traz evento algum de IRDR no período da aferição; não serve de fonte para SUS/TESE.")
    a("Crítica", "Registros de IAC na extração", int((fs["especie"] == "IAC").sum()),
      "IAC não aparece na extração; a única fonte de IAC é a matriz da SEJUD.")
    a("Crítica", "Linhas 'IRDR' cujo nº de tema também aparece como RG/Repetitivo",
      int(irdr_ext["tema_com_rotulo_conflitante"].sum()),
      "Temas 551, 1218, 1150 etc. são temas nacionais: o rótulo 'IRDR' foi aplicado por engano no sobrestamento.")
    a("Alta", "Extração é de processos SOBRESTADOS (movimentos 265/11975), não de incidentes instaurados",
      int(fs["codigo_nacional"].nunique()), "Mede impacto dos precedentes no acervo, não a atuação do gabinete.")
    a("Alta", "Rótulos de tema distintos para poucas espécies", int(irdr_bruto["tema_resumido"].nunique()),
      "Exige tabela de-para (feita no ETL: coluna 'especie').")
    a("Média", "Linhas sem número de tema", int(fs["numero_tema"].isna().sum()), "Não entram em análises por tema.")
    a("Média", "Linhas duplicadas removidas", int(irdr_bruto.duplicated().sum()), "Removidas no ETL.")
    a("Média", "Mesmo processo em várias linhas (temas ou recebimentos diferentes)",
      int(n - fs["numero"].nunique()), "Contar processos com DISTINCTCOUNT(numero), nunca COUNTROWS.")
    a("Baixa", "Processos sigilosos", int((fs["sigilo"] == "S").sum()), "Mascarar número no painel publicado.")
    sem_gab = fs[(fs["grau"] == "G2") & fs["gabinete_matriz"].isna()]["nome"].dropna().unique()
    a("Média", "Órgãos de 2º grau da extração sem gabinete na matriz", "; ".join(sorted(sem_gab)),
      "Órgãos colegiados, Vice-Presidência e gabinete sem titular na matriz: confirmar com a SEJUD.")
    if mag is not None:
        rel = mag.drop_duplicates().groupby("id_processo")["relator"].nunique()
        a("Alta", "Processos com mais de um relator (sem data para saber o atual)", int((rel > 1).sum()),
          "Não atribuir pontuação por relator a partir desse arquivo.")
        a("Média", "Cobertura do arquivo de magistrados sobre a extração (% de id_processo)",
          round(100 * fs["id_processo"].isin(mag["id_processo"]).mean(), 1), "Só SAJ; eproc e 2º grau ficam de fora.")
    a("Crítica" if finc.empty else "Info", "Incidentes lançados na matriz da SEJUD", len(finc),
      "Sem incidentes lançados, todos os gabinetes ficam em 'Aguardando'.")
    a("Info", "Gabinetes cadastrados na matriz", len(dgab), "")
    return pd.DataFrame(ach)


# ----------------------------------------------------------------- execução
def executar(matriz: Path, saida: Path, irdr_csv: Path | None = None, magistrados_csv: Path | None = None,
             corte: date | None = None) -> dict[str, pd.DataFrame]:
    saida.mkdir(parents=True, exist_ok=True)
    param, dgab, incidentes, _ = ler_matriz(matriz, corte)
    finc = pd.DataFrame(regras.pontuar(incidentes, param["corte"]))
    if finc.empty:
        finc = pd.DataFrame(columns=["ordem", "numero", "especie", "gabinete", "data_sus", "data_julgamento",
                                     "sus", "tese", "potencial", "pendencias", "ordem_no_gabinete",
                                     "selecionado", "pontos_sus", "pontos_tese", "total"])
    tabelas = {"dParametros": pd.DataFrame([param]), "dGabinete": dgab, "fIncidente": finc,
               "fPontuacaoGabinete": consolidar(dgab, finc)}
    if irdr_csv:
        bruto = ler_csv(irdr_csv)
        mag = ler_csv(magistrados_csv) if magistrados_csv else None
        fs = preparar_sobrestamento(bruto, dgab, param["corte"])
        tabelas["fSobrestamento"] = fs
        tabelas["dTema"] = montar_dtema(fs)
        if mag is not None:
            tabelas["bRelator"] = mag.drop_duplicates(subset=["id_processo", "relator"])[["id_processo", "relator"]]
        tabelas["qualidade"] = diagnostico(fs, bruto, mag, dgab, finc)
    for nome, df in tabelas.items():
        df.to_csv(saida / f"{nome}.csv", sep=SEP, index=False, encoding="utf-8-sig", date_format="%Y-%m-%d")
    return tabelas
