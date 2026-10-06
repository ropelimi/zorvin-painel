// TAREFAS E LEMBRETES (06/10) — o terceiro passo para CRM, depois do
// responsável e do funil.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. sem o script 018, NADA das tarefas aparece: nem o sino da barra, nem o
//      item do menu, nem o selo na conversa, nem o filtro;
//   2. criar pela conversa grava o texto, a hora, a conversa e a pessoa — e a
//      frase diz para quem e quando; para um colega, grava o colega;
//   3. a janela não aceita sem texto, nem hora que já passou;
//   4. concluir, reabrir, editar e apagar gravam, e a frase espera o banco;
//      o banco que recusa (calado ou com código) é DITO, e nunca "concluída";
//   5. a falha ao criar fica NA JANELA, que continua aberta;
//   6. o número da barra conta atrasadas e de hoje — as MINHAS, não as dos
//      colegas;
//   7. o aviso na hora toca para QUEM RECEBEU, uma vez só (recarregar não
//      toca de novo), e não toca a tarefa vencida há mais de 12 horas;
//   8. a tela de tarefas separa Minhas e Da equipe, conta cada pessoa, e a
//      leitura que falha diz que falhou, com o código;
//   9. o filtro "Com tarefa para hoje" mostra só as conversas com tarefa que
//      vence hoje ou já venceu;
//  10. o cartão do funil diz a tarefa atrasada do cliente;
//  11. os selos da linha do número NÃO se sobrepõem — e foi esta prova que
//      achou a sobreposição que o funil tinha deixado a 1400 com a ficha;
//  12. no celular, as tarefas vão pelo ⋮.
//
// OS CLIENTES E AS TAREFAS SÃO PLANTADOS (`__SEMENTE`), num telefone
// descoberto — ver `o-funil-de-etapas`.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (globalThis.__TABELAS.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    return a ? { adv: a.id, dep: a.departamento_id } : null;
  });
  await ctx.close();
  return r;
}

const ABRE = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ABRE), JSON.stringify(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, dep: DEP } = ABRE;

const agora = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const NOMES = { a: "TAREFA ANA ATRASADA", b: "TAREFA BRUNO AMANHA", c: "TAREFA CARLA LIVRE", d: "TAREFA DIEGO COLEGA" };
const contato = (k, n) => ({ id: `ct-t${k}`, numero: `55119700055${n}`, nome: NOMES[k], vantoro_nome: null,
                              nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k, n) => ({
  id: `cv-t${k}`, advogado_id: ADV, contato_id: `ct-t${k}`, nao_lidas: 0,
  arquivada: false, fixada: false, favorita: false, ultima_atividade: iso(agora - n * 60e3), ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-t${k}`, nome: NOMES[k], numero: `55119700055${n}`, foto_url: null },
});
const tarefa = (id, k, texto, vence, para, extra = {}) => ({
  id, conversa_id: `cv-t${k}`, texto, vence_em: iso(vence), para_quem: para,
  criada_por: "u1", criada_em: iso(agora - 86400e3), feita_em: null, feita_por: null, ...extra,
});
// A DE HOJE QUE AINDA NÃO VENCEU só existe se ainda houver dia: perto da
// meia-noite ela cairia amanhã e a conta de "hoje" mediria outra coisa.
const fimDoDia = new Date(agora); fimDoDia.setHours(23, 59, 0, 0);
const TEM_HOJE = fimDoDia.getTime() - agora > 10 * 60e3;
const SEMENTE = {
  contatos: ["a", "b", "c", "d"].map((k, i) => contato(k, `0${i + 1}`)),
  conversas: ["a", "b", "c", "d"].map((k, i) => conversa(k, i + 1)),
  mensagens: ["a", "b", "c", "d"].map((k) => ({ id: `m-t${k}`, conversa_id: `cv-t${k}`, origem: "contato",
                                               tipo: "texto", texto: "oi", criado_em: iso(agora - 3600e3) })),
  zorvin_tarefas: [
    // MINHA, venceu há 40 min: atrasada, e toca ao abrir (dentro das 12h).
    tarefa("tf-1", "a", "Ligar para a Ana confirmar o acordo", agora - 40 * 60e3, "u1"),
    // MINHA, vence amanhã: não conta no número, não toca.
    tarefa("tf-2", "b", "Cobrar o comprovante do Bruno", agora + 26 * 3600e3, "u1"),
    // DA COLEGA, venceu há 20 min: atrasada para ela, e NÃO toca para mim.
    tarefa("tf-3", "d", "Mandar a minuta para o Diego", agora - 20 * 60e3, "u-jenifer"),
    // MINHA, venceu há 30 horas: atrasada, conta, mas NÃO toca (fora da janela).
    tarefa("tf-4", "a", "Tarefa velha de ontem", agora - 30 * 3600e3, "u1"),
    // MINHA E JÁ FEITA: não conta em lugar nenhum.
    tarefa("tf-5", "c", "Já resolvido com a Carla", agora - 2 * 3600e3, "u1",
           { feita_em: iso(agora - 3600e3), feita_por: "u1" }),
    ...(TEM_HOJE ? [tarefa("tf-6", "c", "Retornar para a Carla hoje", agora + 5 * 60e3, "u1")] : []),
  ],
};

async function abrirPainel({ semTarefas = false, semEfeito = [], erroNaGravacao = {}, recusarLeitura = [],
                             largura = 1920, altura = 900, avisadas = null, semente = SEMENTE,
                             ficha = "nao" } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_TAREFAS = d.semTarefas;
    globalThis.__ESCRITA_SEM_EFEITO = d.semEfeito;
    globalThis.__ERRO_NA_GRAVACAO = d.erroNaGravacao;
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura;
    try {
      localStorage.setItem("zorvin_ficha_fixa", d.ficha);
      if (d.avisadas) localStorage.setItem("zorvin-tarefas-avisadas", JSON.stringify(d.avisadas));
      else if (!sessionStorage.getItem("ja-abri")) localStorage.removeItem("zorvin-tarefas-avisadas");
      sessionStorage.setItem("ja-abri", "1");
    } catch (_) { /* sem armazenamento */ }
    // A NOTIFICAÇÃO É ESPIONADA, e não desligada: uma bancada que a calasse
    // aprovaria um painel que nunca avisa ninguém.
    globalThis.__NOTIFICACOES = [];
    globalThis.Notification = class {
      constructor(titulo, opc) { globalThis.__NOTIFICACOES.push({ titulo, corpo: opc && opc.body }); }
      static get permission() { return "granted"; }
      static requestPermission() { return Promise.resolve("granted"); }
    };
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente, semTarefas, semEfeito, erroNaGravacao, recusarLeitura, avisadas, ficha });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
/** Abre o menu das tarefas da conversa SÓ se estiver fechado: o selo é um
 *  interruptor, e clicar com o menu aberto o fecharia. */
async function menuDasTarefas(page) {
  if (await page.locator("[data-menu-tarefas]").isVisible().catch(() => false)) return true;
  const r = await clicar(page.locator("[data-tarefa-da-conversa]"));
  await page.waitForTimeout(300);
  return r;
}
/** `fill` GUARDADO, pela mesma razão do clique. */
async function preencher(loc, valor) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(valor, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function abrirConversa(page, nome) {
  await clicar(page.locator(`[data-conversa-nome="${nome}"]`));
  await page.waitForTimeout(1200);
}
const tarefaNoBanco = (page, id) => page.evaluate((i) =>
  (globalThis.__TABELAS.zorvin_tarefas || []).find((t) => t.id === i) || null, id);
const tarefasNoBanco = (page) => page.evaluate(() => (globalThis.__TABELAS.zorvin_tarefas || []).slice());
const avisosVistos = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));
const notificacoes = (page) => page.evaluate(() => (globalThis.__NOTIFICACOES || []).map((n) => n.titulo));
/** "Amanhã às 9h" no relógio do navegador, como ISO — para comparar com o banco. */
const amanhaAs9 = (page) => page.evaluate(() => {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString();
});

// ------------------------------------------------------------------
console.log("\n1. Sem o script 018, nada das tarefas aparece");
{
  const { ctx, page, estouros } = await abrirPainel({ semTarefas: true });
  ok("sem o sino na barra", (await page.locator("[data-abrir-tarefas]").count()) === 0);
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  ok("sem o item no menu do topo", (await page.locator("[data-abrir-tarefas-menu]").count()) === 0);
  await page.keyboard.press("Escape");
  await clicar(page.locator("[data-mais-filtros]"));
  ok("sem o filtro na gaveta", (await page.locator("[data-tarefas-opcao]").count()) === 0);
  await page.keyboard.press("Escape");
  await abrirConversa(page, NOMES.a);
  ok("sem o selo na conversa", (await page.locator("[data-tarefa-da-conversa]").count()) === 0);
  ok("sem aviso de tarefa nenhum", !/Lembrete/.test(await avisosVistos(page)), await avisosVistos(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Criar pela conversa: grava, e a frase diz para quem e quando");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, NOMES.c);
  const selo = page.locator("[data-tarefa-da-conversa]").first();
  const antes = await selo.getAttribute("data-tarefa-da-conversa").catch(() => null);
  ok("a conversa diz a próxima tarefa", TEM_HOJE ? antes === "hoje" : antes === "", String(antes));
  await clicar(selo);
  await page.waitForTimeout(300);
  ok("o menu abre", await page.locator("[data-menu-tarefas]").isVisible().catch(() => false));
  ok("e mostra a concluída à parte", (await page.locator('[data-tarefa-da-conversa-item="tf-5"][data-situacao="feita"]').count()) === 1);
  await clicar(page.locator("[data-nova-tarefa]"));
  await page.waitForTimeout(300);
  const confirmar = page.locator("[data-tarefa-confirmar]");
  ok("a janela abre com o nome do cliente", (await page.locator("[data-tarefa-cliente]").innerText().catch(() => "")).includes(NOMES.c));
  ok("sem texto, o botão nasce desligado", await confirmar.isDisabled().catch(() => false));
  await preencher(page.locator("[data-tarefa-texto]"), "Mandar a minuta do acordo");
  ok("com texto e sem hora, continua desligado", await confirmar.isDisabled().catch(() => false));
  // HORA QUE JÁ PASSOU: ontem.
  const ontem = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); });
  await preencher(page.locator("[data-tarefa-dia]"), ontem);
  await preencher(page.locator("[data-tarefa-hora]"), "10:00");
  ok("hora que já passou é DITA", /já passou/.test(await page.locator("[data-tarefa-problema]").innerText().catch(() => "")));
  ok("e o botão não liga", await confirmar.isDisabled().catch(() => false));
  await clicar(page.locator('[data-tarefa-rapida="amanha9"]'));
  ok("o botão diz para quem e quando", /Lembrar você amanhã às 09:00/.test(await confirmar.innerText()), await confirmar.innerText());
  const antesN = (await tarefasNoBanco(page)).length;
  await clicar(confirmar);
  await page.waitForTimeout(800);
  const todas = await tarefasNoBanco(page);
  const nova = todas.find((t) => t.texto === "Mandar a minuta do acordo");
  ok("gravou uma tarefa", todas.length === antesN + 1 && !!nova, `${antesN} → ${todas.length}`);
  ok("na conversa certa, para mim", nova && nova.conversa_id === "cv-tc" && nova.para_quem === "u1", JSON.stringify(nova));
  ok("na hora escolhida", nova && nova.vence_em === await amanhaAs9(page), nova && nova.vence_em);
  ok("a janela fechou", (await page.locator("[data-janela-tarefa]").count()) === 0);
  ok("a frase diz para quem e quando", /Lembrete marcado para você, amanhã às 09:00/.test(await avisosVistos(page)), await avisosVistos(page));

  console.log("\n   …e para um colega");
  await menuDasTarefas(page);
  await clicar(page.locator("[data-nova-tarefa]"));
  await page.waitForTimeout(300);
  await preencher(page.locator("[data-tarefa-texto]"), "Ver o processo da Carla");
  await page.locator("[data-tarefa-para-quem]").selectOption("u-jenifer", { timeout: 3000 }).catch(() => {});
  await clicar(page.locator('[data-tarefa-rapida="amanha14"]'));
  ok("o botão diz o nome da colega", /Lembrar JENIFER/.test(await page.locator("[data-tarefa-confirmar]").innerText()),
     await page.locator("[data-tarefa-confirmar]").innerText());
  await clicar(page.locator("[data-tarefa-confirmar]"));
  await page.waitForTimeout(800);
  const daColega = (await tarefasNoBanco(page)).find((t) => t.texto === "Ver o processo da Carla");
  ok("gravou para a colega", daColega && daColega.para_quem === "u-jenifer", JSON.stringify(daColega));
  ok("e a frase diz o nome dela", /Lembrete marcado para JENIFER/.test(await avisosVistos(page)), await avisosVistos(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Concluir, reabrir, editar e apagar — pela conversa");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, NOMES.b);
  await menuDasTarefas(page);
  await clicar(page.locator('[data-concluir-tarefa="tf-2"]'));
  await page.waitForTimeout(700);
  let t = await tarefaNoBanco(page, "tf-2");
  ok("concluir grava a hora e quem", !!(t && t.feita_em && t.feita_por === "u1"), JSON.stringify(t));
  ok("e a frase diz", /Tarefa concluída/.test(await avisosVistos(page)));
  await menuDasTarefas(page);
  ok("ela passa para as concluídas", (await page.locator('[data-tarefa-da-conversa-item="tf-2"][data-situacao="feita"]').count()) === 1);
  await clicar(page.locator('[data-reabrir-tarefa="tf-2"]'));
  await page.waitForTimeout(700);
  t = await tarefaNoBanco(page, "tf-2");
  ok("reabrir limpa", !!t && !t.feita_em && !t.feita_por, JSON.stringify(t));

  await menuDasTarefas(page);
  await clicar(page.locator('[data-editar-tarefa="tf-2"]'));
  await page.waitForTimeout(300);
  ok("editar abre a janela com o texto", (await page.locator("[data-tarefa-texto]").inputValue().catch(() => "")) === "Cobrar o comprovante do Bruno");
  ok("e com a hora que estava", (await page.locator("[data-tarefa-hora]").inputValue().catch(() => "")) !== "");
  await preencher(page.locator("[data-tarefa-texto]"), "Cobrar o comprovante e o RG do Bruno");
  await clicar(page.locator("[data-tarefa-confirmar]"));
  await page.waitForTimeout(700);
  t = await tarefaNoBanco(page, "tf-2");
  ok("editar grava o texto novo", t && t.texto === "Cobrar o comprovante e o RG do Bruno", t && t.texto);

  await menuDasTarefas(page);
  await clicar(page.locator('[data-apagar-tarefa="tf-2"]'));
  await page.waitForTimeout(700);
  ok("apagar tira do banco", (await tarefaNoBanco(page, "tf-2")) === null);
  ok("e a frase diz", /Tarefa apagada/.test(await avisosVistos(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. O banco que recusa é DITO — nunca 'concluída'");
{
  const { ctx, page } = await abrirPainel({ semEfeito: ["zorvin_tarefas"] });
  await abrirConversa(page, NOMES.b);
  await menuDasTarefas(page);
  await clicar(page.locator('[data-concluir-tarefa="tf-2"]'));
  await page.waitForTimeout(700);
  const filme = await avisosVistos(page);
  ok("recusa calada: a frase diz que o banco não deixou", /o banco não deixou/.test(filme), filme);
  ok("e NÃO diz que concluiu", !/Tarefa concluída/.test(filme), filme);
  ok("e o banco continua aberto", !(await tarefaNoBanco(page, "tf-2")).feita_em);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ erroNaGravacao: { zorvin_tarefas: { code: "42501", message: "permission denied" } } });
  await abrirConversa(page, NOMES.c);
  await menuDasTarefas(page);
  await clicar(page.locator("[data-nova-tarefa]"));
  await page.waitForTimeout(300);
  await preencher(page.locator("[data-tarefa-texto]"), "Esta não vai gravar");
  await clicar(page.locator('[data-tarefa-rapida="amanha9"]'));
  await clicar(page.locator("[data-tarefa-confirmar]"));
  await page.waitForTimeout(700);
  const erro = await page.locator("[data-tarefa-erro]").innerText().catch(() => "");
  ok("criar com erro: a falha aparece NA JANELA", /Não consegui criar a tarefa/.test(erro), erro);
  ok("com o código", /42501/.test(erro), erro);
  ok("a janela continua aberta, com o texto", (await page.locator("[data-tarefa-texto]").inputValue().catch(() => "")) === "Esta não vai gravar");
  ok("e nada foi gravado", !(await tarefasNoBanco(page)).some((t) => t.texto === "Esta não vai gravar"));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. O número da barra e o aviso na hora");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.waitForTimeout(500);
  const selo = page.locator("[data-selo-tarefas]");
  const n = Number(await selo.getAttribute("data-selo-tarefas").catch(() => -1));
  const atr = Number(await selo.getAttribute("data-atrasadas").catch(() => -1));
  // Minhas abertas: tf-1 (atrasada), tf-4 (atrasada, velha), tf-6 (hoje, se houver). tf-2 é amanhã,
  // tf-3 é da colega, tf-5 está feita.
  ok("o número conta as minhas atrasadas e de hoje", n === (TEM_HOJE ? 3 : 2), String(n));
  ok("e diz quantas atrasaram", atr === 2, String(atr));
  const notifs = await notificacoes(page);
  ok("a minha que venceu há 40 min TOCOU", notifs.some((t) => /Ligar para a Ana/.test(t)), JSON.stringify(notifs));
  ok("a da colega NÃO tocou para mim", !notifs.some((t) => /Diego/.test(t)), JSON.stringify(notifs));
  ok("a vencida há 30 horas NÃO tocou", !notifs.some((t) => /velha/.test(t)), JSON.stringify(notifs));
  ok("a de amanhã NÃO tocou", !notifs.some((t) => /Bruno/.test(t)), JSON.stringify(notifs));
  ok("e a tela diz o lembrete", /Lembrete: Ligar para a Ana/.test(await avisosVistos(page)), await avisosVistos(page));
  const guardadas = await page.evaluate(() => localStorage.getItem("zorvin-tarefas-avisadas") || "");
  ok("e guarda que tocou", /tf-1@/.test(guardadas), guardadas);
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1800);
  ok("recarregar NÃO toca de novo", !(await notificacoes(page)).some((t) => /Ligar para a Ana/.test(t)),
     JSON.stringify(await notificacoes(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // A COLEGA: quem abre o painel é sempre u1, então a prova troca de lado —
  // a tarefa da colega vira minha, e a minha vira dela.
  const sem = { ...SEMENTE, zorvin_tarefas: SEMENTE.zorvin_tarefas.map((t) =>
    t.id === "tf-1" ? { ...t, para_quem: "u-jenifer" } : t) };
  const { ctx, page } = await abrirPainel({ semente: sem });
  ok("passada para a colega, a de 40 min NÃO toca para mim",
     !(await notificacoes(page)).some((t) => /Ligar para a Ana/.test(t)), JSON.stringify(await notificacoes(page)));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. A tela de tarefas");
{
  const { ctx, page, estouros } = await abrirPainel();
  await clicar(page.locator("[data-abrir-tarefas]"));
  await page.waitForTimeout(1200);
  ok("a tela abre", (await page.locator('[data-tela="tarefas"]').count()) === 1);
  const minhas = await page.locator("[data-tarefa-da-tela]").evaluateAll((els) => els.map((e) => e.getAttribute("data-tarefa-da-tela")));
  ok("Minhas: as minhas abertas", minhas.includes("tf-1") && minhas.includes("tf-2") && minhas.includes("tf-4"),
     JSON.stringify(minhas));
  ok("e NÃO a da colega", !minhas.includes("tf-3"), JSON.stringify(minhas));
  ok("nem a já feita", !minhas.includes("tf-5"), JSON.stringify(minhas));
  ok("a atrasada mora em Atrasadas",
     (await page.locator('[data-secao-de-tarefas="atrasada"] [data-tarefa-da-tela="tf-1"]').count()) === 1);
  ok("a de amanhã mora em Próximas",
     (await page.locator('[data-secao-de-tarefas="proxima"] [data-tarefa-da-tela="tf-2"]').count()) === 1);
  ok("a linha diz de quem é o cliente",
     (await page.locator('[data-tarefa-da-tela="tf-1"] [data-cliente-da-tarefa]').innerText().catch(() => "")).includes(NOMES.a));
  await clicar(page.locator("[data-ver-feitas]"));
  ok("as concluídas ficam à parte", (await page.locator('[data-secao-de-tarefas="feita"] [data-tarefa-da-tela="tf-5"]').count()) === 1);

  await clicar(page.locator('[data-aba-tarefas="equipe"]'));
  await page.waitForTimeout(300);
  const daEquipe = await page.locator("[data-tarefa-da-tela]").evaluateAll((els) => els.map((e) => e.getAttribute("data-tarefa-da-tela")));
  ok("Da equipe: a da colega aparece", daEquipe.includes("tf-3"), JSON.stringify(daEquipe));
  ok("e a conta dela diz 1 atrasada",
     (await page.locator('[data-conta-da-pessoa="u-jenifer"] [data-atrasadas-da-pessoa]').getAttribute("data-atrasadas-da-pessoa").catch(() => "")) === "1");
  await clicar(page.locator('[data-conta-da-pessoa="u-jenifer"]'));
  const soDela = await page.locator("[data-tarefa-da-tela]").evaluateAll((els) => els.map((e) => e.getAttribute("data-tarefa-da-tela")));
  ok("clicar na conta dela mostra só as dela", soDela.length === 1 && soDela[0] === "tf-3", JSON.stringify(soDela));

  await clicar(page.locator('[data-aba-tarefas="minhas"]'));
  await clicar(page.locator('[data-concluir-tarefa="tf-4"]'));
  await page.waitForTimeout(900);
  ok("concluir pela tela grava", !!(await tarefaNoBanco(page, "tf-4")).feita_em);
  ok("e diz", /Tarefa concluída/.test(await page.locator("[data-aviso-das-tarefas]").innerText().catch(() => "")));

  await clicar(page.locator('[data-tarefa-da-tela="tf-1"] [data-abrir-tarefa]'));
  await page.waitForTimeout(1500);
  ok("clicar na tarefa abre a conversa", (await page.locator('[data-tela="tarefas"]').count()) === 0
     && (await page.locator("[data-topo-conversa]").innerText().catch(() => "")).includes(NOMES.a));
  const n = Number(await page.locator("[data-selo-tarefas]").getAttribute("data-selo-tarefas").catch(() => -1));
  ok("e o número da barra já desceu", n === (TEM_HOJE ? 2 : 1), String(n));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ recusarLeitura: ["zorvin_tarefas"] });
  await clicar(page.locator("[data-abrir-tarefas]"));
  await page.waitForTimeout(1000);
  const t = await page.locator("[data-falha-das-tarefas]").innerText().catch(() => "");
  ok("a leitura que falha diz que falhou", /Não consegui ler as tarefas/.test(t), t);
  ok("com o código", /PGRST301/.test(t), t);
  ok("e não diz 'nenhuma tarefa'", (await page.locator("[data-sem-tarefas]").count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Esc fecha a tela", (await page.locator('[data-tela="tarefas"]').count()) === 0);
  const ambar = await page.locator("[data-falha-de-leitura]").innerText().catch(() => "");
  ok("e a faixa âmbar diz que os lembretes não vieram", /lembretes/.test(ambar), ambar);
  await abrirConversa(page, NOMES.a);
  await menuDasTarefas(page);
  ok("na conversa, o menu diz a falha, e não 'nenhuma'",
     (await page.locator("[data-erro-das-tarefas]").count()) === 1 && (await page.locator("[data-sem-tarefas-na-conversa]").count()) === 0);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. O filtro 'Com tarefa para hoje'");
{
  const { ctx, page, estouros } = await abrirPainel();
  await clicar(page.locator("[data-mais-filtros]"));
  await clicar(page.locator("[data-tarefas-opcao]"));
  await page.waitForTimeout(1200);
  const nomes = await page.locator("[data-conversa-nome]").evaluateAll((els) => els.map((e) => e.getAttribute("data-conversa-nome")));
  ok("mostra a da tarefa atrasada (minha)", nomes.includes(NOMES.a), JSON.stringify(nomes));
  ok("e a da colega, que também atrasou", nomes.includes(NOMES.d), JSON.stringify(nomes));
  ok("NÃO mostra a de amanhã", !nomes.includes(NOMES.b), JSON.stringify(nomes));
  // A DE HOJE só existe se ainda havia dia quando a semente foi feita; sem
  // ela, a Carla não tem tarefa para hoje e não pode aparecer.
  ok(TEM_HOJE ? "mostra a de hoje que ainda não venceu" : "sem tarefa de hoje, a Carla não aparece",
     TEM_HOJE ? nomes.includes(NOMES.c) : !nomes.includes(NOMES.c), JSON.stringify(nomes));
  ok("e só elas", nomes.length === (TEM_HOJE ? 3 : 2), JSON.stringify(nomes));
  ok("a pílula diz o filtro", /Tarefas hoje/.test(await page.locator("[data-mais-filtros]").innerText()));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. O cartão do funil diz a tarefa do cliente");
{
  const sem = { ...SEMENTE, zorvin_cartoes: [
    { id: "cartao-ta", contato_id: "ct-ta", departamento_id: DEP, etapa_id: `et-${DEP}-1`,
      criado_em: iso(agora), movido_em: iso(agora), movido_por: "u1" },
    { id: "cartao-tb", contato_id: "ct-tb", departamento_id: DEP, etapa_id: `et-${DEP}-1`,
      criado_em: iso(agora), movido_em: iso(agora), movido_por: "u1" },
  ] };
  const { ctx, page, estouros } = await abrirPainel({ semente: sem });
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  await clicar(page.locator("[data-abrir-funil]"));
  await page.waitForTimeout(1200);
  ok("o cartão com tarefa atrasada diz", (await page.locator('[data-cartao-do-funil="ct-ta"] [data-tarefa-no-cartao="atrasada"]').count()) === 1);
  ok("o de amanhã diz que é para depois", (await page.locator('[data-cartao-do-funil="ct-tb"] [data-tarefa-no-cartao="proxima"]').count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n9. Os selos da linha do número NÃO se sobrepõem");
// A FORMA ESPERADA em cada largura, medida em 06/10: escrita onde cabem os três
// selos com ~92px cada, ícone onde não cabem. Conferida em TODAS as larguras —
// um "if" só na de 1920 passaria calado nas outras.
for (const [largura, ficha, forma] of [[1280, "nao", "sim"], [1366, "nao", "sim"], [1400, "sim", "sim"],
                                       [1440, "nao", "nao"], [1600, "sim", "sim"], [1920, "sim", "nao"]]) {
  const { ctx, page } = await abrirPainel({ largura, ficha });
  await abrirConversa(page, NOMES.a);
  const m = await page.evaluate(() => {
    const linha = document.querySelector("[data-linha-do-numero]");
    if (!linha) return null;
    const l = linha.getBoundingClientRect();
    const sel = ["[data-responsavel-da-conversa]", "[data-etapa-da-conversa]", "[data-tarefa-da-conversa]"]
      .map((q) => document.querySelector(q)).filter(Boolean);
    const rs = sel.map((e) => e.getBoundingClientRect());
    let sobre = false;
    for (let i = 1; i < rs.length; i++) if (rs[i].left < rs[i - 1].right - 0.5) sobre = true;
    // O QUE ESTÁ PINTADO, e não o retângulo: o centro de cada selo tem de ser
    // dele — um vizinho pintado por cima é o defeito de 1400.
    const pintado = sel.every((e) => {
      const r = e.getBoundingClientRect();
      const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return no && (e === no || e.contains(no));
    });
    return { selos: sel.length, sobre, pintado, cortado: sel.some((e) => e.scrollWidth > e.clientWidth + 1),
             fora: rs.some((r) => r.right > l.right + 0.5), compacto: sel[0] && sel[0].getAttribute("data-selo-compacto") };
  });
  ok(`${largura} (ficha ${ficha}): os três selos estão lá`, m && m.selos === 3, JSON.stringify(m));
  ok(`${largura} (ficha ${ficha}): nenhum por cima do outro`, m && !m.sobre && m.pintado, JSON.stringify(m));
  ok(`${largura} (ficha ${ficha}): nenhum cortado nem fora da linha`, m && !m.cortado && !m.fora, JSON.stringify(m));
  ok(`${largura} (ficha ${ficha}): ${forma === "sim" ? "em ícone" : "escritos"}`, m && m.compacto === forma, JSON.stringify(m));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n10. No celular, as tarefas vão pelo ⋮");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  await abrirConversa(page, NOMES.a);
  const linha = await page.locator("[data-tarefa-da-conversa]").first().innerText().catch(() => "");
  ok("a linha diz a tarefa, em texto", /tarefa/.test(linha), linha);
  await clicar(page.locator('[aria-label="Mais opções desta conversa"]'));
  await page.waitForTimeout(300);
  ok("o ⋮ tem o item das tarefas", (await page.locator("[data-menu-tarefa-item]").count()) === 1);
  await clicar(page.locator("[data-menu-tarefa-item]"));
  await page.waitForTimeout(300);
  ok("e ele abre a lista", await page.locator("[data-menu-tarefas]").isVisible().catch(() => false));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
