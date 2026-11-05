// O MENU QUE ABRE PARA O LADO NÃO SAI DA JANELA (auditoria de 28/10).
//
// Os menus dos selos da linha do número (responsável, etapa, tarefas) e o
// painel de emojis da caixa de escrever abrem para a DIREITA de onde nascem.
// Com a conversa estreita — 348px a 768, o iPad em pé — eles passavam da
// borda: o "Tarefas desta conversa" ia até 933px numa tela de 768, a página
// inteira rolava de lado e o fim do menu sumia.
//
// Mede uma vez, ao aparecer, e empurra para dentro só o que faltou. Pela
// propriedade `translate`, e não por `transform`, para não brigar com quem
// usa `transform` no mesmo elemento. Fica fora dos componentes de propósito:
// estável, o React só a chama quando o elemento nasce — e não a cada desenho.
//
// MORA NUM ARQUIVO PRÓPRIO desde 05/11: os menus dos filtros da tela
// "Esperando resposta" usam a mesma conta, e duas cópias divergiriam no
// primeiro conserto.
export function encaixarNaJanela(el) {
  if (!el) return;
  el.style.translate = "";
  const r = el.getBoundingClientRect();
  const FOLGA = 8;
  let d = 0;
  if (r.right > window.innerWidth - FOLGA) d = window.innerWidth - FOLGA - r.right;
  if (r.left + d < FOLGA) d = FOLGA - r.left;
  if (d) el.style.translate = `${Math.round(d)}px 0`;
}
