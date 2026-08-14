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

// O TETO DE LINHAS É DE PROPÓSITO, e é o mesmo da API do Supabase: um `select`
// sem paginação devolve no máximo isto e CALA — não vem erro, não vem aviso,
// vem uma lista curta com cara de lista inteira. Enquanto o painel só lia 120
// mensagens por conversa, isso nunca apareceu. A tela de contagem foi a
// primeira a ler em bloco, e sem este teto aqui ela passava em todos os testes
// da bancada e mentia no banco de verdade.
const LIMITE_LINHAS = 1000;

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
  // MUDO de propósito: nenhuma mensagem. O Painel serve para ver qual número
  // está parado, e um telefone parado só aparece se a tela listar os que estão
  // em zero em vez de só os que tiveram movimento.
  { id: "a12", nome: "Plantão", numero: "5511900001111", foto_url: null, departamento_id: 8, ativo: true },
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
// A primeira versão disto tinha 300 mensagens, três autores certinhos e o
// valor "cliente" em `origem`. Passava em tudo e não provava nada: o banco de
// verdade tem MILHARES de linhas, `origem` é "contato", as notas moram noutra
// tabela, e há mensagem enviada que não é de atendente nenhum. Agora a bancada
// tem os quatro problemas.
//
// 1. VOLUME acima do teto de linhas que a API do Supabase devolve (ver
//    LIMITE_LINHAS). É o que quebra qualquer contagem feita baixando tudo.
// 2. `origem` com os valores REAIS: "contato" e "advogado".
// 3. NOTAS na tabela `notas` — nunca em `mensagens`.
// 4. "WhatsApp" em `enviado_por`: é o rótulo que a ponte grava quando a
//    mensagem saiu pelo aparelho, fora do Zorvin. Não é uma pessoa.
const AUTORES = [
  { id: "u1", nome: "Rodrigo Sousa" },
  { id: "u2", nome: "Camila Souza" },
  { id: null, nome: "Atendente Antigo" },   // histórico: só o nome sobrou
];

// RÓTULO QUE NÃO É PESSOA. O importador de histórico assina as mensagens
// enviadas com o nome da LINHA como estava salvo no celular de quem exportou.
// Isso entrava na lista de atendentes como se fosse um colega, e no topo,
// porque são milhares. Marcado no de-para, sai do ranking sem sumir da conta.
const ROTULOS_NAO_PESSOA = ["Cadastro - C&A", "Atendimento Estratégico"];

const dia = 86400e3;
const MENSAGENS = [];
const NOTAS = [];
// O que a bancada CONTÉM, contado enquanto se monta — não pelo mesmo caminho
// que a tela usa. É contra isto que o teste compara.
export const ESPERADO = {
  recebidas7: 0, enviadas7: 0, notas7: 0, semId7: 0, aparelho7: 0,
  recebidasTudo: 0, enviadasTudo: 0,
  porTelefone: {},       // id do advogado -> {recebidas, enviadas}
  porTelefoneNome: {},   // o mesmo, pelo NOME — que é o que a tela mostra
  porAutor: {},          // nome de GENTE -> enviadas ("WhatsApp" fica de fora)
  porRotulo: {},         // rótulo que NÃO é gente -> enviadas
  rotulos7: 0,
  // Um autor de cada tipo, para o teste não precisar cravar nome nenhum. Um
  // nome escrito à mão no teste vira reprovação falsa no dia em que a bancada
  // muda — foi o que aconteceu ao trocar "Rodrigo Alves" por "Rodrigo Sousa".
  autorComId: AUTORES.find((a) => a.id)?.nome || null,
  autorSemId: AUTORES.find((a) => !a.id)?.nome || null,
};

let giro = 0;
ADVOGADOS.forEach((adv, i) => {
  const daqui = CONVERSAS.filter((c) => c.advogado_id === adv.id);
  const conv = (k) => daqui[k % daqui.length].id;
  // Volumes bem diferentes entre telefones, e grandes o bastante para o total
  // passar do teto de linhas da API.
  const mudo = adv.id === "a12";
  const rec = mudo ? 0 : 100 + i * 10, env = mudo ? 0 : 50 + i * 5,
        aparelho = mudo ? 0 : 5 + i, notas = mudo ? 0 : 3;
  ESPERADO.porTelefone[adv.id] = { recebidas: rec, enviadas: env + aparelho };
  ESPERADO.porTelefoneNome[adv.nome] = { recebidas: rec, enviadas: env + aparelho };

  for (let k = 0; k < rec; k++) {
    MENSAGENS.push({ id: `m-${adv.id}-r${k}`, conversa_id: conv(k), origem: "contato",
      tipo: "texto", texto: `Recebida ${k + 1}`, enviado_por: null, enviado_por_id: null,
      criado_em: new Date(Date.now() - (k % 3) * dia).toISOString() });
  }
  ESPERADO.recebidas7 += rec; ESPERADO.recebidasTudo += rec;

  for (let k = 0; k < env; k++) {
    const a = AUTORES[giro++ % AUTORES.length];
    MENSAGENS.push({ id: `m-${adv.id}-e${k}`, conversa_id: conv(k), origem: "advogado",
      tipo: "texto", texto: `Enviada ${k + 1}`, enviado_por: a.nome, enviado_por_id: a.id,
      criado_em: new Date(Date.now() - (k % 3) * dia).toISOString() });
    ESPERADO.porAutor[a.nome] = (ESPERADO.porAutor[a.nome] || 0) + 1;
    if (!a.id) ESPERADO.semId7++;
  }

  // Saiu pelo APARELHO, não pelo Zorvin. Conta como enviada do telefone, mas
  // não é atendente nenhum — e listar "WhatsApp" no meio da equipe, em geral
  // no topo, é exatamente o tipo de número errado que se lê como certo.
  for (let k = 0; k < aparelho; k++) {
    MENSAGENS.push({ id: `m-${adv.id}-w${k}`, conversa_id: conv(k), origem: "advogado",
      tipo: "texto", texto: `Pelo aparelho ${k + 1}`, enviado_por: "WhatsApp", enviado_por_id: null,
      criado_em: new Date(Date.now() - (k % 3) * dia).toISOString() });
  }
  ESPERADO.aparelho7 += aparelho;

  // Só no primeiro telefone, e em volume grande — como no banco de verdade.
  let deRotulo = 0;
  if (i === 0) {
    ROTULOS_NAO_PESSOA.forEach((nomeRotulo, j) => {
      const quantas = 40 + j * 20;
      for (let k = 0; k < quantas; k++) {
        MENSAGENS.push({ id: `m-rot${j}-${k}`, conversa_id: conv(k), origem: "advogado",
          tipo: "texto", texto: `Importada ${k + 1}`, enviado_por: nomeRotulo, enviado_por_id: null,
          criado_em: new Date(Date.now() - (k % 3) * dia).toISOString() });
      }
      ESPERADO.porRotulo[nomeRotulo] = quantas;
      deRotulo += quantas;
    });
  }
  ESPERADO.porTelefone[adv.id].enviadas += deRotulo;
  ESPERADO.porTelefoneNome[adv.nome].enviadas += deRotulo;
  ESPERADO.rotulos7 += deRotulo;
  ESPERADO.enviadas7 += env + aparelho + deRotulo;
  ESPERADO.enviadasTudo += env + aparelho + deRotulo;

  // NOTA INTERNA MORA EM `notas`. Nunca houve linha de nota em `mensagens`;
  // procurar `origem = 'nota'` lá dava zero e o cartão mentia com cara de certo.
  for (let k = 0; k < notas; k++) {
    NOTAS.push({ id: `n-${adv.id}-${k}`, conversa_id: conv(k), texto: `Nota ${k + 1}`,
      autor: "Rodrigo Alves", criado_em: new Date(Date.now() - k * dia).toISOString() });
  }
  ESPERADO.notas7 += notas;
});

// Um lote VELHO, só no primeiro telefone: é o que faz "7 dias" e "Tudo" darem
// respostas diferentes. Sem ele, o filtro de período passaria no teste mesmo
// se não filtrasse nada.
const VELHAS = 200;
for (let k = 0; k < VELHAS; k++) {
  MENSAGENS.push({ id: `m-velha-${k}`, conversa_id: CONVERSAS[0].id, origem: "contato",
    tipo: "texto", texto: `Antiga ${k + 1}`, enviado_por: null, enviado_por_id: null,
    criado_em: new Date(Date.now() - 100 * dia).toISOString() });
}
ESPERADO.recebidasTudo += VELHAS;
ESPERADO.totalDeLinhas = MENSAGENS.length;

// O teste lê daqui. É o que a BANCADA contém, contado na hora de montar; a
// tela conta por outro caminho. Se os dois baterem, a tela está certa; se eu
// escrevesse os números à mão no teste, estaria conferindo a minha aritmética.
if (typeof globalThis !== "undefined") {
  globalThis.__ESPERADO = ESPERADO;
  // Liga e desliga a função `painel_numeros` da bancada. Ligada por padrão; o
  // teste desliga para conferir o que a tela mostra num banco onde o SQL ainda
  // não foi rodado — que é um estado real, não hipotético.
  if (globalThis.__TEM_FUNCAO_PAINEL === undefined) globalThis.__TEM_FUNCAO_PAINEL = true;
}

// O CASO DO APELIDO DO WHATSAPP.
//
// O contato mandou mensagem e o WhatsApp devolveu o nome que ELE escreveu no
// aparelho — "Deus". Depois alguém preencheu a ficha no Vantoro com o nome de
// verdade, e o cabeçalho da conversa continuou mostrando o apelido.
//
// `vantoro_nome` começa NULO de propósito: é esse estado que a tela precisa
// consertar. Começando preenchido, o teste passaria sem que nada funcionasse.
const APELIDO = {
  id: "ct-apelido",
  nome: "Deus",
  numero: "5567992183107",
  vantoro_nome: null,
  vantoro_cliente_id: null,
  foto_url: null,
};
// O nome que está no cadastro do Vantoro, e que o teste espera ver no
// cabeçalho depois de abrir a ficha.
export const NOME_NO_VANTORO = "ANDREIA CRISTINA MARTINS";

// Entra como uma conversa NOVA, e não por cima de uma existente. Reaproveitar
// uma conversa que já estava ali mudaria o que os outros testes da bancada
// encontram — e um teste que quebra por causa do vizinho não diz nada sobre o
// que ele deveria estar medindo.
//
// No telefone que o painel ABRE: ele pede os telefones com `.order("nome")` e
// abre o primeiro, que por ordem alfabética é "Acordos 1" e não o primeiro do
// array. Preso ao índice 0, o contato de prova nascia numa conversa que a tela
// não mostrava.
//
// `nao_lidas: 0` para não mexer nos contadores que outros testes conferem.
const PRIMEIRO_TELEFONE = ADVOGADOS.slice()
  .sort((a, b) => a.nome.localeCompare(b.nome))[0];
CONVERSAS.push({
  id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  advogado_id: PRIMEIRO_TELEFONE.id,
  contato_id: APELIDO.id,
  nao_lidas: 0,
  arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date().toISOString(),
  ultima_mensagem: "Boa tarde, tudo bem?",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { ...APELIDO },
});

// UMA NOTA NA CONVERSA DE PROVA, escrita pelo próprio usuário logado — é dele
// a permissão de editar e apagar. `apagada_em` nula: é o estado que a tela
// precisa saber mudar.
NOTAS.push({
  id: "nota-de-prova",
  conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  texto: "Cliente pediu para ligar depois das 18h",
  autor: "Rodrigo Sousa",
  autor_id: "u1",
  autor_foto: null,
  editada_em: null, editada_por: null,
  apagada_em: null, apagada_por: null, apagada_por_id: null,
  criado_em: new Date(Date.now() - 3600e3).toISOString(),
});

const TABELAS = {
  advogados: ADVOGADOS,
  departamentos: DEPARTAMENTOS,
  conversas: CONVERSAS,
  // O NOME AQUI É O DO VANTORO — e é de propósito que ele seja DIFERENTE do
  // que está no `user_metadata` logo abaixo. É a situação real de quem entrou
  // antes de o Vantoro ter o nome completo: o cadastro já diz "Rodrigo Sousa",
  // e a conta do Supabase ficou parada em "rodrigo". A tela tem de mostrar o
  // do cadastro.
  usuarios: [{ id: "u1", admin: true, nome: "Rodrigo Sousa" }],
  permissoes: [],            // vazio + admin = alcança tudo
  mensagens: MENSAGENS, contatos: [{ ...APELIDO }], notas: NOTAS, tags: [], conversa_tags: [],
  // O histórico de alterações começa VAZIO: as linhas nascem do que se faz na
  // tela, e semear alguma aqui esconderia uma tela que não grava nada.
  alteracoes: [],
  mensagens_rapidas: [], figurinhas_favoritas: [], fila_envio: [],
};

// O teste lê a tabela de contatos daqui para conferir o que foi GRAVADO, e não
// só o que apareceu na tela. Uma tela que mostra o nome certo sem ter gravado
// nada volta ao apelido no próximo carregamento.
if (typeof globalThis !== "undefined") globalThis.__TABELAS = TABELAS;

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
  let inicio = 0, corte = Infinity, patch = null;
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
    // `order`, `limit` e `range` PRECISAM valer, agora que a bancada tem
    // milhares de linhas: são eles que a paginação usa para sair do teto.
    order(col, opc) {
      const cres = !(opc && opc.ascending === false);
      linhas = linhas.slice().sort((a, b) => (cres ? 1 : -1) * comparar(a[col], b[col]));
      return eu;
    },
    limit(n) { corte = Math.min(corte, n); return eu; },
    range(de, ate) { inicio = de; corte = ate - de + 1; return eu; },
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
    // GRAVA SÓ NO FIM, e não no instante da chamada. O painel escreve
    // `update(campos).eq("numero", n)` — o filtro vem DEPOIS do update, e o
    // Supabase de verdade aplica os dois juntos. Aplicando na hora, a bancada
    // gravava em TODAS as linhas e depois filtrava, o que faria um teste passar
    // mesmo se o painel esquecesse o filtro e reescrevesse o cadastro inteiro.
    update(reg) { patch = { ...(patch || {}), ...reg }; return eu; },
    delete() { return eu; },
    async then(resolver) {
      if (tabela === "conversas") await espera(ATRASO_CONVERSAS);
      if (patch) linhas.forEach((l) => Object.assign(l, patch));
      // O "join" com contatos, refeito na hora. No Supabase a lista de
      // conversas traz o contato por junção, então uma gravação em `contatos`
      // aparece na consulta seguinte. Aqui o contato era uma CÓPIA presa à
      // conversa, e a lista continuava mostrando o nome velho depois de o
      // cadastro ter sido gravado — a bancada mentia a favor do defeito.
      if (tabela === "conversas") {
        for (const l of linhas) {
          if (!l.contato || !l.contato.numero) continue;
          const atual = (TABELAS.contatos || []).find((c) => c.numero === l.contato.numero);
          if (atual) l.contato = { ...l.contato, ...atual };
        }
      }
      // O teto entra AQUI, no fim, igual à API de verdade: depois de filtrar e
      // ordenar, e sem avisar ninguém de que sobrou coisa para trás.
      const fatia = linhas.slice(inicio, inicio + Math.min(corte, LIMITE_LINHAS));
      return resolver({ data: fatia, error: null });
    },
  };
  return eu;
}

export const supabase = {
  from: (t) => consulta(t),
  // A função `painel_numeros`, de mentira. Faz o que a de verdade faz — e,
  // principalmente, faz A CONTA INTEIRA: não passa pelo teto de linhas, porque
  // a de verdade também não passa. É o ponto todo da correção.
  //
  // Quem chamar uma função que não existe recebe o mesmo erro que o Supabase
  // devolve (PGRST202), para o caminho de "falta rodar o SQL" também ser
  // testável em vez de imaginado.
  rpc: async (nome, args) => {
    if (nome !== "painel_numeros") {
      return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${nome}` } };
    }
    if (!globalThis.__TEM_FUNCAO_PAINEL) {
      return { data: null, error: { code: "PGRST202", message: "Could not find the function public.painel_numeros" } };
    }
    const desde = args && args.p_desde ? String(args.p_desde) : null;
    const dentro = (t) => !desde || String(t) >= desde;
    const telDaConversa = new Map(CONVERSAS.map((c) => [String(c.id), String(c.advogado_id)]));

    // O de-para da bancada: os mesmos dois papéis da tabela de verdade —
    // "isto não é pessoa" e "este nome antigo é fulano".
    const naoPessoa = new Set(ROTULOS_NAO_PESSOA.map((r) => r.toLowerCase()));
    // E o reconhecimento pelo CADASTRO, que é o que junta "rodrigo" com
    // "Rodrigo Sousa" sem precisar de de-para nenhum.
    const idPeloNome = new Map(TABELAS.usuarios
      .filter((u) => (u.nome || "").trim())
      .map((u) => [u.nome.trim().toLowerCase(), u.id]));

    let recebidas = 0, enviadas = 0, outras = 0, aparelho = 0, semId = 0;
    const porTel = new Map(), porPessoa = new Map(), porRotulo = new Map();
    for (const m of MENSAGENS) {
      if (!dentro(m.criado_em)) continue;
      const ehEnv = m.origem === "advogado", ehRec = m.origem === "contato";
      if (ehEnv) enviadas++; else if (ehRec) recebidas++; else { outras++; continue; }

      const tel = telDaConversa.get(String(m.conversa_id));
      if (tel) {
        const r = porTel.get(tel) || { advogado_id: tel, recebidas: 0, enviadas: 0 };
        r[ehEnv ? "enviadas" : "recebidas"]++;
        porTel.set(tel, r);
      }
      if (!ehEnv) continue;

      const quem = (m.enviado_por || "").trim();
      if (quem === "WhatsApp") { aparelho++; continue; }
      if (!m.enviado_por_id && naoPessoa.has(quem.toLowerCase())) {
        porRotulo.set(quem, (porRotulo.get(quem) || 0) + 1);
        continue;
      }
      const id = m.enviado_por_id || idPeloNome.get(quem.toLowerCase()) || null;
      if (!id) semId++;
      const chave = id ? `id:${id}` : `nome:${quem || "(sem nome)"}`;
      const r = porPessoa.get(chave) || { chave, enviado_por_id: id, nome: quem || "(sem nome)", enviadas: 0 };
      r.enviadas++;
      if (quem) r.nome = quem;
      porPessoa.set(chave, r);
    }
    const notas = NOTAS.filter((n) => dentro(n.criado_em)).length;
    return { data: { recebidas, enviadas, outras, aparelho, sem_id: semId, notas,
                     por_telefone: [...porTel.values()], por_pessoa: [...porPessoa.values()],
                     por_rotulo: [...porRotulo.entries()].map(([nome, enviadas]) => ({ nome, enviadas })) },
             error: null };
  },
  auth: {
    getSession: async () => ({ data: { session: { access_token: "jwt-de-mentira", user: { id: "u1", email: "rodrigo@ropelimi",
      // O nome VELHO, congelado na criação da conta. Se a tela mostrar este,
      // a correção não funcionou.
      user_metadata: { nome: "rodrigo" } } } } }),
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
