// O AVISO DE QUE A MENSAGEM NÃO SAIU SE LÊ — e se alcança (auditoria de 28/10)
//
// A varredura de contraste da auditoria mediu, no tema ESCURO, o "não enviado
// · reenviar" em #e53935 sobre a bolha verde de quem envia (#005c4b): 1,9:1.
// É o aviso mais importante que uma bolha pode dar — a mensagem não chegou ao
// cliente — e era o mais apagado da tela. No claro, 3,8:1. O piso para letra
// miúda é 4,5:1.
//
// E ele era um <span> com clique: a bolha que falhou não tem menu (não tem
// `id_uazapi`), então aquele texto é o ÚNICO jeito de reenviar, e um <span>
// não recebe o foco do Tab nem o Enter.
//
// O QUE ESTA PROVA GUARDA
//   1. nos dois temas, o aviso tem pelo menos 4,5:1 sobre a bolha;
//   2. o "reenviar" é um botão: recebe o foco e o Enter reenvia.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const erros = [];

async function abrirAConversaComFalha(tema) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(e.message));
  await page.addInitScript((t) => {
    try { localStorage.setItem("zorvin_modo", t); localStorage.removeItem("zorvin_avisos_dispensados"); } catch (_) {}
  }, tema);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2200);
  return { ctx, page };
}

/** O contraste do texto do aviso contra o fundo de verdade atrás dele (o
 *  primeiro ancestral com cor de fundo), pela fórmula do WCAG. */
const contrasteDoAviso = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-reenviar]");
  if (!el) return null;
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  let fundo = null;
  for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
    const c = rgb(getComputedStyle(a).backgroundColor);
    if (c.length >= 3 && (c.length < 4 || c[3] > 0)) { fundo = c; break; }
  }
  const letra = rgb(getComputedStyle(el).color);
  if (!fundo || letra.length < 3) return null;
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [l1, l2] = [lum(letra), lum(fundo)];
  return { razao: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), letra: getComputedStyle(el).color,
           fundo: `rgb(${fundo.slice(0, 3).join(", ")})` };
});

console.log("\n1. O aviso se lê nos dois temas");
for (const tema of ["claro", "escuro"]) {
  const { ctx, page } = await abrirAConversaComFalha(tema);
  const c = await contrasteDoAviso(page);
  ok(`no tema ${tema} há uma bolha que não saiu, com o aviso`, c !== null);
  ok(`no tema ${tema} o aviso tem pelo menos 4,5:1 sobre a bolha`, c !== null && c.razao >= 4.5,
     c ? `${c.razao.toFixed(2)}:1 (${c.letra} sobre ${c.fundo})` : "sem aviso");
  await ctx.close();
}

console.log("\n2. O teclado alcança o reenviar");
{
  const { ctx, page } = await abrirAConversaComFalha("claro");
  const aviso = page.locator("[data-reenviar]").first();
  const tag = await aviso.evaluate((e) => e.tagName).catch(() => null);
  ok("o reenviar é um botão", tag === "BUTTON", `é um <${tag}>`);
  const naFilaAntes = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).length);
  await aviso.focus();
  const focado = await page.evaluate(() => document.activeElement?.hasAttribute("data-reenviar") === true);
  ok("ele recebe o foco", focado);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2200);
  const naFila = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || [])
    .filter((l) => l.status === "pendente").map((l) => l.texto));
  ok("e o Enter reenvia (uma linha nova, pendente, com o texto da que falhou)",
     naFila.includes("Doutor, segue o documento que combinamos"),
     `pendentes na fila: ${JSON.stringify(naFila)} (antes eram ${naFilaAntes} linhas)`);
  await ctx.close();
}

ok("sem erro de JavaScript", erros.length === 0, erros.slice(0, 3).join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
