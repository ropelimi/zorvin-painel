// ============================================================
//  O AVISO DE MENSAGEM NOVA — o som, e quem escolhe qual
//
//  O painel tocava um bipe só, de 880 Hz, igual para todo mundo e sem como
//  trocar. Pedido da equipe: poder escolher. Num escritório onde oito pessoas
//  sentam perto, o som de uma é o incômodo da outra — e um som que incomoda é
//  desligado no volume do computador, o que desliga junto o aviso que importa.
//
//  ------------------------------------------------------------
//  OS SONS SÃO SINTETIZADOS, E NÃO ARQUIVOS
//
//  Nenhum MP3, nenhum Storage, nenhuma ida à rede. Em 21/08 a franquia de
//  banda do Supabase zerou e o workspace foi suspenso porque cada atendente
//  rebaixava as mídias das conversas de hora em hora (ver a armadilha nº 6 do
//  CLAUDE.md da ponte). Um arquivo de som baixado por pessoa, a cada abertura,
//  é a mesma conta — pequena por vez, e somada o dia inteiro por oito pessoas.
//
//  O navegador já sabe fazer as ondas. Custa zero byte.
//
//  ------------------------------------------------------------
//  A ESCOLHA É POR NAVEGADOR, e não por conta
//
//  Guardar no banco faria a escolha seguir a pessoa entre máquinas — e faria
//  uma leitura a mais na abertura, numa tabela nova, com política nova. O som
//  é preferência de quem está sentado ali: quem atende do computador da
//  recepção e do próprio notebook provavelmente quer volumes diferentes.
//  `localStorage` responde na hora e não depende do banco estar de pé.
// ============================================================

const CHAVE = "zorvin_som_do_aviso";

/** Cada som é uma receita: as notas, e quanto cada uma dura. */
export const SONS = [
  {
    id: "toque",
    nome: "Toque",
    descricao: "O de sempre",
    notas: [{ hz: 880, em: 0, dura: 0.26, volume: 0.18 }],
  },
  {
    id: "sino",
    nome: "Sino",
    descricao: "Duas notas, subindo",
    notas: [
      { hz: 784, em: 0, dura: 0.18, volume: 0.15 },
      { hz: 1175, em: 0.12, dura: 0.30, volume: 0.15 },
    ],
  },
  {
    id: "pulso",
    nome: "Pulso",
    descricao: "Grave e curto, para quem acha o agudo estridente",
    notas: [
      { hz: 320, em: 0, dura: 0.12, volume: 0.22, forma: "triangle" },
      { hz: 320, em: 0.16, dura: 0.12, volume: 0.22, forma: "triangle" },
    ],
  },
  {
    id: "suave",
    nome: "Suave",
    descricao: "Baixo e longo, para sala silenciosa",
    notas: [{ hz: 587, em: 0, dura: 0.55, volume: 0.07, forma: "sine" }],
  },
  {
    // SEM SOM CONTINUA AVISANDO. Quem escolhe isto não está desistindo do
    // aviso — está tirando o barulho. A notificação da área de trabalho e o
    // selo de não lidas continuam valendo, e é o que separa esta opção de
    // simplesmente baixar o volume da máquina.
    id: "mudo",
    nome: "Sem som",
    descricao: "Só a notificação na tela",
    notas: [],
  },
];

export const SOM_PADRAO = "toque";

export function somEscolhido() {
  try {
    const guardado = localStorage.getItem(CHAVE);
    return SONS.some((s) => s.id === guardado) ? guardado : SOM_PADRAO;
  } catch (_) {
    // Navegador com armazenamento bloqueado (janela anônima, política da
    // máquina). Cai no padrão em vez de estourar — um aviso que não toca é
    // ruim; uma tela que não abre é pior.
    return SOM_PADRAO;
  }
}

export function guardarSom(id) {
  try { localStorage.setItem(CHAVE, id); } catch (_) { /* ver acima */ }
}

// UM CONTEXTO DE ÁUDIO SÓ, para a vida inteira da página. Criar um por toque
// esgota o limite do navegador depois de algumas dezenas de mensagens — e aí o
// aviso para de tocar sem nada dizer.
let contexto = null;

/** Toca o som escolhido (ou o pedido, na prévia da tela de ajustes). */
export function tocarAviso(qual) {
  const som = SONS.find((s) => s.id === (qual || somEscolhido()));
  if (!som || !som.notas.length) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!contexto) contexto = new AC();
    const ctx = contexto;
    // O NAVEGADOR SUSPENDE O ÁUDIO até a pessoa interagir com a página. Sem
    // este `resume`, o primeiro aviso do dia é engolido em silêncio.
    if (ctx.state === "suspended") ctx.resume();
    for (const n of som.notas) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = n.forma || "sine";
      o.frequency.value = n.hz;
      const comeca = ctx.currentTime + n.em;
      // A RAMPA EXPONENCIAL não aceita zero, e é por isso que o mínimo é
      // 0.0001: com zero, o navegador ignora a rampa e o som vira um estalo.
      g.gain.setValueAtTime(0.0001, comeca);
      g.gain.exponentialRampToValueAtTime(n.volume, comeca + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, comeca + n.dura);
      o.start(comeca);
      o.stop(comeca + n.dura + 0.01);
    }
  } catch (_) { /* silêncio se o navegador bloquear */ }
}
