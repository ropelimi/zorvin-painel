import React, { useState } from "react";
import { ListChecks, Loader2, X } from "lucide-react";

// ============================================================
//  A CHECKLIST DO "JÁ TRATEI"
//
//  Esta janela é só a TELA. Quem grava é o `Painel.jsx`, que é quem tem a
//  lista de conversas na mão — separar a gravação daqui evitaria um segundo
//  lugar sabendo mexer em `conversas`, e é onde as duas versões começariam a
//  divergir.
//
//  ------------------------------------------------------------
//  A MARCAÇÃO É OBRIGATÓRIA, E O BOTÃO NASCE DESLIGADO
//
//  Sem isso, "Já tratei" vira um botão de "sumir com esta conversa" — e o que
//  se perde é justamente a resposta para *"o que a equipe fez em setembro"*,
//  que é o motivo de existir um registro em vez de só apagar a espera.
//
//  E o atrito é de propósito: marcar por engano faz um cliente sumir da fila
//  em silêncio, que é o pior desfecho deste sistema. Duas decisões (abrir e
//  marcar) erram junto muito menos do que uma.
//
//  ------------------------------------------------------------
//  A JANELA DIZ HÁ QUANTO TEMPO O CLIENTE ESPERA
//
//  É a informação que muda a decisão: "já tratei" numa conversa de ontem é
//  rotina; numa de 66 dias, quem está clicando precisa ver isso antes, porque
//  provavelmente ela NÃO foi tratada — só ficou velha.
// ============================================================

export function JaTratei({ C, estreito, nome, dias, assuntos, ocupado, erro, aoConfirmar, aoFechar }) {
  const [escolhidos, setEscolhidos] = useState([]);

  const ativos = (assuntos || []).filter((a) => a.ativo);
  const nenhum = escolhidos.length === 0;

  function alternar(id) {
    setEscolhidos((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  return (
    <div onClick={aoFechar} data-ja-tratei-janela
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 200,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: estreito ? 12 : 24 }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ background: C.panel, color: C.textPrimary, borderRadius: 12, width: "100%",
                    maxWidth: 420, maxHeight: "86vh", display: "flex", flexDirection: "column",
                    boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
                      borderBottom: `1px solid ${C.divider}` }}>
          <ListChecks size={18} color={C.green} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Já tratei</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nome}
              {dias >= 1 && (
                <span data-ja-tratei-dias={dias} style={{ color: dias >= 3 ? "#e5573f" : C.textSecondary, fontWeight: 600 }}>
                  {" · "}esperando há {dias} {dias === 1 ? "dia" : "dias"}
                </span>
              )}
            </div>
          </div>
          <button aria-label="Fechar" onClick={aoFechar}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary,
                           display: "flex", padding: 6, minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "12px 16px", fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>
          Tira esta conversa da fila de espera <b>sem mandar mensagem</b>.
          Marque o que foi tratado.
        </div>

        <div style={{ overflowY: "auto", padding: "0 16px 4px" }}>
          {ativos.length === 0 && (
            <div style={{ fontSize: 13, color: C.textSecondary, paddingBottom: 12 }}>
              Nenhum assunto cadastrado. Quem administra o Zorvin cria a lista em
              Configurações → Estrutura → “Assuntos do Já tratei”.
            </div>
          )}
          {ativos.map((a) => {
            const marcado = escolhidos.includes(a.id);
            return (
              <label key={a.id} data-assunto-do-ja-tratei={a.nome}
                     style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                              marginBottom: 6, borderRadius: 8, cursor: "pointer",
                              border: `1px solid ${marcado ? C.green : C.divider}`,
                              background: marcado ? (C.listActive || C.divider) : "transparent" }}>
                <input type="checkbox" checked={marcado} onChange={() => alternar(a.id)}
                       style={{ width: 17, height: 17, accentColor: C.green, cursor: "pointer" }} />
                <span style={{ fontSize: 13.5, fontWeight: marcado ? 600 : 400 }}>{a.nome}</span>
              </label>
            );
          })}
        </div>

        {erro && (
          <div data-ja-tratei-erro
               style={{ margin: "0 16px 10px", padding: "9px 11px", borderRadius: 8, fontSize: 12.5,
                        lineHeight: 1.45, background: "rgba(229,87,63,.12)", color: "#e5573f",
                        border: "1px solid rgba(229,87,63,.35)" }}>
            {erro}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 16px",
                      borderTop: `1px solid ${C.divider}` }}>
          <button onClick={aoFechar} disabled={ocupado}
                  style={{ border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
                           borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
                           minHeight: estreito ? 40 : undefined }}>
            Cancelar
          </button>
          {/* O BOTÃO DIZ POR QUE ESTÁ DESLIGADO, no `title` e na frase abaixo.
              Um botão apagado sem explicação faz a pessoa clicar de novo e
              concluir que a tela travou. */}
          <button onClick={() => aoConfirmar(escolhidos)} disabled={nenhum || ocupado}
                  data-ja-tratei-confirmar
                  title={nenhum ? "Marque pelo menos um assunto" : "Tirar da fila de espera"}
                  style={{ border: "none", background: nenhum || ocupado ? C.divider : C.green,
                           color: nenhum || ocupado ? C.textSecondary : "#fff", borderRadius: 8,
                           padding: "8px 16px", fontSize: 13, fontWeight: 600,
                           cursor: nenhum || ocupado ? "not-allowed" : "pointer",
                           display: "inline-flex", alignItems: "center", gap: 6,
                           minHeight: estreito ? 40 : undefined }}>
            {ocupado ? <Loader2 size={14} className="zv-girando" /> : null}
            {ocupado ? "Tirando da fila…" : "Confirmar"}
          </button>
        </div>
        {nenhum && ativos.length > 0 && (
          <div data-ja-tratei-falta-marcar
               style={{ fontSize: 12, color: C.textSecondary, padding: "0 16px 12px", textAlign: "right" }}>
            Marque pelo menos um assunto para confirmar.
          </div>
        )}
      </div>
    </div>
  );
}

export default JaTratei;
