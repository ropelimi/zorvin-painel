// UM CAMPO DE PLANILHA (.csv) — a escrita das duas planilhas do Painel de
// números ("Protocolos de atendimento" e "Já tratei").
//
// ------------------------------------------------------------------
// O NOME QUE COMEÇA COM "=" NÃO VIRA FÓRMULA (auditoria de 27/10)
//
// O nome do cliente vem do WhatsApp, e é ele quem o escreve. Um contato
// chamado `=HIPERLINK("http://…";"Clique aqui")` chegava à planilha como
// FÓRMULA: o Excel a executa ao abrir o arquivo, e o link vai parar na tela de
// quem administra, com cara de dado do escritório. É o ataque conhecido como
// "injeção de fórmula em CSV".
//
// A defesa é a de sempre: o texto que começa com um dos caracteres que o Excel
// lê como fórmula (= + - @, e o tab e a quebra de linha que escondem um deles)
// ganha um apóstrofo na frente, e o Excel o mostra como texto. Número de
// verdade fica como está — "-3" continua sendo um número que se soma.
//
// E as aspas dobradas, como antes: é o que deixa um ";" ou uma quebra de
// linha dentro do campo sem partir a coluna.
// ------------------------------------------------------------------

const PARECE_FORMULA = /^[=+\-@\t\r]/;
const NUMERO = /^-?\d+(?:[.,]\d+)?$/;

export function campoDaPlanilha(valor) {
  let texto = String(valor ?? "");
  if (PARECE_FORMULA.test(texto) && !NUMERO.test(texto)) texto = "'" + texto;
  return `"${texto.replace(/"/g, '""')}"`;
}
