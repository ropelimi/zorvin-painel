// PAINEL — o que aconteceu no atendimento, e como foi.
//
// ------------------------------------------------------------------
// O QUE ESTA TELA RESPONDE
// ------------------------------------------------------------------
//
//   QUANTO      atendimentos, mensagens recebidas, mensagens enviadas.
//   QUANDO      em que dias e em que horas do dia isso acontece.
//   QUÃO RÁPIDO quanto o cliente espera para ser respondido.
//   ONDE        por telefone do escritório.
//   QUEM        a equipe, uma linha por pessoa juntando as quatro contas de
//               pessoa (05/11) — e mostra todo mundo, porque comparação com
//               uma linha só não é comparação. Escolhida uma pessoa, a ficha
//               dela, com cada número ao lado da mediana da equipe.
//
// ------------------------------------------------------------------
// OS QUATRO FILTROS, E POR QUE ELES FICAM JUNTOS NO TOPO
// ------------------------------------------------------------------
//
//   PERÍODO       atalhos, mês a mês, ou duas datas escolhidas.
//   ATENDENTE     uma pessoa, ou todas.
//   TELEFONE      uma linha do escritório.
//   DEPARTAMENTO  todas as linhas de um setor.
//
// Uma barra só, acima de tudo o que ela recorta. Filtro dentro do cartão de
// cada gráfico faria dois gráficos vizinhos falarem de períodos diferentes sem
// avisar — e a tela inteira deixaria de fechar consigo mesma.
//
// ------------------------------------------------------------------
// CADA UM VÊ O QUE É SEU
// ------------------------------------------------------------------
//
// Quem não administra vê os PRÓPRIOS números e não tem o filtro de atendente.
// O recorte é feito NO BANCO: `painel_dashboard` ignora o "quem" que o
// navegador manda quando quem chama não é administrador. Recorte que o
// navegador pode desligar não é recorte — é sugestão.
//
// ------------------------------------------------------------------
// A CONTA É FEITA NO BANCO — e pelo mesmo motivo de sempre
// ------------------------------------------------------------------
//
// A API do Supabase devolve no máximo 1000 linhas por consulta e não avisa que
// cortou. Nada nesta tela conta nada: tudo o que aparece aqui veio somado de
// `painel_dashboard` (sql/2026-08-painel-completo.sql, na ponte).
//
// ------------------------------------------------------------------
// MEDIANA, E NÃO MÉDIA
// ------------------------------------------------------------------
//
// Um cliente que escreve às 22h e é respondido às 8h da manhã põe 10 horas
// dentro da média. A mediana diz como foi o atendimento TÍPICO; a média aparece
// do lado, menor — quando as duas estão longe, é porque houve caso fora da curva.
//
// ------------------------------------------------------------------
// AS CORES
// ------------------------------------------------------------------
//
// Duas, e só duas: verde para o que SAIU daqui, azul para o que CHEGOU. O par
// foi conferido para daltonismo nos dois temas (ΔE 17,4 no claro e 18,5 no
// escuro, contra o piso de 8). No ranking, uma cor só para as barras e verde
// apenas na SUA linha: pintar cada pessoa de um tom gastaria o único canal
// livre para repetir o que o comprimento da barra já mostra.
//
// Todo gráfico tem um botão "Tabela" que troca o desenho pelos números.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { campoDaPlanilha } from "./planilha.js";
import { semAFuncao } from "./gravar.js";
import { supabase } from "./supabase";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { diasDesde, DIAS_DO_VERMELHO } from "./espera.js";
import { Titulo, Grafico } from "./blocosDoPainel.jsx";
import TendenciasDoPainel from "./TendenciasDoPainel.jsx";
import {
  juntarAEquipe, colunasVisiveis, colunasDaFicha, fraseDoQueFaltou, ordenarAEquipe,
  sentidoDeComeco, mediana, aPessoaNaEquipe, baseDaComparacao, linhasDoCabecalho, COLUNAS_DA_EQUIPE,
} from "./painelDeGestao.js";
import { diasDaCarteira, rotuloDasAtrasadas, fraseDasAtrasadas, pontosDaFicha } from "./visaoGeral.js";
import VisaoGeral, { CORES_DO_STATUS } from "./VisaoGeral.jsx";
import {
  RefreshCw, AlertCircle, Table2, BarChart3, Info, Calendar,
  ChevronLeft, ChevronRight, ChevronDown, Check, X, Users, Phone, Building2,
  ListChecks, Download, UserCheck, SquareKanban, Ticket, Printer, CircleCheck, TriangleAlert,
} from "lucide-react";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// O TETO DO PERÍODO ESCOLHIDO À MÃO.
//
// A conta percorre as conversas do período procurando os silêncios de 6 horas,
// e a API do Supabase corta qualquer consulta em 8 segundos. Acima disto a tela
// morreria com "statement timeout" — e um filtro que às vezes explode é pior do
// que um filtro com limite escrito.
const MAX_DIAS = 400;

const CORES = {
  claro:  { saiu: "#008069", chegou: "#2a78d6", apagado: "#98a5ac", aviso: "#c98500", selo: "#008069" },
  // O SELO "você" tem letra branca, e no escuro o verde das barras (#00a884)
  // dava 3,0:1 com ela. O selo usa o verde dos botões (4,9) nos dois temas.
  escuro: { saiu: "#00a884", chegou: "#3987e5", apagado: "#6b7a83", aviso: "#e0a400", selo: "#008069" },
};
// A rampa do mapa de horários: UM tom só, do quase-invisível ao cheio. Rampa de
// várias cores ("arco-íris") faz o olho ler salto onde só há mais um pouco.
const RAMPA = {
  claro:  ["#eaf3f0", "#b8ded3", "#7cc6b1", "#31a98b", "#008069"],
  escuro: ["#1b2b2b", "#14413a", "#0e6350", "#0a8a6d", "#00a884"],
};

const numero = (n) => Number(n || 0).toLocaleString("pt-BR");

/** Segundos → "45 s", "12 min", "2 h 10 min", "3 d 4 h". */
function tempo(s) {
  if (s == null || s === "") return "—";
  const n = Math.round(Number(s));
  if (!isFinite(n)) return "—";
  if (n < 60) return `${n} s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  const h = Math.floor(n / 3600), m = Math.round((n % 3600) / 60);
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return d < 10 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** "2026-08-12" → "12/08" (ou "ago/26" quando o passo é mês).
 *  Fatiado na mão de propósito: `new Date("2026-08-12")` é lido como meia-noite
 *  em UTC e, no fuso daqui, volta um dia — a coluna de segunda apareceria como
 *  domingo. */
function rotuloData(iso, passo) {
  const [a, m, d] = String(iso).split("-").map(Number);
  if (passo === "month") return `${MESES[(m || 1) - 1]}/${String(a).slice(2)}`;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/* ==================================================================
   O PERÍODO
   ==================================================================
   Um período é `{ de, ate, tipo }`. O `tipo` existe só para as setinhas
   saberem o que é "um passo": num mês escolhido, o passo é um MÊS (e não 31
   dias, que cairia no meio do mês anterior); no resto, é a própria duração. */
const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fimDoDia = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const diasEntre = (de, ate) => Math.max(1, Math.round((fimDoDia(ate) - inicioDoDia(de)) / 86400e3));

function mesDe(ano, mes) {
  const de = new Date(ano, mes, 1, 0, 0, 0, 0);
  const ate = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  return { de, ate: ate > new Date() ? new Date() : ate, tipo: "mes" };
}
function ultimosDias(n) {
  const ate = new Date();
  // N DIAS CONTANDO HOJE (auditoria de 07/10): voltar `n` dias inteiros e
  // somar o de hoje dava n + 1 — o atalho "7 dias" mostrava "· 8 dias", e a
  // comparação com o período anterior media oito contra oito.
  const de = new Date(); de.setDate(de.getDate() - (n - 1)); de.setHours(0, 0, 0, 0);
  return { de, ate, tipo: "dias" };
}

function atalhos() {
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  const anoPassado = hoje.getFullYear() - 1;
  return [
    { chave: "hoje", rotulo: "Hoje", faz: () => ({ de: inicioDoDia(hoje), ate: new Date(), tipo: "dia" }) },
    { chave: "ontem", rotulo: "Ontem", faz: () => ({ de: inicioDoDia(ontem), ate: fimDoDia(ontem), tipo: "dia" }) },
    { chave: "7", rotulo: "7 dias", faz: () => ultimosDias(7) },
    { chave: "30", rotulo: "30 dias", faz: () => ultimosDias(30) },
    { chave: "90", rotulo: "90 dias", faz: () => ultimosDias(90) },
    { chave: "mes", rotulo: "Este mês", faz: () => mesDe(hoje.getFullYear(), hoje.getMonth()) },
    { chave: "mespassado", rotulo: "Mês passado", faz: () => mesDe(hoje.getFullYear(), hoje.getMonth() - 1) },
    { chave: "ano", rotulo: "Este ano",
      faz: () => ({ de: new Date(hoje.getFullYear(), 0, 1), ate: new Date(), tipo: "ano" }) },
    { chave: "anopassado", rotulo: "Ano passado",
      faz: () => ({ de: new Date(anoPassado, 0, 1), ate: new Date(anoPassado, 11, 31, 23, 59, 59, 999), tipo: "ano" }) },
  ];
}

function rotuloDoPeriodo(p) {
  const n = diasEntre(p.de, p.ate);
  if (p.tipo === "dia") {
    const hoje = inicioDoDia(new Date()).getTime();
    if (inicioDoDia(p.de).getTime() === hoje) return "Hoje";
    if (inicioDoDia(p.de).getTime() === hoje - 86400e3) return "Ontem";
    return p.de.toLocaleDateString("pt-BR");
  }
  if (p.tipo === "mes") return `${MESES[p.de.getMonth()]}/${p.de.getFullYear()} · ${n} dias`;
  if (p.tipo === "ano") return `${p.de.getFullYear()} · ${n} dias`;
  const f = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${f(p.de)} – ${f(p.ate)} · ${n} dias`;
}

/** Um passo para trás (-1) ou para frente (+1), sem passar de hoje. */
function passear(p, sentido) {
  const agora = new Date();
  if (p.tipo === "mes") {
    const alvo = mesDe(p.de.getFullYear(), p.de.getMonth() + sentido);
    return alvo.de > agora ? p : alvo;
  }
  // O ANO ANDA POR ANO CIVIL, como o mês anda por mês (auditoria de 28/10).
  // Pela conta dos dias, "Este ano" ← andava só os dias que o ano tinha até
  // hoje — 301 em 28/10 —, e caía no meio do ano passado: de 06/03 a 31/12,
  // com o rótulo "2025 · 301 dias".
  if (p.tipo === "ano") {
    const ano = p.de.getFullYear() + sentido;
    const de = new Date(ano, 0, 1);
    const ate = new Date(ano, 11, 31, 23, 59, 59, 999);
    if (de > agora) return p;
    return { de, ate: ate > agora ? agora : ate, tipo: p.tipo };
  }
  // EM DIAS INTEIROS, E NÃO EM MILISSEGUNDOS (auditoria de 27/10). A duração
  // era `fim do último dia − início do primeiro`, que é um dia menos 1 ms: o
  // período andava 1 ms a menos do que devia, o fim novo caía na meia-noite do
  // primeiro dia de antes, e a tela o lia como um dia a mais. Cada clique
  // esticava o período — 7 dias, 8, 9, 10 —, comparando semanas que não eram
  // semanas. `setDate` também atravessa a troca de horário de verão de um
  // computador fora do Brasil sem perder uma hora.
  const dias = Math.round((inicioDoDia(p.ate) - inicioDoDia(p.de)) / 86400e3) + 1;
  const de = inicioDoDia(p.de);
  de.setDate(de.getDate() + sentido * dias);
  const ateDia = inicioDoDia(p.ate);
  ateDia.setDate(ateDia.getDate() + sentido * dias);
  const ate = fimDoDia(ateDia);
  if (de > agora) return p;
  return { de, ate: ate > agora ? agora : ate, tipo: p.tipo };
}

/** Fecha o que estiver aberto ao clicar fora, ou ao apertar Esc. */
function useFora(ref, aoFechar, ativo) {
  useEffect(() => {
    if (!ativo) return;
    const clique = (e) => { if (ref.current && !ref.current.contains(e.target)) aoFechar(); };
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); aoFechar(); } };
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla, true);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla, true);
    };
  }, [ref, aoFechar, ativo]);
}

/* ================================================================
   UMA LEITURA DO BANCO, com o seu estado (05/11)
   ================================================================
   As quatro leituras que falam de PESSOA (o Painel, os protocolos, o "Já
   tratei" e a carteira) moram no alto da tela e descem para as seções. Antes
   cada seção lia a sua; a tabela da equipe, que junta as quatro, teria de ler
   tudo de novo — e cada uma dessas contas percorre as conversas do período.

   CADA UMA COM O SEU ESTADO: a falta de uma função não esconde as outras (a
   régua das seções). `semFuncao` é a função que não existe; o `falta` de
   dentro da resposta (o script de antes que falta) cada seção lê do seu jeito.
   A CHAVE É A PERGUNTA (os argumentos), e não o objeto, que nasce de novo a
   cada desenho. */
function useLeitura(nome, args) {
  const chave = JSON.stringify(args);
  const [estado, setEstado] = useState({ carregando: true, erro: "", semFuncao: false, dados: null });
  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: "", semFuncao: false }));
    (async () => {
      const { data, error } = await supabase.rpc(nome, JSON.parse(chave));
      if (!vivo) return;
      if (error) {
        setEstado(semAFuncao(error)
          ? { carregando: false, erro: "", semFuncao: true, dados: null }
          : { carregando: false, semFuncao: false, dados: null,
              erro: `${error.message || "erro desconhecido"}${error.code ? ` (código ${error.code})` : ""}` });
        return;
      }
      setEstado({ carregando: false, erro: "", semFuncao: false, dados: data || null });
    })();
    return () => { vivo = false; };
  }, [nome, chave]);
  return estado;
}

/** As seções da tela, na ordem dela: é o que o menu de imprimir oferece e o
 *  que a navegação do alto leva. */
const SECOES_DO_PAINEL = [
  // A VISÃO GERAL (05/11) vem primeiro: é o resumo de tudo o que está embaixo.
  { id: "visao", curto: "Visão geral", rotulo: "Visão geral" },
  // AS TENDÊNCIAS (06/11): a entrada e a saída, e o prazo por dia e por hora.
  { id: "tendencias", curto: "Tendências", rotulo: "Tendências do período" },
  { id: "equipe", curto: "Equipe" },
  { id: "protocolos", curto: "Protocolos", rotulo: "Protocolos de atendimento" },
  { id: "atendimentos", curto: "Mensagens", rotulo: "Atendimentos e mensagens" },
  { id: "carteira", curto: "Carteira", rotulo: "Carteira de cada responsável" },
  { id: "funil", curto: "Funil", rotulo: "Funil" },
  { id: "jatratei", curto: "Já tratei", rotulo: "Já tratei" },
];

export default function PainelNumeros({ C: CDaTela, CClaro = null, modo: modoDaTela = "claro", advogados = [], departamentos = [],
                                        souAdmin = false, meuId = null, meuNome = "", aoFechar }) {
  // NO PAPEL, SEMPRE O TEMA CLARO (ver `CSS_DA_IMPRESSAO`): quem trabalha no
  // escuro imprimiria uma folha preta. `imprimindo` liga no `beforeprint` e
  // desliga no `afterprint`, e o resto da tela não sabe de nada.
  const [imprimindo, setImprimindo] = useState(false);
  const C = imprimindo && CClaro ? CClaro : CDaTela;
  const modo = imprimindo ? "claro" : modoDaTela;
  const cores = CORES[modo] || CORES.claro;
  const rampa = RAMPA[modo] || RAMPA.claro;

  const [periodo, setPeriodoDaBarra] = useState(() => ultimosDias(30));
  // O RECORTE DE UM DIA (06/11): clicar num dia de um gráfico das tendências
  // leva a tela inteira para aquele dia, e guarda o período de antes para a
  // barra oferecer a volta. Escolher outro período na barra esquece a volta:
  // ela é do clique, e não de qualquer troca.
  const [periodoAntes, setPeriodoAntes] = useState(null);
  const setPeriodo = (p) => { setPeriodoAntes(null); setPeriodoDaBarra(p); };
  const verDia = (quando) => {
    const d = new Date(`${quando}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const agora = new Date();
    const fim = fimDoDia(d);
    setPeriodoAntes((v) => v || periodo);
    setPeriodoDaBarra({ de: inicioDoDia(d), ate: fim > agora ? agora : fim, tipo: "dia" });
  };
  // Quem não administra não escolhe atendente: é sempre ele mesmo.
  const [quem, setQuem] = useState(souAdmin ? null : meuId);
  // OUTRA PESSOA ESCOLHIDA (auditoria de 28/10): o banco diz `so_meu` para
  // qualquer recorte por pessoa, e "os seus números" seria mentira para quem
  // administra e escolheu a colega.
  const outraPessoa = souAdmin && quem != null && String(quem) !== String(meuId);
  const [telefone, setTelefone] = useState(null);
  const [departamento, setDepartamento] = useState(null);

  // O FUSO DE QUEM ESTÁ OLHANDO. Sem mandá-lo, o banco (que roda em UTC) corta
  // o dia às 21h e o mapa de horários sai três horas deslocado.
  const fuso = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Campo_Grande"; }
    catch (_) { return "America/Campo_Grande"; }
  }, []);

  const deIso = periodo.de.toISOString(), ateIso = periodo.ate.toISOString();

  // AS QUATRO LEITURAS DE PESSOA (ver `useLeitura`). O banco sem a função do
  // Painel NÃO tem plano B honesto: contar no navegador é justamente o que
  // dava número errado. E o código vai junto na frase, a régua das seções.
  const lPainel = useLeitura("painel_dashboard", {
    p_desde: deIso, p_ate: ateIso, p_quem: quem, p_fuso: fuso,
    p_telefone: telefone, p_departamento: departamento,
  });
  const lProtocolos = useLeitura("zorvin_relatorio_atendimentos", {
    p_desde: deIso, p_ate: ateIso, p_quem: quem, p_fuso: fuso,
    p_telefone: telefone, p_departamento: departamento, p_limite: 1000,
  });
  const lCarteira = useLeitura("zorvin_relatorio_responsaveis", {
    p_telefone: telefone, p_departamento: departamento, p_fuso: fuso,
  });
  const lTratados = useLeitura("zorvin_relatorio_tratados", {
    p_desde: deIso, p_ate: ateIso, p_quem: quem, p_fuso: fuso,
    p_telefone: telefone, p_departamento: departamento, p_limite: 1000,
  });
  const carregando = lPainel.carregando, erro = lPainel.erro, faltaSql = lPainel.semFuncao, d = lPainel.dados;

  // A EQUIPE, JUNTANDO AS QUATRO (ver `painelDeGestao.js`). Só depois de as
  // quatro responderem: desenhada no meio do caminho, a tabela ganharia
  // colunas uma a uma, empurrando o que está embaixo a cada resposta.
  const todasResponderam = !lPainel.carregando && !lProtocolos.carregando && !lCarteira.carregando && !lTratados.carregando;
  const fontes = useMemo(() => {
    if (!todasResponderam) return null;
    const veio = (l) => Boolean(l.dados) && !l.erro && !l.semFuncao && !(l.dados && l.dados.falta);
    return {
      painel: veio(lPainel),
      protocolos: veio(lProtocolos),
      // O TEMPO EM EXPEDIENTE (script 052 da ponte): vem com os protocolos, e
      // o banco de antes não manda a chave do prazo — sem ela, a coluna some.
      expediente: veio(lProtocolos) && Object.prototype.hasOwnProperty.call(lProtocolos.dados, "prazo"),
      tratados: veio(lTratados),
      // Quem não administra recebe só a PRÓPRIA carteira (o banco recorta):
      // a dos colegas não veio, e não é zero.
      carteira: veio(lCarteira) ? (lCarteira.dados.so_meu ? "parcial" : true) : false,
    };
  }, [todasResponderam, lPainel, lProtocolos, lTratados, lCarteira]);
  const equipe = useMemo(() => (fontes ? juntarAEquipe({
    painel: (lPainel.dados && lPainel.dados.por_atendente) || [],
    protocolos: (lProtocolos.dados && lProtocolos.dados.por_pessoa) || [],
    tratados: (lTratados.dados && lTratados.dados.por_pessoa) || [],
    carteira: (lCarteira.dados && lCarteira.dados.linhas) || [],
    fontes, meuId,
  }) : null), [fontes, lPainel.dados, lProtocolos.dados, lTratados.dados, lCarteira.dados, meuId]);
  // A RÉGUA DAS ATRASADAS (script 051 da ponte): "Há +2 dias" com ele, "Há +3
  // dias" no banco de antes. É a resposta do banco que diz, e não a tela.
  const diasDaRegua = diasDaCarteira(lCarteira.dados);

  // ---------- a linguagem visual ----------
  const sombra = modo === "escuro"
    ? "0 1px 2px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.02)"
    : "0 1px 2px rgba(11,20,26,.06), 0 1px 3px rgba(11,20,26,.05)";
  const cartao = { background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 14,
                   padding: "16px 18px", boxShadow: sombra };
  const rotulo = { fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.6,
                   textTransform: "uppercase" };
  // Sem `tabular-nums` no número grande: dígitos de largura igual deixam "121"
  // parecendo frouxo em tamanho de manchete.
  const valor = { fontSize: 30, fontWeight: 700, marginTop: 6, lineHeight: 1.1, letterSpacing: -0.5 };
  const nota = { fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 };
  const th = { textAlign: "left", fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.5,
               textTransform: "uppercase", padding: "0 0 8px", borderBottom: `1px solid ${C.divider}` };
  const td = { padding: "10px 0", borderBottom: `1px solid ${C.divider}`, fontSize: 14 };
  const thNum = { ...th, textAlign: "right", paddingLeft: 14, whiteSpace: "nowrap" };
  const num = { ...td, textAlign: "right", paddingLeft: 14, fontVariantNumeric: "tabular-nums", fontWeight: 600 };
  const estilos = { cartao, rotulo, valor, nota, th, td, thNum, num, sombra };

  const t = (d && d.total) || {};
  const antes = (d && d.antes) || {};
  const passo = (d && d.passo) || "day";
  const serie = (d && d.por_periodo) || [];

  // ---------- as opções dos filtros ----------
  // OS NOMES JÁ VISTOS, de todo período que veio nesta abertura: é daqui que
  // sai o nome de quem está escolhido num período em que não atendeu ninguém.
  const nomesVistosRef = useRef(new Map());
  const opcoesAtendente = useMemo(() => {
    const vistos = new Map();
    // DA EQUIPE INTEIRA (05/11), e não só do ranking de atendimentos: quem só
    // finalizou ou só marcou "Já tratei" no período também pode ser escolhido,
    // e com o nome dela.
    const pessoas = equipe ? equipe.linhas.filter((l) => l.id && !l.pelonome)
                           : (d?.por_atendente || []).filter((p) => p.id);
    pessoas.forEach((p) => {
      vistos.set(String(p.id), p.nome || "(sem nome)");
      nomesVistosRef.current.set(String(p.id), p.nome || "(sem nome)");
    });
    // Eu apareço sempre, mesmo num período em que não atendi nada — senão o
    // filtro "só eu" some justamente quando eu quero saber por que sumi.
    if (meuId && !vistos.has(String(meuId))) vistos.set(String(meuId), meuNome || "Você");
    // E quem estiver selecionado continua na lista mesmo que saia do período,
    // senão trocar o mês faria o filtro se apagar sozinho.
    // COM O NOME DELA, e não o meu (auditoria de 27/10): a linha dizia
    // `meuNome` para qualquer pessoa escolhida que saísse do período, e o
    // filtro passava a escrever o nome de quem olha sobre os números de outra
    // pessoa.
    if (quem && !vistos.has(String(quem))) {
      vistos.set(String(quem), nomesVistosRef.current.get(String(quem))
        || (String(quem) === String(meuId) ? (meuNome || "Você") : "Atendente escolhido"));
    }
    return [{ valor: null, rotulo: "Todos os atendentes" },
            ...[...vistos.entries()]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, nome]) => ({ valor: id, rotulo: id === String(meuId) ? `${nome} (você)` : nome }))];
  }, [d, equipe, meuId, meuNome, quem]);

  const opcoesTelefone = useMemo(() => {
    const lista = departamento
      ? advogados.filter((a) => String(a.departamento_id) === String(departamento))
      : advogados;
    return [{ valor: null, rotulo: "Todos os telefones" },
            ...lista.map((a) => ({ valor: a.id, rotulo: a.nome || a.numero }))];
  }, [advogados, departamento]);

  const opcoesDepartamento = useMemo(() => ([
    { valor: null, rotulo: "Todos os departamentos" },
    ...departamentos.map((x) => ({ valor: String(x.id), rotulo: x.nome })),
  ]), [departamentos]);

  // Trocar de departamento derruba um telefone que não é mais dele — senão o
  // painel mostraria "Departamento: Acordos · Telefone: Financeiro" e zero
  // linhas, sem dizer por quê.
  useEffect(() => {
    if (!telefone || !departamento) return;
    const a = advogados.find((x) => String(x.id) === String(telefone));
    if (a && String(a.departamento_id) !== String(departamento)) setTelefone(null);
  }, [departamento, telefone, advogados]);

  const nomeDe = (lista, v) => lista.find((o) => String(o.valor) === String(v))?.rotulo || "";
  const limpaveis = [
    quem && souAdmin ? { rotulo: nomeDe(opcoesAtendente, quem), limpar: () => setQuem(null) } : null,
    telefone ? { rotulo: nomeDe(opcoesTelefone, telefone), limpar: () => setTelefone(null) } : null,
    departamento ? { rotulo: nomeDe(opcoesDepartamento, departamento), limpar: () => setDepartamento(null) } : null,
  ].filter(Boolean);

  // ---------- a pessoa escolhida ----------
  const linhaDaPessoa = quem != null && equipe ? equipe.linhas.find((l) => l.id != null && String(l.id) === String(quem)) : null;
  const nomeDaPessoa = quem == null ? "" : (linhaDaPessoa && linhaDaPessoa.nome)
    || nomesVistosRef.current.get(String(quem))
    || (String(quem) === String(meuId) ? (meuNome || "Você") : "Pessoa escolhida");
  const escolherPessoa = (id) => souAdmin && setQuem((v) => (String(v) === String(id) ? null : id));

  // ---------- a impressão ----------
  const secoes = SECOES_DO_PAINEL.map((s) => (s.id === "equipe"
    ? { ...s, rotulo: quem != null ? "A pessoa e a equipe" : "A equipe" } : s));
  const [paraImprimir, setParaImprimir] = useState(() => new Set(SECOES_DO_PAINEL.map((s) => s.id)));
  const fora = (id) => (paraImprimir.has(id) ? undefined : "");
  const [geradoEm, setGeradoEm] = useState(() => new Date());
  const dataLonga = (x) => x.toLocaleDateString("pt-BR");
  const nDias = diasEntre(periodo.de, periodo.ate);
  const linhasDoPapel = linhasDoCabecalho({
    periodo: `${dataLonga(periodo.de)} a ${dataLonga(periodo.ate)} · ${nDias} ${nDias === 1 ? "dia" : "dias"}`,
    quem: quem != null ? nomeDaPessoa : null,
    telefone: telefone ? nomeDe(opcoesTelefone, telefone) : null,
    departamento: departamento ? nomeDe(opcoesDepartamento, departamento) : null,
    geradoEm, geradoPor: meuNome,
  });
  // O NOME DO ARQUIVO do "Salvar como PDF" sai do título da guia.
  const tituloDoPapel = `Relatório de atendimento — ${quem != null ? nomeDaPessoa : "equipe"} — ${rotuloDoPeriodo(periodo)}`;
  const tituloDoPapelRef = useRef(tituloDoPapel);
  tituloDoPapelRef.current = tituloDoPapel;
  useEffect(() => {
    let tituloDeAntes = null;
    const antes = () => {
      tituloDeAntes = document.title;
      document.title = tituloDoPapelRef.current;
      // SÍNCRONO: o navegador monta a folha logo depois deste evento.
      flushSync(() => { setImprimindo(true); setGeradoEm(new Date()); });
    };
    const depois = () => {
      if (tituloDeAntes != null) document.title = tituloDeAntes;
      tituloDeAntes = null;
      setImprimindo(false);
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => { window.removeEventListener("beforeprint", antes); window.removeEventListener("afterprint", depois); };
  }, []);
  const imprimir = () => { try { window.print(); } catch (_) { /* o navegador sem impressão */ } };

  // ---------- a navegação das seções ----------
  // SÓ AS SEÇÕES QUE TÊM ALGO DESENHADO: sem a função do banco, quem atende
  // não vê a seção, e o atalho para ela levaria a lugar nenhum.
  const telaRef = useRef(null);
  const barraRef = useRef(null);
  const [comConteudo, setComConteudo] = useState([]);
  useEffect(() => {
    const vis = SECOES_DO_PAINEL.filter((s) => {
      const el = document.getElementById(`secao-do-painel-${s.id}`);
      return el && el.offsetHeight > 8;
    }).map((s) => s.id);
    setComConteudo((v) => (v.join(",") === vis.join(",") ? v : vis));
  });
  const irPara = (id) => {
    const el = document.getElementById(`secao-do-painel-${id}`), tela = telaRef.current;
    if (!el || !tela) return;
    const barra = barraRef.current ? barraRef.current.offsetHeight : 0;
    const topo = el.getBoundingClientRect().top - tela.getBoundingClientRect().top + tela.scrollTop - barra - 10;
    tela.scrollTo({ top: Math.max(0, topo), behavior: "smooth" });
  };

  return (
    <div data-tela="painel" ref={telaRef} data-imprimindo={imprimindo ? "sim" : undefined}
         style={{ position: "fixed", inset: 0, background: C.headerBar, color: C.textPrimary,
                  zIndex: 200, overflowY: "auto" }}>
      <style>{CSS_DA_IMPRESSAO}</style>

      {/* ================= A BARRA DE FILTROS ================= */}
      <div ref={barraRef} data-nao-imprime data-barra-do-painel
           style={{ position: "sticky", top: 0, zIndex: 30, background: C.panel,
                    borderBottom: `1px solid ${C.divider}`, boxShadow: sombra }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 18px",
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* A TELA É UMA GUIA (02/11): o botão fecha a guia, e o navegador
              volta para a das conversas. Era a seta "Voltar", de quando a tela
              abria por cima delas. */}
          <button onClick={aoFechar} title="Fechar esta guia" aria-label="Fechar esta guia" data-fechar-a-guia
                  style={{ border: "none", background: "transparent", cursor: "pointer",
                           display: "flex", alignItems: "center", padding: 6, marginLeft: -6,
                           borderRadius: 8, color: C.textSecondary }}>
            <X size={20} />
          </button>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2, marginRight: 4 }}>Painel</div>

          <SeletorDePeriodo C={C} cores={cores} periodo={periodo} definir={setPeriodo}
                            estilos={estilos} sombra={sombra} />

          <div style={{ flex: "1 1 auto" }} />

          {souAdmin && (
            <Escolha C={C} sombra={sombra} icone={Users} grupo="escopo"
                     opcoes={opcoesAtendente} valor={quem} definir={setQuem} />
          )}
          <Escolha C={C} sombra={sombra} icone={Phone} grupo="telefone"
                   opcoes={opcoesTelefone} valor={telefone} definir={setTelefone} />
          {departamentos.length > 1 && (
            <Escolha C={C} sombra={sombra} icone={Building2} grupo="departamento"
                     opcoes={opcoesDepartamento} valor={departamento} definir={setDepartamento} />
          )}
        </div>

        {/* O que está aplicado, e como tirar. Sem esta linha, um filtro
            esquecido num menu fechado explica um número baixo sem aparecer. */}
        {limpaveis.length > 0 && (
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px 12px",
                        display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...nota, fontSize: 12 }}>Filtrando por:</span>
            {limpaveis.map((f) => (
              <button key={f.rotulo} onClick={f.limpar}
                style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 28,
                         padding: "3px 8px 3px 11px", borderRadius: 20, cursor: "pointer",
                         border: `1px solid ${C.greenDark}`, background: "transparent",
                         color: C.verdeTexto, fontSize: 12.5, fontWeight: 600 }}>
                {f.rotulo} <X size={13} />
              </button>
            ))}
            <button onClick={() => { setQuem(souAdmin ? null : meuId); setTelefone(null); setDepartamento(null); }}
              style={{ border: "none", background: "transparent", cursor: "pointer",
                       color: C.textSecondary, fontSize: 12.5, textDecoration: "underline", padding: "4px 6px" }}>
              limpar tudo
            </button>
          </div>
        )}

        {/* A VOLTA DO RECORTE DE UM DIA: sem ela, quem clicou num dia para
            olhar de perto ficaria preso nele, procurando no seletor o período
            de antes. */}
        {periodoAntes && (
          <div data-recorte-do-dia
               style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px 12px",
                        display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...nota, fontSize: 12.5 }}>
              Vendo só <b style={{ color: C.textPrimary }}>{periodo.de.toLocaleDateString("pt-BR")}</b>, o dia clicado num gráfico.
            </span>
            <button onClick={() => { const antes = periodoAntes; setPeriodoAntes(null); setPeriodoDaBarra(antes); }}
                    data-voltar-do-dia
                    style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 28, padding: "3px 11px",
                             borderRadius: 20, cursor: "pointer", border: `1px solid ${C.greenDark}`,
                             background: "transparent", color: C.verdeTexto, fontSize: 12.5, fontWeight: 600 }}>
              Voltar para {rotuloDoPeriodo(periodoAntes)}
            </button>
          </div>
        )}

        {/* OS ATALHOS PARA CADA SEÇÃO, e o botão de imprimir na ponta: a
            tela tem oito seções, e a de baixo fica a muitas rolagens da de
            cima. Os atalhos rolam de lado no celular, para a barra não
            crescer, e o botão fica sempre à vista (só o ícone, no celular). */}
        <div data-linha-das-secoes
             style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px 10px",
                      display: "flex", alignItems: "center", gap: 10 }}>
          <nav data-nav-do-painel aria-label="Seções do painel"
               style={{ flex: "1 1 auto", minWidth: 0, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
            {comConteudo.length > 1 && SECOES_DO_PAINEL.filter((s) => comConteudo.includes(s.id)).map((s) => (
              <button key={s.id} onClick={() => irPara(s.id)} data-ir-para={s.id}
                      style={{ flexShrink: 0, minHeight: 28, padding: "3px 11px", borderRadius: 14, cursor: "pointer",
                               border: `1px solid ${C.divider}`, background: C.headerBar, color: C.textSecondary,
                               fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                {s.curto}
              </button>
            ))}
          </nav>
          <BotaoDeImprimir C={C} sombra={sombra} secoes={secoes} escolhidas={paraImprimir}
                           definir={setParaImprimir} imprimir={imprimir} />
        </div>
      </div>

      <div data-conteudo-do-painel style={{ padding: "20px 18px 40px", maxWidth: 1180, margin: "0 auto" }}>
        <CabecalhoDaImpressao linhas={linhasDoPapel}
                              secoesFora={secoes.filter((s) => !paraImprimir.has(s.id)).map((s) => s.rotulo)} />

        {/* A VISÃO GERAL (05/11): os indicadores, os destaques e as roscas,
            das leituras que a tela já faz (ver VisaoGeral.jsx). */}
        <section id="secao-do-painel-visao" data-secao-do-painel="visao" data-nao-imprime={fora("visao")}>
          <VisaoGeral C={C} estilos={estilos} modo={modo} lProtocolos={lProtocolos} lCarteira={lCarteira}
                      deIso={deIso} ateIso={ateIso}
                      departamentos={departamentos} departamento={departamento}
                      quem={quem} nome={nomeDaPessoa} sou={quem != null && String(quem) === String(meuId)}
                      souAdmin={souAdmin} rotuloPeriodo={rotuloDoPeriodo(periodo)}
                      aoIrPara={irPara}
                      aoEscolherDepartamento={(id) => setDepartamento((v) => (String(v) === String(id) ? null : String(id)))} />
        </section>

        {/* AS TENDÊNCIAS (06/11): para onde os números vão, dia a dia e hora
            a hora, da leitura dos protocolos que a tela já faz. */}
        <section id="secao-do-painel-tendencias" data-secao-do-painel="tendencias" data-nao-imprime={fora("tendencias")}>
          <TendenciasDoPainel C={C} estilos={estilos} modo={modo} leitura={lProtocolos}
                              deIso={deIso} ateIso={ateIso} quem={quem}
                              aoVerDia={periodo.tipo === "dia" ? null : verDia} />
        </section>

        {/* A PESSOA E A EQUIPE (05/11): o atendimento de CADA pessoa. */}
        <section id="secao-do-painel-equipe" data-secao-do-painel="equipe" data-nao-imprime={fora("equipe")}>
          <Titulo C={C}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Users size={16} /> {quem != null ? "A pessoa e a equipe" : "A equipe"}
            </span>
          </Titulo>
          {!equipe && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, padding: "10px 0 6px" }}
                 data-equipe-carregando>
              <RefreshCw size={16} /> Juntando os números de cada pessoa…
            </div>
          )}
          {equipe && quem != null && (
            <FichaDaPessoa C={C} estilos={estilos} cores={cores} linhas={equipe.linhas} fontes={fontes}
                           quem={quem} nome={nomeDaPessoa} sou={String(quem) === String(meuId)} periodo={periodo}
                           dias={diasDaRegua} />
          )}
          {equipe && (
            <AEquipe C={C} estilos={estilos} cores={cores} linhas={equipe.linhas} fontes={fontes}
                     foraDaTabela={equipe.foraDaTabela} faltou={fraseDoQueFaltou(fontes)}
                     quem={quem} meuId={meuId} podeEscolher={souAdmin} aoEscolher={escolherPessoa}
                     dias={diasDaRegua} />
          )}
        </section>

        {/* OS PROTOCOLOS VÊM PRIMEIRO: é a contabilização do DataCrazy, que o
            Rodrigo pediu, e o resumo de mensagens de baixo é uma conta mais
            antiga com outro sentido de "atendimento". Função própria no banco
            (script 029), fora do bloco de baixo pela régua das outras seções:
            a falta de uma função não esconde a outra. */}
        <section id="secao-do-painel-protocolos" data-secao-do-painel="protocolos" data-nao-imprime={fora("protocolos")}>
          <RelatorioProtocolos C={C} estilos={estilos} cores={cores} deIso={deIso} ateIso={ateIso} leitura={lProtocolos}
                               quem={quem}
                               souAdmin={souAdmin} meuId={meuId} advogados={advogados}
                               aoEscolherPessoa={escolherPessoa} />
        </section>

        <section id="secao-do-painel-atendimentos" data-secao-do-painel="atendimentos" data-nao-imprime={fora("atendimentos")}>

        {carregando && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, padding: 24 }}>
            <RefreshCw size={16} /> Somando os atendimentos…
          </div>
        )}

        {faltaSql && (
          <div style={{ ...cartao, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertCircle size={20} color={cores.aviso} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              <b>Falta um passo no banco.</b>
              <div style={{ ...nota, marginTop: 6 }}>
                Este painel soma tudo dentro do banco, e a função que faz essa conta
                ainda não foi criada (ou está numa versão antiga, sem os filtros de
                telefone e departamento). Rode o arquivo
                {" "}<code style={{ background: C.headerBar, padding: "1px 5px", borderRadius: 4 }}>
                  sql/2026-08-painel-completo.sql
                </code>{" "}
                (repositório da ponte) no SQL Editor do Supabase e abra esta tela de novo.
                <div style={{ marginTop: 8 }}>
                  Não mostro número nenhum enquanto isso: a conta feita aqui fora dá
                  resultado errado em base grande, e errado com cara de certo é pior
                  do que vazio.
                </div>
              </div>
            </div>
          </div>
        )}

        {!!erro && (
          <div style={{ ...cartao, borderColor: "#e5573f", color: C.erroTexto }}>
            Não consegui somar os atendimentos: {erro}
          </div>
        )}

        {!carregando && !erro && !faltaSql && d && (
          <>
            <div style={{ ...nota, marginBottom: 14 }} data-teste="escopo">
              {d.so_meu && outraPessoa
                ? <>Estes são os números <b style={{ color: C.textPrimary }}>da pessoa escolhida</b>: os atendimentos que ela pegou e as mensagens que passaram por eles. A tabela da equipe, no alto da tela, continua mostrando todo mundo.</>
                : d.so_meu
                ? <>Estes são <b style={{ color: C.textPrimary }}>os seus números</b>{meuNome && !souAdmin ? ` (${meuNome})` : ""}: os atendimentos que você pegou e as mensagens que passaram por eles. A tabela da equipe, no alto da tela, continua mostrando todo mundo.</>
                : <>Estes são os números <b style={{ color: C.textPrimary }}>do escritório inteiro</b> — de todos os telefones que você alcança.</>}
              {" "}<b style={{ color: C.textPrimary }}>{rotuloDoPeriodo(periodo)}</b>.
            </div>

            {/* ---- os números ---- */}
            <div style={{ display: "grid", gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <Numero destaque C={C} estilos={estilos} antes={antes} etiqueta="Atendimentos"
                      v={t.atendimentos} comparar="atendimentos"
                      ajuda="Um trecho de conversa. Começa quando alguém escreve depois de 6 horas de silêncio e termina nas 6 horas de silêncio seguintes." />
              <Numero C={C} estilos={estilos} antes={antes} etiqueta="Recebidas" v={t.recebidas} comparar="recebidas" />
              <Numero C={C} estilos={estilos} antes={antes} etiqueta="Enviadas" v={t.enviadas} comparar="enviadas" />
              <Numero C={C} estilos={estilos} antes={antes} etiqueta="Notas internas" v={t.notas}
                      ajuda="Ficam à parte e não entram no total de mensagens: nunca saíram daqui." />
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <Tempo C={C} estilos={estilos} etiqueta="Tempo de resposta"
                     mediana={t.resposta_mediana} media={t.resposta_media} quantos={t.respostas}
                     ajuda="Do momento em que o contato escreve até a nossa primeira resposta. Mensagens seguidas dele contam como uma pergunta só." />
              <Tempo C={C} estilos={estilos} etiqueta="Tempo para atender"
                     mediana={t.espera_mediana} media={t.espera_media} quantos={t.esperas}
                     ajuda="Do início do atendimento até a primeira resposta. Só vale quando foi o contato quem procurou: quando nós procuramos primeiro, não há espera para medir." />
            </div>

            <Situacao t={t} C={C} cores={cores} estilos={estilos} />

            <Titulo C={C}>Atendimentos por período</Titulo>
            <Grafico C={C} estilos={estilos} legenda={null}
              colunas={["Quando", "Atendimentos"]}
              linhas={serie.map((s) => [rotuloData(s.quando, passo), numero(s.atendimentos)])}
              vazio={serie.every((s) => !s.atendimentos)}
              desenho={() => (
                <Colunas C={C} dados={serie} passo={passo} formatar={numero}
                         series={[{ campo: "atendimentos", cor: cores.saiu, nome: "Atendimentos" }]} />
              )} />

            <Titulo C={C}>Mensagens por período</Titulo>
            <Grafico C={C} estilos={estilos}
              legenda={[{ nome: "Recebidas", cor: cores.chegou }, { nome: "Enviadas", cor: cores.saiu }]}
              colunas={["Quando", "Recebidas", "Enviadas"]}
              linhas={serie.map((s) => [rotuloData(s.quando, passo), numero(s.recebidas), numero(s.enviadas)])}
              vazio={serie.every((s) => !s.recebidas && !s.enviadas)}
              desenho={() => (
                <Colunas C={C} dados={serie} passo={passo} formatar={numero}
                         series={[{ campo: "recebidas", cor: cores.chegou, nome: "Recebidas" },
                                  { campo: "enviadas",  cor: cores.saiu,   nome: "Enviadas" }]} />
              )} />

            <Titulo C={C}>Tempo de resposta, dia a dia</Titulo>
            <Grafico C={C} estilos={estilos}
              legenda={[{ nome: "Responder", cor: cores.saiu }, { nome: "Atender (primeira resposta)", cor: cores.chegou }]}
              colunas={["Quando", "Resposta", "Atender"]}
              linhas={serie.map((s) => [rotuloData(s.quando, passo), tempo(s.resposta), tempo(s.espera)])}
              vazio={serie.every((s) => s.resposta == null && s.espera == null)}
              rodape="A mediana de cada dia. Dia sem barra é dia sem resposta nenhuma para medir — não é dia de resposta instantânea."
              desenho={() => (
                <Colunas C={C} dados={serie} passo={passo} formatar={tempo}
                         series={[{ campo: "resposta", cor: cores.saiu,   nome: "Responder" },
                                  { campo: "espera",   cor: cores.chegou, nome: "Atender" }]} />
              )} />

            <Titulo C={C}>Atendimentos por horário</Titulo>
            <Mapa C={C} estilos={estilos} dados={d.por_hora || []} rampa={rampa} />

            <Titulo C={C}>Por telefone</Titulo>
            <Telefones C={C} estilos={estilos} cores={cores} dados={d.por_telefone || []}
                       advogados={advogados} departamentos={departamentos}
                       telefone={telefone} departamento={departamento}
                       aoEscolher={(id) => setTelefone((v) => (String(v) === String(id) ? null : id))} />

            {/* O "POR ATENDENTE" SAIU DAQUI (05/11): cada pessoa está na
                tabela da equipe, no alto, com estes números e os das outras
                três contas. */}
            <Ressalvas d={d} t={t} C={C} estilos={estilos} />
          </>
        )}
        </section>

        {/* A CARTEIRA DE CADA RESPONSÁVEL — fora do bloco de cima pela mesma
            razão do "Já tratei": função própria no banco (script 011). Usa
            telefone e departamento da barra, e NÃO o período: é a foto de
            agora, e a seção diz isso. */}
        <section id="secao-do-painel-carteira" data-secao-do-painel="carteira" data-nao-imprime={fora("carteira")}>
          <RelatorioResponsaveis C={C} estilos={estilos} cores={cores} leitura={lCarteira}
                                 souAdmin={souAdmin} meuId={meuId} />
        </section>

        {/* O FUNIL — função própria no banco (script 019), fora do bloco de
            cima pela mesma razão das outras duas. Usa o período para o que
            ACONTECEU (entradas, saídas, tempo de quem saiu) e não para o que
            ESTÁ (quantos em cada etapa agora) — e a seção diz qual é qual. */}
        <section id="secao-do-painel-funil" data-secao-do-painel="funil" data-nao-imprime={fora("funil")}>
          <RelatorioFunil C={C} estilos={estilos} cores={cores} deIso={deIso} ateIso={ateIso}
                          telefone={telefone} departamento={departamento} souAdmin={souAdmin} />
        </section>

        {/* O "JÁ TRATEI" FICA FORA do bloco de cima, de propósito: ele tem a
            própria função no banco (script 010), e um banco sem a do Painel
            não pode esconder o relatório — nem o contrário. Os FILTROS são os
            mesmos: uma barra só, acima de tudo o que ela recorta. */}
        <section id="secao-do-painel-jatratei" data-secao-do-painel="jatratei" data-nao-imprime={fora("jatratei")}>
          <RelatorioJaTratei C={C} estilos={estilos} cores={cores} leitura={lTratados}
                             deIso={deIso} ateIso={ateIso} passo="day"
                             quem={quem}
                             souAdmin={souAdmin} meuId={meuId} advogados={advogados}
                             aoEscolherPessoa={escolherPessoa} />
        </section>
      </div>
    </div>
  );
}

/* ================================================================
   A PESSOA E A EQUIPE (05/11)
   ================================================================
   Pedido do Rodrigo: "um Dashboard interativo onde eu consiga acessar os
   dados mais relevantes sobre o atendimento individual de cada usuário".

   O atendimento de cada pessoa estava em QUATRO tabelas, no fim de quatro
   seções. Aqui elas viram uma linha por pessoa (`juntarAEquipe`), com um
   gráfico da métrica escolhida em cima. A métrica do gráfico e a ordem da
   tabela andam juntas: escolher "Finalizou" ordena as duas.

   UMA COR SÓ PARA AS BARRAS, e o verde numa linha: a da pessoa escolhida, ou
   a sua quando ninguém está escolhido. Uma cor por pessoa gastaria o único
   canal livre para repetir o que o comprimento já mostra (a régua do ranking
   de antes, que esta seção substitui). */
const formatarColuna = (c, v) => (v == null ? "—" : c.tipo === "tempo" ? tempo(v) : numero(v));
const posicaoPorExtenso = (p) => (p.posicao == null ? "" : `${p.posicao}º de ${p.de}`);

function AEquipe({ C, estilos, cores, linhas, fontes, foraDaTabela, faltou, quem, meuId, podeEscolher, aoEscolher, dias }) {
  const colunas = useMemo(() => colunasVisiveis(fontes, dias), [fontes, dias]);
  const [metrica, setMetrica] = useState("atendimentos");
  const [ordem, setOrdem] = useState({ coluna: "atendimentos", sentido: "desc" });
  // A MÉTRICA TEM DE EXISTIR entre as colunas que vieram: sem a função do
  // Painel, "Atendimentos" não está na tela, e o gráfico vai para a primeira.
  const col = colunas.find((c) => c.id === metrica) || colunas[0] || null;
  const ordemValida = ordem.coluna === "nome" || colunas.some((c) => c.id === ordem.coluna)
    ? ordem : { coluna: col ? col.id : "nome", sentido: col ? sentidoDeComeco(col.id) : "asc" };

  const escolher = (id) => {
    setMetrica(id);
    setOrdem((o) => (o.coluna === id ? { coluna: id, sentido: o.sentido === "asc" ? "desc" : "asc" }
                                     : { coluna: id, sentido: sentidoDeComeco(id) }));
  };
  const ordenarPorNome = () => setOrdem((o) => ({ coluna: "nome", sentido: o.coluna === "nome" && o.sentido === "asc" ? "desc" : "asc" }));

  const tabela = useMemo(() => ordenarAEquipe(linhas, ordemValida.coluna, ordemValida.sentido),
                         [linhas, ordemValida.coluna, ordemValida.sentido]);
  // O GRÁFICO só leva quem tem o número: quem não respondeu ninguém não tem
  // tempo de resposta, e uma barra de zero diria "respondeu na hora".
  const barras = useMemo(() => (col ? ordenarAEquipe(linhas.filter((l) => l[col.id] != null), col.id, sentidoDeComeco(col.id)) : []),
                         [linhas, col]);
  const maior = col ? Math.max(1, ...barras.map((l) => Number(l[col.id] || 0))) : 1;
  // A MEDIANA DA BASE DA COLUNA (`baseDaComparacao`), a mesma da ficha.
  const med = col ? mediana(baseDaComparacao(linhas, col.id).map((l) => l[col.id])) : null;
  // O VERDE é da pessoa escolhida; sem ninguém escolhido, é seu.
  const destaque = quem != null ? String(quem) : meuId != null ? String(meuId) : null;

  if (!linhas.length) {
    return (
      <div style={{ ...estilos.cartao, color: C.textSecondary }} data-equipe-vazia>
        Ninguém da equipe atendeu, finalizou, marcou “Já tratei” ou tem conversa na carteira neste recorte.
      </div>
    );
  }

  return (
    <>
      {/* ---- o gráfico da métrica escolhida ---- */}
      {col && (
        <div style={{ ...estilos.cartao, marginBottom: 12 }} data-bloco-de-impressao data-ranking-da-equipe={col.id}>
          <div role="group" aria-label="O que comparar" data-nao-imprime data-metricas-da-equipe
               style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {colunas.map((c) => {
              const ativa = c.id === col.id;
              return (
                <button key={c.id} onClick={() => escolher(c.id)} aria-pressed={ativa}
                        data-metrica-da-equipe={c.id} data-escolhida={ativa ? "sim" : undefined} title={c.ajuda}
                        style={{ minHeight: 32, padding: "5px 12px", borderRadius: 16, cursor: "pointer",
                                 fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                                 border: `1px solid ${ativa ? C.greenDark : C.divider}`,
                                 background: ativa ? C.greenDark : "transparent",
                                 color: ativa ? "#fff" : C.textPrimary }}>
                  {c.rotulo}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }} data-titulo-do-ranking>{col.rotulo}</div>
            <div style={{ ...estilos.nota, fontSize: 12 }}>
              {col.tipo === "tempo" ? "mediana de cada pessoa · quanto menor, melhor · o mais rápido primeiro" : col.ajuda}
            </div>
          </div>
          {!barras.length && <div style={estilos.nota}>Ninguém tem este número no recorte.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {barras.map((l) => {
              const v = Number(l[col.id] || 0);
              const p = aPessoaNaEquipe(linhas, l.id, col.id);
              const verde = destaque != null && l.id != null && String(l.id) === destaque;
              const clica = podeEscolher && l.id && !l.pelonome;
              const frase = `${l.nome}: ${formatarColuna(col, v)}${p.posicao ? ` · ${posicaoPorExtenso(p)}` : ""}${med != null ? ` · mediana da equipe: ${formatarColuna(col, med)}` : ""}`;
              // UM BOTÃO SÓ QUANDO O CLIQUE FAZ ALGO: para quem não
              // administra a linha não escolhe ninguém, e um botão que não
              // faz nada é pior do que nenhum.
              const Linha = clica ? "button" : "div";
              return (
                <Linha key={l.chave} data-barra-da-equipe={l.nome} data-valor={String(v)}
                        data-destaque={verde ? "sim" : undefined}
                        onClick={clica ? () => aoEscolher(l.id) : undefined} title={frase}
                        aria-label={clica ? frase : undefined} aria-pressed={clica ? (quem != null && String(quem) === String(l.id)) : undefined}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "calc(100% + 12px)", minHeight: 30,
                                 boxSizing: "border-box", padding: "3px 6px", margin: "0 -6px", border: "none", borderRadius: 8,
                                 background: quem != null && String(quem) === String(l.id) ? C.listActive : "transparent",
                                 cursor: clica ? "pointer" : "default", color: C.textPrimary, textAlign: "left", font: "inherit" }}>
                  <span data-nome-do-ranking style={{ flex: "0 0 32%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                 fontSize: 13, fontWeight: verde ? 800 : 600, color: l.pelonome ? C.textSecondary : C.textPrimary }}>
                    {l.nome}{l.sou ? " (você)" : ""}
                  </span>
                  <span data-trilho-do-ranking style={{ flex: "1 1 auto", position: "relative", height: 14, minWidth: 40 }}>
                    <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: "0 4px 4px 0",
                                   width: `${Math.max(v > 0 ? 1.5 : 0, (v / maior) * 100)}%`,
                                   background: verde ? cores.saiu : cores.apagado }} />
                    {med != null && (
                      <span aria-hidden="true" data-mediana-da-equipe
                            style={{ position: "absolute", top: -3, bottom: -3, width: 0,
                                     left: `${Math.min(100, (Number(med) / maior) * 100)}%`,
                                     borderLeft: `1.5px dashed ${C.textSecondary}` }} />
                    )}
                  </span>
                  <span style={{ flex: "0 0 auto", minWidth: 64, textAlign: "right", fontSize: 13, fontWeight: 700,
                                 fontVariantNumeric: "tabular-nums" }}>
                    {formatarColuna(col, v)}
                  </span>
                </Linha>
              );
            })}
          </div>
          {med != null && barras.length > 1 && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, ...estilos.nota, fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: cores.saiu }} />
                {quem != null ? "a pessoa escolhida" : "você"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }} data-legenda-da-mediana>
                <span style={{ width: 0, height: 12, borderLeft: `1.5px dashed ${C.textSecondary}` }} />
                mediana da equipe: <b style={{ color: C.textPrimary }}>{formatarColuna(col, med)}</b>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ---- a tabela, uma linha por pessoa ---- */}
      <div style={estilos.cartao} data-tabela-da-equipe>
        <div data-rola-de-lado style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={estilos.th} aria-sort={ordemValida.coluna === "nome" ? (ordemValida.sentido === "asc" ? "ascending" : "descending") : "none"}>
                <button onClick={ordenarPorNome} data-ordenar-equipe="nome"
                        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", font: "inherit",
                                 color: "inherit", letterSpacing: "inherit", textTransform: "inherit", fontWeight: "inherit" }}>
                  Pessoa{ordemValida.coluna === "nome" ? (ordemValida.sentido === "asc" ? " ▲" : " ▼") : ""}
                </button>
              </th>
              {colunas.map((c) => {
                const ativa = ordemValida.coluna === c.id;
                return (
                  <th key={c.id} style={{ ...estilos.thNum, color: ativa ? C.textPrimary : estilos.thNum.color }}
                      aria-sort={ativa ? (ordemValida.sentido === "asc" ? "ascending" : "descending") : "none"} title={c.ajuda}>
                    <button onClick={() => escolher(c.id)} data-ordenar-equipe={c.id}
                            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", font: "inherit",
                                     color: "inherit", letterSpacing: "inherit", textTransform: "inherit", fontWeight: "inherit",
                                     whiteSpace: "nowrap" }}>
                      {c.rotulo}{ativa ? (ordemValida.sentido === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                );
              })}
            </tr></thead>
            <tbody>
              {tabela.map((l) => {
                const clica = podeEscolher && l.id && !l.pelonome;
                const escolhida = quem != null && l.id != null && String(quem) === String(l.id);
                return (
                  <tr key={l.chave} data-equipe-linha={l.nome}
                      // `data-atendente` marca quem está no ranking de
                      // atendimentos do Painel (`por_atendente`): é o que o
                      // bloco "Por atendente", que esta tabela substitui,
                      // mostrava. Quem só tem "Já tratei" ou carteira não tem.
                      data-atendente={l.temPainel ? l.nome : undefined}
                      data-escolhida={escolhida ? "sim" : undefined}
                      onClick={() => clica && aoEscolher(l.id)}
                      style={{ cursor: clica ? "pointer" : "default", background: escolhida ? C.listActive : "transparent" }}>
                    <td style={{ ...estilos.td, minWidth: 140 }}>
                      <div style={{ fontWeight: l.sou ? 800 : 600, color: l.pelonome ? C.textSecondary : C.textPrimary }}>
                        {l.nome}
                        {l.sou && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: "#fff",
                                                 background: cores.selo, borderRadius: 10, padding: "1px 7px" }}>você</span>}
                        {l.pelonome && (
                          <span title="Contado pelo nome: mensagens anteriores a agosto/2026 não guardam quem enviou."
                                style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: C.textSecondary,
                                         border: `1px solid ${C.divider}`, borderRadius: 10, padding: "1px 7px" }}>
                            pelo nome
                          </span>
                        )}
                      </div>
                    </td>
                    {colunas.map((c) => {
                      const v = l[c.id];
                      const alerta = c.alerta && Number(v) > 0;
                      return (
                        <td key={c.id} data-coluna={c.id} data-valor={v == null ? "" : String(v)}
                            style={{ ...estilos.num, fontWeight: ordemValida.coluna === c.id ? 800 : 600,
                                     color: alerta ? C.erroTexto || "#c62828" : v == null ? C.textSecondary : C.textPrimary }}>
                          {formatarColuna(c, v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ ...estilos.nota, marginTop: 10, fontSize: 12 }} data-notas-da-equipe>
          Tempos em mediana. A carteira e o “{rotuloDasAtrasadas(dias)}” são de agora; o resto é do período.
          {podeEscolher ? " Clique numa pessoa para ver a ficha dela e recortar a tela inteira nela." : ""}
          {fontes.carteira === "parcial" && (
            <> A carteira de cada colega é só para quem administra: a sua está na ficha, acima.</>
          )}
          {foraDaTabela.celular > 0 && (
            <> Ficaram fora da tabela <b style={{ color: C.textPrimary }}>{numero(foraDaTabela.celular)}</b> {foraDaTabela.celular === 1 ? "protocolo respondido" : "protocolos respondidos"} direto
              pelo celular do escritório: não dá para saber quem estava com o aparelho.</>
          )}
          {!!faltou && <> <span style={{ color: C.ambarTexto || cores.aviso }} data-equipe-faltou>Ficaram de fora as colunas de {faltou}, que não carregaram: o motivo está na seção de cada uma, mais abaixo.</span></>}
        </div>
      </div>
    </>
  );
}

/* ================================================================
   A FICHA DA PESSOA ESCOLHIDA (05/11)
   ================================================================
   Cada número dela ao lado da mediana da equipe, e a posição dela. A
   mediana, e não a média: uma pessoa que pegou o plantão do mês puxa a média
   e não a mediana. A posição conta só quem tem o número — quem não respondeu
   ninguém não entra no ranking do tempo —, e o empate divide a posição. */
function FichaDaPessoa({ C, estilos, cores, linhas, fontes, quem, nome, sou, periodo, dias }) {
  const l = linhas.find((x) => x.id != null && String(x.id) === String(quem)) || null;
  const colunas = colunasDaFicha(fontes, dias);
  // OS PONTOS PARA A CONVERSA DE FEEDBACK (05/11, `pontosDaFicha`): só onde a
  // comparação diz alguma coisa, e com o número junto. A comparação só sai
  // das fontes que vieram inteiras — a parcial não tem com quem comparar.
  const fonteDe = (id) => (COLUNAS_DA_EQUIPE.find((x) => x.id === id) || {}).fonte;
  const pontos = l ? pontosDaFicha({
    linha: l, dias,
    comparar: (id) => (fontes[fonteDe(id)] === true ? aPessoaNaEquipe(linhas, l.id, id) : null),
  }) : null;
  return (
    <div style={{ ...estilos.cartao, borderColor: C.greenDark, marginBottom: 12 }} data-ficha-da-pessoa={nome} data-bloco-de-impressao>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <UserCheck size={20} color={cores.saiu} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2 }} data-nome-da-ficha>{nome}</div>
        {sou && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: cores.selo,
                                borderRadius: 10, padding: "1px 7px" }}>você</span>}
      </div>
      <div style={{ ...estilos.nota, marginTop: 4 }}>
        {rotuloDoPeriodo(periodo)}. Cada número ao lado da mediana da equipe e da posição — contadas só entre quem
        fez aquilo no período: quem não atendeu ninguém não puxa a mediana dos atendimentos para baixo. A carteira é
        de agora.
      </div>
      {!l && (
        <div style={{ ...estilos.nota, marginTop: 12 }} data-ficha-vazia>
          Nenhum número desta pessoa neste recorte: ela não atendeu, não finalizou, não marcou “Já tratei” e não tem
          conversa na carteira.
        </div>
      )}
      {l && (
        <div style={{ display: "grid", gap: 10, marginTop: 14, gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}>
          {colunas.map((c) => {
            const v = l[c.id];
            const inteira = fontes[c.fonte] === true;
            const p = inteira ? aPessoaNaEquipe(linhas, l.id, c.id) : null;
            const valores = inteira ? baseDaComparacao(linhas, c.id).map((x) => Number(x[c.id])) : [];
            const teto = Math.max(1, Number(v || 0), ...valores);
            const alerta = c.alerta && Number(v) > 0;
            return (
              <div key={c.id} data-ficha-coluna={c.id} data-valor={v == null ? "" : String(v)}
                   style={{ border: `1px solid ${C.divider}`, borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ ...estilos.rotulo, fontSize: 10.5, display: "flex", alignItems: "center", gap: 5 }}>
                  {c.rotulo}
                  <span title={c.ajuda} style={{ display: "flex", cursor: "help" }}><Info size={11} /></span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, letterSpacing: -0.3,
                              color: alerta ? C.erroTexto || "#c62828" : C.textPrimary }}>
                  {formatarColuna(c, v)}
                </div>
                {p && v != null && (
                  <div aria-hidden="true" style={{ position: "relative", height: 6, background: C.divider, borderRadius: 3, marginTop: 8 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 3,
                                  width: `${Math.max(Number(v) > 0 ? 3 : 0, (Number(v) / teto) * 100)}%`, background: cores.saiu }} />
                    {p.mediana != null && (
                      <div style={{ position: "absolute", top: -3, bottom: -3, width: 0,
                                    left: `${Math.min(100, (Number(p.mediana) / teto) * 100)}%`,
                                    borderLeft: `1.5px dashed ${C.textPrimary}` }} />
                    )}
                  </div>
                )}
                <div style={{ ...estilos.nota, fontSize: 11.5, marginTop: 6 }} data-comparacao-da-ficha>
                  {p && p.mediana == null
                    ? (c.fonte === "carteira" ? "ninguém da equipe tem conversa na carteira" : "ninguém da equipe fez isso no período")
                    : p
                    ? <>{p.posicao ? <><b style={{ color: C.textPrimary }}>{posicaoPorExtenso(p)}</b>{c.menorMelhor && p.posicao === 1 ? " · o mais rápido" : ""} · </> : ""}
                        mediana da equipe: {formatarColuna(c, p.mediana)}</>
                    : c.fonte === "carteira" && fontes.carteira === "parcial" ? "a dos colegas é só para quem administra" : ""}
                </div>
                {c.id === "carteira" && v != null && (
                  <div style={{ ...estilos.nota, fontSize: 11.5, marginTop: 2 }} data-detalhe-da-carteira>
                    {numero(l.esperando)} esperando
                    {l.maisAntiga ? ` · a mais antiga há ${diasDesde(l.maisAntiga)} ${diasDesde(l.maisAntiga) === 1 ? "dia" : "dias"}` : ""}
                    {l.naoLidas ? ` · ${numero(l.naoLidas)} não ${l.naoLidas === 1 ? "lida" : "lidas"}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {pontos && (
        <div data-pontos-da-ficha style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
          <div style={{ ...estilos.rotulo, fontSize: 10.5 }}>Para a conversa de feedback</div>
          {!pontos.fortes.length && !pontos.atencao.length && (
            <div style={{ ...estilos.nota, marginTop: 6 }} data-pontos-vazios>
              Nada que se destaque: os números estão perto da mediana da equipe.
            </div>
          )}
          {(pontos.fortes.length > 0 || pontos.atencao.length > 0) && (
            <div style={{ display: "grid", gap: 10, marginTop: 8, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {[
                { chave: "fortes", titulo: "Pontos fortes", itens: pontos.fortes, Icone: CircleCheck, cor: CORES_DO_STATUS.bom, texto: C.verdeTexto },
                { chave: "atencao", titulo: "Pontos de atenção", itens: pontos.atencao, Icone: TriangleAlert, cor: CORES_DO_STATUS.atencao, texto: C.ambarTexto },
              ].filter((g) => g.itens.length).map((g) => (
                <div key={g.chave} data-pontos={g.chave}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: g.texto }}>
                    <g.Icone size={15} color={g.cor} aria-hidden="true" /> {g.titulo}
                  </div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    {g.itens.map((x) => (
                      <li key={x.id} data-ponto={x.id} style={{ fontSize: 13, lineHeight: 1.45, color: C.textPrimary }}>{x.texto}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   IMPRIMIR O RELATÓRIO (05/11)
   ================================================================
   "com a possibilidade de imprimir um relatório". O navegador imprime a
   tela, e a tela tem de ser outra no papel:

   - A TELA É UM QUADRO FIXO QUE ROLA (`position: fixed`, `overflow-y`), e o
     navegador imprime só o pedaço à vista. No papel ela vira um bloco comum,
     e o Zorvin que mora atrás dela (esta guia monta o painel inteiro) some;
   - SEMPRE NO TEMA CLARO: quem trabalha no escuro imprimiria uma folha preta.
     O tema troca no `beforeprint`, com `flushSync` (o navegador monta a folha
     logo depois do evento, e um desenho agendado chegaria tarde), e volta no
     `afterprint`. Vale também para o Ctrl+P;
   - SEM OS CONTROLES (`data-nao-imprime`): a barra de filtros vira o
     cabeçalho do papel (`data-so-impressao`), que diz o recorte inteiro — um
     relatório impresso não tem a barra ao lado;
   - SEM AS LISTAS DE REGISTROS: são dezenas de folhas, e estão na planilha
     de cada seção;
   - AS CORES SAEM IMPRESSAS (`print-color-adjust: exact`): sem isso o
     navegador apaga o fundo das barras, e o gráfico vira um papel em branco. */
const CSS_DA_IMPRESSAO = `
[data-so-impressao] { display: none; }
@media print {
  @page { margin: 10mm; }
  /* O TEMA ESCURO MORA TAMBÉM NO <html> (aparencia.js: color-scheme e o
     fundo): sem desfazê-lo aqui, a margem da folha sai preta. */
  html, body, #root { height: auto !important; min-height: 0 !important; max-height: none !important;
                      overflow: visible !important; background: #fff !important; color-scheme: light !important; }
  #root > div { height: auto !important; max-height: none !important; display: block !important; overflow: visible !important; }
  #root > div > *:not([data-tela="painel"]) { display: none !important; }
  [data-tela="painel"] { position: static !important; inset: auto !important; overflow: visible !important;
                         z-index: auto !important; background: #fff !important; }
  [data-tela="painel"] [data-nao-imprime] { display: none !important; }
  [data-tela="painel"] [data-so-impressao] { display: block !important; }
  [data-tela="painel"] [data-conteudo-do-painel] { max-width: none !important; padding: 0 !important; }
  [data-tela="painel"] [data-rola-de-lado] { overflow: visible !important; }
  [data-tela="painel"] * { box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  [data-tela="painel"] [data-cartao], [data-tela="painel"] [data-ficha-coluna], [data-tela="painel"] tr,
  [data-tela="painel"] [data-bloco-de-impressao] { break-inside: avoid; }
  [data-tela="painel"] h3 { break-after: avoid; }
  [data-tela="painel"] table { font-size: 11px; }
  [data-tela="painel"] th, [data-tela="painel"] td { padding-top: 5px !important; padding-bottom: 5px !important; }
  /* A TABELA DA EQUIPE CABE NA FOLHA EM PÉ: dez colunas com o recheio da
     tela davam 882 pontos numa folha de 718, e o navegador cortava a última
     coluna (e encolhia a folha inteira para tentar caber). */
  [data-tela="painel"] [data-tabela-da-equipe] th { font-size: 8.5px !important; letter-spacing: 0 !important;
                                                     padding-left: 4px !important; white-space: normal !important; }
  [data-tela="painel"] [data-tabela-da-equipe] th button { white-space: normal !important; text-align: inherit; }
  [data-tela="painel"] [data-tabela-da-equipe] td { font-size: 10.5px !important; padding-left: 4px !important; }
  [data-tela="painel"] [data-tabela-da-equipe] td:first-child { min-width: 0 !important; }
}
@media (max-width: 560px) {
  [data-tela="painel"] [data-rotulo-de-imprimir] { display: none; }
  /* O RANKING NO CELULAR EM DUAS LINHAS: o nome e o número em cima, a barra
     embaixo, de ponta a ponta. Numa linha só, a 390 o nome ficava com 107
     pontos ("ISABELA GUE…") e a barra com 130. */
  [data-tela="painel"] [data-barra-da-equipe] { flex-wrap: wrap !important; row-gap: 4px !important; }
  [data-tela="painel"] [data-nome-do-ranking] { flex: 1 1 0 !important; }
  [data-tela="painel"] [data-trilho-do-ranking] { order: 3; flex: 1 1 100% !important; }
  /* AS MÉTRICAS NUMA LINHA QUE ROLA DE LADO: quebradas, eram três linhas de
     botões antes do gráfico. */
  [data-tela="painel"] [data-metricas-da-equipe] { flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; }
  [data-tela="painel"] [data-metricas-da-equipe] > button { flex-shrink: 0; }
}
/* NO CELULAR A BARRA NÃO GRUDA NO ALTO: com o período, os três filtros, o
   "Filtrando por" e os atalhos, ela cobria um terço da tela o tempo todo. */
@media (max-width: 767px) {
  [data-tela="painel"] [data-barra-do-painel] { position: static !important; }
}
`;

/** O cabeçalho da primeira folha: o recorte inteiro, por extenso. */
function CabecalhoDaImpressao({ linhas, secoesFora }) {
  return (
    <div data-so-impressao style={{ marginBottom: 14, color: "#111b21", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12,
                    borderBottom: "2px solid #008069", paddingBottom: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Relatório de atendimento</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#008069" }}>Ropelimi Zorvin</div>
      </div>
      <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {linhas.map(([k, v]) => (
            <tr key={k} data-linha-do-cabecalho={k}>
              <td style={{ padding: "1px 14px 1px 0", color: "#667781", fontWeight: 700, whiteSpace: "nowrap" }}>{k}</td>
              <td style={{ padding: "1px 0" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: "#667781", marginTop: 8 }}>
        Cada protocolo e cada “Já tratei”, um a um, estão na planilha de cada seção, na tela, e não no papel.
        {secoesFora.length ? ` Fora deste relatório, por escolha: ${secoesFora.join(", ")}.` : ""}
      </div>
    </div>
  );
}

/** O botão e o menu do que vai no relatório. */
function BotaoDeImprimir({ C, sombra, secoes, escolhidas, definir, imprimir }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  // O clique fora e o Esc fecham o menu (`useFora` cuida dos dois).
  useFora(caixa, () => setAberto(false), aberto);
  const nenhuma = !secoes.some((s) => escolhidas.has(s.id));
  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <button onClick={() => setAberto((v) => !v)} data-imprimir-relatorio aria-expanded={aberto}
              title="Imprimir um relatório (ou salvar em PDF)" aria-label="Imprimir relatório"
              style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 36, padding: "6px 12px",
                       borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
                       border: `1px solid ${C.greenDark}`, background: C.greenDark, color: "#fff" }}>
        <Printer size={15} style={{ flexShrink: 0 }} />
        <span data-rotulo-de-imprimir>Imprimir relatório</span>
      </button>
      {aberto && (
        <div data-menu-de-impressao
             style={{ position: "absolute", top: 42, right: 0, width: 280, maxWidth: "calc(100vw - 32px)", zIndex: 40,
                      background: C.panel, borderRadius: 12, border: `1px solid ${C.divider}`,
                      boxShadow: "0 12px 32px rgba(0,0,0,.28)", padding: "12px 14px" }}>
          <div style={{ fontSize: 11, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.6,
                        textTransform: "uppercase", marginBottom: 6 }}>O que vai no relatório</div>
          {secoes.map((s) => (
            <label key={s.id} data-secao-impressa={s.id}
                   style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 34, cursor: "pointer", fontSize: 13.5 }}>
              <input type="checkbox" checked={escolhidas.has(s.id)}
                     onChange={(e) => definir((v) => { const n = new Set(v); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })}
                     style={{ width: 16, height: 16, accentColor: C.greenDark, flexShrink: 0 }} />
              {s.rotulo}
            </label>
          ))}
          <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.45, margin: "6px 0 10px" }}>
            Sai no tema claro, com o recorte da barra no alto da primeira folha. Para um PDF, escolha
            “Salvar como PDF” na janela de impressão.
          </div>
          <button onClick={() => { setAberto(false); imprimir(); }} disabled={nenhuma} data-imprimir-agora
                  style={{ width: "100%", minHeight: 36, borderRadius: 10, border: "none", cursor: nenhuma ? "default" : "pointer",
                           background: nenhuma ? C.divider : C.greenDark, color: nenhuma ? C.textSecondary : "#fff",
                           fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Printer size={15} /> {nenhuma ? "Escolha o que imprimir" : "Imprimir"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   O SELETOR DE PERÍODO
   ================================================================ */
function SeletorDePeriodo({ C, cores, periodo, definir, estilos, sombra }) {
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aviso, setAviso] = useState("");
  const caixa = useRef(null);
  useFora(caixa, () => setAberto(false), aberto);

  const paraInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  useEffect(() => {
    if (!aberto) return;
    setDe(paraInput(periodo.de)); setAte(paraInput(periodo.ate)); setAviso("");
  }, [aberto, periodo]);

  const botao = (ativo) => ({
    display: "flex", alignItems: "center", gap: 7, minHeight: 36, padding: "6px 12px",
    borderRadius: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap",
    border: `1px solid ${ativo ? C.greenDark : C.divider}`,
    background: ativo ? C.greenDark : "transparent",
    color: ativo ? "#fff" : C.textPrimary,
  });
  const seta = {
    display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 36,
    border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
    borderRadius: 10, cursor: "pointer",
  };

  const meses = [];
  { const h = new Date();
    for (let i = 0; i < 12; i++) meses.push(new Date(h.getFullYear(), h.getMonth() - i, 1)); }

  const aplicarEscolhido = () => {
    if (!de || !ate) { setAviso("Escolha as duas datas."); return; }
    const [a1, m1, d1] = de.split("-").map(Number);
    const [a2, m2, d2] = ate.split("-").map(Number);
    const ini = new Date(a1, m1 - 1, d1, 0, 0, 0, 0);
    const fim = new Date(a2, m2 - 1, d2, 23, 59, 59, 999);
    if (fim < ini) { setAviso("A data final é anterior à inicial."); return; }
    const n = diasEntre(ini, fim);
    if (n > MAX_DIAS) {
      setAviso(`São ${n} dias. O máximo é ${MAX_DIAS} — acima disso a consulta passa do tempo que o banco dá e a tela viria vazia.`);
      return;
    }
    const agora = new Date();
    definir({ de: ini, ate: fim > agora ? agora : fim, tipo: "escolhido" });
    setAberto(false);
  };

  const mesmoPeriodo = (p) => inicioDoDia(p.de).getTime() === inicioDoDia(periodo.de).getTime()
                           && Math.abs(fimDoDia(p.ate) - fimDoDia(periodo.ate)) < 86400e3
                           && p.tipo === periodo.tipo;

  return (
    <div ref={caixa} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => definir(passear(periodo, -1))} style={seta}
              title="Período anterior" aria-label="Período anterior"><ChevronLeft size={16} /></button>

      <button onClick={() => setAberto((v) => !v)} style={botao(aberto)} data-teste="abrir-periodo">
        <Calendar size={15} />
        {rotuloDoPeriodo(periodo)}
        <ChevronDown size={14} style={{ opacity: 0.7 }} />
      </button>

      <button onClick={() => definir(passear(periodo, +1))} style={seta}
              title="Período seguinte" aria-label="Período seguinte"><ChevronRight size={16} /></button>

      {aberto && (
        <div data-grupo="periodo"
             style={{ position: "absolute", top: 44, left: 38, width: 320, zIndex: 40,
                      background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 14,
                      boxShadow: "0 12px 32px rgba(0,0,0,.28)", padding: 14,
                      maxHeight: "min(76vh, 620px)", overflowY: "auto" }}>
          <div style={{ ...estilos.rotulo, marginBottom: 8 }}>Atalhos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {atalhos().map((a) => {
              const p = a.faz();
              const ativo = mesmoPeriodo(p);
              return (
                <button key={a.chave} onClick={() => { definir(p); setAberto(false); }}
                  style={{ minHeight: 34, borderRadius: 9, cursor: "pointer", fontSize: 12.5,
                           fontWeight: 600, padding: "6px 4px",
                           border: `1px solid ${ativo ? C.greenDark : C.divider}`,
                           background: ativo ? C.greenDark : "transparent",
                           color: ativo ? "#fff" : C.textPrimary }}>
                  {a.rotulo}
                </button>
              );
            })}
          </div>

          <div style={{ ...estilos.rotulo, margin: "16px 0 8px" }}>Escolher mês</div>
          <div style={{ maxHeight: 156, overflowY: "auto", border: `1px solid ${C.divider}`, borderRadius: 10 }}>
            {meses.map((m) => {
              const p = mesDe(m.getFullYear(), m.getMonth());
              const ativo = mesmoPeriodo(p);
              return (
                <button key={`${m.getFullYear()}-${m.getMonth()}`}
                  onClick={() => { definir(p); setAberto(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "9px 12px", cursor: "pointer",
                           border: "none", borderBottom: `1px solid ${C.divider}`,
                           background: ativo ? C.listActive : "transparent",
                           color: ativo ? C.verdeTexto : C.textPrimary,
                           fontSize: 13.5, fontWeight: ativo ? 700 : 500,
                           display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {MESES_LONGOS[m.getMonth()]} de {m.getFullYear()}
                  {ativo && <Check size={15} />}
                </button>
              );
            })}
          </div>

          <div style={{ ...estilos.rotulo, margin: "16px 0 8px" }}>Período específico</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["de", de, setDe], ["até", ate, setAte]].map(([lbl, v, set]) => (
              <label key={lbl} style={{ flex: 1, display: "block" }}>
                <span style={{ ...estilos.nota, fontSize: 11.5 }}>{lbl}</span>
                <input type="date" value={v} onChange={(e) => set(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 3, minHeight: 36,
                           padding: "6px 9px", borderRadius: 9, fontSize: 13,
                           border: `1px solid ${C.divider}`, background: C.inputBg,
                           color: C.textPrimary, colorScheme: C.panel === "#ffffff" ? "light" : "dark" }} />
              </label>
            ))}
          </div>
          {aviso && (
            <div style={{ ...estilos.nota, color: C.ambarTexto, marginTop: 8 }}>{aviso}</div>
          )}
          <button onClick={aplicarEscolhido}
            style={{ width: "100%", marginTop: 10, minHeight: 38, borderRadius: 10, cursor: "pointer",
                     border: "none", background: C.greenDark, color: "#fff", fontSize: 14, fontWeight: 700 }}>
            Aplicar
          </button>

          <div style={{ ...estilos.nota, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>
            O maior período é de {MAX_DIAS} dias. Acima disso a consulta passa do tempo que o banco
            dá e a tela viria vazia — as setinhas ao lado do botão andam de um período para o
            anterior, quantas vezes for preciso.
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   UM FILTRO DE LISTA
   ================================================================ */
function Escolha({ C, sombra, icone: Icone, opcoes, valor, definir, grupo }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  useFora(caixa, () => setAberto(false), aberto);
  const atual = opcoes.find((o) => String(o.valor) === String(valor)) || opcoes[0];
  const ligado = valor != null;

  return (
    <div ref={caixa} data-grupo={grupo} style={{ position: "relative" }}>
      <button onClick={() => setAberto((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 36, padding: "6px 11px",
                 borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                 maxWidth: 210, whiteSpace: "nowrap", overflow: "hidden",
                 border: `1px solid ${ligado ? C.greenDark : C.divider}`,
                 background: "transparent", color: ligado ? C.verdeTexto : C.textPrimary }}>
        <Icone size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{atual?.rotulo}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
      </button>
      {aberto && (
        <div style={{ position: "absolute", top: 42, right: 0, minWidth: 230, maxHeight: 320,
                      overflowY: "auto", zIndex: 40, background: C.panel, borderRadius: 12,
                      border: `1px solid ${C.divider}`, boxShadow: "0 12px 32px rgba(0,0,0,.28)" }}>
          {opcoes.map((o) => {
            const ativo = String(o.valor) === String(valor);
            return (
              <button key={String(o.valor)} onClick={() => { definir(o.valor); setAberto(false); }}
                style={{ width: "100%", textAlign: "left", padding: "10px 12px", cursor: "pointer",
                         border: "none", borderBottom: `1px solid ${C.divider}`,
                         background: ativo ? C.listActive : "transparent",
                         color: ativo ? C.verdeTexto : C.textPrimary, fontSize: 13.5,
                         fontWeight: ativo ? 700 : 500, display: "flex", alignItems: "center",
                         justifyContent: "space-between", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.rotulo}</span>
                {ativo && <Check size={15} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   TÍTULO DE SEÇÃO
   ================================================================ */
/* ================================================================
   CARTÕES DE NÚMERO
   ================================================================ */
function Numero({ C, estilos, antes, etiqueta, v, comparar, ajuda, destaque }) {
  // A comparação com o período anterior sai em CINZA, com seta. Verde/vermelho
  // aqui seria opinião: mais mensagens não é bom nem ruim por si — pode ser
  // movimento, pode ser retrabalho.
  let delta = null;
  if (comparar != null && antes.existe) {
    const a = Number(antes[comparar] || 0), b = Number(v || 0);
    // PORCENTAGEM SÓ QUANDO ELA QUER DIZER ALGUMA COISA. De 3 para 69 são
    // "↑ 2200%", que ninguém consegue usar para nada — e que soa a erro.
    const p = a >= 10 ? Math.round(((b - a) / a) * 100) : null;
    // Acima de 300% a porcentagem para de informar e passa a assustar: "↑
    // 2210%" não cabe na cabeça de ninguém, e os dois números crus cabem.
    if (p != null && Math.abs(p) <= 300) {
      delta = <>{p > 0 ? "↑" : p < 0 ? "↓" : "="} {Math.abs(p)}% <span style={{ opacity: 0.75 }}>que no período anterior</span></>;
    } else {
      delta = <>no período anterior: <b style={{ color: C.textPrimary }}>{numero(a)}</b></>;
    }
  }
  return (
    <div style={{ ...estilos.cartao, ...(destaque ? { borderColor: C.greenDark } : null) }}
         data-cartao={etiqueta}>
      <div style={{ ...estilos.rotulo, display: "flex", alignItems: "center", gap: 5 }}>
        {etiqueta}
        {ajuda && <span title={ajuda} style={{ display: "flex", cursor: "help" }}><Info size={12} /></span>}
      </div>
      <div style={{ ...estilos.valor, fontSize: destaque ? 38 : 30 }}
           data-valor={v == null ? "" : String(v)}>{numero(v)}</div>
      {delta && <div style={{ ...estilos.nota, marginTop: 4 }}>{delta}</div>}
    </div>
  );
}

function Tempo({ C, estilos, etiqueta, mediana, media, quantos, ajuda }) {
  return (
    <div style={estilos.cartao} data-cartao={etiqueta}>
      <div style={{ ...estilos.rotulo, display: "flex", alignItems: "center", gap: 5 }}>
        {etiqueta}
        <span title={ajuda} style={{ display: "flex", cursor: "help" }}><Info size={12} /></span>
      </div>
      <div style={estilos.valor} data-valor={mediana == null ? "" : String(mediana)}>{tempo(mediana)}</div>
      <div style={{ ...estilos.nota, marginTop: 4 }}>
        metade foi mais rápido que isso · média {tempo(media)} · {numero(quantos)} {Number(quantos) === 1 ? "caso" : "casos"}
      </div>
    </div>
  );
}

/* ================================================================
   A SITUAÇÃO DOS ATENDIMENTOS — uma barra de três pedaços
   ================================================================ */
function Situacao({ t, C, cores, estilos }) {
  const total = Number(t.atendimentos || 0);
  if (!total) return null;
  const partes = [
    { nome: "Aguardando resposta", v: Number(t.aguardando || 0), cor: cores.aviso },
    { nome: "Em andamento", v: Number(t.em_andamento || 0), cor: cores.saiu },
    { nome: "Encerrados", v: Number(t.encerrados || 0), cor: cores.apagado },
  ];
  return (
    <div style={{ ...estilos.cartao, marginTop: 12 }}>
      <div style={estilos.rotulo}>Situação dos atendimentos</div>
      {/* O respiro de 2px entre os pedaços é o que separa um do outro. Uma
          borda desenhada em volta engorda a barra e some no tema escuro. */}
      <div style={{ display: "flex", gap: 2, height: 12, marginTop: 12, marginBottom: 12 }}>
        {partes.filter((p) => p.v > 0).map((p) => (
          <div key={p.nome} title={`${p.nome}: ${numero(p.v)}`}
               style={{ flex: p.v, background: p.cor, borderRadius: 3 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {partes.map((p) => (
          <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.cor, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{numero(p.v)}</span>
            <span style={{ ...estilos.nota, fontSize: 13 }}>{p.nome}</span>
          </div>
        ))}
      </div>
      <div style={{ ...estilos.nota, marginTop: 12 }}>
        Os três somam o total: cada atendimento está em um, e num só.
        {" "}<b style={{ color: C.textPrimary }}>Aguardando</b> é o contato que escreveu e não teve
        resposta nenhuma — inclusive os antigos, que são justamente os que doem.
        {" "}<b style={{ color: C.textPrimary }}>Encerrado</b> é o que foi respondido e está parado
        há mais de 6 horas; ninguém precisa clicar em nada para encerrar.
      </div>
    </div>
  );
}

/* ================================================================
   COLUNAS — uma ou duas séries, com leitura ao passar o mouse
   ================================================================
   Feito com divs e não com SVG: a coluna se estica sozinha quando a janela
   muda de tamanho, e o alvo do mouse é a fatia inteira — não a barra de 6px.

   A LEITURA FICA NO TOPO DO GRÁFICO, e não numa caixinha flutuante junto do
   cursor: caixinha flutuante some fora da tela na última coluna, e no celular
   fica embaixo do dedo. Aqui ela tem lugar fixo, e o mesmo texto aparece
   quando se chega pelo teclado. */
function Colunas({ C, dados, series, formatar, passo }) {
  const [sobre, setSobre] = useState(null);
  const alt = 172;
  const max = Math.max(1, ...dados.flatMap((x) => series.map((s) => Number(x[s.campo] || 0))));
  // OS RÓTULOS CABEM NA LARGURA QUE O GRÁFICO TEM (auditoria de 28/10). Um a
  // cada `ceil(n/10)` colunas, cada um numa caixa de UMA coluna e cortado:
  // a 375px a caixa tinha 8px e o "29/09" pede 26 — sobrava "2!". Agora a
  // largura do trilho é medida, o passo cresce quando é estreito, e o texto
  // fica centrado na coluna dele, por cima das vizinhas vazias. No computador
  // a conta dá o passo de sempre, e o gráfico fica como era.
  const trilho = useRef(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = trilho.current;
    if (!el) return undefined;
    const medir = () => setLargura(el.getBoundingClientRect().width);
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const vigia = new ResizeObserver(medir);
    vigia.observe(el);
    return () => vigia.disconnect();
  }, []);
  const ROTULO_PX = 34;   // o "29/09" em 10,5px pede 26; o resto é o respiro
  const cada = Math.max(1, Math.ceil(dados.length / 10),
                        largura ? Math.ceil((dados.length * ROTULO_PX) / largura) : 1);
  const atual = sobre != null ? dados[sobre] : null;

  return (
    <div>
      <div style={{ height: 20, fontSize: 12.5, color: C.textSecondary, marginBottom: 6 }}>
        {atual && (
          <span data-teste="leitura">
            <b style={{ color: C.textPrimary }}>{rotuloData(atual.quando, passo)}</b>
            {series.map((s) => (
              <span key={s.campo}> · {s.nome}: <b style={{ color: C.textPrimary }}>
                {atual[s.campo] == null ? "—" : formatar(atual[s.campo])}</b></span>
            ))}
          </span>
        )}
      </div>

      <div style={{ position: "relative", height: alt, borderBottom: `1px solid ${C.divider}` }}>
        {/* Duas linhas de grade, finas e discretas: o topo e o meio. Mais que
            isso vira grade de caderno e disputa com os dados. */}
        {[1, 0.5].map((f) => (
          <div key={f} style={{ position: "absolute", left: 0, right: 0, bottom: alt * f,
                                borderTop: `1px solid ${C.divider}`, pointerEvents: "none" }} />
        ))}
        <div style={{ position: "absolute", top: -7, right: 0, fontSize: 11, color: C.textSecondary,
                      background: C.panel, padding: "0 3px", fontVariantNumeric: "tabular-nums" }}>
          {formatar(max)}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: 2 }}>
          {dados.map((x, i) => (
            <div key={x.quando} tabIndex={0}
                 onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)}
                 onFocus={() => setSobre(i)} onBlur={() => setSobre(null)}
                 title={`${rotuloData(x.quando, passo)} · ` +
                        series.map((s) => `${s.nome}: ${x[s.campo] == null ? "—" : formatar(x[s.campo])}`).join(" · ")}
                 style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end",
                          justifyContent: "center", gap: 2, outline: "none",
                          background: sobre === i ? C.divider : "transparent", borderRadius: 4 }}>
              {series.map((s) => {
                const v = Number(x[s.campo] || 0);
                return (
                  <div key={s.campo}
                       style={{ flex: 1, maxWidth: 26, minWidth: 3,
                                // 3px de mínimo para o valor pequeno não sumir: a
                                // coluna rente ao chão diz "aqui houve um dia".
                                height: Math.max(v > 0 ? 3 : 0, Math.round((v / max) * (alt - 6))),
                                background: s.cor, borderRadius: "4px 4px 0 0" }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div ref={trilho} style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {dados.map((x, i) => (
          <div key={x.quando} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center",
                                       fontSize: 10.5, color: C.textSecondary,
                                       fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {i % cada === 0 ? rotuloData(x.quando, passo) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   MAPA DE HORÁRIOS — 7 dias × 24 horas
   ================================================================ */
function Mapa({ C, estilos, dados, rampa }) {
  const [tabela, setTabela] = useState(false);
  const [sobre, setSobre] = useState(null);
  const max = Math.max(1, ...dados.map((x) => Number(x.atendimentos || 0)));
  const grade = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    dados.forEach((x) => { g[Number(x.dia)][Number(x.hora)] = Number(x.atendimentos || 0); });
    return g;
  }, [dados]);
  const total = dados.reduce((s, x) => s + Number(x.atendimentos || 0), 0);

  const cor = (v) => {
    if (!v) return C.headerBar;
    const i = Math.min(rampa.length - 1, Math.max(0, Math.ceil((v / max) * rampa.length) - 1));
    return rampa[i];
  };

  // A tabela do mapa não repete 168 linhas: traz o resumo que alguém leria em
  // voz alta — quanto em cada dia, e quanto em cada faixa do dia.
  const faixas = [["Madrugada (0h–5h)", 0, 5], ["Manhã (6h–11h)", 6, 11],
                  ["Tarde (12h–17h)", 12, 17], ["Noite (18h–23h)", 18, 23]];

  return (
    <div style={estilos.cartao}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 auto", height: 18, fontSize: 12.5, color: C.textSecondary }}>
          {sobre && (
            <span data-teste="leitura-mapa">
              <b style={{ color: C.textPrimary }}>{DIAS[sobre.d]}, {String(sobre.h).padStart(2, "0")}h</b>
              {" · "}{numero(grade[sobre.d][sobre.h])} {grade[sobre.d][sobre.h] === 1 ? "atendimento" : "atendimentos"}
            </span>
          )}
        </div>
        <button onClick={() => setTabela((v) => !v)} data-nao-imprime
          style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 30, padding: "4px 10px",
                   border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
                   borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {tabela ? <BarChart3 size={13} /> : <Table2 size={13} />} {tabela ? "Mapa" : "Tabela"}
        </button>
      </div>

      {total === 0 && <div style={{ ...estilos.nota, padding: "12px 0" }}>Nenhum atendimento neste período.</div>}

      {total > 0 && !tabela && (
        <>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 560 }}>
              {grade.map((linha, d2) => (
                <div key={d2} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
                  <div style={{ width: 34, flexShrink: 0, fontSize: 11, color: C.textSecondary }}>{DIAS[d2]}</div>
                  {linha.map((v, h) => (
                    <div key={h} tabIndex={v ? 0 : -1}
                         onMouseEnter={() => setSobre({ d: d2, h })} onMouseLeave={() => setSobre(null)}
                         onFocus={() => setSobre({ d: d2, h })} onBlur={() => setSobre(null)}
                         title={`${DIAS[d2]}, ${String(h).padStart(2, "0")}h — ${numero(v)} ${v === 1 ? "atendimento" : "atendimentos"}`}
                         style={{ flex: 1, height: 18, background: cor(v), borderRadius: 3,
                                  border: `1px solid ${v ? "transparent" : C.divider}`, outline: "none" }} />
                  ))}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
                <div style={{ width: 34, flexShrink: 0 }} />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: C.textSecondary,
                                        fontVariantNumeric: "tabular-nums" }}>
                    {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* A escala. Sem ela, "mais escuro" não quer dizer nada. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, ...estilos.nota }}>
            <span>0</span>
            {rampa.map((c) => <span key={c} style={{ width: 22, height: 10, background: c, borderRadius: 2 }} />)}
            <span>{numero(max)}</span>
            <span style={{ marginLeft: 6 }}>atendimentos começados naquela hora</span>
          </div>
        </>
      )}

      {total > 0 && tabela && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={estilos.th}>Dia</th>
            {faixas.map((f) => <th key={f[0]} style={estilos.thNum}>{f[0]}</th>)}
            <th style={estilos.thNum}>Total</th>
          </tr></thead>
          <tbody>
            {grade.map((linha, d2) => (
              <tr key={d2}>
                <td style={estilos.td}>{DIAS[d2]}</td>
                {faixas.map((f) => (
                  <td key={f[0]} style={estilos.num}>
                    {numero(linha.slice(f[1], f[2] + 1).reduce((s, v) => s + v, 0))}
                  </td>
                ))}
                <td style={{ ...estilos.num, fontWeight: 700 }}>{numero(linha.reduce((s, v) => s + v, 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ================================================================
   POR TELEFONE
   ================================================================
   TODOS os telefones, inclusive os que ficaram em zero. Telefone parado
   sumindo da tabela é a informação mais útil da tela indo embora. */
function Telefones({ C, estilos, cores, dados, advogados, departamentos, telefone, departamento, aoEscolher }) {
  const linhas = useMemo(() => {
    const nomeDoDep = new Map(departamentos.map((x) => [String(x.id), x.nome]));
    const doBanco = new Map(dados.map((x) => [String(x.advogado_id), x]));
    // Quando há filtro de lugar, a lista mostra só o que o filtro alcança —
    // linhas zeradas de telefones que a tela já excluiu seriam ruído.
    const visiveis = advogados.filter((a) =>
      (!telefone || String(a.id) === String(telefone)) &&
      (!departamento || String(a.departamento_id) === String(departamento)));
    const vistos = new Set();
    const saida = visiveis.map((a) => {
      const id = String(a.id);
      vistos.add(id);
      const r = doBanco.get(id) || {};
      return { id, nome: a.nome || a.numero || id,
               departamento: nomeDoDep.get(String(a.departamento_id)) || "",
               atendimentos: Number(r.atendimentos || 0),
               recebidas: Number(r.recebidas || 0), enviadas: Number(r.enviadas || 0) };
    });
    // Telefone que saiu do cadastro mas tem movimento no período: continua
    // contando. Some da lista de telefones, não da conta.
    for (const [id, r] of doBanco) {
      if (vistos.has(id)) continue;
      saida.push({ id, nome: "(telefone removido do cadastro)", departamento: "",
                   atendimentos: Number(r.atendimentos || 0),
                   recebidas: Number(r.recebidas || 0), enviadas: Number(r.enviadas || 0) });
    }
    return saida.sort((a, b) => (b.atendimentos - a.atendimentos)
                             || ((b.recebidas + b.enviadas) - (a.recebidas + a.enviadas)));
  }, [dados, advogados, departamentos, telefone, departamento]);

  if (!linhas.length) return <div style={{ ...estilos.cartao, color: C.textSecondary }}>Nenhum telefone cadastrado.</div>;
  const maior = Math.max(1, ...linhas.map((l) => l.recebidas + l.enviadas));

  // A TABELA ROLA DE LADO dentro do cartão (05/11): a 360 ela pedia 377
  // pontos, e a tela inteira rolava de lado por causa dela.
  return (
    <div style={{ ...estilos.cartao, overflowX: "auto" }} data-rola-de-lado>
      <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        {[["Recebidas", cores.chegou], ["Enviadas", cores.saiu]].map(([n, c]) => (
          <span key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {n}
          </span>
        ))}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={estilos.th}>Telefone</th>
          <th style={estilos.thNum}>Atendimentos</th>
          <th style={estilos.thNum}>Recebidas</th>
          <th style={estilos.thNum}>Enviadas</th>
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} data-telefone-linha={l.nome}
                onClick={() => aoEscolher && aoEscolher(l.id)}
                style={{ cursor: aoEscolher ? "pointer" : "default",
                         background: String(telefone) === String(l.id) ? C.listActive : "transparent" }}>
              <td style={{ ...estilos.td, width: "46%" }}>
                <div style={{ fontWeight: 600 }}>{l.nome}</div>
                {l.departamento && <div style={{ fontSize: 12, color: C.textSecondary }}>{l.departamento}</div>}
                {/* Uma barra, dois pedaços, 2px de respiro entre eles. */}
                <div style={{ display: "flex", gap: 2, height: 6, marginTop: 7,
                              width: `${Math.max(2, Math.round(((l.recebidas + l.enviadas) / maior) * 100))}%` }}>
                  {l.recebidas > 0 && <div style={{ flex: l.recebidas, background: cores.chegou, borderRadius: 3 }} />}
                  {l.enviadas > 0 && <div style={{ flex: l.enviadas, background: cores.saiu, borderRadius: 3 }} />}
                </div>
              </td>
              <td style={{ ...estilos.num, fontWeight: 700 }}>{numero(l.atendimentos)}</td>
              <td style={estilos.num}>{numero(l.recebidas)}</td>
              <td style={estilos.num}>{numero(l.enviadas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   AS RESSALVAS
   ================================================================
   O que ficou de fora de alguma conta, e por quê. Cada uma só aparece quando
   tem número: aviso que fica na tela dizendo "zero" vira paisagem, e quando um
   dia deixar de ser zero ninguém repara. */
function Ressalvas({ d, t, C, estilos }) {
  const [aberto, setAberto] = useState(false);
  const itens = [];
  const forte = { color: C.textPrimary };

  if (Number(t.sem_atendente || 0) > 0) itens.push(
    <>
      <b style={forte}>{numero(t.sem_atendente)}</b> atendimentos do período não têm dono: ou ainda
      não foram respondidos, ou a resposta saiu pelo aparelho. Eles contam no total do escritório e
      ficam de fora do recorte de cada pessoa — não há a quem atribuí-los.
    </>);

  if (Number(d.aparelho || 0) > 0) itens.push(
    <>
      <b style={forte}>{numero(d.aparelho)}</b> mensagens enviadas pelo aparelho — saíram pelo
      WhatsApp no celular, fora do Zorvin. Contam no total do telefone, mas não dá para saber quem
      escreveu, por isso ficam fora da comparação entre atendentes.
    </>);

  const rotulos = d.por_rotulo || [];
  const totalRotulos = rotulos.reduce((s, r) => s + Number(r.enviadas || 0), 0);
  if (totalRotulos > 0) itens.push(
    <>
      <b style={forte}>{numero(totalRotulos)}</b> mensagens enviadas com um rótulo que não é
      atendente — nome de linha vindo do histórico importado, ou mensagem sem autor
      ({rotulos.map((r) => r.nome).join(", ")}). Contam no total do telefone e ficam fora da
      comparação entre atendentes.
    </>);

  if (Number(d.sem_id || 0) > 0) itens.push(
    <>
      <b style={forte}>{numero(d.sem_id)}</b> das mensagens enviadas neste período não guardam quem
      as escreveu e foram contadas pelo nome. São as anteriores a agosto/2026; daqui em diante toda
      mensagem sai identificada, e este aviso some sozinho.
    </>);

  if (Number(d.outras || 0) > 0) itens.push(
    <>
      <b style={forte}>{numero(d.outras)}</b> mensagens não são nem recebidas nem enviadas (têm uma
      origem que este painel não conhece) e ficaram fora das duas colunas. Se esse número crescer,
      me avise.
    </>);

  return (
    <>
      <Titulo C={C}>Como estes números são contados</Titulo>
      <div style={{ ...estilos.cartao, ...estilos.nota }}>
        <div>
          Um <b style={forte}>atendimento</b> é um trecho de conversa: começa quando alguém escreve
          depois de <b style={forte}>6 horas</b> de silêncio naquela conversa e termina nas 6 horas
          de silêncio seguintes. O Zorvin não tem botão de “encerrar atendimento”, e um botão desses
          só valeria daqui para a frente — deduzir o trecho das mensagens vale para o histórico
          inteiro, sem depender de ninguém lembrar de clicar.
        </div>
        <div style={{ marginTop: 8 }}>
          O <b style={forte}>atendente</b> de um atendimento é quem mandou a primeira resposta.
          Mensagem recebida não tem atendente próprio — ela chega no telefone, não em alguém —, e
          por isso ela é contada como sua quando chega num atendimento que você pegou.
        </div>

        {itens.length > 0 && (
          <>
            <button onClick={() => setAberto((v) => !v)}
              style={{ marginTop: 12, border: "none", background: "transparent", cursor: "pointer",
                       color: C.verdeTexto, fontSize: 12.5, fontWeight: 700, padding: 0,
                       display: "flex", alignItems: "center", gap: 5 }}>
              <ChevronDown size={14} style={{ transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .12s" }} />
              {aberto ? "Esconder" : "Ver"} as {itens.length} ressalva{itens.length > 1 ? "s" : ""} deste período
            </button>
            {aberto && itens.map((x, i) => (
              <div key={i} style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>{x}</div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

/* O BOTÃO DA PLANILHA, no lugar das listas que saíram (06/11). Ele diz
   quantos registros a planilha leva — e, quando o banco cortou (a função
   devolve no máximo os mais recentes), que são só os mais recentes, para a
   planilha não se ler como o período inteiro. */
function BotaoDaPlanilha({ C, estilos, aoBaixar, marca, veio, total, um, varios }) {
  const cortou = Number(total) > veio;
  return (
    <div data-nao-imprime {...{ [`data-${marca}-planilha`]: "" }}
         style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
      <button onClick={aoBaixar} {...{ [`data-${marca}-baixar`]: "" }}
        style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 32, padding: "5px 12px",
                 border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                 borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
        <Download size={14} /> Baixar planilha
      </button>
      <span style={{ ...estilos.nota, flex: "1 1 220px" }} {...{ [`data-${marca}-contagem`]: "" }}>
        {cortou
          ? <>A planilha leva os <b style={{ color: C.textPrimary }}>{numero(veio)}</b> {varios} mais recentes,
              de {numero(total)} no período. Para ter o resto, encurte o período.</>
          : veio === 1
            ? <>A planilha leva o {um} do período.</>
            : <>A planilha leva os {numero(veio)} {varios} do período, um por linha.</>}
      </span>
    </div>
  );
}


/* ================================================================
   O RELATÓRIO DO "JÁ TRATEI"
   ================================================================
   Pedido do Rodrigo em 30/09: *"um lugar para metrificar o que foi tratado,
   por quem"*. O "Já tratei" gravava desde 25/09 e não havia onde ler.

   A CONTA É DO BANCO (`zorvin_relatorio_tratados`, script 010 da ponte), pela
   régua desta tela inteira: a API corta em 1000 linhas sem avisar, e um mês
   de "Já tratei" passa disso.

   UM "JÁ TRATEI" É UM CLIQUE. Marcar ACORDOS e VENDA LN grava duas linhas, e
   contar linhas diria que a equipe tratou duas conversas quando tratou uma.
   O banco agrupa; a tela só mostra. E o DESFEITO não entra na soma — aparece
   ao lado, porque muitos desfeitos são, eles mesmos, a notícia.

   SEM A FUNÇÃO: quem administra lê qual script falta; quem atende não vê
   nada — um aviso sobre SQL não pede nada de quem atende. E FALHA NÃO É
   AUSÊNCIA: qualquer outro erro vira frase, com o código (armadilha nº 2).
   ================================================================ */
/* ================================================================
   OS PROTOCOLOS DE ATENDIMENTO — a contabilização do DataCrazy
   ================================================================
   Pedido do Rodrigo em 20/10, depois das abas: quantos atendimentos houve,
   quanto o cliente esperou pela primeira resposta e quanto levou até
   finalizar. A conta é do banco (`zorvin_relatorio_atendimentos`, script 029
   da ponte), pela régua da tela inteira: a API corta em 1000 linhas sem
   avisar.

   UM ATENDIMENTO É UM PROTOCOLO, e ele só entra no total QUANDO A EQUIPE
   COMEÇA — a regra que o Rodrigo copiou do DataCrazy: o que "permanece com o
   status de Aguardando não soma no volume de Quantidade Total até que a
   interação humana de fato comece". O protocolo que o cliente abriu e em que
   ninguém mexeu aparece à parte, em "Esperando resposta". Vale também para o
   cliente que voltou a escrever numa conversa finalizada: a conversa está em
   "Em Atendimento", e o protocolo novo dela só conta quando alguém responder.

   TUDO AQUI É DO PERÍODO DA ABERTURA, e as contas fecham: o total é a soma
   dos em atendimento com os finalizados. A comparação com o período anterior
   é SÓ DO TOTAL — comparar quantos ainda estão em atendimento mediria só que
   o mês velho teve mais tempo para ser finalizado.

   QUEM NÃO ADMINISTRA vê os atendimentos de que participou (respondeu
   primeiro, finalizou ou reabriu), e os tempos são os dela; o recorte é feito
   no banco. O "por pessoa" mostra todo mundo, para comparar.

   SEM A FUNÇÃO ou SEM O 028, quem administra lê qual atualização falta; quem
   atende não vê nada. COM A FUNÇÃO FALHANDO, a frase vem com o código — falha
   não é ausência (armadilha nº 2). */
function RelatorioProtocolos({ C, estilos, cores, deIso, ateIso, leitura, quem,
                              souAdmin, meuId, advogados, aoEscolherPessoa }) {
  // A LEITURA VEM DO ALTO (`useLeitura`). "029" é a função que falta, e
  // "028", o que ela diz faltar lá dentro.
  const { carregando, erro } = leitura;
  const falta = leitura.semFuncao ? "029" : (leitura.dados && leitura.dados.falta ? String(leitura.dados.falta) : null);
  const r = leitura.dados && !leitura.dados.falta ? leitura.dados : null;

  const nomeDoTelefone = (id) => {
    const a = advogados.find((x) => String(x.id) === String(id));
    return a ? (a.nome || a.numero) : "";
  };
  const ESTADO = {
    finalizado: { texto: "finalizado", cor: C.textSecondary },
    em_atendimento: { texto: "em atendimento", cor: cores.saiu },
    sem_resposta: { texto: "esperando resposta", cor: cores.aviso },
  };
  // O PRAZO DE CADA PROTOCOLO (script 052 da ponte): só nos que o cliente
  // abriu. A palavra numa cor de texto, e não na cor do status.
  const PRAZO_DO_PROTOCOLO = {
    no_prazo: { texto: "no prazo", cor: C.verdeTexto },
    atrasado: { texto: "fora do prazo", cor: C.ambarTexto },
    sem_acao: { texto: "prazo vencido", cor: C.erroTexto },
    aguardando: { texto: "ainda no prazo", cor: C.textSecondary },
  };
  const quemAbriu = (x) => x.origem === "cliente" ? "o cliente escreveu"
    : x.origem === "reabertura" ? `reaberto por ${x.aberto_por_nome || "alguém da equipe"}`
    : "a equipe começou a conversa";
  const minutos = (de, ate) => (de && ate ? String(Math.max(0, Math.round((new Date(ate) - new Date(de)) / 60000))) : "");

  // A PLANILHA, com o que veio. `;` e BOM, porque é o que o Excel em português
  // abre direto, com acento e sem juntar as colunas numa só. Os tempos vão em
  // MINUTOS inteiros, que se somam e se ordenam — "2 h 10 min" não.
  function baixarPlanilha() {
    const regs = (r && r.registros) || [];
    const campo = campoDaPlanilha;
    // O PRAZO (script 052 da ponte) vai no FIM: as colunas de antes ficam no
    // lugar, e a planilha que alguém já monta toda semana não muda de forma.
    const comPrazo = regs.some((x) => Object.prototype.hasOwnProperty.call(x, "prazo"));
    const linhas = [
      ["Protocolo", "Aberto em", "Como começou", "Cliente", "Número", "Telefone do escritório",
       "Primeira resposta em", "Quem respondeu", "Minutos até a primeira resposta",
       "Finalizado em", "Quem finalizou", "Minutos até finalizar", "Situação",
       ...(comPrazo ? ["Prazo", "Minutos de expediente até a primeira ação", "Prazo do departamento (minutos)"] : [])],
      ...regs.map((x) => [
        x.protocolo,
        new Date(x.aberto_em).toLocaleString("pt-BR"),
        quemAbriu(x),
        nomeDoContato(x.contato),
        telefoneLegivel(x.contato && x.contato.numero),
        nomeDoTelefone(x.advogado_id),
        x.primeira_resposta_em ? new Date(x.primeira_resposta_em).toLocaleString("pt-BR") : "",
        x.respondeu_nome || "",
        x.origem === "cliente" ? minutos(x.aberto_em, x.primeira_resposta_em) : "",
        x.finalizado_em ? new Date(x.finalizado_em).toLocaleString("pt-BR") : "",
        x.finalizado_nome || "",
        minutos(x.aberto_em, x.finalizado_em),
        (ESTADO[x.estado] || {}).texto || "",
        ...(comPrazo ? [(PRAZO_DO_PROTOCOLO[x.prazo] || {}).texto || "",
                        x.minutos_ate_acao == null ? "" : String(x.minutos_ate_acao),
                        x.limite == null ? "" : String(x.limite)] : []),
      ]),
    ];
    const texto = "\ufeff" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `protocolos-${deIso.slice(0, 10)}-a-${ateIso.slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (falta && !souAdmin) return null;

  return (
    <div data-relatorio-protocolos>
      <Titulo C={C} primeiro><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Ticket size={16} /> Protocolos de atendimento</span></Titulo>

      {carregando && <div style={{ ...estilos.nota, padding: "8px 0" }}>Somando os protocolos…</div>}

      {falta && (
        <div style={{ ...estilos.cartao, display: "flex", gap: 12, alignItems: "flex-start" }} data-protocolos-falta={falta}>
          <AlertCircle size={20} color={cores.aviso} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ ...estilos.nota, fontSize: 13.5 }}>
            <b style={{ color: C.textPrimary }}>Falta um passo no banco.</b>{" "}
            {falta === "028"
              ? "Os protocolos ainda não existem neste banco: falta a atualização 028."
              : "A conta dos protocolos é feita lá dentro, e a atualização 029 ainda não chegou a ele."}
            {" "}Elas entram sozinhas quando a ponte é publicada — confira em <b style={{ color: C.textPrimary }}>Departamentos
            e acessos → Atualizações do banco</b>.
          </div>
        </div>
      )}

      {!!erro && (
        <div style={{ ...estilos.cartao, borderColor: "#e5573f", color: C.erroTexto }} data-protocolos-erro>
          Não consegui somar os protocolos: {erro}
        </div>
      )}

      {!carregando && !falta && !erro && r && (() => {
        const t = r.total || {};
        const tempos = r.tempos || {};
        const pr = tempos.primeira_resposta || {}, fi = tempos.finalizar || {};
        const regs = r.registros || [];
        const pessoas = r.por_pessoa || [];
        const pessoasComExpediente = pessoas.some((p) => Object.prototype.hasOwnProperty.call(p, "primeira_mediana_expediente"));
        // OS DIAS SEM NADA ENTRAM COMO ZERO, como no relatório do "Já tratei":
        // o banco só devolve os dias que tiveram protocolo. Completar não é
        // contar — o número de cada dia continua vindo do banco.
        const serie = (() => {
          const tem = new Map((r.por_dia || []).map((x) => [String(x.quando).slice(0, 10), x]));
          const dias = [];
          const d0 = new Date(deIso), d1 = new Date(ateIso);
          d0.setHours(0, 0, 0, 0);
          for (let d = d0; d <= d1 && dias.length < 400; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const x = tem.get(k) || {};
            dias.push({ quando: k, atendimentos: Number(x.atendimentos || 0), sem_resposta: Number(x.sem_resposta || 0) });
          }
          return dias;
        })();
        const series = [{ campo: "atendimentos", cor: cores.saiu, nome: "Com atendimento" },
                        ...(r.so_meu ? [] : [{ campo: "sem_resposta", cor: cores.aviso, nome: "Esperando resposta" }])];
        return (
          <>
            <div style={{ ...estilos.nota, marginBottom: 12 }} data-protocolos-escopo>
              {r.so_meu
                ? <>Os atendimentos de que <b style={{ color: C.textPrimary }}>{souAdmin ? "a pessoa escolhida" : "você"}</b> participou
                    — deu a primeira resposta, finalizou ou reabriu —, abertos no período. Os tempos são os {souAdmin ? "dela" : "seus"}.
                    A comparação por pessoa, mais abaixo, mostra todo mundo.</>
                : <>Os protocolos abertos no período, nos telefones que você alcança. Cada atendimento é um protocolo: começa
                    quando o cliente escreve (ou quando a equipe começa a conversa) e termina no “Finalizar”.{" "}
                    <b style={{ color: C.textPrimary }}>Só entra no total o que a equipe começou</b>, como no DataCrazy — o
                    que ninguém respondeu nem finalizou fica à parte, em “Esperando resposta”.</>}
              {" "}O cartão “Atendimentos” mais abaixo é outra conta, mais antiga: um trecho de conversa entre silêncios
              de 6 horas.
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <Numero destaque C={C} estilos={estilos} antes={r.antes || {}} etiqueta="Total de atendimentos"
                      v={t.atendimentos} comparar="atendimentos"
                      ajuda="Protocolos abertos no período em que a equipe começou o atendimento: respondeu, finalizou, ou foi ela que abriu a conversa. O que o cliente abriu e ninguém tocou não entra — fica em “Esperando resposta”." />
              <Numero C={C} estilos={estilos} antes={{}} etiqueta="Em atendimento" v={t.em_atendimento}
                      ajuda="Começados e ainda não finalizados. Somados aos finalizados, dão o total." />
              <Numero C={C} estilos={estilos} antes={{}} etiqueta="Finalizados" v={t.finalizados}
                      ajuda="Fechados com o “Finalizar”. O que foi finalizado e reaberto conta as duas vezes: são dois protocolos." />
              {!r.so_meu && (
                <Numero C={C} estilos={estilos} antes={{}} etiqueta="Esperando resposta" v={t.sem_resposta}
                        ajuda="Abertos pelo cliente no período, e que ninguém da equipe respondeu nem finalizou ainda. Ficam fora do total até alguém começar — inclusive o do cliente que voltou a escrever numa conversa finalizada." />
              )}
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <Tempo C={C} estilos={estilos} etiqueta="Até a primeira resposta"
                     mediana={pr.mediana} media={pr.media} quantos={pr.quantos}
                     ajuda={`Do momento em que o cliente abriu o protocolo até a primeira resposta da equipe. Só nos protocolos que o cliente abriu: na conversa começada por nós e no Reabrir não houve cliente esperando.${r.so_meu ? " Aqui, só as primeiras respostas da pessoa." : ""}`} />
              {Object.prototype.hasOwnProperty.call(pr, "mediana_expediente") && (
                <Tempo C={C} estilos={estilos} etiqueta="Até a 1ª resposta, no expediente"
                       mediana={pr.mediana_expediente} media={pr.media_expediente} quantos={pr.quantos}
                       ajuda={`O mesmo tempo, contando só o horário de expediente do departamento (a aba “Fora do horário”, com os feriados): a noite e o fim de semana ficam de fora.${r.so_meu ? " Aqui, só as primeiras respostas da pessoa." : ""}`} />
              )}
              <Tempo C={C} estilos={estilos} etiqueta="Até finalizar"
                     mediana={fi.mediana} media={fi.media} quantos={fi.quantos}
                     ajuda={`Do começo do protocolo até o “Finalizar”, em todo protocolo finalizado.${r.so_meu ? " Aqui, só os que a pessoa finalizou." : ""}`} />
            </div>

            <Titulo C={C}>Protocolos por dia</Titulo>
            <Grafico C={C} estilos={estilos} legenda={series.length > 1 ? series.map((s) => ({ nome: s.nome, cor: s.cor })) : null}
              colunas={["Quando", ...series.map((s) => s.nome)]}
              linhas={serie.map((x) => [rotuloData(x.quando, "day"), ...series.map((s) => numero(x[s.campo]))])}
              vazio={serie.every((x) => !x.atendimentos && !x.sem_resposta)}
              rodape="Pelo dia em que o protocolo abriu."
              desenho={() => (
                <Colunas C={C} dados={serie} passo="day" formatar={numero} series={series} />
              )} />

            <Titulo C={C}>Por pessoa</Titulo>
            <div style={estilos.cartao} data-protocolos-por-pessoa>
              <div style={{ ...estilos.nota, marginBottom: 8 }}>
                Mostra <b style={{ color: C.textPrimary }}>todo mundo</b>, mesmo com a tela recortada numa pessoa. A primeira
                resposta conta para quem respondeu, nos protocolos que o cliente abriu; o finalizar, para quem finalizou.
                Tempos em mediana.
              </div>
              {!pessoas.length && <div style={estilos.nota}>Ninguém respondeu nem finalizou protocolo neste período.</div>}
              {pessoas.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={estilos.th}>Pessoa</th>
                      <th style={estilos.thNum}>Primeiras respostas</th>
                      <th style={estilos.thNum}>Até responder</th>
                      {pessoasComExpediente && <th style={estilos.thNum} title="A mediana contando só o horário de expediente">No expediente</th>}
                      <th style={estilos.thNum}>Finalizou</th>
                      <th style={estilos.thNum}>Até finalizar</th>
                    </tr></thead>
                    <tbody>
                      {pessoas.map((p) => {
                        const sou = meuId && p.id && String(p.id) === String(meuId);
                        const escolhe = souAdmin && p.id;
                        return (
                          <tr key={`${p.tipo}-${p.id || p.nome}`} data-pessoa-nos-protocolos={p.nome}
                              onClick={() => escolhe && aoEscolherPessoa(p.id)}
                              title={p.tipo === "celular" ? "Respondido direto pelo WhatsApp do aparelho, fora do Zorvin: não dá para saber quem foi."
                                   : p.tipo === "rotulo" ? "Mensagem de antes de ago/2026, que guardou só o nome de quem escreveu."
                                   : undefined}
                              style={{ cursor: escolhe ? "pointer" : "default",
                                       background: quem && String(quem) === String(p.id) ? C.listActive : "transparent" }}>
                            <td style={{ ...estilos.td, fontWeight: sou ? 800 : 600, color: p.tipo === "pessoa" ? C.textPrimary : C.textSecondary }}>
                              {p.nome}
                              {sou && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: "#fff",
                                                     background: cores.selo, borderRadius: 10, padding: "1px 7px" }}>você</span>}
                            </td>
                            <td style={estilos.num} data-primeiras={p.primeiras}>{numero(p.primeiras)}</td>
                            <td style={estilos.num}>{p.primeiras ? tempo(p.primeira_mediana) : "—"}</td>
                            {pessoasComExpediente && (
                              <td style={estilos.num} data-primeira-expediente={p.primeira_mediana_expediente == null ? "" : String(p.primeira_mediana_expediente)}>
                                {p.primeiras ? tempo(p.primeira_mediana_expediente) : "—"}
                              </td>
                            )}
                            <td style={estilos.num} data-finalizou={p.finalizou}>{numero(p.finalizou)}</td>
                            <td style={estilos.num}>{p.finalizou ? tempo(p.finalizar_mediana) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* A LISTA DOS PROTOCOLOS SAIU DA TELA (06/11, pedido do Rodrigo:
                "muita informação"). Cada protocolo continua na PLANILHA, um por
                linha, com as mesmas colunas de antes. */}
            {regs.length > 0 && (
              <BotaoDaPlanilha C={C} estilos={estilos} aoBaixar={baixarPlanilha} marca="protocolos"
                               veio={regs.length} total={r.total_registros} um="protocolo" varios="protocolos" />
            )}
          </>
        );
      })()}
    </div>
  );
}

/* ================================================================
   O RELATÓRIO POR RESPONSÁVEL — a carteira de cada pessoa, AGORA
   ================================================================
   Pedido do Rodrigo em 01/10. O responsável nasceu em 30/09 para que desse
   para "cobrar a fila de alguém"; faltava o lugar onde se LÊ a fila de cada
   um. A conta é do banco (`zorvin_relatorio_responsaveis`, script 011 da
   ponte), pela régua da tela inteira: a API corta em 1000 linhas sem avisar,
   e o escritório tem ~1.800 conversas.

   É UMA FOTO DE AGORA, e não um período: o banco guarda só o dono de hoje.
   Por isso o período da barra não vale aqui — e a seção diz isso, senão quem
   escolhe "setembro" lê a carteira de hoje achando que é a de setembro.

   "SEM RESPONSÁVEL" É UMA LINHA, e não um rodapé: é a fila de onde qualquer
   um pode puxar trabalho, e quem não administra também a vê.

   SEM A FUNÇÃO ou SEM O SCRIPT 008, quem administra lê qual script falta;
   quem atende não vê nada. COM A FUNÇÃO FALHANDO, a frase vem com o código
   — falha não é ausência (armadilha nº 2). */
function RelatorioResponsaveis({ C, estilos, cores, leitura, souAdmin, meuId }) {
  // A LEITURA VEM DO ALTO (`useLeitura`): "011" é a função que falta, e
  // "008", o que ela diz faltar lá dentro.
  const { carregando, erro } = leitura;
  const falta = leitura.semFuncao ? "011" : (leitura.dados && leitura.dados.falta ? String(leitura.dados.falta) : null);
  const r = leitura.dados && !leitura.dados.falta ? leitura.dados : null;

  if (falta && !souAdmin) return null;

  const SCRIPTS = {
    "011": "sql/automaticos/011-o-relatorio-por-responsavel.sql",
    "008": "sql/automaticos/008-o-responsavel-pela-conversa.sql",
  };
  const linhas = (r && r.linhas) || [];
  const sem = r && r.sem_responsavel;
  const total = (r && r.total) || {};
  // A RÉGUA QUE O BANCO USOU (`dias_atrasada`, script 051 da ponte).
  const dias = diasDaCarteira(r);
  const maiorCarteira = Math.max(1, ...linhas.map((l) => Number(l.conversas || 0)),
                                 sem ? Number(sem.conversas || 0) : 0);

  // UMA LINHA, DESENHADA DO MESMO JEITO para as pessoas e para "sem
  // responsável": duas escritas divergiriam, e a fila sem dono pareceria
  // medida com outra régua.
  const linha = (l, chave, nome, { sou = false, semDono = false } = {}) => {
    const atrasadas = Number(l.atrasadas || 0);
    const dias = l.mais_antiga ? diasDesde(l.mais_antiga) : null;
    return (
      <tr key={chave} data-responsavel-no-relatorio={semDono ? "sem" : nome}
          style={{ background: semDono ? C.headerBar : "transparent" }}>
        <td style={{ ...estilos.td, width: "34%" }}>
          <div style={{ fontWeight: sou ? 800 : 600, fontStyle: semDono ? "italic" : "normal" }}>
            {nome}
            {sou && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: "#fff",
                                   background: cores.selo, borderRadius: 10, padding: "1px 7px" }}>você</span>}
          </div>
          <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
            <div style={{ width: `${Math.round((Number(l.conversas || 0) / maiorCarteira) * 100)}%`, height: "100%",
                          background: sou ? cores.saiu : cores.apagado }} />
          </div>
        </td>
        <td style={estilos.num} data-conversas={l.conversas}>{numero(l.conversas)}</td>
        <td style={estilos.num} data-esperando={l.esperando}>{numero(l.esperando)}</td>
        {/* O VERMELHO MARCA QUE HÁ ALGUÉM ESPERANDO além da régua do banco
            (2 dias com o script 051 da ponte, a mesma da tela "Esperando
            resposta"). A "mais antiga", ao lado, continua com o vermelho da
            lista: três dias ou mais. */}
        <td style={{ ...estilos.num, color: atrasadas ? C.esperaVermelha : C.textSecondary, fontWeight: atrasadas ? 700 : 400 }}
            data-atrasadas={l.atrasadas}>{numero(atrasadas)}</td>
        <td style={{ ...estilos.num, color: dias != null && dias >= DIAS_DO_VERMELHO ? C.esperaVermelha : C.textPrimary }}
            data-mais-antiga={dias == null ? "" : dias}>
          {dias == null ? "—" : dias === 0 ? "hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`}
        </td>
        <td style={estilos.num} data-nao-lidas={l.nao_lidas}>{numero(l.nao_lidas)}</td>
      </tr>
    );
  };

  return (
    <div data-relatorio-responsaveis>
      <Titulo C={C}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <UserCheck size={16} /> Por responsável</span></Titulo>

      {carregando && <div style={{ ...estilos.nota, padding: "8px 0" }}>Contando as carteiras…</div>}

      {falta && (
        <div style={{ ...estilos.cartao, display: "flex", gap: 12, alignItems: "flex-start" }} data-responsaveis-falta={falta}>
          <AlertCircle size={20} color={cores.aviso} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ ...estilos.nota, fontSize: 13.5 }}>
            <b style={{ color: C.textPrimary }}>Falta um passo no banco.</b>{" "}
            {falta === "008"
              ? "As conversas ainda não têm responsável: "
              : "A conta é feita lá dentro, e a função ainda não foi criada: "}
            rode o script{" "}
            <code style={{ background: C.headerBar, padding: "1px 5px", borderRadius: 4 }}>
              {SCRIPTS[falta] || SCRIPTS["011"]}
            </code>{" "}(repositório da ponte) no SQL Editor do Supabase.
          </div>
        </div>
      )}

      {!!erro && (
        <div style={{ ...estilos.cartao, borderColor: "#e5573f", color: C.erroTexto }} data-responsaveis-erro>
          Não consegui contar as carteiras: {erro}
        </div>
      )}

      {!carregando && !falta && !erro && r && (
        <>
          <div style={{ ...estilos.nota, marginBottom: 12 }} data-responsaveis-escopo>
            <b style={{ color: C.textPrimary }}>Agora</b> — este bloco não usa o período escolhido no alto:
            o banco guarda só o responsável de hoje.{" "}
            {r.so_meu
              ? <>Aqui estão <b style={{ color: C.textPrimary }}>a sua carteira</b> e a fila sem responsável.</>
              : <>Arquivadas e telefones desativados ficam de fora.</>}
          </div>
          <div style={{ ...estilos.cartao, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr>
                <th style={estilos.th}>Responsável</th>
                <th style={estilos.thNum}>Conversas</th>
                <th style={estilos.thNum} title="Com cliente esperando resposta">Esperando</th>
                <th style={estilos.thNum} title={`Esperando ${fraseDasAtrasadas(dias)}`} data-rotulo-das-atrasadas>{rotuloDasAtrasadas(dias)}</th>
                <th style={estilos.thNum} title="A espera do cliente mais esquecido">Mais antiga</th>
                <th style={estilos.thNum}>Não lidas</th>
              </tr></thead>
              <tbody>
                {linhas.map((l) => linha(l, l.id, l.nome || "(sem nome)",
                                         { sou: meuId && String(l.id) === String(meuId) }))}
                {sem && linha(sem, "sem", "Sem responsável", { semDono: true })}
              </tbody>
            </table>
            {!linhas.length && !sem && (
              <div style={{ ...estilos.nota, marginTop: 8 }}>Nenhuma conversa aberta nestes telefones.</div>
            )}
            {!r.so_meu && (linhas.length + (sem ? 1 : 0)) > 1 && (
              <div style={{ ...estilos.nota, marginTop: 10 }} data-responsaveis-total>
                No total: {numero(total.conversas)} conversas, {numero(total.esperando)} esperando,{" "}
                <b style={{ color: Number(total.atrasadas) ? C.esperaVermelha : C.textPrimary }}>{numero(total.atrasadas)}</b> {fraseDasAtrasadas(dias)}.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================
   O RELATÓRIO DO FUNIL — quantos em cada etapa, e quanto tempo (07/10)
   ================================================================
   Pedido do Rodrigo logo depois do funil: "quantos clientes há em cada
   etapa, e quanto tempo eles ficam em cada uma". A conta é do banco
   (`zorvin_relatorio_funil`, script 019 da ponte), pela régua desta tela: a
   API corta em 1000 linhas, e o histórico de movimentos passa disso.

   DUAS PERGUNTAS DIFERENTES NA MESMA TABELA, e a seção separa as duas:
     - o que ESTÁ (agora, há quanto tempo, o mais parado) — não usa o período;
     - o que ACONTECEU no período (entraram, saíram, quanto tempo ficaram).
   Misturar as duas sem dizer faria quem escolhe "setembro" ler a etapa de
   hoje achando que é a de setembro — a régua do relatório por responsável.

   O TEMPO NA ETAPA É O DE QUEM SAIU. Quem ainda está lá não terminou de
   passar por ela; o tempo dele aparece em "há quanto tempo", à parte.

   SEM A FUNÇÃO ou SEM O SCRIPT 017, quem administra lê qual script falta;
   quem atende não vê nada. COM A FUNÇÃO FALHANDO, a frase vem com o código
   — falha não é ausência (armadilha nº 2).

   UM BLOCO POR FUNIL (02/11): desde o script 043 um telefone pode ter o
   funil dele, e o bloco diz de qual é — "Sucesso do Cliente · Audiências".
   O banco manda `telefone` nulo no bloco do funil do departamento. */
function RelatorioFunil({ C, estilos, cores, deIso, ateIso, telefone, departamento, souAdmin }) {
  const [r, setR] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [falta, setFalta] = useState(null);   // "019" | "017" | null

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true); setErro(""); setFalta(null);
      const { data, error } = await supabase.rpc("zorvin_relatorio_funil", {
        p_desde: deIso, p_ate: ateIso, p_departamento: departamento, p_telefone: telefone,
      });
      if (!vivo) return;
      setCarregando(false);
      if (error) {
        if (semAFuncao(error)) { setFalta("019"); return; }
        setErro(`${error.message || "erro desconhecido"}${error.code ? ` (código ${error.code})` : ""}`);
        return;
      }
      if (data && data.falta) { setFalta(String(data.falta)); return; }
      setR(data || null);
    })();
    return () => { vivo = false; };
  }, [deIso, ateIso, telefone, departamento]);

  if (falta && !souAdmin) return null;

  const SCRIPTS = {
    "019": "sql/automaticos/019-o-relatorio-do-funil.sql",
    "017": "sql/automaticos/017-o-funil-de-etapas.sql",
  };
  const deps = (r && r.departamentos) || [];
  const parado = (iso) => {
    if (!iso) return "—";
    const d = diasDesde(iso);
    return d === 0 ? "hoje" : `há ${d} ${d === 1 ? "dia" : "dias"}`;
  };

  return (
    <div data-relatorio-funil>
      <Titulo C={C}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <SquareKanban size={16} /> Funil</span></Titulo>

      {carregando && <div style={{ ...estilos.nota, padding: "8px 0" }}>Contando o funil…</div>}

      {falta && (
        <div style={{ ...estilos.cartao, display: "flex", gap: 12, alignItems: "flex-start" }} data-funil-falta={falta}>
          <AlertCircle size={20} color={cores.aviso} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ ...estilos.nota, fontSize: 13.5 }}>
            <b style={{ color: C.textPrimary }}>Falta um passo no banco.</b>{" "}
            {falta === "017"
              ? "O funil ainda não existe neste banco: "
              : "A conta é feita lá dentro, e a função ainda não foi criada: "}
            rode o script{" "}
            <code style={{ background: C.headerBar, padding: "1px 5px", borderRadius: 4 }}>
              {SCRIPTS[falta] || SCRIPTS["019"]}
            </code>{" "}(repositório da ponte) no SQL Editor do Supabase.
          </div>
        </div>
      )}

      {!!erro && (
        <div style={{ ...estilos.cartao, borderColor: "#e5573f", color: C.erroTexto }} data-funil-erro>
          Não consegui contar o funil: {erro}
        </div>
      )}

      {!carregando && !falta && !erro && r && (
        <>
          <div style={{ ...estilos.nota, marginBottom: 12 }} data-funil-escopo>
            <b style={{ color: C.textPrimary }}>Agora</b> e <b style={{ color: C.textPrimary }}>há quanto tempo</b> são
            a foto de hoje, e não usam o período. <b style={{ color: C.textPrimary }}>Entraram</b>,{" "}
            <b style={{ color: C.textPrimary }}>saíram</b> e <b style={{ color: C.textPrimary }}>tempo na etapa</b> são
            do período escolhido no alto — o tempo é o de quem saiu da etapa.
            {telefone ? " Só os clientes que conversam pelo telefone escolhido." : ""}
          </div>
          {!deps.length && (
            <div style={{ ...estilos.cartao, ...estilos.nota }} data-funil-sem-departamento>
              Nenhum funil nos departamentos que você atende.
            </div>
          )}
          {deps.map((d) => {
            const etapas = d.etapas || [];
            const nomeDoBloco = d.telefone ? `${d.nome} · ${d.telefone}` : d.nome;
            const chaveDoBloco = `${d.id}|${d.telefone_id || ""}`;
            const maior = Math.max(1, ...etapas.map((e) => Number(e.agora || 0)));
            // O FUNIL SEM NINGUÉM vira uma linha, e não sete linhas de zero: um
            // escritório com quatro departamentos e um funil em uso leria três
            // tabelas zeradas antes de achar a que importa.
            if (!Number(d.agora) && !Number(d.movimentos)) {
              return (
                <div key={chaveDoBloco} style={{ ...estilos.cartao, marginBottom: 12, display: "flex", flexWrap: "wrap",
                                         alignItems: "baseline", gap: "4px 14px" }}
                     data-funil-departamento={d.nome} data-funil-telefone={d.telefone || ""} data-funil-vazio>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: C.textPrimary }}>{nomeDoBloco}</div>
                  <div style={estilos.nota}>Nenhum cliente neste funil agora, e nenhum movimento no período.</div>
                </div>
              );
            }
            return (
              <div key={chaveDoBloco} style={{ ...estilos.cartao, overflowX: "auto", marginBottom: 12 }}
                   data-funil-departamento={d.nome} data-funil-telefone={d.telefone || ""}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 14px", marginBottom: 8 }}>
                  <div data-nome-do-bloco style={{ fontWeight: 700, fontSize: 14.5, color: C.textPrimary }}>{nomeDoBloco}</div>
                  <div style={{ ...estilos.nota }} data-funil-resumo>
                    <b style={{ color: C.textPrimary }} data-funil-agora={d.agora}>{numero(d.agora)}</b>{" "}
                    {Number(d.agora) === 1 ? "cliente" : "clientes"} no funil agora · no período,{" "}
                    <span data-funil-entraram-no-funil={d.entraram_no_funil}>{numero(d.entraram_no_funil)} entraram</span>,{" "}
                    <span data-funil-sairam-do-funil={d.sairam_do_funil}>{numero(d.sairam_do_funil)} saíram do funil</span>{" "}
                    e {numero(d.movimentos)} {Number(d.movimentos) === 1 ? "movimento" : "movimentos"}
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead><tr>
                    <th style={estilos.th}>Etapa</th>
                    <th style={estilos.thNum}>Agora</th>
                    <th style={estilos.thNum} title="Há quanto tempo, na mediana, os clientes de agora estão nesta etapa">Há quanto tempo</th>
                    <th style={estilos.thNum} title="Desde quando está nela o cliente mais parado">Mais parado</th>
                    <th style={estilos.thNum} title="Quantas vezes um cliente chegou a esta etapa no período">Entraram</th>
                    <th style={estilos.thNum} title="Quantas vezes um cliente saiu desta etapa no período">Saíram</th>
                    <th style={estilos.thNum} title="Quanto tempo ficaram na etapa os que saíram no período (mediana)">Tempo na etapa</th>
                  </tr></thead>
                  <tbody>
                    {etapas.map((e) => (
                      <tr key={e.id} data-funil-etapa={e.nome} style={{ opacity: e.ativo === false ? 0.7 : 1 }}>
                        <td style={{ ...estilos.td, width: "30%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600 }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                                           background: e.cor || cores.apagado }} />
                            <span>{e.nome}</span>
                            {e.ativo === false && (
                              <span data-funil-etapa-desativada style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary,
                                                                          border: `1px solid ${C.divider}`, borderRadius: 10, padding: "0 6px" }}>
                                desativada
                              </span>
                            )}
                          </div>
                          <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
                            <div style={{ width: `${Math.round((Number(e.agora || 0) / maior) * 100)}%`, height: "100%",
                                          background: e.cor || cores.apagado }} />
                          </div>
                        </td>
                        <td style={estilos.num} data-agora={e.agora}>{numero(e.agora)}</td>
                        <td style={estilos.num} data-agora-mediana={e.agora_mediana_s ?? ""}>
                          {Number(e.agora) ? tempo(e.agora_mediana_s) : "—"}
                        </td>
                        <td style={estilos.num} data-mais-antigo={e.mais_antigo ? diasDesde(e.mais_antigo) : ""}>
                          {parado(e.mais_antigo)}
                        </td>
                        <td style={estilos.num} data-entraram={e.entraram}>{numero(e.entraram)}</td>
                        <td style={estilos.num} data-sairam={e.sairam}>{numero(e.sairam)}</td>
                        <td style={estilos.num} data-tempo-mediana={e.tempo_mediana_s ?? ""}
                            title={e.tempo_quantos ? `Mediana de ${numero(e.tempo_quantos)} ${Number(e.tempo_quantos) === 1 ? "passagem" : "passagens"}; média ${tempo(e.tempo_media_s)}` : "Ninguém saiu desta etapa no período"}>
                          {e.tempo_quantos ? tempo(e.tempo_mediana_s) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function RelatorioJaTratei({ C, estilos, cores, leitura, deIso, ateIso, passo, quem,
                             souAdmin, meuId, advogados, aoEscolherPessoa }) {
  // A LEITURA VEM DO ALTO (`useLeitura`).
  const { carregando, erro } = leitura;
  const falta = leitura.semFuncao;
  const r = leitura.dados;

  const nomeDoTelefone = (id) => {
    const a = advogados.find((x) => String(x.id) === String(id));
    return a ? (a.nome || a.numero) : "";
  };

  // A PLANILHA, com o que veio. `;` e BOM, porque é o que o Excel em português
  // abre direto, com acento e sem juntar as colunas numa só.
  function baixarPlanilha() {
    const regs = (r && r.registros) || [];
    const campo = campoDaPlanilha;
    const linhas = [
      ["Quando", "Quem", "Cliente", "Número", "Telefone do escritório", "Assuntos", "O que foi tratado", "Esperava desde", "Desfeito"],
      ...regs.map((x) => [
        new Date(x.quando).toLocaleString("pt-BR"),
        x.quem_nome || "",
        nomeDoContato(x.contato),
        telefoneLegivel(x.contato && x.contato.numero),
        nomeDoTelefone(x.advogado_id),
        (x.assuntos || []).join(", "),
        x.observacao || "",
        x.esperava_desde ? new Date(x.esperava_desde).toLocaleString("pt-BR") : "",
        x.desfeito ? "sim" : "",
      ]),
    ];
    const texto = "\ufeff" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ja-tratei-${deIso.slice(0, 10)}-a-${ateIso.slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (falta && !souAdmin) return null;

  return (
    <div data-relatorio-ja-tratei>
      <Titulo C={C}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <ListChecks size={16} /> Já tratei</span></Titulo>

      {carregando && <div style={{ ...estilos.nota, padding: "8px 0" }}>Somando o que foi tratado…</div>}

      {falta && (
        <div style={{ ...estilos.cartao, display: "flex", gap: 12, alignItems: "flex-start" }} data-relatorio-falta>
          <AlertCircle size={20} color={cores.aviso} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ ...estilos.nota, fontSize: 13.5 }}>
            <b style={{ color: C.textPrimary }}>Falta um passo no banco.</b> O relatório é somado lá dentro, e
            a função ainda não foi criada: rode o script{" "}
            <code style={{ background: C.headerBar, padding: "1px 5px", borderRadius: 4 }}>
              sql/automaticos/010-o-relatorio-do-ja-tratei.sql
            </code>{" "}(repositório da ponte) no SQL Editor do Supabase.
          </div>
        </div>
      )}

      {!!erro && (
        <div style={{ ...estilos.cartao, borderColor: "#e5573f", color: C.erroTexto }} data-relatorio-erro>
          Não consegui somar o que foi tratado: {erro}
        </div>
      )}

      {!carregando && !falta && !erro && r && (() => {
        const t = r.total || {};
        const dias = t.espera_mediana_dias == null ? null : Number(t.espera_mediana_dias);
        const regs = r.registros || [];
        const assuntos = r.por_assunto || [];
        const pessoas = r.por_pessoa || [];
        // OS DIAS SEM NADA ENTRAM COMO ZERO. O banco só devolve os dias que
        // tiveram "Já tratei"; sem completar, um mês com um dia só vira uma
        // barra solta no meio do gráfico, sem dizer que os outros 29 foram zero.
        // Completar não é contar: o número de cada dia continua vindo do banco.
        const serie = (() => {
          const tem = new Map((r.por_dia || []).map((x) => [String(x.quando).slice(0, 10), Number(x.tratamentos || 0)]));
          const dias = [];
          const d0 = new Date(deIso), d1 = new Date(ateIso);
          d0.setHours(0, 0, 0, 0);
          for (let d = d0; d <= d1 && dias.length < 400; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            dias.push({ quando: k, tratamentos: tem.get(k) || 0 });
          }
          return dias;
        })();
        const maiorAssunto = Math.max(1, ...assuntos.map((a) => Number(a.vezes || 0)));
        const maiorPessoa = Math.max(1, ...pessoas.map((p) => Number(p.tratamentos || 0)));
        return (
          <>
            <div style={{ ...estilos.nota, marginBottom: 12 }} data-relatorio-escopo>
              {/* "VOCÊ" SÓ PARA QUEM É VOCÊ (auditoria de 28/10): `so_meu` vale
                  para qualquer recorte por pessoa, e quem administra escolhe outras. */}
              {r.so_meu
                ? <>O que <b style={{ color: C.textPrimary }}>{souAdmin && quem != null && String(quem) !== String(meuId) ? "a pessoa escolhida" : "você"}</b> tirou da fila sem mandar mensagem. A comparação por pessoa, mais abaixo, mostra todo mundo.</>
                : <>O que <b style={{ color: C.textPrimary }}>a equipe</b> tirou da fila sem mandar mensagem, nos telefones que você alcança.</>}
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <Numero destaque C={C} estilos={estilos} antes={{}} etiqueta="Conversas tratadas" v={t.conversas}
                      ajuda="Clientes diferentes que saíram da fila por um “Já tratei”. Tratar a mesma conversa duas vezes conta uma." />
              <Numero C={C} estilos={estilos} antes={{}} etiqueta="Vezes “Já tratei”" v={t.tratamentos}
                      ajuda="Cada confirmação conta uma vez, mesmo marcando vários assuntos juntos." />
              <div style={estilos.cartao} data-cartao="Esperavam">
                <div style={{ ...estilos.rotulo, display: "flex", alignItems: "center", gap: 5 }}>
                  Esperavam
                  <span title="Há quanto tempo o cliente esperava quando alguém disse “já tratei” — a mediana: metade esperava menos que isso."
                        style={{ display: "flex", cursor: "help" }}><Info size={12} /></span>
                </div>
                <div style={estilos.valor} data-valor={dias == null ? "" : String(dias)}>
                  {dias == null ? "—" : dias < 1 ? "menos de 1 dia" : `${Math.round(dias)} ${Math.round(dias) === 1 ? "dia" : "dias"}`}
                </div>
                <div style={{ ...estilos.nota, marginTop: 4 }}>
                  mediana · {numero(t.com_espera)} {Number(t.com_espera) === 1 ? "caso" : "casos"}
                </div>
              </div>
              <Numero C={C} estilos={estilos} antes={{}} etiqueta="Desfeitos" v={t.desfeitos}
                      ajuda="Marcados e depois desfeitos. Não entram nas outras contas: marcar por engano não é trabalho feito." />
            </div>

            <Titulo C={C}>Já tratei por dia</Titulo>
            <Grafico C={C} estilos={estilos} legenda={null}
              colunas={["Quando", "Já tratei"]}
              linhas={serie.map((x) => [rotuloData(x.quando, passo), numero(x.tratamentos)])}
              vazio={serie.every((x) => !x.tratamentos)}
              desenho={() => (
                <Colunas C={C} dados={serie} passo={passo} formatar={numero}
                         series={[{ campo: "tratamentos", cor: cores.saiu, nome: "Já tratei" }]} />
              )} />

            <div style={{ display: "grid", gap: 12, marginTop: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              <div style={estilos.cartao} data-relatorio-por-assunto>
                <div style={{ ...estilos.rotulo, marginBottom: 8 }}>Por assunto</div>
                {!assuntos.length && <div style={estilos.nota}>Nada neste período.</div>}
                <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                  {assuntos.map((a) => (
                    <tr key={a.id} data-assunto-no-relatorio={a.nome}>
                      <td style={{ ...estilos.td, width: "70%" }}>
                        <div style={{ fontWeight: 600 }}>
                          {a.nome}
                          {!a.ativo && <span style={{ marginLeft: 7, fontSize: 11, color: C.textSecondary }}>fora de uso</span>}
                        </div>
                        <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
                          <div style={{ width: `${Math.round((Number(a.vezes) / maiorAssunto) * 100)}%`, height: "100%", background: cores.saiu }} />
                        </div>
                      </td>
                      <td style={{ ...estilos.num, fontWeight: 700 }} data-vezes={a.vezes}>{numero(a.vezes)}</td>
                    </tr>
                  ))}
                </tbody></table>
                {Number(t.marcacoes) > Number(t.tratamentos) && (
                  <div style={{ ...estilos.nota, marginTop: 10 }}>
                    Somam {numero(t.marcacoes)}, mais que os {numero(t.tratamentos)} “Já tratei”: um mesmo
                    atendimento pode marcar mais de um assunto.
                  </div>
                )}
              </div>

              <div style={estilos.cartao} data-relatorio-por-pessoa>
                <div style={{ ...estilos.rotulo, marginBottom: 8 }}>Por pessoa</div>
                {!pessoas.length && <div style={estilos.nota}>Ninguém usou o “Já tratei” neste período.</div>}
                <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                  {pessoas.map((p) => {
                    const sou = meuId && String(p.id) === String(meuId);
                    return (
                      <tr key={p.id || p.nome} data-pessoa-no-relatorio={p.nome}
                          onClick={() => souAdmin && p.id && aoEscolherPessoa(p.id)}
                          style={{ cursor: souAdmin && p.id ? "pointer" : "default",
                                   background: String(quem) === String(p.id) ? C.listActive : "transparent" }}>
                        <td style={{ ...estilos.td, width: "70%" }}>
                          <div style={{ fontWeight: sou ? 800 : 600 }}>
                            {p.nome}
                            {sou && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: "#fff",
                                                   background: cores.selo, borderRadius: 10, padding: "1px 7px" }}>você</span>}
                          </div>
                          <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
                            <div style={{ width: `${Math.round((Number(p.tratamentos) / maiorPessoa) * 100)}%`, height: "100%",
                                          background: sou ? cores.saiu : cores.apagado }} />
                          </div>
                        </td>
                        <td style={{ ...estilos.num, fontWeight: 700 }} data-tratamentos={p.tratamentos}>{numero(p.tratamentos)}</td>
                      </tr>
                    );
                  })}
                </tbody></table>
              </div>
            </div>

            {/* A LISTA DOS REGISTROS SAIU DA TELA (06/11, pedido do Rodrigo:
                "muita informação"). Cada "Já tratei" continua na PLANILHA, com o
                texto do OUTROS e o desfeito marcado. */}
            {regs.length > 0 && (
              <BotaoDaPlanilha C={C} estilos={estilos} aoBaixar={baixarPlanilha} marca="relatorio"
                               veio={regs.length} total={r.total_registros} um="registro" varios="registros" />
            )}
          </>
        );
      })()}
    </div>
  );
}
