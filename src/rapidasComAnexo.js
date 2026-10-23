// ============================================================
//  AS MENSAGENS RÁPIDAS COM ANEXO (23/10) — as contas que não precisam de tela
//
//  Pedido do Rodrigo: "Para as mensagens rápidas, precisa ser possível incluir
//  vídeos." O vídeo que a equipe manda a todo cliente novo (como funciona o
//  acordo, onde assinar) era procurado no computador e anexado à mão, a cada
//  vez. Agora ele mora na própria rápida.
//
//  O ARQUIVO SOBE UMA VEZ, ao salvar a rápida, para `anexos/rapidas/…`. Usar a
//  rápida põe na fila o MESMO endereço — sem baixar e subir de novo a cada
//  cliente. Subir de novo seria a conta de banda de 21/08 com outra roupa (a
//  armadilha nº 6 da ponte), e deixaria quem atende esperando o upload de um
//  vídeo que já está no depósito.
//
//  As colunas são do script 034 da ponte. Sem ele, nada disto aparece.
// ============================================================

/** O tipo que a fila de envio usa, pelo tipo do arquivo — a mesma conta de
 *  `paraAnexos` e `enviarArquivo`, para a rápida não mandar como "documento"
 *  o vídeo que a prévia mostrou como vídeo. */
export function tipoDoAnexo(mime) {
  const t = String(mime || "");
  return t.startsWith("image/") ? "imagem" : t.startsWith("video/") ? "video"
       : t.startsWith("audio/") ? "audio" : "documento";
}

/** O endereço no depósito: a pasta `rapidas/`, um carimbo que não se repete, e
 *  o nome higienizado — o depósito recusa acento e espaço numa chave. O nome
 *  de verdade vai à parte, em `midia_nome` (a lição de 16/10). */
export function caminhoDoAnexoDaRapida(nome, agora = Date.now()) {
  const limpo = String(nome || "arquivo").replace(/[^\w.\-]+/g, "_");
  return `rapidas/${agora}-${limpo}`;
}

/** A coluna do anexo não existe nesta base (o script 034 não rodou)?
 *  Pelo código e pelo nome, como `semAColunaDaAgenda`: um 42703 de outra
 *  coluna não diz nada sobre esta. */
export function semAColunaDoAnexo(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  const msg = String(erro.message || "");
  return (codigo === "42703" || codigo === "PGRST204") && /midia_(url|tipo|mime|nome)/.test(msg);
}

/** O que a rápida carrega, escrito por extenso: "vídeo", "imagem", "documento",
 *  "áudio". É o que aparece na lista e no menu do "/". */
export function nomeDoAnexo(tipo) {
  return { video: "vídeo", imagem: "imagem", documento: "documento", audio: "áudio" }[tipo] || "anexo";
}

/** O anexo da rápida na forma de um arquivo da prévia: o mesmo feitio de um
 *  `File` nas três coisas que a prévia e o envio leem (`type`, `name`,
 *  `size`), mais o endereço que já está no depósito. `enviarArquivo` reconhece
 *  `doDeposito` e não sobe nada. */
export function anexoDoDeposito(rapida) {
  if (!rapida || !rapida.midia_url) return null;
  return { doDeposito: true, url: rapida.midia_url, type: rapida.midia_mime || "",
           name: rapida.midia_nome || "arquivo", size: null, tipo: rapida.midia_tipo || tipoDoAnexo(rapida.midia_mime) };
}

/** UM ANO E `immutable`, a régua da ponte (`CACHE_DA_MIDIA`, no index.js
 *  dela): o endereço tem um carimbo que não se repete, então nunca aponta para
 *  outro conteúdo — e o vídeo que a equipe abre a cada uso não é baixado de
 *  novo. Sem dizer nada, a biblioteca manda uma hora: a armadilha nº 6 da
 *  ponte, a que zerou a franquia de banda em 21/08. */
export const CACHE_DO_ANEXO_DA_RAPIDA = { cacheControl: "31536000, immutable" };
