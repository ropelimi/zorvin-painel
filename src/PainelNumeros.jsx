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
//   QUEM        por atendente — e este é o único bloco que mostra todo mundo,
//               porque comparação com uma linha só não é comparação.
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
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  ArrowLeft, RefreshCw, AlertCircle, Table2, BarChart3, Info, Calendar,
  ChevronLeft, ChevronRight, ChevronDown, Check, X, Users, Phone, Building2,
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
  claro:  { saiu: "#008069", chegou: "#2a78d6", apagado: "#98a5ac", aviso: "#c98500" },
  escuro: { saiu: "#00a884", chegou: "#3987e5", apagado: "#6b7a83", aviso: "#e0a400" },
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
  const de = new Date(); de.setDate(de.getDate() - n); de.setHours(0, 0, 0, 0);
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
  const dur = fimDoDia(p.ate) - inicioDoDia(p.de);
  const de = new Date(inicioDoDia(p.de).getTime() + sentido * dur);
  const ate = new Date(fimDoDia(p.ate).getTime() + sentido * dur);
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

export default function PainelNumeros({ C, modo = "claro", advogados = [], departamentos = [],
                                        souAdmin = false, meuId = null, meuNome = "", aoFechar }) {
  const cores = CORES[modo] || CORES.claro;
  const rampa = RAMPA[modo] || RAMPA.claro;

  const [periodo, setPeriodo] = useState(() => ultimosDias(30));
  // Quem não administra não escolhe atendente: é sempre ele mesmo.
  const [quem, setQuem] = useState(souAdmin ? null : meuId);
  const [telefone, setTelefone] = useState(null);
  const [departamento, setDepartamento] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [faltaSql, setFaltaSql] = useState(false);
  const [d, setD] = useState(null);

  // O FUSO DE QUEM ESTÁ OLHANDO. Sem mandá-lo, o banco (que roda em UTC) corta
  // o dia às 21h e o mapa de horários sai três horas deslocado.
  const fuso = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Campo_Grande"; }
    catch (_) { return "America/Campo_Grande"; }
  }, []);

  const deIso = periodo.de.toISOString(), ateIso = periodo.ate.toISOString();

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true); setErro(""); setFaltaSql(false);
      const { data, error } = await supabase.rpc("painel_dashboard", {
        p_desde: deIso, p_ate: ateIso, p_quem: quem, p_fuso: fuso,
        p_telefone: telefone, p_departamento: departamento,
      });
      if (!vivo) return;
      if (error) {
        // Banco sem a função ainda. Aqui NÃO existe plano B honesto: contar no
        // navegador é justamente o que dava número errado.
        const m = (error.message || "") + (error.code || "");
        if (/painel_dashboard|PGRST202|does not exist|Could not find/i.test(m)) setFaltaSql(true);
        else setErro(error.message || "Erro desconhecido");
        setCarregando(false);
        return;
      }
      setD(data || null);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [deIso, ateIso, quem, telefone, departamento, fuso]);

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
  const opcoesAtendente = useMemo(() => {
    const vistos = new Map();
    (d?.por_atendente || []).forEach((p) => { if (p.id) vistos.set(String(p.id), p.nome || "(sem nome)"); });
    // Eu apareço sempre, mesmo num período em que não atendi nada — senão o
    // filtro "só eu" some justamente quando eu quero saber por que sumi.
    if (meuId && !vistos.has(String(meuId))) vistos.set(String(meuId), meuNome || "Você");
    // E quem estiver selecionado continua na lista mesmo que saia do período,
    // senão trocar o mês faria o filtro se apagar sozinho.
    if (quem && !vistos.has(String(quem))) vistos.set(String(quem), meuNome || "Selecionado");
    return [{ valor: null, rotulo: "Todos os atendentes" },
            ...[...vistos.entries()]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, nome]) => ({ valor: id, rotulo: id === String(meuId) ? `${nome} (você)` : nome }))];
  }, [d, meuId, meuNome, quem]);

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

  return (
    <div data-tela="painel"
         style={{ position: "fixed", inset: 0, background: C.headerBar, color: C.textPrimary,
                  zIndex: 200, overflowY: "auto" }}>

      {/* ================= A BARRA DE FILTROS ================= */}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: C.panel,
                    borderBottom: `1px solid ${C.divider}`, boxShadow: sombra }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 18px",
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={aoFechar} title="Voltar" aria-label="Voltar"
                  style={{ border: "none", background: "transparent", cursor: "pointer",
                           display: "flex", alignItems: "center", padding: 6, marginLeft: -6,
                           borderRadius: 8, color: C.textSecondary }}>
            <ArrowLeft size={20} />
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
      </div>

      <div style={{ padding: "20px 18px 40px", maxWidth: 1180, margin: "0 auto" }}>
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
          <div style={{ ...cartao, borderColor: "#e5573f", color: "#e5573f" }}>
            Não consegui somar os atendimentos: {erro}
          </div>
        )}

        {!carregando && !erro && !faltaSql && d && (
          <>
            <div style={{ ...nota, marginBottom: 14 }} data-teste="escopo">
              {d.so_meu
                ? <>Estes são <b style={{ color: C.textPrimary }}>os seus números</b>{meuNome && !souAdmin ? ` (${meuNome})` : ""}: os atendimentos que você pegou e as mensagens que passaram por eles. A comparação entre atendentes, no fim da tela, continua mostrando todo mundo.</>
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
                     ajuda="Do momento em que o cliente escreve até a nossa primeira resposta. Mensagens seguidas dele contam como uma pergunta só." />
              <Tempo C={C} estilos={estilos} etiqueta="Tempo para atender"
                     mediana={t.espera_mediana} media={t.espera_media} quantos={t.esperas}
                     ajuda="Do início do atendimento até a primeira resposta. Só vale quando foi o cliente quem procurou: quando nós procuramos primeiro, não há espera para medir." />
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

            <Titulo C={C}>Por atendente</Titulo>
            <div style={{ ...nota, marginBottom: 10 }}>
              Este bloco mostra <b style={{ color: C.textPrimary }}>todo mundo</b>, mesmo quando o
              resto da tela está recortado em uma pessoa — é para comparar. Sua linha é a verde;
              clique numa linha para recortar a tela naquela pessoa.
            </div>
            <Atendentes C={C} estilos={estilos} cores={cores} dados={d.por_atendente || []}
                        meuId={meuId} selecionado={quem} podeEscolher={souAdmin}
                        aoEscolher={(id) => setQuem((v) => (String(v) === String(id) ? null : id))} />

            <Ressalvas d={d} t={t} C={C} estilos={estilos} />
          </>
        )}
      </div>
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
            <div style={{ ...estilos.nota, color: cores.aviso, marginTop: 8 }}>{aviso}</div>
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
function Titulo({ C, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 10px" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>{children}</h3>
      <div style={{ flex: 1, height: 1, background: C.divider }} />
    </div>
  );
}

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
        {" "}<b style={{ color: C.textPrimary }}>Aguardando</b> é o cliente que escreveu e não teve
        resposta nenhuma — inclusive os antigos, que são justamente os que doem.
        {" "}<b style={{ color: C.textPrimary }}>Encerrado</b> é o que foi respondido e está parado
        há mais de 6 horas; ninguém precisa clicar em nada para encerrar.
      </div>
    </div>
  );
}

/* ================================================================
   O ENVELOPE DE UM GRÁFICO — legenda e botão de tabela
   ================================================================
   TODO gráfico tem sua tabela. Não é enfeite de acessibilidade: é o que
   permite conferir o desenho, copiar para uma planilha, e ler a tela sem
   depender de distinguir verde de azul. */
function Grafico({ C, estilos, legenda, colunas, linhas, desenho, vazio, rodape }) {
  const [tabela, setTabela] = useState(false);
  return (
    <div style={estilos.cartao}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: "1 1 auto" }}>
          {(legenda || []).map((l) => (
            <span key={l.nome} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.cor }} /> {l.nome}
            </span>
          ))}
        </div>
        <button onClick={() => setTabela((v) => !v)} title={tabela ? "Ver o gráfico" : "Ver os números"}
          style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 30, padding: "4px 10px",
                   border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
                   borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {tabela ? <BarChart3 size={13} /> : <Table2 size={13} />} {tabela ? "Gráfico" : "Tabela"}
        </button>
      </div>

      {vazio && <div style={{ ...estilos.nota, padding: "18px 0" }}>Nada neste período.</div>}
      {!vazio && !tabela && desenho()}

      {!vazio && tabela && (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{colunas.map((c, i) => <th key={c} style={i ? estilos.thNum : estilos.th}>{c}</th>)}</tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>{l.map((v, j) => <td key={j} style={j ? estilos.num : estilos.td}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rodape && <div style={{ ...estilos.nota, marginTop: 12 }}>{rodape}</div>}
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
  const cada = Math.max(1, Math.ceil(dados.length / 10));
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

      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {dados.map((x, i) => (
          <div key={x.quando} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 10.5,
                                       color: C.textSecondary, fontVariantNumeric: "tabular-nums",
                                       whiteSpace: "nowrap", overflow: "hidden" }}>
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
        <button onClick={() => setTabela((v) => !v)}
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

  return (
    <div style={estilos.cartao}>
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
   POR ATENDENTE — a comparação
   ================================================================
   UMA cor para as barras, e não uma cor por pessoa: a barra já diz quem é
   maior; pintar cada uma de um tom gastaria o único canal livre para repetir o
   que o comprimento mostra. O verde marca UMA linha — a sua. */
function Atendentes({ C, estilos, cores, dados, meuId, selecionado, podeEscolher, aoEscolher }) {
  const linhas = useMemo(() => (dados || [])
    .map((p) => ({
      chave: p.chave,
      id: p.id,
      nome: p.nome || "(sem nome)",
      sou: !!(meuId && p.id && String(p.id) === String(meuId)),
      temId: !!p.id,
      atendimentos: Number(p.atendimentos || 0),
      enviadas: Number(p.enviadas || 0),
      resposta: p.resposta_mediana == null ? null : Number(p.resposta_mediana),
      espera: p.espera_mediana == null ? null : Number(p.espera_mediana),
    }))
    .sort((a, b) => (b.atendimentos - a.atendimentos) || (b.enviadas - a.enviadas)),
  [dados, meuId]);

  if (!linhas.length) return <div style={{ ...estilos.cartao, color: C.textSecondary }}>Ninguém atendeu nada no período.</div>;
  const maior = Math.max(1, ...linhas.map((l) => l.atendimentos));

  return (
    <div style={estilos.cartao}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={estilos.th}>Atendente</th>
          <th style={estilos.thNum}>Atendimentos</th>
          <th style={estilos.thNum}>Enviadas</th>
          <th style={estilos.thNum} title="Mediana do tempo entre o cliente escrever e esta pessoa responder">Resposta</th>
          <th style={estilos.thNum} title="Mediana do tempo entre o atendimento começar e esta pessoa pegá-lo">Atender</th>
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} data-atendente={l.nome}
                onClick={() => podeEscolher && l.id && aoEscolher(l.id)}
                style={{ cursor: podeEscolher && l.id ? "pointer" : "default",
                         background: String(selecionado) === String(l.id) ? C.listActive : "transparent" }}>
              <td style={{ ...estilos.td, width: "40%" }}>
                <div style={{ fontWeight: l.sou ? 800 : 600 }}>
                  {l.nome}
                  {l.sou && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: "#fff",
                                           background: cores.saiu, borderRadius: 10, padding: "1px 7px" }}>você</span>}
                  {/* Sem id, a linha pode ser duas pessoas somadas (ou uma pessoa
                      partida em duas, se ela trocou de nome). Dizer isso na linha
                      é mais honesto do que um total liso. */}
                  {!l.temId && (
                    <span title="Contado pelo nome: mensagens anteriores a agosto/2026 não guardam quem enviou."
                          style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: C.textSecondary,
                                   border: `1px solid ${C.divider}`, borderRadius: 10, padding: "1px 7px" }}>
                      pelo nome
                    </span>
                  )}
                </div>
                <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 7 }}>
                  <div style={{ width: `${Math.round((l.atendimentos / maior) * 100)}%`, height: "100%",
                                background: l.sou ? cores.saiu : cores.apagado }} />
                </div>
              </td>
              <td style={{ ...estilos.num, fontWeight: 700 }}>{numero(l.atendimentos)}</td>
              <td style={estilos.num}>{numero(l.enviadas)}</td>
              <td style={estilos.num}>{tempo(l.resposta)}</td>
              <td style={estilos.num}>{tempo(l.espera)}</td>
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
