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
    // ============================================================
    //  O PATO É UMA GRAVAÇÃO, E ISSO FOI UMA RENDIÇÃO MEDIDA
    //
    //  Quatro tentativas de sintetizar um grasnado, quatro reprovadas pelo
    //  Rodrigo — e a última rodada, com TRÊS vozes de uma vez, saiu pior do
    //  que a primeira. A causa não é ajuste de número: um oscilador com
    //  filtro faz tom moldado, e um grasnado de verdade é em boa parte
    //  CHIADO, que nenhum oscilador produz. Insistir era continuar na família
    //  "campainha" e gastar as tentativas de quem tem de ouvir por mim.
    //
    //  Em 28/09 ele mandou o som que quer. Quando quem escreve o som não pode
    //  ouvi-lo, essa é a única forma de acertar.
    //
    //  ------------------------------------------------------------
    //  O ARQUIVO NÃO É O QUE VEIO — foi medido e cortado
    //
    //    3,0 s      o que chegou; o grasnado vai de 0,22 s a 0,39 s
    //    94%        do arquivo era SILÊNCIO
    //    estéreo    inútil num aviso, e o dobro do tamanho
    //    pico 0,94  perto de estourar, contra 0,07–0,20 dos outros avisos
    //
    //  Ficou: 185 ms, mono, 22 kHz, **8 KB**.
    //
    //  ------------------------------------------------------------
    //  E É UM "QUÁ" SÓ — decisão do Rodrigo, contra o que estava escrito aqui
    //
    //  Desde 25/09 este arquivo dizia, em três lugares, que *"quá-quá se
    //  reconhece e quá sozinho não"*. Era raciocínio meu sobre um som que eu
    //  não ouço; em 28/09 ele ouviu a gravação repetida e pediu um só.
    //
    //  Fica escrito porque a frase antiga era categórica: quem ler isto daqui
    //  a seis meses e achar que "faltou o segundo" encontra a resposta aqui,
    //  em vez de repor um grasnado que foi tirado de propósito. `repeticoes`
    //  continua existindo, com um item — é o que permite voltar atrás numa
    //  linha, se ele mudar de ideia.
    //
    //  ------------------------------------------------------------
    //  POR QUE UM ARQUIVO NÃO REPETE O DESASTRE DE 21/08
    //
    //  Lá a franquia do Supabase zerou porque cada atendente rebaixava fotos
    //  e áudios DAS CONVERSAS de hora em hora (armadilha nº 6 do CLAUDE.md da
    //  ponte). Aqui são 8 KB servidos pelo PRÓPRIO site — não passa pelo
    //  Supabase —, baixados uma vez e guardados pelo navegador até a próxima
    //  publicação. E só por quem escolhe o pato: a busca acontece no primeiro
    //  toque, e não na abertura do painel.
    //
    //  A régua que fica: som de aviso PODE ser arquivo, desde que seja
    //  servido daqui, pequeno, e buscado só quando for usado.
    //
    //  ------------------------------------------------------------
    //  AS `notas` CONTINUAM AQUI, E VIRARAM O ENCOSTO
    //
    //  Não são sobra do que não deu certo. Falhando a busca — rede caída,
    //  publicação pela metade, navegador bloqueando —, o aviso sai
    //  sintetizado em vez de NÃO SAIR. Um aviso mudo é indistinguível de
    //  "ninguém escreveu", que é o defeito que esta casa persegue desde
    //  04/09.
    // ============================================================
    id: "pato",
    nome: "Pato",
    descricao: "Um grasnado curto",
    arquivo: "/avisos/pato.wav",
    // UM GRASNADO SÓ — ver acima: é decisão do Rodrigo, de 28/09.
    repeticoes: [0],
    // MEDIDO, e não estimado — e é a SEGUNDA vez que a medição me corrige
    // aqui. Estimei 0,12 e a gravação saiu 2,35x mais alta que o encosto; na
    // rodada anterior eu tinha errado o pato-macio por 2,08x, para o outro
    // lado. Ouvido não se substitui por intuição, e a prova
    // `o-volume-dos-avisos` é o que faz as vezes dele.
    volume: 0.051,
    // O ENCOSTO TAMBÉM PERDEU O SEGUNDO GRASNADO. Deixá-lo com dois faria a
    // falha do arquivo devolver exatamente o que ele pediu para tirar — e
    // ninguém ligaria uma coisa à outra.
    notas: [
      { hz: 240, pico: 620, ate: 190, em: 0, dura: 0.15, volume: 0.22,
        forma: "sawtooth", filtro: 1100, filtroTipo: "bandpass", filtroQ: 2 },
    ],
  },
  // ============================================================
  //  A GALINHA (01/10) — um "pó" só, e SÓ A VOZ
  //
  //  Pedido do Rodrigo depois do pato. Ele mandou um trecho de 4,45 s do
  //  clipe "Pó Pó Pó" e pediu um "pó" só — e depois, ouvindo, pediu SÓ A VOZ,
  //  sem a música de fundo.
  //
  //  A MÚSICA SAIU POR UM SEPARADOR DE VOZ, e não por filtro. A voz e a
  //  música ocupam as mesmas frequências (as notas da música são as linhas
  //  retas do espectro, em 1, 2, 3,4 kHz…); um filtro que tirasse as notas
  //  tiraria a voz junto. O separador (UVR, modelo Kim_Vocal_2) foi treinado
  //  para isso e devolve as duas faixas.
  //
  //  E ELE CORRIGIU UMA LEITURA MINHA. O trecho tem dois "pó" alternados, e
  //  eu tinha suposto que os dois eram a galinha. A faixa da voz trouxe só o
  //  de ataque seco: o "ó" grave era INSTRUMENTO. Dos sete "pó" da voz,
  //  ficou o de 0,91 s — o que tinha mais voz e menos música no original
  //  (63%, contra 41% do que eu tinha usado antes) e que começa depois de
  //  silêncio. A receita é `sons/cortar-a-galinha.py`.
  //
  //  O VOLUME SAI DO PATO, que é o volume que ele aprovou. E ela tem o seu
  //  ENCOSTO sintetizado, pela régua do pato: falhando a busca, sai um som
  //  parecido em vez de silêncio.
  //
  //  VACA, PORCO E GATO SAÍRAM, e ficam escritos aqui para não voltarem do
  //  mesmo jeito: foram sintetizados por mim, fora do navegador, por
  //  fonte-e-filtro (pregas vocais + ressonâncias da boca), e o Rodrigo não
  //  gostou. É a quinta tentativa de sintetizar bicho, depois das quatro do
  //  pato, e a régua continua a mesma: quem não ouve o som não o fabrica —
  //  pede a gravação.
  // ============================================================
  {
    id: "galinha",
    nome: "Galinha",
    descricao: "Um “pó” só",
    arquivo: "/avisos/galinha.wav",
    repeticoes: [0],
    volume: 0.0697,
    notas: [
      { hz: 420, pico: 640, ate: 360, em: 0, dura: 0.2, volume: 0.19,
        forma: "sawtooth", filtro: 1000, filtroTipo: "bandpass", filtroQ: 1.5 },
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

// AS VOZES QUE NÃO FICARAM CONTINUAM SENDO ENTENDIDAS.
//
// Em 28/09 a tela ofereceu três patos candidatos, e eles saíram no dia
// seguinte. Quem tivesse escolhido um deles cairia no "Toque" em silêncio —
// `somEscolhido()` não reconheceria o id guardado e usaria o padrão. Trocar o
// som de alguém sem avisar é pequeno e é exatamente o tipo de coisa que
// ninguém liga à causa: o sintoma é "meu som mudou sozinho".
//
// Traduzir custa três linhas e vale para sempre; a lista só cresce quando um
// id sai de circulação.
const APELIDOS = {
  "pato-grave": "pato",
  "pato-rouco": "pato",
  "pato-macio": "pato",
};

export function somEscolhido() {
  try {
    const guardado = APELIDOS[localStorage.getItem(CHAVE)] || localStorage.getItem(CHAVE);
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
// ============================================================
//  A GRAVAÇÃO É BUSCADA UMA VEZ, E SÓ SE FOR USADA
//
//  A promessa fica guardada: quem escolheu o pato busca 8 KB no primeiro
//  toque do dia e mais nada; quem nunca o escolheu não busca nada. Guardar a
//  PROMESSA, e não o resultado, é o que impede duas mensagens quase juntas de
//  dispararem duas buscas.
//
//  A CHAVE LEVA A TAXA DE AMOSTRAGEM do contexto: a decodificação reamostra
//  para a taxa de quem pediu, e a prova mede num contexto de 44,1 kHz
//  enquanto a máquina de quem atende costuma ser de 48. Uma chave só devolveria
//  o áudio na taxa errada para o segundo a pedir.
//
//  FALHA VIRA `null`, E NÃO ERRO. Quem chamou cai na receita sintetizada — um
//  aviso pior é melhor do que aviso nenhum, e aviso nenhum se parece com
//  "ninguém escreveu".
// ============================================================
const gravados = new Map();

export function carregarGravado(ctx, som) {
  if (!som || !som.arquivo) return Promise.resolve(null);
  const chave = `${som.arquivo}@${ctx.sampleRate}`;
  if (!gravados.has(chave)) {
    gravados.set(chave, fetch(som.arquivo)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((dados) => ctx.decodeAudioData(dados))
      .catch((e) => {
        // UMA LINHA NO CONSOLE, e não silêncio: sem ela, "o pato virou bipe"
        // seria um mistério. É a mesma régua da faixa do tempo real.
        console.error("[zorvin] não consegui carregar o som do aviso:", som.arquivo, e);
        return null;
      }));
  }
  return gravados.get(chave);
}

export function montarSom(ctx, som, base = 0, gravado = null) {
  // O CAMINHO DA GRAVAÇÃO. Sem ela — porque a receita não tem arquivo, ou
  // porque a busca falhou —, segue o de sempre, logo abaixo.
  if (gravado) {
    for (const em of (som.repeticoes || [0])) {
      const fonte = ctx.createBufferSource();
      const g = ctx.createGain();
      fonte.buffer = gravado;
      fonte.connect(g); g.connect(ctx.destination);
      g.gain.value = som.volume == null ? 1 : som.volume;
      fonte.start(base + em);
    }
    return;
  }
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
export function duracaoDoSom(som, gravado = null) {
  if (gravado) {
    return (som.repeticoes || [0]).reduce((t, em) => Math.max(t, em + gravado.duration + 0.02), 0);
  }
  return (som.notas || []).reduce((t, n) => Math.max(t, n.em + n.dura + 0.02), 0);
}

/** Toca o som escolhido (ou o pedido, na prévia da tela de ajustes). */
export function tocarAviso(qual) {
  const som = SONS.find((s) => s.id === (qual || somEscolhido()));
  if (!som || (!som.notas.length && !som.arquivo)) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!contexto) contexto = new AC();
    const ctx = contexto;
    // O NAVEGADOR SUSPENDE O ÁUDIO até a pessoa interagir com a página. Sem
    // este `resume`, o primeiro aviso do dia é engolido em silêncio.
    if (ctx.state === "suspended") ctx.resume();
    // COM ARQUIVO, O TOQUE ESPERA A BUSCA — e só na primeira vez do dia, que
    // são 8 KB. Adiantar a busca para a abertura do painel faria todo mundo
    // baixar o pato, inclusive quem nunca vai escolhê-lo.
    if (som.arquivo) {
      carregarGravado(ctx, som)
        .then((gravado) => montarSom(ctx, som, ctx.currentTime, gravado))
        .catch(() => { /* o encosto já está dentro de carregarGravado */ });
      return;
    }
    montarSom(ctx, som, ctx.currentTime);
  } catch (_) { /* silêncio se o navegador bloquear */ }
}
