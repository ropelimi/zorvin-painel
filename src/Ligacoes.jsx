import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Grid3x3, Copy, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { WSS_PADRAO, STUN, dominioDoEndereco, conferirConta, numeroParaDiscar, quemLiga, fraseDoFim,
         fraseDaFalhaDoRegistro, fraseDoMicrofone, duracaoDaLigacao, TECLAS, carregarSip } from "./ligacoes.js";
import { useMotivoParaEsperar, recargaPedida } from "./atualizacao.js";

// ============================================================
//  A TELA DE TESTE DAS LIGAÇÕES (11/11) — ver `ligacoes.js`.
//
//  Só para quem administra, numa guia própria (`?tela=ligacoes`): a ligação
//  continua enquanto a pessoa trabalha nas conversas na outra guia, e fechar
//  as conversas não derruba a ligação.
//
//  O QUE ELA NÃO FAZ, e é decisão: não guarda nada (a senha SIP some com a
//  guia), não grava a ligação, não liga a conversa de cliente nenhum, e não
//  tem o aviso de "linha em uso por fulano" — isso é da versão da equipe.
// ============================================================

const ROTULO_DA_CONTA = {
  desligada: "Desconectada",
  carregando: "Preparando…",
  conectando: "Conectando…",
  registrada: "Conectada: pronta para ligar e receber",
  falhou: "Não conectou",
};

const ROTULO_DA_LIGACAO = {
  chamando: "Chamando…",
  tocando: "Tocando no outro lado…",
  chegando: "Ligação chegando",
  atendendo: "Atendendo…",
  em_ligacao: "Em ligação",
  encerrada: "Ligação encerrada",
};

const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// O TOQUE DA LIGAÇÃO QUE CHEGA, sintetizado como os avisos (nenhum arquivo):
// duas notas juntas, um segundo e meio de toque e três de pausa.
function useToque(tocando) {
  useEffect(() => {
    if (!tocando || typeof window === "undefined") return undefined;
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return undefined;
    let ctx;
    try { ctx = new Contexto(); } catch (_) { return undefined; }
    const tocar = () => {
      try {
        const g = ctx.createGain();
        g.gain.value = 0.06;
        g.connect(ctx.destination);
        for (const f of [440, 480]) {
          const o = ctx.createOscillator();
          o.frequency.value = f;
          o.connect(g);
          o.start();
          o.stop(ctx.currentTime + 1.5);
        }
      } catch (_) { /* sem som, a tela continua dizendo */ }
    };
    tocar();
    const relogio = setInterval(tocar, 4500);
    return () => { clearInterval(relogio); try { ctx.close(); } catch (_) { /* já fechado */ } };
  }, [tocando]);
}

export default function Ligacoes({ C, aoFechar }) {
  const [wss, setWss] = useState(WSS_PADRAO);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [dominio, setDominio] = useState("");
  const [conta, setConta] = useState({ estado: "desligada", frase: "" });
  const [numero, setNumero] = useState("");
  const [ligacao, setLigacao] = useState(null);
  const [erro, setErro] = useState("");
  const [teclado, setTeclado] = useState(false);
  const [digitadas, setDigitadas] = useState("");
  const [registro, setRegistro] = useState([]);
  const [agora, setAgora] = useState(Date.now());
  const uaRef = useRef(null);
  const sessaoRef = useRef(null);
  const audioRef = useRef(null);
  const vivaRef = useRef(true);

  const anotar = useCallback((texto) => {
    if (!vivaRef.current) return;
    setRegistro((r) => [...r.slice(-199), { quando: hora(), texto }]);
  }, []);

  // A LIGAÇÃO E A CONTA CONECTADA SEGURAM A ATUALIZAÇÃO SOZINHA DO ZORVIN:
  // recarregar a guia derrubaria a ligação e apagaria a senha digitada.
  useMotivoParaEsperar(() => {
    if (ligacao && ligacao.estado !== "encerrada") return "uma ligação em andamento";
    if (conta.estado === "registrada" || conta.estado === "conectando") return "a conta da Nvoip conectada nesta guia";
    return null;
  });

  // E fechar ou recarregar a guia no meio de uma ligação pergunta antes.
  useEffect(() => {
    const emLigacao = ligacao && ligacao.estado !== "encerrada";
    if (!emLigacao) return undefined;
    const antes = (e) => {
      if (recargaPedida()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [ligacao]);

  // O relógio da ligação.
  useEffect(() => {
    if (!ligacao || ligacao.estado !== "em_ligacao") return undefined;
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(r);
  }, [ligacao]);

  useToque(Boolean(ligacao && ligacao.estado === "chegando"));

  // Ao sair da guia (ou desmontar), tudo é desligado: nada fica conectado à
  // Nvoip sem uma tela que diga isso.
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
      try { if (sessaoRef.current) sessaoRef.current.terminate(); } catch (_) { /* já acabou */ }
      try { if (uaRef.current) uaRef.current.stop(); } catch (_) { /* já parou */ }
      sessaoRef.current = null;
      uaRef.current = null;
    };
  }, []);

  const ligarOAudio = useCallback((pc) => {
    if (!pc) return;
    const poe = (stream) => {
      if (audioRef.current && stream) {
        audioRef.current.srcObject = stream;
        const p = audioRef.current.play && audioRef.current.play();
        if (p && p.catch) p.catch(() => { /* o navegador pede um clique; o Atender/Ligar já foi um */ });
      }
    };
    try {
      pc.addEventListener("track", (ev) => {
        poe(ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]));
      });
      const recebidas = (pc.getReceivers ? pc.getReceivers() : []).map((r) => r.track).filter(Boolean);
      if (recebidas.length) poe(new MediaStream(recebidas));
    } catch (_) { /* sem áudio do outro lado: a tela diz a ligação, e o registro também */ }
  }, []);

  const acompanhar = useCallback((sessao, direcao, quem) => {
    sessaoRef.current = sessao;
    const mudar = (m) => { if (vivaRef.current && sessaoRef.current === sessao) setLigacao((l) => (l ? { ...l, ...m } : l)); };
    sessao.on("peerconnection", (e) => ligarOAudio(e.peerconnection));
    sessao.on("progress", (e) => {
      const cod = e && e.response && e.response.status_code;
      anotar(`A Nvoip respondeu ${cod || "progresso"}${cod === 180 ? " (tocando)" : cod === 183 ? " (sessão em andamento)" : ""}`);
      if (direcao === "saindo") mudar({ estado: "tocando" });
    });
    sessao.on("accepted", () => {
      anotar(direcao === "saindo" ? "A ligação foi atendida" : "Ligação atendida aqui");
      mudar({ estado: "em_ligacao", inicio: Date.now() });
      ligarOAudio(sessao.connection);
    });
    sessao.on("confirmed", () => ligarOAudio(sessao.connection));
    const fim = (tipo) => (e) => {
      const cod = e && e.message && e.message.status_code;
      const frase = fraseDoFim(e && e.cause, cod);
      anotar(`${tipo === "failed" ? "A ligação não completou" : "A ligação terminou"}: ${frase}`);
      if (sessaoRef.current === sessao) sessaoRef.current = null;
      if (vivaRef.current) {
        setLigacao((l) => (l ? { ...l, estado: "encerrada", fim: Date.now(), frase, quemEncerrou: e && e.originator } : l));
        setTeclado(false);
      }
    };
    sessao.on("ended", fim("ended"));
    sessao.on("failed", fim("failed"));
    setDigitadas("");
    setLigacao({ direcao, numero: quem, estado: direcao === "saindo" ? "chamando" : "chegando", mudo: false });
  }, [anotar, ligarOAudio]);

  const conectar = async () => {
    setErro("");
    const c = conferirConta({ wss, usuario, senha, dominio });
    if (c.erro) { setErro(c.erro); return; }
    setConta({ estado: "carregando", frase: "" });
    let JsSIP;
    try {
      JsSIP = await carregarSip();
    } catch (e) {
      setConta({ estado: "falhou", frase: "Não consegui carregar a parte do Zorvin que faz as ligações. Recarregue a guia e tente de novo." });
      anotar(`A biblioteca de ligações não carregou (${(e && e.message) || "sem detalhe"})`);
      return;
    }
    if (!vivaRef.current) return;
    try { if (JsSIP.debug && JsSIP.debug.disable) JsSIP.debug.disable("JsSIP:*"); } catch (_) { /* sem depuração */ }
    let ua;
    try {
      const socket = new JsSIP.WebSocketInterface(c.wss);
      ua = new JsSIP.UA({
        sockets: [socket],
        uri: c.uri,
        password: senha,
        register: true,
        session_timers: false,
        user_agent: "Zorvin (teste de ligações)",
      });
    } catch (e) {
      setConta({ estado: "falhou", frase: `A conta não se lê: ${(e && e.message) || "confira o usuário e o domínio"}.` });
      anotar(`A conta não se lê (${(e && e.message) || "sem detalhe"})`);
      return;
    }
    uaRef.current = ua;
    const doUa = (fn) => (...a) => { if (vivaRef.current && uaRef.current === ua) fn(...a); };
    ua.on("connecting", doUa(() => { setConta({ estado: "conectando", frase: "" }); anotar(`Conectando a ${c.wss}`); }));
    ua.on("connected", doUa(() => anotar("Conectado ao servidor da Nvoip")));
    // A CONEXÃO QUE NÃO ABRE NUNCA não fica em "Conectando…" para sempre: a
    // biblioteca tentaria de novo sozinha, sem fim, e um endereço errado se
    // leria como "a Nvoip está demorando". Antes do primeiro registro, a
    // queda é a resposta; depois dele, é um soluço, e ela tenta de novo.
    let jaRegistrou = false;
    ua.on("disconnected", doUa((e) => {
      anotar(`A conexão com o servidor ${jaRegistrou ? "caiu" : "não abriu"}${e && e.code ? ` (código ${e.code})` : ""}`);
      if (!jaRegistrou) {
        setConta({ estado: "falhou", frase: fraseDaFalhaDoRegistro("Connection Error") });
        try { ua.stop(); } catch (_) { /* já parou */ }
        if (uaRef.current === ua) uaRef.current = null;
        return;
      }
      setConta((ct) => (ct.estado === "registrada" || ct.estado === "conectando"
        ? { estado: "conectando", frase: "A conexão caiu. Tentando de novo sozinho…" } : ct));
    }));
    ua.on("registered", doUa(() => {
      jaRegistrou = true;
      setConta({ estado: "registrada", frase: "" });
      anotar(`Registrado como ${c.usuario}@${c.dominio}`);
    }));
    ua.on("unregistered", doUa(() => anotar("Registro desfeito")));
    ua.on("registrationFailed", doUa((e) => {
      const cod = e && e.response && e.response.status_code;
      const frase = fraseDaFalhaDoRegistro(e && e.cause, cod);
      anotar(`O registro falhou: ${e && e.cause ? e.cause : "sem motivo"}${cod ? ` (código ${cod})` : ""}`);
      setConta({ estado: "falhou", frase });
      // Senha recusada não se insiste: a Nvoip pode bloquear quem erra muitas
      // vezes seguidas (a régua da ponte com a senha do banco).
      try { ua.stop(); } catch (_) { /* já parou */ }
      if (uaRef.current === ua) uaRef.current = null;
    }));
    ua.on("newRTCSession", doUa((e) => {
      const sessao = e.session;
      if (e.originator !== "remote") return;
      const de = quemLiga(sessao.remote_identity && sessao.remote_identity.uri && String(sessao.remote_identity.uri),
                          sessao.remote_identity && sessao.remote_identity.display_name);
      if (sessaoRef.current) {
        // Uma ligação por vez: a segunda ouve "ocupado".
        anotar(`Ligação de ${de} recusada: já há uma ligação aqui`);
        try { sessao.terminate({ status_code: 486, reason_phrase: "Busy Here" }); } catch (_) { /* já acabou */ }
        return;
      }
      anotar(`Ligação chegando de ${de}`);
      acompanhar(sessao, "chegando", de);
    }));
    try {
      ua.start();
    } catch (e) {
      setConta({ estado: "falhou", frase: `Não consegui conectar: ${(e && e.message) || "sem detalhe"}.` });
      uaRef.current = null;
    }
  };

  const desconectar = () => {
    try { if (sessaoRef.current) sessaoRef.current.terminate(); } catch (_) { /* já acabou */ }
    try { if (uaRef.current) uaRef.current.stop(); } catch (_) { /* já parou */ }
    sessaoRef.current = null;
    uaRef.current = null;
    setConta({ estado: "desligada", frase: "" });
    anotar("Desconectado");
  };

  const ligar = () => {
    setErro("");
    const n = numeroParaDiscar(numero);
    if (n.erro) { setErro(n.erro); return; }
    const ua = uaRef.current;
    if (!ua || conta.estado !== "registrada") { setErro("Conecte a conta da Nvoip antes de ligar."); return; }
    anotar(`Ligando para ${n.numero}`);
    try {
      const sessao = ua.call(n.numero, {
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: STUN },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      });
      acompanhar(sessao, "saindo", n.numero);
    } catch (e) {
      const frase = /getUserMedia|NotAllowed|Permission/i.test((e && (e.name || e.message)) || "")
        ? fraseDoMicrofone(e) : `A ligação não saiu: ${(e && e.message) || "sem detalhe"}.`;
      setErro(frase);
      anotar(`A ligação não saiu (${(e && e.message) || "sem detalhe"})`);
    }
  };

  const atender = () => {
    const s = sessaoRef.current;
    if (!s) return;
    setLigacao((l) => (l ? { ...l, estado: "atendendo" } : l));
    try {
      s.answer({ mediaConstraints: { audio: true, video: false }, pcConfig: { iceServers: STUN } });
    } catch (e) {
      setErro(fraseDoMicrofone(e));
      anotar(`Não consegui atender (${(e && e.message) || "sem detalhe"})`);
    }
  };

  const desligar = () => {
    const s = sessaoRef.current;
    if (!s) return;
    try {
      if (ligacao && ligacao.estado === "chegando") s.terminate({ status_code: 486, reason_phrase: "Busy Here" });
      else s.terminate();
    } catch (_) { /* já acabou */ }
  };

  const alternarMudo = () => {
    const s = sessaoRef.current;
    if (!s || !ligacao) return;
    try {
      if (ligacao.mudo) s.unmute({ audio: true }); else s.mute({ audio: true });
      setLigacao((l) => (l ? { ...l, mudo: !l.mudo } : l));
      anotar(ligacao.mudo ? "Microfone ligado de novo" : "Microfone no mudo");
    } catch (_) { /* sem sessão */ }
  };

  const tecla = (t) => {
    const s = sessaoRef.current;
    if (!s) return;
    try { s.sendDTMF(t); setDigitadas((d) => (d + t).slice(-20)); } catch (_) { /* sem sessão */ }
  };

  const copiarRegistro = () => {
    const texto = registro.map((r) => `${r.quando}  ${r.texto}`).join("\n");
    try { navigator.clipboard.writeText(texto); } catch (_) { /* sem área de transferência */ }
  };

  const conectada = conta.estado === "registrada";
  const ocupada = ["carregando", "conectando", "registrada"].includes(conta.estado);
  const emLigacao = ligacao && ligacao.estado !== "encerrada";
  const discar = numeroParaDiscar(numero);
  const dominioPadrao = dominioDoEndereco(wss);

  const rotulo = { display: "block", fontSize: 12.5, fontWeight: 600, color: C.textSecondary, margin: "10px 0 4px" };
  const campo = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, fontSize: 14,
                  border: `1px solid ${C.divider}`, background: C.inputBg || C.bg, color: C.textPrimary, outline: "none" };
  const cartao = { background: C.headerBar, border: `1px solid ${C.divider}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 };
  const botao = (cor, ativo = true) => ({ display: "inline-flex", alignItems: "center", gap: 8, border: "none", borderRadius: 20,
                  padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: ativo ? "pointer" : "not-allowed",
                  background: ativo ? cor : C.divider, color: ativo ? "#fff" : C.textSecondary });
  const corDaConta = conta.estado === "registrada" ? (C.verdeTexto || C.green)
    : conta.estado === "falhou" ? (C.erroTexto || "#c62828") : C.textSecondary;

  return (
    <div data-tela="ligacoes" style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg || C.headerBar,
                                       display: "flex", flexDirection: "column", color: C.textPrimary }}>
      <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={aoFechar} title="Fechar esta guia" aria-label="Fechar esta guia" data-fechar-a-guia
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <X size={20} color={C.textSecondary} />
        </button>
        <Phone size={20} color={C.green} />
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Ligações (teste)</span>
      </div>

      {/* O ÁUDIO DO OUTRO LADO. Fora da vista: é só por onde a voz sai. */}
      <audio ref={audioRef} autoPlay data-ligacoes-audio style={{ display: "none" }} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 40px" }}>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
            Tela para testar as ligações pela <b>Nvoip</b>, só para quem administra. A senha SIP fica só nesta guia:
            não vai para o banco, nem fica guardada no navegador, e some quando a guia é fechada. Ainda não é a
            versão da equipe.
          </div>

          {/* A CONTA */}
          <div style={cartao} data-ligacoes-conta={conta.estado}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Conta da Nvoip</span>
              <span data-ligacoes-estado-da-conta style={{ fontSize: 13, fontWeight: 600, color: corDaConta, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {(conta.estado === "carregando" || conta.estado === "conectando") && <><style>{"@keyframes zv-ligacoes-gira { to { transform: rotate(360deg); } }"}</style><Loader2 size={14} style={{ animation: "zv-ligacoes-gira 1s linear infinite" }} /></>}
                {ROTULO_DA_CONTA[conta.estado]}
              </span>
            </div>

            <label style={rotulo} htmlFor="lig-wss">Endereço do servidor (WSS)</label>
            <input id="lig-wss" data-ligacoes-campo="wss" value={wss} onChange={(e) => setWss(e.target.value)}
                   disabled={ocupada} spellCheck={false} autoComplete="off" style={campo} />

            <label style={rotulo} htmlFor="lig-usuario">Usuário SIP (o que termina em 001)</label>
            <input id="lig-usuario" data-ligacoes-campo="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)}
                   disabled={ocupada} spellCheck={false} autoComplete="off" placeholder="ex.: 123456001" style={campo} />

            <label style={rotulo} htmlFor="lig-senha">Senha SIP</label>
            <div style={{ position: "relative" }}>
              <input id="lig-senha" data-ligacoes-campo="senha" type={verSenha ? "text" : "password"} value={senha}
                     onChange={(e) => setSenha(e.target.value)} disabled={ocupada} autoComplete="new-password"
                     spellCheck={false} style={{ ...campo, paddingRight: 44 }} />
              <button type="button" onClick={() => setVerSenha((v) => !v)} title={verSenha ? "Esconder a senha" : "Mostrar a senha"}
                      aria-label={verSenha ? "Esconder a senha" : "Mostrar a senha"}
                      style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", border: "none",
                               background: "transparent", cursor: "pointer", display: "flex", padding: 8 }}>
                {verSenha ? <EyeOff size={18} color={C.textSecondary} /> : <Eye size={18} color={C.textSecondary} />}
              </button>
            </div>

            <label style={rotulo} htmlFor="lig-dominio">Domínio SIP (opcional)</label>
            <input id="lig-dominio" data-ligacoes-campo="dominio" value={dominio} onChange={(e) => setDominio(e.target.value)}
                   disabled={ocupada} spellCheck={false} autoComplete="off"
                   placeholder={dominioPadrao ? `em branco, vale ${dominioPadrao}` : "em branco, vale o do endereço"} style={campo} />

            {conta.frase && (
              <div data-ligacoes-frase-da-conta role="alert"
                   style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.5, color: conta.estado === "falhou" ? (C.erroTexto || "#c62828") : C.textSecondary }}>
                {conta.frase}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!ocupada ? (
                <button data-ligacoes-conectar onClick={conectar} style={botao(C.botao || C.green)}>Conectar</button>
              ) : (
                <button data-ligacoes-desconectar onClick={desconectar} style={{ ...botao("transparent"), color: C.textPrimary, border: `1px solid ${C.divider}` }}>
                  Desconectar
                </button>
              )}
            </div>
          </div>

          {erro && (
            <div data-ligacoes-erro role="alert"
                 style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, fontSize: 13.5, lineHeight: 1.5,
                          color: C.erroTexto || "#c62828" }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{erro}</span>
            </div>
          )}

          {/* A LIGAÇÃO QUE CHEGA */}
          {ligacao && ligacao.direcao === "chegando" && ligacao.estado === "chegando" && (
            <div data-ligacoes-chegando style={{ ...cartao, borderColor: C.green }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <PhoneIncoming size={22} color={C.green} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Ligação chegando</div>
                  <div data-ligacoes-quem-liga style={{ fontSize: 14, color: C.textSecondary }}>{ligacao.numero}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button data-ligacoes-atender onClick={atender} style={botao(C.botao || C.green)}><Phone size={16} /> Atender</button>
                <button data-ligacoes-recusar onClick={desligar} style={botao(C.erroTexto || "#c62828")}><PhoneOff size={16} /> Recusar</button>
              </div>
            </div>
          )}

          {/* LIGAR */}
          <div style={cartao}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Ligar</div>
            <label style={rotulo} htmlFor="lig-numero">Número, com o DDD</label>
            <input id="lig-numero" data-ligacoes-numero type="tel" value={numero} onChange={(e) => setNumero(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && conectada && !emLigacao) ligar(); }}
                   placeholder="ex.: (11) 98765-4321" autoComplete="off" style={campo} />
            <div data-ligacoes-vai-discar style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 5, minHeight: 18 }}>
              {numero ? (discar.erro ? discar.erro : <>Vai discar: <b>{discar.numero}</b></>) : "Só os números vão para a Nvoip (o resto é tirado)."}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button data-ligacoes-ligar onClick={ligar} disabled={!conectada || Boolean(emLigacao)}
                      title={!conectada ? "Conecte a conta da Nvoip antes" : emLigacao ? "Já há uma ligação" : "Ligar"}
                      style={botao(C.botao || C.green, conectada && !emLigacao)}>
                <Phone size={16} /> Ligar
              </button>
            </div>

            {ligacao && ligacao.estado !== "chegando" && (
              <div data-ligacao={ligacao.estado} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{ROTULO_DA_LIGACAO[ligacao.estado]}</span>
                  <span style={{ fontSize: 14, color: C.textSecondary }}>
                    {ligacao.direcao === "saindo" ? "para" : "de"} {ligacao.numero}
                  </span>
                  {ligacao.inicio && (
                    <span data-ligacoes-duracao style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>
                      {duracaoDaLigacao((ligacao.fim || agora) - ligacao.inicio)}
                    </span>
                  )}
                </div>
                {ligacao.estado === "encerrada" && ligacao.frase && (
                  <div data-ligacoes-fim style={{ fontSize: 13.5, color: C.textSecondary, marginTop: 4 }}>
                    {ligacao.frase.charAt(0).toUpperCase() + ligacao.frase.slice(1)}.
                  </div>
                )}
                {emLigacao && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button data-ligacoes-desligar onClick={desligar} style={botao(C.erroTexto || "#c62828")}><PhoneOff size={16} /> Desligar</button>
                    {ligacao.estado === "em_ligacao" && (
                      <>
                        <button data-ligacoes-mudo={ligacao.mudo ? "sim" : "nao"} onClick={alternarMudo}
                                style={{ ...botao("transparent"), color: C.textPrimary, border: `1px solid ${C.divider}` }}>
                          {ligacao.mudo ? <><MicOff size={16} /> Tirar do mudo</> : <><Mic size={16} /> Mudo</>}
                        </button>
                        <button data-ligacoes-teclado onClick={() => setTeclado((t) => !t)} aria-pressed={teclado}
                                style={{ ...botao("transparent"), color: C.textPrimary, border: `1px solid ${C.divider}` }}>
                          <Grid3x3 size={16} /> Teclado
                        </button>
                      </>
                    )}
                  </div>
                )}
                {emLigacao && teclado && (
                  <div data-ligacoes-teclas style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, color: C.textSecondary, minHeight: 18, fontVariantNumeric: "tabular-nums" }}>{digitadas}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 56px)", gap: 8, marginTop: 4 }}>
                      {TECLAS.map((t) => (
                        <button key={t} data-ligacoes-tecla={t} onClick={() => tecla(t)}
                                style={{ height: 44, borderRadius: 10, border: `1px solid ${C.divider}`, background: C.bg || "transparent",
                                         color: C.textPrimary, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* O REGISTRO: o que aconteceu, para mandar a quem for investigar.
              Nunca leva a senha. */}
          <div style={cartao}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>O que aconteceu</span>
              {registro.length > 0 && (
                <button data-ligacoes-copiar onClick={copiarRegistro} title="Copiar o registro" aria-label="Copiar o registro"
                        style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6 }}>
                  <Copy size={16} color={C.textSecondary} />
                </button>
              )}
            </div>
            <div data-ligacoes-registro style={{ fontSize: 12.5, lineHeight: 1.6, color: C.textSecondary, fontVariantNumeric: "tabular-nums",
                                                 maxHeight: 240, overflowY: "auto", wordBreak: "break-word" }}>
              {registro.length === 0 ? "Nada ainda." : registro.map((r, i) => (
                <div key={i}><span style={{ opacity: 0.8 }}>{r.quando}</span>  {r.texto}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
