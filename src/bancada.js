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

// MENSAGENS — para o Painel ter o que contar.
//
// Os números são de propósito diferentes uns dos outros (11+i recebidas, 6+i
// enviadas por telefone): se a tela trocar uma coluna pela outra, ou somar o
// telefone errado, dá para ver a olho nu em vez de descobrir por acaso.
//
// Três autores, e o terceiro NÃO TEM id — é o histórico anterior ao SQL de
// agosto/2026. Sem ele na bancada, o selo "pelo nome" e o rodapé de aviso
// nunca apareceriam num teste, e eu estaria enviando código que ninguém viu
// rodar.
const AUTORES = [
  { id: "u1", nome: "Rodrigo Alves" },
  { id: "u2", nome: "Camila Souza" },
  { id: null, nome: "Atendente Antigo" },   // mensagem velha: só o nome
];

const dia = 86400e3;
const MENSAGENS = [];
// O que a bancada CONTÉM, contado enquanto se monta — não pelo mesmo caminho
// que a tela usa para contar. É contra isto que o teste compara.
export const ESPERADO = {
  recebidas7: 0, enviadas7: 0, notas7: 0, semId7: 0,
  recebidasTudo: 0, enviadasTudo: 0,
  porTelefone: {},       // id do advogado -> {recebidas, enviadas}
  porTelefoneNome: {},   // o mesmo, pelo NOME — que é o que a tela mostra
  porAutor: {},      // nome -> enviadas
};

let giro = 0;
ADVOGADOS.forEach((adv, i) => {
  const daqui = CONVERSAS.filter((c) => c.advogado_id === adv.id);
  const conv = (k) => daqui[k % daqui.length].id;
  const rec = 11 + i, env = 6 + i, notas = 2;
  ESPERADO.porTelefone[adv.id] = { recebidas: rec, enviadas: env };
  ESPERADO.porTelefoneNome[adv.nome] = { recebidas: rec, enviadas: env };

  for (let k = 0; k < rec; k++) {
    MENSAGENS.push({ id: `m-${adv.id}-r${k}`, conversa_id: conv(k), origem: "cliente", tipo: "texto", texto: `Recebida ${k + 1}`,
      enviado_por: null, enviado_por_id: null,
      criado_em: new Date(Date.now() - (k % 3) * dia).toISOString() });
  }
  ESPERADO.recebidas7 += rec; ESPERADO.recebidasTudo += rec;

  for (let k = 0; k < env; k++) {
    const a = AUTORES[giro++ % AUTORES.length];
    MENSAGENS.push({ id: `m-${adv.id}-e${k}`, conversa_id: conv(k), origem: "advogado", tipo: "texto", texto: `Enviada ${k + 1}`,
      enviado_por: a.nome, enviado_por_id: a.id,
      criado_em: new Date(Date.now() - (k % 3) * dia).toISOString() });
    ESPERADO.porAutor[a.nome] = (ESPERADO.porAutor[a.nome] || 0) + 1;
    if (!a.id) ESPERADO.semId7++;
  }
  ESPERADO.enviadas7 += env; ESPERADO.enviadasTudo += env;

  // Nota interna: fica de fora de enviadas e de recebidas.
  for (let k = 0; k < notas; k++) {
    MENSAGENS.push({ id: `m-${adv.id}-n${k}`, conversa_id: conv(k), origem: "nota", tipo: "texto", texto: `Nota ${k + 1}`,
      enviado_por: "Rodrigo Alves", enviado_por_id: "u1",
      criado_em: new Date(Date.now() - k * dia).toISOString() });
  }
  ESPERADO.notas7 += notas;
});

// Um lote VELHO, só no primeiro telefone: é o que faz "7 dias" e "Tudo" darem
// respostas diferentes. Sem ele, o filtro de período passaria no teste mesmo
// se não filtrasse nada.
const VELHAS = 20;
for (let k = 0; k < VELHAS; k++) {
  MENSAGENS.push({ id: `m-velha-${k}`, conversa_id: CONVERSAS[0].id, origem: "cliente", tipo: "texto", texto: `Antiga ${k + 1}`,
    enviado_por: null, enviado_por_id: null,
    criado_em: new Date(Date.now() - 100 * dia).toISOString() });
}
ESPERADO.recebidasTudo += VELHAS;

// O teste lê daqui. É o que a BANCADA contém, contado na hora de montar; a
// tela conta por outro caminho. Se os dois baterem, a tela está certa; se eu
// escrevesse os números à mão no teste, estaria conferindo a minha aritmética.
if (typeof globalThis !== "undefined") globalThis.__ESPERADO = ESPERADO;

const TABELAS = {
  advogados: ADVOGADOS,
  departamentos: DEPARTAMENTOS,
  conversas: CONVERSAS,
  usuarios: [{ id: "u1", admin: true, nome: "Rodrigo Alves" }],
  permissoes: [],            // vazio + admin = alcança tudo
  mensagens: MENSAGENS, contatos: [], notas: [], tags: [], conversa_tags: [],
  mensagens_rapidas: [], figurinhas_favoritas: [], fila_envio: [],
};

/** Compara número com número e texto com texto. Data em ISO ordena sozinha
    como texto, que é o que o Postgres faz com `timestamptz` de qualquer jeito. */
function comparar(a, b) {
  const na = Number(a), nb = Number(b);
  if (a !== null && a !== "" && b !== null && b !== "" && !isNaN(na) && !isNaN(nb)) return na - nb;
  const sa = String(a ?? ""), sb = String(b ?? "");
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

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
    // E precisa comparar TEXTO também: o corte de período do Painel é
    // `.gte("criado_em", "2026-…")`. Passando por `Number()`, aquilo virava
    // NaN >= NaN, que é falso sempre — a bancada devolvia zero mensagem e a
    // tela parecia quebrada quando quem estava quebrado era o instrumento.
    gt(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) > 0); return eu; },
    gte(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) >= 0); return eu; },
    lt(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) < 0); return eu; },
    lte(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) <= 0); return eu; },
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
