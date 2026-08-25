import { supabase } from "./supabase.js";

// URL da ponte (bridge). Vem do build: o Vite grava as variáveis VITE_* dentro
// do arquivo final. Preencher a variável na Render não basta — precisa de um
// deploy novo depois, senão o painel continua com o valor vazio de antes.
export const BRIDGE_URL = (import.meta.env.VITE_BRIDGE_URL || "").replace(/\/$/, "");

export const FALTA_PONTE =
  "Falta a variável VITE_BRIDGE_URL no painel. Preencha em " +
  "Render → zorvin-painel → Environment com o endereço do zorvin-bridge e " +
  "publique o painel de novo (o Vite grava esse valor durante o build).";

// Chama a ponte já com a sessão do Zorvin no cabeçalho.
//
// Fica NUM ARQUIVO SÓ porque duas telas precisam dela — a ficha do cliente e a
// de atendentes — e duas cópias divergiriam na primeira vez que o tratamento de
// sessão expirada mudasse numa delas.
//
// O TOKEN DO VANTORO NÃO PASSA POR AQUI, e é o ponto todo desta camada: o
// navegador manda o JWT do Supabase (que só identifica quem está logado no
// Zorvin), e é a ponte, no servidor, que troca isso pelo token do Vantoro. Com o
// token no navegador, qualquer pessoa com o painel aberto teria acesso à base
// inteira do escritório.
// Quanto se espera a ponte antes de desistir. Meio minuto cobre o sono da
// Render com folga para o que as telas pedem: uma consulta, uma nota, um
// cadastro.
export const ESPERA_PADRAO = 30000;

export async function chamarPonte(caminho, opcoes = {}) {
  if (!BRIDGE_URL) throw new Error(FALTA_PONTE);
  const { data } = await supabase.auth.getSession();
  const jwt = data?.session?.access_token;
  if (!jwt) throw new Error("Sessão expirada. Entre de novo.");

  // TEMPO LIMITE. A ponte roda no plano free da Render e hiberna: a primeira
  // chamada depois de um tempo parado pode demorar quase um minuto para
  // acordar o servidor — e, se ela nunca responder, o `fetch` fica pendurado
  // para sempre. A ficha do cliente ficava em "Consultando…" sem fim, sem erro
  // e sem botão de desistir, e o atendente não tinha como saber se era lento
  // ou se tinha travado.
  //
  // `espera` existe porque nem toda chamada custa o mesmo. O retroativo das
  // notas percorre dezenas de clientes numa ida só, mandando cada nota para o
  // Vantoro — que é OUTRA hospedagem, e que também hiberna. Meio minuto ali
  // desistiria de um trabalho que estava andando, e o painel diria "demorou
  // demais" para algo que teria terminado.
  const { espera = ESPERA_PADRAO, ...restante } = opcoes;
  const relogio = new AbortController();
  const estourou = setTimeout(() => relogio.abort(), espera);
  let r;
  try {
    r = await fetch(BRIDGE_URL + caminho, {
      ...restante,
      signal: relogio.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + jwt,
        ...(opcoes.headers || {}),
      },
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("O Vantoro demorou demais para responder. Tente de novo em alguns segundos.");
    }
    throw new Error("Não consegui falar com o Vantoro. Verifique a conexão.");
  } finally {
    clearTimeout(estourou);
  }
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || "Não consegui falar com o Vantoro.");
  return corpo;
}
