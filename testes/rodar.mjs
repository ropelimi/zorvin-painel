// SOBE A BANCADA E RODA AS PROVAS.
//
// A lista de provas é a PASTA: cada `testes/nome.mjs` é uma prova, e criar o
// arquivo basta para ele entrar na rodada.
//
// Uso:  node testes/rodar.mjs            (todas)
//       node testes/rodar.mjs etiquetas  (uma)
import { spawn } from "node:child_process";
import { setTimeout as espera } from "node:timers/promises";
import { readdirSync } from "node:fs";

const PORTA = 5199;
const ENDERECO = `http://127.0.0.1:${PORTA}/`;

// AS PROVAS SÃO OS ARQUIVOS DA PASTA, e não uma lista escrita à mão.
//
// A lista existia, e custou três conflitos de junção num dia só: cada prova
// nova acrescentava uma linha no MESMO lugar, e dois ramos abertos ao mesmo
// tempo brigavam ali sem falta. Pior do que o incômodo: uma prova esquecida na
// lista simplesmente não rodava — o arquivo estava no repositório, verde, sem
// nunca ter sido executado. Um teste que não roda é pior do que um teste que
// não existe, porque ele dá a impressão de cobertura.
//
// Agora basta criar `testes/nome.mjs` para ele entrar. Nada a lembrar.
const AJUDANTES = new Set(["rodar", "navegador"]);

// A ÚNICA que precisa do build de produção. `desempenho` mede latência, e o
// React de desenvolvimento gasta em verificações que não existem em produção —
// medir ali seria medir o instrumento, não o painel.
const NO_BUILD_DE_PRODUCAO = new Set(["desempenho"]);

// A ORDEM É A DO ALFABETO, e é de propósito: qualquer outra seria uma opinião
// que envelhece. Cada prova sobe o seu próprio navegador e limpa o que sujou,
// então nenhuma depende da anterior — se um dia alguma passar a depender, é
// ela que está errada, e não a ordem.
const PROVAS = readdirSync(new URL(".", import.meta.url))
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((nome) => !AJUDANTES.has(nome))
  .sort()
  .map((nome) => ({ nome, servidor: NO_BUILD_DE_PRODUCAO.has(nome) ? "producao" : "dev" }));

if (!PROVAS.length) {
  console.error("Não achei prova nenhuma em testes/. Isso é um defeito daqui, e não um repositório sem provas.");
  process.exit(2);
}

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
           VITE_BRIDGE_URL: "http://127.0.0.1:5199/ponte-de-mentira",
           // A entrada desiste depois disto. Em produção são 75 segundos, que é
           // mais do que a Render leva para acordar; aqui são 6, senão a prova
           // da desistência levaria mais de um minuto e ninguém a rodaria.
           // Nenhuma outra prova chega a chamar a entrada — todas já sobem
           // logadas —, então encurtar aqui não muda nada nelas.
           VITE_LIMITE_LOGIN_MS: "6000" },
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
