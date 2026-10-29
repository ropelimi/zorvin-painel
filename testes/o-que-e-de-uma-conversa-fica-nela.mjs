// O QUE É DE UMA CONVERSA FICA NELA — a seleção, o áudio e a prévia dos
// anexos não atravessam a troca de conversa (auditoria de 28/10)
//
// A troca de conversa já desarmava a edição, o renomear e a janela da hora
// (auditoria de 07/10). Três estados ficaram de fora, e os três fazem a tela
// de B mostrar — e agir sobre — o que foi começado em A:
//
//   4. A SELEÇÃO. "Apagar" numa bolha de A liga o modo de seleção; trocando
//      para B, B abria SEM caixa de escrever, dizendo "1 selecionada", e
//      "Apagar para todos" não apagava nada e não dizia nada;
//   5. O ÁUDIO. Gravado para A, a prévia aparecia na barra de B; "Enviar"
//      mandava para A (certo), mas a bolha "enviando" aparecia na lista de B —
//      quem enviou achava que tinha falado com B. E a gravação em curso
//      continuava na barra de B, com o microfone ligado;
//   6. A PRÉVIA DOS ANEXOS. Ela cobre a tela, mas as linhas da lista atrás
//      dela recebem o Tab: Tab até B, Enter, e o "Enviar" da prévia mandava o
//      documento escolhido para A ao cliente de B.
//
// O QUE ESTA PROVA GUARDA: a troca desliga a seleção e a confirmação; o áudio
// de A só aparece (e só sai) em A — a gravação em curso termina e espera lá, o
// Esc de B não a descarta, e B não grava outro por cima dela sem perguntar; a
// prévia dos anexos fecha na troca, e nada do que foi escolhido em A chega a B.
//
// O "SEM PERGUNTAR" É DA AUDITORIA DE 27/10, que chegou primeiro ao main: lá,
// gravar em B com o áudio de A esperando PERGUNTA (`window.confirm`) se é para
// descartá-lo, em vez de recusar com um aviso. A prova responde "não" e
// confere a pergunta — que diz por quê —, e não mais a frase do aviso.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const adv = await page.evaluate(() => {
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

const NOMES = { a: "TROCA CLIENTE ANA", b: "TROCA CLIENTE BIA" };
const SEMENTE = {
  contatos: Object.keys(NOMES).map((k, i) => ({ id: `ct-tr-${k}`, numero: `551197000990${i + 1}`,
                                                nome: NOMES[k], vantoro_nome: null, nome_zorvin: null })),
  conversas: Object.keys(NOMES).map((k, i) => ({ id: `cv-tr-${k}`, advogado_id: TEL, contato_id: `ct-tr-${k}`,
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: new Date(AGORA + 600e3 - i * 1000).toISOString(), ultima_mensagem: "oi", frente: null,
    vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: `ct-tr-${k}`, nome: NOMES[k], numero: `551197000990${i + 1}`, foto_url: null } })),
  mensagens: [
    { id: "m-tr-a-1", conversa_id: "cv-tr-a", origem: "contato", tipo: "texto", texto: "oi, aqui é a Ana",
      id_uazapi: "uz-m-tr-a-1", criado_em: new Date(AGORA - 20 * 60e3).toISOString() },
    { id: "m-tr-a-2", conversa_id: "cv-tr-a", origem: "advogado", tipo: "texto", texto: "Mensagem nossa para a Ana",
      id_uazapi: "uz-m-tr-a-2", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "lida",
      criado_em: new Date(AGORA - 10 * 60e3).toISOString() },
    { id: "m-tr-b-1", conversa_id: "cv-tr-b", origem: "contato", tipo: "texto", texto: "oi, aqui é a Bia",
      id_uazapi: "uz-m-tr-b-1", criado_em: new Date(AGORA - 30 * 60e3).toISOString() },
  ],
};

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__DEPOSITO_COM_ENDERECO = true;
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
    // O MICROFONE DE MENTIRA. Gravar de verdade dependeria do aparelho da
    // máquina da prova; aqui o gravador entrega um pedaço fixo de "áudio" ao
    // parar, como o de verdade entrega no `stop`. E cada um fica guardado,
    // para a prova saber se algum ficou gravando.
    globalThis.__GRAVADORES = [];
    class GravadorDeMentira {
      constructor() { this.state = "inactive"; this.mimeType = "audio/ogg"; globalThis.__GRAVADORES.push(this); }
      static isTypeSupported(t) { return String(t).startsWith("audio/ogg"); }
      start() { this.state = "recording"; }
      pause() { this.state = "paused"; }
      resume() { this.state = "recording"; }
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        setTimeout(() => {
          if (this.ondataavailable) this.ondataavailable({ data: new Blob(["OggS-prova"], { type: "audio/ogg" }) });
          if (this.onstop) this.onstop();
        }, 10);
      }
    }
    globalThis.MediaRecorder = GravadorDeMentira;
    const pedir = async () => ({ getTracks: () => [{ stop() {} }] });
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = pedir;
    else Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: pedir } });
  }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  return { ctx, page, estouros };
}
/** Clique GUARDADO: o que não existe (ou está coberto) não estoura a prova. */
async function clicar(page, sel) {
  const l = typeof sel === "string" ? page.locator(sel) : sel;
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
async function abrir(page, k) {
  const r = await clicar(page, `[data-conversa-id="cv-tr-${k}"]`);
  await page.waitForTimeout(900);
  return r;
}
/** A troca pelo TECLADO: o Tab alcança as linhas da lista mesmo atrás do que
 *  cobre a tela, e o Enter abre a conversa. */
async function abrirPeloTeclado(page, k) {
  const linha = page.locator(`[data-conversa-id="cv-tr-${k}"]`).first();
  if (!(await linha.count())) return false;
  await linha.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  return true;
}
/** O cabeçalho da conversa aberta — é onde está o nome de com quem se fala. */
const aberta = (page) => page.evaluate(() =>
  (document.querySelector("[data-topo-conversa]")?.innerText || "").replace(/\s+/g, " "));
const textoDaTela = (page) => page.evaluate(() => document.body.innerText);
const fila = (page) => page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).map((f) => ({
  conversa: f.conversa_id, tipo: f.tipo || "texto", nome: f.midia_nome || null })));
const bolhasCom = (page, texto) => page.evaluate((t) =>
  [...document.querySelectorAll("[data-msg-id]")].filter((el) => (el.textContent || "").includes(t)).length, texto);
const filme = (page) => page.evaluate(() => globalThis.__AVISOS_VISTOS.join(" | "));

// ==================================================================
console.log("\n4. A seleção de mensagens não atravessa a troca");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  await page.locator('[data-msg-id="m-tr-a-2"]').hover().catch(() => {});
  await clicar(page, '[data-msg-id="m-tr-a-2"] button[aria-label="Opções da mensagem"]');
  ok("cliquei em Apagar na mensagem de Ana", await clicar(page, 'div[data-menu-msg] button:has-text("Apagar")'));
  ok("o modo de seleção ligou: “1 selecionada”", /1 selecionada/.test(await textoDaTela(page)));
  ok("troquei para a conversa da Bia", await abrir(page, "b"));
  ok("na Bia, nada de “selecionada”", !/selecionada/.test(await textoDaTela(page)));
  ok("e a caixa de escrever está lá", (await page.locator('[data-campo="mensagem"]').count()) === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

console.log("\n4b. A confirmação de apagar também não atravessa (a troca pelo teclado)");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  await page.locator('[data-msg-id="m-tr-a-2"]').hover().catch(() => {});
  await clicar(page, '[data-msg-id="m-tr-a-2"] button[aria-label="Opções da mensagem"]');
  await clicar(page, 'div[data-menu-msg] button:has-text("Apagar")');
  ok("abri a confirmação de apagar", await clicar(page, 'button[title="Apagar as selecionadas"]')
     && (await page.locator('button:has-text("Apagar para todos")').count()) === 1);
  ok("troquei para a Bia pelo teclado", await abrirPeloTeclado(page, "b"));
  ok("a conversa aberta é a da Bia", (await aberta(page)).includes(NOMES.b), await aberta(page));
  ok("e a confirmação de apagar fechou", (await page.locator('button:has-text("Apagar para todos")').count()) === 0);
  ok("sem seleção na Bia", !/selecionada/.test(await textoDaTela(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. O áudio gravado para Ana não aparece, nem sai, na conversa da Bia");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  ok("comecei a gravar para a Ana", await clicar(page, 'button[title="Gravar áudio"]')
     && /Gravando/.test(await textoDaTela(page)));
  ok("concluí a gravação", await clicar(page, 'button[title="Concluir gravação"]'));
  await page.waitForTimeout(200);
  ok("a prévia do áudio está na barra da Ana", (await page.locator('button[title="Enviar áudio"]').count()) === 1);

  ok("troquei para a Bia", await abrir(page, "b"));
  ok("na Bia, a prévia do áudio da Ana NÃO aparece", (await page.locator('button[title="Enviar áudio"]').count()) === 0);
  ok("e a caixa de escrever da Bia está lá", (await page.locator('[data-campo="mensagem"]').count()) === 1);
  // B NÃO GRAVA POR CIMA SEM PERGUNTAR: o áudio da Ana está esperando, e um
  // segundo gravador apagaria o primeiro sem ninguém ver. A pergunta é a da
  // auditoria de 27/10 (`window.confirm`, ver o alto); quem responde "não"
  // fica com o áudio da Ana como estava.
  const perguntas = [];
  page.on("dialog", (d) => { perguntas.push(d.message()); d.dismiss().catch(() => {}); });
  await clicar(page, 'button[title="Gravar áudio"]');
  ok("gravar na Bia com o áudio da Ana esperando, e responder “não”, não começa outra gravação",
     !/Gravando/.test(await textoDaTela(page)), `${JSON.stringify(perguntas)} | ${await filme(page)}`);
  ok("e a tela pergunta antes, dizendo por quê: há um áudio gravado em outra conversa",
     perguntas.length === 1 && /áudio/i.test(perguntas[0]) && /outra conversa/i.test(perguntas[0]),
     JSON.stringify(perguntas));
  // O ESC DA BIA não é sobre o áudio da Ana: fecha a conversa, como sempre.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("Esc na Bia fecha a conversa da Bia", !(await aberta(page)).includes(NOMES.b), await aberta(page));

  ok("voltei para a Ana", await abrir(page, "a"));
  ok("a prévia do áudio da Ana continua lá", (await page.locator('button[title="Enviar áudio"]').count()) === 1);
  // O RECADO DE ANTES fica uns segundos no pé da tela, por cima do botão.
  await page.waitForSelector("[data-aviso]", { state: "detached", timeout: 10000 }).catch(() => {});
  ok("enviei o áudio", await clicar(page, 'button[title="Enviar áudio"]'));
  await page.waitForTimeout(900);
  const audios = (await fila(page)).filter((f) => f.tipo === "audio");
  ok("UM áudio entrou na fila, e para a Ana", audios.length === 1 && audios[0].conversa === "cv-tr-a",
     JSON.stringify(audios));
  ok("e a bolha dele está na conversa da Ana", (await aberta(page)).includes(NOMES.a)
     && (await page.locator('[data-msg-id^="temp-"]').count()) === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5b. A gravação em curso termina na troca, e espera na conversa dela");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  ok("comecei a gravar para a Ana", await clicar(page, 'button[title="Gravar áudio"]')
     && /Gravando/.test(await textoDaTela(page)));
  ok("troquei para a Bia no meio da gravação", await abrir(page, "b"));
  ok("na Bia, nada de “Gravando…”", !/Gravando/.test(await textoDaTela(page)));
  ok("nem a prévia do áudio da Ana", (await page.locator('button[title="Enviar áudio"]').count()) === 0);
  const ligados = await page.evaluate(() => globalThis.__GRAVADORES.filter((g) => g.state !== "inactive").length);
  ok("e o microfone desligou", ligados === 0, `${ligados} gravador(es) ainda gravando`);
  ok("voltei para a Ana", await abrir(page, "a"));
  ok("o que foi gravado espera na Ana, pronto para ouvir e enviar",
     (await page.locator('button[title="Enviar áudio"]').count()) === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. A prévia dos anexos fecha na troca, e o documento de Ana não vai para Bia");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  const NOME = "documento-da-ana-4471.pdf";
  await page.setInputFiles('input[type="file"][multiple]', {
    name: NOME, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prova da troca"),
  });
  await page.waitForTimeout(400);
  ok("a prévia do documento abriu na Ana", (await page.locator("[data-previa-anexo]").count()) === 1);
  ok("troquei para a Bia pelo teclado, atrás da prévia", await abrirPeloTeclado(page, "b"));
  ok("a conversa aberta é a da Bia", (await aberta(page)).includes(NOMES.b), await aberta(page));
  ok("a prévia do documento da Ana fechou", (await page.locator("[data-previa-anexo]").count()) === 0);
  // Se ela tivesse ficado, o "Enviar" estaria ali — e é ele que mandava.
  await clicar(page, '[data-previa-anexo] button[title="Enviar"]');
  await page.waitForTimeout(900);
  const paraBia = (await fila(page)).filter((f) => f.nome === NOME);
  ok("nada do documento foi para a fila", paraBia.length === 0, JSON.stringify(paraBia));
  ok("e nenhuma bolha dele na Bia", (await bolhasCom(page, NOME)) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
