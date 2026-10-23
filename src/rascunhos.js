// ============================================================
//  O QUE FICOU ESCRITO NA CAIXA DE CADA CONVERSA (22/10)
//
//  Os rascunhos moravam dentro do painel (`rascunhosRef`) e iam embora junto
//  com ele. Até 22/10 o painel só saía de cena pelo "Sair". Desde então ele
//  sai também quando a sessão acaba (`vigiaDaSessao.js`), e isso pode
//  acontecer com a pessoa no meio de uma resposta: ela entraria de novo e a
//  resposta que estava escrevendo teria sumido, sem uma palavra.
//
//  Então os rascunhos moram aqui, fora do painel. Sobrevivem a ele sair e
//  voltar enquanto a página estiver aberta. Não vão para o disco: recarregar
//  ainda os perde, como perde os da ficha (`rascunhosDaFicha`).
//
//  POR PESSOA. Numa máquina dividida, quem entra depois na mesma aba não pode
//  encontrar na caixa o que a pessoa de antes escreveu para um cliente.
// ============================================================

const porPessoa = new Map();   // id de quem entrou → { [conversaId]: { texto, nota } }

/** Os rascunhos de quem entrou — o MESMO objeto a cada vez, para a mesma
 *  pessoa: o painel que volta encontra o que o de antes deixou. */
export function rascunhosDe(idDaPessoa) {
  const chave = String(idDaPessoa || "");
  let deles = porPessoa.get(chave);
  if (!deles) {
    deles = {};
    porPessoa.set(chave, deles);
  }
  return deles;
}

/** Guarda o que está na caixa como rascunho da conversa, ou apaga o rascunho
 *  se a caixa está vazia. Uma escrita só para os dois momentos em que a caixa
 *  sai de vista: a troca de conversa e o painel que sai de cena.
 *
 *  UMA EDIÇÃO EM CURSO NÃO VIRA RASCUNHO (auditoria de 07/10): o texto dela é
 *  a correção de uma mensagem que já foi, e de volta à conversa o Enter o
 *  mandaria como mensagem nova. */
export function guardarRascunho(rascunhos, conversaId, { texto, nota, editando }) {
  if (!rascunhos || !conversaId || editando) return;
  if (String(texto || "").trim()) rascunhos[conversaId] = { texto, nota: Boolean(nota) };
  else delete rascunhos[conversaId];
}
