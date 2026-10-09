// A RESPOSTA AUTOMÁTICA FORA DO HORÁRIO — o que a TELA precisa saber (09/10).
//
// Pedido do Rodrigo, o nº 1 da lista de ideias: quem escreve à noite, no fim
// de semana ou no feriado recebe na hora o texto do departamento. Quem manda
// é a PONTE, a cada mensagem de cliente; esta tela só configura.
//
// A CONTA DO HORÁRIO NÃO MORA AQUI. "Está aberto? Quando volta?" é respondido
// pelo banco (`zorvin_horario_de`, script 021 da ponte), e é a MESMA conta que
// decide se o cliente recebe a resposta. Uma segunda escrita dela aqui
// divergiria da primeira no primeiro feriado: a prévia diria "volta segunda"
// e o cliente receberia a resposta pensando na terça. Aqui ficam só os nomes,
// a forma da semana e as frases.

/** Os dias, na ordem da semana de trabalho, com a chave que o banco guarda. */
export const DIAS = [
  { chave: "seg", nome: "Segunda" }, { chave: "ter", nome: "Terça" },
  { chave: "qua", nome: "Quarta" }, { chave: "qui", nome: "Quinta" },
  { chave: "sex", nome: "Sexta" }, { chave: "sab", nome: "Sábado" },
  { chave: "dom", nome: "Domingo" },
];

/** A semana que o script 021 dá a quem ainda não configurou: de segunda a
 *  sexta, das 8h às 18h. */
export const SEMANA_PADRAO = {
  seg: ["08:00", "18:00"], ter: ["08:00", "18:00"], qua: ["08:00", "18:00"],
  qui: ["08:00", "18:00"], sex: ["08:00", "18:00"], sab: null, dom: null,
};

export const FUSO_PADRAO = "America/Sao_Paulo";

/** Os fusos do Brasil, pelo que a pessoa reconhece — e não pelo nome técnico.
 *  O resto do país anda junto com um destes. */
export const FUSOS = [
  { valor: "America/Sao_Paulo", rotulo: "Brasília (UTC−3)" },
  { valor: "America/Noronha", rotulo: "Fernando de Noronha (UTC−2)" },
  { valor: "America/Manaus", rotulo: "Amazonas, Mato Grosso, Rondônia e Roraima (UTC−4)" },
  { valor: "America/Rio_Branco", rotulo: "Acre (UTC−5)" },
];

/** O texto oferecido a quem começa do zero. Diz o horário com todas as
 *  letras, porque é isso que o cliente quer saber às dez da noite. */
export const TEXTO_SUGERIDO = "Olá! Recebemos sua mensagem. Nosso horário de atendimento é de "
  + "segunda a sexta, das 8h às 18h. Responderemos assim que voltarmos.";

/** O mesmo teto do banco (`check (length(texto) <= 1000)`). */
export const TETO_DO_TEXTO = 1000;

const HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const minutos = (hhmm) => {
  const x = HORA.exec(String(hhmm || "").trim());
  return x ? Number(x[1]) * 60 + Number(x[2]) : null;
};

/** A semana completa, com as sete chaves: a linha que ainda não existe no
 *  banco, ou uma semana guardada por alguém que esqueceu um dia. */
export function semanaCompleta(semana) {
  const base = semana && typeof semana === "object" ? semana : SEMANA_PADRAO;
  return Object.fromEntries(DIAS.map(({ chave }) => {
    const f = base[chave];
    return [chave, Array.isArray(f) && f.length === 2 ? [String(f[0]), String(f[1])] : null];
  }));
}

/** Quantos dias abrem. */
export function diasAbertos(semana) {
  return DIAS.filter(({ chave }) => Array.isArray((semana || {})[chave])).length;
}

/** O que impede salvar, em português — o mesmo que o gatilho do banco
 *  recusaria, dito ANTES de ir até ele. */
export function problemasDaSemana(semana) {
  const problemas = [];
  for (const { chave, nome } of DIAS) {
    const f = (semana || {})[chave];
    if (!Array.isArray(f)) continue;
    const abre = minutos(f[0]), fecha = minutos(f[1]);
    if (abre == null || fecha == null) {
      problemas.push(`${nome}: escreva a hora de abrir e a de fechar.`);
    } else if (abre >= fecha) {
      problemas.push(`${nome}: a hora de fechar precisa ser depois da de abrir.`);
    }
  }
  return problemas;
}

/** Variáveis das respostas rápidas escritas aqui? Elas NÃO funcionam: a
 *  resposta automática sai sem ninguém ler, e "{nome}" iria para o cliente
 *  com as chaves. Quem escreveu por hábito precisa saber antes de ligar. */
export function temChaves(texto) {
  return /\{[^{}\n]{1,40}\}/.test(String(texto || ""));
}

const DIAS_POR_EXTENSO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira",
                          "quinta-feira", "sexta-feira", "sábado"];

function partes(instante, fuso) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(instante).map((x) => [x.type, x.value]));
  const semana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { data: `${p.year}-${p.month}-${p.day}`, dia: p.day, mes: p.month,
           hora: `${p.hour}:${p.minute}`, semana };
}

/** "hoje às 18:00", "amanhã às 08:00", "terça-feira, 13/10, às 08:00" — NA
 *  HORA DO DEPARTAMENTO, e não na do computador de quem está olhando: é a
 *  hora que o cliente do departamento vive. */
export function quandoPorExtenso(instante, fuso = FUSO_PADRAO, agora = new Date()) {
  if (!instante) return "";
  const z = fuso || FUSO_PADRAO;
  const alvo = partes(new Date(instante), z);
  const hoje = partes(agora, z).data;
  const amanha = partes(new Date(agora.getTime() + 86400000), z).data;
  if (alvo.data === hoje) return `hoje às ${alvo.hora}`;
  if (alvo.data === amanha) return `amanhã às ${alvo.hora}`;
  return `${DIAS_POR_EXTENSO[alvo.semana]}, ${alvo.dia}/${alvo.mes}, às ${alvo.hora}`;
}

/** A janela da CONVERSA EM ANDAMENTO (script 022), em minutos, a partir do
 *  intervalo que o banco devolve ("00:30:00", "01:00:00", "1 day 02:00:00").
 *  É a carência da fila de espera (`zorvin_carencia_da_espera`, do 006): a
 *  mesma régua decide quando o cliente "ainda está respondendo àquela
 *  conversa", nos dois lugares. Não se lê → `null`, e a frase não promete
 *  número nenhum. */
export function minutosDaJanela(intervalo) {
  const x = /^(?:(\d+) days? )?(\d+):(\d{2}):(\d{2})$/.exec(String(intervalo || "").trim());
  if (!x) return null;
  const minutos = Number(x[1] || 0) * 1440 + Number(x[2]) * 60 + Number(x[3]);
  return minutos > 0 ? minutos : null;
}

/** "nos 30 minutos antes", "na última hora antes", "nas 2 horas antes" — e, sem
 *  o número, "pouco antes", que é verdade em qualquer caso. */
export function fraseDaJanela(minutos) {
  if (!minutos) return "pouco antes";
  if (minutos % 60 === 0) {
    const h = minutos / 60;
    return h === 1 ? "na última hora antes" : `nas ${h} horas antes`;
  }
  return minutos === 1 ? "no minuto antes" : `nos ${minutos} minutos antes`;
}

/** A prévia da tela, a partir do que o banco respondeu. */
export function fraseDoHorario(h, fuso = FUSO_PADRAO, agora = new Date()) {
  if (!h) return "";
  if (h.aberto) return `Agora está aberto — fecha ${quandoPorExtenso(h.fecha_em, fuso, agora)}.`;
  if (!h.abre_em) return "Nenhum dia aberto na semana: a resposta automática não teria quando prometer a volta.";
  return `Agora está fechado — volta ${quandoPorExtenso(h.abre_em, fuso, agora)}.`;
}
