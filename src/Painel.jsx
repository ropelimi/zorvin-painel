import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import {
  Search, Send, Paperclip, Smile, MoreVertical, ChevronDown,
  MessageSquare, Mic, Play, CheckCheck, Settings, LogOut, Phone, ArrowLeft, Sun, Moon,
  Clock, AlertCircle
} from "lucide-react";

// ============================================================
//  ZORVIN by Ropelimi — Painel real (conectado ao Supabase)
//  Lê advogados, conversas e mensagens reais; recebe novidades
//  em tempo real (Realtime); envia gravando na fila_envio.
// ============================================================

const TEMAS = {
  claro: {
    rail: "#202c33", headerBar: "#f0f2f5", panel: "#ffffff", listActive: "#f0f2f5",
    chatBg: "#efeae2", bubbleIn: "#ffffff", bubbleOut: "#d9fdd3", green: "#00a884",
    greenDark: "#008069", textPrimary: "#111b21", textSecondary: "#667781",
    divider: "#e9edef", unread: "#25d366", inputBg: "#ffffff", searchBg: "#f0f2f5",
    placeholderCircle: "#dfe5e7",
  },
  escuro: {
    rail: "#161717", headerBar: "#202c33", panel: "#111b21", listActive: "#2a3942",
    chatBg: "#0b141a", bubbleIn: "#202c33", bubbleOut: "#005c4b", green: "#00a884",
    greenDark: "#025144", textPrimary: "#e9edef", textSecondary: "#8696a0",
    divider: "#222d34", unread: "#00a884", inputBg: "#2a3942", searchBg: "#202c33",
    placeholderCircle: "#202c33",
  },
};

// Cor de avatar estável a partir do texto (mesmo nome = mesma cor).
const CORES = ["#0288d1", "#f57c00", "#7cb342", "#8e24aa", "#5e35b1", "#00acc1", "#d81b60", "#6a5acd", "#00897b", "#c2185b"];
function corDe(txt) {
  let h = 0;
  for (let i = 0; i < (txt || "").length; i++) h = (h * 31 + txt.charCodeAt(i)) % CORES.length;
  return CORES[h];
}

function horaDe(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Rótulo de dia para o separador de datas (HOJE / ONTEM / dd/mm/aaaa).
function rotuloData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mesmoDia(d, hoje)) return "HOJE";
  if (mesmoDia(d, ontem)) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Marca de status (tiquinhos) de uma mensagem que EU enviei, estilo WhatsApp.
function marcaLida(status) {
  return status === "lida" || status === "read" || status === "lido";
}

function Avatar({ nome, size = 40, foto }) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();
  const [erroFoto, setErroFoto] = useState(false);
  // Se a foto mudar, tenta de novo (limpa erro anterior).
  useEffect(() => { setErroFoto(false); }, [foto]);
  // Se houver foto cadastrada e ela carregar, mostra a foto;
  // senão (sem foto ou falha ao carregar), a inicial colorida.
  if (foto && !erroFoto) {
    return (
      <img
        src={foto}
        alt={nome || ""}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, background: corDe(nome) }}
        onError={() => setErroFoto(true)}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: corDe(nome), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: size * 0.42, flexShrink: 0 }}>
      {inicial}
    </div>
  );
}

function BolhaAudio({ C, saida, url }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 200 }}>
      {url ? (
        <audio controls src={url} style={{ height: 32, maxWidth: 220 }} />
      ) : (
        <>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: saida ? C.greenDark : C.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Play size={16} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Áudio</span>
        </>
      )}
    </div>
  );
}

export default function Painel({ sessao }) {
  const [modo, setModo] = useState("claro");
  const [advogados, setAdvogados] = useState([]);
  const [advogadoId, setAdvogadoId] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [conversaId, setConversaId] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [atendimentos, setAtendimentos] = useState({}); // { conversaId: { por, em } }
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const conversaIdRef = useRef(null);
  useEffect(() => { conversaIdRef.current = conversaId; }, [conversaId]);

  const C = TEMAS[modo];
  const advogado = advogados.find((a) => a.id === advogadoId) || null;
  const conversa = conversas.find((c) => c.id === conversaId) || null;
  // Nome que aparece para os outros atendentes quando eu abro uma conversa.
  const meuNome =
    sessao?.user?.user_metadata?.nome ||
    sessao?.user?.user_metadata?.name ||
    sessao?.user?.user_metadata?.full_name ||
    (sessao?.user?.email || "").split("@")[0] ||
    "atendente";

  // Quem (além de mim) está atendendo uma conversa agora. Considera "ativo"
  // apenas nos últimos 3 minutos, para não travar conversa que alguém abriu e saiu.
  function atendidoPorOutro(convId) {
    const a = atendimentos[convId];
    if (!a || !a.por || a.por === meuNome) return null;
    if (a.em && Date.now() - new Date(a.em).getTime() > 3 * 60 * 1000) return null;
    return a.por;
  }

  // ---- Carrega os advogados (uma vez) ----
  useEffect(() => {
    supabase.from("advogados").select("id, nome, numero, foto_url").eq("ativo", true).order("nome")
      .then(({ data }) => {
        setAdvogados(data || []);
        if (data && data.length) setAdvogadoId(data[0].id);
      });
  }, []);

  // ---- Carrega "quem está atendendo" cada conversa (recurso opcional) ----
  // Consulta separada e protegida: se as colunas atendendo_por/atendendo_em
  // ainda não existirem no banco, ignora sem erro e o painel segue normal.
  const carregarAtendimentos = useCallback(async (advId) => {
    if (!advId) return;
    const { data, error } = await supabase
      .from("conversas")
      .select("id, atendendo_por, atendendo_em")
      .eq("advogado_id", advId);
    if (error) return; // coluna ainda não criada: recurso fica dormente
    const mapa = {};
    (data || []).forEach((r) => {
      if (r.atendendo_por) mapa[r.id] = { por: r.atendendo_por, em: r.atendendo_em };
    });
    setAtendimentos(mapa);
  }, []);

  // ---- Carrega as conversas do advogado selecionado ----
  const carregarConversas = useCallback(async (advId) => {
    if (!advId) return;
    const { data } = await supabase
      .from("conversas")
      .select("id, ultima_mensagem, ultima_atividade, nao_lidas, contato:contato_id (nome, numero, foto_url)")
      .eq("advogado_id", advId)
      .order("ultima_atividade", { ascending: false });
    // A conversa que está aberta agora não deve mostrar contador de não lidas
    // (estou lendo em tempo real), igual ao WhatsApp Web.
    const lista = (data || []).map((c) =>
      c.id === conversaIdRef.current ? { ...c, nao_lidas: 0 } : c
    );
    setConversas(lista);
    carregarAtendimentos(advId);
  }, [carregarAtendimentos]);

  useEffect(() => { carregarConversas(advogadoId); }, [advogadoId, carregarConversas]);

  // ---- Carrega as mensagens da conversa aberta ----
  const carregarMensagens = useCallback(async (convId) => {
    if (!convId) { setMensagens([]); return; }
    const { data } = await supabase
      .from("mensagens")
      .select("id, origem, tipo, texto, midia_url, criado_em, status")
      .eq("conversa_id", convId)
      .order("criado_em", { ascending: true });
    setMensagens(data || []);
    // Zera o contador de não lidas desta conversa.
    await supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", convId);
    // Marca que EU estou atendendo (para os outros verem). Se a coluna ainda
    // não existir no banco, o erro é ignorado de propósito (recurso dormente).
    supabase.from("conversas")
      .update({ atendendo_por: meuNome, atendendo_em: new Date().toISOString() })
      .eq("id", convId)
      .then(() => {});
  }, [meuNome]);

  useEffect(() => { carregarMensagens(conversaId); }, [conversaId, carregarMensagens]);

  // ---- Mantém vivo o "estou atendendo" enquanto a conversa fica aberta ----
  useEffect(() => {
    if (!conversaId) return;
    const id = setInterval(() => {
      supabase.from("conversas")
        .update({ atendendo_em: new Date().toISOString() })
        .eq("id", conversaId)
        .then(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [conversaId]);

  // ---- Ajusta a altura da caixa de texto conforme escreve (várias linhas) ----
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [rascunho]);

  // ---- Realtime: novas mensagens e conversas atualizadas ----
  useEffect(() => {
    const canal = supabase
      .channel("zorvin-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const nova = payload.new;
        if (nova.conversa_id === conversaId) {
          setMensagens((prev) => {
            if (prev.some((m) => m.id === nova.id)) return prev;
            // Se esta é a versão "real" de uma mensagem que enviei (e mostrei
            // na hora, provisória), removo a provisória para não duplicar.
            let base = prev;
            if (nova.origem === "advogado") {
              base = prev.filter(
                (m) => !(String(m.id).startsWith("temp-") && m.texto === nova.texto)
              );
            }
            return [...base, nova];
          });
          // Cheguei uma mensagem do contato e a conversa está aberta: já conta
          // como lida (zera o contador no banco), igual ao WhatsApp Web.
          if (nova.origem === "contato") {
            supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", conversaId).then(() => {});
          }
        }
        // Atualiza a lista de conversas (prévia / ordem / não lidas).
        carregarConversas(advogadoId);
      })
      // Status de uma mensagem mudou (ex.: foi lida) — atualiza o "tiquinho".
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensagens" }, (payload) => {
        const atual = payload.new;
        if (atual.conversa_id !== conversaId) return;
        setMensagens((prev) => prev.map((m) => (m.id === atual.id ? { ...m, status: atual.status } : m)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversas" }, () => {
        carregarConversas(advogadoId);
      })
      // Se a ponte não conseguir enviar, a fila vira "erro" — aviso na tela.
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_envio" }, (payload) => {
        const row = payload.new;
        if (!row || row.conversa_id !== conversaId || row.status !== "erro") return;
        setMensagens((prev) => prev.map((m) =>
          String(m.id).startsWith("temp-") && m.texto === row.texto && m._status === "enviando"
            ? { ...m, _status: "erro" }
            : m
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [conversaId, advogadoId, carregarConversas]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens.length, conversaId]);

  function trocarAdvogado(id) { setAdvogadoId(id); setConversaId(null); setSeletorAberto(false); setBusca(""); }

  async function enviar() {
    const t = rascunho.trim();
    if (!t || !conversaId) return;
    setRascunho("");
    // Mostra a mensagem NA HORA (provisória, com relóginho), como o WhatsApp Web.
    const tempId = "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6);
    const provisoria = {
      id: tempId, conversa_id: conversaId, origem: "advogado",
      tipo: "texto", texto: t, criado_em: new Date().toISOString(), _status: "enviando",
    };
    setMensagens((prev) => [...prev, provisoria]);
    // Coloca na fila de envio; a ponte processa e manda pela Uazapi.
    const { error } = await supabase.from("fila_envio").insert({ conversa_id: conversaId, texto: t });
    if (error) {
      // Nem entrou na fila: marca como erro para o atendente reenviar.
      setMensagens((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "erro" } : m)));
    }
  }

  // Reenvia uma mensagem que falhou (recoloca na fila).
  async function reenviar(msg) {
    setMensagens((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _status: "enviando" } : m)));
    const { error } = await supabase.from("fila_envio").insert({ conversa_id: msg.conversa_id, texto: msg.texto });
    if (error) {
      setMensagens((prev) => prev.map((m) => (m.id === msg.id ? { ...m, _status: "erro" } : m)));
    }
  }

  async function sair() { await supabase.auth.signOut(); }

  const conversasFiltradas = conversas.filter((c) =>
    (c.contato?.nome || c.contato?.numero || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif", background: C.headerBar, color: C.textPrimary }}>
      {/* Barra lateral */}
      <div style={{ width: 60, background: C.rail, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", marginBottom: 12 }}>Z</div>
        <RailIcon ativo><MessageSquare size={20} /></RailIcon>
        <RailIcon><Phone size={20} /></RailIcon>
        <div style={{ flex: 1 }} />
        <div onClick={() => setModo((m) => (m === "claro" ? "escuro" : "claro"))} title="Alternar tema"
          style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#aebac1", cursor: "pointer" }}>
          {modo === "claro" ? <Moon size={20} /> : <Sun size={20} />}
        </div>
        <RailIcon><Settings size={20} /></RailIcon>
        <div onClick={sair} title="Sair" style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#aebac1", cursor: "pointer" }}>
          <LogOut size={20} />
        </div>
        <div style={{ height: 16 }} />
      </div>

      {/* Lista de conversas */}
      <div style={{ width: 380, borderRight: `1px solid ${C.divider}`, display: "flex", flexDirection: "column", background: C.panel }}>
        <div style={{ background: C.headerBar, padding: "10px 16px", position: "relative" }}>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6, fontWeight: 600, letterSpacing: 0.3 }}>ATENDENDO COMO</div>
          <button onClick={() => setSeletorAberto((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: C.textPrimary }}>
            {advogado ? <Avatar nome={advogado.nome} foto={advogado.foto_url} size={34} /> : <div style={{ width: 34 }} />}
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{advogado ? advogado.nome : "—"}</div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>{advogado ? "+" + advogado.numero : "Nenhum advogado"}</div>
            </div>
            <ChevronDown size={18} color={C.textSecondary} style={{ transform: seletorAberto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {seletorAberto && (
            <div style={{ position: "absolute", top: "100%", left: 16, right: 16, background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,.25)", zIndex: 20, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
              {advogados.map((a) => (
                <button key={a.id} onClick={() => trocarAdvogado(a.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: a.id === advogadoId ? C.listActive : C.panel, border: "none", cursor: "pointer", textAlign: "left", color: C.textPrimary }}>
                  <Avatar nome={a.nome} foto={a.foto_url} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                    <div style={{ fontSize: 11, color: C.textSecondary }}>+{a.numero}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "8px 12px", background: C.panel }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg, borderRadius: 8, padding: "6px 12px" }}>
            <Search size={16} color={C.textSecondary} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa" style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, color: C.textPrimary }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversasFiltradas.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: C.textSecondary, fontSize: 13 }}>Nenhuma conversa ainda.</div>
          )}
          {conversasFiltradas.map((c) => {
            const nome = c.contato?.nome || ("+" + (c.contato?.numero || ""));
            return (
              <button key={c.id} onClick={() => setConversaId(c.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: c.id === conversaId ? C.listActive : C.panel, border: "none", borderBottom: `1px solid ${C.divider}`, cursor: "pointer", textAlign: "left", color: C.textPrimary }}>
                <Avatar nome={nome} foto={c.contato?.foto_url} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                    <span style={{ fontSize: 11, color: c.nao_lidas ? C.green : C.textSecondary }}>{horaDe(c.ultima_atividade)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250 }}>{c.ultima_mensagem || ""}</span>
                    {c.nao_lidas > 0 && <span style={{ background: C.unread, color: "#fff", borderRadius: 12, fontSize: 11, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.nao_lidas}</span>}
                  </div>
                  {atendidoPorOutro(c.id) && (
                    <div style={{ fontSize: 11, color: "#e0a400", marginTop: 3, display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e0a400", display: "inline-block", flexShrink: 0 }} />
                      {atendidoPorOutro(c.id)} está atendendo
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversa */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.chatBg }}>
        {!conversa ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.textSecondary, gap: 16 }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", background: C.placeholderCircle, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={44} color={C.textSecondary} />
            </div>
            <div style={{ fontSize: 22, color: C.textPrimary, fontWeight: 300 }}>Zorvin</div>
            <div style={{ fontSize: 14, maxWidth: 380, textAlign: "center", lineHeight: 1.5 }}>
              Selecione uma conversa à esquerda para começar a atender{advogado ? <> as conversas de <b>{advogado.nome}</b></> : ""}.
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: C.headerBar, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.divider}` }}>
              <button onClick={() => setConversaId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
                <ArrowLeft size={20} color={C.textSecondary} />
              </button>
              <Avatar nome={conversa.contato?.nome || conversa.contato?.numero} foto={conversa.contato?.foto_url} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{conversa.contato?.nome || ("+" + conversa.contato?.numero)}</div>
                {atendidoPorOutro(conversa.id) ? (
                  <div style={{ fontSize: 12, color: "#d98a00", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertCircle size={13} /> {atendidoPorOutro(conversa.id)} também está nesta conversa
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.textSecondary }}>via {advogado?.nome}</div>
                )}
              </div>
              <MoreVertical size={20} color={C.textSecondary} />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 8%", display: "flex", flexDirection: "column", gap: 6 }}>
              {mensagens.map((m, i) => {
                const saida = m.origem === "advogado";
                const anterior = mensagens[i - 1];
                const novoDia =
                  !anterior || new Date(anterior.criado_em).toDateString() !== new Date(m.criado_em).toDateString();
                return (
                  <React.Fragment key={m.id}>
                    {novoDia && (
                      <div style={{ alignSelf: "center", background: C.bubbleIn, color: C.textSecondary, fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, boxShadow: "0 1px 0.5px rgba(0,0,0,.15)", margin: "10px 0 6px" }}>
                        {rotuloData(m.criado_em)}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: saida ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "65%", background: saida ? C.bubbleOut : C.bubbleIn, color: C.textPrimary, borderRadius: 8, padding: m.tipo === "imagem" ? 4 : "6px 9px 8px", boxShadow: "0 1px 0.5px rgba(0,0,0,.15)" }}>
                        {m.tipo === "imagem" && m.midia_url && (
                          <img src={m.midia_url} alt="imagem" style={{ maxWidth: 240, borderRadius: 6, display: "block" }} />
                        )}
                        {m.tipo === "audio" && <BolhaAudio C={C} saida={saida} url={m.midia_url} />}
                        {m.texto && <div style={{ fontSize: 14.2, lineHeight: 1.35, paddingRight: 42, marginTop: m.tipo !== "texto" ? 4 : 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.texto}</div>}
                        <div style={{ fontSize: 11, color: m._status === "erro" ? "#e53935" : C.textSecondary, textAlign: "right", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                          {horaDe(m.criado_em)}
                          {saida && (
                            m._status === "enviando" ? (
                              <Clock size={13} color={C.textSecondary} />
                            ) : m._status === "erro" ? (
                              <span onClick={() => reenviar(m)} title="Toque para reenviar" style={{ color: "#e53935", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                                <AlertCircle size={13} /> não enviado · reenviar
                              </span>
                            ) : (
                              // Cinza = enviada; azul = lida (igual ao WhatsApp).
                              <CheckCheck size={15} color={marcaLida(m.status) ? "#53bdeb" : "#8696a0"} />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={fimRef} />
            </div>

            <div style={{ background: C.headerBar, padding: "10px 16px", display: "flex", alignItems: "flex-end", gap: 10 }}>
              <Smile size={24} color={C.textSecondary} style={{ marginBottom: 8 }} />
              <Paperclip size={22} color={C.textSecondary} style={{ marginBottom: 9 }} />
              <textarea
                ref={inputRef}
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  // Enter envia; Shift+Enter pula linha (como no WhatsApp Web).
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                }}
                rows={1}
                placeholder="Digite uma mensagem"
                style={{ flex: 1, border: "none", outline: "none", background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "10px 14px", fontSize: 14.5, resize: "none", lineHeight: 1.35, maxHeight: 120, overflowY: "auto", fontFamily: "inherit" }}
              />
              {rascunho.trim() ? (
                <button onClick={enviar} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}><Send size={24} color={C.green} /></button>
              ) : (
                <Mic size={24} color={C.textSecondary} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RailIcon({ children, ativo }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: ativo ? "#fff" : "#aebac1", background: ativo ? "rgba(255,255,255,.12)" : "transparent", cursor: "pointer" }}>
      {children}
    </div>
  );
}
