// O PATO, E A CHAVE DO AVISO NA TELA
//
// Dois pedidos do Rodrigo em 25/09: um som de pato, e poder desligar as
// notificações que aparecem quando chega mensagem.
//
// ------------------------------------------------------------
// O PATO NÃO É UMA NOTA PARADA
//
// Os quatro sons de antes eram frequências fixas. Um grasnado é uma DESCIDA de
// tom: começa agudo e cai depressa. Tocado como os outros, sai um bipe grave —
// e um bipe grave não é um pato. Por isso a receita cresceu em dois campos
// opcionais (`ate`, a descida; `filtro`, que tira o áspero da onda dente de
// serra), e é isso que esta prova mede: não "tocou alguma coisa", e sim
// "tocou uma coisa com o feitio de grasnado".
//
// E SÃO DOIS grasnados, porque "quá-quá" se reconhece e um "quá" sozinho não.
//
// ------------------------------------------------------------
// A CHAVE DA TARJA NÃO É O "SEM SOM"
//
// "Sem som" tira o barulho e deixa a tarja; esta tira a tarja e deixa o
// barulho. São duas incomodações diferentes — quem trabalha de fone quer o
// contrário de quem senta numa sala silenciosa —, e uma opção só obrigaria a
// desligar as duas para se livrar de uma. A prova guarda essa separação nas
// duas direções.
//
// O SOM E A NOTIFICAÇÃO SÃO ESPIONADOS, e não silenciados: uma bancada que os
// desligasse aprovaria um painel que nunca avisa ninguém.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript(() => {
    globalThis.__AVISOS = [];
    globalThis.__SEMENTE = undefined;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
    class NotificacaoDeMentira {
      constructor(titulo, opcoes) {
        globalThis.__AVISOS.push({ o: "notificacao", titulo, ...(opcoes || {}) });
      }
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
    }
    globalThis.Notification = NotificacaoDeMentira;
    // O ESPIÃO DO SOM REGISTRA O FEITIO, e não só "tocou".
    //
    // Contar osciladores diria que houve som — e um bipe também é som. O que
    // separa o pato do bipe é a onda, a descida de tom e o filtro, então é
    // isso que fica registrado. Tudo é lido no `start()`, quando a receita já
    // terminou de configurar o oscilador.
    const ACreal = globalThis.AudioContext;
    if (ACreal) {
      globalThis.AudioContext = class extends ACreal {
        createOscillator() {
          const o = super.createOscillator();
          // O CONTORNO INTEIRO, e não só o último degrau.
          //
          // O espião guardava `desceuAte` e cada rampa o SOBRESCREVIA. Com o
          // pato de hoje são duas rampas — sobe até o pico, cai até o fim —, e
          // guardando só a última a prova não teria como ver a SUBIDA, que é
          // justamente o que separa um "quac" de um bipe caindo.
          const registro = { o: "som", forma: null, hz: null, contorno: [], desceuAte: null };
          globalThis.__AVISOS.push(registro);
          const rampaReal = o.frequency.exponentialRampToValueAtTime.bind(o.frequency);
          o.frequency.exponentialRampToValueAtTime = (v, t) => {
            registro.contorno.push(v);
            registro.desceuAte = v;
            return rampaReal(v, t);
          };
          const startReal = o.start.bind(o);
          o.start = (t) => {
            registro.forma = o.type;
            registro.hz = o.frequency.value;
            return startReal(t);
          };
          return o;
        }
        createBiquadFilter() {
          const f = super.createBiquadFilter();
          // O TIPO DO FILTRO É O QUE MUDA O TIMBRE, e contar filtros não o vê:
          // passa-baixa abafa, passa-faixa RESSOA. Era a diferença entre um
          // pato e um bipe abafado, e o espião não a registrava.
          const registro = { o: "filtro", tipo: null, hz: null, q: null };
          globalThis.__AVISOS.push(registro);
          queueMicrotask(() => {
            registro.tipo = f.type; registro.hz = f.frequency.value; registro.q = f.Q.value;
          });
          return f;
        }
      };
    }
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(900);
  return { ctx, page, estouros };
}

const avisos = (page) => page.evaluate(() => globalThis.__AVISOS || []);
const limpar = (page) => page.evaluate(() => { globalThis.__AVISOS = []; });

async function abrirAbaAvisos(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Avisos" }).last().click();
  await page.waitForTimeout(500);
  return (await page.locator("[data-aba-avisos]").count()) === 1;
}

/** Faz chegar uma mensagem de cliente numa conversa que NINGUÉM atendeu.
 *
 *  Conversa que não existe na bancada é órfã por construção — e órfã avisa
 *  todo mundo (a regra 3 de 15/09). É o caso que garante que o aviso sai, sem
 *  depender de quem respondeu o quê. */
async function chegarDeClienteNovo(page) {
  await page.evaluate(() => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: `pato-${Date.now()}`, conversa_id: `conv-nova-${Date.now()}`,
      origem: "contato", texto: "Chegou agora", criado_em: new Date().toISOString(),
    });
  });
  await page.waitForTimeout(1300);
}

// ==================================================================
console.log("\nO pato está na lista de sons, e a escolha fica guardada");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await abrirAbaAvisos(page);
  ok("a aba Avisos abre", abriu);
  const tem = (await page.locator('[data-som-opcao="pato"]').count()) === 1;
  ok("o pato é uma das opções", tem);
  if (tem) {
    await page.locator('[data-som-opcao="pato"]').click();
    await page.waitForTimeout(400);
    const guardado = await page.evaluate(() => localStorage.getItem("zorvin_som_do_aviso"));
    ok("escolher o pato guarda a escolha no navegador", guardado === "pato", String(guardado));
    // E SOBREVIVE AO F5: uma escolha que se perde ao recarregar é uma escolha
    // que a pessoa refaz todo dia até desistir.
    await page.reload();
    await page.waitForSelector("[data-conversa-nome]");
    await page.waitForTimeout(800);
    ok("e continua escolhida depois de recarregar",
       (await page.evaluate(() => localStorage.getItem("zorvin_som_do_aviso"))) === "pato");
  } else {
    ok("escolher o pato guarda a escolha no navegador", false);
    ok("e continua escolhida depois de recarregar", false);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nE ele soa como pato: dois grasnados, cada um SUBINDO e depois caindo");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await abrirAbaAvisos(page);
  ok("a aba Avisos abre", abriu);
  await limpar(page);
  await page.locator('[data-som-opcao="pato"]').click();
  await page.waitForTimeout(500);
  const tocou = (await avisos(page)).filter((a) => a.o === "som");
  const filtros = (await avisos(page)).filter((a) => a.o === "filtro");

  // DOIS, e não um: "quá-quá" se reconhece, "quá" sozinho não.
  ok("toca dois grasnados", tocou.length === 2, JSON.stringify(tocou));
  // O CONTORNO É O QUE FAZ O PATO, e ele tem DUAS metades.
  //
  // A primeira versão só descia, e por isso saía um bipe caindo: o ouvido lê
  // "quac" quando o tom SALTA para cima e despenca — a subida é o "qua", a
  // queda é o "c". Conferir só a descida aprovaria de volta exatamente o som
  // que o Rodrigo pediu para trocar em 28/09.
  ok("os dois SOBEM primeiro, bem acima de onde começaram",
     tocou.length === 2 && tocou.every((n) => n.contorno.length === 2 && n.contorno[0] > n.hz * 1.8),
     JSON.stringify(tocou.map((n) => ({ de: n.hz, contorno: n.contorno }))));
  ok("e depois CAEM abaixo de onde começaram",
     tocou.length === 2 && tocou.every((n) => n.contorno.length === 2 && n.contorno[1] < n.hz),
     JSON.stringify(tocou.map((n) => ({ de: n.hz, contorno: n.contorno }))));
  // A onda dente de serra é o timbre do grasnado; a senoide dos outros sons
  // sairia como um assobio.
  ok("e são onda dente de serra", tocou.every((n) => n.forma === "sawtooth"),
     JSON.stringify(tocou.map((n) => n.forma)));
  ok("com dois filtros", filtros.length === 2, `${filtros.length} filtro(s)`);
  // PASSA-FAIXA, E NÃO PASSA-BAIXA. Um abafa; o outro RESSOA, e é a
  // ressonância estreita perto de 1 kHz que dá o timbre nasalado do bicho.
  // Contar filtros não vê a diferença — e ela é metade do conserto de 28/09.
  ok("e eles RESSOAM em vez de só abafar (passa-faixa)",
     filtros.length === 2 && filtros.every((f) => f.tipo === "bandpass"),
     JSON.stringify(filtros.map((f) => f.tipo)));
  ok("com a ressonância na faixa nasalada, perto de 1 kHz",
     filtros.length === 2 && filtros.every((f) => f.hz >= 800 && f.hz <= 1600 && f.q >= 1.5),
     JSON.stringify(filtros));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nOs sons de antes não mudaram — nem descida, nem filtro");
{
  // O CONTRASTE DA RECEITA. Os dois campos novos são opcionais, e um conserto
  // que os aplicasse a todo mundo transformaria os quatro sons de sempre em
  // outra coisa, sem ninguém ter pedido.
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await abrirAbaAvisos(page);
  ok("a aba Avisos abre", abriu);
  await limpar(page);
  await page.locator('[data-som-opcao="toque"]').click();
  await page.waitForTimeout(500);
  const tudo = await avisos(page);
  const tocou = tudo.filter((a) => a.o === "som");
  ok('"Toque" continua sendo uma nota só', tocou.length === 1, JSON.stringify(tocou));
  ok("e ela NÃO desce de tom", tocou.every((n) => n.desceuAte === null), JSON.stringify(tocou));
  // Sem `.every` aqui, e é o vigia `provas-que-reprovam` que ensinou: numa
  // lista vazia ele devolve `true`, e a conferência passaria dizendo que não
  // houve filtro num cenário em que não houve NADA.
  const semFiltro = tudo.filter((a) => a.o === "filtro");
  ok("e não passa por filtro nenhum", tocou.length === 1 && semFiltro.length === 0,
     `${semFiltro.length} filtro(s)`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nA chave da tarja começa LIGADA, e a mensagem nova aparece na tela");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await abrirAbaAvisos(page);
  ok("a aba Avisos abre", abriu);
  const chave = page.locator("[data-chave-aviso-na-tela] button");
  ok("a chave está na tela", (await chave.count()) === 1);
  // LIGADA DE SAÍDA. Quem nunca abriu esta tela continua sendo avisado como
  // sempre foi; desligar é uma escolha, e não o estado em que o programa chega.
  ok("e começa ligada", (await chave.getAttribute("aria-checked")) === "true");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await limpar(page);
  await chegarDeClienteNovo(page);
  const depois = await avisos(page);
  ok("chegando mensagem, a tarja do sistema aparece",
     depois.some((a) => a.o === "notificacao"), JSON.stringify(depois));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nDesligada, a tarja some — e o SOM continua, que é o ponto");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await abrirAbaAvisos(page);
  ok("a aba Avisos abre", abriu);
  const chave = page.locator("[data-chave-aviso-na-tela] button");
  await chave.click();
  await page.waitForTimeout(400);
  ok("a chave fica desligada", (await chave.getAttribute("aria-checked")) === "false");
  // E A TELA DIZ O QUE SOBRA. Sem essa frase, quem desliga fica sem saber se
  // acabou de se calar por inteiro — e é por essa dúvida que alguém religa.
  ok("e a tela diz que o som e o selo continuam",
     (await page.locator("[data-tarja-desligada]").count()) === 1);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await limpar(page);
  await chegarDeClienteNovo(page);
  const depois = await avisos(page);
  ok("chegando mensagem, NÃO aparece tarja nenhuma",
     !depois.some((a) => a.o === "notificacao"), JSON.stringify(depois));
  // AS DUAS CHAVES SÃO INDEPENDENTES, e esta é a metade que uma opção só
  // destruiria: desligar a tarja não é pedir silêncio.
  ok("mas o som TOCA, como sempre tocou",
     depois.some((a) => a.o === "som"), JSON.stringify(depois));

  // E A ESCOLHA SOBREVIVE AO F5, como a do som.
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(800);
  await limpar(page);
  await chegarDeClienteNovo(page);
  const depoisDoF5 = await avisos(page);
  ok("depois de recarregar, a tarja continua desligada",
     !depoisDoF5.some((a) => a.o === "notificacao"), JSON.stringify(depoisDoF5));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
