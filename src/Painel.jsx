import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import {
  Search, Send, Paperclip, Smile, ChevronDown, MoreVertical,
  MessageSquare, Mic, CheckCheck, LogOut, ArrowLeft, Sun, Moon,
  Clock, AlertCircle, Reply, X, FileText, Download, ChevronUp,
  StickyNote, Plus, Trash2, Settings, Camera, Pencil, Tag, Check, Star,
  Archive, UserPlus, MessageSquarePlus, SquarePen, Pause, ClipboardList, ShieldCheck,
  ChevronLeft, ChevronRight, Images, ExternalLink, Pin
} from "lucide-react";
import FichaVantoro from "./FichaVantoro";
import { chamarPonte } from "./ponte.js";
import Departamentos from "./Departamentos";
import Marca from "./Marca";

// ============================================================
//  ZORVIN by Ropelimi — Painel real (conectado ao Supabase)
//  Lê advogados, conversas e mensagens reais; recebe novidades
//  em tempo real (Realtime); envia gravando na fila_envio.
// ============================================================

// URL da ponte (bridge). Ao enviar, o painel dá um "toque" nela para
// ACORDAR a ponte na hora (o Render free hiberna) e despachar a fila —
// senão a mensagem fica "carregando" até chegar algo de fora.
const BRIDGE_URL = (import.meta.env.VITE_BRIDGE_URL || "").replace(/\/$/, "");

// ETIQUETA AUTOMÁTICA NA CONVERSA: NÃO EXISTE MAIS.
//
// O sistema carimbava cada conversa com o "grupo" dela — Acordos, Clientes,
// Vendas, Interno e, para quem não estava no cadastro, "Sem identificar". Na
// tela, isso ficava idêntico às tags que a equipe cria à mão, e a diferença
// importa: uma foi escolhida por alguém, a outra o sistema inventou. "Sem
// identificar" caía em quase toda conversa, porque é o balaio de quem ainda não
// tem ficha — uma etiqueta que diz "não sei" em toda linha da lista.
//
// Saíram os selos, as abas de filtro por grupo e o que só existia para
// desenhá-los. As tags de verdade — as que se criam na tela de tags — continuam
// intactas, e agora são as únicas coisas coloridas na lista.
// COMO UM CONTATO SE CHAMA NA TELA.
//
// Sem nome salvo, mostra-se o número — mas GRUPO não tem número: a chave dele é
// o identificador do WhatsApp (`grupo:120363…`), e imprimir isso com um "+" na
// frente dá "+grupo:120363021070929710", que não é nada. Antes deste conserto,
// mensagem de grupo caía numa conversa cujo título era um pedaço desse
// identificador ("+70929710") — sem nome, porque o nome do grupo era ignorado.
//
// O CADASTRO MANDA. Quem já tem ficha no Vantoro aparece aqui com o nome da
// ficha, não com o nome que veio do WhatsApp — porque esse é o que a própria
// pessoa escreveu no aparelho dela ("Jô 💜", "Eu", o nome da loja) e não é o
// nome com que o escritório trata o processo. Quem não tem ficha continua
// aparecendo como o WhatsApp mandou.
function nomeDoContato(contato) {
  if (!contato) return "";
  if (contato.vantoro_nome) return contato.vantoro_nome;
  if (contato.nome) return contato.nome;
  const numero = String(contato.numero || "");
  return numero.startsWith("grupo:") ? "Grupo" : "+" + numero;
}

// AS COLUNAS DE CONTATO QUE A TELA PEDE AO BANCO.
//
// `vantoro_nome` só existe depois do SQL das frentes. Pedir coluna que não
// existe não devolve nulo — derruba a consulta INTEIRA, e a lista de conversas
// sumiria por causa de um extra. Então pedimos com ela e, no primeiro "não
// existe", descemos para o conjunto de sempre e não perguntamos de novo nesta
// sessão. É a mesma tolerância que a Ponte já tem do outro lado ao gravar.
let TEM_NOME_DO_CADASTRO = true;
const colunasDoContato = (base) =>
  TEM_NOME_DO_CADASTRO ? base + ", vantoro_nome" : base;

// RECURSOS QUE DEPENDEM DE COLUNA QUE PODE NÃO EXISTIR.
//
// O painel foi escrito para não quebrar quando um SQL não foi rodado: a
// consulta falha, o erro é ignorado, e o recurso "fica dormente". O que faltava
// é que IGNORAR não é PARAR DE PEDIR. O "estou atendendo" reescrevia
// `atendendo_em` de 60 em 60 segundos, em cada aba aberta, numa coluna que
// talvez não exista — e cada tentativa é uma linha de ERRO no log do Postgres.
// Um dia de trabalho com duas abas abertas são alguns milhares de erros no
// painel do Supabase, que é justamente onde um erro DE VERDADE precisaria
// aparecer para ser visto.
//
// Agora cada recurso é perguntado UMA vez por sessão. Falhou, fica desligado
// até a próxima abertura do painel — quando o SQL tiver sido rodado, um F5
// basta para ele voltar.
// Só desliga por FALTA DE COLUNA — que é permanente até alguém rodar o SQL.
// Queda de rede e sessão expirada também devolvem erro, e essas passam sozinhas:
// desligar o recurso por causa delas apagaria da tela, até o próximo F5, algo
// que estava funcionando um segundo antes.
//   42703 = coluna não existe   42P01 = tabela não existe
//   PGRST204 = o PostgREST não achou a coluna no cache do esquema
const SEM_ESSA_COLUNA = ["42703", "42P01", "PGRST204", "PGRST200"];
function faltaColuna(erro) {
  if (!erro) return false;
  if (SEM_ESSA_COLUNA.includes(String(erro.code))) return true;
  return /does not exist|could not find|schema cache/i.test(String(erro.message || ""));
}

const RECURSOS = { atendendo: true, digitando: true };
function desligarRecurso(nome, erro) {
  if (!RECURSOS[nome] || !faltaColuna(erro)) return;
  RECURSOS[nome] = false;
  console.info(`Zorvin: o recurso "${nome}" ficou desligado nesta sessão — `
    + `${(erro && erro.message) || "o banco recusou a consulta"}. `
    + "Rode o SQL correspondente no Supabase e recarregue a página.");
}

// QUAIS TELEFONES ESTA PESSOA PODE USAR.
//
// O bug que isto conserta: quem tinha acesso só a "Acordos" via também as abas
// de "Sucesso do Cliente" e podia atender por um telefone de lá.
//
// A causa não estava na permissão, e sim aqui: a tabela `advogados` é de leitura
// LIVRE no banco (`using (true)`) — precisa ser, porque a tela mostra o nome do
// telefone em vários lugares. O painel montava as abas de departamento a partir
// dessa lista inteira, com um comentário afirmando que "o banco já filtrou". O
// banco filtra as CONVERSAS (e essas nunca vazaram), não a lista de telefones.
//
// A regra abaixo é a mesma da função `pode_ver_conversa` do banco, escrita em
// JavaScript: cada linha de permissão vale para um departamento, para um
// telefone, ou para os dois juntos — e o vazio quer dizer "qualquer".
//
// Sem conseguir ler as permissões, a tela não oferece telefone NENHUM. É o
// contrário do que se faz com dado comum: aqui, na dúvida, mostrar de menos é o
// erro barato e mostrar de mais é o caro.
function filtrarPermitidos(telefones, permissoes, ehAdmin, erro) {
  if (ehAdmin) return telefones;
  if (erro) return [];
  return telefones.filter((a) => (permissoes || []).some(
    (p) => (!p.departamento_id || p.departamento_id === a.departamento_id)
        && (!p.telefone_id || p.telefone_id === a.id)));
}

function acordarPonte() {
  if (!BRIDGE_URL) return;
  // "no-cors": só precisamos que o pedido CHEGUE na ponte (acorda + despacha);
  // não lemos a resposta. Falha de rede é ignorada de propósito.
  try { fetch(BRIDGE_URL + "/", { mode: "no-cors", cache: "no-store" }).catch(() => {}); } catch (_) { /* ignora */ }
}

// `green` é a cor de PREENCHIMENTO (botão, aba escolhida, anel do avatar) e o
// verde do WhatsApp continua sendo ele. `verdeTexto` é outra coisa: o mesmo
// verde escrito em letra miúda — "digitando…", a hora de quem tem não lidas.
// Ali o #00a884 dava 3,0:1 no tema claro e 3,9:1 sobre a conversa selecionada
// no escuro; letra de 11px nesse contraste é o tipo de coisa que só quem tem
// vinte anos e um monitor bom consegue ler. `horaNaoLida` existe separado
// porque ela aparece sobre DOIS fundos (a linha comum e a selecionada).
const TEMAS = {
  claro: {
    rail: "#202c33", headerBar: "#f0f2f5", panel: "#ffffff", listActive: "#f0f2f5",
    chatBg: "#efeae2", bubbleIn: "#ffffff", bubbleOut: "#d9fdd3", green: "#00a884",
    greenDark: "#008069", textPrimary: "#111b21", textSecondary: "#667781",
    divider: "#e9edef", unread: "#008069", inputBg: "#ffffff", searchBg: "#f0f2f5",
    placeholderCircle: "#dfe5e7", link: "#027eb5",
    verdeTexto: "#017561", horaNaoLida: "#017561",
  },
  escuro: {
    rail: "#161717", headerBar: "#202c33", panel: "#111b21", listActive: "#2a3942",
    chatBg: "#0b141a", bubbleIn: "#202c33", bubbleOut: "#005c4b", green: "#00a884",
    greenDark: "#025144", textPrimary: "#e9edef", textSecondary: "#9aa8b1",
    divider: "#222d34", unread: "#008069", inputBg: "#2a3942", searchBg: "#202c33",
    // Um tom acima do #8696a0 de antes: aquele dava 5,7:1 na linha comum, mas
    // só 3,9:1 na conversa SELECIONADA, que tem o fundo mais claro — e a
    // prévia da conversa aberta é justamente a que mais se lê agora que ela
    // continua na lista com o selo de não lida.
    placeholderCircle: "#202c33", link: "#53bdeb",
    verdeTexto: "#1fbf9c", horaNaoLida: "#1fbf9c",
  },
};

// O BOTÃO QUE É SÓ UM ÍCONE.
//
// O alvo do toque tem de ser maior que o desenho. Aqui os ícones têm de 19 a
// 24px e o botão não tinha respiro nenhum: o alvo era o próprio desenho —
// metade do que se recomenda para dedo (44px), e menos ainda para quem tem a
// mão trêmula. No computador o mouse acerta; no celular a pessoa erra, abre a
// conversa que estava por baixo, ou não acontece nada e ela toca de novo.
//
// 10px de respiro em volta de um ícone de 20 dão 40px de alvo sem mudar nada
// do que se vê: o desenho continua do mesmo tamanho, no mesmo lugar.
const BOTAO_ICONE = {
  border: "none", background: "transparent", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 10, borderRadius: 8, flexShrink: 0,
};

// Cores disponíveis ao criar uma tag (o usuário escolhe uma).
// Escuras o bastante para o texto BRANCO por cima ser legível: o verde-claro e
// o azul-claro de antes davam 2,4:1 e 2,6:1 numa etiqueta de 10,5px.
const CORES_TAG = ["#d32f2f", "#c2185b", "#8e24aa", "#5e35b1", "#3949ab", "#1976d2", "#00796b", "#2e7d32", "#8f6800", "#cc3f12", "#6d4c41", "#546e7a"];

// PRETO OU BRANCO POR CIMA DESTA COR?
//
// As etiquetas já criadas guardam a cor no banco, e várias são claras — o
// "Acordo fechado" verde-claro dava 2,4:1 com letra branca, ilegível. Trocar a
// paleta só conserta as etiquetas NOVAS; escolher a letra pela cor conserta
// também as que a equipe já criou, sem mexer no banco.
//
// Não há corte mágico de luminância: a conta certa é medir o contraste das
// DUAS opções e ficar com a maior. Um azul médio como o #42a5f5 engana — pela
// aparência pede letra branca, mas dá 2,6:1 com branco e 7,9:1 com preto.
function corDoTextoSobre(fundo) {
  const s = String(fundo || "").replace("#", "");
  if (s.length !== 6) return "#fff";
  const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const l = 0.2126 * canal(parseInt(s.slice(0, 2), 16))
          + 0.7152 * canal(parseInt(s.slice(2, 4), 16))
          + 0.0722 * canal(parseInt(s.slice(4, 6), 16));
  const comBranco = 1.05 / (l + 0.05);
  const comPreto = (l + 0.05) / 0.05;
  return comPreto > comBranco ? "#101c14" : "#fff";
}

// Cor de avatar estável a partir do texto (mesmo nome = mesma cor).
// As dez cores dos círculos de avatar. Todas escuras o bastante para a letra
// BRANCA por cima passar de 4,5:1 — o laranja e o verde-limão de antes davam
// 2,7:1 e 2,5:1, e a inicial sumia no círculo justamente nas telas de fora,
// onde o brilho do sol já come metade do contraste.
const CORES = ["#027abc", "#b55c00", "#577d2e", "#8e24aa", "#5e35b1", "#007f8f", "#d81b60", "#6a5acd", "#008476", "#c2185b"];
function corDe(txt) {
  let h = 0;
  for (let i = 0; i < (txt || "").length; i++) h = (h * 31 + txt.charCodeAt(i)) % CORES.length;
  return CORES[h];
}

// Cor do NOME de quem enviou, exibido em cima de fundos coloridos (bolha verde
// enviada, bolha de nota). Precisa de bom contraste em cada tema: tons claros
// no modo escuro, tons escuros no modo claro. Estável por nome.
// Ajustadas para 4,6:1 sobre o balão de saída de cada tema (#005c4b no escuro,
// #d9fdd3 no claro) — três do escuro e quatro do claro ficavam entre 3,9 e 4,5,
// que é o suficiente para a pessoa ver que tem um nome ali e não conseguir ler
// qual é. O matiz é o mesmo; só a claridade mudou.
const CORES_NOME_ESCURO = ["#8fd0ff", "#ffd08a", "#b6e88f", "#ffb0d4", "#d1c1ff", "#8ce6d6", "#ffb892", "#a7d8ff", "#8ee0b0", "#ffb6c4"];
const CORES_NOME_CLARO = ["#0272b5", "#ab5300", "#4c7a1d", "#8e24aa", "#4527a0", "#007984", "#ad1457", "#3949ab", "#00695c", "#b71c40"];
function corNome(txt, modo) {
  const arr = modo === "escuro" ? CORES_NOME_ESCURO : CORES_NOME_CLARO;
  let h = 0;
  for (let i = 0; i < (txt || "").length; i++) h = (h * 31 + txt.charCodeAt(i)) % arr.length;
  return arr[h];
}

function horaDe(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// O NÚMERO DE QUEM ESTÁ ATENDENDO, legível.
//
// O painel atende por VÁRIOS números, e o nome sozinho não diz qual. "Cadastro"
// e "Comercial 1" são rótulos internos: quem precisa passar o número para um
// cliente ("me chama no ...") ou conferir se está respondendo pela linha certa
// não tem onde ler o número sem abrir o Supabase. Dois números do mesmo setor
// deixam a dúvida permanente.
//
// Guarda no banco vem cru e com o país ("5511934042997"). Aqui sai como se lê em
// voz alta. Número fora do formato brasileiro volta como veio: melhor mostrar o
// que existe do que esconder o que não coube na máscara.
function numeroBonito(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  if (!d) return "";
  const nac = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  if (nac.length === 11) return `(${nac.slice(0, 2)}) ${nac.slice(2, 7)}-${nac.slice(7)}`;
  if (nac.length === 10) return `(${nac.slice(0, 2)}) ${nac.slice(2, 6)}-${nac.slice(6)}`;
  return bruto;
}

// "Cadastro · (11) 93404-2997" — e só "Cadastro" quando não há número gravado.
function comNumero(adv) {
  if (!adv) return "";
  const n = numeroBonito(adv.numero);
  return n ? `${adv.nome} · ${n}` : adv.nome;
}

// Sempre HH:MM (usada no carimbo das bolhas; a data fica no separador).
function horaCurta(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Rótulo de dia para o separador de datas (HOJE / ONTEM / dd/mm/aaaa).
function rotuloData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mesmoDia(d, hoje)) return "HOJE";
  if (mesmoDia(d, ontem)) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Marca de status (tiquinhos) de uma mensagem que EU enviei, estilo WhatsApp.
function marcaLida(status) {
  return status === "lida" || status === "read" || status === "lido";
}

// Formata segundos como m:ss (ex.: 75 -> "1:15").
function formatarDuracao(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Rótulo da prévia de mídia na lista de conversas (estilo WhatsApp).
function rotuloMidia(tipo) {
  if (tipo === "imagem") return "📷 Foto";
  if (tipo === "audio") return "🎤 Mensagem de voz";
  if (tipo === "video") return "🎬 Vídeo";
  if (tipo === "documento") return "📄 Documento";
  return "";
}

// Hash curto e estável de um texto (para gerar um id único e repetível na
// importação de .txt — assim reimportar o mesmo arquivo não duplica).
function hashCurto(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Lê um .zip exportado do WhatsApp direto no navegador (sem biblioteca
// externa: usa o DecompressionStream nativo). Devolve os arquivos .txt de
// dentro como { nome, texto }. Assim o Rodrigo sobe o .zip sem precisar
// extrair antes.
async function lerTxtsDoZip(file) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("navegador sem suporte a zip");
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // Acha o "End of Central Directory" (assinatura 0x06054b50), varrendo do fim.
  let eocd = -1;
  const minimo = Math.max(0, buf.length - 22 - 65536);
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip inválido");
  const total = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true); // início do diretório central
  const dec = new TextDecoder("utf-8");
  const saida = [];
  for (let n = 0; n < total && off + 46 <= buf.length; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break; // assinatura do diretório
    const metodo = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nomeLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const comLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const nome = dec.decode(buf.subarray(off + 46, off + 46 + nomeLen));
    off += 46 + nomeLen + extraLen + comLen;
    if (!/\.txt$/i.test(nome)) continue; // só interessa o texto da conversa
    if (dv.getUint32(localOff, true) !== 0x04034b50) continue; // cabeçalho local
    const lNomeLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataIni = localOff + 30 + lNomeLen + lExtraLen;
    const comp = buf.subarray(dataIni, dataIni + compSize);
    let bytes;
    if (metodo === 0) {
      bytes = comp; // guardado sem compressão
    } else if (metodo === 8) {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([comp]).stream().pipeThrough(ds);
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      continue; // método de compressão não suportado
    }
    saida.push({ nome: nome.split("/").pop(), texto: dec.decode(bytes) });
  }
  return saida;
}

// Troca os "marcadores de mídia" da exportação do WhatsApp por um rótulo
// legível (a exportação em .txt normalmente NÃO inclui o arquivo).
function rotularMidiaExport(texto) {
  const s = (texto || "").toLowerCase();
  if (/imagem ocultada|image omitted|\.jpg|\.jpeg|\.png|\.webp/.test(s)) return "📷 Foto (mídia não incluída na exportação)";
  if (/áudio ocultado|audio ocultado|audio omitted|\.opus|ptt-/.test(s)) return "🎤 Áudio (mídia não incluída na exportação)";
  if (/vídeo ocultado|video ocultado|video omitted|\.mp4/.test(s)) return "🎬 Vídeo (mídia não incluída na exportação)";
  if (/documento ocultado|document omitted|\.pdf|\.docx?|\.xlsx?/.test(s)) return "📄 Documento (mídia não incluído na exportação)";
  if (/figurinha|sticker omitted/.test(s)) return "🩹 Figurinha (não incluída na exportação)";
  if (/gif omitido|gif omitted/.test(s)) return "🎞️ GIF (não incluído na exportação)";
  if (/mídia oculta|media omitted|arquivo anexado|file attached/.test(s)) return "📎 Mídia (não incluída na exportação)";
  return null;
}

// Lê o texto de uma conversa exportada do WhatsApp (.txt) e devolve as
// mensagens { data, autor, texto }. Suporta os formatos Android e iPhone,
// datas pt-BR, mensagens de várias linhas e marcadores de mídia.
function parseWhatsAppTxt(conteudo) {
  const linhas = conteudo.split(/\r?\n/);
  // Android: 12/03/2024 14:05 - Nome: msg   |   iPhone: [12/03/2024, 14:05:07] Nome: msg
  const reAndroid = /^‎?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?)?\s*-\s*(.*)$/;
  const reIOS = /^‎?\s*\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?)?\]\s*(.*)$/;
  const out = [];
  let atual = null;
  const fechar = () => { if (atual) { out.push(atual); atual = null; } };
  for (const linha of linhas) {
    const m = reAndroid.exec(linha) || reIOS.exec(linha);
    if (m) {
      fechar();
      const dd = +m[1], MM = +m[2]; let ano = +m[3];
      if (ano < 100) ano += 2000;
      let hora = +m[4]; const min = +m[5], seg = +(m[6] || 0);
      if (m[7]) { const pm = /p/i.test(m[7]); if (pm && hora < 12) hora += 12; if (!pm && hora === 12) hora = 0; }
      const data = new Date(ano, MM - 1, dd, hora, min, seg);
      const resto = m[8] || "";
      const idx = resto.indexOf(": ");
      if (idx === -1) { atual = null; continue; } // linha de sistema (ex.: aviso de criptografia)
      atual = { data, autor: resto.slice(0, idx).trim(), texto: resto.slice(idx + 2) };
    } else if (atual) {
      atual.texto += "\n" + linha; // continuação de mensagem de várias linhas
    }
  }
  fechar();
  return out.filter((m) => !isNaN(m.data.getTime()));
}

// Reconhece se um arquivo exportado é de um GRUPO, pelas "linhas de sistema"
// que só aparecem em grupos (criar/renomear grupo, entrar/sair, adicionar).
// (Contar autores não serve: um grupo pode ter só 2 pessoas ativas.)
function pareceGrupo(conteudo) {
  return /criou (este |o )?grupo|mudou o nome do grupo|saiu do grupo|entrou usando o link|convite do grupo|adicionou você|removeu você|created (this )?group|changed the subject|group's invite link|left the group|added you to the group|removed you/i.test(conteudo || "");
}

// Descobre o NOME do grupo a partir do conteúdo do arquivo (quando o nome do
// arquivo não traz). Usa a linha "mudou o nome do grupo … para «X»" (fica com o
// último = nome atual) ou "criou o grupo «X»". Vale PT e EN.
function nomeDoGrupo(conteudo) {
  const linhas = (conteudo || "").split(/\r?\n/);
  const limpar = (s) => (s || "").replace(/^[\s"'“”«»]+|[\s"'“”«»]+$/g, "").trim();
  let nome = "";
  for (const ln of linhas) {
    const m = /mudou o nome do grupo .*?\bpara\b\s*(.+)$/i.exec(ln) ||
              /changed the (?:subject|group name) to\s*(.+)$/i.exec(ln);
    if (m) nome = limpar(m[1]); // fica com o ÚLTIMO (nome atual do grupo)
  }
  if (nome) return nome;
  for (const ln of linhas) {
    const m = /criou o grupo\s*(.+)$/i.exec(ln) || /created (?:the )?group\s*(.+)$/i.exec(ln);
    if (m) { const c = limpar(m[1]); if (c) return c; }
  }
  return "";
}

// Emojis mais usados no atendimento (picker do ícone de carinha).
const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😘","😅","😉","🙂",
  "🙏","👍","👎","👏","🙌","🤝","💪","🔥","✅","❌",
  "⚠️","📌","📎","📄","📅","⏰","💰","⚖️","📞","✉️",
  "❤️","🎉","👋","🤔","😐","😢","😡","🥳","💯","👌",
];

// Converte o texto da mensagem em elementos: aplica *negrito*, _itálico_,
// ~tachado~, `mono` e transforma links em algo clicável (estilo WhatsApp).
const RE_URL = /(https?:\/\/[^\s]+)/g;
function aplicarEnfase(txt, base) {
  const re = /([*_~`])([^*_~`\n]+)\1/;
  const out = [];
  let resto = txt, k = 0, m;
  while ((m = re.exec(resto))) {
    if (m.index > 0) out.push(resto.slice(0, m.index));
    const key = base + "e" + k++;
    const [full, marca, conteudo] = m;
    if (marca === "*") out.push(<strong key={key}>{conteudo}</strong>);
    else if (marca === "_") out.push(<em key={key}>{conteudo}</em>);
    else if (marca === "~") out.push(<s key={key}>{conteudo}</s>);
    else out.push(<code key={key} style={{ fontFamily: "monospace", fontSize: "0.92em" }}>{conteudo}</code>);
    resto = resto.slice(m.index + full.length);
  }
  if (resto) out.push(resto);
  return out;
}
function formatarTexto(texto, corLink = "#53bdeb") {
  if (!texto) return null;
  const partes = [];
  let last = 0, i = 0, m;
  RE_URL.lastIndex = 0;
  while ((m = RE_URL.exec(texto))) {
    if (m.index > last) partes.push(...aplicarEnfase(texto.slice(last, m.index), "t" + i++));
    const url = m[0];
    partes.push(
      <a key={"u" + i++} href={url} target="_blank" rel="noopener noreferrer" style={{ color: corLink, textDecoration: "underline" }}>{url}</a>
    );
    last = m.index + url.length;
  }
  if (last < texto.length) partes.push(...aplicarEnfase(texto.slice(last), "t" + i++));
  return partes;
}

// Som curto ao chegar mensagem nova (sem precisar de arquivo de áudio).
// Reusa um único AudioContext (não cria um novo a cada beep).
let _audioCtx = null;
function tocarBeep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!_audioCtx) _audioCtx = new AC();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch (_) { /* silêncio se o navegador bloquear */ }
}

// Notificação na área de trabalho (se o atendente autorizou).
function notificarDesktop(titulo, corpo) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(titulo, { body: corpo, tag: "zorvin" });
    }
  } catch (_) { /* ignora */ }
}

// AS INICIAIS DO CÍRCULO.
//
// Era `nome.charAt(0)` — e num escritório de advocacia isso significava uma
// barra lateral inteira de círculos com a letra "D", porque todo advogado é
// "Dr." ou "Dra.". Aquela barra existe justamente para distinguir um telefone
// do outro, e estava dizendo a mesma coisa em todos eles.
//
// Duas letras, pulando o tratamento e as partículas: "Dra. Beatriz Aguiar"
// vira BA e "Antônio Ribeiro dos Santos Filho" vira AR. Quem não tem nome
// (só o número) continua com o primeiro caractere, que é o que existe.
const TRATAMENTOS = /^(dr|dra|sr|sra|srta|prof|profa|exmo|exma|adv)\.?$/i;
const PARTICULAS = /^(de|da|do|das|dos|e|di|del|van|von|la|le)$/i;
function iniciaisDe(nome) {
  const cru = String(nome || "").trim();
  if (!cru) return "?";
  const palavras = cru.split(/\s+/).filter((p) => /\p{L}/u.test(p) && !TRATAMENTOS.test(p));
  const nucleo = palavras.filter((p) => !PARTICULAS.test(p));
  if (!nucleo.length) return cru.charAt(0).toUpperCase();
  return (nucleo[0].charAt(0) + (nucleo[1] ? nucleo[1].charAt(0) : "")).toUpperCase();
}

function Avatar({ nome, size = 40, foto }) {
  const inicial = iniciaisDe(nome);
  const [erroFoto, setErroFoto] = useState(false);
  // Se a foto mudar, tenta de novo (limpa erro anterior).
  useEffect(() => { setErroFoto(false); }, [foto]);
  // Se houver foto cadastrada e ela carregar, mostra a foto;
  // senão (sem foto ou falha ao carregar), a inicial colorida.
  if (foto && !erroFoto) {
    return (
      <img
        src={foto}
        alt={nome || ""}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: corDe(nome) }}
        onError={() => setErroFoto(true)}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: corDe(nome), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: size * (inicial.length > 1 ? 0.36 : 0.42), letterSpacing: inicial.length > 1 ? "-.02em" : 0, flexShrink: 0 }}>
      {inicial}
    </div>
  );
}

function BolhaAudio({ C, saida, url }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {url ? (
        <audio controls src={url} style={{ height: 32, maxWidth: "min(220px, 100%)", minWidth: 0 }} />
      ) : (
        <>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.searchBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Mic size={16} color={C.textSecondary} />
          </div>
          <span style={{ fontSize: 12, color: C.textSecondary, fontStyle: "italic" }}>Áudio indisponível</span>
        </>
      )}
    </div>
  );
}

// Padrão sutil de "papel de parede" do chat (pontinhos discretos), como o WhatsApp.
const PADRAO_CHAT_CLARO = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg fill='%23000000' fill-opacity='0.022'%3E%3Ccircle cx='8' cy='8' r='2.5'/%3E%3Ccircle cx='36' cy='22' r='2.5'/%3E%3Ccircle cx='18' cy='44' r='2.5'/%3E%3Ccircle cx='48' cy='50' r='2.5'/%3E%3C/g%3E%3C/svg%3E\")";
const PADRAO_CHAT_ESCURO = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg fill='%23ffffff' fill-opacity='0.025'%3E%3Ccircle cx='8' cy='8' r='2.5'/%3E%3Ccircle cx='36' cy='22' r='2.5'/%3E%3Ccircle cx='18' cy='44' r='2.5'/%3E%3Ccircle cx='48' cy='50' r='2.5'/%3E%3C/g%3E%3C/svg%3E\")";

export default function Painel({ sessao }) {
  // Tema começa pelo que foi salvo da última vez (claro/escuro).
  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem("zorvin_modo") || "claro"; } catch (_) { return "claro"; }
  });
  useEffect(() => {
    try { localStorage.setItem("zorvin_modo", modo); } catch (_) { /* ignora */ }
  }, [modo]);
  const [advogados, setAdvogados] = useState([]);
  // Os departamentos saem do BANCO, não de uma lista escrita aqui: é isso que
  // permite criar um departamento novo sem mexer em código.
  const [departamentos, setDepartamentos] = useState([]);
  // As permissões desta pessoa, para a tela oferecer só o que ela pode usar.
  const [minhasPermissoes, setMinhasPermissoes] = useState([]);
  const [erroPermissoes, setErroPermissoes] = useState("");
  const [departamentoId, setDepartamentoId] = useState(null);
  const [souAdmin, setSouAdmin] = useState(false);
  const [telaAdmin, setTelaAdmin] = useState(false);
  // A janela de juntar duas conversas (só admin). `de` é a que SOME; `para` é a
  // que fica com tudo.
  const [juntar, setJuntar] = useState(null);   // null | {de, para, indo}
  const [advogadoId, setAdvogadoId] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [conversaId, setConversaId] = useState(null);
  // Ficha do cliente no Vantoro (abre ao lado da conversa).
  const [fichaAberta, setFichaAberta] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false); // exibindo a lista de arquivadas
  const [contatosLista, setContatosLista] = useState([]); // todos os contatos (agenda)
  const [buscaContato, setBuscaContato] = useState(""); // busca na agenda de contatos
  const [contatoForm, setContatoForm] = useState(null); // { nome, numero } ao criar um contato
  const [novaConversaAberta, setNovaConversaAberta] = useState(false); // tela "Nova conversa" (⊞)
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [atendimentos, setAtendimentos] = useState({}); // { conversaId: { por, em } }
  const [ultimasMidias, setUltimasMidias] = useState({}); // { conversaId: tipo } da última mensagem, se mídia
  const [digitandos, setDigitandos] = useState({}); // { conversaId: digitando_ate (ISO) }
  const [naoLidasPorAdv, setNaoLidasPorAdv] = useState({}); // { advogadoId: total de não lidas }
  const [tique, setTique] = useState(0); // força re-render p/ esconder "digitando…" ao expirar
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const conversaIdRef = useRef(null);
  useEffect(() => { conversaIdRef.current = conversaId; }, [conversaId]);
  // Mesmo papel do `conversaIdRef`, para o telefone: quem responde atrasado
  // confere aqui se ainda é o telefone aberto antes de mexer na tela.
  const advogadoIdRef = useRef(null);
  useEffect(() => { advogadoIdRef.current = advogadoId; }, [advogadoId]);
  const conversasRef = useRef([]);
  useEffect(() => { conversasRef.current = conversas; }, [conversas]);
  // O que está escrito na caixa AGORA, para o efeito de troca de conversa
  // conseguir guardar antes de trocar.
  const rascunhoRef = useRef("");
  const modoNotaRef = useRef(false);
  // O que ficou escrito em cada conversa: { [conversaId]: { texto, nota } }.
  const rascunhosRef = useRef({});
  const conversaAnteriorRef = useRef(null);
  const listaRef = useRef(null);
  const fileRef = useRef(null);
  const [pertoDoFim, setPertoDoFim] = useState(true);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const [buscaConversa, setBuscaConversa] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [respondendo, setRespondendo] = useState(null); // { id_uazapi, previa, autor }
  const [gravando, setGravando] = useState(false);
  const [gravacaoPausada, setGravacaoPausada] = useState(false); // gravação em pausa
  const [audioPronto, setAudioPronto] = useState(null); // { file, url, convId } aguardando prévia/envio
  const [tempoGravacao, setTempoGravacao] = useState(0); // segundos gravados
  const [imagemAberta, setImagemAberta] = useState(null); // URL da imagem em tela cheia
  const [aviso, setAviso] = useState(null); // toast discreto (texto)
  const [anexoPendente, setAnexoPendente] = useState(null); // { file, url, tipo } aguardando legenda
  const [legendaAnexo, setLegendaAnexo] = useState("");
  const [buscaIdx, setBuscaIdx] = useState(0); // ocorrência atual na busca da conversa
  const [idDivisorNaoLidas, setIdDivisorNaoLidas] = useState(null); // id da 1ª msg não lida ao abrir
  const [temMaisAntigas, setTemMaisAntigas] = useState(false); // há histórico acima do que está na tela
  const [buscandoAntigas, setBuscandoAntigas] = useState(false);
  const [infoAberta, setInfoAberta] = useState(false); // painel de dados do contato
  const [importando, setImportando] = useState(false); // gravando no banco
  const [impAdvId, setImpAdvId] = useState(""); // advogado dono das conversas importadas
  const [impMeuNome, setImpMeuNome] = useState(""); // nome do advogado como aparece nos .txt
  const [impArquivos, setImpArquivos] = useState([]); // [{ nome, msgs, autores, numero }]
  const [impProgresso, setImpProgresso] = useState(""); // texto de progresso da importação
  const [impArrastando, setImpArrastando] = useState(false); // arquivo sendo arrastado sobre a área
  const [msgHover, setMsgHover] = useState(null); // id da bolha sob o mouse (mostra "responder")
  const [convHover, setConvHover] = useState(null); // id da conversa sob o mouse (realce)
  const [menuConversa, setMenuConversa] = useState(null); // id da conversa com o menuzinho aberto
  const [modoNota, setModoNota] = useState(false); // caixa de texto no modo "nota interna"
  const [rapidas, setRapidas] = useState([]); // mensagens rápidas (respostas prontas) da equipe
  const [slashIdx, setSlashIdx] = useState(0); // item destacado no menu do "/"
  const [configAberta, setConfigAberta] = useState(false); // tela de Configurações aberta
  const [abaConfig, setAbaConfig] = useState("perfil"); // perfil | aparencia | rapidas
  const [cfgNome, setCfgNome] = useState(""); // rascunho do nome no perfil
  const [rapidaForm, setRapidaForm] = useState(null); // { id?, titulo, texto } sendo criada/editada
  const [tags, setTags] = useState([]); // definições das tags (id, nome, cor)
  const [tagsPorConversa, setTagsPorConversa] = useState({}); // { conversaId: [tagId,...] }
  const [filtro, setFiltro] = useState("tudo"); // aba/filtro da lista: 'tudo' | 'naolidas' | 'favoritas' | 'tag:<id>' | 'frente:<FRENTE>'
  const [tagForm, setTagForm] = useState(null); // { id?, nome, cor } sendo criada/editada
  const [tagMenuAberto, setTagMenuAberto] = useState(false); // menu de aplicar tags na conversa aberta
  const [menuTopoAberto, setMenuTopoAberto] = useState(false); // menu ⋮ do topo da lista
  const [menuEtiquetas, setMenuEtiquetas] = useState(false); // lista de etiquetas para filtrar
  const [largura, setLargura] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1200));
  const gravadorRef = useRef(null);
  const chunksRef = useRef([]);
  const naoLidasRef = useRef(0);
  const avisoTimerRef = useRef(null);
  const timerRef = useRef(null);
  const emojiRef = useRef(null);
  const seletorRef = useRef(null);
  const fotoPerfilRef = useRef(null); // input de arquivo para a foto do perfil
  const tagMenuRef = useRef(null); // menu de aplicar tags (fecha ao clicar fora)
  const txtRef = useRef(null); // input de arquivo .txt (importar histórico)
  const menuTopoRef = useRef(null);
  const etiquetasRef = useRef(null); // menu ⋮ do topo (fecha ao clicar fora)

  const C = TEMAS[modo];
  const estreito = largura < 768; // layout de celular: mostra lista OU conversa
  const advogado = advogados.find((a) => a.id === advogadoId) || null;
  const conversa = conversas.find((c) => c.id === conversaId) || null;
  // Nome e foto do atendente logado (guardados no perfil do Supabase Auth).
  const meuNome =
    sessao?.user?.user_metadata?.nome ||
    sessao?.user?.user_metadata?.name ||
    sessao?.user?.user_metadata?.full_name ||
    (sessao?.user?.email || "").split("@")[0] ||
    "atendente";
  const minhaFoto = sessao?.user?.user_metadata?.foto_url || null;
  // Quem administra: sai da tabela `usuarios` (espelho do Vantoro), e não mais
  // de um metadado escrito à mão no Supabase. Quem é superusuário no Vantoro
  // administra aqui — uma lista de gente, não duas. Está em `souAdmin`.
  // Telefones que aparecem AGORA (do departamento selecionado).
  // Os telefones que esta pessoa PODE usar — e é desta lista que sai tudo o que
  // a tela oferece. Ver `filtrarPermitidos`.
  const advogadosPermitidos = filtrarPermitidos(advogados, minhasPermissoes, souAdmin, erroPermissoes);
  const advogadosVisiveis = advogadosPermitidos.filter((a) => a.departamento_id === departamentoId);
  // Só entram os departamentos onde esta pessoa tem ALGUM telefone permitido.
  // Mostrar um departamento que abre vazio é pior do que não mostrar — e, antes,
  // era pior ainda: parecia acesso que ela não tinha.
  const departamentosVisiveis = departamentos.filter(
    (d) => advogadosPermitidos.some((a) => a.departamento_id === d.id));

  // O contato está digitando nesta conversa agora? (janela curta que expira).
  function digitandoAtivo(convId) {
    void tique; // re-avalia a cada "tique"
    const ate = digitandos[convId];
    return !!ate && new Date(ate).getTime() > Date.now();
  }

  // Quem (além de mim) está atendendo uma conversa agora. Considera "ativo"
  // apenas nos últimos 3 minutos, para não travar conversa que alguém abriu e saiu.
  function atendidoPorOutro(convId) {
    const a = atendimentos[convId];
    if (!a || !a.por || a.por === meuNome) return null;
    if (a.em && Date.now() - new Date(a.em).getTime() > 3 * 60 * 1000) return null;
    return a.por;
  }

  // ---- Carrega telefones e departamentos (uma vez) ----
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [tel, dep, eu, perm] = await Promise.all([
        supabase.from("advogados").select("id, nome, numero, foto_url, departamento_id")
          .eq("ativo", true).order("nome"),
        supabase.from("departamentos").select("id, nome, slug, cor, ordem")
          .eq("ativo", true).order("ordem"),
        supabase.from("usuarios").select("admin").eq("id", sessao?.user?.id || "").maybeSingle(),
        // AS MINHAS permissões. O banco só deixa cada pessoa ler as próprias
        // (`permissoes_leitura`), então isto não conta a ninguém o que os
        // outros alcançam.
        supabase.from("permissoes").select("departamento_id, telefone_id")
          .eq("usuario_id", sessao?.user?.id || ""),
      ]);
      if (!vivo) return;
      const ehAdmin = Boolean(eu.data && eu.data.admin);
      setAdvogados(tel.data || []);
      setDepartamentos(dep.data || []);
      setSouAdmin(ehAdmin);
      setMinhasPermissoes(perm.data || []);
      setErroPermissoes(perm.error ? perm.error.message : "");

      const lista = filtrarPermitidos(tel.data || [], perm.data || [], ehAdmin, perm.error);
      if (lista.length) {
        // Mantém o telefone que estava selecionado antes de atualizar a página.
        let salvo = null;
        try { salvo = localStorage.getItem("zorvin_advogado"); } catch (_) { /* ignora */ }
        const advSalvo = salvo && lista.find((a) => a.id === salvo);
        const escolhido = advSalvo || lista[0];
        setDepartamentoId(escolhido.departamento_id || null);
        setAdvogadoId(escolhido.id);
      }
    })();
    return () => { vivo = false; };
  }, [sessao?.user?.id]);

  // Salva o advogado selecionado para reabrir nele após atualizar a página.
  useEffect(() => {
    if (!advogadoId) return;
    try { localStorage.setItem("zorvin_advogado", advogadoId); } catch (_) { /* ignora */ }
  }, [advogadoId]);

  // ---- Carrega "quem está atendendo" cada conversa (recurso opcional) ----
  const carregarAtendimentos = useCallback(async (advId) => {
    if (!advId || !RECURSOS.atendendo) return;
    const { data, error } = await supabase
      .from("conversas")
      .select("id, atendendo_por, atendendo_em")
      .eq("advogado_id", advId);
    if (error) { desligarRecurso("atendendo", error); return; }
    const mapa = {};
    (data || []).forEach((r) => {
      if (r.atendendo_por) mapa[r.id] = { por: r.atendendo_por, em: r.atendendo_em };
    });
    setAtendimentos(mapa);
  }, []);

  // ---- Carrega "quem está digitando" (recurso opcional, protegido) ----
  const carregarDigitando = useCallback(async (advId) => {
    if (!advId || !RECURSOS.digitando) return;
    const { data, error } = await supabase
      .from("conversas")
      .select("id, digitando_ate")
      .eq("advogado_id", advId);
    if (error) { desligarRecurso("digitando", error); return; }
    const mapa = {};
    // Só o que ainda VALE. Guardando o vencido, o mapa nunca esvaziava e o
    // relógio de 2 segundos passava a re-renderizar o painel inteiro para
    // sempre — a cada 2s, o dia todo, por causa de um "digitando…" que já
    // tinha expirado horas antes.
    const agora = Date.now();
    (data || []).forEach((r) => {
      if (r.digitando_ate && new Date(r.digitando_ate).getTime() > agora) mapa[r.id] = r.digitando_ate;
    });
    setDigitandos(mapa);
  }, []);

  // ---- Descobre o TIPO da última mensagem de cada conversa (para a prévia) ----
  // Assim a lista mostra "📷 Foto", "🎤 Mensagem de voz" etc. em vez de "[anexo]".
  const carregarUltimasMidias = useCallback(async (advId) => {
    if (!advId) return;
    try {
      const { data, error } = await supabase
        .from("conversas")
        .select("id, mensagens(tipo, criado_em)")
        .eq("advogado_id", advId)
        .order("criado_em", { referencedTable: "mensagens", ascending: false })
        .limit(1, { referencedTable: "mensagens" });
      if (error) return;
      const mapa = {};
      (data || []).forEach((c) => {
        const ult = c.mensagens && c.mensagens[0];
        if (ult && ult.tipo && ult.tipo !== "texto") mapa[c.id] = ult.tipo;
      });
      setUltimasMidias(mapa);
    } catch (_) { /* ignora: mantém a prévia padrão */ }
  }, []);

  // ---- Carrega as conversas do advogado selecionado ----
  const carregarConversas = useCallback(async (advId) => {
    if (!advId) return;
    const buscar = () => supabase
      .from("conversas")
      .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
      .eq("advogado_id", advId)
      .order("ultima_atividade", { ascending: false });
    let { data, error } = await buscar();
    // Base sem o SQL das frentes: tira `vantoro_nome` do pedido e repete. Uma
    // vez só — depois disso a coluna já não é pedida.
    if (error && TEM_NOME_DO_CADASTRO && faltaColuna(error)) {
      TEM_NOME_DO_CADASTRO = false;
      ({ data, error } = await buscar());
    }
    // Queda de rede não pode esvaziar a lista: sem resposta, fica o que já
    // estava na tela em vez de "Nenhuma conversa ainda".
    if (error) return;
    // Troquei de telefone enquanto esta resposta vinha? Ela é de outro telefone
    // agora: descarta. Sem isto, clicar rápido em dois telefones deixava a
    // lista do PRIMEIRO na tela do segundo (a resposta lenta chega por último
    // e sobrescreve), e o atendente atendia a conversa errada.
    if (advogadoIdRef.current !== advId) return;
    // As FIXADAS sobem, e entre elas continua valendo a ordem de sempre. A
    // ordenação é feita aqui e não no banco porque a coluna pode ainda não
    // existir: pedi-la no `order` faria a consulta inteira falhar, e a lista de
    // conversas sumiria por causa de um recurso que nem foi instalado.
    const porFixada = (a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0);
    // A conversa aberta mantém o contador dela: abrir não é responder.
    const lista = (data || []).slice().sort(porFixada);
    setConversas(lista);
    carregarAtendimentos(advId);
    carregarUltimasMidias(advId);
    carregarDigitando(advId);
  }, [carregarAtendimentos, carregarUltimasMidias, carregarDigitando]);

  useEffect(() => { carregarConversas(advogadoId); }, [advogadoId, carregarConversas]);

  // ---- Total de não lidas de CADA advogado (para o selo na barra lateral) ----
  // Busca todas as conversas com não lidas e soma por advogado.
  const carregarNaoLidasPorAdv = useCallback(async () => {
    const { data, error } = await supabase
      .from("conversas")
      .select("advogado_id, nao_lidas")
      .gt("nao_lidas", 0);
    if (error) return;
    const mapa = {};
    (data || []).forEach((r) => {
      mapa[r.advogado_id] = (mapa[r.advogado_id] || 0) + (r.nao_lidas || 0);
    });
    setNaoLidasPorAdv(mapa);
  }, []);

  useEffect(() => { carregarNaoLidasPorAdv(); }, [carregarNaoLidasPorAdv]);

  // ---- Mensagens rápidas (respostas prontas, compartilhadas pela equipe) ----
  const carregarRapidas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("mensagens_rapidas")
        .select("*")
        .order("titulo", { ascending: true });
      if (!error) setRapidas(data || []);
    } catch (_) { /* tabela ainda não criada: fica sem rápidas */ }
  }, []);

  useEffect(() => { carregarRapidas(); }, [carregarRapidas]);

  // ---- Tags (etiquetas coloridas das conversas, compartilhadas) ----
  const carregarTags = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("tags").select("*").order("nome", { ascending: true });
      if (!error) setTags(data || []);
    } catch (_) { /* tabela ainda não criada */ }
  }, []);

  const carregarTagsConversas = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("conversa_tags").select("conversa_id, tag_id");
      if (error) return;
      const mapa = {};
      (data || []).forEach((r) => { (mapa[r.conversa_id] = mapa[r.conversa_id] || []).push(r.tag_id); });
      setTagsPorConversa(mapa);
    } catch (_) { /* tabela ainda não criada */ }
  }, []);

  useEffect(() => { carregarTags(); carregarTagsConversas(); }, [carregarTags, carregarTagsConversas]);

  async function salvarTagForm() {
    const nome = (tagForm?.nome || "").trim();
    const cor = tagForm?.cor || CORES_TAG[0];
    if (!nome) { mostrarAviso("Digite o nome da tag."); return; }
    let error;
    if (tagForm.id) {
      ({ error } = await supabase.from("tags").update({ nome, cor }).eq("id", tagForm.id));
    } else {
      ({ error } = await supabase.from("tags").insert({ nome, cor }));
    }
    if (error) { mostrarAviso("Não consegui salvar. Verifique se a tabela 'tags' foi criada."); return; }
    setTagForm(null); carregarTags(); mostrarAviso("Tag salva!");
  }

  async function apagarTag(id) {
    if (!window.confirm("Apagar esta tag? Ela sai de todas as conversas.")) return;
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) { mostrarAviso("Não consegui apagar a tag."); return; }
    carregarTags(); carregarTagsConversas();
  }

  // Marca/desmarca uma tag na conversa aberta (otimista + banco).
  async function alternarTagConversa(tagId) {
    if (!conversaId) return;
    const atuais = tagsPorConversa[conversaId] || [];
    const tem = atuais.includes(tagId);
    setTagsPorConversa((prev) => {
      const lista = new Set(prev[conversaId] || []);
      if (tem) lista.delete(tagId); else lista.add(tagId);
      return { ...prev, [conversaId]: [...lista] };
    });
    if (tem) {
      await supabase.from("conversa_tags").delete().eq("conversa_id", conversaId).eq("tag_id", tagId);
    } else {
      const { error } = await supabase.from("conversa_tags").insert({ conversa_id: conversaId, tag_id: tagId });
      if (error) { mostrarAviso("Não consegui aplicar a tag."); carregarTagsConversas(); }
    }
  }

  // Cria (sem id) ou atualiza (com id) uma mensagem rápida, pela tela de Configurações.
  async function salvarRapidaForm() {
    const titulo = (rapidaForm?.titulo || "").trim();
    const texto = (rapidaForm?.texto || "").trim();
    if (!titulo || !texto) { mostrarAviso("Preencha o atalho e o texto."); return; }
    let error;
    if (rapidaForm.id) {
      ({ error } = await supabase.from("mensagens_rapidas").update({ titulo, texto }).eq("id", rapidaForm.id));
    } else {
      ({ error } = await supabase.from("mensagens_rapidas").insert({ titulo, texto }));
    }
    if (error) { mostrarAviso("Não consegui salvar. Verifique se a tabela 'mensagens_rapidas' foi criada."); return; }
    setRapidaForm(null);
    mostrarAviso("Mensagem rápida salva!");
    carregarRapidas();
  }

  async function apagarRapida(id) {
    if (!window.confirm("Apagar esta mensagem rápida?")) return;
    const { error } = await supabase.from("mensagens_rapidas").delete().eq("id", id);
    if (error) { mostrarAviso("Não consegui apagar."); return; }
    carregarRapidas();
  }

  // Escolhe uma rápida pelo menu do "/": substitui o texto digitado pela mensagem.
  function escolherSlash(r) {
    if (!r) return;
    setRascunho(r.texto);
    setSlashIdx(0);
    inputRef.current?.focus();
  }

  // ---- Perfil do atendente (nome e foto ficam no Supabase Auth) ----
  async function salvarNomePerfil() {
    const nome = cfgNome.trim();
    if (!nome) { mostrarAviso("Digite seu nome."); return; }
    const meta = sessao?.user?.user_metadata || {};
    const { error } = await supabase.auth.updateUser({ data: { ...meta, nome } });
    if (error) { mostrarAviso("Não consegui salvar o nome."); return; }
    mostrarAviso("Nome atualizado!");
  }

  async function trocarFotoPerfil(file) {
    if (!file) return;
    try {
      const ext = ((file.name || "").split(".").pop() || "jpg").toLowerCase();
      const caminho = `perfil/${sessao.user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("anexos").upload(caminho, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("anexos").getPublicUrl(caminho);
      const url = pub?.publicUrl;
      if (!url) throw new Error("sem URL");
      const meta = sessao?.user?.user_metadata || {};
      const { error } = await supabase.auth.updateUser({ data: { ...meta, foto_url: url } });
      if (error) throw error;
      mostrarAviso("Foto atualizada!");
    } catch (_) {
      mostrarAviso("Não consegui atualizar a foto.");
    }
  }

  // Abre a tela de Configurações já com o nome atual no campo.
  function abrirConfig() {
    setCfgNome(meuNome);
    setAbaConfig("perfil");
    setRapidaForm(null);
    setTagForm(null);
    setContatoForm(null);
    setConfigAberta(true);
  }

  // ---- Agenda de contatos (ver todos / criar novo) ----
  const carregarContatos = useCallback(async () => {
    try {
      const buscar = () => supabase.from("contatos")
        .select(colunasDoContato("id, nome, numero, foto_url"))
        .order("nome", { ascending: true });
      let { data, error } = await buscar();
      // `faltaColuna` junto: sem ele, uma queda de rede era lida como "a coluna
      // não existe" e o nome do cadastro do Vantoro ficava desligado pelo resto
      // da sessão, para todas as telas — por causa de um 4G que oscilou.
      // É a mesma guarda que `carregarConversas` já usava.
      if (error && TEM_NOME_DO_CADASTRO && faltaColuna(error)) {
        TEM_NOME_DO_CADASTRO = false;
        ({ data, error } = await buscar());
      }
      // Grupos (numero "grupo:...") não entram na agenda de contatos — não são
      // números para iniciar conversa; aparecem só na lista de conversas.
      if (!error) setContatosLista((data || []).filter((c) => !String(c.numero || "").startsWith("grupo:")));
    } catch (_) { /* ignora */ }
  }, []);

  useEffect(() => { carregarContatos(); }, [carregarContatos]);

  // O NÚMERO COMO O WHATSAPP O ESCREVE — sempre com o código do país.
  //
  // Era este o defeito que duplicava conversa. Quem cadastrava um contato aqui
  // digitava "(11) 95670-6171" e o painel gravava "11956706171", sem o 55.
  // Nós mandávamos a primeira mensagem e ela ia normalmente. Mas, quando a
  // pessoa respondia, o WhatsApp devolvia o MESMO telefone escrito do jeito
  // dele — "5511956706171" — e a ponte, não achando ninguém com esse texto,
  // criava um segundo contato e uma segunda conversa. A resposta aparecia numa
  // conversa nova, ao lado da que nós tínhamos começado.
  //
  // O 55 entra só quando o número tem cara de brasileiro (10 ou 11 dígitos: o
  // DDD mais o telefone). Número que já vem com código de país, ou estrangeiro,
  // passa intacto — o WhatsApp do escritório fala com o mundo todo, e prefixar
  // 55 num número de Portugal criaria justamente o problema que se quer evitar.
  function numeroCanonico(bruto) {
    const d = String(bruto || "").replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) return "55" + d;
    return d;
  }

  async function salvarContato() {
    const nome = (contatoForm?.nome || "").trim();
    const numero = numeroCanonico(contatoForm?.numero);
    if (!nome) { mostrarAviso("Digite o nome do contato."); return; }
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const { error } = await supabase.from("contatos").upsert({ numero, nome }, { onConflict: "numero" });
    if (error) { mostrarAviso("Não consegui salvar. Verifique as permissões (RLS) da tabela 'contatos'."); return; }
    setContatoForm(null);
    mostrarAviso("Contato salvo!");
    carregarContatos();
  }

  // Abre (ou cria) a conversa do advogado atual com este contato.
  async function abrirConversaContato(cont) {
    if (!advogadoId) { mostrarAviso("Escolha um advogado na barra lateral primeiro."); return; }
    const { data: conv, error } = await supabase.from("conversas")
      .upsert({ advogado_id: advogadoId, contato_id: cont.id }, { onConflict: "advogado_id,contato_id" })
      .select("id").single();
    if (error || !conv) {
      // A causa quase sempre é a mesma, e é uma só: falta a política de INSERÇÃO
      // em `conversas` no Supabase (o banco recusa a linha nova em silêncio).
      // Dizer isso poupa a hora de procura que este erro custou.
      mostrarAviso("Não consegui abrir a conversa. Se isto acontece com TODO contato novo, "
                 + "falta rodar o SQL 2026-07-abrir-conversa.sql no Supabase.");
      return;
    }
    setConfigAberta(false);
    setNovaConversaAberta(false);
    setContatoForm(null);
    setBuscaContato("");
    setVerArquivadas(false);
    await carregarConversas(advogadoId);
    setConversaId(conv.id);
  }

  // "Novo contato" dentro da Nova conversa: cria e já abre a conversa.
  async function criarContatoEConversar() {
    const nome = (contatoForm?.nome || "").trim();
    const numero = numeroCanonico(contatoForm?.numero);
    if (!nome) { mostrarAviso("Digite o nome do contato."); return; }
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const { data: cont, error } = await supabase.from("contatos")
      .upsert({ numero, nome }, { onConflict: "numero" }).select("id").single();
    if (error || !cont) { mostrarAviso("Não consegui salvar o contato."); return; }
    carregarContatos();
    await abrirConversaContato(cont);
  }

  // Conversar direto com um número digitado (sem cadastrar nome).
  async function conversarComNumero(numeroBruto) {
    const numero = numeroCanonico(numeroBruto);
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const { data: cont, error } = await supabase.from("contatos")
      .upsert({ numero }, { onConflict: "numero" }).select("id").single();
    if (error || !cont) { mostrarAviso("Não consegui iniciar a conversa."); return; }
    carregarContatos();
    await abrirConversaContato(cont);
  }

  // ---- Importar histórico do WhatsApp em LOTE (vários .txt exportados) ----
  // Extrai um número de telefone de um texto (nome do arquivo ou do contato).
  function numeroDeTexto(str) {
    const d = (str || "").replace(/\D/g, "");
    return d.length >= 8 && d.length <= 15 ? d : "";
  }
  // Diz se um texto é, na verdade, só um telefone (ex.: "+55 14 2106-0802").
  // No WhatsApp, contatos NÃO salvos aparecem no arquivo exportado com o número
  // formatado no lugar do nome — não queremos salvar isso como nome do contato.
  function pareceTelefone(str) {
    const s = (str || "").trim();
    if (!s) return false;
    if (/[a-zA-ZÀ-ÿ]/.test(s)) return false; // tem letra = é nome de verdade
    const d = s.replace(/\D/g, "");
    return d.length >= 8 && d.length <= 15;
  }
  // Tenta adivinhar o nome do contato pelo nome do arquivo exportado.
  // Vale tanto para .txt quanto para o .zip ("Conversa do WhatsApp com X.zip").
  function contatoDoArquivo(nomeArquivo) {
    const m = /com\s+(.+?)\.(txt|zip)$/i.exec(nomeArquivo || "");
    return m ? m[1].trim() : "";
  }
  // Nome do advogado (você) como aparece nos .txt: é o autor que aparece em
  // TODOS os arquivos (só ele se repete em todas as conversas).
  function detectarMeuNome(itens) {
    let comum = null;
    for (const it of itens) {
      const set = new Set(it.autores);
      comum = comum === null ? set : new Set([...comum].filter((x) => set.has(x)));
    }
    const inter = comum ? [...comum] : [];
    if (inter.length === 1) return inter[0]; // aparece em TODOS os arquivos = você (certeza)
    // Senão, tenta bater com o nome cadastrado do advogado.
    const adv = advogados.find((a) => a.id === impAdvId);
    const alvo = (adv?.nome || "").toLowerCase();
    for (const it of itens) { const h = it.autores.find((a) => a.toLowerCase() === alvo); if (h) return h; }
    // Não arrisca chutar (chutar o 1º autor invertia os papéis): o usuário escolhe.
    return "";
  }

  // Lê o texto de um arquivo .txt como string (promessa).
  function lerTextoArquivo(f) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => resolve("");
      r.readAsText(f, "utf-8");
    });
  }

  function aoEscolherTxts(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    processarArquivosImport(files);
  }

  async function processarArquivosImport(files) {
    if (!files.length) return;
    let houveErroZip = false;
    // Cada arquivo vira uma lista de { conteudo, nomeBase }. O .zip pode conter
    // um ou mais .txt; usamos o NOME DO ZIP para achar o contato/número, porque
    // dentro do zip o arquivo costuma se chamar só "_chat.txt".
    const listas = await Promise.all(files.map(async (f) => {
      const ehZip = /\.zip$/i.test(f.name) || f.type === "application/zip" || f.type === "application/x-zip-compressed";
      if (ehZip) {
        try {
          const txts = await lerTxtsDoZip(f);
          if (!txts.length) { houveErroZip = true; return []; }
          return txts.map((t) => ({ conteudo: t.texto, nomeBase: f.name }));
        } catch (_err) {
          houveErroZip = true;
          return [];
        }
      }
      return [{ conteudo: await lerTextoArquivo(f), nomeBase: f.name }];
    }));
    const itens = listas.flat().map(({ conteudo, nomeBase }) => {
      const msgs = parseWhatsAppTxt(conteudo);
      const autores = [...new Set(msgs.map((m) => m.autor))];
      const nomeContato = contatoDoArquivo(nomeBase);
      // O telefone REAL de um contato não salvo aparece como AUTOR dentro da
      // conversa (ex.: "+55 11 98984-8764"). O NOME DO ARQUIVO às vezes traz um
      // identificador interno do WhatsApp (@lid) — um número longo que NÃO é o
      // telefone. Por isso pegamos o número do autor (ou do nome do contato,
      // quando ele próprio é um telefone), nunca dos dígitos crus do arquivo.
      const autorTelefone = autores.find((a) => pareceTelefone(a)) || "";
      const numero = numeroDeTexto(autorTelefone) || (pareceTelefone(nomeContato) ? numeroDeTexto(nomeContato) : "");
      const ehGrupo = pareceGrupo(conteudo);
      // Nome do grupo: usa o do nome do arquivo; se faltar, pega de dentro do
      // arquivo (linha de "mudou o nome do grupo…"/"criou o grupo…").
      const nomeFinal = ehGrupo ? (nomeContato || nomeDoGrupo(conteudo)) : nomeContato;
      return { nome: nomeBase, msgs, autores, numero, nomeContato: nomeFinal, ehGrupo };
    });
    const validos = itens.filter((it) => it.msgs.length);
    if (!validos.length) {
      mostrarAviso(houveErroZip
        ? "Não consegui abrir o .zip. Extraia e suba o arquivo .txt de dentro dele."
        : "Nenhum arquivo tinha mensagens de conversa do WhatsApp.");
      return;
    }
    // Contatos SALVOS não têm o número no arquivo (o WhatsApp só mostra o nome).
    // Mas se o escritório já conversou com essa pessoa pelo Zorvin, o número já
    // está na agenda — então preenchemos automaticamente casando pelo nome.
    const semNumero = validos.filter((it) => !it.numero && !it.ehGrupo);
    if (semNumero.length) {
      try {
        const { data: agenda } = await supabase.from("contatos").select("nome, numero");
        if (agenda && agenda.length) {
          const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
          const mapa = new Map();
          agenda.forEach((c) => { if (c.nome && c.numero) mapa.set(norm(c.nome), c.numero); });
          validos.forEach((it) => {
            if (it.numero || it.ehGrupo) return;
            const candidatos = [it.nomeContato, ...it.autores].filter(Boolean);
            for (const nome of candidatos) {
              const achou = mapa.get(norm(nome));
              if (achou) { it.numero = numeroDeTexto(achou); break; }
            }
          });
        }
      } catch (_) { /* sem agenda acessível: segue e o usuário preenche à mão */ }
    }
    if (houveErroZip) mostrarAviso("Um ou mais .zip não puderam ser abertos e foram ignorados.");
    // A forma funcional. Esta função é assíncrona (lê e descompacta os
    // arquivos), então quando ela chega aqui o `impArquivos` que ela enxerga é
    // o de quando ela COMEÇOU. Soltando um segundo lote antes do primeiro
    // terminar, o segundo apagava o primeiro — e a tela dizia que só os
    // últimos arquivos tinham sido escolhidos.
    setImpArquivos((prev) => {
      const juntos = [...prev, ...validos];
      setImpMeuNome((atual) => atual || detectarMeuNome(juntos));
      return juntos;
    });
  }

  // Arrastar e soltar arquivos na área de importação.
  function aoSoltarImport(e) {
    e.preventDefault();
    setImpArrastando(false);
    const files = Array.from(e.dataTransfer?.files || [])
      .filter((f) => /\.(txt|zip)$/i.test(f.name));
    if (!files.length) { mostrarAviso("Solte apenas arquivos .zip ou .txt exportados do WhatsApp."); return; }
    processarArquivosImport(files);
  }

  // Nome mostrado de um arquivo. Grupo: o nome do grupo (do nome do arquivo).
  // 1:1: o autor que NÃO é você.
  function nomeContatoDoItem(it) {
    if (it.ehGrupo) return it.nomeContato || "Grupo";
    return it.nomeContato || it.autores.find((a) => a !== impMeuNome) || it.autores[0] || "Contato";
  }

  async function importarLote() {
    if (importando) return;
    if (!impAdvId) { mostrarAviso("Escolha o advogado dono dessas conversas."); return; }
    const meu = (impMeuNome || "").trim();
    if (!meu) { mostrarAviso("Confirme qual nome é o seu (o advogado) nos arquivos."); return; }
    // O número é OBRIGATÓRIO para conversas 1:1 (evita conversa duplicada no
    // futuro, quando o mesmo contato mandar mensagem pela ponte). Grupos não
    // têm número — são identificados pelo nome do grupo.
    const faltando = impArquivos.filter((it) => !it.ehGrupo && !numeroDeTexto(it.numero)).length;
    if (faltando > 0) { mostrarAviso(`Preencha o número dos ${faltando} contato(s) em vermelho antes de importar.`); return; }
    const prontos = impArquivos;
    if (!prontos.length) { mostrarAviso("Suba pelo menos um arquivo .txt."); return; }
    setImportando(true);
    let nConversas = 0, nMsgs = 0;
    try {
      for (let k = 0; k < prontos.length; k++) {
        const it = prontos[k];
        setImpProgresso(`Importando ${k + 1} de ${prontos.length}…`);
        const nomeBruto = nomeContatoDoItem(it);
        let registroContato;
        if (it.ehGrupo) {
          // GRUPO: não tem telefone. Cria um "contato" sintético que representa
          // o grupo (chave estável por advogado + nome do grupo), marcado como
          // grupo. Reimportar o mesmo grupo cai no mesmo registro (não duplica).
          // A chave começa com "grupo:" — é assim que o painel reconhece um grupo
          // (sem precisar de coluna nova no banco). Telefone real nunca é assim.
          const chave = "grupo:" + hashCurto(impAdvId + "|" + (it.nomeContato || "grupo"));
          registroContato = { numero: chave, nome: it.nomeContato || "Grupo" };
        } else {
          // 1:1. Se o "nome" é só um telefone (contato não salvo), NÃO gravamos
          // como nome — deixamos em branco para o painel mostrar o número limpo.
          const nomeC = pareceTelefone(nomeBruto) ? null : nomeBruto;
          registroContato = { numero: numeroCanonico(numeroDeTexto(it.numero)) };
          if (nomeC) registroContato.nome = nomeC; // sem nome: não sobrescreve o que já existir
        }
        const { data: cont, error: e1 } = await supabase.from("contatos")
          .upsert(registroContato, { onConflict: "numero" }).select("id").single();
        if (e1) throw e1;
        const { data: conv, error: e2 } = await supabase.from("conversas")
          .upsert({ advogado_id: impAdvId, contato_id: cont.id }, { onConflict: "advogado_id,contato_id" }).select("id").single();
        if (e2) throw e2;
        const linhas = it.msgs.map((m) => {
          const origem = m.autor === meu ? "advogado" : "contato";
          const texto = rotularMidiaExport(m.texto) || m.texto;
          const iso = m.data.toISOString();
          return {
            conversa_id: conv.id, origem, tipo: "texto", texto,
            // No grupo, várias pessoas escrevem — o autor entra na chave para não
            // colidir; e guardamos SEMPRE quem enviou (para mostrar na bolha).
            id_uazapi: (it.ehGrupo ? "grp-" : "txt-") + hashCurto(conv.id + "|" + iso + "|" + (it.ehGrupo ? m.autor : origem) + "|" + (texto || "").slice(0, 80)),
            status: origem === "advogado" ? "enviada" : "recebida",
            criado_em: iso,
            enviado_por: it.ehGrupo ? m.autor : (origem === "advogado" ? meu : null),
          };
        });
        for (let i = 0; i < linhas.length; i += 400) {
          const { error } = await supabase.from("mensagens").upsert(linhas.slice(i, i + 400), { onConflict: "id_uazapi", ignoreDuplicates: true });
          if (error) throw error;
        }
        const ult = it.msgs[it.msgs.length - 1];
        await supabase.from("conversas").update({
          ultima_mensagem: (rotularMidiaExport(ult.texto) || ult.texto || "").slice(0, 200),
          ultima_atividade: ult.data.toISOString(),
          nao_lidas: 0,
        }).eq("id", conv.id);
        nConversas++; nMsgs += linhas.length;
      }
      mostrarAviso(`Pronto! ${nConversas} conversa(s) e ${nMsgs} mensagens importadas.`);
      setImpArquivos([]); setImpMeuNome(""); setImpProgresso("");
      setConfigAberta(false);
      if (impAdvId === advogadoId) carregarConversas(advogadoId);
      carregarNaoLidasPorAdv();
    } catch (err) {
      mostrarAviso("Erro na importação: " + (err?.message || err));
    } finally {
      setImportando(false); setImpProgresso("");
    }
  }

  // Quantas mensagens a conversa traz de uma vez.
  //
  // Antes não havia teto NENHUM, e a ordem era CRESCENTE — a combinação errada.
  // Numa conversa de três anos isso dava um de dois desastres: ou o PostgREST
  // aplicava o teto dele (mil linhas, no Supabase hospedado) e o painel abria
  // mostrando as mensagens MAIS ANTIGAS, sem a que o cliente acabou de mandar;
  // ou não havia teto e o navegador montava vinte mil bolhas de uma vez, com
  // todas as fotos, e a aba travava.
  //
  // Agora vêm as ÚLTIMAS, que é o que se quer ao abrir uma conversa, e o resto
  // sobe sob demanda — o mesmo que o WhatsApp Web faz.
  const TETO_MENSAGENS = 120;

  // ---- Carrega as mensagens da conversa aberta ----
  const carregarMensagens = useCallback(async (convId) => {
    if (!convId) { setMensagens([]); setTemMaisAntigas(false); return; }
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .order("criado_em", { ascending: false })
      .limit(TETO_MENSAGENS);
    // ERRO NÃO É LISTA VAZIA. Sem esta guarda, uma oscilação de 4G ao tocar na
    // conversa abria uma tela EM BRANCO — e, dez linhas abaixo, zerava o
    // contador de não lidas no banco. As cinco mensagens do cliente sumiam da
    // lista e do título da aba, e ninguém mais sabia que existiam. O
    // zeramento é o "eu li": ele só pode acontecer depois de uma leitura que
    // deu certo.
    if (error) {
      mostrarAviso("Não consegui carregar as mensagens. Toque na conversa de novo.");
      return;
    }
    // Vieram de trás para a frente (para pegar as últimas); a tela quer na
    // ordem do tempo.
    const recentes = (data || []).slice().reverse();
    // Também carrega as NOTAS internas (comentários da equipe) e mistura na
    // linha do tempo, em ordem de horário. Notas ficam numa tabela separada
    // e nunca são enviadas para o WhatsApp.
    let notas = [];
    try {
      const { data: ns, error: nErr } = await supabase
        .from("notas")
        .select("*")
        .eq("conversa_id", convId)
        .order("criado_em", { ascending: true });
      if (!nErr) notas = (ns || []).map((n) => ({ ...n, id: "nota-" + n.id, origem: "nota" }));
    } catch (_) { /* tabela ainda não criada: segue sem notas */ }
    const juntas = [...recentes, ...notas].sort(
      (a, b) => new Date(a.criado_em) - new Date(b.criado_em)
    );
    // Se troquei de conversa enquanto esta busca estava em andamento, descarta o
    // resultado — senão as mensagens da conversa antiga sobrescreveriam a atual.
    if (conversaIdRef.current !== convId) return;
    // Antes de trocar a lista, libera prévias locais (blob:) da lista anterior
    // que não foram revogadas (ex.: troquei de conversa antes do eco chegar),
    // para não vazar memória.
    setMensagens((prev) => {
      prev.forEach((m) => { if (m.midia_url && String(m.midia_url).startsWith("blob:")) URL.revokeObjectURL(m.midia_url); });
      return juntas;
    });
    // Divisor "mensagens não lidas": marca a 1ª não lida, contando de trás para
    // frente APENAS as mensagens do contato (ignora respostas do advogado).
    const n = naoLidasRef.current || 0;
    let alvoId = null;
    if (n > 0 && recentes.length) {
      let count = 0;
      for (let i = recentes.length - 1; i >= 0; i--) {
        if (recentes[i].origem === "contato") {
          count++;
          if (count === n) { alvoId = recentes[i].id; break; }
        }
      }
    }
    setIdDivisorNaoLidas(alvoId);
    // Veio o lote cheio? Então provavelmente há mais para trás.
    setTemMaisAntigas((data || []).length >= TETO_MENSAGENS);
    naoLidasRef.current = 0; // usa só na abertura
    // AQUI ZERAVA O CONTADOR. Não zera mais.
    //
    // Abrir a conversa era o suficiente para ela sumir da lista de não lidas —
    // e abrir não é atender. Quem passa o olho para saber do que se trata, ou
    // clica sem querer, apagava o único sinal de que aquele cliente estava
    // esperando resposta. Com a equipe dividindo os mesmos telefones, o sinal
    // apagado por um some para todos.
    //
    // Agora a conversa só vira "lida" quando alguém RESPONDE o contato (ver
    // `marcarLida`, chamada em `enviar` e em `enviarArquivo`) ou quando alguém
    // diz explicitamente que já tratou, no botão do cabeçalho.
    // Marca que EU estou atendendo (para os outros verem). Na primeira recusa
    // do banco o recurso se desliga e nem esta gravação nem o pulso de 60s
    // voltam a tentar — ver RECURSOS, no alto do arquivo.
    if (RECURSOS.atendendo) {
      supabase.from("conversas")
        .update({ atendendo_por: meuNome, atendendo_em: new Date().toISOString() })
        .eq("id", convId)
        .then(({ error }) => { if (error) desligarRecurso("atendendo", error); });
    }
  }, [meuNome]);

  useEffect(() => { carregarMensagens(conversaId); }, [conversaId, carregarMensagens]);

  // SOBE MAIS UM LOTE de histórico, a partir da mensagem mais antiga que já
  // está na tela. É o "carregar anteriores" do WhatsApp Web — e é ele que
  // permite que a abertura da conversa traga só as últimas, que é o barato.
  async function carregarAntigas() {
    if (buscandoAntigas || !conversaId) return;
    const maisAntiga = mensagens.find((m) => m.origem !== "nota");
    if (!maisAntiga) return;
    setBuscandoAntigas(true);
    const convId = conversaId;
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .lt("criado_em", maisAntiga.criado_em)
      .order("criado_em", { ascending: false })
      .limit(TETO_MENSAGENS);
    setBuscandoAntigas(false);
    if (error) { mostrarAviso("Não consegui trazer as mensagens anteriores."); return; }
    // Troquei de conversa enquanto isto vinha: joga fora, senão o histórico de
    // uma pessoa aparece na conversa de outra.
    if (conversaIdRef.current !== convId) return;
    const lote = (data || []).slice().reverse();
    setTemMaisAntigas(lote.length >= TETO_MENSAGENS);
    if (!lote.length) return;
    setMensagens((prev) => {
      const jaTem = new Set(prev.map((m) => m.id));
      return [...lote.filter((m) => !jaTem.has(m.id)), ...prev];
    });
  }

  // ---- Mantém vivo o "estou atendendo" enquanto a conversa fica aberta ----
  // Este era o pior dos casos: um relógio que batia no banco a cada minuto,
  // para sempre, mesmo quando a coluna não existia e a resposta era erro.
  useEffect(() => {
    if (!conversaId || !RECURSOS.atendendo) return;
    const id = setInterval(() => {
      if (!RECURSOS.atendendo) { clearInterval(id); return; }
      supabase.from("conversas")
        .update({ atendendo_em: new Date().toISOString() })
        .eq("id", conversaId)
        .then(({ error }) => {
          if (!error) return;
          desligarRecurso("atendendo", error);
          // Só para o relógio se o recurso morreu de vez. Erro passageiro
          // (rede) não desliga nada e o próximo minuto tenta de novo.
          if (!RECURSOS.atendendo) clearInterval(id);
        });
    }, 60000);
    return () => clearInterval(id);
  }, [conversaId]);

  // ---- Ajusta a altura da caixa de texto conforme escreve (várias linhas) ----
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [rascunho]);

  // ---- Realtime: novas mensagens e conversas atualizadas ----
  //
  // O CANAL É ASSINADO UMA VEZ SÓ, e tudo o que muda é lido por referência.
  //
  // Antes as dependências incluíam `conversaId` e `advogadoId`: cada conversa
  // que o atendente abria derrubava o canal e assinava outro. Entre o
  // `removeChannel` e o `subscribe` novo há um vão de rede — e o que o
  // Postgres publica nesse vão não é entregue a ninguém, nem depois. Numa
  // manhã de trinta conversas abertas eram trinta janelas de silêncio, e a
  // mensagem que caísse numa delas simplesmente não aparecia até alguém
  // recarregar a página.
  useEffect(() => {
    const canal = supabase
      .channel("zorvin-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, async (payload) => {
        const nova = payload.new;
        if (nova.conversa_id === conversaIdRef.current) {
          setMensagens((prev) => {
            if (prev.some((m) => m.id === nova.id)) return prev;
            // Se esta é a versão "real" de uma mensagem que enviei (e mostrei
            // na hora, provisória), removo APENAS a provisória correspondente
            // (a primeira ainda "enviando"), para não duplicar nem apagar uma
            // que falhou (com o mesmo texto) ou outra idêntica.
            let base = prev;
            if (nova.origem === "advogado") {
              let removido = false;
              base = prev.filter((m) => {
                if (!removido && String(m.id).startsWith("temp-") && m._status === "enviando" &&
                    ((nova.texto && m.texto === nova.texto) || (nova.midia_url && m._midiaUrlFinal === nova.midia_url))) {
                  removido = true;
                  // Libera a prévia local (blob) para não vazar memória.
                  if (m.midia_url && String(m.midia_url).startsWith("blob:")) URL.revokeObjectURL(m.midia_url);
                  return false;
                }
                return true;
              });
            }
            // Reordena por horário: uma mensagem "real" pode ter data anterior
            // à provisória (ou vir de backfill) e não pode cair no fim da lista.
            return [...base, nova].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
          });
          // Mensagem nova do contato com a conversa aberta TAMBÉM conta como
          // não lida. Estar com a tela aberta não é ter respondido — e é
          // justamente com a conversa aberta que chega a mensagem que a pessoa
          // ainda vai ler e responder depois.
        }
        // Esta mensagem é do advogado atualmente aberto? Se a conversa já está
        // na lista, sim. Se não está (pode ser uma conversa NOVA — lead novo),
        // confirmamos com uma consulta rápida do advogado_id.
        const jaNaLista = conversasRef.current.some((c) => c.id === nova.conversa_id);
        let doAdvogadoAtual = jaNaLista;
        if (!doAdvogadoAtual && nova.origem === "contato" && advogadoIdRef.current) {
          const { data } = await supabase.from("conversas").select("advogado_id").eq("id", nova.conversa_id).maybeSingle();
          doAdvogadoAtual = !!data && data.advogado_id === advogadoIdRef.current;
        }
        // Aviso de nova mensagem (som + notificação) — inclusive para conversa
        // nova — quando não estou olhando exatamente para ela.
        if (nova.origem === "contato" && doAdvogadoAtual && (document.hidden || nova.conversa_id !== conversaIdRef.current)) {
          tocarBeep();
          notificarDesktop("Nova mensagem", nova.texto || "Mídia recebida");
        }
        // Só re-busca a lista inteira quando é uma conversa NOVA (que ainda não
        // está na lista). Conversas que já estão na lista são atualizadas no
        // lugar pelo handler de UPDATE de conversas — sem re-buscar tudo, que
        // era o que fazia a tela "recarregar sozinha".
        if (doAdvogadoAtual && !jaNaLista) carregarConversas(advogadoIdRef.current);
        carregarNaoLidasPorAdv(); // selos do rail de todos os advogados
      })
      // Status de uma mensagem mudou (ex.: foi lida) — atualiza o "tiquinho".
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensagens" }, (payload) => {
        const atual = payload.new;
        if (atual.conversa_id !== conversaIdRef.current) return;
        setMensagens((prev) => prev.map((m) => (m.id === atual.id ? { ...m, status: atual.status } : m)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversas" }, (payload) => {
        const cv = payload.new;
        if (!cv) return;
        // Atualiza "digitando…" e "quem está atendendo" localmente (leve).
        setDigitandos((prev) => {
          const novo = { ...prev };
          if (cv.digitando_ate && new Date(cv.digitando_ate).getTime() > Date.now()) novo[cv.id] = cv.digitando_ate;
          else delete novo[cv.id];
          return novo;
        });
        setAtendimentos((prev) => {
          const novo = { ...prev };
          if (cv.atendendo_por) novo[cv.id] = { por: cv.atendendo_por, em: cv.atendendo_em }; else delete novo[cv.id];
          return novo;
        });
        // Aplica os campos alterados NA PRÓPRIA lista, sem re-buscar tudo (era o
        // que fazia a tela "recarregar sozinha" a cada evento). Só mexe se a
        // conversa já está na lista do advogado atual; conversa nova entra pelo
        // handler de INSERT de mensagens.
        setConversas((prev) => {
          if (!prev.some((c) => c.id === cv.id)) return prev;
          const patched = prev.map((c) => c.id === cv.id ? {
            ...c,
            ultima_mensagem: cv.ultima_mensagem,
            ultima_atividade: cv.ultima_atividade,
            nao_lidas: cv.nao_lidas,
            favorita: cv.favorita,
            arquivada: cv.arquivada,
            // Fixar vale para a equipe toda, então quem fixou de outra máquina
            // tem de subir aqui também. O `??` é para a base que ainda não tem a
            // coluna: ali `cv.fixada` vem indefinido e não pode apagar o que
            // esta tela já sabe.
            fixada: cv.fixada ?? c.fixada,
          } : c);
          // Fixadas no alto; entre iguais, a mais recente primeiro.
          return patched.sort((a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0)
            || new Date(b.ultima_atividade) - new Date(a.ultima_atividade));
        });
        carregarNaoLidasPorAdv();
      })
      // Se a ponte não conseguir enviar, a fila vira "erro" — aviso na tela.
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_envio" }, (payload) => {
        const row = payload.new;
        if (!row || row.conversa_id !== conversaIdRef.current || row.status !== "erro") return;
        // Marca APENAS a primeira provisória que casa — a mesma trava dos
        // outros dois handlers. Sem ela, mandar "ok" duas vezes e a ponte
        // falhar uma pintava as DUAS de vermelho; reenviando as duas, o
        // cliente recebia "ok" duplicado.
        setMensagens((prev) => {
          let marcado = false;
          return prev.map((m) => {
            if (marcado) return m;
            const casa = String(m.id).startsWith("temp-") && m._status === "enviando" &&
              ((row.texto && m.texto === row.texto) || (row.midia_url && m._midiaUrlFinal === row.midia_url));
            if (!casa) return m;
            marcado = true;
            return { ...m, _status: "erro" };
          });
        });
      })
      // Nota interna nova (de outro atendente): aparece na conversa aberta.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notas" }, (payload) => {
        const n = payload.new;
        if (!n || n.conversa_id !== conversaIdRef.current) return;
        const item = { ...n, id: "nota-" + n.id, origem: "nota" };
        setMensagens((prev) => {
          if (prev.some((m) => m.id === item.id)) return prev;
          // Substitui APENAS a primeira versão provisória correspondente (que eu
          // mesmo acabei de escrever) — se eu mandar duas notas iguais em
          // sequência, não pode remover as duas de uma vez.
          let removido = false;
          const semTemp = prev.filter((m) => {
            if (!removido && String(m.id).startsWith("nota-temp-") && m.texto === n.texto) { removido = true; return false; }
            return true;
          });
          return [...semTemp, item].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
        });
      })
      // Tags criadas/editadas/removidas e tags aplicadas às conversas.
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, () => { carregarTags(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversa_tags" }, () => { carregarTagsConversas(); })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregarConversas, carregarNaoLidasPorAdv, carregarTags, carregarTagsConversas]);

  // Ao abrir uma conversa, começa no fim (mensagens mais recentes).
  // A ficha do cliente fecha junto: ela é o cadastro de QUEM está na conversa,
  // e deixá-la aberta ao trocar de contato mostraria os dados da pessoa errada.
  // O RASCUNHO PASSOU A SER DE CADA CONVERSA.
  //
  // Antes ele era um só, compartilhado, e a troca de conversa desligava o modo
  // "nota interna" SEM apagar o texto. O resultado era o pior erro que este
  // painel podia cometer: a pessoa começava a escrever uma nota interna sobre
  // um cliente ("cliente mente sobre a data, conferir antes de responder"),
  // era chamada para outra conversa, e ali a mesma frase estava na caixa —
  // agora em modo mensagem normal. Um Enter e a nota ia parar no WhatsApp do
  // outro cliente.
  //
  // Guardando por conversa, o texto volta para onde foi escrito, junto com o
  // modo em que foi escrito. Ninguém perde o que digitou e nada atravessa de
  // uma conversa para a outra.
  useEffect(() => { rascunhoRef.current = rascunho; }, [rascunho]);
  useEffect(() => { modoNotaRef.current = modoNota; }, [modoNota]);
  useEffect(() => {
    const antes = conversaAnteriorRef.current;
    if (antes && antes !== conversaId) {
      const texto = rascunhoRef.current;
      if (texto.trim()) rascunhosRef.current[antes] = { texto, nota: modoNotaRef.current };
      else delete rascunhosRef.current[antes];
    }
    conversaAnteriorRef.current = conversaId;
    const guardado = conversaId ? rascunhosRef.current[conversaId] : null;
    setRascunho(guardado ? guardado.texto : "");
    setModoNota(guardado ? !!guardado.nota : false);
    setPertoDoFim(true); setBuscaAberta(false); setBuscaConversa(""); setEmojiAberto(false); setRespondendo(null); setInfoAberta(false); setFichaAberta(false); setTagMenuAberto(false);
    requestAnimationFrame(() => { fimRef.current?.scrollIntoView(); if (conversaId && !estreito) inputRef.current?.focus(); });
  }, [conversaId]);

  // Mensagem nova: só rola até o fim se o atendente já estava no fim
  // (não "puxa" a tela quem está lendo mensagens antigas).
  useEffect(() => { if (pertoDoFim) fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens.length]);

  // Mostra o total de não lidas no título da aba: "(3) Zorvin".
  useEffect(() => {
    // ARQUIVADA não conta. Uma conversa arquivada com não lidas deixava o
    // título da aba em "(2) Zorvin" e o selo vermelho no telefone para sempre:
    // o número existia e não havia nada na lista para clicar e zerar.
    const total = conversas.reduce((s, c) => s + (c.arquivada ? 0 : (c.nao_lidas || 0)), 0);
    document.title = total > 0 ? `(${total}) Zorvin` : "Zorvin";
  }, [conversas]);

  // Pede permissão para notificar na área de trabalho (uma vez), quando o
  // atendente abre a primeira conversa — é um gesto do usuário, então o
  // navegador aceita melhor do que pedir logo ao carregar a página.
  const jaPediuNotif = useRef(false);
  useEffect(() => {
    if (!conversaId || jaPediuNotif.current) return;
    jaPediuNotif.current = true;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [conversaId]);

  // "Tique" a cada 2s só quando há alguém "digitando…", para expirar o aviso
  // (não fica re-renderizando a lista à toa quando ninguém está digitando).
  useEffect(() => {
    // "Há alguém digitando" é ter algum prazo AINDA no futuro. Contar as
    // chaves do mapa não servia: uma entrada vencida conta igual a uma viva.
    const vivo = Object.values(digitandos).some((a) => new Date(a).getTime() > Date.now());
    if (!vivo) return;
    const id = setInterval(() => setTique((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [digitandos, tique]);

  // Acompanha a largura da janela (para o layout de celular).
  useEffect(() => {
    // Guarda o BOOLEANO, não o número. Com a largura exata, arrastar a janela
    // gerava dezenas de re-renders do painel inteiro por segundo; com o
    // booleano, o React descarta o setState enquanto o valor não muda, e o
    // custo cai a zero fora do ponto de virada dos 768px.
    function aoRedimensionar() {
      const w = window.innerWidth;
      setLargura((antes) => ((antes < 768) === (w < 768) ? antes : w));
    }
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  // Toast discreto (some sozinho em 4s).
  function mostrarAviso(msg) {
    setAviso(msg);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(null), 4000);
  }

  // Ao desmontar (logout/fechar), para uma gravação em curso e o cronômetro,
  // para não deixar o microfone ligado nem timers rodando.
  useEffect(() => () => {
    try {
      if (gravadorRef.current) { gravadorRef.current._cancelado = true; gravadorRef.current.stop(); }
    } catch (_) { /* ignora */ }
    if (timerRef.current) clearInterval(timerRef.current);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    document.title = "Zorvin"; // não deixa o contador de não lidas grudado na aba após sair
  }, []);

  // Libera as prévias locais (blob:) do áudio gravado e do anexo pendente quando
  // elas mudam ou ao sair, para não vazar memória.
  useEffect(() => () => { if (audioPronto && String(audioPronto.url).startsWith("blob:")) URL.revokeObjectURL(audioPronto.url); }, [audioPronto]);
  useEffect(() => () => { if (anexoPendente && String(anexoPendente.url).startsWith("blob:")) URL.revokeObjectURL(anexoPendente.url); }, [anexoPendente]);

  // ---- A GALERIA DA CONVERSA ----
  //
  // Ampliar uma imagem mostrava aquela imagem e mais nada. Quem procura "a foto
  // do documento que ela mandou" tinha de fechar, rolar a conversa, achar a
  // próxima, ampliar de novo — e numa conversa de duzentas mensagens isso é a
  // diferença entre achar e desistir.
  //
  // A lista é a das imagens DESTA conversa, na ordem em que chegaram. Sai das
  // mensagens que já estão na tela: não há consulta nova, e a fita de baixo
  // acompanha sozinha quando chega imagem nova.
  const imagensDaConversa = mensagens
    .filter((m) => m.tipo === "imagem" && m.midia_url)
    .map((m) => m.midia_url);
  // Onde a imagem aberta está na lista. -1 quer dizer "não é da conversa" — é o
  // caso da FOTO DE PERFIL, que se amplia pelo cabeçalho. Ali não há próxima nem
  // anterior, e mostrar setas seria prometer uma navegação que não existe.
  const posNaGaleria = imagemAberta ? imagensDaConversa.indexOf(imagemAberta) : -1;
  const temGaleria = posNaGaleria >= 0 && imagensDaConversa.length > 1;

  function andarNaGaleria(passo) {
    if (posNaGaleria < 0) return;
    // Sem dar a volta: na última, "próxima" não faz nada. Voltar ao começo sem
    // aviso faz a pessoa rever as mesmas imagens achando que ainda há mais.
    const destino = posNaGaleria + passo;
    if (destino < 0 || destino >= imagensDaConversa.length) return;
    setImagemAberta(imagensDaConversa[destino]);
  }

  // Setas do teclado andam na galeria — é o gesto de quem está comparando duas
  // imagens e não quer tirar a mão do teclado.
  useEffect(() => {
    if (!temGaleria) return;
    function aoTeclar(e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); andarNaGaleria(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); andarNaGaleria(1); }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // Sem lista de dependências, este efeito trocava o ouvinte do teclado a
    // CADA render do painel — e o painel re-renderiza a cada mensagem que
    // chega, a cada tecla digitada e a cada tique do relógio. A lista abaixo
    // cobre tudo o que a função lê: a posição e o tamanho da galeria.
  }, [temGaleria, posNaGaleria, imagensDaConversa.length]);

  // ---- MÍDIAS, DOCUMENTOS E LINKS DE TODAS AS CONVERSAS ----
  //
  // "Aquele comprovante que mandaram semana passada" é uma busca que existe
  // todo dia e que a lista de conversas não responde: o arquivo está no meio de
  // uma conversa que a pessoa nem lembra qual é. Aqui tudo o que passou pelos
  // telefones dela aparece junto, do mais novo para o mais velho.
  //
  // Não há filtro de permissão escrito nesta consulta, e isso é de propósito: o
  // banco só devolve mensagem de conversa que a pessoa pode ver (as políticas de
  // `mensagens` e `conversas`). Escrever o filtro aqui também criaria uma
  // segunda regra para manter igual à primeira.
  const [midiasAberta, setMidiasAberta] = useState(false);
  const [midiaAba, setMidiaAba] = useState("midias");   // 'midias' | 'documentos' | 'links'
  const [acervo, setAcervo] = useState({ carregando: false, itens: [] });

  const abrirMidias = useCallback(async () => {
    setMidiasAberta(true);
    setAcervo((a) => ({ ...a, carregando: true }));
    const { data, error } = await supabase
      .from("mensagens")
      .select("id, conversa_id, tipo, texto, midia_url, midia_mime, criado_em")
      // Teto de 500: é acervo para OLHAR, não para auditar. Sem teto, um ano de
      // conversa desenharia milhares de miniaturas de uma vez e a tela travaria
      // justamente em quem mais usa.
      .order("criado_em", { ascending: false })
      .limit(500);
    if (error) { setAcervo({ carregando: false, itens: [] }); mostrarAviso("Não consegui abrir as mídias."); return; }
    setAcervo({ carregando: false, itens: data || [] });
  }, []);

  // De qual conversa é cada item, para a etiqueta embaixo da miniatura. Só o que
  // está carregado — o acervo pode alcançar conversa de outro telefone, e ali a
  // etiqueta fica em branco em vez de mentir um nome.
  const nomePorConversa = Object.fromEntries(
    conversas.map((c) => [c.id, nomeDoContato(c.contato)]));

  // Um link é uma URL dentro do texto. Regex simples de propósito: o que se quer
  // é reencontrar o endereço que alguém mandou, não validar URL.
  const RE_LINK = /https?:\/\/[^\s<>"']+/gi;
  const acervoFiltrado = (() => {
    const itens = acervo.itens || [];
    if (midiaAba === "midias") return itens.filter((m) => (m.tipo === "imagem" || m.tipo === "video") && m.midia_url);
    if (midiaAba === "documentos") return itens.filter((m) => m.tipo === "documento" && m.midia_url);
    return itens.flatMap((m) => {
      const achados = String(m.texto || "").match(RE_LINK) || [];
      return achados.map((url, i) => ({ ...m, _link: url, id: m.id + "-" + i }));
    });
  })();

  // Tecla Esc fecha o que estiver aberto (imagem, emoji, seletor, busca, citação)
  // e, quando não há mais nada aberto, FECHA A CONVERSA — como no WhatsApp Web.
  //
  // A ordem é a coisa toda: a conversa é o ÚLTIMO degrau. Esc com o emoji aberto
  // fecha o emoji; Esc com a citação pendente tira a citação; e só quando não
  // sobrou nada por fechar é que ele sai da conversa. Fosse o primeiro degrau,
  // abrir o seletor de emoji e desistir jogaria a pessoa para fora do
  // atendimento.
  //
  // O texto que estiver escrito no campo NÃO se perde: o rascunho vive fora da
  // conversa (é o mesmo comportamento de trocar de conversa hoje), então ele
  // continua lá ao reabrir.
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key !== "Escape") return;
      if (imagemAberta) setImagemAberta(null);
      else if (anexoPendente) fecharAnexoPendente();
      else if (audioPronto) descartarAudioPronto();
      else if (gravando) cancelarGravacao();
      else if (tagForm) setTagForm(null);
      else if (rapidaForm) setRapidaForm(null);
      else if (contatoForm) setContatoForm(null);
      // As três telas que cobrem tudo. Faltavam aqui, e como o Esc é uma
      // escada, faltar não era "o Esc não faz nada": ele descia até o último
      // degrau e FECHAVA A CONVERSA lá atrás, por baixo do que estava aberto.
      // A pessoa fechava as Mídias e a conversa tinha sumido.
      else if (juntar) setJuntar(null);
      else if (midiasAberta) setMidiasAberta(false);
      else if (telaAdmin) setTelaAdmin(false);
      else if (configAberta) setConfigAberta(false);
      else if (novaConversaAberta) setNovaConversaAberta(false);
      else if (menuConversa) setMenuConversa(null);
      else if (menuTopoAberto) setMenuTopoAberto(false);
      else if (menuEtiquetas) setMenuEtiquetas(false);
      else if (tagMenuAberto) setTagMenuAberto(false);
      else if (emojiAberto) setEmojiAberto(false);
      else if (seletorAberto) setSeletorAberto(false);
      else if (fichaAberta) setFichaAberta(false);
      else if (infoAberta) setInfoAberta(false);
      else if (buscaAberta) { setBuscaAberta(false); setBuscaConversa(""); }
      else if (respondendo) setRespondendo(null);
      else if (conversaId) setConversaId(null);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [imagemAberta, anexoPendente, audioPronto, gravando, configAberta, novaConversaAberta, rapidaForm, tagForm, contatoForm, juntar, midiasAberta, telaAdmin, menuConversa, menuTopoAberto, menuEtiquetas, tagMenuAberto, emojiAberto, seletorAberto, infoAberta, fichaAberta, buscaAberta, respondendo, conversaId]);

  // Clicar fora fecha o seletor de emoji, o de advogado e as mensagens rápidas.
  useEffect(() => {
    function aoClicar(e) {
      if (menuEtiquetas && etiquetasRef.current && !etiquetasRef.current.contains(e.target)) setMenuEtiquetas(false);
      if (emojiAberto && emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiAberto(false);
      if (seletorAberto && seletorRef.current && !seletorRef.current.contains(e.target)) setSeletorAberto(false);
      if (tagMenuAberto && tagMenuRef.current && !tagMenuRef.current.contains(e.target)) setTagMenuAberto(false);
      if (menuTopoAberto && menuTopoRef.current && !menuTopoRef.current.contains(e.target)) setMenuTopoAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [emojiAberto, seletorAberto, tagMenuAberto, menuTopoAberto, menuEtiquetas]);

  // Fecha o menuzinho da conversa (marcar não lida) ao clicar em qualquer lugar.
  useEffect(() => {
    if (!menuConversa) return;
    function fecha() { setMenuConversa(null); }
    document.addEventListener("click", fecha);
    return () => document.removeEventListener("click", fecha);
  }, [menuConversa]);

  // Ao digitar na busca da conversa, vai para a ocorrência mais recente.
  useEffect(() => {
    const q = buscaConversa.trim().toLowerCase();
    if (!buscaAberta || !q) return;
    const ids = mensagens.filter((m) => (m.texto || "").toLowerCase().includes(q)).map((m) => m.id);
    if (!ids.length) return;
    const idx = ids.length - 1;
    setBuscaIdx(idx);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-msg-id="${ids[idx]}"]`);
      if (el) el.scrollIntoView({ block: "center" });
    });
  }, [buscaConversa, buscaAberta]); // eslint-disable-line react-hooks/exhaustive-deps

  function aoRolar() {
    const el = listaRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPertoDoFim(dist < 120);
  }

  function irParaOFim() {
    setPertoDoFim(true);
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function inserirEmoji(e) {
    setRascunho((r) => r + e);
    inputRef.current?.focus();
  }

  // Insere na fila de envio. Se a coluna "enviado_por" ainda não existir no
  // banco (SQL não rodou), tenta de novo sem ela — o envio nunca trava por isso.
  async function inserirNaFila(payload) {
    let { error } = await supabase.from("fila_envio").insert(payload);
    if (error && /enviado_por/i.test(error.message || "")) {
      const semAutor = { ...payload };
      delete semAutor.enviado_por;
      delete semAutor.enviado_por_foto;
      ({ error } = await supabase.from("fila_envio").insert(semAutor));
    }
    // Entrou na fila: cutuca a ponte para ela acordar e enviar já.
    if (!error) acordarPonte();
    return { error };
  }

  // Texto curto que representa uma mensagem quando ela é citada.
  function previaDe(m) {
    if (m.tipo === "imagem") return "📷 Imagem";
    if (m.tipo === "audio") return "🎤 Áudio";
    if (m.tipo === "video") return "🎬 Vídeo";
    if (m.tipo === "documento") return "📄 Documento";
    return (m.texto || "").slice(0, 120);
  }

  // Começa a responder (citar) uma mensagem. Só dá para citar mensagens já
  // confirmadas (que têm id_uazapi) — não as que ainda estão sendo enviadas.
  function iniciarResposta(m) {
    if (!m.id_uazapi) return;
    setRespondendo({ id_uazapi: m.id_uazapi, previa: previaDe(m), autor: m.origem });
    inputRef.current?.focus();
  }

  // `setFiltro("tudo")` junto: com um filtro de tag ativo, trocar de telefone
  // abria a lista escrita "Nenhuma conversa ainda" — e não era verdade, era o
  // filtro de outro telefone ainda ligado.
  function trocarAdvogado(id) { setAdvogadoId(id); setConversaId(null); setSeletorAberto(false); setBusca(""); setVerArquivadas(false); setFiltro("tudo"); }
  // Troca de DEPARTAMENTO e vai para o primeiro telefone dele.
  function trocarDepartamento(id) {
    if (id === departamentoId) return;
    setDepartamentoId(id);
    setConversaId(null);
    setBusca(""); setVerArquivadas(false); setFiltro("tudo");
    // A lista PERMITIDA, não a lista crua. `advogados` vem do banco sem filtro
    // (é leitura livre, ver `filtrarPermitidos`): usá-la aqui jogava a pessoa
    // num telefone que ela não pode abrir, e a lista de conversas aparecia
    // vazia sem dizer por quê.
    const primeiro = advogadosVisiveis.find((a) => a.departamento_id === id)
                  || advogadosVisiveis[0] || null;
    setAdvogadoId(primeiro ? primeiro.id : null);
  }

  // Marca a conversa como não lida (mostra o selo verde) ou como lida.
  async function marcarNaoLida(conv, naoLida) {
    setMenuConversa(null);
    const novo = naoLida ? (conv.nao_lidas > 0 ? conv.nao_lidas : 1) : 0;
    setConversas((prev) => prev.map((x) => (x.id === conv.id ? { ...x, nao_lidas: novo } : x)));
    // Para o "não lida" valer visualmente, sai da conversa se ela estiver aberta.
    if (naoLida && conv.id === conversaId) setConversaId(null);
    mostrarAviso(naoLida ? "Marcada como não lida" : "Marcada como lida");
    const { error } = await supabase.from("conversas").update({ nao_lidas: novo }).eq("id", conv.id);
    // Sem conferir, a tela dizia "Marcada como lida" e o banco continuava com o
    // contador antigo — na próxima recarga o selo voltava, e a pessoa jurava
    // ter marcado.
    if (error) { mostrarAviso("Não consegui marcar. Tente de novo."); carregarConversas(advogadoId); }
  }

  // Favoritar / desfavoritar uma conversa (aba "Favoritas").
  async function alternarFavorita(conv) {
    setMenuConversa(null);
    const novo = !conv.favorita;
    setConversas((prev) => prev.map((x) => (x.id === conv.id ? { ...x, favorita: novo } : x)));
    mostrarAviso(novo ? "Adicionada aos favoritos" : "Removida dos favoritos");
    const { error } = await supabase.from("conversas").update({ favorita: novo }).eq("id", conv.id);
    if (error) { mostrarAviso("Não consegui favoritar. Rode o SQL da coluna 'favorita'."); carregarConversas(advogadoId); }
  }

  // FIXAR uma conversa no alto da lista.
  //
  // Diferente de favoritar: favorito é uma ABA, uma gaveta que se abre quando se
  // quer; fixar é uma conversa que fica à vista todo dia, acima das outras,
  // mesmo quando não é a mais recente. Quem atende uma negociação em curso não
  // quer procurá-la de novo a cada mensagem nova que chega de outra pessoa.
  async function alternarFixada(conv) {
    setMenuConversa(null);
    const novo = !conv.fixada;
    setConversas((prev) => prev.map((x) => (x.id === conv.id ? { ...x, fixada: novo } : x)));
    mostrarAviso(novo ? "Conversa fixada no topo" : "Conversa desafixada");
    const { error } = await supabase.from("conversas").update({ fixada: novo }).eq("id", conv.id);
    if (error) { mostrarAviso("Não consegui fixar. Rode o 2026-07-colunas-que-faltavam.sql no Supabase."); carregarConversas(advogadoId); }
  }

  // Arquivar / desarquivar uma conversa (some da lista, vai para "Arquivadas").
  async function alternarArquivada(conv, arquivar) {
    setMenuConversa(null);
    setConversas((prev) => prev.map((x) => (x.id === conv.id ? { ...x, arquivada: arquivar } : x)));
    if (arquivar && conv.id === conversaId) setConversaId(null);
    mostrarAviso(arquivar ? "Conversa arquivada" : "Conversa desarquivada");
    const { error } = await supabase.from("conversas").update({ arquivada: arquivar }).eq("id", conv.id);
    if (error) { mostrarAviso("Não consegui arquivar. Rode o SQL da coluna 'arquivada'."); carregarConversas(advogadoId); }
  }

  // Menu ⋮ do topo: marca TODAS as conversas do advogado como lidas.
  async function marcarTodasLidas() {
    setMenuTopoAberto(false);
    const ids = conversas.filter((c) => (c.nao_lidas || 0) > 0).map((c) => c.id);
    if (!ids.length) { mostrarAviso("Nenhuma conversa não lida."); return; }
    setConversas((prev) => prev.map((c) => ({ ...c, nao_lidas: 0 })));
    // Em lotes: a lista de ids vai na URL, e com centenas de conversas a
    // consulta inteira seria recusada — o mesmo cuidado que a busca já tem.
    let erro = null;
    for (let i = 0; i < ids.length && !erro; i += 100) {
      const { error } = await supabase.from("conversas").update({ nao_lidas: 0 }).in("id", ids.slice(i, i + 100));
      erro = error;
    }
    carregarNaoLidasPorAdv();
    if (erro) { mostrarAviso("Não consegui marcar todas. Tente de novo."); carregarConversas(advogadoId); return; }
    mostrarAviso("Todas marcadas como lidas");
  }

  // Marca a conversa como lida. É o gesto de "já tratei disto".
  //
  // Acontece em dois momentos, e só nesses dois: quando alguém RESPONDE o
  // contato (mensagem ou anexo) e quando alguém aperta o botão no cabeçalho.
  // NOTA INTERNA NÃO CONTA: ela é recado entre a equipe, o contato não recebe
  // nada, e o cliente continua esperando exatamente como estava.
  const marcarLida = useCallback(async (convId) => {
    if (!convId) return;
    setConversas((prev) => prev.map((c) => (c.id === convId ? { ...c, nao_lidas: 0 } : c)));
    const { error } = await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId);
    // Não deu para gravar: devolve o que o banco tem, senão a tela diz "lida"
    // e o resto da equipe continua vendo o selo.
    if (error) { mostrarAviso("Não consegui marcar como lida."); carregarConversas(advogadoIdRef.current); }
    else carregarNaoLidasPorAdv();
  }, [carregarConversas, carregarNaoLidasPorAdv]);

  async function enviar() {
    if (modoNota) { enviarNota(); return; }
    const t = rascunho.trim();
    if (!t || !conversaId) return;
    setRascunho("");
    setEmojiAberto(false);
    setPertoDoFim(true); // ao enviar, sempre volto para o fim da conversa
    const alvo = respondendo; // mensagem que estou citando (se houver)
    setRespondendo(null);
    // Mostra a mensagem NA HORA (provisória, com relóginho), como o WhatsApp Web.
    const tempId = "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6);
    const provisoria = {
      id: tempId, conversa_id: conversaId, origem: "advogado", enviado_por: meuNome, enviado_por_foto: minhaFoto,
      tipo: "texto", texto: t, criado_em: new Date().toISOString(), _status: "enviando",
      resposta_previa: alvo?.previa || null, resposta_autor: alvo?.autor || null,
      _responderId: alvo?.id_uazapi || null,
    };
    setMensagens((prev) => [...prev, provisoria]);
    // Coloca na fila de envio; a ponte processa e manda pela Uazapi.
    const payload = { conversa_id: conversaId, texto: t, enviado_por: meuNome, enviado_por_foto: minhaFoto };
    if (alvo) {
      payload.responder_id_uazapi = alvo.id_uazapi;
      payload.resposta_previa = alvo.previa;
      payload.resposta_autor = alvo.autor;
    }
    const { error } = await inserirNaFila(payload);
    if (error) {
      // Nem entrou na fila: marca como erro para o atendente reenviar.
      setMensagens((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "erro" } : m)));
      mostrarAviso("Não consegui enviar a mensagem. Toque em 'reenviar'.");
      return;
    }
    // Respondi o contato: a conversa deixa de estar pendente.
    marcarLida(conversaId);
  }

  // Salva uma NOTA INTERNA (comentário da equipe). Não vai para o WhatsApp:
  // grava direto na tabela "notas", que só o painel enxerga.
  async function enviarNota() {
    const t = rascunho.trim();
    if (!t || !conversaId) return;
    setRascunho("");
    setEmojiAberto(false);
    setPertoDoFim(true);
    const tempId = "nota-temp-" + Date.now();
    const provisoria = {
      id: tempId, conversa_id: conversaId, origem: "nota",
      texto: t, autor: meuNome, autor_foto: minhaFoto, criado_em: new Date().toISOString(), _status: "enviando",
    };
    setMensagens((prev) => [...prev, provisoria].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em)));
    let { error } = await supabase.from("notas").insert({ conversa_id: conversaId, texto: t, autor: meuNome, autor_foto: minhaFoto });
    if (error && /autor_foto/i.test(error.message || "")) {
      // Coluna de foto ainda não existe: salva a nota sem ela.
      ({ error } = await supabase.from("notas").insert({ conversa_id: conversaId, texto: t, autor: meuNome }));
    }
    if (error) {
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
      // Devolve o texto à caixa: a nota some da conversa, e sem isto o que a
      // pessoa escreveu some junto — sem cópia, sem rascunho, sem nada.
      setRascunho((r) => (r ? r : t));
      setModoNota(true);
      mostrarAviso("Não consegui salvar a nota. O texto voltou para a caixa.");
    }
    // Se deu certo, o Realtime traz a versão definitiva e remove a provisória.
  }

  // Reenvia uma mensagem que falhou (recoloca na fila, mantendo a citação/anexo).
  async function reenviar(msg) {
    setMensagens((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _status: "enviando" } : m)));
    let payload;
    if (msg.tipo && msg.tipo !== "texto") {
      // Anexo: reaproveita a URL do Storage (não o blob local, que a ponte não baixa).
      const url = msg._midiaUrlFinal || (msg.midia_url && !String(msg.midia_url).startsWith("blob:") ? msg.midia_url : null);
      if (!url) {
        // O upload nunca completou. Se ainda temos o arquivo, refaz do zero.
        if (msg._file) {
          setMensagens((prev) => prev.filter((m) => m.id !== msg.id));
          enviarArquivo(msg._file, msg._legenda || msg.texto || "", msg.conversa_id);
          return;
        }
        setMensagens((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _status: "erro" } : m)));
        mostrarAviso("Não consegui reenviar o anexo. Anexe o arquivo novamente.");
        return;
      }
      payload = {
        conversa_id: msg.conversa_id, texto: msg.texto || "", tipo: msg.tipo,
        midia_url: url, midia_mime: msg.midia_mime || null, midia_nome: msg.midia_nome || null,
        enviado_por: msg.enviado_por || meuNome, enviado_por_foto: msg.enviado_por_foto || minhaFoto,
      };
    } else {
      payload = { conversa_id: msg.conversa_id, texto: msg.texto || "", enviado_por: msg.enviado_por || meuNome, enviado_por_foto: msg.enviado_por_foto || minhaFoto };
      if (msg._responderId) {
        payload.responder_id_uazapi = msg._responderId;
        payload.resposta_previa = msg.resposta_previa;
        payload.resposta_autor = msg.resposta_autor;
      }
    }
    const { error } = await inserirNaFila(payload);
    if (error) {
      setMensagens((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _status: "erro" } : m)));
    }
  }

  // Anexos: ao escolher o arquivo, abre a PRÉVIA para digitar uma legenda
  // antes de enviar (como no WhatsApp Web).
  function aoEscolherArquivo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    const t = file.type || "";
    const tipo = t.startsWith("image/") ? "imagem" : t.startsWith("video/") ? "video" : t.startsWith("audio/") ? "audio" : "documento";
    const url = tipo === "documento" ? null : URL.createObjectURL(file);
    setLegendaAnexo("");
    setAnexoPendente({ file, url, tipo, nome: file.name });
  }

  function fecharAnexoPendente() {
    if (anexoPendente?.url && String(anexoPendente.url).startsWith("blob:")) URL.revokeObjectURL(anexoPendente.url);
    setAnexoPendente(null);
    setLegendaAnexo("");
  }

  function confirmarEnviarAnexo() {
    if (!anexoPendente) return;
    const { file } = anexoPendente;
    const legenda = legendaAnexo.trim();
    fecharAnexoPendente();
    enviarArquivo(file, legenda);
  }

  async function enviarArquivo(file, legenda = "", convId = conversaId) {
    if (!convId || !file) return;
    setPertoDoFim(true);
    const ehImagem = file.type.startsWith("image/");
    const ehVideo = file.type.startsWith("video/");
    const ehAudio = file.type.startsWith("audio/");
    const tipo = ehImagem ? "imagem" : ehVideo ? "video" : ehAudio ? "audio" : "documento";
    const tempId = "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6);
    // Prévia local (o remetente vê o anexo na hora, sem depender do Storage).
    const previa = tipo === "documento" ? null : URL.createObjectURL(file);
    setMensagens((prev) => [...prev, {
      id: tempId, conversa_id: convId, origem: "advogado", tipo, enviado_por: meuNome, enviado_por_foto: minhaFoto,
      texto: legenda || null, midia_url: previa, midia_mime: file.type, midia_nome: file.name,
      criado_em: new Date().toISOString(), _status: "enviando",
      _file: file, _legenda: legenda, // guardados para poder reenviar se falhar
    }]);
    try {
      const nome = (file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
      const caminho = `${convId}/${Date.now()}-${nome}`;
      const { error: upErr } = await supabase.storage.from("anexos").upload(caminho, file, { contentType: file.type });
      if (upErr) throw new Error("Falha ao subir o arquivo (Storage): " + (upErr.message || upErr));
      const { data: pub } = supabase.storage.from("anexos").getPublicUrl(caminho);
      const url = pub?.publicUrl;
      if (!url) throw new Error("sem URL pública do arquivo");
      // Mantém a prévia local na tela; guarda a URL do Storage só para casar
      // com a versão real que a ponte vai gravar (evita duplicar).
      setMensagens((prev) => prev.map((m) => (m.id === tempId ? { ...m, _midiaUrlFinal: url } : m)));
      const { error: filaErr } = await inserirNaFila({
        conversa_id: convId, texto: legenda || "", tipo,
        midia_url: url, midia_mime: file.type, midia_nome: nome, enviado_por: meuNome, enviado_por_foto: minhaFoto,
      });
      if (filaErr) throw new Error("Falha ao colocar na fila (banco): " + (filaErr.message || filaErr));
      // Anexo também é resposta ao contato: a conversa deixa de estar pendente.
      marcarLida(convId);
    } catch (err) {
      setMensagens((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "erro" } : m)));
      mostrarAviso("Não consegui enviar o anexo. " + (err?.message || err));
    }
  }

  // Baixa uma imagem de verdade (não só abre em nova aba). Como a imagem fica
  // em outro domínio (Storage), o atributo download é ignorado; então buscamos
  // o arquivo e forçamos o download por um link temporário.
  async function baixarImagem(url) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `imagem-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
    } catch (_) {
      window.open(url, "_blank"); // se não der, abre em nova aba
    }
  }

  // ---- Gravação de áudio pelo microfone (mensagem de voz) ----
  async function iniciarGravacao() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Este navegador não permite gravar áudio.");
      return;
    }
    const convId = conversaId; // conversa onde a gravação começou (não muda se trocar)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : (MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "");
      const gravador = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      gravador.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      gravador.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setGravando(false);
        setGravacaoPausada(false);
        const tipoBlob = gravador.mimeType || "audio/ogg";
        const blob = new Blob(chunksRef.current, { type: tipoBlob });
        if (!gravadorRef.current?._cancelado && blob.size > 0) {
          const ext = tipoBlob.includes("webm") ? "webm" : "ogg";
          const arquivo = new File([blob], `audio-${Date.now()}.${ext}`, { type: tipoBlob });
          // Não envia direto: mostra a PRÉVIA para ouvir antes de enviar.
          setAudioPronto({ file: arquivo, url: URL.createObjectURL(blob), convId });
        }
        gravadorRef.current = null;
      };
      gravadorRef.current = gravador;
      gravador.start();
      setGravando(true);
      setGravacaoPausada(false);
      setTempoGravacao(0);
      timerRef.current = setInterval(() => setTempoGravacao((t) => t + 1), 1000);
    } catch (_) {
      alert("Não consegui acessar o microfone. Verifique a permissão do navegador.");
      setGravando(false);
    }
  }

  // Pausa / retoma a gravação (o cronômetro pausa junto).
  function pausarRetomarGravacao() {
    const g = gravadorRef.current;
    if (!g) return;
    try {
      if (g.state === "recording") {
        g.pause();
        setGravacaoPausada(true);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      } else if (g.state === "paused") {
        g.resume();
        setGravacaoPausada(false);
        timerRef.current = setInterval(() => setTempoGravacao((t) => t + 1), 1000);
      }
    } catch (_) { /* ignora */ }
  }

  // Finaliza a gravação → o onstop monta a prévia (ainda não envia).
  function finalizarGravacao() {
    try { gravadorRef.current && gravadorRef.current.stop(); } catch (_) { /* ignora */ }
  }

  function cancelarGravacao() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (gravadorRef.current) {
      gravadorRef.current._cancelado = true;
      try { gravadorRef.current.stop(); } catch (_) { /* ignora */ }
    }
    setGravando(false);
    setGravacaoPausada(false);
  }

  // Prévia pronta: envia o áudio gravado.
  function enviarAudioPronto() {
    if (!audioPronto) return;
    enviarArquivo(audioPronto.file, "", audioPronto.convId);
    try { URL.revokeObjectURL(audioPronto.url); } catch (_) { /* ignora */ }
    setAudioPronto(null);
  }

  // Prévia pronta: descarta o áudio gravado.
  function descartarAudioPronto() {
    if (audioPronto) { try { URL.revokeObjectURL(audioPronto.url); } catch (_) { /* ignora */ } }
    setAudioPronto(null);
  }

  async function sair() {
    if (!window.confirm("Deseja sair do Zorvin?")) return;
    await supabase.auth.signOut();
  }

  // Tags (objetos) de uma conversa, na ordem em que foram definidas.
  function tagsDaConversa(convId) {
    const ids = tagsPorConversa[convId] || [];
    return tags.filter((t) => ids.includes(t.id));
  }

  // Quantas conversas não lidas há (para o número na aba "Não lidas"). Só conta
  // as que estão à vista (não arquivadas).
  const totalNaoLidasLista = conversas.filter((c) => !c.arquivada && (c.nao_lidas || 0) > 0).length;
  // Quantas estão arquivadas (para o contador da linha "Arquivadas").
  const totalArquivadas = conversas.filter((c) => c.arquivada).length;

  // A etiqueta escolhida no filtro, quando há uma. É ela que dá cor e nome à
  // pílula de etiquetas — sem isso, com o filtro ligado a lista fica curta e
  // nada na tela diz por quê.
  const tagFiltrada = filtro.startsWith("tag:")
    ? tags.find((t) => t.id === filtro.slice(4)) || null
    : null;

  // Aplica a aba/filtro selecionado a uma conversa.
  function passaNoFiltro(c) {
    if (filtro === "naolidas") return (c.nao_lidas || 0) > 0;
    if (filtro === "favoritas") return !!c.favorita;
    if (filtro.startsWith("tag:")) return (tagsPorConversa[c.id] || []).includes(filtro.slice(4));
    return true; // 'tudo'
  }

  // ---- Busca ampla ------------------------------------------------------
  // A busca da lista achava só pelo nome e pelo número do contato. Faltavam as
  // duas formas que mais se usam no dia a dia: procurar pelo que foi DITO na
  // conversa (como no WhatsApp) e procurar pelo CADASTRO — CPF ou número do
  // processo, que é o que o atendente costuma ter em mãos.
  const [achadosMsg, setAchadosMsg] = useState({});   // conversa_id → trecho
  const [achadosCad, setAchadosCad] = useState({});   // conversa_id → motivo
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const termo = busca.trim();
    // Limpa ANTES de consultar, sempre. Sem isso, os achados da busca anterior
    // sobrevivem até a nova responder — e por um instante a lista mostra
    // conversas que não têm nada a ver com o que está escrito na caixa.
    setAchadosMsg({});
    setAchadosCad({});
    if (termo.length < 3) { setBuscando(false); return; }

    let cancelado = false;
    setBuscando(true);
    const tarefa = setTimeout(async () => {
      const ids = conversas.map((c) => c.id);

      // 1) Dentro das mensagens. Em lotes porque a lista de ids vai na URL —
      //    com centenas de conversas de uma vez, a consulta seria recusada.
      const porMsg = {};
      try {
        for (let i = 0; i < ids.length; i += 150) {
          const { data } = await supabase.from("mensagens")
            .select("conversa_id, texto")
            .in("conversa_id", ids.slice(i, i + 150))
            .ilike("texto", `%${termo}%`)
            .order("criado_em", { ascending: false })
            .limit(300);
          (data || []).forEach((m) => {
            if (!porMsg[m.conversa_id]) porMsg[m.conversa_id] = m.texto || "";
          });
        }
      } catch (_e) { /* sem resultado por mensagem; a busca por nome segue */ }

      // 2) No cadastro do Vantoro (nome, CPF, processo) → casa pelo telefone.
      const porCad = {};
      try {
        if (BRIDGE_URL) {
          const { data: sessao } = await supabase.auth.getSession();
          const jwt = sessao?.session?.access_token;
          if (jwt) {
            const r = await fetch(`${BRIDGE_URL}/vantoro/buscar?q=${encodeURIComponent(termo)}`,
              { headers: { Authorization: "Bearer " + jwt } });
            const corpo = await r.json().catch(() => ({}));
            (corpo.clientes || []).forEach((cl) => {
              // Os últimos 8 dígitos são o miolo do número: não mudam com DDD,
              // com o 9 extra nem com o código do país. É por eles que casamos.
              [cl.telefone, cl.telefone2].forEach((tel) => {
                const chave = String(tel || "").replace(/\D/g, "").slice(-8);
                if (chave.length < 8) return;
                conversas.forEach((c) => {
                  if (String(c.contato?.numero || "").endsWith(chave)) {
                    porCad[c.id] = cl.nome;
                  }
                });
              });
            });
          }
        }
      } catch (_e) { /* Vantoro fora do ar não pode atrapalhar a busca local */ }

      if (cancelado) return;
      setAchadosMsg(porMsg);
      setAchadosCad(porCad);
      setBuscando(false);
    }, 350);

    return () => { cancelado = true; clearTimeout(tarefa); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, conversas.length, advogadoId]);

  function casaNaBusca(c) {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    const nome = (c.contato?.nome || c.contato?.numero || "").toLowerCase();
    return nome.includes(termo) || !!achadosMsg[c.id] || !!achadosCad[c.id];
  }

  const conversasFiltradas = conversas.filter((c) =>
    (!!c.arquivada === verArquivadas) && // arquivadas só aparecem na visão de arquivadas
    casaNaBusca(c) &&
    passaNoFiltro(c)
  );

  // Não lidas de cada advogado, para o selo na barra lateral.
  // Para o advogado atual usamos a lista já carregada (que zera a conversa
  // aberta em tempo real); para os demais, o total consultado do banco.
  const naoLidasAtual = conversas.reduce((s, c) => s + (c.arquivada ? 0 : (c.nao_lidas || 0)), 0);
  function naoLidasDoAdvogado(id) {
    return id === advogadoId ? naoLidasAtual : (naoLidasPorAdv[id] || 0);
  }

  // Atendentes que já interagiram nesta conversa (para o grupinho de avatares
  // no topo). Junta quem enviou mensagens e quem escreveu notas.
  const atendentesInteragiram = (() => {
    const mapa = new Map();
    for (const m of mensagens) {
      let nome = null, foto = null;
      if (m.origem === "advogado" && m.enviado_por) { nome = m.enviado_por; foto = m.enviado_por_foto || null; }
      else if (m.origem === "nota" && m.autor) { nome = m.autor; foto = m.autor_foto || null; }
      if (nome && !mapa.has(nome)) mapa.set(nome, { nome, foto });
    }
    return [...mapa.values()];
  })();

  // Menu de mensagens rápidas: aparece ao digitar "/" no começo da mensagem.
  // O texto após a "/" filtra a lista (por atalho ou conteúdo).
  const slashQuery = (!modoNota && rascunho.startsWith("/")) ? rascunho.slice(1).toLowerCase() : null;
  const slashLista = slashQuery !== null
    ? rapidas.filter((r) => (`${r.titulo} ${r.texto}`).toLowerCase().includes(slashQuery))
    : [];
  const slashAberto = slashQuery !== null && slashLista.length > 0;

  // Ocorrências da busca dentro da conversa aberta (ids das mensagens que casam).
  const matchesBusca = (buscaAberta && buscaConversa.trim())
    ? mensagens.filter((m) => (m.texto || "").toLowerCase().includes(buscaConversa.trim().toLowerCase())).map((m) => m.id)
    : [];
  function rolarParaMatch(idx) {
    const id = matchesBusca[idx];
    if (!id) return;
    const el = typeof document !== "undefined" && document.querySelector(`[data-msg-id="${id}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }

  // `100dvh` e não `100vh`. No Safari do iPhone o `vh` é a altura da tela COM a
  // barra do navegador recolhida — uma altura que, na prática, quase nunca é a
  // que se tem. Resultado: os últimos ~90px do painel ficavam embaixo da barra
  // de endereço, e o que mora ali é exatamente a caixa de digitar mensagem. O
  // `dvh` acompanha a barra abrindo e fechando; o `100vh` fica de reserva para
  // navegador que ainda não conheça `dvh`.
  return (
    <div style={{ display: "flex", height: "100vh", maxHeight: "100dvh", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", background: C.headerBar, color: C.textPrimary }}>
      {/* Contorno de foco só para quem navega por teclado (acessibilidade),
          sem "caixa azul" para quem usa o mouse. */}
      <style>{`
        *:focus { outline: none; }
        *:focus-visible { outline: 2px solid ${C.green}; outline-offset: 2px; border-radius: 4px; }
        .sem-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .sem-scrollbar::-webkit-scrollbar { display: none; }

        /* FITA QUE ROLA DE LADO — departamentos, filtros, abas das
           configurações. A barra de rolagem está escondida (é feia numa fita
           de 26px de altura), e sem ela a fita simplesmente CORTAVA o último
           item no meio da palavra: "Acordo fechad|". Quem olha não conclui
           "tem mais coisa para o lado", conclui que a tela está quebrada.

           A sombrinha nas pontas é o truque clássico de duas camadas: as
           "tampas" rolam junto com o conteúdo (background-attachment: local) e
           as sombras ficam paradas (scroll). Encostado na ponta, a tampa cobre
           a sombra e não se vê nada; assim que sobra conteúdo para aquele
           lado, a tampa sai de cima e a sombra aparece. Puro CSS: não custa
           medição nenhuma, nem re-render, e acerta sozinho quando a lista de
           tags muda de tamanho. */
        .fita { overflow-x: auto; }
        /* A BORDA que esmaece. É o último filho da fita e fica GRUDADO na
           direita (position: sticky) — não some com a rolagem e, por ser o
           último irmão, é desenhado POR CIMA das pílulas. Foi por isso que a
           primeira tentativa (uma sombra no fundo da fita) não resolveu: o fundo fica
           atrás do conteúdo, e o conteúdo aqui são pílulas opacas.

           A margem negativa devolve exatamente a largura que ele ocupa, então
           ele não empurra nada: só pinta por cima. E quando não há o que rolar,
           o que ele esmaece é o próprio fundo — ou seja, não se vê nada. */
        .fita-borda {
          position: sticky; right: 0; flex: 0 0 32px; width: 32px;
          margin-left: -32px; align-self: stretch; pointer-events: none;
          background: linear-gradient(to right, transparent, var(--fita-fundo));
        }
      `}</style>
      {/* Barra lateral */}
      <div style={{ width: 60, background: C.rail, display: (estreito && conversaId) ? "none" : "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 8 }}>
        {/* Aqui havia um quadrado verde com a letra "Z". Saiu: era a terceira
            vez que a tela dizia o nome do sistema (o "Zorvin" do cabeçalho e o
            do fundo já dizem), e ocupava justo o alto da barra dos telefones,
            onde o olho procura o primeiro atendente. */}

        {/* Advogados: um avatar por advogado. O atual fica destacado (anel
            verde); quem tem mensagens não lidas ganha um selo vermelho. */}
        {/* O `paddingTop` PRECISA estar aqui dentro, e não na barra.
            Esta caixa rola, e o que rola apara tudo o que passa da borda: o selo
            vermelho fica em `top: -4` (mais 2px de contorno) e o anel verde do
            telefone escolhido vai 2px além do avatar. Com o respiro na barra, do
            lado de fora, a borda de corte caía exatamente no topo do primeiro
            avatar — e o primeiro de cada departamento aparecia lascado.
            8px cobrem os 6 do selo e os 2 do anel; a barra cedeu os mesmos 8,
            então o espaçamento visto continua igual ao de antes. */}
        <div className="sem-scrollbar" style={{ flex: 1, width: "100%", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 8 }}>
          {advogadosVisiveis.map((a) => {
            const n = naoLidasDoAdvogado(a.id);
            const atual = a.id === advogadoId;
            return (
              <button
                key={a.id}
                onClick={() => trocarAdvogado(a.id)}
                title={`${a.nome}${n > 0 ? ` — ${n} não lida${n > 1 ? "s" : ""}` : ""}`}
                style={{ position: "relative", border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "flex", borderRadius: "50%", flexShrink: 0, boxShadow: atual ? `0 0 0 2px ${C.green}` : "none", opacity: atual ? 1 : 0.7, transition: "opacity .12s" }}
              >
                <Avatar nome={a.nome} foto={a.foto_url} size={42} />
                {n > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, minWidth: 19, height: 19, padding: "0 5px", borderRadius: 10, background: "#d92b20", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.rail}`, boxSizing: "border-box" }}>
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Um único ícone de Configurações: perfil, aparência, sair e mensagens
            rápidas ficam todos lá dentro. */}
        {/* MÍDIAS de todas as conversas — o mesmo lugar do WhatsApp Web. */}
        <div onClick={() => abrirMidias()} title="Mídias, documentos e links"
             style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: midiasAberta ? "#fff" : "#aebac1", background: midiasAberta ? "rgba(255,255,255,.12)" : "transparent", cursor: "pointer" }}>
          <Images size={22} />
        </div>
        {/* A engrenagem saiu daqui. Ela e a foto logo abaixo faziam a MESMA
            coisa — abrir as Configurações — coladas uma na outra, e dois botões
            idênticos lado a lado não dão duas opções: dão a dúvida de qual é
            qual. Ficou a foto, que além de abrir também diz quem está entrado.
            O destaque de "configurações abertas" passou para ela. */}
        {/* A FOTO DE QUEM ESTÁ LOGADO, no pé da barra. É onde ela fica em todo
            painel de atendimento, e é o que responde de relance a pergunta que
            aparece quando duas pessoas dividem a mesma máquina: "estou entrada
            como quem?". Clicar abre as configurações, que é onde se troca a
            foto e se sai. */}
        <div onClick={abrirConfig} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirConfig(); } }}
             title={`${meuNome} — configurações`}
             style={{ cursor: "pointer", marginTop: 4, marginBottom: 14, borderRadius: "50%", display: "flex",
                      boxShadow: configAberta ? `0 0 0 2px ${C.green}` : "none" }}>
          <Avatar nome={meuNome} foto={minhaFoto} size={36} />
        </div>
      </div>

      {/* Lista de conversas */}
      {/* Com a ficha aberta a lista sai de cena e devolve os 380px para a
          conversa: o atendente está tratando de uma pessoa só, e as outras
          conversas voltam assim que ele fecha a ficha. */}
      {/* `minWidth: 0` NÃO é enfeite. Item de flex nasce com `min-width: auto`,
          que é "nunca menor que o meu conteúdo" — e no celular isso deixava
          esta coluna com 392px numa tela de 390: a página inteira ganhava
          rolagem lateral e a lista aparecia cortada, sem a hora nem o contador
          de não lidas. Com o zero, ela encolhe para o que sobra (330px) e quem
          rola é só a fita de filtros, que já foi feita para isso. */}
      <div style={{ position: "relative", width: estreito ? "auto" : 380, flex: estreito ? 1 : "none", minWidth: 0, borderRight: `1px solid ${C.divider}`, display: ((estreito && conversaId) || fichaAberta) ? "none" : "flex", flexDirection: "column", background: C.panel }}>
        {/* NOVA CONVERSA (⊞) — estilo WhatsApp Web: busca, novo contato e agenda */}
        {novaConversaAberta && (
          <div style={{ position: "absolute", inset: 0, zIndex: 40, background: C.panel, display: "flex", flexDirection: "column" }}>
            <div style={{ background: C.headerBar, padding: "16px 16px", display: "flex", alignItems: "center", gap: 18, borderBottom: `1px solid ${C.divider}` }}>
              <button onClick={() => { setNovaConversaAberta(false); setContatoForm(null); setBuscaContato(""); }} title="Voltar" style={BOTAO_ICONE}><ArrowLeft size={20} color={C.textSecondary} /></button>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Nova conversa</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {contatoForm ? (
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Novo contato</div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>NOME</label>
                    <input autoFocus value={contatoForm.nome} onChange={(e) => setContatoForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: João Silva" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>NÚMERO (com DDD, ex.: 5511999999999)</label>
                    <input value={contatoForm.numero} onChange={(e) => setContatoForm((f) => ({ ...f, numero: e.target.value }))} placeholder="5511999999999" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setContatoForm(null)} style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={criarContatoEConversar} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar e conversar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderRadius: 8, padding: "6px 12px" }}>
                      <Search size={16} color={C.textSecondary} />
                      <input autoFocus value={buscaContato} onChange={(e) => setBuscaContato(e.target.value)} placeholder="Pesquisar nome ou número" style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: C.textPrimary }} />
                    </div>
                  </div>
                  <button onClick={() => setContatoForm({ nome: "", numero: numeroDeTexto(buscaContato) })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UserPlus size={20} color="#fff" /></span>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>Novo contato</span>
                  </button>
                  {numeroDeTexto(buscaContato) && !contatosLista.some((c) => (c.numero || "").includes(numeroDeTexto(buscaContato))) && (
                    <button onClick={() => conversarComNumero(buscaContato)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary }}>
                      <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MessageSquarePlus size={20} color="#fff" /></span>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>Conversar com +{numeroDeTexto(buscaContato)}</span>
                    </button>
                  )}
                  <div style={{ padding: "10px 16px 4px", fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>CONTATOS</div>
                  {(() => {
                    const q = buscaContato.trim().toLowerCase();
                    const qDig = q.replace(/\D/g, ""); // só os dígitos (para busca por número)
                    // Busca por nome OU por número. O número só entra no filtro se
                    // a pessoa digitou algum dígito — senão "inclui vazio" daria
                    // verdadeiro para todos e a busca por nome nunca filtrava.
                    const lista = contatosLista.filter((c) => (c.nome || "").toLowerCase().includes(q) || (qDig && (c.numero || "").includes(qDig)));
                    if (!lista.length) return <div style={{ padding: 20, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>{contatosLista.length ? "Nenhum contato encontrado." : "Nenhum contato salvo ainda."}</div>;
                    return lista.map((c) => (
                      <div key={c.id} role="button" onClick={() => abrirConversaContato(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", color: C.textPrimary }} onMouseEnter={(e) => { e.currentTarget.style.background = C.divider; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        <Avatar nome={c.nome || c.numero} foto={c.foto_url} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDoContato(c)}</div>
                          <div style={{ fontSize: 12.5, color: C.textSecondary }}>+{c.numero}</div>
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}
            </div>
          </div>
        )}
        <div style={{ background: C.headerBar, padding: "10px 16px 12px", borderBottom: `1px solid ${C.divider}` }}>
          {/* O NOME DO SISTEMA, e não o de quem está logado. Quem está logado
              já se vê no rodapé da barra da esquerda, e ali com a foto — dizer
              "Você: Fulano" no topo era gastar a linha mais nobre da tela com o
              único dado que a pessoa nunca precisa consultar. */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.divider}` }}>
            {/* A MARCA — o desenho mora em `Marca.jsx`, porque ela também
                aparece na tela de entrada e no fundo sem conversa, e três
                cópias soltas foi como o topo acabou em serifada enquanto a
                entrada estava em sem serifa.

                Agora cabe numa linha só: a linha que sobrou desceu para a
                lista de conversas, que é o que a pessoa veio ver. */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", overflow: "hidden" }}>
              <Marca tamanho={19} cor={C.textPrimary} corFraca={C.textSecondary} />
            </div>
            {/* Nova conversa (⊞), estilo WhatsApp Web */}
            <button onClick={() => { setBuscaContato(""); setContatoForm(null); setNovaConversaAberta(true); carregarContatos(); }} aria-label="Nova conversa" title="Nova conversa" style={{ ...BOTAO_ICONE, color: C.textSecondary }}>
              <SquarePen size={19} />
            </button>
            {/* Menu ⋮ do topo, estilo WhatsApp Web */}
            <span ref={menuTopoRef} style={{ position: "relative", display: "flex" }}>
              <button onClick={() => setMenuTopoAberto((v) => !v)} aria-label="Menu" title="Menu" style={{ ...BOTAO_ICONE, color: C.textSecondary }}>
                <MoreVertical size={20} />
              </button>
              {menuTopoAberto && (
                <div style={{ position: "absolute", top: 26, right: 0, width: 230, background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.28)", zIndex: 50, overflow: "hidden" }}>
                  <button onClick={marcarTodasLidas} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><CheckCheck size={17} color={C.textSecondary} /> Marcar todas como lidas</button>
                  <button onClick={() => { setMenuTopoAberto(false); abrirConfig(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><Settings size={17} color={C.textSecondary} /> Configurações</button>
                  {/* Quem administra no Vantoro administra aqui. Esconder o botão
                      é cortesia, não segurança: quem não é admin esbarra nas
                      regras do banco de qualquer forma. */}
                  {souAdmin && (
                    <button onClick={() => { setMenuTopoAberto(false); setTelaAdmin(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><ShieldCheck size={17} color={C.textSecondary} /> Departamentos e acessos</button>
                  )}
                  {/* Duas conversas que são a MESMA coisa — o caso do grupo que
                      nasceu partido. A junção automática só alcança o que ela
                      reconhece e só roda quando chega mensagem nova; aqui quem
                      OLHA a tela aponta as duas, e não há o que adivinhar. */}
                  {souAdmin && (
                    <button onClick={() => { setMenuTopoAberto(false); setJuntar({ de: "", para: "", indo: false }); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><MessageSquarePlus size={17} color={C.textSecondary} /> Juntar duas conversas</button>
                  )}
                  <div style={{ height: 1, background: C.divider }} />
                  <button onClick={() => { setMenuTopoAberto(false); sair(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: "#e5573f", fontSize: 14, fontWeight: 600, textAlign: "left" }}><LogOut size={17} /> Desconectar</button>
                </div>
              )}
            </span>
          </div>
          {/* Seletor de DEPARTAMENTO. Aparece quando a pessoa alcança mais de
              um — com um só, o botão não teria para onde levar. Quem alcança o
              quê é decidido pelo banco (as permissões), não por esta tela. */}
          {departamentosVisiveis.length > 1 && (
            <div className="sem-scrollbar fita" style={{ display: "flex", gap: 6, marginBottom: 10, "--fita-fundo": C.headerBar }}>
              {departamentosVisiveis.map((d) => {
                const ativo = departamentoId === d.id;
                return (
                  <button key={d.id} onClick={() => trocarDepartamento(d.id)} title={d.nome}
                    /* O departamento escolhido é SEMPRE o mesmo verde, e não a
                       cor cadastrada dele. A cor mudando a cada troca fazia o
                       topo da tela mudar de cor sem que nada de importante
                       tivesse mudado — e verde, azul e dourado no mesmo lugar
                       não significam nada: quem escolhe é a pessoa, não o
                       sistema avisando de algo. A cor de cada departamento
                       continua no banco e continua servindo onde ela de fato
                       identifica um: no pontinho ao lado do nome. */
                    style={{ flex: "1 0 auto", minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${ativo ? C.greenDark : C.divider}`, background: ativo ? C.greenDark : "transparent", color: ativo ? "#fff" : C.textSecondary, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {d.cor && !ativo && <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />}
                    {d.nome}
                  </button>
                );
              })}
              <span aria-hidden className="fita-borda" />
            </div>
          )}
          <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600, letterSpacing: 0.3 }}>ATENDENDO COMO</div>
          {/* Nome e número na MESMA linha. Quem encolhe é o nome (`minWidth: 0`
              com reticências); o número fica inteiro (`flexShrink: 0`) porque é
              o dado que se copia — meio número não serve para nada, e um nome
              cortado ainda se reconhece. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {advogado ? advogado.nome : "—"}
            </span>
            {advogado && numeroBonito(advogado.numero) && (
              <span style={{ fontSize: 12.5, color: C.textSecondary, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {numeroBonito(advogado.numero)}
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: "8px 12px", background: C.panel }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderRadius: 8, padding: "6px 12px" }}>
            <Search size={16} color={C.textSecondary} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, mensagem, CPF ou processo" style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: C.textPrimary }} />
          </div>
        </div>

        {/* AS ABAS DE FILTRO.
            As etiquetas saíram da fita e viraram um menu. A fita rolava de
            lado e cortava a última pílula NO MEIO — e uma cápsula de contorno
            colorido fatiada não se lê como "tem mais para o lado", se lê como
            tela quebrada. Esmaecer a borda não resolveu: o traço colorido
            atravessa o esmaecido e termina em seco.

            Com três pílulas fixas mais uma de etiquetas, a linha CABE, e o que
            não couber quebra para baixo (`wrap`) em vez de ser cortado. E o
            menu resolve um problema que a fita tinha de nascença: etiqueta que
            ficava depois da dobra era invisível — para filtrar por ela, a
            pessoa precisava adivinhar que dava para arrastar. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px 8px", background: C.panel }}>
          {[["tudo", "Tudo"], ["naolidas", `Não lidas${totalNaoLidasLista ? " " + totalNaoLidasLista : ""}`], ["favoritas", "Favoritas"]].map(([k, label]) => {
            const ativo = filtro === k;
            return (
              <button key={k} onClick={() => setFiltro(k)} style={{ flexShrink: 0, minHeight: 32, border: `1px solid ${ativo ? C.greenDark : C.divider}`, background: ativo ? C.greenDark : "transparent", color: ativo ? "#fff" : C.textSecondary, borderRadius: 20, padding: "5px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
            );
          })}
          {/* A pílula das etiquetas. Quando há uma escolhida, ela mostra a cor e
              o nome da etiqueta — é o que responde "por que a lista está
              curta?" sem precisar abrir nada. */}
          <span ref={etiquetasRef} style={{ position: "relative", display: "flex", minWidth: 0 }}>
            <button onClick={() => setMenuEtiquetas((v) => !v)}
                    title={tagFiltrada ? `Filtrando por "${tagFiltrada.nome}"` : "Filtrar por etiqueta"}
                    style={{ flexShrink: 1, minWidth: 0, maxWidth: 190, minHeight: 32, border: `1px solid ${tagFiltrada ? tagFiltrada.cor : C.divider}`, background: tagFiltrada ? tagFiltrada.cor : "transparent", color: tagFiltrada ? corDoTextoSobre(tagFiltrada.cor) : C.textSecondary, borderRadius: 20, padding: "5px 11px 5px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tagFiltrada ? tagFiltrada.nome : "Etiquetas"}
              </span>
              <ChevronDown size={14} style={{ flexShrink: 0, opacity: .8 }} />
            </button>
            {menuEtiquetas && (
              <div style={{ position: "absolute", top: 38, left: 0, zIndex: 40, width: 250, maxHeight: 320, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
                <button onClick={() => { setFiltro("tudo"); setMenuEtiquetas(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                  Todas as conversas
                  {!tagFiltrada && <Check size={16} color={C.green} style={{ marginLeft: "auto" }} />}
                </button>
                {tags.length === 0 && (
                  <div style={{ padding: 14, fontSize: 13, color: C.textSecondary, textAlign: "center" }}>Nenhuma etiqueta ainda.</div>
                )}
                {tags.map((t) => {
                  const escolhida = filtro === "tag:" + t.id;
                  return (
                    <button key={t.id} onClick={() => { setFiltro(escolhida ? "tudo" : "tag:" + t.id); setMenuEtiquetas(false); }}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                      <span style={{ width: 11, height: 11, borderRadius: 3, background: t.cor, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</span>
                      {escolhida && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })}
                <button onClick={() => { setMenuEtiquetas(false); setAbaConfig("tags"); setTagForm(null); setConfigAberta(true); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", border: "none", borderTop: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.verdeTexto, fontSize: 13, fontWeight: 600 }}>
                  <Plus size={15} /> Gerenciar etiquetas
                </button>
              </div>
            )}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Cabeçalho da visão "Arquivadas" (botão de voltar) */}
          {verArquivadas && (
            <div onClick={() => setVerArquivadas(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer", background: C.headerBar }}>
              <ArrowLeft size={18} color={C.textSecondary} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>Arquivadas</span>
            </div>
          )}
          {/* Atalho para as arquivadas (estilo WhatsApp Web), no topo da lista */}
          {!verArquivadas && totalArquivadas > 0 && !busca && (
            <div onClick={() => setVerArquivadas(true)} role="button" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: `1px solid ${C.divider}`, cursor: "pointer", color: C.textPrimary }}>
              <Archive size={20} color={C.green} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>Arquivadas</span>
              <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>{totalArquivadas}</span>
            </div>
          )}
          {conversasFiltradas.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>{verArquivadas ? "Nenhuma conversa arquivada." : "Nenhuma conversa ainda."}</div>
          )}
          {conversasFiltradas.map((c) => {
            const nome = nomeDoContato(c.contato);
            // Prévia: se a última mensagem é mídia (e sem legenda), mostra
            // "📷 Foto", "🎤 Mensagem de voz" etc. em vez de "[anexo]".
            const midiaTipo = ultimasMidias[c.id];
            const bruto = c.ultima_mensagem || "";
            const previa = midiaTipo && (bruto === "[anexo]" || bruto === "") ? rotuloMidia(midiaTipo) : bruto;
            return (
              <div key={c.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); naoLidasRef.current = c.nao_lidas || 0; setConversaId(c.id); } }} onClick={() => { naoLidasRef.current = c.nao_lidas || 0; setConversaId(c.id); }} onMouseEnter={() => setConvHover(c.id)} onMouseLeave={() => setConvHover((h) => (h === c.id ? null : h))} style={{ position: "relative", width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: c.id === conversaId ? C.listActive : (convHover === c.id ? C.divider : C.panel), borderBottom: `1px solid ${C.divider}`, cursor: "pointer", color: C.textPrimary }}>
                <Avatar nome={nome} foto={c.contato?.foto_url} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      {c.favorita && <Star size={13} color="#f5c518" fill="#f5c518" style={{ flexShrink: 0 }} />}
                      <span style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                    </span>
                    <span style={{ fontSize: 11, color: c.nao_lidas ? C.horaNaoLida : C.textSecondary, flexShrink: 0 }}>{horaDe(c.ultima_atividade)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    {digitandoAtivo(c.id) ? (
                      <span style={{ fontSize: 13, color: C.verdeTexto, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250 }}>digitando…</span>
                    ) : (
                      <span style={{ fontSize: 13, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250 }}>{previa}</span>
                    )}
                    {/* O alfinete precisa aparecer: sem ele a conversa fixada
                        fica no alto da lista sem nenhuma explicação visível, e
                        a lista passa a parecer simplesmente fora de ordem. */}
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {c.fixada && <Pin size={13} color={C.textSecondary} fill={C.textSecondary} style={{ transform: "rotate(45deg)" }} />}
                      {c.nao_lidas > 0 && <span style={{ background: C.unread, color: "#fff", borderRadius: 12, fontSize: 11, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.nao_lidas}</span>}
                    </span>
                  </div>
                  {/* Por que esta conversa apareceu na busca. Sem isso, um
                      resultado que casou pelo texto de uma mensagem antiga
                      parece ter vindo do nada. */}
                  {busca.trim().length >= 3 && (achadosMsg[c.id] || achadosCad[c.id]) &&
                   !(c.contato?.nome || c.contato?.numero || "").toLowerCase().includes(busca.trim().toLowerCase()) && (
                    <div style={{ marginTop: 3, fontSize: 11.5, color: C.verdeTexto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                      {achadosMsg[c.id]
                        ? '💬 ' + achadosMsg[c.id]
                        : '🗂 ' + achadosCad[c.id]}
                    </div>
                  )}
                  {tagsDaConversa(c.id).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {tagsDaConversa(c.id).map((t) => (
                        <span key={t.id} style={{ fontSize: 10.5, fontWeight: 600, color: corDoTextoSobre(t.cor), background: t.cor, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>{t.nome}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Botão do menuzinho (sempre visível, realça no hover — funciona no toque) */}
                {/* O "⌄" das opções da conversa. Era desenhado POR CIMA da linha
                    (position:absolute, canto superior direito) e caía em cima da
                    hora — 16px de sobreposição em toda conversa da lista, nos
                    dois temas, com o horário riscado por um chevron meio
                    transparente. Aqui ele é um irmão do bloco de texto: ocupa a
                    sua faixa e não tem como cobrir nada. */}
                <button aria-label="Opções da conversa" onClick={(e) => { e.stopPropagation(); setMenuConversa(menuConversa === c.id ? null : c.id); }} title="Opções" style={{ alignSelf: "center", flexShrink: 0, border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6, marginRight: -6, color: C.textSecondary, opacity: (convHover === c.id || menuConversa === c.id) ? 1 : 0.6, transition: "opacity .12s" }}>
                  <ChevronDown size={18} color={C.textSecondary} />
                </button>
                {menuConversa === c.id && (
                  <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 32, right: 8, background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,.3)", zIndex: 30, overflow: "hidden", minWidth: 190 }}>
                    <button onClick={(e) => { e.stopPropagation(); marcarNaoLida(c, !(c.nao_lidas > 0)); }} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: C.panel, cursor: "pointer", color: C.textPrimary, fontSize: 14 }}>
                      {c.nao_lidas > 0 ? "Marcar como lida" : "Marcar como não lida"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); alternarFixada(c); }} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: C.panel, cursor: "pointer", color: C.textPrimary, fontSize: 14 }}>
                      {c.fixada ? "Desafixar" : "Fixar no topo"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); alternarFavorita(c); }} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: C.panel, cursor: "pointer", color: C.textPrimary, fontSize: 14 }}>
                      {c.favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); alternarArquivada(c, !c.arquivada); }} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderTop: `1px solid ${C.divider}`, background: C.panel, cursor: "pointer", color: C.textPrimary, fontSize: 14 }}>
                      {c.arquivada ? "Desarquivar" : "Arquivar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversa */}
      {/* Mesmo motivo da coluna da lista: sem `minWidth: 0` a conversa aberta
          no celular fica mais larga que a tela por causa de uma mensagem
          comprida. */}
      <div style={{ flex: 1, minWidth: 0, display: ((estreito && !conversaId) || (estreito && fichaAberta)) ? "none" : "flex", flexDirection: "column", background: C.chatBg, backgroundImage: modo === "escuro" ? PADRAO_CHAT_ESCURO : PADRAO_CHAT_CLARO, position: "relative" }}>
        {!conversa ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.textSecondary, gap: 16 }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", background: C.placeholderCircle, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={44} color={C.textSecondary} />
            </div>
            <Marca tamanho={22} cor={C.textPrimary} corFraca={C.textSecondary} />
            <div style={{ fontSize: 14, maxWidth: 380, textAlign: "center", lineHeight: 1.5 }}>
              Selecione uma conversa à esquerda para começar a atender{advogado ? <> as conversas de <b>{advogado.nome}</b></> : ""}.
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: C.headerBar, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.divider}` }}>
              {estreito && (
                <button onClick={() => setConversaId(null)} title="Voltar" style={BOTAO_ICONE}>
                  <ArrowLeft size={20} color={C.textSecondary} />
                </button>
              )}
              <div onClick={() => setInfoAberta(true)} title="Ver dados do contato" style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer", minWidth: 0 }}>
              <Avatar nome={conversa.contato?.nome || conversa.contato?.numero} foto={conversa.contato?.foto_url} size={40} />
              {/* TUDO AQUI DENTRO CABE EM UMA LINHA CADA.
                  Sem as reticências, "Maria Aparecida da Silva Nascimento"
                  quebrava em QUATRO linhas no celular, as tags quebravam em
                  mais duas, e o cabeçalho passava de 290px — um terço da tela
                  gasto para dizer com quem se está falando, empurrando a
                  conversa para fora. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDoContato(conversa.contato)}</div>
                {digitandoAtivo(conversa.id) ? (
                  <div style={{ fontSize: 12, color: C.verdeTexto, fontWeight: 600 }}>digitando…</div>
                ) : atendidoPorOutro(conversa.id) ? (
                  <div style={{ fontSize: 12, color: modo === "escuro" ? "#e0a400" : "#8a6d00", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} /> {atendidoPorOutro(conversa.id)} também está nesta conversa
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>via {comNumero(advogado)}</div>
                )}
                {!estreito && tagsDaConversa(conversa.id).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, overflow: "hidden" }}>
                    {tagsDaConversa(conversa.id).map((t) => (
                      <span key={t.id} style={{ fontSize: 10.5, fontWeight: 600, color: corDoTextoSobre(t.cor), background: t.cor, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: t.nome.length > 12 ? 1 : 0 }}>{t.nome}</span>
                    ))}
                  </div>
                )}
              </div>
              </div>
              {/* MARCAR COMO LIDA — só aparece quando há o que marcar.
                  Responder o contato já marca sozinho; este botão é para o
                  outro caso, o de "olhei, não precisa de resposta, resolvido".
                  Sem ele, uma conversa que não pede resposta ficaria com o selo
                  vermelho para sempre.
                  No computador vem com a palavra escrita: um tique sozinho não
                  diz o que faz, e este botão apaga um aviso que a equipe
                  inteira está vendo. No celular fica só o tique, por espaço,
                  mas com o mesmo `title`. */}
              {(conversa.nao_lidas || 0) > 0 && (
                <button onClick={() => marcarLida(conversa.id)}
                        title="Marcar esta conversa como lida"
                        style={{ ...BOTAO_ICONE, padding: estreito ? 7 : "7px 11px", gap: 6,
                                 background: C.searchBg, color: C.verdeTexto,
                                 fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                  <CheckCheck size={17} />
                  {!estreito && "Marcar como lida"}
                </button>
              )}
              {/* Ficha do cliente no Vantoro (cadastro, esteira, processos) */}
              <button onClick={() => setFichaAberta((v) => !v)}
                      title="Ficha do cliente no Vantoro"
                      style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10, background: fichaAberta ? C.listActive : "transparent" }}>
                <ClipboardList size={19} color={fichaAberta ? C.green : C.textSecondary} />
              </button>
              {/* Avatares dos atendentes que já interagiram com este contato */}
              {!estreito && atendentesInteragiram.length > 0 && (
                <div title={`Já atenderam este contato: ${atendentesInteragiram.map((a) => a.nome).join(", ")}`} style={{ display: "flex", alignItems: "center", marginRight: 2 }}>
                  {atendentesInteragiram.slice(0, 4).map((a, idx) => (
                    <div key={a.nome} style={{ marginLeft: idx === 0 ? 0 : -8, borderRadius: "50%", border: `2px solid ${C.headerBar}`, display: "flex" }}>
                      <Avatar nome={a.nome} foto={a.foto} size={26} />
                    </div>
                  ))}
                  {atendentesInteragiram.length > 4 && (
                    <div style={{ marginLeft: -8, width: 26, height: 26, borderRadius: "50%", background: C.divider, color: C.textSecondary, fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.headerBar}` }}>+{atendentesInteragiram.length - 4}</div>
                  )}
                </div>
              )}
              {/* Etiquetar a conversa: abre um menu para marcar/desmarcar tags */}
              <span ref={tagMenuRef} style={{ position: "relative", display: "flex" }}>
                <button aria-label="Etiquetas" onClick={() => setTagMenuAberto((v) => !v)} title="Etiquetas (tags)" style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10 }}>
                  <Tag size={19} color={tagMenuAberto || (tagsPorConversa[conversa.id] || []).length ? C.green : C.textSecondary} />
                </button>
                {tagMenuAberto && (
                  <div style={{ position: "absolute", top: 30, right: 0, width: 240, maxHeight: 320, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.25)", zIndex: 46 }}>
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.divider}`, fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3, position: "sticky", top: 0, background: C.panel }}>MARCAR TAGS</div>
                    {tags.length === 0 && (
                      <div style={{ padding: 14, fontSize: 13, color: C.textSecondary, textAlign: "center" }}>Nenhuma tag ainda. Crie em Configurações → Tags.</div>
                    )}
                    {tags.map((t) => {
                      const marcada = (tagsPorConversa[conversa.id] || []).includes(t.id);
                      return (
                        <button key={t.id} onClick={() => alternarTagConversa(t.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, textAlign: "left" }}>
                          <span style={{ width: 12, height: 12, borderRadius: 3, background: t.cor, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13.5 }}>{t.nome}</span>
                          {marcada && <Check size={16} color={C.green} />}
                        </button>
                      );
                    })}
                    <button onClick={() => { setTagMenuAberto(false); setAbaConfig("tags"); setTagForm(null); setConfigAberta(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", border: "none", borderTop: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.verdeTexto, fontSize: 13, fontWeight: 600 }}><Plus size={15} /> Gerenciar tags</button>
                  </div>
                )}
              </span>
              <button aria-label="Buscar na conversa" onClick={() => setBuscaAberta((v) => !v)} title="Buscar na conversa" style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10 }}>
                <Search size={19} color={buscaAberta ? C.green : C.textSecondary} />
              </button>
            </div>

            {infoAberta && (
              <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: estreito ? "100%" : 360, background: C.panel, borderLeft: `1px solid ${C.divider}`, zIndex: 45, display: "flex", flexDirection: "column", boxShadow: "-2px 0 12px rgba(0,0,0,.15)" }}>
                <div style={{ background: C.headerBar, padding: "14px 16px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${C.divider}` }}>
                  <button onClick={() => setInfoAberta(false)} title="Fechar" style={BOTAO_ICONE}>
                    <X size={22} color={C.textSecondary} />
                  </button>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Dados do contato</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px", gap: 10 }}>
                  <div onClick={() => { if (conversa.contato?.foto_url) setImagemAberta(conversa.contato.foto_url); }} style={{ cursor: conversa.contato?.foto_url ? "pointer" : "default" }}>
                    <Avatar nome={conversa.contato?.nome || conversa.contato?.numero} foto={conversa.contato?.foto_url} size={150} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, textAlign: "center", marginTop: 6 }}>{nomeDoContato(conversa.contato)}</div>
                  <div style={{ fontSize: 15, color: C.textSecondary }}>{String(conversa.contato?.numero || "").startsWith("grupo:") ? "Grupo" : ("+" + conversa.contato?.numero)}</div>
                  <div style={{ width: "100%", borderTop: `1px solid ${C.divider}`, marginTop: 14, paddingTop: 16 }}>
                    <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600, letterSpacing: 0.3 }}>ATENDIDO POR</div>
                    <div style={{ fontSize: 15, marginTop: 4 }}>{advogado?.nome || "—"}</div>
                  </div>
                </div>
              </div>
            )}

            {buscaAberta && (
              <div style={{ background: C.headerBar, padding: "0 16px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderRadius: 8, padding: "6px 12px" }}>
                  <Search size={16} color={C.textSecondary} />
                  <input autoFocus value={buscaConversa} onChange={(e) => setBuscaConversa(e.target.value)} placeholder="Buscar nesta conversa" style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: C.textPrimary }} />
                  {buscaConversa.trim() && (
                    <>
                      <span style={{ fontSize: 12, color: C.textSecondary, minWidth: 46, textAlign: "right" }}>
                        {matchesBusca.length ? `${Math.min(buscaIdx, matchesBusca.length - 1) + 1} de ${matchesBusca.length}` : "0"}
                      </span>
                      <button title="Anterior" disabled={!matchesBusca.length} onClick={() => { const i = Math.max(0, buscaIdx - 1); setBuscaIdx(i); rolarParaMatch(i); }} style={{ border: "none", background: "transparent", cursor: matchesBusca.length ? "pointer" : "default", display: "flex", padding: 0 }}>
                        <ChevronUp size={18} color={C.textSecondary} />
                      </button>
                      <button title="Próxima" disabled={!matchesBusca.length} onClick={() => { const i = Math.min(matchesBusca.length - 1, buscaIdx + 1); setBuscaIdx(i); rolarParaMatch(i); }} style={{ border: "none", background: "transparent", cursor: matchesBusca.length ? "pointer" : "default", display: "flex", padding: 0 }}>
                        <ChevronDown size={18} color={C.textSecondary} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div ref={listaRef} onScroll={aoRolar} style={{ flex: 1, overflowY: "auto", padding: estreito ? "16px 10px" : "20px 8%", display: "flex", flexDirection: "column", gap: 6 }}>
              {/* O degrau para subir no histórico. A conversa abre com as
                  últimas mensagens; o resto vem daqui, um lote por vez. Um
                  botão e não rolagem automática: rolar para cima é também o
                  gesto de quem só quer reler o que acabou de acontecer, e
                  carregar sozinho puxaria a tela debaixo do dedo dessa pessoa. */}
              {temMaisAntigas && (
                <button onClick={carregarAntigas} disabled={buscandoAntigas}
                        style={{ alignSelf: "center", marginBottom: 6, border: `1px solid ${C.divider}`, background: C.panel, color: C.textSecondary, borderRadius: 20, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: buscandoAntigas ? "default" : "pointer" }}>
                  {buscandoAntigas ? "Buscando…" : "↑ Carregar mensagens anteriores"}
                </button>
              )}
              {mensagens.map((m, i) => {
                const saida = m.origem === "advogado";
                const anterior = mensagens[i - 1];
                const novoDia =
                  !anterior || new Date(anterior.criado_em).toDateString() !== new Date(m.criado_em).toDateString();
                const mesmoRemetente = anterior && !novoDia && anterior.origem === m.origem;
                const q = buscaAberta ? buscaConversa.trim().toLowerCase() : "";
                const casa = q && (m.texto || "").toLowerCase().includes(q);
                // Mostra o nome de quem enviou: sempre nas ENVIADAS (qual
                // atendente respondeu) e também nas RECEBIDAS quando é um GRUPO
                // (para saber qual participante escreveu, como no WhatsApp).
                const ehGrupoConversa = String(conversa?.contato?.numero || "").startsWith("grupo:");
                const mostrarAutor = (saida || ehGrupoConversa) && !!m.enviado_por;
                // Última mensagem de uma sequência do mesmo remetente: recebe o
                // avatarzinho à direita (como o WhatsApp mostra a foto do grupo).
                const proxima = mensagens[i + 1];
                const ultimaDoGrupo = !proxima || proxima.origem !== m.origem ||
                  proxima.enviado_por !== m.enviado_por ||
                  new Date(proxima.criado_em).toDateString() !== new Date(m.criado_em).toDateString();
                return (
                  <React.Fragment key={m.id}>
                    {novoDia && (
                      <div style={{ alignSelf: "center", background: C.bubbleIn, color: C.textSecondary, fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, boxShadow: "0 1px 0.5px rgba(0,0,0,.15)", margin: "10px 0 6px" }}>
                        {rotuloData(m.criado_em)}
                      </div>
                    )}
                    {idDivisorNaoLidas === m.id && (
                      <div style={{ alignSelf: "center", background: C.bubbleIn, color: C.verdeTexto, fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 8, boxShadow: "0 1px 0.5px rgba(0,0,0,.15)", margin: "8px 0" }}>
                        MENSAGENS NÃO LIDAS
                      </div>
                    )}
                    {m.origem === "nota" ? (
                      // NOTA INTERNA — comentário da equipe (não vai ao WhatsApp).
                      // Alinhada à direita, com cabeçalho (autor • hora) + avatar,
                      // bolha laranja e rodapé "Mensagem interna".
                      <div data-msg-id={m.id} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 6, marginTop: 4 }}>
                        <div style={{ maxWidth: estreito ? "88%" : "70%", display: "flex", flexDirection: "column", alignItems: "flex-end", opacity: m._status === "enviando" ? 0.7 : 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, marginRight: 2 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: corNome(m.autor, modo) }}>{m.autor || "equipe"}</span>
                            <span style={{ fontSize: 11, color: C.textSecondary }}>• {horaCurta(m.criado_em)}</span>
                          </div>
                          <div style={{ background: "#a35e0c", color: "#fff", borderRadius: 8, padding: "7px 11px 6px", boxShadow: "0 1px 0.5px rgba(0,0,0,.2)", minWidth: 120 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 1 }}>{m.autor || "equipe"}:</div>
                            <div style={{ fontSize: 14, lineHeight: 1.35, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{formatarTexto(m.texto, "#fff3d6")}</div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 10.5, color: "rgba(255,255,255,.85)", marginTop: 3 }}>
                              <StickyNote size={11} /> Mensagem interna{m._status === "enviando" ? " · salvando…" : ""}
                            </div>
                          </div>
                        </div>
                        <div style={{ width: 28, flexShrink: 0 }}><Avatar nome={m.autor || "equipe"} foto={m.autor_foto || (m.autor === meuNome ? minhaFoto : null)} size={28} /></div>
                      </div>
                    ) : (
                    <div data-msg-id={m.id} onMouseEnter={() => setMsgHover(m.id)} onMouseLeave={() => setMsgHover((h) => (h === m.id ? null : h))} style={{ display: "flex", justifyContent: saida ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6, marginTop: mesmoRemetente ? -4 : 0 }}>
                      <div style={{ position: "relative", maxWidth: estreito ? "84%" : "65%", background: saida ? C.bubbleOut : C.bubbleIn, color: C.textPrimary, borderRadius: 8, padding: m.tipo === "imagem" ? 4 : "6px 9px 8px", boxShadow: "0 1px 0.5px rgba(0,0,0,.15)", outline: casa ? "2px solid #f4c430" : "none" }}>
                        {mostrarAutor && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: corNome(m.enviado_por, modo), marginBottom: 1 }}>{m.enviado_por}</div>
                        )}
                        {m.id_uazapi && (
                          <button onClick={() => iniciarResposta(m)} title="Responder" style={{ position: "absolute", top: 3, right: 3, border: "none", background: "transparent", cursor: "pointer", opacity: (estreito || msgHover === m.id) ? 0.75 : 0, transition: "opacity .12s", display: "flex", padding: 0 }}>
                            <Reply size={14} color={C.textSecondary} />
                          </button>
                        )}
                        {m.resposta_previa && (
                          <div style={{ borderLeft: `3px solid ${C.green}`, background: saida ? "rgba(0,0,0,.06)" : C.searchBg, borderRadius: 4, padding: "3px 8px", marginBottom: 4 }}>
                            <div style={{ color: C.verdeTexto, fontWeight: 600, fontSize: 12 }}>{m.resposta_autor === "advogado" ? "Você" : (conversa.contato?.nome || "Contato")}</div>
                            <div style={{ color: C.textSecondary, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{m.resposta_previa}</div>
                          </div>
                        )}
                        {m.tipo === "imagem" && m.midia_url && (
                          // Um `button` de verdade em volta da imagem. Como
                          // `<img onClick>` solto, ela abria no clique e não
                          // abria de jeito nenhum pelo teclado — e o leitor de
                          // tela anunciava "imagem", não "abrir imagem".
                          <button onClick={() => setImagemAberta(m.midia_url)} aria-label="Abrir a imagem em tela cheia"
                                  style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "block", borderRadius: 6 }}>
                            <img src={m.midia_url} alt="Imagem recebida na conversa" loading="lazy" decoding="async" onLoad={() => { if (pertoDoFim) fimRef.current?.scrollIntoView(); }} style={{ maxWidth: "min(260px, 62vw)", maxHeight: 320, width: "auto", height: "auto", borderRadius: 6, display: "block" }} />
                          </button>
                        )}
                        {m.tipo === "audio" && <BolhaAudio C={C} saida={saida} url={m.midia_url} />}
                        {m.tipo === "video" && m.midia_url && (
                          <video controls preload="none" src={m.midia_url} style={{ maxWidth: "min(260px, 62vw)", borderRadius: 6, display: "block" }} />
                        )}
                        {m.tipo === "documento" && (
                          m.midia_url ? (
                            <a href={m.midia_url} target="_blank" rel="noopener noreferrer" download style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: C.textPrimary, background: saida ? "rgba(0,0,0,.06)" : C.searchBg, borderRadius: 6, padding: "8px 10px", minWidth: 180 }}>
                              <FileText size={22} color={C.textSecondary} />
                              <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{m.midia_nome || "Documento"}</span>
                              <Download size={16} color={C.textSecondary} />
                            </a>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textPrimary, background: saida ? "rgba(0,0,0,.06)" : C.searchBg, borderRadius: 6, padding: "8px 10px", minWidth: 180 }}>
                              <FileText size={22} color={C.textSecondary} />
                              <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{m.midia_nome || "Documento"}</span>
                              <span style={{ fontSize: 11, color: C.textSecondary, fontStyle: "italic", flexShrink: 0 }}>indisponível</span>
                            </div>
                          )
                        )}
                        {m.texto && <div style={{ fontSize: 14.2, lineHeight: 1.35, paddingRight: 42, marginTop: m.tipo !== "texto" ? 4 : 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{formatarTexto(m.texto, C.link)}</div>}
                        <div style={{ fontSize: 11, color: m._status === "erro" ? "#e53935" : C.textSecondary, textAlign: "right", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                          {horaCurta(m.criado_em)}
                          {saida && (
                            m._status === "enviando" ? (
                              <Clock size={13} color={C.textSecondary} />
                            ) : m._status === "erro" ? (
                              <span onClick={() => reenviar(m)} title="Toque para reenviar" style={{ color: "#e53935", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                                <AlertCircle size={13} /> não enviado · reenviar
                              </span>
                            ) : (
                              // Cinza = enviada; azul = lida (igual ao WhatsApp).
                              <CheckCheck size={15} color={marcaLida(m.status) ? "#53bdeb" : "#8696a0"} />
                            )
                          )}
                        </div>
                      </div>
                      {saida && (
                        <div style={{ width: 28, flexShrink: 0 }}>{ultimaDoGrupo ? <Avatar nome={m.enviado_por || meuNome} foto={m.enviado_por_foto || (m.enviado_por === meuNome ? minhaFoto : null)} size={28} /> : null}</div>
                      )}
                    </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={fimRef} />
            </div>

            {!pertoDoFim && (
              <button onClick={irParaOFim} title="Ir para o fim" style={{ position: "absolute", right: 24, bottom: 84, width: 42, height: 42, borderRadius: "50%", background: C.panel, border: `1px solid ${C.divider}`, boxShadow: "0 2px 6px rgba(0,0,0,.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSecondary, zIndex: 5 }}>
                <ChevronDown size={22} />
              </button>
            )}

            {respondendo && (
              <div style={{ background: C.headerBar, padding: "8px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderLeft: `4px solid ${C.green}`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.verdeTexto, fontWeight: 600, fontSize: 12 }}>Respondendo {respondendo.autor === "advogado" ? "você mesmo" : (conversa.contato?.nome || "o contato")}</div>
                    <div style={{ color: C.textSecondary, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{respondendo.previa}</div>
                  </div>
                  <button onClick={() => setRespondendo(null)} title="Cancelar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                    <X size={18} color={C.textSecondary} />
                  </button>
                </div>
              </div>
            )}

            {/* No celular a barra tem CINCO controles disputando 390px: emoji, nota,
                anexo, a caixa de texto e o microfone. Com o respiro de 10px em
                cada botão e 10 de vão entre eles, sobravam ~140px para escrever
                — o "Digite uma mensagem" nem cabia numa linha. Aqui o respiro
                cai para 7 (o alvo continua com 36-38px, contra os 22 de antes)
                e o vão para 2. */}
            <div style={{ background: C.headerBar, padding: estreito ? "8px 8px" : "10px 16px", display: "flex", alignItems: "flex-end", gap: estreito ? 2 : 10, position: "relative" }}>
              {audioPronto ? (
                // Prévia do áudio gravado: ouça antes de enviar.
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" }}>
                  <button onClick={descartarAudioPronto} title="Descartar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                    <Trash2 size={20} color="#e53935" />
                  </button>
                  <audio controls src={audioPronto.url} style={{ flex: 1, height: 36, maxWidth: "100%" }} />
                  <button onClick={enviarAudioPronto} title="Enviar áudio" style={{ border: "none", background: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }}>
                    <Send size={20} color="#fff" />
                  </button>
                </div>
              ) : gravando ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" }}>
                  <button onClick={cancelarGravacao} title="Cancelar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                    <Trash2 size={20} color="#e53935" />
                  </button>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: gravacaoPausada ? C.textSecondary : "#e53935", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary, minWidth: 44 }}>{formatarDuracao(tempoGravacao)}</span>
                  <span style={{ flex: 1, color: C.textSecondary, fontSize: 14 }}>{gravacaoPausada ? "Pausado" : "Gravando…"}</span>
                  <button onClick={pausarRetomarGravacao} title={gravacaoPausada ? "Retomar" : "Pausar"} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0 }}>
                    {gravacaoPausada ? <Mic size={24} color={C.green} /> : <Pause size={24} color={C.textSecondary} />}
                  </button>
                  <button onClick={finalizarGravacao} title="Concluir gravação" style={{ border: "none", background: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }}>
                    <Check size={22} color="#fff" />
                  </button>
                </div>
              ) : (
                <>
                  <span ref={emojiRef} style={{ display: "flex", marginBottom: 8 }}>
                    {emojiAberto && (
                      <div style={{ position: "absolute", bottom: 60, left: 12, width: "min(300px, calc(100vw - 24px))", maxHeight: 220, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.25)", padding: 8, display: "flex", flexWrap: "wrap", gap: 4, zIndex: 30 }}>
                        {EMOJIS.map((e) => (
                          <button key={e} onClick={() => inserirEmoji(e)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4, borderRadius: 6 }}>{e}</button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setEmojiAberto((v) => !v)} title="Emojis" style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10 }}>
                      <Smile size={24} color={emojiAberto ? C.green : C.textSecondary} />
                    </button>
                  </span>
                  {/* Menu de mensagens rápidas — abre ao digitar "/" na caixa */}
                  {slashAberto && (
                    <div style={{ position: "absolute", bottom: 60, left: 12, right: 12, maxWidth: 420, maxHeight: 260, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.25)", zIndex: 30 }}>
                      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.divider}`, fontSize: 11.5, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3, position: "sticky", top: 0, background: C.panel }}>MENSAGENS RÁPIDAS · use ↑ ↓ e Enter</div>
                      {slashLista.map((r, idx) => (
                        <button key={r.id} onMouseEnter={() => setSlashIdx(idx)} onClick={() => escolherSlash(r)} style={{ width: "100%", textAlign: "left", display: "block", border: "none", background: idx === Math.min(slashIdx, slashLista.length - 1) ? C.listActive : "transparent", cursor: "pointer", color: C.textPrimary, padding: "8px 12px", borderBottom: `1px solid ${C.divider}` }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{r.titulo}</div>
                          <div style={{ fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.texto}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Alternar para NOTA INTERNA (comentário que não vai ao WhatsApp) */}
                  <button onClick={() => setModoNota((v) => !v)} title={modoNota ? "Voltar para mensagem normal" : "Escrever nota interna (só a equipe vê)"} style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10, marginBottom: 1 }}>
                    <StickyNote size={22} color={modoNota ? "#d4a017" : C.textSecondary} />
                  </button>
                  <button onClick={() => fileRef.current?.click()} title="Anexar arquivo" style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10, marginBottom: 1 }}>
                    <Paperclip size={22} color={C.textSecondary} />
                  </button>
                  <input ref={fileRef} type="file" onChange={aoEscolherArquivo} style={{ display: "none" }} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" />
                  <textarea
                    ref={inputRef}
                    value={rascunho}
                    onChange={(e) => { setRascunho(e.target.value); setSlashIdx(0); }}
                    onKeyDown={(e) => {
                      // Menu do "/": navega com as setas e escolhe com Enter.
                      if (slashAberto) {
                        if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => Math.min(slashLista.length - 1, i + 1)); return; }
                        if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => Math.max(0, i - 1)); return; }
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); escolherSlash(slashLista[Math.min(slashIdx, slashLista.length - 1)]); return; }
                        if (e.key === "Escape") { e.preventDefault(); setRascunho(""); return; }
                      }
                      // Enter envia; Shift+Enter pula linha (como no WhatsApp Web).
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                    }}
                    rows={1}
                    placeholder={modoNota ? "Escreva uma nota interna (só a equipe vê)" : "Digite uma mensagem"}
                    style={{ flex: 1, minWidth: 0, border: modoNota ? "1px solid #e6cf6a" : "none", outline: "none", background: modoNota ? (modo === "escuro" ? "#3a3320" : "#fff8d6") : C.inputBg, color: C.textPrimary, borderRadius: 8, padding: estreito ? "9px 11px" : "10px 14px", fontSize: 14.5, resize: "none", lineHeight: 1.35, maxHeight: 120, overflowY: "auto", fontFamily: "inherit" }}
                  />
                  {(rascunho.trim() || modoNota) ? (
                    <button onClick={enviar} title={modoNota ? "Salvar nota" : "Enviar"} style={{ border: "none", background: modoNota ? "#d4a017" : C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, marginBottom: 1 }}>{modoNota ? <StickyNote size={19} color="#fff" /> : <Send size={20} color="#fff" />}</button>
                  ) : (
                    <button onClick={iniciarGravacao} title="Gravar áudio" style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10 }}>
                      <Mic size={24} color={C.textSecondary} />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Ficha do cliente no Vantoro — coluna ao lado da conversa.
          Fica aqui fora, irmã da conversa, e não dentro dela: assim a conversa
          encolhe e cede o espaço em vez de ficar escondida atrás da ficha.
          Quem sai de cena é a lista de conversas (ver a coluna lá em cima), que
          não faz falta enquanto se atende uma pessoa só. */}
      {fichaAberta && conversa && (
        <FichaVantoro
          numero={conversa.contato?.numero}
          nomeContato={conversa.contato?.nome}
          C={C}
          estreito={estreito}
          onFechar={() => setFichaAberta(false)}
          onAviso={mostrarAviso}
        />
      )}

      {/* CONFIGURAÇÕES — perfil, aparência, sair e mensagens rápidas */}
      {configAberta && (
        <div onClick={() => { if (!rapidaForm && !tagForm && !contatoForm && !importando && !(abaConfig === "importar" && impArquivos.length)) setConfigAberta(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: estreito ? 0 : 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, height: estreito ? "100%" : "86vh", background: C.panel, borderRadius: estreito ? 0 : 12, overflow: "hidden", display: "flex", flexDirection: estreito ? "column" : "row", boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>
            {/* Menu à esquerda */}
            <div style={{ width: estreito ? "100%" : 210, background: C.headerBar, borderRight: estreito ? "none" : `1px solid ${C.divider}`, borderBottom: estreito ? `1px solid ${C.divider}` : "none", display: "flex", flexDirection: estreito ? "row" : "column", padding: estreito ? 8 : 14, gap: 4, overflowX: estreito ? "auto" : "visible", "--fita-fundo": C.headerBar }}
                 className={estreito ? "sem-scrollbar fita" : undefined}>
              <div style={{ fontSize: 16, fontWeight: 700, padding: "6px 10px 14px", color: C.textPrimary, display: estreito ? "none" : "block" }}>Configurações</div>
              {[["perfil", "Perfil"], ["aparencia", "Aparência"], ["contatos", "Contatos"], ["rapidas", "Mensagens rápidas"], ["tags", "Tags"], ["importar", "Importar histórico"]].map(([k, label]) => (
                <button key={k} onClick={() => { setAbaConfig(k); setRapidaForm(null); setTagForm(null); setContatoForm(null); }} style={{ textAlign: "left", border: "none", background: abaConfig === k ? C.listActive : "transparent", color: C.textPrimary, borderRadius: 8, padding: "10px 12px", fontSize: 14, fontWeight: abaConfig === k ? 600 : 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</button>
              ))}
              {estreito && <span aria-hidden className="fita-borda" />}
              <div style={{ flex: 1 }} />
              <button onClick={sair} style={{ display: estreito ? "none" : "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#e5573f", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><LogOut size={17} /> Sair</button>
            </div>
            {/* Conteúdo à direita */}
            <div style={{ flex: 1, overflowY: "auto", padding: estreito ? "20px 16px" : 28, position: "relative" }}>
              <button onClick={() => setConfigAberta(false)} title="Fechar" style={{ ...BOTAO_ICONE, position: "absolute", top: 8, right: 8, color: C.textSecondary }}><X size={24} /></button>

              {abaConfig === "perfil" && (
                <div style={{ maxWidth: 420 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Meu perfil</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 20 }}>Como você aparece para o resto da equipe.</div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
                    <div style={{ position: "relative", width: 96, height: 96 }}>
                      <Avatar nome={meuNome} foto={minhaFoto} size={96} />
                      <button onClick={() => fotoPerfilRef.current?.click()} title="Trocar foto" style={{ position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: "50%", background: C.green, border: `2px solid ${C.panel}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Camera size={16} color="#fff" />
                      </button>
                      <input ref={fotoPerfilRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) trocarFotoPerfil(f); }} style={{ display: "none" }} />
                    </div>
                  </div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, letterSpacing: 0.3 }}>NOME</label>
                  <input value={cfgNome} onChange={(e) => setCfgNome(e.target.value)} placeholder="Seu nome" style={{ width: "100%", boxSizing: "border-box", marginTop: 6, marginBottom: 16, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "10px 12px", fontSize: 14.5 }} />
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, letterSpacing: 0.3 }}>E-MAIL (não editável)</label>
                  <div style={{ marginTop: 6, marginBottom: 20, padding: "10px 12px", background: C.searchBg, borderRadius: 8, fontSize: 14, color: C.textSecondary }}>{sessao?.user?.email || "—"}</div>
                  <button onClick={salvarNomePerfil} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar alterações</button>
                </div>
              )}

              {abaConfig === "aparencia" && (
                <div style={{ maxWidth: 440 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Aparência</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 20 }}>Escolha entre o tema claro e o escuro.</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: C.searchBg, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {modo === "claro" ? <Sun size={20} color={C.textSecondary} /> : <Moon size={20} color={C.textSecondary} />}
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>Modo escuro</div>
                        <div style={{ fontSize: 12.5, color: C.textSecondary }}>{modo === "escuro" ? "Ativado" : "Desativado"}</div>
                      </div>
                    </div>
                    <button onClick={() => setModo(modo === "claro" ? "escuro" : "claro")} title="Alternar tema" style={{ width: 48, height: 27, borderRadius: 14, border: "none", cursor: "pointer", background: modo === "escuro" ? C.green : "#c9ced3", position: "relative", transition: "background .15s", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 3, left: modo === "escuro" ? 24 : 3, width: 21, height: 21, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
                    </button>
                  </div>
                </div>
              )}

              {abaConfig === "rapidas" && (
                <div style={{ maxWidth: 560 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Mensagens rápidas</div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>Respostas prontas da equipe. Na conversa, digite <b>/</b> para usar.</div>
                    </div>
                    {!rapidaForm && (
                      <button onClick={() => setRapidaForm({ titulo: "", texto: "" })} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Nova</button>
                    )}
                  </div>

                  {rapidaForm ? (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{rapidaForm.id ? "Editar mensagem" : "Nova mensagem"}</div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>ATALHO / TÍTULO</label>
                        <input value={rapidaForm.titulo} onChange={(e) => setRapidaForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Saudação" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>TEXTO DA MENSAGEM</label>
                        <textarea value={rapidaForm.texto} onChange={(e) => setRapidaForm((f) => ({ ...f, texto: e.target.value }))} rows={5} placeholder="Escreva a resposta pronta…" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setRapidaForm(null)} style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                        <button onClick={salvarRapidaForm} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden" }}>
                      {rapidas.length === 0 && (
                        <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>Nenhuma mensagem rápida ainda. Toque em <b>Nova</b> para criar a primeira.</div>
                      )}
                      {rapidas.map((r) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.titulo}</div>
                            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.texto}</div>
                          </div>
                          <button onClick={() => setRapidaForm({ id: r.id, titulo: r.titulo, texto: r.texto })} title="Editar" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary, display: "flex", flexShrink: 0 }}><Pencil size={16} /></button>
                          <button onClick={() => apagarRapida(r.id)} title="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#e5573f", display: "flex", flexShrink: 0 }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}

              {abaConfig === "tags" && (
                <div style={{ maxWidth: 560 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tags</div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>Etiquetas coloridas para organizar e filtrar as conversas.</div>
                    </div>
                    {!tagForm && (
                      <button onClick={() => setTagForm({ nome: "", cor: CORES_TAG[0] })} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Nova</button>
                    )}
                  </div>

                  {tagForm ? (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{tagForm.id ? "Editar tag" : "Nova tag"}</div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>NOME</label>
                        <input value={tagForm.nome} onChange={(e) => setTagForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Documentação pendente" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>COR</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                          {CORES_TAG.map((cor) => (
                            <button key={cor} onClick={() => setTagForm((f) => ({ ...f, cor }))} title={cor} style={{ width: 28, height: 28, borderRadius: "50%", background: cor, border: tagForm.cor === cor ? `3px solid ${C.textPrimary}` : "2px solid transparent", cursor: "pointer" }} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, color: C.textSecondary }}>Prévia: </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: tagForm.cor, borderRadius: 4, padding: "2px 8px" }}>{tagForm.nome || "Nome da tag"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setTagForm(null)} style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                        <button onClick={salvarTagForm} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden" }}>
                      {tags.length === 0 && (
                        <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>Nenhuma tag ainda. Toque em <b>Nova</b> para criar a primeira.</div>
                      )}
                      {tags.map((t) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: t.cor, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</span>
                          <button onClick={() => setTagForm({ id: t.id, nome: t.nome, cor: t.cor })} title="Editar" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary, display: "flex", flexShrink: 0 }}><Pencil size={16} /></button>
                          <button onClick={() => apagarTag(t.id)} title="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#e5573f", display: "flex", flexShrink: 0 }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {abaConfig === "contatos" && (
                <div style={{ maxWidth: 620 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Contatos</div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>Todos os contatos salvos. Crie novos e abra a conversa com o advogado atual.</div>
                    </div>
                    {!contatoForm && (
                      <button onClick={() => setContatoForm({ nome: "", numero: "" })} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}><UserPlus size={16} /> Novo</button>
                    )}
                  </div>

                  {contatoForm ? (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>Novo contato</div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>NOME</label>
                        <input value={contatoForm.nome} onChange={(e) => setContatoForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: João Silva" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>NÚMERO (com DDD, ex.: 5511999999999)</label>
                        <input value={contatoForm.numero} onChange={(e) => setContatoForm((f) => ({ ...f, numero: e.target.value }))} placeholder="5511999999999" style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setContatoForm(null)} style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                        <button onClick={salvarContato} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderRadius: 8, padding: "6px 12px", marginBottom: 12 }}>
                        <Search size={16} color={C.textSecondary} />
                        <input value={buscaContato} onChange={(e) => setBuscaContato(e.target.value)} placeholder="Buscar contato" style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: C.textPrimary }} />
                      </div>
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden", maxHeight: "52vh", overflowY: "auto" }}>
                        {(() => {
                          const q = buscaContato.trim().toLowerCase();
                          const lista = contatosLista.filter((c) => (c.nome || "").toLowerCase().includes(q) || (c.numero || "").includes(q));
                          if (!lista.length) return <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>{contatosLista.length ? "Nenhum contato encontrado." : "Nenhum contato ainda. Toque em Novo para criar."}</div>;
                          return lista.map((c) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: `1px solid ${C.divider}` }}>
                              <Avatar nome={c.nome || c.numero} foto={c.foto_url} size={40} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDoContato(c)}</div>
                                <div style={{ fontSize: 12.5, color: C.textSecondary }}>+{c.numero}</div>
                              </div>
                              <button onClick={() => abrirConversaContato(c)} title="Abrir conversa" style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.green}`, background: "transparent", color: C.verdeTexto, borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}><MessageSquarePlus size={15} /> Conversar</button>
                            </div>
                          ));
                        })()}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 10, lineHeight: 1.4 }}>
                        "Conversar" abre (ou cria) a conversa com o advogado que está selecionado na barra lateral ({advogado?.nome || "—"}).
                      </div>
                    </>
                  )}
                </div>
              )}

              {abaConfig === "importar" && (
                <div style={{ maxWidth: 620 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Importar histórico</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 18, lineHeight: 1.5 }}>
                    Traga conversas antigas do WhatsApp para o Zorvin. No celular do advogado: abra a conversa → <b>⋮ → Mais → Exportar conversa → Sem mídia</b>, e suba aqui o arquivo <b>.zip</b> (ou o <b>.txt</b>) que o WhatsApp gera — não precisa extrair. Pode subir vários de uma vez. As conversas que ainda não existem são <b>criadas</b>.
                  </div>

                  <input ref={txtRef} type="file" accept=".txt,.zip,text/plain,application/zip,application/x-zip-compressed" multiple onChange={aoEscolherTxts} style={{ display: "none" }} />

                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>ADVOGADO (dono destas conversas)</label>
                  <select value={impAdvId} onChange={(e) => setImpAdvId(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 6, marginBottom: 16, border: `1px solid ${C.divider}`, background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "10px 12px", fontSize: 14 }}>
                    <option value="">Escolha o advogado…</option>
                    {advogados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>

                  <div
                    onClick={() => txtRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); if (!impArrastando) setImpArrastando(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setImpArrastando(false); }}
                    onDrop={aoSoltarImport}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                      border: `2px dashed ${impArrastando ? C.green : C.divider}`,
                      background: impArrastando ? (modo === "escuro" ? "rgba(37,211,102,.10)" : "rgba(37,211,102,.07)") : "transparent",
                      color: impArrastando ? C.green : C.textSecondary,
                      borderRadius: 12, padding: "26px 16px", marginBottom: 16, cursor: "pointer", textAlign: "center",
                      transition: "border-color .15s, background .15s",
                    }}
                  >
                    <Paperclip size={22} color={impArrastando ? C.green : C.textSecondary} />
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: impArrastando ? C.green : C.textPrimary }}>
                      {impArrastando ? "Solte os arquivos aqui" : "Arraste os arquivos aqui"}
                    </div>
                    <div style={{ fontSize: 12.5 }}>
                      ou <span style={{ color: C.verdeTexto, fontWeight: 600 }}>clique para escolher</span> — .zip ou .txt
                    </div>
                  </div>

                  {impArquivos.length > 0 && (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>QUAL NOME É VOCÊ (o advogado) NAS CONVERSAS?</label>
                        <select value={impMeuNome} onChange={(e) => setImpMeuNome(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 6, border: `1px solid ${impMeuNome ? C.divider : "#e5573f"}`, background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "10px 12px", fontSize: 14 }}>
                          <option value="">Escolha o seu nome…</option>
                          {[...new Set(impArquivos.flatMap((it) => it.autores))].map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 5, lineHeight: 1.4 }}>
                          As mensagens desse nome entram como <b>enviadas (você)</b>; as dos outros, como <b>recebidas (contato)</b>. <b style={{ color: impMeuNome ? C.textSecondary : "#e5573f" }}>Confira bem para não inverter os papéis.</b>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 8 }}>CONVERSAS ({impArquivos.length}) — preencha o número dos marcados em vermelho</div>
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                        {impArquivos.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: idx < impArquivos.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeContatoDoItem(it)}</div>
                              <div style={{ fontSize: 12, color: C.textSecondary }}>{it.msgs.length} mensagens{it.ehGrupo ? " · grupo" : ""}</div>
                            </div>
                            {/* Botão "Grupo": marca/desmarca (o painel detecta sozinho, mas você pode corrigir). Grupo não precisa de número. */}
                            <button onClick={() => setImpArquivos((prev) => prev.map((x, i) => i === idx ? { ...x, ehGrupo: !x.ehGrupo } : x))} title="Marcar/desmarcar como grupo" style={{ flexShrink: 0, border: `1px solid ${it.ehGrupo ? C.green : C.divider}`, background: it.ehGrupo ? C.green : "transparent", color: it.ehGrupo ? "#fff" : C.textSecondary, borderRadius: 20, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Grupo</button>
                            {!it.ehGrupo && (
                              <input value={it.numero} onChange={(e) => { const v = e.target.value; setImpArquivos((prev) => prev.map((x, i) => i === idx ? { ...x, numero: v } : x)); }} placeholder="Número (ex.: 5511999999999)" style={{ width: "min(170px, 40%)", flexShrink: 0, boxSizing: "border-box", border: `1px solid ${numeroDeTexto(it.numero) ? C.divider : "#e5573f"}`, background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
                            )}
                            <button onClick={() => setImpArquivos((prev) => prev.filter((_, i) => i !== idx))} title="Remover" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary, display: "flex", flexShrink: 0 }}><X size={17} /></button>
                          </div>
                        ))}
                      </div>

                      {(() => {
                        const faltam = impArquivos.filter((it) => !it.ehGrupo && !numeroDeTexto(it.numero)).length;
                        const bloqueado = importando || faltam > 0 || !impMeuNome;
                        return (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <button onClick={importarLote} disabled={bloqueado} title={!impMeuNome ? "Escolha qual nome é você" : (faltam > 0 ? "Preencha os números que faltam" : "")} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "11px 22px", fontSize: 14.5, fontWeight: 600, cursor: bloqueado ? "default" : "pointer", opacity: bloqueado ? 0.55 : 1 }}>
                                {importando ? (impProgresso || "Importando…") : "Importar tudo"}
                              </button>
                              {!importando && <button onClick={() => { setImpArquivos([]); setImpMeuNome(""); }} style={{ border: "none", background: "transparent", color: C.textSecondary, fontSize: 13.5, cursor: "pointer" }}>Limpar</button>}
                              {!impMeuNome && <span style={{ fontSize: 12.5, color: "#e5573f", fontWeight: 600 }}>Escolha o seu nome</span>}
                              {impMeuNome && faltam > 0 && <span style={{ fontSize: 12.5, color: "#e5573f", fontWeight: 600 }}>Faltam {faltam} número(s)</span>}
                            </div>
                            <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 12, lineHeight: 1.4 }}>
                              O número é <b>obrigatório</b> — é ele que evita conversa duplicada no futuro (quando o contato mandar mensagem nova). Contatos que <b>não estavam salvos</b> já vêm com o número preenchido; os <b>salvos</b> você precisa preencher. Pode reimportar sem duplicar.
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {estreito && (
                <button onClick={sair} style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", color: "#e5573f", padding: "8px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><LogOut size={17} /> Sair</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Imagem em tela cheia, com a GALERIA da conversa (estilo WhatsApp Web).
          A fita de baixo e as setas só aparecem quando a imagem faz parte da
          conversa e há mais de uma — na foto de perfil, ampliada pelo cabeçalho,
          não há próxima nem anterior. */}
      {imagemAberta && (
        <div onClick={() => setImagemAberta(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.9)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: 16, right: 20, display: "flex", gap: 18, alignItems: "center" }}>
            {temGaleria && (
              <span style={{ color: "rgba(255,255,255,.75)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {posNaGaleria + 1} de {imagensDaConversa.length}
              </span>
            )}
            <button onClick={(e) => { e.stopPropagation(); baixarImagem(imagemAberta); }} title="Baixar imagem" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
              <Download size={26} />
            </button>
            <button onClick={() => setImagemAberta(null)} title="Fechar" style={{ ...BOTAO_ICONE, color: "#fff" }}>
              <X size={28} />
            </button>
          </div>

          {/* As setas ficam nas BORDAS da tela, e não coladas na imagem: a
              imagem muda de tamanho a cada foto, e um botão que dança de lugar
              obriga a mirar de novo a cada clique. Some quando não há para onde
              ir — seta apagada que não faz nada é pior do que seta nenhuma. */}
          {temGaleria && posNaGaleria > 0 && (
            <button onClick={(e) => { e.stopPropagation(); andarNaGaleria(-1); }} title="Anterior (←)" aria-label="Imagem anterior"
                    style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={26} />
            </button>
          )}
          {temGaleria && posNaGaleria < imagensDaConversa.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); andarNaGaleria(1); }} title="Próxima (→)" aria-label="Próxima imagem"
                    style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight size={26} />
            </button>
          )}

          <img src={imagemAberta} alt="imagem" onClick={(e) => e.stopPropagation()}
               style={{ maxWidth: "88%", maxHeight: temGaleria ? "76%" : "92%", borderRadius: 8, objectFit: "contain" }} />

          {/* A FITA. Rola sozinha até a imagem aberta, senão numa conversa com
              trinta fotos a marcada fica fora da vista e a fita parece travada. */}
          {temGaleria && (
            <div className="sem-scrollbar" onClick={(e) => e.stopPropagation()}
                 style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", gap: 8, justifyContent: "safe center", overflowX: "auto", padding: "0 18px" }}>
              {imagensDaConversa.map((url, i) => (
                <button key={url + i} onClick={() => setImagemAberta(url)}
                        ref={i === posNaGaleria ? (el) => el && el.scrollIntoView({ block: "nearest", inline: "center" }) : undefined}
                        title={`Imagem ${i + 1}`}
                        style={{ flex: "none", width: 62, height: 62, padding: 0, borderRadius: 6, cursor: "pointer", overflow: "hidden", background: "rgba(255,255,255,.08)", border: i === posNaGaleria ? "2px solid #25d366" : "2px solid transparent", opacity: i === posNaGaleria ? 1 : 0.6 }}>
                  <img src={url} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prévia do anexo com legenda antes de enviar (estilo WhatsApp) */}
      {anexoPendente && (
        <div onClick={fecharAnexoPendente} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.85)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
          <button onClick={(e) => { e.stopPropagation(); fecharAnexoPendente(); }} title="Cancelar" style={{ position: "absolute", top: 16, right: 20, background: "transparent", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
            <X size={28} />
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {anexoPendente.tipo === "imagem" && <img src={anexoPendente.url} alt="prévia" style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 8, objectFit: "contain" }} />}
            {anexoPendente.tipo === "video" && <video src={anexoPendente.url} controls style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 8 }} />}
            {anexoPendente.tipo === "audio" && <audio src={anexoPendente.url} controls style={{ width: "100%" }} />}
            {anexoPendente.tipo === "documento" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "16px 20px" }}>
                <FileText size={32} /> <span style={{ fontSize: 15 }}>{anexoPendente.nome}</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, width: "100%", background: C.headerBar, borderRadius: 10, padding: "8px 12px" }}>
              <input autoFocus value={legendaAnexo} onChange={(e) => setLegendaAnexo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmarEnviarAnexo(); } }} placeholder="Adicione uma legenda…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: C.textPrimary, fontSize: 14.5, padding: "8px 4px" }} />
              <button onClick={confirmarEnviarAnexo} title="Enviar" style={{ border: "none", background: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }}>
                <Send size={20} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast discreto (avisos não bloqueantes) */}
      {aviso && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,.3)", zIndex: 120, maxWidth: "90%", textAlign: "center" }}>
          {aviso}
        </div>
      )}

      {/* Departamentos, telefones e permissões. Ao fechar, os cadastros são
          relidos: renomear um departamento tem de aparecer na hora, senão a
          pessoa acha que não salvou e faz de novo. */}
      {/* JUNTAR DUAS CONVERSAS. A lista é a das conversas VISÍVEIS agora, e o
          servidor recusa juntar conversas de telefones diferentes — misturar
          dois números apagaria por onde a conversa aconteceu. */}
      {juntar && (
        <div onClick={() => setJuntar(null)}
             style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ background: C.panel, color: C.textPrimary, borderRadius: 14, width: "100%", maxWidth: 460, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>Juntar duas conversas</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
              Para quando a MESMA conversa nasceu duas vezes — o caso do grupo que
              apareceu com um número esquisito. As mensagens da primeira vão para a
              segunda, e a primeira deixa de existir. Não dá para desfazer.
            </div>
            {[["de", "Esta conversa SOME…"], ["para", "…e as mensagens dela vão para"]].map(([campo, rotulo]) => (
              <div key={campo} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: C.textSecondary, fontWeight: 600, marginBottom: 4 }}>{rotulo}</div>
                <select value={juntar[campo]} onChange={(e) => setJuntar((j) => ({ ...j, [campo]: e.target.value }))}
                        style={{ width: "100%", border: `1px solid ${C.divider}`, background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 10px", fontSize: 13.5 }}>
                  <option value="">Escolha…</option>
                  {conversasFiltradas.map((c) => (
                    <option key={c.id} value={c.id}>{nomeDoContato(c.contato)}</option>
                  ))}
                </select>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setJuntar(null)}
                      style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary, borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button disabled={!juntar.de || !juntar.para || juntar.de === juntar.para || juntar.indo}
                      onClick={async () => {
                        setJuntar((j) => ({ ...j, indo: true }));
                        try {
                          const r = await chamarPonte("/conversas/juntar", {
                            method: "POST",
                            body: JSON.stringify({ de: juntar.de, para: juntar.para }),
                          });
                          setJuntar(null);
                          if (String(conversaId) === String(juntar.de)) setConversaId(juntar.para);
                          mostrarAviso(`Pronto: ${r.movidas} mensagem(ns) juntada(s).`);
                          carregarConversas(advogadoId);
                        } catch (e) {
                          setJuntar((j) => ({ ...j, indo: false }));
                          mostrarAviso(e.message || "Não consegui juntar.");
                        }
                      }}
                      style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: (!juntar.de || !juntar.para || juntar.de === juntar.para || juntar.indo) ? 0.5 : 1 }}>
                {juntar.indo ? "Juntando…" : "Juntar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MÍDIAS, DOCUMENTOS E LINKS — de todas as conversas que a pessoa alcança. */}
      {midiasAberta && (
        <div onClick={() => setMidiasAberta(false)}
             style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 190, display: "flex", alignItems: "center", justifyContent: "center", padding: estreito ? 0 : 16 }}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ background: C.panel, color: C.textPrimary, borderRadius: estreito ? 0 : 14, width: "100%", maxWidth: 940, height: estreito ? "100dvh" : "min(86vh, 760px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
            {/* No celular os três nomes das abas mais o título mais o X não cabem
                em 390px, e o que sobrava para fora era justamente o X de fechar.
                Aqui o título perde o subtítulo, a fita de abas encolhe e rola, e
                o X fica fixo — nunca sai da tela. */}
            <div style={{ display: "flex", alignItems: "center", gap: estreito ? 8 : 14, padding: estreito ? "12px 12px" : "14px 18px", borderBottom: `1px solid ${C.divider}` }}>
              <div style={{ flex: "0 1 auto", minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>Mídia</div>
                {!estreito && <div style={{ fontSize: 12, color: C.textSecondary }}>de todas as conversas</div>}
              </div>
              <div className="sem-scrollbar fita" style={{ flex: 1, minWidth: 0, display: "flex", gap: 4, justifyContent: estreito ? "flex-end" : "center", "--fita-fundo": C.panel }}>
                {[["midias", "Mídias"], ["documentos", "Documentos"], ["links", "Links"]].map(([k, r]) => (
                  <button key={k} onClick={() => setMidiaAba(k)}
                          style={{ flexShrink: 0, border: "none", background: "transparent", cursor: "pointer", padding: estreito ? "8px 8px" : "8px 14px", fontSize: 14, fontWeight: 600, color: midiaAba === k ? C.textPrimary : C.textSecondary, borderBottom: `2px solid ${midiaAba === k ? C.green : "transparent"}` }}>{r}</button>
                ))}
                <span aria-hidden className="fita-borda" />
              </div>
              <button onClick={() => setMidiasAberta(false)} aria-label="Fechar" title="Fechar"
                      style={{ ...BOTAO_ICONE, padding: estreito ? 7 : 10, color: C.textSecondary }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {acervo.carregando && <div style={{ color: C.textSecondary, fontSize: 14 }}>Carregando…</div>}
              {!acervo.carregando && acervoFiltrado.length === 0 && (
                <div style={{ color: C.textSecondary, fontSize: 14 }}>
                  {midiaAba === "midias" ? "Nenhuma foto ou vídeo ainda."
                    : midiaAba === "documentos" ? "Nenhum documento ainda."
                    : "Nenhum link enviado ainda."}
                </div>
              )}

              {/* MÍDIAS em grade, com o nome da conversa por cima — é por ele que
                  se reconhece de quem veio aquela foto sem abrir. */}
              {!acervo.carregando && midiaAba === "midias" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                  {acervoFiltrado.map((m) => (
                    <button key={m.id}
                            onClick={() => { if (m.tipo === "imagem") { setMidiasAberta(false); setImagemAberta(m.midia_url); } else { window.open(m.midia_url, "_blank", "noopener"); } }}
                            title={nomePorConversa[m.conversa_id] || ""}
                            style={{ position: "relative", border: "none", padding: 0, aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: C.inputBg }}>
                      {m.tipo === "imagem"
                        ? <img src={m.midia_url} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : <span style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSecondary, fontSize: 13 }}>vídeo</span>}
                      <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 8px 6px", fontSize: 11.5, color: "#fff", textAlign: "left", background: "linear-gradient(transparent, rgba(0,0,0,.75))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {nomePorConversa[m.conversa_id] || ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* DOCUMENTOS e LINKS em lista: aqui o que identifica é o TEXTO, e
                  texto em grade de quadradinhos não se lê. */}
              {!acervo.carregando && midiaAba !== "midias" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {acervoFiltrado.map((m) => (
                    <a key={m.id} href={midiaAba === "links" ? m._link : m.midia_url} target="_blank" rel="noopener noreferrer"
                       style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: `1px solid ${C.divider}`, color: C.textPrimary, textDecoration: "none" }}>
                      {midiaAba === "links" ? <ExternalLink size={17} color={C.textSecondary} /> : <FileText size={17} color={C.textSecondary} />}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {midiaAba === "links" ? m._link : (m.texto || "Documento")}
                        </span>
                        <span style={{ display: "block", fontSize: 11.5, color: C.textSecondary }}>
                          {(nomePorConversa[m.conversa_id] || "")}{nomePorConversa[m.conversa_id] ? " · " : ""}{rotuloData(m.criado_em)}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {telaAdmin && (
        <Departamentos C={C} aoFechar={() => {
          setTelaAdmin(false);
          Promise.all([
            supabase.from("departamentos").select("id, nome, slug, cor, ordem").eq("ativo", true).order("ordem"),
            supabase.from("advogados").select("id, nome, numero, foto_url, departamento_id").eq("ativo", true).order("nome"),
          ]).then(([d, t]) => {
            setDepartamentos(d.data || []);
            setAdvogados(t.data || []);
          });
        }} />
      )}
    </div>
  );
}

