// A BUSCA NÃO SE REFAZ AO ABRIR O QUE ELA ACHOU (auditoria de 28/10)
//
// Abrir um resultado da busca que estava fora das páginas carregadas emenda a
// conversa na lista — é o que faz a conversa aberta existir do lado direito.
// Só que a busca dependia de `conversas.length`: a lista cresceu um, e a busca
// inteira recomeçava. Ela começa APAGANDO o que achou (os trechos, os nomes, o
// alvo da mensagem) e depois pergunta de novo ao banco e ao Vantoro.
//
// O que se via: a conversa clicada sumia da lista por um a dois segundos (o
// trecho que a fazia casar tinha sido apagado), e um segundo clique nela
// abria a conversa no fim, e não na mensagem achada. E o banco respondia duas
// vezes a mesma pergunta.
//
// O QUE ESTA PROVA GUARDA: abrir a conversa achada lá no fundo não a tira da
// lista nem por um quadro, e não faz a busca perguntar de novo ao banco.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

async function clicar(seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}

ok("fui ao telefone de 1.200 conversas", await clicar('[data-telefone="Arquivo"]'));
await page.waitForTimeout(3000);

// QUANTAS VEZES A BUSCA PERGUNTA AO BANCO — contadas na porta do cliente do
// banco, que é o mesmo objeto que o painel usa.
await page.evaluate(async () => {
  const m = await import("/src/supabase.js");
  const original = m.supabase.rpc;
  globalThis.__BUSCAS_NO_BANCO = 0;
  m.supabase.rpc = (nome, args) => {
    if (nome === "buscar_conversas") globalThis.__BUSCAS_NO_BANCO += 1;
    return original(nome, args);
  };
});

// A CONVERSA 1.180 TEM UM TEXTO PRÓPRIO, e mora muito além das páginas lidas.
await page.locator('input[placeholder*="Buscar por nome"]').first().fill("protocolo 8891");
await page.waitForTimeout(3500);
const alvo = '[data-conversa-id="a13-c1180"]';
ok("a busca achou a conversa 1.180 pelo que foi dito nela", (await page.locator(alvo).count()) === 1);
const antes = await page.evaluate(() => globalThis.__BUSCAS_NO_BANCO);
ok("a busca perguntou ao banco uma vez", antes === 1, String(antes));

await page.evaluate((sel) => {
  globalThis.__FILME = [];
  globalThis.__RELOGIO_DO_FILME = setInterval(() => globalThis.__FILME.push(!!document.querySelector(sel)), 40);
}, alvo);
ok("abri a conversa achada", await clicar(alvo));
await page.waitForTimeout(3000);
const filme = await page.evaluate(() => { clearInterval(globalThis.__RELOGIO_DO_FILME); return globalThis.__FILME; });
const semEla = filme.filter((x) => !x).length;
ok("o filme tem quadros", filme.length > 20, String(filme.length));
ok("a conversa achada não sai da lista em quadro nenhum", semEla === 0, `${semEla} de ${filme.length} quadros sem ela`);
const depois = await page.evaluate(() => globalThis.__BUSCAS_NO_BANCO);
ok("e abrir não fez a busca perguntar de novo ao banco", depois === antes, `${antes} → ${depois}`);
ok("a conversa abriu", (await page.locator("[data-topo-conversa]").count()) === 1);

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
