/* Modelo das telas: cada cadastro é descrito uma vez; listas, filtros e formulários são gerados daqui.
   Os nomes de campo (n) são exatamente as colunas das tabelas no Supabase. */
'use strict';
(function (raiz) {
  const MUNICIPIOS_AC = ['Acrelândia', 'Assis Brasil', 'Brasiléia', 'Bujari', 'Capixaba', 'Cruzeiro do Sul',
    'Epitaciolândia', 'Feijó', 'Jordão', 'Mâncio Lima', 'Manoel Urbano', 'Marechal Thaumaturgo',
    'Plácido de Castro', 'Porto Acre', 'Porto Walter', 'Rio Branco', 'Rodrigues Alves', 'Santa Rosa do Purus',
    'Sena Madureira', 'Senador Guiomard', 'Tarauacá', 'Xapuri'];
  const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
  const F = (n, l, t = 'text', extra = {}) => ({ n, l, t, ...extra });
  const ENDERECO = [F('cep', 'CEP', 'cep'), F('uf', 'Estado', 'uf', { padrao: 'AC' }),
    F('municipio', 'Município', 'municipio', { filtro: true }), F('bairro', 'Bairro', 'text', { filtro: true }),
    F('endereco', 'Endereço')];

  const ENT = {
    cidadaos: {
      rotulo: 'Cidadãos', singular: 'Cidadão', icone: '👤', titulo: 'nome', ordem: ['nome', true],
      lista: ['nome', 'telefone', 'municipio', 'bairro', 'tags'],
      campos: [
        F('nome', 'Nome', 'text', { req: true, busca: true }),
        F('cpf', 'CPF', 'cpf', { busca: true }),
        F('nascimento', 'Data de nascimento', 'date'),
        F('telefone', 'Telefone', 'phone', { busca: true }),
        F('whatsapp', 'WhatsApp', 'phone'),
        F('email', 'E-mail', 'email'),
        ...ENDERECO,
        F('tags', 'Tags', 'tags', { filtro: true, busca: true }),
        F('lider', 'Liderança comunitária', 'bool', { filtro: true }),
        F('consentimento', 'Autoriza contato (LGPD)', 'bool', { filtro: true,
          ajuda: 'Marque somente com autorização expressa do titular para receber mensagens.' }),
        F('base_legal', 'Base legal (LGPD)', 'select', { padrao: 'Atendimento a pedido do titular', opcoes: [
          'Consentimento', 'Atendimento a pedido do titular', 'Cumprimento de obrigação legal',
          'Execução de políticas públicas', 'Legítimo interesse'] }),
        F('observacoes', 'Observações', 'textarea'),
      ],
      filhos: [['demandas', 'cidadao_id'], ['atendimentos', 'cidadao_id'], ['lembretes', 'cidadao_id']],
    },
    instituicoes: {
      rotulo: 'Instituições', singular: 'Instituição', icone: '🏛', titulo: 'nome', ordem: ['nome', true],
      lista: ['nome', 'tipo', 'municipio', 'telefone'],
      campos: [
        F('nome', 'Nome', 'text', { req: true, busca: true }),
        F('tipo', 'Tipo', 'select', { filtro: true, opcoes: ['Associação', 'Igreja', 'Escola', 'Unidade de saúde',
          'Prefeitura', 'Secretaria', 'Cooperativa', 'Sindicato', 'ONG', 'Outro'] }),
        F('cnpj', 'CNPJ', 'text', { busca: true }), F('responsavel', 'Responsável', 'text', { busca: true }),
        F('telefone', 'Telefone', 'phone'), F('email', 'E-mail', 'email'), ...ENDERECO,
        F('observacoes', 'Observações', 'textarea'),
      ],
      filhos: [['demandas', 'instituicao_id'], ['emendas', 'instituicao_id']],
    },
    autoridades: {
      rotulo: 'Contatos de autoridade', singular: 'Autoridade', icone: '🎖', titulo: 'nome', ordem: ['nome', true],
      lista: ['nome', 'cargo', 'partido', 'uf', 'telefone'],
      campos: [
        F('nome', 'Nome', 'text', { req: true, busca: true }), F('nome_civil', 'Nome civil', 'text', { busca: true }),
        F('cargo', 'Cargo', 'select', { filtro: true, opcoes: ['Deputado(a) Estadual', 'Deputado(a) Federal',
          'Senador(a)', 'Governador(a)', 'Vice-governador(a)', 'Secretário(a) de Estado', 'Prefeito(a)',
          'Vice-prefeito(a)', 'Vereador(a)', 'Magistrado(a)', 'Promotor(a)', 'Outro'] }),
        F('orgao', 'Órgão / Casa', 'text', { busca: true }), F('partido', 'Partido', 'text', { filtro: true }),
        F('uf', 'UF', 'uf', { filtro: true }), F('telefone', 'Telefone', 'phone'), F('email', 'E-mail', 'email'),
        F('gabinete', 'Gabinete / sala'), F('aniversario', 'Aniversário', 'date'),
        F('observacoes', 'Observações', 'textarea'),
      ],
    },
    demandas: {
      rotulo: 'Demandas', singular: 'Demanda', icone: '📖', titulo: 'titulo', ordem: ['id', false],
      lista: ['protocolo', 'titulo', 'cidadao_id', 'municipio', 'status', 'prazo'],
      campos: [
        F('protocolo', 'Protocolo', 'text', { auto: true, busca: true }),
        F('titulo', 'Título', 'text', { req: true, busca: true }),
        F('descricao', 'Descrição', 'textarea', { busca: true }),
        F('categoria', 'Categoria', 'select', { filtro: true, opcoes: ['Saúde', 'Educação', 'Infraestrutura',
          'Assistência social', 'Segurança', 'Emprego e renda', 'Documentação', 'Meio ambiente', 'Produção rural', 'Outro'] }),
        F('cidadao_id', 'Cidadão solicitante', 'ref', { ref: 'cidadaos', filtro: true }),
        F('instituicao_id', 'Instituição solicitante', 'ref', { ref: 'instituicoes', filtro: true }),
        F('municipio', 'Município', 'municipio', { filtro: true }), F('bairro', 'Bairro'),
        F('status', 'Status', 'select', { req: true, padrao: 'Aberta', filtro: true,
          opcoes: ['Aberta', 'Em andamento', 'Encaminhada', 'Atendida', 'Não atendida'] }),
        F('prioridade', 'Prioridade', 'select', { padrao: 'Média', filtro: true, opcoes: PRIORIDADES }),
        F('responsavel_id', 'Responsável', 'ref', { ref: 'perfis', filtro: true }),
        F('prazo', 'Prazo', 'date'), F('encaminhado_para', 'Encaminhado para (órgão)'),
        F('resposta', 'Resposta ao cidadão', 'textarea'),
      ],
      filhos: [['atendimentos', 'demanda_id'], ['documentos', 'demanda_id']],
    },
    atendimentos: {
      rotulo: 'Atendimentos', singular: 'Atendimento', icone: '☰', titulo: 'assunto', ordem: ['data', false],
      lista: ['data', 'canal', 'cidadao_id', 'assunto', 'responsavel_id'],
      campos: [
        F('data', 'Data', 'date', { req: true, padrao: 'hoje' }),
        F('canal', 'Canal', 'select', { req: true, padrao: 'Presencial', filtro: true,
          opcoes: ['Presencial', 'Telefone', 'WhatsApp', 'E-mail', 'Redes sociais', 'Visita'] }),
        F('cidadao_id', 'Cidadão', 'ref', { ref: 'cidadaos', filtro: true }),
        F('assunto', 'Assunto', 'text', { req: true, busca: true }),
        F('relato', 'Relato', 'textarea', { busca: true }),
        F('demanda_id', 'Demanda gerada', 'ref', { ref: 'demandas' }),
        F('responsavel_id', 'Atendido por', 'ref', { ref: 'perfis', filtro: true }),
      ],
    },
    emendas: {
      rotulo: 'Emendas', singular: 'Emenda', icone: '🏷', titulo: 'objeto', ordem: ['id', false],
      lista: ['numero', 'objeto', 'municipio', 'valor', 'valor_pago', 'status'],
      campos: [
        F('numero', 'Nº da emenda', 'text', { busca: true }),
        F('tipo', 'Tipo', 'select', { filtro: true, padrao: 'Individual', opcoes: ['Individual', 'Bancada', 'Comissão'] }),
        F('ano', 'Ano de indicação', 'int', { req: true, padrao: 'ano', filtro: true }),
        F('orgao', 'Secretaria / Órgão executor', 'text', { req: true, busca: true, filtro: true }),
        F('objeto', 'Destino / Objeto', 'text', { req: true, busca: true }),
        F('acao', 'Ação orçamentária', 'textarea'),
        F('beneficiario', 'Beneficiário', 'text', { busca: true }),
        F('instituicao_id', 'Instituição solicitante', 'ref', { ref: 'instituicoes', filtro: true }),
        F('cidadao_id', 'Cidadão solicitante', 'ref', { ref: 'cidadaos' }),
        F('contato_politico', 'Contato político (telefone)', 'phone'),
        F('origem', 'Origem do pedido'),
        F('responsavel_id', 'Responsável no gabinete', 'ref', { ref: 'perfis', filtro: true }),
        F('valor', 'Valor indicado', 'money', { req: true }),
        F('valor_empenhado', 'Valor empenhado', 'money'),
        F('empenho', 'Nº do empenho'),
        F('tramite', 'Trâmite (situação no órgão)', 'textarea'),
        F('status', 'Status', 'select', { req: true, padrao: 'Recebida', filtro: true, opcoes: ['Recebida',
          'Cadastrada', 'Empenhada', 'Paga parcialmente', 'Paga', 'Arquivada / Não atendida'] }),
        F('valor_pago', 'Valor pago (soma dos pagamentos)', 'money', { calc: true }),
        F('ultimo_pagamento', 'Último pagamento', 'date', { calc: true }),
        ...ENDERECO,
        F('observacoes', 'Observações', 'textarea'),
      ],
      filhos: [['pagamentos', 'emenda_id'], ['documentos', 'emenda_id']],
    },
    pagamentos: {
      rotulo: 'Pagamentos de emendas', singular: 'Pagamento', icone: '💲', titulo: 'documento', ordem: ['data', false],
      lista: ['emenda_id', 'data', 'valor', 'documento'], oculto: true,
      campos: [
        F('emenda_id', 'Emenda', 'ref', { ref: 'emendas', req: true, filtro: true }),
        F('data', 'Data do pagamento', 'date', { req: true, padrao: 'hoje' }),
        F('valor', 'Valor pago', 'money', { req: true }),
        F('documento', 'Ordem bancária / documento'),
      ],
    },
    agenda: {
      rotulo: 'Agenda', singular: 'Compromisso', icone: '📅', titulo: 'titulo', ordem: ['inicio', false],
      lista: ['inicio', 'titulo', 'local', 'municipio', 'tipo'],
      campos: [
        F('titulo', 'Título', 'text', { req: true, busca: true }),
        F('inicio', 'Início', 'datetime', { req: true }), F('fim', 'Fim', 'datetime'),
        F('tipo', 'Tipo', 'select', { filtro: true, opcoes: ['Sessão plenária', 'Comissão', 'Audiência pública',
          'Reunião', 'Visita a município', 'Evento', 'Atendimento', 'Outro'] }),
        F('local', 'Local', 'text', { busca: true }), F('municipio', 'Município', 'municipio', { filtro: true }),
        F('participantes', 'Participantes', 'textarea'), F('observacoes', 'Observações', 'textarea'),
      ],
    },
    tarefas: {
      rotulo: 'Tarefas', singular: 'Tarefa', icone: '✎', titulo: 'titulo', ordem: ['prazo', true],
      lista: ['titulo', 'responsavel_id', 'prazo', 'prioridade', 'status'],
      campos: [
        F('titulo', 'Título', 'text', { req: true, busca: true }), F('descricao', 'Descrição', 'textarea'),
        F('responsavel_id', 'Responsável', 'ref', { ref: 'perfis', filtro: true }), F('prazo', 'Prazo', 'date'),
        F('prioridade', 'Prioridade', 'select', { padrao: 'Média', filtro: true, opcoes: PRIORIDADES }),
        F('status', 'Status', 'select', { req: true, padrao: 'A fazer', filtro: true, opcoes: ['A fazer', 'Em andamento', 'Concluída'] }),
      ],
    },
    lembretes: {
      rotulo: 'Lembretes de relacionamento', singular: 'Lembrete', icone: '🤝', titulo: 'motivo', ordem: ['data', true],
      lista: ['data', 'cidadao_id', 'motivo', 'feito'],
      campos: [
        F('cidadao_id', 'Cidadão', 'ref', { ref: 'cidadaos', req: true, filtro: true }),
        F('data', 'Data', 'date', { req: true }), F('motivo', 'Motivo', 'text', { req: true, busca: true }),
        F('feito', 'Concluído', 'bool', { filtro: true }),
      ],
    },
    documentos: {
      rotulo: 'Documentos', singular: 'Documento', icone: '📄', titulo: 'nome', ordem: ['id', false],
      lista: ['nome', 'tags', 'arquivo_nome', 'criado_em'],
      campos: [
        F('nome', 'Nome', 'text', { req: true, busca: true }),
        F('arquivo', 'Arquivo (até 8 MB)', 'file', { req: true }),
        F('arquivo_nome', 'Arquivo', 'text', { calc: true }),
        F('tags', 'Tags', 'tags', { busca: true, filtro: true }),
        F('emenda_id', 'Emenda vinculada', 'ref', { ref: 'emendas' }),
        F('demanda_id', 'Demanda vinculada', 'ref', { ref: 'demandas' }),
      ],
    },
    links: {
      rotulo: 'Links sociais', singular: 'Link', icone: '🔗', titulo: 'rede', ordem: ['rede', true],
      lista: ['rede', 'url', 'descricao'],
      campos: [
        F('rede', 'Rede', 'select', { req: true, opcoes: ['Instagram', 'Facebook', 'YouTube', 'TikTok', 'X',
          'WhatsApp (canal)', 'Site', 'Outro'] }),
        F('url', 'Endereço (URL)', 'url', { req: true }), F('descricao', 'Descrição'),
      ],
    },
    perfis: {
      rotulo: 'Usuários', singular: 'Usuário', icone: '🔑', titulo: 'nome', ordem: ['nome', true], admin: true,
      semCriar: true, lista: ['nome', 'email', 'papel', 'ativo', 'ultimo_acesso'],
      campos: [
        F('nome', 'Nome', 'text', { req: true, busca: true }),
        F('email', 'E-mail (login)', 'email', { calc: true, busca: true }),
        F('papel', 'Perfil de acesso', 'select', { req: true, filtro: true, opcoes: ['admin', 'assessor', 'consulta'],
          ajuda: 'admin: tudo · assessor: cadastra e edita · consulta: somente leitura' }),
        F('ativo', 'Acesso aprovado', 'bool', { filtro: true,
          ajuda: 'Novos cadastros chegam desativados. Ative para liberar o acesso.' }),
        F('ultimo_acesso', 'Último acesso', 'datetime', { calc: true }),
      ],
    },
    gabinete: {
      rotulo: 'Dados do gabinete', singular: 'Gabinete', icone: '⚙', titulo: 'parlamentar', ordem: ['id', true],
      unico: true, adminEscrita: true, lista: ['parlamentar'],
      campos: [
        F('parlamentar', 'Nome parlamentar', 'text', { req: true }), F('nome_civil', 'Nome civil'),
        F('partido', 'Sigla do partido'), F('uf', 'UF', 'uf'), F('casa', 'Casa legislativa'),
        F('predio', 'Prédio'), F('sala', 'Sala'), F('andar', 'Andar'),
        F('telefone', 'Telefone do gabinete', 'phone'), F('email', 'E-mail do gabinete', 'email'),
        F('encarregado_lgpd', 'Encarregado de dados (LGPD)', 'text',
          { ajuda: 'Pessoa de contato para pedidos de titulares (acesso, correção, exclusão).' }),
      ],
    },
  };

  const MENU = [
    ['painel', 'Visão geral', '📊'], ['notificacoes', 'Notificações do dia', '🔔'], ['e/agenda'],
    ['aniversarios', 'Aniversariantes', '🎁'], ['e/cidadaos'], ['e/demandas'], ['e/atendimentos'], ['e/emendas'],
    ['e/instituicoes'], ['e/autoridades'], ['e/tarefas'], ['e/lembretes'], ['e/documentos'],
    ['mapa', 'Mapa do Acre', '📍'], ['assistente', 'Assistente de IA', '✨'], ['importar', 'Importar planilhas', '⬆'],
    ['whatsapp', 'WhatsApp', '💬'], ['e/links'], ['e/perfis'], ['e/gabinete'], ['auditoria', 'Auditoria', '🛡'],
  ];

  raiz.GAB = { ENT, MENU, MUNICIPIOS_AC };
})(typeof window !== 'undefined' ? window : globalThis);
