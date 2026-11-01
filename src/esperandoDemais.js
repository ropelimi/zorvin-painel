// ============================================================
//  QUEM ESTÁ ESPERANDO DEMAIS (31/10) — as contas da tela, num lugar só
//
//  Pedido do Rodrigo, da lista de recomendações de 31/10: ao abrir o Zorvin,
//  cada pessoa vê quantas conversas dela esperam há 3 dias ou mais, com um
//  botão que mostra quais; e um aviso quando um cliente passa de 30 minutos
//  de expediente sem resposta. Ver "Quem está esperando demais" no CLAUDE.md.
//
//  OS MINUTOS DE EXPEDIENTE SÃO DO BANCO (`zorvin_clientes_sem_resposta`, o
//  script 041 da ponte), pela régua do horário que decide a resposta fora do
//  horário: uma segunda conta aqui divergiria dela no primeiro feriado. Aqui
//  ficam só as perguntas que dependem de QUEM está olhando — é para mim? já
//  tocou neste navegador? a conversa está aberta? — e as frases.
// ============================================================

import { diasDesde } from "./espera.js";

/** De quanto em quanto a tela pergunta. O aviso das 14h30 tem de tocar perto
 *  das 14h30, e a pergunta é pequena: os clientes da última semana ainda sem
 *  resposta, que no escritório eram 45 em 31/10. */
export const RELER_A_CADA_MS = 60 * 1000;

/** A PRIMEIRA PERGUNTA ESPERA a abertura do painel terminar. Ela vai à tabela
 *  de conversas (as minhas esperando há 3 dias ou mais), e na partida as idas a
 *  essa tabela saem todas juntas, numa rodada só — a prova `partida` mede isso,
 *  e uma consulta a mais no meio voltaria a fazer a abertura esperar em fila.
 *  Cinco segundos é depois de a lista aparecer, e antes de alguém ter escolhido
 *  a primeira conversa. */
export const ESPERA_ANTES_DA_PRIMEIRA_MS = 5 * 1000;

/** As minhas esperando há 3 dias ou mais vêm até este teto, as que esperam há
 *  mais tempo primeiro, e a tela diz quando cortou. A maior carteira do
 *  escritório tinha 56 em 31/10. */
export const TETO_DAS_ATRASADAS = 500;

/** O cliente que passou do limite há mais do que isto não toca: ele já está
 *  na lista e no número da barra. Sem a janela, quem abre o Zorvin às 10h
 *  ouviria de uma vez o aviso de todos os que passaram do limite às 9h30 —
 *  um susto, e não um aviso. Quinze minutos cobrem a pergunta de minuto em
 *  minuto com folga, e uma aba que caiu e voltou. */
export const JANELA_DO_AVISO_MIN = 15;

/** É PARA MIM? A régua do aviso de mensagem nova (13/10): a conversa com
 *  responsável é dele; a sem responsável é de todo mundo que a vê. */
export function ehParaMim(linha, meuId) {
  if (!linha) return false;
  return !linha.responsavel_id || (Boolean(meuId) && String(linha.responsavel_id) === String(meuId));
}

// ---- O aviso, uma vez só ----
//
// POR NAVEGADOR, como o lembrete das tarefas: recarregar a página não toca de
// novo, e duas abas do Zorvin na mesma máquina não tocam o mesmo cliente duas
// vezes. A CHAVE É O PROTOCOLO: o cliente que volta a escrever depois de
// finalizado abre um protocolo novo, e esse tem o seu próprio aviso.
const CHAVE_AVISADAS = "zorvin-esperas-avisadas";
const TETO_AVISADAS = 400;

export function chaveDoAviso(l) {
  return String(l.protocolo || l.conversa_id);
}

export function lerAvisadas() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_AVISADAS) || "[]");
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

export function marcarAvisadas(chaves) {
  try {
    const atual = [...lerAvisadas()];
    for (const c of chaves) if (!atual.includes(c)) atual.push(c);
    localStorage.setItem(CHAVE_AVISADAS, JSON.stringify(atual.slice(-TETO_AVISADAS)));
  } catch (_) { /* sem armazenamento: o aviso pode repetir, e só */ }
}

/** QUEM TOCA AGORA: é para mim, passou do limite há menos que a janela, a
 *  conversa não está aberta na minha tela (quem está olhando para ela não
 *  precisa ser avisado dela) e ainda não tocou neste navegador. */
export function quemAvisarAgora(linhas, meuId, conversaAberta, avisadas = lerAvisadas()) {
  return (linhas || []).filter((l) => {
    const min = Number(l.minutos), limite = Number(l.limite);
    if (!Number.isFinite(min) || !Number.isFinite(limite)) return false;
    return ehParaMim(l, meuId)
      && min >= limite && min < limite + JANELA_DO_AVISO_MIN
      && String(l.conversa_id) !== String(conversaAberta || "")
      && !avisadas.has(chaveDoAviso(l));
  });
}

// ---- As conversas que esperam há 3 dias ou mais ----

/** O começo do dia de anteontem, no relógio do navegador. Quem espera desde
 *  ANTES disso espera há 3 dias ou mais pela régua de `diasDesde` — a mesma do
 *  rótulo "esperando há N dias" da lista, que fica vermelho a partir de três.
 *  É o corte que vai ao banco; a tela confere de novo com `diasDesde`. */
export function corteDosTresDias(agora = new Date()) {
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 2);
}

export function esperaHaTresDias(iso) {
  return diasDesde(iso) >= 3;
}

// ---- As frases ----

/** "1 min", "47 min", "1 h", "1 h 12 min". */
export function rotuloDosMinutos(min) {
  const m = Math.max(0, Math.floor(Number(min) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** O limite dito numa frase: "há mais de 30 min", quando todos os clientes da
 *  lista são de departamentos com o mesmo limite; senão, "além do tempo do
 *  departamento" — escrever um número só, com limites diferentes, diria uma
 *  coisa falsa sobre metade da lista. */
export function fraseDoLimite(linhas) {
  const limites = [...new Set((linhas || []).map((l) => Number(l.limite)).filter(Number.isFinite))];
  return limites.length === 1 ? `há mais de ${rotuloDosMinutos(limites[0])}` : "além do tempo do departamento";
}

/** "1 cliente" / "3 clientes". */
export function quantosClientes(n) {
  return n === 1 ? "1 cliente" : `${n} clientes`;
}

/** "1 conversa sua" / "12 conversas suas". */
export function quantasConversasSuas(n) {
  return n === 1 ? "1 conversa sua" : `${n} conversas suas`;
}
