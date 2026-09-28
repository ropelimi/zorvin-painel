// O TEMPO REAL CAÍA E A TELA NÃO DIZIA POR QUÊ.
//
// A faixa vermelha dizia "as mensagens novas não estão chegando sozinhas" e
// mais nada. O motivo CHEGAVA: `RealtimeChannel.subscribe` chama de volta com
// dois argumentos, `(status, err)`, e o painel recebia só o primeiro. O
// segundo era jogado fora — sem nem um `console.error`.
//
// É a MESMA FORMA que este projeto já encontrou quatro vezes: a tela desenhava
// ausência no lugar de falha (04/09), sucesso no lugar de falha (24/09), falha
// SEM CAUSA (25/09) e silêncio no lugar de uma explicação (28/09). Aqui é a
// falha sem causa outra vez, e o custo já foi medido: em 24/09 uma rodada
// inteira de scripts no Supabase para descobrir o que o navegador sabia no
// primeiro segundo.
//
// E O MOTIVO SEPARA DEFEITOS QUE PEDEM COISAS OPOSTAS. "mismatch between
// server and client bindings" é o canal MORTO (só recarregar resolve);
// `CHANNEL_ERROR` seco costuma ser assinatura recusada (RLS, ou a tabela fora
// da publicação); `TIMED_OUT` é rede. Sem o motivo, as três viram a mesma
// frase e quem for consertar recomeça do zero, adivinhando.
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

// O CONSOLE É METADE DO CONSERTO, e por isso é medido aqui e não só de olho.
// A faixa leva a frase curta; o console leva o erro inteiro — a mesma régua de
// `comOCodigo`, em `gravar.js`. Guardar um sem o outro deixa metade do defeito
// sem prova: a tela pode dizer o motivo e o console continuar mudo, que é
// justamente onde quem conserta olha primeiro.
const doConsole = [];
page.on("console", (m) => { doConsole.push(`${m.type()}|${m.text()}`); });

const faixa = () => page.locator("[data-aviso-de-saude]");
const texto = async () =>
  (await faixa().count()) ? (await faixa().innerText()).replace(/\s+/g, " ") : "";

const CARENCIA = 400;

// TODAS AS BANDEIRAS EM TODA ABERTURA. `addInitScript` ACUMULA: cada chamada
// acrescenta mais um script e todos rodam, em ordem, a cada carregamento —
// então uma bandeira escrita num cenário continua valendo nos seguintes, e a
// prova passa a reprovar falando de outro assunto. Já aconteceu duas vezes
// nesta casa.
const abrir = async ({ foraDesdeOInicio = false, motivo = "" } = {}) => {
  await ctx.clearCookies();
  doConsole.length = 0;
  await page.addInitScript(([c, fora, m]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__TEMPO_REAL_FORA = fora;
    globalThis.__MOTIVO_DO_CANAL = m;
    globalThis.__DEMORA_DO_CANAL = 30;
    globalThis.__SAUDE = [];
  }, [CARENCIA, foraDesdeOInicio, motivo]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
};

// DERRUBAR COM MOTIVO. A bancada só mandava o estado — e uma bancada que
// esconde o segundo argumento aprova igualmente o painel que o lê e o que o
// joga fora, que é o jeito de um teste não testar nada.
const derrubar = async (estado, motivo) => {
  await page.evaluate(([e, m]) => {
    if (typeof globalThis.__DERRUBAR_TEMPO_REAL === "function") {
      globalThis.__DERRUBAR_TEMPO_REAL(e, m);
    }
  }, [estado, motivo]);
};
const levantar = async () => {
  await page.evaluate(() => {
    if (typeof globalThis.__LEVANTAR_TEMPO_REAL === "function") globalThis.__LEVANTAR_TEMPO_REAL();
  });
};
const esperarAFaixa = () => page.waitForTimeout(CARENCIA * 3);

const MISMATCH = "mismatch between server and client bindings for postgres changes";

console.log("\n1. O motivo que a biblioteca manda CHEGA À TELA");
{
  await abrir();
  await derrubar("CHANNEL_ERROR", MISMATCH);
  await esperarAFaixa();
  const t = await texto();
  ok("a faixa apareceu", (await faixa().count()) === 1, t);
  ok("e ela traz o ESTADO do canal", /CHANNEL_ERROR/.test(t), t);
  // ESTE É O CASO QUE MAIS IMPORTA: é o único em que o canal está MORTO e só
  // recarregar resolve. Sem a frase, ele é indistinguível de um wi-fi ruim.
  ok("e o motivo que a biblioteca deu", /mismatch between server and client/i.test(t), t);
  // A ORDEM É A DECISÃO. Quem atende lê a primeira metade e já sabe o que
  // fazer; quem conserta lê a segunda. Ao contrário, a frase vira coisa de
  // máquina e o recado se perde no meio.
  const ondeAcao = t.search(/não estão chegando sozinhas/i);
  const ondeMotivo = t.search(/CHANNEL_ERROR/);
  ok("o que fazer vem ANTES do motivo", ondeAcao >= 0 && ondeMotivo > ondeAcao,
     `ação em ${ondeAcao}, motivo em ${ondeMotivo}`);
  ok("e o erro inteiro foi para o console",
     doConsole.some((l) => l.startsWith("error|") && /tempo real/i.test(l) && /mismatch/i.test(l)),
     doConsole.slice(-4).join(" // "));
}

console.log("\n2. Sem mensagem de erro, o ESTADO sozinho já é pista");
{
  // `TIMED_OUT` e `CHANNEL_ERROR` pedem providências opostas de quem lê — um é
  // rede, o outro costuma ser assinatura recusada. Escrever "a conexão caiu"
  // para os dois manda metade das pessoas procurar defeito no lugar errado.
  await abrir();
  await derrubar("TIMED_OUT", "");
  await esperarAFaixa();
  const t = await texto();
  ok("a faixa traz o estado mesmo sem erro nenhum", /TIMED_OUT/.test(t), t);
  ok("e não inventa um motivo que não veio", !/undefined|null|\[object/i.test(t), t);
  ok("o console registrou a queda assim mesmo",
     doConsole.some((l) => l.startsWith("error|") && /tempo real/i.test(l) && /TIMED_OUT/.test(l)),
     doConsole.slice(-4).join(" // "));
}

console.log("\n3. Guarda o PRIMEIRO motivo, e não o último");
{
  // Cada tentativa do vigia que não pega gera outro `CHANNEL_ERROR`. Guardando
  // o último, a causa da queda ficaria soterrada pelas consequências dela — é
  // a mesma razão que arma os três relógios uma vez só.
  await abrir();
  await derrubar("CHANNEL_ERROR", "o primeiro erro, que é a causa");
  await page.waitForTimeout(80);
  await derrubar("CHANNEL_ERROR", "o segundo erro, que é o vigia apanhando");
  await esperarAFaixa();
  const t = await texto();
  ok("a faixa mostra a causa", /o primeiro erro/i.test(t), t);
  ok("e não a consequência", !/o segundo erro/i.test(t), t);
}

console.log("\n4. Voltando o canal, o motivo some junto");
{
  // Motivo velho em queda nova é pior do que motivo nenhum: manda procurar um
  // defeito que já passou.
  await abrir();
  await derrubar("CHANNEL_ERROR", "o erro velho");
  await esperarAFaixa();
  const durante = await texto();
  ok("com o canal fora, o motivo está na faixa", /o erro velho/i.test(durante), durante);
  await levantar();
  await page.waitForTimeout(300);
  ok("voltando, a faixa some", (await faixa().count()) === 0, await texto());
  await derrubar("TIMED_OUT", "");
  await esperarAFaixa();
  const depois = await texto();
  ok("e a queda seguinte NÃO repete o motivo velho", !/o erro velho/i.test(depois), depois);
  ok("mostrando o estado desta queda", /TIMED_OUT/.test(depois), depois);
}

console.log("\n5. Motivo comprido é cortado — a faixa continua legível");
{
  // A biblioteca do Realtime chega a devolver uma pilha inteira. Uma faixa
  // vermelha com dez linhas de erro é uma faixa que ninguém lê, inclusive a
  // parte que importa, que vem na frente.
  const LONGO = "erro absurdamente comprido ".repeat(30);
  await abrir();
  await derrubar("CHANNEL_ERROR", LONGO);
  await esperarAFaixa();
  const t = await texto();
  ok("o começo do motivo aparece", /erro absurdamente comprido/i.test(t), t.slice(0, 120));
  ok("mas ele não vai inteiro para a tela", t.length < LONGO.length, `faixa com ${t.length} letras`);
  ok("e o corte é anunciado com reticências", /…/.test(t), t.slice(-60));
  ok("o console, esse, ficou com o erro inteiro",
     doConsole.some((l) => l.length > LONGO.length * 0.9 && /tempo real/i.test(l)),
     `maior linha: ${Math.max(0, ...doConsole.map((l) => l.length))} letras`);
}

console.log("\n6. Com o canal de pé, nada disto aparece");
{
  // A régua de sempre: um aviso que aparece quando está tudo bem se aprende a
  // ignorar, e aí o de verdade passa batido junto.
  await abrir();
  await esperarAFaixa();
  ok("nenhuma faixa com o tempo real funcionando", (await faixa().count()) === 0, await texto());
  ok("e nada de erro no console",
     !doConsole.some((l) => l.startsWith("error|") && /tempo real/i.test(l)),
     doConsole.filter((l) => l.startsWith("error|")).slice(-3).join(" // "));
}

await ctx.close();
await nav.close();
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
