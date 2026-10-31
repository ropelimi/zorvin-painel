import React, { useMemo } from "react";
import { ArrowLeft, RefreshCw, Hourglass, MessageCircle, AlertCircle } from "lucide-react";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { rotuloDaHora } from "./agenda.js";
import { diasDesde } from "./espera.js";
import { ehParaMim, rotuloDosMinutos, fraseDoLimite } from "./esperandoDemais.js";

// ============================================================
//  A TELA "ESPERANDO RESPOSTA" (31/10)
//
//  Aberta pelo ampulheta da barra lateral, pelo ⋮ do topo e pelo "Ver quais"
//  do resumo que aparece ao abrir o Zorvin. Ver "Quem está esperando demais"
//  no CLAUDE.md.
//
//  DUAS PERGUNTAS, e por isso duas seções:
//
//    - "Clientes sem resposta" — quem escreveu e ainda não recebeu NENHUMA
//      resposta, além do tempo do departamento (30 minutos de expediente, se
//      ninguém mudou). É o cliente novo esperando a primeira palavra;
//    - "Suas conversas esperando há 3 dias ou mais" — as conversas em que
//      VOCÊ é o responsável e o cliente espera há 3 dias de calendário ou
//      mais: a régua do rótulo vermelho da lista e do relatório por
//      responsável.
//
//  OS DADOS SÃO DO PAINEL, e esta tela só desenha: o número da barra, o
//  resumo e esta lista têm de dizer a mesma coisa, e três leituras
//  discordariam na hora errada.
//
//  O QUE NÃO VEIO É DITO, e nunca vira "ninguém esperando" — a armadilha nº 2.
//  "Nenhum cliente sem resposta" no lugar de "não consegui ler" faria a
//  pessoa ir embora achando que a fila está em dia.
// ============================================================

export default function Esperando({
  C, meuId, advogados = [], semResposta, temAvisoDeEspera, atrasadas, podeContarAtrasadas,
  aoAbrirConversa, aoAtualizar, aoFechar,
}) {
  const advPorId = useMemo(() => Object.fromEntries(advogados.map((a) => [String(a.id), a])), [advogados]);
  const agora = new Date();
  const meusSemResposta = (semResposta?.linhas || []).filter((l) => ehParaMim(l, meuId));
  const minhas = atrasadas?.linhas || [];

  const secao = (id, titulo, cor, n, filhos) => (
    <section data-secao-da-espera={id}
             style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <header style={{ padding: "9px 12px", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3,
                       color: cor, background: C.headerBar }}>
        {titulo.toUpperCase()}{n !== null && <span data-contagem-da-espera style={{ fontWeight: 600 }}> ({n})</span>}
      </header>
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

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 16px 40px" }}>
          {temAvisoDeEspera === true && secao("sem-resposta", "Clientes sem resposta", "#e53935",
            semResposta?.erro ? null : meusSemResposta.length, <>
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

          {podeContarAtrasadas && secao("atrasadas", "Suas conversas esperando há 3 dias ou mais", "#d99a1e",
            atrasadas?.erro ? null : minhas.length, <>
              {nota("As conversas em que você é o responsável e o cliente espera resposta há 3 dias ou mais.")}
              {atrasadas?.erro ? falha("data-espera-falhou-atrasadas", atrasadas.erro)
                : !atrasadas?.lido ? nota("Procurando…")
                : minhas.length === 0 ? nota("Nenhuma conversa sua esperando há 3 dias ou mais.", { borderTop: `1px solid ${C.divider}` })
                : minhas.map((cv) => {
                    const d = diasDesde(cv.esperando_desde);
                    return linha(`at-${cv.id}`, { "data-atrasada-linha": cv.id }, cv, cv.contato,
                      `esperando há ${d} dia${d === 1 ? "" : "s"}`, "#e53935", null);
                  })}
              {atrasadas?.cortado && nota(`Mostrando as ${minhas.length} que esperam há mais tempo.`, { borderTop: `1px solid ${C.divider}` })}
            </>)}

          {temAvisoDeEspera !== true && !podeContarAtrasadas && (
            <div data-espera-sem-recurso style={{ fontSize: 14, color: C.textSecondary, padding: 16 }}>
              Esta contagem ainda não está instalada neste banco.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
