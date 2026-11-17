/* Importação de planilhas (CSV e XLSX) — sem bibliotecas externas.
   Funções puras: podem ser testadas no Node (veja tests/importar.test.mjs). */
'use strict';
(function (raiz) {
  // ------------------------------------------------------------ texto
  const normaliza = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function decodificar(buffer) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(buffer); }
  }

  // ------------------------------------------------------------ CSV
  function lerCSV(texto) {
    const amostra = texto.split(/\r?\n/).slice(0, 10).join('\n');
    const conta = (c) => amostra.split(c).length - 1;
    const sep = [';', ',', '\t'].sort((a, b) => conta(b) - conta(a))[0];
    const linhas = []; let linha = []; let campo = ''; let aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (aspas) {
        if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (ch === '"') aspas = false;
        else campo += ch;
      } else if (ch === '"' && campo === '') aspas = true;
      else if (ch === sep) { linha.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = '';
      } else campo += ch;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  // ------------------------------------------------------------ XLSX (ZIP + XML)
  const xmlTexto = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');

  async function descompactar(dados, metodo) {
    if (metodo === 0) return dados;
    if (metodo !== 8) throw new Error('Compressão de arquivo não suportada.');
    const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  }

  async function lerZip(buffer) {
    const u8 = new Uint8Array(buffer); const dv = new DataView(buffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo XLSX inválido ou corrompido.');
    const total = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const arquivos = {}; const dec = new TextDecoder();
    for (let k = 0; k < total; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true); const tam = dv.getUint32(p + 20, true);
      const nLen = dv.getUint16(p + 28, true); const eLen = dv.getUint16(p + 30, true); const cLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nome = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
      const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      arquivos[nome] = { metodo, dados: u8.subarray(ini, ini + tam) };
      p += 46 + nLen + eLen + cLen;
    }
    return {
      nomes: Object.keys(arquivos),
      async texto(nome) { const a = arquivos[nome]; return a ? dec.decode(await descompactar(a.dados, a.metodo)) : null; },
    };
  }

  const colIndice = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

  async function lerXLSX(buffer) {
    const zip = await lerZip(buffer);
    const compart = [];
    const ss = await zip.texto('xl/sharedStrings.xml');
    if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      compart.push(xmlTexto([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
    }
    const wb = (await zip.texto('xl/workbook.xml')) || '';
    const rels = (await zip.texto('xl/_rels/workbook.xml.rels')) || '';
    const alvo = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /Id="([^"]+)"/.exec(m[0]); const t = /Target="([^"]+)"/.exec(m[0]);
      if (id && t) alvo[id[1]] = t[1].replace(/^\/?xl\//, '').replace(/^\//, '');
    }
    const planilhas = [];
    for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
      const nome = /name="([^"]+)"/.exec(m[0]); const rid = /r:id="([^"]+)"/.exec(m[0]);
      if (nome && rid && alvo[rid[1]]) planilhas.push({ nome: xmlTexto(nome[1]), caminho: 'xl/' + alvo[rid[1]] });
    }
    if (!planilhas.length) zip.nomes.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()
      .forEach((c, i) => planilhas.push({ nome: `Planilha ${i + 1}`, caminho: c }));
    const resultado = [];
    for (const pl of planilhas) {
      const xml = await zip.texto(pl.caminho); if (!xml) continue;
      const linhas = [];
      for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const nr = /r="(\d+)"/.exec(r[0]); const idx = nr ? +nr[1] - 1 : linhas.length;
        const cel = [];
        for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const ref = /r="([A-Z]+\d+)"/.exec(c[1]); const tipo = (/t="(\w+)"/.exec(c[1]) || [])[1];
          const corpo = c[2] || ''; let v = (/<v>([\s\S]*?)<\/v>/.exec(corpo) || [])[1];
          if (tipo === 's') v = compart[+v] ?? '';
          else if (tipo === 'inlineStr') v = [...corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('');
          else if (tipo === 'b') v = v === '1' ? 'sim' : 'não';
          v = v == null ? '' : xmlTexto(String(v));
          cel[ref ? colIndice(ref[1]) : cel.length] = v;
        }
        linhas[idx] = Array.from(cel, (x) => x ?? '');
      }
      resultado.push({ nome: pl.nome, linhas: Array.from(linhas, (x) => x || []) });
    }
    return resultado;
  }

  // ------------------------------------------------------------ mapeamento de colunas
  const SINONIMOS = {
    nome: ['nome', 'cidadao', 'nome completo', 'eleitor', 'pessoa', 'parlamentar'],
    nascimento: ['nascimento', 'data de nascimento', 'data nascimento', 'aniversario', 'data de aniversario', 'dt nasc'],
    telefone: ['telefone', 'fone', 'celular', 'contato', 'tel', 'telefone 1'],
    whatsapp: ['whatsapp', 'whats', 'zap', 'wpp'],
    email: ['email', 'e mail', 'correio eletronico'],
    municipio: ['municipio', 'cidade', 'localidade'],
    uf: ['uf', 'estado'],
    cpf: ['cpf', 'documento cpf'],
    cep: ['cep'],
    bairro: ['bairro', 'comunidade'],
    endereco: ['endereco', 'logradouro', 'rua'],
    tags: ['tags', 'etiquetas', 'grupo', 'segmento'],
    lider: ['lider', 'lideranca'],
    observacoes: ['observacoes', 'obs', 'observacao', 'anotacoes'],
    orgao: ['secretaria ministerio', 'secretaria', 'orgao', 'ministerio', 'orgao executor'],
    objeto: ['destino objeto', 'objeto', 'destino', 'finalidade'],
    beneficiario: ['beneficiario'],
    contato_politico: ['contato politico'],
    ano: ['ano indicacao', 'ano de indicacao', 'ano'],
    origem: ['origem'],
    acao: ['acao', 'acao orcamentaria'],
    empenho: ['empenho', 'n empenho', 'numero do empenho'],
    valor: ['valor', 'valor indicado', 'valor da emenda'],
    valor_empenhado: ['valor empenhado'],
    tramite: ['tramite emenda', 'tramite'],
    status: ['status', 'situacao'],
    numero: ['numero', 'n emenda', 'numero da emenda', 'emenda'],
    titulo: ['titulo', 'assunto', 'demanda'],
    descricao: ['descricao', 'detalhes'],
    categoria: ['categoria', 'area', 'tema'],
    prazo: ['prazo', 'vencimento'],
    tipo: ['tipo'],
    cnpj: ['cnpj'],
    responsavel: ['responsavel'],
    cargo: ['cargo', 'funcao'],
    partido: ['partido', 'sigla do partido'],
    nome_civil: ['nome civil'],
    inicio: ['data e hora inicial', 'inicio', 'data inicio', 'data'],
    fim: ['data e hora final', 'fim', 'termino'],
    local: ['local'],
    aniversario: ['aniversario', 'data de aniversario', 'nascimento'],
  };

  const CAMPOS_IMPORTAVEIS = (ent) => ent.campos.filter((c) => !c.calc && !c.auto && c.t !== 'file' && c.t !== 'ref');

  function sugerirMapa(cabecalho, ent) {
    const campos = CAMPOS_IMPORTAVEIS(ent); const usados = new Set();
    return cabecalho.map((h) => {
      const nh = normaliza(h); if (!nh) return '';
      let melhor = '';
      for (const c of campos) {
        if (usados.has(c.n)) continue;
        const sin = [normaliza(c.l), normaliza(c.n), ...(SINONIMOS[c.n] || [])];
        if (sin.includes(nh)) { melhor = c.n; break; }
      }
      if (!melhor) for (const c of campos) {
        if (usados.has(c.n)) continue;
        if ((SINONIMOS[c.n] || []).some((s) => s.length > 3 && nh.startsWith(s))) { melhor = c.n; break; }
      }
      if (melhor) usados.add(melhor);
      return melhor;
    });
  }

  function detectarCabecalho(linhas, ent) {
    let melhor = 0; let pontos = 0;
    linhas.slice(0, 40).forEach((l, i) => {
      const p = sugerirMapa(l || [], ent).filter(Boolean).length;
      if (p > pontos) { pontos = p; melhor = i; }
    });
    return pontos >= 1 ? melhor : 0;
  }

  // ------------------------------------------------------------ conversão de valores
  function cpfValido(cpf) {
    const d = String(cpf).replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (const n of [9, 10]) {
      let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i);
      if ((s * 10 % 11) % 10 !== +d[n]) return false;
    }
    return true;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const UFS = { acre: 'AC', amazonas: 'AM', rondonia: 'RO', roraima: 'RR', para: 'PA', amapa: 'AP', tocantins: 'TO',
    'distrito federal': 'DF', 'sao paulo': 'SP', 'rio de janeiro': 'RJ', 'minas gerais': 'MG', bahia: 'BA', goias: 'GO',
    parana: 'PR', 'santa catarina': 'SC', 'rio grande do sul': 'RS', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    pernambuco: 'PE', ceara: 'CE', maranhao: 'MA', piaui: 'PI', paraiba: 'PB', 'rio grande do norte': 'RN',
    alagoas: 'AL', sergipe: 'SE', 'espirito santo': 'ES' };

  function data(v) {
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
    if (m) { let a = +m[3]; if (a < 100) a += a > 30 ? 1900 : 2000; return `${a}-${pad(m[2])}-${pad(m[1])}`; }
    if (/^\d+(\.\d+)?$/.test(s) && +s > 1 && +s < 80000) { // número de série do Excel
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    return null;
  }
  const dataValida = (iso) => { if (!iso) return false; const d = new Date(iso + 'T12:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === iso; };

  function dinheiro(v) {
    let s = String(v).replace(/[R$\s]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  function converter(valor, campo, municipios = []) {
    const bruto = valor == null ? '' : String(valor).trim();
    if (bruto === '' || /^(-|—|nenhum|n\/a|null)$/i.test(bruto)) return { v: null };
    switch (campo.t) {
      case 'date': { const d = data(bruto); return dataValida(d) ? { v: d } : { v: null, aviso: `data não reconhecida: "${bruto}"` }; }
      case 'datetime': {
        const d = data(bruto); const h = /(\d{1,2}):(\d{2})/.exec(bruto);
        if (!dataValida(d)) return { v: null, aviso: `data/hora não reconhecida: "${bruto}"` };
        return { v: `${d}T${h ? pad(h[1]) + ':' + h[2] : '08:00'}:00-05:00` };
      }
      case 'money': { const n = dinheiro(bruto); return n == null ? { v: null, aviso: `valor não reconhecido: "${bruto}"` } : { v: n }; }
      case 'int': { const n = parseInt(bruto, 10); return Number.isFinite(n) ? { v: n } : { v: null, aviso: `número inválido: "${bruto}"` }; }
      case 'bool': return { v: /^(sim|s|x|1|true|verdadeiro|yes|ok)$/i.test(bruto) };
      case 'select': {
        const alvo = normaliza(bruto);
        const op = campo.opcoes.find((o) => normaliza(o) === alvo) || campo.opcoes.find((o) => normaliza(o).startsWith(alvo) || alvo.startsWith(normaliza(o)));
        return op ? { v: op } : { v: null, aviso: `"${bruto}" não é uma opção de ${campo.l}` };
      }
      case 'cpf': {
        if (!cpfValido(bruto)) return { v: null, aviso: 'CPF inválido descartado' };
        const d = bruto.replace(/\D/g, ''); return { v: `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` };
      }
      case 'phone': {
        let d = bruto.replace(/\D/g, ''); if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
        if (d.length === 8 || d.length === 9) d = '68' + d; // sem DDD: assume Acre
        if (d.length !== 10 && d.length !== 11) return { v: null, aviso: `telefone inválido: "${bruto}"` };
        return { v: `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` };
      }
      case 'cep': { const d = bruto.replace(/\D/g, ''); return d.length === 8 ? { v: `${d.slice(0, 5)}-${d.slice(5)}` } : { v: null, aviso: 'CEP inválido' }; }
      case 'uf': {
        const n = normaliza(bruto); if (/^[a-z]{2}$/.test(n)) return { v: n.toUpperCase() };
        return UFS[n] ? { v: UFS[n] } : { v: null, aviso: `UF não reconhecida: "${bruto}"` };
      }
      case 'municipio': { const m = municipios.find((x) => normaliza(x) === normaliza(bruto)); return { v: m || bruto }; }
      case 'email': return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bruto) ? { v: bruto.toLowerCase() } : { v: null, aviso: 'e-mail inválido' };
      case 'url': return /^https?:\/\//.test(bruto) ? { v: bruto } : { v: 'https://' + bruto.replace(/^\/+/, '') };
      case 'tags': return { v: [...new Set(bruto.split(/[,;|]/).map((x) => x.trim()).filter(Boolean))].join(', ') };
      default: return { v: bruto.slice(0, 5000) };
    }
  }

  // ------------------------------------------------------------ montagem das linhas
  function preparar(linhas, inicioCabecalho, mapa, ent, municipios = []) {
    const campos = Object.fromEntries(ent.campos.map((c) => [c.n, c]));
    const obrig = ent.campos.filter((c) => c.req && !c.auto && !c.calc && c.t !== 'file' && c.t !== 'ref' && c.padrao === undefined);
    const registros = []; const erros = []; let vazias = 0;
    for (let i = inicioCabecalho + 1; i < linhas.length; i++) {
      const l = linhas[i] || [];
      const preenchidas = l.filter((x) => String(x ?? '').trim() !== '');
      if (!preenchidas.length) { vazias++; continue; }
      if (preenchidas.length === 1 && /^nenhum|^total/i.test(String(preenchidas[0]).trim())) { vazias++; continue; }
      const dados = {}; const avisos = [];
      mapa.forEach((n, j) => {
        if (!n || !campos[n]) return;
        const r = converter(l[j], campos[n], municipios);
        if (r.aviso) avisos.push(r.aviso);
        if (r.v != null && r.v !== '') dados[n] = r.v;
      });
      const faltam = obrig.filter((c) => dados[c.n] == null).map((c) => c.l);
      if (faltam.length) erros.push({ linha: i + 1, msg: `faltando: ${faltam.join(', ')}` });
      else registros.push({ linha: i + 1, dados, avisos });
    }
    return { registros, erros, vazias };
  }

  const API = { normaliza, decodificar, lerCSV, lerXLSX, sugerirMapa, detectarCabecalho, converter, preparar, cpfValido, CAMPOS_IMPORTAVEIS };
  raiz.Importador = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
