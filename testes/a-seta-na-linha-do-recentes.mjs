// A SETA DOS FILTROS NA LINHA DO "RECENTES", NO CELULAR (25/11)
//
// Pedido do Rodrigo, com a foto do iPhone: a seta de "mais filtros" descia
// sozinha para uma segunda linha, embaixo do "Tudo". "Essa seta precisa ficar
// na mesma linha ali ao lado do 'Recentes'. Faça isso, mantendo tudo em uma
// única linha."
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. no celular, de 360 a 430, com "Não lidas 103": Tudo, Não lidas, a
//      ordem e a seta numa linha só, a seta à direita da ordem, tudo pintado
//      e dentro da fita, e nada cortado;
//   2. a 360 com a palavra mais larga da ordem ("Esperando"): ainda uma linha
//      e nada cortado;
//   3. quando não cabe (quatro dígitos a 360, e um celular de 320): ainda uma
//      linha, e quem cede é a PALAVRA "Não lidas" — o número, o "Tudo", a
//      ordem e a seta ficam inteiros, e o `title` diz o número;
//   4. a seta tem 40 pontos de alvo de dedo, e abre o menu;
//   5. com uma etiqueta escolhida, ainda uma linha, e nada sai da fita; e o
//      rastro de quem participou ganha uma linha própria, logo abaixo da fita,
//      com o nome à vista (como quinta coisa da linha, a 360 ele e as pílulas
//      viravam um desenho, um número e uma letra);
//   6. o menu da ordem cabe na tela (ele saía 90 pontos para a direita, e a
//      tela rolava de lado);
//   7. no computador, nada muda: a fita quebra como sempre, e a ordem mora na
//      linha da marca;
//   8. a pílula continua se lendo "Não lidas 103".
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrir({ largura, altura = 800, naoLidas = 103, ordem = "recentes" }) {
  const celular = largura < 768;
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura },
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(([n, o]) => {
    try { localStorage.setItem("zorvin_ordem", o); } catch (_) { /* sem armazenamento */ }
    if (n) globalThis.__CONTAGEM_DAS_ABAS_FIXA = { aguardando: 2, aberto: 377, finalizado: 433,
                                                  nao_lidas: { aguardando: 1, aberto: n, finalizado: 0 } };
  }, [naoLidas, ordem]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-fita-de-filtros]");
  await page.waitForTimeout(2200);
  return { ctx, page, estouros };
}

const clicar = async (page, sel) => {
  const l = page.locator(sel).first();
  if (!(await l.count())) return false;
  return l.click({ timeout: 4000 }).then(() => true).catch(() => false);
};

/** A fita medida: as linhas, quem está dentro, quem foi cortado, quem está pintado. */
function medir(page) {
  return page.evaluate(() => {
    const f = document.querySelector("[data-fita-de-filtros]");
    if (!f) return null;
    const cs = getComputedStyle(f), fr = f.getBoundingClientRect();
    const dentroDe = { esq: fr.left + parseFloat(cs.paddingLeft) - 0.5, dir: fr.right - parseFloat(cs.paddingRight) + 0.5 };
    const itens = [...f.children].filter((e) => e.getBoundingClientRect().width > 0);
    const caixas = itens.map((e) => e.getBoundingClientRect());
    const tops = new Set(caixas.map((r) => Math.round(r.top)));
    const pintado = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const q = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!q && (q === el || el.contains(q));
    };
    // Cortado é o texto que passou da caixa (as reticências da palavra) OU que
    // comeu o recheio da pílula. O scrollWidth sozinho não vê o segundo: o
    // "Tudo" que encolhe 10 pontos deixa o texto colado na borda, e as duas
    // contas continuam iguais.
    const dentroDoRecheio = (el) => {
      const b = el.getBoundingClientRect(), c = getComputedStyle(el), rg = document.createRange();
      rg.selectNodeContents(el);
      const t = rg.getBoundingClientRect();
      if (!t.width) return true;
      return t.left >= b.left + parseFloat(c.borderLeftWidth) + parseFloat(c.paddingLeft) - 0.5
          && t.right <= b.right - parseFloat(c.borderRightWidth) - parseFloat(c.paddingRight) + 0.5;
    };
    const cortado = (el) => !!el && (el.scrollWidth > el.clientWidth + 0.5 || !dentroDoRecheio(el));
    const seta = f.querySelector("[data-mais-filtros]");
    const ordem = f.querySelector("[data-ordem]");
    const tudo = f.querySelector('[data-aba="tudo"]');
    const nl = f.querySelector('[data-aba="naolidas"]');
    const sr = seta?.getBoundingClientRect(), orr = ordem?.getBoundingClientRect();
    return {
      linhas: tops.size, itens: itens.length,
      dentro: caixas.every((r) => r.left >= dentroDe.esq && r.right <= dentroDe.dir),
      seta: sr ? { w: Math.round(sr.width), h: Math.round(sr.height), dir: Math.round(sr.right), top: Math.round(sr.top) } : null,
      setaDentro: !!sr && sr.left >= dentroDe.esq && sr.right <= dentroDe.dir,
      setaDepoisDaOrdem: !!sr && !!orr && sr.left >= orr.right - 0.5 && Math.abs(sr.top - orr.top) < 1,
      ordemNaFita: !!ordem,
      pintados: { tudo: pintado(tudo), nl: pintado(nl), ordem: pintado(ordem), seta: pintado(seta) },
      cortados: { tudo: cortado(tudo), palavra: cortado(nl?.querySelector("[data-palavra-do-filtro]")),
                  numero: cortado(nl?.querySelector("[data-numero-do-filtro]")), ordem: cortado(ordem) },
      numero: nl?.querySelector("[data-numero-do-filtro]")?.textContent.trim() ?? null,
      numeroInteiroNaTela: (() => {
        const n = nl?.querySelector("[data-numero-do-filtro]"); if (!n) return false;
        const r = n.getBoundingClientRect(), p = nl.getBoundingClientRect();
        return r.left >= p.left && r.right <= p.right + 0.5;
      })(),
      texto: nl?.textContent ?? null, title: nl?.getAttribute("title") || "",
      quebra: cs.flexWrap,
      // A largura da tela é a do documento (clientWidth), e não innerWidth: no
      // celular, o navegador alarga a janela visível até caber o que
      // transbordou, e innerWidth passa a dizer 465 numa tela de 390.
      rola: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

console.log("\n1. No celular, com \"Não lidas 103\": uma linha só, e nada cortado");
for (const [largura, altura] of [[430, 932], [393, 852], [390, 844], [375, 812], [360, 740]]) {
  const { ctx, page, estouros } = await abrir({ largura, altura });
  const m = await medir(page);
  ok(`a ${largura}: a fita está lá, com a ordem dentro`, !!m && m.ordemNaFita, JSON.stringify(m));
  if (!m) { await ctx.close(); continue; }
  ok(`a ${largura}: uma linha só`, m.linhas === 1, `${m.linhas} linhas`);
  ok(`a ${largura}: a seta logo depois da ordem, na mesma altura`, m.setaDepoisDaOrdem, JSON.stringify(m.seta));
  ok(`a ${largura}: tudo dentro da fita`, m.dentro && m.setaDentro);
  ok(`a ${largura}: tudo pintado`, Object.values(m.pintados).every(Boolean) && Object.keys(m.pintados).length === 4,
     JSON.stringify(m.pintados));
  ok(`a ${largura}: nada cortado`, Object.values(m.cortados).every((v) => !v) && Object.keys(m.cortados).length === 4,
     JSON.stringify(m.cortados));
  ok(`a ${largura}: a seta com 40 pontos de alvo`, m.seta && m.seta.w >= 40 && m.seta.h >= 40, JSON.stringify(m.seta));
  ok(`a ${largura}: a pílula se lê "Não lidas 103"`, m.texto === "Não lidas 103", String(m.texto));
  ok(`a ${largura}: a tela não rola de lado`, !m.rola);
  ok(`a ${largura}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n2. A 360, com a palavra mais larga da ordem (\"Esperando\")");
{
  const { ctx, page } = await abrir({ largura: 360, altura: 740, ordem: "esperando" });
  const m = await medir(page);
  ok("a ordem diz \"Esperando\"", (await page.locator("[data-ordem]").first().textContent().catch(() => "")) === "Esperando");
  ok("uma linha só", !!m && m.linhas === 1, JSON.stringify(m));
  ok("tudo dentro da fita", !!m && m.dentro && m.setaDentro);
  ok("nada cortado", !!m && Object.keys(m.cortados).length === 4 && Object.values(m.cortados).every((v) => !v),
     JSON.stringify(m?.cortados));
  await ctx.close();
}

console.log("\n3. Quando não cabe: a palavra \"Não lidas\" cede, e o resto fica inteiro");
for (const [nome, largura, altura, naoLidas, ordem] of [
  ["quatro dígitos e Esperando, a 360", 360, 740, 1234, "esperando"],
  ["um celular de 320", 320, 640, 103, "recentes"],
  ["quatro dígitos, a 320", 320, 640, 1234, "esperando"],
]) {
  const { ctx, page } = await abrir({ largura, altura, naoLidas, ordem });
  const m = await medir(page);
  ok(`${nome}: a fita está lá`, !!m);
  if (!m) { await ctx.close(); continue; }
  ok(`${nome}: uma linha só`, m.linhas === 1, `${m.linhas} linhas`);
  ok(`${nome}: tudo dentro da fita, e a seta também`, m.dentro && m.setaDentro, JSON.stringify(m.seta));
  ok(`${nome}: a palavra cede`, m.cortados.palavra === true, JSON.stringify(m.cortados));
  ok(`${nome}: o número inteiro, na tela`, m.numero === String(naoLidas) && !m.cortados.numero && m.numeroInteiroNaTela,
     `${m.numero} ${JSON.stringify(m.cortados)}`);
  ok(`${nome}: o "Tudo" e a ordem inteiros`, !m.cortados.tudo && !m.cortados.ordem, JSON.stringify(m.cortados));
  ok(`${nome}: a seta inteira, pintada, com 40 pontos`, m.pintados.seta && m.seta.w >= 40, JSON.stringify(m.seta));
  ok(`${nome}: o title diz o número`, m.title === `Não lidas: ${naoLidas}`, m.title);
  ok(`${nome}: a tela não rola de lado`, !m.rola);
  await ctx.close();
}

console.log("\n4. A seta abre o menu, a 360");
{
  const { ctx, page } = await abrir({ largura: 360, altura: 740 });
  ok("o clique na seta abre o menu", await clicar(page, "[data-mais-filtros]")
     && await page.locator("[data-menu-mais-filtros]").count() === 1);
  await ctx.close();
}

console.log("\n5. Com uma etiqueta escolhida, e com o rastro de quem participou");
for (const largura of [390, 360]) {
  const { ctx, page } = await abrir({ largura, altura: 800 });
  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  const escolheu = await page.locator("[data-menu-mais-filtros] button", { hasText: "Aguardando cliente" }).first()
    .click({ timeout: 4000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(800);
  let m = await medir(page);
  ok(`a ${largura}: escolhi a etiqueta "Aguardando cliente"`, escolheu
     && (await page.locator("[data-mais-filtros]").first().getAttribute("aria-label").catch(() => "")) === "Filtrando por Aguardando cliente");
  ok(`a ${largura}, com a etiqueta: uma linha só, tudo dentro`, !!m && m.linhas === 1 && m.dentro, JSON.stringify(m));
  ok(`a ${largura}, com a etiqueta: o número e a ordem inteiros`, !!m && !m.cortados.numero && !m.cortados.ordem,
     JSON.stringify(m?.cortados));
  await clicar(page, '[data-grupo="quem"]');
  await page.waitForTimeout(400);
  const marcou = await clicar(page, '[data-quem="JENIFER ALMEIDA"]');
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);
  m = await medir(page);
  ok(`a ${largura}: liguei o filtro de quem participou`, marcou && await page.locator("[data-filtro-quem]").count() === 1);
  ok(`a ${largura}, com o rastro: a fita continua numa linha só, com as mesmas quatro`, !!m && m.linhas === 1 && m.dentro
     && m.itens === 4, JSON.stringify(m));
  const rastro = await page.evaluate(() => {
    const r = document.querySelector("[data-filtro-quem]"), f = document.querySelector("[data-fita-de-filtros]");
    if (!r || !f) return null;
    const rr = r.getBoundingClientRect(), fr = f.getBoundingClientRect();
    const nome = r.querySelector("button span:not([style*='flex-shrink'])") || r.querySelector("button span");
    const q = document.elementFromPoint(rr.left + 30, rr.top + rr.height / 2);
    return { naLinhaDeBaixo: !!r.closest("[data-rastro-no-celular]") && rr.top >= fr.bottom - 0.5,
             naTela: rr.left >= 0 && rr.right <= document.documentElement.clientWidth, pintado: !!q && r.contains(q),
             nome: nome ? nome.getBoundingClientRect().width : 0 };
  });
  ok(`a ${largura}, com o rastro: ele mora na linha de baixo, pintado e na tela`,
     !!rastro && rastro.naLinhaDeBaixo && rastro.naTela && rastro.pintado, JSON.stringify(rastro));
  ok(`a ${largura}, com o rastro: o nome à vista`, !!rastro && rastro.nome >= 40, JSON.stringify(rastro));
  ok(`a ${largura}, com o rastro: a ordem e a seta inteiras e pintadas`, !!m && !m.cortados.ordem && m.pintados.ordem
     && m.pintados.seta, JSON.stringify(m?.pintados));
  ok(`a ${largura}, com o rastro: a tela não rola de lado`, !!m && !m.rola);
  await ctx.close();
}

console.log("\n6. O menu da ordem cabe na tela");
for (const largura of [390, 360, 320]) {
  const { ctx, page } = await abrir({ largura, altura: 760 });
  await clicar(page, "[data-ordem]");
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const m = document.querySelector("[data-menu-ordem]");
    if (!m) return null;
    const b = m.getBoundingClientRect();
    return { esq: Math.round(b.left), dir: Math.round(b.right), largura: document.documentElement.clientWidth,
             rola: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  ok(`a ${largura}: o menu abre, inteiro na tela`, !!r && r.esq >= 0 && r.dir <= r.largura, JSON.stringify(r));
  ok(`a ${largura}: e a tela não rola de lado`, !!r && !r.rola);
  await ctx.close();
}

console.log("\n7. No computador, nada muda");
{
  const { ctx, page } = await abrir({ largura: 1366, altura: 900 });
  const m = await medir(page);
  ok("a fita quebra como sempre (wrap)", !!m && m.quebra === "wrap", String(m?.quebra));
  ok("a ordem mora na linha da marca, e não na fita", !!m && !m.ordemNaFita
     && await page.locator("[data-ordem]").count() === 1);
  const recheio = await page.evaluate(() => getComputedStyle(document.querySelector('[data-aba="tudo"]')).paddingLeft);
  ok("o recheio das pílulas é o de sempre (11)", recheio === "11px", recheio);
  ok("a pílula é o texto de sempre, sem os dois pedaços do celular",
     await page.locator('[data-aba="naolidas"] [data-palavra-do-filtro]').count() === 0
     && (await page.locator('[data-aba="naolidas"]').innerText().catch(() => "")) === "Não lidas 103");
  ok("a pílula se lê \"Não lidas 103\"", !!m && m.texto === "Não lidas 103", String(m?.texto));
  await clicar(page, '[data-grupo="quem"]');
  await page.waitForTimeout(400);
  await clicar(page, '[data-quem="JENIFER ALMEIDA"]');
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);
  ok("o rastro de quem participou continua dentro da fita", await page.locator("[data-fita-de-filtros] [data-filtro-quem]").count() === 1
     && await page.locator("[data-rastro-no-celular]").count() === 0);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
