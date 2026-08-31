// DIGITAR NÃO PODE CUSTAR O TAMANHO DA CONVERSA.
//
// Segunda frente da lentidão relatada pelo escritório. A primeira era a
// multidão de consultas a cada mensagem que chega (ver `selos-em-rajada`); esta
// não vai ao banco nenhuma vez — é o desenho da tela.
//
// O QUE ACONTECIA: o texto que está sendo digitado é estado do painel INTEIRO.
// Cada tecla, portanto, mandava o React redesenhar tudo — a lista de conversas
// e TODAS as bolhas da conversa aberta. O custo não era o campo de texto: era o
// histórico atrás dele.
//
// MEDIDO num computador quatro vezes mais lento que esta máquina (que é o que
// há no escritório), antes do conserto:
//
//     123 bolhas -> 42,6 ms por tecla
//     275 bolhas -> 69,5 ms por tecla
//     ou seja: 0,18 ms a mais por bolha, e a conta é linear
//
// Numa conversa de cliente antigo, com o histórico do WhatsApp importado, são
// milhares de bolhas depois de alguns "carregar anteriores" — e a digitação
// passa a andar atrás do dedo.
//
// A RÉGUA É O CRESCIMENTO, E NÃO O NÚMERO. Um teto em milissegundos reprovaria
// sozinho em máquina ocupada e aprovaria um código pior em máquina rápida. O
// que não pode voltar é a digitação ficar mais cara conforme a conversa cresce.
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

// 4× mais lento: um computador de escritório, e não a máquina onde isto roda.
// Sem isto o trabalho cabe folgado no quadro do navegador e a medição não
// distingue código bom de código ruim.
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(3000);

const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';

/** Quanto o React fica preso desenhando, por tecla. Mediana de 30.
 *
 *  O RELÓGIO FICA EM VOLTA DO `dispatchEvent`, e não em volta de dois
 *  `requestAnimationFrame`. Com os quadros, a medição batia em 33,3 ms
 *  (2 × 16,7) fizesse o que fizesse: 123 bolhas, 275 bolhas e a busca davam
 *  todos o MESMO número, porque o que estava sendo medido era o relógio do
 *  navegador. Evento de entrada é síncrono: o desenho inteiro acontece dentro
 *  do disparo, e é ali que se mede o trabalho. */
async function porTecla(seletor) {
  const t = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const setar = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
    const quadro = () => new Promise((r) => requestAnimationFrame(r));
    const medidas = [];
    for (let k = 0; k < 30; k += 1) {
      setar.call(el, el.value + "a");
      const antes = performance.now();
      el.dispatchEvent(new Event("input", { bubbles: true }));
      medidas.push(performance.now() - antes);
      await quadro();                       // deixa a tela respirar entre teclas
    }
    setar.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return medidas;
  }, seletor);
  if (!t) return null;
  t.sort((a, b) => a - b);
  return t[15];
}

const quantasBolhas = () => page.evaluate(() =>
  document.querySelectorAll("[data-msg-id]").length);

await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(3000);

console.log("\nDigitar numa conversa curta e numa conversa longa custa o mesmo");
const curta = { bolhas: await quantasBolhas(), ms: await porTecla(CAMPO) };
ok("achei o campo de mensagem", curta.ms != null);

// Sobe no histórico até dobrar as bolhas (ou até o botão acabar).
for (let volta = 0; volta < 8; volta += 1) {
  const botao = page.getByText("Carregar mensagens anteriores").first();
  if (!(await botao.count())) break;
  await botao.click().catch(() => {});
  await page.waitForTimeout(2000);
  if ((await quantasBolhas()) >= curta.bolhas * 2) break;
}

const longa = { bolhas: await quantasBolhas(), ms: await porTecla(CAMPO) };
console.log(`     ${curta.bolhas} bolhas -> ${curta.ms?.toFixed(1)} ms por tecla`);
console.log(`     ${longa.bolhas} bolhas -> ${longa.ms?.toFixed(1)} ms por tecla`);

ok("a conversa longa tem mesmo mais bolhas que a curta",
   longa.bolhas > curta.bolhas * 1.5,
   `${curta.bolhas} -> ${longa.bolhas}: o histórico não cresceu, a medição não vale`);

// A MEDIÇÃO PRECISA TER ACONTECIDO.
//
// Esta é a ÚNICA conferência de desempenho do arquivo, e ela morava dentro de
// um `if` calado: `porTecla` devolvendo `null` — campo não encontrado, digitação
// que não chegou, qualquer coisa que impedisse medir — pulava a conferência e
// deixava a prova verde. Uma régua que some quando não consegue medir não é
// régua nenhuma; ela some justamente quando a tela está pior.
ok("as duas medições aconteceram", curta.ms != null && longa.ms != null,
   `curta=${curta.ms}, longa=${longa.ms} — sem medir, não há o que comparar`);

if (curta.ms != null && longa.ms != null) {
  const cresceu = longa.ms / curta.ms;
  const porBolha = (longa.ms - curta.ms) / Math.max(1, longa.bolhas - curta.bolhas);
  console.log(`     cresceu ${cresceu.toFixed(2)}× | ${porBolha.toFixed(3)} ms por bolha a mais`);
  // Antes do conserto era 1,63× e 1,81× em execuções seguidas. Com as bolhas
  // fora do caminho da tecla, o número fica em torno de 1. A régua a 1,30 tem
  // folga dos dois lados e ainda reprova a volta do defeito.
  ok("digitar numa conversa longa não é mais caro que numa curta",
     cresceu < 1.30, `cresceu ${cresceu.toFixed(2)}× (${curta.ms.toFixed(1)} -> ${longa.ms.toFixed(1)} ms)`);
}

console.log("\nE o que foi digitado aparece no campo");
{
  // A conferência que impede o conserto errado: um campo que não atualiza é
  // rapidíssimo. O que se quer é a tela acompanhando o dedo, não a tela parada.
  await page.locator(CAMPO).click();
  await page.locator(CAMPO).fill("bom dia");
  await page.waitForTimeout(600);
  const escrito = await page.locator(CAMPO).inputValue();
  ok('o campo mostra "bom dia" depois de digitado', escrito === "bom dia", `mostrou "${escrito}"`);

  // E o botão de enviar aparece no lugar do microfone — ele lê o rascunho, e é
  // por ele que se vê que o resto da tela ficou sabendo do texto.
  const temEnviar = await page.locator('button[title="Enviar"]').count();
  ok("o botão de enviar apareceu no lugar do microfone", temEnviar > 0);

  await page.locator(CAMPO).fill("");
  await page.waitForTimeout(400);
  const temMic = await page.locator('button[title="Gravar áudio"]').count();
  ok("e apagando o texto o microfone volta", temMic > 0);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
