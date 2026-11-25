// O MENU QUE ABRE PARA O LADO NÃO SAI DA JANELA (auditoria de 28/10).
//
// Os menus dos selos da linha do número (responsável, etapa, tarefas) e o
// painel de emojis da caixa de escrever abrem para a DIREITA de onde nascem.
// Com a conversa estreita — 348px a 768, o iPad em pé — eles passavam da
// borda: o "Tarefas desta conversa" ia até 933px numa tela de 768, a página
// inteira rolava de lado e o fim do menu sumia.
//
// Mede uma vez, ao aparecer, e empurra para dentro só o que faltou. Fica fora
// dos componentes de propósito: estável, o React só a chama quando o elemento
// nasce — e não a cada desenho.
//
// MORA NUM ARQUIVO PRÓPRIO desde 05/11: os menus dos filtros da tela
// "Esperando resposta" usam a mesma conta, e duas cópias divergiriam no
// primeiro conserto.
//
// A LARGURA É A DO DOCUMENTO, E NÃO `innerWidth` (25/11). No celular, quando
// algo transborda, o navegador alarga a janela visível até caber, e
// `innerWidth` passa a dizer o tamanho do que transbordou: 465 numa tela de
// 390. Medido assim, o menu que passava da borda "cabia", e nada era empurrado
// para dentro (o menu da ordem ia até 464). `clientWidth` do documento continua
// sendo a tela de verdade, e no computador ainda desconta a barra de rolagem.
//
// E O EMPURRÃO É PELA MARGEM, E NÃO POR `translate` (25/11). Medido no
// Chromium: a largura da página é calculada quando o menu nasce, ainda fora da
// tela, e mudar só o `translate` não a recalcula. O menu aparecia dentro, e a
// página continuava rolando de lado, com 472 pontos numa tela de 390. A margem
// é posição de verdade, e a conta é refeita. Se a margem não mover o menu
// (o que pende da direita, `right`, não anda pela margem da esquerda), vale o
// `translate` de antes: esse menu só transborda pela ESQUERDA, e o que passa da
// borda esquerda não faz a página rolar.
export function encaixarNaJanela(el) {
  if (!el) return;
  el.style.translate = "";
  el.style.marginLeft = "";
  const r = el.getBoundingClientRect();
  const FOLGA = 8;
  const largura = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
  let d = 0;
  if (r.right > largura - FOLGA) d = largura - FOLGA - r.right;
  if (r.left + d < FOLGA) d = FOLGA - r.left;
  d = Math.round(d);
  if (!d) return;
  el.style.marginLeft = `${d}px`;
  if (Math.abs(el.getBoundingClientRect().left - r.left - d) > 1) {
    el.style.marginLeft = "";
    el.style.translate = `${d}px 0`;
  }
}
