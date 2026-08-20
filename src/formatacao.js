// FORMATAR O TEXTO NA CAIXA DE MENSAGEM — negrito, itálico, tachado, código,
// listas e citação, do jeito que o WhatsApp entende.
//
// O WhatsApp não tem editor de texto rico: ele lê MARCAS dentro do texto puro.
// `*assim*` chega em negrito no celular do cliente. Então formatar aqui é
// escrever essas marcas no lugar certo — e o que sai daqui é o mesmo texto que
// sairia se a pessoa digitasse os asteriscos à mão.
//
// ESTE ARQUIVO NÃO ENCOSTA NA TELA. Ele recebe o texto, onde começa e onde
// termina a seleção, e devolve o que trocar por quê. É o que permite provar as
// regras sem abrir navegador nenhum — e são as regras que erram, não os
// pixels.
//
// O QUE ELE DEVOLVE, e por que não é simplesmente o texto novo:
//
//    { de, ate, novo, selecao: [a, b] }
//
// "troque o pedaço entre `de` e `ate` por `novo`, e deixe a seleção em [a,b]".
// Devolver só o texto inteiro seria mais simples e destruiria o Ctrl+Z: quem
// aplica pode usar `insertText`, que é o comando que o navegador registra no
// desfazer. Perder o desfazer numa caixa de texto é um preço alto por uma
// função de enfeite.

// As marcas que envolvem a seleção. Uma letra de cada lado, como no WhatsApp.
const MARCAS = { negrito: "*", italico: "_", tachado: "~", codigo: "`" };

// Os que agem sobre a LINHA inteira, e não sobre o trecho selecionado. Citar
// meia frase não existe: a citação é da linha.
const PREFIXOS = { citar: "> ", marcadores: "- " };

/**
 * A lista que a barra desenha, na ordem em que aparece.
 *
 * Os atalhos são os do WhatsApp Web, ditados por quem pediu. Estão aqui e não
 * espalhados pela tela porque a legenda que aparece ao passar o mouse tem de
 * dizer exatamente a tecla que funciona — uma legenda que promete um atalho
 * que não existe é pior do que legenda nenhuma.
 *
 * `codigo` é a tecla que dá problema, e está anotado no lugar onde se mexe
 * nela: Ctrl+Shift+I é o atalho das ferramentas de desenvolvedor do Chrome, do
 * Edge e do Firefox, e o navegador o intercepta ANTES da página. Onde ele for
 * engolido, o botão da barra continua fazendo o serviço.
 */
export const FORMATOS = [
  { id: "negrito",    rotulo: "Negrito",              atalho: "Ctrl+B" },
  { id: "italico",    rotulo: "Itálico",              atalho: "Ctrl+I" },
  { id: "tachado",    rotulo: "Tachado",              atalho: "Ctrl+Shift+X" },
  { id: "codigo",     rotulo: "Código inline",        atalho: "Ctrl+Shift+I" },
  { id: "numerada",   rotulo: "Lista numerada",       atalho: "Ctrl+Shift+7" },
  { id: "marcadores", rotulo: "Lista com marcadores", atalho: "Ctrl+Shift+8" },
  { id: "citar",      rotulo: "Citar",                atalho: "Ctrl+Shift+." },
];

/**
 * Que formato esta tecla pede, se é que pede algum.
 *
 * Lê `code` e não `key` de propósito. Num teclado ABNT2 — que é o de todo mundo
 * aqui — o Ctrl+Shift+7 chega com `key` valendo "/" , e o Ctrl+Shift+. com
 * `key` valendo ":". Comparar por `key` faria os atalhos funcionarem no
 * teclado de quem escreveu o código e em mais nenhum.
 */
export function formatoDaTecla(e) {
  if (!e || !(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const code = e.code || "";
  if (!e.shiftKey) {
    if (code === "KeyB") return "negrito";
    if (code === "KeyI") return "italico";
    return null;
  }
  if (code === "KeyX") return "tachado";
  if (code === "KeyI") return "codigo";
  if (code === "Digit7") return "numerada";
  if (code === "Digit8") return "marcadores";
  if (code === "Period") return "citar";
  return null;
}

/** Onde começa a linha em que está a posição `p`. */
function inicioDaLinha(texto, p) {
  const quebra = texto.lastIndexOf("\n", Math.max(0, p - 1));
  return quebra === -1 ? 0 : quebra + 1;
}

/** Onde termina a linha em que está a posição `p` (antes do \n). */
function fimDaLinha(texto, p) {
  const quebra = texto.indexOf("\n", p);
  return quebra === -1 ? texto.length : quebra;
}

/**
 * Envolver ou desenvolver a seleção com uma marca.
 *
 * TIRAR É TÃO IMPORTANTE QUANTO PÔR. Um botão que só põe transforma dois
 * cliques em `**assim**`, que no WhatsApp não é negrito de coisa nenhuma — é
 * um asterisco solto de cada lado. Quem clica duas vezes está desfazendo, e a
 * barra tem de entender isso.
 *
 * As marcas podem estar DENTRO da seleção (a pessoa selecionou `*oi*` inteiro)
 * ou FORA dela (selecionou `oi` no meio de `*oi*`). Os dois casos são a mesma
 * intenção e os dois desfazem.
 */
function comMarca(texto, ini, fim, marca) {
  const dentro = texto.slice(ini, fim);

  // Caso 1: a seleção já é `*isto*`.
  if (dentro.length >= 2 * marca.length + 1
      && dentro.startsWith(marca) && dentro.endsWith(marca)) {
    const limpo = dentro.slice(marca.length, dentro.length - marca.length);
    return { de: ini, ate: fim, novo: limpo, selecao: [ini, ini + limpo.length] };
  }

  // Caso 2: as marcas estão logo fora da seleção.
  const antes = texto.slice(Math.max(0, ini - marca.length), ini);
  const depois = texto.slice(fim, fim + marca.length);
  if (antes === marca && depois === marca) {
    const de = ini - marca.length, ate = fim + marca.length;
    return { de, ate, novo: dentro, selecao: [de, de + dentro.length] };
  }

  // Caso 3: não tem marca — põe.
  //
  // Com a seleção VAZIA, o resultado é o cursor entre as duas marcas, pronto
  // para digitar. É o que acontece no WhatsApp Web ao apertar Ctrl+B sem ter
  // selecionado nada, e é o que faz o atalho servir para quem formata ANTES de
  // escrever, que é como muita gente escreve.
  const novo = marca + dentro + marca;
  return {
    de: ini, ate: fim, novo,
    selecao: dentro
      ? [ini + marca.length, ini + marca.length + dentro.length]
      : [ini + marca.length, ini + marca.length],
  };
}

/** As linhas que a seleção encosta, e onde elas começam e terminam no texto. */
function linhasDaSelecao(texto, ini, fim) {
  const de = inicioDaLinha(texto, ini);
  const ate = fimDaLinha(texto, fim);
  return { de, ate, linhas: texto.slice(de, ate).split("\n") };
}

/** Já é uma linha de lista numerada? ("1. ", "12. ") */
const RE_NUMERADA = /^\d+\.\s/;

/**
 * Pôr ou tirar um prefixo em todas as linhas que a seleção encosta.
 *
 * SÓ TIRA QUANDO TODAS JÁ TÊM. Com metade das linhas marcadas, o clique marca
 * O RESTO e deixa as marcadas em paz — que é a intenção óbvia de quem
 * selecionou o bloco inteiro e clicou. Tirar de umas e pôr em outras seria um
 * botão que embaralha.
 *
 * O `startsWith` na hora de acrescentar não é redundância com o `todasTem`:
 * sem ele, a linha que já era "- um" virava "- - um" — dois marcadores, e o
 * segundo aparecendo como texto na tela do cliente. Foi assim que saiu na
 * primeira versão, e só apareceu porque a prova mistura uma linha marcada com
 * uma linha limpa.
 */
function comPrefixo(texto, ini, fim, prefixo) {
  const { de, ate, linhas } = linhasDaSelecao(texto, ini, fim);
  const todasTem = linhas.every((l) => l.startsWith(prefixo));
  const novas = linhas.map((l) => (todasTem
    ? l.slice(prefixo.length)
    : (l.startsWith(prefixo) ? l : prefixo + l)));
  const novo = novas.join("\n");
  return { de, ate, novo, selecao: [de, de + novo.length] };
}

/**
 * A lista numerada, que é a única em que o prefixo muda de linha para linha.
 *
 * A numeração é sempre 1, 2, 3 a partir da primeira linha selecionada. Tentar
 * continuar a contagem de uma lista logo acima seria mais esperto e erraria
 * mais: bastaria uma linha em branco no meio para o palpite ficar errado e o
 * cliente receber uma lista que começa no 7.
 *
 * A numeração velha SAI antes de a nova entrar. Sem isso, numerar de novo um
 * bloco em que só uma linha já tinha número produzia "1. 1. um" — e renumerar
 * é justamente o que se faz depois de inserir uma linha no meio da lista.
 */
function comNumeracao(texto, ini, fim) {
  const { de, ate, linhas } = linhasDaSelecao(texto, ini, fim);
  const todasTem = linhas.every((l) => RE_NUMERADA.test(l));
  const novas = linhas.map((l, i) => (todasTem
    ? l.replace(RE_NUMERADA, "")
    : `${i + 1}. ${l.replace(RE_NUMERADA, "")}`));
  const novo = novas.join("\n");
  return { de, ate, novo, selecao: [de, de + novo.length] };
}

/**
 * O cálculo de uma formatação. Não toca em nada: só diz o que trocar.
 *
 * Devolve `null` quando não há o que fazer — formato desconhecido, ou uma
 * lista pedida sem cursor nenhum. Quem chama trata `null` como "não fiz nada",
 * e nada acontece.
 */
export function calcularFormato(texto, ini, fim, formato) {
  const t = String(texto == null ? "" : texto);
  let a = Math.max(0, Math.min(t.length, Number(ini) || 0));
  let b = Math.max(0, Math.min(t.length, Number(fim) || 0));
  if (a > b) [a, b] = [b, a];

  if (MARCAS[formato]) return comMarca(t, a, b, MARCAS[formato]);
  if (PREFIXOS[formato]) return comPrefixo(t, a, b, PREFIXOS[formato]);
  if (formato === "numerada") return comNumeracao(t, a, b);
  return null;
}

/**
 * O texto já com a troca aplicada. Serve para quem não tem `insertText` à mão
 * — e para as provas, que conferem o resultado e não o caminho.
 */
export function aplicar(texto, calculo) {
  if (!calculo) return String(texto == null ? "" : texto);
  const t = String(texto == null ? "" : texto);
  return t.slice(0, calculo.de) + calculo.novo + t.slice(calculo.ate);
}
