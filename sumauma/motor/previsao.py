"""Previsão de cumprimento da Meta 1 até o fim do período (19/12, início do recesso).

Ideia: o que falta acontecer = ritmo recente por dia útil × dias úteis que faltam.
Para os julgados, o ritmo recente pode ser corrigido pela sazonalidade observada em
anos anteriores na mesma janela do calendário (sentenças da base da Meta 3, que vem
desde 2021). Cada método é testado contra o passado (backtest) e o erro medido vira a
margem da previsão. Nada aqui usa IA generativa: são contas reproduzíveis.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from statistics import median

FIM_DO_PERIODO = (12, 19)           # 19/12: último dia antes do recesso forense
JANELAS = {"ritmo_4_semanas": 28, "ritmo_8_semanas": 56, "ritmo_do_ano": None}
HORIZONTE_BACKTEST = 35             # dias; parecido com o que falta em novembro
FAIXAS = (30, 150)                  # tamanho esperado: pequeno < 30 <= médio < 150 <= grande


def dias_uteis(inicio: date, fim: date) -> int:
    """Dias de segunda a sexta entre inicio e fim, inclusive. Feriados não são descontados."""
    if fim < inicio:
        return 0
    return sum(1 for i in range((fim - inicio).days + 1) if (inicio + timedelta(i)).weekday() < 5)


def contar_por_dia(linhas, variavel_comeca_com: str, por_unidade: bool = True) -> dict:
    """{unidade: {dia: processos distintos}} para as linhas cuja `var` começa com o texto dado."""
    vistos, cont = set(), defaultdict(lambda: defaultdict(int))
    for l in linhas:
        if not l.get("var", "").lower().startswith(variavel_comeca_com):
            continue
        d = l.get("dt_evento", "")[:10]
        chave = (l.get("id_processo") or l.get("numero"), d)
        if len(d) != 10 or chave in vistos:
            continue
        vistos.add(chave)
        cont[l.get("nome_orgao_julgador", "") if por_unidade else ""][date.fromisoformat(d)] += 1
    return cont


def total(serie: dict, inicio: date, fim: date) -> int:
    return sum(n for d, n in serie.items() if inicio <= d <= fim)


def ritmo(serie: dict, corte: date, janela: int | None, inicio_ano: date) -> float:
    """Eventos por dia útil na janela que termina em `corte` (ou no ano inteiro)."""
    ini = max(inicio_ano, corte - timedelta(janela - 1)) if janela else inicio_ano
    uteis = dias_uteis(ini, corte)
    return total(serie, ini, corte) / uteis if uteis else 0.0


def razao_sazonal(historico: dict, corte: date, fim: date, janela: int = 56) -> float | None:
    """Em anos anteriores: ritmo na janela (corte, fim] ÷ ritmo nas `janela` dias até o corte.

    `historico` é {dia: quantidade} de vários anos. Devolve a mediana entre os anos com dados.
    """
    razoes = []
    for ano in sorted({d.year for d in historico}):
        if ano >= corte.year:
            continue
        try:
            c, f = corte.replace(year=ano), fim.replace(year=ano)
        except ValueError:
            continue
        antes = total(historico, c - timedelta(janela - 1), c) / max(1, dias_uteis(c - timedelta(janela - 1), c))
        depois = total(historico, c + timedelta(1), f) / max(1, dias_uteis(c + timedelta(1), f))
        if antes > 0 and depois > 0:
            razoes.append(depois / antes)
    return median(razoes) if razoes else None


def prever(serie: dict, corte: date, fim: date, metodo: str, historico: dict | None = None) -> float:
    """Quantos eventos devem ocorrer depois de `corte` até `fim`, pelo método dado."""
    inicio_ano = date(corte.year, 1, 1)
    uteis = dias_uteis(corte + timedelta(1), fim)
    if metodo == "ritmo_8_semanas_sazonal":
        r = razao_sazonal(historico or {}, corte, fim)
        return ritmo(serie, corte, 56, inicio_ano) * uteis * (r if r else 1.0)
    return ritmo(serie, corte, JANELAS[metodo], inicio_ano) * uteis


def faixa(previsto: float) -> str:
    return "pequeno" if previsto < FAIXAS[0] else "medio" if previsto < FAIXAS[1] else "grande"


def backtest(series: dict, ultimo_dia: date, metodos: list[str], historico: dict | None = None) -> dict:
    """Testa cada método contra o passado, por unidade, com horizonte de 35 dias.

    Devolve {metodo: {"erro_geral": WAPE, "erro_por_faixa": {faixa: quantil 80% do erro relativo}}}.
    WAPE = soma dos erros absolutos ÷ soma do que realmente aconteceu.
    """
    cortes, c = [], date(ultimo_dia.year, 3, 1)
    while c + timedelta(HORIZONTE_BACKTEST) <= ultimo_dia:
        cortes.append(c)
        c += timedelta(14)
    saida = {}
    for m in metodos:
        soma_erro = soma_real = 0.0
        relativos = defaultdict(list)
        for c in cortes:
            fim = c + timedelta(HORIZONTE_BACKTEST)
            for serie in series.values():
                previsto, real = prever(serie, c, fim, m, historico), total(serie, c + timedelta(1), fim)
                soma_erro += abs(previsto - real)
                soma_real += real
                if previsto > 0:
                    relativos[faixa(previsto)].append(abs(previsto - real) / previsto)
        por_faixa = {}
        for f, erros in relativos.items():
            erros.sort()
            por_faixa[f] = erros[min(len(erros) - 1, int(0.8 * len(erros)))]
        saida[m] = {"erro_geral": soma_erro / soma_real if soma_real else None, "erro_por_faixa": por_faixa, "cortes": len(cortes)}
    return saida


def melhor(resultado: dict) -> str:
    return min(resultado, key=lambda m: resultado[m]["erro_geral"] if resultado[m]["erro_geral"] is not None else 9e9)


def quantil(valores: list[float], q: float) -> float | None:
    if not valores:
        return None
    v = sorted(valores)
    return v[min(len(v) - 1, int(q * len(v)))]


def backtest_cumprimento(novos: dict, julg: dict, ultimo_dia: date, m_novos: str, m_julg: str, historico: dict | None = None) -> dict:
    """Erro, em pontos percentuais, do cumprimento projetado 35 dias à frente.

    Simula a previsão em datas passadas do 2º semestre e compara com o que aconteceu.
    Devolve o erro que não foi superado em 80% das simulações, por faixa de tamanho da
    unidade e para o tribunal inteiro. Suspensos ficam de fora: a base não guarda o
    estoque de suspensos em datas passadas.
    """
    inicio_ano, cortes, c = date(ultimo_dia.year, 1, 1), [], date(ultimo_dia.year, 7, 1)
    while c + timedelta(HORIZONTE_BACKTEST) <= ultimo_dia:
        cortes.append(c)
        c += timedelta(14)

    def erro(sn, sj, c):
        fim = c + timedelta(HORIZONTE_BACKTEST)
        an, aj = total(sn, inicio_ano, c), total(sj, inicio_ano, c)
        pn, pj = prever(sn, c, fim, m_novos), prever(sj, c, fim, m_julg, historico)
        rn, rj = total(sn, c + timedelta(1), fim), total(sj, c + timedelta(1), fim)
        if an + pn <= 0 or an + rn <= 0:
            return None
        return abs((aj + pj) / (an + pn) - (aj + rj) / (an + rn)) * 100, pj

    por_faixa, geral = defaultdict(list), []
    unidades = set(novos) | set(julg)
    soma = lambda series: {d: sum(s.get(d, 0) for s in series.values()) for d in {d for s in series.values() for d in s}}
    tn, tj = soma(novos), soma(julg)
    for c in cortes:
        for u in unidades:
            e = erro(novos.get(u, {}), julg.get(u, {}), c)
            if e:
                por_faixa[faixa(e[1])].append(e[0])
        e = erro(tn, tj, c)
        if e:
            geral.append(e[0])
    return {"por_faixa": {f: quantil(v, 0.8) for f, v in por_faixa.items()}, "tribunal": quantil(geral, 0.8),
            "mediana_unidades": quantil([x for v in por_faixa.values() for x in v], 0.5), "cortes": len(cortes)}


def projetar(casos_novos: int, julgados: int, suspensos: int, dessobrestados: int,
             novos_previstos: float, julgados_previstos: float, margem_pp: float | None, semanas_restantes: float) -> dict:
    """Cumprimento projetado no fim do período, com margem, e o ritmo necessário para cumprir."""
    base_final = casos_novos + novos_previstos + dessobrestados - suspensos
    c = (julgados + julgados_previstos) / base_final * 100 if base_final > 0 else None
    faltam = max(0.0, base_final - julgados)
    m = margem_pp or 0.0
    return {
        "cumprimento": c, "margem_pp": margem_pp,
        "cumprimento_min": c - m if c is not None else None, "cumprimento_max": c + m if c is not None else None,
        "julgados_fim": julgados + julgados_previstos, "casos_novos_fim": casos_novos + novos_previstos,
        "ritmo_atual_semana": julgados_previstos / semanas_restantes if semanas_restantes else 0.0,
        "ritmo_necessario_semana": faltam / semanas_restantes if semanas_restantes else 0.0,
    }


def situacao(p: dict) -> str:
    if p["cumprimento"] is None:
        return "Sem base de cálculo"
    if p["margem_pp"] is None:
        return "Sem histórico para medir a margem"
    if p["cumprimento_min"] >= 100:
        return "Tende a cumprir"
    if p["cumprimento_max"] < 100:
        return "Tende a não cumprir"
    return "Em risco"


def prever_meta1(linhas_meta1, indicadores: list[dict], data_base: date, linhas_meta3=None) -> dict:
    """Previsão da Meta 1 por unidade e para o tribunal.

    `indicadores` é a saída de regras.classificar_meta1 (resumo por unidade).
    """
    ultimo_dia = data_base - timedelta(1)
    fim = date(data_base.year, *FIM_DO_PERIODO)
    novos, julg = contar_por_dia(linhas_meta1, "casos novos"), contar_por_dia(linhas_meta1, "julgad")
    historico = contar_por_dia(linhas_meta3, "sentencas", por_unidade=False).get("", {}) if linhas_meta3 else {}
    metodos_julg = list(JANELAS) + (["ritmo_8_semanas_sazonal"] if historico else [])
    bt_novos, bt_julg = backtest(novos, ultimo_dia, list(JANELAS)), backtest(julg, ultimo_dia, metodos_julg, historico)
    m_novos, m_julg = melhor(bt_novos), melhor(bt_julg)
    uteis = dias_uteis(data_base, fim)
    semanas = uteis / 5
    bt_c = backtest_cumprimento(novos, julg, ultimo_dia, m_novos, m_julg, historico)

    def um(nome, serie_n, serie_j, ind):
        pn = prever(serie_n, ultimo_dia, fim, m_novos) if uteis else 0.0
        pj = prever(serie_j, ultimo_dia, fim, m_julg, historico) if uteis else 0.0
        margem = bt_c["tribunal"] if nome is None else bt_c["por_faixa"].get(faixa(pj))
        p = projetar(ind["distribuidos"], ind["julgados"], ind["suspensos"], ind["detalhes"]["dessobrestados"], pn, pj, margem, semanas)
        return dict(p, unidade=nome, situacao=situacao(p))

    por_unidade = [um(i["unidade"], novos.get(i["unidade"], {}), julg.get(i["unidade"], {}), i) for i in indicadores]
    soma = lambda series: {d: sum(s.get(d, 0) for s in series.values()) for d in {d for s in series.values() for d in s}}
    geral = {"distribuidos": sum(i["distribuidos"] for i in indicadores), "julgados": sum(i["julgados"] for i in indicadores),
             "suspensos": sum(i["suspensos"] for i in indicadores),
             "detalhes": {"dessobrestados": sum(i["detalhes"]["dessobrestados"] for i in indicadores)}}
    return {"tribunal": um(None, soma(novos), soma(julg), geral), "unidades": por_unidade,
            "metodo_novos": m_novos, "metodo_julgados": m_julg, "backtest_novos": bt_novos, "backtest_julgados": bt_julg, "backtest_cumprimento": bt_c,
            "fim": fim, "dias_uteis_restantes": uteis, "razao_sazonal": razao_sazonal(historico, ultimo_dia, fim) if historico else None}
