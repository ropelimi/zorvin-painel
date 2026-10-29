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
//  ponte dá — que é uma frase, e não um sumiço. E a resposta seguinte conserta
//  — e desde 28/10 ela VEM: o "não consegui" não fica guardado, e a pergunta
//  é feita de novo (ver `perguntarDeNovoDepois`).
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

// A PERGUNTA QUE NÃO TEVE RESPOSTA É FEITA DE NOVO (auditoria de 28/10). Os
// 8 segundos acima não cobrem a ponte da Render acordando (~30 s), e o "não
// consegui" ficava guardado até o F5: numa instalação sem Vantoro, a primeira
// abertura do dia mostrava as telas do Vantoro o dia inteiro — o que este
// módulo existe para evitar. Agora a falha não fica guardada (como em
// `vocabulario.js`), e a pergunta volta sozinha daqui a meio minuto, quando a
// ponte já acordou com a primeira. Algumas vezes, e não para sempre: a ponte
// que caiu de vez não vira uma pergunta a cada meio minuto, de cada aba, o dia
// inteiro — e o que aparece continua aparecendo.
const DE_NOVO_EM_MS =
  (typeof globalThis !== "undefined" && globalThis.__PERGUNTAR_DE_NOVO_EM) || 30000;
const VEZES_DE_NOVO = 4;

let promessa = null;
let falhas = 0;
let deNovo = null;
// QUEM ESTÁ OLHANDO é avisado da resposta que chega depois — a do Painel foi
// pedida uma vez, na abertura, e não pergunta de novo sozinho.
const ouvintes = new Set();

function perguntarDeNovoDepois() {
  if (deNovo || falhas >= VEZES_DE_NOVO) return;
  falhas += 1;
  deNovo = setTimeout(() => {
    deNovo = null;
    perguntarSeTemVantoro().then((r) => ouvintes.forEach((f) => f(r)));
  }, DE_NOVO_EM_MS);
}

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
  const esta = fetch(BRIDGE_URL + "/vantoro/status", {
    cache: "no-store", signal: relogio.signal,
  })
    .then((r) => (r.ok ? r.json() : null))
    // `configurado` É A RESPOSTA, e `false` é a única que esconde. Qualquer
    // outra coisa — erro de rede, resposta estranha, corpo sem o campo — é
    // "não consegui", e não "não tem".
    .then((corpo) => {
      if (corpo && typeof corpo.configurado === "boolean") return corpo.configurado;
      throw new Error("a ponte não disse se tem Vantoro");
    })
    .catch(() => {
      // "NÃO CONSEGUI" MOSTRA, e não fica guardado (28/10).
      if (promessa === esta) promessa = null;
      perguntarDeNovoDepois();
      return true;
    })
    .finally(() => clearTimeout(estourou));
  promessa = esta;
  return esta;
}

/** `null` enquanto a pergunta está no ar; depois `true` ou `false`. */
export function useTemVantoro() {
  const [tem, setTem] = useState(null);
  useEffect(() => {
    let vivo = true;
    perguntarSeTemVantoro().then((r) => { if (vivo) setTem(r); });
    const ouvir = (r) => { if (vivo) setTem(r); };
    ouvintes.add(ouvir);
    return () => { vivo = false; ouvintes.delete(ouvir); };
  }, []);
  return tem;
}

// A BANCADA PRECISA ESQUECER ENTRE CENÁRIOS. A promessa guardada vale para a
// página inteira, o que é o certo em uso real — mas uma prova que abre o painel
// com Vantoro e depois sem ele leria a primeira resposta nas duas vezes, e
// passaria falando de outro assunto.
export function esquecerSeTemVantoro() {
  promessa = null;
  falhas = 0;
  if (deNovo) { clearTimeout(deNovo); deNovo = null; }
}

// ============================================================
//  O ENDEREÇO DO VANTORO NO NAVEGADOR
//
//  Para os links que abrem telas de lá: a ficha completa do cliente e o
//  Controle de atendimento (23/10). Uma escrita só, porque são dois links
//  para o mesmo lugar, e dois endereços escritos à mão divergiriam no dia em
//  que o Vantoro mudasse de casa.
//
//  `VITE_VANTORO_WEB` troca o endereço. SEM ELA, VALE O DO ESCRITÓRIO, e não
//  "o link some", como era o da ficha: daqui não dá para ver se a variável
//  está na Render, e um ícone pedido que não aparece porque falta uma
//  variável que ninguém sabe que existe é o defeito mais difícil de achar.
//  Quem não tem Vantoro não vê nenhum dos dois links (`useTemVantoro`), então
//  o endereço do escritório só é usado onde há o Vantoro do escritório.
// ============================================================
const VANTORO_NA_WEB = String(import.meta.env.VITE_VANTORO_WEB || "https://app.vantoro.com.br")
  .trim().replace(/\/+$/, "");

/** O endereço de uma tela do Vantoro: `enderecoNoVantoro("/cadastro/atendimento/")`. */
export function enderecoNoVantoro(caminho) {
  return VANTORO_NA_WEB + caminho;
}
