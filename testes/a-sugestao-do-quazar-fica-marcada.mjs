// O "SUGERIR RESPOSTA" FICA MARCADO, E TEM RELATÓRIO (18/11) — a metade do painel.
//
// Pedido do Rodrigo: *"Quando for usado o 'Sugerir resposta' eu preciso saber
// que o usuário usou essa opção, tem que aparecer de alguma forma
// discretamente na mensagem (apenas para a equipe, não para o contato).
// Preciso também de um relatório para isso."*
//
// A ponte copia a marca da fila para a mensagem e anota cada pedido (script
// 060, provado lá). O que esta prova guarda é o que é da tela:
//
//   1. a mensagem que sai como o Quazar escreveu vai à fila com 'igual'; a que
//      a pessoa mexeu, com 'editada'; a que ela apagou e escreveu sozinha, e a
//      escrita sem o Quazar, sem marca nenhuma; a bolha que sai já mostra;
//   2. na conversa, o rosto pequeno do Quazar ao lado da hora, com o title
//      que diz qual das duas; e nada na mensagem sem a marca;
//   3. o banco sem o 060: a mensagem sai assim mesmo, sem a marca;
//   4. o relatório no Painel de números: os cartões e a linha de cada pessoa;
//      a falta da função dita a quem administra; a falha, com o código.
import { abrirNavegador, ENDERECO, abrirATela } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const AGORA = Date.parse("2026-11-18T10:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const CAMPO = "textarea[data-campo]";

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

const CONTATO = { id: "ct-sq", numero: "5511948230311", nome: "Cliente da Sugestão", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const A = "cv-sq";
const MARCADAS = [
  { id: "m-sq-1", conversa_id: A, origem: "contato", tipo: "texto", texto: "Bom dia, e o acordo?", id_uazapi: "uz-sq-1", criado_em: antes(60) },
  { id: "m-sq-2", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Bom dia! O acordo está em análise.", enviado_por: "Rodrigo Sousa",
    enviado_por_id: "u1", id_uazapi: "uz-sq-2", status: "enviada", criado_em: antes(55), sugestao_quazar: "igual" },
  { id: "m-sq-3", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Te aviso amanhã, combinado?", enviado_por: "Rodrigo Sousa",
    enviado_por_id: "u1", id_uazapi: "uz-sq-3", status: "enviada", criado_em: antes(50), sugestao_quazar: "editada" },
  { id: "m-sq-4", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Qualquer coisa, me chame.", enviado_por: "Rodrigo Sousa",
    enviado_por_id: "u1", id_uazapi: "uz-sq-4", status: "enviada", criado_em: antes(45) },
  { id: "m-sq-5", conversa_id: A, origem: "advogado", tipo: "texto", texto: "Bom dia, tudo certo por aí?", enviado_por: "JENIFER ALMEIDA",
    enviado_por_id: "u-jenifer", id_uazapi: "uz-sq-5", status: "enviada", criado_em: antes(40), sugestao_quazar: "igual" },
];
const PEDIDOS = [
  { id: 1, quem: "u1", conversa_id: A, tipo: "sugerir", quando: antes(56) },
  { id: 2, quem: "u1", conversa_id: A, tipo: "sugerir", quando: antes(51) },
  { id: 3, quem: "u1", conversa_id: A, tipo: "ajustar", quando: antes(50.5) },
  { id: 4, quem: "u1", conversa_id: A, tipo: "sugerir", quando: antes(30) },
  { id: 5, quem: "u-jenifer", conversa_id: A, tipo: "sugerir", quando: antes(41) },
];
const SEMENTE = {
  contatos: [CONTATO],
  conversas: [{ id: A, advogado_id: ADV, contato_id: CONTATO.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
                ultima_atividade: antes(40), esperando_desde: null, tratada_em: null, ultima_mensagem: "…", frente: null,
                digitando_ate: null, vantoro_nome: null, contato: CONTATO }],
  mensagens: MARCADAS,
  zorvin_sugestoes: PEDIDOS,
};

const ponte = { sugestao: "Bom dia! Recebi a sua mensagem." };
async function abrirPagina({ semColunas = null, semSugestoes = false, sugestoesFalha = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.clock.setFixedTime(new Date(AGORA));
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__SEM_COLUNAS = b.semColunas || {};
    globalThis.__SEM_SUGESTOES = b.semSugestoes;
    globalThis.__SUGESTOES_FALHA = b.sugestoesFalha;
  }, { semente: SEMENTE, semColunas, semSugestoes, sugestoesFalha });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(200, { ok: true, ligado: true, modelo: "x" });
    if (url.pathname.endsWith("/copiloto/sugerir")) return json(200, { ok: true, sugestao: ponte.sugestao });
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
const caixa = (page) => page.locator(CAMPO);
const naCaixa = (page) => caixa(page).inputValue().catch(() => "SEM CAIXA");
const fila = (page) => page.evaluate((id) => (globalThis.__TABELAS.fila_envio || [])
  .filter((f) => String(f.conversa_id) === String(id)).map((f) => ({ texto: f.texto, marca: f.sugestao_quazar ?? null,
    temChave: "sugestao_quazar" in f })), A);
async function sugerir(page) {
  if (!(await clicar(page.locator("[data-copiloto-botao]")))) return false;
  const fim = Date.now() + 4000;
  while (Date.now() < fim) {
    if ((await naCaixa(page)) === ponte.sugestao) return true;
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

// ==================================================================
console.log("\n1. A mensagem que sai do \"Sugerir resposta\" vai marcada");
{
  const { ctx, page, estouros } = await abrirPagina();
  ok("abri a conversa", await clicar(page.locator(`[data-conversa-id="${A}"]`)));
  await page.waitForTimeout(900);

  ok("a sugestão entrou na caixa", await sugerir(page), q(await naCaixa(page)));
  const igual = await enviarEConferir(page, ponte.sugestao);
  ok("enviada como o Quazar escreveu: a fila leva 'igual'", igual && igual.marca === "igual", q(igual));
  await page.waitForTimeout(300);
  const prov = page.locator(`[data-msg-id^="temp-"]`).last();
  ok("e a bolha que sai já tem a marca", (await prov.locator('[data-sugestao-quazar="igual"]').count()) === 1);

  ponte.sugestao = "Boa tarde! Vou verificar o seu acordo.";
  ok("pediu outra sugestão", await sugerir(page), q(await naCaixa(page)));
  await preencher(caixa(page), `${ponte.sugestao} Abraço!`);
  const editada = await enviarEConferir(page, `${ponte.sugestao} Abraço!`);
  ok("mexeu antes de mandar: a fila leva 'editada'", editada && editada.marca === "editada", q(editada));

  ponte.sugestao = "Olá! Recebido.";
  ok("pediu mais uma", await sugerir(page), q(await naCaixa(page)));
  await preencher(caixa(page), "");
  await page.waitForTimeout(200);
  await preencher(caixa(page), "Escrevi tudo sozinha.");
  const sozinha = await enviarEConferir(page, "Escrevi tudo sozinha.");
  ok("apagou a sugestão e escreveu sozinha: sem marca nenhuma", sozinha && !sozinha.temChave, q(sozinha));

  await preencher(caixa(page), "Sem o Quazar.");
  const sem = await enviarEConferir(page, "Sem o Quazar.");
  ok("e a escrita sem o Quazar, também sem marca", sem && !sem.temChave, q(sem));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Na conversa, o rosto pequeno do Quazar ao lado da hora");
{
  const { ctx, page, estouros } = await abrirPagina();
  await clicar(page.locator(`[data-conversa-id="${A}"]`));
  await page.waitForTimeout(1200);
  const marca = (id) => page.locator(`[data-msg-id="${id}"] [data-sugestao-quazar]`);
  ok("a mensagem sem mudança tem a marca 'igual'", (await attr(marca("m-sq-2"), "data-sugestao-quazar")) === "igual");
  ok("com o title que diz que saiu sem mudanças, e só para a equipe",
     /Sugerir resposta/.test((await attr(marca("m-sq-2"), "title")) || "") && /sem mudanças/.test((await attr(marca("m-sq-2"), "title")) || "")
     && /Só a equipe vê/.test((await attr(marca("m-sq-2"), "title")) || ""), q(await attr(marca("m-sq-2"), "title")));
  ok("a editada tem a marca 'editada', e o title diz isso",
     (await attr(marca("m-sq-3"), "data-sugestao-quazar")) === "editada" && /editada por quem enviou/.test((await attr(marca("m-sq-3"), "title")) || ""),
     q(await attr(marca("m-sq-3"), "title")));
  ok("a escrita sem o Quazar não tem marca", (await marca("m-sq-4").count()) === 0);
  ok("a do cliente também não", (await marca("m-sq-1").count()) === 0);
  const medida = await page.evaluate(() => {
    const el = document.querySelector('[data-msg-id="m-sq-2"] [data-sugestao-quazar] [data-rosto-do-assistente]');
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const hora = el.closest("[data-estado-do-envio]");
    return { w: Math.round(r.width), pintado: !!no && el.contains(no), naLinhaDaHora: Boolean(hora),
             aria: el.getAttribute("aria-label") };
  });
  ok("o rosto é pequeno (13 pontos), está pintado, na linha da hora, com nome acessível",
     medida && medida.w === 13 && medida.pintado && medida.naLinhaDaHora && /Sugerir resposta/.test(medida.aria || ""), q(medida));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n3. O banco sem o 060: a mensagem sai assim mesmo, sem a marca");
{
  ponte.sugestao = "Bom dia! Já confiro.";
  const { ctx, page, estouros } = await abrirPagina({ semColunas: { fila_envio: ["sugestao_quazar"] } });
  await clicar(page.locator(`[data-conversa-id="${A}"]`));
  await page.waitForTimeout(900);
  ok("a sugestão entrou", await sugerir(page));
  const saiu = await enviarEConferir(page, ponte.sugestao);
  ok("e a mensagem entrou na fila sem a coluna que falta", saiu && !saiu.temChave, q(saiu));
  ok("sem faixa de erro de envio", (await page.locator('[data-estado-do-envio="erro"]').count()) === 0);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n4. O relatório no Painel de números");
const R = "[data-relatorio-sugestoes]";
const cartao = (page, c) => page.locator(`${R} [data-cartao-da-sugestao="${c}"] [data-valor]`);
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirATela(page, "painel", { prazo: 10000 });
  await page.waitForTimeout(1800);
  ok("a seção existe, com o título do Quazar", /Sugerir resposta/.test(await texto(page.locator(R))) && (await page.locator(`${R} [data-rosto-do-assistente]`).count()) >= 1);
  ok("4 sugestões pedidas", (await texto(cartao(page, "pedidas"))) === "4", q(await texto(cartao(page, "pedidas"))));
  ok("e 1 mudança pedida", /1 mudança pedida/.test(await texto(page.locator(`${R} [data-cartao-da-sugestao="pedidas"]`))));
  ok("3 enviadas com a sugestão (75% das pedidas)", (await texto(cartao(page, "usadas"))) === "3"
     && /75%/.test(await texto(page.locator(`${R} [data-cartao-da-sugestao="usadas"]`))), q(await texto(page.locator(`${R} [data-cartao-da-sugestao="usadas"]`))));
  ok("2 sem mudança e 1 editada", (await texto(cartao(page, "iguais-editadas"))).replace(/\s+/g, " ") === "2 · 1", q(await texto(cartao(page, "iguais-editadas"))));
  // AS ESCRITAS SÃO TODAS AS MENSAGENS DE TEXTO DA EQUIPE NO PERÍODO, e a
  // bancada já traz muitas de quem entrou: a conta esperada sai dela, pela
  // régua da função (texto, com quem enviou, não automática, 30 dias).
  const escritas = await page.evaluate(() => {
    const t1 = Date.now(), t0 = t1 - 30 * 86400e3;
    const conv = new Map((globalThis.__TABELAS.conversas || []).map((c) => [String(c.id), c]));
    const n = {};
    for (const m of globalThis.__TABELAS.mensagens || []) {
      const q = new Date(m.criado_em).getTime(), c = conv.get(String(m.conversa_id));
      if (!c || c.arquivada || q < t0 || q > t1 || m.origem !== "advogado" || (m.tipo || "texto") !== "texto"
          || !m.enviado_por_id || m.automatica) continue;
      n[m.enviado_por_id] = (n[m.enviado_por_id] || 0) + 1;
    }
    return n;
  });
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const total = Object.values(escritas).reduce((a, b) => a + b, 0);
  ok(`a parte das mensagens escritas: 3 de ${total}`, (await texto(cartao(page, "parte"))) === pct(3, total)
     && new RegExp(`3 de ${total}`).test(await texto(page.locator(`${R} [data-cartao-da-sugestao="parte"]`))),
     q([await texto(cartao(page, "parte")), escritas]));
  const linha = (nome) => page.locator(`${R} [data-pessoa-da-sugestao="${nome}"]`);
  const eu = { pedidas: await attr(linha("Rodrigo Sousa").locator("[data-pedidas]"), "data-pedidas"),
               usadas: await attr(linha("Rodrigo Sousa").locator("[data-usadas]"), "data-usadas"),
               parte: await attr(linha("Rodrigo Sousa").locator("[data-parte]"), "data-parte") };
  ok("a linha de quem entrou: 3 pedidas, 2 enviadas, e a parte das escritas dela",
     eu.pedidas === "3" && eu.usadas === "2" && eu.parte === pct(2, escritas.u1 || 0), q([eu, escritas.u1]));
  ok("a linha da Jenifer: 1 pedida, 1 enviada, e a parte das escritas dela",
     (await attr(linha("JENIFER ALMEIDA").locator("[data-usadas]"), "data-usadas")) === "1"
     && (await attr(linha("JENIFER ALMEIDA").locator("[data-parte]"), "data-parte")) === pct(1, escritas["u-jenifer"] || 0),
     q([await attr(linha("JENIFER ALMEIDA").locator("[data-parte]"), "data-parte"), escritas["u-jenifer"]]));
  // A ORDEM DA TABELA (19/11): clicar no cabeçalho ordena, clicar de novo inverte.
  const ordemDasLinhas = () => page.locator(`${R} [data-pessoa-da-sugestao]`).evaluateAll((ls) => ls.map((l) => l.getAttribute("data-pessoa-da-sugestao")));
  const cab = (id) => page.locator(`${R} [data-ordenar-sugestoes="${id}"]`);
  const sortDe = (id) => attr(page.locator(`${R} th:has([data-ordenar-sugestoes="${id}"])`), "aria-sort");
  const chegou = async (esperada) => { for (let i = 0; i < 20; i++) { if (q(await ordemDasLinhas()) === q(esperada)) return true; await page.waitForTimeout(100); } return false; };
  ok("os oito cabeçalhos são botões de ordenar (com os textos melhorados, 24/11)", (await page.locator(`${R} [data-ordenar-sugestoes]`).count()) === 8);
  ok("de começo, quem pediu mais vem primeiro (▼ em Pedidas)",
     (await chegou(["Rodrigo Sousa", "JENIFER ALMEIDA"])) && (await sortDe("pedidas")) === "descending"
     && /▼/.test(await texto(cab("pedidas"))), q(await ordemDasLinhas()));
  await clicar(cab("pedidas"));
  ok("clicar de novo em Pedidas inverte: do menor para o maior (▲)",
     (await chegou(["JENIFER ALMEIDA", "Rodrigo Sousa"])) && (await sortDe("pedidas")) === "ascending"
     && /▲/.test(await texto(cab("pedidas"))), q(await ordemDasLinhas()));
  await clicar(cab("nome"));
  ok("Pessoa ordena pelo nome, de A a Z, e as outras colunas perdem a seta",
     (await chegou(["JENIFER ALMEIDA", "Rodrigo Sousa"])) && (await sortDe("nome")) === "ascending"
     && (await sortDe("pedidas")) === "none" && !/[▲▼]/.test(await texto(cab("pedidas"))), q(await ordemDasLinhas()));
  await clicar(cab("nome"));
  ok("e de Z a A no segundo clique", (await chegou(["Rodrigo Sousa", "JENIFER ALMEIDA"])) && (await sortDe("nome")) === "descending", q(await ordemDasLinhas()));
  await clicar(cab("usadas"));
  ok("uma coluna nova começa pelo maior (Enviadas: 2 antes de 1)",
     (await chegou(["Rodrigo Sousa", "JENIFER ALMEIDA"])) && (await sortDe("usadas")) === "descending", q(await ordemDasLinhas()));
  await clicar(cab("usadas"));
  ok("e inverte no segundo clique", (await chegou(["JENIFER ALMEIDA", "Rodrigo Sousa"])) && (await sortDe("usadas")) === "ascending", q(await ordemDasLinhas()));
  ok("ordenar não escolhe ninguém (a tela não se recorta numa pessoa)",
     (await page.locator(`${R} [data-pessoa-da-sugestao]`).count()) === 2, q(await ordemDasLinhas()));
  ok("a seção está no menu de imprimir e nos atalhos", (await page.locator('[data-nav-do-painel] button, [data-nav-do-painel] a').filter({ hasText: "Sugerir resposta" }).count()) >= 1);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  const { ctx, page } = await abrirPagina({ semSugestoes: true });
  await abrirATela(page, "painel", { prazo: 10000 });
  await page.waitForTimeout(1500);
  ok("sem o 060, quem administra lê que falta a atualização", /Falta uma atualização no banco/.test(await texto(page.locator(`${R} [data-sugestoes-falta]`))));
  await ctx.close();
}
{
  const { ctx, page } = await abrirPagina({ sugestoesFalha: true });
  await abrirATela(page, "painel", { prazo: 10000 });
  await page.waitForTimeout(1500);
  ok("a função que falha é dita, com o código", /código 57014/.test(await texto(page.locator(`${R} [data-sugestoes-erro]`))),
     q(await texto(page.locator(`${R} [data-sugestoes-erro]`))));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
