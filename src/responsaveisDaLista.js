// ============================================================
//  OS RESPONSÁVEIS DA LISTA (04/11)
//
//  Pedido do Rodrigo, com a foto do alto da lista: "Excluir a mensagem
//  'ATENDENDO COMO' e ao lado no número de telefone colocar uma opção de
//  selecionar o responsável pela conversa. Ao selecionar o responsável,
//  aparecer apenas as conversas do responsável, mostrando em 'Novos', 'Em
//  atendimento', 'Finalizados' e 'Não lidas' apenas as conversas
//  correspondentes ao responsável selecionado. Precisa ter a possibilidade de
//  selecionar mais de um responsável."
//
//  AS CONTAS QUE NÃO PRECISAM DE TELA, num lugar só: a lista que vem do banco,
//  o recorte da tela, o número de cada aba, o tempo real e o que o seletor
//  escreve perguntam todos aqui. Escrita em cada um, a regra divergiria no
//  primeiro conserto — e divergir aqui é a aba dizer um número e a lista
//  mostrar outra coisa.
//
//  A ESCOLHA é uma lista de ids de pessoa, e `SEM_RESPONSAVEL` para as
//  conversas que ninguém assumiu. Lista vazia é "todos": nenhum recorte.
// ============================================================

/** A marca das conversas sem responsável na escolha. Um id de pessoa é um
 *  uuid, e não há como os dois se confundirem. */
export const SEM_RESPONSAVEL = "sem";

/** A escolha como uma chave estável, para entrar nas dependências de quem lê
 *  a lista: a mesma escolha em qualquer ordem dá a mesma chave, e "" é
 *  ninguém escolhido. É a PERGUNTA que a lista faz ao banco — e não a lista
 *  em si, que seria um objeto novo a cada desenho. */
export function chaveDosResponsaveis(lista) {
  return [...new Set((lista || []).map((x) => String(x || "")).filter(Boolean))].sort().join(",");
}

/** O caminho de volta da chave. */
export function daChave(chave) {
  return chave ? String(chave).split(",").filter(Boolean) : [];
}

/** A conversa passa pela escolha? Sem ninguém escolhido, todas passam. */
export function passaNosResponsaveis(conversa, lista) {
  const escolhidos = lista || [];
  if (!escolhidos.length) return true;
  const dono = conversa && conversa.responsavel_id ? String(conversa.responsavel_id) : "";
  return dono ? escolhidos.includes(dono) : escolhidos.includes(SEM_RESPONSAVEL);
}

/** O MESMO RECORTE, NO BANCO. A lista vem em páginas de 200, e recortar só o
 *  que já está na tela mostraria "as da Jenifer entre as 200 mais recentes"
 *  com cara de "as da Jenifer" — a lista curta lida como completa, a
 *  armadilha do filtro de grupos.
 *
 *  As conversas sem responsável vão pelo `is.null`, e não por um `in` com
 *  nulo dentro: no Postgres, `responsavel_id in (…, null)` nunca casa com o
 *  nulo. */
export function recortarPelosResponsaveis(q, lista) {
  const escolhidos = lista || [];
  if (!escolhidos.length) return q;
  const ids = escolhidos.filter((x) => x !== SEM_RESPONSAVEL);
  const sem = escolhidos.includes(SEM_RESPONSAVEL);
  if (ids.length && sem) return q.or(`responsavel_id.in.(${ids.join(",")}),responsavel_id.is.null`);
  if (ids.length) return q.in("responsavel_id", ids);
  return q.is("responsavel_id", null);
}

/** Os argumentos da conta das abas (`zorvin_contar_situacoes`, script 046 da
 *  ponte). SEM ESCOLHA, NENHUM: a chamada continua a de antes, só com o
 *  telefone — a que um banco sem o 046 também entende. */
export function argumentosDaContagem(lista) {
  const escolhidos = lista || [];
  if (!escolhidos.length) return {};
  return {
    p_responsaveis: escolhidos.filter((x) => x !== SEM_RESPONSAVEL),
    p_sem_responsavel: escolhidos.includes(SEM_RESPONSAVEL),
  };
}

/** O primeiro nome, para o seletor caber ao lado do número: "Jenifer
 *  Gonçalves" vira "Jenifer". */
export function primeiroNome(nome) {
  const limpo = String(nome || "").trim();
  return limpo ? limpo.split(/\s+/)[0] : "";
}

/** As pessoas escolhidas na ordem do menu — você primeiro, depois pelo nome —,
 *  e as sem responsável no fim. */
function naOrdem(lista, nomeDe, meuId) {
  const pessoas = (lista || []).filter((x) => x !== SEM_RESPONSAVEL);
  return pessoas.slice().sort((a, b) => {
    if (meuId && String(a) === String(meuId)) return -1;
    if (meuId && String(b) === String(meuId)) return 1;
    return String(nomeDe(a) || "").localeCompare(String(nomeDe(b) || ""), "pt-BR");
  });
}

/** O QUE O SELETOR ESCREVE. Sem escolha, o nome do filtro ("Responsável"); com
 *  uma pessoa, o primeiro nome dela ("Você", se for quem está na tela); com
 *  mais de uma, o primeiro e quantas mais ("Jenifer +2"). O resto vai no
 *  `title` e no menu. */
export function rotuloDosResponsaveis(lista, nomeDe, meuId) {
  const escolhidos = lista || [];
  if (!escolhidos.length) return "Responsável";
  const pessoas = naOrdem(escolhidos, nomeDe, meuId);
  const sem = escolhidos.includes(SEM_RESPONSAVEL);
  const primeiro = pessoas.length
    ? (meuId && String(pessoas[0]) === String(meuId) ? "Você" : (primeiroNome(nomeDe(pessoas[0])) || "Alguém"))
    : "Sem responsável";
  const mais = pessoas.length + (sem ? 1 : 0) - 1;
  return mais > 0 ? `${primeiro} +${mais}` : primeiro;
}

/** QUAIS CONVERSAS A LISTA MOSTRA, por extenso — para a frase da lista
 *  vazia e o `title` do seletor, depois de "as conversas": "em que o
 *  responsável é Jenifer", "em que o responsável é você ou Jenifer", "sem
 *  responsável", "em que o responsável é Jenifer, ou sem responsável". ""
 *  sem escolha. "você", e não o nome de quem está na tela: é como o seletor
 *  escreve, e "de Rodrigo" na tela do Rodrigo faria procurar um homônimo. */
export function fraseDosResponsaveis(lista, nomeDe, meuId) {
  const escolhidos = lista || [];
  if (!escolhidos.length) return "";
  const nomes = naOrdem(escolhidos, nomeDe, meuId)
    .map((id) => (meuId && String(id) === String(meuId) ? "você" : (primeiroNome(nomeDe(id)) || "alguém da equipe")));
  const sem = escolhidos.includes(SEM_RESPONSAVEL);
  if (!nomes.length) return "sem responsável";
  const juntos = nomes.length === 1 ? nomes[0]
    : `${nomes.slice(0, -1).join(", ")} ou ${nomes[nomes.length - 1]}`;
  return `em que o responsável é ${juntos}${sem ? ", ou sem responsável" : ""}`;
}
