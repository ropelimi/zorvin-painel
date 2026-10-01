// HÁ QUANTOS DIAS — a conta da espera, num lugar só.
//
// Ela é feita em DOIS lugares da tela: o rótulo "esperando há N dias" da lista
// de conversas e a coluna "mais antiga" do relatório por responsável, no Painel
// de números. Duas escritas da mesma conta diriam dois números sobre o mesmo
// cliente — a lista "há 3 dias" e o relatório "há 2" —, e é por isso que ela
// mora aqui. As regras (dias corridos, por data de calendário) estão
// explicadas em `diasEsperando`, no Painel.

/** Quantos dias de calendário vão de `iso` até hoje. Zero para vazio ou data
 *  inválida. */
export function diasDesde(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  // Zera a hora dos dois lados antes de subtrair: assim a conta é de datas, e
  // o horário de verão não tira nem põe um dia.
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.max(0, Math.round((hoje - inicio) / 86400000));
}
