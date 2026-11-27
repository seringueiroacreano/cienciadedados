"""Regras de pontuação de IRDR e IAC — Portaria PRESI nº 1.961/2026 (alterada pela nº 4.335/2026).

Fiel à "Matriz de Aferição IRDR/IAC TJAC 2026" (aba Gabinetes, quadro REGRAS DE AFERIÇÃO):
  * SUS  = 10 pontos: suscitamento OU admissão (o marco documentado escolhido) dentro do período;
           conta uma vez por incidente (Anexo IV, item 18).
  * TESE = 25 pontos: julgamento com tese fixada dentro do período (Anexo IV, item 18).
  * O mesmo incidente pode somar SUS e TESE (máximo 35).
  * Por gabinete entram só os 2 incidentes de maior pontuação (Anexo I, item E) -> teto de 70.
  * Empate: vale a ordem das linhas da matriz (a pontuação final não muda).
  * Período: 01/01 a 30/11/2026; a aferição parcial corta na data de corte (Anexos II e III).
  * Presidência, Vice-Presidência e Corregedoria-Geral ficam fora do escopo.
"""
from dataclasses import dataclass
from datetime import date

PONTOS_SUS = 10
PONTOS_TESE = 25
MAX_INCIDENTES = 2
INICIO = date(2026, 1, 1)
ENCERRAMENTO = date(2026, 11, 30)
FORA_DO_ESCOPO = ("PRESID", "VICE-PRESID", "CORREGEDOR")


@dataclass
class Incidente:
    ordem: int                      # linha na matriz (desempate)
    numero: str
    especie: str                    # IRDR ou IAC
    gabinete: str
    data_suscitamento: date | None = None
    data_admissao: date | None = None
    marco_sus: str | None = None    # "Suscitamento" ou "Admissão"
    data_julgamento: date | None = None
    tese_fixada: bool = False
    evidencia_sus: str | None = None
    evidencia_julgamento: str | None = None


def fim_do_periodo(corte: date | None) -> date:
    return min(corte, ENCERRAMENTO) if corte else ENCERRAMENTO


def no_periodo(d: date | None, corte: date | None) -> bool:
    return d is not None and INICIO <= d <= fim_do_periodo(corte)


def data_sus(i: Incidente) -> date | None:
    """Data do marco SUS adotado. Sem marco declarado, usa o primeiro ato documentado."""
    marco = (i.marco_sus or "").strip().lower()
    if marco.startswith("susc"):
        return i.data_suscitamento
    if marco.startswith("adm"):
        return i.data_admissao
    datas = [d for d in (i.data_suscitamento, i.data_admissao) if d]
    return min(datas) if datas else None


def sus_elegivel(i: Incidente, corte: date | None) -> bool:
    return no_periodo(data_sus(i), corte) and bool(i.evidencia_sus)


def tese_elegivel(i: Incidente, corte: date | None) -> bool:
    return i.tese_fixada and no_periodo(i.data_julgamento, corte) and bool(i.evidencia_julgamento)


def pendencias(i: Incidente) -> list[str]:
    """Conferência do registro: o que impede o incidente de pontuar com segurança."""
    p = []
    if (i.especie or "").upper() not in ("IRDR", "IAC"):
        p.append("espécie diferente de IRDR/IAC")
    if not i.numero:
        p.append("sem número do processo")
    if data_sus(i) is None and i.data_julgamento is None:
        p.append("sem data de ato")
    if data_sus(i) and not i.evidencia_sus:
        p.append("SUS sem evidência")
    if i.tese_fixada and not i.evidencia_julgamento:
        p.append("tese sem evidência do julgamento")
    if i.tese_fixada and i.data_julgamento is None:
        p.append("tese sem data de julgamento")
    return p


def pontuar(incidentes: list[Incidente], corte: date | None) -> list[dict]:
    """Uma linha por incidente com SUS, TESE, potencial, ordem no gabinete e seleção (top 2)."""
    linhas = []
    for i in incidentes:
        sus = int(sus_elegivel(i, corte))
        tese = int(tese_elegivel(i, corte))
        linhas.append({
            "ordem": i.ordem, "numero": i.numero, "especie": (i.especie or "").upper(),
            "gabinete": i.gabinete, "data_sus": data_sus(i), "data_julgamento": i.data_julgamento,
            "sus": sus, "tese": tese, "potencial": sus * PONTOS_SUS + tese * PONTOS_TESE,
            "pendencias": "; ".join(pendencias(i)),
        })
    por_gab: dict[str, list[dict]] = {}
    for l in linhas:
        por_gab.setdefault(l["gabinete"], []).append(l)
    for grupo in por_gab.values():
        grupo.sort(key=lambda l: (-l["potencial"], l["ordem"]))
        for pos, l in enumerate(grupo, start=1):
            l["ordem_no_gabinete"] = pos
            l["selecionado"] = int(pos <= MAX_INCIDENTES and l["potencial"] > 0)
            l["pontos_sus"] = l["sus"] * PONTOS_SUS * l["selecionado"]
            l["pontos_tese"] = l["tese"] * PONTOS_TESE * l["selecionado"]
            l["total"] = l["pontos_sus"] + l["pontos_tese"]
    return sorted(linhas, key=lambda l: l["ordem"])


def fora_do_escopo(gabinete: str) -> bool:
    g = (gabinete or "").upper()
    return any(t in g for t in FORA_DO_ESCOPO)


def situacao(elegivel: bool, manifestacao: str | None, registros: int, pend: int, total: int) -> str:
    """Situação da aferição do gabinete (mesmos rótulos da matriz)."""
    if not elegivel:
        return "Fora do escopo"
    m = (manifestacao or "").strip().lower()
    if not m:
        return "Aguardando manifestação ou fonte"
    if m.startswith("sem registro"):
        return "Sem registros no período" if registros == 0 else "Conflito: 'Sem registros' com incidentes"
    if registros == 0:
        return "Aguardando incidentes"
    if pend:
        return "Registros em conferência"
    return "Aferido" if total else "Aferido sem pontuação"
