# Prêmio TJAC de Qualidade 2026 — Sistema de Recursos e Impugnações

Formulário eletrônico da etapa recursal do **Prêmio de Qualidade do Poder Judiciário do Estado do Acre (ano-base 2026)**.
Segue a Portaria PRESI nº 1.961/2026, com as alterações das Portarias nº 4.335/2026 e nº 4.919/2026.
A estrutura replica o *Formulário para submissão de recursos contra os Resultados* do Prêmio CNJ de Qualidade 2026.

| Item | Onde está |
|---|---|
| Formulário (HTML) | `apps-script/Formulario.html`, com cópia em `site/index.html` |
| Servidor (regras, banco, PDFs) | `apps-script/Code.gs` |
| Lista de unidades e matriz de indicadores | `dados/` (gerados por `scripts/build.py`) |
| Banco de dados | Google Drive: pasta **Prêmio TJAC de Qualidade 2026 — Sistema de Recursos (BD)** |

## Identidade visual

O formulário e os PDFs usam a identidade do Poder Judiciário do Estado do Acre: vinho `#A01027` (principal) e `#84172E` (logotipo). Os arquivos estão em `assets/`:

- `simbolo_pjac.png`: símbolo sobre fundo vinho, usado no cabeçalho do formulário;
- `logo_pjac.png`: logotipo completo, usado no cabeçalho do registro e dos relatórios em PDF.

O `build.py` embute as duas imagens (base64) no `Formulario.html` e no `Logo.gs`, sem depender de URL externa.

## 1. Como funciona

```
Unidade ──► Formulário (Apps Script) ──► Planilha BD_Recursos_PremioTJAC_2026 (abas)
                                     ├─► 01_Anexos_Recursos/<código - unidade>/<ID>/
                                     ├─► 02_Registros_PDF/<código - unidade>/Registro_<ID>.pdf  (+ e-mail ao responsável)
                                     ├─► 03_Impugnacoes_Servidores/<código - unidade>/<ID>/
                                     └─► 04_Relatorios_Finais_por_Unidade/Relatorio_Final_<código>_<unidade>.pdf
```

**Formulário de recurso.** Tem 2 passos, como o do CNJ.

- **Passo 1 — Identificação do Respondente.** Pede o órgão, a unidade, CPF, nome, e-mail, cargo e matrícula. Também pede o **código de verificação** enviado ao e-mail institucional.
- **Passo 2 — Questionário.** Para cada eixo pergunta "Você pretende apresentar recurso…? Sim/Não". Em seguida pede os itens recorridos. Para cada item marcado abre:
  - a fundamentação (até 4.000 caracteres);
  - as **5 evidências obrigatórias do Anexo III, item 3**: (a) painel/relatório; (b) filtros de período, unidade e classe; (c) período de referência; (d) memória de cálculo com a pontuação atribuída e a pretendida; (e) os números CNJ (com dígito verificador validado) e a quantidade exata;
  - os anexos.
- **Eixos por categoria de unidade.** Seguem o Anexo I consolidado:

| Categoria | Perguntas (eixos) | Itens |
|---|---|---|
| 1º grau | Indicadores Gerais · Indicadores Temáticos | Nº 1–6 · Nº 7–17 |
| Gabinete de Desembargador(a) | Gerais 2º grau · Temáticos 2º grau · Precedentes | Nº 18–22 · 23–25 · 26–27 |
| SEJUD | ISJ | Nº 28 |
| Vice-Presidência | Indicadores VPRES | Nº 29–32 |

Todos os itens do grau aparecem, como no formulário do CNJ. O selo **"competência compatível"** é só uma indicação a partir das competências MPM. A aplicabilidade é declarada pela Unidade Gestora (art. 10, § 1º).

**Regras aplicadas no servidor.** Não dependem do navegador.

- **Prazo:** aceita envios de 04/12/2026 00h00 a **07/12/2026 23h59min59s (UTC-5)**.
- **Preclusão consumativa (art. 7º, § 4º):** aceita um único recurso por unidade. A verificação roda sob trava (`LockService`), para evitar dois envios simultâneos. Para liberar um recurso enviado por engano, a Gestão marca `ANULADO` na coluna `situacao`.
- **Cláusula de barreira:** recusa o envio sem as evidências a–e. O envio que não chega é melhor que um recurso "não conhecido".
- **Impugnação da lista de servidores:** é autônoma e não sofre preclusão (art. 7º, § 5º). O formulário calcula os meses de lotação dentro de 01/01–30/11/2026 (art. 6º).
- **Comprovante:** cada envio gera um PDF no formato do registro do CNJ. O PDF traz o cabeçalho do TJAC, o ID da Entrada e um código de verificação (SHA-256). O PDF é gravado no Drive, enviado por e-mail e oferecido para download.

**Julgamento (Comissão Revisora).** O julgamento é registrado na aba `Itens`, nas colunas `comissao_conhecimento`, `comissao_merito`, `comissao_pontuacao_final` e `comissao_fundamentacao`. As colunas têm listas suspensas. As impugnações são decididas na aba `Impugnacoes`, colunas `decisao` e `decisao_observacao`.

**Relatório final por unidade.** No menu da planilha, use *Prêmio TJAC 2026 › Gerar relatórios finais (todas as unidades)*. O sistema gera 1 PDF para **cada uma das 160 unidades** da lista, conforme a situação:

- **com recurso:** itens recorridos, decisões da Comissão e pontuação final;
- **avaliada sem recurso:** certidão de não interposição, com a ressalva do art. 13, § 2º;
- **fora da abrangência ou excluída:** certidão própria.

Todas as versões incluem as impugnações da unidade. O processamento roda em lotes de ~4,5 min e se reagenda sozinho (limite de 6 min do Apps Script). O índice com os links fica na aba `Relatorios_Finais`. **Gere os relatórios depois do julgamento, entre 08 e 18/12**, porque a certidão afirma que o prazo já terminou.

## 2. Implantação (cerca de 15 minutos, uma única vez)

O banco já foi criado no Google Drive de josuemdr@gmail.com:

- Pasta: <https://drive.google.com/drive/folders/11852PRzHAzAm9QbLLGwt3RBBDIKIFZxy>
- Planilha `BD_Recursos_PremioTJAC_2026` (aba de unidades já carregada): <https://docs.google.com/spreadsheets/d/1lEeYbzUayuWBOczsHKdBTkcl-YFiNm87U-1H3q40qSE/edit>
- Subpastas `01_…` a `04_…`

Passos:

1. Abra a planilha e vá em **Extensões › Apps Script**.
2. No editor, crie os arquivos e cole o conteúdo:
   - `Code.gs` ← `apps-script/Code.gs`
   - **Arquivo › Novo › Script**, com o nome `Logo` ← `apps-script/Logo.gs` (logotipo do PJAC usado nos PDFs)
   - **Arquivo › Novo › HTML**, com o nome `Formulario` ← `apps-script/Formulario.html`
   - Engrenagem › marque "Mostrar arquivo de manifesto" › `appsscript.json` ← `apps-script/appsscript.json`
3. Ajuste o bloco `CONFIG` no topo do `Code.gs`:
   - `EMAIL_COPIA` recebe o e-mail da Unidade Gestora.
   - `LOGO_URL` é opcional: o logotipo oficial já vem embutido em `Logo.gs`.
   - `DOMINIO_EMAIL` já vem como `tjac.jus.br`.
4. Selecione a função `configurar` e clique em **Executar**. Autorize o acesso a Planilhas, Drive e Gmail.
5. Clique em **Implantar › Nova implantação › App da Web**:
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
6. Copie a URL `…/exec`. Esse é o endereço a divulgar às unidades.
7. **Teste antes de 04/12:**
   - No menu da planilha, use *Prêmio TJAC 2026 › Ativar/desativar modo de teste*. O modo de teste ignora o prazo e o domínio do e-mail e marca os envios como teste.
   - Faça envios de teste.
   - Use *Excluir envios de teste* e **desative o modo de teste**.

> Opcional: o `site/index.html` pode ser publicado no GitHub Pages. Para isso, defina `ENDPOINT = 'URL /exec'` no arquivo ou abra a página com `?api=URL`. O formulário servido pelo próprio Apps Script continua sendo o caminho recomendado, porque não depende de CORS.

### Atualizar a lista de unidades ou os indicadores

```bash
cd premio-tjac-recursos
python scripts/build.py      # regenera dados/*.json, dados/Unidades_BD.csv, Formulario.html e site/index.html
```

Depois, cole o novo `Formulario.html` no Apps Script e crie uma **nova versão** da implantação. A categoria de cada unidade também pode ser corrigida direto na aba `Unidades` da planilha. O servidor lê essa aba, mas a lista exibida no formulário vem do `build.py`.

### Testes

```bash
cd premio-tjac-recursos/testes
AGORA=2026-12-05T10:00:00-05:00 node teste_servidor.js ../apps-script/Code.gs ../dados/unidades.json
```

O teste roda o `Code.gs` com simulações dos serviços Google e verifica:

- envio válido;
- bloqueio por preclusão;
- unidade inválida;
- recusa por falta de evidência;
- prazo;
- geração dos 160 relatórios finais.

## 3. Pontos de atenção (decisões da Unidade Gestora)

1. **Prazo exíguo.** O Resultado Preliminar sai na **sexta-feira, 04/12**, e o termo final é a **segunda-feira, 07/12**. Na prática, as unidades têm 1 dia útil. Somado à preclusão consumativa, o risco de recurso incompleto é alto. Recomenda-se divulgar o formulário e a lista de evidências antes de 04/12.
2. **Remissão inconsistente no art. 7º, § 5º.** O texto diz "o disposto no § 3º não se aplica às impugnações", mas a preclusão está no **§ 4º**. O sistema adota a leitura teleológica: impugnação não preclui. Convém corrigir por portaria.
3. **Conflito entre o art. 7º, § 1º (redação da Portaria 4.919) e os Anexos I/II.**
   - O art. 7º, § 1º passou a dizer que indicadores não aplicáveis "serão considerados **cumpridos**".
   - Os Anexos I, item I, "a", e II mantêm que são **excluídos do denominador**.
   - As duas regras produzem percentuais diferentes e serão matéria recorrente nos recursos.
4. **Total do 1º grau.** A consolidação (Portaria 4.919) indica **570** pontos para os Indicadores Gerais do 1º grau. O quadro A não foi alterado e soma **540** (120+60+130+40+70+120). No 2º grau, a mesma portaria elevou METAS-2G de 130 para 160 (+30). É provável que o mesmo ajuste tenha sido pretendido para METAS do 1º grau e não tenha sido transcrito. O formulário usa os valores do quadro A (METAS = 130) até haver esclarecimento.
5. **Cláusula de barreira, item (e).** O sistema exige número e quantidade de processos em todos os itens, como manda o Anexo III. Em indicadores sem processo identificável essa exigência pode inviabilizar o recurso: METAS, ISU, IRASP, ISJ, IRDR/IAC. Se a Comissão quiser flexibilizar, a mudança é de uma linha (validação "e" no `Code.gs` e no formulário). Mas precisa de orientação formal.
6. **Classificação das unidades.** É uma premissa e pode ser revista na aba `Unidades`:
   - CEJUSCs e Turmas Recursais estão como **1º grau**.
   - Câmaras, Pleno e TUJ estão como **fora da abrangência**, porque a avaliação do 2º grau é por gabinete.
   - VAJUR está como **fora da abrangência**.
   - Só o gabinete do Presidente (Des. Laudivon Nogueira) está marcado como excluído (art. 4º, § 3º). **Os gabinetes do Vice-Presidente e do Corregedor-Geral precisam ser marcados como `EXCLUIDA`.**
   - A lista recebida tem 12 gabinetes, todos com competências cíveis idênticas. Confira se faltam gabinetes da Câmara Criminal.
7. **Acesso público ao formulário.** O App da Web aceita qualquer pessoa, sem login Google. A mitigação é o código de verificação por e-mail `@tjac.jus.br`. Sem ela, qualquer pessoa poderia "precluir" o recurso de outra unidade.
8. **LGPD.** O CPF é gravado integralmente, como no registro do CNJ. Restrinja o compartilhamento da pasta à Unidade Gestora e à Comissão Revisora.
