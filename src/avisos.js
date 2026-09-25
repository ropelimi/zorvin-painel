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
    // O PATO — pedido do Rodrigo em 25/09.
    //
    // ELE NÃO É UMA NOTA PARADA, e é por isso que o formato da receita cresceu.
    // Um grasnado é uma DESCIDA de tom: começa agudo e cai depressa. Tocado
    // como as outras quatro — uma frequência fixa —, sai um bipe grave e não um
    // pato. O `ate` é essa descida, e o `filtro` tira o áspero da onda dente de
    // serra, que sozinha soa mais a campainha quebrada do que a bicho.
    //
    // E SÃO DOIS, porque "quá-quá" se reconhece e um "quá" sozinho, não.
    id: "pato",
    nome: "Pato",
    descricao: "Dois grasnados curtos",
    notas: [
      { hz: 560, ate: 250, em: 0, dura: 0.16, volume: 0.13, forma: "sawtooth", filtro: 1600 },
      { hz: 500, ate: 200, em: 0.22, dura: 0.20, volume: 0.12, forma: "sawtooth", filtro: 1400 },
    ],
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

// ============================================================
//  A TARJA DO SISTEMA TEM CHAVE PRÓPRIA
//
//  Pedido do Rodrigo em 25/09: poder desligar as notificações que aparecem
//  quando chega mensagem.
//
//  ELA NÃO É O "SEM SOM", E NÃO PODIA SER. "Sem som" tira o barulho e deixa a
//  tarja; esta tira a tarja e deixa o barulho. São duas incomodações
//  diferentes, e quem trabalha de fone quer justamente o contrário de quem
//  senta numa sala silenciosa. Uma opção só obrigaria a desligar as duas para
//  se livrar de uma.
//
//  O SELO VERDE DE NÃO LIDAS CONTINUA nos dois casos — ele não faz barulho
//  nem cobre a tela, e é o que garante que nada se perca de vez. Desligar o
//  aviso é escolher não ser interrompido, e não escolher não ser avisado.
//
//  O PADRÃO É LIGADO. Quem nunca abriu esta tela continua sendo avisado como
//  sempre foi; desligar é uma escolha, e não o estado em que o programa chega.
//
//  Por navegador, como o som: é preferência de quem está sentado ali, responde
//  na hora, e não depende de o banco estar de pé.
// ============================================================
const CHAVE_TARJA = "zorvin_aviso_na_tela";

export function avisoNaTelaLigado() {
  try {
    // SÓ O "nao" ESCRITO DESLIGA. Armazenamento vazio — primeira abertura,
    // janela anônima, cache limpo — é "ninguém escolheu ainda", e isso é
    // LIGADO. Tratar a ausência como desligado calaria o aviso de quem nunca
    // pediu para calá-lo, que é o contrário do que esta chave existe para dar.
    return localStorage.getItem(CHAVE_TARJA) !== "nao";
  } catch (_) {
    return true;
  }
}

export function guardarAvisoNaTela(ligado) {
  try { localStorage.setItem(CHAVE_TARJA, ligado ? "sim" : "nao"); } catch (_) { /* ver acima */ }
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
      // O FILTRO TAMBÉM SÓ EXISTE PARA QUEM PEDE, e pela mesma razão: sem
      // `filtro`, a ligação é a de sempre — oscilador direto no volume.
      if (n.filtro) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = n.filtro;
        o.connect(f); f.connect(g);
      } else {
        o.connect(g);
      }
      g.connect(ctx.destination);
      o.type = n.forma || "sine";
      o.frequency.value = n.hz;
      const comeca = ctx.currentTime + n.em;
      // A DESCIDA DE TOM, quando a receita pede. Sem `ate` nada disto roda, e
      // os quatro sons de sempre saem byte por byte como saíam.
      if (n.ate) {
        o.frequency.setValueAtTime(n.hz, comeca);
        o.frequency.exponentialRampToValueAtTime(n.ate, comeca + n.dura);
      }
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
