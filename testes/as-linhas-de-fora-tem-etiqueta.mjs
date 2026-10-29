// AS LINHAS DE FORA DAS PÁGINAS TÊM ETIQUETA (auditoria de 28/10)
//
// As etiquetas de cada linha vêm de `conversa_tags`, lidas para os ids da
// LISTA — e só dela. A busca e os filtros trazem do banco conversas que as
// páginas lidas não têm, e essas apareciam sem etiqueta nenhuma: no filtro
// "Urgente", a conversa 980 entrava na lista POR SER urgente e aparecia sem o
// próprio selo "Urgente". Quem olha a linha conclui que ninguém a etiquetou.
//
// O QUE ESTA PROVA GUARDA: as cinco "Urgente" do telefone de 1.200 conversas
// mostram o selo — as duas das páginas lidas e as três de fora —, e a
// conversa achada pela busca lá no fundo também.
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
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

async function clicar(seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
/** As linhas da lista, cada uma com as etiquetas que ela desenha. */
const linhas = () => page.locator("[data-conversa-id]").evaluateAll((els) => els.map((e) => ({
  id: e.getAttribute("data-conversa-id"), urgente: /\bUrgente\b/.test(e.innerText || ""),
})));

ok("fui ao telefone de 1.200 conversas", await clicar('[data-telefone="Arquivo"]'));
await page.waitForTimeout(3000);

console.log("\n1. O filtro “Urgente”");
{
  await clicar("[data-mais-filtros]");
  await page.waitForTimeout(300);
  ok("escolhi “Urgente”", await clicar('[data-etiqueta-da-seta="t-urgente"]'));
  await page.waitForTimeout(3500);
  const l = await linhas();
  ok("as cinco estão na lista", l.length === 5, JSON.stringify(l));
  const sem = l.filter((x) => !x.urgente).map((x) => x.id);
  ok("e todas mostram o selo “Urgente” — inclusive as de fora das páginas", l.length === 5 && sem.length === 0,
     `sem o selo: ${JSON.stringify(sem)}`);
  await clicar('[data-aba="tudo"]');
  await page.waitForTimeout(800);
}

console.log("\n2. A conversa que a busca traz lá do fundo");
{
  await page.locator('input[placeholder*="Buscar por nome"]').first().fill("ZULMIRA");
  await page.waitForTimeout(3500);
  const l = await linhas();
  const zulmira = l.find((x) => x.id === "a13-c1150");
  ok("a busca achou a ZULMIRA, a conversa 1.150", Boolean(zulmira), JSON.stringify(l));
  ok("e a linha dela mostra o selo “Urgente”", Boolean(zulmira && zulmira.urgente), JSON.stringify(zulmira));
}

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
