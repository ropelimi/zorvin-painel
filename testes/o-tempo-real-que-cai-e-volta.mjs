// O TEMPO REAL QUE CAI — e a tela ficava calada exatamente como se ninguém
// tivesse escrito.
//
// O canal era assinado com `.subscribe()` SEM retorno de chamada. O painel
// nunca ficava sabendo se ele estava de pé: caindo a conexão (o wi-fi do
// escritório, a tampa do notebook fechada, o Supabase piscando), as mensagens
// novas paravam de aparecer — e a tela de uma conversa sem mensagem nova é
// IDÊNTICA à de uma conversa em que o cliente não respondeu. A pessoa fica
// olhando, esperando, e conclui a coisa errada.
//
// E TEM A METADE QUE NÃO É AVISO, que é a que dá mais trabalho e a que mais
// importa: o `postgres_changes` não repete o que passou. O que o banco publicou
// enquanto o canal esteve fora não chega nunca, nem depois que ele volta.
// Avisar sem reler deixaria a pessoa informada e a tela errada.
//
// Por isso a conferência central desta prova não é sobre a faixa: é sobre uma
// mensagem que ENTROU DURANTE A QUEDA aparecer quando o canal volta.
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

const faixa = () => page.locator("[data-aviso-de-saude]");
const texto = async () =>
  (await faixa().count()) ? (await faixa().innerText()).replace(/\s+/g, " ") : "";

// A CARÊNCIA DE PRODUÇÃO É DE DEZ SEGUNDOS, e é de propósito — ver o comentário
// dela no painel. Aqui ela é encurtada, senão cada cenário custaria dez segundos
// de espera para conferir o que se confere em um.
const CARENCIA = 400;

// TODAS AS BANDEIRAS SÃO ESCRITAS EM TODA ABERTURA, inclusive as que este
// cenário não usa. `addInitScript` ACUMULA: cada chamada acrescenta mais um
// script, e todos rodam, em ordem, a cada carregamento. Sem escrever tudo, a
// demora do canal de um cenário seguia valendo nos seguintes — e a última
// conferência reprovava porque o canal ainda não tinha subido, um assunto que
// não é o dela.
const abrir = async ({ foraDesdeOInicio = false, demoraDoCanal = 30 } = {}) => {
  await ctx.clearCookies();
  await page.addInitScript(([c, fora, demora]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__TEMPO_REAL_FORA = fora;
    globalThis.__DEMORA_DO_CANAL = demora;
    globalThis.__SAUDE = [];
  }, [CARENCIA, foraDesdeOInicio, demoraDoCanal]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
};
// DERRUBAR E LEVANTAR O CANAL — e reclamar com todas as letras se não der.
//
// Estes dois só existem porque o painel PASSA um retorno de chamada ao assinar
// o canal; é ao recebê-lo que a bancada os cria. Sem ele, a chamada morria com
// "__DERRUBAR_TEMPO_REAL is not a function" e um rastro de pilha — que é a
// mensagem certa para quem escreveu a bancada e a mensagem errada para quem vai
// consertar o painel. Aqui ela vira a frase que diz o que de fato aconteceu.
const mexerNoCanal = async (qual) => {
  const existe = await page.evaluate((q) => typeof globalThis[q] === "function", qual);
  if (!existe) {
    ok(`o painel olha o estado do canal (${qual})`, false,
       "o painel assinou o canal SEM retorno de chamada: ele não fica sabendo se o "
       + "tempo real caiu, e nenhuma conferência abaixo tem como rodar");
    return false;
  }
  await page.evaluate((q) => globalThis[q](), qual);
  return true;
};
const derrubar = () => mexerNoCanal("__DERRUBAR_TEMPO_REAL");
const levantar = () => mexerNoCanal("__LEVANTAR_TEMPO_REAL");


console.log("\n1. Com o canal de pé, a tela CALA");
{
  await abrir();
  ok("nenhuma faixa quando o tempo real está funcionando",
     (await faixa().count()) === 0,
     `apareceu: "${await texto()}" — aviso à toa faz o de verdade ser ignorado`);
}


console.log("\n2. O soluço de dois segundos NÃO pisca na tela");
{
  // Uma reconexão comum passa por "fora" e volta em seguida. Acender a faixa
  // nesse instante encheria o expediente de piscadas — e faixa que pisca à toa
  // se aprende a ignorar, junto com a queda de verdade.
  await abrir();
  await derrubar();
  await page.waitForTimeout(CARENCIA / 3);
  ok("dentro da carência, nada aparece",
     (await faixa().count()) === 0, await texto());
  await levantar();
  await page.waitForTimeout(CARENCIA * 2);
  ok("e depois de voltar, continua sem aparecer",
     (await faixa().count()) === 0, await texto());
}


console.log("\n3. A queda que dura é dita");
{
  await abrir();
  await derrubar();
  await page.waitForTimeout(CARENCIA * 3);
  const t = await texto();
  ok("passada a carência, a faixa aparece", (await faixa().count()) === 1, "nada apareceu");
  ok("dizendo que as mensagens novas não estão chegando sozinhas",
     /não estão chegando sozinhas/i.test(t), t);
  // A FRASE NÃO PEDE NADA À PESSOA. O canal volta sozinho e o painel relê —
  // mandar recarregar seria empurrar trabalho por algo que já é resolvido aqui.
  ok("e que estamos reconectando, em vez de mandar recarregar",
     /reconectando/i.test(t) && !/recarregue|atualize a página/i.test(t), t);
}


console.log("\n4. A VOLTA RELÊ — a mensagem que entrou durante a queda aparece");
{
  // Esta é a conferência central. Sem ela, "o canal voltou" poderia ser só a
  // faixa sumindo — com a conversa continuando sem a mensagem que chegou no
  // meio, que é exatamente o estrago que este trabalho existe para evitar.
  await abrir();
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1500);
  const conversa = await page.evaluate(() =>
    document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));

  await derrubar();
  await page.waitForTimeout(CARENCIA * 3);
  ok("a faixa está acesa", (await faixa().count()) === 1, await texto());

  // A MENSAGEM ENTRA NO BANCO SEM AVISO NENHUM — nada de `__EMITIR`. É assim
  // que acontece de verdade: o Postgres publicou, e o canal não estava lá para
  // ouvir. Usar `__EMITIR` aqui provaria outra coisa (que o painel trata um
  // evento recebido), e não esta.
  await page.evaluate((c) => {
    globalThis.__TABELAS.mensagens.push({
      id: "durante-a-queda", conversa_id: c, tipo: "texto", origem: "contato",
      texto: "cheguei enquanto a conexão estava fora",
      criado_em: new Date().toISOString(),
    });
  }, conversa);
  await page.waitForTimeout(600);
  ok("e ela NÃO está na tela enquanto o canal está fora",
     (await page.locator('[data-msg-id="durante-a-queda"]').count()) === 0,
     "se ela aparecesse sozinha, esta prova não estaria medindo o tempo real");

  await levantar();
  await page.waitForTimeout(2500);
  ok("voltando o canal, a faixa some",
     (await faixa().count()) === 0, await texto());
  ok("e a mensagem que entrou durante a queda APARECE",
     (await page.locator('[data-msg-id="durante-a-queda"]').count()) === 1,
     "o postgres_changes não repete o que passou: sem reler, ela não chegaria nunca");
}


console.log("\n5. A primeira assinatura não relê à toa");
{
  // Abrir o painel já carrega tudo. Reler ali seria uma segunda leitura de tudo
  // a cada abertura — em oito telefones e centenas de conversas, isso é caro e
  // não conserta nada, porque não houve fresta nenhuma.
  //
  // O CANAL DEMORA DE PROPÓSITO AQUI. Subindo aos 30ms, o primeiro `SUBSCRIBED`
  // cai junto com a carga inicial e não sobra janela: as duas contagens já o
  // incluiriam, e a conferência passaria com o painel relendo a cada abertura.
  // Foi o que aconteceu — a sabotagem "relê sempre" passou incólume por aqui.
  await ctx.clearCookies();
  await page.addInitScript(([c]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__TEMPO_REAL_FORA = false;
    globalThis.__SAUDE = [];
    globalThis.__DIARIO = [];
    globalThis.__DEMORA_DO_CANAL = 3000;
  }, [CARENCIA]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);

  // O DIÁRIO GUARDA OBJETOS, e não o nome da tabela. Esta linha era
  // `m === "conversas"` e NUNCA casava: a conferência comparava zero com zero e
  // passava por não estar medindo nada. Um verde que fala de outro assunto — e
  // foi uma sabotagem que o mostrou, não a leitura do código.
  const contar = () => page.evaluate(() =>
    (globalThis.__DIARIO || []).filter((m) => m && m.tabela === "conversas").length);

  const antes = await contar();
  ok("a abertura do painel leu as conversas", antes > 0,
     "se nem isso foi medido, o resto desta conferência não quer dizer nada");

  // Passa o instante em que o canal sobe.
  await page.waitForTimeout(2500);
  const depois = await contar();
  ok("o canal subindo pela primeira vez não dispara releitura",
     depois === antes, `foram ${antes} e viraram ${depois}`);
}


console.log("\n6. Quem abre o painel com a conexão já ruim é avisado");
{
  // O caso de quem chega de manhã com o wi-fi do escritório instável. Sem esta,
  // a tela mostraria a lista carregada e nada mais — parada para sempre, sem
  // uma palavra.
  await abrir({ foraDesdeOInicio: true });
  await page.waitForTimeout(CARENCIA * 3);
  ok("a faixa aparece mesmo sem nunca ter havido conexão ao vivo",
     /não estão chegando sozinhas/i.test(await texto()), await texto());
}


await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
