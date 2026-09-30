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
//
//  ------------------------------------------------------------
//  O "OUTROS" PEDE O QUE FOI TRATADO (30/09)
//
//  "OUTROS" sozinho não diz nada: um relatório com "OUTROS: 40" é a mesma
//  pergunta de antes com um número em cima. Então o assunto marcado com
//  `pede_descricao` (script 009) abre um campo, e o botão só liga com ele
//  preenchido. Quem decide qual assunto pede é a MARCA do banco, e não o nome
//  "OUTROS" escrito aqui — quem compra o programa pode chamá-lo de outra
//  coisa, ou querer descrição em mais de um.
// ============================================================

// O TETO DO TEXTO, o mesmo do banco (check de 500 no script 009). Aqui ele
// vira contador e limite do campo; sem ele, quem cola um e-mail inteiro só
// descobriria o teto no erro do banco, depois de apertar Confirmar.
const TETO_DA_DESCRICAO = 500;

export function JaTratei({ C, estreito, nome, dias, assuntos, ocupado, erro, aoConfirmar, aoFechar }) {
  const [escolhidos, setEscolhidos] = useState([]);
  const [descricao, setDescricao] = useState("");

  const ativos = (assuntos || []).filter((a) => a.ativo);
  const nenhum = escolhidos.length === 0;
  // OS ASSUNTOS MARCADOS QUE PEDEM TEXTO — pelos nomes, para a frase dizer
  // qual deles está pedindo ("Descreva o que foi tratado em OUTROS").
  const pedemTexto = ativos.filter((a) => a.pede_descricao && escolhidos.includes(a.id));
  const faltaTexto = pedemTexto.length > 0 && !descricao.trim();
  const bloqueado = nenhum || faltaTexto;

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

        {/* O CAMPO SÓ APARECE COM O ASSUNTO MARCADO, e não sempre: um campo
            de texto em toda janela viraria "opcional" na cabeça de quem usa,
            e o que era obrigatório no OUTROS passaria a ser ignorado nele
            também. */}
        {pedemTexto.length > 0 && (
          <div style={{ padding: "4px 16px 10px" }}>
            <label htmlFor="ja-tratei-descricao"
                   style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
              O que foi tratado em {pedemTexto.map((a) => a.nome).join(" e ")}?
            </label>
            <textarea id="ja-tratei-descricao" data-ja-tratei-descricao autoFocus
                      value={descricao} maxLength={TETO_DA_DESCRICAO} rows={3}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex.: cliente pediu a segunda via do boleto; enviado por e-mail."
                      style={{ width: "100%", boxSizing: "border-box", resize: "vertical",
                               border: `1px solid ${faltaTexto ? C.divider : C.green}`, borderRadius: 8,
                               padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit",
                               background: C.panel, color: C.textPrimary, outline: "none" }} />
            <div style={{ fontSize: 11.5, color: C.textSecondary, textAlign: "right", marginTop: 2 }}>
              {descricao.length}/{TETO_DA_DESCRICAO}
            </div>
          </div>
        )}

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
          <button onClick={() => aoConfirmar(escolhidos, descricao)} disabled={bloqueado || ocupado}
                  data-ja-tratei-confirmar
                  title={nenhum ? "Marque pelo menos um assunto"
                       : faltaTexto ? "Escreva o que foi tratado" : "Tirar da fila de espera"}
                  style={{ border: "none", background: bloqueado || ocupado ? C.divider : C.green,
                           color: bloqueado || ocupado ? C.textSecondary : "#fff", borderRadius: 8,
                           padding: "8px 16px", fontSize: 13, fontWeight: 600,
                           cursor: bloqueado || ocupado ? "not-allowed" : "pointer",
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
        {!nenhum && faltaTexto && (
          <div data-ja-tratei-falta-texto
               style={{ fontSize: 12, color: C.textSecondary, padding: "0 16px 12px", textAlign: "right" }}>
            Escreva o que foi tratado para confirmar.
          </div>
        )}
      </div>
    </div>
  );
}

export default JaTratei;
