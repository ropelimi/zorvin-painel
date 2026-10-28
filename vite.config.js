import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// A BANCADA SÓ ENTRA NO PACOTE QUANDO É ELA QUE VAI RODAR (auditoria de 28/10).
// Sem isto, o build de produção levava o banco de mentira inteiro para o site
// publicado — ver `src/semBancada.js`. `loadEnv` lê a variável tanto do
// ambiente (como as provas a passam) quanto de um `.env`.
export default defineConfig(({ mode }) => {
  const daBancada = loadEnv(mode, process.cwd(), "VITE_").VITE_BANCADA === "1";
  return {
    plugins: [react()],
    resolve: {
      alias: daBancada ? [] : [
        { find: /^\.\/bancada\.js$/, replacement: fileURLToPath(new URL("./src/semBancada.js", import.meta.url)) },
      ],
    },
  };
});
