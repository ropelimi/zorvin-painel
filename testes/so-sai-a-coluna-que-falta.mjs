// SÓ SAI A COLUNA QUE FALTA — e não a que o banco só citou (auditoria de 28/10)
//
// `colunaQueFalta` lia `column "x"` de QUALQUER mensagem do banco. Mas o
// Postgres cita a coluna em erros que nada têm a ver com ela faltar:
//
//     23502  null value in column "processo_reu" of relation "notas"
//            violates not-null constraint
//     42804  column "processo_id" is of type bigint but expression is of type text
//
// Lido como "falta a coluna", o gravador TIRAVA o campo, tentava de novo e
// ANOTAVA no lembrete da sessão — e dali em diante toda gravação saía sem ele,
// calada, até alguém apertar F5. É o defeito que o `gravar.js` nasceu para
// impedir (o processo das notas descartado por semanas), voltando por outra
// porta.
//
// O QUE ESTA PROVA GUARDA (só a regra — `src/gravar.js`):
//   1. o nome só é lido quando o CÓDIGO diz que a coluna falta (42703, do
//      Postgres, e PGRST204, do PostgREST) — os dois que a bancada e o resto do
//      arquivo já usam;
//   2. com 23502 e 42804, `gravarSemAsQueFaltam` devolve o erro como veio, não
//      tira nada e NÃO anota a coluna no lembrete;
//   3. e o caminho de sempre continua: a que falta de verdade sai, sozinha.
import { colunaQueFalta, gravarSemAsQueFaltam } from "../src/gravar.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const NAO_NULO = { code: "23502", message: 'null value in column "processo_reu" of relation "notas" violates not-null constraint',
                   details: "Failing row contains (...)." };
const TIPO_ERRADO = { code: "42804", message: 'column "processo_id" is of type bigint but expression is of type text' };

console.log("\nO nome só é lido quando o código diz que a coluna falta");
{
  ok("a violação de NOT NULL (23502) não vira nome", colunaQueFalta(NAO_NULO) === null,
     String(colunaQueFalta(NAO_NULO)));
  ok("o tipo errado (42804) também não", colunaQueFalta(TIPO_ERRADO) === null,
     String(colunaQueFalta(TIPO_ERRADO)));
  // O CONTRASTE: os dois mensageiros de "não existe" continuam sendo lidos.
  ok("42703 continua dizendo qual falta",
     colunaQueFalta({ code: "42703", message: 'column "autor_foto" of relation "notas" does not exist' }) === "autor_foto");
  ok("PGRST204 também",
     colunaQueFalta({ code: "PGRST204",
       message: "Could not find the 'autor_foto' column of 'notas' in the schema cache" }) === "autor_foto");
}

console.log("\nA gravação recusada por NOT NULL não tira a coluna — nem desta vez, nem das próximas");
{
  const lembrete = new Set();
  const recebidas = [];
  const gravar = async (linha) => { recebidas.push(linha); return { data: null, error: NAO_NULO }; };
  const r = await gravarSemAsQueFaltam(gravar,
    { conversa_id: "c1", texto: "oi", processo_reu: null, processo_id: 22 },
    ["processo_reu", "processo_id"], lembrete);
  ok("o erro volta como veio", r.error?.code === "23502", JSON.stringify(r.error));
  ok("nada foi tirado", JSON.stringify(r.perdidas) === "[]", JSON.stringify(r.perdidas));
  ok("uma tentativa só — não houve o que tentar de novo", recebidas.length === 1, `${recebidas.length} tentativas`);
  // ESTA É A QUE DESCREVE O ESTRAGO: com o nome no lembrete, a NOTA SEGUINTE —
  // a que tem o réu preenchido — sairia sem ele.
  ok("e a coluna NÃO entra no lembrete da sessão", !lembrete.has("processo_reu"), [...lembrete].join(", "));

  const depois = [];
  await gravarSemAsQueFaltam(async (linha) => { depois.push(linha); return { data: { id: "n2" }, error: null }; },
    { conversa_id: "c1", texto: "outra", processo_reu: "OPERADORA ZZ" }, ["processo_reu"], lembrete);
  ok("a nota seguinte leva o réu", depois[0]?.processo_reu === "OPERADORA ZZ", JSON.stringify(depois[0]));
}

console.log("\nA coluna que falta de verdade continua saindo sozinha");
{
  const lembrete = new Set();
  let recebida = null;
  const gravar = async (linha) => ("autor_foto" in linha
    ? { data: null, error: { code: "PGRST204", message: "Could not find the 'autor_foto' column of 'notas' in the schema cache" } }
    : (recebida = linha, { data: { id: "n3" }, error: null }));
  const r = await gravarSemAsQueFaltam(gravar, { conversa_id: "c1", texto: "oi", autor_foto: "f.png", processo_id: 22 },
    ["autor_foto", "processo_id"], lembrete);
  ok("gravou", !r.error, JSON.stringify(r.error));
  ok("tirando só a que faltava", JSON.stringify(r.perdidas) === '["autor_foto"]' && recebida?.processo_id === 22,
     `${JSON.stringify(r.perdidas)} · ${JSON.stringify(recebida)}`);
  ok("e ela entra no lembrete", lembrete.has("autor_foto"));
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
