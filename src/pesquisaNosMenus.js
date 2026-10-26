// ============================================================
//  A PESQUISA DOS MENUS — uma conta só, para todos (23/10)
//
//  Pedido do Rodrigo, com foto do menu da seta: poder pesquisar pelo nome na
//  lista de etiquetas, e também no "Assumir" e nas "Etiquetas" da conversa. O
//  escritório tem 32 etiquetas e 23 pessoas (medido em 23/10), e achar
//  "Acordo Fechado - Ag. Minuta" rolando uma lista de 32 é mais lento do que
//  escrever "minuta".
//
//  A CONTA É A MESMA EM TODO MENU, e por isso mora aqui. Escrita em cada um,
//  o "joao" que acha "João" num menu deixaria de achar no vizinho — e quem não
//  acha conclui que a etiqueta não existe, e cria outra igual.
//
//  - SEM ACENTO E SEM MAIÚSCULA: "execucao" acha "Execução". No celular quase
//    ninguém põe o acento.
//  - CADA PALAVRA EM QUALQUER LUGAR, e não a frase colada: "minuta acordo"
//    acha "Acordo Fechado - Ag. Minuta". É o pedaço que a pessoa lembra, na
//    ordem em que ela lembra.
//  - CAMPO VAZIO (ou só com espaço) MOSTRA TUDO.
// ============================================================

/** A partir de quantos itens a lista ganha o campo de pesquisa.
 *
 *  A régua já estava escrita no menu de departamentos: "com quatro
 *  departamentos, um campo de busca é mais trabalho do que correr o olho".
 *  Ele mostra a busca quando passam de seis, e os menus novos seguem a mesma
 *  conta — sete itens já não cabem de uma vez num menu de 320px. */
export const PESQUISA_A_PARTIR_DE = 7;

/** O texto como a pesquisa o compara: sem acento, sem maiúscula, com os
 *  espaços juntados. */
export function chaveDaPesquisa(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/** Este item aparece com o que foi escrito no campo?
 *
 *  `campos` são os textos do item em que se procura (o nome; numa mensagem
 *  rápida, o título e o texto). Cada palavra escrita tem de aparecer em algum
 *  deles. */
export function casaComAPesquisa(pesquisa, ...campos) {
  const palavras = chaveDaPesquisa(pesquisa).split(" ").filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = chaveDaPesquisa(campos.filter((c) => c != null).join(" "));
  return palavras.every((p) => alvo.includes(p));
}

/** A frase de quando nada casa. Ela repete o que foi escrito, entre aspas:
 *  é ali que se vê o erro de digitação que explica a lista vazia. */
export function nadaComAPesquisa(oQue, pesquisa) {
  return `${oQue} com “${String(pesquisa ?? "").trim()}”.`;
}
