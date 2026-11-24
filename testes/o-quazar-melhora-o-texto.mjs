// O QUAZAR MELHORA O TEXTO (24/11) — a metade do painel.
//
// Pedido do Rodrigo: *"O que eu preciso agora é de uma atualização onde após
// digitar um texto na conversa, a opção do Quazar estar disponível para
// melhorar o texto."*
//
// A ponte melhora (`POST /copiloto/melhorar`, script 063, provado lá). O que
// esta prova guarda é o que é da tela:
//
//   1. com texto na caixa, o rosto do Quazar melhora (e com ela vazia, ele
//      sugere, como antes); a ponte de antes não oferece; nem a nota, nem o
//      "/" das rápidas;
//   2. o texto melhorado entra na caixa, a faixa diz, e a mensagem sai com a
//      marca 'melhorada', mexida depois ou não; a bolha que sai já mostra;
//   3. "Voltar ao meu texto" devolve o que a pessoa escreveu, sem marca;
//   4. o texto que já estava bom fica como está, e sai sem marca;
//   5. quem continua escrevendo enquanto o Quazar pensa não perde nada: a
//      faixa oferece usar o texto melhorado;
//   6. a falha é dita, e a caixa fica;
//   7. o "Pedir uma mudança" depois de melhorar continua 'melhorada';
//   8. o "Sugerir resposta" depois continua 'igual';
//   9. numa conversa estreita, o caminho é o ⋮;
//  10. no celular, o "+" diz "Melhorar o texto" com texto, e o ⋮ também;
//  11. o banco sem o 063: a mensagem sai, sem a marca, e a do "Sugerir
//      resposta" continua marcada;
//  12. o relatório conta os textos melhorados.
import { abrirNavegador, ENDERECO, abrirATela } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const AGORA = Date.parse("2026-11-24T10:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function apertar(loc, tecla) {
  if (!(await loc.count())) return false;
  try { await loc.first().press(tecla, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function preencher(loc, valor) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(valor, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.count().then((n) => (n ? loc.first().innerText().catch(() => "") : ""));
const attr = (loc, a) => loc.count().then((n) => (n ? loc.first().getAttribute(a).catch(() => null) : null));

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const CONTATO = { id: "ct-mt", numero: "5511948230377", nome: "Cliente do Texto", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const A = "cv-mt";
const MENSAGENS = [
  { id: "m-mt-1", conversa_id: A, origem: "contato", tipo: "texto", texto: "Bom dia, e o acordo?", id_uazapi: "uz-mt-1", criado_em: antes(60) },
  { id: "m-mt-2", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Bom dia! O acordo está em análise.", enviado_por: "Rodrigo Sousa",
    enviado_por_id: "u1", id_uazapi: "uz-mt-2", status: "enviada", criado_em: antes(55), sugestao_quazar: "melhorada" },
  { id: "m-mt-3", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Te aviso amanhã.", enviado_por: "Rodrigo Sousa",
    enviado_por_id: "u1", id_uazapi: "uz-mt-3", status: "enviada", criado_em: antes(50), sugestao_quazar: "igual" },
  { id: "m-mt-4", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Qualquer coisa, me chame.", enviado_por: "JENIFER ALMEIDA",
    enviado_por_id: "u-jenifer", id_uazapi: "uz-mt-4", status: "enviada", criado_em: antes(45), sugestao_quazar: "melhorada" },
];
const PEDIDOS = [
  { id: 1, quem: "u1", conversa_id: A, tipo: "melhorar", quando: antes(56) },
  { id: 2, quem: "u1", conversa_id: A, tipo: "melhorar", quando: antes(54) },
  { id: 3, quem: "u1", conversa_id: A, tipo: "sugerir", quando: antes(51) },
  { id: 4, quem: "u-jenifer", conversa_id: A, tipo: "melhorar", quando: antes(46) },
];
const SEMENTE = {
  contatos: [CONTATO],
  conversas: [{ id: A, advogado_id: ADV, contato_id: CONTATO.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
                ultima_atividade: antes(40), esperando_desde: null, tratada_em: null, ultima_mensagem: "…", frente: null,
                digitando_ate: null, vantoro_nome: null, contato: CONTATO }],
  mensagens: MENSAGENS,
  zorvin_sugestoes: PEDIDOS,
};

// A PONTE DE MENTIRA: `melhorar` decide a resposta de cada pedido, e
// `pedidos` guarda o que chegou.
const ponte = {
  comMelhorar: true,
  melhorar: (corpo) => ({ status: 200, corpo: { ok: true, sugestao: `MELHORADO: ${corpo.texto}`, igual: false } }),
  demora: 0,
  sugestao: "Bom dia! Recebi a sua mensagem.",
  ajuste: "Texto refeito pelo pedido.",
  pedidos: [],
};
async function abrirPagina({ largura = 1400, altura = 900, celular = false, semMelhorada = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo",
                                     ...(celular ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.clock.setFixedTime(new Date(AGORA));
  // TODAS AS BANDEIRAS, SEMPRE: `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__SEM_MELHORADA = b.semMelhorada;
  }, { semente: SEMENTE, semMelhorada });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    const corpo = JSON.parse(rota.request().postData() || "{}");
    if (url.pathname.endsWith("/copiloto/estado")) {
      return json(200, { ok: true, ligado: true, modelo: "x", ajustar: true, ...(ponte.comMelhorar ? { melhorar: true } : {}) });
    }
    if (url.pathname.endsWith("/copiloto/melhorar")) {
      ponte.pedidos.push({ rota: "melhorar", ...corpo });
      if (ponte.demora) await new Promise((r) => setTimeout(r, ponte.demora));
      const r = ponte.melhorar(corpo);
      return json(r.status, r.corpo);
    }
    if (url.pathname.endsWith("/copiloto/sugerir")) {
      ponte.pedidos.push({ rota: "sugerir", ...corpo });
      return json(200, { ok: true, sugestao: ponte.sugestao });
    }
    if (url.pathname.endsWith("/copiloto/ajustar")) {
      ponte.pedidos.push({ rota: "ajustar", ...corpo });
      return json(200, { ok: true, sugestao: ponte.ajuste, licao: null });
    }
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
const CAMPO = "textarea[data-campo]";
const caixa = (page) => page.locator(CAMPO);
const naCaixa = (page) => caixa(page).inputValue().catch(() => "SEM CAIXA");
const botaoMelhorar = (page) => page.locator("[data-copiloto-melhorar]");
const botaoSugerir = (page) => page.locator("[data-copiloto-botao]");
const faixa = (page) => page.locator("[data-copiloto-frase]");
const fila = (page) => page.evaluate((id) => (globalThis.__TABELAS.fila_envio || [])
  .filter((f) => String(f.conversa_id) === String(id)).map((f) => ({ texto: f.texto, marca: f.sugestao_quazar ?? null,
    temChave: "sugestao_quazar" in f })), A);
async function esperarCaixa(page, valor, ms = 4000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if ((await naCaixa(page)) === valor) return true;
    await page.waitForTimeout(80);
  }
  return false;
}
async function esperarFaixa(page, re, ms = 4000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (re.test(await texto(faixa(page)))) return true;
    await page.waitForTimeout(80);
  }
  return false;
}
async function enviarEConferir(page, textoEsperado) {
  await apertar(caixa(page), "Enter");
  const fim = Date.now() + 4000;
  while (Date.now() < fim) {
    const f = await fila(page);
    const achou = f.find((x) => x.texto === textoEsperado);
    if (achou) return achou;
    await page.waitForTimeout(80);
  }
  return null;
}
async function abrirA(page) {
  const abriu = await clicar(page.locator(`[data-conversa-id="${A}"]`));
  await page.waitForTimeout(900);
  return abriu;
}

// ==================================================================
console.log("\n1. Com texto na caixa, o rosto do Quazar melhora; vazia, ele sugere");
{
  ponte.comMelhorar = true;
  const { ctx, page, estouros } = await abrirPagina();
  ok("abri a conversa", await abrirA(page));
  ok("caixa vazia: o rosto sugere, e não melhora",
     (await botaoSugerir(page).count()) === 1 && (await botaoMelhorar(page).count()) === 0);
  await preencher(caixa(page), "oi tudo bem o acordo ta em analize");
  await page.waitForTimeout(200);
  ok("com texto: o rosto melhora, e o de sugerir sai",
     (await botaoMelhorar(page).count()) === 1 && (await botaoSugerir(page).count()) === 0);
  ok("com o title e o nome acessível de melhorar",
     /Melhorar o texto/.test((await attr(botaoMelhorar(page), "title")) || "")
     && /Melhorar o texto com o Quazar/.test((await attr(botaoMelhorar(page), "aria-label")) || ""),
     q([await attr(botaoMelhorar(page), "title"), await attr(botaoMelhorar(page), "aria-label")]));
  const medida = await page.evaluate(() => {
    // GUARDADO: sem o botão (o painel de antes), a medida diz que não há
    // botão, e a prova segue para as conferências seguintes.
    const b = document.querySelector("[data-copiloto-melhorar]");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const campo = document.querySelector("textarea[data-campo]");
    return { pintado: !!no && b.contains(no), rosto: Boolean(b.querySelector("[data-rosto-do-assistente]")),
             alvo: Math.round(r.width), caixa: campo ? Math.round(campo.getBoundingClientRect().width) : 0 };
  }).catch(() => null);
  ok("o botão está pintado, com o rosto, no alvo de 40, e a caixa guarda o piso de 200",
     !!medida && medida.pintado && medida.rosto && medida.alvo === 40 && medida.caixa >= 200, q(medida));
  await preencher(caixa(page), "/sau");
  await page.waitForTimeout(200);
  ok("com o \"/\" das respostas rápidas, não oferece melhorar", (await botaoMelhorar(page).count()) === 0);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  ponte.comMelhorar = false;
  const { ctx, page } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "texto com a ponte de antes");
  await page.waitForTimeout(300);
  ok("a ponte de antes (sem `melhorar`) não oferece melhorar", (await botaoMelhorar(page).count()) === 0);
  await ctx.close();
  ponte.comMelhorar = true;
}

// ==================================================================
console.log("\n2. O texto melhorado entra na caixa e sai com a marca 'melhorada'");
{
  ponte.pedidos = [];
  ponte.demora = 600;
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  const original = "  oi tudo bem o acordo ta em analize  ";
  await preencher(caixa(page), original);
  ok("pediu para melhorar", await clicar(botaoMelhorar(page)));
  ok("enquanto pensa, a faixa diz que está melhorando", await esperarFaixa(page, /melhorando o seu texto/, 1500),
     q(await texto(faixa(page))));
  ok("e o botão fica desligado, girando", (await botaoMelhorar(page).isDisabled().catch(() => false)) === true);
  ok("o texto melhorado entrou na caixa", await esperarCaixa(page, `MELHORADO: ${original.trim()}`), q(await naCaixa(page)));
  const pedido = ponte.pedidos.find((p) => p.rota === "melhorar");
  ok("a ponte recebeu a conversa e o texto, sem os espaços das pontas",
     pedido && pedido.conversa_id === A && pedido.texto === original.trim(), q(pedido));
  ok("a faixa diz que o texto melhorado está na caixa", await esperarFaixa(page, /texto melhorado está na caixa/), q(await texto(faixa(page))));
  ok("com o campo de pedir uma mudança e o \"Voltar ao meu texto\"",
     (await page.locator("[data-copiloto-pedido-campo]").count()) === 1 && (await page.locator("[data-copiloto-voltar-ao-texto]").count()) === 1);
  const saiu = await enviarEConferir(page, `MELHORADO: ${original.trim()}`);
  ok("enviada: a fila leva 'melhorada'", saiu && saiu.marca === "melhorada", q(saiu));
  await page.waitForTimeout(300);
  const prov = page.locator(`[data-msg-id^="temp-"]`).last();
  ok("e a bolha que sai já tem a marca", (await prov.locator('[data-sugestao-quazar="melhorada"]').count()) === 1);
  ok("a faixa sai quando a mensagem vai", (await faixa(page).count()) === 0);

  // MEXIDA DEPOIS, CONTINUA 'melhorada'.
  ponte.demora = 0;
  await preencher(caixa(page), "segundo texto");
  await clicar(botaoMelhorar(page));
  ok("melhorou o segundo", await esperarCaixa(page, "MELHORADO: segundo texto"));
  await preencher(caixa(page), "MELHORADO: segundo texto, e mais um pedaço");
  const mexida = await enviarEConferir(page, "MELHORADO: segundo texto, e mais um pedaço");
  ok("mexida depois de melhorar: a fila continua levando 'melhorada'", mexida && mexida.marca === "melhorada", q(mexida));

  // A PRÓXIMA, ESCRITA SEM O QUAZAR, SEM MARCA.
  await preencher(caixa(page), "Escrevi sozinha.");
  const sozinha = await enviarEConferir(page, "Escrevi sozinha.");
  ok("a mensagem seguinte, sem o Quazar, sai sem marca", sozinha && !sozinha.temChave, q(sozinha));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n3. \"Voltar ao meu texto\" devolve o que a pessoa escreveu, sem marca");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "meu texto do jeito que escrevi");
  await clicar(botaoMelhorar(page));
  ok("melhorou", await esperarCaixa(page, "MELHORADO: meu texto do jeito que escrevi"));
  ok("voltou ao texto", await clicar(page.locator("[data-copiloto-voltar-ao-texto]")));
  ok("a caixa tem de novo o texto de antes", await esperarCaixa(page, "meu texto do jeito que escrevi"), q(await naCaixa(page)));
  ok("e a faixa saiu", (await faixa(page).count()) === 0);
  const saiu = await enviarEConferir(page, "meu texto do jeito que escrevi");
  ok("enviado: sem marca nenhuma", saiu && !saiu.temChave, q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n4. O texto que já estava bom fica como está, e sai sem marca");
{
  ponte.melhorar = (c) => ({ status: 200, corpo: { ok: true, sugestao: c.texto, igual: true } });
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "Bom dia! O seu acordo está em análise.");
  await clicar(botaoMelhorar(page));
  ok("a faixa diz que já estava bom", await esperarFaixa(page, /já estava bom/), q(await texto(faixa(page))));
  ok("a caixa ficou igual", (await naCaixa(page)) === "Bom dia! O seu acordo está em análise.");
  ok("sem o \"Voltar ao meu texto\" (não há o que voltar)", (await page.locator("[data-copiloto-voltar-ao-texto]").count()) === 0);
  const saiu = await enviarEConferir(page, "Bom dia! O seu acordo está em análise.");
  ok("enviado: sem marca (o texto é todo da pessoa)", saiu && !saiu.temChave, q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
  ponte.melhorar = (c) => ({ status: 200, corpo: { ok: true, sugestao: `MELHORADO: ${c.texto}`, igual: false } });
}

// ==================================================================
console.log("\n5. Quem continua escrevendo enquanto o Quazar pensa não perde nada");
{
  ponte.demora = 900;
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "primeira parte");
  await clicar(botaoMelhorar(page));
  await page.waitForTimeout(150);
  await preencher(caixa(page), "primeira parte, e continuei escrevendo");
  ok("a faixa diz que o texto melhorado chegou depois", await esperarFaixa(page, /chegou depois que você mexeu na caixa/, 3000),
     q(await texto(faixa(page))));
  ok("e o que a pessoa escreveu ficou na caixa", (await naCaixa(page)) === "primeira parte, e continuei escrevendo");
  ok("com o botão de usar o texto melhorado", /Usar o texto melhorado/.test(await texto(page.locator("[data-copiloto-usar]"))));
  await clicar(page.locator("[data-copiloto-usar]"));
  ok("usado, ele entra na caixa", await esperarCaixa(page, "MELHORADO: primeira parte"), q(await naCaixa(page)));
  const saiu = await enviarEConferir(page, "MELHORADO: primeira parte");
  ok("e sai com a marca 'melhorada'", saiu && saiu.marca === "melhorada", q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
  ponte.demora = 0;
}

// ==================================================================
console.log("\n5b. Trocar de conversa enquanto o Quazar pensa: o texto melhorado fica na conversa dele");
{
  ponte.demora = 900;
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "texto da conversa A");
  await clicar(botaoMelhorar(page));
  await page.waitForTimeout(150);
  const outra = page.locator(`[data-conversa-id]:not([data-conversa-id="${A}"])`).first();
  ok("abri outra conversa no meio", await clicar(outra));
  await page.waitForTimeout(1400);
  ok("a caixa da outra conversa não recebeu o texto melhorado", !/MELHORADO/.test(await naCaixa(page)), q(await naCaixa(page)));
  await abrirA(page);
  ok("de volta à conversa A, o texto melhorado está na caixa dela", await esperarCaixa(page, "MELHORADO: texto da conversa A"),
     q(await naCaixa(page)));
  const saiu = await enviarEConferir(page, "MELHORADO: texto da conversa A");
  ok("e sai com a marca 'melhorada'", saiu && saiu.marca === "melhorada", q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
  ponte.demora = 0;
}

// ==================================================================
console.log("\n6. A falha é dita, e a caixa fica");
{
  ponte.melhorar = () => ({ status: 502, corpo: { ok: false, erro: "O Quazar não conseguiu responder agora. Tente de novo." } });
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "texto que não vai ser melhorado");
  await clicar(botaoMelhorar(page));
  ok("a faixa diz a frase da ponte", await esperarFaixa(page, /não conseguiu responder agora/), q(await texto(faixa(page))));
  ok("e a caixa continua com o texto", (await naCaixa(page)) === "texto que não vai ser melhorado");
  const saiu = await enviarEConferir(page, "texto que não vai ser melhorado");
  ok("enviado depois da falha: sem marca", saiu && !saiu.temChave, q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
  ponte.melhorar = (c) => ({ status: 200, corpo: { ok: true, sugestao: `MELHORADO: ${c.texto}`, igual: false } });
}

// ==================================================================
console.log("\n7. O \"Pedir uma mudança\" depois de melhorar continua 'melhorada'");
{
  ponte.pedidos = [];
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "texto para mudar depois");
  await clicar(botaoMelhorar(page));
  ok("melhorou", await esperarCaixa(page, "MELHORADO: texto para mudar depois"));
  await preencher(page.locator("[data-copiloto-pedido-campo]"), "deixe mais curto");
  await apertar(page.locator("[data-copiloto-pedido-campo]"), "Enter");
  ok("a mensagem refeita entrou na caixa", await esperarCaixa(page, ponte.ajuste), q(await naCaixa(page)));
  const aj = ponte.pedidos.find((p) => p.rota === "ajustar");
  ok("o pedido levou o texto melhorado como a mensagem de agora", aj && aj.sugestao === "MELHORADO: texto para mudar depois", q(aj));
  ok("e o \"Voltar ao meu texto\" continua, para o texto que a pessoa escreveu",
     (await page.locator("[data-copiloto-voltar-ao-texto]").count()) === 1);
  const saiu = await enviarEConferir(page, ponte.ajuste);
  ok("enviada: 'melhorada', e não 'igual'", saiu && saiu.marca === "melhorada", q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n8. O \"Sugerir resposta\" depois de melhorar continua 'igual'");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirA(page);
  await preencher(caixa(page), "texto que vai ser apagado");
  await clicar(botaoMelhorar(page));
  ok("melhorou", await esperarCaixa(page, "MELHORADO: texto que vai ser apagado"));
  await preencher(caixa(page), "");
  await page.waitForTimeout(250);
  await preencher(caixa(page), "Reescrevi à mão.");
  const aMao = await enviarEConferir(page, "Reescrevi à mão.");
  ok("apagou o texto melhorado e escreveu à mão: sem marca", aMao && !aMao.temChave, q(aMao));
  await page.waitForTimeout(250);
  ok("caixa vazia, e o rosto voltou a sugerir", await clicar(botaoSugerir(page)));
  ok("a sugestão entrou", await esperarCaixa(page, ponte.sugestao), q(await naCaixa(page)));
  const saiu = await enviarEConferir(page, ponte.sugestao);
  ok("enviada como o Quazar sugeriu: 'igual'", saiu && saiu.marca === "igual", q(saiu));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n9. Numa conversa estreita, o caminho é o ⋮");
{
  const { ctx, page, estouros } = await abrirPagina({ largura: 900 });
  await abrirA(page);
  await preencher(caixa(page), "texto numa janela pequena");
  await page.waitForTimeout(200);
  const larguraDaCaixa = await page.evaluate(() => Math.round(document.querySelector("textarea[data-campo]")?.getBoundingClientRect().width ?? 0)).catch(() => 0);
  ok("a 900, o rosto não entra na barra, e a caixa guarda o piso de 200",
     (await botaoMelhorar(page).count()) === 0 && larguraDaCaixa >= 200, q(larguraDaCaixa));
  ok("abriu o ⋮ do cabeçalho", await clicar(page.getByRole("button", { name: "Mais opções desta conversa" })));
  await page.waitForTimeout(300);
  ok("o ⋮ tem “Melhorar o texto”", /Melhorar o texto/.test(await texto(page.locator("[data-copiloto-melhorar-item]"))));
  await clicar(page.locator("[data-copiloto-melhorar-item]"));
  ok("e por ele o texto melhora", await esperarCaixa(page, "MELHORADO: texto numa janela pequena"), q(await naCaixa(page)));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
// A FRONTEIRA DA RÉGUA: o rosto entra na barra com a conversa de 540 pontos
// ou mais, e a caixa guarda o piso de 200 dos dois lados dela. Entre 540 e
// 590 o cabeçalho ainda recolhe no ⋮, e o ⋮ não repete o item que está na
// barra. A conversa é a janela menos a barra lateral (60) e a lista (360),
// sem a ficha: a bancada não tem Vantoro. A caixa é medida.
for (const largura of [920, 940, 960, 980, 1000, 1020]) {
  const { ctx, page } = await abrirPagina({ largura });
  await abrirA(page);
  await preencher(caixa(page), "texto na fronteira");
  await page.waitForTimeout(250);
  const m = { conversa: largura - 420,
              caixa: await page.evaluate(() => Math.round(document.querySelector("textarea[data-campo]")?.getBoundingClientRect().width ?? 0)).catch(() => 0) };
  const naBarra = (await botaoMelhorar(page).count()) === 1;
  ok(`a ${largura} (conversa ${m.conversa}): o rosto ${m.conversa >= 540 ? "na barra" : "fora da barra"}, e a caixa com o piso de 200`,
     naBarra === (m.conversa >= 540) && m.caixa >= 200, q({ ...m, naBarra }));
  const abriu = await clicar(page.getByRole("button", { name: "Mais opções desta conversa" }));
  await page.waitForTimeout(300);
  const item = (await page.locator("[data-copiloto-melhorar-item]").count()) === 1;
  if (m.conversa < 590) {
    ok(`a ${largura}: o ⋮ existe, e tem o item só quando o rosto não está na barra`, abriu && item === !naBarra, q({ abriu, item, naBarra }));
  }
  await ctx.close();
}

// ==================================================================
console.log("\n10. No celular, o \"+\" e o ⋮ dizem “Melhorar o texto”");
{
  const { ctx, page, estouros } = await abrirPagina({ largura: 390, altura: 844, celular: true });
  ok("abri a conversa", await abrirA(page));
  const CAMPO_CEL = 'textarea[data-campo="mensagem"]';
  ok("no celular, a barra não tem o rosto", (await botaoMelhorar(page).count()) === 0);
  await clicar(page.locator("[data-mais]"));
  await page.waitForTimeout(300);
  ok("caixa vazia: o \"+\" oferece “Sugerir resposta”",
     /Sugerir resposta/.test(await texto(page.locator("[data-painel-do-mais] [data-copiloto-no-mais]"))));
  await clicar(page.locator("[data-mais]"));
  await page.waitForTimeout(200);
  await preencher(page.locator(CAMPO_CEL), "texto escrito no celular");
  await clicar(page.locator("[data-mais]"));
  await page.waitForTimeout(300);
  const opcao = page.locator("[data-painel-do-mais] [data-copiloto-melhorar-no-mais]");
  ok("com texto: o \"+\" oferece “Melhorar o texto”", /Melhorar o texto/.test(await texto(opcao)), q(await texto(opcao)));
  await clicar(opcao);
  ok("e por ele o texto melhora", await esperarCaixa(page, "MELHORADO: texto escrito no celular"), q(await naCaixa(page)));
  ok("o \"+\" fechou", (await page.locator("[data-painel-do-mais]").count()) === 0);
  await preencher(page.locator(CAMPO_CEL), "outro texto");
  await page.waitForTimeout(200);
  ok("abriu o ⋮", await clicar(page.getByRole("button", { name: "Mais opções desta conversa" })));
  await page.waitForTimeout(300);
  ok("o ⋮ do celular também tem “Melhorar o texto”", /Melhorar o texto/.test(await texto(page.locator("[data-copiloto-melhorar-item]"))));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n11. O banco sem o 063: a mensagem sai, sem a marca");
{
  const { ctx, page, estouros } = await abrirPagina({ semMelhorada: true });
  await abrirA(page);
  await preencher(caixa(page), "texto num banco de antes");
  await clicar(botaoMelhorar(page));
  ok("melhorou", await esperarCaixa(page, "MELHORADO: texto num banco de antes"));
  const saiu = await enviarEConferir(page, "MELHORADO: texto num banco de antes");
  ok("a mensagem entrou na fila, sem a marca que o banco recusa", saiu && !saiu.temChave, q(saiu));
  ok("sem bolha de erro de envio", (await page.locator('[data-estado-do-envio="erro"]').count()) === 0);
  await page.waitForTimeout(300);
  ok("pediu uma sugestão", await clicar(botaoSugerir(page)));
  ok("a sugestão entrou", await esperarCaixa(page, ponte.sugestao));
  const sug = await enviarEConferir(page, ponte.sugestao);
  ok("e a do \"Sugerir resposta\" continua marcada ('igual')", sug && sug.marca === "igual", q(sug));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n12. O relatório conta os textos melhorados");
{
  const R = "[data-relatorio-sugestoes]";
  const { ctx, page, estouros } = await abrirPagina();
  await abrirATela(page, "painel", { prazo: 10000 });
  await page.waitForTimeout(1800);
  const cartao = (c) => page.locator(`${R} [data-cartao-da-sugestao="${c}"]`);
  ok("o cartão dos textos melhorados: 2", (await texto(cartao("melhoradas").locator("[data-valor]"))) === "2",
     q(await texto(cartao("melhoradas"))));
  ok("com os 3 pedidos de “Melhorar o texto”", /3 pedidos de “Melhorar o texto”/.test(await texto(cartao("melhoradas"))),
     q(await texto(cartao("melhoradas"))));
  ok("as enviadas com a sugestão não contam as melhoradas (1)", (await texto(cartao("usadas").locator("[data-valor]"))) === "1",
     q(await texto(cartao("usadas"))));
  const linha = (nome) => page.locator(`${R} [data-pessoa-da-sugestao="${nome}"]`);
  ok("a linha de quem entrou: 1 melhorada; a da Jenifer: 1",
     (await attr(linha("Rodrigo Sousa").locator("[data-melhoradas]"), "data-melhoradas")) === "1"
     && (await attr(linha("JENIFER ALMEIDA").locator("[data-melhoradas]"), "data-melhoradas")) === "1");
  const escritas = await page.evaluate(() => {
    const t1 = Date.now(), t0 = t1 - 30 * 86400e3;
    const conv = new Map((globalThis.__TABELAS.conversas || []).map((c) => [String(c.id), c]));
    let n = 0;
    for (const m of globalThis.__TABELAS.mensagens || []) {
      const q = new Date(m.criado_em).getTime(), c = conv.get(String(m.conversa_id));
      if (!c || c.arquivada || q < t0 || q > t1 || m.origem !== "advogado" || (m.tipo || "texto") !== "texto"
          || !m.enviado_por_id || m.automatica) continue;
      n++;
    }
    return n;
  });
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  ok(`a parte das escritas conta as sugeridas e as melhoradas: 3 de ${escritas}`,
     (await texto(cartao("parte").locator("[data-valor]"))) === pct(3, escritas)
     && new RegExp(`3 de ${escritas}`).test(await texto(cartao("parte"))), q([await texto(cartao("parte")), escritas]));
  ok("os oito cabeçalhos são botões de ordenar", (await page.locator(`${R} [data-ordenar-sugestoes]`).count()) === 8);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
