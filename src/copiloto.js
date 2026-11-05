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
//
//  ------------------------------------------------------------
//  O RESUMO DA CONVERSA (01/11) usa a mesma pergunta
//
//  A mesma chave e o mesmo estado. A ponte que tem a rota do resumo diz
//  `resumo: true`; a de antes não diz nada, e aí só o "Resumir" some — o
//  painel pode chegar ao ar antes da ponte (em 14/10 a Render passou um dia
//  sem publicá-la), e o botão de uma rota que não existe daria 404 a cada
//  clique. A régua dos três estados vale aqui também: só a resposta que
//  CHEGOU sem a chave esconde; a pergunta que falhou mostra.
//
//  ------------------------------------------------------------
//  A IA QUE MOVE O FUNIL (02/11) também
//
//  A ponte que move o funil diz `funil: true` (e `funil: false` com
//  FUNIL_IA=desligada lá). A de antes não diz nada. Aqui a régua é OUTRA, e
//  de propósito: a chave de cada funil fica na tela de quem administra
//  sempre, e o que muda é uma frase dizendo por que a IA não vai mover nada
//  agora (`avisoDaIaDoFunil`). Esconder a chave deixaria quem administra sem
//  saber por quê — e ela vale assim que a ponte puder.
//
//  ------------------------------------------------------------
//  O AGENTE E O APRENDIZADO (05/11)
//
//  A ponte que tem o "Pedir uma mudança" (`POST /copiloto/ajustar`) diz
//  `ajustar: true`; a de antes não diz nada, e o campo não aparece — a régua
//  do resumo. `aprende` diz se a rodada que lê as conversas está ligada
//  (`false` com COPILOTO_APRENDER=desligado lá), e é "antiga" quando a ponte
//  respondeu sem falar dela: a aba de quem administra diz qual é o caso.
// ============================================================

const ESPERA_DO_ESTADO_MS = 8000;
// A SUGESTÃO PODE DEMORAR: a ponte hiberna na Render (a primeira ida acorda o
// servidor) e depois pergunta à Anthropic. Meio minuto desistiria de um
// pedido que estava andando.
const ESPERA_DA_SUGESTAO_MS = 75000;
// O RESUMO LÊ MAIS (até 300 mensagens), e a ponte pode ter de acordar antes.
const ESPERA_DO_RESUMO_MS = 100000;
// O AJUSTE LÊ O MESMO QUE A SUGESTÃO, e responde a mensagem e a lição.
const ESPERA_DO_AJUSTE_MS = 75000;
// O "NÃO CONSEGUI" É PERGUNTADO DE NOVO (auditoria de 28/10), pela régua de
// `temVantoro.js`: guardado até o F5, ele deixava o botão numa instalação sem
// a chave, para dar erro a cada clique, o dia inteiro.
const DE_NOVO_EM_MS =
  (typeof globalThis !== "undefined" && globalThis.__PERGUNTAR_DE_NOVO_EM) || 30000;
const VEZES_DE_NOVO = 4;

const NAO_CONSEGUI = () => ({ ligado: null, modelo: null, resumo: null, funil: null, ajustar: null, aprende: null });

let promessa = null;
let falhas = 0;
let deNovo = null;
const ouvintes = new Set();

function perguntarDeNovoDepois() {
  if (deNovo || falhas >= VEZES_DE_NOVO) return;
  falhas += 1;
  deNovo = setTimeout(() => {
    deNovo = null;
    perguntarOCopiloto().then((r) => ouvintes.forEach((f) => f(r)));
  }, DE_NOVO_EM_MS);
}

/** `{ ligado, modelo, resumo, funil, ajustar, aprende }`. Todos menos `modelo`
 *  são `null` quando não deu para perguntar; `funil` e `aprende` são "antiga"
 *  quando a ponte respondeu sem falar deles. */
export function perguntarOCopiloto() {
  if (promessa) return promessa;
  if (!BRIDGE_URL) {
    promessa = Promise.resolve(NAO_CONSEGUI());
    return promessa;
  }
  const relogio = new AbortController();
  const estourou = setTimeout(() => relogio.abort(), ESPERA_DO_ESTADO_MS);
  const esta = fetch(BRIDGE_URL + "/copiloto/estado", { cache: "no-store", signal: relogio.signal })
    .then((r) => (r.ok ? r.json() : null))
    // SÓ `ligado === false` ESCONDE. Erro de rede, resposta estranha ou a
    // ponte de antes desta rota (404) são "não consegui", e não "não tem".
    .then((corpo) => {
      const respondeu = Boolean(corpo) && typeof corpo.ligado === "boolean";
      return {
        ligado: respondeu ? corpo.ligado : null,
        modelo: (corpo && corpo.modelo) || null,
        // A PONTE RESPONDEU E NÃO FALOU DO RESUMO: é a de antes da rota.
        resumo: respondeu ? corpo.resumo === true : null,
        // E DO FUNIL (02/11): três respostas, e a ponte de antes é a terceira.
        funil: !respondeu ? null : corpo.funil === true ? true : corpo.funil === false ? false : "antiga",
        // O AGENTE (05/11): a ponte de antes não fala dele, e o campo some.
        ajustar: respondeu ? corpo.ajustar === true : null,
        // E O APRENDIZADO: três respostas, como o funil.
        aprende: !respondeu ? null : corpo.aprende === true ? true : corpo.aprende === false ? false : "antiga",
      };
    })
    .catch(() => NAO_CONSEGUI())
    .then((r) => {
      // "NÃO CONSEGUI" MOSTRA, e não fica guardado (28/10).
      if (r.ligado === null) {
        if (promessa === esta) promessa = null;
        perguntarDeNovoDepois();
      }
      return r;
    })
    .finally(() => clearTimeout(estourou));
  promessa = esta;
  return esta;
}

/** `null` enquanto pergunta; depois `{ ligado, modelo, resumo, funil, ajustar, aprende }`. */
export function useEstadoDoCopiloto() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    let vivo = true;
    perguntarOCopiloto().then((r) => { if (vivo) setEstado(r); });
    // A RESPOSTA QUE CHEGA DEPOIS da pergunta feita de novo (28/10).
    const ouvir = (r) => { if (vivo) setEstado(r); };
    ouvintes.add(ouvir);
    return () => { vivo = false; ouvintes.delete(ouvir); };
  }, []);
  return estado;
}

/** O botão aparece? Só a resposta "não está ligado" esconde. */
export const copilotoAparece = (estado) => Boolean(estado) && estado.ligado !== false;

/** O "Resumir" aparece? O mesmo, e mais: a ponte que respondeu sem a rota do
 *  resumo (a de antes de 01/11) também esconde. */
export const resumoAparece = (estado) => copilotoAparece(estado) && estado.resumo !== false;

/** O "Pedir uma mudança" aparece? A régua do resumo: a ponte que respondeu
 *  sem a rota (a de antes de 05/11) também esconde. */
export const ajusteAparece = (estado) => copilotoAparece(estado) && estado.ajustar !== false;

/** O CAMPO DE PEDIR UMA MUDANÇA está à vista? Ele mora com a mensagem na
 *  caixa de escrever: com a caixa vazia (a mensagem foi enviada), na nota
 *  interna e na edição de uma mensagem, ele não teria o que mudar. Enquanto o
 *  pedido anda ("ajustando"), ele fica, travado. */
export function campoDoAjusteAparece(s, { nota = false, editando = false, vazia = false } = {}) {
  if (!s || nota || editando || s.soLicao) return false;
  if (s.fase === "ajustando") return true;
  return s.fase === "sugeriu" && !vazia;
}

/** A FAIXA DO COPILOTO, acima da caixa de escrever, está à vista? Uma conta só,
 *  para o desenho e para o Esc — que não pode gastar a tecla fechando uma
 *  faixa que ninguém vê.
 *
 *  Depois da sugestão (fase "sugeriu"), a faixa vive do campo de pedir uma
 *  mudança; sem ele, ela fica só pelo que ainda tem a dizer (a lição, com o
 *  Desfazer, e os avisos). */
export function faixaDoCopilotoAparece(s, modo = {}) {
  if (!s) return false;
  if (s.fase !== "sugeriu") return true;
  if (campoDoAjusteAparece(s, modo)) return true;
  return Boolean(s.licao || s.desfeita || s.aviso || s.erroDesfazer);
}

/** A faixa que o Esc fecha: a que está à vista e tem o X. Enquanto o copiloto
 *  lê ("pensando") ou refaz ("ajustando"), ela não tem X, e o pedido continua
 *  andando. */
export const faixaDoCopilotoFecha = (s, modo) =>
  faixaDoCopilotoAparece(s, modo) && s.fase !== "pensando" && s.fase !== "ajustando";

/** Por que a IA NÃO vai mover o funil agora, numa frase — ou `""` quando ela
 *  vai (ou quando não deu para perguntar: a dúvida não vira aviso). A chave
 *  do funil continua na tela nos dois casos (ver o alto deste arquivo). */
export function avisoDaIaDoFunil(estado) {
  if (!estado || estado.ligado === null) return "";
  if (estado.ligado === false) {
    return "A ponte está sem a chave da Anthropic (a variável ANTHROPIC_API_KEY, na Render): enquanto ela faltar, a IA não move ninguém. A chave fica guardada e vale assim que a variável existir.";
  }
  if (estado.funil === "antiga") {
    return "A ponte no ar ainda é de antes desta função. A chave fica guardada, e a IA começa a mover quando a ponte nova for publicada — confira em Atualizações do banco.";
  }
  if (estado.funil === false) {
    return "A IA do funil está desligada na ponte (FUNIL_IA=desligada, na Render): enquanto for assim, ela não move ninguém, em funil nenhum.";
  }
  return "";
}

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

/** Pede ao copiloto que mude a mensagem. Devolve `{ sugestao, licao, aviso }`:
 *  a mensagem refeita CRUA (com os marcadores, como a sugestão), a lição que
 *  ficou gravada (`{ id, texto }`, ou `null` quando o pedido valia só para
 *  esta conversa) e o aviso de quando a lição não pôde ser guardada. */
export async function pedirAjuste(conversaId, { pedido, sugestao }) {
  const r = await chamarPonte("/copiloto/ajustar", {
    method: "POST",
    body: JSON.stringify({ conversa_id: conversaId, pedido, sugestao }),
    espera: ESPERA_DO_AJUSTE_MS,
  });
  const texto = String((r && r.sugestao) || "").trim();
  if (!texto) throw new Error("A IA não devolveu a mensagem desta vez. Tente de novo.");
  const licao = r && r.licao && r.licao.id != null && String(r.licao.texto || "").trim()
    ? { id: r.licao.id, texto: String(r.licao.texto).trim() } : null;
  return { sugestao: texto, licao, aviso: String((r && r.aviso) || "").trim() };
}

/** Pede o resumo de uma conversa. Devolve `{ resumo: { quer, combinado,
 *  falta }, mensagens, notas, cortou, ate, avisos }` — conferido aqui, para
 *  a tela nunca desenhar um resumo pela metade como se fosse inteiro. */
export async function pedirResumo(conversaId) {
  const r = await chamarPonte("/copiloto/resumir", {
    method: "POST",
    body: JSON.stringify({ conversa_id: conversaId }),
    espera: ESPERA_DO_RESUMO_MS,
  });
  const resumo = r && r.resumo;
  const lista = (v) => (Array.isArray(v) ? v.map((x) => String(x || "").trim()).filter(Boolean) : []);
  const quer = String((resumo && resumo.quer) || "").trim();
  const combinado = lista(resumo && resumo.combinado);
  const falta = lista(resumo && resumo.falta);
  if (!quer && !combinado.length && !falta.length) {
    throw new Error("A IA não devolveu resumo desta vez. Tente de novo.");
  }
  return {
    resumo: { quer, combinado, falta },
    mensagens: Number(r.mensagens) || 0,
    notas: Number(r.notas) || 0,
    cortou: r.cortou === true,
    ate: r.ate || null,
    avisos: lista(r.avisos),
  };
}

// A BANCADA PRECISA ESQUECER ENTRE CENÁRIOS (a régua de `temVantoro.js`).
export function esquecerOCopiloto() {
  promessa = null;
  falhas = 0;
  if (deNovo) { clearTimeout(deNovo); deNovo = null; }
}
