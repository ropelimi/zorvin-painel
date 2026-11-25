// A VARREDURA DO CELULAR, MEDINDO PELA LARGURA CERTA (25/11)
//
// Pedido do Rodrigo, depois da seta dos filtros: "E quero que faça uma
// varredura no celular medindo do jeito certo".
//
// O JEITO CERTO: no celular de verdade (e no emulado, `isMobile`), quando algo
// transborda, o navegador ALARGA a janela até caber, e `innerWidth` passa a
// dizer o tamanho do que transbordou (465 numa tela de 390). Uma prova que
// compara com `innerWidth` aprova a tela que rola de lado. A tela se mede por
// `document.documentElement.clientWidth`, que continua sendo a tela. Onze
// provas mediam do jeito errado, e o menu da ordem passou por elas indo até
// 464 pontos.
//
// O QUE ESTA PROVA GUARDA, numa tela de 360 (o Android pequeno, a régua da
// casa) e em alguns estados a 320×568 (o iPhone SE antigo), com o celular
// emulado como celular:
//   - a página não rola de lado;
//   - nada sai da tela (o que se vê de cada elemento, cortado por quem o
//     recorta de lado — o item de uma fita que rola fica dentro da fita);
//   - nenhum texto sai de dentro do botão (o "Criar" dos assuntos do "Já
//     tratei" era espremido a 40 pontos, com a palavra saindo dele);
//   - e os menus que abrem para baixo (o ⋮ da conversa, o da ordem, o dos
//     responsáveis) cabem na altura: a 320×568 o ⋮ da conversa passava do pé
//     da tela, e hoje tem a altura que sobra e rola por dentro.
//
// Os estados são a lista e os menus dela, a conversa e os dela, cada aba das
// Configurações e de Departamentos e acessos, e as cinco telas. A varredura
// completa (cada botão de cada lugar, em seis larguras) foi feita uma vez, e
// está contada no CLAUDE.md; esta prova é a parte dela que fica.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const erros = [];

const clicar = async (page, sel, op = {}) => {
  const el = typeof sel === "string" ? page.locator(sel).first() : sel;
  if (!(await el.count().catch(() => 0))) return false;
  await el.click({ timeout: 4000, ...op }).catch(() => {});
  await page.waitForTimeout(600);
  return true;
};
const abrirConversa = async (page) => {
  if (!(await clicar(page, "[data-conversa-nome]"))) return false;
  await page.waitForSelector("[data-campo]", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  return true;
};
const doMenuTopo = async (page, texto) => {
  if (!(await clicar(page, "[data-menu-do-topo]"))) return false;
  const item = page.locator("span:has(> [data-menu-do-topo])").getByRole("button", { name: texto }).first();
  if (!(await item.count())) return false;
  await item.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1000);
  return true;
};
const aba = (menu, nome) => async (page) => {
  if (!(await doMenuTopo(page, menu))) return false;
  const b = page.getByRole("button", { name: nome, exact: true }).first();
  if (!(await b.count())) return false;
  await b.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  return true;
};

const CONFIG = ["Perfil", "Aparência", "Avisos", "Contatos", "Mensagens rápidas", "Etiquetas", "Importar histórico"];
const DEPS = ["Departamentos e telefones", "Atendentes", "Distribuição", "Fora do horário", "Aviso de espera", "Quazar",
  "Notas no Vantoro", "Atualizações do banco"];

// [nome, como abrir (ou a tela da guia), larguras, o que tem de aparecer]
const TODAS = [[360, 780]], TAMBEM_320 = [[360, 780], [320, 568]];
const ESTADOS = [
  ["a lista", async () => true, TAMBEM_320],
  ["o menu da ordem", (p) => clicar(p, "[data-ordem]"), TAMBEM_320, "[data-menu-ordem]"],
  ["o menu da seta dos filtros", (p) => clicar(p, "[data-mais-filtros]"), TAMBEM_320, "[data-menu-mais-filtros]"],
  ["o seletor de responsáveis", (p) => clicar(p, "[data-seletor-de-responsaveis]"), TAMBEM_320, "[data-menu-responsaveis]"],
  ["a nova conversa", (p) => clicar(p, '[aria-label="Nova conversa"]'), TODAS],
  ["o menu ⋮ do topo", (p) => clicar(p, "[data-menu-do-topo]"), TAMBEM_320],
  ["a conversa", abrirConversa, TAMBEM_320, "[data-campo]"],
  ["o menu ⋮ da conversa", async (p) => (await abrirConversa(p)) && clicar(p, '[aria-label="Mais opções desta conversa"]'), TAMBEM_320, "[data-menu-conversa]"],
  ["o painel do +", async (p) => (await abrirConversa(p)) && clicar(p, "[data-mais]"), TAMBEM_320, "[data-painel-do-mais]"],
  ["as figurinhas", async (p) => (await abrirConversa(p)) && clicar(p, "[data-figurinhas] button"), TODAS],
  ...CONFIG.map((n) => [`Configurações → ${n}`, aba("Configurações", n), TODAS]),
  ...DEPS.map((n) => [`Departamentos e acessos → ${n}`, aba("Departamentos e acessos", n),
    n === "Departamentos e telefones" ? TAMBEM_320 : TODAS]),
  ...["funil", "tarefas", "esperando", "painel", "ligacoes"].map((t) => [`a tela ${t}`, { tela: t }, TODAS]),
];

function medir() {
  const de = document.documentElement;
  const W = de.clientWidth, H = de.clientHeight;
  const desc = (e) => {
    const a = [...e.attributes].find((x) => x.name.startsWith("data-") || x.name === "aria-label");
    return `${e.tagName.toLowerCase()}${a ? `[${a.name}]` : ""} «${(e.innerText || e.value || "").trim().replace(/\s+/g, " ").slice(0, 30)}»`;
  };
  const visivel = (e) => {
    const s = getComputedStyle(e);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // O que se vê de lado: o retângulo cortado por quem recorta de lado (um
  // ancestral fixo não é recortado pelos de fora).
  const deLado = (e) => {
    const r = e.getBoundingClientRect();
    let l = r.left, d = r.right, fixo = getComputedStyle(e).position === "fixed";
    for (let p = e.parentElement; p && p !== de; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (fixo && s.transform === "none" && s.filter === "none" && s.contain === "none") continue;
      if (s.position === "fixed") fixo = true;
      if (s.overflowX !== "visible") { const q = p.getBoundingClientRect(); l = Math.max(l, q.left); d = Math.min(d, q.right); }
    }
    return { l, d };
  };
  const fora = [], texto = [], marcados = new Set();
  for (const e of document.querySelectorAll("body *")) {
    if (!visivel(e)) continue;
    const v = deLado(e);
    if (v.d - v.l < 1) continue;
    let pai = false;
    for (let p = e.parentElement; p; p = p.parentElement) if (marcados.has(p)) { pai = true; break; }
    if ((v.d > W + 1 || v.l < -1) && !pai) { marcados.add(e); fora.push(`${desc(e)} de ${Math.round(v.l)} a ${Math.round(v.d)}`); }
    if (e.matches("button, [role=button]") && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const s = getComputedStyle(e);
      if (s.textOverflow === "ellipsis") continue;
      const b = e.getBoundingClientRect(), rg = document.createRange();
      rg.selectNodeContents(e);
      const t = rg.getBoundingClientRect();
      if (t.width && (t.left < b.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft) - 1
          || t.right > b.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight) + 1)) texto.push(desc(e));
    }
  }
  // Os menus que abrem para baixo, abertos agora, cabem na altura.
  const embaixo = [...document.querySelectorAll("[data-menu-conversa], [data-menu-ordem], [data-menu-responsaveis]")]
    .filter(visivel).map((m) => ({ m, r: m.getBoundingClientRect() })).filter(({ r }) => r.bottom > H + 1)
    .map(({ m, r }) => `${desc(m)} até ${Math.round(r.bottom)}`);
  return { W, H, conteudo: Math.max(de.scrollWidth, document.body.scrollWidth), janela: innerWidth,
           fora: fora.slice(0, 5), texto: [...new Set(texto)].slice(0, 5), embaixo };
}

// Um caso por estado e largura. Contados antes, para um erro de digitação na
// lista não terminar verde sem ter medido nada.
const CASOS = ESTADOS.flatMap(([nome, abrir, larguras, aparece]) => larguras.map(([w, h]) => ({ nome, abrir, w, h, aparece })));
ok(`são ${CASOS.length} casos, de ${ESTADOS.length} estados`, ESTADOS.length >= 30 && CASOS.length > ESTADOS.length);

for (const { nome, abrir, w, h, aparece } of CASOS) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${nome} (${w}): ${e.message}`));
  page.on("popup", (p) => p.close().catch(() => {}));
  await page.route("**/ponte-de-mentira/**", (rota) => {
    const caminho = new URL(rota.request().url()).pathname.replace("/ponte-de-mentira", "");
    const corpo = caminho === "/copiloto/estado"
      ? { ligado: true, modelo: "x", resumo: true, ajustar: true, aprende: true, melhorar: true, ouvir: true }
      : caminho === "/scripts/estado" ? { situacao: "em_dia", frase: "Em dia", aplicados: [], versao: {} }
      : { ok: true, clientes: [], opcoes: {} };
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
  });
  await page.addInitScript(() => { globalThis.__SOU_ADMIN = true; globalThis.__TEM_FUNCAO_PAINEL = true; });
  let abriu;
  if (abrir.tela) {
    await page.goto(`${ENDERECO}?tela=${abrir.tela}`);
    abriu = await page.waitForSelector(`[data-tela="${abrir.tela}"]`, { timeout: 20000 }).then(() => true, () => false);
    await page.waitForTimeout(2000);
  } else {
    await page.goto(ENDERECO);
    await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1000);
    abriu = (await abrir(page)) !== false;
  }
  // O que abriu está À VISTA (o gatilho existir não basta: um menu que não
  // abre passaria por "nada sai da tela").
  if (abriu && aparece) abriu = await page.locator(aparece).first().isVisible().catch(() => false);
  const m = await page.evaluate(medir);
  ok(`(${w}) ${nome}: abre`, abriu);
  ok(`(${w}) ${nome}: a página não rola de lado`, m.conteudo <= m.W + 1 && m.janela <= m.W + 1,
     `o conteúdo tem ${m.conteudo} e a janela ${m.janela} numa tela de ${m.W}`);
  ok(`(${w}) ${nome}: nada sai da tela`, m.fora.length === 0, m.fora.join(" | "));
  ok(`(${w}) ${nome}: nenhum texto sai do botão`, m.texto.length === 0, m.texto.join(" | "));
  ok(`(${w}) ${nome}: o menu aberto cabe na altura`, m.embaixo.length === 0, m.embaixo.join(" | "));
  await ctx.close();
}

ok("sem erro de JavaScript", erros.length === 0, erros.slice(0, 3).join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
