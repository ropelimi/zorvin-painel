// "MARCAR TODAS COMO LIDAS" E A "FAXINA DA FILA" SAÍRAM (12/11)
//
// Pedido do Rodrigo, com a foto do menu ⋮ do topo: "'Marcar todas como lidas'
// e 'Faxina da fila', pode remover do sistema."
//
// Esta prova nasceu da `a-faxina-da-fila` (01/11), INVERTIDA, e não apagada:
// escrita ao contrário, é ela que impede os dois de voltarem numa limpeza
// futura. Ela confere:
//
//   - o menu ⋮ do topo não tem nenhum dos dois, no computador e no celular,
//     e continua com o que tinha (Configurações, Funil, Tarefas, Painel);
//   - o endereço da guia da faxina (`?tela=faxina`), que alguém pode ter nos
//     favoritos, abre as conversas, como qualquer nome que não é tela;
//   - o Finalizar da conversa continua de pé (a faxina usava a mesma janela,
//     que perdeu o modo em lote).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrir(largura, altura) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page };
}

async function textoDoMenu(page) {
  const m = page.getByRole("button", { name: "Menu", exact: true });
  if (!(await m.count())) return null;
  await m.first().click().catch(() => {});
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => document.body.innerText);
  await page.keyboard.press("Escape").catch(() => {});
  return t;
}

for (const [nome, l, a] of [["computador", 1400, 900], ["celular", 390, 844]]) {
  console.log(`\n1. O menu ⋮ do topo, no ${nome}`);
  const { ctx, page } = await abrir(l, a);
  const t = await textoDoMenu(page);
  ok("o menu ⋮ abre", t !== null);
  ok("sem “Marcar todas como lidas”", t !== null && !/Marcar todas como lidas/.test(t));
  ok("sem “Faxina da fila”", t !== null && !/Faxina da fila/.test(t));
  ok("e sem o link da faxina", (await page.locator("[data-abrir-faxina]").count()) === 0);
  ok("continua com Configurações", t !== null && /Configurações/.test(t));
  ok("continua com o Painel", t !== null && /Painel/.test(t));
  await ctx.close();
}

console.log("\n2. O endereço da faxina abre as conversas");
{
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${ENDERECO}?tela=faxina`);
  const abriu = await page.waitForSelector("[data-conversa-nome]", { timeout: 30000 }).then(() => true).catch(() => false);
  ok("?tela=faxina abre as conversas", abriu);
  ok("sem a tela da faxina", (await page.locator('[data-tela="faxina"]').count()) === 0);
  ok("sem guia de tela nenhuma por cima", (await page.locator("[data-tela-da-guia]").count()) === 0);
  const titulo = await page.title();
  ok("com o título de sempre", /Ropelimi Zorvin$/.test(titulo) && !titulo.includes(" · "), titulo);
  await ctx.close();
}

console.log("\n3. O Finalizar da conversa continua");
{
  const { ctx, page } = await abrir(1600, 900);
  await page.locator("[data-conversa-nome]").first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const botao = page.locator("[data-ja-tratei]");
  ok("a conversa tem o botão", (await botao.count()) >= 1);
  if (await botao.count()) {
    await botao.first().click().catch(() => {});
    await page.waitForTimeout(500);
    ok("a janela abre", (await page.locator("[data-ja-tratei-janela]").count()) === 1);
    ok("e não é de lote", (await page.locator("[data-ja-tratei-lote]").count()) === 0);
  }
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
