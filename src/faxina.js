// ============================================================
//  A FAXINA DA FILA (01/11) — as contas da tela, num lugar só
//
//  Recomendação nº 3 de 31/10: *"Uma tela de faxina da fila. As conversas
//  paradas há mais de um mês, uma embaixo da outra, cada uma com a última
//  mensagem à vista e o Finalizar a um clique."* Ver "A faxina da fila" no
//  CLAUDE.md.
//
//  PARADA é SEM MENSAGEM NENHUMA há mais de N dias (`ultima_atividade`), de
//  nenhum dos lados, e ainda não finalizada (Novos ou Em Atendimento). Não é
//  "esperando há mais de N dias": o cliente que escreveu há 40 dias e de novo
//  ontem espera desde 40 dias atrás e NÃO está parado — ele está ali, e a
//  resposta dele é responder, e não faxinar.
//
//  Medido em 01/11, só contando: 1.805 conversas não finalizadas, 1.058 sem
//  movimento há mais de 30 dias — e 286 dessas sem mensagem nenhuma. Das 772
//  de verdade, o cliente espera resposta em 295 e a equipe falou por último
//  nas outras 477.
// ============================================================

import { diasDesde } from "./espera.js";

/** Quantas por página. A página é também o teto do "marcar todas": o lote
 *  fica do tamanho que a tela mostra de uma vez, e cada finalização é
 *  conferida antes. */
export const PAGINA_DA_FAXINA = 50;

/** As opções de "parada há mais de". 30 é o padrão: é o "mais de um mês" da
 *  recomendação, e o que a medição de 01/11 contou. */
export const DIAS_DA_FAXINA = [15, 30, 60, 90];
export const DIAS_PADRAO_DA_FAXINA = 30;

/** A PAUSA ENTRE UMA FINALIZAÇÃO E OUTRA, num lote. Cada finalização é um
 *  aviso do tempo real para cada aba aberta do escritório (a conversa muda de
 *  aba), e cinquenta de uma vez são a rajada que entupiu o canal em 20/10.
 *  Com a pausa, um lote de 50 leva uns 30 segundos — e a tela mostra o
 *  andamento. */
export const PAUSA_ENTRE_FINALIZACOES_MS = 300;

/** Os dois grupos da faxina, e é a pergunta que muda o que fazer: */
export const GRUPOS_DA_FAXINA = [
  // O CLIENTE ESPERA RESPOSTA: a última palavra é dele. Pode ser um "obrigado"
  // — ou um pedido que ficou para trás. É o grupo que pede leitura.
  { chave: "cliente", rotulo: "O cliente espera resposta" },
  // A EQUIPE FALOU POR ÚLTIMO e o cliente nunca voltou: é a conversa que ficou
  // em "Em Atendimento" para sempre. É o grupo que se limpa em lote.
  { chave: "equipe", rotulo: "A equipe falou por último" },
];

/** O corte: quem não tem mensagem nenhuma desde ANTES disto está parado. São
 *  dias corridos de 24 horas, e não de calendário, porque a pergunta é "há
 *  mais de 30 dias ninguém escreve", e não "desde que dia". */
export function corteDaFaxina(dias, agora = new Date()) {
  return new Date(agora.getTime() - Number(dias) * 24 * 3600 * 1000);
}

/** "parada há 45 dias", pela régua de calendário da lista (`diasDesde`): a
 *  mesma conta do rótulo "esperando há N dias", que esta tela também mostra. */
export function diasParada(iso) {
  return diasDesde(iso);
}

export function ehGrupoDaFaxina(c) {
  return String(c?.contato?.numero || "").startsWith("grupo:");
}

/** A conversa mudou desde que a lista foi lida? É a pergunta que vem ANTES
 *  de cada finalização: o cliente que escreve enquanto a pessoa limpa a fila
 *  teria a mensagem dele coberta pela finalização — a regra do 028 não reabre
 *  por mensagem com data anterior ao clique —, e ninguém leria. */
export function mudouDesdeALista(daLista, agora) {
  if (!agora) return true;
  return String(agora.ultima_atividade || "") !== String(daLista.ultima_atividade || "");
}

/** "1 conversa" / "12 conversas". */
export function quantasConversas(n) {
  return n === 1 ? "1 conversa" : `${n} conversas`;
}

/** A frase do fim de um lote: o que foi, e o que não foi — a conversa que não
 *  foi finalizada fica na lista, marcada com o porquê. */
export function resumoDoLote(feitas, problemas, parou = false) {
  const p = Number(problemas) || 0;
  const base = feitas === 1 ? "1 conversa finalizada" : `${feitas} conversas finalizadas`;
  const resto = p ? `; ${p === 1 ? "1 não foi" : `${p} não foram`} — o motivo está em cada uma, na lista` : "";
  return `${base}${resto}${parou ? ". Você parou antes do fim" : ""}.`;
}
