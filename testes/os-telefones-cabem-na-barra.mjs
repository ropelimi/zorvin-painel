// OS TELEFONES DA BARRA LATERAL CABEM NA TELA (02/11).
//
// Pedido do Rodrigo, com a foto da barra: "Diminua esses ícones da lateral,
// para que fiquem todos à mostra sem precisar fazer a rolagem. São 8
// telefones do departamento Acordos e só estão aparecendo 6." Medido na foto
// (a tela dele é de 150%): a barra tem 585 pontos de altura, os círculos 42 e
// o vão 12 — 8 telefones pediam 436, e sobravam para eles uns 320.
//
// O que esta prova confere:
//
//   1. na altura da tela dele, com 8 telefones, todos aparecem inteiros e
//      PINTADOS (`elementFromPoint`), sem a lista rolar, e o círculo encolheu
//      só o necessário (menor que 42, nunca abaixo de 26, redondo, com o vão
//      encolhendo junto); os ícones de baixo e a foto cabem na tela; o selo do
//      primeiro telefone não é cortado; as iniciais acompanham o tamanho;
//   2. numa tela alta, nada muda: 42 e 12, como sempre foi;
//   3. a janela que encolhe encolhe os círculos na hora, sem recarregar;
//   4. a faixa vermelha de aviso no alto encolhe a barra, e os telefones
//      continuam cabendo;
//   5. a linha desativada (quem administra) e o traço entram na conta;
//   6. com telefone demais para caber nem no tamanho menor, a lista rola, e o
//      pé ESMAECE enquanto há telefone escondido embaixo; rolando até o fim,
//      o último aparece e o pé não cobre mais ninguém;
//   7. no celular, nada abaixo de 40 (o alvo de dedo), e os círculos redondos.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// OS TELEFONES DE ACORDOS. A bancada tem três no departamento 5 ("Acordos 1",
// "Acordos 2" e "Arquivo"); a semente põe os que faltam para chegar à conta
// pedida. Nomes que a ordem alfabética põe entre os de sempre.
const extras = (quantos) => Array.from({ length: quantos }, (_, i) => ({
  id: `bx${i + 1}`, nome: `Acordos ${i + 3}`, numero: `55119100${String(i + 1).padStart(5, "0")}`,
  foto_url: null, departamento_id: 5, ativo: true,
}));
// Não lidas no primeiro telefone da lista ("Acordos 1") e num do meio: é o
// selo do PRIMEIRO que a lista podia cortar no alto.
const CONVERSAS = [
  { id: "barra-c1", advogado_id: "a7", contato_id: "barra-ct1", nao_lidas: 2, ultima_atividade: new Date().toISOString() },
  { id: "barra-c2", advogado_id: "bx3", contato_id: "barra-ct2", nao_lidas: 1, ultima_atividade: new Date().toISOString() },
];

const nav = await abrirNavegador();

async function abrir({ largura = 1280, altura = 585, quantosExtras = 5, desativado = false, saude = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const advogados = extras(quantosExtras);
  if (desativado) advogados.push({ id: "bx-desligado", nome: "Acordos antigo", numero: "5511910099999",
                                   foto_url: null, departamento_id: 5, ativo: false });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = { advogados: d.advogados, conversas: d.conversas };
    globalThis.__SOU_ADMIN = true;
    globalThis.__SAUDE = d.saude;
    try { localStorage.setItem("zorvin_advogado", "a7"); } catch (_) { /* ignora */ }
  }, { advogados, conversas: CONVERSAS, saude });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-telefone]", { timeout: 20000 }).catch(() => {});
  const esperado = 3 + quantosExtras;
  for (let i = 0; i < 60; i++) {
    if ((await page.locator("[data-telefones-da-barra] [data-telefone]").count()) >= esperado) break;
    await page.waitForTimeout(100);
  }
  // Os ícones de baixo chegam com respostas do banco e da ponte.
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** A barra, medida: a lista, cada círculo e o que está PINTADO no meio dele. */
const medir = (page) => page.evaluate(() => {
  const lista = document.querySelector("[data-telefones-da-barra]");
  const barra = document.querySelector("[data-barra-lateral]");
  if (!lista || !barra) return null;
  const rl = lista.getBoundingClientRect();
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, top: b.top, bottom: b.bottom }; };
  const pintado = (el) => {
    const b = el.getBoundingClientRect();
    const alvo = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return Boolean(alvo && el.contains(alvo));
  };
  const circulos = [...lista.querySelectorAll("[data-telefone], [data-telefone-desativado]")].map((el) => ({
    nome: el.getAttribute("data-telefone") || el.getAttribute("data-telefone-desativado"),
    desativado: el.hasAttribute("data-telefone-desativado"),
    ...r(el),
    pintado: pintado(el),
    // O DESENHO DO CÍRCULO (a foto ou as iniciais), e não só o botão: um
    // desenho de 42 dentro de um botão de 34 passaria pelas medidas do botão.
    desenho: (() => { const d = el.querySelector("[data-avatar-inicial], img"); return d ? r(d) : null; })(),
    letra: (() => { const i = el.querySelector("[data-avatar-inicial]"); return i ? parseFloat(getComputedStyle(i).fontSize) : null; })(),
    iniciais: (() => { const i = el.querySelector("[data-avatar-inicial]"); return i ? i.getAttribute("data-avatar-inicial") : null; })(),
    selo: (() => {
      const s = el.querySelector("[data-selo-nao-lidas]");
      if (!s) return null;
      const b = s.getBoundingClientRect();
      const alvo = document.elementFromPoint(b.left + b.width / 2, b.top + 1.5);
      return { top: b.top, pintado: Boolean(alvo && s.contains(alvo)) };
    })(),
  }));
  const pe = lista.querySelector("[data-telefones-continuam]");
  const divisor = lista.querySelector("[data-linhas-desativadas]");
  const deBaixo = [...barra.querySelectorAll("[data-abrir-tarefas], [data-abrir-esperando], [aria-label='Mídias, documentos e links'], [data-controle-de-atendimento]")]
    .map((el) => ({ qual: el.getAttribute("aria-label") || el.getAttribute("title") || el.tagName, ...r(el), pintado: pintado(el) }));
  const foto = [...barra.querySelectorAll("[role='button']")].find((el) => /configura/i.test(el.getAttribute("title") || ""));
  return {
    lista: { top: rl.top, bottom: rl.bottom, rola: lista.scrollHeight > lista.clientHeight + 1,
             scrollHeight: lista.scrollHeight, clientHeight: lista.clientHeight },
    barra: r(barra),
    circulos,
    pe: pe ? { ...r(pe), position: getComputedStyle(pe).position, fundo: getComputedStyle(pe).backgroundImage } : null,
    divisor: divisor ? r(divisor) : null,
    deBaixo,
    foto: foto ? { ...r(foto), pintado: pintado(foto) } : null,
    alturaDaJanela: innerHeight,
  };
});

const redondo = (c) => Math.abs(c.w - c.h) <= 1;
const vaos = (cs) => cs.slice(1).map((c, i) => c.top - cs[i].bottom);
const arred = (n) => Math.round(n * 10) / 10;

// ------------------------------------------------------------------
console.log("\n1. Na altura da tela do Rodrigo (585), os 8 telefones de Acordos cabem sem rolar");
{
  const { ctx, page, estouros } = await abrir({ altura: 585 });
  const m = await medir(page);
  ok("a barra desenhou", Boolean(m));
  const cs = m ? m.circulos : [];
  ok("são 8 telefones na barra", cs.length === 8, `${cs.length}: ${cs.map((c) => c.nome).join(", ")}`);
  ok("a lista NÃO rola", Boolean(m) && !m.lista.rola, m ? `${m.lista.scrollHeight} de conteúdo em ${m.lista.clientHeight}` : "");
  ok("todos inteiros dentro da lista",
     cs.length === 8 && cs.every((c) => c.top >= m.lista.top - 0.5 && c.bottom <= m.lista.bottom + 0.5),
     cs.map((c) => `${c.nome}: ${arred(c.top)}–${arred(c.bottom)}`).join("; ") + ` (lista ${m && arred(m.lista.top)}–${m && arred(m.lista.bottom)})`);
  ok("todos PINTADOS no meio (nada por cima)", cs.length === 8 && cs.every((c) => c.pintado),
     cs.filter((c) => !c.pintado).map((c) => c.nome).join(", "));
  const tam = cs.length ? cs[0].w : 0;
  console.log(`  (medido: círculo de ${arred(tam)} pontos, vão de ${arred(vaos(cs)[0] || 0)}, lista de ${m ? arred(m.lista.clientHeight) : "?"})`);
  ok("o círculo encolheu (menor que 42)", cs.length > 0 && tam < 41.5, `${arred(tam)}`);
  ok("e só o necessário: não abaixo de 26, nem de 30 nesta altura", tam >= 30, `${arred(tam)}`);
  ok("todos do mesmo tamanho, e redondos",
     cs.length === 8 && cs.every((c) => Math.abs(c.w - tam) <= 0.5 && redondo(c)),
     cs.map((c) => `${arred(c.w)}×${arred(c.h)}`).join(" "));
  ok("o desenho de cada círculo (as iniciais ou a foto) tem o tamanho do botão",
     cs.length === 8 && cs.every((c) => c.desenho && Math.abs(c.desenho.w - c.w) <= 0.5 && Math.abs(c.desenho.h - c.h) <= 0.5),
     cs.map((c) => (c.desenho ? `${arred(c.desenho.w)}×${arred(c.desenho.h)}` : "sem desenho")).join(" "));
  const vs = vaos(cs);
  ok("o vão encolheu junto (12 para 42, a mesma proporção), e ninguém encosta em ninguém",
     vs.length === 7 && vs.every((v) => v > 0 && Math.abs(v - tam * 12 / 42) <= 1),
     vs.map(arred).join(" "));
  ok("o pé que esmaece não cobre telefone nenhum (tudo coube)",
     Boolean(m && m.pe) && cs.length === 8 && m.pe.top >= cs[cs.length - 1].bottom - 0.5,
     m && m.pe ? `pé em ${arred(m.pe.top)}, último termina em ${arred(cs[cs.length - 1].bottom)}` : "sem o pé");
  const selo = cs[0] && cs[0].selo;
  ok("o primeiro telefone tem o selo de não lidas", Boolean(selo), cs[0] ? cs[0].nome : "");
  ok("e o selo dele não é cortado no alto da lista (pintado na borda de cima)",
     Boolean(selo) && selo.pintado && selo.top >= m.lista.top - 0.5, selo ? `selo em ${arred(selo.top)}, lista em ${arred(m.lista.top)}` : "");
  const comLetra = cs.find((c) => c.letra);
  ok("as iniciais acompanham o tamanho do círculo",
     Boolean(comLetra) && Math.abs(comLetra.letra - comLetra.w * (comLetra.iniciais.length > 1 ? 0.36 : 0.42)) <= 0.6,
     comLetra ? `letra ${arred(comLetra.letra)} num círculo de ${arred(comLetra.w)}` : "sem iniciais");
  ok("os ícones de baixo estão inteiros na tela e pintados",
     Boolean(m) && m.deBaixo.length >= 2 && m.deBaixo.every((i) => i.bottom <= m.alturaDaJanela + 0.5 && i.pintado),
     m ? m.deBaixo.map((i) => `${i.qual}: ${arred(i.top)}–${arred(i.bottom)}${i.pintado ? "" : " (coberto)"}`).join("; ") : "");
  ok("os ícones de baixo têm 36 no computador",
     Boolean(m) && m.deBaixo.length >= 2 && m.deBaixo.every((i) => Math.abs(i.w - 36) <= 0.5 && Math.abs(i.h - 36) <= 0.5),
     m ? m.deBaixo.map((i) => `${arred(i.w)}×${arred(i.h)}`).join(" ") : "");
  ok("a foto de quem entrou está inteira no pé da tela",
     Boolean(m && m.foto) && m.foto.bottom <= m.alturaDaJanela + 0.5 && m.foto.pintado,
     m && m.foto ? `${arred(m.foto.top)}–${arred(m.foto.bottom)} numa janela de ${m.alturaDaJanela}` : "sem a foto");
  // O CLIQUE CONTINUA LEVANDO AO TELEFONE: o círculo menor é o mesmo botão.
  // O clique vai no PONTO onde o último círculo está desenhado, com o mouse,
  // e não por `locator.click()`, que rola a lista até o botão antes de clicar
  // — e a pergunta é justamente se dá para escolhê-lo sem rolar.
  const ultimo = cs[cs.length - 1];
  if (ultimo) await page.mouse.click(ultimo.x + ultimo.w / 2, ultimo.y + ultimo.h / 2);
  await page.waitForTimeout(500);
  const depois = await page.evaluate((nome) => {
    const lista = document.querySelector("[data-telefones-da-barra]");
    const b = [...document.querySelectorAll("[data-telefones-da-barra] [data-telefone]")].find((el) => el.getAttribute("data-telefone") === nome);
    return { anel: b ? getComputedStyle(b).boxShadow : "", rolou: lista ? lista.scrollTop : -1 };
  }, ultimo ? ultimo.nome : "");
  ok("o último telefone se escolhe com um clique onde ele está desenhado (ganha o anel)",
     Boolean(ultimo) && /rgb/.test(depois.anel) && depois.anel !== "none", `${ultimo && ultimo.nome}: ${depois.anel}`);
  ok("e a lista não rolou para isso", depois.rolou === 0, `rolou ${depois.rolou}`);
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Numa tela alta, nada muda: 42 e 12, como sempre foi");
{
  const { ctx, page } = await abrir({ largura: 1360, altura: 900, quantosExtras: 0 });
  const m = await medir(page);
  const cs = m ? m.circulos : [];
  ok("são os 3 telefones de Acordos da bancada", cs.length === 3, `${cs.length}`);
  ok("o círculo tem os 42 de sempre", cs.length === 3 && cs.every((c) => Math.abs(c.w - 42) <= 0.5 && redondo(c)),
     cs.map((c) => arred(c.w)).join(" "));
  ok("e o vão os 12 de sempre", vaos(cs).length === 2 && vaos(cs).every((v) => Math.abs(v - 12) <= 0.5), vaos(cs).map(arred).join(" "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. A janela que encolhe encolhe os círculos na hora");
{
  const { ctx, page } = await abrir({ largura: 1360, altura: 900 });
  const alta = await medir(page);
  ok("com 900 de altura, os 8 têm os 42 de sempre",
     Boolean(alta) && alta.circulos.length === 8 && alta.circulos.every((c) => Math.abs(c.w - 42) <= 0.5),
     alta ? alta.circulos.map((c) => arred(c.w)).join(" ") : "");
  await page.setViewportSize({ width: 1360, height: 585 });
  await page.waitForTimeout(400);
  const baixa = await medir(page);
  ok("encolhida para 585, eles encolhem sem recarregar a página",
     Boolean(baixa) && baixa.circulos.length === 8 && baixa.circulos[0].w < 41.5, baixa ? `${arred(baixa.circulos[0].w)}` : "");
  ok("e continuam cabendo, sem rolar", Boolean(baixa) && !baixa.lista.rola,
     baixa ? `${baixa.lista.scrollHeight} em ${baixa.lista.clientHeight}` : "");
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. A faixa vermelha no alto encolhe a barra, e os telefones continuam cabendo");
{
  const desde = new Date(Date.now() - 9 * 60000).toISOString();
  const { ctx, page } = await abrir({ altura: 585, saude: [{ sinal: "fila_parada", quantas: 12, desde, detalhe: null }] });
  await page.waitForSelector("[data-aviso-de-saude]", { timeout: 8000 }).catch(() => {});
  const m = await medir(page);
  // Conta antes de medir: `boundingBox()` de quem não existe espera 30 segundos.
  const faixa = (await page.locator("[data-aviso-de-saude]").count())
    ? await page.locator("[data-aviso-de-saude]").first().boundingBox().catch(() => null)
    : null;
  ok("a faixa vermelha está no alto", Boolean(faixa) && faixa.height > 0, faixa ? `${arred(faixa.height)} de altura` : "sem faixa");
  ok("a barra começa depois dela", Boolean(m && faixa) && m.barra.top >= faixa.y + faixa.height - 0.5,
     m && faixa ? `barra em ${arred(m.barra.top)}, faixa termina em ${arred(faixa.y + faixa.height)}` : "");
  const cs = m ? m.circulos : [];
  ok("os 8 continuam cabendo, sem rolar", cs.length === 8 && !m.lista.rola && cs.every((c) => c.pintado && c.bottom <= m.lista.bottom + 0.5),
     m ? `${m.lista.scrollHeight} em ${m.lista.clientHeight}` : "");
  console.log(`  (medido com a faixa: círculo de ${cs[0] ? arred(cs[0].w) : "?"} pontos)`);
  ok("e ficaram um pouco menores do que sem a faixa", cs.length === 8 && cs[0].w >= 26 && cs[0].w < 34, cs[0] ? `${arred(cs[0].w)}` : "");
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. A linha desativada (quem administra) e o traço entram na conta");
{
  const { ctx, page } = await abrir({ altura: 585, desativado: true });
  const m = await medir(page);
  const cs = m ? m.circulos : [];
  ok("são 8 telefones e a linha desativada", cs.length === 9 && cs.filter((c) => c.desativado).length === 1,
     cs.map((c) => c.nome + (c.desativado ? " (desativada)" : "")).join(", "));
  ok("o traço está entre os telefones e a desativada",
     Boolean(m && m.divisor) && cs.length === 9 && m.divisor.top >= cs[7].bottom && m.divisor.bottom <= cs[8].top,
     m && m.divisor ? `traço em ${arred(m.divisor.top)}` : "sem traço");
  ok("tudo cabe, sem rolar, e tudo pintado", cs.length === 9 && !m.lista.rola && cs.every((c) => c.pintado),
     m ? `${m.lista.scrollHeight} em ${m.lista.clientHeight}` : "");
  ok("a desativada tem o tamanho dos outros", cs.length === 9 && Math.abs(cs[8].w - cs[0].w) <= 0.5 && redondo(cs[8]),
     cs.length === 9 ? `${arred(cs[8].w)} e ${arred(cs[0].w)}` : "");
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. Telefone demais para caber: a lista rola, e o pé esmaece enquanto há telefone escondido");
{
  const { ctx, page } = await abrir({ altura: 585, quantosExtras: 13 });
  const m = await medir(page);
  const cs = m ? m.circulos : [];
  ok("são 16 telefones", cs.length === 16, `${cs.length}`);
  ok("o círculo parou no menor tamanho, 26", cs.length === 16 && cs.every((c) => Math.abs(c.w - 26) <= 0.5), cs[0] ? `${arred(cs[0].w)}` : "");
  ok("a lista rola", Boolean(m) && m.lista.rola, m ? `${m.lista.scrollHeight} em ${m.lista.clientHeight}` : "");
  ok("o pé que esmaece é um degradê que gruda no pé da lista",
     Boolean(m && m.pe) && m.pe.position === "sticky" && /gradient/.test(m.pe.fundo), m && m.pe ? `${m.pe.position} ${m.pe.fundo}` : "");
  ok("e ele está grudado no pé da parte que se vê",
     Boolean(m && m.pe) && Math.abs(m.pe.bottom - m.lista.bottom) <= 1, m && m.pe ? `pé termina em ${arred(m.pe.bottom)}, lista em ${arred(m.lista.bottom)}` : "");
  const cobre = (pe, c) => c.bottom > pe.top + 0.5 && c.top < pe.bottom - 0.5;
  ok("esmaecendo o último telefone que aparece (há mais embaixo)",
     Boolean(m && m.pe) && cs.some((c) => cobre(m.pe, c)), m && m.pe ? `pé ${arred(m.pe.top)}–${arred(m.pe.bottom)}` : "");
  // ROLANDO ATÉ O FIM.
  // GUARDADO: sem a lista (o painel de antes não tem a marca), a cena tem de
  // reprovar pelas conferências, e não estourar a prova inteira aqui.
  await page.evaluate(() => { const l = document.querySelector("[data-telefones-da-barra]"); if (l) l.scrollTop = l.scrollHeight; });
  await page.waitForTimeout(300);
  const fim = await medir(page);
  const ultimo = fim ? fim.circulos[fim.circulos.length - 1] : null;
  ok("rolando até o fim, o último aparece inteiro e pintado",
     Boolean(ultimo) && ultimo.pintado && ultimo.bottom <= fim.lista.bottom + 0.5, ultimo ? `${ultimo.nome}: ${arred(ultimo.top)}–${arred(ultimo.bottom)}` : "");
  ok("e o pé não cobre mais ninguém", Boolean(fim && fim.pe) && !fim.circulos.some((c) => cobre(fim.pe, c)),
     fim && fim.pe ? `pé ${arred(fim.pe.top)}–${arred(fim.pe.bottom)}` : "");
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. No celular, nada abaixo de 40 (o alvo de dedo), e os círculos redondos");
{
  // OITO TELEFONES CABEM COM 42 NUM CELULAR ALTO, e aí o piso não decide
  // nada. Com 16, a conta pediria uns 27 — é onde o piso do celular tem de
  // valer, e a barra rolar.
  const { ctx, page } = await abrir({ largura: 390, altura: 844, quantosExtras: 13 });
  const m = await medir(page);
  const cs = m ? m.circulos : [];
  ok("a barra aparece no celular com os 16 telefones", cs.length === 16, `${cs.length}`);
  ok("nenhum círculo abaixo de 40, e todos redondos (o botão do celular tem 40 de altura)",
     cs.length === 16 && cs.every((c) => c.w >= 39.5 && redondo(c)), cs.map((c) => `${arred(c.w)}×${arred(c.h)}`).join(" "));
  ok("e a barra rola, como sempre rolou no celular", Boolean(m) && m.lista.rola,
     m ? `${m.lista.scrollHeight} em ${m.lista.clientHeight}` : "");
  ok("os ícones de baixo continuam com 40",
     Boolean(m) && m.deBaixo.length >= 2 && m.deBaixo.every((i) => i.w >= 39.5 && i.h >= 39.5),
     m ? m.deBaixo.map((i) => `${arred(i.w)}×${arred(i.h)}`).join(" ") : "");
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
