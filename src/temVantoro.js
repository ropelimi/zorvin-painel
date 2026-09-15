import { useEffect, useState } from "react";
import { BRIDGE_URL } from "./ponte.js";

// ============================================================
//  EXISTE VANTORO NESTA INSTALAÇÃO?
//
//  Seis lugares da tela só fazem sentido com Vantoro: a ficha do cliente, a
//  busca de cadastro dentro de "Nova conversa", a mesma busca dentro da busca
//  geral, a nota que sobe para a ficha, a aba "Notas no Vantoro" e o aviso de
//  quem tem cadastro mas ainda não tem conversa.
//
//  Sem Vantoro, os seis ficavam lá: um botão que abre uma coluna vazia, um
//  "Procurando no Vantoro…" que nunca termina em nada, uma aba que não faz
//  nada. Quem compra o programa não sabe que aquilo é integração de outro
//  cliente — para ele é o programa quebrado.
//
//  ------------------------------------------------------------
//  QUEM RESPONDE É A PONTE, e não uma variável do painel
//
//  `VANTORO_API_URL` + `VANTORO_API_TOKEN` moram lá. Uma variável daqui
//  poderia ser posta em desacordo com elas — e aí a tela esconderia a ficha
//  numa instalação que tem Vantoro, ou ofereceria uma que a ponte recusa. É a
//  mesma razão pela qual a aba de atendentes aprende pelo `com_vantoro` que a
//  ponte devolve (ver "A equipe sem Vantoro" no CLAUDE.md).
//
//  `GET /vantoro/status` já existia, aberta e com CORS, e ninguém a chamava.
//  Ela responde só `configurado: true|false` — não passa cadastro por ali.
//
//  ------------------------------------------------------------
//  PERGUNTA-SE UMA VEZ POR ABERTURA, e não uma vez por tela
//
//  Os seis lugares perguntariam cada um por si, e a ponte hiberna no plano
//  gratuito da Render: seis idas à rede para a mesma resposta, a primeira
//  delas custando meio minuto. A promessa fica guardada no módulo e todo mundo
//  espera a MESMA.
//
//  ------------------------------------------------------------
//  TRÊS ESTADOS, E NÃO DOIS — é o que separa "não tem" de "não consegui"
//
//    null   ainda não perguntei     -> esconde
//    false  respondeu que não tem   -> esconde
//    true   tem, ou NÃO CONSEGUI    -> mostra
//
//  O terceiro é o que importa. Tratar a falha como "não tem" faria o
//  escritório perder a ficha, a busca de cadastro e a subida da nota sempre
//  que a ponte tossisse — sem uma palavra na tela dizendo por quê. É
//  exatamente a armadilha nº 2 do CLAUDE.md: em 04/09 as etiquetas sumiram de
//  todas as conversas assim, desenhando AUSÊNCIA no lugar de FALHA, e o
//  diagnóstico custou três rodadas.
//
//  Mostrando, o pior caso é alguém abrir a ficha e ler o erro que a própria
//  ponte dá — que é uma frase, e não um sumiço. E a resposta seguinte conserta.
//
//  E o primeiro estado é diferente do terceiro de propósito: enquanto a
//  pergunta está no ar ninguém errou nada ainda, então esconder é barato e a
//  resposta chega. Começar mostrando faria o botão piscar e sumir na tela de
//  quem não tem Vantoro — e botão que some sozinho é o que faz alguém achar
//  que clicou errado.
// ============================================================

// Quanto se espera. A ponte hiberna, mas esta pergunta não pode segurar a tela:
// passando disso ela vira "não consegui", que é o estado que MOSTRA — então o
// escritório não perde nada por causa da espera.
const ESPERA_MS = 8000;

let promessa = null;

/** Pergunta à ponte, uma vez por abertura do painel. */
export function perguntarSeTemVantoro() {
  if (promessa) return promessa;
  if (!BRIDGE_URL) {
    // Sem endereço da ponte não há o que perguntar, e não há como saber. Isto é
    // "não consegui", e não "não tem": o painel sem `VITE_BRIDGE_URL` está
    // quebrado de outro jeito, e já diz isso em outro lugar.
    promessa = Promise.resolve(true);
    return promessa;
  }
  const relogio = new AbortController();
  const estourou = setTimeout(() => relogio.abort(), ESPERA_MS);
  promessa = fetch(BRIDGE_URL + "/vantoro/status", {
    cache: "no-store", signal: relogio.signal,
  })
    .then((r) => (r.ok ? r.json() : null))
    // `configurado === false` é a única resposta que esconde. Qualquer outra
    // coisa — erro de rede, resposta estranha, corpo sem o campo — é "não
    // consegui", e não "não tem".
    .then((corpo) => (corpo && corpo.configurado === false ? false : true))
    .catch(() => true)
    .finally(() => clearTimeout(estourou));
  return promessa;
}

/** `null` enquanto a pergunta está no ar; depois `true` ou `false`. */
export function useTemVantoro() {
  const [tem, setTem] = useState(null);
  useEffect(() => {
    let vivo = true;
    perguntarSeTemVantoro().then((r) => { if (vivo) setTem(r); });
    return () => { vivo = false; };
  }, []);
  return tem;
}

// A BANCADA PRECISA ESQUECER ENTRE CENÁRIOS. A promessa guardada vale para a
// página inteira, o que é o certo em uso real — mas uma prova que abre o painel
// com Vantoro e depois sem ele leria a primeira resposta nas duas vezes, e
// passaria falando de outro assunto.
export function esquecerSeTemVantoro() { promessa = null; }
