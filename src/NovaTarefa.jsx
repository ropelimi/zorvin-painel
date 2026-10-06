import React, { useState } from "react";
import { BellPlus, X, Check, AlertCircle } from "lucide-react";
import { valorDoCampo, lerCampo, opcoesRapidas, rotuloLongo, legendaDoAtalho } from "./agenda.js";
import { horaQueNaoServe, TETO_DO_TEXTO } from "./tarefas.js";

// ============================================================
//  A JANELA DA TAREFA — criar e editar (06/10)
//
//  O MESMO DESENHO DA JANELA DE AGENDAR (`EscolherHora`): os quatro atalhos
//  em cartões com a hora escrita embaixo, o dia e a hora em dois campos, e um
//  resumo por extenso antes do botão. É a mesma pergunta ("quando?") e a
//  equipe já aprendeu a responder ali; um segundo jeito de escolher hora
//  seria um segundo jeito de errar a hora.
//
//  TRÊS COISAS, e as três obrigatórias: o que fazer, para quem e quando.
//  "Para quem" começa em VOCÊ — é o caso de todo dia —, e passar para um
//  colega é escolher na lista.
//
//  O BOTÃO ESCREVE PARA QUEM E QUANDO ("Lembrar a Jenifer amanhã às 09:00"):
//  é a última conferência, e um lembrete na pessoa errada não toca para
//  ninguém que vá fazer.
// ============================================================
export default function NovaTarefa({
  C, escuro = false, pessoas = [], meuId, cliente = "", tarefa = null, aoSalvar, aoFechar,
}) {
  const editar = Boolean(tarefa);
  const inicial = tarefa ? valorDoCampo(tarefa.vence_em) : "";
  const [texto, setTexto] = useState(tarefa ? tarefa.texto || "" : "");
  const [paraQuem, setParaQuem] = useState(String((tarefa && tarefa.para_quem) || meuId || ""));
  const [dia, setDia] = useState(inicial ? inicial.slice(0, 10) : "");
  const [hora, setHora] = useState(inicial ? inicial.slice(11, 16) : "");
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState(null);
  const valor = dia && hora ? `${dia}T${hora}` : "";
  const iso = lerCampo(valor);
  const agora = Date.now();
  const escolheuAlgo = Boolean(dia || hora);
  const problemaDaHora = !escolheuAlgo ? null
    : !dia ? "Escolha o dia." : !hora ? "Escolha a hora." : horaQueNaoServe(iso, agora);
  const textoLimpo = texto.trim();
  const pronto = Boolean(iso) && !problemaDaHora && !!textoLimpo && textoLimpo.length <= TETO_DO_TEXTO
    && !!paraQuem && !gravando;

  const souEu = String(paraQuem) === String(meuId);
  const pessoa = pessoas.find((p) => String(p.id) === String(paraQuem));
  const quem = souEu ? "Lembrar você" : `Lembrar ${pessoa ? pessoa.nome.split(/\s+/)[0] : "a pessoa"}`;

  async function confirmar() {
    if (!pronto) return;
    setGravando(true);
    setErro(null);
    try {
      // `aoSalvar` devolve a frase da falha, ou nada. A falha fica AQUI, na
      // janela que continua aberta com o que foi escrito.
      const falhou = await aoSalvar({ texto: textoLimpo, vence_em: iso, para_quem: paraQuem });
      if (falhou) setErro(falhou);
    } catch (e) {
      console.error("Zorvin — salvar tarefa:", e);
      setErro("Não consegui falar com o banco. Confira a internet e tente de novo.");
    } finally {
      setGravando(false);
    }
  }
  const escolher = (data) => {
    const v = valorDoCampo(data);
    setDia(v.slice(0, 10));
    setHora(v.slice(11, 16));
  };

  const verde = C.green;
  const tinta = escuro ? "rgba(0,168,132,.16)" : "rgba(0,168,132,.09)";
  const campo = {
    width: "100%", boxSizing: "border-box", border: `1px solid ${C.divider}`, borderRadius: 8,
    padding: "8px 10px", fontSize: 14, background: C.searchBg || C.panel, color: C.textPrimary,
    colorScheme: escuro ? "dark" : "light", fontFamily: "inherit", outline: "none",
  };
  const rotulo = { display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSecondary,
                   marginBottom: 4, letterSpacing: 0.2 };
  const secao = { fontSize: 11, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.6,
                  textTransform: "uppercase", margin: "14px 0 8px" };
  // Eu primeiro, os colegas em ordem de nome.
  const opcoesDePessoa = [
    ...(meuId ? [{ id: String(meuId), nome: "Eu" }] : []),
    ...pessoas.filter((p) => String(p.id) !== String(meuId)),
  ];
  if (paraQuem && !opcoesDePessoa.some((p) => String(p.id) === String(paraQuem))) {
    opcoesDePessoa.push({ id: String(paraQuem), nome: "Pessoa que não está mais na equipe" });
  }

  return (
    <div data-janela-tarefa data-modo={editar ? "editar" : "nova"} onClick={(e) => e.stopPropagation()}
         style={{ width: 360, maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 60px)", overflowY: "auto",
                  background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 14,
                  boxShadow: "0 12px 36px rgba(0,0,0,.35)", padding: 16, boxSizing: "border-box",
                  color: C.textPrimary, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: tinta, flexShrink: 0,
                       display: "grid", placeItems: "center" }}>
          <BellPlus size={18} color={verde} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: "20px" }}>
            {editar ? "Editar tarefa" : "Nova tarefa"}
          </div>
          {cliente && (
            <div data-tarefa-cliente style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2, overflow: "hidden",
                                              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cliente}
            </div>
          )}
        </div>
        <button onClick={aoFechar} title="Fechar" aria-label="Fechar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex",
                         padding: 4, borderRadius: "50%" }}>
          <X size={18} color={C.textSecondary} />
        </button>
      </div>

      <div style={secao}>O que fazer</div>
      <textarea data-tarefa-texto value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
                maxLength={TETO_DO_TEXTO} autoFocus
                placeholder="Ex.: ligar para confirmar o acordo"
                style={{ ...campo, resize: "vertical", minHeight: 56, lineHeight: 1.4 }} />
      {texto.length > TETO_DO_TEXTO - 50 && (
        <div style={{ fontSize: 11.5, color: C.textSecondary, textAlign: "right", marginTop: 2 }}>
          {texto.length}/{TETO_DO_TEXTO}
        </div>
      )}

      <div style={secao}>Para quem</div>
      <select data-tarefa-para-quem value={paraQuem} onChange={(e) => setParaQuem(e.target.value)} style={campo}>
        {opcoesDePessoa.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>

      <div style={secao}>Quando</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {opcoesRapidas(new Date(agora)).map((o) => {
          const v = valorDoCampo(o.quando);
          const escolhida = v === valor;
          return (
            <button key={o.id} type="button" data-tarefa-rapida={o.id} onClick={() => escolher(o.quando)}
                    aria-pressed={escolhida}
                    style={{ position: "relative", textAlign: "left", cursor: "pointer", borderRadius: 10,
                             padding: "9px 10px", border: `1.5px solid ${escolhida ? verde : C.divider}`,
                             background: escolhida ? tinta : "transparent", color: C.textPrimary }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, paddingRight: 14 }}>{o.rotulo}</span>
              <span style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                {legendaDoAtalho(o.quando, new Date(agora))}
              </span>
              {escolhida && <Check size={14} color={verde} style={{ position: "absolute", top: 8, right: 8 }} />}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8, marginTop: 10 }}>
        <label>
          <span style={rotulo}>Dia</span>
          <input data-tarefa-dia type="date" value={dia} min={valorDoCampo(new Date(agora)).slice(0, 10)}
                 onChange={(e) => setDia(e.target.value)} style={campo} />
        </label>
        <label>
          <span style={rotulo}>Hora</span>
          <input data-tarefa-hora type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } }}
                 style={campo} />
        </label>
      </div>

      {problemaDaHora ? (
        <div data-tarefa-problema
             style={{ display: "flex", alignItems: "center", gap: 6, color: "#e53935", fontSize: 12.5, marginTop: 10 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {problemaDaHora}
        </div>
      ) : iso && (
        <div data-tarefa-resumo
             style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "9px 11px",
                      borderRadius: 10, background: tinta, color: C.textPrimary, fontSize: 13 }}>
          <BellPlus size={15} color={verde} style={{ flexShrink: 0 }} />
          <span>{souEu ? "Você vai ser avisado" : `${pessoa ? pessoa.nome : "A pessoa"} vai ser avisada`} <b>{rotuloLongo(iso, new Date(agora))}</b></span>
        </div>
      )}

      {erro && (
        <div data-tarefa-erro role="alert"
             style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "#e53935", fontSize: 12.5, marginTop: 10, lineHeight: 1.4 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {erro}
        </div>
      )}

      <button data-tarefa-confirmar onClick={confirmar} disabled={!pronto}
              style={{ marginTop: 14, width: "100%", border: "none", borderRadius: 10, padding: "11px 12px",
                       fontSize: 14.5, fontWeight: 700, cursor: pronto ? "pointer" : "default",
                       background: verde, color: "#fff", opacity: pronto ? 1 : 0.4 }}>
        {gravando ? "Salvando…"
          : !textoLimpo ? "Escreva o que fazer"
          : !iso || problemaDaHora ? "Escolha quando"
          : editar ? "Salvar alterações"
          : `${quem} ${rotuloLongo(iso, new Date(agora))}`}
      </button>
    </div>
  );
}
