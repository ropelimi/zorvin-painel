import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { casaComAPesquisa, nadaComAPesquisa, PESQUISA_A_PARTIR_DE } from "./pesquisaNosMenus.js";
import CampoDePesquisa from "./CampoDePesquisa.jsx";
import { NOME_DO_ASSISTENTE } from "./assistente.js";
import { ChevronDown, ChevronRight, GraduationCap, BookOpen, Loader2 } from "lucide-react";

// ============================================================
//  O QUE O COPILOTO APRENDEU (05/11) — duas seções da aba "Quazar"
//
//  Pedido do Rodrigo: o Copiloto "sempre aprender, ficar cada vez mais
//  inteligente", lendo as conversas de cada departamento e de cada telefone,
//  e aprendendo com as correções da equipe. Decidido com ele: a lição vale NA
//  HORA, para o escritório inteiro, e quem administra vê, corrige e apaga.
//
//  Quem aprende é a PONTE (script 050 e a rodada `aprenderComAsConversas`,
//  ver o CLAUDE.md dela). Aqui, quem administra:
//
//  - AS LIÇÕES (`zorvin_copiloto_licoes`): as correções que a equipe fez nas
//    sugestões, pelo "Pedir uma mudança ao Copiloto". Corrigir e apagar. Lição
//    não nasce aqui: nasce na rota da ponte, que diz quem ensinou.
//  - AS NOTAS (`zorvin_copiloto_aprendido`): o que a IA anotou lendo as
//    conversas, uma por departamento e uma por telefone. Corrigir o texto (a
//    ponte continua a partir dele) e "Ler tudo de novo".
//
//  SEM A TABELA, A SEÇÃO NÃO APARECE: é o banco sem o 050, e não uma falha. A
//  leitura que falha por outro motivo é DITA, com o código, e nada é desenhado
//  no lugar — uma lista vazia se leria como "o Copiloto não aprendeu nada".
//
//  GRAVAR RELÊ DO BANCO, e a recusa calada da regra de acesso (zero linhas,
//  sem erro) é dita como recusa (a armadilha de 24/09).
// ============================================================

const TETO_DA_LISTA = 500;
const TETO_DA_LICAO = 500;
const TETO_DAS_NOTAS = 8000;

export function quandoFoi(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric",
                                     hour: "2-digit", minute: "2-digit" });
}

/** Os nomes da equipe, para dizer quem ensinou e quem corrigiu. A vista
 *  `equipe` é a mesma dos menus de pessoas. Falhando, cada nome vira "alguém
 *  da equipe" — a lição continua lá, e quem a ensinou é um detalhe. */
export function useNomesDaEquipe() {
  const [nomes, setNomes] = useState({});
  useEffect(() => {
    let valeu = true;
    supabase.from("equipe").select("id, nome").then(({ data, error }) => {
      if (!valeu || error) return;
      setNomes(Object.fromEntries((data || []).map((p) => [String(p.id), p.nome || ""])));
    });
    return () => { valeu = false; };
  }, []);
  return nomes;
}

const nomeDe = (nomes, id) => (id && nomes[String(id)]) || "alguém da equipe";

// ------------------------------------------------------------
//  AS LIÇÕES
// ------------------------------------------------------------
export function LicoesDoCopiloto({ cx, C, nomes }) {
  // null = lendo; { linhas } = lido; { erro } = falhou; { semTabela } = sem o 050.
  const [lido, setLido] = useState(null);
  const [pesquisa, setPesquisa] = useState("");
  const [corrigindo, setCorrigindo] = useState(null);   // { id, texto }
  const [ocupado, setOcupado] = useState("");           // id com gravação em voo
  const [recado, setRecado] = useState(null);           // { id, tipo, frase }

  const ler = useCallback(async () => {
    const { data, error } = await supabase.from("zorvin_copiloto_licoes")
      .select("id, texto, pedido, criada_por, criada_em, editada_por, editada_em")
      .order("criada_em", { ascending: false }).limit(TETO_DA_LISTA);
    if (error) {
      if (semATabela(error)) { setLido({ semTabela: true }); return false; }
      setLido({ erro: comOCodigo(`Não consegui ler as lições do ${NOME_DO_ASSISTENTE}.`, error, "lições do copiloto") });
      return false;
    }
    setLido({ linhas: data || [] });
    return true;
  }, []);

  useEffect(() => { ler(); }, [ler]);

  if (lido && lido.semTabela) return null;

  async function salvarCorrecao() {
    if (!corrigindo || ocupado) return;
    const texto = corrigindo.texto.trim();
    if (!texto) return;
    setOcupado(corrigindo.id); setRecado(null);
    const r = await supabase.from("zorvin_copiloto_licoes").update({ texto })
      .eq("id", corrigindo.id).select("id");
    if (r.error) {
      setOcupado("");
      setRecado({ id: corrigindo.id, tipo: "erro", frase: comOCodigo("Não consegui salvar a lição.", r.error, "lições do copiloto") });
      return;
    }
    if (naoGravouNada(r)) {
      setOcupado("");
      setRecado({ id: corrigindo.id, tipo: "erro", frase: "Não salvou: o banco não deixou. Só quem administra o Zorvin corrige as lições." });
      return;
    }
    const id = corrigindo.id;
    const releu = await ler();
    setOcupado(""); setCorrigindo(null);
    setRecado(releu
      ? { id, tipo: "ok", frase: "Salvo. A próxima sugestão já lê a lição corrigida." }
      : { id, tipo: "erro", frase: "Salvou, mas não consegui reler as lições para conferir. Feche e abra esta aba." });
  }

  async function apagar(licao) {
    if (ocupado) return;
    if (!window.confirm(`Apagar esta lição? O ${NOME_DO_ASSISTENTE} deixa de segui-la a partir da próxima sugestão.\n\n“${licao.texto}”`)) return;
    setOcupado(licao.id); setRecado(null);
    const r = await supabase.from("zorvin_copiloto_licoes").delete().eq("id", licao.id).select("id");
    if (r.error) {
      setOcupado("");
      setRecado({ id: licao.id, tipo: "erro", frase: comOCodigo("Não consegui apagar a lição.", r.error, "lições do copiloto") });
      return;
    }
    if (naoGravouNada(r)) {
      setOcupado("");
      setRecado({ id: licao.id, tipo: "erro", frase: "Não apagou: o banco não deixou. Só quem administra o Zorvin, ou quem ensinou a lição, pode apagá-la." });
      return;
    }
    if (corrigindo && corrigindo.id === licao.id) setCorrigindo(null);
    const releu = await ler();
    setOcupado("");
    setRecado(releu ? null
      : { id: null, tipo: "erro", frase: "Apagou, mas não consegui reler as lições para conferir. Feche e abra esta aba." });
  }

  const linhas = (lido && lido.linhas) || [];
  const comPesquisa = linhas.length >= PESQUISA_A_PARTIR_DE;
  const achadas = comPesquisa ? linhas.filter((l) => casaComAPesquisa(pesquisa, l.texto, l.pedido)) : linhas;

  return (
    <div style={cx.secao} data-licoes-do-copiloto>
      <div style={cx.titulo}><GraduationCap size={16} color={C.green} /> O que o {NOME_DO_ASSISTENTE} aprendeu com a equipe</div>
      <div style={cx.dica}>
        Quando alguém pede uma mudança numa sugestão (<b>Pedir uma mudança ao {NOME_DO_ASSISTENTE}</b>, embaixo
        da sugestão na conversa) e o pedido ensina uma regra — “não passamos o telefone do
        advogado” —, ela vira uma lição. <b>As lições valem na hora, para a equipe toda.</b> Em cada
        sugestão vão as mais recentes: com muitas guardadas, as mais antigas deixam de entrar, e
        vale apagar as que não servem mais.
      </div>
      {lido === null && (
        <div style={{ ...cx.dica, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="zv-girando" /> Lendo as lições…
        </div>
      )}
      {lido && lido.erro && (
        <div data-licoes-erro style={{ fontSize: 13, color: C.erroTexto, lineHeight: 1.5 }}>
          {lido.erro}{" "}
          <button style={cx.botaoFraco} onClick={() => { setLido(null); ler(); }}>Tentar de novo</button>
        </div>
      )}
      {lido && lido.linhas && (<>
        {linhas.length === 0 && (
          <div data-licoes-vazio style={{ ...cx.dica, marginBottom: 0 }}>
            Nenhuma lição ainda. Elas aparecem aqui quando a equipe pede uma mudança que ensina uma regra.
          </div>
        )}
        {comPesquisa && (
          <div style={{ marginBottom: 8 }}>
            <CampoDePesquisa C={C} valor={pesquisa} aoMudar={setPesquisa} rotulo="Pesquisar nas lições" nome="licoes" />
          </div>
        )}
        {comPesquisa && pesquisa.trim() && achadas.length === 0 && (
          <div data-licoes-nada style={{ ...cx.dica, marginBottom: 0 }}>{nadaComAPesquisa("Nenhuma lição", pesquisa)}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {achadas.map((l) => {
            const corrigindoEsta = corrigindo && corrigindo.id === l.id;
            const recadoDela = recado && recado.id === l.id ? recado : null;
            return (
              <div key={l.id} data-licao-da-config={l.id}
                   style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: "8px 10px" }}>
                {corrigindoEsta ? (<>
                  <textarea data-licao-campo value={corrigindo.texto} rows={3} maxLength={TETO_DA_LICAO}
                            onChange={(e) => setCorrigindo({ id: l.id, texto: e.target.value })}
                            style={{ ...cx.campo, width: "100%", boxSizing: "border-box", resize: "vertical",
                                     fontFamily: "inherit", lineHeight: 1.45 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button data-licao-salvar style={{ ...cx.botao, opacity: corrigindo.texto.trim() ? 1 : 0.5 }}
                            disabled={!corrigindo.texto.trim() || Boolean(ocupado)} onClick={salvarCorrecao}>
                      {ocupado === l.id ? "Salvando…" : "Salvar a lição"}
                    </button>
                    <button data-licao-cancelar style={cx.botaoFraco} disabled={Boolean(ocupado)}
                            onClick={() => setCorrigindo(null)}>Cancelar</button>
                    <span style={{ fontSize: 12, color: C.textSecondary }}>
                      {corrigindo.texto.length}/{TETO_DA_LICAO}
                    </span>
                  </div>
                </>) : (
                  <div data-licao-texto style={{ fontSize: 13.5, color: C.textPrimary, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                    {l.texto}
                  </div>
                )}
                <div data-licao-quem style={{ fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 1.45 }}>
                  Ensinada por {nomeDe(nomes, l.criada_por)}{l.criada_em ? ` em ${quandoFoi(l.criada_em)}` : ""}
                  {l.editada_em ? ` · corrigida por ${nomeDe(nomes, l.editada_por)} em ${quandoFoi(l.editada_em)}` : ""}
                </div>
                {l.pedido && (
                  <div data-licao-pedido style={{ fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 1.45 }}>
                    O pedido: “{l.pedido}”
                  </div>
                )}
                {!corrigindoEsta && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <button data-licao-corrigir style={cx.botaoFraco} disabled={Boolean(ocupado)}
                            onClick={() => { setRecado(null); setCorrigindo({ id: l.id, texto: l.texto }); }}>Corrigir</button>
                    <button data-licao-apagar style={cx.botaoFraco} disabled={Boolean(ocupado)}
                            onClick={() => apagar(l)}>{ocupado === l.id ? "Apagando…" : "Apagar"}</button>
                  </div>
                )}
                {recadoDela && (
                  <div data-licao-recado={recadoDela.tipo}
                       style={{ marginTop: 6, fontSize: 12.5, color: recadoDela.tipo === "ok" ? C.verdeTexto : C.erroTexto }}>
                    {recadoDela.frase}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {recado && recado.id === null && (
          <div data-licao-recado="erro" style={{ marginTop: 8, fontSize: 12.5, color: C.erroTexto }}>{recado.frase}</div>
        )}
        {linhas.length >= TETO_DA_LISTA && (
          <div data-licoes-corte style={{ ...cx.dica, marginTop: 8, marginBottom: 0 }}>
            Mostrando as {TETO_DA_LISTA} lições mais recentes. Há outras, mais antigas, guardadas no banco.
          </div>
        )}
      </>)}
    </div>
  );
}

// ------------------------------------------------------------
//  AS NOTAS DE CADA DEPARTAMENTO E DE CADA TELEFONE
// ------------------------------------------------------------

/** A frase do que a ponte diz da leitura das conversas. Três estados e mais
 *  um, pela régua de `temVantoro.js`: ainda perguntando, ligada, desligada
 *  pela variável, e a ponte de antes desta função (respondeu sem `aprende`). */
export function fraseDaLeitura(estado) {
  if (!estado) return { tipo: "perguntando", frase: `Perguntando à ponte se o ${NOME_DO_ASSISTENTE} está lendo as conversas…` };
  if (estado.ligado === false) {
    return { tipo: "desligado", frase: `O ${NOME_DO_ASSISTENTE} não está ligado na ponte (falta a ANTHROPIC_API_KEY), e por isso também não lê as conversas. As notas abaixo ficam como estão.` };
  }
  if (estado.aprende === true) {
    return { tipo: "lendo", frase: `O ${NOME_DO_ASSISTENTE} lê as conversas sozinho, aos poucos (um pedaço por minuto, de cada telefone e de cada departamento), e reescreve estas notas. Elas entram nas sugestões do telefone e do departamento.` };
  }
  if (estado.aprende === false) {
    return { tipo: "parado", frase: "A leitura das conversas está desligada na ponte (COPILOTO_APRENDER=desligado). As notas abaixo continuam valendo nas sugestões, mas não crescem." };
  }
  if (estado.aprende === "antiga") {
    return { tipo: "antiga", frase: "A ponte que está no ar ainda não lê as conversas: ela é de antes desta função. Confira em “Atualizações do banco” qual versão está no ar." };
  }
  return { tipo: "duvida", frase: `Não consegui perguntar à ponte se o ${NOME_DO_ASSISTENTE} está lendo as conversas.` };
}

function rotuloDoTelefone(t) {
  const nome = String((t && t.nome) || "").trim() || "Telefone";
  return t && t.ativo === false ? `${nome} (desativado)` : nome;
}

export function NotasDoCopiloto({ cx, C, departamentos = [], telefones = [], estado, nomes }) {
  // null = lendo; { linhas } = lido; { erro } = falhou; { semTabela } = sem o 050.
  const [lido, setLido] = useState(null);
  const [aberta, setAberta] = useState(null);       // id da linha aberta
  const [textos, setTextos] = useState({});         // id → o que está sendo escrito
  const [ocupado, setOcupado] = useState("");       // id com gravação em voo
  const [recado, setRecado] = useState(null);       // { id, tipo, frase }

  const ler = useCallback(async () => {
    const { data, error } = await supabase.from("zorvin_copiloto_aprendido")
      .select("id, escopo, advogado_id, departamento_id, texto, mensagens_lidas, aprendido_em, atualizado_em, editado_por, editado_em");
    if (error) {
      if (semATabela(error)) { setLido({ semTabela: true }); return false; }
      setLido({ erro: comOCodigo(`Não consegui ler o que o ${NOME_DO_ASSISTENTE} aprendeu com as conversas.`, error, "notas do copiloto") });
      return false;
    }
    setLido({ linhas: data || [] });
    return true;
  }, []);

  useEffect(() => { ler(); }, [ler]);

  if (lido && lido.semTabela) return null;

  const linhas = (lido && lido.linhas) || [];
  const linhaDoDepartamento = (d) => linhas.find((l) => l.escopo === "departamento" && String(l.departamento_id) === String(d.id));
  const linhaDoTelefone = (t) => linhas.find((l) => l.escopo === "telefone" && String(l.advogado_id) === String(t.id));
  // O DEPARTAMENTO SEM TELEFONE NENHUM não tem conversa para ler, e a ponte
  // não cria as notas dele: listá-lo seria uma linha dizendo "ainda sem
  // notas" para sempre.
  const grupos = departamentos.filter((d) => linhaDoDepartamento(d)
    || telefones.some((t) => String(t.departamento_id) === String(d.id))).map((d) => ({
    chave: `d${d.id}`, nome: d.nome || "Departamento", linha: linhaDoDepartamento(d),
    fones: telefones.filter((t) => String(t.departamento_id) === String(d.id)),
  }));
  const semDepartamento = telefones.filter((t) => t.departamento_id == null
    || !departamentos.some((d) => String(d.id) === String(t.departamento_id)));
  if (semDepartamento.length) grupos.push({ chave: "sem", nome: "Sem departamento", linha: null, fones: semDepartamento });

  const leitura = fraseDaLeitura(estado);

  async function salvar(linha) {
    const texto = textos[linha.id];
    if (texto == null || texto === linha.texto || ocupado || texto.length > TETO_DAS_NOTAS) return;
    setOcupado(linha.id); setRecado(null);
    const r = await supabase.from("zorvin_copiloto_aprendido").update({ texto })
      .eq("id", linha.id).select("id");
    if (r.error) {
      setOcupado("");
      setRecado({ id: linha.id, tipo: "erro", frase: comOCodigo("Não consegui salvar as notas.", r.error, "notas do copiloto") });
      return;
    }
    if (naoGravouNada(r)) {
      setOcupado("");
      setRecado({ id: linha.id, tipo: "erro", frase: `Não salvou: o banco não deixou. Só quem administra o Zorvin corrige as notas do ${NOME_DO_ASSISTENTE}.` });
      return;
    }
    const releu = await ler();
    setOcupado("");
    setTextos((atual) => { const novo = { ...atual }; delete novo[linha.id]; return novo; });
    setRecado(releu
      ? { id: linha.id, tipo: "ok", frase: `Salvo. A próxima sugestão já lê as notas corrigidas, e o ${NOME_DO_ASSISTENTE} continua aprendendo a partir delas.` }
      : { id: linha.id, tipo: "erro", frase: "Salvou, mas não consegui reler as notas para conferir. Feche e abra esta aba." });
  }

  async function lerDeNovo(linha, nome) {
    if (ocupado) return;
    if (!window.confirm(`Ler tudo de novo em “${nome}”? O ${NOME_DO_ASSISTENTE} esquece as notas de lá e lê todas as conversas outra vez, aos poucos.`)) return;
    setOcupado(linha.id); setRecado(null);
    const r = await supabase.rpc("zorvin_copiloto_ler_de_novo", { p_id: linha.id });
    if (r.error) {
      setOcupado("");
      setRecado({ id: linha.id, tipo: "erro", frase: comOCodigo("Não consegui pedir a leitura de novo.", r.error, "notas do copiloto") });
      return;
    }
    if (r.data !== true) {
      setOcupado("");
      setRecado({ id: linha.id, tipo: "erro", frase: "Não comecei de novo: o banco não achou essas notas. Feche e abra esta aba." });
      return;
    }
    const releu = await ler();
    setOcupado("");
    setTextos((atual) => { const novo = { ...atual }; delete novo[linha.id]; return novo; });
    setRecado({ id: linha.id, tipo: releu ? "ok" : "erro", frase: releu
      ? `Combinado: o ${NOME_DO_ASSISTENTE} vai ler as conversas de novo, aos poucos (um pedaço por minuto).`
      : "Pedi a leitura de novo, mas não consegui reler as notas para conferir. Feche e abra esta aba." });
  }

  function linhaDasNotas(chave, nome, linha, recuo) {
    const estaAberta = linha && aberta === linha.id;
    const recadoDela = linha && recado && recado.id === linha.id ? recado : null;
    const situacao = !linha ? "ainda sem notas"
      : !linha.mensagens_lidas && !linha.aprendido_em ? "ainda não leu nada"
      : `leu ${Number(linha.mensagens_lidas || 0).toLocaleString("pt-BR")} mensagens${linha.aprendido_em ? ` · última leitura em ${quandoFoi(linha.aprendido_em)}` : ""}`;
    const texto = linha ? (textos[linha.id] ?? linha.texto ?? "") : "";
    const mudou = Boolean(linha && textos[linha.id] != null && textos[linha.id] !== linha.texto);
    const grande = texto.length > TETO_DAS_NOTAS;
    return (
      <div key={chave} data-notas-do-copiloto={linha ? linha.id : "sem-linha"} data-notas-de={nome}
           style={{ marginLeft: recuo ? 14 : 0, borderTop: `1px solid ${C.divider}` }}>
        <button data-notas-abrir disabled={!linha}
                onClick={() => linha && setAberta(estaAberta ? null : linha.id)}
                aria-expanded={Boolean(estaAberta)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 2px",
                         border: "none", background: "transparent", cursor: linha ? "pointer" : "default",
                         color: C.textPrimary, textAlign: "left" }}>
          {linha ? (estaAberta ? <ChevronDown size={15} color={C.textSecondary} /> : <ChevronRight size={15} color={C.textSecondary} />)
                 : <span style={{ width: 15 }} />}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: recuo ? 400 : 600 }}>{nome}</span>
            <span data-notas-situacao style={{ display: "block", fontSize: 12, color: C.textSecondary }}>{situacao}</span>
          </span>
        </button>
        {estaAberta && (
          <div style={{ padding: "0 2px 10px 23px" }}>
            {!texto.trim() && textos[linha.id] == null && (
              <div data-notas-vazias style={{ ...cx.dica, marginBottom: 6 }}>
                Ainda não há notas aqui: o {NOME_DO_ASSISTENTE} lê as conversas aos poucos, e elas aparecem depois da primeira leitura.
              </div>
            )}
            <textarea data-notas-texto value={texto} rows={10}
                      onChange={(e) => { const v = e.target.value; setTextos((atual) => ({ ...atual, [linha.id]: v })); setRecado(null); }}
                      style={{ ...cx.campo, width: "100%", boxSizing: "border-box", resize: "vertical",
                               fontFamily: "inherit", lineHeight: 1.45 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button data-notas-salvar style={{ ...cx.botao, opacity: mudou && !grande ? 1 : 0.5,
                                                 cursor: mudou && !grande ? "pointer" : "default" }}
                      disabled={!mudou || grande || Boolean(ocupado)} onClick={() => salvar(linha)}>
                {ocupado === linha.id && mudou ? "Salvando…" : "Salvar as notas"}
              </button>
              <button data-notas-ler-de-novo style={cx.botaoFraco} disabled={Boolean(ocupado)}
                      onClick={() => lerDeNovo(linha, nome)}>Ler tudo de novo</button>
              <span data-notas-conta style={{ fontSize: 12, color: grande ? C.erroTexto : C.textSecondary }}>
                {texto.length.toLocaleString("pt-BR")}/{TETO_DAS_NOTAS.toLocaleString("pt-BR")}
                {grande ? " — passou do limite" : ""}
              </span>
            </div>
            {linha.editado_em && (
              <div data-notas-editadas style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
                Corrigidas à mão por {nomeDe(nomes, linha.editado_por)} em {quandoFoi(linha.editado_em)}.
              </div>
            )}
          </div>
        )}
        {recadoDela && (
          <div data-notas-recado={recadoDela.tipo}
               style={{ padding: "0 2px 10px 23px", fontSize: 12.5, color: recadoDela.tipo === "ok" ? C.verdeTexto : C.erroTexto }}>
            {recadoDela.frase}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={cx.secao} data-notas-do-copiloto-secao>
      <div style={cx.titulo}><BookOpen size={16} color={C.green} /> O que o {NOME_DO_ASSISTENTE} aprendeu lendo as conversas</div>
      <div data-copiloto-leitura={leitura.tipo}
           style={{ ...cx.dica, color: leitura.tipo === "lendo" ? C.verdeTexto
                                  : leitura.tipo === "perguntando" ? C.textSecondary : C.ambarTexto }}>
        {leitura.frase}
      </div>
      <div style={cx.dica}>
        São notas, e não regras: as perguntas de sempre, como a equipe responde, o que não se faz. O
        {NOME_DO_ASSISTENTE} não guarda dado de cliente nelas (CPF, processo, telefone, e-mail). Se algo estiver
        errado, corrija o texto: ele continua a partir do que você escreveu. As notas internas da
        equipe nunca são lidas.
      </div>
      {lido === null && (
        <div style={{ ...cx.dica, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="zv-girando" /> Lendo as notas…
        </div>
      )}
      {lido && lido.erro && (
        <div data-notas-erro style={{ fontSize: 13, color: C.erroTexto, lineHeight: 1.5 }}>
          {lido.erro}{" "}
          <button style={cx.botaoFraco} onClick={() => { setLido(null); ler(); }}>Tentar de novo</button>
        </div>
      )}
      {lido && lido.linhas && (
        <div>
          {grupos.map((g) => (
            <div key={g.chave} data-notas-grupo={g.nome}>
              {g.chave === "sem"
                ? <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, padding: "8px 2px", borderTop: `1px solid ${C.divider}` }}>{g.nome}</div>
                : linhaDasNotas(g.chave, g.nome, g.linha, false)}
              {g.fones.map((t) => linhaDasNotas(`t${t.id}`, rotuloDoTelefone(t), linhaDoTelefone(t), true))}
            </div>
          ))}
          {grupos.length === 0 && (
            <div style={{ ...cx.dica, marginBottom: 0 }}>Nenhum telefone cadastrado ainda.</div>
          )}
        </div>
      )}
    </div>
  );
}
