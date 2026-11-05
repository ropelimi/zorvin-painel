import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";
import { execFileSync } from "node:child_process";

// OS ARQUIVOS DE APOIO DO pdf.js, servidos pelo PRÓPRIO SITE (29/10).
//
// A prévia dos PDFs (`src/previaDoPdf.js`) desenha com o pdf.js, e ele busca
// alguns arquivos à parte, só quando o PDF pede:
//
// - os decodificadores de imagem em WebAssembly — JBIG2 (o de muita
//   digitalização em preto e branco, que é o que um escritório recebe) e JPEG
//   2000 —, com a versão em JavaScript para quando o WebAssembly falhar, e o
//   de perfil de cor;
// - as fontes padrão, para o PDF que usa Helvetica ou Times sem trazê-las.
//
// Faltando um deles, a página digitalizada sai EM BRANCO, sem erro nenhum na
// tela: é a falha que ninguém associa à causa. Por isso eles vão para
// `dist/pdfjs/` no build, e no servidor de desenvolvimento são servidos do
// próprio pacote, no mesmo endereço.
//
// FICAM DE FORA, e é decisão: o `quickjs-eval` (roda o JavaScript que vem
// DENTRO do PDF, e a prévia não roda — é um formulário, não um aplicativo),
// os `cmaps` (fontes chinesas, japonesas e coreanas que não vêm no arquivo) e
// os perfis de cor `iccs`.
const PDFJS = fileURLToPath(new URL("./node_modules/pdfjs-dist/", import.meta.url));
const APOIO_DO_PDFJS = {
  wasm: /^(jbig2|openjpeg)(\.wasm|_nowasm_fallback\.js)$|^qcms_bg\.wasm$|^LICENSE_(?!.*QUICKJS)/,
  standard_fonts: /./,
};
const TIPOS = { ".wasm": "application/wasm", ".js": "text/javascript; charset=utf-8", ".ttf": "font/ttf" };

function arquivosDeApoio() {
  return Object.entries(APOIO_DO_PDFJS).flatMap(([pasta, quais]) =>
    readdirSync(PDFJS + pasta)
      .filter((nome) => quais.test(nome))
      .map((nome) => ({ publico: `pdfjs/${pasta}/${nome}`, origem: `${PDFJS}${pasta}/${nome}` })));
}

function apoioDoPdfjs() {
  return {
    name: "apoio-do-pdfjs",
    configureServer(server) {
      const mapa = new Map(arquivosDeApoio().map((a) => [`/${a.publico}`, a.origem]));
      server.middlewares.use((req, res, next) => {
        const origem = mapa.get((req.url || "").split("?")[0]);
        if (!origem) return next();
        res.setHeader("Content-Type", TIPOS[extname(origem)] || "application/octet-stream");
        res.end(readFileSync(origem));
      });
    },
    generateBundle() {
      for (const a of arquivosDeApoio()) {
        this.emitFile({ type: "asset", fileName: a.publico, source: readFileSync(a.origem) });
      }
    },
  };
}

// A VERSÃO DO ZORVIN (05/11) — ver `src/atualizacao.js`.
//
// Escrita em DOIS lugares, a partir da mesma conta: dentro do código
// (`__ZORVIN_VERSAO__`) e no arquivo `versao.json`, que a aba aberta pergunta
// de tempos em tempos. Os dois diferentes são a versão nova.
//
// - o IDENTIFICADOR é o commit publicado: na Render, `RENDER_GIT_COMMIT`; fora
//   dela, o do `git`. Sem os dois, a hora da montagem — cada montagem, uma
//   versão;
// - o RÓTULO sai do número da PR na mensagem do commit, que o GitHub escreve
//   ao mesclar ("… (#314)"), EM CENTENAS — a regra é do Rodrigo: a entrega
//   314 é a "v3.14", a 399 a "v3.99", e a 400 a "v4.00". Depois do ponto vão
//   sempre dois números (v4.05, e não v4.5). Sem o número (um commit feito
//   fora de uma PR, ou uma montagem sem o `git`), vai o começo do commit;
// - a DATA é a do commit, no fuso de Brasília ("05/11"), e não a da montagem:
//   ela vai dentro do código, e o mesmo commit tem de dar o mesmo pacote.
function lerDoGit(...args) {
  try {
    return execFileSync("git", args, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
  } catch (_) {
    return "";
  }
}
/** 314 → "v3.14"; 400 → "v4.00"; 5 → "v0.05". */
export function rotuloDaEntrega(numero) {
  const n = Math.max(0, Math.floor(Number(numero) || 0));
  return `v${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}

/** A data do commit em Brasília: { data: "05/11", quando: "05/11/2026 às 01:12" }. */
export function dataDoCommit(iso) {
  const d = new Date(iso || "");
  if (!iso || Number.isNaN(d.getTime())) return { data: "", quando: "" };
  const fuso = { timeZone: "America/Sao_Paulo" };
  try {
    const dia = new Intl.DateTimeFormat("pt-BR", { ...fuso, day: "2-digit", month: "2-digit" }).format(d);
    const ano = new Intl.DateTimeFormat("pt-BR", { ...fuso, year: "numeric" }).format(d);
    const hora = new Intl.DateTimeFormat("pt-BR", { ...fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    return { data: dia, quando: `${dia}/${ano} às ${hora}` };
  } catch (_) {
    // SEM O FUSO NO NODE: Brasília não tem horário de verão desde 2019.
    const b = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    const dois = (x) => String(x).padStart(2, "0");
    const dia = `${dois(b.getUTCDate())}/${dois(b.getUTCMonth() + 1)}`;
    return { data: dia, quando: `${dia}/${b.getUTCFullYear()} às ${dois(b.getUTCHours())}:${dois(b.getUTCMinutes())}` };
  }
}

/** O número da PR e o rótulo, pela mensagem do último commit: "… (#314)" (a
 *  mesclagem por squash) ou "Merge pull request #314 …" dão a v3.14. Sem o
 *  número, o começo do commit. */
export function rotuloDoCommit(assunto, commit) {
  const texto = String(assunto || "");
  const m = /\(#(\d+)\)\s*$/.exec(texto) || /#(\d+)/.exec(texto);
  const numero = m ? Number(m[1]) : null;
  return { numero, rotulo: numero ? rotuloDaEntrega(numero) : commit ? String(commit).slice(0, 7) : "" };
}

function versaoDoZorvin() {
  const commit = String(process.env.RENDER_GIT_COMMIT || "").trim() || lerDoGit("rev-parse", "HEAD");
  const { numero, rotulo } = rotuloDoCommit(lerDoGit("log", "-1", "--format=%s"), commit);
  const { data, quando } = dataDoCommit(lerDoGit("log", "-1", "--format=%cI"));
  const montadaEm = new Date().toISOString();
  return {
    id: commit || `montagem-${montadaEm}`,
    rotulo,
    numero,
    commit,
    data,
    quando,
    montada_em: montadaEm,
  };
}

function arquivoDaVersao(versao) {
  const corpo = JSON.stringify(versao);
  return {
    name: "versao-do-zorvin",
    // NO SERVIDOR DE DESENVOLVIMENTO, o mesmo arquivo — e nunca guardado: a
    // prova troca a resposta dele para fingir uma publicação.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url || "").split("?")[0] !== "/versao.json") return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(corpo);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "versao.json", source: corpo });
    },
  };
}

// A BANCADA SÓ ENTRA NO PACOTE QUANDO ESTÁ LIGADA (auditoria de 27/10) — ver
// `src/bancada-desligada.js`. A pergunta é a mesma de `supabase.js`
// (`VITE_BANCADA === "1"`), feita aqui na montagem: lá ela escolhe o cliente,
// aqui ela escolhe o que entra no arquivo.
export default defineConfig(({ mode }) => {
  const bancada = (process.env.VITE_BANCADA ?? loadEnv(mode, process.cwd(), "VITE_").VITE_BANCADA) === "1";
  const versao = versaoDoZorvin();
  return {
    plugins: [react(), apoioDoPdfjs(), arquivoDaVersao(versao)],
    // A HORA DA MONTAGEM FICA SÓ NO ARQUIVO: dentro do código, ela mudaria o
    // pacote a cada montagem do mesmo commit, e a comparação é pelo `id`.
    define: { __ZORVIN_VERSAO__: JSON.stringify({ ...versao, montada_em: undefined }) },
    // O pdf.js É LIDO COMO VEM, sem a pré-compilação do servidor de
    // desenvolvimento. Ele é um módulo só, sem dependências; pré-compilado na
    // primeira vez que alguém abre um PDF, o servidor RECARREGARIA a página no
    // meio do uso ("new dependencies optimized"), e a prova junto.
    optimizeDeps: { exclude: ["pdfjs-dist"] },
    // O TRABALHADOR DO pdf.js SAI COMO MÓDULO (`src/trabalhadorDoPdf.js`): é
    // assim que o pdf.js o cria (`type: "module"`).
    worker: { format: "es" },
    resolve: {
      alias: bancada ? [] : [
        { find: /^\.\/bancada\.js$/, replacement: fileURLToPath(new URL("./src/bancada-desligada.js", import.meta.url)) },
      ],
    },
  };
});
