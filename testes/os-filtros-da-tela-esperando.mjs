// OS FILTROS DA TELA "ESPERANDO RESPOSTA" (05/11).
//
// Pedido do Rodrigo: "Na tela de 'Esperando resposta' eu preciso ter um filtro
// de responsável, também filtro de etiquetas, telefones e departamentos."
//
// O que esta prova confere:
//
//   1. a barra dos quatro filtros, acima das abas, e o padrão de sempre: as
//      suas (os clientes sem resposta seus ou de ninguém, e as conversas em
//      que você é o responsável);
//   2. o responsável: uma pessoa, duas, "Sem responsável" e "Todos" — as duas
//      abas, os números delas, o nome da segunda aba e as frases; marcar não
//      fecha o menu; o Esc e o clique fora fecham; quem saiu não é oferecido;
//   3. as etiquetas, com o padrão e com "Todos", e duas etiquetas valendo
//      qualquer uma delas;
//   4. os telefones e os departamentos: o departamento recorta os telefones
//      oferecidos, e trocá-lo tira da escolha os telefones que saíram dele; a
//      lista vazia diz que é o recorte, e "Limpar os filtros" volta ao padrão;
//   5. o recorte vai ao BANCO: com 500 conversas mais antigas no caminho, as
//      da Jenifer, as da etiqueta e as do telefone continuam chegando;
//   6. a leitura das etiquetas que falha é dita nas duas abas, e não vira
//      "nenhum cliente";
//   7. trocar o filtro diz "Procurando…", e não mostra a lista de antes;
//   8. a leitura de minuto em minuto continua com os filtros;
//   9. no celular: a barra quebra em linhas, a tela não rola de lado, e os
//      menus cabem e têm o alvo de dedo.
//
// A tela abre pelo endereço da guia (`?tela=esperando`), e a guia lê as duas
// listas assim que abre. AS CONVERSAS DA BANCADA NASCEM ESPERANDO (as não
// lidas de cada telefone), e a prova tira a espera delas depois de abrir:
// assim as contas são só as das conversas que ela planta.
import { abrirNavegador, ENDERECO, abrirATela } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (x) => { try { return JSON.stringify(x).slice(0, 400); } catch (_) { return String(x); } };
const CENAS = (process.env.CENAS || "").split(",").map((s) => s.trim()).filter(Boolean);
const vale = (cena) => !CENAS.length || CENAS.includes(cena);
const TODAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const nav = await abrirNavegador();
const DIA = 24 * 3600e3;
const JEN = "u-jenifer", ISA = "u-isabela", SAIU = "u-saiu-da-prova";
const URGENTE = "t-urgente", AGUARDANDO = "t-aguardando";
function hash(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

/** Uma conversa que espera há `dias`, com o responsável `resp`. */
const conversa = (id, adv, dias, resp, extra = {}) => ({
  id, advogado_id: adv, contato_id: `${id}-ct`, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date(Date.now() - dias * DIA).toISOString(),
  esperando_desde: new Date(Date.now() - dias * DIA).toISOString(),
  ultima_mensagem: "Preciso de uma resposta", frente: null, vantoro_nome: null, digitando_ate: null,
  responsavel_id: resp, responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null,
  contato: { nome: `CLIENTE ${id.toUpperCase()}`, numero: `5511930${String(Math.abs(hash(id))).padStart(6, "0").slice(0, 6)}`, foto_url: null },
  ...extra,
});
/** Uma linha do que a função dos clientes sem resposta devolveria. */
const semResposta = (conversa_id, advogado_id, resp, minutos) => ({
  conversa_id, advogado_id, departamento_id: 1, protocolo: `P-${conversa_id}`,
  aberto_em: new Date(Date.now() - (minutos + 5) * 60e3).toISOString(),
  responsavel_id: resp, minutos, limite: 30,
  contato: { nome: `CLIENTE ${conversa_id.toUpperCase()}`, numero: "5511977776666" },
});

// Os telefones da bancada: a7 e a8 são de Acordos (5); a3 e a5, do Sucesso do
// Cliente (3); a6, de Audiências (4).
const CONVERSAS = [
  conversa("esp-meu-a7", "a7", 5, "u1"),
  conversa("esp-meu-a5", "a5", 4, "u1"),
  conversa("esp-jen-a5", "a5", 6, JEN),
  conversa("esp-jen-a8", "a8", 3, JEN),
  conversa("esp-isa-a3", "a3", 3, ISA),
  conversa("esp-sem-a6", "a6", 7, null),
  // nunca aparecem: arquivada, e esperando há menos de 2 dias
  conversa("esp-meu-arq", "a7", 9, "u1", { arquivada: true }),
  conversa("esp-meu-hoje", "a7", 0.2, "u1"),
];
const CLIENTES = [
  semResposta("esp-sr-sem-a7", "a7", null, 50),
  semResposta("esp-sr-meu-a5", "a5", "u1", 60),
  semResposta("esp-sr-jen-a5", "a5", JEN, 70),
  semResposta("esp-sr-isa-a3", "a3", ISA, 80),
  semResposta("esp-sr-sem-a6", "a6", null, 90),
];
const ETIQUETAS = [
  ["esp-meu-a7", URGENTE], ["esp-jen-a5", URGENTE], ["esp-sr-sem-a7", URGENTE],
  ["esp-isa-a3", AGUARDANDO], ["esp-sem-a6", AGUARDANDO], ["esp-sr-jen-a5", AGUARDANDO],
].map(([conversa_id, tag_id], i) => ({ id: `esp-tag-${i}`, conversa_id, tag_id }));
// UMA ETIQUETA CUJO ID VEM ANTES DAS OUTRAS e o nome, depois: é ela que
// separa "a primeira na ordem do menu" (pelo nome) de "a primeira pelo id".
// Nas duas da bancada, as duas ordens coincidem.
const ZEBRA = "t-a-zebra";
const MAIS_ETIQUETAS = [{ id: ZEBRA, nome: "Zebra", cor: "#7b61ff" }];
// QUEM SAIU DO ESCRITÓRIO, para conferir que não é oferecido.
const QUEM_SAIU = [{ id: SAIU, admin: false, nome: "PESSOA QUE SAIU DA PROVA", foto_url: null, ativo: false }];

/** Abre a guia da tela com TODAS as bandeiras escritas — `addInitScript` acumula. */
async function abrir(o = {}) {
  const ctx = await nav.newContext({ viewport: o.viewport || { width: 1360, height: 820 },
                                     ...(o.celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const conversas = [...CONVERSAS, ...(o.maisConversas || [])];
  await ctx.addInitScript((d) => {
    globalThis.__DIARIO = [];
    globalThis.__ESPERA_A_CADA_MS = d.aCada;
    globalThis.__SEM_RESPOSTA = d.clientes;
    globalThis.__QUEBRAR = d.quebrar;
    globalThis.__ATRASO_DAS_QUE_ESPERAM = d.atraso;
    globalThis.__SEMENTE = { conversas: d.conversas, conversa_tags: d.etiquetas, usuarios: d.usuarios, tags: d.tags };
    try { localStorage.setItem("zorvin_som_do_aviso", "mudo"); } catch (_) { /* */ }
  }, { aCada: o.aCada || 600000, clientes: CLIENTES, quebrar: o.quebrar || [], atraso: o.atraso || 0,
       conversas, etiquetas: ETIQUETAS, usuarios: QUEM_SAIU, tags: MAIS_ETIQUETAS });
  const abriu = await abrirATela(page, "esperando");
  // A ESPERA DAS CONVERSAS DA BANCADA SAI: as não lidas de cada telefone
  // nascem esperando, e entrariam em "Todos" e em "Sem responsável".
  await page.evaluate(() => {
    for (const c of globalThis.__TABELAS.conversas || []) if (!String(c.id).startsWith("esp-")) c.esperando_desde = null;
  }).catch(() => {});
  await clicar(page, "[data-atualizar-espera]");
  return { ctx, page, estouros, abriu };
}

const contar = (page, sel) => page.locator(sel).count().catch(() => 0);
const texto = async (page, sel) => ((await contar(page, sel)) ? (await page.locator(sel).first().innerText()).replace(/\s+/g, " ").trim() : "");
const attr = async (page, sel, nome) => ((await contar(page, sel)) ? page.locator(sel).first().getAttribute(nome) : null);
async function esperar(page, sel, ms = 6000) {
  try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch (_) { return false; }
}
/** CLIQUE GUARDADO: o que não existe não estoura a prova inteira. */
async function clicar(page, sel) {
  if (!(await contar(page, sel))) return false;
  try { await page.locator(sel).first().click({ timeout: 3000 }); return true; } catch (_) { return false; }
}
const abas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-aba-da-espera]")].map((b) => {
  const nome = b.querySelector("[data-nome-da-aba-da-espera]");
  const n = b.querySelector("[data-contagem-da-espera]");
  return { id: b.getAttribute("data-aba-da-espera"), nome: nome ? nome.innerText.replace(/\s+/g, " ").trim() : "",
           n: n ? n.getAttribute("data-contagem-da-espera") : null, falhou: Boolean(b.querySelector("[data-aba-da-espera-falhou]")) };
})).catch(() => []);
/** Espera os números das abas chegarem a estes (`null` é "sem número"). */
async function esperarContagens(page, esperadas, ms = 8000) {
  let ultima = null;
  for (let t = 0; t < ms; t += 150) {
    ultima = (await abas(page)).map((a) => a.n);
    if (JSON.stringify(ultima) === JSON.stringify(esperadas.map((x) => (x == null ? null : String(x))))) return true;
    await page.waitForTimeout(150);
  }
  console.log(`      (as abas dizem ${q(ultima)})`);
  return false;
}
/** As linhas de uma aba, pelo id da conversa — clicando na aba antes. */
async function linhas(page, aba) {
  await clicar(page, `[data-aba-da-espera="${aba}"]`);
  await page.waitForTimeout(150);
  const marca = aba === "sem-resposta" ? "data-sem-resposta-linha" : "data-atrasada-linha";
  return page.evaluate((m) => [...document.querySelectorAll(`[${m}]`)].map((l) => l.getAttribute(m)).sort(), marca).catch(() => []);
}
const iguais = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const menuAberto = (page, filtro) => contar(page, `[data-menu-do-filtro="${filtro}"]`);
/** Escolhe opções num filtro, e fecha o menu com o Esc. */
async function escolher(page, filtro, opcoes) {
  if (!(await menuAberto(page, filtro))) await clicar(page, `[data-filtro-da-espera="${filtro}"]`);
  for (const op of opcoes) await clicar(page, `[data-menu-do-filtro="${filtro}"] [data-opcao-do-filtro="${op}"]`);
  if (await menuAberto(page, filtro)) await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(120);
}
const rotulo = (page, filtro) => texto(page, `[data-filtro-da-espera="${filtro}"] [data-rotulo-do-filtro]`);
const ativo = (page, filtro) => attr(page, `[data-filtro-da-espera="${filtro}"]`, "data-filtro-ativo");
const limpar = (page) => clicar(page, "[data-limpar-filtros-da-espera]");
const nota = (page, aba) => texto(page, `[data-secao-da-espera="${aba}"] > div:first-child`);

// ------------------------------------------------------------------
if (vale("1")) {
  console.log("\n1. A barra dos filtros, acima das abas, e o padrão de sempre: as suas");
  const { ctx, page, estouros, abriu } = await abrir();
  ok("a tela abriu", abriu);
  ok("as abas contam o de sempre: 3 clientes (os seus e os sem responsável) e 2 conversas suas",
     await esperarContagens(page, [3, 2]));
  ok("a barra dos filtros está na tela", (await contar(page, "[data-filtros-da-espera]")) === 1);
  const pos = await page.evaluate(() => {
    const barra = document.querySelector("[data-filtros-da-espera]");
    const abas = document.querySelector("[data-abas-da-espera]");
    return barra && abas ? { barra: barra.getBoundingClientRect().bottom, abas: abas.getBoundingClientRect().top } : null;
  });
  ok("e fica acima das abas (ela recorta as duas)", pos && pos.barra <= pos.abas + 1, q(pos));
  const pilulas = await page.evaluate(() => [...document.querySelectorAll("[data-filtro-da-espera]")].map((b) => b.getAttribute("data-filtro-da-espera")));
  ok("são quatro filtros: responsável, etiquetas, telefones e departamentos",
     iguais(pilulas, ["responsavel", "etiquetas", "telefones", "departamentos"]), q(pilulas));
  ok("o responsável diz “As suas”, e não um rótulo neutro", (await rotulo(page, "responsavel")) === "Responsável: As suas",
     await rotulo(page, "responsavel"));
  ok("no padrão, nenhuma pílula está marcada como recortando",
     (await contar(page, "[data-filtro-ativo]")) === 0);
  ok("e não há “Limpar os filtros”", (await contar(page, "[data-limpar-filtros-da-espera]")) === 0);
  ok("os clientes: os seus e os sem responsável", iguais(await linhas(page, "sem-resposta"), ["esp-sr-sem-a7", "esp-sr-meu-a5", "esp-sr-sem-a6"]),
     q(await linhas(page, "sem-resposta")));
  ok("as conversas: as suas, sem a arquivada e sem a de hoje", iguais(await linhas(page, "atrasadas"), ["esp-meu-a7", "esp-meu-a5"]),
     q(await linhas(page, "atrasadas")));
  ok("a segunda aba continua “SUAS CONVERSAS…”", (await abas(page))[1]?.nome === "SUAS CONVERSAS ESPERANDO HÁ 2 DIAS OU MAIS",
     (await abas(page))[1]?.nome);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("2")) {
  console.log("\n2. O responsável: uma pessoa, duas, sem responsável e todos");
  const { ctx, page, estouros } = await abrir();
  await esperarContagens(page, [3, 2]);
  ok("o menu do responsável abre", await clicar(page, '[data-filtro-da-espera="responsavel"]') && (await menuAberto(page, "responsavel")) === 1);
  const opcoes = await page.evaluate(() => [...document.querySelectorAll('[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro]')]
    .map((b) => b.getAttribute("data-opcao-do-filtro")));
  ok("oferece “As suas”, “Todos”, “Sem responsável”, você primeiro e a equipe",
     opcoes[0] === "suas" && opcoes[1] === "todos" && opcoes[2] === "sem" && opcoes[3] === "u1" && opcoes.includes(JEN) && opcoes.includes(ISA), q(opcoes));
  ok("quem saiu do escritório não é oferecido", !opcoes.includes(SAIU), q(opcoes));
  await clicar(page, `[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro="${JEN}"]`);
  ok("marcar uma pessoa não fecha o menu (escolher várias é o comum)", (await menuAberto(page, "responsavel")) === 1);
  await page.keyboard.press("Escape");
  ok("o Esc fecha o menu", await page.waitForFunction(() => !document.querySelector('[data-menu-do-filtro="responsavel"]'), null, { timeout: 2000 }).then(() => true).catch(() => false));
  ok("a pílula diz a Jenifer, e fica marcada", /JENIFER/i.test(await rotulo(page, "responsavel")) && (await ativo(page, "responsavel")) === "sim",
     await rotulo(page, "responsavel"));
  ok("as abas contam as da Jenifer: 1 cliente e 2 conversas", await esperarContagens(page, [1, 2]));
  ok("os clientes: só o da Jenifer", iguais(await linhas(page, "sem-resposta"), ["esp-sr-jen-a5"]), q(await linhas(page, "sem-resposta")));
  ok("a frase dos clientes diz que mostra os da Jenifer", /Mostrando só os clientes em que o responsável é JENIFER/i.test(await nota(page, "sem-resposta")),
     await nota(page, "sem-resposta"));
  ok("as conversas: as duas da Jenifer, de dois telefones", iguais(await linhas(page, "atrasadas"), ["esp-jen-a5", "esp-jen-a8"]),
     q(await linhas(page, "atrasadas")));
  ok("a segunda aba deixa de dizer “SUAS”", (await abas(page))[1]?.nome === "CONVERSAS ESPERANDO HÁ 2 DIAS OU MAIS", (await abas(page))[1]?.nome);
  ok("a frase das conversas diz de quem são", /^As conversas em que o responsável é JENIFER e o cliente espera resposta há 2 dias ou mais\.$/i.test(await nota(page, "atrasadas")),
     await nota(page, "atrasadas"));
  ok("e cada linha diz com quem está", /com JENIFER/i.test(await texto(page, '[data-atrasada-linha="esp-jen-a8"]')),
     await texto(page, '[data-atrasada-linha="esp-jen-a8"]'));
  // DUAS PESSOAS
  await escolher(page, "responsavel", [ISA]);
  ok("com a Isabela também, 2 clientes e 3 conversas", await esperarContagens(page, [2, 3]));
  ok("a pílula diz quantas mais", /\+1$/.test(await rotulo(page, "responsavel")), await rotulo(page, "responsavel"));
  ok("as conversas das duas", iguais(await linhas(page, "atrasadas"), ["esp-jen-a5", "esp-jen-a8", "esp-isa-a3"]), q(await linhas(page, "atrasadas")));
  // DESMARCAR AS DUAS VOLTA AO PADRÃO
  await escolher(page, "responsavel", [JEN, ISA]);
  ok("desmarcadas as duas, volta ao padrão: “As suas”, 3 e 2", (await rotulo(page, "responsavel")) === "Responsável: As suas"
     && await esperarContagens(page, [3, 2]), await rotulo(page, "responsavel"));
  // SEM RESPONSÁVEL
  await escolher(page, "responsavel", ["sem"]);
  ok("sem responsável: 2 clientes e 1 conversa", await esperarContagens(page, [2, 1]));
  ok("os clientes sem responsável", iguais(await linhas(page, "sem-resposta"), ["esp-sr-sem-a7", "esp-sr-sem-a6"]), q(await linhas(page, "sem-resposta")));
  ok("a conversa sem responsável, dizendo isso", iguais(await linhas(page, "atrasadas"), ["esp-sem-a6"])
     && /sem responsável/.test(await texto(page, '[data-atrasada-linha="esp-sem-a6"]')), await texto(page, '[data-atrasada-linha="esp-sem-a6"]'));
  ok("a frase das conversas sem responsável", /^As conversas sem responsável em que o cliente espera resposta há 2 dias ou mais\.$/.test(await nota(page, "atrasadas")),
     await nota(page, "atrasadas"));
  // TODOS
  await clicar(page, '[data-filtro-da-espera="responsavel"]');
  await clicar(page, '[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro="todos"]');
  ok("“Todos os responsáveis” fecha o menu", (await menuAberto(page, "responsavel")) === 0);
  ok("todos: 5 clientes e 6 conversas", await esperarContagens(page, [5, 6]));
  ok("a pílula diz “Todos”", (await rotulo(page, "responsavel")) === "Responsável: Todos", await rotulo(page, "responsavel"));
  ok("as seis conversas, sem a arquivada e sem a de hoje",
     iguais(await linhas(page, "atrasadas"), ["esp-meu-a7", "esp-meu-a5", "esp-jen-a5", "esp-jen-a8", "esp-isa-a3", "esp-sem-a6"]), q(await linhas(page, "atrasadas")));
  ok("e “com você” nas suas", /com você/.test(await texto(page, '[data-atrasada-linha="esp-meu-a7"]')), await texto(page, '[data-atrasada-linha="esp-meu-a7"]'));
  // O CLIQUE FORA FECHA
  await clicar(page, '[data-filtro-da-espera="responsavel"]');
  await page.mouse.click(30, 700);
  ok("o clique fora fecha o menu", (await menuAberto(page, "responsavel")) === 0);
  // "AS SUAS" VOLTA AO PADRÃO
  await clicar(page, '[data-filtro-da-espera="responsavel"]');
  await clicar(page, '[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro="suas"]');
  ok("“As suas” volta ao padrão", (await rotulo(page, "responsavel")) === "Responsável: As suas" && await esperarContagens(page, [3, 2]));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("3")) {
  console.log("\n3. As etiquetas: no padrão, com todos, e duas valendo qualquer uma");
  const { ctx, page, estouros } = await abrir();
  await esperarContagens(page, [3, 2]);
  await escolher(page, "etiquetas", [URGENTE]);
  ok("a pílula diz a etiqueta, e fica marcada", (await rotulo(page, "etiquetas")) === "Urgente" && (await ativo(page, "etiquetas")) === "sim",
     await rotulo(page, "etiquetas"));
  ok("as suas com Urgente: 1 cliente e 1 conversa", await esperarContagens(page, [1, 1]));
  ok("o cliente sem responsável com a etiqueta", iguais(await linhas(page, "sem-resposta"), ["esp-sr-sem-a7"]), q(await linhas(page, "sem-resposta")));
  ok("a sua conversa com a etiqueta", iguais(await linhas(page, "atrasadas"), ["esp-meu-a7"]), q(await linhas(page, "atrasadas")));
  await clicar(page, '[data-filtro-da-espera="responsavel"]');
  await clicar(page, '[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro="todos"]');
  ok("todos com Urgente: 1 cliente e 2 conversas", await esperarContagens(page, [1, 2]));
  ok("as duas conversas com Urgente", iguais(await linhas(page, "atrasadas"), ["esp-meu-a7", "esp-jen-a5"]), q(await linhas(page, "atrasadas")));
  await escolher(page, "etiquetas", [AGUARDANDO]);
  ok("com Aguardando também, valendo qualquer uma: 2 clientes e 4 conversas", await esperarContagens(page, [2, 4]));
  ok("as quatro conversas de uma ou de outra",
     iguais(await linhas(page, "atrasadas"), ["esp-meu-a7", "esp-jen-a5", "esp-isa-a3", "esp-sem-a6"]), q(await linhas(page, "atrasadas")));
  // A PRIMEIRA NA ORDEM DO MENU (as etiquetas vêm pelo nome), e não a do
  // clique: a Urgente foi escolhida antes, e a pílula começa pela Aguardando.
  ok("a pílula diz a primeira na ordem do menu, e quantas mais", (await rotulo(page, "etiquetas")) === "Aguardando cliente +1",
     await rotulo(page, "etiquetas"));
  // A Zebra tem o id que vem primeiro, e o nome que vem por último.
  await escolher(page, "etiquetas", [ZEBRA]);
  ok("e não a primeira pelo id: com a Zebra, continua começando pela Aguardando", (await rotulo(page, "etiquetas")) === "Aguardando cliente +2",
     await rotulo(page, "etiquetas"));
  ok("a Zebra não tem conversa, e as contas continuam", await esperarContagens(page, [2, 4]));
  ok("o “Limpar os filtros” aparece", (await contar(page, "[data-limpar-filtros-da-espera]")) === 1);
  ok("e limpa: volta ao padrão", await limpar(page) && await esperarContagens(page, [3, 2])
     && (await rotulo(page, "etiquetas")) === "Etiquetas" && (await rotulo(page, "responsavel")) === "Responsável: As suas");
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("4")) {
  console.log("\n4. Os telefones e os departamentos, e a lista vazia do recorte");
  const { ctx, page, estouros } = await abrir();
  await esperarContagens(page, [3, 2]);
  await clicar(page, '[data-filtro-da-espera="responsavel"]');
  await clicar(page, '[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro="todos"]');
  await esperarContagens(page, [5, 6]);
  await escolher(page, "telefones", ["a5"]);
  ok("o telefone SAC: 2 clientes e 2 conversas", await esperarContagens(page, [2, 2]));
  ok("as conversas do SAC", iguais(await linhas(page, "atrasadas"), ["esp-meu-a5", "esp-jen-a5"]), q(await linhas(page, "atrasadas")));
  ok("a pílula diz o telefone", (await rotulo(page, "telefones")) === "SAC", await rotulo(page, "telefones"));
  await escolher(page, "telefones", ["a5"]);
  // O DEPARTAMENTO
  await escolher(page, "departamentos", ["5"]);
  ok("o departamento Acordos: 1 cliente e 2 conversas", await esperarContagens(page, [1, 2]));
  ok("as conversas dos telefones de Acordos", iguais(await linhas(page, "atrasadas"), ["esp-meu-a7", "esp-jen-a8"]), q(await linhas(page, "atrasadas")));
  await clicar(page, '[data-filtro-da-espera="telefones"]');
  const oferecidos = await page.evaluate(() => [...document.querySelectorAll('[data-menu-do-filtro="telefones"] [data-opcao-do-filtro]')]
    .map((b) => b.getAttribute("data-opcao-do-filtro")).sort());
  // Na bancada, o telefone "Arquivo" (a13) também é de Acordos.
  ok("com o departamento escolhido, os telefones oferecidos são só os dele", iguais(oferecidos, ["a13", "a7", "a8"]), q(oferecidos));
  await escolher(page, "telefones", ["a8"]);
  ok("o telefone Acordos 2: nenhum cliente e 1 conversa", await esperarContagens(page, [0, 1]));
  await clicar(page, '[data-aba-da-espera="sem-resposta"]');
  ok("a lista vazia diz que é o recorte, e oferece desfazê-lo",
     /com estes filtros/.test(await texto(page, "[data-espera-vazia-com-filtros]")) && (await contar(page, "[data-limpar-filtros-da-lista-vazia]")) === 1,
     await texto(page, "[data-espera-vazia-com-filtros]"));
  // TROCAR O DEPARTAMENTO TIRA DA ESCOLHA O TELEFONE QUE SAIU DELE
  await escolher(page, "departamentos", ["5", "3"]);
  ok("trocado o departamento, o telefone de Acordos sai da escolha", (await rotulo(page, "telefones")) === "Telefones"
     && (await ativo(page, "telefones")) === null, await rotulo(page, "telefones"));
  ok("e o recorte é o do Sucesso do Cliente: 3 clientes e 3 conversas", await esperarContagens(page, [3, 3]));
  ok("as conversas dos telefones do Sucesso do Cliente", iguais(await linhas(page, "atrasadas"), ["esp-meu-a5", "esp-jen-a5", "esp-isa-a3"]),
     q(await linhas(page, "atrasadas")));
  // "LIMPAR OS FILTROS" NA LISTA VAZIA
  await escolher(page, "telefones", ["a4"]);
  await esperarContagens(page, [0, 0]);
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  ok("a lista vazia das conversas também diz que é o recorte", /com estes filtros/.test(await texto(page, "[data-espera-vazia-com-filtros]")),
     await texto(page, "[data-espera-vazia-com-filtros]"));
  await clicar(page, "[data-limpar-filtros-da-lista-vazia]");
  ok("e o “Limpar os filtros” dela volta ao padrão", await esperarContagens(page, [3, 2]) && (await contar(page, "[data-filtro-ativo]")) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("5")) {
  console.log("\n5. O recorte vai ao banco: 500 conversas mais antigas no caminho não escondem nada");
  // 500 conversas sem responsável, no telefone a1, esperando há mais tempo
  // que todas as outras: sem o recorte no banco, a leitura (que tem teto de
  // 500, as que esperam há mais tempo) só traria estas.
  const muitas = Array.from({ length: 500 }, (_, i) => conversa(`esp-velha-${String(i).padStart(3, "0")}`, "a1", 30 + i / 100, null));
  const { ctx, page, estouros } = await abrir({ maisConversas: muitas });
  ok("as suas chegam, com as 500 no caminho: 3 clientes e 2 conversas", await esperarContagens(page, [3, 2], 15000));
  await escolher(page, "responsavel", [JEN]);
  ok("as da Jenifer chegam: 1 cliente e 2 conversas", await esperarContagens(page, [1, 2], 15000));
  await escolher(page, "responsavel", [JEN]);
  await clicar(page, '[data-filtro-da-espera="responsavel"]');
  await clicar(page, '[data-menu-do-filtro="responsavel"] [data-opcao-do-filtro="todos"]');
  await escolher(page, "etiquetas", [URGENTE]);
  ok("as da etiqueta chegam: 1 cliente e 2 conversas", await esperarContagens(page, [1, 2], 15000));
  ok("as duas com Urgente", iguais(await linhas(page, "atrasadas"), ["esp-meu-a7", "esp-jen-a5"]), q(await linhas(page, "atrasadas")));
  await escolher(page, "etiquetas", [URGENTE]);
  await escolher(page, "telefones", ["a5"]);
  ok("as do telefone chegam: 2 clientes e 2 conversas", await esperarContagens(page, [2, 2], 15000));
  await escolher(page, "telefones", ["a5"]);
  ok("e todos, sem outro filtro, diz que mostra as que esperam há mais tempo", await esperar(page, '[data-secao-da-espera="atrasadas"]', 3000) || true);
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  await page.waitForFunction(() => /Mostrando as \d+ que esperam há mais tempo/.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
  ok("o corte é dito", /Mostrando as 500 que esperam há mais tempo/.test(await page.evaluate(() => document.body.innerText)));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("6")) {
  console.log("\n6. A leitura das etiquetas que falha é dita nas duas abas");
  const { ctx, page, estouros } = await abrir({ quebrar: ["conversa_tags"] });
  await esperarContagens(page, [3, 2]);
  await escolher(page, "etiquetas", [URGENTE]);
  ok("as duas abas dizem que não carregaram, e não contam zero",
     await page.waitForFunction(() => document.querySelectorAll("[data-aba-da-espera-falhou]").length === 2, null, { timeout: 8000 }).then(() => true).catch(() => false),
     q(await abas(page)));
  await clicar(page, '[data-aba-da-espera="sem-resposta"]');
  ok("a aba dos clientes diz por quê, com a frase das etiquetas",
     /Não consegui ler as conversas com as etiquetas escolhidas/.test(await texto(page, "[data-espera-falhou-etiquetas]")),
     await texto(page, "[data-espera-falhou-etiquetas]"));
  ok("e nunca “nenhum cliente”", (await contar(page, "[data-espera-vazia-com-filtros]")) === 0);
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  ok("a das conversas também", /Não consegui ler as conversas com as etiquetas escolhidas/.test(await texto(page, "[data-espera-falhou-atrasadas]")),
     await texto(page, "[data-espera-falhou-atrasadas]"));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("7")) {
  console.log("\n7. Trocar o filtro diz “Procurando…”, e não mostra a lista de antes");
  const { ctx, page, estouros } = await abrir({ atraso: 2500 });
  await esperarContagens(page, [3, 2], 12000);
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  await escolher(page, "responsavel", [JEN]);
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  const logo = { linhas: await page.evaluate(() => [...document.querySelectorAll("[data-atrasada-linha]")].map((l) => l.getAttribute("data-atrasada-linha"))),
                 abas: await abas(page), procurando: /Procurando…/.test(await texto(page, '[data-secao-da-espera="atrasadas"]')) };
  ok("logo depois de escolher, a aba diz “Procurando…”", logo.procurando, q(logo));
  ok("sem as suas conversas de antes", logo.linhas.length === 0, q(logo.linhas));
  ok("e sem número na aba", logo.abas[1] && logo.abas[1].n === null, q(logo.abas));
  ok("a resposta chega com as da Jenifer", await esperarContagens(page, [1, 2], 8000)
     && iguais(await linhas(page, "atrasadas"), ["esp-jen-a5", "esp-jen-a8"]));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("8")) {
  console.log("\n8. A leitura de minuto em minuto continua com os filtros");
  const { ctx, page, estouros } = await abrir({ aCada: 1200 });
  await esperarContagens(page, [3, 2]);
  await escolher(page, "responsavel", [JEN]);
  await esperarContagens(page, [1, 2]);
  const antes = await page.evaluate(() => (globalThis.__DIARIO || []).filter((m) => m.tabela === "conversas").length);
  await page.waitForTimeout(3000);
  const depois = await page.evaluate(() => (globalThis.__DIARIO || []).filter((m) => m.tabela === "conversas").length);
  ok("a tela releu sozinha", depois > antes, `${antes} → ${depois}`);
  ok("e continua com as da Jenifer", (await abas(page)).map((a) => a.n).join(",") === "1,2"
     && iguais(await linhas(page, "atrasadas"), ["esp-jen-a5", "esp-jen-a8"]), q(await abas(page)));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
if (vale("9")) {
  console.log("\n9. No celular: a barra quebra em linhas, e os menus cabem");
  for (const largura of [360, 390]) {
    const { ctx, page, estouros } = await abrir({ viewport: { width: largura, height: 780 }, celular: true });
    await esperarContagens(page, [3, 2]);
    const medida = await page.evaluate(() => {
      const barra = document.querySelector("[data-filtros-da-espera]");
      const ps = [...document.querySelectorAll("[data-filtro-da-espera]")].map((b) => b.getBoundingClientRect());
      return { rolaDeLado: document.documentElement.scrollWidth > window.innerWidth + 1,
               barra: barra ? barra.getBoundingClientRect().right : 0, janela: window.innerWidth,
               dentro: ps.every((r) => r.left >= 0 && r.right <= window.innerWidth + 0.5), alturas: ps.map((r) => Math.round(r.height)),
               linhas: new Set(ps.map((r) => Math.round(r.top))).size,
               // O RÓTULO CORTADO: numa linha só, as pílulas encolhem e o texto
               // vira reticências ("Responsável: As s…") sem rolar nada.
               cortados: [...document.querySelectorAll("[data-rotulo-do-filtro]")]
                 .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent) };
    });
    ok(`a ${largura}: a tela não rola de lado`, !medida.rolaDeLado, q(medida));
    ok(`a ${largura}: as quatro pílulas inteiras dentro da tela, em mais de uma linha`, medida.dentro && medida.linhas >= 2, q(medida));
    ok(`a ${largura}: com o alvo de dedo (40)`, medida.alturas.length === 4 && medida.alturas.every((h) => h >= 40), q(medida.alturas));
    ok(`a ${largura}: nenhum rótulo cortado`, medida.alturas.length === 4 && medida.cortados.length === 0, q(medida.cortados));
    await clicar(page, '[data-filtro-da-espera="departamentos"]');
    const menu = await page.evaluate(() => {
      const m = document.querySelector('[data-menu-do-filtro="departamentos"]');
      if (!m) return null;
      const r = m.getBoundingClientRect();
      const op = m.querySelector("[data-opcao-do-filtro]");
      const ro = op ? op.getBoundingClientRect() : null;
      const alvo = ro ? document.elementFromPoint(ro.left + ro.width / 2, ro.top + ro.height / 2) : null;
      return { left: r.left, right: r.right, janela: window.innerWidth, opcao: ro ? Math.round(ro.height) : 0,
               pintada: Boolean(alvo && op.contains(alvo)), rolaDeLado: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    ok(`a ${largura}: o menu cabe na tela`, menu && menu.left >= 0 && menu.right <= menu.janela + 0.5 && !menu.rolaDeLado, q(menu));
    ok(`a ${largura}: as opções com o alvo de dedo, e pintadas`, menu && menu.opcao >= 40 && menu.pintada, q(menu));
    ok(`a ${largura}: sem estouro de JavaScript`, estouros.length === 0, q(estouros));
    await ctx.close();
  }
}

const pedidas = CENAS.filter((c) => !TODAS.includes(c));
ok("toda cena pedida em CENAS existe", pedidas.length === 0, q(pedidas));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
