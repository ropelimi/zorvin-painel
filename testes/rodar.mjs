// SOBE A BANCADA E RODA AS PROVAS.
//
// Duas provas precisam de servidores diferentes, e não é capricho: a do
// `painel` importa `src/supabase.js` direto para trocar o estado da bancada no
// meio do teste, o que só o servidor de desenvolvimento serve; a de
// `desempenho` mede latência, e o React de desenvolvimento gasta em
// verificações que não existem em produção — medir ali seria medir o
// instrumento. As demais rodam em qualquer um.
//
// Uso:  node testes/rodar.mjs            (todas)
//       node testes/rodar.mjs etiquetas  (uma)
import { spawn } from "node:child_process";
import { setTimeout as espera } from "node:timers/promises";

const PORTA = 5199;
const ENDERECO = `http://127.0.0.1:${PORTA}/`;

const PROVAS = [
  { nome: "telas",       servidor: "dev" },
  { nome: "busca",       servidor: "dev" },
  { nome: "etiquetas",   servidor: "dev" },
  { nome: "painel",      servidor: "dev" },
  { nome: "ficha",       servidor: "dev" },
  { nome: "atendentes",  servidor: "dev" },
  { nome: "desempenho",  servidor: "producao" },
];

const pedidas = process.argv.slice(2);
const aRodar = pedidas.length ? PROVAS.filter((p) => pedidas.includes(p.nome)) : PROVAS;
if (!aRodar.length) {
  console.error(`Não conheço: ${pedidas.join(", ")}. Tenho: ${PROVAS.map((p) => p.nome).join(", ")}`);
  process.exit(2);
}

function rodar(cmd, args, opcoes = {}) {
  return spawn(cmd, args, { stdio: "inherit", ...opcoes });
}

function subirServidor(tipo) {
  const args = tipo === "dev"
    ? ["vite", "--port", String(PORTA), "--host", "127.0.0.1", "--strictPort"]
    : ["vite", "preview", "--port", String(PORTA), "--host", "127.0.0.1", "--strictPort"];
  // `detached` para o `npx` e o `vite` que ele abre ficarem no MESMO grupo de
  // processos: matar só o `npx` deixava o `vite` de pé segurando a porta, e a
  // prova seguinte encontrava o servidor ERRADO respondendo. Foi assim que a
  // medição de desempenho acabou feita contra o servidor de desenvolvimento —
  // exatamente o que ela não pode medir.
  return spawn("npx", args, {
    // A ponte aponta para um endereço que não existe — quem responde por ele é
    // o próprio teste, interceptando a rede. Sem isto `chamarPonte` desiste na
    // primeira linha ("falta a variável"), e a ficha do cliente nunca chega a
    // ser exercitada: ela passava no teste mostrando a mensagem de erro.
    env: { ...process.env, VITE_BANCADA: "1",
           VITE_BRIDGE_URL: "http://127.0.0.1:5199/ponte-de-mentira" },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
}

/** Derruba o grupo inteiro e só volta quando a porta estiver livre de verdade. */
async function derrubar(servidor) {
  try { process.kill(-servidor.pid, "SIGTERM"); } catch (_) { servidor.kill(); }
  for (let i = 0; i < 60; i++) {
    try { await fetch(ENDERECO); } catch (_) { return true; }
    await espera(250);
  }
  console.error(`o servidor em ${ENDERECO} não quis sair`);
  return false;
}

async function esperarDePe() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(ENDERECO); if (r.ok) return true; } catch (_) { /* ainda subindo */ }
    await espera(300);
  }
  return false;
}

function esperarSair(filho) {
  return new Promise((resolve) => filho.on("exit", (c) => resolve(c ?? 1)));
}

// A PORTA PRECISA ESTAR LIVRE ANTES DE COMEÇAR.
//
// Com um servidor esquecido de pé, o `vite` morre por porta ocupada e a espera
// abaixo encontra o servidor VELHO respondendo — as provas rodam contra ele e o
// resultado não diz nada sobre o código de agora. Melhor parar aqui e dizer o
// que houve.
try {
  await fetch(ENDERECO);
  console.error(`Já tem alguma coisa respondendo em ${ENDERECO}.`);
  console.error("Pare esse servidor antes de rodar as provas: rodar contra ele daria um resultado sobre outro código.");
  process.exit(1);
} catch (_) { /* porta livre, como tem de ser */ }

let saida = 0;
for (const tipo of ["dev", "producao"]) {
  const dessas = aRodar.filter((p) => p.servidor === tipo);
  if (!dessas.length) continue;

  if (tipo === "producao") {
    console.log("\n--- build de produção ---");
    const b = rodar("npx", ["vite", "build"], { env: { ...process.env, VITE_BANCADA: "1",
      VITE_BRIDGE_URL: "http://127.0.0.1:5199/ponte-de-mentira" } });
    if (await esperarSair(b) !== 0) { console.error("o build falhou"); process.exit(1); }
  }

  const servidor = subirServidor(tipo);
  if (!await esperarDePe()) {
    console.error(`a bancada não subiu em ${ENDERECO}`);
    await derrubar(servidor);
    process.exit(1);
  }

  for (const p of dessas) {
    console.log(`\n=================== ${p.nome} ===================`);
    const filho = rodar("node", [new URL(`./${p.nome}.mjs`, import.meta.url).pathname],
                        { env: { ...process.env, ZORVIN_BANCADA: ENDERECO } });
    const codigo = await esperarSair(filho);
    if (codigo !== 0) saida = 1;
  }
  if (!await derrubar(servidor)) process.exit(1);
}

console.log(saida ? "\nAlguma prova reprovou." : "\nTodas as provas passaram.");
process.exit(saida);
