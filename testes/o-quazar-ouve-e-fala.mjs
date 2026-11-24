// O QUAZAR OUVE O PEDIDO E LÊ O RESUMO (24/11) — a metade do painel.
//
// Dois pedidos do Rodrigo, no mesmo dia:
//   - "No "Sugerir resposta" quando vou pedir uma mudança ao Quazar, quero que
//     seja possível pedir a mudança também enviando um áudio e não só
//     digitando."
//   - "no ícone de pergaminho onde temos o resumo da conversa, quero também a
//     possibilidade de darmos voz ao Quazar! Uma opção dele ler o resumo para
//     o usuário." (pela ElevenLabs, escolhida por ele)
//
// Quem fala com o Groq e com a ElevenLabs é a PONTE (seções 126, 127 e 128 do
// repo dela). Esta prova guarda o que é da tela:
//
//   1. o microfone fica ao lado do "Pedir", só com a ponte que ouve (`ouvir`)
//      — a de antes, e a sem a chave do Groq, não o oferecem; na dúvida,
//      oferece;
//   2. um toque grava (o tempo corre, o campo e o Pedir travam), o quadrado
//      termina; a gravação vai à ponte, o campo diz "Ouvindo…", e o texto
//      entra no campo e SAI como pedido, pelo caminho do digitado. Nada vai
//      ao cliente;
//   3. o teto de um minuto termina sozinho; o X e o Esc cancelam sem mandar
//      nada, e o microfone é devolvido (as trilhas param); a conversa trocada
//      no meio cancela;
//   4. o "não ouvi nenhuma fala", a recusa do microfone e o pedido longo
//      demais são ditos, e nada sai;
//   5. a conversa trocada enquanto a ponte ouve: o texto fica no campo da
//      conversa dele, e nada sai sozinho;
//   6. o "Ouvir" do resumo só com a voz ligada E escolhida; na dúvida, mostra;
//   7. o texto que vai à voz é o resumo em frases, com o nome arrumado e a
//      frase da IA no fim; o áudio toca, para no "Parar", e ouvir de novo não
//      pede outra vez; a recusa é dita; fechar o quadro e pedir outro resumo
//      calam a voz;
//   8. a seção da aba Quazar: sem a chave, sem o 062, a ponte de antes; gerar
//      três opções com a descrição da tela, ouvir, escolher — e o "Ouvir"
//      aparece no resumo sem recarregar;
//   9. no celular, o microfone cabe na faixa e o "Ouvir" vira ícone.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// O MICROFONE DE MENTIRA do Chromium: grava um bipe, e o navegador não
// pergunta.
const nav = await abrirNavegador({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const AGORA = Date.now();
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const CAMPO = "textarea[data-campo]";

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function preencher(loc, v) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(v, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
const valor = async (loc) => ((await loc.count()) ? loc.first().inputValue().catch(() => null) : null);
const attr = async (loc, nome) => ((await loc.count()) ? loc.first().getAttribute(nome).catch(() => null) : null);
const normal = (s) => String(s || "").replace(/\s+/g, " ").trim();
async function esperar(fn, ms = 8000) {
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    if (await fn()) return true;
    await pausa(100);
  }
  return Boolean(await fn());
}

// UM WAV de verdade, para o navegador tocar: o tom de 440 Hz, mono, 8 kHz.
function wav(segundos) {
  const taxa = 8000, n = Math.round(taxa * segundos);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(taxa, 24);
  b.writeUInt32LE(taxa * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 6000), 44 + i * 2);
  return b;
}
const VOZ_CURTA = wav(0.6);
const VOZ_LONGA = wav(4);

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const contato = (id, numero, nome, vantoro_nome = null) =>
  ({ id, numero, nome, vantoro_nome, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-voz-1", "5511948230301", "Deus", "ANDREIA CRISTINA MARTINS"),
  contato("ct-voz-2", "5511948230302", "José Carlos Pereira"),
];
const A = "cv-voz-1", B = "cv-voz-2";
const conversa = (n) => ({
  id: `cv-voz-${n}`, advogado_id: ADV, contato_id: `ct-voz-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null,
  vantoro_nome: CONTATOS[n - 1].vantoro_nome, contato: CONTATOS[n - 1],
});
const SEMENTE = {
  contatos: CONTATOS,
  conversas: [1, 2].map(conversa),
  mensagens: [1, 2].map((n) => ({
    id: `m-voz-${n}`, conversa_id: `cv-voz-${n}`, origem: "contato", tipo: "texto",
    texto: "Bom dia, qual é o telefone do advogado?", criado_em: antes(n + 5),
  })),
};

const ESTADO = { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, ajustar: true, aprende: true,
                 ouvir: true, voz: true, voz_pronta: true };
const SUGESTAO = "Olá, {nome}! Vamos verificar e retornamos.";
const REFEITA = "Olá, {nome}! Por segurança, não passamos o telefone do advogado.";
const REFEITA_PRONTA = "Olá, Andreia! Por segurança, não passamos o telefone do advogado.";
const DITO = "Não podemos passar o telefone do advogado.";
const RESUMO = {
  quer: "Saber o telefone do advogado",
  combinado: ["A equipe explicou que não passa o telefone."],
  falta: [],
};
const VOZ_PADRAO = "Quazar, the mascot and virtual assistant of the support team: a street-smart duck.";
const AMOSTRA = "Fala, equipe! Aqui é o Quazar, o assistente do Zorvin.";

// A PONTE DE MENTIRA. Trocada por cena; `pedidos` guarda cada pedido inteiro.
let ponte;
const pedidos = { ouvir: [], ajustar: [], falar: [], opcoes: [], escolher: [], voz: 0 };
function zerar() {
  ponte = {
    estado: { status: 200, corpo: { ...ESTADO } },
    ouvir: { status: 200, corpo: { ok: true, texto: DITO }, demora: 600 },
    ajustar: { status: 200, corpo: { ok: true, sugestao: REFEITA, licao: null }, demora: 0 },
    falar: { status: 200, audio: VOZ_CURTA, demora: 300 },
    voz: { status: 200, corpo: { ok: true, ligada: true, sem_tabela: false, escolhida: null, modelo: "eleven_multilingual_v2",
                                 descricao_padrao: VOZ_PADRAO, amostra: AMOSTRA } },
    opcoes: { status: 200, demora: 300, corpo: { ok: true, texto: AMOSTRA, opcoes: [1, 2, 3].map((i) => ({
      id: `gerada${i}`, audio: VOZ_CURTA.toString("base64"), tipo: "audio/wav", segundos: 0.6 })) } },
    escolher: { status: 200, corpo: { ok: true, escolhida: { nome: "Quazar", descricao: "x", escolhida_em: new Date(AGORA).toISOString(),
                                                              escolhida_por: "Rodrigo Sousa" } } },
  };
  for (const k of Object.keys(pedidos)) pedidos[k] = Array.isArray(pedidos[k]) ? [] : 0;
}
zerar();

async function abrirPagina({ largura = 1400, altura = 900, bandeiras = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__TETO_DO_PEDIDO_FALADO_S = b.bandeiras.teto || undefined;
    // OS FLUXOS DO MICROFONE ficam à vista da prova: é por eles que se sabe
    // se o microfone foi devolvido.
    globalThis.__FLUXOS = [];
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      const original = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => {
        if (b.bandeiras.semMicrofone) throw new DOMException("negado", "NotAllowedError");
        const f = await original(c);
        globalThis.__FLUXOS.push(f);
        return f;
      };
    }
    // QUANTAS VEZES ALGO TOCOU, e quando parou.
    globalThis.__TOCOU = 0;
    globalThis.__PAROU = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { globalThis.__TOCOU++; return play.call(this); };
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { globalThis.__PAROU++; return pause.call(this); };
  }, { semente: SEMENTE, bandeiras });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    const corpoDoPedido = () => { try { return JSON.parse(rota.request().postData() || "{}"); } catch (_) { return {}; } };
    const p = url.pathname;
    if (p.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (p.endsWith("/copiloto/sugerir")) return json(200, { ok: true, sugestao: SUGESTAO });
    if (p.endsWith("/copiloto/ouvir")) {
      pedidos.ouvir.push({ corpo: corpoDoPedido(), autorizacao: rota.request().headers()["authorization"] || "" });
      if (ponte.ouvir.demora) await pausa(ponte.ouvir.demora);
      return json(ponte.ouvir.status, ponte.ouvir.corpo);
    }
    if (p.endsWith("/copiloto/ajustar")) {
      pedidos.ajustar.push({ corpo: corpoDoPedido() });
      if (ponte.ajustar.demora) await pausa(ponte.ajustar.demora);
      return json(ponte.ajustar.status, ponte.ajustar.corpo);
    }
    if (p.endsWith("/copiloto/resumir")) {
      return json(200, { ok: true, resumo: RESUMO, mensagens: 1, notas: 0, cortou: false, ate: antes(6), avisos: [] });
    }
    if (p.endsWith("/copiloto/voz/falar")) {
      pedidos.falar.push({ corpo: corpoDoPedido(), autorizacao: rota.request().headers()["authorization"] || "" });
      const r = ponte.falar;
      if (r.demora) await pausa(r.demora);
      if (r.status !== 200) return json(r.status, r.corpo);
      return rota.fulfill({ status: 200, contentType: "audio/wav", body: r.audio });
    }
    if (p.endsWith("/copiloto/voz/opcoes")) {
      pedidos.opcoes.push({ corpo: corpoDoPedido() });
      if (ponte.opcoes.demora) await pausa(ponte.opcoes.demora);
      return json(ponte.opcoes.status, ponte.opcoes.corpo);
    }
    if (p.endsWith("/copiloto/voz/escolher")) {
      pedidos.escolher.push({ corpo: corpoDoPedido() });
      return json(ponte.escolher.status, ponte.escolher.corpo);
    }
    if (p.endsWith("/copiloto/voz")) { pedidos.voz++; return json(ponte.voz.status, ponte.voz.corpo); }
    if (p.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
const caixa = (page) => page.locator(CAMPO);
const naCaixa = (page) => caixa(page).inputValue().catch(() => "SEM CAIXA");
async function abrirConversa(page, id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const botaoDoQuazar = (page) => page.locator("[data-copiloto-botao]");
const faixa = (page) => page.locator("[data-copiloto-situacao]");
const campoDoPedido = (page) => page.locator("[data-copiloto-pedido-campo]");
const mic = (page) => page.locator("[data-copiloto-gravar]");
const pedir = (page) => page.locator("[data-copiloto-pedir]");
const erroDoPedido = (page) => page.locator("[data-copiloto-erro-do-pedido]");
const saiuParaOCliente = (page, id) => page.evaluate((c) =>
  (globalThis.__TABELAS.fila_envio || []).filter((f) => String(f.conversa_id) === String(c)).length, id);
const fluxosAbertos = (page) => page.evaluate(() =>
  (globalThis.__FLUXOS || []).flatMap((f) => f.getTracks()).filter((t) => t.readyState !== "ended").length);
async function sugerir(page) {
  await preencher(caixa(page), "");
  await page.waitForTimeout(150);
  if (!(await esperar(async () => (await botaoDoQuazar(page).count()) === 1))) return false;
  if (!(await clicar(botaoDoQuazar(page)))) return false;
  return esperar(async () => (await naCaixa(page)).length > 0 && (await faixa(page).count()) === 1);
}
/** Grava por `ms` e termina pelo quadrado. Devolve se a gravação começou. */
async function gravar(page, ms = 1300) {
  if (!(await clicar(mic(page)))) return false;
  if (!(await esperar(async () => (await attr(mic(page), "data-copiloto-gravar")) === "gravando", 5000))) return false;
  await page.waitForTimeout(ms);
  return true;
}

// ==================================================================
console.log("\n1. O microfone fica ao lado do Pedir, só com a ponte que ouve");
{
  zerar();
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, A);
  ok("a sugestão entrou na caixa", await sugerir(page));
  ok("o microfone aparece na faixa", (await mic(page).count()) === 1);
  ok("parado, e dizendo o que faz",
     (await attr(mic(page), "data-copiloto-gravar")) === "parado"
     && /falando/.test((await attr(mic(page), "aria-label")) || ""), await attr(mic(page), "aria-label"));
  const lado = await page.evaluate(() => {
    const m = document.querySelector("[data-copiloto-gravar]")?.getBoundingClientRect();
    const c = document.querySelector("[data-copiloto-pedido-campo]")?.getBoundingClientRect();
    const p = document.querySelector("[data-copiloto-pedir]")?.getBoundingClientRect();
    if (!m || !c || !p) return null;
    const no = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
    return { entre: m.left >= c.right - 1 && m.right <= p.left + 1, mesmaLinha: Math.abs((m.top + m.height / 2) - (p.top + p.height / 2)) < 6,
             pintado: Boolean(no && no.closest("[data-copiloto-gravar]")) };
  });
  ok("entre o campo e o Pedir, na mesma linha, pintado", lado && lado.entre && lado.mesmaLinha && lado.pintado, q(lado));
  ok("nenhum erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();

  // A PONTE DE ANTES (sem `ouvir`) E A SEM A CHAVE DO GROQ (`ouvir: false`).
  for (const [nome, est] of [["a ponte de antes", (() => { const e = { ...ESTADO }; delete e.ouvir; return e; })()],
                             ["a ponte sem a chave do Groq", { ...ESTADO, ouvir: false }]]) {
    zerar();
    ponte.estado.corpo = est;
    const x = await abrirPagina();
    await abrirConversa(x.page, A);
    ok(`${nome}: a sugestão entrou`, await sugerir(x.page));
    ok(`${nome}: o campo de pedir continua`, (await campoDoPedido(x.page).count()) === 1);
    ok(`${nome}: sem o microfone`, (await mic(x.page).count()) === 0);
    await x.ctx.close();
  }

  // NA DÚVIDA (a pergunta do estado falhou), o microfone aparece.
  zerar();
  ponte.estado = { status: 500, corpo: { ok: false } };
  const y = await abrirPagina();
  await abrirConversa(y.page, A);
  ok("a pergunta que falhou: a sugestão entrou", await sugerir(y.page));
  ok("e o microfone aparece (na dúvida, mostra)", (await mic(y.page).count()) === 1);
  await y.ctx.close();
}

// O BOTÃO DESLIGADO, PERGUNTADO SÓ SE ELE EXISTE: `isDisabled` num elemento que
// não está na tela espera 30 segundos e estoura a prova inteira, e uma prova que
// estoura não diz qual conferência viu o defeito (o painel de antes parou aqui).
async function desligado(loc) {
  if (!(await loc.count())) return null;
  return loc.first().isDisabled({ timeout: 3000 }).catch(() => null);
}
async function apertar(loc, tecla) {
  if (!(await loc.count())) return false;
  try { await loc.first().press(tecla, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}

// ==================================================================
console.log("\n2. Gravar, ouvir e pedir — pelo caminho do digitado");
{
  zerar();
  ponte.ajustar.corpo = { ok: true, sugestao: REFEITA, licao: { id: "lc-1", texto: "Não passamos o telefone do advogado ao cliente." } };
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, A);
  ok("a sugestão entrou", await sugerir(page));
  ok("um toque começa a gravar", await gravar(page, 1400));
  ok("o tempo corre", /^0:0[1-9]$/.test(normal(await texto(page.locator("[data-copiloto-gravando-tempo]")))),
     await texto(page.locator("[data-copiloto-gravando-tempo]")));
  ok("o campo trava e diz que está gravando",
     (await campoDoPedido(page).first().getAttribute("readonly")) !== null
     && /Gravando/.test((await attr(campoDoPedido(page), "placeholder")) || ""), await attr(campoDoPedido(page), "placeholder"));
  ok("o Pedir trava", (await desligado(pedir(page))) === true);
  ok("e há como cancelar", (await page.locator("[data-copiloto-gravar-cancelar]").count()) === 1);
  ok("o microfone está aberto", (await fluxosAbertos(page)) > 0);
  ok("o quadrado termina", await clicar(mic(page)));
  ok("o campo diz que está ouvindo",
     await esperar(async () => /Ouvindo/.test((await attr(campoDoPedido(page), "placeholder")) || ""), 3000),
     await attr(campoDoPedido(page), "placeholder"));
  ok("e o microfone gira", (await attr(mic(page), "data-copiloto-gravar")) === "ouvindo");
  ok("e o microfone foi devolvido", (await fluxosAbertos(page)) === 0, `${await fluxosAbertos(page)} trilhas abertas`);
  ok("a gravação foi à ponte", await esperar(async () => pedidos.ouvir.length === 1), `foram ${pedidos.ouvir.length}`);
  const o = pedidos.ouvir[0] || {};
  ok("com o áudio em base64", typeof o.corpo?.audio === "string" && o.corpo.audio.length > 100 && /^[A-Za-z0-9+/=]+$/.test(o.corpo.audio),
     `${String(o.corpo?.audio || "").slice(0, 40)}…`);
  ok("com o tipo de áudio", /^audio\//.test(o.corpo?.mime || ""), o.corpo?.mime);
  ok("com a sessão de quem pediu", /^Bearer .+/.test(o.autorizacao || ""));
  ok("o que foi dito sai como pedido", await esperar(async () => pedidos.ajustar.length === 1), `foram ${pedidos.ajustar.length}`);
  ok("com o texto da ponte", pedidos.ajustar[0]?.corpo?.pedido === DITO, q(pedidos.ajustar[0]?.corpo));
  ok("e a mensagem de agora", pedidos.ajustar[0]?.corpo?.sugestao === "Olá, Andreia! Vamos verificar e retornamos.",
     q(pedidos.ajustar[0]?.corpo?.sugestao));
  ok("a mensagem refeita está na caixa", await esperar(async () => (await naCaixa(page)) === REFEITA_PRONTA), await naCaixa(page));
  ok("e o Aprendi aparece", (await page.locator("[data-copiloto-licao]").count()) === 1);
  ok("o microfone volta a ficar parado", (await attr(mic(page), "data-copiloto-gravar")) === "parado");
  ok("nada foi ao cliente", (await saiuParaOCliente(page, A)) === 0);
  ok("nenhum erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n3. O teto termina sozinho; o X e o Esc cancelam; a troca de conversa cancela");
{
  zerar();
  const { ctx, page } = await abrirPagina({ bandeiras: { teto: 2 } });
  await abrirConversa(page, A);
  ok("a sugestão entrou", await sugerir(page));
  ok("gravando", await gravar(page, 200));
  ok("o teto (2 s nesta cena) termina sozinho e manda",
     await esperar(async () => pedidos.ouvir.length === 1, 6000), `foram ${pedidos.ouvir.length}`);
  ok("e o pedido sai", await esperar(async () => pedidos.ajustar.length === 1));
  await ctx.close();

  zerar();
  const x = await abrirPagina();
  await abrirConversa(x.page, A);
  ok("a sugestão entrou", await sugerir(x.page));
  // Com texto escrito no campo antes de gravar: sem texto, o Pedir já estaria
  // desligado, e a conferência de que ele trava gravando não mediria nada.
  const ESCRITO = "troque amanhã por segunda";
  ok("escrevi um pedido no campo", await preencher(campoDoPedido(x.page), ESCRITO));
  ok("gravando", await gravar(x.page, 600));
  ok("com texto no campo, o Pedir trava enquanto grava", (await desligado(pedir(x.page))) === true);
  await apertar(campoDoPedido(x.page), "Enter");
  await x.page.waitForTimeout(400);
  ok("e o Enter no campo não manda o escrito", pedidos.ajustar.length === 0, `foram ${pedidos.ajustar.length}`);
  ok("o X cancela", await clicar(x.page.locator("[data-copiloto-gravar-cancelar]")));
  await x.page.waitForTimeout(900);
  ok("e nada vai à ponte", pedidos.ouvir.length === 0 && pedidos.ajustar.length === 0, q({ o: pedidos.ouvir.length, a: pedidos.ajustar.length }));
  ok("o que estava escrito continua no campo",
     (await campoDoPedido(x.page).first().inputValue({ timeout: 3000 }).catch(() => null)) === ESCRITO);
  ok("e o Pedir volta", (await desligado(pedir(x.page))) === false);
  ok("limpei o campo", await preencher(campoDoPedido(x.page), ""));
  ok("o microfone volta a ficar parado", (await attr(mic(x.page), "data-copiloto-gravar")) === "parado");
  ok("e foi devolvido", (await fluxosAbertos(x.page)) === 0, `${await fluxosAbertos(x.page)} trilhas abertas`);

  ok("gravando de novo", await gravar(x.page, 500));
  await x.page.keyboard.press("Escape");
  await x.page.waitForTimeout(900);
  ok("o Esc cancela a gravação", (await attr(mic(x.page), "data-copiloto-gravar")) === "parado");
  ok("sem mandar nada", pedidos.ouvir.length === 0);
  ok("e a faixa continua (o Esc fechou só a gravação)", (await faixa(x.page).count()) === 1);
  ok("e a conversa continua aberta", (await x.page.locator(CAMPO).count()) === 1);
  ok("o microfone foi devolvido", (await fluxosAbertos(x.page)) === 0);

  ok("gravando mais uma vez", await gravar(x.page, 500));
  ok("trocar de conversa no meio", await abrirConversa(x.page, B));
  await x.page.waitForTimeout(800);
  ok("cancela a gravação, sem mandar nada", pedidos.ouvir.length === 0, `foram ${pedidos.ouvir.length}`);
  ok("e devolve o microfone", (await fluxosAbertos(x.page)) === 0, `${await fluxosAbertos(x.page)} trilhas abertas`);
  await x.ctx.close();
}

// ==================================================================
console.log("\n4. O que não serve é dito, e nada sai");
{
  zerar();
  ponte.ouvir = { status: 422, corpo: { ok: false, erro: "Não ouvi nenhuma fala no áudio. Grave de novo, mais perto do microfone, ou escreva o pedido." }, demora: 200 };
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, A);
  ok("a sugestão entrou", await sugerir(page));
  ok("gravando", await gravar(page, 700));
  await clicar(mic(page));
  ok("a frase da ponte é dita",
     await esperar(async () => /Não ouvi nenhuma fala/.test(await texto(erroDoPedido(page))), 5000), await texto(erroDoPedido(page)));
  ok("e nenhum pedido sai", pedidos.ajustar.length === 0);
  ok("o microfone volta a ficar parado, para tentar de novo", (await attr(mic(page), "data-copiloto-gravar")) === "parado");
  ok("e o campo continua escrevível", (await campoDoPedido(page).first().getAttribute("readonly")) === null);
  await ctx.close();

  zerar();
  const longo = `${"Não podemos passar o telefone do advogado, ".repeat(14)}fim.`;
  ponte.ouvir = { status: 200, corpo: { ok: true, texto: longo }, demora: 100 };
  const x = await abrirPagina();
  await abrirConversa(x.page, A);
  ok("a sugestão entrou", await sugerir(x.page));
  ok("gravando", await gravar(x.page, 600));
  await clicar(mic(x.page));
  ok("o pedido longo demais fica no campo",
     await esperar(async () => (await valor(campoDoPedido(x.page))) === longo, 5000), String(await valor(campoDoPedido(x.page))).slice(0, 60));
  ok("com a frase de encurtar", /passou de 500 caracteres/.test(await texto(erroDoPedido(x.page))), await texto(erroDoPedido(x.page)));
  ok("e não sai sozinho", pedidos.ajustar.length === 0);
  await x.ctx.close();

  zerar();
  const y = await abrirPagina({ bandeiras: { semMicrofone: true } });
  await abrirConversa(y.page, A);
  ok("a sugestão entrou", await sugerir(y.page));
  await clicar(mic(y.page));
  ok("o microfone recusado é dito, com o que fazer",
     await esperar(async () => /não deixou usar o microfone/.test(await texto(erroDoPedido(y.page))), 4000), await texto(erroDoPedido(y.page)));
  ok("e o microfone volta a ficar parado", (await attr(mic(y.page), "data-copiloto-gravar")) === "parado");
  ok("nada vai à ponte", pedidos.ouvir.length === 0);
  await y.ctx.close();
}

// ==================================================================
console.log("\n5. A conversa trocada enquanto a ponte ouve");
{
  zerar();
  ponte.ouvir = { status: 200, corpo: { ok: true, texto: DITO }, demora: 2500 };
  const { ctx, page } = await abrirPagina();
  // B TAMBÉM TEM UMA SUGESTÃO NA CAIXA: é ali que um pedido perdido cairia.
  await abrirConversa(page, B);
  ok("em B, a sugestão entrou", await sugerir(page));
  await abrirConversa(page, A);
  ok("a sugestão entrou", await sugerir(page));
  ok("gravando", await gravar(page, 600));
  await clicar(mic(page));
  ok("a ponte está ouvindo", await esperar(async () => pedidos.ouvir.length === 1, 3000));
  ok("trocar de conversa no meio", await abrirConversa(page, B));
  await page.waitForTimeout(3000);
  ok("nada sai sozinho, nem para a conversa B", pedidos.ajustar.length === 0, `foram ${pedidos.ajustar.length}`);
  ok("e o campo de B não ganhou o que foi dito em A", (await valor(campoDoPedido(page))) !== DITO, q(await valor(campoDoPedido(page))));
  ok("de volta à conversa", await abrirConversa(page, A));
  ok("o que foi dito está no campo dela", (await valor(campoDoPedido(page))) === DITO, q(await valor(campoDoPedido(page))));
  ok("e o Pedir manda", await clicar(pedir(page)) && await esperar(async () => pedidos.ajustar.length === 1));
  await ctx.close();
}

// ==================================================================
console.log("\n6. O Ouvir do resumo só com a voz ligada e escolhida");
const resumoBotao = (page) => page.locator("[data-resumo-botao]");
const ouvir = (page) => page.locator("[data-resumo-ouvir]");
async function resumir(page) {
  if (!(await esperar(async () => (await resumoBotao(page).count()) === 1, 4000))) return false;
  await page.evaluate(() => document.querySelector("[data-resumo-botao]")?.click());
  return esperar(async () => (await page.locator('[data-resumo-da-conversa="pronto"]').count()) === 1, 5000);
}
{
  for (const [nome, est, aparece] of [
    ["a voz ligada e escolhida", { ...ESTADO }, true],
    ["sem a chave da ElevenLabs", { ...ESTADO, voz: false, voz_pronta: false }, false],
    ["sem voz escolhida", { ...ESTADO, voz_pronta: false }, false],
    ["a ponte de antes", (() => { const e = { ...ESTADO }; delete e.voz; delete e.voz_pronta; return e; })(), false],
    ["a ponte que ainda não leu a voz", { ...ESTADO, voz_pronta: null }, true],
  ]) {
    zerar();
    ponte.estado.corpo = est;
    const x = await abrirPagina();
    await abrirConversa(x.page, A);
    ok(`${nome}: o resumo chegou`, await resumir(x.page));
    ok(`${nome}: ${aparece ? "com" : "sem"} o Ouvir`, (await ouvir(x.page).count()) === (aparece ? 1 : 0));
    await x.ctx.close();
  }
  zerar();
  ponte.estado = { status: 500, corpo: { ok: false } };
  const y = await abrirPagina();
  await abrirConversa(y.page, A);
  ok("a pergunta que falhou: o resumo chegou", await resumir(y.page));
  ok("e o Ouvir aparece (na dúvida, mostra)", (await ouvir(y.page).count()) === 1);
  await y.ctx.close();
}

// ==================================================================
console.log("\n7. O Quazar lê o resumo");
{
  zerar();
  ponte.falar = { status: 200, audio: VOZ_LONGA, demora: 700 };
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, A);
  ok("o resumo chegou", await resumir(page));
  const r = await page.evaluate(() => {
    const b = document.querySelector("[data-resumo-ouvir]")?.getBoundingClientRect();
    const c = document.querySelector("[data-resumo-copiar]")?.getBoundingClientRect();
    if (!b || !c) return null;
    const no = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { antesDoCopiar: b.right <= c.left + 1, pintado: Boolean(no && no.closest("[data-resumo-ouvir]")) };
  });
  ok("o Ouvir fica antes do Copiar, pintado", r && r.antesDoCopiar && r.pintado, q(r));
  ok("e diz Ouvir", /Ouvir/.test(await texto(ouvir(page))), await texto(ouvir(page)));
  await clicar(ouvir(page));
  ok("preparando a voz", await esperar(async () => (await attr(ouvir(page), "data-resumo-ouvir")) === "preparando", 2000),
     await attr(ouvir(page), "data-resumo-ouvir"));
  ok("e o botão trava", (await desligado(ouvir(page))) === true);
  ok("o texto foi à ponte", await esperar(async () => pedidos.falar.length === 1), `foram ${pedidos.falar.length}`);
  const t = String(pedidos.falar[0]?.corpo?.texto || "");
  ok("começa dizendo quem fala", t.startsWith("Quazar aqui. Resumo da conversa com Andreia Cristina Martins."), q(t.slice(0, 80)));
  ok("com as três partes em frases, sem traços",
     /O que o cliente quer: Saber o telefone do advogado\./.test(t)
     && /O que já foi combinado: A equipe explicou que não passa o telefone\./.test(t)
     && /O que falta: Nada pendente\./.test(t) && !/^- /m.test(t), q(t));
  ok("e a frase da IA no fim", t.endsWith("Confira na conversa antes de agir."), q(t.slice(-60)));
  ok("com a sessão de quem pediu", /^Bearer .+/.test(pedidos.falar[0]?.autorizacao || ""));
  ok("o áudio toca", await esperar(async () => (await attr(ouvir(page), "data-resumo-ouvir")) === "tocando", 5000),
     await attr(ouvir(page), "data-resumo-ouvir"));
  ok("e o botão diz Parar", /Parar/.test(await texto(ouvir(page))), await texto(ouvir(page)));
  const parouAntes = await page.evaluate(() => globalThis.__PAROU);
  await clicar(ouvir(page));
  ok("o Parar para", await esperar(async () => (await attr(ouvir(page), "data-resumo-ouvir")) === "parado", 2000));
  ok("e o áudio foi pausado", (await page.evaluate(() => globalThis.__PAROU)) > parouAntes);
  const tocouAntes = await page.evaluate(() => globalThis.__TOCOU);
  await clicar(ouvir(page));
  ok("ouvir de novo toca", await esperar(async () => (await attr(ouvir(page), "data-resumo-ouvir")) === "tocando", 3000));
  ok("sem pedir outra vez à ponte", pedidos.falar.length === 1, `foram ${pedidos.falar.length}`);
  ok("e tocou de novo", (await page.evaluate(() => globalThis.__TOCOU)) > tocouAntes);
  const parou2 = await page.evaluate(() => globalThis.__PAROU);
  await page.locator("[data-resumo-fechar]").first().click().catch(() => {});
  await page.waitForTimeout(300);
  ok("fechar o quadro cala a voz", (await page.evaluate(() => globalThis.__PAROU)) > parou2);
  ok("nada foi ao cliente", (await saiuParaOCliente(page, A)) === 0);
  ok("nenhum erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();

  // O FIM DO ÁUDIO devolve o botão ao Ouvir.
  zerar();
  const z = await abrirPagina();
  await abrirConversa(z.page, A);
  ok("o resumo chegou", await resumir(z.page));
  await clicar(ouvir(z.page));
  ok("toca o áudio curto", await esperar(async () => (await attr(ouvir(z.page), "data-resumo-ouvir")) === "tocando", 4000));
  ok("e, no fim, o botão volta a dizer Ouvir",
     await esperar(async () => (await attr(ouvir(z.page), "data-resumo-ouvir")) === "parado", 4000), await attr(ouvir(z.page), "data-resumo-ouvir"));
  await z.ctx.close();

  // A RECUSA É DITA.
  zerar();
  ponte.falar = { status: 409, corpo: { ok: false, erro: "O Quazar ainda não tem voz: quem administra escolhe em Departamentos e acessos → Quazar → A voz do Quazar." } };
  const x = await abrirPagina();
  await abrirConversa(x.page, A);
  ok("o resumo chegou", await resumir(x.page));
  await clicar(ouvir(x.page));
  ok("a frase da ponte é dita",
     await esperar(async () => /ainda não tem voz/.test(await texto(x.page.locator("[data-resumo-voz-erro]"))), 4000),
     await texto(x.page.locator("[data-resumo-voz-erro]")));
  ok("e o botão volta, para tentar de novo", (await desligado(ouvir(x.page))) === false);
  await x.ctx.close();

  // FECHADO NO MEIO, a voz que chega depois não toca.
  zerar();
  ponte.falar = { status: 200, audio: VOZ_CURTA, demora: 1500 };
  const y = await abrirPagina();
  await abrirConversa(y.page, A);
  ok("o resumo chegou", await resumir(y.page));
  await clicar(ouvir(y.page));
  await y.page.waitForTimeout(300);
  await y.page.locator("[data-resumo-fechar]").first().click().catch(() => {});
  await y.page.waitForTimeout(2200);
  ok("a voz pedida antes de fechar não toca", (await y.page.evaluate(() => globalThis.__TOCOU)) === 0,
     `tocou ${await y.page.evaluate(() => globalThis.__TOCOU)}`);
  await y.ctx.close();

  // PEDIR OUTRO RESUMO cala a voz.
  zerar();
  ponte.falar = { status: 200, audio: VOZ_LONGA, demora: 100 };
  const w = await abrirPagina();
  await abrirConversa(w.page, A);
  ok("o resumo chegou", await resumir(w.page));
  await clicar(ouvir(w.page));
  ok("tocando", await esperar(async () => (await attr(ouvir(w.page), "data-resumo-ouvir")) === "tocando", 4000));
  const p0 = await w.page.evaluate(() => globalThis.__PAROU);
  await clicar(w.page.locator("[data-resumo-de-novo]"));
  await w.page.waitForTimeout(400);
  ok("pedir outro resumo cala a voz", (await w.page.evaluate(() => globalThis.__PAROU)) > p0);
  await w.ctx.close();
}

// ==================================================================
console.log("\n8. A voz do Quazar, na aba de quem administra");
async function abrirAAba(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(800);
  if (!(await clicar(page.locator("[data-aba-copiloto]")))) return false;
  await page.waitForTimeout(900);
  return true;
}
const secao = (page) => page.locator("[data-voz-do-quazar]");
{
  zerar();
  ponte.voz.corpo = { ...ponte.voz.corpo, ligada: false };
  const a = await abrirPagina();
  ok("a aba Quazar abriu", await abrirAAba(a.page));
  ok("a seção da voz está lá", await esperar(async () => (await secao(a.page).count()) === 1, 4000));
  ok("sem a chave, diz qual variável falta", /ELEVENLABS_API_KEY/.test(await texto(a.page.locator("[data-voz-sem-chave]"))));
  ok("e não oferece gerar", (await a.page.locator("[data-voz-gerar]").count()) === 0);
  await a.ctx.close();

  zerar();
  ponte.voz.corpo = { ...ponte.voz.corpo, sem_tabela: true };
  const b = await abrirPagina();
  await abrirAAba(b.page);
  ok("sem o 062, diz qual atualização falta", await esperar(async () => /062/.test(await texto(b.page.locator("[data-voz-sem-tabela]"))), 4000));
  ok("e não oferece gerar", (await b.page.locator("[data-voz-gerar]").count()) === 0);
  await b.ctx.close();

  zerar();
  ponte.voz = { status: 404, corpo: {} };
  const c = await abrirPagina();
  await abrirAAba(c.page);
  ok("a ponte de antes é dita como tal",
     await esperar(async () => /ainda não tem a voz/.test(await texto(c.page.locator("[data-voz-erro]"))), 4000),
     await texto(c.page.locator("[data-voz-erro]")));
  await c.ctx.close();

  // O CAMINHO INTEIRO: sem voz, gerar, ouvir, escolher — e o Ouvir aparece no
  // resumo sem recarregar.
  zerar();
  ponte.estado.corpo = { ...ESTADO, voz_pronta: false };
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, A);
  ok("antes de escolher: o resumo chegou", await resumir(page));
  ok("e sem o Ouvir", (await ouvir(page).count()) === 0);
  await page.locator("[data-resumo-fechar]").first().click().catch(() => {});
  ok("a aba Quazar abriu", await abrirAAba(page));
  ok("a seção diz que não há voz", await esperar(async () => (await attr(secao(page), "data-voz-do-quazar")) === "sem-voz", 4000),
     await attr(secao(page), "data-voz-do-quazar"));
  ok("a descrição de partida está no campo", (await valor(page.locator("[data-voz-descricao]"))) === VOZ_PADRAO);
  await preencher(page.locator("[data-voz-descricao]"), "curta");
  ok("menos de 20 caracteres não gera", (await desligado(page.locator("[data-voz-gerar]"))) === true);
  const MINHA = "A charismatic Brazilian duck with sunglasses, bright and buzzy, never cartoonish.";
  await preencher(page.locator("[data-voz-descricao]"), MINHA);
  ok("gerar as opções", await clicar(page.locator("[data-voz-gerar]")));
  ok("três opções chegam", await esperar(async () => (await page.locator("[data-voz-opcao]").count()) === 3, 4000));
  ok("com a descrição da tela", pedidos.opcoes[0]?.corpo?.descricao === MINHA, q(pedidos.opcoes[0]?.corpo));
  ok("cada opção se ouve", (await page.locator("[data-voz-opcao] audio[controls]").count()) === 3);
  ok("e diz o que elas falam", /Aqui é o Quazar/.test(await texto(page.locator("[data-voz-opcoes]"))));
  ok("escolher a segunda", await clicar(page.locator('[data-voz-escolher="gerada2"]')));
  ok("a escolha foi à ponte, com a descrição",
     await esperar(async () => pedidos.escolher.length === 1) && pedidos.escolher[0].corpo.id === "gerada2"
     && pedidos.escolher[0].corpo.descricao === MINHA, q(pedidos.escolher[0]?.corpo));
  ok("e a seção diz quem escolheu",
     await esperar(async () => /por Rodrigo Sousa/.test(await texto(page.locator('[data-voz-escolhida="sim"]'))), 3000),
     await texto(page.locator("[data-voz-escolhida]")));
  ok("com o recado de que o Ouvir já aparece", /Ouvir/.test(await texto(page.locator('[data-voz-recado="ok"]'))));
  ok("e as opções saem", (await page.locator("[data-voz-opcao]").count()) === 0);
  await page.getByRole("button", { name: "Fechar" }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  ok("de volta ao resumo", await resumir(page));
  ok("o Ouvir aparece sem recarregar", (await ouvir(page).count()) === 1);
  ok("nenhum erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();

  // A RECUSA AO GERAR é dita.
  zerar();
  ponte.opcoes = { status: 502, demora: 0, corpo: { ok: false, erro: "Acabaram os créditos da ElevenLabs. Quem administra a conta de lá precisa recarregar." } };
  const d = await abrirPagina();
  await abrirAAba(d.page);
  await esperar(async () => (await d.page.locator("[data-voz-gerar]").count()) === 1, 4000);
  await clicar(d.page.locator("[data-voz-gerar]"));
  ok("a recusa ao gerar é dita",
     await esperar(async () => /créditos/.test(await texto(d.page.locator('[data-voz-recado="erro"]'))), 4000),
     await texto(d.page.locator("[data-voz-recado]")));
  await d.ctx.close();
}

// ==================================================================
console.log("\n9. No celular");
{
  zerar();
  const { ctx, page } = await abrirPagina({ largura: 390, altura: 844 });
  await abrirConversa(page, A);
  // NO CELULAR, o "Sugerir resposta" mora no ⋮ da conversa.
  await clicar(page.getByRole("button", { name: /Mais opções|Opções da conversa|Menu da conversa/ }));
  await clicar(page.locator("[data-copiloto-item]"));
  ok("a sugestão entrou",
     await esperar(async () => (await naCaixa(page)).length > 0 && (await faixa(page).count()) === 1, 6000), await naCaixa(page));
  const m = await page.evaluate(() => {
    const b = document.querySelector("[data-copiloto-gravar]")?.getBoundingClientRect();
    const c = document.querySelector("[data-copiloto-pedido-campo]")?.getBoundingClientRect();
    if (!b || !c) return null;
    const no = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { dentro: b.right <= innerWidth && b.left >= 0, alvo: b.width >= 40 && b.height >= 40, campo: c.width,
             pintado: Boolean(no && no.closest("[data-copiloto-gravar]")), rolaDeLado: document.documentElement.scrollWidth > innerWidth };
  });
  ok("o microfone cabe na tela, com o alvo de dedo, pintado", m && m.dentro && m.alvo && m.pintado, q(m));
  ok("o campo ainda tem onde escrever", m && m.campo >= 120, q(m));
  ok("e a tela não rola de lado", m && !m.rolaDeLado, q(m));
  ok("gravando no celular", await gravar(page, 1200));
  const g = await page.evaluate(() => {
    const b = document.querySelector("[data-copiloto-gravar]")?.getBoundingClientRect();
    const p = document.querySelector("[data-copiloto-pedir]")?.getBoundingClientRect();
    return b && p ? { dentro: b.right <= innerWidth && p.right <= innerWidth, rolaDeLado: document.documentElement.scrollWidth > innerWidth } : null;
  });
  ok("gravando, o tempo e o Pedir cabem na tela", g && g.dentro && !g.rolaDeLado, q(g));
  await clicar(page.locator("[data-copiloto-gravar-cancelar]"));
  await page.locator("[data-copiloto-fechar]").first().click().catch(() => {});
  await preencher(caixa(page), "");
  // O RESUMO NO CELULAR é pelo ⋮.
  await clicar(page.getByRole("button", { name: /Mais opções|Opções da conversa|Menu da conversa/ }));
  await clicar(page.locator("[data-resumo-item]"));
  ok("o resumo chegou no celular",
     await esperar(async () => (await page.locator('[data-resumo-da-conversa="pronto"]').count()) === 1, 5000));
  const o = await page.evaluate(() => {
    const b = document.querySelector("[data-resumo-ouvir]");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { rotulo: b.innerText.trim(), aria: b.getAttribute("aria-label"), dentro: r.right <= innerWidth, alvo: r.height >= 40 };
  });
  ok("o Ouvir vira ícone, com o rótulo no aria-label, e cabe", o && o.rotulo === "" && /Ouvir/.test(o.aria || "") && o.dentro && o.alvo, q(o));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
