import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase.js";
import { aplicarAparencia } from "./aparencia.js";
import {
  ZoomIn, ZoomOut,
  Search, Send, Paperclip, Smile, ChevronDown, MoreVertical,
  MessageSquare, Mic, CheckCheck, LogOut, ArrowLeft, Sun, Moon,
  Clock, AlertCircle, Reply, X, FileText, Download, ChevronUp,
  StickyNote, Plus, Trash2, Settings, Camera, Pencil, Tag, Check, Star,
  Archive, UserPlus, MessageSquarePlus, SquarePen, Pause, ClipboardList, ShieldCheck,
  ChevronLeft, ChevronRight, Images, ExternalLink, Pin, Copy, Forward, Sticker,
  History, BarChart3, Users, Smartphone, ArrowDownUp,
  Bold, Italic, Strikethrough, Code, ListOrdered, List, Quote
} from "lucide-react";
import { FORMATOS, calcularFormato, formatoDaTecla } from "./formatacao.js";
import FichaVantoro from "./FichaVantoro";
import { numeroCanonico, chaveDoNumero, porQueNaoRecebeWhatsApp, daParaChamar,
         telefoneLegivel } from "./numeros.js";
import { chamarPonte, ESPERA_PADRAO } from "./ponte.js";
import { PRAZO_DA_BUSCA, foiAbortada, funcaoNaoExiste,
         condicoesDeNome, recadoDaBusca } from "./busca.js";
import { comoPrever, nomeDoTipo, tamanhoLegivel } from "./arquivos.js";
import { gravarSemAsQueFaltam } from "./gravar.js";

// O que este banco já disse que não tem, para não perguntar de novo a cada nota.
// Vale só nesta sessão: rodar o SQL que falta e apertar F5 devolve a coluna.
const COLUNAS_QUE_FALTAM_EM_NOTAS = new Set();
import { ZOOM_MIN, ZOOM_MAX, ZOOM_PARADO, ZOOM_DO_TOQUE_DUPLO, degrauSeguinte,
         porcentagem, limitarPosicao, zoomAncorado, distancia } from "./zoom.js";
import Departamentos from "./Departamentos";
import PainelNumeros from "./PainelNumeros";
import Marca from "./Marca";
import PainelEmoji, { guardarRecente } from "./Emojis";

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
// O QUE CADA LINHA DO HISTÓRICO DIZ, em português de gente.
//
// Fica aqui fora, e não espalhado em `if`s no meio do desenho: quando aparecer
// um tipo novo, é uma linha aqui — e um tipo desconhecido cai num texto
// genérico em vez de mostrar o código cru para quem está atendendo.
const RESUMO_ALTERACAO = {
  cadastro: "alterou o cadastro do contato",
  nota_criada: "escreveu uma nota interna",
  nota_editada: "editou uma nota interna",
  nota_apagada: "apagou uma nota interna",
  contato_renomeado: "deu um nome ao contato",
};

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
  // O NOME QUE A EQUIPE DEU AQUI DENTRO. Fica entre o cadastro e o WhatsApp,
  // e a ordem é a resposta a duas perguntas diferentes: quem tem ficha é
  // conhecido pelo nome dela (o painel não é dono do nome de quem o Vantoro já
  // conhece); quem não tem — um lead, quase sempre — passa a poder ser
  // chamado pelo nome de verdade sem que se crie um cadastro só para isso.
  if (contato.nome_zorvin) return contato.nome_zorvin;
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
// `conversas.arquivada` também é de um SQL que pode não ter sido rodado.
let TEM_ARQUIVADA = true;
// A contagem dos selos numa ida só (`nao_lidas_por_telefone`) é outro SQL. Onde
// ele não foi rodado, o painel conta telefone a telefone como sempre contou.
let TEM_CONTAGEM_NO_BANCO = true;

// AVISOS DE FALHA JÁ DISPENSADOS, GUARDADOS AQUI NO APARELHO.
//
// Relato do escritório: "cliquei em 'Dispensar este aviso' e nada aconteceu,
// além da mensagem 'Não consigo dispensar este aviso agora'". O aviso vermelho
// vem das linhas de `fila_envio` com `status = 'erro'`, e dispensar era só
// gravar `status = 'descartada'` — se o banco recusasse essa gravação, o botão
// não tinha PLANO NENHUM: avisava e deixava o alarme na tela para sempre. Uma
// falha de meses atrás, já resolvida, ficava piscando em vermelho no meio de
// uma conversa, e não havia gesto capaz de tirá-la dali.
//
// Agora são duas camadas. A de baixo é este registro no aparelho, que funciona
// sempre, sem depender de o banco aceitar nada: clicou, sumiu, e continua
// sumido depois de recarregar a página. A de cima é a gravação no banco, que é
// o que faz o aviso sumir TAMBÉM para os colegas — essa pode falhar, e quando
// falha o painel diz exatamente isso, em vez de fingir que não fez nada.
//
// Guardamos o id da linha, e não a mensagem: a linha continua no banco, com o
// motivo do erro, para quem for investigar depois. O que sai é o alarme.
const CHAVE_DISPENSADOS = "zorvin_avisos_dispensados";
function lerDispensados() {
  try {
    const cru = JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) || "[]");
    return new Set(Array.isArray(cru) ? cru.map(String) : []);
  } catch (_) { return new Set(); }
}
function guardarDispensado(id) {
  try {
    const todos = lerDispensados();
    todos.add(String(id));
    // TETO DE 500. Sem ele a lista cresce para sempre num navegador que nunca
    // se limpa, e um dia o `localStorage` estoura — derrubando junto o que
    // mais mora nele. Os mais antigos saem primeiro; um aviso de dois anos
    // atrás não está mais na tela de ninguém.
    const lista = [...todos].slice(-500);
    localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(lista));
    return new Set(lista);
  } catch (_) { return lerDispensados(); }
}
// Quanto tempo os pedidos de recontagem dos selos esperam para virar UM só, e
// o teto para a rajada que não acaba. Ver o comentário longo em
// `carregarNaoLidasPorAdv`. Aqui fora porque são fixos: dentro do componente
// seriam recriados a cada desenho, e o embrulho que os usa tem de ter
// identidade fixa para não derrubar o canal de tempo real.
const ESPERA_DOS_SELOS = 400;    // junta o que chegar dentro deste tempo
const TETO_DOS_SELOS = 2000;     // e conta assim mesmo depois deste
const colunasDoContato = (base) =>
  // `vantoro_cliente_id` vem do MESMO SQL das frentes que trouxe `vantoro_nome`,
  // então herda a mesma tolerância: onde um existe, o outro existe. É por ele
  // que a nota interna sabe para qual cliente do Vantoro ela vai subir — sem
  // cliente, a nota fica só na conversa, que é o certo para quem ainda não tem
  // cadastro.
  TEM_NOME_DO_CADASTRO ? base + ", vantoro_nome, nome_zorvin, vantoro_cliente_id" : base;

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

// FALTA DE FUNÇÃO É OUTRA COISA DE FALTA DE COLUNA, e a diferença importa:
// PGRST202 quer dizer "o SQL não foi rodado" e é permanente até alguém rodá-lo;
// qualquer outro erro é passageiro e não pode desligar nada.
function faltaAFuncao(erro) {
  if (!erro) return false;
  return /PGRST202/.test(String(erro.code || ""))
    || /could not find the function/i.test(String(erro.message || ""));
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
// ============================================================
//  OS SINAIS DE `zorvin_saude()`, VIRADOS EM FRASES
//
//  Fora do componente de propósito: é uma decisão de conteúdo — o que se diz,
//  para quem — e decisão de conteúdo se lê melhor num lugar só do que espalhada
//  no meio do desenho da tela.
//
//  DUAS PLATEIAS, E ELAS PRECISAM DE COISAS DIFERENTES.
//
//  Quem atende precisa do que muda o que ela deve FAZER AGORA: se as mensagens
//  não estão saindo, ela não promete resposta ao cliente; se a linha caiu, ela
//  não responde por aquele telefone; se uma mensagem de cliente não entrou, ela
//  para de acreditar que a conversa calada está calada.
//
//  Quem administra precisa também do que ainda vai se resolver sozinho — a
//  caixa atrasada é assim. Mostrar isso a quem atende seria acender uma luz
//  sobre algo que ela não tem como fazer nada a respeito, e alarme que não pede
//  ação é alarme que se aprende a ignorar. Aí o próximo, o de verdade, passa
//  batido junto.
// ============================================================
function haQuantoTempo(desde) {
  const ms = Date.now() - new Date(desde).getTime();
  if (!(ms > 0)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.floor(horas / 24)} dia(s)`;
}

/** Uma ou muitas, escrito como se escreve.
 *
 *  Estava colando "ns" no fim de "mensagem" e saía **mensagemns** na tela do
 *  escritório. Plural de português não sai de concatenação: as duas formas
 *  ficam escritas, e o verbo junto — "não entrou" e "não entraram" são
 *  palavras diferentes, e um aviso mal escrito é lido como coisa de máquina
 *  quebrada, não como recado. */
const conforme = (n, uma, muitas) => (n === 1 ? uma : muitas);

function frasesDaSaude(saude, ehAdmin) {
  const por = {};
  for (const l of saude || []) por[l.sinal] = l;
  const frases = [];

  // A MAIS GRAVE PRIMEIRO, e é a de entrada: alguém escreveu para o escritório
  // e a conversa não mostra. É a única em que o silêncio da tela mente sobre
  // uma conversa inteira, e por isso vai para todo mundo.
  if (por.eventos_desistidos) {
    const n = por.eventos_desistidos.quantas;
    frases.push(`${n} ${conforme(n, "mensagem", "mensagens")} de cliente`
      + ` ${conforme(n, "não entrou", "não entraram")} no Zorvin`
      + ` (${haQuantoTempo(por.eventos_desistidos.desde)}). Uma conversa calada pode não estar calada.`);
  }

  // A LINHA CAÍDA DIZ O NOME. Sem ele, quem atende não sabe se é a linha que
  // ela está usando — e é essa a única pergunta que importa neste aviso.
  if (por.linhas_caidas) {
    frases.push(`A linha de ${por.linhas_caidas.detalhe} está desconectada do WhatsApp.`
      + " Nada sai por ela até alguém reconectar o aparelho.");
  }

  // AS DUAS DA FILA VIRAM UMA FRASE. Para quem atende elas querem dizer a mesma
  // coisa — o que você escreveu não está saindo —, e a diferença entre "parada"
  // e "travada" só interessa a quem for consertar, que tem o log.
  const parada = por.fila_parada || por.fila_travada;
  if (parada) {
    const n = (por.fila_parada?.quantas || 0) + (por.fila_travada?.quantas || 0);
    frases.push(`${n} ${conforme(n, "mensagem escrita", "mensagens escritas")} aqui`
      + ` ${conforme(n, "não saiu", "não saíram")}`
      + ` (a mais antiga ${haQuantoTempo(parada.desde)}). Não prometa resposta ao cliente por enquanto.`);
  }

  if (ehAdmin && por.eventos_pendentes) {
    const n = por.eventos_pendentes.quantas;
    frases.push(`${n} ${conforme(n, "evento esperando", "eventos esperando")} para entrar`
      + ` (${haQuantoTempo(por.eventos_pendentes.desde)}). Costuma se resolver sozinho.`);
  }

  return frases;
}

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
    scrollbar: "rgba(11,20,26,.24)", scrollbarForte: "rgba(11,20,26,.38)",
    // A barra de digitar: SÓ O BALÃO. `barraFundo` é transparente, então o
    // fundo da conversa — inclusive o padrão de fundo — passa por trás dele.
    // Qualquer cor sólida aqui, mesmo a igual à da conversa, apagaria o padrão
    // naquela faixa e devolveria a tarja que se queria eliminar.
    barraFundo: "transparent", balaoFundo: "#ffffff",
    placeholderCircle: "#dfe5e7", link: "#027eb5",
    verdeTexto: "#017561", horaNaoLida: "#017561",
  },
  escuro: {
    rail: "#161717", headerBar: "#202c33", panel: "#111b21", listActive: "#2a3942",
    chatBg: "#0b141a", bubbleIn: "#202c33", bubbleOut: "#005c4b", green: "#00a884",
    greenDark: "#025144", textPrimary: "#e9edef", textSecondary: "#9aa8b1",
    divider: "#222d34", unread: "#008069", inputBg: "#2a3942", searchBg: "#202c33",
    scrollbar: "rgba(233,237,239,.16)", scrollbarForte: "rgba(233,237,239,.28)",
    barraFundo: "transparent", balaoFundo: "#2a3942",
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
/** Nome comparável: sem acento, sem maiúscula, sem espaço sobrando.
 *  O mesmo tratamento que o banco faz em `zorvin_sem_acento` — os dois lados
 *  precisam concordar, senão "JENIFER ALMEIDA" e "Jenifer Almeida" viram duas
 *  pessoas de um lado e uma do outro. */
function chaveDeNome(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

// O PISO DE 40×40 É DO DEDO, e não do desenho.
//
// A medição no iPhone achou "Nova conversa" com 39, o filtro de quem com 37 e
// o ⋮ de cada conversa com 30. Parece pouca diferença no monitor; no aparelho é
// a diferença entre acertar e abrir outra coisa. 40 é o mínimo que a Apple
// recomenda para qualquer coisa que se toque, e no computador nada muda de
// aparência: os botões já tinham 39.
const BOTAO_ICONE = {
  border: "none", background: "transparent", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 10, borderRadius: 8, flexShrink: 0,
  minWidth: 40, minHeight: 40,
};

// UMA LINHA DE MENU QUE O DEDO ACERTA.
//
// 12px em cima e embaixo de um texto de 14 dão 44 pontos de altura — a medida
// que a Apple recomenda para qualquer coisa que se toque. Errar a linha num
// menu de celular abre a tela errada, e quem errou não sabe que errou: só vê
// aparecer outra coisa.
const ITEM_DO_MENU = {
  width: "100%", display: "flex", alignItems: "center", gap: 10,
  padding: "12px 14px", border: "none", background: "transparent",
  cursor: "pointer", fontSize: 14, textAlign: "left",
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

// OS FORMATADORES NASCEM UMA VEZ, e não a cada chamada.
//
// `toLocaleTimeString("pt-BR", {...})` constrói um `Intl.DateTimeFormat` novo
// por dentro TODA vez que é chamado, e isso é caro: num perfil da tela, com a
// lista de conversas na frente, `horaDe` sozinha respondia por 30% do tempo de
// cada tecla digitada na busca. Ela é chamada uma vez por linha da lista e uma
// vez por mensagem na conversa — as duas coisas que mais se redesenham aqui.
//
// Reaproveitando o formatador, a mesma conta custa uma fração disso.
const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DIA_MES = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const DIA_MES_ANO = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function horaDe(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  // Comparando os três números, e não duas strings: `toDateString()` monta e
  // joga fora uma string por chamada, e são milhares por segundo aqui.
  const mesmoDia = d.getDate() === hoje.getDate()
                && d.getMonth() === hoje.getMonth()
                && d.getFullYear() === hoje.getFullYear();
  return mesmoDia ? HORA.format(d) : DIA_MES.format(d);
}

// Data e hora por extenso — "05/08/2026 às 18:38".
//
// `horaDe` encurta de propósito (só a hora quando é hoje, só o dia quando não
// é): na lista de conversas o espaço é de um canto de linha. No histórico é o
// contrário — a pergunta é justamente QUANDO, e "05/08" sem o ano não responde
// nada num cliente de três anos atrás.
function dataHoraDe(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return DIA_MES_ANO.format(d) + " às " + HORA.format(d);
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

// COMO O PROCESSO SE APRESENTA na lista de escolha da nota interna.
//
// "0001234-56.2026.8.26.0100 · BANCO TAL S.A." — o número e CONTRA QUEM é a
// ação.
//
// Antes vinha o tipo da ação, e não servia: um cliente com oito ações lia oito
// linhas dizendo "NEGATIVAÇÃO INCLUSÃO INDEVIDA EM CADASTRO DE INADIMPLENTES",
// que é justamente o que todas têm em comum. O que distingue uma da outra, para
// quem atende, é o réu — é assim que a equipe fala delas ("a do banco", "a da
// operadora").
//
// AS TRÊS FALTAS, cada uma com seu jeito de não mentir:
//   • sem réu  → fica só o número, e não um " · " pendurado no vazio;
//   • sem número (ação ainda não distribuída) → fica só o réu, em vez de a
//     linha começar com um ponto solto, como aparecia na tela;
//   • sem os dois → o id, dito por extenso. Uma opção em branco no meio da
//     lista parece defeito da tela, e não dá para escolher com segurança.
function rotuloDoProcesso(p) {
  if (!p) return "";
  const numero = String(p.numero || "").trim();
  const reu = String(p.reu || "").trim();
  if (numero && reu) return `${numero} · ${reu}`;
  return numero || reu || `Processo #${p.id}`;
}

// O NOME DA ABA, num lugar só. Ele aparece em três pontos (o HTML inicial, o
// contador de não lidas e a limpeza ao sair); espalhado, um deles ficaria para
// trás na próxima vez que o nome mudar.
const NOME_DA_ABA = "Ropelimi Zorvin";

// Sempre HH:MM (usada no carimbo das bolhas; a data fica no separador).
function horaCurta(iso) {
  if (!iso) return "";
  return HORA.format(new Date(iso));
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
  return DIA_MES_ANO.format(d);
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
/** "1:19" a partir de 79 segundos. Sem hora: uma mensagem de voz de mais de
 *  uma hora não existe, e "0:01:19" seria pior de ler. */
function tempoCurto(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// O RÓTULO DA PRÉVIA — E ELE É DIFERENTE NO COMPUTADOR E NO CELULAR.
//
// No WhatsApp Web a lista mostra só o microfone e o tempo: "🎤 0:20". No
// celular, por extenso: "🎤 Mensagem de voz (0:20)". Não é inconsistência
// deles — é espaço. Na coluna estreita do computador, ao lado de um nome
// comprido, "Mensagem de voz (0:20)" empurra o resto para fora; no celular a
// linha é a largura da tela e cabe escrito.
//
// O tempo não é enfeite: é o que separa um "ok" de dez segundos de um relato
// de três minutos, na hora de decidir o que ouvir primeiro.
//
// A duração só existe para as mensagens que chegaram DEPOIS de a ponte passar
// a guardá-la. Nas antigas o rótulo cai no nome por extenso, em vez de mostrar
// um tempo inventado — um "(0:00)" ali seria informação errada, e informação
// errada é pior do que informação que falta.
function rotuloMidia(tipo, segundos, soOTempo) {
  const tem = Number(segundos) > 0;
  const tempo = tem ? tempoCurto(segundos) : "";
  if (tipo === "imagem") return "📷 Foto";
  if (tipo === "documento") return "📄 Documento";
  if (tipo === "audio") {
    if (soOTempo && tem) return `🎤 ${tempo}`;
    return tem ? `🎤 Mensagem de voz (${tempo})` : "🎤 Mensagem de voz";
  }
  if (tipo === "video") {
    if (soOTempo && tem) return `🎬 ${tempo}`;
    return tem ? `🎬 Vídeo (${tempo})` : "🎬 Vídeo";
  }
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
/** Ênfases e links de um trecho SEM quebra de estrutura — uma linha, ou um
 *  bloco de linhas comuns. É a folha: quem desenha listas e citação chama
 *  daqui para dentro. */
function formatarTrecho(texto, corLink, semente) {
  const partes = [];
  let last = 0, i = 0, m;
  RE_URL.lastIndex = 0;
  while ((m = RE_URL.exec(texto))) {
    if (m.index > last) partes.push(...aplicarEnfase(texto.slice(last, m.index), semente + "t" + i++));
    const url = m[0];
    partes.push(
      <a key={semente + "u" + i++} href={url} target="_blank" rel="noopener noreferrer" style={{ color: corLink, textDecoration: "underline" }}>{url}</a>
    );
    last = m.index + url.length;
  }
  if (last < texto.length) partes.push(...aplicarEnfase(texto.slice(last), semente + "t" + i++));
  return partes;
}

// AS MARCAS QUE VALEM PARA A LINHA INTEIRA, e não para um trecho dela.
//
// O WhatsApp desenha lista e citação; nós guardávamos o texto igual e
// mostrávamos os sinais crus. Enquanto ninguém escrevia listas, isso não
// aparecia. Com a barra de formatação, "Citar" passaria a produzir um "> " à
// vista na nossa própria tela — a mensagem sairia certa para o cliente e
// errada para quem a escreveu, que é o pior lugar para um defeito ficar.
const RE_ITEM_NUM = /^(\d+)\.[ \t]+(.*)$/;
const RE_ITEM_MARCA = /^-[ \t]+(.*)$/;
const RE_CITACAO = /^>[ \t]?(.*)$/;

function tipoDaLinha(l) {
  if (RE_CITACAO.test(l)) return "citacao";
  if (RE_ITEM_NUM.test(l)) return "numerada";
  if (RE_ITEM_MARCA.test(l)) return "marcadores";
  return "texto";
}

function formatarTexto(texto, corLink = "#53bdeb") {
  if (!texto) return null;

  // Junta as linhas VIZINHAS do mesmo tipo: três linhas com "- " são UMA lista
  // de três itens, e não três listas de um item — que é o que sai se cada
  // linha virar o seu próprio bloco, com o espaçamento entre blocos no meio.
  const linhas = String(texto).split("\n");
  const blocos = [];
  for (const linha of linhas) {
    const tipo = tipoDaLinha(linha);
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.tipo === tipo) ultimo.linhas.push(linha);
    else blocos.push({ tipo, linhas: [linha] });
  }

  const semLista = { margin: "3px 0", paddingLeft: 20 };
  return blocos.map((b, i) => {
    const chave = "b" + i;
    if (b.tipo === "texto") {
      // Um bloco comum volta a ser texto corrido, com as quebras que tinha. O
      // `pre-wrap` do balão é quem as desenha.
      return <React.Fragment key={chave}>
        {formatarTrecho(b.linhas.join("\n"), corLink, chave)}
        {i < blocos.length - 1 ? "\n" : ""}
      </React.Fragment>;
    }
    if (b.tipo === "citacao") {
      return (
        <div key={chave} style={{ borderLeft: "3px solid currentColor", opacity: 0.85,
                                  paddingLeft: 8, margin: "3px 0", whiteSpace: "pre-wrap" }}>
          {formatarTrecho(b.linhas.map((l) => RE_CITACAO.exec(l)[1]).join("\n"), corLink, chave)}
        </div>
      );
    }
    if (b.tipo === "numerada") {
      // `start` no número REAL da primeira linha: uma lista que começa no 3 —
      // porque é a continuação de outra, ou porque a pessoa escreveu assim —
      // tem de aparecer começando no 3.
      const inicio = Number(RE_ITEM_NUM.exec(b.linhas[0])[1]) || 1;
      return (
        <ol key={chave} start={inicio} style={semLista}>
          {b.linhas.map((l, j) => (
            <li key={chave + "i" + j} style={{ whiteSpace: "pre-wrap" }}>
              {formatarTrecho(RE_ITEM_NUM.exec(l)[2], corLink, chave + "i" + j)}
            </li>
          ))}
        </ol>
      );
    }
    return (
      <ul key={chave} style={semLista}>
        {b.linhas.map((l, j) => (
          <li key={chave + "i" + j} style={{ whiteSpace: "pre-wrap" }}>
            {formatarTrecho(RE_ITEM_MARCA.exec(l)[1], corLink, chave + "i" + j)}
          </li>
        ))}
      </ul>
    );
  });
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

// OS SEIS EMOJIS DA REAÇÃO RÁPIDA — os mesmos do WhatsApp. São seis de
// propósito: uma reação é para ser dada num toque, e uma lista completa
// transformaria "reagir" numa escolha. Quem quiser mais abre o painel no "+".
const EMOJIS_REACAO = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// AS ABAS NO PÉ DO PAINEL — emojis de um lado, figurinhas do outro.
//
// É o desenho do WhatsApp, e ele resolve um problema real: quem procura
// figurinha e abre o painel de emoji não precisa fechar tudo e caçar outro
// ícone na barra. As duas coisas moram no mesmo lugar.
function AbasDoPainel({ C, aba, aoTrocar }) {
  const BOTAO = (ativa) => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    border: "none", cursor: "pointer", padding: "6px 18px", borderRadius: 999,
    background: ativa ? C.searchBg : "transparent",
    color: ativa ? C.textPrimary : C.textSecondary, fontSize: 12.5, fontWeight: 600,
  });
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: 6,
                  borderTop: `1px solid ${C.divider}`, flexShrink: 0 }}>
      <button onClick={() => aoTrocar("emoji")} title="Emojis" style={BOTAO(aba !== "figurinha")}>
        <Smile size={17} color={aba !== "figurinha" ? C.green : C.textSecondary} /> Emojis
      </button>
      <button onClick={() => aoTrocar("figurinha")} title="Figurinhas" style={BOTAO(aba === "figurinha")}>
        <Sticker size={17} color={aba === "figurinha" ? C.green : C.textSecondary} /> Figurinhas
      </button>
    </div>
  );
}

// A GALERIA DE FIGURINHAS. Mesma moldura e mesma altura do painel de emoji,
// para trocar de aba não fazer a caixa pular de tamanho debaixo do dedo.
function PainelFigurinhas({ C, figurinhas, figHover, aoPassarMouse, aoEnviar, aoRemover, aoNova, rodape }) {
  return (
    <div style={{ width: 400, maxWidth: "calc(100vw - 24px)",
                  height: 412, maxHeight: "calc(100vh - 120px)",
                  background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 12,
                  boxShadow: "0 8px 28px rgba(0,0,0,.35)", overflow: "hidden",
                  display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textSecondary }}>FIGURINHAS FAVORITAS</span>
        <button onClick={aoNova} title="Enviar uma figurinha nova"
          style={{ border: "none", background: C.searchBg, cursor: "pointer", borderRadius: 8,
                   padding: "4px 10px", fontSize: 12.5, color: C.textPrimary, display: "flex",
                   alignItems: "center", gap: 5 }}>
          <Plus size={14} color={C.textSecondary} /> Nova
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 8 }}>
        {figurinhas.length === 0 ? (
          <div style={{ padding: "28px 14px", textAlign: "center", color: C.textSecondary,
                        fontSize: 12.5, lineHeight: 1.6 }}>
            Nenhuma figurinha guardada.<br />
            Para guardar uma, abra o menu da figurinha na conversa e toque em
            "Adicionar às figurinhas favoritas".
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {figurinhas.map((u) => (
              // O "×" fica AQUI, e não só no menu da mensagem: quem quer tirar
              // uma figurinha da lista está olhando para a lista, não
              // procurando a conversa de três semanas atrás em que ela apareceu.
              <span key={u} onMouseEnter={() => aoPassarMouse(u)} onMouseLeave={() => aoPassarMouse(null)}
                style={{ position: "relative", display: "flex" }}>
                <button onClick={() => aoEnviar(u)} title="Enviar esta figurinha"
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, borderRadius: 8 }}>
                  <img src={u} alt="figurinha" style={{ width: 72, height: 72, objectFit: "contain" }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); aoRemover(u); }}
                  title="Remover das figurinhas favoritas" aria-label="Remover das figurinhas favoritas"
                  style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderRadius: "50%",
                           border: `1px solid ${C.divider}`, background: C.panel, cursor: "pointer",
                           display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                           opacity: figHover === u ? 1 : 0, transition: "opacity .12s" }}>
                  <X size={12} color={C.textSecondary} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {rodape}
    </div>
  );
}

// O RODAPÉ DA BOLHA — selos, hora e as marcas de entrega.
//
// No WhatsApp isso NÃO é uma linha embaixo do texto: é um bloco flutuante
// encostado à direita, que se acomoda na última linha da mensagem quando
// sobra espaço e só desce sozinho quando não sobra. É daí que vem a bolha
// "fina" — "Bom dia" ocupa uma linha, não duas.
//
// Por isso ele vem DEPOIS do texto no HTML: um float só pode ser colocado na
// linha em que aparece ou abaixo dela. Colocado antes, o texto contornaria a
// hora pela primeira linha, que é o oposto do que se quer.
//
// `flutuante = false` é o caso de quem não tem texto nenhum (áudio, vídeo,
// figurinha): aí ele volta a ser a linha de sempre, embaixo do anexo.
// `folgaDaSeta` — o espaço que a hora deixa livre para a seta do menu.
//
// Relato do escritório, com a tela do celular: "está cortando parte do horário
// do envio". Medido: a seta cobria 43px de uma hora que tem 46. Nove décimos
// dela, invisíveis.
//
// A seta do menu da mensagem é desenhada por cima do texto, no canto de cima à
// direita, com um degradê na cor da bolha atrás — e isso é bom: reservar espaço
// para ela o tempo todo engordava toda bolha curta por causa de um botão que só
// aparece ao passar o mouse.
//
// SÓ QUE NO CELULAR NÃO HÁ MOUSE, e por isso ela fica SEMPRE visível. Aí deixa
// de ser um botão que aparece: é um pedaço permanente da bolha. E numa bolha de
// duas linhas — nome de quem escreveu em cima, texto curto embaixo — o corpo
// dela alcança a linha de baixo e apaga a hora com o próprio degradê.
//
// O que é permanente ocupa espaço. No celular a hora se afasta o tanto que a
// seta ocupa; no computador a folga é zero e nada muda.
function MetaBolha({ C, m, saida, flutuante, aoReenviar }) {
  return (
    <span style={{
      ...(flutuante ? { float: "right", marginLeft: 10, marginTop: 4 }
                    : { justifyContent: "flex-end", marginTop: 2 }),
      display: "flex", alignItems: "center", gap: 3, height: 15,
      fontSize: 11, lineHeight: 1, whiteSpace: "nowrap", userSelect: "none",
      color: m._status === "erro" ? "#e53935" : C.textSecondary,
    }}>
      {m.fixada && <Pin size={12} color={C.textSecondary} />}
      {m.favorita && <Star size={12} color="#f4c430" fill="#f4c430" />}
      {/* Sem este selo o texto simplesmente muda: quem leu antes e volta
          depois vê outra coisa, sem saber se houve correção ou se a memória
          falhou. Fica à direita, junto da hora, como no WhatsApp. */}
      {m.editada && <span style={{ fontStyle: "italic", opacity: .85 }}>Editada</span>}
      {horaCurta(m.criado_em)}
      {saida && (
        m._status === "enviando" ? (
          <Clock size={13} color={C.textSecondary} />
        ) : m._status === "erro" ? (
          <span onClick={aoReenviar} data-reenviar title="Toque para reenviar" style={{ color: "#e53935", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
            <AlertCircle size={13} /> não enviado · reenviar
          </span>
        ) : (
          // Cinza = enviada; azul = lida (igual ao WhatsApp).
          <CheckCheck size={15} color={marcaLida(m.status) ? "#53bdeb" : "#8696a0"} />
        )
      )}
    </span>
  );
}

// POR QUE ESTA NÃO SAIU.
//
// Antes a bolha dizia só "não enviado". Quem atende ficava sem saber se o
// número está errado, se o cliente não tem WhatsApp, se a linha do escritório
// caiu ou se foi coisa de um minuto — e cada um desses casos pede uma ação
// diferente. Sem o motivo, a única ação possível era clicar em reenviar e
// torcer; num número sem WhatsApp, isso é clicar para sempre.
//
// Quando a ponte não reconhece o erro, aparece o texto técnico como ele veio.
// É feio, mas é verdadeiro — e uma frase genérica no lugar de um motivo
// desconhecido seria pior, porque pareceria resposta.
//
// O "dispensar" existe pelo mesmo motivo: falha que não tem conserto precisa
// poder sair da tela. Uma tela cheia de alarme que ninguém pode resolver é uma
// tela cujo alarme se aprende a ignorar.
function MotivoDoErro({ C, m, aoDispensar }) {
  const motivo = m._motivo || null;
  const detalhe = m._detalhe || null;
  if (!motivo && !detalhe) return null;
  return (
    // Encostado na bolha que ele explica: mesma margem da direita (a coluna do
    // avatar), largura parecida, empurrado para a direita. Solto à esquerda ele
    // parecia um recado de outra pessoa em vez de uma observação sobre aquela
    // mensagem. O fundo é o vermelho da bolha diluído — o mesmo tom em qualquer
    // um dos dois temas, porque é transparência e não cor fixa.
    <div data-motivo-erro style={{
      maxWidth: "min(420px, 72%)", marginLeft: "auto", marginRight: 34,
      marginTop: 2, marginBottom: 8, padding: "8px 11px",
      background: "rgba(229,87,63,.09)", border: "1px solid rgba(229,87,63,.55)",
      borderRadius: 9,
      fontSize: 12, lineHeight: 1.45, color: C.textPrimary,
    }}>
      {motivo || (
        <>
          Não deu para enviar, e o Zorvin não reconheceu o motivo. O que o
          servidor respondeu foi:
          <div style={{ marginTop: 4, fontFamily: "ui-monospace, monospace", fontSize: 11,
                        color: C.textSecondary, wordBreak: "break-word" }}>
            {String(detalhe).slice(0, 300)}
          </div>
        </>
      )}
      {aoDispensar && (
        <button onClick={aoDispensar} data-dispensar-aviso
                style={{ display: "block", marginTop: 6, border: "none", background: "transparent",
                         padding: 0, color: C.textSecondary, fontSize: 11.5, cursor: "pointer",
                         textDecoration: "underline" }}>
          Dispensar este aviso
        </button>
      )}
    </div>
  );
}

// EMPURRA DE VOLTA PARA DENTRO qualquer coisa que abra ao lado de uma bolha.
//
// A fileira de emojis e o menu nascem grudados na mensagem, e a mensagem pode
// estar em qualquer lugar da conversa. Numa bolha curta encostada na margem, a
// fileira nasce metade para fora e o primeiro emoji aparece cortado — foi
// exatamente o que aconteceu com o 👍.
//
// Mede depois de desenhar e desloca só o que faltou. `useLayoutEffect` e não
// `useEffect` porque isso tem de acontecer ANTES de a tela pintar: com o
// segundo, a fileira apareceria cortada por um quadro e depois pularia para o
// lugar, o que é pior do que ficar cortada.
//
// O limite é a caixa que rola, não a janela: quem corta o emoji é a borda da
// conversa, e o resto da tela (a lista de conversas, a barra lateral) não está
// disponível para ele.
function usarDentroDaTela(aberto, tudo) {
  const alvo = useRef(null);
  const [desloca, setDesloca] = useState(0);
  useLayoutEffect(() => {
    if (!aberto) { setDesloca(0); return; }
    const el = alvo.current;
    if (!el) return;
    let pai = el.parentElement, caixa = null;
    while (pai) {
      const o = window.getComputedStyle(pai);
      if (/(auto|scroll|hidden)/.test(o.overflowY) || /(auto|scroll|hidden)/.test(o.overflowX)) { caixa = pai; break; }
      pai = pai.parentElement;
    }
    const lim = caixa ? caixa.getBoundingClientRect()
                      : { left: 0, right: window.innerWidth };
    // Mede o retângulo sem o deslocamento anterior, senão cada abertura
    // empurraria a partir da posição já corrigida e a fileira andaria sozinha.
    const r = el.getBoundingClientRect();
    const esq = r.left - desloca, dir = r.right - desloca;
    const FOLGA = 10;
    let d = 0;
    if (esq < lim.left + FOLGA) d = (lim.left + FOLGA) - esq;
    else if (dir > lim.right - FOLGA) d = (lim.right - FOLGA) - dir;
    setDesloca(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tudo]);
  return [alvo, desloca];
}

// O ROSTO DE REAGIR, ao lado da bolha.
//
// Faz o que a seta também faz, e existe assim mesmo: reagir é a ação mais
// frequente da conversa, e pela seta ela custa dois cliques (abrir o menu,
// escolher). Pelo rosto custa um. O WhatsApp Web mantém os dois pelo mesmo
// motivo.
//
// Fica FORA da bolha, do lado de dentro da conversa: à esquerda de quem envia,
// à direita de quem recebe.
function RostoReagir({ C, saida, visivel, aberto, aoAbrir, aoReagir, aoVerTudo, tudo }) {
  // ABRE PARA O LADO EM QUE HÁ ESPAÇO, e era o contrário.
  //
  // O rosto de uma mensagem RECEBIDA fica à direita da bolha, e a fileira saía
  // dali para a esquerda — por cima da mensagem e para fora da margem. O espaço
  // livre está do outro lado: a bolha recebida encosta na esquerda, e a metade
  // direita da conversa está vazia. Nas mensagens que nós enviamos vale o
  // inverso.
  const ancora = saida ? { right: 0 } : { left: 0 };
  const [alvo, desloca] = usarDentroDaTela(aberto, tudo);
  return (
    <div data-menu-msg style={{ position: "relative", width: 26, flexShrink: 0, marginBottom: 2 }}>
      <button onClick={aoAbrir} title="Reagir" aria-label="Reagir"
        style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "transparent",
                 cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                 padding: 0, opacity: visivel ? 1 : 0, transition: "opacity .12s" }}>
        <Smile size={19} color={C.textSecondary} />
      </button>
      {aberto && (
        <div ref={alvo} style={{ position: "absolute", bottom: 32, ...ancora, zIndex: 20,
                                 transform: desloca ? `translateX(${desloca}px)` : "none" }}>
          {tudo ? (
            <PainelEmoji C={C} aoEscolher={aoReagir} largura={312} altura={232} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "5px 8px",
                          borderRadius: 999, background: C.panel, border: `1px solid ${C.divider}`,
                          boxShadow: "0 6px 20px rgba(0,0,0,.35)", whiteSpace: "nowrap" }}>
              {EMOJIS_REACAO.map((e) => (
                <button key={e} onClick={() => aoReagir(e)} title={`Reagir com ${e}`}
                  style={{ border: "none", background: "transparent", cursor: "pointer",
                           fontSize: 21, lineHeight: 1, padding: "2px 4px", borderRadius: 8 }}>{e}</button>
              ))}
              <button onClick={aoVerTudo} title="Mais emojis"
                style={{ border: "none", background: C.searchBg, cursor: "pointer", marginLeft: 4,
                         width: 26, height: 26, borderRadius: "50%", display: "flex",
                         alignItems: "center", justifyContent: "center", padding: 0 }}>
                <Plus size={16} color={C.textSecondary} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// O MENU DA MENSAGEM, como no WhatsApp Web.
//
// Passar o mouse na bolha mostra uma seta no canto; clicar nela abre a fileira
// de emojis em cima e as opções embaixo.
//
// Antes só existia um botão de responder no canto e um rosto flutuante ao lado
// da bolha. Dois controles soltos para duas ações, e sem lugar para a terceira:
// cada opção nova precisaria de mais um ícone disputando o mesmo canto.
//
// Só aparecem aqui as opções QUE FAZEM ALGUMA COISA. Encaminhar, fixar,
// favoritar e apagar mensagem ainda não existem no Zorvin, e um item de menu
// que não funciona é pior que a ausência dele: ensina a equipe a desconfiar do
// menu inteiro.
function MenuMensagem({ C, saida, tudo, paraCima, aoVerTudo, aoReagir, aoResponder, aoCopiar, aoEncaminhar, aoEditar, aoFixar, aoFavoritar, aoApagar, temTexto, podeEditar, fixada, favorita, ehFigurinha, figurinhaGuardada, aoGuardarFigurinha }) {
  // PARA CIMA OU PARA BAIXO. Na metade de baixo da tela o menu abre para cima,
  // senão o da última mensagem sai pela borda e fica inalcançável.
  //
  // `column-reverse` faz a fileira de emojis — que continua sendo o primeiro
  // filho — descer para baixo do menu, que é como o WhatsApp desenha quando
  // abre para cima. Sem isso a fileira ficaria colada no topo da tela, longe do
  // dedo de quem acabou de clicar.
  const ancora = { ...(saida ? { right: 0 } : { left: 0 }),
                   ...(paraCima ? { bottom: 22 } : { top: 22 }) };
  const [alvo, desloca] = usarDentroDaTela(true, tudo);
  const ITEM = {
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "9px 14px", border: "none", background: "transparent",
    cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left",
  };
  return (
    <div data-menu-msg ref={alvo} style={{ position: "absolute", ...ancora, zIndex: 20,
                  transform: desloca ? `translateX(${desloca}px)` : "none",
                  display: "flex", flexDirection: paraCima ? "column-reverse" : "column",
                  alignItems: saida ? "flex-end" : "flex-start", gap: 6 }}>
      {tudo ? (
        <PainelEmoji C={C} aoEscolher={aoReagir} largura={312} altura={232} />
      ) : (
        <>
          {/* A FILEIRA DE EMOJIS fica ACIMA do menu, e não dentro dele: reagir
              é um toque só, e enterrá-la numa lista transformaria o gesto mais
              rápido no mais lento. */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "5px 8px",
                        borderRadius: 999, background: C.panel, border: `1px solid ${C.divider}`,
                        boxShadow: "0 6px 20px rgba(0,0,0,.35)", whiteSpace: "nowrap" }}>
            {EMOJIS_REACAO.map((e) => (
              <button key={e} onClick={() => aoReagir(e)} title={`Reagir com ${e}`}
                style={{ border: "none", background: "transparent", cursor: "pointer",
                         fontSize: 21, lineHeight: 1, padding: "2px 4px", borderRadius: 8 }}>{e}</button>
            ))}
            <button onClick={aoVerTudo} title="Mais emojis"
              style={{ border: "none", background: C.searchBg, cursor: "pointer", marginLeft: 4,
                       width: 26, height: 26, borderRadius: "50%", display: "flex",
                       alignItems: "center", justifyContent: "center", padding: 0 }}>
              <Plus size={16} color={C.textSecondary} />
            </button>
          </div>

          <div style={{ width: 208, background: C.panel, border: `1px solid ${C.divider}`,
                        borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                        overflow: "hidden", padding: "4px 0" }}>
            <button onClick={aoResponder} style={ITEM}>
              <Reply size={17} color={C.textSecondary} /> Responder
            </button>
            {temTexto && (
              <button onClick={aoCopiar} style={ITEM}>
                <Copy size={17} color={C.textSecondary} /> Copiar
              </button>
            )}
            <button onClick={aoVerTudo} style={ITEM}>
              <Smile size={17} color={C.textSecondary} /> Reagir
            </button>
            <button onClick={aoEncaminhar} style={ITEM}>
              <Forward size={17} color={C.textSecondary} /> Encaminhar
            </button>
            {/* EDITAR só nas mensagens que NÓS mandamos e que têm texto: a
                Uazapi só edita o que saiu da própria linha, e não há o que
                editar numa foto. Oferecer nos outros casos seria um botão que
                falha sempre. */}
            {podeEditar && (
              <button onClick={aoEditar} style={ITEM}>
                <Pencil size={17} color={C.textSecondary} /> Editar
              </button>
            )}
            <button onClick={aoFixar} style={ITEM}>
              <Pin size={17} color={fixada ? C.green : C.textSecondary} /> {fixada ? "Desafixar" : "Fixar"}
            </button>
            <button onClick={aoFavoritar} style={ITEM}>
              <Star size={17} color={favorita ? "#f4c430" : C.textSecondary} /> {favorita ? "Desfavoritar" : "Favoritar"}
            </button>
            {/* GUARDAR A FIGURINHA. Só aparece em figurinha, e o nome diz
                "figurinhas favoritas" por inteiro: "Favoritar", logo acima,
                é outra coisa — marca a MENSAGEM na conversa. Dois itens
                chamados quase igual, um do lado do outro, seriam o mesmo que
                não ter nenhum. */}
            {ehFigurinha && (
              <button onClick={aoGuardarFigurinha} style={ITEM}>
                <Sticker size={17} color={figurinhaGuardada ? C.green : C.textSecondary} />
                {figurinhaGuardada ? "Remover das figurinhas favoritas" : "Adicionar às figurinhas favoritas"}
              </button>
            )}
            {/* APAGAR fica separado por uma linha e em vermelho: é a única
                opção do menu que não tem volta, e a distância do resto existe
                para o dedo não escorregar do Favoritar para ela. */}
            {/* APAGAR só nas mensagens que NÓS enviamos.
                A rota da Uazapi apaga para todos e aceita mensagem recebida
                também — mas aqui é escritório de advocacia: o que o cliente
                escreveu é registro do atendimento, e ninguém da equipe deve
                poder sumir com ele. Fica separado e em vermelho porque é a
                única opção do menu que não tem volta. */}
            {/* UM "Apagar" só, como no WhatsApp. Ele não apaga nada: liga o
                modo de seleção com esta mensagem já marcada. A escolha entre
                "para todos" e "só no Zorvin" vem depois, na lixeira — e vale
                para tudo o que foi marcado.
                Perguntar antes de saber QUANTAS mensagens é que estava errado:
                quem quer apagar cinco não deveria responder a mesma pergunta
                cinco vezes. */}
            {saida && (
              <>
                <div style={{ height: 1, background: C.divider, margin: "4px 0" }} />
                <button onClick={aoApagar} style={{ ...ITEM, color: "#e53935" }}>
                  <Trash2 size={17} color="#e53935" /> Apagar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// A PRIMEIRA PÁGINA DE UM ARQUIVO, quando o navegador sabe desenhá-la.
//
// SEM BIBLIOTECA NENHUMA, e isso é a decisão principal deste componente. Um
// leitor de PDF em JavaScript pesa mais do que o painel inteiro, e seria
// baixado por toda pessoa que abre a tela — para um recurso que aparece em
// algumas bolhas. O `<iframe>` usa o leitor que o próprio navegador já tem.
//
// SEM CLIQUE E SEM ROLAGEM DENTRO DELA: `pointerEvents: none`. A prévia mora
// dentro de um link que baixa o arquivo; um iframe que aceita o clique
// engoliria o clique do link, e um que rola faria a roda do mouse parar a
// conversa para rolar um PDF sem querer.
//
// QUANDO NÃO DÁ, NÃO NASCE NADA. Word, Excel e PowerPoint não têm leitor
// nativo, e mandá-los a um conversor de terceiros seria despachar documento de
// cliente para fora do escritório. Nesses, `comoPrever` devolve nulo e a bolha
// fica com o cartão de sempre — que agora ao menos diz o tipo por extenso.
function PreviaDeArquivo({ C, url, mime, nome, altura = 150 }) {
  const como = comoPrever(mime, nome);
  if (!url || !como) return null;

  const moldura = {
    height: altura, width: "100%", background: C.searchBg,
    borderBottom: `1px solid ${C.divider}`, overflow: "hidden",
    display: "grid", placeItems: "center",
  };

  if (como === "imagem") {
    return (
      <div style={moldura} data-previa-arquivo="imagem">
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  // `#toolbar=0…` esconde os controles do leitor: numa miniatura de 150px eles
  // ocupariam metade da altura e não servem para nada — o arquivo abre inteiro
  // com um clique. São ignorados por quem não os entende, sem quebrar nada.
  const endereco = como === "pdf"
    ? `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
    : url;

  return (
    <div style={{ ...moldura, position: "relative" }} data-previa-arquivo={como}>
      <iframe src={endereco} title={nome || "prévia"} tabIndex={-1} loading="lazy"
              style={{ width: "100%", height: "100%", border: "none",
                       pointerEvents: "none", background: "#fff" }} />
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

// A LISTA DE BOLHAS, FORA DO CAMINHO DA TECLA.
//
// Segunda frente da lentidão que o escritório relatou. O texto que está sendo
// digitado é estado do painel inteiro, então cada tecla mandava o React
// redesenhar tudo — inclusive as centenas de bolhas do histórico, que não
// mudaram nada. Medido num computador quatro vezes mais lento (o que há no
// escritório): 42 ms por tecla com 123 bolhas e 75 ms com 275, crescendo
// 0,22 ms por bolha. Numa conversa de cliente antigo, com o histórico do
// WhatsApp importado, são milhares de bolhas — e a digitação anda atrás do dedo.
//
// A lista mora aqui fora, embrulhada em `React.memo`: quando só o rascunho
// mudou, nenhuma propriedade daqui mudou, e o React pula o desenho inteiro.
//
// POR QUE UM COMPONENTE À PARTE, E NÃO UM `useMemo` LÁ DENTRO. As duas coisas
// dariam o mesmo ganho, e o `useMemo` não precisaria mover uma linha — mas ele
// pede uma lista de dependências escrita à mão, e são dezenas. Esquecer uma não
// dá erro nenhum: dá uma bolha VELHA na tela, o tique de lida que não muda, a
// reação que não aparece. Aqui fora, qualquer coisa que eu esqueça de passar
// não existe, e a tela quebra na primeira vez que roda, dizendo o nome. Prefiro
// o erro que grita ao erro que mente.
//
// A lista de propriedades é longa de propósito: ela é o contrato do que uma
// bolha precisa saber. Encurtá-la passando o painel inteiro num objeto faria o
// `memo` nunca bater — objeto novo a cada desenho é propriedade nova.
const ListaDeBolhas = React.memo(function ListaDeBolhas({
  mensagens, C, modo, estreito, conversa, meuNome, equipe,
  selecao, msgHover, setMsgHover, alternarSelecao, podeSerApagada,
  buscaAberta, buscaConversa, msgDestacada, idDivisorNaoLidas,
  quemFalou, nomeDeHoje, podeMexerNaNota, dentroDoPrazoDeEdicao,
  reagindo, setReagindo, reagindoTudo, setReagindoTudo, reagir,
  rostoAberto, setRostoAberto, menuParaCima,
  iniciarEdicao, iniciarResposta, copiarMensagem, marcarMensagem,
  reenviar, dispensarFalha,
  figurinhaEhFavorita, alternarFigurinhaFavorita, figurinhas,
  // Os `set...` e os `ref` são estáveis por natureza — o React garante que não
  // mudam de identidade —, então passá-los não estraga o `memo`. `pertoDoFim`
  // é estado, e muda quando a pessoa rola para longe do fim: a lista redesenha
  // aí, o que é raro e é o comportamento de antes.
  fimRef, inputRef, pertoDoFim, setMenuParaCima,
  setSelecao, setRascunho, setEditando, setRespondendo, setModoNota,
  // O PROCESSO DA NOTA ENTRA AQUI porque editar uma nota agora abre a barra do
  // processo já apontando para o que ela tem. Faltando o `set`, o botão de
  // editar estourava com "setProcessoDaNota is not defined" — este componente
  // é uma função à parte, e nada do `Painel` chega nele sem ser passado.
  setProcessoDaNota,
  setEncaminhar, setBuscaEncaminhar, setImagemAberta, setRetratoAberto,
  setNotaParaApagar,
}) {

  return mensagens.map((m, i) => {
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
    // Quem escreveu, com o nome e a foto DE HOJE.
    const quem = quemFalou(m);
    // Última mensagem de uma sequência do mesmo remetente: recebe o
    // avatarzinho à direita (como o WhatsApp mostra a foto do grupo).
    //
    // A comparação é pelo NOME DE HOJE, e não pelo gravado: quem
    // trocou de nome no meio de uma sequência tinha a sequência
    // partida em duas, com um avatar sobrando no meio — a tela
    // desenhava duas pessoas onde há uma.
    const proxima = mensagens[i + 1];
    const ultimaDoGrupo = !proxima || proxima.origem !== m.origem ||
      quemFalou(proxima).nome !== quem.nome ||
      new Date(proxima.criado_em).toDateString() !== new Date(m.criado_em).toDateString();
    // Figurinha COM o desenho flutua sem bolha, como no WhatsApp.
    // Sem o desenho, ela precisa da bolha de volta: o aviso de
    // "figurinha indisponível" sobre o fundo da conversa, sem
    // moldura, não se lê como mensagem.
    const figurinhaNua = m.tipo === "figurinha" && Boolean(m.midia_url);
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
                <span style={{ fontSize: 12.5, fontWeight: 700, color: corNome(quem.nome, modo) }}>{quem.nome || "equipe"}</span>
                <span style={{ fontSize: 11, color: C.textSecondary }}>• {horaCurta(m.criado_em)}</span>
              </div>
              {/* A NOTA APAGADA VIRA LÁPIDE, e não some da conversa.
                  Nota interna é onde fica registrado o que se
                  combinou com o cliente; uma que desaparece sem
                  rastro vira "eu jurava que tinha anotado". O texto
                  sai da tela — mas quem apagou, e quando, ficam.
                  A bolha perde a cor: o laranja é para o que se lê,
                  e ali não há mais nada para ler. */}
              {m.apagada_em ? (
                <div style={{ background: C.bubbleIn, color: C.textSecondary, borderRadius: 8,
                              padding: "7px 11px 6px", border: `1px dashed ${C.divider}`,
                              minWidth: 120, fontSize: 13, fontStyle: "italic",
                              display: "flex", alignItems: "center", gap: 6 }}>
                  <Trash2 size={13} />
                  Nota interna apagada por {nomeDeHoje(m.apagada_por_id, m.apagada_por) || "alguém"} · {horaCurta(m.apagada_em)}
                </div>
              ) : (
              <div style={{ position: "relative", background: "#a35e0c", color: "#fff", borderRadius: 8, padding: "7px 11px 6px", boxShadow: "0 1px 0.5px rgba(0,0,0,.2)", minWidth: 120 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 1 }}>{quem.nome || "equipe"}:</div>
                <div style={{ fontSize: 14, lineHeight: 1.35, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{formatarTexto(m.texto, "#fff3d6")}</div>
                {/* O PROCESSO A QUE A NOTA SE REFERE, quando tem um.
                    Sem isto, a escolha existiria e ninguém a veria:
                    a informação estaria no banco e no Vantoro, e a
                    conversa — que é onde a equipe lê — não diria de
                    qual ação se está falando.
                    Nota geral não mostra nada. Escrever "sem
                    processo" em todas encheria a conversa de uma
                    linha que não informa, já que é o caso comum.

                    A CONDIÇÃO É O `processo_id`, e não o número.
                    Ação ainda não distribuída não tem número: pelo
                    número, essas notas ficavam ligadas ao processo
                    no banco e MUDAS na tela — o vínculo existia sem
                    aparecer, que é o mesmo que não existir para quem
                    lê. Pelo id, toda nota vinculada se anuncia. */}
                {m.processo_id && (
                  <div data-nota-processo
                       style={{ marginTop: 5, fontSize: 11.5, fontWeight: 600,
                                color: "rgba(255,255,255,.92)",
                                background: "rgba(0,0,0,.18)", borderRadius: 5,
                                padding: "3px 7px", display: "inline-flex",
                                alignItems: "center", gap: 5, overflowWrap: "anywhere" }}>
                    <ClipboardList size={12} />
                    {rotuloDoProcesso({ id: m.processo_id, numero: m.processo_numero,
                                        reu: m.processo_reu })}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 10.5, color: "rgba(255,255,255,.85)", marginTop: 3 }}>
                  {/* "editada" fica junto do horário, como nas
                      mensagens: quem lê precisa saber que o que
                      está ali não é o que foi escrito primeiro. */}
                  {m.editada_em && <span title={`Editada por ${nomeDeHoje(m.editada_por_id, m.editada_por) || "alguém"}`}>editada ·</span>}
                  <StickyNote size={11} /> Mensagem interna{m._status === "enviando" ? " · salvando…" : ""}
                </div>
                {/* O menu aparece ao passar o rato, como o das
                    mensagens. Só para quem pode mexer — oferecer e
                    depois recusar é pior do que não oferecer. */}
                {podeMexerNaNota(m) && !m._status && (
                  <span style={{ position: "absolute", top: 2, right: 4, display: "flex", gap: 2 }}>
                    {/* EDITAR A NOTA É ESCREVER A NOTA.
                        Aqui estava `setModoNota(false)`: a caixa voltava ao
                        modo mensagem — verde, "Corrija a mensagem e aperte
                        Enter" — para corrigir uma NOTA. E como a barra do
                        processo só existe no modo nota, não havia como trocar
                        o processo vinculado: a única saída era apagar a nota e
                        escrever outra, perdendo quem a escreveu e quando.
                        Agora é o mesmo campo âmbar, com a mesma barra de
                        processo, já apontando para o processo que a nota tem. */}
                    <button onClick={() => { setRespondendo(null); setModoNota(true); setEditando(m); setRascunho(m.texto || ""); setProcessoDaNota(m.processo_id ? String(m.processo_id) : ""); setTimeout(() => inputRef.current?.focus(), 0); }}
                            title="Editar nota"
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(255,255,255,.75)", padding: 3, display: "flex", minHeight: estreito ? 40 : 24, minWidth: estreito ? 40 : 24, alignItems: "center", justifyContent: "center" }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setNotaParaApagar(m)}
                            title="Apagar nota"
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(255,255,255,.75)", padding: 3, display: "flex", minHeight: estreito ? 40 : 24, minWidth: estreito ? 40 : 24, alignItems: "center", justifyContent: "center" }}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
              )}
            </div>
            <div style={{ width: 28, flexShrink: 0 }}><Avatar nome={quem.nome || "equipe"} foto={quem.foto} size={28} /></div>
          </div>
        ) : (
        <div data-msg-id={m.id} onClick={() => { if (selecao && podeSerApagada(m)) alternarSelecao(m.id); }} onMouseEnter={() => setMsgHover(m.id)} onMouseLeave={() => setMsgHover((h) => (h === m.id ? null : h))} style={{ position: "relative", display: "flex", justifyContent: saida ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6,
          /* A bolha que respondeu à busca. Rolar até ela sem marcá-la
             deixaria a pessoa no meio da conversa sem saber qual é. */
          ...(String(m.id) === msgDestacada
              ? { background: C.listActive, borderRadius: 10, padding: "4px 6px",
                  margin: "2px -6px", transition: "background .4s" }
              : null),
          marginTop: mesmoRemetente ? -4 : 0, marginBottom: (Array.isArray(m.reacoes) && m.reacoes.length) ? 15 : 0, paddingLeft: selecao ? 34 : 0, transition: "padding-left .12s" }}>
          {/* A CAIXINHA DE SELEÇÃO. Aparece em TODA linha para o
              alinhamento não dançar, mas só é clicável no que dá
              para apagar — o que o escritório enviou. Nas demais
              fica um espaço vazio, e a conversa não se desmonta ao
              entrar no modo. */}
          {/* NUMA COLUNA FIXA À ESQUERDA, e não colada em cada balão.
              Como filha do flex, a caixinha era empurrada junto com
              a bolha — que é alinhada à direita quando a mensagem é
              nossa — e cada linha punha a dela num lugar diferente.
              Presa em `left: 8`, todas caem no mesmo eixo, e a linha
              ganha um recuo do mesmo tamanho para nada ficar por
              baixo. É assim que o WhatsApp desenha. */}
          {selecao && (
            <span onClick={(e) => { e.stopPropagation(); if (podeSerApagada(m)) alternarSelecao(m.id); }}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                       // Do tamanho da do WhatsApp: a caixinha é uma
                       // marca ao lado da conversa, não um botão a
                       // disputar atenção com a mensagem. A área de
                       // clique continua maior que o desenho, pelo
                       // recuo que a linha inteira ganha.
                       width: 18, height: 18, borderRadius: 4, boxSizing: "border-box",
                       display: "flex", alignItems: "center", justifyContent: "center",
                       cursor: podeSerApagada(m) ? "pointer" : "default",
                       border: podeSerApagada(m) ? `1.5px solid ${selecao.includes(m.id) ? C.green : C.textSecondary}` : "1.5px solid transparent",
                       background: selecao.includes(m.id) ? C.green : "transparent" }}>
              {selecao.includes(m.id) && <Check size={12} strokeWidth={3} color="#fff" />}
            </span>
          )}
          {m.id_uazapi && !m.apagada && saida && (
            <RostoReagir C={C} saida={saida} tudo={reagindoTudo}
              visivel={estreito || msgHover === m.id || rostoAberto === m.id}
              aberto={rostoAberto === m.id}
              aoAbrir={() => { setReagindo(null); setReagindoTudo(false); setRostoAberto((r) => (r === m.id ? null : m.id)); }}
              aoVerTudo={() => setReagindoTudo(true)}
              aoReagir={(e) => { setRostoAberto(null); reagir(m, e); }} />
          )}
          <div style={{ position: "relative", maxWidth: estreito ? "84%" : "65%", background: figurinhaNua ? "transparent" : (saida ? C.bubbleOut : C.bubbleIn), color: C.textPrimary, borderRadius: 8, padding: figurinhaNua ? 0 : (m.tipo === "imagem" ? 4 : (estreito ? "5px 40px 6px 9px" : "5px 7px 6px 9px")), boxShadow: figurinhaNua ? "none" : "0 1px 0.5px rgba(0,0,0,.15)", outline: casa ? "2px solid #f4c430" : "none" }}>
            {/* O RÓTULO NÃO É UM NOME, e não se veste de nome.
                Em negrito e colorido como os outros, "Pelo celular"
                se lia como alguém chamado assim. Em cinza, com o
                desenho de um telefone, se lê como o que é: a
                mensagem saiu daqui, mas não por aqui. */}
            {mostrarAutor && (
              quem.aparelho || quem.rotulo ? (
                <div title={quem.aparelho
                      ? "Saiu pelo aplicativo do WhatsApp, fora do Zorvin — o WhatsApp não diz qual atendente escreveu."
                      : "Rótulo do histórico importado, e não uma pessoa do escritório."}
                     style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5,
                              fontWeight: 600, color: C.textSecondary, marginBottom: 1 }}>
                  {quem.aparelho ? <Smartphone size={12} /> : <History size={12} />}
                  {quem.nome}
                </div>
              ) : (
                <div style={{ fontSize: 12, fontWeight: 700, color: corNome(quem.nome, modo), marginBottom: 1 }}>{quem.nome}</div>
              )
            )}
            {m.id_uazapi && !m.apagada && (
              <button data-menu-msg onClick={(ev) => {
                // PARA CIMA OU PARA BAIXO, conforme onde a bolha está.
                // Aberto sempre para baixo, o menu da última mensagem
                // saía pela borda inferior e ficava inalcançável.
                const r = ev.currentTarget.getBoundingClientRect();
                setMenuParaCima(r.bottom > window.innerHeight * 0.55);
                setReagindoTudo(false);
                setRostoAberto(null);
                setReagindo((x) => (x === m.id ? null : m.id));
              }} title="Mais opções" aria-label="Opções da mensagem" style={{
                // A SETA FICA POR CIMA DO TEXTO, com um esmaecido
                // atrás. Antes o texto era empurrado 42px para a
                // esquerda o tempo todo só para abrir espaço para
                // uma seta que aparece no passar do mouse — e era
                // esse recuo que engordava toda bolha curta. O
                // WhatsApp resolve assim: a seta sobrepõe, e o
                // degradê na cor da bolha mantém a leitura.
                position: "absolute", top: 0, right: 0, border: "none", cursor: "pointer",
                opacity: (estreito || msgHover === m.id || reagindo === m.id) ? 0.9 : 0,
                transition: "opacity .12s", display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                // NO CELULAR A SETA TEM COLUNA PRÓPRIA, e por isso perde o degradê.
                //
                // Ela não some nunca ali (não há mouse para tirá-la), então
                // deixa de ser um botão que aparece e vira parte da bolha. O
                // que é permanente ocupa espaco: a bolha abre uma coluna a
                // direita (ver o `padding` dela), e com nada por baixo o
                // degrade viraria so uma mancha na quina.
                //
                // No computador continua como estava: a seta sobrepoe o texto
                // e o degrade mantem a leitura. Reservar a coluna la tambem
                // engordaria toda bolha curta por causa de um botao que so
                // aparece ao passar o mouse.
                padding: estreito ? "3px 5px 6px 8px" : "3px 3px 6px 30px",
                borderRadius: "0 8px 0 0",
                background: estreito ? "transparent"
                  : `linear-gradient(to left, ${saida ? C.bubbleOut : C.bubbleIn} 45%, transparent)`,
              }}>
                <ChevronDown size={17} color={C.textSecondary} />
              </button>
            )}
            {reagindo === m.id && (
              <MenuMensagem C={C} saida={saida} tudo={reagindoTudo}
                paraCima={menuParaCima}
                temTexto={Boolean(m.texto)}
                aoEncaminhar={() => { setReagindo(null); setReagindoTudo(false); setBuscaEncaminhar(""); setEncaminhar(m); }}
                podeEditar={Boolean(saida && m.texto && m.id_uazapi && dentroDoPrazoDeEdicao(m))}
                aoEditar={() => { setReagindo(null); setReagindoTudo(false); iniciarEdicao(m); }}
                fixada={Boolean(m.fixada)} favorita={Boolean(m.favorita)}
                aoFixar={() => { setReagindo(null); setReagindoTudo(false); marcarMensagem(m, "fixada", !m.fixada); }}
                aoFavoritar={() => { setReagindo(null); setReagindoTudo(false); marcarMensagem(m, "favorita", !m.favorita); }}
                ehFigurinha={m.tipo === "figurinha" && Boolean(m.midia_url)}
                figurinhaGuardada={figurinhaEhFavorita(m.midia_url)}
                aoGuardarFigurinha={() => { setReagindo(null); setReagindoTudo(false); alternarFigurinhaFavorita(m); }}
                aoApagar={() => { setReagindo(null); setReagindoTudo(false); setSelecao([m.id]); }}
                aoVerTudo={() => setReagindoTudo(true)}
                aoReagir={(e) => reagir(m, e)}
                aoResponder={() => { setReagindo(null); setReagindoTudo(false); iniciarResposta(m); }}
                aoCopiar={() => { setReagindo(null); setReagindoTudo(false); copiarMensagem(m); }} />
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
              <button onClick={() => { setRetratoAberto(false); setImagemAberta(m.midia_url); }} aria-label="Abrir a imagem em tela cheia"
                      style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "block", borderRadius: 6 }}>
                <img src={m.midia_url} alt="Imagem recebida na conversa" loading="lazy" decoding="async" onLoad={() => { if (pertoDoFim) fimRef.current?.scrollIntoView(); }} style={{ maxWidth: "min(260px, 62vw)", maxHeight: 320, width: "auto", height: "auto", borderRadius: 6, display: "block" }} />
              </button>
            )}
            {/* FIGURINHA. Eu ensinei a ponte a reconhecê-la e esqueci
                de ensinar a TELA a desenhá-la: o tipo novo não caía
                em nenhum dos ramos, e a bolha aparecia vazia — tanto
                a recebida quanto a que o próprio Zorvin mandou.
                Vai sem moldura e maior que uma imagem comum, como no
                WhatsApp: figurinha não tem fundo, ela flutua. */}
            {m.tipo === "figurinha" && (
              m.midia_url ? (
                <img src={m.midia_url} alt="Figurinha" loading="lazy" decoding="async"
                  onLoad={() => { if (pertoDoFim) fimRef.current?.scrollIntoView(); }}
                  style={{ width: 140, height: 140, objectFit: "contain", display: "block" }} />
              ) : (
                // SEM O ARQUIVO, mas com o registro. A bolha da
                // figurinha não tem fundo nem texto: sem arquivo
                // ela virava um espaço vazio na conversa, e a
                // equipe não tinha como saber que algo tinha
                // chegado ali. O aviso é o mesmo caminho do áudio
                // e do documento indisponíveis.
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary,
                              background: saida ? "rgba(0,0,0,.06)" : C.searchBg,
                              borderRadius: 6, padding: "8px 10px", fontSize: 13, fontStyle: "italic" }}>
                  <Sticker size={18} color={C.textSecondary} /> Figurinha indisponível
                </div>
              )
            )}
            {m.tipo === "audio" && <BolhaAudio C={C} saida={saida} url={m.midia_url} />}
            {m.tipo === "video" && m.midia_url && (
              <video controls preload="none" src={m.midia_url} style={{ maxWidth: "min(260px, 62vw)", borderRadius: 6, display: "block" }} />
            )}
            {m.tipo === "documento" && (
              m.midia_url ? (
                <a href={m.midia_url} target="_blank" rel="noopener noreferrer" download style={{ display: "block", textDecoration: "none", color: C.textPrimary, background: saida ? "rgba(0,0,0,.06)" : C.searchBg, borderRadius: 6, overflow: "hidden", minWidth: 180 }}>
                  {/* A PRIMEIRA PÁGINA, quando o navegador sabe
                      desenhar o arquivo. Numa banca o que chega o dia
                      inteiro é PDF — procuração, contrato, extrato,
                      intimação — e "Documento" não distingue a
                      procuração que se esperava do panfleto que
                      alguém encaminhou. Ver `src/arquivos.js` para o
                      que dá e o que não dá para prever, e por quê. */}
                  <PreviaDeArquivo C={C} url={m.midia_url}
                                   mime={m.midia_mime} nome={m.midia_nome} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
                    <FileText size={22} color={C.textSecondary} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{m.midia_nome || "Documento"}</span>
                      {/* O TIPO POR EXTENSO, embaixo do nome. "Planilha
                          do Excel" responde sozinho a pergunta que faz
                          alguém abrir o arquivo só para descobrir. */}
                      <span style={{ display: "block", fontSize: 11, color: C.textSecondary }}
                            data-doc-tipo={nomeDoTipo(m.midia_mime, m.midia_nome)}>
                        {nomeDoTipo(m.midia_mime, m.midia_nome)}
                      </span>
                    </span>
                    <Download size={16} color={C.textSecondary} />
                  </div>
                </a>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textPrimary, background: saida ? "rgba(0,0,0,.06)" : C.searchBg, borderRadius: 6, padding: "8px 10px", minWidth: 180 }}>
                  <FileText size={22} color={C.textSecondary} />
                  <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{m.midia_nome || "Documento"}</span>
                  <span style={{ fontSize: 11, color: C.textSecondary, fontStyle: "italic", flexShrink: 0 }}>indisponível</span>
                </div>
              )
            )}
            {/* O CONTATO APAGOU no WhatsApp — e a mensagem FICA aqui,
                com texto e anexo intactos. O que o cliente escreveu
                é registro do atendimento; um registro que a outra
                parte pode apagar depois não serve nem para conferir
                um combinado nem para se defender de uma reclamação.
                O aviso existe só para a equipe saber que houve a
                tentativa. */}
            {m.apagada_pelo_contato && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5,
                            fontStyle: "italic", color: "#e0a800", marginBottom: 3 }}>
                <Trash2 size={12} color="#e0a800" /> O contato apagou esta mensagem no WhatsApp
              </div>
            )}
            {/* O TEXTO E O RODAPÉ NO MESMO BLOCO.
                `flow-root` existe para que a bolha cresça junto
                com a hora flutuante: sem ele o float escapa da
                caixa e a última linha fica por baixo do balão. */}
            {(m.texto || m.apagada) && (
              <div style={{ fontSize: 14.2, lineHeight: 1.35, marginTop: m.tipo !== "texto" ? 4 : 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", display: "flow-root" }}>
                {m.apagada ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontStyle: "italic", color: C.textSecondary }}>
                    <Trash2 size={14} color={C.textSecondary} /> Esta mensagem foi apagada
                  </span>
                ) : formatarTexto(m.texto, C.link)}
                <MetaBolha C={C} m={m} saida={saida} flutuante aoReenviar={() => reenviar(m)}
 />
              </div>
            )}
            {/* AS REAÇÕES, COMO NO WHATSAPP WEB.
                Uma pastilha só, pendurada na quina de baixo da
                bolha e transbordando para fora dela. A borda é da
                COR DO FUNDO da conversa, e não uma linha cinza: é
                isso que dá o efeito de recorte: a pastilha parece
                colada por cima, não desenhada dentro.
                A primeira versão empilhava as pastilhas DENTRO da
                bolha, embaixo do texto — o emoji virava parte da
                mensagem, e duas reações ocupavam duas linhas de
                conversa. Aqui elas cabem todas numa pastilha só,
                que é como o WhatsApp agrupa.
                O lado acompanha o da bolha: quem recebe tem a
                pastilha à esquerda, quem envia à direita. Assim ela
                nasce sempre da quina de dentro. */}
            {Array.isArray(m.reacoes) && m.reacoes.length > 0 && (
              <div title={m.reacoes.map((r) => `${r.emoji} ${r.de === "advogado" ? "de quem atende" : "do contato"}`).join("  ·  ")}
                style={{ position: "absolute", bottom: -15, zIndex: 2,
                         ...(saida ? { right: 10 } : { left: 10 }),
                         display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                         minWidth: 22, height: 22, padding: "0 5px", borderRadius: 999,
                         background: saida ? C.bubbleOut : C.bubbleIn,
                         border: `2px solid ${C.chatBg}`,
                         boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                         fontSize: 14, lineHeight: 1, whiteSpace: "nowrap" }}>
                {m.reacoes.map((r, i) => <span key={i}>{r.emoji}</span>)}
              </div>
            )}
            {/* Sem texto — áudio, vídeo, figurinha, documento — não
                há última linha em que caber, e o rodapé volta a ser
                uma linha embaixo do anexo. */}
            {!m.texto && !m.apagada && (
              <MetaBolha C={C} m={m} saida={saida} aoReenviar={() => reenviar(m)} />
            )}
          </div>
          {m.id_uazapi && !m.apagada && !saida && (
            <RostoReagir C={C} saida={saida} tudo={reagindoTudo}
              visivel={estreito || msgHover === m.id || rostoAberto === m.id}
              aberto={rostoAberto === m.id}
              aoAbrir={() => { setReagindo(null); setReagindoTudo(false); setRostoAberto((r) => (r === m.id ? null : m.id)); }}
              aoVerTudo={() => setReagindoTudo(true)}
              aoReagir={(e) => { setRostoAberto(null); reagir(m, e); }} />
          )}
          {saida && (
            <div style={{ width: 28, flexShrink: 0 }}>{!ultimaDoGrupo ? null
              : (quem.aparelho || quem.rotulo)
                /* Sem bolinha de iniciais: "PC" num círculo colorido
                   é a cara de uma pessoa, e não há pessoa aqui. */
                ? <span title={quem.nome} style={{ width: 28, height: 28, borderRadius: "50%", background: C.bubbleIn,
                                border: `1px solid ${C.divider}`, display: "flex", alignItems: "center",
                                justifyContent: "center", flexShrink: 0 }}>
                    {/* Desenhos diferentes porque são coisas
                        diferentes: um celular para o que saiu pelo
                        aplicativo, o relógio do histórico para o
                        rótulo que veio da importação. */}
                    {quem.aparelho ? <Smartphone size={14} color={C.textSecondary} />
                                   : <History size={14} color={C.textSecondary} />}
                  </span>
                : <Avatar nome={quem.nome || meuNome} foto={quem.foto} size={28} />}</div>
          )}
        </div>
        )}
        {/* Fora da bolha, e logo abaixo dela: o motivo é sobre a
            mensagem, não parte do que foi escrito ao cliente. */}
        {m._status === "erro" && (
          <MotivoDoErro C={C} m={m}
            aoDispensar={m._filaId ? () => dispensarFalha(m) : null} />
        )}
      </React.Fragment>
    );
  });
});

export default function Painel({ sessao }) {
  // Tema começa pelo que foi salvo da última vez (claro/escuro).
  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem("zorvin_modo") || "claro"; } catch (_) { return "claro"; }
  });
  useEffect(() => {
    try { localStorage.setItem("zorvin_modo", modo); } catch (_) { /* ignora */ }
    // E CONTA AO NAVEGADOR. Sem isto ele desenha as coisas DELE na cor clara
    // por cima de um app escuro: a faixa branca em cima do teclado do iPhone,
    // as bordas brancas quando a tela balança, as barras de rolagem.
    aplicarAparencia(modo === "escuro", TEMAS[modo].headerBar);
  }, [modo]);
  const [advogados, setAdvogados] = useState([]);
  // Os departamentos saem do BANCO, não de uma lista escrita aqui: é isso que
  // permite criar um departamento novo sem mexer em código.
  const [departamentos, setDepartamentos] = useState([]);
  // As permissões desta pessoa, para a tela oferecer só o que ela pode usar.
  const [minhasPermissoes, setMinhasPermissoes] = useState([]);
  const [erroPermissoes, setErroPermissoes] = useState("");
  // O QUE NÃO DEU PARA LER na hora de montar o acesso, por extenso, para a
  // tela poder dizer "não consegui perguntar" em vez de "você não pode".
  // `tentativaDeAcesso` só existe para o botão de tentar de novo poder mandar
  // a leitura acontecer outra vez sem recarregar a página inteira.
  const [erroDoAcesso, setErroDoAcesso] = useState("");
  const [tentativaDeAcesso, setTentativaDeAcesso] = useState(0);
  const [departamentoId, setDepartamentoId] = useState(null);
  const [souAdmin, setSouAdmin] = useState(false);
  // A minha linha em `usuarios` — o espelho do cadastro do Vantoro. É de onde
  // sai o nome que a equipe vê.
  const [meuCadastro, setMeuCadastro] = useState(null);
  // "Por qual telefone você quer falar?" — só aparece quando o link do Vantoro
  // chega e a pessoa alcança mais de um telefone do escritório.
  const [escolhaTelefone, setEscolhaTelefone] = useState(null);
  const [telaAdmin, setTelaAdmin] = useState(false);
  // O Painel de números (quanto se falou, por telefone e por atendente).
  const [telaPainel, setTelaPainel] = useState(false);
  // JUNTAR DUAS CONVERSAS SAIU DO PAINEL — a pedido de quem administra.
  //
  // Era um item de menu que apagava uma conversa inteira em duas escolhas:
  // "esta some" e "as mensagens dela vão para". Sem desfazer. Ficava ao lado
  // de "Configurações", alcançável por qualquer administrador, e em toda a
  // vida do Zorvin ninguém nunca usou — nem o próprio administrador.
  //
  // Risco de um lado, uso zero do outro. Quando duas conversas precisarem
  // virar uma de verdade — o caso do grupo que nasceu com número esquisito —,
  // isso passa a ser feito no banco, com quem sabe o que está fazendo, e não
  // por um botão que se alcança sem querer no celular.
  //
  // A rota `/conversas/juntar` continua existindo na ponte, sem porta de
  // entrada no painel: é por ela que a correção manual passa quando precisar.
  // A BARRA DE FORMATAÇÃO — aparece quando há texto selecionado na caixa.
  //
  // Guarda só "aparece ou não". A posição não é guardada de propósito: ela sai
  // do próprio lugar da caixa, logo acima dela. Calcular o pixel exato da
  // seleção dentro de um <textarea> exige desenhar uma cópia invisível do
  // texto e medir — muito código para uma barra que, numa caixa de uma a três
  // linhas, ficaria a poucos milímetros de onde ela já está.
  const [formatoAberto, setFormatoAberto] = useState(false);
  // Qual botão da barra está sob o mouse — é o que mostra a legenda com o
  // atalho. Sem isto o atalho existiria e ninguém descobriria que existe.
  const [formatoHover, setFormatoHover] = useState(null);
  const [menuParaCima, setMenuParaCima] = useState(false); // o menu da bolha abre para cima?
  const [encaminhar, setEncaminhar] = useState(null);      // mensagem sendo encaminhada
  const [editando, setEditando] = useState(null);          // mensagem sendo editada
  // Nota que está prestes a ser apagada (mostra a confirmação). Apagar sem
  // perguntar seria irreversível num clique — e a lixeira fica ao lado do
  // lápis, a três milímetros dele.
  const [notaParaApagar, setNotaParaApagar] = useState(null);
  // Renomear o contato aqui dentro, sem passar pelo Vantoro. `null` = fechado;
  // uma string = o rascunho do nome.
  const [renomeando, setRenomeando] = useState(null);
  // MODO SELEÇÃO, como no WhatsApp: `null` = desligado; array = ids marcados.
  const [selecao, setSelecao] = useState(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  // Qual aba do painel único: os emojis ou as figurinhas.
  const [abaEmoji, setAbaEmoji] = useState("emoji");
  const [figurinhas, setFigurinhas] = useState([]);        // URLs guardadas de propósito
  const [figHover, setFigHover] = useState(null);          // qual delas está sob o mouse
  const [buscaEncaminhar, setBuscaEncaminhar] = useState("");
  const [advogadoId, setAdvogadoId] = useState(null);
  // Quem o Vantoro achou e o Zorvin ainda não conhece por este telefone. Ver o
  // comentário longo em `procurarNoVantoro`.
  const [semConversa, setSemConversa] = useState([]);
  // Se a pergunta "quais números eu alcanço?" já foi respondida. Ver o
  // comentário longo no efeito que carrega telefones e departamentos.
  const [acessoConferido, setAcessoConferido] = useState(false);
  const [conversas, setConversas] = useState([]);
  // DE QUEM É a lista que está em `conversas` neste instante.
  //
  // Sem isto, `conversas` era tratada como sendo sempre do telefone
  // selecionado — e, entre o clique e a resposta da consulta, ela ainda é do
  // telefone ANTERIOR. Era o "pisca": o selo do telefone novo, o chip
  // "Não lidas N" e a própria lista mostravam, por um instante, o dado do
  // telefone que acabou de sair da tela. Numa rede lenta o instante vira
  // segundos, e alguém responde a conversa errada achando que é a que via.
  const [conversasDe, setConversasDe] = useState(null);
  const [conversaId, setConversaId] = useState(null);
  // A lista carregada é do telefone que está aberto? Enquanto não for, NADA que
  // venha dela pode ser mostrado como se fosse dele — nem o selo, nem o chip
  // "Não lidas N", nem as linhas da lista.
  const listaEhDoTelefoneAberto = Boolean(advogadoId) && conversasDe === advogadoId;
  // O que a tela pode desenhar agora. Um lugar só: usando `conversas` direto,
  // cada contador precisaria lembrar sozinho de conferir, e um deles esqueceria.
  // Sem telefone aberto a lista é vazia — `carregarConversas` sai cedo quando
  // não há telefone, então `conversas` guardaria a do departamento anterior.
  const conversasNaTela = listaEhDoTelefoneAberto ? conversas : [];
  // Tem telefone escolhido, mas a lista dele ainda não chegou.
  const trocandoDeTelefone = Boolean(advogadoId) && !listaEhDoTelefoneAberto;
  // Ficha do cliente no Vantoro (abre ao lado da conversa).
  const [fichaAberta, setFichaAberta] = useState(false);
  // "Histórico de atendimento": quem falou com este cliente, quando e por qual
  // telefone do escritório. `null` = fechado.
  const [historico, setHistorico] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false); // exibindo a lista de arquivadas
  const [contatosLista, setContatosLista] = useState([]); // todos os contatos (agenda)
  const [buscaContato, setBuscaContato] = useState(""); // busca na agenda de contatos
  const [contatoForm, setContatoForm] = useState(null); // { nome, numero } ao criar um contato
  const [novaConversaAberta, setNovaConversaAberta] = useState(false); // tela "Nova conversa" (⊞)
  // Clientes do VANTORO que casam com o que está sendo digitado na Nova
  // conversa. Ficam separados de `contatosLista` de propósito: um é a agenda do
  // Zorvin (gente com quem já se falou), o outro é o cadastro do escritório
  // (gente que talvez nunca tenha recebido mensagem).
  const [vantoroAchados, setVantoroAchados] = useState([]);
  const [vantoroBuscando, setVantoroBuscando] = useState(false);
  const [vantoroErro, setVantoroErro] = useState("");
  // A ORDEM DA LISTA — mais recentes ou mais antigas primeiro.
  //
  // Pedida por quem administra. O uso é achar o que ficou para trás: com a
  // lista sempre pela mais recente, uma conversa parada há três semanas fica
  // no fim de tudo e ninguém rola até lá.
  //
  // ELA VAI PARA A CONSULTA, e não para uma reordenação da lista já carregada.
  // A lista vem do banco em páginas de 200: virar o que já está na tela
  // mostraria a mais antiga DAS CARREGADAS, que numa conta com mil conversas
  // não é nem de longe a mais antiga. Seria uma resposta errada com cara de
  // certa — e é justamente para essa pergunta que o filtro existe.
  const [ordem, setOrdem] = useState(() => {
    try { return localStorage.getItem("zorvin_ordem") === "antigas" ? "antigas" : "recentes"; }
    catch (_) { return "recentes"; }
  });
  const ordemRef = useRef(ordem);
  useEffect(() => {
    ordemRef.current = ordem;
    try { localStorage.setItem("zorvin_ordem", ordem); } catch (_) { /* ignora */ }
  }, [ordem]);
  const [menuOrdem, setMenuOrdem] = useState(false);
  const ordemMenuRef = useRef(null);

  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [atendimentos, setAtendimentos] = useState({}); // { conversaId: { por, em } }
  const [ultimasMidias, setUltimasMidias] = useState({}); // { conversaId: tipo } da última mensagem, se mídia
  const [digitandos, setDigitandos] = useState({}); // { conversaId: digitando_ate (ISO) }
  const [naoLidasPorAdv, setNaoLidasPorAdv] = useState({}); // { advogadoId: total de não lidas }
  // NÃO LIDAS QUE ESTÃO DENTRO DAS ARQUIVADAS, contadas no banco.
  //
  // Elas ficam de fora do selo — conversa arquivada não entra na fila de
  // atendimento —, mas "não conta lá" não pode virar "não existe": são
  // mensagens de cliente que ninguém leu. Este número é o que impede que elas
  // sumam para sempre atrás de uma pasta que ninguém tem motivo para abrir, e
  // por isso ele mesmo não pode ser menor do que a verdade.
  // { total, naoLidas } das arquivadas do telefone aberto, contadas no BANCO.
  const [arquivadasNoBanco, setArquivadasNoBanco] = useState({});
  const [tique, setTique] = useState(0); // força re-render p/ esconder "digitando…" ao expirar

  // QUANTAS CONVERSAS A LISTA DESENHA DE UMA VEZ.
  //
  // Ela desenhava TODAS. Num telefone com dois anos de histórico são as 1000 que
  // a API devolve, e cada linha tem avatar, nome, prévia, hora e selos: medido
  // num computador de escritório (processador 4× mais lento que o meu), o
  // navegador ficava com 13 mil elementos na tela e cada tecla digitada na
  // busca levava 297 ms para aparecer. Digitar "andre" travava a tela por um
  // segundo e meio.
  //
  // Agora ela desenha uma página, e mais uma a cada vez que a rolagem se
  // aproxima do fim. O que está fora da tela não custa nada — e ninguém lê a
  // conversa número 700 sem rolar até ela.
  const PAGINA = 40;
  const [quantasNaLista, setQuantasNaLista] = useState(PAGINA);
  // Quantas conversas vêm do BANCO por vez, e se ainda há mais para buscar.
  const PAGINA_BANCO = 200;
  const [paginaConversas, setPaginaConversas] = useState(0);
  const [temMaisConversas, setTemMaisConversas] = useState(false);
  const [buscandoMais, setBuscandoMais] = useState(false);
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const conversaIdRef = useRef(null);
  useEffect(() => { conversaIdRef.current = conversaId; }, [conversaId]);
  // EM QUE PÉ ESTÁ O MIOLO DA CONVERSA: "carregando", "pronto", ou o objeto
  // {erro, codigo} da falha.
  //
  // Sem isto, as três situações desenhavam a MESMA coisa — uma área preta e
  // muda. O histórico ao lado diz "Levantando…", a galeria de mídias diz
  // "Carregando…", e a conversa, que é o principal da tela, não dizia nada.
  const [estadoMensagens, setEstadoMensagens] = useState("pronto");
  // A ÚLTIMA que `carregarMensagens` começou a carregar. Serve para saber se
  // esta chamada é uma TROCA de conversa ou uma recarga da mesma — a troca
  // esvazia a tela na hora, a recarga não pode piscar.
  const ultimaCarregadaRef = useRef(null);
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
  const figurinhaRef = useRef(null);
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
  // A imagem aberta é a FOTO DE PERFIL do contato, e não uma foto da conversa.
  // As duas usam a mesma tela preta, mas pedem tamanhos opostos: a da conversa
  // é grande e só precisa caber; a de perfil costuma vir com 200 ou 300 pixels
  // de lado, e sem `width` o navegador desenha esses 300 pixels no meio de uma
  // tela de 1400 — a foto "abria pequena". Aqui ela é ampliada, como no
  // WhatsApp Web.
  const [retratoAberto, setRetratoAberto] = useState(false);
  // Quantos pixels a foto TEM de verdade. Ampliar além do dobro disso não
  // mostra mais nada — só borra o que já estava lá.
  const [larguraDoRetrato, setLarguraDoRetrato] = useState(0);
  // ---- O ZOOM DA IMAGEM ABERTA ----
  //
  // Pedido do escritório: "ao clicar para abrir uma imagem que eu recebi ou
  // enviei, preciso que tenha a opção de dar zoom para melhorar a leitura".
  // O que chega o dia inteiro é documento fotografado: procuração de lado, RG
  // amassado, print de conversa com letra de seis pixels. A tela mostrava a
  // imagem inteira, e era por CABER que não dava para ler.
  //
  // `suave` decide se a mudança é animada. Botão e toque duplo saltam de um
  // tamanho a outro e ficam melhores com meio segundo de transição; a pinça e o
  // arrasto acompanham o dedo, e animar CADA quadro deles faria a imagem
  // chegar sempre atrasada em relação à mão.
  const [zoom, setZoom] = useState(ZOOM_PARADO);
  const [suave, setSuave] = useState(false);
  const [arrastandoImagem, setArrastandoImagem] = useState(false);
  const visorRef = useRef(null);
  const imagemRef = useRef(null);
  // O zoom de agora, para os ouvintes nativos lerem sem depender do fechamento
  // em que foram criados. Sem isto, o `touchmove` registrado uma vez enxergaria
  // para sempre a escala do instante em que a imagem abriu.
  const zoomRef = useRef(ZOOM_PARADO);
  const gestos = useRef({ pinca: null, arrasto: null, mexeu: false, ultimoToque: 0 });
  const [buscandoFoto, setBuscandoFoto] = useState(false);
  const [erroDaFoto, setErroDaFoto] = useState("");
  const [aviso, setAviso] = useState(null); // toast discreto (texto)
  // A FILA DE ANEXOS aguardando envio. Era UM anexo por vez: colar três prints
  // mandava o primeiro e descartava os outros dois em silêncio, e quem mandava
  // cinco fotos de um documento repetia cinco vezes o mesmo caminho.
  // Cada item: { file, url, tipo, nome, legenda }.
  const [anexosPendentes, setAnexosPendentes] = useState([]);
  // Qual deles está grande na prévia. A legenda é DE CADA arquivo, como no
  // WhatsApp: uma legenda só para o lote descreveria errado quatro dos cinco.
  const [anexoAtivo, setAnexoAtivo] = useState(0);
  // Há um arquivo sendo arrastado sobre a janela? Serve só para a faixa
  // "solte aqui": sem retorno visual, quem arrasta não sabe se pode soltar.
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const [buscaIdx, setBuscaIdx] = useState(0); // ocorrência atual na busca da conversa
  const [idDivisorNaoLidas, setIdDivisorNaoLidas] = useState(null); // id da 1ª msg não lida ao abrir
  const [temMaisAntigas, setTemMaisAntigas] = useState(false); // há histórico acima do que está na tela
  // QUAL mensagem casou em cada conversa achada pela busca — não só o texto.
  // É o que permite abrir a conversa NELA em vez de no fim: quem procurou uma
  // palavra dita há três meses achou a conversa e ainda teria de procurar
  // dentro dela, rolando. No WhatsApp, clicar no resultado leva à mensagem.
  const [alvoDaBusca, setAlvoDaBusca] = useState({});   // conversaId → {id, em}
  // O ALVO GUARDA DE QUAL CONVERSA ELE É — `{ conversa, id, em }`.
  //
  // A primeira versão era só `{ id, em }`, e `carregarMensagens` a CONSUMIA
  // (zerava) logo na primeira linha. Só que ela roda ANTES do efeito que
  // decide se a tela rola para o fim: quando esse efeito ia conferir se havia
  // alvo, já não havia. A trava contra a rolagem para o fim nunca valeu, e o
  // salto até a mensagem só aparecia quando ganhava a corrida — o que dependia
  // de a resposta do banco chegar na hora certa.
  //
  // Levando junto de qual conversa ele é, ninguém precisa zerá-lo na hora
  // exata: um alvo de outra conversa simplesmente não vale.
  const alvoParaAbrirRef = useRef(null);
  const alvoDe = (convId) => {
    const a = alvoParaAbrirRef.current;
    return a && String(a.conversa) === String(convId) ? a : null;
  };
  // Cada pedido de salto é um objeto novo, com um contador. Procurar a MESMA
  // palavra duas vezes seguidas dá o mesmo id de mensagem — e um efeito que
  // dependesse só do id não rodaria na segunda vez.
  const [salto, setSalto] = useState(null);          // { id, n }
  const [msgDestacada, setMsgDestacada] = useState(null);
  const [buscandoAntigas, setBuscandoAntigas] = useState(false);
  const [importando, setImportando] = useState(false); // gravando no banco
  const [impAdvId, setImpAdvId] = useState(""); // advogado dono das conversas importadas
  const [impMeuNome, setImpMeuNome] = useState(""); // nome do advogado como aparece nos .txt
  const [impArquivos, setImpArquivos] = useState([]); // [{ nome, msgs, autores, numero }]
  const [impProgresso, setImpProgresso] = useState(""); // texto de progresso da importação
  const [impArrastando, setImpArrastando] = useState(false); // arquivo sendo arrastado sobre a área
  const [msgHover, setMsgHover] = useState(null); // id da bolha sob o mouse (mostra "responder")
  const [reagindo, setReagindo] = useState(null); // id da bolha com a fileira de emojis aberta
  const [reagindoTudo, setReagindoTudo] = useState(false); // a fileira virou o painel inteiro
  const [rostoAberto, setRostoAberto] = useState(null);    // id da bolha com a fileira do rosto
  const [convHover, setConvHover] = useState(null); // id da conversa sob o mouse (realce)
  const [menuConversa, setMenuConversa] = useState(null); // id da conversa com o menuzinho aberto
  const [modoNota, setModoNota] = useState(false); // caixa de texto no modo "nota interna"
  // O PROCESSO QUE A NOTA APONTA — opcional, e o padrão é nenhum.
  //
  // O vínculo da nota é SEMPRE com o cliente; o processo existe só para
  // facilitar achar a informação depois. Por isso o padrão é "nota geral": quem
  // não escolher nada não fica devendo nada.
  const [processosDoCliente, setProcessosDoCliente] = useState([]);
  const [processoDaNota, setProcessoDaNota] = useState("");
  const [buscandoProcessos, setBuscandoProcessos] = useState(false);
  const [rapidas, setRapidas] = useState([]); // mensagens rápidas (respostas prontas) da equipe
  const [slashIdx, setSlashIdx] = useState(0); // item destacado no menu do "/"
  const [configAberta, setConfigAberta] = useState(false); // tela de Configurações aberta
  const [abaConfig, setAbaConfig] = useState("perfil"); // perfil | aparencia | rapidas
  const [rapidaForm, setRapidaForm] = useState(null); // { id?, titulo, texto } sendo criada/editada
  const [tags, setTags] = useState([]); // definições das tags (id, nome, cor)
  const [tagsPorConversa, setTagsPorConversa] = useState({}); // { conversaId: [tagId,...] }

  // ------------------------------------------------------------
  //  O QUE NÃO CARREGOU PRECISA DIZER QUE NÃO CARREGOU
  //
  //  Em 04/09 as etiquetas sumiram de todas as conversas do escritório. E, com
  //  elas, as notas internas — que ninguém notou, porque a tela também não
  //  disse nada. A causa era uma permissão no banco, e a leitura de
  //  `conversa_tags` voltava com erro.
  //
  //  O código fazia isto:
  //
  //      if (error) return;                     // etiquetas
  //      if (!nErr) notas = ...;                // notas
  //
  //  Ou seja: o erro era LIDO e jogado fora. A tela ficava exatamente igual a
  //  uma conversa sem etiqueta nenhuma — e "não consegui ler" e "não existe"
  //  viravam a mesma imagem. O diagnóstico custou três rodadas de conversa e
  //  uma varredura no banco para descobrir o que a própria tela sabia desde o
  //  primeiro segundo.
  //
  //  A REGRA QUE FICA: ausência por falha nunca pode ser desenhada igual a
  //  ausência de verdade. É a mesma decisão que o miolo da conversa já tomou
  //  (carregando, falhou e vazia são três telas diferentes, e não uma só);
  //  aqui ela vale para o que carrega POR FORA da conversa.
  //
  //  Uma faixa só, no alto, somando o que falhou. Não é um alerta por leitura:
  //  três avisos empilhados numa tela de atendimento viram ruído, e ruído se
  //  aprende a ignorar. Ela fica até a leitura dar certo — e some sozinha
  //  quando der.
  // ------------------------------------------------------------
  const [falhasDeLeitura, setFalhasDeLeitura] = useState({}); // { chave: {oQue, codigo} }

  const anotarFalhaDeLeitura = useCallback((chave, oQue, erro) => {
    // O detalhe cru vai para o console SEMPRE. Quem atende não abre o console,
    // mas quem for consertar precisa dele — e sem isto a única pista era a
    // ausência na tela, que não aponta para lugar nenhum.
    console.error(`[zorvin] falha ao carregar ${oQue}`, erro);
    setFalhasDeLeitura((antes) => ({
      ...antes,
      [chave]: { oQue, codigo: (erro && erro.code) || "" },
    }));
  }, []);

  // ============================================================
  //  O QUE PAROU, DITO NA TELA ONDE AS PESSOAS JÁ ESTÃO
  //
  //  A ponte ficou cheia de proteções — a caixa de entrada guarda o evento
  //  antes de prometer, a fila tenta de novo sozinha, a saída termina o que
  //  está no meio. Todas avisam quando algo dá errado. No LOG.
  //
  //  E ninguém abre o log. Foi assim com a linha do escritório que caiu em
  //  19/08 e com o `IMPORT_TOKEN` que nunca foi criado: nos dois casos a
  //  máquina vinha dizendo o que estava errado, para uma tela que ninguém
  //  olhava. Uma proteção que avisa onde não se lê protege menos do que
  //  parece.
  //
  //  Os números vêm de `zorvin_saude()` — uma função só, com CONTAGENS. O
  //  painel não alcança `eventos_recebidos` de propósito (ela guarda texto de
  //  cliente), e não é por causa de um número que isso vai mudar.
  // ============================================================
  const [saude, setSaude] = useState([]);

  const limparFalhaDeLeitura = useCallback((chave) => {
    setFalhasDeLeitura((antes) => {
      if (!(chave in antes)) return antes;   // nada mudou: não redesenha
      const novo = { ...antes };
      delete novo[chave];
      return novo;
    });
  }, []);
  const [filtro, setFiltro] = useState("tudo"); // aba/filtro da lista: 'tudo' | 'naolidas' | 'favoritas' | 'tag:<id>' | 'frente:<FRENTE>'
  const [tagForm, setTagForm] = useState(null); // { id?, nome, cor } sendo criada/editada
  const [tagMenuAberto, setTagMenuAberto] = useState(false); // menu de aplicar tags na conversa aberta
  const [menuTopoAberto, setMenuTopoAberto] = useState(false); // menu ⋮ do topo da lista
  // O MENU ⋮ DO CABEÇALHO DA CONVERSA — só no celular.
  //
  // No computador as ações da conversa cabem escritas no cabeçalho. Em 390
  // pontos de tela, não: eram sete botões, e o nome do contato ficava com UM
  // pixel. Aqui elas viram uma lista com as palavras escritas, que é o que se
  // lê quando se procura alguma coisa pelo nome dela.
  const [menuDaConversa, setMenuDaConversa] = useState(false);
  const [menuEtiquetas, setMenuEtiquetas] = useState(false); // lista de etiquetas para filtrar
  const [menuDepartamentos, setMenuDepartamentos] = useState(false); // lista de departamentos
  const [buscaDepartamento, setBuscaDepartamento] = useState("");
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
  const acoesRef = useRef(null); // o ⋮ do cabeçalho da conversa (celular)
  const etiquetasRef = useRef(null); // menu ⋮ do topo (fecha ao clicar fora)
  const departamentosRef = useRef(null); // seletor de departamento (fecha ao clicar fora)

  const C = TEMAS[modo];
  const estreito = largura < 768; // layout de celular: mostra lista OU conversa
  const advogado = advogados.find((a) => a.id === advogadoId) || null;
  const conversa = conversas.find((c) => c.id === conversaId) || null;
  // O NOME VEM DO CADASTRO DO VANTORO. A ordem abaixo é essa por um motivo:
  // `usuarios.nome` é reescrito a cada login com o que está no Vantoro, então
  // é a cópia mais nova que existe aqui. O `user_metadata` vem logo atrás
  // (a ponte também o realinha, mas quem não entrou desde então ainda tem o
  // valor velho lá).
  //
  // O PEDAÇO DO E-MAIL É O ÚLTIMO RECURSO, e foi ele que criou o problema:
  // quem entrou antes de o Vantoro ter o nome completo virou "rodrigo",
  // "max", "isabelle" — e era isso que assinava a bolha e ia para o Painel.
  // Ele fica porque uma tela sem nome nenhum é pior, mas agora só aparece se
  // as duas fontes de verdade estiverem vazias.
  const meuNome =
    (meuCadastro?.nome || "").trim() ||
    sessao?.user?.user_metadata?.nome ||
    sessao?.user?.user_metadata?.name ||
    sessao?.user?.user_metadata?.full_name ||
    (sessao?.user?.email || "").split("@")[0] ||
    "atendente";
  const minhaFoto = sessao?.user?.user_metadata?.foto_url || null;
  // O ID não muda quando alguém edita o próprio nome. É por ele que a bolha
  // reencontra o nome e a foto de hoje — ver `equipe` e `quemFalou` logo
  // abaixo.
  const meuId = sessao?.user?.id || null;

  // ------------------------------------------------------------
  //  O NOME E A FOTO DE HOJE
  //
  //  Cada mensagem guarda `enviado_por` e `enviado_por_foto` — o nome e a foto
  //  NO DIA DO ENVIO. Era de propósito, para uma mensagem antiga aparecer
  //  assinada com o nome de então. Na prática deu o contrário do que se quer:
  //  quem trocava de nome ficava com metade da conversa assinada com o nome
  //  velho, e quem punha foto depois de já ter escrito ficava com uma bolinha
  //  de iniciais no meio de uma conversa que já tinha foto. Pior: no grupinho
  //  de avatares do topo, a mesma pessoa aparecia duas vezes.
  //
  //  Agora a tela desenha o de hoje. O que está gravado na linha fica onde
  //  está — nada foi apagado, e é só isto aqui que decide o que aparece.
  //
  //  `porNome` existe para o histórico anterior à coluna `enviado_por_id`:
  //  ali não há id, e casar pelo nome é o único jeito de dar foto àquelas
  //  mensagens. Só acerta quem não trocou de nome — para quem trocou, não há
  //  o que ligar uma coisa na outra, e a mensagem fica como está.
  const [equipe, setEquipe] = useState({ porId: {}, porNome: {} });

  useEffect(() => {
    let vivo = true;
    (async () => {
      // `equipe` é uma vista com três colunas — id, nome, foto. A tabela
      // `usuarios` continua fechada: ninguém lê o e-mail nem o "é admin" de
      // ninguém por aqui.
      //
      // DE MIL EM MIL, com `order` fixo. O PostgREST corta em mil linhas e não
      // avisa — a resposta chega com cara de resposta inteira. Hoje o
      // escritório cabe folgado numa página; no dia em que não couber, o que
      // aconteceria sem isto não é um erro na tela, é meia dúzia de pessoas
      // voltando a aparecer com o nome antigo, sem nada explicando por quê.
      const linhas = [];
      for (let pagina = 0; pagina < 20; pagina++) {
        const { data, error } = await supabase.from("equipe")
          .select("id, nome, foto_url")
          .order("id").range(pagina * 1000, (pagina + 1) * 1000 - 1);
        if (error) return;          // sem a vista no banco: fica como era antes
        linhas.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      if (!vivo) return;
      const porId = {}, porNome = {};
      for (const u of linhas) {
        const q = { id: String(u.id), nome: u.nome || null, foto: u.foto_url || null };
        porId[q.id] = q;
        if (q.nome) porNome[chaveDeNome(q.nome)] = q;
      }

      // O DE-PARA: a conta que foi APAGADA, e cujas mensagens ficaram.
      //
      // Quem tinha duas contas (uma de administrador e a de pessoa), juntou as
      // duas e apagou uma, deixou para trás mensagens assinadas com um id que
      // não existe mais em `usuarios`. Nem o id acha ninguém, nem o nome — o
      // nome gravado é justamente o velho ("Rodrigo ADMIN"). Sem uma terceira
      // pista, essas mensagens não têm como voltar para a pessoa.
      //
      // `atendentes_de_para` é essa pista, e ela já existia: foi feita para o
      // Painel parar de contar "rodrigo" e "Rodrigo Sousa" como duas pessoas.
      // É a mesma pergunta, então é a mesma tabela — uma linha lá arruma a
      // conta E a conversa, e quem administra não precisa aprender dois lugares.
      const { data: dePara } = await supabase.from("atendentes_de_para")
        .select("nome_antigo, usuario_id, nome_novo, e_pessoa").limit(1000);
      if (!vivo) return;
      for (const d of dePara || []) {
        const chave = chaveDeNome(d.nome_antigo);
        // RÓTULO QUE NÃO É GENTE — o nome da linha no celular de quem exportou
        // o histórico ("Cadastro - C&A"). Ele entra na lista, e não é ignorado:
        // ignorá-lo deixava o rótulo assinando a bolha como se fosse um colega,
        // e entrando no grupinho de rostos do topo. Marcado como rótulo, ele
        // continua aparecendo na bolha (a mensagem existiu e alguém a escreveu)
        // mas fica de fora de "quem participou".
        if (d.e_pessoa === false) {
          if (!porNome[chave]) porNome[chave] = { id: null, nome: d.nome_novo || d.nome_antigo, foto: null, rotulo: true };
          continue;
        }
        // `nome_novo` SEM `usuario_id` é o caso das linhas antigas do de-para,
        // feitas quando só havia texto para comparar ("rodrigo" → "Rodrigo
        // Sousa"). Ele não pode virar uma pessoa nova: era assim que a MESMA
        // pessoa aparecia duas vezes em "quem participou" — uma vinda do id,
        // com foto, e outra vinda daqui, sem. O nome novo é procurado na
        // equipe primeiro; só se não achar ninguém é que fica sendo só texto.
        const alvo = (d.usuario_id && porId[String(d.usuario_id)])
                  || (d.nome_novo && porNome[chaveDeNome(d.nome_novo)])
                  || (d.nome_novo ? { id: null, nome: d.nome_novo, foto: null } : null);
        if (!alvo) continue;
        // Não atropela quem existe de verdade com esse nome.
        if (!porNome[chave]) porNome[chave] = alvo;
      }
      setEquipe({ porId, porNome });
    })();
    return () => { vivo = false; };
  }, [sessao]);

  /** A pessoa de hoje, a partir do id (ou, sem id, do nome que ficou gravado).
   *
   *  O NOME É CONSULTADO MESMO HAVENDO ID, quando o id não acha ninguém: é o
   *  caso da conta apagada. Procurar só pelo id ali seria desistir na primeira
   *  pista, tendo uma segunda na mão. */
  function deHoje(id, nomeGravado) {
    return (id && equipe.porId[String(id)])
        || (nomeGravado && equipe.porNome[chaveDeNome(nomeGravado)])
        || null;
  }

  /** Só o nome de hoje — para as linhas que não têm avatar (a lápide da nota
   *  apagada, o "editada por"). */
  function nomeDeHoje(id, nomeGravado) {
    const atual = deHoje(id, nomeGravado);
    return (atual && atual.nome) || nomeGravado || null;
  }

  /** Quem escreveu esta mensagem (ou esta nota), com o nome e a foto de hoje. */
  function quemFalou(m) {
    if (!m) return { id: null, nome: null, foto: null };
    const ehNota = m.origem === "nota";
    const id = (ehNota ? m.autor_id : m.enviado_por_id) || null;
    const nomeGravado = (ehNota ? m.autor : m.enviado_por) || null;
    const fotoGravada = (ehNota ? m.autor_foto : m.enviado_por_foto) || null;
    // A MENSAGEM QUE SAIU PELO CELULAR.
    //
    // Quando alguém responde pelo aplicativo do WhatsApp em vez de responder
    // por aqui, a ponte assina a mensagem com o rótulo "WhatsApp" — o WhatsApp
    // não diz qual atendente foi, e inventar um seria pior. Só que "WhatsApp"
    // escrito no lugar do nome se lê como uma pessoa chamada WhatsApp, e ainda
    // entrava no grupinho de rostos do topo como se fosse mais um colega.
    // Medido na base do escritório: 1556 mensagens em quatro semanas.
    //
    // Continua sendo o mesmo dado; muda a palavra e muda o lugar dela.
    if (!id && chaveDeNome(nomeGravado) === "whatsapp") {
      return { id: null, nome: "Pelo celular", foto: null, aparelho: true };
    }
    const atual = deHoje(id, nomeGravado);
    if (atual && atual.rotulo) {
      return { id: null, nome: atual.nome, foto: null, rotulo: true };
    }
    // A MINHA foto vem da sessão quando existe: quem acabou de trocar a foto
    // vê a nova na hora, sem esperar a próxima leitura da equipe.
    const souEu = (id && String(id) === String(meuId)) || (!id && nomeGravado === meuNome);
    return {
      id: (atual && atual.id) || (id ? String(id) : null),
      nome: (atual && atual.nome) || nomeGravado || null,
      // O que está gravado só entra se não houver nada de hoje: mostrar a foto
      // antiga é melhor do que mostrar iniciais.
      foto: (souEu && minhaFoto) || (atual && atual.foto) || fotoGravada || null,
    };
  }
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
  const departamentoAtual = departamentos.find((d) => d.id === departamentoId) || null;
  // O que a lista do seletor mostra agora (a busca só existe quando são muitos).
  const departamentosParaEscolher = departamentosVisiveis.filter((d) =>
    !buscaDepartamento.trim()
    || (d.nome || "").toLowerCase().includes(buscaDepartamento.trim().toLowerCase()));

  // O contato está digitando nesta conversa agora? (janela curta que expira).
  function digitandoAtivo(convId) {
    void tique; // re-avalia a cada "tique"
    const ate = digitandos[convId];
    return !!ate && new Date(ate).getTime() > Date.now();
  }

  // QUEM (ALÉM DE MIM) ESTÁ NESTA CONVERSA AGORA.
  //
  // "Agora" são os últimos 3 minutos: quem está com a conversa aberta reescreve
  // a marca de minuto em minuto, então três minutos toleram dois pulsos
  // perdidos sem passar a impressão de que a pessoa continua ali.
  //
  // O `void tique` é o que faltava, e é a diferença entre um aviso e um aviso
  // EM TEMPO REAL. Sem ele, esta conta só era refeita quando alguma outra
  // coisa mandava a tela redesenhar — e como ninguém escreve nada no banco ao
  // SAIR de uma conversa, não havia nenhuma outra coisa. O aviso aparecia na
  // hora em que a pessoa chegava e depois ficava na tela para sempre,
  // apontando alguém que tinha saído havia meia hora.
  function atendidoPorOutro(convId) {
    void tique; // re-avalia a cada "tique", igual ao "digitando…"
    const a = atendimentos[convId];
    if (!a || !a.por || a.por === meuNome) return null;
    if (a.em && Date.now() - new Date(a.em).getTime() > 3 * 60 * 1000) return null;
    return a.por;
  }

  // ---- Carrega telefones e departamentos (uma vez) ----
  useEffect(() => {
    let vivo = true;
    // AINDA NÃO PERGUNTEI ≠ PERGUNTEI E A RESPOSTA FOI NENHUM.
    //
    // Sem esta distinção a tela dizia, em letras claras, "Você não tem nenhum
    // número liberado neste departamento" enquanto os números ainda estavam
    // vindo. É uma frase definitiva sobre uma pergunta que nem tinha sido
    // respondida — e quem lê conclui que perdeu o acesso. Foi relatado com
    // print: a mesma sessão, segundos depois, com oito números na barra.
    //
    // Volta a `false` a cada tentativa: quem apertou "Tentar de novo" tem de
    // ver que estamos perguntando de novo, e não a resposta velha.
    setAcessoConferido(false);
    (async () => {
      const [tel, dep, eu, perm] = await Promise.all([
        supabase.from("advogados").select("id, nome, numero, foto_url, departamento_id")
          .eq("ativo", true).order("nome"),
        supabase.from("departamentos").select("id, nome, slug, cor, ordem")
          .eq("ativo", true).order("ordem"),
        supabase.from("usuarios").select("admin, nome").eq("id", sessao?.user?.id || "").maybeSingle(),
        // AS MINHAS permissões. O banco só deixa cada pessoa ler as próprias
        // (`permissoes_leitura`), então isto não conta a ninguém o que os
        // outros alcançam.
        supabase.from("permissoes").select("departamento_id, telefone_id")
          .eq("usuario_id", sessao?.user?.id || ""),
      ]);
      if (!vivo) return;

      // ------------------------------------------------------------
      //  UMA LEITURA QUE FALHOU NÃO PODE VIRAR UMA AFIRMAÇÃO
      //
      //  As quatro consultas acima respondiam com `|| []`, e o erro de cada
      //  uma era descartado — o de `usuarios` nem chegava a ser olhado. O
      //  resultado é o relato de 20/08: a tela mostrando "Você não tem nenhum
      //  número liberado neste departamento" para quem é ADMINISTRADOR e
      //  alcança tudo. Bastou uma das quatro tropeçar.
      //
      //  Repare no tamanho da mentira: a pessoa não estava sem acesso. A tela
      //  é que não conseguiu perguntar, e respondeu no lugar de quem sabe. Um
      //  F5 resolvia — mas só depois de assustar, e nada ali dizia para
      //  tentar de novo.
      //
      //  Duas regras daqui em diante:
      //
      //    1. SÓ SE GRAVA O QUE VEIO. Leitura que falhou não sobrescreve o que
      //       já estava certo na tela — antes, uma piscada de rede esvaziava a
      //       lista de telefones de quem estava trabalhando.
      //
      //    2. O QUE FALHOU FICA ESCRITO. Com nome do que não veio e um botão
      //       de tentar de novo, em vez de uma conclusão sobre permissão.
      // ------------------------------------------------------------
      const falhou = [];
      if (tel.error) falhou.push("os telefones");
      if (dep.error) falhou.push("os departamentos");
      if (eu.error) falhou.push("o seu cadastro");
      if (perm.error) falhou.push("as suas permissões");

      const ehAdmin = eu.error ? souAdmin : Boolean(eu.data && eu.data.admin);
      if (!eu.error) { setMeuCadastro(eu.data || null); setSouAdmin(ehAdmin); }
      if (!tel.error) setAdvogados(tel.data || []);
      if (!dep.error) setDepartamentos(dep.data || []);
      if (!perm.error) setMinhasPermissoes(perm.data || []);
      setErroPermissoes(perm.error ? perm.error.message : "");
      setErroDoAcesso(falhou.length ? falhou.join(", ") : "");
      // A PERGUNTA FOI RESPONDIDA — bem ou mal. Daqui para a frente a tela pode
      // afirmar alguma coisa sobre o acesso; antes disto, não podia.
      setAcessoConferido(true);

      // Alguma falhou: não se escolhe telefone nenhum agora. Escolher com meia
      // resposta abriria a lista errada e pareceria que a permissão mudou.
      if (falhou.length) return;

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
  }, [sessao?.user?.id, tentativaDeAcesso]);

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
      // AS MAIS RECENTES, E COM TETO. Sem `order` e sem `limit`, a API do
      // Supabase corta em 1000 linhas e não avisa — e a ordem de quem sobrou é
      // indefinida. Num telefone com mais de mil conversas, a prévia da
      // conversa de agora podia simplesmente não vir. A lista mostra as
      // recentes primeiro, então é delas que a prévia precisa.
      // COM A DURAÇÃO, SE A BASE JÁ TIVER A COLUNA.
      //
      // Pedir uma coluna que não existe faz a consulta INTEIRA falhar — e aí
      // não haveria prévia nenhuma, nem o rótulo que já funcionava. Então a
      // segunda tentativa vai sem ela: quem ainda não rodou o script continua
      // vendo "🎤 Mensagem de voz", só que sem o tempo.
      const buscar = (comDuracao) => supabase
        .from("conversas")
        .select(`id, mensagens(tipo, criado_em${comDuracao ? ", midia_segundos" : ""})`)
        .eq("advogado_id", advId)
        .order("ultima_atividade", { ascending: false })
        .limit(300)
        .order("criado_em", { referencedTable: "mensagens", ascending: false })
        .limit(1, { referencedTable: "mensagens" });

      let { data, error } = await buscar(true);
      if (error) ({ data, error } = await buscar(false));
      if (error) return;
      const mapa = {};
      (data || []).forEach((c) => {
        const ult = c.mensagens && c.mensagens[0];
        if (ult && ult.tipo && ult.tipo !== "texto") {
          mapa[c.id] = { tipo: ult.tipo, segundos: ult.midia_segundos || null };
        }
      });
      setUltimasMidias(mapa);
    } catch (_) { /* ignora: mantém a prévia padrão */ }
  }, []);

  // ---- Carrega as conversas do advogado selecionado ----
  //
  // EM PÁGINAS, e não a lista inteira.
  //
  // A consulta sem recorte parava em 1000 — teto da API do Supabase, que corta
  // e não avisa. Num telefone com dois anos de conversa, a conversa número 1200
  // simplesmente não existia: não estava na lista, não aparecia rolando, e o
  // rodapé dizia "de 1000" com toda a confiança.
  //
  // Agora vem uma página por vez, e a rolagem pede a próxima. Além de acabar
  // com o teto, a primeira tela chega mais rápido: 200 conversas em vez de
  // 1000.
  const carregarConversas = useCallback(async (advId, pagina = 0, manterAberta = null) => {
    if (!advId) return;
    const de = pagina * PAGINA_BANCO;
    /** As fixadas: mesma consulta, filtro próprio. Separada em função porque a
     *  base sem o SQL das frentes precisa repeti-la sem as colunas novas. */
    const buscarFixadas = () => supabase
      .from("conversas")
      .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
      .eq("advogado_id", advId)
      .eq("fixada", true)
      .order("ultima_atividade", { ascending: ordem === "antigas" })
      .limit(200)
      .then((r) => r);
    const pedidoDaPagina = supabase
      .from("conversas")
      // `mensagens(id)` COM TETO DE UMA: a pergunta é "existe alguma?", e não
      // "quantas são". Uma linha por conversa responde isso e não traz peso.
      .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")}), mensagens(id)`)
      .eq("advogado_id", advId)
      // A ORDEM É DAQUI, e não de uma reordenação depois. Ver o comentário em
      // `ordem`: virar a lista já carregada mostraria "a mais antiga das 200
      // que vieram", que não é a mais antiga de nada.
      .order("ultima_atividade", { ascending: ordem === "antigas" })
      .range(de, de + PAGINA_BANCO - 1)
      .limit(1, { referencedTable: "mensagens" })
      // `.then((r) => r)` DISPARA. O construtor do supabase-js é PREGUIÇOSO: a
      // linha acima só monta o pedido, e a rede não sai do lugar até alguém
      // chamar `then`. Sem isto, "sair na frente" não sairia de lugar nenhum.
      .then((r) => r);

    // ------------------------------------------------------------
    //  AS QUATRO IDAS SAEM JUNTAS, e não uma depois da outra.
    //
    //  MEDIDO, e não suposto. O diário da bancada mostrou a partida assim:
    //
    //      173 →  874  conversas   (as fixadas)
    //      174 →  880  conversas   (a página)
    //      880 → 1580  conversas   (as fixadas — só depois de a página voltar)
    //     1581 → 2286  conversas   (atendendo, prévias, digitando)
    //
    //  Três rodadas em fila indiana, ~700 ms cada, para buscar coisas que não
    //  dependem umas das outras: as fixadas, as prévias, quem está atendendo e
    //  quem está digitando precisam só do `advId`. Nenhuma precisa da página.
    //
    //  O comentário das fixadas, logo abaixo, já dizia a intenção — "buscadas
    //  por conta própria, JUNTO da primeira página". A intenção era paralela; o
    //  código era serial, porque cada `await` no meio empurra o resto para
    //  depois da rede.
    //
    //  Do lado de quem atende isso era a demora da partida: no escritório,
    //  "demora para carregar tudo", com a lista dizendo "Carregando as
    //  conversas..." por segundos.
    //
    //  AS TRÊS DE BAIXO NÃO SÃO ESPERADAS de propósito: cada uma acende o seu
    //  pedaço quando chegar. Esperá-las seria trocar três rodadas por uma
    //  rodada mais longa, e a lista não precisa delas para aparecer.
    // ------------------------------------------------------------
    const pedidoDasFixadas = pagina === 0 ? buscarFixadas() : null;
    carregarAtendimentos(advId);
    carregarUltimasMidias(advId);
    carregarDigitando(advId);

    let { data, error } = await pedidoDaPagina;
    // Base sem o SQL das frentes: tira `vantoro_nome` do pedido e repete. Uma
    // vez só — depois disso a coluna já não é pedida.
    let fixadasRefeitas = null;
    if (error && TEM_NOME_DO_CADASTRO && faltaColuna(error)) {
      TEM_NOME_DO_CADASTRO = false;
      // AS FIXADAS TAMBÉM SÃO REFEITAS. Elas saíram na frente com a lista LONGA
      // de colunas — a mesma que acabou de falhar. Sem repetir, a base sem o
      // SQL das frentes perderia as fixadas em silêncio, e o botão de fixar
      // pareceria não fazer nada. Antes isso não acontecia porque elas eram
      // montadas depois, já com a bandeira baixada; sair na frente tem este
      // preço, e ele é pago aqui.
      const refeitos = await Promise.all([
        supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")}), mensagens(id)`)
          .eq("advogado_id", advId)
          .order("ultima_atividade", { ascending: ordem === "antigas" })
          .range(de, de + PAGINA_BANCO - 1)
          .limit(1, { referencedTable: "mensagens" }),
        pagina === 0 ? buscarFixadas() : Promise.resolve({ data: [], error: null }),
      ]);
      ({ data, error } = refeitos[0]);
      fixadasRefeitas = refeitos[1];
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
    // Fixadas no alto; entre iguais, a ordem escolhida. O empate por
    // `ultima_atividade` importa porque a lista é emendada de duas fontes (as
    // fixadas e a página), e sem critério de desempate elas se intercalavam
    // pela ordem de chegada.
    const sinal = ordem === "antigas" ? -1 : 1;
    const porFixada = (a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0)
      || sinal * (new Date(b.ultima_atividade) - new Date(a.ultima_atividade));
    const bruto = data || [];
    // Página cheia = provavelmente há mais. Página curta = acabou. Conta só a
    // PÁGINA — as fixadas que vêm à parte, logo abaixo, não dizem nada sobre
    // quanto ainda falta. E conta o BRUTO, antes do corte abaixo: o que foi
    // escondido saiu da tela, não da página.
    setTemMaisConversas(bruto.length === PAGINA_BANCO);
    setPaginaConversas(pagina);

    // ------------------------------------------------------------
    //  CONVERSA SEM NENHUMA MENSAGEM NÃO É CONVERSA
    //
    //  Abrir um contato cria a linha em `conversas` na hora — tem de criar,
    //  porque toda a tela pendura nela. Mas se ninguém escrever nada, o que
    //  ficou foi uma linha na lista sem uma palavra dentro, com o horário do
    //  clique. Ela some da tela e não do banco: é o WhatsApp que manda aqui, e
    //  lá a conversa só entra na lista quando alguém fala.
    //
    //  DUAS EXCEÇÕES, e as duas são para não esconder o que a pessoa quer ver:
    //
    //    a FIXADA fica. Fixar é dizer "esta eu quero à vista"; sumir com ela
    //    seria desobedecer uma escolha explícita.
    //
    //    a ABERTA fica. Sem isto, clicar no contato abriria uma conversa que
    //    não está na lista — a tela mostraria a conversa e a lista diria que
    //    ela não existe.
    //
    //  E O ERRO CAI PARA O LADO DE MOSTRAR. `Array.isArray` é a diferença
    //  entre "veio a lista e está vazia" e "não veio lista nenhuma". Num banco
    //  que não devolva a junção, o campo vem indefinido — e aí não se esconde
    //  nada. Esconder por falta de resposta apagaria conversas de verdade da
    //  tela, sem erro e sem log, que num escritório de advocacia é o defeito
    //  que não se pode ter.
    const aberta = manterAberta != null ? manterAberta : conversaIdRef.current;
    const semMensagem = (c) => Array.isArray(c.mensagens) && c.mensagens.length === 0
                               && !c.fixada && String(c.id) !== String(aberta);
    const veio = bruto.filter((c) => !semMensagem(c));

    // ------------------------------------------------------------
    //  AS FIXADAS VÊM À PARTE, E VÊM SEMPRE
    //
    //  Fixar é dizer "esta conversa fica à vista todo dia, acima das outras".
    //  A subida, porém, era feita ordenando o array já carregado — e a lista
    //  vem do banco em páginas de 200, da mais recente para a mais antiga. Uma
    //  conversa fixada mas parada há meses mora na página 6: ela só subia
    //  quando alguém rolasse até lá. Ou seja, para toda conversa que não fosse
    //  recente — que é justamente o caso em que fixar serve para alguma coisa —
    //  o botão não fazia nada, e nada na tela dizia isso.
    //
    //  Agora elas são buscadas por conta própria, junto da primeira página. São
    //  poucas por definição: fixar é uma escolha de quem atende, não um acúmulo.
    //
    //  Se a coluna `fixada` ainda não existir nesta instalação, a consulta
    //  falha e sobra a lista sem fixadas — como era antes do recurso existir.
    //  Nada some por causa disso.
    let fixadas = [];
    if (pedidoDasFixadas) {
      // ESPERA o que já foi pedido lá em cima, em vez de pedir agora. É esta
      // linha, e não a de cima, que era a segunda rodada de rede.
      const { data: fix, error: erroFix } = fixadasRefeitas || await pedidoDasFixadas;
      if (!erroFix) fixadas = fix || [];
      if (advogadoIdRef.current !== advId) return;
    }

    // A conversa aberta mantém o contador dela: abrir não é responder.
    setConversas((antes) => {
      // Na primeira página a lista é substituída; nas seguintes, emendada — e
      // sem repetir quem já veio, porque uma conversa que recebe mensagem entre
      // uma página e outra desce de posição e apareceria duas vezes.
      const base = pagina === 0 ? [] : antes;
      const vistos = new Set(base.map((c) => String(c.id)));
      const juntas = [...base];
      for (const c of [...fixadas, ...veio]) {
        if (vistos.has(String(c.id))) continue;
        vistos.add(String(c.id));
        juntas.push(c);
      }
      return juntas.sort(porFixada);
    });
    // A lista e o dono dela mudam JUNTOS — é o que garante que ninguém leia
    // esta lista como sendo de outro telefone.
    setConversasDe(advId);
    // As três que ficavam aqui saíram na frente, lá em cima: elas precisam só
    // do `advId`, e esperar a lista para pedi-las era o que fazia a terceira
    // rodada de rede.
  }, [ordem, carregarAtendimentos, carregarUltimasMidias, carregarDigitando]);

  useEffect(() => { carregarConversas(advogadoId); }, [advogadoId, carregarConversas]);

  // ---- Total de não lidas de CADA advogado (para o selo na barra lateral) ----
  //
  // A CONTA PRECISA SER A MESMA DA TELA, e não era.
  //
  // O selo do advogado ABERTO vem da lista carregada, que desconta as
  // arquivadas. O dos DEMAIS vinha desta consulta, que somava tudo. O mesmo
  // advogado aparecia com 1 quando você estava nele e com 11 quando estava em
  // outro — e o 11 contava conversas arquivadas, que ninguém vai atender.
  //
  // Aqui as arquivadas também saem, e as duas contas passam a dizer a mesma
  // coisa. Um selo que muda de número conforme onde você está não é um número:
  // é um susto.
  //
  // `select("*")` em vez de pedir as colunas: `arquivada` pode não existir numa
  // instalação antiga, e pedir coluna inexistente faz a consulta inteira falhar
  // — os selos sumiriam todos por causa de um recurso que nem foi instalado.
  //
  // ELA CONTA NO BANCO, e não baixando as conversas.
  //
  // A versão anterior pedia `select("*")` de TODAS as conversas não lidas, de
  // todos os telefones, e contava aqui. Dois problemas, um de correção e um de
  // custo:
  //
  //   * a API do Supabase devolve no máximo 1000 linhas e cala. Num escritório
  //     com mais de mil conversas não lidas, os selos passavam a mentir — e a
  //     mentira era para MENOS, que é a pior direção: some o aviso de que há
  //     gente esperando;
  //   * cada chamada trazia até 1000 conversas INTEIRAS (prévia, datas, tudo)
  //     só para somar 1 por linha. E ela é chamada a cada mensagem que chega,
  //     em qualquer telefone — num dia de movimento, isso é um megabyte de
  //     JSON por minuto para produzir uma dúzia de números.
  //
  // Agora é uma contagem por telefone, com `head: true`: o banco responde só o
  // número, sem linha nenhuma. São poucas requisições minúsculas em vez de uma
  // enorme, e o resultado é exato em qualquer tamanho de base.
  //
  // E AGORA UMA IDA SÓ, em vez de uma por telefone.
  //
  // "Poucas requisições minúsculas" eram QUINZE: treze telefones mais duas das
  // arquivadas. Cada uma é uma viagem inteira à internet — DNS, TLS, fila do
  // PostgREST — e a viagem custa muito mais que a contagem. Somar por telefone
  // é exatamente o que um `group by` faz numa passada só, então a soma passou
  // para o banco e o painel recebe o mapa pronto.
  //
  // A função pode não existir (é um SQL que alguém precisa rodar). Nesse caso o
  // caminho antigo continua aqui, inteiro, e assume — uma vez por sessão, sem
  // ficar perguntando.
  const contarNaoLidasAgora = useCallback(async () => {
    if (!advogados.length) return;

    if (TEM_CONTAGEM_NO_BANCO) {
      // A LISTA DE TELEFONES VAI JUNTO, e não por economia: `advogados` já é o
      // que ESTA pessoa tem permissão de ver. Sem mandá-la, a resposta traria a
      // contagem de telefones que ela não abre — e a resposta chega no
      // navegador, onde qualquer um lê.
      const { data, error } = await supabase.rpc("nao_lidas_por_telefone", {
        p_advogado: advogadoId ? String(advogadoId) : null,
        p_telefones: advogados.map((a) => String(a.id)),
      });
      if (!error && data) {
        const vindo = data.por_telefone || {};
        const mapa = {};
        // ZERO EXPLÍCITO PARA QUEM NÃO APARECEU. O `group by` não devolve linha
        // para telefone sem nenhuma conversa não lida — e telefone ausente do
        // mapa é, na tela, "não sei", que é outra coisa de "não há ninguém
        // esperando". Aqui sabemos: a consulta olhou todos.
        for (const a of advogados) mapa[a.id] = Number(vindo[String(a.id)] || 0);
        setNaoLidasPorAdv(mapa);
        const arq = data.arquivadas;
        setArquivadasNoBanco(arq
          ? { total: Number(arq.total || 0), naoLidas: Number(arq.nao_lidas || 0) }
          : {});
        return;
      }
      // Só desce para o caminho antigo quando a função NÃO EXISTE. Erro de rede
      // é passageiro: apagar os selos por causa dele mostraria "nenhum recado
      // esperando" num momento em que ninguém sabe se há.
      if (!faltaAFuncao(error)) return;
      TEM_CONTAGEM_NO_BANCO = false;
      console.info('Zorvin: a função "nao_lidas_por_telefone" não existe neste banco — '
        + "contando telefone a telefone. Rode o SQL e recarregue para ficar mais rápido.");
    }

    const contar = (a) => {
      let q = supabase.from("conversas")
        .select("id", { count: "exact", head: true })
        .eq("advogado_id", a.id)
        .gt("nao_lidas", 0);
      // As arquivadas não contam: ninguém vai atendê-las, e o selo tem de bater
      // com o que a pessoa consegue contar na lista.
      if (TEM_ARQUIVADA) q = q.eq("arquivada", false);
      return q;
    };
    const pares = await Promise.all(advogados.map(async (a) => {
      let { count, error } = await contar(a);
      // Instalação sem a coluna `arquivada`: desliga o filtro uma vez e repete.
      if (error && TEM_ARQUIVADA && faltaColuna(error)) {
        TEM_ARQUIVADA = false;
        ({ count, error } = await contar(a));
      }
      return [a.id, error ? null : (count || 0)];
    }));
    const mapa = {};
    // Telefone cuja contagem falhou fica de FORA do mapa, e não em zero: zero é
    // uma afirmação ("não há ninguém esperando") que a consulta não fez.
    pares.forEach(([id, n]) => { if (n != null) mapa[id] = n; });
    setNaoLidasPorAdv(mapa);

    // AS NÃO LIDAS DENTRO DAS ARQUIVADAS, do telefone aberto.
    //
    // Aqui e não numa função à parte: é a mesma pergunta com um filtro a mais, e
    // separá-las daria dois momentos de atualização diferentes para números que
    // a tela mostra juntos — um piscando enquanto o outro já mudou.
    if (!TEM_ARQUIVADA || !advogadoId) { setArquivadasNoBanco({}); return; }
    const contarArq = (ajustar = (q) => q) => ajustar(supabase.from("conversas")
      .select("id", { count: "exact", head: true })
      .eq("advogado_id", advogadoId)
      .eq("arquivada", true));
    const [tudo, porLer] = await Promise.all([
      contarArq(),
      contarArq((q) => q.gt("nao_lidas", 0)),
    ]);
    // Mesma regra do mapa: falhou, fica sem número em vez de virar zero.
    setArquivadasNoBanco({
      total: tudo.error ? undefined : (tudo.count || 0),
      naoLidas: porLer.error ? undefined : (porLer.count || 0),
    });
    // `advogadoId` NA LISTA DE DEPENDÊNCIAS, e não só `advogados`.
    //
    // A contagem das arquivadas é do telefone ABERTO. Sem isto ela ficaria
    // parada no número do telefone anterior até a próxima mensagem chegar — e
    // número velho na tela é indistinguível de número certo.
  }, [advogados, advogadoId]);

  // UMA CONTAGEM POR RAJADA, E NÃO UMA POR MENSAGEM.
  //
  // Esta era a maior conta do painel, e ela não aparecia em lugar nenhum: os
  // selos eram recontados a cada mensagem que chega — pelo tratador de INSERT
  // em `mensagens` E pelo de UPDATE em `conversas`, que o Supabase manda
  // juntos, então DUAS vezes por mensagem.
  //
  // Medido na bancada, com treze telefones: 31 idas ao banco por mensagem
  // recebida, e a conta é linear — vinte mensagens numa rajada custavam 620
  // consultas, em cada aba aberta do escritório. Num horário de movimento é
  // isso que engasga a tela: não há consulta lenta, há uma multidão delas.
  //
  // O remédio é juntar. Um pedido de recontagem não conta nada na hora: ele
  // arma um relógio curto, e qualquer pedido que chegue antes de o relógio
  // tocar apenas o rearma. A rajada inteira vira UMA contagem, com o número
  // final — que é o único que interessa, porque os intermediários seriam
  // substituídos antes de alguém conseguir lê-los.
  //
  // O TETO existe para a rajada que não acaba: sem ele, mensagens chegando de
  // 300 em 300 ms rearmariam o relógio para sempre e o selo nunca mudaria.
  const relogioDosSelos = useRef(null);
  const rajadaComecouEm = useRef(0);
  // A função de contar muda de identidade quando muda o telefone aberto ou a
  // lista de telefones. Guardada num `ref`, o relógio sempre dispara a ATUAL —
  // e o embrulho abaixo pode ter identidade fixa, o que evita que o canal de
  // tempo real seja desmontado e remontado a cada mudança de telefone.
  const contarRef = useRef(contarNaoLidasAgora);
  useEffect(() => { contarRef.current = contarNaoLidasAgora; }, [contarNaoLidasAgora]);

  const carregarNaoLidasPorAdv = useCallback(() => {
    const agora = Date.now();
    if (!relogioDosSelos.current) rajadaComecouEm.current = agora;
    else clearTimeout(relogioDosSelos.current);
    const falta = TETO_DOS_SELOS - (agora - rajadaComecouEm.current);
    relogioDosSelos.current = setTimeout(() => {
      relogioDosSelos.current = null;
      contarRef.current?.();
    }, Math.max(0, Math.min(ESPERA_DOS_SELOS, falta)));
  }, []);

  // O relógio pendente morre com a tela: sem isto ele acorda depois de o
  // componente sair e chama `setState` num lugar que não existe mais.
  useEffect(() => () => { if (relogioDosSelos.current) clearTimeout(relogioDosSelos.current); }, []);

  // A PRIMEIRA contagem é direta, sem esperar o relógio: aqui não há rajada
  // nenhuma para juntar, e 400 ms de selo vazio na abertura seriam 400 ms em
  // que a tela afirma que não há ninguém esperando.
  useEffect(() => { contarNaoLidasAgora(); }, [contarNaoLidasAgora]);

  // ---- Mensagens rápidas (respostas prontas, compartilhadas pela equipe) ----
  const carregarRapidas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("mensagens_rapidas")
        .select("*")
        .order("titulo", { ascending: true });
      if (error) anotarFalhaDeLeitura("rapidas", "as respostas rápidas", error);
      else { setRapidas(data || []); limparFalhaDeLeitura("rapidas"); }
    } catch (e) { anotarFalhaDeLeitura("rapidas", "as respostas rápidas", e); }
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);

  useEffect(() => { carregarRapidas(); }, [carregarRapidas]);

  // ------------------------------------------------------------
  //  A PERGUNTA "ESTÁ TUDO ANDANDO?", DE MINUTO EM MINUTO
  //
  //  Um minuto, e não três segundos: nenhum destes sinais nasce e morre em
  //  segundos, e o que se ganharia perguntando mais era ruído no banco de todo
  //  mundo o dia inteiro. Nenhum deles pede reação em segundos — o mais grave,
  //  a mensagem de cliente que não entrou, já está parado há minutos quando
  //  aparece.
  //
  //  SEM A FUNÇÃO NO BANCO, TUDO COMO ANTES. Quem ainda não rodou o SQL vê o
  //  painel exatamente como via, com um aviso no console e nada na tela — de
  //  novo a regra de que uma coisa nova não pode acender alarme sobre a própria
  //  ausência.
  //
  //  QUALQUER OUTRO ERRO É DITO. Ele entra na mesma faixa das leituras que
  //  falham, porque o desfecho aqui seria o pior de todos: a tela ficaria
  //  calada, e o silêncio dela é justamente o que significa "está tudo bem".
  // ------------------------------------------------------------
  useEffect(() => {
    let vivo = true;
    let temAFuncao = true;
    const perguntar = async () => {
      if (!temAFuncao) return;
      const { data, error } = await supabase.rpc("zorvin_saude");
      if (!vivo) return;
      if (error) {
        if (faltaAFuncao(error)) {
          temAFuncao = false;
          console.info('Zorvin: a função "zorvin_saude" não existe neste banco — '
            + "o painel não vai avisar quando algo parar. "
            + "Rode sql/2026-09-o-painel-avisa-quando-algo-para.sql.");
          return;
        }
        anotarFalhaDeLeitura("saude", "o estado do sistema", error);
        return;
      }
      limparFalhaDeLeitura("saude");
      setSaude(Array.isArray(data) ? data : []);
    };
    perguntar();
    const id = setInterval(perguntar, 60 * 1000);
    return () => { vivo = false; clearInterval(id); };
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);

  // ---- Tags (etiquetas coloridas das conversas, compartilhadas) ----
  const carregarTags = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("tags").select("*").order("nome", { ascending: true });
      if (error) anotarFalhaDeLeitura("etiquetas", "as etiquetas", error);
      else { setTags(data || []); limparFalhaDeLeitura("etiquetas"); }
    } catch (e) { anotarFalhaDeLeitura("etiquetas", "as etiquetas", e); }
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);

  // AS ETIQUETAS DAS CONVERSAS QUE ESTÃO NA LISTA — e não a tabela inteira.
  //
  // `conversa_tags` tem uma linha por (conversa, etiqueta): num escritório que
  // etiqueta o que atende, ela passa de mil linhas em poucos meses. A consulta
  // sem recorte parava no teto de 1000 da API, e as etiquetas simplesmente
  // sumiam das conversas que não couberam — sem erro, sem aviso.
  const carregarTagsConversas = useCallback(async () => {
    const ids = conversasRef.current.map((c) => c.id);
    if (!ids.length) { setTagsPorConversa({}); return; }
    try {
      const mapa = {};
      // Em lotes porque a lista de ids vai na URL: com centenas de conversas de
      // uma vez, a consulta seria recusada pelo tamanho.
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await supabase.from("conversa_tags")
          .select("conversa_id, tag_id")
          .in("conversa_id", ids.slice(i, i + 150));
        // ESTE ERA O `if (error) return;` QUE CUSTOU O DIA 04/09.
        //
        // Sair calado aqui apaga a etiqueta de TODA conversa da lista: `mapa`
        // fica pela metade (ou vazio) e é ele que a tela desenha. A pessoa vê
        // conversas sem etiqueta nenhuma e conclui que ninguém etiquetou.
        //
        // Agora a leitura para, mas ANUNCIA. E `tagsPorConversa` não é
        // sobrescrito com o mapa incompleto: é melhor manter o que já estava
        // desenhado do que trocá-lo por uma verdade pela metade.
        if (error) { anotarFalhaDeLeitura("etiquetas-conversas", "as etiquetas das conversas", error); return; }
        (data || []).forEach((r) => { (mapa[r.conversa_id] = mapa[r.conversa_id] || []).push(r.tag_id); });
      }
      setTagsPorConversa(mapa);
      limparFalhaDeLeitura("etiquetas-conversas");
    } catch (e) { anotarFalhaDeLeitura("etiquetas-conversas", "as etiquetas das conversas", e); }
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);

  // ------------------------------------------------------------
  //  FILTRAR POR ETIQUETA É PERGUNTAR AO BANCO
  //
  //  O filtro percorria a lista carregada e olhava `tagsPorConversa`, que só é
  //  preenchido para as conversas dessa lista. Num telefone com 1.200
  //  conversas, a lista tem 200 — então o filtro enxergava um sexto do
  //  escritório e mostrava o resultado como se fosse o total.
  //
  //  Não havia erro, não havia aviso: quem filtrasse por "Urgente" via duas
  //  conversas e concluía que eram duas. É o mesmo defeito que a busca tinha, e
  //  a correção é a mesma — a pergunta vai ao banco, e o que voltar entra na
  //  lista mesmo não estando nela.
  //
  //  Vem de `conversa_tags`, paginado: num escritório que etiqueta o que
  //  atende, uma etiqueta muito usada passa fácil das mil linhas, e é
  //  exatamente aí que o teto da API corta sem avisar.
  const [extrasEtiqueta, setExtrasEtiqueta] = useState([]);
  // Os ids que o BANCO deu para a etiqueta. `tagsPorConversa` só conhece as
  // conversas carregadas, então perguntar a ele por uma conversa que a lista
  // não tem devolve "não tem etiqueta" — e ela cai fora justamente depois de
  // ter sido encontrada. Este conjunto é a resposta para essas.
  const [idsEtiqueta, setIdsEtiqueta] = useState(null);

  // ------------------------------------------------------------
  //  DE QUAIS CONVERSAS EU PARTICIPEI
  //
  //  "Participei" é: em algum momento eu escrevi alguma coisa ali. Não é a
  //  conversa que está comigo agora, nem a que abri para ler. Quem divide os
  //  mesmos telefones com o escritório inteiro não tinha nenhum jeito de achar
  //  de volta as suas.
  //
  //  DOIS MODOS, e a diferença é o ponto todo:
  //    "qualquer"  Rodrigo ou Jenifer → onde pelo menos um dos dois falou.
  //    "todos"     Rodrigo e Jenifer → só onde os DOIS falaram, na MESMA
  //                conversa. É o que se procura quando um atendimento passou de
  //                mão em mão e é preciso reconstituir o que aconteceu.
  //
  //  A pergunta vai ao banco. Filtrar no navegador enxergaria só as conversas
  //  já carregadas — foi assim que o filtro por etiqueta mostrava três quando
  //  havia trinta.
  const [atendentes, setAtendentes] = useState([]);        // quem já falou por este telefone
  const [filtroQuemOk, setFiltroQuemOk] = useState(false); // o banco sabe responder?
  const [quemFiltra, setQuemFiltra] = useState([]);        // ids marcados
  const [modoQuem, setModoQuem] = useState("qualquer");    // "qualquer" | "todos"
  const [menuQuem, setMenuQuem] = useState(false);
  const [extrasQuem, setExtrasQuem] = useState([]);
  const [idsQuem, setIdsQuem] = useState(null);            // null = sem filtro
  const quemRef = useRef(null);
  // A lista de quem participou DESTA conversa (o grupinho de rostos do topo).
  // Não confundir com o filtro acima: aquele escolhe conversas por pessoa, este
  // só mostra quem escreveu na conversa aberta.
  const [quemParticipou, setQuemParticipou] = useState(false);
  const quemParticipouRef = useRef(null);

  // A lista de quem escolher sai de quem REALMENTE escreveu por este telefone.
  // Oferecer o escritório inteiro faria uma lista longa em que a maioria dos
  // nomes devolveria zero conversa — e procurar numa lista assim é pior do que
  // não ter lista.
  //
  // O BOTÃO, PORÉM, APARECE EM TODO TELEFONE. Ele dependia de a lista ter mais
  // de um nome, e o efeito disso na prática foi outro: em número atendido por
  // uma pessoa só — ou cujo histórico é todo anterior à coluna
  // `enviado_por_id`, que é o caso dos telefones mais antigos — o filtro
  // simplesmente não existia, e quem trocava de número achava que a tela tinha
  // quebrado. Um recurso que some sem dizer nada é pior do que um botão que
  // responde "nenhuma".
  //
  // `filtroQuemOk` e não `atendentes.length`: são perguntas diferentes. Uma é
  // "o banco sabe responder isto?" — que decide se o botão existe. A outra é
  // "quantas pessoas há para escolher?" — que é conteúdo do menu.
  useEffect(() => {
    let vivo = true;
    setAtendentes([]); setFiltroQuemOk(false);
    if (!advogadoId) return;
    (async () => {
      const { data, error } = await supabase.rpc("atendentes_do_telefone", { p_advogado: advogadoId });
      if (!vivo) return;
      if (error) return;            // sem a função no banco: o botão não aparece
      setAtendentes(data || []);
      setFiltroQuemOk(true);
    })();
    return () => { vivo = false; };
  }, [advogadoId]);

  // Trocar de conversa fecha a lista de quem participou: ela é de UMA conversa,
  // e deixá-la aberta mostraria os rostos da anterior sobre a nova.
  useEffect(() => { setQuemParticipou(false); }, [conversaId]);

  // Trocar de telefone zera a escolha: os atendentes são outros.
  useEffect(() => { setQuemFiltra([]); setMenuQuem(false); }, [advogadoId]);

  useEffect(() => {
    let vivo = true;
    setExtrasQuem([]);
    if (!quemFiltra.length || !advogadoId) { setIdsQuem(null); return; }
    const advId = advogadoId;
    (async () => {
      const { data, error } = await supabase.rpc("conversas_por_atendente", {
        p_advogado: advId, p_usuarios: quemFiltra,
        p_todos: modoQuem === "todos", p_limite: 500,
      });
      if (!vivo || advogadoIdRef.current !== advId) return;
      if (error) { setIdsQuem(null); return; }
      const ids = (data || []).map((r) => String(r.id));
      setIdsQuem(new Set(ids));

      // As que a lista ainda não tem — mesmo caminho da busca e da etiqueta.
      const jaNaLista = new Set(conversasRef.current.map((c) => String(c.id)));
      const faltando = ids.filter((id) => !jaNaLista.has(id));
      const achadas = [];
      for (let i = 0; i < faltando.length; i += 150) {
        const { data: cs } = await supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
          .eq("advogado_id", advId)
          .in("id", faltando.slice(i, i + 150));
        achadas.push(...(cs || []));
      }
      if (!vivo || advogadoIdRef.current !== advId) return;
      setExtrasQuem(achadas);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quemFiltra, modoQuem, advogadoId, conversas.length]);

  useEffect(() => {
    let cancelado = false;
    const tagId = filtro.startsWith("tag:") ? filtro.slice(4) : null;
    setExtrasEtiqueta([]); setIdsEtiqueta(null);
    if (!tagId || !advogadoId) return;
    const advId = advogadoId;
    (async () => {
      try {
        const ids = [];
        for (let pagina = 0; pagina < 50; pagina++) {
          const { data, error } = await supabase.from("conversa_tags")
            .select("conversa_id").eq("tag_id", tagId)
            .order("conversa_id").range(pagina * 1000, (pagina + 1) * 1000 - 1);
          if (error) return;
          ids.push(...(data || []).map((r) => r.conversa_id));
          if (!data || data.length < 1000) break;
        }
        if (cancelado || !ids.length) return;

        // As conversas em si, em lotes — a lista de ids vai na URL, e centenas
        // de uma vez fariam o pedido ser recusado pelo tamanho.
        const achadas = [];
        for (let i = 0; i < ids.length; i += 150) {
          const { data, error } = await supabase
            .from("conversas")
            .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
            .eq("advogado_id", advId)
            .in("id", ids.slice(i, i + 150));
          if (error) return;
          achadas.push(...(data || []));
        }
        // Troquei de telefone ou de etiqueta enquanto isto vinha? É resposta de
        // outra pergunta: descarta.
        if (cancelado || advogadoIdRef.current !== advId) return;
        setExtrasEtiqueta(achadas);
        setIdsEtiqueta(new Set(ids.map(String)));
      } catch (_) { /* tabela ainda não criada */ }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, advogadoId]);

  useEffect(() => { carregarTags(); }, [carregarTags]);
  // As etiquetas seguem a LISTA: quando ela troca de telefone ou chega uma
  // conversa nova, são outras conversas para etiquetar.
  useEffect(() => { carregarTagsConversas(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversas, carregarTagsConversas]);

  async function salvarTagForm() {
    const nome = (tagForm?.nome || "").trim();
    const cor = tagForm?.cor || CORES_TAG[0];
    if (!nome) { mostrarAviso("Digite o nome da etiqueta."); return; }
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
    if (!window.confirm("Apagar esta etiqueta? Ela sai de todas as conversas.")) return;
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) { mostrarAviso("Não consegui apagar a etiqueta."); return; }
    carregarTags(); carregarTagsConversas();
  }

  // Marca/desmarca uma tag na conversa aberta (otimista + banco).
  // ------------------------------------------------------------
  //  A ETIQUETA É DO CLIENTE, E NÃO DA CAIXA EM QUE ELE FALOU
  //
  //  Relato de quem usa: "a etiqueta que é incluída no contato deve aparecer
  //  nas conversas com o contato em todos os telefones".
  //
  //  `conversa_tags` guarda uma linha por (conversa, etiqueta), e cada telefone
  //  nosso tem a SUA conversa com o mesmo cliente: etiquetar "Urgente" no
  //  telefone do Dr. Max não mudava nada no do Estratégico. Etiqueta serve para
  //  achar e para priorizar — uma que só metade do escritório enxerga faz o
  //  filtro devolver metade sem dizer que devolveu metade.
  //
  //  A GRAVAÇÃO VAI PELA PONTE, e não daqui. As conversas dos OUTROS telefones
  //  são invisíveis para este navegador (é a regra de acesso, e ela está
  //  certa): espalhar a etiqueta daqui cobriria só as conversas que a pessoa já
  //  vê — deixando a etiqueta pela metade, que é o defeito de origem com outra
  //  roupa. A ponte usa a chave de serviço e alcança todas.
  //
  //  A LEITURA CONTINUA COMO ERA: cada conversa ganha a SUA linha em
  //  `conversa_tags`, então o painel lê exatamente o que já lia. Nada de
  //  exceção na regra de acesso.
  //
  //  E SE A PONTE ESTIVER DORMINDO? Ela hiberna no plano free. Em vez de
  //  perder a etiqueta, o caminho antigo entra como reserva: grava ao menos
  //  NESTA conversa e diz, em letras, que não valeu para os outros telefones.
  //  Meia etiqueta com aviso é melhor do que nenhuma em silêncio.
  async function alternarTagConversa(tagId) {
    if (!conversaId) return;
    const atuais = tagsPorConversa[conversaId] || [];
    const tem = atuais.includes(tagId);
    setTagsPorConversa((prev) => {
      const lista = new Set(prev[conversaId] || []);
      if (tem) lista.delete(tagId); else lista.add(tagId);
      return { ...prev, [conversaId]: [...lista] };
    });
    const contatoId = conversa?.contato_id || conversa?.contato?.id || null;
    if (contatoId) {
      try {
        await chamarPonte("/etiqueta/contato", {
          method: "POST",
          body: JSON.stringify({ contato_id: contatoId, tag_id: tagId, aplicar: !tem }),
        });
        return;
      } catch (_e) { /* a ponte dorme; cai para o caminho de sempre */ }
    }
    if (tem) {
      const { error } = await supabase.from("conversa_tags")
        .delete().eq("conversa_id", conversaId).eq("tag_id", tagId);
      if (error) { mostrarAviso("Não consegui tirar a etiqueta."); carregarTagsConversas(); return; }
    } else {
      const { error } = await supabase.from("conversa_tags").insert({ conversa_id: conversaId, tag_id: tagId });
      if (error) { mostrarAviso("Não consegui aplicar a etiqueta."); carregarTagsConversas(); return; }
    }
    // SÓ AVISA QUANDO HÁ OUTRO TELEFONE EM JOGO. Num cliente que só falou com
    // um telefone nosso, "não valeu para os outros" seria um susto sobre nada.
    if (outrasConversasDoContato > 0) {
      mostrarAviso("Etiqueta salva só neste telefone — a ponte não respondeu.");
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

  // ---- Perfil do atendente ----
  // `salvarNomePerfil` saiu junto com o campo. Ela chamava `auth.updateUser`,
  // que só alcança a PRÓPRIA conta — então nunca serviria para um
  // administrador arrumar o nome de outra pessoa, que é o que se queria. Quem
  // faz isso é o Vantoro, e a ponte traz o resultado no login seguinte.

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
      // E TAMBÉM ONDE OS OUTROS CONSEGUEM LER.
      // O `user_metadata` só o dono da conta alcança — era por isso que a foto
      // precisava viajar copiada dentro de cada mensagem, e por isso que trocar
      // de foto não mudava nada no que já estava escrito. `salvar_minha_foto`
      // grava na linha da pessoa em `usuarios`, que a vista `equipe` publica
      // para a equipe inteira. Se o SQL ainda não tiver sido rodado, a foto
      // continua valendo para quem a trocou e o resto segue como antes.
      const { error: erroEquipe } = await supabase.rpc("salvar_minha_foto", { p_url: url });
      if (erroEquipe) console.log("foto salva na conta, mas não na equipe:", erroEquipe.message);
      else setEquipe((e) => (meuId && e.porId[meuId]
        ? { ...e, porId: { ...e.porId, [meuId]: { ...e.porId[meuId], foto: url } } }
        : e));
      mostrarAviso("Foto atualizada!");
    } catch (_) {
      mostrarAviso("Não consegui atualizar a foto.");
    }
  }

  /** Pede à ponte que busque de novo a foto de perfil deste contato.
   *
   *  A foto guardada pode ser a MINIATURA — era o campo que vinha na frente no
   *  webhook, e foi corrigido lá. As já guardadas, porém, só melhorariam quando
   *  o contato voltasse a escrever: um cliente calado há um mês ficaria com a
   *  miniatura para sempre. Aqui se pede na hora.
   */
  async function buscarFotoMaior() {
    if (!conversaId || buscandoFoto) return;
    setBuscandoFoto(true); setErroDaFoto("");
    try {
      const r = await chamarPonte("/contato/foto", {
        method: "POST", body: JSON.stringify({ conversa_id: conversaId }),
      });
      if (!r || !r.foto_url) throw new Error("Não veio foto nenhuma.");
      if (!r.trocou) {
        setErroDaFoto("Esta é a maior foto que o WhatsApp tem deste contato.");
        return;
      }
      // A lista e a foto aberta, as duas: sem a primeira, o avatar do topo
      // continuaria mostrando a miniatura até recarregar a página.
      setConversas((atual) => atual.map((c) => (
        c.contato && String(c.id) === String(conversaId)
          ? { ...c, contato: { ...c.contato, foto_url: r.foto_url } } : c)));
      setLarguraDoRetrato(0);
      setImagemAberta(r.foto_url);
    } catch (e) {
      setErroDaFoto((e && e.message) || "Não consegui buscar a foto agora.");
    } finally {
      setBuscandoFoto(false);
    }
  }

  // Abre a tela de Configurações já com o nome atual no campo.
  function abrirConfig() {
    setAbaConfig("perfil");
    setRapidaForm(null);
    setTagForm(null);
    setContatoForm(null);
    setConfigAberta(true);
  }

  // ---- Agenda de contatos (ver todos / criar novo) ----
  const carregarContatos = useCallback(async (termo) => {
    try {
      // O TERMO VAI PARA O BANCO, e a agenda deixa de ser uma lista inteira
      // baixada e filtrada aqui.
      //
      // Era o mesmo defeito da busca de conversas: a API devolve no máximo 1000
      // linhas, em ordem alfabética — quem estivesse depois do milésimo nome
      // não existia para a agenda, e o painel dizia "Nenhum contato salvo com
      // esse nome" com toda a confiança.
      //
      // A vírgula e os parênteses saem do termo porque separam condições dentro
      // de um `or` do PostgREST: com eles, a consulta não devolve vazio —
      // devolve erro.
      const seguro = String(termo || "").replace(/[,()*]/g, " ").trim();
      const chave = chaveDoNumero(termo || "");
      const buscar = () => {
        let q = supabase.from("contatos")
          .select(colunasDoContato("id, nome, numero, foto_url"))
          .order("nome", { ascending: true })
          // Sem termo, a agenda mostra um começo — ninguém rola dez mil nomes,
          // e desenhá-los custa o mesmo que a lista de conversas custava.
          .limit(seguro || chave.length >= 4 ? 300 : 200);
        const partes = [];
        if (seguro.length >= 2) {
          partes.push(`nome.ilike.%${seguro}%`);
          if (TEM_NOME_DO_CADASTRO) {
            partes.push(`vantoro_nome.ilike.%${seguro}%`);
            partes.push(`nome_zorvin.ilike.%${seguro}%`);
          }
        }
        if (chave.length >= 4) partes.push(`numero.ilike.%${chave}%`);
        if (partes.length) q = q.or(partes.join(","));
        return q;
      };
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

  // A agenda recarrega quando a caixa de busca dela muda — com uma pausa, para
  // não disparar uma consulta por tecla.
  useEffect(() => {
    if (!novaConversaAberta) return;
    const t = setTimeout(() => carregarContatos(buscaContato), 300);
    return () => clearTimeout(t);
  }, [buscaContato, novaConversaAberta, carregarContatos]);

  // AS REGRAS DE TELEFONE MORAM EM `numeros.js`.
  //
  // Elas estavam aqui dentro, e a ficha do cliente passou a precisar das
  // mesmas respostas para decidir se o segundo número do cadastro é mesmo
  // OUTRA linha. Uma cópia responderia igual no primeiro dia e diferente no
  // primeiro conserto.
  //
  // Lá elas também se provam sem navegador, que é onde erro de número é
  // barato de achar: ele nunca aparece como erro, aparece como um cliente com
  // duas conversas, cada uma com metade do diálogo.
  //
  // E ATENÇÃO ANTES DE "UNIFICAR" COM A DE `Departamentos.jsx`: aquela é
  // parecida e responde a outra pergunta. Está explicado em `numeros.js`.

  // Procura no banco um contato que JÁ seja este telefone, escrito de qualquer
  // das formas. Sem isto, cadastrar de novo alguém que já estava lá com o
  // número curto criaria um segundo contato — e, na primeira resposta, uma
  // segunda conversa.
  async function contatoExistente(bruto) {
    const chave = chaveDoNumero(bruto);
    if (chave.length < 8) return null;
    // As quatro formas em que o mesmo celular pode estar gravado: com e sem o
    // 55, com e sem o nono dígito.
    const formas = new Set([chave, "55" + chave]);
    if (chave.length === 11 && chave[2] === "9") {
      const semNono = chave.slice(0, 2) + chave.slice(3);
      formas.add(semNono); formas.add("55" + semNono);
    }
    const { data } = await supabase.from("contatos")
      .select("id, nome, numero").in("numero", [...formas]);
    if (data && data[0]) return data[0];
    // O `in` só acha as DUAS formas limpas. Um número que entrou com máscara
    // — "(11) 93404-2997", como o cadastro às vezes devolve — não casa com
    // nenhuma delas, e o contato seria criado de novo. A agenda já está na
    // memória, então a segunda tentativa não custa consulta: compara pela
    // chave, que ignora máscara, DDI e pontuação.
    const naAgenda = (contatosLista || []).find((c) => chaveDoNumero(c.numero) === chave);
    return naAgenda || null;
  }

  // ---- O CADASTRO DO VANTORO DENTRO DA "NOVA CONVERSA" ----
  //
  // Para mandar a primeira mensagem a um cliente, alguém tinha de digitar nome
  // e telefone à mão no Zorvin — dados que já estavam no Vantoro, a duas telas
  // dali. Isso custava tempo e, pior, criava divergência: o nome era digitado
  // de um jeito, o número às vezes sem DDD, e o cadastro do escritório e a
  // agenda do atendimento passavam a discordar sobre quem era a mesma pessoa.
  //
  // A busca é a mesma rota que a lupa da lista de conversas já usava, e o token
  // do Vantoro continua onde sempre esteve: no servidor. O navegador manda a
  // sessão do Zorvin para a ponte, e é a ponte que fala com o Vantoro.
  //
  // O atraso de 350ms existe porque isto dispara a cada tecla. Sem ele, digitar
  // "Maria" faria cinco consultas ao Vantoro para mostrar o resultado de uma.
  useEffect(() => {
    if (!novaConversaAberta) { setVantoroAchados([]); setVantoroErro(""); return undefined; }
    const termo = buscaContato.trim();
    setVantoroErro("");
    if (termo.length < 3) { setVantoroAchados([]); setVantoroBuscando(false); return undefined; }
    let cancelado = false;
    setVantoroBuscando(true);
    const tarefa = setTimeout(async () => {
      try {
        const r = await chamarPonte(`/vantoro/buscar?q=${encodeURIComponent(termo)}`);
        if (!cancelado) setVantoroAchados(r.clientes || []);
      } catch (e) {
        // O Vantoro fora do ar não pode derrubar a tela: a agenda do Zorvin
        // continua funcionando, e o aviso fica restrito à seção dele.
        if (!cancelado) { setVantoroAchados([]); setVantoroErro((e && e.message) || "Não consegui consultar o Vantoro."); }
      } finally {
        if (!cancelado) setVantoroBuscando(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(tarefa); };
  }, [buscaContato, novaConversaAberta]);

  // Vira UMA LINHA POR TELEFONE, não por cliente: quem tem dois números
  // cadastrados aparece duas vezes, porque a escolha de para qual dos dois
  // mandar a mensagem é de quem está atendendo, não nossa.
  //
  // `jaVisiveis` são os contatos QUE ESTÃO NA TELA agora, e não a agenda
  // inteira — a diferença é o que fazia gente sumir das duas listas ao mesmo
  // tempo. O cliente estava salvo no Zorvin com um apelido ("Rodrigo"), a busca
  // era pelo nome do cadastro ("Rodrigo Alves Sousa"), então ele não casava em
  // CONTATOS; e como o número dele existia em algum lugar da agenda, a linha do
  // Vantoro também era descartada. Resultado: nome certo, cadastro certo, e
  // tela vazia. Agora só é descartado quem a pessoa está vendo logo acima.
  function linhasDoVantoro(jaVisiveis) {
    const naTela = new Set((jaVisiveis || []).map((c) => chaveDoNumero(c.numero)));
    const vistos = new Set();
    const linhas = [];
    (vantoroAchados || []).forEach((cli) => {
      [cli.telefone, cli.telefone2].forEach((tel, posicao) => {
        const chave = chaveDoNumero(tel);
        if (chave.length < 10) return;             // sem DDD não dá para chamar
        if (naTela.has(chave) || vistos.has(chave)) return;
        vistos.add(chave);
        linhas.push({ chave, clienteId: cli.id, nome: cli.nome,
                      numero: numeroCanonico(tel), segundo: posicao === 1 });
      });
    });
    return linhas;
  }

  // Abre a conversa com um cliente que veio do Vantoro.
  //
  // Ele vira contato do Zorvin na hora — não há como conversar sem contato,
  // porque a conversa pertence a um. A diferença para "Novo contato" é que
  // ninguém digita nada: nome, número e o vínculo com a ficha do Vantoro vêm
  // prontos, e era esse trabalho manual que se queria evitar.
  async function conversarComClienteVantoro(linha) {
    // O NÚMERO ENTRA NA FORMA CANÔNICA, como em todo outro caminho.
    //
    // Este era o único que gravava o telefone do jeito que o Vantoro devolve —
    // às vezes com máscara, quase sempre sem o 55. O WhatsApp devolve sempre
    // com o 55, então o mesmo cliente virava DOIS contatos: um criado aqui, na
    // hora de mandar a primeira mensagem, e outro criado pela ponte quando ele
    // respondia. Duas conversas, cada uma com metade do diálogo — a enviada
    // numa, a resposta na outra.
    const numero = numeroCanonico(linha.numero);
    const jaExiste = await contatoExistente(numero);
    const gravar = (campos) => (jaExiste
      ? supabase.from("contatos").update(campos).eq("id", jaExiste.id).select("id").single()
      : supabase.from("contatos").upsert({ numero, ...campos }, { onConflict: "numero" })
          .select("id").single());

    let { data: cont, error } = await gravar({
      nome: linha.nome, vantoro_cliente_id: linha.clienteId, vantoro_nome: linha.nome,
    });
    // Instalação sem as colunas de vínculo com o Vantoro: perder o vínculo é
    // aceitável, não conseguir abrir a conversa não é.
    if (error && /vantoro_/i.test(error.message || "")) {
      ({ data: cont, error } = await gravar({ nome: linha.nome }));
    }
    if (error || !cont) { mostrarAviso("Não consegui criar o contato a partir do Vantoro."); return; }
    carregarContatos();
    await abrirConversaContato(cont);
  }

  async function salvarContato() {
    const nome = (contatoForm?.nome || "").trim();
    const numero = numeroCanonico(contatoForm?.numero);
    if (!nome) { mostrarAviso("Digite o nome do contato."); return; }
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const jaExiste = await contatoExistente(numero);
    const { error } = jaExiste
      ? await supabase.from("contatos").update({ nome }).eq("id", jaExiste.id)
      : await supabase.from("contatos").upsert({ numero, nome }, { onConflict: "numero" });
    if (error) { mostrarAviso("Não consegui salvar. Verifique as permissões (RLS) da tabela 'contatos'."); return; }
    if (jaExiste) { mostrarAviso(`Este número já estava salvo; atualizei o nome.`); }
    setContatoForm(null);
    mostrarAviso("Contato salvo!");
    carregarContatos();
  }

  // Abre (ou cria) a conversa do advogado atual com este contato.
  // `advAlvo` é para quando a conversa NÃO é do telefone que está aberto —
  // hoje só o link da Esteira do Vantoro faz isso, quando a pessoa escolhe por
  // qual dos telefones do escritório quer falar. Sem o parâmetro, é o de
  // sempre: o telefone selecionado na barra lateral.
  async function abrirConversaContato(cont, advAlvo) {
    const advId = advAlvo || advogadoId;
    if (!advId) { mostrarAviso("Escolha um advogado na barra lateral primeiro."); return; }
    // Trocar de telefone é trocar de departamento junto: a barra lateral filtra
    // os telefones pelo departamento aberto, e deixar os dois em desacordo
    // esconderia da lista justamente a conversa que se acabou de abrir.
    if (advId !== advogadoId) {
      const adv = advogados.find((a) => a.id === advId);
      if (adv && adv.departamento_id) setDepartamentoId(adv.departamento_id);
      setAdvogadoId(advId);
    }
    const { data: conv, error } = await supabase.from("conversas")
      .upsert({ advogado_id: advId, contato_id: cont.id }, { onConflict: "advogado_id,contato_id" })
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
    // O ID VAI EXPLÍCITO, e não pelo `conversaIdRef`. A ordem aqui é carregar
    // e só depois abrir, e o ref só é atualizado no próximo desenho — nele
    // ainda está a conversa ANTERIOR. Sem passar o id, a conversa recém-aberta
    // seria escondida por não ter mensagem justamente no clique que a abre.
    await carregarConversas(advId, 0, conv.id);
    setConversaId(conv.id);
  }

  // "Novo contato" dentro da Nova conversa: cria e já abre a conversa.
  async function criarContatoEConversar() {
    const nome = (contatoForm?.nome || "").trim();
    const numero = numeroCanonico(contatoForm?.numero);
    if (!nome) { mostrarAviso("Digite o nome do contato."); return; }
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const jaExiste = await contatoExistente(numero);
    const { data: cont, error } = jaExiste
      ? await supabase.from("contatos").update({ nome }).eq("id", jaExiste.id).select("id").single()
      : await supabase.from("contatos").upsert({ numero, nome }, { onConflict: "numero" }).select("id").single();
    if (error || !cont) { mostrarAviso("Não consegui salvar o contato."); return; }
    carregarContatos();
    await abrirConversaContato(cont);
  }

  // Conversar direto com um número digitado (sem cadastrar nome).
  async function conversarComNumero(numeroBruto) {
    const numero = numeroCanonico(numeroBruto);
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const jaExiste = await contatoExistente(numero);
    const { data: cont, error } = jaExiste
      ? { data: jaExiste, error: null }
      : await supabase.from("contatos").upsert({ numero }, { onConflict: "numero" }).select("id").single();
    if (error || !cont) { mostrarAviso("Não consegui iniciar a conversa."); return; }
    carregarContatos();
    await abrirConversaContato(cont);
  }

  // ---- ABRIR A CONVERSA A PARTIR DO ENDEREÇO: ?telefone=55… ----
  //
  // É o que faz o botão do Zorvin na Esteira do Vantoro levar A ALGUM LUGAR.
  // Sem isto, o link abriria o painel na última conversa aberta e a pessoa
  // teria de procurar o cliente na lista — que é exatamente o trabalho que o
  // botão existe para poupar.
  //
  // `nome` é opcional e só serve para o contato nascer com nome quando ele
  // ainda não existe aqui. O número manda: se já houver contato com esse
  // telefone (em qualquer das formas — com ou sem 55, com ou sem o nono
  // dígito), é a conversa DELE que abre, e nada é criado.
  //
  // QUEM ALCANÇA MAIS DE UM TELEFONE ESCOLHE POR QUAL VAI FALAR. O link diz com
  // QUEM falar, não POR ONDE — e "por onde" muda o que o cliente vê chegar. O
  // painel abria pelo último telefone usado, que é um chute silencioso: a
  // pessoa só descobria o telefone errado depois de a mensagem ter saído.
  // Com um telefone só não há o que escolher, e nada é perguntado.
  //
  // Roda uma vez só. O endereço é limpo em seguida, senão atualizar a página
  // reabriria a conversa por cima de onde a pessoa estivesse — e um F5 que
  // muda de conversa sozinho é um painel que não se deixa usar.
  const linkJaUsado = useRef(false);
  useEffect(() => {
    if (linkJaUsado.current || !advogadoId) return;
    let params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { return; }
    const pedido = params.get("telefone") || params.get("numero");
    if (!pedido) return;
    linkJaUsado.current = true;

    // Limpa o endereço ANTES de abrir: se algo falhar no meio, o F5 seguinte
    // não repete a tentativa em silêncio.
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch (_) { /* navegador sem history: segue */ }

    (async () => {
      const numero = numeroCanonico(pedido);
      if (numero.length < 8) { mostrarAviso("O link veio com um número incompleto."); return; }
      const nome = (params.get("nome") || "").trim();
      const cont = await contatoExistente(numero);

      if (advogadosPermitidos.length <= 1) { await conversarPeloLink(cont, numero, nome); return; }

      // O LINK PODE DIZER "POR ONDE", e aí não há o que perguntar.
      //
      // Perguntar é o certo quando quem clica é que decide — o número escolhido
      // é o que o cliente vê chegar no WhatsApp dele. Mas há telas em que a
      // resposta é sempre a mesma linha: a de Audiências do Vantoro abre a
      // conversa pela linha de avisos de audiência, e só por ela. Repetir a
      // pergunta todo dia, com uma resposta só, é atrito sem ganho.
      //
      // Casa pela CHAVE do número, não pelo texto: o Vantoro manda "55…" e o
      // Zorvin pode ter gravado sem o 55 ou sem o nono dígito.
      //
      // Se a pessoa não alcançar aquela linha, a pergunta VOLTA — abrir por
      // outro telefone escondido seria mandar mensagem por um número que ela
      // não escolheu, que é justamente o que a pergunta existe para evitar.
      const pedidoDe = (params.get("de") || "").trim();
      if (pedidoDe) {
        const alvo = advogadosPermitidos.find(
          (a) => chaveDoNumero(a.numero) === chaveDoNumero(pedidoDe));
        if (alvo) { await conversarPeloLink(cont, numero, nome, alvo.id); return; }
      }

      // ONDE JÁ EXISTE CONVERSA COM ESTA PESSOA. É o que transforma a escolha
      // numa decisão informada: em vez de dois nomes de advogado, quem escolhe
      // vê onde está o histórico e desde quando. Sem contato no banco não há o
      // que consultar — todas as opções começam do zero.
      let ondeTem = [];
      if (cont) {
        const { data } = await supabase.from("conversas")
          .select("advogado_id, ultima_atividade").eq("contato_id", cont.id);
        ondeTem = data || [];
      }
      const opcoes = advogadosPermitidos.map((adv) => {
        const c = ondeTem.find((x) => String(x.advogado_id) === String(adv.id));
        return { adv, ultima: (c && c.ultima_atividade) || null, temConversa: !!c };
      });
      // Quem já tem conversa vem primeiro, do mais recente para o mais antigo:
      // é quase sempre a resposta certa, e deixá-la no topo poupa a leitura.
      opcoes.sort((a, b) => {
        if (a.temConversa !== b.temConversa) return a.temConversa ? -1 : 1;
        if (a.ultima && b.ultima) return new Date(b.ultima) - new Date(a.ultima);
        return String(a.adv.nome || "").localeCompare(String(b.adv.nome || ""));
      });
      setEscolhaTelefone({ contato: cont, numero, nome, opcoes });
    })();
    // `advogadoId` é a única dependência de verdade: é ele que decide de QUAL
    // telefone do escritório a conversa é, e ele chega depois da primeira
    // pintura (vem do banco). O resto são funções do próprio componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advogadoId]);

  // ---- HISTÓRICO DE ATENDIMENTO DESTE CLIENTE ----
  //
  // A pergunta que ele responde é "quem já falou com esta pessoa, quando, e
  // por qual dos nossos telefones". Ela aparece toda semana — antes de cobrar,
  // antes de ligar, antes de responder uma reclamação de "ninguém me
  // respondeu" — e a única forma de responder era rolar a conversa até o
  // começo, uma conversa de cada vez, telefone por telefone.
  //
  // É por CONTATO, e não por conversa: o mesmo cliente costuma ter conversa
  // com mais de um telefone do escritório, e é justamente aí que a resposta
  // some. Quem olha uma conversa só vê metade da história.
  //
  // PRIMEIRA e ÚLTIMA são consultas separadas, com `limit(1)` em cada sentido,
  // e não uma leitura de tudo para depois escolher: a conversa de um cliente
  // antigo tem milhares de mensagens, e trazer todas para mostrar duas seria
  // pagar o preço inteiro pela informação mais barata da tela.
  //
  // Só entram mensagens ENVIADAS (`origem = 'advogado'`). "Quem falou com o
  // cliente" é sobre nós; o que ele mandou está na conversa.
  async function carregarHistorico(contatoId) {
    setHistorico({ carregando: true, linhas: [], erro: "", parcial: false, alteracoes: [] });

    // O HISTÓRICO DE ALTERAÇÕES, direto do banco. É do escritório inteiro e
    // não passa pela ponte: são linhas do Zorvin, não do Vantoro, e a regra de
    // leitura já libera para quem está dentro.
    //
    // Vai numa promessa à parte, sem `await` travando o resto: se esta tabela
    // não existir (SQL não rodado), a lista de telefones continua aparecendo.
    supabase.from("alteracoes")
      .select("tipo, alvo, antes, depois, autor, criado_em")
      .eq("contato_id", contatoId)
      .order("criado_em", { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (error) return;
        setHistorico((h) => (h ? { ...h, alteracoes: data || [] } : h));
      });

    // PELA PONTE, e não direto do banco.
    //
    // A regra de linha do Supabase (`pode_ver_conversa`) recorta a consulta do
    // navegador pelos telefones que a PESSOA alcança. O histórico assim
    // recortado respondia "ninguém falou com esse cliente" quando a resposta
    // certa era "falaram, por um telefone que você não abre" — e é justamente
    // essa a pergunta que a tela existe para responder.
    //
    // A ponte usa a chave de serviço e enxerga o escritório inteiro. Ela
    // devolve só o RESUMO: quem escreveu, quando e por qual telefone. Texto de
    // mensagem nenhum atravessa.
    try {
      const r = await chamarPonte(`/historico/contato/${encodeURIComponent(contatoId)}`);
      const linhas = (r.linhas || []).map((l) => ({
        conversaId: l.conversa_id,
        advogadoId: l.advogado_id,
        adv: (l.advogado_nome || l.advogado_numero)
          ? { nome: l.advogado_nome, numero: l.advogado_numero }
          : advogados.find((a) => String(a.id) === String(l.advogado_id)) || null,
        primeira: l.primeira || null,
        ultima: l.ultima || null,
      }));
      linhas.sort((a, b) => new Date(b.ultima?.criado_em || 0) - new Date(a.ultima?.criado_em || 0));
      // Forma funcional: as alterações chegam por outra promessa, e trocar o
      // objeto inteiro aqui apagaria as que já tivessem chegado.
      setHistorico((h) => ({ ...(h || {}), carregando: false, linhas, erro: "", parcial: false }));
      return;
    } catch (_e) {
      // A ponte dorme no plano gratuito e pode demorar a acordar. Em vez de
      // deixar a tela sem nada, mostramos o que ESTE navegador alcança — e
      // dizemos, em letras, que a lista está incompleta. O erro aqui seria
      // mostrar a lista curta com cara de completa.
    }

    const { data: convs, error } = await supabase.from("conversas")
      .select("id, advogado_id").eq("contato_id", contatoId);
    if (error) {
      setHistorico((h) => ({ ...(h || {}), carregando: false, linhas: [], parcial: false,
                             erro: "Não consegui ler o histórico." }));
      return;
    }
    const pontas = (v, crescente) => supabase.from("mensagens")
      .select("enviado_por, enviado_por_id, enviado_por_foto, criado_em")
      .eq("conversa_id", v.id).eq("origem", "advogado")
      .order("criado_em", { ascending: crescente }).limit(1);

    const linhas = await Promise.all((convs || []).map(async (v) => {
      const [pri, ult] = await Promise.all([pontas(v, true), pontas(v, false)]);
      return {
        conversaId: v.id,
        advogadoId: v.advogado_id,
        adv: advogados.find((a) => String(a.id) === String(v.advogado_id)) || null,
        primeira: (pri.data || [])[0] || null,
        ultima: (ult.data || [])[0] || null,
      };
    }));
    // O telefone com movimento mais recente primeiro: é onde a conversa está
    // viva, e é a linha que quase sempre se procura.
    linhas.sort((a, b) => new Date(b.ultima?.criado_em || 0) - new Date(a.ultima?.criado_em || 0));
    setHistorico((h) => ({ ...(h || {}), carregando: false, linhas, erro: "", parcial: true }));
  }

  // "Ver a conversa" de uma linha do histórico: troca para aquele telefone e
  // abre a conversa que JÁ existe ali. Nada é criado — a linha só existe
  // porque a conversa existe.
  //
  // A LEITURA continua valendo a permissão. O histórico mostra o escritório
  // inteiro (é resumo: nome, data, telefone), mas ABRIR uma conversa é ler as
  // mensagens dela, e isso o banco não entrega a quem não alcança o telefone.
  // Em vez de trocar de telefone e cair numa lista vazia — o que pareceria
  // defeito —, o botão nem aparece, e a linha diz por quê.
  async function verConversaDoHistorico(l) {
    const adv = advogadosPermitidos.find((a) => String(a.id) === String(l.advogadoId));
    if (!adv) { mostrarAviso("Você não tem acesso a este telefone."); return; }
    setHistorico(null);
    setVerArquivadas(false);
    if (adv.departamento_id) setDepartamentoId(adv.departamento_id);
    setAdvogadoId(adv.id);
    // Pelo mesmo motivo de `abrirConversaContato`: o ref ainda tem a anterior.
    await carregarConversas(adv.id, 0, l.conversaId);
    setConversaId(l.conversaId);
  }

  // Abre a conversa do link, criando o contato só se ele ainda não existir.
  // A criação fica para DEPOIS da escolha do telefone de propósito: quem
  // desiste no meio não deixa para trás um contato que ninguém pediu.
  async function conversarPeloLink(contato, numero, nome, advAlvo) {
    let cont = contato;
    if (!cont) {
      const { data, error } = await supabase.from("contatos")
        .upsert(nome ? { numero, nome } : { numero }, { onConflict: "numero" })
        .select("id").single();
      if (error || !data) { mostrarAviso("Não consegui abrir a conversa desse número."); return; }
      cont = data;
      carregarContatos();
    }
    await abrirConversaContato(cont, advAlvo);
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
        // A AGENDA INTEIRA, EM PÁGINAS. Aqui não dá para recortar por termo: o
        // casamento é por nome normalizado (minúsculas, espaços colapsados), e
        // um `in` com a grafia original erraria justamente os casos que este
        // trecho existe para acertar. Então lê tudo — mas só duas colunas, e
        // paginando, porque um `select` solto pararia em 1000 e deixaria os
        // contatos do fim do alfabeto sem número, em silêncio.
        //
        // É uma importação: acontece raramente e vale a paciência.
        const agenda = [];
        for (let pag = 0; pag < 40; pag++) {
          const { data: parte, error: erroAgenda } = await supabase.from("contatos")
            .select("nome, numero").range(pag * 1000, pag * 1000 + 999);
          if (erroAgenda || !parte || !parte.length) break;
          agenda.push(...parte);
          if (parte.length < 1000) break;
        }
        if (agenda.length) {
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
          // A CHAVE É (conversa, id_uazapi), como na ponte. Ela mudou por causa do
          // grupo com dois telefones nossos dentro: a mesma mensagem do WhatsApp
          // existe legitimamente em duas conversas, e o `id_uazapi` sozinho a
          // descartava na segunda. Aqui a importação de histórico usa a mesma
          // chave — duas chaves diferentes para a mesma tabela voltariam a
          // descartar em silêncio, só que por outro caminho.
          const { error } = await supabase.from("mensagens").upsert(linhas.slice(i, i + 400), { onConflict: "conversa_id,id_uazapi", ignoreDuplicates: true });
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
  // ANTES DO ALVO: quantas mensagens vêm acima da que foi achada na busca.
  // Um punhado basta para dar contexto ("do que se estava falando"), e é o que
  // cabe sem fazer a abertura ficar pesada.
  const ANTES_DO_ALVO = 40;

  const carregarMensagens = useCallback(async (convId) => {
    if (!convId) { setMensagens([]); setTemMaisAntigas(false); setEstadoMensagens("pronto"); return; }
    setEstadoMensagens("carregando");

    // A CONVERSA NOVA NUNCA MOSTRA AS MENSAGENS DA ANTERIOR.
    //
    // Relato do escritório: "trocando de conversa, demora a carregar a nova —
    // isso pode fazer o atendente mandar a mensagem para a conversa errada".
    //
    // Era isto: a lista só era trocada DEPOIS das consultas voltarem. Nesse
    // intervalo o cabeçalho já era o do contato novo, o destino do envio já era
    // o novo, e o que estava desenhado embaixo ainda era a conversa ANTERIOR.
    // Quem olha a tela para saber com quem está falando lia a resposta errada —
    // e é exatamente para saber isso que se olha a tela.
    //
    // Esvaziar é melhor do que mostrar outra coisa. Vazio ninguém confunde com
    // o histórico de alguém; a conversa de outro cliente, sim.
    //
    // SÓ QUANDO A CONVERSA MUDOU. Recarregar a mesma (é o que a busca por
    // mensagem faz, para saltar até a linha achada) não pode piscar a tela.
    if (ultimaCarregadaRef.current !== convId) {
      ultimaCarregadaRef.current = convId;
      setMensagens((prev) => {
        prev.forEach((m) => { if (m.midia_url && String(m.midia_url).startsWith("blob:")) URL.revokeObjectURL(m.midia_url); });
        return [];
      });
      setIdDivisorNaoLidas(null);
      setTemMaisAntigas(false);
    }

    // A conversa aberta a partir de um resultado de busca não começa no fim:
    // começa na mensagem que casou. Aqui o alvo é só LIDO — quem o apaga é o
    // efeito que faz o salto, depois de ele acontecer.
    const alvo = alvoDe(convId);

    // AS TRÊS LEITURAS SAEM JUNTAS, e antes saíam em fila indiana.
    //
    // Mensagens, depois notas, depois a fila de erro: três idas ao banco uma
    // atrás da outra, cada uma esperando a anterior VOLTAR para começar. Nenhuma
    // depende do resultado das outras — a espera era só a ordem em que estavam
    // escritas. Num 4G do fórum, três voltas de rede em série são o que a pessoa
    // sente como "demora a abrir".
    //
    // Saindo juntas, o custo passa a ser o da mais lenta em vez da soma das
    // três. As notas e a fila são disparadas AQUI e esperadas lá embaixo.
    //
    // O `.then((r) => r)` NÃO É ENFEITE, e quase passou batido: no supabase-js
    // a consulta é PREGUIÇOSA. `supabase.from(...).select(...)` devolve um
    // construtor, e o `fetch` só sai lá dentro do `then` — guardar o construtor
    // numa variável não dispara nada, e aguardá-lo mais abaixo faria a ida à
    // rede começar exatamente onde começava antes. A "paralelização" seria
    // enfeite, com a fila indiana intacta.
    const pedidoDasNotas = supabase
      .from("notas").select("*").eq("conversa_id", convId)
      .order("criado_em", { ascending: true }).then((r) => r);
    const pedidoDaFila = supabase.from("fila_envio")
      .select("*").eq("conversa_id", convId).eq("status", "erro")
      .order("criado_em", { ascending: true }).limit(50).then((r) => r);

    let recentes = [], erro = null, maisAntigas = false;
    if (alvo && alvo.em) {
      const [antes, depois] = await Promise.all([
        supabase.from("mensagens").select("*").eq("conversa_id", convId)
          .lt("criado_em", alvo.em)
          .order("criado_em", { ascending: false }).limit(ANTES_DO_ALVO),
        supabase.from("mensagens").select("*").eq("conversa_id", convId)
          .gte("criado_em", alvo.em)
          .order("criado_em", { ascending: true }).limit(TETO_MENSAGENS),
      ]);
      erro = antes.error || depois.error;
      recentes = [...(antes.data || []).slice().reverse(), ...(depois.data || [])];
      maisAntigas = (antes.data || []).length >= ANTES_DO_ALVO;
    } else {
      const { data, error } = await supabase
        .from("mensagens")
        .select("*")
        .eq("conversa_id", convId)
        .order("criado_em", { ascending: false })
        .limit(TETO_MENSAGENS);
      erro = error;
      // Vieram de trás para a frente (para pegar as últimas); a tela quer na
      // ordem do tempo.
      recentes = (data || []).slice().reverse();
      maisAntigas = (data || []).length >= TETO_MENSAGENS;
    }

    // ERRO NÃO É LISTA VAZIA. Sem esta guarda, uma oscilação de 4G ao tocar na
    // conversa abria uma tela EM BRANCO — e, dez linhas abaixo, zerava o
    // contador de não lidas no banco. As cinco mensagens do cliente sumiam da
    // lista e do título da aba, e ninguém mais sabia que existiam. O
    // zeramento é o "eu li": ele só pode acontecer depois de uma leitura que
    // deu certo.
    if (erro) {
      // A LISTA JÁ FOI ESVAZIADA lá em cima, e é o que salva este caminho: antes
      // o `return` deixava na tela as mensagens da conversa ANTERIOR, embaixo do
      // nome da nova, até alguém tocar de novo. O aviso pedia para tentar outra
      // vez enquanto a tela mostrava o histórico de outro cliente.
      //
      // O AVISO SOZINHO NÃO BASTAVA, e foi o relato de 31/08: "não consigo abrir
      // as mensagens", com a foto de uma conversa aberta e o miolo preto. O
      // aviso some em quatro segundos; quem chega meio minuto depois — ou quem
      // olha a foto — vê uma tela que não diz nada. Erro, vazia e carregando
      // eram, as três, exatamente a mesma coisa: nada.
      //
      // Agora a falha FICA na tela, com o que houve e um jeito de tentar de
      // novo sem sair da conversa. E vai para o console com o detalhe cru, que
      // é o que permite descobrir a causa de um relato que não se reproduz.
      console.error("[zorvin] falha ao carregar mensagens", convId, erro);
      setEstadoMensagens({ erro: erro.message || String(erro), codigo: erro.code || "" });
      mostrarAviso("Não consegui carregar as mensagens. Toque na conversa de novo.");
      return;
    }
    // Também carrega as NOTAS internas (comentários da equipe) e mistura na
    // linha do tempo, em ordem de horário. Notas ficam numa tabela separada
    // e nunca são enviadas para o WhatsApp.
    let notas = [];
    try {
      const { data: ns, error: nErr } = await pedidoDasNotas;
      // A NOTA QUE NÃO CARREGA NÃO PODE PARECER NOTA QUE NÃO EXISTE.
      //
      // A nota interna é o combinado da equipe sobre aquele cliente — "não
      // prometer prazo antes de conferir", "o irmão dele também é nosso". Uma
      // conversa que perde as notas em silêncio é pior do que uma que avisa:
      // quem atende segue confiante, sem o que foi combinado.
      //
      // Em 04/09 foi exatamente isso, e ninguém percebeu: as notas sumiram
      // junto com as etiquetas e o relato só mencionou as etiquetas.
      if (nErr) anotarFalhaDeLeitura("notas", "as notas internas", nErr);
      else {
        notas = (ns || []).map((n) => ({ ...n, id: "nota-" + n.id, origem: "nota" }));
        limparFalhaDeLeitura("notas");
      }
    } catch (e) { anotarFalhaDeLeitura("notas", "as notas internas", e); }
    // ------------------------------------------------------------
    //  AS QUE NÃO SAÍRAM
    //
    //  Mensagem que falhou nunca chega em `mensagens` — ela fica na fila de
    //  envio, marcada com erro. A bolha vermelha só existia na memória do
    //  navegador, então recarregar a página fazia a mensagem SUMIR: o texto que
    //  a pessoa escreveu, o motivo da falha e o botão de reenviar, os três de
    //  uma vez. Ficava a impressão de que tinha sido enviada.
    //
    //  Agora elas são lidas da fila e voltam para a conversa, no horário em que
    //  foram escritas. Se a tabela ainda não tiver as colunas novas, a leitura
    //  falha e a conversa abre sem elas — como abria antes.
    let naoSairam = [];
    try {
      const { data: falhas, error: erroFila } = await pedidoDaFila;
      // O ERRO DESTA LEITURA ERA DESCARTADO NA DESESTRUTURAÇÃO — ele nem
      // chegava a ser lido. O que ela traz são as mensagens que NÃO SAÍRAM:
      // some-las em silêncio faz a pessoa acreditar que tudo foi entregue, que
      // é o oposto do que a bolha vermelha existe para dizer.
      if (erroFila) anotarFalhaDeLeitura("fila", "as mensagens que não saíram", erroFila);
      else limparFalhaDeLeitura("fila");
      // O QUE JÁ FOI DISPENSADO NÃO VOLTA. Se a gravação do 'descartada' no
      // banco não passou, a linha continua com `status = 'erro'` e viria de
      // novo a cada abertura da conversa — que é exatamente o "nada aconteceu"
      // que o escritório viu.
      const dispensados = lerDispensados();
      naoSairam = (falhas || []).filter((f) => !dispensados.has(String(f.id))).map((f) => ({
        id: "fila-" + f.id,
        conversa_id: convId,
        origem: "advogado",
        tipo: f.tipo || "texto",
        texto: f.texto || null,
        midia_url: f.midia_url || null,
        midia_mime: f.midia_mime || null,
        enviado_por: f.enviado_por || null,
        // O ID VEM JUNTO. Sem ele a mensagem que não saiu era a única da
        // conversa que continuava assinada com o nome de antes — e é logo ela
        // que a pessoa vai reler para decidir se reenvia.
        enviado_por_id: f.enviado_por_id || null,
        enviado_por_foto: f.enviado_por_foto || null,
        criado_em: f.criado_em,
        _status: "erro",
        _filaId: f.id,
        _motivo: f.erro_motivo || null,
        _detalhe: f.erro_detalhe || null,
        _midiaUrlFinal: f.midia_url || null,
      }));
    } catch (_) { /* fila sem as colunas novas: a conversa abre sem elas */ }

    const juntas = [...recentes, ...notas, ...naoSairam].sort(
      (a, b) => new Date(a.criado_em) - new Date(b.criado_em)
    );
    // Se troquei de conversa enquanto esta busca estava em andamento, descarta o
    // resultado — senão as mensagens da conversa antiga sobrescreveriam a atual.
    if (conversaIdRef.current !== convId) return;
    setEstadoMensagens("pronto");
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
    setTemMaisAntigas(maisAntigas);
    // A mensagem achada fica marcada para a tela rolar até ela e destacá-la.
    if (alvo) setSalto((s) => ({ id: String(alvo.id ?? ""), n: (s?.n || 0) + 1 }));
    else { setSalto(null); setMsgDestacada(null); }
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

  // AO SAIR DA CONVERSA, A MARCA É APAGADA.
  //
  // Faltava esta metade. Entrar escrevia "estou aqui"; sair não escrevia nada.
  // O melhor que podia acontecer era o aviso vencer sozinho três minutos
  // depois — e nem isso acontecia, porque nada mandava a tela recontar.
  //
  // Apagando na saída, quem está do outro lado vê o aviso sumir na hora, pelo
  // mesmo aviso de tempo real que o fez aparecer.
  //
  // `.eq('atendendo_por', meuNome)` NÃO É DETALHE: entre eu abrir e eu sair,
  // outra pessoa pode ter entrado e a marca já ser dela. Apagar sem conferir
  // apagaria a presença de quem está lá agora — e o aviso sumiria da tela de
  // alguém justamente quando ele passou a ser verdade.
  //
  // Fechar a aba no X continua sem apagar nada: o navegador não dá tempo de
  // uma escrita sair. Esse caso fica com os 3 minutos, que agora funcionam.
  useEffect(() => {
    if (!conversaId || !RECURSOS.atendendo) return undefined;
    const saindoDe = conversaId;
    const quemSouEu = meuNome;
    return () => {
      supabase.from("conversas")
        .update({ atendendo_por: null, atendendo_em: null })
        .eq("id", saindoDe)
        .eq("atendendo_por", quemSouEu)
        .then(() => {});
    };
  }, [conversaId, meuNome]);

  // AO SAIR SEM TER ESCRITO NADA, A CONVERSA SAI DA LISTA.
  //
  // A outra metade do conserto. A consulta esconde a conversa sem mensagem,
  // mas abre exceção para a que está ABERTA — senão clicar num contato abriria
  // uma conversa que a lista diz não existir. Só que essa exceção não se
  // desfazia ao sair: a linha vazia ficava na tela até a próxima leitura do
  // banco, que na prática é até alguém recarregar a página. Era metade do
  // relato consertado, e a metade que sobra é a que a pessoa vê.
  //
  // A CONTAGEM VEM DO BANCO, e não do que está na tela. O que a tela tem é o
  // array de mensagens, e no instante da saída ele já pode estar sendo trocado
  // pelo da conversa nova — ler dali é apostar numa ordem de eventos. Uma
  // contagem com `head: true` não traz linha nenhuma: o banco responde só o
  // número.
  //
  // E ELA SÓ TIRA NO ZERO CRAVADO. Erro de rede, contagem nula, qualquer
  // dúvida: a linha fica. Esconder uma conversa de verdade por causa de uma
  // resposta que não veio é o erro que não se pode cometer aqui.
  useEffect(() => {
    if (!conversaId) return undefined;
    const saindoDe = conversaId;
    return () => {
      supabase.from("mensagens")
        .select("id", { count: "exact", head: true })
        .eq("conversa_id", saindoDe)
        .then(({ count, error }) => {
          if (error || count !== 0) return;
          setConversas((prev) => prev.filter(
            (c) => String(c.id) !== String(saindoDe) || c.fixada));
        });
    };
  }, [conversaId]);

  // ---- Ajusta a altura da caixa de texto conforme escreve (várias linhas) ----
  //
  // `scrollHeight` JÁ INCLUI o respiro de cima e de baixo. Numa caixa
  // content-box (o padrão), devolver esse número para `height` soma o respiro
  // outra vez: uma linha de 20px virava 60 em vez de 40, e a barra inteira
  // desalinhava assim que alguém digitava a primeira letra — ou ao trocar de
  // conversa, quando o rascunho é restaurado e este efeito roda de novo.
  //
  // A caixa agora é border-box (ver o estilo dela), então altura é altura. O
  // `height: auto` antes da medida continua necessário: sem ele, a caixa nunca
  // encolheria ao apagar texto, porque `scrollHeight` jamais fica menor que a
  // altura já fixada.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
    // `modoNota` E `estreito` NAS DEPENDÊNCIAS, e não só o texto.
    //
    // A caixa MUDA DE LUGAR quando a nota abre — ela sai da barra de baixo e vai
    // para o painel de cima. Mudar de lugar é ser desmontada e montada de novo,
    // e a caixa nova nasce com a altura de uma linha, sem a que este efeito
    // tinha calculado. Como as dependências eram só o texto e a conversa, ele
    // não rodava: no celular o aviso "Escreva uma nota interna (só a equipe vê)"
    // ocupa duas linhas e ficava CORTADO AO MEIO — medido, a caixa precisava de
    // 80px e tinha 40.
    //
    // `estreito` pelo mesmo motivo, um passo adiante: virar o telefone muda a
    // largura, e o que cabia em uma linha passa a caber em duas.
  }, [rascunho, conversaId, modoNota, estreito]);

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
                // "saiu" é a provisória que a FILA já confirmou. Ela continua
                // sendo provisória, e a linha real tem de substituí-la do
                // mesmo jeito — senão a mensagem apareceria duas vezes.
                if (!removido && String(m.id).startsWith("temp-") &&
                    (m._status === "enviando" || m._status === "saiu") &&
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
        // A PRÉVIA DA LISTA APRENDE COM A MENSAGEM QUE ACABOU DE CHEGAR.
        //
        // O tipo de cada última mensagem era descoberto UMA VEZ, ao abrir o
        // telefone. Uma mensagem que chegasse depois trocava o texto da prévia
        // (pelo handler de UPDATE de conversas) e não trocava o tipo — então a
        // linha passava a mostrar o texto cru que o banco guarda, "[anexo]".
        //
        // Foi o relato: um áudio recebido às 17:37 aparecia como "[anexo]" na
        // lista, enquanto a conversa logo acima, cujo documento tinha chegado
        // ANTES de abrir a tela, aparecia certinha como "📄 Documento".
        //
        // Aqui o tipo vem de graça: ele está na própria linha que chegou.
        setUltimasMidias((antes) => {
          const novo = { ...antes };
          if (nova.tipo && nova.tipo !== "texto") {
            novo[nova.conversa_id] = { tipo: nova.tipo, segundos: nova.midia_segundos || null };
          } else {
            delete novo[nova.conversa_id];      // texto depois de mídia limpa o rótulo
          }
          return novo;
        });

        // Esta mensagem é do advogado atualmente aberto? Se a conversa já está
        // na lista, sim. Se não está (pode ser uma conversa NOVA — lead novo),
        // confirmamos com uma consulta rápida do advogado_id.
        const jaNaLista = conversasRef.current.some((c) => c.id === nova.conversa_id);
        let doAdvogadoAtual = jaNaLista;
        // A CONFIRMAÇÃO VALE PARA OS DOIS SENTIDOS.
        //
        // Ela era só para mensagem RECEBIDA. Com isso, a primeira mensagem que
        // um colega ENVIA numa conversa que não está na minha lista não a
        // trazia para cá — eu só a via ao recarregar a página.
        //
        // Enquanto toda conversa aberta já entrava na lista na hora, o buraco
        // quase não aparecia. Agora que a conversa sem mensagem fica de fora, é
        // exatamente por aqui que ela volta quando alguém fala pela primeira
        // vez — e "alguém" inclui o escritório, não só o cliente.
        if (!doAdvogadoAtual && advogadoIdRef.current) {
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
      // Uma mensagem MUDOU: o tiquinho de lida, ou as reações presas nela.
      //
      // Este handler copiava só o `status`, e por isso a reação do contato não
      // aparecia com a conversa aberta — só depois de sair e entrar de novo,
      // quando a tela relia tudo do banco. Reação é UPDATE, não INSERT: chega
      // por aqui, e era descartada em silêncio a dois passos da tela.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensagens" }, (payload) => {
        const atual = payload.new;
        if (!atual || atual.conversa_id !== conversaIdRef.current) return;
        setMensagens((prev) => prev.map((m) => (m.id === atual.id
          ? { ...m, status: atual.status,
              reacoes: "reacoes" in atual ? atual.reacoes : m.reacoes,
              // O ARQUIVO QUE CHEGA DEPOIS DA BOLHA.
              //
              // A mídia recebida agora nasce com a miniatura embutida no
              // webhook — a bolha aparece na hora, em vez de esperar o
              // download inteiro — e a ponte troca pela imagem de verdade
              // assim que ela chega. Sem copiar `midia_url` aqui, essa troca
              // acontecia no banco e não na tela: quem estava com a conversa
              // aberta ficava olhando a miniatura borrada até recarregar a
              // página, e o conserto da demora teria criado um defeito novo.
              midia_url: "midia_url" in atual ? (atual.midia_url ?? m.midia_url) : m.midia_url,
              midia_mime: "midia_mime" in atual ? (atual.midia_mime ?? m.midia_mime) : m.midia_mime,
              midia_segundos: "midia_segundos" in atual
                ? (atual.midia_segundos ?? m.midia_segundos) : m.midia_segundos }
          : m)));
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
          // Fixadas no alto; entre iguais, a ordem que a pessoa escolheu.
          // Pelo `ref` e não pelo estado: este tratador é registrado uma vez e
          // ficaria preso na ordem que valia naquele instante.
          const sentido = ordemRef.current === "antigas" ? -1 : 1;
          return patched.sort((a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0)
            || sentido * (new Date(b.ultima_atividade) - new Date(a.ultima_atividade)));
        });
        carregarNaoLidasPorAdv();
      })
      // Se a ponte não conseguir enviar, a fila vira "erro" — aviso na tela.
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_envio" }, (payload) => {
        const row = payload.new;
        if (!row || row.conversa_id !== conversaIdRef.current) return;
        // A FILA JÁ DISSE QUE SAIU: o relógio tem de parar aqui.
        //
        // Quem tirava o relógio era só a chegada da mensagem "de verdade" pelo
        // Realtime. Quando essa linha não chega — e ela não chega quando o
        // contato está duplicado e a ponte grava na OUTRA conversa — a bolha
        // ficava "aguardando" para sempre, embora o cliente já tivesse
        // recebido. Foi o que a equipe descreveu: a mensagem só "aparecia
        // enviada" ao sair e entrar na conversa.
        //
        // A fila é uma fonte de verdade tão boa quanto: se ela está 'enviada',
        // a Uazapi aceitou. O tique fica cinza (enviada, ainda não entregue) —
        // se a linha real chegar depois, ela substitui esta bolha e traz o
        // status verdadeiro.
        if (row.status === "enviada") {
          setMensagens((prev) => {
            let marcado = false;
            return prev.map((m) => {
              if (marcado) return m;
              const casa = String(m.id).startsWith("temp-") && m._status === "enviando" &&
                ((row.texto && m.texto === row.texto) || (row.midia_url && m._midiaUrlFinal === row.midia_url));
              if (!casa) return m;
              marcado = true;
              return { ...m, _status: "saiu" };
            });
          });
          return;
        }
        if (row.status !== "erro") return;
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
            // O MOTIVO VEM JUNTO. Sem ele a bolha só sabe dizer "não enviado",
            // e quem atende não tem como saber se o número está errado, se o
            // cliente não tem WhatsApp ou se é coisa de um minuto — cada um
            // desses casos pede uma ação diferente.
            return { ...m, _status: "erro", _filaId: row.id,
                     _motivo: row.erro_motivo || null, _detalhe: row.erro_detalhe || null };
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

  // ------------------------------------------------------------
  //  QUANTAS CONVERSAS ESTE CLIENTE TEM NOS OUTROS TELEFONES
  //
  //  Relato de quem usa: "na conversa, no ícone de histórico, quero que indique
  //  de alguma forma quantas conversas existem com aquele contato em outros
  //  telefones".
  //
  //  O ícone era mudo. A informação existia — o painel de histórico a mostra —
  //  mas só depois de clicar, e ninguém clica num ícone para descobrir que não
  //  há nada lá. O resultado é duas pessoas do escritório atendendo o mesmo
  //  cliente sem saber uma da outra.
  //
  //  PELA PONTE porque daqui não dá: a regra de acesso recorta as conversas
  //  pelos telefones que a pessoa alcança, e a resposta seria sempre "só esta"
  //  — que é justamente a resposta errada. Só o número atravessa.
  //
  //  FALHAR AQUI NÃO MOSTRA NÚMERO NENHUM, e é de propósito: um "1" pendurado
  //  em toda conversa quando a ponte dorme seria pior que o silêncio de antes
  //  — um número errado é lido como certo.
  const [outrasConversasDoContato, setOutrasConversasDoContato] = useState(0);
  const contatoDaConversa = conversa?.contato_id || conversa?.contato?.id || null;
  useEffect(() => {
    setOutrasConversasDoContato(0);
    if (!contatoDaConversa) return;
    let valeu = true;
    chamarPonte(`/historico/contato/${encodeURIComponent(contatoDaConversa)}/quantas`)
      .then((r) => {
        if (!valeu) return;
        // MENOS ESTA. O que interessa é "além da que estou vendo": dizer "2"
        // numa tela que já mostra uma delas faz quem lê procurar duas outras.
        setOutrasConversasDoContato(Math.max(0, Number(r?.conversas || 0) - 1));
      })
      .catch(() => { if (valeu) setOutrasConversasDoContato(0); });
    return () => { valeu = false; };
  }, [contatoDaConversa]);

  // OS PROCESSOS DO CLIENTE, buscados só quando alguém abre o modo nota.
  //
  // Não na abertura da conversa: a maioria das conversas nunca recebe nota, e
  // perguntar ao Vantoro em todas seria uma ida à rede por conversa aberta —
  // num serviço que hiberna no plano gratuito e demora a acordar.
  //
  // FALHAR AQUI NÃO IMPEDE A NOTA. Sem a lista, o seletor não aparece e a nota
  // é geral; o que não pode acontecer é a pessoa não conseguir anotar porque o
  // Vantoro está fora do ar.
  const clienteDaConversa = conversa?.contato?.vantoro_cliente_id || null;
  useEffect(() => {
    if (!modoNota || !clienteDaConversa) { setProcessosDoCliente([]); return; }
    let valeu = true;
    setBuscandoProcessos(true);
    chamarPonte(`/vantoro/cliente/${clienteDaConversa}`)
      .then((r) => { if (valeu) setProcessosDoCliente((r && r.cliente && r.cliente.processos) || []); })
      .catch(() => { if (valeu) setProcessosDoCliente([]); })
      .finally(() => { if (valeu) setBuscandoProcessos(false); });
    return () => { valeu = false; };
  }, [modoNota, clienteDaConversa]);

  // Trocar de conversa zera a escolha: o processo de um cliente não vale para
  // outro, e uma escolha que sobrevive à troca é a receita para a nota entrar
  // no processo errado.
  useEffect(() => { setProcessoDaNota(""); }, [conversaId]);
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
    setPertoDoFim(true); setBuscaAberta(false); setBuscaConversa(""); setEmojiAberto(false); setRespondendo(null); setFichaAberta(false); setHistorico(null); setTagMenuAberto(false);
    // A rolagem para o fim NÃO acontece quando a conversa foi aberta a partir
    // de um resultado de busca por mensagem: nesse caso quem manda é o efeito
    // logo abaixo, que leva até a mensagem achada. Sem esta condição as duas
    // rolagens brigavam e a tela terminava no fim, que é o que a pessoa estava
    // justamente tentando evitar.
    if (!alvoDe(conversaId)) {
      requestAnimationFrame(() => { fimRef.current?.scrollIntoView(); if (conversaId && !estreito) inputRef.current?.focus(); });
    } else if (conversaId && !estreito) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [conversaId]);

  // ------------------------------------------------------------
  //  LEVA ATÉ A MENSAGEM ACHADA, E MOSTRA QUAL É
  //
  //  Rolar até ela sem marcá-la não resolve: a tela para no meio de uma
  //  conversa e não há nada dizendo qual das bolhas é a que respondeu à busca.
  //  O destaque apaga sozinho depois de alguns segundos — ele serve para o
  //  momento da chegada, e uma marca que fica vira sujeira.
  useEffect(() => {
    if (!salto) return;
    setMsgDestacada(salto.id);
    setPertoDoFim(false);
    const quadro = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-msg-id="${salto.id}"]`);
      if (el) el.scrollIntoView({ block: "center" });
      else fimRef.current?.scrollIntoView();   // não achou: melhor o fim que o nada
      // Só agora o alvo deixa de valer: o salto já aconteceu.
      alvoParaAbrirRef.current = null;
    });
    const apagar = setTimeout(() => setMsgDestacada(null), 4000);
    return () => { cancelAnimationFrame(quadro); clearTimeout(apagar); };
  }, [salto]);

  // Mensagem nova: só rola até o fim se o atendente já estava no fim
  // (não "puxa" a tela quem está lendo mensagens antigas).
  useEffect(() => {
    // A conversa aberta numa mensagem achada não é puxada para o fim. O
    // `pertoDoFim` não serve de trava aqui: ele é estado, e o efeito acima
    // acabou de pedir para desligá-lo — nesta rodada ele ainda vale `true`. O
    // alvo é uma referência, muda na hora, e por isso é ele quem decide.
    //
    // E a rolagem para o fim é SUAVE: uma animação que continua correndo
    // depois. Ela terminava por cima do salto, e a tela parava no fim da
    // conversa — que é exatamente o que se estava tentando evitar.
    if (alvoParaAbrirRef.current) return;
    if (pertoDoFim) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  // Mostra as não lidas no título da aba: "(3) Ropelimi Zorvin".
  useEffect(() => {
    // CONVERSAS, e não mensagens. Somando mensagens, três recados seguidos da
    // mesma pessoa viravam "(3)" na aba enquanto a lista mostrava um item só —
    // e o mesmo número já tinha sido corrigido no selo do telefone e no filtro
    // "Não lidas". Um contador que não bate com o que dá para contar na tela
    // não é informação, é ruído.
    //
    // ARQUIVADA não conta. Uma conversa arquivada com não lidas deixava o
    // título da aba com número para sempre: ele existia e não havia nada na
    // lista para clicar e zerar.
    const total = conversas.filter((c) => !c.arquivada && (c.nao_lidas || 0) > 0).length;
    document.title = total > 0 ? `(${total}) ${NOME_DA_ABA}` : NOME_DA_ABA;
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

  // "Tique" a cada 2s ENQUANTO houver um aviso com hora para vencer — alguém
  // "digitando…" ou alguém junto na conversa aberta. Fora disso ele não roda:
  // um relógio de 2 segundos ligado o dia todo redesenharia a lista inteira
  // trinta vezes por minuto sem nada ter mudado.
  //
  // O `tique` está nas dependências de propósito: a cada batida o efeito é
  // reavaliado, e quando o último aviso vence a condição vira falsa e o
  // relógio se desliga sozinho.
  useEffect(() => {
    // "Há alguém digitando" é ter algum prazo AINDA no futuro. Contar as
    // chaves do mapa não servia: uma entrada vencida conta igual a uma viva.
    const digitando = Object.values(digitandos).some((a) => new Date(a).getTime() > Date.now());
    // E "há alguém junto" é a conversa ABERTA ter outra pessoa dentro. Só ali
    // o aviso aparece, então só ali o relógio precisa correr.
    const acompanhado = !!(conversaId && atendidoPorOutro(conversaId));
    if (!digitando && !acompanhado) return undefined;
    const id = setInterval(() => setTique((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [digitandos, atendimentos, conversaId, meuNome, tique]);

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
  // O TEMPO PODE SER MAIOR QUANDO O RECADO PEDE UMA AÇÃO.
  //
  // Quatro segundos servem para "copiado" e "não consegui, tente de novo". Não
  // servem para um recado que manda rodar um SQL: numa tela de celular isso são
  // três linhas, e quatro segundos não dão para ler três linhas e ainda guardar
  // o nome do arquivo. Quem chama sem o segundo argumento continua com os
  // quatro de sempre.
  function mostrarAviso(msg, milissegundos = 4000) {
    setAviso(msg);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(null), milissegundos);
  }

  // Ao desmontar (logout/fechar), para uma gravação em curso e o cronômetro,
  // para não deixar o microfone ligado nem timers rodando.
  useEffect(() => () => {
    try {
      if (gravadorRef.current) { gravadorRef.current._cancelado = true; gravadorRef.current.stop(); }
    } catch (_) { /* ignora */ }
    if (timerRef.current) clearInterval(timerRef.current);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    document.title = NOME_DA_ABA; // não deixa o contador de não lidas grudado na aba após sair
  }, []);

  // Libera as prévias locais (blob:) do áudio gravado e do anexo pendente quando
  // elas mudam ou ao sair, para não vazar memória.
  useEffect(() => () => { if (audioPronto && String(audioPronto.url).startsWith("blob:")) URL.revokeObjectURL(audioPronto.url); }, [audioPronto]);
  useEffect(() => () => {
    for (const a of anexosPendentes) {
      if (a.url && String(a.url).startsWith("blob:")) URL.revokeObjectURL(a.url);
    }
  }, [anexosPendentes]);

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

  // ---- OS GESTOS DO ZOOM ----
  //
  // Quatro maneiras de ampliar, e são quatro porque quem usa isto vai de uma
  // criança a uma pessoa de oitenta anos, no computador e no celular:
  //
  //   os BOTÕES  — grandes, visíveis, com a porcentagem escrita ao lado. É o
  //                único caminho que se DESCOBRE olhando: os outros três
  //                precisam ser conhecidos de antemão;
  //   a PINÇA    — dois dedos, o gesto do celular. Metade do escritório atende
  //                pelo telefone, e ali não há rodinha nem teclado;
  //   o TOQUE ou CLIQUE DUPLO — aproxima e devolve, como no WhatsApp;
  //   a RODINHA e as teclas + − 0 — para quem já está com a mão no mouse.
  //
  // Todas passam pelas MESMAS contas, em `zoom.js`. Quatro entradas e um
  // caminho só: se fossem quatro caminhos, o botão e a pinça acabariam
  // discordando sobre onde a imagem está.
  const zoomAtivo = zoom.escala > ZOOM_MIN;
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // TROCOU DE IMAGEM, VOLTA AO TAMANHO NORMAL. A ampliação é sobre um pedaço
  // DAQUELA foto; carregá-la para a próxima mostraria a seguinte já cortada num
  // canto qualquer, e quem passa as fotos com a seta acharia que a imagem veio
  // errada do celular de quem mandou.
  useEffect(() => {
    setZoom(ZOOM_PARADO);
    setSuave(false);
    gestos.current = { pinca: null, arrasto: null, mexeu: false, ultimoToque: 0 };
  }, [imagemAberta]);

  /** O tamanho desenhado da imagem e o do buraco por onde se olha.
   *
   *  `offsetWidth` é o tamanho de LAYOUT, que a transformação não altera —
   *  usar `getBoundingClientRect` aqui daria o tamanho já ampliado, e o limite
   *  do arrasto cresceria junto com o zoom, sem parar nunca. */
  function tamanhosDoVisor() {
    const v = visorRef.current, i = imagemRef.current;
    return {
      imagem: { largura: (i && i.offsetWidth) || 0, altura: (i && i.offsetHeight) || 0 },
      visor: { largura: (v && v.clientWidth) || 0, altura: (v && v.clientHeight) || 0 },
    };
  }

  /** Um ponto da tela em pixels a partir do CENTRO do visor — a mesma origem
   *  do `translate`, que é o que evita o erro de sinal. */
  function pontoNoVisor(cx, cy) {
    const v = visorRef.current;
    if (!v) return { x: 0, y: 0 };
    const r = v.getBoundingClientRect();
    return { x: cx - (r.left + r.width / 2), y: cy - (r.top + r.height / 2) };
  }

  function ampliarPara(novaEscala, ponto, comAnimacao = true) {
    const t = tamanhosDoVisor();
    setSuave(comAnimacao);
    setZoom((z) => zoomAncorado(z, novaEscala, ponto || { x: 0, y: 0 }, t.imagem, t.visor));
  }

  /** AMPLIAR POR UM FATOR — a pinça e a rodinha, que empurram de onde estiverem.
   *
   *  A conta é feita DENTRO do `setZoom`, a partir do `z` que o React entrega,
   *  e não a partir do `zoomRef`. A diferença parece de estilo e não é: os
   *  quadros de uma pinça chegam mais depressa do que o React redesenha, e o
   *  `zoomRef` só é atualizado DEPOIS de um redesenho. Sete quadros dentro do
   *  mesmo quadro de tela liam todos a mesma escala velha, e a pinça inteira
   *  valia o último passo — abrir os dedos até quatro vezes o tamanho ampliava
   *  1,14. Num celular rápido, é o que acontece de verdade; foi a prova que
   *  contou, medindo 1,14 onde esperava 4. */
  function ampliarPorFator(fator, ponto) {
    const t = tamanhosDoVisor();
    setSuave(false);
    setZoom((z) => zoomAncorado(z, z.escala * fator, ponto || { x: 0, y: 0 },
                                t.imagem, t.visor));
  }

  /** Aproxima e devolve — o toque duplo e o clique duplo. */
  function alternarZoom(ponto) {
    if (zoomRef.current.escala > ZOOM_MIN) { setSuave(true); setZoom(ZOOM_PARADO); }
    else ampliarPara(ZOOM_DO_TOQUE_DUPLO, ponto);
  }

  function empurrar(dx, dy) {
    const t = tamanhosDoVisor();
    setSuave(false);
    setZoom((z) => (z.escala <= ZOOM_MIN ? z : {
      escala: z.escala,
      ...limitarPosicao({ x: z.x + dx, y: z.y + dy }, t.imagem, t.visor, z.escala),
    }));
  }

  // OS OUVINTES NATIVOS, e não os do React.
  //
  // O React registra `wheel` e `touchmove` como PASSIVOS, e num ouvinte passivo
  // o `preventDefault()` é ignorado — em silêncio, com um aviso no console que
  // ninguém lê. Sem ele, a rodinha rola a página por baixo enquanto amplia, e a
  // pinça faz o NAVEGADOR dar zoom na página inteira em vez de na foto. É o
  // tipo de coisa que funciona no computador do programador (que usa o teclado)
  // e falha no celular de quem atende.
  useEffect(() => {
    const el = visorRef.current;
    if (!imagemAberta || !el) return;

    function aoRodinha(e) {
      e.preventDefault();
      const fator = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      ampliarPorFator(fator, pontoNoVisor(e.clientX, e.clientY));
    }

    function aoComecarToque(e) {
      const g = gestos.current;
      if (e.touches.length === 2) {
        g.pinca = { dist: distancia(e.touches[0], e.touches[1]) };
        g.arrasto = null;
        g.mexeu = true;
      } else if (e.touches.length === 1) {
        g.pinca = null;
        g.arrasto = { px: e.touches[0].clientX, py: e.touches[0].clientY };
        g.mexeu = false;
      }
    }

    function aoMoverToque(e) {
      const g = gestos.current;
      if (e.touches.length === 2 && g.pinca) {
        e.preventDefault();
        const d = distancia(e.touches[0], e.touches[1]);
        const meio = pontoNoVisor((e.touches[0].clientX + e.touches[1].clientX) / 2,
                                  (e.touches[0].clientY + e.touches[1].clientY) / 2);
        // A distância de referência é ATUALIZADA a cada quadro, e não guardada
        // desde o começo: assim a pinça mede o quanto os dedos mudaram AGORA.
        // Comparando sempre com o início, soltar e repinçar daria um salto.
        const fator = g.pinca.dist > 0 ? d / g.pinca.dist : 1;
        g.pinca.dist = d;
        g.mexeu = true;
        ampliarPorFator(fator, meio);
      } else if (e.touches.length === 1 && g.arrasto) {
        const dx = e.touches[0].clientX - g.arrasto.px;
        const dy = e.touches[0].clientY - g.arrasto.py;
        g.arrasto.px = e.touches[0].clientX;
        g.arrasto.py = e.touches[0].clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) g.mexeu = true;
        // SÓ SEGURA O DEDO QUANDO HÁ PARA ONDE ARRASTAR. Com a imagem no
        // tamanho normal não há o que mover, e engolir o gesto tiraria da
        // pessoa o deslizar que ela espera que role a tela.
        if (zoomRef.current.escala > ZOOM_MIN) { e.preventDefault(); empurrar(dx, dy); }
      }
    }

    function aoTerminarToque(e) {
      const g = gestos.current;
      if (e.touches.length === 0) {
        // TOQUE DUPLO: dois toques curtos e parados, com menos de 300ms entre
        // eles. "Parados" (`!g.mexeu`) é o que separa o toque duplo de um
        // arrasto rápido — sem isso, arrastar a foto duas vezes seguidas
        // ampliaria sozinho.
        const agora = Date.now();
        if (!g.mexeu && agora - g.ultimoToque < 300) {
          const t = e.changedTouches && e.changedTouches[0];
          alternarZoom(t ? pontoNoVisor(t.clientX, t.clientY) : { x: 0, y: 0 });
          g.ultimoToque = 0;
        } else if (!g.mexeu) {
          g.ultimoToque = agora;
        }
        g.pinca = null;
        g.arrasto = null;
      }
    }

    el.addEventListener("wheel", aoRodinha, { passive: false });
    el.addEventListener("touchstart", aoComecarToque, { passive: false });
    el.addEventListener("touchmove", aoMoverToque, { passive: false });
    el.addEventListener("touchend", aoTerminarToque, { passive: false });
    return () => {
      el.removeEventListener("wheel", aoRodinha);
      el.removeEventListener("touchstart", aoComecarToque);
      el.removeEventListener("touchmove", aoMoverToque);
      el.removeEventListener("touchend", aoTerminarToque);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagemAberta]);

  // AS TECLAS + − 0, para quem está com as mãos no teclado. São as mesmas do
  // navegador, do leitor de PDF e de tudo o mais que amplia — não há o que
  // aprender.
  useEffect(() => {
    if (!imagemAberta) return;
    function aoTeclar(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault(); ampliarPara(degrauSeguinte(zoomRef.current.escala, 1));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault(); ampliarPara(degrauSeguinte(zoomRef.current.escala, -1));
      } else if (e.key === "0") {
        e.preventDefault(); setSuave(true); setZoom(ZOOM_PARADO);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagemAberta]);

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
      if (imagemAberta) { setImagemAberta(null); setRetratoAberto(false); }
      else if (anexosPendentes.length) fecharAnexoPendente();
      else if (audioPronto) descartarAudioPronto();
      else if (confirmarApagar) setConfirmarApagar(false);
      else if (selecao) setSelecao(null);
      else if (renomeando !== null) setRenomeando(null);
      else if (notaParaApagar) setNotaParaApagar(null);
      else if (editando) cancelarEdicao();
      else if (encaminhar) setEncaminhar(null);
      else if (rostoAberto) { setRostoAberto(null); setReagindoTudo(false); }
      else if (reagindo) { setReagindo(null); setReagindoTudo(false); }
      else if (gravando) cancelarGravacao();
      else if (tagForm) setTagForm(null);
      else if (rapidaForm) setRapidaForm(null);
      else if (contatoForm) setContatoForm(null);
      // As três telas que cobrem tudo. Faltavam aqui, e como o Esc é uma
      // escada, faltar não era "o Esc não faz nada": ele descia até o último
      // degrau e FECHAVA A CONVERSA lá atrás, por baixo do que estava aberto.
      // A pessoa fechava as Mídias e a conversa tinha sumido.
      else if (midiasAberta) setMidiasAberta(false);
      else if (telaAdmin) setTelaAdmin(false);
      else if (telaPainel) setTelaPainel(false);
      else if (configAberta) setConfigAberta(false);
      else if (novaConversaAberta) setNovaConversaAberta(false);
      else if (menuConversa) setMenuConversa(null);
      else if (menuDaConversa) setMenuDaConversa(false);
      else if (menuOrdem) setMenuOrdem(false);
      else if (menuTopoAberto) setMenuTopoAberto(false);
      else if (menuQuem) setMenuQuem(false);
      else if (quemParticipou) setQuemParticipou(false);
      else if (menuEtiquetas) setMenuEtiquetas(false);
      else if (menuDepartamentos) setMenuDepartamentos(false);
      else if (tagMenuAberto) setTagMenuAberto(false);
      else if (emojiAberto) setEmojiAberto(false);
      else if (seletorAberto) setSeletorAberto(false);
      else if (historico) setHistorico(null);
      else if (fichaAberta) setFichaAberta(false);
      else if (buscaAberta) { setBuscaAberta(false); setBuscaConversa(""); }
      else if (respondendo) setRespondendo(null);
      else if (conversaId) setConversaId(null);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [confirmarApagar, notaParaApagar, renomeando, selecao, editando, encaminhar, reagindo, rostoAberto, imagemAberta, anexosPendentes, audioPronto, gravando, configAberta, novaConversaAberta, rapidaForm, tagForm, contatoForm, midiasAberta, telaAdmin, telaPainel, menuConversa, menuDaConversa, menuOrdem, menuTopoAberto, menuEtiquetas, menuQuem, quemParticipou, tagMenuAberto, emojiAberto, seletorAberto, fichaAberta, historico, buscaAberta, respondendo, conversaId]);

  // Clicar fora fecha o seletor de emoji, o de advogado e as mensagens rápidas.
  useEffect(() => {
    function aoClicar(e) {
      if (menuEtiquetas && etiquetasRef.current && !etiquetasRef.current.contains(e.target)) setMenuEtiquetas(false);
      if (menuQuem && quemRef.current && !quemRef.current.contains(e.target)) setMenuQuem(false);
      // NO CELULAR AS DUAS LISTINHAS PENDEM DO ⋮, e não dos botões que as
      // abriam no computador — esses saíram do cabeçalho. Sem contar o ⋮ como
      // "dentro", o próprio clique que abre a listinha já a fechava.
      const dentroDoMenu = acoesRef.current && acoesRef.current.contains(e.target);
      if (menuDaConversa && !dentroDoMenu) setMenuDaConversa(false);
      if (quemParticipou && !dentroDoMenu && quemParticipouRef.current && !quemParticipouRef.current.contains(e.target)) setQuemParticipou(false);
      // O MENU DA BOLHA fecha ao clicar em qualquer lugar fora dele.
      // Não dá para usar um ref como os outros: existe um menu por mensagem, e
      // guardar um ref por bolha seria um mapa que envelhece a cada rolagem. A
      // marca no elemento resolve — se o clique não veio de dentro de algo
      // marcado, o menu fecha.
      if ((reagindo || rostoAberto) && !(e.target.closest && e.target.closest("[data-menu-msg]"))) {
        setReagindo(null); setRostoAberto(null); setReagindoTudo(false);
      }
      if (emojiAberto && emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiAberto(false);
      if (seletorAberto && seletorRef.current && !seletorRef.current.contains(e.target)) setSeletorAberto(false);
      if (tagMenuAberto && !dentroDoMenu && tagMenuRef.current && !tagMenuRef.current.contains(e.target)) setTagMenuAberto(false);
      if (menuOrdem && ordemMenuRef.current && !ordemMenuRef.current.contains(e.target)) setMenuOrdem(false);
      if (menuTopoAberto && menuTopoRef.current && !menuTopoRef.current.contains(e.target)) setMenuTopoAberto(false);
      if (menuDepartamentos && departamentosRef.current && !departamentosRef.current.contains(e.target)) setMenuDepartamentos(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [reagindo, rostoAberto, emojiAberto, seletorAberto, tagMenuAberto, menuTopoAberto, menuEtiquetas, menuQuem, quemParticipou, menuDaConversa, menuOrdem, menuDepartamentos]);

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

  // ---- Formatar o texto selecionado (negrito, itálico, listas, citação) ----
  //
  // A regra de cada formato mora em `formatacao.js`, que não conhece a tela e
  // por isso pode ser provado sem navegador. Aqui só se aplica o que ele
  // calculou.
  //
  // `insertText` E NÃO `setRascunho`. É o comando que o navegador registra na
  // pilha do desfazer: com ele, o Ctrl+Z depois de um Ctrl+B desfaz o negrito e
  // devolve o texto como estava. Escrevendo direto no estado do React, o
  // navegador não fica sabendo de nada, e o Ctrl+Z seguinte apaga um pedaço
  // qualquer do que a pessoa tinha digitado antes — perder o desfazer numa
  // caixa de texto é um preço alto por uma barra de enfeite. O caminho pelo
  // estado fica como rede para o navegador que não tiver o comando.
  function formatarSelecao(id) {
    const campo = inputRef.current;
    if (!campo) return;
    const calculo = calcularFormato(campo.value, campo.selectionStart, campo.selectionEnd, id);
    if (!calculo) return;

    campo.focus();
    campo.setSelectionRange(calculo.de, calculo.ate);
    const feito = typeof document.execCommand === "function"
      && document.execCommand("insertText", false, calculo.novo);
    if (!feito) {
      const t = campo.value;
      setRascunho(t.slice(0, calculo.de) + calculo.novo + t.slice(calculo.ate));
    }
    // Depois da troca, a seleção volta para o TEXTO — sem as marcas. Assim dá
    // para encadear (negrito e depois itálico) sem selecionar de novo, e o
    // Ctrl+B duas vezes desfaz, que é o que a pessoa espera.
    requestAnimationFrame(() => {
      campo.setSelectionRange(calculo.selecao[0], calculo.selecao[1]);
      campo.focus();
      setFormatoAberto(calculo.selecao[0] !== calculo.selecao[1]);
    });
  }

  // O ícone de cada formato. Fica aqui, e não em `formatacao.js`, porque aquele
  // arquivo não importa React de propósito — é o que o deixa provável em Node.
  const ICONE_DO_FORMATO = {
    negrito: Bold, italico: Italic, tachado: Strikethrough, codigo: Code,
    numerada: ListOrdered, marcadores: List, citar: Quote,
  };

  // A ORDEM DE ENVIO É A ORDEM EM QUE A PESSOA APERTOU ENTER.
  //
  // Relato do escritório: "enviei 3 mensagens, que chegaram a ser enviadas mas
  // fora de ordem". Era isto.
  //
  // Cada Enter chamava `enviar()`, e `enviar()` grava a linha na fila com uma
  // ida ao banco. Três Enters seguidos eram TRÊS IDAS AO MESMO TEMPO, cada uma
  // correndo pela internet por conta própria. Quem chegasse primeiro ganhava o
  // `criado_em` mais antigo — e é por `criado_em` que a ponte despacha. Ou seja:
  // a ordem das mensagens no celular do cliente era a ordem em que os pedidos
  // ganharam a corrida da rede, e não a ordem em que a pessoa escreveu.
  //
  // Num 4G do fórum, com uma ida demorando 300 ms e a seguinte 80 ms, isso
  // acontece o tempo todo. E lido do outro lado, "pode vir amanhã às 14h" antes
  // de "consegui remarcar sua audiência" é uma conversa diferente.
  //
  // Agora as gravações saem uma de cada vez, em fila. A BOLHA CONTINUA
  // APARECENDO NA HORA — quem espera é só a linha do banco, e a espera é a de
  // uma ida à rede. Serializar aqui, e não em `enviar()`, é de propósito: todo
  // caminho de envio passa por esta função (texto, áudio, arquivo, resposta
  // pronta, encaminhar), e uma fila que só valesse para o texto deixaria a
  // ordem torta na primeira mistura.
  const filaDoNavegador = useRef(Promise.resolve());
  function emFila(tarefa) {
    // O `catch` é o que mantém a fila viva: sem ele, um envio que falha deixa a
    // corrente rejeitada e TODOS os seguintes são descartados sem sair.
    const proxima = filaDoNavegador.current.then(tarefa, tarefa);
    filaDoNavegador.current = proxima.then(() => {}, () => {});
    return proxima;
  }

  // Insere na fila de envio. Se a coluna "enviado_por" ainda não existir no
  // banco (SQL não rodou), tenta de novo sem ela — o envio nunca trava por isso.
  function inserirNaFila(payload) {
    return emFila(() => gravarNaFila(payload));
  }

  async function gravarNaFila(payload) {
    let { error } = await supabase.from("fila_envio").insert(payload);
    // Base sem o SQL de agosto/2026: tira só o id e tenta de novo — o nome
    // ainda pode existir, e desistir dos dois de uma vez perderia informação
    // que a base aguenta guardar.
    if (error && /enviado_por_id/i.test(error.message || "")) {
      const semId = { ...payload };
      delete semId.enviado_por_id;
      ({ error } = await supabase.from("fila_envio").insert(semId));
    }
    if (error && /enviado_por/i.test(error.message || "")) {
      const semAutor = { ...payload };
      delete semAutor.enviado_por;
      delete semAutor.enviado_por_foto;
      delete semAutor.enviado_por_id;
      ({ error } = await supabase.from("fila_envio").insert(semAutor));
    }
    // Entrou na fila: cutuca a ponte para ela acordar e enviar já.
    if (!error) acordarPonte();
    return { error };
  }


  // Reage a uma mensagem (ou tira a reação, se tocar no mesmo emoji de novo).
  //
  // A pastilha aparece na hora, antes de a ponte confirmar: uma reação que só
  // aparece três segundos depois faz a pessoa tocar duas vezes, e o segundo
  // toque desfaz o primeiro. Se o envio falhar, a fila mostra o erro e a
  // próxima leitura da conversa devolve a verdade do banco.
  // ENCAMINHAR: manda o conteúdo desta mensagem para outra conversa.
  //
  // Não é "copiar a linha do banco": é um ENVIO NOVO, que entra na fila e sai
  // pelo WhatsApp como qualquer outra mensagem. Copiar a linha faria a mensagem
  // aparecer na tela da equipe sem nunca ter chegado ao destinatário.
  //
  // A mídia vai pela URL que já está no Storage — não há novo upload, e por isso
  // encaminhar uma foto é tão rápido quanto encaminhar um texto.
  async function enviarEncaminhada(conv) {
    const m = encaminhar;
    if (!m || !conv) return;
    setEncaminhar(null);
    const { error } = await inserirNaFila({
      conversa_id: conv.id,
      tipo: m.tipo || "texto",
      texto: m.texto || null,
      midia_url: m.midia_url || null,
      midia_mime: m.midia_mime || null,
      status: "pendente",
      enviado_por: meuNome, enviado_por_id: meuId,
    });
    if (error) { mostrarAviso("Não consegui encaminhar. Tente de novo."); return; }
    mostrarAviso(`Encaminhada para ${nomeDoContato(conv.contato) || "a conversa"}.`);
  }

  // FIGURINHAS — A GALERIA É UMA ESCOLHA, e não o histórico.
  //
  // Antes ela juntava sozinha TODA figurinha que passava pelo Zorvin, enviada
  // ou recebida. Parecia prático e não era: basta um cliente mandar uma piada,
  // um deboche ou coisa pior para aquilo ficar guardado à mão, na mesma lista
  // que a equipe abre para responder outro cliente. Mandar a figurinha errada
  // por engano, num escritório de advocacia, é problema de verdade.
  //
  // Agora nada entra sozinho: guarda quem quer, pelo menu da mensagem.
  //
  // A lista é DO ESCRITÓRIO, não de cada pessoa — quem atende hoje é quem está
  // na escala, e a figurinha que a Joana guardou precisa estar à mão da
  // Beatriz.
  const carregarFigurinhas = useCallback(async () => {
    const { data } = await supabase.from("figurinhas_favoritas")
      .select("midia_url").order("criado_em", { ascending: false }).limit(60);
    setFigurinhas((data || []).map((r) => r.midia_url).filter(Boolean));
  }, []);

  // Carregada já na abertura, e não só quando a galeria abre: é ela que diz ao
  // menu da mensagem se a figurinha já está guardada — ou seja, se o item deve
  // dizer "Adicionar" ou "Remover".
  useEffect(() => { carregarFigurinhas(); }, [carregarFigurinhas]);

  function figurinhaEhFavorita(url) {
    return Boolean(url) && figurinhas.includes(url);
  }

  // Guardar ou tirar da galeria. O acerto na tela vem primeiro e é desfeito se
  // o banco recusar: sem isso o clique parece não ter efeito por um segundo, e
  // a pessoa clica de novo.
  async function alternarFigurinhaFavorita(m) {
    const url = m?.midia_url;
    if (!url) return;
    const jaTinha = figurinhaEhFavorita(url);
    setFigurinhas((prev) => (jaTinha ? prev.filter((u) => u !== url) : [url, ...prev]));
    if (jaTinha) {
      // `.select()` para saber se ALGUMA linha saiu. Sem política de exclusão
      // o Supabase não dá erro: ele apaga zero linhas em silêncio, e a
      // figurinha voltaria ao recarregar.
      const { data, error } = await supabase.from("figurinhas_favoritas")
        .delete().eq("midia_url", url).select("id");
      if (error || !data || data.length === 0) {
        setFigurinhas((prev) => (prev.includes(url) ? prev : [url, ...prev]));
        mostrarAviso("Não consegui remover a figurinha. " + (error?.message || "Rode sql/2026-08-figurinhas-favoritas.sql."));
        return;
      }
      mostrarAviso("Figurinha removida das favoritas");
    } else {
      // `upsert` e não `insert`: duas pessoas guardando a mesma figurinha não
      // podem virar erro na tela — a URL é única na tabela.
      const { error } = await supabase.from("figurinhas_favoritas")
        .upsert({ midia_url: url, midia_mime: m.midia_mime || null, adicionada_por: meuNome },
                { onConflict: "midia_url", ignoreDuplicates: true });
      if (error) {
        setFigurinhas((prev) => prev.filter((u) => u !== url));
        mostrarAviso("Não consegui guardar a figurinha. " + error.message);
        return;
      }
      mostrarAviso("Figurinha adicionada às favoritas");
    }
    carregarFigurinhas();
  }

  // Reenviar uma figurinha da galeria: ela já está no Storage, então é só
  // enfileirar a URL — sem novo upload, sem esperar.
  async function enviarFigurinhaUrl(url) {
    setEmojiAberto(false);
    if (!conversaId) return;
    setPertoDoFim(true);
    const tempId = "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6);
    setMensagens((prev) => [...prev, {
      id: tempId, conversa_id: conversaId, origem: "advogado", tipo: "figurinha",
      enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto, midia_url: url,
      criado_em: new Date().toISOString(), _status: "enviando",
    }]);
    // `texto: ""` e não ausente: a coluna da fila não aceita nulo, e o insert
    // falhava em silêncio — a figurinha da galeria nunca saía. Mesma pegadinha
    // que derrubou o Apagar.
    const { error } = await inserirNaFila({
      conversa_id: conversaId, tipo: "figurinha", texto: "", midia_url: url,
      status: "pendente", enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto,
    });
    if (error) setMensagens((prev) => prev.map((x) => (x.id === tempId ? { ...x, _status: "erro" } : x)));
    else marcarLida(conversaId);
  }

  // APAGAR — DUAS COISAS DIFERENTES, escolhidas DEPOIS de marcar as mensagens.
  //
  //   "para todos"     tira também do celular do contato. Não tem volta.
  //   "só no Zorvin"   tira da conversa AQUI; o contato continua com ela.
  //
  // O WhatsApp chama a segunda de "apagar para mim". Aqui não existe "mim": a
  // conversa é a mesma para o escritório inteiro, e apagar tira da vista de
  // todo mundo. Chamar de "para mim" faria alguém achar que só a própria tela
  // muda — o engano que custa caro numa equipe.
  //
  // A bolha não some em nenhum dos dois: vira "Esta mensagem foi apagada".
  // Sumir de vez deixaria um buraco silencioso, com a resposta sem a pergunta.
  function podeSerApagada(m) {
    return m.origem === "advogado" && !m.apagada;
  }

  function alternarSelecao(id) {
    setSelecao((s) => {
      if (!s) return [id];
      return s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
    });
  }

  async function apagarSelecionadas(paraTodos) {
    const ids = selecao || [];
    const alvos = mensagens.filter((m) => ids.includes(m.id) && podeSerApagada(m));
    setConfirmarApagar(false);
    setSelecao(null);
    if (!alvos.length) return;

    const antes = alvos.slice();
    setMensagens((prev) => prev.map((x) => (ids.includes(x.id)
      ? { ...x, apagada: true, texto: null, midia_url: null } : x)));

    const voltarAtras = () => setMensagens((prev) => prev.map((x) => {
      const orig = antes.find((a) => a.id === x.id);
      return orig ? orig : x;
    }));

    if (!paraTodos) {
      // SÓ NO ZORVIN: nada vai para a fila — é uma marca no nosso banco, e a
      // Uazapi não entra na história.
      const { data, error } = await supabase.from("mensagens")
        .update({ apagada: true, texto: null, midia_url: null })
        .in("id", alvos.map((m) => m.id)).select("id");
      const naoMexeu = !error && Array.isArray(data) && data.length === 0;
      if (error || naoMexeu) {
        voltarAtras();
        mostrarAviso(naoMexeu
          ? "Falta rodar o SQL 2026-08-fixar-favoritar-mensagem.sql no Supabase."
          : `Não consegui apagar: ${error?.message || "erro desconhecido"}`);
      }
      return;
    }

    // `texto: ""` e não ausente: a coluna da fila não aceita nulo, e sem ele o
    // insert falha — era esse o "Não consegui apagar. Tente de novo".
    const semId = alvos.filter((m) => !m.id_uazapi);
    const podem = alvos.filter((m) => m.id_uazapi);
    for (const m of podem) {
      const { error } = await inserirNaFila({
        conversa_id: conversaId, tipo: "exclusao", texto: "",
        responder_id_uazapi: m.id_uazapi, status: "pendente", enviado_por: meuNome, enviado_por_id: meuId,
      });
      if (error) {
        voltarAtras();
        mostrarAviso(`Não consegui apagar: ${error.message || "erro desconhecido"}`);
        return;
      }
    }
    if (semId.length) {
      mostrarAviso(`${semId.length} mensagem(ns) ainda não confirmada(s) pelo WhatsApp ficaram de fora.`);
    }
  }

  // FIXAR e FAVORITAR uma MENSAGEM (a estrela e o alfinete que já existiam são
  // da conversa inteira — servem para achar a pessoa, não o trecho).
  //
  // `.select("id")` não é enfeite: sem política de atualização, o Supabase não
  // dá erro, ele só não altera nada. O botão pareceria funcionar e a marca
  // sumiria ao recarregar. Zero linhas alteradas é a única pista, e é por ela
  // que se avisa quem está usando.
  async function marcarMensagem(m, campo, valor) {
    setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, [campo]: valor } : x)));
    const { data, error } = await supabase.from("mensagens")
      .update({ [campo]: valor }).eq("id", m.id).select("id");
    const naoMexeu = !error && Array.isArray(data) && data.length === 0;
    if (error || naoMexeu) {
      setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, [campo]: m[campo] } : x)));
      mostrarAviso(naoMexeu
        ? "Falta rodar o SQL 2026-08-fixar-favoritar-mensagem.sql no Supabase."
        : "Não consegui salvar a marca.");
    }
  }

  // O PRAZO PARA EDITAR.
  //
  // O WhatsApp só aceita editar uma mensagem por cerca de 15 minutos. Passado
  // isso, a Uazapi ainda responde OK e o aviso de edição chega ao celular do
  // contato — mas o aparelho dele se RECUSA a aplicar. O resultado é o pior
  // dos mundos: o contato recebe uma notificação com o texto novo, não acha
  // mensagem nenhuma ao abrir a conversa, e a antiga continua errada. E o
  // Zorvin mostrava "Editada" o tempo todo, então a equipe acreditava que a
  // correção tinha chegado.
  //
  // Catorze minutos, e não quinze: uma mensagem que ainda pode ser editada por
  // trinta segundos vira erro no meio do caminho, entre clicar e a ponte
  // despachar a fila.
  const PRAZO_EDICAO_MS = 14 * 60 * 1000;
  function dentroDoPrazoDeEdicao(m) {
    if (!m?.criado_em) return false;
    const quando = new Date(m.criado_em).getTime();
    return Number.isFinite(quando) && Date.now() - quando < PRAZO_EDICAO_MS;
  }

  // EDITAR uma mensagem que NÓS enviamos.
  //
  // Reaproveita a caixa de digitar em vez de abrir uma janela: o texto antigo
  // aparece lá, com uma faixa dizendo o que está acontecendo, e Enter salva —
  // é o mesmo gesto de sempre. Uma janela separada obrigaria a equipe a
  // aprender um segundo jeito de escrever.
  //
  // O texto novo aparece na bolha NA HORA. A ponte confirma depois; se a
  // Uazapi recusar (o WhatsApp só permite editar por um tempo), a próxima
  // leitura da conversa devolve a verdade do banco.
  function iniciarEdicao(m) {
    setRespondendo(null);
    setModoNota(false);
    setEditando(m);
    setRascunho(m.texto || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelarEdicao() {
    // O MODO NOTA SAI JUNTO. Editar uma nota o acende; se ele ficasse aceso
    // depois do cancelamento, a caixa continuaria âmbar e a próxima coisa
    // digitada viraria uma NOTA INTERNA em vez de uma mensagem para o cliente
    // — o erro mais caro que esta tela pode cometer, porque é silencioso dos
    // dois lados: o cliente não recebe e ninguém percebe que não recebeu.
    setEditando(null);
    setRascunho("");
    setModoNota(false);
    setProcessoDaNota("");
  }

  async function salvarEdicao() {
    const m = editando;
    const novo = rascunho.trim();
    if (!m) return;
    // NOTA INTERNA segue por outro caminho: ela não passa pelo WhatsApp, então
    // não tem prazo de edição nem fila de envio. É o mesmo botão e a mesma
    // caixa — o desvio é só aqui, para não haver duas telas de edição.
    if (m.origem === "nota") {
      if (!novo) { mostrarAviso("A nota não pode ficar vazia."); return; }
      return salvarEdicaoDeNota(m, novo);
    }
    if (!novo) { mostrarAviso("A mensagem não pode ficar vazia."); return; }
    // Segunda trava: entre abrir o menu e apertar Enter o prazo pode ter
    // vencido. Sem ela, a mensagem sairia como notificação fantasma no celular
    // do contato — que foi exatamente o defeito relatado.
    if (!dentroDoPrazoDeEdicao(m)) {
      setEditando(null); setRascunho("");
      mostrarAviso("Passou o prazo do WhatsApp para editar (cerca de 15 minutos). Envie uma correção.");
      return;
    }
    if (novo === (m.texto || "")) { cancelarEdicao(); return; }
    setEditando(null);
    setRascunho("");
    setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, texto: novo, editada: true } : x)));
    const { error } = await inserirNaFila({
      conversa_id: conversaId,
      tipo: "edicao",
      texto: novo,
      responder_id_uazapi: m.id_uazapi,
      status: "pendente",
      enviado_por: meuNome, enviado_por_id: meuId,
    });
    if (error) {
      setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, texto: m.texto, editada: m.editada } : x)));
      mostrarAviso("Não consegui editar. Tente de novo.");
    }
  }

  // Copiar o texto da mensagem.
  //
  // `navigator.clipboard` só existe em página segura (https ou localhost) e
  // pode ser recusado pelo navegador. O caminho antigo — um <textarea> fora da
  // tela mais execCommand — é feio, mas funciona onde o novo não funciona, e
  // "copiar" que não copia e não avisa é a pior das saídas.
  async function copiarMensagem(m) {
    const texto = m.texto || "";
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      mostrarAviso("Mensagem copiada.");
      return;
    } catch (_) { /* segue para o caminho antigo */ }
    try {
      const campo = document.createElement("textarea");
      campo.value = texto;
      campo.style.position = "fixed";
      campo.style.left = "-9999px";
      document.body.appendChild(campo);
      campo.select();
      const deu = document.execCommand("copy");
      document.body.removeChild(campo);
      mostrarAviso(deu ? "Mensagem copiada." : "Não consegui copiar.");
    } catch (_) {
      mostrarAviso("Não consegui copiar.");
    }
  }

  async function reagir(m, emoji) {
    setReagindo(null);
    setReagindoTudo(false);
    if (emoji) guardarRecente(emoji);
    if (!m.id_uazapi) { mostrarAviso("Esta mensagem ainda não foi confirmada pelo WhatsApp."); return; }
    const atuais = Array.isArray(m.reacoes) ? m.reacoes : [];
    const minha = atuais.find((r) => r && r.de === "advogado");
    const novo = minha && minha.emoji === emoji ? "" : emoji;   // tocar de novo = tirar
    const lista = atuais.filter((r) => r && r.de !== "advogado");
    if (novo) lista.push({ emoji: novo, de: "advogado" });

    setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, reacoes: lista } : x)));

    const { error } = await inserirNaFila({
      conversa_id: conversaId,
      tipo: "reacao",
      texto: novo,
      responder_id_uazapi: m.id_uazapi,
      status: "pendente",
      enviado_por: meuNome, enviado_por_id: meuId,
    });
    if (error) {
      // Devolve a bolha ao que era: manter a pastilha que não foi enviada
      // faria a equipe achar que o contato viu uma reação que nunca saiu.
      setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, reacoes: atuais } : x)));
      mostrarAviso("Não consegui enviar a reação. Tente de novo.");
    }
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
  function trocarAdvogado(id) { setSelecao(null); setAdvogadoId(id); setConversaId(null); setSeletorAberto(false); setBusca(""); setVerArquivadas(false); setFiltro("tudo"); }
  // Troca de DEPARTAMENTO e vai para o primeiro telefone dele.
  function trocarDepartamento(id) {
    if (id === departamentoId) return;
    setDepartamentoId(id);
    setConversaId(null);
    setBusca(""); setVerArquivadas(false); setFiltro("tudo");
    // DO DEPARTAMENTO NOVO, e não de `advogadosVisiveis`.
    //
    // `advogadosVisiveis` está filtrado pelo departamento ANTIGO — o `setState`
    // acima ainda não valeu nesta renderização. Então o `find` procurava um
    // telefone do departamento novo dentro da lista do velho e nunca achava
    // nada; caía no `[0]`, que é o primeiro telefone do departamento ANTERIOR.
    // A tela ficava permanentemente um departamento atrás: clicar em "Acordos"
    // deixava você em "Sucesso do Cliente", e clicar em "Audiências" levava a
    // "Acordos". Era o defeito do vídeo.
    //
    // A lista PERMITIDA, e não a crua: `advogados` vem do banco sem filtro (é
    // leitura livre, ver `filtrarPermitidos`), e usá-la aqui jogaria a pessoa
    // num telefone que ela não pode abrir.
    const doDepartamento = advogadosPermitidos.filter((a) => a.departamento_id === id);
    // COM MAIS DE UM TELEFONE, QUEM ESCOLHE É A PESSOA.
    //
    // Escolher por ela significava começar a atender por um número sem ter
    // decidido isso — e o número escolhido é o que o cliente vê chegar no
    // WhatsApp dele. Com um telefone só não há o que perguntar.
    setAdvogadoId(doDepartamento.length === 1 ? doDepartamento[0].id : null);
  }

  // Marca a conversa como não lida (mostra o selo verde) ou como lida.
  async function marcarNaoLida(conv, naoLida) {
    setMenuConversa(null);
    const novo = naoLida ? (conv.nao_lidas > 0 ? conv.nao_lidas : 1) : 0;
    setConversas((prev) => prev.map((x) => (x.id === conv.id ? { ...x, nao_lidas: novo } : x)));
    // FICA NA CONVERSA. Esta função saía dela ao marcar como não lida, e o
    // efeito era o de ter apertado ESC: a pessoa clicava no botão do cabeçalho
    // e era jogada para fora, sem ter pedido isso.
    //
    // A linha existia para o selo "valer visualmente" — mas isso era só a
    // aparência: a linha selecionada na lista já está destacada, e o número
    // ficava por baixo do destaque. Trocar a tela inteira por causa disso é
    // caro demais, e "Marcar como lida" nunca fez nada parecido.
    //
    // E NÃO HÁ RISCO DE ELA SER REMARCADA POR FICAR ALI: as três marcações
    // automáticas acontecem ao ENVIAR alguma coisa (mensagem, anexo,
    // figurinha), nunca por estar dentro da conversa. Conferido antes de tirar.
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
  // "TODAS" QUER DIZER TODAS, e não as que estão carregadas.
  //
  // Ela montava a lista de ids a partir de `conversas` — que agora é só a
  // primeira página. O botão dizia "todas marcadas como lidas" e deixava as
  // outras 1000 intocadas.
  //
  // O recorte vai para o banco: um `update` com `advogado_id` e `nao_lidas > 0`
  // alcança o telefone inteiro, sem lista de ids e sem lotes.
  async function marcarTodasLidas() {
    setMenuTopoAberto(false);
    const advId = advogadoId;
    if (!advId) return;
    if (!(naoLidasPorAdv[advId] || 0)) { mostrarAviso("Nenhuma conversa não lida."); return; }
    setConversas((prev) => prev.map((c) => ({ ...c, nao_lidas: 0 })));
    setNaoLidasPorAdv((m) => ({ ...m, [advId]: 0 }));
    const { error } = await supabase.from("conversas")
      .update({ nao_lidas: 0 }).eq("advogado_id", advId).gt("nao_lidas", 0);
    carregarNaoLidasPorAdv();
    if (error) { mostrarAviso("Não consegui marcar todas. Tente de novo."); carregarConversas(advId); return; }
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
    // Desconta do selo NA HORA: sem isto, o número da barra lateral só cai
    // depois da ida-e-volta ao banco, e o clique parece não ter surtido efeito.
    setConversas((prev) => {
      const alvo = prev.find((c) => c.id === convId);
      if (alvo && (alvo.nao_lidas || 0) > 0) {
        setNaoLidasPorAdv((m) => ({ ...m,
          [alvo.advogado_id]: Math.max(0, (m[alvo.advogado_id] || 0) - 1) }));
      }
      return prev.map((c) => (c.id === convId ? { ...c, nao_lidas: 0 } : c));
    });
    const { error } = await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId);
    // Não deu para gravar: devolve o que o banco tem, senão a tela diz "lida"
    // e o resto da equipe continua vendo o selo.
    if (error) { mostrarAviso("Não consegui marcar como lida."); carregarConversas(advogadoIdRef.current); }
    else carregarNaoLidasPorAdv();
  }, [carregarConversas, carregarNaoLidasPorAdv]);

  async function enviar() {
    // CORRIGIR VEM ANTES DE CRIAR, e a ordem aqui é o conserto.
    //
    // Editar uma nota passou a acender `modoNota` (é o que faz a caixa ficar
    // âmbar e a barra do processo aparecer). Com `modoNota` sendo perguntado
    // primeiro, apertar Enter numa nota em edição chamaria `enviarNota()` e
    // criaria uma nota NOVA — a velha ficaria intacta, e a tela mostraria as
    // duas. Quem corrigiu um erro de digitação acabaria com o erro e a
    // correção lado a lado.
    if (editando) { salvarEdicao(); return; }
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
      id: tempId, conversa_id: conversaId, origem: "advogado", enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto,
      tipo: "texto", texto: t, criado_em: new Date().toISOString(), _status: "enviando",
      resposta_previa: alvo?.previa || null, resposta_autor: alvo?.autor || null,
      _responderId: alvo?.id_uazapi || null,
    };
    setMensagens((prev) => [...prev, provisoria]);
    // Coloca na fila de envio; a ponte processa e manda pela Uazapi.
    // `status` ESCRITO, e não deixado por conta do padrão da coluna. Ele
    // faltava em quatro dos sete lugares que gravam na fila, e a ponte despacha
    // `status = 'pendente'` e mais nada: a linha só saía porque a coluna tem um
    // padrão no banco. Funciona hoje; some numa migração, e o que some é o
    // envio de mensagem. Uma palavra tira a dependência.
    const payload = { conversa_id: conversaId, texto: t, status: "pendente",
                      enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto };
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

  /** Dá ao contato um nome aqui dentro, sem criar cadastro no Vantoro.
   *
   *  É o caso de vendas: o lead se identifica na conversa, e o WhatsApp mostra
   *  o apelido que ele escolheu no aparelho. Criar um cadastro só para
   *  consertar o nome enche a base do escritório de gente que nunca virou
   *  cliente.
   *
   *  `nome` — o que o WhatsApp mandou — NÃO é tocado: é o registro do que
   *  chegou, e é o que aparece para quem ninguém tocou ainda.
   */
  async function salvarNomeDoContato(texto) {
    const novo = (texto || "").trim();
    const ct = conversa?.contato;
    if (!ct) return;
    const antes = ct.nome_zorvin || "";
    if (novo === antes) { setRenomeando(null); return; }
    setRenomeando(null);
    // Some da tela na hora; volta se o banco recusar.
    setConversas((prev) => prev.map((c) => (
      c.contato && c.contato.numero === ct.numero
        ? { ...c, contato: { ...c.contato, nome_zorvin: novo || null } } : c)));
    const { error } = await supabase.from("contatos")
      .update({ nome_zorvin: novo || null }).eq("id", ct.id);
    if (error) {
      setConversas((prev) => prev.map((c) => (
        c.contato && c.contato.numero === ct.numero
          ? { ...c, contato: { ...c.contato, nome_zorvin: ct.nome_zorvin } } : c)));
      mostrarAviso(/nome_zorvin/i.test(error.message || "")
        ? "Falta rodar o SQL do nome do contato."
        : "Não consegui salvar o nome. Tente de novo.");
      return;
    }
    registrarAlteracao({ tipo: "contato_renomeado", alvo: ct.numero,
                         antes: antes || (ct.nome || ""), depois: novo });
  }

  /** Guarda uma linha no histórico de alterações. Nunca derruba a ação que a
      gerou: histórico perdido é ruim, atendente travado é pior. */
  async function registrarAlteracao(linha) {
    try {
      const { error } = await supabase.from("alteracoes").insert({
        contato_id: conversa?.contato_id || conversa?.contato?.id || null,
        conversa_id: conversaId,
        autor: meuNome, autor_id: meuId,
        ...linha,
      });
      // Base sem o SQL de agosto/2026: o recurso fica dormente, sem encher o
      // log do Postgres de erro a cada nota escrita.
      if (error && /alteracoes/i.test(error.message || "")) return;
    } catch (_) { /* histórico é um extra */ }
  }

  // QUEM PODE MEXER NUMA NOTA: quem a escreveu, e quem administra.
  //
  // Editar a nota de outra pessoa é reescrever o que ela disse ter combinado
  // com o cliente — e a nota é justamente onde isso fica registrado. Apagar
  // segue a mesma regra, e mesmo assim deixa lápide: some o texto, fica quem
  // apagou.
  function podeMexerNaNota(m) {
    if (!m || m.origem !== "nota" || m.apagada_em) return false;
    if (souAdmin) return true;
    if (m.autor_id && meuId) return String(m.autor_id) === String(meuId);
    return (m.autor || "") === meuNome;
  }

  async function salvarEdicaoDeNota(m, novoTexto) {
    const antes = m.texto || "";
    // O PROCESSO TAMBÉM SE CORRIGE. Vincular ao processo errado é tão fácil
    // quanto escrever a palavra errada, e até aqui a única saída era apagar a
    // nota e escrever outra — perdendo quem a escreveu e quando, que é
    // justamente para o que a nota serve.
    const escolhido = processoDaNota
      ? processosDoCliente.find((p) => String(p.id) === String(processoDaNota))
      : null;
    const antesProcesso = m.processo_id ? String(m.processo_id) : "";
    const comoEra = { processo_id: m.processo_id ?? null,
                      processo_numero: m.processo_numero ?? null,
                      processo_reu: m.processo_reu ?? null };

    // A CORRIDA QUE APAGARIA O VÍNCULO.
    //
    // A lista de processos do cliente é buscada no Vantoro DEPOIS de o modo
    // nota acender — vai pela rede, e leva o tempo que levar. Entre o clique em
    // "editar" e a resposta dela, `processosDoCliente` está VAZIA: procurar o
    // processo da nota ali não acha nada, e `escolhido` sai nulo.
    //
    // Sem esta guarda, corrigir uma vírgula e apertar Enter depressa GRAVARIA
    // `processo_id: null` — o vínculo sumiria por causa da velocidade de quem
    // digita. Silenciosamente, e no mesmo campo que já perdeu 289 notas.
    //
    // A regra: só desvincula quem ESCOLHEU desvincular (o seletor em branco).
    // Um id que a lista ainda não conhece mantém o que estava.
    const aindaNaoSei = Boolean(processoDaNota) && !escolhido;
    const doProcesso = escolhido
      ? { processo_id: escolhido.id, processo_numero: escolhido.numero || "",
          processo_reu: escolhido.reu || "" }
      : (aindaNaoSei
          ? comoEra
          // NULO, E NÃO AUSENTE: um objeto sem a chave deixaria a coluna como
          // está, e "desvincular" não desvincularia nada.
          : { processo_id: null, processo_numero: null, processo_reu: null });
    const agoraProcesso = doProcesso.processo_id ? String(doProcesso.processo_id) : "";
    const mudouProcesso = antesProcesso !== agoraProcesso;
    if (novoTexto === antes && !mudouProcesso) { cancelarEdicao(); return; }
    cancelarEdicao();
    setMensagens((prev) => prev.map((x) => (
      x.id === m.id ? { ...x, ...doProcesso, texto: novoTexto,
                        editada_em: new Date().toISOString(),
                        editada_por: meuNome } : x)));
    // O id na tabela não tem o prefixo "nota-" que a tela põe para as duas
    // linhas do tempo não colidirem.
    const idReal = String(m.id).replace(/^nota-/, "");
    // AS COLUNAS DO PROCESSO PODEM NÃO EXISTIR — é o mesmo banco incompleto que
    // fez 289 notas nascerem sem processo. `gravarSemAsQueFaltam` tenta com
    // tudo e, se o banco recusar uma coluna, repete sem ELA — em vez de perder
    // a correção do texto junto.
    const { error, perdidas } = await gravarSemAsQueFaltam(
      (linha) => supabase.from("notas").update(linha).eq("id", idReal),
      { texto: novoTexto, editada_em: new Date().toISOString(), editada_por: meuNome,
        ...doProcesso },
      ["processo_id", "processo_numero", "processo_reu", "editada_em", "editada_por"],
      COLUNAS_QUE_FALTAM_EM_NOTAS);
    if (error) {
      setMensagens((prev) => prev.map((x) => (
        x.id === m.id ? { ...x, ...comoEra, texto: antes } : x)));
      mostrarAviso("Não consegui editar a nota. Tente de novo.");
      return;
    }
    // O AVISO SÓ APARECE QUANDO A PESSOA PERDEU O QUE ESCOLHEU. Perder o
    // `editada_em` numa base velha não muda nada do que ela quis dizer; perder
    // o processo, sim — e calar sobre isso é o defeito que já custou 289 notas.
    if (mudouProcesso && (perdidas || []).some((c) => c.startsWith("processo"))) {
      mostrarAviso("Salvei o texto, mas este banco ainda não guarda o processo da nota.");
    }
    registrarAlteracao({ tipo: "nota_editada", alvo: idReal, antes, depois: novoTexto });
  }

  async function apagarNota(m) {
    const idReal = String(m.id).replace(/^nota-/, "");
    const agora = new Date().toISOString();
    setMensagens((prev) => prev.map((x) => (
      x.id === m.id ? { ...x, apagada_em: agora, apagada_por: meuNome } : x)));
    // O TEXTO NÃO É LIMPO no banco. Some da tela; continua guardado. Quem
    // apaga não decide sozinho que o escritório perde o que estava escrito.
    const { error } = await supabase.from("notas")
      .update({ apagada_em: agora, apagada_por: meuNome, apagada_por_id: meuId })
      .eq("id", idReal);
    if (error) {
      setMensagens((prev) => prev.map((x) => (
        x.id === m.id ? { ...x, apagada_em: null, apagada_por: null } : x)));
      mostrarAviso("Não consegui apagar a nota. Tente de novo.");
      return;
    }
    registrarAlteracao({ tipo: "nota_apagada", alvo: idReal, antes: m.texto || "", depois: null });
  }

  // Salva uma NOTA INTERNA (comentário da equipe). Não vai para o WhatsApp:
  // grava direto na tabela "notas", que só o painel enxerga.
  async function enviarNota() {
    const t = rascunho.trim();
    if (!t || !conversaId) return;
    setRascunho("");
    setEmojiAberto(false);
    setPertoDoFim(true);
    // O processo escolhido, se houver. `escolhido` é o objeto inteiro porque o
    // NÚMERO fica guardado junto do id: sem ele, desenhar a nota exigiria
    // perguntar ao Vantoro qual processo é cada uma — uma ida à rede por nota,
    // numa lista que rola.
    const escolhido = processoDaNota
      ? processosDoCliente.find((p) => String(p.id) === String(processoDaNota))
      : null;
    // O RÉU VAI JUNTO, pelo mesmo motivo do número: é ele que identifica a ação
    // para quem lê ("a do banco", "a da operadora"), e sem a cópia a bolha teria
    // de perguntar ao Vantoro qual processo é cada nota, uma ida à rede por
    // nota. E há ação sem número — não distribuída ainda —, em que o número
    // sozinho não desenharia vínculo nenhum.
    const comProcesso = escolhido
      ? { processo_id: escolhido.id, processo_numero: escolhido.numero || "",
          processo_reu: escolhido.reu || "" }
      : {};

    const tempId = "nota-temp-" + Date.now();
    const provisoria = {
      id: tempId, conversa_id: conversaId, origem: "nota",
      texto: t, autor: meuNome, autor_foto: minhaFoto, criado_em: new Date().toISOString(), _status: "enviando",
      // A BOLHA PROVISÓRIA JÁ NASCE COM O PROCESSO. Sem isto, quem acabou de
      // escolher veria a nota aparecer SEM o processo e só depois ele surgir,
      // quando a versão do banco chegasse pelo tempo real — parecendo que a
      // escolha não pegou. E se o tempo real não chegar, ela nunca apareceria.
      ...comProcesso,
    };
    setMensagens((prev) => [...prev, provisoria].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em)));
    // UMA COLUNA QUE FALTA CUSTA UMA COLUNA, e não o resto da nota.
    //
    // Aqui havia quatro quedas encadeadas, cada uma remontando a linha do zero.
    // A última foi escrita para a falta de UMA coluna e jogava fora QUATRO — o
    // `autor_foto` que falta, o `autor_id` que existe, e as três do processo.
    //
    // MEDIDO NO BANCO DO ESCRITÓRIO em 01/09: `notas.autor_foto` nunca existiu
    // ali. Logo, TODA nota caía naquela última queda. De 289 notas, ZERO tinham
    // processo vinculado. A equipe escolhia o processo, via o seletor ficar
    // âmbar, e a escolha era descartada sem uma palavra — por semanas.
    //
    // A lista de opcionais é fechada de propósito: `conversa_id`, `texto` e
    // `autor` NÃO estão nela. Se o banco disser que falta uma dessas, isto não
    // grava uma nota sem texto — devolve o erro, e a tela avisa.
    const { error, data: gravada, perdidas } = await gravarSemAsQueFaltam(
      (linha) => supabase.from("notas").insert(linha).select("id").single(),
      { conversa_id: conversaId, texto: t, autor: meuNome,
        autor_foto: minhaFoto, autor_id: meuId, ...comProcesso },
      ["autor_foto", "autor_id", "processo_id", "processo_numero", "processo_reu"],
      COLUNAS_QUE_FALTAM_EM_NOTAS,
    );
    if (error) {
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
      // Devolve o texto à caixa: a nota some da conversa, e sem isto o que a
      // pessoa escreveu some junto — sem cópia, sem rascunho, sem nada.
      setRascunho((r) => (r ? r : t));
      setModoNota(true);
      mostrarAviso("Não consegui salvar a nota. O texto voltou para a caixa.");
    }
    else {
      // O QUE NÃO COUBE NO BANCO PRECISA SER DITO.
      //
      // Este é o conserto de fundo do defeito de 01/09: a escolha do processo
      // era descartada em silêncio, e por isso ninguém nunca soube. Uma escolha
      // que a pessoa fez e que o sistema não conseguiu guardar não pode sumir
      // sem uma palavra — quem escreveu vai embora achando que a nota está
      // ligada à ação, e meses depois alguém procura por ali e não acha nada.
      //
      // Só quando ela ESCOLHEU: numa nota geral, o processo não coube porque
      // não havia processo nenhum, e avisar seria falar de algo que não
      // aconteceu.
      const processoPerdido = perdidas.some((c) => String(c).startsWith("processo"));
      if (escolhido && processoPerdido) {
        mostrarAviso("A nota foi salva, mas SEM o vínculo com o processo — este banco "
          + "ainda não tem essa coluna. Peça para rodar o SQL das notas com processo.");
      }
      // A BOLHA TAMBÉM TEM DE DIZER A VERDADE. Ela nasceu com o processo
      // desenhado (para a escolha não parecer que não pegou); se o vínculo não
      // foi gravado, deixá-lo ali seria a tela afirmando o que o banco não tem.
      if (processoPerdido) {
        setMensagens((prev) => prev.map((m) => (m.id === tempId
          ? { ...m, processo_id: undefined, processo_numero: undefined, processo_reu: undefined }
          : m)));
      }

      // AGORA SOBE PARA O VANTORO — e o vínculo é sempre com o CLIENTE.
      //
      // Depois de gravar, e não antes: a nota da equipe não pode se perder
      // porque o Vantoro estava dormindo. Aqui ela já está salva; a subida é o
      // extra que a leva para onde alguém vai procurá-la meses depois.
      //
      // SEM CADASTRO, NÃO SOBE. Contato que ainda não é cliente não tem ficha
      // para receber nada — a nota fica na conversa, que é o certo, e sobe
      // quando o cadastro for criado.
      //
      // FALHAR AQUI NÃO DESFAZ A NOTA. Ela continua na conversa e o aviso diz o
      // que não aconteceu; desfazer seria apagar o que a pessoa escreveu por
      // causa de um serviço de terceiro fora do ar.
      if (clienteDaConversa && gravada?.id) {
        chamarPonte(`/vantoro/cliente/${clienteDaConversa}/nota`, {
          method: "POST",
          body: JSON.stringify({
            id: gravada.id,
            texto: t,
            processo_id: escolhido ? escolhido.id : null,
          }),
        }).catch(() => mostrarAviso(
          "A nota foi salva aqui, mas não subiu para a ficha do Vantoro agora. "
          + "Tente editá-la daqui a pouco."));
      }
      // Escolha usada, escolha zerada: a próxima nota começa como geral. Uma
      // escolha que gruda faria a nota seguinte entrar no processo anterior
      // sem ninguém ter pedido.
      setProcessoDaNota("");
    }
    // Se deu certo, o Realtime traz a versão definitiva e remove a provisória.
  }

  // Reenvia uma mensagem que falhou (recoloca na fila, mantendo a citação/anexo).
  /** Tira da tela um envio que falhou e não vai adiantar repetir.
   *
   *  Não apaga a linha: ela vira 'descartada', que é um estado que a ponte não
   *  processa. O registro de que houve a tentativa continua no banco — quem
   *  for investigar depois precisa dele. O que sai é o alarme na tela.
   *
   *  O GESTO TEM EFEITO ANTES DE O BANCO OPINAR. Era ao contrário: o painel
   *  pedia a gravação, e só tirava o aviso da tela se ela passasse. Quando ela
   *  não passava — e não passava — o botão virava um botão que não faz nada,
   *  com um recado dizendo isso. Agora o aviso sai na hora e fica guardado
   *  neste aparelho; a gravação no banco é o que estende o gesto aos colegas, e
   *  quando ela falha o painel diz o que o banco respondeu, com todas as
   *  letras, em vez de "não consigo agora". */
  async function dispensarFalha(msg) {
    if (!msg._filaId) return;
    guardarDispensado(msg._filaId);
    setMensagens((prev) => prev.filter((m) => m.id !== msg.id));
    const { data, error } = await supabase.from("fila_envio")
      .update({ status: "descartada" }).eq("id", msg._filaId).select("id");
    // O RECADO É CURTO E DIZ O QUE FAZER; O DETALHE CRU VAI PARA O CONSOLE.
    //
    // Despejar `new row for relation "fila_envio" violates check constraint` na
    // tela de quem atende não ajuda ninguém a decidir nada — assusta e some em
    // quatro segundos. Mas o detalhe precisa existir em algum lugar, senão
    // quem for consertar recomeça adivinhando, que foi como este defeito durou
    // tanto. Na tela: o que aconteceu, o código, e o arquivo a rodar. No
    // console: o erro inteiro.
    const rodeOSQL = " Para valer para todo mundo, rode sql/dispensar_aviso_de_falha.sql"
                   + " no Supabase do Zorvin.";
    if (error) {
      console.error("fila_envio: o banco recusou marcar como 'descartada'.", error);
      mostrarAviso("Tirei o aviso deste computador. Nos outros ele ainda vai aparecer — o banco não "
                 + "deixou salvar (erro " + (error.code || "sem código") + ")." + rodeOSQL, 9000);
      return;
    }
    // SEM ERRO E SEM LINHA ALTERADA é o outro jeito de falhar em silêncio: com
    // uma regra de acesso que esconde a linha, o banco não reclama — ele
    // atualiza zero linhas e responde "tudo certo".
    if (!data || !data.length) {
      console.error("fila_envio: a gravação passou sem erro e não alterou nenhuma linha (regra de acesso).");
      mostrarAviso("Tirei o aviso deste computador. Nos outros ele ainda vai aparecer — o banco não "
                 + "alterou nenhuma linha." + rodeOSQL, 9000);
    }
  }

  async function reenviar(msg) {
    setMensagens((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _status: "enviando" } : m)));
    // O item ANTIGO sai da fila de erros. Reenviar cria uma linha nova; sem
    // aposentar a velha, a bolha vermelha voltaria a cada recarregamento da
    // página mesmo depois de a mensagem ter saído — e ninguém entenderia por quê.
    if (msg._filaId) {
      // NO APARELHO TAMBÉM, e não só no banco. Esta gravação vinha com os erros
      // engolidos (`.then(()=>{}, ()=>{})`) — se ela não passasse, a bolha
      // vermelha da tentativa velha voltava a cada abertura da conversa, mesmo
      // com a mensagem já entregue. Ninguém relacionaria uma coisa à outra.
      guardarDispensado(msg._filaId);
      supabase.from("fila_envio").update({ status: "descartada" }).eq("id", msg._filaId)
        .then(() => {}, () => {});
    }
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
        // `enviado_por_id` FALTAVA AQUI, E SÓ AQUI.
        //
        // Todas as outras entradas na fila — enviar, responder, figurinha,
        // anexo, apagar — escrevem `enviado_por_id: meuId`. Esta não escrevia, e
        // é ele que assina a mensagem: sem ele, a reenviada era a única da
        // conversa a continuar assinada com o nome de antes. É o mesmo motivo
        // pelo qual ele foi acrescentado na LEITURA da fila, e a escrita ficou
        // para trás.
        //
        // O `status` é outra história, e vale registrar para não virar lenda: ele
        // faltava em QUATRO lugares, incluindo o envio normal de texto. Como
        // enviar funciona, a coluna tem um padrão `'pendente'` no banco — não era
        // um defeito, era uma dependência de um padrão que ninguém escreveu de
        // propósito. Agora os sete lugares escrevem a mesma coisa.
        status: "pendente",
        midia_url: url, midia_mime: msg.midia_mime || null, midia_nome: msg.midia_nome || null,
        enviado_por: msg.enviado_por || meuNome, enviado_por_id: msg.enviado_por_id || meuId,
        enviado_por_foto: msg.enviado_por_foto || minhaFoto,
      };
    } else {
      payload = { conversa_id: msg.conversa_id, texto: msg.texto || "", status: "pendente",
                  enviado_por: msg.enviado_por || meuNome, enviado_por_id: msg.enviado_por_id || meuId,
                  enviado_por_foto: msg.enviado_por_foto || minhaFoto };
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
  /** Transforma arquivos soltos em itens da prévia. Um lugar só — o clipe, o
      Ctrl+V e o arrastar caem todos aqui, então as três portas se comportam
      igual em vez de cada uma ter a sua regra. */
  function paraAnexos(arquivos) {
    return Array.from(arquivos || []).map((file) => {
      const t = file.type || "";
      const tipo = t.startsWith("image/") ? "imagem" : t.startsWith("video/") ? "video"
                 : t.startsWith("audio/") ? "audio" : "documento";
      // O DOCUMENTO TAMBÉM GANHA ENDEREÇO. Sem ele, a prévia de um PDF era um
      // ícone e um nome de arquivo — quem manda dez procurações por dia não
      // tem como conferir, ANTES de enviar, se pegou a certa. Ver
      // `src/arquivos.js`: o navegador desenha PDF e texto sozinho.
      return { file, tipo, nome: file.name, mime: t, tamanho: file.size,
               url: URL.createObjectURL(file), legenda: "" };
    });
  }

  /** Põe arquivos na prévia. Somando à fila: quem já colou dois e arrasta um
      terceiro quer os três, não o terceiro sozinho. */
  function abrirAnexos(arquivos) {
    // COM A NOTA ABERTA, NENHUM ARQUIVO ENTRA POR AQUI.
    //
    // Isto não é enfeite, e não basta esconder o clipe: `enviarArquivo` nunca
    // olhou o modo da caixa. Anexar durante uma nota interna mandava o arquivo
    // PARA O CLIENTE no WhatsApp — enquanto a tela inteira, em âmbar, dizia
    // "nota interna, só a equipe vê".
    //
    // E o clipe não é a única porta: arrastar um arquivo para a conversa e colar
    // um print com Ctrl+V passam por aqui do mesmo jeito. Fechar só o botão
    // deixaria as outras duas abertas — e a colada é a mais provável de todas,
    // porque é o gesto de quem está anotando o que acabou de ver na tela.
    //
    // Nota interna é texto: é assim que ela sobe para o Vantoro, e é assim que
    // ela é lida. Um anexo ali não teria onde ficar.
    //
    // PELA REFERÊNCIA, E NÃO PELA VARIÁVEL DO RENDER — e disto dependia metade
    // da trava. Quem chama daqui não é só o clipe: `arrastar` e `Ctrl+V` são
    // ouvintes pendurados no `document` dentro de efeitos que NÃO têm `modoNota`
    // nas dependências. Eles seguram a versão de `abrirAnexos` do render em que
    // o efeito rodou pela última vez — e nela `modoNota` vale `false` para
    // sempre. Ou seja: com a nota aberta, o clipe recusava (a variável estava
    // certa ali) e arrastar/colar mandavam o arquivo AO CLIENTE assim mesmo.
    //
    // Acrescentar `modoNota` às dependências dos dois efeitos consertaria hoje e
    // voltaria a quebrar na terceira porta que alguém abrir. A referência está
    // sempre em dia, venha a chamada de onde vier.
    if (modoNotaRef.current) {
      mostrarAviso("A nota interna é só texto. Feche a nota para enviar o arquivo ao cliente.");
      return;
    }
    const novos = paraAnexos(arquivos);
    if (!novos.length) return;
    setAnexosPendentes((antes) => {
      setAnexoAtivo(antes.length);   // o recém-chegado é o que aparece grande
      return [...antes, ...novos];
    });
  }

  function aoEscolherArquivo(e) {
    // A CÓPIA VEM ANTES DE LIMPAR, E É DISSO QUE DEPENDIA O CLIPE.
    //
    // `e.target.files` não é uma lista de arquivos: é uma JANELA para a lista
    // que está dentro do campo. Limpar o campo esvazia a lista, e quem estiver
    // segurando a "janela" fica segurando o vazio — mesmo tendo pegado a
    // referência antes.
    //
    // Era exatamente isto: pegava a janela, limpava o campo, e mandava para a
    // prévia uma lista de zero arquivos. A prévia via zero, desistia em
    // silêncio, e quem escolheu o arquivo não via nada acontecer. Sem erro,
    // sem aviso. "Estou com dificuldade de enviar anexos pelo Zorvin" — e
    // arrastar funcionava, porque ali os arquivos vêm do `dataTransfer`, que
    // não pertence a campo nenhum.
    //
    // `Array.from` COPIA o que está lá dentro agora. Depois disso, limpar o
    // campo não tira nada de ninguém.
    //
    // E limpar continua sendo necessário: sem isso, escolher o MESMO arquivo
    // duas vezes seguidas não dispara nada, porque para o navegador o valor
    // do campo não mudou. As duas coisas precisam conviver, e é essa a ordem
    // em que elas convivem.
    const arquivos = Array.from(e.target.files || []);
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    abrirAnexos(arquivos);
  }

  // COLAR UM PRINT DIRETO NA CONVERSA (Ctrl+V).
  //
  // Quem tira print com a Ferramenta de Captura fica com a imagem só na área
  // de transferência. Para mandar pelo Zorvin era preciso salvar em arquivo,
  // lembrar em que pasta caiu e anexar — três passos para o que o WhatsApp Web
  // resolve com um Ctrl+V.
  //
  // A IMAGEM NÃO SAI NA HORA: ela cai na mesma prévia dos outros anexos, com
  // legenda e confirmação. O que está na área de transferência nem sempre é o
  // que a pessoa pensa que está, e do outro lado tem um cliente.
  //
  // Colar TEXTO continua igual: o desvio só acontece quando há imagem, e é por
  // isso que o `preventDefault` fica depois da verificação, e não antes.
  useEffect(() => {
    if (!conversaId) return undefined;
    function aoColar(e) {
      // Com uma prévia já aberta, ou no meio de editar/encaminhar, o Ctrl+V é
      // para o campo de texto que está ali — não para começar outro anexo.
      if (editando || encaminhar || imagemAberta) return;
      const itens = Array.from((e.clipboardData && e.clipboardData.items) || []);
      // QUALQUER ARQUIVO, e não só imagem. O filtro era `image/`: um vídeo
      // copiado caía aqui, não casava, e o Ctrl+V não fazia absolutamente
      // nada — sem erro, sem aviso, como se a tecla não existisse.
      const arquivos = itens.filter((i) => i.kind === "file");
      if (!arquivos.length) return;
      const brutos = arquivos.map((i) => i.getAsFile()).filter(Boolean);
      if (!brutos.length) return;
      e.preventDefault();
      // NOME COM DATA E HORA. O print vem da área de transferência chamado
      // "image.png", sempre — e um Storage cheio de "image.png" não deixa
      // ninguém achar nada depois.
      const agora = new Date();
      const doisDigitos = (n) => String(n).padStart(2, "0");
      const carimbo = `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`
                    + `-${doisDigitos(agora.getHours())}h${doisDigitos(agora.getMinutes())}`;
      const comNome = brutos.map((bruto, i) => {
        // O arquivo da área de transferência costuma vir sem nome de verdade
        // ("image.png", sempre) — e um Storage cheio de "image.png" não deixa
        // ninguém achar nada depois. Quem já tem nome próprio mantém o dele.
        const generico = !bruto.name || /^image\.\w+$/i.test(bruto.name);
        if (!generico) return bruto;
        const ext = (String(bruto.type).split("/")[1] || "png").split("+")[0];
        const sufixo = brutos.length > 1 ? `-${i + 1}` : "";
        return new File([bruto], `print-${carimbo}${sufixo}.${ext}`, { type: bruto.type });
      });
      abrirAnexos(comNome);
    }
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [conversaId, editando, encaminhar, imagemAberta]);

  // ARRASTAR UM ARQUIVO PARA DENTRO DA CONVERSA.
  //
  // Não existia. Arrastar uma foto para cá fazia o NAVEGADOR abrir o arquivo
  // por cima do painel — a conversa sumia e a pessoa tinha de voltar. É o
  // comportamento padrão de quem não trata o `drop`, e ele é pior do que não
  // fazer nada, porque parece que o sistema quebrou.
  //
  // No documento, e não numa `div`: o mesmo lugar do Ctrl+V, pelo mesmo
  // motivo — o alvo do arrasto é a janela inteira, e amarrar a um retângulo
  // faria a foto funcionar no meio da tela e falhar dois centímetros ao lado.
  //
  // O `dragover` precisa de `preventDefault` para o `drop` acontecer; é isso
  // que também impede o navegador de navegar para o arquivo.
  useEffect(() => {
    if (!conversaId) return undefined;
    const daZonaPropria = (e) => e.target?.closest && e.target.closest("[data-zona-propria]");
    function aoArrastar(e) {
      if (daZonaPropria(e)) return;
      if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
      e.preventDefault();
      if (!arrastandoArquivo) setArrastandoArquivo(true);
    }
    function aoSair(e) {
      // `relatedTarget` nulo = o ponteiro saiu da janela, e não passou de um
      // elemento para outro dentro dela. Sem esta distinção a faixa piscava a
      // cada borda cruzada no caminho até o meio da tela.
      if (!e.relatedTarget) setArrastandoArquivo(false);
    }
    function aoSoltar(e) {
      if (daZonaPropria(e)) return;
      const arquivos = e.dataTransfer?.files;
      if (!arquivos || !arquivos.length) return;
      e.preventDefault();
      setArrastandoArquivo(false);
      if (editando || encaminhar || imagemAberta) return;
      abrirAnexos(arquivos);
    }
    document.addEventListener("dragover", aoArrastar);
    document.addEventListener("dragleave", aoSair);
    document.addEventListener("drop", aoSoltar);
    return () => {
      document.removeEventListener("dragover", aoArrastar);
      document.removeEventListener("dragleave", aoSair);
      document.removeEventListener("drop", aoSoltar);
    };
  }, [conversaId, editando, encaminhar, imagemAberta, arrastandoArquivo]);

  function fecharAnexoPendente() {
    for (const a of anexosPendentes) {
      if (a.url && String(a.url).startsWith("blob:")) URL.revokeObjectURL(a.url);
    }
    setAnexosPendentes([]);
    setAnexoAtivo(0);
  }

  /** Tira um da fila sem fechar a prévia — para quem colou quatro e quer três. */
  function tirarAnexo(i) {
    setAnexosPendentes((antes) => {
      const alvo = antes[i];
      if (alvo?.url && String(alvo.url).startsWith("blob:")) URL.revokeObjectURL(alvo.url);
      const resto = antes.filter((_, j) => j !== i);
      setAnexoAtivo((at) => Math.max(0, Math.min(at > i ? at - 1 : at, resto.length - 1)));
      return resto;
    });
  }

  function confirmarEnviarAnexo() {
    if (!anexosPendentes.length) return;
    // A ORDEM É A DA PRÉVIA. `enviarArquivo` é assíncrono, mas cada um já entra
    // na tela no instante em que é chamado — disparar em sequência mantém a
    // ordem que a pessoa viu, que é a ordem em que o cliente vai receber.
    const lote = anexosPendentes.map((a) => ({ file: a.file, legenda: (a.legenda || "").trim() }));
    setAnexosPendentes([]);          // sem revogar: as prévias locais das
    setAnexoAtivo(0);                // mensagens ainda apontam para os blobs
    for (const { file, legenda } of lote) enviarArquivo(file, legenda);
  }

  async function enviarArquivo(file, legenda = "", convId = conversaId, tipoForcado = null) {
    if (!convId || !file) return;
    setPertoDoFim(true);
    const ehImagem = file.type.startsWith("image/");
    const ehVideo = file.type.startsWith("video/");
    const ehAudio = file.type.startsWith("audio/");
    // `tipoForcado` existe por causa da FIGURINHA: pelo mime ela é só uma
    // imagem, e a Uazapi precisa saber que é sticker para o WhatsApp
    // desenhá-la sem moldura e sem legenda.
    const tipo = tipoForcado || (ehImagem ? "imagem" : ehVideo ? "video" : ehAudio ? "audio" : "documento");
    const tempId = "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6);
    // Prévia local (o remetente vê o anexo na hora, sem depender do Storage).
    //
    // O DOCUMENTO TAMBÉM GANHA ENDEREÇO, e antes não ganhava: `previa` era nula
    // para tudo o que não fosse imagem, vídeo ou áudio. A bolha de um PDF
    // enviado nascia SEM MÍDIA, com "indisponível" escrito nela, até o Storage
    // responder — quem acabou de mandar a procuração via um aviso de que ela
    // não estava lá.
    const previa = URL.createObjectURL(file);
    setMensagens((prev) => [...prev, {
      id: tempId, conversa_id: convId, origem: "advogado", tipo, enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto,
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
        conversa_id: convId, texto: legenda || "", tipo, status: "pendente",
        midia_url: url, midia_mime: file.type, midia_nome: nome, enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto,
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

  // Quantas conversas não lidas há (para o número na aba "Não lidas").
  //
  // VEM DO BANCO, e é a MESMA contagem do selo da barra lateral. Ela contava a
  // lista carregada, e a lista vem em páginas de 200: num telefone com mais do
  // que isso, o selo dizia 71 e o chip ao lado dizia 37. Dois números para a
  // mesma pergunta, na mesma tela, a três centímetros um do outro.
  //
  // E o chip errava PARA MENOS, que é a pior direção: some o aviso de que há
  // gente esperando. Quem olhasse o 37 concluiria que a fila é menor do que é.
  //
  // SEM NÚMERO QUANDO A CONTAGEM FALHOU. `naoLidasPorAdv` deixa de FORA o
  // telefone cuja consulta não respondeu, de propósito — zero é uma afirmação
  // que a consulta não fez. Cair para a contagem da lista aqui seria trocar
  // "não sei" por um número sabidamente menor.
  const totalNaoLidasLista = naoLidasPorAdv[advogadoId];
  // Quantas estão arquivadas (para o contador da linha "Arquivadas").
  //
  // DO BANCO, e não da lista — e aqui o estrago era maior do que um número
  // errado. É este valor que decide se a linha "Arquivadas" APARECE:
  //
  //     {!verArquivadas && totalArquivadas > 0 && !busca && (…)}
  //
  // Contando a lista carregada, num telefone com muitas conversas as arquivadas
  // caem além da primeira página — e a linha inteira sumia. Não era só o
  // contador: era a PORTA para as conversas arquivadas que desaparecia, e com
  // ela o único aviso de que há mensagem por ler lá dentro.
  const totalArquivadas = arquivadasNoBanco.total;
  // NÃO LIDAS QUE ESTÃO DENTRO DAS ARQUIVADAS.
  //
  // Elas saíram do selo do advogado, e com razão: conversa arquivada não entra
  // na fila de atendimento. Mas "não conta lá" não pode virar "não existe" —
  // são mensagens de cliente que ninguém leu, e sem este número elas ficariam
  // invisíveis para sempre, atrás de uma pasta que ninguém tem motivo para
  // abrir.
  // MESMO DEFEITO, mesma correção: contava a página carregada. Sem isto, o
  // número que existe justamente para que estas conversas não fiquem
  // invisíveis atrás da pasta de arquivadas ficava, ele próprio, menor do que a
  // verdade.
  const naoLidasArquivadas = arquivadasNoBanco.naoLidas;

  // A etiqueta escolhida no filtro, quando há uma. É ela que dá cor e nome à
  // pílula de etiquetas — sem isso, com o filtro ligado a lista fica curta e
  // nada na tela diz por quê.
  const tagFiltrada = filtro.startsWith("tag:")
    ? tags.find((t) => t.id === filtro.slice(4)) || null
    : null;

  // Aplica a aba/filtro selecionado a uma conversa.
  function passaNoFiltro(c) {
    // O filtro de atendentes é INDEPENDENTE dos outros: dá para pedir "as não
    // lidas em que eu participei". São perguntas diferentes, e obrigar a
    // escolher uma delas seria estreitar a tela sem motivo.
    if (idsQuem && !idsQuem.has(String(c.id))) return false;
    if (filtro === "naolidas") return (c.nao_lidas || 0) > 0;
    if (filtro === "favoritas") return !!c.favorita;
    if (filtro.startsWith("tag:")) {
      // Nos dois lugares: o mapa das conversas carregadas E a resposta do
      // banco. Só o mapa derrubaria as conversas que o banco achou e a lista
      // não tinha — que são exatamente as que este filtro existe para trazer.
      if ((tagsPorConversa[c.id] || []).includes(filtro.slice(4))) return true;
      return idsEtiqueta ? idsEtiqueta.has(String(c.id)) : false;
    }
    return true; // 'tudo'
  }

  // ---- Busca ampla ------------------------------------------------------
  // ------------------------------------------------------------------
  //  A BUSCA PERGUNTA AO BANCO — e não à lista que está na tela
  // ------------------------------------------------------------------
  //
  // A versão anterior filtrava o array de conversas já carregado. Isso a
  // deixava com dois furos que davam o mesmo sintoma — "às vezes acha, às
  // vezes não":
  //
  //   1. O NOME QUE ELA PROCURAVA NÃO ERA O QUE A TELA MOSTRA. A lista escreve
  //      `vantoro_nome` (o cadastro) ou `nome_zorvin` (o nome que a equipe deu
  //      aqui dentro) quando eles existem; a busca olhava só `contato.nome`, o
  //      apelido que a pessoa deixou no WhatsApp. Quem procurava pelo nome que
  //      estava lendo na tela não achava nada.
  //
  //   2. A LISTA PARA EM 1000. É o teto da API do Supabase, que corta e não
  //      avisa. Num telefone com dois anos de conversa, a maior parte da agenda
  //      fica fora da lista — e do que a busca conseguia enxergar.
  //
  // Agora a busca é uma CONSULTA: procura os contatos no banco pelas três
  // colunas de nome e pelo número, procura o termo dentro das mensagens, e
  // traz as conversas que casaram mesmo que elas não estivessem na lista.
  const [achadosMsg, setAchadosMsg] = useState({});   // conversa_id → trecho
  const [achadosCad, setAchadosCad] = useState({});   // conversa_id → motivo
  const [achadosNome, setAchadosNome] = useState({}); // conversa_id → nome que casou
  const [extras, setExtras] = useState([]);           // conversas que a lista não tinha
  const [buscando, setBuscando] = useState(false);
  // O QUE DEU ERRADO, quando deu. Uma busca que falha e mostra lista vazia é
  // pior do que uma que falha e avisa: a lista vazia é uma RESPOSTA — "esse
  // cliente não existe aqui" —, e quem lê isso para de procurar. Foi assim que
  // dois defeitos desta tela ficaram meses sem ninguém saber que eram defeitos.
  const [erroBusca, setErroBusca] = useState("");
  // A função de busca do banco existe? `null` enquanto não se sabe.
  const [temBuscaNoBanco, setTemBuscaNoBanco] = useState(null);

  /** SÓ OS NOMES — a metade barata da busca, para desenhar antes das outras.
   *
   *  QUAL DEFEITO ISTO CONSERTA. A busca fazia as três perguntas de uma vez:
   *  quem se chama assim, qual é este número, e onde isso foi DITO dentro das
   *  conversas. A terceira é a cara — ela lê a tabela de mensagens, que é a
   *  maior do sistema — e as três vinham na mesma consulta. Quem procurava um
   *  cliente PELO NOME, que é o que se faz o dia inteiro, ficava esperando uma
   *  varredura de mensagens que não tinha pedido; se ela estourasse o tempo, as
   *  três se perdiam juntas, e a tela dizia "Nada encontrado".
   *
   *  Agora esta pergunta sai na frente, sozinha, e o que ela achar aparece na
   *  hora. A completa continua vindo atrás e ACRESCENTA — nunca tira.
   *
   *  `contatos` é uma tabela de dezenas de milhares de linhas, e não de
   *  centenas de milhares: uma leitura inteira dela custa milissegundos, com ou
   *  sem índice. É por isso que esta metade dá para prometer rápido e a outra
   *  não.
   *
   *  Devolve `{ encontradas, porNome, falhou }`. */
  async function procurarSoPelosNomes(termo, advId, sinal) {
    const chave = chaveDoNumero(termo);
    const condicoes = () => condicoesDeNome(termo, chave, TEM_NOME_DO_CADASTRO);
    if (!condicoes().length || !advId) return { encontradas: [], porNome: {}, falhou: false };

    let contatos = [];
    try {
      const pedir = () => supabase.from("contatos")
        .select(colunasDoContato("id, nome, numero, foto_url"))
        .or(condicoes().join(","))
        .abortSignal(sinal)
        .limit(400);
      let { data, error } = await pedir();
      // Base sem o SQL dos nomes: tira as duas colunas do pedido e repete.
      if (error && TEM_NOME_DO_CADASTRO && faltaColuna(error)) {
        TEM_NOME_DO_CADASTRO = false;
        ({ data, error } = await pedir());
      }
      if (error) return { encontradas: [], porNome: {}, falhou: !foiAbortada(error) };
      contatos = data || [];
    } catch (e) {
      return { encontradas: [], porNome: {}, falhou: !foiAbortada(e) };
    }
    if (!contatos.length) return { encontradas: [], porNome: {}, falhou: false };

    const porNome = {};
    const encontradas = [];
    const idsCt = contatos.map((c) => c.id);
    const nomePorCt = new Map(contatos.map((c) => [String(c.id), nomeDoContato(c)]));
    try {
      for (let i = 0; i < idsCt.length; i += 150) {
        const { data, error } = await supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
          .eq("advogado_id", advId)
          .abortSignal(sinal)
          .in("contato_id", idsCt.slice(i, i + 150));
        if (error) return { encontradas, porNome, falhou: !foiAbortada(error) };
        (data || []).forEach((c) => {
          porNome[c.id] = nomePorCt.get(String(c.contato_id)) || "";
          encontradas.push(c);
        });
      }
    } catch (e) {
      return { encontradas, porNome, falhou: !foiAbortada(e) };
    }
    return { encontradas, porNome, falhou: false };
  }

  /** O que o cadastro do Vantoro sabe sobre estes números (CPF, processo).
   *
   *  Devolve `{ porCad, novas }`: o motivo por conversa, e as conversas que só
   *  o cadastro tinha como achar.
   *
   *  Fica em função porque os dois caminhos da busca — a função do banco e o
   *  caminho antigo — precisam dela igual, e duas cópias divergiriam na
   *  primeira mudança. O Vantoro fora do ar não pode atrapalhar a busca local:
   *  o que falhar aqui vira "sem achado no cadastro", e nada mais. */
  async function procurarNoVantoro(termo, encontradas, advId, sinal) {
    const porCad = {};
    const novas = [];
    try {
      if (!BRIDGE_URL) return { porCad, novas };
      const { data: sessao } = await supabase.auth.getSession();
      const jwt = sessao?.session?.access_token;
      if (!jwt) return { porCad, novas };
      // TEMPO LIMITE, como em `chamarPonte`.
      //
      // Esta chamada era o único `fetch` do painel feito por fora do
      // `ponte.js` — e por isso o único sem prazo. O comentário de lá descreve
      // o estrago com todas as letras: "a ponte roda no plano free da Render e
      // hiberna; se ela nunca responder, o `fetch` fica pendurado para sempre".
      //
      // Relato de 31/08, com foto: procurar um cliente ficava em "Procurando…"
      // e nunca saía dali. Era isto — e o Vantoro, que fica atrás da ponte,
      // hiberna também.
      const relogio = new AbortController();
      const estourou = setTimeout(() => relogio.abort(), ESPERA_PADRAO);
      // E TAMBÉM ACABA QUANDO A PERGUNTA MUDA. Quem digitou outra letra não
      // quer mais a resposta desta; deixá-la correndo é segurar uma conexão da
      // ponte — que roda no plano free e tem poucas — para jogar fora o que ela
      // trouxer.
      if (sinal) {
        if (sinal.aborted) relogio.abort();
        else sinal.addEventListener("abort", () => relogio.abort(), { once: true });
      }
      let r;
      try {
        r = await fetch(`${BRIDGE_URL}/vantoro/buscar?q=${encodeURIComponent(termo)}`,
          { headers: { Authorization: "Bearer " + jwt }, signal: relogio.signal });
      } finally {
        clearTimeout(estourou);
      }
      const corpo = await r.json().catch(() => ({}));

      // Os últimos 8 dígitos são o miolo do número: não mudam com DDD, com o
      // 9 extra nem com o código do país. É por eles que casamos.
      const porChave = new Map();   // miolo do telefone → nome do cliente
      // E O TELEFONE INTEIRO JUNTO. O miolo serve para CASAR dois números
      // escritos de jeitos diferentes; ele não serve para DISCAR. Para oferecer
      // "começar a conversa" é preciso o número como o cadastro o tem.
      const telePorChave = new Map();
      (corpo.clientes || []).forEach((cl) => {
        [cl.telefone, cl.telefone2].forEach((tel) => {
          const k = String(tel || "").replace(/\D/g, "").slice(-8);
          if (k.length === 8 && !porChave.has(k)) {
            porChave.set(k, cl.nome);
            telePorChave.set(k, String(tel));
          }
        });
      });
      if (!porChave.size) return { porCad, novas, semConversa: [] };

      const candidatas = [...conversasRef.current, ...encontradas];
      const jaCasou = new Set();
      candidatas.forEach((c) => {
        const num = String(c.contato?.numero || "");
        porChave.forEach((nome, k) => {
          if (num.endsWith(k)) { porCad[c.id] = nome; jaCasou.add(k); }
        });
      });

      // ---------------------------------------------------------------
      //  E AGORA AS CONVERSAS QUE SÓ O CADASTRO TINHA COMO ACHAR
      //
      //  Relato do escritório: "digito e não busca no Vantoro". O Vantoro ERA
      //  consultado — e respondia certo. O que ele devolvia, porém, só servia
      //  para ANOTAR o nome do cadastro em conversas que a busca local já
      //  tinha encontrado. A conversa de quem o Vantoro achou nunca era
      //  buscada.
      //
      //  Na prática: procurar por CPF só funcionava se a pessoa já estivesse
      //  na página carregada da lista. Fora dela — e a lista carrega umas
      //  poucas dezenas de um telefone que tem milhares — o CPF certo, do
      //  cliente certo, devolvia lista vazia. E lista vazia é uma RESPOSTA:
      //  quem lê "não achei" para de procurar.
      //
      //  É o mesmo defeito que a busca por nome já tinha resolvido indo ao
      //  banco em vez de filtrar a lista da tela. Aqui faltava dar o último
      //  passo: com o telefone do cadastro em mãos, perguntar ao banco de quem
      //  é aquele número.
      //
      //  Só pelas chaves que NÃO casaram acima: quem já estava na lista não
      //  precisa de ida ao banco nenhuma.
      const faltam = [...porChave.keys()].filter((k) => !jaCasou.has(k));
      if (!faltam.length || !advId) return { porCad, novas, semConversa: [] };
      const { data: cts } = await supabase.from("contatos")
        .select(colunasDoContato("id, nome, numero, foto_url"))
        .or(faltam.map((k) => `numero.ilike.%${k}%`).join(","))
        .abortSignal(sinal)
        .limit(200);
      const idsCt = (cts || []).map((c) => c.id);
      for (let i = 0; i < idsCt.length; i += 150) {
        const { data } = await supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
          .eq("advogado_id", advId)
          .abortSignal(sinal)
          .in("contato_id", idsCt.slice(i, i + 150));
        (data || []).forEach((c) => {
          const num = String(c.contato?.numero || "");
          porChave.forEach((nome, k) => {
            if (num.endsWith(k)) { porCad[c.id] = nome; jaCasou.add(k); }
          });
          novas.push(c);
        });
      }

      // ---------------------------------------------------------------
      //  E QUEM O VANTORO ACHOU E O ZORVIN NUNCA VIU
      //
      //  Relato do escritório, com print: procurar "ELIANA ALVES DA SILVA"
      //  devolvia "Nada encontrado para essa busca" — e a ELIANA está no
      //  Vantoro, com telefone, três processos e vinte e um documentos.
      //
      //  O QUE ACONTECIA. O Vantoro era consultado e respondia certo. Com o
      //  telefone dele em mãos, o painel procurava a CONVERSA daquele número:
      //
      //      .eq("advogado_id", advId)
      //
      //  Se a pessoa nunca escreveu para AQUELE número do escritório, não há
      //  conversa nenhuma — e a busca terminava sem nada a mostrar.
      //
      //  "Nada encontrado" era falso, e é o pior tipo de falso: uma RESPOSTA.
      //  Nós encontramos a pessoa; o que não temos é conversa com ela. Quem lê
      //  "não achei" conclui que o cliente não existe no sistema e para de
      //  procurar — quando o que faltava era um clique para começar a falar.
      //
      //  O TELEFONE VEM DO CADASTRO, e é isso que dá valor ao gesto: ninguém
      //  decora o número do cliente. Sem isto, a saída era abrir o Vantoro,
      //  copiar o telefone, voltar, e usar "Nova conversa".
      const semConversa = [...porChave.keys()]
        .filter((k) => !jaCasou.has(k))
        .map((k) => ({ nome: porChave.get(k), telefone: telePorChave.get(k) || "" }))
        // SEM NÚMERO NÃO HÁ O QUE OFERECER. Um cadastro sem telefone apareceria
        // como um botão que não leva a lugar nenhum.
        .filter((p) => daParaChamar(p.telefone));
      return { porCad, novas, semConversa };
    } catch (_e) { /* Vantoro fora do ar não pode atrapalhar a busca local */ }
    return { porCad, novas, semConversa: [] };
  }

  useEffect(() => {
    const termo = busca.trim();
    // Limpa ANTES de consultar, sempre. Sem isso, os achados da busca anterior
    // sobrevivem até a nova responder — e por um instante a lista mostra
    // conversas que não têm nada a ver com o que está escrito na caixa.
    setAchadosMsg({}); setAchadosCad({}); setAchadosNome({}); setExtras([]);
    // A OFERTA DO VANTORO TAMBÉM SAI. Deixá-la de pé faria a pessoa que apagou
    // a busca continuar vendo "começar conversa com Fulano" no alto da lista
    // de sempre — uma sugestão sobre uma pergunta que ela já desfez.
    setSemConversa([]);
    setErroBusca(""); setAlvoDaBusca({});
    if (termo.length < 3) { setBuscando(false); return; }

    let cancelado = false;
    setBuscando(true);
    const advId = advogadoId;

    // ------------------------------------------------------------
    //  O RELÓGIO E A TESOURA
    //
    //  Relato de 01/09, com foto: a caixa com RODRIGO ALVES SOUSA escrito, a
    //  lista vazia e "Procurando…" de pé, sem fim.
    //
    //  "Procurando…" para sempre não é lentidão — é uma espera sem fim
    //  previsto. Ela só acontece quando um `await` nunca volta, e havia nove
    //  deles aqui, nenhum com prazo. Agora todos compartilham este `sinal`:
    //
    //   • QUANDO O TEMPO ACABA (9s), tudo o que estiver no ar é cortado de uma
    //     vez, a tela diz o que aconteceu, e o "Procurando…" sai. A API do
    //     Supabase corta a consulta em 8; esperar além disso é esperar por uma
    //     resposta que o servidor já desistiu de dar.
    //
    //   • QUANDO A PESSOA DIGITA OUTRA LETRA, a busca velha é ABORTADA — e não
    //     só ignorada, como era. Este é o pedaço que ninguém vê e que explica a
    //     lentidão: cada pausa de 350ms dispara uma busca, e escrever um nome
    //     inteiro dispara três ou quatro. A variável `cancelado` fazia a
    //     RESPOSTA ser descartada, mas a consulta continuava rodando no banco
    //     até o fim. Quatro varreduras da tabela de mensagens vivas ao mesmo
    //     tempo, disputando as poucas conexões do plano — e a última, a única
    //     que interessa, esperando atrás de todas. Quanto mais devagar a pessoa
    //     digitasse, pior ficava.
    const corte = new AbortController();
    const sinal = corte.signal;
    const relogio = setTimeout(() => corte.abort(), PRAZO_DA_BUSCA);

    const tarefa = setTimeout(async () => {
      const meu = () => !cancelado && advogadoIdRef.current === advId;
      // A peneira: tira o que a lista já mostra e o que veio repetido. Está
      // aqui em cima porque os DOIS caminhos e a resposta rápida usam a mesma —
      // três cópias divergiriam na primeira mudança.
      const jaNaLista = new Set(conversas.map((c) => String(c.id)));
      const peneirar = (lista) => {
        const vistos = new Set();
        return lista.filter((c) => {
          const id = String(c.id);
          if (jaNaLista.has(id) || vistos.has(id)) return false;
          vistos.add(id);
          return true;
        });
      };

      // ------------------------------------------------------------
      //  A METADE BARATA SAI NA FRENTE E DESENHA SOZINHA
      //
      //  Procurar um cliente PELO NOME é o que se faz o dia inteiro, e é a
      //  pergunta mais barata das três. Ela ia junto com a varredura das
      //  mensagens, na mesma consulta — então esperava por ela, e se ela
      //  estourasse o tempo as duas se perdiam juntas.
      //
      //  Agora esta sai disparada e não é esperada: o que ela achar aparece na
      //  hora, e a completa vem atrás e ACRESCENTA. Nunca tira.
      //
      //  SÓ APAGA O "Procurando…" SE ACHOU ALGUMA COISA. Apagá-lo de mãos
      //  vazias mostraria "Nada encontrado para essa busca" por um segundo,
      //  antes de a completa responder — e "nada encontrado" é uma RESPOSTA:
      //  quem lê isso para de procurar.
      let jaVeioACompleta = false;
      // O que ela achou fica guardado aqui para o caminho completo somar ao
      // dele. Se ele for cortado pelo relógio no meio, é isto que impede a tela
      // de PERDER o que já estava desenhado — mostrar e tirar é pior do que
      // nunca ter mostrado.
      let dosNomes = { encontradas: [], porNome: {}, falhou: false };
      const nomes = procurarSoPelosNomes(termo, advId, sinal);
      nomes.then((r) => {
        dosNomes = r;
        if (!meu() || jaVeioACompleta || !r.encontradas.length) return;
        setAchadosNome(r.porNome);
        setExtras(peneirar(r.encontradas));
        setBuscando(false);
      }).catch(() => {});

      try {
      // ------------------------------------------------------------
      //  PRIMEIRO, A FUNÇÃO DO BANCO
      //
      //  Ela responde as três perguntas de uma vez — nome, número e o que foi
      //  dito dentro da conversa —, sem acento e recortada NESTE telefone.
      //
      //  As duas coisas que ela conserta não davam para consertar aqui:
      //
      //  1. O ACENTO. O `ilike` compara letra por letra: "ç" não é "c". Quem
      //     procurava "gracas" não achava "MARIA DAS GRAÇAS PEREIRA" — e como
      //     o cliente de nome sem acento aparecia, o defeito parecia aleatório.
      //     Tirar o acento do que se digita não adianta: o acento está no dado.
      //
      //  2. A PALAVRA COMUM. A busca por mensagem pedia as mil mensagens mais
      //     recentes que casassem no escritório INTEIRO e só depois jogava fora
      //     as dos outros telefones. Medido num banco de verdade com 264 mil
      //     mensagens: das mil mais recentes com "teste", ZERO eram do telefone
      //     de quem procurava. A conversa certa não tinha como aparecer.
      //
      //  Enquanto o SQL não for rodado, o caminho antigo continua valendo — a
      //  busca fica como estava, e não pior.
      if (temBuscaNoBanco !== false) {
        const { data: achados, error } = await supabase.rpc("buscar_conversas", {
          p_advogado: advId, p_termo: termo, p_limite: 80,
        }).abortSignal(sinal);
        if (!meu()) return;

        if (!error) {
          jaVeioACompleta = true;
          if (temBuscaNoBanco !== true) setTemBuscaNoBanco(true);
          const porMsg = {}, porNome = {}, alvos = {};
          const ids = [];
          for (const a of achados || []) {
            ids.push(a.id);
            if (a.motivo === "mensagem") {
              porMsg[a.id] = a.trecho || "";
              // `mensagem_em` pode não vir: é uma coluna que o SQL
              // `2026-08-busca-ir-para-a-mensagem.sql` acrescenta. Sem ela a
              // conversa abre no fim, como abria antes — e não quebra.
              if (a.mensagem_em) alvos[a.id] = { id: a.mensagem_id, em: a.mensagem_em };
            } else porNome[a.id] = termo;
          }
          const encontradas = [];
          for (let i = 0; i < ids.length; i += 150) {
            const { data } = await supabase.from("conversas")
              .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
              .eq("advogado_id", advId)
              .abortSignal(sinal)
              .in("id", ids.slice(i, i + 150));
            encontradas.push(...(data || []));
          }
          if (!meu()) return;
          // O QUE A CONSULTA BARATA ACHOU ENTRA JUNTO, e não é substituído por
          // isto. Dois motivos: ela pode ter achado alguém que não coube nas
          // oitenta linhas desta, e — o que importa mais — se o relógio tivesse
          // cortado o laço acima, `encontradas` viria vazia e a tela APAGARIA o
          // que já estava desenhado. Mostrar e tirar é pior do que nunca ter
          // mostrado: quem viu o nome aparecer e sumir conclui que o sistema
          // perdeu o cliente.
          const tudo = [...dosNomes.encontradas, ...encontradas];
          setAchadosMsg(porMsg);
          setAchadosNome({ ...dosNomes.porNome, ...porNome });
          setAlvoDaBusca(alvos);

          // O QUE O BANCO ACHOU VAI PARA A TELA AGORA — e não depois.
          //
          // Relato de 31/08, com foto: "está lento para pesquisar clientes,
          // nunca aparece", com a busca parada em "Procurando…".
          //
          // O banco já tinha respondido. Quem segurava a tela era a consulta ao
          // Vantoro logo abaixo: ela vinha ANTES do `setExtras`, então as
          // conversas achadas aqui ficavam reféns de uma ida a OUTRA
          // hospedagem — que fica atrás da ponte, e que hiberna na Render.
          // Esperar meio minuto por um cadastro que só ACRESCENTA o nome é
          // meio minuto sem ver a conversa que o banco achou de primeira.
          //
          // Agora são dois tempos: o que é daqui aparece de imediato, e o que
          // vem do cadastro chega depois — se chegar.
          setExtras(peneirar(tudo));
          setBuscando(false);
          // O RELÓGIO PARA AQUI. O que falta — o cadastro do Vantoro — só
          // ACRESCENTA, e tem prazo próprio; cortá-lo aos 9 segundos junto com
          // o resto tiraria da tela um cliente que estava a caminho, sem
          // ganhar nada em troca, porque ninguém está mais esperando.
          clearTimeout(relogio);

          const doCadastro = await procurarNoVantoro(termo, tudo, advId, sinal);
          if (!meu()) return;
          setAchadosCad(doCadastro.porCad);
          setSemConversa(doCadastro.semConversa || []);
          // As que só o cadastro achou entram na MESMA peneira das outras.
          setExtras(peneirar([...tudo, ...doCadastro.novas]));
          return;
        }

        // A FUNÇÃO DO BANCO FALHOU. E daqui em diante NÃO SE DESISTE.
        //
        // Relato do escritório: procurar "rodrigo alves sousa" devolvia só
        // "Não consegui completar a busca agora" — nenhum resultado, nem os que
        // o caminho antigo teria achado sem dificuldade nenhuma.
        //
        // Eram dois problemas na mesma linha:
        //
        //  1. A BUSCA MORRIA EM VEZ DE DESCER. Só a FALTA da função (PGRST202)
        //     levava ao caminho antigo; qualquer outro tropeço — uma consulta
        //     que estourou o tempo, uma queda de rede, o banco ocupado —
        //     mostrava o aviso e parava ali. Mas o caminho antigo é OUTRA
        //     consulta, mais simples, e na maioria desses tropeços ela passa.
        //     Desistir sem tentar é jogar fora a resposta que estava à mão.
        //
        //  2. O MOTIVO SUMIA. "Tente de novo em alguns segundos" é a mesma
        //     frase para "o SQL não foi rodado", "a consulta demorou demais" e
        //     "a internet caiu" — três coisas com consertos diferentes. Sem o
        //     código do erro em lugar nenhum, descobrir qual delas era exigia
        //     adivinhar. Agora ele vai para o console, com nome e sobrenome.
        //
        // `temBuscaNoBanco` só é DESLIGADO quando a função não existe: isso é
        // permanente até alguém rodar o SQL. Um tropeço passageiro não pode
        // aposentar o caminho rápido para o resto da sessão.
        const naoExiste = funcaoNaoExiste(error);
        console.info(`Zorvin: a busca no banco falhou (${error.code || "sem código"}: `
          + `${error.message || "sem mensagem"}). `
          + (naoExiste ? "Rode o SQL da busca para ela ficar mais rápida e mais completa."
                       : "Tentando pelo caminho antigo."));
        if (naoExiste) setTemBuscaNoBanco(false);
        // Nos dois casos, segue para o caminho antigo, logo abaixo.
      }

      // O erro do banco não pode mais ser engolido. Era ele que transformava
      // uma consulta que estourou o tempo numa lista vazia — e lista vazia é
      // uma resposta, não um aviso.
      // O QUE FALHOU, e não só QUE falhou. As duas metades da busca — os nomes
      // e o que foi DITO nas conversas — têm consertos diferentes e pesos
      // diferentes: sem os nomes não se acha ninguém; sem as mensagens ainda se
      // acha por nome, e o certo é mostrar o que veio e dizer o que faltou.
      let falhouMensagem = false;
      const contarFalha = (onde, erro) => {
        console.info(`Zorvin: a busca por ${onde} falhou `
          + `(${(erro && erro.code) || "sem código"}: ${(erro && erro.message) || erro || "sem mensagem"}).`);
      };

      // ---- 1 e 2) os CONTATOS e as conversas deles ----
      //
      // NÃO SE PERGUNTA DE NOVO: é a mesma consulta que já saiu lá em cima, e
      // aqui só se espera por ela. Antes eram duas idas ao banco pedindo
      // exatamente a mesma coisa — a rápida, que desenha, e esta — e a segunda
      // não acrescentava um nome sequer.
      const { encontradas, porNome, falhou: falhouNome } = await nomes;
      if (!meu()) return;

      // ---- 3) dentro das MENSAGENS ----
      //
      // Uma consulta só, e não uma por lote de conversas: as regras do banco já
      // limitam o que cada pessoa enxerga, e o que vier de outro telefone é
      // descartado aqui. A versão anterior pedia em lotes de 150 conversas com
      // teto de 300 mensagens por lote — e um termo comum estourava esse teto,
      // fazendo sumir conversas que TINHAM a palavra.
      const porMsg = {};
      try {
        const { data, error } = await supabase.from("mensagens")
          .select("conversa_id, texto")
          // O TERMO VAI INTEIRO, com vírgula e parênteses. A limpeza do
          // `termoSeguro` existe para o `or`, onde esses caracteres SEPARAM
          // condições; aqui é um filtro de uma coluna só, e eles são conteúdo:
          // quem procura "(67)" dentro de uma mensagem está procurando isso.
          .ilike("texto", `%${termo}%`)
          .order("criado_em", { ascending: false })
          .abortSignal(sinal)
          .limit(1000);
        // Abortada NÃO É FALHA: ou a pessoa digitou outra letra, ou o relógio
        // desistiu — e nos dois casos quem avisa é outro. Marcar isto como
        // falha encheria a tela de erro a cada tecla.
        if (error && !foiAbortada(error)) { falhouMensagem = true; contarFalha("texto das mensagens", error); }
        (data || []).forEach((m) => {
          if (!porMsg[m.conversa_id]) porMsg[m.conversa_id] = m.texto || "";
        });
      } catch (e) { falhouMensagem = true; contarFalha("texto das mensagens", e); }

      // As conversas com mensagem casada que ainda não temos em mãos.
      const faltando = Object.keys(porMsg)
        .filter((id) => !conversas.some((c) => String(c.id) === String(id))
                     && !encontradas.some((c) => String(c.id) === String(id)));
      for (let i = 0; i < faltando.length; i += 150) {
        const { data } = await supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
          .eq("advogado_id", advId)
          .abortSignal(sinal)
          .in("id", faltando.slice(i, i + 150));
        (data || []).forEach((c) => encontradas.push(c));
      }

      // Troquei de telefone (ou de termo) enquanto isto vinha? A resposta é de
      // outra pergunta: descarta.
      if (!meu()) return;
      setAchadosMsg(porMsg);
      setAchadosNome(porNome);
      // A FRASE MUDA CONFORME O QUE FALTOU, porque a decisão de quem lê muda —
      // e a escolha dela mora em `busca.js`, com uma prova para cada caso.
      setErroBusca(recadoDaBusca({
        falhouNome, falhouMensagem,
        tempoEsgotado: sinal.aborted && !cancelado,
        achouAlgo: encontradas.length > 0,
      }));
      // O QUE É DAQUI PRIMEIRO — o mesmo conserto do caminho de cima. Este é o
      // caminho de reserva (quando a função do banco ainda não foi criada), e
      // ele tinha o defeito idêntico: a ida ao Vantoro vinha antes de desenhar,
      // e o "Procurando…" ficava de pé até ela voltar.
      setExtras(peneirar(encontradas));
      setBuscando(false);
      clearTimeout(relogio);   // o que falta só acrescenta; ver acima

      // ---- e só então o cadastro do Vantoro (CPF, processo) ----
      const doCadastro = await procurarNoVantoro(termo, encontradas, advId, sinal);
      if (!meu()) return;
      setAchadosCad(doCadastro.porCad);
      setSemConversa(doCadastro.semConversa || []);
      setExtras(peneirar([...encontradas, ...doCadastro.novas]));
      } catch (e) {
        // NENHUMA EXCEÇÃO PODE ESCAPAR DAQUI. Uma só, em qualquer das nove
        // consultas, pulava o `setBuscando(false)` — e o "Procurando…" ficava
        // de pé pelo resto da sessão, sem nada na tela dizendo por quê.
        if (meu() && !foiAbortada(e)) {
          console.info(`Zorvin: a busca parou por um erro (${e && e.message ? e.message : e}).`);
          setErroBusca(recadoDaBusca({ falhouNome: true, falhouMensagem: true }));
        }
      } finally {
        // A REDE DE SEGURANÇA. Os caminhos de cima já apagam o "Procurando…" no
        // momento certo, cada um no seu; este aqui é o que garante que ele SAI,
        // aconteça o que acontecer — inclusive quando o relógio cortou tudo e
        // não sobrou caminho nenhum para chegar até lá.
        clearTimeout(relogio);
        if (meu()) {
          setBuscando(false);
          if (sinal.aborted) {
            setErroBusca((antes) => antes || recadoDaBusca({
              tempoEsgotado: true, achouAlgo: false,
            }));
          }
        }
      }
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(tarefa);
      clearTimeout(relogio);
      // A TESOURA. Sem isto, a busca velha continuava rodando no banco depois
      // de a pessoa já ter digitado outra letra: só a RESPOSTA era descartada.
      corte.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, conversas.length, advogadoId]);

  /** Todos os nomes por que um contato pode ser chamado — inclusive o que a
   *  tela mostra, que nem sempre é o `nome`. */
  function nomesDoContato(ct) {
    return [ct?.vantoro_nome, ct?.nome_zorvin, ct?.nome, ct?.numero];
  }

  function casaNaBusca(c) {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    if (nomesDoContato(c.contato).some((n) => String(n || "").toLowerCase().includes(termo))) return true;
    // Por NÚMERO, comparando as chaves: assim "(11) 99999-9999" acha um
    // contato salvo como "5511999999999". Antes a busca era texto contra
    // texto, e a pontuação bastava para não achar nada.
    const chaveTermo = chaveDoNumero(termo);
    if (chaveTermo.length >= 4) {
      const chaveContato = chaveDoNumero(c.contato?.numero);
      if (chaveContato && chaveContato.includes(chaveTermo)) return true;
    }
    return !!achadosMsg[c.id] || !!achadosCad[c.id] || !!achadosNome[c.id];
  }

  // A PÁGINA VOLTA AO COMEÇO quando a lista muda de assunto. Sem isto, quem
  // rolou 400 conversas e depois digitou uma busca continuaria desenhando 400
  // linhas — o custo que a paginação existe para evitar.
  useEffect(() => { setQuantasNaLista(PAGINA); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advogadoId, busca, filtro, verArquivadas, quemFiltra, modoQuem]);

  /** ABRE UMA CONVERSA — e, se ela veio da busca por mensagem, abre NELA.
   *
   *  O clique e o Enter passam os dois por aqui: eram duas cópias da mesma
   *  linha, e uma teria ficado para trás na primeira mudança. */
  function abrirConversa(c) {
    naoLidasRef.current = c.nao_lidas || 0;
    const achado = alvoDaBusca[c.id];
    alvoParaAbrirRef.current = achado ? { conversa: c.id, ...achado } : null;

    // A CONVERSA QUE A BUSCA TROUXE ENTRA NA LISTA ANTES DE ABRIR.
    //
    // Relato do escritório: "quando aparece e eu clico no contato, a conversa
    // não abre". Era isto, e era exatamente isto.
    //
    // A lista da esquerda desenha duas fontes emendadas: as conversas
    // CARREGADAS (uma página de cada vez) e as que a busca, a etiqueta ou o
    // filtro de atendente foram buscar no banco por não estarem na página. Mas
    // a conversa ABERTA saía de um lugar só — `conversas.find(...)` —, que não
    // enxerga essas últimas. Clicar numa delas mudava o `conversaId` para um id
    // que aquela lista não tem, `conversa` virava nulo, e a tela da direita
    // continuava dizendo "Selecione uma conversa".
    //
    // O clique tinha funcionado. Só não havia como ver.
    //
    // E o defeito só aparece onde ninguém tropeça por acaso: com a conversa
    // dentro da primeira página, tudo funciona. É preciso procurar alguém com
    // quem não se fala há tempo — que é justamente para o que a busca serve.
    //
    // Emendar aqui, e não fazer `conversa` olhar as três listas: assim a
    // conversa continua na tela quando a busca é apagada (apagar a busca
    // esvazia os extras, e ela sumiria debaixo de quem está atendendo), e vale
    // para os três caminhos de uma vez.
    setConversas((antes) => (antes.some((x) => String(x.id) === String(c.id))
      ? antes
      : [...antes, c].sort((a, b) => ((b.fixada ? 1 : 0) - (a.fixada ? 1 : 0))
          || String(b.ultima_atividade || "").localeCompare(String(a.ultima_atividade || "")))));

    // A CONVERSA JÁ ABERTA NÃO RECARREGA SOZINHA.
    //
    // `setConversaId` com o mesmo valor não muda nada, e o efeito que carrega
    // as mensagens não roda de novo. Era metade do defeito relatado: procurar
    // uma palavra e ir até ela funcionava; procurar OUTRA palavra da mesma
    // conversa não fazia nada, porque a conversa já estava na tela.
    if (String(c.id) === String(conversaId)) {
      if (achado) { setPertoDoFim(false); carregarMensagens(c.id); }
      return;
    }
    setConversaId(c.id);
  }

  /** Mostra mais um punhado — e, se o que temos acabou, pede outra página ao
   *  banco. Depois de trazer a página, cresce a fatia desenhada TAMBÉM: sem
   *  isso, quem chegou ao fim rolando ficava preso — a lista carregava 200
   *  conversas novas e continuava desenhando as mesmas 200, então não havia
   *  para onde rolar e o próximo passo nunca acontecia. */
  const mostrarMais = (passo) => {
    if (quantasNaLista < conversasFiltradas.length) {
      setQuantasNaLista((n) => n + (passo || PAGINA));
      return;
    }
    // Com etiqueta escolhida, o banco JÁ deu todas as que a carregam:
    // pedir mais páginas da lista geral não acrescenta nada ao que está
    // sendo mostrado.
    if (!temMaisConversas || buscandoMais || busca.trim()
        || filtro.startsWith("tag:") || quemFiltra.length) return;
    setBuscandoMais(true);
    carregarConversas(advogadoId, paginaConversas + 1).finally(() => {
      setBuscandoMais(false);
      setQuantasNaLista((n) => n + (passo || PAGINA));
    });
  };

  // ------------------------------------------------------------
  //  PROCURAR É PROCURAR EM TUDO — inclusive no que foi arquivado
  //
  //  Relato de quem usa: "a busca não está encontrando as conversas
  //  arquivadas".
  //
  //  A regra `!!c.arquivada === verArquivadas` existe para a LISTA: fora da
  //  pasta de arquivadas, arquivada não aparece — e isso está certo, é o que
  //  arquivar quer dizer. Só que ela valia também DURANTE A BUSCA, e aí virava
  //  outra coisa: quem procurava um cliente arquivado meses atrás recebia
  //  "Nada encontrado para essa busca".
  //
  //  E "nada encontrado" é uma RESPOSTA. Quem lê isso conclui que o cliente
  //  não está no Zorvin — e vai procurar noutro lugar, ou cadastra de novo.
  //
  //  NÃO ERA O BANCO QUE ESCONDIA: a função `buscar_conversas` devolve as
  //  arquivadas, e o SQL dela não tem filtro nenhum de `arquivada`. Era esta
  //  linha que as jogava fora depois de o banco já as ter encontrado.
  //
  //  UMA REGRA SÓ, NOS DOIS SENTIDOS: com busca escrita, a pasta não recorta.
  //  Procurar de dentro da pasta de arquivadas também acha as normais. Duas
  //  regras — "na lista aparece, na pasta não" — dariam uma busca que responde
  //  diferente conforme onde a pessoa estava quando começou a digitar, e isso
  //  ninguém guarda.
  //
  //  E A LINHA DIZ QUE ESTÁ ARQUIVADA. Sem o selo, a conversa aparece na
  //  busca, some quando a busca é apagada, e parece defeito.
  const buscandoTexto = busca.trim().length > 0;
  const naPasta = (c) => buscandoTexto || (!!c.arquivada === verArquivadas);

  const conversasFiltradas = (() => {
    const daLista = conversasNaTela.filter((c) =>
      naPasta(c) &&
      casaNaBusca(c) &&
      passaNoFiltro(c)
    );
    // Sem busca, sem etiqueta e sem atendente escolhido não há nada a emendar,
    // e o de baixo custaria um `Set` sobre a lista inteira a cada redesenho —
    // trabalho de sobra em cima do caminho mais quente que esta tela tem.
    if (!busca.trim() && !filtro.startsWith("tag:") && !quemFiltra.length) return daLista;
    // As que vieram do banco e não estavam na lista. Entram na mesma ordem de
    // sempre — fixada em cima, depois recente primeiro —, e não emendadas no
    // fim, que faria a mais nova de todas aparecer embaixo da mais velha.
    const jaTem = new Set(daLista.map((c) => String(c.id)));
    const doBanco = busca.trim()
      ? extras.filter((c) => !jaTem.has(String(c.id))
          && naPasta(c) && passaNoFiltro(c))
      // As da etiqueta não passam por `passaNoFiltro`: elas vieram do banco
      // JUSTAMENTE por carregarem a etiqueta escolhida, e `tagsPorConversa` só
      // conhece as conversas da lista — perguntar a ele por uma conversa que a
      // lista não tem devolveria "não tem etiqueta" e derrubaria de novo o que
      // acabou de ser encontrado.
      // (sem `casaNaBusca`: este ramo só existe quando a caixa de busca está
      // vazia — o de cima é que trata a busca.)
      : [...extrasEtiqueta, ...extrasQuem].filter((c) => !jaTem.has(String(c.id))
          && naPasta(c) && passaNoFiltro(c));
    if (!doBanco.length) return daLista;
    return [...daLista, ...doBanco].sort((a, b) =>
      ((b.fixada ? 1 : 0) - (a.fixada ? 1 : 0))
      || String(b.ultima_atividade || "").localeCompare(String(a.ultima_atividade || "")));
  })();

  // O "+" no rodapé quer dizer "o banco tem mais do que isto". Com uma busca
  // ou uma etiqueta escolhida, ele NÃO tem: as duas já perguntaram ao banco e
  // trouxeram tudo o que casa. Deixar o "+" ali diria que ainda falta alguma
  // coisa — e quem estivesse conferindo uma etiqueta não saberia se o número
  // na tela é o número de verdade.
  const listaPodeCrescer = !busca.trim() && !filtro.startsWith("tag:") && !quemFiltra.length;

  // Não lidas de cada advogado, para o selo na barra lateral.
  // Para o advogado atual usamos a lista já carregada (que zera a conversa
  // aberta em tempo real); para os demais, o total consultado do banco.
  // CONVERSAS, e não mensagens.
  //
  // O selo somava as mensagens: seis conversas em que uma delas tinha duas
  // mensagens viravam "7". Mas o filtro logo ao lado diz "Não lidas 6", e a
  // lista mostra seis linhas — o 7 não correspondia a nada que a pessoa
  // pudesse contar na tela. O que se atende é conversa; é isso que o selo tem
  // de dizer.
  // O SELO VEM SEMPRE DA CONTAGEM DO BANCO, inclusive o do telefone aberto.
  //
  // Ele vinha da lista carregada quando o telefone era o atual. Isso resolvia um
  // problema antigo (o selo mudava de número conforme onde você estava) e criou
  // outro assim que a lista passou a vir em páginas: a lista tem 200 conversas,
  // o telefone tem 1200, e o selo passava a contar só o pedaço carregado.
  //
  // Agora as duas contas são a MESMA — a do banco —, e o desconto de quem
  // acabou de ler é feito na hora, aqui mesmo, para o selo não esperar a
  // ida-e-volta.
  function naoLidasDoAdvogado(id) {
    return naoLidasPorAdv[id] || 0;
  }

  /** Tira `quantas` do selo do telefone na hora, e confere com o banco depois. */
  function descontarDoSelo(advId, quantas) {
    if (!advId || !quantas) return;
    setNaoLidasPorAdv((m) => ({ ...m, [advId]: Math.max(0, (m[advId] || 0) - quantas) }));
    carregarNaoLidasPorAdv();
  }

  // Atendentes que já interagiram nesta conversa (para o grupinho de avatares
  // no topo). Junta quem enviou mensagens e quem escreveu notas.
  //
  // A CHAVE É O ID, e não o nome. Era o nome, e por isso quem trocasse de nome
  // aparecia DUAS vezes no grupinho — a mesma pessoa, com o nome de antes e com
  // o de agora, uma delas sem foto. Pelo id ela é uma só; o nome só serve de
  // chave no histórico anterior ao id existir, e ali não há o que fazer.
  //
  // Cada um vem com QUANTAS mensagens escreveu e QUANDO foi a última. São as
  // duas coisas que a lista de "quem participou" precisa dizer para não ser só
  // uma fileira de rostos: sem elas, quem escreveu uma vez em março e quem
  // tocou a conversa a semana inteira aparecem iguais.
  const atendentesInteragiram = (() => {
    const mapa = new Map();
    for (const m of mensagens) {
      if (m.origem !== "advogado" && m.origem !== "nota") continue;
      const q = quemFalou(m);
      // NEM APARELHO NEM RÓTULO. A pergunta do grupinho é "com quem eu falo
      // sobre este cliente", e nenhum dos dois tem a quem perguntar.
      if (!q.nome || q.aparelho || q.rotulo) continue;
      const chave = q.id || "nome:" + chaveDeNome(q.nome);
      const antes = mapa.get(chave);
      if (!antes) { mapa.set(chave, { ...q, quantas: 1, ultimaEm: m.criado_em }); continue; }
      antes.quantas++;
      if (new Date(m.criado_em) > new Date(antes.ultimaEm)) antes.ultimaEm = m.criado_em;
      // A primeira aparição pode ser de antes da foto existir; a de depois tem.
      if (!antes.foto && q.foto) antes.foto = q.foto;
    }

    // E, POR ÚLTIMO, JUNTA PELO NOME o que sobrou sem id.
    //
    // Duas linhas com o MESMO nome na tela são sempre erro: quem lê não tem
    // como saber que são a mesma pessoa vista por dois caminhos — um pelo id,
    // com foto, e outro por um de-para que só tinha texto. Aconteceu em
    // produção, com "Rodrigo Sousa" duas vezes.
    //
    // A checagem acima, por chave, não alcança isso: as chaves são diferentes
    // de propósito (uma é o id, a outra é o nome). Esta passada é a rede de
    // segurança — ela olha o que vai APARECER, e é isso que precisa estar
    // certo, venha de onde vier.
    const porNomeVisivel = new Map();
    for (const p of mapa.values()) {
      const chave = chaveDeNome(p.nome);
      const antes = porNomeVisivel.get(chave);
      if (!antes) { porNomeVisivel.set(chave, p); continue; }
      // Fica quem tem id (é a pessoa de verdade); as contagens somam.
      const [dono, outro] = antes.id ? [antes, p] : [p, antes];
      dono.quantas += outro.quantas;
      if (!dono.foto && outro.foto) dono.foto = outro.foto;
      if (new Date(outro.ultimaEm) > new Date(dono.ultimaEm)) dono.ultimaEm = outro.ultimaEm;
      porNomeVisivel.set(chave, dono);
    }

    // Quem falou mais na frente: é a ordem que responde "quem está tocando este
    // atendimento", que é a pergunta de quem olha o grupinho.
    return [...porNomeVisivel.values()].sort((a, b) => b.quantas - a.quantas);
  })();

  // Os nomes de quem está marcado no filtro de atendentes, na ordem em que
  // aparecem na lista — para o rastro que fica na fita de filtros.
  const nomesQuemFiltra = quemFiltra
    .map((id) => (atendentes.find((a) => String(a.id) === String(id)) || {}).nome)
    .filter(Boolean);

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

  // AS DUAS LISTINHAS DO CABEÇALHO, ESCRITAS UMA VEZ SÓ.
  //
  // No computador cada uma pende do seu próprio botão. No celular esses botões
  // saíram do cabeçalho — não cabiam — e as duas passaram a pender do ⋮. O
  // conteúdo é o mesmo nos dois lugares, então mora aqui: duplicado, um dia só
  // uma das cópias seria corrigida, e ninguém descobriria pelo monitor.
  const listaDeParticipantes = !conversa ? null : (
    <div style={{ position: "absolute", top: estreito ? 44 : 36, right: 0, zIndex: 60, width: 264, maxHeight: 340, overflowY: "auto",
                  background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${C.divider}`, fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>
        Quem participou desta conversa
        <div style={{ fontSize: 11.5, fontWeight: 400, color: C.textSecondary, marginTop: 2 }}>
          {atendentesInteragiram.length === 1
            ? "1 pessoa do escritório escreveu aqui"
            : `${atendentesInteragiram.length} pessoas do escritório escreveram aqui`}
        </div>
      </div>
      {atendentesInteragiram.map((a) => (
        <div key={a.id || a.nome} data-participante={a.nome}
             style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px" }}>
          <Avatar nome={a.nome} foto={a.foto} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</div>
            {/* "3 mensagens · ontem" — quantas e quando, que é o
                que separa quem passou por aqui de quem atende. */}
            <div style={{ fontSize: 11.5, color: C.textSecondary }}>
              {a.quantas} {a.quantas === 1 ? "mensagem" : "mensagens"}
              {a.ultimaEm ? ` · ${rotuloData(a.ultimaEm).toLowerCase()}` : ""}
            </div>
          </div>
        </div>
      ))}
      {/* SÓ O QUE ESTÁ CARREGADO. A conversa abre com as
          mensagens recentes e traz o resto ao rolar para cima —
          então esta lista cresce conforme se sobe. Dizer isso é
          melhor do que deixar alguém concluir que fulano nunca
          falou com o cliente. */}
      <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${C.divider}`, fontSize: 11, color: C.textSecondary, lineHeight: 1.4 }}>
        Conta o que já está aberto na conversa. Role para cima
        para carregar o mais antigo.
      </div>
    </div>
  );

  const listaDeEtiquetas = !conversa ? null : (
    <div style={{ position: "absolute", top: estreito ? 44 : 30, right: 0, width: 240, maxHeight: 320, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.25)", zIndex: 46 }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.divider}`, fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3, position: "sticky", top: 0, background: C.panel }}>MARCAR TAGS</div>
      {tags.length === 0 && (
        <div style={{ padding: 14, fontSize: 13, color: C.textSecondary, textAlign: "center" }}>Nenhuma tag ainda. Crie em Configurações → Tags.</div>
      )}
      {tags.map((t) => {
        const marcada = (tagsPorConversa[conversa.id] || []).includes(t.id);
        return (
          <button key={t.id} data-tag-opcao={t.id} onClick={() => alternarTagConversa(t.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, textAlign: "left" }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: t.cor, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13.5 }}>{t.nome}</span>
            {marcada && <Check size={16} color={C.green} />}
          </button>
        );
      })}
      <button onClick={() => { setTagMenuAberto(false); setAbaConfig("tags"); setTagForm(null); setConfigAberta(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", border: "none", borderTop: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.verdeTexto, fontSize: 13, fontWeight: 600 }}><Plus size={15} /> Gerenciar etiquetas</button>
    </div>
  );

  // ------------------------------------------------------------------
  //  AS AÇÕES DA BOLHA, COM IDENTIDADE FIXA
  //
  //  `ListaDeBolhas` está embrulhada em `React.memo` para que digitar não
  //  redesenhe o histórico inteiro. O `memo` compara as propriedades uma a uma
  //  — e quinze delas são funções declaradas aqui no corpo do painel, que
  //  nascem NOVAS a cada desenho. Com elas indo direto, o `memo` nunca batia:
  //  medido, a digitação continuava custando 1,64× numa conversa longa.
  //
  //  A saída óbvia seria `useCallback` nas quinze. Cada uma pediria uma lista
  //  de dependências escrita à mão, e uma lista errada não dá erro: dá o botão
  //  que faz o que fazia três telas atrás — o defeito de fechamento velho, que
  //  não aparece em nenhum teste e aparece no uso.
  //
  //  Aqui, em vez disso, a lista recebe embrulhos criados UMA vez, que sempre
  //  chamam a versão mais recente guardada no `ref`. Identidade fixa para o
  //  `memo`, comportamento sempre atual para quem clica. Não há lista de
  //  dependências para errar.
  //
  //  O `ref` é escrito DURANTE o desenho, e de propósito: `ListaDeBolhas` é
  //  filha, então desenha depois desta linha e já enxerga as versões novas. Num
  //  efeito, o primeiro desenho encontraria o `ref` vazio — e `quemFalou` é
  //  usada para DESENHAR, e não só no clique: a tela quebraria na abertura.
  const acoesDaBolhaRef = useRef({});
  acoesDaBolhaRef.current = {
    alternarSelecao, podeSerApagada, quemFalou, nomeDeHoje, podeMexerNaNota,
    dentroDoPrazoDeEdicao, reagir, iniciarEdicao, iniciarResposta, copiarMensagem,
    marcarMensagem, reenviar, dispensarFalha, figurinhaEhFavorita,
    alternarFigurinhaFavorita,
  };
  //  Lista de dependências vazia: os embrulhos são criados na primeira vez e
  //  nunca mais. É essa permanência que faz o `memo` funcionar.
  const acoesDaBolha = useMemo(() => {
    const embrulhar = (nome) => (...args) => acoesDaBolhaRef.current[nome](...args);
    return Object.fromEntries(Object.keys(acoesDaBolhaRef.current).map((n) => [n, embrulhar(n)]));
  }, []);

  // `100dvh` e não `100vh`. No Safari do iPhone o `vh` é a altura da tela COM a
  // barra do navegador recolhida — uma altura que, na prática, quase nunca é a
  // que se tem. Resultado: os últimos ~90px do painel ficavam embaixo da barra
  // de endereço, e o que mora ali é exatamente a caixa de digitar mensagem. O
  // `dvh` acompanha a barra abrindo e fechando; o `100vh` fica de reserva para
  // navegador que ainda não conheça `dvh`.
  // A CAIXA DE ESCREVER, guardada numa variável porque ela mora em DOIS
  // lugares — e nunca nos dois ao mesmo tempo.
  //
  // Pedido do escritório: "o campo de escrever a nota deve aparecer na parte de
  // cima, ao invés de embaixo, para não confundir o usuário".
  //
  // A confusão era real e séria: a MESMA caixa, no MESMO lugar, ora mandava uma
  // mensagem para o cliente no WhatsApp, ora guardava um recado interno que só a
  // equipe lê. A única diferença era a cor. Quem estivesse com pressa — que é o
  // estado normal de quem atende — escrevia no lugar certo achando que era o
  // outro, e isso erra nas duas direções: recado da equipe indo para o cliente,
  // ou combinado com o cliente ficando só entre nós.
  //
  // Agora a nota tem lugar próprio, no ALTO, colada no cabeçalho e em âmbar; a
  // mensagem continua embaixo, onde sempre esteve. Lugares diferentes para
  // coisas diferentes — e é o lugar, não a cor, que a mão aprende.
  //
  // UMA VARIÁVEL, E NÃO DUAS CÓPIAS DO JSX: são duzentas linhas com o menu do
  // "/", os emojis, a formatação, o anexo e a gravação de áudio. Duas cópias
  // divergiriam na primeira correção, e o defeito apareceria só num dos dois
  // lugares — o tipo de coisa que leva meses para alguém notar.
  const caixaDeEscrever = (
  <>
    {/* A PÍLULA — tudo dentro de um retângulo arredondado só.
        Antes os botões ficavam SOLTOS, cada um com o seu respiro,
        ao lado de uma caixa de texto que era outra caixa: quatro
        elementos com quatro alturas e quatro cantos diferentes,
        alinhados por marginBottom escolhido no olho. Daí o
        desalinhamento.
        Agora existe um recipiente só. Os botões e o texto são
        irmãos dentro dele, centralizados pelo próprio flex, e o
        arredondamento é da pílula — não de cada peça. É assim que
        o WhatsApp Web faz, e é o que faz a barra parecer uma
        coisa só em vez de quatro. */}
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end",
                  gap: 2, borderRadius: 24, padding: "4px 6px",
                  background: modoNota ? (modo === "escuro" ? "#3a3320" : "#fff8d6") : C.balaoFundo,
                  border: modoNota ? "1px solid #e6cf6a" : "1px solid transparent",
                  boxSizing: "border-box" }}>
    {/* UM BOTÃO SÓ para emoji e figurinha, como no WhatsApp.
        Eram dois, em pontas opostas da barra, e nada dizia que
        abriam coisas parecidas. O WhatsApp resolve com uma
        carinha só e duas abas no pé do painel — quem procurava
        figurinha e achou emoji está a um toque de distância, em
        vez de ter de fechar e caçar outro ícone. */}
    {/* O EMOJI SOME NA NOTA. Pedido do escritório: nota interna não usa emoji
        nem anexo. E há um ganho junto: com dois botões a menos, o aviso do
        campo cabe numa linha no celular, e o painel encolhe.
        A figurinha, que mora no mesmo botão, sairia do WhatsApp — não teria
        como entrar numa nota de qualquer forma. */}
    {!modoNota && (
    <span ref={emojiRef} data-figurinhas style={{ display: "flex" }}>
      {emojiAberto && (
        <div style={{ position: "absolute", bottom: 60, left: 12, zIndex: 30 }}>
          {abaEmoji === "figurinha" ? (
            <PainelFigurinhas C={C} figurinhas={figurinhas} figHover={figHover}
              aoPassarMouse={setFigHover}
              aoEnviar={enviarFigurinhaUrl}
              aoRemover={(u) => alternarFigurinhaFavorita({ midia_url: u })}
              aoNova={() => figurinhaRef.current?.click()}
              rodape={<AbasDoPainel C={C} aba={abaEmoji} aoTrocar={setAbaEmoji} />} />
          ) : (
            <PainelEmoji C={C} aoEscolher={inserirEmoji}
              rodape={<AbasDoPainel C={C} aba={abaEmoji} aoTrocar={setAbaEmoji} />} />
          )}
        </div>
      )}
      <button onClick={() => { const abrir = !emojiAberto; setEmojiAberto(abrir); if (abrir) carregarFigurinhas(); }}
        title="Emojis e figurinhas" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, padding: 0 }}>
        <Smile size={24} color={emojiAberto ? C.green : C.textSecondary} />
      </button>
    </span>
    )}
    {/* BARRA DE FORMATAÇÃO — aparece ao selecionar texto na caixa.
        Fica ACIMA da caixa, e não em cima do texto selecionado:
        numa caixa de uma a três linhas as duas posições quase
        coincidem, e esta não exige medir o pixel da seleção
        dentro de um <textarea>, que só se faz desenhando uma
        cópia invisível do texto e medindo nela. */}
    {/* Vale para a NOTA INTERNA também. A primeira versão
        escondia a barra ali, por reflexo — mas a nota é desenhada
        pelo mesmo `formatarTexto` da mensagem, e negrito numa
        nota funciona exatamente igual. Era uma restrição sem
        motivo, tirando de quem escreve a nota uma coisa que já
        existia. */}
    {formatoAberto && (
      <div data-barra-formato
           style={{ position: "absolute", bottom: 58, left: 12, zIndex: 32,
                    display: "flex", alignItems: "center", gap: 2,
                    background: C.panel, border: `1px solid ${C.divider}`,
                    borderRadius: 10, padding: 4,
                    boxShadow: "0 6px 20px rgba(0,0,0,.28)" }}>
        {FORMATOS.map((f) => {
          const Icone = ICONE_DO_FORMATO[f.id];
          return (
            <button key={f.id}
              data-formato={f.id}
              aria-label={`${f.rotulo} (${f.atalho})`}
              // SEGURA O FOCO NA CAIXA. Sem isto, apertar o botão
              // tira o foco do <textarea>, a seleção se perde, e
              // o clique formata o nada — o defeito clássico de
              // toda barra flutuante.
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => formatarSelecao(f.id)}
              onMouseEnter={() => setFormatoHover(f.id)}
              onMouseLeave={() => setFormatoHover((h) => (h === f.id ? null : h))}
              style={{ position: "relative", border: "none", background: formatoHover === f.id ? C.listActive : "transparent",
                       cursor: "pointer", borderRadius: 7, width: 34, height: 34,
                       display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <Icone size={17} color={C.textPrimary} />
              {/* A LEGENDA COM O ATALHO, como no WhatsApp Web. Não
                  é o `title` do navegador de propósito: ali a
                  legenda demora um segundo a aparecer e sai com a
                  cara do sistema, clara no tema escuro. E é aqui
                  que o atalho fica escrito — é assim que alguém
                  descobre que ele existe. */}
              {formatoHover === f.id && (
                <span style={{ position: "absolute", bottom: "calc(100% + 7px)", left: "50%",
                               transform: "translateX(-50%)", whiteSpace: "nowrap",
                               background: C.headerBar, color: C.textPrimary,
                               border: `1px solid ${C.divider}`, borderRadius: 7,
                               padding: "5px 9px", fontSize: 12, pointerEvents: "none",
                               boxShadow: "0 4px 14px rgba(0,0,0,.3)" }}>
                  {f.rotulo}
                  <span style={{ color: C.textSecondary, marginLeft: 8 }}>{f.atalho}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    )}
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
    {/* ALTERNAR PARA NOTA INTERNA (o recado que não vai ao WhatsApp).
        O botão fica aqui, junto do emoji e do anexo, que é onde a mão do
        escritório já sabe procurá-lo. O que mudou não foi ELE: foi para onde a
        caixa vai quando ele é apertado — ela abre no ALTO da conversa, longe
        da caixa de mensagem, e é essa distância que desfaz a confusão entre
        "escrevi para o cliente" e "anotei para a equipe".
        `aria-pressed` porque o botão tem DOIS estados e eles não podem ser
        adivinhados pelo texto do título: foi assim que um ajudante de prova
        passou a desligar o modo achando que ligava. */}
    <button data-nota-interna onClick={() => setModoNota((v) => !v)}
            aria-pressed={modoNota}
            title={modoNota ? "Voltar para a mensagem" : "Escrever nota interna (só a equipe vê)"}
            style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, padding: 0 }}>
      <StickyNote size={22} color={modoNota ? "#d4a017" : C.textSecondary} />
    </button>
    {/* O CLIPE SOME NA NOTA. Ver `abrirAnexos`: a nota é só texto, e o
        arquivo anexado ali ia para o CLIENTE. O botão fora da vista é
        metade do conserto; a outra metade está lá, fechando também o
        arrastar e o colar. */}
    {!modoNota && (
    <button onClick={() => fileRef.current?.click()} title="Anexar arquivo" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, padding: 0 }}>
      <Paperclip size={22} color={C.textSecondary} />
    </button>
    )}
    <input ref={fileRef} type="file" multiple onChange={aoEscolherArquivo} style={{ display: "none" }} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" />
    <input ref={figurinhaRef} type="file" accept="image/webp,image/png,image/jpeg" style={{ display: "none" }}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setEmojiAberto(false); enviarArquivo(f, "", conversaId, "figurinha"); } }} />
      {/*
          O QUE ESTA CAIXA É, DITO POR ATRIBUTO E NÃO POR TEXTO.

          Quem precisa achá-la — as provas, e um dia um leitor de tela —
          procurava pelo AVISO dentro dela ("nota interna"). No celular o aviso
          ficou curto, e o acordo se desfez em silêncio: a caixa continuava lá e
          ninguém mais a achava. É a segunda vez hoje que um seletor amarrado à
          redação de uma frase quebra ao melhorarem a frase.
      */}
    <textarea
      ref={inputRef}
      data-campo={modoNota ? "nota" : "mensagem"}
      value={rascunho}
      onChange={(e) => { setRascunho(e.target.value); setSlashIdx(0); }}
      onSelect={(e) => {
        // Aparece quando há trecho selecionado, some quando não
        // há. `onSelect` é o único evento que o navegador dispara
        // para TODA mudança de seleção — mouse, teclado, duplo
        // clique, Ctrl+A. Escutar só o mouse deixaria a barra
        // fora do alcance de quem seleciona com Shift+seta.
        const c = e.target;
        setFormatoAberto(c.selectionStart !== c.selectionEnd);
      }}
      onBlur={() => {
        // Sai da caixa, some a barra. Os botões dela seguram o
        // foco (ver o `onMouseDown` lá embaixo), então clicar num
        // deles não passa por aqui.
        setFormatoAberto(false);
      }}
      onKeyDown={(e) => {
        // OS ATALHOS DE FORMATAÇÃO, antes de tudo.
        //
        // Vêm primeiro porque nenhum deles usa Enter: não há como
        // atropelar o envio nem o menu do "/". E `preventDefault`
        // é obrigatório — Ctrl+B é "favoritos" no navegador e
        // Ctrl+I é "informações da página".
        const formato = formatoDaTecla(e);
        if (formato) {
          e.preventDefault();
          formatarSelecao(formato);
          return;
        }
        // ALT+ENTER TAMBÉM PULA LINHA.
        //
        // O Shift+Enter o navegador resolve sozinho — a quebra é
        // o comportamento padrão dele numa caixa de texto. O
        // Alt+Enter não faz nada por padrão, então a quebra tem
        // de ser inserida na mão. Quem vem do Outlook e do Excel
        // tem o Alt+Enter no dedo, e ali ele significa
        // exatamente isto.
        //
        // Vem ANTES do menu do "/" de propósito: com o menu
        // aberto, o Shift+Enter já quebra a linha em vez de
        // escolher um item, e as duas teclas precisam significar
        // a mesma coisa em toda situação.
        if (e.key === "Enter" && e.altKey) {
          e.preventDefault();
          const campo = e.target;
          // insertText preserva o "desfazer" do navegador e deixa
          // o cursor depois da quebra. O caminho manual existe
          // para o navegador que não tiver o comando: sem ele o
          // cursor saltaria para o fim do texto a cada quebra.
          const ok = typeof document.execCommand === "function"
            && document.execCommand("insertText", false, "\n");
          if (!ok) {
            const ini = campo.selectionStart;
            const fim = campo.selectionEnd;
            setRascunho(campo.value.slice(0, ini) + "\n" + campo.value.slice(fim));
            requestAnimationFrame(() => {
              campo.selectionStart = ini + 1;
              campo.selectionEnd = ini + 1;
            });
          }
          return;
        }
        // Menu do "/": navega com as setas e escolhe com Enter.
        if (slashAberto) {
          if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => Math.min(slashLista.length - 1, i + 1)); return; }
          if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => Math.max(0, i - 1)); return; }
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); escolherSlash(slashLista[Math.min(slashIdx, slashLista.length - 1)]); return; }
          if (e.key === "Escape") { e.preventDefault(); setRascunho(""); return; }
        }
        // Enter envia; Shift+Enter e Alt+Enter pulam linha.
        if (e.key === "Enter" && !e.shiftKey && !e.altKey) { e.preventDefault(); enviar(); }
      }}
      rows={1}
      placeholder={editando ? (editando.origem === "nota"
                                ? (estreito ? "Corrija a nota" : "Corrija a nota interna e aperte Enter")
                                : "Corrija a mensagem e aperte Enter")
                      // NO CELULAR O AVISO É CURTO, e nao por preguica: a frase
                      // inteira quebra em tres linhas numa tela de 320px e empurra
                      // a conversa para fora da vista. A moldura ambar e o icone
                      // aceso ja dizem que aquilo e uma nota; o campo so precisa
                      // nomear o que se escreve nele.
                      : (modoNota ? (estreito ? "Nota interna" : "Escreva uma nota interna (só a equipe vê)")
                                  : "Digite uma mensagem")}
      style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: C.textPrimary, boxSizing: "border-box", padding: "10px 6px", fontSize: 14.5, resize: "none", lineHeight: "20px", maxHeight: 120, overflowY: "auto", fontFamily: "inherit", alignSelf: "flex-end" }}
    />
    {(rascunho.trim() || modoNota) ? (
      <button onClick={enviar} title={modoNota ? "Salvar nota" : "Enviar"} style={{ border: "none", background: modoNota ? "#d4a017" : C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, alignSelf: "flex-end" }}>{modoNota ? <StickyNote size={19} color="#fff" /> : <Send size={20} color="#fff" />}</button>
    ) : (
      <button onClick={iniciarGravacao} title="Gravar áudio" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, padding: 0 }}>
        <Mic size={24} color={C.textSecondary} />
      </button>
    )}
    </div>
  </>
  );

  // VINCULAR A NOTA A UM PROCESSO. Sobe junto com a caixa: pertence à nota, e
  // deixá-la embaixo separaria a escolha do texto que ela governa.
  //
  // SEM MOLDURA PRÓPRIA: isto é o conteúdo da ESQUERDA da linha de cima do
  // painel, e o X de fechar mora na direita da mesma linha. A linha é montada
  // pelo painel, e não aqui, porque ela existe MESMO QUANDO NÃO HÁ PROCESSO —
  // a maior parte dos contatos é lead sem cadastro no Vantoro, e se a linha só
  // nascesse junto com o seletor o X sumiria justamente para eles.
  const barraDoProcessoDaNota = modoNota && !selecao && clienteDaConversa
    && (processosDoCliente.length > 0 || buscandoProcessos) && (() => {
  const escuro = modo === "escuro";
  const AMBAR = "#d4a017";
  const temProcesso = Boolean(processoDaNota);
  return (
  <div data-processo-da-nota
       style={{ flex: 1, minWidth: 0,
                display: "flex", alignItems: "center",
                gap: estreito ? 7 : 10, flexWrap: "wrap" }}>
    <span style={{ fontSize: 12.5, fontWeight: 700, color: AMBAR,
                   display: "inline-flex", alignItems: "center", gap: 6,
                   whiteSpace: "nowrap" }}>
      <ClipboardList size={15} />
      {/* NO CELULAR, SÓ O ÍCONE. A palavra "Processo:" custa uns 70px numa
          tela de 360, e é justamente ela que empurrava o seletor para a
          linha de baixo. Ela também não acrescenta nada: a primeira opção
          do próprio seletor diz "Nota geral do cliente (sem processo)", e
          a prancheta ao lado já é o desenho de um processo. */}
      {!estreito && "Vincular a um processo:"}
    </span>
    {buscandoProcessos ? (
      <span style={{ fontSize: 12.5, color: escuro ? "#c9bd93" : "#8a7434" }}>
        procurando os processos deste cliente…
      </span>
    ) : (<>
      <select value={processoDaNota}
              onChange={(e) => setProcessoDaNota(e.target.value)}
              style={{ // `flex-basis` de 240px era o que quebrava a linha: o seletor PEDIA
                                   // 240 onde só havia 221 de sobra, e o navegador o mandava
                                   // para baixo. No celular ele passa a aceitar o que houver.
                                   flex: estreito ? "1 1 0" : "1 1 240px", minWidth: 0, maxWidth: 460,
                       // ESCOLHIDO x NOTA GERAL, à distância: cheio de
                       // âmbar num caso, claro no outro. Só a letra
                       // dentro do seletor obrigaria a ler para saber.
                       background: temProcesso ? AMBAR : (escuro ? "#2a2517" : "#fffdf2"),
                       color: temProcesso ? "#fff" : (escuro ? "#f0e6c8" : "#3b3118"),
                       fontWeight: temProcesso ? 700 : 500,
                       border: `2px solid ${temProcesso ? AMBAR : (escuro ? "#7a6832" : "#e6cf6a")}`,
                       borderRadius: 8, padding: "6px 9px", fontSize: 12.5,
                       cursor: "pointer" }}>
        {/* A NOTA GERAL VEM PRIMEIRO e escrita por extenso. "—" ou
            vazio deixaria a pessoa sem saber se escolher nada é
            permitido; escrito, ela sabe que é uma opção legítima. */}
        <option value="">Nota geral do cliente (sem processo)</option>
        {processosDoCliente.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {rotuloDoProcesso(p)}
          </option>
        ))}
      </select>
      {/* O RECADO CURTO AO LADO. Diz o que vai acontecer com ESTA
          nota — não é enfeite, é a única frase que confirma a
          escolha sem obrigar a reabrir a lista. */}
      <span data-aviso-do-processo
            style={{ fontSize: 11.5, fontWeight: temProcesso ? 700 : 500,
                     color: temProcesso ? AMBAR : (escuro ? "#a99a6d" : "#8a7434"),
                     whiteSpace: "nowrap" }}>
        {/* CURTO NO CELULAR pelo mesmo motivo do rótulo. O que a frase longa
            informa — que a nota vai para o histórico daquela ação — já está
            dito pelo nome do processo escolhido dentro do seletor. */}
        {temProcesso ? (estreito ? "✓ no processo" : "✓ entra no histórico deste processo")
                     : "opcional"}
      </span>
    </>)}
  </div>
  );
  })();

  return (
    <div style={{ display: "flex", height: "100vh", maxHeight: "100dvh", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", background: C.headerBar, color: C.textPrimary }}>
      {/* Contorno de foco só para quem navega por teclado (acessibilidade),
          sem "caixa azul" para quem usa o mouse. */}
      <style>{`
        *:focus { outline: none; }
        *:focus-visible { outline: 2px solid ${C.green}; outline-offset: 2px; border-radius: 4px; }

        /* NO CELULAR, NADA MENOR DO QUE 40 PONTOS DE ALTURA.
           A varredura a 390 pontos achou dezenas de coisas para tocar com 27,
           30, 32 e 36: as pílulas de filtro, as abas das Configurações, os
           campos dos Departamentos, o "Fechar" de cada painel. Cada uma dessas
           é um toque que erra — e errar num painel de administração é abrir
           outra aba sem entender por quê.
           Uma regra só, e no lugar onde o navegador já sabe qual é a tela: 40
           é o mínimo que a Apple recomenda. Cresce em ALTURA, que é para onde
           a tela do celular tem espaço de sobra; nada aqui mexe em largura,
           porque é a largura que falta.
           O "important" é necessário e não é preguiça: quase toda altura
           pequena está escrita na própria etiqueta (style={{ minHeight: 32 }}),
           e estilo escrito ali vence folha de estilo sempre. Sem ele, a regra
           não encostaria justamente nos casos que existem. A alternativa seria
           caçar as três dezenas de lugares em cinco arquivos e pôr um
           "estreito ? 40 : 32" em cada um — trinta chances de esquecer um, e
           mais trinta a cada tela nova.
           A marca data-compacto é a saída para quando alguma fileira precisar
           desobedecer. Hoje ninguém usa, e é de propósito que a exceção exista
           escrita em vez de aparecer como um "important" solto mais adiante. */
        @media (max-width: 767px) {
          button, [role="button"], select,
          input:not([type="file"]):not([type="checkbox"]):not([type="radio"]),
          textarea { min-height: 40px !important; }
          /* E O BOTÃO QUE É SÓ UM DESENHO precisa dos 40 na LARGURA também.
             Ele não tem palavra dentro para esticá-lo: sobrou o ícone de 16
             pontos mais um respiro, e deu 30. São as setas de mês do Painel, o
             X que fecha os Departamentos, a câmera que troca a foto. Só estes
             ganham largura — um botão com texto já é largo, e forçar largura
             onde o que falta é largura seria trocar um defeito por outro. */
          button:has(> svg:only-child) { min-width: 40px !important; }
          [data-compacto], [data-compacto] button, [data-compacto] input { min-height: 0 !important; }
          [data-compacto] button:has(> svg:only-child) { min-width: 0 !important; }
        }
        .sem-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .sem-scrollbar::-webkit-scrollbar { display: none; }

        /* AS BARRAS DE ROLAGEM.
           A padrão do Chrome no Windows é larga e clara: no tema escuro ela
           vira uma faixa branca colada na lista de conversas e na conversa,
           mais visível do que o conteúdo. O WhatsApp Web usa uma barra fina e
           quase transparente, que aparece de leve e some no fundo.
           Aqui a cor é derivada do próprio tema (a mesma linha divisória), e
           não uma escolha à parte que descolaria na próxima troca de cores.
           Regra dupla porque os navegadores discordam: Firefox entende
           scrollbar-width/scrollbar-color, Chrome e Safari usam ::-webkit. */
        * { scrollbar-width: thin; scrollbar-color: ${C.scrollbar} transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.scrollbar}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.scrollbarForte}; }
        ::-webkit-scrollbar-corner { background: transparent; }

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
                data-telefone={a.nome}
                title={`${a.nome}${n > 0 ? ` — ${n} não lida${n > 1 ? "s" : ""}` : ""}`}
                style={{ position: "relative", border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "flex", borderRadius: "50%", flexShrink: 0, boxShadow: atual ? `0 0 0 2px ${C.green}` : "none", opacity: atual ? 1 : 0.7, transition: "opacity .12s" }}
              >
                <Avatar nome={a.nome} foto={a.foto_url} size={42} />
                {n > 0 && (
                  /* A MARCA LEVA O NÚMERO REAL, e não o que está escrito: acima
                     de 99 a bolinha mostra "99+", que é certo para o olho e
                     inútil para conferir. Sem isto, uma prova sobre contagem
                     mediria o texto truncado. */
                  <span data-selo-nao-lidas={n} style={{ position: "absolute", top: -4, right: -4, minWidth: 19, height: 19, padding: "0 5px", borderRadius: 10, background: "#d92b20", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.rail}`, boxSizing: "border-box" }}>
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
                      minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center",
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
      <div style={{ position: "relative", width: estreito ? "auto" : 380, flex: estreito ? 1 : "none", minWidth: 0, borderRight: `1px solid ${C.divider}`, display: ((estreito && conversaId) || fichaAberta || historico) ? "none" : "flex", flexDirection: "column", background: C.panel }}>
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
                  {(() => {
                    const q = buscaContato.trim().toLowerCase();
                    const qDig = q.replace(/\D/g, ""); // só os dígitos (para busca por número)
                    // Busca por nome OU por número. O número só entra no filtro se
                    // a pessoa digitou algum dígito — senão "inclui vazio" daria
                    // verdadeiro para todos e a busca por nome nunca filtrava.
                    const chaveQ = chaveDoNumero(qDig);
                    const lista = contatosLista.filter((c) => (c.nome || "").toLowerCase().includes(q)
                      || (chaveQ.length >= 4 && chaveDoNumero(c.numero).includes(chaveQ)));
                    const doVantoro = linhasDoVantoro(lista);
                    // Houve consulta ao Vantoro e ela voltou sem nada. Dizer
                    // isso importa: sem a frase, "não achei no Vantoro" e "nem
                    // cheguei a perguntar" são a mesma tela em branco, e não há
                    // como saber se o cadastro está errado ou o sistema.
                    const vantoroVazio = buscaContato.trim().length >= 3
                      && !vantoroBuscando && !vantoroErro && !doVantoro.length;
                    const TITULO = { padding: "10px 16px 4px", fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 };
                    const RECADO = { padding: "14px 16px", textAlign: "center", color: C.textSecondary, fontSize: 13.5 };
                    const LINHA = { display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", color: C.textPrimary };
                    const realce = (e, ligado) => { e.currentTarget.style.background = ligado ? C.divider : "transparent"; };
                    return (
                      <>
                        <div style={TITULO}>CONTATOS</div>
                        {lista.length ? lista.map((c) => (
                          // `data-contato-agenda` é a alça da prova. A agenda é a
                          // porta por onde nasce a conversa vazia do relato, e até
                          // aqui não havia como alcançá-la a não ser procurando
                          // texto na tela — que casa com a lista de conversas atrás
                          // do diálogo e clica na linha errada.
                          <div key={c.id} data-contato-agenda={c.id} role="button" onClick={() => abrirConversaContato(c)} style={LINHA} onMouseEnter={(e) => realce(e, true)} onMouseLeave={(e) => realce(e, false)}>
                            <Avatar nome={c.nome || c.numero} foto={c.foto_url} size={44} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDoContato(c)}</div>
                              <div style={{ fontSize: 12.5, color: C.textSecondary }}>+{c.numero}</div>
                            </div>
                          </div>
                        )) : (
                          <div style={RECADO}>{contatosLista.length ? "Nenhum contato salvo com esse nome." : "Nenhum contato salvo ainda."}</div>
                        )}
                        {/* O CADASTRO DO VANTORO. Só aparece quando há o que
                            mostrar: uma seção vazia em toda busca ensinaria a
                            equipe a ignorar justamente a parte nova da tela. */}
                        {(doVantoro.length > 0 || vantoroBuscando || vantoroErro || (vantoroVazio && !lista.length)) && (
                          <>
                            <div style={{ ...TITULO, paddingTop: 16 }}>PESSOAS DO VANTORO</div>
                            {!doVantoro.length && vantoroBuscando && <div style={RECADO}>Procurando no Vantoro…</div>}
                            {!doVantoro.length && !vantoroBuscando && vantoroErro && <div style={RECADO}>{vantoroErro}</div>}
                            {vantoroVazio && !lista.length && <div style={RECADO}>Nenhuma pessoa com esse nome no Vantoro.</div>}
                            {doVantoro.map((l) => (
                              <div key={l.chave} role="button" onClick={() => conversarComClienteVantoro(l)} style={LINHA} onMouseEnter={(e) => realce(e, true)} onMouseLeave={(e) => realce(e, false)}>
                                <Avatar nome={l.nome} size={44} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</div>
                                  <div style={{ fontSize: 12.5, color: C.textSecondary }}>+{l.numero}{l.segundo ? " · segundo telefone" : ""}</div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    );
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
            {/* QUEM PARTICIPOU — o filtro por atendente.
                Ele era uma pílula na fita junto de "Tudo / Não lidas /
                Favoritas / Etiquetas", e ali estava fora de lugar por duas
                razões. A fita responde "que conversas mostrar" pelo estado
                delas; esta pergunta é sobre PESSOAS, e é a única da fita que
                abre um menu com dois modos e uma lista dentro. E era a quinta
                pílula de uma linha que já quebrava em duas.

                Aqui em cima ele fica ao lado das outras duas coisas que se faz
                na coluna — abrir conversa nova e abrir o menu — e a fita volta
                a ter só filtros de conversa, numa linha só.

                Ícone sem rótulo porque é a vizinhança em que está: os três
                botões desta linha são ícones. O que ele perde em nome ganha em
                `title` e no rastro que aparece na fita quando está ligado. */}
            {advogadoId && filtroQuemOk && (
            <span ref={quemRef} style={{ position: "relative", display: "flex" }}>
              <button data-grupo="quem" onClick={() => setMenuQuem((v) => !v)}
                      aria-label="Filtrar por quem participou" aria-expanded={menuQuem}
                      title={quemFiltra.length ? "Filtrando por quem participou da conversa" : "Filtrar por quem participou da conversa"}
                      style={{ ...BOTAO_ICONE, padding: 9,
                               background: quemFiltra.length ? C.greenDark : "transparent",
                               color: quemFiltra.length ? "#fff" : C.textSecondary }}>
                <Users size={19} />
              </button>
              {menuQuem && (
                <div style={{ position: "absolute", top: 38, right: 0, zIndex: 50, width: 272, maxHeight: 380, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
                  {/* O TÍTULO ficou necessário quando o botão virou só um
                      desenho: sem rótulo na tela, é aqui que o menu diz o que
                      ele é. */}
                  <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${C.divider}` }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>
                      Quem participou da conversa
                    </div>
                    {/* PRIMEIRO A REGRA, DEPOIS OS NOMES. Marcando duas pessoas
                        sem saber qual das duas contas está valendo, o resultado
                        parece aleatório — e a diferença entre "ou" e "e" é
                        justamente o que este filtro tem de mais útil. */}
                    <div style={{ display: "flex", gap: 6 }}>
                      {[["qualquer", "Qualquer um"], ["todos", "Todos juntos"]].map(([k, r]) => (
                        <button key={k} onClick={() => setModoQuem(k)}
                                style={{ flex: 1, minHeight: 30, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                                         border: `1px solid ${modoQuem === k ? C.greenDark : C.divider}`,
                                         background: modoQuem === k ? C.greenDark : "transparent",
                                         color: modoQuem === k ? "#fff" : C.textSecondary }}>{r}</button>
                      ))}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11.5, color: C.textSecondary, lineHeight: 1.4 }}>
                      {modoQuem === "todos"
                        ? "Conversas em que TODAS as pessoas marcadas falaram, na mesma conversa."
                        : "Conversas em que pelo menos UMA das pessoas marcadas falou."}
                    </div>
                  </div>

                  {/* NINGUÉM ESCREVEU AINDA é resposta, não é erro. Antes o
                      botão sumia neste caso, e sumir não explica nada. */}
                  {atendentes.length === 0 && (
                    <div style={{ padding: "14px 12px", fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>
                      Ninguém do escritório escreveu por este número ainda — só há
                      mensagens recebidas. Quando alguém responder daqui, o nome
                      aparece nesta lista.
                    </div>
                  )}

                  {atendentes.map((a) => {
                    const marcado = quemFiltra.includes(a.id);
                    return (
                      <button key={a.id} data-quem={a.nome}
                              onClick={() => setQuemFiltra((atual) =>
                                marcado ? atual.filter((x) => x !== a.id) : [...atual, a.id])}
                              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                       border: `1.5px solid ${marcado ? C.green : C.divider}`, background: marcado ? C.green : "transparent" }}>
                          {marcado && <Check size={12} color="#fff" />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                        {/* Quantas conversas cada um tem: responde "quanto vou ver
                            se marcar este?" antes de marcar. Zero também é
                            resposta — é o "não participei de nenhuma aqui". */}
                        <span style={{ flexShrink: 0, fontSize: 11.5, color: C.textSecondary, fontVariantNumeric: "tabular-nums" }}>{a.conversas}</span>
                      </button>
                    );
                  })}

                  {quemFiltra.length > 0 && (
                    <button onClick={() => { setQuemFiltra([]); setMenuQuem(false); }}
                            style={{ width: "100%", padding: "10px 12px", border: "none", borderTop: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.verdeTexto, fontSize: 13, fontWeight: 600, textAlign: "left" }}>
                      Limpar a escolha
                    </button>
                  )}
                </div>
              )}
            </span>
            )}
            {/* Menu ⋮ do topo, estilo WhatsApp Web */}
            <span ref={menuTopoRef} style={{ position: "relative", display: "flex" }}>
              <button onClick={() => setMenuTopoAberto((v) => !v)} aria-label="Menu" title="Menu" style={{ ...BOTAO_ICONE, color: C.textSecondary }}>
                <MoreVertical size={20} />
              </button>
              {menuTopoAberto && (
                <div style={{ position: "absolute", top: 26, right: 0, width: 230, background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.28)", zIndex: 50, overflow: "hidden" }}>
                  <button onClick={marcarTodasLidas} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><CheckCheck size={17} color={C.textSecondary} /> Marcar todas como lidas</button>
                  <button onClick={() => { setMenuTopoAberto(false); abrirConfig(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><Settings size={17} color={C.textSecondary} /> Configurações</button>
                  {/* O PAINEL É DE TODO MUNDO.
                      Ele ficava só com quem administra por um motivo real: o
                      total do escritório visto por quem alcança poucos
                      telefones é um total pela metade, e quem o lê o toma pelo
                      total. O que mudou não foi a permissão — foi a tela: agora
                      quem não administra vê os PRÓPRIOS números, que são
                      inteiros, e o recorte é feito no banco (`painel_dashboard`
                      ignora o "quem" que o navegador manda quando quem chama
                      não é administrador). */}
                  <button onClick={() => { setMenuTopoAberto(false); setTelaPainel(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><BarChart3 size={17} color={C.textSecondary} /> Painel</button>
                  {/* Quem administra no Vantoro administra aqui. Esconder o botão
                      é cortesia, não segurança: quem não é admin esbarra nas
                      regras do banco de qualquer forma. */}
                  {souAdmin && (
                    <button onClick={() => { setMenuTopoAberto(false); setTelaAdmin(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><ShieldCheck size={17} color={C.textSecondary} /> Departamentos e acessos</button>
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
          {/* O DEPARTAMENTO ERA UMA FITA QUE ROLAVA DE LADO.
              Com oito departamentos, medido nesta tela: TRÊS apareciam e cinco
              ficavam fora, atrás de 485px de rolagem horizontal — e não melhora
              numa janela maior, porque esta coluna tem largura fixa. Quem não
              soubesse arrastar para o lado não descobria que existiam.

              Agora é um botão só, que diz onde você está, e abre a lista
              inteira: nome, cor, quantos números e quantas não lidas de cada
              um. A lista rola PARA BAIXO, que é a direção que todo mundo já
              sabe que rola. Com busca quando passam de seis. */}
          {departamentosVisiveis.length > 1 && (
            <div ref={departamentosRef} style={{ position: "relative", marginBottom: 10 }}>
              <button onClick={() => setMenuDepartamentos((v) => !v)}
                      aria-expanded={menuDepartamentos} aria-haspopup="listbox"
                      title="Trocar de departamento"
                      style={{ width: "100%", minHeight: 38, display: "flex", alignItems: "center", gap: 9,
                               border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                               borderRadius: 9, padding: "7px 11px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                               background: (departamentoAtual && departamentoAtual.cor) || C.textSecondary }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 600 }}>
                  {departamentoAtual ? departamentoAtual.nome : "Escolha um departamento"}
                </span>
                <span style={{ flexShrink: 0, fontSize: 11.5, color: C.textSecondary }}>
                  {departamentosVisiveis.length} deptos.
                </span>
                <ChevronDown size={16} color={C.textSecondary} style={{ flexShrink: 0, transform: menuDepartamentos ? "rotate(180deg)" : "none", transition: "transform .12s" }} />
              </button>
              {menuDepartamentos && (
                <div role="listbox" style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 60,
                                             background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                                             boxShadow: "0 8px 24px rgba(0,0,0,.32)", overflow: "hidden" }}>
                  {/* A busca só entra quando a lista fica longa. Com quatro
                      departamentos, um campo de busca é mais trabalho do que
                      correr o olho. */}
                  {departamentosVisiveis.length > 6 && (
                    <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.divider}` }}>
                      <input autoFocus value={buscaDepartamento} onChange={(e) => setBuscaDepartamento(e.target.value)}
                             placeholder="Buscar departamento"
                             /* `border-box` porque o recheio entra na largura:
                                sem isto o campo ficava 100% + 20px e escapava
                                para fora do painel. */
                             style={{ width: "100%", boxSizing: "border-box", border: "none", outline: "none",
                                      background: C.searchBg, color: C.textPrimary,
                                      borderRadius: 7, padding: "7px 10px", fontSize: 13 }} />
                    </div>
                  )}
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {departamentosParaEscolher.length === 0 && (
                      <div style={{ padding: 16, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>Nenhum departamento com esse nome.</div>
                    )}
                    {departamentosParaEscolher.map((d) => {
                      const ativo = departamentoId === d.id;
                      const fones = advogadosPermitidos.filter((a) => a.departamento_id === d.id);
                      const naoLidas = fones.reduce((soma, a) => soma + naoLidasDoAdvogado(a.id), 0);
                      return (
                        <button key={d.id} role="option" aria-selected={ativo}
                          onClick={() => { setMenuDepartamentos(false); setBuscaDepartamento(""); trocarDepartamento(d.id); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, minHeight: 46,
                                   padding: "9px 12px", border: "none", borderLeft: `3px solid ${ativo ? C.greenDark : "transparent"}`,
                                   background: ativo ? C.headerBar : "transparent", color: C.textPrimary,
                                   cursor: "pointer", textAlign: "left" }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: d.cor || C.textSecondary }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13.5, fontWeight: ativo ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</span>
                            <span style={{ display: "block", fontSize: 11.5, color: C.textSecondary }}>
                              {fones.length} {fones.length === 1 ? "número" : "números"}
                            </span>
                          </span>
                          {naoLidas > 0 && (
                            <span style={{ flexShrink: 0, minWidth: 20, height: 20, borderRadius: 10, background: C.green, color: "#fff",
                                           fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{naoLidas}</span>
                          )}
                          {ativo && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Sem telefone escolhido não há "atendendo como": o traço solto
              embaixo do rótulo parecia dado faltando, e não escolha pendente. */}
          <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600, letterSpacing: 0.3 }}>
            {advogado ? "ATENDENDO COMO" : "ESCOLHA UM NÚMERO ABAIXO"}
          </div>
          {advogado && (<>
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
          </>)}
        </div>

        {/* Buscar e filtrar uma lista que ainda não existe é oferecer botão que
            não faz nada. Só aparecem com um telefone escolhido. */}
        {advogadoId && (<>
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
              <button key={k} data-aba={k} onClick={() => setFiltro(k)} style={{ flexShrink: 0, minHeight: 32, border: `1px solid ${ativo ? C.greenDark : C.divider}`, background: ativo ? C.greenDark : "transparent", color: ativo ? "#fff" : C.textSecondary, borderRadius: 20, padding: "5px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
            );
          })}
          {/* A ORDEM DA LISTA.
              Fica aqui, ao lado dos outros filtros, porque é o mesmo tipo de
              coisa: muda o que a lista mostra e precisa dizer, sem ser
              perguntado, qual regra está valendo. Um botão que só troca e não
              conta em que estado está transforma "achei estranho" em "está
              quebrado".
              Por isso a pílula ESCREVE a ordem em vez de ser só uma setinha —
              e fica verde quando não é a de sempre, igual às outras. */}
          <span ref={ordemMenuRef} style={{ position: "relative", display: "flex", flexShrink: 0 }}>
            <button data-ordem onClick={() => setMenuOrdem((v) => !v)}
                    aria-expanded={menuOrdem}
                    title="Em que ordem a lista aparece"
                    style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 32,
                             border: `1px solid ${ordem === "antigas" ? C.greenDark : C.divider}`,
                             background: ordem === "antigas" ? C.greenDark : "transparent",
                             color: ordem === "antigas" ? "#fff" : C.textSecondary,
                             borderRadius: 20, padding: "5px 11px", fontSize: 12.5, fontWeight: 600,
                             cursor: "pointer", whiteSpace: "nowrap" }}>
              <ArrowDownUp size={13} />
              {ordem === "antigas" ? "Mais antigas" : "Mais recentes"}
              <ChevronDown size={13} style={{ opacity: 0.8 }} />
            </button>
            {menuOrdem && (
              <div data-menu-ordem
                   style={{ position: "absolute", top: 38, left: 0, zIndex: 46, width: 244,
                            background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                            boxShadow: "0 6px 20px rgba(0,0,0,.25)", overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.divider}`,
                              fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>
                  ORDEM DA LISTA
                </div>
                {[["recentes", "Mais recentes primeiro", "Quem falou por último aparece no alto. É a ordem de sempre."],
                  ["antigas", "Mais antigas primeiro", "Quem está esperando há mais tempo aparece no alto."]]
                  .map(([chave, titulo, explica]) => (
                  <button key={chave} data-ordem-opcao={chave}
                          onClick={() => { setOrdem(chave); setMenuOrdem(false); }}
                          style={{ ...ITEM_DO_MENU, alignItems: "flex-start", color: C.textPrimary,
                                   background: ordem === chave ? C.listActive : "transparent" }}>
                    <Check size={16} color={ordem === chave ? C.green : "transparent"}
                           style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ display: "block" }}>
                      {titulo}
                      {/* A FRASE EMBAIXO existe porque "mais antigas" é ambíguo
                          para quem lê rápido: antiga é a conversa que começou
                          faz tempo, ou a que ninguém responde faz tempo? São a
                          mesma coisa aqui, e dizer qual das duas evita a
                          pergunta. */}
                      <span style={{ display: "block", fontSize: 11.5, fontWeight: 400,
                                     color: C.textSecondary, marginTop: 2, whiteSpace: "normal" }}>
                        {explica}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </span>

          {/* O RASTRO DO FILTRO DE ATENDENTES.
              O botão em si subiu para o topo da coluna, ao lado de "Nova
              conversa" e do menu. Mas filtro ligado longe da lista é a receita
              da lista misteriosamente curta: somem conversas e não há nada na
              tela dizendo por quê — foi exatamente o que a pílula das etiquetas
              resolveu mostrando a cor e o nome da etiqueta escolhida.
              Então, LIGADO, ele deixa esta marca aqui: quem está marcado, qual
              das duas regras está valendo, e o × que desliga sem precisar
              procurar o menu de volta. Desligado não ocupa nada.

              O `maxWidth` não é enfeite: sem teto o rastro crescia com o nome,
              a fita quebrava numa TERCEIRA linha e as etiquetas iam parar lá
              embaixo. Com o teto, o nome encolhe com reticências e a fita
              volta a caber em duas linhas. */}
          {quemFiltra.length > 0 && (
            <span data-filtro-quem style={{ display: "flex", alignItems: "center", minWidth: 0, maxWidth: 236,
                                            border: `1px solid ${C.greenDark}`, background: C.greenDark, color: "#fff",
                                            borderRadius: 20, minHeight: 32, overflow: "hidden" }}>
              <button onClick={() => setMenuQuem(true)}
                      title={`Conversas em que ${modoQuem === "todos" ? "TODAS estas pessoas falaram, na mesma conversa" : "pelo menos uma destas pessoas falou"}: ${nomesQuemFiltra.join(", ")}`}
                      style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, border: "none", background: "transparent",
                               color: "#fff", padding: "5px 4px 5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                <Users size={13} style={{ flexShrink: 0 }} />
                {/* O NOME encolhe com reticências; o "+1" e a regra NÃO.
                    Encolhendo tudo junto, "Rodrigo Sousa +1" virava "Rodrigo
                    Sou…" e sumia justamente a informação de que havia mais
                    alguém marcado — o nome cortado ainda se reconhece, o "+1"
                    cortado vira uma informação a menos. */}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nomesQuemFiltra[0] || "1 pessoa"}
                </span>
                {nomesQuemFiltra.length > 1 && (
                  <span style={{ flexShrink: 0 }}>+{nomesQuemFiltra.length - 1}</span>
                )}
                {/* A REGRA aparece só quando é "todos juntos": é a estreita, a
                    que faz a lista encolher de um jeito que surpreende. A outra
                    é o comportamento que se espera de marcar dois nomes, e
                    escrever "qualquer um" ali roubava metade da pílula para
                    dizer o óbvio. Nos dois casos a frase inteira está no
                    `title` e dentro do menu. */}
                {nomesQuemFiltra.length > 1 && modoQuem === "todos" && (
                  <span style={{ flexShrink: 0, opacity: .85, fontWeight: 500 }}>· juntos</span>
                )}
              </button>
              <button onClick={() => setQuemFiltra([])} aria-label="Tirar o filtro de quem participou"
                      title="Tirar este filtro"
                      style={{ display: "flex", alignItems: "center", border: "none", background: "transparent",
                               color: "#fff", padding: "5px 10px 5px 4px", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </span>
          )}

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
        </>)}

        <div style={{ flex: 1, overflowY: "auto" }}
             onScroll={(e) => {
               // Mais uma página quando faltam 600px para o fim: o tempo de
               // desenhar a próxima cabe dentro do que ainda há para rolar, e
               // ninguém vê a lista "acabar".
               const el = e.currentTarget;
               if (el.scrollHeight - el.scrollTop - el.clientHeight > 600) return;
               mostrarMais();
             }}>
          {/* ESCOLHA O TELEFONE.
              Aparece quando se troca para um departamento com mais de um
              número. Antes a tela escolhia sozinha — e o número escolhido é o
              que o cliente vê chegar no WhatsApp dele, então não é escolha de
              máquina. Com um telefone só, `trocarDepartamento` já entra direto
              e este bloco não aparece. */}
          {!advogadoId && advogadosVisiveis.length > 0 && (
            <div style={{ padding: "18px 16px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Por qual número você vai atender?</div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14, lineHeight: 1.45 }}>
                {departamentoAtual ? <><b style={{ color: C.textPrimary }}>{departamentoAtual.nome}</b> tem {advogadosVisiveis.length} números.</> : null}
                {" "}É este número que o cliente vê chegar no WhatsApp dele.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {advogadosVisiveis.map((a) => {
                  const n = naoLidasDoAdvogado(a.id);
                  return (
                    <button key={a.id} onClick={() => trocarAdvogado(a.id)} title={`Atender por ${a.nome}`}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                               border: `1px solid ${C.divider}`, background: C.headerBar, color: C.textPrimary,
                               borderRadius: 12, padding: "11px 13px", cursor: "pointer", minHeight: 56 }}>
                      <Avatar nome={a.nome} foto={a.foto_url} size={38} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                        <span style={{ display: "block", fontSize: 12.5, color: C.textSecondary, fontVariantNumeric: "tabular-nums" }}>{numeroBonito(a.numero) || "sem número"}</span>
                      </span>
                      {n > 0 && (
                        <span style={{ flexShrink: 0, minWidth: 22, height: 22, borderRadius: 11, background: C.green, color: "#fff",
                                       fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{n}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* NÃO CONSEGUI PERGUNTAR ≠ VOCÊ NÃO PODE.
              Enquanto isto aqui era uma frase só, a tela afirmava a segunda
              coisa sempre que a primeira acontecia — e foi assim que um
              administrador, que alcança tudo, leu que não tinha número
              nenhum. O botão está aqui porque a saída era um F5 que ninguém
              tinha motivo para tentar. */}
          {!advogadoId && erroDoAcesso && (
            <div data-erro-do-acesso style={{ padding: "20px 18px", textAlign: "center", color: C.textSecondary, fontSize: 13 }}>
              <div style={{ color: C.textPrimary, fontWeight: 600, marginBottom: 6 }}>
                Não consegui conferir o seu acesso agora.
              </div>
              <div style={{ marginBottom: 4 }}>
                Não veio resposta para: {erroDoAcesso}.
              </div>
              <div style={{ marginBottom: 14 }}>
                Isto não quer dizer que você perdeu acesso — quer dizer que a pergunta
                não foi respondida.
              </div>
              <button
                data-tentar-acesso
                onClick={() => { setErroDoAcesso(""); setTentativaDeAcesso((n) => n + 1); }}
                style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8,
                         padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Tentar de novo
              </button>
            </div>
          )}
          {/* ENQUANTO A PERGUNTA NÃO FOI RESPONDIDA, A TELA NÃO AFIRMA NADA.
              A frase de baixo é definitiva — "você não tem nenhum número" —, e
              ela aparecia durante o carregamento, quando a resposta ainda nem
              tinha chegado. Relatado com print: a mesma sessão, segundos
              depois, com oito números na barra lateral. */}
          {!advogadoId && !erroDoAcesso && !acessoConferido && (
            <div data-conferindo-acesso style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>
              Carregando os seus números…
            </div>
          )}
          {!advogadoId && !erroDoAcesso && acessoConferido && advogadosVisiveis.length === 0 && (
            <div data-sem-numeros style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>
              Você não tem nenhum número liberado neste departamento.
            </div>
          )}
          {/* Daqui para baixo, só com um telefone escolhido. */}
          {!advogadoId ? null : <>
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
              {/* O selo verde de não lidas vem ANTES da contagem de conversas,
                  e só aparece quando existe: é a informação que pede ação, e a
                  outra é só quantidade. Mesmo desenho do selo da lista, para
                  não ensinar dois vocabulários para a mesma ideia. */}
              {naoLidasArquivadas > 0 && (
                <span data-nao-lidas-arquivadas={naoLidasArquivadas}
                  title={`${naoLidasArquivadas} conversa(s) arquivada(s) com mensagem não lida`}
                  style={{ background: C.unread, color: "#fff", fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                  {naoLidasArquivadas}
                </span>
              )}
              <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>{totalArquivadas}</span>
            </div>
          )}
          {/* "Nenhuma conversa ainda" durante a troca de telefone era mentira:
              a lista não está vazia, ela ainda não chegou. Quem lia isso podia
              concluir que o telefone novo não tinha atendimento nenhum. */}
          {/* A BUSCA QUE NÃO CONSEGUIU PRECISA DIZER QUE NÃO CONSEGUIU.
              Antes ela caía no "Nenhuma conversa ainda" logo abaixo, que é uma
              RESPOSTA — "esse cliente não existe aqui" — e quem lê isso para de
              procurar. Foi assim que dois defeitos desta tela ficaram meses
              sem ninguém saber que eram defeitos. */}
          {erroBusca && (
            <div role="alert" style={{ margin: "12px 14px", padding: "10px 12px", borderRadius: 10,
                                       background: C.listActive, border: `1px solid ${C.divider}`,
                                       color: C.textPrimary, fontSize: 12.5, lineHeight: 1.5 }}>
              {erroBusca}
            </div>
          )}
          {/* ------------------------------------------------------------
              QUEM O VANTORO ACHOU E O ZORVIN NUNCA VIU

              Relato do escritório, com print: procurar "ELIANA ALVES DA SILVA"
              devolvia "Nada encontrado para essa busca" — e a ELIANA está no
              Vantoro, com telefone, três processos e vinte e um documentos.

              O Vantoro respondia certo. Com o telefone dele em mãos, o painel
              procurava a CONVERSA daquele número neste telefone do escritório
              — e se a pessoa nunca escreveu para ele, não há conversa nenhuma.
              A busca terminava sem nada a mostrar.

              "Nada encontrado" era falso, e é o pior tipo de falso: uma
              RESPOSTA. Nós encontramos a pessoa; o que não temos é conversa
              com ela. Quem lê "não achei" conclui que o cliente não existe no
              sistema e para de procurar — quando o que faltava era um clique.

              O TELEFONE VEM DO CADASTRO, e é isso que dá valor ao gesto:
              ninguém decora o número do cliente. Sem isto, a saída era abrir o
              Vantoro, copiar o telefone, voltar e usar "Nova conversa".
              ------------------------------------------------------------ */}
          {busca.trim() && !buscando && semConversa.length > 0 && (
            <div data-do-vantoro-sem-conversa>
              <div style={{ padding: "10px 14px 6px", fontSize: 11.5, fontWeight: 700,
                            letterSpacing: .4, textTransform: "uppercase",
                            color: C.textSecondary }}>
                No cadastro do Vantoro, ainda sem conversa por este número
              </div>
              {semConversa.map((p) => (
                <div key={p.telefone} data-comecar-conversa={p.telefone}
                     role="button" tabIndex={0}
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); conversarComNumero(p.telefone); } }}
                     onClick={() => conversarComNumero(p.telefone)}
                     style={{ display: "flex", alignItems: "center", gap: estreito ? 10 : 12,
                              padding: estreito ? "10px 8px" : "10px 14px",
                              borderBottom: `1px solid ${C.divider}`, cursor: "pointer" }}>
                  <Avatar nome={p.nome} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden",
                                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  color: C.textPrimary }}>{p.nome}</div>
                    <div style={{ fontSize: 13, color: C.textSecondary }}>
                      {telefoneLegivel(p.telefone)}
                    </div>
                  </div>
                  {/* O QUE O CLIQUE FAZ, ESCRITO. As outras linhas desta lista
                      abrem uma conversa que existe; esta CRIA uma. Sem dizer,
                      as duas parecem a mesma coisa. */}
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.green,
                                 whiteSpace: "nowrap" }}>Começar conversa</span>
                </div>
              ))}
            </div>
          )}
          {conversasFiltradas.length === 0 && !erroBusca && semConversa.length === 0 && (
            // A MARCA, para as provas não terem de caçar a palavra no texto da
            // página inteira: um aviso que por acaso contivesse "Procurando" —
            // e um já conteve — faria a tela parecer estar procurando depois de
            // ter desistido, e a prova aprovaria o defeito que ela caça.
            <div data-recado-da-lista={buscando ? "procurando" : undefined}
                 style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>
              {trocandoDeTelefone ? "Carregando as conversas…"
                : buscando ? "Procurando…"
                : busca.trim() ? "Nada encontrado para essa busca."
                : verArquivadas ? "Nenhuma conversa arquivada." : "Nenhuma conversa ainda."}
            </div>
          )}
          {conversasFiltradas.slice(0, quantasNaLista).map((c) => {
            const nome = nomeDoContato(c.contato);
            // Prévia: se a última mensagem é mídia (e sem legenda), mostra
            // "📷 Foto", "🎤 Mensagem de voz" etc. em vez de "[anexo]".
            const midia = ultimasMidias[c.id];
            const bruto = c.ultima_mensagem || "";
            const previa = midia && (bruto === "[anexo]" || bruto === "")
              ? rotuloMidia(midia.tipo, midia.segundos, !estreito) : bruto;
            return (
              <div key={c.id} data-conversa-nome={nome} data-conversa-id={c.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirConversa(c); } }} onClick={() => abrirConversa(c)} onMouseEnter={() => setConvHover(c.id)} onMouseLeave={() => setConvHover((h) => (h === c.id ? null : h))} style={{ position: "relative", width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: estreito ? 10 : 12, padding: estreito ? "10px 8px" : "10px 14px", background: c.id === conversaId ? C.listActive : (convHover === c.id ? C.divider : C.panel), borderBottom: `1px solid ${C.divider}`, cursor: "pointer", color: C.textPrimary }}>
                <Avatar nome={nome} foto={c.contato?.foto_url} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                      {c.favorita && <Star size={13} color="#f5c518" fill="#f5c518" style={{ flexShrink: 0 }} />}
                      {/* A DICA AO PASSAR O MOUSE. O nome e a prévia cabem
                          numa linha e são cortados com reticências —
                          "Procurações e Documentos(…" não diz de qual pasta é,
                          e "Conseguimos agendar para o dia…" não diz o dia.
                          No WhatsApp Web, parar o mouse em cima mostra o texto
                          inteiro; aqui também. É de graça: o próprio navegador
                          desenha, e não custa render nenhum. */}
                      <span title={nome} style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                      {/* ESTÁ ARQUIVADA, E A LINHA DIZ.
                          Só durante a busca, e só fora da pasta: lá dentro
                          todas são, e repetir o selo em cada linha não informa
                          nada. Sem ele, a conversa aparece ao procurar, some
                          quando a busca é apagada, e parece defeito. */}
                      {buscandoTexto && c.arquivada && !verArquivadas && (
                        <span data-selo-arquivada
                              title="Esta conversa está arquivada"
                              style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600,
                                       color: C.textSecondary, border: `1px solid ${C.divider}`,
                                       borderRadius: 5, padding: "1px 5px", lineHeight: 1.5 }}>
                          arquivada
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: c.nao_lidas ? C.horaNaoLida : C.textSecondary, flexShrink: 0 }}>{horaDe(c.ultima_atividade)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    {digitandoAtivo(c.id) ? (
                      <span style={{ fontSize: 13, color: C.verdeTexto, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250 }}>digitando…</span>
                    ) : (
                      <span title={previa} style={{ fontSize: 13, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250 }}>{previa}</span>
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
                   !nomesDoContato(c.contato).some((n) => String(n || "").toLowerCase().includes(busca.trim().toLowerCase())) && (
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
                <button aria-label="Opções da conversa" onClick={(e) => { e.stopPropagation(); setMenuConversa(menuConversa === c.id ? null : c.id); }} title="Opções" style={{ alignSelf: "center", flexShrink: 0, border: "none", background: "transparent", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6, marginRight: -6, minWidth: 40, minHeight: 40, color: C.textSecondary, opacity: (convHover === c.id || menuConversa === c.id) ? 1 : 0.6, transition: "opacity .12s" }}>
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

          {/* O FIM DA FATIA, ESCRITO. A rolagem já traz mais sozinha; este
              rodapé existe para o corte não ser invisível — e para quem navega
              por teclado, que não dispara rolagem, ter um botão. */}
          {(conversasFiltradas.length > quantasNaLista || (temMaisConversas && listaPodeCrescer)) && (
            <div style={{ padding: "14px 16px 20px", textAlign: "center" }} data-teste="fim-da-lista">
              <button
                onClick={() => mostrarMais(PAGINA * 4)}
                disabled={buscandoMais}
                style={{ minHeight: 34, padding: "6px 16px", borderRadius: 20,
                         cursor: buscandoMais ? "default" : "pointer",
                         border: `1px solid ${C.divider}`, background: "transparent",
                         color: C.textSecondary, fontSize: 12.5, fontWeight: 600 }}>
                {buscandoMais ? "Buscando…" : "Mostrar mais"}
              </button>
              {/* "de 1200 conversas" seria mentira: só sabemos o que já veio, e
                  o banco pode ter mais. O "+" diz isso sem inventar número. */}
              <div style={{ marginTop: 8, fontSize: 11.5, color: C.textSecondary }}>
                {Math.min(quantasNaLista, conversasFiltradas.length)} de {conversasFiltradas.length}
                {temMaisConversas && listaPodeCrescer ? "+" : ""} conversas
              </div>
            </div>
          )}
          </>}
        </div>
      </div>

      {/* Conversa */}
      {/* Mesmo motivo da coluna da lista: sem `minWidth: 0` a conversa aberta
          no celular fica mais larga que a tela por causa de uma mensagem
          comprida. */}
      <div style={{ flex: 1, minWidth: 0, display: ((estreito && !conversaId) || (estreito && (fichaAberta || historico))) ? "none" : "flex", flexDirection: "column", background: C.chatBg, backgroundImage: modo === "escuro" ? PADRAO_CHAT_ESCURO : PADRAO_CHAT_CLARO, position: "relative" }}>
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
            <div data-topo-conversa style={{ background: C.headerBar, padding: estreito ? "8px 10px" : "10px 16px", display: "flex", alignItems: "center", gap: estreito ? 6 : 12, borderBottom: `1px solid ${C.divider}` }}>
              {estreito && (
                <button onClick={() => setConversaId(null)} title="Voltar" aria-label="Voltar" style={BOTAO_ICONE}>
                  <ArrowLeft size={20} color={C.textSecondary} />
                </button>
              )}
              {/* O NOME NÃO ABRE MAIS NADA. O painel "Dados do contato" trazia
                  três coisas — a foto grande, o nome e o número —, e as três já
                  estão aqui: o nome e o número escritos, a foto no avatar. Ele
                  só interrompia a conversa a cada clique sem querer no lugar
                  mais clicável do cabeçalho. A foto grande continua a um clique
                  de distância, mas na FOTO, que é onde se espera. */}
              <div style={{ display: "flex", alignItems: "center", gap: estreito ? 9 : 12, flex: 1, minWidth: 0 }}>
              <span onClick={() => { if (conversa.contato?.foto_url) { setLarguraDoRetrato(0); setRetratoAberto(true); setImagemAberta(conversa.contato.foto_url); } }}
                    title={conversa.contato?.foto_url ? "Ver a foto" : undefined}
                    style={{ display: "flex", cursor: conversa.contato?.foto_url ? "pointer" : "default" }}>
                <Avatar nome={conversa.contato?.nome || conversa.contato?.numero} foto={conversa.contato?.foto_url} size={40} />
              </span>
              {/* TUDO AQUI DENTRO CABE EM UMA LINHA CADA.
                  Sem as reticências, "Maria Aparecida da Silva Nascimento"
                  quebrava em QUATRO linhas no celular, as tags quebravam em
                  mais duas, e o cabeçalho passava de 290px — um terço da tela
                  gasto para dizer com quem se está falando, empurrando a
                  conversa para fora. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* O NOME, E O LÁPIS PARA TROCÁ-LO.
                    Só quem NÃO tem cadastro no Vantoro pode ser renomeado
                    aqui: quem tem é conhecido pelo nome da ficha, e oferecer
                    uma edição que a tela ia ignorar seria pior do que não
                    oferecer. Nesse caso o caminho é a ficha, que fica a um
                    botão de distância no mesmo cabeçalho. */}
                {renomeando === null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <div data-nome-do-contato style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeDoContato(conversa.contato)}</div>
                    {/* O LÁPIS SÓ NO COMPUTADOR. Ele tinha 24×24 — metade do
                        que um dedo acerta — e ficava colado no nome, que é
                        justamente onde se toca para nada acontecer. No celular
                        ele virou uma linha escrita dentro do menu ⋮. */}
                    {!estreito && !conversa.contato?.vantoro_nome && (
                      <button onClick={() => setRenomeando(conversa.contato?.nome_zorvin || "")}
                              title="Dar um nome a este contato (só no Zorvin)"
                              style={{ border: "none", background: "transparent", cursor: "pointer",
                                       color: C.textSecondary, padding: 2, display: "flex", flexShrink: 0,
                                       minHeight: 24, minWidth: 24, alignItems: "center", justifyContent: "center" }}>
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <input autoFocus value={renomeando}
                           onChange={(e) => setRenomeando(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === "Enter") { e.preventDefault(); salvarNomeDoContato(renomeando); }
                             if (e.key === "Escape") { e.preventDefault(); setRenomeando(null); }
                           }}
                           placeholder={conversa.contato?.nome || "Nome do contato"}
                           style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, padding: "3px 8px",
                                    border: `1px solid ${C.green}`, borderRadius: 6, outline: "none",
                                    background: C.inputBg, color: C.textPrimary }} />
                    <button onClick={() => salvarNomeDoContato(renomeando)} title="Salvar"
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.green, padding: 2, display: "flex", minHeight: estreito ? 40 : 24, minWidth: estreito ? 40 : 24, alignItems: "center", justifyContent: "center" }}>
                      <Check size={16} />
                    </button>
                    <button onClick={() => setRenomeando(null)} title="Cancelar"
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary, padding: 2, display: "flex", minHeight: estreito ? 40 : 24, minWidth: estreito ? 40 : 24, alignItems: "center", justifyContent: "center" }}>
                      <X size={16} />
                    </button>
                  </div>
                )}
                {digitandoAtivo(conversa.id) ? (
                  <div style={{ fontSize: 12, color: C.verdeTexto, fontWeight: 600 }}>digitando…</div>
                ) : atendidoPorOutro(conversa.id) ? (
                  <div style={{ fontSize: 12, color: modo === "escuro" ? "#e0a400" : "#8a6d00", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} /> {atendidoPorOutro(conversa.id)} também está nesta conversa
                  </div>
                ) : (
                  /* O TELEFONE DO CLIENTE, e não o nosso.
                     Aqui ficava "via Audiências · (11) 91355-9990" — o telefone
                     DO ESCRITÓRIO, que já está escrito em "ATENDENDO COMO", na
                     coluna ao lado, e que não muda de uma conversa para a
                     outra. Ou seja: a linha logo abaixo do nome do cliente,
                     onde o olho procura quem é ele, gastava-se repetindo quem
                     somos nós. O número do cliente é o que se precisa ler dali
                     — para conferir, para ditar, para procurar no cadastro. */
                  <div style={{ fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {String(conversa.contato?.numero || "").startsWith("grupo:")
                      ? "Grupo"
                      : (numeroBonito(conversa.contato?.numero) || "sem número")}
                  </div>
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
              {/* AS AÇÕES DA CONVERSA — E ONDE ELAS CABEM.
                  No computador, todas no cabeçalho. No celular, não: em 390
                  pontos de tela eram sete botões disputando espaço com o nome
                  do contato, e o nome perdia. Perdia feio — a medição deu UM
                  pixel para ele, que é o "KAIO…" do relato.
                  Então no celular ficam a seta de voltar, a foto, o nome e um
                  ⋮. O resto mudou de lugar, não sumiu: virou lista escrita
                  dentro do ⋮, com as palavras inteiras — melhor do que ícone
                  para quem procura alguma coisa pelo nome dela. É o mesmo
                  arranjo do WhatsApp no celular, e por isso não há o que
                  aprender. */}
              {!estreito && (
                <>
                {/* LIDA ↔ NÃO LIDA — o mesmo botão, nos dois sentidos.
                    Responder o contato já marca como lida sozinho; este botão é
                    para os outros dois casos: "olhei, não precisa de resposta"
                    e "deixa marcada, volto nisto depois".
                    ANTES ELE SÓ APARECIA COM A CONVERSA POR LER, e desmarcar só
                    dava pelo menu do botão direito na lista — que quase ninguém
                    acha. Marcar de volta é justamente o que se quer quando se
                    abre uma conversa sem tempo de resolver agora.
                    Vem com a palavra escrita: um tique sozinho não diz o que
                    faz, e este botão mexe num aviso que a equipe inteira vê.
                    E OS DOIS ESTADOS TÊM DE SER DIFERENTES DE LONGE, senão o
                    botão vira uma roleta: verde e tique duplo para APAGAR o
                    aviso, apagado e balão para DEVOLVER o aviso. Cor e desenho
                    juntos, porque só a cor não serve para quem não a distingue.
                    No celular ele é a primeira linha do menu ⋮, também escrita —
                    e o pingo verde no ⋮ é o que avisa que ela está lá. */}
                {(conversa.nao_lidas || 0) > 0 ? (
                  <button onClick={() => marcarLida(conversa.id)}
                          data-marcar="lida"
                          title="Marcar esta conversa como lida"
                          style={{ ...BOTAO_ICONE, padding: "7px 11px", gap: 6,
                                   background: C.searchBg, color: C.verdeTexto,
                                   fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <CheckCheck size={17} />
                    Marcar como lida
                  </button>
                ) : (
                  <button onClick={() => marcarNaoLida(conversa, true)}
                          data-marcar="nao-lida"
                          title="Marcar esta conversa como NÃO lida"
                          style={{ ...BOTAO_ICONE, padding: "7px 11px", gap: 6,
                                   background: "transparent", color: C.textSecondary,
                                   border: `1px solid ${C.divider}`,
                                   fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap" }}>
                    <MessageSquare size={17} />
                    Marcar como não lida
                  </button>
                )}
                {/* Ficha do cliente no Vantoro (cadastro, esteira, processos) */}
                <button onClick={() => setFichaAberta((v) => !v)}
                        title="Ficha no Vantoro"
                        style={{ ...BOTAO_ICONE, padding: 10, background: fichaAberta ? C.listActive : "transparent" }}>
                  <ClipboardList size={19} color={fichaAberta ? C.green : C.textSecondary} />
                </button>
                {/* Histórico de atendimento: quem falou com este cliente, quando
                    e por qual telefone. Ao lado da ficha porque respondem à mesma
                    pergunta — "o que já aconteceu com esta pessoa" —, uma no
                    cadastro do Vantoro e a outra no atendimento. */}
                {/* O ID VEM DA CONVERSA (`contato_id`), e não de `contato.id`.
                    A lista de conversas pede do contato só nome, número e foto —
                    não o id —, então `conversa.contato.id` é `undefined` e o
                    botão não fazia NADA ao ser clicado: sem erro, sem aviso, sem
                    painel. O `contato.id` fica como segunda opção, para o caso de
                    a consulta um dia passar a trazê-lo. */}
                <button onClick={() => {
                          if (historico) { setHistorico(null); return; }
                          const id = conversa.contato_id || conversa.contato?.id;
                          if (id) carregarHistorico(id);
                          // Falar é melhor do que não fazer nada: um botão mudo
                          // faz a pessoa clicar cinco vezes e desistir sem saber
                          // se o problema é dela.
                          else mostrarAviso("Não consegui identificar o contato desta conversa.");
                        }}
                        title={outrasConversasDoContato > 0
                          ? `Histórico de atendimento — este cliente também é atendido por ${outrasConversasDoContato} outro(s) telefone(s) nosso(s)`
                          : "Histórico de atendimento"}
                        style={{ ...BOTAO_ICONE, padding: 10, position: "relative",
                                 background: historico ? C.listActive : "transparent" }}>
                  <History size={19} color={historico ? C.green : C.textSecondary} />
                  {/* O NÚMERO DOS OUTROS TELEFONES.
                      Sem ele o ícone é mudo, e a informação — que existe, e que
                      o painel de histórico mostra — só aparece para quem
                      resolve clicar. Ninguém clica num ícone para descobrir que
                      não há nada lá, e o preço disso é duas pessoas atendendo o
                      mesmo cliente sem saber uma da outra.
                      SÓ APARECE QUANDO HÁ OUTRO. Um "1" em toda conversa seria
                      ruído em cima da tela inteira, e ruído constante deixa de
                      ser lido — inclusive no dia em que virar "3". */}
                  {outrasConversasDoContato > 0 && (
                    <span data-outros-telefones={outrasConversasDoContato}
                          style={{ position: "absolute", top: 2, right: 2,
                                   minWidth: 15, height: 15, padding: "0 3px",
                                   borderRadius: 8, background: C.green, color: "#fff",
                                   fontSize: 9.5, fontWeight: 700, lineHeight: "15px",
                                   textAlign: "center", pointerEvents: "none" }}>
                      {outrasConversasDoContato}
                    </span>
                  )}
                </button>
                {/* QUEM PARTICIPOU DESTA CONVERSA.
                    O grupinho mostra quatro rostos e um "+3" — e o "+3" era um
                    beco: ele DIZ que há mais gente e não dá jeito nenhum de ver
                    quem. Havia um `title`, mas title é uma linha de texto que
                    demora a aparecer, some ao mexer o rato, não existe no toque e
                    corta quando cresce; para saber quem atendeu um cliente, não
                    serve.
                    Agora o grupinho é um botão e abre a lista inteira, com quem,
                    quantas mensagens e quando foi a última — que é o que responde
                    "com quem eu falo sobre este cliente". */}
                {atendentesInteragiram.length > 0 && (
                  <span ref={quemParticipouRef} style={{ position: "relative", display: "flex", marginRight: 2 }}>
                    <button data-quem-participou onClick={() => setQuemParticipou((v) => !v)}
                            aria-label={`Quem participou da conversa (${atendentesInteragiram.length})`}
                            aria-expanded={quemParticipou}
                            title="Quem participou desta conversa"
                            style={{ display: "flex", alignItems: "center", border: "none", background: "transparent",
                                     cursor: "pointer", padding: 2, borderRadius: 20 }}>
                      {atendentesInteragiram.slice(0, 4).map((a, idx) => (
                        <span key={a.id || a.nome} style={{ marginLeft: idx === 0 ? 0 : -8, borderRadius: "50%", border: `2px solid ${C.headerBar}`, display: "flex" }}>
                          <Avatar nome={a.nome} foto={a.foto} size={26} />
                        </span>
                      ))}
                      {atendentesInteragiram.length > 4 && (
                        <span style={{ marginLeft: -8, width: 26, height: 26, borderRadius: "50%", background: C.divider, color: C.textSecondary, fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.headerBar}` }}>+{atendentesInteragiram.length - 4}</span>
                      )}
                    </button>
                    {quemParticipou && listaDeParticipantes}
                  </span>
                )}
                {/* Etiquetar a conversa: abre um menu para marcar/desmarcar tags */}
                <span ref={tagMenuRef} style={{ position: "relative", display: "flex" }}>
                  <button aria-label="Etiquetas" onClick={() => setTagMenuAberto((v) => !v)} title="Etiquetas" style={{ ...BOTAO_ICONE, padding: 10 }}>
                    <Tag size={19} color={tagMenuAberto || (tagsPorConversa[conversa.id] || []).length ? C.green : C.textSecondary} />
                  </button>
                  {tagMenuAberto && listaDeEtiquetas}
                </span>
                <button aria-label="Buscar na conversa" onClick={() => setBuscaAberta((v) => !v)} title="Buscar na conversa" style={{ ...BOTAO_ICONE, padding: 10 }}>
                  <Search size={19} color={buscaAberta ? C.green : C.textSecondary} />
                </button>
                </>
              )}

              {estreito && (
                <span ref={acoesRef} style={{ position: "relative", display: "flex" }}>
                  <button aria-label="Mais opções desta conversa" title="Mais opções desta conversa"
                          onClick={() => { setQuemParticipou(false); setTagMenuAberto(false); setMenuDaConversa((v) => !v); }}
                          aria-expanded={menuDaConversa}
                          style={{ ...BOTAO_ICONE, minWidth: 40, minHeight: 40, position: "relative" }}>
                    <MoreVertical size={20} color={C.textSecondary} />
                    {/* O PINGO VERDE — porque "marcar como lida" e as etiquetas
                        entraram no menu, e o que entra num menu fica invisível.
                        Sem ele, uma conversa com mensagem por ler deixaria de
                        avisar qualquer coisa depois de aberta no celular. */}
                    {((conversa.nao_lidas || 0) > 0 || (tagsPorConversa[conversa.id] || []).length > 0) && (
                      <span style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: "50%", background: C.green, border: `2px solid ${C.headerBar}` }} />
                    )}
                  </button>

                  {menuDaConversa && (
                    <div data-menu-conversa
                         style={{ position: "absolute", top: 44, right: 0, zIndex: 60, width: 252,
                                  background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                                  boxShadow: "0 6px 20px rgba(0,0,0,.3)", overflow: "hidden" }}>
                      {/* Os dois sentidos aqui também: no celular este menu é
                          o único caminho, e sem o "não lida" a função
                          simplesmente não existia para quem atende pelo
                          telefone. */}
                      {(conversa.nao_lidas || 0) > 0 ? (
                        <button onClick={() => { setMenuDaConversa(false); marcarLida(conversa.id); }}
                                data-menu-marcar="lida"
                                style={{ ...ITEM_DO_MENU, color: C.verdeTexto, fontWeight: 600 }}>
                          <CheckCheck size={17} color={C.green} /> Marcar como lida
                        </button>
                      ) : (
                        <button onClick={() => { setMenuDaConversa(false); marcarNaoLida(conversa, true); }}
                                data-menu-marcar="nao-lida"
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                          <MessageSquare size={17} color={C.textSecondary} /> Marcar como não lida
                        </button>
                      )}
                      <button onClick={() => { setMenuDaConversa(false); setFichaAberta(true); }}
                              style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                        <ClipboardList size={17} color={C.textSecondary} /> Ficha no Vantoro
                      </button>
                      <button onClick={() => {
                                setMenuDaConversa(false);
                                const id = conversa.contato_id || conversa.contato?.id;
                                if (id) carregarHistorico(id);
                                else mostrarAviso("Não consegui identificar o contato desta conversa.");
                              }}
                              style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                        <History size={17} color={C.textSecondary} /> Histórico de atendimento
                      </button>
                      <button onClick={() => { setMenuDaConversa(false); setTagMenuAberto(true); }}
                              style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                        <Tag size={17} color={(tagsPorConversa[conversa.id] || []).length ? C.green : C.textSecondary} />
                        Etiquetas
                        {(tagsPorConversa[conversa.id] || []).length > 0 && (
                          <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSecondary }}>
                            {(tagsPorConversa[conversa.id] || []).length}
                          </span>
                        )}
                      </button>
                      {/* QUEM PARTICIPOU — no celular isto NUNCA existiu: a
                          fileirinha de rostos era escondida por falta de
                          espaço, e junto com ela ia embora a única resposta
                          para "com quem eu falo sobre esta pessoa". Escrita,
                          cabe. */}
                      {atendentesInteragiram.length > 0 && (
                        <button onClick={() => { setMenuDaConversa(false); setQuemParticipou(true); }}
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                          <Users size={17} color={C.textSecondary} /> Quem participou
                          <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSecondary }}>
                            {atendentesInteragiram.length}
                          </span>
                        </button>
                      )}
                      <button onClick={() => { setMenuDaConversa(false); setBuscaAberta(true); }}
                              style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                        <Search size={17} color={C.textSecondary} /> Buscar nesta conversa
                      </button>
                      {!conversa.contato?.vantoro_nome && (
                        <button onClick={() => { setMenuDaConversa(false); setRenomeando(conversa.contato?.nome_zorvin || ""); }}
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary, borderTop: `1px solid ${C.divider}` }}>
                          <Pencil size={17} color={C.textSecondary} /> Dar um nome a este contato
                        </button>
                      )}
                    </div>
                  )}

                  {tagMenuAberto && listaDeEtiquetas}
                  {quemParticipou && listaDeParticipantes}
                </span>
              )}
            </div>

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

            {/* A BARRA DAS FIXADAS.
                Fixar sem esta barra seria só uma marquinha na bolha: a mensagem
                continuaria enterrada no meio da conversa, e achá-la daria o
                mesmo trabalho de antes. É a barra que transforma o alfinete em
                atalho — clicar nela leva até a mensagem.
                Mostra a mais recente e diz quantas são, como o WhatsApp. */}
            {(() => {
              const fixadas = mensagens.filter((x) => x.fixada);
              if (!fixadas.length) return null;
              const ultima = fixadas[fixadas.length - 1];
              return (
                <div role="button" onClick={() => {
                  const el = document.querySelector(`[data-msg-id="${ultima.id}"]`);
                  if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                  else mostrarAviso("Essa mensagem está mais acima; carregue as anteriores.");
                }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                           background: C.headerBar, borderBottom: `1px solid ${C.divider}`,
                           padding: estreito ? "8px 12px" : "8px 16px", color: C.textPrimary }}>
                  <Pin size={16} color={C.green} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textSecondary,
                                 overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ultima.texto || rotuloMidia(ultima.tipo) || "Mensagem fixada"}
                  </span>
                  {fixadas.length > 1 && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.textSecondary }}>
                      {fixadas.length} fixadas
                    </span>
                  )}
                </div>
              );
            })()}

            {/* ------------------------------------------------------------
                A NOTA INTERNA, NO ALTO E COM LUGAR PRÓPRIO

                Pedido do escritório: "ao clicar no ícone da nota, o campo de
                escrever deve aparecer na parte de cima, ao invés de embaixo,
                para não confundir o usuário".

                Antes, nota e mensagem dividiam a MESMA caixa, no MESMO lugar, e
                a única diferença era a cor. Escrever para o cliente e escrever
                para a equipe são coisas de consequência oposta — uma sai do
                escritório, a outra não — e não podem morar no mesmo canto da
                tela.

                Aqui em cima, colado no cabeçalho de onde o botão foi clicado, e
                em âmbar da moldura ao botão. O caminho do olho fica curto:
                clicou ali, escreve logo abaixo.
                ------------------------------------------------------------ */}
            {modoNota && !selecao && (
              <div data-nota-no-alto
                   style={{ background: modo === "escuro" ? "#2f2a19" : "#fffaea",
                            borderBottom: "2px solid #d4a017",
                            display: "flex", flexDirection: "column" }}>
                {/* A LINHA DE CIMA: o processo à esquerda, a saída à direita.
                    A FAIXA COM "Nota interna — só a equipe vê" SAIU. Ela dizia,
                    em amarelo e em negrito, exatamente o que o campo de digitar
                    logo abaixo já diz na sua própria letra cinza ("Escreva uma
                    nota interna (só a equipe vê)"). Aviso repetido não avisa em
                    dobro: ele ocupa a altura que a conversa perdeu e ensina o
                    olho a pular a faixa — e o dia em que houver ali um recado
                    que importa, ele será pulado também.
                    O que sobrou diz a mesma coisa sem repetir ninguém: a moldura
                    âmbar, o ícone aceso, e o próprio texto do campo.
                    A LINHA EXISTE MESMO SEM PROCESSO. A maior parte dos contatos
                    é lead sem cadastro no Vantoro; se ela só nascesse junto com
                    o seletor, o X sumiria justamente para eles — e a única saída
                    à vista seria a tarja lá embaixo. */}
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                              padding: estreito ? "6px 10px 0" : "8px 16px 0" }}>
                  {barraDoProcessoDaNota || <span style={{ flex: 1 }} />}
                  {/* FECHAR É UM BOTÃO DE VERDADE, e não "clicar no ícone de
                      novo". Quem abriu aqui em cima procura a saída aqui em
                      cima; mandar a pessoa de volta à barra de baixo para
                      desfazer o que acabou de fazer é um passo a mais em cada
                      nota. */}
                  <button data-fechar-nota onClick={() => setModoNota(false)}
                          title="Fechar a nota interna"
                          aria-label="Fechar a nota interna"
                          style={{ border: "none", background: "transparent", cursor: "pointer",
                                   display: "flex", alignItems: "center", justifyContent: "center",
                                   width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                   alignSelf: "flex-start" }}>
                    <X size={18} color="#d4a017" />
                  </button>
                </div>
                <div style={{ padding: estreito ? "0 8px 7px" : "0 16px 9px",
                              display: "flex", alignItems: "flex-end",
                              gap: estreito ? 6 : 10, position: "relative" }}>
                  {caixaDeEscrever}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------
                ESTE NÚMERO NÃO TEM COMO RECEBER — DITO ANTES DE ESCREVER.

                Veio de uma varredura dos 238 envios que falharam no banco do
                escritório. Tirando o erro passageiro, o que sobrou foram 16
                celulares gravados sem o nono dígito e 8 telefones fixos — as
                duas coisas visíveis no próprio número, sem perguntar nada a
                ninguém.

                E o preço disso: 26 tentativas para o mesmo número em nove
                dias, 16 para outro, 16 para um terceiro. Ninguém lia a bolha
                vermelha lá embaixo, no fim de uma conversa longa. Cada envio
                parecia o primeiro porque nada na tela dizia o contrário.

                AQUI EM CIMA, E NÃO NA BOLHA. A bolha vermelha chega DEPOIS de
                a pessoa escrever e mandar — ela conta o que já aconteceu. Esta
                tarja fica onde o olho passa antes de digitar, e diz o que
                fazer em vez de o que houve.

                O NÚMERO CORRIGIDO É MOSTRADO, E NÃO USADO. A ponte poderia
                tentar sozinha com o 9 inserido e resolver os 16 casos sem
                ninguém mexer — mas isso é mandar mensagem de cliente para um
                número que ninguém digitou, e o 9 nem sempre acerta a mesma
                pessoa. Quem confere na ficha é gente.
                ------------------------------------------------------------ */}
            {(() => {
              // A CONVERSA QUE JÁ FUNCIONOU CALA A TARJA — e era isto que
              // faltava na primeira versão.
              //
              // O relato que consertou isto: "Dias Costa Advogados",
              // (31) 8418-0018, doze dígitos. A tarja anunciava em âmbar que
              // faltava o nono dígito — e logo abaixo dela estavam as mensagens
              // indo e voltando, com dois tiques. O número funciona sem o 9.
              //
              // A PREMISSA ESTAVA ERRADA: eu tratei "doze dígitos" como prova
              // de que o número não recebe. Não é prova de nada. Contas antigas
              // do WhatsApp continuam atendendo na forma de oito dígitos, e
              // fixo recebe sim quando o escritório usa o WhatsApp Business.
              //
              // O formato é PISTA, não veredicto. A prova está na conversa: se
              // existe uma mensagem ali — recebida do cliente ou enviada com
              // sucesso —, aquele número funciona e não há o que avisar. As
              // falhas não contam: a bolha vermelha vive na fila de envio, e a
              // provisória ainda não saiu.
              //
              // Custa zero: `mensagens` já está carregada na tela.
              const jaFuncionou = mensagens.some((m) =>
                m.origem !== "nota" && m._status !== "erro" && m._status !== "enviando"
                && !String(m.id).startsWith("temp-") && !String(m.id).startsWith("fila-"));
              const oQueHa = jaFuncionou ? null : porQueNaoRecebeWhatsApp(conversa.contato?.numero);
              if (!oQueHa) return null;
              return (
                <div data-numero-nao-recebe data-tipo={oQueHa.tipo}
                     style={{ background: modo === "escuro" ? "#3a2a1a" : "#fff4e5",
                              borderBottom: "1px solid #e0a458",
                              padding: estreito ? "8px 12px" : "10px 16px",
                              display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertCircle size={17} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: estreito ? 12.5 : 13, lineHeight: 1.45, color: C.textPrimary }}>
                    {/* NO CELULAR, A FRASE CURTA. A inteira ocupa 126px de
                        altura numa tela de 360 — um sexto do que a pessoa tem
                        para ver a conversa, gasto num aviso de uma linha. */}
                    <b>{oQueHa.titulo}</b>{" "}
                    <span style={{ color: C.textSecondary }}>
                      {estreito ? (oQueHa.curto || oQueHa.detalhe) : oQueHa.detalhe}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div ref={listaRef} data-lista-mensagens onScroll={aoRolar} style={{ flex: 1, overflowY: "auto", padding: estreito ? "16px 10px" : "20px 8%", display: "flex", flexDirection: "column", gap: 6 }}>
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
              {/* O QUE ESTÁ ACONTECENDO AQUI DENTRO.
                  Relato de 31/08, de quem usa: "zorvin está lento, não consigo
                  abrir as mensagens", com a foto de uma conversa aberta e o
                  miolo preto. A conversa tinha mensagem no banco; a tela não
                  dizia nem que estava buscando, nem que tinha falhado, nem que
                  estava vazia. As três eram a mesma tela: nenhuma.
                  Uma tela muda faz a pessoa esperar por algo que talvez nunca
                  venha — e faz "falhou" ser confundido com "lento". */}
              {estadoMensagens === "carregando" && !mensagens.length && (
                <div data-mensagens-carregando style={{ margin: "auto", color: C.textSecondary, fontSize: 13.5 }}>
                  Carregando as mensagens…
                </div>
              )}
              {typeof estadoMensagens === "object" && estadoMensagens && (
                <div data-mensagens-erro style={{ margin: "auto", maxWidth: 380, textAlign: "center",
                            background: C.panel, border: `1px solid ${C.divider}`,
                            borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    Não consegui carregar as mensagens desta conversa.
                  </div>
                  <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
                    A conversa existe e nada foi perdido — o que falhou foi a
                    leitura. {estadoMensagens.codigo ? `Código do banco: ${estadoMensagens.codigo}.` : ""}
                  </div>
                  <button data-tentar-mensagens onClick={() => carregarMensagens(conversaId)}
                          style={{ border: "none", background: C.green, color: "#fff", borderRadius: 9,
                                   padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Tentar de novo
                  </button>
                </div>
              )}
              {estadoMensagens === "pronto" && !mensagens.length && (
                // VAZIA É UMA RESPOSTA, e diferente de "não carregou". A
                // conversa recém-criada (o lead que ainda não escreveu, ou o
                // contato aberto pelo botão do outro número) cai aqui.
                <div data-conversa-sem-mensagem style={{ margin: "auto", color: C.textSecondary, fontSize: 13.5, textAlign: "center" }}>
                  Nenhuma mensagem nesta conversa ainda.<br />
                  <span style={{ fontSize: 12.5 }}>Escreva abaixo para começar.</span>
                </div>
              )}
              <ListaDeBolhas
                {...acoesDaBolha}
                mensagens={mensagens} C={C} modo={modo} estreito={estreito}
                conversa={conversa} meuNome={meuNome} equipe={equipe}
                figurinhas={figurinhas}
                selecao={selecao} msgHover={msgHover} setMsgHover={setMsgHover}
                buscaAberta={buscaAberta} buscaConversa={buscaConversa}
                msgDestacada={msgDestacada} idDivisorNaoLidas={idDivisorNaoLidas}
                reagindo={reagindo} setReagindo={setReagindo}
                reagindoTudo={reagindoTudo} setReagindoTudo={setReagindoTudo}
                rostoAberto={rostoAberto} setRostoAberto={setRostoAberto}
                menuParaCima={menuParaCima} setMenuParaCima={setMenuParaCima}
                fimRef={fimRef} inputRef={inputRef} pertoDoFim={pertoDoFim}
                setSelecao={setSelecao} setRascunho={setRascunho}
                setEditando={setEditando} setRespondendo={setRespondendo}
                setModoNota={setModoNota} setProcessoDaNota={setProcessoDaNota}
                setEncaminhar={setEncaminhar}
                setBuscaEncaminhar={setBuscaEncaminhar}
                setImagemAberta={setImagemAberta} setRetratoAberto={setRetratoAberto}
                setNotaParaApagar={setNotaParaApagar} />
              <div ref={fimRef} />
            </div>

            {!pertoDoFim && (
              <button onClick={irParaOFim} title="Ir para o fim" style={{ position: "absolute", right: 24, bottom: 84, width: 42, height: 42, borderRadius: "50%", background: C.panel, border: `1px solid ${C.divider}`, boxShadow: "0 2px 6px rgba(0,0,0,.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSecondary, zIndex: 5 }}>
                <ChevronDown size={22} />
              </button>
            )}

            {editando && (
              <div style={{ background: C.barraFundo, padding: "8px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderLeft: `4px solid #d4a017`, borderRadius: 6, padding: "6px 10px" }}>
                  <Pencil size={16} color="#d4a017" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#d4a017", fontWeight: 600, fontSize: 12 }}>Editando a mensagem</div>
                    <div style={{ color: C.textSecondary, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{editando.texto}</div>
                  </div>
                  <button onClick={cancelarEdicao} title="Cancelar edição" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                    <X size={18} color={C.textSecondary} />
                  </button>
                </div>
              </div>
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
            {/* A FAIXA SAIU. Antes a barra tinha fundo próprio (C.headerBar) e o
                balão tinha outro: duas fitas cinzentas empilhadas, e o balão
                deixava de parecer um balão. No WhatsApp Web só existe o balão,
                flutuando sobre a própria conversa — o fundo dela, com padrão e
                tudo, continua atrás do balão. */}
            {/* A QUAL PROCESSO ESTA NOTA SE REFERE — opcional, e só no modo nota.
                O vínculo da nota é SEMPRE com o cliente; o processo existe para
                facilitar achar a informação depois. Por isso o padrão é "nota
                geral": quem não escolher nada não fica devendo nada, e essa é a
                escolha mais comum.
                SÓ APARECE PARA QUEM TEM CADASTRO no Vantoro. Para um contato
                que ainda não é cliente não há processo nenhum a escolher, e um
                seletor vazio ali seria uma pergunta sem resposta possível — a
                nota dele fica na conversa, que é o certo. */}
            {/* O SELETOR DE PROCESSO, VESTIDO DE NOTA.
                Ele nasceu com a roupa da barra comum — fundo igual ao do painel,
                letra cinza — e sumia bem no momento em que precisava ser visto:
                a pessoa liga a nota interna, a barra de escrever fica âmbar, e
                logo acima dela ficava uma faixa apagada que o olho pula.
                Vinculado ao processo errado ninguém fica; ESQUECIDO, sim — e uma
                nota que devia estar no histórico da ação fica só no do cliente.

                Por isso ele agora usa as MESMAS cores da nota (o mesmo âmbar do
                botão, da borda e do fundo da caixa de texto): as duas coisas
                aparecem juntas e se leem como uma peça só.

                E ELE MOSTRA EM QUAL DOS DOIS ESTADOS ESTÁ, sem precisar ler:
                escolhido, fica preenchido de âmbar forte com um "✓"; em nota
                geral, fica claro e diz por extenso que é opcional. */}

            <div style={{ background: C.barraFundo, padding: estreito ? "7px 8px" : "9px 16px", display: "flex", alignItems: "flex-end", gap: estreito ? 6 : 10, position: "relative" }}>
              {selecao ? (
                /* A BARRA DA SELEÇÃO substitui a de digitar, como no WhatsApp.
                   Deixar as duas na tela convidaria a escrever no meio de uma
                   exclusão, e o Enter mandaria a mensagem em vez de apagar. */
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "6px 4px" }}>
                  <button onClick={() => setSelecao(null)} title="Cancelar seleção"
                    style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6 }}>
                    <X size={22} color={C.textSecondary} />
                  </button>
                  <span style={{ flex: 1, fontSize: 15, color: C.textPrimary }}>
                    {selecao.length === 0 ? "Selecione as mensagens"
                      : `${selecao.length} selecionada${selecao.length > 1 ? "s" : ""}`}
                  </span>
                  <button onClick={() => selecao.length && setConfirmarApagar(true)}
                    title="Apagar as selecionadas" disabled={!selecao.length}
                    style={{ border: "none", background: "transparent",
                             cursor: selecao.length ? "pointer" : "default",
                             opacity: selecao.length ? 1 : .4, display: "flex", padding: 6 }}>
                    <Trash2 size={22} color="#e53935" />
                  </button>
                </div>
              ) : audioPronto ? (
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
              ) : modoNota ? (
                /* COM A NOTA ABERTA LÁ EM CIMA, AQUI EMBAIXO FICA A EXPLICAÇÃO.
                   Não some: a barra tem altura, e tirá-la faria a conversa dar
                   um pulo a cada vez que a nota abre e fecha. E, sobretudo, ela
                   responde à pergunta de quem procura onde escrever — "a caixa
                   sumiu" é um susto, "a caixa subiu, olhe lá" é uma instrução.
                   O caminho de volta está aqui e lá em cima: quem se perdeu
                   acha a saída onde estiver olhando. */
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10,
                              padding: estreito ? "10px 6px" : "12px 8px" }}>
                  <StickyNote size={18} color="#d4a017" />
                  {/* CURTA NO CELULAR. A frase inteira quebra em tres linhas numa
                      tela estreita, e uma tarja de tres linhas rouba da conversa
                      mais do que explica. O essencial e a seta para cima: a caixa
                      nao sumiu, ela subiu. */}
                  <span style={{ flex: 1, minWidth: 0, fontSize: estreito ? 12.5 : 13.5,
                                 color: C.textSecondary }}>
                    {estreito ? (<>A <b style={{ color: "#d4a017" }}>nota</b> está aberta ↑</>)
                              : (<>Você está escrevendo uma <b style={{ color: "#d4a017" }}>nota interna</b>,
                                 {" "}na caixa lá em cima.</>)}
                  </span>
                  <button onClick={() => setModoNota(false)}
                          title="Voltar para a mensagem"
                          style={{ border: `1px solid ${C.divider}`, background: "transparent",
                                   color: C.textSecondary, cursor: "pointer", borderRadius: 20,
                                   padding: "7px 14px", fontSize: 12.5, fontWeight: 600,
                                   whiteSpace: "nowrap", flexShrink: 0 }}>
                    {estreito ? "Voltar" : "Voltar para a mensagem"}
                  </button>
                </div>
              ) : (
                caixaDeEscrever
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
          // O NOME QUE ESTÁ NA TELA, e não o cru do WhatsApp. É daqui que sai o
          // nome do pré-cadastro quando a equipe decide transformar o lead em
          // cliente — e seria absurdo ter acabado de renomear o contato para
          // "Maria Aparecida" e ver o Vantoro nascer com "Deus".
          nomeContato={nomeDoContato(conversa.contato)}
          C={C}
          estreito={estreito}
          onFechar={() => setFichaAberta(false)}
          onAviso={mostrarAviso}
          // O cabeçalho da conversa muda NA HORA, sem recarregar a página. A
          // ficha já gravou `vantoro_nome` no contato; aqui a lista em memória
          // acompanha, senão a tela continuaria mostrando o apelido do
          // WhatsApp até alguém atualizar o navegador.
          aoLigarCadastro={({ numero, nome, clienteId }) => {
            setConversas((prev) => prev.map((c) => (
              c.contato && c.contato.numero === numero
                ? { ...c, contato: { ...c.contato, vantoro_nome: nome,
                                     vantoro_cliente_id: clienteId ?? c.contato.vantoro_cliente_id } }
                : c
            )));
          }}
          // FALAR COM O MESMO CLIENTE PELO OUTRO NÚMERO DELE.
          //
          // Reaproveita inteiro o caminho que a busca do Vantoro já usava: o
          // contato é criado (ou reaproveitado, se o número já for conhecido),
          // fica ligado à mesma ficha e a conversa abre. Uma segunda
          // implementação aqui gravaria o telefone de outro jeito, e é
          // exatamente assim que nascia contato duplicado.
          //
          // A ficha se fecha junto no CELULAR, onde ela ocupa a tela inteira:
          // sem isso, o clique abriria a conversa nova por baixo dela e a
          // pessoa veria a mesma ficha, sem sinal de que alguma coisa
          // aconteceu. No computador as duas cabem lado a lado, e fechar seria
          // tirar da tela o que ela estava lendo.
          aoConversarPor={async (linha) => {
            if (estreito) setFichaAberta(false);
            await conversarComClienteVantoro(linha);
          }}
        />
      )}

      {/* HISTÓRICO DE ATENDIMENTO — coluna ao lado da conversa, como a ficha,
          e não uma camada por cima. Por cima, ela cobria o próprio botão que a
          abriu: o ícone ficava verde debaixo do painel, dizendo "estou aberto"
          para ninguém, e não dava para fechar por onde se abriu. No celular
          não cabem as duas, e aí ela ocupa a tela inteira. */}
      {historico && (
        <div style={{ width: estreito ? "100%" : 360, flex: estreito ? 1 : "none",
                      background: C.panel, borderLeft: `1px solid ${C.divider}`,
                      display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ background: C.headerBar, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.divider}` }}>
            <button onClick={() => setHistorico(null)} title="Fechar" style={BOTAO_ICONE}>
              <X size={22} color={C.textSecondary} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Histórico de atendimento</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {historico.carregando && <div style={{ fontSize: 13, color: C.textSecondary }}>Levantando…</div>}
            {!!historico.erro && <div style={{ fontSize: 13, color: C.textSecondary }}>{historico.erro}</div>}
            {/* ALTERAÇÕES — quem mexeu no quê.
                Vem ANTES da lista de telefones e FORA do bloco dela, de
                propósito: pode haver alteração de cadastro num cliente com
                quem ninguém trocou mensagem ainda, e naquele bloco a lista
                sairia com um "ninguém enviou mensagem" e mais nada. */}
            {!historico.carregando && !!(historico.alteracoes || []).length && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>
                  Alterações ({historico.alteracoes.length})
                </div>
                {historico.alteracoes.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, marginBottom: 10 }}>
                    <div style={{ marginTop: 2 }}><Avatar nome={a.autor || "equipe"} size={28} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                        <b>{a.autor || "alguém"}</b> {RESUMO_ALTERACAO[a.tipo] || "mexeu no cadastro"}
                        {a.tipo === "cadastro" && a.alvo && (
                          <> — <span style={{ color: C.textSecondary }}>{a.alvo}</span></>
                        )}
                      </div>
                      {/* O DE-PARA, quando há. É a diferença entre "alguém
                          mexeu no telefone" e "alguém trocou este telefone por
                          aquele" — e é a segunda que responde a pergunta. */}
                      {(a.antes || a.depois) && (
                        <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                          {a.antes ? <s>{a.antes}</s> : <i>(vazio)</i>}
                          {" → "}
                          {a.depois ? a.depois : <i>(apagado)</i>}
                        </div>
                      )}
                      <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>{dataHoraDe(a.criado_em)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!historico.carregando && !historico.erro && (() => {
              const comEnvio = historico.linhas.filter((l) => l.primeira);
              // A PRIMEIRA e a ÚLTIMA de todas: a conta é entre os
              // telefones, e não dentro de um. Quem abriu a relação com o
              // cliente pode ter sido um telefone que hoje está calado.
              const primeira = comEnvio.reduce((m, l) =>
                (!m || new Date(l.primeira.criado_em) < new Date(m.primeira.criado_em)) ? l : m, null);
              const ultima = comEnvio.reduce((m, l) =>
                (!m || new Date(l.ultima.criado_em) > new Date(m.ultima.criado_em)) ? l : m, null);

              if (!comEnvio.length) {
                return (
                  <div style={{ fontSize: 13.5, color: C.textSecondary, lineHeight: 1.6 }}>
                    Ninguém do escritório enviou mensagem para este cliente ainda —
                    {historico.linhas.length
                      ? " a conversa existe, mas só com o que ele mandou."
                      : (historico.parcial
                          ? " não há conversa com ele nos telefones que você alcança (e não consegui consultar os outros agora)."
                          : " não há conversa com ele em nenhum telefone do escritório.")}
                  </div>
                );
              }
              const Marco = ({ rotulo, l, msg }) => {
                const quem = quemFalou(msg);
                return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>{rotulo}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Avatar nome={quem.nome || "equipe"} foto={quem.foto} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {quem.nome || "equipe"}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSecondary }}>
                        {dataHoraDe(msg.criado_em)} · por {l.adv ? comNumero(l.adv) : "telefone removido"}
                      </div>
                    </div>
                  </div>
                </div>
              );
              };
              return (
                <>
                  <Marco rotulo="Primeira mensagem enviada" l={primeira} msg={primeira.primeira} />
                  <Marco rotulo="Última mensagem enviada" l={ultima} msg={ultima.ultima} />
                  <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 14 }}>
                    <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>
                      Por telefone ({historico.linhas.length})
                    </div>
                    {historico.linhas.map((l) => (
                      <div key={l.conversaId} style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: "9px 11px", marginBottom: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>
                          {l.adv ? comNumero(l.adv) : "telefone removido"}
                        </div>
                        {l.ultima ? (
                          <>
                            <div style={{ fontSize: 12, color: C.textSecondary }}>
                              última: <b style={{ color: C.textPrimary, fontWeight: 600 }}>{l.ultima.enviado_por || "equipe"}</b> · {dataHoraDe(l.ultima.criado_em)}
                            </div>
                            <div style={{ fontSize: 12, color: C.textSecondary }}>
                              primeira: {l.primeira.enviado_por || "equipe"} · {dataHoraDe(l.primeira.criado_em)}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: C.textSecondary }}>ainda não respondemos por aqui</div>
                        )}
                        {/* VER A CONVERSA. O caminho curto entre "descobri que
                            falaram por outro telefone" e "quero ler o que
                            disseram" — que sem isto era: fechar o painel,
                            trocar de telefone na barra, procurar o cliente na
                            lista. A conversa aberta é a MESMA linha do
                            histórico, e não uma nova: nada é criado aqui.
                            No telefone que a pessoa não alcança, o botão não
                            aparece; a linha diz o motivo, em vez de abrir uma
                            conversa vazia que pareceria defeito. */}
                        {advogadosPermitidos.some((a) => String(a.id) === String(l.advogadoId)) ? (
                          <button onClick={() => verConversaDoHistorico(l)}
                                  style={{ marginTop: 7, border: `1px solid ${C.divider}`,
                                           background: "transparent", color: C.verdeTexto,
                                           borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                                           font: "inherit", fontSize: 12, fontWeight: 600,
                                           display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <MessageSquare size={13} />
                            {String(l.advogadoId) === String(advogadoId) ? "Ver a conversa" : "Abrir neste telefone"}
                          </button>
                        ) : (
                          <div style={{ marginTop: 6, fontSize: 11.5, color: C.textSecondary, fontStyle: "italic" }}>
                            você não tem acesso a este telefone
                          </div>
                        )}
                      </div>
                    ))}
                    {/* O aviso só aparece quando a lista ESTÁ mesmo
                        incompleta — quando a ponte não respondeu e o que se vê
                        é o recorte deste navegador. Fixo, ele faria a tela
                        desmentir a si mesma no caso normal, que agora é o de
                        mostrar o escritório inteiro. */}
                    {historico.parcial && (
                      <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5, marginTop: 4 }}>
                        Lista incompleta: não consegui falar com a ponte agora, então
                        aparecem só os telefones que você mesmo alcança. Tente de novo
                        em alguns segundos para ver o escritório inteiro.
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}


      {/* CONFIGURAÇÕES — perfil, aparência, sair e mensagens rápidas */}
      {configAberta && (
        <div onClick={() => { if (!rapidaForm && !tagForm && !contatoForm && !importando && !(abaConfig === "importar" && impArquivos.length)) setConfigAberta(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: estreito ? 0 : 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, height: estreito ? "100%" : "86vh", background: C.panel, borderRadius: estreito ? 0 : 12, overflow: "hidden", display: "flex", flexDirection: estreito ? "column" : "row", boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>
            {/* Menu à esquerda */}
            <div style={{ width: estreito ? "100%" : 210, background: C.headerBar, borderRight: estreito ? "none" : `1px solid ${C.divider}`, borderBottom: estreito ? `1px solid ${C.divider}` : "none", display: "flex", flexDirection: estreito ? "row" : "column", padding: estreito ? 8 : 14, gap: 4, overflowX: estreito ? "auto" : "visible", "--fita-fundo": C.headerBar }}
                 className={estreito ? "sem-scrollbar fita" : undefined}>
              <div style={{ fontSize: 16, fontWeight: 700, padding: "6px 10px 14px", color: C.textPrimary, display: estreito ? "none" : "block" }}>Configurações</div>
              {[["perfil", "Perfil"], ["aparencia", "Aparência"], ["contatos", "Contatos"], ["rapidas", "Mensagens rápidas"], ["tags", "Etiquetas"], ["importar", "Importar histórico"]].map(([k, label]) => (
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
                // `data-tela` para o teste apontar para DENTRO do perfil: a
                // busca da lista de conversas continua no DOM, atrás da janela,
                // e sem âncora o teste a encontrava e a tomava por um campo de
                // nome que eu tinha acabado de remover.
                <div data-tela="perfil" style={{ maxWidth: 420 }}>
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
                  {/* O NOME NÃO SE EDITA AQUI, pelo mesmo motivo do e-mail: é
                      cadastro de pessoa, e cadastro de pessoa mora no Vantoro.
                      Enquanto cada um escrevia o próprio, o mesmo atendente
                      aparecia de vários jeitos no relatório e não havia como
                      saber qual era o certo. */}
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, letterSpacing: 0.3 }}>NOME (não editável)</label>
                  <div style={{ marginTop: 6, marginBottom: 6, padding: "10px 12px", background: C.searchBg, borderRadius: 8, fontSize: 14, color: C.textPrimary, fontWeight: 600 }}>{meuNome}</div>
                  <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 18, lineHeight: 1.5 }}>
                    É o nome do seu cadastro no Vantoro, e é ele que assina tudo o que
                    você envia. Para mudar, fale com quem administra: a alteração é
                    feita lá e chega aqui na sua próxima entrada.
                  </div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, letterSpacing: 0.3 }}>E-MAIL (não editável)</label>
                  <div style={{ marginTop: 6, marginBottom: 20, padding: "10px 12px", background: C.searchBg, borderRadius: 8, fontSize: 14, color: C.textSecondary }}>{sessao?.user?.email || "—"}</div>
                  {/* Sem botão de salvar: a foto grava no instante em que é
                      escolhida, e não sobrou mais nada nesta aba para guardar.
                      Botão que não faz nada é pior do que botão nenhum. */}
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
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Etiquetas</div>
                      <div style={{ fontSize: 13, color: C.textSecondary }}>Etiquetas coloridas para organizar e filtrar as conversas.</div>
                    </div>
                    {!tagForm && (
                      <button onClick={() => setTagForm({ nome: "", cor: CORES_TAG[0] })} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}><Plus size={16} /> Nova</button>
                    )}
                  </div>

                  {tagForm ? (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{tagForm.id ? "Editar etiqueta" : "Nova etiqueta"}</div>
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
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: tagForm.cor, borderRadius: 4, padding: "2px 8px" }}>{tagForm.nome || "Nome da etiqueta"}</span>
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
                          const chaveQ = chaveDoNumero(q);
                          const lista = contatosLista.filter((c) => (c.nome || "").toLowerCase().includes(q)
                            || (chaveQ.length >= 4 && chaveDoNumero(c.numero).includes(chaveQ)));
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
                    data-zona-propria
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
        <div onClick={() => { setImagemAberta(null); setRetratoAberto(false); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.9)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: 16, right: 20, zIndex: 2, display: "flex", gap: 18, alignItems: "center" }}>
            {temGaleria && (
              <span style={{ color: "rgba(255,255,255,.75)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {posNaGaleria + 1} de {imagensDaConversa.length}
              </span>
            )}
            <button onClick={(e) => { e.stopPropagation(); baixarImagem(imagemAberta); }} title="Baixar imagem" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
              <Download size={26} />
            </button>
            <button onClick={() => { setImagemAberta(null); setRetratoAberto(false); }} title="Fechar" style={{ ...BOTAO_ICONE, color: "#fff" }}>
              <X size={28} />
            </button>
          </div>

          {/* TODO O RESTO DESTA TELA GANHOU `zIndex: 2` — estes botões, a
              barra de cima, as setas da galeria e a fita de miniaturas.
              Não é preferência: uma imagem com `transform` cria uma CAMADA
              PRÓPRIA de desenho e, por vir depois no documento, passa a ser
              desenhada POR CIMA dos irmãos posicionados. Ampliada, ela cobria
              os botões — e não só de vista: ela ENGOLIA os cliques. A pessoa
              apertava "+", chegava a 150%, e dali em diante o botão parava de
              responder, ali, visível, com toda a cara de funcionar.
              Quem achou isto foi a prova, tentando apertar o "+" pela segunda
              vez.

              OS BOTÕES DO ZOOM.
              À ESQUERDA, sozinhos, e não junto do baixar e do fechar: são os
              únicos daqui que a pessoa vai apertar VÁRIAS vezes seguidas, e um
              deles vizinho ao "fechar" acabaria fechando a foto no meio da
              leitura. À esquerda também sobra espaço no celular de 390 pixels,
              onde o canto direito já tem três coisas.

              QUARENTA E DOIS PIXELS de lado, que é o alvo que um dedo acerta
              sem mirar, e a PORCENTAGEM ESCRITA no meio — ela é o único jeito
              de saber onde se está, e é ela que responde "por que a foto está
              assim?" para quem pegou a tela ampliada de outra pessoa.

              O DO MEIO VOLTA AO NORMAL, e é a saída de quem se perdeu. Sem
              ele, quem ampliou seis vezes e se achou num canto branco da foto
              teria de apertar "−" cinco vezes para reencontrar o documento. */}
          <div data-zoom-controles onClick={(e) => e.stopPropagation()}
               style={{ position: "absolute", top: 14, left: 14, zIndex: 2, display: "flex",
                        alignItems: "center", gap: 2, background: "rgba(255,255,255,.14)",
                        borderRadius: 24, padding: 3 }}>
            <button data-zoom-menos aria-label="Diminuir" title="Diminuir (tecla −)"
                    disabled={zoom.escala <= ZOOM_MIN}
                    onClick={() => ampliarPara(degrauSeguinte(zoom.escala, -1))}
                    style={{ width: 42, height: 42, borderRadius: "50%", border: "none",
                             background: "transparent", color: "#fff", display: "flex",
                             alignItems: "center", justifyContent: "center",
                             cursor: zoom.escala <= ZOOM_MIN ? "default" : "pointer",
                             opacity: zoom.escala <= ZOOM_MIN ? 0.35 : 1 }}>
              <ZoomOut size={22} />
            </button>
            <button data-zoom-nivel aria-label="Voltar ao tamanho normal"
                    title="Voltar ao tamanho normal (tecla 0)"
                    onClick={() => { setSuave(true); setZoom(ZOOM_PARADO); }}
                    style={{ minWidth: 58, height: 42, borderRadius: 21, border: "none",
                             background: "transparent", color: "#fff", fontSize: 13,
                             fontWeight: 700, fontVariantNumeric: "tabular-nums",
                             cursor: "pointer" }}>
              {porcentagem(zoom.escala)}%
            </button>
            <button data-zoom-mais aria-label="Aumentar" title="Aumentar (tecla +)"
                    disabled={zoom.escala >= ZOOM_MAX}
                    onClick={() => ampliarPara(degrauSeguinte(zoom.escala, 1))}
                    style={{ width: 42, height: 42, borderRadius: "50%", border: "none",
                             background: "transparent", color: "#fff", display: "flex",
                             alignItems: "center", justifyContent: "center",
                             cursor: zoom.escala >= ZOOM_MAX ? "default" : "pointer",
                             opacity: zoom.escala >= ZOOM_MAX ? 0.35 : 1 }}>
              <ZoomIn size={22} />
            </button>
          </div>

          {/* As setas ficam nas BORDAS da tela, e não coladas na imagem: a
              imagem muda de tamanho a cada foto, e um botão que dança de lugar
              obriga a mirar de novo a cada clique. Some quando não há para onde
              ir — seta apagada que não faz nada é pior do que seta nenhuma. */}
          {temGaleria && posNaGaleria > 0 && (
            <button onClick={(e) => { e.stopPropagation(); andarNaGaleria(-1); }} title="Anterior (←)" aria-label="Imagem anterior"
                    style={{ position: "absolute", left: 18, top: "50%", zIndex: 2, transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={26} />
            </button>
          )}
          {temGaleria && posNaGaleria < imagensDaConversa.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); andarNaGaleria(1); }} title="Próxima (→)" aria-label="Próxima imagem"
                    style={{ position: "absolute", right: 18, top: "50%", zIndex: 2, transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight size={26} />
            </button>
          )}

          {/* A FOTO DE PERFIL PRECISA SER AMPLIADA; a da conversa, não.
              As duas caíam na mesma regra, e essa regra só dizia até onde a
              imagem podia CRESCER. Foto de conversa chega com 1500 ou 3000
              pixels de lado, e para ela é justamente esse teto que importa.
              Foto de perfil chega com 200 ou 300 — e, sem nada mandando
              ampliar, o navegador desenhava os 300 pixels no meio de uma tela
              de 1400. Era a "foto que abre pequena": ela não estava encolhida,
              estava do tamanho natural.
              `width` fixa com `height: auto` amplia mantendo a proporção; o
              `min()` impede que uma foto alta estoure a altura da janela.

              MAS AMPLIAR TEM LIMITE, e foi o segundo relato: "abre grande,
              porém embaçada". Nenhuma conta de estilo inventa pixel que a
              imagem não tem — esticar uma miniatura de 100 pixels até 520 dá
              exatamente isso. Então o teto passa a ser também o DOBRO do
              tamanho que a foto tem de verdade: 520 quando ela aguenta, menos
              quando não aguenta, e nunca menos de 300 (uma foto pequena que
              abre pequena volta a ser o defeito de antes).
              A causa de raiz é outra e está na ponte: era a MINIATURA que
              vinha sendo guardada, e não a foto cheia. Corrigido lá; as fotos
              já guardadas melhoram sozinhas quando o contato mandar a próxima
              mensagem. Este teto é o que faz o meio-tempo ficar apresentável. */}
          {/* O VISOR — o buraco por onde se olha a imagem.
              Ele existe para o zoom ter uma moldura: `overflow: hidden` é o que
              impede a foto ampliada de cobrir os botões e a fita de baixo, e o
              `touchAction: none` é o que faz a PINÇA ampliar a foto em vez de o
              navegador ampliar a página inteira.
              O clique no preto continua fechando, como sempre fechou — menos
              quando a foto está ampliada ou acabou de ser arrastada: aí o
              clique é o fim de um gesto, e fechar seria desfazer o trabalho de
              quem estava lendo. */}
          <div ref={visorRef} data-visor-zoom data-escala={zoom.escala.toFixed(2)}
               onClick={(e) => { if (zoomAtivo || gestos.current.mexeu) e.stopPropagation(); }}
               onDoubleClick={(e) => { e.stopPropagation(); alternarZoom(pontoNoVisor(e.clientX, e.clientY)); }}
               onMouseDown={(e) => {
                 if (!zoomAtivo) return;
                 e.preventDefault();
                 gestos.current.arrasto = { px: e.clientX, py: e.clientY };
                 gestos.current.mexeu = false;
                 setArrastandoImagem(true);
               }}
               onMouseMove={(e) => {
                 const g = gestos.current;
                 if (!g.arrasto) return;
                 const dx = e.clientX - g.arrasto.px, dy = e.clientY - g.arrasto.py;
                 g.arrasto.px = e.clientX; g.arrasto.py = e.clientY;
                 if (Math.abs(dx) + Math.abs(dy) > 2) g.mexeu = true;
                 empurrar(dx, dy);
               }}
               onMouseUp={() => { gestos.current.arrasto = null; setArrastandoImagem(false); }}
               onMouseLeave={() => { gestos.current.arrasto = null; setArrastandoImagem(false); }}
               style={{ flex: "1 1 auto", width: "100%", minHeight: 0, display: "flex",
                        alignItems: "center", justifyContent: "center", overflow: "hidden",
                        touchAction: "none",
                        cursor: zoomAtivo ? (arrastandoImagem ? "grabbing" : "grab") : "zoom-in" }}>
          {/* A FOTO DE PERFIL PRECISA SER AMPLIADA; a da conversa, não.
              (o comentário longo acima vale para o `style` de base; o
              `transform` do zoom vem depois dele e não o substitui) */}
          {/* O CLIQUE NA IMAGEM NUNCA FECHA — só o clique no preto em volta.
              Isso já era assim, e por um instante deixou de ser: eu havia
              tornado o `stopPropagation` condicional ao zoom, e com a foto no
              tamanho normal um clique nela fechava a tela. Pior ainda para o
              clique DUPLO, que é justamente o gesto de ampliar: o primeiro dos
              dois cliques fechava a imagem antes de o segundo chegar. */}
          <img ref={imagemRef} src={imagemAberta} alt={retratoAberto ? "Foto do contato" : "imagem"}
               onClick={(e) => e.stopPropagation()}
               data-retrato={retratoAberto ? "1" : undefined}
               draggable={false}
               onLoad={(e) => { if (retratoAberto) setLarguraDoRetrato(e.target.naturalWidth || 0); }}
               style={{
                 ...(retratoAberto
                   ? { width: `min(86vw, 74vh, ${larguraDoRetrato ? Math.max(300, Math.min(520, larguraDoRetrato * 2)) : 520}px)`,
                       height: "auto", borderRadius: 12, objectFit: "contain" }
                   : { maxWidth: "88%", maxHeight: temGaleria ? "76%" : "92%", borderRadius: 8, objectFit: "contain" }),
                 transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})`,
                 transformOrigin: "center center",
                 willChange: "transform",
                 // ANIMA O BOTÃO, NÃO O DEDO. Uma transição em cada quadro da
                 // pinça faz a imagem chegar sempre atrasada em relação à mão —
                 // e a sensação é de sistema travando, não de suavidade.
                 transition: suave ? "transform .16s ease-out" : "none",
                 userSelect: "none", WebkitUserSelect: "none",
               }} />
          </div>

          {/* BUSCAR A FOTO MAIOR.
              Só aparece quando a foto aberta é pequena DE VERDADE — abaixo dos
              400 pixels, que é o tamanho em que a ampliação começa a borrar.
              Um botão que aparecesse sempre viraria enfeite: na foto que já
              está boa ele não teria o que fazer, e a pessoa clicaria assim
              mesmo, esperando alguma coisa.
              A ponte vai perguntar à Uazapi de novo. Se o servidor não tiver
              nenhuma das rotas conhecidas, ela responde isso em português — o
              botão não fica girando para sempre. */}
          {retratoAberto && larguraDoRetrato > 0 && larguraDoRetrato < 400 && (
            <div onClick={(e) => e.stopPropagation()}
                 style={{ position: "absolute", bottom: 24, left: 0, right: 0, zIndex: 2, display: "flex",
                          flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12.5 }}>
                Esta foto foi guardada em tamanho pequeno ({larguraDoRetrato} pixels).
              </div>
              <button data-buscar-foto disabled={buscandoFoto}
                      onClick={buscarFotoMaior}
                      style={{ border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.12)",
                               color: "#fff", borderRadius: 20, padding: "8px 16px", fontSize: 13,
                               fontWeight: 600, cursor: buscandoFoto ? "default" : "pointer",
                               opacity: buscandoFoto ? .6 : 1 }}>
                {buscandoFoto ? "Buscando…" : "Buscar a foto maior"}
              </button>
              {erroDaFoto && (
                <div role="alert" style={{ color: "#ffb4a2", fontSize: 12.5, maxWidth: 420, textAlign: "center" }}>
                  {erroDaFoto}
                </div>
              )}
            </div>
          )}

          {/* A FITA. Rola sozinha até a imagem aberta, senão numa conversa com
              trinta fotos a marcada fica fora da vista e a fita parece travada. */}
          {temGaleria && (
            <div className="sem-scrollbar" onClick={(e) => e.stopPropagation()}
                 style={{ position: "absolute", bottom: 16, left: 0, right: 0, zIndex: 2, display: "flex", gap: 8, justifyContent: "safe center", overflowX: "auto", padding: "0 18px" }}>
              {imagensDaConversa.map((url, i) => (
                <button key={url + i} onClick={() => { setRetratoAberto(false); setImagemAberta(url); }}
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
      {/* "Solte aqui" — só enquanto há arquivo sobre a janela e nenhuma prévia
          aberta. `pointerEvents: none` porque uma cortina que recebe o mouse
          engole o próprio `drop` que ela está anunciando. */}
      {arrastandoArquivo && !anexosPendentes.length && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, pointerEvents: "none",
                      background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center" }}>
          <div style={{ border: `3px dashed ${C.green}`, borderRadius: 16, padding: "34px 46px",
                        background: C.panel, color: C.textPrimary, textAlign: "center" }}>
            <Paperclip size={30} color={C.green} />
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>Solte para anexar</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 3 }}>
              Foto, vídeo, áudio ou documento — pode soltar vários de uma vez.
            </div>
          </div>
        </div>
      )}

      {anexosPendentes.length > 0 && (() => {
        const atual = anexosPendentes[Math.min(anexoAtivo, anexosPendentes.length - 1)] || anexosPendentes[0];
        const trocarLegenda = (v) => setAnexosPendentes((antes) =>
          antes.map((a, i) => (i === anexoAtivo ? { ...a, legenda: v } : a)));
        return (
        <div data-previa-anexo onClick={fecharAnexoPendente} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.85)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
          <button onClick={(e) => { e.stopPropagation(); fecharAnexoPendente(); }} title="Cancelar" style={{ position: "absolute", top: 16, right: 20, background: "transparent", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
            <X size={28} />
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {atual.tipo === "imagem" && <img src={atual.url} alt="prévia" style={{ maxWidth: "100%", maxHeight: "50vh", borderRadius: 8, objectFit: "contain" }} />}
            {atual.tipo === "video" && <video src={atual.url} controls style={{ maxWidth: "100%", maxHeight: "50vh", borderRadius: 8 }} />}
            {atual.tipo === "audio" && <audio src={atual.url} controls style={{ width: "100%" }} />}
            {atual.tipo === "documento" && (
              comoPrever(atual.mime, atual.nome) ? (
                // DÁ PARA VER ANTES DE MANDAR. É o ponto todo desta tela: quem
                // manda dez procurações por dia precisa conferir se pegou a
                // certa, e o nome do arquivo quase nunca responde isso.
                <div data-previa-documento style={{ width: "100%", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
                  <iframe src={atual.url + (comoPrever(atual.mime, atual.nome) === "pdf" ? "#view=FitH" : "")}
                          title={atual.nome} style={{ width: "100%", height: "46vh", border: "none" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", color: "#222" }}>
                    <FileText size={18} />
                    <span style={{ flex: 1, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{atual.nome}</span>
                    <span style={{ fontSize: 12, opacity: .7 }}>
                      {nomeDoTipo(atual.mime, atual.nome)}
                      {tamanhoLegivel(atual.tamanho) ? ` · ${tamanhoLegivel(atual.tamanho)}` : ""}
                    </span>
                  </div>
                </div>
              ) : (
                // SEM PRÉVIA POSSÍVEL, o cartão diz o que dá para saber. Word,
                // Excel e PowerPoint não têm leitor no navegador, e mandá-los a
                // um conversor de fora seria despachar documento de cliente
                // para fora do escritório.
                <div data-cartao-documento style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "16px 20px" }}>
                  <FileText size={32} />
                  <span>
                    <span style={{ display: "block", fontSize: 15 }}>{atual.nome}</span>
                    <span style={{ display: "block", fontSize: 12.5, opacity: .75 }}>
                      {nomeDoTipo(atual.mime, atual.nome)}
                      {tamanhoLegivel(atual.tamanho) ? ` · ${tamanhoLegivel(atual.tamanho)}` : ""}
                    </span>
                  </span>
                </div>
              )
            )}
            {/* A TIRA DOS OUTROS ARQUIVOS. Só aparece havendo mais de um: com
                um arquivo só ela seria uma fileira de um item, que não ajuda
                ninguém e rouba altura da prévia. */}
            {anexosPendentes.length > 1 && (
              <div style={{ display: "flex", gap: 8, width: "100%", overflowX: "auto", paddingBottom: 4 }}>
                {anexosPendentes.map((a, i) => (
                  <div key={i} style={{ position: "relative", flex: "0 0 auto" }}>
                    <button onClick={() => setAnexoAtivo(i)} title={a.nome}
                      style={{ width: 58, height: 58, borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0,
                               border: `2px solid ${i === anexoAtivo ? C.green : "rgba(255,255,255,.25)"}`,
                               background: "rgba(255,255,255,.1)", display: "grid", placeItems: "center" }}>
                      {a.tipo === "imagem" ? <img src={a.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                       : a.tipo === "video" ? <video src={a.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                       : <FileText size={22} color="#fff" />}
                    </button>
                    {/* Tirar um do lote sem perder os outros. */}
                    <button onClick={(e) => { e.stopPropagation(); tirarAnexo(i); }} title={`Tirar ${a.nome}`}
                      style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                               border: "none", background: "#333", color: "#fff", cursor: "pointer",
                               display: "grid", placeItems: "center", fontSize: 12, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, width: "100%", background: C.headerBar, borderRadius: 10, padding: "8px 12px" }}>
              <input autoFocus value={atual.legenda || ""} onChange={(e) => trocarLegenda(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmarEnviarAnexo(); } }}
                placeholder={anexosPendentes.length > 1 ? `Legenda de ${atual.nome}…` : "Adicione uma legenda…"}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: C.textPrimary, fontSize: 14.5, padding: "8px 4px" }} />
              <button onClick={confirmarEnviarAnexo} title={anexosPendentes.length > 1 ? `Enviar os ${anexosPendentes.length}` : "Enviar"}
                style={{ border: "none", background: C.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 44, height: 44, borderRadius: 22, padding: "0 14px", flexShrink: 0 }}>
                <Send size={20} color="#fff" />
                {anexosPendentes.length > 1 && <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{anexosPendentes.length}</span>}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Toast discreto (avisos não bloqueantes) */}
      {aviso && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,.3)", zIndex: 120, maxWidth: "90%", textAlign: "center" }}>
          {aviso}
        </div>
      )}

      {/* A FAIXA DO QUE NÃO CARREGOU.
          Fica no ALTO e NÃO SOME sozinha, ao contrário do aviso acima — que
          dura quatro segundos e serve para confirmar um gesto ("Tag salva!").
          Aqui é outra coisa: a tela está mostrando MENOS do que existe, e isso
          continua valendo enquanto durar. Um aviso que pisca e some deixaria a
          pessoa trabalhando em cima de uma tela incompleta sem saber.
          Uma faixa só, somando tudo o que falhou: três avisos empilhados numa
          tela de atendimento viram ruído, e ruído se aprende a ignorar. */}
      {/* AS DUAS FAIXAS MORAM NA MESMA COLUNA.
          Cada uma era `position: fixed` no topo. Enquanto só havia uma, isso
          bastava; com duas, a segunda cairia EM CIMA da primeira e as duas
          ficariam ilegíveis justamente no momento em que as duas importam.
          Uma coluna só, e elas se empilham. */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 130,
                    display: "flex", flexDirection: "column" }}>
      {Object.keys(falhasDeLeitura).length > 0 && (
        <div data-falha-de-leitura
             style={{ background: "#8a5a00", color: "#fff", padding: "9px 14px",
                      fontSize: 13.5, display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 12, flexWrap: "wrap",
                      boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
          <span>
            Não consegui carregar {Object.values(falhasDeLeitura).map((f) => f.oQue).join(", ")}.
            {" "}O que está na tela pode estar incompleto.
            {(() => {
              // O CÓDIGO DO BANCO, quando há um. Ele é o que transforma "não
              // carregou" em algo que se procura — foi por um `42501` que o
              // caso de 04/09 se resolveu.
              const codigos = [...new Set(Object.values(falhasDeLeitura)
                .map((f) => f.codigo).filter(Boolean))];
              return codigos.length ? ` Código do banco: ${codigos.join(", ")}.` : "";
            })()}
          </span>
          <button data-tentar-leituras
                  onClick={() => {
                    carregarTags();
                    carregarTagsConversas();
                    carregarRapidas();
                    // As notas e a fila são lidas ao abrir a conversa: reabrir
                    // a que está aberta é o que as traz de volta.
                    if (conversaId) carregarMensagens(conversaId);
                  }}
                  style={{ border: "1px solid rgba(255,255,255,.6)", background: "transparent",
                           color: "#fff", borderRadius: 8, padding: "5px 14px",
                           fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* A FAIXA DO QUE PAROU.
          VERMELHA, e não âmbar como a de cima, porque diz outra coisa. A âmbar
          é sobre ESTA tela: o que você está vendo pode estar incompleto. Esta é
          sobre o SISTEMA: alguma coisa parou de andar, e o que está na tela
          está certo — é o mundo que não está.
          Sem botão de "tentar de novo". Não há gesto daqui que conserte uma
          linha desconectada ou uma ponte fora do ar, e oferecer um botão que
          não resolve é pior do que não oferecer nenhum. Ela some sozinha quando
          o problema passar, na pergunta seguinte. */}
      {(() => {
        const frases = frasesDaSaude(saude, souAdmin);
        if (!frases.length) return null;
        return (
          <div data-aviso-de-saude
               style={{ background: "#8e1c1c", color: "#fff", padding: "9px 14px",
                        fontSize: 13.5, display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 10, flexWrap: "wrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            {/* UMA FRASE POR LINHA quando há mais de uma. Emendadas, "a linha do
                Dr. X caiu" e "12 mensagens não saíram" viram um parágrafo que
                ninguém lê no meio de um atendimento. */}
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {frases.map((f, i) => <span key={i} data-frase-de-saude>{f}</span>)}
            </span>
          </div>
        );
      })()}
      </div>

      {/* Departamentos, telefones e permissões. Ao fechar, os cadastros são
          relidos: renomear um departamento tem de aparecer na hora, senão a
          pessoa acha que não salvou e faz de novo. */}
      {/* ENCAMINHAR — escolher para qual conversa.
          Lista as conversas do advogado aberto, e não a agenda inteira: quem
          encaminha está no meio de um atendimento, e o destino quase sempre é
          alguém com quem já se fala. Quem precisa de outro contato usa a Nova
          conversa e encaminha de lá. */}
      {/* AS TRÊS OPÇÕES, depois de escolher as mensagens. Perguntar aqui e não
          no menu é o que permite marcar cinco e responder uma vez só. */}
      {notaParaApagar && (
        <div onClick={() => setNotaParaApagar(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 95,
                   display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 380, maxWidth: "100%", background: C.panel, border: `1px solid ${C.divider}`,
                     borderRadius: 12, padding: "20px 22px", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary }}>Apagar esta nota interna?</div>
            <div style={{ fontSize: 13.5, color: C.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
              A conversa vai passar a mostrar que a nota foi apagada, e por quem.
              Fica registrado no histórico do cliente.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
              <button onClick={() => { const n = notaParaApagar; setNotaParaApagar(null); apagarNota(n); }}
                style={{ border: `1px solid ${C.divider}`, background: "transparent", color: "#e53935",
                         borderRadius: 8, padding: "11px 16px", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
                Apagar a nota
              </button>
              <button onClick={() => setNotaParaApagar(null)}
                style={{ border: "none", background: "transparent", color: C.textSecondary,
                         borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarApagar && (
        <div onClick={() => setConfirmarApagar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 95,
                   display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 380, maxWidth: "100%", background: C.panel, border: `1px solid ${C.divider}`,
                     borderRadius: 12, padding: "20px 22px", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary }}>
              Apagar {selecao?.length === 1 ? "a mensagem" : `as ${selecao?.length} mensagens`}?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
              <button onClick={() => apagarSelecionadas(true)}
                style={{ border: `1px solid ${C.divider}`, background: "transparent", color: "#e53935",
                         borderRadius: 8, padding: "11px 16px", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
                Apagar para todos
              </button>
              <button onClick={() => apagarSelecionadas(false)}
                style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                         borderRadius: 8, padding: "11px 16px", fontSize: 14.5, cursor: "pointer" }}>
                Apagar só no Zorvin
              </button>
              <button onClick={() => setConfirmarApagar(false)}
                style={{ border: "none", background: "transparent", color: C.textSecondary,
                         borderRadius: 8, padding: "11px 16px", fontSize: 14.5, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 14, lineHeight: 1.4 }}>
              "Para todos" tira também do celular do contato, e não tem volta.
              "Só no Zorvin" tira da conversa para o escritório inteiro; o contato continua com ela.
            </div>
          </div>
        </div>
      )}

      {encaminhar && (
        <div onClick={() => setEncaminhar(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 90,
                   display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 420, maxWidth: "100%", maxHeight: "min(70vh, 560px)", background: C.panel,
                     border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden",
                     display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.divider}` }}>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: C.textPrimary }}>Encaminhar para</div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {encaminhar.texto || rotuloMidia(encaminhar.tipo) || "Mensagem"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg,
                            borderRadius: 8, padding: "6px 12px", marginTop: 10 }}>
                <Search size={16} color={C.textSecondary} />
                <input autoFocus value={buscaEncaminhar} onChange={(e) => setBuscaEncaminhar(e.target.value)}
                  placeholder="Pesquisar conversa"
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 14,
                           flex: 1, color: C.textPrimary }} />
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {(() => {
                const q = buscaEncaminhar.trim().toLowerCase();
                const lista = conversas.filter((c) => c.id !== conversaId && !c.arquivada
                  && (!q || (nomeDoContato(c.contato) || "").toLowerCase().includes(q)
                          || (c.contato?.numero || "").includes(q.replace(/\D/g, ""))));
                if (!lista.length) return <div style={{ padding: 22, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>Nenhuma conversa encontrada.</div>;
                return lista.map((c) => (
                  <button key={c.id} onClick={() => enviarEncaminhada(c)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                             border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary,
                             textAlign: "left", borderBottom: `1px solid ${C.divider}` }}>
                    <Avatar nome={nomeDoContato(c.contato) || c.contato?.numero} foto={c.contato?.foto_url} size={40} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, overflow: "hidden",
                                     textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {nomeDoContato(c.contato) || c.contato?.numero}
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>+{c.contato?.numero}</span>
                    </span>
                    <Forward size={17} color={C.textSecondary} />
                  </button>
                ));
              })()}
            </div>
            <div style={{ padding: 10, borderTop: `1px solid ${C.divider}`, textAlign: "right" }}>
              <button onClick={() => setEncaminhar(null)}
                style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                         borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* POR QUAL TELEFONE FALAR — só quando o link do Vantoro chega e a
          pessoa alcança mais de um telefone do escritório. O link diz com QUEM
          falar; por ONDE falar muda o que o cliente vê chegar, e isso é
          decisão de gente, não do último telefone que por acaso ficou aberto. */}
      {escolhaTelefone && (
        <div onClick={() => setEscolhaTelefone(null)}
             style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 215, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ background: C.panel, color: C.textPrimary, borderRadius: 14, width: "100%", maxWidth: 440, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>Falar por qual telefone?</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
              Com {escolhaTelefone.contato?.nome || escolhaTelefone.nome || numeroBonito(escolhaTelefone.numero)}
              {escolhaTelefone.contato?.nome || escolhaTelefone.nome
                ? ` · ${numeroBonito(escolhaTelefone.numero)}` : ""}.
              {" "}É por este número que a mensagem vai chegar para o cliente.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: "52vh", overflowY: "auto" }}>
              {escolhaTelefone.opcoes.map(({ adv, temConversa, ultima }) => (
                <button key={adv.id}
                        onClick={async () => {
                          const e = escolhaTelefone;
                          setEscolhaTelefone(null);
                          await conversarPeloLink(e.contato, e.numero, e.nome, adv.id);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", width: "100%",
                                 border: `1px solid ${adv.id === advogadoId ? C.green : C.divider}`,
                                 background: C.inputBg, color: C.textPrimary, borderRadius: 10,
                                 padding: "9px 11px", cursor: "pointer", font: "inherit" }}>
                  <Avatar nome={adv.nome} foto={adv.foto_url} size={34} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {adv.nome}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>
                      {numeroBonito(adv.numero) || "sem número"}
                      {/* "já tem conversa" é o que faz a escolha ser informada:
                          é onde está o histórico, e quase sempre a resposta. */}
                      {temConversa
                        ? ` · já tem conversa${ultima ? ` · ${horaDe(ultima)}` : ""}`
                        : " · conversa nova"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setEscolhaTelefone(null)}
                      style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary, borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
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
                            onClick={() => { if (m.tipo === "imagem") { setMidiasAberta(false); setRetratoAberto(false); setImagemAberta(m.midia_url); } else { window.open(m.midia_url, "_blank", "noopener"); } }}
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

      {/* O Painel recebe os telefones e os departamentos já carregados: são os
          nomes das linhas do relatório, e refazer as consultas aqui daria uma
          segunda lista que pode divergir da que está na tela. */}
      {telaPainel && (
        <PainelNumeros C={C} modo={modo} advogados={advogados} departamentos={departamentos}
                       souAdmin={souAdmin} meuId={sessao?.user?.id || null} meuNome={meuNome}
                       aoFechar={() => setTelaPainel(false)} />
      )}
    </div>
  );
}

