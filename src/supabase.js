// Conexão com o Supabase do Zorvin.
// As duas chaves vêm das "variáveis de ambiente" configuradas no Render.
// Aqui usamos a chave "anon" (pública) — é segura para o navegador.
import { createClient } from "@supabase/supabase-js";

import { supabase as daBancada } from "./bancada.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// BANCADA: com `VITE_BANCADA=1` o painel roda com dados de mentira, sem banco e
// sem chave nenhuma — é assim que se vê um defeito de tela sem mexer no
// atendimento de verdade. Em produção a variável não existe e nada disto entra
// em cena.
export const supabase = import.meta.env.VITE_BANCADA === "1"
  ? daBancada
  : createClient(url, anonKey);
