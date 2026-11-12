// A BUSCA NÃO MOSTRA A CONVERSA EM BRANCO (12/11)
//
// Relato do Rodrigo, com foto: procurando "ADRIANA AMARAL", a lista mostrava
// uma conversa zerada no SAC, sem prévia, que abria em "Nenhuma mensagem nesta
// conversa ainda" — com essa cliente nunca houve mensagem ali. "Corrija isso,
// para aparecer apenas as conversas que realmente existem, que possuem
// mensagens. E quando não tem conversas com mensagens, já está correto,
// aparecendo apenas o resultado com o contato para 'Começar conversa'."
//
// O que esta prova confere:
//
//   - a conversa sem mensagem nenhuma não aparece na busca, pelo nome e pelo
//     número, e a do mesmo cliente noutro telefone, com mensagem, aparece;
//   - o cliente que só tem a conversa vazia aparece como a oferta do cadastro,
//     com o "Começar conversa" (é o que já estava certo), e o que tem
//     conversa com mensagem neste telefone não ganha a oferta (o contraste);
//   - a conversa vazia FIXADA continua aparecendo (fixar é "fica à vista").
//
// Os nomes são inventados (os repositórios são públicos).
// ------------------------------------------------------------
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const adv = await page.evaluate(() => {
    try { const t = localStorage.getItem("zorvin_advogado"); if (t) return t; } catch (_) { /* sem armazenamento */ }
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
const OUTRO = TEL === "a5" ? "a7" : "a5";

function semente() {
  const s = { contatos: [], conversas: [], mensagens: [] };
  const contato = (id, nome, numero) => s.contatos.push({ id: `ct-${id}`, numero, nome });
  const conversa = (id, ct, nome, numero, adv, quando, texto, extra = {}) => {
    s.conversas.push({
      id: `cv-${id}`, advogado_id: adv, contato_id: `ct-${ct}`, nao_lidas: 0, arquivada: false,
      fixada: false, favorita: false, ultima_atividade: quando, esperando_desde: null,
      tratada_em: null, situacao: "aberto", protocolo: null, ultima_mensagem: texto, frente: null,
      contato: { id: `ct-${ct}`, nome, numero, foto_url: null }, ...extra,
    });
  };
  const msg = (id, conv, texto, quando) =>
    s.mensagens.push({ id: `m-${id}`, conversa_id: `cv-${conv}`, origem: "contato", tipo: "texto", texto,
                       criado_em: quando, id_uazapi: `u-${id}` });

  // A DO RELATO: uma conversa vazia NESTE telefone, e a de verdade no outro.
  contato("adri", "ADRIANA VAZIA INVENTADA", "5511970002001");
  conversa("adri-vazia", "adri", "ADRIANA VAZIA INVENTADA", "5511970002001", TEL, H(2), null);
  conversa("adri-cheia", "adri", "ADRIANA VAZIA INVENTADA", "5511970002001", OUTRO, H(30), "tá");
  msg("adri-cheia", "adri-cheia", "tá", H(30));

  // QUEM SÓ TEM A CONVERSA VAZIA: a busca mostra a oferta do cadastro.
  contato("so", "SOVAZIA CLIENTE INVENTADA", "5511970002002");
  conversa("so-vazia", "so", "SOVAZIA CLIENTE INVENTADA", "5511970002002", TEL, H(3), null);

  // O CONTRASTE: conversa com mensagem neste telefone (sem oferta).
  contato("cheio", "COMCONVERSA CLIENTE INVENTADA", "5511970002003");
  conversa("cheio", "cheio", "COMCONVERSA CLIENTE INVENTADA", "5511970002003", TEL, H(4), "bom dia");
  msg("cheio", "cheio", "bom dia", H(4));

  // A VAZIA FIXADA fica à vista.
  contato("fixa", "FIXADAVAZIA CLIENTE INVENTADA", "5511970002004");
  conversa("fixa", "fixa", "FIXADAVAZIA CLIENTE INVENTADA", "5511970002004", TEL, H(5), null, { fixada: true });
  return s;
}

async function abrirPainel(vantoro) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/vantoro/status")) {
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, configurado: Boolean(vantoro) }) });
    }
    if (vantoro && url.pathname.endsWith("/vantoro/buscar")) {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, clientes: vantoro(q) }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.addInitScript(({ s, TEL }) => {
    globalThis.__SEMENTE = s;
    globalThis.__SEM_COLUNAS = {};
    globalThis.__QUEBRAR = [];
    globalThis.__SOU_ADMIN = true;
    globalThis.__DESATIVAR = [];
    globalThis.__BUSCA_SO_NO_TELEFONE = false;
    try { localStorage.setItem("zorvin_advogado", TEL); } catch (_) { /* sem armazenamento */ }
  }, { s: semente(), TEL });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const CAIXA = 'input[placeholder^="Buscar por nome"]';
async function buscar(page, termo, espera = 3500) {
  if (!(await page.locator(CAIXA).count())) return false;
  await page.fill(CAIXA, "");
  await page.waitForTimeout(300);
  await page.fill(CAIXA, termo);
  await page.waitForTimeout(espera);
  return true;
}
const ids = (page) => page.evaluate(() => [...document.querySelectorAll("[data-conversa-id]")]
  .filter((el) => el.offsetParent !== null).map((el) => el.getAttribute("data-conversa-id")));
const ofertas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-comecar-conversa]")]
  .map((el) => (el.getAttribute("data-comecar-conversa") || "").replace(/\D/g, "")));

// ==================================================================
console.log("\n1. A conversa em branco não aparece; a de verdade, sim");
{
  const { ctx, page, estouros } = await abrirPainel(null);
  ok("a lista de sempre não mostra a vazia (como já era)", !(await ids(page)).includes("cv-adri-vazia"));
  ok("a busca existe", await buscar(page, "adriana vazia"));
  let vistos = await ids(page);
  ok("procurando pelo nome, a conversa em branco não aparece", !vistos.includes("cv-adri-vazia"), vistos.join(", "));
  ok("…e a do outro telefone, com mensagem, aparece", vistos.includes("cv-adri-cheia"), vistos.join(", "));
  await buscar(page, "970002001");
  vistos = await ids(page);
  ok("procurando pelo número, também não", !vistos.includes("cv-adri-vazia") && vistos.includes("cv-adri-cheia"), vistos.join(", "));
  await buscar(page, "comconversa cliente");
  vistos = await ids(page);
  ok("a conversa com mensagem deste telefone aparece (o contraste)", vistos.includes("cv-cheio"), vistos.join(", "));
  await buscar(page, "fixadavazia");
  vistos = await ids(page);
  ok("a vazia FIXADA continua aparecendo", vistos.includes("cv-fixa"), vistos.join(", "));
  await buscar(page, "sovazia cliente");
  vistos = await ids(page);
  ok("quem só tem a conversa vazia não aparece como conversa", !vistos.includes("cv-so-vazia"), vistos.join(", "));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Sem conversa com mensagem, a oferta do cadastro aparece (o que já estava certo)");
{
  const vantoro = (q) => {
    if (q.includes("sovazia")) return [{ id: 81, nome: "SOVAZIA CLIENTE INVENTADA", telefone: "(11) 97000-2002", telefone2: "" }];
    if (q.includes("comconversa")) return [{ id: 82, nome: "COMCONVERSA CLIENTE INVENTADA", telefone: "(11) 97000-2003", telefone2: "" }];
    if (q.includes("adriana")) return [{ id: 83, nome: "ADRIANA VAZIA INVENTADA", telefone: "(11) 97000-2001", telefone2: "" }];
    return [];
  };
  const { ctx, page, estouros } = await abrirPainel(vantoro);
  await buscar(page, "sovazia cliente", 6000);
  let vistos = await ids(page);
  let of = await ofertas(page);
  ok("o cliente só com a conversa vazia vira a oferta de começar conversa", of.some((t) => t.endsWith("970002002")), JSON.stringify(of));
  ok("…e nenhuma linha de conversa em branco", !vistos.includes("cv-so-vazia"), vistos.join(", "));
  await buscar(page, "adriana vazia", 6000);
  of = await ofertas(page);
  vistos = await ids(page);
  ok("a do relato: a conversa do outro telefone e a oferta por este", vistos.includes("cv-adri-cheia") && of.some((t) => t.endsWith("970002001")),
     `linhas: ${vistos.join(", ")} · ofertas: ${JSON.stringify(of)}`);
  ok("…sem a conversa em branco", !vistos.includes("cv-adri-vazia"), vistos.join(", "));
  await buscar(page, "comconversa cliente", 6000);
  of = await ofertas(page);
  ok("quem tem conversa com mensagem neste telefone não ganha a oferta (o contraste)", of.length === 0, JSON.stringify(of));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
