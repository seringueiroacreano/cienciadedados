Acrescente ao app uma "Lista de trabalho" por unidade judiciária, para as Metas 2, 4, 6, 7, 8 e 10. Hoje o Excel sai organizado por variável (Distribuidos, Julgados, Suspensos), e a unidade precisa cruzar as abas para descobrir o que falta julgar. A lista de trabalho entrega um processo por linha, já classificado. Não altere o Excel por variável que já existe.

## Regra (glossário do CNJ, Metas Nacionais 2026, Justiça Estadual)
- Identifique o processo pela coluna `id_processo` (não por `numero`: um mesmo número pode ter mais de um id).
- Tipo da variável, pelo começo do valor de `var`, sem diferenciar maiúsculas: "Distribuidos…" = distribuído; "Julgados…" = julgado; "Suspensos…" = suspenso; "Dessobrestados…" = dessobrestado.
- Agrupe as linhas por (recorte da meta, id_processo). Só entram processos que têm linha de distribuído. Situação, nesta ordem de prioridade:
  1. tem julgado → **Julgado**
  2. tem dessobrestado → **Fora do cômputo** (só ocorre na Meta 2, antigos)
  3. tem suspenso → **Suspenso**
  4. senão → **A julgar**
- `dt_evento` da linha de distribuído = data de distribuição; da linha de julgado = data do julgamento; da linha de suspenso = data da suspensão.

## Recortes e percentual exigido
- Meta 2: se `var` contém "Antigos" → "Antigos (15 anos ou mais)", 100%. Senão, pela coluna `grau`: G1 → "1º grau", 80%; G2 → "2º grau", 90%; JE ou TR → "Juizados e Turmas Recursais", 95%. Um processo antigo aparece nos dois recortes (o do grau e o de antigos); isso é esperado.
- Meta 4: sufixo `_a` → "Crimes contra a administração pública", 65%; `_b` → "Improbidade administrativa", 100%.
- Meta 6 (sem sufixo): "Ações ambientais", 50%.
- Meta 7: `_a` → "Comunidades indígenas", 50%; `_b` → "Comunidades quilombolas", 50%; `_c` → "Racismo e injúria racial", 50%.
- Meta 8: `_a` → "Violência doméstica", 90%; `_b` → "Feminicídio", 75%.
- Meta 10: `_a` → "1º grau", 90%; `_b` → "2º grau", 99%.

## Indicadores por recorte (das unidades marcadas)
- base = distribuídos − suspensos − fora do cômputo
- cumprimento (%) = julgados ÷ base ÷ percentual exigido × 100, com uma casa decimal
- faltam = máximo entre 0 e (teto(percentual × base) − julgados)

## Tela (novo passo "4. Lista de trabalho", abaixo do Excel)
- Um cartão por recorte: selo com texto e cor ("Cumprida" se cumprimento ≥ 100; "Perto de cumprir" se ≥ 90; "Abaixo da meta" se menor), nome do recorte com o percentual exigido, o cumprimento em destaque, a frase "Faltam N julgamento(s) para cumprir" (ou "Meta atingida; ainda há processos a julgar" / "Nenhum processo a julgar") e a linha "X a julgar · Y suspenso(s) · Z julgado(s) · W distribuído(s)".
- Tabela "A julgar", do processo mais antigo para o mais novo (ordenar pela data de distribuição): Processo, Distribuído em (dd/mm/aaaa), Classe, Recorte, Unidade. Mostrar os 100 mais antigos na tela e avisar que o Excel traz todos.
- Botão "Baixar lista de trabalho": Excel com as abas Resumo (uma linha por unidade × recorte: Unidade, Recorte da meta, Percentual exigido, Distribuídos, Suspensos, Fora do cômputo, Julgados, A julgar, Cumprimento, Faltam para cumprir), A julgar, Suspensos (com "Suspenso em"), Julgados (com "Julgado em") e, se houver, Fora do cômputo. Colunas das abas de processos: Processo, Distribuído em, [data do evento], Recorte da meta, Unidade, Município, Grau, Classe, Natureza, Sistema. Número do processo como texto; datas como data dd/mm/aaaa. Nome do arquivo: `lista_trabalho_meta_NN_<unidade ou "N_unidades">_AAAAMMDD_HHMM.xlsx`.
- Para as Metas 1, 3 e 5 mostrar apenas o aviso: "A lista de trabalho existe para as Metas 2, 4, 6, 7, 8 e 10. Esta meta segue outra regra de cálculo; use o Excel por variável."
- Texto fixo de rodapé do passo: "Regra do glossário do CNJ: está a julgar o processo distribuído que não foi julgado nem suspenso. O 'faltam' por unidade aplica à unidade o percentual que a meta exige do tribunal; é referência de gestão, não o resultado oficial."

## Ajuste no resumo do passo 3
Conte processos distintos por `id_processo` em cada variável, em vez de linhas (na Meta 1 há 1.650 linhas de Suspensos para 1.501 processos; o painel oficial conta processos).

## Histórico (banco)
Na coleta automática, grave também, por meta × unidade × recorte: distribuídos, suspensos, julgados, a julgar, cumprimento e faltam. Na tela Histórico, mostre a evolução de "a julgar" e do cumprimento por recorte.

## Validação obrigatória (base que o TJAC publicou em 11/11/2026)
- Meta 2, "1ª Vara Cível de Cruzeiro do Sul": 1º grau com 935 distribuídos, 6 suspensos, 841 julgados, 88 a julgar, cumprimento 113,2%, faltam 0. O mais antigo a julgar é 0702027-80.2015.8.01.0002, distribuído em 21/09/2015.
- Meta 2, todas as unidades: 1º grau 25.988 / 1.179 / 23.759 / 1.050 a julgar, 119,7%; 2º grau 2.953 / 16 / 2.936 / 1, 111,1%; Juizados e Turmas 7.640 / 281 / 7.344 / 15, 105,0%; Antigos 99 distribuídos, 35 julgados, 3 a julgar, 92,1%, faltam 3.
- Meta 4, todas: Crimes 553 / 37 / 513 / 3, 153,0%; Improbidade 199 / 6 / 191 / 2, 99,0%, faltam 2.
- Meta 6, todas: 327 / 53 / 229 / 45, 167,2%.
- Meta 8, todas: Violência doméstica 1.650 / 509 / 1.104 / 37, 107,5%; Feminicídio 74 / 8 / 62 / 4, 125,3%.
- Meta 10, todas: 1º grau 8.594 / 90 / 8.487 / 17, 110,9%; 2º grau 400 / 0 / 400 / 0, 101,0%.

Ao final, teste no navegador (celular e desktop), salve as alterações no histórico do projeto e diga objetivamente o que passou, o que falhou e o que não foi possível testar.
