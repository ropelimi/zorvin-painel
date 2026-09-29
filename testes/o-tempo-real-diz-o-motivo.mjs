// O TEMPO REAL CAI, E O MOTIVO FICA NO CONSOLE.
//
// `RealtimeChannel.subscribe` chama de volta com dois argumentos,
// `(status, err)`, e o painel recebia só o primeiro. O segundo era jogado fora
// sem nem um `console.error` — e por isso três hipóteses minhas sobre a causa
// desta queda caíram, uma atrás da outra, sem uma única linha de evidência.
//
// ATÉ 28/09 O MOTIVO TAMBÉM IA PARA A FAIXA VERMELHA. A faixa saiu naquele dia
// (o painel passou a RELER sozinho enquanto o canal está fora, e a frase dela
// deixou de ser verdade — ver `a-pesca-enquanto-o-canal-esta-fora`), e o
// console passou a ser o ÚNICO lugar onde a pista mora. Isso torna esta prova
// MAIS importante, e não menos: sem ela, a próxima queda não deixa rastro.
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

const doConsole = [];
page.on("console", (m) => { doConsole.push(`${m.type()}|${m.text()}`); });

const faixa = () => page.locator("[data-aviso-de-saude]");
const CARENCIA = 400;

// TODAS AS BANDEIRAS EM TODA ABERTURA. `addInitScript` ACUMULA: cada chamada
// acrescenta mais um script e todos rodam, em ordem, a cada carregamento.
const abrir = async ({ foraDesdeOInicio = false, motivo = "" } = {}) => {
  await ctx.clearCookies();
  doConsole.length = 0;
  await page.addInitScript(([c, fora, m]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__TEMPO_REAL_FORA = fora;
    globalThis.__MOTIVO_DO_CANAL = m;
    globalThis.__DEMORA_DO_CANAL = 30;
    globalThis.__CADENCIA_DA_PESCA = 100000;   // a pesca não interessa aqui
    globalThis.__SAUDE = [];
  }, [CARENCIA, foraDesdeOInicio, motivo]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
};

const derrubar = async (estado, motivo) => {
  await page.evaluate(([e, m]) => {
    if (typeof globalThis.__DERRUBAR_TEMPO_REAL === "function") {
      globalThis.__DERRUBAR_TEMPO_REAL(e, m);
    }
  }, [estado, motivo]);
  await page.waitForTimeout(300);
};
const levantar = async () => {
  await page.evaluate(() => {
    if (typeof globalThis.__LEVANTAR_TEMPO_REAL === "function") globalThis.__LEVANTAR_TEMPO_REAL();
  });
  await page.waitForTimeout(300);
};
const noConsole = (re) => doConsole.some((l) => l.startsWith("error|") && /tempo real/i.test(l) && re.test(l));

const MISMATCH = "mismatch between server and client bindings for postgres changes";

console.log("\n1. O motivo que a biblioteca manda CHEGA AO CONSOLE");
{
  await abrir();
  await derrubar("CHANNEL_ERROR", MISMATCH);
  ok("o console registra a queda", noConsole(/CHANNEL_ERROR/), doConsole.slice(-3).join(" // "));
  // ESTE É O CASO QUE MAIS IMPORTA: é o único em que o canal está MORTO e só
  // recarregar resolve. Sem a frase, ele é indistinguível de um wi-fi ruim.
  ok("com o motivo que a biblioteca deu", noConsole(/mismatch between server and client/i),
     doConsole.slice(-3).join(" // "));
}

console.log("\n2. Sem mensagem de erro, o ESTADO sozinho já é pista");
{
  // `TIMED_OUT` e `CHANNEL_ERROR` pedem providências opostas de quem lê — um é
  // rede, o outro costuma ser assinatura recusada. Registrar "caiu" para os
  // dois manda metade das investigações para o lugar errado.
  await abrir();
  await derrubar("TIMED_OUT", "");
  ok("o console traz o estado mesmo sem erro nenhum", noConsole(/TIMED_OUT/),
     doConsole.slice(-3).join(" // "));
  ok("e não inventa um motivo que não veio",
     !noConsole(/undefined|\[object/i), doConsole.slice(-3).join(" // "));
}

console.log("\n3. Motivo comprido não é cortado NO CONSOLE");
{
  // Na faixa ele era cortado em 110 letras, porque faixa vermelha com dez
  // linhas de erro é faixa que ninguém lê. No console vale o contrário: é
  // para lá que vai a pilha inteira, e cortar ali seria jogar fora a pista.
  const LONGO = "erro absurdamente comprido ".repeat(30);
  await abrir();
  await derrubar("CHANNEL_ERROR", LONGO);
  const maior = Math.max(0, ...doConsole.filter((l) => /tempo real/i.test(l)).map((l) => l.length));
  ok("o console ficou com o motivo inteiro", maior > LONGO.length * 0.9,
     `maior linha: ${maior} letras, motivo com ${LONGO.length}`);
}

console.log("\n4. E a TELA não diz nada — a faixa vermelha saiu em 28/09");
{
  // ESCRITA AO CONTRÁRIO DE PROPÓSITO. A faixa não foi escondida: ela deixou
  // de ser verdade, porque o painel passou a reler sozinho. Apagar esta
  // conferência deixaria o caminho aberto para ela voltar por engano — e o
  // Rodrigo pediu três vezes que ela saísse.
  await abrir();
  await derrubar("CHANNEL_ERROR", MISMATCH);
  await page.waitForTimeout(CARENCIA * 3);
  const texto = (await faixa().count()) ? await faixa().innerText() : "";
  ok("nenhuma faixa vermelha por causa do tempo real",
     !/chegando sozinhas|conexão ao vivo|reconectando/i.test(texto), texto.slice(0, 120));
  ok("e o motivo não vaza para a tela", !/CHANNEL_ERROR|mismatch/i.test(texto), texto.slice(0, 120));
}

console.log("\n5. Com o canal de pé, o console fica limpo");
{
  // A régua de sempre: um aviso que aparece quando está tudo bem se aprende a
  // ignorar, e aí o de verdade passa batido junto. Vale para o console também,
  // que é onde a próxima investigação vai olhar.
  await abrir();
  await page.waitForTimeout(CARENCIA * 3);
  ok("nada de erro de tempo real no console", !noConsole(/./),
     doConsole.filter((l) => l.startsWith("error|")).slice(-3).join(" // "));
  // E a volta também não deixa lixo.
  await derrubar("CHANNEL_ERROR", MISMATCH);
  await levantar();
  const depois = doConsole.filter((l) => l.startsWith("error|") && /tempo real/i.test(l)).length;
  ok("e voltando o canal, ele não registra a volta como erro", depois === 1,
     `${depois} linhas de erro para uma queda`);
}

await ctx.close();
await nav.close();
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
