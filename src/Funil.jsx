import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Search, Download, X, MessageCircle } from "lucide-react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo } from "./gravar.js";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { diasDesde } from "./espera.js";

// ============================================================
//  O FUNIL DE ETAPAS (06/10)
//
//  Pedido do Rodrigo, como segundo passo do Zorvin para CRM: cada cliente
//  numa ETAPA, numa tela de colunas em que o cartão é arrastado de uma para a
//  outra. A conta toda está no script 017 da ponte; esta tela só lê e move.
//
//  DECIDIDO COM ELE:
//
//    - UM FUNIL POR DEPARTAMENTO — o SAC e o SDC têm caminhos diferentes, e a
//      tela abre no departamento que está aberto na barra;
//    - O CARTÃO É O CLIENTE, e não a conversa. Enquanto não há a ficha
//      própria do Zorvin, "cliente" é o CONTATO (um número de WhatsApp): a
//      mesma pessoa por dois números são dois cartões.
//
//  MOVER É ARRASTAR, E TAMBÉM ESCOLHER NUMA LISTA. Arrastar é o gesto que todo
//  CRM ensinou; a lista existe porque arrastar não funciona no celular nem
//  no teclado, e um cartão que só se move com o mouse é um cartão que metade
//  da equipe não consegue mover.
//
//  O ACERTO VISUAL VEM NA FRENTE, A FRASE ESPERA O BANCO — a régua das quatro
//  marcas da conversa. O cartão muda de coluna na hora; se o banco recusar,
//  ele VOLTA para onde estava e a faixa diz por quê, com o código. Um cartão
//  que fica na coluna nova sem ter sido gravado é a tela dizendo "salvei" sem
//  ter salvo (24/09).
//
//  NADA SOME CALADO:
//
//    - o cartão numa etapa DESATIVADA não desaparece: vai para a coluna "Em
//      etapas desativadas", no fim, até alguém movê-lo;
//    - a leitura que falha DIZ que falhou, com o código, e não vira "ninguém
//      neste funil" (armadilha nº 2);
//    - o funil cortado pelo teto da API diz que está cortado.
// ============================================================

const PAGINA = 1000;          // o teto de linhas por pedido do PostgREST
const PAGINAS_NO_MAXIMO = 5;  // 5.000 cartões por funil — e diz quando passa
const LOTE = 150;             // ids por pedido `in(...)`, para a URL não estourar
const RELER_A_CADA_MS = 30000;

function emLotes(lista, n = LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += n) lotes.push(lista.slice(i, i + n));
  return lotes;
}

function Inicial({ nome, cor }) {
  const letra = String(nome || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span aria-hidden="true"
          style={{ width: 30, height: 30, borderRadius: "50%", background: cor, color: "#fff",
                   display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {letra}
    </span>
  );
}

const CORES_DA_INICIAL = ["#00a884", "#53bdeb", "#a78bfa", "#ffb02e", "#e5573f", "#14b8a6", "#f472b6", "#3b82f6"];
function corDe(texto) {
  let h = 0;
  for (const ch of String(texto || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_DA_INICIAL[h % CORES_DA_INICIAL.length];
}

/** "hoje", "ontem", "há 5 dias" — há quanto tempo o cartão está nesta etapa. */
function haQuanto(iso) {
  if (!iso) return "";
  const d = diasDesde(iso);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export default function Funil({
  C, departamentos = [], advogados = [], souAdmin = false,
  departamentoInicial = null, aoAbrirConversa, aoFechar,
}) {
  const [depId, setDepId] = useState(() => {
    const ini = departamentos.find((d) => String(d.id) === String(departamentoInicial));
    return (ini || departamentos[0] || {}).id ?? null;
  });
  const [existe, setExiste] = useState(null);   // null = lendo; false = sem o script 017
  const [etapas, setEtapas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [contatos, setContatos] = useState({});  // id → contato
  const [conversas, setConversas] = useState({}); // contato_id → a conversa mais recente
  const [cortado, setCortado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [diasTrazer, setDiasTrazer] = useState(30);
  const [trazendo, setTrazendo] = useState(false);
  const movendo = useRef(0);
  const leitura = useRef(0);
  // O id arrastado também mora num espelho: há navegador que entrega o
  // `dataTransfer` vazio no `drop` (e o arraste feito por teclado ou por
  // ferramenta de acessibilidade nem passa por ele). O espelho é o mesmo dado,
  // lido de um lugar que não depende disso.
  const arrastandoRef = useRef(null);

  const telefonesDoDep = useMemo(
    () => advogados.filter((a) => String(a.departamento_id) === String(depId)).map((a) => a.id),
    [advogados, depId]);

  const avisar = useCallback((t) => {
    setAviso(t);
    if (t) setTimeout(() => setAviso((atual) => (atual === t ? null : atual)), 6000);
  }, []);

  // ------------------------------------------------------------
  //  A LEITURA — etapas, cartões, e o que o cartão mostra
  // ------------------------------------------------------------
  const ler = useCallback(async (mostrarCarregando = true) => {
    if (depId == null) return;
    const minha = ++leitura.current;
    if (mostrarCarregando) setCarregando(true);
    try {
      const re = await supabase.from("zorvin_etapas").select("*")
        .eq("departamento_id", depId).order("ordem");
      if (minha !== leitura.current) return;
      if (re.error) {
        if (re.error.code === "42P01") { setExiste(false); return; }
        setFalha(comOCodigo("Não consegui ler as etapas do funil.", re.error, "etapas do funil"));
        setExiste((v) => (v === null ? true : v));
        return;
      }
      setExiste(true);

      // Os cartões vêm em páginas: o PostgREST corta em 1000 sem avisar, e um
      // funil cortado calado se leria como completo (armadilha nº 2).
      const todos = [];
      let passou = false;
      for (let p = 0; p < PAGINAS_NO_MAXIMO; p++) {
        const rc = await supabase.from("zorvin_cartoes").select("*")
          .eq("departamento_id", depId).order("movido_em", { ascending: false })
          .range(p * PAGINA, (p + 1) * PAGINA - 1);
        if (minha !== leitura.current) return;
        if (rc.error) {
          setFalha(comOCodigo("Não consegui ler os cartões do funil.", rc.error, "cartões do funil"));
          return;
        }
        todos.push(...(rc.data || []));
        if ((rc.data || []).length < PAGINA) break;
        if (p === PAGINAS_NO_MAXIMO - 1) passou = true;
      }

      // O nome e o número de cada cliente, e a conversa mais recente dele
      // NESTE departamento — é ela que o clique no cartão abre, e é dela que
      // saem a espera e as não lidas.
      const ids = [...new Set(todos.map((c) => c.contato_id))];
      const porId = {};
      const conv = {};
      for (const lote of emLotes(ids)) {
        const [rct, rcv] = await Promise.all([
          supabase.from("contatos").select("*").in("id", lote),
          telefonesDoDep.length
            ? supabase.from("conversas").select("*").in("contato_id", lote).in("advogado_id", telefonesDoDep)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (minha !== leitura.current) return;
        if (rct.error || rcv.error) {
          setFalha(comOCodigo("Não consegui ler os nomes dos clientes do funil.",
                              rct.error || rcv.error, "clientes do funil"));
          return;
        }
        for (const c of rct.data || []) porId[c.id] = c;
        for (const c of rcv.data || []) {
          const atual = conv[c.contato_id];
          if (!atual || new Date(c.ultima_atividade || 0) > new Date(atual.ultima_atividade || 0)) {
            conv[c.contato_id] = c;
          }
        }
      }
      if (minha !== leitura.current) return;
      setEtapas(re.data || []);
      // UM MOVIMENTO EM VOO NÃO É DESFEITO PELA RELEITURA: a resposta do banco
      // pode ser de antes do clique, e o cartão voltaria para a coluna velha
      // por um instante, parecendo que não gravou.
      if (movendo.current === 0) setCartoes(todos);
      setContatos(porId);
      setConversas(conv);
      setCortado(passou);
      setFalha(null);
    } finally {
      if (minha === leitura.current) setCarregando(false);
    }
  }, [depId, telefonesDoDep]);

  useEffect(() => { setCartoes([]); setEtapas([]); ler(true); }, [ler]);

  // A RELEITURA SOZINHA, de 30 em 30 segundos enquanto a tela está aberta: é
  // como o colega que moveu um cartão aparece aqui sem ninguém clicar.
  useEffect(() => {
    const t = setInterval(() => { if (movendo.current === 0) ler(false); }, RELER_A_CADA_MS);
    return () => clearInterval(t);
  }, [ler]);

  const ativas = useMemo(() => etapas.filter((e) => e.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)), [etapas]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cartoes;
    const digitos = q.replace(/\D/g, "");
    return cartoes.filter((c) => {
      const ct = contatos[c.contato_id] || {};
      if (nomeDoContato(ct).toLowerCase().includes(q)) return true;
      return digitos.length >= 3 && String(ct.numero || "").includes(digitos);
    });
  }, [cartoes, contatos, busca]);

  const porEtapa = useMemo(() => {
    const m = new Map(ativas.map((e) => [String(e.id), []]));
    const orfaos = [];
    for (const c of filtrados) {
      const lista = m.get(String(c.etapa_id));
      if (lista) lista.push(c); else orfaos.push(c);
    }
    return { m, orfaos };
  }, [filtrados, ativas]);

  // ------------------------------------------------------------
  //  MOVER E TIRAR
  // ------------------------------------------------------------
  async function mover(cartao, etapaId) {
    if (!cartao || String(cartao.etapa_id) === String(etapaId)) return;
    const antes = cartao.etapa_id;
    const destino = ativas.find((e) => String(e.id) === String(etapaId));
    movendo.current++;
    setCartoes((l) => l.map((c) => (c.id === cartao.id
      ? { ...c, etapa_id: etapaId, movido_em: new Date().toISOString() } : c)));
    try {
      const r = await supabase.from("zorvin_cartoes").update({ etapa_id: etapaId })
        .eq("id", cartao.id).select("id");
      if (r.error || naoGravouNada(r)) {
        setCartoes((l) => l.map((c) => (c.id === cartao.id ? { ...c, etapa_id: antes } : c)));
        avisar(r.error
          ? comOCodigo("Não consegui mover o cartão — ele voltou para onde estava.", r.error, "mover cartão")
          : "Não consegui mover o cartão: o banco não deixou. Ele voltou para onde estava.");
        return;
      }
      avisar(`${nomeDoContato(contatos[cartao.contato_id])} foi para “${destino ? destino.nome : "outra etapa"}”.`);
    } finally {
      movendo.current--;
    }
  }

  async function tirar(cartao) {
    const nome = nomeDoContato(contatos[cartao.contato_id]);
    if (!window.confirm(`Tirar ${nome} do funil? A conversa continua; só o cartão sai.`)) return;
    movendo.current++;
    try {
      const r = await supabase.from("zorvin_cartoes").delete().eq("id", cartao.id).select("id");
      if (r.error || naoGravouNada(r)) {
        avisar(r.error
          ? comOCodigo("Não consegui tirar o cartão do funil.", r.error, "tirar cartão")
          : "Não consegui tirar o cartão: o banco não deixou.");
        return;
      }
      setCartoes((l) => l.filter((c) => c.id !== cartao.id));
      avisar(`${nome} saiu do funil.`);
    } finally {
      movendo.current--;
    }
  }

  async function trazer() {
    setTrazendo(true);
    try {
      const r = await supabase.rpc("zorvin_funil_trazer", { p_departamento: depId, p_dias: Number(diasTrazer) });
      if (r.error) {
        avisar(comOCodigo("Não consegui trazer as conversas para o funil.", r.error, "trazer para o funil"));
        return;
      }
      const n = Number(r.data) || 0;
      avisar(n === 0
        ? `Nenhum cliente novo: quem conversou nos últimos ${diasTrazer} dias já está no funil.`
        : `${n} ${n === 1 ? "cliente entrou" : "clientes entraram"} em “${ativas[0] ? ativas[0].nome : "a primeira etapa"}”.`);
      await ler(false);
    } finally {
      setTrazendo(false);
    }
  }

  // ------------------------------------------------------------
  //  O DESENHO
  // ------------------------------------------------------------
  const dep = departamentos.find((d) => String(d.id) === String(depId));
  const verde = C.green || "#00a884";
  const total = cartoes.length;

  const botaoFraco = {
    border: `1px solid ${C.divider}`, background: C.panel, color: C.textPrimary, borderRadius: 18,
    padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  };

  // FUNÇÕES QUE DESENHAM, e não componentes: um componente declarado aqui dentro
  // seria um TIPO novo a cada desenho, e o React trocaria o elemento inteiro —
  // no meio de um arraste, o que o navegador estava arrastando deixaria de
  // existir, e o arraste morreria sozinho.
  function cartao(c) {
    const ct = contatos[c.contato_id] || {};
    const nome = nomeDoContato(ct) || "Cliente";
    const cv = conversas[c.contato_id];
    const espera = cv && cv.esperando_desde ? diasDesde(cv.esperando_desde) : 0;
    const naoLidas = (cv && cv.nao_lidas) || 0;
    return (
      <div key={c.id} data-cartao-do-funil={c.contato_id} data-etapa={c.etapa_id}
           draggable onDragStart={(e) => {
             arrastandoRef.current = String(c.id); setArrastando(c.id);
             try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(c.id)); } catch (_) { /* o espelho basta */ }
           }}
           onDragEnd={() => { arrastandoRef.current = null; setArrastando(null); setSobre(null); }}
           style={{ background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, padding: 10,
                    boxShadow: "0 1px 2px rgba(0,0,0,.08)", cursor: "grab",
                    opacity: arrastando === c.id ? 0.5 : 1 }}>
        <button type="button" data-abrir-cartao onClick={() => cv && aoAbrirConversa && aoAbrirConversa(cv)}
                disabled={!cv} title={cv ? "Abrir a conversa" : "Nenhuma conversa deste cliente num telefone que você atende"}
                style={{ all: "unset", display: "flex", alignItems: "center", gap: 8, width: "100%",
                         cursor: cv ? "pointer" : "default", minWidth: 0 }}>
          <Inicial nome={nome} cor={corDe(nome)} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span data-nome-no-cartao style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.textPrimary,
                           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
            <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>
              {String(ct.numero || "").startsWith("grupo:") ? "Grupo" : telefoneLegivel(ct.numero)}
            </span>
          </span>
          {naoLidas > 0 && (
            <span title={`${naoLidas} não lida${naoLidas === 1 ? "" : "s"}`}
                  style={{ background: verde, color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700,
                           minWidth: 20, height: 20, display: "grid", placeItems: "center", padding: "0 5px" }}>
              {naoLidas}
            </span>
          )}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5,
                      color: C.textSecondary, flexWrap: "wrap" }}>
          <span title="Desde quando o cartão está nesta etapa">Nesta etapa {haQuanto(c.movido_em)}</span>
          {espera >= 1 && (
            <span data-espera-no-cartao style={{ color: espera >= 3 ? "#e53935" : "#d99a1e", fontWeight: 600 }}>
              · esperando há {espera} {espera === 1 ? "dia" : "dias"}
            </span>
          )}
          {!cv && <span>· <MessageCircle size={11} style={{ verticalAlign: -1 }} /> sem conversa à vista</span>}
        </div>
        <select data-mover-cartao value="" aria-label={`Mover ${nome} para outra etapa`}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__tirar") tirar(c); else if (v) mover(c, v);
                }}
                style={{ marginTop: 8, width: "100%", fontSize: 12.5, padding: "5px 6px", borderRadius: 6,
                         border: `1px solid ${C.divider}`, background: C.searchBg || C.panel, color: C.textPrimary }}>
          <option value="">Mover para…</option>
          {ativas.filter((e) => String(e.id) !== String(c.etapa_id)).map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
          <option value="__tirar">Tirar do funil…</option>
        </select>
      </div>
    );
  }

  function coluna(etapa, lista, desativadas = false) {
    const id = etapa ? String(etapa.id) : "__desativadas";
    const alvo = !desativadas && sobre === id;
    return (
      <section key={etapa ? etapa.id : "__desativadas"} data-coluna-do-funil={etapa ? etapa.nome : "Em etapas desativadas"}
               onDragOver={(e) => {
                 if (desativadas) return;
                 e.preventDefault();
                 try { e.dataTransfer.dropEffect = "move"; } catch (_) { /* sem efeito visual, e só */ }
                 setSobre(id);
               }}
               onDragLeave={() => setSobre((s) => (s === id ? null : s))}
               onDrop={(e) => {
                 e.preventDefault(); setSobre(null);
                 let cid = "";
                 try { cid = e.dataTransfer.getData("text/plain"); } catch (_) { /* cai no espelho */ }
                 cid = cid || arrastandoRef.current;
                 arrastandoRef.current = null;
                 const c = cartoes.find((x) => String(x.id) === String(cid));
                 if (c && etapa) mover(c, etapa.id);
               }}
               style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column",
                        background: alvo ? "rgba(0,168,132,.10)" : C.headerBar,
                        border: `1px ${alvo ? "dashed" : "solid"} ${alvo ? verde : C.divider}`,
                        borderRadius: 12, maxHeight: "100%", minHeight: 0 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                         background: etapa ? (etapa.cor || verde) : C.textSecondary }} />
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden",
                         textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {etapa ? etapa.nome : "Em etapas desativadas"}
          </span>
          <span data-contagem-da-coluna style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>{lista.length}</span>
        </header>
        {desativadas && (
          <div style={{ fontSize: 11.5, color: C.textSecondary, padding: "0 12px 8px", lineHeight: 1.4 }}>
            Estes clientes estão numa etapa que foi desativada. Mova cada um para uma etapa em uso.
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
          {lista.map((c) => cartao(c))}
          {lista.length === 0 && !desativadas && (
            <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", padding: "14px 6px" }}>
              Arraste um cartão para cá
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div data-tela="funil"
         style={{ position: "fixed", inset: 0, background: C.bg || C.headerBar, color: C.textPrimary,
                  zIndex: 200, display: "flex", flexDirection: "column" }}>
      {/* ================= A BARRA DO ALTO ================= */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={aoFechar} title="Voltar" aria-label="Voltar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex",
                         padding: 6, marginLeft: -6, borderRadius: 8, color: C.textSecondary }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, marginRight: 4 }}>Funil</div>
        {departamentos.length > 1 ? (
          <select data-funil-departamento value={depId ?? ""} onChange={(e) => setDepId(Number(e.target.value) || e.target.value)}
                  aria-label="Departamento"
                  style={{ ...botaoFraco, padding: "6px 10px", appearance: "auto" }}>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        ) : dep ? <span style={{ color: C.textSecondary, fontSize: 14 }}>{dep.nome}</span> : null}
        <span data-total-do-funil style={{ fontSize: 13, color: C.textSecondary }}>
          {existe ? `${total} ${total === 1 ? "cliente" : "clientes"}` : ""}
        </span>
        <div style={{ flex: "1 1 auto" }} />
        <label style={{ ...botaoFraco, cursor: "text", padding: "5px 10px" }}>
          <Search size={15} color={C.textSecondary} />
          <input data-busca-no-funil value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Buscar nome ou número"
                 style={{ border: "none", outline: "none", background: "transparent", color: C.textPrimary,
                          fontSize: 13, width: 170 }} />
          {busca && (
            <button onClick={() => setBusca("")} aria-label="Limpar a busca"
                    style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0 }}>
              <X size={14} color={C.textSecondary} />
            </button>
          )}
        </label>
        <button onClick={() => ler(true)} style={botaoFraco} title="Ler o funil de novo" data-atualizar-funil>
          <RefreshCw size={15} /> Atualizar
        </button>
        {souAdmin && existe && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <button data-trazer-para-o-funil onClick={trazer} disabled={trazendo || !ativas.length} style={botaoFraco}
                    title="Põe na primeira etapa quem conversou no período e ainda não está no funil">
              <Download size={15} /> {trazendo ? "Trazendo…" : "Trazer conversas"}
            </button>
            <select data-dias-para-trazer value={diasTrazer} onChange={(e) => setDiasTrazer(Number(e.target.value))}
                    aria-label="De quantos dias" style={{ ...botaoFraco, padding: "6px 8px", appearance: "auto" }}>
              {[7, 30, 90, 365].map((n) => <option key={n} value={n}>últimos {n} dias</option>)}
            </select>
          </span>
        )}
      </div>

      {(aviso || falha || cortado) && (
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {falha && (
            <div data-falha-do-funil style={{ background: "#fff4e5", color: "#7a4b00", border: "1px solid #ffd699",
                                              borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>{falha}</div>
          )}
          {cortado && (
            <div style={{ background: "#fff4e5", color: "#7a4b00", border: "1px solid #ffd699",
                          borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              Este funil tem mais de {PAGINA * PAGINAS_NO_MAXIMO} clientes, e só os {PAGINA * PAGINAS_NO_MAXIMO} movidos
              mais recentemente estão na tela.
            </div>
          )}
          {aviso && (
            <div data-aviso-do-funil role="status"
                 style={{ background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 8,
                          padding: "8px 12px", fontSize: 13 }}>{aviso}</div>
          )}
        </div>
      )}

      {/* ================= AS COLUNAS ================= */}
      {existe === false ? (
        <div data-funil-sem-script style={{ padding: 32, maxWidth: 560, color: C.textSecondary, lineHeight: 1.5 }}>
          {souAdmin
            ? "O funil ainda não foi instalado neste banco: falta rodar o script 017 (o funil de etapas) no Supabase."
            : "O funil ainda não está disponível. Avise quem administra o Zorvin."}
        </div>
      ) : depId == null ? (
        <div style={{ padding: 32, color: C.textSecondary }}>Nenhum departamento à vista para mostrar o funil.</div>
      ) : existe && !carregando && ativas.length === 0 ? (
        <div data-funil-sem-etapas style={{ padding: 32, maxWidth: 560, color: C.textSecondary, lineHeight: 1.5 }}>
          Este departamento ainda não tem etapas no funil.
          {souAdmin ? " Crie as etapas em Menu → Departamentos e acessos → Estrutura." : " Avise quem administra o Zorvin."}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", padding: "12px 16px 16px" }}>
          <div style={{ display: "flex", gap: 12, height: "100%", alignItems: "stretch" }}>
            {ativas.map((e) => coluna(e, porEtapa.m.get(String(e.id)) || []))}
            {porEtapa.orfaos.length > 0 && coluna(null, porEtapa.orfaos, true)}
          </div>
          {existe && !carregando && total === 0 && !falha && (
            <div data-funil-vazio style={{ position: "relative", marginTop: -40, fontSize: 13, color: C.textSecondary }}>
              Ninguém neste funil ainda. Os clientes novos entram sozinhos na primeira etapa
              {souAdmin ? "; os que já conversavam entram por “Trazer conversas”." : "."}
            </div>
          )}
        </div>
      )}
      {carregando && existe !== false && (
        <div style={{ position: "absolute", top: 70, right: 20, fontSize: 12, color: C.textSecondary }}>Lendo o funil…</div>
      )}
    </div>
  );
}
