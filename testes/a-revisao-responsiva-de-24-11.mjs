// A REVISÃO RESPONSIVA DE 24/11
//
// Pedido do Rodrigo: "Reveja todas as telas, inclusive na versão mobile para
// deixar 100% responsivas." Uma varredura abriu o Zorvin em nove larguras
// (320, 360, 390, 430, 768, 1024, 1280, 1366 e 1920), nos dois temas, em 31
// estados e nas janelas por cima. A tela de 05/11 já estava em ordem nas
// larguras de sempre, e o que apareceu mora nas pontas: o celular de 320 e as
// cores de três lugares que a revisão de 05/11 não abriu.
//
// Esta prova confere cada um, e reprova no painel de antes:
//   1. a marca "Ropelimi Zorvin" inteira no topo da lista, encolhendo a 320
//      (a tela dizia "Ropelimi Zor") e com os 19 pontos de sempre a 360;
//   2. o menu da seta da fita dentro da tela a 320 (passava da borda), e com
//      os 250 pontos de sempre no computador;
//   3. as abas da Mídia no celular: inteiras, pintadas e numa linha própria
//      (a 320 o começo de "Mídias" ficava fora da fita, sem como rolar até
//      ele, e a 390 a sombra da ponta cobria o "Links"); no computador, na
//      linha do título, como sempre;
//   4. a ponta que esmaece não cobre o último botão quando a fita chega ao
//      fim (o "Importar histórico" das Configurações, no celular, e os
//      atalhos do Painel), e continua cobrindo o que transborda no começo;
//   5. as letras com contraste de 4,5:1: o "Ligado" da aba do Quazar, o
//      rótulo "Pelo celular" na bolha verde do tema escuro, e o número das
//      três medalhas do pódio, nos dois temas;
//   6. os atalhos do Painel, no celular, esmaecendo na ponta (rolam de lado,
//      e "Proto" cortado seco se lia como tela quebrada).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (v) => (typeof v === "string" ? v : JSON.stringify(v));

const nav = await abrirNavegador();
const AGORA = Date.now();

// UMA CONVERSA COM UMA MENSAGEM QUE SAIU PELO CELULAR (a ponte a assina como
// "WhatsApp", e a bolha verde diz "Pelo celular").
const SEMENTE = {
  contatos: [{ id: "ct-resp", numero: "5511900000888", nome: "CLIENTE DA REVISAO", foto_url: null }],
  conversas: [{
    id: "cv-resp", advogado_id: "a7", contato_id: "ct-resp", ultima_mensagem: "Mandei pelo celular",
    ultima_atividade: new Date(AGORA - 30 * 1000).toISOString(), nao_lidas: 0,
    arquivada: false, fixada: true, situacao: "aberto",
  }],
  mensagens: [
    { id: "m-resp-1", conversa_id: "cv-resp", origem: "contato", tipo: "texto", texto: "bom dia",
      criado_em: new Date(AGORA - 120 * 1000).toISOString(), id_uazapi: "resp-1" },
    { id: "m-resp-2", conversa_id: "cv-resp", origem: "advogado", tipo: "texto", texto: "Mandei pelo celular",
      enviado_por: "WhatsApp", enviado_por_id: null,
      criado_em: new Date(AGORA - 30 * 1000).toISOString(), id_uazapi: "resp-2", status: "entregue" },
  ],
};

async function abrir({ largura = 1400, altura = 900, escuro = false, tela = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(60000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => { d.accept().catch(() => {}); });
  await page.addInitScript(([s, e]) => {
    globalThis.__SEMENTE = s;
    globalThis.__SOU_ADMIN = true;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    try { localStorage.setItem("zorvin_modo", e ? "escuro" : "claro"); } catch (_) { /* sem armazenamento */ }
  }, [SEMENTE, escuro]);
  await page.route("**/ponte-de-mentira/**", (rota) => {
    const caminho = new URL(rota.request().url()).pathname;
    let corpo = {};
    if (caminho.endsWith("/copiloto/estado")) corpo = { ok: true, ligado: true, modelo: "modelo-de-teste", resumo: true, ajustar: true, aprende: true };
    if (caminho.endsWith("/vantoro/status")) corpo = { ok: true, configurado: false };
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
  });
  if (tela) {
    await page.goto(`${ENDERECO}?tela=${tela}`);
    await page.waitForSelector(`[data-tela="${tela}"]`, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    await page.goto(ENDERECO);
    await page.waitForSelector("[data-conversa-nome]", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  return { ctx, page, estouros };
}
async function clicar(loc) {
  if (!(await loc.count())) return false;
  await loc.first().click({ timeout: 5000 }).catch(() => {});
  await loc.page().waitForTimeout(700);
  return true;
}
async function esperar(fn, ms = 8000) {
  const ate = Date.now() + ms;
  for (;;) {
    if (await fn().catch(() => false)) return true;
    if (Date.now() > ate) return false;
    await new Promise((r) => setTimeout(r, 150));
  }
}
const naoRolaDeLado = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

// O CONTRASTE DA WCAG, com o fundo do primeiro ancestral de fundo sólido.
const CONTA_DO_CONTRASTE = `
  const rgba = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fundoDe = (e) => { for (let p = e; p; p = p.parentElement) { const c = rgba(getComputedStyle(p).backgroundColor);
    if (c && c.a > 0.9) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const contraste = (e) => { const a = lum(rgba(getComputedStyle(e).color)), b = lum(fundoDe(e));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
`;
const contrasteDe = (page, seletor) => page.evaluate(([s, conta]) => {
  // eslint-disable-next-line no-new-func
  const contraste = new Function(`${conta}; return contraste;`)();
  const e = document.querySelector(s);
  return e ? Math.round(contraste(e) * 100) / 100 : null;
}, [seletor, CONTA_DO_CONTRASTE]);

// ==================================================================
console.log("\n1. A marca inteira no topo da lista");
for (const largura of [320, 360, 390, 1366]) {
  const { ctx, page, estouros } = await abrir({ largura, altura: largura < 768 ? 700 : 900 });
  const m = await page.evaluate(() => {
    // A marca é o "Zorvin" dentro de "Ropelimi Zorvin", no alto da lista.
    const z = [...document.querySelectorAll("span")].find((s) => s.textContent === "Zorvin"
      && s.parentElement && s.parentElement.textContent.replace(/\s/g, "") === "RopelimiZorvin");
    if (!z) return null;
    const r = document.createRange(); r.selectNodeContents(z);
    const t = r.getBoundingClientRect();
    let corte = null;
    for (let p = z.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(hidden|clip)/.test(getComputedStyle(p).overflowX)) { corte = p.getBoundingClientRect(); break; }
    }
    // O VÃO entre as duas palavras: o fim do "Ropelimi" até o começo do "Zorvin".
    const ropelimi = z.previousElementSibling;
    let vao = null;
    if (ropelimi) { const r2 = document.createRange(); r2.selectNodeContents(ropelimi); vao = t.left - r2.getBoundingClientRect().right; }
    return { direita: t.right, esquerda: t.left, corte: corte && { l: corte.left, r: corte.right },
             fonte: parseFloat(getComputedStyle(z.parentElement).fontSize), vao };
  });
  ok(`a ${largura}: a marca está no alto da lista`, !!m, q(m));
  if (m) {
    const inteira = !m.corte || (m.direita <= m.corte.r + 0.5 && m.esquerda >= m.corte.l - 0.5);
    ok(`a ${largura}: "Ropelimi Zorvin" aparece inteiro (sem o "Zorvin" cortado)`, inteira,
       q({ zorvin: [Math.round(m.esquerda), Math.round(m.direita)], caixa: m.corte && [Math.round(m.corte.l), Math.round(m.corte.r)] }));
    if (largura >= 360) ok(`a ${largura}: com os 19 pontos de sempre`, Math.abs(m.fonte - 19) < 0.1, String(m.fonte));
    else ok(`a ${largura}: encolhida, mas legível (de 14 a 19 pontos)`, m.fonte >= 14 && m.fonte <= 19, String(m.fonte));
    ok(`a ${largura}: com o vão entre "Ropelimi" e "Zorvin" (um quinto da letra)`, m.vao != null && Math.abs(m.vao - m.fonte * 0.2) < 1.5, q({ vao: m.vao, fonte: m.fonte }));
  }
  ok(`a ${largura}: a página não rola de lado`, await naoRolaDeLado(page));
  ok(`a ${largura}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. O menu da seta da fita cabe na tela");
for (const largura of [320, 390, 1366]) {
  const { ctx, page, estouros } = await abrir({ largura, altura: largura < 768 ? 700 : 900 });
  const abriu = await clicar(page.locator("[data-mais-filtros]"));
  const menu = page.locator("[data-menu-mais-filtros]");
  ok(`a ${largura}: o menu abre`, abriu && await esperar(async () => (await menu.count()) === 1));
  if (await menu.count()) {
    const m = await page.evaluate(() => {
      const e = document.querySelector("[data-menu-mais-filtros]").getBoundingClientRect();
      const f = document.querySelector("[data-fita-de-filtros]");
      const fr = f ? f.getBoundingClientRect() : null;
      return { l: e.left, r: e.right, w: e.width, W: innerWidth, fita: fr && { l: fr.left, r: fr.right } };
    });
    ok(`a ${largura}: o menu termina dentro da tela`, m.l >= -0.5 && m.r <= m.W + 0.5, q(m));
    ok(`a ${largura}: e dentro da coluna da lista`, !m.fita || (m.r <= m.fita.r + 0.5 && m.l >= m.fita.l - 0.5), q(m));
    // No computador, o tamanho de sempre: 250 de largura e a borda (252).
    // No celular, a folga dos dois lados da fita (12 à esquerda, e a borda à direita).
    ok(largura >= 768 ? `a ${largura}: com o tamanho de sempre (250 e a borda)` : `a ${largura}: com folga dos dois lados da fita`,
       largura >= 768 ? Math.abs(m.w - 252) < 1 : (!!m.fita && m.l - m.fita.l >= 11 && m.fita.r - m.r >= 9), q(m));
    const pintado = await page.evaluate(() => {
      const op = [...document.querySelectorAll("[data-menu-mais-filtros] button")].find((b) => /Todas as conversas|Grupos/.test(b.innerText));
      if (!op) return null;
      const r = op.getBoundingClientRect();
      const x = Math.min(innerWidth - 2, r.right - 4), y = r.top + r.height / 2;
      const el = document.elementFromPoint(x, y);
      return !!el && (op === el || op.contains(el));
    });
    ok(`a ${largura}: a ponta direita das opções está pintada`, pintado === true, q(pintado));
  }
  ok(`a ${largura}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. As abas da Mídia");
for (const [largura, escuro] of [[320, false], [390, true], [1366, false]]) {
  const { ctx, page, estouros } = await abrir({ largura, altura: largura < 768 ? 700 : 900, escuro });
  await clicar(page.locator('[aria-label*="Mídia" i]'));
  const abas = page.locator("[data-aba-das-midias]");
  ok(`a ${largura}: a Mídia abre, com as três abas`, await esperar(async () => (await abas.count()) === 3), String(await abas.count()));
  if ((await abas.count()) === 3) {
    const m = await page.evaluate(() => {
      const bs = [...document.querySelectorAll("[data-aba-das-midias]")];
      const cont = bs[0].parentElement, cr = cont.getBoundingClientRect();
      const cabeca = cont.parentElement;
      const titulo = cabeca.querySelector("[data-titulo-das-midias]");
      const fechar = cabeca.querySelector('button[aria-label="Fechar"]');
      const pintado = (e) => {
        if (!e) return false;
        const r = e.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!el && (e === el || e.contains(el));
      };
      const sombras = [...cabeca.querySelectorAll(".fita-borda")].filter((f) => f.getBoundingClientRect().width > 0);
      return {
        W: innerWidth,
        abas: bs.map((b) => {
          const r = b.getBoundingClientRect();
          const rg = document.createRange(); rg.selectNodeContents(b);
          const t = rg.getBoundingClientRect();
          const coberta = sombras.some((f) => { const fr = f.getBoundingClientRect(); return Math.min(t.right, fr.right) - Math.max(t.left, fr.left) > 0.5; });
          return { nome: b.innerText.trim(), l: r.left, r: r.right, cy: r.top + r.height / 2,
                   naFita: r.left >= cr.left - 0.5 && r.right <= cr.right + 0.5,
                   inteiro: b.scrollWidth <= b.clientWidth + 1, pintada: pintado(b), coberta };
        }),
        tituloPintado: pintado(titulo), tituloCy: titulo ? titulo.getBoundingClientRect().top + titulo.getBoundingClientRect().height / 2 : null,
        fecharPintado: pintado(fechar),
        fecharDentro: !!fechar && fechar.getBoundingClientRect().right <= innerWidth + 0.5,
      };
    });
    ok(`a ${largura}: as três abas medidas`, m.abas.length === 3, String(m.abas.length));
    for (const a of m.abas) {
      ok(`a ${largura}: "${a.nome}" dentro da tela e da fita`, a.l >= -0.5 && a.r <= m.W + 0.5 && a.naFita, q(a));
      ok(`a ${largura}: "${a.nome}" escrito inteiro`, a.inteiro, q(a));
      ok(`a ${largura}: "${a.nome}" pintado, e sem a sombra da ponta por cima`, a.pintada && !a.coberta, q(a));
    }
    ok(`a ${largura}: o título está pintado`, m.tituloPintado);
    ok(`a ${largura}: o X de fechar está pintado e dentro da tela`, m.fecharPintado && m.fecharDentro);
    const naLinhaDoTitulo = m.abas.every((a) => Math.abs(a.cy - m.tituloCy) < 14);
    if (largura < 768) ok(`a ${largura}: as abas numa linha própria, abaixo do título`, m.abas.every((a) => a.cy > m.tituloCy + 14), q({ abas: m.abas.map((a) => Math.round(a.cy)), titulo: Math.round(m.tituloCy) }));
    else ok(`a ${largura}: as abas na linha do título, como sempre`, naLinhaDoTitulo, q({ abas: m.abas.map((a) => Math.round(a.cy)), titulo: Math.round(m.tituloCy) }));
  }
  ok(`a ${largura}: a página não rola de lado`, await naoRolaDeLado(page));
  ok(`a ${largura}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
// O QUE A PONTA COBRE: no começo, o que transborda (é ela que diz "tem mais");
// rolada até o fim, nada — ali não há mais nada depois do último botão.
const pontaCobre = (page, seletorDaFita) => page.evaluate((s) => {
  const fita = document.querySelector(s);
  if (!fita) return null;
  const f = [...fita.querySelectorAll(".fita-borda")].find((x) => x.getBoundingClientRect().width > 0);
  if (!f) return { semPonta: true };
  const fr = f.getBoundingClientRect();
  const cobertos = [...fita.querySelectorAll("button")].filter((b) => getComputedStyle(b).display !== "none").map((b) => {
    const rg = document.createRange(); rg.selectNodeContents(b); const t = rg.getBoundingClientRect();
    return { nome: b.innerText.trim(), sobre: Math.round(Math.min(t.right, fr.right) - Math.max(t.left, fr.left)) };
  }).filter((x) => x.sobre > 0);
  return { rola: fita.scrollWidth > fita.clientWidth + 1, cobertos };
}, seletorDaFita);
const rolarAteOFim = (page, s) => page.evaluate((x) => { const e = document.querySelector(x); if (e) e.scrollLeft = e.scrollWidth; }, s);

console.log("\n4. A ponta que esmaece não cobre o último botão no fim da fita");
{
  const { ctx, page, estouros } = await abrir({ largura: 390, altura: 844 });
  await clicar(page.locator('[aria-label="Menu"]'));
  await clicar(page.getByRole("button", { name: "Configurações" }));
  const marcada = await page.evaluate(() => {
    const f = [...document.querySelectorAll(".fita-borda")].find((x) => x.getBoundingClientRect().width > 0);
    if (!f) return false;
    f.parentElement.setAttribute("data-fita-em-prova", "config");
    return true;
  });
  ok("as Configurações abrem, com a fita das abas", marcada);
  const antes = await pontaCobre(page, '[data-fita-em-prova="config"]');
  ok("no começo, a fita rola e a ponta esmaece o que transborda", !!antes && antes.rola && antes.cobertos.length > 0, q(antes));
  await rolarAteOFim(page, '[data-fita-em-prova="config"]');
  await page.waitForTimeout(250);
  const fim = await pontaCobre(page, '[data-fita-em-prova="config"]');
  ok("rolada até o fim, a ponta não cobre “Importar histórico”", !!fim && fim.cobertos.length === 0, q(fim));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, estouros } = await abrir({ largura: 390, altura: 844, tela: "painel" });
  const antes = await pontaCobre(page, "[data-nav-do-painel]");
  ok("os atalhos do Painel, a 390: a fita rola e tem a ponta que esmaece", !!antes && !antes.semPonta && antes.rola, q(antes));
  if (antes && !antes.semPonta) {
    ok("no começo, a ponta esmaece o atalho que transborda", antes.cobertos.length > 0, q(antes));
    const fade = await page.evaluate(() => {
      const n = document.querySelector("[data-nav-do-painel]");
      const f = [...n.querySelectorAll(".fita-borda")].find((x) => x.getBoundingClientRect().width > 0);
      return { direita: Math.round(f.getBoundingClientRect().right), nav: Math.round(n.getBoundingClientRect().right),
               desenho: getComputedStyle(f).backgroundImage };
    });
    ok("a ponta fica grudada na borda direita dos atalhos, e é um degradê", Math.abs(fade.direita - fade.nav) <= 1 && /gradient/.test(fade.desenho), q(fade));
    await rolarAteOFim(page, "[data-nav-do-painel]");
    await page.waitForTimeout(250);
    const fim = await pontaCobre(page, "[data-nav-do-painel]");
    ok("rolados até o fim, a ponta não cobre o último atalho", !!fim && fim.cobertos.length === 0, q(fim));
  }
  ok("a página não rola de lado", await naoRolaDeLado(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ largura: 1400, altura: 900, tela: "painel" });
  const larga = await pontaCobre(page, "[data-nav-do-painel]");
  ok("no computador, os atalhos cabem e a ponta não cobre nenhum", !!larga && !larga.rola && (larga.semPonta || larga.cobertos.length === 0), q(larga));
  await ctx.close();
}

// ==================================================================
console.log("\n5. As letras que se leem");
for (const escuro of [false, true]) {
  const tema = escuro ? "escuro" : "claro";
  // O "Ligado" da aba do Quazar.
  {
    const { ctx, page, estouros } = await abrir({ escuro });
    await clicar(page.locator('[aria-label="Menu"]'));
    await clicar(page.getByRole("button", { name: "Departamentos e acessos" }));
    await clicar(page.locator("[data-aba-copiloto]"));
    const ligado = '[data-copiloto-ligado="true"]';
    ok(`no ${tema}: a aba do Quazar diz que ele está ligado`, await esperar(async () => (await page.locator(ligado).count()) === 1));
    const c = await contrasteDe(page, ligado);
    ok(`no ${tema}: o "Ligado" se lê (4,5:1 ou mais)`, c != null && c >= 4.5, String(c));
    ok(`no ${tema}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
    await ctx.close();
  }
  // O "Pelo celular" na bolha de quem enviou.
  {
    const { ctx, page, estouros } = await abrir({ escuro });
    await clicar(page.locator('[data-conversa-id="cv-resp"]'));
    const rotulo = '[title^="Saiu pelo aplicativo do WhatsApp"]';
    ok(`no ${tema}: a bolha diz "Pelo celular"`, await esperar(async () => /Pelo celular/.test(await page.locator(rotulo).first().innerText())));
    const c = await contrasteDe(page, rotulo);
    ok(`no ${tema}: o rótulo "Pelo celular" se lê na bolha verde (4,5:1 ou mais)`, c != null && c >= 4.5, String(c));
    ok(`no ${tema}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
    await ctx.close();
  }
  // As medalhas do pódio: o 1º e o 2º nos atendimentos, e o 3º nas enviadas.
  {
    const { ctx, page, estouros } = await abrir({ escuro, tela: "painel" });
    const medidas = [];
    for (const metrica of ["atendimentos", "enviadas"]) {
      await clicar(page.locator(`[data-metrica-da-equipe="${metrica}"]`));
      await page.waitForTimeout(300);
      medidas.push(...await page.evaluate((conta) => {
        // eslint-disable-next-line no-new-func
        const contraste = new Function(`${conta}; return contraste;`)();
        return [...document.querySelectorAll("[data-podio-da-equipe] [data-lugar-do-podio]")].map((l) => {
          const s = [...l.querySelectorAll("span")].find((x) => /^\dº$/.test(x.textContent.trim()));
          return s ? { lugar: s.textContent.trim(), contraste: Math.round(contraste(s) * 100) / 100 } : null;
        }).filter(Boolean);
      }, CONTA_DO_CONTRASTE));
    }
    const lugares = new Set(medidas.map((x) => x.lugar));
    ok(`no ${tema}: o pódio mostra as três medalhas`, lugares.has("1º") && lugares.has("2º") && lugares.has("3º"), q(medidas));
    const ruins = medidas.filter((x) => x.contraste < 4.5);
    ok(`no ${tema}: o número de cada medalha se lê (4,5:1 ou mais)`, medidas.length >= 3 && ruins.length === 0, q(medidas));
    ok(`no ${tema}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
    await ctx.close();
  }
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
