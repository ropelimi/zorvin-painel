// O FILTRO POR ETIQUETA PROCURA EM TODOS OS TELEFONES (27/11)
//
// Pedido do Rodrigo: "O filtro por etiqueta deve aparecer as conversas de
// todos os telefones, igual funciona o campo de busca."
//
// A "Urgente" da bancada mora em cinco conversas do telefone "Arquivo" (a13).
// Filtrada de outro telefone, ela tem de trazer as cinco, cada uma com o selo
// do telefone dela (`data-selo-do-telefone`), e o clique tem de levar ao
// telefone dela, já com a conversa aberta — como na busca. As deste telefone
// vêm primeiro. Sem filtro, a lista volta a ser só deste telefone, sem selo.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const URGENTES = ["a13-c3", "a13-c40", "a13-c700", "a13-c980", "a13-c1150"];

async function clicar(page, seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const linhas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-conversa-id]")]
  .filter((el) => el.offsetParent !== null)
  .map((el) => ({
    id: el.getAttribute("data-conversa-id"),
    selo: el.querySelector("[data-selo-do-telefone]")?.getAttribute("data-selo-do-telefone") ?? null,
  })));

console.log("\n1. A “Urgente” filtrada de outro telefone");
{
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // Uma conversa urgente DESTE telefone, para conferir a ordem e o selo.
  await page.addInitScript(() => {
    try { localStorage.setItem("zorvin_advogado", "a5"); } catch (_) { /* sem armazenamento */ }
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const daqui = await page.evaluate(() => {
    const el = document.querySelector("[data-conversa-id]");
    const id = el && el.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
    if (!c) return null;
    globalThis.__TABELAS.conversa_tags.push({ id: "ct-tag-daqui", conversa_id: c.id, tag_id: "t-urgente" });
    return { id: String(c.id), tel: String(c.advogado_id) };
  });
  ok("achei uma conversa do telefone aberto e pus a “Urgente” nela", Boolean(daqui) && daqui.tel !== "a13",
     JSON.stringify(daqui));

  const antes = await linhas(page);
  ok("sem filtro, nenhuma linha leva selo de telefone", antes.length > 0 && antes.every((l) => !l.selo),
     JSON.stringify(antes.filter((l) => l.selo)));

  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  ok("escolhi “Urgente”", await clicar(page, '[data-etiqueta-da-seta="t-urgente"]'));
  await page.waitForTimeout(3500);
  const l = await linhas(page);
  const ids = l.map((x) => x.id);
  ok("as cinco do telefone Arquivo aparecem", ids.length > 0 && URGENTES.filter((id) => ids.includes(id)).length === 5, JSON.stringify(ids));
  ok("e a deste telefone também", Boolean(daqui) && ids.includes(daqui.id), JSON.stringify(ids));
  ok("só as seis com a etiqueta", l.length === 6, JSON.stringify(ids));
  const deFora = l.filter((x) => URGENTES.includes(x.id));
  ok("cada uma de fora com o selo “Arquivo”", deFora.length === 5 && deFora.every((x) => x.selo === "Arquivo"),
     JSON.stringify(deFora));
  const aqui = l.find((x) => daqui && x.id === daqui.id);
  ok("a deste telefone sem selo", Boolean(aqui) && !aqui.selo, JSON.stringify(aqui));
  ok("a deste telefone vem primeiro", Boolean(daqui) && ids[0] === daqui.id, JSON.stringify(ids));

  ok("cliquei na 1.150, do telefone Arquivo", await clicar(page, '[data-conversa-id="a13-c1150"]'));
  await page.waitForTimeout(3000);
  const tel = await page.evaluate(() => {
    try { return localStorage.getItem("zorvin_advogado"); } catch (_) { return null; }
  });
  const aberto = await page.locator("[data-topo-conversa]").count();
  ok("o clique levou ao telefone dela", tel === "a13", String(tel));
  ok("com a conversa aberta", aberto > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
