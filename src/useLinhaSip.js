import { useCallback, useEffect, useRef, useState } from "react";
import { STUN, conferirConta, numeroParaDiscar, quemLiga, fraseDoFim, fraseDaFalhaDoRegistro,
         fraseDoMicrofone, carregarSip } from "./ligacoes.js";
import { useMotivoParaEsperar, recargaPedida } from "./atualizacao.js";

// ============================================================
//  A LINHA DA NVOIP, NUMA ESCRITA SÓ (12/11)
//
//  A conta SIP, a ligação, o áudio do outro lado e o registro do que
//  aconteceu. Quem usa: a tela de teste (`Ligacoes.jsx`, numa guia própria) e
//  a ligação de dentro da conversa (`LigacaoNaConversa.jsx`, na guia das
//  conversas). Duas escritas disto divergiriam no primeiro conserto — e
//  divergir aqui é a ligação funcionar numa tela e não na outra.
//
//  A SENHA SIP CONTINUA SÓ NA MEMÓRIA DA GUIA: ela vai do campo direto para a
//  biblioteca, e não é guardada aqui, nem no navegador, nem no banco.
//
//  `seguraConectada`: a conta conectada (sem ligação) também segura a
//  atualização sozinha do Zorvin. A tela de teste segura (a guia existe só
//  para isso); a guia das conversas NÃO — passaria o dia sem se atualizar.
//  Ali só a ligação em andamento segura, e depois de uma atualização a senha
//  é pedida de novo na próxima ligação.
// ============================================================

const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// O TOQUE DA LIGAÇÃO QUE CHEGA, sintetizado como os avisos (nenhum arquivo):
// duas notas juntas, um segundo e meio de toque e três de pausa.
export function useToque(tocando) {
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

export function useLinhaSip({ seguraConectada = true, agente = "Zorvin (teste de ligações)" } = {}) {
  const [conta, setConta] = useState({ estado: "desligada", frase: "" });
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

  // A LIGAÇÃO (e, onde pedem, a conta conectada) SEGURA A ATUALIZAÇÃO SOZINHA
  // DO ZORVIN: recarregar a guia derrubaria a ligação e apagaria a senha.
  useMotivoParaEsperar(() => {
    if (ligacao && ligacao.estado !== "encerrada") return "uma ligação em andamento";
    if (seguraConectada && (conta.estado === "registrada" || conta.estado === "conectando")) return "a conta da Nvoip conectada nesta guia";
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

  // Ao sair (desmontar), tudo é desligado: nada fica conectado à Nvoip sem
  // uma tela que diga isso.
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

  const acompanhar = useCallback((sessao, direcao, quem, extra) => {
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
        setLigacao((l) => (l ? { ...l, estado: "encerrada", fim: Date.now(), frase, quemEncerrou: e && e.originator,
                                 atendida: Boolean(l.inicio) } : l));
        setTeclado(false);
      }
    };
    sessao.on("ended", fim("ended"));
    sessao.on("failed", fim("failed"));
    setDigitadas("");
    setLigacao({ direcao, numero: quem, estado: direcao === "saindo" ? "chamando" : "chegando", mudo: false, ...(extra || {}) });
  }, [anotar, ligarOAudio]);

  /** Conecta a conta. Devolve `false` quando a conta não se lê (o motivo vai
   *  para `erro`). A senha vem do campo e vai direto para a biblioteca. */
  const conectar = useCallback(async ({ wss, usuario, senha, dominio }) => {
    setErro("");
    const c = conferirConta({ wss, usuario, senha, dominio });
    if (c.erro) { setErro(c.erro); return false; }
    setConta({ estado: "carregando", frase: "" });
    let JsSIP;
    try {
      JsSIP = await carregarSip();
    } catch (e) {
      setConta({ estado: "falhou", frase: "Não consegui carregar a parte do Zorvin que faz as ligações. Recarregue a guia e tente de novo." });
      anotar(`A biblioteca de ligações não carregou (${(e && e.message) || "sem detalhe"})`);
      return true;
    }
    if (!vivaRef.current) return true;
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
        user_agent: agente,
      });
    } catch (e) {
      setConta({ estado: "falhou", frase: `A conta não se lê: ${(e && e.message) || "confira o usuário e o domínio"}.` });
      anotar(`A conta não se lê (${(e && e.message) || "sem detalhe"})`);
      return true;
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
    return true;
  }, [agente, anotar, acompanhar]);

  const desconectar = useCallback(() => {
    try { if (sessaoRef.current) sessaoRef.current.terminate(); } catch (_) { /* já acabou */ }
    try { if (uaRef.current) uaRef.current.stop(); } catch (_) { /* já parou */ }
    sessaoRef.current = null;
    uaRef.current = null;
    setConta({ estado: "desligada", frase: "" });
    anotar("Desconectado");
  }, [anotar]);

  /** Liga. Devolve `true` se a ligação saiu; senão a frase vai para `erro`.
   *  `extra` vai junto da ligação (quem é, na conversa). */
  const ligar = useCallback((numero, extra) => {
    setErro("");
    const n = numeroParaDiscar(numero);
    if (n.erro) { setErro(n.erro); return false; }
    const ua = uaRef.current;
    if (!ua || conta.estado !== "registrada") { setErro("Conecte a conta da Nvoip antes de ligar."); return false; }
    if (sessaoRef.current) { setErro("Já há uma ligação em andamento."); return false; }
    anotar(`Ligando para ${n.numero}`);
    try {
      const sessao = ua.call(n.numero, {
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: STUN },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      });
      acompanhar(sessao, "saindo", n.numero, extra);
      return true;
    } catch (e) {
      const frase = /getUserMedia|NotAllowed|Permission/i.test((e && (e.name || e.message)) || "")
        ? fraseDoMicrofone(e) : `A ligação não saiu: ${(e && e.message) || "sem detalhe"}.`;
      setErro(frase);
      anotar(`A ligação não saiu (${(e && e.message) || "sem detalhe"})`);
      return false;
    }
  }, [conta.estado, anotar, acompanhar]);

  const atender = useCallback(() => {
    const s = sessaoRef.current;
    if (!s) return;
    setLigacao((l) => (l ? { ...l, estado: "atendendo" } : l));
    try {
      s.answer({ mediaConstraints: { audio: true, video: false }, pcConfig: { iceServers: STUN } });
    } catch (e) {
      setErro(fraseDoMicrofone(e));
      anotar(`Não consegui atender (${(e && e.message) || "sem detalhe"})`);
    }
  }, [anotar]);

  const desligar = useCallback(() => {
    const s = sessaoRef.current;
    if (!s) return;
    try {
      if (ligacao && ligacao.estado === "chegando") s.terminate({ status_code: 486, reason_phrase: "Busy Here" });
      else s.terminate();
    } catch (_) { /* já acabou */ }
  }, [ligacao]);

  const alternarMudo = useCallback(() => {
    const s = sessaoRef.current;
    if (!s || !ligacao) return;
    try {
      if (ligacao.mudo) s.unmute({ audio: true }); else s.mute({ audio: true });
      setLigacao((l) => (l ? { ...l, mudo: !l.mudo } : l));
      anotar(ligacao.mudo ? "Microfone ligado de novo" : "Microfone no mudo");
    } catch (_) { /* sem sessão */ }
  }, [ligacao, anotar]);

  const tecla = useCallback((t) => {
    const s = sessaoRef.current;
    if (!s) return;
    try { s.sendDTMF(t); setDigitadas((d) => (d + t).slice(-20)); } catch (_) { /* sem sessão */ }
  }, []);

  /** Tira da tela a ligação que já terminou. */
  const esquecerLigacao = useCallback(() => {
    setLigacao((l) => (l && l.estado === "encerrada" ? null : l));
  }, []);

  return { conta, ligacao, erro, setErro, teclado, setTeclado, digitadas, registro, agora, audioRef,
           anotar, conectar, desconectar, ligar, atender, desligar, alternarMudo, tecla, esquecerLigacao };
}
