import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { SquareKanban, Plus, Loader2, Check, EyeOff, Eye, ArrowUp, ArrowDown, Sparkles } from "lucide-react";

// ============================================================
//  AS ETAPAS DO FUNIL — na aba Estrutura da administração (06/10)
//
//  UM FUNIL POR DEPARTAMENTO (decisão do Rodrigo): a seção escolhe o
//  departamento e mostra as etapas dele, na ordem das colunas.
//
//  A RÉGUA É A DOS ASSUNTOS DO "JÁ TRATEI", e pelas mesmas razões:
//
//    - ETAPA NÃO SE APAGA, DESATIVA-SE. O histórico dos movimentos guarda o id
//      da etapa, e apagar deixaria "de onde para onde" apontando para o nada.
//      Os clientes de uma etapa desativada NÃO somem: o funil os põe na coluna
//      "Em etapas desativadas" até alguém movê-los;
//    - RENOMEAR CONSERTA O PASSADO inteiro — bom para erro de digitação, ruim
//      para trocar de etapa (a dica diz isso);
//    - toda gravação RELÊ do servidor, em vez de encaixar a linha na tela.
//
//  A ORDEM É TROCADA DE DOIS EM DOIS (subir/descer), trocando a `ordem` das
//  duas vizinhas. Arrastar seria mais bonito e é um segundo jeito de errar
//  num lugar que se mexe uma vez por ano.
//
//  O DEPARTAMENTO SEM ETAPA NENHUMA (criado depois do script 017) ganha o
//  botão "Criar as etapas sugeridas" — as mesmas sete que o script semeia.
// ============================================================

export const ETAPAS_SUGERIDAS = [
  ["Novo contato", "#53bdeb"], ["Em atendimento", "#00a884"], ["Aguardando cliente", "#ffb02e"],
  ["Proposta/acordo enviado", "#a78bfa"], ["Acordo fechado", "#25d366"], ["Em execução", "#0ea5e9"],
  ["Encerrado", "#8696a0"],
];
const CORES = ["#53bdeb", "#00a884", "#ffb02e", "#a78bfa", "#25d366", "#0ea5e9", "#f472b6", "#e5573f", "#8696a0"];

export function EtapasDoFunil({ cx, C, departamentos = [], aoAvisar }) {
  const [existe, setExiste] = useState(null);   // null = ainda lendo
  const [depId, setDepId] = useState(() => (departamentos[0] || {}).id ?? null);
  const [etapas, setEtapas] = useState([]);
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null);   // { id, nome }

  // Os departamentos chegam depois da primeira pintura (Departamentos lê o
  // banco): sem isto a seção ficaria presa em "nenhum departamento".
  useEffect(() => {
    if (depId == null && departamentos.length) setDepId(departamentos[0].id);
  }, [departamentos, depId]);

  // A RESPOSTA MAIS NOVA VENCE, e a lista é DO DEPARTAMENTO ESCOLHIDO
  // (auditoria de 07/10): trocando de departamento, as etapas do anterior
  // continuavam na tela sob o nome do novo até a leitura voltar — ou para
  // sempre, se ela voltasse fora de ordem —, e renomear, reordenar e conferir
  // nome repetido agiam sobre a lista errada.
  const pedido = useRef(0);
  const jaLeu = useRef(false);
  const ler = useCallback(async () => {
    if (depId == null) return;
    const meu = ++pedido.current;
    const { data, error } = await supabase.from("zorvin_etapas").select("*")
      .eq("departamento_id", depId).order("ordem");
    if (meu !== pedido.current) return;
    if (error) {
      // A tabela que falta (o script 017 não rodou) é o único caso em que
      // sumir é o certo.
      if (semATabela(error)) { setExiste(false); return; }
      // SÓ A PRIMEIRA LEITURA ESCONDE A SEÇÃO numa falha; depois disso, um
      // tropeço ao trocar de departamento não pode sumir com ela.
      if (!jaLeu.current) setExiste(false);
      aoAvisar(comOCodigo("Não consegui ler as etapas do funil.", error, "etapas"));
      return;
    }
    jaLeu.current = true;
    setExiste(true);
    setEtapas(data || []);
  }, [depId, aoAvisar]);

  useEffect(() => { setEtapas([]); ler(); }, [ler]);

  const recusado = "o banco não deixou. Só quem administra o Zorvin pode mexer nas etapas.";

  async function criar(nomes) {
    const lista = nomes.map((n) => (Array.isArray(n) ? n : [n, null]));
    for (const [nome] of lista) {
      if (etapas.some((e) => e.ativo !== false && e.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
        aoAvisar(`Já existe uma etapa chamada “${nome}” neste funil.`);
        return;
      }
    }
    setOcupado(true); aoAvisar("");
    const maior = etapas.reduce((m, e) => Math.max(m, e.ordem || 0), 0);
    const linhas = lista.map(([nome, cor], i) => ({
      departamento_id: depId, nome, ordem: maior + (i + 1) * 10,
      cor: cor || CORES[(etapas.length + i) % CORES.length],
    }));
    const r = await supabase.from("zorvin_etapas").insert(linhas).select("id");
    setOcupado(false);
    if (r.error) { aoAvisar(comOCodigo("Não consegui criar a etapa.", r.error, "criar etapa")); return; }
    if (naoGravouNada(r)) { aoAvisar(`Não criou: ${recusado}`); return; }
    setNovo("");
    ler(false);
  }

  async function gravar(id, patch, oQueE) {
    setOcupado(true); aoAvisar("");
    const r = await supabase.from("zorvin_etapas").update(patch).eq("id", id).select("id");
    setOcupado(false);
    if (r.error) { aoAvisar(comOCodigo(`Não consegui ${oQueE}.`, r.error, "etapa")); return false; }
    if (naoGravouNada(r)) { aoAvisar(`Não deu para ${oQueE}: ${recusado}`); return false; }
    return true;
  }

  async function renomear() {
    const nome = (editando.nome || "").trim();
    if (!nome) { aoAvisar("A etapa não pode ficar sem nome."); return; }
    if (etapas.some((e) => e.id !== editando.id && e.ativo !== false
        && e.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
      aoAvisar(`Já existe uma etapa chamada “${nome}” neste funil.`);
      return;
    }
    if (await gravar(editando.id, { nome }, "renomear a etapa")) { setEditando(null); ler(false); }
  }

  // SUBIR/DESCER troca a `ordem` com a vizinha ATIVA: as desativadas não são
  // coluna, e pular por cima delas é o que a pessoa vê acontecer.
  async function trocar(etapa, sentido) {
    const ativas = etapas.filter((e) => e.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const i = ativas.findIndex((e) => e.id === etapa.id);
    const outra = ativas[i + sentido];
    if (!outra) return;
    const okA = await gravar(etapa.id, { ordem: outra.ordem }, "mudar a ordem");
    if (!okA) return;
    // A SEGUNDA METADE FALHANDO deixaria as duas com a mesma ordem. Não é
    // estrago (o desempate é a data de criação), e a frase diz o que houve.
    const okB = await gravar(outra.id, { ordem: etapa.ordem }, "mudar a ordem");
    if (!okB) aoAvisar("A ordem mudou pela metade — confira as etapas e tente de novo.");
    ler(false);
  }

  if (existe === false || !departamentos.length) return null;

  const ativas = etapas.filter((e) => e.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const fora = etapas.filter((e) => e.ativo === false);
  const botaoFraco = { ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}` };

  return (
    <div style={cx.secao} data-etapas-do-funil>
      <div style={cx.titulo}><SquareKanban size={16} /> Etapas do funil</div>
      <div style={cx.dica}>
        Cada departamento tem o seu funil. As etapas são as colunas, nesta ordem. Os clientes novos entram
        sozinhos na primeira. <b>Renomear conserta o passado inteiro</b> — para trocar de etapa, use “Parar de
        usar” e crie uma nova. Os clientes de uma etapa que parou de ser usada não somem: ficam numa coluna
        própria até alguém movê-los.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select data-etapas-departamento value={depId ?? ""} onChange={(e) => { setEditando(null); setDepId(Number(e.target.value) || e.target.value); }}
                style={{ ...cx.campo, flex: "0 0 auto" }} aria-label="Departamento do funil">
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nova etapa" data-etapa-nova
               onKeyDown={(e) => e.key === "Enter" && !ocupado && novo.trim() && criar([novo.trim()])}
               style={{ ...cx.campo, flex: 1, minWidth: 140 }} />
        <button style={cx.botao} onClick={() => (novo.trim() ? criar([novo.trim()]) : aoAvisar("Escreva o nome da etapa."))}
                disabled={ocupado} data-etapa-criar>
          {ocupado ? <Loader2 size={14} className="zv-girando" /> : <Plus size={15} />} Criar
        </button>
      </div>

      {existe && etapas.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: C.textSecondary }}>Este departamento ainda não tem funil.</span>
          <button style={cx.botao} onClick={() => criar(ETAPAS_SUGERIDAS)} disabled={ocupado} data-etapas-sugeridas>
            <Sparkles size={15} /> Criar as etapas sugeridas
          </button>
        </div>
      )}

      {[...ativas, ...fora].map((e) => {
        const posicao = ativas.indexOf(e);
        return (
          <div key={e.id} data-etapa-da-config={e.nome}
               style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                        borderTop: `1px solid ${C.divider}`, opacity: e.ativo !== false ? 1 : 0.55, flexWrap: "wrap" }}>
            {editando && editando.id === e.id ? (
              <>
                <input value={editando.nome} autoFocus data-etapa-editando
                       onChange={(ev) => setEditando({ ...editando, nome: ev.target.value })}
                       onKeyDown={(ev) => { if (ev.key === "Enter") renomear(); if (ev.key === "Escape") setEditando(null); }}
                       style={{ ...cx.campo, flex: 1 }} />
                <button style={cx.botao} onClick={renomear} disabled={ocupado} data-etapa-salvar>
                  <Check size={15} /> Salvar
                </button>
                <button onClick={() => setEditando(null)} style={botaoFraco}>Cancelar</button>
              </>
            ) : (
              <>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.cor || C.green, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13.5, textDecoration: e.ativo !== false ? "none" : "line-through", minWidth: 120 }}>
                  {e.nome}
                  {e.ativo === false && <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textSecondary }}>fora de uso</span>}
                  {posicao === 0 && <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textSecondary }}>onde os novos entram</span>}
                </span>
                {e.ativo !== false && (
                  <>
                    <button onClick={() => trocar(e, -1)} disabled={ocupado || posicao <= 0} data-etapa-subir
                            title="Subir (vira a coluna da esquerda)" aria-label={`Subir ${e.nome}`} style={botaoFraco}>
                      <ArrowUp size={15} />
                    </button>
                    <button onClick={() => trocar(e, 1)} disabled={ocupado || posicao >= ativas.length - 1} data-etapa-descer
                            title="Descer (vira a coluna da direita)" aria-label={`Descer ${e.nome}`} style={botaoFraco}>
                      <ArrowDown size={15} />
                    </button>
                  </>
                )}
                <button onClick={() => setEditando({ id: e.id, nome: e.nome })} disabled={ocupado}
                        data-etapa-renomear style={botaoFraco}>
                  Renomear
                </button>
                <button onClick={async () => {
                          if (await gravar(e.id, { ativo: e.ativo === false }, e.ativo !== false ? "parar de usar a etapa" : "voltar a usar a etapa")) ler(false);
                        }}
                        disabled={ocupado} data-etapa-ativa={e.ativo !== false ? "sim" : "nao"} style={botaoFraco}>
                  {e.ativo !== false ? <EyeOff size={15} /> : <Eye size={15} />}
                  {e.ativo !== false ? "Parar de usar" : "Voltar a usar"}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EtapasDoFunil;
