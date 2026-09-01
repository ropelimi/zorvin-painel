// AS CONTAS DO ZOOM, longe da tela.
//
// PEDIDO DO ESCRITÓRIO: "ao clicar para abrir uma imagem que eu recebi ou
// enviei, preciso que tenha a opção de dar zoom para melhorar a leitura".
//
// O QUE CHEGA POR ALI. Procuração fotografada de lado, RG amassado, print de
// conversa com letra de seis pixels, comprovante de depósito, receituário
// escrito à mão. A tela abre a imagem inteira e ela cabe — e é justamente por
// caber que não dá para ler: uma foto de 3000 pixels de largura desenhada em
// 1200 perdeu dois terços do que tinha.
//
// AS CONTAS MORAM AQUI, e não no meio do JSX, por um motivo prático: zoom é
// aritmética de coordenadas, e aritmética de coordenadas erra em silêncio. Uma
// imagem que sai do lugar, que foge da tela ao ampliar, ou que "gruda" numa
// borda são todas o mesmo tipo de defeito — um sinal trocado, um centro
// esquecido — e nenhum deles aparece como erro. Aqui cada uma dessas contas
// tem nome e tem prova.

/** Tamanho normal: a imagem inteira, como ela abre. */
export const ZOOM_MIN = 1;

/** SEIS VEZES, e não mais.
 *
 *  Não é um limite de gosto: é o ponto em que o pixel da foto vira um quadrado
 *  visível e ampliar mais só embaça. Passar disso daria à pessoa a sensação de
 *  que o sistema está quebrado — ela continua apertando e a letra continua
 *  ilegível, agora maior. */
export const ZOOM_MAX = 6;

/** Parado, no centro. */
export const ZOOM_PARADO = { escala: ZOOM_MIN, x: 0, y: 0 };

/** OS DEGRAUS DOS BOTÕES, e não uma multiplicação.
 *
 *  Um "+" que multiplica por 1,2 dá 120%, 144%, 173%, 207% — números que não
 *  significam nada para quem lê e que nunca voltam a 100% redondo. Com degraus
 *  fixos, cada toque leva a um lugar previsível, e o de volta desfaz exatamente
 *  o de ida. Para quem tem 80 anos e está tentando ler um CPF, previsível vale
 *  mais do que suave. */
export const DEGRAUS = [1, 1.5, 2, 3, 4, 6];

/** Quanto o toque duplo amplia.
 *
 *  Dois é o gesto do WhatsApp e do celular inteiro: um toque duplo aproxima,
 *  outro devolve. Não é uma escolha nova a ser aprendida. */
export const ZOOM_DO_TOQUE_DUPLO = 2;

/** Nunca menor que o tamanho normal, nunca maior que o teto. */
export function limitarEscala(escala) {
  const n = Number(escala);
  if (!Number.isFinite(n)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
}

/** O degrau seguinte (`direcao` +1) ou o anterior (-1).
 *
 *  Sem dar a volta: no último, o "+" não faz nada, e é isso que o botão
 *  desabilitado na tela diz. Voltar ao começo sem aviso faria a imagem saltar
 *  de seis vezes para o tamanho normal num toque que a pessoa deu esperando
 *  ampliar. */
export function degrauSeguinte(escala, direcao) {
  const atual = limitarEscala(escala);
  const folga = 0.01;   // para 1.4999… contar como 1,5
  if (direcao > 0) {
    const acima = DEGRAUS.find((d) => d > atual + folga);
    return acima === undefined ? DEGRAUS[DEGRAUS.length - 1] : acima;
  }
  const abaixo = DEGRAUS.filter((d) => d < atual - folga);
  return abaixo.length ? abaixo[abaixo.length - 1] : DEGRAUS[0];
}

/** O que se lê no botão do meio: 100%, 150%, 200%… */
export function porcentagem(escala) {
  return Math.round(limitarEscala(escala) * 100);
}

/** ATÉ ONDE DÁ PARA ARRASTAR, num eixo.
 *
 *  A conta é a metade do que SOBRA: a imagem ampliada mede `tamanho × escala`,
 *  o buraco por onde se olha mede `visor`, e a diferença se reparte entre os
 *  dois lados. Arrastar além disso descolaria a imagem da borda e deixaria uma
 *  faixa preta entrando pelo canto — que é a aparência clássica de "quebrou".
 *
 *  O `max(0, …)` é a metade que protege: enquanto a imagem couber no visor, o
 *  limite é ZERO e ela não sai do centro. Sem ele, uma imagem menor que a tela
 *  ganharia um limite NEGATIVO, e aí nenhuma posição seria válida — a imagem
 *  ficaria presa, tremendo, no meio da tela. */
export function limiteDeArrasto(tamanhoDaImagem, tamanhoDoVisor, escala) {
  const sobra = (Number(tamanhoDaImagem) || 0) * limitarEscala(escala)
              - (Number(tamanhoDoVisor) || 0);
  return Math.max(0, sobra / 2);
}

/** A posição, presa dentro do que o arrasto permite nos dois eixos. */
export function limitarPosicao(pos, imagem, visor, escala) {
  const lx = limiteDeArrasto(imagem && imagem.largura, visor && visor.largura, escala);
  const ly = limiteDeArrasto(imagem && imagem.altura,  visor && visor.altura,  escala);
  const x = Number(pos && pos.x) || 0;
  const y = Number(pos && pos.y) || 0;
  return { x: Math.min(lx, Math.max(-lx, x)), y: Math.min(ly, Math.max(-ly, y)) };
}

/** AMPLIAR SEGURANDO UM PONTO NO LUGAR.
 *
 *  É a conta que separa um zoom que serve de um que atrapalha. Quem aperta os
 *  dedos em cima do número do CPF está dizendo "quero ver ISTO maior" — e se a
 *  imagem crescer a partir do centro, o CPF escapa para fora da tela e a pessoa
 *  tem de sair procurando o que ela estava olhando um instante antes.
 *
 *  A CONTA. Um pedaço da imagem que está a `p` do centro dela aparece na tela a
 *  `x + escala × p` do centro do visor. Se o dedo está em `a`, o pedaço debaixo
 *  dele é `p = (a − x) / escala`. Para que ele continue debaixo do dedo depois
 *  de mudar para `escala'`:
 *
 *      x' + escala' × p = a      →      x' = a − (escala'/escala) × (a − x)
 *
 *  `ponto` vem em pixels a partir do CENTRO do visor — negativo à esquerda e
 *  acima. É a mesma origem do `translate`, e ter as duas na mesma origem é o
 *  que evita o erro de sinal que faz a imagem correr para o lado errado. */
export function zoomAncorado(zoom, novaEscala, ponto, imagem, visor) {
  const de = limitarEscala(zoom && zoom.escala);
  const para = limitarEscala(novaEscala);
  const k = para / de;
  const ax = Number(ponto && ponto.x) || 0;
  const ay = Number(ponto && ponto.y) || 0;
  const x = ax - k * (ax - (Number(zoom && zoom.x) || 0));
  const y = ay - k * (ay - (Number(zoom && zoom.y) || 0));
  return { escala: para, ...limitarPosicao({ x, y }, imagem, visor, para) };
}

/** A distância entre dois dedos, para a pinça.
 *
 *  Aceita qualquer coisa com `clientX`/`clientY` — é o formato do `Touch` do
 *  navegador, e escrever a conta contra ele evita ter de montar um objeto de
 *  mentira só para poder testar. */
export function distancia(a, b) {
  const ax = Number(a && a.clientX) || 0, ay = Number(a && a.clientY) || 0;
  const bx = Number(b && b.clientX) || 0, by = Number(b && b.clientY) || 0;
  return Math.hypot(bx - ax, by - ay);
}
