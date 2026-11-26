// Executa o Code.gs (ou o pacote único PremioTJAC_TudoEmUm.gs) em Node com simulações mínimas dos serviços do Google.
// Uso: AGORA=2026-12-05T10:00:00-05:00 node teste_servidor.js ../apps-script/Code.gs ../dados/unidades.json
//      AGORA=2026-12-05T10:00:00-05:00 node teste_servidor.js ../apps-script/PremioTJAC_TudoEmUm.gs ../dados/unidades.json
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const path = require('path');
const logo = path.join(path.dirname(process.argv[2]), 'Logo.gs');
const PACOTE = /TudoEmUm/.test(process.argv[2]);
const code = (!PACOTE && fs.existsSync(logo) ? fs.readFileSync(logo, 'utf8') + '\n' : '') + fs.readFileSync(process.argv[2], 'utf8');
const unidades = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const payload = JSON.parse(fs.readFileSync('payload.json', 'utf8'));
const sheets = {};
function sheet(name) {
  if (!sheets[name]) sheets[name] = { rows: [], getName: () => name,
    appendRow(r) { this.rows.push(r.map(v => typeof v === 'string' && v[0] === "'" ? v.slice(1) : v)); },
    getLastRow() { return this.rows.length; }, getLastColumn() { return this.rows[0] ? this.rows[0].length : 0; },
    getDataRange() { const s = this; return { getDisplayValues: () => s.rows.map(r => r.map(v => String(v))), getValues: () => s.rows }; },
    setName(n) { sheets[n] = this; delete sheets[name]; name = n; },
    getRange() { return { setNumberFormat() { return this; }, setValues(v) { v.forEach(l => sheets[name].appendRow(l)); return this; }, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }, setDataValidation() { return this; }, clearContent() {}, getValues: () => [sheets[name].rows[0]] }; },
    setFrozenRows() {}, deleteRow(i) { this.rows.splice(i - 1, 1); } };
  return sheets[name];
}
if (!PACOTE) sheet('Unidades').appendRow(['codigo', 'nome', 'comarca', 'categoria', 'competencias', 'competencias_descritivas', 'observacao']);
if (!PACOTE) unidades.forEach(u => sheet('Unidades').appendRow([u.codigo, u.nome, u.comarca, u.categoria, u.competencias.join(','), '', '']));
const files = [];
function folder(nome) { return { nome, getId: () => 'id-' + nome, getFoldersByName: n => ({ hasNext: () => false }), createFolder: n => folder(nome + '/' + n), getUrl: () => 'https://drive/' + nome,
  createFile(b) { files.push(nome + '/' + b.getName()); return { getUrl: () => 'https://drive/' + nome + '/' + b.getName() }; }, getFilesByName: () => ({ hasNext: () => false }) }; }
const props = { MODO_TESTE: process.argv[4] || 'NAO' };
let lastHtml = {};
function blob(data, type, name) { return { _d: data, getName: () => name, setName(n) { name = n; return this; }, getBytes: () => Buffer.from(String(data)), getAs(t) { lastHtml[name] = data; return blob(data, t, name); }, getContentType: () => type }; }
const SS = { getSheetByName: n => sheets[n] ? sheet(n) : null, insertSheet: n => sheet(n), getSheets: () => [sheets.Unidades || sheet('Planilha1')], getId: () => 'x', getUrl: () => 'https://sheets/x' };
const ctx = {
  console, Date: (function () { const R = Date; class F extends R { constructor(...a) { if (a.length) super(...a); else super(process.env.AGORA || R.now()); } static now() { return new F().getTime(); } } return F; })(), JSON, Math, String, Number, Object, Array, parseInt, parseFloat, isNaN,
  SpreadsheetApp: { getActiveSpreadsheet: () => PACOTE ? null : SS, create: () => SS, openById: () => SS, flush() {}, newDataValidation() { const o = { requireValueInList() { return o; }, build() { return o; } }; return o; } },
  Logger: { log: m => console.log(String(m)) },
  DriveApp: { createFolder: n => folder(n), getFolderById: () => folder('RAIZ'), getFileById: () => ({ moveTo() {}, getParents: () => ({ hasNext: () => true, next: () => folder('RAIZ') }) }), getRootFolder: () => folder('RAIZ') },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) },
  CacheService: { getScriptCache: () => ({ get: k => k.startsWith('cod_') ? '123456' : null, put() {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  MailApp: { sendEmail: o => { console.log('EMAIL ->', o.to, '|', o.subject); } },
  Utilities: { formatDate: (d) => d.toLocaleString('pt-BR', { timeZone: 'America/Rio_Branco' }), newBlob: blob, base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'),
    computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b), DigestAlgorithm: {}, Charset: {} },
  ScriptApp: { getProjectTriggers: () => [], newTrigger() { const o = { timeBased: () => o, after: () => o, create() {} }; return o; } },
  HtmlService: { createHtmlOutput: h => ({ getAs: t => { const b = blob(h, t, 'doc'); lastHtml['doc' + Object.keys(lastHtml).length] = h; return b; } }) }, ContentService: {}, UrlFetchApp: {}
};
vm.createContext(ctx); vm.runInContext(code, ctx);
if (PACOTE) { console.log(ctx.instalar()); console.log('unidades instaladas:', sheets.Unidades.rows.length - 1, '| modo teste:', props.MODO_TESTE); props.MODO_TESTE = process.argv[4] || 'NAO'; }
let r = JSON.parse(ctx.api('enviarRecurso', JSON.stringify(payload)));
console.log('1º envio:', r.ok, r.id || r.erro);
fs.writeFileSync('registro.html', Object.values(lastHtml).find(h => h.includes('Questionário')));
r = JSON.parse(ctx.api('enviarRecurso', JSON.stringify(payload)));
console.log('2º envio (preclusão):', r.ok, r.erro);
const ruim = JSON.parse(JSON.stringify(payload)); ruim.unidade.codigo = '3620x';
console.log('unid inválida:', JSON.parse(ctx.api('enviarRecurso', JSON.stringify(ruim))).erro);
const semE = JSON.parse(JSON.stringify(payload)); semE.unidade.codigo = '3622'; semE.eixos[0].itens[0].evid.memoria = ''; semE.eixos[0].itens[0].evid.qtd = '5';
console.log('sem evid:', JSON.parse(ctx.api('enviarRecurso', JSON.stringify(semE))).erro);
console.log('status 3621:', ctx.api('status', JSON.stringify({ codigo: '3621' })));
// relatórios finais
ctx.gerarRelatoriosFinais();
console.log('relatorios:', sheets.Relatorios_Finais ? sheets.Relatorios_Finais.rows.length : 0, 'arquivos:', files.length);
const vals = Object.values(lastHtml); fs.writeFileSync('final_3621.html', vals.find(h => h.includes('3621 - 1ª VARA CÍVEL DE RIO BRANCO</td>')));
fs.writeFileSync('final_3622.html', vals.find(h => h.includes('3622 - 2ª VARA CÍVEL DE RIO BRANCO</td>')));
