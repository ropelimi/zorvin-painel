// A PRÉVIA DO PDF, COMO A DAS IMAGENS (29/10).
//
// Pedido do Rodrigo: "Para os arquivos em PDF recebidos, dá para ter uma pré
// visualização igual as imagens? Se sim, faça."
//
// A imagem aparece na conversa como foto, e o clique a abre grande. O PDF
// aparecia como um cartão com o nome — e só no Chrome com o leitor de PDF
// ligado ganhava uma faixa de 150px de um `<iframe>`. Agora a primeira página
// é desenhada pelo pdf.js e aparece como uma foto, e o clique abre o PDF
// inteiro numa janela por cima.
//
// OS PDFs SÃO MONTADOS AQUI, e servidos por um depósito de mentira noutro
// endereço, como o de verdade (a régua de `o-arquivo-baixa-com-o-nome`): o
// pdf.js busca o arquivo pela rede, e servi-lo de `data:` pularia o caminho
// que vai para o ar.
//
// O QUE ELA GUARDA:
//
//   1. a biblioteca só vem quando há um PDF na conversa — e vem À PARTE do
//      painel, e não dentro dele;
//   2. a primeira página aparece DESENHADA (pixels escuros na foto, e não um
//      quadro branco), no tamanho da imagem da conversa, e a linha diz
//      quantas páginas o PDF tem;
//   3. a página digitalizada também (JPEG 2000: o decodificador em
//      WebAssembly que o site serve em /pdfjs/wasm/ — sem ele, ela sai em
//      branco e ninguém liga uma coisa à outra);
//   4. o PDF que o depósito serve sem tipo também ganha a foto, e abrir a
//      conversa não baixa nada, nem cria `<iframe>` nenhum;
//   5. o que não dá não vira moldura vazia: PDF quebrado, com senha, grande
//      demais (sem nem pedir o arquivo) e o que sumiu do depósito ficam com o
//      cartão de sempre; e o que não é PDF não ganha foto;
//   6. o PDF grande, num depósito que deixa ler por pedaços, não é baixado
//      inteiro para a foto;
//   7. o clique na foto abre o PDF em tela cheia, com as páginas desenhadas,
//      e o "Baixar" de lá salva com o nome; Esc e o clique no escuro fecham,
//      e a conversa continua aberta; o clique na página não fecha;
//   8. a linha do nome continua BAIXANDO, e não abrindo; no modo de seleção a
//      foto não abre nada; a seta de opções continua por cima da foto;
//   9. no documento de quarenta páginas, as páginas longe da vista são
//      apagadas — senão um contrato longo encheria a memória;
//  10. o que não abre na janela é dito, com as duas saídas;
//  11. a biblioteca que não carregou deixa o cartão de sempre, que baixa — e
//      nada guarda a falha além da página: recarregada, a foto volta;
//  12. no celular, a foto e a janela cabem na tela.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// ---------------------------------------------------------------- os PDFs
//
// Um PDF de verdade, escrito à mão: catálogo, árvore de páginas, uma fonte
// padrão, e para cada página o conteúdo (e, se pedida, uma imagem). O índice
// (`xref`) leva as posições de verdade — sem ele o pdf.js reconstrói o arquivo
// lendo tudo, e a prova dos pedaços mediria outra coisa.
function montarPdf(paginas, { trancado = false } = {}) {
  const objs = [];
  const novo = (b) => { objs.push(b); return objs.length; };
  const catalogo = novo(null);
  const arvore = novo(null);
  const fonte = novo(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  const filhas = [];
  for (const p of paginas) {
    let recursos = `/Font << /F1 ${fonte} 0 R >>`;
    if (p.imagem) {
      const { largura, altura, bytes, filtro } = p.imagem;
      const im = novo(Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${largura} /Height ${altura} /ColorSpace /DeviceGray`
          + ` /BitsPerComponent 8${filtro ? ` /Filter /${filtro}` : ""} /Length ${bytes.length} >>\nstream\n`),
        bytes, Buffer.from("\nendstream")]));
      recursos += ` /XObject << /Im0 ${im} 0 R >>`;
    }
    const conteudo = Buffer.from(p.conteudo, "latin1");
    const c = novo(Buffer.concat([Buffer.from(`<< /Length ${conteudo.length} >>\nstream\n`), conteudo,
                                  Buffer.from("\nendstream")]));
    filhas.push(novo(Buffer.from(`<< /Type /Page /Parent ${arvore} 0 R /MediaBox [0 0 ${p.largura} ${p.altura}]`
      + ` /Resources << ${recursos} >> /Contents ${c} 0 R >>`)));
  }
  objs[catalogo - 1] = Buffer.from(`<< /Type /Catalog /Pages ${arvore} 0 R >>`);
  objs[arvore - 1] = Buffer.from(`<< /Type /Pages /Kids [${filhas.map((f) => `${f} 0 R`).join(" ")}] /Count ${filhas.length} >>`);
  // TRANCADO: o dicionário de cifra de um PDF com senha. A senha vazia não
  // confere com o /U, e o pdf.js pede a senha — que é o que um PDF de
  // verdade com senha faz. O conteúdo nem chega a ser lido.
  let cifra = "";
  if (trancado) {
    const enc = novo(Buffer.from("<< /Filter /Standard /V 1 /R 2 /P -44"
      + ` /O <${"4f".repeat(32)}> /U <${"55".repeat(32)}> >>`));
    cifra = ` /Encrypt ${enc} 0 R /ID [<${"ab".repeat(16)}> <${"ab".repeat(16)}>]`;
  }
  const partes = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let pos = partes[0].length;
  const posicoes = [];
  objs.forEach((o, i) => {
    posicoes.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
    partes.push(b);
    pos += b.length;
  });
  partes.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    + posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")
    + `trailer\n<< /Size ${objs.length + 1} /Root ${catalogo} 0 R${cifra} >>\nstartxref\n${pos}\n%%EOF\n`));
  return Buffer.concat(partes);
}
/** Uma página de documento: o título (em Latin-1, com "Ç" e "Ã"), barras no
 *  lugar das linhas de texto, e uma barra preta no pé — os pixels escuros
 *  que qualquer navegador desenha, com ou sem a fonte. */
function paginaDeTexto(titulo, n, largura = 595, altura = 842) {
  const linhas = Array.from({ length: 14 }, (_, j) =>
    `0.25 g 60 ${altura - 200 - j * 26} ${largura - 160 - (j % 4) * 50} 9 re f`).join("\n");
  return { largura, altura, conteudo: `BT /F1 40 Tf 60 ${altura - 120} Td (${titulo}) Tj ET\n`
    + `BT /F1 14 Tf 60 ${altura - 160} Td (Pagina ${n}) Tj ET\n${linhas}\n0 g 60 70 ${largura - 120} 44 re f` };
}
const PROCURACAO = "PROCURA\\307\\303O";
const TRES = montarPdf([1, 2, 3].map((n) => paginaDeTexto(PROCURACAO, n)));
const PAISAGEM = montarPdf([paginaDeTexto("PLANILHA", 1, 842, 595)]);
// A PÁGINA DIGITALIZADA: uma imagem em JPEG 2000, como sai de um digitalizador.
// 1 KB de código, feito com o OpenJPEG (Pillow) a partir de um quadro branco
// com barras pretas: 31,6% dos pixels são escuros.
const JPX = Buffer.from("/0//UQApAAAAAAEsAAABqAAAAAAAAAAAAAABLAAAAagAAAAAAAAAAAABBwEB/1IADAAAAAEABQQEAAH/XAATQEBISFBISFBISFBISFBISFD/ZAAlAAFDcmVhdGVkIGJ5IE9wZW5KUEVHIHZlcnNpb24gMi41LjT/kAAKAAAAAAPHAAH/k99FUA542DOQjZ5eI+lf4jEVXxUk/Jsa7NIPNpah5sUmkUD2d+PuIdHtpYWT145wVKrVjz1/rBLNIgDp3o9DHzzz8eDtFZErXcjFTPngzXhJTn0pqk1kXs+Q3fRRI+I6CgVFrC1VFDDMXTbtd5c9YEaULf9DCXCMPMTaGnuBqGueJOKmWt1Kt5doTf4+oThSbOJfyvPzgGUc6vXC5wBS08u3MGjCGghig6qnJIKJ1hHIgM9DWKmMLnnBjA1cBzED6TYpFA4dwdB1vdlkwkWMliDJrvbGr3sj508faM+GlvjqUdUAGHMYTyIFUuQLByaT3thYYb1xgf8xVPy2x2ZVKlfgmgG2/w0NJ723w+myAUTaMzp8DjVSGfUXSmLO7HkhyzJ3tBthw6Bk26iC2NdbkX0qhggPS6VSUHhWIkjB/2xuv9NABvxpZRab/r8WlUfOPtQUSQ3gJsE+Y9a8LozSxBzoVMGyFvUp3SvZSfT07M+C1nxXUI/as5faLaUZPoae79rcK87X7a3RU/FbuNiRVWtSvNuRh9Uvo4OArB7UGHhLgDQ3PZVytBYlvtYG5xMN0431wzvbsm0Agvw75qW8aYZHbp+1vbHJQY0mY7Vcyffsl3H0swuI36pbYx6uGbvkJblvcm2IH9AL7tUDa715BLUjXWM+06gAnKi2raAp9Sh4hvk72l0zfPq4U3sJYnpoorr0kQoHjdPd8qndr7i355Z8X5RyZ7S+oeu0wLM7EKGuNqEM9jWoG35tuPbqvY3m4XOhUOxrL9G/bHn7zO2M+iiCc8prCol7VIEuHugZKN0UtwFeGbT26i535vTBhGb7SSy4a4C1N4+MJ94AOqBBJqN3GF9KjfQhUXZLasSHv7TWcRetNr1I4R/XMcaoRYo59pI9rli7CuBEKU89oF//evDwZP4LS7SlChrU/Xbz4p+J8d4t+N8WOfGfvDvxvlH8FD4n8o/goPxIAM8l4qfIWjVS5lmmNWCVhGFnisu4TWk4WFe02NhPOIkgoMqdoZXCAtWJ2u/8QvIU3EwtT6qk3KOfPaY06TZCnpJ2k8PIz4yhO/c4bN5RTLgbzJ3hO/t/mUvCGevX+d+Y6IOzBU3kGGGvbMFfuegE77RGwL8tLh/QU+oWKAKuMoTvB+AxgidpmoYgs0fEJ6rsGmg9p6kA75eFMRZADCTkKbRptP2IFuJJ5hO/zKDsbZaXD+gp9QugsQ8obvCQrzcKMlwz+umMCa6iMQI8+6PETQC+5XwLIAYI4rv0abT9iFD+/9k=", "base64");
const DIGITALIZADO = montarPdf([{ largura: 595, altura: 842, conteudo: "q 595 0 0 842 0 0 cm /Im0 Do Q",
                                  imagem: { largura: 300, altura: 424, bytes: JPX, filtro: "JPXDecode" } }]);
// O CONTRATO DE QUARENTA PÁGINAS, com 2,2 MB de imagem na página 20 — no MEIO
// do arquivo, entre a primeira página e o índice. Os bytes da imagem são
// sorteados e não comprimem: é o que faz o arquivo pesar.
let semente = 7;
const sorteados = Buffer.alloc(1500 * 1500);
for (let i = 0; i < sorteados.length; i++) { semente = (semente * 1103515245 + 12345) >>> 0; sorteados[i] = semente >>> 24; }
const QUARENTA = montarPdf(Array.from({ length: 40 }, (_, i) => {
  const p = paginaDeTexto("CONTRATO", i + 1);
  return i === 19 ? { ...p, conteudo: `${p.conteudo}\nq 400 0 0 400 100 200 cm /Im0 Do Q`,
                      imagem: { largura: 1500, altura: 1500, bytes: sorteados } } : p;
}));
const COM_SENHA = montarPdf([paginaDeTexto("SIGILOSO", 1)], { trancado: true });
const QUEBRADO = Buffer.from("%PDF-1.4\nisto nao e um PDF de verdade, so o comeco de um\n");
const DOCX = Buffer.from("PK\u0003\u0004 um documento do Word de mentira");

// ---------------------------------------------------------------- o depósito
const HOST = "https://projeto-de-mentira.supabase.co";
const DEPOSITO = `${HOST}/storage/v1/object/public/anexos`;
const ARQUIVOS = {
  "/recebidos/PDF1TRES.pdf": { corpo: TRES, tipo: "application/pdf" },
  "/recebidos/PDF2SEMTIPO.pdf": { corpo: TRES, tipo: "application/octet-stream" },
  "/recebidos/PDF3PAISAGEM.pdf": { corpo: PAISAGEM, tipo: "application/pdf" },
  "/recebidos/PDF4DIGITAL.pdf": { corpo: DIGITALIZADO, tipo: "application/pdf" },
  // ESTE DEIXA LER POR PEDAÇOS (`Accept-Ranges`), como um servidor que
  // atende `Range`. Os outros respondem sempre o arquivo inteiro.
  "/recebidos/PDF5QUARENTA.pdf": { corpo: QUARENTA, tipo: "application/pdf", pedacos: true },
  "/recebidos/PDF6SENHA.pdf": { corpo: COM_SENHA, tipo: "application/pdf" },
  "/recebidos/PDF7QUEBRADO.pdf": { corpo: QUEBRADO, tipo: "application/pdf" },
  // O DEPÓSITO DIZ 30 MB. O corpo é o de três páginas: se alguém pedir o
  // arquivo, a foto sai — e é isso que a conferência pega.
  "/recebidos/PDF8GRANDE.pdf": { corpo: TRES, tipo: "application/pdf", tamanhoDito: 30 * 1024 * 1024 },
  "/recebidos/DOC9CONTRATO.docx": { corpo: DOCX,
    tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

const nav = await abrirNavegador({ env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });

/** A conversa que o painel abre primeiro — descoberta, e não escolhida a dedo. */
async function primeiraConversa() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-conversa-id]")].map((e) => e.getAttribute("data-conversa-id")));
  await ctx.close();
  return [ids[0], ids.find((x) => x !== ids[0])];
}
const [ALVO, OUTRA] = await primeiraConversa();
ok("achei a conversa da prova, e uma segunda para ir e voltar", Boolean(ALVO && OUTRA));

const minutosAtras = (n) => new Date(Date.now() - n * 60e3).toISOString();
const doc = (id, caminho, nome, mime, min) => ({
  id, conversa_id: ALVO, origem: "contato", tipo: "documento", texto: null, enviado_por: null,
  enviado_por_id: null, id_uazapi: `UAZ-${id}`, midia_nome: nome, midia_mime: mime,
  midia_url: `${DEPOSITO}${caminho}`, criado_em: minutosAtras(min),
});
const SEMENTE = {
  mensagens: [
    doc("pdf-sumiu", "/recebidos/PDF0SUMIU.pdf", "Contrato que sumiu 4411.pdf", "application/pdf", 20),
    doc("pdf-quebrado", "/recebidos/PDF7QUEBRADO.pdf", "Arquivo quebrado 2020.pdf", "application/pdf", 19),
    doc("pdf-senha", "/recebidos/PDF6SENHA.pdf", "Extrato com senha 3030.pdf", "application/pdf", 18),
    doc("pdf-grande", "/recebidos/PDF8GRANDE.pdf", "Processo inteiro 5050.pdf", "application/pdf", 17),
    doc("doc-word", "/recebidos/DOC9CONTRATO.docx", "Minuta do acordo 6060.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 16),
    doc("pdf-quarenta", "/recebidos/PDF5QUARENTA.pdf", "Contrato de 40 páginas 7070.pdf", "application/pdf", 15),
    doc("pdf-digital", "/recebidos/PDF4DIGITAL.pdf", "RG digitalizado 8080.pdf", "application/pdf", 14),
    doc("pdf-paisagem", "/recebidos/PDF3PAISAGEM.pdf", "Planilha deitada 9090.pdf", "application/pdf", 13),
    doc("pdf-sem-tipo", "/recebidos/PDF2SEMTIPO.pdf", "Comprovante sem tipo 1212.pdf", "application/octet-stream", 12),
    doc("pdf-tres", "/recebidos/PDF1TRES.pdf", "0001.01 - Procuração", "application/pdf", 11),
    { id: "pdf-texto-fim", conversa_id: ALVO, origem: "contato", tipo: "texto", texto: "Segue a procuração assinada 4242",
      id_uazapi: "UAZ-pdf-texto-fim", criado_em: minutosAtras(10) },
    // UM PDF QUE NÓS MANDAMOS: é o "Apagar" do menu dele que liga a seleção.
    { ...doc("pdf-nosso", "/recebidos/PDF1TRES.pdf", "Acordo para assinar 5521.pdf", "application/pdf", 9),
      origem: "advogado", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
  ],
};

// O que a biblioteca do pdf.js é, no servidor de desenvolvimento e no build.
const DA_BIBLIOTECA = /pdfjs-dist\/legacy\/build\/pdf\.mjs|\/assets\/pdf-[\w-]+\.js$/;
// O trabalhador é empacotado à parte (`src/trabalhadorDoPdf.js`). No servidor
// de desenvolvimento, o painel pede na abertura um módulo de uma linha com o
// ENDEREÇO dele (`?worker&url`), que não é o trabalhador: este só vem com
// `?worker_file`, e no build é o arquivo `trabalhadorDoPdf-…js`.
const DO_TRABALHADOR = /trabalhadorDoPdf[^?]*(\?worker_file|$)|pdf\.worker/;
const ehDoPdfjs = (u) => DA_BIBLIOTECA.test(u.pathname) || DO_TRABALHADOR.test(u.pathname + u.search);

async function abrirPainel({ largura = 1400, altura = 900, bloquearBiblioteca = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, acceptDownloads: true });
  const pedidos = [];
  const cfg = { sumir: new Set(), trocar: new Map(), atrasoGet: 0, noAr: 0, maxNoAr: 0 };
  await ctx.route(new RegExp("^" + HOST.replace(/[.]/g, "\\.") + "/"), async (route) => {
    const req = route.request();
    const caminho = decodeURIComponent(new URL(req.url()).pathname.replace("/storage/v1/object/public/anexos", ""));
    const faixa = req.headers()["range"] || null;
    pedidos.push({ metodo: req.method(), caminho, faixa });
    const CORS = { "access-control-allow-origin": "*", "cache-control": "no-store",
                   "access-control-expose-headers": "Accept-Ranges, Content-Range, Content-Length, Content-Disposition" };
    const a = cfg.sumir.has(caminho) ? null
            : cfg.trocar.has(caminho) ? { ...ARQUIVOS[caminho], corpo: cfg.trocar.get(caminho) } : ARQUIVOS[caminho];
    if (!a) {
      return route.fulfill({ status: 404, contentType: "application/json", headers: CORS,
        body: JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found" }) });
    }
    const cab = { ...CORS, "content-type": a.tipo, ...(a.pedacos ? { "accept-ranges": "bytes" } : {}) };
    if (req.method() === "GET" && cfg.atrasoGet) {
      // QUANTOS PDFs SÃO BAIXADOS AO MESMO TEMPO — a fila das miniaturas.
      cfg.noAr++;
      cfg.maxNoAr = Math.max(cfg.maxNoAr, cfg.noAr);
      await new Promise((r) => setTimeout(r, cfg.atrasoGet));
      cfg.noAr--;
    }
    if (req.method() === "HEAD") {
      return route.fulfill({ status: 200, headers: { ...cab, "content-length": String(a.tamanhoDito || a.corpo.length) }, body: "" });
    }
    const m = a.pedacos && faixa && /^bytes=(\d+)-(\d*)$/.exec(faixa);
    if (m) {
      const ini = Number(m[1]);
      const fim = Math.min(m[2] ? Number(m[2]) : a.corpo.length - 1, a.corpo.length - 1);
      return route.fulfill({ status: 206, headers: { ...cab, "content-range": `bytes ${ini}-${fim}/${a.corpo.length}` },
                             body: a.corpo.subarray(ini, fim + 1) });
    }
    return route.fulfill({ status: 200, headers: cab, body: a.corpo });
  });
  cfg.bloquear = bloquearBiblioteca;
  const bloqueados = [];
  await ctx.route(ehDoPdfjs, (route) => {
    if (!cfg.bloquear) return route.continue();
    const u = new URL(route.request().url());
    bloqueados.push(u.pathname + u.search);
    return route.fulfill({ status: 503, body: "fora do ar" });
  });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const baixados = [];
  page.on("download", (d) => baixados.push(d.suggestedFilename()));
  const daBiblioteca = [];
  const doApoio = [];
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (ehDoPdfjs(u)) daBiblioteca.push(u.pathname + u.search);
    if (u.pathname.startsWith("/pdfjs/")) doApoio.push({ caminho: u.pathname, status: r.status(),
                                                         tipo: r.headers()["content-type"] || "" });
  });
  await page.addInitScript(({ semente }) => {
    globalThis.__SEMENTE = semente;
    globalThis.__DEPOSITO_COM_ENDERECO = true;
    globalThis.__ABERTAS = [];
    const abrir = window.open.bind(window);
    window.open = (...a) => { globalThis.__ABERTAS.push(String(a[0])); return abrir(...a); };
  }, { semente: SEMENTE });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(1000);
  return { ctx, page, estouros, baixados, pedidos, daBiblioteca, doApoio, cfg, bloqueados };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova
 *  inteira depois de 30 segundos, e prova que estoura não diz QUAL
 *  conferência viu o defeito. */
async function clicar(page, sel, opcoes = {}) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().scrollIntoViewIfNeeded({ timeout: 3000 }); } catch (_) {}
  try { await l.first().click({ timeout: 3000, ...opcoes }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
async function abrirConversa(page, id) {
  await page.locator(`[data-conversa-id="${id}"]`).first().click();
  await page.waitForTimeout(1200);
}
/** Rola até cada documento, como quem lê a conversa: é perto da tela que a
 *  foto nasce. E espera as fotos que estão sendo desenhadas. */
async function lerAteOFim(page) {
  const docs = page.locator("[data-doc-tipo]");
  const n = await docs.count();
  for (let i = 0; i < n; i++) {
    await docs.nth(i).scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(350);
  }
  const fim = Date.now() + 8000;
  while (Date.now() < fim
         && (await page.locator('[data-previa-do-pdf="esperando"]').count()) > 0) {
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
  return n;
}
const naBolha = (id) => `[data-msg-id="${id}"]`;
const estadoDaFoto = (page, id) =>
  page.locator(`${naBolha(id)} [data-previa-do-pdf]`).first().getAttribute("data-previa-do-pdf").catch(() => null);
const linhaDoTipo = (page, id) =>
  page.locator(`${naBolha(id)} [data-doc-tipo]`).first().innerText().catch(() => "");
/** A parte escura de uma imagem ou tela de pintura: 0 é tudo branco. */
const escuro = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  let w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.drawImage(el, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 300) n++;
  return n / (d.length / 4);
}, sel);
const caixaDe = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);
const pedidosDe = (pedidos, caminho) => pedidos.filter((p) => p.caminho === caminho);
const visualizador = (page) => page.evaluate(() => {
  const v = document.querySelector("[data-visualizador-de-pdf]");
  if (!v) return null;
  return { estado: v.getAttribute("data-visualizador-de-pdf"),
           nome: v.querySelector("[data-nome-do-pdf]")?.innerText || "",
           paginas: v.querySelector("[data-paginas-do-pdf]")?.getAttribute("data-paginas-do-pdf") || null,
           desenhadas: [...v.querySelectorAll('[data-pagina-do-pdf][data-estado="pronta"]')]
             .map((p) => Number(p.getAttribute("data-pagina-do-pdf"))),
           lugares: v.querySelectorAll("[data-pagina-do-pdf]").length };
});
async function esperarVisualizador(page, estado, ate = 8000) {
  const fim = Date.now() + ate;
  let v = null;
  while (Date.now() < fim) {
    v = await visualizador(page);
    if (v && v.estado === estado && (estado !== "pronto" || v.desenhadas.length)) return v;
    await page.waitForTimeout(150);
  }
  return v;
}

// ======================================================================
const { ctx, page, estouros, baixados, pedidos, daBiblioteca, doApoio, cfg } = await abrirPainel();

console.log("\n1. A biblioteca só vem quando há um PDF na conversa, e vem à parte");
{
  ok("o painel aberto, sem conversa nenhuma, não pediu o pdf.js", daBiblioteca.length === 0,
     daBiblioteca.join(", "));
  await abrirConversa(page, ALVO);
  // ANTES DE ROLAR: os PDFs lá do alto da conversa ainda não chegaram perto
  // da tela, e guardam o lugar de uma página A4 — senão a conversa pularia
  // 320px no meio da leitura, quando a foto chegasse.
  const lugar = await page.evaluate(() => {
    const el = document.querySelector('[data-previa-do-pdf="esperando"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  ok("o PDF que ainda não chegou perto da tela guarda o lugar de uma página A4",
     lugar && lugar.w >= 200 && lugar.w <= 230 && Math.abs(lugar.h - lugar.w * 297 / 210) <= 3, JSON.stringify(lugar));
  const n = await lerAteOFim(page);
  ok("a conversa tem os onze documentos da prova", n >= 11, `vi ${n}`);
  ok("aberta a conversa com PDFs, a biblioteca veio — num arquivo próprio, e não dentro do painel",
     daBiblioteca.some((u) => DA_BIBLIOTECA.test(u)), daBiblioteca.join(", ") || "nenhum pedido");
  ok("e o trabalhador dela também", daBiblioteca.some((u) => DO_TRABALHADOR.test(u)), daBiblioteca.join(", "));
}

console.log("\n2. A primeira página aparece desenhada, no tamanho da imagem da conversa");
{
  ok("o PDF de três páginas ganhou a foto", (await estadoDaFoto(page, "pdf-tres")) === "pronta",
     String(await estadoDaFoto(page, "pdf-tres")));
  const e = await escuro(page, `${naBolha("pdf-tres")} [data-previa-do-pdf] img`);
  ok("e a foto é a página desenhada, e não um quadro branco", e !== null && e > 0.02, `escuro: ${e}`);
  const c = await caixaDe(page, `${naBolha("pdf-tres")} [data-previa-do-pdf] img`);
  ok("a página A4 aparece em pé, com até 260 de largura e 320 de altura, como a imagem",
     c && c.w <= 261 && c.h <= 321 && c.h > c.w * 1.3 && c.h >= 300, JSON.stringify(c));
  const p = await caixaDe(page, `${naBolha("pdf-paisagem")} [data-previa-do-pdf] img`);
  ok("a página deitada aparece deitada, com os 260 de largura", p && p.w >= 255 && p.w <= 261 && p.h < p.w * 0.8,
     JSON.stringify(p));
  ok("a linha diz quantas páginas o PDF tem: 'PDF · 3 páginas'",
     /PDF · 3 páginas/.test(await linhaDoTipo(page, "pdf-tres")), await linhaDoTipo(page, "pdf-tres"));
  ok("e '1 página', no singular", /PDF · 1 página$/.test((await linhaDoTipo(page, "pdf-paisagem")).trim()),
     await linhaDoTipo(page, "pdf-paisagem"));
  ok("e '40 páginas' no contrato", /40 páginas/.test(await linhaDoTipo(page, "pdf-quarenta")),
     await linhaDoTipo(page, "pdf-quarenta"));
  ok("o contrato de 40 páginas também ganhou a foto", (await estadoDaFoto(page, "pdf-quarenta")) === "pronta");
}

console.log("\n3. A página digitalizada (JPEG 2000) também, pelo decodificador do site");
{
  ok("o RG digitalizado ganhou a foto", (await estadoDaFoto(page, "pdf-digital")) === "pronta",
     String(await estadoDaFoto(page, "pdf-digital")));
  const e = await escuro(page, `${naBolha("pdf-digital")} [data-previa-do-pdf] img`);
  ok("e a imagem digitalizada aparece nela (as barras pretas), e não a página em branco",
     e !== null && e > 0.1, `escuro: ${e}`);
  const wasm = doApoio.find((x) => x.caminho === "/pdfjs/wasm/openjpeg.wasm");
  // O TIPO, e não só o 200: um endereço que o site não tem devolve a página
  // do painel com 200 (é assim que um site de uma página só responde), e o
  // decodificador "chegaria" sem ser decodificador.
  ok("o decodificador veio do próprio site, em /pdfjs/wasm/, como WebAssembly",
     wasm && wasm.status === 200 && /wasm/.test(wasm.tipo), JSON.stringify(doApoio));
}

console.log("\n4. O PDF sem tipo também, e abrir a conversa não baixa nada");
{
  ok("o PDF que o depósito serve como octet-stream ganhou a foto",
     (await estadoDaFoto(page, "pdf-sem-tipo")) === "pronta", String(await estadoDaFoto(page, "pdf-sem-tipo")));
  ok("abrir a conversa e ler até o fim não baixou nada", baixados.length === 0, JSON.stringify(baixados));
  const quadros = await page.evaluate(() => document.querySelectorAll("[data-msg-id] iframe").length);
  ok("e nenhuma bolha tem `<iframe>` — era o iframe que baixava sozinho", quadros === 0, `${quadros} iframes`);
}

console.log("\n5. O que não dá fica com o cartão de sempre, sem moldura vazia");
{
  for (const [id, oque] of [["pdf-quebrado", "o PDF quebrado"], ["pdf-senha", "o PDF com senha"],
                            ["pdf-grande", "o PDF de 30 MB"], ["pdf-sumiu", "o PDF que sumiu do depósito"]]) {
    const foto = await estadoDaFoto(page, id);
    const nome = await page.locator(`${naBolha(id)} [data-documento-da-conversa]`).count();
    ok(`${oque}: sem foto e sem o lugar dela, com o cartão do nome`, foto === null && nome === 1,
       `foto: ${foto}, cartão: ${nome}`);
  }
  ok("e o cartão deles continua dizendo que é um PDF",
     /^PDF$/.test((await linhaDoTipo(page, "pdf-senha")).trim()), await linhaDoTipo(page, "pdf-senha"));
  const grande = pedidosDe(pedidos, "/recebidos/PDF8GRANDE.pdf");
  ok("o de 30 MB nem foi pedido: só a pergunta do tamanho (HEAD)",
     grande.length >= 1 && grande.every((p) => p.metodo === "HEAD"), JSON.stringify(grande));
  ok("o documento do Word não ganha foto nenhuma",
     (await page.locator(`${naBolha("doc-word")} [data-previa-do-pdf], ${naBolha("doc-word")} [data-cartao-do-pdf]`).count()) === 0
       && (await page.locator(`${naBolha("doc-word")} [data-documento-da-conversa]`).count()) === 1);
  ok("nenhum erro de JavaScript até aqui", estouros.length === 0, estouros.slice(0, 2).join(" | "));
}

console.log("\n6. O PDF grande, num depósito que deixa ler por pedaços, não vem inteiro para a foto");
{
  const todos = pedidosDe(pedidos, "/recebidos/PDF5QUARENTA.pdf").filter((p) => p.metodo === "GET");
  const faixas = todos.filter((p) => p.faixa);
  const lidos = faixas.reduce((s, p) => {
    const m = /^bytes=(\d+)-(\d+)$/.exec(p.faixa);
    return s + (m ? Number(m[2]) - Number(m[1]) + 1 : QUARENTA.length);
  }, 0);
  ok("a foto pediu pedaços do arquivo (Range)", faixas.length >= 1, JSON.stringify(todos.slice(0, 6)));
  ok(`e os pedaços somam menos de um quarto dos ${(QUARENTA.length / 1048576).toFixed(1)} MB`,
     faixas.length >= 1 && lidos < QUARENTA.length / 4, `${lidos} de ${QUARENTA.length} bytes`);
}

console.log("\n7. O clique na foto abre o PDF em tela cheia");
{
  ok("cliquei na foto do PDF de três páginas", await clicar(page, `${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`));
  const v = await esperarVisualizador(page, "pronto");
  ok("a janela abriu, com o PDF", v && v.estado === "pronto", JSON.stringify(v));
  ok("com o nome com que ele baixa, '0001.01 - Procuração.pdf'", v && v.nome === "0001.01 - Procuração.pdf",
     v && v.nome);
  ok("e dizendo que são 3 páginas", v && v.paginas === "3", v && v.paginas);
  ok("com um lugar para cada página", v && v.lugares === 3, v && String(v.lugares));
  const e = await escuro(page, '[data-pagina-do-pdf="1"] canvas');
  ok("a primeira página está desenhada", e !== null && e > 0.02, `escuro: ${e}`);
  ok("nada foi baixado ao abrir", baixados.length === 0, JSON.stringify(baixados));
  await page.locator('[data-pagina-do-pdf="3"]').scrollIntoViewIfNeeded().catch(() => {});
  const fim = Date.now() + 5000;
  let v3 = await visualizador(page);
  while (Date.now() < fim && !(v3 && v3.desenhadas.includes(3))) { await page.waitForTimeout(150); v3 = await visualizador(page); }
  ok("rolando até o fim, a terceira página é desenhada", v3 && v3.desenhadas.includes(3), JSON.stringify(v3));

  ok("cliquei em Baixar, na janela", await clicar(page, "[data-baixar-o-pdf]"));
  const ate = Date.now() + 5000;
  while (!baixados.length && Date.now() < ate) await page.waitForTimeout(100);
  ok("baixou com o nome, como o cartão", baixados[0] === "0001.01 - Procuração.pdf", JSON.stringify(baixados));

  ok("cliquei numa página", await clicar(page, '[data-pagina-do-pdf="1"]', { position: { x: 40, y: 40 } }));
  ok("e o clique na página não fecha a janela", (await visualizador(page)) !== null);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("Esc fecha a janela", (await visualizador(page)) === null);
  ok("e a conversa continua aberta atrás dela",
     (await page.locator(naBolha("pdf-tres")).count()) === 1 && (await page.locator("[data-doc-tipo]").count()) >= 10);

  ok("abri de novo", await clicar(page, `${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`));
  await esperarVisualizador(page, "pronto");
  const r = await caixaDe(page, "[data-visualizador-de-pdf]");
  await page.mouse.click(r.x + 12, r.y + r.h - 12);
  await page.waitForTimeout(400);
  ok("o clique no escuro fecha a janela", (await visualizador(page)) === null);
  ok("abri e fechei pelo X", await clicar(page, `${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`)
     && (await esperarVisualizador(page, "pronto")) && await clicar(page, "[data-fechar-o-pdf]")
     && (await visualizador(page)) === null);
}

console.log("\n8. A linha do nome continua baixando, e a seta continua por cima da foto");
{
  baixados.length = 0;
  ok("cliquei na linha do nome", await clicar(page, `${naBolha("pdf-tres")} [data-documento-da-conversa]`));
  const ate = Date.now() + 5000;
  while (!baixados.length && Date.now() < ate) await page.waitForTimeout(100);
  ok("ela baixou, com o nome", baixados[0] === "0001.01 - Procuração.pdf", JSON.stringify(baixados));
  ok("e não abriu a janela", (await visualizador(page)) === null);

  await page.locator(naBolha("pdf-tres")).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator(`${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`).first().hover().catch(() => {});
  await page.waitForTimeout(300);
  const seta = await page.evaluate((sel) => {
    const b = document.querySelector(sel);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const no = document.elementFromPoint(r.x + r.width - 8, r.y + 10);
    return { existe: true, porCima: !!(no && no.closest("[data-menu-msg]")) };
  }, `${naBolha("pdf-tres")} [data-menu-msg]`);
  ok("a seta de opções está pintada por cima da foto", seta && seta.porCima, JSON.stringify(seta));
}

console.log("\n9. No modo de seleção, a foto não abre nada");
{
  // A seleção se liga pelo "Apagar" do menu de uma mensagem NOSSA.
  await page.locator(naBolha("pdf-nosso")).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator(naBolha("pdf-nosso")).first().hover().catch(() => {});
  ok("abri o menu do PDF que nós mandamos",
     await clicar(page, `${naBolha("pdf-nosso")} button[aria-label="Opções da mensagem"]`));
  ok("e escolhi Apagar (liga a seleção)", await clicar(page, 'div[data-menu-msg] button:has-text("Apagar")'));
  ok("a seleção está ligada", (await page.locator('button[title="Cancelar seleção"]').count()) === 1);
  ok("cliquei na foto do PDF de três páginas", await clicar(page, `${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`));
  await page.waitForTimeout(500);
  ok("e a janela NÃO abriu: o clique é da seleção", (await visualizador(page)) === null);
  await clicar(page, 'button[title="Cancelar seleção"]');
  ok("fora da seleção, a mesma foto abre a janela",
     await clicar(page, `${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`)
       && (await esperarVisualizador(page, "pronto")) !== null && (await visualizador(page)) !== null);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

console.log("\n10. No contrato de quarenta páginas, as páginas longe da vista são apagadas");
{
  ok("abri o contrato", await clicar(page, `${naBolha("pdf-quarenta")} [data-previa-do-pdf="pronta"]`));
  const v = await esperarVisualizador(page, "pronto", 10000);
  ok("com os 40 lugares", v && v.lugares === 40, JSON.stringify(v));
  // Até o fim, de tela em tela, como quem lê.
  const rolagem = page.locator("[data-visualizador-de-pdf] > div").nth(1);
  for (let i = 0; i < 80; i++) {
    const noFim = await rolagem.evaluate((el) => {
      el.scrollTop += el.clientHeight;
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    }).catch(() => true);
    await page.waitForTimeout(60);
    if (noFim) break;
  }
  const fim = Date.now() + 6000;
  let v2 = await visualizador(page);
  while (Date.now() < fim && !(v2 && v2.desenhadas.includes(40))) { await page.waitForTimeout(150); v2 = await visualizador(page); }
  ok("lá no fim, a página 40 está desenhada", v2 && v2.desenhadas.includes(40), JSON.stringify(v2 && v2.desenhadas));
  ok("e as do começo foram apagadas: no máximo oito desenhadas ao mesmo tempo",
     v2 && v2.desenhadas.length >= 1 && v2.desenhadas.length <= 8 && !v2.desenhadas.includes(1),
     JSON.stringify(v2 && v2.desenhadas));
  const apagada = await page.evaluate(() => {
    const c = document.querySelector('[data-pagina-do-pdf="1"] canvas');
    return c ? c.width * c.height : null;
  });
  ok("a tela de pintura da página 1 voltou a zero", apagada === 0, String(apagada));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

console.log("\n11. O que não abre na janela é dito, com as duas saídas");
{
  // O ARQUIVO MUDOU no depósito depois de a foto ser feita, e o que vem
  // agora não é um PDF.
  cfg.trocar.set("/recebidos/PDF2SEMTIPO.pdf", QUEBRADO);
  ok("abri o PDF que deixou de ser PDF", await clicar(page, `${naBolha("pdf-sem-tipo")} [data-previa-do-pdf="pronta"]`));
  const v = await esperarVisualizador(page, "falhou");
  ok("a janela diz que não abriu", v && v.estado === "falhou", JSON.stringify(v));
  const frase = await page.locator("[data-pdf-que-nao-abriu]").innerText().catch(() => "");
  ok("com o motivo: não é um PDF que dê para ler", /não é um PDF que dê para ler/.test(frase), frase);
  ok("e com as duas saídas, Baixar e Abrir numa aba nova", /Baixar/.test(frase) && /Abrir numa aba nova/.test(frase), frase);
  baixados.length = 0;
  ok("cliquei em Baixar, ali", await clicar(page, '[data-pdf-que-nao-abriu] button:has-text("Baixar")'));
  const ate = Date.now() + 5000;
  while (!baixados.length && Date.now() < ate) await page.waitForTimeout(100);
  ok("e baixou, com o nome", baixados[0] === "Comprovante sem tipo 1212.pdf", JSON.stringify(baixados));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.slice(0, 2).join(" | "));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  cfg.trocar.clear();

  // O ARQUIVO SUMIU do depósito.
  cfg.sumir.add("/recebidos/PDF3PAISAGEM.pdf");
  ok("abri o PDF que sumiu do depósito", await clicar(page, `${naBolha("pdf-paisagem")} [data-previa-do-pdf="pronta"]`));
  const v2 = await esperarVisualizador(page, "falhou");
  const frase2 = await page.locator("[data-pdf-que-nao-abriu]").innerText().catch(() => "");
  ok("a janela diz que o depósito respondeu 404", v2 && v2.estado === "falhou" && /404/.test(frase2), frase2);
  // UM ERRO SEM DONO NO CONSOLE era o sintoma de uma tarefa esquecida: a
  // janela que fecha antes de a biblioteca chegar (e o React de
  // desenvolvimento monta tudo duas vezes, que é o mesmo caso) deixava uma
  // tarefa abrindo o PDF para ninguém, e a falha dela não tinha quem a ouvisse.
  ok("e nenhum erro de JavaScript, nem o da tarefa esquecida", estouros.length === 0, estouros.slice(0, 2).join(" | "));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  cfg.sumir.clear();
}
await ctx.close();

console.log("\n12. A biblioteca que não carregou deixa o cartão de sempre, que baixa");
{
  const b = await abrirPainel({ bloquearBiblioteca: true });
  await abrirConversa(b.page, ALVO);
  await lerAteOFim(b.page);
  ok("a cena bloqueou mesmo a biblioteca", b.bloqueados.length >= 1, JSON.stringify(b.bloqueados));
  const foto = await estadoDaFoto(b.page, "pdf-tres");
  ok("sem a biblioteca, o PDF fica sem foto e sem o lugar dela", foto === null, String(foto));
  ok("com o cartão do nome", (await b.page.locator(`${naBolha("pdf-tres")} [data-documento-da-conversa]`).count()) === 1);
  ok("que continua baixando", await clicar(b.page, `${naBolha("pdf-tres")} [data-documento-da-conversa]`)
     && await (async () => { const ate = Date.now() + 5000;
                             while (!b.baixados.length && Date.now() < ate) await b.page.waitForTimeout(100);
                             return b.baixados[0] === "0001.01 - Procuração.pdf"; })(), JSON.stringify(b.baixados));
  ok("e sem erro de JavaScript", b.estouros.length === 0, b.estouros.slice(0, 2).join(" | "));
  // O NAVEGADOR GUARDA O `import` QUE FALHOU até a página ser recarregada
  // (medido no Chromium): é o F5 que traz a foto de volta — e é isso que esta
  // metade confere, que nada daqui guardou a falha além da página.
  b.cfg.bloquear = false;
  await b.page.reload();
  await b.page.waitForSelector("[data-conversa-id]");
  await b.page.waitForTimeout(800);
  await abrirConversa(b.page, ALVO);
  await lerAteOFim(b.page);
  ok("recarregada a página, a foto sai", (await estadoDaFoto(b.page, "pdf-tres")) === "pronta",
     String(await estadoDaFoto(b.page, "pdf-tres")));
  await b.ctx.close();
}

console.log("\n12b. Muitos PDFs na tela: no máximo dois desenhados ao mesmo tempo");
{
  // UMA JANELA ALTA, onde quase todos os PDFs da conversa chegam perto da tela
  // de uma vez, e um depósito que demora: é aí que a fila aparece — ou não.
  const f = await abrirPainel({ altura: 3200 });
  f.cfg.atrasoGet = 700;
  await abrirConversa(f.page, ALVO);
  await lerAteOFim(f.page);
  const prontas = await f.page.locator('[data-previa-do-pdf="pronta"]').count();
  ok("os PDFs ganharam a foto", prontas >= 6, `prontas: ${prontas}`);
  ok("e nunca mais de dois PDFs foram baixados ao mesmo tempo", f.cfg.maxNoAr >= 1 && f.cfg.maxNoAr <= 2,
     `no ar ao mesmo tempo: ${f.cfg.maxNoAr}`);
  await f.ctx.close();
}

console.log("\n13. No celular, a foto e a janela cabem na tela");
{
  const c = await abrirPainel({ largura: 390, altura: 844 });
  await abrirConversa(c.page, ALVO);
  await lerAteOFim(c.page);
  const foto = await caixaDe(c.page, `${naBolha("pdf-tres")} [data-previa-do-pdf] img`);
  ok("a foto do PDF cabe na bolha do celular (até 62% da largura)", foto && foto.w <= 390 * 0.62 + 1 && foto.w > 100,
     JSON.stringify(foto));
  ok("abri o PDF no celular", await clicar(c.page, `${naBolha("pdf-tres")} [data-previa-do-pdf="pronta"]`));
  const v = await esperarVisualizador(c.page, "pronto");
  ok("a janela abriu", v && v.estado === "pronto", JSON.stringify(v));
  const medidas = await c.page.evaluate(() => {
    const pagina = document.querySelector('[data-pagina-do-pdf="1"]').getBoundingClientRect();
    const botoes = ["[data-baixar-o-pdf]", "[data-fechar-o-pdf]", "[data-pdf-numa-aba]"]
      .map((s) => document.querySelector(s).getBoundingClientRect());
    return { pagina: { x: pagina.x, w: pagina.width }, botoes: botoes.map((r) => ({ x: r.x, d: r.right, h: r.height })),
             rolaDeLado: document.documentElement.scrollWidth > window.innerWidth };
  });
  ok("a página cabe na largura do celular", medidas.pagina.x >= 0 && medidas.pagina.x + medidas.pagina.w <= 390,
     JSON.stringify(medidas.pagina));
  ok("os três botões estão dentro da tela, com 40 de alvo",
     medidas.botoes.length === 3 && medidas.botoes.every((b) => b.x >= 0 && b.d <= 390 && b.h >= 40),
     JSON.stringify(medidas.botoes));
  ok("e a tela não rola de lado", !medidas.rolaDeLado);
  ok("o X fecha", await clicar(c.page, "[data-fechar-o-pdf]") && (await visualizador(c.page)) === null);
  ok("sem erro de JavaScript no celular", c.estouros.length === 0, c.estouros.slice(0, 2).join(" | "));
  await c.ctx.close();
}

console.log("\n14. O que o build põe no ar");
{
  // A PROVA RODA NO SERVIDOR DE DESENVOLVIMENTO, onde o `vite.config.js` serve
  // os arquivos de apoio direto do pacote. O que vai para o ar é o BUILD, e
  // é ele que esta cena monta e confere — senão um build que esquecesse os
  // decodificadores passaria aqui, e a página digitalizada sairia em branco
  // só no escritório.
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), "zorvin-pdf-"));
  const r = spawnSync("npx", ["vite", "build", "--logLevel", "error", "--outDir", saida, "--emptyOutDir"],
                      { env: { ...process.env, VITE_BANCADA: "1" }, encoding: "utf8", timeout: 240000 });
  ok("o build montou", r.status === 0, (r.stderr || "").slice(0, 300));
  const pacote = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "node_modules", "pdfjs-dist");
  const igual = (rel, origem) => {
    const a = path.join(saida, rel);
    return fs.existsSync(a) && fs.readFileSync(a).equals(fs.readFileSync(path.join(pacote, origem)));
  };
  for (const nome of ["openjpeg.wasm", "jbig2.wasm", "qcms_bg.wasm", "openjpeg_nowasm_fallback.js", "jbig2_nowasm_fallback.js"]) {
    ok(`o build leva pdfjs/wasm/${nome}, igual ao do pacote`, igual(`pdfjs/wasm/${nome}`, `wasm/${nome}`));
  }
  ok("e as fontes padrão", igual("pdfjs/standard_fonts/LiberationSans-Regular.ttf", "standard_fonts/LiberationSans-Regular.ttf")
     && igual("pdfjs/standard_fonts/FoxitDingbats.pfb", "standard_fonts/FoxitDingbats.pfb"));
  ok("e não leva o que a prévia não usa (o JavaScript de dentro do PDF)",
     !fs.existsSync(path.join(saida, "pdfjs/wasm/quickjs-eval.wasm")));
  const assets = fs.existsSync(path.join(saida, "assets")) ? fs.readdirSync(path.join(saida, "assets")) : [];
  const principal = assets.filter((f) => /^index-.*\.js$/.test(f));
  const doPainel = principal.map((f) => fs.readFileSync(path.join(saida, "assets", f), "utf8")).join("");
  ok("o pdf.js sai num arquivo à parte", assets.some((f) => /^pdf-[\w-]+\.js$/.test(f)
       && fs.readFileSync(path.join(saida, "assets", f), "utf8").includes("only supports http(s)")), assets.join(", "));
  ok("e o arquivo do painel não o carrega junto", principal.length === 1 && doPainel.length > 0
     && !doPainel.includes("only supports http(s)"), principal.join(", "));
  ok("o trabalhador sai como .js, e nada sai como .mjs",
     assets.some((f) => /^trabalhadorDoPdf-[\w-]+\.js$/.test(f)) && !assets.some((f) => f.endsWith(".mjs")),
     assets.join(", "));
  fs.rmSync(saida, { recursive: true, force: true });
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
