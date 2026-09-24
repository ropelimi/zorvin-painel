import React, { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada } from "./gravar.js";
import { Type, Loader2 } from "lucide-react";

// ============================================================
//  AS PALAVRAS DA CASA — a tela onde a palavra é trocada
//
//  Sem esta tela, `zorvin_palavras` só mudaria por SQL colado no Supabase — e
//  quem compra o programa não cola SQL. Uma palavra que exige chamar o
//  fornecedor para ser trocada é, na prática, uma palavra fixa.
//
//  ------------------------------------------------------------
//  SEM A TABELA, A SEÇÃO NÃO APARECE
//
//  Ela é criada pelo script 003, que a ponte aplica sozinha. Num banco que
//  ainda não o recebeu, a leitura falha — e desenhar campos que não salvam
//  seria pior do que não desenhar nada: a pessoa escreve, aperta salvar, e não
//  acontece nada. `existe = false` tira a seção inteira.
//
//  A FALHA QUE NÃO É AUSÊNCIA continua sendo dita: só o erro de "relação não
//  existe" (`42P01`) esconde. Qualquer outro — permissão, banco fora — vira
//  frase na tela, porque aí há algo a consertar.
//
//  ------------------------------------------------------------
//  O CAMPO VAZIO NÃO SALVA
//
//  "Escolha o …" é pior do que uma frase com a profissão errada. O botão
//  recusa antes de ir ao banco, e diz por quê.
//
//  ------------------------------------------------------------
//  A PRÉVIA EXISTE PORQUE A CONCORDÂNCIA É O QUE ERRA
//
//  Quem escreve "médica" e deixa o gênero no masculino recebe "o médica" na
//  barra lateral — e só descobre fechando esta tela. A prévia mostra a frase
//  montada, com as mesmas regras que a tela usa, antes de salvar.
// ============================================================

const PADRAO = { singular: "advogado", plural: "advogados", genero: "m" };

export function PalavrasDaCasa({ cx, C, aoAvisar }) {
  const [existe, setExiste] = useState(null);   // null = ainda lendo
  const [p, setP] = useState(PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase.from("zorvin_palavras").select("singular, plural, genero").maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) {
          // 42P01 = a tabela não existe. É o único caso em que sumir é o certo.
          if (error.code === "42P01") { setExiste(false); return; }
          setExiste(false);
          aoAvisar(`Não consegui ler as palavras da casa (${error.message}).`);
          return;
        }
        // SEM LINHA, A TABELA NÃO ESTÁ PRONTA. É o script 003 que insere a
        // única linha; uma tabela vazia significa metade da instalação feita,
        // e desenhar os campos aqui daria um "Salvar" que não encontra o que
        // atualizar — a pessoa escreve, aperta, e nada acontece nem falha.
        if (!data) { setExiste(false); return; }
        setExiste(true);
        setP({ singular: data.singular || PADRAO.singular,
               plural: data.plural || PADRAO.plural,
               genero: data.genero === "f" ? "f" : "m" });
      });
    return () => { vivo = false; };
  }, [aoAvisar]);

  async function salvar() {
    const singular = p.singular.trim();
    const plural = p.plural.trim();
    if (!singular || !plural) {
      aoAvisar("Escreva as duas palavras. Um campo em branco deixaria a tela dizendo “Escolha o …”.");
      return;
    }
    setSalvando(true); setSalvo(false); aoAvisar("");
    // `.select("id")` porque a RLS que barra um UPDATE NÃO devolve erro: ela
    // simplesmente não acha a linha. Sem isto, quem não administra apertaria
    // salvar, veria tudo normal, e a palavra voltaria ao abrir de novo. É a
    // mesma armadilha descrita em `Departamentos.jsx`.
    const r = await supabase.from("zorvin_palavras")
      .update({ singular, plural, genero: p.genero, atualizado: new Date().toISOString() })
      .eq("id", true).select("id");
    const { error } = r;
    setSalvando(false);
    if (error) { aoAvisar(`Não consegui salvar (${error.message}).`); return; }
    if (naoGravouNada(r)) {
      aoAvisar("Não salvou: o banco não deixou. Só quem administra o Zorvin pode trocar as palavras.");
      return;
    }
    setSalvo(true);
    setP({ singular, plural, genero: p.genero });
  }

  if (existe !== true) return null;

  const o = p.genero === "f" ? "a" : "o";
  const dono = p.genero === "f" ? "dona" : "dono";
  const previa = `${(p.singular || PADRAO.singular).toLocaleUpperCase("pt-BR")} (${dono} destas conversas)`;

  return (
    <div style={cx.secao} data-palavras-da-casa>
      <div style={cx.titulo}><Type size={16} /> As palavras desta instalação</div>
      <div style={cx.dica}>
        Como o programa chama quem é dono de um telefone. No escritório é
        “advogado”; numa clínica seria “médico”, numa imobiliária “corretor”.
        Aparece na barra lateral e nas telas de conversa.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Uma pessoa</span>
          <input value={p.singular} data-palavra-singular
                 onChange={(e) => { setP({ ...p, singular: e.target.value }); setSalvo(false); }}
                 style={{ ...cx.campo, width: "100%" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Mais de uma</span>
          <input value={p.plural} data-palavra-plural
                 onChange={(e) => { setP({ ...p, plural: e.target.value }); setSalvo(false); }}
                 style={{ ...cx.campo, width: "100%" }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 1 130px" }}>
          <span style={{ fontSize: 12, color: C.textSecondary }}>Diz-se</span>
          <select value={p.genero} data-palavra-genero
                  onChange={(e) => { setP({ ...p, genero: e.target.value }); setSalvo(false); }}
                  style={{ ...cx.campo, width: "100%" }}>
            <option value="m">o {p.singular || "advogado"}</option>
            <option value="f">a {p.singular || "advogada"}</option>
          </select>
        </label>
        <button style={cx.botao} onClick={salvar} disabled={salvando} data-palavras-salvar>
          {salvando ? <Loader2 size={14} className="zv-girando" /> : null}
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>

      <div style={{ ...cx.dica, marginTop: 10, marginBottom: 0 }} data-palavras-previa>
        Vai ficar assim na barra lateral: <b>{previa}</b>
        {salvo && <span style={{ color: C.green, marginLeft: 8 }}>· salvo</span>}
      </div>
    </div>
  );
}

export default PalavrasDaCasa;
