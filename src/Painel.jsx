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
  History, BarChart3, Users, Smartphone,
  Image as ImageIcon, Video,
  Bold, Italic, Strikethrough, Code, ListOrdered, List, Quote, Volume2,
  ListChecks, Undo2, UserCheck, SquareKanban, BellRing, BellPlus, CircleCheck, RotateCcw
} from "lucide-react";
import { FORMATOS, calcularFormato, formatoDaTecla } from "./formatacao.js";
import FichaVantoro from "./FichaVantoro";
import { numeroCanonico, chaveDoNumero, porQueNaoRecebeWhatsApp, daParaChamar,
         telefoneLegivel } from "./numeros.js";
import { chamarPonte, ESPERA_PADRAO } from "./ponte.js";
import { useTemVantoro } from "./temVantoro.js";
import { useVocabulario } from "./vocabulario.js";
import { SONS, tocarAviso, somEscolhido, guardarSom,
         avisoNaTelaLigado, guardarAvisoNaTela } from "./avisos.js";
import { Chave } from "./Chave.jsx";
import { useVelocidadeDoAudio, proximaVelocidade, rotuloDaVelocidade } from "./velocidadeDoAudio.js";
import { PRAZO_DA_BUSCA, foiAbortada, funcaoNaoExiste,
         condicoesDeNome, recadoDaBusca } from "./busca.js";
import { comoPrever, nomeDoTipo, tamanhoLegivel, tipoServido, oQuadroDesenha,
         comecoDoTexto } from "./arquivos.js";
import { gravarSemAsQueFaltam, naoGravouNada, comOCodigo, semATabela } from "./gravar.js";

// O que este banco já disse que não tem, para não perguntar de novo a cada nota.
// Vale só nesta sessão: rodar o SQL que falta e apertar F5 devolve a coluna.
const COLUNAS_QUE_FALTAM_EM_NOTAS = new Set();
import { ZOOM_MIN, ZOOM_MAX, ZOOM_PARADO, ZOOM_DO_TOQUE_DUPLO, degrauSeguinte,
         porcentagem, limitarPosicao, zoomAncorado, distancia } from "./zoom.js";
import Departamentos from "./Departamentos";
import PainelNumeros from "./PainelNumeros";
import Funil from "./Funil";
import Tarefas from "./Tarefas.jsx";
import NovaTarefa from "./NovaTarefa.jsx";
import { situacao, ordenarAbertas, rotuloDaTarefa, fimDeHoje, semATabelaDeTarefas, quemTocaAgora,
         marcarAvisadas, chaveDoAviso } from "./tarefas.js";
import Marca from "./Marca";
import PainelEmoji, { guardarRecente } from "./Emojis";
import JaTratei from "./JaTratei.jsx";
import { nomeDoContato } from "./contato.js";
import { preencherVariaveis, usaVariaveis, variaveisDesconhecidas, VARIAVEIS } from "./variaveis.js";
import { diasDesde } from "./espera.js";
import { montarCaminho, duracaoLegivel } from "./caminhoNoFunil.js";
import EscolherHora from "./EscolherHora.jsx";
import { perguntarOsScripts, fraseDosScriptsParaAFaixa } from "./scriptsDoBanco.js";
import { rotuloDaHora, porQueNaoServe, semAColunaDaAgenda, aindaDaParaEditar } from "./agenda.js";

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

// QUANTAS LINHAS do "Já tratei" o histórico de um cliente lê. Cada clique
// grava uma linha por assunto marcado, então 300 linhas são, na prática, mais
// de cem cliques — anos de atendimento de uma pessoa só. Bater no teto não
// esconde nada calado: a seção diz que mostra só os mais recentes.
const LIMITE_DO_JA_TRATEI_NO_HISTORICO = 300;
// O CAMINHO NO FUNIL, no mesmo histórico: os passos mais recentes. Um cliente
// mexido todo dia por um ano passaria disso, e aí a seção diz que cortou.
const LIMITE_DO_CAMINHO_NO_HISTORICO = 300;

// COMO UM CONTATO SE CHAMA NA TELA — mora em `contato.js`, porque o relatório
// do "Já tratei" (no Painel de números) também escreve nome de cliente, e uma
// segunda regra de nome divergiria desta no primeiro conserto.

// ============================================================
//  HÁ QUANTOS DIAS ESTE CLIENTE ESPERA
//
//  Lê `conversas.esperando_desde`, que o banco mantém: a PRIMEIRA mensagem do
//  cliente depois da nossa última resposta. Escrever de novo não reinicia a
//  conta — é o Cliente A do relato de 25/09, que escreveu em 21/09 e em 24/09
//  e espera desde 21/09.
//
//  E DESDE 28/09 A CONTA IGNORA O RABICHO. O "Tomara a Deus" que chega um
//  minuto depois de a atendente responder não é uma espera — é o fim de uma
//  conversa que foi atendida. A espera passa a começar na primeira mensagem
//  que chega mais de 30 minutos depois da nossa última ação; e, se nenhuma
//  chegar depois disso, vale a regra de antes, para que ninguém saia da fila
//  em silêncio. A regra inteira está em `006-a-espera-nao-comeca-no-rabicho`,
//  no repo da ponte — a TELA não faz conta nenhuma disto, e é de propósito:
//  duas contas divergiriam, e divergir aqui é a lista dizer um número e o
//  banco outro sobre a mesma conversa.
//
//  DIAS CORRIDOS, decidido pelo Rodrigo: de 21/09 a 25/09 são quatro dias, com
//  o fim de semana dentro. É o que o cliente sente — ele não sabe se o
//  escritório abre no sábado.
//
//  E CONTA POR DIA DE CALENDÁRIO, e não por 24 horas cheias. Quem escreveu
//  ontem às 23h espera "1 dia", e não "0": a pergunta que a equipe faz é "de
//  quando é isto?", e a resposta é uma data, não um cronômetro. As duas contas
//  divergem justamente na mensagem da noite, que é a que mais aparece de manhã.
// ============================================================
/** "JENIFER ALMEIDA" → "JENIFER". A lista e o cabeçalho têm pouco espaço, e
 *  numa equipe de vinte pessoas o primeiro nome basta para saber quem é; o
 *  nome inteiro vai no `title`. */
function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

function diasEsperando(conversa) {
  // A CONTA mora em `espera.js`: o relatório por responsável a faz também, e
  // duas escritas diriam dois números sobre o mesmo cliente.
  return diasDesde(conversa && conversa.esperando_desde);
}

// ============================================================
//  A ORDEM DA LISTA — UMA RÉGUA SÓ, para os quatro lugares que reordenam
//
//  RELATO DE 30/09, com duas fotos: com "Esperando" escolhido, bastava abrir
//  uma conversa para a lista se embaralhar sozinha. Na primeira foto a fila
//  começava em "esperando há 48 dias"; um clique depois, no alto estava
//  "esperando há 7 dias" — a lista tinha virado "Recentes" sem ninguém pedir.
//
//  A CAUSA: o banco ordenava pela espera, e a TELA reordenava por conta
//  própria em outros três lugares — o tempo real, a conversa emendada pela
//  busca e a emenda das conversas de fora das páginas —, e os três só sabiam
//  a ordem por data da última mensagem. Abrir a conversa zera as não lidas, o
//  banco avisa pelo tempo real, e o tempo real reordenava a lista inteira
//  pela régua errada. A releitura seguinte (a volta do canal, a pesca de 20
//  segundos, trocar de filtro) reordenava de novo pela certa: a lista ia e
//  voltava, que é o "ficam se atualizando e mudando sozinhas".
//
//  Quatro escritas da mesma ordem foi exatamente o que deixou três delas para
//  trás quando a ordem nova entrou em 25/09. Hoje é esta, e só esta.
//
//  O DESEMPATE É O DO BANCO: quem não espera vai para o fim, e entre esses a
//  mais recente primeiro. Sem desempate, `Infinity - Infinity` dá `NaN`, e o
//  navegador decide sozinho a ordem de quem não espera — que muda a cada
//  reordenação, e é outra forma de a lista "mexer sozinha".
// ============================================================
/** O contato casa com o que foi digitado? PELOS MESMOS CAMPOS QUE O BANCO
 *  PROCUROU (nome do WhatsApp, nome do cadastro, nome dado no Zorvin) e pelo
 *  número. A tela refiltrava só pelo nome do WhatsApp (auditoria de 07/10): o
 *  banco achava a "ANDREIA" pelo cadastro, a tela a escondia por ela se chamar
 *  "Deus" no WhatsApp, e dizia "Nenhum contato salvo com esse nome" — e o
 *  bloco do Vantoro logo abaixo oferecia criar o mesmo número de novo. */
function contatoCasaComABusca(c, q, chaveQ) {
  return [c.nome, c.vantoro_nome, c.nome_zorvin].some((n) => String(n || "").toLowerCase().includes(q))
    || (chaveQ.length >= 4 && chaveDoNumero(c.numero).includes(chaveQ));
}

/** A BOLHA VERMELHA de um item da fila que não saiu — uma escrita só, para a
 *  abertura da conversa e para o aviso de tempo real (a agendada que falha na
 *  hora, auditoria de 07/10). */
function bolhaDaFilaQueFalhou(f, convId) {
  return ({
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
  });
}

function compararConversas(ordem, pelaEspera) {
  const sinal = ordem === "antigas" ? -1 : 1;
  const quando = (c) => {
    const t = c && c.ultima_atividade ? new Date(c.ultima_atividade).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };
  const recencia = (a, b) => sinal * (quando(b) - quando(a));
  const esperaEm = (c) => {
    const t = c && c.esperando_desde ? new Date(c.esperando_desde).getTime() : NaN;
    return Number.isNaN(t) ? null : t;
  };
  return (a, b) => {
    const fixa = (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0);
    if (fixa) return fixa;
    if (!pelaEspera) return recencia(a, b);
    const ea = esperaEm(a), eb = esperaEm(b);
    if (ea !== null && eb !== null) return (ea - eb) || recencia(a, b);
    if (ea !== null) return -1;
    if (eb !== null) return 1;
    return recencia(a, b);
  };
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
// QUANTO O CANAL PODE FICAR FORA ANTES DE A FAIXA ACENDER.
//
// Dez segundos. Uma reconexão comum passa por "fora" e volta em poucos
// segundos; acender ali faria a faixa piscar no meio do expediente por nada, e
// faixa que pisca à toa se aprende a ignorar — e aí a queda de verdade passa
// batida junto.
//
// A bancada encurta por `__CARENCIA_TEMPO_REAL`, e é só para isso que a
// variável existe: uma prova que esperasse os dez segundos de produção a cada
// cenário levaria um minuto para conferir o que se confere em três segundos.
// O CONTADOR DE NOMES DO CANAL VIVE FORA DO COMPONENTE, e isso é o conserto de
// um defeito que eu mesmo criei e a prova pegou: dentro do efeito, ele
// recomeçava do zero a cada montagem, e duas montagens pediam a MESMA sala
// ("zorvin-realtime-1") — uma nascendo enquanto a outra ainda saía, que é
// exatamente o atropelamento que este arquivo passou a evitar.
//
// Acontece de verdade sempre que o painel é remontado: sair e entrar, e o
// desenvolvimento, em que o React monta duas vezes de propósito.
let contaDeNomesDoCanal = 0;

// ============================================================
//  DE QUANTO EM QUANTO O PAINEL RELÊ ENQUANTO O TEMPO REAL ESTÁ FORA
//
//  Pedido do Rodrigo em 28/09, pela terceira vez: *"elimine essa mensagem
//  vermelha, isso já está acontecendo há muito tempo, resolva logo"*.
//
//  A faixa não mentia — enquanto ela aparecia, mensagem nova não chegava
//  sozinha. Esconder a faixa seria esconder isso, e o cliente ficaria sem
//  resposta com a tela calada. Mas MANTER a faixa por semanas também não
//  resolve nada: alarme que não pede ação se aprende a ignorar, e este não
//  pede — não há gesto do atendente que conserte o canal.
//
//  Então o conserto não é a faixa: é a CONSEQUÊNCIA. Com o canal fora, o
//  painel passa a reler sozinho de 20 em 20 segundos. As mensagens voltam a
//  chegar sem ninguém clicar — mais devagar, e chegam. Aí a frase "as
//  mensagens novas não estão chegando sozinhas" deixou de ser verdade, e é
//  por isso que ela pôde sair: não foi escondida, foi resolvida.
//
//  VINTE SEGUNDOS, e não cinco: cada releitura são ~5 consultas, e oito
//  atendentes a cinco segundos seriam 8 consultas por segundo num banco de
//  plano gratuito — trocaríamos um defeito por outro. Vinte dá 2/s, e só
//  enquanto o canal está fora.
//
//  E ela só começa DEPOIS da carência, aproveitando o relógio que já existia:
//  um soluço de reconexão de três segundos não merece uma rodada de consultas.
// ============================================================
const CADENCIA_DA_PESCA_MS =
  (typeof globalThis !== "undefined" && globalThis.__CADENCIA_DA_PESCA) || 20000;

const CARENCIA_TEMPO_REAL_MS =
  (typeof globalThis !== "undefined" && globalThis.__CARENCIA_TEMPO_REAL) || 10000;

// ============================================================
//  DE QUANTO EM QUANTO O PAINEL REFAZ O CANAL QUE NÃO VOLTOU
//
//  "Estamos reconectando" era uma promessa que o painel não cumpria: quem
//  reconectava era a biblioteca, sozinha, e o painel só olhava.
//
//  Na maioria das quedas isso basta — o canal erra, agenda outra tentativa e
//  volta. MENOS NUM CAMINHO, e ele está escrito no código da biblioteca
//  (`RealtimeChannel.subscribe`): quando o servidor devolve um conjunto de
//  assinaturas diferente do que foi pedido, ela faz
//
//      this.unsubscribe();           // e o `leave()` ZERA o relógio de retentativa
//      callback(CHANNEL_ERROR, new Error('mismatch between server and client
//                                         bindings for postgres changes'));
//
//  O canal fica morto. Nada mais tenta, e o painel segue prometendo que está
//  reconectando — para sempre. Só recarregar a página resolve, e ninguém sabe
//  disso porque a tela diz o contrário. Acontece, por exemplo, depois de uma
//  publicação do Realtime do Supabase.
//
//  Agora o painel refaz o canal ele mesmo. Funciona justamente porque a
//  biblioteca deixou o canal FECHADO: um canal fechado aceita ser assinado de
//  novo (um errado, não — `subscribe` só age `if (isClosed())`).
//
//  AS ESPERAS CRESCEM. Refazer é uma ida à rede e uma nova inscrição; insistir
//  de segundo em segundo com o serviço fora é bater na porta de quem já não
//  está atendendo.
const ESPERAS_DE_VOLTA =
  (typeof globalThis !== "undefined" && globalThis.__ESPERAS_DE_VOLTA)
  || [15000, 30000, 60000, 120000];

// ============================================================

// ============================================================
//  A LARGURA DA COLUNA DA ESQUERDA
//
//  Eram 380px, medidos em 16/09 quando a tela tinha DUAS colunas. Com a ficha
//  fixa (28/09) são três, e o Rodrigo pediu espaço para a conversa: a 1360 ela
//  tinha caído para ~590px.
//
//  ESCREVI 320 AQUI DIZENDO QUE "não corta nada", E A PROVA ME DESMENTIU.
//  A 320 a marca ficava com 96px para um nome que pede 134, e a tela dizia
//  "Ropelimi Zo" — o MESMO defeito registrado em 16/09, que eu tinha acabado
//  de reintroduzir por não medir de novo depois de encolher a coluna.
//
//  A CONTA DA LINHA DA MARCA, medida a 1360 (é ela que manda, não a lista):
//
//    marca 134 + "Nova conversa" 34 + filtro de quem 34
//    + a ordem + menu ⋮ 34 + quatro vãos de 3 = 12
//
//  E A ORDEM NÃO TEM LARGURA FIXA: "Recentes" custa 53 de texto, "Antigas"
//  44 e "Esperando" 62. Quem manda é a MAIS LARGA — medir com a de hoje e
//  achar que cabe é o defeito voltando no dia em que alguém trocar a ordem.
//  Sem o ícone, a pílula mais larga custa 82.
//
//  Dá 330, mais 20 de recheio da coluna = 350 de piso. 360 deixa 10px de
//  folga — e folga aqui não é luxo: o corte não põe reticências, então a
//  marca some pelo meio da palavra sem nada avisando.
//
//  POR QUE NÃO 320: não há de onde tirar os 38px que faltam. A fita de
//  filtros tem 18px livres e a ordem pede 95; a linha da marca já está com
//  tudo no menor tamanho que o ponteiro acerta. Abaixo de 350 é preciso
//  TIRAR algo do topo, e isso é decisão do Rodrigo, não minha.
// ============================================================
const LARGURA_DA_LISTA = 360;

// A FICHA FIXA FICA GUARDADA NO NAVEGADOR. Padrão LIGADO: `!== "nao"`, como a
// chave da tarja — armazenamento vazio (primeira abertura, janela anônima,
// cache limpo) é "ninguém escolheu ainda", e o pedido era que ela ficasse
// fixa. Tratar a ausência como recolhido esconderia a ficha de todo mundo que
// nunca mexeu nisso, que é o contrário do que foi pedido.
const CHAVE_FICHA_FIXA = "zorvin_ficha_fixa";
function lerFichaFixa() {
  try { return localStorage.getItem(CHAVE_FICHA_FIXA) !== "nao"; } catch (_) { return true; }
}
function guardarFichaFixa(fixa) {
  try { localStorage.setItem(CHAVE_FICHA_FIXA, fixa ? "sim" : "nao"); } catch (_) { /* ver acima */ }
}

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

// A RECUSA CALADA TAMBÉM DESLIGA O RECURSO.
//
// `desligarRecurso` só desliga quando FALTA COLUNA, porque foi para isso que
// ele nasceu. A regra de acesso é outra coisa: o banco aceita o pedido e
// atualiza zero linhas, sem erro nenhum. Sem esta segunda porta, o pulso de 60
// segundos do "estou atendendo" continuaria batendo no banco para sempre — por
// atendente e por conversa aberta — escrevendo nada, e ninguém saberia, porque
// este recurso é invisível de propósito.
//
// NÃO VALE PARA A LIMPEZA DA SAÍDA. Lá a gravação leva `.eq('atendendo_por',
// eu)`, e zero linhas é o caso LEGÍTIMO de outra pessoa já ter entrado na
// conversa — desligar ali tiraria o recurso de quem está trabalhando certo.
function desligarPorRecusa(nome) {
  if (!RECURSOS[nome]) return;
  RECURSOS[nome] = false;
  console.info(`Zorvin: o recurso "${nome}" ficou desligado nesta sessão — a gravação passou `
    + "sem erro e não alterou nenhuma linha (é a regra de acesso). Confira as políticas "
    + "da tabela no Supabase e recarregue a página.");
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

// ============================================================
//  O MOTIVO DA QUEDA, ENCURTADO PARA CABER NUMA FAIXA
//
//  O erro inteiro vai para o console (ver `aoMudarDeEstado`); aqui fica o que
//  se digita numa mensagem para quem conserta. A régua é a de `comOCodigo`,
//  em `gravar.js`: a frase curta MAIS o código.
//
//  O ESTADO SOZINHO JÁ É PISTA, e por isso ele sai mesmo sem erro nenhum —
//  `TIMED_OUT` e `CHANNEL_ERROR` pedem providências opostas de quem lê. Foi
//  esse o engano que este projeto já cometeu de três jeitos: tratar como uma
//  coisa só duas falhas que mandam procurar defeito em lugares diferentes.
//
//  E ELE É CORTADO EM 110 LETRAS. A biblioteca do Realtime chega a devolver
//  uma pilha inteira, e uma faixa vermelha com dez linhas de erro é uma faixa
//  que ninguém lê — inclusive a parte que importa, que vem na frente.
const LIMITE_DO_MOTIVO = 110;
function resumirMotivo(estado, erro) {
  const cru = !erro ? "" : (typeof erro === "string" ? erro : (erro.message || String(erro)));
  const texto = String(cru).trim().replace(/\s+/g, " ");
  if (!texto) return String(estado || "").trim() || "sem motivo";
  const curto = texto.length > LIMITE_DO_MOTIVO
    ? texto.slice(0, LIMITE_DO_MOTIVO - 1) + "\u2026"
    : texto;
  return estado ? `${estado}: ${curto}` : curto;
}

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

  // O TEMPO REAL FORA NÃO APARECE MAIS AQUI, e isso é conserto, não omissão.
  //
  //  A frase dizia "as mensagens novas não estão chegando sozinhas". Ela era
  //  verdade, e por isso a faixa ficou de pé por semanas — até o Rodrigo pedir
  //  pela terceira vez, em 28/09, que ela saísse.
  //
  //  O que mudou é que ela deixou de ser verdade: com o canal fora, o painel
  //  passou a RELER sozinho de 20 em 20 segundos (ver CADENCIA_DA_PESCA_MS).
  //  As mensagens chegam — mais devagar, e chegam. Uma faixa vermelha sobre um
  //  problema que não tem mais consequência para quem lê é exatamente o alarme
  //  que se aprende a ignorar, e aí o próximo passa batido junto.
  //
  //  O QUE NÃO SE PERDEU:
  //   - o motivo da queda continua indo para o console, com o estado e a
  //     mensagem da biblioteca (ver `aoMudarDeEstado`) — é de lá que sai o
  //     diagnóstico da causa, que segue em aberto;
  //   - a releitura que falha continua acendendo a faixa ÂMBAR
  //     (`data-falha-de-leitura`), que é a que diz "esta tela está
  //     incompleta". Se a pesca também não passar, a tela fala.
  //
  //  Ou seja: ninguém fica sem aviso quando há algo a fazer. Some o aviso de
  //  um problema que o painel passou a contornar sozinho.

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

// ============================================================
//  O VAZIO QUE AINDA PODE ENCHER, E O QUE NÃO PODE MAIS
//
//  A tela dizia "indisponível" para duas coisas opostas: o arquivo que chega em
//  dois minutos e o que não existe mais. Quem atende ficava esperando,
//  recarregando, esperando mais — e no segundo caso esperava por nada, sem ter
//  como saber que precisava pedir ao cliente que mandasse de novo.
//
//  `midia_erro` é a resposta definitiva da Uazapi, gravada pela ponte. Ela só é
//  preenchida quando a resposta NÃO MUDA com o tempo ("esta mensagem não tem
//  arquivo"); uma falha passageira continua sendo tentada e não marca nada. Por
//  isso dá para confiar nela a ponto de mandar alguém pedir de novo.
//
//  A frase curta é a que cabe na bolha. O motivo técnico vai no `title`, para
//  quem passar o mouse — ele não interessa a quem atende, e interessa muito a
//  quem for investigar.
// ============================================================
function anexoPerdido(m) {
  return Boolean(m && m.midia_erro && !m.midia_url);
}
function textoDoAnexoVazio(m) {
  return anexoPerdido(m) ? "não veio — peça para reenviar" : "indisponível";
}

function filtrarPermitidos(telefones, permissoes, ehAdmin, erro) {
  // A LINHA DESATIVADA SAI DAQUI PARA TODO MUNDO, inclusive para quem
  // administra. Desta lista sai tudo o que a tela OFERECE — começar conversa
  // nova, encaminhar, escolher o departamento —, e a ponte recusa enviar por
  // uma linha desativada. Oferecer o gesto seria deixar alguém escrever uma
  // resposta inteira para ela virar bolha vermelha depois.
  //
  // As conversas antigas dela continuam alcançáveis, por outro caminho e só
  // para quem administra: ver `desativadosVisiveis`.
  const ativos = (telefones || []).filter((a) => a.ativo !== false);
  if (ehAdmin) return ativos;
  if (erro) return [];
  return ativos.filter((a) => (permissoes || []).some(
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

// OS BOTÕES DA LINHA DA MARCA SÃO MENORES — NO COMPUTADOR, e só nele.
//
// Naquela linha cabem a marca e três controles em 356px, e com os 40px de
// sempre a marca ficava com 122 para um nome que pede 134: saía "Ropelimi Zo",
// cortado no meio da palavra, sem nem as reticências que avisariam que faltou
// pedaço. Aqui são 34, que continua sendo alvo confortável de ponteiro.
//
// NO CELULAR ISTO NÃO VALE, e não é descuido: a regra de `@media` lá embaixo
// devolve os 40px a todo botão abaixo de 768px, e vence este objeto porque vem
// com `!important`. O dedo continua com o alvo que o dedo precisa; quem abre
// mão dos 6px é o ponteiro, que não erra.
const ICONE_DO_TOPO = { minWidth: 34, minHeight: 34, padding: 7 };

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
  // DIA/MÊS OU MÊS/DIA? (auditoria de 07/10) O celular em inglês dos EUA
  // exporta "1/22/24, 3:45 PM": lido como dia/mês, virava 1º de outubro de
  // 2025, sem erro nenhum — o histórico entrava com as datas e a ordem
  // erradas. A decisão é do ARQUIVO INTEIRO, e não de cada linha: um número
  // maior que 12 na primeira posição prova dia/mês, na segunda prova mês/dia;
  // sem prova, o AM/PM aponta o formato americano, e sem ele vale o de sempre.
  let provaDiaMes = false, provaMesDia = false, temAmPm = false;
  for (const linha of linhas) {
    const m = reAndroid.exec(linha) || reIOS.exec(linha);
    if (!m) continue;
    if (+m[1] > 12) provaDiaMes = true;
    if (+m[2] > 12) provaMesDia = true;
    if (m[7]) temAmPm = true;
  }
  const mesPrimeiro = !provaDiaMes && (provaMesDia || temAmPm);
  const out = [];
  let atual = null;
  const fechar = () => { if (atual) { out.push(atual); atual = null; } };
  for (const linha of linhas) {
    const m = reAndroid.exec(linha) || reIOS.exec(linha);
    if (m) {
      fechar();
      const dd = mesPrimeiro ? +m[2] : +m[1], MM = mesPrimeiro ? +m[1] : +m[2]; let ano = +m[3];
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

// O SOM SAIU DAQUI e virou `avisos.js`, onde a equipe escolhe qual é. O bipe
// fixo de 880 Hz atendia uma pessoa; num escritório onde oito sentam perto, o
// som de uma é o incômodo da outra — e som que incomoda é desligado no volume
// da máquina, o que desliga junto o aviso que importa.

// Notificação na área de trabalho (se o atendente autorizou).
//
// A ETIQUETA É POR CONVERSA, e não uma só para o Zorvin inteiro.
//
// Era `tag: "zorvin"`: cada aviso substituía o anterior, então duas pessoas
// diferentes escrevendo ao mesmo tempo viravam UM aviso — o da segunda,
// apagando o da primeira sem deixar rastro. Com a etiqueta por conversa, cada
// conversa tem o seu aviso, e a rajada de cinco mensagens do mesmo cliente
// atualiza aquele aviso em vez de empilhar cinco.
function notificarDesktop(titulo, corpo, conversaId) {
  try {
    // A CHAVE É PERGUNTADA AQUI DENTRO, e não em quem chama.
    //
    // É a única porta por onde a tarja sai, e num lugar só ela não tem como
    // ser esquecida no dia em que aparecer um segundo motivo para notificar.
    //
    // E LÊ O ARMAZENAMENTO, e não um estado do React: esta função vive fora do
    // componente, e o que vale é o que a pessoa escolheu — inclusive numa
    // OUTRA aba do Zorvin aberta na mesma máquina, que não compartilha estado
    // nenhum com esta.
    if (!avisoNaTelaLigado()) return;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(titulo, {
        body: corpo,
        tag: conversaId ? `zorvin-conversa-${conversaId}` : "zorvin",
      });
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
// conversa para rolar um PDF sem querer. (`inteira` é a prévia grande, antes
// de mandar um anexo: ali não há link por baixo, e rolar o PDF é o ponto.)
//
// QUANDO NÃO DÁ, NÃO NASCE NADA. Word, Excel e PowerPoint não têm leitor
// nativo, e mandá-los a um conversor de terceiros seria despachar documento de
// cliente para fora do escritório. Nesses, `comoPrever` devolve nulo e a bolha
// fica com o cartão de sempre — que agora ao menos diz o tipo por extenso.
//
// E O IFRAME SÓ NASCE DEPOIS DE PERGUNTAR (29/09). Montado direto, ele BAIXAVA
// o CSV e o PDF servido sem tipo, só de a conversa abrir — ver "Abrir a
// conversa não pode baixar nada", em `src/arquivos.js`. Agora o PDF espera o
// servidor dizer `application/pdf`, e o texto nem usa iframe: é lido e
// escrito na bolha.
//
// A pergunta sai quando a bolha chega PERTO DA TELA, como o `loading="lazy"`
// que o iframe já tinha: uma conversa de cliente antigo tem dezenas de anexos
// lá em cima, e ninguém rolou até eles.
function PreviaDeArquivo({ C, url, mime, nome, altura = 150, inteira = false }) {
  const como = comoPrever(mime, nome);
  const caixa = useRef(null);
  const [perto, setPerto] = useState(inteira);
  // `undefined` = ainda não sei; `null` = não dá; texto ou tipo = deu.
  const [achado, setAchado] = useState(undefined);

  useEffect(() => {
    if (perto || !caixa.current) return;
    if (typeof IntersectionObserver === "undefined") { setPerto(true); return; }
    const vigia = new IntersectionObserver((vistos) => {
      if (vistos.some((v) => v.isIntersecting)) { setPerto(true); vigia.disconnect(); }
    }, { rootMargin: "400px" });
    vigia.observe(caixa.current);
    return () => vigia.disconnect();
  }, [perto, como]);

  useEffect(() => {
    setAchado(undefined);
    if (!perto || !url || (como !== "pdf" && como !== "texto")) return;
    let vivo = true;
    const pergunta = como === "pdf" ? tipoServido(url) : comecoDoTexto(url, inteira ? 65536 : 4096);
    pergunta.then((r) => { if (vivo) setAchado(r); });
    return () => { vivo = false; };
  }, [perto, url, como, inteira]);

  if (!url || !como) return null;

  const moldura = {
    height: altura, width: "100%", background: C.searchBg,
    borderBottom: inteira ? "none" : `1px solid ${C.divider}`, overflow: "hidden",
    display: "grid", placeItems: "center",
  };

  if (como === "imagem") {
    return (
      <div style={moldura} data-previa-arquivo="imagem">
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  // ENQUANTO NÃO SEI, UM ESPAÇO VAZIO DO MESMO TAMANHO — e não nada: a bolha
  // que cresce 150px depois de desenhada empurra a conversa para baixo no
  // meio da leitura.
  if (achado === undefined) {
    return <div ref={caixa} style={moldura} data-previa-arquivo="esperando" />;
  }

  if (como === "texto") {
    // NÃO DEU PARA LER: fica o cartão, sem prévia. Nunca um iframe "para
    // tentar" — é ele que baixa.
    if (achado === null) return null;
    return (
      <div style={{ ...moldura, display: "block", background: "#fff" }} data-previa-arquivo="texto">
        <pre style={{ margin: 0, padding: "8px 10px", height: "100%", boxSizing: "border-box",
                      overflow: inteira ? "auto" : "hidden", whiteSpace: "pre-wrap",
                      wordBreak: "break-word", fontSize: inteira ? 12.5 : 10.5, lineHeight: 1.35,
                      color: "#222", fontFamily: "ui-monospace, Consolas, monospace",
                      pointerEvents: inteira ? "auto" : "none" }}>
          {achado}
        </pre>
      </div>
    );
  }

  const leitor = typeof navigator !== "undefined" ? navigator.pdfViewerEnabled : undefined;
  if (!oQuadroDesenha(como, achado, leitor)) return null;

  // `#toolbar=0…` esconde os controles do leitor: numa miniatura de 150px eles
  // ocupariam metade da altura e não servem para nada — o arquivo abre inteiro
  // com um clique. São ignorados por quem não os entende, sem quebrar nada.
  const endereco = inteira ? `${url}#view=FitH` : `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div style={{ ...moldura, position: "relative" }} data-previa-arquivo="pdf">
      <iframe src={endereco} title={nome || "prévia"} tabIndex={inteira ? 0 : -1}
              style={{ width: "100%", height: "100%", border: "none",
                       pointerEvents: inteira ? "auto" : "none", background: "#fff" }} />
    </div>
  );
}

function BolhaAudio({ C, saida, url, m }) {
  const velocidade = useVelocidadeDoAudio();
  const tocador = useRef(null);
  // AS DUAS, E DE NOVO A CADA ARQUIVO CARREGADO: o navegador devolve
  // `playbackRate` ao `defaultPlaybackRate` sempre que carrega o áudio, e o
  // arquivo só carrega no primeiro play. Pondo só a primeira, o 2x escolhido
  // antes de tocar voltaria a 1x no instante em que o áudio começa.
  const aplicar = useCallback(() => {
    const a = tocador.current;
    if (!a) return;
    a.defaultPlaybackRate = velocidade;
    a.playbackRate = velocidade;
  }, [velocidade]);
  useEffect(aplicar, [aplicar, url]);

  // ------------------------------------------------------------
  //  A TRANSCRIÇÃO, AO CLICAR (pedido da equipe, 02/10)
  //
  //  Quem fala com o Groq é a PONTE (a chave mora lá); a bolha só pede. E só
  //  AO CLICAR: transcrever todo áudio que chega pagaria pelos que ninguém
  //  precisou ler.
  //
  //  O texto que a ponte guardou volta em `m.transcricao` na próxima leitura
  //  da conversa, e aí aparece direto, sem botão — a equipe inteira lê o que
  //  uma pessoa transcreveu, sem pagar de novo. O estado daqui é só o desta
  //  sessão, para o texto aparecer na hora do clique.
  //
  //  O ERRO É DITO NA PRÓPRIA BOLHA, com a frase da ponte (que diz o que
  //  fazer: a chave que falta, o limite do Groq), e o botão continua lá para
  //  tentar de novo. Um clique que falha calado se repete até a pessoa
  //  desistir achando que o recurso não existe.
  // ------------------------------------------------------------
  const [transcrita, setTranscrita] = useState(null);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [erroDaTranscricao, setErroDaTranscricao] = useState(null);
  const textoTranscrito = transcrita || (m && m.transcricao) || null;
  // A BOLHA PROVISÓRIA (o áudio que eu acabei de gravar) ainda não existe no
  // banco: a ponte não teria o que ler, e o botão viraria um "não achei".
  const daParaTranscrever = Boolean(url && m && m.id != null && !String(m.id).startsWith("temp-"));
  async function transcrever() {
    if (transcrevendo || !daParaTranscrever) return;
    setTranscrevendo(true);
    setErroDaTranscricao(null);
    try {
      // ESPERA LONGA: a ponte pode estar acordando na Render, e um áudio de
      // vários minutos leva seu tempo no Groq.
      const r = await chamarPonte("/transcrever", {
        method: "POST", body: JSON.stringify({ mensagem_id: m.id }), espera: 120000,
      });
      const texto = String((r && r.texto) || "").trim();
      if (texto) setTranscrita(texto);
      else setErroDaTranscricao("O áudio não tem fala que desse para transcrever.");
    } catch (e) {
      setErroDaTranscricao((e && e.message) || "Não consegui transcrever agora. Tente de novo.");
    } finally {
      setTranscrevendo(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {url ? (
        <>
          <audio ref={tocador} controls src={url} onLoadedMetadata={aplicar}
                 style={{ height: 32, maxWidth: "min(220px, 100%)", minWidth: 0 }} />
          {/* O BOTÃO DIZ A VELOCIDADE DE AGORA, como o do WhatsApp: um botão
              que só troca e não conta em que estado está faz "achei
              estranho" virar "está quebrado". */}
          <button type="button" data-velocidade-audio={velocidade} onClick={proximaVelocidade}
                  title="Velocidade do áudio — clique para trocar"
                  aria-label={`Velocidade do áudio: ${rotuloDaVelocidade(velocidade)}. Clique para trocar.`}
                  style={{ flexShrink: 0, minWidth: 38, height: 24, padding: "0 7px", borderRadius: 12,
                           border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                           background: velocidade === 1 ? C.searchBg : C.green,
                           color: velocidade === 1 ? C.textSecondary : "#fff" }}>
            {rotuloDaVelocidade(velocidade)}
          </button>
        </>
      ) : (
        <>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.searchBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Mic size={16} color={C.textSecondary} />
          </div>
          <span title={(m && m.midia_erro) || undefined}
                data-anexo-vazio={anexoPerdido(m) ? "perdido" : "esperando"}
                style={{ fontSize: 12, color: C.textSecondary, fontStyle: "italic" }}>
            Áudio {textoDoAnexoVazio(m)}
          </span>
        </>
      )}
    </div>
    {textoTranscrito ? (
      <div data-transcricao style={{ maxWidth: 280, fontSize: 13, lineHeight: 1.4, color: C.textPrimary,
                                     whiteSpace: "pre-wrap", wordBreak: "break-word",
                                     borderLeft: `3px solid ${C.green}`, paddingLeft: 7, marginTop: 2 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.textSecondary }}>Transcrição</span>
        {textoTranscrito}
      </div>
    ) : daParaTranscrever && (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button type="button" data-transcrever onClick={transcrever} disabled={transcrevendo}
                title="Transformar este áudio em texto"
                style={{ alignSelf: "flex-start", border: "none", background: "transparent", padding: "2px 0",
                         cursor: transcrevendo ? "default" : "pointer", color: C.verdeTexto || C.green,
                         fontSize: 12.5, fontWeight: 600 }}>
          {transcrevendo ? "Transcrevendo…" : (erroDaTranscricao ? "Tentar transcrever de novo" : "Transcrever")}
        </button>
        {erroDaTranscricao && (
          <span data-transcricao-erro style={{ maxWidth: 280, fontSize: 12, color: "#e53935", lineHeight: 1.35 }}>
            {erroDaTranscricao}
          </span>
        )}
      </div>
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
  // CLICAR NA CITAÇÃO LEVA ATÉ A CITADA. Mora no `Painel` porque precisa da
  // lista de mensagens e de ir ao banco buscar as anteriores; aqui só chega a
  // função, como todo o resto.
  aoIrParaCitada,
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
            {m.resposta_previa && (() => {
              // ------------------------------------------------------------
              //  A CITAÇÃO LEVA ATÉ A MENSAGEM CITADA — quando há para onde ir.
              //
              //  `responder_id_uazapi` é o elo, e ele NEM SEMPRE EXISTE: as
              //  respostas gravadas antes de a ponte aprender o formato certo
              //  da Uazapi têm a prévia e não têm o id. Sem ele não há para
              //  onde levar — e um bloco que parece botão e não faz nada é
              //  pior do que um bloco que não parece botão.
              //
              //  Por isso são DUAS formas: `button` quando há elo (com o
              //  cursor, o foco de teclado e o `title` que dizem que se
              //  clica), `div` quando não há. O desenho é o mesmo nos dois.
              const temParaOndeIr = !!m.responder_id_uazapi && !!aoIrParaCitada;
              const dentro = (<>
                <div style={{ color: C.verdeTexto, fontWeight: 600, fontSize: 12 }}>{m.resposta_autor === "advogado" ? "Você" : (conversa.contato?.nome || "Contato")}</div>
                <div style={{ color: C.textSecondary, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{m.resposta_previa}</div>
              </>);
              const traje = {
                borderLeft: `3px solid ${C.green}`,
                background: saida ? "rgba(0,0,0,.06)" : C.searchBg,
                borderRadius: 4, padding: "3px 8px", marginBottom: 4,
                textAlign: "left", display: "block", width: "100%",
                border: "none", borderLeftWidth: 3, borderLeftStyle: "solid",
                borderLeftColor: C.green,
              };
              if (!temParaOndeIr) {
                return <div data-citacao style={traje}>{dentro}</div>;
              }
              return (
                <button data-citacao data-citacao-leva-a={m.responder_id_uazapi}
                        title="Ir para a mensagem citada"
                        onClick={(e) => {
                          // O CLIQUE NÃO PODE VIRAR SELEÇÃO. A linha inteira da
                          // bolha tem um `onClick` que marca a mensagem quando o
                          // modo de seleção está ligado; sem parar aqui, clicar
                          // na citação marcaria a resposta em vez de ir para a
                          // citada.
                          e.stopPropagation();
                          aoIrParaCitada(m.responder_id_uazapi);
                        }}
                        style={{ ...traje, cursor: "pointer" }}>
                  {dentro}
                </button>
              );
            })()}
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
            {/* IMAGEM SEM ARQUIVO NÃO DESENHAVA NADA.
                A condição era `tipo === "imagem" && midia_url`: sem arquivo, a
                bolha saía VAZIA — nem moldura, nem palavra. O cliente mandou
                uma foto e a conversa não mostra que mandou. É o mesmo defeito
                que a figurinha teve e que foi consertado ali embaixo; a imagem
                ficou de fora, e a medição de 11/09 achou cinco delas assim nos
                anexos vazios do escritório. */}
            {m.tipo === "imagem" && !m.midia_url && (
              <div title={m.midia_erro || undefined}
                   data-anexo-vazio={anexoPerdido(m) ? "perdido" : "esperando"}
                   style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary,
                            background: saida ? "rgba(0,0,0,.06)" : C.searchBg,
                            borderRadius: 6, padding: "8px 10px", fontSize: 13, fontStyle: "italic" }}>
                <ImageIcon size={18} color={C.textSecondary} /> Imagem {textoDoAnexoVazio(m)}
              </div>
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
                  <Sticker size={18} color={C.textSecondary} />
                  <span title={m.midia_erro || undefined}
                        data-anexo-vazio={anexoPerdido(m) ? "perdido" : "esperando"}>
                    Figurinha {textoDoAnexoVazio(m)}
                  </span>
                </div>
              )
            )}
            {m.tipo === "audio" && <BolhaAudio C={C} saida={saida} url={m.midia_url} m={m} />}
            {m.tipo === "video" && m.midia_url && (
              <video controls preload="none" src={m.midia_url} style={{ maxWidth: "min(260px, 62vw)", borderRadius: 6, display: "block" }} />
            )}
            {/* E O VÍDEO PELO MESMO MOTIVO. Ele não apareceu na medição porque
                são poucos, e não porque estivesse certo. */}
            {m.tipo === "video" && !m.midia_url && (
              <div title={m.midia_erro || undefined}
                   data-anexo-vazio={anexoPerdido(m) ? "perdido" : "esperando"}
                   style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary,
                            background: saida ? "rgba(0,0,0,.06)" : C.searchBg,
                            borderRadius: 6, padding: "8px 10px", fontSize: 13, fontStyle: "italic" }}>
                <Video size={18} color={C.textSecondary} /> Vídeo {textoDoAnexoVazio(m)}
              </div>
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
                  <span title={m.midia_erro || undefined}
                        data-anexo-vazio={anexoPerdido(m) ? "perdido" : "esperando"}
                        style={{ fontSize: 11, color: C.textSecondary, fontStyle: "italic", flexShrink: 0 }}>
                    {textoDoAnexoVazio(m)}
                  </span>
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
  // A aba em que a administração abre: a de sempre pelo menu, e a das
  // atualizações do banco quando quem abre é a faixa vermelha.
  const [abaDaAdmin, setAbaDaAdmin] = useState("estrutura");
  // O QUE A PONTE FEZ COM OS SCRIPTS DO BANCO AO SUBIR (`GET /scripts/estado`),
  // só para quem administra. `null` = ainda não se sabe, e não acende nada.
  // Ver `scriptsDoBanco.js`.
  const [scriptsDoBanco, setScriptsDoBanco] = useState(null);
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
  // O ESPELHO, para o efeito da troca de conversa saber — sem entrar nas
  // dependências dele — que a caixa guarda uma EDIÇÃO, e não um rascunho.
  const editandoRef = useRef(null);
  editandoRef.current = editando;
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
  // SE A PERGUNTA AO CADASTRO AINDA ESTÁ NO AR.
  //
  // A busca tem dois tempos: o banco responde em milissegundos, o Vantoro leva
  // dezenas de segundos quando a Render está acordando. `buscando` cobre o
  // primeiro e sai assim que o banco responde — de propósito, para a lista não
  // ficar refém do cadastro. Este cobre o segundo, e existe por uma razão só:
  // sem ele a tela, entre um e outro, escreve "Nada encontrado para essa
  // busca" com a segunda pergunta ainda no ar. Ver o comentário na frase.
  const [vendoNoCadastro, setVendoNoCadastro] = useState(false);
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
  // EXISTE VANTORO NESTA INSTALAÇÃO? `null` enquanto a ponte não respondeu.
  // Seis lugares desta tela só fazem sentido com ele; sem ele viram botão que
  // abre coluna vazia e "Procurando…" que não termina em nada. A pergunta e as
  // três respostas estão explicadas em `temVantoro.js`.
  // ============================================================
  //  DE QUEM É ESTA CONVERSA — para saber a quem o aviso interessa
  //
  //  O aviso de mensagem nova era filtrado pelo TELEFONE ABERTO na barra
  //  lateral. Com isso, a atendente que respondeu um cliente ontem, na linha do
  //  Dr. B, não era avisada quando ele voltava a escrever — bastava ela estar
  //  olhando a linha do Dr. A. O pedido da equipe (15/09) é justamente esse:
  //  avisar das conversas em que a pessoa interagiu, e não das que estão à
  //  vista.
  //
  //  ------------------------------------------------------------
  //  A RESPOSTA VEM DAS PRÓPRIAS MENSAGENS, e não de uma função nova
  //
  //  "Participei desta conversa" é "já mandei alguma coisa nela", e isso está
  //  em `mensagens.enviado_por_id`. Uma função no banco responderia igual e
  //  custaria um script a mais para rodar — e no dia em que isto foi escrito o
  //  Supabase estava fora do ar, o que deixa claro o valor de não depender de
  //  um passo manual para um recurso de tela.
  //
  //  ------------------------------------------------------------
  //  UMA PERGUNTA POR CONVERSA, E NÃO POR MENSAGEM
  //
  //  Perguntar a cada mensagem que chega seria uma ida à rede por mensagem, o
  //  dia inteiro, por atendente. A resposta fica guardada aqui e vale para as
  //  seguintes daquela conversa.
  //
  //  E O PRÓPRIO TEMPO REAL MANTÉM O GUARDADO EM DIA: quando alguém do
  //  escritório escreve numa conversa, essa mensagem chega a todos os painéis
  //  — então dá para marcar ali que ela deixou de ser órfã, sem perguntar nada
  //  ao banco.
  // ============================================================
  const deQuemEhAConversa = useRef(new Map());

  const temVantoro = useTemVantoro();
  // COMO ESTA INSTALAÇÃO CHAMA QUEM É DONO DE UM TELEFONE. No escritório é
  // "advogado", e sem a tabela continua sendo — ver `vocabulario.js`.
  const voc = useVocabulario();
  // Ficha do cliente no Vantoro (abre ao lado da conversa).
  // ============================================================
  //  A FICHA É UMA TERCEIRA COLUNA FIXA — pedido do Rodrigo em 28/09
  //
  //  Antes ela era um botão: ligada, ela ESCONDIA a lista de conversas. Não
  //  eram três colunas, eram duas (lista OU ficha), e quem quisesse ver o
  //  cadastro perdia a fila de quem está esperando.
  //
  //  Agora ela nasce aberta em toda conversa e tem uma seta para recolher.
  //
  //  SÃO DOIS ESTADOS, E NÃO UM, por causa do celular. Abaixo de 768px não
  //  cabem três colunas: lá a ficha toma a tela inteira, e nascer aberta
  //  faria abrir uma conversa mostrar o CADASTRO no lugar da conversa. No
  //  computador ela é uma preferência guardada; no celular é um gesto de
  //  cada vez, que não se guarda.
  //
  //  Derivar `fichaVisivel` dos dois — em vez de um estado só corrigido por
  //  um efeito ao redimensionar — evita o piscar: girar o celular ou
  //  encostar a janela nos 768px não faz a ficha abrir e fechar sozinha.
  //
  //  A PREFERÊNCIA É POR NAVEGADOR, como o som do aviso: quem atende do
  //  monitor grande quer a ficha à vista, e quem atende do notebook de 1280
  //  talvez não. Guardar no banco faria a escolha de uma máquina valer na
  //  outra, e uma leitura a mais na abertura.
  // ============================================================
  const [fichaFixa, setFichaFixa] = useState(lerFichaFixa);
  const [fichaAberta, setFichaAberta] = useState(false);
  // "Histórico de atendimento": quem falou com este cliente, quando e por qual
  // telefone do escritório. `null` = fechado.
  const [historico, setHistorico] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false); // exibindo a lista de arquivadas
  const [contatosLista, setContatosLista] = useState([]); // todos os contatos (agenda)
  // A LEITURA DA AGENDA QUE FALHOU não é "nenhum contato salvo" (armadilha nº 2).
  const [erroContatos, setErroContatos] = useState("");
  // A RESPOSTA MAIS NOVA VENCE: digitando, uma busca lenta de "and" chegava
  // depois da de "andreia" e a sobrescrevia.
  const pedidoContatosRef = useRef(0);
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
    try {
      const guardada = localStorage.getItem("zorvin_ordem");
      return guardada === "antigas" || guardada === "esperando" ? guardada : "recentes";
    } catch (_) { return "recentes"; }
  });
  // ============================================================
  //  A COLUNA DA ESPERA EXISTE NESTE BANCO?
  //
  //  TRÊS ESTADOS, e pela mesma razão de `temVantoro.js`: `null` é "ainda não
  //  sei" — lista vazia, nada a ordenar — e esconde. Começar em `true` faria a
  //  ordem nova aparecer e QUEBRAR a consulta num banco onde o SQL ainda não
  //  foi rodado; a lista de conversas sumiria inteira por causa de um recurso
  //  que nem foi instalado.
  //
  //  E a resposta sai das LINHAS QUE JÁ VIERAM, sem consulta própria: a lista
  //  pede `*`, então `esperando_desde` vem junto quando existe, e o PostgREST
  //  escreve a chave mesmo com o valor nulo. Uma ida à rede a cada abertura
  //  para uma resposta que já está na mão seria trabalho de sobra no caminho
  //  mais quente desta tela.
  // ============================================================
  const [temEspera, setTemEspera] = useState(null);
  // ============================================================
  //  A PERGUNTA QUE A CONSULTA FAZ — UM BOOLEANO, E NÃO OS DOIS ESTADOS
  //
  //  MEDIDO em 25/09, e foi a prova `partida` que pegou: com `temEspera` cru
  //  nas dependências de `carregarConversas`, TODA abertura recarregava a
  //  lista — porque `temEspera` sai de `null` para `true`/`false` em toda
  //  partida, e isso muda a identidade da função. A tela media 11 consultas
  //  em duas rodadas e 1.461 ms de espera, com a ida mais lenta em 745.
  //
  //  O comentário que eu tinha escrito dizia "uma ida a mais, só para quem
  //  escolheu essa ordem". Não era: era para todo mundo, sempre.
  //
  //  Reduzido a este booleano, o caminho comum (`ordem` diferente de
  //  "esperando") vale `false` antes e depois da resposta — nada muda, e não
  //  há segunda ida. Quem escolheu a fila de espera vê `false` virar `true`
  //  uma vez, e é aí que a lista precisa mesmo ser refeita.
  // ============================================================
  const ordenarPelaEspera = ordem === "esperando" && temEspera === true;
  // O TEMPO REAL PRECISA DA MESMA PERGUNTA, e por espelho: o tratador é
  // registrado uma vez e ficaria preso na resposta daquele instante.
  const ordenarPelaEsperaRef = useRef(ordenarPelaEspera);
  ordenarPelaEsperaRef.current = ordenarPelaEspera;
  // ============================================================
  //  "JÁ TRATEI" — a saída da fila que não é mandar mensagem
  //
  //  MEDIDO em 25/09, com a fila já cheia: de 813 conversas esperando, 601
  //  eram "nós respondemos e o cliente escreveu de volta" — e o que ele
  //  escreveu por último era `[anexo]` em 99 delas, "ok" em 42, "obrigada"
  //  em 9. Ou seja: ~140 são espera de verdade e ~94 são despedida, e o banco
  //  não tem como saber a diferença. Quem sabe é quem leu a conversa.
  //
  //  DOIS ESTADOS DO BANCO, e são perguntas diferentes:
  //
  //    `temTratada`  a coluna `conversas.tratada_em` existe?  (script 005)
  //    `temAssuntos` a tabela `zorvin_assuntos` respondeu?    (script 005)
  //
  //  Separados porque o script pode estar meio aplicado — a tabela nasce fora
  //  do bloco guardado, a coluna dentro dele. Oferecer o botão sem a coluna
  //  seria oferecer um gesto que não tira ninguém da fila.
  //
  //  `temAssuntos` segue a régua de `temVantoro.js`: `true` quer dizer "tem,
  //  OU não consegui saber". Esconder por falha de rede tiraria a saída da
  //  fila no dia em que a rede tossisse, sem uma palavra na tela — a
  //  armadilha nº 2. Mostrando, o pior caso é abrir a janela e ler o erro.
  // ============================================================
  const [temTratada, setTemTratada] = useState(null);
  // ============================================================
  //  O RESPONSÁVEL PELA CONVERSA (30/09) — o primeiro passo do CRM
  //
  //  Até aqui o painel sabia quem ESCREVEU numa conversa e quem está com ela
  //  aberta agora, mas não quem responde por aquele cliente. Sem um dono não
  //  há "as minhas conversas", não há passar um cliente para outra pessoa, e
  //  não há como cobrar a fila de ninguém.
  //
  //  `temResponsavel` tem três estados, pela régua de `temTratada`: a coluna
  //  vem do script 008 (repo da ponte), e sem ela o recurso NÃO aparece —
  //  oferecer "assumir" num banco que não tem onde guardar seria um botão que
  //  diz "pronto" e não grava nada.
  //
  //  A sonda é a mesma das outras colunas: a presença da chave na primeira
  //  linha que a lista trouxe (o PostgREST escreve a chave mesmo com valor
  //  nulo). Nenhuma consulta a mais.
  // ============================================================
  const [temResponsavel, setTemResponsavel] = useState(null);
  const temResponsavelRef = useRef(null);
  useEffect(() => { temResponsavelRef.current = temResponsavel; }, [temResponsavel]);
  const [menuResponsavel, setMenuResponsavel] = useState(false);
  const responsavelRef = useRef(null);
  const [assuntos, setAssuntos] = useState([]);
  // A LEITURA DOS ASSUNTOS QUE FALHOU (auditoria de 07/10). Sem isto a janela
  // dizia "Nenhum assunto cadastrado — quem administra cria a lista", mandando
  // o administrador criar o que já existe, e o botão nunca ligava.
  const [erroAssuntos, setErroAssuntos] = useState("");
  const [temAssuntos, setTemAssuntos] = useState(null);
  // ---- O FUNIL DE ETAPAS (script 017 da ponte) ----
  //
  // `temFunil` tem TRÊS estados, pela régua de `temAssuntos`: `null` ainda não
  // perguntei, `false` o script não rodou (42P01), `true` existe OU não
  // consegui saber — esconder por falha de rede sumiria com o funil inteiro
  // no dia em que a rede tossisse.
  const [temFunil, setTemFunil] = useState(null);
  const [telaFunil, setTelaFunil] = useState(false);
  // A ETAPA DA CONVERSA ABERTA: `{ chave, carregando, etapas, cartao, erro }`,
  // e `chave` = contato|departamento — é o que identifica um cartão.
  const [funilDaConversa, setFunilDaConversa] = useState(null);
  // O menu da etapa tem os DOIS endereços do menu do responsável: "linha" (no
  // computador, pendurado na linha do número) e "menu" (pelo ⋮).
  const [menuEtapa, setMenuEtapa] = useState(false);
  const etapaRef = useRef(null);
  // ---- TAREFAS E LEMBRETES (script 018) ----
  //
  // `temTarefas` tem os três estados de `temFunil`: `null` ainda não
  // perguntei, `false` o script não rodou, `true` existe OU não consegui
  // saber — esconder por falha de rede sumiria com os lembretes de todo mundo
  // no dia em que a rede tossisse.
  const [temTarefas, setTemTarefas] = useState(null);
  const [telaTarefas, setTelaTarefas] = useState(false);
  // AS TAREFAS DA CONVERSA ABERTA: `{ conversaId, carregando, lista, erro }`.
  const [tarefasDaConversa, setTarefasDaConversa] = useState(null);
  // O menu das tarefas tem os dois endereços dos outros menus da linha do
  // número: "linha" (computador) e "menu" (pelo ⋮).
  const [menuTarefa, setMenuTarefa] = useState(false);
  const tarefaRef = useRef(null);
  // A JANELA DE CRIAR/EDITAR: `null`, ou `{ tarefa }` (tarefa nula = nova).
  const [janelaTarefa, setJanelaTarefa] = useState(null);
  // AS MINHAS ABERTAS, relidas de minuto em minuto: é delas que saem o número
  // da barra lateral e o aviso na hora.
  const [minhasTarefas, setMinhasTarefas] = useState([]);
  // O FILTRO "Com tarefa para hoje": as conversas com tarefa aberta que vence
  // até o fim do dia (atrasadas incluídas), e as que as páginas lidas não têm.
  const [idsTarefaHoje, setIdsTarefaHoje] = useState(null);
  const [extrasTarefas, setExtrasTarefas] = useState([]);
  // AS ETAPAS DE CADA DEPARTAMENTO, guardadas: mudam quase nunca, e perguntar
  // a cada conversa aberta seria uma ida a mais por clique. Fechar a tela do
  // funil esquece o guardado — é lá que quem administra acabou de mexer.
  const etapasPorDep = useRef(new Map());
  const [jaTratei, setJaTratei] = useState(null);      // a conversa com a janela aberta
  const [trateiOcupado, setTrateiOcupado] = useState(false);
  const [trateiErro, setTrateiErro] = useState("");
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
  // ============================================================
  //  AS MENSAGENS AGENDADAS DA CONVERSA ABERTA (pedido de 02/10)
  //
  //  `temAgenda` tem TRÊS estados, como `temTratada`: `null` ainda não sei,
  //  `false` o script 013 não rodou (o relógio não aparece), `true` tem. Sem a
  //  coluna, oferecer agendar seria deixar a pessoa escolher a hora e ver a
  //  gravação morrer no fim — o gesto oferecido e negado, a pior ordem.
  //
  //  `escolhendoHora` é DE ONDE veio o pedido: "texto" (a caixa de escrever)
  //  ou "anexo" (a prévia dos arquivos). A janela é uma só.
  // ============================================================
  const [temAgenda, setTemAgenda] = useState(null);
  const [agendadas, setAgendadas] = useState([]);
  const [escolhendoHora, setEscolhendoHora] = useState(null);
  // A AGENDADA SENDO EDITADA (pedido de 05/10): o item da fila, ou nulo.
  const [editandoAgendada, setEditandoAgendada] = useState(null);
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

  // OS ESPELHOS DE `mensagens` E `temMaisAntigas`.
  //
  // `irParaCitada` atravessa um `await` — ela pode ir ao banco buscar as
  // anteriores antes de achar a citada. O que estava no fecho quando ela
  // começou já envelheceu quando ela volta: procurar ali seria procurar na
  // lista de ANTES de carregar, que é justamente a que não tem a mensagem.
  const mensagensRef = useRef([]);
  const temMaisAntigasRef = useRef(false);
  const [buscandoAntigas, setBuscandoAntigas] = useState(false);
  const buscandoAntigasRef = useRef(false);
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
  const textoDaRapidaRef = useRef(null); // a caixa do texto, para pôr a variável onde está o cursor
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

  // ============================================================
  //  O TEMPO REAL QUE CAI — e o painel que passa a reler sozinho
  //
  //  Caindo a conexão, as mensagens novas param de aparecer, e a tela de uma
  //  conversa sem mensagem nova é IDÊNTICA à de uma conversa em que o cliente
  //  não respondeu. A pessoa fica olhando, esperando, e conclui a coisa errada.
  //
  //  Até 28/09 a resposta a isso era uma FAIXA VERMELHA avisando. Ela era
  //  verdadeira e ficou semanas de pé, porque não há gesto do atendente que
  //  conserte o canal — o alarme que não pede ação, exatamente. Hoje a
  //  resposta é outra: o painel RELÊ sozinho enquanto o canal está fora (ver
  //  `CADENCIA_DA_PESCA_MS`), as mensagens voltam a chegar, e a faixa saiu
  //  porque a frase dela deixou de ser verdade.
  //
  //  Não há estado de tela para isto, e é de propósito: não há nada que a
  //  tela precise dizer. O motivo da queda vai para o console, e a releitura
  //  que falhar acende a faixa âmbar de sempre.
  // ============================================================

  // O QUE RELER, GUARDADO NUM ESPELHO E NÃO NAS DEPENDÊNCIAS DO CANAL.
  //
  // `carregarMensagens` muda de identidade a cada conversa aberta. Pô-la nas
  // dependências do efeito do canal derrubaria e reassinaria o canal a cada
  // conversa — que é exatamente o defeito descrito lá embaixo, o das trinta
  // janelas de silêncio numa manhã. O espelho deixa o efeito rodar uma vez só
  // e ainda assim chamar a versão de agora.
  const reporRef = useRef(() => {});
  // "O canal JÁ esteve fora nesta montagem?" — é o que separa a primeira
  // assinatura (a tela acabou de carregar, não há o que repor) de uma volta
  // depois de uma queda (há uma fresta de eventos que não chegou a ninguém).
  const caiuRef = useRef(false);

  const limparFalhaDeLeitura = useCallback((chave) => {
    setFalhasDeLeitura((antes) => {
      if (!(chave in antes)) return antes;   // nada mudou: não redesenha
      const novo = { ...antes };
      delete novo[chave];
      return novo;
    });
  }, []);
  const [filtro, setFiltro] = useState("tudo"); // aba/filtro da lista: 'tudo' | 'naolidas' | 'favoritas' | 'tag:<id>' | 'frente:<FRENTE>'
  // O filtro de agora, para quem é chamado fora do desenho (a releitura das
  // tarefas depois de um clique).
  const filtroRef = useRef("tudo");
  useEffect(() => { filtroRef.current = filtro; }, [filtro]);
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
  const etiquetasRef = useRef(null);
  const departamentosRef = useRef(null); // seletor de departamento (fecha ao clicar fora)

  const C = TEMAS[modo];
  const estreito = largura < 768; // layout de celular: mostra lista OU conversa
  // O ESPELHO DO LAYOUT, refeito a cada desenho. Efeitos que reagem à troca
  // de conversa precisam saber se estamos no celular, e pôr `estreito` nas
  // dependências deles faria cada redimensionamento da janela disparar o
  // efeito da conversa — apagando rascunho e rolando a tela por causa de um
  // arrastar de borda.
  const estreitoRef = useRef(estreito);
  estreitoRef.current = estreito;

  // A FICHA À VISTA SAI DOS DOIS ESTADOS, e não de um. Ver o comentário de
  // `fichaFixa`, lá em cima: no computador vale a preferência guardada; no
  // celular, o gesto desta vez.
  const fichaVisivel = estreito ? fichaAberta : fichaFixa;

  // ============================================================
  //  O CABEÇALHO DA CONVERSA APERTA QUANDO NÃO CABE
  //
  //  Relato do Rodrigo em 28/09, com foto: a lupa da busca aparecia POR BAIXO
  //  da ficha. Medido: o bloco do nome já tinha encolhido a ZERO (na foto vê-se
  //  o avatar "EG" e nenhum nome), e os botões sozinhos passavam da borda.
  //
  //  A conta: os dois botões ESCRITOS — "Marcar como não lida" e "Já tratei" —
  //  custam ~280px dos ~550 que a fila de botões precisa. Com a ficha fixa
  //  ocupando 330px, a conversa não tem esses 550 num monitor de 1300.
  //
  //  Apertado, os dois viram ÍCONE. Não somem: continuam com `title` e
  //  `aria-label`, e no celular continuam escritos dentro do menu ⋮ — esconder
  //  um botão que a equipe usa todo dia seria trocar um defeito visível por um
  //  invisível.
  //
  //  A conta é de LARGURA, e não de medir o DOM: medir exigiria desenhar,
  //  medir e redesenhar, e a tela piscaria com os rótulos aparecendo e sumindo
  //  a cada abertura de conversa.
  // ============================================================
  const larguraDaConversa = largura - 60
    - (estreito ? 0 : LARGURA_DA_LISTA)
    - (!estreito && fichaVisivel ? 330 : 0);

  // ============================================================
  //  QUEM TEM PRIORIDADE NO CABEÇALHO É O NOME, E NÃO OS BOTÕES
  //
  //  Relato do Rodrigo em 29/09, com foto: com a ficha aberta a tela dizia
  //  "ELANE GO…". O teto de 620 que estava aqui mandava os botões virarem
  //  ícone, e nada mais — quando nem assim cabia, quem apanhava era o nome.
  //
  //  MEDIDO, com a ficha aberta, e o degrau é o que denuncia o desenho antigo:
  //
  //  | janela | conversa | rótulos  | o nome recebe |
  //  |--------|----------|----------|---------------|
  //  | 1280   | 528      | ícones   | 166           |
  //  | 1366   | 614      | ícones   | 252           |
  //  | 1440   | 688      | ESCRITOS | 199           |
  //
  //  Alargar a janela de 1366 para 1440 PIORAVA o nome: os rótulos voltavam e
  //  custavam ~127px, tirados de quem não pode pagar.
  //
  //  Agora a conta parte do nome. Ele tem um piso, e é o piso que decide qual
  //  das três formas a fila de botões toma:
  //
  //  | espaço | a fila |
  //  |---|---|
  //  | sobra | os dois botões ESCRITOS, como sempre |
  //  | aperta | os mesmos, em ÍCONE (`cabecalhoApertado`) |
  //  | não cabe | recolhe no ⋮ (`cabecalhoRecolhido`) |
  //
  //  A terceira NÃO ESCONDE NADA: o menu ⋮ já existia no celular com TODAS as
  //  ações escritas por extenso — lida/não lida, ficha, histórico, etiquetas,
  //  quem participou, buscar, renomear, já tratei. Trazê-lo para o computador
  //  é trocar seis ícones mudos por um menu que diz o nome de cada coisa. O
  //  que não se pode perder é o NÚMERO que o cliente vê chegar, porque
  //  responder pelo número errado não tem desfazer.
  // ============================================================
  //
  //  Os números saíram da régua do navegador, não do olho:
  //  "ANDREIA CRISTINA MARTINS" pede 225px e "ELANE GOMES TEIXEIRA" 194.
  const NOME_MINIMO = 230;
  //  A fila inteira SEM o "Já tratei", com vãos (6x12) e recheio (2x16).
  const FILA_ESCRITA = 487;    // 383 de botões + 72 + 32
  const FILA_EM_ICONES = 360;  // 256 de botões + 72 + 32
  //  E O "JÁ TRATEI" SOMA À PARTE — os dois números acima NÃO o contavam, e
  //  em 02/10 eu escrevi que contavam. Medido na régua do navegador, com o
  //  vão de 12: escrito, "Já tratei" custa 90 e "Voltar para a fila" 139; em
  //  ícone, 35. Ele aparece em toda conversa desde 02/10 (antes só na que
  //  esperava), e sem esta parcela a 1366 o nome caía a 205px — o defeito da
  //  "ELANE GO…", que já acontecia calado em toda conversa da fila.
  const fichaDoJaTratei = temTratada === true && temAssuntos === true && conversaId != null;
  const abertaFoiTratada = fichaDoJaTratei && (() => {
    const c = conversas.find((x) => x.id === conversaId);
    return Boolean(c && !c.esperando_desde && c.tratada_em);
  })();
  const JA_TRATEI_ESCRITO = !fichaDoJaTratei ? 0 : (abertaFoiTratada ? 139 : 90) + 12;
  const JA_TRATEI_EM_ICONE = !fichaDoJaTratei ? 0 : 35 + 12;
  const cabecalhoApertado  = !estreito && larguraDaConversa - FILA_ESCRITA - JA_TRATEI_ESCRITO < NOME_MINIMO;
  const cabecalhoRecolhido = !estreito && larguraDaConversa - FILA_EM_ICONES - JA_TRATEI_EM_ICONE < NOME_MINIMO;
  // ============================================================
  //  A LINHA DO NÚMERO E OS SEUS SELOS (06/10)
  //
  //  Responsável, etapa e tarefa moram na linha do número, e não na fila de
  //  botões, para não mexer na conta acima. Só que a linha tem a largura do
  //  bloco do nome, e com a ficha aberta ela fica estreita: MEDIDO a 1400, 187px
  //  para o número (~95) e três selos escritos (~100 cada). Antes das tarefas
  //  já não cabia — "Assumir" era pintado por cima de "Pôr no funil" — e
  //  ninguém tinha medido isso depois do funil entrar.
  //
  //  A LINHA É CALCULADA, e não medida no DOM, pela régua do cabeçalho: as
  //  mesmas parcelas da fila mais 56px (avatar e recheio), conferidas a 1180,
  //  1280, 1366, 1400, 1440, 1600 e 1920, com e sem a ficha. Faltando espaço
  //  para os selos ESCRITOS, eles viram ÍCONE (o rosto, a bolinha da etapa, o
  //  sino) — o texto continua no `title` e por extenso no menu de cada um.
  //  O NÚMERO NÃO ENCOLHE nunca: responder pelo número errado não tem desfazer.
  // ============================================================
  //  ESCRITO, o selo pode perder umas letras no fim ("Proposta/acor…"), e
  //  não mais que isso: medido a 1366 sem a ficha, com 66px por selo a linha
  //  dizia "Assum", "Pô…" e "L…" — três palavras cortadas dizem menos que três
  //  ícones com o nome no `title`. Inteiros, os três pedem ~300; com 92 por
  //  selo eles perdem no máximo umas três letras cada.
  const NUMERO_NA_LINHA = 95;
  const SELO_ESCRITO = 92;
  const espacoDaLinha = larguraDaConversa - 56
    - (cabecalhoRecolhido ? 82
       : cabecalhoApertado ? FILA_EM_ICONES + JA_TRATEI_EM_ICONE
       : FILA_ESCRITA + JA_TRATEI_ESCRITO);
  const selosNaLinha = (temResponsavel === true ? 1 : 0) + (temFunil === true && funilDaConversa ? 1 : 0)
    + (temTarefas === true && tarefasDaConversa ? 1 : 0);
  const selosCompactos = !estreito && espacoDaLinha - NUMERO_NA_LINHA < selosNaLinha * SELO_ESCRITO;
  /** Mostra ou recolhe a ficha, escrevendo no estado certo para o layout. */
  function alternarFicha(mostrar) {
    if (estreito) { setFichaAberta(mostrar); return; }
    setFichaFixa(mostrar);
    guardarFichaFixa(mostrar);
  }
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
  // O ID NUM ESPELHO, porque quem o consulta é o tratador do tempo real — e
  // pôr `meuId` nas dependências daquele efeito derrubaria o canal a cada
  // releitura da sessão, que é o defeito das "trinta janelas de silêncio"
  // descrito no próprio arquivo.
  const meuIdRef = useRef(null);
  useEffect(() => { meuIdRef.current = meuId; }, [meuId]);

  // O SOM ESCOLHIDO, e o que o navegador respondeu sobre notificar.
  //
  // `permissaoDeAviso` começa lendo o navegador porque a resposta pode ter sido
  // dada em outro dia, noutra aba: a tela tem de abrir dizendo a verdade de
  // agora, e não "ainda não autorizado" para quem já autorizou meses atrás.
  const [somDoAviso, setSomDoAviso] = useState(somEscolhido);
  // A chave da tarja. O estado é só para a tela desenhar a chave no lugar
  // certo; quem manda é o armazenamento, lido por `notificarDesktop`.
  const [avisoNaTela, setAvisoNaTela] = useState(avisoNaTelaLigado);
  const [permissaoDeAviso, setPermissaoDeAviso] = useState(
    () => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));

  function pedirPermissaoDeAviso() {
    if (typeof Notification === "undefined") return;
    // A RESPOSTA VOLTA PARA A TELA. Sem isto o botão continuaria ali depois de
    // autorizado, e quem clicasse de novo não veria nada acontecer — o
    // navegador só pergunta uma vez.
    Notification.requestPermission()
      .then((r) => setPermissaoDeAviso(r))
      .catch(() => {});
  }

  // ------------------------------------------------------------
  //  ESTE AVISO ME INTERESSA?  (ver o bloco `deQuemEhAConversa`)
  //
  //  Devolve `true` quando eu participei da conversa, ou quando NINGUÉM
  //  participou — a primeira mensagem de um cliente novo não tem dono, e
  //  deixá-la sem aviso é o lead ficar sem resposta.
  //
  //  A LEITURA QUE FALHA AVISA ASSIM MESMO. Sem saber de quem é a conversa, o
  //  erro barato é tocar um som a mais; o caro é calar a mensagem de um cliente
  //  por causa de uma oscilação de rede. É a armadilha nº 2 do CLAUDE.md
  //  aplicada a um aviso: não desenhar ausência onde houve falha.
  // ------------------------------------------------------------
  const esteAvisoMeInteressa = useCallback(async (convId) => {
    const guardado = deQuemEhAConversa.current.get(convId);
    if (guardado) return guardado.minha || guardado.orfa;
    const eu = meuIdRef.current;
    if (!eu) return true;
    try {
      const { data: minhas, error: e1 } = await supabase.from("mensagens")
        .select("id").eq("conversa_id", convId).eq("enviado_por_id", eu).limit(1);
      if (e1) return true;
      if (minhas && minhas.length) {
        deQuemEhAConversa.current.set(convId, { minha: true, orfa: false });
        return true;
      }
      // SÓ AGORA A SEGUNDA PERGUNTA, e não sempre: para quem participou — que
      // é o caso comum de quem atende — uma ida à rede basta.
      const { data: deOutro, error: e2 } = await supabase.from("mensagens")
        .select("id").eq("conversa_id", convId).not("enviado_por_id", "is", null).limit(1);
      if (e2) return true;
      const orfa = !deOutro || !deOutro.length;
      deQuemEhAConversa.current.set(convId, { minha: false, orfa });
      return orfa;
    } catch (_) {
      return true;
    }
  }, []);

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
  // AS LINHAS DESATIVADAS DESTE DEPARTAMENTO — só para quem administra.
  //
  // Um atendente não tem o que fazer com elas: não pode responder (a ponte
  // recusa) e não escolheu desativá-las. Pôr isso na barra de todo mundo seria
  // mais um ícone para ignorar. Quem administra é quem precisa: foi ele que
  // desativou, e é ele quem vai querer saber o que ainda chega ali.
  const desativadosVisiveis = souAdmin
    ? advogados.filter((a) => a.ativo === false && a.departamento_id === departamentoId)
    : [];
  // A conversa aberta é de uma linha desativada? A caixa de escrever some, e no
  // lugar dela vai a explicação — ver `caixaDeEscrever`.
  const linhaDesativada = Boolean(advogado && advogado.ativo === false);
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
        // AS DESATIVADAS VÊM JUNTO, com a coluna `ativo`.
        //
        // A consulta filtrava por `ativo = true`, e com isso as conversas de uma
        // linha desativada ficavam GRAVADAS E INVISÍVEIS: o cliente escreve para
        // o número antigo do advogado que saiu, a mensagem entra no banco, e
        // ninguém no escritório tem como alcançá-la.
        //
        // Quem pode USAR continua sendo só a linha ativa — `filtrarPermitidos`
        // corta as desativadas para todo mundo, inclusive para quem administra,
        // e é dela que sai tudo o que a tela OFERECE (nova conversa,
        // encaminhar, escolher departamento). Trazê-las aqui não abre nenhum
        // desses caminhos; abre só a leitura, mais abaixo.
        supabase.from("advogados").select("id, nome, numero, foto_url, departamento_id, ativo")
          .order("nome"),
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
      .eq("advogado_id", advId)
      // SÓ AS QUE TÊM ALGUÉM DENTRO (auditoria de 07/10): pedindo todas, um
      // telefone com mais de mil conversas era cortado pela API em 1000, sem
      // ordem — e o "Fulana também está nesta conversa" podia não vir.
      .not("atendendo_por", "is", null);
    if (error) { desligarRecurso("atendendo", error); return; }
    if (advogadoIdRef.current !== advId) return;
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
      .eq("advogado_id", advId)
      .gt("digitando_ate", new Date().toISOString());
    if (error) { desligarRecurso("digitando", error); return; }
    if (advogadoIdRef.current !== advId) return;
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
    /** A ordem vai para o BANCO, e não para a lista já carregada.
     *
     *  Ordenar aqui dentro daria "quem mais espera entre as 200 que vieram",
     *  com cara de "quem mais espera" — e o cliente antigo esquecido, que é
     *  justamente o que esta fila existe para achar, mora fora das 200.
     *
     *  `temEspera === true` é exigido mesmo com `ordem === "esperando"`: a
     *  escolha fica guardada no navegador, e num banco onde o SQL foi desfeito
     *  ela pediria uma coluna que não existe — e a consulta inteira falharia. */
    const porOrdem = (q) => (ordenarPelaEspera
      // QUEM NÃO ESPERA VAI PARA O FIM.
      //
      // `nullsFirst: false` é EXPLÍCITO de propósito, e não por engano: subindo,
      // o Postgres já manda o nulo para o fim sozinho. Escrevi primeiro um
      // comentário dizendo o contrário, e foi a sabotagem que me corrigiu — ela
      // tirava a opção e a prova passava, porque não havia o que mudar.
      //
      // Fica escrito porque a regra se lembra errado com facilidade (DESCENDO
      // é ao contrário: nulo na frente), e porque trocar por `true` enche a
      // primeira página com as conversas em que ninguém está esperando nada —
      // é essa a sabotagem que a prova pega hoje.
      // E O DESEMPATE VAI AO BANCO (auditoria de 07/10): quase todas as
      // linhas têm `esperando_desde` nulo, e entre elas a ordem do Postgres é
      // indefinida — a página trazia "50 quaisquer" das que não esperam, e a
      // paginação por OFFSET sobre uma ordem indefinida pula ou repete
      // conversas. A régua é a de `compararConversas`: a mais recente primeiro,
      // e o id para que dois horários iguais não troquem de lugar.
      ? q.order("esperando_desde", { ascending: true, nullsFirst: false })
          .order("ultima_atividade", { ascending: false }).order("id")
      : q.order("ultima_atividade", { ascending: ordem === "antigas" }).order("id"));
    /** As fixadas: mesma consulta, filtro próprio. Separada em função porque a
     *  base sem o SQL das frentes precisa repeti-la sem as colunas novas. */
    const buscarFixadas = () => porOrdem(supabase
      .from("conversas")
      .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
      .eq("advogado_id", advId)
      .eq("fixada", true))
      .limit(200)
      .then((r) => r);
    const pedidoDaPagina = porOrdem(supabase
      .from("conversas")
      // `mensagens(id)` COM TETO DE UMA: a pergunta é "existe alguma?", e não
      // "quantas são". Uma linha por conversa responde isso e não traz peso.
      .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")}), mensagens(id)`)
      .eq("advogado_id", advId))
      // A ORDEM É DAQUI, e não de uma reordenação depois. Ver o comentário em
      // `ordem`: virar a lista já carregada mostraria "a mais antiga das 200
      // que vieram", que não é a mais antiga de nada.
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
        porOrdem(supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")}), mensagens(id)`)
          .eq("advogado_id", advId))
          // `porOrdem` AQUI TAMBÉM: esta é a mesma página, refeita sem a
          // coluna do cadastro. Deixá-la com a ordem de sempre faria a fila de
          // espera virar do avesso só nas bases antigas — e sem nada na tela
          // dizendo por quê. E é a MESMA função, com o mesmo desempate: duas
          // escritas da ordem divergiriam no primeiro conserto.
          .range(de, de + PAGINA_BANCO - 1)
          .limit(1, { referencedTable: "mensagens" }),
        pagina === 0 ? buscarFixadas() : Promise.resolve({ data: [], error: null }),
      ]);
      ({ data, error } = refeitos[0]);
      fixadasRefeitas = refeitos[1];
    }
    // Queda de rede não pode esvaziar a lista: sem resposta, fica o que já
    // estava na tela em vez de "Nenhuma conversa ainda".
    //
    // E A FALHA É DITA (auditoria de 07/10). Era `if (error) return;` puro: na
    // abertura ou na troca de telefone a tela ficava em "Carregando as
    // conversas…" PARA SEMPRE — o dono da lista nunca chegava a este telefone
    // —, sem faixa e sem código. É a armadilha nº 2 com a roupa do "ainda
    // estou vindo".
    if (error) {
      if (advogadoIdRef.current !== advId || error.name === "AbortError") return;
      anotarFalhaDeLeitura("conversas", "a lista de conversas", error);
      setConversasDe((dono) => {
        // A LISTA NA TELA É DE OUTRO TELEFONE: não pode passar por deste. Ela
        // sai, e o recado da lista diz que a leitura falhou.
        if (dono !== advId) setConversas([]);
        return advId;
      });
      return;
    }
    limparFalhaDeLeitura("conversas");
    // Troquei de telefone enquanto esta resposta vinha? Ela é de outro telefone
    // agora: descarta. Sem isto, clicar rápido em dois telefones deixava a
    // lista do PRIMEIRO na tela do segundo (a resposta lenta chega por último
    // e sobrescreve), e o atendente atendia a conversa errada.
    //
    // E TROQUEI DE ORDEM? (auditoria de 07/10) Uma releitura pedida em
    // "Recentes" que chega depois da troca para "Esperando" substituía a lista
    // e a reordenava pela régua velha — a pílula dizendo "Esperando" sobre uma
    // lista em outra ordem.
    if (advogadoIdRef.current !== advId) return;
    if (ordemRef.current !== ordem || ordenarPelaEsperaRef.current !== ordenarPelaEspera) return;
    // As FIXADAS sobem, e entre elas continua valendo a ordem de sempre. A
    // ordenação é feita aqui e não no banco porque a coluna pode ainda não
    // existir: pedi-la no `order` faria a consulta inteira falhar, e a lista de
    // conversas sumiria por causa de um recurso que nem foi instalado.
    // Fixadas no alto; entre iguais, a ordem escolhida. O empate por
    // `ultima_atividade` importa porque a lista é emendada de duas fontes (as
    // fixadas e a página), e sem critério de desempate elas se intercalavam
    // pela ordem de chegada.
    // O DESEMPATE DA FILA DE ESPERA É O MESMO DO BANCO, e precisa ser: as
    // fixadas chegam numa consulta e a página noutra, e é aqui que as duas se
    // emendam. A régua é `compararConversas`, a mesma dos outros três lugares
    // que reordenam a lista — ver o relato de 30/09 ali.
    const porFixada = compararConversas(ordem, ordenarPelaEspera);
    const bruto = data || [];
    // A COLUNA EXISTE? PERGUNTA-SE ÀS LINHAS QUE JÁ VIERAM — ver o comentário
    // em `temEspera`. O PostgREST escreve a chave mesmo quando o valor é nulo,
    // então a presença dela na primeira linha é a resposta.
    if (bruto.length) {
      setTemEspera(Object.prototype.hasOwnProperty.call(bruto[0], "esperando_desde"));
      // A MESMA SONDA, PELA MESMA RAZÃO — e `temTratada` NÃO entra nas
      // dependências desta função: ela não muda a consulta (que pede `*`), só
      // o que a tela desenha. Pôr um estado de três valores ali foi o que
      // dobrou o tempo de abertura em 25/09; ver `ordenarPelaEspera`.
      setTemTratada(Object.prototype.hasOwnProperty.call(bruto[0], "tratada_em"));
      // E O RESPONSÁVEL, pela mesma porta e pela mesma razão — fora das
      // dependências da função.
      setTemResponsavel(Object.prototype.hasOwnProperty.call(bruto[0], "responsavel_id"));
    }
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
    let fixadasFalharam = false;
    if (pedidoDasFixadas) {
      // ESPERA o que já foi pedido lá em cima, em vez de pedir agora. É esta
      // linha, e não a de cima, que era a segunda rodada de rede.
      const { data: fix, error: erroFix } = fixadasRefeitas || await pedidoDasFixadas;
      if (advogadoIdRef.current !== advId) return;
      // AS FIXADAS QUE NÃO VIERAM FICAM COMO ESTAVAM (auditoria de 07/10). A
      // primeira página SUBSTITUI a lista, e com `fixadas = []` a fixada parada
      // há meses — que não mora na página — sumia sem uma palavra.
      if (!erroFix) { fixadas = fix || []; limparFalhaDeLeitura("conversas-fixadas"); }
      else {
        fixadasFalharam = true;
        if (!faltaColuna(erroFix)) anotarFalhaDeLeitura("conversas-fixadas", "as conversas fixadas", erroFix);
      }
    }

    // A conversa aberta mantém o contador dela: abrir não é responder.
    setConversas((antes) => {
      // Na primeira página a lista é substituída; nas seguintes, emendada — e
      // sem repetir quem já veio, porque uma conversa que recebe mensagem entre
      // uma página e outra desce de posição e apareceria duas vezes.
      const base = pagina === 0 ? [] : antes;
      const vistos = new Set(base.map((c) => String(c.id)));
      const juntas = [...base];
      const fixadasDeAgora = fixadasFalharam
        ? antes.filter((c) => c.fixada && String(c.advogado_id) === String(advId))
        : fixadas;
      for (const c of [...fixadasDeAgora, ...veio]) {
        if (vistos.has(String(c.id))) continue;
        vistos.add(String(c.id));
        juntas.push(c);
      }

      // ------------------------------------------------------------
      //  A CONVERSA ABERTA ATRAVESSA A RECARGA
      //
      //  RELATO DE 10/09: "quando estamos dentro de uma conversa, ela sai
      //  sozinha, como se tivesse sido apertada a tecla ESC".
      //
      //  Ninguém apertava nada. A tela da direita não guarda a conversa
      //  aberta — ela a PROCURA aqui nesta lista (`conversas.find`). Some
      //  daqui, some de lá: o `conversaId` continua o mesmo e a direita volta
      //  ao "Selecione uma conversa" como se a pessoa tivesse saído.
      //
      //  E a primeira página SUBSTITUI a lista (é o `base = []` acima, e tem
      //  de ser: sem isso a lista só cresceria). Quem não está nela — a
      //  conversa antiga achada na busca, a aberta pela Esteira do Vantoro, a
      //  trazida por rolagem — ia embora junto.
      //
      //  O gatilho é o movimento do escritório: chega mensagem de uma conversa
      //  que a lista ainda não tem (um lead novo, alguém calado há meses) e a
      //  primeira página é relida. Num telefone de duzentas conversas isso
      //  nunca aparece; no telefone com dois anos de histórico é o dia inteiro,
      //  e sempre no meio de uma resposta.
      //
      //  DO MESMO TELEFONE, e a conferência não é enfeite: `trocarAdvogado`
      //  limpa o `conversaId` e manda recarregar, e entre uma coisa e outra o
      //  `ref` ainda aponta para a conversa do telefone ANTERIOR. Sem esta
      //  linha, ela seria transplantada para a lista do telefone novo.
      const guardada = aberta && !vistos.has(String(aberta))
        ? antes.find((c) => String(c.id) === String(aberta) && c.advogado_id === advId)
        : null;
      if (guardada) juntas.push(guardada);

      return juntas.sort(porFixada);
    });
    // A lista e o dono dela mudam JUNTOS — é o que garante que ninguém leia
    // esta lista como sendo de outro telefone.
    setConversasDe(advId);
    // As três que ficavam aqui saíram na frente, lá em cima: elas precisam só
    // do `advId`, e esperar a lista para pedi-las era o que fazia a terceira
    // rodada de rede.
    // `ordenarPelaEspera` ENTRA NAS DEPENDÊNCIAS, e `temEspera` cru NÃO —
    // ver o comentário na declaração dele. Na primeira abertura de quem tem a
    // fila de espera escolhida ele é `false` (a coluna ainda é desconhecida) e
    // a lista vem na ordem de sempre; quando a resposta chega ele vira `true`,
    // esta função é outra e o efeito recarrega. Uma ida a mais, só para quem
    // escolheu essa ordem, e só uma vez por sessão — que é o que o comentário
    // anterior PROMETIA e o código não cumpria.
  }, [ordem, ordenarPelaEspera, carregarAtendimentos, carregarUltimasMidias, carregarDigitando,
      anotarFalhaDeLeitura, limparFalhaDeLeitura]);

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

  // ------------------------------------------------------------
  //  AS ATUALIZAÇÕES DO BANCO, PERGUNTADAS À PONTE — só por quem administra
  //
  //  A ponte aplica os scripts de `sql/automaticos/` ao subir, e é só aí que a
  //  resposta muda. Então pergunta-se pouco: três segundos depois de abrir
  //  (para não disputar com a primeira leva de consultas, e com a ponte já
  //  acordada pelo `/ping`), e depois de quinze em quinze minutos — de um em
  //  um enquanto ela diz que está conferindo ou que vai tentar de novo, porque
  //  aí a resposta muda logo.
  //
  //  NÃO CONSEGUIR PERGUNTAR NÃO MUDA NADA NA TELA: guarda-se o que já se
  //  sabia. A faixa não acende por uma pergunta que falhou (a ponte fora do ar
  //  tem os avisos dela), nem apaga por uma — a aba diz a falha com todas as
  //  letras, para quem for olhar.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!souAdmin) { setScriptsDoBanco(null); return undefined; }
    let vivo = true;
    let relogio = null;
    const perguntar = async () => {
      const r = await perguntarOsScripts();
      if (!vivo) return;
      if (r.estado) setScriptsDoBanco(r.estado);
      const logo = r.estado && (r.estado.situacao === "rodando" || r.estado.proxima_tentativa);
      relogio = setTimeout(perguntar, logo ? 60 * 1000 : 15 * 60 * 1000);
    };
    relogio = setTimeout(perguntar, 3000);
    return () => { vivo = false; clearTimeout(relogio); };
  }, [souAdmin]);

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

  // OS GRUPOS QUE AS PÁGINAS JÁ LIDAS NÃO TÊM.
  //
  // A lista vem do banco em páginas de conversas mais recentes. Um grupo
  // parado há três meses está fora delas — e filtrar só o que está na tela
  // mostraria três grupos onde há sete, sem nada dizendo que faltam quatro.
  // É a armadilha nº 2 com outra roupa: ausência desenhada no lugar de
  // "ainda não perguntei".
  const [extrasGrupo, setExtrasGrupo] = useState([]);
  // AS MINHAS QUE AS PÁGINAS JÁ LIDAS NÃO TÊM — o mesmo raciocínio dos
  // grupos: um cliente meu parado há dois meses mora fora das 200 mais
  // recentes, e "as minhas" sem ele seria uma lista curta com cara de lista
  // inteira. Quem conclui "não tenho nada pendente" a partir dela esquece
  // justamente o cliente mais esquecido.
  const [extrasMinhas, setExtrasMinhas] = useState([]);
  const [idsQuem, setIdsQuem] = useState(null);            // null = sem filtro
  // "carregando" | "falhou" | "ok" — o filtro de atendentes ESCOLHIDO e ainda
  // sem resposta não pode deixar tudo passar (auditoria de 07/10): a pílula
  // dizia "Jenifer" e a lista mostrava o telefone inteiro, como se fossem as
  // conversas dela — e assim ficava para sempre se o banco recusasse.
  const [estadoQuem, setEstadoQuem] = useState("ok");
  const [tentativaQuem, setTentativaQuem] = useState(0);
  const chaveQuemRef = useRef("");
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
  useEffect(() => { setQuemParticipou(false); setMenuResponsavel(false); }, [conversaId]);

  // Trocar de telefone zera a escolha: os atendentes são outros.
  useEffect(() => { setQuemFiltra([]); setMenuQuem(false); }, [advogadoId]);

  useEffect(() => {
    let vivo = true;
    setExtrasQuem([]);
    if (!quemFiltra.length || !advogadoId) { setIdsQuem(null); setEstadoQuem("ok"); limparFalhaDeLeitura("filtro-quem"); return; }
    const advId = advogadoId;
    // SÓ ESVAZIA QUANDO A ESCOLHA MUDA. Este efeito também roda quando a lista
    // cresce (`conversas.length`), e esvaziar ali faria a lista filtrada piscar
    // vazia a cada conversa nova que chega.
    const chave = JSON.stringify([quemFiltra, modoQuem, advId, tentativaQuem]);
    if (chaveQuemRef.current !== chave) {
      chaveQuemRef.current = chave;
      setIdsQuem(new Set());
      setEstadoQuem("carregando");
    }
    (async () => {
      const { data, error } = await supabase.rpc("conversas_por_atendente", {
        p_advogado: advId, p_usuarios: quemFiltra,
        p_todos: modoQuem === "todos", p_limite: 500,
      });
      if (!vivo || advogadoIdRef.current !== advId) return;
      if (error) {
        setEstadoQuem("falhou");
        anotarFalhaDeLeitura("filtro-quem", "o filtro de atendentes", error);
        return;
      }
      limparFalhaDeLeitura("filtro-quem");
      setEstadoQuem("ok");
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
  }, [quemFiltra, modoQuem, advogadoId, conversas.length, tentativaQuem]);

  // ------------------------------------------------------------
  //  OS GRUPOS, PERGUNTADOS AO BANCO
  //
  //  Mesmo desenho do filtro de etiquetas logo abaixo, e de propósito: primeiro
  //  os contatos que são grupo, depois as conversas deste telefone com eles.
  //  Dois passos, e não um `join` com filtro na coluna de dentro — o segundo
  //  existe no PostgREST, mas exige `!inner` e um `like` na coluna embutida, e
  //  isto aqui só usa o que o resto do arquivo já usa.
  //
  //  FALHOU, NÃO APAGA O QUE JÁ ESTÁ NA TELA. Os grupos das páginas lidas
  //  aparecem por `passaNoFiltro`, que não depende desta ida ao banco; se ela
  //  não voltar, a lista fica incompleta em vez de vazia — e é a diferença
  //  entre uma lista curta e uma tela que diz "não há grupos".
  useEffect(() => {
    let cancelado = false;
    setExtrasMinhas([]);
    if (filtro !== "minhas" || !advogadoId || !meuId || temResponsavel !== true) return;
    const advId = advogadoId;
    (async () => {
      const { data, error } = await supabase.from("conversas")
        .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
        .eq("advogado_id", advId).eq("responsavel_id", meuId).limit(500);
      // FALHOU, NÃO APAGA: as minhas das páginas lidas continuam aparecendo
      // por `passaNoFiltro`, que não depende desta ida.
      if (error) console.error("As minhas conversas fora das páginas lidas não vieram:", error);
      if (error || cancelado || advogadoIdRef.current !== advId) return;
      setExtrasMinhas(data || []);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, advogadoId, meuId, temResponsavel]);

  useEffect(() => {
    let cancelado = false;
    setExtrasGrupo([]);
    if (filtro !== "grupos" || !advogadoId) return;
    const advId = advogadoId;
    (async () => {
      try {
        const { data: contatos, error: e1 } = await supabase.from("contatos")
          .select("id").ilike("numero", "grupo:%").limit(500);
        if (e1 || cancelado || !contatos || !contatos.length) return;
        const ids = contatos.map((c) => c.id);
        const achadas = [];
        // Em lotes: a lista de ids vai na URL, e centenas de uma vez fariam o
        // pedido ser recusado pelo tamanho. Mesmo teto do filtro de etiquetas.
        for (let i = 0; i < ids.length; i += 150) {
          const { data, error } = await supabase.from("conversas")
            .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
            .eq("advogado_id", advId)
            .in("contato_id", ids.slice(i, i + 150));
          if (error) return;
          achadas.push(...(data || []));
        }
        // Troquei de telefone ou de filtro enquanto isto vinha? É resposta de
        // outra pergunta: descarta.
        if (cancelado || advogadoIdRef.current !== advId) return;
        setExtrasGrupo(achadas);
      } catch (_) { /* sem rede: a lista fica com os grupos já carregados */ }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, advogadoId]);

  useEffect(() => {
    let cancelado = false;
    const tagId = filtro.startsWith("tag:") ? filtro.slice(4) : null;
    setExtrasEtiqueta([]); setIdsEtiqueta(null);
    if (!tagId || !advogadoId) { limparFalhaDeLeitura("filtro-etiqueta"); return; }
    const advId = advogadoId;
    (async () => {
      try {
        const ids = [];
        for (let pagina = 0; pagina < 50; pagina++) {
          const { data, error } = await supabase.from("conversa_tags")
            .select("conversa_id").eq("tag_id", tagId)
            .order("conversa_id").range(pagina * 1000, (pagina + 1) * 1000 - 1);
          // A FALHA É DITA (auditoria de 07/10): calada, a tela mostrava só as
          // conversas com a etiqueta que já estavam carregadas, com cara de
          // "todas" — três quando havia trinta.
          if (error) { if (!cancelado) anotarFalhaDeLeitura("filtro-etiqueta", "as conversas desta etiqueta", error); return; }
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
          if (error) { if (!cancelado) anotarFalhaDeLeitura("filtro-etiqueta", "as conversas desta etiqueta", error); return; }
          achadas.push(...(data || []));
        }
        // Troquei de telefone ou de etiqueta enquanto isto vinha? É resposta de
        // outra pergunta: descarta.
        if (cancelado || advogadoIdRef.current !== advId) return;
        limparFalhaDeLeitura("filtro-etiqueta");
        setExtrasEtiqueta(achadas);
        setIdsEtiqueta(new Set(ids.map(String)));
      } catch (e) {
        if (!cancelado) anotarFalhaDeLeitura("filtro-etiqueta", "as conversas desta etiqueta", e);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, advogadoId]);

  useEffect(() => { carregarTags(); }, [carregarTags]);

  // ---- Os assuntos do "Já tratei" ----
  //
  // UMA VEZ POR ABERTURA, e não uma vez por janela: a lista tem oito linhas e
  // quase nunca muda. Perguntar a cada clique em "Já tratei" seria uma ida à
  // rede no meio de um gesto que precisa parecer instantâneo.
  const carregarAssuntos = useCallback(async () => {
    try {
      // `*`, e não a lista de colunas: `pede_descricao` só existe depois do
      // script 009, e pedi-la por nome num banco sem ela derrubaria a leitura
      // inteira (42703) — e com ela o botão "Já tratei".
      const { data, error } = await supabase.from("zorvin_assuntos")
        .select("*").order("ordem");
      if (error) {
        // 42P01/PGRST205 = a tabela não existe: o script 005 ainda não rodou,
        // e aí o botão não deve mesmo aparecer. Qualquer OUTRO erro mantém o
        // botão e LEVA A FRASE PARA A JANELA — ver `temAssuntos`.
        const falta = semATabela(error);
        setTemAssuntos(!falta);
        if (!falta) setErroAssuntos(comOCodigo("Não consegui ler a lista de assuntos.", error, "assuntos do Já tratei"));
        return;
      }
      setAssuntos(data || []);
      setTemAssuntos(true);
      setErroAssuntos("");
    } catch (e) {
      setTemAssuntos(true);
      setErroAssuntos(comOCodigo("Não consegui ler a lista de assuntos.", e, "assuntos do Já tratei"));
    }
  }, []);
  useEffect(() => { carregarAssuntos(); }, [carregarAssuntos]);

  // ---- O funil: existe? ----
  //
  // UMA pergunta por abertura, de uma linha só. Não sai das linhas da lista
  // (como `temResponsavel`): o funil mora em tabelas próprias, e a lista não
  // tem como saber delas.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { error } = await supabase.from("zorvin_etapas").select("id").limit(1);
        if (!vivo) return;
        if (error && !semATabela(error)) console.error("Zorvin — funil:", error);
        setTemFunil(error ? !semATabela(error) : true);
      } catch (e) {
        console.error("Zorvin — funil:", e);
        if (vivo) setTemFunil(true);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // ---- O funil: a etapa da conversa aberta ----
  //
  // O CARTÃO É O CLIENTE NO DEPARTAMENTO (decisão do Rodrigo): a conversa
  // aberta aponta para ele pelo contato e pelo departamento do telefone. Grupo
  // não é cliente, e telefone sem departamento não tem funil.
  const contatoDoFunil = conversa && !String(conversa.contato?.numero || "").startsWith("grupo:")
    ? conversa.contato_id : null;
  const depDoFunil = conversa
    ? ((advogados.find((a) => String(a.id) === String(conversa.advogado_id)) || {}).departamento_id ?? null)
    : null;
  const lerFunilDaConversa = useCallback(async (contatoId, depId) => {
    if (!contatoId || depId == null) { setFunilDaConversa(null); return; }
    const chave = `${contatoId}|${depId}`;
    setFunilDaConversa((f) => (f && f.chave === chave ? f
      : { chave, carregando: true, etapas: [], cartao: null, erro: null }));
    try {
      let etapas = etapasPorDep.current.get(String(depId));
      const [rc, re] = await Promise.all([
        supabase.from("zorvin_cartoes").select("*")
          .eq("contato_id", contatoId).eq("departamento_id", depId).limit(1),
        etapas ? Promise.resolve(null)
          : supabase.from("zorvin_etapas").select("*").eq("departamento_id", depId).order("ordem"),
      ]);
      let erro = null;
      if (re && re.error) erro = comOCodigo("Não consegui ler as etapas do funil.", re.error, "etapas");
      else if (re) { etapas = re.data || []; etapasPorDep.current.set(String(depId), etapas); }
      if (rc.error) erro = comOCodigo("Não consegui ler a etapa deste cliente.", rc.error, "cartão");
      // A RESPOSTA DE UMA CONVERSA QUE JÁ FOI FECHADA não pinta a de agora.
      setFunilDaConversa((f) => (f && f.chave !== chave ? f : {
        chave, carregando: false, etapas: etapas || [], erro,
        // Leitura que falhou NÃO vira "fora do funil": a etapa fica desconhecida
        // e o menu diz por quê (armadilha nº 2).
        cartao: rc.error ? undefined : ((rc.data || [])[0] || null),
      }));
    } catch (e) {
      console.error("Zorvin — etapa da conversa:", e);
      setFunilDaConversa((f) => (f && f.chave !== chave ? f
        : { chave, carregando: false, etapas: [], cartao: undefined, erro: "Não consegui ler a etapa deste cliente." }));
    }
  }, []);
  useEffect(() => {
    setMenuEtapa(false);
    if (temFunil === true) lerFunilDaConversa(contatoDoFunil, depDoFunil);
    else setFunilDaConversa(null);
  }, [temFunil, contatoDoFunil, depDoFunil, lerFunilDaConversa]);

  // ---- As tarefas: existem? ----
  //
  // UMA pergunta por abertura, como a do funil.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { error } = await supabase.from("zorvin_tarefas").select("id").limit(1);
        if (!vivo) return;
        if (error && !semATabelaDeTarefas(error)) console.error("Zorvin — tarefas:", error);
        setTemTarefas(error ? !semATabelaDeTarefas(error) : true);
      } catch (e) {
        console.error("Zorvin — tarefas:", e);
        if (vivo) setTemTarefas(true);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // ---- As tarefas da conversa aberta ----
  //
  // TODAS, abertas e feitas: o menu mostra as abertas e conta as feitas — "já
  // ligamos na quinta" é parte do que se precisa saber antes de responder.
  const lerTarefasDaConversa = useCallback(async (cvId) => {
    if (!cvId) { setTarefasDaConversa(null); return; }
    setTarefasDaConversa((t) => (t && t.conversaId === cvId ? t
      : { conversaId: cvId, carregando: true, lista: [], erro: null }));
    try {
      const r = await supabase.from("zorvin_tarefas").select("*")
        .eq("conversa_id", cvId).order("vence_em", { ascending: true }).limit(200);
      // A RESPOSTA DE UMA CONVERSA QUE JÁ FOI FECHADA não pinta a de agora.
      setTarefasDaConversa((t) => (t && t.conversaId !== cvId ? t : {
        conversaId: cvId, carregando: false, lista: r.error ? [] : (r.data || []),
        // Leitura que falhou NÃO vira "nenhuma tarefa": o menu diz por quê.
        erro: r.error ? comOCodigo("Não consegui ler as tarefas desta conversa.", r.error, "tarefas da conversa") : null,
      }));
    } catch (e) {
      console.error("Zorvin — tarefas da conversa:", e);
      setTarefasDaConversa((t) => (t && t.conversaId !== cvId ? t
        : { conversaId: cvId, carregando: false, lista: [], erro: "Não consegui ler as tarefas desta conversa." }));
    }
  }, []);
  const idDaConversaAberta = conversa ? conversa.id : null;
  useEffect(() => {
    setMenuTarefa(false);
    if (temTarefas === true) lerTarefasDaConversa(idDaConversaAberta);
    else setTarefasDaConversa(null);
  }, [temTarefas, idDaConversaAberta, lerTarefasDaConversa]);

  // ---- As minhas abertas, e o AVISO NA HORA ----
  //
  // SÓ QUEM RECEBEU É AVISADO (decisão do Rodrigo): os outros veem a tarefa
  // atrasada na conversa, na tela de tarefas e no funil, mas não são
  // interrompidos — aviso que não pede ação de quem lê se aprende a ignorar.
  //
  // DE 30 EM 30 SEGUNDOS: o lembrete das 14h tem de tocar perto das 14h. É uma
  // consulta pequena (as minhas abertas, por um índice próprio), e oito
  // pessoas a cada 30s são uma consulta a cada quatro segundos — nada.
  //
  // O SOM É O DO AVISO DE MENSAGEM, o que a pessoa escolheu, e a tarja passa
  // pela mesma chave (`notificarDesktop`): quem desligou as tarjas não é
  // interrompido por elas aqui também.
  const lerMinhasTarefas = useCallback(async () => {
    if (!meuId) return;
    try {
      const r = await supabase.from("zorvin_tarefas").select("*")
        .eq("para_quem", meuId).is("feita_em", null)
        .order("vence_em", { ascending: true }).limit(500);
      if (r.error) {
        // FALHOU, DIZ: o número da barra ficaria parado no de antes, com cara
        // de número de agora.
        anotarFalhaDeLeitura("minhas-tarefas", "os seus lembretes", r.error);
        return;
      }
      limparFalhaDeLeitura("minhas-tarefas");
      const lista = r.data || [];
      setMinhasTarefas(lista);
      const tocar = quemTocaAgora(lista, meuId);
      if (!tocar.length) return;
      // MARCA ANTES DE TOCAR: uma segunda aba que leia no mesmo segundo acha
      // a marca e não toca de novo.
      marcarAvisadas(tocar.map(chaveDoAviso));
      tocarAviso();
      for (const t of tocar.slice(0, 3)) {
        const cv = conversasRef.current.find((c) => String(c.id) === String(t.conversa_id));
        notificarDesktop(`Lembrete: ${t.texto}`,
          cv ? `${nomeDoContato(cv.contato) || "Cliente"} — abra Tarefas no Zorvin` : "Abra Tarefas no Zorvin",
          `tarefa-${t.id}`);
      }
      mostrarAviso(tocar.length === 1
        ? `Lembrete: ${tocar[0].texto}`
        : `${tocar.length} lembretes venceram agora — veja em Tarefas, na barra lateral.`, 9000);
    } catch (e) {
      console.error("Zorvin — minhas tarefas:", e);
    }
  }, [meuId, anotarFalhaDeLeitura, limparFalhaDeLeitura]);
  useEffect(() => {
    if (temTarefas !== true || !meuId) { setMinhasTarefas([]); return undefined; }
    lerMinhasTarefas();
    const t = setInterval(lerMinhasTarefas, 30000);
    return () => clearInterval(t);
  }, [temTarefas, meuId, lerMinhasTarefas]);
  // O NÚMERO DA BARRA: atrasadas e as de hoje. As de amanhã não pedem nada
  // agora, e um número que nunca zera se aprende a não ler.
  const tarefasParaAgora = minhasTarefas.filter((t) => situacao(t) !== "proxima").length;
  const tarefasAtrasadas = minhasTarefas.filter((t) => situacao(t) === "atrasada").length;

  // ---- O filtro "Com tarefa para hoje" ----
  //
  // VAI AO BANCO, pela régua do filtro de grupos: a conversa com tarefa de
  // hoje pode estar fora das 200 mais recentes, e é justamente a esquecida.
  const lerFiltroDeTarefas = useCallback(async (advId) => {
    try {
      const r = await supabase.from("zorvin_tarefas").select("conversa_id")
        .is("feita_em", null).lte("vence_em", fimDeHoje().toISOString()).limit(1000);
      if (r.error) {
        anotarFalhaDeLeitura("filtro-tarefas", "as conversas com tarefa para hoje", r.error);
        return;
      }
      limparFalhaDeLeitura("filtro-tarefas");
      const ids = [...new Set((r.data || []).map((t) => String(t.conversa_id)))];
      if (advogadoIdRef.current !== advId) return;
      setIdsTarefaHoje(new Set(ids));
      const achadas = [];
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
          .eq("advogado_id", advId).in("id", ids.slice(i, i + 150));
        // FALHOU, NÃO APAGA: as das páginas lidas aparecem pelo conjunto.
        if (error) { console.error("Conversas com tarefa fora das páginas lidas:", error); break; }
        achadas.push(...(data || []));
      }
      if (advogadoIdRef.current !== advId) return;
      setExtrasTarefas(achadas);
    } catch (e) {
      console.error("Zorvin — filtro de tarefas:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);
  useEffect(() => {
    setExtrasTarefas([]);
    setIdsTarefaHoje(null);
    if (filtro !== "tarefas" || !advogadoId || temTarefas !== true) {
      limparFalhaDeLeitura("filtro-tarefas");
      return undefined;
    }
    const advId = advogadoId;
    lerFiltroDeTarefas(advId);
    const t = setInterval(() => lerFiltroDeTarefas(advId), 60000);
    return () => clearInterval(t);
  }, [filtro, advogadoId, temTarefas, lerFiltroDeTarefas, limparFalhaDeLeitura]);
  // DEPOIS DE CRIAR, CONCLUIR OU APAGAR, tudo o que conta tarefas é relido: a
  // conversa, o número da barra e o filtro. Sem isso o número diria o que era
  // verdade antes do clique.
  const tarefasMudaram = useCallback(() => {
    lerTarefasDaConversa(conversaIdRef.current);
    lerMinhasTarefas();
    if (filtroRef.current === "tarefas" && advogadoIdRef.current) lerFiltroDeTarefas(advogadoIdRef.current);
  }, [lerTarefasDaConversa, lerMinhasTarefas, lerFiltroDeTarefas]);
  // As etiquetas seguem a LISTA: quando ela troca de telefone ou chega uma
  // conversa nova, são outras conversas para etiquetar.
  useEffect(() => { carregarTagsConversas(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversas, carregarTagsConversas]);

  async function salvarTagForm() {
    const nome = (tagForm?.nome || "").trim();
    const cor = tagForm?.cor || CORES_TAG[0];
    if (!nome) { mostrarAviso("Digite o nome da etiqueta."); return; }
    // SÓ A EDIÇÃO PRECISA PERGUNTAR SE MEXEU.
    //
    // Um `update` barrado pela regra de acesso volta SEM erro e com zero
    // linhas (ver `naoGravouNada`, em `gravar.js`); um `insert` barrado
    // levanta 42501 e cai no `if (error)` logo abaixo. É por isso que só um
    // dos dois ganha `.select("id")` — e é por isso que este defeito mora
    // sempre em quem edita, onde a revisão de código não o distingue.
    let error, recusou = false;
    if (tagForm.id) {
      const r = await supabase.from("tags").update({ nome, cor }).eq("id", tagForm.id).select("id");
      error = r.error; recusou = naoGravouNada(r);
    } else {
      ({ error } = await supabase.from("tags").insert({ nome, cor }));
    }
    if (error) {
      mostrarAviso(comOCodigo("Não consegui salvar esta etiqueta.", error, "salvar etiqueta"), 7000);
      return;
    }
    // Sem esta linha a tela fechava o formulário dizendo "Tag salva!" e a
    // releitura logo abaixo devolvia a etiqueta com o nome VELHO à lista. Quem
    // renomeia conclui que errou o clique, e renomeia de novo.
    if (recusou) { mostrarAviso("O banco não deixou salvar esta etiqueta. Nada mudou."); return; }
    setTagForm(null); carregarTags(); mostrarAviso("Tag salva!");
  }

  async function apagarTag(id) {
    if (!window.confirm("Apagar esta etiqueta? Ela sai de todas as conversas.")) return;
    // `.select("id")` porque um DELETE barrado apaga ZERO linhas sem erro. Sem
    // perguntar, a releitura logo abaixo trazia a etiqueta de volta à lista, e
    // o "Apagar esta?" que a pessoa acabou de confirmar parecia não ter sido
    // ouvido.
    const r = await supabase.from("tags").delete().eq("id", id).select("id");
    if (r.error) {
      mostrarAviso(comOCodigo("Não consegui apagar a etiqueta.", r.error, "apagar etiqueta"), 7000);
      return;
    }
    if (naoGravouNada(r)) { mostrarAviso("O banco não deixou apagar esta etiqueta. Ela continua lá."); return; }
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
      } catch (e) {
        // A PONTE RECUSOU (4xx): é resposta, e não silêncio. Cair no caminho
        // direto contornaria a recusa e diria "a ponte não respondeu", que é
        // falso (auditoria de 07/10). Só a ponte calada ou caída (sem código,
        // ou 5xx) cai para o caminho de sempre.
        if (e && e.status && e.status < 500) {
          mostrarAviso(`Não consegui ${tem ? "tirar" : "aplicar"} a etiqueta: ${e.message}`, 7000);
          carregarTagsConversas();
          return;
        }
      }
    }
    if (tem) {
      // O DELETE FALHA CALADO: zero linhas apagadas, sem erro. Sem perguntar, a
      // etiqueta sumia da tela (pelo acerto otimista lá em cima) e reaparecia
      // na releitura seguinte, sem uma palavra explicando a volta.
      const r = await supabase.from("conversa_tags")
        .delete().eq("conversa_id", conversaId).eq("tag_id", tagId).select("tag_id");
      if (r.error || naoGravouNada(r)) {
        mostrarAviso(naoGravouNada(r)
          ? "O banco não deixou tirar a etiqueta desta conversa."
          : comOCodigo("Não consegui tirar a etiqueta.", r.error, "tirar etiqueta da conversa"), 7000);
        carregarTagsConversas(); return;
      }
    } else {
      const { error } = await supabase.from("conversa_tags").insert({ conversa_id: conversaId, tag_id: tagId });
      if (error) {
        mostrarAviso(comOCodigo("Não consegui aplicar a etiqueta.", error, "aplicar etiqueta"), 7000);
        carregarTagsConversas(); return;
      }
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
    // Mesma assimetria das etiquetas: a edição pode ser recusada em silêncio, a
    // criação não. Aqui o que se perde é o TEXTO PRONTO que alguém escreveu
    // para a equipe inteira usar — e ele volta ao que era na abertura seguinte.
    let error, recusou = false;
    if (rapidaForm.id) {
      const r = await supabase.from("mensagens_rapidas")
        .update({ titulo, texto }).eq("id", rapidaForm.id).select("id");
      error = r.error; recusou = naoGravouNada(r);
    } else {
      ({ error } = await supabase.from("mensagens_rapidas").insert({ titulo, texto }));
    }
    if (error) {
      mostrarAviso(comOCodigo("Não consegui salvar esta mensagem rápida.", error,
                              "salvar mensagem rápida"), 7000);
      return;
    }
    if (recusou) { mostrarAviso("O banco não deixou salvar esta mensagem rápida. Nada mudou."); return; }
    setRapidaForm(null);
    mostrarAviso("Mensagem rápida salva!");
    carregarRapidas();
  }

  // PÕE A VARIÁVEL ONDE ESTÁ O CURSOR, e não no fim: "Olá, !" com o cursor
  // antes do "!" é o caso de todo dia, e a variável colada depois do "!"
  // obrigaria a apagar e reescrever. O cursor volta para depois dela.
  function porVariavel(chave) {
    const campo = textoDaRapidaRef.current;
    const texto = rapidaForm?.texto || "";
    const marca = `{${chave}}`;
    const ini = campo ? campo.selectionStart : texto.length;
    const fim = campo ? campo.selectionEnd : texto.length;
    setRapidaForm((f) => ({ ...f, texto: texto.slice(0, ini) + marca + texto.slice(fim) }));
    setTimeout(() => {
      const c = textoDaRapidaRef.current;
      if (!c) return;
      c.focus();
      c.setSelectionRange(ini + marca.length, ini + marca.length);
    }, 0);
  }

  async function apagarRapida(id) {
    if (!window.confirm("Apagar esta mensagem rápida?")) return;
    const r = await supabase.from("mensagens_rapidas").delete().eq("id", id).select("id");
    if (r.error) {
      mostrarAviso(comOCodigo("Não consegui apagar esta mensagem rápida.", r.error,
                              "apagar mensagem rápida"), 7000);
      return;
    }
    if (naoGravouNada(r)) { mostrarAviso("O banco não deixou apagar esta mensagem rápida. Ela continua na lista."); return; }
    carregarRapidas();
  }

  // Escolhe uma rápida pelo menu do "/": substitui o texto digitado pela mensagem.
  // AS VARIÁVEIS SÃO PREENCHIDAS AQUI, e não no envio: o texto entra na caixa
  // já com o nome do cliente, e a pessoa lê o que vai sair antes do Enter.
  function escolherSlash(r) {
    if (!r) return;
    setRascunho(rapidaPreenchida(r.texto));
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
    } catch (e) {
      // O CÓDIGO VAI JUNTO — a régua de `comOCodigo` (auditoria de 07/10).
      mostrarAviso(comOCodigo("Não consegui atualizar a foto.", e, "foto do perfil"), 7000);
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
    const meu = ++pedidoContatosRef.current;
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
      if (meu !== pedidoContatosRef.current) return;
      if (error) { setErroContatos(comOCodigo("Não consegui ler a agenda de contatos.", error, "agenda")); return; }
      setErroContatos("");
      setContatosLista((data || []).filter((c) => !String(c.numero || "").startsWith("grupo:")));
    } catch (e) {
      if (meu === pedidoContatosRef.current) setErroContatos(comOCodigo("Não consegui ler a agenda de contatos.", e, "agenda"));
    }
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
    // SEM VANTORO NÃO SE PERGUNTA, e é aqui que a economia importa: cada tecla
    // digitada viraria um pedido à ponte que só pode voltar com as mãos
    // vazias. Pior que o desperdício é o que a tela mostrava enquanto ele
    // estava no ar — "Procurando no Vantoro…" para uma procura que não existe.
    if (temVantoro !== true) { setVantoroAchados([]); setVantoroBuscando(false); return undefined; }
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
  }, [buscaContato, novaConversaAberta, temVantoro]);

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
    if (error || !cont) {
      mostrarAviso(comOCodigo("Não consegui criar o contato a partir do Vantoro.", error,
                              "criar contato do Vantoro"), 7000);
      return;
    }
    carregarContatos();
    await abrirConversaContato(cont);
  }

  async function salvarContato() {
    const nome = (contatoForm?.nome || "").trim();
    const numero = numeroCanonico(contatoForm?.numero);
    if (!nome) { mostrarAviso("Digite o nome do contato."); return; }
    if (numero.length < 8) { mostrarAviso("Digite um número válido (com DDD)."); return; }
    const jaExiste = await contatoExistente(numero);
    // O `upsert` DE UM NÚMERO QUE JÁ EXISTE vira um `update` por baixo, e cai
    // no mesmo silêncio: por isso os dois caminhos pedem `.select("id")`, e não
    // só o de cima. A tela chegava a escrever "Contato salvo!" sem ter salvo.
    const r = jaExiste
      ? await supabase.from("contatos").update({ nome }).eq("id", jaExiste.id).select("id")
      : await supabase.from("contatos").upsert({ numero, nome }, { onConflict: "numero" }).select("id");
    if (r.error) {
      mostrarAviso(comOCodigo("Não consegui salvar este contato.", r.error, "salvar contato"), 7000);
      return;
    }
    if (naoGravouNada(r)) {
      mostrarAviso("O banco não deixou salvar este contato. Nada foi gravado.");
      return;
    }

    setContatoForm(null);
    // UMA FRASE SÓ (auditoria de 07/10): a do "já estava salvo" era apagada
    // pela de baixo no mesmo instante, e a pessoa não sabia que tinha
    // sobrescrito o nome de um contato que já existia.
    mostrarAviso(jaExiste ? "Este número já estava salvo; atualizei o nome." : "Contato salvo!");
    carregarContatos();
  }

  // Abre (ou cria) a conversa do advogado atual com este contato.
  // `advAlvo` é para quando a conversa NÃO é do telefone que está aberto —
  // hoje só o link da Esteira do Vantoro faz isso, quando a pessoa escolhe por
  // qual dos telefones do escritório quer falar. Sem o parâmetro, é o de
  // sempre: o telefone selecionado na barra lateral.
  async function abrirConversaContato(cont, advAlvo) {
    const advId = advAlvo || advogadoId;
    if (!advId) { mostrarAviso(`Escolha ${voc.um} ${voc.singular} na barra lateral primeiro.`); return; }
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
    if (error || !cont) {
      mostrarAviso(comOCodigo("Não consegui salvar o contato.", error, "novo contato"), 7000);
      return;
    }
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
    if (error || !cont) {
      mostrarAviso(comOCodigo("Não consegui iniciar a conversa.", error, "conversar com o número"), 7000);
      return;
    }
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
      let naoConferi = "";
      if (cont) {
        const { data, error } = await supabase.from("conversas")
          .select("advogado_id, ultima_atividade").eq("contato_id", cont.id);
        // FALHANDO, A JANELA DIZ QUE NÃO CONFERIU (auditoria de 07/10), em vez
        // de mostrar todas as opções como "sem conversa ainda" — que mandaria
        // escolher um telefone novo para quem já tem histórico noutro.
        if (error) naoConferi = comOCodigo("Não consegui conferir onde já existe conversa com esta pessoa.", error, "conversas do link");
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
      setEscolhaTelefone({ contato: cont, numero, nome, opcoes, naoConferi });
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
    // `contatoId` vai junto para as leituras que chegam depois (alterações,
    // "Já tratei") saberem se o painel ainda é o deste cliente: trocar de
    // conversa com ele aberto, e a resposta atrasada da anterior pintaria o
    // histórico de um cliente na tela de outro.
    setHistorico({ contatoId, carregando: true, linhas: [], erro: "", parcial: false, alteracoes: [],
                   tratados: { carregando: true, grupos: [], erro: "" },
                   funil: temFunil === true ? { carregando: true, grupos: [], erro: "" } : null });
    // O CAMINHO NO FUNIL não depende da ponte nem da lista de conversas: é por
    // contato, e a regra de leitura do banco já recorta pelo que a pessoa vê.
    carregarCaminhoDoHistorico(contatoId);

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
        // SÓ A TABELA QUE FALTA SE CALA (o SQL não rodado); qualquer outro erro
        // é dito, senão a seção some e "ninguém mexeu" vira a leitura.
        if (error) {
          const falta = semATabela(error);
          if (!falta) {
            console.error("[zorvin] falha ao carregar as alterações do contato", error);
            setHistorico((h) => (h && h.contatoId === contatoId
              ? { ...h, erroAlteracoes: comOCodigo("Não consegui ler as alterações deste cadastro.", error, "leitura das alterações") } : h));
          }
          return;
        }
        setHistorico((h) => (h && h.contatoId === contatoId ? { ...h, alteracoes: data || [] } : h));
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
      // SÓ PINTA SE AINDA É ESTE O HISTÓRICO ABERTO (auditoria de 07/10): a
      // ponte hiberna e demora segundos, e a resposta atrasada reabria a
      // coluna fechada — ou pintava o cliente anterior ao lado do novo.
      setHistorico((h) => (h && h.contatoId === contatoId
        ? { ...h, carregando: false, linhas, erro: "", parcial: false } : h));
      carregarTratadosDoHistorico(contatoId, linhas.map((l) => l.conversaId));
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
      setHistorico((h) => (h && h.contatoId === contatoId ? { ...h, carregando: false, linhas: [], parcial: false,
                             erro: comOCodigo("Não consegui ler o histórico.", error, "leitura do histórico"),
                             tratados: { grupos: [], erro: "Sem a lista de conversas deste cliente, não há onde procurar o que foi tratado." } } : h));
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
    setHistorico((h) => (h && h.contatoId === contatoId ? { ...h, carregando: false, linhas, erro: "", parcial: true } : h));
    carregarTratadosDoHistorico(contatoId, linhas.map((l) => l.conversaId));
  }

  // ---- O "JÁ TRATEI" DESTE CLIENTE, dentro do histórico ----
  //
  //  Pedido do Rodrigo em 30/09: o que foi tratado tinha de aparecer "em cada
  //  contato também, talvez no histórico". O relatório responde "o que a
  //  equipe fez"; esta seção responde "o que já fizemos POR ESTA PESSOA" —
  //  que é a pergunta de quem abre a conversa de um cliente que voltou.
  //
  //  POR CONTATO, como o resto do painel: as conversas de TODOS os telefones
  //  dele, e não só a aberta. O "Já tratei" do SAC sobre este cliente é
  //  justamente o que o SDC precisa saber antes de responder.
  //
  //  DIRETO DO BANCO, sem a ponte. A regra de leitura de `zorvin_tratamentos`
  //  é aberta a quem entrou (script 005), então nada fica recortado pelos
  //  telefones da pessoa. As conversas vêm da lista que o histórico JÁ leu —
  //  pela ponte, o escritório inteiro; sem ela, o recorte que o painel já
  //  avisa ser parcial. Uma consulta, nenhuma rota nova, nenhum script.
  //
  //  UM CLIQUE É UM REGISTRO, e não uma linha: marcar ACORDOS e OUTROS grava
  //  duas linhas com a mesma conversa, a mesma pessoa e o mesmo instante —
  //  é assim que o relatório (script 010) conta, e as duas telas têm de dizer
  //  o mesmo número.
  //
  //  E A LEITURA QUE FALHA DIZ QUE FALHOU (armadilha nº 2): uma seção vazia
  //  aqui diria "ninguém tratou nada deste cliente", e quem lê vai responder
  //  como se fosse a primeira vez. A única ausência calada é a da TABELA —
  //  sem o script 005 o "Já tratei" não existe, e não há o que dizer.
  async function carregarTratadosDoHistorico(contatoId, conversaIds) {
    const por = (t) => setHistorico((h) => (h && h.contatoId === contatoId ? { ...h, tratados: t } : h));
    if (!conversaIds.length) { por({ grupos: [], erro: "" }); return; }
    const { data, error } = await supabase.from("zorvin_tratamentos")
      // `*`: `observacao` só existe depois do script 009, e pedi-la por nome
      // num banco sem ela derrubaria a leitura inteira (42703).
      .select("*")
      .in("conversa_id", conversaIds)
      .order("quando", { ascending: false })
      .limit(LIMITE_DO_JA_TRATEI_NO_HISTORICO);
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") { por(null); return; }
      por({ grupos: [], erro: comOCodigo("Não consegui ler o que já foi tratado com este cliente.",
                                         error, "histórico do Já tratei") });
      return;
    }
    const grupos = [];
    const porChave = new Map();
    for (const t of data || []) {
      const chave = `${t.conversa_id}|${t.quem}|${t.quando}`;
      let g = porChave.get(chave);
      if (!g) {
        g = { chave, conversaId: t.conversa_id, quem: t.quem, quando: t.quando,
              assuntos: [], observacoes: [], desfeitoEm: null, desfeitoPor: null };
        porChave.set(chave, g);
        grupos.push(g);
      }
      g.assuntos.push(t.assunto_id);
      if (t.observacao) g.observacoes.push(t.observacao);
      if (t.desfeito_em) { g.desfeitoEm = t.desfeito_em; g.desfeitoPor = t.desfeito_por || null; }
    }
    // CORTADO quando a leitura bateu no teto: o mais antigo pode ter ficado
    // de fora, e a tela diz isso em vez de mostrar a lista curta como inteira.
    por({ grupos, erro: "", cortado: (data || []).length >= LIMITE_DO_JA_TRATEI_NO_HISTORICO });
  }

  // ---- O CAMINHO DO CLIENTE NO FUNIL, dentro do histórico ----
  //
  //  Pedido do Rodrigo em 07/10. O banco guarda cada passo desde o funil
  //  (script 017, `zorvin_movimentos`) e nada na tela os mostrava: dava para
  //  ver ONDE o cliente está, e não por onde passou, quem o moveu nem quanto
  //  tempo ele ficou parado em cada etapa — que é o que se pergunta antes de
  //  cobrar alguém por um acordo que não anda.
  //
  //  DIRETO DO BANCO, sem a ponte e sem SQL novo: a regra de leitura dos
  //  movimentos (`zorvin_ve_no_funil`) libera os dos departamentos em que a
  //  pessoa vê alguma conversa deste cliente, e é o mesmo recorte do funil.
  //
  //  TRÊS ESTADOS, como o "Já tratei" do histórico: sem o script 017 a seção
  //  não existe (`funil: null`); a leitura que falha diz que falhou, com o
  //  código, e nunca vira "nunca passou pelo funil" (armadilha nº 2); e o
  //  caminho vazio é dito com todas as letras.
  //
  //  AS ETAPAS SÃO LIDAS PELO ID, e não pelo departamento aberto: o caminho
  //  inclui etapas desativadas e de outros departamentos, e uma etapa
  //  desativada continua tendo nome — é por isso que ela não se apaga.
  async function carregarCaminhoDoHistorico(contatoId) {
    if (temFunil !== true) return;
    const por = (f) => setHistorico((h) => (h && h.contatoId === contatoId ? { ...h, funil: f } : h));
    const { data, error } = await supabase.from("zorvin_movimentos")
      .select("*")
      .eq("contato_id", contatoId)
      .order("quando", { ascending: false })
      .limit(LIMITE_DO_CAMINHO_NO_HISTORICO);
    if (error) {
      if (semATabela(error)) { por(null); return; }
      por({ grupos: [], erro: comOCodigo("Não consegui ler o caminho deste cliente no funil.", error, "caminho no funil") });
      return;
    }
    const movimentos = data || [];
    const ids = [...new Set(movimentos.flatMap((m) => [m.de_etapa, m.para_etapa]).filter((x) => x != null).map(String))];
    let etapas = {};
    if (ids.length) {
      const re = await supabase.from("zorvin_etapas").select("*").in("id", ids);
      if (re.error) {
        por({ grupos: [], erro: comOCodigo("Não consegui ler as etapas do caminho deste cliente.", re.error, "etapas do caminho") });
        return;
      }
      for (const e of re.data || []) etapas[String(e.id)] = e;
    }
    por({ grupos: montarCaminho(movimentos), etapas, erro: "",
          cortado: movimentos.length >= LIMITE_DO_CAMINHO_NO_HISTORICO });
  }

  // Mudou a etapa com o histórico deste cliente aberto ao lado: o caminho
  // acompanha, pela mesma razão do "Já tratei" logo abaixo.
  function releCaminhoDoHistorico(contatoId) {
    const h = historico;
    if (!h || !h.funil || String(h.contatoId) !== String(contatoId)) return;
    carregarCaminhoDoHistorico(h.contatoId);
  }

  // Marcou ou desfez com o histórico aberto ao lado: a seção acompanha. Sem
  // isto ela continuaria dizendo o que era verdade antes do clique — e quem
  // acabou de marcar conclui que não gravou.
  function releTratadosDoHistorico(conversaId) {
    const h = historico;
    if (!h || !h.contatoId || !h.tratados) return;
    const ids = (h.linhas || []).map((l) => l.conversaId);
    if (!ids.some((id) => String(id) === String(conversaId))) return;
    carregarTratadosDoHistorico(h.contatoId, ids);
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
      if (error || !data) {
        mostrarAviso(comOCodigo("Não consegui abrir a conversa desse número.", error,
                                "abrir conversa pelo link"), 7000);
        return;
      }
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
    if (!impAdvId) { mostrarAviso(`Escolha ${voc.o} ${voc.singular} ${voc.dono} dessas conversas.`); return; }
    const meu = (impMeuNome || "").trim();
    if (!meu) { mostrarAviso(`Confirme qual nome é o seu (${voc.o} ${voc.singular}) nos arquivos.`); return; }
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
          .upsert({ advogado_id: impAdvId, contato_id: cont.id }, { onConflict: "advogado_id,contato_id" }).select("id, ultima_atividade").single();
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
        // ESTA ERA A ÚNICA GRAVAÇÃO DA IMPORTAÇÃO SEM CONFERÊNCIA NENHUMA — o
        // resultado ia inteiro para o lixo, nem o `error`. E é ela que põe a
        // conversa no lugar certo da lista: sem `ultima_atividade`, a conversa
        // importada nasce no fundo de mil outras e quem acabou de importar
        // conclui que não importou. Falhar aqui sobe (`throw`), como nas outras
        // três gravações deste laço.
        // SÓ AVANÇA, NUNCA RECUA (auditoria de 07/10). Importar o arquivo
        // exportado ontem numa conversa que recebeu mensagens hoje reescrevia
        // a prévia e a hora com as de ontem — a conversa descia na lista — e
        // zerava as não lidas de verdade, sumindo com o selo de um cliente
        // esperando. Se a conversa já tem coisa mais nova, ela fica como está.
        const jaTemMaisNovo = conv.ultima_atividade
          && new Date(conv.ultima_atividade).getTime() >= ult.data.getTime();
        if (!jaTemMaisNovo) {
          const rConv = await supabase.from("conversas").update({
            ultima_mensagem: (rotularMidiaExport(ult.texto) || ult.texto || "").slice(0, 200),
            ultima_atividade: ult.data.toISOString(),
            nao_lidas: 0,
          }).eq("id", conv.id).select("id");
          if (rConv.error) throw rConv.error;
          if (naoGravouNada(rConv)) {
            throw new Error("o banco não deixou atualizar a conversa importada — as mensagens "
                          + "entraram, mas ela não vai aparecer no alto da lista");
          }
        }
        // A ESPERA É RECONTADA DO ZERO depois do lote: a importação chega fora
        // da ordem do tempo, e o gatilho incremental não tem como acertar
        // sozinho (ver o CLAUDE.md da ponte). Sem a função (script 004), segue.
        const { error: erroEspera } = await supabase.rpc("zorvin_recontar_espera", { p_conversa: conv.id });
        if (erroEspera) console.error("Zorvin — recontar a espera depois da importação:", erroEspera);
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
    // A RESPOSTA É DESTA CONVERSA? A guarda de baixo vale para o erro também
    // (auditoria de 07/10): a falha atrasada da conversa ANTERIOR pintava o
    // cartão de erro e o aviso por cima da conversa nova, que tinha carregado.
    if (erro && conversaIdRef.current !== convId) return;
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
      naoSairam = (falhas || []).filter((f) => !dispensados.has(String(f.id)))
        .map((f) => bolhaDaFilaQueFalhou(f, convId));
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
        .eq("id", convId).select("id")
        .then((r) => {
          if (r.error) desligarRecurso("atendendo", r.error);
          else if (naoGravouNada(r)) desligarPorRecusa("atendendo");
        });
    }
  }, [meuNome]);

  useEffect(() => { carregarMensagens(conversaId); }, [conversaId, carregarMensagens]);

  // ------------------------------------------------------------
  //  O QUE ESTÁ AGENDADO NESTA CONVERSA
  //
  //  Os PENDENTES da conversa, e o recorte dos agendados é feito aqui: os
  //  pendentes comuns são um punhado e saem em segundos, e perguntar "com hora
  //  marcada" ao banco exigiria um `not is null` que a bancada não sabe fazer —
  //  uma conferência montada sobre ele não provaria nada.
  //
  //  As colunas vão PELO NOME, e não `*`: é a coluna que falta que responde se
  //  o script 013 rodou, sem uma consulta própria para isso.
  // ------------------------------------------------------------
  const carregarAgendadas = useCallback(async (convId) => {
    if (!convId) { setAgendadas([]); return; }
    const r = await supabase.from("fila_envio")
      .select("id, conversa_id, tipo, texto, midia_nome, agendada_para, enviado_por, enviado_por_id, criado_em")
      .eq("conversa_id", convId).eq("status", "pendente")
      .order("criado_em", { ascending: true }).limit(100);
    // A RESPOSTA DE OUTRA CONVERSA não pinta esta: quem trocou de conversa no
    // meio da ida veria as agendadas da anterior, com o botão de cancelar.
    if (String(convId) !== String(conversaIdRef.current)) return;
    if (r.error) {
      if (semAColunaDaAgenda(r.error)) { setTemAgenda(false); setAgendadas([]); return; }
      // FALHA NÃO É AUSÊNCIA: "nada agendado" no lugar de "não consegui ler"
      // faria alguém agendar de novo uma mensagem que já está na fila — e o
      // cliente receberia duas.
      anotarFalhaDeLeitura("agendadas", "as mensagens agendadas", r.error);
      return;
    }
    limparFalhaDeLeitura("agendadas");
    setTemAgenda(true);
    setAgendadas((r.data || []).filter((x) => x.agendada_para)
      .sort((a, b) => new Date(a.agendada_para) - new Date(b.agendada_para)));
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);

  // ESPELHO para o tempo real, que registra o tratador uma vez só.
  const carregarAgendadasRef = useRef(carregarAgendadas);
  carregarAgendadasRef.current = carregarAgendadas;

  useEffect(() => { setAgendadas([]); setEscolhendoHora(null); setEditandoAgendada(null); carregarAgendadas(conversaId); },
    [conversaId, carregarAgendadas]);

  // NA HORA MARCADA, A LISTA SE RELÊ SOZINHA. A ponte manda a mensagem e ela
  // aparece na conversa pelo tempo real; sem esta releitura, a mesma mensagem
  // continuaria embaixo dizendo "agendada", com um Cancelar que já não cancela
  // nada. Dez segundos depois da hora, que é o que a ponte leva para ler a
  // fila e falar com a Uazapi.
  useEffect(() => {
    if (!agendadas.length || !conversaId) return undefined;
    const proxima = Math.min(...agendadas.map((a) => new Date(a.agendada_para).getTime()));
    const espera = Math.max(proxima - Date.now(), 0) + 10000;
    // `setTimeout` não aguenta mais de ~24 dias: passado disso ele dispara na
    // hora. Uma agendada para daqui a um mês faria a lista se reler em loop.
    if (espera > 2 ** 31 - 1) return undefined;
    const t = setTimeout(() => carregarAgendadas(conversaId), espera);
    return () => clearTimeout(t);
  }, [agendadas, conversaId, carregarAgendadas]);

  /** Grava UMA mensagem agendada. A hora vai em `agendada_para` E em
   *  `tentar_em`: a leitura da ponte já pula quem tem `tentar_em` no futuro, e
   *  o aviso de "fila parada" também — ele só conta item cuja hora passou.
   *
   *  NÃO PASSA POR `inserirNaFila`, e é de propósito: lá, responder marca a
   *  conversa como minha e assume o dono. Agendar não é responder — o cliente
   *  ainda não recebeu nada, e a conversa não pode sair da fila de quem
   *  espera nem trocar de mãos por causa de uma mensagem que talvez seja
   *  cancelada. */
  async function gravarAgendada(payload, quando) {
    const motivo = porQueNaoServe(quando);
    if (motivo) return { error: { message: motivo }, motivo };
    return emFila(() => gravarNaFila({
      ...payload, status: "pendente", agendada_para: quando, tentar_em: quando,
      enviado_por: meuNome, enviado_por_id: meuId, enviado_por_foto: minhaFoto,
    }));
  }

  async function agendarTexto(quando) {
    const t = rascunho.trim();
    const convId = conversaId;
    if (!t || !convId) return;
    setEscolhendoHora(null);
    const payload = { conversa_id: convId, texto: t };
    const alvo = respondendo;
    if (alvo) {
      payload.responder_id_uazapi = alvo.id_uazapi;
      payload.resposta_previa = alvo.previa;
      payload.resposta_autor = alvo.autor;
    }
    const r = await gravarAgendada(payload, quando);
    if (r.error) {
      // O TEXTO FICA NA CAIXA. Apagar antes de saber se gravou faria quem
      // escreveu um recado longo perdê-lo junto com a gravação.
      mostrarAviso(r.motivo || comOCodigo("Não consegui agendar a mensagem.", r.error, "agendar mensagem"), 7000);
      return;
    }
    // O RASCUNHO LIMPO É O DESTA CONVERSA (auditoria de 07/10): trocando de
    // conversa durante a gravação, o `setRascunho("")` apagava o rascunho da
    // conversa NOVA, e o texto agendado ficava guardado como rascunho desta —
    // ao voltar, o Enter o mandaria na hora, em dobro com a agendada.
    delete rascunhosRef.current[convId];
    if (conversaIdRef.current === convId) {
      setRascunho("");
      setRespondendo(null);
    }
    mostrarAviso(`Mensagem agendada para ${rotuloDaHora(quando)}.`);
    carregarAgendadas(convId);
  }

  /** Cancela uma agendada. A condição `status = pendente` vai NA gravação: se
   *  a ponte pegou o item no mesmo segundo, quem chegou primeiro fica, e a
   *  frase diz o que aconteceu em vez de afirmar um cancelamento que não
   *  houve. */
  /** EDITAR UMA AGENDADA (pedido de 05/10): o texto (ou a legenda do anexo) e
   *  a hora. A hora vai de novo nos DOIS lugares, como ao agendar.
   *
   *  `.eq("status", "pendente")` na gravação, e a regra do banco (script 016)
   *  só deixa mexer antes da hora: perto dela a ponte pode estar pegando o
   *  item, e é por isso que o botão some no último minuto. Recusada, a edição
   *  vem como ERRO (42501) — a regra do cancelar alcança a mesma linha —, e a
   *  frase diz as duas causas possíveis com o código. */
  async function salvarAgendada(item, quando, texto) {
    const motivo = porQueNaoServe(quando);
    if (motivo) { mostrarAviso(motivo, 6000); return; }
    setEditandoAgendada(null);
    const mudancas = { texto: texto || "", agendada_para: quando, tentar_em: quando };
    let r = await supabase.from("fila_envio")
      .update({ ...mudancas, editada_em: new Date().toISOString(), editada_por: meuId })
      .eq("id", item.id).eq("status", "pendente").select("id");
    // BASE SEM AS COLUNAS DE QUEM EDITOU: grava o que importa sem elas.
    if (r.error && /editada_/.test(String(r.error.message || ""))) {
      r = await supabase.from("fila_envio").update(mudancas)
        .eq("id", item.id).eq("status", "pendente").select("id");
    }
    if (r.error) {
      mostrarAviso(comOCodigo("Não deu para editar: a mensagem já está na hora de sair, ou o banco não deixou.",
                              r.error, "editar agendada"), 8000);
    } else if (naoGravouNada(r)) {
      mostrarAviso("Não deu para editar: ela já saiu, ou o banco não deixou. Confira a conversa.", 7000);
    } else {
      mostrarAviso(`Mensagem agendada alterada — sai ${rotuloDaHora(quando)}.`);
    }
    carregarAgendadas(item.conversa_id);
  }

  async function cancelarAgendada(item) {
    const r = await supabase.from("fila_envio")
      .update({ status: "cancelada", cancelada_em: new Date().toISOString(), cancelada_por: meuId })
      .eq("id", item.id).eq("status", "pendente").select("id");
    if (r.error) {
      mostrarAviso(comOCodigo("Não consegui cancelar a mensagem agendada.", r.error, "cancelar agendada"), 7000);
    } else if (naoGravouNada(r)) {
      // ZERO LINHAS TEM DUAS CAUSAS, e as duas cabem numa frase: a ponte já a
      // mandou (a hora chegou), ou o banco não deixou. A lista relida abaixo
      // responde qual — se ela sumiu da lista e apareceu na conversa, saiu.
      mostrarAviso("Não deu para cancelar: ela já saiu, ou o banco não deixou. Confira a conversa.", 7000);
    } else {
      mostrarAviso("Agendamento cancelado — a mensagem não vai sair.");
    }
    carregarAgendadas(item.conversa_id);
  }

  // SOBE MAIS UM LOTE de histórico, a partir da mensagem mais antiga que já
  // está na tela. É o "carregar anteriores" do WhatsApp Web — e é ele que
  // permite que a abertura da conversa traga só as últimas, que é o barato.
  async function carregarAntigas(antesDe = null) {
    // ELA DEVOLVE O QUE TROUXE, e não só mexe no estado.
    //
    // `irParaCitada` a chama e procura a citada logo em seguida. Esperar o
    // `await` NÃO espera o React redesenhar: o `setMensagens` agenda, e o
    // espelho da lista só é atualizado no efeito que roda depois do desenho.
    // Medido: o clique na citação de três meses atrás carregava as anteriores
    // e dizia "não achei" sobre uma mensagem que tinha acabado de chegar.
    //
    // Com o lote na mão, quem chamou procura no que chegou, sem depender de
    // quando o desenho acontece.
    // A TRAVA E O PONTO DE PARTIDA NÃO VÊM DO FECHO (auditoria de 07/10).
    // `irParaCitada` chama esta função três vezes seguidas pelo espelho, e o
    // espelho é trocado a cada desenho: a segunda chamada era a versão desenhada
    // DURANTE a primeira ida, com `buscandoAntigas === true` — e devolvia vazio
    // na hora. As "três rodadas, 360 mensagens" eram uma só, de 120. Agora a
    // trava é um ref, a conversa é a do ref, e quem chama pode dizer de onde
    // partir (`antesDe`), porque o espelho da lista ainda é o de antes.
    const convId = conversaIdRef.current;
    if (buscandoAntigasRef.current || !convId) return [];
    const maisAntiga = antesDe ? { criado_em: antesDe }
      : mensagensRef.current.find((m) => m.origem !== "nota");
    if (!maisAntiga) return [];
    buscandoAntigasRef.current = true;
    setBuscandoAntigas(true);
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .lt("criado_em", maisAntiga.criado_em)
      .order("criado_em", { ascending: false })
      .limit(TETO_MENSAGENS);
    buscandoAntigasRef.current = false;
    setBuscandoAntigas(false);
    if (error) { mostrarAviso(comOCodigo("Não consegui trazer as mensagens anteriores.", error, "mensagens anteriores")); return []; }
    // Troquei de conversa enquanto isto vinha: joga fora, senão o histórico de
    // uma pessoa aparece na conversa de outra.
    if (conversaIdRef.current !== convId) return [];
    const lote = (data || []).slice().reverse();
    setTemMaisAntigas(lote.length >= TETO_MENSAGENS);
    if (!lote.length) return [];
    setMensagens((prev) => {
      const jaTem = new Set(prev.map((m) => m.id));
      return [...lote.filter((m) => !jaTem.has(m.id)), ...prev];
    });
    return lote;
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
        .eq("id", conversaId).select("id")
        .then((r) => {
          if (r.error) desligarRecurso("atendendo", r.error);
          // A recusa calada não é erro passageiro: ela não muda no minuto
          // seguinte, e sem isto o pulso bateria no banco para sempre à toa.
          else if (naoGravouNada(r)) desligarPorRecusa("atendendo");
          else return;
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

  // O ESPELHO DA REPOSIÇÃO, refeito a cada desenho. O que ele guarda é a
  // versão de AGORA das leituras — inclusive `carregarMensagens`, que muda de
  // identidade a cada conversa aberta e por isso não pode entrar nas
  // dependências do canal.
  //
  // Relê a lista, os selos, as etiquetas e a conversa que está aberta: é tudo
  // o que o tempo real mantém vivo, e portanto tudo o que pode ter ficado para
  // trás enquanto ele esteve fora.
  useEffect(() => {
    reporRef.current = () => {
      carregarConversas(advogadoIdRef.current, 0, conversaIdRef.current);
      carregarNaoLidasPorAdv();
      carregarTags();
      carregarTagsConversas();
      if (conversaIdRef.current) carregarMensagens(conversaIdRef.current);
    };
  });

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
    let carencia = null;
    let vigia = null;
    // O RELÓGIO DA PESCA — ver CADENCIA_DA_PESCA_MS.
    let pesca = null;
    let tentativas = 0;
    let canal = null;
    let vivo = true;
    // O NOME CARREGA O NÚMERO DA TENTATIVA, e isso não é enfeite: no painel do
    // Supabase dá para ver quantas salas o navegador abriu, que é a única
    // janela que existe para saber se o vigia está apanhando lá fora.
    const proximoNome = () => `zorvin-realtime-${++contaDeNomesDoCanal}`;

    // ============================================================
    //  CADA TENTATIVA GANHA UM NOME PRÓPRIO
    //
    //  Era `"zorvin-realtime"` fixo. Refazendo o canal, o painel pedia ao
    //  servidor uma sala com o MESMO nome da que ele estava acabando de
    //  deixar — e a saída ainda não tinha terminado (ver `refazerOCanal`).
    //  Entrar numa sala da qual ainda se está saindo é uma das formas de
    //  receber de volta o "mismatch between server and client bindings" que
    //  MATA o canal, que é exatamente o defeito que o vigia existe para
    //  consertar. O conserto se reinfectava.
    //
    //  Nome novo a cada tentativa não tem esse problema: a sala velha fecha no
    //  tempo dela, e a nova não espera por ninguém.
    // ============================================================
    const montar = (nome) => supabase
      .channel(nome)
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
        // A MENSAGEM DO ESCRITÓRIO ATUALIZA O GUARDADO. Um colega respondendo
        // faz a conversa deixar de ser órfã — e isso chega aqui pelo tempo
        // real, de graça, sem perguntar nada ao banco.
        if (nova.origem === "advogado" && nova.enviado_por_id) {
          const antes = deQuemEhAConversa.current.get(nova.conversa_id);
          deQuemEhAConversa.current.set(nova.conversa_id, {
            minha: (antes && antes.minha) || String(nova.enviado_por_id) === String(meuIdRef.current),
            orfa: false,
          });
        }

        // ------------------------------------------------------------
        //  A QUEM ESTE AVISO INTERESSA
        //
        //  Três casos, e o terceiro é o que o Rodrigo decidiu em 15/09:
        //
        //    1. participei da conversa  -> avisa, esteja eu olhando o telefone
        //       que for. É o pedido da equipe.
        //    2. participou outra pessoa -> NÃO avisa. A conversa tem dono, e
        //       um aviso que não pede ação de quem lê se aprende a ignorar —
        //       aí o próximo, que pedia, passa batido junto.
        //    3. ninguém participou      -> avisa TODO MUNDO que a enxerga. É a
        //       primeira mensagem de um cliente novo: ela não tem dono ainda, e
        //       deixá-la sem aviso é o lead ficar sem resposta, que é o pior
        //       desfecho deste sistema.
        //
        //  O TELEFONE ABERTO SAIU DA CONTA, e era ele o defeito: quem enxerga a
        //  mensagem já passou pela regra de acesso do banco — se ela chegou
        //  aqui, esta pessoa pode vê-la.
        // ------------------------------------------------------------
        if (nova.origem === "contato"
            && (document.hidden || nova.conversa_id !== conversaIdRef.current)) {
          const paraMim = await esteAvisoMeInteressa(nova.conversa_id);
          if (paraMim) {
            tocarAviso();
            // O NOME DE QUEM ESCREVEU, e não "Nova mensagem". Com a etiqueta
            // por conversa, dois clientes escrevendo viram dois avisos — e dois
            // avisos dizendo "Nova mensagem" não dizem a qual conversa ir.
            const quem = conversasRef.current.find((c) => c.id === nova.conversa_id);
            notificarDesktop(
              (quem && nomeDoContato(quem.contato)) || "Nova mensagem",
              nova.texto || "Mídia recebida",
              nova.conversa_id);
          }
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
            // A ESPERA ACOMPANHA, e pela PRESENÇA da chave, não pelo valor: a
            // resposta da equipe grava NULO de propósito (saiu da fila), e um
            // `??` manteria a data velha — a linha continuaria dizendo
            // "esperando há 6 dias" e no lugar de quem espera. Sem a coluna
            // (script 004 não rodado) a chave não vem, e nada muda.
            ...(Object.prototype.hasOwnProperty.call(cv, "esperando_desde")
              ? { esperando_desde: cv.esperando_desde } : {}),
            ...(Object.prototype.hasOwnProperty.call(cv, "tratada_em")
              ? { tratada_em: cv.tratada_em } : {}),
            // O DONO, e aqui NÃO É `??`. Tirar o responsável grava NULO de
            // propósito, e `??` trocaria esse nulo pelo dono antigo: a tela
            // dos colegas continuaria dizendo "com a Jenifer" para uma
            // conversa que ela devolveu. Quem decide se a coluna existe é a
            // presença da chave, e não o valor.
            ...(Object.prototype.hasOwnProperty.call(cv, "responsavel_id") ? {
              responsavel_id: cv.responsavel_id,
              responsavel_em: cv.responsavel_em,
              responsavel_por: cv.responsavel_por,
            } : {}),
          } : c);
          // Fixadas no alto; entre iguais, a ordem que a pessoa escolheu —
          // INCLUSIVE a da espera. Era aqui que a fila virava "Recentes" a
          // cada conversa aberta (relato de 30/09, ver `compararConversas`).
          // Pelos `ref`s e não pelo estado: este tratador é registrado uma vez
          // e ficaria preso na ordem que valia naquele instante.
          return patched.sort(compararConversas(ordemRef.current, ordenarPelaEsperaRef.current));
        });
        carregarNaoLidasPorAdv();
      })
      // Se a ponte não conseguir enviar, a fila vira "erro" — aviso na tela.
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_envio" }, (payload) => {
        const row = payload.new;
        if (!row || row.conversa_id !== conversaIdRef.current) return;
        // UMA AGENDADA MEXEU — um colega agendou, cancelou, ou a ponte a
        // mandou. A lista de baixo se relê; sem isto, quem está com a conversa
        // aberta veria uma agendada que outra pessoa já cancelou.
        if (row.agendada_para) carregarAgendadasRef.current(row.conversa_id);
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
          const proximo = prev.map((m) => {
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
          // A AGENDADA QUE FALHOU NA HORA não tem bolha provisória para pintar
          // (agendar não cria bolha — nada foi ao cliente). Sem esta, ela saía
          // da faixa das agendadas e sumia da conversa aberta como se tivesse
          // sido enviada; o vermelho só aparecia ao reabrir (auditoria de 07/10).
          if (marcado || !row.agendada_para || lerDispensados().has(String(row.id))
              || prev.some((m) => m.id === "fila-" + row.id)) return proximo;
          return [...proximo, bolhaDaFilaQueFalhou(row, row.conversa_id)];
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
      // O ESTADO DO CANAL, QUE NINGUÉM ESTAVA OLHANDO.
      //
      // `.subscribe()` vinha sem retorno de chamada nenhum. O canal podia cair
      // e o painel seguia desenhando a mesma tela — e a tela de uma conversa
      // sem mensagem nova é idêntica à de uma conversa em que o cliente não
      // respondeu.
      .subscribe(aoMudarDeEstado);

    // O SEGUNDO ARGUMENTO É O MOTIVO, e ele vinha sendo descartado. Ver
    // `resumirMotivo`, lá em cima, para o que cada forma quer dizer — é a
    // única pista que existe da causa, que segue em aberto.
    function aoMudarDeEstado(estado, erro) {
      if (estado === "SUBSCRIBED") {
        // A VOLTA RELÊ. O `postgres_changes` não repete o que passou: tudo o
        // que o banco publicou durante a queda não chega nunca. Só apagar o
        // aviso deixaria a pessoa tranquila e a tela errada — que é pior do
        // que o aviso aceso.
        //
        // Só na VOLTA, e não na primeira assinatura: ali a tela acabou de ser
        // carregada, e reler seria uma segunda leitura de tudo a cada
        // abertura do painel. Vale também para a volta que o VIGIA conseguiu:
        // o canal que ele refez é um canal novo, e o que passou continua
        // tendo passado.
        if (caiuRef.current) {
          caiuRef.current = false;
          reporRef.current();
        }
        tentativas = 0;
        clearTimeout(vigia); vigia = null;
        clearTimeout(carencia); carencia = null;
        // O CANAL VOLTOU: a pesca para. Deixá-la correndo seria cinco
        // consultas a cada vinte segundos, por atendente, para sempre.
        clearInterval(pesca); pesca = null;
        return;
      }
      // QUEDA NÃO COMEÇA A PESCA NA HORA. Uma reconexão comum passa por
      // `CLOSED` e volta em poucos segundos; sair relendo ali seria cinco
      // consultas por soluço, por atendente. Dez segundos calados é o que
      // separa o soluço da queda.
      //
      // OS DOIS RELÓGIOS SÓ SÃO ARMADOS UMA VEZ, e é o que os torna relógios
      // de "quanto tempo fora" em vez de "quanto tempo desde o último erro".
      // Cada tentativa do vigia que não pega gera outro `CHANNEL_ERROR`; se
      // eles rearmassem, a pesca nunca começaria — o conserto teria desligado
      // justamente o que faz as mensagens continuarem chegando.
      caiuRef.current = true;
      // O CONSOLE É O ÚNICO LUGAR ONDE O MOTIVO FICA, desde que a faixa saiu.
      //
      // A MENSAGEM VAI COMO TEXTO, e o erro inteiro DEPOIS dela: só o objeto
      // chega dobrado no console, e quem tira a foto manda a linha fechada —
      // sem a frase que interessa. Como texto ela está na linha; como objeto,
      // a pilha continua a um clique.
      console.error(`[zorvin] tempo real: ${resumirMotivo(estado, erro)}`, erro || "");
      if (!carencia) {
        carencia = setTimeout(() => {
          // COMEÇA A PESCAR. É isto que faz as mensagens continuarem
          // chegando com o canal fora — ver CADENCIA_DA_PESCA_MS.
          if (!pesca) {
            reporRef.current();
            pesca = setInterval(() => reporRef.current(), CADENCIA_DA_PESCA_MS);
          }
        }, CARENCIA_TEMPO_REAL_MS);
      }
      armarOVigia();
    }

    function armarOVigia() {
      if (vigia) return;
      vigia = setTimeout(refazerOCanal,
                         ESPERAS_DE_VOLTA[Math.min(tentativas, ESPERAS_DE_VOLTA.length - 1)]);
    }

    async function refazerOCanal() {
      vigia = null;
      if (!vivo) return;
      tentativas += 1;
      // TIRA O VELHO ANTES, E ESPERA ELE SAIR.
      //
      // `removeChannel` é ASSÍNCRONO: ele manda o pedido de saída e só termina
      // quando o servidor responde. Isto aqui não esperava — mandava sair e
      // criava o canal novo na mesma batida. Contra o servidor de verdade, os
      // dois se atropelam.
      //
      // A BANCADA NÃO PEGAVA ISSO, e é o que explica um conserto provado que
      // não consertou: lá `removeChannel` é instantâneo, então a ordem certa e
      // a errada davam no mesmo. Hoje ela devolve promessa, como o de verdade.
      //
      // Dois canais vivos ao mesmo tempo entregariam cada mensagem DUAS vezes,
      // e as telas que somam (o selo de não lidas) contariam dobrado.
      try { await supabase.removeChannel(canal); } catch (_e) { /* já tinha saído */ }
      // A TELA PODE TER SIDO FECHADA NO MEIO DA ESPERA. Sem esta conferência, o
      // canal novo nasceria órfão, depois de a limpeza do efeito já ter passado
      // — e ninguém o removeria nunca.
      if (!vivo) return;
      canal = montar(proximoNome());
      // E O VIGIA SEGUE ARMADO: se esta também não pegar, tenta de novo,
      // esperando mais. Quem o desarma é o `SUBSCRIBED`.
      armarOVigia();
    }

    canal = montar(proximoNome());
    return () => {
      vivo = false;
      clearTimeout(carencia);
      clearTimeout(vigia);
      // A PESCA MORRE COM O EFEITO. Sem isto, sair e entrar no painel deixaria
      // um relógio de consultas rodando para sempre, invisível.
      clearInterval(pesca);
      supabase.removeChannel(canal);
    };
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
  // UM CORTE SÓ, NA ORIGEM. Daqui saem os três caminhos que falam com a ficha:
  // a lista de processos do cliente, a barra que a oferece, e a subida da nota.
  // Guardar os três separado seria a mesma decisão escrita em três lugares,
  // para divergirem no primeiro conserto.
  //
  // E NÃO BASTA A COLUNA ESTAR VAZIA. Numa instalação que nunca teve Vantoro
  // ela está mesmo — mas num escritório que DESLIGA o Vantoro os
  // `vantoro_cliente_id` de antes continuam gravados, e aí cada nota tentaria
  // subir para uma ficha que não existe mais e diria "não subiu agora, tente
  // editá-la daqui a pouco". Um pedido de espera que nunca se cumpre é a
  // armadilha do anexo indisponível de novo, agora na nota da equipe.
  const clienteDaConversa = temVantoro === true
    ? (conversa?.contato?.vantoro_cliente_id || null)
    : null;

  // O NOME ESTÁ TRAVADO PELO CADASTRO? Quem tem ficha no Vantoro é conhecido
  // pelo nome dela, e o lápis de renomear some — o caminho é a ficha.
  //
  // SEM VANTORO ISSO VIRA UM BECO. A ficha está escondida, então o lápis que
  // some não manda mais a lugar nenhum: o contato fica com o nome cru do
  // WhatsApp e sem nenhuma forma de trocá-lo. Acontece de verdade num
  // escritório que DESLIGA o Vantoro — os `vantoro_nome` de antes continuam
  // gravados na tabela.
  const nomeTravadoPeloCadastro = temVantoro === true
    && Boolean(conversa?.contato?.vantoro_nome);
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
    // UMA EDIÇÃO EM CURSO NÃO ATRAVESSA A TROCA (auditoria de 07/10). Ela
    // ficava armada: na conversa nova, o Enter "salvava a edição" — mandava a
    // correção da mensagem de A com o id de A na fila de B, ou reescrevia a
    // nota de A com o texto digitado para B. E o texto da edição NÃO vira
    // rascunho de A: voltando lá, o Enter mandaria a mensagem antiga de novo.
    const estavaEditando = !!editandoRef.current;
    if (estavaEditando) { setEditando(null); setProcessoDaNota(""); }
    // E O "RENOMEAR" TAMBÉM: aberto em A e confirmado em B, gravava em B o
    // nome digitado para A.
    setRenomeando(null);
    if (antes && antes !== conversaId && !estavaEditando) {
      const texto = rascunhoRef.current;
      if (texto.trim()) rascunhosRef.current[antes] = { texto, nota: modoNotaRef.current };
      else delete rascunhosRef.current[antes];
    }
    conversaAnteriorRef.current = conversaId;
    const guardado = conversaId ? rascunhosRef.current[conversaId] : null;
    setRascunho(guardado ? guardado.texto : "");
    setModoNota(guardado ? !!guardado.nota : false);
    setPertoDoFim(true); setBuscaAberta(false); setBuscaConversa(""); setEmojiAberto(false); setRespondendo(null); setHistorico(null); setTagMenuAberto(false);
    // A FICHA SÓ SE FECHA NO CELULAR ao trocar de conversa. No computador ela
    // é coluna fixa: fechá-la aqui faria o pedido de 28/09 valer só até o
    // segundo clique, e ninguém ligaria uma coisa à outra.
    if (estreitoRef.current) setFichaAberta(false);
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

  // ------------------------------------------------------------
  //  CLICAR NA CITAÇÃO LEVA ATÉ A MENSAGEM CITADA
  //
  //  Pedido do Rodrigo em 16/09: "ao clicar na mensagem que foi respondida,
  //  ir para a mensagem". É o que o WhatsApp faz, e sem isso a citação é só
  //  uma prévia de 120 caracteres — bastante para lembrar do assunto, pouco
  //  para achar o que foi dito antes dela.
  //
  //  O ELO JÁ ESTAVA GRAVADO: `responder_id_uazapi` guarda o id da citada
  //  desde que a ponte passou a ler o formato certo da Uazapi. O que faltava
  //  era o clique.
  //
  //  A CITADA PODE NÃO ESTAR CARREGADA. A conversa abre com as 120 mensagens
  //  mais recentes, e uma resposta a algo de três semanas atrás aponta para
  //  fora desse pedaço. Aí o clique CARREGA as anteriores e tenta de novo —
  //  um "não achei" sem ter ido buscar seria o painel desistindo em nome de
  //  quem clicou.
  //
  //  E DESISTE DIZENDO, quando o histórico acaba sem ela: a mensagem pode ter
  //  sido apagada, e um clique que não faz nada é indistinguível de um clique
  //  que não funcionou.
  //  A FUNÇÃO PRECISA SER ESTÁVEL E VER O PRESENTE — e as duas coisas brigam.
  //
  //  Estável porque ela desce para `ListaDeBolhas`, que é `React.memo`: uma
  //  função nova a cada desenho faria o `memo` nunca bater, e a lista inteira
  //  de bolhas seria redesenhada a cada tecla digitada na caixa de escrever.
  //
  //  Só que `useCallback([])` congela TUDO o que ela alcança. Medido aqui: com
  //  `carregarAntigas` capturada no fecho, ela era a versão do primeiro desenho
  //  — quando `mensagens` ainda era uma lista vazia —, e desistia na primeira
  //  linha sem ir ao banco. O sintoma era o pior possível: clicar na citação de
  //  três meses atrás não fazia NADA, nem levava nem avisava.
  //
  //  Por isso tudo o que envelhece entra por espelho.
  const indoParaCitadaRef = useRef(false);
  const carregarAntigasRef = useRef(null);
  // O RELÓGIO DO DESTAQUE, guardado para ser CANCELADO no clique seguinte.
  //
  // Sem isto, dois cliques em menos de quatro segundos se atropelam: o relógio
  // do primeiro dispara no meio do segundo e apaga a marca da mensagem que
  // acabou de ser encontrada. A pessoa fica no meio da conversa sem saber qual
  // bolha é a citada — que é exatamente o que a marca existe para evitar.
  // (Foi a prova que pegou: o segundo salto chegava, rolava e ficava sem marca.)
  const relogioDoDestaqueRef = useRef(null);
  const irParaCitada = useCallback(async (idCitada) => {
    if (!idCitada || indoParaCitadaRef.current || !carregarAntigasRef.current) return;
    const achar = () => mensagensRef.current.find((x) => x.id_uazapi === idCitada);
    let alvo = achar();
    if (!alvo) {
      indoParaCitadaRef.current = true;
      try {
      // TRÊS RODADAS, e não "até achar": cada uma é uma ida ao banco, e um id
      // que não existe mais varreria a conversa inteira à toa. 360 mensagens
      // para trás cobrem o que uma citação alcança na prática.
      //
      // A PRIMEIRA RODADA NÃO CONSULTA O ESPELHO de `temMaisAntigas`: ele vale
      // o que valia no desenho anterior, e numa conversa recém-aberta isso é
      // "ainda não sei". Quem sabe é a própria `carregarAntigas`, que devolve
      // lista vazia quando não há mais nada — e o laço para nela.
      let antesDe = null;
      for (let i = 0; i < 3 && !alvo; i++) {
        if (i > 0 && !temMaisAntigasRef.current) break;
        const lote = await carregarAntigasRef.current(antesDe);
        if (lote && lote.length) antesDe = lote[0].criado_em;
        // NO LOTE QUE CHEGOU, e não só no espelho: o `await` volta antes de o
        // React redesenhar, então o espelho ainda é o de antes de carregar.
        alvo = (lote || []).find((x) => x.id_uazapi === idCitada) || achar();
        if (!lote || !lote.length) break;
      }
      } finally {
        // NO `finally`, e não depois do laço: um erro de rede no meio deixaria
        // a trava levantada para sempre, e o clique seguinte não faria nada.
        indoParaCitadaRef.current = false;
      }
    }
    if (!alvo) {
      mostrarAviso("Não achei a mensagem citada — ela pode ter sido apagada.");
      return;
    }
    setMsgDestacada(String(alvo.id));
    setPertoDoFim(false);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-msg-id="${alvo.id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    clearTimeout(relogioDoDestaqueRef.current);
    relogioDoDestaqueRef.current = setTimeout(() => setMsgDestacada(null), 4000);
  }, []);

  useEffect(() => { mensagensRef.current = mensagens; }, [mensagens]);
  useEffect(() => { carregarAntigasRef.current = carregarAntigas; });
  useEffect(() => { temMaisAntigasRef.current = temMaisAntigas; }, [temMaisAntigas]);

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
      // A MESMA FUNÇÃO DA TELA DE AVISOS, e não uma segunda chamada solta: o
      // pedido daqui também tem de atualizar o que a tela mostra, senão a aba
      // Avisos abriria dizendo "ainda não autorizado" para quem acabou de
      // autorizar ao abrir a primeira conversa.
      pedirPermissaoDeAviso();
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
  // SÓ AS QUE SAÍRAM DA LISTA (auditoria de 07/10). A limpeza rodava a cada
  // mudança com a lista ANTERIOR inteira: cada tecla na legenda, cada arquivo a
  // mais e cada um tirado invalidavam as prévias que continuavam na tela — com
  // dois arquivos, trocar para o outro mostrava a prévia quebrada.
  const blobsDosAnexosRef = useRef(new Set());
  useEffect(() => {
    const agora = new Set(anexosPendentes.map((a) => a.url).filter((u) => u && String(u).startsWith("blob:")));
    for (const u of blobsDosAnexosRef.current) if (!agora.has(u)) URL.revokeObjectURL(u);
    blobsDosAnexosRef.current = agora;
  }, [anexosPendentes]);
  useEffect(() => () => {
    for (const u of blobsDosAnexosRef.current) URL.revokeObjectURL(u);
  }, []);

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

  const pedidoMidiasRef = useRef(0);
  const abrirMidias = useCallback(async (aba = "midias") => {
    setMidiasAberta(true);
    const meu = ++pedidoMidiasRef.current;
    setAcervo((a) => ({ ...a, carregando: true, erro: "" }));
    // O TIPO VAI PARA O BANCO, e cada aba pergunta o seu (auditoria de 07/10).
    // Antes vinham as 500 mensagens mais recentes de QUALQUER tipo e a aba
    // filtrava aqui: num escritório movimentado, 500 são poucas horas de
    // texto, e "Nenhum documento ainda" se lia como completo.
    let q = supabase
      .from("mensagens")
      .select("id, conversa_id, tipo, texto, midia_url, midia_mime, criado_em");
    if (aba === "midias") q = q.in("tipo", ["imagem", "video"]).not("midia_url", "is", null);
    else if (aba === "documentos") q = q.eq("tipo", "documento").not("midia_url", "is", null);
    else q = q.ilike("texto", "%http%");
    // Teto de 500: é acervo para OLHAR, não para auditar. Sem teto, um ano de
    // conversa desenharia milhares de miniaturas de uma vez e a tela travaria
    // justamente em quem mais usa.
    const { data, error } = await q.order("criado_em", { ascending: false }).limit(500);
    if (meu !== pedidoMidiasRef.current) return;
    // A FALHA FICA NA JANELA, e não vira "Nenhuma foto ainda" depois que o
    // aviso de quatro segundos some (armadilha nº 2).
    if (error) {
      setAcervo({ carregando: false, itens: [], erro: comOCodigo("Não consegui abrir as mídias.", error, "mídias") });
      return;
    }
    setAcervo({ carregando: false, itens: data || [], erro: "", cheio: (data || []).length >= 500 });
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
      // A JANELA DA HORA está por cima de tudo onde ela abre — inclusive da
      // prévia dos anexos: Esc fecha ELA, e não o lote que a pessoa montou.
      if (escolhendoHora) { setEscolhendoHora(null); return; }
      if (editandoAgendada) { setEditandoAgendada(null); return; }
      // AS DUAS JANELAS QUE FALTAVAM NA ESCADA (auditoria de 07/10): com elas
      // abertas o Esc descia até o fim e FECHAVA A CONVERSA lá atrás.
      if (jaTratei) { if (!trateiOcupado) { setJaTratei(null); setTrateiErro(""); } return; }
      if (escolhaTelefone) { setEscolhaTelefone(null); return; }
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
      // A JANELA DA TAREFA fica por cima de tudo, inclusive da tela de tarefas.
      else if (janelaTarefa) setJanelaTarefa(null);
      // As três telas que cobrem tudo. Faltavam aqui, e como o Esc é uma
      // escada, faltar não era "o Esc não faz nada": ele descia até o último
      // degrau e FECHAVA A CONVERSA lá atrás, por baixo do que estava aberto.
      // A pessoa fechava as Mídias e a conversa tinha sumido.
      else if (midiasAberta) setMidiasAberta(false);
      else if (telaAdmin) setTelaAdmin(false);
      else if (telaPainel) setTelaPainel(false);
      else if (telaFunil) setTelaFunil(false);
      else if (telaTarefas) setTelaTarefas(false);
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
      else if (menuResponsavel) setMenuResponsavel(false);
      else if (menuEtapa) setMenuEtapa(false);
      else if (menuTarefa) setMenuTarefa(false);
      else if (emojiAberto) setEmojiAberto(false);
      else if (seletorAberto) setSeletorAberto(false);
      else if (historico) setHistorico(null);
      // ESC FECHA O QUE ESTÁ POR CIMA, e no computador a ficha não está: ela é
      // coluna, como a lista. Recolher uma coluna com Esc surpreenderia quem
      // só queria sair de um menu.
      else if (estreito && fichaAberta) setFichaAberta(false);
      else if (buscaAberta) { setBuscaAberta(false); setBuscaConversa(""); }
      else if (respondendo) setRespondendo(null);
      else if (conversaId) setConversaId(null);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [confirmarApagar, notaParaApagar, renomeando, selecao, editando, encaminhar, reagindo, rostoAberto, imagemAberta, anexosPendentes, audioPronto, gravando, configAberta, novaConversaAberta, rapidaForm, tagForm, contatoForm, midiasAberta, telaAdmin, telaPainel, telaFunil, menuEtapa, telaTarefas, menuTarefa, janelaTarefa, menuConversa, menuDaConversa, menuOrdem, menuTopoAberto, menuEtiquetas, menuQuem, quemParticipou, tagMenuAberto, menuResponsavel, emojiAberto, seletorAberto, fichaAberta, historico, buscaAberta, respondendo, conversaId, escolhendoHora, editandoAgendada, jaTratei, trateiOcupado, escolhaTelefone]);

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
      // SEM O REF, A LISTINHA ESTÁ PENDURADA NO ⋮ (o cabeçalho recolhido não
      // monta o botão de origem): aí "fora" é fora do ⋮. Antes a condição
      // exigia o ref e nunca era verdadeira — a listinha ficava flutuando sobre
      // a conversa até alguém apertar Esc (auditoria de 07/10).
      if (quemParticipou && !dentroDoMenu && !(quemParticipouRef.current && quemParticipouRef.current.contains(e.target))) setQuemParticipou(false);
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
      if (tagMenuAberto && !dentroDoMenu && !(tagMenuRef.current && tagMenuRef.current.contains(e.target))) setTagMenuAberto(false);
      // O MENU DO RESPONSÁVEL tem dois endereços (ver `listaDeResponsaveis`),
      // e "dentro" é o do endereço de onde ele foi aberto.
      if (menuResponsavel) {
        const dentro = menuResponsavel === "menu" ? dentroDoMenu
          : !!(responsavelRef.current && responsavelRef.current.contains(e.target));
        if (!dentro) setMenuResponsavel(false);
      }
      if (menuEtapa) {
        const dentro = menuEtapa === "menu" ? dentroDoMenu
          : !!(etapaRef.current && etapaRef.current.contains(e.target));
        if (!dentro) setMenuEtapa(false);
      }
      if (menuTarefa) {
        const dentro = menuTarefa === "menu" ? dentroDoMenu
          : !!(tarefaRef.current && tarefaRef.current.contains(e.target));
        if (!dentro) setMenuTarefa(false);
      }
      if (menuOrdem && ordemMenuRef.current && !ordemMenuRef.current.contains(e.target)) setMenuOrdem(false);
      if (menuTopoAberto && menuTopoRef.current && !menuTopoRef.current.contains(e.target)) setMenuTopoAberto(false);
      if (menuDepartamentos && departamentosRef.current && !departamentosRef.current.contains(e.target)) setMenuDepartamentos(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [reagindo, rostoAberto, emojiAberto, seletorAberto, tagMenuAberto, menuTopoAberto, menuEtiquetas, menuQuem, quemParticipou, menuDaConversa, menuOrdem, menuDepartamentos, menuResponsavel, menuEtapa, menuTarefa]);

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
    // RESPONDER É PARTICIPAR, e a marca vale já. O tempo real traria a mesma
    // informação de volta em segundos (a mensagem gravada chega a todos os
    // painéis), mas nesse intervalo o cliente pode responder — e a conversa que
    // acabei de assumir me devolveria um aviso dizendo que ela é órfã, ou
    // nenhum aviso, conforme a ordem em que as duas chegassem.
    if (payload && payload.conversa_id != null) {
      deQuemEhAConversa.current.set(payload.conversa_id, { minha: true, orfa: false });
    }
    return emFila(async () => {
      const r = await gravarNaFila(payload);
      if (!r.error && payload && payload.conversa_id != null) assumirSeNinguem(payload.conversa_id);
      return r;
    });
  }

  // ============================================================
  //  QUEM RESPONDE PRIMEIRO, ASSUME
  //
  //  A conversa sem dono ganha dono na primeira resposta de alguém da equipe.
  //  É o que evita o recurso nascer vazio: sem isto, as 1.800 conversas do
  //  escritório ficariam "sem responsável" até alguém clicar em cada uma, e
  //  "as minhas" não mostraria nada a ninguém.
  //
  //  `.is("responsavel_id", null)` NA PRÓPRIA GRAVAÇÃO, e não uma conferência
  //  antes: duas pessoas respondendo juntas a um cliente novo fariam as duas
  //  "verem" a conversa sem dono e a segunda gravaria por cima da primeira. Com
  //  a condição no `update`, quem chegou primeiro fica, e a segunda recebe
  //  zero linhas — que aqui é o desfecho LEGÍTIMO, e não recusa do banco. Por
  //  isso esta é uma das gravações que não diz nada na tela: nenhuma das duas
  //  respostas pede ação de quem acabou de mandar uma mensagem.
  //
  //  NÃO TIRA DE NINGUÉM: responder numa conversa que já tem dono não muda o
  //  dono. Passar adiante é gesto de quem decide, pelo menu do responsável.
  // ============================================================
  async function assumirSeNinguem(convId) {
    const eu = meuIdRef.current;
    if (temResponsavelRef.current !== true || !eu) return;
    const c = conversasRef.current.find((x) => String(x.id) === String(convId));
    if (c && c.responsavel_id) return;
    const agora = new Date().toISOString();
    const r = await supabase.from("conversas")
      .update({ responsavel_id: eu, responsavel_em: agora, responsavel_por: eu })
      .eq("id", convId).is("responsavel_id", null).select("id");
    if (r.error) { console.error("[Zorvin] não consegui assumir a conversa ao responder", r.error); return; }
    if (naoGravouNada(r)) return;
    setConversas((prev) => prev.map((x) => (String(x.id) === String(convId)
      ? { ...x, responsavel_id: eu, responsavel_em: agora, responsavel_por: eu } : x)));
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
    if (error) {
      mostrarAviso(comOCodigo("Não consegui encaminhar.", error, "encaminhar mensagem"), 7000);
      return;
    }
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
    const { data, error } = await supabase.from("figurinhas_favoritas")
      .select("midia_url").order("criado_em", { ascending: false }).limit(60);
    // A LEITURA QUE FALHA É DITA, e a lista que estava fica (auditoria de
    // 07/10): calada, a galeria abria vazia e todo menu de figurinha oferecia
    // "Adicionar" — inclusive as que já estavam guardadas.
    if (error) {
      if (!semATabela(error)) anotarFalhaDeLeitura("figurinhas", "as figurinhas guardadas", error);
      return;
    }
    limparFalhaDeLeitura("figurinhas");
    setFigurinhas((data || []).map((r) => r.midia_url).filter(Boolean));
  }, [anotarFalhaDeLeitura, limparFalhaDeLeitura]);

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
      const r = await supabase.from("figurinhas_favoritas")
        .delete().eq("midia_url", url).select("id");
      if (r.error || naoGravouNada(r)) {
        setFigurinhas((prev) => (prev.includes(url) ? prev : [url, ...prev]));
        mostrarAviso("Não consegui remover a figurinha. " + (r.error?.message || "Rode sql/2026-08-figurinhas-favoritas.sql."));
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

    // SÓ SE MARCA COMO APAGADA A BOLHA QUE VAI MESMO SER APAGADA (auditoria de
    // 07/10). Antes todas as escolhidas viravam "Esta mensagem foi apagada" na
    // hora — inclusive a que ainda estava saindo (`temp-…`) ou a que falhou
    // (`fila-…`): elas não têm linha em `mensagens` nem id do WhatsApp, nada
    // as apagava, e a que estava saindo CHEGAVA ao cliente com a tela dizendo
    // o contrário.
    const ehLinhaDoBanco = (m) => !/^(temp|fila)-/.test(String(m.id));
    const vaoSair = paraTodos ? alvos.filter((m) => m.id_uazapi) : alvos.filter(ehLinhaDoBanco);
    const deFora = alvos.length - vaoSair.length;
    if (!vaoSair.length) {
      mostrarAviso("Essas mensagens ainda não foram confirmadas pelo WhatsApp — espere chegar para apagar.");
      return;
    }
    const idsQueSaem = new Set(vaoSair.map((m) => m.id));
    setMensagens((prev) => prev.map((x) => (idsQueSaem.has(x.id)
      ? { ...x, apagada: true, texto: null, midia_url: null } : x)));

    // DESFAZ SÓ AS QUE NÃO FORAM: no meio do laço, as anteriores já estão na
    // fila de exclusão e vão ser apagadas no WhatsApp.
    const voltarAtras = (quais) => setMensagens((prev) => prev.map((x) => {
      const orig = quais.find((a) => a.id === x.id);
      return orig ? orig : x;
    }));

    if (!paraTodos) {
      // SÓ NO ZORVIN: nada vai para a fila — é uma marca no nosso banco, e a
      // Uazapi não entra na história.
      const { data, error } = await supabase.from("mensagens")
        .update({ apagada: true, texto: null, midia_url: null })
        .in("id", vaoSair.map((m) => m.id)).select("id");
      const naoMexeu = naoGravouNada({ data, error });
      if (error || naoMexeu) {
        voltarAtras(vaoSair);
        mostrarAviso(naoMexeu
          ? "Falta rodar o SQL 2026-08-fixar-favoritar-mensagem.sql no Supabase."
          : comOCodigo("Não consegui apagar.", error, "apagar mensagem"), 7000);
        return;
      }
      if (deFora) mostrarAviso(`${deFora} mensagem(ns) ainda saindo ficaram de fora — espere chegar para apagar.`);
      return;
    }

    // `texto: ""` e não ausente: a coluna da fila não aceita nulo, e sem ele o
    // insert falha — era esse o "Não consegui apagar. Tente de novo".
    for (let i = 0; i < vaoSair.length; i++) {
      const m = vaoSair[i];
      const { error } = await inserirNaFila({
        conversa_id: conversaId, tipo: "exclusao", texto: "",
        responder_id_uazapi: m.id_uazapi, status: "pendente", enviado_por: meuNome, enviado_por_id: meuId,
      });
      if (error) {
        voltarAtras(vaoSair.slice(i));
        mostrarAviso(comOCodigo(i ? `Apaguei ${i}, mas não consegui apagar as outras.` : "Não consegui apagar.",
                                error, "apagar mensagem"), 7000);
        return;
      }
    }
    if (deFora) {
      mostrarAviso(`${deFora} mensagem(ns) ainda não confirmada(s) pelo WhatsApp ficaram de fora.`);
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
    const naoMexeu = naoGravouNada({ data, error });
    if (error || naoMexeu) {
      setMensagens((prev) => prev.map((x) => (x.id === m.id ? { ...x, [campo]: m[campo] } : x)));
      mostrarAviso(naoMexeu
        ? "Falta rodar o SQL 2026-08-fixar-favoritar-mensagem.sql no Supabase."
        : comOCodigo("Não consegui salvar a marca.", error, "marcar mensagem"), 7000);
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
      mostrarAviso(comOCodigo("Não consegui editar.", error, "editar mensagem"), 7000);
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
      mostrarAviso(comOCodigo("Não consegui enviar a reação.", error, "reagir à mensagem"), 7000);
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
    setRespondendo({ id_uazapi: m.id_uazapi, previa: previaDe(m), autor: m.origem,
                     // QUEM ESCREVEU, para a faixa dizer o nome do colega em vez
                     // de "você mesmo" (auditoria de 07/10).
                     porId: m.enviado_por_id || null, por: m.enviado_por || null });
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

  // ============================================================
  //  AS QUATRO MARCAS DA CONVERSA, NUM CAMINHO SÓ
  //
  //  Não lida, favorita, fixada e arquivada são o mesmo gesto com quatro
  //  nomes: acerta a tela na hora, grava, e desfaz se o banco não gravar.
  //  Estava escrito quatro vezes, e as quatro cópias tinham o MESMO furo —
  //  conferiam só o `error`. Um `update` barrado pela regra de acesso não
  //  devolve erro: ele atualiza zero linhas e responde "pronto" (ver
  //  `naoGravouNada`, em `gravar.js`). A marca sumia na abertura seguinte.
  //
  //  O ACERTO VISUAL CONTINUA VINDO NA FRENTE — é o que faz o clique parecer
  //  instantâneo. O QUE PASSOU A ESPERAR É A FRASE. Ela saía antes da
  //  resposta: a tela dizia "Conversa fixada" e o banco podia ter recusado
  //  calado. A frase é a tela afirmando um fato do banco, e afirmar antes de
  //  saber é exatamente o defeito de 24/09.
  //
  //  E A RELEITURA DESFAZ: `carregarConversas` traz o que o banco tem de
  //  verdade, para a lista não ficar com a marca que só existe nesta tela.
  // ============================================================
  // O NOME DE UMA PESSOA DA EQUIPE PELO ID — o de hoje, da vista `equipe`,
  // pela mesma régua das bolhas: quem trocou de nome aparece com o novo.
  // Sem a vista (ou antes de ela chegar), eu me reconheço pela sessão, e o
  // resto vira "alguém da equipe" — nunca um id cru na tela.
  const nomeDaPessoa = (id) => {
    if (!id) return "";
    const p = equipe.porId[String(id)];
    if (p && p.nome) return p.nome;
    if (String(id) === String(meuId)) return meuNome || "você";
    return "alguém da equipe";
  };

  // TROCAR O DONO: assumir, passar para alguém, ou tirar.
  //
  // Pelo mesmo caminho das outras marcas da conversa (`gravarMarcaDaConversa`):
  // o acerto na tela vem na frente, e a FRASE espera o banco. Dizer "agora é
  // da Jenifer" antes de o banco aceitar seria a tela afirmando um fato que
  // talvez não exista — a forma que esta casa persegue desde 24/09.
  function mudarResponsavel(conv, novoId) {
    setMenuResponsavel(false);
    if (!conv || String(conv.responsavel_id || "") === String(novoId || "")) return;
    const agora = new Date().toISOString();
    const nome = novoId ? primeiroNome(nomeDaPessoa(novoId)) : "";
    const souEu = novoId && String(novoId) === String(meuId);
    return gravarMarcaDaConversa(conv,
      { responsavel_id: novoId || null, responsavel_em: novoId ? agora : null,
        responsavel_por: novoId ? meuId : null },
      {
        certo: !novoId ? "A conversa ficou sem responsável."
             : souEu ? "Esta conversa agora é sua."
             : `Esta conversa agora é de ${nome}.`,
        recusado: "O banco não deixou trocar o responsável. Nada mudou.",
        erro: "Não consegui trocar o responsável.",
      });
  }

  async function gravarMarcaDaConversa(conv, patch, frases) {
    setConversas((prev) => prev.map((x) => (x.id === conv.id ? { ...x, ...patch } : x)));
    const r = await supabase.from("conversas").update(patch).eq("id", conv.id).select("id");
    if (r.error || naoGravouNada(r)) {
      mostrarAviso(naoGravouNada(r) ? frases.recusado
                                    : comOCodigo(frases.erro, r.error, "marca da conversa"), 7000);
      carregarConversas(advogadoId);
      return false;
    }
    mostrarAviso(frases.certo);
    return true;
  }

  // ============================================================
  //  "JÁ TRATEI" — tirar da fila sem mandar mensagem
  //
  //  A ORDEM DAS DUAS GRAVAÇÕES É A DECISÃO, e ela não é arbitrária.
  //
  //  Primeiro o REGISTRO, depois a saída da fila. Ao contrário:
  //
  //    - registro falha depois de a conversa já ter saído → ela sumiu da fila
  //      e NINGUÉM sabe por quê. É o pior desfecho: some em silêncio;
  //    - saída falha depois do registro → há um registro e a conversa segue na
  //      fila. Chato, visível, e a frase diz exatamente isso.
  //
  //  Entre um erro que se vê e um que não, escolhe-se o que se vê.
  //
  //  E NÃO HÁ TRANSAÇÃO aqui: o PostgREST não oferece uma, e inventar meia
  //  transação com desfazer-na-mão daria um terceiro caminho de falha para
  //  cuidar. A ordem acima é o que torna a falha parcial suportável.
  // ============================================================
  async function confirmarJaTratei(ids, descricao) {
    const conv = jaTratei;
    if (!conv || !ids.length) return;
    setTrateiOcupado(true); setTrateiErro("");

    // O TEXTO VAI SÓ NA LINHA DO ASSUNTO QUE O PEDE (o OUTROS, script 009).
    // Repeti-lo em ACORDOS e VENDA LN faria o relatório dizer três vezes a
    // mesma coisa sobre três assuntos diferentes. E a chave só entra quando há
    // texto: num banco sem a coluna, mandá-la derrubaria o registro inteiro.
    const pedeTexto = new Set(assuntos.filter((a) => a.pede_descricao).map((a) => a.id));
    const texto = (descricao || "").trim();
    const linhas = ids.map((assunto_id) => ({
      conversa_id: conv.id,
      assunto_id,
      quem: meuId,
      // A DATA, e não o número de dias: o número é derivado dela e
      // envelheceria escrito, dizendo outra coisa a cada relatório.
      esperava_desde: conv.esperando_desde || null,
      ...(texto && pedeTexto.has(assunto_id) ? { observacao: texto } : {}),
    }));
    const reg = await supabase.from("zorvin_tratamentos").insert(linhas).select("id");
    if (reg.error || naoGravouNada(reg)) {
      setTrateiOcupado(false);
      setTrateiErro(naoGravouNada(reg)
        ? "O banco não deixou registrar. Nada foi tirado da fila."
        : comOCodigo("Não consegui registrar o que foi tratado. Nada foi tirado da fila.",
                     reg.error, "registrar tratamento"));
      return;
    }

    // A CONVERSA QUE NÃO ESPERA SÓ GANHA O REGISTRO. Não há fila de onde
    // tirá-la, e marcar `tratada_em` faria o botão virar "Voltar para a fila"
    // numa conversa que nunca esteve nela.
    if (!conv.esperando_desde) {
      setTrateiOcupado(false);
      setJaTratei(null);
      releTratadosDoHistorico(conv.id);
      mostrarAviso("Registrei o que foi tratado.");
      return;
    }

    const quando = new Date().toISOString();
    const r = await supabase.from("conversas")
      .update({ tratada_em: quando, esperando_desde: null })
      .eq("id", conv.id).select("id");
    setTrateiOcupado(false);
    if (r.error || naoGravouNada(r)) {
      setTrateiErro(naoGravouNada(r)
        ? "Registrei o que foi tratado, mas o banco não deixou tirar da fila. A conversa continua esperando."
        : comOCodigo("Registrei o que foi tratado, mas não consegui tirar da fila.",
                     r.error, "tirar da fila"));
      return;
    }

    setConversas((prev) => prev.map((x) => (x.id === conv.id
      ? { ...x, tratada_em: quando, esperando_desde: null } : x)));
    setJaTratei(null);
    releTratadosDoHistorico(conv.id);
    mostrarAviso("Tirada da fila de espera.");
  }

  //  DESFAZER — e ele não é luxo.
  //
  //  Marcar por engano faz um cliente sumir da fila em silêncio. Aqui a ordem
  //  se inverte, pela mesma régua: primeiro devolve à fila (o que se vê),
  //  depois carimba o registro. Se o carimbo falhar, o pior é um registro
  //  dizendo "tratada" para uma conversa que voltou — visível na tela.
  //
  //  E QUEM DEVOLVE A ESPERA É O BANCO, por `zorvin_recontar_espera`: só ele
  //  sabe a data ORIGINAL (a primeira mensagem do cliente depois da nossa
  //  última resposta). Escrever `esperando_desde = agora` aqui devolveria a
  //  conversa à fila com zero dia de espera — apagando os 66 dias que são o
  //  motivo de ela precisar voltar.
  async function desfazerJaTratei(conv) {
    setMenuDaConversa(false);
    const r = await supabase.from("conversas")
      .update({ tratada_em: null }).eq("id", conv.id).select("id");
    if (r.error || naoGravouNada(r)) {
      mostrarAviso(naoGravouNada(r)
        ? "O banco não deixou desfazer. A conversa continua fora da fila."
        : comOCodigo("Não consegui desfazer.", r.error, "desfazer tratamento"), 7000);
      return;
    }
    const { error: erroConta } = await supabase.rpc("zorvin_recontar_espera", { p_conversa: conv.id });
    if (erroConta) console.error("Zorvin — recontar espera:", erroConta);

    // SÓ O ÚLTIMO CLIQUE É DESFEITO, e a gravação é CONFERIDA (auditoria de
    // 07/10). Antes o `update` marcava como desfeitos TODOS os registros da
    // conversa ainda não desfeitos — inclusive "Já tratei" legítimos de outras
    // rodadas, que sumiam do relatório e do histórico do cliente —, e não
    // olhava a resposta: com a gravação recusada, a tela dizia "Voltou para a
    // fila" e o relatório continuava contando o clique como tratado.
    //
    // Um clique são as linhas de um mesmo `insert`, com o mesmo `quando` (é por
    // ele que o relatório os junta — script 010).
    let marcaDoDesfeito = null;
    const ult = await supabase.from("zorvin_tratamentos").select("quando")
      .eq("conversa_id", conv.id).is("desfeito_em", null)
      .order("quando", { ascending: false }).limit(1);
    if (ult.error) marcaDoDesfeito = comOCodigo("o registro do “Já tratei” não foi marcado como desfeito.", ult.error, "desfazer tratamento");
    else if (ult.data && ult.data.length) {
      const d = await supabase.from("zorvin_tratamentos")
        .update({ desfeito_em: new Date().toISOString(), desfeito_por: meuId })
        .eq("conversa_id", conv.id).eq("quando", ult.data[0].quando).is("desfeito_em", null)
        .select("id");
      if (d.error) marcaDoDesfeito = comOCodigo("o registro do “Já tratei” não foi marcado como desfeito.", d.error, "desfazer tratamento");
      else if (naoGravouNada(d)) marcaDoDesfeito = "o banco não deixou marcar o registro do “Já tratei” como desfeito.";
    }

    // RELÊ A LISTA em vez de adivinhar a data: a espera que volta é calculada
    // pelo banco, e escrevê-la aqui de cabeça seria uma segunda conta para
    // divergir da primeira.
    carregarConversas(advogadoId);
    releTratadosDoHistorico(conv.id);
    mostrarAviso(marcaDoDesfeito
      ? `Voltou para a fila, mas ${marcaDoDesfeito} O relatório ainda o conta.`
      : erroConta
      ? "Voltou para a fila, mas não consegui recalcular a espera. Atualize a página."
      : "Voltou para a fila de espera.", marcaDoDesfeito ? 8000 : undefined);
  }

  // Marca a conversa como não lida (mostra o selo verde) ou como lida.
  async function marcarNaoLida(conv, naoLida) {
    setMenuConversa(null);
    const novo = naoLida ? (conv.nao_lidas > 0 ? conv.nao_lidas : 1) : 0;
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
    // Sem conferir, a tela dizia "Marcada como lida" e o banco continuava com o
    // contador antigo — na próxima recarga o selo voltava, e a pessoa jurava
    // ter marcado.
    await gravarMarcaDaConversa(conv, { nao_lidas: novo }, {
      certo: naoLida ? "Marcada como não lida" : "Marcada como lida",
      erro: "Não consegui marcar. Tente de novo.",
      recusado: "O banco não deixou marcar. O selo continua como estava.",
    });
  }

  // Favoritar / desfavoritar uma conversa (aba "Favoritas").
  async function alternarFavorita(conv) {
    setMenuConversa(null);
    const novo = !conv.favorita;
    await gravarMarcaDaConversa(conv, { favorita: novo }, {
      certo: novo ? "Adicionada aos favoritos" : "Removida dos favoritos",
      erro: "Não consegui favoritar. Rode o SQL da coluna 'favorita'.",
      recusado: "O banco não deixou favoritar. A marca não ficou.",
    });
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
    await gravarMarcaDaConversa(conv, { fixada: novo }, {
      certo: novo ? "Conversa fixada no topo" : "Conversa desafixada",
      erro: "Não consegui fixar. Rode o 2026-07-colunas-que-faltavam.sql no Supabase.",
      recusado: "O banco não deixou fixar. A conversa volta ao lugar na próxima abertura.",
    });
  }

  // Arquivar / desarquivar uma conversa (some da lista, vai para "Arquivadas").
  async function alternarArquivada(conv, arquivar) {
    setMenuConversa(null);
    if (arquivar && conv.id === conversaId) setConversaId(null);
    await gravarMarcaDaConversa(conv, { arquivada: arquivar }, {
      certo: arquivar ? "Conversa arquivada" : "Conversa desarquivada",
      erro: "Não consegui arquivar. Rode o SQL da coluna 'arquivada'.",
      recusado: "O banco não deixou arquivar. A conversa continua na lista.",
    });
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
    // AQUI "ZERO LINHAS" TEM DUAS CAUSAS, e é a única desta rodada em que tem.
    //
    // Em todas as outras marcas o alvo é UMA linha que a tela acabou de ler:
    // zero linhas só pode ser a regra de acesso. Nesta o recorte vai ao banco
    // (`advogado_id` + `nao_lidas > 0`), e entre a conferência do selo logo
    // acima e esta gravação um colega pode ter marcado as mesmas conversas —
    // aí zero linhas quer dizer "já estavam lidas", e o serviço está feito.
    //
    // Não dá para separar os dois daqui sem uma segunda ida ao banco, e a
    // frase não pode escolher um deles no chute: acusar o banco quando foi um
    // colega faz alguém abrir chamado por nada, e dizer "todas marcadas" numa
    // recusa é a mentira que esta rodada existe para tirar. Então ela diz os
    // dois e aponta onde está a resposta — o selo, que a releitura logo acima
    // acabou de buscar.
    const r = await supabase.from("conversas")
      .update({ nao_lidas: 0 }).eq("advogado_id", advId).gt("nao_lidas", 0).select("id");
    carregarNaoLidasPorAdv();
    if (r.error) {
      mostrarAviso(comOCodigo("Não consegui marcar todas.", r.error, "marcar todas como lidas"), 7000);
      carregarConversas(advId); return;
    }
    if (naoGravouNada(r)) {
      mostrarAviso("Nenhuma conversa mudou: ou um colega marcou antes de você, ou o banco "
                 + "não deixou. O selo da barra diz qual dos dois.", 7000);
      carregarConversas(advId);
      return;
    }
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
    const r = await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId).select("id");
    // Não deu para gravar: devolve o que o banco tem, senão a tela diz "lida"
    // e o resto da equipe continua vendo o selo.
    //
    // ZERO LINHAS É O MESMO DESFECHO, e era o que passava batido: esta é a
    // marca que some para a EQUIPE INTEIRA. Quem respondeu vê o selo cair no
    // seu painel e vai embora; nos outros ele continua aceso, e o cliente é
    // cobrado duas vezes pela mesma resposta.
    if (r.error || naoGravouNada(r)) {
      mostrarAviso(naoGravouNada(r)
        ? "O banco não deixou marcar como lida — o selo continua para a equipe."
        : comOCodigo("Não consegui marcar como lida.", r.error, "marcar como lida"), 7000);
      carregarConversas(advogadoIdRef.current);
    }
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
      mostrarAviso(comOCodigo("Não consegui enviar a mensagem. Toque em 'reenviar'.",
                              error, "enfileirar mensagem"), 7000);
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
    const convDoNome = conversaId;
    const antes = ct.nome_zorvin || "";
    if (novo === antes) { setRenomeando(null); return; }
    setRenomeando(null);
    // Some da tela na hora; volta se o banco recusar.
    setConversas((prev) => prev.map((c) => (
      c.contato && c.contato.numero === ct.numero
        ? { ...c, contato: { ...c.contato, nome_zorvin: novo || null } } : c)));
    // `.select("id")` NÃO é enfeite: sem ele, um `update` barrado pela regra de
    // acesso volta sem erro e sem ter mexido em nada — e o nome que a linha de
    // cima já pôs na tela ficaria lá até o próximo F5, quando sumiria sozinho.
    // Ver `naoGravouNada`, em `gravar.js`.
    const r = await supabase.from("contatos")
      .update({ nome_zorvin: novo || null }).eq("id", ct.id).select("id");
    const recusou = naoGravouNada(r);
    if (r.error || recusou) {
      setConversas((prev) => prev.map((c) => (
        c.contato && c.contato.numero === ct.numero
          ? { ...c, contato: { ...c.contato, nome_zorvin: ct.nome_zorvin } } : c)));
      // O CÓDIGO VAI JUNTO. Era aqui que a frase morria em "Tente de novo." —
      // e foi essa frase que custou uma rodada inteira de scripts no Supabase
      // em 24/09 para descobrir o que o navegador sabia no primeiro segundo.
      mostrarAviso(
        recusou ? "O banco não deixou salvar o nome deste contato."
        : /nome_zorvin/i.test(r.error.message || "")
          ? "Falta rodar o SQL do nome do contato."
          : comOCodigo("Não consegui salvar o nome.", r.error, "renomear o contato"),
        7000);
      return;
    }
    registrarAlteracao({ tipo: "contato_renomeado", alvo: ct.numero, contato_id: ct.id || null,
                         antes: antes || (ct.nome || ""), depois: novo }, convDoNome);
  }

  /** Guarda uma linha no histórico de alterações. Nunca derruba a ação que a
      gerou: histórico perdido é ruim, atendente travado é pior. */
  // A CONVERSA DO REGISTRO VEM DE QUEM CHAMA (auditoria de 07/10). Ela é
  // chamada depois de um `await`, e ler a conversa aberta ali gravava
  // "contato_renomeado" ou "nota_editada" no cliente para onde a pessoa tinha
  // acabado de ir — o histórico de alterações de um cliente com a ação feita
  // em outro.
  async function registrarAlteracao(linha, convId) {
    const c = conversasRef.current.find((x) => String(x.id) === String(convId));
    try {
      const { error } = await supabase.from("alteracoes").insert({
        contato_id: (c && (c.contato_id || c.contato?.id)) || null,
        conversa_id: convId || null,
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
    const convDaNota = conversaId;
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
    // `.select("id")` NA GRAVAÇÃO, e não só o `error`: um `update` barrado pela
    // regra de acesso volta sem erro e com zero linhas (ver `naoGravouNada`, em
    // `gravar.js`). A tela mostrava a nota já corrigida, e a correção sumia no
    // F5. Nota é TEXTO QUE ALGUÉM ESCREVEU — é o que mais dói perder calado
    // desta lista toda.
    const rNota = await gravarSemAsQueFaltam(
      (linha) => supabase.from("notas").update(linha).eq("id", idReal).select("id"),
      { texto: novoTexto, editada_em: new Date().toISOString(), editada_por: meuNome,
        ...doProcesso },
      ["processo_id", "processo_numero", "processo_reu", "editada_em", "editada_por"],
      COLUNAS_QUE_FALTAM_EM_NOTAS);
    const { error, perdidas } = rNota;
    if (error || naoGravouNada(rNota)) {
      setMensagens((prev) => prev.map((x) => (
        x.id === m.id ? { ...x, ...comoEra, texto: antes } : x)));
      mostrarAviso(naoGravouNada(rNota)
        ? "O banco não deixou editar esta nota. O texto voltou ao que era."
        : comOCodigo("Não consegui editar a nota.", error, "editar nota"), 7000);
      return;
    }
    // O AVISO SÓ APARECE QUANDO A PESSOA PERDEU O QUE ESCOLHEU. Perder o
    // `editada_em` numa base velha não muda nada do que ela quis dizer; perder
    // o processo, sim — e calar sobre isso é o defeito que já custou 289 notas.
    if (mudouProcesso && (perdidas || []).some((c) => c.startsWith("processo"))) {
      mostrarAviso("Salvei o texto, mas este banco ainda não guarda o processo da nota.");
    }
    registrarAlteracao({ tipo: "nota_editada", alvo: idReal, antes, depois: novoTexto }, m.conversa_id || convDaNota);
  }

  async function apagarNota(m) {
    const convDaNota = conversaId;
    const idReal = String(m.id).replace(/^nota-/, "");
    const agora = new Date().toISOString();
    setMensagens((prev) => prev.map((x) => (
      x.id === m.id ? { ...x, apagada_em: agora, apagada_por: meuNome } : x)));
    // O TEXTO NÃO É LIMPO no banco. Some da tela; continua guardado. Quem
    // apaga não decide sozinho que o escritório perde o que estava escrito.
    const r = await supabase.from("notas")
      .update({ apagada_em: agora, apagada_por: meuNome, apagada_por_id: meuId })
      .eq("id", idReal).select("id");
    // ZERO LINHAS É PIOR AQUI DO QUE UM ERRO. A nota some da tela de quem
    // apagou e continua na de todo mundo — e apagar uma nota é, quase sempre,
    // tirar da vista alguma coisa que não devia ter sido escrita ali.
    if (r.error || naoGravouNada(r)) {
      setMensagens((prev) => prev.map((x) => (
        x.id === m.id ? { ...x, apagada_em: null, apagada_por: null } : x)));
      mostrarAviso(naoGravouNada(r)
        ? "O banco não deixou apagar esta nota. Ela continua na conversa."
        : comOCodigo("Não consegui apagar a nota.", r.error, "apagar nota"), 7000);
      return;
    }
    registrarAlteracao({ tipo: "nota_apagada", alvo: idReal, antes: m.texto || "", depois: null }, m.conversa_id || convDaNota);
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
      mostrarAviso(comOCodigo("Não consegui salvar a nota. O texto voltou para a caixa.",
                              error, "escrever nota"), 7000);
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
    if (naoGravouNada({ data, error })) {
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
      // E ESTA É A ÚNICA DA VARREDURA DE 24/09 QUE FICA SEM PERGUNTAR, de
      // propósito. O `guardarDispensado` acima já resolve o caso desta pessoa
      // neste aparelho, que é o defeito que a linha conserta; e o momento é o
      // do reenvio, onde uma faixa dizendo "o banco não deixou aposentar a
      // tentativa velha" confundiria com a mensagem NOVA ter falhado — que é o
      // que quem clicou está olhando. Quem quiser a recusa com todas as letras
      // tem o botão "Dispensar este aviso", que a diz inteira.
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
    setEscolhendoHora(null);
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

  /** Os anexos da prévia, AGENDADOS. Um atrás do outro, e não juntos: a ordem
   *  da prévia é a ordem em que o cliente vai receber, e a fila sai por
   *  `criado_em`. A hora é conferida ANTES de subir arquivo nenhum — subir dez
   *  documentos para descobrir no fim que a hora já tinha passado seria
   *  trabalho jogado fora. */
  async function agendarAnexos(quando) {
    setEscolhendoHora(null);
    if (!anexosPendentes.length) return;
    const motivo = porQueNaoServe(quando);
    if (motivo) { mostrarAviso(motivo, 6000); return; }
    const lote = anexosPendentes.map((a) => ({ file: a.file, legenda: (a.legenda || "").trim() }));
    const convId = conversaId;
    for (const a of anexosPendentes) { try { URL.revokeObjectURL(a.url); } catch (_) {} }
    setAnexosPendentes([]);
    setAnexoAtivo(0);
    let foram = 0;
    for (const { file, legenda } of lote) {
      if (await enviarArquivo(file, legenda, convId, null, quando)) foram++;
    }
    if (foram) {
      mostrarAviso(foram === 1 ? `Anexo agendado para ${rotuloDaHora(quando)}.`
        : `${foram} anexos agendados para ${rotuloDaHora(quando)}.`);
    }
    carregarAgendadas(convId);
  }

  async function enviarArquivo(file, legenda = "", convId = conversaId, tipoForcado = null, quando = null) {
    if (!convId || !file) return false;
    if (quando) return agendarArquivo(file, legenda, convId, quando);
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

  /** O ANEXO AGENDADO sobe agora e espera na fila. Subir na hora marcada
   *  exigiria o navegador aberto naquela hora — e a mensagem agendada existe
   *  justamente para sair com ninguém olhando. Sem bolha provisória: nada foi
   *  para o cliente, e uma bolha com relóginho na conversa diria o contrário. */
  async function agendarArquivo(file, legenda, convId, quando) {
    const ehImagem = file.type.startsWith("image/");
    const ehVideo = file.type.startsWith("video/");
    const ehAudio = file.type.startsWith("audio/");
    const tipo = ehImagem ? "imagem" : ehVideo ? "video" : ehAudio ? "audio" : "documento";
    try {
      const nome = (file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
      const caminho = `${convId}/${Date.now()}-${nome}`;
      const { error: upErr } = await supabase.storage.from("anexos").upload(caminho, file, { contentType: file.type });
      if (upErr) throw new Error("Falha ao subir o arquivo (Storage): " + (upErr.message || upErr));
      const { data: pub } = supabase.storage.from("anexos").getPublicUrl(caminho);
      const url = pub?.publicUrl;
      if (!url) throw new Error("sem URL pública do arquivo");
      const r = await gravarAgendada({ conversa_id: convId, texto: legenda || "", tipo,
        midia_url: url, midia_mime: file.type, midia_nome: nome }, quando);
      if (r.error) throw new Error(r.motivo || comOCodigo("Falha ao agendar (banco).", r.error, "agendar anexo"));
      return true;
    } catch (err) {
      mostrarAviso(`Não consegui agendar ${file.name || "o anexo"}. ` + (err?.message || err), 8000);
      return false;
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
  // OS FILTROS DA GAVETA QUE PINTAM A PÍLULA DE VERDE — grupos e as minhas.
  // Um nome só para a pergunta "a gaveta tem um filtro ligado que não é
  // etiqueta?", escrita cinco vezes no controle.
  const filtroVerde = filtro === "grupos" || filtro === "minhas" || filtro === "tarefas";

  // ------------------------------------------------------------
  //  O QUE É UM GRUPO — a pergunta, escrita uma vez só
  //
  //  O WhatsApp entrega grupo com um identificador no lugar do telefone, e a
  //  ponte grava isso em `contatos.numero` com o prefixo `grupo:`. Não há
  //  coluna dizendo "isto é um grupo": o prefixo É a marca, e o painel já se
  //  servia dela em dois lugares (o nome "+70929710" que virava "Grupo", e o
  //  autor que só aparece dentro de grupo).
  //
  //  Aqui ela vira função porque agora são TRÊS lugares, e a terceira cópia é
  //  onde uma regra escrita à mão começa a divergir das outras.
  const ehGrupo = (c) => String(c?.contato?.numero || "").startsWith("grupo:");

  // A RÁPIDA COMO ELA VAI SAIR NESTA CONVERSA — as regras estão em
  // `variaveis.js`. O cliente é o nome do alto da conversa. GRUPO NÃO TEM "O
  // CLIENTE": o nome dele num "Olá, {nome}!" daria "Olá, Mutirão!", então ali
  // a variável fica vazia e sai sem deixar rastro ("Olá!").
  const rapidaPreenchida = (texto) => preencherVariaveis(texto, {
    cliente: conversa && !ehGrupo(conversa) ? nomeDoContato(conversa.contato) : "",
    atendente: meuNome,
    agora: new Date(),
  });

  // QUANTAS NÃO LIDAS ESTÃO EM GRUPO — o número do menu.
  //
  // Sai da lista que já está na tela, e não de uma ida a mais ao banco: é um
  // número que enfeita o menu antes do clique, e uma consulta por abertura de
  // menu é peso para pouca coisa. Ele pode ficar curto num telefone com muitas
  // páginas — e curto para menos é o erro barato aqui: quem clica vê a lista
  // inteira, que é a resposta de verdade.
  const naoLidasDosGrupos = conversas.reduce(
    (soma, c) => soma + (ehGrupo(c) && (c.nao_lidas || 0) > 0 ? 1 : 0), 0);

  // Aplica a aba/filtro selecionado a uma conversa.
  function passaNoFiltro(c) {
    // O filtro de atendentes é INDEPENDENTE dos outros: dá para pedir "as não
    // lidas em que eu participei". São perguntas diferentes, e obrigar a
    // escolher uma delas seria estreitar a tela sem motivo.
    if (idsQuem && !idsQuem.has(String(c.id))) return false;
    if (filtro === "naolidas") return (c.nao_lidas || 0) > 0;
    if (filtro === "favoritas") return !!c.favorita;
    // OS GRUPOS SE RECONHECEM NA PRÓPRIA LINHA — não é preciso perguntar ao
    // banco para saber se uma conversa JÁ CARREGADA é de grupo. O banco entra
    // noutro lugar (`extrasGrupo`), e só para trazer os que não couberam nas
    // páginas já lidas: sem ele, a lista mostraria "os grupos entre as 200
    // conversas mais recentes" com cara de "os grupos".
    if (filtro === "grupos") return ehGrupo(c);
    // AS MINHAS: as que têm a MIM como responsável. Não "as em que falei" —
    // isso é o filtro de atendentes, lá no alto, e responde outra pergunta.
    if (filtro === "minhas") return !!meuId && String(c.responsavel_id || "") === String(meuId);
    // COM TAREFA PARA HOJE: a resposta é do banco (`idsTarefaHoje`), porque a
    // tarefa não mora na linha da conversa. Antes de ela chegar, nada passa —
    // é breve, e "todas" no lugar de "ainda não sei" seria o filtro mentindo.
    if (filtro === "tarefas") return idsTarefaHoje ? idsTarefaHoje.has(String(c.id)) : false;
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
    // E O AVISO DE QUE AINDA SE PROCURA NO CADASTRO SAI JUNTO. Ele é sobre a
    // pergunta anterior; deixá-lo de pé enquanto a nova nem saiu faria a tela
    // dizer que consulta algo por uma busca que já mudou.
    setVendoNoCadastro(false);
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
      //  A IDA AO CADASTRO, ESCRITA UMA VEZ SÓ
      //
      //  Os dois caminhos — o da função do banco e o de reserva — terminam
      //  igual: perguntam ao Vantoro e SOMAM o que ele trouxer. Eram duas
      //  cópias das mesmas cinco linhas, e a primeira diferença entre elas
      //  seria um defeito que só aparece em metade dos bancos.
      //
      //  O `setVendoNoCadastro` é o que impede a tela de responder antes de
      //  saber. Entre `setBuscando(false)` e a volta desta chamada pode haver
      //  meio minuto — a ponte e o Vantoro hibernam no plano gratuito da
      //  Render —, e nesse meio a lista vazia escrevia "Nada encontrado".
      const somarOCadastro = async (base) => {
        // SEM VANTORO NÃO HÁ CADASTRO A SOMAR — e a saída é AQUI, antes do
        // `setVendoNoCadastro(true)`, e não lá dentro. Levantando o aviso para
        // baixá-lo em seguida, a busca escreveria "Vendo no cadastro do
        // Vantoro…" num painel que não tem Vantoro nenhum: um passo a mais que
        // nunca existiu, anunciado a quem está esperando o resultado.
        if (temVantoro !== true) return;
        setVendoNoCadastro(true);
        let doCadastro;
        try {
          doCadastro = await procurarNoVantoro(termo, base, advId, sinal);
        } finally {
          // SÓ QUEM AINDA É A BUSCA DA VEZ MEXE NA TELA. Se a pessoa já
          // digitou outra letra, quem manda no aviso é a busca nova: ela já o
          // zerou e vai levantá-lo no tempo dela. Baixá-lo aqui apagaria o
          // aviso dela com a volta atrasada desta.
          if (meu()) setVendoNoCadastro(false);
        }
        if (!meu()) return;
        setAchadosCad(doCadastro.porCad);
        setSemConversa(doCadastro.semConversa || []);
        // As que só o cadastro achou entram na MESMA peneira das outras.
        setExtras(peneirar([...base, ...doCadastro.novas]));
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
          // AS CONVERSAS ACHADAS QUE NÃO VIERAM SÃO DITAS (auditoria de 07/10):
          // o erro desta leitura era jogado fora, e a tela podia dizer "Nada
          // encontrado" sobre o que o banco tinha acabado de achar.
          let faltouTrazer = false;
          for (let i = 0; i < ids.length; i += 150) {
            const { data, error: erroLote } = await supabase.from("conversas")
              .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
              .eq("advogado_id", advId)
              .abortSignal(sinal)
              .in("id", ids.slice(i, i + 150));
            if (erroLote && !sinal.aborted) { faltouTrazer = true; console.error("[zorvin] busca: conversas achadas", erroLote); }
            encontradas.push(...(data || []));
          }
          if (!meu()) return;
          if (faltouTrazer) setErroBusca((antes) => antes || recadoDaBusca({ falhouMensagem: true }));
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

          await somarOCadastro(tudo);
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
        const { data, error: erroLote } = await supabase.from("conversas")
          .select(`*, contato:contato_id (${colunasDoContato("nome, numero, foto_url")})`)
          .eq("advogado_id", advId)
          .abortSignal(sinal)
          .in("id", faltando.slice(i, i + 150));
        if (erroLote && !sinal.aborted) { falhouMensagem = true; contarFalha("conversas achadas no texto", erroLote); }
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
      await somarOCadastro(encontradas);
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
          // E O AVISO DO CADASTRO SAI JUNTO, pelo mesmo motivo: ele é o único
          // que sobra depois de `buscando`, e um aviso de "ainda procurando"
          // que não sai é o "Procurando…" eterno com outro nome.
          setVendoNoCadastro(false);
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
      : [...antes, c].sort(compararConversas(ordem, ordenarPelaEspera))));

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
    if (!busca.trim() && !filtro.startsWith("tag:") && filtro !== "grupos"
        && filtro !== "minhas" && filtro !== "tarefas" && !quemFiltra.length) return daLista;
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
      : [...extrasEtiqueta, ...extrasQuem, ...extrasGrupo, ...extrasMinhas, ...extrasTarefas].filter((c) => !jaTem.has(String(c.id))
          && naPasta(c) && passaNoFiltro(c));
    if (!doBanco.length) return daLista;
    return [...daLista, ...doBanco].sort(compararConversas(ordem, ordenarPelaEspera));
  })();

  // ============================================================
  //  DUAS LINHAS COM O MESMO NOME — qual delas é qual?
  //
  //  RELATO DE 25/09, com foto: duas conversas idênticas na lista, mesmo nome
  //  e mesma foto, e o pedido de "juntar, porque é a mesma conversa".
  //
  //  MEDIDO NO BANCO, e não eram duplicadas: eram DOIS TELEFONES da mesma
  //  pessoa — (19) 98209-4819 e (71) 8425-3304, contas diferentes do WhatsApp
  //  (`@lid` diferente), as duas ativas no mesmo dia. No WhatsApp Web do
  //  escritório elas também são duas conversas. O Zorvin não duplicou nada; o
  //  que ele fazia de errado era ESCONDER que são dois números.
  //
  //  POR QUE FICARAM IGUAIS NA TELA: `nomeDoContato` mostra o nome da FICHA
  //  quando ela existe, e os dois contatos apontam para o mesmo cliente do
  //  Vantoro (o 1233). Os nomes do WhatsApp eram diferentes — "Cristiano" e
  //  "CristanoCristiano Ribeiro" —, e a ficha cobriu os dois.
  //
  //  ------------------------------------------------------------
  //  A RÉGUA É O QUE SE VÊ
  //
  //  Não é "o mesmo cadastro", nem "o mesmo nome no banco": é o TEXTO QUE ESTÁ
  //  NA LINHA, porque é dele que vem a confusão. Duas linhas que escrevem a
  //  mesma coisa têm de escrever mais.
  //
  //  E a comparação ignora caixa e espaço de sobra: "Maria Silva" e "MARIA
  //  SILVA" o olho separa, quem lê correndo não. Mostrar o número a mais custa
  //  onze caracteres numa linha; escondê-lo quando fazia falta é responder
  //  pelo número errado, que não tem desfazer.
  //
  //  ------------------------------------------------------------
  //  NÃO SE CONFERE SE OS NÚMEROS SÃO DIFERENTES, e isso é decisão
  //
  //  Seria a pergunta mais exata — "mesmo nome E números diferentes" —, e é
  //  código morto: `contatos.numero` é único no banco e a lista é de UM
  //  telefone do escritório de cada vez, então duas linhas são dois contatos,
  //  e dois contatos são dois números. Escrever a conferência daria uma
  //  ramificação que nenhuma prova consegue exercitar.
  //
  //  GRUPO FICA DE FORA: o "número" dele é `grupo:<identificador>`, que não é
  //  telefone de ninguém — escrevê-lo na linha seria trocar um nome repetido
  //  por um código que não quer dizer nada.
  // ============================================================
  const nomesRepetidosNaLista = (() => {
    const quantos = new Map();
    for (const c of conversasFiltradas) {
      if (ehGrupo(c)) continue;
      const chave = nomeDoContato(c.contato).trim().toLocaleLowerCase("pt-BR");
      if (!chave) continue;
      quantos.set(chave, (quantos.get(chave) || 0) + 1);
    }
    const repetidos = new Set();
    for (const [chave, n] of quantos) if (n > 1) repetidos.add(chave);
    return repetidos;
  })();

  /** Esta linha precisa dizer por qual telefone ela fala? */
  const precisaMostrarONumero = (c) => !ehGrupo(c)
    && nomesRepetidosNaLista.has(nomeDoContato(c.contato).trim().toLocaleLowerCase("pt-BR"));

  // ------------------------------------------------------------------
  //  O QUE A LISTA VAZIA DIZ — a marca e a frase, de uma escolha só
  //
  //  A marca é para as provas não terem de caçar a palavra no texto da página
  //  inteira: um aviso que por acaso contivesse "Procurando" — e um já conteve
  //  — faria a tela parecer estar procurando depois de ter desistido, e a
  //  prova aprovaria o defeito que ela caça.
  //
  //  AS DUAS SAEM DAQUI JUNTAS de propósito. Escritas em duas escadas iguais,
  //  elas divergem na primeira mudança: a prova continua verde lendo a marca
  //  enquanto a tela passou a dizer outra coisa a quem lê.
  //
  //  "NADA ENCONTRADO" SÓ DEPOIS DE PERGUNTAR EM TODO LUGAR.
  //
  //  Relato de 14/09, com duas fotos da MESMA busca: primeiro "Nada encontrado
  //  para essa busca", e segundos depois a ELIANA ALVES DA SILVA aparecendo,
  //  com telefone e "Começar conversa".
  //
  //  A busca pergunta em dois lugares e em dois tempos: o banco responde em
  //  milissegundos, o cadastro do Vantoro leva dezenas de segundos quando ele
  //  e a ponte estão acordando na Render. O "Procurando…" sai quando o BANCO
  //  responde — de propósito, para a lista não ficar refém do cadastro. Só
  //  que, com o banco não achando nada, o que aparecia no lugar dele era esta
  //  frase.
  //
  //  E ela é uma RESPOSTA. Quem lê "nada encontrado" conclui que o cliente não
  //  está no sistema e para de procurar — a segundos de ele aparecer. É a
  //  terceira vez que esta tela afirma uma ausência que ainda não apurou, e
  //  agora ela espera.
  //
  //  CALAR NÃO SERVE: uma lista vazia sem uma palavra é a mesma dúvida sem a
  //  frase. A tela diz o que já sabe — nas conversas não há — e o que falta.
  // ------------------------------------------------------------------
  const recadoDaListaVazia =
    // A LEITURA QUE FALHOU NÃO É "NENHUMA CONVERSA AINDA" (armadilha nº 2).
    quemFiltra.length && estadoQuem === "carregando" ? ["procurando-quem", "Procurando as conversas de quem você marcou…"]
    : quemFiltra.length && estadoQuem === "falhou"
      ? ["falhou-quem", `Não consegui filtrar pelas pessoas marcadas${falhasDeLeitura["filtro-quem"]?.codigo
          ? ` (código ${falhasDeLeitura["filtro-quem"].codigo})` : ""}. Use "Tentar de novo", no alto.`]
    : falhasDeLeitura.conversas && !conversas.length
      ? ["falhou", `Não consegui carregar as conversas deste telefone${falhasDeLeitura.conversas.codigo
          ? ` (código ${falhasDeLeitura.conversas.codigo})` : ""}. Use "Tentar de novo", no alto.`]
    : trocandoDeTelefone ? ["trocando", "Carregando as conversas…"]
    : buscando ? ["procurando", "Procurando…"]
    : vendoNoCadastro && busca.trim()
      ? ["cadastro", "Nas conversas, nada. Vendo no cadastro do Vantoro…"]
    : busca.trim() ? ["nada", "Nada encontrado para essa busca."]
    : verArquivadas ? ["arquivadas", "Nenhuma conversa arquivada."]
    // "NENHUMA CONVERSA AINDA" COM O FILTRO DE GRUPOS LIGADO seria sobre o
    // telefone, e a pessoa acabou de ver a lista cheia dois cliques atrás. A
    // frase tem de falar do que ela pediu.
    : filtro === "grupos" ? ["sem-grupo", "Nenhum grupo neste telefone."]
    // E A DAS MINHAS DIZ COMO UMA CONVERSA VIRA MINHA — sem isso, "nenhuma"
    // no primeiro dia pareceria defeito, e não o começo.
    : filtro === "tarefas" ? ["sem-tarefas-hoje", idsTarefaHoje
        ? "Nenhuma conversa deste telefone com tarefa para hoje ou atrasada."
        : "Procurando as conversas com tarefa para hoje…"]
    : filtro === "minhas" ? ["sem-minhas", "Nenhuma conversa sua neste telefone. Uma conversa vira sua quando você responde primeiro, ou pelo responsável no alto dela."]
    : ["sem-conversa", "Nenhuma conversa ainda."];

  // O "+" no rodapé quer dizer "o banco tem mais do que isto". Com uma busca
  // ou uma etiqueta escolhida, ele NÃO tem: as duas já perguntaram ao banco e
  // trouxeram tudo o que casa. Deixar o "+" ali diria que ainda falta alguma
  // coisa — e quem estivesse conferindo uma etiqueta não saberia se o número
  // na tela é o número de verdade.
  const listaPodeCrescer = !busca.trim() && !filtro.startsWith("tag:")
    && filtro !== "grupos" && filtro !== "minhas" && filtro !== "tarefas" && !quemFiltra.length;

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

  // O CONTROLE DA ORDEM DA LISTA — UM SÓ, e mora em lugares diferentes
  // conforme o layout, porque os dois layouts têm folga em lugares diferentes.
  //
  // NO COMPUTADOR ele fica na linha da marca. A fita de filtros ali tem 357px
  // e comporta QUATRO pílulas; com esta ela virava cinco e quebrava em duas
  // linhas — 38px roubados da lista, medidos. O comentário do filtro de
  // atendentes já dizia, quando ELE subiu, que "era a quinta pílula de uma
  // linha que já quebrava em duas", e a linha continuou quebrando porque esta
  // tomou o lugar vago. Subir a ordem é terminar aquele serviço.
  //
  // NO CELULAR ele fica na fita, que é de onde ele veio. Lá em cima não cabe:
  // abaixo de 768px uma regra desta tela força todo botão a 40px de alvo de
  // dedo (e faz bem — toque errado no telefone abre a coisa errada), e com
  // QUATRO botões de 40 a marca ficava com 100px para um nome que pede 134.
  // Media 390px e passava; num Android de 360 a tela dizia "Ropelimi Zo".
  // Na fita do celular ele não custa nada: ela já usa duas linhas, e a segunda
  // tem 307px de vão com só as etiquetas dentro.
  //
  // UMA DEFINIÇÃO SÓ, e não uma cópia em cada lugar: duas cópias divergem no
  // primeiro conserto, e aqui divergir é a lista virar do avesso num layout e
  // não no outro, com a tela dizendo a mesma coisa nos dois.
  //
  // ELE SEMPRE ESCREVE A ORDEM, nos dois lugares. Um botão que só troca e não
  // conta em que estado está transforma "achei estranho" em "está quebrado".
  const controleDaOrdem = !advogadoId ? null : (
    <span ref={ordemMenuRef} style={{ position: "relative", display: "flex", flexShrink: 0 }}>
      <button data-ordem onClick={() => setMenuOrdem((v) => !v)}
              aria-expanded={menuOrdem} aria-haspopup="listbox"
              title="Em que ordem a lista aparece"
              /* A PÍLULA ESTÁ SEMPRE CHEIA, e isso é conserto de 29/09.
                 Relato do Rodrigo, com três fotos: *"'Recentes' e 'Esperando'
                 quando estão selecionados, não parece que estão selecionados,
                 pois não possuem cor de fundo"*.

                 Ela pintava de verde só o `antigas` — sobra de quando havia
                 DUAS ordens e o verde queria dizer "não é a de sempre". Com
                 três, a conta não fecha: `esperando` é a que mais vira a lista
                 do avesso e era a que menos aparecia.

                 A régua da casa já estava escrita ao lado, na fita de filtros:
                 a pílula escolhida é verde cheia, INCLUSIVE a padrão ("Tudo").
                 Este controle sempre tem um valor escolhido, então está sempre
                 cheio.

                 E não se perde sinal nenhum: quem diz que a lista está fora da
                 ordem de sempre é a PALAVRA, que a pílula sempre escreve — é o
                 contrato antigo, com prova própria. Cor some de quem é
                 daltônico; palavra, não. */
              style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 30, flexShrink: 0,
                       border: `1px solid ${C.greenDark}`,
                       background: C.greenDark,
                       color: "#fff",
                       borderRadius: 20, padding: "4px 9px", fontSize: 12, fontWeight: 600,
                       cursor: "pointer", whiteSpace: "nowrap" }}>
        {/* O ÍCONE SAIU, e por medição: ele custava 17px (13 do desenho, 4 do
            vão) numa linha que estourava em 38. A PALAVRA é que é o contrato
            — o controle sempre ESCREVE a ordem, e um botão que só troca sem
            dizer em que estado está transforma "achei estranho" em "está
            quebrado". O desenho era o enfeite; foi ele que saiu. */}
        {/* A PALAVRA CURTA, e nos dois lugares. Na linha da marca,
            "Mais recentes" custa 143px e sobram 130 para um nome que
            pede 134 — medido, e a marca saía cortada. "Recentes" custa
            90 e devolve a folga. O menu logo abaixo continua dizendo
            "Mais recentes primeiro", com a frase que explica o que isso
            significa; quem precisa da forma longa está lá dentro.
            Curta nos DOIS layouts de propósito: duas palavras para o
            mesmo estado é a tela ensinando dois nomes para uma coisa. */}
        {ordem === "esperando" ? "Esperando" : ordem === "antigas" ? "Antigas" : "Recentes"}
      </button>
      {menuOrdem && (
        <div data-menu-ordem
             style={{ position: "absolute", top: 36, ...(estreito ? { left: 0 } : { right: 0 }), zIndex: 46, width: 244,
                      background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                      boxShadow: "0 6px 20px rgba(0,0,0,.25)", overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.divider}`,
                        fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>
            ORDEM DA LISTA
          </div>
          {[["recentes", "Mais recentes primeiro", "Quem falou por último aparece no alto. É a ordem de sempre."],
            // A FRASE DESTA MUDOU, e a antiga estava ERRADA.
            //
            // Ela dizia "quem está esperando há mais tempo aparece no alto", e
            // havia um comentário aqui afirmando que as duas coisas eram a
            // mesma. Não são — foi o que o Rodrigo relatou em 25/09. O cliente
            // que escreveu em 21/09 e DE NOVO em 24/09 sobe para o 24/09 nesta
            // ordem, e fica parecendo tão novo quanto quem acabou de chegar.
            // Esta ordem fala da última mensagem; a de baixo, da espera.
            ["antigas", "Mais antigas primeiro", "Quem mandou a última mensagem há mais tempo aparece no alto."],
            // SÓ APARECE COM A COLUNA NO BANCO. Oferecer sem ela seria oferecer
            // uma ordem que faz a lista de conversas sumir.
            ...(temEspera === true
              ? [["esperando", "Esperando há mais tempo",
                  // A FRASE DIZ AS DUAS METADES DA REGRA, e a segunda é nova:
                  // sem ela, a pessoa que visse "esperando há 0 dias" numa
                  // conversa de semana passada acharia que a conta quebrou.
                  "Conta desde a primeira mensagem sem resposta — o \"obrigada\" logo depois da nossa não conta. Quem escreveu de novo não volta para o fim da fila."]]
              : [])]
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
                    faz tempo, ou a que ninguém responde faz tempo?
                    NÃO SÃO A MESMA COISA — este comentário dizia que eram, e
                    era justamente aí que a lista enganava a equipe. Agora são
                    duas ordens diferentes, e cada frase diz qual é qual. */}
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
  );

  // ------------------------------------------------------------------
  //  QUEM É O RESPONSÁVEL — o menu, uma definição com dois endereços
  //
  //  No computador ele pende do nome do responsável, na linha do número do
  //  cliente ("linha"). No celular, e no computador com a fila recolhida,
  //  pende do ⋮ ("menu"). É a mesma lista nos dois: duas escritas divergiriam
  //  no primeiro conserto, e divergir aqui é poder passar a conversa num
  //  tamanho de tela e não no outro.
  //
  //  "ASSUMIR" VEM PRIMEIRO, e separado: é o gesto de todo dia. Passar para
  //  outra pessoa é o de exceção, e fica embaixo, com o rosto de cada um.
  //
  //  E O MENU DIZ QUEM PASSOU. "Quem me deu isto?" é a primeira pergunta de
  //  quem recebe um cliente no meio do caminho.
  // ------------------------------------------------------------------
  const pessoasParaPassar = Object.values(equipe.porId)
    .filter((p) => p.nome && String(p.id) !== String(meuId))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  // ---- A ETAPA DO FUNIL, a partir da conversa ----
  //
  // ESCOLHER UMA ETAPA põe o cliente no funil se ele ainda não estiver, e o
  // move se estiver. A frase espera o banco (a régua de `gravarMarcaDaConversa`):
  // "Etapa: X" é a tela afirmando um fato do banco.
  const etapaAtualDaConversa = funilDaConversa && funilDaConversa.cartao
    ? (funilDaConversa.etapas || []).find((e) => String(e.id) === String(funilDaConversa.cartao.etapa_id)) || null
    : null;
  async function escolherEtapa(etapa) {
    const f = funilDaConversa;
    setMenuEtapa(false);
    if (!f || !conversa || f.cartao === undefined) return;
    if (f.cartao && String(f.cartao.etapa_id) === String(etapa.id)) return;
    const [contatoId, depId] = f.chave.split("|");
    const r = f.cartao
      ? await supabase.from("zorvin_cartoes").update({ etapa_id: etapa.id }).eq("id", f.cartao.id).select("*")
      : await supabase.from("zorvin_cartoes")
          .insert({ contato_id: contatoId, departamento_id: depDoFunil ?? depId, etapa_id: etapa.id }).select("*");
    if (r.error) {
      // 23505 = OUTRA PESSOA PÔS ESTE CLIENTE NO FUNIL AGORA (o cartão é único
      // por cliente e departamento). Não é falha: é a tela atrasada.
      if (r.error.code === "23505") {
        await lerFunilDaConversa(contatoId, depDoFunil);
        mostrarAviso("Outra pessoa acabou de pôr este cliente no funil — confira a etapa e escolha de novo.", 6000);
        return;
      }
      mostrarAviso(comOCodigo(f.cartao ? "Não consegui mudar a etapa." : "Não consegui pôr este cliente no funil.",
                              r.error, "etapa da conversa"), 6000);
      return;
    }
    if (naoGravouNada(r)) {
      mostrarAviso("Não consegui mudar a etapa: o banco não deixou.", 6000);
      return;
    }
    const novo = (r.data || [])[0] || { ...(f.cartao || {}), etapa_id: etapa.id };
    setFunilDaConversa((x) => (x && x.chave === f.chave ? { ...x, cartao: novo } : x));
    mostrarAviso(f.cartao ? `Etapa: ${etapa.nome}.` : `Entrou no funil, em “${etapa.nome}”.`);
    releCaminhoDoHistorico(contatoId);
  }
  async function tirarDoFunilDaConversa() {
    const f = funilDaConversa;
    setMenuEtapa(false);
    if (!f || !f.cartao) return;
    if (!window.confirm("Tirar este cliente do funil? A conversa continua; só o cartão sai.")) return;
    const r = await supabase.from("zorvin_cartoes").delete().eq("id", f.cartao.id).select("id");
    if (r.error) { mostrarAviso(comOCodigo("Não consegui tirar do funil.", r.error, "tirar do funil"), 6000); return; }
    if (naoGravouNada(r)) { mostrarAviso("Não consegui tirar do funil: o banco não deixou.", 6000); return; }
    setFunilDaConversa((x) => (x && x.chave === f.chave ? { ...x, cartao: null } : x));
    mostrarAviso("Saiu do funil.");
    releCaminhoDoHistorico(f.chave.split("|")[0]);
  }
  const listaDeEtapas = !conversa || !funilDaConversa ? null : (() => {
    const f = funilDaConversa;
    const ativas = (f.etapas || []).filter((e) => e.ativo !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const ITEM = { width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
                   border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary,
                   textAlign: "left", fontSize: 13.5, minHeight: estreito ? 44 : 36 };
    const atual = f.cartao ? String(f.cartao.etapa_id) : "";
    return (
      <div data-menu-etapa role="listbox"
           style={{ position: "absolute", zIndex: 61, width: 250, maxHeight: 360, overflowY: "auto",
                    whiteSpace: "normal", fontWeight: 400,
                    ...(menuEtapa === "menu" ? { top: 44, right: 0 } : { top: "100%", left: 0, marginTop: 4 }),
                    background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                    boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>ETAPA NO FUNIL</div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
            {f.cartao ? "Escolha para onde este cliente vai." : f.cartao === null
              ? "Este cliente ainda não está no funil. Escolha a etapa para pôr." : ""}
          </div>
        </div>
        {f.erro && (
          <div data-erro-da-etapa style={{ padding: "8px 12px", fontSize: 12.5, color: "#c0392b" }}>{f.erro}</div>
        )}
        {f.cartao !== undefined && ativas.map((e) => (
          <button key={e.id} data-escolher-etapa={e.nome} role="option" aria-selected={atual === String(e.id)}
                  onClick={() => escolherEtapa(e)} style={ITEM}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: e.cor || C.green, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{e.nome}</span>
            {atual === String(e.id) && <Check size={15} color={C.green} />}
          </button>
        ))}
        {f.cartao !== undefined && !ativas.length && !f.erro && (
          <div style={{ padding: "10px 12px", fontSize: 12.5, color: C.textSecondary }}>
            Este departamento ainda não tem etapas no funil.
          </div>
        )}
        {f.cartao && (
          <>
            <div style={{ height: 1, background: C.divider, margin: "4px 0" }} />
            <button data-tirar-do-funil onClick={tirarDoFunilDaConversa} style={{ ...ITEM, color: "#c0392b" }}>
              <X size={15} /> Tirar do funil
            </button>
          </>
        )}
      </div>
    );
  })();

  // ---- AS TAREFAS DA CONVERSA: criar, editar, concluir, apagar ----
  //
  // A FRASE ESPERA O BANCO (a régua de `gravarMarcaDaConversa`): "Lembrete
  // marcado" é a tela afirmando um fato do banco.
  async function salvarTarefa({ texto, vence_em, para_quem }) {
    const j = janelaTarefa;
    if (!j) return;
    const editando = j.tarefa;
    const r = editando
      ? await supabase.from("zorvin_tarefas").update({ texto, vence_em, para_quem })
          .eq("id", editando.id).select("id")
      // `criada_por` vai junto para a bancada; no banco quem escreve é o
      // gatilho do 018, com quem entrou — a tela não tem como dizer outra pessoa.
      : await supabase.from("zorvin_tarefas")
          .insert({ conversa_id: j.conversaId, texto, vence_em, para_quem, criada_por: meuId || null }).select("id");
    // A FALHA VOLTA PARA A JANELA, e não para a faixa de aviso: a janela fica
    // aberta (o que foi escrito não se perde) e cobre a faixa — dita lá, a
    // frase ficaria por baixo do fundo escuro, e o clique pareceria mudo.
    if (r.error || naoGravouNada(r)) {
      return r.error
        ? comOCodigo(editando ? "Não consegui salvar a tarefa." : "Não consegui criar a tarefa.", r.error,
                     editando ? "editar tarefa" : "criar tarefa")
        : "Não consegui salvar a tarefa: o banco não deixou.";
    }
    setJanelaTarefa(null);
    const quem = String(para_quem) === String(meuId) ? "você" : primeiroNome(nomeDaPessoa(para_quem));
    mostrarAviso(editando ? `Tarefa atualizada — ${quem}, ${rotuloDaHora(vence_em)}.`
                          : `Lembrete marcado para ${quem}, ${rotuloDaHora(vence_em)}.`);
    tarefasMudaram();
    return null;
  }
  async function concluirTarefaDaConversa(t, feita) {
    const r = await supabase.from("zorvin_tarefas")
      .update(feita ? { feita_em: new Date().toISOString(), feita_por: meuId || null }
                    : { feita_em: null, feita_por: null })
      .eq("id", t.id).select("id");
    if (r.error || naoGravouNada(r)) {
      mostrarAviso(r.error
        ? comOCodigo(feita ? "Não consegui concluir a tarefa." : "Não consegui reabrir a tarefa.", r.error,
                     feita ? "concluir tarefa" : "reabrir tarefa")
        : `Não consegui ${feita ? "concluir" : "reabrir"} a tarefa: o banco não deixou.`, 7000);
      return;
    }
    mostrarAviso(feita ? "Tarefa concluída." : "Tarefa reaberta.");
    tarefasMudaram();
  }
  async function apagarTarefa(t) {
    // APAGAR PERGUNTA ANTES: não há desfazer, e "concluída" é o gesto de quem
    // fez. Apagar é para a tarefa criada por engano.
    if (!window.confirm(`Apagar a tarefa "${t.texto}"? Para dizer que foi feita, use Concluir.`)) return;
    const r = await supabase.from("zorvin_tarefas").delete().eq("id", t.id).select("id");
    if (r.error || naoGravouNada(r)) {
      mostrarAviso(r.error ? comOCodigo("Não consegui apagar a tarefa.", r.error, "apagar tarefa")
                           : "Não consegui apagar a tarefa: o banco não deixou.", 7000);
      return;
    }
    mostrarAviso("Tarefa apagada.");
    tarefasMudaram();
  }
  const abrirNovaTarefa = (tarefa = null) => {
    if (!conversa) return;
    setMenuTarefa(false);
    setJanelaTarefa({ tarefa, conversaId: conversa.id,
                      cliente: nomeDoContato(conversa.contato) || numeroBonito(conversa.contato?.numero) || "" });
  };
  const tarefasAbertasDaConversa = tarefasDaConversa ? ordenarAbertas(tarefasDaConversa.lista) : [];
  const tarefasFeitasDaConversa = tarefasDaConversa
    ? tarefasDaConversa.lista.filter((t) => t.feita_em)
        .sort((a, b) => String(b.feita_em).localeCompare(String(a.feita_em)))
    : [];
  const proximaTarefa = tarefasAbertasDaConversa[0] || null;
  const corDaSituacao = (s) => (s === "atrasada" ? "#e53935" : s === "hoje" ? "#d99a1e" : C.textSecondary);

  const listaDeTarefas = !conversa || !tarefasDaConversa ? null : (() => {
    const f = tarefasDaConversa;
    const ITEM = { width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
                   border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary,
                   textAlign: "left", fontSize: 13.5, minHeight: estreito ? 44 : 36 };
    const ICONE = { border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 4,
                    borderRadius: 6, flexShrink: 0, minWidth: estreito ? 36 : 26, minHeight: estreito ? 36 : 26,
                    alignItems: "center", justifyContent: "center" };
    const linhaDaTarefa = (t, feita) => {
      const s = situacao(t);
      return (
        <div key={t.id} data-tarefa-da-conversa-item={t.id} data-situacao={feita ? "feita" : s}
             style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 8px 8px 10px",
                      borderTop: `1px solid ${C.divider}` }}>
          <button data-concluir-tarefa={feita ? undefined : t.id} data-reabrir-tarefa={feita ? t.id : undefined}
                  onClick={() => concluirTarefaDaConversa(t, !feita)}
                  title={feita ? "Reabrir" : "Marcar como feita"} aria-label={feita ? "Reabrir" : "Marcar como feita"}
                  style={ICONE}>
            {feita ? <RotateCcw size={16} color={C.textSecondary} /> : <CircleCheck size={19} color={C.green} />}
          </button>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
            <div data-texto-da-tarefa style={{ fontSize: 13.5, lineHeight: 1.35, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          textDecoration: feita ? "line-through" : "none", color: feita ? C.textSecondary : C.textPrimary }}>
              {t.texto}
            </div>
            <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>
              {String(t.para_quem || "") === String(meuId) ? "Você" : primeiroNome(nomeDaPessoa(t.para_quem)) || "Sem pessoa"}
              {" · "}
              <span data-quando-da-tarefa style={{ color: feita ? C.textSecondary : corDaSituacao(s), fontWeight: s === "atrasada" && !feita ? 600 : 400 }}>
                {feita ? `feita ${rotuloDaHora(t.feita_em)}` : rotuloDaTarefa(t)}
              </span>
            </div>
          </div>
          {!feita && (
            <button data-editar-tarefa={t.id} onClick={() => abrirNovaTarefa(t)} title="Editar" aria-label="Editar tarefa" style={ICONE}>
              <Pencil size={14} color={C.textSecondary} />
            </button>
          )}
          <button data-apagar-tarefa={t.id} onClick={() => apagarTarefa(t)} title="Apagar" aria-label="Apagar tarefa" style={ICONE}>
            <Trash2 size={14} color={C.textSecondary} />
          </button>
        </div>
      );
    };
    return (
      <div data-menu-tarefas role="dialog"
           style={{ position: "absolute", zIndex: 61, width: 300, maxHeight: 420, overflowY: "auto",
                    whiteSpace: "normal", fontWeight: 400,
                    ...(menuTarefa === "menu" ? { top: 44, right: 0 } : { top: "100%", left: 0, marginTop: 4 }),
                    background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                    boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>TAREFAS DESTA CONVERSA</div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
            Quem recebe a tarefa é avisado na hora. Quem vê esta conversa vê as tarefas dela.
          </div>
        </div>
        {f.erro && (
          <div data-erro-das-tarefas style={{ padding: "8px 12px", fontSize: 12.5, color: "#c0392b", borderTop: `1px solid ${C.divider}` }}>{f.erro}</div>
        )}
        {!f.erro && tarefasAbertasDaConversa.map((t) => linhaDaTarefa(t, false))}
        {!f.erro && !tarefasAbertasDaConversa.length && (
          <div data-sem-tarefas-na-conversa style={{ padding: "8px 12px", fontSize: 12.5, color: C.textSecondary, borderTop: `1px solid ${C.divider}` }}>
            Nenhuma tarefa aberta com este cliente.
          </div>
        )}
        <button data-nova-tarefa onClick={() => abrirNovaTarefa(null)}
                style={{ ...ITEM, color: C.verdeTexto, fontWeight: 600, borderTop: `1px solid ${C.divider}` }}>
          <BellPlus size={16} color={C.green} /> Nova tarefa
        </button>
        {!f.erro && tarefasFeitasDaConversa.length > 0 && (
          <>
            <div style={{ padding: "8px 12px 2px", fontSize: 11.5, fontWeight: 600, color: C.textSecondary, borderTop: `1px solid ${C.divider}` }}>
              Concluídas ({tarefasFeitasDaConversa.length})
            </div>
            {tarefasFeitasDaConversa.slice(0, 5).map((t) => linhaDaTarefa(t, true))}
          </>
        )}
      </div>
    );
  })();

  const listaDeResponsaveis = !conversa ? null : (() => {
    const dono = conversa.responsavel_id ? String(conversa.responsavel_id) : "";
    const souDono = !!dono && dono === String(meuId);
    const porOutro = dono && conversa.responsavel_por
      && String(conversa.responsavel_por) !== dono ? nomeDaPessoa(conversa.responsavel_por) : "";
    const quando = conversa.responsavel_em
      ? new Date(conversa.responsavel_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "";
    const ITEM = { width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
                   border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary,
                   textAlign: "left", fontSize: 13.5, minHeight: estreito ? 44 : 36 };
    return (
      <div data-menu-responsavel role="listbox"
           style={{ position: "absolute", zIndex: 61, width: 262, maxHeight: 360, overflowY: "auto",
                    // A LINHA DE ONDE ELE PENDE é `nowrap` (é a do número do
                    // cliente), e a frase de quem passou a conversa herdaria
                    // isso — saía cortada em "Quem responder primeiro assu".
                    whiteSpace: "normal", fontWeight: 400,
                    ...(menuResponsavel === "menu" ? { top: 44, right: 0 } : { top: "100%", left: 0, marginTop: 4 }),
                    background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                    boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.divider}`, position: "sticky", top: 0, background: C.panel }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>RESPONSÁVEL PELA CONVERSA</div>
          <div data-responsavel-origem style={{ fontSize: 12, color: C.textSecondary, marginTop: 3, lineHeight: 1.4 }}>
            {!dono ? "Ninguém ainda. Quem responder primeiro assume."
              : `${souDono ? "Você" : nomeDaPessoa(dono)}${quando ? ` desde ${quando}` : ""}${porOutro ? ` — passada por ${nomeDaPessoa(conversa.responsavel_por)}` : ""}.`}
          </div>
        </div>
        {!souDono && (
          <button data-assumir-conversa role="option" onClick={() => mudarResponsavel(conversa, meuId)}
                  style={{ ...ITEM, color: C.verdeTexto, fontWeight: 600, borderBottom: `1px solid ${C.divider}` }}>
            <UserCheck size={17} color={C.green} /> Assumir esta conversa
          </button>
        )}
        {pessoasParaPassar.length > 0 && (
          <div style={{ padding: "8px 12px 2px", fontSize: 11.5, fontWeight: 600, color: C.textSecondary }}>Passar para</div>
        )}
        {pessoasParaPassar.map((p) => (
          <button key={p.id} data-passar-para={p.id} role="option" aria-selected={dono === String(p.id)}
                  onClick={() => mudarResponsavel(conversa, p.id)} style={ITEM}>
            <Avatar nome={p.nome} foto={p.foto} size={24} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
            {dono === String(p.id) && <Check size={16} color={C.green} />}
          </button>
        ))}
        {dono && (
          <button data-tirar-responsavel onClick={() => mudarResponsavel(conversa, null)}
                  style={{ ...ITEM, color: C.textSecondary, borderTop: `1px solid ${C.divider}` }}>
            <X size={16} /> Deixar sem responsável
          </button>
        )}
      </div>
    );
  })();

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
  //  O CONTROLE DO "JÁ TRATEI" — UMA DEFINIÇÃO, DOIS ENDEREÇOS
  //
  //  No computador ele é um botão escrito no cabeçalho da conversa; no celular
  //  é um item do menu ⋮, porque abaixo de 768px o cabeçalho já estava com o
  //  nome do contato espremido — a regra dos 40px de alvo de dedo não deixa
  //  encolher botão, e mais um deles comeria o nome.
  //
  //  DUAS CÓPIAS DIVERGIRIAM NO PRIMEIRO CONSERTO, e divergir aqui é o botão
  //  tirar da fila num aparelho e não no outro. É a mesma decisão do controle
  //  da ordem, descrita no CLAUDE.md.
  //
  //  ELE APARECE EM TODA CONVERSA, e isto mudou em 02/10. Antes ele só
  //  aparecia na que estava esperando (ou na já tratada, para desfazer), e
  //  sumia justamente na conversa em que a equipe RESPONDEU por último — o
  //  relato do Rodrigo, com a conversa da Beatriz aberta e o botão ausente.
  //  O "Já tratei" é também o registro do que foi feito (é dele que sai o
  //  relatório), e o que se fez numa conversa respondida conta igual.
  //
  //  Na conversa que NÃO espera, ele só registra: não há fila de onde tirar,
  //  e a janela diz isso em vez de prometer "tirar da fila". A conta de
  //  largura do cabeçalho soma a parcela dele (`JA_TRATEI_ESCRITO`).
  // ------------------------------------------------------------------
  const esperaDaAberta = conversa ? diasEsperando(conversa) : 0;
  const trateiDisponivel = temTratada === true && temAssuntos === true && Boolean(conversa);
  const estaEsperando = trateiDisponivel && Boolean(conversa.esperando_desde);
  const estaTratada = trateiDisponivel && !conversa.esperando_desde && Boolean(conversa.tratada_em);
  const podeTratar = trateiDisponivel && !estaTratada;

  const acaoJaTratei = !podeTratar && !estaTratada ? null : (escrito) => {
    const rotulo = podeTratar ? "Já tratei" : "Voltar para a fila";
    const Icone = podeTratar ? ListChecks : Undo2;
    const cor = podeTratar ? C.textSecondary : C.green;
    const clique = () => {
      if (podeTratar) {
        setTrateiErro(""); setJaTratei(conversa); setMenuDaConversa(false);
        // A LISTA QUE NÃO VEIO É PEDIDA DE NOVO AO ABRIR A JANELA.
        if (erroAssuntos) carregarAssuntos();
      }
      else desfazerJaTratei(conversa);
    };
    if (escrito) {
      return (
        <button onClick={clique} data-ja-tratei={podeTratar ? "tratar" : "desfazer"}
                style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
          <Icone size={17} color={cor} /> {rotulo}
          {estaEsperando && esperaDaAberta >= 1 && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: esperaDaAberta >= 3 ? "#e5573f" : C.textSecondary }}>
              {esperaDaAberta}d
            </span>
          )}
        </button>
      );
    }
    return (
      <button onClick={clique} aria-label={rotulo} title={estaEsperando
                ? "Tirar da fila de espera sem mandar mensagem"
                : podeTratar ? "Registrar o que foi tratado nesta conversa"
                : "Devolver esta conversa à fila de espera"}
              data-ja-tratei={podeTratar ? "tratar" : "desfazer"}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${C.divider}`,
                       background: "transparent", color: C.textSecondary, borderRadius: 8,
                       padding: cabecalhoApertado ? "7px 9px" : "6px 10px",
                       fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                       whiteSpace: "nowrap" }}>
        {/* APERTADO, SÓ O ÍCONE — ver `cabecalhoApertado`. O `aria-label` e o
            `title` acima continuam dizendo o que ele faz, e no celular ele
            continua escrito dentro do menu ⋮. */}
        <Icone size={15} color={cor} /> {cabecalhoApertado ? "" : rotulo}
      </button>
    );
  };

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
  // NUMA LINHA DESATIVADA NÃO HÁ O QUE ESCREVER.
  //
  // A ponte recusa enviar por ela, então a caixa continuar ali seria um convite
  // a escrever uma resposta inteira para virar bolha vermelha depois — o gesto
  // oferecido e negado no fim, que é a pior ordem possível.
  //
  // E a frase diz o que FAZER: responder por outro telefone, ou reativar.
  const caixaDeEscrever = linhaDesativada ? (
    <div data-linha-desativada
         style={{ padding: "12px 16px", background: C.headerBar, borderTop: `1px solid ${C.divider}`,
                  color: C.textSecondary, fontSize: 13.5, display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, textAlign: "center" }}>
      <Archive size={16} color={C.textSecondary} />
      <span>
        Esta linha está desativada — nada sai por ela. A conversa fica aqui para
        leitura. Para responder, use outro telefone do escritório, ou peça para
        reativar esta linha.
      </span>
    </div>
  ) : (
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
        {/* A segunda linha já mostra o texto PREENCHIDO: é ali que se vê, antes
            de escolher, o nome que vai entrar. */}
        {slashLista.map((r, idx) => (
          <button key={r.id} data-rapida-no-menu={r.titulo} onMouseEnter={() => setSlashIdx(idx)} onClick={() => escolherSlash(r)} style={{ width: "100%", textAlign: "left", display: "block", border: "none", background: idx === Math.min(slashIdx, slashLista.length - 1) ? C.listActive : "transparent", cursor: "pointer", color: C.textPrimary, padding: "8px 12px", borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.titulo}</div>
            <div data-texto-da-rapida style={{ fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rapidaPreenchida(r.texto)}</div>
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
    {/* O RELÓGIO SÓ APARECE COM TEXTO NA CAIXA: agendar é agendar ESTE texto,
        e com a caixa vazia a janela abriria para nada. Some na nota interna
        (nota não vai ao cliente, não há o que agendar) e na edição (editar
        corrige o que já saiu). */}
    {temAgenda === true && rascunho.trim() && !modoNota && !editando && (
      <button data-agendar onClick={() => setEscolhendoHora((v) => (v === "texto" ? null : "texto"))}
              title="Agendar esta mensagem" aria-label="Agendar esta mensagem"
              aria-expanded={escolhendoHora === "texto"}
              style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", flexShrink: 0, padding: 0, alignSelf: "flex-end" }}>
        <Clock size={22} color={escolhendoHora === "texto" ? C.green : C.textSecondary} />
      </button>
    )}
    {escolhendoHora === "texto" && rascunho.trim() && (
      <div style={{ position: "absolute", bottom: 60, right: 12, zIndex: 40 }}>
        <EscolherHora C={C} escuro={modo === "escuro"} titulo="Agendar esta mensagem"
                      previa={`“${rascunho.trim().replace(/\s+/g, " ")}”`}
                      aoEscolher={agendarTexto} aoFechar={() => setEscolhendoHora(null)} />
      </div>
    )}
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", background: C.headerBar, color: C.textPrimary }}>
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
          Uma coluna só, e elas se empilham.

          E ELA DEIXOU DE SER `fixed` EM 29/09, por um relato do escritório:
          "não dá para ver o nome dos contatos e outras funções". Flutuando,
          a faixa ficava POR CIMA do topo do painel — comia a marca, a linha
          do departamento e o alto da barra lateral. Um aviso que esconde a
          tela sobre a qual avisa é pior do que aviso nenhum: ele não some
          quando a pessoa precisa trabalhar, e não há gesto que o tire.

          Hoje a tela inteira é uma COLUNA: as faixas em cima, e o painel
          ocupando o que sobra (`flex: 1`). Ele encolhe, em vez de ser
          coberto — e o quanto ele encolhe é a altura real das faixas, sem
          ninguém precisar medir nada nem adivinhar um recuo. */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column" }}>
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
                    // A LISTA DE CONVERSAS E AS AGENDADAS TAMBÉM (auditoria de
                    // 07/10): as duas acendem esta faixa, e o botão não as
                    // relia — apertar não fazia nada por elas.
                    if (advogadoId) carregarConversas(advogadoId);
                    if (conversaId) carregarAgendadas(conversaId);
                    if (falhasDeLeitura["filtro-quem"]) setTentativaQuem((n) => n + 1);
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
        // A LINHA DAS ATUALIZAÇÕES DO BANCO é só de quem administra, e vem por
        // último: as de cima mudam o que quem atende faz AGORA, e esta não.
        const fraseDosScripts = souAdmin ? fraseDosScriptsParaAFaixa(scriptsDoBanco) : null;
        if (!frases.length && !fraseDosScripts) return null;
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
              {fraseDosScripts && (
                /* COM UM BOTÃO, e é a única linha desta faixa que tem: as
                   outras não têm gesto que conserte, e esta tem um lugar
                   para onde ir — a aba que diz o que aconteceu e o motivo. */
                <span data-frase-de-saude data-frase-dos-scripts>
                  {fraseDosScripts}{" "}
                  <button data-ver-atualizacoes-do-banco
                          onClick={() => { setAbaDaAdmin("banco"); setTelaAdmin(true); }}
                          style={{ border: "1px solid rgba(255,255,255,.6)", background: "transparent",
                                   color: "#fff", borderRadius: 8, padding: "2px 10px", marginLeft: 4,
                                   fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Ver o que houve
                  </button>
                </span>
              )}
            </span>
          </div>
        );
      })()}
      </div>
      {/* A FILA DE COLUNAS — barra lateral, lista, conversa e ficha.
          `minHeight: 0` não é enfeite: sem ele um filho que rola (a lista de
          conversas) empurra a altura do flex para além da tela, e quem some
          por baixo é a caixa de escrever. */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
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
          {/* AS LINHAS DESATIVADAS, embaixo e separadas.
              Elas não são para atender: são para LER o que ainda chega. Um
              cliente que não soube da mudança continua escrevendo para o
              número antigo, e antes disto a mensagem entrava no banco sem
              ninguém no escritório ter como alcançá-la.
              Apagadas e com um traço em cima de propósito — a barra tem de
              dizer, sem texto, que aquela linha não está em serviço. */}
          {desativadosVisiveis.length > 0 && (
            <div data-linhas-desativadas={desativadosVisiveis.length}
                 style={{ width: 32, height: 1, background: C.divider, opacity: 0.6, flexShrink: 0, margin: "2px 0" }} />
          )}
          {desativadosVisiveis.map((a) => {
            const n = naoLidasDoAdvogado(a.id);
            const atual = a.id === advogadoId;
            return (
              <button
                key={a.id}
                onClick={() => trocarAdvogado(a.id)}
                data-telefone-desativado={a.nome}
                title={`${a.nome} — linha desativada, só leitura`}
                style={{ position: "relative", border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "flex", borderRadius: "50%", flexShrink: 0, boxShadow: atual ? `0 0 0 2px ${C.textSecondary}` : "none", opacity: atual ? 0.85 : 0.45, filter: "grayscale(1)", transition: "opacity .12s" }}
              >
                <Avatar nome={a.nome} foto={a.foto_url} size={42} />
                {n > 0 && (
                  <span data-selo-nao-lidas={n} style={{ position: "absolute", top: -4, right: -4, minWidth: 19, height: 19, padding: "0 5px", borderRadius: 10, background: C.textSecondary, color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.rail}`, boxSizing: "border-box" }}>
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {/* Um único ícone de Configurações: perfil, aparência, sair e mensagens
            rápidas ficam todos lá dentro. */}
        {/* AS TAREFAS, com o número do que pede ação AGORA (atrasadas e de
            hoje). Na barra, e não na linha da marca: aquela linha tem a conta
            de largura medida em 16/09, e um ícone a mais cortaria a marca. */}
        {temTarefas === true && (
          <button data-abrir-tarefas onClick={() => setTelaTarefas(true)}
                  title={tarefasParaAgora > 0
                    ? `Tarefas — ${tarefasParaAgora} para agora${tarefasAtrasadas ? ` (${tarefasAtrasadas} atrasada${tarefasAtrasadas === 1 ? "" : "s"})` : ""}`
                    : "Tarefas e lembretes"}
                  aria-label="Tarefas e lembretes"
                  style={{ position: "relative", width: 40, height: 40, borderRadius: 8, border: "none",
                           display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                           color: telaTarefas ? "#fff" : "#aebac1",
                           background: telaTarefas ? "rgba(255,255,255,.12)" : "transparent" }}>
            <BellRing size={22} />
            {tarefasParaAgora > 0 && (
              <span data-selo-tarefas={tarefasParaAgora} data-atrasadas={tarefasAtrasadas}
                    style={{ position: "absolute", top: 1, right: 0, minWidth: 18, height: 18, padding: "0 4px",
                             borderRadius: 9, background: tarefasAtrasadas ? "#d92b20" : "#d99a1e", color: "#fff",
                             fontSize: 10.5, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center",
                             justifyContent: "center", border: `2px solid ${C.rail}`, boxSizing: "border-box" }}>
                {tarefasParaAgora > 99 ? "99+" : tarefasParaAgora}
              </span>
            )}
          </button>
        )}
        {/* MÍDIAS de todas as conversas — o mesmo lugar do WhatsApp Web. */}
        <div onClick={() => abrirMidias(midiaAba)} title="Mídias, documentos e links"
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
      <div style={{ position: "relative", width: estreito ? "auto" : LARGURA_DA_LISTA, flex: estreito ? 1 : "none", minWidth: 0, borderRight: `1px solid ${C.divider}`, display: ((estreito && conversaId) || (estreito && fichaVisivel) || historico) ? "none" : "flex", flexDirection: "column", background: C.panel }}>
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
                    const lista = contatosLista.filter((c) => contatoCasaComABusca(c, q, chaveQ));
                    const doVantoro = linhasDoVantoro(lista);
                    // Houve consulta ao Vantoro e ela voltou sem nada. Dizer
                    // isso importa: sem a frase, "não achei no Vantoro" e "nem
                    // cheguei a perguntar" são a mesma tela em branco, e não há
                    // como saber se o cadastro está errado ou o sistema.
                    // E ELA SÓ VALE SE A PERGUNTA FOI FEITA. Sem Vantoro
                    // nada foi consultado, e "nenhuma pessoa com esse nome no
                    // Vantoro" passaria a ser dita sobre uma busca que não
                    // aconteceu — a mesma confusão que a frase existe para
                    // desfazer, agora do avesso.
                    const vantoroVazio = temVantoro === true
                      && buscaContato.trim().length >= 3
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
                          <div style={erroContatos ? { ...RECADO, color: "#c0392b" } : RECADO}>{erroContatos || (contatosLista.length ? "Nenhum contato salvo com esse nome." : "Nenhum contato salvo ainda.")}</div>
                        )}
                        {/* O CADASTRO DO VANTORO. Só aparece quando há o que
                            mostrar: uma seção vazia em toda busca ensinaria a
                            equipe a ignorar justamente a parte nova da tela. */}
                        {temVantoro === true
                          && (doVantoro.length > 0 || vantoroBuscando || vantoroErro || (vantoroVazio && !lista.length)) && (
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
        <div data-topo-da-coluna style={{ background: C.headerBar, padding: "8px 10px 9px", borderBottom: `1px solid ${C.divider}` }}>
          {/* O NOME DO SISTEMA, e não o de quem está logado. Quem está logado
              já se vê no rodapé da barra da esquerda, e ali com a foto — dizer
              "Você: Fulano" no topo era gastar a linha mais nobre da tela com o
              único dado que a pessoa nunca precisa consultar. */}
          {/* O TRAÇO DE DENTRO SAIU. Ele separava a marca do resto do bloco, e o
              bloco já termina num traço — eram duas linhas horizontais em
              sessenta pixels de tela. O WhatsApp Web não tem nenhuma. */}
          <div data-linha-da-marca style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 6 }}>
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
            <button onClick={() => { setBuscaContato(""); setContatoForm(null); setNovaConversaAberta(true); carregarContatos(); }} aria-label="Nova conversa" title="Nova conversa" style={{ ...BOTAO_ICONE, ...ICONE_DO_TOPO, color: C.textSecondary }}>
              <SquarePen size={19} />
            </button>
            {/* QUEM PARTICIPOU — o filtro por atendente.
                Ele era uma pílula na fita junto de "Tudo / Não lidas /
                Favoritas / Etiquetas", e ali estava fora de lugar por duas
                razões. A fita responde "que conversas mostrar" pelo estado
                delas; esta pergunta é sobre PESSOAS, e é a única da fita que
                abre um menu com dois modos e uma lista dentro. E era a quinta
                pílula de uma linha que já quebrava em duas.

                Aqui em cima ele fica ao lado das outras coisas que se faz na
                coluna — abrir conversa nova, virar a ordem da lista, abrir o
                menu — e a fita volta a ter só filtros de conversa.

                (A ordem veio depois, e pelo mesmo motivo: com ela a fita ainda
                quebrava em duas linhas. Ver `controleDaOrdem`.)

                Ícone sem rótulo porque é a vizinhança em que está: os três
                botões desta linha são ícones. O que ele perde em nome ganha em
                `title` e no rastro que aparece na fita quando está ligado. */}
            {advogadoId && filtroQuemOk && (
            <span ref={quemRef} style={{ position: "relative", display: "flex" }}>
              <button data-grupo="quem" onClick={() => setMenuQuem((v) => !v)}
                      aria-label="Filtrar por quem participou" aria-expanded={menuQuem}
                      title={quemFiltra.length ? "Filtrando por quem participou da conversa" : "Filtrar por quem participou da conversa"}
                      style={{ ...BOTAO_ICONE, ...ICONE_DO_TOPO,
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
            {!estreito && controleDaOrdem}
            {/* Menu ⋮ do topo, estilo WhatsApp Web */}
            <span ref={menuTopoRef} style={{ position: "relative", display: "flex" }}>
              <button onClick={() => setMenuTopoAberto((v) => !v)} aria-label="Menu" title="Menu" style={{ ...BOTAO_ICONE, ...ICONE_DO_TOPO, color: C.textSecondary }}>
                <MoreVertical size={20} />
              </button>
              {/* ABAIXO DO BOTÃO, e não por cima dele (auditoria de 07/10): em
                  `top: 26` o menu cobria a metade de baixo do ⋮ (34px no
                  computador, 40 no celular), e o segundo toque para fechar
                  caía em "Marcar todas como lidas" — que não pergunta nada. */}
              {menuTopoAberto && (
                <div style={{ position: "absolute", top: estreito ? 44 : 38, right: 0, width: 230, background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.28)", zIndex: 50, overflow: "hidden" }}>
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
                  {/* O FUNIL DE ETAPAS (script 017). Só aparece com o script
                      rodado: sem ele, o botão abriria uma tela que diz "falta
                      rodar o 017" para quem não pode fazer nada a respeito. */}
                  {temFunil === true && (
                    <button data-abrir-funil onClick={() => { setMenuTopoAberto(false); setTelaFunil(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><SquareKanban size={17} color={C.textSecondary} /> Funil</button>
                  )}
                  {temTarefas === true && (
                    <button data-abrir-tarefas-menu onClick={() => { setMenuTopoAberto(false); setTelaTarefas(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}>
                      <BellRing size={17} color={C.textSecondary} /> <span style={{ flex: 1 }}>Tarefas</span>
                      {tarefasParaAgora > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: tarefasAtrasadas ? "#d92b20" : "#d99a1e" }}>{tarefasParaAgora}</span>
                      )}
                    </button>
                  )}
                  <button onClick={() => { setMenuTopoAberto(false); setTelaPainel(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><BarChart3 size={17} color={C.textSecondary} /> Painel</button>
                  {/* Quem administra no Vantoro administra aqui. Esconder o botão
                      é cortesia, não segurança: quem não é admin esbarra nas
                      regras do banco de qualquer forma. */}
                  {souAdmin && (
                    <button onClick={() => { setMenuTopoAberto(false); setAbaDaAdmin("estrutura"); setTelaAdmin(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 14, textAlign: "left" }}><ShieldCheck size={17} color={C.textSecondary} /> Departamentos e acessos</button>
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
            <div ref={departamentosRef} style={{ position: "relative", marginBottom: 5 }}>
              <button onClick={() => setMenuDepartamentos((v) => !v)}
                      aria-expanded={menuDepartamentos} aria-haspopup="listbox"
                      title="Trocar de departamento"
                      style={{ width: "100%", minHeight: 32, display: "flex", alignItems: "center", gap: 8,
                               border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                               borderRadius: 8, padding: "4px 10px", cursor: "pointer", textAlign: "left" }}>
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
                <div role="listbox" style={{ position: "absolute", top: 37, left: 0, right: 0, zIndex: 60,
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
          {/* O RÓTULO E O VALOR NA MESMA LINHA, e não empilhados.
              Eram duas linhas — "ATENDENDO COMO" numa, o nome e o número na de
              baixo —, e a de cima gastava a altura de uma linha inteira para
              dizer o que o valor ao lado já diria em qualquer lugar. Juntas,
              custam 19px no lugar de 37, e nenhuma palavra se perdeu.

              Sem telefone escolhido não há "atendendo como": o traço solto
              embaixo do rótulo parecia dado faltando, e não escolha pendente. */}
          <div data-atendendo-como style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 10.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.3, flexShrink: 0 }}>
              {advogado ? "ATENDENDO COMO" : "ESCOLHA UM NÚMERO ABAIXO"}
            </span>
            {advogado && (<>
              {/* Quem encolhe é o NOME (`minWidth: 0` com reticências); o
                  número fica inteiro (`flexShrink: 0`) porque é o dado que se
                  copia — meio número não serve para nada, e um nome cortado
                  ainda se reconhece. */}
              <span style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {advogado.nome}
              </span>
              {numeroBonito(advogado.numero) && (
                <span style={{ fontSize: 12, color: C.textSecondary, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {numeroBonito(advogado.numero)}
                </span>
              )}
            </>)}
          </div>
        </div>

        {/* Buscar e filtrar uma lista que ainda não existe é oferecer botão que
            não faz nada. Só aparecem com um telefone escolhido. */}
        {advogadoId && (<>
        <div style={{ padding: "7px 12px 6px", background: C.panel }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderRadius: 8, padding: "5px 11px" }}>
            <Search size={16} color={C.textSecondary} />
            {/* CPF E PROCESSO VINHAM SÓ DO CADASTRO DO VANTORO. O que esta
                busca manda ao BANCO é nome, os dois nomes alternativos e
                número — medido em 15/09. Escondido o cadastro, a caixa passou
                a prometer duas coisas que ela não faz, e prometer busca por
                CPF é pior do que não oferecer: quem digita o CPF e não acha
                conclui que o cliente não está no sistema. */}
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={temVantoro === true
                     ? "Buscar por nome, mensagem, CPF ou processo"
                     : "Buscar por nome, mensagem ou número"} style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: C.textPrimary }} />
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
        {/* `position: relative` NA FITA, e não na pílula — ver o menu de mais
            filtros logo abaixo. */}
        <div data-fita-de-filtros style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 5, padding: "0 12px 7px", background: C.panel }}>
          {[["tudo", "Tudo"], ["naolidas", `Não lidas${totalNaoLidasLista ? " " + totalNaoLidasLista : ""}`], ["favoritas", "Favoritas"]].map(([k, label]) => {
            const ativo = filtro === k;
            return (
              <button key={k} data-aba={k} onClick={() => setFiltro(k)} style={{ flexShrink: 0, minHeight: 30, border: `1px solid ${ativo ? C.greenDark : C.divider}`, background: ativo ? C.greenDark : "transparent", color: ativo ? "#fff" : C.textSecondary, borderRadius: 20, padding: "4px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
            );
          })}

          {estreito && controleDaOrdem}

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

          {/* ------------------------------------------------------------
              A SETINHA DO FIM DA FITA — "mais filtros"

              Pedido do Rodrigo em 16/09, apontando o WhatsApp Web: lá a fita
              termina numa seta que abre "Grupos". A equipe já conhece o gesto.

              POR QUE A SETA ABSORVEU AS ETIQUETAS, e não ficou ao lado delas:
              a fita tem 356px de vão e comporta QUATRO pílulas — foi medido
              ontem, e é o motivo de a ordem da lista ter subido para o alto da
              coluna. Medido de novo hoje, com a seta ao lado da pílula de
              etiquetas: 379px, e a fita quebrou em duas linhas outra vez. Uma
              quinta coisa escrita não cabe, e nenhum aperto de recheio dá os
              23px que faltam sem ficar a um pixel de quebrar no primeiro
              contador de três dígitos.

              É também o que o WhatsApp Web faz: a seta ali é a GAVETA dos
              filtros que não cabem na linha, e não um filtro a mais.

              O QUE MUDA PARA QUEM USA ETIQUETA: um clique na seta em vez de um
              clique na pílula — o mesmo menu, com o mesmo conteúdo. E quando
              uma etiqueta ESTÁ escolhida, a seta continua virando a pílula
              colorida com o nome dela, que é o que responde "por que a lista
              está curta?" sem abrir nada.

              TRÊS FORMAS, UM CONTROLE SÓ:
                sem nada escolhido  -> só a seta (32px)
                grupos escolhido    -> "Grupos ✕", verde
                etiqueta escolhida  -> o nome dela, na cor dela
              ------------------------------------------------------------ */}
          <span ref={etiquetasRef} style={{ display: "flex", minWidth: 0 }}>
            <button data-mais-filtros onClick={() => setMenuEtiquetas((v) => !v)}
                    aria-expanded={menuEtiquetas} aria-haspopup="listbox"
                    aria-label={tagFiltrada ? `Filtrando por ${tagFiltrada.nome}`
                                : filtro === "grupos" ? "Mostrando só os grupos"
                                : filtro === "minhas" ? "Mostrando só as minhas conversas"
                                : filtro === "tarefas" ? "Mostrando só as conversas com tarefa para hoje" : "Mais filtros"}
                    title={tagFiltrada ? `Filtrando por "${tagFiltrada.nome}"`
                           : filtro === "grupos" ? "Mostrando só os grupos"
                           : filtro === "minhas" ? "Mostrando só as conversas em que você é o responsável"
                           : filtro === "tarefas" ? "Mostrando só as conversas com tarefa para hoje ou atrasada"
                           : "Mais filtros: minhas conversas, grupos e etiquetas"}
                    style={{ flexShrink: 1, minWidth: 0, maxWidth: 190, minHeight: 30,
                             border: `1px solid ${tagFiltrada ? tagFiltrada.cor : (filtroVerde ? C.greenDark : C.divider)}`,
                             background: tagFiltrada ? tagFiltrada.cor : (filtroVerde ? C.greenDark : "transparent"),
                             color: tagFiltrada ? corDoTextoSobre(tagFiltrada.cor) : (filtroVerde ? "#fff" : C.textSecondary),
                             borderRadius: 20,
                             padding: (tagFiltrada || filtroVerde) ? "4px 9px 4px 11px" : "4px 8px",
                             fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                             display: "flex", alignItems: "center", gap: 4 }}>
              {(tagFiltrada || filtroVerde) && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tagFiltrada ? tagFiltrada.nome : filtro === "minhas" ? "Minhas" : filtro === "tarefas" ? "Tarefas hoje" : "Grupos"}
                </span>
              )}
              <ChevronDown size={14} style={{ flexShrink: 0, opacity: .8 }} />
            </button>
            {menuEtiquetas && (
              /* ONDE ESTE MENU ABRE — relato do Rodrigo em 29/09, com foto:
                 as opções apareciam CORTADAS pela esquerda ("…versas",
                 "…Concluída").

                 A causa: ele era `right: 0` ancorado na PRÓPRIA PÍLULA. Com
                 181 não lidas a fita quebra em duas linhas e a pílula passa a
                 começar a ~14px da borda da coluna; um menu de 250px que
                 termina ali começa em −136, fora da tela.

                 E `left: 0` na pílula não serve: com a fita numa linha só ela
                 fica a ~258px, e 258+250 estoura a coluna pelo outro lado.

                 Então quem ancora é a FITA, que tem a largura da coluna e não
                 se move: `left: 12` alinha com as pílulas e `top: 100%` desce
                 abaixo dela, seja ela de uma ou de duas linhas. 12+250=262
                 cabe nos 360 da coluna e também num Android de 360.

                 O menu continua sendo FILHO da pílula no documento — é o que
                 faz o clique dentro dele contar como "dentro" para
                 `etiquetasRef`, e não fechar o menu que a pessoa acabou de
                 abrir. Quem mudou foi só o ponto de referência. */
              <div data-menu-mais-filtros role="listbox" style={{ position: "absolute", top: "100%", left: 12, zIndex: 40, width: 250, maxHeight: 320, overflowY: "auto", background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
                {/* GRUPOS VEM PRIMEIRO, e separado por um traço: é uma
                    pergunta de outra natureza que as etiquetas. Etiqueta é uma
                    marca que a equipe põe; grupo é o que a conversa É. */}
                {/* AS MINHAS VÊM PRIMEIRO: é o filtro de todo dia de quem
                    atende. Só com o script 008 — sem a coluna, a lista viria
                    sempre vazia, e "nenhuma conversa sua" seria mentira. */}
                {temResponsavel === true && (
                  <button data-minhas-opcao role="option" aria-selected={filtro === "minhas"}
                          onClick={() => { setFiltro(filtro === "minhas" ? "tudo" : "minhas"); setMenuEtiquetas(false); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", border: "none", borderBottom: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                    <UserCheck size={16} color={C.textSecondary} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>Minhas conversas</span>
                    {filtro === "minhas" && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
                  </button>
                )}
                {/* COM TAREFA PARA HOJE (script 018): as conversas deste
                    telefone com tarefa aberta que vence hoje ou já venceu — de
                    qualquer pessoa, porque quem vê a conversa vê as tarefas
                    dela. As MINHAS ficam na tela de Tarefas, na barra. */}
                {temTarefas === true && (
                  <button data-tarefas-opcao role="option" aria-selected={filtro === "tarefas"}
                          onClick={() => { setFiltro(filtro === "tarefas" ? "tudo" : "tarefas"); setMenuEtiquetas(false); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", border: "none", borderBottom: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                    <BellRing size={16} color={C.textSecondary} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>Com tarefa para hoje</span>
                    {filtro === "tarefas" && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
                  </button>
                )}
                <button data-grupos-opcao role="option" aria-selected={filtro === "grupos"}
                        onClick={() => { setFiltro(filtro === "grupos" ? "tudo" : "grupos"); setMenuEtiquetas(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", border: "none", borderBottom: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                  <Users size={16} color={C.textSecondary} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Grupos</span>
                  {/* O CONTADOR DE NÃO LIDAS, como no WhatsApp Web: responde
                      "vale a pena entrar aqui agora?" antes do clique. */}
                  {naoLidasDosGrupos > 0 && (
                    <span data-nao-lidas-grupos={naoLidasDosGrupos}
                          style={{ flexShrink: 0, minWidth: 20, height: 20, borderRadius: 10,
                                   background: C.unread, color: "#fff", fontSize: 11, fontWeight: 700,
                                   display: "flex", alignItems: "center", justifyContent: "center",
                                   padding: "0 6px" }}>{naoLidasDosGrupos}</span>
                  )}
                  {filtro === "grupos" && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
                </button>
                <button onClick={() => { setFiltro("tudo"); setMenuEtiquetas(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.divider}`, background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left" }}>
                  Todas as conversas
                  {!tagFiltrada && !filtroVerde && <Check size={16} color={C.green} style={{ marginLeft: "auto" }} />}
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
          {conversasFiltradas.length === 0 && !erroBusca && semConversa.length === 0 && (
            // A marca e a frase vêm de `recadoDaListaVazia`, uma escolha só —
            // o porquê de cada uma está lá em cima, junto dela.
            <div data-recado-da-lista={recadoDaListaVazia[0]}
                 style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>
              {recadoDaListaVazia[1]}
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
            const espera = diasEsperando(c);
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
                      {/* O NÚMERO, QUANDO O NOME SOZINHO NÃO BASTA.
                          `flexShrink: 0` NÃO é enfeite: quem tem de ser cortado
                          é o NOME, que está repetido nas duas linhas e por isso
                          não informa nada — o número é a única coisa ali que
                          separa uma da outra. Deixar o navegador escolher daria
                          "CRISTIANO RIBEIRO DE JESU… (19) 9820…", que é o
                          mesmo defeito do "Ropelimi Zo" com outra roupa: o
                          pedaço que importa cortado ao meio.
                          O nome inteiro continua a um passar de mouse, no
                          `title` da linha acima. */}
                      {precisaMostrarONumero(c) && (
                        <span data-numero-que-separa={c.contato?.numero || ""}
                              title={`Esta conversa é pelo ${numeroBonito(c.contato?.numero)}`}
                              style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600,
                                       color: C.verdeTexto, whiteSpace: "nowrap" }}>
                          {numeroBonito(c.contato?.numero)}
                        </span>
                      )}
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
                      {/* O ROSTO DO RESPONSÁVEL, no canto — e não uma linha a
                          mais: com o nome escrito, cada conversa ficaria mais
                          alta e a fila caberia menos na tela. O nome inteiro
                          vai no `title`. O MEU ganha um anel verde, que é o
                          que se procura correndo o olho pela lista. */}
                      {temResponsavel === true && c.responsavel_id && (
                        <span data-responsavel-na-linha={c.responsavel_id}
                              title={`Responsável: ${String(c.responsavel_id) === String(meuId) ? "você" : nomeDaPessoa(c.responsavel_id)}`}
                              style={{ display: "flex", borderRadius: "50%",
                                       boxShadow: String(c.responsavel_id) === String(meuId) ? `0 0 0 2px ${C.green}` : "none" }}>
                          <Avatar nome={nomeDaPessoa(c.responsavel_id)}
                                  foto={equipe.porId[String(c.responsavel_id)]?.foto} size={18} />
                        </span>
                      )}
                      {c.fixada && <Pin size={13} color={C.textSecondary} fill={C.textSecondary} style={{ transform: "rotate(45deg)" }} />}
                      {c.nao_lidas > 0 && <span style={{ background: C.unread, color: "#fff", borderRadius: 12, fontSize: 11, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.nao_lidas}</span>}
                    </span>
                  </div>
                  {/* HÁ QUANTOS DIAS ESTE CLIENTE ESPERA.
                      SÓ A PARTIR DE UM DIA, e isso é o que separa um sinal de
                      um enfeite: numa lista de SAC quase toda conversa tem
                      mensagem de hoje, e "esperando há 0 dias" em todas as
                      linhas é ruído que se aprende a não ler — aí o "há 5
                      dias" passa batido junto. Para o que é de hoje, a hora
                      ali em cima já responde.
                      DE ÂMBAR PARA VERMELHO aos três dias, que é quando deixa
                      de ser atraso e vira problema. */}
                  {espera >= 1 && (
                    <div data-espera={espera}
                         title={`Sem resposta desde ${new Date(c.esperando_desde).toLocaleDateString("pt-BR")}`}
                         style={{ marginTop: 3, fontSize: 11.5, fontWeight: 600,
                                  color: espera >= 3 ? "#e5573f"
                                       : (modo === "escuro" ? "#e0a400" : "#8a6d00") }}>
                      esperando há {espera} {espera === 1 ? "dia" : "dias"}
                    </div>
                  )}
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

              E ELA MORA DEPOIS DAS CONVERSAS, e não antes — relato de 16/09,
              com foto: procurar "rodrigo" mostrava a conversa certa e, dois
              segundos depois, ela "sumia" e a lista virava uma fileira de
              gente sem conversa nenhuma.

              A conversa não sumia: o cadastro respondia DEPOIS do banco (ele
              fica atrás da ponte, que hiberna) e doze homônimos entravam ACIMA
              dela, empurrando-a oitocentos pixels abaixo da dobra. Medido na
              bancada: 1 conversa aos 900ms; aos 2100ms, as mesmas 3 conversas
              com 12 ofertas na frente.

              A ordem certa sai da pergunta que a pessoa fez. Ela procurou um
              nome: se HÁ conversa com ele, essa é a resposta. "Comece uma
              conversa com alguém com quem você nunca falou" é o que sobra
              quando não há — e aí este bloco fica no alto sozinho, porque não
              há nada acima dele.

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
          </>}
        </div>
      </div>

      {/* Conversa */}
      {/* Mesmo motivo da coluna da lista: sem `minWidth: 0` a conversa aberta
          no celular fica mais larga que a tela por causa de uma mensagem
          comprida. */}
      <div style={{ flex: 1, minWidth: 0, display: ((estreito && !conversaId) || (estreito && (fichaVisivel || historico))) ? "none" : "flex", flexDirection: "column", background: C.chatBg, backgroundImage: modo === "escuro" ? PADRAO_CHAT_ESCURO : PADRAO_CHAT_CLARO, position: "relative" }}>
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
            {/* `overflow: hidden` é ENCOSTO, e não o conserto: quem faz caber é
                `cabecalhoApertado`. Ele existe para que um botão novo, num dia
                em que ninguém refez esta conta, seja CORTADO na borda em vez de
                ir pintar por cima da ficha — que foi o defeito relatado em
                28/09, e que ninguém lê como "falta espaço aqui". */}
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
                    {!estreito && !nomeTravadoPeloCadastro && (
                      <button onClick={() => setRenomeando(conversa.contato?.nome_zorvin || "")}
                              title="Dar um nome a este contato (só no Zorvin)"
                              data-renomear-contato
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
                {/* "FULANA TAMBÉM ESTÁ NESTA CONVERSA" NÃO OCUPA MAIS ESTA LINHA.
                    Ocupava, e tomava o lugar do número e dos três selos
                    (responsável, etapa, lembrete) enquanto a colega estivesse
                    ali — justamente o que se confere antes de responder. Pedido
                    do Rodrigo em 07/10, com foto: o aviso desce para a linha das
                    etiquetas, logo abaixo. */}
                {digitandoAtivo(conversa.id) ? (
                  <div style={{ fontSize: 12, color: C.verdeTexto, fontWeight: 600 }}>digitando…</div>
                ) : (
                  /* O TELEFONE DO CLIENTE, e não o nosso.
                     Aqui ficava "via Audiências · (11) 91355-9990" — o telefone
                     DO ESCRITÓRIO, que já está escrito em "ATENDENDO COMO", na
                     coluna ao lado, e que não muda de uma conversa para a
                     outra. Ou seja: a linha logo abaixo do nome do cliente,
                     onde o olho procura quem é ele, gastava-se repetindo quem
                     somos nós. O número do cliente é o que se precisa ler dali
                     — para conferir, para ditar, para procurar no cadastro. */
                  <div data-linha-do-numero style={{ fontSize: 12, color: C.textSecondary, display: "flex", alignItems: "center", gap: 4, minWidth: 0, whiteSpace: "nowrap" }}>
                    {/* O NÚMERO NÃO ENCOLHE (`flexShrink: 0`): responder
                        pelo número errado não tem desfazer. Quem cede espaço
                        é o nome do responsável, ao lado. */}
                    <span style={{ flexShrink: 0 }}>
                      {String(conversa.contato?.numero || "").startsWith("grupo:")
                        ? "Grupo"
                        : (numeroBonito(conversa.contato?.numero) || "sem número")}
                    </span>
                    {/* O RESPONSÁVEL, na linha do número e não num botão a
                        mais na fila da direita: aquela fila tem a conta de
                        largura medida em 29/09 (`FILA_ESCRITA`), e um botão
                        novo empurraria o nome do cliente de volta para o
                        "ELANE GO…". Aqui ele ocupa espaço que já existia.
                        No celular é só texto — o alvo de dedo mínimo (40px)
                        não cabe nesta linha —, e o gesto vai pelo ⋮. */}
                    {temResponsavel === true && (
                      <span ref={responsavelRef} style={{ position: "relative", display: "flex", minWidth: 0 }}>
                        {!selosCompactos && <span style={{ opacity: .6, flexShrink: 0 }}>·</span>}
                        {estreito ? (
                          <span data-responsavel-da-conversa={conversa.responsavel_id || ""}
                                style={{ marginLeft: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {conversa.responsavel_id
                              ? (String(conversa.responsavel_id) === String(meuId) ? "com você"
                                 : `com ${primeiroNome(nomeDaPessoa(conversa.responsavel_id))}`)
                              : "sem responsável"}
                          </span>
                        ) : (
                          <button data-responsavel-da-conversa={conversa.responsavel_id || ""}
                                  data-selo-compacto={selosCompactos ? "sim" : "nao"}
                                  onClick={() => setMenuResponsavel((v) => (v === "linha" ? false : "linha"))}
                                  aria-expanded={menuResponsavel === "linha"} aria-haspopup="listbox"
                                  title={conversa.responsavel_id
                                    ? `Responsável: ${nomeDaPessoa(conversa.responsavel_id)} — clique para passar adiante`
                                    : "Sem responsável — clique para assumir"}
                                  // `overflow: hidden` NO BOTÃO, e não na linha: a linha
                                  // ancora o menu, e recortá-la sumiria com ele (29/09).
                                  // No botão, faltando espaço, o selo é cortado na própria
                                  // borda em vez de pintar por cima do vizinho.
                                  style={{ border: "none", background: "transparent", cursor: "pointer",
                                           display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden",
                                           padding: "1px 4px", marginLeft: 1, borderRadius: 6, minHeight: 20,
                                           fontSize: 12, color: conversa.responsavel_id ? C.textPrimary : C.verdeTexto,
                                           fontWeight: conversa.responsavel_id ? 500 : 600 }}>
                            {conversa.responsavel_id ? (
                              <>
                                <Avatar nome={nomeDaPessoa(conversa.responsavel_id)}
                                        foto={equipe.porId[String(conversa.responsavel_id)]?.foto} size={16} />
                                {!selosCompactos && (
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {String(conversa.responsavel_id) === String(meuId) ? "Você"
                                      : primeiroNome(nomeDaPessoa(conversa.responsavel_id))}
                                  </span>
                                )}
                              </>
                            ) : (
                              <><UserPlus size={13} style={{ flexShrink: 0 }} />{!selosCompactos && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Assumir</span>}</>
                            )}
                            {!selosCompactos && <ChevronDown size={12} style={{ flexShrink: 0, opacity: .7 }} />}
                          </button>
                        )}
                        {menuResponsavel === "linha" && listaDeResponsaveis}
                      </span>
                    )}
                    {/* A ETAPA NO FUNIL, na mesma linha e pela mesma razão do
                        responsável: a fila de botões da direita tem a conta de
                        largura de 29/09, e esta linha já existia. No celular é
                        só texto, e o gesto vai pelo ⋮. */}
                    {temFunil === true && funilDaConversa && !funilDaConversa.carregando && (
                      <span ref={etapaRef} style={{ position: "relative", display: "flex", minWidth: 0 }}>
                        {!selosCompactos && <span style={{ opacity: .6, flexShrink: 0, marginLeft: 2 }}>·</span>}
                        {estreito ? (
                          <span data-etapa-da-conversa={etapaAtualDaConversa ? etapaAtualDaConversa.nome : ""}
                                style={{ marginLeft: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {etapaAtualDaConversa ? etapaAtualDaConversa.nome
                              : funilDaConversa.cartao === null ? "fora do funil" : "etapa ?"}
                          </span>
                        ) : (
                          <button data-etapa-da-conversa={etapaAtualDaConversa ? etapaAtualDaConversa.nome : ""}
                                  data-selo-compacto={selosCompactos ? "sim" : "nao"}
                                  onClick={() => setMenuEtapa((v) => (v === "linha" ? false : "linha"))}
                                  aria-expanded={menuEtapa === "linha"} aria-haspopup="listbox"
                                  title={etapaAtualDaConversa ? `Etapa no funil: ${etapaAtualDaConversa.nome} — clique para mudar`
                                    : "Este cliente não está no funil — clique para pôr"}
                                  style={{ border: "none", background: "transparent", cursor: "pointer",
                                           display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden",
                                           padding: "1px 4px", marginLeft: 1, borderRadius: 6, minHeight: 20,
                                           fontSize: 12, color: etapaAtualDaConversa ? C.textPrimary : C.textSecondary,
                                           fontWeight: 500 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                           background: etapaAtualDaConversa ? (etapaAtualDaConversa.cor || C.green) : "transparent",
                                           border: etapaAtualDaConversa ? "none" : `1px solid ${C.textSecondary}` }} />
                            {!selosCompactos && (
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {etapaAtualDaConversa
                                  ? etapaAtualDaConversa.nome + (etapaAtualDaConversa.ativo === false ? " (desativada)" : "")
                                  : funilDaConversa.cartao === null ? "Pôr no funil" : "Etapa"}
                              </span>
                            )}
                            {!selosCompactos && <ChevronDown size={12} style={{ flexShrink: 0, opacity: .7 }} />}
                          </button>
                        )}
                        {menuEtapa === "linha" && listaDeEtapas}
                      </span>
                    )}
                    {/* AS TAREFAS, na mesma linha e pela mesma razão do
                        responsável e da etapa. Diz a PRÓXIMA (vermelha se
                        atrasou, âmbar se é hoje); sem nenhuma, oferece
                        "Lembrar". No celular é só texto, e o gesto vai pelo ⋮. */}
                    {temTarefas === true && tarefasDaConversa && !tarefasDaConversa.carregando && (
                      <span ref={tarefaRef} style={{ position: "relative", display: "flex", minWidth: 0 }}>
                        {!selosCompactos && <span style={{ opacity: .6, flexShrink: 0, marginLeft: 2 }}>·</span>}
                        {estreito ? (
                          <span data-tarefa-da-conversa={proximaTarefa ? situacao(proximaTarefa) : ""}
                                style={{ marginLeft: 4, overflow: "hidden", textOverflow: "ellipsis",
                                         color: proximaTarefa ? corDaSituacao(situacao(proximaTarefa)) : undefined }}>
                            {tarefasDaConversa.erro ? "tarefas ?"
                              : proximaTarefa ? `tarefa ${rotuloDaHora(proximaTarefa.vence_em)}` : "sem tarefa"}
                          </span>
                        ) : (
                          <button data-tarefa-da-conversa={proximaTarefa ? situacao(proximaTarefa) : ""}
                                  data-selo-compacto={selosCompactos ? "sim" : "nao"}
                                  onClick={() => setMenuTarefa((v) => (v === "linha" ? false : "linha"))}
                                  aria-expanded={menuTarefa === "linha"} aria-haspopup="dialog"
                                  title={proximaTarefa ? `Próxima tarefa: ${proximaTarefa.texto} — ${rotuloDaTarefa(proximaTarefa)}`
                                    : "Criar um lembrete para esta conversa"}
                                  style={{ border: "none", background: "transparent", cursor: "pointer",
                                           display: "flex", alignItems: "center", gap: 4, minWidth: 0, overflow: "hidden",
                                           padding: "1px 4px", marginLeft: 1, borderRadius: 6, minHeight: 20,
                                           fontSize: 12, fontWeight: proximaTarefa ? 600 : 500,
                                           color: tarefasDaConversa.erro ? C.textSecondary
                                             : proximaTarefa ? corDaSituacao(situacao(proximaTarefa)) : C.verdeTexto }}>
                            {proximaTarefa ? <BellRing size={13} style={{ flexShrink: 0 }} /> : <BellPlus size={13} style={{ flexShrink: 0 }} />}
                            {!selosCompactos && (
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {tarefasDaConversa.erro ? "Tarefas"
                                  : proximaTarefa ? (situacao(proximaTarefa) === "atrasada" ? "Tarefa atrasada" : rotuloDaHora(proximaTarefa.vence_em))
                                  : "Lembrar"}
                              </span>
                            )}
                            {!selosCompactos && tarefasAbertasDaConversa.length > 1 && (
                              <span data-mais-tarefas style={{ flexShrink: 0, opacity: .8 }}>+{tarefasAbertasDaConversa.length - 1}</span>
                            )}
                            {!selosCompactos && <ChevronDown size={12} style={{ flexShrink: 0, opacity: .7 }} />}
                          </button>
                        )}
                        {menuTarefa === "linha" && listaDeTarefas}
                      </span>
                    )}
                  </div>
                )}
                {/* A LINHA DAS ETIQUETAS, e agora também a do aviso de quem
                    está junto. O AVISO NÃO ENCOLHE ANTES DAS ETIQUETAS: duas
                    pessoas respondendo o mesmo cliente é o que ele existe para
                    evitar, e uma etiqueta cortada continua com o nome inteiro
                    no menu. No celular as etiquetas não aparecem aqui (não
                    cabem), e o aviso fica sozinho na linha. */}
                {((!estreito && tagsDaConversa(conversa.id).length > 0) || atendidoPorOutro(conversa.id)) && (
                  <div data-linha-das-etiquetas
                       style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, overflow: "hidden", minWidth: 0 }}>
                    {!estreito && tagsDaConversa(conversa.id).length > 0 && (
                      <div style={{ display: "flex", gap: 4, overflow: "hidden", minWidth: 0, flexShrink: 1 }}>
                        {tagsDaConversa(conversa.id).map((t) => (
                          <span key={t.id} style={{ fontSize: 10.5, fontWeight: 600, color: corDoTextoSobre(t.cor), background: t.cor, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: t.nome.length > 12 ? 1 : 0 }}>{t.nome}</span>
                        ))}
                      </div>
                    )}
                    {atendidoPorOutro(conversa.id) && (
                      <div data-tambem-esta title={`${atendidoPorOutro(conversa.id)} também está nesta conversa`}
                           style={{ fontSize: 12, color: modo === "escuro" ? "#e0a400" : "#8a6d00", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, minWidth: 0, flexShrink: 0, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{atendidoPorOutro(conversa.id)} também está nesta conversa</span>
                      </div>
                    )}
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
              {/* A FILA SOLTA — só enquanto ela cabe SEM comer o nome.
                  Não cabendo, tudo isto vai para o ⋮ logo abaixo, escrito por
                  extenso. Ver `cabecalhoRecolhido`. */}
              {!estreito && !cabecalhoRecolhido && (
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
                          aria-label="Marcar esta conversa como lida"
                          style={{ ...BOTAO_ICONE, padding: cabecalhoApertado ? 9 : "7px 11px", gap: 6,
                                   background: C.searchBg, color: C.verdeTexto,
                                   fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <CheckCheck size={17} />
                    {cabecalhoApertado ? "" : "Marcar como lida"}
                  </button>
                ) : (
                  <button onClick={() => marcarNaoLida(conversa, true)}
                          data-marcar="nao-lida"
                          title="Marcar esta conversa como NÃO lida"
                          aria-label="Marcar esta conversa como NÃO lida"
                          style={{ ...BOTAO_ICONE, padding: cabecalhoApertado ? 9 : "7px 11px", gap: 6,
                                   background: "transparent", color: C.textSecondary,
                                   border: `1px solid ${C.divider}`,
                                   fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap" }}>
                    <MessageSquare size={17} />
                    {cabecalhoApertado ? "" : "Marcar como não lida"}
                  </button>
                )}
                {/* Ficha do cliente no Vantoro (cadastro, esteira, processos).
                    SÓ COM VANTORO: sem ele a coluna abre e não tem o que
                    mostrar — não há cadastro, nem esteira, nem processo. Ver
                    `temVantoro.js` para o porquê de `=== true` (a falha de rede
                    MOSTRA, para o escritório não perder a ficha calado). */}
                {temVantoro === true && (
                <button onClick={() => alternarFicha(!fichaVisivel)}
                        title={fichaVisivel ? "Recolher a ficha" : "Mostrar a ficha"} data-abrir-ficha
                        style={{ ...BOTAO_ICONE, padding: 10, background: fichaVisivel ? C.listActive : "transparent" }}>
                  <ClipboardList size={19} color={fichaVisivel ? C.green : C.textSecondary} />
                </button>
                )}
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
                {/* O "JÁ TRATEI" VEM ANTES DA BUSCA, e escrito. É a única
                    ação daqui que MUDA a fila do SAC — um ícone mudo ao lado
                    dos outros seis não seria achado por quem está aprendendo
                    a usar a fila. */}
                {acaoJaTratei && acaoJaTratei(false)}
                <button aria-label="Buscar na conversa" onClick={() => setBuscaAberta((v) => !v)} title="Buscar na conversa" style={{ ...BOTAO_ICONE, padding: 10 }}>
                  <Search size={19} color={buscaAberta ? C.green : C.textSecondary} />
                </button>
                </>
              )}

              {/* O ⋮ — do celular desde sempre, e do computador quando a
                  fila não cabe. O conteúdo é o MESMO nos dois: uma segunda
                  escrita dele divergiria no primeiro conserto, e divergir aqui
                  é uma ação existir num tamanho de janela e sumir no outro. */}
              {(estreito || cabecalhoRecolhido) && (
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
                      {/* PRIMEIRO ITEM DO MENU, e não o último: no celular
                          este menu é o único caminho, e a fila de espera é o
                          motivo de a pessoa ter aberto a conversa. */}
                      {acaoJaTratei && acaoJaTratei(true)}
                      {/* O RESPONSÁVEL, escrito — no celular este é o único
                          caminho para assumir ou passar a conversa. */}
                      {temResponsavel === true && (
                        <button onClick={() => { setMenuDaConversa(false); setMenuResponsavel("menu"); }}
                                data-menu-responsavel-item
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                          <UserCheck size={17} color={conversa.responsavel_id ? C.green : C.textSecondary} />
                          {conversa.responsavel_id ? "Responsável" : "Assumir esta conversa"}
                          {conversa.responsavel_id && (
                            <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                              {String(conversa.responsavel_id) === String(meuId) ? "você"
                                : primeiroNome(nomeDaPessoa(conversa.responsavel_id))}
                            </span>
                          )}
                        </button>
                      )}
                      {temTarefas === true && tarefasDaConversa && !tarefasDaConversa.carregando && (
                        <button onClick={() => { setMenuDaConversa(false); setMenuTarefa("menu"); }}
                                data-menu-tarefa-item
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                          {proximaTarefa ? <BellRing size={17} color={corDaSituacao(situacao(proximaTarefa))} />
                            : <BellPlus size={17} color={C.textSecondary} />}
                          {proximaTarefa ? "Tarefas" : "Lembrar"}
                          {proximaTarefa && (
                            <span style={{ marginLeft: "auto", fontSize: 12, color: corDaSituacao(situacao(proximaTarefa)), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                              {situacao(proximaTarefa) === "atrasada" ? "atrasada" : rotuloDaHora(proximaTarefa.vence_em)}
                            </span>
                          )}
                        </button>
                      )}
                      {temFunil === true && funilDaConversa && !funilDaConversa.carregando && (
                        <button onClick={() => { setMenuDaConversa(false); setMenuEtapa("menu"); }}
                                data-menu-etapa-item
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                          <SquareKanban size={17} color={etapaAtualDaConversa ? C.green : C.textSecondary} />
                          {etapaAtualDaConversa ? "Etapa no funil" : "Pôr no funil"}
                          {etapaAtualDaConversa && (
                            <span style={{ marginLeft: "auto", fontSize: 12, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                              {etapaAtualDaConversa.nome}
                            </span>
                          )}
                        </button>
                      )}
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
                      {/* A MESMA FICHA, pela outra porta. Esconder só o botão
                          da barra deixaria o caminho aberto por aqui — e o
                          menu ⋮ é justamente onde se procura o que não está à
                          vista. */}
                      {temVantoro === true && (
                      <button onClick={() => { setMenuDaConversa(false); alternarFicha(true); }}
                              data-menu-ficha
                              style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                        <ClipboardList size={17} color={C.textSecondary} /> Ficha no Vantoro
                      </button>
                      )}
                      <button onClick={() => {
                                setMenuDaConversa(false);
                                const id = conversa.contato_id || conversa.contato?.id;
                                if (id) carregarHistorico(id);
                                else mostrarAviso("Não consegui identificar o contato desta conversa.");
                              }}
                              style={{ ...ITEM_DO_MENU, color: C.textPrimary }}>
                        <History size={17} color={C.textSecondary} /> Histórico de atendimento
                        {/* O NÚMERO VEM JUNTO, e isto é o que faz "recolher"
                            não virar "esconder". Solto no cabeçalho, o ícone
                            de histórico carrega um selo verde dizendo que
                            OUTRO telefone atende este mesmo cliente — e sem
                            ele duas pessoas atendem a mesma pessoa sem saber
                            uma da outra. Quando a fila se recolhe aqui
                            dentro, o selo tinha de vir também; a prova
                            `o-cliente-e-um-so` pegou a falta. */}
                        {outrasConversasDoContato > 0 && (
                          <span data-outros-telefones={outrasConversasDoContato}
                                style={{ marginLeft: "auto", minWidth: 18, height: 18,
                                         padding: "0 5px", borderRadius: 9, background: C.green,
                                         color: "#fff", fontSize: 11, fontWeight: 700,
                                         lineHeight: "18px", textAlign: "center" }}>
                            {outrasConversasDoContato}
                          </span>
                        )}
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
                      {!nomeTravadoPeloCadastro && (
                        <button onClick={() => { setMenuDaConversa(false); setRenomeando(conversa.contato?.nome_zorvin || ""); }}
                                style={{ ...ITEM_DO_MENU, color: C.textPrimary, borderTop: `1px solid ${C.divider}` }}>
                          <Pencil size={17} color={C.textSecondary} /> Dar um nome a este contato
                        </button>
                      )}
                    </div>
                  )}

                  {tagMenuAberto && listaDeEtiquetas}
                  {quemParticipou && listaDeParticipantes}
                  {menuResponsavel === "menu" && listaDeResponsaveis}
                  {menuEtapa === "menu" && listaDeEtapas}
                  {menuTarefa === "menu" && listaDeTarefas}
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
                <button onClick={() => carregarAntigas()} disabled={buscandoAntigas}
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
                aoIrParaCitada={irParaCitada}
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

            {/* PRESO AO FIM DA ÁREA DAS BOLHAS, e não ao fundo da coluna. Era
                `bottom: 84` contado do fundo, que supunha só a barra de escrever
                embaixo — e com as agendadas, a citação ou a edição acima dela
                o botão ia pousar EM CIMA delas: medido, ele cobria o
                "Cancelar" da mensagem agendada. A âncora de altura zero fica
                entre as bolhas e o que vier embaixo, então o botão acompanha. */}
            {!pertoDoFim && (
              <div style={{ position: "relative", height: 0, flexShrink: 0 }}>
              <button onClick={irParaOFim} title="Ir para o fim" style={{ position: "absolute", right: 24, bottom: 22, width: 42, height: 42, borderRadius: "50%", background: C.panel, border: `1px solid ${C.divider}`, boxShadow: "0 2px 6px rgba(0,0,0,.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSecondary, zIndex: 5 }}>
                <ChevronDown size={22} />
              </button>
              </div>
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

            {/* AS AGENDADAS DESTA CONVERSA, logo acima da caixa de escrever.
                Ali, e não no meio das bolhas: nada disto chegou ao cliente
                ainda, e uma bolha na conversa diria que chegou. E é o lugar
                que quem vai escrever olha — a pergunta "já não agendei isso?"
                é feita na hora de escrever. */}
            {agendadas.length > 0 && (
              <div data-agendadas style={{ background: C.headerBar, padding: estreito ? "6px 8px 0" : "8px 16px 0",
                                           maxHeight: 150, overflowY: "auto" }}>
                {agendadas.map((a) => {
                  const saindo = new Date(a.agendada_para).getTime() <= Date.now();
                  const quem = a.enviado_por_id && a.enviado_por_id === meuId ? "você" : (a.enviado_por || "");
                  const anexo = a.tipo && a.tipo !== "texto";
                  return (
                    <div key={a.id} data-agendada={a.id}
                         style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg,
                                  borderLeft: `4px solid ${C.green}`, borderRadius: 6, padding: "5px 10px",
                                  marginBottom: 4 }}>
                      <Clock size={15} color={C.green} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div data-agendada-quando style={{ color: C.verdeTexto, fontWeight: 600, fontSize: 12 }}>
                          {saindo ? "Saindo agora…" : `Agendada para ${rotuloDaHora(a.agendada_para)}`}
                          {quem ? <span style={{ fontWeight: 400, color: C.textSecondary }}> · por {quem}</span> : null}
                        </div>
                        <div style={{ color: C.textSecondary, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {anexo ? <><Paperclip size={12} style={{ verticalAlign: "-1px" }} /> {a.midia_nome || "anexo"}{a.texto ? ` — ${a.texto}` : ""}</> : a.texto}
                        </div>
                      </div>
                      {/* EDITAR some no último minuto antes da hora: ali a ponte
                          pode estar pegando o item, e o banco recusa (016). */}
                      {!saindo && aindaDaParaEditar(a.agendada_para) && (
                        <button data-editar-agendada onClick={() => setEditandoAgendada(a)}
                                title="Editar o texto ou a hora desta mensagem agendada"
                                style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.verdeTexto || C.green,
                                         borderRadius: 14, padding: "4px 10px", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>
                          Editar
                        </button>
                      )}
                      {!saindo && (
                        <button data-cancelar-agendada onClick={() => cancelarAgendada(a)}
                                title="Cancelar esta mensagem agendada"
                                style={{ border: `1px solid ${C.divider}`, background: "transparent", color: "#e53935",
                                         borderRadius: 14, padding: "4px 10px", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {respondendo && (
              <div style={{ background: C.headerBar, padding: "8px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderLeft: `4px solid ${C.green}`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.verdeTexto, fontWeight: 600, fontSize: 12 }}>Respondendo {respondendo.autor === "advogado"
                      ? (!respondendo.porId || String(respondendo.porId) === String(meuId) ? "você mesmo" : (respondendo.por || "um colega"))
                      : (nomeDoContato(conversa.contato) || "o contato")}</div>
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
      {/* A COLUNA CONFERE TAMBÉM, e hoje isto é um ENCOSTO INALCANÇÁVEL —
          está escrito aqui porque descobrir de novo custaria o mesmo tempo.
          `temVantoro` resolve uma vez por abertura: dando "não tem", nenhum dos
          dois botões existiu, então `fichaAberta` nunca ficou verdadeiro.

          Fica porque a inalcançabilidade vem do desenho das OUTRAS duas
          guardas, e não desta: no dia em que a resposta for perguntada de novo
          (uma reconexão, um "tentar de novo"), é esta que impede a coluna de
          ficar de pé sozinha numa instalação sem Vantoro. Não há prova
          apontando para ela, de propósito — a sabotagem confirmou que não há
          como fazê-la reprovar, e prova que não pode reprovar é pior do que
          nenhuma. */}
      {fichaVisivel && conversa && temVantoro === true && (
        <FichaVantoro
          // REMONTADA A CADA CONVERSA (auditoria de 07/10). Fixa, ela deixou de
          // ser desmontada na troca — e a resposta atrasada do Vantoro para a
          // conversa ANTERIOR (a ponte hiberna, demora segundos) pintava o
          // cliente de lá na conversa nova; "Salvar" então ligava o contato
          // novo ao cadastro do outro. Remontar faz toda resposta velha cair
          // num componente que não existe mais, em todos os caminhos de uma vez.
          key={conversa.contato?.numero || conversa.id}
          numero={conversa.contato?.numero}
          // O NOME QUE ESTÁ NA TELA, e não o cru do WhatsApp. É daqui que sai o
          // nome do pré-cadastro quando a equipe decide transformar o lead em
          // cliente — e seria absurdo ter acabado de renomear o contato para
          // "Maria Aparecida" e ver o Vantoro nascer com "Deus".
          nomeContato={nomeDoContato(conversa.contato)}
          C={C}
          estreito={estreito}
          onFechar={() => alternarFicha(false)}
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
            {!!historico.erroAlteracoes && (
              <div data-erro-das-alteracoes style={{ fontSize: 13, color: "#c0392b", marginBottom: 12 }}>{historico.erroAlteracoes}</div>
            )}
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

            {/* "JÁ TRATEI" — o que a equipe já resolveu com este cliente.
                Antes da lista de telefones e fora do bloco dela, pelo mesmo
                motivo das alterações: o que foi tratado não depende de alguém
                ter MANDADO mensagem — "Já tratei" existe justamente para a
                conversa que sai da fila sem resposta escrita.
                `tratados === null` é o banco sem o script 005: aí o recurso
                não existe, e a seção não aparece. Ver
                `carregarTratadosDoHistorico`. */}
            {!!historico.tratados && (
              <div data-historico-ja-tratei style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>
                  Já tratei{historico.tratados.carregando ? "" : ` (${historico.tratados.grupos.length})`}
                </div>
                {historico.tratados.carregando && (
                  <div style={{ fontSize: 13, color: C.textSecondary }}>Levantando…</div>
                )}
                {!!historico.tratados.erro && (
                  <div data-historico-ja-tratei-erro style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                    {historico.tratados.erro}
                  </div>
                )}
                {!historico.tratados.carregando && !historico.tratados.erro && !historico.tratados.grupos.length && (
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                    Ninguém marcou “Já tratei” com este cliente ainda.
                  </div>
                )}
                {historico.tratados.grupos.map((g) => {
                  const pessoa = equipe.porId[String(g.quem)];
                  const nome = pessoa?.nome || (String(g.quem) === String(meuId) ? "Você" : "alguém da equipe");
                  const linha = (historico.linhas || []).find((l) => String(l.conversaId) === String(g.conversaId));
                  // Os assuntos na ORDEM da administração, e não na do banco:
                  // é a ordem em que a equipe os lê na janela do "Já tratei".
                  const nomes = g.assuntos
                    .map((id) => assuntos.find((a) => String(a.id) === String(id)))
                    .sort((a, b) => (a?.ordem ?? 999) - (b?.ordem ?? 999))
                    .map((a) => a?.nome || "assunto removido");
                  const quemDesfez = g.desfeitoPor ? (equipe.porId[String(g.desfeitoPor)]?.nome || "alguém") : null;
                  return (
                    <div key={g.chave} data-registro-no-historico data-desfeito={g.desfeitoEm ? "sim" : undefined}
                         style={{ display: "flex", gap: 9, marginBottom: 12, opacity: g.desfeitoEm ? 0.65 : 1 }}>
                      <div style={{ marginTop: 2 }}><Avatar nome={nome} foto={pessoa?.foto} size={28} /></div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                          <b>{nome}</b> marcou “Já tratei”
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {nomes.map((n, i) => (
                            <span key={i} data-assunto-no-historico
                                  style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                                           background: C.listActive, color: C.textPrimary,
                                           textDecoration: g.desfeitoEm ? "line-through" : "none" }}>
                              {n}
                            </span>
                          ))}
                        </div>
                        {/* O TEXTO DO OUTROS — é ele que diz o que "outros"
                            quis dizer. Sem ele a seção repetiria a pergunta
                            que o campo obrigatório existe para responder. */}
                        {g.observacoes.map((o, i) => (
                          <div key={i} data-observacao-no-historico
                               style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.45, overflowWrap: "anywhere",
                                        fontStyle: "italic", color: C.textPrimary }}>
                            “{o}”
                          </div>
                        ))}
                        <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 3 }}>
                          {dataHoraDe(g.quando)}
                          {linha?.adv ? <> · por {comNumero(linha.adv)}</> : null}
                        </div>
                        {/* O DESFEITO FICA, marcado — não some. "Marcaram e
                            desfizeram" é uma resposta diferente de "ninguém
                            marcou", e quem desfez e quando é justamente o que
                            se pergunta depois. */}
                        {g.desfeitoEm && (
                          <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>
                            <b>desfeito</b>{quemDesfez ? ` por ${quemDesfez}` : ""} · {dataHoraDe(g.desfeitoEm)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {historico.parcial && !historico.tratados.carregando && !historico.tratados.erro && (
                  <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5 }}>
                    Só das conversas dos telefones que você alcança — a ponte não
                    respondeu, e sem ela não sei quais são as outras.
                  </div>
                )}
                {historico.tratados.cortado && (
                  <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5 }}>
                    Mostrando só os mais recentes. O relatório do Painel tem o resto.
                  </div>
                )}
              </div>
            )}

            {/* O CAMINHO NO FUNIL — por onde o cliente passou, quem o moveu e
                quanto tempo ele ficou em cada etapa. Fora do bloco dos
                telefones pelo mesmo motivo do "Já tratei": o funil não
                depende de alguém ter mandado mensagem. `funil === null` é o
                banco sem o script 017 — aí não há o que mostrar. Ver
                `carregarCaminhoDoHistorico`. */}
            {!!historico.funil && (() => {
              const f = historico.funil;
              const etapa = (id) => (id == null ? null : (f.etapas || {})[String(id)] || null);
              const quemFoi = (id) => {
                if (id == null) return "O Zorvin";
                if (String(id) === String(meuId)) return "Você";
                return equipe.porId[String(id)]?.nome || "Alguém da equipe";
              };
              const etapaChip = (id) => {
                const e = etapa(id);
                return (
                  <span data-etapa-no-caminho style={{ display: "inline-flex", alignItems: "center", gap: 5,
                                                      fontWeight: 600, whiteSpace: "nowrap" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                                   background: e?.cor || C.textSecondary }} />
                    {e?.nome || "uma etapa"}
                    {e && e.ativo === false && (
                      <span style={{ fontWeight: 400, color: C.textSecondary }}> (desativada)</span>
                    )}
                  </span>
                );
              };
              return (
                <div data-historico-funil style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>
                    Caminho no funil
                  </div>
                  {f.carregando && <div style={{ fontSize: 13, color: C.textSecondary }}>Levantando…</div>}
                  {!!f.erro && (
                    <div data-historico-funil-erro style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>{f.erro}</div>
                  )}
                  {!f.carregando && !f.erro && !f.grupos.length && (
                    <div data-historico-funil-vazio style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                      Este cliente ainda não passou pelo funil{souAdmin ? "" : " dos departamentos que você atende"}.
                    </div>
                  )}
                  {f.grupos.map((g) => {
                    const dep = departamentos.find((d) => String(d.id) === String(g.departamentoId));
                    return (
                      <div key={g.departamentoId} data-caminho-do-departamento={g.departamentoId} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{dep?.nome || "Departamento"}</div>
                        <div data-onde-esta-agora style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
                          {g.atual
                            ? <>Agora em {etapaChip(g.atual)} · há {duracaoLegivel(Date.now() - new Date(g.desde)) || "pouco"}</>
                            : "Fora do funil agora."}
                        </div>
                        {g.passos.map((p) => (
                          <div key={p.id} data-passo-no-caminho={p.tipo}
                               style={{ display: "flex", gap: 9, marginBottom: 10 }}>
                            <div style={{ marginTop: 2 }}>
                              <Avatar nome={quemFoi(p.quem)} foto={p.quem ? equipe.porId[String(p.quem)]?.foto : undefined} size={24} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1, fontSize: 13, lineHeight: 1.5 }}>
                              {p.tipo === "entrou" && (
                                p.quem == null
                                  ? <>Entrou no funil em {etapaChip(p.para)}, sozinho, quando escreveu pela primeira vez</>
                                  : <><b>{quemFoi(p.quem)}</b> pôs no funil em {etapaChip(p.para)}</>
                              )}
                              {p.tipo === "moveu" && (
                                <><b>{quemFoi(p.quem)}</b> moveu de {etapaChip(p.de)} para {etapaChip(p.para)}</>
                              )}
                              {p.tipo === "saiu" && (
                                <><b>{quemFoi(p.quem)}</b> tirou do funil, de {etapaChip(p.de)}</>
                              )}
                              {/* QUANTO TEMPO FICOU — da última chegada à etapa
                                  até sair dela. Sem a chegada (o caminho
                                  começou antes), não se inventa número. */}
                              {p.ficouMs != null && (
                                <div data-ficou-na-etapa style={{ fontSize: 12, color: C.textSecondary }}>
                                  ficou {duracaoLegivel(p.ficouMs)} em {etapa(p.de)?.nome || "uma etapa"}
                                </div>
                              )}
                              <div style={{ fontSize: 11.5, color: C.textSecondary }}>{dataHoraDe(p.quando)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {!f.carregando && !f.erro && !!f.grupos.length && !souAdmin && (
                    <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5 }}>
                      Só dos departamentos que você atende.
                    </div>
                  )}
                  {f.cortado && (
                    <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5 }}>
                      Mostrando só os passos mais recentes.
                    </div>
                  )}
                </div>
              );
            })()}

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
              {[["perfil", "Perfil"], ["aparencia", "Aparência"], ["avisos", "Avisos"], ["contatos", "Contatos"], ["rapidas", "Mensagens rápidas"], ["tags", "Etiquetas"], ["importar", "Importar histórico"]].map(([k, label]) => (
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

              {abaConfig === "avisos" && (
                <div style={{ maxWidth: 480 }} data-aba-avisos>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Avisos</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 20, lineHeight: 1.5 }}>
                    O som toca quando chega mensagem numa conversa <b>sua</b> — em que
                    você já respondeu — ou numa conversa que <b>ninguém</b> atendeu
                    ainda, que é o cliente novo. Vale para todos os telefones, e não
                    só o que está aberto.
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary,
                                letterSpacing: .3, marginBottom: 8 }}>SOM DA MENSAGEM NOVA</div>
                  {SONS.map((som) => (
                    <div key={som.id} data-som-opcao={som.id}
                         onClick={() => { setSomDoAviso(som.id); guardarSom(som.id); tocarAviso(som.id); }}
                         style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                                  marginBottom: 6, borderRadius: 10, cursor: "pointer",
                                  background: somDoAviso === som.id ? C.listActive : C.searchBg,
                                  border: `1px solid ${somDoAviso === som.id ? C.green : "transparent"}` }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                                     border: `2px solid ${somDoAviso === som.id ? C.green : C.divider}`,
                                     background: somDoAviso === som.id ? C.green : "transparent" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{som.nome}</div>
                        <div style={{ fontSize: 12.5, color: C.textSecondary }}>{som.descricao}</div>
                      </div>
                      {/* TOCA AO ESCOLHER, e não num botão separado de "ouvir".
                          Escolher um som sem ouvi-lo é escolher no escuro, e um
                          botão a mais por linha dobraria os botões de uma tela
                          que só tem linhas. */}
                      <Volume2 size={17} color={C.textSecondary} />
                    </div>
                  ))}

                  {/* A PERMISSÃO DO NAVEGADOR É OUTRA COISA, e some da vista se
                      ficar junto do som. Sem ela não há aviso na área de
                      trabalho — e a pessoa não tem como saber disso, porque o
                      navegador não diz nada: simplesmente não aparece nada. */}
                  <div style={{ marginTop: 22, padding: "13px 15px", borderRadius: 10,
                                background: C.searchBg, fontSize: 13, lineHeight: 1.5 }}
                       data-permissao-aviso>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>Aviso na área de trabalho</div>
                      {/* A CHAVE FICA AQUI, e não junto dos sons.
                          São duas incomodações diferentes: "Sem som" tira o
                          barulho e deixa a tarja; esta tira a tarja e deixa o
                          barulho. Quem trabalha de fone quer o contrário de
                          quem senta numa sala silenciosa, e uma opção só
                          obrigaria a desligar as duas para se livrar de uma.
                          E fica no MESMO quadro da permissão do navegador
                          porque as duas falam da mesma coisa — dois quadros
                          intitulados "Aviso na área de trabalho" fariam a
                          pessoa procurar a diferença entre eles. */}
                      <span data-chave-aviso-na-tela>
                        <Chave ligada={avisoNaTela} rotulo="Aviso na área de trabalho"
                               aoTrocar={() => {
                                 const novo = !avisoNaTela;
                                 setAvisoNaTela(novo);
                                 guardarAvisoNaTela(novo);
                               }} />
                      </span>
                    </div>
                    {/* DESLIGADO, O QUE SOBRA PRECISA SER DITO. Sem esta frase,
                        quem desliga fica sem saber se acabou de se calar por
                        inteiro — e é justamente por essa dúvida que alguém
                        religa e volta a ser interrompido. */}
                    {!avisoNaTela && (
                      <span data-tarja-desligada style={{ color: C.textSecondary }}>
                        Desligado. O som continua tocando e o selo verde continua
                        contando as não lidas — o que não aparece mais é a tarja do
                        sistema por cima das outras janelas.
                      </span>
                    )}
                    {avisoNaTela && permissaoDeAviso === "granted" && (
                      <span style={{ color: C.textSecondary }}>
                        Autorizado. As mensagens novas aparecem numa tarja do sistema,
                        mesmo com o Zorvin atrás de outra janela.
                      </span>
                    )}
                    {avisoNaTela && permissaoDeAviso === "denied" && (
                      <span style={{ color: C.textSecondary }}>
                        O navegador está bloqueando. Só dá para liberar por ele:
                        clique no cadeado ao lado do endereço e autorize as
                        notificações deste site. Daqui não há como pedir de novo.
                      </span>
                    )}
                    {avisoNaTela && permissaoDeAviso !== "granted" && permissaoDeAviso !== "denied" && (
                      <>
                        <div style={{ color: C.textSecondary, marginBottom: 9 }}>
                          Ainda não autorizado. Sem isso, só o som avisa — e com o
                          Zorvin atrás de outra janela não há aviso nenhum.
                        </div>
                        <button onClick={pedirPermissaoDeAviso}
                                data-pedir-permissao
                                style={{ border: "none", background: C.green, color: "#fff",
                                         borderRadius: 8, padding: "7px 13px", fontSize: 13,
                                         fontWeight: 600, cursor: "pointer" }}>
                          Autorizar
                        </button>
                      </>
                    )}
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
                        <textarea ref={textoDaRapidaRef} data-texto-da-rapida-na-config value={rapidaForm.texto} onChange={(e) => setRapidaForm((f) => ({ ...f, texto: e.target.value }))} rows={5} placeholder="Ex.: {saudacao}, {nome}! Aqui é {atendente}, do escritório." style={{ width: "100%", boxSizing: "border-box", marginTop: 5, border: `1px solid ${C.divider}`, outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "9px 12px", fontSize: 14, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }} />
                        {/* AS VARIÁVEIS À VISTA, e num clique. Escritas só numa
                            explicação, viravam coisa que se digita de memória —
                            e "{nome}" com um erro de digitação vai para o
                            cliente com as chaves. */}
                        <div data-variaveis-da-rapida style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: C.textSecondary }}>Pôr no texto:</span>
                          {VARIAVEIS.map((v) => (
                            <button key={v.chave} type="button" data-variavel={v.chave} title={v.diz} aria-label={`Pôr {${v.chave}}: ${v.diz}`}
                                    onClick={() => porVariavel(v.chave)}
                                    style={{ border: `1px solid ${C.divider}`, background: C.listActive, color: C.textPrimary, borderRadius: 14, padding: "4px 10px", fontSize: 12.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", cursor: "pointer" }}>
                              {`{${v.chave}}`}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6, lineHeight: 1.45 }}>
                          Na conversa, cada uma vira o que diz: o nome é o que aparece no alto da conversa. Cliente ainda sem nome? A variável some — “Olá, {"{nome}"}!” vira “Olá!”.
                        </div>
                        {/* A VARIÁVEL QUE O ZORVIN NÃO CONHECE é dita aqui, enquanto
                            dá para corrigir. Na conversa ela iria calada para o
                            cliente, com as chaves. Avisa e não impede: quem
                            quiser mandar chaves de verdade, manda. */}
                        {(() => {
                          const estranhas = variaveisDesconhecidas(rapidaForm.texto);
                          if (!estranhas.length) return null;
                          const uma = estranhas.length === 1;
                          return (
                            <div data-variavel-desconhecida role="alert"
                                 style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, padding: "8px 10px", borderRadius: 8,
                                          background: modo === "escuro" ? "#3a2a1a" : "#fff4e5", border: "1px solid #e0a458",
                                          fontSize: 12.5, lineHeight: 1.45, color: C.textPrimary }}>
                              <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>
                                <b>{estranhas.join(", ")}</b> {uma ? "não é uma variável" : "não são variáveis"} do Zorvin: {uma ? "vai" : "vão"} para o cliente assim, com as chaves. As que existem são {VARIAVEIS.map((v) => `{${v.chave}}`).join(", ")}.
                              </span>
                            </div>
                          );
                        })()}
                        {/* COMO FICA, preenchido de verdade, pela mesma conta que a
                            conversa usa. O nome de exemplo vem em maiúsculas de
                            propósito: é como o cadastro do Vantoro escreve, e a
                            prévia mostra que na mensagem ele não vai assim. */}
                        {usaVariaveis(rapidaForm.texto) && (
                          <div data-previa-da-rapida style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: C.listActive }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>COMO FICA — PARA A CLIENTE “MARIA APARECIDA DOS SANTOS”, AGORA</div>
                            <div data-previa-texto style={{ fontSize: 13.5, marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word", color: C.textPrimary }}>
                              {preencherVariaveis(rapidaForm.texto, { cliente: "MARIA APARECIDA DOS SANTOS", atendente: meuNome, agora: new Date() })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setRapidaForm(null)} style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                        <button data-salvar-rapida onClick={salvarRapidaForm} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden" }}>
                      {rapidas.length === 0 && (
                        <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>Nenhuma mensagem rápida ainda. Toque em <b>Nova</b> para criar a primeira.</div>
                      )}
                      {rapidas.map((r) => (
                        <div key={r.id} data-rapida-da-config={r.titulo} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.titulo}</div>
                            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.texto}</div>
                          </div>
                          <button data-editar-rapida onClick={() => setRapidaForm({ id: r.id, titulo: r.titulo, texto: r.texto })} title="Editar" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary, display: "flex", flexShrink: 0 }}><Pencil size={16} /></button>
                          <button data-apagar-rapida onClick={() => apagarRapida(r.id)} title="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#e5573f", display: "flex", flexShrink: 0 }}><Trash2 size={16} /></button>
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
                        <button data-salvar-etiqueta onClick={salvarTagForm} style={{ border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden" }}>
                      {tags.length === 0 && (
                        <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13.5 }}>Nenhuma tag ainda. Toque em <b>Nova</b> para criar a primeira.</div>
                      )}
                      {tags.map((t) => (
                        <div key={t.id} data-etiqueta-da-config={t.nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: t.cor, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</span>
                          <button data-editar-etiqueta onClick={() => setTagForm({ id: t.id, nome: t.nome, cor: t.cor })} title="Editar" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary, display: "flex", flexShrink: 0 }}><Pencil size={16} /></button>
                          <button data-apagar-etiqueta onClick={() => apagarTag(t.id)} title="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#e5573f", display: "flex", flexShrink: 0 }}><Trash2 size={16} /></button>
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
                      <div style={{ fontSize: 13, color: C.textSecondary }}>{`Todos os contatos salvos. Crie novos e abra a conversa com ${voc.o} ${voc.singular} atual.`}</div>
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
                          const lista = contatosLista.filter((c) => contatoCasaComABusca(c, q, chaveQ));
                          if (!lista.length) return <div style={{ padding: 24, textAlign: "center", color: erroContatos ? "#c0392b" : C.textSecondary, fontSize: 13.5 }}>{erroContatos || (contatosLista.length ? "Nenhum contato encontrado." : "Nenhum contato ainda. Toque em Novo para criar.")}</div>;
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
                        "Conversar" abre (ou cria) a conversa com {voc.o} {voc.singular} que está {voc.selecionado} na barra lateral ({advogado?.nome || "—"}).
                      </div>
                    </>
                  )}
                </div>
              )}

              {abaConfig === "importar" && (
                <div style={{ maxWidth: 620 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Importar histórico</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 18, lineHeight: 1.5 }}>
                    Traga conversas antigas do WhatsApp para o Zorvin. No celular {voc.o === "a" ? "da" : "do"} {voc.singular}: abra a conversa → <b>⋮ → Mais → Exportar conversa → Sem mídia</b>, e suba aqui o arquivo <b>.zip</b> (ou o <b>.txt</b>) que o WhatsApp gera — não precisa extrair. Pode subir vários de uma vez. As conversas que ainda não existem são <b>criadas</b>.
                  </div>

                  <input ref={txtRef} type="file" accept=".txt,.zip,text/plain,application/zip,application/x-zip-compressed" multiple onChange={aoEscolherTxts} style={{ display: "none" }} />

                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>{`${voc.SINGULAR} (${voc.dono} destas conversas)`}</label>
                  <select value={impAdvId} onChange={(e) => setImpAdvId(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 6, marginBottom: 16, border: `1px solid ${C.divider}`, background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "10px 12px", fontSize: 14 }}>
                    <option value="">{`Escolha ${voc.o} ${voc.singular}…`}</option>
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
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>{`QUAL NOME É VOCÊ (${voc.o} ${voc.singular}) NAS CONVERSAS?`}</label>
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
                  {/* A MESMA PRÉVIA DA BOLHA, em tamanho grande. Era um
                      iframe próprio, e um CSV arrastado para cá BAIXAVA na
                      hora em vez de aparecer — o mesmo defeito da conversa,
                      numa segunda cópia. */}
                  <PreviaDeArquivo C={C} url={atual.url} mime={atual.mime}
                                   nome={atual.nome} altura="46vh" inteira />
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
              {/* AGENDAR OS ANEXOS — a mesma janela da caixa de escrever. */}
              {temAgenda === true && (
                <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
                  {escolhendoHora === "anexo" && (
                    <div style={{ position: "absolute", bottom: 54, right: 0, zIndex: 5 }}>
                      <EscolherHora C={C} escuro={modo === "escuro"}
                        titulo={anexosPendentes.length > 1 ? `Agendar os ${anexosPendentes.length} anexos` : "Agendar este anexo"}
                        previa={anexosPendentes.map((a) => a.nome).join(", ")}
                        aoEscolher={agendarAnexos} aoFechar={() => setEscolhendoHora(null)} />
                    </div>
                  )}
                  <button data-agendar-anexo onClick={() => setEscolhendoHora((v) => (v === "anexo" ? null : "anexo"))}
                          title="Agendar" aria-label="Agendar" aria-expanded={escolhendoHora === "anexo"}
                          style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 22, padding: 0 }}>
                    <Clock size={22} color={escolhendoHora === "anexo" ? C.green : C.textSecondary} />
                  </button>
                </span>
              )}
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

      {/* EDITAR UMA AGENDADA — no meio da tela, e não pendurada na faixa: a
          faixa fica logo acima da caixa de escrever, e uma janela de 340px
          ancorada ali cobriria a conversa no celular sem caber na tela. */}
      {editandoAgendada && (
        <div data-editar-agendada-janela onClick={() => setEditandoAgendada(null)}
             style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 96,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <EscolherHora C={C} escuro={modo === "escuro"} editar
                        titulo="Editar mensagem agendada"
                        textoInicial={editandoAgendada.texto || ""}
                        quandoInicial={editandoAgendada.agendada_para}
                        rotuloDoTexto={editandoAgendada.tipo && editandoAgendada.tipo !== "texto" ? "Legenda do anexo" : "Mensagem"}
                        textoObrigatorio={!editandoAgendada.tipo || editandoAgendada.tipo === "texto"}
                        aoEscolher={(quando, texto) => salvarAgendada(editandoAgendada, quando, texto)}
                        aoFechar={() => setEditandoAgendada(null)} />
        </div>
      )}

      {/* Toast discreto (avisos não bloqueantes) */}
      {/* MARCADO (`data-aviso`) para as provas endereçarem o recado sem
          depender das palavras dele: frase que muda não pode calar uma
          conferência que ainda vale. */}
      {aviso && (
        <div data-aviso style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#333", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,.3)", zIndex: 120, maxWidth: "90%", textAlign: "center" }}>
          {aviso}
        </div>
      )}

      </div>{/* fim da fila de colunas */}

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
                // OS DÍGITOS SÓ CONTAM SE HOUVER DÍGITOS (auditoria de 07/10):
                // "maria" sem dígito nenhum virava `includes("")`, que é sempre
                // verdade — a busca por nome devolvia a lista inteira.
                const digitos = q.replace(/\D/g, "");
                const lista = conversas.filter((c) => c.id !== conversaId && !c.arquivada
                  && (!q || (nomeDoContato(c.contato) || "").toLowerCase().includes(q)
                          || (digitos.length >= 3 && (c.contato?.numero || "").includes(digitos))));
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
            {!!escolhaTelefone.naoConferi && (
              <div data-escolha-nao-conferi style={{ fontSize: 12.5, color: "#c0392b", lineHeight: 1.45, marginBottom: 12 }}>
                {escolhaTelefone.naoConferi}
              </div>
            )}
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
                        : escolhaTelefone.naoConferi ? "" : " · conversa nova"}
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
                  <button key={k} onClick={() => { setMidiaAba(k); abrirMidias(k); }}
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
              {!acervo.carregando && !!acervo.erro && (
                <div data-erro-das-midias style={{ color: "#c0392b", fontSize: 14 }}>{acervo.erro}</div>
              )}
              {!acervo.carregando && !acervo.erro && acervo.cheio && (
                <div style={{ color: C.textSecondary, fontSize: 12.5, marginBottom: 10 }}>Mostrando os 500 mais recentes.</div>
              )}
              {!acervo.carregando && !acervo.erro && acervoFiltrado.length === 0 && (
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
        <Departamentos C={C} abaInicial={abaDaAdmin} aoSaberDosScripts={setScriptsDoBanco} aoFechar={() => {
          setTelaAdmin(false);
          // O QUE A ADMINISTRAÇÃO MEXE É RELIDO: os assuntos do "Já tratei" e
          // as etapas do funil eram lidos uma vez por sessão, e a mudança só
          // aparecia depois de um F5 (auditoria de 07/10).
          carregarAssuntos();
          etapasPorDep.current.clear();
          Promise.all([
            supabase.from("departamentos").select("id, nome, slug, cor, ordem").eq("ativo", true).order("ordem"),
            supabase.from("advogados").select("id, nome, numero, foto_url, departamento_id, ativo").order("nome"),
          ]).then(([d, t]) => {
            // SÓ SE GRAVA O QUE VEIO — a regra da abertura. Era `d.data || []`:
            // uma piscada de rede ao fechar esta tela esvaziava a barra de
            // telefones e dizia "nenhum número liberado" a quem administra.
            if (!d.error) setDepartamentos(d.data || []);
            else anotarFalhaDeLeitura("departamentos", "os departamentos", d.error);
            if (!t.error) setAdvogados(t.data || []);
            else anotarFalhaDeLeitura("telefones", "os telefones", t.error);
          }).catch((e) => anotarFalhaDeLeitura("telefones", "os telefones", e));
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

      {/* O FUNIL. Recebe os telefones e departamentos que esta pessoa
          ALCANÇA — um funil de um departamento que ela não atende abriria
          vazio, e vazio se lê como "ninguém". Abrir um cartão é o mesmo
          caminho do histórico: troca de telefone e abre a conversa. */}
      {telaFunil && (
        <Funil C={C} departamentos={departamentosVisiveis} advogados={advogadosPermitidos}
               souAdmin={souAdmin} departamentoInicial={departamentoId} comTarefas={temTarefas === true}
               aoAbrirConversa={(cv) => {
                 setTelaFunil(false);
                 verConversaDoHistorico({ advogadoId: cv.advogado_id, conversaId: cv.id });
               }}
               aoFechar={() => {
                 setTelaFunil(false);
                 // Quem administra pode ter mexido nas etapas: esquece o
                 // guardado e relê a etapa da conversa aberta.
                 etapasPorDep.current.clear();
                 if (temFunil === true) lerFunilDaConversa(contatoDoFunil, depDoFunil);
               }} />
      )}

      {/* A TELA DE TAREFAS (script 018). Abrir uma tarefa é o caminho do
          histórico e do funil: troca de telefone e abre a conversa. */}
      {telaTarefas && (
        <Tarefas C={C} meuId={meuId} pessoas={equipe.porId} advogados={advogadosPermitidos}
                 aoAbrirConversa={(cv) => {
                   setTelaTarefas(false);
                   verConversaDoHistorico({ advogadoId: cv.advogado_id, conversaId: cv.id });
                 }}
                 aoMudou={tarefasMudaram}
                 aoFechar={() => { setTelaTarefas(false); tarefasMudaram(); }} />
      )}

      {/* A JANELA DA TAREFA, no meio da tela — como a de editar a agendada:
          ancorada na linha do número, uma janela de 360px sairia da tela no
          celular. A conversa vai em `janelaTarefa`, e não em `conversa`:
          trocar de conversa no meio não pode mudar de quem é a tarefa. */}
      {janelaTarefa && (
        <div data-janela-tarefa-fundo onClick={() => setJanelaTarefa(null)}
             style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 230,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <NovaTarefa C={C} escuro={modo === "escuro"} meuId={meuId}
                      pessoas={pessoasParaPassar} cliente={janelaTarefa.cliente}
                      tarefa={janelaTarefa.tarefa} aoSalvar={salvarTarefa}
                      aoFechar={() => setJanelaTarefa(null)} />
        </div>
      )}

      {/* A JANELA DO "JÁ TRATEI". A conversa vai por `jaTratei`, e não por
          `conversa`: fechar a conversa no meio do preenchimento não pode
          trocar a janela por baixo de quem está marcando. */}
      {jaTratei && (
        <JaTratei C={C} estreito={estreito}
                  nome={nomeDoContato(jaTratei.contato)}
                  dias={diasEsperando(jaTratei)}
                  esperando={Boolean(jaTratei.esperando_desde)}
                  assuntos={assuntos}
                  erroDosAssuntos={erroAssuntos}
                  ocupado={trateiOcupado}
                  erro={trateiErro}
                  aoConfirmar={confirmarJaTratei}
                  aoFechar={() => { if (!trateiOcupado) { setJaTratei(null); setTrateiErro(""); } }} />
      )}
    </div>
  );
}

