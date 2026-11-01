// ============================================================
//  O RESUMO DA CONVERSA — as contas que não precisam de tela (01/11)
//
//  Recomendação nº 4 de 31/10: um botão "Resumir" que diz em poucas linhas o
//  que o cliente quer, o que já foi combinado e o que falta. Quem fala com a
//  IA é a ponte (`POST /copiloto/resumir`); o painel desenha as três partes
//  (`ResumoDaConversa.jsx`) e faz as contas daqui.
// ============================================================

export const PARTES_DO_RESUMO = [
  { chave: "quer", titulo: "O que o cliente quer", vazio: "Não ficou claro na conversa." },
  { chave: "combinado", titulo: "O que já foi combinado", vazio: "Nada combinado ainda." },
  { chave: "falta", titulo: "O que falta", vazio: "Nada pendente." },
];

const contar = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O que a IA leu, numa frase. A conversa cortada é DITA: "a conversa
 *  inteira" no lugar de "as últimas 300" faria quem lê confiar num resumo
 *  que não viu o começo do caso. */
export function fraseDaLeitura({ mensagens = 0, notas = 0, cortou = false } = {}) {
  const asNotas = notas ? ` e ${contar(notas, "nota interna", "notas internas")}` : "";
  if (cortou) {
    return `Leu as últimas ${contar(mensagens, "mensagem", "mensagens")}${asNotas} — as mais antigas ficaram de fora.`;
  }
  return `Leu a conversa inteira: ${contar(mensagens, "mensagem", "mensagens")}${asNotas}.`;
}

const instante = (iso) => {
  const t = Date.parse(iso || "");
  return Number.isNaN(t) ? null : t;
};

/** Quantas mensagens de verdade (do cliente ou da equipe) chegaram depois da
 *  mais nova que o resumo leu (`ate`). A conta é pelo `criado_em` do banco,
 *  e não pelo relógio do computador de quem pediu. A bolha que ainda está
 *  saindo, a nota e os marcos não contam: o resumo fala da conversa. */
export function mensagensDepoisDoResumo(mensagens, ate) {
  const limite = instante(ate);
  if (limite === null) return 0;
  return (mensagens || []).filter((m) => {
    if (!m || (m.origem !== "contato" && m.origem !== "advogado")) return false;
    const id = String(m.id || "");
    if (id.startsWith("temp-") || id.startsWith("fila-")) return false;
    const t = instante(m.criado_em);
    return t !== null && t > limite;
  }).length;
}

/** O resumo em texto puro, para colar numa nota, num e-mail ou no Vantoro.
 *  Diz que foi feito pela IA: colado longe da tela, ele não pode passar por
 *  anotação de alguém da equipe. */
export function textoDoResumo(resumo, { nome = "", quando = "" } = {}) {
  const r = resumo || {};
  const lista = (v, vazio) => (v && v.length ? v.map((x) => `- ${x}`) : [`- ${vazio}`]);
  return [
    `Resumo da conversa${nome ? ` com ${nome}` : ""}${quando ? `, ${quando}` : ""} (feito pela IA do Zorvin)`,
    "",
    `${PARTES_DO_RESUMO[0].titulo}:`,
    r.quer || PARTES_DO_RESUMO[0].vazio,
    "",
    `${PARTES_DO_RESUMO[1].titulo}:`,
    ...lista(r.combinado, PARTES_DO_RESUMO[1].vazio),
    "",
    `${PARTES_DO_RESUMO[2].titulo}:`,
    ...lista(r.falta, PARTES_DO_RESUMO[2].vazio),
  ].join("\n");
}
