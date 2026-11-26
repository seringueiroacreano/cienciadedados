"""Inclui a fonte do robô (CSV no GitHub) no modelo do painel IRASP.

Uso: python aplicar_no_modelo.py CAMINHO/IRASP_TJAC.SemanticModel/model.bim

O que muda no modelo (o resto fica igual):
  * parâmetros novos: Robo_Ativo (true/false) e Robo_Caminho (repositório/ramificação no GitHub);
  * consultas novas Robo_Ler, Robo_Apuracoes, Robo_Pontuacao, Robo_Situacao e Robo_Sintese:
    cada uma lê um CSV e devolve tabela vazia se ele não estiver disponível
    (a antiga Fonte_Robo, se existir, é removida);
  * Apuração, Pontuação e Síntese Estadual passam a somar a apuração do robô (código AUTO)
    às apurações da planilha. A apuração AUTO = apuração base da planilha (ex.: AP01) com os
    componentes automáticos (SNA a, b.1, b.2, c e CNIEP) trocados pelos valores do robô.
Se o GitHub estiver fora do ar ou Robo_Ativo = false, o painel segue só com a planilha.
O script é idempotente: rodar duas vezes não duplica nada.
"""
import json
import sys
import uuid

MARCA = "// [robo-irasp]"

PARAMETROS = [
    ("Robo_Ativo", "true meta [IsParameterQuery=true, Type=\"Logical\", IsParameterQueryRequired=true]",
     "Logical", "true = soma a apuração automática do robô (CSV no GitHub); false = usa só a planilha."),
    ("Robo_Caminho",
     "\"seringueiroacreano/cienciadedados/dados-irasp\" meta [IsParameterQuery=true, Type=\"Text\", IsParameterQueryRequired=true]",
     "Text", "Repositório e ramificação do GitHub onde o robô publica os CSV (dono/repositorio/ramificacao)."),
]

COLUNAS = {
    "Robo_Apuracoes": ["Apuração", "Data de referência", "Descrição", "Tipo", "Observação",
                       "Apuração base", "Componentes automáticos"],
    "Robo_Pontuacao": ["Apuração", "Código MPM"],
    "Robo_Situacao": ["Apuração", "Código MPM", "Componente", "Situação", "Observação"],
    "Robo_Sintese": ["Apuração", "Componente", "Pontos de referência", "Valor bruto", "Situação", "Base / fonte"],
}
ARQUIVOS = {"Robo_Apuracoes": "apuracoes.csv", "Robo_Pontuacao": "pontuacao.csv",
            "Robo_Situacao": "situacao.csv", "Robo_Sintese": "sintese.csv"}

# Função que lê um CSV do robô. Cada consulta do robô devolve SEMPRE uma tabela
# (vazia, com os cabeçalhos, se o GitHub falhar ou Robo_Ativo = false): o motor do
# Power BI não aceita bem consultas compartilhadas que devolvem registros.
ROBO_LER = f"""(arquivo as text) as table =>
    let
        {MARCA} lê um CSV publicado pelo robô (github.com/seringueiroacreano/cienciadedados)
        Binario = Web.Contents("https://raw.githubusercontent.com", [RelativePath = Robo_Caminho & "/irasp/" & arquivo]),
        Csv = Csv.Document(Binario, [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
        ComCabecalho = Table.PromoteHeaders(Csv, [PromoteAllScalars = true]),
        SemVazio = Table.TransformColumns(ComCabecalho, {{}}, each if _ = "" then null else _)
    in
        Table.Buffer(SemVazio)"""


def consulta_robo(nome):
    cols = ", ".join(f'"{c}"' for c in COLUNAS[nome])
    extra = ""
    if nome == "Robo_Apuracoes":
        extra = ('\n    Final = Table.TransformColumns(Lida, {{"Data de referência", '
                 'each if _ = null then null else Date.FromText(_, [Format = "yyyy-MM-dd"])}})')
    elif nome == "Robo_Sintese":
        extra = ('\n    Numero = (v) => if v = null then null else Number.FromText(v, "en-US"),'
                 '\n    Final = Table.TransformColumns(Lida, {{"Pontos de referência", Numero}, {"Valor bruto", Numero}})')
    else:
        extra = "\n    Final = Lida"
    return f"""let
    {MARCA} CSV do robô ({ARQUIVOS[nome]}); tabela vazia se indisponível
    Vazia = #table({{{cols}}}, {{}}),
    Lida = if Robo_Ativo then (try Robo_Ler("{ARQUIVOS[nome]}") otherwise Vazia) else Vazia,{extra}
in
    Final"""


# Trechos a trocar em cada tabela: (linha original, novas linhas)
APURACAO_DE = '    Origem = Fonte_IRASP{[Item = "tbApuracoes", Kind = "Table"]}[Data],'
APURACAO_PARA = f"""    {MARCA} apurações da planilha + apuração automática do robô
    Planilha = Fonte_IRASP{{[Item = "tbApuracoes", Kind = "Table"]}}[Data],
    DoRobo = Table.RemoveColumns(Robo_Apuracoes, {{"Apuração base", "Componentes automáticos"}}, MissingField.Ignore),
    Origem = if Table.IsEmpty(DoRobo) then Planilha else Table.Combine({{Planilha, DoRobo}}),"""

PONTUACAO_DE = '    Origem = Fonte_IRASP{[Item = "tbPontuacao", Kind = "Table"]}[Data],'
PONTUACAO_PARA = f"""    {MARCA} apuração AUTO = apuração base da planilha com os componentes automáticos do robô
    Planilha = Fonte_IRASP{{[Item = "tbPontuacao", Kind = "Table"]}}[Data],
    // Valores lidos por Table.Column (e não por linha{{0}}[campo]): o motor do Power BI
    // descarta colunas que não vê sendo usadas, e o acesso por registro não conta como uso.
    // Sem funções locais aqui: o motor não passa funções entre partes da consulta.
    RoboVazio = Table.IsEmpty(Robo_Apuracoes),
    RoboCodigo = if RoboVazio or Table.IsEmpty(Robo_Pontuacao) then null else List.First(Table.Column(Robo_Apuracoes, "Apuração")),
    RoboBase = if RoboVazio then null else List.First(Table.Column(Robo_Apuracoes, "Apuração base")),
    RoboAutoTexto = if RoboVazio then null else List.First(Table.Column(Robo_Apuracoes, "Componentes automáticos")),
    RoboAuto = if RoboAutoTexto = null then {{}} else Text.Split(RoboAutoTexto, ";"),
    Automatica =
        if RoboCodigo = null or RoboBase = null then null
        else
            let
                Auto = List.Intersect({{RoboAuto, Table.ColumnNames(Robo_Pontuacao)}}),
                Base0 = Table.SelectRows(Planilha, each [#"Apuração"] = RoboBase),
                Base1 = Table.RemoveColumns(Base0, List.Intersect({{Auto, Table.ColumnNames(Base0)}}) & {{"Apuração"}}),
                Base2 = Table.TransformColumnTypes(Base1, {{{{"Código MPM", Int64.Type}}}}),
                Valores = Table.TransformColumnTypes(Table.SelectColumns(Robo_Pontuacao, {{"Código MPM"}} & Auto), {{{{"Código MPM", Int64.Type}}}}),
                Unida = Table.NestedJoin(Base2, {{"Código MPM"}}, Valores, {{"Código MPM"}}, "R", JoinKind.LeftOuter),
                Aberta = Table.ExpandTableColumn(Unida, "R", Auto, Auto),
                ComCodigo = Table.AddColumn(Aberta, "Apuração", each RoboCodigo, type text)
            in
                ComCodigo,
    Origem = if Automatica = null then Planilha else Table.Combine({{Planilha, Automatica}}),"""

SITUACAO_DE = '    Sit0 = Fonte_IRASP{[Item = "tbSituacao", Kind = "Table"]}[Data],'
SITUACAO_PARA = f"""    {MARCA} exceções da planilha + as da apuração base (componentes manuais) + observações do robô
    SitPlanilha = Fonte_IRASP{{[Item = "tbSituacao", Kind = "Table"]}}[Data],
    SitHerdada = if Automatica = null then null else
        Table.TransformColumns(
            Table.SelectRows(SitPlanilha, each [#"Apuração"] = RoboBase and not List.Contains(RoboAuto, [Componente])),
            {{{{"Apuração", each RoboCodigo, type text}}}}),
    Sit0 = Table.Combine(List.RemoveNulls({{SitPlanilha, SitHerdada, if Automatica = null then null else Robo_Situacao}})),"""

SINTESE_DE = '    Origem = Fonte_IRASP{[Item = "tbSintese", Kind = "Table"]}[Data],'
SINTESE_PARA = f"""    {MARCA} referências da planilha + as do robô (componentes manuais herdados da apuração base)
    Planilha = Fonte_IRASP{{[Item = "tbSintese", Kind = "Table"]}}[Data],
    RoboVazio = Table.IsEmpty(Robo_Apuracoes),
    RoboCodigo = if RoboVazio then null else List.First(Table.Column(Robo_Apuracoes, "Apuração")),
    RoboBase = if RoboVazio then null else List.First(Table.Column(Robo_Apuracoes, "Apuração base")),
    RoboAutoTexto = if RoboVazio then null else List.First(Table.Column(Robo_Apuracoes, "Componentes automáticos")),
    RoboAuto = if RoboAutoTexto = null then {{}} else Text.Split(RoboAutoTexto, ";"),
    Herdada = if RoboCodigo = null or RoboBase = null then null else
        Table.TransformColumns(
            Table.SelectRows(Planilha, each [#"Apuração"] = RoboBase and [Componente] <> null
                and not List.Contains(RoboAuto, [Componente])),
            {{{{"Apuração", each RoboCodigo, type text}}}}),
    Origem = if RoboCodigo = null then Planilha
        else Table.Combine(List.RemoveNulls({{Planilha, Herdada, Robo_Sintese}})),"""

TROCAS = {
    "Apuração": [(APURACAO_DE, APURACAO_PARA)],
    "Pontuação": [(PONTUACAO_DE, PONTUACAO_PARA), (SITUACAO_DE, SITUACAO_PARA)],
    "Síntese Estadual": [(SINTESE_DE, SINTESE_PARA)],
}


def tag(nome):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "robo-irasp/" + nome))


def aplicar(modelo):
    md = modelo["model"]
    nomes = {e["name"] for e in md["expressions"]}
    for nome, expr, tipo, desc in PARAMETROS:
        if nome not in nomes:
            md["expressions"].append({
                "name": nome, "annotations": [{"name": "PBI_ResultType", "value": tipo}],
                "description": desc, "expression": expr, "kind": "m", "lineageTag": tag(nome)})
    novas = {"Robo_Ler": (ROBO_LER, "Function", "Lê um CSV publicado pelo robô IRASP no GitHub.")}
    for nome in COLUNAS:
        novas[nome] = (consulta_robo(nome), "Table", f"CSV do robô IRASP: {ARQUIVOS[nome]}.")
    md["expressions"] = [e for e in md["expressions"] if e["name"] not in novas and e["name"] != "Fonte_Robo"]
    for nome, (expr, tipo, desc) in novas.items():
        md["expressions"].append({
            "name": nome, "annotations": [{"name": "PBI_ResultType", "value": tipo}],
            "description": desc, "expression": expr.split("\n"), "kind": "m", "lineageTag": tag(nome)})

    for tabela in md["tables"]:
        for de, para in TROCAS.get(tabela["name"], []):
            for part in tabela.get("partitions", []):
                linhas = part["source"]["expression"]
                if isinstance(linhas, str):
                    linhas = linhas.split("\n")
                if any(MARCA in l for l in linhas) and de not in linhas:
                    continue  # já aplicado
                if de not in linhas:
                    raise SystemExit(f"Trecho esperado não encontrado em '{tabela['name']}': {de}")
                i = linhas.index(de)
                part["source"]["expression"] = linhas[:i] + para.split("\n") + linhas[i + 1:]
    return modelo


def main(caminho):
    with open(caminho, encoding="utf-8-sig") as f:
        modelo = json.load(f)
    aplicar(modelo)
    texto = json.dumps(modelo, ensure_ascii=False, indent=2)
    with open(caminho, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(texto + "\n")
    print(f"Modelo atualizado: {caminho}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
