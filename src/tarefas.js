// ============================================================
//  TAREFAS E LEMBRETES — as contas, num lugar só (06/10)
//
//  Pedido do Rodrigo como terceiro passo para CRM: o "quando agir de novo".
//  A tarefa é de uma conversa, tem uma pessoa (`para_quem`) e uma hora
//  (`vence_em`). Quem vê a conversa vê as tarefas dela; só quem a recebeu é
//  avisado na hora. O banco é o script 018 da ponte.
//
//  A CONVERSA, A TELA DE TAREFAS, O FILTRO DA LISTA E O CARTÃO DO FUNIL dizem
//  "atrasada" e "hoje" pela MESMA régua, que mora aqui: quatro contas
//  divergiriam, e divergir é a tela de tarefas dizer "atrasada" de uma que a
//  conversa diz "hoje".
// ============================================================
import { rotuloDaHora, ANTECEDENCIA_MAXIMA_MS } from "./agenda.js";

/** O fim do dia de hoje, na hora local — "hoje" é o dia do relógio da parede. */
export function fimDeHoje(agora = new Date()) {
  const d = new Date(agora);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** "feita", "atrasada" (a hora já passou), "hoje" (vence até o fim do dia) ou
 *  "proxima". Atrasada vem antes de hoje: a das 9h, às 10h, está atrasada —
 *  dizer "hoje" dela é o mesmo que dizer que ainda dá tempo. */
export function situacao(t, agora = new Date()) {
  if (!t) return "proxima";
  if (t.feita_em) return "feita";
  const v = new Date(t.vence_em).getTime();
  if (!Number.isFinite(v)) return "proxima";
  if (v <= agora.getTime()) return "atrasada";
  if (v <= fimDeHoje(agora).getTime()) return "hoje";
  return "proxima";
}

/** Abertas na ordem de agir: a que venceu primeiro vem primeiro. */
export function ordenarAbertas(lista) {
  return (lista || []).filter((t) => !t.feita_em)
    .sort((a, b) => String(a.vence_em).localeCompare(String(b.vence_em)));
}

/** "hoje às 14:00", "amanhã às 09:00" — e a atrasada diz que atrasou: "era
 *  hoje às 09:00" sozinho se lê como horário marcado, e não como cobrança. */
export function rotuloDaTarefa(t, agora = new Date()) {
  const quando = rotuloDaHora(t.vence_em, agora);
  if (situacao(t, agora) === "atrasada") return `atrasada — era ${quando}`;
  return quando;
}

/** Por que esta hora NÃO serve para uma tarefa — ou `null`. Diferente da
 *  mensagem agendada, um lembrete para daqui a 30 segundos é legítimo
 *  ("ligar já já"); o que não serve é o passado, que nasceria atrasado. */
export function horaQueNaoServe(iso, agora = Date.now()) {
  if (!iso) return "Escolha o dia e a hora.";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Essa data não existe.";
  if (t <= agora) return "Essa hora já passou — escolha outra.";
  if (t - agora > ANTECEDENCIA_MAXIMA_MS) return "Marque para no máximo um ano à frente.";
  return null;
}

export const TETO_DO_TEXTO = 500;

/** A tabela não existe nesta base (script 018 não rodou)? */
export function semATabelaDeTarefas(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  return codigo === "42P01" || (codigo === "PGRST205" && /zorvin_tarefas/.test(String(erro.message || "")));
}

// ---- O aviso na hora ----
//
// O AVISO É POR NAVEGADOR, como o som escolhido: guarda-se aqui quais tarefas
// já tocaram, para que recarregar a página não toque de novo, e para que duas
// abas do Zorvin na mesma máquina não toquem a mesma tarefa duas vezes.
const CHAVE_AVISADAS = "zorvin-tarefas-avisadas";
const TETO_AVISADAS = 400;

/** A tarefa que venceu há mais tempo que isto não toca ao abrir o painel:
 *  doze tarefas de ontem tocando juntas às 8h é um susto, e não um aviso. Ela
 *  continua na contagem vermelha e na tela de tarefas. */
export const JANELA_DO_AVISO_MS = 12 * 60 * 60 * 1000;

export function lerAvisadas() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_AVISADAS) || "[]");
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

/** A CHAVE É O ID MAIS A HORA: uma tarefa adiada para amanhã é um lembrete
 *  novo, e tem de tocar de novo na hora nova. */
export function chaveDoAviso(t) {
  return `${t.id}@${t.vence_em}`;
}

export function marcarAvisadas(chaves) {
  try {
    const atual = [...lerAvisadas()];
    for (const c of chaves) if (!atual.includes(c)) atual.push(c);
    localStorage.setItem(CHAVE_AVISADAS, JSON.stringify(atual.slice(-TETO_AVISADAS)));
  } catch (_) { /* sem armazenamento: o aviso pode repetir, e só */ }
}

/** As tarefas que devem tocar AGORA: minhas, abertas, vencidas há menos que a
 *  janela, e que ainda não tocaram neste navegador. */
export function quemTocaAgora(lista, meuId, agora = Date.now(), avisadas = lerAvisadas()) {
  if (!meuId) return [];
  return (lista || []).filter((t) => {
    if (t.feita_em || String(t.para_quem || "") !== String(meuId)) return false;
    const v = new Date(t.vence_em).getTime();
    return Number.isFinite(v) && v <= agora && agora - v <= JANELA_DO_AVISO_MS
      && !avisadas.has(chaveDoAviso(t));
  });
}
