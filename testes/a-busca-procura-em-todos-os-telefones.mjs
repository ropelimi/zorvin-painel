// A BUSCA PROCURA EM TODOS OS TELEFONES (04/11)
//
// Pedido do Rodrigo, com duas fotos: a Jessica Maressa, um lead sem ficha no
// Vantoro, tem conversa só no telefone do SAC. Procurando o nome dela no SAC,
// a conversa aparecia; no telefone das Audiências, "Nada encontrado para essa
// busca". "Não importa em qual telefone o usuário esteja, a busca deve
// encontrar todas as conversas, com ou sem ficha do Vantoro."
//
// O que esta prova confere:
//
//   - a conversa de outro telefone aparece na busca, com o SELO do telefone
//     (`data-selo-do-telefone`), e o clique leva ao telefone dela, já com a
//     conversa aberta — e na mensagem achada, quando a busca casou no texto;
//   - as do telefone aberto vêm primeiro, também no teto de 80 do banco; e a
//     nota do teto mora depois das conversas, sem empurrar a que já se via;
//   - o mesmo cliente nos dois telefones não ganha o número na linha (o selo
//     já separa), e dois homônimos do mesmo telefone de fora ganham;
//   - quem não administra não vê o telefone que não atende, nem a linha
//     desativada; quem administra vê a linha desativada, e o clique a abre;
//   - o banco sem o 049: a busca pergunta de novo sem o argumento novo, uma
//     vez só por sessão, sem aviso de falha;
//   - a oferta do cadastro do Vantoro continua sendo DESTE telefone;
//   - no celular, o selo cabe e a tela não rola de lado.
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
  const tel = await page.evaluate(() => {
    try { return localStorage.getItem("zorvin_advogado"); } catch (_) { return null; }
  });
  const adv = tel || await page.evaluate(() => {
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

// Os telefones da bancada (`ADVOGADOS`, em `src/bancada.js`).
const NOMES_DOS_TELEFONES = { a3: "SDC CCR", a5: "SAC", a6: "Audiências", a7: "Acordos 1", a8: "Acordos 2" };
const DEP_DOS_TELEFONES = { a3: 3, a5: 3, a6: 4, a7: 5, a8: 5 };
// O OUTRO é de outro departamento, como o SAC e as Audiências do relato.
const OUTRO = TEL === "a5" ? "a7" : "a5";
const NAO_ATENDE = "a6";       // o telefone que, na cena de quem não administra, ela não atende
const DESATIVADA = "a3";       // a linha desativada (`__DESATIVAR`)
ok("o outro telefone é de outro departamento",
   DEP_DOS_TELEFONES[OUTRO] !== DEP_DOS_TELEFONES[TEL], `${TEL} e ${OUTRO}`);
const NOME_DO_OUTRO = NOMES_DOS_TELEFONES[OUTRO];

const LEAD = "JESSICA LEAD INVENTADA";
const LEAD_NUMERO = "5511970001001";

function semente() {
  const s = { contatos: [], conversas: [], mensagens: [] };
  const contato = (id, nome, numero) => s.contatos.push({ id: `ct-${id}`, numero, nome });
  const conversa = (id, ct, nome, numero, adv, quando, texto) => {
    s.conversas.push({
      id: `cv-${id}`, advogado_id: adv, contato_id: `ct-${ct}`, nao_lidas: 0, arquivada: false,
      fixada: false, favorita: false, ultima_atividade: quando, esperando_desde: null,
      tratada_em: null, situacao: "aberto", protocolo: null, ultima_mensagem: texto, frente: null,
      contato: { id: `ct-${ct}`, nome, numero, foto_url: null },
    });
  };
  const msg = (id, conv, texto, quando, origem = "contato") =>
    s.mensagens.push({ id: `m-${id}`, conversa_id: `cv-${conv}`, origem, tipo: "texto", texto, criado_em: quando,
                       id_uazapi: `u-${id}` });

  // O LEAD DO RELATO: conversa só no OUTRO telefone. A palavra "zebrafina"
  // está numa mensagem antiga, atrás de 130 mais recentes: a conversa abre com
  // as 120 últimas, e só o salto da busca a põe na tela.
  contato("lead", LEAD, LEAD_NUMERO);
  conversa("lead", "lead", LEAD, LEAD_NUMERO, OUTRO, H(1), "oi, tudo bem?");
  msg("lead-alvo", "lead", "mandei o comprovante zebrafina ontem", H(400));
  for (let i = 0; i < 130; i++) msg(`lead-${i}`, "lead", `mensagem de enchimento ${i}`, H(300 - i));

  // O MESMO CLIENTE NOS DOIS TELEFONES: a do telefone aberto é a mais antiga.
  contato("dois", "CLIENTE DOS DOIS TELEFONES", "5511970001002");
  conversa("dois-aqui", "dois", "CLIENTE DOS DOIS TELEFONES", "5511970001002", TEL, H(60), "bom dia");
  conversa("dois-la", "dois", "CLIENTE DOS DOIS TELEFONES", "5511970001002", OUTRO, H(2), "boa tarde");
  msg("dois-aqui", "dois-aqui", "bom dia", H(60));
  msg("dois-la", "dois-la", "boa tarde", H(2));

  // DOIS HOMÔNIMOS NO MESMO TELEFONE DE FORA, por números diferentes.
  for (const [i, numero] of [[1, "5511970001011"], [2, "5511970001012"]]) {
    contato(`homo-${i}`, "HOMONIMO DE FORA", numero);
    conversa(`homo-${i}`, `homo-${i}`, "HOMONIMO DE FORA", numero, OUTRO, H(3 + i), "olá");
    msg(`homo-${i}`, `homo-${i}`, "olá", H(3 + i));
  }

  // O TELEFONE QUE QUEM NÃO ADMINISTRA NÃO ATENDE, e a LINHA DESATIVADA.
  contato("alcance", "CLIENTE FORA DO ALCANCE", "5511970001021");
  conversa("alcance", "alcance", "CLIENTE FORA DO ALCANCE", "5511970001021", NAO_ATENDE, H(5), "oi");
  msg("alcance", "alcance", "oi", H(5));
  contato("desat", "CLIENTE DA LINHA DESATIVADA", "5511970001022");
  conversa("desat", "desat", "CLIENTE DA LINHA DESATIVADA", "5511970001022", DESATIVADA, H(6), "oi");
  msg("desat", "desat", "oi", H(6));

  // O TETO: noventa conversas no OUTRO dizem a palavra, recentes; três no
  // telefone aberto dizem também, antigas. O banco devolve oitenta, e as três
  // daqui têm de estar nelas — e no alto da lista.
  for (let i = 0; i < 90; i++) {
    contato(`rep-la-${i}`, `REPETIDA LA ${i}`, `55119710${String(10000 + i)}`);
    conversa(`rep-la-${i}`, `rep-la-${i}`, `REPETIDA LA ${i}`, `55119710${String(10000 + i)}`, OUTRO, H(7 + i * 0.01), "a palavrarepetida aqui");
    msg(`rep-la-${i}`, `rep-la-${i}`, "a palavrarepetida aqui", H(7 + i * 0.01));
  }
  for (let i = 0; i < 3; i++) {
    contato(`rep-aqui-${i}`, `REPETIDA AQUI ${i}`, `55119720${String(10000 + i)}`);
    conversa(`rep-aqui-${i}`, `rep-aqui-${i}`, `REPETIDA AQUI ${i}`, `55119720${String(10000 + i)}`, TEL, H(500 + i), "a palavrarepetida");
    msg(`rep-aqui-${i}`, `rep-aqui-${i}`, "a palavrarepetida", H(500 + i));
  }
  return s;
}

/** Abre o painel com as bandeiras da cena — TODAS, em toda abertura
 *  (`addInitScript` acumula). */
async function abrirPainel(opcoes = {}) {
  const d = { souAdmin: true, soNoTelefone: false, largura: 1600, altura: 1000, celular: false, ...opcoes };
  const ctx = await nav.newContext(d.celular
    ? { viewport: { width: d.largura, height: d.altura }, isMobile: true, hasTouch: true }
    : { viewport: { width: d.largura, height: d.altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  if (d.vantoro) {
    await page.route("**/ponte-de-mentira/**", async (rota) => {
      const url = new URL(rota.request().url());
      if (url.pathname.endsWith("/vantoro/buscar")) {
        const q = (url.searchParams.get("q") || "").toLowerCase();
        return rota.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, clientes: d.vantoro(q) }) });
      }
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
  }
  await page.addInitScript(({ s, d, TEL }) => {
    globalThis.__SEMENTE = s;
    globalThis.__SEM_COLUNAS = {};
    globalThis.__QUEBRAR = [];
    globalThis.__SOU_ADMIN = d.souAdmin;
    globalThis.__DESATIVAR = ["a3"];
    globalThis.__BUSCA_SO_NO_TELEFONE = d.soNoTelefone;
    globalThis.__BUSCAS_PEDIDAS = [];
    if (!d.souAdmin) {
      // Quem não administra atende o departamento do telefone aberto, o
      // telefone do SAC e a linha desativada — e não as Audiências.
      globalThis.__SEMENTE = { ...s, permissoes: [
        { id: 901, usuario_id: "u1", departamento_id: d.depAberto, telefone_id: null },
        { id: 902, usuario_id: "u1", departamento_id: null, telefone_id: d.outro },
        { id: 903, usuario_id: "u1", departamento_id: null, telefone_id: "a3" },
      ] };
    }
    try { localStorage.setItem("zorvin_advogado", TEL); } catch (_) { /* sem armazenamento */ }
  }, { s: semente(), d: { ...d, vantoro: undefined, depAberto: DEP_DOS_TELEFONES[TEL], outro: OUTRO }, TEL });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const CAIXA = 'input[placeholder^="Buscar por nome"]';
async function buscar(page, termo, espera = 2600) {
  if (!(await page.locator(CAIXA).count())) return false;
  await page.fill(CAIXA, "");
  await page.waitForTimeout(300);
  await page.fill(CAIXA, termo);
  await page.waitForTimeout(espera);
  return true;
}

/** As linhas da lista, na ordem em que estão desenhadas. */
const linhas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-conversa-id]")]
  .filter((el) => el.offsetParent !== null)
  .map((el) => ({
    id: el.getAttribute("data-conversa-id"),
    selo: el.querySelector("[data-selo-do-telefone]")?.getAttribute("data-selo-do-telefone") ?? null,
    seloTexto: el.querySelector("[data-selo-do-telefone]")?.textContent ?? null,
    seloTitulo: el.querySelector("[data-selo-do-telefone]")?.getAttribute("title") ?? "",
    numero: el.querySelector("[data-numero-que-separa]")?.getAttribute("data-numero-que-separa") ?? null,
  })));
const achar = (lista, id) => lista.find((l) => l.id === id) || null;
const posicao = (lista, id) => lista.findIndex((l) => l.id === id);

/** O que a tela mostra: o telefone aberto, o alto da conversa, a caixa. */
const estado = (page) => page.evaluate(() => {
  let telefone = null;
  try { telefone = localStorage.getItem("zorvin_advogado"); } catch (_) { /* sem armazenamento */ }
  return {
    telefone,
    atendendo: document.querySelector("[data-atendendo-como]")?.innerText || "",
    topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
    caixa: document.querySelectorAll('textarea[placeholder*="Digite uma mensagem"]').length,
    desativada: document.querySelectorAll("[data-linha-desativada]").length,
    busca: document.querySelector('input[placeholder^="Buscar por nome"]')?.value ?? null,
    aviso: document.querySelector("[data-aviso]")?.innerText || "",
    alerta: [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText).join(" | "),
  };
});

async function clicarNaLinha(page, id) {
  const l = page.locator(`[data-conversa-id="${id}"]`).first();
  if (!(await l.count())) return false;
  await l.click();
  await page.waitForTimeout(3500);
  return true;
}

// ==================================================================
console.log("\nO lead que só conversa com o outro telefone é achado — e o clique leva até lá");
{
  const { ctx, page, estouros } = await abrirPainel();
  const antes = await estado(page);
  ok("a cena começa no telefone de sempre", antes.telefone === TEL, `telefone: ${antes.telefone}`);
  await buscar(page, "jessica lead");
  const ls = await linhas(page);
  const lead = achar(ls, "cv-lead");
  ok("a conversa do outro telefone aparece na busca", Boolean(lead), `vieram: ${ls.slice(0, 5).map((l) => l.id).join(", ")}`);
  ok("com o selo do telefone dela", lead && lead.selo === NOME_DO_OUTRO && lead.seloTexto === NOME_DO_OUTRO,
     lead ? `selo: ${lead.selo} / ${lead.seloTexto}` : "sem a linha");
  ok("e o selo diz que o clique abre lá", lead && /clique abre lá/.test(lead.seloTitulo), lead ? lead.seloTitulo : "");
  const pedidas = await page.evaluate(() => globalThis.__BUSCAS_PEDIDAS || []);
  ok("o painel pediu ao banco a busca em todos os telefones",
     pedidas.length > 0 && pedidas[pedidas.length - 1].p_todos_os_telefones === true,
     JSON.stringify(pedidas.slice(-2)));
  // O SELO PINTADO, e não só no documento: o centro dele é ele mesmo.
  const pintado = await page.evaluate(() => {
    const el = document.querySelector('[data-conversa-id="cv-lead"] [data-selo-do-telefone]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return Boolean(no && (no === el || el.contains(no)));
  });
  ok("o selo está pintado na linha", pintado);

  ok("cliquei na linha", await clicarNaLinha(page, "cv-lead"));
  const depois = await estado(page);
  ok("o telefone aberto passa a ser o dela", depois.telefone === OUTRO, `telefone: ${depois.telefone}`);
  ok("e o alto da lista diz o nome dele", depois.atendendo.includes(NOME_DO_OUTRO), `alto: “${depois.atendendo.slice(0, 60)}”`);
  ok("a conversa abre", /JESSICA LEAD/.test(depois.topo), `topo: “${depois.topo.slice(0, 60)}”`);
  ok("com a caixa de escrever (o telefone dela está ativo)", depois.caixa > 0 && depois.desativada === 0);
  ok("a busca foi apagada (a lista agora é a do telefone dela)", depois.busca === "", `busca: “${depois.busca}”`);
  ok("e a linha dela está na lista", Boolean(achar(await linhas(page), "cv-lead")));
  ok("nenhum aviso de \"sem acesso\"", !/sem acesso|não tem acesso/i.test(depois.aviso), depois.aviso);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA mensagem achada noutro telefone: o clique abre a conversa NELA");
{
  const { ctx, page, estouros } = await abrirPainel();
  await buscar(page, "zebrafina");
  const ls = await linhas(page);
  const lead = achar(ls, "cv-lead");
  ok("a busca acha a conversa pelo texto, no outro telefone", Boolean(lead) && lead.selo === NOME_DO_OUTRO,
     `vieram: ${ls.slice(0, 5).map((l) => `${l.id}/${l.selo}`).join(", ")}`);
  const trecho = await page.evaluate(() => document.querySelector('[data-conversa-id="cv-lead"]')?.innerText || "");
  ok("e mostra o trecho achado", /zebrafina/i.test(trecho), trecho.slice(0, 120));
  ok("cliquei na linha", await clicarNaLinha(page, "cv-lead"));
  await page.waitForTimeout(800);
  const alvo = await page.evaluate(() => {
    const el = document.querySelector('[data-msg-id="m-lead-alvo"]');
    if (!el) return { existe: false };
    const r = el.getBoundingClientRect();
    return { existe: true, naTela: r.top >= 0 && r.bottom <= innerHeight,
             fundo: getComputedStyle(el).backgroundColor };
  });
  const e = await estado(page);
  ok("abriu no telefone dela", e.telefone === OUTRO, `telefone: ${e.telefone}`);
  ok("a mensagem achada está na conversa (fora das 120 últimas)", alvo.existe);
  ok("e à vista", alvo.naTela === true, JSON.stringify(alvo));
  ok("e marcada", alvo.existe && alvo.fundo && alvo.fundo !== "rgba(0, 0, 0, 0)" && alvo.fundo !== "transparent",
     `fundo: ${alvo.fundo}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nO mesmo cliente nos dois telefones: a deste primeiro, e o selo separa as duas");
{
  const { ctx, page, estouros } = await abrirPainel();
  await buscar(page, "dois telefones");
  const ls = await linhas(page);
  const aqui = achar(ls, "cv-dois-aqui"), la = achar(ls, "cv-dois-la");
  ok("as duas conversas aparecem", Boolean(aqui && la), `vieram: ${ls.map((l) => l.id).join(", ")}`);
  ok("a deste telefone vem primeiro, mesmo sendo a mais antiga",
     aqui && la && posicao(ls, "cv-dois-aqui") < posicao(ls, "cv-dois-la"),
     `posições: aqui ${posicao(ls, "cv-dois-aqui")}, lá ${posicao(ls, "cv-dois-la")}`);
  ok("a deste telefone não leva selo", aqui && aqui.selo === null, aqui ? `selo: ${aqui.selo}` : "");
  ok("a do outro leva o selo dele", la && la.selo === NOME_DO_OUTRO, la ? `selo: ${la.selo}` : "");
  ok("e nenhuma das duas precisa do número: o selo já separa",
     aqui && la && aqui.numero === null && la.numero === null,
     `números: ${aqui && aqui.numero} / ${la && la.numero}`);

  await buscar(page, "homonimo de fora");
  const hs = await linhas(page);
  const h1 = achar(hs, "cv-homo-1"), h2 = achar(hs, "cv-homo-2");
  ok("os dois homônimos do outro telefone aparecem, com o selo", Boolean(h1 && h2)
     && h1.selo === NOME_DO_OUTRO && h2.selo === NOME_DO_OUTRO, `vieram: ${hs.map((l) => `${l.id}/${l.selo}`).join(", ")}`);
  ok("e os dois mostram o número: é ele que separa duas linhas do mesmo telefone",
     h1 && h2 && h1.numero === "5511970001011" && h2.numero === "5511970001012",
     `números: ${h1 && h1.numero} / ${h2 && h2.numero}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nNo teto de 80, as deste telefone vêm primeiro — e a nota fica depois das conversas");
{
  const { ctx, page, estouros } = await abrirPainel();
  await buscar(page, "palavrarepetida", 3200);
  const ls = await linhas(page);
  const primeiras = ls.slice(0, 3).map((l) => l.id).sort();
  ok("as três deste telefone estão nas primeiras linhas",
     JSON.stringify(primeiras) === JSON.stringify(["cv-rep-aqui-0", "cv-rep-aqui-1", "cv-rep-aqui-2"]),
     `primeiras: ${ls.slice(0, 4).map((l) => l.id).join(", ")}`);
  ok("e as de fora vêm depois, com o selo", ls.length > 3 && ls.slice(3).every((l) => l.selo === NOME_DO_OUTRO)
     && ls.slice(3).length > 0, `${ls.length} linhas`);
  const nota = await page.evaluate(() => {
    const n = document.querySelector("[data-corte-da-busca]");
    const linhasNaTela = [...document.querySelectorAll("[data-conversa-id]")].filter((el) => el.offsetParent !== null);
    if (!n || !linhasNaTela.length) return { existe: Boolean(n), linhas: linhasNaTela.length };
    let quadro = linhasNaTela[0].parentElement;
    while (quadro && !/auto|scroll/.test(getComputedStyle(quadro).overflowY)) quadro = quadro.parentElement;
    const topoDoQuadro = quadro ? quadro.getBoundingClientRect().top + quadro.scrollTop : 0;
    return {
      existe: true,
      texto: n.innerText,
      depoisDaUltima: n.getBoundingClientRect().top > linhasNaTela[linhasNaTela.length - 1].getBoundingClientRect().top,
      primeiraNoAlto: Math.round(linhasNaTela[0].getBoundingClientRect().top - topoDoQuadro),
    };
  });
  ok("a nota do teto aparece", nota.existe, JSON.stringify(nota));
  ok("e diz que as deste telefone vêm primeiro", /deste telefone primeiro/.test(nota.texto || ""), nota.texto);
  ok("ela mora DEPOIS das conversas", nota.depoisDaUltima === true, JSON.stringify(nota));
  ok("e a primeira conversa continua no alto da lista", typeof nota.primeiraNoAlto === "number" && nota.primeiraNoAlto < 10,
     `a primeira ficou a ${nota.primeiraNoAlto}px do alto`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nQuem não administra: só os telefones que atende — e nenhuma linha desativada");
{
  const { ctx, page, estouros } = await abrirPainel({ souAdmin: false });
  await buscar(page, "jessica lead");
  const lead = achar(await linhas(page), "cv-lead");
  ok("o lead do telefone que ela atende aparece, com o selo", Boolean(lead) && lead.selo === NOME_DO_OUTRO,
     lead ? `selo: ${lead.selo}` : "sem a linha");
  await buscar(page, "fora do alcance");
  const fora = await linhas(page);
  ok("a conversa do telefone que ela não atende NÃO aparece", !achar(fora, "cv-alcance"),
     `vieram: ${fora.map((l) => l.id).join(", ")}`);
  await buscar(page, "linha desativada");
  const desat = await linhas(page);
  ok("nem a da linha desativada (o clique não teria onde abrir)", !achar(desat, "cv-desat"),
     `vieram: ${desat.map((l) => l.id).join(", ")}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nQuem administra: a linha desativada aparece, e o clique a abre (só leitura)");
{
  const { ctx, page, estouros } = await abrirPainel();
  await buscar(page, "linha desativada");
  const desat = achar(await linhas(page), "cv-desat");
  ok("a conversa da linha desativada aparece, com o selo", Boolean(desat) && desat.selo === NOMES_DOS_TELEFONES[DESATIVADA],
     desat ? `selo: ${desat.selo}` : "sem a linha");
  ok("e o selo diz que a linha está desativada", desat && /linha desativada/.test(desat.seloTitulo), desat ? desat.seloTitulo : "");
  ok("cliquei na linha", await clicarNaLinha(page, "cv-desat"));
  const e = await estado(page);
  ok("abre no telefone desativado", e.telefone === DESATIVADA, `telefone: ${e.telefone}; aviso: “${e.aviso}”`);
  ok("a conversa abre", /LINHA DESATIVADA/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("e, no lugar da caixa de escrever, a explicação da linha desativada", e.desativada > 0 && e.caixa === 0,
     `explicação: ${e.desativada}, caixa: ${e.caixa}`);
  ok("nenhum aviso de \"sem acesso\"", !/sem acesso|não tem acesso/i.test(e.aviso), e.aviso);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nO banco sem o 049: a busca pergunta de novo sem o argumento novo, uma vez só");
{
  const { ctx, page, estouros } = await abrirPainel({ soNoTelefone: true });
  await buscar(page, "zebrafina");
  const p1 = await page.evaluate(() => globalThis.__BUSCAS_PEDIDAS || []);
  ok("a primeira busca pergunta com o argumento novo, e de novo sem ele",
     p1.length === 2 && p1[0].p_todos_os_telefones === true && !("p_todos_os_telefones" in p1[1]),
     JSON.stringify(p1));
  ok("sem o 049, o texto de outro telefone não é achado (é o banco de antes)",
     !achar(await linhas(page), "cv-lead"));
  const e = await estado(page);
  ok("e nenhum aviso de falha aparece", !e.alerta, `alerta: “${e.alerta}”`);
  await buscar(page, "jessica lead");
  const p2 = await page.evaluate(() => globalThis.__BUSCAS_PEDIDAS || []);
  ok("a segunda busca já pergunta só do jeito de antes",
     p2.length === 3 && !("p_todos_os_telefones" in p2[2]), JSON.stringify(p2.slice(2)));
  const lead = achar(await linhas(page), "cv-lead");
  ok("o nome continua sendo achado em todos os telefones (a busca por nome não depende do 049)",
     Boolean(lead) && lead.selo === NOME_DO_OUTRO, lead ? `selo: ${lead.selo}` : "sem a linha");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nO cadastro do Vantoro: a oferta de começar conversa continua sendo deste telefone");
{
  const vantoro = (q) => {
    if (q.includes("jessica")) return [{ id: 71, nome: LEAD, telefone: "(11) 97000-1001", telefone2: "" }];
    if (q.includes("dois telefones")) return [{ id: 72, nome: "CLIENTE DOS DOIS TELEFONES", telefone: "(11) 97000-1002", telefone2: "" }];
    return [];
  };
  const { ctx, page, estouros } = await abrirPainel({ vantoro });
  await buscar(page, "jessica lead", 5000);
  const lead = achar(await linhas(page), "cv-lead");
  ok("a conversa do outro telefone aparece", Boolean(lead) && lead.selo === NOME_DO_OUTRO);
  const oferta = await page.evaluate(() => [...document.querySelectorAll("[data-comecar-conversa]")]
    .map((el) => el.getAttribute("data-comecar-conversa")));
  ok("E a oferta de começar uma conversa por este telefone (aqui ele não tem conversa)",
     oferta.some((t) => t.replace(/\D/g, "").endsWith("970001001")), `ofertas: ${JSON.stringify(oferta)}`);
  await buscar(page, "dois telefones", 5000);
  const oferta2 = await page.evaluate(() => [...document.querySelectorAll("[data-comecar-conversa]")]
    .map((el) => el.getAttribute("data-comecar-conversa")));
  ok("quem já tem conversa neste telefone não ganha a oferta", oferta2.length === 0, `ofertas: ${JSON.stringify(oferta2)}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nNo celular (360), o selo cabe e a tela não rola de lado");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 360, altura: 760, celular: true });
  ok("a caixa de busca existe no celular", await buscar(page, "jessica lead"));
  const medida = await page.evaluate(() => {
    const linha = document.querySelector('[data-conversa-id="cv-lead"]');
    const selo = linha && linha.querySelector("[data-selo-do-telefone]");
    if (!linha || !selo) return { linha: Boolean(linha), selo: Boolean(selo) };
    const rl = linha.getBoundingClientRect(), rs = selo.getBoundingClientRect();
    const nome = linha.querySelector("span[title]");
    const no = document.elementFromPoint(rs.left + rs.width / 2, rs.top + rs.height / 2);
    return {
      linha: true, selo: true,
      dentro: rs.left >= rl.left - 0.5 && rs.right <= rl.right + 0.5,
      pintado: Boolean(no && (no === selo || selo.contains(no))),
      nome: nome ? Math.round(nome.getBoundingClientRect().width) : 0,
      rolaDeLado: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  ok("a linha do outro telefone aparece, com o selo", medida.linha && medida.selo, JSON.stringify(medida));
  ok("o selo fica dentro da linha", medida.dentro === true, JSON.stringify(medida));
  ok("e pintado", medida.pintado === true, JSON.stringify(medida));
  ok("o nome ainda se lê (não foi espremido a zero)", medida.nome >= 60, `o nome ficou com ${medida.nome}px`);
  ok("a tela não rola de lado", medida.rolaDeLado === false, JSON.stringify(medida));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
