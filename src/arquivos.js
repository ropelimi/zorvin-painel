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
// TEXTO TAMBÉM: .txt, .csv, .json, .xml e afins são desenhados do mesmo jeito.
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
