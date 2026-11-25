// O CAMPO DE ESCREVER DO CELULAR, COMO O DO APLICATIVO DO WHATSAPP (24/11).
//
// Pedido do Rodrigo, com duas fotos do WhatsApp no iPhone: "Na versão mobile
// preciso que dentro da conversa, no campo de digitar mensagem, seja o mais
// parecido possível com o do aplicativo WhatsApp." E, logo depois: "Ele fica
// com um ícone de "+" e ao clicar nele aparecem opções para selecionar, e no
// lugar do teclado aparecem as mídias, e o ícone muda para um ícone de
// teclado, que aí clicar volta para o teclado e volta a ficar um "+"".
//
// O que esta prova confere, no celular:
//
//   1. a barra: [+] (texto … [figurinha]) [câmera] [microfone], nessa ordem,
//      o "+" e os dois da direita FORA da pílula, e a figurinha DENTRO;
//   2. com texto, a câmera e o microfone dão lugar ao botão verde e redondo
//      de enviar, e ele envia;
//   3. o "+" abre o painel no lugar do teclado e vira um teclado; o teclado
//      fecha o painel e devolve o foco ao campo; tocar no campo, o Esc, o
//      toque na conversa e a troca de conversa também fecham;
//   4. as opções: Fotos, Câmera e Documento abrem o seletor do aparelho no
//      lugar certo; a Nota interna sobe a nota; Agendar, Respostas rápidas e
//      Sugerir resposta fazem o que dizem, e apagadas dizem por quê;
//   5. a figurinha abre o painel nas figurinhas;
//   6. o tema claro, e o celular de 320;
//   7. o computador, que não muda;
//   8. e a correção de uma mensagem: o "+" sai e o botão verde fica.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (x) => JSON.stringify(x);

const nav = await abrirNavegador();
const CAMPO = 'textarea[data-campo="mensagem"]';
const PILULA = '[data-pilula-de-escrever]';
const MAIS = "[data-mais]";
const PAINEL = "[data-painel-do-mais]";
const RAPIDAS = [
  { id: "r-celular-1", titulo: "Saudação", texto: "Bom dia! Como posso ajudar?", criado_em: "2026-10-01T12:00:00Z",
    midia_url: null, midia_tipo: null, midia_mime: null, midia_nome: null },
];
const pedidosAoQuazar = [];

// UMA MENSAGEM NOSSA, DENTRO DO PRAZO DE EDITAR (14 minutos), para a cena da
// edição (11): só ela usa esta semente.
const AGORA = Date.now();
const EDICAO = {
  contatos: [{ id: "ct-campo-ed", numero: "5511970008861", nome: "CAMPO EDICAO", vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-campo-ed", advogado_id: "a7", contato_id: "ct-campo-ed", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 3600e3).toISOString(), ultima_mensagem: "Mensagem com erro",
    frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-campo-ed", nome: "CAMPO EDICAO", numero: "5511970008861", foto_url: null } }],
  mensagens: [{ id: "m-campo-ed", conversa_id: "cv-campo-ed", origem: "advogado", tipo: "texto", texto: "Mensagem com erro",
    id_uazapi: "uz-m-campo-ed", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "enviada",
    criado_em: new Date(AGORA - 2 * 60e3).toISOString() }],
};

async function abrirPagina({ largura = 390, altura = 844, tema = "escuro", celular = true, rapidas = true, semente = {} } = {}) {
  const ctx = await nav.newContext({
    viewport: { width: largura, height: altura },
    ...(celular ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE: `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => {
    try { localStorage.setItem("zorvin_modo", b.tema); } catch (_) { /* sem armário */ }
    globalThis.__SEMENTE = { mensagens_rapidas: b.rapidas, ...b.semente };
  }, { tema, rapidas: rapidas ? RAPIDAS : [], semente });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(200, { ok: true, ligado: true, modelo: "claude-haiku-5-5" });
    if (url.pathname.endsWith("/copiloto/sugerir")) {
      pedidosAoQuazar.push(JSON.parse(rota.request().postData() || "{}"));
      return json(200, { ok: true, sugestao: "Recebi o seu comprovante, obrigado." });
    }
    // SEM VANTORO: a ficha no celular cobre a tela, e aqui ela só atrapalharia.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO, { timeout: 60000 });
  await page.waitForSelector("[data-conversa-nome]", { timeout: 30000 });
  await page.waitForTimeout(900);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
// `apagada`: o botão com aria-disabled. O Playwright espera um botão assim
// "ficar habilitado" e desiste; o dedo toca nele assim mesmo, e é esse toque
// que a tela responde dizendo por quê.
async function clicar(page, sel, { apagada = false } = {}) {
  const loc = typeof sel === "string" ? page.locator(sel) : sel;
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000, force: apagada }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
const conta = (page, sel) => page.locator(sel).count();
const valorDoCampo = (page) => page.locator(CAMPO).first().inputValue({ timeout: 2000 }).catch(() => "SEM CAMPO");
async function abrirConversa(page, n = 0) {
  const linhas = page.locator("[data-conversa-nome]");
  if ((await linhas.count()) <= n) return null;
  const id = await linhas.nth(n).getAttribute("data-conversa-id").catch(() => null);
  await linhas.nth(n).click();
  await page.waitForTimeout(900);
  return id;
}
async function escrever(page, texto) {
  if (!(await conta(page, CAMPO))) return false;
  await page.locator(CAMPO).first().fill(texto);
  await page.waitForTimeout(200);
  return true;
}
const campoComFoco = (page) => page.evaluate((sel) => document.activeElement === document.querySelector(sel), CAMPO);
/** O retângulo de cada peça da barra, e quem é pintado no meio dela. */
const pecas = (page) => page.evaluate(({ PILULA, MAIS }) => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const meio = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { x: Math.round(b.left), d: Math.round(b.right), y: Math.round(b.top), b: Math.round(b.bottom),
             l: Math.round(b.width), a: Math.round(b.height), pintado: Boolean(meio && (meio === el || el.contains(meio))) };
  };
  const pilula = document.querySelector(PILULA);
  const figurinha = pilula && pilula.querySelector('[title="Emojis e figurinhas"]');
  return {
    pilula: r(pilula), tipo: pilula ? pilula.getAttribute("data-pilula-de-escrever") : null,
    mais: r(document.querySelector(MAIS)),
    maisDentroDaPilula: Boolean(pilula && pilula.querySelector(MAIS)),
    campo: r(document.querySelector('textarea[data-campo="mensagem"]')),
    figurinha: r(figurinha),
    figurinhaDentro: Boolean(figurinha),
    camera: r(document.querySelector("[data-camera-celular]")),
    cameraDentro: Boolean(pilula && pilula.querySelector("[data-camera-celular]")),
    microfone: r([...document.querySelectorAll('button[title="Gravar áudio"]')].pop()),
    microfoneDentro: Boolean(pilula && pilula.querySelector('button[title="Gravar áudio"]')),
    enviar: r(document.querySelector("[data-enviar-celular]")),
    enviarFundo: document.querySelector("[data-enviar-celular]") ? getComputedStyle(document.querySelector("[data-enviar-celular]")).backgroundColor : null,
    enviarRaio: document.querySelector("[data-enviar-celular]") ? getComputedStyle(document.querySelector("[data-enviar-celular]")).borderRadius : null,
    nota: document.querySelectorAll("[data-nota-interna]").length,
    clipe: document.querySelectorAll("[data-anexar]").length,
    relogio: [...document.querySelectorAll("[data-agendar]")].filter((el) => !el.closest("[data-painel-do-mais]")).length,
    barraFundo: document.querySelector("[data-barra-de-escrever]") ? getComputedStyle(document.querySelector("[data-barra-de-escrever]")).backgroundColor : null,
    tela: document.documentElement.clientWidth, conteudo: document.documentElement.scrollWidth,
  };
}, { PILULA, MAIS });
const painelAberto = async (page) => (await conta(page, PAINEL)) > 0
  && await page.locator(PAINEL).first().isVisible().catch(() => false);
const fila = (page, id) => page.evaluate((cid) =>
  (globalThis.__TABELAS.fila_envio || []).filter((f) => String(f.conversa_id) === String(cid)), id);
const ultimoAviso = (page) => page.locator("[data-aviso]").first().innerText({ timeout: 1500 }).catch(() => "");

/** O seletor de arquivos que o toque abre, com o que ele pede. */
async function seletorQueAbre(page, sel) {
  const loc = page.locator(sel);
  if (!(await loc.count())) return null;
  try {
    const [escolha] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 4000 }),
      loc.first().click({ timeout: 3000 }),
    ]);
    const pede = await escolha.element().evaluate((el) => ({
      accept: el.accept, capture: el.getAttribute("capture"), multiple: el.multiple }));
    return { escolha, pede };
  } catch (_) { return null; }
}

// ==================================================================
console.log("\n1. A barra do celular, com a caixa vazia (390, escuro)");
{
  const { ctx, page, estouros } = await abrirPagina();
  ok("abri uma conversa", Boolean(await abrirConversa(page)));
  const p = await pecas(page);
  ok("a pílula é a do celular", p.tipo === "celular", q(p.tipo));
  ok("o “+” existe, pintado", Boolean(p.mais && p.mais.pintado), q(p.mais));
  ok("e FORA da pílula, à esquerda dela", p.mais && p.pilula && !p.maisDentroDaPilula && p.mais.d <= p.pilula.x + 1,
     q({ mais: p.mais, pilula: p.pilula }));
  ok("o “+” diz o que faz (aria-label)", /Anexar e mais opções/.test(await page.locator(MAIS).first().getAttribute("aria-label").catch(() => "") || ""));
  ok("a figurinha fica DENTRO da pílula", p.figurinhaDentro && p.figurinha && p.figurinha.pintado, q(p.figurinha));
  ok("à direita do texto", p.figurinha && p.campo && p.figurinha.x >= p.campo.d - 1, q({ campo: p.campo, figurinha: p.figurinha }));
  ok("a câmera fica FORA da pílula, à direita", p.camera && p.pilula && p.camera.pintado && !p.cameraDentro && p.camera.x >= p.pilula.d - 1, q(p.camera));
  ok("e o microfone depois dela, também fora", p.microfone && p.camera && p.microfone.pintado && !p.microfoneDentro && p.microfone.x >= p.camera.d - 1, q(p.microfone));
  ok("sem o botão de enviar com a caixa vazia", !p.enviar);
  ok("a nota interna, o clipe e o relógio saíram da barra", p.nota === 0 && p.clipe === 0 && p.relogio === 0, q({ nota: p.nota, clipe: p.clipe, relogio: p.relogio }));
  ok("tudo dentro da tela, sem rolar de lado", p.microfone && p.mais && p.microfone.d <= p.tela && p.mais.x >= 0 && p.conteudo <= p.tela + 1, q(p));
  ok("os botões de fora têm 40 pontos de alvo", [p.mais, p.camera, p.microfone].every((b) => b && b.l >= 40 && b.a >= 40) && [p.mais, p.camera, p.microfone].length === 3, q([p.mais, p.camera, p.microfone]));
  ok("a barra tem fundo próprio, como no aplicativo", p.barraFundo && !/rgba\(0, 0, 0, 0\)|transparent/.test(p.barraFundo), p.barraFundo);
  ok("o campo tem largura para escrever", p.campo && p.campo.l >= 150, q(p.campo));
  ok("e a letra de 16 (o iPhone não amplia a tela)",
     await page.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize) >= 16, CAMPO).catch(() => false));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));

  console.log("\n2. Com texto, o botão verde de enviar, que envia");
  const id = await page.locator("[data-conversa-nome]").first().getAttribute("data-conversa-id").catch(() => null);
  await page.locator(MAIS).first().waitFor({ timeout: 2000 }).catch(() => {});
  ok("escrevi", await escrever(page, "Mensagem do celular"));
  const t = await pecas(page);
  ok("a câmera e o microfone saem", !t.camera && !t.microfone, q({ camera: t.camera, microfone: t.microfone }));
  ok("e entra o botão de enviar, pintado, fora da pílula", t.enviar && t.pilula && t.enviar.pintado && t.enviar.x >= t.pilula.d - 1, q(t.enviar));
  ok("redondo", t.enviarRaio === "50%" || (t.enviar && Math.abs(t.enviar.l - t.enviar.a) <= 1 && parseFloat(t.enviarRaio) >= t.enviar.l / 2 - 1), t.enviarRaio);
  ok("e verde", /rgb\(0, 168, 132\)/.test(t.enviarFundo || ""), t.enviarFundo);
  ok("o “+” continua lá", Boolean(t.mais && t.mais.pintado));
  const antes = (await fila(page, id)).length;
  // COM O PAINEL DO "+" ABERTO: o botão de enviar atende, e o painel fecha.
  await clicar(page, MAIS);
  ok("abri o painel do “+”, com o texto na caixa", await painelAberto(page));
  ok("toquei em enviar", await clicar(page, "[data-enviar-celular]"));
  await page.waitForTimeout(600);
  ok("e o painel do “+” fechou", !(await painelAberto(page)));
  const depois = await fila(page, id);
  ok("a mensagem foi para a fila de envio", depois.length === antes + 1 && depois.some((f) => f.texto === "Mensagem do celular"),
     q(depois.map((f) => f.texto)));
  const v = await pecas(page);
  ok("e a barra volta à câmera e ao microfone", v.camera && v.microfone && !v.enviar, q({ camera: v.camera, enviar: v.enviar }));
  await ctx.close();
}

// ==================================================================
console.log("\n3. O “+” abre as opções no lugar do teclado, e vira um teclado");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page);
  await page.locator(CAMPO).first().focus().catch(() => {});
  ok("o campo estava com o foco (o teclado à vista)", await campoComFoco(page));
  ok("o painel começa fechado", !(await painelAberto(page)));
  // COMO NO SAFARI DO IPHONE: tocar num botão não tira o foco do campo (o
  // botão não ganha o foco), e o teclado ficaria por cima do painel. No
  // Chromium o botão ganha o foco sozinho, e a prova não veria o `blur()` do
  // "+" faltar. O `mousedown` sem a ação de sempre reproduz o Safari.
  await page.evaluate(() => document.addEventListener("mousedown", (e) => {
    if (e.target.closest && e.target.closest("[data-mais]")) e.preventDefault();
  }, true));
  ok("toquei no “+”", await clicar(page, MAIS));
  ok("o painel abriu", await painelAberto(page));
  const estado = await page.locator(MAIS).first().getAttribute("data-mais").catch(() => null);
  ok("e o “+” virou o teclado", estado === "aberto"
     && /Voltar ao teclado/.test(await page.locator(MAIS).first().getAttribute("aria-label").catch(() => "") || ""), estado);
  ok("e o desenho é o de um teclado", (await conta(page, `${MAIS} svg.lucide-keyboard`)) === 1 && (await conta(page, `${MAIS} svg.lucide-plus`)) === 0);
  ok("o campo perdeu o foco: o teclado do aparelho desce", !(await campoComFoco(page)));
  const lugar = await page.evaluate(() => {
    const barra = document.querySelector("[data-barra-de-escrever]").getBoundingClientRect();
    const painel = document.querySelector("[data-painel-do-mais]").getBoundingClientRect();
    return { barraFim: Math.round(barra.bottom), painelTopo: Math.round(painel.top), painelFim: Math.round(painel.bottom),
             painelEsq: Math.round(painel.left), painelDir: Math.round(painel.right), tela: innerHeight, largura: document.documentElement.clientWidth };
  }).catch(() => null);
  ok("embaixo da barra, onde fica o teclado", lugar && Math.abs(lugar.painelTopo - lugar.barraFim) <= 1, q(lugar));
  ok("e indo até o pé da tela, de ponta a ponta", lugar && Math.abs(lugar.painelFim - lugar.tela) <= 1
     && lugar.painelEsq <= 1 && lugar.painelDir >= lugar.largura - 1, q(lugar));
  const opcoes = await page.locator("[data-opcao-do-mais]").evaluateAll((els) => els.map((e) => e.getAttribute("data-opcao-do-mais")));
  const esperadas = ["fotos", "camera", "documento", "nota", "rapida", "agendar", "quazar"];
  ok("com as opções do Zorvin", esperadas.filter((o) => opcoes.includes(o)).length === 7, q(opcoes));
  ok("Fotos, Câmera e Documento primeiro, como no WhatsApp", opcoes.slice(0, 3).join() === "fotos,camera,documento", q(opcoes));
  const pintadas = await page.locator("[data-opcao-do-mais]").evaluateAll((els) => els.every((el) => {
    const b = el.getBoundingClientRect();
    const meio = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return b.right <= document.documentElement.clientWidth && b.left >= 0 && meio && (meio === el || el.contains(meio));
  })).catch(() => false);
  ok("todas pintadas, dentro da tela", pintadas);
  ok("toquei no teclado", await clicar(page, MAIS));
  ok("o painel fechou", !(await painelAberto(page)));
  ok("o teclado voltou a ser o “+”", (await page.locator(MAIS).first().getAttribute("data-mais").catch(() => null)) === "fechado"
     && (await conta(page, `${MAIS} svg.lucide-plus`)) === 1);
  ok("e o campo ganhou o foco: o teclado sobe", await campoComFoco(page));

  // TOCAR NO TEXTO FECHA O PAINEL, como no aplicativo.
  await clicar(page, MAIS);
  ok("abri de novo", await painelAberto(page));
  ok("toquei no campo", await clicar(page, CAMPO));
  ok("e o painel fechou", !(await painelAberto(page)));
  // O ESC.
  await clicar(page, MAIS);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("o Esc fecha o painel", !(await painelAberto(page)));
  ok("e não fecha a conversa junto", (await conta(page, CAMPO)) === 1);
  // O TOQUE NA CONVERSA.
  await clicar(page, MAIS);
  // GUARDADO: sem a barra (a conversa fechou), a cena reprova pelo nome em
  // vez de estourar.
  const meioDaConversa = await page.evaluate(() => {
    const barra = document.querySelector("[data-barra-de-escrever]");
    // NA BORDA ESQUERDA, onde só há o fundo da conversa: no meio, o toque
    // podia cair numa bolha e abrir a prévia de um PDF.
    return barra ? { x: 4, y: Math.round(barra.getBoundingClientRect().top - 60) } : null;
  }).catch(() => null);
  if (meioDaConversa) await page.mouse.click(meioDaConversa.x, meioDaConversa.y);
  await page.waitForTimeout(250);
  ok("o toque na conversa fecha o painel", !(await painelAberto(page)));
  // A VOLTA PARA A LISTA, sem nenhum toque fora do painel: o clique vai
  // direto ao botão (`element.click()` não passa pelo `mousedown`), e quem
  // tem de fechar o painel é a troca de conversa, e não o toque fora.
  await clicar(page, MAIS);
  ok("abri de novo", await painelAberto(page));
  await page.evaluate(() => document.querySelector('button[aria-label="Voltar"]')?.click());
  await page.waitForTimeout(500);
  ok("voltei para a lista", (await conta(page, CAMPO)) === 0);
  // A CONVERSA SEGUINTE TAMBÉM SEM TOQUE: o toque na linha já fecharia o
  // painel (é um toque fora dele), e a cena passaria sem medir a troca.
  await page.evaluate(() => document.querySelectorAll("[data-conversa-nome]")[1]?.click());
  await page.waitForTimeout(900);
  ok("e na conversa seguinte o painel não volta aberto", (await conta(page, CAMPO)) === 1 && !(await painelAberto(page)));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Fotos, Câmera e Documento abrem o seletor no lugar certo");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page);
  await clicar(page, MAIS);
  const fotos = await seletorQueAbre(page, '[data-opcao-do-mais="fotos"]');
  ok("Fotos abre o seletor", Boolean(fotos));
  ok("pedindo fotos e vídeos, várias de uma vez", fotos && fotos.pede.accept === "image/*,video/*" && fotos.pede.multiple, q(fotos?.pede));
  ok("sem a câmera", fotos && !fotos.pede.capture, q(fotos?.pede));
  ok("e o painel fecha", !(await painelAberto(page)));
  if (fotos) {
    await fotos.escolha.setFiles({ name: "foto-do-celular.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
    await page.waitForTimeout(700);
  }
  ok("a foto escolhida abre a prévia de sempre", (await conta(page, '[data-previa-anexo="mensagem"]')) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await clicar(page, MAIS);
  const camera = await seletorQueAbre(page, '[data-opcao-do-mais="camera"]');
  ok("Câmera abre a câmera (capture)", camera && camera.pede.capture === "environment" && camera.pede.accept === "image/*", q(camera?.pede));
  await clicar(page, MAIS);
  const doc = await seletorQueAbre(page, '[data-opcao-do-mais="documento"]');
  ok("Documento pede documentos, e não a galeria", doc && /\.pdf/.test(doc.pede.accept) && !/image\//.test(doc.pede.accept) && !doc.pede.capture, q(doc?.pede));
  // COM O PAINEL ABERTO, a câmera da barra também atende. O painel fechava no
  // `mousedown`, a barra descia debaixo do dedo, e o `click` caía noutro lugar.
  await clicar(page, MAIS);
  ok("o painel está aberto", await painelAberto(page));
  const daBarra = await seletorQueAbre(page, "[data-camera-celular]");
  ok("a câmera da barra também abre a câmera, com o painel aberto", daBarra && daBarra.pede.capture === "environment" && daBarra.pede.accept === "image/*", q(daBarra?.pede));
  ok("e o painel fecha", !(await painelAberto(page)));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. A nota interna sobe, com a pílula âmbar de sempre");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page);
  await clicar(page, MAIS);
  ok("toquei em Nota interna", await clicar(page, '[data-opcao-do-mais="nota"]'));
  ok("o campo da nota aparece", (await conta(page, 'textarea[data-campo="nota"]')) === 1);
  const p = await pecas(page);
  ok("com a pílula de sempre, e não a do WhatsApp", p.tipo === "computador", q(p.tipo));
  ok("e o botão da nota, para sair por ele", p.nota >= 1, q(p.nota));
  ok("embaixo, nem o “+” nem a câmera", !p.mais && !p.camera, q({ mais: p.mais, camera: p.camera }));
  ok("o painel do “+” fechou", !(await painelAberto(page)));
  ok("fechei a nota", await clicar(page, "[data-fechar-nota]"));
  const v = await pecas(page);
  ok("e a barra do WhatsApp voltou", v.tipo === "celular" && v.mais && v.camera, q(v.tipo));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. Agendar, Respostas rápidas e Sugerir resposta");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page);
  // AGENDAR SEM TEXTO: à vista, apagado, e diz por quê.
  await clicar(page, MAIS);
  const agendar = page.locator('[data-opcao-do-mais="agendar"]');
  ok("Agendar sem texto fica apagado", (await agendar.first().getAttribute("aria-disabled").catch(() => null)) === "true");
  await clicar(page, '[data-opcao-do-mais="agendar"]', { apagada: true });
  ok("e o toque diz por quê", /Escreva a mensagem/.test(await ultimoAviso(page)), await ultimoAviso(page));
  ok("sem abrir a janela da hora", (await conta(page, "[data-escolher-hora]")) === 0);
  // COM TEXTO.
  await escrever(page, "Lembrete do acordo");
  await clicar(page, MAIS);
  ok("com texto, Agendar fica aceso", (await agendar.first().getAttribute("aria-disabled").catch(() => "x")) === null);
  ok("toquei em Agendar", await clicar(page, '[data-opcao-do-mais="agendar"]'));
  const janela = await page.locator("[data-escolher-hora]").first().boundingBox().catch(() => null);
  ok("a janela da hora abre, inteira na tela", janela && janela.x >= 0 && janela.x + janela.width <= 390, q(janela));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  // AS RESPOSTAS RÁPIDAS E O QUAZAR COM TEXTO: apagados, e dizem por quê.
  await clicar(page, MAIS);
  const rapida = page.locator('[data-opcao-do-mais="rapida"]');
  ok("com texto, as Respostas rápidas ficam apagadas", (await rapida.first().getAttribute("aria-disabled").catch(() => null)) === "true");
  await clicar(page, '[data-opcao-do-mais="rapida"]', { apagada: true });
  ok("e o toque diz por quê, sem mexer no texto", /caixa vazia/.test(await ultimoAviso(page)) && (await valorDoCampo(page)) === "Lembrete do acordo",
     `${await ultimoAviso(page)} | ${await valorDoCampo(page)}`);
  await clicar(page, MAIS);
  const quazar = page.locator('[data-opcao-do-mais="quazar"]');
  ok("com texto, o Sugerir resposta fica apagado", (await quazar.first().getAttribute("aria-disabled").catch(() => null)) === "true");
  const pedidosAntes = pedidosAoQuazar.length;
  await clicar(page, '[data-opcao-do-mais="quazar"]', { apagada: true });
  await page.waitForTimeout(400);
  ok("e o toque não pede nada ao Quazar", pedidosAoQuazar.length === pedidosAntes, `${pedidosAoQuazar.length - pedidosAntes} pedidos`);
  ok("diz por quê", /caixa vazia/.test(await ultimoAviso(page)), await ultimoAviso(page));

  // COM A CAIXA VAZIA.
  await escrever(page, "");
  await clicar(page, MAIS);
  ok("vazia, as Respostas rápidas acendem", (await rapida.first().getAttribute("aria-disabled").catch(() => "x")) === null);
  ok("toquei em Respostas rápidas", await clicar(page, '[data-opcao-do-mais="rapida"]'));
  ok("o “/” entra na caixa", (await valorDoCampo(page)) === "/", await valorDoCampo(page));
  ok("o menu das rápidas abre", (await conta(page, '[data-rapida-no-menu="Saudação"]')) === 1);
  ok("e o campo fica com o foco (o teclado sobe para filtrar)", await campoComFoco(page));
  await escrever(page, "");
  await clicar(page, MAIS);
  ok("vazia, o Sugerir resposta acende", (await quazar.first().getAttribute("aria-disabled").catch(() => "x")) === null);
  ok("toquei em Sugerir resposta", await clicar(page, '[data-opcao-do-mais="quazar"]'));
  await page.waitForTimeout(900);
  ok("foi um pedido ao Quazar", pedidosAoQuazar.length === pedidosAntes + 1, `${pedidosAoQuazar.length - pedidosAntes} pedidos`);
  ok("e a sugestão entrou na caixa", /Recebi o seu comprovante/.test(await valorDoCampo(page)), await valorDoCampo(page));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n7. Sem respostas rápidas, a opção não aparece");
{
  const { ctx, page, estouros } = await abrirPagina({ rapidas: false });
  await abrirConversa(page);
  await clicar(page, MAIS);
  ok("sem rápidas cadastradas, sem a opção", (await conta(page, '[data-opcao-do-mais="rapida"]')) === 0);
  ok("e as outras continuam", (await conta(page, '[data-opcao-do-mais="fotos"]')) === 1);
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n8. A figurinha abre o painel nas figurinhas");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page);
  await clicar(page, MAIS);
  ok("com o painel do “+” aberto, toquei na figurinha", await clicar(page, `${PILULA} [title="Emojis e figurinhas"]`));
  ok("o painel do “+” fecha", !(await painelAberto(page)));
  const corpo = await page.locator("body").innerText();
  ok("o painel abre nas figurinhas", /FIGURINHAS FAVORITAS/.test(corpo));
  const caixa = await page.evaluate(() => {
    const t = [...document.querySelectorAll("span")].find((s) => s.textContent === "FIGURINHAS FAVORITAS");
    let el = t; while (el && getComputedStyle(el).position !== "absolute") el = el.parentElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { esq: Math.round(r.left), dir: Math.round(r.right), tela: document.documentElement.clientWidth };
  });
  ok("inteiro na tela", caixa && caixa.esq >= 0 && caixa.dir <= caixa.tela, q(caixa));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n9. O tema claro, e o celular de 320 e de 375");
{
  const { ctx, page, estouros } = await abrirPagina({ tema: "claro" });
  await abrirConversa(page);
  const p = await pecas(page);
  ok("(claro) a barra tem o fundo do alto da conversa", p.barraFundo === "rgb(240, 242, 245)", p.barraFundo);
  const pilula = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, PILULA).catch(() => null);
  ok("(claro) e a pílula é branca", pilula === "rgb(255, 255, 255)", pilula);
  await clicar(page, MAIS);
  const fundos = await page.evaluate(() => {
    const painel = document.querySelector("[data-painel-do-mais]");
    const botao = painel && painel.querySelector("[data-opcao-do-mais] span");
    return painel ? { painel: getComputedStyle(painel).backgroundColor, botao: botao && getComputedStyle(botao).backgroundColor } : null;
  });
  ok("(claro) o painel continua a barra, com os botões brancos", fundos && fundos.painel === "rgb(240, 242, 245)" && fundos.botao === "rgb(255, 255, 255)", q(fundos));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, estouros } = await abrirPagina({ largura: 320, altura: 640 });
  await abrirConversa(page);
  const p = await pecas(page);
  ok("(320) tudo dentro da tela, sem rolar de lado", p.mais && p.microfone && p.mais.x >= 0 && p.microfone.d <= 320 && p.conteudo <= 321, q(p));
  ok("(320) o campo ainda tem onde escrever", p.campo && p.campo.l >= 100, q(p.campo));
  const frase = await page.evaluate((s) => {
    const t = document.querySelector(s);
    const c = document.createElement("canvas").getContext("2d");
    const st = getComputedStyle(t);
    c.font = `${st.fontSize} ${st.fontFamily}`;
    return { precisa: Math.ceil(c.measureText(t.placeholder).width),
             tem: Math.floor(t.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)) };
  }, CAMPO).catch(() => null);
  ok("(320) a frase do campo cabe", frase && frase.precisa <= frase.tem, q(frase));
  await clicar(page, MAIS);
  const cabem = await page.locator("[data-opcao-do-mais]").evaluateAll((els) => els.every((el) => {
    const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= document.documentElement.clientWidth;
  })).catch(() => false);
  ok("(320) as opções do “+” cabem", cabem && (await conta(page, "[data-opcao-do-mais]")) >= 6);
  ok("(320) e a página não rola de lado com o painel aberto", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // A 375 (O IPHONE PEQUENO), "Digite uma mensagem" não cabe ao lado do "+",
  // da câmera e do microfone: vai a frase curta. A 390 a de sempre cabe, e a
  // prova `a-revisao-do-leiaute` confere.
  const { ctx, page, estouros } = await abrirPagina({ largura: 375, altura: 812 });
  await abrirConversa(page);
  const frase = await page.evaluate((s) => {
    const t = document.querySelector(s);
    const c = document.createElement("canvas").getContext("2d");
    const st = getComputedStyle(t);
    c.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    return { frase: t.placeholder, precisa: Math.ceil(c.measureText(t.placeholder).width),
             tem: Math.floor(t.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)) };
  }, CAMPO).catch(() => null);
  ok("(375) a frase do campo cabe", frase && frase.precisa <= frase.tem, q(frase));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n10. No computador, a barra de sempre");
{
  const { ctx, page, estouros } = await abrirPagina({ largura: 1360, altura: 900, celular: false });
  await abrirConversa(page);
  const p = await pecas(page);
  ok("a pílula é a do computador", p.tipo === "computador", q(p.tipo));
  ok("sem o “+” e sem a câmera", !p.mais && !p.camera, q({ mais: p.mais, camera: p.camera }));
  ok("a nota interna e o clipe continuam na barra", p.nota === 1 && p.clipe === 1, q({ nota: p.nota, clipe: p.clipe }));
  ok("o microfone continua dentro da pílula", p.microfoneDentro);
  const carinha = await page.evaluate((s) => {
    const pil = document.querySelector(s);
    const b = pil && pil.querySelector('[title="Emojis e figurinhas"]');
    const t = pil && pil.querySelector("textarea");
    return b && t ? { botao: Math.round(b.getBoundingClientRect().right), campo: Math.round(t.getBoundingClientRect().left) } : null;
  }, PILULA);
  ok("a carinha dos emojis continua à esquerda do texto", carinha && carinha.botao <= carinha.campo + 1, q(carinha));
  ok("e a barra continua sem fundo (só o balão, como no WhatsApp Web)", /rgba\(0, 0, 0, 0\)|transparent/.test(p.barraFundo || ""), p.barraFundo);
  await escrever(page, "Do computador");
  ok("com texto, o relógio de agendar continua na barra", (await pecas(page)).relogio === 1);
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n11. Corrigindo uma mensagem: o “+” sai, e o botão verde fica");
{
  const { ctx, page, estouros } = await abrirPagina({ semente: EDICAO });
  await clicar(page, '[data-conversa-id="cv-campo-ed"] [data-conversa-nome], [data-conversa-id="cv-campo-ed"]');
  await page.waitForTimeout(900);
  ok("abri a conversa com a mensagem nossa", (await conta(page, '[data-msg-id="m-campo-ed"]')) === 1);
  ok("antes de editar, o “+” está lá", (await conta(page, MAIS)) === 1);
  // A SETA DA BOLHA aparece com o mouse em cima; no celular o dedo a toca.
  const abriu = await clicar(page, '[data-msg-id="m-campo-ed"] button[aria-label="Opções da mensagem"]', { apagada: true })
    && await clicar(page, 'div[data-menu-msg] button:has-text("Editar")');
  ok("abri a edição pelo menu da mensagem", abriu);
  ok("a caixa está corrigindo a mensagem", (await valorDoCampo(page)) === "Mensagem com erro", await valorDoCampo(page));
  ok("o “+” sai: corrigir não anexa nada", (await conta(page, MAIS)) === 0);
  ok("e o botão verde de enviar fica, para mandar a correção", (await conta(page, "[data-enviar-celular]")) === 1);
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
