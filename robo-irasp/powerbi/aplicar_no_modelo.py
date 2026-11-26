"""Inclui a fonte do robô (CSV no GitHub) no modelo do painel IRASP.

Uso: python aplicar_no_modelo.py CAMINHO/IRASP_TJAC.SemanticModel/model.bim

O que muda no modelo (o resto fica igual):
  * parâmetros novos: Robo_Ativo (true/false) e Robo_Caminho (repositório/ramificação no GitHub);
  * consulta nova Fonte_Robo: lê apuracoes.csv, pontuacao.csv, situacao.csv e sintese.csv;
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

FONTE_ROBO = f"""let
    {MARCA} CSV publicados todo dia às 7h (Acre) pelo robô em github.com/seringueiroacreano/cienciadedados
    Ler = (arquivo as text) as table =>
        let
            Binario = Web.Contents("https://raw.githubusercontent.com", [RelativePath = Robo_Caminho & "/irasp/" & arquivo]),
            Csv = Csv.Document(Binario, [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
            ComCabecalho = Table.PromoteHeaders(Csv, [PromoteAllScalars = true]),
            SemVazio = Table.TransformColumns(ComCabecalho, {{}}, each if _ = "" then null else _)
        in
            Table.Buffer(SemVazio),
    Apuracoes = if Robo_Ativo then (try Ler("apuracoes.csv") otherwise null) else null,
    Disponivel = Apuracoes <> null and not Table.IsEmpty(Apuracoes),
    Info = if Disponivel then Apuracoes{{0}} else null,
    Numero = (v) => if v = null then null else Number.FromText(v, "en-US"),
    Sintese0 = if Disponivel then (try Ler("sintese.csv") otherwise null) else null,
    Resultado = [
        Disponivel = Disponivel,
        Codigo = if Disponivel then Info[#"Apuração"] else null,
        Base = if Disponivel then Info[#"Apuração base"] else null,
        Automaticos = if Disponivel and Info[#"Componentes automáticos"] <> null
            then Text.Split(Info[#"Componentes automáticos"], ";") else {{}},
        Apuracoes = if Disponivel then
            Table.TransformColumns(
                Table.RemoveColumns(Apuracoes, {{"Apuração base", "Componentes automáticos"}}),
                {{{{"Data de referência", each Date.FromText(_, [Format = "yyyy-MM-dd"])}}}})
            else null,
        Pontuacao = if Disponivel then (try Ler("pontuacao.csv") otherwise null) else null,
        Situacao = if Disponivel then (try Ler("situacao.csv") otherwise null) else null,
        Sintese = if Sintese0 = null then null else
            Table.TransformColumns(Sintese0, {{{{"Pontos de referência", Numero}}, {{"Valor bruto", Numero}}}})
    ]
in
    Resultado"""

# Trechos a trocar em cada tabela: (linha original, novas linhas)
APURACAO_DE = '    Origem = Fonte_IRASP{[Item = "tbApuracoes", Kind = "Table"]}[Data],'
APURACAO_PARA = f"""    {MARCA} apurações da planilha + apuração automática do robô
    Planilha = Fonte_IRASP{{[Item = "tbApuracoes", Kind = "Table"]}}[Data],
    Origem = if Fonte_Robo[Disponivel] then Table.Combine({{Planilha, Fonte_Robo[Apuracoes]}}) else Planilha,"""

PONTUACAO_DE = '    Origem = Fonte_IRASP{[Item = "tbPontuacao", Kind = "Table"]}[Data],'
PONTUACAO_PARA = f"""    {MARCA} apuração AUTO = apuração base da planilha com os componentes automáticos do robô
    Planilha = Fonte_IRASP{{[Item = "tbPontuacao", Kind = "Table"]}}[Data],
    Robo = Fonte_Robo,
    Automatica =
        if not Robo[Disponivel] or Robo[Pontuacao] = null then null
        else
            let
                Auto = List.Intersect({{Robo[Automaticos], Table.ColumnNames(Robo[Pontuacao])}}),
                Base0 = Table.SelectRows(Planilha, each [#"Apuração"] = Robo[Base]),
                Base1 = Table.RemoveColumns(Base0, List.Intersect({{Auto, Table.ColumnNames(Base0)}}) & {{"Apuração"}}),
                Base2 = Table.TransformColumnTypes(Base1, {{{{"Código MPM", Int64.Type}}}}),
                Valores = Table.TransformColumnTypes(Table.SelectColumns(Robo[Pontuacao], {{"Código MPM"}} & Auto), {{{{"Código MPM", Int64.Type}}}}),
                Unida = Table.NestedJoin(Base2, {{"Código MPM"}}, Valores, {{"Código MPM"}}, "R", JoinKind.LeftOuter),
                Expandida = Table.ExpandTableColumn(Unida, "R", Auto, Auto),
                ComCodigo = Table.AddColumn(Expandida, "Apuração", each Robo[Codigo], type text)
            in
                ComCodigo,
    Origem = if Automatica = null then Planilha else Table.Combine({{Planilha, Automatica}}),"""

SITUACAO_DE = '    Sit0 = Fonte_IRASP{[Item = "tbSituacao", Kind = "Table"]}[Data],'
SITUACAO_PARA = f"""    {MARCA} exceções da planilha + as da apuração base (componentes manuais) + observações do robô
    SitPlanilha = Fonte_IRASP{{[Item = "tbSituacao", Kind = "Table"]}}[Data],
    SitHerdada = if Automatica = null then null else
        Table.TransformColumns(
            Table.SelectRows(SitPlanilha, each [#"Apuração"] = Robo[Base] and not List.Contains(Robo[Automaticos], [Componente])),
            {{{{"Apuração", each Robo[Codigo], type text}}}}),
    Sit0 = Table.Combine(List.RemoveNulls({{SitPlanilha, SitHerdada, if Automatica = null then null else Robo[Situacao]}})),"""

SINTESE_DE = '    Origem = Fonte_IRASP{[Item = "tbSintese", Kind = "Table"]}[Data],'
SINTESE_PARA = f"""    {MARCA} referências da planilha + as do robô (componentes manuais herdados da apuração base)
    Planilha = Fonte_IRASP{{[Item = "tbSintese", Kind = "Table"]}}[Data],
    Robo = Fonte_Robo,
    Herdada = if not Robo[Disponivel] then null else
        Table.TransformColumns(
            Table.SelectRows(Planilha, each [#"Apuração"] = Robo[Base] and [Componente] <> null
                and not List.Contains(Robo[Automaticos], [Componente])),
            {{{{"Apuração", each Robo[Codigo], type text}}}}),
    Origem = if not Robo[Disponivel] then Planilha
        else Table.Combine(List.RemoveNulls({{Planilha, Herdada, Robo[Sintese]}})),"""

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
    if "Fonte_Robo" not in nomes:
        md["expressions"].append({
            "name": "Fonte_Robo", "annotations": [{"name": "PBI_ResultType", "value": "Record"}],
            "description": "CSV do robô IRASP (SNA e CNIEP) publicados no GitHub.",
            "expression": FONTE_ROBO.split("\n"), "kind": "m", "lineageTag": tag("Fonte_Robo")})

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
