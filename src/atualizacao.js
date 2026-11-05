import { useEffect, useRef, useState } from "react";

// ============================================================
//  O ZORVIN SE ATUALIZA SOZINHO, E DIZ A VERSÃO (05/11)
//
//  Pedido do Rodrigo: "Preciso de alguma forma o Zorvin atualizar sozinho
//  para todos os usuários, porque é ruim ficar pedindo toda hora para todos
//  os usuários ficarem apertando o Ctrl+Shift+R". E: "veja se dá para em
//  algum lugar colocar a informação de qual é a versão atual do Zorvin, algo
//  como 'v1.2'".
//
//  POR QUE PRECISAVA DO Ctrl+Shift+R. A publicação troca os arquivos do
//  site, mas a aba aberta continua rodando o código que baixou quando abriu
//  — e o painel passa o dia aberto. A entrega só chegava a quem recarregasse.
//  E a aba velha não fica só desatualizada: os pedaços de código que ela busca
//  depois (o pdf.js da prévia, por exemplo) têm nome novo a cada publicação, e
//  o de nome velho deixa de existir no site.
//
//  COMO FUNCIONA:
//
//  - A MONTAGEM ESCREVE A VERSÃO EM DOIS LUGARES (`vite.config.js`): dentro do
//    código (`__ZORVIN_VERSAO__`) e num arquivo à parte, `versao.json`. A aba
//    pergunta pelo arquivo de 5 em 5 minutos, e quando volta à frente; o
//    arquivo diferente do código que ela roda é a versão nova.
//  - ELA RECARREGA SOZINHA QUANDO É SEGURO: a tela parada há 2 minutos (ou a
//    aba escondida atrás de outra) e NADA que se perca — nem texto na caixa de
//    escrever, nem rascunho noutra conversa, nem ficha por salvar, nem áudio
//    gravado, nem anexo escolhido ou subindo, nem texto digitado numa janela,
//    nem a faxina finalizando conversas. Cada tela diz o que é dela
//    (`useMotivoParaEsperar`).
//  - E VOLTA PARA ONDE ESTAVA: a conversa aberta reabre pelo endereço da
//    guia de uma conversa (`?conversa=…&linha=…`, o caminho que já existia),
//    e a guia de uma tela recarrega no próprio endereço.
//  - ENQUANTO NÃO É SEGURO, uma faixa diz que há versão nova, e oferece
//    "Atualizar agora". Ela não exige nada de ninguém: a atualização entra
//    sozinha na primeira pausa.
//
//  O identificador da versão é o COMMIT publicado. O rótulo, "v1.313", sai
//  do número da PR que entrou por último (a mensagem do commit que o GitHub
//  escreve ao mesclar termina em "(#313)"): é o número que aparece nos
//  recados de cada entrega, e dá para conferir na tela que ela chegou.
// ============================================================

/* global __ZORVIN_VERSAO__ */
const DA_MONTAGEM = (() => {
  try {
    // eslint-disable-next-line no-undef
    const v = typeof __ZORVIN_VERSAO__ !== "undefined" ? __ZORVIN_VERSAO__ : null;
    if (v && typeof v === "object") return v;
  } catch (_) { /* sem a montagem */ }
  return { id: "", rotulo: "", numero: null, commit: "" };
})();

const g = typeof globalThis !== "undefined" ? globalThis : {};

/** A versão que esta aba roda. A prova a troca por `__VERSAO_EM_USO`: o
 *  servidor da bancada não remonta o código a cada cena. */
export function versaoEmUso() {
  const p = g.__VERSAO_EM_USO;
  return p && typeof p === "object" ? { ...DA_MONTAGEM, ...p } : DA_MONTAGEM;
}

/** "v1.313" — o que a tela escreve. */
export function rotuloDaVersao() {
  return String(versaoEmUso().rotulo || "");
}

// OS RELÓGIOS. A prova encurta todos; em produção valem os de baixo.
const numeroOu = (v, padrao) => (v !== undefined && v !== null && Number.isFinite(Number(v)) ? Number(v) : padrao);
// De quanto em quanto se pergunta pela versão. Cinco minutos: a entrega chega
// a todo mundo na mesma manhã, e são doze idas por hora a um arquivo de cem
// bytes, servido pelo próprio site (não passa pelo Supabase).
const aCadaMs = () => numeroOu(g.__VERSAO_A_CADA_MS, 5 * 60 * 1000);
// A primeira pergunta espera um minuto: a aba que acabou de abrir acabou de
// baixar o código, e quase sempre já é o mais novo.
const primeiraMs = () => numeroOu(g.__VERSAO_PRIMEIRA_MS, 60 * 1000);
// Quanto tempo sem mexer na tela conta como pausa.
const paradaMs = () => numeroOu(g.__OCIOSO_MS, 2 * 60 * 1000);
// Com uma versão nova esperando, de quanto em quanto se olha se já é seguro.
const olharACadaMs = () => numeroOu(g.__TENTAR_ATUALIZAR_A_CADA_MS, 15 * 1000);

// ------------------------------------------------------------
//  O ESTADO, para a tela
// ------------------------------------------------------------
let estado = { pendente: null, naoPegou: null, atualizadoPara: null, recarregando: false };
const ouvintes = new Set();
function mudar(parte) {
  estado = { ...estado, ...parte };
  ouvintes.forEach((f) => f(estado));
}

/** `{ pendente, naoPegou, atualizadoPara, recarregando }`:
 *  - `pendente`: a versão nova que espera a hora de entrar ({ id, rotulo });
 *  - `naoPegou`: a recarga aconteceu e o código continuou o velho — o site
 *    ainda serviu o arquivo antigo. Não se recarrega de novo em círculo;
 *  - `atualizadoPara`: o rótulo da versão que acabou de entrar, para a tela
 *    dizer por que ela recarregou. */
export function useAtualizacao() {
  const [e, setE] = useState(estado);
  useEffect(() => {
    ouvintes.add(setE);
    setE(estado);
    return () => { ouvintes.delete(setE); };
  }, []);
  return e;
}

export function esquecerQueAtualizou() {
  if (estado.atualizadoPara) mudar({ atualizadoPara: null });
}

// ------------------------------------------------------------
//  O QUE SE PERDERIA — cada tela diz o que é dela
// ------------------------------------------------------------
const motivos = new Set();

/** Registra quem diz o que se perderia numa recarga agora. A função devolve
 *  uma frase ("o texto na caixa de escrever"), uma lista delas, ou nada. */
export function registrarMotivoParaEsperar(fn) {
  motivos.add(fn);
  return () => { motivos.delete(fn); };
}

/** A versão de componente: `useMotivoParaEsperar(() => [...])`. A função mais
 *  recente é a que vale, e ela é chamada na HORA de decidir — e não no
 *  desenho: o rascunho guardado noutra conversa não pede desenho nenhum. */
export function useMotivoParaEsperar(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => registrarMotivoParaEsperar(() => (typeof ref.current === "function" ? ref.current() : ref.current)), []);
}

// O TEXTO DIGITADO NUMA JANELA, sem cada janela precisar dizer. Conta o campo
// em que a PESSOA escreveu (pelo `beforeinput`, que só a tecla dispara), e só
// enquanto ele diz outra coisa que não o que dizia antes da primeira tecla:
// o campo preenchido pelo próprio painel (a rápida aberta para editar, o
// cadastro na ficha) não segura nada sozinho.
//
// FICAM DE FORA a ficha, que diz o que tem por salvar por conta própria (a
// conta dela é a mesma do botão de salvar), e os campos de procurar
// (`data-nao-segura-a-atualizacao`): o que se escreveu ali não é trabalho que
// se perde.
const tocados = new Map();   // campo → o valor antes da primeira tecla
const TIPOS_DE_TEXTO = new Set(["text", "search", "email", "tel", "url", "number", "password"]);
function campoQueConta(el) {
  if (!el || !el.tagName) return false;
  if (el.closest && el.closest("[data-ficha], [data-nao-segura-a-atualizacao]")) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return TIPOS_DE_TEXTO.has(String(el.getAttribute("type") || "text").toLowerCase());
}
const valorDe = (el) => String((el.isContentEditable ? el.textContent : el.value) || "");
function anotarAntesDaTecla(e) {
  const el = e.target;
  if (!campoQueConta(el) || tocados.has(el)) return;
  tocados.set(el, valorDe(el));
}
// O ENCOSTO: o texto que entrou sem `beforeinput` (um preenchimento do
// navegador, por exemplo) chega aqui já mudado. Sem saber o que havia antes,
// ele conta enquanto o campo não estiver vazio.
function anotarDepoisDaTecla(e) {
  const el = e.target;
  if (!campoQueConta(el) || tocados.has(el)) return;
  tocados.set(el, null);
}
function algoDigitadoNaTela() {
  for (const [el, antes] of tocados) {
    if (!el.isConnected) { tocados.delete(el); continue; }
    const agora = valorDe(el);
    if (agora.trim() && (antes === null || agora !== antes)) return true;
  }
  return false;
}

function algoTocando() {
  try {
    return [...document.querySelectorAll("audio, video")].some((m) => !m.paused && !m.ended);
  } catch (_) { return false; }
}

/** O que se perderia numa recarga AGORA — vazio é seguro. */
export function motivosParaEsperar() {
  const lista = [];
  for (const f of motivos) {
    let r = null;
    try { r = f(); } catch (_) { r = null; }
    if (Array.isArray(r)) lista.push(...r.filter(Boolean));
    else if (r) lista.push(String(r));
  }
  if (typeof document !== "undefined") {
    if (algoDigitadoNaTela()) lista.push("um texto digitado na tela");
    if (algoTocando()) lista.push("um áudio tocando");
  }
  return [...new Set(lista)];
}

// ------------------------------------------------------------
//  A TELA PARADA
// ------------------------------------------------------------
let ultimoGesto = Date.now();
const anotarGesto = () => { ultimoGesto = Date.now(); };
function telaParada() {
  // A ABA ESCONDIDA atrás de outra não está mostrando nada a ninguém.
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return true;
  return Date.now() - ultimoGesto >= paradaMs();
}

// ------------------------------------------------------------
//  PARA ONDE VOLTAR
// ------------------------------------------------------------
let enderecoDeVolta = null;

/** A tela diz para onde a recarga deve voltar (a conversa aberta), ou nada —
 *  e aí a aba recarrega no endereço de agora. */
export function registrarEnderecoDeVolta(fn) {
  enderecoDeVolta = fn;
  return () => { if (enderecoDeVolta === fn) enderecoDeVolta = null; };
}

// ------------------------------------------------------------
//  A MARCA DA RECARGA — o que impede a volta em círculo
//
//  Antes de recarregar, a aba anota para qual versão foi. Voltando com ela,
//  diz que atualizou. Voltando com o código VELHO (o site ainda serviu o
//  arquivo antigo), não recarrega de novo para a mesma versão por uma hora:
//  recarregar outra vez daria o mesmo, e a tela piscaria sem parar. Fica na
//  faixa o pedido do Ctrl+Shift+R, que aí é o que resta.
//
//  Na guia, e não no navegador inteiro (`sessionStorage`): cada aba recarrega
//  por si.
// ------------------------------------------------------------
const CHAVE_DA_MARCA = "zorvin_atualizacao";
const MARCA_VALE_MS = 60 * 60 * 1000;
function lerMarca() {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_DA_MARCA) || "null"); } catch (_) { return null; }
}
function gravarMarca(m) {
  try {
    if (m) sessionStorage.setItem(CHAVE_DA_MARCA, JSON.stringify(m));
    else sessionStorage.removeItem(CHAVE_DA_MARCA);
    return true;
  } catch (_) { return false; }
}
function jaTenteiPara(id) {
  const m = lerMarca();
  return Boolean(m && m.para === id && Date.now() - Number(m.em || 0) < MARCA_VALE_MS);
}
function conferirAChegada() {
  const m = lerMarca();
  if (!m || !m.para) return;
  const agora = versaoEmUso();
  if (agora.id && agora.id === m.para) {
    gravarMarca(null);
    mudar({ atualizadoPara: String(m.rotulo || agora.rotulo || "a versão nova") });
  }
}

// ------------------------------------------------------------
//  PERGUNTAR PELA VERSÃO
// ------------------------------------------------------------
const enderecoDoArquivo = () => {
  let base = "/";
  try { base = import.meta.env.BASE_URL || "/"; } catch (_) { /* fora do Vite */ }
  return `${base}versao.json`;
};
let perguntando = false;

/** Pergunta ao site qual versão está publicada. A falha não é dita: sem
 *  rede, a próxima volta pergunta de novo, e a aba continua como estava. */
export async function conferirVersao() {
  if (perguntando || typeof fetch === "undefined") return;
  perguntando = true;
  try {
    // O NAVEGADOR E O SITE NÃO PODEM RESPONDER DE MEMÓRIA: `no-store`, e um
    // endereço que muda a cada pergunta.
    const r = await fetch(`${enderecoDoArquivo()}?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const v = await r.json();
    if (!v || typeof v.id !== "string" || !v.id) return;
    const agora = versaoEmUso();
    // A VERSÃO DESCONHECIDA não se compara: sem saber o que roda, qualquer
    // arquivo pareceria novo, e a aba recarregaria à toa.
    if (!agora.id || v.id === agora.id) {
      if (estado.pendente || estado.naoPegou) mudar({ pendente: null, naoPegou: null });
      return;
    }
    const nova = { id: v.id, rotulo: String(v.rotulo || "") };
    if (!estado.pendente || estado.pendente.id !== nova.id) mudar({ pendente: nova });
    tentarSozinho();
  } catch (_) {
    /* sem rede, ou o arquivo não é JSON: a próxima volta pergunta de novo */
  } finally {
    perguntando = false;
  }
}

// ------------------------------------------------------------
//  RECARREGAR
// ------------------------------------------------------------
let recargaDeProposito = false;

/** A recarga foi pedida por aqui? O `beforeunload` da ficha não pergunta de
 *  novo o que o "Atualizar agora" acabou de perguntar. */
export function recargaPedida() {
  return recargaDeProposito;
}

async function recarregar(alvo, { automatica, forte = false }) {
  if (estado.recarregando) return false;
  let destino = window.location.href;
  try {
    const volta = enderecoDeVolta ? enderecoDeVolta() : null;
    if (volta) destino = new URL(volta, window.location.href).href;
  } catch (_) { /* fica no endereço de agora */ }
  // A SEGUNDA TENTATIVA PEDE O ENDEREÇO COM UM CARIMBO: um endereço que o
  // navegador nunca viu não sai da memória dele.
  if (forte) {
    try {
      const u = new URL(destino);
      u.searchParams.set("v", String(Date.now()));
      destino = u.href;
    } catch (_) { /* segue sem o carimbo */ }
  }
  // O SITE RESPONDE? Recarregar sem rede trocaria o Zorvin pela página de
  // erro do navegador. E a pergunta com `reload` renova o que o navegador
  // guardou daquele endereço.
  try {
    const r = await fetch(destino, { cache: "reload", credentials: "same-origin" });
    if (!r.ok) return false;
  } catch (_) {
    return false;
  }
  // SEM A MARCA NÃO HÁ RECARGA SOZINHA: é ela que impede a volta em círculo.
  const marcou = gravarMarca({ para: alvo.id, rotulo: alvo.rotulo, em: Date.now() });
  if (automatica && !marcou) return false;
  recargaDeProposito = true;
  mudar({ recarregando: true });
  if (destino === window.location.href) window.location.reload();
  else window.location.replace(destino);
  return true;
}

let ultimaTentativa = 0;
function tentarSozinho() {
  const p = estado.pendente;
  if (!p || estado.recarregando) return;
  if (jaTenteiPara(p.id)) {
    if (!estado.naoPegou || estado.naoPegou.id !== p.id) mudar({ naoPegou: p });
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (!telaParada()) return;
  if (motivosParaEsperar().length) return;
  // Uma tentativa de cada vez: a pergunta ao site leva um instante.
  if (Date.now() - ultimaTentativa < 2000) return;
  ultimaTentativa = Date.now();
  recarregar(p, { automatica: true });
}

/** O "Atualizar agora" da faixa. Com algo que se perderia, pergunta antes,
 *  dizendo o quê. */
export async function atualizarAgora() {
  const p = estado.pendente || estado.naoPegou;
  if (!p) return { ok: false };
  const lista = motivosParaEsperar();
  if (lista.length) {
    const ok = window.confirm(`Atualizar agora apaga ${lista.join(", ")}. Atualizar assim mesmo?`);
    if (!ok) return { ok: false, cancelou: true };
  }
  const ok = await recarregar(p, { automatica: false, forte: Boolean(estado.naoPegou) });
  if (!ok) return { ok: false, erro: "Não consegui falar com o site do Zorvin agora. Confira a internet e tente de novo." };
  return { ok: true };
}

// ------------------------------------------------------------
//  A PARTIDA — uma vez por aba
// ------------------------------------------------------------
let iniciada = false;
export function iniciarAtualizacaoSozinha() {
  if (iniciada || typeof window === "undefined") return;
  iniciada = true;
  conferirAChegada();
  for (const t of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(t, anotarGesto, { capture: true, passive: true });
  }
  document.addEventListener("beforeinput", anotarAntesDaTecla, true);
  document.addEventListener("input", anotarDepoisDaTecla, true);
  // A ABA QUE VOLTA À FRENTE pergunta na hora — mas não a cada troca de
  // janela: quem alterna entre o Zorvin e o Vantoro o dia inteiro faria uma
  // pergunta por clique.
  let ultimaDaVolta = 0;
  const aoVoltar = () => {
    if (Date.now() - ultimaDaVolta < 15000) return;
    ultimaDaVolta = Date.now();
    conferirVersao();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") aoVoltar();
    else tentarSozinho();
  });
  window.addEventListener("focus", aoVoltar);
  window.addEventListener("online", () => { conferirVersao(); });
  setTimeout(() => { conferirVersao(); }, primeiraMs());
  setInterval(() => { conferirVersao(); }, aCadaMs());
  setInterval(tentarSozinho, olharACadaMs());
}
