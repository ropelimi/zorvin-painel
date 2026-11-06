// AS TENDÊNCIAS DO PAINEL (06/11) — as contas sem tela.
//
// Pedido do Rodrigo: "um dashboard inteligente e interativo de verdade, com
// informações que ajudem a estudar os números, fazer uma boa gestão e tomar as
// melhores decisões". Tudo aqui sai do que a tela JÁ recebe do banco: os
// protocolos (`zorvin_relatorio_atendimentos`, scripts 029 e 052 da ponte),
// com `por_dia` e `registros`. Nenhuma leitura nova, nenhuma conta que o banco
// já faz feita de novo — só o rearranjo do que veio, dia a dia e hora a hora.
//
// O DIA DE CADA PROTOCOLO É O DA ABERTURA. `por_dia.finalizados` conta, dos
// protocolos abertos naquele dia, quantos já foram finalizados — e não quantos
// foram finalizados naquele dia. Por isso o gráfico diz "dos que entraram",
// e nunca "saíram no dia": o banco não manda a data da saída por dia.

/** Os dias do período, de `de` a `ate`, no calendário do navegador (o do
 *  escritório): a mesma conta que o gráfico "Protocolos por dia" já usa. */
export function diasDoPeriodo(deIso, ateIso, teto = 400) {
  const dias = [];
  const d0 = new Date(deIso), d1 = new Date(ateIso);
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return dias;
  d0.setHours(0, 0, 0, 0);
  for (let d = d0; d <= d1 && dias.length < teto; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dias;
}

const chaveDoDia = (q) => String(q || "").slice(0, 10);
const n = (v) => Number(v || 0);

/** O FLUXO DE CADA DIA: quantos protocolos entraram e, deles, quantos já
 *  foram finalizados, quantos estão em atendimento e quantos esperam a
 *  primeira resposta. Sem o 052 o banco não manda `finalizados`: aí o dia
 *  separa só "com atendimento" e "esperando", e `com052` diz isso. Os dias sem
 *  nada entram como zero — completar não é contar. */
export function fluxoPorDia(porDia, deIso, ateIso) {
  const lista = Array.isArray(porDia) ? porDia : [];
  const com052 = lista.some((x) => Object.prototype.hasOwnProperty.call(x, "finalizados"));
  const tem = new Map(lista.map((x) => [chaveDoDia(x.quando), x]));
  const dias = diasDoPeriodo(deIso, ateIso).map((quando) => {
    const x = tem.get(quando) || {};
    const iniciados = n(x.atendimentos), esperando = n(x.sem_resposta);
    const finalizados = com052 ? Math.min(n(x.finalizados), iniciados) : null;
    return {
      quando,
      entraram: iniciados + esperando,
      iniciados,
      finalizados,
      em_atendimento: com052 ? iniciados - finalizados : iniciados,
      sem_resposta: esperando,
    };
  });
  return { com052, dias };
}

/** O RESUMO DO FLUXO, para a frase que vem antes do gráfico: dos que
 *  entraram no período, quantos já saíram e quantos continuam abertos. */
export function resumoDoFluxo(fluxo) {
  const dias = (fluxo && fluxo.dias) || [];
  const entraram = dias.reduce((s, d) => s + d.entraram, 0);
  const finalizados = fluxo && fluxo.com052 ? dias.reduce((s, d) => s + n(d.finalizados), 0) : null;
  const abertos = finalizados == null ? null : entraram - finalizados;
  const esperando = dias.reduce((s, d) => s + d.sem_resposta, 0);
  const pct = finalizados == null || !entraram ? null : Math.round((finalizados / entraram) * 100);
  // O DIA DE MAIS ENTRADA, para a frase: é o dia que pede mais gente.
  const pico = dias.reduce((m, d) => (d.entraram > (m ? m.entraram : 0) ? d : m), null);
  return { entraram, finalizados, abertos, esperando, pct, pico };
}

/** O PRAZO DE CADA DIA (052): dos clientes que abriram atendimento naquele
 *  dia e já têm o desfecho, a parte atendida a tempo. Sem cliente julgado, o
 *  dia fica sem número (`pct` nulo) — e nunca com zero, que seria "ninguém
 *  foi atendido a tempo". Com uma pessoa escolhida o banco manda nulo: o
 *  prazo é da equipe, e aí `existe` é falso. */
export function prazoPorDia(porDia, deIso, ateIso) {
  const lista = Array.isArray(porDia) ? porDia : [];
  const existe = lista.some((x) => x.prazo_julgados != null);
  const tem = new Map(lista.map((x) => [chaveDoDia(x.quando), x]));
  const dias = diasDoPeriodo(deIso, ateIso).map((quando) => {
    const x = tem.get(quando) || {};
    const julgados = n(x.prazo_julgados), noPrazo = Math.min(n(x.no_prazo), julgados);
    return { quando, julgados, noPrazo, pct: julgados ? Math.round((noPrazo / julgados) * 100) : null };
  });
  return { existe, dias };
}

const JULGADOS = ["no_prazo", "atrasado", "sem_acao"];

/** O PRAZO POR HORA EM QUE O CLIENTE ESCREVEU, a partir dos REGISTROS que o
 *  banco mandou (cada protocolo com `prazo`, script 052). É a pergunta "em que
 *  hora do dia falta gente?". A hora é a do navegador, que no escritório é a de
 *  Brasília.
 *
 *  OS REGISTROS TÊM TETO (os mais recentes): quando o banco cortou
 *  (`total_registros` maior do que veio), a conta é dos que vieram, e
 *  `completo` diz isso — a tela tem de dizer, para não ler "dos 500 mais
 *  recentes" como "do período". */
export function prazoPorHora(registros, totalRegistros) {
  const lista = Array.isArray(registros) ? registros : [];
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, julgados: 0, noPrazo: 0, pct: null }));
  let julgados = 0;
  for (const r of lista) {
    if (!JULGADOS.includes(r.prazo) || !r.aberto_em) continue;
    const q = new Date(r.aberto_em);
    if (Number.isNaN(q.getTime())) continue;
    const h = horas[q.getHours()];
    h.julgados += 1; julgados += 1;
    if (r.prazo === "no_prazo") h.noPrazo += 1;
  }
  for (const h of horas) h.pct = h.julgados ? Math.round((h.noPrazo / h.julgados) * 100) : null;
  return { horas, julgados, completo: !(Number(totalRegistros) > lista.length), vieram: lista.length };
}

/** A HORA QUE MAIS PRECISA DE GENTE: a de menor parte no prazo, entre as que
 *  têm casos bastantes (`minimo`) para a porcentagem não ser o acaso. Empate
 *  vai para a de mais casos (pesa mais), e depois para a mais cedo. */
export function piorHora(horas, minimo = 5) {
  return (horas || [])
    .filter((h) => h.julgados >= minimo && h.pct != null)
    .sort((a, b) => a.pct - b.pct || b.julgados - a.julgados || a.hora - b.hora)[0] || null;
}

/** A parte no prazo do período inteiro, contada dos mesmos dias: é a linha de
 *  referência do gráfico do prazo dia a dia. */
export function prazoDoPeriodo(diasDoPrazo) {
  const julgados = (diasDoPrazo || []).reduce((s, d) => s + d.julgados, 0);
  const noPrazo = (diasDoPrazo || []).reduce((s, d) => s + d.noPrazo, 0);
  return julgados ? { julgados, noPrazo, pct: Math.round((noPrazo / julgados) * 100) } : null;
}

/** OS PONTOS DE UMA FAÍSCA (sparkline): no máximo `teto` pontos, os dias mais
 *  recentes, juntando dias vizinhos quando o período é longo — senão 90 dias
 *  viram uma barba ilegível num cartão de 180px. Junta SOMANDO (contagens) ou
 *  pela razão das somas (`razao`: [numerador, denominador]), e nunca pela
 *  média das porcentagens, que daria o mesmo peso ao dia de 1 cliente e ao de
 *  40. */
export function pontosDaFaisca(dias, campo, { teto = 30, razao = null } = {}) {
  const lista = dias || [];
  if (!lista.length) return [];
  const passo = Math.max(1, Math.ceil(lista.length / teto));
  const pontos = [];
  for (let i = 0; i < lista.length; i += passo) {
    const grupo = lista.slice(i, i + passo);
    if (razao) {
      const num = grupo.reduce((s, d) => s + n(d[razao[0]]), 0);
      const den = grupo.reduce((s, d) => s + n(d[razao[1]]), 0);
      pontos.push({ de: grupo[0].quando, ate: grupo[grupo.length - 1].quando, v: den ? Math.round((num / den) * 100) : null, base: den });
    } else {
      pontos.push({ de: grupo[0].quando, ate: grupo[grupo.length - 1].quando, v: grupo.reduce((s, d) => s + n(d[campo]), 0) });
    }
  }
  return pontos;
}
