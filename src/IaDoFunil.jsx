import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { comOCodigo, semATabela } from "./gravar.js";
import { Chave } from "./Chave.jsx";
import { useEstadoDoCopiloto, avisoDaIaDoFunil } from "./copiloto.js";
import { Bot, Loader2, RefreshCw } from "lucide-react";

// ============================================================
//  A IA MOVE O FUNIL — a chave de cada funil (02/11)
//
//  Pedido do Rodrigo: "funil movido pela IA". Decidido com ele: a IA muda a
//  etapa SOZINHA, o cartão diz que foi ela e por quê, e qualquer pessoa
//  desfaz arrastando de volta. Quem lê e decide é a PONTE (script 044 e a
//  rodada `moverOFunilComAIA`); esta peça só liga e desliga, POR FUNIL — o de
//  um departamento ou o de um telefone com funil próprio.
//
//  O QUE ELA DIZ, e de onde sai cada coisa:
//    - a chave: `zorvin_funis.ia_ligada` do funil (o do departamento só ganha
//      a sua linha na primeira vez que alguém liga — sem linha, desligada);
//    - "a IA vai ler os N clientes deste funil": o N sai do banco
//      (`zorvin_ia_do_funil` devolve), e não de uma conta daqui;
//    - quando a PONTE não move o funil (a de antes desta função, sem a chave
//      da Anthropic, ou com FUNIL_IA=desligada), a frase diz qual, e a chave
//      continua funcionando: ela fica guardada, e vale quando a ponte puder.
//      Esconder a chave por isso deixaria quem administra sem saber por quê.
//
//  SEM O 044 ESTA PEÇA NÃO APARECE: a coluna `ia_ligada` que falta (ou a
//  tabela, sem o 043) é o único "não tem". Qualquer outro tropeço da leitura
//  é DITO (armadilha nº 2), e a
//  chave não é desenhada — desligada por falha, ela convidaria a ligar o que
//  talvez já esteja ligado.
// ============================================================

/** O estado da chave do funil: `null` lendo; `{ existe: false }` sem o 044;
 *  `{ existe: true, ligada, erro }`. */
async function lerAChave(funil) {
  let q = supabase.from("zorvin_funis").select("id, departamento_id, advogado_id, ativo, ia_ligada, ia_mudada_em")
    .eq("departamento_id", funil.departamentoId);
  q = funil.telefoneId ? q.eq("advogado_id", funil.telefoneId) : q.is("advogado_id", null);
  const { data, error } = await q;
  if (error) {
    // SEM O 044 (a coluna) OU SEM O 043 (a tabela), a peça não existe.
    const semColuna = String(error.code) === "42703" || /ia_ligada/.test(String(error.message || ""));
    if (semColuna || semATabela(error)) return { existe: false };
    return { existe: true, ligada: null, erro: comOCodigo("Não consegui saber se a IA cuida deste funil.", error, "IA do funil") };
  }
  const linha = (data || [])[0];
  return { existe: true, ligada: Boolean(linha && linha.ia_ligada), erro: "" };
}

export function IaDoFunil({ cx, C, funil, nomeDoFunil, aoAvisar }) {
  const [chave, setChave] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState("");
  const estado = useEstadoDoCopiloto();
  const aviso = avisoDaIaDoFunil(estado);
  const chaveDoFunil = funil ? `${funil.departamentoId}|${funil.telefoneId || ""}` : "";

  // A RESPOSTA MAIS NOVA VENCE: trocando de funil no meio da leitura, a chave
  // do funil de antes não pode aparecer sob o nome do novo.
  // O funil entra por espelho, e a função muda só quando o funil é OUTRO: um
  // objeto novo a cada desenho, com os mesmos números, não relê nada.
  const pedido = useRef(0);
  const funilRef = useRef(funil);
  funilRef.current = funil;
  const ler = useCallback(async () => {
    const f = funilRef.current;
    if (!f) return;
    const meu = ++pedido.current;
    const r = await lerAChave(f);
    if (meu === pedido.current) setChave(r);
  }, [chaveDoFunil]);
  useEffect(() => { setChave(null); setFeito(""); ler(); }, [ler]);

  async function pedir({ ligar, deNovo }) {
    setOcupado(true); aoAvisar(""); setFeito("");
    const r = await supabase.rpc("zorvin_ia_do_funil", {
      p_departamento: funil.departamentoId, p_telefone: funil.telefoneId || null, p_ligar: ligar, p_de_novo: !!deNovo,
    });
    setOcupado(false);
    if (r.error) {
      aoAvisar(comOCodigo(ligar ? "Não consegui ligar a IA neste funil." : "Não consegui desligar a IA neste funil.",
                          r.error, "IA do funil"));
      ler();
      return;
    }
    const d = r.data || {};
    const n = Number(d.clientes) || 0;
    if (!ligar) {
      setFeito("A IA não move mais os clientes deste funil. O que ela já fez fica como está, com o porquê no cartão.");
    } else {
      setFeito(n
        ? `${deNovo ? "A IA vai ler de novo" : "Ligada. A IA vai ler"} ${n === 1 ? "o cliente" : `os ${n} clientes`} deste funil, os de conversa mais recente primeiro — uns cinco a cada meio minuto.`
        : "Ligada. Este funil ainda não tem cliente com conversa para a IA ler.");
    }
    ler();
  }

  if (!funil || !chave || chave.existe === false) return null;

  const fraco = { ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}`, whiteSpace: "nowrap" };
  return (
    <div data-ia-do-funil={chave.ligada === true ? "ligada" : chave.ligada === false ? "desligada" : "nao-sei"}
         style={{ borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}`, padding: "10px 0", margin: "4px 0 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Bot size={16} color={C.textSecondary} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, flex: "1 1 220px" }}>
          A IA move os clientes de {nomeDoFunil || "deste funil"} de etapa
        </span>
        {chave.ligada !== null && (
          <span data-chave-da-ia>
            <Chave ligada={chave.ligada} rotulo={`A IA move os clientes de ${nomeDoFunil || "deste funil"}`}
                   aoTrocar={() => !ocupado && pedir({ ligar: !chave.ligada })} />
          </span>
        )}
        {ocupado && <Loader2 size={14} className="zv-girando" />}
      </div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginTop: 6 }}>
        Ligada, a IA lê a conversa de cada cliente quando ela sossega e muda a etapa sozinha. O cartão diz que foi
        ela e por quê, e quem discordar arrasta de volta. Ela não desfaz o que uma pessoa decidiu sem algo novo na
        conversa. A descrição de cada etapa, logo abaixo, é o que ela lê para saber o que a etapa quer dizer.
      </div>
      {chave.erro && (
        <div data-falha-da-ia-do-funil style={{ fontSize: 12.5, color: C.ambarTexto || "#b26a00", marginTop: 6 }}>{chave.erro}</div>
      )}
      {aviso && (
        <div data-aviso-da-ponte-do-funil style={{ fontSize: 12.5, color: C.ambarTexto || "#b26a00", marginTop: 6, lineHeight: 1.5 }}>
          {aviso}
        </div>
      )}
      {chave.ligada === true && (
        <div style={{ marginTop: 8 }}>
          <button style={fraco} disabled={ocupado} onClick={() => pedir({ ligar: true, deNovo: true })} data-ia-ler-de-novo>
            <RefreshCw size={14} /> Ler todos de novo
          </button>
          <span style={{ fontSize: 12, color: C.textSecondary, marginLeft: 8 }}>depois de mudar as etapas ou as descrições</span>
        </div>
      )}
      {feito && (
        <div data-ia-do-funil-feito role="status"
             style={{ fontSize: 13, color: C.textPrimary, borderLeft: `3px solid ${C.green || "#00a884"}`,
                      padding: "6px 10px", marginTop: 8, lineHeight: 1.5 }}>
          {feito}
        </div>
      )}
    </div>
  );
}

export default IaDoFunil;
