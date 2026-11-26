/**
 * Prêmio TJAC de Qualidade 2026 — Sistema de Recursos e Impugnações
 * Portaria PRESI nº 1.961/2026 (alterada pelas Portarias nº 4.335/2026 e nº 4.919/2026)
 *
 * Banco de dados: a planilha à qual este script está vinculado (Google Sheets) e a
 * pasta do Google Drive onde ela está. Ver README.md do repositório.
 *
 * Abas da planilha:
 *   Unidades      — lista de unidades e categoria de avaliação (editável pela Unidade Gestora)
 *   Recursos      — 1 linha por recurso (cabeçalho do envio)
 *   Itens         — 1 linha por item recorrido, com as evidências do Anexo III e as
 *                   colunas de julgamento da Comissão Revisora
 *   Impugnacoes   — 1 linha por servidor(a) impugnado(a)
 *   Relatorios_Finais — índice dos relatórios finais gerados por unidade
 *   Log           — registro técnico de eventos
 */

// ============================== CONFIGURAÇÃO ==============================
var CONFIG = {
  PLANILHA_ID: '',            // vazio = planilha vinculada a este script
  PASTA_RAIZ_ID: '',          // vazio = pasta onde a planilha está
  PRAZO_INICIO: '2026-12-04T00:00:00-05:00', // publicação do Resultado Preliminar (art. 5º, II)
  PRAZO_FIM: '2026-12-07T23:59:59-05:00',    // termo final (art. 5º, III) — horário do Acre
  FUSO: 'America/Rio_Branco',
  DOMINIO_EMAIL: 'tjac.jus.br', // e-mail do responsável deve ser institucional ('' desativa)
  EXIGIR_CODIGO_EMAIL: true,    // envio só com código de verificação enviado ao e-mail
  EMAIL_COPIA: '',              // e-mail da Unidade Gestora do Prêmio (cópia dos registros)
  LOGO_URL: '',                 // opcional: substitui o logotipo embutido (Logo.gs) por uma URL pública
  PASTAS: {
    anexos: '01_Anexos_Recursos',
    registros: '02_Registros_PDF',
    impugnacoes: '03_Impugnacoes_Servidores',
    finais: '04_Relatorios_Finais_por_Unidade'
  },
  LIMITE_TEXTO: 4000,
  LIMITE_ARQ_MB: 10,
  LIMITE_TOTAL_MB: 25,
  TITULO: 'Prêmio TJAC de Qualidade 2026'
};

var CABECALHOS = {
  Recursos: ['id', 'data_hora', 'timestamp_iso', 'codigo_unidade', 'unidade', 'categoria', 'cpf', 'nome', 'email', 'cargo',
    'matricula', 'qtd_itens', 'itens', 'pasta_anexos', 'registro_pdf', 'codigo_verificacao', 'teste', 'situacao', 'observacao_gestao'],
  Itens: ['id', 'codigo_unidade', 'unidade', 'eixo', 'n', 'sigla', 'indicador', 'pontos_max', 'fundamentacao',
    'a_fonte_tipo', 'a_fonte_identificacao', 'b_filtro_periodo', 'b_filtro_unidade', 'b_filtro_classe', 'b_filtros_outros',
    'c_ref_inicio', 'c_ref_fim', 'd_memoria_calculo', 'd_pontuacao_atribuida', 'd_pontuacao_pretendida',
    'e_processos', 'e_quantidade', 'anexos', 'teste',
    'comissao_conhecimento', 'comissao_merito', 'comissao_pontuacao_final', 'comissao_fundamentacao', 'comissao_data'],
  Impugnacoes: ['id', 'data_hora', 'timestamp_iso', 'codigo_unidade', 'unidade', 'cpf', 'nome', 'email', 'matricula',
    'servidor_nome', 'servidor_matricula', 'pedido', 'lotacao_inicio', 'lotacao_fim', 'meses_no_periodo',
    'fundamentacao', 'anexos', 'registro_pdf', 'teste', 'decisao', 'decisao_observacao'],
  Relatorios_Finais: ['codigo_unidade', 'unidade', 'categoria', 'situacao_recursal', 'id_recurso', 'qtd_impugnacoes', 'relatorio_pdf', 'gerado_em'],
  Log: ['data_hora', 'evento', 'detalhe']
};

// Matriz do Anexo I (espelha dados/indicadores.json; usada na validação do servidor).
var EIXOS = {
  '1G_GERAIS': { titulo: 'Indicadores Gerais do 1º Grau', itens: [[1, 'IAD-C', 120], [2, 'TPL', 60], [3, 'METAS', 130], [4, 'IREA', 40], [5, 'ISU', 70], [6, 'IRASP', 120]] },
  '1G_TEMATICOS': { titulo: 'Indicadores Temáticos do 1º Grau', itens: [[7, 'TPL-VDF', 30], [8, 'TPL-FEM', 30], [9, 'TM-MPU', 40], [10, 'TPL-Saúde', 40], [11, 'ICAP', 40], [12, 'IAD-Amb', 30], [13, 'IJ-Amb', 30], [14, 'IPV-PR/LC-SEEU', 60], [15, 'IEP-TP', 30], [16, 'I-ACS', 20], [17, 'C-AI', 20]] },
  '2G_GERAIS': { titulo: 'Indicadores Gerais do 2º Grau - Gabinetes', itens: [[18, 'IAD-C-2G', 120], [19, 'TPL-2G', 60], [20, 'METAS-2G', 160], [21, 'IREA-2G', 70], [22, 'ISU-2G', 50]] },
  '2G_TEMATICOS': { titulo: 'Indicadores Temáticos do 2º Grau', itens: [[23, 'TPL-Saúde-2G', 20], [24, 'IAD-Amb-2G', 30], [25, 'IJ-Amb-2G', 20]] },
  '2G_PRECEDENTES': { titulo: 'Precedentes Qualificados (2º Grau)', itens: [[26, 'IRDR/IAC-SUS', 20], [27, 'IRDR/IAC-TESE', 50]] },
  'SEJUD': { titulo: 'Índice de Desempenho da Secretaria Judiciária (SEJUD)', itens: [[28, 'ISJ', 650]] },
  'VPRES': { titulo: 'Índice de Desempenho da Vice-Presidência', itens: [[29, 'IAD-VPRES', 120], [30, 'TPL-VPRES', 120], [31, 'TPL-Saúde-VPRES', 40], [32, 'ISU-VPRES', 70]] }
};
var CATEGORIAS = {
  '1G': { rotulo: 'Unidade judiciária de 1º grau', eixos: ['1G_GERAIS', '1G_TEMATICOS'], avaliada: true },
  '2G_GAB': { rotulo: 'Gabinete de Desembargador(a)', eixos: ['2G_GERAIS', '2G_TEMATICOS', '2G_PRECEDENTES'], avaliada: true },
  'SEJUD': { rotulo: 'Secretaria Judiciária', eixos: ['SEJUD'], avaliada: true },
  'VPRES': { rotulo: 'Vice-Presidência', eixos: ['VPRES'], avaliada: true },
  'EXCLUIDA': { rotulo: 'Excluída (art. 4º, § 3º)', eixos: [], avaliada: false },
  'FORA': { rotulo: 'Fora da abrangência do Prêmio (art. 4º)', eixos: [], avaliada: false }
};

// ============================== WEB APP ==============================
function doGet(e) {
  if (e && e.parameter && e.parameter.acao === 'status') {
    return json_(apiStatus_({ codigo: e.parameter.codigo }));
  }
  return HtmlService.createHtmlOutputFromFile('Formulario')
    .setTitle('Recursos — ' + CONFIG.TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Usado quando o formulário roda fora do Apps Script (ex.: GitHub Pages). */
function doPost(e) {
  var corpo = {};
  try { corpo = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, erro: 'Requisição inválida.' }); }
  return json_(despachar_(corpo.acao, corpo.dados || {}));
}

/** Usado pelo formulário servido pelo próprio Apps Script (google.script.run). */
function api(acao, dadosJson) {
  return JSON.stringify(despachar_(acao, JSON.parse(dadosJson || '{}')));
}

function despachar_(acao, dados) {
  try {
    switch (acao) {
      case 'config': return { ok: true, prazo: { inicio: CONFIG.PRAZO_INICIO, fim: CONFIG.PRAZO_FIM }, modoTeste: modoTeste_(), exigeCodigo: CONFIG.EXIGIR_CODIGO_EMAIL, dominio: CONFIG.DOMINIO_EMAIL };
      case 'status': return apiStatus_(dados);
      case 'enviarCodigo': return apiEnviarCodigo_(dados);
      case 'enviarRecurso': return apiEnviarRecurso_(dados);
      case 'enviarImpugnacao': return apiEnviarImpugnacao_(dados);
      default: return { ok: false, erro: 'Ação desconhecida.' };
    }
  } catch (err) {
    log_('ERRO ' + acao, String(err && err.stack || err));
    return { ok: false, erro: String(err && err.message || err) };
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================== REGRAS ==============================
function prazoAberto_() {
  if (modoTeste_()) return { aberto: true };
  var agora = new Date(), ini = new Date(CONFIG.PRAZO_INICIO), fim = new Date(CONFIG.PRAZO_FIM);
  if (agora < ini) return { aberto: false, msg: 'O prazo recursal ainda não começou (Resultado Preliminar em 04/12/2026).' };
  if (agora > fim) return { aberto: false, msg: 'Prazo encerrado em 07/12/2026, 23h59min59s (art. 5º, III, da Portaria PRESI nº 1.961/2026).' };
  return { aberto: true };
}

function modoTeste_() { return PropertiesService.getScriptProperties().getProperty('MODO_TESTE') === 'SIM'; }

function unidade_(codigo) {
  var linhas = tabela_('Unidades');
  for (var i = 0; i < linhas.length; i++) if (String(linhas[i].codigo) === String(codigo)) return linhas[i];
  return null;
}

/** Recurso válido anterior da unidade (ignora testes e anulados). */
function recursoAnterior_(codigo) {
  var linhas = tabela_('Recursos');
  for (var i = 0; i < linhas.length; i++) {
    var r = linhas[i];
    if (String(r.codigo_unidade) === String(codigo) && r.teste !== 'SIM' && String(r.situacao).toUpperCase() !== 'ANULADO') return r;
  }
  return null;
}

function apiStatus_(d) {
  var r = recursoAnterior_(d.codigo);
  return { ok: true, jaInterpos: !!r, idEntrada: r ? r.id : null, dataHora: r ? r.data_hora : null };
}

function validaCPF_(s) {
  var c = String(s || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (var t = 9; t < 11; t++) {
    var soma = 0; for (var i = 0; i < t; i++) soma += parseInt(c[i], 10) * (t + 1 - i);
    if ((soma * 10) % 11 % 10 !== parseInt(c[t], 10)) return false;
  }
  return true;
}
function fmtCPF_(s) { var d = String(s).replace(/\D/g, ''); return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); }

function cnj_(s) {
  var d = String(s || '').replace(/\D/g, ''); if (d.length !== 20) return null;
  var N = d.slice(0, 7), DD = d.slice(7, 9), A = d.slice(9, 13), J = d.slice(13, 14), TR = d.slice(14, 16), O = d.slice(16, 20);
  var r1 = parseInt(N, 10) % 97, r2 = parseInt(String(r1) + A + J + TR, 10) % 97, r3 = parseInt(String(r2) + O + DD, 10) % 97;
  return r3 === 1 ? N + '-' + DD + '.' + A + '.' + J + '.' + TR + '.' + O : null;
}

function validaRespondente_(r) {
  var erros = [];
  if (!validaCPF_(r.cpf)) erros.push('CPF inválido.');
  if (!r.nome || String(r.nome).trim().length < 5) erros.push('Nome do responsável não informado.');
  var email = String(r.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.push('E-mail inválido.');
  else if (CONFIG.DOMINIO_EMAIL && !modoTeste_() && email.split('@')[1] !== CONFIG.DOMINIO_EMAIL) erros.push('Use o e-mail institucional (@' + CONFIG.DOMINIO_EMAIL + ').');
  if (!r.matricula) erros.push('Matrícula não informada.');
  if (CONFIG.EXIGIR_CODIGO_EMAIL) {
    var cache = CacheService.getScriptCache(), chave = 'cod_' + email;
    if (!r.codigoEmail || cache.get(chave) !== String(r.codigoEmail).trim()) erros.push('Código de verificação do e-mail inválido ou expirado. Solicite um novo código.');
  }
  return erros;
}

function apiEnviarCodigo_(d) {
  var email = String(d.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, erro: 'E-mail inválido.' };
  if (CONFIG.DOMINIO_EMAIL && !modoTeste_() && email.split('@')[1] !== CONFIG.DOMINIO_EMAIL) return { ok: false, erro: 'Use o e-mail institucional (@' + CONFIG.DOMINIO_EMAIL + ').' };
  var cache = CacheService.getScriptCache();
  if (cache.get('lim_' + email)) return { ok: false, erro: 'Aguarde 1 minuto para solicitar novo código.' };
  var codigo = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('cod_' + email, codigo, 1800);
  cache.put('lim_' + email, '1', 60);
  MailApp.sendEmail({
    to: email,
    subject: CONFIG.TITULO + ' — código de verificação',
    htmlBody: '<p>Seu código de verificação para envio de recurso/impugnação no ' + CONFIG.TITULO + ' é:</p>' +
      '<p style="font-size:24px;font-weight:bold;letter-spacing:4px">' + codigo + '</p><p>Válido por 30 minutos. Se você não solicitou, ignore esta mensagem.</p>'
  });
  log_('CODIGO', email);
  return { ok: true };
}

// ============================== RECURSO ==============================
function apiEnviarRecurso_(d) {
  var prazo = prazoAberto_();
  if (!prazo.aberto) return { ok: false, erro: prazo.msg };
  var u = unidade_(d.unidade && d.unidade.codigo);
  if (!u) return { ok: false, erro: 'Unidade não encontrada.' };
  var cat = CATEGORIAS[u.categoria];
  if (!cat || !cat.avaliada) return { ok: false, erro: 'A unidade não está na abrangência do Prêmio (' + (cat ? cat.rotulo : u.categoria) + ').' };

  var erros = validaRespondente_(d.respondente || {});
  var dec = d.declaracoes || {};
  if (!dec.preclusao || !dec.reformatio || !dec.veracidade) erros.push('Declarações de ciência não marcadas.');

  // Validação dos itens e da cláusula de barreira (Anexo III, item 3)
  var eixos = [], itens = [], totalBytes = 0;
  cat.eixos.forEach(function (chave) {
    var recebido = (d.eixos || []).filter(function (e) { return e.chave === chave; })[0];
    if (!recebido || (recebido.resposta !== 'Sim' && recebido.resposta !== 'Não')) { erros.push('Resposta ausente para ' + EIXOS[chave].titulo + '.'); return; }
    var reg = { chave: chave, titulo: EIXOS[chave].titulo, resposta: recebido.resposta, itens: [] };
    if (recebido.resposta === 'Sim') {
      if (!recebido.itens || !recebido.itens.length) erros.push('Nenhum item indicado em ' + EIXOS[chave].titulo + '.');
      (recebido.itens || []).forEach(function (it) {
        var def = EIXOS[chave].itens.filter(function (x) { return x[0] === Number(it.n); })[0];
        if (!def) { erros.push('Item ' + it.n + ' não pertence a ' + EIXOS[chave].titulo + '.'); return; }
        var ev = it.evid || {}, rot = 'Nº ' + def[0] + ' (' + def[1] + ')';
        var fund = String(it.fundamentacao || '');
        if (fund.trim().length < 50 || fund.length > CONFIG.LIMITE_TEXTO) erros.push(rot + ': fundamentação ausente ou acima de ' + CONFIG.LIMITE_TEXTO + ' caracteres.');
        if (!ev.fonteTipo || String(ev.fonteId || '').length < 5) erros.push(rot + ': (a) painel/relatório não identificado.');
        if (!ev.filtroPeriodo || !ev.filtroUnidade || !ev.filtroClasse) erros.push(rot + ': (b) filtros incompletos.');
        if (!ev.refInicio || !ev.refFim || ev.refInicio > ev.refFim) erros.push(rot + ': (c) período de referência inválido.');
        if (String(ev.memoria || '').trim().length < 30) erros.push(rot + ': (d) memória de cálculo ausente.');
        var pa = parseFloat(ev.pontAtribuida), pp = parseFloat(ev.pontPretendida);
        if (isNaN(pa) || pa < 0 || pa > def[2] || isNaN(pp) || pp < 0 || pp > def[2]) erros.push(rot + ': (d) pontuações devem estar entre 0 e ' + def[2] + '.');
        var procs = (ev.processos || []).map(cnj_);
        if (!procs.length || procs.some(function (p) { return !p; })) erros.push(rot + ': (e) números de processo ausentes ou inválidos.');
        else if (parseInt(ev.qtd, 10) !== procs.length) erros.push(rot + ': (e) quantidade declarada difere da lista de processos.');
        (it.arquivos || []).forEach(function (a) {
          var bytes = Math.floor(String(a.base64 || '').length * 3 / 4); totalBytes += bytes;
          if (bytes > CONFIG.LIMITE_ARQ_MB * 1048576) erros.push(rot + ': arquivo ' + a.nome + ' acima de ' + CONFIG.LIMITE_ARQ_MB + ' MB.');
        });
        var item = { eixo: chave, n: def[0], sigla: def[1], nome: it.nome || def[1], pontosMax: def[2], fundamentacao: fund.trim(), evid: ev, processos: procs, arquivos: it.arquivos || [] };
        reg.itens.push(item); itens.push(item);
      });
    }
    eixos.push(reg);
  });
  if (!itens.length) erros.push('Nenhum item recorrido.');
  if (totalBytes > CONFIG.LIMITE_TOTAL_MB * 1048576) erros.push('Total de anexos acima de ' + CONFIG.LIMITE_TOTAL_MB + ' MB.');
  if (erros.length) return { ok: false, erro: 'Recurso não registrado: ' + erros.join(' ') };

  // Seção crítica: preclusão consumativa (art. 7º, § 4º) + gravação
  var trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    var teste = modoTeste_();
    if (!teste) {
      var anterior = recursoAnterior_(u.codigo);
      if (anterior) return { ok: false, erro: 'Recurso inadmissível: a unidade já interpôs o recurso ' + anterior.id + ' em ' + anterior.data_hora + ' (preclusão consumativa — art. 7º, § 4º).' };
    }
    var agora = new Date();
    var id = proximoId_('REC');
    var dataHora = Utilities.formatDate(agora, CONFIG.FUSO, 'dd/MM/yyyy HH:mm:ss');
    var resp = d.respondente;

    // Anexos: 01_Anexos_Recursos/<código - unidade>/<id>/
    var pastaUnid = subpasta_(pasta_(CONFIG.PASTAS.anexos), u.codigo + ' - ' + u.nome);
    var pastaEnvio = subpasta_(pastaUnid, id + (teste ? ' [TESTE]' : ''));
    itens.forEach(function (it) {
      it.links = it.arquivos.map(function (a) {
        var blob = Utilities.newBlob(Utilities.base64Decode(a.base64), a.tipo || 'application/octet-stream', 'Nº' + it.n + '_' + it.sigla.replace(/[\/\\]/g, '-') + '__' + a.nome);
        var f = pastaEnvio.createFile(blob);
        return { nome: a.nome, url: f.getUrl() };
      });
    });

    var rec = {
      id: id, dataHora: dataHora, iso: agora.toISOString(), teste: teste, unidade: u,
      respondente: { cpf: fmtCPF_(resp.cpf), nome: String(resp.nome).trim(), email: String(resp.email).trim().toLowerCase(), cargo: resp.cargo || '', matricula: resp.matricula },
      eixos: eixos, declaracoes: dec
    };
    rec.codigoVerificacao = hash_(JSON.stringify({ id: id, u: u.codigo, i: itens.map(function (x) { return [x.n, x.fundamentacao, x.evid, x.processos]; }) }));

    // Registro em PDF: 02_Registros_PDF/<código - unidade>/
    var pdf = pdfDeHtml_(htmlRegistroRecurso_(rec, null), 'Registro_' + id + '_' + u.codigo + '.pdf');
    var pastaReg = subpasta_(pasta_(CONFIG.PASTAS.registros), u.codigo + ' - ' + u.nome);
    var arqPdf = pastaReg.createFile(pdf);

    aba_('Recursos').appendRow([id, dataHora, rec.iso, "'" + u.codigo, u.nome, u.categoria, rec.respondente.cpf, rec.respondente.nome,
      rec.respondente.email, rec.respondente.cargo, "'" + rec.respondente.matricula, itens.length,
      itens.map(function (x) { return 'Nº ' + x.n + ' ' + x.sigla; }).join('; '), pastaEnvio.getUrl(), arqPdf.getUrl(),
      rec.codigoVerificacao, teste ? 'SIM' : 'NÃO', 'RECEBIDO', '']);
    var abaItens = aba_('Itens');
    itens.forEach(function (it) {
      var ev = it.evid;
      abaItens.appendRow([id, "'" + u.codigo, u.nome, EIXOS[it.eixo].titulo, it.n, it.sigla, it.nome, it.pontosMax, it.fundamentacao,
        ev.fonteTipo, ev.fonteId, ev.filtroPeriodo, ev.filtroUnidade, ev.filtroClasse, ev.filtroOutros || '',
        ev.refInicio, ev.refFim, ev.memoria, Number(ev.pontAtribuida), Number(ev.pontPretendida),
        it.processos.join('\n'), it.processos.length, it.links.map(function (l) { return l.url; }).join('\n'), teste ? 'SIM' : 'NÃO',
        '', '', '', '', '']);
    });
    SpreadsheetApp.flush();
    log_('RECURSO', id + ' ' + u.codigo + ' ' + u.nome);
  } finally {
    trava.releaseLock();
  }

  var enviado = enviarEmail_(rec.respondente.email, CONFIG.TITULO + ' — Registro do recurso ' + id + ' — ' + u.nome,
    '<p>Recurso registrado em ' + dataHora + ' (horário do Acre).</p><p><b>ID da Entrada:</b> ' + id + '<br><b>Unidade:</b> ' + esc_(u.nome) +
    '<br><b>Itens:</b> ' + esc_(itens.map(function (x) { return 'Nº ' + x.n + ' ' + x.sigla; }).join('; ')) + '</p>' +
    '<p>O resultado dos recursos será divulgado em 18/12/2026, na outorga do Prêmio (art. 14).</p>', pdf);
  return { ok: true, id: id, dataHora: dataHora, email: rec.respondente.email, emailEnviado: enviado,
    pdfBase64: Utilities.base64Encode(pdf.getBytes()), pdfNome: pdf.getName() };
}

// ============================== IMPUGNAÇÃO ==============================
function apiEnviarImpugnacao_(d) {
  var prazo = prazoAberto_();
  if (!prazo.aberto) return { ok: false, erro: prazo.msg };
  var u = unidade_(d.unidade && d.unidade.codigo);
  if (!u) return { ok: false, erro: 'Unidade não encontrada.' };
  var erros = validaRespondente_(d.respondente || {});
  var servs = d.servidores || [];
  if (!servs.length) erros.push('Nenhum servidor informado.');
  servs.forEach(function (s, i) { if (!s.nome || !s.matricula || !s.pedido || !s.inicio || !s.fim) erros.push('Servidor ' + (i + 1) + ': dados incompletos.'); });
  if (String(d.fundamentacao || '').trim().length < 30) erros.push('Fundamentação ausente.');
  if (erros.length) return { ok: false, erro: 'Impugnação não registrada: ' + erros.join(' ') };

  var teste = modoTeste_(), agora = new Date(), id = proximoId_('IMP');
  var dataHora = Utilities.formatDate(agora, CONFIG.FUSO, 'dd/MM/yyyy HH:mm:ss');
  var pasta = subpasta_(subpasta_(pasta_(CONFIG.PASTAS.impugnacoes), u.codigo + ' - ' + u.nome), id + (teste ? ' [TESTE]' : ''));
  var links = (d.arquivos || []).map(function (a) {
    return { nome: a.nome, url: pasta.createFile(Utilities.newBlob(Utilities.base64Decode(a.base64), a.tipo || 'application/octet-stream', a.nome)).getUrl() };
  });
  var r = d.respondente;
  var imp = { id: id, dataHora: dataHora, teste: teste, unidade: u, servidores: servs, fundamentacao: String(d.fundamentacao).trim(), links: links,
    respondente: { cpf: fmtCPF_(r.cpf), nome: String(r.nome).trim(), email: String(r.email).trim().toLowerCase(), matricula: r.matricula } };
  var pdf = pdfDeHtml_(htmlRegistroImpugnacao_(imp), 'Impugnacao_' + id + '_' + u.codigo + '.pdf');
  var arq = pasta.createFile(pdf);
  var aba = aba_('Impugnacoes');
  servs.forEach(function (s) {
    aba.appendRow([id, dataHora, agora.toISOString(), "'" + u.codigo, u.nome, imp.respondente.cpf, imp.respondente.nome, imp.respondente.email,
      "'" + imp.respondente.matricula, s.nome, "'" + s.matricula, s.pedido, s.inicio, s.fim, s.meses, imp.fundamentacao,
      links.map(function (l) { return l.url; }).join('\n'), arq.getUrl(), teste ? 'SIM' : 'NÃO', '', '']);
  });
  log_('IMPUGNACAO', id + ' ' + u.codigo);
  var enviado = enviarEmail_(imp.respondente.email, CONFIG.TITULO + ' — Impugnação ' + id + ' — ' + u.nome,
    '<p>Impugnação da lista de servidores registrada em ' + dataHora + '.</p><p><b>ID:</b> ' + id + '</p><p>A lista definitiva será divulgada em 16/12/2026.</p>', pdf);
  return { ok: true, id: id, dataHora: dataHora, email: imp.respondente.email, emailEnviado: enviado, pdfBase64: Utilities.base64Encode(pdf.getBytes()), pdfNome: pdf.getName() };
}

// ============================== DOCUMENTOS (HTML → PDF) ==============================
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function txt_(s) { return esc_(s).replace(/\n/g, '<br>'); }
function dataBR_(iso) { return iso ? String(iso).split('-').reverse().join('/') : ''; }

function cssDoc_() {
  return '<style>' +
    '@page{size:A4;margin:16mm 14mm}' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#222}' +
    'table.cab{width:100%;border-collapse:collapse;border-bottom:2px solid #a01027;margin-bottom:14px}' +
    'table.cab td{vertical-align:middle;padding:0 0 10px}' +
    '.org{font-size:9pt;color:#84172e;font-weight:bold;line-height:1.3}' +
    '.tit-cab{font-size:9.5pt;text-align:center;color:#333}' +
    '.dt{font-size:9pt;text-align:right;color:#333;white-space:nowrap}' +
    'h1{font-size:15pt;margin:6px 0 12px;color:#84172e}' +
    'h2{font-size:12pt;margin:18px 0 8px;color:#a01027;border-bottom:1px solid #e7c3ca;padding-bottom:3px}' +
    '.q{font-weight:bold;margin:12px 0 2px}' +
    '.r{margin:0 0 6px}' +
    'ul{margin:2px 0 8px 0;padding-left:18px}' +
    'table.ev{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:9.5pt}' +
    'table.ev td{border:1px solid #ccc;padding:4px 6px;vertical-align:top}' +
    'table.ev td{border:1px solid #e0c4ca}' +
    'table.ev td.k{width:34%;background:#f8eef0;font-weight:bold;color:#5c0b1b}' +
    '.decisao{border:1px solid #a01027;border-left:4px solid #a01027;background:#f8eef0;padding:8px 10px;margin:6px 0 14px}' +
    '.certidao{border:1px solid #a01027;padding:14px;margin:14px 0;line-height:1.6}' +
    '.rod{border-top:2px solid #a01027;margin-top:22px;padding-top:6px;font-size:8.5pt;color:#444}' +
    '.teste{color:#b3261e;font-weight:bold;border:2px solid #b3261e;padding:4px 8px;display:inline-block;margin-bottom:8px}' +
    'a{color:#a01027}' +
    '</style>';
}

function cabecalhoDoc_(tituloCab, dataHora) {
  var src = typeof LOGO_PDF_BASE64 !== 'undefined' ? 'data:image/png;base64,' + LOGO_PDF_BASE64 : '';
  if (CONFIG.LOGO_URL) {
    try { var b = UrlFetchApp.fetch(CONFIG.LOGO_URL).getBlob(); src = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()); } catch (e) { }
  }
  var logo = src ? '<img src="' + src + '" style="height:62px">' : '<span class="org">PODER JUDICIÁRIO<br>DO ESTADO DO ACRE</span>';
  return '<table class="cab"><tr>' +
    '<td style="width:24%">' + logo + '</td>' +
    '<td class="tit-cab" style="width:56%"><span class="org">TRIBUNAL DE JUSTIÇA DO ESTADO DO ACRE</span><br>' + esc_(tituloCab) + '</td>' +
    '<td class="dt" style="width:20%">' + esc_(dataHora) + '</td></tr></table>';
}

/** Registro do recurso no mesmo formato do registro do formulário do CNJ. `decisoes` (opcional) = linhas da aba Itens. */
function htmlRegistroRecurso_(rec, decisoes) {
  var u = rec.unidade, h = [];
  var titulo = CONFIG.TITULO + ' - Formulário para submissão de recursos contra o Resultado Preliminar';
  h.push('<html><head><meta charset="utf-8">' + cssDoc_() + '</head><body>');
  h.push(cabecalhoDoc_('Registro ' + titulo, rec.dataHora));
  if (rec.teste) h.push('<div class="teste">ENVIO DE TESTE — SEM VALOR JURÍDICO</div>');
  h.push('<h1>' + esc_(titulo) + '</h1>');
  h.push('<div class="q">Informe o código da sua unidade</div><div class="r">' + esc_(u.codigo) + '</div>');
  h.push('<h2>Identificação do Respondente</h2>');
  [['Identifique o Órgão:', 'Tribunal de Justiça do Estado do Acre'], ['Identifique a Unidade Judiciária:', u.nome + ' — ' + (CATEGORIAS[u.categoria] || {}).rotulo],
   ['Informe o CPF do responsável pelo envio:', rec.respondente.cpf], ['Informe o nome do responsável pelo envio:', rec.respondente.nome],
   ['Informe o e-mail do responsável pelo envio:', rec.respondente.email], ['Informe o cargo/função do responsável:', rec.respondente.cargo],
   ['Informe a matrícula:', rec.respondente.matricula]].forEach(function (p) {
    h.push('<div class="q">' + esc_(p[0]) + '</div><div class="r">' + esc_(p[1]) + '</div>');
  });
  h.push('<h2>Questionário</h2>');
  rec.eixos.forEach(function (e, i) {
    var q = i + 1;
    h.push('<div class="q">' + q + ') Você pretende apresentar recurso para algum item relacionado aos ' + esc_(e.titulo) + '?</div><div class="r">' + e.resposta + '</div>');
    if (e.resposta !== 'Sim') return;
    h.push('<div class="q">' + q + '.1) Indique o(s) item(ns) dos ' + esc_(e.titulo) + ' para o(s) qual(is) deseja apresentar recurso:</div><ul>');
    e.itens.forEach(function (it) { h.push('<li>Nº ' + it.n + ' - ' + esc_(it.sigla) + ' - ' + esc_(it.nome) + ' (' + it.pontosMax + ' pts)</li>'); });
    h.push('</ul>');
    e.itens.forEach(function (it) {
      var ev = it.evid, rot = 'Nº ' + it.n + ' - ' + it.sigla + ' - ' + it.nome;
      h.push('<div class="q">Apresente a seguir o recurso referente ao ' + esc_(rot) + ':</div><div class="r">' + txt_(it.fundamentacao) + '</div>');
      h.push('<div class="q">Evidências obrigatórias (Anexo III, item 3) — ' + esc_(it.sigla) + ':</div><table class="ev">' +
        '<tr><td class="k">a) Painel ou relatório utilizado</td><td>' + esc_(ev.fonteTipo) + ' — ' + esc_(ev.fonteId) + '</td></tr>' +
        '<tr><td class="k">b) Filtros aplicados</td><td>Período: ' + esc_(ev.filtroPeriodo) + '<br>Unidade: ' + esc_(ev.filtroUnidade) + '<br>Classe processual: ' + esc_(ev.filtroClasse) + (ev.filtroOutros ? '<br>Outros: ' + esc_(ev.filtroOutros) : '') + '</td></tr>' +
        '<tr><td class="k">c) Período de referência</td><td>' + dataBR_(ev.refInicio) + ' a ' + dataBR_(ev.refFim) + '</td></tr>' +
        '<tr><td class="k">d) Memória de cálculo</td><td>' + txt_(ev.memoria) + '<br><b>Pontuação atribuída:</b> ' + esc_(ev.pontAtribuida) + ' · <b>Pontuação pretendida:</b> ' + esc_(ev.pontPretendida) + ' (máx. ' + it.pontosMax + ')</td></tr>' +
        '<tr><td class="k">e) Processos impugnados (' + it.processos.length + ')</td><td>' + esc_(it.processos.join('; ')) + '</td></tr></table>');
      h.push('<div class="q">Anexe as evidências do recurso referente ao Nº ' + it.n + ' - ' + esc_(it.sigla) + ':</div>');
      var links = it.links || [];
      h.push(links.length ? '<ul>' + links.map(function (l) { return '<li><a href="' + esc_(l.url) + '">' + esc_(l.nome) + '</a></li>'; }).join('') + '</ul>' : '<div class="r">Nenhum arquivo anexado.</div>');
      if (decisoes) {
        var dcs = decisoes.filter(function (x) { return Number(x.n) === Number(it.n); })[0];
        h.push('<div class="decisao"><b>Decisão da Comissão Revisora — Nº ' + it.n + ' ' + esc_(it.sigla) + '</b><br>' +
          (dcs && dcs.comissao_conhecimento ? 'Conhecimento: ' + esc_(dcs.comissao_conhecimento) + (dcs.comissao_merito ? ' · Mérito: ' + esc_(dcs.comissao_merito) : '') +
            (dcs.comissao_pontuacao_final !== '' && dcs.comissao_pontuacao_final != null ? ' · Pontuação final: ' + esc_(dcs.comissao_pontuacao_final) : '') +
            (dcs.comissao_fundamentacao ? '<br>' + txt_(dcs.comissao_fundamentacao) : '') : 'Pendente de julgamento.') + '</div>');
      }
    });
  });
  h.push('<h2>Declarações</h2><ul>' +
    '<li>Ciência da preclusão consumativa (art. 7º, § 4º): ' + (rec.declaracoes.preclusao ? 'Sim' : 'Não') + '</li>' +
    '<li>Ciência da possibilidade de acréscimo ou decréscimo de pontuação e reprocessamento (art. 13, § 2º): ' + (rec.declaracoes.reformatio ? 'Sim' : 'Não') + '</li>' +
    '<li>Veracidade das informações: ' + (rec.declaracoes.veracidade ? 'Sim' : 'Não') + '</li></ul>');
  h.push('<div class="rod">ID da Entrada: ' + esc_(rec.id) + ' · Código de verificação: ' + esc_(rec.codigoVerificacao || '') +
    '<br>Portaria PRESI nº 1.961/2026 (alterada pelas Portarias nº 4.335/2026 e nº 4.919/2026) · Sistema de Gestão de Formulários - TJAC · Versão 1.0</div>');
  h.push('</body></html>');
  return h.join('');
}

function htmlRegistroImpugnacao_(imp) {
  var u = imp.unidade, h = [];
  h.push('<html><head><meta charset="utf-8">' + cssDoc_() + '</head><body>');
  h.push(cabecalhoDoc_('Registro ' + CONFIG.TITULO + ' - Impugnação da lista provisória de servidores vinculados', imp.dataHora));
  if (imp.teste) h.push('<div class="teste">ENVIO DE TESTE — SEM VALOR JURÍDICO</div>');
  h.push('<h1>' + CONFIG.TITULO + ' - Impugnação da lista provisória de servidores vinculados</h1>');
  h.push('<h2>Identificação do Respondente</h2>');
  [['Órgão:', 'Tribunal de Justiça do Estado do Acre'], ['Unidade:', u.codigo + ' - ' + u.nome], ['CPF:', imp.respondente.cpf], ['Nome:', imp.respondente.nome],
   ['E-mail:', imp.respondente.email], ['Matrícula:', imp.respondente.matricula]].forEach(function (p) { h.push('<div class="q">' + p[0] + '</div><div class="r">' + esc_(p[1]) + '</div>'); });
  h.push('<h2>Servidores(as) objeto da impugnação</h2><table class="ev"><tr><td class="k">Servidor(a)</td><td class="k">Matrícula</td><td class="k">Pedido</td><td class="k">Lotação</td><td class="k">Meses no período</td></tr>');
  imp.servidores.forEach(function (s) {
    h.push('<tr><td>' + esc_(s.nome) + '</td><td>' + esc_(s.matricula) + '</td><td>' + esc_(s.pedido) + '</td><td>' + dataBR_(s.inicio) + ' a ' + dataBR_(s.fim) + '</td><td>' + esc_(s.meses) + '</td></tr>');
  });
  h.push('</table><div class="q">Fundamentação:</div><div class="r">' + txt_(imp.fundamentacao) + '</div>');
  h.push('<div class="q">Evidências anexadas:</div>' + (imp.links.length ? '<ul>' + imp.links.map(function (l) { return '<li><a href="' + esc_(l.url) + '">' + esc_(l.nome) + '</a></li>'; }).join('') + '</ul>' : '<div class="r">Nenhum arquivo anexado.</div>'));
  h.push('<div class="rod">ID da Entrada: ' + esc_(imp.id) + ' · Processamento autônomo (art. 7º, § 5º) · Lista definitiva em 16/12/2026.</div></body></html>');
  return h.join('');
}

function pdfDeHtml_(html, nome) {
  // HtmlService preserva as imagens embutidas (data URI) do logotipo na conversão para PDF.
  return HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(nome);
}

// ============================== RELATÓRIOS FINAIS POR UNIDADE ==============================
/** Gera, para CADA unidade da aba Unidades, o relatório final em PDF. Roda em lotes (limite de 6 min do Apps Script). */
function gerarRelatoriosFinais() {
  var props = PropertiesService.getScriptProperties();
  var inicio = Number(props.getProperty('REL_INDICE') || 0);
  var unidades = tabela_('Unidades');
  if (inicio === 0) {
    var aba = aba_('Relatorios_Finais');
    if (aba.getLastRow() > 1) aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).clearContent();
  }
  var recursos = tabela_('Recursos').filter(function (r) { return r.teste !== 'SIM' && String(r.situacao).toUpperCase() !== 'ANULADO'; });
  var itens = tabela_('Itens').filter(function (r) { return r.teste !== 'SIM'; });
  var imps = tabela_('Impugnacoes').filter(function (r) { return r.teste !== 'SIM'; });
  var pastaFinais = pasta_(CONFIG.PASTAS.finais);
  var t0 = Date.now(), i = inicio;
  for (; i < unidades.length; i++) {
    if (Date.now() - t0 > 4.5 * 60 * 1000) break;
    gerarRelatorioUnidade_(unidades[i], recursos, itens, imps, pastaFinais);
  }
  limparGatilhos_('gerarRelatoriosFinais');
  if (i < unidades.length) {
    props.setProperty('REL_INDICE', String(i));
    ScriptApp.newTrigger('gerarRelatoriosFinais').timeBased().after(60 * 1000).create();
    log_('RELATORIOS', 'Lote concluído até ' + i + '/' + unidades.length + '; continuação agendada.');
  } else {
    props.deleteProperty('REL_INDICE');
    log_('RELATORIOS', 'Concluído: ' + unidades.length + ' unidades.');
  }
}

function gerarRelatorioUnidade_(u, recursos, itens, imps, pastaFinais) {
  var cat = CATEGORIAS[u.categoria] || { rotulo: u.categoria, avaliada: false };
  var rec = recursos.filter(function (r) { return String(r.codigo_unidade) === String(u.codigo); })[0];
  var minhasImps = imps.filter(function (r) { return String(r.codigo_unidade) === String(u.codigo); });
  var agora = Utilities.formatDate(new Date(), CONFIG.FUSO, 'dd/MM/yyyy HH:mm:ss');
  var situacao = !cat.avaliada ? cat.rotulo : (rec ? 'Recurso interposto (' + rec.id + ')' : 'Sem recurso interposto no prazo');
  var h = ['<html><head><meta charset="utf-8">' + cssDoc_() + '</head><body>', cabecalhoDoc_(CONFIG.TITULO + ' - Relatório Final da Etapa Recursal por Unidade', agora),
    '<h1>Relatório Final da Etapa Recursal</h1>',
    '<table class="ev"><tr><td class="k">Unidade</td><td>' + esc_(u.codigo + ' - ' + u.nome) + '</td></tr>',
    '<tr><td class="k">Comarca</td><td>' + esc_(u.comarca) + '</td></tr>',
    '<tr><td class="k">Categoria de avaliação</td><td>' + esc_(cat.rotulo) + '</td></tr>',
    '<tr><td class="k">Situação recursal</td><td><b>' + esc_(situacao) + '</b></td></tr></table>'];
  if (rec) {
    var meus = itens.filter(function (x) { return x.id === rec.id; });
    h.push('<h2>Itens recorridos e decisões da Comissão Revisora</h2><table class="ev"><tr><td class="k">Item</td><td class="k">Atribuída → Pretendida</td><td class="k">Conhecimento / Mérito</td><td class="k">Pontuação final</td></tr>');
    meus.forEach(function (x) {
      h.push('<tr><td>Nº ' + esc_(x.n) + ' ' + esc_(x.sigla) + '</td><td>' + esc_(x.d_pontuacao_atribuida) + ' → ' + esc_(x.d_pontuacao_pretendida) + ' (máx. ' + esc_(x.pontos_max) + ')</td><td>' +
        esc_(x.comissao_conhecimento || 'Pendente') + (x.comissao_merito ? ' / ' + esc_(x.comissao_merito) : '') + '</td><td>' + esc_(x.comissao_pontuacao_final === '' ? '—' : x.comissao_pontuacao_final) + '</td></tr>');
    });
    h.push('</table>');
    meus.forEach(function (x) { if (x.comissao_fundamentacao) h.push('<div class="decisao"><b>Nº ' + esc_(x.n) + ' ' + esc_(x.sigla) + ':</b> ' + txt_(x.comissao_fundamentacao) + '</div>'); });
    h.push('<p>Responsável pelo envio: ' + esc_(rec.nome) + ' (' + esc_(rec.email) + ') em ' + esc_(rec.data_hora) + '. Registro integral: <a href="' + esc_(rec.registro_pdf) + '">' + esc_(rec.id) + '</a>. Código de verificação: ' + esc_(rec.codigo_verificacao) + '.</p>');
  } else if (cat.avaliada) {
    h.push('<div class="certidao"><b>CERTIDÃO</b><br>Certifico que, até o termo final de 07/12/2026, às 23h59min59s (art. 5º, III, da Portaria PRESI nº 1.961/2026), não foi registrado, no formulário eletrônico do ' + CONFIG.TITULO +
      ', recurso desta unidade contra o Resultado Preliminar. Ressalva-se que a pontuação da unidade pode ser alterada em decorrência do julgamento de recursos de outras unidades que ensejem reprocessamento dos dados do indicador (art. 13, § 2º).</div>');
  } else {
    h.push('<div class="certidao"><b>CERTIDÃO</b><br>Certifico que esta unidade não integra a abrangência do ' + CONFIG.TITULO + ' (art. 4º da Portaria PRESI nº 1.961/2026), segundo a classificação vigente na base de unidades do sistema.</div>');
  }
  h.push('<h2>Impugnações da lista de servidores vinculados</h2>');
  if (minhasImps.length) {
    h.push('<table class="ev"><tr><td class="k">ID</td><td class="k">Servidor(a)</td><td class="k">Pedido</td><td class="k">Meses</td><td class="k">Decisão</td></tr>');
    minhasImps.forEach(function (x) { h.push('<tr><td>' + esc_(x.id) + '</td><td>' + esc_(x.servidor_nome) + ' (' + esc_(x.servidor_matricula) + ')</td><td>' + esc_(x.pedido) + '</td><td>' + esc_(x.meses_no_periodo) + '</td><td>' + esc_(x.decisao || 'Pendente') + (x.decisao_observacao ? ' — ' + esc_(x.decisao_observacao) : '') + '</td></tr>'); });
    h.push('</table>');
  } else h.push('<p>Nenhuma impugnação registrada.</p>');
  h.push('<div class="rod">Gerado em ' + agora + ' · O Resultado Final é homologado pela Presidência e publicado no DJe (art. 15).</div></body></html>');

  var nome = 'Relatorio_Final_' + u.codigo + '_' + String(u.nome).replace(/[^\wÀ-ú -]/g, '').replace(/\s+/g, '_').slice(0, 80) + '.pdf';
  var existentes = pastaFinais.getFilesByName(nome);
  while (existentes.hasNext()) existentes.next().setTrashed(true);
  var arq = pastaFinais.createFile(pdfDeHtml_(h.join(''), nome));
  aba_('Relatorios_Finais').appendRow(["'" + u.codigo, u.nome, u.categoria, situacao, rec ? rec.id : '', minhasImps.length, arq.getUrl(), agora]);
}

/** Gera o relatório só da unidade da linha selecionada na aba Unidades. */
function gerarRelatorioDaLinhaSelecionada() {
  var aba = SpreadsheetApp.getActiveSheet();
  if (aba.getName() !== 'Unidades') { SpreadsheetApp.getUi().alert('Selecione uma linha na aba "Unidades".'); return; }
  var linha = aba.getActiveRange().getRow();
  var cod = String(aba.getRange(linha, 1).getValue());
  var u = unidade_(cod);
  if (!u) { SpreadsheetApp.getUi().alert('Unidade não encontrada.'); return; }
  gerarRelatorioUnidade_(u, tabela_('Recursos').filter(function (r) { return r.teste !== 'SIM' && String(r.situacao).toUpperCase() !== 'ANULADO'; }),
    tabela_('Itens').filter(function (r) { return r.teste !== 'SIM'; }), tabela_('Impugnacoes').filter(function (r) { return r.teste !== 'SIM'; }), pasta_(CONFIG.PASTAS.finais));
  SpreadsheetApp.getUi().alert('Relatório gerado para ' + u.nome + '.');
}

// ============================== MENU E ADMINISTRAÇÃO ==============================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Prêmio TJAC 2026')
    .addItem('1. Configurar banco (primeira vez)', 'configurar')
    .addSeparator()
    .addItem('Ativar/desativar modo de teste', 'alternarModoTeste')
    .addItem('Excluir envios de teste', 'excluirTestes')
    .addSeparator()
    .addItem('Gerar relatórios finais (todas as unidades)', 'gerarRelatoriosFinais')
    .addItem('Gerar relatório da unidade selecionada', 'gerarRelatorioDaLinhaSelecionada')
    .addToUi();
}

/** Cria abas, cabeçalhos e subpastas. Pode ser executada mais de uma vez sem duplicar nada. */
function configurar() {
  var ss = planilha_();
  var primeira = ss.getSheets()[0];
  if (!ss.getSheetByName('Unidades')) primeira.setName('Unidades');
  Object.keys(CABECALHOS).forEach(function (nome) {
    var aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (aba.getLastRow() === 0) aba.appendRow(CABECALHOS[nome]);
    aba.getRange(1, 1, 1, aba.getLastColumn()).setFontWeight('bold').setBackground('#0d3a66').setFontColor('#ffffff');
    aba.setFrozenRows(1);
  });
  // Validação da coluna "categoria" e das colunas da Comissão
  var unid = ss.getSheetByName('Unidades');
  var colCat = unid.getRange(1, 1, 1, unid.getLastColumn()).getValues()[0].indexOf('categoria') + 1;
  if (colCat > 0) unid.getRange(2, colCat, Math.max(unid.getLastRow() - 1, 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(Object.keys(CATEGORIAS), true).build());
  var itens = ss.getSheetByName('Itens'), cab = CABECALHOS.Itens;
  itens.getRange(2, cab.indexOf('comissao_conhecimento') + 1, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Conhecido', 'Não conhecido'], true).build());
  itens.getRange(2, cab.indexOf('comissao_merito') + 1, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Provido', 'Parcialmente provido', 'Não provido', 'Prejudicado'], true).build());
  var rec = ss.getSheetByName('Recursos');
  rec.getRange(2, CABECALHOS.Recursos.indexOf('situacao') + 1, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['RECEBIDO', 'EM ANÁLISE', 'JULGADO', 'ANULADO'], true).build());
  var imp = ss.getSheetByName('Impugnacoes');
  imp.getRange(2, CABECALHOS.Impugnacoes.indexOf('decisao') + 1, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Deferida', 'Parcialmente deferida', 'Indeferida'], true).build());
  Object.keys(CONFIG.PASTAS).forEach(function (k) { pasta_(CONFIG.PASTAS[k]); });
  log_('CONFIGURAR', 'Banco configurado.');
  try { SpreadsheetApp.getUi().alert('Banco configurado. Agora publique o App da Web (Implantar > Nova implantação).'); } catch (e) { }
}

function alternarModoTeste() {
  var p = PropertiesService.getScriptProperties(), novo = modoTeste_() ? 'NAO' : 'SIM';
  p.setProperty('MODO_TESTE', novo);
  log_('MODO_TESTE', novo);
  try { SpreadsheetApp.getUi().alert('Modo de teste: ' + (novo === 'SIM' ? 'ATIVADO (prazo e domínio do e-mail não são verificados; envios marcados como teste).' : 'DESATIVADO.')); } catch (e) { }
}

function excluirTestes() {
  ['Recursos', 'Itens', 'Impugnacoes'].forEach(function (nome) {
    var aba = aba_(nome), dados = aba.getDataRange().getValues(), col = dados[0].indexOf('teste');
    for (var i = dados.length - 1; i >= 1; i--) if (dados[i][col] === 'SIM') aba.deleteRow(i + 1);
  });
  log_('TESTES', 'Envios de teste excluídos das abas (arquivos [TESTE] permanecem no Drive).');
}

// ============================== INFRAESTRUTURA ==============================
function planilha_() { return CONFIG.PLANILHA_ID ? SpreadsheetApp.openById(CONFIG.PLANILHA_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
function aba_(nome) {
  var ss = planilha_(), aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (aba.getLastRow() === 0 && CABECALHOS[nome]) aba.appendRow(CABECALHOS[nome]); // garante o cabeçalho mesmo sem "Configurar"
  return aba;
}

function tabela_(nome) {
  var aba = planilha_().getSheetByName(nome);
  if (!aba || aba.getLastRow() < 2) return [];
  var v = aba.getDataRange().getDisplayValues(), cab = v[0];
  return v.slice(1).map(function (l) { var o = {}; cab.forEach(function (c, i) { o[c] = l[i]; }); return o; });
}

function pastaRaiz_() {
  if (CONFIG.PASTA_RAIZ_ID) return DriveApp.getFolderById(CONFIG.PASTA_RAIZ_ID);
  var pais = DriveApp.getFileById(planilha_().getId()).getParents();
  return pais.hasNext() ? pais.next() : DriveApp.getRootFolder();
}
function pasta_(nome) { return subpasta_(pastaRaiz_(), nome); }
function subpasta_(pai, nome) {
  nome = String(nome).replace(/[\/\\]/g, '-').slice(0, 120);
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function proximoId_(prefixo) {
  var p = PropertiesService.getScriptProperties(), chave = 'SEQ_' + prefixo;
  var n = Number(p.getProperty(chave) || 0) + 1;
  p.setProperty(chave, String(n));
  return prefixo + '-2026-' + ('0000' + n).slice(-4) + (modoTeste_() ? '-T' : '');
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 16).toUpperCase();
}

function enviarEmail_(para, assunto, html, pdf) {
  try {
    var opc = { to: para, subject: assunto, htmlBody: html, attachments: [pdf] };
    if (CONFIG.EMAIL_COPIA) opc.cc = CONFIG.EMAIL_COPIA;
    MailApp.sendEmail(opc);
    return true;
  } catch (e) { log_('EMAIL_FALHOU', para + ' ' + e); return false; }
}

function limparGatilhos_(funcao) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === funcao) ScriptApp.deleteTrigger(t); });
}

function log_(evento, detalhe) {
  try { aba_('Log').appendRow([Utilities.formatDate(new Date(), CONFIG.FUSO, 'dd/MM/yyyy HH:mm:ss'), evento, String(detalhe).slice(0, 5000)]); } catch (e) { }
}
