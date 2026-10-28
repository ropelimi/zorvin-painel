// A BUSCA NA CONVERSA COMEÇA PELAS MAIS RECENTES, mesmo passando de 500
// (auditoria de 28/10)
//
// A busca dentro da conversa pergunta ao banco (26/10) e traz no máximo 500
// ocorrências — o teto é dito ("500+"). Mas pedia em ordem CRESCENTE: com
// mais de 500, vinham as 500 MAIS ANTIGAS. O salto "até a mais recente" caía
// na 500ª mais antiga, e as mais novas — as que estão na tela, as que quem
// procura quase sempre quer — sumiam da navegação: a tela as pula, porque
// confia na lista do banco para tudo o que é de `mensagens`.
//
// O QUE ESTA PROVA GUARDA: numa conversa com 620 ocorrências, a contagem diz
// que passou do teto, a busca vai até a última mensagem da conversa, e o
// "Anterior" anda pelas mais novas.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const TEL = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const N = 620;
const id = (i) => `m-mil-${String(i).padStart(3, "0")}`;
const NOME = "BUSCA CLIENTE DAS 620";
const SEMENTE = {
  contatos: [{ id: "ct-mil", numero: "5511970004411", nome: NOME, vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-mil", advogado_id: TEL, contato_id: "ct-mil", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(),
    ultima_mensagem: `repetida número ${N}`, frente: null, vantoro_nome: null, digitando_ate: null,
    esperando_desde: null, contato: { id: "ct-mil", nome: NOME, numero: "5511970004411", foto_url: null } }],
  mensagens: Array.from({ length: N }, (_, k) => {
    const i = k + 1;
    return { id: id(i), conversa_id: "cv-mil", origem: i % 2 ? "contato" : "advogado", tipo: "texto",
             texto: `repetida número ${i}`, id_uazapi: `uz-${id(i)}`,
             criado_em: new Date(AGORA - (N - i + 5) * 60e3).toISOString(),
             ...(i % 2 ? {} : { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "lida" }) };
  }),
};

const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);

/** Clique GUARDADO: o que não existe não estoura a prova. */
async function clicar(sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 5000 }); } catch (_) { return false; }
  return true;
}
const visivel = (mid) => page.evaluate((m) => {
  const el = document.querySelector(`[data-msg-id="${m}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const lista = document.querySelector("[data-lista-mensagens]")?.getBoundingClientRect();
  return r.height > 0 && (!lista || (r.bottom > lista.top && r.top < lista.bottom));
}, mid);
const contagem = () => page.evaluate(() =>
  (document.querySelector("[data-contagem-da-busca-na-conversa]")?.innerText || "").trim());

console.log("\nCom 620 ocorrências, a busca vai até a mais recente");
ok("abri a conversa das 620", await clicar('[data-conversa-id="cv-mil"]'));
await page.waitForTimeout(1500);
ok("ela abre no fim, na última mensagem", await visivel(id(N)));
ok("abri a busca da conversa", await clicar('button[aria-label="Buscar na conversa"]'));
await page.waitForTimeout(300);
await page.fill('input[placeholder="Buscar nesta conversa"]', "repetida").catch(() => {});
await page.waitForTimeout(2800);
ok("a contagem diz que passou do teto: “500 de 500+”", (await contagem()) === "500 de 500+",
   `disse “${await contagem()}”`);
ok("e a busca está na ÚLTIMA mensagem da conversa — a mais recente", await visivel(id(N)),
   `a 620 ${await visivel(id(N)) ? "está" : "não está"} à vista; a 500 ${await visivel(id(500)) ? "está" : "não está"}`);
await clicar('button[title="Anterior"]');
await page.waitForTimeout(1500);
ok("“Anterior” vai até a penúltima", await visivel(id(N - 1)), `contagem “${await contagem()}”`);
ok("e a contagem acompanha: “499 de 500+”", (await contagem()) === "499 de 500+", `disse “${await contagem()}”`);
ok("a tela não estourou", !estouros.length, estouros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
