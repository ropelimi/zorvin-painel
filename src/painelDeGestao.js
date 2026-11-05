// ============================================================
//  O PAINEL DE GESTÃO (05/11) — as contas que não precisam de tela
//
//  Pedido do Rodrigo: "preciso que essa tela seja um Dashboard interativo
//  onde eu consiga acessar os dados mais relevantes sobre o atendimento
//  individual de cada usuário, com a possibilidade de imprimir um relatório."
//
//  O ATENDIMENTO DE CADA PESSOA ESTAVA EM QUATRO TABELAS, cada uma no fim de
//  uma seção: o ranking do Painel (atendimentos, enviadas, tempos), o "por
//  pessoa" dos protocolos (primeiras respostas e finalizações), o "por
//  pessoa" do "Já tratei" e a carteira de cada responsável. Quem queria saber
//  como a Jenifer foi no mês rolava a tela quatro vezes e juntava de cabeça.
//  `juntarAEquipe` junta as quatro numa linha por pessoa, pelo id dela.
//
//  NADA AQUI CONTA NADA DO BANCO: cada número vem somado da sua função (a
//  régua da tela inteira — a API corta em mil linhas sem avisar). Aqui só se
//  junta, se ordena e se compara.
// ============================================================

/** As colunas da tabela da equipe, na ordem da tela. `fonte` diz de qual
 *  leitura cada uma sai: a coluna de uma fonte que não veio não aparece, e a
 *  tela diz qual faltou. `menorMelhor` é o tempo: no ranking, o mais rápido
 *  vem primeiro.
 *
 *  `base` é QUEM ENTRA NA MEDIANA E NA POSIÇÃO, e é o que faz a comparação
 *  servir para alguma coisa: na tabela aparece quem fez QUALQUER coisa no
 *  período, e a mediana dos atendimentos contando quem só marcou "Já tratei"
 *  daria zero — comparar alguém com zero não diz nada.
 *    - "fez": quem tem o número maior que zero (fez aquilo no período);
 *    - "tem": quem tem o número (o tempo: quem não respondeu ninguém não tem);
 *    - "carteira": quem tem carteira (o "há 3+ dias" de quem tem conversa).
 *  `semPosicao`: a carteira é volume de trabalho, e não desempenho — "1º de
 *  5" se leria como o melhor, e é só o maior. */
export const COLUNAS_DA_EQUIPE = [
  { id: "atendimentos", fonte: "painel", rotulo: "Atendimentos", tipo: "numero", base: "fez",
    ajuda: "Trechos de conversa que a pessoa pegou (a primeira resposta foi dela), no período." },
  { id: "enviadas", fonte: "painel", rotulo: "Enviadas", tipo: "numero", base: "fez",
    ajuda: "Mensagens que a pessoa mandou no período." },
  { id: "resposta", fonte: "painel", rotulo: "Resposta", tipo: "tempo", menorMelhor: true, base: "tem",
    ajuda: "Mediana do tempo entre o cliente escrever e esta pessoa responder." },
  { id: "espera", fonte: "painel", rotulo: "Atender", tipo: "tempo", menorMelhor: true, base: "tem",
    ajuda: "Mediana do tempo entre o atendimento começar e esta pessoa pegá-lo." },
  { id: "primeiras", fonte: "protocolos", rotulo: "1ª resposta", tipo: "numero", base: "fez",
    ajuda: "Protocolos que o cliente abriu e em que a primeira resposta foi desta pessoa." },
  { id: "finalizou", fonte: "protocolos", rotulo: "Finalizou", tipo: "numero", base: "fez",
    ajuda: "Protocolos que esta pessoa finalizou no período." },
  { id: "tratados", fonte: "tratados", rotulo: "Já tratei", tipo: "numero", base: "fez",
    ajuda: "Vezes que a pessoa marcou “Já tratei” no período (os desfeitos não contam)." },
  { id: "carteira", fonte: "carteira", rotulo: "Carteira", tipo: "numero", base: "fez", semPosicao: true,
    ajuda: "Conversas em que a pessoa é a responsável, agora (não usa o período)." },
  { id: "atrasadas", fonte: "carteira", rotulo: "Há 3+ dias", tipo: "numero", alerta: true, base: "carteira", semPosicao: true,
    ajuda: "Conversas da carteira em que o cliente espera resposta há 3 dias ou mais, agora." },
];

const NOMES_DAS_FONTES = {
  painel: "os atendimentos e as mensagens",
  protocolos: "os protocolos",
  tratados: "o “Já tratei”",
  carteira: "a carteira",
};

const vazia = (chave) => ({
  chave, id: null, nome: "", pelonome: false, sou: false, temPainel: false,
  atendimentos: null, enviadas: null, resposta: null, espera: null,
  primeiras: null, primeiraMediana: null, finalizou: null, finalizarMediana: null,
  tratados: null, carteira: null, esperando: null, atrasadas: null, maisAntiga: null, naoLidas: null,
});

const n = (v) => (v == null || v === "" ? null : Number(v));

/** AS QUATRO FONTES, UMA LINHA POR PESSOA.
 *
 *  `fontes` diz quais leituras vieram (`painel`, `protocolos`, `tratados`,
 *  `carteira`): `true` quando a fonte traz TODO MUNDO, e `"parcial"` quando
 *  traz só quem pergunta (a carteira de quem não administra: o banco devolve
 *  só a linha dela). Numa fonte inteira, a pessoa sem linha nela tem ZERO (não
 *  fez nada daquilo no período); numa que não veio, `null` — e a tela escreve
 *  "—", e não um zero que se leria como "não fez nada". Na parcial, só quem
 *  pergunta ganha o zero: a colega que não aparece na carteira de quem não
 *  administra não tem carteira zero, a carteira dela só não veio.
 *
 *  O que não é pessoa fica de fora, e é contado à parte (`foraDaTabela`): as
 *  primeiras respostas mandadas pelo celular (não dá para saber quem estava
 *  com o aparelho) e as de rótulo. A linha "pelo nome" do Painel (mensagens
 *  antigas, sem id) entra, marcada, e não junta com ninguém: o nome não é a
 *  pessoa. */
export function juntarAEquipe({ painel = [], protocolos = [], tratados = [], carteira = [], fontes = {}, meuId = null }) {
  const linhas = new Map();
  const linhaDe = (chave) => {
    if (!linhas.has(chave)) linhas.set(chave, vazia(chave));
    return linhas.get(chave);
  };
  const nomear = (l, nome) => { if (!l.nome && nome) l.nome = String(nome); };
  const foraDaTabela = { celular: 0, outros: 0 };

  if (fontes.painel) {
    for (const p of painel || []) {
      const chave = p.id ? `id:${p.id}` : `nome:${p.nome || "(sem nome)"}`;
      const l = linhaDe(chave);
      if (p.id) l.id = String(p.id); else l.pelonome = true;
      nomear(l, p.nome);
      l.temPainel = true;
      l.atendimentos = n(p.atendimentos) || 0;
      l.enviadas = n(p.enviadas) || 0;
      l.resposta = n(p.resposta_mediana);
      l.espera = n(p.espera_mediana);
    }
  }
  if (fontes.protocolos) {
    for (const p of protocolos || []) {
      if (p.tipo && p.tipo !== "pessoa") {
        const qtos = (n(p.primeiras) || 0) + (n(p.finalizou) || 0);
        if (p.tipo === "celular") foraDaTabela.celular += qtos; else foraDaTabela.outros += qtos;
        continue;
      }
      if (!p.id) continue;
      const l = linhaDe(`id:${p.id}`);
      l.id = String(p.id);
      nomear(l, p.nome);
      l.primeiras = n(p.primeiras) || 0;
      l.primeiraMediana = n(p.primeira_mediana);
      l.finalizou = n(p.finalizou) || 0;
      l.finalizarMediana = n(p.finalizar_mediana);
    }
  }
  if (fontes.tratados) {
    for (const p of tratados || []) {
      if (!p.id) continue;
      const l = linhaDe(`id:${p.id}`);
      l.id = String(p.id);
      nomear(l, p.nome);
      l.tratados = n(p.tratamentos) || 0;
    }
  }
  if (fontes.carteira) {
    for (const p of carteira || []) {
      if (!p.id) continue;
      const l = linhaDe(`id:${p.id}`);
      l.id = String(p.id);
      nomear(l, p.nome);
      l.carteira = n(p.conversas) || 0;
      l.esperando = n(p.esperando) || 0;
      l.atrasadas = n(p.atrasadas) || 0;
      l.maisAntiga = p.mais_antiga || null;
      l.naoLidas = n(p.nao_lidas) || 0;
    }
  }

  // QUEM APARECE NUMA FONTE E NÃO NA OUTRA tem zero na outra, se ela veio
  // INTEIRA. O tempo fica vazio: quem não respondeu ninguém não tem tempo de
  // resposta, e zero seria "respondeu na hora".
  //
  // A FONTE PARCIAL traz só quem pergunta: sem linha nela, quem pergunta não
  // tem nada ali (a carteira vazia é zero, e não "—"), e os colegas continuam
  // sem número — a carteira deles só não veio.
  const zerar = (l) => {
    for (const c of COLUNAS_DA_EQUIPE) {
      if (c.tipo === "tempo" || l[c.id] != null) continue;
      const veio = fontes[c.fonte];
      if (veio !== true && !(veio === "parcial" && l.sou)) continue;
      if (l.pelonome && c.fonte !== "painel") continue;
      l[c.id] = 0;
    }
  };
  const todas = [...linhas.values()];
  for (const l of todas) {
    l.sou = Boolean(meuId && l.id && String(l.id) === String(meuId));
    zerar(l);
    if (!l.nome) l.nome = "(sem nome)";
  }
  return { linhas: todas, foraDaTabela };
}

/** As colunas da TABELA: só as das fontes que vieram inteiras. Uma coluna
 *  com o número de uma pessoa só e "—" em todas as outras não compara nada. */
export function colunasVisiveis(fontes) {
  return COLUNAS_DA_EQUIPE.filter((c) => fontes[c.fonte] === true);
}

/** As colunas da FICHA: as das fontes que vieram, inteiras ou não. A
 *  posição e a mediana da equipe só saem das inteiras. */
export function colunasDaFicha(fontes) {
  return COLUNAS_DA_EQUIPE.filter((c) => Boolean(fontes[c.fonte]));
}

/** Quais fontes faltaram, por extenso: "os protocolos e a carteira". A
 *  parcial não faltou: ela veio, só que de uma pessoa. */
export function fraseDoQueFaltou(fontes) {
  const faltam = Object.keys(NOMES_DAS_FONTES).filter((k) => !fontes[k]).map((k) => NOMES_DAS_FONTES[k]);
  if (!faltam.length) return "";
  return faltam.length === 1 ? faltam[0] : `${faltam.slice(0, -1).join(", ")} e ${faltam[faltam.length - 1]}`;
}

/** A ORDEM DA TABELA. O vazio ("—") vai sempre para o fim, nos dois
 *  sentidos: subir o "—" para o topo do "mais rápido" diria que quem não
 *  respondeu ninguém é o mais rápido da equipe. O empate é pelo nome. */
export function ordenarAEquipe(linhas, coluna, sentido) {
  const dir = sentido === "asc" ? 1 : -1;
  const nome = (l) => String(l.nome || "");
  return [...(linhas || [])].sort((a, b) => {
    if (coluna === "nome") return dir * nome(a).localeCompare(nome(b), "pt-BR");
    const va = a[coluna], vb = b[coluna];
    if (va == null && vb == null) return nome(a).localeCompare(nome(b), "pt-BR");
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va !== vb) return dir * (va - vb);
    return nome(a).localeCompare(nome(b), "pt-BR");
  });
}

/** O sentido de começo de cada coluna: o tempo começa pelo mais rápido, o
 *  nome pela ordem alfabética, e os números pelo maior. */
export const sentidoDeComeco = (coluna) => {
  const c = COLUNAS_DA_EQUIPE.find((x) => x.id === coluna);
  return coluna === "nome" || (c && c.menorMelhor) ? "asc" : "desc";
};

/** QUEM ENTRA NA COMPARAÇÃO de uma coluna (ver `base`). A linha "pelo nome"
 *  nunca entra: ela pode ser duas pessoas somadas, ou uma partida em duas. */
export function baseDaComparacao(linhas, coluna) {
  const c = COLUNAS_DA_EQUIPE.find((x) => x.id === coluna) || {};
  return (linhas || []).filter((l) => {
    if (l.pelonome || l[coluna] == null) return false;
    if (c.base === "fez") return Number(l[coluna]) > 0;
    if (c.base === "carteira") return Number(l.carteira) > 0;
    return true;
  });
}

/** A mediana de uma lista de números (os vazios ficam de fora). */
export function mediana(valores) {
  const v = (valores || []).filter((x) => x != null && Number.isFinite(Number(x))).map(Number).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** A PESSOA NA EQUIPE, numa coluna: a posição dela ("2º de 7") e a mediana
 *  da equipe, as duas contadas na base da coluna (`baseDaComparacao`): quem
 *  não atendeu ninguém não entra na mediana dos atendimentos, e quem não
 *  respondeu ninguém não entra no ranking do tempo. O empate divide a
 *  posição: duas com 10 atendimentos são as duas "1º".
 *
 *  SEM POSIÇÃO quando ela não diz nada: na coluna de volume (`semPosicao`),
 *  com a pessoa fora da base, e com todo mundo empatado — "1º de 5" com os
 *  cinco no mesmo número se leria como o melhor da equipe. */
export function aPessoaNaEquipe(linhas, id, coluna) {
  const c = COLUNAS_DA_EQUIPE.find((x) => x.id === coluna) || {};
  const base = baseDaComparacao(linhas, coluna);
  const eu = (linhas || []).find((l) => !l.pelonome && String(l.id) === String(id));
  const valor = eu && eu[coluna] != null ? eu[coluna] : null;
  const med = mediana(base.map((l) => l[coluna]));
  const naBase = Boolean(eu) && base.includes(eu);
  const todosIguais = base.length > 0 && base.every((l) => Number(l[coluna]) === Number(base[0][coluna]));
  if (valor == null || !naBase || c.semPosicao || todosIguais || base.length < 2) {
    return { valor, posicao: null, de: base.length, mediana: med };
  }
  const melhores = base.filter((l) => (c.menorMelhor ? l[coluna] < valor : l[coluna] > valor)).length;
  return { valor, posicao: melhores + 1, de: base.length, mediana: med };
}

/** O que a impressão escreve no alto da primeira folha: o recorte inteiro,
 *  porque um relatório impresso não tem a barra de filtros ao lado. */
export function linhasDoCabecalho({ periodo, quem, telefone, departamento, geradoEm, geradoPor }) {
  const quando = geradoEm instanceof Date ? geradoEm : new Date(geradoEm || Date.now());
  const data = quando.toLocaleDateString("pt-BR");
  const hora = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return [
    ["Período", periodo || ""],
    ["Atendente", quem || "Todos os atendentes"],
    ["Telefone", telefone || "Todos os telefones"],
    ["Departamento", departamento || "Todos os departamentos"],
    ["Gerado em", `${data} às ${hora}${geradoPor ? `, por ${geradoPor}` : ""}`],
  ];
}
