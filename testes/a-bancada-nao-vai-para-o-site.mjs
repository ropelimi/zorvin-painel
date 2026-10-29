// A BANCADA NÃO VAI PARA O SITE PUBLICADO (auditoria de 28/10)
//
// `src/supabase.js` importa a bancada de forma estática, e a escolha entre ela
// e o banco de verdade só acontece na hora de rodar. Como a bancada monta as
// tabelas de mentira no nível de cima do módulo, o Rollup não podia jogá-la
// fora: o build de PRODUÇÃO levava para o site — o JavaScript que qualquer
// pessoa baixa na tela de entrada — os nomes e telefones da bancada (alguns
// copiados de casos reais), o `__TABELAS` e o "jwt-de-mentira". 35 KB a mais.
//
// Agora o `vite.config.js` troca `./bancada.js` por `src/bancada-desligada.js` (vazio)
// quando o build não é da bancada.
//
// O QUE ESTA PROVA GUARDA
//   1. o build de produção (sem `VITE_BANCADA`) não tem nada da bancada, e é
//      mesmo o painel (a prova não pode passar olhando um arquivo vazio);
//   2. o build da bancada (`VITE_BANCADA=1`, o que as provas de desempenho
//      usam) continua com ela — senão aquelas provas rodariam sem banco.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** Faz um build numa pasta temporária e devolve o JavaScript inteiro dele. */
function construir(comBancada) {
  const pasta = mkdtempSync(join(tmpdir(), "zorvin-build-"));
  const env = { ...process.env };
  delete env.VITE_BANCADA;
  if (comBancada) env.VITE_BANCADA = "1";
  const r = spawnSync("npx", ["vite", "build", "--outDir", pasta, "--emptyOutDir", "--logLevel", "error"],
                      { cwd: RAIZ, env, encoding: "utf8" });
  let js = "";
  try {
    const assets = join(pasta, "assets");
    for (const f of readdirSync(assets)) if (f.endsWith(".js")) js += readFileSync(join(assets, f), "utf8");
  } catch (_) { /* sem a pasta: o build falhou, e o código abaixo diz */ }
  rmSync(pasta, { recursive: true, force: true });
  return { codigo: r.status, erro: (r.stderr || "").slice(0, 300), js };
}

// O que só existe na bancada: o bilhete de mentira, o espelho das tabelas que
// as provas leem e um dos contatos de mentira.
const DA_BANCADA = ["jwt-de-mentira", "__TABELAS", "Alcides (sem o 9)"];
// E o que só existe no painel: o texto da caixa de busca da lista.
const DO_PAINEL = "Buscar por nome";

console.log("\n1. O build de produção");
{
  const b = construir(false);
  ok("o build de produção passa", b.codigo === 0, b.erro);
  ok("e é mesmo o painel (a prova não está olhando um arquivo vazio)", b.js.includes(DO_PAINEL),
     `${b.js.length} caracteres de JavaScript`);
  const achados = DA_BANCADA.filter((t) => b.js.includes(t));
  ok("e não leva nada da bancada", b.js.length > 0 && achados.length === 0, `achei: ${achados.join(", ")}`);
}

console.log("\n2. O build da bancada continua com ela");
{
  const b = construir(true);
  ok("o build da bancada passa", b.codigo === 0, b.erro);
  const achados = DA_BANCADA.filter((t) => b.js.includes(t));
  ok("e leva a bancada inteira", achados.length === DA_BANCADA.length, `só achei: ${achados.join(", ")}`);
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
