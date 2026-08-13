// BANCADA — um Supabase de mentira, só para ver a tela funcionando.
//
// Não vai para produção: o `supabase.js` só troca por este quando o Vite roda
// com VITE_BANCADA=1. Serve para reproduzir defeito de tela sem tocar no banco
// de verdade e sem precisar de chave nenhuma.
//
// O ATRASO É DE PROPÓSITO. O "pisca" da contagem só existe na janela entre o
// clique e a resposta da consulta; num banco rápido ela dura poucos quadros e
// escapa da medição. Aqui a busca de conversas demora `ATRASO_CONVERSAS` ms,
// que é o mesmo defeito em câmera lenta.
const ATRASO_CONVERSAS = 700;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const DEPARTAMENTOS = [
  { id: 1, nome: "Interno", slug: "interno", cor: "#a06cd5", ordem: 1, ativo: true },
  { id: 2, nome: "Comercial", slug: "comercial", cor: "#8a8f98", ordem: 2, ativo: true },
  { id: 3, nome: "Sucesso do Cliente", slug: "sdc", cor: "#0f8a6a", ordem: 3, ativo: true },
  { id: 4, nome: "Audiências", slug: "audiencias", cor: "#d99a1e", ordem: 4, ativo: true },
  { id: 5, nome: "Acordos", slug: "acordos", cor: "#3b82f6", ordem: 5, ativo: true },
  { id: 6, nome: "Subsídio", slug: "subsidio", cor: "#e5573f", ordem: 6, ativo: true },
  { id: 7, nome: "Trabalhista", slug: "trabalhista", cor: "#14b8a6", ordem: 7, ativo: true },
  { id: 8, nome: "Financeiro", slug: "financeiro", cor: "#f59e0b", ordem: 8, ativo: true },
];

// Telefones: o suficiente para haver departamento com um só e com vários.
const ADVOGADOS = [
  { id: "a1", nome: "Dr. Jorge Mesquita", numero: "5511976378160", foto_url: null, departamento_id: 1, ativo: true },
  { id: "a2", nome: "Comercial", numero: "5511993289441", foto_url: null, departamento_id: 2, ativo: true },
  { id: "a3", nome: "SDC CCR", numero: "5511950473857", foto_url: null, departamento_id: 3, ativo: true },
  { id: "a4", nome: "Sucesso do Cliente", numero: "5511995941666", foto_url: null, departamento_id: 3, ativo: true },
  { id: "a5", nome: "SAC", numero: "5511969401932", foto_url: null, departamento_id: 3, ativo: true },
  { id: "a6", nome: "Audiências", numero: "5511913559990", foto_url: null, departamento_id: 4, ativo: true },
  { id: "a7", nome: "Acordos 1", numero: "5511911112222", foto_url: null, departamento_id: 5, ativo: true },
  { id: "a8", nome: "Acordos 2", numero: "5511933334444", foto_url: null, departamento_id: 5, ativo: true },
  { id: "a9", nome: "Subsidio Emenda", numero: "5511992057503", foto_url: null, departamento_id: 6, ativo: true },
  { id: "a10", nome: "Trabalhista", numero: "5511955556666", foto_url: null, departamento_id: 7, ativo: true },
  { id: "a11", nome: "Financeiro", numero: "5511977778888", foto_url: null, departamento_id: 8, ativo: true },
];

// Quantas conversas NÃO LIDAS cada telefone tem. São números bem diferentes de
// propósito: se o selo mostrar o do vizinho, dá para ver a olho nu.
const NAO_LIDAS = { a1: 3, a2: 5, a3: 26, a4: 1, a5: 12, a6: 6, a7: 9, a8: 2, a9: 8, a10: 4, a11: 7 };

const NOMES = ["ANDRE EUGENIO", "PRISCILA DE JESUS FRANCO", "RODRIGO ALVES SOUSA",
  "MARIA APARECIDA DA SILVA", "JOÃO FERREIRA DO CARMO", "BRUNA FERREIRA SOUZA",
  "CAMILA MARTINS", "LUIZ DOS SANTOS SOARES", "VANESSA ALVES DE JESUS",
  "PEDRO COSTA ALMEIDA", "SIMONE ALVES FILHO", "DÉBORA CARVALHO"];

const CONVERSAS = [];
for (const adv of ADVOGADOS) {
  const naoLidas = NAO_LIDAS[adv.id] || 0;
  // Cada telefone tem 4 conversas a mais do que as não lidas, para a lista
  // nunca ser só o contador.
  for (let i = 0; i < naoLidas + 4; i++) {
    CONVERSAS.push({
      id: `${adv.id}-c${i}`,
      advogado_id: adv.id,
      contato_id: `${adv.id}-ct${i}`,
      nao_lidas: i < naoLidas ? 1 : 0,
      arquivada: false, fixada: false, favorita: false,
      ultima_atividade: new Date(Date.now() - i * 3600e3).toISOString(),
      ultima_mensagem: `Conversa ${i + 1} de ${adv.nome}`,
      frente: null, vantoro_nome: null, digitando_ate: null,
      contato: { nome: `${NOMES[i % NOMES.length]}`, numero: `5511${900000000 + i}`, foto_url: null },
    });
  }
}

const TABELAS = {
  advogados: ADVOGADOS,
  departamentos: DEPARTAMENTOS,
  conversas: CONVERSAS,
  usuarios: [{ id: "u1", admin: true, nome: "Rodrigo Alves" }],
  permissoes: [],            // vazio + admin = alcança tudo
  mensagens: [], contatos: [], notas: [], tags: [], conversa_tags: [],
  mensagens_rapidas: [], figurinhas_favoritas: [], fila_envio: [],
};

/** Uma consulta encadeável que devolve sempre `{data, error}` no final. */
function consulta(tabela) {
  let linhas = (TABELAS[tabela] || []).slice();
  const eu = {
    select() { return eu; },
    eq(col, val) { linhas = linhas.filter((l) => String(l[col]) === String(val)); return eu; },
    in(col, vals) { linhas = linhas.filter((l) => vals.map(String).includes(String(l[col]))); return eu; },
    is(col, val) { linhas = linhas.filter((l) => l[col] === val); return eu; },
    neq(col, val) { linhas = linhas.filter((l) => String(l[col]) !== String(val)); return eu; },
    // `gt` PRECISA filtrar de verdade: o selo da barra lateral sai de
    // `.gt("nao_lidas", 0)`, e com um cano vazio aqui ele contava também as
    // conversas já lidas — a bancada acusava um defeito que o painel não tem.
    gt(col, val) { linhas = linhas.filter((l) => Number(l[col]) > Number(val)); return eu; },
    gte(col, val) { linhas = linhas.filter((l) => Number(l[col]) >= Number(val)); return eu; },
    lt(col, val) { linhas = linhas.filter((l) => Number(l[col]) < Number(val)); return eu; },
    lte(col, val) { linhas = linhas.filter((l) => Number(l[col]) <= Number(val)); return eu; },
    or() { return eu; }, not() { return eu; }, contains() { return eu; }, ilike() { return eu; },
    order() { return eu; }, limit() { return eu; }, range() { return eu; },
    single() { return eu.then((r) => ({ data: r.data[0] || null, error: null })); },
    maybeSingle() { return eu.then((r) => ({ data: r.data[0] || null, error: null })); },
    // GRAVAR TAMBÉM É ENCADEÁVEL. O painel escreve `upsert(...).select("id")
    // .single()`, e devolver uma Promise aqui quebrava a corrente com
    // "upsert(...).select is not a function" — a bancada acusava um defeito
    // que o painel não tem. Além de encadear, estas guardam a linha: sem isso
    // o contato criado pelo link não existia na consulta seguinte, e o teste
    // do link nunca chegava ao fim.
    insert(reg) { return eu.gravar(reg); },
    upsert(reg) { return eu.gravar(reg); },
    gravar(reg) {
      const novos = (Array.isArray(reg) ? reg : [reg]).map((r, i) => ({
        id: r.id || `${tabela}-${(TABELAS[tabela] || []).length + i + 1}`, ...r,
      }));
      const tab = TABELAS[tabela] || (TABELAS[tabela] = []);
      for (const n of novos) {
        // "onConflict: numero" é o uso real: mesmo número, mesma linha.
        const j = tab.findIndex((l) => (n.numero && l.numero === n.numero) || l.id === n.id);
        if (j >= 0) tab[j] = { ...tab[j], ...n }; else tab.push(n);
      }
      linhas = novos;
      return eu;
    },
    update(reg) { linhas = linhas.map((l) => Object.assign(l, reg)); return eu; },
    delete() { return eu; },
    async then(resolver) {
      if (tabela === "conversas") await espera(ATRASO_CONVERSAS);
      return resolver({ data: linhas, error: null });
    },
  };
  return eu;
}

export const supabase = {
  from: (t) => consulta(t),
  rpc: () => Promise.resolve({ data: null, error: null }),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "u1", email: "demo@ropelimi", user_metadata: { nome: "Rodrigo Alves" } } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  },
  channel: () => {
    const canal = { on: () => canal, subscribe: () => canal, unsubscribe: () => {} };
    return canal;
  },
  removeChannel: () => {},
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
};
