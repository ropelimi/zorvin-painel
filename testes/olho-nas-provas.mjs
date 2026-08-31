// O OLHO QUE LÊ AS PROVAS — só a leitura, sem conferir nada.
//
// Mora separado de `provas-que-reprovam.mjs` por um motivo prático: aquele
// arquivo é uma PROVA, e prova roda ao ser importada. Sem esta separação não
// havia como a prova conferir o próprio analisador — nem como depurá-lo.
//
// Ele acha três formas, todas encontradas de verdade nesta bancada:
//
//   EVERY   `lista.every(...)` como condição do `ok`. `[].every(x => …)` é
//           `true` — verdade vazia. A lista sumir da tela deixa a prova verde,
//           e some justamente quando a tela quebrou.
//
//   VAZIO   `ok(...)` dentro de um laço sobre coleção que pode vir vazia. Laço
//           sobre lista vazia não roda nenhuma vez: passa sem conferir nada.
//
//   IF      `ok(...)` dentro de um `if` sem `else`, quando NADA conferiu a
//           condição antes. O elemento não apareceu, a conferência é pulada em
//           silêncio e a prova termina verde — com a tela quebrada.
//
// O QUE ELA JÁ PEGOU, e que estava verde na bancada:
//
//   dispensar-aviso  "a linha continua no banco, intacta" — a fila APAGADA
//                    passava, que é o oposto exato do prometido;
//   dispensar-aviso  "com o mesmo texto da mensagem que falhou" conferia só se
//                    havia ALGUM texto: reenviar a frase errada ao cliente
//                    passava;
//   celular          a medida do nome na lista era pulada quando o nome não
//                    aparecia — e não aparecer É o defeito;
//   celular          o menu do topo sumir pulava a conferência sobre o menu;
//   digitar          a ÚNICA régua de desempenho do arquivo era pulada quando a
//                    medição falhava.
//
// COMO ELA EVITA SER CHATA. Uma vigia que reclama do que está certo é uma
// vigia que alguém desliga. Então ela deixa em paz:
//   * laço sobre coisa escrita ali mesmo (`[["a", /a/]]`, ou um `const` com
//     lista literal no mesmo arquivo);
//   * `if` cuja condição JÁ foi conferida por um `ok` antes — o padrão certo,
//     "confere e só então entra";
//   * `.every(...)` acompanhado de um tamanho, na mesma condição ou num `ok`
//     anterior sobre a mesma lista.
//
// Se ela reprovar por um caso legítimo que não entende, o certo é ensiná-la o
// caso — não silenciá-la.
import * as acorn from "acorn";
import * as walk from "acorn-walk";

// Os arquivos da pasta que NÃO são provas: o corredor, o ajudante do navegador
// e este próprio olho. Uma lista só, exportada, porque o corredor precisa da
// mesma resposta — duas listas iguais divergem na primeira mudança, e a prova
// esquecida numa delas simplesmente não roda.
export const NAO_SAO_PROVAS = new Set(["rodar.mjs", "navegador.mjs",
                                       "olho-nas-provas.mjs"]);

const ehOk = (no) => no.type === "CallExpression"
  && no.callee.type === "Identifier" && no.callee.name === "ok";

function temOk(no) {
  let achou = false;
  walk.full(no, (n) => { if (ehOk(n)) achou = true; });
  return achou;
}

// O QUE UMA CONDIÇÃO REALMENTE CONFERE — o caminho inteiro, e não a raiz.
//
// `curta.bolhas` e `curta.ms` são coisas diferentes: ter conferido o número de
// bolhas não diz nada sobre a medida de tempo. Comparando só a raiz (`curta`),
// a régua de desempenho do `digitar` passava por "já conferida" por causa de
// uma conferência sobre outro campo do mesmo objeto — e ela era a única régua
// do arquivo.
const PALAVRAS = new Set(["await", "null", "true", "false", "undefined", "typeof",
                          "new", "of", "in", "return", "const", "let", "var"]);
// Cada caminho entra INTEIRO e também por partes: `curta.ms` rende `curta.ms`
// e `curta`. O caminho inteiro é o que separa "conferi o tempo" de "conferi as
// bolhas"; a raiz é o que faz `naFila.length` valer como conferência sobre
// `naFila`.
const atomos = (texto) => {
  const fora = new Set();
  for (const m of texto.matchAll(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g)) {
    const partes = m[0].split(".");
    for (let i = 1; i <= partes.length; i += 1) {
      const a = partes.slice(0, i).join(".");
      if (!PALAVRAS.has(a)) fora.add(a);
    }
  }
  return fora;
};

/** Analisa um arquivo e devolve a lista de conferências que não reprovam. */
export function analisar(fonte, nome = "(memória)") {
  const arvore = acorn.parse(fonte, { ecmaVersion: 2023, sourceType: "module" });
  const linhaDe = (pos) => fonte.slice(0, pos).split("\n").length;
  const trecho = (no) => fonte.slice(no.start, no.end);

  // O BLOCO QUE ENVOLVE CADA COISA.
  //
  // As seções da bancada são blocos `{ … }`, e cada uma declara as suas
  // próprias variáveis — `naFila` existe em três seções do `dispensar-aviso`,
  // uma em cada, sem relação nenhuma entre elas. Procurando no arquivo inteiro,
  // a conferência de uma seção "protegia" a de outra: foi assim que
  // `naFila.every(...)` passou por protegido por um `naFila.length` que estava
  // sessenta linhas acima, noutro bloco, sobre outra lista.
  const blocos = [];
  walk.full(arvore, (n) => {
    if (n.type === "BlockStatement" || n.type === "Program") blocos.push(n);
  });
  const blocoDe = (pos) => blocos
    .filter((b) => b.start <= pos && pos <= b.end)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start)).pop() || arvore;

  // Listas escritas no próprio arquivo: `const casos = [...]`. Um `for..of`
  // sobre uma delas não pode rodar zero vezes por acidente.
  const literais = new Set();
  walk.full(arvore, (n) => {
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier"
        && n.init && n.init.type === "ArrayExpression" && n.init.elements.length > 0) {
      literais.add(n.id.name);
    }
  });

  const condicoes = [];
  walk.full(arvore, (n) => {
    if (ehOk(n) && n.arguments[1]) {
      condicoes.push({ ate: n.start, texto: trecho(n.arguments[1]) });
    }
  });

  /** As conferências que valem para uma posição: antes dela, e no mesmo bloco. */
  const anteriores = (antesDe) => {
    const b = blocoDe(antesDe);
    return condicoes.filter((c) => c.ate < antesDe && c.ate >= b.start);
  };

  const jaConferidos = (antesDe) => {
    const vistos = new Set();
    for (const c of anteriores(antesDe)) {
      for (const a of atomos(c.texto)) vistos.add(a);
    }
    return vistos;
  };

  const temTamanhoSobre = (alvos, antesDe, propria) => {
    if (/\.(length|size)\b/.test(propria)) return true;
    return anteriores(antesDe).some((c) =>
      /\.(length|size)\b/.test(c.texto)
      && [...alvos].some((a) => atomos(c.texto).has(a)));
  };

  const achados = [];
  walk.full(arvore, (no) => {
    if (ehOk(no) && no.arguments[1]) {
      const cond = trecho(no.arguments[1]);
      if (/\.every\s*\(/.test(cond)) {
        // A LISTA de que se chamou `.every`, e a raiz dela: quem confere o
        // tamanho escreve `naFila.length`, não `naFila.every.length`.
        const chamadas = [...cond.matchAll(/([A-Za-z_$][\w$.()\][]*?)\.every\s*\(/g)]
          .map((m) => m[1]);
        const alvos = new Set(chamadas.flatMap((c) => [c, c.split(".")[0]]));
        if (!temTamanhoSobre(alvos, no.start, cond)) {
          achados.push(`${nome}:${linhaDe(no.start)} — `
            + `\`.every(...)\` sem conferir o tamanho: \`${cond.slice(0, 80)}\``);
        }
      }
    }

    if ((no.type === "ForOfStatement" || no.type === "ForInStatement") && temOk(no.body)) {
      const alvo = no.right;
      const literalAqui = ["ArrayExpression", "ObjectExpression", "TemplateLiteral",
                           "Literal"].includes(alvo.type);
      const raiz = (trecho(alvo).match(/^([A-Za-z_$][\w$]*)/) || [])[1];
      const seguro = literalAqui || (raiz && literais.has(raiz))
        || (raiz && temTamanhoSobre(new Set([raiz]), no.start, ""));
      if (!seguro) {
        achados.push(`${nome}:${linhaDe(no.start)} — `
          + `laço com ok() dentro, sobre \`${trecho(alvo).slice(0, 60)}\`, `
          + "que pode vir vazio");
      }
    }

    if (no.type === "IfStatement" && !no.alternate && temOk(no.consequent)) {
      const teste = trecho(no.test);
      const vistos = jaConferidos(no.start);
      const soltos = [...atomos(teste)].filter((a) => !vistos.has(a));
      if (soltos.length) {
        achados.push(`${nome}:${linhaDe(no.start)} — `
          + `ok() dentro de \`if (${teste.slice(0, 60)})\` sem else, e nada `
          + `conferiu ${soltos.slice(0, 3).map((s) => `\`${s}\``).join(", ")} antes: `
          + "se a condição for falsa, a prova passa sem conferir");
      }
    }
  });
  return achados;
}

