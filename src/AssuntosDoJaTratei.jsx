import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo } from "./gravar.js";
import { ListChecks, Plus, Loader2, Check, EyeOff, Eye, PenLine } from "lucide-react";

// ============================================================
//  OS ASSUNTOS DO "JÁ TRATEI" — a tela onde a lista é editada
//
//  Os oito de hoje (BLINDAGEM, SUBSÍDIO EMENDA, …) são os do escritório. Quem
//  compra o programa tem outros, e não cola SQL — abre a tela e escreve. É a
//  mesma razão de `PalavrasDaCasa.jsx`.
//
//  ------------------------------------------------------------
//  NÃO SE APAGA ASSUNTO, SE DESATIVA
//
//  E isso não é preguiça de escrever o botão: os tratamentos já registrados
//  apontam para o assunto por `id`. Apagando, o relatório de setembro ficaria
//  com linhas sem nome — um buraco, que é pior do que uma linha a mais numa
//  lista de configuração. O banco também não oferece DELETE aqui (não existe
//  política para isso), então um botão de apagar seria um botão que falha.
//
//  Desativado, o assunto some da checklist de quem atende e CONTINUA
//  aparecendo no histórico. É o que "parar de usar" quer dizer.
//
//  ------------------------------------------------------------
//  RENOMEAR CONSERTA O PASSADO INTEIRO, E ISSO É UMA FACA DE DOIS GUMES
//
//  Como o tratamento guarda o `id`, corrigir "Subisídio Emenda" para "Subsídio
//  Emenda" arruma todos os registros de uma vez — que é o que se quer de um
//  erro de digitação. Mas renomear "ACORDOS" para "COBRANÇA" reescreveria a
//  história: setembro passaria a dizer que a equipe fez cobrança.
//
//  A dica na tela diz isso com todas as letras, porque é a diferença entre
//  usar o lápis e usar o "Parar de usar" + "Novo assunto".
//
//  ------------------------------------------------------------
//  SEM A TABELA, A SEÇÃO NÃO APARECE
//
//  Ela vem do script 005. Só `42P01` (relação não existe) esconde; qualquer
//  outro erro — permissão, banco fora — vira frase na tela. É a armadilha nº 2:
//  desenhar ausência no lugar de falha foi o que sumiu com as etiquetas em
//  04/09.
//
//  ------------------------------------------------------------
//  "PEDE DESCRIÇÃO" (script 009)
//
//  A marca que faz o assunto abrir um campo de texto obrigatório no "Já
//  tratei". Nasce ligada no OUTROS; a chave está aqui porque quem compra o
//  programa pode querer descrição em outro assunto, ou chamar o OUTROS de
//  outra coisa. Sem o script, a chave não aparece — ela ligaria uma coluna
//  que não existe.
// ============================================================

export function AssuntosDoJaTratei({ cx, C, aoAvisar }) {
  const [existe, setExiste] = useState(null);   // null = ainda lendo
  const [assuntos, setAssuntos] = useState([]);
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null);   // { id, nome }

  const ler = useCallback(async (primeira) => {
    // `*`: `pede_descricao` só existe depois do script 009, e pedi-la por
    // nome num banco sem ela derrubaria a leitura da seção inteira.
    const { data, error } = await supabase.from("zorvin_assuntos")
      .select("*").order("ativo", { ascending: false }).order("ordem");
    if (error) {
      // 42P01 = a tabela não existe. É o único caso em que sumir é o certo.
      if (error.code === "42P01") { setExiste(false); return; }
      // NA PRIMEIRA LEITURA a seção some E avisa; nas seguintes ela FICA, com
      // a lista que já estava na tela. Apagar uma lista carregada por causa de
      // uma oscilação de rede seria trocar um aviso por um sumiço.
      if (primeira) setExiste(false);
      aoAvisar(comOCodigo("Não consegui ler os assuntos do “Já tratei”.", error, "assuntos"));
      return;
    }
    setExiste(true);
    setAssuntos(data || []);
  }, [aoAvisar]);

  useEffect(() => { ler(true); }, [ler]);

  async function criar() {
    const nome = novo.trim();
    if (!nome) { aoAvisar("Escreva o nome do assunto."); return; }
    // O MESMO NOME JÁ ATIVO é recusado AQUI, e não só pelo índice do banco:
    // a frase do Postgres para índice único repetido ("duplicate key value
    // violates unique constraint zorvin_assuntos_nome_ativo") não diz a quem
    // atende o que fazer.
    if (assuntos.some((a) => a.ativo && a.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      aoAvisar(`Já existe um assunto chamado “${nome}”.`);
      return;
    }
    setOcupado(true); aoAvisar("");
    const maior = assuntos.reduce((m, a) => Math.max(m, a.ordem || 0), 0);
    const r = await supabase.from("zorvin_assuntos")
      .insert({ nome, ordem: maior + 1 }).select("id");
    setOcupado(false);
    if (r.error) {
      // O `insert` barrado pela RLS LEVANTA erro (42501) — ao contrário do
      // `update`, que é filtrado em silêncio. Por isso aqui a frase do código
      // basta, e é `naoGravouNada` logo abaixo que cobre o outro caso.
      aoAvisar(comOCodigo("Não consegui criar o assunto.", r.error, "criar assunto"));
      return;
    }
    if (naoGravouNada(r)) {
      aoAvisar("Não criou: o banco não deixou. Só quem administra o Zorvin pode mexer nos assuntos.");
      return;
    }
    setNovo("");
    // RELEIO DO SERVIDOR em vez de encaixar a linha na tela: encaixar mostraria
    // um assunto que talvez não tenha entrado, e o erro só apareceria na
    // próxima abertura, longe da causa.
    ler(false);
  }

  async function gravar(a, patch, oQueE) {
    setOcupado(true); aoAvisar("");
    const r = await supabase.from("zorvin_assuntos")
      .update(patch).eq("id", a.id).select("id");
    setOcupado(false);
    if (r.error) { aoAvisar(comOCodigo(`Não consegui ${oQueE}.`, r.error, "assunto")); return false; }
    if (naoGravouNada(r)) {
      aoAvisar(`Não ${oQueE === "renomear" ? "renomeou" : "mudou"}: o banco não deixou. Só quem administra o Zorvin pode mexer nos assuntos.`);
      return false;
    }
    ler(false);
    return true;
  }

  async function renomear() {
    const nome = (editando.nome || "").trim();
    if (!nome) { aoAvisar("O assunto não pode ficar sem nome."); return; }
    const ok = await gravar({ id: editando.id }, { nome }, "renomear");
    if (ok) setEditando(null);
  }

  if (existe !== true) return null;

  // A COLUNA EXISTE? Perguntado à linha que veio, como no resto do painel.
  const temDescricao = assuntos.length > 0
    && Object.prototype.hasOwnProperty.call(assuntos[0], "pede_descricao");

  return (
    <div style={cx.secao} data-assuntos-do-ja-tratei>
      <div style={cx.titulo}><ListChecks size={16} /> Assuntos do “Já tratei”</div>
      <div style={cx.dica}>
        O que a equipe marca ao tirar uma conversa da fila de espera sem mandar
        mensagem. <b>Renomear conserta o passado inteiro</b> — bom para erro de
        digitação, ruim para trocar de assunto: nesse caso, use “Parar de usar”
        e crie um novo, senão os registros antigos passam a dizer outra coisa.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)}
               placeholder="Novo assunto" data-assunto-novo
               onKeyDown={(e) => e.key === "Enter" && !ocupado && criar()}
               style={{ ...cx.campo, flex: 1 }} />
        <button style={cx.botao} onClick={criar} disabled={ocupado} data-assunto-criar>
          {ocupado ? <Loader2 size={14} className="zv-girando" /> : <Plus size={15} />} Criar
        </button>
      </div>

      {assuntos.map((a) => (
        <div key={a.id} data-assunto-da-config={a.nome}
             style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                      borderTop: `1px solid ${C.divider}`, opacity: a.ativo ? 1 : 0.55 }}>
          {editando && editando.id === a.id ? (
            <>
              <input value={editando.nome} autoFocus data-assunto-editando
                     onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                     onKeyDown={(e) => { if (e.key === "Enter") renomear(); if (e.key === "Escape") setEditando(null); }}
                     style={{ ...cx.campo, flex: 1 }} />
              <button style={cx.botao} onClick={renomear} disabled={ocupado} data-assunto-salvar>
                <Check size={15} /> Salvar
              </button>
              <button onClick={() => setEditando(null)}
                      style={{ ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}` }}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 13.5, textDecoration: a.ativo ? "none" : "line-through" }}>
                {a.nome}
                {!a.ativo && <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textSecondary }}>fora de uso</span>}
                {a.ativo && a.pede_descricao && (
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textSecondary }}>pede descrição</span>
                )}
              </span>
              {temDescricao && a.ativo && (
                <button onClick={() => gravar(a, { pede_descricao: !a.pede_descricao },
                                              a.pede_descricao ? "parar de pedir descrição" : "pedir descrição")}
                        disabled={ocupado} data-assunto-pede-descricao={a.pede_descricao ? "sim" : "nao"}
                        title={a.pede_descricao
                          ? "Marcar este assunto deixa de pedir o que foi tratado"
                          : "Marcar este assunto passa a exigir que se escreva o que foi tratado"}
                        style={{ ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}` }}>
                  <PenLine size={15} />
                  {a.pede_descricao ? "Não pedir descrição" : "Pedir descrição"}
                </button>
              )}
              <button onClick={() => setEditando({ id: a.id, nome: a.nome })} disabled={ocupado}
                      data-assunto-renomear
                      style={{ ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}` }}>
                Renomear
              </button>
              <button onClick={() => gravar(a, { ativo: !a.ativo }, a.ativo ? "parar de usar" : "voltar a usar")}
                      disabled={ocupado} data-assunto-ativo={a.ativo ? "sim" : "nao"}
                      style={{ ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}` }}>
                {a.ativo ? <EyeOff size={15} /> : <Eye size={15} />}
                {a.ativo ? "Parar de usar" : "Voltar a usar"}
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default AssuntosDoJaTratei;
