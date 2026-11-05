// ============================================================
//  AS NOTAS INTERNAS COM ANEXO (05/11) — as contas que não precisam de tela
//
//  Pedido do Rodrigo: "Nas notas internas precisa ter a possibilidade de
//  anexar documentos." O comprovante que o cliente mandou por e-mail, o print
//  do sistema do banco, o contrato conferido: nada disso tinha onde ficar na
//  conversa sem ir para o cliente.
//
//  O ARQUIVO SOBE PARA `anexos/notas/…` E FICA NA NOTA (`midia_url`,
//  `midia_tipo`, `midia_mime`, `midia_nome`, as colunas do script 053 da
//  ponte). Ele NUNCA passa pela fila de envio: a nota não vai ao WhatsApp, e o
//  anexo dela também não. Sem o 053, nada disto aparece.
// ============================================================

/** O endereço no depósito: a pasta `notas/`, a conversa, um carimbo e um
 *  sorteio que não se repetem (a régua de `caminhoNoDeposito`: dois arquivos
 *  de mesmo nome salvos juntos caem no mesmo milissegundo), e o nome
 *  higienizado — o depósito recusa acento e espaço numa chave. O nome de
 *  verdade vai à parte, em `midia_nome` (a lição de 16/10). */
export function caminhoDoAnexoDaNota(convId, nome, agora = Date.now(), sorteio = Math.random()) {
  const limpo = String(nome || "arquivo").replace(/[^\w.\-]+/g, "_");
  return `notas/${convId}/${agora}-${sorteio.toString(36).slice(2, 8)}-${limpo}`;
}

/** UM ANO E `immutable`, a régua da ponte (`CACHE_DA_MIDIA`): o endereço tem
 *  um carimbo que não se repete, então nunca aponta para outro conteúdo. Sem
 *  dizer nada, a biblioteca manda uma hora — a armadilha nº 6 da ponte, a que
 *  zerou a franquia de banda em 21/08. */
export const CACHE_DO_ANEXO_DA_NOTA = { cacheControl: "31536000, immutable" };

/** A nota tem anexo? Pelo endereço, que é o que a regra do 053 amarra ao
 *  tipo: os dois ou nenhum. */
export function notaTemAnexo(n) {
  return Boolean(n && n.midia_url);
}

/** A frase de quem tenta pôr um arquivo na nota num Zorvin que não guarda
 *  anexo nela. Diz o que fazer, e é a mesma nas três portas (o clipe, o
 *  arrastar e o colar). */
export const FRASE_DA_NOTA_SEM_ANEXO =
  "A nota interna deste Zorvin ainda é só texto: falta a atualização do banco que guarda "
  + "o arquivo nela. Feche a nota para enviar o arquivo ao cliente.";
