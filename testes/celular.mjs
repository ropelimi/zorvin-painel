// O ZORVIN NO CELULAR — 390 pontos de largura, que é o iPhone da equipe.
//
// Todas as outras provas rodam em 1360×900, que é um monitor. Nenhuma nunca
// olhou para o telão de 390 pontos onde metade do escritório atende — e foi de
// lá que veio o relato: o cabeçalho da conversa mostrava "KAIO…" e "(11) 96…",
// com o nome do contato cortado em quatro letras. Cinco botões de ícone, o
// avatar e a seta de voltar tomavam trezentos dos trezentos e noventa pontos,
// e o que sobrava para dizer COM QUEM SE ESTÁ FALANDO eram noventa.
//
// Esta prova mede em pixels, e não de olho. Ela existe para que a próxima
// coisa acrescentada ao cabeçalho reprove aqui em vez de reprovar no celular
// de alguém, no meio do expediente.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

// O aparelho de referência. 390×844 é o iPhone 13/14/15 em pé — o mais comum
// no escritório. Quem tiver um menor (o SE tem 375) fica pior, então medir
// aqui é medir o caso otimista.
const LARGURA = 390, ALTURA = 844;

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({
  viewport: { width: LARGURA, height: ALTURA },
  // `hasTouch` muda o que o React vê: sem ele, o painel roda no celular
  // achando que tem um rato, e os menus que abrem no toque não são
  // exercitados.
  hasTouch: true, isMobile: true, deviceScaleFactor: 3,
});
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

/** A tela não pode rolar para o lado. Nunca, em tela nenhuma.
 *
 *  Rolagem horizontal no celular é o defeito que ninguém relata e todo mundo
 *  sente: o dedo desliza para cima e a tela anda de lado, o texto some pela
 *  direita, e a pessoa acha que "travou". */
async function naoRolaDeLado(onde) {
  const m = await page.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    tela: window.innerWidth,
  }));
  ok(`${onde}: não rola para o lado`, m.conteudo <= m.tela + 1,
     `o conteúdo tem ${m.conteudo}px numa tela de ${m.tela}px`);
}

/** TUDO O QUE SE TOCA TEM DE TER 40 PONTOS.
 *
 *  A varredura desta prova é o que fez a lista: a 390 pontos havia dezenas de
 *  alvos com 27, 30, 32 e 36 — as pílulas de filtro, as abas das
 *  Configurações, os campos dos Departamentos, o X que fecha cada painel. No
 *  monitor a diferença some; no aparelho é a diferença entre acertar e abrir
 *  outra coisa. */
async function dedosCabem(onde) {
  const pequenos = await page.evaluate(() => {
    const vistos = new Set(), fora = [];
    for (const el of document.querySelectorAll('button, [role="button"], select, input, textarea')) {
      if (el.type === "file" || el.type === "checkbox" || el.type === "radio") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;          // escondido
      if (el.closest("[data-compacto]")) continue;             // exceção declarada
      if (r.height >= 40 && r.width >= 40) continue;
      const nome = (el.getAttribute("aria-label") || el.getAttribute("title")
        || el.getAttribute("placeholder") || (el.innerText || "").trim().split("\n")[0]
        || el.tagName).slice(0, 40);
      const chave = `${nome}|${Math.round(r.width)}x${Math.round(r.height)}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      fora.push(chave.replace("|", " "));
    }
    return fora;
  });
  ok(`${onde}: tudo o que se toca tem 40px`, pequenos.length === 0,
     pequenos.slice(0, 6).join(" · ") + (pequenos.length > 6 ? ` (+${pequenos.length - 6})` : ""));
}

/** NENHUM CAMPO PODE TER LETRA MENOR QUE 16 PIXELS.
 *
 *  Não é gosto: é o corte em que o Safari do iPhone decide dar zoom na página
 *  inteira ao focar o campo — e não desfaz ao sair dele. Foi o relato de
 *  19/08: "ao clicar no campo de texto ele está expandindo a tela, ficando
 *  desproporcional". A caixa de escrever tinha 14,5.
 *
 *  Um número, e não uma olhada: o próximo campo criado com 14px reprova aqui
 *  em vez de reprovar no celular de alguém. */
async function semZoomAoTocar(onde) {
  const pequenos = await page.evaluate(() => {
    const fora = [], vistos = new Set();
    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (["file", "checkbox", "radio", "hidden"].includes(el.type)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const tamanho = parseFloat(getComputedStyle(el).fontSize);
      if (tamanho >= 16) continue;
      const nome = (el.getAttribute("aria-label") || el.getAttribute("placeholder")
        || el.getAttribute("title") || el.tagName).slice(0, 40);
      const chave = `${nome} ${tamanho}px`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      fora.push(chave);
    }
    return fora;
  });
  ok(`${onde}: tocar num campo não dá zoom na tela`, pequenos.length === 0,
     pequenos.slice(0, 6).join(" · ") + (pequenos.length > 6 ? ` (+${pequenos.length - 6})` : ""));
}

/** Mede um elemento: largura, e se o texto dele está cortado. */
async function medir(seletor) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      largura: Math.round(r.width), altura: Math.round(r.height),
      esquerda: Math.round(r.left), direita: Math.round(r.right),
      cortado: el.scrollWidth > el.clientWidth + 1,
      texto: (el.innerText || "").trim(),
    };
  }, seletor);
}

console.log("\nA lista de conversas");
{
  await naoRolaDeLado("lista");
  await dedosCabem("lista");
  await semZoomAoTocar("lista");
  const nome = await medir("[data-conversa-nome] div");
  ok("a lista abre com conversas", await page.locator("[data-conversa-nome]").count() > 0);
  ok("e a conversa aberta é que manda na tela",
     await page.locator("textarea, [contenteditable]").count() === 0,
     "no celular a lista e a conversa não dividem a tela — é uma OU outra");
  if (nome) ok("o nome na lista tem espaço", nome.largura >= 150, `tinha ${nome.largura}px`);
}

console.log("\nO cabeçalho da conversa — o do relato");
{
  // A conversa com o nome mais comprido da bancada. É o caso que interessa:
  // "PRISCILA DE JESUS FRANCO" é do mesmo tamanho de "KAIO BONILHA SILVA",
  // que foi o do relato.
  const alvo = page.locator("[data-conversa-nome]").filter({ hasText: "PRISCILA" }).first();
  await (await alvo.count() ? alvo : page.locator("[data-conversa-nome]").first()).click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(700);

  await naoRolaDeLado("conversa");
  await dedosCabem("conversa");
  await semZoomAoTocar("conversa");

  const nome = await medir("[data-nome-do-contato]");
  ok("o nome do contato aparece", !!nome && nome.largura > 0);

  // O NÚMERO QUE IMPORTA. Com 90px cabem quatro letras e as reticências —
  // "KAIO…". Um nome de verdade ("Priscila de Jesus Franco") precisa de
  // duzentos e poucos para ser lido; 190 é o piso abaixo do qual o cabeçalho
  // deixa de responder à pergunta que ele existe para responder.
  ok("com largura de sobra para um nome inteiro",
     nome && nome.largura >= 190,
     nome ? `tinha ${nome.largura}px e dizia "${nome.texto}"` : "não achei o nome");

  ok("e o nome não sai cortado",
     nome && !nome.cortado,
     nome ? `"${nome.texto}" está cortado dentro de ${nome.largura}px` : "");

  // O TELEFONE, logo abaixo. É o que se lê para conferir ou ditar; cortado em
  // "(11) 96…" não serve para nada.
  const fone = await page.evaluate(() => {
    const topo = document.querySelector("[data-topo-conversa]");
    if (!topo) return null;
    const alvo = [...topo.querySelectorAll("div")]
      .find((d) => /^\(\d{2}\)/.test((d.innerText || "").trim()));
    if (!alvo) return null;
    return { texto: alvo.innerText.trim(), cortado: alvo.scrollWidth > alvo.clientWidth + 1 };
  });
  ok("o telefone do contato aparece inteiro",
     fone && !fone.cortado && !/…/.test(fone.texto),
     fone ? `dizia "${fone.texto}"` : "não achei o telefone no cabeçalho");
}

console.log("\nOs botões do cabeçalho dão para acertar com o dedo");
{
  // 40px é o piso. A recomendação da Apple é 44 e a do Google, 48; abaixo de
  // 40 o dedo erra, e errar aqui abre a conversa errada ou fecha o que se
  // estava lendo.
  const botoes = await page.evaluate(() => {
    const topo = document.querySelector("[data-topo-conversa]");
    if (!topo) return [];
    return [...topo.querySelectorAll("button")].map((b) => {
      const r = b.getBoundingClientRect();
      return { nome: b.getAttribute("aria-label") || b.getAttribute("title") || "(sem nome)",
               largura: Math.round(r.width), altura: Math.round(r.height) };
    }).filter((b) => b.largura > 0);
  });
  ok("o cabeçalho tem botões", botoes.length > 0);
  const pequenos = botoes.filter((b) => b.largura < 40 || b.altura < 40);
  ok("todos com pelo menos 40×40",
     pequenos.length === 0,
     pequenos.map((b) => `${b.nome} ${b.largura}×${b.altura}`).join(", "));

  // E NÃO PODEM SER MUITOS. Cada ícone no cabeçalho come do nome. Quatro é o
  // teto: voltar, mais dois e o menu.
  ok("e são poucos — o resto mora no menu",
     botoes.length <= 4,
     `são ${botoes.length}: ${botoes.map((b) => b.nome).join(", ")}`);
}

console.log("\nO menu do cabeçalho guarda o que saiu de vista");
{
  const menu = page.getByRole("button", { name: "Mais opções desta conversa" });
  ok("existe um menu no cabeçalho", await menu.count() === 1);
  if (await menu.count()) {
    await menu.first().click();
    await page.waitForTimeout(400);
    const texto = (await page.locator("[data-menu-conversa]").innerText().catch(() => "")).replace(/\s+/g, " ");
    // AS PALAVRAS ESCRITAS, e não só o ícone. Quem abre um menu está
    // procurando alguma coisa pelo nome dela.
    for (const item of ["Ficha no Vantoro", "Histórico de atendimento", "Etiquetas",
                        "Quem participou"]) {
      ok(`o menu tem "${item}"`, texto.includes(item), `o menu dizia: "${texto}"`);
    }
    await naoRolaDeLado("menu aberto");
    await dedosCabem("menu aberto");

    // AS LINHAS DO MENU TÊM DE ABRIR ALGUMA COISA. Uma lista bonita cujos
    // itens não fazem nada é pior do que não ter lista: quem toca conclui que
    // o sistema travou.
    const linhas = await page.evaluate(() => {
      const m = document.querySelector("[data-menu-conversa]");
      return [...m.querySelectorAll("button")].map((b) => {
        const r = b.getBoundingClientRect();
        return { texto: b.innerText.trim().split("\n")[0], altura: Math.round(r.height) };
      });
    });
    const baixas = linhas.filter((l) => l.altura < 40);
    ok("cada linha do menu tem 40px de altura",
       baixas.length === 0, baixas.map((l) => `${l.texto} ${l.altura}px`).join(", "));

    // ETIQUETAS abre a lista de etiquetas — e ela pende do ⋮, e não do botão
    // que sumiu do cabeçalho. Se o cálculo do lugar tiver ficado para trás,
    // ela aparece fora da tela.
    await page.locator("[data-menu-conversa] button").filter({ hasText: "Etiquetas" }).first().click();
    await page.waitForTimeout(400);
    const etiquetas = await page.evaluate(() => {
      const el = [...document.querySelectorAll("div")]
        .find((d) => /MARCAR TAGS/.test(d.innerText || "") && d.getBoundingClientRect().width < 320);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { esquerda: Math.round(r.left), direita: Math.round(r.right), largura: Math.round(r.width) };
    });
    ok("\"Etiquetas\" abre a lista de etiquetas", !!etiquetas);
    ok("e ela cabe dentro da tela",
       etiquetas && etiquetas.esquerda >= 0 && etiquetas.direita <= 390,
       etiquetas ? `de ${etiquetas.esquerda}px a ${etiquetas.direita}px` : "");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // QUEM PARTICIPOU — a listinha que no celular nunca existiu.
    await menu.first().click();
    await page.waitForTimeout(350);
    await page.locator("[data-menu-conversa] button").filter({ hasText: "Quem participou" }).first().click();
    await page.waitForTimeout(400);
    const participantes = await page.locator("[data-participante]").count();
    ok("\"Quem participou\" abre a lista de quem escreveu", participantes > 0,
       "no celular esta lista nunca existiu — a fileirinha de rostos era escondida");
    await naoRolaDeLado("lista de participantes");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // FICHA NO VANTORO — no celular ela cobre a tela inteira.
    await menu.first().click();
    await page.waitForTimeout(350);
    await page.locator("[data-menu-conversa] button").filter({ hasText: "Ficha no Vantoro" }).first().click();
    await page.waitForTimeout(900);
    const corpo = await page.locator("body").innerText();
    ok("\"Ficha no Vantoro\" abre a ficha", /Ficha|Vantoro|cadastro/i.test(corpo));
    await naoRolaDeLado("ficha");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
}

console.log("\nA barra de escrever");
{
  // O CAMPO DO RELATO. É onde a equipe passa o dia, e era o mais gritante:
  // 14,5px, quase dois pontos abaixo do corte.
  const letraDaCaixa = await page.evaluate(() => {
    const t = document.querySelector("textarea");
    return t ? parseFloat(getComputedStyle(t).fontSize) : null;
  });
  ok("a caixa de escrever tem letra de 16px",
     letraDaCaixa !== null && letraDaCaixa >= 16, `tinha ${letraDaCaixa}px`);
  await naoRolaDeLado("conversa com o menu fechado");
  const barra = await page.evaluate(() => {
    const t = document.querySelector("textarea, [contenteditable]");
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { largura: Math.round(r.width), altura: Math.round(r.height) };
  });
  ok("dá para escrever", !!barra);
  ok("e o campo tem largura de sobra", barra && barra.largura >= 150,
     barra ? `tinha ${barra.largura}px` : "");
}

console.log("\nA prévia de um áudio, no celular, vem por extenso");
{
  // No WhatsApp Web a lista mostra só "🎤 0:20", porque a coluna é estreita.
  // No celular a linha é a largura da tela e cabe escrito — e escrito é melhor
  // para quem não decora o que um microfone quer dizer.
  const conversa = await page.evaluate(() => {
    const el = document.querySelector("[data-conversa-nome]");
    return el ? el.getAttribute("data-conversa-id") : null;
  });
  await page.evaluate((id) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "audio-no-celular", conversa_id: id, tipo: "audio", origem: "contato",
      texto: null, midia_url: "http://x/a.mp3", midia_segundos: 20,
      criado_em: new Date().toISOString(),
    });
    globalThis.__EMITIR("UPDATE", "conversas", {
      id, ultima_mensagem: "[anexo]", ultima_atividade: new Date().toISOString(), nao_lidas: 1,
    });
  }, conversa);
  await page.waitForTimeout(700);
  const texto = await page.evaluate(() => {
    const linha = document.querySelector("[data-conversa-nome]");
    const alvo = [...linha.querySelectorAll("span")]
      .find((s) => getComputedStyle(s).fontSize === "13px");
    return alvo ? alvo.innerText.trim() : null;
  });
  ok("no celular o rótulo vem escrito", /mensagem de voz/i.test(texto || ""),
     `dizia: "${texto}"`);
  ok("e com o tempo entre parênteses", /\(0:20\)/.test(texto || ""),
     `dizia: "${texto}"`);
}

console.log("\nO navegador sabe que o Zorvin está no escuro");
{
  // O RELATO, COM FOTO: no iPhone, ao tocar na caixa de escrever, aparece uma
  // faixa BRANCA em cima do teclado, e bordas brancas embaixo. Num app todo
  // escuro, salta aos olhos.
  //
  // A faixa é do iPhone e NÃO dá para tirar de dentro de uma página — o
  // aplicativo do WhatsApp consegue porque é um aplicativo de verdade. O que
  // dá é ela não ser branca: o Safari desenha as coisas dele na cor clara
  // enquanto a página não disser que está no escuro, e o Zorvin nunca dizia.
  async function comOTema(qual) {
    await page.evaluate((m) => localStorage.setItem("zorvin_modo", m), qual);
    await page.reload();
    await page.waitForSelector("[data-conversa-nome]");
    await page.waitForTimeout(600);
    return page.evaluate(() => ({
      esquema: getComputedStyle(document.documentElement).colorScheme,
      fundoDoHtml: getComputedStyle(document.documentElement).backgroundColor,
      fundoDoBody: getComputedStyle(document.body).backgroundColor,
      barraDoNavegador: (document.querySelector('meta[name="theme-color"]') || {})
        .getAttribute?.("content") || null,
    }));
  }

  /** Uma cor é clara? Serve para dizer "isto vai aparecer branco no escuro".
   *
   *  Aceita as duas formas, e não é capricho: o navegador devolve os fundos
   *  calculados como "rgb(…)", e a etiqueta do tema guarda o que foi escrito,
   *  que é "#202c33". Ler só uma delas dava a mesma resposta para as duas
   *  cores — foi assim que esta conferência reprovou uma correção que estava
   *  certa. */
  const ehClara = (cor) => {
    const t = String(cor || "").trim();
    let r, g, b;
    const hex = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
      [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    } else {
      const n = t.match(/[\d.]+/g);
      if (!n || n.length < 3) return true;           // transparente conta como claro
      if (n.length > 3 && Number(n[3]) === 0) return true;
      [r, g, b] = n.slice(0, 3).map(Number);
    }
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  const escuro = await comOTema("escuro");
  ok("no tema escuro, a página se declara escura", escuro.esquema === "dark",
     `dizia "${escuro.esquema}" — é isto que faz o Safari desenhar a barra do teclado no escuro`);
  ok("e o papel embaixo de tudo não é claro", !ehClara(escuro.fundoDoHtml),
     `o html estava ${escuro.fundoDoHtml} — é esta a "borda branca" que aparece quando a tela balança`);
  ok("nem o do corpo da página", !ehClara(escuro.fundoDoBody), `o body estava ${escuro.fundoDoBody}`);
  ok("e a barra do navegador acompanha", !!escuro.barraDoNavegador && !ehClara(escuro.barraDoNavegador),
     `dizia ${escuro.barraDoNavegador}`);

  // E NO CLARO TEM DE VOLTAR. Uma correção que deixa o tema claro escuro é
  // meio conserto: metade do escritório usa cada um.
  const claro = await comOTema("claro");
  ok("no tema claro, a página se declara clara", claro.esquema === "light",
     `dizia "${claro.esquema}"`);
  ok("e o papel embaixo volta a ser claro", ehClara(claro.fundoDoHtml),
     `o html estava ${claro.fundoDoHtml}`);
  ok("com a barra do navegador junto", !!claro.barraDoNavegador && ehClara(claro.barraDoNavegador),
     `dizia ${claro.barraDoNavegador}`);
}

console.log("\nAs telas de dentro, uma a uma");
{
  // Cada painel que abre por cima. No celular todos eles têm de caber em 390
  // pontos — e é justamente onde ninguém olha, porque quem programa olha no
  // monitor.
  async function abrirPeloMenuDoTopo(nome) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const m = page.getByRole("button", { name: "Menu" });
    if (!await m.count()) return false;
    await m.first().click();
    await page.waitForTimeout(300);
    const b = page.getByRole("button", { name: nome });
    if (!await b.count()) { await page.keyboard.press("Escape"); return false; }
    await b.first().click();
    await page.waitForTimeout(800);
    return true;
  }

  for (const tela of ["Painel", "Departamentos e acessos", "Configurações"]) {
    const abriu = await abrirPeloMenuDoTopo(tela);
    ok(`${tela}: abre no celular`, abriu);
    if (abriu) { await naoRolaDeLado(tela); await dedosCabem(tela); await semZoomAoTocar(tela); }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const nova = page.getByRole("button", { name: "Nova conversa" });
  if (await nova.count()) {
    await nova.first().click();
    await page.waitForTimeout(700);
    await naoRolaDeLado("nova conversa");
    await dedosCabem("nova conversa");
    await semZoomAoTocar("nova conversa");
    await page.keyboard.press("Escape");
  }
}

console.log("\n\"Juntar duas conversas\" não existe mais");
{
  // Tirada a pedido de quem administra: ninguém nunca usou, e ela apagava uma
  // conversa inteira em duas escolhas de menu. Quando duas conversas
  // precisarem virar uma, isso se resolve no banco, com quem sabe o que está
  // fazendo — e não num botão que qualquer pessoa alcança sem querer.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const m = page.getByRole("button", { name: "Menu" });
  if (await m.count()) {
    await m.first().click();
    await page.waitForTimeout(400);
    const corpo = await page.locator("body").innerText();
    ok("o menu do topo não oferece mais juntar conversas",
       !/Juntar duas conversas/i.test(corpo));
    await page.keyboard.press("Escape");
  }
}

// ==================================================================
//  A HORA DA MENSAGEM NÃO PODE FICAR DEBAIXO DA SETA DO MENU
// ==================================================================
//
// Relato do escritório, com a tela do celular: "está cortando parte do horário
// do envio". Medido: a seta cobria 43px de uma hora que tem 46. Nove décimos
// dela, invisíveis.
//
// A seta do menu da mensagem é desenhada POR CIMA do texto, no canto de cima à
// direita, com um degradê na cor da bolha atrás. No computador isso é bom:
// reservar espaço para ela o tempo todo engordava toda bolha curta por causa de
// um botão que só aparece ao passar o mouse.
//
// SÓ QUE NO CELULAR NÃO HÁ MOUSE, e por isso ela fica SEMPRE visível. Deixa de
// ser um botão que aparece e vira um pedaço permanente da bolha — e numa bolha
// de duas linhas (nome de quem escreveu em cima, texto curto embaixo) o corpo
// dela alcança a linha de baixo e apaga a hora com o próprio degradê.
//
// O que é permanente ocupa espaço: no celular a bolha abre uma coluna à direita
// do tamanho da seta.
{
  console.log("\nA hora não fica debaixo da seta do menu");
  // ABRE UMA CONVERSA ANTES. Esta seção mora no fim do arquivo, e a essa altura
  // as anteriores já voltaram para a lista — sem bolha na tela não há o que
  // medir, e a conferência de "há o que medir" foi justamente quem avisou.
  if (!(await page.locator("[data-msg-id]").count())) {
    await page.locator("[data-conversa-nome]").first().click();
    await page.waitForTimeout(2500);
  }
  const r = await page.evaluate(() => {
    const cruza = (a, b) => !(a.right <= b.left || a.left >= b.right
                           || a.bottom <= b.top || a.top >= b.bottom);
    let comSeta = 0, tapadas = 0, pior = 0;
    for (const bolha of document.querySelectorAll("[data-msg-id]")) {
      const seta = bolha.querySelector('button[aria-label="Opções da mensagem"]');
      if (!seta || getComputedStyle(seta).opacity === "0") continue;
      for (const meta of bolha.querySelectorAll("span")) {
        if (getComputedStyle(meta).float !== "right") continue;
        comSeta += 1;
        const rm = meta.getBoundingClientRect();
        const rs = seta.getBoundingClientRect();
        if (cruza(rm, rs)) {
          tapadas += 1;
          pior = Math.max(pior, Math.round(Math.min(rm.right, rs.right) - Math.max(rm.left, rs.left)));
        }
      }
    }
    return { comSeta, tapadas, pior };
  });
  console.log(`     ${r.comSeta} horas em bolhas com a seta visível; ${r.tapadas} tapadas`);

  // A PRIMEIRA CONFERÊNCIA É QUE HÁ O QUE MEDIR. Sem uma bolha com seta na
  // tela, a segunda passaria sozinha e não provaria nada — que foi exatamente o
  // que aconteceu na primeira tentativa de reproduzir isto: as mensagens da
  // bancada não tinham `id_uazapi`, a seta nem era desenhada, e a medição dizia
  // "zero tapadas" com o defeito inteiro de pé.
  ok("há bolhas com a seta do menu visível, para haver o que medir", r.comSeta > 0,
     "sem seta na tela esta prova não mede nada");
  ok("e nenhuma hora fica debaixo dela", r.tapadas === 0,
     `${r.tapadas} de ${r.comSeta}, a pior com ${r.pior}px cobertos`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 5).forEach((e) => console.log("   • " + e.slice(0, 180)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
