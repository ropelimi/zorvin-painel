// A MÍDIA DE UM CLIENTE (06/11) — "Mídia, links e docs", como no WhatsApp.
//
// Pedido da equipe (Maria Nicolly), com a foto de uma conversa: *"Onde que eu
// vejo tds os docs q essa cliente mandou? de uma vez, tipo no wpp"*. O acervo
// de mídias da barra lateral juntava as fotos e os documentos de TODAS as
// conversas, e não havia como ver os de um cliente só. Esta prova guarda:
//
//   1. o Histórico de atendimento abre com "Mídia, links e documentos" no alto,
//      e diz quantos arquivos o cliente tem;
//   2. o acervo de um cliente junta as conversas dele em TODOS os telefones, e
//      só as dele; cada item diz quem mandou e por qual telefone;
//   3. "Do cliente" e "Da equipe" recortam no banco, nas três abas;
//   4. "Ver de todas as conversas" volta ao acervo de sempre, e "Só deste
//      cliente" volta ao do cliente; o ícone da barra lateral abre o de sempre;
//   5. a lista vazia diz o que foi pedido;
//   6. no celular, o ⋮ da conversa leva ao acervo do cliente, e a tela não rola
//      de lado;
//   7. a leitura que falha diz que falhou.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const AGORA = Date.now();
const iso = (minAtras) => new Date(AGORA - minAtras * 60000).toISOString();

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.count().then((n) => (n ? loc.first().innerText().catch(() => "") : ""));
const attr = (loc, a) => loc.count().then((n) => (n ? loc.first().getAttribute(a).catch(() => null) : null));
const todosOsTextos = (loc) => loc.evaluateAll((els) => els.map((e) => e.innerText));

async function abrir({ semente = null, largura = 1400, altura = 900, celular = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo",
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__QUEBRAR = null;
  }, { semente });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** O telefone que o painel ABRE — descoberto. */
async function telefoneQueAbre() {
  const { ctx, page } = await abrir();
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return r;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV), q(ADV));
// O MESMO CLIENTE NOUTRO TELEFONE: o caso da foto (SAC e Subsídio Emenda).
const OUTRO = ADV === "a9" ? "a5" : "a9";
const NOMES = { a1: "Dr. Jorge Mesquita", a5: "SAC", a7: "Acordos 1", a9: "Subsidio Emenda" };

const CLIENTE = { id: "ct-docs", numero: "5511944449001", nome: "Cliente dos Documentos", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const OUTRA_PESSOA = { ...CLIENTE, id: "ct-outra", numero: "5511944449002", nome: "Outra Pessoa" };
const conversa = (id, adv, contato, min) => ({
  id, advogado_id: adv, contato_id: contato.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: iso(min), esperando_desde: null, tratada_em: null, ultima_mensagem: "Oi", frente: null,
  digitando_ate: null, vantoro_nome: null, contato,
});
const msg = (id, conv, origem, tipo, extra, min) => ({
  id, conversa_id: conv, origem, tipo, id_uazapi: "uz-" + id, criado_em: iso(min), texto: null,
  midia_url: null, midia_mime: null, midia_nome: null, ...extra,
});
const semente = () => ({
  contatos: [CLIENTE, OUTRA_PESSOA],
  conversas: [conversa("cv-docs-a", ADV, CLIENTE, 5), conversa("cv-docs-b", OUTRO, CLIENTE, 30),
              conversa("cv-outra", ADV, OUTRA_PESSOA, 60)],
  mensagens: [
    msg("m-d1", "cv-docs-a", "contato", "documento", { midia_url: "https://deposito.exemplo/rg-cliente.pdf", midia_mime: "application/pdf", midia_nome: "RG-DO-CLIENTE.pdf" }, 10),
    msg("m-d2", "cv-docs-b", "contato", "documento", { midia_url: "https://deposito.exemplo/extrato.pdf", midia_mime: "application/pdf", midia_nome: "EXTRATO-DO-CLIENTE.pdf" }, 40),
    msg("m-d3", "cv-docs-a", "advogado", "documento", { midia_url: "https://deposito.exemplo/procuracao.pdf", midia_mime: "application/pdf", midia_nome: "PROCURACAO-DA-EQUIPE.pdf" }, 20),
    msg("m-i1", "cv-docs-b", "contato", "imagem", { midia_url: "https://deposito.exemplo/foto-cliente.jpg", midia_mime: "image/jpeg" }, 45),
    msg("m-i2", "cv-docs-a", "advogado", "imagem", { midia_url: "https://deposito.exemplo/foto-equipe.jpg", midia_mime: "image/jpeg" }, 15),
    msg("m-l1", "cv-docs-a", "contato", "texto", { texto: "Segue o link https://exemplo.com/comprovante-do-cliente" }, 12),
    msg("m-t1", "cv-docs-a", "contato", "texto", { texto: "Boa tarde" }, 5),
    // DE OUTRA PESSOA: aparece no acervo de todos, nunca no deste cliente.
    msg("m-o1", "cv-outra", "contato", "documento", { midia_url: "https://deposito.exemplo/outra.pdf", midia_mime: "application/pdf", midia_nome: "DOC-DE-OUTRA-PESSOA.pdf" }, 60),
    msg("m-o2", "cv-outra", "contato", "imagem", { midia_url: "https://deposito.exemplo/foto-outra.jpg", midia_mime: "image/jpeg" }, 61),
  ],
});
const nomesDosDocs = (page) => todosOsTextos(page.locator("[data-documento-do-acervo]"));
const itensDaGrade = (page) => page.locator("[data-item-das-midias]").evaluateAll((els) => els.map((e) => e.getAttribute("data-item-das-midias")));
// O ACERVO DE UM CLIENTE SÃO DUAS IDAS (as conversas, depois as mensagens), e
// a bancada demora em cada uma: espera-se a tela dizer que terminou.
async function pronto(page) {
  await page.waitForTimeout(150);
  await page.waitForSelector('[data-midias-carregando="nao"]', { timeout: 8000 }).catch(() => {});
}
async function aba(page, k) {
  await clicar(page.locator(`[data-aba-das-midias="${k}"]`));
  await pronto(page);
}
async function quem(page, k) {
  await clicar(page.locator(`[data-quem-mandou="${k}"]`));
  await pronto(page);
}

// ==================================================================
console.log("\n1. O Histórico abre com a mídia do cliente, e o número de arquivos");
{
  const { ctx, page, estouros } = await abrir({ semente: semente() });
  await clicar(page.locator('[data-conversa-id="cv-docs-a"]'));
  await page.waitForTimeout(1000);
  await clicar(page.locator('button[title^="Histórico de atendimento"]'));
  await page.waitForTimeout(1300);
  const botao = page.locator("[data-historico-midias]");
  ok("o Histórico tem \"Mídia, links e documentos\"", (await botao.count()) === 1 && /Mídia, links e documentos/.test(await texto(botao)));
  ok("e diz quantos arquivos: 5 (as fotos e os documentos das DUAS conversas, sem os links)",
     /5 arquivos/.test(await texto(botao)), q(await texto(botao)));
  ok("abre o acervo do cliente", await clicar(botao));
  await pronto(page);
  ok("com o nome dele no título", /Mídia de Cliente dos Documentos/.test(await texto(page.locator("[data-titulo-das-midias]"))),
     q(await texto(page.locator("[data-titulo-das-midias]"))));
  ok("e dizendo que são as 2 conversas dele", /das 2 conversas deste cliente/.test(await texto(page.locator("[data-filtros-das-midias]").locator("xpath=..")))
     || /das 2 conversas deste cliente/.test(await page.locator("body").innerText()));

  // ---- 2. Só o deste cliente, das duas conversas ----
  await aba(page, "documentos");
  let docs = await nomesDosDocs(page);
  ok("2. os documentos das DUAS conversas dele (dois telefones)",
     docs.length === 3 && docs.some((t) => /RG-DO-CLIENTE/.test(t)) && docs.some((t) => /EXTRATO-DO-CLIENTE/.test(t))
     && docs.some((t) => /PROCURACAO-DA-EQUIPE/.test(t)), q(docs));
  ok("e nenhum de outra pessoa", !docs.some((t) => /DOC-DE-OUTRA-PESSOA/.test(t)), q(docs));
  const rg = docs.find((t) => /RG-DO-CLIENTE/.test(t)) || "";
  const extrato = docs.find((t) => /EXTRATO-DO-CLIENTE/.test(t)) || "";
  const proc = docs.find((t) => /PROCURACAO-DA-EQUIPE/.test(t)) || "";
  ok("cada um diz quem mandou e por qual telefone",
     rg.includes(`Cliente · ${NOMES[ADV]}`) && extrato.includes(`Cliente · ${NOMES[OUTRO]}`) && proc.includes(`Equipe · ${NOMES[ADV]}`), q(docs));
  await aba(page, "midias");
  let grade = await itensDaGrade(page);
  ok("as fotos das duas conversas, e não as de outra pessoa", grade.length === 2 && grade.includes("m-i1") && grade.includes("m-i2"), q(grade));
  ok("a foto diz quem mandou e o telefone", (await attr(page.locator('[data-item-das-midias="m-i1"]'), "title")) === `Cliente · ${NOMES[OUTRO]}`,
     q(await attr(page.locator('[data-item-das-midias="m-i1"]'), "title")));

  // ---- 3. Do cliente / Da equipe ----
  await quem(page, "contato");
  grade = await itensDaGrade(page);
  ok("3. \"Do cliente\" deixa só a foto do cliente", grade.length === 1 && grade[0] === "m-i1", q(grade));
  ok("e o botão diz que está escolhido", (await attr(page.locator('[data-quem-mandou="contato"]'), "aria-pressed")) === "true");
  await aba(page, "documentos");
  docs = await nomesDosDocs(page);
  ok("trocar de aba mantém o filtro: os 2 documentos do cliente",
     docs.length === 2 && !docs.some((t) => /PROCURACAO/.test(t)), q(docs));
  await quem(page, "advogado");
  docs = await nomesDosDocs(page);
  ok("\"Da equipe\" deixa só a procuração", docs.length === 1 && /PROCURACAO-DA-EQUIPE/.test(docs[0]), q(docs));
  await aba(page, "links");
  ok("5. a lista vazia diz o que foi pedido",
     /Nenhum link que a equipe mandou nas conversas deste cliente\./.test(await texto(page.locator("[data-midias-vazio]"))),
     q(await texto(page.locator("[data-midias-vazio]"))));
  await quem(page, "contato");
  const links = await page.locator("[data-midias-carregando] a[href^='https://exemplo.com/']").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  ok("e o link do cliente aparece em Links", links.length === 1 && /comprovante-do-cliente/.test(links[0]), q(links));

  // ---- 4. Todas as conversas, e de volta ----
  await quem(page, "todos");
  await aba(page, "documentos");
  ok("4. \"Ver de todas as conversas\" está lá", await clicar(page.locator("[data-midias-de-todas]")));
  await pronto(page);
  docs = await nomesDosDocs(page);
  ok("e volta ao acervo de sempre (com o documento de outra pessoa)", docs.some((t) => /DOC-DE-OUTRA-PESSOA/.test(t)), q(docs));
  ok("com o título de sempre", (await texto(page.locator("[data-titulo-das-midias]"))).trim() === "Mídia");
  ok("\"Só deste cliente\" leva de volta", await clicar(page.locator("[data-midias-do-cliente]")));
  await pronto(page);
  docs = await nomesDosDocs(page);
  ok("ao acervo dele", docs.length === 3 && !docs.some((t) => /DOC-DE-OUTRA-PESSOA/.test(t)), q(docs));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n4b. O ícone da barra lateral abre o acervo de todas as conversas");
{
  const { ctx, page } = await abrir({ semente: semente() });
  await clicar(page.locator('[data-conversa-id="cv-docs-a"]'));
  await page.waitForTimeout(900);
  await clicar(page.locator('button[title="Mídias, documentos e links"]'));
  await pronto(page);
  ok("com o título de sempre", (await texto(page.locator("[data-titulo-das-midias]"))).trim() === "Mídia",
     q(await texto(page.locator("[data-titulo-das-midias]"))));
  ok("e oferece \"Só deste cliente\", com o nome da conversa aberta",
     /Só deste cliente: Cliente dos Documentos/.test(await texto(page.locator("[data-midias-do-cliente]"))));
  await aba(page, "documentos");
  const docs = await nomesDosDocs(page);
  ok("os documentos de todas as conversas", docs.some((t) => /DOC-DE-OUTRA-PESSOA/.test(t)) && docs.some((t) => /RG-DO-CLIENTE/.test(t)), q(docs));
  await ctx.close();
}

// ==================================================================
console.log("\n6. No celular, o ⋮ da conversa leva à mídia do cliente");
for (const largura of [360, 390]) {
  const { ctx, page, estouros } = await abrir({ semente: semente(), largura, altura: 800, celular: true });
  await clicar(page.locator('[data-conversa-id="cv-docs-a"]'));
  await page.waitForTimeout(1000);
  await clicar(page.locator('button[aria-label="Mais opções desta conversa"]'));
  await page.waitForTimeout(400);
  ok(`a ${largura}: o ⋮ tem "Mídia, links e documentos"`, await clicar(page.locator("[data-menu-midias]")));
  await pronto(page);
  await aba(page, "documentos");
  const docs = await nomesDosDocs(page);
  ok(`a ${largura}: o acervo é o do cliente`, docs.length === 3 && !docs.some((t) => /OUTRA/.test(t)), q(docs));
  const geo = await page.evaluate(() => {
    const f = document.querySelector("[data-filtros-das-midias]")?.getBoundingClientRect();
    return { rola: document.documentElement.scrollWidth > window.innerWidth + 1, dentro: f ? f.right <= window.innerWidth + 1 : false };
  });
  ok(`a ${largura}: os filtros cabem, e a tela não rola de lado`, !geo.rola && geo.dentro, q(geo));
  const alvos = await page.locator("[data-quem-mandou]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  ok(`a ${largura}: os filtros têm alvo de dedo`, alvos.length === 3 && alvos.every((h) => h >= 39.5), q(alvos));
  ok(`a ${largura}: nenhum estouro`, estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n7. A leitura que falha diz que falhou");
{
  const { ctx, page } = await abrir({ semente: semente() });
  await clicar(page.locator('[data-conversa-id="cv-docs-a"]'));
  await page.waitForTimeout(900);
  await clicar(page.locator('button[title^="Histórico de atendimento"]'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { globalThis.__QUEBRAR = ["conversas"]; });
  await clicar(page.locator("[data-historico-midias]"));
  await pronto(page);
  ok("as conversas que não vêm são ditas, com o código",
     /Não consegui achar as conversas deste cliente.*57014/.test(await texto(page.locator("[data-erro-das-midias]"))),
     q(await texto(page.locator("[data-erro-das-midias]"))));
  ok("e não vira \"nenhum\"", (await page.locator("[data-midias-vazio]").count()) === 0);
  await page.evaluate(() => { globalThis.__QUEBRAR = ["mensagens"]; });
  await quem(page, "contato");
  ok("a mensagem que não vem também", /Não consegui abrir as mídias/.test(await texto(page.locator("[data-erro-das-midias]"))),
     q(await texto(page.locator("[data-erro-das-midias]"))));
  await page.evaluate(() => { globalThis.__QUEBRAR = null; });
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
