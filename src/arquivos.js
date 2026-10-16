// O QUE DÁ PARA MOSTRAR DE UM ARQUIVO, E O QUE NÃO DÁ.
//
// A imagem sempre teve prévia; todo o resto virava um retângulo cinza com
// "Documento" escrito dentro. Numa banca isso pesa mais do que parece: o que
// chega o dia inteiro é PDF — procuração, contrato, extrato, comprovante,
// intimação — e "Documento" não distingue a procuração que se estava esperando
// do panfleto que alguém encaminhou. Quem atende abre um por um para descobrir.
//
// PDF O NAVEGADOR JÁ SABE DESENHAR, sem biblioteca nenhuma: `<iframe>` com o
// endereço do arquivo mostra a primeira página. Não foi acrescentado nenhum
// pacote para isto — um leitor de PDF em JavaScript pesa mais do que o painel
// inteiro, e seria carregado por toda pessoa que abre a tela, para um recurso
// que só aparece em algumas bolhas.
//
// TEXTO TAMBÉM: .txt, .csv, .json, .xml e afins — mas LIDOS e escritos na
// bolha, e não num iframe. Ver "Abrir a conversa não pode baixar nada".
//
// E O QUE NÃO DÁ, FICA DITO. Word, Excel e PowerPoint não têm como ser
// desenhados por um navegador — não existe leitor nativo, e mandar o arquivo
// para um conversor de terceiros seria despachar documento de cliente para
// fora do escritório. Para esses, o que melhora é a ETIQUETA: dizer "Planilha
// do Excel · orcamento.xlsx" em vez de "Documento" já responde a pergunta que
// faz alguém abrir o arquivo.
//
// A REGRA GERAL DESTE ARQUIVO: na dúvida, não inventa. Extensão desconhecida
// vira "Arquivo", e não um palpite — um rótulo errado é pior que um rótulo
// genérico, porque ele é acreditado.

/** A extensão, em minúsculas e sem o ponto. "" quando não dá para saber. */
export function extensaoDe(nome) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(nome || "").trim());
  return m ? m[1].toLowerCase() : "";
}

const MIMES_DE_TEXTO = /^text\/|application\/(json|xml|x-yaml|yaml|csv)/i;
const EXTENSOES_DE_TEXTO = new Set([
  "txt", "csv", "tsv", "json", "xml", "md", "log", "yml", "yaml", "html", "htm",
]);

// ABRIR A CONVERSA NÃO PODE BAIXAR NADA (29/09).
//
// Relato do Rodrigo, com foto: só de abrir a conversa de um cliente, o Chrome
// começou a pedir para salvar vários arquivos — "AC89EEE7…", tipo planilha
// CSV —, sem ninguém ter clicado em nada.
//
// A prévia era um `<iframe>` apontando para o anexo, e **quem decide o que um
// iframe faz é o TIPO QUE O SERVIDOR DIZ, e não o nome do arquivo**. Medido no
// Chromium, cada tipo num iframe:
//
//   text/plain, application/json, text/xml, application/pdf → desenha
//   text/csv                                               → BAIXA
//   application/octet-stream (o PDF que o WhatsApp manda
//   sem tipo, reconhecido só pelo nome)                    → BAIXA
//
// Os dois que baixam são justamente os que `comoPrever` aceitava por um
// caminho próprio: o CSV como "texto" e o PDF pelo nome. E o nome do arquivo
// salvo é o `messageid`, porque é esse o endereço no depósito.
//
// POR ISSO AS DUAS PERGUNTAS SÃO SEPARADAS. `comoPrever` diz o que o arquivo
// É; `oQuadroDesenha` diz o que o iframe vai FAZER com ele, e só responde
// depois de perguntar ao servidor. O texto não passa mais por iframe nenhum:
// ele é lido e escrito na bolha, e ler nunca baixa.

/** O tipo que o servidor diz para este endereço, sem parâmetros e em
 *  minúsculas — ou null quando não deu para saber.
 *
 *  HEAD e não GET nos endereços de rede: a pergunta é só o cabeçalho, e o
 *  arquivo inteiro de cada PDF da conversa seria a conta de banda de 21/08
 *  outra vez. `blob:` e `data:` são locais — ali um GET não custa nada, e é o
 *  que funciona em todo navegador.
 *
 *  Guardado por endereço: os anexos moram em `recebidos/{messageid}` e esse
 *  endereço nunca muda de conteúdo, então a resposta também não muda. */
const TIPOS_SERVIDOS = new Map();
export function tipoServido(url) {
  if (!url) return Promise.resolve(null);
  if (TIPOS_SERVIDOS.has(url)) return TIPOS_SERVIDOS.get(url);
  const local = /^(blob|data):/i.test(url);
  const pergunta = fetch(url, { method: local ? "GET" : "HEAD" })
    .then((r) => {
      if (local && r.body) r.body.cancel().catch(() => {});
      if (!r.ok) return null;
      const t = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      return t || null;
    })
    // NA DÚVIDA, NÃO MOSTRA. Sem saber o tipo, desenhar o iframe é apostar
    // que ele não baixa — e a aposta perdida é o defeito relatado.
    .catch(() => null);
  TIPOS_SERVIDOS.set(url, pergunta);
  // Uma falha de rede não fica guardada para sempre: a próxima abertura
  // pergunta de novo.
  pergunta.then((t) => { if (t === null) TIPOS_SERVIDOS.delete(url); });
  return pergunta;
}

/** O iframe DESENHA este arquivo, em vez de baixá-lo? Só vale para o PDF — o
 *  texto não usa iframe. Duas condições, e as duas são do navegador:
 *
 *  - o servidor diz `application/pdf`. O nome `.pdf` não basta: servido como
 *    `octet-stream`, o iframe baixa;
 *  - o navegador tem o leitor de PDF LIGADO. No Chrome dá para escolher
 *    "baixar PDFs em vez de abrir" (Configurações → Privacidade → PDF), e aí
 *    até o PDF certo baixa. `navigator.pdfViewerEnabled` diz qual das duas;
 *    navegador antigo que não o conhece fica com o que sempre fez. */
export function oQuadroDesenha(como, tipo, leitorDePdf) {
  if (como !== "pdf") return false;
  if (leitorDePdf === false) return false;
  return tipo === "application/pdf";
}

/** O começo de um arquivo de texto, para escrever na bolha. Lê no máximo
 *  `limite` bytes: um CSV de extrato pode ter megas, e a miniatura mostra
 *  dez linhas. `Range` pede só o começo; se o servidor ignorar o pedido, a
 *  leitura para sozinha no limite. Devolve null quando não deu para ler. */
export async function comecoDoTexto(url, limite = 4096) {
  try {
    const local = /^(blob|data):/i.test(url);
    const r = await fetch(url, local ? {} : { headers: { Range: `bytes=0-${limite - 1}` } });
    if (!r.ok || !r.body) return null;
    const leitor = r.body.getReader();
    const pedacos = [];
    let lidos = 0;
    while (lidos < limite) {
      const { done, value } = await leitor.read();
      if (done) break;
      pedacos.push(value);
      lidos += value.length;
    }
    leitor.cancel().catch(() => {});
    const tudo = new Uint8Array(Math.min(lidos, limite));
    let pos = 0;
    for (const p of pedacos) {
      const cabe = Math.min(p.length, tudo.length - pos);
      tudo.set(p.subarray(0, cabe), pos);
      pos += cabe;
      if (pos >= tudo.length) break;
    }
    // O corte pode cair no meio de uma letra acentuada; o `�` do fim sai.
    return new TextDecoder("utf-8").decode(tudo).replace(/\uFFFD+$/, "");
  } catch (_) {
    return null;
  }
}

/** Como este arquivo pode ser MOSTRADO: 'imagem', 'pdf', 'texto' ou null.
 *
 *  O MIME MANDA, e a extensão é o segundo caminho. É nessa ordem porque o MIME
 *  vem do próprio arquivo, e a extensão vem do nome — e nome de arquivo é
 *  digitado por gente. Mas os dois precisam existir: o WhatsApp manda anexo com
 *  `application/octet-stream` mais vezes do que se gostaria, e aí só o nome
 *  sabe que aquilo é um PDF.
 */
export function comoPrever(mime, nome) {
  const m = String(mime || "").toLowerCase();
  const ext = extensaoDe(nome);
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) {
    return "imagem";
  }
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (MIMES_DE_TEXTO.test(m) || EXTENSOES_DE_TEXTO.has(ext)) return "texto";
  return null;
}

// O nome do tipo, na língua de quem lê. Sem sigla: "Planilha do Excel" diz
// alguma coisa a quem nunca ouviu falar em xlsx.
const NOMES = {
  pdf: "PDF",
  doc: "Documento do Word", docx: "Documento do Word", rtf: "Documento do Word",
  odt: "Documento de texto",
  xls: "Planilha do Excel", xlsx: "Planilha do Excel", ods: "Planilha", csv: "Planilha (CSV)",
  ppt: "Apresentação", pptx: "Apresentação", odp: "Apresentação",
  zip: "Pasta compactada", rar: "Pasta compactada", "7z": "Pasta compactada",
  txt: "Texto", json: "Texto (JSON)", xml: "Texto (XML)",
  mp3: "Áudio", ogg: "Áudio", wav: "Áudio",
  mp4: "Vídeo", mov: "Vídeo", avi: "Vídeo", mkv: "Vídeo",
};

/** "PDF", "Planilha do Excel"… ou "Arquivo" quando não dá para saber. */
export function nomeDoTipo(mime, nome) {
  const ext = extensaoDe(nome);
  if (NOMES[ext]) return NOMES[ext];
  const m = String(mime || "").toLowerCase();
  if (m === "application/pdf") return "PDF";
  if (m.startsWith("image/")) return "Imagem";
  if (m.startsWith("video/")) return "Vídeo";
  if (m.startsWith("audio/")) return "Áudio";
  if (MIMES_DE_TEXTO.test(m)) return "Texto";
  // NA DÚVIDA, "Arquivo" — e não um palpite. Um rótulo errado é pior que um
  // genérico, porque ele é acreditado.
  return "Arquivo";
}

/** "1,4 MB". Vazio quando o tamanho não é conhecido — e vazio é honesto:
 *  "0 KB" faria um anexo de tamanho desconhecido parecer um anexo vazio. */
export function tamanhoLegivel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// ============================================================
//  O ARQUIVO BAIXA COM O NOME QUE TEM (16/10)
//
//  Relato do Rodrigo: ele mandou "0001.01 - Procuração" para o cliente
//  assinar, o cliente devolveu assinado e, ao baixar, o arquivo veio com
//  "letras e números aleatórios".
//
//  OS "NÚMEROS ALEATÓRIOS" SÃO O ENDEREÇO DO DEPÓSITO. O que chega mora em
//  `recebidos/{messageid}.pdf`, e o navegador salva com o fim do endereço.
//  O link da bolha tinha o atributo `download`, e o navegador o IGNORA
//  quando o arquivo é de outro domínio — que é o caso do depósito. O nome
//  certo estava gravado (`midia_nome`) e escrito na bolha; só não ia junto.
//
//  O JEITO É O DE `baixarImagem`, que já existia: buscar o arquivo, e salvar
//  de um endereço local (`blob:`), onde o `download` vale. E o NOME é o
//  daqui, e não o do endereço.

// A extensão de cada tipo, só dos que aparecem numa banca. Fora daqui não se
// acrescenta extensão nenhuma: na dúvida, não inventa (a regra do arquivo).
const EXTENSAO_DO_TIPO = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
  "audio/wav": "wav",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/rtf": "rtf", "text/rtf": "rtf",
  "application/zip": "zip", "application/vnd.rar": "rar", "application/x-rar-compressed": "rar",
  "application/x-7z-compressed": "7z",
  "text/plain": "txt", "text/csv": "csv", "application/json": "json",
  "application/xml": "xml", "text/xml": "xml",
};

// AS EXTENSÕES QUE SE RECONHECEM. Quando o nome termina numa delas, ele fica
// como está, mesmo que o tipo diga outra coisa: "dados.csv" chega do Windows
// como `application/vnd.ms-excel`, e virar "dados.csv.xls" seria estragar um
// nome que estava certo. É o nome da pessoa que vence.
const EXTENSOES_CONHECIDAS = new Set([
  ...Object.values(EXTENSAO_DO_TIPO), ...Object.keys(NOMES),
  "jpeg", "bmp", "tif", "tiff", "heif", "svg", "opus", "webm", "htm", "html", "md",
  "log", "tsv", "yml", "yaml", "eml", "msg", "xps", "odp", "vcf", "ics", "epub",
  // A assinatura digital da ICP-Brasil, que numa banca chega todo dia.
  "p7s", "p7m",
]);

function extensaoDoTipo(mime) {
  return EXTENSAO_DO_TIPO[String(mime || "").split(";")[0].trim().toLowerCase()] || "";
}

// A extensão do fim do ENDEREÇO, quando ele é de rede. "bin" é o depósito
// dizendo que não sabia, e não uma extensão.
function extensaoDoEndereco(url) {
  const s = String(url || "");
  if (!/^https?:/i.test(s)) return "";
  const ext = extensaoDe(s.split(/[?#]/)[0]);
  return ext === "bin" ? "" : ext;
}

// O que o Windows recusa num nome de arquivo, e os caracteres de controle.
const PROIBIDOS_NO_WINDOWS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

const dois = (n) => String(n).padStart(2, "0");

/** "16-10-2026 09h15", na hora de quem baixa. Sem barra nem dois-pontos: o
 *  Windows recusa os dois num nome. */
function dataParaONome(quando) {
  const d = quando ? new Date(quando) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${dois(d.getDate())}-${dois(d.getMonth() + 1)}-${d.getFullYear()} ` +
         `${dois(d.getHours())}h${dois(d.getMinutes())}`;
}

// Cabe com folga no limite do Windows (260 para o caminho INTEIRO), mesmo
// dentro de "C:\Users\<nome>\Downloads\". A ponte já corta o nome que chega em
// 200; este teto é para o que sai daqui.
const LIMITE_DO_NOME = 180;

function cortar(texto, cabe) {
  const letras = Array.from(texto);   // por letra, e não por unidade de UTF-16
  return letras.length <= cabe ? texto : letras.slice(0, cabe).join("").replace(/[\s.]+$/, "");
}

/** O nome com que o arquivo é SALVO no computador de quem baixa.
 *
 *  - o nome gravado (`midia_nome`), como veio — só sai o que o Windows recusa
 *    (vira "_", como o próprio Chrome faria), e o espaço e o ponto das pontas;
 *  - SEM EXTENSÃO, ganha a do tipo: o exemplo do relato, "0001.01 -
 *    Procuração", é um nome que o Windows mostra sem o ".pdf". Salvo assim,
 *    ninguém abre o arquivo com dois cliques. O tipo vem da mensagem, depois
 *    do que o depósito serviu, depois do fim do endereço;
 *  - SEM NOME (mensagem antiga, foto do WhatsApp), "Documento 16-10-2026
 *    09h15.pdf" — a data da mensagem, e não um carimbo de milissegundos, que
 *    seria outro "número aleatório". */
export function nomeParaBaixar({ nome, mime, servido, url, quando, padrao = "Documento" } = {}) {
  let base = String(nome || "").split(/[\\/]/).pop()
    .replace(PROIBIDOS_NO_WINDOWS, "_")
    .replace(/^[\s.]+|[\s.]+$/g, "");
  if (!base) base = `${padrao} ${dataParaONome(quando)}`.trim();
  const doNome = extensaoDe(base);
  const esperada = extensaoDoTipo(mime) || extensaoDoTipo(servido) || extensaoDoEndereco(url);
  const acrescenta = esperada && doNome !== esperada && !EXTENSOES_CONHECIDAS.has(doNome);
  if (acrescenta) return `${cortar(base, LIMITE_DO_NOME - esperada.length - 1)}.${esperada}`;
  // O corte guarda a extensão do nome: "…assinada.pdf" cortado no meio do
  // ".pdf" perderia justamente o que diz como abrir o arquivo.
  if (Array.from(base).length <= LIMITE_DO_NOME) return base;
  const fim = doNome ? `.${doNome}` : "";
  return cortar(fim ? base.slice(0, -fim.length) : base, LIMITE_DO_NOME - fim.length) + fim;
}

/** O endereço que o próprio DEPÓSITO serve como "baixar com este nome".
 *
 *  O Storage do Supabase entende `?download=<nome>` e responde com
 *  `Content-Disposition: attachment; filename*=UTF-8''…`, com acento e tudo.
 *  É o que fica no `href` do link: "Salvar link como…" e o clique com Ctrl,
 *  que não passam pelo clique desta tela, também salvam com o nome certo.
 *  Endereço que não é do depósito volta como veio. */
export function enderecoParaBaixar(url, nome) {
  const s = String(url || "");
  if (!nome || !/^https?:\/\/[^?#]+\/storage\/v1\/object\/public\//i.test(s)) return url;
  return `${s}${s.includes("?") ? "&" : "?"}download=${encodeURIComponent(nome)}`;
}

/** Baixa o arquivo com o nome dado, e devolve o nome usado.
 *
 *  `nomear` pode ser o nome, ou uma função que o faz a partir do tipo que o
 *  depósito serviu — é ela que acerta a extensão do arquivo antigo que ficou
 *  gravado sem tipo.
 *
 *  O endereço local é solto um minuto depois, e não na hora: o navegador o lê
 *  enquanto salva, e um arquivo grande num disco lento ainda não terminou.
 *
 *  A resposta que não é 200 SOBE, com o número: "o arquivo não está mais no
 *  depósito" não pode virar um arquivo salvo com a página de erro dentro. */
export async function baixarComONome(url, nomear) {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    const erro = new Error(`o depósito respondeu ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }
  const blob = await resposta.blob();
  const nome = typeof nomear === "function" ? nomear(blob.type) : nomear;
  const local = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = local;
  a.download = nome;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(local), 60000);
  return nome;
}
