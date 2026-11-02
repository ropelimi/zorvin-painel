import React, { useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo } from "./gravar.js";
import { VARIAVEIS, preencherVariaveis, usaVariaveis, variaveisDesconhecidas } from "./variaveis.js";
import { fraseDaRegra, conferirRegra, DIAS_NO_MINIMO, DIAS_NO_MAXIMO, TETO_DA_MENSAGEM } from "./acompanhamento.js";
import { AlarmClock, Plus, Pencil, Trash2, Check, Loader2, AlertCircle } from "lucide-react";

// ============================================================
//  OS LEMBRETES DE ACOMPANHAMENTO DE UMA ETAPA (02/11)
//
//  Pedido do Rodrigo: "acompanhamento por etapa do funil". Decidido com ele:
//  LEMBRAR A EQUIPE. Em cada etapa, depois de quantos dias sem resposta do
//  cliente quem cuida dele recebe uma tarefa, e com qual mensagem pronta. A
//  pessoa abre, confere e manda: nada sai para o cliente sozinho.
//
//  Quem decide QUANDO o lembrete nasce é o banco (script 045 da ponte): o
//  relógio, o expediente, o teto por pessoa, a regra que só vale para o que
//  vence depois de ela existir. Esta peça só escreve as regras.
//
//  A MENSAGEM É GUARDADA COM AS VARIÁVEIS, nunca preenchida — a régua das
//  mensagens rápidas: ela vale para todos os clientes da etapa, e o nome de
//  cada um entra quando a pessoa abre a conversa pelo lembrete. A prévia é a
//  mesma conta, com a cliente de exemplo das rápidas.
// ============================================================

const CLIENTE_DE_EXEMPLO = "MARIA APARECIDA DOS SANTOS";

export function AcompanhamentoDaEtapa({ cx, C, etapa, regras = [], meuNome = "", aoMudou }) {
  const [form, setForm] = useState(null);   // { id?, dias, texto }
  const [ocupado, setOcupado] = useState(false);
  // O ERRO MORA AQUI, ao lado do botão que o causou, e não na faixa do alto
  // da administração: a lista das etapas é longa, e a frase lá em cima ficaria
  // fora da vista — o "Salvar" pareceria não fazer nada.
  const [erro, setErro] = useState("");
  const caixa = useRef(null);
  const recusado = "o banco não deixou. Só quem administra o Zorvin pode mexer nos lembretes de acompanhamento.";
  const daEtapa = [...regras].sort((a, b) => (Number(a.dias) || 0) - (Number(b.dias) || 0));
  const botaoFraco = { ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}`, whiteSpace: "nowrap" };

  // A VARIÁVEL ENTRA ONDE ESTÁ O CURSOR, e não no fim — a régua das rápidas.
  function porVariavel(chave) {
    const campo = caixa.current;
    const texto = (form && form.texto) || "";
    const marca = `{${chave}}`;
    const ini = campo ? campo.selectionStart : texto.length;
    const fim = campo ? campo.selectionEnd : texto.length;
    setForm((f) => ({ ...f, texto: texto.slice(0, ini) + marca + texto.slice(fim) }));
    setTimeout(() => {
      const c = caixa.current;
      if (!c) return;
      c.focus();
      c.setSelectionRange(ini + marca.length, ini + marca.length);
    }, 0);
  }

  async function salvar() {
    const recusa = conferirRegra(form, daEtapa.filter((r) => r.id !== form.id));
    if (recusa) { setErro(recusa); return; }
    const linha = { dias: Number(form.dias), texto: form.texto };
    setOcupado(true); setErro("");
    const r = form.id
      ? await supabase.from("zorvin_acompanhamentos").update(linha).eq("id", form.id).select("id")
      : await supabase.from("zorvin_acompanhamentos").insert({ etapa_id: etapa.id, ...linha }).select("id");
    setOcupado(false);
    if (r.error) {
      // OS MESMOS DIAS NA MESMA ETAPA (23505): a tela confere antes, e o banco
      // confere de novo — outra pessoa pode ter criado o mesmo no meio.
      setErro(String(r.error.code) === "23505"
        ? `Já existe um lembrete de ${linha.dias} ${linha.dias === 1 ? "dia" : "dias"} nesta etapa.`
        : comOCodigo(form.id ? "Não consegui salvar o lembrete." : "Não consegui criar o lembrete.",
                     r.error, "lembrete de acompanhamento"));
      return;
    }
    if (naoGravouNada(r)) { setErro(`Não salvou: ${recusado}`); return; }
    setForm(null);
    if (aoMudou) aoMudou();
  }

  // APAGAR PERGUNTA ANTES. Os lembretes que já nasceram são tarefas, e ficam.
  async function apagar(regra) {
    const n = Number(regra.dias) || 0;
    if (!window.confirm(`Apagar o lembrete de ${n} ${n === 1 ? "dia" : "dias"} da etapa “${etapa.nome}”? `
        + "Os lembretes que já nasceram continuam nas tarefas.")) return;
    setOcupado(true); setErro("");
    const r = await supabase.from("zorvin_acompanhamentos").delete().eq("id", regra.id).select("id");
    setOcupado(false);
    if (r.error) { setErro(comOCodigo("Não consegui apagar o lembrete.", r.error, "apagar lembrete")); return; }
    if (naoGravouNada(r)) { setErro(`Não apagou: ${recusado}`); return; }
    if (aoMudou) aoMudou();
  }

  const estranhas = form ? variaveisDesconhecidas(form.texto) : [];
  return (
    <div data-acompanhamento-da-etapa={etapa.nome}
         style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 4, paddingLeft: 18 }}>
      {daEtapa.map((r) => (form && form.id === r.id ? null : (
        <div key={r.id} data-regra-de-acompanhamento={r.dias}
             style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary, minWidth: 0 }}>
          <AlarmClock size={13} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={r.texto}>
            <b style={{ color: C.textPrimary, fontWeight: 600 }}>{fraseDaRegra(r.dias)}:</b>{" "}
            <span data-regra-texto>“{r.texto}”</span>
          </span>
          <button onClick={() => { setErro(""); setForm({ id: r.id, dias: String(r.dias), texto: r.texto }); }} disabled={ocupado}
                  data-regra-editar title="Editar este lembrete" aria-label={`Editar o lembrete de ${r.dias} dias`}
                  style={{ ...botaoFraco, padding: "3px 6px" }}>
            <Pencil size={13} />
          </button>
          <button onClick={() => apagar(r)} disabled={ocupado}
                  data-regra-apagar title="Apagar este lembrete" aria-label={`Apagar o lembrete de ${r.dias} dias`}
                  style={{ ...botaoFraco, padding: "3px 6px" }}>
            <Trash2 size={13} />
          </button>
        </div>
      )))}

      {form ? (
        <div data-acomp-formulario
             style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 8,
                      background: C.listActive, marginTop: 2 }}>
          <label style={{ fontSize: 12.5, color: C.textPrimary, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            Lembrar a equipe depois de
            <input type="number" min={DIAS_NO_MINIMO} max={DIAS_NO_MAXIMO} value={form.dias} data-acomp-dias
                   onChange={(e) => setForm((f) => ({ ...f, dias: e.target.value }))}
                   aria-label="Quantos dias sem resposta do cliente"
                   style={{ ...cx.campo, width: 70, flex: "0 0 auto", padding: "5px 8px" }} />
            {Number(form.dias) === 1 ? "dia" : "dias"} sem resposta do cliente nesta etapa
          </label>
          <textarea ref={caixa} value={form.texto} rows={3} maxLength={TETO_DA_MENSAGEM} data-acomp-texto autoFocus
                    onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                    // O ESC FECHA SÓ O FORMULÁRIO: a escada do Esc ouve a janela,
                    // e sem o `stopPropagation` fecharia junto a administração.
                    onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setErro(""); setForm(null); } }}
                    placeholder="A mensagem pronta. Ex.: {saudacao}, {nome}! Conseguiu ver a proposta que mandamos?"
                    aria-label="A mensagem pronta"
                    style={{ ...cx.campo, resize: "vertical", minHeight: 64, fontFamily: "inherit", lineHeight: 1.4 }} />
          <div data-acomp-variaveis style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textSecondary }}>Pôr no texto:</span>
            {VARIAVEIS.map((v) => (
              <button key={v.chave} type="button" data-acomp-variavel={v.chave} title={v.diz}
                      aria-label={`Pôr {${v.chave}}: ${v.diz}`}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => porVariavel(v.chave)}
                      style={{ border: `1px solid ${C.divider}`, background: C.panel, color: C.textPrimary, borderRadius: 14,
                               padding: "3px 9px", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                               cursor: "pointer" }}>
                {`{${v.chave}}`}
              </button>
            ))}
          </div>
          {/* A VARIÁVEL QUE O ZORVIN NÃO CONHECE iria com as chaves para o
              cliente. Avisa e não impede — a régua das rápidas. */}
          {estranhas.length > 0 && (
            <div data-acomp-variavel-desconhecida role="alert"
                 style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, lineHeight: 1.45,
                          color: C.ambarTexto || "#b26a00" }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <b>{estranhas.join(", ")}</b> {estranhas.length === 1 ? "não é uma variável" : "não são variáveis"} do Zorvin:
                {estranhas.length === 1 ? " vai" : " vão"} para o cliente assim, com as chaves.
              </span>
            </div>
          )}
          {usaVariaveis(form.texto) && (
            <div data-acomp-previa style={{ padding: "6px 8px", borderRadius: 6, background: C.panel }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>
                COMO FICA — PARA A CLIENTE “{CLIENTE_DE_EXEMPLO}”, AGORA
              </div>
              <div data-acomp-previa-texto style={{ fontSize: 13, marginTop: 3, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                                     color: C.textPrimary }}>
                {preencherVariaveis(form.texto, { cliente: CLIENTE_DE_EXEMPLO, atendente: meuNome, agora: new Date() })}
              </div>
            </div>
          )}
          {erro && <div data-acomp-erro role="alert" style={{ fontSize: 12.5, color: C.erroTexto || "#c0392b", lineHeight: 1.45 }}>{erro}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button style={cx.botao} onClick={salvar} disabled={ocupado} data-acomp-salvar>
              {ocupado ? <Loader2 size={14} className="zv-girando" /> : <Check size={15} />} Salvar
            </button>
            <button onClick={() => { setErro(""); setForm(null); }} style={botaoFraco} data-acomp-cancelar>Cancelar</button>
            <span style={{ fontSize: 11.5, color: C.textSecondary }}>{String(form.texto || "").length}/{TETO_DA_MENSAGEM}</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.45 }}>
            Nada sai para o cliente sozinho: quem cuida dele recebe uma tarefa com esta mensagem, confere e manda. O
            lembrete nasce no expediente do departamento, e se fecha sozinho quando a conversa anda.
          </div>
        </div>
      ) : (
        <>
        {erro && <div data-acomp-erro role="alert" style={{ fontSize: 12.5, color: C.erroTexto || "#c0392b", lineHeight: 1.45 }}>{erro}</div>}
        <button onClick={() => { setErro(""); setForm({ dias: "3", texto: "" }); }} disabled={ocupado} data-acomp-novo
                style={{ alignSelf: "flex-start", border: "none", background: "transparent", cursor: "pointer",
                         color: C.verdeTexto || C.green, fontSize: 12.5, fontWeight: 600, padding: "2px 0",
                         display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Plus size={13} /> Lembrete de acompanhamento
        </button>
        </>
      )}
    </div>
  );
}

export default AcompanhamentoDaEtapa;
