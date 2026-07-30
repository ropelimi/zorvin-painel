import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { X, Plus, Trash2, Check, Loader2, Building2, Phone, ShieldCheck } from "lucide-react";

// ============================================================
//  DEPARTAMENTOS, TELEFONES E PERMISSÕES
//
//  Duas coisas nesta tela, nesta ordem, porque uma depende da outra:
//
//    1. DEPARTAMENTO  — onde os telefones nossos ficam agrupados
//                       (Advogados, SAC, Vendas, Interno…)
//    2. PERMISSÃO     — quem enxerga o quê. Vale por departamento ou por
//                       telefone, e as duas se combinam.
//
//  O GRUPO SAIU. Ele era um terceiro degrau entre os dois, e existia para um
//  problema só: nos números dos advogados aconteciam tanto os acordos (conversa
//  com o réu) quanto as audiências (conversa com o cliente), e o telefone
//  sozinho não separava. O aviso de audiência passou a sair de um telefone
//  próprio — e aí o telefone voltou a responder a pergunta sozinho.
//
//  O que ficou do grupo foi o estorvo: uma etiqueta colorida em cada conversa,
//  idêntica às tags que a equipe cria à mão, dizendo "Sem identificar" em quase
//  toda linha da lista (é o balaio de quem ainda não tem ficha). Ninguém tinha
//  criado nenhuma delas — nasciam de um gatilho no banco e de um INSERT da
//  migração. Uma dimensão que não separa mais nada não é neutra: é mais uma
//  caixa para marcar errado.
//
//  Quem manda de verdade é o banco (as regras de visibilidade). Esta tela é
//  só o jeito de escrever nelas — se ela errasse, o banco continuaria negando.
// ============================================================

const CORES = ["#c98a2e", "#2e9e6b", "#3d7dd6", "#8a72c9", "#d2555f", "#2ea3a8", "#7b8794"];

function semAcento(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function paraSlug(nome) {
  return semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default function Departamentos({ C, aoFechar }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [departamentos, setDepartamentos] = useState([]);
  const [telefones, setTelefones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [aba, setAba] = useState("estrutura"); // 'estrutura' | 'pessoas'
  const [salvando, setSalvando] = useState("");

  const recarregar = useCallback(async () => {
    setErro("");
    const [d, g, t, u, p] = await Promise.all([
      supabase.from("departamentos").select("*").order("ordem"),
      supabase.from("advogados").select("id, nome, numero, departamento_id, ativo").order("nome"),
      supabase.from("usuarios").select("*").order("nome"),
      supabase.from("permissoes").select("*"),
    ]);
    const falhou = [d, g, t, u, p].find((r) => r.error);
    if (falhou) {
      // A causa quase sempre é a mesma: o SQL de departamentos ainda não foi
      // rodado no Supabase. Dizer isso poupa uma hora de procura.
      setErro(`Não consegui ler os cadastros (${falhou.error.message}). ` +
              "Se esta é a primeira vez, falta rodar o SQL de departamentos no Supabase.");
    }
    setDepartamentos(d.data || []);
    setTelefones(t.data || []);
    setUsuarios(u.data || []);
    setPermissoes(p.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  // Toda gravação passa por aqui: mostra que está salvando, recarrega no fim e
  // transforma erro do banco em mensagem na tela — nunca numa tela em branco.
  async function gravar(rotulo, fn) {
    setSalvando(rotulo); setErro("");
    const { error } = await fn();
    if (error) setErro(traduzir(error.message));
    await recarregar();
    setSalvando("");
  }

  function traduzir(msg) {
    const m = String(msg || "");
    if (m.includes("departamentos_slug_key")) return "Já existe um departamento com esse nome.";
    if (m.toLowerCase().includes("row-level security") || m.toLowerCase().includes("policy")) {
      return "Só quem é administrador no Vantoro pode mexer aqui.";
    }
    return m;
  }

  // ---------- estrutura ----------
  const [novoDep, setNovoDep] = useState("");
  function criarDepartamento() {
    const nome = novoDep.trim();
    if (!nome) return;
    // O balaio ("o que sobrar") é criado pelo próprio banco, por gatilho — não
    // depende desta tela lembrar de criá-lo.
    gravar("dep", () => supabase.from("departamentos").insert({
      nome, slug: paraSlug(nome), cor: CORES[departamentos.length % CORES.length],
      ordem: (departamentos.length + 1) * 10,
    }));
    setNovoDep("");
  }

  // ---------- permissões ----------
  const [pessoaId, setPessoaId] = useState(null);
  const pessoa = usuarios.find((u) => u.id === pessoaId) || null;
  const minhas = permissoes.filter((p) => p.usuario_id === pessoaId);

  function conceder(campos) {
    gravar("perm", () => supabase.from("permissoes").insert({ usuario_id: pessoaId, ...campos }));
  }
  function revogar(id) {
    gravar("perm", () => supabase.from("permissoes").delete().eq("id", id));
  }

  // Como uma linha de permissão se lê em português. Cada dimensão preenchida
  // aperta mais o filtro; ler "Advogados · Audiências" é ler a regra inteira.
  function descrever(p) {
    const partes = [];
    if (p.departamento_id) partes.push(nomeDep(p.departamento_id));
    if (p.telefone_id) {
      const t = telefones.find((x) => x.id === p.telefone_id);
      partes.push(t ? `telefone de ${t.nome}` : "telefone removido");
    }
    return partes.join("  +  ");
  }
  function nomeDep(id) {
    const d = departamentos.find((x) => x.id === id);
    return d ? d.nome : "departamento removido";
  }

  const cx = {
    fundo: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    caixa: { background: C.panel, color: C.textPrimary, borderRadius: 16, width: "100%", maxWidth: 880, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.35)" },
    topo: { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.divider}`, background: C.headerBar },
    corpo: { padding: 18, overflowY: "auto", flex: 1 },
    secao: { border: `1px solid ${C.divider}`, borderRadius: 12, padding: 14, marginBottom: 14 },
    titulo: { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, marginBottom: 4 },
    dica: { fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginBottom: 10 },
    campo: { border: `1px solid ${C.divider}`, background: C.inputBg, color: C.textPrimary, borderRadius: 8, padding: "7px 10px", fontSize: 13.5, outline: "none" },
    botao: { border: "none", background: C.green, color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
    botaoFraco: { border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary, borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
    linha: { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.divider}`, flexWrap: "wrap" },
    aba: (on) => ({ border: `1px solid ${on ? C.green : C.divider}`, background: on ? C.green : "transparent", color: on ? "#fff" : C.textSecondary, borderRadius: 20, padding: "5px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  };

  return (
    <div style={cx.fundo} onClick={aoFechar}>
      <div style={cx.caixa} onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes zv-girar { to { transform: rotate(360deg); } } .zv-girando { animation: zv-girar 1s linear infinite; }`}</style>
        <div style={cx.topo}>
          <ShieldCheck size={19} color={C.green} />
          <b style={{ fontSize: 15.5, flex: 1 }}>Departamentos e acessos</b>
          {salvando && <Loader2 size={16} className="zv-girando" color={C.textSecondary} />}
          <button onClick={aoFechar} style={{ ...cx.botaoFraco, padding: 6 }} aria-label="Fechar"><X size={16} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 18px 0" }}>
          <button style={cx.aba(aba === "estrutura")} onClick={() => setAba("estrutura")}>Departamentos e telefones</button>
          <button style={cx.aba(aba === "pessoas")} onClick={() => setAba("pessoas")}>Quem vê o quê</button>
        </div>

        <div style={cx.corpo}>
          {erro && (
            <div style={{ background: "#fdecea", border: "1px solid #f5c2c0", color: "#a32b2b", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 14 }}>{erro}</div>
          )}
          {carregando && <div style={{ color: C.textSecondary, fontSize: 14 }}>Carregando…</div>}

          {!carregando && aba === "estrutura" && (
            <>
              <div style={cx.secao}>
                <div style={cx.titulo}><Building2 size={16} /> Novo departamento</div>
                <div style={cx.dica}>
                  Um departamento é um conjunto de telefones nossos — Advogados, SAC,
                  Vendas, Interno. Depois, traga para ele os telefones que atendem
                  por ali.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={novoDep} onChange={(e) => setNovoDep(e.target.value)} placeholder="Nome do departamento"
                         style={{ ...cx.campo, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && criarDepartamento()} />
                  <button style={cx.botao} onClick={criarDepartamento}><Plus size={15} /> Criar</button>
                </div>
              </div>

              {departamentos.map((d) => (
                <Departamento key={d.id} d={d} cx={cx} C={C}
                  telefones={telefones}
                  aoRenomear={(nome) => gravar("dep", () => supabase.from("departamentos").update({ nome }).eq("id", d.id))}
                  aoApagar={() => gravar("dep", () => supabase.from("departamentos").delete().eq("id", d.id))}
                  aoMoverTelefone={(telId) => gravar("tel", () => supabase.from("advogados").update({ departamento_id: d.id }).eq("id", telId))}
                />
              ))}
            </>
          )}

          {!carregando && aba === "pessoas" && (
            <>
              <div style={cx.secao}>
                <div style={cx.titulo}><ShieldCheck size={16} /> Quem vê o quê</div>
                <div style={cx.dica}>
                  Escolha a pessoa e diga o que ela alcança. Os acessos <b>somam</b>:
                  ela enxerga a união de tudo que estiver na lista dela. Sem nenhum
                  item, ela entra e não vê conversa nenhuma. Quem é administrador no
                  Vantoro vê tudo, sem precisar de linha aqui.
                </div>
                <select value={pessoaId || ""} onChange={(e) => setPessoaId(e.target.value || null)}
                        style={{ ...cx.campo, width: "100%" }}>
                  <option value="">Escolha a pessoa…</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome || u.login}{u.admin ? " — administrador (vê tudo)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {pessoa && !pessoa.admin && (
                <div style={cx.secao}>
                  <div style={cx.titulo}>Acessos de {pessoa.nome || pessoa.login}</div>
                  {minhas.length === 0 && (
                    <div style={{ ...cx.dica, marginBottom: 12 }}>
                      Sem nenhum acesso. Hoje esta pessoa entra e não enxerga conversa alguma.
                    </div>
                  )}
                  {minhas.map((p) => (
                    <div key={p.id} style={cx.linha}>
                      <span style={{ flex: 1, fontSize: 13.5 }}>{descrever(p)}</span>
                      <button style={{ ...cx.botaoFraco, color: "#c0392b" }} onClick={() => revogar(p.id)}>
                        <Trash2 size={13} /> Tirar
                      </button>
                    </div>
                  ))}

                  <div style={{ marginTop: 14 }}>
                    <div style={{ ...cx.titulo, fontSize: 13 }}><Plus size={14} /> Dar acesso a…</div>
                    <NovoAcesso cx={cx} departamentos={departamentos}
                                telefones={telefones} aoConceder={conceder} />
                  </div>
                </div>
              )}
              {pessoa && pessoa.admin && (
                <div style={cx.secao}>
                  <div style={cx.dica}>
                    <b>{pessoa.nome || pessoa.login}</b> é administrador no Vantoro e por isso
                    enxerga tudo aqui. Para restringir, tire o superusuário dela no Vantoro.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- um departamento, com os telefones que atendem por ele ----------
function Departamento({ d, cx, C, telefones, aoRenomear, aoApagar, aoMoverTelefone }) {
  const [nome, setNome] = useState(d.nome);
  const meus = telefones.filter((t) => t.departamento_id === d.id);
  const soltos = telefones.filter((t) => !t.departamento_id);

  return (
    <div style={{ ...cx.secao, borderLeft: `4px solid ${d.cor || C.green}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input value={nome} onChange={(e) => setNome(e.target.value)}
               onBlur={() => nome.trim() && nome !== d.nome && aoRenomear(nome.trim())}
               style={{ ...cx.campo, flex: 1, fontWeight: 700 }} />
        <button style={{ ...cx.botaoFraco, color: "#c0392b" }}
                onClick={() => {
                  if (meus.length) return alert("Mova os telefones para outro departamento antes de apagar este.");
                  if (confirm(`Apagar o departamento “${d.nome}”?`)) aoApagar();
                }}>
          <Trash2 size={13} /> Apagar
        </button>
      </div>

      <div style={{ ...cx.titulo, fontSize: 13, marginTop: 16 }}><Phone size={14} /> Telefones deste departamento</div>
      {meus.length === 0 && <div style={cx.dica}>Nenhum telefone aqui ainda.</div>}
      {meus.map((t) => (
        <div key={t.id} style={{ ...cx.linha, fontSize: 13.5 }}>
          <span style={{ flex: 1 }}>{t.nome} <span style={{ color: "#8696a0" }}>· {t.numero}</span></span>
          {!t.ativo && <span style={{ fontSize: 11.5, color: "#8696a0" }}>inativo</span>}
        </div>
      ))}
      {soltos.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <select defaultValue="" onChange={(e) => e.target.value && aoMoverTelefone(e.target.value)}
                  style={{ ...cx.campo, width: "100%" }}>
            <option value="">Trazer um telefone sem departamento para cá…</option>
            {soltos.map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.numero}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function NovoAcesso({ cx, departamentos, telefones, aoConceder }) {
  const [dep, setDep] = useState("");
  const [tel, setTel] = useState("");
  const telsDoDep = telefones.filter((t) => !dep || String(t.departamento_id) === String(dep));
  const nada = !dep && !tel;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={dep} onChange={(e) => { setDep(e.target.value); setTel(""); }}
                style={{ ...cx.campo, flex: "1 1 170px" }}>
          <option value="">Departamento — todos</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select value={tel} onChange={(e) => setTel(e.target.value)} style={{ ...cx.campo, flex: "1 1 170px" }}>
          <option value="">Telefone — todos</option>
          {telsDoDep.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12.5, color: "#8696a0", margin: "8px 0" }}>
        {nada
          ? "Escolha ao menos um. Deixar os dois em “todos” daria acesso a tudo sem dizer isso em lugar nenhum — por isso não é aceito."
          : "Só entra o que bater em TUDO que você escolheu. Escolher o departamento e o telefone dá acesso àquele telefone, e a mais nada."}
      </div>
      <button style={{ ...cx.botao, opacity: nada ? 0.5 : 1 }} disabled={nada}
              onClick={() => {
                aoConceder({
                  departamento_id: dep || null,
                  telefone_id: tel || null,
                });
                setDep(""); setTel("");
              }}>
        <Check size={15} /> Dar este acesso
      </button>
    </div>
  );
}
