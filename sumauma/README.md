# Sumaúma

Sistema de gestão à vista e previsão das Metas Nacionais do Poder Judiciário (TJAC),
para uso interno. Junta a carga diária do Sumaúma RPA com um motor de previsão refeito
a partir da ideia do IAra.

## Camadas

| Camada | Onde está | Situação |
|---|---|---|
| 1. Ingestão: um download por meta, uma vez por dia | `motor/fontes.py` | pronta |
| 2. Armazenamento: Postgres (Supabase, região São Paulo) | `banco/migracoes/` | pronta |
| 3. Regras das metas (Glossário CNJ 2026) | `motor/regras.py` | pronta, com testes |
| 4. Previsão de cumprimento | — | a fazer |
| 5. Painéis com login e chat | — | a fazer |

## Rodar

```bash
cd sumauma
python -m unittest discover -s testes -t .      # testes das regras
python -m motor.fontes ../bruto                 # baixa as bases (consulta o TJAC)
python -m motor.carga ../bruto --sem-banco      # aplica as regras e mostra o resumo
python -m motor.carga ../bruto                  # grava no banco (precisa das duas variáveis abaixo)
```

Só a biblioteca padrão do Python é usada.

## Banco e acesso

- Só entra quem tem e-mail `@tjac.jus.br` ou está em `acessos_liberados`.
- Quem tem perfil lê os dados; só a carga diária grava, com a chave de serviço.
- Tabelas: `cargas`, `unidades`, `indicadores_diarios`, `serie_mensal`, `fila_trabalho`,
  `previsoes`, `perfis`, `acessos_liberados`, `conversas`, `mensagens`.

## Configuração da carga no GitHub

Em Settings → Secrets and variables → Actions do repositório:

- variável `SUPABASE_URL`: endereço do projeto no Supabase;
- segredo `SUPABASE_SERVICE_KEY`: chave de serviço do projeto (nunca vai para o código).

Sem elas a rotina diária continua publicando a cópia lida pela página do Sumaúma RPA e
apenas avisa que a gravação no banco foi pulada.

## Conferência

`testes/conferir_gabarito.py` compara as regras com os números validados contra o painel
oficial na base de 11/11/2026.
