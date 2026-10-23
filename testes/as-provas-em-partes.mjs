// AS PROVAS EM PARTES — a conta que decide o que cada máquina roda.
//
// Desde 23/10 a integração contínua roda as provas em três máquinas, e quem
// diz qual prova roda em qual delas é `rodar.mjs`. É ali que uma prova pode
// deixar de rodar sem nada reprovar: uma conta que esquece uma prova, duas
// máquinas na mesma parte, uma variável que chega vazia e faz uma máquina
// rodar tudo. Esta prova chama o próprio `rodar.mjs` com `--listar`, que diz o
// que rodaria sem subir servidor nem navegador, e confere a resposta.
//
// TODA CHAMADA DAQUI LEVA `--listar`. Sem ele, um defeito numa recusa faria a
// chamada rodar as provas de verdade, de dentro de uma prova.
//
// E A PORTA DA BANCADA FICA OCUPADA enquanto esta prova roda. Dentro de
// `rodar.mjs` ela já está (é a bancada). Rodando sozinha, a prova a ocupa. Se
// um defeito fizer uma chamada passar do `--listar`, ela para ali ("Já tem
// alguma coisa respondendo…"), sem subir servidor nem rodar prova, e a
// conferência dela reprova.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENDERECO } from "./navegador.mjs";
import { NAO_SAO_PROVAS } from "./olho-nas-provas.mjs";

const PASTA = fileURLToPath(new URL(".", import.meta.url));
const RODAR = join(PASTA, "rodar.mjs");
const PROVAS = readdirSync(PASTA)
  .filter((f) => f.endsWith(".mjs") && !NAO_SAO_PROVAS.has(f))
  .map((f) => f.replace(/\.mjs$/, ""))
  .sort();
const TEMPOS = JSON.parse(readFileSync(join(PASTA, "tempos-das-provas.json"), "utf8"));

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const temporaria = mkdtempSync(join(tmpdir(), "provas-em-partes-"));

let porteiro = null;
if (!await fetch(ENDERECO).then(() => true, () => false)) {
  const { hostname, port } = new URL(ENDERECO);
  porteiro = createServer((_, resposta) => resposta.end("porta ocupada pela prova as-provas-em-partes"));
  await new Promise((pronto, falhou) => porteiro.once("error", falhou).listen(Number(port), hostname, pronto));
}

/**
 * Chama o `rodar.mjs`, SEMPRE com `--listar`, só com as variáveis pedidas.
 *
 * Sem `spawnSync`, e é de propósito: ele para este processo enquanto espera, e
 * a porta ocupada lá de cima deixaria de responder. Foi o que a sabotagem que
 * tira a saída do `--listar` mostrou: a chamada ficou esperando a porta, em vez
 * de ouvir que ela estava ocupada e parar.
 */
const chamadas = [];
function listar(variaveis = {}, { cwd = PASTA, nomes = [] } = {}) {
  const env = { ...process.env };
  for (const k of ["PROVAS_PARTES", "PROVAS_PARTE", "PROVAS_TEMPOS"]) delete env[k];
  return new Promise((pronto) => {
    const resposta = { codigo: null, saida: "", erro: "" };
    let respondeu = false;
    const responder = () => {
      if (respondeu) return;
      respondeu = true;
      chamadas.push(resposta);
      pronto(resposta);
    };
    const filho = spawn(process.execPath, [RODAR, "--listar", ...nomes],
      { env: { ...env, ...variaveis }, cwd, timeout: 60_000 });
    filho.stdout.on("data", (pedaco) => { resposta.saida += pedaco; });
    filho.stderr.on("data", (pedaco) => { resposta.erro += pedaco; });
    filho.on("error", (e) => { resposta.erro += String(e); responder(); });
    filho.on("close", (codigo) => { resposta.codigo = codigo; responder(); });
  });
}

/** As partes de um `--listar` sem dizer a parte. */
function asPartes(saida) {
  const linhas = saida.split("\n");
  const partes = [];
  linhas.forEach((linha, i) => {
    const m = linha.match(/^Parte (\d+) de (\d+): (\d+) provas, ~(\d+),(\d) min/);
    if (m) {
      partes.push({ numero: Number(m[1]), de: Number(m[2]), quantas: Number(m[3]),
                    minutos: Number(`${m[4]}.${m[5]}`),
                    provas: (linhas[i + 1] ?? "").trim().split(", ").filter(Boolean) });
    }
  });
  return partes;
}

/** As provas de um `--listar` com a parte: o que aquela máquina rodaria. */
function daMaquina(saida) {
  const linhas = saida.split("\n");
  const i = linhas.findIndex((l) => /^Parte \d+ de \d+: \d+ das \d+ provas/.test(l));
  return i < 0 ? null : (linhas[i + 1] ?? "").trim().split(", ").filter(Boolean);
}

function tabela(nome, conteudo) {
  const arquivo = join(temporaria, nome);
  writeFileSync(arquivo, conteudo);
  return arquivo;
}

try {
  console.log("\nAs três partes, pela tabela de verdade");
  const tres = await listar({ PROVAS_PARTES: "3" });
  ok("--listar com três partes sai sem erro", tres.codigo === 0, tres.erro);
  const partes = asPartes(tres.saida);
  ok("são três partes, numeradas de 1 a 3",
     partes.length === 3 && partes.map((p) => p.numero).join() === "1,2,3"
     && partes.every((p) => p.de === 3), tres.saida.slice(0, 300));
  const juntas = partes.flatMap((p) => p.provas);
  const faltam = PROVAS.filter((n) => !juntas.includes(n));
  ok(`toda prova da pasta está numa parte (${PROVAS.length} provas)`,
     PROVAS.length > 0 && juntas.length > 0 && faltam.length === 0, `faltam: ${faltam.join(", ")}`);
  ok("nenhuma prova em duas partes, e nenhuma que não seja da pasta",
     juntas.length === PROVAS.length && new Set(juntas).size === juntas.length
     && juntas.every((n) => PROVAS.includes(n)), `${juntas.length} nomes para ${PROVAS.length} provas`);
  ok("nenhuma parte vazia, e cada uma diz quantas provas tem",
     partes.length === 3 && partes.every((p) => p.provas.length > 0 && p.provas.length === p.quantas));

  // A ESPERA É A DA PARTE MAIS LENTA. O total sai das próprias partes (a soma
  // do que elas dizem), e não de uma segunda conta escrita aqui: uma conta
  // repetida na prova poderia concordar com o defeito que deveria pegar.
  const minutos = partes.map((p) => p.minutos);
  const soma = minutos.reduce((a, b) => a + b, 0);
  const maisLenta = Math.max(...minutos), maisRapida = Math.min(...minutos);
  const maiorProva = Math.max(...Object.values(TEMPOS)) / 60;
  ok("a parte mais lenta fica a menos de um minuto do total dividido por três",
     partes.length === 3 && maisLenta - soma / 3 < 1, `partes: ${minutos.join(" · ")} min`);
  ok("entre a mais lenta e a mais rápida, menos do que a prova mais demorada",
     partes.length === 3 && maisLenta - maisRapida <= maiorProva + 0.1,
     `${maisLenta} − ${maisRapida} contra ${maiorProva.toFixed(1)} min`);

  console.log("\nCada máquina roda a parte que a lista mostra");
  const maquinas = await Promise.all([1, 2, 3].map((k) => listar({ PROVAS_PARTES: "3", PROVAS_PARTE: String(k) })));
  ok("as três saem sem erro", maquinas.length === 3 && maquinas.every((m) => m.codigo === 0),
     maquinas.map((m) => m.erro).join(" | "));
  const deCada = maquinas.map((m) => daMaquina(m.saida));
  ok("cada máquina roda exatamente a sua parte da lista",
     deCada.length === 3 && partes.length === 3
     && deCada.every((l, i) => l && [...l].sort().join() === [...partes[i].provas].sort().join()));
  const somadas = deCada.flatMap((l) => l ?? []);
  ok("as três máquinas juntas rodam toda prova da pasta, uma vez cada",
     somadas.length === PROVAS.length && PROVAS.length > 0
     && [...somadas].sort().join() === PROVAS.join(), `${somadas.length} de ${PROVAS.length}`);
  ok("cada máquina roda na ordem de sempre, e não na ordem da conta",
     deCada.length === 3 && deCada.every((l) => l && l.length > 0
       && l.join() === PROVAS.filter((n) => l.includes(n)).join()));

  console.log("\nA mesma conta em toda máquina");
  const deNovo = await listar({ PROVAS_PARTES: "3" });
  ok("chamada de novo, a resposta é a mesma", tres.saida.length > 0 && deNovo.saida === tres.saida);
  const deOutraPasta = await listar({ PROVAS_PARTES: "3" }, { cwd: tmpdir() });
  ok("chamada de outra pasta, a resposta é a mesma",
     tres.saida.length > 0 && deOutraPasta.saida === tres.saida, deOutraPasta.erro);

  console.log("\nTabela velha desequilibra, e nunca deixa prova de fora");
  {
    const metade = Object.fromEntries(Object.entries(TEMPOS).filter((_, i) => i % 2 === 0));
    metade["prova-que-saiu-da-pasta"] = 999;
    const r = await listar({ PROVAS_PARTES: "3", PROVAS_TEMPOS: tabela("metade.json", JSON.stringify(metade)) });
    ok("com metade da tabela, sai sem erro", r.codigo === 0, r.erro);
    const nomes = asPartes(r.saida).flatMap((p) => p.provas);
    ok("a prova sem tempo na tabela roda do mesmo jeito",
       PROVAS.length > 0 && nomes.length === PROVAS.length && [...nomes].sort().join() === PROVAS.join(),
       `${nomes.length} de ${PROVAS.length}`);
    ok("a que saiu da pasta e ficou na tabela não aparece", nomes.length > 0 && !nomes.includes("prova-que-saiu-da-pasta"));
  }
  {
    const r = await listar({ PROVAS_PARTES: "3", PROVAS_TEMPOS: tabela("vazia.json", "{}") });
    const tamanhos = asPartes(r.saida).map((p) => p.provas.length);
    ok("sem tempo nenhum, as partes ficam com o mesmo número de provas (diferença de no máximo 1)",
       r.codigo === 0 && tamanhos.length === 3 && Math.max(...tamanhos) - Math.min(...tamanhos) <= 1
       && tamanhos.reduce((a, b) => a + b, 0) === PROVAS.length, `${tamanhos.join(" · ")}; ${r.erro}`);
  }

  console.log("\nSem as variáveis, uma parte só, com tudo");
  {
    const r = await listar({});
    const sozinha = asPartes(r.saida);
    ok("sem PROVAS_PARTES, a lista é uma parte só, com toda prova da pasta",
       r.codigo === 0 && sozinha.length === 1 && sozinha[0].de === 1
       && [...sozinha[0].provas].sort().join() === PROVAS.join(), r.erro || r.saida.slice(0, 200));
  }

  console.log("\nO que não se entende, recusa");
  const RECUSAS = [
    ["a parte sem dizer em quantas", { PROVAS_PARTE: "2" }],
    ["a parte zero", { PROVAS_PARTES: "3", PROVAS_PARTE: "0" }],
    ["uma parte a mais do que existe", { PROVAS_PARTES: "3", PROVAS_PARTE: "4" }],
    ["a parte escrita por extenso", { PROVAS_PARTES: "3", PROVAS_PARTE: "dois" }],
    ["a parte com vírgula", { PROVAS_PARTES: "3", PROVAS_PARTE: "1,5" }],
    ["zero partes", { PROVAS_PARTES: "0", PROVAS_PARTE: "1" }],
    ["as duas variáveis VAZIAS, como chegariam se o GitHub não as preenchesse",
     { PROVAS_PARTES: "", PROVAS_PARTE: "" }],
    ["só a de quantas partes vazia", { PROVAS_PARTES: "", PROVAS_PARTE: "1" }],
    ["só a da parte vazia", { PROVAS_PARTES: "3", PROVAS_PARTE: "" }],
    ["mais partes do que provas", { PROVAS_PARTES: "1000", PROVAS_PARTE: "1000" }],
    ["a parte junto com nome de prova", { PROVAS_PARTES: "3", PROVAS_PARTE: "1" }, ["etiquetas"]],
    ["--listar com nome de prova", {}, ["etiquetas"]],
  ];
  for (const [nome, variaveis, nomes] of RECUSAS) {
    const r = await listar(variaveis, { nomes: nomes ?? [] });
    ok(`recusa, e diz por quê: ${nome}`, r.codigo === 2 && r.erro.trim().length > 0 && r.saida === "",
       `código ${r.codigo}; ${(r.erro.trim() || r.saida).slice(0, 200)}`);
  }

  const TABELAS_RUINS = [
    ["a tabela que não fecha", "{"],
    ["a tabela que é uma lista", "[]"],
    ["um tempo negativo", '{"etiquetas": -5}'],
    ["um tempo zero", '{"etiquetas": 0}'],
    ["um tempo escrito como texto", '{"etiquetas": "17"}'],
  ];
  for (const [nome, conteudo] of TABELAS_RUINS) {
    const r = await listar({ PROVAS_PARTES: "3", PROVAS_TEMPOS: tabela(`ruim-${feitas}.json`, conteudo) });
    ok(`recusa a tabela: ${nome}`, r.codigo === 2 && r.erro.trim().length > 0 && r.saida === "",
       `código ${r.codigo}; ${(r.erro.trim() || r.saida).slice(0, 200)}`);
  }
  {
    const r = await listar({ PROVAS_PARTES: "3", PROVAS_TEMPOS: join(temporaria, "nao-existe.json") });
    ok("recusa a tabela que não existe", r.codigo === 2 && r.erro.trim().length > 0 && r.saida === "",
       `código ${r.codigo}; ${r.erro.trim().slice(0, 200)}`);
  }

  ok("nenhuma chamada daqui passou do --listar para rodar prova",
     chamadas.length > 20 && chamadas.every((c) => !c.saida.includes("=================== ")
       && !c.erro.includes("Já tem alguma coisa respondendo")), `${chamadas.length} chamadas`);

  // O GITHUB NÃO SE RODA DAQUI, mas o que decide a parte de cada máquina está
  // escrito no arquivo dele, e são três linhas que uma limpeza desfaz sem
  // ninguém notar: a parte tirada da matriz (que pode repetir número), o
  // `fail-fast` de volta (a primeira reprovação cancela as outras partes) e o
  // `!cancelled()` (a rodada cancelada deixaria a PR verde).
  console.log("\nE no GitHub, o que decide a parte de cada máquina");
  {
    const fluxo = readFileSync(join(PASTA, "..", ".github", "workflows", "provas.yml"), "utf8");
    ok("a parte vem de strategy.job-index, e o total de strategy.job-total",
       /INDICE_DA_PARTE: \$\{\{ strategy\.job-index \}\}/.test(fluxo)
       && /PROVAS_PARTES: \$\{\{ strategy\.job-total \}\}/.test(fluxo)
       && /PROVAS_PARTE=\$\(\(INDICE_DA_PARTE \+ 1\)\) npm run prova/.test(fluxo));
    ok("uma parte que reprova não cancela as outras (fail-fast: false)", /\n {6}fail-fast: false\n/.test(fluxo));
    ok("\"Provas do painel\" junta as partes, e roda até numa rodada cancelada",
       /\n {2}painel:\n {4}name: Provas do painel\n {4}needs: partes\n {4}if: \$\{\{ always\(\) \}\}\n/.test(fluxo));
  }
} finally {
  porteiro?.close();
  rmSync(temporaria, { recursive: true, force: true });
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
