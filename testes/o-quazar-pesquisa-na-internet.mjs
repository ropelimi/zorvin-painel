// O "SUGERIR RESPOSTA" PESQUISA NA INTERNET (19/11) — a metade do painel.
//
// Pedido do Rodrigo: quando o cliente pergunta algo de fora do que o
// escritório sabe ("a nova lei que bloqueia o salário"), o Quazar pesquisa na
// internet — sempre depois de consultar o banco e a conversa, sem inventar e
// com a linguagem da equipe. Quem pesquisa é a PONTE (seção 121 dela). Aqui:
//
//   1. a sugestão entra na caixa como sempre, sem link nenhum;
//   2. a faixa diz que o Quazar pesquisou, e mostra as fontes, para a
//      atendente conferir antes de mandar (link numa aba nova, sem alcançar o
//      Zorvin); só endereço http(s);
//   3. pesquisou sem citar fonte: a faixa diz isso;
//   4. sem pesquisa (e com a ponte de antes), a faixa fica como era;
//   5. depois de "Pedir uma mudança", as fontes saem (a mensagem já é outra).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.parse("2026-11-19T09:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const CAMPO = "textarea[data-campo]";

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.first().innerText({ timeout: 2000 }).catch(() => "");

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const CONTATO = { id: "ct-pesq-1", numero: "5511948230291", nome: "Cliente da Pesquisa", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const A = "cv-pesq-1";
const SEMENTE = {
  contatos: [CONTATO],
  conversas: [{ id: A, advogado_id: ADV, contato_id: CONTATO.id, nao_lidas: 0, arquivada: false, fixada: false,
                favorita: false, ultima_atividade: antes(1), esperando_desde: null, tratada_em: null,
                ultima_mensagem: "…", frente: null, digitando_ate: null, contato: CONTATO }],
  mensagens: [{ id: "m-pesq-1", conversa_id: A, origem: "contato", tipo: "texto",
                texto: "Estou preocupada com a nova lei.", criado_em: antes(2) }],
};

const MENSAGEM = "Bom dia! Pode ficar tranquila: não existe lei em vigor que bloqueie o salário.";
const ponte = {
  estado: { ok: true, ligado: true, modelo: "claude-sonnet-5-5", resumo: true, ajustar: true, aprende: true, pesquisa: true },
  sugestao: {},
};

async function abrirPagina() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.clock.setFixedTime(new Date(AGORA));
  await page.addInitScript((b) => { globalThis.__SEMENTE = b.semente; }, { semente: SEMENTE });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(200, ponte.estado);
    if (url.pathname.endsWith("/copiloto/sugerir")) return json(200, { ok: true, sugestao: MENSAGEM, ...ponte.sugestao });
    if (url.pathname.endsWith("/copiloto/ajustar")) return json(200, { ok: true, sugestao: "Bom dia! Está tudo certo.", licao: null });
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  const linha = page.locator(`[data-conversa-id="${A}"]`);
  if (await linha.count()) { await linha.first().click(); await page.waitForTimeout(900); }
  return { ctx, page, estouros };
}
async function sugerir(page) {
  const foi = await clicar(page.locator("[data-copiloto-botao]"));
  await page.waitForTimeout(900);
  return foi;
}
const naCaixa = (page) => page.locator(CAMPO).inputValue({ timeout: 2000 }).catch(() => "SEM CAIXA");
const fontes = (page) => page.locator("[data-copiloto-fontes]");

// ---- 1. pesquisou, com fontes ----
console.log("\n1. O Quazar pesquisou e citou as fontes");
{
  ponte.sugestao = { pesquisou: true, fontes: [
    { titulo: "Notícia oficial do governo", url: "https://www.gov.br/noticia" },
    { titulo: "Lei no Planalto", url: "https://www.planalto.gov.br/lei" },
    { titulo: "ruim", url: "javascript:alert(1)" },
  ] };
  const { ctx, page, estouros } = await abrirPagina();
  ok("cliquei em Sugerir resposta", await sugerir(page));
  ok("a sugestão entra na caixa, sem link", (await naCaixa(page)) === MENSAGEM, await naCaixa(page));
  const t = await texto(fontes(page));
  ok("a faixa diz que o Quazar pesquisou na internet, e pede para conferir",
     /pesquisou na internet para esta resposta/.test(t) && /Confira antes de mandar/.test(t), t);
  const links = await page.locator("[data-copiloto-fonte]").evaluateAll((as) =>
    as.map((a) => ({ href: a.getAttribute("href"), alvo: a.getAttribute("target"), rel: a.getAttribute("rel"), texto: a.textContent })));
  ok("as duas fontes de verdade, pelo título (o endereço javascript: fica de fora)",
     links.length === 2 && links[0].texto === "Notícia oficial do governo" && links[1].href === "https://www.planalto.gov.br/lei",
     JSON.stringify(links));
  ok("cada uma numa aba nova, sem alcançar o Zorvin",
     links.length === 2 && links.every((l) => l.alvo === "_blank" && /noopener/.test(l.rel) && /noreferrer/.test(l.rel)),
     JSON.stringify(links));
  // DEPOIS DE "PEDIR UMA MUDANÇA", a mensagem é outra, e as fontes saem.
  await page.locator("[data-copiloto-pedido-campo]").fill("Mais curto").catch(() => {});
  await clicar(page.locator("[data-copiloto-pedir]"));
  await page.waitForTimeout(900);
  ok("depois de pedir uma mudança, as fontes saem", (await naCaixa(page)) === "Bom dia! Está tudo certo."
     && (await fontes(page).count()) === 0, await naCaixa(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 2. pesquisou, sem citar fonte ----
console.log("\n2. Pesquisou, e a resposta não citou fonte");
{
  ponte.sugestao = { pesquisou: true, fontes: [] };
  const { ctx, page } = await abrirPagina();
  await sugerir(page);
  const t = await texto(fontes(page));
  ok("a faixa diz que pesquisou e que a resposta não citou fonte", /a resposta não citou fonte/.test(t), t);
  ok("e nenhum link", (await page.locator("[data-copiloto-fonte]").count()) === 0);
  await ctx.close();
}

// ---- 3. sem pesquisa, e a ponte de antes ----
console.log("\n3. Sem pesquisa, a faixa fica como era");
for (const [nome, sug] of [["sem pesquisar", { pesquisou: false, fontes: [] }], ["a ponte de antes", {}]]) {
  ponte.sugestao = sug;
  const { ctx, page } = await abrirPagina();
  await sugerir(page);
  ok(`${nome}: a sugestão entra`, (await naCaixa(page)) === MENSAGEM, await naCaixa(page));
  ok(`${nome}: nada de fontes na faixa`, (await page.locator("[data-copiloto-situacao]").count()) >= 1
     && (await fontes(page).count()) === 0);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
