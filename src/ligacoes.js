// ============================================================
//  AS LIGAÇÕES PELO ZORVIN — A TELA DE TESTE (11/11)
//
//  Pedido do Rodrigo: fazer ligações pelo Zorvin, sem pegar o aparelho. O
//  caminho escolhido é o VoIP da Nvoip, com um número novo (o fixo fica como
//  está), e não a API oficial do WhatsApp, que ele recusou. A ligação sai do
//  NAVEGADOR: o Zorvin fala SIP por uma conexão WebSocket segura (WSS) com o
//  servidor da Nvoip, e a voz vai por WebRTC, como numa chamada do Meet.
//
//  ESTA É A TELA DE TESTE, e não a da equipe. Ela existe para conferir, com o
//  teste de 7 dias da Nvoip, três coisas antes de construir o resto:
//    1. o Zorvin conecta e se registra com o usuário SIP;
//    2. a ligação sai, e as duas pontas se ouvem;
//    3. a ligação que chega no número toca aqui.
//
//  A SENHA SIP É DIGITADA NA TELA, E SÓ MORA NA MEMÓRIA DESTA GUIA. Não vai
//  ao banco, nem ao navegador (`localStorage`), nem à ponte, nem ao registro
//  de eventos: fechou ou recarregou a guia, ela some. É a régua das senhas da
//  ficha (ver o CLAUDE.md, "O que foi digitado na ficha não some"). A versão
//  da equipe, com um usuário só para todos e o aviso de "linha em uso",
//  decide depois onde a senha mora — e isso pede o OK do contrato da Nvoip.
//
//  As contas que não precisam de tela moram aqui; a tela é `Ligacoes.jsx`.
// ============================================================

/** O endereço WSS que a Nvoip passou (o João, 11/11). A porta 7443 é a de
 *  WebRTC do FreeSWITCH, que é o servidor por trás dela. */
export const WSS_PADRAO = "wss://app.nvoip.com.br:7443";

/** O servidor de STUN, que só diz ao navegador por qual endereço público ele
 *  sai para a internet. Não passa voz nenhuma por ele. */
export const STUN = [{ urls: "stun:stun.l.google.com:19302" }];

/** O domínio SIP que vale quando ninguém escreveu um: o servidor do endereço
 *  WSS. No FreeSWITCH costuma ser o mesmo. Endereço que não se lê dá "". */
export function dominioDoEndereco(wss) {
  try {
    const u = new URL(String(wss || "").trim());
    return u.hostname || "";
  } catch (_) {
    return "";
  }
}

/** Separa "usuario@dominio": quem colar o endereço SIP inteiro no campo do
 *  usuário não pode acabar com "usuario@dominio@dominio". */
export function separarUsuario(texto) {
  const t = String(texto || "").trim().replace(/^sips?:/i, "");
  const i = t.indexOf("@");
  return i < 0 ? { usuario: t, dominio: "" } : { usuario: t.slice(0, i), dominio: t.slice(i + 1) };
}

/** A conta, arrumada e conferida antes de conectar. Devolve `{ erro }` com a
 *  frase do que falta, ou `{ wss, usuario, dominio, uri }`. A senha não volta
 *  aqui de propósito: ela vai direto do campo para a biblioteca. */
export function conferirConta({ wss, usuario, senha, dominio } = {}) {
  const endereco = String(wss || "").trim();
  // ws:// (sem o S) só para a própria máquina: a conexão sem criptografia
  // levaria a senha SIP aberta pela internet.
  const local = /^ws:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(endereco);
  if (!local && !/^wss:\/\/[^\s/]+/i.test(endereco)) {
    return { erro: "O endereço tem de começar com wss:// (a Nvoip passou wss://app.nvoip.com.br:7443)." };
  }
  const separado = separarUsuario(usuario);
  if (!separado.usuario) return { erro: "Falta o usuário SIP (o que termina em 001, no painel da Nvoip)." };
  if (/\s/.test(separado.usuario)) return { erro: "O usuário SIP não tem espaço no meio. Confira o que foi colado." };
  if (!String(senha || "")) return { erro: "Falta a senha SIP (no painel da Nvoip: Configurações > Usuários > editar o usuário)." };
  const dom = String(dominio || "").trim() || separado.dominio || dominioDoEndereco(endereco);
  if (!dom || /\s/.test(dom)) return { erro: "O domínio SIP não se lê. Deixe em branco para usar o do endereço." };
  return { wss: endereco, usuario: separado.usuario, dominio: dom, uri: `sip:${separado.usuario}@${dom}` };
}

/** O número como vai ser discado: só os algarismos. O "+" e o "55" da frente
 *  NÃO são tirados: quem diz o formato que a Nvoip espera é o teste, e a tela
 *  mostra o que vai ser discado antes do clique. */
export function numeroParaDiscar(texto) {
  const digitos = String(texto || "").replace(/\D/g, "");
  if (!digitos) return { erro: "Digite o número, com o DDD." };
  if (digitos.length < 3) return { erro: "Número curto demais." };
  if (digitos.length > 15) return { erro: "Número comprido demais (mais de 15 algarismos)." };
  return { numero: digitos };
}

/** De quem é a ligação que chega: o número do "From", sem o resto. */
export function quemLiga(uri, nome) {
  const n = String(nome || "").trim();
  const u = String(uri || "").replace(/^sips?:/i, "").split("@")[0].split(";")[0];
  if (n && n !== u) return `${n} (${u})`;
  return u || n || "número escondido";
}

/** Os motivos do JsSIP (`JsSIP.C.causes`), em português. O que não estiver
 *  aqui vai como veio, para não sumir com a pista. */
const MOTIVOS = {
  "Busy": "o número está ocupado",
  "Rejected": "a ligação foi recusada",
  "Redirected": "a ligação foi desviada",
  "Unavailable": "o número não está disponível",
  "Not Found": "o número não existe ou a Nvoip não achou o destino",
  "Address Incomplete": "o número está incompleto (confira o DDD)",
  "Incompatible SDP": "o servidor e o navegador não combinaram o áudio",
  "Missing SDP": "o servidor não mandou a descrição do áudio",
  "Bad Media Description": "o servidor mandou um áudio que o navegador não entende",
  "Authentication Error": "a Nvoip recusou o usuário ou a senha SIP",
  "Bye": "a ligação foi encerrada",
  "Canceled": "a ligação foi cancelada antes de ser atendida",
  "No Answer": "ninguém atendeu",
  "Expires": "a ligação expirou sem resposta",
  "No ACK": "o servidor não confirmou a ligação",
  "Dialog Error": "a ligação se perdeu no meio",
  "User Denied Media Access": "o navegador não deixou usar o microfone",
  "WebRTC Error": "o navegador não conseguiu montar o áudio",
  "RTP Timeout": "o áudio parou de chegar",
  "Connection Error": "a conexão com a Nvoip caiu",
  "Request Timeout": "a Nvoip não respondeu a tempo",
  "SIP Failure Code": "a Nvoip respondeu com um erro",
  "Internal Error": "erro interno do navegador",
};

/** A frase do fim de uma ligação, com o código SIP quando houver. */
export function fraseDoFim(causa, codigo) {
  const base = MOTIVOS[causa] || (causa ? `motivo: ${causa}` : "a ligação terminou");
  return codigo ? `${base} (código SIP ${codigo})` : base;
}

/** A frase da falha do registro (conectar a conta). Os casos de sempre são
 *  dois, e pedem coisas opostas: a senha (401/403) e a rede. */
export function fraseDaFalhaDoRegistro(causa, codigo) {
  if (codigo === 401 || codigo === 403 || causa === "Authentication Error") {
    return `A Nvoip recusou o usuário ou a senha SIP${codigo ? ` (código ${codigo})` : ""}. Confira os dois no painel da Nvoip: Configurações > Usuários > editar o usuário.`;
  }
  if (codigo === 404) return "A Nvoip não reconheceu esse usuário neste domínio (código 404). Confira o usuário e o domínio SIP.";
  if (causa === "Connection Error" || causa === "Request Timeout") {
    return `Não consegui falar com o servidor da Nvoip (${causa === "Connection Error" ? "a conexão não abriu ou caiu" : "ele não respondeu a tempo"}). Confira o endereço WSS e a internet.`;
  }
  return `A Nvoip não aceitou o registro: ${fraseDoFim(causa, codigo)}.`;
}

/** A frase do microfone recusado. O navegador dá nomes diferentes ao mesmo
 *  caso, e cada um pede um gesto. */
export function fraseDoMicrofone(erro) {
  const nome = erro && (erro.name || erro.message) || "";
  if (/NotAllowed|Permission|denied/i.test(nome)) {
    return "O navegador não deixou usar o microfone. Clique no cadeado ao lado do endereço do Zorvin, permita o microfone e tente de novo.";
  }
  if (/NotFound|DevicesNotFound/i.test(nome)) return "Nenhum microfone foi encontrado neste computador.";
  if (/NotReadable|TrackStart/i.test(nome)) return "O microfone está sendo usado por outro programa (o Meet, o WhatsApp do computador…). Feche o outro e tente de novo.";
  return `Não consegui usar o microfone${nome ? ` (${nome})` : ""}.`;
}

/** mm:ss, ou h:mm:ss passando de uma hora. */
export function duracaoDaLigacao(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const dois = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${dois(m)}:${dois(ss)}` : `${dois(m)}:${dois(ss)}`;
}

/** As teclas do teclado (para a URA de um banco, "digite 1"). */
export const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/** A biblioteca SIP (JsSIP), buscada só quando alguém abre esta tela — ela
 *  não entra no arquivo principal do Zorvin, como o pdf.js. Na BANCADA, a
 *  prova põe no lugar uma de mentira (`__SIP_DE_MENTIRA`): o servidor da
 *  Nvoip não está ao alcance da prova, e a voz de verdade não se mede ali. */
export async function carregarSip() {
  if (import.meta.env.VITE_BANCADA === "1" && typeof window !== "undefined" && window.__SIP_DE_MENTIRA) {
    return window.__SIP_DE_MENTIRA;
  }
  const m = await import("jssip");
  return m.default || m;
}
