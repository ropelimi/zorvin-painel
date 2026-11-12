import { useEffect, useRef, useState } from "react";

// ============================================================
//  O ZORVIN SE ATUALIZA SOZINHO, E DIZ A VERSÃO (05/11)
//
//  Pedido do Rodrigo: "Preciso de alguma forma o Zorvin atualizar sozinho
//  para todos os usuários, porque é ruim ficar pedindo toda hora para todos
//  os usuários ficarem apertando o Ctrl+Shift+R". E: "veja se dá para em
//  algum lugar colocar a informação de qual é a versão atual do Zorvin".
//
//  POR QUE PRECISAVA DO Ctrl+Shift+R. A publicação troca os arquivos do
//  site, mas a aba aberta continua rodando o código que baixou quando abriu
//  — e o painel passa o dia aberto. A entrega só chegava a quem recarregasse.
//  E a aba velha não fica só desatualizada: os pedaços de código que ela busca
//  depois (o pdf.js da prévia, por exemplo) têm nome novo a cada publicação, e
//  o de nome velho deixa de existir no site.
//
//  ------------------------------------------------------------
//  NUNCA NA FRENTE DE NINGUÉM (05/11, a segunda rodada)
//
//  A primeira regra recarregava com a tela parada há 2 minutos. O Rodrigo:
//  "A atualização deve ser mais sútil, sem atrapalhar a operação" e "não
//  quero nem sonhar em isso acontecendo". Dois minutos sem mexer no mouse
//  pode ser alguém lendo uma conversa, ou no telefone com o cliente — e a
//  tela piscava na frente dela.
//
//  A ABA SÓ RECARREGA SOZINHA EM TRÊS MOMENTOS (`momentoSemNinguem`):
//
//  - ESCONDIDA HÁ 2 MINUTOS, na aba das conversas (`useQuandoEscondida`): a
//    pessoa está noutra guia, noutro programa, ou com a tela bloqueada. A
//    recarga leva uns segundos, ninguém a vê, e a volta traz tudo como estava
//    (a conversa, a aba da lista, os filtros, a busca, os responsáveis). E ela
//    ESPERA quando a volta não seria igual: a conversa rolada para mensagens
//    antigas, a lista rolada para baixo, uma janela aberta por cima;
//  - DE MADRUGADA (da meia-noite às 6h), com a aba parada há uma hora, à
//    vista ou não: a tela pode estar ligada, mas não há ninguém olhando;
//  - NA VOLTA DO DESCANSO: o computador suspenso ou hibernado acorda, e nos
//    primeiros 2 minutos, com a aba ainda escondida (atrás da tela de senha) e
//    ninguém tendo mexido nela.
//
//  COM A ABA À VISTA, DE DIA, NUNCA. Para quem quer a novidade na hora, um
//  pontinho no ⋮ e "Atualizar o Zorvin" dentro do menu — sem faixa no meio da
//  tela, nem antes nem depois.
//
//  E EM TODOS OS MOMENTOS, O QUE SE PERDERIA SEGURA A RECARGA: texto na caixa
//  de escrever, rascunho noutra conversa, ficha por salvar, áudio gravado,
//  anexo escolhido ou subindo, texto digitado numa janela, um áudio
//  tocando. Cada tela diz o que é dela
//  (`useMotivoParaEsperar`).
//
//  O SOM DOS AVISOS CONTINUA DEPOIS DA RECARGA. Medido no Chromium: o
//  navegador só deixa tocar som depois de a pessoa clicar na página, e a
//  recarga feita pela própria página GUARDA esse clique — a página nova nasce
//  com o som liberado. E as mensagens que chegarem nos segundos da recarga
//  ganham o aviso do mesmo jeito: a página nova pergunta ao banco o que
//  chegou desde que a velha saiu (`recargaFeitaEm`, ver `Painel.jsx`).
//
//  ------------------------------------------------------------
//  A VERSÃO. O identificador é o COMMIT publicado. O rótulo sai do número da
//  PR que entrou por último, em centenas: a entrega 314 é a v3.14, a 399 a
//  v3.99, e a 400 a v4.00 (a regra é do Rodrigo). A data é a do commit, no
//  fuso de Brasília: "Zorvin v3.14 · 05/11".
// ============================================================

/* global __ZORVIN_VERSAO__ */
const DA_MONTAGEM = (() => {
  try {
    // eslint-disable-next-line no-undef
    const v = typeof __ZORVIN_VERSAO__ !== "undefined" ? __ZORVIN_VERSAO__ : null;
    if (v && typeof v === "object") return v;
  } catch (_) { /* sem a montagem */ }
  return { id: "", rotulo: "", numero: null, commit: "", data: "", quando: "" };
})();

const g = typeof globalThis !== "undefined" ? globalThis : {};

/** A versão que esta aba roda. A prova a troca por `__VERSAO_EM_USO`: o
 *  servidor da bancada não remonta o código a cada cena. */
export function versaoEmUso() {
  const p = g.__VERSAO_EM_USO;
  return p && typeof p === "object" ? { ...DA_MONTAGEM, ...p } : DA_MONTAGEM;
}

/** "v3.14" — só o rótulo. */
export function rotuloDaVersao() {
  return String(versaoEmUso().rotulo || "");
}

/** "v3.14 · 05/11" — o que a tela escreve. Sem a data, só o rótulo. */
export function textoDaVersao(v = versaoEmUso()) {
  const r = String((v && v.rotulo) || "");
  const d = String((v && v.data) || "");
  return r && d ? `${r} · ${d}` : r;
}

/** "Entrega 314, de 05/11/2026 às 01:12" — o `title` da versão. */
export function detalheDaVersao(v = versaoEmUso()) {
  if (!v) return "";
  const partes = [];
  if (v.numero) partes.push(`Entrega ${v.numero}`);
  else if (v.commit) partes.push(`Montagem ${String(v.commit).slice(0, 7)}`);
  if (v.quando) partes.push(`de ${v.quando}`);
  return partes.join(", ");
}

// OS RELÓGIOS. A prova encurta todos; em produção valem os de baixo.
const numeroOu = (v, padrao) => (v !== undefined && v !== null && Number.isFinite(Number(v)) ? Number(v) : padrao);
// De quanto em quanto se pergunta pela versão. Cinco minutos: são doze idas
// por hora a um arquivo de cem bytes, servido pelo próprio site (não passa
// pelo Supabase).
const aCadaMs = () => numeroOu(g.__VERSAO_A_CADA_MS, 5 * 60 * 1000);
// A primeira pergunta espera um minuto: a aba que acabou de abrir acabou de
// baixar o código, e quase sempre já é o mais novo.
const primeiraMs = () => numeroOu(g.__VERSAO_PRIMEIRA_MS, 60 * 1000);
// Com uma versão nova esperando, de quanto em quanto se olha se já é a hora.
const olharACadaMs = () => numeroOu(g.__TENTAR_ATUALIZAR_A_CADA_MS, 15 * 1000);
// ESCONDIDA HÁ QUANTO TEMPO. Quem trocou de janela por três segundos para
// copiar um CPF volta logo, e voltaria para uma aba no meio da recarga; quem
// saiu há dois minutos está fazendo outra coisa.
const escondidaHaMs = () => numeroOu(g.__ESCONDIDA_HA_MS, 2 * 60 * 1000);
// A MADRUGADA: das 0h às 6h no relógio do computador, com a aba parada há
// uma hora. A prova troca as horas por `__MADRUGADA` ([de, até]).
const paradaDaMadrugadaMs = () => numeroOu(g.__PARADA_DA_MADRUGADA_MS, 60 * 60 * 1000);
function naMadrugada(d) {
  const faixa = Array.isArray(g.__MADRUGADA) ? g.__MADRUGADA : [0, 6];
  const h = d.getHours();
  return h >= Number(faixa[0]) && h < Number(faixa[1]);
}
// A VOLTA DO DESCANSO. Um relógio bate de minuto em minuto; com o computador
// suspenso ele não bate, e a batida que chega com um SALTO de 20 minutos ou
// mais é o computador acordando. Aba escondida também tem o relógio mais
// lento (o navegador o segura a uma batida por minuto), mas não para.
const batidaMs = () => numeroOu(g.__BATIDA_MS, 60 * 1000);
const saltoMs = () => numeroOu(g.__SALTO_MS, 20 * 60 * 1000);
const janelaDaVoltaMs = () => numeroOu(g.__JANELA_DA_VOLTA_MS, 2 * 60 * 1000);

// ------------------------------------------------------------
//  O ESTADO, para a tela
// ------------------------------------------------------------
let estado = { pendente: null, naoPegou: null, recarregando: false };
const ouvintes = new Set();
function mudar(parte) {
  estado = { ...estado, ...parte };
  ouvintes.forEach((f) => f(estado));
}

/** `{ pendente, naoPegou, recarregando }`:
 *  - `pendente`: a versão nova que espera a hora de entrar
 *    ({ id, rotulo, data });
 *  - `naoPegou`: a recarga aconteceu e o código continuou o velho — o site
 *    ainda serviu o arquivo antigo. Não se recarrega de novo em círculo. */
export function useAtualizacao() {
  const [e, setE] = useState(estado);
  useEffect(() => {
    ouvintes.add(setE);
    setE(estado);
    return () => { ouvintes.delete(setE); };
  }, []);
  return e;
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
// se perde — e a busca da lista volta escrita depois da recarga.
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
//  A ABA ESCONDIDA, DE DIA — só a das conversas, e só quando a volta seria
//  igual
//
//  A aba das conversas registra o que MUDARIA para a pessoa ao voltar: a
//  conversa rolada para mensagens antigas (a recarga a levaria para o fim), a
//  lista rolada para baixo, uma janela aberta por cima. Nada disso é trabalho
//  que se perde — de madrugada e na volta do descanso não segura nada —, mas
//  de dia é a pessoa voltando e achando a tela diferente.
//
//  SEM REGISTRO, A ABA ESCONDIDA NÃO RECARREGA DE DIA: a tela de entrada e a
//  guia de cada tela (o Funil, as Tarefas, o Painel de números) não dizem o
//  que mudaria, e não arriscam. Elas recarregam de madrugada, na volta do
//  descanso, ou quando alguém as abre de novo.
// ------------------------------------------------------------
let quandoEscondida = null;

/** `useQuandoEscondida(() => [...])`: o que mudaria para a pessoa, se a aba
 *  escondida recarregasse agora. Vazio deixa recarregar. */
export function useQuandoEscondida(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const registrada = () => (typeof ref.current === "function" ? ref.current() : ref.current);
    quandoEscondida = registrada;
    return () => { if (quandoEscondida === registrada) quandoEscondida = null; };
  }, []);
}

function oQueMudariaAoVoltar() {
  if (!quandoEscondida) return ["esta aba não diz o que mudaria"];
  let r = null;
  try { r = quandoEscondida(); } catch (_) { return ["não deu para saber o que mudaria"]; }
  if (Array.isArray(r)) return r.filter(Boolean);
  return r ? [String(r)] : [];
}

// ------------------------------------------------------------
//  A TELA PARADA, A ABA ESCONDIDA E O RELÓGIO QUE SALTA
// ------------------------------------------------------------
let ultimoGesto = Date.now();
const anotarGesto = () => { ultimoGesto = Date.now(); };
let escondidaDesde = null;
let ultimaBatida = Date.now();
let acordouEm = 0;
let ultimaRespostaEm = 0;

function bater() {
  const agora = Date.now();
  // O SALTO: o relógio não bateu por 20 minutos ou mais. O computador dormiu,
  // e a versão nova pode ter saído enquanto isso — pergunta-se na hora.
  if (agora - ultimaBatida >= saltoMs()) {
    acordouEm = agora;
    conferirVersao();
  }
  ultimaBatida = agora;
}

/** O momento sem ninguém, ou `null`. */
function momentoSemNinguem() {
  if (typeof document === "undefined") return null;
  const agora = Date.now();
  const escondida = document.visibilityState === "hidden";
  // 1. A VOLTA DO DESCANSO: logo que o computador acorda, com a aba escondida
  //    e sem ninguém ter mexido nela desde então.
  if (acordouEm && agora - acordouEm < janelaDaVoltaMs() && ultimoGesto < acordouEm && escondida) {
    return "descanso";
  }
  // 2. A MADRUGADA, com a aba parada há uma hora — à vista ou não.
  if (naMadrugada(new Date(agora)) && agora - ultimoGesto >= paradaDaMadrugadaMs()) return "madrugada";
  // 3. ESCONDIDA HÁ 2 MINUTOS, na aba das conversas, e com a volta igual.
  if (escondida && escondidaDesde !== null && agora - escondidaDesde >= escondidaHaMs()
      && !oQueMudariaAoVoltar().length) {
    return "escondida";
  }
  return null;
}

// ------------------------------------------------------------
//  PARA ONDE VOLTAR, E COMO A TELA ESTAVA
// ------------------------------------------------------------
let enderecoDeVolta = null;

/** A tela diz para onde a recarga deve voltar (a conversa aberta), ou nada —
 *  e aí a aba recarrega no endereço de agora. */
export function registrarEnderecoDeVolta(fn) {
  enderecoDeVolta = fn;
  return () => { if (enderecoDeVolta === fn) enderecoDeVolta = null; };
}

// A FOTO DA TELA: a aba da lista, os filtros, a busca, os responsáveis. Ela é
// guardada na guia (`sessionStorage`) logo antes da recarga e lida UMA vez na
// partida da página nova, que nasce com ela. É o que faz a recarga não mudar
// nada para quem volta.
const CHAVE_DA_FOTO = "zorvin_volta_da_atualizacao";
const FOTO_VALE_MS = 10 * 60 * 1000;
let fotoDaTela = null;
let fotoLida = null;
let fotoUsada = false;

/** A tela diz como estava (um objeto que vira JSON). */
export function registrarFotoDaTela(fn) {
  fotoDaTela = fn;
  return () => { if (fotoDaTela === fn) fotoDaTela = null; };
}

function lerFotoDaVolta() {
  try {
    const f = JSON.parse(sessionStorage.getItem(CHAVE_DA_FOTO) || "null");
    sessionStorage.removeItem(CHAVE_DA_FOTO);
    if (f && typeof f === "object" && Date.now() - Number(f.em || 0) < FOTO_VALE_MS) return f;
  } catch (_) { /* sem a foto, a tela nasce como sempre */ }
  return null;
}

/** A foto que a recarga deixou, até a tela dizer que já a usou. */
export function fotoDaVolta() {
  return fotoUsada ? null : fotoLida;
}

/** A tela já nasceu com a foto: uma segunda montagem (sair e entrar de novo)
 *  não volta para o que estava antes da recarga. */
export function marcarFotoUsada() {
  fotoUsada = true;
}

/** Quando a recarga feita por aqui saiu (o instante da foto), ou `null`. É
 *  daí que a página nova pergunta pelas mensagens que chegaram no meio. */
export function recargaFeitaEm() {
  return fotoLida && fotoLida.em ? Number(fotoLida.em) : null;
}

// ------------------------------------------------------------
//  A MARCA DA RECARGA — o que impede a volta em círculo
//
//  Antes de recarregar, a aba anota para qual versão foi. Voltando com o
//  código VELHO (o site ainda serviu o arquivo antigo), não recarrega de novo
//  para a mesma versão por uma hora: recarregar outra vez daria o mesmo, e a
//  tela piscaria sem parar. Fica no ⋮ o pedido do Ctrl+Shift+R, que aí é o
//  que resta.
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
  if (agora.id && agora.id === m.para) gravarMarca(null);
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
    ultimaRespostaEm = Date.now();
    const agora = versaoEmUso();
    // A VERSÃO DESCONHECIDA não se compara: sem saber o que roda, qualquer
    // arquivo pareceria novo, e a aba recarregaria à toa.
    if (!agora.id || v.id === agora.id) {
      if (estado.pendente || estado.naoPegou) mudar({ pendente: null, naoPegou: null });
      return;
    }
    const nova = { id: v.id, rotulo: String(v.rotulo || ""), data: String(v.data || "") };
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
 *  novo o que o "Atualizar o Zorvin" acabou de perguntar. */
export function recargaPedida() {
  return recargaDeProposito;
}

async function recarregar(alvo, { automatica, forte = false, momento = "" }) {
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
  // A FOTO DA TELA vai junto. Sem ela a página nova nasce como numa abertura
  // — e, de dia, a aba escondida não recarrega sem ela.
  let foto = null;
  try { foto = fotoDaTela ? fotoDaTela() : null; } catch (_) { foto = null; }
  let guardou = false;
  try {
    sessionStorage.setItem(CHAVE_DA_FOTO, JSON.stringify({ ...(foto || {}), automatica, momento, em: Date.now() }));
    guardou = true;
  } catch (_) { guardou = false; }
  if (automatica && momento === "escondida" && !guardou) return false;
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
  const momento = momentoSemNinguem();
  if (!momento) return;
  if (motivosParaEsperar().length) return;
  // Uma tentativa de cada vez: a pergunta ao site leva um instante.
  if (Date.now() - ultimaTentativa < 2000) return;
  ultimaTentativa = Date.now();
  recarregar(p, { automatica: true, momento });
}

/** O "Atualizar o Zorvin" do ⋮. Com algo que se perderia, pergunta antes,
 *  dizendo o quê. */
export async function atualizarAgora() {
  const p = estado.pendente || estado.naoPegou;
  if (!p) return { ok: false };
  const lista = motivosParaEsperar();
  if (lista.length) {
    const ok = window.confirm(`Atualizar agora apaga ${lista.join(", ")}. Atualizar assim mesmo?`);
    if (!ok) return { ok: false, cancelou: true };
  }
  const ok = await recarregar(p, { automatica: false, forte: Boolean(estado.naoPegou), momento: "pedida" });
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
  fotoLida = lerFotoDaVolta();
  for (const t of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(t, anotarGesto, { capture: true, passive: true });
  }
  document.addEventListener("beforeinput", anotarAntesDaTecla, true);
  document.addEventListener("input", anotarDepoisDaTecla, true);
  if (document.visibilityState === "hidden") escondidaDesde = Date.now();
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
    if (document.visibilityState === "visible") { escondidaDesde = null; aoVoltar(); }
    else { if (escondidaDesde === null) escondidaDesde = Date.now(); tentarSozinho(); }
  });
  window.addEventListener("focus", aoVoltar);
  window.addEventListener("online", () => { conferirVersao(); });
  setTimeout(() => { conferirVersao(); }, primeiraMs());
  setInterval(() => { conferirVersao(); }, aCadaMs());
  setInterval(() => {
    // LOGO DEPOIS DE ACORDAR, a rede pode levar uns segundos para voltar, e
    // a primeira pergunta pela versão falhar: dentro da janela da volta, ela
    // é refeita a cada olhada até ser respondida.
    if (acordouEm && Date.now() - acordouEm < janelaDaVoltaMs() && ultimaRespostaEm < acordouEm) conferirVersao();
    tentarSozinho();
  }, olharACadaMs());
  setInterval(bater, batidaMs());
}
