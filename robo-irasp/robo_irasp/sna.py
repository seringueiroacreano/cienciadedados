"""SNA: lê os rankings dos painéis públicos do Metabase da COGER/TJAC e pontua (Anexo IV, item 6)."""
import unicodedata

from .rede import obter_json

LINHA_MEDIA = ">> media tjac <<"


def normalizar(texto):
    """Minúsculo, sem acentos e com 'ª'/'º' trocados por 'a'/'o' (para casar nomes de unidades)."""
    texto = (texto or "").replace("ª", "a").replace("º", "o")
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return " ".join(texto.lower().split())


def pontuar(componente, percentual, faixas):
    """Aplica as faixas do componente ao percentual (0–100). Devolve os pontos."""
    if percentual is None:
        return 0
    pct = round(float(percentual), 2)
    for faixa in faixas[componente]:
        minimo = faixa["minimo"]
        atingiu = pct > minimo if faixa.get("estrito") else pct >= minimo
        if atingiu:
            return faixa["pontos"]
    return 0


def _card(cfg, painel, par):
    dashcard, card = par
    url = f"{cfg['metabase']}/api/public/dashboard/{painel['dashboard']}/dashcard/{dashcard}/card/{card}"
    return obter_json(url)


def ler_ranking(resposta):
    """Converte a resposta do Metabase em lista de dicts {unidade, percentual, total, pendencias}."""
    linhas = []
    for unidade, percentual, total, pendencias in resposta["data"]["rows"]:
        linhas.append(
            {"unidade": unidade, "percentual": percentual, "total": total, "pendencias": pendencias}
        )
    return linhas


def coletar(cfg):
    """Baixa ranking e data de atualização de cada painel. Devolve {componente: {...}}."""
    brutos = {}
    for componente, painel in cfg["paineis"].items():
        ranking = ler_ranking(_card(cfg, painel, painel["ranking"]))
        try:
            atualizado = _card(cfg, painel, painel["atualizacao"])["data"]["rows"][0][0]
        except Exception:  # a data é informativa; não derruba a coleta
            atualizado = None
        brutos[componente] = {"ranking": ranking, "atualizado_em": atualizado}
    return brutos


def calcular(cfg, brutos):
    """Pontua cada unidade.

    Regra de aplicabilidade: a unidade que aparece no ranking do painel tem acervo no
    componente (aplicável). A que não aparece fica com "-" (não se aplica).
    Devolve (pontos, memoria, estadual, alertas):
      pontos[mpm][componente] = int ou "-"
      memoria = linhas com o valor bruto que gerou cada ponto
      estadual[componente] = linha ">> MÉDIA TJAC <<" pontuada
    """
    mapa = {normalizar(k): v for k, v in cfg["unidades"].items()}
    todas = sorted(set(mapa.values()))
    pontos = {mpm: {c: "-" for c in brutos} for mpm in todas}
    memoria, estadual, alertas = [], {}, []

    for componente, dados in brutos.items():
        for linha in dados["ranking"]:
            nome = normalizar(linha["unidade"])
            pts = pontuar(componente, linha["percentual"], cfg["faixas"])
            if nome == LINHA_MEDIA:
                estadual[componente] = {**linha, "pontos": pts, "atualizado_em": dados["atualizado_em"]}
                continue
            mpm = mapa.get(nome)
            if mpm is None:
                alertas.append(
                    f"{componente}: unidade '{linha['unidade']}' do Metabase sem Código MPM em config.json; ignorada."
                )
                continue
            if not linha["total"]:
                continue
            pontos[mpm][componente] = pts
            memoria.append(
                {
                    "Código MPM": mpm,
                    "Componente": componente,
                    "Unidade na fonte": linha["unidade"],
                    "Percentual": round(float(linha["percentual"]), 2),
                    "Quantidade": linha["total"],
                    "Pendências": linha["pendencias"],
                    "Pontos": pts,
                    "Fonte atualizada em": dados["atualizado_em"],
                }
            )
    return pontos, memoria, estadual, alertas
