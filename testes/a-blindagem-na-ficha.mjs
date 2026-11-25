// O SELO DA BLINDAGEM NA FICHA DO VANTORO (25/11)
//
// Pedido do Rodrigo: "Preciso de alguma forma saber qual cliente já está
// blindado ou não." A regra é do Vantoro (core/blindagem.py, a tela Blindagem):
// cada ação distribuída com a procuração específica assinada há menos de um ano
// e juntada no processo. A ficha (`GET /clientes/<id>`) manda `blindagem`, com
// a aba que a tela de lá mostraria e os números que a explicam.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. as quatro respostas, cada uma com o nome da aba do Vantoro, a cor e o
//      resumo: completa, parcial (com o que falta, em partes), pendente e sem
//      ação distribuída;
//   2. a parcial só com procurações assinadas diz que falta juntar;
//   3. o link "Ver no Vantoro" abre a tela Blindagem de lá já pesquisada pelo
//      nome do cliente (é ali que se fazem as procurações específicas), numa aba
//      nova, com noopener; o nome vai escapado e sem os espaços de sobra; sem
//      nome, a tela sem pesquisa; sem ação distribuída, não há link;
//   4. sem `blindagem` na resposta (um Vantoro de antes) e com um estado que o
//      Zorvin não conhece, nenhum selo, e a ficha continua;
//   5. o selo vem antes da ordem de serviço, pintado e dentro da ficha, também
//      na gaveta (1100) e no celular (390 e 360);
//   6. a letra se lê nos dois temas (4,5:1).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { seloDaBlindagem } from "../src/blindagem.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const OS = { id: 77, status: "ABERTA", pendencias: [] };
const BASE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
               telefone: "5567992183107", telefone2: "", observacoes: "",
               documentos: 0, processos: [], ordem_servico: OS };
const B = (estado, extra = {}) => ({ estado, total: 3, blindadas: 0, falta_juntar: 0, vencidas: 0,
                                     sem_procuracao: 0, porcentagem: 0, validade_dias: 365, ...extra });
const COMPLETA = B("completa", { blindadas: 3, porcentagem: 100 });
const PARCIAL = B("parcial", { blindadas: 1, falta_juntar: 1, vencidas: 1, porcentagem: 33 });
const SO_ASSINADAS = B("parcial", { falta_juntar: 3 });
const PENDENTE = B("pendente", { sem_procuracao: 3 });
const SEM_ACAO = B("sem_acao", { total: 0 });
const LINK = "https://app.vantoro.com.br/cadastro/blindagem/?q=ANDREIA%20CRISTINA%20MARTINS";

const nav = await abrirNavegador();

async function abrirFicha(cliente, { largura = 1500, altura = 900, escuro = false } = {}) {
  const celular = largura < 768;
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura },
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((t) => {
    try { localStorage.setItem("zorvin_modo", t); } catch (_) { /* sem armazenamento */ }
  }, escuro ? "escuro" : "claro");
  await ctx.route("https://app.vantoro.com.br/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "text/html", body: "<title>Vantoro</title>ficha" }));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/vantoro/status")) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ligado: true, configurado: true }) });
    }
    if (url.pathname.endsWith("/vantoro/cliente")) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: [cliente], opcoes: {} }) });
    }
    if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, cliente }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const linha = page.locator('[data-conversa-nome*="Deus"]');
  if (await linha.count()) { await linha.first().click().catch(() => {}); await page.waitForTimeout(1200); }
  if (!(await page.locator("[data-ficha]").count())) {
    const b = page.locator("[data-abrir-ficha]");
    if (await b.count() && await b.first().isVisible()) await b.first().click().catch(() => {});
    else {
      const mais = page.getByRole("button", { name: "Mais opções desta conversa" });
      if (await mais.count()) {
        await mais.first().click().catch(() => {});
        await page.waitForTimeout(300);
        const item = page.locator("[data-menu-ficha]");
        if (await item.count()) await item.first().click().catch(() => {});
      }
    }
  }
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** O selo medido: o que diz, a cor, se está pintado, e onde fica. */
async function medir(page) {
  return page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const ficha = document.querySelector("[data-ficha]");
    const s = ficha && ficha.querySelector("[data-blindagem]");
    const os = ficha && ficha.querySelector("[data-abrir-a-os]");
    if (!s) return { tem: false, ficha: !!ficha, os: !!os, completa: !!ficha?.querySelector("[data-ficha-completa]") };
    s.scrollIntoView({ block: "center" });
    const r = s.getBoundingClientRect(), f = ficha.getBoundingClientRect();
    const titulo = s.querySelector("[data-blindagem-titulo]");
    const tr = titulo.getBoundingClientRect();
    const quem = document.elementFromPoint(tr.x + tr.width / 2, tr.y + tr.height / 2);
    const link = s.querySelector("[data-blindagem-link]");
    const lr = link ? link.getBoundingClientRect() : null;
    const quemLink = lr ? document.elementFromPoint(lr.x + lr.width / 2, lr.y + lr.height / 2) : null;
    const partes = s.querySelector("[data-blindagem-partes]");
    const cs = getComputedStyle(titulo), fundo = getComputedStyle(s).backgroundColor;
    const resumo = s.querySelector("[data-blindagem-resumo]");
    return {
      tem: true, estado: s.getAttribute("data-blindagem"),
      titulo: titulo.textContent.trim(), resumo: resumo ? resumo.textContent.trim() : "",
      partes: partes ? partes.textContent.trim() : null,
      cor: cs.color, borda: getComputedStyle(s).borderLeftColor,
      contrasteTitulo: contraste(cs.color, fundo),
      contrasteResumo: resumo ? contraste(getComputedStyle(resumo).color, fundo) : 0,
      contrastePartes: partes ? contraste(getComputedStyle(partes).color, fundo) : 99,
      icone: !!s.querySelector("svg"), title: s.getAttribute("title") || "",
      href: link ? link.getAttribute("href") : null, alvo: link ? link.getAttribute("target") : null,
      rel: link ? link.getAttribute("rel") || "" : "",
      linkPintado: !!quemLink && (quemLink === link || link.contains(quemLink)),
      pintado: !!quem && (quem === titulo || titulo.contains(quem)),
      dentro: r.left >= f.left - 1 && r.right <= f.right + 1 && r.left >= 0 && r.right <= document.documentElement.clientWidth
              && (!lr || (lr.right <= r.right + 1 && lr.left >= r.left - 1)),
      antesDaOs: !os || !!(s.compareDocumentPosition(os) & Node.DOCUMENT_POSITION_FOLLOWING),
      os: !!os, completa: !!ficha.querySelector("[data-ficha-completa]"),
      rolaDeLado: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

/** A cor do tema, lida da própria tela (o texto verde, âmbar e vermelho). */
const COR = { claro: { verde: "rgb(1, 117, 97)", ambar: "rgb(122, 95, 0)", vermelho: "rgb(198, 40, 40)" },
              escuro: { verde: "rgb(31, 191, 156)", ambar: "rgb(212, 160, 23)", vermelho: "rgb(255, 180, 171)" } };

console.log("\n0. A conta do selo, direto na função");
{
  ok("completa", seloDaBlindagem(COMPLETA)?.titulo === "Blindagem completa"
     && seloDaBlindagem(COMPLETA).resumo === "as 3 ações com a procuração juntada"
     && seloDaBlindagem(COMPLETA).partes.length === 0, JSON.stringify(seloDaBlindagem(COMPLETA)));
  ok("completa com uma ação só", seloDaBlindagem(B("completa", { total: 1, blindadas: 1 }))?.resumo
     === "a ação com a procuração juntada");
  ok("parcial com as partes", seloDaBlindagem(PARCIAL)?.resumo === "1 de 3 ações blindadas"
     && seloDaBlindagem(PARCIAL).partes.join(" · ")
       === "1 blindada · 1 assinada, falta juntar · 1 vencida (mais de 1 ano)", JSON.stringify(seloDaBlindagem(PARCIAL)));
  ok("parcial com uma ação blindada de uma", seloDaBlindagem(B("parcial", { total: 1, vencidas: 1 }))?.resumo
     === "0 de 1 ação blindada");
  ok("parcial com sem procuração", seloDaBlindagem(B("parcial", { blindadas: 1, sem_procuracao: 2 }))?.partes.join(" · ")
     === "1 blindada · 2 sem procuração");
  ok("pendente", seloDaBlindagem(PENDENTE)?.resumo === "nenhuma procuração nas 3 ações"
     && seloDaBlindagem(PENDENTE).partes.length === 0);
  ok("sem ação distribuída", seloDaBlindagem(SEM_ACAO)?.titulo === "Sem ação distribuída");
  ok("sem a blindagem, nada", seloDaBlindagem(undefined) === null && seloDaBlindagem(null) === null
     && seloDaBlindagem("completa") === null);
  ok("um estado que não conhece, nada", seloDaBlindagem(B("blindado")) === null);
  ok("número estranho vale zero", seloDaBlindagem(B("parcial", { blindadas: "x", falta_juntar: -2, vencidas: 1 }))
     ?.partes.join(" · ") === "1 vencida (mais de 1 ano)");
}

console.log("\n1. Completa: verde, com o link para o Vantoro");
{
  const { ctx, page, estouros } = await abrirFicha({ ...BASE, blindagem: COMPLETA });
  const m = await medir(page);
  ok("o selo aparece", m.tem && m.estado === "completa", JSON.stringify(m));
  ok("diz \"Blindagem completa\"", m.titulo === "Blindagem completa", m.titulo);
  ok("com o resumo", m.resumo === "· as 3 ações com a procuração juntada", m.resumo);
  ok("sem as partes", m.partes === null, String(m.partes));
  ok("verde", m.cor === COR.claro.verde && m.borda === COR.claro.verde, `${m.cor} ${m.borda}`);
  ok("com o ícone", m.icone);
  ok("o title explica a regra", /juntada no processo/.test(m.title) && /menos de 1 ano/.test(m.title), m.title);
  ok("o link abre a tela Blindagem do Vantoro, pesquisada pelo nome", m.href === LINK, String(m.href));
  ok("numa aba nova, com noopener e noreferrer", m.alvo === "_blank" && /noopener/.test(m.rel) && /noreferrer/.test(m.rel),
     `${m.alvo} ${m.rel}`);
  ok("o selo está pintado, e o link também", m.pintado && m.linkPintado);
  ok("dentro da ficha", m.dentro);
  ok("antes da ordem de serviço", m.os && m.antesDaOs);
  ok("a letra se lê", m.contrasteTitulo >= 4.5 && m.contrasteResumo >= 4.5,
     `${m.contrasteTitulo.toFixed(2)} / ${m.contrasteResumo.toFixed(2)}`);
  if (m.href) {
    const [aba] = await Promise.all([
      ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null),
      page.locator("[data-blindagem-link]").first().click().catch(() => {}),
    ]);
    if (aba) await aba.waitForLoadState().catch(() => {});
    ok("o clique abre a aba nova no Vantoro, e o Zorvin fica", !!aba && aba.url() === LINK
       && await page.locator("[data-ficha]").count() > 0, aba ? aba.url() : "nenhuma aba");
  } else ok("o clique abre a aba nova no Vantoro, e o Zorvin fica", false, "sem link");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n2. Parcial: âmbar, com o que falta");
{
  const { ctx, page } = await abrirFicha({ ...BASE, blindagem: PARCIAL });
  const m = await medir(page);
  ok("diz \"Blindagem parcial\"", m.tem && m.titulo === "Blindagem parcial", JSON.stringify(m));
  ok("com quantas de quantas", m.resumo === "· 1 de 3 ações blindadas", m.resumo);
  ok("e as partes", m.partes === "1 blindada · 1 assinada, falta juntar · 1 vencida (mais de 1 ano)", String(m.partes));
  ok("âmbar", m.cor === COR.claro.ambar && m.borda === COR.claro.ambar, m.cor);
  ok("a letra das partes se lê", m.contrastePartes >= 4.5, m.contrastePartes.toFixed(2));
  ok("com o link", m.href === LINK);
  await ctx.close();
}

console.log("\n3. Só assinadas, sem juntada: parcial, e diz que falta juntar");
{
  const { ctx, page } = await abrirFicha({ ...BASE, blindagem: SO_ASSINADAS });
  const m = await medir(page);
  ok("parcial, 0 de 3", m.tem && m.titulo === "Blindagem parcial" && m.resumo === "· 0 de 3 ações blindadas",
     `${m.titulo} ${m.resumo}`);
  ok("falta juntar", m.partes === "3 assinadas, falta juntar", String(m.partes));
  await ctx.close();
}

console.log("\n4. Pendente: vermelho, nenhuma procuração");
{
  const { ctx, page } = await abrirFicha({ ...BASE, blindagem: PENDENTE });
  const m = await medir(page);
  ok("diz \"Blindagem pendente\"", m.tem && m.titulo === "Blindagem pendente", JSON.stringify(m));
  ok("nenhuma procuração", m.resumo === "· nenhuma procuração nas 3 ações", m.resumo);
  ok("sem as partes", m.partes === null);
  ok("vermelho", m.cor === COR.claro.vermelho && m.borda === COR.claro.vermelho, m.cor);
  ok("com o link", m.href === LINK);
  await ctx.close();
}

console.log("\n5. Sem ação distribuída: neutro, sem link");
{
  const { ctx, page } = await abrirFicha({ ...BASE, blindagem: SEM_ACAO });
  const m = await medir(page);
  ok("diz \"Sem ação distribuída\"", m.tem && m.titulo === "Sem ação distribuída", JSON.stringify(m));
  ok("nada a blindar", m.resumo === "· nada a blindar por enquanto", m.resumo);
  ok("não é verde, âmbar nem vermelho", m.cor && ![COR.claro.verde, COR.claro.ambar, COR.claro.vermelho].includes(m.cor), m.cor);
  ok("sem link", m.href === null);
  ok("a letra se lê", m.contrasteTitulo >= 4.5, m.contrasteTitulo.toFixed(2));
  await ctx.close();
}

console.log("\n5b. O nome na pesquisa: escapado, sem os espaços de sobra; sem nome, a tela sem pesquisa");
for (const [nome, cliente, esperado] of [
  ["acento, & e espaço dobrado", { ...BASE, nome: "  JOSÉ  DÁVILA & FILHOS ", blindagem: PENDENTE },
   "https://app.vantoro.com.br/cadastro/blindagem/?q=JOS%C3%89%20D%C3%81VILA%20%26%20FILHOS"],
  ["sem nome", { ...BASE, nome: "", blindagem: PENDENTE }, "https://app.vantoro.com.br/cadastro/blindagem/"],
]) {
  const { ctx, page } = await abrirFicha(cliente);
  const m = await medir(page);
  ok(`${nome}: o link certo`, m.tem && m.href === esperado, String(m.href));
  await ctx.close();
}

console.log("\n6. Sem a blindagem na resposta, e com um estado que não conhece: nenhum selo");
for (const [nome, cliente] of [["um Vantoro de antes", BASE], ["um estado que não conhece", { ...BASE, blindagem: B("blindado") }]]) {
  const { ctx, page, estouros } = await abrirFicha(cliente);
  const m = await medir(page);
  ok(`${nome}: sem selo`, m.ficha && !m.tem, JSON.stringify(m));
  ok(`${nome}: a ficha continua (a ordem e a ficha completa)`, m.os && m.completa);
  ok(`${nome}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n7. Na gaveta e no celular");
for (const [largura, altura] of [[1100, 820], [390, 844], [360, 740]]) {
  const { ctx, page } = await abrirFicha({ ...BASE, blindagem: PARCIAL }, { largura, altura });
  const m = await medir(page);
  ok(`a ${largura}: o selo aparece, pintado`, m.tem && m.pintado, JSON.stringify(m));
  ok(`a ${largura}: dentro da tela, e o link também`, m.dentro && m.linkPintado);
  ok(`a ${largura}: a tela não rola de lado`, m.tem && !m.rolaDeLado);
  await ctx.close();
}

console.log("\n8. No tema escuro");
for (const [nome, b, tom] of [["completa", COMPLETA, "verde"], ["parcial", PARCIAL, "ambar"], ["pendente", PENDENTE, "vermelho"]]) {
  const { ctx, page } = await abrirFicha({ ...BASE, blindagem: b }, { escuro: true });
  const m = await medir(page);
  ok(`${nome}: a cor do tema escuro`, m.tem && m.cor === COR.escuro[tom], m.cor);
  ok(`${nome}: a letra se lê`, m.contrasteTitulo >= 4.5 && m.contrasteResumo >= 4.5 && m.contrastePartes >= 4.5,
     `${m.contrasteTitulo?.toFixed(2)} / ${m.contrasteResumo?.toFixed(2)} / ${m.contrastePartes?.toFixed(2)}`);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
