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
    // O PATO — pedido do Rodrigo em 25/09, refeito em 28/09.
    //
    // A PRIMEIRA VERSÃO SÓ DESCIA, e por isso saía um bipe caindo em vez de um
    // "quac". Três coisas separam um do outro, e a receita de então tinha uma:
    //
    //   onda áspera        dente de serra          já tinha
    //   contorno do tom    SOBE e depois cai       faltava
    //   ressonância        passa-FAIXA, não baixa  faltava
    //
    // O CONTORNO É O QUE MAIS IMPORTA. Num grasnado de verdade o tom salta
    // para cima num piscar e despenca — a subida é o "qua", a queda é o "c".
    // Só descendo, o ouvido lê "bipe grave"; é a mesma nota com outra pressa.
    // Por isso entrou o `pico`, alcançado em 12% da duração: rápido o
    // bastante para ser um salto, e não um portamento de sirene.
    //
    // E O FILTRO VIROU PASSA-FAIXA. O passa-baixa só abafava — tirava o
    // áspero e não punha nada no lugar. O que dá o timbre NASALADO do pato é
    // uma ressonância estreita por volta de 1 kHz, que realça os harmônicos
    // de cima e apaga o resto. O `Q` é a largura dela.
    //
    // O volume subiu junto, e não é gosto: um passa-faixa joga fora quase
    // toda a energia fora da banda, então a mesma receita com o filtro novo
    // sairia quase inaudível.
    //
    // E SÃO DOIS, porque "quac-quac" se reconhece e um "quac" sozinho, não.
    id: "pato",
    nome: "Pato",
    descricao: "Dois grasnados curtos",
    notas: [
      { hz: 240, pico: 620, ate: 190, em: 0,    dura: 0.15, volume: 0.22,
        forma: "sawtooth", filtro: 1100, filtroTipo: "bandpass", filtroQ: 2 },
      { hz: 230, pico: 560, ate: 170, em: 0.21, dura: 0.17, volume: 0.20,
        forma: "sawtooth", filtro: 1000, filtroTipo: "bandpass", filtroQ: 2 },
    ],
  },
  // ============================================================
  //  TRÊS VOZES DE PATO, PARA ESCOLHER OUVINDO
  //
  //  Relato do Rodrigo em 28/09: "o volume está bom, mas o som não está
  //  adequado — quero outra voz". Perguntado, o que incomoda é ele estar
  //  **agudo/estridente demais**.
  //
  //  A CAUSA, no pato de hoje: o passa-faixa a 1100 Hz com Q=2 ressoa
  //  justamente na banda mais irritante do ouvido, e o pico de tom vai a
  //  620 Hz. As três vozes abaixo descem os dois, cada uma por um caminho
  //  diferente — e o pato de hoje FICA na lista, para ele comparar.
  //
  //  ELAS SÃO TEMPORÁRIAS, e é por isso que os ids são novos em vez de
  //  substituírem o `pato`: quem já escolheu o pato continua com ele. Trocar
  //  o id por baixo faria `somEscolhido()` não reconhecer o guardado e cair
  //  no "Toque" — a equipe perderia a escolha sem nada dizer.
  //
  //  E A RODADA QUE TIRAR AS PERDEDORAS TEM DE LEVAR ISSO JUNTO: quem tiver
  //  escolhido uma delas cai no "Toque" pelo mesmo caminho. Ao remover, some
  //  os ids daqui a uma lista de apelidos que `somEscolhido()` traduz para o
  //  `pato` vencedor. Escrito aqui porque é o tipo de rabicho que se esquece
  //  três dias depois, e o sintoma — "meu som mudou sozinho" — não aponta
  //  para a causa.
  //
  //  OS VOLUMES NÃO FORAM ESTIMADOS. Estão medidos para sair na mesma altura
  //  do pato de hoje, que é o que ele aprovou — comparando timbres em alturas
  //  diferentes, ganha o mais alto e não o melhor. Ver `o-volume-dos-avisos`.
  // ============================================================
  {
    // GRAVE E REDONDO. Tira o passa-faixa e põe passa-baixa: sem ressonância
    // não há apito, e o que sobra é o corpo do som.
    id: "pato-grave",
    nome: "Pato 1 — grave",
    descricao: "Mais fundo, sem apito",
    notas: [
      { hz: 150, pico: 380, ate: 120, em: 0,    dura: 0.17, volume: 0.10,
        forma: "sawtooth", filtro: 800, filtroTipo: "lowpass" },
      { hz: 145, pico: 350, ate: 110, em: 0.23, dura: 0.19, volume: 0.09,
        forma: "sawtooth", filtro: 750, filtroTipo: "lowpass" },
    ],
  },
  {
    // ROUCO. Dois osciladores desafinados de propósito em cada grasnado: o
    // batimento entre eles é o que dá aspereza de bicho, que um oscilador
    // sozinho não tem. O passa-faixa continua, mas uma oitava abaixo e com
    // Q menor — ressoa sem apitar.
    id: "pato-rouco",
    nome: "Pato 2 — rouco",
    descricao: "Áspero, mais parecido com bicho",
    notas: [
      { hz: 170, pico: 430, ate: 135, em: 0,    dura: 0.15, volume: 0.16,
        forma: "sawtooth", filtro: 700, filtroTipo: "bandpass", filtroQ: 1.1 },
      { hz: 181, pico: 458, ate: 144, em: 0,    dura: 0.15, volume: 0.13,
        forma: "sawtooth", filtro: 700, filtroTipo: "bandpass", filtroQ: 1.1 },
      { hz: 165, pico: 405, ate: 128, em: 0.22, dura: 0.17, volume: 0.15,
        forma: "sawtooth", filtro: 660, filtroTipo: "bandpass", filtroQ: 1.1 },
      { hz: 176, pico: 432, ate: 137, em: 0.22, dura: 0.17, volume: 0.12,
        forma: "sawtooth", filtro: 660, filtroTipo: "bandpass", filtroQ: 1.1 },
    ],
  },
  {
    // MACIO. Onda triangular, que quase não tem harmônico agudo: é o mais
    // longe possível de estridente, ao preço de soar menos "bicho". Está
    // aqui como o extremo oposto do de hoje — comparar com um extremo é o
    // que faz o do meio ficar evidente.
    id: "pato-macio",
    nome: "Pato 3 — macio",
    descricao: "O menos incômodo dos três",
    notas: [
      // O 0,077 SAIU DA MEDIÇÃO, e o meu palpite era 0,16 — mais que o
      // DOBRO. A onda triangular parecia a mais fraca das três por ter
      // poucos harmônicos, e é o contrário: o passa-baixa quase não tira
      // nada dela, enquanto corta metade da dente de serra. A prova
      // `o-volume-dos-avisos` pegou, com 2,08x.
      { hz: 200, pico: 470, ate: 155, em: 0,    dura: 0.16, volume: 0.077,
        forma: "triangle", filtro: 1000, filtroTipo: "lowpass" },
      { hz: 190, pico: 440, ate: 145, em: 0.22, dura: 0.18, volume: 0.072,
        forma: "triangle", filtro: 950, filtroTipo: "lowpass" },
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

// ============================================================
//  A MONTAGEM DO SOM SAIU DE DENTRO DO "TOCAR"
//
//  Não é arrumação: é o que permite MEDIR o volume em vez de estimá-lo.
//
//  O pato de 25/09 saiu com o volume no chute, porque quem escreve o som aqui
//  não o ouve. Em 28/09 o Rodrigo disse que o volume estava bom e o timbre
//  não — e para comparar timbres é preciso que todos toquem na MESMA altura,
//  senão a escolha é do mais alto, e não do que soa melhor.
//
//  Com a montagem numa função só, a prova `o-volume-dos-avisos` desenha o
//  mesmo grafo num `OfflineAudioContext`, lê as amostras e mede. Uma segunda
//  cópia da montagem dentro da prova mediria uma receita que não é a que
//  toca — que é o jeito de um teste não testar nada.
// ============================================================
export function montarSom(ctx, som, base = 0) {
  for (const n of som.notas) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    // O FILTRO TAMBÉM SÓ EXISTE PARA QUEM PEDE, e pela mesma razão: sem
    // `filtro`, a ligação é a de sempre — oscilador direto no volume.
    if (n.filtro) {
      const f = ctx.createBiquadFilter();
      // PASSA-BAIXA CONTINUA SENDO O PADRÃO, para nenhuma receita antiga
      // mudar de som só porque este campo passou a existir.
      f.type = n.filtroTipo || "lowpass";
      f.frequency.value = n.filtro;
      // O `Q` É A LARGURA DA RESSONÂNCIA, e só vale para o passa-faixa: é
      // ele que transforma "um filtro" em "um timbre". Sem pedido, fica o
      // padrão do navegador.
      if (n.filtroQ) f.Q.value = n.filtroQ;
      o.connect(f); f.connect(g);
    } else {
      o.connect(g);
    }
    g.connect(ctx.destination);
    o.type = n.forma || "sine";
    o.frequency.value = n.hz;
    const comeca = base + n.em;
    // O CONTORNO DE TOM, quando a receita pede. Sem `ate` nada disto roda, e
    // os quatro sons de sempre saem byte por byte como saíam.
    //
    // COM `pico`, SÃO DUAS RAMPAS: sobe depressa até ele e cai até o `ate`.
    // É o que faz um "quac" em vez de um bipe caindo — e o 0.12 é o que
    // torna a subida um SALTO; esticada, ela vira sirene.
    if (n.ate) {
      o.frequency.setValueAtTime(n.hz, comeca);
      if (n.pico) o.frequency.exponentialRampToValueAtTime(n.pico, comeca + n.dura * 0.12);
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
}

/** Quanto tempo o som inteiro dura, para a medição saber o que renderizar. */
export function duracaoDoSom(som) {
  return (som.notas || []).reduce((t, n) => Math.max(t, n.em + n.dura + 0.02), 0);
}

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
    montarSom(ctx, som, ctx.currentTime);
  } catch (_) { /* silêncio se o navegador bloquear */ }
}
