// ============================================================
//  A VISÃO GERAL DO PAINEL (05/11) — as contas sem tela
//
//  Pedido do Rodrigo: "A tela 'Painel' preciso de um dashboard de verdade,
//  que seja inteligente e interativa. Com cards, gráficos de pizza, etc. Tem
//  que fazer sentido também as informações que me ajudem a melhorar o
//  atendimento, organizar a equipe e dar feedbacks e fazer cobranças de forma
//  correta."
//
//  NADA AQUI CONTA NADA DO BANCO, a régua de `painelDeGestao.js`: cada número
//  vem somado da sua função (o prazo e o tempo em expediente, do script 052
//  da ponte; a carteira, do 051). Aqui só se lê, se compara e se escreve a
//  frase.
// ============================================================
import { mediana } from "./painelDeGestao.js";

/** A RÉGUA DAS ATRASADAS da carteira. O banco diz qual usou
 *  (`dias_atrasada`, script 051 da ponte); o banco de antes não diz, e
 *  contava a partir de 3. O rótulo sai daqui, e não de um número escrito na
 *  tela: rótulo e conta nunca discordam. */
export const DIAS_DA_CARTEIRA_DE_ANTES = 3;
export function diasDaCarteira(carteira) {
  const d = Number(carteira && carteira.dias_atrasada);
  return Number.isInteger(d) && d > 0 ? d : DIAS_DA_CARTEIRA_DE_ANTES;
}
/** "Há +2 dias" — a escrita do pedido. */
export const rotuloDasAtrasadas = (dias) => `Há +${dias} dias`;
/** "há 2 dias ou mais" — a frase por extenso. */
export const fraseDasAtrasadas = (dias) => `há ${dias} dias ou mais`;

/** "a sua carteira", "da carteira de JENIFER": a carteira de quem foi
 *  escolhido, com a preposição de cada frase (`a`, `da`, `na`, `Na`). Com
 *  "sua" no fim ("a carteira sua"), a frase saía torta. */
export function carteiraDe({ sou = false, nome = "" } = {}, artigo = "a") {
  return sou ? `${artigo} sua carteira` : `${artigo} carteira de ${nome || "quem foi escolhido"}`;
}

/** O PRAZO, como a tela o lê.
 *
 *  Sem a chave (o banco sem o 052), ou nula (o prazo é da EQUIPE, e com uma
 *  pessoa escolhida o banco o devolve nulo — ver o cabeçalho do 052), a
 *  resposta é `null`: a tela não desenha zero onde não houve conta.
 *
 *  "Julgados" são os que já têm desfecho: no prazo, atrasados (a equipe agiu
 *  depois do prazo) e sem ação fora do prazo. "Aguardando" ainda está dentro
 *  dele, e fica fora da porcentagem: contá-lo como "no prazo" seria dar por
 *  atendido quem ainda espera, e como "fora" seria cobrar o que não venceu. */
export function lerPrazo(p) {
  if (!p || typeof p !== "object") return null;
  const v = (k) => Math.max(0, Number(p[k]) || 0);
  const noPrazo = v("no_prazo"), atrasados = v("atrasados"), semAcao = v("sem_acao"), aguardando = v("aguardando");
  const julgados = noPrazo + atrasados + semAcao;
  const lim = (k) => (p[k] == null ? null : Number(p[k]));
  return {
    noPrazo, atrasados, semAcao, aguardando, julgados, total: julgados + aguardando,
    pct: julgados ? noPrazo / julgados : null,
    limiteMin: lim("limite_min") ?? lim("limite"), limiteMax: lim("limite_max") ?? lim("limite"),
  };
}

/** "82%". Sem número, "—". */
export const porcento = (x) => (x == null || !Number.isFinite(Number(x)) ? "—" : `${Math.round(Number(x) * 100)}%`);

/** O prazo por extenso: "30 min" ou "30 a 60 min" (cada departamento tem o
 *  seu, na aba "Aviso de espera"). Sem o "de" na frente: quem chama escreve
 *  "prazo de 30 a 60 min", e com ele sairia "prazo de de 30". */
export function fraseDoLimite(prazo) {
  if (!prazo || prazo.limiteMin == null) return null;
  return prazo.limiteMin === prazo.limiteMax || prazo.limiteMax == null
    ? `${prazo.limiteMin} min`
    : `${prazo.limiteMin} a ${prazo.limiteMax} min`;
}

/** QUANTOS PRECISAM TER SIDO JULGADOS para uma porcentagem valer como
 *  comparação: com três clientes, um a mais fora do prazo muda 33 pontos, e a
 *  tela anunciaria uma "piora" que é só o acaso. */
export const MINIMO_PARA_COMPARAR = 5;

/** A diferença em PONTOS entre o prazo de agora e o do período anterior, ou
 *  `null` quando um dos dois julgou pouco. */
export function variacaoDoPrazo(agora, antes) {
  if (!agora || !antes || agora.julgados < MINIMO_PARA_COMPARAR || antes.julgados < MINIMO_PARA_COMPARAR) return null;
  return Math.round((agora.pct - antes.pct) * 100);
}

/** Segundos → "45 s", "12 min", "2 h 10 min", "3 d 4 h" — a escrita da tela. */
export function tempoCurto(s) {
  if (s == null || s === "") return "—";
  const n = Math.round(Number(s));
  if (!Number.isFinite(n)) return "—";
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  const h = Math.floor(n / 3600), m = Math.round((n % 3600) / 60);
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return d < 10 ? `${d} d ${h % 24} h` : `${d} d`;
}

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const plural = (n, um, varios) => `${fmt(n)} ${Number(n) === 1 ? um : varios}`;

/** A CARTEIRA, resumida para a visão geral. É uma FOTO DE AGORA: o banco
 *  guarda só o responsável de hoje, e o período da barra não vale para ela.
 *
 *  Com uma pessoa escolhida (`quem`), a linha dela — sem linha, ela não tem
 *  conversa nenhuma. Sem pessoa, o total do banco, que já soma a fila sem
 *  responsável, e a fila sem responsável à parte (`semDono`). */
export function resumoDaCarteira(carteira, quem = null) {
  if (!carteira || typeof carteira !== "object" || carteira.falta) return null;
  const dias = diasDaCarteira(carteira);
  const num = (x, k) => Math.max(0, Number(x && x[k]) || 0);
  if (quem != null) {
    const l = (carteira.linhas || []).find((x) => x && x.id != null && String(x.id) === String(quem)) || null;
    return { de: "pessoa", dias, conversas: num(l, "conversas"), esperando: num(l, "esperando"),
             atrasadas: num(l, "atrasadas"), maisAntiga: (l && l.mais_antiga) || null, semDono: null };
  }
  const t = carteira.total || {};
  const s = carteira.sem_responsavel || null;
  return {
    de: "equipe", dias, conversas: num(t, "conversas"), esperando: num(t, "esperando"), atrasadas: num(t, "atrasadas"),
    maisAntiga: null,
    semDono: s ? { conversas: num(s, "conversas"), esperando: num(s, "esperando"), atrasadas: num(s, "atrasadas") } : null,
  };
}

/** AS FATIAS DO PRAZO: só as que já têm desfecho. "Aguardando" fica fora da
 *  rosca e é dito embaixo dela: dentro, o verde deixaria de ser a
 *  porcentagem escrita no meio. */
export function fatiasDoPrazo(prazo) {
  if (!prazo || !prazo.julgados) return [];
  return [
    { id: "no_prazo", nome: "No prazo", valor: prazo.noPrazo,
      ajuda: "A equipe respondeu ou finalizou antes de o prazo vencer." },
    { id: "atrasados", nome: "Atendidos fora do prazo", valor: prazo.atrasados,
      ajuda: "A equipe respondeu ou finalizou, mas depois de o prazo vencer." },
    { id: "sem_acao", nome: "Sem resposta, prazo vencido", valor: prazo.semAcao,
      ajuda: "O prazo venceu e ninguém respondeu nem finalizou ainda: o cliente continua esperando." },
  ];
}

/** AS FATIAS DA SITUAÇÃO: cada protocolo do período em uma, e numa só. Com uma
 *  pessoa escolhida, o banco não manda os sem resposta (ainda não são de
 *  ninguém), e a fatia não aparece. */
export function fatiasDaSituacao(total, soMeu = false) {
  if (!total) return [];
  const v = (k) => Math.max(0, Number(total[k]) || 0);
  const f = [
    { id: "em_atendimento", nome: "Em atendimento", valor: v("em_atendimento"),
      ajuda: "A equipe já começou, e o protocolo ainda não foi finalizado." },
    { id: "finalizados", nome: "Finalizados", valor: v("finalizados"),
      ajuda: "Fechados com o “Finalizar”." },
  ];
  if (!soMeu && total.sem_resposta != null) {
    f.push({ id: "sem_resposta", nome: "Esperando resposta", valor: v("sem_resposta"),
             ajuda: "O cliente abriu o protocolo e ninguém da equipe respondeu nem finalizou ainda." });
  }
  return f.reduce((n, x) => n + x.valor, 0) ? f : [];
}

/** AS FATIAS DOS DEPARTAMENTOS: os protocolos abertos no período — os que a
 *  equipe começou e os que esperam resposta —, que é a pergunta de quem
 *  organiza a equipe: de onde vem o trabalho. Contar só os começados
 *  esconderia o departamento em que ninguém respondeu nada.
 *
 *  ATÉ CINCO FATIAS. Passando disso, as menores viram uma só, "Outros": uma
 *  rosca de oito cores não se lê, e a tabela, ao lado, tem todos. */
export const MAX_FATIAS = 5;
export function fatiasDosDepartamentos(porDepartamento, max = MAX_FATIAS) {
  const lista = (porDepartamento || [])
    .map((d) => ({
      id: d && d.id != null ? String(d.id) : null, nome: (d && d.nome) || "(sem departamento)",
      valor: Math.max(0, Number(d && d.atendimentos) || 0) + Math.max(0, Number(d && d.sem_resposta) || 0),
    }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  if (lista.length <= max) return lista;
  const ficam = lista.slice(0, max - 1);
  const resto = lista.slice(max - 1);
  return [...ficam, { id: null, nome: `Outros (${resto.length})`, valor: resto.reduce((n, d) => n + d.valor, 0), outros: true,
                      ajuda: resto.map((d) => `${d.nome}: ${fmt(d.valor)}`).join(" · ") }];
}

/** A ORDEM DOS DESTAQUES: o que pede uma ação vem primeiro. */
export const NIVEIS = ["critico", "atencao", "bom", "info"];

/** OS DESTAQUES DA VISÃO GERAL: as frases que dizem o que fazer.
 *
 *  Cada um traz o NÍVEL (a cor e o ícone da tela: nunca a cor sozinha), um
 *  título com o número, o detalhe e, quando há, para onde ir (`acao`):
 *  `{ tipo: "guia", tela }` abre uma tela numa guia nova, `{ tipo: "secao",
 *  secao }` desce até uma seção desta tela, e `{ tipo: "departamento", id }`
 *  recorta a tela num departamento.
 *
 *  O QUE ELES NÃO FAZEM, e é decisão: apontar a pessoa "mais lenta". O prazo é
 *  da equipe (o cabeçalho do 052): quem pega a conversa esquecida não é quem
 *  a esqueceu. O que é de uma pessoa — a carteira dela — aparece com o nome;
 *  o desempenho de cada uma fica na ficha, ao lado da mediana da equipe.
 *
 *  `protocolos` é a resposta de `zorvin_relatorio_atendimentos`, e `carteira`
 *  a de `zorvin_relatorio_responsaveis`. Qualquer um dos dois pode faltar.
 *  Com uma pessoa escolhida (`quem`), a carteira é a dela, e o que é da equipe
 *  inteira (a fila sem responsável, as carteiras desiguais) fica de fora. */
export function destaques({ protocolos = null, carteira = null, quem = null, nome = "", sou = false } = {}) {
  const lista = [];
  const prazo = lerPrazo(protocolos && protocolos.prazo);
  const antes = lerPrazo(protocolos && protocolos.antes && protocolos.antes.prazo);
  const limite = fraseDoLimite(prazo);
  const dias = diasDaCarteira(carteira);
  const carteiraVeio = carteira && typeof carteira === "object" && !carteira.falta;

  // 1. QUEM PASSOU DO PRAZO E CONTINUA SEM RESPOSTA: o cliente esperando
  //    agora, além do que foi combinado.
  if (prazo && prazo.semAcao > 0) {
    lista.push({
      id: "sem-acao", nivel: "critico",
      titulo: `${plural(prazo.semAcao, "cliente passou", "clientes passaram")} do prazo sem resposta`,
      detalhe: `Abriram atendimento no período, e ninguém da equipe respondeu nem finalizou dentro do prazo${limite ? ` (${limite} de expediente)` : ""}. Continuam esperando.`,
      acao: { tipo: "guia", tela: "esperando", rotulo: "Abrir “Esperando resposta”" },
    });
  }

  // 2. A CARTEIRA ATRASADA: é de alguém, e o nome vai junto — é a cobrança
  //    certa, porque a conversa é dela.
  if (carteiraVeio && quem != null) {
    const l = (carteira.linhas || []).find((x) => x && x.id != null && String(x.id) === String(quem));
    if (l && Number(l.atrasadas) > 0) {
      lista.push({
        id: "carteira-atrasada", nivel: "atencao",
        titulo: `${plural(Number(l.atrasadas), `conversa ${carteiraDe({ sou, nome }, "da")} espera`, `conversas ${carteiraDe({ sou, nome }, "da")} esperam`)} resposta ${fraseDasAtrasadas(dias)}`,
        detalhe: `${carteiraDe({ sou, nome }, "Na")} há ${plural(Number(l.conversas) || 0, "conversa", "conversas")}, ${plural(Number(l.esperando) || 0, "esperando", "esperando")} resposta.`,
        acao: { tipo: "secao", secao: "carteira", rotulo: "Ver a carteira" },
      });
    }
  } else if (carteiraVeio && carteira.total && Number(carteira.total.atrasadas) > 0) {
    const nomes = (carteira.linhas || []).filter((l) => Number(l.atrasadas) > 0)
      .sort((a, b) => Number(b.atrasadas) - Number(a.atrasadas) || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
      .slice(0, 3).map((l) => `${l.nome || "(sem nome)"}: ${fmt(l.atrasadas)}`);
    const semDono = carteira.sem_responsavel && Number(carteira.sem_responsavel.atrasadas) > 0
      ? [`sem responsável: ${fmt(carteira.sem_responsavel.atrasadas)}`] : [];
    lista.push({
      id: "carteira-atrasada", nivel: "atencao",
      titulo: `${plural(Number(carteira.total.atrasadas), "conversa espera", "conversas esperam")} resposta ${fraseDasAtrasadas(dias)}`,
      detalhe: [...nomes, ...semDono].join(" · ") || null,
      acao: { tipo: "secao", secao: "carteira", rotulo: "Ver a carteira" },
    });
  }

  // 3. A FILA SEM DONO: de onde todo mundo pode puxar trabalho.
  const sd = carteiraVeio && quem == null ? carteira.sem_responsavel : null;
  if (sd && Number(sd.esperando) > 0) {
    lista.push({
      id: "sem-responsavel", nivel: "atencao",
      titulo: `${plural(Number(sd.esperando), "conversa sem responsável espera", "conversas sem responsável esperam")} resposta`,
      detalhe: "Quem responder primeiro assume. Vale distribuir na reunião, ou ligar a distribuição automática no departamento.",
      acao: { tipo: "secao", secao: "carteira", rotulo: "Ver a carteira" },
    });
  }

  // 4. O PRAZO DO PERÍODO, comparado com o anterior quando os dois julgaram
  //    o bastante.
  if (prazo && prazo.julgados >= MINIMO_PARA_COMPARAR) {
    const delta = variacaoDoPrazo(prazo, antes);
    const base = `${porcento(prazo.pct)} dos clientes foram atendidos no prazo`;
    const acao = { tipo: "secao", secao: "protocolos", rotulo: "Ver os protocolos" };
    if (delta != null && delta >= 5) {
      lista.push({ id: "prazo", nivel: "bom", titulo: `O prazo melhorou: ${base}`,
                   detalhe: `No período anterior eram ${porcento(antes.pct)} (${delta} pontos a mais).`, acao });
    } else if (delta != null && delta <= -5) {
      lista.push({ id: "prazo", nivel: "atencao", titulo: `O prazo piorou: ${base}`,
                   detalhe: `No período anterior eram ${porcento(antes.pct)} (${-delta} pontos a menos).`, acao });
    } else {
      lista.push({ id: "prazo", nivel: "info", titulo: base,
                   detalhe: `${plural(prazo.noPrazo, "cliente", "clientes")} de ${plural(prazo.julgados, "julgado", "julgados")}${limite ? `, com o prazo de ${limite} de expediente` : ""}.`,
                   acao });
    }
  }

  // 5. O DEPARTAMENTO QUE PUXA O PRAZO PARA BAIXO: só com dois ou mais
  //    departamentos comparáveis, e dez pontos abaixo da equipe.
  const deps = ((protocolos && protocolos.por_departamento) || [])
    .map((d) => ({ d, p: lerPrazo(d && d.prazo) }))
    .filter((x) => x.p && x.p.julgados >= MINIMO_PARA_COMPARAR && x.p.pct != null);
  if (prazo && prazo.pct != null && deps.length >= 2) {
    const pior = deps.slice().sort((a, b) => a.p.pct - b.p.pct)[0];
    if (pior.p.pct <= prazo.pct - 0.10) {
      lista.push({
        id: "departamento", nivel: "atencao",
        titulo: `${pior.d.nome || "Um departamento"}: ${porcento(pior.p.pct)} no prazo`,
        detalhe: `A equipe toda: ${porcento(prazo.pct)}. Lá, ${plural(pior.p.atrasados + pior.p.semAcao, "cliente ficou", "clientes ficaram")} fora do prazo.`,
        acao: pior.d.id != null ? { tipo: "departamento", id: String(pior.d.id), rotulo: "Ver só este departamento" } : null,
      });
    }
  }

  // 6. AS CARTEIRAS DESIGUAIS: para organizar a equipe. Só sem pessoa
  //    escolhida, com três ou mais carteiras, e com a maior no dobro da
  //    mediana ou mais E dez conversas acima dela: diferença pequena é o dia a
  //    dia. O título diz os dois números, e não "mais que o dobro": no dobro
  //    exato, a frase mentiria.
  if (carteiraVeio && quem == null && !carteira.so_meu) {
    const comCarteira = (carteira.linhas || []).filter((l) => Number(l.conversas) > 0);
    const med = mediana(comCarteira.map((l) => Number(l.conversas)));
    const maior = comCarteira.slice().sort((a, b) => Number(b.conversas) - Number(a.conversas))[0];
    if (comCarteira.length >= 3 && med != null && maior && Number(maior.conversas) >= 2 * med && Number(maior.conversas) - med >= 10) {
      lista.push({
        id: "carteiras-desiguais", nivel: "info",
        titulo: `A carteira de ${maior.nome || "(sem nome)"} tem ${fmt(maior.conversas)} conversas; a mediana da equipe é ${fmt(med)}`,
        detalhe: "Vale ver se dá para passar algumas adiante, ou ligar a distribuição automática para as novas.",
        acao: { tipo: "secao", secao: "carteira", rotulo: "Ver a carteira" },
      });
    }
  }

  // 7. O TEMPO TÍPICO ATÉ A 1ª RESPOSTA, em expediente, ao lado do relógio:
  //    é a diferença entre as duas contas que mostra por que o relógio cobra
  //    errado.
  const pr = protocolos && protocolos.tempos && protocolos.tempos.primeira_resposta;
  if (pr && pr.mediana_expediente != null && Number(pr.quantos) >= 3) {
    lista.push({
      id: "primeira-resposta", nivel: "info",
      titulo: quem != null
        ? `Metade das ${sou ? "suas primeiras respostas" : `primeiras respostas de ${nome || "quem foi escolhido"}`} saiu em até ${tempoCurto(pr.mediana_expediente)} de expediente`
        : `Metade dos clientes recebeu a 1ª resposta em até ${tempoCurto(pr.mediana_expediente)} de expediente`,
      detalhe: pr.mediana != null ? `No relógio, contando noites, fins de semana e feriados: ${tempoCurto(pr.mediana)}.` : null,
      acao: null,
    });
  }

  // 8. O VOLUME, quando mudou muito em relação ao período anterior.
  const t = protocolos && protocolos.total;
  const a = protocolos && protocolos.antes;
  if (t && a && a.existe && Number(a.atendimentos) >= 10) {
    const v = (Number(t.atendimentos) - Number(a.atendimentos)) / Number(a.atendimentos);
    if (Math.abs(v) >= 0.2) {
      lista.push({
        id: "volume", nivel: "info",
        titulo: `${plural(Number(t.atendimentos), "atendimento", "atendimentos")} no período, ${v > 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}% que no anterior`,
        detalhe: `No período anterior foram ${fmt(a.atendimentos)}.`,
        acao: null,
      });
    }
  }

  return lista.sort((x, y) => NIVEIS.indexOf(x.nivel) - NIVEIS.indexOf(y.nivel));
}

/** OS PONTOS DA FICHA, para a conversa de feedback.
 *
 *  A pessoa ao lado da mediana da EQUIPE, e só onde a comparação diz alguma
 *  coisa: a comparação vem de `aPessoaNaEquipe` (painelDeGestao.js), que só
 *  conta quem fez aquilo no período. E com o número sempre junto: "responde
 *  devagar" sem o número é opinião.
 *
 *  `comparar(coluna)` devolve `{ valor, mediana, de }` (a de
 *  `aPessoaNaEquipe`), ou `null` quando a coluna não veio inteira; `linha` é a
 *  da pessoa (`juntarAEquipe`); `dias` é a régua da carteira.
 *
 *  O que conta:
 *    - o tempo até a 1ª resposta EM EXPEDIENTE (052), e só com a pessoa tendo
 *      respondido 3 ou mais primeiros contatos: com um, o número é o acaso;
 *    - o volume (atendimentos e finalizações), contra a mediana de quem fez;
 *    - a carteira: o que está atrasado nela é dela, e vai sempre.
 *  O que não conta, e é decisão: o prazo (é da equipe) e o "Já tratei". */
export const MINIMO_DE_PRIMEIRAS = 3;
export function pontosDaFicha({ linha = null, comparar = () => null, dias = DIAS_DA_CARTEIRA_DE_ANTES } = {}) {
  const fortes = [], atencao = [];
  if (!linha) return { fortes, atencao };

  // O TEMPO, em expediente.
  const t = comparar("primeiraExpediente");
  if (t && t.valor != null && t.mediana != null && t.de >= 3 && Number(linha.primeiras) >= MINIMO_DE_PRIMEIRAS) {
    const texto = `1ª resposta em ${tempoCurto(t.valor)} de expediente (mediana da equipe: ${tempoCurto(t.mediana)})`;
    if (t.valor <= t.mediana * 0.75) fortes.push({ id: "tempo", texto: `Responde rápido: ${texto}.` });
    else if (t.valor >= t.mediana * 1.5) atencao.push({ id: "tempo", texto: `A 1ª resposta demora mais que a da equipe: ${texto}.` });
  }

  // O VOLUME.
  for (const [col, nomeCol] of [["atendimentos", "atendimentos"], ["finalizou", "finalizações"]]) {
    const c = comparar(col);
    if (!c || c.valor == null || c.mediana == null || c.de < 3 || !(c.mediana > 0)) continue;
    if (c.valor >= c.mediana * 1.25) {
      fortes.push({ id: col, texto: `Mais ${nomeCol} que a mediana da equipe: ${fmt(c.valor)} (a equipe: ${fmt(c.mediana)}).` });
    } else if (c.valor <= c.mediana * 0.5) {
      atencao.push({ id: col, texto: `Menos ${nomeCol} que a mediana da equipe: ${fmt(c.valor)} (a equipe: ${fmt(c.mediana)}). Vale ver se o turno ou o telefone explicam.` });
    }
  }

  // A CARTEIRA: o que está nela é dela.
  if (linha.atrasadas != null && Number(linha.atrasadas) > 0) {
    atencao.push({ id: "carteira", texto: `${plural(Number(linha.atrasadas), "conversa da carteira espera", "conversas da carteira esperam")} resposta ${fraseDasAtrasadas(dias)}.` });
  } else if (linha.atrasadas != null && Number(linha.carteira) > 0) {
    fortes.push({ id: "carteira", texto: `Carteira em dia: nenhuma conversa esperando ${fraseDasAtrasadas(dias)}.` });
  }
  return { fortes, atencao };
}
