// Power Query (M) — função para carregar as tabelas geradas pelo ETL.
// 1) Crie o parâmetro Pasta_Saida (Texto) apontando para a pasta "saida" (local ou SharePoint sincronizado).
// 2) Crie uma consulta em branco chamada LerTabela com o código abaixo.
// 3) Para cada tabela: nova consulta em branco = LerTabela("fIncidente")  (idem dGabinete, dParametros, ...).
(nome as text) as table =>
let
    Binario = File.Contents(Pasta_Saida & "\" & nome & ".csv"),
    Csv = Csv.Document(Binario, [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Tabela = Table.PromoteHeaders(Csv, [PromoteAllScalars = true]),
    // tipos por convenção de nome: data_* = data; números conhecidos = inteiro; elegivel/julgado = lógico
    Datas = List.Select(Table.ColumnNames(Tabela), each Text.StartsWith(_, "data_")
                or List.Contains({"inicio", "encerramento", "corte", "primeiro_recebimento", "ultimo_recebimento"}, _)),
    Inteiros = List.Select(Table.ColumnNames(Tabela), each List.Contains({
                "sus", "tese", "potencial", "ordem", "ordem_no_gabinete", "selecionado", "pontos_sus", "pontos_tese",
                "total", "registros", "pendencias_qtd", "sus_elegiveis", "tese_elegiveis", "incidentes_pontuados",
                "processos", "suspensos", "ano_recebimento", "dias_desde_recebimento", "teto_gabinete",
                "max_incidentes"}, _)),
    Logicos = List.Select(Table.ColumnNames(Tabela), each List.Contains({"elegivel", "julgado", "tema_com_rotulo_conflitante"}, _)),
    ComDatas = Table.TransformColumns(Tabela, List.Transform(Datas, (c) => {c, each try Date.FromText(_, [Format = "yyyy-MM-dd"]) otherwise null, type date})),
    ComInteiros = Table.TransformColumnTypes(ComDatas, List.Transform(Inteiros, (c) => {c, Int64.Type}), "en-US"),
    ComLogicos = Table.TransformColumns(ComInteiros, List.Transform(Logicos, (c) => {c, each _ = "True", type logical}))
in
    ComLogicos
