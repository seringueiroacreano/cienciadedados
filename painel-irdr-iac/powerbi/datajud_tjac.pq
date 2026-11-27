// =====================================================================
// Conexão direta do Power BI à API Pública do DataJud (CNJ) — IRDR (12085) e IAC (12087) do TJAC
// Cole cada bloco numa consulta em branco (Página Inicial > Nova fonte > Consulta em branco > Editor avançado).
// Credencial: na 1ª atualização escolha "Anônimo" para https://api-publica.datajud.cnj.jus.br
// (a chave vai no cabeçalho). No Power BI Service, marque "Ignorar teste de conexão" na fonte.
// =====================================================================

// ---------- Consulta 1: DataJud_Chave (parâmetro Texto)
// Chave PÚBLICA divulgada pelo CNJ em https://datajud-wiki.cnj.jus.br/api-publica/acesso — troque se o CNJ mudar.
"cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]


// ---------- Consulta 2: DataJud_Post (função)
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
            Json = Json.Document(Resp),
            Ok = Record.HasFields(Json, "hits")
        in
            if Ok then Json
            else if n >= 5 then error "DataJud indisponível (429/5xx) após 6 tentativas"
            else Function.InvokeAfter(() => @Tentar(n + 1), #duration(0, 0, 0, 15 * (n + 1)))
in
    Tentar(0)


// ---------- Consulta 3: DataJud_Carga  (data da última carga do TJAC no DataJud)
let
    R = DataJud_Post([size = 0, aggs = [u = [max = [field = "dataHoraUltimaAtualizacao"]]]]),
    Ultima = DateTimeZone.FromText(R[aggregations][u][value_as_string]),
    Tabela = #table(type table [ultima_carga_datajud = datetimezone, consultado_em = datetimezone],
                    {{Ultima, DateTimeZone.UtcNow()}})
in
    Tabela


// ---------- Consulta 4: DataJud_Bruto  (desabilite "Habilitar carga": é só intermediária)
let
    R = DataJud_Post([size = 1000, query = [terms = [classe.codigo = {12085, 12087}]]]),
    Hits = List.Transform(R[hits][hits], each [_source]),
    Tabela = Table.FromList(Hits, Splitter.SplitByNothing(), {"s"}),
    // datas do DataJud vêm como "2026051100", "20260511000000" ou ISO
    Dt = (v) => if v = null then null else
            let t = Text.From(v) in
            if Text.Middle(t, 4, 1) = "-" then Date.FromText(Text.Start(t, 10), [Format = "yyyy-MM-dd"])
            else #date(Number.From(Text.Start(t, 4)), Number.From(Text.Middle(t, 4, 2)), Number.From(Text.Middle(t, 6, 2))),
    Campos = Table.AddColumn(Tabela, "r", each [
        numero = [s][numeroProcesso],
        classe = [s][classe][codigo],
        especie = if [s][classe][codigo] = 12085 then "IRDR" else "IAC",
        grau = [s][grau],
        gabinete = [s][orgaoJulgador][nome],
        data_suscitamento = Dt([s][dataAjuizamento]),
        ultima_atualizacao = Dt([s][dataHoraUltimaAtualizacao]),
        movimentos = List.Transform(Record.FieldOrDefault([s], "movimentos", {}),
                        each [codigo = [codigo], movimento = [nome], data = Dt([dataHora])])
    ]),
    Expandido = Table.FromRecords(Campos[r])
in
    Expandido


// ---------- Consulta 5: fMovimentoDataJud  (linha do tempo dos incidentes)
let
    T = Table.ExpandListColumn(Table.SelectColumns(DataJud_Bruto, {"numero", "movimentos"}), "movimentos"),
    E = Table.ExpandRecordColumn(T, "movimentos", {"codigo", "movimento", "data"}),
    Param = Table.AddColumn(E, "parametrizado", each
        if [codigo] = 12094 then "Admissão" else if [codigo] = 12095 then "Não admissão"
        else if [codigo] = 12257 then "Definição de tese" else if [codigo] = 14985 then "Levantamento"
        else if [codigo] = 12098 then "Suspensão por IRDR" else "", type text),
    Tipos = Table.TransformColumnTypes(Param, {{"codigo", Int64.Type}, {"movimento", type text}, {"data", type date}})
in
    Tipos


// ---------- Consulta 6: fIncidenteDataJud  (um incidente por linha + SUS/TESE da Portaria 1.961/2026)
let
    Inicio = #date(2026, 1, 1),
    Fim = List.Min({#date(2026, 11, 30), Date.From(DataJud_Carga{0}[ultima_carga_datajud])}),
    PrimeiroMov = (movs as list, cod as number) =>
        List.Min(List.Transform(List.Select(movs, each [codigo] = cod), each [data])),
    // o DataJud pode repetir o processo: fica a versão mais recente
    Unico = Table.Distinct(Table.Sort(DataJud_Bruto, {{"ultima_atualizacao", Order.Descending}}), {"numero"}),
    A = Table.AddColumn(Unico, "data_admissao", each PrimeiroMov([movimentos], 12094), type date),
    B = Table.AddColumn(A, "data_nao_admissao", each PrimeiroMov([movimentos], 12095), type date),
    C = Table.AddColumn(B, "data_tese", each PrimeiroMov([movimentos], 12257), type date),
    D = Table.AddColumn(C, "data_transito", each PrimeiroMov([movimentos], 848), type date),
    Sus = Table.AddColumn(D, "sus", each if [data_suscitamento] <> null and [data_suscitamento] >= Inicio
            and [data_suscitamento] <= Fim then 1 else 0, Int64.Type),
    Tese = Table.AddColumn(Sus, "tese", each if [data_tese] <> null and [data_tese] >= Inicio
            and [data_tese] <= Fim then 1 else 0, Int64.Type),
    Pot = Table.AddColumn(Tese, "potencial", each 10 * [sus] + 25 * [tese], Int64.Type),
    Alertas = Table.AddColumn(Pot, "alertas", each Text.Combine(List.RemoveNulls({
            if [data_nao_admissao] <> null then "não admitido (12095)" else null,
            if [especie] = "IRDR" and [data_admissao] = null and [data_nao_admissao] = null and [data_tese] = null
                then "sem 12094/12095" else null,
            if [data_transito] <> null and [data_tese] = null and [data_nao_admissao] = null
                then "transitado sem 12257" else null,
            if [data_tese] <> null and Duration.Days([data_tese] - [data_suscitamento]) < 30
                then "tese < 30 dias do ajuizamento" else null,
            if not Text.Contains(Text.Upper([gabinete]), "GABINETE") then "órgão não é gabinete" else null}), "; "), type text),
    // seleção dos 2 de maior pontuação por gabinete (empate: data de suscitamento, depois número)
    Ord = Table.Sort(Alertas, {{"gabinete", Order.Ascending}, {"potencial", Order.Descending},
                               {"data_suscitamento", Order.Ascending}, {"numero", Order.Ascending}}),
    Grupo = Table.Group(Ord, {"gabinete"}, {{"t", each Table.AddIndexColumn(_, "ordem_no_gabinete", 1, 1, Int64.Type)}}),
    Junta = Table.Combine(Grupo[t]),
    Sel = Table.AddColumn(Junta, "selecionado", each if [ordem_no_gabinete] <= 2 and [potencial] > 0 then 1 else 0, Int64.Type),
    Total = Table.AddColumn(Sel, "total", each [potencial] * [selecionado], Int64.Type),
    Final = Table.RemoveColumns(Total, {"movimentos"}),
    Tipos = Table.TransformColumnTypes(Final, {{"numero", type text}, {"especie", type text}, {"grau", type text},
              {"gabinete", type text}, {"classe", Int64.Type}, {"data_suscitamento", type date}, {"ultima_atualizacao", type date}})
in
    Tipos
