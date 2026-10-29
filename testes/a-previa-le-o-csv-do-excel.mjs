// A PRÉVIA LÊ O CSV DO EXCEL — "João", e não "Jo�o" (auditoria de 28/10)
//
// A miniatura de um arquivo de texto (CSV, TXT) mostra o começo dele na bolha,
// e `comecoDoTexto` lia SEMPRE como UTF-8. O Excel em português salva o CSV em
// Windows-1252 — o "ã" é UM byte (0xE3), que não é UTF-8 válido —, e a bolha
// mostrava "Jo�o;S�o Paulo". O arquivo está certo; quem o abre no Excel vê
// "João". A tela é que dizia que ele chegou estragado.
//
// O QUE ESTA PROVA GUARDA (só a regra, sem navegador — `src/arquivos.js`):
//   1. o CSV em Windows-1252 sai com os acentos certos;
//   2. o arquivo em UTF-8 continua saindo igual — inclusive o CORTADO no meio
//      de uma letra acentuada (a prévia lê só o começo), que não pode ser
//      confundido com Windows-1252 por causa do último byte.
import { comecoDoTexto } from "../src/arquivos.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

/** Um arquivo de mentira com estes bytes, servido como o navegador serve um
 *  arquivo local (`data:`) — o `fetch` do Node lê igual. */
const arquivo = (bytes) => `data:text/csv;base64,${Buffer.from(bytes).toString("base64")}`;

console.log("\nO CSV do Excel em português (Windows-1252)");
{
  // "Nome;Cidade\r\nJoão;São Paulo" com o ã de um byte só, como o Excel grava.
  const bytes = [...Buffer.from("Nome;Cidade\r\nJo", "latin1"), 0xE3, ...Buffer.from("o;S", "latin1"),
                 0xE3, ...Buffer.from("o Paulo", "latin1")];
  const t = await comecoDoTexto(arquivo(bytes));
  ok("os acentos saem certos", t === "Nome;Cidade\r\nJoão;São Paulo", JSON.stringify(t));
  ok("e sem o losango de letra estragada", !/�/.test(t || ""), JSON.stringify(t));
  // As aspas curvas e o travessão do Word também são de um byte nessa tabela.
  const t2 = await comecoDoTexto(arquivo([0x93, ...Buffer.from("ok", "latin1"), 0x94, 0x20, 0x96, 0x20, 0xE7]));
  ok("e as aspas curvas, o travessão e o ç também", t2 === "“ok” – ç", JSON.stringify(t2));
}

console.log("\nO arquivo em UTF-8 continua igual");
{
  const t = await comecoDoTexto(arquivo(Buffer.from("Nome;Cidade\nJoão;São Paulo", "utf8")));
  ok("UTF-8 lido como UTF-8", t === "Nome;Cidade\nJoão;São Paulo", JSON.stringify(t));
  // O CORTE NO MEIO DA LETRA: "ação" em UTF-8 é 61 C3 A7 C3 A3 6F; lendo só os
  // quatro primeiros bytes, o último C3 é meia letra. Isso é UTF-8 cortado, e
  // não Windows-1252 — lido pela tabela errada viraria "aÃ§Ã".
  const cortado = await comecoDoTexto(arquivo(Buffer.from("ação", "utf8")), 4);
  ok("cortado no meio da letra, sai a parte inteira", cortado === "aç", JSON.stringify(cortado));
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
