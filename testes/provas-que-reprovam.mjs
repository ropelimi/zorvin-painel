// A PROVA QUE VIGIA AS OUTRAS PROVAS.
//
// Ela não abre navegador: lê o CÓDIGO das provas da pasta (com o olho de
// `olho-nas-provas.mjs`) e reprova quando acha uma conferência que não
// consegue reprovar — `.every()` sobre lista que pode vir vazia, laço que pode
// rodar zero vezes, `ok()` dentro de um `if` que ninguém conferiu antes.
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
// Se ela reprovar por um caso legítimo que não entende, o certo é ensiná-la o
// caso — não silenciá-la.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analisar, NAO_SAO_PROVAS } from "./olho-nas-provas.mjs";

const PASTA = dirname(fileURLToPath(import.meta.url));

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

console.log("\nNenhuma conferência da bancada pode passar sem conferir");
{
  const todos = [];
  for (const arq of readdirSync(PASTA).filter((f) => f.endsWith(".mjs")).sort()) {
    if (NAO_SAO_PROVAS.has(arq)) continue;
    const fonte = readFileSync(join(PASTA, arq), "utf-8");
    try {
      todos.push(...analisar(fonte, arq));
    } catch (e) {
      todos.push(`${arq} — não consegui ler: ${e.message}`);
    }
  }
  ok("nenhuma conferência que não consegue reprovar", todos.length === 0,
     "\n     • " + todos.join("\n     • "));
}

console.log("\nE a vigia sabe achar o defeito (senão ela passaria sempre)");
{
  // SEM ESTAS TRÊS, um erro que fizesse `analisar` devolver sempre lista vazia
  // deixaria a conferência de cima verde para sempre — que é exatamente o
  // defeito que este arquivo existe para caçar, agora dentro dele mesmo.
  const CASOS = [
    ["every sem tamanho",
     'const l = f(); ok("x", l.every((n) => n > 0));'],
    ["laço que pode não rodar",
     'const l = f(); for (const x of l) { ok("x", x > 0); }'],
    ["if calado",
     'const el = f(); if (el) { ok("x", el.largura > 10); }'],
  ];
  for (const [nome, codigo] of CASOS) {
    ok(`pega: ${nome}`, analisar(codigo).length === 1,
       JSON.stringify(analisar(codigo)));
  }

  const BONS = [
    ["every com tamanho junto",
     'const l = f(); ok("x", l.length === 2 && l.every((n) => n > 0));'],
    ["every com tamanho conferido antes",
     'const l = f(); ok("tem", l.length > 0); ok("x", l.every((n) => n > 0));'],
    ["laço sobre lista escrita ali",
     'const casos = [["a", 1], ["b", 2]]; for (const c of casos) { ok("x", !!c); }'],
    ["if depois de conferir a condição",
     'const el = f(); ok("achei", !!el); if (el) { ok("x", el.largura > 10); }'],
  ];
  for (const [nome, codigo] of BONS) {
    ok(`deixa em paz: ${nome}`, analisar(codigo).length === 0,
       JSON.stringify(analisar(codigo)));
  }
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
