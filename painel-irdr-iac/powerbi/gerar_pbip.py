"""Gera o projeto Power BI (PBIP) do Painel IRDR e IAC, no padrão visual da Plataforma de Gestão de Dados do TJAC.

Uso:  python powerbi/gerar_pbip.py [pasta_destino]          (padrão: powerbi/pbip)
      python powerbi/gerar_pbip.py --validar PASTA_SCHEMAS    (valida o relatório nos schemas PBIR da Microsoft)

Saída: Painel_IRDR_IAC.pbip  +  Painel_IRDR_IAC.SemanticModel/ (TMDL)  +  Painel_IRDR_IAC.Report/ (PBIR)
Fonte única: API Pública do DataJud (CNJ) — atualização no Power BI Service sem gateway.
"""
import json
import shutil
import sys
import uuid
from pathlib import Path

NOME = "Painel_IRDR_IAC"
AQUI = Path(__file__).resolve().parent
SCH = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition"
W, H = 1280, 720

# Paleta da Plataforma de Gestão de Dados (painel de referência "Judicialização da Saúde")
COR = {"fundo": "#EEF1F6", "card": "#FFFFFF", "titulo": "#4A4A4A", "texto": "#3C3C3C", "borda": "#E1E5EC",
       "vermelho": "#EF5B5B", "amarelo": "#F5C518", "verde": "#1FC7A3", "vinho": "#8B1E2D", "cinza": "#8A8F98"}

# 11 gabinetes da Matriz SEJUD 2026 (chave = trecho único do nome no DataJud)
GABINETES = [
    ("DENISE", "Des.ª Denise Bonfim", "GABINETE DA DES.ª DENISE CASTELO BONFIM"),
    ("REGINA", "Des.ª Regina Longuini", "GABINETE DA DES.ª REGINA CÉLIA FERRARI LONGUINI"),
    ("WALDIRENE", "Des.ª Waldirene Cordeiro", "GABINETE DA DES.ª WALDIRENE OLIVEIRA DA CRUZ LIMA CORDEIRO"),
    ("ELCIO", "Des. Elcio Mendes", "GABINETE DO DES. ELCIO SABO MENDES JÚNIOR"),
    ("DJALMA", "Des. Francisco Djalma", "GABINETE DO DES. FRANCISCO DJALMA DA SILVA"),
    ("ALBERTO RIBEIRO", "Des. Júnior Alberto", "GABINETE DO DES. JÚNIOR ALBERTO RIBEIRO"),
    ("LAUDIVON", "Des. Laudivon Nogueira", "GABINETE DO DES. LAUDIVON DE OLIVEIRA NOGUEIRA"),
    ("LOIS", "Des. Lois Arruda", "GABINETE DO DES. LOIS CARLOS ARRUDA"),
    ("CAMOLEZ", "Des. Luís Camolez", "GABINETE DO DES. LUÍS VITÓRIO CAMOLEZ"),
    ("RAIMUNDO NONATO", "Des. Raimundo Maia", "GABINETE DO DES. RAIMUNDO NONATO DA COSTA MAIA"),
    ("ROBERTO BARROS", "Des. Roberto Barros", "GABINETE DO DES. ROBERTO BARROS DOS SANTOS"),
]


def gid(*partes) -> str:
    """GUID estável (o mesmo a cada geração) para não sujar o diff do git."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "tjac/irdr-iac/" + "/".join(partes)))


def nid(*partes) -> str:
    return gid(*partes).replace("-", "")[:20]


# =============================================================== MODELO SEMÂNTICO (TMDL)
def m_bloco(codigo: str, tabs: int) -> str:
    pre = "\t" * tabs
    return "\n".join(pre + l if l.strip() else "" for l in codigo.strip("\n").splitlines())


M_POST = r'''
(corpo as record) as record =>
let
    Tentar = (n as number) as record =>
        let
            Resp = Web.Contents("https://api-publica.datajud.cnj.jus.br",
                [RelativePath = "api_publica_tjac/_search",
                 Headers = [Authorization = "APIKey " & DataJud_Chave, #"Content-Type" = "application/json"],
                 Content = Json.FromValue(corpo),
                 ManualStatusHandling = {429, 500, 502, 503, 504},
                 Timeout = #duration(0, 0, 5, 0),
                 IsRetry = n > 0]),
            Json = try Json.Document(Resp) otherwise [],
            Ok = Record.HasFields(Json, "hits")
        in
            if Ok then Json
            else if n >= 5 then error "DataJud indisponível (429/5xx) após 6 tentativas"
            else Function.InvokeAfter(() => @Tentar(n + 1), #duration(0, 0, 0, 20 * (n + 1)))
in
    Tentar(0)
'''

M_BRUTO = r'''
let
    R = DataJud_Post([size = 1000, query = [terms = [classe.codigo = {12085, 12087}]]]),
    Hits = List.Transform(R[hits][hits], each [_source]),
    // datas do DataJud: "2026051100", "20260511000000" ou ISO "2026-05-11T00:00:00.000Z"
    Dt = (v) => if v = null then null else
            let t = Text.From(v) in
            if Text.Middle(t, 4, 1) = "-" then Date.FromText(Text.Start(t, 10), [Format = "yyyy-MM-dd"])
            else #date(Number.From(Text.Start(t, 4)), Number.From(Text.Middle(t, 4, 2)), Number.From(Text.Middle(t, 6, 2))),
    Linhas = List.Transform(Hits, (s) => [
        numero = s[numeroProcesso],
        classe = s[classe][codigo],
        especie = if s[classe][codigo] = 12085 then "IRDR" else "IAC",
        grau = s[grau],
        orgao_julgador = s[orgaoJulgador][nome],
        data_suscitamento = Dt(s[dataAjuizamento]),
        ultima_atualizacao = Dt(Record.FieldOrDefault(s, "dataHoraUltimaAtualizacao", null)),
        movimentos = List.Transform(Record.FieldOrDefault(s, "movimentos", {}),
                        each [codigo = [codigo], movimento = [nome], data = Dt([dataHora])])
    ]),
    Tabela = Table.FromRecords(Linhas),
    // o DataJud pode repetir o processo: fica a versão mais recente
    Unico = Table.Distinct(Table.Sort(Tabela, {{"ultima_atualizacao", Order.Descending}}), {"numero"})
in
    Unico
'''

M_CARGA = r'''
let
    R = DataJud_Post([size = 0, aggs = [u = [max = [field = "dataHoraUltimaAtualizacao"]]]]),
    Ultima = DateTimeZone.FromText(R[aggregations][u][value_as_string]),
    Agora = DateTimeZone.SwitchZone(DateTimeZone.UtcNow(), -5),          // horário do Acre (UTC-5)
    FimApuracao = List.Min({Periodo_Fim, Date.From(DateTimeZone.SwitchZone(Ultima, -5))}),
    Tabela = #table(
        type table [ultima_carga_datajud = datetime, atualizado_em = datetime, inicio_apuracao = date, fim_apuracao = date],
        {{DateTime.From(DateTimeZone.SwitchZone(Ultima, -5)), DateTime.From(Agora), Periodo_Inicio, FimApuracao}})
in
    Tabela
'''

M_GABINETE = "let\n    Fonte = #table(\n        type table [chave = text, gabinete = text, gabinete_nome_completo = text, elegivel = logical, ordem = Int64.Type],\n        {\n" + ",\n".join(
    f'            {{"{c}", "{n}", "{f}", true, {i}}}' for i, (c, n, f) in enumerate(GABINETES, 1)
) + ',\n            {"FORA DA MATRIZ", "Fora da matriz", "Órgão sem gabinete na Matriz SEJUD 2026", false, 99}\n        })\nin\n    Fonte'

M_INCIDENTE = r'''
let
    Inicio = dCarga{0}[inicio_apuracao],
    Fim = dCarga{0}[fim_apuracao],
    Chaves = List.Select(dGabinete[chave], each _ <> "FORA DA MATRIZ"),
    PrimeiroMov = (movs as list, cod as number) =>
        List.Min(List.Transform(List.Select(movs, each [codigo] = cod), each [data])),
    A = Table.AddColumn(DataJud_Bruto, "data_admissao", each PrimeiroMov([movimentos], 12094), type date),
    B = Table.AddColumn(A, "data_nao_admissao", each PrimeiroMov([movimentos], 12095), type date),
    C = Table.AddColumn(B, "data_tese", each PrimeiroMov([movimentos], 12257), type date),
    D = Table.AddColumn(C, "data_transito", each PrimeiroMov([movimentos], 848), type date),
    Chave = Table.AddColumn(D, "chave_gabinete", each
            List.First(List.Select(Chaves, (k) => Text.Contains(Text.Upper([orgao_julgador]), k)), "FORA DA MATRIZ"), type text),
    Proc = Table.AddColumn(Chave, "processo", each
            let n = Text.PadStart([numero], 20, "0") in
            Text.Start(n, 7) & "-" & Text.Middle(n, 7, 2) & "." & Text.Middle(n, 9, 4) & "." & Text.Middle(n, 13, 1)
            & "." & Text.Middle(n, 14, 2) & "." & Text.Middle(n, 16, 4), type text),
    Ano = Table.AddColumn(Proc, "ano_suscitamento", each Date.Year([data_suscitamento]), Int64.Type),
    Sus = Table.AddColumn(Ano, "sus", each if [data_suscitamento] <> null and [data_suscitamento] >= Inicio
            and [data_suscitamento] <= Fim then 1 else 0, Int64.Type),
    Tese = Table.AddColumn(Sus, "tese", each if [data_tese] <> null and [data_tese] >= Inicio
            and [data_tese] <= Fim then 1 else 0, Int64.Type),
    Pot = Table.AddColumn(Tese, "potencial", each 10 * [sus] + 25 * [tese], Int64.Type),
    Situacao = Table.AddColumn(Pot, "situacao_tpu", each
            if [data_tese] <> null then "Tese fixada (12257)"
            else if [data_nao_admissao] <> null then "Não admitido (12095)"
            else if [data_admissao] <> null then "Admitido (12094)"
            else "Sem juízo de admissibilidade", type text),
    Alertas = Table.AddColumn(Situacao, "alertas", each Text.Combine(List.RemoveNulls({
            if [data_nao_admissao] <> null then "Não admitido: confirmar se o suscitamento pontua SUS" else null,
            if [especie] = "IRDR" and [data_admissao] = null and [data_nao_admissao] = null and [data_tese] = null
                then "Sem 12094/12095: admissibilidade não lançada" else null,
            if [data_transito] <> null and [data_tese] = null and [data_nao_admissao] = null
                then "Transitado sem 12257: tese não registrada?" else null,
            if [data_tese] <> null and [data_suscitamento] <> null and Duration.Days([data_tese] - [data_suscitamento]) < 30
                then "Tese < 30 dias do ajuizamento: conferir 12257" else null,
            if [chave_gabinete] = "FORA DA MATRIZ" then "Órgão fora da Matriz SEJUD" else null}), "; "), type text),
    // Portaria PRESI 1.961/2026, Anexo I, item E: os 2 incidentes de maior pontuação por gabinete
    Ord = Table.Sort(Alertas, {{"chave_gabinete", Order.Ascending}, {"potencial", Order.Descending},
                               {"data_suscitamento", Order.Ascending}, {"numero", Order.Ascending}}),
    Grupo = Table.Group(Ord, {"chave_gabinete"}, {{"t", each Table.AddIndexColumn(_, "ordem_no_gabinete", 1, 1, Int64.Type)}}),
    Junta = Table.Combine(Grupo[t]),
    Sel = Table.AddColumn(Junta, "selecionado", each
            if [ordem_no_gabinete] <= 2 and [potencial] > 0 and [chave_gabinete] <> "FORA DA MATRIZ" then 1 else 0, Int64.Type),
    Total = Table.AddColumn(Sel, "pontos", each [potencial] * [selecionado], Int64.Type),
    Final = Table.RemoveColumns(Total, {"movimentos"}),
    // Table.Group/Combine descartam os tipos: retipa tudo
    Tipos = Table.TransformColumnTypes(Final, {{"numero", type text}, {"classe", Int64.Type}, {"especie", type text},
              {"grau", type text}, {"orgao_julgador", type text}, {"data_suscitamento", type date},
              {"ultima_atualizacao", type date}, {"data_admissao", type date}, {"data_nao_admissao", type date},
              {"data_tese", type date}, {"data_transito", type date}, {"chave_gabinete", type text},
              {"processo", type text}, {"ano_suscitamento", Int64.Type}, {"sus", Int64.Type}, {"tese", Int64.Type},
              {"potencial", Int64.Type}, {"situacao_tpu", type text}, {"alertas", type text},
              {"ordem_no_gabinete", Int64.Type}, {"selecionado", Int64.Type}, {"pontos", Int64.Type}})
in
    Tipos
'''

M_MOVIMENTO = r'''
let
    T = Table.ExpandListColumn(Table.SelectColumns(DataJud_Bruto, {"numero", "movimentos"}), "movimentos"),
    E = Table.ExpandRecordColumn(T, "movimentos", {"codigo", "movimento", "data"}),
    SemVazio = Table.SelectRows(E, each [codigo] <> null),
    Param = Table.AddColumn(SemVazio, "parametrizado", each
        if [codigo] = 12094 then "Admissão (12094)" else if [codigo] = 12095 then "Não admissão (12095)"
        else if [codigo] = 12257 then "Definição de tese (12257)" else if [codigo] = 14985 then "Levantamento (14985)"
        else if [codigo] = 12098 then "Suspensão por IRDR (12098)" else if [codigo] = 848 then "Trânsito em julgado"
        else if [codigo] = 26 then "Distribuição" else "Outros", type text),
    Tipos = Table.TransformColumnTypes(Param, {{"numero", type text}, {"codigo", Int64.Type},
              {"movimento", type text}, {"data", type date}})
in
    Tipos
'''

# (tabela, coluna, tipo, formato, resumo, oculta)
COLUNAS = {
    "dCarga": [("ultima_carga_datajud", "dateTime", "dd/mm/yyyy hh:mm"), ("atualizado_em", "dateTime", "dd/mm/yyyy hh:mm:ss"),
               ("inicio_apuracao", "dateTime", "dd/mm/yyyy"), ("fim_apuracao", "dateTime", "dd/mm/yyyy")],
    "dGabinete": [("chave", "string", None), ("gabinete", "string", None), ("gabinete_nome_completo", "string", None),
                  ("elegivel", "boolean", None), ("ordem", "int64", "0")],
    "fIncidente": [("numero", "string", None), ("classe", "int64", "0"), ("especie", "string", None), ("grau", "string", None),
                   ("orgao_julgador", "string", None), ("data_suscitamento", "dateTime", "dd/mm/yyyy"),
                   ("ultima_atualizacao", "dateTime", "dd/mm/yyyy"), ("data_admissao", "dateTime", "dd/mm/yyyy"),
                   ("data_nao_admissao", "dateTime", "dd/mm/yyyy"), ("data_tese", "dateTime", "dd/mm/yyyy"),
                   ("data_transito", "dateTime", "dd/mm/yyyy"), ("chave_gabinete", "string", None),
                   ("processo", "string", None), ("ano_suscitamento", "int64", "0"), ("sus", "int64", "0"),
                   ("tese", "int64", "0"), ("potencial", "int64", "0"), ("situacao_tpu", "string", None),
                   ("alertas", "string", None), ("ordem_no_gabinete", "int64", "0"), ("selecionado", "int64", "0"),
                   ("pontos", "int64", "0")],
    "fMovimento": [("numero", "string", None), ("codigo", "int64", "0"), ("movimento", "string", None),
                   ("data", "dateTime", "dd/mm/yyyy"), ("parametrizado", "string", None)],
}
PARTICOES = {"dCarga": M_CARGA, "dGabinete": M_GABINETE, "fIncidente": M_INCIDENTE, "fMovimento": M_MOVIMENTO}

MEDIDAS = [  # (nome, DAX, formato, pasta)
    ("Incidentes", "DISTINCTCOUNT ( fIncidente[numero] )", "0", "Incidentes"),
    ("Incidentes no Período", "CALCULATE ( [Incidentes], fIncidente[sus] = 1 )", "0", "Incidentes"),
    ("Eventos SUS", "SUM ( fIncidente[sus] )", "0", "Incidentes"),
    ("Eventos TESE", "SUM ( fIncidente[tese] )", "0", "Incidentes"),
    ("Incidentes com Alerta", 'CALCULATE ( [Incidentes], fIncidente[alertas] <> "" )', "0", "Incidentes"),
    ("Pontos SUS", "SUMX ( fIncidente, 10 * fIncidente[sus] * fIncidente[selecionado] )", "0", "Pontuação"),
    ("Pontos TESE", "SUMX ( fIncidente, 25 * fIncidente[tese] * fIncidente[selecionado] )", "0", "Pontuação"),
    ("Pontos", "SUM ( fIncidente[pontos] ) + 0", "0", "Pontuação"),
    ("Teto", "70 * CALCULATE ( COUNTROWS ( dGabinete ), dGabinete[elegivel] = TRUE () )", "0", "Pontuação"),
    ("% do Teto", "DIVIDE ( [Pontos], [Teto] )", "0.0%", "Pontuação"),
    ("Pontos Não Computados", "SUM ( fIncidente[potencial] ) - [Pontos]", "0", "Pontuação"),
    ("Gabinetes Pontuando", 'COUNTROWS ( FILTER ( VALUES ( dGabinete[gabinete] ), [Pontos] > 0 ) ) + 0', "0", "Pontuação"),
    ("Atualizado", '"Atualizado: " & FORMAT ( MAX ( dCarga[atualizado_em] ), "dd/mm/yyyy hh:mm:ss" )', None, "Rótulos"),
    ("Carga DataJud", '"Última carga do TJAC no DataJud: " & FORMAT ( MAX ( dCarga[ultima_carga_datajud] ), "dd/mm/yyyy" )'
     ' & "  ·  Apuração até " & FORMAT ( MAX ( dCarga[fim_apuracao] ), "dd/mm/yyyy" )', None, "Rótulos"),
]


def tmdl_modelo(base: Path):
    d = base / f"{NOME}.SemanticModel"
    (d / "definition" / "tables").mkdir(parents=True, exist_ok=True)
    (d / "definition.pbism").write_text(json.dumps({"version": "4.0", "settings": {}}, indent=2), encoding="utf-8")
    (d / ".platform").write_text(json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "SemanticModel", "displayName": NOME},
        "config": {"version": "2.0", "logicalId": gid("modelo")}}, indent=2), encoding="utf-8")
    (d / "definition" / "database.tmdl").write_text("database\n\tcompatibilityLevel: 1567\n\n", encoding="utf-8")
    ordem = ["DataJud_Chave", "Periodo_Inicio", "Periodo_Fim", "DataJud_Post", "DataJud_Bruto"] + list(PARTICOES)
    tabelas = "\n".join(f"ref table {t}" for t in PARTICOES)
    (d / "definition" / "model.tmdl").write_text(
        "model Model\n\tculture: pt-BR\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tsourceQueryCulture: pt-BR\n"
        "\tdataAccessOptions\n\t\tlegacyRedirects\n\t\treturnErrorValuesAsNull\n\n"
        f"annotation PBI_QueryOrder = {json.dumps(ordem)}\n\nannotation __PBI_TimeIntelligenceEnabled = 0\n\n"
        f"annotation PBI_ProTooling = [\"DevMode\"]\n\n{tabelas}\n\n", encoding="utf-8")

    chave = '"cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="'
    exp = [
        f'expression DataJud_Chave = {chave} meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n'
        f'\tlineageTag: {gid("e", "chave")}\n\tqueryGroup: Parâmetros\n\n\tannotation PBI_ResultType = Text\n',
        'expression Periodo_Inicio = #date(2026, 1, 1) meta [IsParameterQuery=true, Type="Date", IsParameterQueryRequired=true]\n'
        f'\tlineageTag: {gid("e", "ini")}\n\tqueryGroup: Parâmetros\n\n\tannotation PBI_ResultType = Date\n',
        'expression Periodo_Fim = #date(2026, 11, 30) meta [IsParameterQuery=true, Type="Date", IsParameterQueryRequired=true]\n'
        f'\tlineageTag: {gid("e", "fim")}\n\tqueryGroup: Parâmetros\n\n\tannotation PBI_ResultType = Date\n',
        f'expression DataJud_Post =\n{m_bloco(M_POST, 2)}\n\tlineageTag: {gid("e", "post")}\n\tqueryGroup: DataJud\n\n'
        '\tannotation PBI_ResultType = Function\n',
        f'expression DataJud_Bruto =\n{m_bloco(M_BRUTO, 2)}\n\tlineageTag: {gid("e", "bruto")}\n\tqueryGroup: DataJud\n\n'
        '\tannotation PBI_ResultType = Table\n\n\tannotation PBI_NavigationStepName = Navegação\n',
    ]
    (d / "definition" / "expressions.tmdl").write_text("\n".join(exp) + "\n", encoding="utf-8")

    for t, cols in COLUNAS.items():
        linhas = [f"table {t}", f"\tlineageTag: {gid('t', t)}", ""]
        if t == "fIncidente":
            for nome, dax, fmt, pasta in MEDIDAS:
                linhas += [f"\tmeasure '{nome}' = {dax}"]
                if fmt:
                    linhas += [f"\t\tformatString: {fmt}"]
                linhas += [f"\t\tdisplayFolder: {pasta}", f"\t\tlineageTag: {gid('m', nome)}", ""]
        for c, tipo, fmt in cols:
            linhas += [f"\tcolumn {c}", f"\t\tdataType: {tipo}"]
            if fmt:
                linhas += [f"\t\tformatString: {fmt}"]
            linhas += [f"\t\tlineageTag: {gid('c', t, c)}", "\t\tsummarizeBy: none", f"\t\tsourceColumn: {c}", "",
                       "\t\tannotation SummarizationSetBy = Automatic", ""]
            if tipo == "dateTime":
                linhas[-1:-1] = ["\t\tannotation UnderlyingDateTimeDataType = Date" if fmt == "dd/mm/yyyy"
                                 else "\t\tannotation UnderlyingDateTimeDataType = DateTime", ""]
        linhas += [f"\tpartition {t} = m", "\t\tmode: import", "\t\tsource =", m_bloco(PARTICOES[t], 4), "",
                   "\tannotation PBI_ResultType = Table", ""]
        (d / "definition" / "tables" / f"{t}.tmdl").write_text("\n".join(linhas) + "\n", encoding="utf-8")

    rels = [("fIncidente", "chave_gabinete", "dGabinete", "chave"), ("fMovimento", "numero", "fIncidente", "numero")]
    txt = []
    for de, cde, para, cpara in rels:
        txt += [f"relationship {gid('r', de, para)}"]
        if para == "fIncidente":   # 1 incidente : N movimentos; filtra nos dois sentidos para o slicer de gabinete
            txt += ["\tcrossFilteringBehavior: bothDirections"]
        txt += [f"\tfromColumn: {de}.{cde}", f"\ttoColumn: {para}.{cpara}", ""]
    (d / "definition" / "relationships.tmdl").write_text("\n".join(txt) + "\n", encoding="utf-8")


# =============================================================== RELATÓRIO (PBIR)
def lit(v):
    if isinstance(v, bool):
        return {"expr": {"Literal": {"Value": "true" if v else "false"}}}
    if isinstance(v, (int, float)):
        return {"expr": {"Literal": {"Value": f"{v}D"}}}
    return {"expr": {"Literal": {"Value": f"'{v}'"}}}


def cor(h):
    return {"solid": {"color": lit(h)}}


def col(t, c):
    return {"Column": {"Expression": {"SourceRef": {"Entity": t}}, "Property": c}}


def med(t, m):
    return {"Measure": {"Expression": {"SourceRef": {"Entity": t}}, "Property": m}}


def proj(campo, nome=None):
    tipo = "Measure" if "Measure" in campo else "Column"
    p = {"field": campo, "queryRef": f"{campo[tipo]['Expression']['SourceRef']['Entity']}.{campo[tipo]['Property']}"}
    if nome:
        p["displayName"] = nome
    return p


def moldura(titulo=None, fundo=COR["card"], raio=12, sombra=True, tam_titulo=12):
    o = {"background": [{"properties": {"show": lit(True), "color": cor(fundo), "transparency": lit(0)}}],
         "border": [{"properties": {"show": lit(True), "color": cor(COR["borda"]), "radius": lit(raio)}}],
         "dropShadow": [{"properties": {"show": lit(sombra), "color": cor("#B8C0CC"), "transparency": lit(70),
                                        "position": lit("Outer"), "preset": lit("BottomRight")}}],
         "padding": [{"properties": {"top": lit(8), "bottom": lit(8), "left": lit(10), "right": lit(10)}}]}
    o["title"] = [{"properties": {"show": lit(bool(titulo)), **({"text": lit(titulo), "fontSize": lit(tam_titulo),
                   "bold": lit(True), "fontColor": cor(COR["texto"]), "alignment": lit("center")} if titulo else {})}}]
    return o


class Pagina:
    def __init__(self, nome, titulo, raiz):
        self.nome, self.titulo, self.z = nome, titulo, 0
        self.dir = raiz / "pages" / nome
        (self.dir / "visuals").mkdir(parents=True, exist_ok=True)

    def visual(self, chave, x, y, w, h, visual, container=None, oculto=False):
        self.z += 1000
        v = {"$schema": f"{SCH}/visualContainer/1.0.0/schema.json", "name": nid(self.nome, chave),
             "position": {"x": x, "y": y, "z": self.z, "width": w, "height": h, "tabOrder": self.z}, "visual": visual}
        if container:
            v["visual"]["visualContainerObjects"] = container
        d = self.dir / "visuals" / v["name"]
        d.mkdir(exist_ok=True)
        (d / "visual.json").write_text(json.dumps(v, ensure_ascii=False, indent=2), encoding="utf-8")

    def salvar(self):
        p = {"$schema": f"{SCH}/page/1.0.0/schema.json", "name": self.nome, "displayName": self.titulo,
             "displayOption": "FitToPage", "height": H, "width": W,
             "objects": {"background": [{"properties": {"color": cor(COR["fundo"]), "transparency": lit(0)}}],
                         "outspace": [{"properties": {"color": cor(COR["fundo"])}}]}}
        (self.dir / "page.json").write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")


def texto(runs, alinhar="center"):
    return {"visualType": "textbox", "objects": {"general": [{"properties": {"paragraphs": [
        {"textRuns": runs, "horizontalTextAlignment": alinhar}]}}]}}


def run(t, tam=12, cor_=COR["texto"], negrito=False, sublinhado=False, fonte="Segoe UI"):
    st = {"fontSize": f"{tam}pt", "color": cor_, "fontFamily": fonte}
    if negrito:
        st["fontWeight"] = "bold"
    if sublinhado:
        st["textDecoration"] = "underline"
    return {"value": t, "textStyle": st}


def slicer(campo, nome, modo="Dropdown"):
    return {"visualType": "slicer", "query": {"queryState": {"Values": {"projections": [proj(campo, nome)]}}},
            "objects": {"data": [{"properties": {"mode": lit(modo)}}],
                        "header": [{"properties": {"show": lit(True), "fontColor": cor(COR["texto"]), "bold": lit(True),
                                                   "textSize": lit(11)}}],
                        "selection": [{"properties": {"selectAllCheckboxEnabled": lit(False),
                                                      "singleSelect": lit(False)}}]}}


def cabecalho_e_filtros(pg: Pagina, subtitulo: str):
    # faixa superior (como na Plataforma): logo à esquerda, título centralizado, subtítulo sublinhado
    pg.visual("faixa", 0, 0, W, 112, {"visualType": "shape", "objects": {
        "shape": [{"properties": {"tileShape": lit("rectangle")}}],
        "fill": [{"properties": {"fillColor": cor("#FFFFFF"), "transparency": lit(0)}}],
        "outline": [{"properties": {"show": lit(False)}}]}})
    pg.visual("logo", 52, 10, 112, 96, {"visualType": "image", "objects": {"general": [{"properties": {
        "imageUrl": {"expr": {"ResourcePackageItem": {"PackageName": "RegisteredResources", "PackageType": 1,
                                                      "ItemName": "logo_tjac.png"}}}}}],
        "imageScaling": [{"properties": {"imageScalingType": lit("Fit")}}]}})
    pg.visual("titulo", 240, 12, 800, 58, texto([run("IRDR e IAC — Aferição", 30, COR["titulo"], True, fonte="Segoe UI Bold")]))
    pg.visual("subtitulo", 240, 72, 800, 32, texto([run(subtitulo, 13, COR["titulo"], sublinhado=True)]))
    # painel de filtros à esquerda
    pg.visual("limpar", 8, 128, 214, 46, {"visualType": "actionButton", "objects": {
        "icon": [{"properties": {"shapeType": lit("eraser"), "lineColor": cor(COR["texto"])}}],
        "text": [{"properties": {"show": lit(True), "text": lit("Limpar filtros"), "fontColor": cor(COR["texto"]),
                                 "bold": lit(True), "fontSize": lit(12)}}],
        "fill": [{"properties": {"show": lit(True), "fillColor": cor("#FFFFFF")}}],
        "outline": [{"properties": {"show": lit(False)}}]}},
        {"visualLink": [{"properties": {"show": lit(True), "type": lit("ClearAllSlicers")}}],
         "border": [{"properties": {"show": lit(True), "color": cor(COR["borda"]), "radius": lit(12)}}],
         "dropShadow": [{"properties": {"show": lit(True), "transparency": lit(70)}}]})
    pg.visual("f_especie", 8, 186, 214, 108, slicer(col("fIncidente", "especie"), "Espécie", "Basic"), moldura())
    pg.visual("f_gabinete", 8, 304, 214, 84, slicer(col("dGabinete", "gabinete"), "Gabinete"), moldura())
    pg.visual("f_ano", 8, 398, 214, 84, slicer(col("fIncidente", "ano_suscitamento"), "Ano de suscitamento"), moldura())
    pg.visual("f_situacao", 8, 492, 214, 84, slicer(col("fIncidente", "situacao_tpu"), "Situação na TPU"), moldura())
    pg.visual("f_processo", 8, 586, 214, 84, slicer(col("fIncidente", "processo"), "Processo"), moldura())
    # rodapé: fonte à esquerda, data/hora da atualização à direita
    pg.visual("fonte", 8, 686, 560, 28, texto([run("Fonte: DataJud (API Pública) via Power Query — CNJ  ·  "
                                                  "Portaria PRESI nº 1.961/2026", 9, COR["cinza"])], "left"))
    pg.visual("atualizado", 900, 680, 372, 36, cartao_texto(med("fIncidente", "Atualizado"), 10, "right"))


def cartao_texto(campo, tam=10, alinhar="right"):
    return {"visualType": "card", "query": {"queryState": {"Values": {"projections": [proj(campo)]}}},
            "objects": {"labels": [{"properties": {"fontSize": lit(tam), "color": cor(COR["cinza"]), "fontFamily":
                                                   lit("Segoe UI")}}],
                        "categoryLabels": [{"properties": {"show": lit(False)}}]},
            "visualContainerObjects": {"background": [{"properties": {"show": lit(False)}}],
                                       "title": [{"properties": {"show": lit(False)}}]}}


def cartao(campo, rotulo, tam=28, cor_=COR["texto"]):
    return {"visualType": "card", "query": {"queryState": {"Values": {"projections": [proj(campo, rotulo)]}}},
            "objects": {"labels": [{"properties": {"fontSize": lit(tam), "color": cor(cor_), "bold": lit(True)}}],
                        "categoryLabels": [{"properties": {"show": lit(True), "fontSize": lit(11),
                                                           "color": cor(COR["texto"])}}]}}


def barras(cat, valores, titulo, cores, ordenar_por=None):
    v = {"visualType": "barChart", "query": {"queryState": {
        "Category": {"projections": [proj(cat)]}, "Y": {"projections": [proj(c, n) for c, n in valores]}}},
        "objects": {"labels": [{"properties": {"show": lit(True), "fontSize": lit(9), "color": cor(COR["texto"])}}],
                    "valueAxis": [{"properties": {"show": lit(False)}}],
                    "categoryAxis": [{"properties": {"fontSize": lit(9), "color": cor(COR["texto"]),
                                                     "showAxisTitle": lit(False)}}],
                    "legend": [{"properties": {"show": lit(len(valores) > 1), "position": lit("Top"),
                                               "fontSize": lit(9)}}],
                    "dataPoint": [{"properties": {"fill": cor(c)}, "selector": {"metadata": proj(campo)["queryRef"]}}
                                  for (campo, _), c in zip(valores, cores)]}}
    if ordenar_por:
        v["query"]["sortDefinition"] = {"sort": [{"field": ordenar_por, "direction": "Descending"}], "isDefaultSort": False}
    return v


def tabela(campos, ordenar=None):
    v = {"visualType": "tableEx", "query": {"queryState": {"Values": {"projections": [proj(c, n) for c, n in campos]}}},
         "objects": {"columnHeaders": [{"properties": {"fontColor": cor(COR["texto"]), "bold": lit(True), "fontSize": lit(10),
                                                       "backColor": cor("#FFFFFF"), "outline": lit("BottomOnly")}}],
                     "values": [{"properties": {"fontSize": lit(9), "fontColor": cor(COR["texto"]),
                                                "backColor": cor("#FFFFFF"), "altBackColor": cor("#F3F5F9")}}],
                     "grid": [{"properties": {"gridHorizontal": lit(False), "gridVertical": lit(False)}}],
                     "total": [{"properties": {"totals": lit(False)}}]}}
    if ordenar:
        v["query"]["sortDefinition"] = {"sort": [{"field": ordenar[0], "direction": ordenar[1]}], "isDefaultSort": False}
    return v


def relatorio(base: Path):
    d = base / f"{NOME}.Report"
    shutil.rmtree(d, ignore_errors=True)
    raiz = d / "definition"
    (raiz / "pages").mkdir(parents=True)
    (d / "definition.pbir").write_text(json.dumps({"version": "4.0", "datasetReference": {
        "byPath": {"path": f"../{NOME}.SemanticModel"}}}, indent=2), encoding="utf-8")
    (d / ".platform").write_text(json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "Report", "displayName": NOME},
        "config": {"version": "2.0", "logicalId": gid("relatorio")}}, indent=2), encoding="utf-8")

    rr = d / "StaticResources" / "RegisteredResources"
    sr = d / "StaticResources" / "SharedResources" / "BaseThemes"
    rr.mkdir(parents=True)
    sr.mkdir(parents=True)
    shutil.copy(AQUI / "recursos" / "logo_tjac.png", rr / "logo_tjac.png")
    tema = {"name": "TJAC_Plataforma", "dataColors": [COR["vermelho"], COR["verde"], COR["amarelo"], COR["vinho"],
                                                      "#5B8DEF", "#9B59B6", COR["cinza"], "#2C3E50"],
            "background": COR["card"], "foreground": COR["texto"], "tableAccent": COR["vermelho"],
            "textClasses": {"title": {"fontFace": "Segoe UI Semibold", "fontSize": 12, "color": COR["texto"]},
                            "label": {"fontFace": "Segoe UI", "fontSize": 9, "color": COR["texto"]}},
            "visualStyles": {"*": {"*": {"border": [{"show": True, "color": {"solid": {"color": COR["borda"]}}, "radius": 12}],
                                          "dropShadow": [{"show": True, "transparency": 70}]}}}}
    (rr / "TJAC_Plataforma.json").write_text(json.dumps(tema, ensure_ascii=False, indent=2), encoding="utf-8")
    base_tema = {"name": "CY24SU10", "dataColors": tema["dataColors"], "background": "#FFFFFF",
                 "foreground": "#252423", "tableAccent": "#118DFF"}
    (sr / "CY24SU10.json").write_text(json.dumps(base_tema, indent=2), encoding="utf-8")

    (raiz / "version.json").write_text(json.dumps({"$schema": f"{SCH}/versionMetadata/1.0.0/schema.json",
                                                   "version": "2.0.0"}, indent=2), encoding="utf-8")
    (raiz / "report.json").write_text(json.dumps({
        "$schema": f"{SCH}/report/1.0.0/schema.json",
        "themeCollection": {"baseTheme": {"name": "CY24SU10", "reportVersionAtImport": "5.61", "type": "SharedResources"},
                            "customTheme": {"name": "TJAC_Plataforma", "reportVersionAtImport": "5.61",
                                            "type": "RegisteredResources"}},
        "layoutOptimization": "None",
        "resourcePackages": [
            {"name": "SharedResources", "type": "SharedResources",
             "items": [{"name": "CY24SU10", "path": "BaseThemes/CY24SU10.json", "type": "BaseTheme"}]},
            {"name": "RegisteredResources", "type": "RegisteredResources",
             "items": [{"name": "TJAC_Plataforma.json", "path": "TJAC_Plataforma.json", "type": "CustomTheme"},
                       {"name": "logo_tjac.png", "path": "logo_tjac.png", "type": "Image"}]}],
        "settings": {"useStylableVisualContainerHeader": True, "defaultDrillFilterOtherVisuals": True,
                     "allowChangeFilterTypes": True, "useEnhancedTooltips": True}}, ensure_ascii=False, indent=2),
        encoding="utf-8")

    F, G = "fIncidente", "dGabinete"
    # ---------------------------------------------------------------- página 1: visão geral
    p1 = Pagina("visao_geral", "Visão Geral", raiz)
    cabecalho_e_filtros(p1, "Portaria PRESI nº 1.961/2026 · Anexo IV, item 18 — SUS (10) e TESE (25)")
    p1.visual("bar_gab", 236, 128, 392, 270, barras(col(G, "gabinete"),
              [(med(F, "Pontos SUS"), "SUS"), (med(F, "Pontos TESE"), "TESE")],
              None, [COR["vermelho"], COR["verde"]], ordenar_por=med(F, "Pontos")), moldura("Pontuação por Gabinete"))
    p1.visual("bar_sit", 236, 410, 392, 260, barras(col(F, "situacao_tpu"), [(med(F, "Incidentes"), "Incidentes")],
              None, [COR["amarelo"]], ordenar_por=med(F, "Incidentes")), moldura("Incidentes por Situação na TPU"))
    p1.visual("tab_proc", 640, 128, 360, 542, tabela(
        [(col(F, "processo"), "Processo"), (col(F, "especie"), "Espécie"), (col(G, "gabinete"), "Gabinete"),
         (med(F, "Pontos"), "Pontos")], (med(F, "Pontos"), "Descending")), moldura())
    p1.visual("c_inc", 1012, 128, 260, 92, cartao(med(F, "Incidentes"), "Incidentes IRDR/IAC"), moldura())
    p1.visual("c_pts", 1012, 230, 126, 92, cartao(med(F, "Pontos"), "Pontos", 24, COR["vermelho"]), moldura())
    p1.visual("c_gab", 1146, 230, 126, 92, cartao(med(F, "Gabinetes Pontuando"), "Gabinetes", 24), moldura())
    p1.visual("gauge", 1012, 332, 260, 338, {"visualType": "gauge", "query": {"queryState": {
        "Y": {"projections": [proj(med(F, "Pontos"), "Pontos")]},
        "MaxValue": {"projections": [proj(med(F, "Teto"), "Teto")]}}},
        "objects": {"dataPoint": [{"properties": {"fill": cor(COR["verde"]), "target": cor(COR["vinho"])}}],
                    "calloutValue": [{"properties": {"fontSize": lit(22), "color": cor(COR["texto"])}}],
                    "labels": [{"properties": {"fontSize": lit(9)}}]}},
        moldura("Expectativa de pontuação"))
    p1.salvar()

    # ---------------------------------------------------------------- página 2: incidentes e alertas
    p2 = Pagina("incidentes", "Incidentes e Alertas", raiz)
    cabecalho_e_filtros(p2, "Conferência dos lançamentos na TPU — classes 12085/12087 · movimentos 12094, 12095, 12257")
    p2.visual("c_sus", 236, 128, 250, 84, cartao(med(F, "Eventos SUS"), "Eventos SUS no período"), moldura())
    p2.visual("c_tese", 496, 128, 250, 84, cartao(med(F, "Eventos TESE"), "Eventos TESE no período"), moldura())
    p2.visual("c_nc", 756, 128, 250, 84, cartao(med(F, "Pontos Não Computados"), "Pontos fora do limite de 2"), moldura())
    p2.visual("c_al", 1016, 128, 256, 84, cartao(med(F, "Incidentes com Alerta"), "Incidentes com alerta", 28,
                                                  COR["vermelho"]), moldura())
    p2.visual("carga", 236, 220, 1036, 30, cartao_texto(med(F, "Carga DataJud"), 10, "left"))
    p2.visual("tab_inc", 236, 254, 1036, 416, tabela(
        [(col(F, "processo"), "Processo"), (col(F, "especie"), "Espécie"), (col(G, "gabinete"), "Gabinete"),
         (col(F, "data_suscitamento"), "Suscitamento"), (col(F, "data_admissao"), "Admissão"),
         (col(F, "data_nao_admissao"), "Não admissão"), (col(F, "data_tese"), "Tese"),
         (col(F, "potencial"), "Potencial"), (col(F, "selecionado"), "Selecionado"), (med(F, "Pontos"), "Pontos"),
         (col(F, "alertas"), "Alertas")], (col(F, "data_suscitamento"), "Descending")),
        moldura("Incidentes de IRDR e IAC do TJAC (DataJud)"))
    p2.salvar()

    # ---------------------------------------------------------------- página 3: movimentos
    p3 = Pagina("movimentos", "Linha do Tempo", raiz)
    cabecalho_e_filtros(p3, "Movimentos dos incidentes registrados no DataJud")
    p3.visual("f_mov", 236, 128, 300, 84, slicer(col("fMovimento", "parametrizado"), "Tipo de movimento"), moldura())
    p3.visual("tab_mov", 236, 222, 1036, 448, tabela(
        [(col("fMovimento", "data"), "Data"), (col(F, "processo"), "Processo"), (col(F, "especie"), "Espécie"),
         (col(G, "gabinete"), "Gabinete"), (col("fMovimento", "codigo"), "Código TPU"),
         (col("fMovimento", "movimento"), "Movimento"), (col("fMovimento", "parametrizado"), "Classificação")],
        (col("fMovimento", "data"), "Descending")), moldura("Movimentos (mais recentes primeiro)"))
    p3.salvar()

    (raiz / "pages" / "pages.json").write_text(json.dumps({
        "$schema": f"{SCH}/pagesMetadata/1.0.0/schema.json",
        "pageOrder": [p1.nome, p2.nome, p3.nome], "activePageName": p1.nome}, indent=2), encoding="utf-8")


def gerar(destino: Path):
    destino.mkdir(parents=True, exist_ok=True)
    (destino / f"{NOME}.pbip").write_text(json.dumps({
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
        "version": "1.0", "artifacts": [{"report": {"path": f"{NOME}.Report"}}],
        "settings": {"enableAutoRecovery": True}}, indent=2), encoding="utf-8")
    (destino / ".gitignore").write_text("**/.pbi/localSettings.json\n**/.pbi/cache.abf\n", encoding="utf-8")
    tmdl_modelo(destino)
    relatorio(destino)


def validar(destino: Path, pasta_schemas: Path) -> int:
    """Valida cada JSON do relatório no schema PBIR correspondente (cópia local de microsoft/json-schemas)."""
    from jsonschema import Draft7Validator
    from referencing import Registry, Resource

    reg = Registry()
    for f in pasta_schemas.rglob("schema.json"):
        rel = f.relative_to(pasta_schemas).as_posix()
        reg = reg.with_resource(f"{SCH}/{rel}", Resource.from_contents(json.loads(f.read_text())))
    erros = 0
    for f in (destino / f"{NOME}.Report" / "definition").rglob("*.json"):
        doc = json.loads(f.read_text(encoding="utf-8"))
        sch = reg.get_or_retrieve(doc["$schema"]).value.contents
        for e in Draft7Validator(sch, registry=reg).iter_errors(doc):
            erros += 1
            print(f"{f.relative_to(destino)}: {'/'.join(map(str, e.path))}: {e.message[:200]}")
    print("Relatório válido nos schemas PBIR." if not erros else f"{erros} erro(s) de schema.")
    return erros


if __name__ == "__main__":
    args = sys.argv[1:]
    alvo = AQUI / "pbip"
    if args and args[0] != "--validar":
        alvo = Path(args.pop(0))
    gerar(alvo)
    print(f"Projeto gerado em {alvo / (NOME + '.pbip')}")
    if args[:1] == ["--validar"]:
        sys.exit(1 if validar(alvo, Path(args[1])) else 0)
