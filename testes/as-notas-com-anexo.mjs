// AS NOTAS INTERNAS COM ANEXO (05/11)
//
// Pedido do Rodrigo: "Nas notas internas precisa ter a possibilidade de anexar
// documentos." As colunas são do script 053 da ponte (`midia_url`,
// `midia_tipo`, `midia_mime`, `midia_nome`).
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a CONTA, direto na função (`anexoNaNota.js`);
//   2. com a nota aberta, o clipe é o DA NOTA, e a prévia que ele abre é
//      âmbar, diz que o arquivo não vai ao cliente, não oferece agendar e
//      salva na nota — e não manda nada à fila de envio;
//   3. o arquivo sobe UMA vez, para `anexos/notas/<conversa>/…`, com o cache
//      de um ano; a nota guarda o endereço, o tipo, o tipo do arquivo e o NOME
//      DE VERDADE (com acento), e o texto escrito na prévia;
//   4. a bolha da nota mostra o arquivo, e a nota só com o arquivo não tem
//      texto; o áudio da nota não oferece transcrever;
//   5. a nota sobe para a ficha do Vantoro pela rota de sempre, com o id dela
//      (a linha do anexo é a ponte que escreve);
//   6. dois arquivos viram duas notas, na ordem; e a provisória é trocada pela
//      gravada pelo texto E pelo nome do arquivo;
//   7. arrastar e colar com a nota aberta vão para a nota; um lote não mistura
//      arquivo de nota com arquivo do cliente;
//   8. a nota com arquivo pode ficar sem texto, e a sem arquivo não;
//   9. o depósito que recusa é dito, e NADA é salvo;
//  10. sem o 053, a nota continua só texto, como antes;
//  11. a pergunta que falha por outro motivo mantém o clipe, e a gravação que
//      descobre a falta do 053 o tira.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { caminhoDoAnexoDaNota, CACHE_DO_ANEXO_DA_NOTA, notaTemAnexo, FRASE_DA_NOTA_SEM_ANEXO }
  from "../src/anexoNaNota.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const CENAS = String(process.env.CENAS || "").split(",").map((x) => x.trim()).filter(Boolean);
// As cenas que a prova perguntou: no fim, uma cena pedida em CENAS que não
// existe reprova (um erro de digitação não pode terminar verde sem rodar nada).
const cenasDaProva = new Set();
const vale = (cena) => (cenasDaProva.add(cena), !CENAS.length || CENAS.includes(cena));

// ==================================================================
//  1. A CONTA, SEM NAVEGADOR
// ==================================================================
console.log("\n1. As contas do anexo da nota, direto na função");
{
  const c = caminhoDoAnexoDaNota("cv-9", "0001.01 - Procuração.pdf", 1761234567890, 0.123456789);
  ok("o endereço mora em notas/<conversa>/, com o carimbo, o sorteio e o nome higienizado",
     /^notas\/cv-9\/1761234567890-[a-z0-9]{1,6}-0001\.01_-_Procura_o\.pdf$/.test(c), c);
  const c2 = caminhoDoAnexoDaNota("cv-9", "a.pdf", 1761234567890, 0.987654321);
  ok("e dois arquivos de mesmo nome no mesmo milissegundo caem em endereços diferentes", c !== c2
     && caminhoDoAnexoDaNota("cv-9", "a.pdf", 1, 0.1) !== caminhoDoAnexoDaNota("cv-9", "a.pdf", 1, 0.2));
  ok("o cache é o da ponte: um ano, imutável", CACHE_DO_ANEXO_DA_NOTA.cacheControl === "31536000, immutable");
  ok("a nota tem anexo pelo endereço", notaTemAnexo({ midia_url: "https://x/a.pdf" }) && !notaTemAnexo({ texto: "x" }) && !notaTemAnexo(null));
  ok("a frase de quem não tem o 053 diz o que fazer",
     /atualização do banco/.test(FRASE_DA_NOTA_SEM_ANEXO) && /Feche a nota/.test(FRASE_DA_NOTA_SEM_ANEXO));
}

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

const CLIENTE = "MARIA DAS GRAÇAS PEREIRA";
const CONV = "cv-nota-anexo";
const agora = new Date().toISOString();
const SEMENTE = {
  contatos: [{ id: "ct-nota-anexo", numero: "5511970005601", nome: CLIENTE, vantoro_nome: null, nome_zorvin: null,
               vantoro_cliente_id: "v-500", foto_url: null }],
  conversas: [{ id: CONV, advogado_id: ADV, contato_id: "ct-nota-anexo", nao_lidas: 0, arquivada: false,
                fixada: false, favorita: false, ultima_atividade: agora, ultima_mensagem: "mandei o comprovante",
                frente: null, vantoro_nome: null, digitando_ate: null,
                contato: { id: "ct-nota-anexo", nome: CLIENTE, numero: "5511970005601", foto_url: null,
                           vantoro_cliente_id: "v-500" } }],
  mensagens: [{ id: "m-nota-anexo-0", conversa_id: CONV, origem: "contato", tipo: "texto",
                texto: "mandei o comprovante", criado_em: agora, id_uazapi: "uz-m-nota-anexo-0" }],
};
const PDF = { name: "0001.01 - Procuração.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };
const PNG = { name: "print do banco.png", mimeType: "image/png",
              // Um pixel, e 8 KB de enchimento depois do fim (o navegador
              // ignora o que vem depois do IEND): a foto é MAIOR que o áudio, e
              // na cena 6, com a subida lenta por tamanho, ela termina de subir
              // DEPOIS dele. Salvas juntas, as notas cairiam na ordem errada.
              buffer: Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"), Buffer.alloc(8192, 0)]) };
const OGG = { name: "recado.ogg", mimeType: "audio/ogg", buffer: Buffer.alloc(2048, 3) };

const MIDIA = ["midia_url", "midia_tipo", "midia_mime", "midia_nome"];
async function abrirPainel({ sem053 = false, quebrarALeitura = false, largura = 1400, altura = 900 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, hasTouch: largura < 768 });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  const ponte = [];
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    if (url.pathname.endsWith("/vantoro/status")) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, configurado: true }) }).catch(() => {});
    }
    if (/\/vantoro\/cliente\/[^/]+\/nota$/.test(url.pathname) && metodo === "POST") {
      let corpo = {};
      try { corpo = JSON.parse(rota.request().postData() || "{}"); } catch (_) { /* vazio */ }
      ponte.push({ caminho: url.pathname, corpo });
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, atividade_id: 77 }) }).catch(() => {});
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }).catch(() => {});
  });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__DEPOSITO_COM_ENDERECO = true;
    globalThis.__SUBIDAS = [];
    globalThis.__SUBIDA_FALHA = false;
    globalThis.__SUBIDA_POR_KB = 0;
    globalThis.__SEM_COLUNAS = d.sem053 ? { notas: d.midia } : {};
    globalThis.__QUEBRAR_SO_A_LEITURA = d.quebrarALeitura ? ["notas"] : [];
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente: SEMENTE, sem053, quebrarALeitura, midia: MIDIA });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros, ponte };
}

async function clicar(page, seletor, espera = 350) {
  // GUARDADO: num elemento que não existe, `click()` estoura a prova inteira.
  const l = page.locator(seletor);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(espera);
  return true;
}
const conta = (page, seletor) => page.locator(seletor).count();
const attr = async (page, seletor, nome) =>
  ((await conta(page, seletor)) ? page.locator(seletor).first().getAttribute(nome) : null);
const subidas = (page) => page.evaluate(() => (globalThis.__SUBIDAS || []).slice());
const notas = (page) => page.evaluate((c) => (globalThis.__TABELAS.notas || [])
  .filter((n) => n.conversa_id === c).map((n) => ({ ...n })), CONV);
const filaDaConversa = (page) => page.evaluate((c) => (globalThis.__TABELAS.fila_envio || [])
  .filter((x) => x.conversa_id === c).length, CONV);
const oFilme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));
const limparFilme = (page) => page.evaluate(() => { globalThis.__AVISOS_VISTOS = []; });
/** O TEMPO REAL DA NOTA GRAVADA: a bancada não avisa o canal sozinha numa
 *  gravação do painel, e é o INSERT de `notas` que troca a provisória pela
 *  gravada. Avisa só as que ainda não foram avisadas. */
const avisarNotasGravadas = (page) => page.evaluate((c) => {
  const ja = globalThis.__NOTAS_AVISADAS || (globalThis.__NOTAS_AVISADAS = new Set());
  let n = 0;
  for (const linha of (globalThis.__TABELAS.notas || []).filter((x) => x.conversa_id === c)) {
    if (ja.has(String(linha.id))) continue;
    ja.add(String(linha.id));
    globalThis.__EMITIR("INSERT", "notas", { ...linha });
    n++;
  }
  return n;
}, CONV);
async function abrirConversa(page) {
  const ok2 = await clicar(page, `[data-conversa-nome="${CLIENTE}"]`, 900);
  return ok2;
}
async function ligarNota(page) {
  if (await conta(page, 'textarea[data-campo="nota"]')) return true;
  const ok2 = await clicar(page, "[data-nota-interna]", 900);
  return ok2 && (await conta(page, 'textarea[data-campo="nota"]')) > 0;
}
async function desligarNota(page) {
  if (!(await conta(page, 'textarea[data-campo="nota"]'))) return true;
  if (await clicar(page, "[data-fechar-nota]", 700)) return true;
  return clicar(page, "[data-nota-interna]", 700);
}
async function escolherArquivos(page, arquivos) {
  const campo = page.locator('input[type="file"][multiple]');
  if (!(await campo.count())) return false;
  await campo.first().setInputFiles(arquivos);
  await page.waitForTimeout(600);
  return true;
}
const soltar = (page, nome = "print.png", tipo = "image/png") => page.evaluate(async ({ nome, tipo }) => {
  const dt = new DataTransfer();
  dt.items.add(new File(["conteudo"], nome, { type: tipo }));
  document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 700));
}, { nome, tipo });
const colar = (page, nome = "colado.png", tipo = "image/png") => page.evaluate(async ({ nome, tipo }) => {
  const ev = new Event("paste", { bubbles: true, cancelable: true });
  const dt = new DataTransfer();
  dt.items.add(new File(["conteudo"], nome, { type: tipo }));
  Object.defineProperty(ev, "clipboardData", { value: dt });
  document.dispatchEvent(ev);
  await new Promise((r) => setTimeout(r, 700));
}, { nome, tipo });
async function fecharPrevia(page) {
  if (!(await conta(page, "[data-previa-anexo]"))) return;
  await clicar(page, '[data-previa-anexo] [title="Cancelar"]', 400);
}
async function escreverNaLegenda(page, texto) {
  const l = page.locator("[data-legenda-do-anexo]");
  if (!(await l.count())) return false;
  await l.first().fill(texto);
  return true;
}
/** Espera a condição, com teto: a gravação e a subida são assíncronas. */
async function esperar(fn, teto = 6000) {
  const fim = Date.now() + teto;
  let v = await fn();
  while (!v && Date.now() < fim) { await new Promise((r) => setTimeout(r, 150)); v = await fn(); }
  return v;
}

// ==================================================================
//  2 a 5. O ARQUIVO NA NOTA, DE PONTA A PONTA
// ==================================================================
if (vale("2")) {
  console.log("\n2. Com a nota aberta, o clipe é o da nota, e a prévia é âmbar");
  const { ctx, page, estouros, ponte } = await abrirPainel();
  ok("(a conversa abriu)", await abrirConversa(page));
  ok("na mensagem, o clipe de sempre", (await conta(page, '[data-anexar="mensagem"]')) === 1
     && (await conta(page, '[data-anexar="nota"]')) === 0);
  ok("(a nota abriu)", await ligarNota(page));
  ok("na nota, o clipe da nota aparece",
     await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1));
  ok("e o título dele diz que é para a nota",
     /nota interna/i.test((await attr(page, '[data-anexar="nota"]', "title")) || ""),
     await attr(page, '[data-anexar="nota"]', "title"));

  const antesFila = await filaDaConversa(page);
  ok("(escolhi um PDF pelo clipe da nota)", await escolherArquivos(page, PDF));
  ok("a prévia que abre é a da nota", (await attr(page, "[data-previa-anexo]", "data-previa-anexo")) === "nota",
     await attr(page, "[data-previa-anexo]", "data-previa-anexo"));
  const faixa = (await conta(page, "[data-faixa-da-nota]"))
    ? await page.locator("[data-faixa-da-nota]").first().innerText() : "";
  ok("e diz com todas as letras que é nota interna e que o arquivo não vai ao cliente",
     /Nota interna/.test(faixa) && /não vai ao cliente/.test(faixa), faixa);
  ok("não oferece agendar", (await conta(page, "[data-previa-anexo] [data-agendar-anexo]")) === 0);
  ok("nem o botão de enviar", (await conta(page, '[data-previa-anexo] button[title="Enviar"]')) === 0);
  ok("o botão diz que salva na nota",
     /Salvar na nota/.test((await conta(page, "[data-salvar-na-nota]")) ? await page.locator("[data-salvar-na-nota]").first().innerText() : ""));
  ok("(escrevi o que anotar)", await escreverNaLegenda(page, "Comprovante que o cliente mandou por e-mail.\nConferido."));
  // ENTER SALVA, como na caixa de escrever.
  // GUARDADO: num campo que não existe o Playwright espera 30 segundos e
  // derruba a prova, e uma prova que estoura não diz qual conferência viu o
  // defeito (a primeira rodada de sabotagens parou aqui, no painel de antes).
  if (await conta(page, "[data-legenda-do-anexo]")) await page.locator("[data-legenda-do-anexo]").first().press("Enter");
  await page.waitForTimeout(400);
  ok("Enter salva e a prévia fecha", (await conta(page, "[data-previa-anexo]")) === 0);

  console.log("\n3. O arquivo sobe uma vez, para notas/, e a nota guarda o nome de verdade");
  const gravadas = await esperar(async () => { const n = await notas(page); return n.length ? n : null; });
  const nota = (gravadas || [])[0] || {};
  const sub = await subidas(page);
  ok("subiu UMA vez", sub.length === 1, JSON.stringify(sub));
  ok("para o balde de anexos, na pasta notas/ da conversa",
     sub[0] && sub[0].balde === "anexos" && String(sub[0].caminho).startsWith(`notas/${CONV}/`), JSON.stringify(sub[0]));
  ok("com o cache de um ano", sub[0] && sub[0].cache === "31536000, immutable", sub[0] && sub[0].cache);
  ok("a nota foi gravada com o texto da prévia, quebras de linha inteiras",
     nota.texto === "Comprovante que o cliente mandou por e-mail.\nConferido.", JSON.stringify(nota.texto));
  ok("com o endereço do depósito", String(nota.midia_url || "").startsWith(`https://deposito.bancada/anexos/notas/${CONV}/`),
     nota.midia_url);
  ok("o tipo e o tipo do arquivo", nota.midia_tipo === "documento" && nota.midia_mime === "application/pdf",
     `${nota.midia_tipo} ${nota.midia_mime}`);
  ok("e o NOME DE VERDADE, com acento e espaço (a lição de 16/10)", nota.midia_nome === "0001.01 - Procuração.pdf",
     nota.midia_nome);
  ok("NADA foi para a fila de envio", (await filaDaConversa(page)) === antesFila);

  console.log("\n4. A bolha da nota mostra o arquivo");
  ok("a bolha provisória já mostra o documento",
     (await conta(page, '[data-msg-id^="nota-temp-"] [data-anexo-da-nota="documento"]')) === 1);
  ok("(o tempo real trouxe a nota gravada)", (await avisarNotasGravadas(page)) === 1);
  await page.waitForTimeout(500);
  ok("e a provisória foi trocada pela gravada", (await conta(page, '[data-msg-id^="nota-temp-"]')) === 0
     && (await conta(page, `[data-msg-id="nota-${nota.id}"] [data-anexo-da-nota="documento"]`)) === 1);
  ok("o cartão baixa com o nome de verdade",
     /Procuração/.test((await attr(page, `[data-msg-id="nota-${nota.id}"] [data-nome-ao-baixar]`, "data-nome-ao-baixar")) || ""),
     await attr(page, `[data-msg-id="nota-${nota.id}"] [data-nome-ao-baixar]`, "data-nome-ao-baixar"));
  const textoDaBolha = (await conta(page, `[data-msg-id="nota-${nota.id}"]`))
    ? await page.locator(`[data-msg-id="nota-${nota.id}"]`).first().innerText() : "";
  ok("e o texto continua na bolha, com o rodapé de mensagem interna",
     /Conferido/.test(textoDaBolha) && /Mensagem interna/.test(textoDaBolha), textoDaBolha);

  console.log("\n5. A nota sobe para a ficha do Vantoro, com o id dela");
  const subiu = await esperar(async () => ponte.find((p) => p.corpo && String(p.corpo.id) === String(nota.id)));
  ok("pela rota de sempre, no cadastro da conversa", subiu && subiu.caminho.endsWith("/vantoro/cliente/v-500/nota"),
     JSON.stringify(ponte));
  ok("com o texto da nota (a linha do anexo é a ponte que escreve)",
     subiu && subiu.corpo.texto === "Comprovante que o cliente mandou por e-mail.\nConferido.",
     subiu && JSON.stringify(subiu.corpo));
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  6. A NOTA SÓ COM O ARQUIVO, VÁRIOS ARQUIVOS, E A TROCA PELO NOME
// ==================================================================
if (vale("6")) {
  console.log("\n6. Só o arquivo, dois de uma vez, e a provisória certa trocada");
  const { ctx, page, estouros, ponte } = await abrirPainel();
  await abrirConversa(page);
  await ligarNota(page);
  await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1);
  ok("(escolhi a foto e o áudio de uma vez)", await escolherArquivos(page, [PNG, OGG]));
  ok("a prévia da nota tem os dois", (await attr(page, "[data-previa-anexo]", "data-previa-anexo")) === "nota"
     && /Salvar 2 na nota/.test((await conta(page, "[data-salvar-na-nota]")) ? await page.locator("[data-salvar-na-nota]").first().innerText() : ""));
  // A SUBIDA LENTA POR TAMANHO (300 ms por KB): a foto leva uns 2,5 s e o
  // áudio uns 0,6 s. Um de cada vez, a foto entra primeiro; juntos, o áudio.
  await page.evaluate(() => { globalThis.__SUBIDA_POR_KB = 300; });
  ok("(salvei sem escrever nada)", await clicar(page, "[data-salvar-na-nota]", 300));
  const duas = await esperar(async () => { const n = await notas(page); return n.length === 2 ? n : null; });
  await page.evaluate(() => { globalThis.__SUBIDA_POR_KB = 0; });
  ok("viraram DUAS notas", Boolean(duas), JSON.stringify(await notas(page)));
  const ordenadas = (duas || []).slice().sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
  ok("na ordem da prévia: a foto, depois o áudio",
     ordenadas[0] && ordenadas[0].midia_nome === "print do banco.png" && ordenadas[1] && ordenadas[1].midia_nome === "recado.ogg",
     ordenadas.map((n) => n.midia_nome).join(", "));
  ok("as duas sem texto", ordenadas.every((n) => n.texto === "") && ordenadas.length === 2);
  ok("a foto é imagem e o áudio é áudio",
     ordenadas.length === 2 && ordenadas[0].midia_tipo === "imagem" && ordenadas[1].midia_tipo === "audio");
  ok("(o tempo real trouxe as duas)", (await avisarNotasGravadas(page)) === 2);
  await page.waitForTimeout(500);
  ok("nenhuma provisória sobrou", (await conta(page, '[data-msg-id^="nota-temp-"]')) === 0);
  const foto = ordenadas[0] || {}, audio = ordenadas[1] || {};
  ok("a bolha da foto mostra a imagem", (await conta(page, `[data-msg-id="nota-${foto.id}"] [data-anexo-da-nota="imagem"] img`)) === 1);
  // A NOTA SÓ COM O ARQUIVO NÃO DESENHA O BLOCO DO TEXTO VAZIO: ele é o
  // único `pre-wrap` da bolha fora do arquivo, e vazio ocuparia uma linha.
  const blocosVazios = await page.evaluate((id) => {
    const b = document.querySelector(`[data-msg-id="nota-${id}"]`);
    if (!b) return -1;
    return [...b.querySelectorAll("div")].filter((d) => !d.closest("[data-anexo-da-nota]")
      && getComputedStyle(d).whiteSpace === "pre-wrap").length;
  }, foto.id);
  ok("e não desenha o bloco do texto vazio", blocosVazios === 0, `blocos: ${blocosVazios}`);
  ok("a bolha do áudio tem o tocador", (await conta(page, `[data-msg-id="nota-${audio.id}"] [data-anexo-da-nota="audio"] audio`)) === 1);
  ok("e não oferece transcrever (a ponte transcreve mensagens, e não notas)",
     (await conta(page, `[data-msg-id="nota-${audio.id}"] [data-transcrever]`)) === 0);
  const subiramVazias = await esperar(async () => ponte.filter((p) => p.corpo && p.corpo.texto === "").length === 2);
  ok("as duas subiram à ficha com o texto vazio (a ponte escreve a linha do anexo)", Boolean(subiramVazias),
     JSON.stringify(ponte.map((p) => p.corpo)));

  // A TROCA PELO NOME: uma colega grava, no mesmo instante, uma nota que
  // também é só um arquivo. O aviso dela chega enquanto a minha ainda sobe, e
  // não pode levar a minha provisória — pelo texto, as duas são "".
  await page.evaluate(() => { globalThis.__SUBIDA_POR_KB = 3000; });
  const PDF_LENTO = { name: "contrato assinado.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(1024, 1) };
  await escolherArquivos(page, PDF_LENTO);
  await clicar(page, "[data-salvar-na-nota]", 300);
  ok("(a minha está subindo)", (await conta(page, '[data-msg-id^="nota-temp-"]')) === 1);
  await page.evaluate((c) => {
    const linha = { id: "nota-da-colega", conversa_id: c, texto: "", autor: "Camila Souza", autor_id: "u2",
      criado_em: new Date().toISOString(), midia_url: "https://deposito.bancada/anexos/notas/x/1-y.pdf",
      midia_tipo: "documento", midia_mime: "application/pdf", midia_nome: "outro documento.pdf" };
    globalThis.__TABELAS.notas.push(linha);
    globalThis.__EMITIR("INSERT", "notas", { ...linha });
    (globalThis.__NOTAS_AVISADAS || (globalThis.__NOTAS_AVISADAS = new Set())).add("nota-da-colega");
  }, CONV);
  await page.waitForTimeout(400);
  ok("a nota da colega aparece", (await conta(page, '[data-msg-id="nota-nota-da-colega"]')) === 1);
  ok("e a MINHA provisória continua na tela, subindo",
     (await conta(page, '[data-msg-id^="nota-temp-"]')) === 1);
  await esperar(async () => (await notas(page)).some((n) => n.midia_nome === "contrato assinado.pdf"), 9000);
  await page.evaluate(() => { globalThis.__SUBIDA_POR_KB = 0; });
  ok("(o tempo real trouxe a minha)", (await avisarNotasGravadas(page)) === 1);
  await page.waitForTimeout(400);
  ok("e só ela trocou a minha provisória", (await conta(page, '[data-msg-id^="nota-temp-"]')) === 0);
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  7. ARRASTAR, COLAR, E O LOTE QUE NÃO MISTURA
// ==================================================================
if (vale("7")) {
  console.log("\n7. Arrastar e colar com a nota aberta vão para a nota; o lote não mistura");
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page);
  await ligarNota(page);
  await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1);
  const antesFila = await filaDaConversa(page);
  await soltar(page, "arrastado.png");
  ok("arrastar com a nota aberta abre a prévia DA NOTA",
     (await attr(page, "[data-previa-anexo]", "data-previa-anexo")) === "nota",
     await attr(page, "[data-previa-anexo]", "data-previa-anexo"));
  await fecharPrevia(page);
  await colar(page, "colado.png");
  ok("e colar também", (await attr(page, "[data-previa-anexo]", "data-previa-anexo")) === "nota");
  await fecharPrevia(page);
  ok("e nada foi ao cliente", (await filaDaConversa(page)) === antesFila);

  // O LOTE DO CLIENTE NÃO RECEBE ARQUIVO DA NOTA: com a prévia aberta, a
  // caixa vira nota por um clique que passa por baixo (o botão é chamado
  // direto), e o arquivo seguinte é recusado, com o porquê.
  ok("(fechei a nota)", await desligarNota(page));
  await soltar(page, "para o cliente.png");
  ok("(a prévia do cliente abriu)", (await attr(page, "[data-previa-anexo]", "data-previa-anexo")) === "mensagem");
  await page.evaluate(() => document.querySelector("[data-nota-interna]")?.click());
  await page.waitForTimeout(700);
  await limparFilme(page);
  await soltar(page, "para a nota.png");
  const filme = await oFilme(page);
  ok("o arquivo da nota não entra no lote do cliente, e a tela diz por quê",
     /anexos para o cliente/.test(filme), filme);
  const nomes = (await conta(page, "[data-previa-anexo] [title]"))
    ? await page.evaluate(() => [...document.querySelectorAll("[data-previa-anexo] button[title]")].map((b) => b.title)) : [];
  ok("e a prévia continua a do cliente, com um arquivo só",
     (await attr(page, "[data-previa-anexo]", "data-previa-anexo")) === "mensagem" && !nomes.some((t) => /Salvar/.test(t)),
     nomes.join(", "));
  await fecharPrevia(page);
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  8. A NOTA COM ARQUIVO PODE FICAR SEM TEXTO
// ==================================================================
if (vale("8")) {
  console.log("\n8. Editar: a nota com arquivo pode ficar sem texto, e a sem arquivo não");
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page);
  await ligarNota(page);
  await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1);
  await escolherArquivos(page, PDF);
  await escreverNaLegenda(page, "texto que vou apagar");
  await clicar(page, "[data-salvar-na-nota]", 300);
  const comArquivo = await esperar(async () => (await notas(page))[0] || null);
  await avisarNotasGravadas(page);
  await page.waitForTimeout(400);
  const bolha = page.locator(`[data-msg-id="nota-${comArquivo && comArquivo.id}"]`);
  ok("(a nota com arquivo está na tela)", (await bolha.count()) === 1);
  if (await bolha.count()) {
    await bolha.first().hover();
    const editar = bolha.locator('button[title="Editar nota"]');
    ok("(o lápis apareceu)", (await editar.count()) === 1);
    if (await editar.count()) {
      await editar.first().click();
      await page.waitForTimeout(500);
      const campo = page.locator('textarea[data-campo="nota"]');
      if (await campo.count()) { await campo.first().fill(""); await campo.first().press("Enter"); }
      await page.waitForTimeout(900);
      const depois = (await notas(page)).find((n) => n.id === comArquivo.id) || {};
      ok("apagar o texto da nota com arquivo é aceito", depois.texto === "", JSON.stringify(depois.texto));
      ok("e o arquivo continua nela", depois.midia_url === comArquivo.midia_url);
    }
  }
  // A NOTA SEM ARQUIVO, VAZIA, CONTINUA RECUSADA.
  await ligarNota(page);
  const campo = page.locator('textarea[data-campo="nota"]');
  if (await campo.count()) { await campo.first().fill("só texto"); await campo.first().press("Enter"); }
  const soTexto = await esperar(async () => (await notas(page)).find((n) => n.texto === "só texto") || null);
  await avisarNotasGravadas(page);
  await page.waitForTimeout(400);
  const bolha2 = page.locator(`[data-msg-id="nota-${soTexto && soTexto.id}"]`);
  if (await bolha2.count()) {
    await bolha2.first().hover();
    await bolha2.locator('button[title="Editar nota"]').first().click().catch(() => {});
    await page.waitForTimeout(500);
    await limparFilme(page);
    if (await campo.count()) { await campo.first().fill(""); await campo.first().press("Enter"); }
    await page.waitForTimeout(700);
    const filme = await oFilme(page);
    ok("a nota sem arquivo não fica vazia", /não pode ficar vazia/.test(filme), filme);
    ok("e continua com o texto no banco", ((await notas(page)).find((n) => n.id === soTexto.id) || {}).texto === "só texto");
  } else ok("(a nota de texto está na tela)", false);
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  9. O DEPÓSITO QUE RECUSA
// ==================================================================
if (vale("9")) {
  console.log("\n9. O depósito que recusa é dito, e nada é salvo");
  const { ctx, page, estouros, ponte } = await abrirPainel();
  await abrirConversa(page);
  await ligarNota(page);
  await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1);
  await page.evaluate(() => { globalThis.__SUBIDA_FALHA = true; });
  await escolherArquivos(page, PDF);
  await escreverNaLegenda(page, "não vai ficar");
  await limparFilme(page);
  await clicar(page, "[data-salvar-na-nota]", 300);
  const filme = await esperar(async () => { const f = await oFilme(page); return /não foi salva/.test(f) ? f : null; });
  ok("a frase diz qual arquivo, que é grande demais, e que a nota não foi salva",
     filme && /Procuração/.test(filme) && /grande demais/.test(filme) && /413/.test(filme), filme || (await oFilme(page)));
  ok("nenhuma nota foi gravada", (await notas(page)).length === 0);
  ok("a bolha provisória saiu", (await conta(page, '[data-msg-id^="nota-temp-"]')) === 0);
  ok("e nada subiu para a ficha", ponte.length === 0, JSON.stringify(ponte));
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  10. SEM O 053, A NOTA CONTINUA SÓ TEXTO
// ==================================================================
if (vale("10")) {
  console.log("\n10. Sem o 053, a nota continua só texto, como antes");
  const { ctx, page, estouros } = await abrirPainel({ sem053: true });
  await abrirConversa(page);
  ok("na mensagem, o clipe de sempre continua", (await conta(page, '[data-anexar="mensagem"]')) === 1);
  ok("(a nota abriu)", await ligarNota(page));
  await page.waitForTimeout(800);
  ok("na nota, não há clipe", (await conta(page, '[data-anexar="nota"]')) === 0
     && (await conta(page, '[title="Anexar arquivo"]')) === 0);
  const antesFila = await filaDaConversa(page);
  await limparFilme(page);
  await soltar(page, "arrastado.png");
  ok("arrastar com a nota aberta não abre prévia nenhuma", (await conta(page, "[data-previa-anexo]")) === 0);
  const filme = await oFilme(page);
  ok("e a tela diz o que falta e o que fazer", /atualização do banco/.test(filme) && /Feche a nota/.test(filme), filme);
  await limparFilme(page);
  await colar(page, "colado.png");
  ok("colar também é recusado, com a mesma frase",
     (await conta(page, "[data-previa-anexo]")) === 0 && /atualização do banco/.test(await oFilme(page)));
  ok("e nada foi ao cliente", (await filaDaConversa(page)) === antesFila);
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  11. A PERGUNTA QUE FALHA MANTÉM O CLIPE; A GRAVAÇÃO QUE DESCOBRE O TIRA
// ==================================================================
if (vale("11")) {
  console.log("\n11. A pergunta que falha por outro motivo mantém o clipe; a gravação que descobre o tira");
  const { ctx, page, estouros } = await abrirPainel({ quebrarALeitura: true });
  await abrirConversa(page);
  await ligarNota(page);
  ok("com a leitura de notas falhando, o clipe da nota fica oferecido",
     await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1));
  // E O BANCO, NA VERDADE, NÃO TEM O 053.
  await page.evaluate((m) => { globalThis.__SEM_COLUNAS = { notas: m }; }, MIDIA);
  await escolherArquivos(page, PDF);
  await limparFilme(page);
  await clicar(page, "[data-salvar-na-nota]", 300);
  const filme = await esperar(async () => { const f = await oFilme(page); return /atualização do banco/.test(f) ? f : null; });
  ok("a gravação recusada pela coluna que falta diz o que falta", Boolean(filme), await oFilme(page));
  ok("nenhuma nota foi gravada", (await notas(page)).length === 0);
  ok("e o clipe da nota sai", await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 0));
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  12. NO CELULAR
// ==================================================================
if (vale("12")) {
  console.log("\n12. No celular, o clipe da nota tem o alvo de dedo");
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  await abrirConversa(page);
  await ligarNota(page);
  const ap = await esperar(async () => (await conta(page, '[data-anexar="nota"]')) === 1);
  ok("o clipe da nota aparece no celular", ap);
  const caixa = ap ? await page.locator('[data-anexar="nota"]').first().boundingBox() : null;
  ok("com 40 pontos de alvo", caixa && caixa.width >= 40 && caixa.height >= 40, JSON.stringify(caixa));
  ok("e dentro da tela", caixa && caixa.x >= 0 && caixa.x + caixa.width <= 390, JSON.stringify(caixa));
  ok("nenhum erro de JavaScript", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

ok("as cenas pedidas em CENAS existem nesta prova", !CENAS.length || CENAS.every((c) => cenasDaProva.has(c)),
   `não existem: ${CENAS.filter((c) => !cenasDaProva.has(c)).join(", ")}`);
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
