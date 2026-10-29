// AS PÁGINAS DA LISTA NÃO SOMEM, E NÃO PULAM NINGUÉM (auditoria de 28/10)
//
// A lista vem do banco em páginas de 200, e a rolagem pede a próxima. Dois
// defeitos moravam nessa emenda, os dois calados:
//
//   1. A PÁGINA ATRASADA DEPOIS DA RELEITURA. A página 0 é relida sozinha —
//      a conversa nova que chega, a releitura de 20 s com o canal fora, um
//      gesto. Se a página 2 estava em voo nessa hora e chegava DEPOIS, ela era
//      emendada na lista nova (que só tinha a página 0) e gravava "estou na
//      página 2": as conversas da página 1 sumiam, e a rolagem seguia para a
//      3. Ninguém via o buraco — só não achava os clientes dele.
//
//   2. A ORDEM QUE ANDA ENTRE UMA PÁGINA E OUTRA. A página é pedida por
//      posição (OFFSET). Se cinco conversas das primeiras 200 saem da aba
//      (Finalizar, um colega que finalizou) antes de a página seguinte vir, as
//      200 seguintes começam cinco posições adiante — e os cinco clientes que
//      subiram para a fronteira não vêm em página nenhuma.
//
// O QUE ESTA PROVA GUARDA: depois da corrida, a rolagem ainda chega à página
// 1; e com cinco conversas saindo da aba entre as páginas, as cinco da
// fronteira aparecem.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript(() => { globalThis.__ATRASO_DA_PAGINA = {}; });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const tel = page.locator('[data-telefone="Arquivo"]');
  if (await tel.count()) await tel.first().click();
  await page.waitForTimeout(3000);
  return { ctx, page, estouros };
}
/** "X de Y+ conversas" no pé da lista: quantas desenhadas, e quantas há. */
const rodape = (page) => page.locator('[data-teste="fim-da-lista"]').innerText()
  .then((t) => { const m = /(\d+) de (\d+)/.exec(t || ""); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; })
  .catch(() => [0, 0]);
/** "Mostrar mais" — PELO `click()` DO ELEMENTO, e não pelo do Playwright: o
 *  dele rola o botão para a vista, a rolagem perto do fim pede mais uma página
 *  sozinha (`onScroll`), e a prova perdia a conta de qual página estava em
 *  voo. Medido: pedindo "a página 2", ela pedia a 5. */
async function mostrarMais(page, espera = 1500) {
  const clicou = await page.evaluate(() => {
    const b = document.querySelector('[data-teste="fim-da-lista"] button');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clicou) return false;
  await page.waitForTimeout(espera);
  return true;
}
/** Pede páginas até a lista ter pelo menos `quantas`, todas desenhadas. */
async function ate(page, quantas) {
  for (let i = 0; i < 8; i++) {
    const [vistas, total] = await rodape(page);
    if (total >= quantas && vistas >= total) return true;
    if (!(await mostrarMais(page))) return false;
  }
  const [vistas, total] = await rodape(page);
  return total >= quantas && vistas >= total;
}
const temNaLista = (page, id) => page.locator(`[data-conversa-id="${id}"]`).count().then((n) => n > 0);

// ==================================================================
console.log("\n1. A página atrasada que chega depois da releitura da primeira");
{
  const { ctx, page, estouros } = await abrir();
  ok("a lista chegou à página 1, inteira", await ate(page, 400), JSON.stringify(await rodape(page)));
  ok("(a conversa 250, da página 1, está na lista)", await temNaLista(page, "a13-c250"));
  // A PÁGINA 2 DEMORA; e, com ela em voo, uma conversa que a lista não tem
  // ganha mensagem — e a primeira página é relida. Uma mensagem NOSSA (um
  // colega, pelo celular): a do cliente numa conversa que ninguém atendeu a
  // levaria para "Novos", e a lista de "Em Atendimento" não seria relida.
  await page.evaluate(() => { globalThis.__ATRASO_DA_PAGINA = { conversas: { aPartirDe: 300, ms: 3500 } }; });
  ok("pedi a página 2", await mostrarMais(page, 150));
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("a13-c1190", "advogado", "oi, voltei", undefined,
    { enviado_por: "Camila Souza", enviado_por_id: "u2" }));
  await page.waitForTimeout(6000);
  await page.evaluate(() => { globalThis.__ATRASO_DA_PAGINA = {}; });
  // A ROLAGEM CONTINUA: com o buraco, ela iria da 2 para a 3, e a página 1
  // nunca mais voltaria.
  await mostrarMais(page, 2500);
  await mostrarMais(page, 2500);
  ok("depois da corrida, a rolagem ainda traz a conversa 250, da página 1", await temNaLista(page, "a13-c250"),
     JSON.stringify(await rodape(page)));
  ok("e a conversa que chegou está na lista", await temNaLista(page, "a13-c1190"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Cinco conversas saem da aba entre uma página e a seguinte");
{
  const { ctx, page, estouros } = await abrir();
  ok("a página 0 chegou", (await rodape(page))[1] >= 200, JSON.stringify(await rodape(page)));
  // AS CINCO PRIMEIRAS SÃO FINALIZADAS no banco (um colega, noutro painel):
  // as outras sobem cinco posições, e a fronteira da página muda de lugar.
  await page.evaluate(() => {
    for (const c of globalThis.__TABELAS.conversas) {
      if (["a13-c0", "a13-c1", "a13-c2", "a13-c3", "a13-c4"].includes(c.id)) c.situacao = "finalizado";
    }
  });
  ok("pedi a página seguinte", await ate(page, 390));
  const fronteira = ["a13-c200", "a13-c201", "a13-c202", "a13-c203", "a13-c204"];
  const faltam = [];
  for (const id of fronteira) if (!(await temNaLista(page, id))) faltam.push(id);
  ok("as cinco da fronteira estão na lista", faltam.length === 0, `faltam: ${JSON.stringify(faltam)}`);
  ok("e a conversa 300 também", await temNaLista(page, "a13-c300"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
