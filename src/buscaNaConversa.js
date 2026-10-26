// ============================================================
//  A BUSCA DENTRO DA CONVERSA — a mesma conta no banco e na tela (26/10)
//
//  Pedido do Rodrigo: "Verifica para mim e me explica como está funcionando o
//  campo de pesquisa no Zorvin. Corrija possíveis bugs."
//
//  A lupa da conversa procurava SÓ no que estava na tela — as 120 últimas
//  mensagens — e COM acento. Numa conversa de 400 mensagens ela dizia "0"
//  para uma palavra dita no começo, e "conciliacao" não achava "CONCILIAÇÃO".
//  MEDIDO no banco do escritório: 84 conversas têm mais de 120 mensagens.
//
//  Agora ela pergunta ao banco, numa conversa só, por uma expressão regular
//  (`~*`, o `imatch` do PostgREST) em que cada letra aceita as suas versões
//  com acento. É a régua das pesquisas dos menus (`chaveDaPesquisa`): sem
//  acento, sem maiúscula, os espaços juntados.
//
//  POR QUE UMA EXPRESSÃO, e não a coluna sem acento: a busca da lista usa
//  `zorvin_sem_acento(texto)`, que mora numa função do banco. Para a conversa
//  aberta não precisa: o recorte por conversa já deixa a leitura pequena (a
//  maior conversa do escritório tem 2.178 mensagens), e não há script a rodar.
// ============================================================
import { chaveDaPesquisa } from "./pesquisaNosMenus.js";

/** Quantas mensagens achadas a busca traz de uma vez. Passando disso, a
 *  contagem diz "500+" — o teto é dito, e não escondido. */
export const TETO_DA_BUSCA_NA_CONVERSA = 500;

const VARIANTES = {
  a: "aáàâãäå", e: "eéèêë", i: "iíìîï", o: "oóòôõö", u: "uúùûü",
  c: "cç", n: "nñ", y: "yýÿ",
};

/** O padrão que o banco recebe: cada letra com acento possível vira a classe
 *  das suas versões — nas duas caixas, para não depender de como o banco
 *  compara maiúscula de letra acentuada —, os espaços viram "um ou mais", e o
 *  resto é escapado (um ponto de CPF não pode virar "qualquer caractere").
 *  A expressão do Postgres e a do JavaScript leem este padrão igual. */
export function padraoSemAcento(termo) {
  const base = chaveDaPesquisa(termo);
  let saida = "";
  for (const ch of base) {
    if (ch === " ") { saida += "\\s+"; continue; }
    const v = VARIANTES[ch];
    if (v) { saida += `[${v}${v.toUpperCase()}]`; continue; }
    saida += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return saida;
}

/** Este texto casa com o que foi escrito? A conta da tela — para o que mora
 *  só nela (as notas, as respostas automáticas, as bolhas que não saíram) e
 *  para o contorno de cada bolha achada. */
export function casaSemAcento(texto, termo) {
  const base = chaveDaPesquisa(termo);
  if (!base) return false;
  return chaveDaPesquisa(texto).includes(base);
}
