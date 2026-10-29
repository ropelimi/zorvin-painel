// A BUSCA PROCURA O QUE FOI ESCRITO — sem curinga escondido (auditoria de 28/10)
//
// `termoSeguro` tirava do termo o que QUEBRA o `or` do PostgREST (vírgula,
// parênteses, asterisco), e deixava passar o que o ILIKE do Postgres LÊ como
// comando:
//
//   `_`  vale "qualquer letra" — "a_b" achava "axb";
//   `%`  vale "qualquer coisa" — "100%" achava "1000";
//   `\`  faz a letra seguinte valer como ela mesma — e no fim do termo ela
//        caía em cima do `%` de fechar: "Silva\" virava `%Silva\%`, que só
//        acha quem tem "Silva%" no FIM do nome. O curinga do fim sumia.
//
// O conserto escapa os três, e eles passam a ser procurados como foram
// escritos.
//
// POR QUE AQUI E NÃO NA BANCADA: o `ilike` da bancada (`comoIlike`) não sabe o
// escape do Postgres — trata a barra como letra. Uma prova pela tela mediria a
// bancada. Esta mede a regra contra um ILIKE escrito com as regras do Postgres
// (`%`, `_` e a barra invertida como escape, que é o padrão do LIKE).
//
// O QUE ESTA PROVA GUARDA (`src/busca.js`):
//   1. todo termo acha o próprio texto — inclusive "Silva\";
//   2. e não acha o que não contém: o `_` e o `%` não são mais curingas;
//   3. o que já era tratado para o `or` continua (nada de vírgula ou
//      parêntese na condição), e o piso de três letras conta as letras
//      ESCRITAS, e não as barras do escape.
import { termoSeguro, condicoesDeNome } from "../src/busca.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

/** O ILIKE do Postgres: `%` é qualquer sequência, `_` é um caractere, e a
 *  barra invertida faz o caractere seguinte valer como ele mesmo. */
function ilike(valor, padrao) {
  const escapar = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re = "";
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === "\\") { i++; re += escapar(padrao[i] ?? ""); continue; }
    re += c === "%" ? "[\\s\\S]*" : c === "_" ? "[\\s\\S]" : escapar(c);
  }
  return new RegExp(`^${re}$`, "i").test(valor);
}

/** O padrão que a busca por nome manda para o banco, tirado da condição. */
const padraoDoNome = (termo) => {
  const c = condicoesDeNome(termo, "", false).find((x) => x.startsWith("nome.ilike."));
  return c ? c.slice("nome.ilike.".length) : null;
};

console.log("\nTodo termo acha o próprio texto");
{
  const casos = ["Silva\\", "100%", "maria_silva", "ELIANA ALVES", "c:\\pasta"];
  const falhos = casos.filter((t) => !(padraoDoNome(t) && ilike(`xx ${t} yy`, padraoDoNome(t))));
  ok("cada termo acha um nome que o contém", falhos.length === 0,
     falhos.map((t) => `"${t}" → ${padraoDoNome(t)}`).join(" · "));
  // O CASO DO ACHADO: a barra do fim não come mais o curinga de fechar.
  ok('"Silva\\" acha o texto com "Silva\\" no meio, e não só no fim',
     ilike("JOSE SILVA\\ RAMOS", padraoDoNome("Silva\\") || ""), padraoDoNome("Silva\\"));
}

console.log("\nE não acha o que não contém — o _ e o % deixaram de ser curinga");
{
  ok('"a_b" não acha "axb"', !ilike("axb", padraoDoNome("a_b") || ""), padraoDoNome("a_b"));
  ok('"100%" não acha "1000"', !ilike("1000", padraoDoNome("100%") || ""), padraoDoNome("100%"));
  ok('"_%_" não acha qualquer nome', !ilike("MARIA", padraoDoNome("_%_") || ""), padraoDoNome("_%_"));
}

console.log("\nO que já era tratado para o `or` continua");
{
  const conds = condicoesDeNome("SILVA, (JOAO)", "", true);
  ok("nenhuma condição leva vírgula ou parêntese no valor",
     conds.length === 3 && conds.every((c) => !/[,()]/.test(c)), JSON.stringify(conds));
  ok("o termo comum passa inteiro", termoSeguro(" ELIANA ALVES ") === "ELIANA ALVES", termoSeguro(" ELIANA ALVES "));
  // O PISO DE TRÊS LETRAS é das letras escritas: "a%" são duas, e com a barra
  // do escape seriam três — e uma condição que casa com meio escritório.
  ok('"a%" (duas letras) não vira condição de nome', condicoesDeNome("a%", "", true).length === 0,
     JSON.stringify(condicoesDeNome("a%", "", true)));
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
