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
// CADA UM VÊ O QUE É SEU
// ------------------------------------------------------------------
//
// A tela é de todo mundo. Quem não administra vê os PRÓPRIOS números: os
// atendimentos que pegou, as mensagens que mandou, as que chegaram nos
// atendimentos dele. Quem administra tem um botão para ver o escritório
// inteiro.
//
// O recorte é feito NO BANCO, e não aqui: `painel_dashboard` ignora o "quem"
// que o navegador manda quando quem chama não é administrador. Recorte que o
// navegador pode desligar não é recorte — é sugestão.
//
// ------------------------------------------------------------------
// A CONTA É FEITA NO BANCO — de novo, e pelo mesmo motivo
// ------------------------------------------------------------------
//
// A API do Supabase devolve no máximo 1000 linhas por consulta e não avisa que
// cortou. A primeira versão desta tela baixava as mensagens para contar aqui, e
// por isso travava em 1000, escondia os telefones que não couberam na fatia, e
// dava o mesmo número para "7 dias" e para "Tudo". Nada nesta tela conta nada:
// tudo o que aparece aqui veio somado de `painel_dashboard`
// (sql/2026-08-painel-completo.sql, no repositório da ponte).
//
// ------------------------------------------------------------------
// MEDIANA, E NÃO MÉDIA
// ------------------------------------------------------------------
//
// Um cliente que escreve às 22h e é respondido às 8h da manhã põe 10 horas
// dentro da média, e um dia inteiro de respostas em 3 minutos vira "2 horas". A
// mediana diz como foi o atendimento TÍPICO. A média aparece do lado, menor —
// quando as duas estão longe uma da outra, é porque houve caso fora da curva.
//
// ------------------------------------------------------------------
// AS CORES
// ------------------------------------------------------------------
//
// Duas, e só duas: verde para o que SAIU daqui, azul para o que CHEGOU. O par
// foi conferido para daltonismo nos dois temas (separação ΔE 17,4 no claro e
// 18,5 no escuro, contra o piso de 8) — não é escolha de gosto. O resto é
// cinza: no ranking de atendentes, só a SUA barra é verde, e é isso que faz a
// comparação ser lida de relance.
//
// Todo gráfico tem um botão "Tabela" que troca o desenho pelos números. Quem
// não distingue as cores, quem usa leitor de tela e quem quer copiar para uma
// planilha chegam à mesma informação.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ArrowLeft, RefreshCw, AlertCircle, Table2, BarChart3, Info } from "lucide-react";

/** Períodos oferecidos. `dias: null` = tudo o que existe. */
const PERIODOS = [
  { chave: "7", rotulo: "7 dias", dias: 7 },
  { chave: "30", rotulo: "30 dias", dias: 30 },
  { chave: "90", rotulo: "90 dias", dias: 90 },
  { chave: "tudo", rotulo: "Tudo", dias: null },
];

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// AS DUAS CORES DA TELA, uma versão para cada tema. Não são as do WhatsApp por
// acaso: o verde é o mesmo `green` do tema, um tom acima no claro para o
// contraste com o fundo branco chegar a 3:1.
const CORES = {
  claro:  { saiu: "#008069", chegou: "#2a78d6", apagado: "#98a5ac" },
  escuro: { saiu: "#00a884", chegou: "#3987e5", apagado: "#6b7a83" },
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

export default function PainelNumeros({ C, modo = "claro", advogados = [], departamentos = [],
                                        souAdmin = false, meuId = null, meuNome = "", aoFechar }) {
  const [periodo, setPeriodo] = useState("30");
  // Quem administra começa vendo o escritório — era o que essa tela já fazia.
  // Quem não administra não tem esta escolha, e nem o botão.
  const [soMeu, setSoMeu] = useState(!souAdmin);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [faltaSql, setFaltaSql] = useState(false);
  const [d, setD] = useState(null);

  const cores = CORES[modo] || CORES.claro;
  const rampa = RAMPA[modo] || RAMPA.claro;

  const desde = useMemo(() => {
    const dias = PERIODOS.find((p) => p.chave === periodo)?.dias;
    if (!dias) return null;
    const t = new Date();
    t.setDate(t.getDate() - dias);
    return t.toISOString();
  }, [periodo]);

  // O FUSO DE QUEM ESTÁ OLHANDO. Sem mandá-lo, o banco (que roda em UTC) corta
  // o dia às 21h e o mapa de horários sai três horas deslocado: o atendimento
  // das 8h da manhã apareceria ao meio-dia.
  const fuso = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Campo_Grande"; }
    catch (_) { return "America/Campo_Grande"; }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true); setErro(""); setFaltaSql(false);
      const { data, error } = await supabase.rpc("painel_dashboard", {
        p_desde: desde, p_ate: null, p_quem: soMeu ? meuId : null, p_fuso: fuso,
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
  }, [desde, soMeu, meuId, fuso]);

  // ---------- estilos ----------
  const cartao = { background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 12, padding: "14px 16px" };
  const rotulo = { fontSize: 11.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" };
  // Sem `tabular-nums` no número grande: dígitos de largura igual deixam "121"
  // parecendo frouxo em tamanho de manchete.
  const valor = { fontSize: 28, fontWeight: 700, marginTop: 4, lineHeight: 1.15 };
  const nota = { fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 };
  const th = { textAlign: "left", fontSize: 11.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4,
               textTransform: "uppercase", padding: "0 0 6px", borderBottom: `1px solid ${C.divider}` };
  const td = { padding: "9px 0", borderBottom: `1px solid ${C.divider}`, fontSize: 14 };
  const thNum = { ...th, textAlign: "right", paddingLeft: 14, whiteSpace: "nowrap" };
  const num = { ...td, textAlign: "right", paddingLeft: 14, fontVariantNumeric: "tabular-nums", fontWeight: 600 };
  const titulo = { fontSize: 14.5, fontWeight: 700, margin: "24px 0 8px" };

  const t = (d && d.total) || {};
  const antes = (d && d.antes) || {};
  const passo = (d && d.passo) || "day";
  const serie = (d && d.por_periodo) || [];

  // ---------- o cartão de número ----------
  // A comparação com o período anterior sai em CINZA, com seta. Verde/vermelho
  // aqui seria opinião: mais mensagens não é bom nem ruim por si — pode ser
  // movimento, pode ser retrabalho. A seta diz para onde foi; quem lê decide o
  // que isso significa.
  const Numero = ({ etiqueta, v, sufixo, comparar, ajuda }) => {
    let delta = null;
    if (comparar != null && antes.existe) {
      const a = Number(antes[comparar] || 0), b = Number(v || 0);
      // PORCENTAGEM SÓ QUANDO ELA QUER DIZER ALGUMA COISA. De 3 para 69 são
      // "↑ 2200%", que ninguém consegue usar para nada — e que soa a erro. Com
      // base pequena, o honesto é mostrar os dois números crus.
      if (a >= 10) {
        const p = Math.round(((b - a) / a) * 100);
        delta = <>{p > 0 ? "↑" : p < 0 ? "↓" : "="} {Math.abs(p)}% <span style={{ opacity: 0.75 }}>que no período anterior</span></>;
      } else {
        delta = <>no período anterior: <b style={{ color: C.textPrimary }}>{numero(a)}</b></>;
      }
    }
    return (
      <div style={cartao} data-cartao={etiqueta}>
        <div style={{ ...rotulo, display: "flex", alignItems: "center", gap: 5 }}>
          {etiqueta}
          {ajuda && <span title={ajuda} style={{ display: "flex", cursor: "help" }}><Info size={12} /></span>}
        </div>
        <div style={valor} data-valor={v == null ? "" : String(v)}>{numero(v)}{sufixo}</div>
        {delta && (
          <div style={{ ...nota, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{delta}</div>
        )}
      </div>
    );
  };

  const Tempo = ({ etiqueta, mediana, media, quantos, ajuda }) => (
    <div style={cartao} data-cartao={etiqueta}>
      <div style={{ ...rotulo, display: "flex", alignItems: "center", gap: 5 }}>
        {etiqueta}
        <span title={ajuda} style={{ display: "flex", cursor: "help" }}><Info size={12} /></span>
      </div>
      <div style={valor} data-valor={mediana == null ? "" : String(mediana)}>{tempo(mediana)}</div>
      <div style={{ ...nota, marginTop: 2 }}>
        metade foi mais rápido que isso · média {tempo(media)} · {numero(quantos)} {Number(quantos) === 1 ? "caso" : "casos"}
      </div>
    </div>
  );

  return (
    <div data-tela="painel"
         style={{ position: "fixed", inset: 0, background: C.headerBar, color: C.textPrimary, zIndex: 200, overflowY: "auto" }}>
      {/* Um filtro só, acima de tudo o que ele recorta. Filtro dentro do
          cartão de cada gráfico faria dois gráficos vizinhos falarem de
          períodos diferentes sem avisar. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", flexWrap: "wrap",
                    background: C.panel, borderBottom: `1px solid ${C.divider}`, position: "sticky", top: 0, zIndex: 2 }}>
        <button onClick={aoFechar} title="Voltar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", minHeight: 32, alignItems: "center" }}>
          <ArrowLeft size={20} color={C.textSecondary} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, flex: "1 1 auto" }}>Painel</div>

        {souAdmin && (
          <div style={{ display: "flex", gap: 6 }} data-grupo="escopo">
            {[{ k: false, r: "Escritório" }, { k: true, r: "Só eu" }].map((o) => (
              <button key={String(o.k)} onClick={() => setSoMeu(o.k)}
                style={{ minHeight: 32, border: `1px solid ${soMeu === o.k ? C.greenDark : C.divider}`,
                         background: soMeu === o.k ? C.greenDark : "transparent",
                         color: soMeu === o.k ? "#fff" : C.textSecondary,
                         borderRadius: 20, padding: "5px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {o.r}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6 }} data-grupo="periodo">
          {PERIODOS.map((p) => (
            <button key={p.chave} onClick={() => setPeriodo(p.chave)}
              style={{ minHeight: 32, border: `1px solid ${periodo === p.chave ? C.greenDark : C.divider}`,
                       background: periodo === p.chave ? C.greenDark : "transparent",
                       color: periodo === p.chave ? "#fff" : C.textSecondary,
                       borderRadius: 20, padding: "5px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
        {carregando && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, padding: 24 }}>
            <RefreshCw size={16} /> Somando os atendimentos…
          </div>
        )}

        {faltaSql && (
          <div style={{ ...cartao, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertCircle size={20} color="#d99a1e" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              <b>Falta um passo no banco.</b>
              <div style={{ ...nota, marginTop: 6 }}>
                Este painel soma tudo dentro do banco, e a função que faz essa conta
                ainda não foi criada. Rode o arquivo
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
            {/* Quem está vendo o quê. Sem esta linha, o mesmo painel com dois
                totais diferentes (o meu e o do escritório) vira dúvida. */}
            <div style={{ ...nota, marginBottom: 12 }} data-teste="escopo">
              {d.so_meu
                ? <>Estes são <b style={{ color: C.textPrimary }}>os seus números</b>{meuNome ? ` (${meuNome})` : ""}: os atendimentos que você pegou e as mensagens que passaram por eles. A comparação entre atendentes, no fim da tela, continua mostrando todo mundo.</>
                : <>Estes são os números <b style={{ color: C.textPrimary }}>do escritório inteiro</b> — de todos os telefones que você alcança.</>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <Numero etiqueta="Atendimentos" v={t.atendimentos} comparar="atendimentos"
                      ajuda="Um trecho de conversa. Começa quando alguém escreve depois de 6 horas de silêncio e termina nas 6 horas de silêncio seguintes." />
              <Numero etiqueta="Recebidas" v={t.recebidas} comparar="recebidas" />
              <Numero etiqueta="Enviadas" v={t.enviadas} comparar="enviadas" />
              <Numero etiqueta="Notas internas" v={t.notas}
                      ajuda="Ficam à parte e não entram no total de mensagens: nunca saíram daqui." />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 12 }}>
              <Tempo etiqueta="Tempo de resposta" mediana={t.resposta_mediana} media={t.resposta_media} quantos={t.respostas}
                     ajuda="Do momento em que o cliente escreve até a nossa primeira resposta. Mensagens seguidas dele contam como uma pergunta só." />
              <Tempo etiqueta="Tempo para atender" mediana={t.espera_mediana} media={t.espera_media} quantos={t.esperas}
                     ajuda="Do início do atendimento até a primeira resposta. Só vale quando foi o cliente quem procurou: quando nós ligamos primeiro, não há espera para medir." />
            </div>

            <Situacao t={t} C={C} cores={cores} cartao={cartao} rotulo={rotulo} nota={nota} />

            <h3 style={titulo}>Atendimentos por período</h3>
            <Grafico C={C} cartao={cartao} nota={nota} th={th} thNum={thNum} td={td} num={num}
              legenda={null}
              colunas={["Quando", "Atendimentos"]}
              linhas={serie.map((s) => [rotuloData(s.quando, passo), numero(s.atendimentos)])}
              vazio={serie.every((s) => !s.atendimentos)}
              desenho={(largura) => (
                <Colunas C={C} dados={serie} passo={passo} series={[{ campo: "atendimentos", cor: cores.saiu, nome: "Atendimentos" }]}
                         formatar={numero} />
              )} />

            <h3 style={titulo}>Mensagens por período</h3>
            <Grafico C={C} cartao={cartao} nota={nota} th={th} thNum={thNum} td={td} num={num}
              legenda={[{ nome: "Recebidas", cor: cores.chegou }, { nome: "Enviadas", cor: cores.saiu }]}
              colunas={["Quando", "Recebidas", "Enviadas"]}
              linhas={serie.map((s) => [rotuloData(s.quando, passo), numero(s.recebidas), numero(s.enviadas)])}
              vazio={serie.every((s) => !s.recebidas && !s.enviadas)}
              desenho={() => (
                <Colunas C={C} dados={serie} passo={passo} formatar={numero}
                         series={[{ campo: "recebidas", cor: cores.chegou, nome: "Recebidas" },
                                  { campo: "enviadas",  cor: cores.saiu,   nome: "Enviadas" }]} />
              )} />

            <h3 style={titulo}>Tempo de resposta, dia a dia</h3>
            <Grafico C={C} cartao={cartao} nota={nota} th={th} thNum={thNum} td={td} num={num}
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

            <h3 style={titulo}>Atendimentos por horário</h3>
            <Mapa C={C} cartao={cartao} nota={nota} th={th} thNum={thNum} td={td} num={num}
                  dados={d.por_hora || []} rampa={rampa} />

            <h3 style={titulo}>Por telefone</h3>
            <Telefones C={C} cartao={cartao} nota={nota} th={th} thNum={thNum} td={td} num={num}
                       dados={d.por_telefone || []} advogados={advogados} departamentos={departamentos} cores={cores} />

            <h3 style={titulo}>Por atendente</h3>
            <div style={{ ...nota, marginBottom: 8 }}>
              Este bloco mostra <b style={{ color: C.textPrimary }}>todo mundo</b>, mesmo quando o
              resto da tela está recortado em você — é para comparar. Sua linha é a verde.
            </div>
            <Atendentes C={C} cartao={cartao} nota={nota} th={th} thNum={thNum} td={td} num={num}
                        dados={d.por_atendente || []} meuId={meuId} cores={cores} />

            {/* ---- as ressalvas: o que ficou de fora, e por quê ---- */}
            <Ressalvas d={d} t={t} C={C} cartao={cartao} nota={nota} />
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   A SITUAÇÃO DOS ATENDIMENTOS — uma barra de três pedaços
   ================================================================
   Parte-do-todo com três estados: barra empilhada, e não pizza. As cores
   aqui são de ESTADO (esperando / andando / acabou), e por isso vêm com
   nome e número escritos ao lado: cor sozinha nunca carrega o recado. */
function Situacao({ t, C, cores, cartao, rotulo, nota }) {
  const total = Number(t.atendimentos || 0);
  if (!total) return null;
  const partes = [
    { nome: "Aguardando resposta", v: Number(t.aguardando || 0), cor: "#e0a400" },
    { nome: "Em andamento", v: Number(t.em_andamento || 0), cor: cores.saiu },
    { nome: "Encerrados", v: Number(t.encerrados || 0), cor: cores.apagado },
  ];
  return (
    <div style={{ ...cartao, marginTop: 12 }}>
      <div style={rotulo}>Situação dos atendimentos</div>
      {/* O respiro de 2px entre os pedaços é o que separa um do outro. Uma
          borda desenhada em volta engorda a barra e some no tema escuro. */}
      <div style={{ display: "flex", gap: 2, height: 12, marginTop: 10, marginBottom: 12 }}>
        {partes.filter((p) => p.v > 0).map((p) => (
          <div key={p.nome} title={`${p.nome}: ${numero(p.v)}`}
               style={{ flex: p.v, background: p.cor, borderRadius: 3 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {partes.map((p) => (
          <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.cor, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{numero(p.v)}</span>
            <span style={{ ...nota, fontSize: 13 }}>{p.nome}</span>
          </div>
        ))}
      </div>
      <div style={{ ...nota, marginTop: 10 }}>
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
   O ENVELOPE DE UM GRÁFICO — título, legenda, botão de tabela
   ================================================================
   TODO gráfico tem sua tabela. Não é enfeite de acessibilidade: é o que
   permite conferir o desenho, copiar para uma planilha, e ler a tela sem
   depender de distinguir verde de azul. */
function Grafico({ C, cartao, nota, th, thNum, td, num, legenda, colunas, linhas, desenho, vazio, rodape }) {
  const [tabela, setTabela] = useState(false);
  const botao = {
    display: "flex", alignItems: "center", gap: 5, minHeight: 30, padding: "4px 10px",
    border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
  return (
    <div style={cartao}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: "1 1 auto" }}>
          {(legenda || []).map((l) => (
            <span key={l.nome} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.cor }} /> {l.nome}
            </span>
          ))}
        </div>
        <button onClick={() => setTabela((v) => !v)} style={botao}
                title={tabela ? "Ver o gráfico" : "Ver os números"}>
          {tabela ? <BarChart3 size={13} /> : <Table2 size={13} />} {tabela ? "Gráfico" : "Tabela"}
        </button>
      </div>

      {vazio && <div style={{ ...nota, padding: "18px 0" }}>Nada neste período.</div>}

      {!vazio && !tabela && desenho()}

      {!vazio && tabela && (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{colunas.map((c, i) => <th key={c} style={i ? thNum : th}>{c}</th>)}</tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>{l.map((v, j) => <td key={j} style={j ? num : td}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rodape && <div style={{ ...nota, marginTop: 10 }}>{rodape}</div>}
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
  const alt = 168;
  const max = Math.max(1, ...dados.flatMap((x) => series.map((s) => Number(x[s.campo] || 0))));

  // Quantos rótulos cabem embaixo sem um encostar no outro.
  const cada = Math.max(1, Math.ceil(dados.length / 10));
  const atual = sobre != null ? dados[sobre] : null;

  return (
    <div>
      <div style={{ height: 20, fontSize: 12.5, color: C.textSecondary, marginBottom: 4 }}>
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
                                // 2px de mínimo para o zero não sumir: a coluna
                                // rente ao chão diz "aqui houve um dia".
                                height: Math.max(v > 0 ? 3 : 0, Math.round((v / max) * (alt - 6))),
                                background: s.cor, borderRadius: "4px 4px 0 0" }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
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
   ================================================================
   Um tom só, do claro ao cheio. A escala aparece embaixo, porque um mapa de
   cores sem escala é um enigma. */
function Mapa({ C, cartao, nota, th, thNum, td, num, dados, rampa }) {
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

  const botao = {
    display: "flex", alignItems: "center", gap: 5, minHeight: 30, padding: "4px 10px",
    border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
  };

  // A tabela do mapa não repete 168 linhas: traz o resumo que alguém leria em
  // voz alta — quanto em cada dia, e quanto em cada faixa do dia.
  const faixas = [["Madrugada (0h–5h)", 0, 5], ["Manhã (6h–11h)", 6, 11],
                  ["Tarde (12h–17h)", 12, 17], ["Noite (18h–23h)", 18, 23]];

  return (
    <div style={cartao}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: "1 1 auto", height: 18, fontSize: 12.5, color: C.textSecondary }}>
          {sobre && (
            <span data-teste="leitura-mapa">
              <b style={{ color: C.textPrimary }}>{DIAS[sobre.d]}, {String(sobre.h).padStart(2, "0")}h</b>
              {" · "}{numero(grade[sobre.d][sobre.h])} {grade[sobre.d][sobre.h] === 1 ? "atendimento" : "atendimentos"}
            </span>
          )}
        </div>
        <button onClick={() => setTabela((v) => !v)} style={botao}>
          {tabela ? <BarChart3 size={13} /> : <Table2 size={13} />} {tabela ? "Mapa" : "Tabela"}
        </button>
      </div>

      {total === 0 && <div style={{ ...nota, padding: "12px 0" }}>Nenhum atendimento neste período.</div>}

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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, ...nota }}>
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
            <th style={th}>Dia</th>
            {faixas.map((f) => <th key={f[0]} style={thNum}>{f[0]}</th>)}
            <th style={thNum}>Total</th>
          </tr></thead>
          <tbody>
            {grade.map((linha, d2) => (
              <tr key={d2}>
                <td style={td}>{DIAS[d2]}</td>
                {faixas.map((f) => (
                  <td key={f[0]} style={num}>
                    {numero(linha.slice(f[1], f[2] + 1).reduce((s, v) => s + v, 0))}
                  </td>
                ))}
                <td style={{ ...num, fontWeight: 700 }}>{numero(linha.reduce((s, v) => s + v, 0))}</td>
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
function Telefones({ C, cartao, nota, th, thNum, td, num, dados, advogados, departamentos, cores }) {
  const linhas = useMemo(() => {
    const nomeDoDep = new Map(departamentos.map((x) => [String(x.id), x.nome]));
    const doBanco = new Map(dados.map((x) => [String(x.advogado_id), x]));
    const vistos = new Set();
    const saida = advogados.map((a) => {
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
  }, [dados, advogados, departamentos]);

  if (!linhas.length) return <div style={{ ...cartao, color: C.textSecondary }}>Nenhum telefone cadastrado.</div>;
  const maior = Math.max(1, ...linhas.map((l) => l.recebidas + l.enviadas));

  return (
    <div style={cartao}>
      <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: cores.chegou }} /> Recebidas
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: cores.saiu }} /> Enviadas
        </span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>Telefone</th>
          <th style={thNum}>Atendimentos</th>
          <th style={thNum}>Recebidas</th>
          <th style={thNum}>Enviadas</th>
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td style={{ ...td, width: "46%" }}>
                <div style={{ fontWeight: 600 }}>{l.nome}</div>
                {l.departamento && <div style={{ fontSize: 12, color: C.textSecondary }}>{l.departamento}</div>}
                {/* Uma barra, dois pedaços, 2px de respiro entre eles. */}
                <div style={{ display: "flex", gap: 2, height: 6, marginTop: 6,
                              width: `${Math.max(2, Math.round(((l.recebidas + l.enviadas) / maior) * 100))}%` }}>
                  {l.recebidas > 0 && <div style={{ flex: l.recebidas, background: cores.chegou, borderRadius: 3 }} />}
                  {l.enviadas > 0 && <div style={{ flex: l.enviadas, background: cores.saiu, borderRadius: 3 }} />}
                </div>
              </td>
              <td style={{ ...num, fontWeight: 700 }}>{numero(l.atendimentos)}</td>
              <td style={num}>{numero(l.recebidas)}</td>
              <td style={num}>{numero(l.enviadas)}</td>
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
   que o comprimento mostra. O verde marca UMA linha — a sua. É o que faz achar
   a própria posição de relance, sem procurar o nome. */
function Atendentes({ C, cartao, nota, th, thNum, td, num, dados, meuId, cores }) {
  const linhas = useMemo(() => (dados || [])
    .map((p) => ({
      chave: p.chave,
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

  if (!linhas.length) return <div style={{ ...cartao, color: C.textSecondary }}>Ninguém atendeu nada no período.</div>;
  const maior = Math.max(1, ...linhas.map((l) => l.atendimentos));

  return (
    <div style={cartao}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={th}>Atendente</th>
          <th style={thNum}>Atendimentos</th>
          <th style={thNum}>Enviadas</th>
          <th style={thNum} title="Mediana do tempo entre o cliente escrever e esta pessoa responder">Resposta</th>
          <th style={thNum} title="Mediana do tempo entre o atendimento começar e esta pessoa pegá-lo">Atender</th>
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} data-atendente={l.nome}>
              <td style={{ ...td, width: "40%" }}>
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
                <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
                  <div style={{ width: `${Math.round((l.atendimentos / maior) * 100)}%`, height: "100%",
                                background: l.sou ? cores.saiu : cores.apagado }} />
                </div>
              </td>
              <td style={{ ...num, fontWeight: 700 }}>{numero(l.atendimentos)}</td>
              <td style={num}>{numero(l.enviadas)}</td>
              <td style={num}>{tempo(l.resposta)}</td>
              <td style={num}>{tempo(l.espera)}</td>
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
function Ressalvas({ d, t, C, cartao, nota }) {
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
      <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: "24px 0 8px" }}>Como estes números são contados</h3>
      <div style={{ ...cartao, ...nota }}>
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
        {itens.map((x, i) => (
          <div key={i} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}` }}>{x}</div>
        ))}
      </div>
      <div style={{ height: 24 }} />
    </>
  );
}
