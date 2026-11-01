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
//  O ASSUNTO DO FINALIZAR (01/11) também
//
//  A ponte que sabe sugerir o assunto diz `assunto: true`. A de antes não diz
//  nada, e aí a janela do Finalizar abre como sempre abriu, sem pedir à IA —
//  a mesma régua do resumo.
// ============================================================

const ESPERA_DO_ESTADO_MS = 8000;
// A SUGESTÃO PODE DEMORAR: a ponte hiberna na Render (a primeira ida acorda o
// servidor) e depois pergunta à Anthropic. Meio minuto desistiria de um
// pedido que estava andando.
const ESPERA_DA_SUGESTAO_MS = 75000;
// O RESUMO LÊ MAIS (até 300 mensagens), e a ponte pode ter de acordar antes.
const ESPERA_DO_RESUMO_MS = 100000;
// A SUGESTÃO DO ASSUNTO lê só o atendimento de agora, e a janela do Finalizar
// funciona sem ela: um minuto, e quem confere já marcou à mão.
const ESPERA_DO_ASSUNTO_MS = 60000;
// GUARDADA POR DEZ MINUTOS, por conversa E pelo ponto em que ela estava:
// abrir o Finalizar, fechar e abrir de novo não paga outra ida à IA. Uma
// mensagem nova (a `ultima_atividade` muda) ou outro protocolo pedem de novo
// — a sugestão de antes falaria de uma conversa que já não é aquela.
const GUARDA_DO_ASSUNTO_MS = 10 * 60000;
const sugestoesDeAssunto = new Map();
// O "NÃO CONSEGUI" É PERGUNTADO DE NOVO (auditoria de 28/10), pela régua de
// `temVantoro.js`: guardado até o F5, ele deixava o botão numa instalação sem
// a chave, para dar erro a cada clique, o dia inteiro.
const DE_NOVO_EM_MS =
  (typeof globalThis !== "undefined" && globalThis.__PERGUNTAR_DE_NOVO_EM) || 30000;
const VEZES_DE_NOVO = 4;

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

/** `{ ligado, modelo, resumo, assunto }`. `ligado`, `resumo` e `assunto` são
 *  `null` quando não deu para perguntar. */
export function perguntarOCopiloto() {
  if (promessa) return promessa;
  if (!BRIDGE_URL) {
    promessa = Promise.resolve({ ligado: null, modelo: null, resumo: null, assunto: null });
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
        // NEM DO ASSUNTO: é a de antes de 01/11 (a mesma régua).
        assunto: respondeu ? corpo.assunto === true : null,
      };
    })
    .catch(() => ({ ligado: null, modelo: null, resumo: null, assunto: null }))
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

/** `null` enquanto pergunta; depois `{ ligado, modelo, resumo, assunto }`. */
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

/** A janela do Finalizar pede a sugestão do assunto? A mesma régua do resumo:
 *  só a ponte que respondeu sem a rota (a de antes de 01/11) não pede. */
export const assuntoAparece = (estado) => copilotoAparece(estado) && estado.assunto !== false;

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

/** Pede à ponte o assunto provável de uma conversa, para a janela do
 *  Finalizar abrir com ele marcado. Devolve `{ assuntos: [{ id, nome }],
 *  motivo }` — a lista pode vir vazia: a IA disse que não sabe, e isso é uma
 *  resposta, e não uma falha. Quem confere contra a lista da janela é ela.
 *
 *  O QUE FALHOU NÃO FICA GUARDADO: a próxima abertura pergunta de novo. */
export function pedirSugestaoDeAssunto(conv) {
  const chave = `${conv.id}|${conv.protocolo || ""}|${conv.ultima_atividade || ""}`;
  const guardada = sugestoesDeAssunto.get(chave);
  if (guardada && Date.now() - guardada.quando < GUARDA_DO_ASSUNTO_MS) return guardada.promessa;
  const esta = chamarPonte("/copiloto/assunto", {
    method: "POST",
    body: JSON.stringify({ conversa_id: conv.id }),
    espera: ESPERA_DO_ASSUNTO_MS,
  }).then((r) => ({
    assuntos: (Array.isArray(r && r.assuntos) ? r.assuntos : [])
      .filter((a) => a && a.id != null)
      .map((a) => ({ id: a.id, nome: String(a.nome || "") })),
    motivo: String((r && r.motivo) || "").replace(/\s+/g, " ").trim(),
  }));
  sugestoesDeAssunto.set(chave, { quando: Date.now(), promessa: esta });
  esta.catch(() => {
    if (sugestoesDeAssunto.get(chave)?.promessa === esta) sugestoesDeAssunto.delete(chave);
  });
  return esta;
}

// A BANCADA PRECISA ESQUECER ENTRE CENÁRIOS (a régua de `temVantoro.js`).
export function esquecerOCopiloto() {
  promessa = null;
  falhas = 0;
  sugestoesDeAssunto.clear();
  if (deNovo) { clearTimeout(deNovo); deNovo = null; }
}
