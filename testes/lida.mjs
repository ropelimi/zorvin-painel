// MARCAR COMO LIDA — E COMO NÃO LIDA, PELO MESMO BOTÃO.
//
// O botão do cabeçalho só existia num sentido: aparecia quando a conversa
// tinha mensagem por ler, e sumia depois de clicado. Desmarcar só dava pelo
// menu do botão direito na LISTA — que quase ninguém acha.
//
// E é justamente o sentido que falta o mais usado: abrir a conversa, ver que
// não dá para resolver agora, e querer deixar o aviso lá para voltar depois.
// Sem isso, quem abre uma conversa perde o único lembrete de que ela existe.
//
// O QUE ESTA PROVA DEFENDE, além de o botão existir nos dois sentidos: que os
// dois estados sejam DIFERENTES DE LONGE. Um botão que muda só de texto vira
// uma roleta — a pessoa clica sem ler e não sabe o que vai acontecer.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

const conversa = await page.evaluate(() =>
  document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));

/** Põe a conversa com N mensagens por ler, pelo mesmo caminho do banco. */
async function porLer(quantas) {
  await page.evaluate(([id, n]) => {
    globalThis.__EMITIR("UPDATE", "conversas", {
      id, nao_lidas: n,
      ultima_mensagem: "oi", ultima_atividade: new Date().toISOString(),
    });
  }, [conversa, quantas]);
  await page.waitForTimeout(500);
}

/** Abre a conversa do topo da lista. */
async function abrirAConversa() {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(400);
}

const botaoLida = () => page.locator('[data-marcar="lida"]');
const botaoNaoLida = () => page.locator('[data-marcar="nao-lida"]');

// VISÍVEL, e não "existe no DOM".
//
// A primeira versão desta prova contava elementos com `count()`. Uma sabotagem
// mostrou o furo: pôr `hidden` no botão passava batido — ele continuava no DOM,
// a conta dava 1, e a conferência dizia que estava tudo bem com o botão
// invisível na tela. Quem usa não conta elementos; quem usa VÊ.
const aparece = async (loc) => (await loc.count()) === 1 && await loc.first().isVisible();
const naoAparece = async (loc) => (await loc.count()) === 0 || !(await loc.first().isVisible());

console.log("\nCom mensagem por ler, o botão oferece MARCAR COMO LIDA");
{
  await porLer(2);
  await abrirAConversa();
  ok("o botão de marcar como lida está lá", await aparece(botaoLida()));
  ok("e o de não lida não aparece junto", await naoAparece(botaoNaoLida()),
     "os dois ao mesmo tempo é pedir para clicar no errado");
  const texto = (await botaoLida().innerText()).trim();
  ok("com a palavra escrita, não só um tique",
     /Marcar como lida/i.test(texto), `dizia: "${texto}"`);
}

console.log("\nDepois de marcar, ele VIRA o contrário — e não some");
{
  await botaoLida().click();
  await page.waitForTimeout(700);

  // O CORAÇÃO DA PROVA. Antes ele sumia, e a função de desmarcar deixava de
  // existir na tela: quem abriu a conversa sem tempo de resolver perdia o
  // único lembrete de que ela estava pendente.
  ok("agora aparece MARCAR COMO NÃO LIDA", await aparece(botaoNaoLida()),
     "o botão sumiu ou está invisível — não há como devolver o aviso");
  ok("e o de marcar como lida saiu", await naoAparece(botaoLida()));
  const texto = (await botaoNaoLida().innerText()).trim();
  ok("com a palavra escrita", /não lida/i.test(texto), `dizia: "${texto}"`);
}

console.log("\nOs dois estados são diferentes DE LONGE, e não só no texto");
{
  // Um botão que muda só de texto vira roleta: a pessoa clica sem ler.
  // Cor E desenho juntos — só a cor não serve para quem não a distingue.
  await porLer(1);
  await abrirAConversa();
  const lida = await botaoLida().evaluate((el) => {
    const e = getComputedStyle(el);
    return { cor: e.color, fundo: e.backgroundColor,
             peso: e.fontWeight, desenho: el.querySelector("svg")?.outerHTML || "" };
  });

  await botaoLida().click();
  await page.waitForTimeout(700);
  const naoLida = await botaoNaoLida().evaluate((el) => {
    const e = getComputedStyle(el);
    return { cor: e.color, fundo: e.backgroundColor,
             peso: e.fontWeight, desenho: el.querySelector("svg")?.outerHTML || "" };
  });

  ok("a cor do texto muda", lida.cor !== naoLida.cor,
     `os dois em ${lida.cor}`);
  ok("o fundo muda", lida.fundo !== naoLida.fundo,
     `os dois em ${lida.fundo}`);
  ok("E O DESENHO MUDA — que é o que serve para quem não distingue cor",
     !!lida.desenho && !!naoLida.desenho && lida.desenho !== naoLida.desenho,
     "o mesmo ícone nos dois estados: só a cor diferenciando");
}

console.log("\nMarcar como não lida devolve o aviso de verdade");
{
  // Não basta o botão trocar: o selo tem de voltar na lista, senão a pessoa
  // acha que marcou e o lembrete não existe.
  await botaoNaoLida().click();
  await page.waitForTimeout(900);

  const selo = await page.evaluate((id) => {
    const linha = document.querySelector(`[data-conversa-id="${id}"]`);
    if (!linha) return "sem a linha na lista";
    return linha.innerText.replace(/\s+/g, " ");
  }, conversa);
  ok("a conversa volta a aparecer com selo na lista",
     /\d/.test(selo), `a linha dizia: "${selo}"`);
}

console.log("\nE nada disso estourou no caminho");
ok("sem erro de JavaScript", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
