// A REVISÃO DO LEIAUTE (05/11).
//
// Pedido do Rodrigo: *"Faça uma revisão geral do layout, para que o visual
// seja agradável para o usuário, de forma responsiva. Veja se nada está
// quebrado, se está tudo alinhado e em harmonia, o sistema precisa ser
// funcional, ser fácil de entender as informações e prático para o trabalho
// no dia a dia."*
//
// Uma varredura abriu os estados do Zorvin em seis larguras e nos dois temas,
// e mediu o que costuma quebrar sem ninguém ver. Nada rolava de lado nem saía
// da tela, nenhum texto era cortado sem reticências e todo alvo de dedo tinha
// o tamanho do dedo. O que estava errado era a LEITURA: a letra miúda da tela
// inteira (o número, a hora, a prévia) ficava abaixo do contraste que se pede
// para ela, e os botões verdes com letra branca também. Esta prova guarda o
// que a revisão consertou:
//
//   1. o contraste da letra (4,5:1; 3:1 na grande) nos estados de todo dia,
//      nos dois temas, no computador e no celular;
//   2. a cor do "esperando há N dias" é uma só, na lista e na tela Esperando
//      resposta, e se lê no fundo da conversa escolhida;
//   3. a busca do computador não corta a frase no meio da palavra;
//   4. a caixa de escrever, numa conversa estreita e no celular pequeno,
//      nasce com uma linha;
//   5. nada rola de lado nem sai da tela, a 360 e a 768.
//
// A conta do contraste é a da WCAG (luminância relativa), e o fundo de cada
// texto é o do primeiro ancestral com fundo sólido. O controle desligado fica
// de fora (a WCAG o dispensa), e o que está atrás de uma janela aberta também.
import { abrirNavegador, ENDERECO, abrirATela } from "./navegador.mjs";

let feitas = 0, falhas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (x) => JSON.stringify(x);
const CENAS = (process.env.CENAS || "").split(",").map((c) => c.trim()).filter(Boolean);
const TODAS = ["1", "2", "3", "4", "5", "6"];
const vale = (cena) => !CENAS.length || CENAS.includes(cena);

const nav = await abrirNavegador();

// UMA CONVERSA MINHA ESPERANDO HÁ 5 DIAS, para a tela Esperando resposta ter
// o que mostrar na aba das suas conversas (a bancada não tem nenhuma).
const DIA = 24 * 3600e3;
const MINHA_HA_5_DIAS = {
  id: "rev-minha-5", advogado_id: "a1", contato_id: "rev-minha-5-ct", nao_lidas: 0, arquivada: false,
  fixada: false, favorita: false, ultima_atividade: new Date(Date.now() - 5 * DIA).toISOString(),
  esperando_desde: new Date(Date.now() - 5 * DIA).toISOString(), ultima_mensagem: "Preciso de uma resposta",
  frente: null, vantoro_nome: null, digitando_ate: null, responsavel_id: "u1", responsavel_em: null,
  responsavel_por: null, situacao: "aberto", protocolo: null,
  contato: { nome: "CLIENTE DA REVISÃO", numero: "5511987650001", foto_url: null },
};

/** Abre o Zorvin (ou uma tela) num contexto novo, no tema pedido. */
async function abrir({ largura = 1366, altura = 768, escuro = false, tela = null, semente = null, linha = null,
                       bandeiras = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message.slice(0, 160)));
  await page.addInitScript(({ t, semente, bandeiras }) => {
    globalThis.__SOU_ADMIN = true; globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEMENTE = semente || undefined;
    for (const [k, v] of Object.entries(bandeiras || {})) globalThis[k] = v;
    try { localStorage.setItem("zorvin_modo", t); } catch (_) { /* sem armazenamento */ }
  }, { t: escuro ? "escuro" : "claro", semente, bandeiras });
  if (tela) {
    await abrirATela(page, tela, { linha });
    await page.waitForTimeout(2500);
  } else {
    await page.goto(ENDERECO);
    await page.waitForSelector("[data-conversa-nome]", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  return { ctx, page, estouros };
}

/** Clica, se existir, e espera a tela assentar. Guardado: o que falta não
 *  estoura a prova, e a conferência seguinte diz o que não apareceu. */
async function clicar(page, sel) {
  const el = page.locator(sel).first();
  if (!(await el.count())) return false;
  await el.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  return true;
}
async function doMenu(page, texto) {
  if (!(await clicar(page, '[aria-label="Menu"]'))) return false;
  const item = page.getByRole("button", { name: texto }).first();
  if (!(await item.count())) return false;
  await item.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return true;
}

/** Os textos com contraste abaixo do pedido, na camada de cima da tela. */
function semContraste() {
  const W = innerWidth, H = innerHeight;
  const rgba = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const fundoDe = (e) => {
    for (let p = e; p; p = p.parentElement) {
      const c = rgba(getComputedStyle(p).backgroundColor);
      if (c && c.a > 0.9) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const visivel = (e) => {
    const s = getComputedStyle(e);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.95) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  };
  // A CAMADA DE CIMA: uma janela que cobre a maior parte da tela.
  let camada = null;
  for (let p = document.elementFromPoint(W / 2, H / 2); p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p), r = p.getBoundingClientRect();
    if ((s.position === "fixed" || s.position === "absolute") && r.width >= W * 0.6 && r.height >= H * 0.6) camada = p;
  }
  const ruins = [];
  for (const e of document.querySelectorAll("body *")) {
    if (camada && !camada.contains(e)) continue;
    if (!visivel(e)) continue;
    if (e.closest("[disabled], [aria-disabled='true'], [aria-hidden='true']")) continue;
    // a opacidade de um ancestral também apaga a letra
    let opaco = true;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      if (Number(getComputedStyle(p).opacity) < 0.95) { opaco = false; break; }
    }
    if (!opaco) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e);
    const cor = rgba(s.color);
    if (!cor || cor.a < 0.5) continue;
    const l1 = lum(cor), l2 = lum(fundoDe(e));
    const razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const grande = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && Number(s.fontWeight) >= 700);
    if (razao < (grande ? 3 : 4.5)) {
      const texto = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim().replace(/\s+/g, " ");
      ruins.push(`«${texto.slice(0, 40)}» ${razao.toFixed(2)}:1`);
    }
  }
  return [...new Set(ruins)];
}

const rolaDeLado = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

// ==================================================================
if (vale("1")) {
  console.log("\n1. A letra se lê: o contraste nos estados de todo dia, nos dois temas");
  const ESTADOS = [
    { nome: "a lista", abrir: async () => true },
    { nome: "a conversa aberta (a que espera há 3+ dias, escolhida)", abrir: async (page) => clicar(page, '[data-conversa-id]:has([data-espera="3"])') },
    { nome: "o menu ⋮ do alto", abrir: async (page) => clicar(page, '[aria-label="Menu"]') },
    { nome: "as Configurações", abrir: async (page) => doMenu(page, "Configurações") },
    { nome: "Departamentos e acessos", abrir: async (page) => doMenu(page, "Departamentos e acessos") },
    { nome: "a tela do Funil", tela: "funil" },
    { nome: "a tela de Tarefas", tela: "tarefas" },
    { nome: "a tela Esperando resposta", tela: "esperando" },
    { nome: "a tela da Faxina", tela: "faxina" },
    { nome: "a tela do Painel", tela: "painel" },
  ];
  for (const [largura, altura] of [[1366, 768], [390, 844]]) {
    for (const escuro of [false, true]) {
      for (const e of ESTADOS) {
        const { ctx, page, estouros } = await abrir({ largura, altura, escuro, tela: e.tela || null });
        const abriu = e.tela ? true : await e.abrir(page);
        const ruins = await page.evaluate(semContraste);
        ok(`${largura}, ${escuro ? "escuro" : "claro"}: ${e.nome} — ${abriu ? "nenhum texto abaixo do contraste" : "NÃO ABRIU"}`,
           abriu && ruins.length === 0 && estouros.length === 0, q({ ruins: ruins.slice(0, 6), estouros: estouros.slice(0, 2) }));
        await ctx.close();
      }
    }
  }
}

// ==================================================================
if (vale("2")) {
  console.log("\n2. A cor do “esperando há N dias” é uma só, e se lê na conversa escolhida");
  for (const escuro of [false, true]) {
    const tema = escuro ? "escuro" : "claro";
    const { ctx, page } = await abrir({ escuro });
    const naLista = await page.evaluate(() => {
      const el = document.querySelector('[data-espera="3"], [data-espera="4"], [data-espera="5"]');
      return el ? getComputedStyle(el).color : null;
    });
    ok(`${tema}: a lista tem uma conversa esperando há 3 dias ou mais`, Boolean(naLista), q(naLista));
    await clicar(page, '[data-conversa-id]:has([data-espera="3"])');
    const escolhida = await page.evaluate(semContraste);
    ok(`${tema}: com ela escolhida (o fundo cinza), o rótulo se lê`, !escolhida.some((t) => /esperando há/.test(t)), q(escolhida));
    await ctx.close();
    // A TELA ESPERANDO RESPOSTA, na aba das suas conversas: a mesma cor para
    // a mesma espera. Duas cores diriam que a espera é mais grave numa tela.
    const t = await abrir({ escuro, tela: "esperando", semente: { conversas: [MINHA_HA_5_DIAS] } });
    await clicar(t.page, '[role="tab"]:has-text("SUAS CONVERSAS")');
    const naTela = await t.page.evaluate(() => {
      for (const l of document.querySelectorAll("[data-atrasada-linha]")) {
        const d = l.querySelector("[data-detalhe-da-espera]");
        const m = d && (d.textContent || "").match(/há (\d+) dia/);
        if (m && Number(m[1]) >= 3) return getComputedStyle(d).color;
      }
      return null;
    });
    ok(`${tema}: o vermelho da tela Esperando resposta é o da lista`, naLista && naTela === naLista, `lista ${naLista} · tela ${naTela}`);
    await t.ctx.close();
  }
}

// ==================================================================
if (vale("3")) {
  console.log("\n3. A busca do computador diz a frase inteira, sem cortar no meio da palavra");
  for (const largura of [1366, 1920, 1024]) {
    const { ctx, page } = await abrir({ largura });
    const m = await page.evaluate(() => {
      const i = document.querySelector('input[aria-label="Buscar conversas"]');
      if (!i) return null;
      const s = getComputedStyle(i);
      const cv = document.createElement("canvas").getContext("2d");
      cv.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      return { frase: i.placeholder, pede: Math.ceil(cv.measureText(i.placeholder).width),
               tem: Math.floor(i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)),
               reticencias: s.textOverflow };
    });
    ok(`${largura}: a frase da busca cabe na caixa`, m && m.pede <= m.tem, q(m));
    ok(`${largura}: e, se uma letra mais larga a cortar, ela termina em reticências`, m && m.reticencias === "ellipsis", q(m));
    await ctx.close();
  }
}

// ==================================================================
if (vale("4")) {
  console.log("\n4. A caixa de escrever, numa conversa estreita, nasce com uma linha só");
  for (const [largura, altura] of [[768, 1024], [1024, 768], [1366, 768], [390, 844], [360, 780]]) {
    const { ctx, page } = await abrir({ largura, altura });
    await clicar(page, "[data-conversa-id]");
    const m = await page.evaluate(() => {
      const t = document.querySelector('textarea[data-campo="mensagem"]');
      if (!t) return null;
      const s = getComputedStyle(t);
      const cv = document.createElement("canvas").getContext("2d");
      cv.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const linha = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
      const conteudo = t.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
      return { frase: t.placeholder, pede: Math.ceil(cv.measureText(t.placeholder).width),
               tem: Math.floor(t.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)),
               linhas: Math.round(conteudo / linha),
               umaLinha: getComputedStyle(t, "::placeholder").whiteSpace };
    });
    ok(`${largura}: a frase da caixa cabe numa linha`, m && m.pede <= m.tem, q(m));
    ok(`${largura}: e a caixa tem a altura de uma linha`, m && m.linhas === 1, q(m));
    // O ENCOSTO: com uma letra mais larga que a das provas, a frase é cortada
    // na borda, e não quebra a caixa em duas linhas.
    ok(`${largura}: e a frase não quebra de linha, nem com uma letra mais larga`, m && m.umaLinha === "nowrap", q(m));
    await ctx.close();
  }
}

// ==================================================================
if (vale("5")) {
  console.log("\n5. Nada rola de lado nem sai da tela, a 360 e a 768");
  const ESTADOS = [
    { nome: "a lista", abrir: async () => true },
    { nome: "a conversa aberta", abrir: async (page) => clicar(page, "[data-conversa-id]") },
    { nome: "as Configurações", abrir: async (page) => doMenu(page, "Configurações") },
    { nome: "Departamentos e acessos", abrir: async (page) => doMenu(page, "Departamentos e acessos") },
    { nome: "a tela Esperando resposta", tela: "esperando" },
    { nome: "a tela do Painel", tela: "painel" },
  ];
  for (const [largura, altura] of [[360, 780], [768, 1024]]) {
    for (const e of ESTADOS) {
      const { ctx, page, estouros } = await abrir({ largura, altura, tela: e.tela || null });
      if (!e.tela) await e.abrir(page);
      const lado = await rolaDeLado(page);
      ok(`${largura}: ${e.nome} — nada rola de lado`, !lado && estouros.length === 0, q({ lado, estouros: estouros.slice(0, 2) }));
      await ctx.close();
    }
  }
}

// ==================================================================
if (vale("6")) {
  console.log("\n6. A letra se lê também nos avisos: a espera no funil, as tarefas, os selos e a janela do Finalizar");
  // OS ESTADOS QUE A BANCADA NÃO TEM SOZINHA, plantados aqui: as cores de
  // aviso (o vermelho e o âmbar) só aparecem com alguém esperando, com tarefa
  // vencendo e com selo contando — e é nelas que a letra ficava clara demais.
  const HORA = 3600e3, agora = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const LINHA_A1 = "a1";   // o telefone a1 da bancada, do departamento 1 (a guia leva o id, e não o número)
  const contato = (k, n) => ({ id: `rev-ct-${k}`, numero: `55119876500${n}`, nome: `CLIENTE REVISÃO ${k.toUpperCase()}`,
                               vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
  const conversa = (k, n, { dias = 0, parado = 0, naoLidas = 0, adv = "a1" } = {}) => ({
    id: `rev-cv-${k}`, advogado_id: adv, contato_id: `rev-ct-${k}`, nao_lidas: naoLidas, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: iso(agora - Math.max(dias, parado) * DIA - 60e3),
    esperando_desde: dias ? iso(agora - dias * DIA) : null, ultima_mensagem: "Aguardo o retorno",
    frente: null, vantoro_nome: null, digitando_ate: null, responsavel_id: "u1", responsavel_em: null,
    responsavel_por: null, situacao: "aberto", protocolo: null,
    contato: { id: `rev-ct-${k}`, nome: `CLIENTE REVISÃO ${k.toUpperCase()}`, numero: `55119876500${n}`, foto_url: null },
  });
  const cartao = (k) => ({ id: `rev-cartao-${k}`, contato_id: `rev-ct-${k}`, departamento_id: 1, etapa_id: "et-1-1",
                           criado_em: iso(agora - 6 * DIA), movido_em: iso(agora - 6 * DIA), movido_por: "u1" });
  const tarefa = (k, conv, venceEm) => ({ id: `rev-tf-${k}`, conversa_id: conv, texto: `Ligar para o cliente (${k})`,
                                          vence_em: iso(venceEm), para_quem: "u1", criada_por: "u1",
                                          criada_em: iso(agora - DIA), feita_em: null, feita_por: null });
  const SEMENTE = {
    contatos: [contato("um", "11"), contato("cinco", "15"), contato("parada", "21"), contato("outra", "31")],
    conversas: [
      conversa("um", "11", { dias: 1 }), conversa("cinco", "15", { dias: 5, naoLidas: 2 }),
      // a parada há 40 dias, com o cliente esperando: o primeiro grupo da faxina
      conversa("parada", "21", { dias: 40 }),
      // uma conversa com mensagem por ler noutro telefone: o selo dele na barra
      conversa("outra", "31", { naoLidas: 3, adv: "a2" }),
    ],
    zorvin_cartoes: [cartao("um"), cartao("cinco")],
    zorvin_tarefas: [tarefa("atrasada", "rev-cv-cinco", agora - 2 * HORA), tarefa("hoje", "rev-cv-um", agora + 90e3)],
  };
  const SEM_RESPOSTA = [{ conversa_id: "rev-cv-um", advogado_id: "a1", departamento_id: 1, protocolo: "P-REV",
                          aberto_em: iso(agora - 70 * 60e3), responsavel_id: null, minutos: 65, limite: 30,
                          contato: { nome: "CLIENTE REVISÃO UM", numero: "5511987650011" } }];
  const ESTADOS = [
    { nome: "a tela de Tarefas, com uma atrasada e uma para hoje", tela: "tarefas",
      prova: (p) => p.locator("[data-tela='tarefas']").innerText().then((t) => /atrasadas/i.test(t) && /hoje/i.test(t)) },
    { nome: "a tela do Funil, com cartões esperando há 1 e há 5 dias", tela: "funil", linha: LINHA_A1,
      prova: (p) => p.locator("[data-espera-no-cartao]").count().then((n) => n >= 2) },
    { nome: "a tela Esperando resposta, com as duas abas contando", tela: "esperando",
      prova: (p) => p.locator("[data-tela='esperando'] [role='tab']").allInnerTexts()
        .then((t) => t.length === 2 && t.every((x) => /\d/.test(x))) },
    { nome: "a aba das suas conversas, na tela Esperando resposta", tela: "esperando",
      antes: (p) => clicar(p, '[role="tab"]:has-text("SUAS CONVERSAS")'),
      prova: (p) => p.locator("[data-atrasada-linha]").count().then((n) => n >= 1) },
    { nome: "a tela da Faxina, com uma conversa parada", tela: "faxina",
      prova: (p) => p.locator("[data-faxina-parada]").count().then((n) => n >= 1) },
    { nome: "a lista, com o selo de mensagens por ler noutro telefone",
      prova: (p) => p.locator("[data-selo-nao-lidas]").count().then((n) => n >= 1) },
    // O SINO E A AMPULHETA DA BARRA EM ÂMBAR: sem tarefa atrasada e sem cliente
    // sem resposta, os dois selos contam em âmbar — e o número é de letra branca.
    { nome: "a barra, com o sino e a ampulheta em âmbar",
      semente: { ...SEMENTE, zorvin_tarefas: SEMENTE.zorvin_tarefas.filter((t) => t.id !== "rev-tf-atrasada") },
      bandeiras: { __SEM_RESPOSTA: [], __ESPERA_PRIMEIRA_MS: 300 },
      prova: (p) => p.waitForSelector('[data-selo-esperando][data-sem-resposta="0"]', { timeout: 10000 })
        .then(() => p.locator('[data-selo-tarefas][data-atrasadas="0"]').count()).then((n) => n >= 1) },
    // O MENU ⋮ DO ALTO repete os dois números, escritos na cor deles.
    { nome: "o menu ⋮ do alto, com as tarefas e a espera em âmbar",
      semente: { ...SEMENTE, zorvin_tarefas: SEMENTE.zorvin_tarefas.filter((t) => t.id !== "rev-tf-atrasada") },
      bandeiras: { __SEM_RESPOSTA: [], __ESPERA_PRIMEIRA_MS: 300 },
      antes: async (p) => {
        await p.waitForSelector('[data-selo-esperando][data-sem-resposta="0"]', { timeout: 10000 }).catch(() => {});
        await clicar(p, '[aria-label="Menu"]');
      },
      prova: (p) => Promise.all([p.locator("[data-abrir-tarefas-menu]").innerText({ timeout: 4000 }),
                                 p.locator("[data-abrir-esperando-menu]").innerText({ timeout: 4000 })])
        .then((t) => t.every((x) => /\d/.test(x))) },
    // A JANELA DO FINALIZAR de uma conversa que espera há 3 dias: ela escreve a
    // espera em vermelho, por cima do resto da tela. A 1920, onde o botão está
    // escrito no alto da conversa (a 1366, com a ficha aberta, ele vai para o ⋮).
    { nome: "a janela do Finalizar, de uma conversa esperando há 3 dias", largura: 1920, altura: 1080,
      antes: async (p) => {
        await clicar(p, '[data-conversa-id]:has([data-espera="3"])');
        const b = p.getByRole("button", { name: /^Finalizar/ }).first();
        if (await b.count()) { await b.click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(800); }
      },
      prova: (p) => p.locator("[data-ja-tratei-dias]").count().then((n) => n >= 1) },
  ];
  for (const escuro of [false, true]) {
    const tema = escuro ? "escuro" : "claro";
    for (const e of ESTADOS) {
      const { ctx, page, estouros } = await abrir({ escuro, largura: e.largura || 1366, altura: e.altura || 768,
                                                    tela: e.tela || null, linha: e.linha || null,
                                                    semente: e.semente || SEMENTE,
                                                    bandeiras: e.bandeiras || { __SEM_RESPOSTA: SEM_RESPOSTA } });
      if (e.antes) await e.antes(page);
      const viu = await e.prova(page).catch(() => false);
      const ruins = await page.evaluate(semContraste);
      ok(`${tema}: ${e.nome} — ${viu ? "nenhum texto abaixo do contraste" : "O ESTADO NÃO APARECEU"}`,
         viu && ruins.length === 0 && estouros.length === 0, q({ ruins: ruins.slice(0, 6), estouros: estouros.slice(0, 2) }));
      await ctx.close();
    }
  }
}

const pedidas = CENAS.filter((c) => !TODAS.includes(c));
ok("toda cena pedida em CENAS existe", pedidas.length === 0, q(pedidas));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
