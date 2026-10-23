// SOBE A BANCADA E RODA AS PROVAS.
//
// A lista de provas é a PASTA: cada `testes/nome.mjs` é uma prova, e criar o
// arquivo basta para ele entrar na rodada.
//
// Uso:  node testes/rodar.mjs            (todas)
//       node testes/rodar.mjs etiquetas  (uma)
//       PROVAS_PARTES=3 PROVAS_PARTE=2 node testes/rodar.mjs   (a 2ª de 3 partes)
//       PROVAS_PARTES=3 node testes/rodar.mjs --listar          (só mostra as partes)
import { spawn } from "node:child_process";
import { setTimeout as espera } from "node:timers/promises";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NAO_SAO_PROVAS } from "./olho-nas-provas.mjs";

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
//
// A LISTA DE QUEM NÃO É PROVA VEM DE UM LUGAR SÓ, importada do olho: ele
// precisa da mesma resposta para saber o que analisar, e duas listas iguais
// divergem na primeira mudança — com a prova esquecida numa delas deixando,
// caladamente, de rodar. É o mesmo defeito que o comentário acima descreve.
const AJUDANTES = new Set([...NAO_SAO_PROVAS].map((f) => f.replace(/\.mjs$/, "")));

// AS QUE PRECISAM DO BUILD DE PRODUÇÃO. `desempenho` mede latência, e o React
// de desenvolvimento gasta em verificações que não existem em produção — medir
// ali seria medir o instrumento, não o painel.
//
// `selos-em-rajada` CONTA IDAS AO BANCO, e ali a diferença é ainda mais
// traiçoeira: em desenvolvimento o React chama todo efeito DUAS vezes, de
// propósito, para caçar efeito que não sabe ser repetido. Quem conta consultas
// vê o dobro delas e conclui que há uma duplicação onde há uma ferramenta de
// desenvolvimento. Foi exatamente essa armadilha que quase virou o conserto de
// um defeito que não existia.
const NO_BUILD_DE_PRODUCAO = new Set(["desempenho", "digitar", "selos-em-rajada", "partida"]);

// AS QUE RODAM COM O VANTORO DESLIGADO — a instalação de quem COMPRA o Zorvin.
//
// `VITE_VANTORO` é lida quando o Vite serve a página, e não em tempo de
// execução: uma prova não tem como trocá-la com o servidor já de pé. Então
// estas ganham um servidor próprio, servido exatamente como no cliente que não
// tem Vantoro.
//
// Poderia ser mais barato pôr uma bandeira no navegador e o painel olhar para
// ela. Seria outra coisa: provaria a bandeira, e o caminho de verdade — o que
// a variável liga — continuaria sem ninguém nunca ter visto funcionar.
const SEM_VANTORO = new Set(["entrar-sem-vantoro"]);

// A ORDEM É A DO ALFABETO, e é de propósito: qualquer outra seria uma opinião
// que envelhece. Cada prova sobe o seu próprio navegador e limpa o que sujou,
// então nenhuma depende da anterior — se um dia alguma passar a depender, é
// ela que está errada, e não a ordem.
const PROVAS = readdirSync(new URL(".", import.meta.url))
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => f.replace(/\.mjs$/, ""))
  .filter((nome) => !AJUDANTES.has(nome))
  .sort()
  .map((nome) => ({
    nome,
    servidor: SEM_VANTORO.has(nome) ? "sem-vantoro"
            : NO_BUILD_DE_PRODUCAO.has(nome) ? "producao" : "dev",
  }));

if (!PROVAS.length) {
  console.error("Não achei prova nenhuma em testes/. Isso é um defeito daqui, e não um repositório sem provas.");
  process.exit(2);
}

const argumentos = process.argv.slice(2);
const soListar = argumentos.includes("--listar");
const pedidas = argumentos.filter((a) => a !== "--listar");

// AS PROVAS EM PARTES, PARA RODAREM EM VÁRIAS MÁQUINAS AO MESMO TEMPO (23/10).
//
// Numa máquina só, a rodada chegou a 68 minutos. Com `PROVAS_PARTES` e
// `PROVAS_PARTE`, este arquivo roda só uma fatia, e a integração contínua sobe
// uma máquina por fatia. Sem as duas variáveis, roda tudo, como sempre rodou.
//
// QUEM DECIDE EM QUAL PARTE CADA PROVA CAI É O TEMPO DELA, medido na
// integração contínua e guardado em `tempos-das-provas.json`. A mais demorada
// vai primeiro, sempre para a parte que está com menos tempo até ali. Com os
// tempos da rodada do #285 (23/10: 112 provas, 67 minutos), isso dá 22,5
// minutos para cada parte. Distribuir uma a uma, pelo alfabeto, daria 20,6,
// 19,6 e 27,3, e a espera é a da parte mais lenta.
//
// A TABELA NÃO É UMA LISTA DE PROVAS, e é isso que a deixa fora da armadilha
// descrita lá em cima: quem diz o que roda continua sendo a pasta. A prova que
// ainda não está na tabela roda do mesmo jeito, valendo o tempo do meio (a
// mediana); a que saiu da pasta é ignorada. Tabela velha só desequilibra as
// partes. Ela nunca deixa uma prova de fora.
//
// E AS MÁQUINAS NÃO CONVERSAM: cada uma faz a conta inteira, sozinha, e roda a
// sua parte. Por isso a conta só depende da pasta e da tabela, que são as
// mesmas no mesmo commit, e todo empate é desfeito pelo nome. Uma conta que
// desse outra resposta numa das máquinas deixaria provas sem rodar, sem
// nenhuma reprovar.
//
// `PROVAS_TEMPOS` troca a tabela por outra, e existe para a prova
// `as-provas-em-partes` conferir o que acontece com uma tabela velha.
function lerTempos() {
  const arquivo = process.env.PROVAS_TEMPOS
    || fileURLToPath(new URL("./tempos-das-provas.json", import.meta.url));
  let tempos;
  try {
    tempos = JSON.parse(readFileSync(arquivo, "utf8"));
  } catch (e) {
    console.error(`Não consegui ler ${arquivo} (${e.message}). Sem a tabela de tempos não há como dividir as provas em partes do mesmo tamanho.`);
    process.exit(2);
  }
  if (!tempos || typeof tempos !== "object" || Array.isArray(tempos)) {
    console.error(`${arquivo} tem de ser um objeto, com o nome de cada prova e os segundos que ela leva.`);
    process.exit(2);
  }
  for (const [nome, segundos] of Object.entries(tempos)) {
    if (!Number.isFinite(segundos) || segundos <= 0) {
      console.error(`Em ${arquivo}, "${nome}" vale ${JSON.stringify(segundos)}. O tempo de uma prova é um número de segundos maior que zero.`);
      process.exit(2);
    }
  }
  return tempos;
}

/** Divide as provas em `partes` fatias de tempo parecido. */
function dividir(provas, partes, tempos) {
  const medidos = provas.filter((p) => Object.hasOwn(tempos, p.nome))
    .map((p) => tempos[p.nome]).sort((a, b) => a - b);
  const doMeio = medidos.length ? medidos[Math.floor(medidos.length / 2)] : 1;
  const tempo = (p) => (Object.hasOwn(tempos, p.nome) ? tempos[p.nome] : doMeio);

  const fatias = Array.from({ length: partes }, () => ({ provas: [], segundos: 0 }));
  const daMaisDemorada = [...provas].sort((a, b) =>
    tempo(b) - tempo(a) || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  for (const p of daMaisDemorada) {
    let alvo = fatias[0];
    for (const f of fatias) if (f.segundos < alvo.segundos) alvo = f;
    alvo.provas.push(p);
    alvo.segundos += tempo(p);
  }
  return fatias;
}

const minutos = (segundos) => (segundos / 60).toFixed(1).replace(".", ",");

// O QUE NÃO SE ENTENDE, RECUSA — e não roda "o que der". Uma parte mal
// configurada que rodasse tudo deixaria a rodada três vezes mais lenta; uma
// que não rodasse nada ficaria verde. Os dois casos passariam calados.
// `!== undefined`, e não um teste de verdade: a variável que chega VAZIA (o
// GitHub não preencheu) é um defeito a dizer, e não o mesmo que não ter vindo.
const comPartes = process.env.PROVAS_PARTES !== undefined;
const comParte = process.env.PROVAS_PARTE !== undefined;
const inteiro = (texto) => (/^[1-9][0-9]*$/.test(texto ?? "") ? Number(texto) : null);
function recusar(frase) {
  console.error(frase);
  process.exit(2);
}
if (comParte && !comPartes) recusar("Veio PROVAS_PARTE sem PROVAS_PARTES: diga também em quantas partes as provas foram divididas.");
if (comPartes && !comParte && !soListar) recusar("Veio PROVAS_PARTES sem PROVAS_PARTE: diga qual das partes esta máquina roda. (Para só ver as partes, use --listar.)");
if (comPartes && pedidas.length) recusar("Escolha as provas pelo nome OU por parte, e não dos dois jeitos de uma vez.");
if (soListar && pedidas.length) recusar("--listar mostra as partes, e não recebe nome de prova.");
const partes = comPartes ? inteiro(process.env.PROVAS_PARTES) : 1;
if (partes === null) recusar(`PROVAS_PARTES tem de ser um número inteiro a partir de 1, e veio ${JSON.stringify(process.env.PROVAS_PARTES)}.`);
const parte = comParte ? inteiro(process.env.PROVAS_PARTE) : null;
if (comParte && (parte === null || parte > partes)) {
  recusar(`PROVAS_PARTE tem de ser um número de 1 a ${partes}, e veio ${JSON.stringify(process.env.PROVAS_PARTE)}.`);
}

let aRodar = PROVAS;
if (soListar || comPartes) {
  const fatias = dividir(PROVAS, partes, lerTempos());
  // Toda prova da pasta numa parte, e numa só. A divisão é uma conta, e uma
  // conta mexida um dia pode perder uma prova — e prova que não roda não
  // reprova.
  const vezes = new Map(PROVAS.map((p) => [p.nome, 0]));
  for (const f of fatias) for (const p of f.provas) vezes.set(p.nome, (vezes.get(p.nome) ?? 0) + 1);
  const erradas = [...vezes].filter(([, n]) => n !== 1);
  if (erradas.length) {
    recusar(`A divisão em partes deixou provas de fora ou repetidas: ${erradas.map(([nome, n]) => `${nome} (${n} vezes)`).join(", ")}. Isso é um defeito deste arquivo.`);
  }

  // `--listar` sem dizer a parte: todas elas.
  if (!comParte) {
    fatias.forEach((f, i) => {
      console.log(`Parte ${i + 1} de ${partes}: ${f.provas.length} provas, ~${minutos(f.segundos)} min pelo tempo medido`);
      console.log(`  ${f.provas.map((p) => p.nome).sort().join(", ")}`);
    });
    process.exit(0);
  }

  const minha = fatias[parte - 1];
  if (!minha.provas.length) recusar(`A parte ${parte} de ${partes} ficou sem prova nenhuma: há mais partes do que provas.`);
  const nomes = new Set(minha.provas.map((p) => p.nome));
  // A ORDEM DE RODAR CONTINUA A DE SEMPRE (por servidor, e pelo alfabeto
  // dentro dele). A conta escolhe QUAIS provas; não em que ordem.
  aRodar = PROVAS.filter((p) => nomes.has(p.nome));
  console.log(`Parte ${parte} de ${partes}: ${aRodar.length} das ${PROVAS.length} provas, ~${minutos(minha.segundos)} min pelo tempo medido.`);
  console.log(aRodar.map((p) => p.nome).join(", "));
  // `--listar` COM a parte: o que esta máquina rodaria, pelo mesmo caminho da
  // rodada de verdade, e sem rodar nada.
  if (soListar) process.exit(0);
} else if (pedidas.length) {
  aRodar = PROVAS.filter((p) => pedidas.includes(p.nome));
}
if (!aRodar.length) {
  console.error(`Não conheço: ${pedidas.join(", ")}. Tenho: ${PROVAS.map((p) => p.nome).join(", ")}`);
  process.exit(2);
}

function rodar(cmd, args, opcoes = {}) {
  return spawn(cmd, args, { stdio: "inherit", ...opcoes });
}

function subirServidor(tipo) {
  const args = tipo === "producao"
    ? ["vite", "preview", "--port", String(PORTA), "--host", "127.0.0.1", "--strictPort"]
    : ["vite", "--port", String(PORTA), "--host", "127.0.0.1", "--strictPort"];
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
           VITE_LIMITE_LOGIN_MS: "6000",
           // A espera pela conferência da sessão. Em produção são 6 segundos;
           // aqui 1,2 — a prova do Auth mudo precisa ESTOURAR esse prazo, e
           // seis segundos por caso deixariam a suíte lenta por causa de uma
           // demora que é de propósito.
           VITE_LIMITE_SESSAO_MS: "1200",
           // O padrão é o Vantoro LIGADO, como em produção. Só o servidor
           // "sem-vantoro" o desliga — e é ele que serve a instalação de quem
           // compra o programa sem ter o outro sistema.
           ...(tipo === "sem-vantoro" ? { VITE_VANTORO: "desligado" } : {}) },
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
const levou = {};
for (const tipo of ["dev", "sem-vantoro", "producao"]) {
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
    const comeco = Date.now();
    const filho = rodar("node", [new URL(`./${p.nome}.mjs`, import.meta.url).pathname],
                        { env: { ...process.env, ZORVIN_BANCADA: ENDERECO } });
    const codigo = await esperarSair(filho);
    if (codigo !== 0) saida = 1;
    levou[p.nome] = Math.max(1, Math.round((Date.now() - comeco) / 1000));
    console.log(`--- ${p.nome}: ${levou[p.nome]} s`);
  }
  if (!await derrubar(servidor)) process.exit(1);
}

// O TEMPO DE CADA PROVA DESTA PARTE, numa linha que se cola em
// `tempos-das-provas.json`. É assim que a tabela se refaz: as linhas das três
// partes de uma rodada da integração contínua, juntas, são a tabela inteira.
if (comPartes) {
  console.log("\nTempos desta parte, em segundos (para testes/tempos-das-provas.json):");
  console.log(JSON.stringify(levou));
}

console.log(saida ? "\nAlguma prova reprovou." : "\nTodas as provas passaram.");
process.exit(saida);
