"""Coleta IRDR e IAC do TJAC na API Pública do DataJud (CNJ) e converte nos registros da matriz.

Parametrização TPU/SGT (material SUMAE/COGER, Prêmio TJAC 2026):
  Classes:    12085 IRDR · 12087 IAC
  Movimentos: 12094 Admissão de IRDR · 12095 Não admissão de IRDR
              12098 Processo suspenso por IRDR (processos de 1º/2º grau, não o incidente)
              14985 Levantamento da suspensão por IRDR
              12257 Definição de tese jurídica  <- gera a pontuação TESE (Portaria PRESI 1.961, ind. 31)

Regra de conversão (para a matriz / regras.py):
  data de suscitamento = dataAjuizamento do incidente
  data de admissão     = 1º movimento 12094
  data do julgamento   = 1º movimento 12257 (tese_fixada = True)
  gabinete             = orgaoJulgador atual do incidente
  evidência            = "DataJud: mov. <código> em <data>"
"""
import json
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime

URL = "https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search"
# Chave PÚBLICA divulgada pelo CNJ na wiki do DataJud (pode mudar: sobrescreva com DATAJUD_API_KEY).
CHAVE_PUBLICA = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

CLASSES = {12085: "IRDR", 12087: "IAC"}
MOV_ADMISSAO, MOV_NAO_ADMISSAO, MOV_SUSPENSO, MOV_LEVANTAMENTO, MOV_TESE = 12094, 12095, 12098, 14985, 12257
MOV_PARAMETRIZADOS = {MOV_ADMISSAO: "Admissão", MOV_NAO_ADMISSAO: "Não admissão", MOV_SUSPENSO: "Suspensão por IRDR",
                      MOV_LEVANTAMENTO: "Levantamento da suspensão", MOV_TESE: "Definição de tese"}
MOV_TRANSITO, MOV_BAIXA, MOV_DISTRIBUICAO = 848, 22, 26


def _post(tribunal: str, corpo: dict, tentativas: int = 6) -> dict:
    """POST com nova tentativa: o DataJud devolve 429/5xx com frequência quando está sobrecarregado."""
    req = urllib.request.Request(
        URL.format(tribunal=tribunal), data=json.dumps(corpo).encode(), method="POST",
        headers={"Authorization": "APIKey " + os.environ.get("DATAJUD_API_KEY", CHAVE_PUBLICA),
                 "Content-Type": "application/json"})
    espera = 10
    for n in range(tentativas):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                resp = json.load(r)
            if "hits" in resp:
                return resp
            erro = resp.get("error", resp)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            erro = e
        if n == tentativas - 1:
            raise RuntimeError(f"DataJud indisponível após {tentativas} tentativas: {erro}")
        time.sleep(espera)
        espera = min(espera * 2, 120)


def ultima_carga(tribunal: str = "tjac") -> datetime | None:
    """Data/hora da última atualização de processo disponível no índice do tribunal."""
    r = _post(tribunal, {"size": 0, "aggs": {"u": {"max": {"field": "dataHoraUltimaAtualizacao"}}}})
    v = r.get("aggregations", {}).get("u", {}).get("value_as_string")
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


def buscar_incidentes(tribunal: str = "tjac", pagina: int = 500) -> list[dict]:
    """Todos os processos das classes IRDR/IAC (paginado com search_after)."""
    consulta = {"terms": {"classe.codigo": list(CLASSES)}}
    r = _post(tribunal, {"size": pagina, "query": consulta})   # caso comum (TJAC: dezenas): 1 chamada, sem sort
    if r["hits"]["total"]["value"] <= pagina and r["hits"]["total"].get("relation") == "eq":
        return [h["_source"] for h in r["hits"]["hits"]]
    corpo = {"size": pagina, "query": consulta, "sort": [{"@timestamp": {"order": "asc"}}]}
    fontes, depois = [], None
    while True:
        if depois:
            corpo["search_after"] = depois
        hits = _post(tribunal, corpo)["hits"]["hits"]
        fontes += [h["_source"] for h in hits]
        if len(hits) < pagina:
            return fontes
        depois = hits[-1]["sort"]


def para_data(v: str | None) -> date | None:
    """DataJud mistura '2026051100', '20260511000000' e ISO '2026-05-11T00:00:00.000Z'."""
    if not v:
        return None
    s = str(v).strip()
    try:
        if s[:4].isdigit() and s[4:5] == "-":
            return date.fromisoformat(s[:10])
        if s[:8].isdigit():
            return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None
    return None


def _primeiro(movs: list[dict], codigo: int) -> date | None:
    datas = [para_data(m.get("dataHora")) for m in movs if m.get("codigo") == codigo]
    datas = [d for d in datas if d]
    return min(datas) if datas else None


def converter(fontes: list[dict]) -> tuple[list[dict], list[dict]]:
    """-> (incidentes, movimentos). Um incidente por número (o DataJud pode repetir o processo por grau)."""
    incidentes, movimentos, vistos = [], [], {}
    for s in fontes:
        num = s["numeroProcesso"]
        movs = s.get("movimentos") or []
        for m in movs:
            movimentos.append({"numero": num, "data": para_data(m.get("dataHora")), "codigo": m.get("codigo"),
                               "movimento": m.get("nome"),
                               "parametrizado": MOV_PARAMETRIZADOS.get(m.get("codigo"), "")})
        reg = {
            "numero": num, "especie": CLASSES.get(s["classe"]["codigo"], "?"), "classe": s["classe"]["codigo"],
            "grau": s.get("grau"), "gabinete": (s.get("orgaoJulgador") or {}).get("nome", ""),
            "codigo_orgao": (s.get("orgaoJulgador") or {}).get("codigo"),
            "data_suscitamento": para_data(s.get("dataAjuizamento")),
            "data_admissao": _primeiro(movs, MOV_ADMISSAO),
            "data_nao_admissao": _primeiro(movs, MOV_NAO_ADMISSAO),
            "data_tese": _primeiro(movs, MOV_TESE),
            "data_transito": _primeiro(movs, MOV_TRANSITO),
            "assuntos": "; ".join(a.get("nome", "") for a in (s.get("assuntos") or []) if isinstance(a, dict)),
            "ultima_atualizacao": para_data(s.get("dataHoraUltimaAtualizacao")),
            "qtd_movimentos": len(movs),
        }
        reg["evidencia_sus"] = f"DataJud: ajuizamento em {reg['data_suscitamento']}" if reg["data_suscitamento"] else None
        reg["evidencia_julgamento"] = f"DataJud: mov. 12257 em {reg['data_tese']}" if reg["data_tese"] else None
        reg["alertas"] = "; ".join(alertas(reg))
        anterior = vistos.get(num)
        if anterior is None or (reg["ultima_atualizacao"] or date.min) > (anterior["ultima_atualizacao"] or date.min):
            vistos[num] = reg
    incidentes = list(vistos.values())
    return incidentes, movimentos


def alertas(r: dict) -> list[str]:
    """Inconsistências de lançamento na TPU que afetam a apuração (CNJ e Prêmio interno)."""
    a = []
    if r["data_nao_admissao"]:
        a.append("não admitido (12095): confirmar se o suscitamento pontua SUS")
    if r["especie"] == "IRDR" and not r["data_admissao"] and not r["data_nao_admissao"] and not r["data_tese"]:
        a.append("sem 12094/12095: juízo de admissibilidade não lançado")
    if r["data_transito"] and not r["data_tese"] and not r["data_nao_admissao"]:
        a.append("transitado sem 12257 nem 12095: julgado sem tese registrada?")
    if r["data_tese"] and r["data_suscitamento"] and (r["data_tese"] - r["data_suscitamento"]).days < 30:
        a.append("tese menos de 30 dias após o ajuizamento: conferir lançamento do 12257")
    if r["especie"] == "IRDR" and r["data_tese"] and not r["data_admissao"]:
        a.append("tese sem admissão (12094) lançada")
    g = (r["gabinete"] or "").upper()
    if "GABINETE" not in g:
        a.append("órgão julgador não é gabinete: incidente não atribuível")
    return a
