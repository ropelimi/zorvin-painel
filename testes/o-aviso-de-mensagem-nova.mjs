// A QUEM O AVISO DE MENSAGEM NOVA INTERESSA — e com que som.
//
// PEDIDO DA EQUIPE, 15/09: poder escolher o som, e ser avisado das conversas
// em que a pessoa interagiu.
//
// O QUE HAVIA: um bipe fixo de 880 Hz, e o aviso filtrado pelo TELEFONE ABERTO
// na barra lateral. Com isso, a atendente que respondeu um cliente ontem na
// linha do Dr. B não era avisada quando ele voltava a escrever — bastava ela
// estar olhando a linha do Dr. A. O aviso chegava a quem estava à vista, e não
// a quem estava atendendo.
//
// AS TRÊS REGRAS, decididas em 15/09:
//
//   1. participei da conversa  -> avisa, esteja eu olhando o telefone que for;
//   2. participou outra pessoa -> NÃO avisa (a conversa tem dono, e aviso que
//      não pede ação de quem lê se aprende a ignorar);
//   3. ninguém participou      -> avisa TODO MUNDO. É a primeira mensagem de um
//      cliente novo, e deixá-la sem aviso é o lead ficar sem resposta.
//
// A REGRA 3 É A QUE MAIS IMPORTA AQUI. Ela é o contrapeso do pedido: "só as
// minhas" ao pé da letra calaria justamente a mensagem que ninguém pode perder.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Abre o painel espionando o que o aviso faz.
 *
 *  O SOM E A NOTIFICAÇÃO SÃO ESPIONADOS, e não silenciados: o que se mede aqui
 *  é QUANDO eles acontecem, e uma bancada que os desligasse aprovaria um painel
 *  que nunca avisa ninguém. */
async function abrirPainel(mensagensPlantadas = null) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((ms) => {
    globalThis.__AVISOS = [];
    // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
    globalThis.__SEMENTE = ms ? { mensagens: ms } : undefined;
    // O NAVEGADOR DE PROVA NÃO TEM ALTO-FALANTE nem permissão de notificar.
    // Trocamos os dois pelo registro do que teriam feito.
    class NotificacaoDeMentira {
      constructor(titulo, opcoes) {
        globalThis.__AVISOS.push({ o: "notificacao", titulo, ...(opcoes || {}) });
      }
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
    }
    globalThis.Notification = NotificacaoDeMentira;
    // O som passa pelo AudioContext; contar os osciladores criados diz se
    // tocou, e a frequência diz QUAL som.
    const ACreal = globalThis.AudioContext;
    if (ACreal) {
      globalThis.AudioContext = class extends ACreal {
        createOscillator() {
          const o = super.createOscillator();
          globalThis.__AVISOS.push({ o: "som" });
          return o;
        }
      };
    }
  }, mensagensPlantadas);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(900);
  return { ctx, page, estouros };
}

const avisos = (page) => page.evaluate(() => globalThis.__AVISOS || []);
const limpar = (page) => page.evaluate(() => { globalThis.__AVISOS = []; });

/** Faz chegar uma mensagem de cliente numa conversa, pelo mesmo caminho por
 *  onde o Supabase a entregaria. */
async function chegarDoCliente(page, convId) {
  await page.evaluate((cid) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: `aviso-${Date.now()}`, conversa_id: cid, origem: "contato",
      texto: "Chegou agora", criado_em: new Date().toISOString(),
    });
  }, convId);
  await page.waitForTimeout(1200);
}

/** Duas conversas quaisquer da bancada, para plantar histórico nelas. */
const duasConversas = (page) => page.evaluate(() =>
  (globalThis.__TABELAS.conversas || []).slice(0, 2).map((c) => c.id));

// ------------------------------------------------------------------
console.log("\nA tela de Avisos existe e deixa escolher o som");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Avisos" }).click();
  await page.waitForTimeout(400);

  ok("a aba Avisos abre", await page.locator("[data-aba-avisos]").count() === 1);
  // CINCO OPÇÕES, e "sem som" é uma delas: quem acha o aviso estridente hoje
  // desliga o volume da máquina, o que desliga junto o aviso que importa.
  const quantas = await page.locator("[data-som-opcao]").count();
  ok("oferece mais de um som, e um deles é 'sem som'",
     quantas >= 3 && await page.locator('[data-som-opcao="mudo"]').count() === 1,
     `contei ${quantas}`);

  // ESCOLHER TOCA. Escolher um som sem ouvi-lo é escolher no escuro.
  await limpar(page);
  await page.locator('[data-som-opcao="sino"]').click();
  await page.waitForTimeout(400);
  ok("escolher um som toca o som na hora",
     (await avisos(page)).some((a) => a.o === "som"));

  // E A ESCOLHA SOBREVIVE. Guardada no navegador, sem passar pelo banco — o
  // que importa num dia em que o Supabase está fora do ar.
  const guardado = await page.evaluate(() => localStorage.getItem("zorvin_som_do_aviso"));
  ok("e a escolha fica guardada", guardado === "sino", `guardou "${guardado}"`);

  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nE 'sem som' não desliga o aviso, só o barulho");
{
  const { ctx, page } = await abrirPainel();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Avisos" }).click();
  await page.waitForTimeout(400);
  await limpar(page);
  await page.locator('[data-som-opcao="mudo"]').click();
  await page.waitForTimeout(400);
  // A CONFERÊNCIA QUE SEPARA "SEM SOM" DE "SEM AVISO": escolher mudo não pode
  // tocar nada, e é o único da lista de que se espera silêncio.
  ok("escolher 'sem som' não toca nada",
     !(await avisos(page)).some((a) => a.o === "som"),
     JSON.stringify(await avisos(page)));
  const texto = await page.locator("[data-aba-avisos]").innerText();
  ok("e a tela diz que a notificação continua valendo",
     /Só a notificação na tela/i.test(texto), texto.slice(0, 300));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nA tela explica a quem o aviso interessa");
{
  // A REGRA NÃO PODE SER INVISÍVEL. Quem não for avisado de uma conversa vai
  // achar que o Zorvin falhou — a menos que a tela tenha dito qual é a regra.
  const { ctx, page } = await abrirPainel();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Avisos" }).click();
  await page.waitForTimeout(400);
  const texto = await page.locator("[data-aba-avisos]").innerText();
  ok("diz que vale para as conversas em que a pessoa respondeu",
     /conversa/i.test(texto) && /respondeu/i.test(texto), texto.slice(0, 300));
  ok("e que o cliente novo, sem dono, também avisa",
     /ningu[ée]m.*atendeu|cliente novo/i.test(texto), texto.slice(0, 300));
  ok("e que vale para TODOS os telefones, não só o aberto",
     /todos os telefones/i.test(texto), texto.slice(0, 300));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nE a regra: a conversa é minha, é de outro, ou não é de ninguém");
{
  // Descobre duas conversas de verdade da bancada para plantar histórico nelas.
  const sonda = await abrirPainel();
  const [convMinha, convDeOutro] = await duasConversas(sonda.page);
  await sonda.ctx.close();

  // `u1` é quem está logado na bancada; `u9` é um colega.
  const { ctx, page, estouros } = await abrirPainel([
    { id: 9001, conversa_id: convMinha, origem: "advogado", tipo: "texto",
      texto: "eu respondi aqui ontem", enviado_por_id: "u1",
      criado_em: new Date(Date.now() - 86400e3).toISOString() },
    { id: 9002, conversa_id: convDeOutro, origem: "advogado", tipo: "texto",
      texto: "quem respondeu foi a colega", enviado_por_id: "u9",
      criado_em: new Date(Date.now() - 86400e3).toISOString() },
  ]);

  // ---- 1. a conversa é minha -> avisa
  await limpar(page);
  await chegarDoCliente(page, convMinha);
  const naMinha = await avisos(page);
  ok("conversa em que EU respondi: avisa",
     naMinha.some((a) => a.o === "notificacao"), JSON.stringify(naMinha));
  // A ETIQUETA POR CONVERSA é o que faz dois clientes escrevendo virarem dois
  // avisos, em vez de o segundo apagar o primeiro sem deixar rastro.
  ok("e a etiqueta do aviso é daquela conversa",
     naMinha.some((a) => a.tag === `zorvin-conversa-${convMinha}`),
     JSON.stringify(naMinha.map((a) => a.tag)));

  // ---- 2. a conversa é de outra pessoa -> NÃO avisa
  await limpar(page);
  await chegarDoCliente(page, convDeOutro);
  const naDeOutro = await avisos(page);
  ok("conversa que OUTRA pessoa atende: não avisa",
     !naDeOutro.some((a) => a.o === "notificacao"), JSON.stringify(naDeOutro));

  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nE o cliente novo, que não é de ninguém, avisa todo mundo");
{
  // A REGRA 3, E O CONTRAPESO DE TUDO ISTO. "Só as minhas" ao pé da letra
  // calaria a primeira mensagem de um lead — a única que ninguém pode perder.
  //
  // A CONVERSA É NOVA EM FOLHA, e não uma das da bancada. Escrevi assim na
  // primeira vez — reaproveitando a terceira conversa — e a prova reprovou:
  // aquela conversa JÁ TEM histórico com autor, então ela é de alguém, e a
  // regra 2 se aplicava corretamente. A conferência falava de um caso que não
  // era o que ela dizia medir.
  //
  // E o cenário de verdade é este mesmo: cliente novo escrevendo pela primeira
  // vez cria uma conversa que nenhum painel conhece ainda.
  const convOrfa = `conversa-de-lead-novo-${Date.now()}`;
  const { ctx, page } = await abrirPainel([]);
  await limpar(page);
  await chegarDoCliente(page, convOrfa);
  const avisou = await avisos(page);
  ok("conversa que NINGUÉM atendeu ainda: avisa",
     avisou.some((a) => a.o === "notificacao"), JSON.stringify(avisou));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
