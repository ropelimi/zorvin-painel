// A JANELA DE UM DIA — "1 day", como o Postgres escreve (auditoria de 28/10)
//
// A tela da resposta fora do horário diz até quando a conversa conta como "em
// andamento" ("nas 2 horas antes"), lendo o intervalo que o banco devolve
// (`zorvin_carencia_da_espera`). `minutosDaJanela` lia "00:30:00" e
// "1 day 02:00:00", e NÃO lia "1 day" nem "2 days" — que é exatamente como o
// Postgres escreve um intervalo de dias inteiros, sem hora nenhuma. A frase
// caía no "pouco antes", escondendo uma janela de 24 horas configurada de
// propósito.
//
// O QUE ESTA PROVA GUARDA (só a regra — `src/foraDoHorario.js`):
//   1. "1 day" e "2 days" viram 1440 e 2880 minutos, e a frase diz as horas;
//   2. o que já se lia continua igual, e o que não é intervalo continua `null`.
import { minutosDaJanela, fraseDaJanela } from "../src/foraDoHorario.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (v) => JSON.stringify(v);

console.log("\nDias inteiros, sem hora");
{
  ok('"1 day" é um dia', minutosDaJanela("1 day") === 1440, q(minutosDaJanela("1 day")));
  ok('"2 days" são dois', minutosDaJanela("2 days") === 2880, q(minutosDaJanela("2 days")));
  ok("e a frase diz as horas, e não \"pouco antes\"",
     fraseDaJanela(minutosDaJanela("1 day")) === "nas 24 horas antes", fraseDaJanela(minutosDaJanela("1 day")));
}

console.log("\nO que já se lia continua igual");
{
  const lidos = ["00:30:00", "01:00:00", "1 day 02:00:00", "48:00:00"].map(minutosDaJanela);
  ok("horas, e dia com horas", q(lidos) === q([30, 60, 1560, 2880]), q(lidos));
  const nada = ["lixo", "", null, "00:00:00", "0 days", "day", "1 dia"].map(minutosDaJanela);
  ok("e o que não é janela continua sem número", nada.length === 7 && nada.every((m) => m === null), q(nada));
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
