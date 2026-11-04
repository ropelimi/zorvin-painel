// ============================================================
//  QUEM SAIU NÃO APARECE PARA ESCOLHER (04/11)
//
//  Relato do Rodrigo, com a foto do "Passar para": a Gabriely, desligada do
//  escritório, ainda aparecia para receber conversa. A ponte já a tinha
//  desligado no Zorvin pelo Vantoro (`usuarios.ativo = false`, sem permissão,
//  com a entrada bloqueada); a TELA é que não sabia. O script 047 da ponte
//  pôs `ativo` na vista `equipe`, e é daqui que as listas de escolher pessoa
//  perguntam.
//
//  ESCOLHER é dar trabalho a alguém: passar a conversa, escolher de quem são
//  as conversas da lista, mandar o lembrete. Quem saiu não recebe trabalho.
//  O NOME dele continua onde é história — as mensagens que escreveu, os
//  relatórios, "quem participou" de uma conversa —, porque apagar o nome do
//  passado não muda o passado, só o deixa sem dono.
// ============================================================

/** Pode aparecer numa lista de escolher? Só o `false` escrito diz que saiu:
 *  sem a coluna (um banco sem o 047), todo mundo pode, como sempre pôde. */
export function podeSerEscolhida(pessoa) {
  return Boolean(pessoa) && pessoa.ativo !== false;
}

/** O banco sem o 047 responde 42703 à leitura que pede `ativo` pelo nome. É a
 *  falta da COLUNA, e não uma falha: a lista é lida de novo sem ela. Pelo
 *  código e pelo nome, como `semAColunaDoAnexo`: um 42703 de outra coluna
 *  não diz nada sobre esta. */
export function semAColunaAtivoDaEquipe(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  return (codigo === "42703" || codigo === "PGRST204") && /\bativo\b/.test(String(erro.message || ""));
}
