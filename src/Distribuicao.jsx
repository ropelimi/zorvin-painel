import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { Chave } from "./Chave.jsx";
import { Shuffle, Users, RefreshCw } from "lucide-react";

// ============================================================
//  A DISTRIBUIÇÃO AUTOMÁTICA DAS CONVERSAS NOVAS — a aba "Distribuição" em
//  "Departamentos e acessos" (13/10). Ver o script 023 da ponte.
//
//  Quando um cliente NOVO escreve pela primeira vez, o banco escolhe quem vai
//  atender — um de cada vez, na vez de cada um — e a conversa já chega com
//  responsável. Quem decide é o BANCO, a cada mensagem de cliente que a ponte
//  grava; esta tela só liga, desliga e mostra.
//
//  DUAS CHAVES, e são perguntas diferentes:
//
//    - a do DEPARTAMENTO (nasce desligada): "este departamento distribui?";
//    - a da PESSOA ("recebe conversas novas"): é a de férias e folga.
//
//  O PADRÃO DE CADA PESSOA VEM DO BANCO, e não de uma conta daqui: quem atende
//  começa dentro, quem administra começa fora. A lista traz `recebe` (o que
//  vale agora) e `escolhido` (se alguém já mexeu na chave) — refazer aqui
//  "recebe, a não ser que administre" seria uma segunda escrita da regra, para
//  divergir da do banco no primeiro conserto, e divergir aqui é a tela dizer
//  que alguém está no rodízio e as conversas irem para outra pessoa.
//
//  FALHA DE LEITURA É DITA, e nunca vira "desligada" nem "ninguém" — a
//  armadilha nº 2. Uma chave desenhada desligada porque a leitura falhou faria
//  quem administra LIGAR de novo o que já estava ligado, e uma lista vazia por
//  falha diria "ninguém recebe" num escritório onde as conversas estão sendo
//  entregues.
//
//  GRAVAR RELÊ DO BANCO, e não encaixa o clique na tela: é o que mostra o que
//  ficou gravado de verdade (a chave que o banco recusou volta sozinha, e a
//  frase diz por quê).
// ============================================================

const RECUSADO = "o banco não deixou. Só quem administra o Zorvin mexe na distribuição.";

function quandoFoi(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

export function Distribuicao({ cx, C, departamentos = [], telefones = [], aoAvisar }) {
  const [existe, setExiste] = useState(null);        // null = ainda lendo
  const [chaves, setChaves] = useState(null);        // linhas de zorvin_distribuicao
  const [erroChaves, setErroChaves] = useState("");
  const [pessoas, setPessoas] = useState(null);      // null = ainda lendo
  const [erroPessoas, setErroPessoas] = useState("");
  const [ocupado, setOcupado] = useState("");

  const lerChaves = useCallback(async () => {
    const r = await supabase.from("zorvin_distribuicao").select("*");
    if (r.error) {
      // A TABELA QUE FALTA (o script 023 não rodou) é o único caso em que
      // sumir é o certo. Qualquer outra falha é dita no lugar das chaves.
      if (semATabela(r.error)) { setExiste(false); return; }
      setExiste(true);
      setErroChaves(comOCodigo("Não consegui ler quais departamentos distribuem as conversas novas.",
                               r.error, "ler a distribuição"));
      return;
    }
    setExiste(true);
    setErroChaves("");
    setChaves(r.data || []);
  }, []);

  const lerPessoas = useCallback(async () => {
    const r = await supabase.rpc("zorvin_rodizio_pessoas");
    if (r.error) {
      setErroPessoas(comOCodigo("Não consegui ler quem recebe as conversas novas.", r.error, "ler o rodízio"));
      return;
    }
    setErroPessoas("");
    setPessoas(r.data || []);
  }, []);

  useEffect(() => { lerChaves(); lerPessoas(); }, [lerChaves, lerPessoas]);

  async function trocarDepartamento(d, ligada) {
    setOcupado(`dep-${d.id}`); aoAvisar("");
    const r = await supabase.from("zorvin_distribuicao")
      .upsert({ departamento_id: d.id, ligada }, { onConflict: "departamento_id" }).select("departamento_id");
    setOcupado("");
    if (r.error) {
      aoAvisar(comOCodigo(`Não consegui ${ligada ? "ligar" : "desligar"} a distribuição de ${d.nome}.`,
                          r.error, "distribuição do departamento"));
    } else if (naoGravouNada(r)) {
      aoAvisar(`Não ${ligada ? "ligou" : "desligou"}: ${RECUSADO}`);
    }
    await lerChaves();
  }

  async function trocarPessoa(p, recebe) {
    setOcupado(`pessoa-${p.usuario_id}`); aoAvisar("");
    const r = await supabase.from("zorvin_rodizio")
      .upsert({ usuario_id: p.usuario_id, recebe }, { onConflict: "usuario_id" }).select("usuario_id");
    setOcupado("");
    if (r.error) {
      aoAvisar(comOCodigo(`Não consegui ${recebe ? "pôr" : "tirar"} ${p.nome || "esta pessoa"} ${recebe ? "no" : "do"} rodízio.`,
                          r.error, "rodízio"));
    } else if (naoGravouNada(r)) {
      aoAvisar(`Não ${recebe ? "pôs no" : "tirou do"} rodízio: ${RECUSADO}`);
    }
    await lerPessoas();
  }

  if (existe === false) {
    return (
      <div style={cx.secao} data-distribuicao-sem-script>
        <div style={cx.dica}>
          A distribuição automática ainda não está instalada neste banco — ela chega com a
          próxima atualização da ponte.
        </div>
      </div>
    );
  }
  if (existe === null) return <div style={{ color: C.textSecondary, fontSize: 14 }}>Carregando…</div>;
  if (!departamentos.length) {
    return <div style={cx.dica}>Crie um departamento primeiro: a distribuição é de cada um.</div>;
  }

  const nomeDoDepartamento = (id) => (departamentos.find((d) => String(d.id) === String(id)) || {}).nome || "";
  const ligadaEm = (id) => Boolean((chaves || []).find((c) => String(c.departamento_id) === String(id) && c.ligada));
  const noRodizioDe = (id) => (pessoas || [])
    .filter((p) => p.recebe && (p.departamentos || []).some((x) => String(x) === String(id)));
  const aviso = { fontSize: 12.5, color: C.textPrimary, background: C.panel, border: `1px solid ${C.divider}`,
                  borderLeft: "4px solid #d99a1e", borderRadius: 8, padding: "7px 10px", lineHeight: 1.45 };

  return (
    <>
      <div style={cx.secao} data-distribuicao>
        <div style={cx.titulo}><Shuffle size={16} /> Distribuição das conversas novas</div>
        <div style={cx.dica}>
          Quando um <b>cliente novo</b> escreve pela primeira vez, o Zorvin escolhe sozinho quem vai
          atender — um de cada vez, na vez de cada um — e a conversa já chega com responsável. As
          conversas que já existem continuam como estão. Cada pessoa só recebe conversas dos
          telefones que ela já vê. O aviso de mensagem nova não muda: até alguém responder, todo
          mundo continua sendo avisado.
        </div>

        {erroChaves ? (
          <div data-distribuicao-falha-chaves style={{ ...aviso, borderLeft: "4px solid #e5573f" }}>
            {erroChaves}{" "}
            <button style={{ ...cx.botaoFraco, marginLeft: 6 }} onClick={lerChaves}>
              <RefreshCw size={12} /> Tentar de novo
            </button>
          </div>
        ) : departamentos.map((d) => {
          const ligada = ligadaEm(d.id);
          const temTelefone = telefones.some((t) => String(t.departamento_id) === String(d.id) && t.ativo !== false);
          const quem = noRodizioDe(d.id);
          return (
            <div key={d.id} data-distribuicao-departamento={d.id} data-ligada={ligada ? "sim" : "nao"}
                 style={{ ...cx.linha, alignItems: "flex-start", flexWrap: "nowrap", padding: "10px 0" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{d.nome}</span>
                <span data-distribuicao-quem style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 1.45 }}>
                  {!temTelefone ? "Nenhum telefone ativo neste departamento — não há o que distribuir."
                    : erroPessoas ? "Não consegui ler quem está no rodízio (veja abaixo)."
                    : pessoas === null ? "Lendo quem está no rodízio…"
                    : quem.length ? `${ligada ? "As conversas novas vão para" : "Ligando, vão para"}: ${quem.map((p) => p.nome || "Sem nome").join(", ")}.`
                    : "Ninguém do rodízio vê os telefones deste departamento."}
                </span>
                {/* LIGADA E SEM NINGUÉM é o único caso que pede ação: as
                    conversas novas continuam chegando sem responsável, como
                    antes, e quem ligou acha que estão sendo entregues. */}
                {ligada && temTelefone && !erroPessoas && pessoas !== null && quem.length === 0 && (
                  <span data-distribuicao-sem-ninguem style={{ ...aviso, display: "block", marginTop: 6 }}>
                    Ligada, mas <b>ninguém vai receber</b>: as conversas novas deste departamento
                    continuam chegando sem responsável. Ligue alguém na lista abaixo, ou libere os
                    telefones dele para alguém na aba Atendentes.
                  </span>
                )}
              </span>
              <Chave ligada={ligada} rotulo={`Distribuir as conversas novas de ${d.nome}`}
                     aoTrocar={() => { if (!ocupado) trocarDepartamento(d, !ligada); }} />
            </div>
          );
        })}
      </div>

      <div style={cx.secao} data-rodizio>
        <div style={cx.titulo}><Users size={16} /> Quem recebe conversas novas</div>
        <div style={cx.dica}>
          Desligue quem está de férias ou de folga: a vez dela passa para a próxima pessoa. Quem
          administra o Zorvin começa fora — ligue se também atende. Aparece aqui quem vê pelo menos
          um telefone; para alguém receber de outro departamento, libere o telefone na aba
          Atendentes.
        </div>
        {erroPessoas && (
          <div data-rodizio-falha style={{ ...aviso, borderLeft: "4px solid #e5573f" }}>
            {erroPessoas}{" "}
            <button style={{ ...cx.botaoFraco, marginLeft: 6 }} onClick={lerPessoas}>
              <RefreshCw size={12} /> Tentar de novo
            </button>
          </div>
        )}
        {!erroPessoas && pessoas === null && <div style={cx.dica}>Carregando…</div>}
        {!erroPessoas && pessoas !== null && pessoas.length === 0 && (
          <div data-rodizio-vazio style={cx.dica}>
            Ninguém vê telefone nenhum ainda. Libere os telefones de cada pessoa na aba Atendentes.
          </div>
        )}
        {!erroPessoas && (pessoas || []).map((p) => {
          const deps = (p.departamentos || []).map(nomeDoDepartamento).filter(Boolean);
          const ultima = quandoFoi(p.ultima_em);
          return (
            <div key={p.usuario_id} data-rodizio-pessoa={p.usuario_id} data-recebe={p.recebe ? "sim" : "nao"}
                 style={{ ...cx.linha, alignItems: "flex-start", flexWrap: "nowrap", padding: "10px 0" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                  {p.nome || "Sem nome"}
                  {p.administra && <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 500 }}> · administra</span>}
                </span>
                {deps.length > 0 && (
                  <span style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                    Vê: {deps.join(", ")}
                  </span>
                )}
                <span data-rodizio-recebeu style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                  {ultima ? `Recebeu a última em ${ultima}` : "Ainda não recebeu nenhuma"}
                  {` · ${p.hoje === 1 ? "1 hoje" : `${p.hoje || 0} hoje`}`}
                </span>
                {p.administra && !p.escolhido && (
                  <span data-rodizio-admin-fora style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                    Fora do rodízio por administrar o Zorvin.
                  </span>
                )}
              </span>
              <Chave ligada={Boolean(p.recebe)} rotulo={`${p.nome || "Esta pessoa"} recebe conversas novas`}
                     aoTrocar={() => { if (!ocupado) trocarPessoa(p, !p.recebe); }} />
            </div>
          );
        })}
      </div>
    </>
  );
}
