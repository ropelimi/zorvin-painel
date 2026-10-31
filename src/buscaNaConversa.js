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

// ============================================================
//  O QUE FOI DITO NOS ÁUDIOS (31/10)
//
//  Desde 31/10 a ponte transcreve sozinha todo áudio que chega, e o texto mora
//  em `mensagens.transcricao` (script 015). A lupa da conversa procura nas
//  duas colunas: o que foi escrito e o que foi dito. Quem procura
//  "comprovante" e não acha o áudio em que o cliente disse "mandei o
//  comprovante" conclui que ele não mandou.
// ============================================================

/** Esta mensagem casa com o que foi escrito na lupa — pelo texto, ou pela
 *  transcrição, se for um áudio? A conta da tela, para o contorno da bolha e
 *  para o que mora só nela. */
export function casaNaMensagem(m, termo) {
  if (!m) return false;
  return casaSemAcento(m.texto, termo) || casaSemAcento(m.transcricao, termo);
}

/** O banco sem a coluna da transcrição (o script 015 não rodou) responde
 *  42703 ao filtro por ela. É a falta da COLUNA, e não uma falha: a lupa
 *  procura só no texto, calada, como antes da transcrição existir. */
export function semAColunaDaTranscricao(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  return (codigo === "42703" || codigo === "PGRST204") && /transcricao/.test(String(erro.message || ""));
}

/** As achadas das duas perguntas (o texto e a transcrição), numa lista só,
 *  sem repetir a mesma mensagem e das mais recentes para as mais antigas —
 *  a ordem em que o banco respondeu cada uma. `{ id, em }`. */
export function juntarAchados(listas) {
  const porId = new Map();
  for (const lista of listas) {
    for (const m of lista || []) {
      const id = String(m.id);
      if (!porId.has(id)) porId.set(id, { id, em: m.criado_em });
    }
  }
  return [...porId.values()].sort((a, b) => (new Date(b.em) - new Date(a.em))
    || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
