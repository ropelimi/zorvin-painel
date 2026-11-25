// ============================================================
//  AS CONVERSAS DO QUAZAR (25/11) — as contas, sem tela.
//
//  Pedido do Rodrigo: "Tem alguma forma de eu ver todas as mensagens que o
//  Quazar conversou com o cliente que estava aguardando há mais de 7 dias?
//  Cria uma tela só para isso".
//
//  A MENSAGEM DO QUAZAR é a que a ponte manda pela fila com a marca dele
//  (`mensagens.pelo_quazar`, script 059 da ponte): ela entra como do
//  escritório (`origem = 'advogado'`), automática e sem autor. Não é a equipe
//  respondendo, e por isso a espera do cliente não para nela.
//
//  A ESPERA, contada como a da fila: começa na PRIMEIRA mensagem do cliente
//  depois da última mensagem de GENTE da equipe (nem o Quazar, nem o aviso
//  automático do Vantoro), e vai até a primeira mensagem do Quazar. Em dias de
//  calendário, no fuso de São Paulo — a régua do "esperando há N dias" da
//  lista (`espera.js`): quem escreveu ontem às 23h esperava "1 dia".
//
//  UM EPISÓDIO é o trecho em que o Quazar falou sem ninguém da equipe no
//  meio: começa na primeira mensagem dele depois da última de gente, e acaba
//  quando alguém da equipe escreve. Uma conversa pode ter vários (uma noite,
//  depois a faxina de dia). A linha da tela mostra o da MAIOR espera, que é a
//  pergunta do pedido ("o cliente que estava aguardando há mais de 7 dias").
// ============================================================

import { NOME_DO_ASSISTENTE } from "./assistente.js";

export const FUSO_DO_ESCRITORIO = "America/Sao_Paulo";

/** Quantas mensagens do Quazar a tela lê, as mais recentes. Medido em 25/11:
 *  eram ~237 no banco inteiro. Passando disso, a tela diz que cortou. */
export const TETO_DAS_MENSAGENS_DO_QUAZAR = 500;

/** As escolhas do alto da tela, e o padrão: o pedido foi o de 7 dias. */
export const FILTROS_DA_ESPERA = [
  { id: "7", rotulo: "Esperavam há 7 dias ou mais", dias: 7 },
  { id: "2", rotulo: "2 dias ou mais", dias: 2 },
  { id: "todas", rotulo: "Todas", dias: 0 },
];
export const FILTRO_PADRAO = "7";

/** O BANCO SEM A MARCA DO QUAZAR (o script 059 da ponte não rodou): a leitura
 *  que filtra por `pelo_quazar` responde 42703 (Postgres) ou PGRST204, com o
 *  nome da coluna. É ausência do recurso, e não falha. */
export function semAColunaDoQuazar(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  if (codigo !== "42703" && codigo !== "PGRST204") return false;
  return /pelo_quazar/.test(`${erro.message || ""} ${erro.details || ""}`);
}

export const ehDoQuazar = (m) => !!m && m.pelo_quazar === true;
export const ehDoCliente = (m) => !!m && m.origem === "contato";
/** Gente da equipe: do escritório, e nem automática nem do Quazar. A mandada
 *  pelo celular do escritório conta (alguém a escreveu). */
export const ehDaEquipe = (m) => !!m && m.origem === "advogado" && !m.automatica && !m.pelo_quazar;

const formatoDoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DO_ESCRITORIO, year: "numeric", month: "2-digit", day: "2-digit",
});

/** O dia de calendário de São Paulo, como "AAAA-MM-DD". */
export function diaEmSaoPaulo(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatoDoDia.format(d);
}

/** Quantos dias de calendário (em São Paulo) vão de `desde` até `ate`. */
export function diasDeCalendario(desde, ate) {
  const a = diaEmSaoPaulo(desde);
  const b = diaEmSaoPaulo(ate);
  if (!a || !b) return 0;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400e3));
}

/** Na ordem em que aconteceram; a mesma hora desempata pelo id (o álbum de
 *  fotos chega com a mesma hora). */
export function emOrdem(mensagens) {
  return [...(mensagens || [])].sort((a, b) => {
    const t = new Date(a.criado_em) - new Date(b.criado_em);
    if (t) return t;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** Os episódios do Quazar numa conversa (ver o alto do arquivo). Cada um diz:
 *  - `esperaDesde`: a primeira mensagem do cliente que esperava (ou nulo);
 *  - `dias`: a espera, em dias de calendário, até a primeira do Quazar;
 *  - `primeiraEm` e `ultimaEm`: as mensagens do Quazar;
 *  - `idsDaEspera`: as mensagens do cliente que esperavam;
 *  - `ids`: do Quazar em diante, as dele e as do cliente, até a equipe entrar;
 *  - `quantasDoQuazar`, `clienteRespondeu`;
 *  - `equipeEntrouEm`: quando alguém da equipe escreveu depois (ou nulo);
 *  - `semEquipeAntes`: não havia mensagem de gente da equipe antes. */
export function episodiosDoQuazar(mensagens) {
  const ms = emOrdem(mensagens);
  const episodios = [];
  let ultimaDaEquipe = -1;
  let atual = null;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    if (ehDaEquipe(m)) {
      if (atual) { atual.equipeEntrouEm = m.criado_em; atual = null; }
      ultimaDaEquipe = i;
      continue;
    }
    if (ehDoQuazar(m)) {
      if (!atual) {
        const espera = ms.slice(ultimaDaEquipe + 1, i).filter(ehDoCliente);
        atual = {
          esperaDesde: espera.length ? espera[0].criado_em : null,
          dias: espera.length ? diasDeCalendario(espera[0].criado_em, m.criado_em) : 0,
          primeiraEm: m.criado_em,
          ultimaEm: m.criado_em,
          idsDaEspera: espera.map((x) => x.id),
          ids: [],
          quantasDoQuazar: 0,
          clienteRespondeu: false,
          equipeEntrouEm: null,
          semEquipeAntes: ultimaDaEquipe < 0,
        };
        episodios.push(atual);
      }
      atual.ids.push(m.id);
      atual.quantasDoQuazar++;
      atual.ultimaEm = m.criado_em;
      continue;
    }
    if (atual && ehDoCliente(m)) {
      atual.ids.push(m.id);
      atual.clienteRespondeu = true;
    }
  }
  return episodios;
}

/** O que a linha da tela diz de uma conversa: o episódio da maior espera (no
 *  empate, o mais recente), quantas mensagens o Quazar mandou nela e quando
 *  foi a última. Sem mensagem do Quazar (a leitura das mensagens veio sem
 *  ela), nulo. */
export function resumoDaConversa(mensagens) {
  const episodios = episodiosDoQuazar(mensagens);
  if (!episodios.length) return null;
  let principal = episodios[0];
  for (const e of episodios) {
    if (e.dias > principal.dias || (e.dias === principal.dias && new Date(e.primeiraEm) > new Date(principal.primeiraEm))) {
      principal = e;
    }
  }
  return {
    episodios,
    principal,
    quantasDoQuazar: episodios.reduce((s, e) => s + e.quantasDoQuazar, 0),
    ultimaDoQuazarEm: episodios[episodios.length - 1].ultimaEm,
  };
}

/** A linha passa no filtro de cima? */
export function passaNaEspera(resumo, filtroId) {
  const f = FILTROS_DA_ESPERA.find((x) => x.id === filtroId) || FILTROS_DA_ESPERA[0];
  if (!f.dias) return true;
  return !!resumo && resumo.principal.dias >= f.dias;
}

/** "há 9 dias", "há 1 dia". */
export function haDias(dias) {
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

const formatoDaHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_DO_ESCRITORIO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

/** "23/11 às 10:05", no horário de Brasília. */
export function horaDeBrasilia(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const partes = Object.fromEntries(formatoDaHora.formatToParts(d).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month} às ${partes.hour}:${partes.minute}`;
}

/** A frase da espera, na linha. */
export function fraseDaEspera(principal) {
  if (!principal) return "";
  const quando = horaDeBrasilia(principal.primeiraEm);
  if (!principal.esperaDesde) return `O ${NOME_DO_ASSISTENTE} escreveu sem o cliente estar esperando (${quando})`;
  if (principal.dias === 0) return `O cliente tinha escrito no mesmo dia quando o ${NOME_DO_ASSISTENTE} respondeu (${quando})`;
  return `O cliente esperava ${haDias(principal.dias)} quando o ${NOME_DO_ASSISTENTE} respondeu (${quando})`;
}

/** O texto de uma mensagem na conversa da tela: o escrito, o que foi dito
 *  num áudio, ou o anexo pelo nome. Nunca HTML: quem desenha é o React. */
export function textoDaMensagem(m) {
  if (!m) return "";
  const texto = String(m.texto || "").trim();
  if (texto && texto !== "[anexo]") return texto;
  if (m.transcricao) return `🎤 ${String(m.transcricao).trim()}`;
  const tipo = m.tipo && m.tipo !== "texto" ? m.tipo : "anexo";
  return m.midia_nome ? `[${tipo}: ${m.midia_nome}]` : `[${tipo}]`;
}
