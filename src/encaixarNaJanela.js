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
//
// E O QUE PASSA DO PÉ DA TELA ROLA POR DENTRO (25/11). A varredura do celular
// achou o menu ⋮ da conversa num celular de 320×568 (o iPhone SE antigo) indo
// até depois do pé da tela: "Quem participou" e o que vem depois ficavam fora
// de alcance, e a tela da conversa não rola. Passando do pé, o menu ganha a
// altura que sobra e rola por dentro. Só quando sobra espaço para alguns itens
// (ALTURA_MINIMA): menor que isso, um menu de dois itens à vista seria pior do
// que o de antes. A altura e a rolagem escritas pelo React são guardadas e
// devolvidas a cada medida, para a conta partir sempre do menu como ele é.
const ALTURA_MINIMA = 160;
export function encaixarNaJanela(el) {
  if (!el) return;
  el.style.translate = "";
  el.style.marginLeft = "";
  if (!("alturaDoReact" in el.dataset)) {
    el.dataset.alturaDoReact = el.style.maxHeight;
    el.dataset.rolagemDoReact = el.style.overflowY;
  }
  el.style.maxHeight = el.dataset.alturaDoReact;
  el.style.overflowY = el.dataset.rolagemDoReact;
  const FOLGA = 8;
  const altura = Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight);
  const antes = el.getBoundingClientRect();
  const sobra = Math.floor(altura - FOLGA - antes.top);
  if (antes.bottom > altura - FOLGA && antes.top >= 0 && sobra >= ALTURA_MINIMA) {
    el.style.maxHeight = `${sobra}px`;
    el.style.overflowY = "auto";
  }
  const r = el.getBoundingClientRect();
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
