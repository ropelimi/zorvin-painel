// OS BICHOS DO AVISO — hoje, a galinha, o gato e o cachorro; e o assobio (02/10)
//
// Pedido do Rodrigo, depois do pato: outros bichos. A galinha e o gato são as
// gravações que ele mandou em 02/10, inteiras — só sem o silêncio das pontas.
// (Antes delas houve um "pó" cortado de um clipe e um miado sintetizado, que
// ele não aprovou.) Vaca e porco entraram sintetizados e SAÍRAM — ele não gostou; a
// régua é a do pato: quem não ouve o som não o fabrica, pede a gravação.
// Quando elas chegarem, cada bicho novo entra na lista BICHOS abaixo.
//
// O QUE ESTA PROVA GUARDA, para cada bicho:
//
//   1. ele é uma opção da tela de Avisos, com o nome escrito;
//   2. escolhê-lo toca a GRAVAÇÃO — uma vez, curta, e NENHUM oscilador. Sem
//      isso, o arquivo podia não sair na publicação e o encosto tocaria no
//      lugar, calado: ele funciona bem demais para alguém notar sozinho;
//   3. sem o arquivo, sai o encosto sintetizado, e não silêncio;
//   4. a mensagem nova toca o bicho ESCOLHIDO, e não o pato nem o Toque.
//
// O SOM É ESPIONADO, e não silenciado: uma bancada que o desligasse
// aprovaria um painel que nunca avisa ninguém.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// QUANTO CADA UM DURA, com folga. Mede que é O bicho, e não outro arquivo
// trocado no caminho: o cacarejo e o miado têm sete décimos de segundo, o
// pato pouco mais de um quinto — e o "pó" de 01/10, que saiu, tinha três.
// Como os dois bichos têm a mesma duração, quem os separa é a impressão
// digital (um arquivo trocado pelo outro passaria em tudo o mais).
//
// UMA LISTA ESCRITA AQUI, e não lida do painel: se um bicho sumir da receita,
// é esta lista que o procura e reprova. Lida de lá, ela encolheria junto.
const BICHOS = [
  // A IMPRESSÃO DIGITAL é a do arquivo que `sons/cortar-gravacao.py` faz a
  // partir da gravação que o Rodrigo escolheu. Sem ela, devolver um arquivo
  // antigo passaria no que se mede de fora — em 01/10 a galinha com música
  // tinha a mesma duração, o mesmo tamanho e o mesmo volume da certa. Trocou
  // o arquivo de propósito? Refaça pela receita e troque o número aqui.
  //
  // DUAS NOTAS NO ENCOSTO, como as duas partes do cacarejo: o "có" curto e
  // o "cóóó" longo.
  { id: "galinha", nome: "Galinha", min: 0.65, max: 0.80, notas: 2,
    sha256: "03746544b0074b4932739d826bd5dd0c266d645c6995d7b034d46d4c5cf4eb13" },
  { id: "gato", nome: "Gato", min: 0.65, max: 0.80, notas: 1,
    sha256: "e4ebd3ce69b64654d94822e1809c2820bc5a3300ca176e3aed3960e3cf042b36" },
  // O CACHORRO é um latido só, curto: o rosnadinho e o "au". Duas notas no
  // encosto, como as duas partes.
  { id: "cachorro", nome: "Cachorro", min: 0.32, max: 0.42, notas: 2,
    sha256: "ac1db05bc623f62d394aedae4cd61467e9bd6abdbb60160e44514533ed0f5b08" },
  // O ASSOBIO não é bicho, e mora aqui pelo mesmo motivo: é uma gravação que
  // o Rodrigo mandou, e tudo o que esta prova guarda vale para ele igual.
  // Duas notas no encosto, como o "fiu" e o "fiuuu".
  { id: "assobio", nome: "Assobio", min: 0.72, max: 0.82, notas: 2,
    sha256: "14976e16368fce6e31d155af710cc8836588622777c41f1db9f428beda18a5a5" },
];
const ESCOLHIDO = BICHOS[0];

const nav = await abrirNavegador();

async function abrirPainel(semArquivo = null) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  if (semArquivo) await page.route(`**/avisos/${semArquivo}.wav`, (rota) => rota.abort());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript(() => {
    globalThis.__AVISOS = [];
    globalThis.__SEMENTE = undefined;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
    class NotificacaoDeMentira {
      constructor(titulo, opcoes) { globalThis.__AVISOS.push({ o: "notificacao", titulo, ...(opcoes || {}) }); }
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
    }
    globalThis.Notification = NotificacaoDeMentira;
    const ACreal = globalThis.AudioContext;
    if (ACreal) {
      globalThis.AudioContext = class extends ACreal {
        createOscillator() {
          const o = super.createOscillator();
          globalThis.__AVISOS.push({ o: "som" });
          return o;
        }
        createBufferSource() {
          const f = super.createBufferSource();
          const registro = { o: "gravacao", dura: null };
          globalThis.__AVISOS.push(registro);
          const startReal = f.start.bind(f);
          f.start = (t) => { registro.dura = f.buffer ? f.buffer.duration : null; return startReal(t); };
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

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova
 *  inteira depois de 30s, e uma prova que estoura não diz QUAL conferência
 *  pegou o defeito. */
async function escolher(page, id) {
  const opcao = page.locator(`[data-som-opcao="${id}"]`);
  if (!(await opcao.count())) return false;
  await opcao.click();
  await page.waitForTimeout(1000);
  return true;
}

// ==================================================================
console.log("\nOs bichos estão na tela de Avisos, com o nome escrito");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("a aba Avisos abre", await abrirAbaAvisos(page));
  for (const b of BICHOS) {
    const id = b.id;
    const opcao = page.locator(`[data-som-opcao="${id}"]`);
    const visivel = (await opcao.count()) === 1 && (await opcao.isVisible());
    ok(`${b.nome} é uma opção`, visivel);
    ok(`e diz "${b.nome}"`, visivel && (await opcao.innerText()).includes(b.nome));
  }
  // O "SEM SOM" CONTINUA SENDO O ÚLTIMO. Ele não é um som: é a ausência dele,
  // e no meio dos bichos ele seria clicado por engano procurando o próximo.
  const ordem = await page.$$eval("[data-som-opcao]", (ns) => ns.map((n) => n.getAttribute("data-som-opcao")));
  ok('"Sem som" continua no fim da lista', ordem[ordem.length - 1] === "mudo", ordem.join(","));
  // OS QUE SAÍRAM NÃO VOLTAM calados: vaca e porco foram sintetizados e
  // reprovados por quem ouve, e uma limpeza futura que os devolvesse com a
  // mesma receita passaria por aqui. (O gato voltou como GRAVAÇÃO, e é a
  // impressão digital, mais abaixo, que garante que é ela.)
  ok("vaca e porco sintetizados não estão na lista",
     !["vaca", "porco"].some((id) => ordem.includes(id)), ordem.join(","));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nEscolher cada bicho toca a GRAVAÇÃO dele — e não o encosto");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirAbaAvisos(page);
  for (const b of BICHOS) {
    const id = b.id;
    await limpar(page);
    const clicou = await escolher(page, id);
    const tudo = await avisos(page);
    const gravacoes = tudo.filter((a) => a.o === "gravacao");
    const osciladores = tudo.filter((a) => a.o === "som");
    ok(`${b.nome}: toca a gravação uma vez`, clicou && gravacoes.length === 1, JSON.stringify(gravacoes));
    ok(`${b.nome}: com a duração do bicho (${b.min}–${b.max}s)`,
       gravacoes.length === 1 && gravacoes[0].dura >= b.min && gravacoes[0].dura <= b.max,
       JSON.stringify(gravacoes.map((g) => g.dura)));
    ok(`${b.nome}: e NENHUM oscilador — não caiu no encosto`, osciladores.length === 0,
       `${osciladores.length} oscilador(es)`);
  }
  // A ESCOLHA FICA GUARDADA, e sobrevive ao F5: uma escolha que se perde ao
  // recarregar é refeita todo dia até a pessoa desistir.
  await escolher(page, "galinha");
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(800);
  ok("a escolha fica guardada depois de recarregar",
     (await page.evaluate(() => localStorage.getItem("zorvin_som_do_aviso"))) === "galinha");
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem o arquivo, cada bicho vira o som sintetizado — e não silêncio");
for (const b of BICHOS) {
  const id = b.id;
  const { ctx, page, estouros } = await abrirPainel(id);
  await abrirAbaAvisos(page);
  await limpar(page);
  const clicou = await escolher(page, id);
  const tudo = await avisos(page);
  const osciladores = tudo.filter((a) => a.o === "som");
  const gravacoes = tudo.filter((a) => a.o === "gravacao");
  ok(`${b.nome}: com o arquivo fora do ar, ainda sai som`,
     clicou && osciladores.length === b.notas, `${osciladores.length} oscilador(es)`);
  ok(`${b.nome}: e não fingiu tocar a gravação`, gravacoes.length === 0, JSON.stringify(gravacoes));
  ok(`${b.nome}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA mensagem nova toca o bicho ESCOLHIDO");
{
  // O CAMINHO INTEIRO: a tela de Avisos só toca a prévia. O que importa é a
  // mensagem que chega tocar o som que a pessoa escolheu — e uma conversa que
  // ninguém atendeu avisa todo mundo (a regra 3 de 15/09), sem depender de
  // quem respondeu o quê.
  const { ctx, page, estouros } = await abrirPainel();
  await page.evaluate((id) => localStorage.setItem("zorvin_som_do_aviso", id), ESCOLHIDO.id);
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(900);
  await limpar(page);
  await page.evaluate(() => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: `bicho-${Date.now()}`, conversa_id: `conv-nova-${Date.now()}`,
      origem: "contato", texto: "Chegou agora", criado_em: new Date().toISOString(),
    });
  });
  await page.waitForTimeout(1500);
  const gravacoes = (await avisos(page)).filter((a) => a.o === "gravacao");
  ok("a mensagem nova tocou uma gravação", gravacoes.length === 1, JSON.stringify(gravacoes));
  ok(`e foi o som escolhido (${ESCOLHIDO.nome}), pela duração`,
     gravacoes.length === 1 && gravacoes[0].dura >= ESCOLHIDO.min && gravacoes[0].dura <= ESCOLHIDO.max,
     JSON.stringify(gravacoes.map((g) => g.dura)));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nOs arquivos são pequenos, e servidos pelo próprio site");
{
  // A RÉGUA DO PATO: som de aviso pode ser arquivo desde que seja servido
  // daqui, PEQUENO, e buscado só quando usado. 21/08 (a franquia de banda
  // zerada) é o que acontece quando a terceira condição é esquecida; esta
  // conferência guarda a segunda.
  const { ctx, page } = await abrirPainel();
  const tamanhos = await page.evaluate(async (ids) => {
    const fora = {};
    for (const id of ids) {
      const r = await fetch(`/avisos/${id}.wav`);
      fora[id] = r.ok ? (await r.arrayBuffer()).byteLength : -1;
    }
    return fora;
  }, BICHOS.map((b) => b.id));
  for (const b of BICHOS) {
    const id = b.id;
    ok(`${b.nome}: o arquivo existe e tem menos de 40 KB`,
       tamanhos[id] > 1000 && tamanhos[id] < 40 * 1024, `${tamanhos[id]} bytes`);
    let digital = "";
    try {
      digital = createHash("sha256").update(readFileSync(new URL(`../public/avisos/${id}.wav`, import.meta.url))).digest("hex");
    } catch (e) { digital = `não li: ${e.message}`; }
    ok(`${b.nome}: é o arquivo que a receita faz, e não outro`, digital === b.sha256, digital);
  }
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
