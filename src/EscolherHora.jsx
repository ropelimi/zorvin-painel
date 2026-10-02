import React, { useState } from "react";
import { Clock, X } from "lucide-react";
import { valorDoCampo, lerCampo, porQueNaoServe, opcoesRapidas, rotuloDaHora } from "./agenda.js";

// ============================================================
//  ESCOLHER A HORA DE UMA MENSAGEM AGENDADA
//
//  UMA JANELA SÓ para os dois caminhos — o texto da caixa de escrever e o
//  anexo da prévia. Duas cópias divergiriam no primeiro conserto, e divergir
//  aqui é uma das duas aceitar uma hora que já passou.
//
//  O BOTÃO DE CONFIRMAR ESCREVE A HORA ("Agendar para amanhã às 09:00"), e
//  não só "Agendar": é a última chance de conferir, e um clique numa hora
//  errada vira uma mensagem que sai sem ninguém olhar.
//
//  A HORA QUE NÃO SERVE É DITA, e o botão fica desligado: uma hora no passado
//  aceita em silêncio seria uma mensagem saindo AGORA, que é o contrário do
//  que a pessoa pediu.
// ============================================================
export default function EscolherHora({ C, titulo = "Agendar mensagem", aoEscolher, aoFechar }) {
  const [valor, setValor] = useState("");
  const iso = lerCampo(valor);
  const agora = Date.now();
  const problema = valor ? porQueNaoServe(iso, agora) : null;
  const pronto = Boolean(iso) && !problema;
  const confirmar = () => { if (pronto) aoEscolher(iso); };
  return (
    <div data-escolher-hora onClick={(e) => e.stopPropagation()}
         style={{ width: 300, maxWidth: "calc(100vw - 24px)", background: C.panel,
                  border: `1px solid ${C.divider}`, borderRadius: 12,
                  boxShadow: "0 8px 28px rgba(0,0,0,.3)", padding: "12px 14px", boxSizing: "border-box",
                  color: C.textPrimary, textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Clock size={17} color={C.green} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{titulo}</span>
        <button onClick={aoFechar} title="Fechar" aria-label="Fechar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 2 }}>
          <X size={17} color={C.textSecondary} />
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {opcoesRapidas(new Date(agora)).map((o) => {
          const v = valorDoCampo(o.quando);
          const escolhida = v === valor;
          return (
            <button key={o.id} data-agenda-rapida={o.id} onClick={() => setValor(v)}
                    style={{ border: `1px solid ${escolhida ? C.green : C.divider}`,
                             background: escolhida ? C.green : "transparent",
                             color: escolhida ? "#fff" : C.textPrimary, borderRadius: 16,
                             padding: "5px 10px", fontSize: 12.5, cursor: "pointer" }}>
              {o.rotulo}
            </button>
          );
        })}
      </div>
      <label style={{ display: "block", fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>
        Ou escolha o dia e a hora
      </label>
      <input data-agenda-campo type="datetime-local" value={valor}
             min={valorDoCampo(new Date(agora + 60 * 1000))}
             onChange={(e) => setValor(e.target.value)}
             onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } }}
             style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.divider}`,
                      borderRadius: 8, padding: "7px 8px", fontSize: 14, background: C.searchBg || C.panel,
                      color: C.textPrimary, colorScheme: "light dark" }} />
      {problema && (
        <div data-agenda-problema style={{ color: "#e53935", fontSize: 12.5, marginTop: 6 }}>{problema}</div>
      )}
      <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 8, lineHeight: 1.45 }}>
        Sai nessa hora mesmo que o cliente escreva antes. Até lá, qualquer pessoa da
        equipe pode cancelar.
      </div>
      <button data-agenda-confirmar onClick={confirmar} disabled={!pronto}
              style={{ marginTop: 10, width: "100%", border: "none", borderRadius: 8, padding: "9px 12px",
                       fontSize: 14, fontWeight: 600, cursor: pronto ? "pointer" : "default",
                       background: pronto ? C.green : C.divider, color: pronto ? "#fff" : C.textSecondary }}>
        {pronto ? `Agendar para ${rotuloDaHora(iso)}` : "Agendar"}
      </button>
    </div>
  );
}
