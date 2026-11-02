// ============================================================
//  O ACOMPANHAMENTO POR ETAPA — as contas sem tela (02/11)
//
//  Pedido do Rodrigo: quando o cliente fica parado numa etapa sem responder,
//  quem cuida dele recebe uma tarefa com a mensagem de cobrança já escrita, e
//  a pessoa abre, confere e manda. Quem decide quando o lembrete nasce é o
//  BANCO (script 045 da ponte, `zorvin_acompanhar_funil`), chamado pela ponte
//  de 10 em 10 minutos; a tela escreve as regras de cada etapa e oferece a
//  mensagem pronta na tarefa.
//
//  O LEMBRETE AUTOMÁTICO É A TAREFA COM MENSAGEM PRONTA E SEM QUEM CRIOU: só
//  o banco cria tarefa com `mensagem`, e o gatilho do 018 grava `criada_por`
//  com quem entrou — o Zorvin não é ninguém. E ele SE FECHA SOZINHO quando a
//  conversa anda (o cliente escreve, a equipe responde, alguém dá "Já
//  tratei", o cartão muda de etapa): aí ele termina sem `feita_por`.
// ============================================================
import { semATabela } from "./gravar.js";

export const DIAS_NO_MINIMO = 1;
export const DIAS_NO_MAXIMO = 60;
export const TETO_DA_MENSAGEM = 1000;

/** A tabela das regras falta (o 045 não rodou)? É o único "não tem": um
 *  tropeço qualquer da leitura é dito, e não esconde a seção. */
export function semOAcompanhamento(erro) {
  return Boolean(erro) && semATabela(erro);
}

/** "Depois de 3 dias sem resposta" — a frase da regra, igual na lista e no
 *  formulário. */
export function fraseDaRegra(dias) {
  const n = Number(dias) || 0;
  return `Depois de ${n} ${n === 1 ? "dia" : "dias"} sem resposta do cliente`;
}

/** O que impede de salvar a regra, ou `null`. `outras` são as regras DA MESMA
 *  ETAPA (sem a que está sendo editada): duas com os mesmos dias seriam o
 *  mesmo lembrete escrito duas vezes, e o banco recusa (23505). */
export function conferirRegra({ dias, texto }, outras = []) {
  const n = Number(dias);
  if (!Number.isInteger(n) || n < DIAS_NO_MINIMO || n > DIAS_NO_MAXIMO) {
    return `Os dias vão de ${DIAS_NO_MINIMO} a ${DIAS_NO_MAXIMO}.`;
  }
  const t = String(texto || "");
  if (!t.trim()) return "Escreva a mensagem pronta: é o que a pessoa vai conferir e mandar.";
  if (t.length > TETO_DA_MENSAGEM) return `A mensagem pode ter até ${TETO_DA_MENSAGEM} caracteres.`;
  if (outras.some((r) => Number(r.dias) === n)) return `Já existe um lembrete de ${n} ${n === 1 ? "dia" : "dias"} nesta etapa.`;
  return null;
}

/** A tarefa é um lembrete de acompanhamento (o banco a criou)? */
export function ehLembreteAutomatico(t) {
  return Boolean(t && t.mensagem && !t.criada_por);
}

/** O lembrete se fechou sozinho, porque a conversa andou? */
export function fechouSozinho(t) {
  return ehLembreteAutomatico(t) && Boolean(t.feita_em) && !t.feita_por;
}
