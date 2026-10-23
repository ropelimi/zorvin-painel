// AS MENSAGENS RÁPIDAS COM VÍDEO (23/10)
//
// Pedido do Rodrigo: "Para as mensagens rápidas, precisa ser possível incluir
// vídeos." O vídeo que a equipe manda a todo cliente novo era procurado no
// computador e anexado à mão, a cada vez. Agora ele mora na própria rápida.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a CONTA, direto na função (`rapidasComAnexo.js`);
//   2. sem o script 034 da ponte, nada de anexo aparece, e a rápida de texto
//      continua sendo gravada — sem mencionar coluna que não existe;
//   3. o arquivo SOBE UMA VEZ, ao salvar, para `anexos/rapidas/…`, com o
//      cache de um ano; antes de salvar não sobe nada;
//   4. com anexo, o texto é opcional e o atalho não; e o depósito que recusa
//      é dito, e NADA é salvo;
//   5. escolher a rápida abre a prévia com o vídeo e a legenda PREENCHIDA, com
//      as quebras de linha; enviar e agendar mandam à fila o MESMO endereço,
//      sem subir o vídeo de novo;
//   6. na legenda, Shift+Enter quebra a linha e Enter envia — também num
//      anexo comum;
//   7. editar leva o anexo junto, tirar o anexo volta a rápida a texto, e
//      mexer só no texto não toca no anexo;
//   8. a rápida de texto continua igual;
//   9. só a coluna que FALTA esconde o anexo: a pergunta que falha por outro
//      motivo o mantém oferecido.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { tipoDoAnexo, caminhoDoAnexoDaRapida, semAColunaDoAnexo, nomeDoAnexo, anexoDoDeposito,
         CACHE_DO_ANEXO_DA_RAPIDA } from "../src/rapidasComAnexo.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// ==================================================================
//  1. A CONTA, SEM NAVEGADOR
// ==================================================================
console.log("\n1. As contas do anexo da rápida, direto na função");
ok("vídeo é vídeo", tipoDoAnexo("video/mp4") === "video");
ok("foto é imagem, áudio é áudio, o resto é documento",
   tipoDoAnexo("image/jpeg") === "imagem" && tipoDoAnexo("audio/ogg") === "audio"
   && tipoDoAnexo("application/pdf") === "documento" && tipoDoAnexo("") === "documento");
const caminho = caminhoDoAnexoDaRapida("Como funciona o acordo — 2ª via.mp4", 1761234567890);
ok("o endereço mora em rapidas/, com o carimbo e o nome higienizado",
   caminho === "rapidas/1761234567890-Como_funciona_o_acordo_2_via.mp4", caminho);
ok("a coluna que falta é reconhecida pelo código E pelo nome",
   semAColunaDoAnexo({ code: "42703", message: "column mensagens_rapidas.midia_url does not exist" })
   && semAColunaDoAnexo({ code: "PGRST204", message: "Could not find the 'midia_tipo' column" }));
ok("e um 42703 de outra coluna não diz nada sobre esta",
   !semAColunaDoAnexo({ code: "42703", message: "column mensagens_rapidas.outra does not exist" }));
ok("nem a rede caída, nem a ausência de erro",
   !semAColunaDoAnexo({ message: "Failed to fetch" }) && !semAColunaDoAnexo(null));
ok("o anexo se escreve por extenso", nomeDoAnexo("video") === "vídeo" && nomeDoAnexo("audio") === "áudio");
ok("a rápida sem anexo não vira anexo", anexoDoDeposito({ titulo: "x", midia_url: null }) === null);
const doDeposito = anexoDoDeposito({ midia_url: "https://d/anexos/rapidas/1-a.mp4", midia_tipo: "video",
                                     midia_mime: "video/mp4", midia_nome: "a.mp4" });
ok("a com anexo vira um arquivo que já está no depósito",
   doDeposito && doDeposito.doDeposito === true && doDeposito.url === "https://d/anexos/rapidas/1-a.mp4"
   && doDeposito.type === "video/mp4" && doDeposito.name === "a.mp4" && doDeposito.tipo === "video",
   JSON.stringify(doDeposito));
ok("o cache é o da ponte: um ano, imutável", CACHE_DO_ANEXO_DA_RAPIDA.cacheControl === "31536000, immutable");

// ==================================================================
//  A BANCADA
// ==================================================================
const nav = await abrirNavegador();
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

const CLIENTE = "ANDREIA CRISTINA MARTINS";
const agora = new Date().toISOString();
const GUARDADO = "https://deposito.bancada/anexos/rapidas/1760000000000-guia_do_cliente.pdf";
const SEMENTE = {
  contatos: [{ id: "ct-video", numero: "5511970005501", nome: CLIENTE, vantoro_nome: null, nome_zorvin: null,
               vantoro_cliente_id: null, foto_url: null }],
  conversas: [{ id: "cv-video", advogado_id: ADV, contato_id: "ct-video", nao_lidas: 0, arquivada: false,
                fixada: false, favorita: false, ultima_atividade: agora, ultima_mensagem: "bom dia", frente: null,
                vantoro_nome: null, digitando_ate: null,
                contato: { id: "ct-video", nome: CLIENTE, numero: "5511970005501", foto_url: null } }],
  mensagens: [{ id: "m-video-0", conversa_id: "cv-video", origem: "contato", tipo: "texto", texto: "bom dia",
                criado_em: agora, id_uazapi: "uz-m-video-0" }],
  mensagens_rapidas: [
    { id: "r-saudacao", titulo: "Saudação", texto: "Bom dia, {nome}!", criado_em: "2026-10-01T12:00:00Z",
      midia_url: null, midia_tipo: null, midia_mime: null, midia_nome: null },
    { id: "r-guia", titulo: "Guia do cliente", texto: "Segue o guia.", criado_em: "2026-10-01T12:00:00Z",
      midia_url: GUARDADO, midia_tipo: "documento", midia_mime: "application/pdf", midia_nome: "Guia do cliente.pdf" },
  ],
};
// UM VÍDEO DE MENTIRA, pequeno: o navegador não precisa tocá-lo, e o que se
// confere é por onde ele passa — o depósito, a linha, a fila.
const VIDEO = { name: "Como funciona o acordo.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(4096, 7) };
const PDF = { name: "Novo guia.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };

async function abrirPainel({ semColunas = false, recusarLeitura = false, largura = 1400, altura = 900 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, hasTouch: largura < 768 });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__DEPOSITO_COM_ENDERECO = true;
    globalThis.__SUBIDAS = [];
    globalThis.__SUBIDA_FALHA = false;
    globalThis.__SEM_COLUNAS = d.semColunas ? { mensagens_rapidas: ["midia_url", "midia_tipo", "midia_mime", "midia_nome"] } : {};
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura ? ["mensagens_rapidas"] : [];
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente: semColunas
         ? { ...SEMENTE, mensagens_rapidas: SEMENTE.mensagens_rapidas.map(({ id, titulo, texto, criado_em }) => ({ id, titulo, texto, criado_em })) }
         : SEMENTE,
       semColunas, recusarLeitura });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}

async function clicar(page, seletor) {
  // GUARDADO: num elemento que não existe, `click()` estoura a prova inteira.
  const l = page.locator(seletor);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(350);
  return true;
}
const subidas = (page) => page.evaluate(() => (globalThis.__SUBIDAS || []).slice());
const rapidas = (page) => page.evaluate(() => (globalThis.__TABELAS.mensagens_rapidas || []).map((r) => ({ ...r })));
const rapida = async (page, titulo) => (await rapidas(page)).find((r) => r.titulo === titulo) || null;
const fila = (page) => page.evaluate(() => (globalThis.__TABELAS.fila_envio || [])
  .filter((x) => x.conversa_id === "cv-video").map((x) => ({ ...x })));
const oFilme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));

async function abrirConfigRapidas(page) {
  // PELO MENU ⋮ do topo, e a ÚLTIMA aba com o nome (atrás da janela ficou a
  // fita de filtros).
  if (!(await clicar(page, 'button[aria-label="Menu"]'))) return false;
  const config = page.getByRole("button", { name: "Configurações" });
  if (!(await config.count())) return false;
  await config.first().click();
  await page.waitForTimeout(500);
  const aba = page.getByRole("button", { name: "Mensagens rápidas", exact: true });
  if (!(await aba.count())) return false;
  await aba.last().click();
  await page.waitForTimeout(500);
  return true;
}
async function nova(page) {
  const b = page.getByRole("button", { name: "Nova", exact: true });
  if (!(await b.count())) return false;
  await b.last().click();
  await page.waitForTimeout(300);
  return true;
}
async function preencher(page, titulo, texto) {
  const t = page.locator('input[placeholder="Ex.: Saudação"]');
  if (await t.count()) await t.first().fill(titulo);
  const x = page.locator("[data-texto-da-rapida-na-config]");
  if (await x.count()) await x.first().fill(texto);
}
async function salvar(page) {
  const ok2 = await clicar(page, "[data-salvar-rapida]");
  await page.waitForTimeout(700);
  return ok2;
}
async function anexar(page, arquivo) {
  const campo = page.locator("[data-arquivo-da-rapida]");
  if (!(await campo.count())) return false;
  await campo.first().setInputFiles(arquivo);
  await page.waitForTimeout(400);
  return true;
}
async function abrirConversa(page) {
  const ok2 = await clicar(page, `[data-conversa-nome="${CLIENTE}"]`);
  await page.waitForTimeout(800);
  return ok2;
}
const CAIXA = 'textarea[placeholder*="Digite uma mensagem"]';
async function escolherNoMenu(page, filtro, titulo) {
  const caixa = page.locator(CAIXA);
  if (!(await caixa.count())) return false;
  await caixa.first().fill(`/${filtro}`);
  await page.waitForTimeout(400);
  return clicar(page, `[data-rapida-no-menu="${titulo}"]`);
}
const legenda = async (page) => {
  const l = page.locator("[data-legenda-do-anexo]");
  if (!(await l.count())) return null;
  return l.first().inputValue();
};
const naCaixa = async (page) => {
  const c = page.locator(CAIXA);
  if (!(await c.count())) return null;
  return c.first().inputValue();
};

// ==================================================================
//  2. SEM O SCRIPT 034
// ==================================================================
console.log("\n2. Sem o script 034 da ponte, a rápida é o texto de sempre");
{
  const { ctx, page, estouros } = await abrirPainel({ semColunas: true });
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  ok("abri uma nova", await nova(page));
  ok("o formulário não oferece anexar", (await page.locator("[data-anexar-na-rapida], [data-anexo-da-rapida]").count()) === 0);
  await preencher(page, "Só texto", "Obrigado pelo contato!");
  ok("salvei", await salvar(page));
  const r = await rapida(page, "Só texto");
  ok("e a rápida de texto foi gravada — sem mencionar coluna do anexo, que daria 42703",
     Boolean(r) && r.texto === "Obrigado pelo contato!", JSON.stringify(r));
  ok("sem frase de falha", !/Não consegui/.test(await oFilme(page)), await oFilme(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  3. CRIAR A RÁPIDA COM VÍDEO
// ==================================================================
console.log("\n3. Criar a rápida com vídeo: o arquivo sobe uma vez, ao salvar");
let URL_DO_VIDEO = null;
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  ok("abri uma nova", await nova(page));
  ok("o formulário oferece anexar", (await page.locator("[data-anexar-na-rapida]").count()) === 1);
  ok("escolhi o vídeo", await anexar(page, VIDEO));
  ok("o formulário mostra o vídeo escolhido, ainda não salvo",
     (await page.locator('[data-anexo-escolhido="novo"] video').count()) === 1);
  const nome = await page.locator("[data-nome-do-anexo]").first().innerText().catch(() => "");
  ok("com o nome dele", nome === VIDEO.name, nome);
  ok("e NADA subiu ainda: quem escolhe o vídeo errado e troca não deixa arquivo a mais",
     (await subidas(page)).length === 0, JSON.stringify(await subidas(page)));
  await preencher(page, "Vídeo do acordo", "Olá, {nome}! Veja como funciona:\nÉ rápido.");
  ok("salvei", await salvar(page));
  const s = await subidas(page);
  ok("salvando, o vídeo subiu UMA vez", s.length === 1, JSON.stringify(s));
  ok("para anexos/rapidas/, com o nome higienizado",
     s[0] && s[0].balde === "anexos" && /^rapidas\/\d+-Como_funciona_o_acordo\.mp4$/.test(s[0].caminho), JSON.stringify(s[0]));
  ok("como vídeo, e com o cache de um ano (a régua da ponte)",
     s[0] && s[0].tipo === "video/mp4" && s[0].cache === "31536000, immutable", JSON.stringify(s[0]));
  const r = await rapida(page, "Vídeo do acordo");
  URL_DO_VIDEO = r && r.midia_url;
  ok("a linha guarda o endereço que o depósito deu",
     Boolean(r) && s[0] && r.midia_url === `https://deposito.bancada/anexos/${s[0].caminho}`, JSON.stringify(r));
  ok("e o tipo, o mime e o NOME de verdade (com espaço e acento, como a pessoa escolheu)",
     r && r.midia_tipo === "video" && r.midia_mime === "video/mp4" && r.midia_nome === VIDEO.name, JSON.stringify(r));
  ok("e o texto, com as variáveis cruas (a rápida é da equipe inteira)",
     r && r.texto === "Olá, {nome}! Veja como funciona:\nÉ rápido.", JSON.stringify(r && r.texto));
  const chip = await page.locator('[data-rapida-da-config="Vídeo do acordo"] [data-anexo-na-lista="video"]').innerText().catch(() => "");
  ok("a lista diz que ela leva o vídeo", /Com vídeo: Como funciona o acordo\.mp4/.test(chip), chip);

  // SÓ O VÍDEO, SEM TEXTO — e o atalho continua obrigatório.
  ok("abri outra nova", await nova(page));
  await anexar(page, VIDEO);
  await preencher(page, "", "");
  await salvar(page);
  ok("sem atalho, a tela pede o atalho", /Preencha o atalho\./.test(await oFilme(page)), await oFilme(page));
  ok("e nada subiu nem foi gravado", (await subidas(page)).length === 1 && !(await rapida(page, "")));
  await preencher(page, "Só o vídeo", "");
  ok("com o atalho, salvei", await salvar(page));
  const so = await rapida(page, "Só o vídeo");
  ok("a rápida só com o vídeo foi gravada, com o texto vazio",
     so && so.texto === "" && so.midia_tipo === "video", JSON.stringify(so));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. O DEPÓSITO QUE RECUSA
// ==================================================================
console.log("\n4. O depósito recusa: a falha é dita, e nada é salvo");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  ok("abri uma nova", await nova(page));
  await anexar(page, VIDEO);
  await preencher(page, "Vídeo grande", "Veja");
  await page.evaluate(() => { globalThis.__SUBIDA_FALHA = true; });
  await salvar(page);
  const filme = await oFilme(page);
  ok("a tela diz que não subiu, com o código, e que nada foi salvo",
     /Não consegui subir o anexo/.test(filme) && /413/.test(filme) && /Nada foi salvo/.test(filme), filme);
  ok("e diz por quê: grande demais para o depósito", /grande demais/.test(filme), filme);
  ok("a rápida não foi gravada", !(await rapida(page, "Vídeo grande")));
  ok("e o formulário continua aberto, com o que foi escrito",
     (await page.locator("[data-salvar-rapida]").count()) === 1
     && (await page.locator("[data-texto-da-rapida-na-config]").first().inputValue().catch(() => "")) === "Veja");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  5. USAR A RÁPIDA NA CONVERSA
// ==================================================================
console.log("\n5. Na conversa, a rápida abre a prévia do anexo com a legenda preenchida");
{
  const { ctx, page, estouros } = await abrirPainel();
  const GUIA = "Guia do cliente";
  ok("abri a conversa da Andreia", await abrirConversa(page));
  const caixa = page.locator(CAIXA);
  if (await caixa.count()) { await caixa.first().fill("/guia"); await page.waitForTimeout(400); }
  ok("o menu do “/” diz que a rápida leva um documento",
     (await page.locator(`[data-rapida-no-menu="${GUIA}"] [data-rapida-com-anexo="documento"]`).count()) === 1);
  ok("escolhi a rápida", await clicar(page, `[data-rapida-no-menu="${GUIA}"]`));
  ok("a prévia do anexo abriu", (await page.locator("[data-previa-anexo]").count()) === 1);
  ok("com a legenda preenchida", (await legenda(page)) === "Segue o guia.", JSON.stringify(await legenda(page)));
  ok("e a caixa de escrever ficou vazia — o texto vai como legenda, e não duas vezes",
     (await naCaixa(page)) === "", JSON.stringify(await naCaixa(page)));
  const antes = (await subidas(page)).length;
  const enviar = page.locator('[data-previa-anexo] button[title="Enviar"]');
  if (await enviar.count()) { await enviar.first().click(); await page.waitForTimeout(1200); }
  const f = await fila(page);
  const ultimo = f[f.length - 1];
  ok("enviar põe na fila o MESMO endereço do depósito",
     ultimo && ultimo.midia_url === GUARDADO, JSON.stringify(ultimo));
  ok("como documento, com o nome dele e o texto como legenda",
     ultimo && ultimo.tipo === "documento" && ultimo.midia_nome === "Guia do cliente.pdf"
     && ultimo.midia_mime === "application/pdf" && ultimo.texto === "Segue o guia.", JSON.stringify(ultimo));
  ok("e o arquivo NÃO subiu de novo", (await subidas(page)).length === antes, JSON.stringify(await subidas(page)));
  ok("a bolha nasce na conversa apontando para o mesmo arquivo",
     (await page.locator(`[data-msg-id^="temp-"]`).count()) >= 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  6. O VÍDEO CRIADO NA CENA 3, DE PONTA A PONTA
// ==================================================================
console.log("\n6. A rápida com vídeo, do formulário ao cliente — com o nome e as quebras de linha");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  ok("abri uma nova", await nova(page));
  await anexar(page, VIDEO);
  await preencher(page, "Vídeo do acordo", "Olá, {nome}! Veja como funciona:\nÉ rápido.");
  ok("salvei", await salvar(page));
  const r = await rapida(page, "Vídeo do acordo");
  ok("(a rápida com vídeo existe)", Boolean(r && r.midia_url), JSON.stringify(r));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("abri a conversa da Andreia", await abrirConversa(page));
  ok("escolhi a rápida pelo “/”", await escolherNoMenu(page, "acordo", "Vídeo do acordo"));
  ok("a prévia mostra O vídeo da rápida",
     r && (await page.locator(`[data-previa-anexo] video[src="${r.midia_url}"]`).count()) === 1);
  ok("com o nome da cliente preenchido, e o parágrafo no lugar",
     (await legenda(page)) === "Olá, Andreia! Veja como funciona:\nÉ rápido.", JSON.stringify(await legenda(page)));
  // O CURSOR NO FIM da legenda: ela chega preenchida para ser completada, e
  // não reescrita do começo.
  const cursor = await page.evaluate(() => {
    const el = document.querySelector("[data-legenda-do-anexo]");
    return el ? { emFoco: document.activeElement === el, onde: el.selectionStart, fim: el.value.length } : null;
  });
  ok("e o cursor já está nela, no fim do texto", cursor && cursor.emFoco && cursor.onde === cursor.fim && cursor.fim > 0,
     JSON.stringify(cursor));
  // SHIFT+ENTER quebra a linha; ENTER envia.
  const campo = page.locator("[data-legenda-do-anexo]");
  if (await campo.count()) {
    await campo.first().press("End");
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Qualquer dúvida, me chame.");
  }
  ok("Shift+Enter quebra a linha na legenda",
     (await legenda(page)) === "Olá, Andreia! Veja como funciona:\nÉ rápido.\nQualquer dúvida, me chame.",
     JSON.stringify(await legenda(page)));
  const antes = (await subidas(page)).length;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  ok("e Enter envia: a prévia fecha", (await page.locator("[data-previa-anexo]").count()) === 0);
  const f = await fila(page);
  const ultimo = f[f.length - 1];
  ok("na fila vai o vídeo da rápida, sem subir de novo",
     r && ultimo && ultimo.midia_url === r.midia_url && ultimo.tipo === "video"
     && (await subidas(page)).length === antes, JSON.stringify({ ultimo, subidas: await subidas(page) }));
  ok("com a legenda inteira, as três linhas",
     ultimo && ultimo.texto === "Olá, Andreia! Veja como funciona:\nÉ rápido.\nQualquer dúvida, me chame.",
     JSON.stringify(ultimo && ultimo.texto));
  ok("e o nome do arquivo como a pessoa o escolheu", ultimo && ultimo.midia_nome === VIDEO.name,
     JSON.stringify(ultimo && ultimo.midia_nome));

  // AGENDAR pela prévia, com o mesmo endereço.
  ok("escolhi a rápida de novo", await escolherNoMenu(page, "acordo", "Vídeo do acordo"));
  ok("abri a janela da hora", await clicar(page, "[data-agendar-anexo]"));
  ok("escolhi amanhã às 14h", await clicar(page, '[data-agenda-rapida="amanha14"]'));
  ok("confirmei", await clicar(page, "[data-agenda-confirmar]"));
  await page.waitForTimeout(1000);
  const f2 = await fila(page);
  const agendada = f2[f2.length - 1];
  ok("a agendada vai com o mesmo endereço, sem subir de novo",
     r && agendada && agendada.agendada_para && agendada.midia_url === r.midia_url
     && (await subidas(page)).length === antes, JSON.stringify(agendada));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  7. EDITAR, TROCAR E TIRAR O ANEXO
// ==================================================================
console.log("\n7. Editar a rápida: o anexo vai junto, troca, e sai");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  // MEXER SÓ NO TEXTO não toca no anexo.
  ok("abri o lápis do Guia", await clicar(page, '[data-rapida-da-config="Guia do cliente"] [data-editar-rapida]'));
  const guardado = await page.locator('[data-anexo-escolhido="guardado"] [data-nome-do-anexo]').innerText().catch(() => "");
  ok("o formulário mostra o anexo guardado", guardado === "Guia do cliente.pdf", guardado);
  const x = page.locator("[data-texto-da-rapida-na-config]");
  if (await x.count()) await x.first().fill("Segue o guia atualizado.");
  ok("salvei só o texto", await salvar(page));
  const g1 = await rapida(page, "Guia do cliente");
  ok("o texto mudou e o anexo continuou o mesmo",
     g1 && g1.texto === "Segue o guia atualizado." && g1.midia_url === GUARDADO && g1.midia_tipo === "documento",
     JSON.stringify(g1));
  ok("e nada subiu", (await subidas(page)).length === 0);

  // TROCAR
  ok("abri o lápis de novo", await clicar(page, '[data-rapida-da-config="Guia do cliente"] [data-editar-rapida]'));
  ok("o botão de trocar está lá", (await page.locator("[data-trocar-anexo-da-rapida]").count()) === 1);
  await anexar(page, PDF);
  ok("salvei a troca", await salvar(page));
  const g2 = await rapida(page, "Guia do cliente");
  ok("trocar sobe o arquivo novo, uma vez", (await subidas(page)).length === 1);
  ok("e a linha aponta para ele", g2 && g2.midia_url !== GUARDADO && /Novo_guia\.pdf$/.test(g2.midia_url)
     && g2.midia_nome === "Novo guia.pdf", JSON.stringify(g2));

  // TIRAR
  ok("abri o lápis mais uma vez", await clicar(page, '[data-rapida-da-config="Guia do cliente"] [data-editar-rapida]'));
  ok("tirei o anexo", await clicar(page, "[data-tirar-anexo-da-rapida]"));
  ok("o formulário volta a oferecer anexar", (await page.locator("[data-anexar-na-rapida]").count()) === 1);
  ok("salvei", await salvar(page));
  const g3 = await rapida(page, "Guia do cliente");
  ok("a rápida voltou a ser só texto, as quatro colunas limpas",
     g3 && g3.midia_url === null && g3.midia_tipo === null && g3.midia_mime === null && g3.midia_nome === null,
     JSON.stringify(g3));
  ok("a lista não diz mais que ela leva anexo",
     (await page.locator('[data-rapida-da-config="Guia do cliente"] [data-anexo-na-lista]').count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("abri a conversa", await abrirConversa(page));
  ok("escolhi o Guia pelo “/”", await escolherNoMenu(page, "guia", "Guia do cliente"));
  ok("sem anexo, nenhuma prévia abre", (await page.locator("[data-previa-anexo]").count()) === 0);
  ok("e o texto entra na caixa, como sempre", (await naCaixa(page)) === "Segue o guia atualizado.",
     JSON.stringify(await naCaixa(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  8. A RÁPIDA DE TEXTO, E O ANEXO COMUM
// ==================================================================
console.log("\n8. A rápida de texto continua igual, e a legenda de um anexo comum também tem linhas");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a conversa", await abrirConversa(page));
  ok("escolhi a Saudação", await escolherNoMenu(page, "sauda", "Saudação"));
  ok("nenhuma prévia abre", (await page.locator("[data-previa-anexo]").count()) === 0);
  ok("e a caixa recebe o texto preenchido", (await naCaixa(page)) === "Bom dia, Andreia!", JSON.stringify(await naCaixa(page)));
  const caixa = page.locator(CAIXA);
  if (await caixa.count()) await caixa.first().fill("");
  // UM ANEXO COMUM, pelo clipe.
  await page.setInputFiles('input[type="file"][multiple]', { name: "procuracao-assinada.pdf", mimeType: "application/pdf",
                                                             buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  await page.waitForTimeout(500);
  ok("a prévia do anexo comum abriu", (await page.locator("[data-previa-anexo]").count()) === 1);
  const campo = page.locator("[data-legenda-do-anexo]");
  if (await campo.count()) {
    await campo.first().type("Segue a procuração.");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Confira, por favor.");
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(1300);
  const f = await fila(page);
  const ultimo = f[f.length - 1];
  ok("a legenda do anexo comum vai com as duas linhas",
     ultimo && ultimo.texto === "Segue a procuração.\nConfira, por favor." && ultimo.tipo === "documento",
     JSON.stringify(ultimo));
  ok("e ESTE subiu, como sempre (é um arquivo do computador)", (await subidas(page)).length === 1,
     JSON.stringify(await subidas(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  9. A PERGUNTA PELAS COLUNAS QUE FALHA POR OUTRO MOTIVO
// ==================================================================
console.log("\n9. A pergunta pelas colunas falha por outro motivo: o anexo continua oferecido");
{
  // TRÊS ESTADOS, pela régua de `temVantoro.js`: só a coluna que FALTA
  // esconde o anexo. A leitura que falha por outra razão (a rede, a sessão)
  // não é ausência — esconder ali tiraria o anexo no dia em que a rede tossisse.
  const { ctx, page, estouros } = await abrirPainel({ recusarLeitura: true });
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  ok("abri uma nova", await nova(page));
  ok("o formulário continua oferecendo anexar", (await page.locator("[data-anexar-na-rapida]").count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  10. NO CELULAR
// ==================================================================
console.log("\n10. No celular, o botão de anexar tem o alvo de dedo");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  ok("abri Configurações → Mensagens rápidas", await abrirConfigRapidas(page));
  ok("abri uma nova", await nova(page));
  const altura = await page.evaluate(() => {
    const b = document.querySelector("[data-anexar-na-rapida]");
    return b ? b.getBoundingClientRect().height : 0;
  });
  ok("o botão de anexar tem pelo menos 40px", altura >= 39.5, `${altura}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
