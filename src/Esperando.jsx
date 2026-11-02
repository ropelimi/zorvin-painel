import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Hourglass, MessageCircle, AlertCircle } from "lucide-react";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { rotuloDaHora } from "./agenda.js";
import { diasDesde, DIAS_DO_VERMELHO } from "./espera.js";
import { ehParaMim, rotuloDosMinutos, fraseDoLimite, HA_DIAS_OU_MAIS } from "./esperandoDemais.js";

// ============================================================
//  A TELA "ESPERANDO RESPOSTA" (31/10)
//
//  Aberta pelo ampulheta da barra lateral, pelo ⋮ do topo e pelo "Ver quais"
//  do resumo que aparece ao abrir o Zorvin. Ver "Quem está esperando demais"
//  no CLAUDE.md.
//
//  DUAS PERGUNTAS, e por isso duas ABAS (eram duas seções, uma embaixo da
//  outra, até 02/11 — ver "As duas abas da tela Esperando resposta"):
//
//    - "Clientes sem resposta" — quem escreveu e ainda não recebeu NENHUMA
//      resposta, além do tempo do departamento (30 minutos de expediente, se
//      ninguém mudou). É o cliente novo esperando a primeira palavra;
//    - "Suas conversas esperando há 2 dias ou mais" — as conversas em que
//      VOCÊ é o responsável e o cliente espera há 2 dias de calendário ou
//      mais. Eram 3 até 02/11, a régua do vermelho da lista; o número mora
//      em `DIAS_DAS_ATRASADAS` (`esperandoDemais.js`), e as frases daqui saem
//      dele.
//
//  OS DADOS SÃO DO PAINEL, e esta tela só desenha: o número da barra, o
//  resumo e esta lista têm de dizer a mesma coisa, e três leituras
//  discordariam na hora errada.
//
//  O QUE NÃO VEIO É DITO, e nunca vira "ninguém esperando" — a armadilha nº 2.
//  "Nenhum cliente sem resposta" no lugar de "não consegui ler" faria a
//  pessoa ir embora achando que a fila está em dia.
// ============================================================

/** EM QUAL ABA A TELA ABRE: na primeira que tem o que mostrar.
 *
 *  Os clientes sem resposta vêm primeiro, porque são o que pede ação agora
 *  (é deles o vermelho do número da barra). Se não há nenhum, a tela abre nas
 *  suas conversas, quando há alguma. E A FALHA CONTA COMO TER O QUE MOSTRAR: a
 *  aba que não carregou abre dizendo isso, em vez de a tela abrir na outra e a
 *  falha ficar escondida atrás de um clique.
 *
 *  `null` é "ainda não dá para saber": uma das leituras não chegou. A tela
 *  mostra a primeira aba enquanto isso, e decide quando as respostas chegarem
 *  — se ninguém tiver escolhido uma aba antes. Decidir antes erraria do jeito
 *  que importa: com as suas conversas lidas e os clientes ainda a caminho, a
 *  tela abriria nas suas conversas e esconderia o cliente sem resposta.
 *
 *  `temAvisoDeEspera` tem três estados (a régua de `temVantoro.js`): `null` é
 *  "ainda não sei se o recurso existe", e conta como uma leitura a caminho. */
export function abaDeComeco({ temAvisoDeEspera, semResposta, nSemResposta, podeContarAtrasadas, atrasadas, nAtrasadas }) {
  const temSR = temAvisoDeEspera === true;
  const temAT = Boolean(podeContarAtrasadas);
  const srProntos = temAvisoDeEspera === false || (temSR && Boolean(semResposta?.erro || semResposta?.lido));
  const atProntas = !temAT || Boolean(atrasadas?.erro || atrasadas?.lido);
  const srTem = temSR && Boolean(semResposta?.erro || nSemResposta > 0);
  const atTem = temAT && Boolean(atrasadas?.erro || nAtrasadas > 0);
  if (srTem) return "sem-resposta";
  if (!srProntos) return null;
  if (atTem) return "atrasadas";
  if (!atProntas) return null;
  return temSR ? "sem-resposta" : temAT ? "atrasadas" : null;
}

export default function Esperando({
  C, meuId, advogados = [], semResposta, temAvisoDeEspera, atrasadas, podeContarAtrasadas,
  aoAbrirConversa, aoAtualizar, aoFechar,
}) {
  const advPorId = useMemo(() => Object.fromEntries(advogados.map((a) => [String(a.id), a])), [advogados]);
  const agora = new Date();
  const meusSemResposta = (semResposta?.linhas || []).filter((l) => ehParaMim(l, meuId));
  const minhas = atrasadas?.linhas || [];

  // AS ABAS. O número de cada uma só aparece com a leitura feita: "0"
  // enquanto ela vem, ou depois de ela falhar, diria que não há ninguém.
  const abas = [
    temAvisoDeEspera === true && {
      id: "sem-resposta", titulo: "Clientes sem resposta", forte: "#e53935", texto: C.erroTexto || "#e53935",
      falhou: Boolean(semResposta?.erro), n: semResposta?.erro || !semResposta?.lido ? null : meusSemResposta.length,
    },
    podeContarAtrasadas && {
      id: "atrasadas", titulo: `Suas conversas esperando ${HA_DIAS_OU_MAIS}`, forte: "#d99a1e", texto: C.ambarTexto || "#d99a1e",
      falhou: Boolean(atrasadas?.erro), n: atrasadas?.erro || !atrasadas?.lido ? null : minhas.length,
    },
  ].filter(Boolean);

  // A ABA ESCOLHIDA: a de começo (ver `abaDeComeco`), ou a que a pessoa
  // clicou. Decidida, ela não muda sozinha: uma lista que esvazia na leitura
  // de minuto em minuto não pode tirar a pessoa da aba em que ela está.
  const dados = { temAvisoDeEspera, semResposta, nSemResposta: meusSemResposta.length,
                  podeContarAtrasadas, atrasadas, nAtrasadas: minhas.length };
  const [escolhida, setEscolhida] = useState(() => abaDeComeco(dados));
  const decidida = abaDeComeco(dados);
  useEffect(() => {
    if (escolhida == null && decidida) setEscolhida(decidida);
  }, [escolhida, decidida]);
  const ativa = abas.some((a) => a.id === escolhida) ? escolhida : abas[0]?.id;

  // AS SETAS DO TECLADO andam entre as abas, como em qualquer fileira de abas.
  const andarComAsSetas = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = abas.findIndex((a) => a.id === ativa);
    if (i < 0) return;
    const proxima = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
    e.preventDefault();
    setEscolhida(proxima.id);
    const el = document.getElementById(`aba-espera-${proxima.id}`);
    if (el) el.focus();
  };

  const painel = (id, filhos) => (
    <section role="tabpanel" id={`painel-espera-${id}`} aria-labelledby={`aba-espera-${id}`} data-secao-da-espera={id}
             style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden" }}>
      {filhos}
    </section>
  );
  const nota = (texto, extra = {}) => (
    <div style={{ padding: "10px 12px", fontSize: 13, color: C.textSecondary, lineHeight: 1.5, background: C.panel, ...extra }}>
      {texto}
    </div>
  );
  const falha = (attr, texto) => (
    <div {...{ [attr]: "" }} role="alert"
         style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", fontSize: 13.5,
                  background: "rgba(229,57,53,.10)", color: C.textPrimary, lineHeight: 1.45 }}>
      <AlertCircle size={17} color="#e53935" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{texto}</span>
      <button onClick={aoAtualizar} style={{ border: "none", background: "transparent", color: C.verdeTexto || C.green,
                                             cursor: "pointer", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
        Tentar de novo
      </button>
    </div>
  );
  const linha = (key, attrs, cv, contato, detalhe, corDetalhe, marca) => {
    const cliente = contato ? nomeDoContato(contato) || telefoneLegivel(contato.numero) : "Cliente";
    const tel = advPorId[String(cv.advogado_id)];
    return (
      <button key={key} type="button" {...attrs} onClick={() => aoAbrirConversa && aoAbrirConversa(cv)}
              title="Abrir a conversa"
              style={{ all: "unset", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 10,
                       width: "100%", padding: "10px 12px", borderTop: `1px solid ${C.divider}`, background: C.panel,
                       cursor: "pointer" }}>
        <MessageCircle size={18} color={C.textSecondary} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span data-cliente-que-espera style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.textPrimary,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cliente}</span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 3, fontSize: 12, color: C.textSecondary }}>
            {tel && <span>{tel.nome}</span>}
            <span data-detalhe-da-espera style={{ color: corDetalhe, fontWeight: 600 }}>{tel ? "· " : ""}{detalhe}</span>
            {marca && <span>· {marca}</span>}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div data-tela="esperando" style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg || C.headerBar,
                                        display: "flex", flexDirection: "column", color: C.textPrimary }}>
      <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={aoFechar} title="Voltar às conversas" aria-label="Voltar às conversas"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <ArrowLeft size={20} color={C.textSecondary} />
        </button>
        <Hourglass size={20} color={C.green} />
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Esperando resposta</span>
        <button data-atualizar-espera onClick={aoAtualizar} title="Atualizar" aria-label="Atualizar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <RefreshCw size={18} color={C.textSecondary} />
        </button>
      </div>

      {/* AS ABAS (02/11), fora da parte que rola: a lista de um dia cheio passa
          da altura da tela, e a outra aba tem de continuar a um clique.
          Cada aba diz quantos há nela, para a pessoa saber, sem clicar, se a
          outra tem alguém. E o nome não é cortado: no celular ele quebra em
          linhas (três, a 360), e a aba cresce. */}
      {abas.length > 0 && (
        <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}` }}>
          <div data-abas-da-espera role="tablist" aria-label="O que está esperando resposta" onKeyDown={andarComAsSetas}
               style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", display: "flex", gap: 6 }}>
            {abas.map((a) => {
              const sel = a.id === ativa;
              return (
                <button key={a.id} type="button" role="tab" id={`aba-espera-${a.id}`} aria-selected={sel}
                        aria-controls={`painel-espera-${a.id}`} tabIndex={sel ? 0 : -1}
                        data-aba-da-espera={a.id} data-aba-ativa={sel ? "sim" : undefined}
                        onClick={() => setEscolhida(a.id)}
                        style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                 gap: 8, border: "none", borderBottom: `3px solid ${sel ? a.forte : "transparent"}`,
                                 background: "transparent", color: sel ? a.texto : C.textSecondary, fontSize: 12.5,
                                 fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.3, textAlign: "center",
                                 padding: "11px 4px 8px", marginBottom: -1, cursor: sel ? "default" : "pointer" }}>
                  <span data-nome-da-aba-da-espera style={{ minWidth: 0 }}>{a.titulo.toUpperCase()}</span>
                  {a.falhou ? (
                    <AlertCircle data-aba-da-espera-falhou size={16} color="#e53935" style={{ flexShrink: 0 }}
                                 aria-label="não carregou" />
                  ) : a.n != null && (
                    <span data-contagem-da-espera={a.n}
                          style={{ flexShrink: 0, minWidth: 22, height: 20, padding: "0 6px", borderRadius: 10, boxSizing: "border-box",
                                   display: "inline-flex", alignItems: "center", justifyContent: "center",
                                   fontSize: 11.5, fontWeight: 700, letterSpacing: 0,
                                   background: a.n > 0 ? a.forte : C.divider, color: a.n > 0 ? "#fff" : C.textSecondary }}>
                      {a.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* A CHAVE É A ABA: trocar de aba começa a lista do alto, e não da
          altura em que a outra estava rolada. */}
      <div key={ativa || "nenhuma"} style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 16px 40px" }}>
          {ativa === "sem-resposta" && painel("sem-resposta", <>
              {nota(<>Quem escreveu e ainda não recebeu <b>nenhuma</b> resposta, {meusSemResposta.length
                ? fraseDoLimite(meusSemResposta) : "além do tempo do departamento"} de expediente. Os que têm
                outra pessoa como responsável aparecem só para ela.</>, { borderBottom: "none" })}
              {semResposta?.erro ? falha("data-espera-falhou-sem-resposta", semResposta.erro)
                : !semResposta?.lido ? nota("Procurando…")
                : meusSemResposta.length === 0 ? nota("Nenhum cliente sem resposta além do tempo combinado.", { borderTop: `1px solid ${C.divider}` })
                : meusSemResposta.map((l) => linha(`sr-${l.conversa_id}`, { "data-sem-resposta-linha": l.conversa_id },
                    { id: l.conversa_id, advogado_id: l.advogado_id }, l.contato,
                    `sem resposta há ${rotuloDosMinutos(l.minutos)} de expediente`, "#e53935",
                    `escreveu ${rotuloDaHora(l.aberto_em, agora)}${l.responsavel_id ? "" : " · sem responsável"}`))}
            </>)}

          {ativa === "atrasadas" && painel("atrasadas", <>
              {nota(`As conversas em que você é o responsável e o cliente espera resposta ${HA_DIAS_OU_MAIS}.`)}
              {atrasadas?.erro ? falha("data-espera-falhou-atrasadas", atrasadas.erro)
                : !atrasadas?.lido ? nota("Procurando…")
                : minhas.length === 0 ? nota(`Nenhuma conversa sua esperando ${HA_DIAS_OU_MAIS}.`, { borderTop: `1px solid ${C.divider}` })
                : minhas.map((cv) => {
                    const d = diasDesde(cv.esperando_desde);
                    // A COR É A DO RÓTULO DA LISTA (02/11): âmbar com 2 dias,
                    // vermelho a partir de 3 (`DIAS_DO_VERMELHO`). Com os 3 dias
                    // da aba, toda linha daqui era vermelha; com os 2, a de 2
                    // dias seria vermelha aqui e âmbar na lista.
                    return linha(`at-${cv.id}`, { "data-atrasada-linha": cv.id }, cv, cv.contato,
                      `esperando há ${d} dia${d === 1 ? "" : "s"}`,
                      d >= DIAS_DO_VERMELHO ? "#e53935" : (C.ambarTexto || "#d99a1e"), null);
                  })}
              {atrasadas?.cortado && nota(`Mostrando as ${minhas.length} que esperam há mais tempo.`, { borderTop: `1px solid ${C.divider}` })}
            </>)}

          {abas.length === 0 && (
            <div data-espera-sem-recurso style={{ fontSize: 14, color: C.textSecondary, padding: 16 }}>
              Esta contagem ainda não está instalada neste banco.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
