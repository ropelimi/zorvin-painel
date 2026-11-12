import React, { useState } from "react";
import { X, Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Grid3x3, Copy, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { WSS_PADRAO, dominioDoEndereco, numeroParaDiscar, duracaoDaLigacao, TECLAS } from "./ligacoes.js";
import { useLinhaSip } from "./useLinhaSip.js";

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

export default function Ligacoes({ C, aoFechar }) {
  const [wss, setWss] = useState(WSS_PADRAO);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [dominio, setDominio] = useState("");
  const [numero, setNumero] = useState("");
  // A CONTA, A LIGAÇÃO E O REGISTRO moram em `useLinhaSip`, a mesma escrita
  // da ligação de dentro da conversa (12/11).
  const linha = useLinhaSip({ seguraConectada: true });
  const { conta, ligacao, erro, teclado, setTeclado, digitadas, registro, agora, audioRef,
          desconectar, atender, desligar, alternarMudo, tecla } = linha;

  const conectar = () => linha.conectar({ wss, usuario, senha, dominio });
  const ligar = () => linha.ligar(numero);

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
