import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";

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

// A BANCADA SÓ ENTRA NO PACOTE QUANDO ESTÁ LIGADA (auditoria de 27/10) — ver
// `src/bancada-desligada.js`. A pergunta é a mesma de `supabase.js`
// (`VITE_BANCADA === "1"`), feita aqui na montagem: lá ela escolhe o cliente,
// aqui ela escolhe o que entra no arquivo.
export default defineConfig(({ mode }) => {
  const bancada = (process.env.VITE_BANCADA ?? loadEnv(mode, process.cwd(), "VITE_").VITE_BANCADA) === "1";
  return {
    plugins: [react(), apoioDoPdfjs()],
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
