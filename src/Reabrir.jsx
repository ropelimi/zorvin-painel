import React from "react";
import { Loader2, RotateCcw, Undo2, X } from "lucide-react";
import { NOME_DA_SITUACAO } from "./abasDaSituacao.js";

// ============================================================
//  A JANELA DO "REABRIR" (script 028 da ponte, 19/10)
//
//  Esta janela é só a TELA, pela régua do `JaTratei.jsx`: quem grava é o
//  `Painel.jsx` (`reabrirConversa` e `desfazerFinalizacao`), que é quem tem a
//  lista de conversas na mão.
//
//  ------------------------------------------------------------
//  DOIS BOTÕES, PORQUE "REABRIR" TEM DOIS SENTIDOS
//
//  - PARA CONTINUAR o atendimento: a conversa volta para "Em Atendimento" com um
//    PROTOCOLO NOVO, e a finalização de antes continua registrada — ela
//    aconteceu, e o relatório continua contando. É o "Reabrir" do DataCrazy.
//  - PORQUE FOI ENGANO: o "Voltar para a fila" de sempre. O MESMO protocolo
//    volta a ficar aberto, e o registro do "Finalizar" deixa de contar.
//
//  Um botão só teria de escolher um dos dois por quem clica — e os dois
//  erros são caros: desfazer quando era para continuar apaga do relatório um
//  trabalho que aconteceu; continuar quando era engano deixa o relatório
//  contando uma finalização que não houve.
//
//  "Reabrir para continuar" vem PRIMEIRO, porque é o caso comum: o
//  engano se percebe na hora, e o resto é a conversa que precisa de mais.
// ============================================================

export function Reabrir({ C, estreito, nome, protocolo, finalizacao = "", ocupado, erro, aoReabrir, aoDesfazer, aoFechar }) {
  const opcao = (chave, Icone, titulo, texto, acao) => (
    <button key={chave} data-reabrir-opcao={chave} onClick={acao} disabled={ocupado}
            style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
                     padding: "11px 12px", marginBottom: 8, borderRadius: 10, cursor: ocupado ? "not-allowed" : "pointer",
                     border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                     minHeight: estreito ? 40 : undefined, opacity: ocupado ? 0.6 : 1 }}>
      <Icone size={18} color={chave === "continuar" ? C.green : C.textSecondary} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 12.5, color: C.textSecondary, lineHeight: 1.45, marginTop: 2 }}>{texto}</span>
      </span>
    </button>
  );

  return (
    <div onClick={aoFechar} data-reabrir-janela
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 200,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: estreito ? 12 : 24 }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ background: C.panel, color: C.textPrimary, borderRadius: 12, width: "100%",
                    maxWidth: 440, maxHeight: "86vh", display: "flex", flexDirection: "column",
                    boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
                      borderBottom: `1px solid ${C.divider}` }}>
          <RotateCcw size={18} color={C.green} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Reabrir a conversa</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nome}
              {protocolo && <span data-reabrir-protocolo={protocolo}>{" · "}protocolo {protocolo}</span>}
            </div>
          </div>
          <button aria-label="Fechar" onClick={aoFechar}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary,
                           display: "flex", padding: 6, minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 16px 4px" }}>
          {finalizacao && (
            <div data-reabrir-finalizacao style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              {finalizacao}
            </div>
          )}
          {opcao("continuar", RotateCcw, "Reabrir para continuar o atendimento",
                 `A conversa volta para “${NOME_DA_SITUACAO.aberto}” com um protocolo novo. A finalização de antes continua registrada.`,
                 aoReabrir)}
          {opcao("desfazer", Undo2, "Desfazer a finalização (foi engano)",
                 "O mesmo protocolo volta a ficar aberto, e o registro do “Finalizar” deixa de contar no relatório.",
                 aoDesfazer)}
        </div>

        {erro && (
          <div data-reabrir-erro
               style={{ margin: "0 16px 10px", padding: "9px 11px", borderRadius: 8, fontSize: 12.5,
                        lineHeight: 1.45, background: "rgba(229,87,63,.12)", color: "#e5573f",
                        border: "1px solid rgba(229,87,63,.35)" }}>
            {erro}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", padding: "12px 16px",
                      borderTop: `1px solid ${C.divider}` }}>
          {ocupado && (
            <span style={{ marginRight: "auto", display: "inline-flex", alignItems: "center", gap: 6,
                           fontSize: 12.5, color: C.textSecondary }}>
              <Loader2 size={14} className="zv-girando" /> Gravando…
            </span>
          )}
          <button onClick={aoFechar} disabled={ocupado}
                  style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
                           borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
                           minHeight: estreito ? 40 : undefined }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default Reabrir;
