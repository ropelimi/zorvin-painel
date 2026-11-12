import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Grid3x3, Minimize2, Maximize2, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { WSS_PADRAO, duracaoDaLigacao, TECLAS, numeroDoContatoParaLigar } from "./ligacoes.js";
import { useLinhaSip } from "./useLinhaSip.js";

// ============================================================
//  LIGAR DE DENTRO DA CONVERSA (12/11)
//
//  Pedido do Rodrigo, depois de a primeira ligação pela Nvoip dar certo: "monte
//  um visual onde possamos ligar por dentro da conversa", e "o visual deve ser
//  o mais parecido possível com o WhatsApp Web".
//
//  O telefone do cabeçalho da conversa (ou "Ligar" no ⋮) liga para o número do
//  cliente. A JANELA DA LIGAÇÃO é a do WhatsApp: escura nos dois temas, a foto
//  grande no meio, o nome, "Chamando…" e depois o relógio, e os botões
//  redondos embaixo (teclado, mudo e o vermelho de desligar). Ela pode ser
//  MINIMIZADA numa pílula verde, e a ligação continua enquanto a pessoa abre
//  outras conversas: a linha mora aqui, uma só para a guia, e não na conversa.
//  As duas ficam NO ALTO, à direita, logo abaixo do cabeçalho: embaixo, elas
//  cobririam o botão de enviar da caixa de escrever, e a pessoa escreve ao
//  cliente com a ligação no ar.
//
//  A CONTA DA NVOIP é pedida na primeira ligação da guia (usuário e senha SIP).
//  O usuário fica guardado no navegador, porque não é segredo; a SENHA NÃO —
//  ela mora só na memória desta guia, como na tela de teste, e é pedida de novo
//  depois de a guia recarregar (o F5, ou a atualização sozinha do Zorvin, que
//  aqui não fica presa pela conta conectada: só por uma ligação em andamento).
//
//  O número sai de `numeroDoContatoParaLigar`: com o 55 e o nono dígito.
// ============================================================

const CHAVE_DO_USUARIO = "zorvin-sip-usuario";

// As cores da tela de chamada do WhatsApp, as mesmas nos dois temas.
const CHAMADA = {
  fundo: "#0b141a",
  texto: "#e9edef",
  apagado: "#8696a0",
  botao: "#233138",
  botaoAtivo: "#e9edef",
  vermelho: "#ea0038",
  verde: "#00a884",
  pilula: "#008069",
};

const STATUS = {
  chamando: "Chamando…",
  tocando: "Tocando…",
  atendendo: "Conectando…",
  chegando: "Ligação de voz recebida",
};

function lerUsuarioGuardado() {
  try { return localStorage.getItem(CHAVE_DO_USUARIO) || ""; } catch (_) { return ""; }
}

function BotaoRedondo({ onClick, titulo, cor = CHAMADA.botao, corDoIcone = CHAMADA.texto, ativo, children, ...resto }) {
  return (
    <button onClick={onClick} title={titulo} aria-label={titulo} aria-pressed={ativo}
            style={{ width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
                     background: cor, color: corDoIcone, display: "flex", alignItems: "center", justifyContent: "center",
                     flexShrink: 0 }} {...resto}>
      {children}
    </button>
  );
}

const LigacaoNaConversa = forwardRef(function LigacaoNaConversa({ C, Avatar, estreito, formatarNumero, aoAvisar, aoMudar }, ref) {
  const linha = useLinhaSip({ seguraConectada: false, agente: "Zorvin" });
  const { conta, ligacao, erro, teclado, setTeclado, digitadas, agora, audioRef,
          atender, desligar, alternarMudo, tecla, esquecerLigacao } = linha;
  const [pedido, setPedido] = useState(null);      // a ligação esperando a conta conectar
  const [contaAberta, setContaAberta] = useState(false);
  const [usuario, setUsuario] = useState(lerUsuarioGuardado);
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const senhaRef = useRef(null);

  const emLigacao = Boolean(ligacao && ligacao.estado !== "encerrada");

  // Quem desenha o cabeçalho precisa saber: com quem é a ligação, e se há uma.
  useEffect(() => {
    if (aoMudar) aoMudar(ligacao ? { emLigacao, conversaId: ligacao.conversaId || null, estado: ligacao.estado } : null);
  }, [ligacao, emLigacao, aoMudar]);

  const discar = (alvo) => {
    const ok = linha.ligar(alvo.numero, { nome: alvo.nome, foto: alvo.foto, conversaId: alvo.conversaId });
    if (ok) setMinimizada(false);
    return ok;
  };

  useImperativeHandle(ref, () => ({
    ligarPara(alvo) {
      if (emLigacao) {
        // Já há uma ligação: o clique traz a janela de volta, e não liga de novo.
        setMinimizada(false);
        if (!ligacao || ligacao.conversaId !== alvo.conversaId) {
          if (aoAvisar) aoAvisar("Já há uma ligação em andamento. Desligue antes de ligar para outra pessoa.");
        }
        return;
      }
      const n = numeroDoContatoParaLigar(alvo.numero);
      if (n.erro) { if (aoAvisar) aoAvisar(n.erro); return; }
      const pronto = { ...alvo, numero: n.numero };
      esquecerLigacao();
      if (conta.estado === "registrada") {
        if (!discar(pronto) && aoAvisar) aoAvisar(linha.erro || "A ligação não saiu.");
        return;
      }
      setPedido(pronto);
      setContaAberta(true);
    },
  }), [emLigacao, ligacao, conta.estado, aoAvisar, esquecerLigacao]); // eslint-disable-line react-hooks/exhaustive-deps

  // A CONTA CONECTOU COM UMA LIGAÇÃO ESPERANDO: liga na hora, e a janela da
  // conta dá lugar à da ligação.
  useEffect(() => {
    if (conta.estado !== "registrada" || !pedido) return;
    const alvo = pedido;
    setPedido(null);
    setContaAberta(false);
    setSenha("");
    discar(alvo);
  }, [conta.estado, pedido]); // eslint-disable-line react-hooks/exhaustive-deps

  // A ligação que chega abre a janela (minimizada ou não, ela toca).
  useEffect(() => {
    if (ligacao && ligacao.estado === "chegando") setMinimizada(false);
  }, [ligacao && ligacao.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // A ligação atendida que terminou normalmente sai da tela sozinha depois de
  // uns segundos, como no WhatsApp. A que não completou fica, com o motivo e o
  // "Ligar de novo".
  useEffect(() => {
    if (!ligacao || ligacao.estado !== "encerrada" || !ligacao.atendida) return undefined;
    const r = setTimeout(() => esquecerLigacao(), 5000);
    return () => clearTimeout(r);
  }, [ligacao, esquecerLigacao]);

  useEffect(() => {
    if (contaAberta && senhaRef.current) senhaRef.current.focus();
  }, [contaAberta]);

  const conectar = async () => {
    try { localStorage.setItem(CHAVE_DO_USUARIO, usuario.trim()); } catch (_) { /* sem armazenamento */ }
    await linha.conectar({ wss: WSS_PADRAO, usuario, senha, dominio: "" });
  };

  const cancelarConta = () => {
    setContaAberta(false);
    setPedido(null);
    setSenha("");
    if (conta.estado === "carregando" || conta.estado === "conectando") linha.desconectar();
  };

  const ligarDeNovo = () => {
    if (!ligacao) return;
    const alvo = { numero: ligacao.numero, nome: ligacao.nome, foto: ligacao.foto, conversaId: ligacao.conversaId };
    esquecerLigacao();
    if (conta.estado === "registrada") discar(alvo);
    else { setPedido(alvo); setContaAberta(true); }
  };

  const nome = (ligacao && (ligacao.nome || formatarNumero(ligacao.numero))) || (pedido && pedido.nome) || "";
  const numeroLegivel = ligacao ? formatarNumero(ligacao.numero) : "";
  const status = !ligacao ? ""
    : ligacao.estado === "em_ligacao" ? duracaoDaLigacao(agora - ligacao.inicio)
    : ligacao.estado === "encerrada"
      ? (ligacao.atendida
          ? `Ligação encerrada · ${duracaoDaLigacao((ligacao.fim || agora) - ligacao.inicio)}`
          : (ligacao.frase ? ligacao.frase.charAt(0).toUpperCase() + ligacao.frase.slice(1) : "Ligação encerrada"))
    : STATUS[ligacao.estado] || "";
  const ocupada = conta.estado === "carregando" || conta.estado === "conectando";

  return (
    <>
      {/* O ÁUDIO DO OUTRO LADO. Fora da vista: é só por onde a voz sai. */}
      <audio ref={audioRef} autoPlay data-ligacao-audio style={{ display: "none" }} />

      {/* A CONTA DA NVOIP, na primeira ligação da guia. Clara, como as janelas
          do Zorvin: é configuração, e não a chamada. */}
      {contaAberta && (
        <div onClick={cancelarConta}
             style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(0,0,0,.45)",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div data-ligacao-conta={conta.estado} role="dialog" aria-label="Conectar a linha de ligações"
               onClick={(e) => e.stopPropagation()}
               onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); cancelarConta(); } }}
               style={{ width: "100%", maxWidth: 380, background: C.panel, color: C.textPrimary, borderRadius: 12,
                        boxShadow: "0 12px 40px rgba(0,0,0,.35)", padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Phone size={20} color={C.green} />
              <span style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>Ligar{pedido && pedido.nome ? ` para ${pedido.nome}` : ""}</span>
              <button onClick={cancelarConta} title="Cancelar" aria-label="Cancelar"
                      style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6 }}>
                <X size={18} color={C.textSecondary} />
              </button>
            </div>
            <div style={{ fontSize: 13.5, color: C.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
              Conecte a linha da Nvoip para ligar. A senha fica só nesta guia: não é guardada, e é pedida de novo
              quando a guia recarregar.
            </div>
            <label htmlFor="lig-conv-usuario" style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.textSecondary, margin: "8px 0 4px" }}>
              Usuário SIP
            </label>
            <input id="lig-conv-usuario" data-ligacao-campo="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)}
                   disabled={ocupada} spellCheck={false} autoComplete="off" placeholder="ex.: 123456001"
                   style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, fontSize: 15,
                            border: `1px solid ${C.divider}`, background: C.inputBg || C.bg, color: C.textPrimary, outline: "none" }} />
            <label htmlFor="lig-conv-senha" style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.textSecondary, margin: "10px 0 4px" }}>
              Senha SIP
            </label>
            <div style={{ position: "relative" }}>
              <input id="lig-conv-senha" ref={senhaRef} data-ligacao-campo="senha" type={verSenha ? "text" : "password"}
                     value={senha} onChange={(e) => setSenha(e.target.value)} disabled={ocupada}
                     onKeyDown={(e) => { if (e.key === "Enter" && !ocupada) conectar(); }}
                     autoComplete="new-password" spellCheck={false}
                     style={{ width: "100%", boxSizing: "border-box", padding: "9px 44px 9px 11px", borderRadius: 8, fontSize: 15,
                              border: `1px solid ${C.divider}`, background: C.inputBg || C.bg, color: C.textPrimary, outline: "none" }} />
              <button type="button" onClick={() => setVerSenha((v) => !v)} title={verSenha ? "Esconder a senha" : "Mostrar a senha"}
                      aria-label={verSenha ? "Esconder a senha" : "Mostrar a senha"}
                      style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", border: "none",
                               background: "transparent", cursor: "pointer", display: "flex", padding: 8 }}>
                {verSenha ? <EyeOff size={18} color={C.textSecondary} /> : <Eye size={18} color={C.textSecondary} />}
              </button>
            </div>
            {(erro || conta.estado === "falhou") && (
              <div data-ligacao-erro-da-conta role="alert" style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.5, color: C.erroTexto || "#c62828" }}>
                {erro || conta.frase}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={cancelarConta}
                      style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, borderRadius: 20,
                               padding: "9px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                Cancelar
              </button>
              <button data-ligacao-conectar onClick={conectar} disabled={ocupada}
                      style={{ border: "none", background: C.botao || C.green, color: "#fff", borderRadius: 20,
                               padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: ocupada ? "default" : "pointer",
                               display: "inline-flex", alignItems: "center", gap: 8 }}>
                {ocupada ? <><style>{"@keyframes zv-lig-gira { to { transform: rotate(360deg); } }"}</style>
                  <Loader2 size={16} style={{ animation: "zv-lig-gira 1s linear infinite" }} /> Conectando…</>
                  : <><Phone size={16} /> Conectar e ligar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A PÍLULA: a ligação minimizada, para trabalhar nas conversas. */}
      {ligacao && minimizada && ligacao.estado !== "chegando" && (
        <div data-ligacao-pilula={ligacao.estado}
             style={{ position: "fixed", zIndex: 410, right: estreito ? 12 : 24, top: estreito ? 64 : 72,
                      background: ligacao.estado === "encerrada" ? CHAMADA.botao : CHAMADA.pilula, color: "#fff",
                      borderRadius: 28, boxShadow: "0 6px 20px rgba(0,0,0,.3)", display: "flex", alignItems: "center",
                      gap: 8, padding: "6px 6px 6px 16px", maxWidth: "calc(100vw - 24px)" }}>
          <Phone size={16} style={{ flexShrink: 0 }} />
          <button onClick={() => setMinimizada(false)} title="Abrir a ligação" aria-label="Abrir a ligação"
                  style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer", padding: 0,
                           display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, textAlign: "left" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
            <span data-ligacao-status style={{ fontSize: 12, opacity: .9, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{status}</span>
          </button>
          <button onClick={() => setMinimizada(false)} title="Abrir a ligação" aria-label="Abrir a ligação"
                  style={{ border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer",
                           width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Maximize2 size={16} />
          </button>
          {emLigacao ? (
            <button data-ligacao-desligar onClick={desligar} title="Desligar" aria-label="Desligar"
                    style={{ border: "none", background: CHAMADA.vermelho, color: "#fff", cursor: "pointer",
                             width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PhoneOff size={16} />
            </button>
          ) : (
            <button onClick={esquecerLigacao} title="Fechar" aria-label="Fechar"
                    style={{ border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer",
                             width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* A JANELA DA LIGAÇÃO — a do WhatsApp. */}
      {ligacao && !(minimizada && ligacao.estado !== "chegando") && (
        <div data-ligacao={ligacao.estado} role="dialog" aria-label={`Ligação com ${nome}`}
             style={{ position: "fixed", zIndex: 410, background: CHAMADA.fundo, color: CHAMADA.texto,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      ...(estreito
                        ? { inset: 0 }
                        : { right: 24, top: 72, width: 320, height: 440, maxHeight: "calc(100vh - 96px)", borderRadius: 16,
                            boxShadow: "0 12px 40px rgba(0,0,0,.45)" }) }}>
          <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", padding: "12px 12px 0 18px", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12.5, color: CHAMADA.apagado, display: "flex", alignItems: "center", gap: 6 }}>
              <Phone size={13} /> Ligação de voz pelo Zorvin
            </span>
            {ligacao.estado !== "chegando" && (
              emLigacao ? (
                <button data-ligacao-minimizar onClick={() => { setMinimizada(true); setTeclado(false); }}
                        title="Minimizar (a ligação continua)" aria-label="Minimizar (a ligação continua)"
                        style={{ border: "none", background: "transparent", color: CHAMADA.apagado, cursor: "pointer",
                                 width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Minimize2 size={18} />
                </button>
              ) : (
                <button data-ligacao-fechar onClick={esquecerLigacao} title="Fechar" aria-label="Fechar"
                        style={{ border: "none", background: "transparent", color: CHAMADA.apagado, cursor: "pointer",
                                 width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={18} />
                </button>
              )
            )}
          </div>

          {teclado && emLigacao ? (
            <div data-ligacao-teclas style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ fontSize: 22, minHeight: 30, letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>{digitadas}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 56px)", gap: 10 }}>
                {TECLAS.map((t) => (
                  <button key={t} data-ligacao-tecla={t} onClick={() => tecla(t)}
                          style={{ width: 56, height: 56, borderRadius: "50%", border: "none", background: CHAMADA.botao,
                                   color: CHAMADA.texto, fontSize: 22, fontWeight: 500, cursor: "pointer" }}>{t}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 6, padding: "0 20px", textAlign: "center", minWidth: 0, alignSelf: "stretch" }}>
              <div style={{ marginBottom: 14, borderRadius: "50%",
                            boxShadow: ligacao.estado === "chamando" || ligacao.estado === "tocando" || ligacao.estado === "chegando"
                              ? `0 0 0 8px rgba(0,168,132,.18)` : "none" }}>
                <Avatar nome={ligacao.nome || ligacao.numero} foto={ligacao.foto} size={96} />
              </div>
              <div data-ligacao-nome style={{ fontSize: 20, fontWeight: 500, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
              {ligacao.nome && numeroLegivel && (
                <div style={{ fontSize: 13.5, color: CHAMADA.apagado }}>{numeroLegivel}</div>
              )}
              <div data-ligacao-status role="status"
                   style={{ fontSize: 14, color: ligacao.estado === "em_ligacao" ? CHAMADA.texto : CHAMADA.apagado,
                            fontVariantNumeric: "tabular-nums", marginTop: 4, lineHeight: 1.45 }}>{status}</div>
              {erro && ligacao.estado !== "encerrada" && (
                <div role="alert" style={{ fontSize: 13, color: "#ff8a7a", marginTop: 6, lineHeight: 1.45 }}>{erro}</div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "center", padding: "16px 20px 28px" }}>
            {ligacao.estado === "chegando" ? (
              <>
                <BotaoRedondo data-ligacao-recusar onClick={desligar} titulo="Recusar" cor={CHAMADA.vermelho} corDoIcone="#fff">
                  <PhoneOff size={22} />
                </BotaoRedondo>
                <BotaoRedondo data-ligacao-atender onClick={atender} titulo="Atender" cor={CHAMADA.verde} corDoIcone="#fff">
                  <Phone size={22} />
                </BotaoRedondo>
              </>
            ) : emLigacao ? (
              <>
                <BotaoRedondo data-ligacao-teclado onClick={() => setTeclado((t) => !t)} titulo={teclado ? "Esconder o teclado" : "Teclado"}
                              ativo={teclado} cor={teclado ? CHAMADA.botaoAtivo : CHAMADA.botao}
                              corDoIcone={teclado ? CHAMADA.fundo : CHAMADA.texto}
                              disabled={ligacao.estado !== "em_ligacao"}>
                  <Grid3x3 size={21} />
                </BotaoRedondo>
                <BotaoRedondo data-ligacao-mudo={ligacao.mudo ? "sim" : "nao"} onClick={alternarMudo}
                              titulo={ligacao.mudo ? "Tirar do mudo" : "Mudo"} ativo={ligacao.mudo}
                              cor={ligacao.mudo ? CHAMADA.botaoAtivo : CHAMADA.botao}
                              corDoIcone={ligacao.mudo ? CHAMADA.fundo : CHAMADA.texto}
                              disabled={ligacao.estado !== "em_ligacao"}>
                  {ligacao.mudo ? <MicOff size={21} /> : <Mic size={21} />}
                </BotaoRedondo>
                <BotaoRedondo data-ligacao-desligar onClick={desligar} titulo="Desligar" cor={CHAMADA.vermelho} corDoIcone="#fff">
                  <PhoneOff size={22} />
                </BotaoRedondo>
              </>
            ) : (
              <>
                <BotaoRedondo data-ligacao-fechar-baixo onClick={esquecerLigacao} titulo="Fechar">
                  <X size={22} />
                </BotaoRedondo>
                {ligacao.direcao === "saindo" && (
                  <BotaoRedondo data-ligacao-de-novo onClick={ligarDeNovo} titulo="Ligar de novo" cor={CHAMADA.verde} corDoIcone="#fff">
                    <Phone size={22} />
                  </BotaoRedondo>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
});

export default LigacaoNaConversa;
