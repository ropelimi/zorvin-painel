import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, CircleCheck, RotateCcw, MessageCircle, BellRing, AlertCircle } from "lucide-react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo } from "./gravar.js";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { situacao, ordenarAbertas, rotuloDaTarefa, semATabelaDeTarefas } from "./tarefas.js";
import { rotuloDaHora } from "./agenda.js";

// ============================================================
//  A TELA DE TAREFAS (06/10)
//
//  Pedido do Rodrigo, decidido com ele: uma tela própria, aberta pela barra
//  lateral (com o número do que está atrasado ou vence hoje), mais o filtro
//  "Com tarefa para hoje" na lista de conversas.
//
//  DUAS ABAS, e a diferença é de pergunta, não de permissão:
//
//    - "Minhas" — o que EU tenho de fazer: atrasadas, hoje, próximas, e as
//      que concluí nos últimos sete dias (para desfazer um clique errado);
//    - "Da equipe" — tudo o que está aberto nas conversas que eu vejo, com a
//      conta de cada pessoa no alto. É a mesma regra das conversas: quem vê a
//      conversa vê as tarefas dela, e a conta de cada um é para cobrar a fila.
//
//  A LEITURA QUE FALHA DIZ QUE FALHOU, com o código, e não vira "nenhuma
//  tarefa" (armadilha nº 2): "nenhuma tarefa" faria a pessoa ir embora
//  achando que está em dia.
//
//  AS ABERTAS VÊM EM PÁGINAS de mil, até cinco, e passando disso a tela DIZ
//  que cortou — o PostgREST corta calado, e uma lista cortada se leria como
//  completa.
// ============================================================

const PAGINA = 1000;
const PAGINAS_NO_MAXIMO = 5;
const LOTE = 150;
const RELER_A_CADA_MS = 60000;
const DIAS_DAS_FEITAS = 7;

function emLotes(lista, n = LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += n) lotes.push(lista.slice(i, i + n));
  return lotes;
}

const SECOES = [
  { id: "atrasada", titulo: "Atrasadas", cor: "#e53935" },
  { id: "hoje", titulo: "Hoje", cor: "#d99a1e" },
  { id: "proxima", titulo: "Próximas", cor: null },
];

export default function Tarefas({
  C, meuId, pessoas = {}, advogados = [], aoAbrirConversa, aoMudou, aoFechar,
}) {
  const [aba, setAba] = useState("minhas");
  const [existe, setExiste] = useState(null);
  const [abertas, setAbertas] = useState([]);
  const [feitas, setFeitas] = useState([]);
  const [conversas, setConversas] = useState({});   // id → conversa
  const [contatos, setContatos] = useState({});     // id → contato
  const [cortado, setCortado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [soDe, setSoDe] = useState(null);           // na aba da equipe: só as de uma pessoa
  const [verFeitas, setVerFeitas] = useState(false);
  const leitura = useRef(0);
  const gravando = useRef(0);

  const nomeDe = useCallback((id) => {
    if (!id) return "Sem pessoa";
    if (String(id) === String(meuId)) return "Você";
    const p = pessoas[String(id)];
    return (p && p.nome) || "Alguém que saiu da equipe";
  }, [pessoas, meuId]);

  const ler = useCallback(async (mostrar = true) => {
    const minha = ++leitura.current;
    if (mostrar) setCarregando(true);
    try {
      const todas = [];
      let passou = false;
      for (let p = 0; p < PAGINAS_NO_MAXIMO; p++) {
        const r = await supabase.from("zorvin_tarefas").select("*").is("feita_em", null)
          .order("vence_em", { ascending: true }).range(p * PAGINA, (p + 1) * PAGINA - 1);
        if (minha !== leitura.current) return;
        if (r.error) {
          if (semATabelaDeTarefas(r.error)) { setExiste(false); return; }
          setFalha(comOCodigo("Não consegui ler as tarefas.", r.error, "tarefas"));
          return;
        }
        todas.push(...(r.data || []));
        if ((r.data || []).length < PAGINA) break;
        if (p === PAGINAS_NO_MAXIMO - 1) passou = true;
      }
      const desde = new Date(Date.now() - DIAS_DAS_FEITAS * 86400e3).toISOString();
      const rf = meuId
        ? await supabase.from("zorvin_tarefas").select("*").eq("para_quem", meuId)
            .gte("feita_em", desde).order("feita_em", { ascending: false }).limit(200)
        : { data: [], error: null };
      if (minha !== leitura.current) return;
      if (rf.error) {
        setFalha(comOCodigo("Não consegui ler as tarefas concluídas.", rf.error, "tarefas feitas"));
        return;
      }
      // AS CONVERSAS E OS CLIENTES, em lotes: a tarefa guarda só a conversa,
      // e a linha precisa dizer DE QUEM é — "ligar para confirmar" sem o nome
      // do cliente é uma tarefa que não se sabe fazer.
      const idsConversa = [...new Set([...todas, ...(rf.data || [])].map((t) => String(t.conversa_id)))];
      const cvs = {};
      for (const lote of emLotes(idsConversa)) {
        const rc = await supabase.from("conversas").select("*").in("id", lote);
        if (minha !== leitura.current) return;
        if (rc.error) {
          setFalha(comOCodigo("Não consegui ler as conversas das tarefas.", rc.error, "conversas das tarefas"));
          return;
        }
        for (const c of rc.data || []) cvs[String(c.id)] = c;
      }
      const idsContato = [...new Set(Object.values(cvs).map((c) => String(c.contato_id)).filter(Boolean))];
      const cts = {};
      for (const lote of emLotes(idsContato)) {
        const rt = await supabase.from("contatos").select("*").in("id", lote);
        if (minha !== leitura.current) return;
        if (rt.error) {
          setFalha(comOCodigo("Não consegui ler os nomes dos clientes.", rt.error, "clientes das tarefas"));
          return;
        }
        for (const c of rt.data || []) cts[String(c.id)] = c;
      }
      setExiste(true);
      setAbertas(todas);
      setFeitas(rf.data || []);
      setConversas(cvs);
      setContatos(cts);
      setCortado(passou);
      setFalha(null);
    } catch (e) {
      console.error("Zorvin — tarefas:", e);
      if (minha === leitura.current) setFalha("Não consegui ler as tarefas. Confira a internet e tente de novo.");
    } finally {
      if (minha === leitura.current) setCarregando(false);
    }
  }, [meuId]);

  useEffect(() => { ler(true); }, [ler]);
  useEffect(() => {
    const t = setInterval(() => { if (!gravando.current) ler(false); }, RELER_A_CADA_MS);
    return () => clearInterval(t);
  }, [ler]);

  const avisar = (texto) => {
    setAviso(texto);
    setTimeout(() => setAviso((a) => (a === texto ? null : a)), 4000);
  };

  async function concluir(t, feita) {
    gravando.current++;
    try {
      const r = await supabase.from("zorvin_tarefas")
        .update(feita ? { feita_em: new Date().toISOString(), feita_por: meuId || null }
                      : { feita_em: null, feita_por: null })
        .eq("id", t.id).select("id");
      if (r.error || naoGravouNada(r)) {
        avisar(r.error
          ? comOCodigo(feita ? "Não consegui concluir a tarefa." : "Não consegui reabrir a tarefa.", r.error,
                       feita ? "concluir tarefa" : "reabrir tarefa")
          : `Não consegui ${feita ? "concluir" : "reabrir"} a tarefa: o banco não deixou.`);
        return;
      }
      avisar(feita ? "Tarefa concluída." : "Tarefa reaberta.");
      await ler(false);
      if (aoMudou) aoMudou();
    } finally {
      gravando.current--;
    }
  }

  const agora = new Date();
  const daAba = aba === "minhas"
    ? abertas.filter((t) => String(t.para_quem || "") === String(meuId))
    : abertas.filter((t) => !soDe || String(t.para_quem || "") === String(soDe));
  const porSecao = useMemo(() => {
    const m = { atrasada: [], hoje: [], proxima: [] };
    for (const t of ordenarAbertas(daAba)) m[situacao(t, agora)].push(t);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daAba]);

  // A CONTA DE CADA PESSOA, na aba da equipe: a ordem é de quem tem mais
  // atrasada, que é a pergunta de quem cobra.
  const porPessoa = useMemo(() => {
    const m = new Map();
    for (const t of abertas) {
      const k = String(t.para_quem || "");
      const g = m.get(k) || { id: k, atrasada: 0, hoje: 0, proxima: 0 };
      g[situacao(t, agora)]++;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.atrasada - a.atrasada || b.hoje - a.hoje
      || nomeDe(a.id).localeCompare(nomeDe(b.id), "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertas, nomeDe]);

  const advPorId = useMemo(() => Object.fromEntries(advogados.map((a) => [String(a.id), a])), [advogados]);

  function linha(t, feita = false) {
    const cv = conversas[String(t.conversa_id)];
    const ct = cv ? contatos[String(cv.contato_id)] || cv.contato : null;
    const cliente = ct ? nomeDoContato(ct) || telefoneLegivel(ct.numero) : "Conversa que você não alcança mais";
    const tel = cv ? advPorId[String(cv.advogado_id)] : null;
    const s = situacao(t, agora);
    const corQuando = feita ? C.textSecondary : s === "atrasada" ? "#e53935" : s === "hoje" ? "#d99a1e" : C.textSecondary;
    return (
      <div key={t.id} data-tarefa-da-tela={t.id} data-situacao={feita ? "feita" : s}
           style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                    borderTop: `1px solid ${C.divider}`, background: C.panel }}>
        <button data-concluir-tarefa={feita ? undefined : t.id} data-reabrir-tarefa={feita ? t.id : undefined}
                onClick={() => concluir(t, !feita)}
                title={feita ? "Reabrir esta tarefa" : "Marcar como feita"}
                aria-label={feita ? "Reabrir esta tarefa" : "Marcar como feita"}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, display: "flex",
                         flexShrink: 0, marginTop: 1 }}>
          {feita ? <RotateCcw size={20} color={C.textSecondary} /> : <CircleCheck size={22} color={C.green} />}
        </button>
        <button type="button" data-abrir-tarefa onClick={() => cv && aoAbrirConversa && aoAbrirConversa(cv)}
                disabled={!cv} title={cv ? "Abrir a conversa" : ""}
                style={{ all: "unset", flex: 1, minWidth: 0, cursor: cv ? "pointer" : "default" }}>
          <span data-texto-da-tarefa style={{ display: "block", fontSize: 14, color: C.textPrimary, lineHeight: 1.35,
                         textDecoration: feita ? "line-through" : "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {t.texto}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 3, fontSize: 12, color: C.textSecondary }}>
            <span data-cliente-da-tarefa style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
              <MessageCircle size={12} /> {cliente}
            </span>
            {tel && <span>· {tel.nome}</span>}
            {aba === "equipe" && !feita && <span data-pessoa-da-tarefa>· {nomeDe(t.para_quem)}</span>}
            <span data-quando-da-tarefa style={{ color: corQuando, fontWeight: s === "atrasada" && !feita ? 600 : 400 }}>
              · {feita ? `feita ${rotuloDaHora(t.feita_em, agora)}` : rotuloDaTarefa(t, agora)}
            </span>
          </span>
        </button>
      </div>
    );
  }

  const ABA = (ativa) => ({
    border: "none", borderBottom: `2px solid ${ativa ? C.green : "transparent"}`, background: "transparent",
    color: ativa ? C.textPrimary : C.textSecondary, fontWeight: ativa ? 700 : 500, fontSize: 14,
    padding: "10px 4px", cursor: "pointer", marginRight: 18,
  });
  const vazioDaAba = !SECOES.some((s) => porSecao[s.id].length);

  return (
    <div data-tela="tarefas" style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg || C.headerBar,
                                      display: "flex", flexDirection: "column", color: C.textPrimary }}>
      <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={aoFechar} title="Voltar às conversas" aria-label="Voltar às conversas"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <ArrowLeft size={20} color={C.textSecondary} />
        </button>
        <BellRing size={20} color={C.green} />
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Tarefas</span>
        <button data-atualizar-tarefas onClick={() => ler(true)} title="Atualizar" aria-label="Atualizar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <RefreshCw size={18} color={C.textSecondary} style={{ opacity: carregando ? 0.4 : 1 }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 16px 40px" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.divider}`, marginBottom: 12 }}>
            <button data-aba-tarefas="minhas" onClick={() => setAba("minhas")} style={ABA(aba === "minhas")}>Minhas</button>
            <button data-aba-tarefas="equipe" onClick={() => setAba("equipe")} style={ABA(aba === "equipe")}>Da equipe</button>
          </div>

          {falha && (
            <div data-falha-das-tarefas role="alert"
                 style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10,
                          background: "rgba(229,57,53,.10)", color: C.textPrimary, fontSize: 13.5, marginBottom: 12 }}>
              <AlertCircle size={17} color="#e53935" style={{ flexShrink: 0, marginTop: 1 }} /> {falha}
            </div>
          )}
          {existe === false && (
            <div data-tarefas-sem-script style={{ fontSize: 14, color: C.textSecondary, padding: 16 }}>
              As tarefas ainda não foram instaladas neste banco (script 018).
            </div>
          )}
          {cortado && (
            <div data-tarefas-cortadas style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 10 }}>
              Há mais de {PAGINA * PAGINAS_NO_MAXIMO} tarefas abertas; mostrando as {PAGINA * PAGINAS_NO_MAXIMO} que vencem primeiro.
            </div>
          )}

          {existe && !falha && aba === "equipe" && porPessoa.length > 0 && (
            <div data-contas-da-equipe style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {porPessoa.map((g) => {
                const ativa = String(soDe || "") === g.id;
                return (
                  <button key={g.id || "sem"} data-conta-da-pessoa={g.id} aria-pressed={ativa}
                          onClick={() => setSoDe(ativa ? null : g.id)}
                          style={{ border: `1.5px solid ${ativa ? C.green : C.divider}`, borderRadius: 10, padding: "7px 10px",
                                   background: ativa ? "rgba(0,168,132,.10)" : "transparent", cursor: "pointer",
                                   color: C.textPrimary, textAlign: "left", fontSize: 13 }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{g.id ? nomeDe(g.id) : "Sem pessoa"}</span>
                    <span style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                      <span data-atrasadas-da-pessoa={g.atrasada} style={{ color: g.atrasada ? "#e53935" : C.textSecondary, fontWeight: g.atrasada ? 700 : 400 }}>
                        {g.atrasada} atrasada{g.atrasada === 1 ? "" : "s"}
                      </span>
                      {" · "}{g.hoje} hoje · {g.proxima} depois
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {existe && !falha && SECOES.map((s) => porSecao[s.id].length > 0 && (
            <section key={s.id} data-secao-de-tarefas={s.id}
                     style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
              <header style={{ padding: "9px 12px", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3,
                               color: s.cor || C.textSecondary, background: C.headerBar }}>
                {s.titulo.toUpperCase()} <span data-contagem-da-secao style={{ fontWeight: 600 }}>({porSecao[s.id].length})</span>
              </header>
              {porSecao[s.id].map((t) => linha(t))}
            </section>
          ))}

          {existe && !falha && vazioDaAba && (
            <div data-sem-tarefas style={{ fontSize: 14, color: C.textSecondary, padding: "18px 4px", lineHeight: 1.5 }}>
              {aba === "minhas"
                ? "Nenhuma tarefa aberta para você. Para criar uma, abra a conversa do cliente e clique em “Lembrar”, na linha do número."
                : soDe ? "Nenhuma tarefa aberta desta pessoa." : "Nenhuma tarefa aberta nas conversas que você vê."}
            </div>
          )}

          {existe && !falha && aba === "minhas" && feitas.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <button data-ver-feitas onClick={() => setVerFeitas((v) => !v)}
                      style={{ border: "none", background: "transparent", color: C.verdeTexto || C.green, cursor: "pointer",
                               fontSize: 13, fontWeight: 600, padding: "6px 2px" }}>
                {verFeitas ? "Esconder" : "Ver"} as concluídas nos últimos {DIAS_DAS_FEITAS} dias ({feitas.length})
              </button>
              {verFeitas && (
                <section data-secao-de-tarefas="feita"
                         style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden", marginTop: 6 }}>
                  {feitas.map((t) => linha(t, true))}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {aviso && (
        <div data-aviso-das-tarefas role="status"
             style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 210,
                      background: "#111b21", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13.5,
                      boxShadow: "0 6px 20px rgba(0,0,0,.35)", maxWidth: "calc(100vw - 32px)" }}>
          {aviso}
        </div>
      )}
    </div>
  );
}
