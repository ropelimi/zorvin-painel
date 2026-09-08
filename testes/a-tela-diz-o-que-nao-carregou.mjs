// A TELA DIZ O QUE NÃO CARREGOU — e não desenha ausência no lugar de falha.
//
// RELATO DE QUEM USA, 04/09: "sumiram todas as tags". Sumiram mesmo — de todas
// as conversas do escritório, de uma vez. E as notas internas junto, o que
// ninguém notou, porque a tela também não disse nada sobre elas.
//
// A causa era uma permissão no banco: a leitura de `conversa_tags` passou a
// voltar com erro. O painel fazia isto:
//
//     if (error) return;                     // etiquetas
//     if (!nErr) notas = ...;                // notas
//     const { data: falhas } = await ...;    // a fila: o erro nem era lido
//
// O erro era LIDO e jogado fora. E aí "não consegui ler" e "não existe" viram
// exatamente a mesma imagem: uma conversa sem etiqueta, uma conversa sem nota.
//
// O CUSTO DISSO, medido em tempo de gente: três rodadas de conversa e uma
// varredura no banco para descobrir o que a própria tela sabia desde o
// primeiro segundo. E metade do estrago (as notas) só apareceu porque alguém
// foi procurar.
//
// Esta prova exercita as duas metades: a tela FALA quando falha, e ela CALA
// quando não falha — um aviso que aparece à toa é aviso que se aprende a
// ignorar, e aí a próxima falha passa batida do mesmo jeito.
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
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const abrirOPainel = async () => {
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
};
const abrirAPrimeira = async () => {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2000);
};
const faixa = () => page.locator("[data-falha-de-leitura]");
const textoDaFaixa = async () =>
  (await faixa().count()) ? (await faixa().innerText()).replace(/\s+/g, " ") : "";

console.log("\n1. Com tudo respondendo, a tela NÃO inventa aviso");
{
  await abrirOPainel();
  await abrirAPrimeira();
  ok("nenhuma faixa de falha aparece quando está tudo bem",
     (await faixa().count()) === 0,
     `apareceu: "${await textoDaFaixa()}" — aviso à toa faz o de verdade ser ignorado`);
}

console.log("\n2. A etiqueta que não carrega DIZ que não carregou");
{
  // `addInitScript` e não `evaluate`: o recarregamento apaga o segundo, e a
  // recusa precisa estar de pé ANTES da primeira consulta do painel.
  await page.addInitScript(() => { globalThis.__RECUSAR_LEITURA = ["conversa_tags"]; });
  await abrirOPainel();

  const apareceu = await faixa().count() > 0;
  ok("a faixa aparece", apareceu,
     "a lista ficou sem etiqueta nenhuma e sem uma palavra — foi assim que o 04/09 aconteceu");

  const texto = await textoDaFaixa();
  ok("e diz O QUE não carregou", /etiqueta/i.test(texto), `disse: "${texto}"`);
  // O CÓDIGO DO BANCO É O QUE TRANSFORMA "não carregou" EM ALGO QUE SE PROCURA.
  // No caso real era um `42501` (permissão negada), e foi por ele que a causa
  // se resolveu. Sem o código, a frase é verdadeira e inútil.
  ok("e traz o código do banco, que é por onde se investiga",
     /Código do banco/i.test(texto), `disse: "${texto}"`);
}

console.log("\n3. A nota interna que não carrega também fala");
{
  await page.addInitScript(() => { globalThis.__RECUSAR_LEITURA = ["notas"]; });
  await abrirOPainel();
  await abrirAPrimeira();

  const texto = await textoDaFaixa();
  ok("a faixa fala das notas internas", /nota/i.test(texto), `disse: "${texto}"`);
  // ISTO É O QUE NINGUÉM VIU EM 04/09. A nota interna é o combinado da equipe
  // sobre aquele cliente; a conversa que a perde em silêncio faz quem atende
  // seguir confiante, sem o que foi combinado.
  ok("e a conversa não finge que a nota não existe",
     (await faixa().count()) > 0,
     "a linha do tempo abriu sem as notas e sem dizer isso");
}

console.log("\n4. Voltando a responder, a faixa some sozinha");
{
  await page.addInitScript(() => { globalThis.__RECUSAR_LEITURA = ["conversa_tags"]; });
  await abrirOPainel();
  ok("a faixa está de pé antes do conserto", (await faixa().count()) > 0);

  // O banco volta a responder, e a pessoa toca em "Tentar de novo".
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await page.locator("[data-tentar-leituras]").click();
  await page.waitForTimeout(2000);

  ok("depois de tentar de novo, a faixa some", (await faixa().count()) === 0,
     `continuou: "${await textoDaFaixa()}"`);
  // UMA FAIXA QUE NÃO SOME é tão ruim quanto não existir: ela vira parte do
  // cenário, e a próxima falha de verdade não é lida.
  const pastilhas = await page.locator("[data-conversa-nome]").count();
  ok("e a lista continua desenhada", pastilhas > 0, `${pastilhas} conversa(s)`);
}

console.log(`\nerros de página: ${erros.length}`);
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0, erros.join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
