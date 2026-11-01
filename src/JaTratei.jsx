import React, { useEffect, useRef, useState } from "react";
import { CircleCheck, ListChecks, Loader2, Sparkles, X } from "lucide-react";
import { NOME_DA_SITUACAO } from "./abasDaSituacao.js";

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
//
//  ------------------------------------------------------------
//  NO SCRIPT 028 ELA É A JANELA DO "FINALIZAR" (19/10)
//
//  A mesma checklist, com outro título e outra promessa: o registro do que
//  foi tratado FINALIZA o atendimento, e a conversa vai para "Finalizados".
//  A janela diz o protocolo que está sendo fechado e o que acontece se o
//  cliente escrever de novo — sem isso, "finalizar" se leria como "arquivar",
//  e a pessoa hesitaria em fechar uma conversa que talvez volte.
//
//  ------------------------------------------------------------
//  A IA SUGERE O ASSUNTO (01/11)
//
//  Recomendação nº 5 de 31/10: "A lista já abre com o assunto provável
//  marcado, e a pessoa só confere." Quem sugere é a ponte
//  (`POST /copiloto/assunto`), pela função `sugerir` que o painel passa; sem
//  ela (a ponte de antes, a instalação sem a chave, o lote da faxina), a
//  janela é a de sempre.
//
//  TRÊS REGRAS, e cada uma tem prova:
//
//    - SÓ MARCA SOZINHA SE A PESSOA AINDA NÃO MEXEU na lista. Quem já começou
//      a marcar recebe a sugestão como DICA, com um botão: tirar ou trocar o
//      que ela marcou seria a tela decidindo por cima de quem está decidindo;
//    - NADA É GRAVADO SEM O CLIQUE DA PESSOA. A marcação obrigatória de cima
//      continua valendo: a sugestão só adianta o gesto, e o botão continua
//      sendo o de sempre;
//    - O QUE A IA SUGERIU VAI JUNTO DO CLIQUE (`sugestao_ia`, script 042 da
//      ponte), com `marcou` dizendo se a janela marcou sozinha. É o que dá
//      para medir o acerto depois: sem isso, uma sugestão que erra muito,
//      confirmada por quem conferiu com pressa, viraria o assunto errado no
//      relatório sem ninguém saber.
//
//  A SUGESTÃO É CONFERIDA CONTRA A LISTA DESTA JANELA: o id que não está entre
//  os ativos dela não é marcado. E a falha é dita, sem cor de erro: o Finalizar
//  funciona sem a IA, mas uma janela que simplesmente não sugere se leria como
//  "a IA não soube" — a ausência no lugar da falha.
// ============================================================

// O TETO DO TEXTO, o mesmo do banco (check de 500 no script 009). Aqui ele
// vira contador e limite do campo; sem ele, quem cola um e-mail inteiro só
// descobriria o teto no erro do banco, depois de apertar Confirmar.
const TETO_DA_DESCRICAO = 500;

// ------------------------------------------------------------
//  E ELA FINALIZA VÁRIAS DE UMA VEZ, NA FAXINA DA FILA (01/11)
//
//  `lote` é quantas conversas a faxina marcou. A checklist é a MESMA — os
//  mesmos assuntos para todas, e a marcação continua obrigatória: limpar a
//  fila em lote não pode virar o botão de "sumir com cinquenta conversas" que
//  a regra de cima impede numa só. Muda o que a janela PROMETE: o título diz
//  quantas, e a frase diz que nenhum cliente recebe mensagem.
// ------------------------------------------------------------
export function JaTratei({ C, estreito, nome, dias, esperando = true, finalizar = false, protocolo = null,
                           assuntos, erroDosAssuntos = "", ocupado, erro, aoConfirmar, aoFechar, lote = 0,
                           sugerir = null }) {
  const emLote = finalizar && lote > 1;
  const [escolhidos, setEscolhidos] = useState([]);
  const [descricao, setDescricao] = useState("");

  const ativos = (assuntos || []).filter((a) => a.ativo);

  // ---- A SUGESTÃO DA IA (01/11) — ver o bloco do alto ----
  //
  // `sugestao`: null (não foi pedida), `{ fase: "pedindo" }`,
  // `{ fase: "pronta", ids, motivo }` ou `{ fase: "erro", erro }`.
  const [sugestao, setSugestao] = useState(null);
  const [marcouSozinha, setMarcouSozinha] = useState(false);
  // MEXEU fica num espelho, além do estado: a resposta da IA pode chegar no
  // mesmo instante do clique, e é o espelho que o efeito de marcar lê sem
  // esperar o desenho seguinte. O estado é só para a frase.
  const mexeu = useRef(false);
  const [tocou, setTocou] = useState(false);
  const aplicada = useRef(false);
  const pediu = useRef(false);
  const sugerirRef = useRef(sugerir);
  sugerirRef.current = sugerir;
  // A MARCA DE "A JANELA ESTÁ ABERTA" RELIGA A CADA MONTAGEM: em
  // desenvolvimento o React monta, desmonta e monta de novo, e os espelhos
  // sobrevivem. Só desligando na saída, a resposta que chega depois da
  // segunda montagem seria jogada fora (a lição da faxina, de 01/11).
  const aberta = useRef(true);
  useEffect(() => {
    aberta.current = true;
    return () => { aberta.current = false; };
  }, []);

  const podeSugerir = typeof sugerir === "function" && !emLote;
  useEffect(() => {
    if (!podeSugerir || pediu.current) return;
    pediu.current = true;
    setSugestao({ fase: "pedindo" });
    let promessa;
    try { promessa = Promise.resolve(sugerirRef.current()); } catch (e) { promessa = Promise.reject(e); }
    promessa.then(
      (r) => {
        if (!aberta.current) return;
        const ids = (Array.isArray(r && r.assuntos) ? r.assuntos : [])
          .map((a) => a && a.id).filter((id) => id != null);
        setSugestao({ fase: "pronta", ids, motivo: String((r && r.motivo) || "").trim() });
      },
      (e) => {
        if (!aberta.current) return;
        setSugestao({ fase: "erro", erro: String((e && e.message) || "a ponte não respondeu").trim() });
      });
  }, [podeSugerir]);

  // O QUE DÁ PARA MARCAR: os ids sugeridos que estão entre os ativos desta
  // janela, na ordem da IA. A lista pode chegar depois da sugestão (ela é
  // relida ao abrir), e por isso a conta é refeita a cada desenho.
  const sugeridos = sugestao && sugestao.fase === "pronta"
    ? sugestao.ids.filter((id, i, v) => v.indexOf(id) === i && ativos.some((a) => a.id === id)) : [];
  const chaveDosSugeridos = sugeridos.join("|");
  useEffect(() => {
    if (!chaveDosSugeridos || aplicada.current || mexeu.current) return;
    aplicada.current = true;
    setEscolhidos([...sugeridos]);
    setMarcouSozinha(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDosSugeridos]);
  const nomesSugeridos = sugeridos.map((id) => (ativos.find((a) => a.id === id) || {}).nome).filter(Boolean);
  const faltaMarcarSugerido = sugeridos.some((id) => !escolhidos.includes(id));
  // O QUE VAI AO BANCO JUNTO DO CLIQUE: o que a IA sugeriu, como ela sugeriu
  // (inclusive a lista vazia: "não sei" também se mede), e se a janela marcou
  // sozinha. Sem resposta da IA até o clique, nada.
  const sugestaoParaGravar = sugestao && sugestao.fase === "pronta"
    ? { assuntos: sugestao.ids, marcou: marcouSozinha } : null;

  function usarSugestao() {
    mexeu.current = true;
    setTocou(true);
    setEscolhidos((v) => [...v, ...sugeridos.filter((id) => !v.includes(id))]);
  }
  const nenhum = escolhidos.length === 0;
  // OS ASSUNTOS MARCADOS QUE PEDEM TEXTO — pelos nomes, para a frase dizer
  // qual deles está pedindo ("Descreva o que foi tratado em OUTROS").
  const pedemTexto = ativos.filter((a) => a.pede_descricao && escolhidos.includes(a.id));
  const faltaTexto = pedemTexto.length > 0 && !descricao.trim();
  const bloqueado = nenhum || faltaTexto;

  function alternar(id) {
    mexeu.current = true;
    setTocou(true);
    setEscolhidos((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  // O FUNDO SÓ FECHA O QUE FOI APERTADO NELE (auditoria de 28/10): selecionar
  // a descrição até fora da janela virava um clique no fundo, e os assuntos
  // marcados e o texto iam embora sem pergunta.
  const apertouNoFundo = useRef(false);

  return (
    <div onMouseDown={(e) => { apertouNoFundo.current = e.target === e.currentTarget; }}
         onClick={(e) => { if (apertouNoFundo.current && e.target === e.currentTarget) aoFechar(); }}
         data-ja-tratei-janela data-ja-tratei-modo={finalizar ? "finalizar" : "tratar"}
         data-ja-tratei-lote={emLote ? lote : undefined}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 200,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: estreito ? 12 : 24 }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ background: C.panel, color: C.textPrimary, borderRadius: 12, width: "100%",
                    maxWidth: 420, maxHeight: "86vh", display: "flex", flexDirection: "column",
                    boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
                      borderBottom: `1px solid ${C.divider}` }}>
          {finalizar ? <CircleCheck size={18} color={C.green} /> : <ListChecks size={18} color={C.green} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {emLote ? `Finalizar ${lote} conversas` : finalizar ? "Finalizar" : "Já tratei"}
            </div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nome}
              {finalizar && protocolo && (
                <span data-ja-tratei-protocolo={protocolo}>{" · "}protocolo {protocolo}</span>
              )}
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
          {/* SÓ PROMETE TIRAR DA FILA QUEM ESTÁ NELA. Na conversa respondida
              o "Já tratei" só registra, e a frase diz isso. */}
          {emLote
            ? <>Finaliza as {lote} conversas marcadas, com os mesmos assuntos, <b>sem mandar mensagem a nenhum
                cliente</b>: elas vão para “{NOME_DA_SITUACAO.finalizado}”. Se um cliente escrever de novo, a conversa
                dele volta para “{NOME_DA_SITUACAO.aberto}” com um protocolo novo.</>
            : finalizar
            ? <>Finaliza o atendimento <b>sem mandar mensagem</b>: a conversa vai para “{NOME_DA_SITUACAO.finalizado}”. Marque
                o que foi tratado. Se o cliente escrever de novo, ela volta para “{NOME_DA_SITUACAO.aberto}” com um protocolo novo.</>
            : esperando
            ? <>Tira esta conversa da fila de espera <b>sem mandar mensagem</b>. Marque o que foi tratado.</>
            : <>Esta conversa não está esperando resposta: o “Já tratei” só <b>registra</b> o que foi tratado.</>}
        </div>

        {/* A SUGESTÃO DA IA, entre a frase e a lista: é sobre a lista. Some
            sem lista (não há o que sugerir) e no lote. */}
        {sugestao && ativos.length > 0 && (() => {
          const estado = sugestao.fase === "pedindo" ? "pedindo"
            : sugestao.fase === "erro" ? "erro"
            : !sugeridos.length ? "nenhum"
            : marcouSozinha ? "marcou" : "dica";
          const motivo = sugestao.fase === "pronta" ? sugestao.motivo : "";
          return (
            <div data-sugestao-do-assunto={estado} role="status" aria-live="polite"
                 style={{ margin: "0 16px 10px", padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
                          lineHeight: 1.45, border: `1px solid ${C.divider}`,
                          color: estado === "erro" ? (C.ambarTexto || C.textSecondary) : C.textSecondary,
                          display: "flex", gap: 8, alignItems: "flex-start" }}>
              {estado === "pedindo"
                ? <Loader2 size={14} className="zv-girando" style={{ flexShrink: 0, marginTop: 2 }} />
                : <Sparkles size={14} color={estado === "erro" ? undefined : C.green} style={{ flexShrink: 0, marginTop: 2 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                {estado === "pedindo" && <>A IA está lendo a conversa para sugerir o assunto. Você pode marcar enquanto isso.</>}
                {/* SÓ A FRASE DA PONTE, que já diz o que fazer ("Marque à mão.");
                    repetir aqui daria a mesma instrução duas vezes. */}
                {estado === "erro" && <><b>Sem a sugestão da IA desta vez:</b> {sugestao.erro}</>}
                {estado === "nenhum" && <>A IA não arriscou um assunto desta vez. Marque à mão.</>}
                {(estado === "marcou" || estado === "dica") && (
                  <>
                    <b>Sugestão da IA:</b>{" "}<span data-sugestao-nomes>{nomesSugeridos.join(" e ")}</span>.
                    {estado === "marcou" && !tocou && <> Já veio marcado — confira antes de {finalizar ? "finalizar" : "confirmar"}.</>}
                  </>
                )}
                {!!motivo && estado !== "pedindo" && estado !== "erro" && (
                  <div data-sugestao-motivo style={{ fontSize: 12, marginTop: 2, fontStyle: "italic" }}>{motivo}</div>
                )}
                {(estado === "marcou" || estado === "dica") && faltaMarcarSugerido && (
                  <button type="button" onClick={usarSugestao} data-usar-sugestao
                          style={{ marginTop: 6, border: `1px solid ${C.green}`, background: "transparent", color: C.green,
                                   borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          title="Marca o que a IA sugeriu, sem desmarcar o que você já marcou">
                    Marcar a sugestão
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        <div style={{ overflowY: "auto", padding: "0 16px 4px" }}>
          {ativos.length === 0 && !!erroDosAssuntos && (
            <div data-erro-dos-assuntos style={{ fontSize: 13, color: C.erroTexto, paddingBottom: 12 }}>
              {erroDosAssuntos}
            </div>
          )}
          {ativos.length === 0 && !erroDosAssuntos && (
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
                <span style={{ fontSize: 13.5, fontWeight: marcado ? 600 : 400, flex: 1, minWidth: 0 }}>{a.nome}</span>
                {sugeridos.includes(a.id) && (
                  <span data-sugerido-pela-ia title="Sugerido pela IA"
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600,
                                 color: C.green, flexShrink: 0 }}>
                    <Sparkles size={11} /> IA
                  </span>
                )}
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
          <button onClick={() => aoConfirmar(escolhidos, descricao, sugestaoParaGravar)} disabled={bloqueado || ocupado}
                  data-ja-tratei-confirmar
                  title={nenhum ? "Marque pelo menos um assunto"
                       : faltaTexto ? "Escreva o que foi tratado"
                       : finalizar ? "Finalizar o atendimento" : esperando ? "Tirar da fila de espera" : "Registrar"}
                  style={{ border: "none", background: bloqueado || ocupado ? C.divider : C.green,
                           color: bloqueado || ocupado ? C.textSecondary : "#fff", borderRadius: 8,
                           padding: "8px 16px", fontSize: 13, fontWeight: 600,
                           cursor: bloqueado || ocupado ? "not-allowed" : "pointer",
                           display: "inline-flex", alignItems: "center", gap: 6,
                           minHeight: estreito ? 40 : undefined }}>
            {ocupado ? <Loader2 size={14} className="zv-girando" /> : null}
            {ocupado ? (finalizar ? "Finalizando…" : esperando ? "Tirando da fila…" : "Registrando…")
              : emLote ? `Finalizar ${lote}` : finalizar ? "Finalizar" : "Confirmar"}
          </button>
        </div>
        {nenhum && ativos.length > 0 && (
          <div data-ja-tratei-falta-marcar
               style={{ fontSize: 12, color: C.textSecondary, padding: "0 16px 12px", textAlign: "right" }}>
            Marque pelo menos um assunto para {finalizar ? "finalizar" : "confirmar"}.
          </div>
        )}
        {!nenhum && faltaTexto && (
          <div data-ja-tratei-falta-texto
               style={{ fontSize: 12, color: C.textSecondary, padding: "0 16px 12px", textAlign: "right" }}>
            Escreva o que foi tratado para {finalizar ? "finalizar" : "confirmar"}.
          </div>
        )}
      </div>
    </div>
  );
}

export default JaTratei;
