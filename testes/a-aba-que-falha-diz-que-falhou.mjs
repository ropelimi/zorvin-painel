// A ABA QUE NÃO CARREGA DIZ QUE NÃO CARREGOU (auditoria de 28/10)
//
// Em 07/10 a lista que não carregava deixou de ficar em "Carregando as
// conversas…" para sempre: o recado passou a dizer que falhou, com o código.
// Só que a régua do recado era `!conversas.length` — "a lista está vazia" —, e
// isso só vale na ABERTURA. Na troca de aba (ou na entrada da pasta de
// arquivadas) a lista ainda guarda as conversas da aba de antes: a leitura
// falha, `conversas` continua cheia, a aba da lista continua a velha, e o
// recado caía em "a aba escolhida ainda não voltou do banco" — "Carregando as
// conversas…" para sempre, com a faixa âmbar no alto dizendo que falhou.
//
// E sem o script 028 a mesma falha virava "Nenhuma conversa arquivada.": a
// tela afirmando uma ausência que não apurou. É a volta do defeito de 07/10,
// agora pela porta da aba.
//
// O QUE ESTA PROVA GUARDA
//
//   1. trocar para "Finalizados" com a leitura falhando diz que falhou, com o
//      código, e não "Carregando…";
//   2. entrar nas arquivadas com a leitura falhando diz que falhou;
//   3. sem o 028, entrar nas arquivadas com a leitura falhando não diz
//      "Nenhuma conversa arquivada.";
//   4. e o contraste: com a leitura de volta, "Tentar de novo" tira a frase
//      da falha e a faixa — um conserto que dissesse "falhou" sempre passaria
//      sem ele.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrir({ semSituacao = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEM_SITUACAO = d.semSituacao;
    globalThis.__RECUSAR_LEITURA = [];
  }, { semSituacao });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // O TELEFONE DE 1.200 CONVERSAS: a arquivada dele mora a duzentos dias de
  // distância, fora da página que a aba de antes trouxe.
  const tel = page.locator('[data-telefone="Arquivo"]');
  if (await tel.count()) await tel.first().click();
  await page.waitForTimeout(3000);
  return { ctx, page, estouros };
}
const recado = (page) => page.evaluate(() => {
  const r = document.querySelector("[data-recado-da-lista]");
  return r ? { marca: r.getAttribute("data-recado-da-lista"), texto: (r.innerText || "").trim() } : null;
});
const faixa = (page) => page.locator("[data-falha-de-leitura]").count();
const quebrarALeitura = (page, sim) => page.evaluate((s) => { globalThis.__RECUSAR_LEITURA = s ? ["conversas"] : []; }, sim);
async function clicar(page, seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
// A LINHA "Arquivadas" do alto da lista — pelo texto, porque a marca dela
// nasceu nesta mesma rodada (a prova do teclado).
const entrarNasArquivadas = (page) => clicar(page, 'text="Arquivadas"');

// ==================================================================
console.log("\n1. Trocar para “Finalizados” com a leitura falhando");
{
  const { ctx, page, estouros } = await abrir();
  ok("a lista do telefone de 1.200 conversas chegou", (await page.locator("[data-conversa-nome]").count()) > 0);
  await quebrarALeitura(page, true);
  ok("cliquei em “Finalizados”", await clicar(page, '[data-aba-da-situacao="finalizado"]'));
  await page.waitForTimeout(2500);
  const r = await recado(page);
  ok("o recado é o da falha, e não “Carregando as conversas…”", r && r.marca === "falhou", JSON.stringify(r));
  ok("com o código do banco", r && /PGRST301/.test(r.texto), JSON.stringify(r));
  ok("e a faixa âmbar acende", (await faixa(page)) === 1);

  // O CONTRASTE: com a leitura de volta, o mesmo botão tira a frase.
  await quebrarALeitura(page, false);
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(2500);
  const depois = await recado(page);
  ok("com a leitura de volta, a aba vazia diz o que mora nela", depois && depois.marca === "sem-conversa-finalizado",
     JSON.stringify(depois));
  ok("e a faixa apaga", (await faixa(page)) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Entrar nas arquivadas com a leitura falhando");
{
  const { ctx, page, estouros } = await abrir();
  await quebrarALeitura(page, true);
  ok("entrei nas arquivadas", await entrarNasArquivadas(page));
  await page.waitForTimeout(2500);
  const r = await recado(page);
  ok("o recado é o da falha, e não “Carregando as conversas…”", r && r.marca === "falhou", JSON.stringify(r));
  await quebrarALeitura(page, false);
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(2500);
  const depois = await recado(page);
  ok("com a leitura de volta, a frase da falha sai", !depois || depois.marca !== "falhou", JSON.stringify(depois));
  ok("e a faixa apaga", (await faixa(page)) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Sem o 028, as arquivadas que não carregaram não viram “nenhuma”");
{
  const { ctx, page, estouros } = await abrir({ semSituacao: true });
  ok("sem o 028 não há abas", (await page.locator("[data-abas-da-situacao]").count()) === 0);
  await quebrarALeitura(page, true);
  ok("entrei nas arquivadas", await entrarNasArquivadas(page));
  await page.waitForTimeout(2500);
  const r = await recado(page);
  ok("o recado é o da falha, e não “Nenhuma conversa arquivada.”", r && r.marca === "falhou", JSON.stringify(r));
  ok("e a faixa âmbar acende", (await faixa(page)) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
