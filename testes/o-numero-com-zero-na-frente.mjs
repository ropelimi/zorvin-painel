// O NÚMERO COM O ZERO NA FRENTE — "(071) 99001-2345" (auditoria de 28/10)
//
// Muita gente ainda escreve o DDD com o zero da ligação interurbana, como se
// discava antigamente: "(071) 99001-2345". `numeroCanonico` tirava a
// pontuação e contava os dígitos — 12 — e, como não eram 10 nem 11, tratava
// como número ESTRANGEIRO e gravava "071990012345". A mensagem ia para um
// número que não existe, e a resposta do cliente, que chega pelo WhatsApp como
// "5571990012345", nascia num SEGUNDO contato. O fixo com zero ("(011)
// 3333-4444", 11 dígitos) era pior: ganhava um 55 na frente do zero.
//
// O que NÃO foi consertado, e está escrito aqui embaixo de propósito: o "+" de
// um número de fora. Ver a última seção.
//
// O QUE ESTA PROVA GUARDA (só regras — `src/numeros.js`, contra a ponte):
//   1. o zero da frente sai quando o que vem depois é um DDD que existe;
//   2. sem DDD de verdade depois do zero (0800), nada é inventado;
//   3. nos números que a PONTE também trata — o que o banco guarda, o que o
//      WhatsApp manda, o que o Vantoro manda —, o painel e a ponte continuam
//      dando o MESMO resultado. A regra da ponte é lida do arquivo dela;
//   4. o que o painel grava, a ponte manda como está: ela não mexe de novo.
import { numeroCanonico } from "../src/numeros.js";
import { readFileSync } from "node:fs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

console.log("\nO zero da ligação interurbana sai");
{
  ok("celular: (071) 99001-2345", numeroCanonico("(071) 99001-2345") === "5571990012345",
     numeroCanonico("(071) 99001-2345"));
  ok("celular na forma antiga: (071) 9001-2345", numeroCanonico("(071) 9001-2345") === "557190012345",
     numeroCanonico("(071) 9001-2345"));
  ok("fixo: (011) 3333-4444", numeroCanonico("(011) 3333-4444") === "551133334444",
     numeroCanonico("(011) 3333-4444"));
  ok("e só os dígitos, sem máscara", numeroCanonico("071990012345") === "5571990012345",
     numeroCanonico("071990012345"));
}

console.log("\nSem um DDD de verdade depois do zero, nada é inventado");
{
  // 0800 não é DDD: tirar o zero faria "80" virar DDD.
  ok("0800 não vira o DDD 80", !numeroCanonico("0800 123 4567").startsWith("5580"),
     numeroCanonico("0800 123 4567"));
  ok("e o resto continua como era", numeroCanonico("11999998888") === "5511999998888"
     && numeroCanonico("5511999998888") === "5511999998888" && numeroCanonico("351912345678") === "351912345678",
     [numeroCanonico("11999998888"), numeroCanonico("5511999998888"), numeroCanonico("351912345678")].join(" · "));
}

// A REGRA DA PONTE, lida do arquivo dela — como em `numeros.mjs`. É ela que
// limpa o número na hora de mandar (`numeroLimpo`, na fila de envio).
const PONTE = "../../zorvin-bridge/index.js";
let ponte = null;
try {
  const fonte = readFileSync(new URL(PONTE, import.meta.url), "utf8");
  const m = fonte.match(/function numeroLimpo\(bruto\)\s*\{[\s\S]*?\n\}/);
  if (m) ponte = new Function("bruto", m[0] + "\nreturn numeroLimpo(bruto);");
} catch (_) { /* a ponte não está do lado; dito abaixo */ }

console.log("\nPainel e ponte continuam iguais no que a ponte também trata");
ok("consegui ler a regra da ponte para comparar", !!ponte,
   `não achei ${PONTE} — sem ela o acordo fica sem vigia`);
if (ponte) {
  // O QUE CHEGA À PONTE: o que o banco guarda, o JID do WhatsApp (só dígitos,
  // com o país) e o que o Vantoro manda (sem o 55, às vezes com máscara).
  const DA_PONTE = ["5511999998888", "551133334444", "557190012345", "5571990012345", "351912345678",
                    "11999998888", "(11) 99999-8888", "1133334444", "120363000000000001"];
  const diferentes = DA_PONTE.filter((n) => numeroCanonico(n) !== ponte(n));
  ok("o mesmo resultado em todos", diferentes.length === 0,
     diferentes.map((n) => `${n}: painel ${numeroCanonico(n)} vs ponte ${ponte(n)}`).join("; "));

  // O QUE O PAINEL GRAVA, A PONTE MANDA COMO ESTÁ. É isto que faz o conserto
  // do zero valer sem mexer na ponte: "5571990012345" não muda lá.
  const ESCRITOS = ["(071) 99001-2345", "(071) 9001-2345", "(011) 3333-4444", "0800 123 4567",
                    "11999998888", "+55 (11) 99999-8888", "351912345678"];
  const mexidos = ESCRITOS.filter((n) => ponte(numeroCanonico(n)) !== numeroCanonico(n));
  ok("o que o painel grava, a ponte não muda", mexidos.length === 0,
     mexidos.map((n) => `${n}: grava ${numeroCanonico(n)}, a ponte manda ${ponte(numeroCanonico(n))}`).join("; "));

  // O DEFEITO CONHECIDO — o "+" de um número de fora —, registrado como está.
  //
  // "+1 (407) 555-0123" vira "5514075550123", e "+51 912 345 678" vira um
  // celular de Porto Alegre. Ler o "+" AQUI não conserta: o painel gravaria
  // "14075550123" (11 dígitos), e a ponte, ao mandar, poria o 55 de volta —
  // ela não tem como saber que aquele número veio com "+". É uma mudança
  // combinada (o formato gravado, ou a regra da ponte), e não uma limpeza
  // daqui. Se alguém fizer só a metade do painel, esta conferência avisa.
  ok("o \"+\" de fora ainda não é lido — defeito conhecido, e precisa da ponte junto",
     numeroCanonico("+1 (407) 555-0123") === "5514075550123" && ponte("14075550123") === "5514075550123",
     `painel ${numeroCanonico("+1 (407) 555-0123")}, ponte ${ponte("14075550123")}`);
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
