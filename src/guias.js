// ============================================================
//  AS TELAS QUE ABREM NUMA GUIA PRÓPRIA (02/11)
//
//  Pedido do Rodrigo: "Com exceção de 'Configurações' e 'Departamentos e
//  acessos' que abrem como popup, todas as outras opções ao clicar devem ser
//  abertas em uma nova guia." Funil, Tarefas, Esperando resposta e Painel
//  abrem (a Faxina da fila também abria, até sair em 12/11) cada uma numa guia do navegador, e a conversa aberta
//  de dentro de uma delas abre noutra guia, já nela (as duas respostas dele
//  à pergunta de como abrir a conversa e se os ícones da barra iam junto).
//
//  O ENDEREÇO DIZ O QUE A GUIA É, e é por isso que o F5 de uma guia de tela
//  continua na tela:
//
//    /?tela=funil&linha=<telefone>       uma tela (a linha só no funil: é o
//                                        funil do telefone aberto na barra)
//    /?conversa=<id>&linha=<telefone>    uma conversa
//    /?conversa=…&linha=…&tarefa=<id>    a conversa com a mensagem pronta do
//                                        lembrete na caixa de escrever
//
//  Os nomes não batem com os do link do Vantoro (`telefone`, `numero`,
//  `nome`, `de`): aquele link diz com QUEM falar, e estes dizem QUAL conversa
//  ou tela abrir. Misturar os dois faria um abrir pelo caminho do outro.
//
//  A GUIA DE UMA TELA É MAIS LEVE QUE O ZORVIN INTEIRO (ver `Painel.jsx`,
//  `TELA_DA_GUIA`): ela não assina o tempo real, não pergunta a saúde do
//  sistema e não toca aviso nenhum. Quem avisa é a guia das conversas.
// ============================================================

/** As telas que abrem numa guia, com o nome que vai no título da guia. */
export const TELAS_DA_GUIA = {
  funil: "Funil",
  tarefas: "Tarefas",
  esperando: "Esperando resposta",
  painel: "Painel",
  // A TELA DE TESTE DAS LIGAÇÕES (11/11), só para quem administra — ver
  // `ligacoes.js`. Numa guia própria: a ligação continua enquanto a pessoa
  // trabalha nas conversas na outra.
  ligacoes: "Ligações (teste)",
};

const parametros = (busca) => {
  try {
    return new URLSearchParams(busca != null ? busca
      : (typeof window !== "undefined" ? window.location.search : ""));
  } catch (_) {
    return new URLSearchParams("");
  }
};

/** A tela que esta guia é, ou `null` (é o Zorvin de sempre). Um nome que não
 *  é de tela nenhuma também é `null`: abre as conversas, em vez de uma guia
 *  em branco. */
export function telaDaGuia(busca) {
  const t = parametros(busca).get("tela");
  return t && Object.prototype.hasOwnProperty.call(TELAS_DA_GUIA, t) ? t : null;
}

/** O telefone que a guia de uma tela recebeu, ou `null`. */
export function linhaDaGuia(busca) {
  return parametros(busca).get("linha") || null;
}

/** A conversa que esta guia foi aberta para mostrar, ou `null`. */
export function conversaDaGuia(busca) {
  const p = parametros(busca);
  const conversaId = p.get("conversa");
  if (!conversaId) return null;
  return { conversaId, advogadoId: p.get("linha") || null, tarefaId: p.get("tarefa") || null };
}

const caminho = () => (typeof window !== "undefined" ? window.location.pathname : "/");

/** O endereço da guia de uma tela. */
export function enderecoDaTela(tela, { linha } = {}) {
  const p = new URLSearchParams({ tela });
  if (linha) p.set("linha", String(linha));
  return `${caminho()}?${p.toString()}`;
}

/** O endereço da guia de uma conversa. */
export function enderecoDaConversa({ conversaId, advogadoId, tarefaId } = {}) {
  const p = new URLSearchParams({ conversa: String(conversaId) });
  if (advogadoId) p.set("linha", String(advogadoId));
  if (tarefaId) p.set("tarefa", String(tarefaId));
  return `${caminho()}?${p.toString()}`;
}

/** Abre uma guia nova. `noopener`: a guia nova não alcança esta, e cada uma
 *  roda no seu canto — uma guia pesada não trava a outra. Chamada sempre de
 *  dentro de um clique, que é quando o navegador deixa abrir guia. */
export function abrirNumaGuia(endereco) {
  try { window.open(endereco, "_blank", "noopener"); } catch (_) { /* sem janela */ }
}

/** O botão de fechar da guia de uma tela. O navegador deixa fechar a guia que
 *  nasceu de um clique e não navegou para lugar nenhum — e é o caso dela.
 *  Recusando (a pessoa navegou dentro da guia, ou abriu o endereço à mão), a
 *  guia vira o Zorvin de sempre: o botão continua levando "de volta às
 *  conversas", que era o que ele fazia quando a tela abria por cima delas. */
export function fecharAGuia() {
  try { window.close(); } catch (_) { /* segue para o encosto */ }
  // `closed` vira verdade NA HORA quando o navegador aceita fechar: a guia
  // fecha depois, e esta conta não espera por isso.
  if (typeof window !== "undefined" && !window.closed) {
    try { window.location.replace(caminho()); } catch (_) { /* sem saída */ }
  }
}

// ============================================================
//  UM AVISO SÓ, COM QUANTAS GUIAS ESTIVEREM ABERTAS
//
//  Cada guia de conversa é um Zorvin inteiro, com o tempo real assinado: a
//  mensagem do cliente chega a TODAS, e todas tocariam o som e mostrariam a
//  tarja ao mesmo tempo. Com a conversa aberta noutra guia, a pessoa ouviria
//  o aviso da conversa que está lendo.
//
//  São duas guardas:
//
//    1. QUEM CHEGA PRIMEIRO AVISA (`reivindicarAviso`). A marca de cada aviso
//       fica no armazenamento do navegador, que as guias dividem, e a
//       conferência é feita sob a trava do navegador (`navigator.locks`), que
//       deixa uma guia por vez entre "olhei" e "marquei". Sem a trava, duas
//       guias que recebessem a mesma mensagem no mesmo milissegundo poderiam
//       olhar as duas antes de qualquer uma marcar;
//    2. A CONVERSA QUE OUTRA GUIA ESTÁ MOSTRANDO NÃO AVISA (`outraGuiaVendo`).
//       Cada guia diz, enquanto está à vista, qual conversa está mostrando.
// ============================================================

const CHAVE_DOS_AVISOS = "zorvin-avisos-dados";
const VALIDADE_DA_MARCA_MS = 15 * 60e3;
const NOME_DA_TRAVA = "zorvin-avisos";

function lerMarcas() {
  try {
    const m = JSON.parse(localStorage.getItem(CHAVE_DOS_AVISOS) || "{}");
    return m && typeof m === "object" && !Array.isArray(m) ? m : {};
  } catch (_) {
    return {};
  }
}

/** Marca e devolve se ESTA guia ficou com o aviso. As marcas velhas saem a
 *  cada gravação: um armazenamento que só cresce um dia estoura. */
function marcarSeLivre(chave) {
  const agora = Date.now();
  const marcas = lerMarcas();
  if (marcas[chave] && agora - marcas[chave] < VALIDADE_DA_MARCA_MS) return false;
  const limpas = {};
  for (const [k, t] of Object.entries(marcas)) if (agora - t < VALIDADE_DA_MARCA_MS) limpas[k] = t;
  limpas[chave] = agora;
  try { localStorage.setItem(CHAVE_DOS_AVISOS, JSON.stringify(limpas)); } catch (_) { /* sem armário: avisa assim mesmo */ }
  return true;
}

/** Roda `fazer` com a trava das guias: uma guia por vez. Sem a trava no
 *  navegador, roda direto — o pior caso é um aviso dobrado, como antes. */
export async function naVezDasGuias(fazer) {
  try {
    if (typeof navigator !== "undefined" && navigator.locks && typeof navigator.locks.request === "function") {
      return await navigator.locks.request(NOME_DA_TRAVA, () => fazer());
    }
  } catch (_) { /* trava que falha não cala o aviso */ }
  return fazer();
}

/** Esta guia fica com o aviso `chave`? Só a primeira que perguntar. */
export function reivindicarAviso(chave) {
  return naVezDasGuias(() => marcarSeLivre(String(chave)));
}

// ---- "Estou mostrando esta conversa" ----

const PREFIXO_DA_VISTA = "zorvin-vendo:";
const VALIDADE_DA_VISTA_MS = 90e3;
export const RENOVAR_A_VISTA_MS = 30e3;
const ID_DESTA_GUIA = (() => {
  try { return Math.random().toString(36).slice(2) + Date.now().toString(36); } catch (_) { return "guia"; }
})();

/** Diz às outras guias qual conversa esta mostra — ou que não mostra nenhuma.
 *  Só conta o que está À VISTA: a guia escondida atrás de outra não está
 *  mostrando nada a ninguém. A validade cobre a guia que fecha sem se
 *  despedir (o navegador que cai): ela deixa de valer sozinha. */
export function anunciarConversaVista(conversaId) {
  try {
    const chave = PREFIXO_DA_VISTA + ID_DESTA_GUIA;
    if (conversaId && typeof document !== "undefined" && !document.hidden) {
      localStorage.setItem(chave, JSON.stringify({ conversa: String(conversaId), ate: Date.now() + VALIDADE_DA_VISTA_MS }));
    } else {
      localStorage.removeItem(chave);
    }
  } catch (_) { /* sem armário: cada guia avisa por si, como antes */ }
}

/** Alguma OUTRA guia está mostrando esta conversa agora? */
export function outraGuiaVendo(conversaId) {
  if (!conversaId) return false;
  try {
    const agora = Date.now();
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIXO_DA_VISTA) && k !== PREFIXO_DA_VISTA + ID_DESTA_GUIA) chaves.push(k);
    }
    let vendo = false;
    for (const k of chaves) {
      let v = null;
      try { v = JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { v = null; }
      if (!v || !(v.ate > agora)) { localStorage.removeItem(k); continue; }
      if (String(v.conversa) === String(conversaId)) vendo = true;
    }
    return vendo;
  } catch (_) {
    return false;
  }
}

// ---- O que uma guia mudou, as outras releem ----
//
// Quando a tela abria por cima das conversas, fechá-la relia o que ela podia
// ter mudado: o número das tarefas, a etapa da conversa aberta. Em guias
// separadas não há "fechar" que leve a notícia — a guia das conversas
// continuaria dizendo o de antes até o F5. Então a guia que muda AVISA, e as
// outras releem só o que é delas.

const CANAL_DAS_GUIAS = "zorvin-guias";
let canalDasGuias = null;
const canal = () => {
  if (canalDasGuias) return canalDasGuias;
  try {
    if (typeof BroadcastChannel !== "undefined") canalDasGuias = new BroadcastChannel(CANAL_DAS_GUIAS);
  } catch (_) { canalDasGuias = null; }
  return canalDasGuias;
};

/** Avisa as OUTRAS guias (a que avisa não recebe o próprio aviso). */
export function avisarAsOutrasGuias(tipo) {
  try { const c = canal(); if (c) c.postMessage({ tipo: String(tipo) }); } catch (_) { /* sem canal: o F5 resolve */ }
}

/** Ouve o que as outras guias avisam. Devolve quem para de ouvir. */
export function ouvirAsOutrasGuias(aoOuvir) {
  const c = canal();
  if (!c) return () => {};
  const tratar = (e) => { const tipo = e && e.data && e.data.tipo; if (tipo) aoOuvir(tipo); };
  c.addEventListener("message", tratar);
  return () => { try { c.removeEventListener("message", tratar); } catch (_) { /* já fechado */ } };
}
