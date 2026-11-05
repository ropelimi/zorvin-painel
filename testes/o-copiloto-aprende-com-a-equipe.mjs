// O COPILOTO APRENDE COM A EQUIPE (05/11) — a metade do painel.
//
// Pedido do Rodrigo: depois da sugestão, quem atende pede uma mudança ("não
// podemos passar o telefone do advogado"), o Copiloto refaz a mensagem e
// APRENDE — a lição vale na hora, para o escritório inteiro. E o Copiloto lê
// as conversas de cada departamento e de cada telefone, e quem administra vê
// o que ele aprendeu.
//
// Quem fala com a IA e guarda a lição é a PONTE, provada no repo dela (seções
// 100 a 102). O que esta prova guarda é o que é da tela:
//
//   1. depois da sugestão, a faixa oferece pedir uma mudança — só com a ponte
//      que tem a rota (`ajustar`), e só com a mensagem na caixa;
//   2. o pedido vai à ponte com a conversa, o pedido e o que está na caixa; a
//      mensagem refeita entra na caixa com os marcadores preenchidos, e NÃO
//      SAI SOZINHA; a lição é dita ("Aprendi"), com o Desfazer;
//   3. o Desfazer apaga a lição do banco, e a recusa (calada ou com erro) é
//      dita — nunca "desfeito" sem ter desfeito;
//   4. a corrida: quem mexeu na caixa enquanto o Copiloto refazia não perde o
//      que escreveu, e a conversa trocada recebe a mensagem como rascunho;
//   5. o erro e o aviso da ponte são ditos;
//   6. a faixa some quando a caixa esvazia, menos com a lição à vista; o Esc
//      apaga o pedido e depois fecha a faixa, e a nota interna não tem campo;
//   7. no celular, a faixa cabe;
//   8. a aba "Copiloto" mostra as lições (quem ensinou, corrigir, apagar) e as
//      notas de cada departamento e telefone (corrigir, ler tudo de novo), diz
//      o que a ponte faz com a leitura, e some sem o 050 — e a leitura que
//      falha é dita.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await abrirNavegador();
// QUINTA, 05/11/2026, 9h EM BRASÍLIA: a saudação é "Bom dia".
const AGORA = Date.parse("2026-11-05T09:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const ATENDENTE = "MARIANA DE OLIVEIRA";
const CAMPO = 'textarea[data-campo]';
const PEDIDO = "não podemos passar o telefone do advogado";

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function preencher(loc, v) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(v, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function apertar(loc, tecla) {
  if (!(await loc.count())) return false;
  try { await loc.first().press(tecla, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
const valor = async (loc) => ((await loc.count()) ? loc.first().inputValue().catch(() => null) : null);
async function esperar(fn, ms = 8000) {
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    if (await fn()) return true;
    await pausa(100);
  }
  return Boolean(await fn());
}

/** O telefone que o painel ABRE, e o departamento dele — descobertos, e não
 *  escolhidos a dedo. */
async function oQueOPainelAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const T = globalThis.__TABELAS;
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    if (!c) return null;
    const adv = (T.advogados || []).find((a) => String(a.id) === String(c.advogado_id)) || {};
    const dep = (T.departamentos || []).find((d) => String(d.id) === String(adv.departamento_id)) || {};
    const outro = (T.advogados || []).find((a) => String(a.departamento_id) === String(adv.departamento_id)
      && String(a.id) !== String(adv.id));
    return { adv: adv.id, advNome: adv.nome, dep: dep.id, depNome: dep.nome, outro: outro ? outro.id : null,
             outroNome: outro ? outro.nome : null };
  });
  await ctx.close();
  return r;
}
const ABRE = await oQueOPainelAbre();
ok("aprendi qual telefone o painel abre, e o departamento dele",
   Boolean(ABRE && ABRE.adv && ABRE.dep != null && ABRE.outro), q(ABRE));
if (!ABRE || !ABRE.adv) { await nav.close(); process.exit(1); }
const ADV = ABRE.adv;

const contato = (id, numero, nome, vantoro_nome = null) =>
  ({ id, numero, nome, vantoro_nome, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-apr-1", "5511948230301", "Deus", "ANDREIA CRISTINA MARTINS"),
  contato("ct-apr-2", "5511948230302", "José Carlos Pereira"),
];
const A = "cv-apr-1", B = "cv-apr-2";
const conversa = (n) => ({
  id: `cv-apr-${n}`, advogado_id: ADV, contato_id: `ct-apr-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null,
  vantoro_nome: CONTATOS[n - 1].vantoro_nome, contato: CONTATOS[n - 1],
});
const SEMENTE_BASE = {
  contatos: CONTATOS,
  conversas: [1, 2].map(conversa),
  mensagens: [1, 2].map((n) => ({
    id: `m-apr-${n}`, conversa_id: `cv-apr-${n}`, origem: "contato", tipo: "texto",
    texto: "Bom dia, qual é o telefone do advogado?", criado_em: antes(n + 5),
  })),
};

// A PONTE DE MENTIRA. Trocada por cena; `pedidos` guarda cada pedido inteiro.
const ESTADO_NOVO = { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, ajustar: true, aprende: true };
const ponte = {
  estado: { status: 200, corpo: ESTADO_NOVO },
  sugestao: { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Vamos verificar e retornamos." }, demora: 0 },
  ajuste: null,
};
const pedidos = { sugerir: [], ajustar: [], respondidos: 0 };
const REFEITA = "{saudacao}, {nome}! Por segurança, não passamos o telefone do advogado. Posso ajudar por aqui?";
const REFEITA_PRONTA = "Bom dia, Andreia! Por segurança, não passamos o telefone do advogado. Posso ajudar por aqui?";
const LICAO = "Não passamos o telefone do advogado ao cliente.";
/** O ajuste que a ponte devolve — e, como a ponte de verdade, a lição que ela
 *  grava no banco antes de responder. */
function ajusteComLicao(id, { demora = 0, sugestao = REFEITA, textoDaLicao = LICAO } = {}) {
  return { status: 200, demora, corpo: { ok: true, sugestao, licao: { id, texto: textoDaLicao } },
           gravar: { id, texto: textoDaLicao, pedido: PEDIDO, conversa_id: A, criada_por: "u1",
                     criada_em: new Date(AGORA).toISOString(), editada_por: null, editada_em: null } };
}

async function abrirPagina({ largura = 1400, altura = 900, semente = {}, bandeiras = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  const perguntas = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => { perguntas.push(d.message()); d.accept().catch(() => {}); });
  await page.clock.setFixedTime(new Date(AGORA));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários, e a
  // última escrita é a que vale.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__NOME_NOVO_U1 = b.atendente;
    globalThis.__SEM_COPILOTO_QUE_APRENDE = Boolean(b.bandeiras.semAprender);
    globalThis.__ESCRITA_SEM_EFEITO = b.bandeiras.semEfeito || [];
    globalThis.__ERRO_NA_GRAVACAO = b.bandeiras.erroNaGravacao || {};
    globalThis.__RECUSAR_LEITURA = b.bandeiras.recusarLeitura || [];
  }, { semente: { ...SEMENTE_BASE, ...semente }, atendente: ATENDENTE, bandeiras });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (url.pathname.endsWith("/copiloto/sugerir")) {
      pedidos.sugerir.push({ corpo: JSON.parse(rota.request().postData() || "{}") });
      const r = ponte.sugestao;
      if (r.demora) await pausa(r.demora);
      return json(r.status, r.corpo);
    }
    if (url.pathname.endsWith("/copiloto/ajustar")) {
      pedidos.ajustar.push({ corpo: JSON.parse(rota.request().postData() || "{}"),
                             autorizacao: rota.request().headers()["authorization"] || "" });
      const r = ponte.ajuste || { status: 500, corpo: { ok: false, erro: "sem ajuste nesta cena" } };
      if (r.demora) await pausa(r.demora);
      if (r.gravar) {
        await page.evaluate((l) => { (globalThis.__TABELAS.zorvin_copiloto_licoes ||= []).push(l); }, r.gravar)
          .catch(() => {});
      }
      pedidos.respondidos++;
      return json(r.status, r.corpo);
    }
    // SEM VANTORO: a ficha fixa ficaria pedindo cadastro a esta ponte.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros, perguntas };
}
const caixa = (page) => page.locator(CAMPO);
const naCaixa = (page) => caixa(page).inputValue().catch(() => "SEM CAIXA");
async function abrirConversa(page, id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const botao = (page) => page.locator("[data-copiloto-botao]");
const faixa = (page, fase) => page.locator(fase ? `[data-copiloto-situacao="${fase}"]` : "[data-copiloto-situacao]");
const campoDoPedido = (page) => page.locator("[data-copiloto-pedido-campo]");
const saiuParaOCliente = (page, conversaId) => page.evaluate((id) =>
  (globalThis.__TABELAS.fila_envio || []).filter((f) => String(f.conversa_id) === String(id)).length, conversaId);
const licoesNaTabela = (page) => page.evaluate(() => (globalThis.__TABELAS.zorvin_copiloto_licoes || []).map((l) => l.id));
async function sugerir(page) {
  await preencher(caixa(page), "");
  await page.waitForTimeout(150);
  if (!(await esperar(async () => (await botao(page).count()) === 1))) return false;
  if (!(await clicar(botao(page)))) return false;
  if (!(await esperar(async () => (await naCaixa(page)).length > 0 && (await faixa(page).count()) === 1))) return false;
  return cursorNaCaixa(page);
}
/** A SUGESTÃO LEVA O CURSOR PARA A CAIXA no quadro seguinte (`colocarNaCaixa`,
 *  com `requestAnimationFrame`). Numa máquina lenta, a prova começava a
 *  escrever o pedido antes disso, e o cursor mudava de lugar no meio: parte do
 *  pedido ia para a caixa de escrever. Uma pessoa não digita tão depressa, mas
 *  a prova sim — então ela espera o cursor chegar. */
async function cursorNaCaixa(page) {
  return esperar(async () => page.evaluate(() =>
    Boolean(document.activeElement && document.activeElement.matches("textarea[data-campo]"))).catch(() => false));
}
/** O pedido é mandado pelo campo, e a prova espera a faixa dizer que ele saiu
 *  (o Copiloto refazendo, ou já de volta): sem isso, um Enter perdido numa
 *  máquina lenta passaria por "a ponte não respondeu". */
async function pedirMudanca(page, pedido = PEDIDO) {
  const antes = pedidos.ajustar.length;
  if (!(await preencher(campoDoPedido(page), pedido))) return false;
  await page.waitForTimeout(100);
  if (!(await apertar(campoDoPedido(page), "Enter"))) return false;
  return esperar(async () => pedidos.ajustar.length > antes);
}

// ==================================================================
console.log("\n1. Depois da sugestão, a faixa oferece pedir uma mudança");
let { ctx, page, estouros } = await abrirPagina();
ok("abri a conversa da Andreia", await abrirConversa(page, A));
ok("a sugestão entrou na caixa", await sugerir(page));
ok("com a saudação e o nome da ficha", (await naCaixa(page)) === "Bom dia, Andreia! Vamos verificar e retornamos.",
   q(await naCaixa(page)));
ok("a faixa está lá, e diz que a sugestão está na caixa",
   (await faixa(page, "sugeriu").count()) === 1 && /a sugestão está na caixa/.test(await texto(faixa(page, "sugeriu"))),
   q(await texto(faixa(page))));
ok("com o campo de pedir uma mudança", (await campoDoPedido(page).count()) === 1);
ok("que diz o que é (placeholder)",
   /Pedir uma mudança ao Copiloto/.test((await campoDoPedido(page).first().getAttribute("placeholder").catch(() => "")) || ""));
ok("o botão Pedir fica desligado com o campo vazio",
   await page.locator("[data-copiloto-pedir]").first().isDisabled().catch(() => false));
ok("e nada saiu para o cliente", (await saiuParaOCliente(page, A)) === 0);

// ==================================================================
console.log("\n2. Pedir uma mudança: a mensagem refeita entra, e o Copiloto aprende");
{
  ponte.ajuste = ajusteComLicao("lc-nova", { demora: 1500 });
  ok("escreveu o pedido, apertou Enter, e o pedido saiu", await pedirMudanca(page));
  await page.waitForTimeout(300);
  ok("enquanto refaz, a faixa diz",
     (await faixa(page, "ajustando").count()) === 1 && /refazendo a mensagem/.test(await texto(faixa(page, "ajustando"))),
     q(await texto(faixa(page))));
  ok("o campo fica travado com o pedido",
     (await campoDoPedido(page).first().getAttribute("readonly").catch(() => null)) !== null
     && (await valor(campoDoPedido(page))) === PEDIDO);
  ok("o botão Pedir fica desligado", await page.locator("[data-copiloto-pedir]").first().isDisabled().catch(() => false));
  ok("e não há X (o pedido está andando)", (await page.locator("[data-copiloto-fechar]").count()) === 0);
  ok("foi UM pedido à ponte", pedidos.ajustar.length === 1, `foram ${pedidos.ajustar.length}`);
  const c = (pedidos.ajustar[0] || {}).corpo || {};
  ok("com a conversa, o pedido e a mensagem que estava na caixa",
     c.conversa_id === A && c.pedido === PEDIDO && c.sugestao === "Bom dia, Andreia! Vamos verificar e retornamos.", q(c));
  ok("e com a sessão de quem pediu", /^Bearer .+/.test((pedidos.ajustar[0] || {}).autorizacao || ""));
  ok("a mensagem refeita entrou na caixa, com os marcadores preenchidos",
     await esperar(async () => (await naCaixa(page)) === REFEITA_PRONTA), q(await naCaixa(page)));
  await cursorNaCaixa(page);
  ok("a faixa diz que a mensagem refeita está na caixa",
     (await faixa(page, "sugeriu").count()) === 1 && /mensagem refeita está na caixa/.test(await texto(faixa(page, "sugeriu"))));
  ok("o campo volta vazio, para outro pedido", (await valor(campoDoPedido(page))) === "");
  const licao = await texto(page.locator("[data-copiloto-licao]"));
  ok("e diz o que aprendeu, e que vale para a equipe toda",
     /Aprendi:/.test(licao) && licao.includes(LICAO) && /vale para a equipe toda/.test(licao), q(licao));
  ok("com o Desfazer", (await page.locator("[data-copiloto-desfazer]").count()) === 1);
  ok("e nada saiu para o cliente", (await saiuParaOCliente(page, A)) === 0);
  await abrirConversa(page, B);
  await abrirConversa(page, A);
  ok("ir a outra conversa e voltar não some com a faixa (o rascunho volta depois da conversa)",
     (await faixa(page, "sugeriu").count()) === 1 && (await page.locator("[data-copiloto-licao]").count()) === 1
     && (await naCaixa(page)) === REFEITA_PRONTA, q(await texto(faixa(page))));
}

// ==================================================================
console.log("\n3. Desfazer apaga a lição do banco");
{
  ok("a ponte guardou a lição", (await licoesNaTabela(page)).includes("lc-nova"));
  ok("desfez", await clicar(page.locator("[data-copiloto-desfazer]")));
  ok("a lição saiu do banco", await esperar(async () => !(await licoesNaTabela(page)).includes("lc-nova")));
  ok("e a faixa diz que desfez",
     await esperar(async () => (await page.locator("[data-copiloto-licao-desfeita]").count()) === 1)
     && (await page.locator("[data-copiloto-licao]").count()) === 0);
  ok("a caixa continua com a mensagem refeita", (await naCaixa(page)) === REFEITA_PRONTA);
}

// ==================================================================
console.log("\n4. A mensagem enviada leva a faixa junto — sem lição à vista");
{
  await apertar(caixa(page), "Enter");
  ok("a mensagem foi para a fila", await esperar(async () => (await saiuParaOCliente(page, A)) === 1));
  ok("e a faixa saiu", await esperar(async () => (await faixa(page).count()) === 0), q(await texto(faixa(page))));
  await preencher(caixa(page), "Uma mensagem minha, escrita depois.");
  await page.waitForTimeout(200);
  ok("e não volta quando a pessoa escreve outra mensagem: ela não é sugestão do Copiloto",
     (await faixa(page).count()) === 0 && (await campoDoPedido(page).count()) === 0, q(await texto(faixa(page))));
  await preencher(caixa(page), "");
}

// ==================================================================
console.log("\n5. Com a lição à vista, a faixa fica depois de enviar — o Desfazer não some");
{
  ok("outra sugestão", await sugerir(page));
  ponte.ajuste = ajusteComLicao("lc-5");
  ok("o pedido saiu", await pedirMudanca(page));
  ok("a refeita entrou", await esperar(async () => (await naCaixa(page)) === REFEITA_PRONTA));
  await apertar(caixa(page), "Enter");
  await esperar(async () => (await naCaixa(page)) === "");
  await page.waitForTimeout(300);
  ok("a faixa continua, com a lição e o Desfazer",
     (await page.locator("[data-copiloto-licao]").count()) === 1 && (await page.locator("[data-copiloto-desfazer]").count()) === 1);
  ok("e sem o campo: a caixa está vazia, e não há o que mudar", (await campoDoPedido(page).count()) === 0);
  ok("a frase diz que é sobre o que aprendeu", /aprendeu com o seu pedido/.test(await texto(faixa(page))), q(await texto(faixa(page))));
  await preencher(caixa(page), "Uma mensagem minha, sem o Copiloto.");
  await page.waitForTimeout(200);
  ok("a próxima mensagem é de quem escreve: o campo de pedir mudança não volta por cima dela",
     (await campoDoPedido(page).count()) === 0 && (await page.locator("[data-copiloto-licao]").count()) === 1);
  await preencher(caixa(page), "");
  ok("o X fecha", await clicar(page.locator("[data-copiloto-fechar]")));
  await page.waitForTimeout(200);
  ok("e a faixa saiu", (await faixa(page).count()) === 0);
  ok("fechar a faixa não apaga a lição (quem desfaz é o Desfazer)", (await licoesNaTabela(page)).includes("lc-5"));
}

// ==================================================================
console.log("\n6. O Desfazer que o banco recusa é dito — e a lição continua");
{
  ok("outra sugestão", await sugerir(page));
  ponte.ajuste = ajusteComLicao("lc-6");
  ok("o pedido saiu", await pedirMudanca(page));
  ok("e a lição está à vista, com o Desfazer",
     await esperar(async () => (await page.locator("[data-copiloto-desfazer]").count()) === 1));
  await page.evaluate(() => { globalThis.__ESCRITA_SEM_EFEITO = ["zorvin_copiloto_licoes"]; });
  await clicar(page.locator("[data-copiloto-desfazer]"));
  const calado = await esperar(async () => /o banco não deixou/.test(await texto(page.locator("[data-copiloto-erro-desfazer]"))));
  ok("a recusa calada é dita como recusa", calado, q(await texto(page.locator("[data-copiloto-erro-desfazer]"))));
  ok("a lição continua na faixa, e no banco",
     (await page.locator("[data-copiloto-licao]").count()) === 1 && (await licoesNaTabela(page)).includes("lc-6"));
  ok("e a faixa não diz que desfez", (await page.locator("[data-copiloto-licao-desfeita]").count()) === 0);
  await page.evaluate(() => {
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = { zorvin_copiloto_licoes: { code: "PGRST301", message: "JWT expired" } };
  });
  await clicar(page.locator("[data-copiloto-desfazer]"));
  ok("o erro do banco é dito com o código",
     await esperar(async () => /erro PGRST301/.test(await texto(page.locator("[data-copiloto-erro-desfazer]")))),
     q(await texto(page.locator("[data-copiloto-erro-desfazer]"))));
  ok("e a lição continua no banco", (await licoesNaTabela(page)).includes("lc-6"));
  await page.evaluate(() => { globalThis.__ERRO_NA_GRAVACAO = {}; });
  await preencher(caixa(page), "");
  await clicar(page.locator("[data-copiloto-fechar]"));
}

// ==================================================================
console.log("\n7. Quem mexeu na caixa enquanto o Copiloto refazia não perde o que escreveu");
{
  ok("outra sugestão", await sugerir(page));
  ponte.ajuste = ajusteComLicao("lc-7", { demora: 2500 });
  ok("o pedido saiu", await pedirMudanca(page));
  await preencher(caixa(page), "Oi, um momento");
  await esperar(async () => (await faixa(page, "atrasada").count()) === 1);
  ok("o que foi escrito continua na caixa", (await naCaixa(page)) === "Oi, um momento", q(await naCaixa(page)));
  ok("e a faixa diz que a mensagem refeita chegou depois",
     (await faixa(page, "atrasada").count()) === 1 && /mensagem refeita chegou depois/.test(await texto(faixa(page, "atrasada"))),
     q(await texto(faixa(page))));
  ok("oferecendo usá-la", /Usar a mensagem refeita/.test(await texto(page.locator("[data-copiloto-usar]"))));
  ok("usou", await clicar(page.locator("[data-copiloto-usar]")));
  await page.waitForTimeout(200);
  ok("e ela trocou o texto da caixa", (await naCaixa(page)) === REFEITA_PRONTA, q(await naCaixa(page)));
  ok("a faixa volta com o campo, e com a lição que veio junto",
     (await faixa(page, "sugeriu").count()) === 1 && (await campoDoPedido(page).count()) === 1
     && (await page.locator("[data-copiloto-licao]").count()) === 1);
  await preencher(caixa(page), "");
  await clicar(page.locator("[data-copiloto-fechar]"));
}

// ==================================================================
console.log("\n8. Trocar de conversa enquanto o Copiloto refazia: a mensagem vai para a conversa certa");
{
  ok("outra sugestão", await sugerir(page));
  ponte.ajuste = { status: 200, demora: 3000, corpo: { ok: true, sugestao: REFEITA, licao: null } };
  const respondidosAntes = pedidos.respondidos;
  ok("o pedido saiu", await pedirMudanca(page));
  await abrirConversa(page, B);
  ok("e a ponte respondeu com a conversa do José aberta",
     await esperar(async () => pedidos.respondidos > respondidosAntes, 10000));
  await page.waitForTimeout(500);
  ok("na conversa do José, a caixa continua vazia", (await naCaixa(page)) === "", q(await naCaixa(page)));
  ok("e não há faixa do copiloto ali", (await faixa(page).count()) === 0);
  await abrirConversa(page, A);
  ok("de volta à da Andreia, a mensagem refeita está na caixa — com o nome DELA",
     (await naCaixa(page)) === REFEITA_PRONTA, q(await naCaixa(page)));
  ok("e a faixa diz que é a refeita",
     (await faixa(page, "sugeriu").count()) === 1 && /mensagem refeita está na caixa/.test(await texto(faixa(page))));
  await preencher(caixa(page), "");
}

// ==================================================================
console.log("\n9. O pedido que falha é dito, e o pedido fica no campo");
{
  ok("outra sugestão", await sugerir(page));
  ponte.ajuste = { status: 502, demora: 0, corpo: { ok: false, erro: "A IA não respondeu agora. Tente de novo em instantes." } };
  ok("o pedido saiu", await pedirMudanca(page));
  const frase = await esperar(async () => /não respondeu agora/.test(await texto(page.locator("[data-copiloto-erro-do-pedido]"))));
  ok("a frase da ponte aparece na faixa", frase, q(await texto(page.locator("[data-copiloto-erro-do-pedido]"))));
  ok("o pedido continua no campo, para tentar de novo", (await valor(campoDoPedido(page))) === PEDIDO);
  ok("e a caixa não mudou", (await naCaixa(page)) === "Bom dia, Andreia! Vamos verificar e retornamos.", q(await naCaixa(page)));
}

// ==================================================================
console.log("\n10. A lição que a ponte não conseguiu guardar é dita");
{
  ponte.ajuste = { status: 200, demora: 0, corpo: { ok: true, sugestao: REFEITA, licao: null,
    aviso: "Refiz a mensagem, mas não consegui guardar a lição: falta uma atualização do banco." } };
  await clicar(page.locator("[data-copiloto-pedir]"));
  ok("a refeita entrou", await esperar(async () => (await naCaixa(page)) === REFEITA_PRONTA));
  ok("o aviso da ponte aparece", /não consegui guardar a lição/.test(await texto(page.locator("[data-copiloto-aviso]"))));
  ok("e não há “Aprendi” sem lição", (await page.locator("[data-copiloto-licao]").count()) === 0);
  ok("o erro do pedido anterior saiu", (await page.locator("[data-copiloto-erro-do-pedido]").count()) === 0);
  await preencher(caixa(page), "");
  await page.waitForTimeout(200);
}

// ==================================================================
console.log("\n11. O Esc apaga o pedido e depois fecha a faixa; a nota interna não tem campo");
{
  ok("outra sugestão", await sugerir(page));
  await preencher(campoDoPedido(page), "abc");
  await apertar(campoDoPedido(page), "Escape");
  await page.waitForTimeout(200);
  ok("o primeiro Esc apaga o pedido", (await valor(campoDoPedido(page))) === "");
  ok("e não fecha a faixa nem a conversa",
     (await faixa(page).count()) === 1 && (await page.locator(`[data-conversa-aberta="${A}"], ${CAMPO}`).count()) >= 1);
  await apertar(campoDoPedido(page), "Escape");
  await page.waitForTimeout(200);
  ok("o segundo Esc fecha a faixa", (await faixa(page).count()) === 0);
  ok("e a conversa continua aberta, com a mensagem na caixa",
     (await caixa(page).count()) === 1 && (await naCaixa(page)) === "Bom dia, Andreia! Vamos verificar e retornamos.");
  ok("outra sugestão", await sugerir(page));
  await clicar(page.locator("[data-nota-interna]"));
  await page.waitForTimeout(300);
  ok("na nota interna, o campo e a faixa somem (a nota não vai ao cliente)",
     (await campoDoPedido(page).count()) === 0 && (await faixa(page).count()) === 0);
  await clicar(page.locator("[data-nota-interna]"));
  await page.waitForTimeout(300);
  ok("de volta à mensagem, o campo volta", (await campoDoPedido(page).count()) === 1);
  await preencher(caixa(page), "");
  await page.waitForTimeout(200);
}
ok("nenhum estouro de página até aqui", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n12. A ponte de antes do agente: a sugestão entra sem faixa, como antes");
{
  ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true } };
  ({ ctx, page } = await abrirPagina());
  await abrirConversa(page, A);
  await clicar(botao(page));
  ok("a sugestão entrou", await esperar(async () => (await naCaixa(page)).length > 0));
  await page.waitForTimeout(400);
  ok("e não há faixa nem campo: a ponte não tem a rota", (await faixa(page).count()) === 0 && (await campoDoPedido(page).count()) === 0);
  await ctx.close();
  ponte.estado = { status: 200, corpo: ESTADO_NOVO };
}

// ==================================================================
console.log("\n13. No celular, a faixa cabe");
{
  ({ ctx, page, estouros } = await abrirPagina({ largura: 390, altura: 844 }));
  await abrirConversa(page, A);
  ok("abriu o ⋮", await clicar(page.getByRole("button", { name: "Mais opções desta conversa" })));
  await page.waitForTimeout(300);
  ok("pediu a sugestão pelo ⋮", await clicar(page.locator("[data-copiloto-item]")));
  await esperar(async () => (await naCaixa(page)).length > 0);
  ok("a faixa com o campo apareceu", (await campoDoPedido(page).count()) === 1);
  const medidas = await page.evaluate(() => {
    const pintado = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const achado = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(achado && (achado === el || el.contains(achado)));
    };
    const pedir = document.querySelector("[data-copiloto-pedir]");
    return { rolaDeLado: document.documentElement.scrollWidth > window.innerWidth + 1,
             campo: pintado("[data-copiloto-pedido-campo]"), pedir: pintado("[data-copiloto-pedir]"),
             alturaPedir: pedir ? Math.round(pedir.getBoundingClientRect().height) : 0,
             direitaDoPedir: pedir ? pedir.getBoundingClientRect().right : 9999, largura: window.innerWidth };
  });
  ok("a página não rola de lado", !medidas.rolaDeLado, q(medidas));
  ok("o campo e o botão Pedir estão pintados na tela", medidas.campo && medidas.pedir && medidas.direitaDoPedir <= medidas.largura, q(medidas));
  ok("o botão Pedir tem altura de dedo", medidas.alturaPedir >= 40, `${medidas.alturaPedir}px`);
  ok("nenhum estouro de página no celular", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  A ABA "COPILOTO" DA ADMINISTRAÇÃO
// ==================================================================
async function abrirAAba(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(800);
  if (!(await clicar(page.locator("[data-aba-copiloto]")))) return false;
  await page.waitForTimeout(900);
  return true;
}
const licao = (id, textoDela, criada_por, minAtras, pedido = null) => ({
  id, texto: textoDela, pedido, conversa_id: null, criada_por, criada_em: antes(minAtras), editada_por: null, editada_em: null,
});
const LICOES = [
  licao("lc-a", "Não passamos o telefone do advogado ao cliente.", "u-jenifer", 10, "não pode passar o telefone do doutor"),
  licao("lc-b", "Prazo de audiência só pela equipe de Audiências.", "u1", 60),
  licao("lc-c", "Não prometemos data de pagamento.", "u-sumiu", 120),
];
const linhaDaLicao = (page, id) => page.locator(`[data-licao-da-config="${id}"]`);
const tabelaDaLicao = (page, id) => page.evaluate((x) =>
  (globalThis.__TABELAS.zorvin_copiloto_licoes || []).find((l) => l.id === x) || null, id);

console.log("\n14. A aba mostra as lições, com quem ensinou, e deixa corrigir e apagar");
{
  let perguntas;
  ({ ctx, page, estouros, perguntas } = await abrirPagina({ semente: { zorvin_copiloto_licoes: LICOES.map((l) => ({ ...l })) } }));
  ok("abri a aba Copiloto", await abrirAAba(page));
  ok("a seção das lições está lá", (await page.locator("[data-licoes-do-copiloto]").count()) === 1);
  const ordem = await page.locator("[data-licao-da-config]").evaluateAll((els) => els.map((e) => e.getAttribute("data-licao-da-config")));
  ok("as três, da mais recente para a mais antiga", q(ordem) === q(["lc-a", "lc-b", "lc-c"]), q(ordem));
  const quemA = await texto(linhaDaLicao(page, "lc-a").locator("[data-licao-quem]"));
  ok("cada uma diz quem ensinou e quando", /Ensinada por JENIFER ALMEIDA em 05\/11\/2026/.test(quemA), q(quemA));
  ok("e o pedido que a ensinou", /não pode passar o telefone do doutor/.test(await texto(linhaDaLicao(page, "lc-a").locator("[data-licao-pedido]"))));
  ok("quem a equipe não conhece vira “alguém da equipe”",
     /Ensinada por alguém da equipe/.test(await texto(linhaDaLicao(page, "lc-c").locator("[data-licao-quem]"))));
  ok("com três lições, não há campo de pesquisa", (await page.locator('[data-campo-de-pesquisa="licoes"]').count()) === 0);
  ok("corrigir a primeira", await clicar(linhaDaLicao(page, "lc-a").locator("[data-licao-corrigir]")));
  await preencher(linhaDaLicao(page, "lc-a").locator("[data-licao-campo]"), "Nunca passamos o telefone do advogado.");
  ok("salvar", await clicar(linhaDaLicao(page, "lc-a").locator("[data-licao-salvar]")));
  ok("o banco ficou com o texto novo, e com quem corrigiu",
     await esperar(async () => { const l = await tabelaDaLicao(page, "lc-a"); return l && l.texto === "Nunca passamos o telefone do advogado." && l.editada_por === "u1"; }),
     q(await tabelaDaLicao(page, "lc-a")));
  ok("a tela relê, e diz quem corrigiu",
     await esperar(async () => /corrigida por MARIANA DE OLIVEIRA/.test(await texto(linhaDaLicao(page, "lc-a").locator("[data-licao-quem]")))),
     q(await texto(linhaDaLicao(page, "lc-a").locator("[data-licao-quem]"))));
  ok("e diz que salvou", /Salvo/.test(await texto(linhaDaLicao(page, "lc-a").locator('[data-licao-recado="ok"]'))));
  ok("apagar a segunda", await clicar(linhaDaLicao(page, "lc-b").locator("[data-licao-apagar]")));
  ok("apagar pergunta antes, dizendo qual lição", perguntas.some((p) => /Apagar esta lição/.test(p) && /Prazo de audiência/.test(p)), q(perguntas));
  ok("saiu do banco", await esperar(async () => !(await tabelaDaLicao(page, "lc-b"))));
  ok("e da lista", await esperar(async () => (await linhaDaLicao(page, "lc-b").count()) === 0));
  await page.evaluate(() => { globalThis.__ESCRITA_SEM_EFEITO = ["zorvin_copiloto_licoes"]; });
  await clicar(linhaDaLicao(page, "lc-c").locator("[data-licao-corrigir]"));
  await preencher(linhaDaLicao(page, "lc-c").locator("[data-licao-campo]"), "Texto que não vai entrar.");
  await clicar(linhaDaLicao(page, "lc-c").locator("[data-licao-salvar]"));
  ok("a recusa calada do banco é dita como recusa",
     await esperar(async () => /o banco não deixou/.test(await texto(linhaDaLicao(page, "lc-c").locator('[data-licao-recado="erro"]')))));
  ok("e o banco não mudou", ((await tabelaDaLicao(page, "lc-c")) || {}).texto === "Não prometemos data de pagamento.");
  await page.evaluate(() => { globalThis.__ESCRITA_SEM_EFEITO = []; });
  ok("nenhum estouro de página na aba", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n15. Muitas lições ganham a pesquisa");
{
  const muitas = Array.from({ length: 8 }, (_, i) =>
    licao(`lc-m${i}`, i === 3 ? "Não passamos o telefone do advogado." : `Regra número ${i} da equipe.`, "u1", 10 + i));
  ({ ctx, page } = await abrirPagina({ semente: { zorvin_copiloto_licoes: muitas } }));
  await abrirAAba(page);
  const campo = page.locator('[data-campo-de-pesquisa="licoes"] input');
  ok("com oito lições, há o campo de pesquisa", (await campo.count()) === 1);
  if (await campo.count()) await campo.fill("telefone advogado");
  await page.waitForTimeout(200);
  ok("a pesquisa sem acento e por palavras acha a lição", (await page.locator("[data-licao-da-config]").count()) === 1
     && (await page.locator('[data-licao-da-config="lc-m3"]').count()) === 1);
  if (await campo.count()) await campo.fill("xyzw");
  await page.waitForTimeout(200);
  ok("nada achado, a frase repete o que foi escrito", /“xyzw”/.test(await texto(page.locator("[data-licoes-nada]"))));
  await ctx.close();
}

console.log("\n16. A aba mostra as notas de cada departamento e telefone, e deixa corrigir e ler de novo");
const notas = (id, escopo, chave, textoDelas, lidas) => ({
  id, escopo, advogado_id: escopo === "telefone" ? chave : null, departamento_id: escopo === "departamento" ? chave : null,
  texto: textoDelas, leu_ate: lidas ? antes(30) : null, leu_ate_id: lidas ? "m-x" : null, mensagens_lidas: lidas,
  aprendido_em: lidas ? antes(30) : null, atualizado_em: antes(30), editado_por: null, editado_em: null,
});
const NOTAS = [
  notas("ap-dep", "departamento", ABRE.dep, "- Perguntas de sempre: o andamento do processo.", 1200),
  notas("ap-adv", "telefone", ADV, "", 0),
  notas("ap-outro", "telefone", ABRE.outro, "- A equipe confirma o recebimento dos documentos.", 340),
];
const linhaDasNotas = (page, id) => page.locator(`[data-notas-do-copiloto="${id}"]`);
const tabelaDasNotas = (page, id) => page.evaluate((x) =>
  (globalThis.__TABELAS.zorvin_copiloto_aprendido || []).find((l) => l.id === x) || null, id);
{
  let perguntas;
  ({ ctx, page, estouros, perguntas } = await abrirPagina({ semente: { zorvin_copiloto_aprendido: NOTAS.map((n) => ({ ...n })) } }));
  ok("abri a aba Copiloto", await abrirAAba(page));
  ok("a seção das notas está lá", (await page.locator("[data-notas-do-copiloto-secao]").count()) === 1);
  ok("ela diz que o Copiloto está lendo as conversas",
     /lê as conversas sozinho/.test(await texto(page.locator('[data-copiloto-leitura="lendo"]'))));
  ok("o departamento do telefone aparece, com quantas mensagens leu",
     /leu 1\.200 mensagens/.test(await texto(linhaDasNotas(page, "ap-dep").locator("[data-notas-situacao]"))),
     q(await texto(linhaDasNotas(page, "ap-dep"))));
  ok("e os telefones dele, embaixo",
     (await linhaDasNotas(page, "ap-adv").count()) === 1 && (await linhaDasNotas(page, "ap-outro").count()) === 1);
  ok("o telefone que ainda não leu diz isso", /ainda não leu nada/.test(await texto(linhaDasNotas(page, "ap-adv").locator("[data-notas-situacao]"))));
  ok("as notas começam fechadas", (await page.locator("[data-notas-texto]").count()) === 0);
  ok("abriu as do departamento", await clicar(linhaDasNotas(page, "ap-dep").locator("[data-notas-abrir]")));
  ok("o texto delas está na caixa", (await valor(linhaDasNotas(page, "ap-dep").locator("[data-notas-texto]"))) === NOTAS[0].texto);
  ok("o Salvar fica desligado sem mudança", await linhaDasNotas(page, "ap-dep").locator("[data-notas-salvar]").first().isDisabled().catch(() => false));
  await preencher(linhaDasNotas(page, "ap-dep").locator("[data-notas-texto]"), "- Perguntas de sempre: o andamento e o prazo.");
  ok("salvar", await clicar(linhaDasNotas(page, "ap-dep").locator("[data-notas-salvar]")));
  ok("o banco ficou com o texto novo, e com quem corrigiu",
     await esperar(async () => { const l = await tabelaDasNotas(page, "ap-dep"); return l && l.texto === "- Perguntas de sempre: o andamento e o prazo." && l.editado_por === "u1"; }),
     q(await tabelaDasNotas(page, "ap-dep")));
  ok("a tela diz quem corrigiu à mão",
     await esperar(async () => /Corrigidas à mão por MARIANA DE OLIVEIRA/.test(await texto(linhaDasNotas(page, "ap-dep").locator("[data-notas-editadas]")))));
  ok("e que o Copiloto continua a partir delas",
     /continua aprendendo a partir delas/.test(await texto(linhaDasNotas(page, "ap-dep").locator('[data-notas-recado="ok"]'))));
  ok("ler tudo de novo", await clicar(linhaDasNotas(page, "ap-dep").locator("[data-notas-ler-de-novo]")));
  ok("pergunta antes, dizendo onde", perguntas.some((p) => /Ler tudo de novo/.test(p) && p.includes(ABRE.depNome)), q(perguntas));
  const chamadas = await page.evaluate(() => globalThis.__CHAMADAS_LER_DE_NOVO || []);
  ok("pediu ao banco a leitura de novo DESTA linha", await esperar(async () =>
    (await page.evaluate(() => (globalThis.__CHAMADAS_LER_DE_NOVO || []).map((c) => c.p_id))).includes("ap-dep")), q(chamadas));
  ok("o banco apagou as notas e voltou a leitura ao começo",
     await esperar(async () => { const l = await tabelaDasNotas(page, "ap-dep"); return l && l.texto === "" && l.mensagens_lidas === 0; }));
  ok("a tela diz que combinou, e que ainda não leu nada",
     await esperar(async () => /Combinado/.test(await texto(linhaDasNotas(page, "ap-dep").locator('[data-notas-recado="ok"]')))
       && /ainda não leu nada/.test(await texto(linhaDasNotas(page, "ap-dep").locator("[data-notas-situacao]")))));
  ok("abriu as do telefone sem notas", await clicar(linhaDasNotas(page, "ap-outro").locator("[data-notas-abrir]")) &&
     await clicar(linhaDasNotas(page, "ap-adv").locator("[data-notas-abrir]")));
  ok("e a tela diz que ainda não há notas ali", (await linhaDasNotas(page, "ap-adv").locator("[data-notas-vazias]").count()) === 1);
  await page.evaluate(() => { globalThis.__ESCRITA_SEM_EFEITO = ["zorvin_copiloto_aprendido"]; });
  await preencher(linhaDasNotas(page, "ap-adv").locator("[data-notas-texto]"), "- Uma nota que não vai entrar.");
  await clicar(linhaDasNotas(page, "ap-adv").locator("[data-notas-salvar]"));
  ok("a recusa calada do banco é dita como recusa",
     await esperar(async () => /o banco não deixou/.test(await texto(linhaDasNotas(page, "ap-adv").locator('[data-notas-recado="erro"]')))));
  ok("e o banco não mudou", ((await tabelaDasNotas(page, "ap-adv")) || {}).texto === "");
  await page.evaluate(() => { globalThis.__ESCRITA_SEM_EFEITO = []; });
  ok("nenhum estouro de página na aba", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n17. A aba diz o que a ponte faz com a leitura das conversas");
for (const [corpo, tipo, frase] of [
  [{ ...ESTADO_NOVO, aprende: false }, "parado", /COPILOTO_APRENDER=desligado/],
  [{ ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true }, "antiga", /de antes desta função/],
  [{ ok: true, ligado: false, modelo: "claude-haiku-5-5" }, "desligado", /ANTHROPIC_API_KEY/],
]) {
  ponte.estado = { status: 200, corpo };
  ({ ctx, page } = await abrirPagina({ semente: { zorvin_copiloto_aprendido: NOTAS.map((n) => ({ ...n })) } }));
  await abrirAAba(page);
  const t = await texto(page.locator(`[data-copiloto-leitura="${tipo}"]`));
  ok(`a ponte ${tipo}: a frase diz`, frase.test(t), q(t));
  await ctx.close();
}
ponte.estado = { status: 200, corpo: ESTADO_NOVO };

console.log("\n18. Sem o 050, as seções somem; a leitura que falha é dita");
{
  ({ ctx, page } = await abrirPagina({ bandeiras: { semAprender: true } }));
  await abrirAAba(page);
  ok("sem o 050, nem as lições nem as notas aparecem",
     (await page.locator("[data-licoes-do-copiloto]").count()) === 0 && (await page.locator("[data-notas-do-copiloto-secao]").count()) === 0);
  ok("e o manual continua", (await page.locator("[data-manual-texto]").count()) === 1);
  await ctx.close();
  ({ ctx, page } = await abrirPagina({ semente: { zorvin_copiloto_licoes: LICOES.map((l) => ({ ...l })) },
                                       bandeiras: { recusarLeitura: ["zorvin_copiloto_licoes", "zorvin_copiloto_aprendido"] } }));
  await abrirAAba(page);
  ok("a leitura das lições que falha é dita, e nenhuma lista é desenhada",
     /Não consegui ler as lições/.test(await texto(page.locator("[data-licoes-erro]")))
     && (await page.locator("[data-licao-da-config]").count()) === 0);
  ok("a das notas também", /Não consegui ler o que o Copiloto aprendeu/.test(await texto(page.locator("[data-notas-erro]"))));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
