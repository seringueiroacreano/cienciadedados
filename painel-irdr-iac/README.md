# Painel de Aferição IRDR e IAC — estudo e ETL

Estudo técnico para o painel Power BI que acompanha o indicador de **IRDR e IAC** do Prêmio TJAC de
Qualidade 2026 (Portaria PRESI nº 1.961/2026, alterada pela nº 4.335/2026: Anexo I, item E;
Anexos II e III; Anexo IV, item 18). Também inclui o ETL em Python que gera as tabelas do painel.

> **Prazo.** O período de apuração termina em **30/11/2026**. Este estudo é de 27/11/2026, a 3 dias
> do encerramento. Até lá não dá para publicar um painel homologado. O caminho realista tem duas fases:
> (1) usar o ETL para fechar a **aferição final** a partir da matriz da SEJUD, logo após 30/11;
> (2) publicar o painel completo como ferramenta permanente para o ciclo 2027.

---

## 1. Regra que o painel precisa reproduzir

| Elemento | Regra (matriz da SEJUD / Portaria) |
|---|---|
| Escopo | Gabinetes de desembargadores informados pela SEJUD. Presidência, Vice-Presidência e Corregedoria ficam fora. |
| Período | 01/01 a 30/11/2026. A aferição parcial vai até a data de corte. |
| **SUS** (10 pts) | Suscitamento **ou** admissão do incidente no período (o marco documentado escolhido). Conta uma vez por incidente. |
| **TESE** (25 pts) | Julgamento com tese fixada no período. |
| Combinação | O mesmo incidente pode somar SUS e TESE (até 35 pts). |
| Seleção | Entram os **2 incidentes de maior pontuação** por gabinete. O teto é de **70 pts**. Em empate, vale a ordem das linhas. |
| Evidência | Cada ato precisa de evidência (DJe, decisão, acórdão). Sem evidência, o ato não pontua e vira pendência. |
| "Sem registros" | Só vale com confirmação expressa da SEJUD para o período. |

Essas regras estão em `irdr_iac/regras.py`, com testes em `testes/test_regras.py`.

## 2. Diagnóstico das bases recebidas

| Arquivo | O que é de fato | Linhas | Serve para a pontuação? |
|---|---|---|---|
| `Matriz_Afericao_IRDR_IAC_TJAC_2026.xls` | Modelo da matriz em branco | — | Não (é o modelo) |
| `Matriz_..._Gabinetes.xls` | A mesma matriz, com os **11 gabinetes** cadastrados. **Nenhum incidente lançado**; todos aparecem em "Aguardando manifestação ou fonte" | 11 gabinetes / 0 incidentes | **Sim: é a fonte oficial** |
| `IRDR.csv` | Processos **sobrestados** por tema (movimentos TPU 265/11975), de **todas** as espécies: RG/STF, repetitivos/STJ e IRDR | 13.117 (9.232 ids, 5.999 processos) | **Não** |
| `QTD_TEMAS.csv` | Cópia **idêntica** do `IRDR.csv`, sem a coluna `nome` (conferido linha a linha) | 13.117 | Redundante: descartar |
| `MAGISTRADOS.csv` | Ponte processo → relator. Só SAJ. 30% de linhas duplicadas | 14.772 | Não (veja os riscos) |

### Achados críticos

1. **A extração não mede o indicador.** O indicador pontua **atos do gabinete** em incidentes
   instaurados no TJAC (suscitar, admitir, julgar com tese). O `IRDR.csv` lista **processos suspensos
   à espera de um precedente**, ou seja, o impacto do precedente no acervo. São fenômenos diferentes.
2. **Nenhum registro de IRDR em 2026** e **nenhum registro de IAC** na extração inteira.
   Pela extração, todos os gabinetes teriam 0 ponto, e esse resultado estaria errado.
3. **O rótulo "IRDR" está aplicado de forma errada.** Das 1.784 linhas marcadas como IRDR, 1.783
   têm número de tema que também aparece como Repercussão Geral ou Repetitivo. Exemplo: o Tema 551
   aparece 6.257 vezes como RG e 1.519 vezes como "IRDR". São temas nacionais (551, 1218, 1150, 1145…),
   não IRDR do TJAC. Isso é um problema de **cadastro no sobrestamento** (SAJ/eproc) e deve ir para a
   SEJUD/NUGEPNAC, porque também afeta os dados enviados ao BNPR/CNJ.
4. **Há 19 rótulos de tema para 5 espécies** (variações de maiúsculas, "FORA DE USO", "Tema 1369"
   dentro do rótulo). O ETL padroniza esses rótulos na coluna `especie`/`tribunal`.
5. **O relator não pode ser atribuído pelo `MAGISTRADOS.csv`.** 838 processos têm mais de um relator,
   e o arquivo não traz data. Ele cobre só 42,8% dos processos da extração.
6. **Divergências de cadastro.** A extração cita o "Gabinete do Des. Samoel Martins Evangelista",
   as 1ª e 2ª Câmaras Cíveis e a Vice-Presidência, que não estão na matriz. O ETL liga os nomes curtos
   aos nomes completos da matriz, e os 11 gabinetes ficaram ligados. A SEJUD precisa confirmar se a
   matriz deve incluir algum gabinete que não está nela.

**Conclusão metodológica.** A pontuação sai **só da Matriz da SEJUD**, com evidência documental.
Os dados de sobrestamento entram no painel como **contexto** (impacto dos precedentes) e como **pista
de auditoria**, nunca como fonte de pontos.

## 3. Arquitetura

```
Matriz SEJUD (.xls/.xlsx, SharePoint)  ──┐
IRDR.csv (sobrestamento, extração SAJ/eproc) ──┼─► python -m irdr_iac ─► saida/*.csv ─► Power BI (Power Query: LerTabela)
MAGISTRADOS.csv (opcional) ─────────────┘          (regras + qualidade)
```

O cálculo fica no Python, que é testável e versionado. O Power BI só **lê e exibe** os resultados.
Assim, a regra da Portaria não fica escondida em DAX e o resultado do painel bate com o da matriz.

### Modelo estrela

| Tabela | Grão | Chave / relação |
|---|---|---|
| `dParametros` | 1 linha | datas (início, encerramento, corte), pontos, teto |
| `dGabinete` | gabinete | `gabinete` (1) → `fIncidente`, `fPontuacaoGabinete`; → `fSobrestamento[gabinete_matriz]` (**inativa**) |
| `fIncidente` | incidente | SUS, TESE, potencial, ordem no gabinete, selecionado, pendências |
| `fPontuacaoGabinete` | gabinete | igual à aba "Relatório Parcial" + situação |
| `fSobrestamento` | processo × tema × recebimento | `numero_tema` → `dTema`; `data_recebimento` → `dCalendario` |
| `dTema` | tema | espécie e tribunal predominantes, nº de processos, sinal de rótulo conflitante |
| `bRelator` | processo × relator | só para consulta, sem medidas de pontuação |
| `qualidade` | achado | gravidade, valor, impacto |
| `dCalendario` | dia | criar no Power BI com `CALENDAR(DATE(2010,1,1), DATE(2027,12,31))` |

As medidas estão em `powerbi/medidas.dax`, e a função de carga em `powerbi/carregar_tabelas.pq`.

## 4. Páginas do painel

| # | Página | Pergunta que responde | Visuais |
|---|---|---|---|
| 1 | **Visão Geral** | Como está a aferição do Tribunal? | Cartões: pontos totais, % do teto (770 = 11 × 70), gabinetes aferidos/pendentes, dias para o encerramento. Barra empilhada SUS × TESE por gabinete com linha de teto (70). Rosca da situação da aferição. |
| 2 | **Gabinetes** | Quem pontuou, quem falta, e quanto falta? | Matriz gabinete × (registros, SUS, TESE, selecionados, pontos, pontos para o teto, situação com semáforo). Ranking com empate mantido. |
| 3 | **Incidentes** | Quais incidentes contam, e por quê? | Tabela: processo, espécie, data SUS, data julgamento, potencial, ordem, **selecionado**, pendências. Linha do tempo (jan–nov) dos atos SUS e TESE. Cartão "pontos potenciais não computados" (efeito do limite de 2). |
| 4 | **Pendências e Evidências** | O que impede a homologação? | Lista de pendências por gabinete (SUS sem evidência, tese sem data, gabinete sem manifestação). Esta é a página de trabalho da SEJUD. |
| 5 | **Impacto dos Precedentes** *(contexto)* | Quanto acervo está parado à espera de tema? | Processos suspensos por tribunal (STF/STJ/TJAC), top 10 temas, tempo médio suspenso, sobrestados por gabinete, mapa por comarca. Aviso fixo: "não compõe a pontuação". |
| 6 | **Qualidade dos Dados** | A base é confiável? | Tabela `qualidade` com gravidade. Temas com rótulo conflitante. Cobertura do arquivo de relatores. |

Filtros globais: data de corte (parâmetro), espécie (IRDR/IAC), gabinete. Para a versão publicada,
mascarar o número dos processos sigilosos (228 linhas com `sigilo = S`).

## 5. Ligação com a Estratégia (Res. CNJ 325/2020)

- **Macrodesafios:** "Consolidação do sistema de precedentes obrigatórios" e "Agilidade e produtividade
  na prestação jurisdicional".
- **Sugestão de indicador permanente para 2027**, além do prêmio: (a) tempo entre admissão e
  julgamento do IRDR/IAC (para o IRDR, o CPC, art. 980, fixa 1 ano); (b) processos sobrestados por tema do TJAC e
  tempo de suspensão; (c) conformidade do cadastro no BNPR.
- **RAE:** levar a página 1 e a página 6 à RAE quadrimestral. Os achados críticos de cadastro (item 2.3)
  são pauta de governança, não só de TI.

## 6. Riscos e recomendações

| Risco | Prob./Impacto | Recomendação |
|---|---|---|
| Matriz sem incidentes a 3 dias do encerramento | Alta / Alta | A SEJUD lança os incidentes e as evidências até 30/11. A apuração final roda no ETL. |
| Usar a extração de sobrestamento como fonte de pontos | Média / Alta | Fica vetado. A pontuação vem só da matriz (seção 2). |
| Rótulo "IRDR" errado no sobrestamento | Confirmado / Médio | Saneamento pela SEJUD/NUGEPNAC e revisão da tabela de temas no SAJ/eproc. |
| Divergência entre a matriz e o painel | Baixa / Alta | Mesmo cálculo para os dois: rodar o ETL sobre a matriz e conferir com a aba "Relatório Parcial". |
| Gabinete sem titular ou recém-criado fora da matriz | Média / Média | A SEJUD confirma o cadastro, com atenção ao Gabinete Samoel M. Evangelista. |
| Dados sigilosos no painel publicado | Baixa / Alta | Mascarar o número e aplicar RLS por perfil no Power BI Service. |

**Dados de que o painel ainda depende (pedir à SEJUD/DITEC):**
1. A matriz preenchida: incidentes com datas de suscitamento, admissão e julgamento, tese e evidências.
2. A lista oficial de IRDR/IAC do TJAC (BNPR/NUGEPNAC): número do tema local, data de admissão, data do
   julgamento e tese. Com ela, o ETL pode **conferir automaticamente** o que a matriz declara.
3. Uma extração de movimentos com data para os incidentes das classes IRDR e IAC (conferir os códigos na TPU/CNJ),
   em vez da extração de sobrestamento.

## 7. Como rodar

```bash
cd painel-irdr-iac
pip install pandas xlrd openpyxl
python -m unittest discover -s testes -t .
python -m irdr_iac CAMINHO/Matriz_Afericao_IRDR_IAC_TJAC_2026_Gabinetes.xls --irdr CAMINHO/IRDR.csv --magistrados CAMINHO/MAGISTRADOS.csv --saida saida
```

Use `--corte AAAA-MM-DD` para simular uma aferição parcial em outra data. Os CSV de entrada e de saída
não são versionados (`.gitignore`), porque contêm números de processos.
