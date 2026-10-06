import React, { useState } from "react";
import { Clock, X, Check, Info, AlertCircle } from "lucide-react";
import { valorDoCampo, lerCampo, porQueNaoServe, opcoesRapidas, rotuloDaHora,
         rotuloLongo, legendaDoAtalho } from "./agenda.js";

// ============================================================
//  A JANELA DA MENSAGEM AGENDADA — agendar, e (05/10) editar
//
//  UMA JANELA SÓ para os três caminhos — o texto da caixa de escrever, o
//  anexo da prévia e a edição de uma agendada. Duas cópias divergiriam no
//  primeiro conserto, e divergir aqui é uma delas aceitar uma hora que já
//  passou.
//
//  O DESENHO (pedido do Rodrigo em 05/10, com a foto da primeira versão):
//
//    - os atalhos viraram CARTÕES com a hora escrita embaixo ("amanhã, 09:00"):
//      "Amanhã às 9h" quebrava em duas linhas e a pílula não dizia o dia;
//    - o dia e a hora são DOIS campos, com rótulo: o campo único do navegador
//      aparecia como "dd/mm/aaaa --:--", que ninguém sabe se é para digitar ou
//      clicar, e no tema escuro o ícone do calendário sumia (`colorScheme`);
//    - escolhida a hora, um RESUMO verde diz por extenso quando sai
//      ("Sai sexta-feira, 10/10, às 09:00") — é a última conferência antes de
//      agendar, e por isso fica entre a escolha e o botão.
//
//  O BOTÃO DE CONFIRMAR CONTINUA ESCREVENDO A HORA ("Agendar para amanhã às
//  09:00"): um clique numa hora errada vira uma mensagem que sai sem ninguém
//  olhar. E a hora que não serve é DITA, com o botão desligado — aceita
//  calada, a mensagem sairia agora.
//
//  EDITAR mostra a caixa do texto (ou da legenda, no anexo) e já abre com a
//  hora que estava marcada. Texto de mensagem não pode ficar vazio; legenda
//  de anexo pode.
// ============================================================
export default function EscolherHora({
  C, escuro = false, titulo = "Agendar mensagem", previa = "",
  editar = false, textoInicial = "", quandoInicial = null, rotuloDoTexto = "Mensagem",
  textoObrigatorio = true, aoEscolher, aoFechar,
}) {
  const inicial = quandoInicial ? valorDoCampo(quandoInicial) : "";
  const [dia, setDia] = useState(inicial ? inicial.slice(0, 10) : "");
  const [hora, setHora] = useState(inicial ? inicial.slice(11, 16) : "");
  const [texto, setTexto] = useState(textoInicial || "");
  const valor = dia && hora ? `${dia}T${hora}` : "";
  const iso = lerCampo(valor);
  const agora = Date.now();
  const escolheuAlgo = Boolean(dia || hora);
  const problema = !escolheuAlgo ? null
    : !dia ? "Escolha o dia." : !hora ? "Escolha a hora." : porQueNaoServe(iso, agora);
  const faltaTexto = editar && textoObrigatorio && !texto.trim();
  const pronto = Boolean(iso) && !problema && !faltaTexto;
  const confirmar = () => { if (pronto) aoEscolher(iso, texto.trim()); };
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

  return (
    <div data-escolher-hora data-modo={editar ? "editar" : "agendar"} onClick={(e) => e.stopPropagation()}
         style={{ width: 340, maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 100px)", overflowY: "auto",
                  background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 14,
                  boxShadow: "0 12px 36px rgba(0,0,0,.35)", padding: 16, boxSizing: "border-box",
                  color: C.textPrimary, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: tinta, flexShrink: 0,
                       display: "grid", placeItems: "center" }}>
          <Clock size={18} color={verde} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: "20px" }}>{titulo}</div>
          {previa && !editar && (
            <div data-agenda-previa
                 style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {previa}
            </div>
          )}
        </div>
        <button onClick={aoFechar} title="Fechar" aria-label="Fechar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex",
                         padding: 4, borderRadius: "50%" }}>
          <X size={18} color={C.textSecondary} />
        </button>
      </div>

      {editar && (
        <>
          <div style={secao}>{rotuloDoTexto}</div>
          <textarea data-agenda-texto value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
                    placeholder={textoObrigatorio ? "Escreva a mensagem" : "Sem legenda"}
                    style={{ ...campo, resize: "vertical", minHeight: 70, lineHeight: 1.4 }} />
          {faltaTexto && (
            <div data-agenda-problema style={{ color: "#e53935", fontSize: 12.5, marginTop: 4 }}>
              A mensagem não pode ficar vazia — para não mandar, use Cancelar.
            </div>
          )}
        </>
      )}

      <div style={secao}>Quando enviar</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {opcoesRapidas(new Date(agora)).map((o) => {
          const v = valorDoCampo(o.quando);
          const escolhida = v === valor;
          return (
            <button key={o.id} type="button" data-agenda-rapida={o.id} onClick={() => escolher(o.quando)}
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px",
                    color: C.textSecondary, fontSize: 11.5 }}>
        <span style={{ flex: 1, height: 1, background: C.divider }} />
        ou escolha o dia e a hora
        <span style={{ flex: 1, height: 1, background: C.divider }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
        <label>
          <span style={rotulo}>Dia</span>
          <input data-agenda-dia type="date" value={dia} min={valorDoCampo(new Date(agora)).slice(0, 10)}
                 onChange={(e) => setDia(e.target.value)} style={campo} />
        </label>
        <label>
          <span style={rotulo}>Hora</span>
          <input data-agenda-hora type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } }}
                 style={campo} />
        </label>
      </div>

      {problema ? (
        <div data-agenda-problema
             style={{ display: "flex", alignItems: "center", gap: 6, color: "#e53935", fontSize: 12.5, marginTop: 10 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {problema}
        </div>
      ) : iso && (
        <div data-agenda-resumo
             style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "9px 11px",
                      borderRadius: 10, background: tinta, color: C.textPrimary, fontSize: 13 }}>
          <Clock size={15} color={verde} style={{ flexShrink: 0 }} />
          <span>Sai <b>{rotuloLongo(iso, new Date(agora))}</b></span>
        </div>
      )}

      <div style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12, color: C.textSecondary,
                    marginTop: 12, lineHeight: 1.45 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Sai nessa hora mesmo que o cliente escreva antes. Até lá, qualquer pessoa da equipe pode
          editar ou cancelar.</span>
      </div>

      <button data-agenda-confirmar onClick={confirmar} disabled={!pronto}
              style={{ marginTop: 14, width: "100%", border: "none", borderRadius: 10, padding: "11px 12px",
                       fontSize: 14.5, fontWeight: 700, cursor: pronto ? "pointer" : "default",
                       background: verde, color: "#fff", opacity: pronto ? 1 : 0.4 }}>
        {!pronto ? (editar ? "Salvar alterações" : "Escolha quando enviar")
          : editar ? `Salvar — sai ${rotuloDaHora(iso)}` : `Agendar para ${rotuloDaHora(iso)}`}
      </button>
    </div>
  );
}
