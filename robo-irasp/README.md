# Robô IRASP (SNA e CNIEP)

Atualiza todo dia, às **7h no horário do Acre**, os componentes automáticos do IRASP
(Prêmio TJAC de Qualidade 2026, Portaria PRESI nº 1.961/2026, Anexo IV, item 6) no painel Power BI.

| Componente | Fonte consultada | Regra |
|---|---|---|
| SNA a: reavaliação de acolhimento | Painel Metabase da COGER (ranking por unidade) | ≥ 98% = 20; 90% a 97,99% = 10 |
| SNA b.1: adoção pelo cadastro | Painel Metabase da COGER | ≥ 80% = 10 |
| SNA b.2: destituição do poder familiar | Painel Metabase da COGER | ≥ 80% = 10 |
| SNA c: grupo étnico-racial | Painel Metabase da COGER | > 90% = 10 |
| CNIEP: inspeções em estabelecimentos penais | API de dados abertos do CNIEP/CNJ (Geopresídios) | (IPr + IFPr/2) ÷ (meses × estabelecimentos) × 30; mês sem inspeção zera |

SNA d.1 (GTI), d.2 (SFA) e CNIUPS **não** são automáticos: o robô copia esses valores da
apuração manual de base (`AP01`, em `config.json`).

## Como funciona

1. O GitHub Actions (`.github/workflows/irasp-diario.yml`) roda `python -m robo_irasp`.
2. O robô gera CSV com os mesmos cabeçalhos das tabelas da planilha e publica na ramificação
   **`dados-irasp`**, pasta `irasp/` (a última carga) e `historico/AAAA-MM-DD/` (uma por dia).
3. O painel Power BI lê esses CSV, junta com a planilha do SharePoint e cria a apuração **AUTO**:
   a apuração base com os componentes automáticos trocados pelos valores do dia.
   A planilha do SharePoint não é alterada.
4. Se o GitHub ou uma fonte falhar, o painel continua com a última carga publicada.

Arquivos publicados: `apuracoes.csv`, `pontuacao.csv`, `situacao.csv`, `sintese.csv`,
`memoria_sna.csv` (percentual de cada unidade), `memoria_cniep.csv` (matriz estabelecimento × mês)
e `status.json` (alertas do dia, como estabelecimento novo ou mês sem inspeção).

## Rodar à mão

```bash
cd robo-irasp
python -m unittest discover -s testes -t .   # testa as regras, sem internet
python -m robo_irasp saida                    # coleta e grava os CSV em ./saida
```

No GitHub: aba **Actions** › *Robô IRASP (SNA e CNIEP)* › **Run workflow**.

## Ligar o painel ao robô (uma vez)

1. Rode `python robo-irasp/powerbi/aplicar_no_modelo.py CAMINHO/IRASP_TJAC.SemanticModel/model.bim`
   (ou use o `model.bim` já ajustado que acompanha a entrega).
2. Abra o `.pbip` no Power BI Desktop, **Atualizar**. Na primeira vez, o Desktop pede acesso a
   `https://raw.githubusercontent.com`: escolha **Anônimo**, nível de privacidade **Público**.
3. Publique. No serviço, em *Credenciais da fonte de dados*, a fonte Web fica **Anônimo / Público**
   (o SharePoint continua OAuth2 / Organizacional). Agende a atualização para **7h30** (Rio Branco),
   depois do robô.
4. Para desligar o robô sem mexer no modelo: parâmetro `Robo_Ativo` = `false`.

## O que ajustar em `config.json`

- `sna.unidades`: nome da unidade no Metabase → Código MPM. Unidade nova aparece como alerta.
- `cniep.estabelecimentos`: estabelecimentos de cada vara criminal/execução penal.
- `cniep.fora_do_calculo`: estabelecimentos do AC ignorados (hoje, as duas unidades do Exército,
  sem nenhuma inspeção registrada).
- `cniep.divisor`: `"meses_fechados"` (padrão) ou `12` (leitura literal da fórmula).
- `cniep.dias_tolerancia`: dias após o fim do mês para ele contar (padrão 10).

## Cuidados

- O Metabase mostra o **retrato do dia**, não o fechamento do período. A apuração AUTO serve para
  acompanhamento; a apuração oficial continua sendo lançada na planilha.
- Uma unidade só conta no SNA se aparece no ranking do painel (tem acervo). Por isso o teto de
  uma unidade pode mudar de um dia para o outro.
- Se a COGER mudar o painel (novo card ou nova coluna), a coleta do SNA falha e gera um erro no
  Actions; o CNIEP segue sendo publicado.
