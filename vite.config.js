import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// A BANCADA SÓ ENTRA NO PACOTE QUANDO ESTÁ LIGADA (auditoria de 27/10) — ver
// `src/bancada-desligada.js`. A pergunta é a mesma de `supabase.js`
// (`VITE_BANCADA === "1"`), feita aqui na montagem: lá ela escolhe o cliente,
// aqui ela escolhe o que entra no arquivo.
export default defineConfig(({ mode }) => {
  const bancada = (process.env.VITE_BANCADA ?? loadEnv(mode, process.cwd(), "VITE_").VITE_BANCADA) === "1";
  return {
    plugins: [react()],
    resolve: {
      alias: bancada ? [] : [
        { find: /^\.\/bancada\.js$/, replacement: fileURLToPath(new URL("./src/bancada-desligada.js", import.meta.url)) },
      ],
    },
  };
});
