// A PRIMEIRA PÁGINA DO PDF COMO FOTO, E O PDF INTEIRO NUMA JANELA (29/10).
//
// Pedido do Rodrigo: *"Para os arquivos em PDF recebidos, dá para ter uma pré
// visualização igual as imagens?"* A imagem aparece na conversa como foto, e
// o clique a abre grande. O PDF aparecia como um cartão com o nome — e, só no
// Chrome com leitor de PDF ligado, com uma faixa de 150px de um `<iframe>`.
//
// QUEM DESENHA AGORA É O pdf.js, E NÃO O LEITOR DO NAVEGADOR. O `<iframe>` só
// desenhava quando duas coisas davam certo ao mesmo tempo: o depósito dizer
// `application/pdf` e o navegador ter o leitor ligado. Faltando uma, a bolha
// ficava sem prévia — e o iframe que nascesse no caso errado BAIXAVA o arquivo
// sozinho (o relato de 29/09, em `arquivos.js`). O pdf.js lê os bytes e
// desenha numa tela própria: não depende do tipo que o depósito diz, nem do
// leitor do navegador, e não baixa nada para a pasta de ninguém.
//
// A BIBLIOTECA SÓ VEM QUANDO HÁ UM PDF PERTO DA TELA. Ela pesa mais do que o
// painel inteiro (foi por isso que `arquivos.js` escolheu o iframe), e
// carregá-la na abertura faria todo mundo pagar por um recurso que aparece em
// algumas bolhas. Aqui ela é importada sob demanda (`import()`), na primeira
// miniatura pedida, e o navegador a guarda para as próximas.
//
// NA DÚVIDA, NÃO DESENHA. PDF quebrado ou com senha, arquivo grande demais,
// depósito que não tem o arquivo: a resposta é `null`, e a bolha fica com o
// cartão de sempre — nunca uma moldura vazia, nunca um erro na tela.

import enderecoDoTrabalhador from "./trabalhadorDoPdf.js?worker&url";

/** Acima disto a miniatura não é feita. Quando o depósito não deixa ler por
 *  pedaços, o pdf.js baixa o arquivo inteiro para desenhar a primeira página,
 *  e 30 MB por uma foto de 226px não vale. O cartão continua lá, e o clique
 *  no nome baixa. */
export const TETO_DA_MINIATURA_BYTES = 25 * 1024 * 1024;

/** A largura em que a primeira página é desenhada: o dobro da largura em que
 *  a foto aparece na bolha, para ficar nítida em tela de alta resolução. */
export const LARGURA_DA_MINIATURA_PX = 520;

/** Quantas miniaturas são desenhadas AO MESMO TEMPO. Desenhar ocupa a tela do
 *  navegador; uma conversa com vinte PDFs abrindo de uma vez travaria a
 *  rolagem. Duas por vez, e as outras esperam na fila. */
const MINIATURAS_JUNTAS = 2;

// OS ARQUIVOS DE APOIO DO pdf.js moram no próprio site (`/pdfjs/`), postos lá
// pelo `vite.config.js`: os decodificadores de imagem em WebAssembly (JBIG2, o
// de muita digitalização em preto e branco; JPEG 2000) e as fontes padrão.
// Sem eles, a página de um documento digitalizado sairia em branco.
const APOIO = `${(import.meta.env && import.meta.env.BASE_URL) || "/"}pdfjs/`;

let biblioteca = null;

/** O pdf.js e UM trabalhador só, para todos os PDFs da página.
 *
 *  O TRABALHADOR É DE TODOS. Sem ele, cada documento aberto criaria o seu
 *  (um processo a mais, lendo de novo 1,3 MB de código), e uma conversa com
 *  vinte PDFs seriam vinte. Passado em `getDocument`, ele não é destruído
 *  quando um documento fecha — o que é preciso, porque outro pode estar
 *  usando o mesmo trabalhador naquele instante.
 *
 *  A VERSÃO "LEGACY" DO pdf.js, E NÃO A MODERNA. A moderna usa recursos que
 *  só os navegadores mais novos têm (`Map.prototype.getOrInsertComputed`,
 *  entre outros) — MEDIDO: no Chromium destas provas (141), ela abria a
 *  biblioteca e falhava em todo PDF, e a miniatura simplesmente não saía. A
 *  "legacy" traz esses recursos junto e funciona num Chrome, Edge ou Firefox
 *  de dois, três anos atrás. Custa uns 70 KB a mais, baixados só por quem
 *  abre um PDF.
 *
 *  A BIBLIOTECA QUE NÃO CARREGOU (a rede caiu naquele segundo; uma
 *  publicação nova trocou o nome do arquivo com a página aberta) deixa o
 *  cartão de sempre, que baixa. Esta função pede de novo na próxima vez —
 *  mas o navegador guarda o `import` que falhou até a página ser
 *  recarregada (medido no Chromium), e aí só um F5 traz a foto de volta. */
export function carregarPdfjs() {
  if (!biblioteca) {
    biblioteca = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = enderecoDoTrabalhador;
      return { pdfjs, trabalhador: new pdfjs.PDFWorker({ name: "zorvin-pdf" }) };
    }).catch((e) => {
      biblioteca = null;
      throw e;
    });
  }
  return biblioteca;
}

/** Começa a abrir o documento e devolve a TAREFA (`.promise` dá o documento).
 *  Quem chama a destrói (`destroy`) quando terminar — também no meio, se a
 *  janela fechar antes de o PDF chegar. */
export async function abrirPdf(url) {
  const { pdfjs, trabalhador } = await carregarPdfjs();
  return pdfjs.getDocument({
    url,
    worker: trabalhador,
    wasmUrl: `${APOIO}wasm/`,
    standardFontDataUrl: `${APOIO}standard_fonts/`,
    // SÓ O QUE A PÁGINA PEDE. Com o depósito deixando ler por pedaços, a
    // primeira página não traz o arquivo inteiro junto: sem `disableStream`,
    // o pdf.js continuaria baixando o resto em segundo plano, e sem
    // `disableAutoFetch`, buscaria as outras páginas sem ninguém pedir.
    disableStream: true,
    disableAutoFetch: true,
  });
}

/** O que dizer quando o PDF não abre, pelo motivo que o pdf.js deu. */
export function porQueNaoAbriu(erro) {
  const nome = erro && erro.name;
  if (nome === "PasswordException") return "Este PDF tem senha, e só abre baixado.";
  if (nome === "InvalidPDFException") return "O arquivo não é um PDF que dê para ler aqui.";
  if (nome === "ResponseException" && erro.status) return `O depósito respondeu ${erro.status}.`;
  return "Não consegui abrir o PDF aqui.";
}

/** O que não muda na segunda vez: o arquivo que não é um PDF que dê para
 *  ler, o que tem senha, e o depósito dizendo que não tem o arquivo (4xx).
 *  O resto — o depósito respondendo 5xx, a conexão que caiu no meio — é
 *  tropeço, e a próxima vez pode dar certo. */
function naoMudaNaSegunda(erro) {
  const nome = erro && erro.name;
  if (nome === "InvalidPDFException" || nome === "PasswordException") return true;
  return nome === "ResponseException" && erro.status >= 400 && erro.status < 500;
}

/** O tamanho que o depósito diz. `null` quando não deu para saber (aí a
 *  miniatura é tentada: não saber não é motivo para não mostrar); `false`
 *  quando o depósito respondeu que não tem o arquivo. Um endereço local
 *  (`blob:`, `data:`) já está na memória e não pergunta. */
async function tamanhoServido(url) {
  if (/^(blob|data):/i.test(url)) return null;
  try {
    const r = await fetch(url, { method: "HEAD" });
    if (!r.ok) return false;
    const n = Number(r.headers.get("content-length"));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Desenha uma página numa tela (`canvas`) na largura pedida, em pixels. */
export async function desenharPagina(pagina, larguraPx, tela) {
  const base = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: larguraPx / base.width });
  tela.width = Math.max(1, Math.floor(viewport.width));
  tela.height = Math.max(1, Math.floor(viewport.height));
  await pagina.render({ canvas: tela, viewport, background: "#fff" }).promise;
  return tela;
}

// A FILA DAS MINIATURAS: no máximo `MINIATURAS_JUNTAS` desenhando, na ordem em
// que as bolhas chegaram perto da tela.
let desenhando = 0;
const naFila = [];
function naVez(fazer) {
  return new Promise((ok, falha) => {
    naFila.push(() => fazer().then(ok, falha).finally(() => { desenhando--; proxima(); }));
    proxima();
  });
}
function proxima() {
  while (desenhando < MINIATURAS_JUNTAS && naFila.length) {
    desenhando++;
    naFila.shift()();
  }
}

const MINIATURAS = new Map();

/**
 * A primeira página como foto: `{ src, paginas, largura, altura }`, ou `null`
 * quando não dá. Uma por endereço, guardada enquanto a página estiver aberta:
 * rolar a conversa para cima e para baixo não desenha de novo.
 *
 * A FOTO É UM ENDEREÇO LOCAL (`blob:`), e não a tela de pintura: uma `<img>`
 * comum se comporta como a das imagens da conversa (o mesmo tamanho máximo, o
 * mesmo botão em volta), e a tela de pintura não precisa ficar na memória.
 *
 * O QUE NÃO VAI MUDAR FICA GUARDADO como "não dá": o PDF quebrado ou com
 * senha, o grande demais, o que o depósito não tem. O TROPEÇO NÃO FICA — a
 * biblioteca que não carregou (a promessa falha; ver `carregarPdfjs`) e o
 * depósito que respondeu 5xx ou a conexão que caiu no meio: guardados, eles
 * deixariam o PDF sem foto até alguém apertar F5, e o painel passa o dia
 * aberto. A bolha que voltar à tela tenta de novo.
 */
export function miniaturaDoPdf(url) {
  if (!url) return Promise.resolve(null);
  if (MINIATURAS.has(url)) return MINIATURAS.get(url);
  const pedido = naVez(async () => {
    const tamanho = await tamanhoServido(url);
    if (tamanho === false || (tamanho && tamanho > TETO_DA_MINIATURA_BYTES)) return null;
    const tarefa = await abrirPdf(url);
    try {
      const doc = await tarefa.promise;
      const tela = await desenharPagina(await doc.getPage(1), LARGURA_DA_MINIATURA_PX,
                                        document.createElement("canvas"));
      const foto = await new Promise((ok) => tela.toBlob(ok, "image/jpeg", 0.86));
      if (!foto) return null;
      return { src: URL.createObjectURL(foto), paginas: doc.numPages,
               largura: tela.width, altura: tela.height };
    } catch (e) {
      // NÃO DEU PARA DESENHAR: o cartão fica, e não é falha da tela. Se foi
      // tropeço, a resposta não fica guardada (ver acima).
      console.warn("prévia do PDF: não deu para desenhar", e && e.message);
      if (!naoMudaNaSegunda(e)) MINIATURAS.delete(url);
      return null;
    } finally {
      tarefa.destroy().catch(() => {});
    }
  });
  MINIATURAS.set(url, pedido);
  pedido.catch(() => MINIATURAS.delete(url));
  return pedido;
}
