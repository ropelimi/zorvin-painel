// AS VARIÁVEIS DAS MENSAGENS RÁPIDAS (08/10).
//
// Pedido do Rodrigo: a resposta pronta que diz o nome do cliente. A equipe
// escreve "{saudacao}, {nome}! Aqui é {atendente}." uma vez, e na conversa da
// Andreia, às nove da manhã, ela entra na caixa como "Bom dia, Andreia! Aqui é
// Jenifer.".
//
// O PREENCHIMENTO ACONTECE AO ESCOLHER A RÁPIDA, e não ao enviar. O texto já
// preenchido vai para a caixa de escrever, onde a pessoa o lê antes do Enter:
// o que se vê é o que sai. Preencher no envio mandaria ao cliente um texto que
// ninguém leu — e o nome que veio do WhatsApp nem sempre é nome ("Deus", "Eu",
// o nome da loja; ver `contato.js`).
//
// QUEM É O CLIENTE é o nome que aparece no alto da conversa (`nomeDoContato`):
// o da ficha, o que a equipe deu, ou o do WhatsApp, nessa ordem. Uma regra que
// a pessoa enxerga, em vez de uma segunda escolha de nome que divergiria da
// primeira. Quem chama decide o caso do grupo, que não tem "o cliente".

/** As variáveis que o Zorvin conhece, na ordem em que a tela as oferece. */
export const VARIAVEIS = [
  { chave: "saudacao", diz: "Bom dia, Boa tarde ou Boa noite, pela hora" },
  { chave: "nome", diz: "o primeiro nome do cliente" },
  { chave: "nome_completo", diz: "o nome inteiro do cliente" },
  { chave: "atendente", diz: "o primeiro nome de quem está atendendo" },
];
const CONHECIDAS = new Set(VARIAVEIS.map((v) => v.chave));

// Uma variável é o que está entre chaves, numa linha só. Chaves dobradas
// ("{{nome}}", o jeito de outros programas) também servem: sem isso sobraria
// "{Andreia}" na caixa.
const VARIAVEL = /\{\{?\s*([^{}\n]{1,40}?)\s*\}\}?/g;

/** A chave como o Zorvin a entende: sem acento, sem caixa alta, e espaço ou
 *  hífen viram "_". "{Saudação}", "{ NOME }" e "{nome completo}" funcionam:
 *  quem escreve em português põe o acento, e a variável que não pegasse por
 *  causa dele iria para o cliente com as chaves. */
export function chaveDaVariavel(bruta) {
  return String(bruta || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** O texto usa alguma variável que o Zorvin conhece? */
export function usaVariaveis(texto) {
  for (const m of String(texto ?? "").matchAll(VARIAVEL)) {
    if (CONHECIDAS.has(chaveDaVariavel(m[1]))) return true;
  }
  return false;
}

/** As variáveis que o Zorvin NÃO conhece, como foram escritas e sem
 *  repetir. Elas não são trocadas por nada: vão para o cliente com as chaves,
 *  e a tela de configuração avisa enquanto ainda dá para corrigir. */
export function variaveisDesconhecidas(texto) {
  const vistas = new Set();
  for (const m of String(texto ?? "").matchAll(VARIAVEL)) {
    if (!CONHECIDAS.has(chaveDaVariavel(m[1]))) vistas.add(m[0]);
  }
  return [...vistas];
}

// ---- O NOME ----

// O TRATAMENTO NÃO É O NOME. "Dr. João" daria "Olá, Dr!", e "Dona Maria"
// daria "Olá, Dona!" — os dois aparecem em nome de WhatsApp.
const TRATAMENTOS = new Set(["dr", "dra", "doutor", "doutora", "sr", "sra", "srta",
  "senhor", "senhora", "prof", "profa", "professor", "professora", "dona", "seu"]);
const PARTICULAS = new Set(["da", "das", "de", "di", "do", "dos", "du", "e"]);
const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** As palavras do nome: sem emoji, sem pontuação, sem tratamento. "Jô 💜"
 *  vira ["Jô"]; "+55 11 98765-4321" vira [] — número não é nome. */
function palavrasDoNome(nome) {
  return String(nome || "").normalize("NFC")
    .replace(/[^\p{L}\p{M}\s'’-]/gu, " ")
    .split(/\s+/)
    .map((p) => p.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((p) => /\p{L}/u.test(p))
    .filter((p) => !TRATAMENTOS.has(semAcento(p).toLowerCase()));
}

// A CAIXA DO NOME. O cadastro do Vantoro escreve tudo em maiúsculas
// ("ANDREIA CRISTINA MARTINS"), e "Olá, ANDREIA!" lê como grito. Só a palavra
// TODA maiúscula ou TODA minúscula é refeita: quem escreveu "McDonald" ou
// "DiCaprio" sabia o que estava escrevendo.
function comCaixaDeNome(palavra, { particula = false } = {}) {
  const baixa = palavra.toLocaleLowerCase("pt-BR");
  if (palavra !== palavra.toLocaleUpperCase("pt-BR") && palavra !== baixa) return palavra;
  if (particula) return baixa;
  return baixa.replace(/(^|['’-])(\p{L})/gu, (_, antes, letra) => antes + letra.toLocaleUpperCase("pt-BR"));
}

/** "ANDREIA CRISTINA MARTINS" → "Andreia". Inicial solta ("J. Silva") não é
 *  primeiro nome: pula para a palavra seguinte. Vazio quando não há nome. */
export function primeiroNome(nome) {
  const palavra = palavrasDoNome(nome).find((p) => [...p.replace(/['’-]/g, "")].length >= 2);
  return palavra ? comCaixaDeNome(palavra) : "";
}

/** "MARIA DAS GRAÇAS DE SOUZA" → "Maria das Graças de Souza". */
export function nomeCompleto(nome) {
  return palavrasDoNome(nome)
    .map((p, i) => comCaixaDeNome(p, { particula: i > 0 && PARTICULAS.has(p.toLocaleLowerCase("pt-BR")) }))
    .join(" ");
}

// ---- A SAUDAÇÃO ----

/** Pela hora do computador de quem atende. Depois da meia-noite ainda é "boa
 *  noite": "bom dia" às duas da manhã soa como engano. */
export function saudacaoDaHora(agora = new Date()) {
  const h = agora.getHours();
  if (h >= 5 && h < 12) return "bom dia";
  if (h >= 12 && h < 18) return "boa tarde";
  return "boa noite";
}

// MAIÚSCULA SÓ NO COMEÇO DA FRASE. "{saudacao}, {nome}!" pede "Bom dia,
// Andreia!", e "Olá, {saudacao}!" pede "Olá, bom dia!" — a mesma variável nos
// dois lugares em que ela aparece de verdade. Continua a frase quem vem logo
// depois de letra, número, vírgula ou dois-pontos; o resto (começo do texto,
// ponto, quebra de linha, emoji) abre frase nova.
function abreFrase(antes) {
  const ultimo = [...antes.replace(/[ \t]+$/, "")].pop();
  return !ultimo || !/[\p{L}\p{N},;:]/u.test(ultimo);
}
const comMaiuscula = (s) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);

// ---- O PREENCHIMENTO ----

// A MARCA DO QUE FICOU VAZIO. O cliente sem nome não pode virar "Olá, !": a
// variável vazia sai levando junto a vírgula e o espaço que a prendiam à
// frase. A marca existe para que essa limpeza mexa SÓ em volta do que foi
// tirado — fora dali o texto é de quem o escreveu, e um espaço duplo dele
// continua duplo.
const VAZIO = "\u0000";

function arrumarOsVazios(t) {
  return t
    // No começo da linha: some a pontuação colada nela, e a frase que sobra
    // começa com maiúscula. "{nome}, seu documento chegou." → "Seu documento
    // chegou."
    .replace(/(^|\n)([ \t]*)\u0000[ \t]*[,;:!.]?[ \t]*(\p{Ll})?/gu,
      (_, quebra, recuo, letra) => quebra + recuo + (letra ? letra.toLocaleUpperCase("pt-BR") : ""))
    // Antes de pontuação: vai junto a vírgula que a separava da palavra de
    // antes. "Olá, {nome}!" → "Olá!"; "Oi {nome}, tudo bem?" → "Oi, tudo bem?"
    .replace(/[ \t]*,?[ \t]*\u0000(?=[ \t]*[!?.,;:…])/g, "")
    // No meio da frase, sobra um espaço só. "Obrigado {nome} pelo contato" →
    // "Obrigado pelo contato".
    .replace(/[ \t]+\u0000(?=[ \t])/g, "")
    // No fim da linha. "Atenciosamente, {atendente}" → "Atenciosamente".
    .replace(/[ \t]*,?[ \t]*\u0000[ \t]*(?=\n|$)/g, "")
    .replace(/\u0000/g, "");
}

/** O texto da rápida como ele vai sair nesta conversa.
 *
 *  `cliente` é o nome que aparece no alto da conversa (vazio no grupo);
 *  `atendente`, o nome de quem está escrevendo; `agora`, a hora da saudação.
 *  Variável desconhecida fica como foi escrita. Texto sem variável conhecida
 *  volta IGUAL, byte por byte: a rápida de sempre não pode mudar só porque
 *  passou por aqui. */
export function preencherVariaveis(texto, { cliente = "", atendente = "", agora = new Date() } = {}) {
  const original = String(texto ?? "");
  let saida = "", desde = 0, trocou = false, esvaziou = false;
  for (const m of original.matchAll(VARIAVEL)) {
    const chave = chaveDaVariavel(m[1]);
    if (!CONHECIDAS.has(chave)) continue;
    saida += original.slice(desde, m.index);
    let valor;
    if (chave === "nome") valor = primeiroNome(cliente);
    else if (chave === "nome_completo") valor = nomeCompleto(cliente);
    else if (chave === "atendente") valor = primeiroNome(atendente);
    else {
      const s = saudacaoDaHora(agora);
      valor = abreFrase(saida) ? comMaiuscula(s) : s;
    }
    if (valor) saida += valor;
    else { saida += VAZIO; esvaziou = true; }
    desde = m.index + m[0].length;
    trocou = true;
  }
  if (!trocou) return original;
  saida += original.slice(desde);
  return esvaziou ? arrumarOsVazios(saida) : saida;
}
