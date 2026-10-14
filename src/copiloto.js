import { useEffect, useState } from "react";
import { BRIDGE_URL, chamarPonte } from "./ponte.js";

// ============================================================
//  O COPILOTO — "Sugerir resposta" (13/10)
//
//  Pedido do Rodrigo: um agente de IA que entenda como a equipe trabalha.
//  Começou pelo copiloto. Quem fala com a IA (o Claude Haiku 5.5, da
//  Anthropic) é a PONTE, onde mora a chave; o painel só pede a sugestão de
//  uma conversa e a põe na caixa de escrever. Quem envia é a atendente.
//
//  ------------------------------------------------------------
//  ESTÁ LIGADO? QUEM RESPONDE É A PONTE
//
//  `GET /copiloto/estado` diz se a chave `ANTHROPIC_API_KEY` existe lá — e
//  nunca a chave. Uma variável deste painel poderia ser posta em desacordo
//  com a da ponte (a régua de `temVantoro.js`): o botão apareceria numa
//  instalação sem chave, para dar erro a cada clique, ou sumiria numa que
//  tem.
//
//  Pergunta-se UMA VEZ POR ABERTURA: a ponte hiberna, e o botão de cada
//  conversa perguntando por si seriam idas à rede para a mesma resposta.
//
//  ------------------------------------------------------------
//  TRÊS ESTADOS, pela régua de `temVantoro.js`
//
//    null              ainda não perguntei      -> esconde
//    ligado: false     a ponte disse que não     -> esconde
//    ligado: true|null tem, ou NÃO CONSEGUI      -> mostra
//
//  Mostrar na dúvida custa, no pior caso, um clique que lê o erro da própria
//  ponte. Esconder na dúvida sumiria com o botão sempre que a ponte tossisse,
//  sem uma palavra dizendo por quê — a armadilha nº 2 do CLAUDE.md.
// ============================================================

const ESPERA_DO_ESTADO_MS = 8000;
// A SUGESTÃO PODE DEMORAR: a ponte hiberna na Render (a primeira ida acorda o
// servidor) e depois pergunta à Anthropic. Meio minuto desistiria de um
// pedido que estava andando.
const ESPERA_DA_SUGESTAO_MS = 75000;

let promessa = null;

/** `{ ligado, modelo }`. `ligado` é `null` quando não deu para perguntar. */
export function perguntarOCopiloto() {
  if (promessa) return promessa;
  if (!BRIDGE_URL) {
    promessa = Promise.resolve({ ligado: null, modelo: null });
    return promessa;
  }
  const relogio = new AbortController();
  const estourou = setTimeout(() => relogio.abort(), ESPERA_DO_ESTADO_MS);
  promessa = fetch(BRIDGE_URL + "/copiloto/estado", { cache: "no-store", signal: relogio.signal })
    .then((r) => (r.ok ? r.json() : null))
    // SÓ `ligado === false` ESCONDE. Erro de rede, resposta estranha ou a
    // ponte de antes desta rota (404) são "não consegui", e não "não tem".
    .then((corpo) => ({
      ligado: corpo && typeof corpo.ligado === "boolean" ? corpo.ligado : null,
      modelo: (corpo && corpo.modelo) || null,
    }))
    .catch(() => ({ ligado: null, modelo: null }))
    .finally(() => clearTimeout(estourou));
  return promessa;
}

/** `null` enquanto pergunta; depois `{ ligado, modelo }`. */
export function useEstadoDoCopiloto() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    let vivo = true;
    perguntarOCopiloto().then((r) => { if (vivo) setEstado(r); });
    return () => { vivo = false; };
  }, []);
  return estado;
}

/** O botão aparece? Só a resposta "não está ligado" esconde. */
export const copilotoAparece = (estado) => Boolean(estado) && estado.ligado !== false;

/** Pede a sugestão de uma conversa. Devolve o texto CRU, com os marcadores
 *  ({saudacao}, {nome}, {atendente}) — quem chama os preenche com as regras
 *  das mensagens rápidas, para a conversa EM QUE o pedido foi feito. */
export async function pedirSugestao(conversaId) {
  const r = await chamarPonte("/copiloto/sugerir", {
    method: "POST",
    body: JSON.stringify({ conversa_id: conversaId }),
    espera: ESPERA_DA_SUGESTAO_MS,
  });
  const texto = String((r && r.sugestao) || "").trim();
  if (!texto) throw new Error("A IA não devolveu sugestão desta vez. Tente de novo.");
  return texto;
}

// A BANCADA PRECISA ESQUECER ENTRE CENÁRIOS (a régua de `temVantoro.js`).
export function esquecerOCopiloto() { promessa = null; }
