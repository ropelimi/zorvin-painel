// OS TELEFONES DA BARRA LATERAL CABEM NA ALTURA DA TELA (02/11).
//
// Pedido do Rodrigo, com a foto: o departamento "Acordos" tem 8 telefones, e a
// barra mostrava 6. Os outros 2 só apareciam rolando a barra, e a barra não tem
// barra de rolagem à vista (`sem-scrollbar`): quem não sabe que eles existem
// não os acha. Medido na foto, a tela dele dá à barra 585 pontos de altura. Os
// telefones pediam 436 (8 de 42, com 12 entre eles), e os ícones de baixo, 266.
//
// O TAMANHO SAI DA ALTURA, e não de um número fixo menor. Com 42 fixos, a
// conta só fecha numa tela alta; com um número menor fixo, ela fecharia hoje e
// abriria de novo no dia em que um departamento ganhar mais telefones, ou numa
// janela que não está maximizada. Aqui o círculo encolhe só o necessário para
// caber TODOS, e nunca passa do tamanho de antes: numa tela que já cabia, nada
// muda.
//
// QUEM FAZ A CONTA É O NAVEGADOR, e não o React: a lista dos telefones é uma
// "caixa que se mede" (`container-type: size`), e `100cqh` é a altura dela. O
// navegador refaz a conta sozinho quando a janela muda de tamanho ou quando a
// faixa vermelha de aviso aparece no alto e encolhe a barra — sem medir nada
// por JavaScript, sem redesenhar duas vezes e sem o círculo piscar grande e
// depois pequeno.
//
// O VÃO ENCOLHE JUNTO: entre dois círculos de 42 há 12, e a proporção se
// mantém. Com o vão fixo, os círculos encolheriam sozinhos e a barra viraria
// uma fileira de bolinhas espaçadas.
//
// O PISO É 26. Abaixo disso a foto deixa de ser reconhecível e as iniciais
// ficam miúdas demais para ler. Se nem com 26 couber (11 telefones ou mais,
// numa tela como a dele), a barra rola, como antes — e aí o pé da lista ESMAECE
// enquanto houver telefone escondido embaixo, para quem olha saber que há mais.
//
// NO CELULAR, NADA ABAIXO DE 40. Lá todo botão tem 40 pontos de alvo de dedo
// (a regra do `@media` do painel), e um círculo menor do que o botão viraria
// uma oval. O celular rola a barra: a tela dele é alta, e o dedo rola sem
// pensar.

export const TELEFONE_MAIOR = 42;
export const TELEFONE_MENOR = 26;
export const TELEFONE_MENOR_NO_CELULAR = 40;
// O vão entre dois telefones quando eles têm o tamanho maior.
export const VAO = 12;
// O pé da lista que esmaece quando há telefone escondido embaixo. Ele ocupa o
// lugar do respiro que a lista tinha embaixo.
export const ESMAECER = 16;
// O traço antes das linhas desativadas: 1 de traço e 2 de cada lado.
export const DIVISOR = 5;
// Um ponto de folga: o navegador arredonda cada caixa a uma fração de pixel, e
// somados os arredondamentos não podem passar da altura e criar uma rolagem de
// meio ponto.
const FOLGA = 1;

/** A proporção do vão: o vão de agora é o tamanho de agora vezes isto. */
export const PROPORCAO_DO_VAO = VAO / TELEFONE_MAIOR;

/** O tamanho do círculo dos telefones, como uma conta de CSS.
 *
 *  `n` é quantos círculos a lista tem (os telefones e as linhas desativadas),
 *  `comDivisor` diz se há o traço das desativadas. Sem telefone, `null`.
 *
 *  A conta: `n` círculos de A, os vãos entre eles (A × proporção, um a mais
 *  quando há o traço, que tem vão dos dois lados) e o que é fixo (o traço e o
 *  pé que esmaece) têm de caber em `100cqh`. */
export function tamanhoDosTelefones(n, { comDivisor = false, menor = TELEFONE_MENOR } = {}) {
  const quantos = Math.max(0, Math.floor(Number(n) || 0));
  if (!quantos) return null;
  const vaos = quantos - 1 + (comDivisor ? 1 : 0);
  const k = quantos + vaos * PROPORCAO_DO_VAO;
  const fixo = ESMAECER + (comDivisor ? DIVISOR : 0) + FOLGA;
  const piso = Math.min(Math.max(menor, 0), TELEFONE_MAIOR);
  return `clamp(${piso}px, calc((100cqh - ${fixo}px) / ${Number(k.toFixed(4))}), ${TELEFONE_MAIOR}px)`;
}

/** O vão antes de um telefone (ou do traço), como conta de CSS sobre a
 *  variável que guarda o tamanho. */
export const VAO_CSS = `calc(var(--tam-telefone) * ${Number(PROPORCAO_DO_VAO.toFixed(4))})`;
