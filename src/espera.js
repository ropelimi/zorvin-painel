// HÁ QUANTOS DIAS — a conta da espera, num lugar só.
//
// Ela é feita em DOIS lugares da tela: o rótulo "esperando há N dias" da lista
// de conversas e a coluna "mais antiga" do relatório por responsável, no Painel
// de números. Duas escritas da mesma conta diriam dois números sobre o mesmo
// cliente — a lista "há 3 dias" e o relatório "há 2" —, e é por isso que ela
// mora aqui. As regras (dias corridos, por data de calendário) estão
// explicadas em `diasEsperando`, no Painel.

/** A PARTIR DE QUANTOS DIAS o "esperando há N dias" fica VERMELHO — abaixo
 *  disso, âmbar. Vale para o rótulo da lista e para as linhas da tela
 *  Esperando resposta: desde 02/11 aquela tela mostra também as de 2 dias
 *  (`DIAS_DAS_ATRASADAS`, em `esperandoDemais.js`), e uma cor diferente lá
 *  diria que a mesma espera é mais grave numa tela do que na outra. */
export const DIAS_DO_VERMELHO = 3;

/** A COR DO "esperando há N dias", numa escrita só (revisão do leiaute,
 *  05/11): a lista e as linhas da tela Esperando resposta tinham cada uma o
 *  seu vermelho e o seu âmbar (#e5573f e #e53935, #8a6d00 e #7a5f00), e o
 *  vermelho dava 3,6:1 no branco — abaixo dos 4,5 da letra miúda, justamente
 *  no rótulo que diz quem espera há mais tempo. As cores moram no tema
 *  (`esperaVermelha` e `ambarTexto`), conferidas no fundo da lista e no da
 *  conversa escolhida, nos dois temas. */
export function corDaEspera(dias, C) {
  return dias >= DIAS_DO_VERMELHO ? C.esperaVermelha : C.ambarTexto;
}

/** OS SELOS COM NÚMERO, de letra branca (a ampulheta e o sino da barra, as
 *  abas da tela Esperando resposta). O vermelho e o âmbar de antes (#e53935 e
 *  #d99a1e) davam 4,2:1 e 2,4:1 com a letra branca, e o número do selo é
 *  miúdo. Estes dão 4,9:1 e 5,9:1, e são os mesmos em todo selo: o âmbar já
 *  era o da faixa de "não consegui carregar" do alto da tela. Revisão do
 *  leiaute, 05/11. */
export const VERMELHO_DO_SELO = "#d92b20";
export const AMBAR_DO_SELO = "#8a5a00";

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
