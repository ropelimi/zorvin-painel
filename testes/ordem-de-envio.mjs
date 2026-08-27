// TRÊS MENSAGENS SAEM NA ORDEM EM QUE FORAM ESCRITAS.
//
// Relato do escritório: "enviei 3 mensagens, que chegaram a ser enviadas mas
// fora de ordem".
//
// O QUE ACONTECIA. Cada Enter chamava `enviar()`, e `enviar()` grava a linha na
// fila com uma ida ao banco. Três Enters seguidos eram TRÊS IDAS AO MESMO
// TEMPO, cada uma correndo pela internet por conta própria. Quem chegasse
// primeiro ganhava o `criado_em` mais antigo — e é por `criado_em` que a ponte
// despacha. Ou seja: a ordem no celular do cliente era a ordem em que os
// pedidos ganharam a corrida da rede, e não a ordem em que a pessoa escreveu.
//
// Num 4G do fórum, com uma ida demorando 300 ms e a seguinte 80, isso acontece
// o tempo todo. E lido do outro lado, "pode vir amanhã às 14h" antes de
// "consegui remarcar sua audiência" é uma conversa diferente.
//
// COMO SE PROVA. A bancada dá à primeira gravação um atraso grande e às
// seguintes um pequeno — que é a instabilidade da rede de verdade. Sem a fila
// do navegador, a terceira mensagem chega ao banco antes da primeira; com ela,
// a segunda só sai depois de a primeira ter entrado.
//
// Isto NÃO era testável até agora, e vale dizer por quê: a bancada gravava a
// linha no instante da chamada, antes do atraso — então ela registrava sempre a
// ordem em que o painel PEDIU, fizesse a rede o que fizesse. Uma bancada que
// não consegue errar não consegue provar nada. Agora ela grava quando o pedido
// "chega", como um banco de verdade.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2000);
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(3000);

const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';
const TEXTOS = ["primeira", "segunda", "terceira"];

// A PRIMEIRA IDA DEMORA, AS OUTRAS NÃO. É o que inverte a ordem quando os três
// pedidos saem juntos — e é exatamente o caso que o escritório viveu.
await page.evaluate(() => {
  globalThis.__ATRASO_POR_TABELA = { fila_envio: [600, 30, 30] };
  globalThis.__TABELAS.fila_envio.length = 0;   // começa limpa, para a ordem ser lida sem ruído
});

console.log("\nTrês Enters seguidos entram na fila na ordem em que foram escritos");
{
  // Três Enters em sequência, sem esperar a tela assentar entre eles — que é
  // como se digita quando se tem pressa, e é quando o defeito aparecia.
  for (const t of TEXTOS) {
    await page.fill(CAMPO, t);
    await page.press(CAMPO, "Enter");
    await page.waitForTimeout(120);   // o tempo de trocar de linha, não o de esperar a rede
  }
  await page.waitForTimeout(4000);

  const naFila = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).map((l) => l.texto));
  console.log(`     ordem na fila: ${JSON.stringify(naFila)}`);

  ok("as três entraram na fila", naFila.length === 3, `entraram ${naFila.length}`);
  // A CONFERÊNCIA QUE PEGA O DEFEITO. Sem a fila do navegador vinha
  // ["segunda","terceira","primeira"]: a primeira, que pegou os 600 ms, chega
  // por último.
  ok("e na ordem em que foram escritas",
     JSON.stringify(naFila) === JSON.stringify(TEXTOS),
     `veio ${JSON.stringify(naFila)}, esperava ${JSON.stringify(TEXTOS)}`);
}

console.log("\nE as bolhas aparecem NA HORA, sem esperar a rede");
{
  // A trava contra o conserto que conserta demais. Serializar as IDAS AO BANCO
  // é o certo; serializar a TELA seria trocar um defeito por outro pior — a
  // pessoa apertaria Enter e ficaria olhando um campo vazio sem saber se
  // mandou. A bolha provisória tem de nascer antes da rede responder.
  await page.evaluate(() => {
    globalThis.__ATRASO_POR_TABELA = { fila_envio: [3000] };   // rede travada
    globalThis.__TABELAS.fila_envio.length = 0;
  });
  const antes = await page.evaluate(() => document.querySelectorAll("[data-msg-id]").length);
  await page.fill(CAMPO, "com a rede travada");
  await page.press(CAMPO, "Enter");
  await page.waitForTimeout(600);          // bem menos que os 3000 da rede
  const depois = await page.evaluate(() => document.querySelectorAll("[data-msg-id]").length);
  ok("a bolha aparece antes de o banco responder", depois > antes,
     `${antes} -> ${depois} bolhas em 600 ms, com a rede em 3000 ms`);
  const naFila = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).length);
  ok("e nesse instante a linha ainda NÃO está no banco — é a bolha provisória",
     naFila === 0, `já havia ${naFila} na fila`);
  await page.waitForTimeout(4000);
}

console.log("\nUm envio que falha não trava os seguintes");
{
  // A fila do navegador é uma corrente de promessas. Sem o `catch`, um envio
  // que falha deixa a corrente rejeitada e TODOS os seguintes são descartados
  // em silêncio — a pessoa digita, a bolha aparece, e nada nunca sai.
  await page.evaluate(() => {
    globalThis.__ATRASO_POR_TABELA = {};
    globalThis.__TABELAS.fila_envio.length = 0;
    globalThis.__QUEBRAR = ["fila_envio"];
  });
  await page.fill(CAMPO, "esta vai falhar");
  await page.press(CAMPO, "Enter");
  await page.waitForTimeout(1500);

  await page.evaluate(() => { globalThis.__QUEBRAR = []; });
  await page.fill(CAMPO, "esta tem de sair");
  await page.press(CAMPO, "Enter");
  await page.waitForTimeout(2500);

  const naFila = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).map((l) => l.texto));
  ok("depois de um envio que falha, o seguinte ainda sai",
     naFila.includes("esta tem de sair"), `na fila: ${JSON.stringify(naFila)}`);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
