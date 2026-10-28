// OS ANEXOS SAEM COMO FORAM ESCOLHIDOS — na ordem da prévia, sem colidir no
// depósito, e a falha de um não se esconde atrás dos outros (auditoria de 28/10)
//
// Três defeitos no envio de vários anexos de uma vez:
//
//  10. FORA DA ORDEM. O laço disparava todos juntos: cada arquivo subia ao
//      depósito em paralelo e entrava na fila quando a SUA subida terminava.
//      A ponte manda por `criado_em` — a foto pequena chegava ao cliente antes
//      do PDF grande que vinha antes dela na prévia;
//  11. A FALHA ESCONDIDA. Agendando vários, cada falha avisava sozinha e era
//      coberta, um instante depois, por "2 anexos agendados"; e a prévia já
//      tinha sido esvaziada — o que falhou não estava em lugar nenhum;
//  12. A COLISÃO. O caminho no depósito era `conversa/milissegundo-nome`, e
//      dois arquivos de mesmo nome mandados juntos caíam no mesmo
//      milissegundo. O depósito não sobrescreve ("already exists"): o segundo
//      virava bolha vermelha.
//
// A BANCADA RESPONDE A SUBIDA NA HORA e aceita qualquer caminho. Para medir,
// esta prova põe por cima do depósito dela o que o de verdade faz: demora por
// arquivo (um PDF grande leva mais que uma foto), recusa o caminho que já
// existe, e recusa um arquivo grande demais (413).
//
// E UMA QUARTA COISA, que o conserto da ordem cria e esta prova vigia: com os
// arquivos saindo um de cada vez, trocar de conversa no meio do lote manda o
// resto para a conversa do clique — e a bolha dele não pode aparecer na que
// ficou aberta.
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

const NOMES = { a: "ANEXOS CLIENTE AMARO", b: "ANEXOS CLIENTE BENTO" };
const SEMENTE = {
  contatos: Object.keys(NOMES).map((k, i) => ({ id: `ct-anx-${k}`, numero: `551197000770${i + 1}`,
                                                nome: NOMES[k], vantoro_nome: null, nome_zorvin: null })),
  conversas: Object.keys(NOMES).map((k, i) => ({ id: `cv-anx-${k}`, advogado_id: TEL, contato_id: `ct-anx-${k}`,
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: new Date(AGORA + 600e3 - i * 1000).toISOString(), ultima_mensagem: "oi", frente: null,
    vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: `ct-anx-${k}`, nome: NOMES[k], numero: `551197000770${i + 1}`, foto_url: null } })),
  mensagens: Object.keys(NOMES).map((k) => ({ id: `m-anx-${k}`, conversa_id: `cv-anx-${k}`, origem: "contato",
    tipo: "texto", texto: `oi, aqui é o ${k}`, id_uazapi: `uz-m-anx-${k}`,
    criado_em: new Date(AGORA - 20 * 60e3).toISOString() })),
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
  }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  // O DEPÓSITO DE VERDADE, por cima do da bancada: demora por arquivo, não
  // sobrescreve o caminho que já existe, e recusa o grande demais.
  await page.evaluate(async () => {
    const m = await import("/src/supabase.js");
    const deposito = m.supabase.storage;
    const original = deposito.from.bind(deposito);
    const ocupados = new Set();
    globalThis.__ATRASO_DA_SUBIDA = {};
    globalThis.__SUBIDA_RECUSADA = [];
    globalThis.__CAMINHOS = [];
    deposito.from = (balde) => {
      const b = original(balde);
      return { ...b, upload: async (caminho, arquivo, opcoes = {}) => {
        const nome = arquivo && arquivo.name;
        globalThis.__CAMINHOS.push({ nome, caminho });
        const ms = globalThis.__ATRASO_DA_SUBIDA[nome] || 0;
        if (ms) await new Promise((r) => setTimeout(r, ms));
        if (ocupados.has(`${balde}/${caminho}`) && !opcoes.upsert) {
          return { data: null, error: { statusCode: "409", error: "Duplicate", message: "The resource already exists" } };
        }
        if (globalThis.__SUBIDA_RECUSADA.includes(nome)) {
          return { data: null, error: { statusCode: "413", message: "The object exceeded the maximum allowed size" } };
        }
        ocupados.add(`${balde}/${caminho}`);
        return b.upload(caminho, arquivo, opcoes);
      } };
    };
  });
  return { ctx, page, estouros };
}
/** Clique GUARDADO: o que não existe (ou está coberto) não estoura a prova. */
async function clicar(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(200);
  return true;
}
async function abrir(page, k) {
  const r = await clicar(page, `[data-conversa-id="cv-anx-${k}"]`);
  await page.waitForTimeout(900);
  return r;
}
const pdf = (name, texto = name) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4 ${texto}`) });
const png = (name) => ({ name, mimeType: "image/png", buffer: Buffer.from("PNG-de-mentira " + name) });
async function escolher(page, arquivos) {
  await page.setInputFiles('input[type="file"][multiple]', arquivos);
  await page.waitForTimeout(500);
  return (await page.locator("[data-previa-anexo]").count()) === 1;
}
/** Os itens da fila desta conversa, na ORDEM EM QUE ENTRARAM — que é a ordem
 *  em que a ponte manda (o `criado_em` do banco é o da chegada). */
const fila = (page, conv) => page.evaluate((c) => (globalThis.__TABELAS.fila_envio || [])
  .filter((f) => f.conversa_id === c).map((f) => ({ nome: f.midia_nome, agendada: Boolean(f.agendada_para) })), conv);
const bolhasCom = (page, texto) => page.evaluate((t) =>
  [...document.querySelectorAll("[data-msg-id]")].filter((el) => (el.textContent || "").includes(t))
    .map((el) => el.querySelector("[data-estado-do-envio]")?.getAttribute("data-estado-do-envio") || null), texto);
const filme = (page) => page.evaluate(() => globalThis.__AVISOS_VISTOS.slice());

// ==================================================================
console.log("\n10. Vários anexos entram na fila na ordem da prévia");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  await page.evaluate(() => {
    globalThis.__ATRASO_DA_SUBIDA = { "1-peticao-grande.pdf": 900, "2-foto-media.png": 300 };
  });
  ok("escolhi três anexos", await escolher(page, [pdf("1-peticao-grande.pdf"), png("2-foto-media.png"),
                                                  png("3-foto-pequena.png")]));
  ok("enviei os três", await clicar(page, '[data-previa-anexo] button[title="Enviar os 3"]'));
  await page.waitForTimeout(2500);
  const ordem = (await fila(page, "cv-anx-a")).map((f) => f.nome);
  ok("os três entraram na fila", ordem.length === 3, JSON.stringify(ordem));
  ok("NA ORDEM DA PRÉVIA — é a ordem em que o cliente recebe",
     JSON.stringify(ordem) === JSON.stringify(["1-peticao-grande.pdf", "2-foto-media.png", "3-foto-pequena.png"]),
     JSON.stringify(ordem));
  ok("a bolha da petição está na conversa", (await bolhasCom(page, "1-peticao-grande.pdf")).length === 1);
  ok("e nenhuma bolha ficou vermelha", (await page.locator('[data-estado-do-envio="erro"]').count()) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n10b. Trocar de conversa no meio do lote: o resto vai para a conversa do clique, e a bolha não aparece na outra");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  await page.evaluate(() => { globalThis.__ATRASO_DA_SUBIDA = { "lento-do-amaro.pdf": 1200 }; });
  ok("escolhi dois anexos para o Amaro", await escolher(page, [pdf("lento-do-amaro.pdf"), pdf("segundo-do-amaro.pdf")]));
  ok("enviei os dois", await clicar(page, '[data-previa-anexo] button[title="Enviar os 2"]'));
  await page.waitForTimeout(300);
  ok("troquei para o Bento enquanto o primeiro subia", await abrir(page, "b"));
  await page.waitForTimeout(2200);
  const doAmaro = (await fila(page, "cv-anx-a")).map((f) => f.nome);
  ok("os dois foram para o Amaro, na ordem",
     JSON.stringify(doAmaro) === JSON.stringify(["lento-do-amaro.pdf", "segundo-do-amaro.pdf"]), JSON.stringify(doAmaro));
  ok("nada para o Bento", (await fila(page, "cv-anx-b")).length === 0);
  ok("e na conversa do Bento, nenhuma bolha dos anexos do Amaro",
     (await bolhasCom(page, "do-amaro.pdf")).length === 0, JSON.stringify(await bolhasCom(page, "do-amaro.pdf")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n12. Dois anexos de mesmo nome não colidem no depósito");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  ok("escolhi dois arquivos com o mesmo nome", await escolher(page, [
    pdf("procuracao-assinada.pdf", "a primeira via"), pdf("procuracao-assinada.pdf", "a segunda via")]));
  // O MESMO MILISSEGUNDO, sempre: o relógio parado durante o envio faz da
  // colisão uma certeza, e não uma questão de sorte da máquina da prova.
  await page.evaluate(() => {
    const parado = Date.now(), real = Date.now;
    Date.now = () => parado;
    setTimeout(() => { Date.now = real; }, 1500);
  });
  ok("enviei os dois", await clicar(page, '[data-previa-anexo] button[title="Enviar os 2"]'));
  await page.waitForTimeout(2200);
  const caminhos = await page.evaluate(() => globalThis.__CAMINHOS.map((c) => c.caminho));
  ok("os dois subiram por caminhos DIFERENTES", caminhos.length === 2 && caminhos[0] !== caminhos[1],
     JSON.stringify(caminhos));
  const naFila = (await fila(page, "cv-anx-a")).filter((f) => f.nome === "procuracao-assinada.pdf");
  ok("os dois entraram na fila, com o nome que o cliente vê", naFila.length === 2, JSON.stringify(naFila));
  const estados = await bolhasCom(page, "procuracao-assinada.pdf");
  ok("e nenhuma das duas bolhas ficou vermelha", estados.length === 2 && !estados.includes("erro"),
     JSON.stringify(estados));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n11. Agendando três, a falha de um é dita no fim, e ele volta para a prévia");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, "a");
  await page.evaluate(() => { globalThis.__SUBIDA_RECUSADA = ["2-video-grande-demais.pdf"]; });
  ok("escolhi três anexos", await escolher(page, [pdf("1-contrato.pdf"), pdf("2-video-grande-demais.pdf"),
                                                  pdf("3-recibo.pdf")]));
  ok("abri o relógio da prévia", await clicar(page, "[data-agendar-anexo]"));
  await clicar(page, '[data-agenda-rapida="amanha9"]');
  ok("confirmei", await clicar(page, "[data-agenda-confirmar]"));
  await page.waitForTimeout(2000);
  const agendados = (await fila(page, "cv-anx-a")).filter((f) => f.agendada).map((f) => f.nome);
  ok("os dois que subiram foram agendados",
     JSON.stringify(agendados) === JSON.stringify(["1-contrato.pdf", "3-recibo.pdf"]), JSON.stringify(agendados));
  const avisos = await filme(page);
  const ultimo = avisos[avisos.length - 1] || "";
  ok("a ÚLTIMA frase diz o que não foi", /2-video-grande-demais\.pdf/.test(ultimo), JSON.stringify(avisos));
  ok("e diz também o que foi", /2 anexos agendados/.test(ultimo), ultimo);
  ok("o que falhou voltou para a prévia", (await page.locator("[data-previa-anexo]").count()) === 1
     && /2-video-grande-demais\.pdf/.test(await page.locator("[data-previa-anexo]").innerText().catch(() => "")));
  ok("sozinho: os que foram não voltaram",
     !/1-contrato\.pdf|3-recibo\.pdf/.test(await page.locator("[data-previa-anexo]").innerText().catch(() => "")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
