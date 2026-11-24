import React, { useEffect, useRef, useState } from "react";
import { Loader2, X, Copy, RotateCcw, AlertCircle, Volume2, Square } from "lucide-react";
import { NOME_DO_ASSISTENTE } from "./assistente.js";
import { RostoDoAssistente } from "./RostoDoAssistente.jsx";
import { PARTES_DO_RESUMO, fraseDaLeitura } from "./resumoDaConversa.js";
import { pedirAVoz } from "./copiloto.js";

// ============================================================
//  A VOZ DO QUAZAR (24/11) — o "Ouvir" do quadro. A ponte manda o texto à
//  ElevenLabs, com a voz que quem administra escolheu, e devolve o mp3.
//
//  O ÁUDIO FICA GUARDADO NA GUIA, pelo texto (até 10): ouvir de novo o mesmo
//  resumo, ou fechar o quadro e abrir, não pede outra vez. Um resumo novo é
//  outro texto, e outro áudio.
//
//  FECHAR O QUADRO, OU PEDIR OUTRO RESUMO, PARA A VOZ: ela fala do resumo que
//  está na tela, e não de um que saiu.
// ============================================================
const VOZES_GUARDADAS = new Map();
const VOZES_NO_MAXIMO = 10;
function guardarAVoz(texto, url) {
  VOZES_GUARDADAS.set(texto, url);
  while (VOZES_GUARDADAS.size > VOZES_NO_MAXIMO) {
    const [primeiro, velha] = VOZES_GUARDADAS.entries().next().value;
    VOZES_GUARDADAS.delete(primeiro);
    try { URL.revokeObjectURL(velha); } catch (_) { /* já solta */ }
  }
}

function useVozDoResumo(texto) {
  const [voz, setVoz] = useState({ fase: "parado", erro: "" });
  const audioRef = useRef(null);
  const vivoRef = useRef(true);
  const textoRef = useRef(texto);
  textoRef.current = texto;

  function calar() {
    const a = audioRef.current;
    audioRef.current = null;
    if (a) { try { a.pause(); a.currentTime = 0; } catch (_) { /* já parou */ } }
  }
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; calar(); };
  }, []);
  // OUTRO TEXTO (outro resumo, ou nenhum): a voz de antes para.
  useEffect(() => { calar(); setVoz({ fase: "parado", erro: "" }); }, [texto]);

  async function tocar(url, deQualTexto) {
    calar();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { if (audioRef.current === audio) { audioRef.current = null; setVoz({ fase: "parado", erro: "" }); } };
    try {
      await audio.play();
      if (vivoRef.current && textoRef.current === deQualTexto && audioRef.current === audio) setVoz({ fase: "tocando", erro: "" });
    } catch (e) {
      if (audioRef.current === audio) audioRef.current = null;
      if (vivoRef.current) {
        setVoz({ fase: "erro", erro: "O navegador não deixou tocar o áudio. Clique em Ouvir de novo." });
      }
    }
  }

  async function ouvir() {
    const deQualTexto = textoRef.current;
    if (!deQualTexto) return;
    if (voz.fase === "tocando") { calar(); setVoz({ fase: "parado", erro: "" }); return; }
    if (voz.fase === "preparando") return;
    const guardada = VOZES_GUARDADAS.get(deQualTexto);
    if (guardada) { await tocar(guardada, deQualTexto); return; }
    setVoz({ fase: "preparando", erro: "" });
    let url;
    try {
      const audio = await pedirAVoz(deQualTexto);
      url = URL.createObjectURL(audio);
      guardarAVoz(deQualTexto, url);
    } catch (e) {
      if (vivoRef.current && textoRef.current === deQualTexto) setVoz({ fase: "erro", erro: String((e && e.message) || e) });
      return;
    }
    // O QUADRO FECHOU, OU O RESUMO MUDOU, enquanto a voz vinha: ela fica
    // guardada para a próxima vez, e não toca.
    if (!vivoRef.current || textoRef.current !== deQualTexto) return;
    await tocar(url, deQualTexto);
  }
  return { voz, ouvir };
}

// ============================================================
//  O QUADRO DO RESUMO (01/11) — ver `resumoDaConversa.js` e, na ponte,
//  `POST /copiloto/resumir`.
//
//  POR CIMA DO ALTO DA CONVERSA, e não no meio dela nem embaixo. Embaixo ele
//  cobriria as mensagens mais novas, que são as que a pessoa precisa ler para
//  responder; no meio do fluxo, encolheria a lista e a rolagem dela pularia.
//  Em cima ele cobre o que é mais velho, e some num clique.
//
//  TRÊS FASES, e cada uma diz o seu:
//    pensando  "lendo a conversa…" — a IA demora uns segundos;
//    pronto    as três partes, o que foi lido, e as mensagens que chegaram
//              depois do resumo;
//    erro      a frase da ponte, que diz o que fazer, e "Tentar de novo".
//
//  "FEITO PELA IA: CONFIRA NA CONVERSA" FICA ESCRITO, sempre. É um escritório
//  de advocacia: um resumo que inventasse um acordo e fosse lido como fato é
//  o pior desfecho, e a frase custa uma linha.
// ============================================================
export default function ResumoDaConversa({ C, escuro, estreito, estado, novas = 0, aoFechar, aoResumirDeNovo, aoCopiar,
                                          textoParaOuvir = "" }) {
  // O "OUVIR" SÓ COM O RESUMO PRONTO, e só com a voz ligada (quem desenha o
  // quadro passa o texto só aí).
  const { voz, ouvir } = useVozDoResumo(estado && estado.fase === "pronto" ? textoParaOuvir : "");
  if (!estado) return null;
  const { fase } = estado;
  const corDaBorda = fase === "erro" ? (escuro ? "#e57373" : "#c0392b") : C.green;
  // O ALVO DE DEDO DO CELULAR (40 pontos) NÃO É ESCRITO AQUI: a regra geral do
  // painel o dá a todo botão abaixo de 768px, e a largura aos que são só
  // ícone, como o X e o "Resumir de novo" sem rótulo. Repetido aqui, seria uma
  // segunda escrita da régua — a sabotagem que o tira vaza, e é por isso.
  const botao = {
    border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary, cursor: "pointer",
    borderRadius: 8, padding: estreito ? "0 10px" : "5px 10px", minHeight: 30,
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
  };
  const titulo = {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase",
    color: C.textSecondary, marginBottom: 4,
  };
  const resumo = estado.resumo || {};
  return (
    <div data-resumo-da-conversa={fase} role="region" aria-label="Resumo da conversa" aria-live="polite"
         style={{ position: "absolute", top: 8, left: 0, right: 0, margin: "0 auto", zIndex: 15,
                  width: estreito ? "calc(100% - 16px)" : "calc(100% - 32px)", maxWidth: 760,
                  maxHeight: estreito ? "55vh" : "min(60vh, 480px)", overflowY: "auto", boxSizing: "border-box",
                  background: C.panel, color: C.textPrimary, border: `1px solid ${C.divider}`,
                  borderLeft: `4px solid ${corDaBorda}`, borderRadius: 10,
                  boxShadow: "0 6px 20px rgba(0,0,0,.25)", padding: estreito ? "10px 12px" : "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <RostoDoAssistente tamanho={24} />
        <b style={{ fontSize: 14, flex: 1, minWidth: 120 }}>Resumo da conversa</b>
        {fase === "pronto" && textoParaOuvir && (
          <button data-resumo-ouvir={voz.fase} onClick={ouvir} disabled={voz.fase === "preparando"}
                  aria-pressed={voz.fase === "tocando"}
                  title={voz.fase === "tocando" ? "Parar a leitura"
                    : voz.fase === "preparando" ? `Preparando a voz do ${NOME_DO_ASSISTENTE}…`
                    : `O ${NOME_DO_ASSISTENTE} lê o resumo em voz alta`}
                  aria-label={voz.fase === "tocando" ? "Parar a leitura do resumo" : `Ouvir o ${NOME_DO_ASSISTENTE} ler o resumo`}
                  style={{ ...botao, ...(voz.fase === "tocando" ? { borderColor: C.green, color: C.verdeTexto } : null) }}>
            {voz.fase === "preparando"
              ? <Loader2 size={14} color={C.green} style={{ animation: "zv-resumo-gira 1s linear infinite" }} />
              : voz.fase === "tocando" ? <Square size={12} fill="currentColor" /> : <Volume2 size={14} />}
            {estreito ? "" : voz.fase === "preparando" ? "Preparando a voz…" : voz.fase === "tocando" ? "Parar" : "Ouvir"}
          </button>
        )}
        {fase === "pronto" && (
          <button data-resumo-copiar onClick={aoCopiar} title="Copiar o resumo (texto puro)" style={botao}>
            <Copy size={14} /> Copiar
          </button>
        )}
        {fase === "pronto" && (
          <button data-resumo-de-novo onClick={aoResumirDeNovo} title={`Pedir um resumo novo ao ${NOME_DO_ASSISTENTE}`}
                  aria-label="Resumir de novo" style={botao}>
            <RotateCcw size={14} /> {estreito ? "" : "Resumir de novo"}
          </button>
        )}
        <button data-resumo-fechar onClick={aoFechar} title="Fechar o resumo" aria-label="Fechar o resumo"
                style={{ ...botao, border: "none", padding: 4, justifyContent: "center" }}>
          <X size={18} color={C.textSecondary} />
        </button>
      </div>

      <style>{"@keyframes zv-resumo-gira { to { transform: rotate(360deg); } }"}</style>
      {fase === "pronto" && voz.fase === "erro" && (
        <div data-resumo-voz-erro role="alert" style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 8,
                                                      fontSize: 12.5, lineHeight: 1.45, color: C.erroTexto }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {voz.erro}
        </div>
      )}
      {fase === "pensando" && (
        <div data-resumo-pensando style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                                           fontSize: 13, color: C.textSecondary }}>
          <Loader2 size={16} color={C.green} style={{ flexShrink: 0, animation: "zv-resumo-gira 1s linear infinite" }} />
          Lendo a conversa para resumir… pode levar alguns segundos.
        </div>
      )}

      {fase === "erro" && (
        <div style={{ marginTop: 10 }}>
          <div data-resumo-erro style={{ fontSize: 13, lineHeight: 1.5, color: C.erroTexto }}>{estado.erro}</div>
          <button data-resumo-tentar onClick={aoResumirDeNovo}
                  style={{ ...botao, marginTop: 8, border: "none", background: C.botao, color: "#fff" }}>
            Tentar de novo
          </button>
        </div>
      )}

      {fase === "pronto" && (
        <>
          <div data-resumo-leitura style={{ fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
            {estado.quando ? `Feito às ${estado.quando}. ` : ""}{fraseDaLeitura(estado)}
          </div>
          {PARTES_DO_RESUMO.map((p) => {
            const valor = resumo[p.chave];
            const lista = Array.isArray(valor);
            const vazio = lista ? !valor.length : !valor;
            return (
              <div key={p.chave} data-resumo-parte={p.chave} style={{ marginTop: 12 }}>
                <div style={titulo}>{p.titulo}</div>
                {vazio ? (
                  <div style={{ fontSize: 13.5, color: C.textSecondary, fontStyle: "italic" }}>{p.vazio}</div>
                ) : lista ? (
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.5 }}>
                    {valor.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{valor}</div>
                )}
              </div>
            );
          })}
          {(estado.avisos || []).map((a, i) => (
            <div key={i} data-resumo-aviso style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 10,
                                                   fontSize: 12.5, lineHeight: 1.45, color: C.ambarTexto }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {a}
            </div>
          ))}
          {novas > 0 && (
            <div data-resumo-novas={novas} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                                                    marginTop: 10, fontSize: 12.5, color: C.ambarTexto, fontWeight: 600 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {novas === 1 ? "Chegou 1 mensagem depois deste resumo." : `Chegaram ${novas} mensagens depois deste resumo.`}
            </div>
          )}
          <div data-resumo-aviso-da-ia style={{ marginTop: 10, fontSize: 11.5, color: C.textSecondary }}>
            Feito pelo {NOME_DO_ASSISTENTE}, a IA do Zorvin, a partir da conversa e das notas internas: confira na conversa antes de agir.
          </div>
        </>
      )}
    </div>
  );
}
