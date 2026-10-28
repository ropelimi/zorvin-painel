// A MARCA ENCOSTA NA PALAVRA — o negrito do duplo clique (auditoria de 28/10)
//
// O duplo clique do Windows seleciona a palavra E o espaço depois dela. A
// barra punha as marcas em volta da seleção crua:
//
//     calcularFormato("oi tudo bem", 0, 3, "negrito")  →  "*oi *tudo bem"
//
// e o WhatsApp não aplica `*oi *`: a marca de fechar precisa encostar numa
// letra. O cliente recebia dois asteriscos soltos, e quem formatou não tinha
// como saber — na caixa de escrever o texto parece certo.
//
// O QUE ESTA PROVA GUARDA (só regras, sem navegador — `src/formatacao.js`):
//   1. pôr a marca com espaço no fim, no começo, ou nos dois lados da seleção
//      deixa o espaço FORA das marcas, e a seleção volta para a palavra;
//   2. TIRAR também: `*oi* ` selecionado com o espaço desfaz o negrito, em vez
//      de embrulhar tudo de novo;
//   3. o que já funcionava continua: seleção sem espaço, e o cursor sem
//      seleção.
import { calcularFormato, aplicar } from "../src/formatacao.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const r = (t, i, f, fmt) => aplicar(t, calcularFormato(t, i, f, fmt));

console.log("\nPôr a marca: o espaço da seleção fica do lado de fora");
{
  // O CASO DO RELATO: o duplo clique em "oi" pega "oi ".
  ok("palavra com o espaço depois", r("oi tudo bem", 0, 3, "negrito") === "*oi* tudo bem",
     r("oi tudo bem", 0, 3, "negrito"));
  ok("no meio da frase também", r("oi tudo bem", 3, 8, "italico") === "oi _tudo_ bem",
     r("oi tudo bem", 3, 8, "italico"));
  ok("com o espaço ANTES da palavra", r("oi tudo bem", 2, 7, "tachado") === "oi ~tudo~ bem",
     r("oi tudo bem", 2, 7, "tachado"));
  ok("e com espaço dos dois lados", r("oi tudo bem", 2, 8, "codigo") === "oi `tudo` bem",
     r("oi tudo bem", 2, 8, "codigo"));
  // A SELEÇÃO VOLTA PARA A PALAVRA, sem o espaço e sem as marcas: é o que
  // deixa encadear o itálico logo depois do negrito.
  const c = calcularFormato("oi tudo bem", 0, 3, "negrito");
  ok("e a seleção fica na palavra, sem o espaço",
     !!c && aplicar("oi tudo bem", c).slice(c.selecao[0], c.selecao[1]) === "oi",
     c ? JSON.stringify(c.selecao) : "sem cálculo");
  // A quebra de linha selecionada junto é o mesmo caso.
  ok("a quebra de linha também fica fora", r("oi\ntudo", 0, 3, "negrito") === "*oi*\ntudo",
     JSON.stringify(r("oi\ntudo", 0, 3, "negrito")));
}

console.log("\nTirar a marca: o espaço selecionado junto não atrapalha");
{
  ok("`*oi* ` com o espaço desfaz o negrito", r("*oi* tudo", 0, 5, "negrito") === "oi tudo",
     r("*oi* tudo", 0, 5, "negrito"));
  ok("e o itálico do meio, selecionado com os espaços em volta",
     r("a _oi_ b", 1, 7, "italico") === "a oi b", r("a _oi_ b", 1, 7, "italico"));
  ok("e com as marcas fora da seleção (`oi` dentro de `*oi*`)",
     r("*oi* tudo", 1, 3, "negrito") === "oi tudo", r("*oi* tudo", 1, 3, "negrito"));
}

console.log("\nO que já funcionava continua igual");
{
  ok("seleção sem espaço", r("oi mundo", 3, 8, "negrito") === "oi *mundo*", r("oi mundo", 3, 8, "negrito"));
  const vazio = calcularFormato("oi ", 3, 3, "negrito");
  ok("sem seleção, o cursor fica entre as marcas",
     aplicar("oi ", vazio) === "oi **" && vazio.selecao[0] === 4 && vazio.selecao[1] === 4,
     `${aplicar("oi ", vazio)} com cursor em ${JSON.stringify(vazio.selecao)}`);
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
