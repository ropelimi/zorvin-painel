// O FILTRO DE ATENDENTES NÃO SOME CALADO — nem o botão, nem as linhas de fora
// (auditoria de 28/10)
//
// Três defeitos no mesmo filtro, os três calados:
//
//   1. O BOTÃO SUMIA EM QUALQUER ERRO. A lista de quem atende vinha de uma
//      função do banco, e `if (error) return;` não separava "a função não
//      existe" (o SQL não foi rodado — esconder é certo) de uma queda de rede
//      (passageira). O comentário logo acima condenava exatamente isso: "um
//      recurso que some sem dizer nada é pior do que um botão que responde
//      'nenhuma'".
//
//   2. AS LINHAS DE FORA DAS PÁGINAS PISCAVAM. As conversas da pessoa marcada
//      que a lista não tinha vinham à parte, e eram esvaziadas a cada vez que
//      a lista mudava de tamanho — inclusive ao abrir uma delas, que a tela
//      emenda na lista. As outras sumiam por duas idas ao banco. E se a
//      releitura falhasse, o erro era jogado fora: elas não voltavam, e nada
//      avisava.
//
//   3. O TETO DE 500 CORTAVA CALADO: quem participou de mais de 500 conversas
//      via uma lista cortada com cara de inteira.
//
// O DEFEITO 1 FOI CONSERTADO ANTES PELA #290 (auditoria de 27/10), por outro
// caminho, e é o dela que vale: com a função falhando o botão não aparece, mas
// a falha é DITA na faixa âmbar, e o "Tentar de novo" traz o botão de volta (a
// cena 13b de `a-auditoria-de-27-10` confere o mesmo). Esta prova pedia o
// botão de pé com o menu dizendo que a lista não veio; passou a pedir o
// caminho da #290 — a falha dita, e não um sumiço calado.
//
// O QUE ESTA PROVA GUARDA: a falha da função é dita, e o "Tentar de novo"
// traz o botão e as pessoas; sem a função, o botão some calado; as linhas de
// fora não piscam ao abrir uma delas, e não somem quando a releitura falha — a
// faixa diz; e o teto é dito.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

/** Uma fala da Jenifer em cada uma destas conversas do telefone de 1.200. */
const falasDaJenifer = (ids) => ids.map((id, i) => ({
  id: `m-jen-${id}`, conversa_id: id, origem: "advogado", tipo: "texto", texto: "Bom dia, aqui é a Jenifer",
  enviado_por: "JENIFER ALMEIDA", enviado_por_id: "u-jenifer",
  criado_em: new Date(AGORA - (i + 1) * 60e3).toISOString(),
}));

async function abrir({ semente = {}, quebrarFuncao = [], semFuncao = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__QUEBRAR_FUNCAO = d.quebrarFuncao;
    globalThis.__SEM_FILTRO_DE_ATENDENTE = d.semFuncao;
    globalThis.__RECUSAR_LEITURA = [];
  }, { semente, quebrarFuncao, semFuncao });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
async function clicar(page, seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const botao = (page) => page.locator('[data-grupo="quem"]').count();
const faixa = (page) => page.locator("[data-falha-de-leitura]").count();
const textoDaFaixa = (page) => page.locator("[data-falha-de-leitura]").innerText().catch(() => "");
const idsNaLista = (page) => page.locator("[data-conversa-id]").evaluateAll(
  (els) => els.map((e) => e.getAttribute("data-conversa-id")));

// ==================================================================
console.log("\n1. A lista de quem atende que não veio é dita, e o “Tentar de novo” a traz");
{
  const { ctx, page, estouros } = await abrir({ quebrarFuncao: ["atendentes_do_telefone"] });
  ok("a faixa âmbar diz o que não carregou", /quem atende/.test(await textoDaFaixa(page)), await textoDaFaixa(page));
  // O CAMINHO DA #290: o botão não fica de pé oferecendo um menu sem ninguém —
  // que diria "Ninguém do escritório escreveu" sobre uma leitura que falhou.
  ok("e o botão não fica de pé com um menu sem ninguém", (await botao(page)) === 0);
  // O CONTRASTE: a função de volta, e o mesmo botão da faixa relê.
  await page.evaluate(() => { globalThis.__QUEBRAR_FUNCAO = []; });
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(1500);
  ok("com a função respondendo, a faixa apaga", (await faixa(page)) === 0);
  ok("e o botão volta", (await botao(page)) === 1);
  await clicar(page, '[data-grupo="quem"]');
  await page.waitForTimeout(300);
  ok("e o menu traz as pessoas", (await page.locator("[data-quem]").count()) > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Sem a função no banco, o botão não aparece — e nada acende");
{
  const { ctx, page, estouros } = await abrir({ semFuncao: true });
  ok("sem o botão", (await botao(page)) === 0);
  ok("e sem faixa: o SQL que não rodou não é falha de leitura", (await faixa(page)) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. As conversas de fora das páginas não piscam, e não somem");
{
  const FORA = ["a13-c600", "a13-c900", "a13-c1100"];
  const { ctx, page, estouros } = await abrir({ semente: { mensagens: falasDaJenifer(FORA) } });
  ok("fui ao telefone de 1.200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(3000);
  await clicar(page, '[data-grupo="quem"]');
  await page.waitForTimeout(400);
  ok("marquei a Jenifer", await clicar(page, '[data-quem="JENIFER ALMEIDA"]'));
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  await clicar(page, "[data-fita-de-filtros]");
  const antes = await idsNaLista(page);
  ok("as três conversas dela, todas de fora das páginas, aparecem",
     antes.length === 3 && FORA.every((id) => antes.includes(id)), JSON.stringify(antes));

  // O FILME: abrir uma delas não pode tirar as outras da tela, nem por um
  // instante.
  await page.evaluate((ids) => {
    globalThis.__FILME = [];
    globalThis.__RELOGIO_DO_FILME = setInterval(() => {
      globalThis.__FILME.push(ids.map((id) => !!document.querySelector(`[data-conversa-id="${id}"]`)));
    }, 40);
  }, ["a13-c900", "a13-c1100"]);
  ok("abri a primeira", await clicar(page, '[data-conversa-id="a13-c600"]'));
  await page.waitForTimeout(3000);
  const filme = await page.evaluate(() => { clearInterval(globalThis.__RELOGIO_DO_FILME); return globalThis.__FILME; });
  const sumiu = filme.filter((q) => !q[0] || !q[1]).length;
  ok("o filme tem quadros", filme.length > 20, String(filme.length));
  ok("nenhum quadro sem as outras duas", sumiu === 0, `${sumiu} de ${filme.length} quadros sem elas`);

  // A RELEITURA QUE FALHA: a terceira fica, e a faixa diz.
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["conversas"]; });
  ok("abri a segunda, com a leitura das conversas falhando", await clicar(page, '[data-conversa-id="a13-c900"]'));
  await page.waitForTimeout(3000);
  ok("a terceira continua na lista", (await idsNaLista(page)).includes("a13-c1100"), JSON.stringify(await idsNaLista(page)));
  ok("e a faixa diz que o filtro de atendentes está incompleto", /filtro de atendentes/.test(await textoDaFaixa(page)),
     await textoDaFaixa(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Mais de 500 conversas: a tela diz que pode haver outras");
{
  const muitas = Array.from({ length: 501 }, (_, i) => `a13-c${i}`);
  const { ctx, page, estouros } = await abrir({ semente: { mensagens: falasDaJenifer(muitas) } });
  ok("fui ao telefone de 1.200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(3000);
  await clicar(page, '[data-grupo="quem"]');
  await page.waitForTimeout(400);
  await clicar(page, '[data-quem="JENIFER ALMEIDA"]');
  await page.waitForTimeout(6000);
  ok("a lista mostra as conversas dela", (await idsNaLista(page)).length > 0);
  ok("e diz que pode haver outras", (await page.locator("[data-corte-do-filtro]").count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
