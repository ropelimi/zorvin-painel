import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { X, Plus, Trash2, Check, Loader2, Building2, Layers, Phone, ShieldCheck } from "lucide-react";

// ============================================================
//  DEPARTAMENTOS, GRUPOS E PERMISSÕES
//
//  Três coisas nesta tela, nesta ordem, porque uma depende da outra:
//
//    1. DEPARTAMENTO  — onde os telefones nossos ficam agrupados
//                       (Advogados, SAC, Vendas, Interno…)
//    2. GRUPO         — que TIPO de conversa é, dentro do departamento.
//                       Existe porque o telefone sozinho não separa: nos
//                       números dos advogados acontecem tanto os acordos
//                       (conversa com o réu) quanto as audiências (conversa
//                       com o cliente). Quem separa é quem está do outro
//                       lado, e o Vantoro já sabe dizer isso.
//    3. PERMISSÃO     — quem enxerga o quê. Vale por departamento, por grupo
//                       ou por telefone; e as três podem se combinar.
//
//  Quem manda de verdade é o banco (as regras de visibilidade). Esta tela é
//  só o jeito de escrever nelas — se ela errasse, o banco continuaria negando.
// ============================================================

// As classificações que o Vantoro sabe fazer. O nome do grupo é livre; o que
// se escolhe aqui é QUAL conversa ele recebe.
const REGRAS = [
  { valor: "ACORDO", rotulo: "Acordos — conversa com o réu ou o advogado dele" },
  { valor: "CLIENTE", rotulo: "Clientes — conversa com quem é nosso cliente (audiências, SAC)" },
  { valor: "LEAD", rotulo: "Vendas — quem chegou por anúncio e ainda não é cliente" },
  { valor: "INTERNO", rotulo: "Interno — RH, cadastro, fornecedores" },
  { valor: "DESCONHECIDA", rotulo: "Sem identificar — número que não está no cadastro" },
];

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
  const [grupos, setGrupos] = useState([]);
  const [telefones, setTelefones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [aba, setAba] = useState("estrutura"); // 'estrutura' | 'pessoas'
  const [salvando, setSalvando] = useState("");

  const recarregar = useCallback(async () => {
    setErro("");
    const [d, g, t, u, p] = await Promise.all([
      supabase.from("departamentos").select("*").order("ordem"),
      supabase.from("grupos").select("*").order("ordem"),
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
    setGrupos(g.data || []);
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
    if (m.includes("grupos_frente_unica")) return "Já existe um grupo com essa regra neste departamento.";
    if (m.includes("grupos_padrao_unico")) return "Este departamento já tem um grupo para “o que sobrar”.";
    if (m.includes("departamentos_slug_key")) return "Já existe um departamento com esse nome.";
    if (m.includes("grupos_departamento_id_slug_key")) return "Já existe um grupo com esse nome neste departamento.";
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

  function criarGrupo(depId, nome, frente) {
    if (!nome.trim() || !frente) return;
    gravar("grupo", () => supabase.from("grupos").insert({
      departamento_id: depId, nome: nome.trim(), slug: paraSlug(nome),
      cor: CORES[grupos.length % CORES.length], regra: "frente", frente,
      ordem: (grupos.filter((g) => g.departamento_id === depId).length + 1) * 10,
    }));
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
    if (p.grupo_id) {
      const g = grupos.find((x) => x.id === p.grupo_id);
      partes.push(g ? `${nomeDep(g.departamento_id)} · ${g.nome}` : "grupo removido");
    }
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
          <button style={cx.aba(aba === "estrutura")} onClick={() => setAba("estrutura")}>Departamentos e grupos</button>
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
                  Vendas, Interno. Ele já nasce com um grupo “Outras”, onde cai o que
                  não se encaixar em nenhum outro.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={novoDep} onChange={(e) => setNovoDep(e.target.value)} placeholder="Nome do departamento"
                         style={{ ...cx.campo, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && criarDepartamento()} />
                  <button style={cx.botao} onClick={criarDepartamento}><Plus size={15} /> Criar</button>
                </div>
              </div>

              {departamentos.map((d) => (
                <Departamento key={d.id} d={d} cx={cx} C={C}
                  grupos={grupos.filter((g) => g.departamento_id === d.id)}
                  telefones={telefones}
                  aoRenomear={(nome) => gravar("dep", () => supabase.from("departamentos").update({ nome }).eq("id", d.id))}
                  aoApagar={() => gravar("dep", () => supabase.from("departamentos").delete().eq("id", d.id))}
                  aoCriarGrupo={(nome, frente) => criarGrupo(d.id, nome, frente)}
                  aoRenomearGrupo={(id, nome) => gravar("grupo", () => supabase.from("grupos").update({ nome }).eq("id", id))}
                  aoApagarGrupo={(id) => gravar("grupo", () => supabase.from("grupos").delete().eq("id", id))}
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
                    <NovoAcesso cx={cx} departamentos={departamentos} grupos={grupos}
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

// ---------- um departamento, com seus grupos e telefones ----------
function Departamento({ d, cx, C, grupos, telefones, aoRenomear, aoApagar, aoCriarGrupo,
                        aoRenomearGrupo, aoApagarGrupo, aoMoverTelefone }) {
  const [nome, setNome] = useState(d.nome);
  const [novoGrupo, setNovoGrupo] = useState("");
  const [novaFrente, setNovaFrente] = useState("");
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
                  if (confirm(`Apagar o departamento “${d.nome}”? Os grupos dele também saem.`)) aoApagar();
                }}>
          <Trash2 size={13} /> Apagar
        </button>
      </div>

      <div style={{ ...cx.titulo, fontSize: 13 }}><Layers size={14} /> Grupos</div>
      <div style={cx.dica}>
        O grupo separa os tipos de conversa dentro dos mesmos telefones. Quem decide
        em qual grupo a conversa cai é <b>quem está do outro lado</b> — o Vantoro
        reconhece pelo cadastro. O nome é seu: pode chamar de “Audiências” o grupo
        que recebe as conversas com clientes.
      </div>
      {grupos.map((g) => (
        <LinhaGrupo key={g.id} g={g} cx={cx} aoRenomear={aoRenomearGrupo} aoApagar={aoApagarGrupo} />
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} placeholder="Nome do grupo (ex.: Audiências)"
               style={{ ...cx.campo, flex: "1 1 180px" }} />
        <select value={novaFrente} onChange={(e) => setNovaFrente(e.target.value)} style={{ ...cx.campo, flex: "2 1 260px" }}>
          <option value="">Recebe as conversas de…</option>
          {REGRAS.map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
        </select>
        <button style={cx.botao} disabled={!novoGrupo.trim() || !novaFrente}
                onClick={() => { aoCriarGrupo(novoGrupo, novaFrente); setNovoGrupo(""); setNovaFrente(""); }}>
          <Plus size={14} /> Criar grupo
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

function LinhaGrupo({ g, cx, aoRenomear, aoApagar }) {
  const [nome, setNome] = useState(g.nome);
  const regra = REGRAS.find((r) => r.valor === g.frente);
  return (
    <div style={cx.linha}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.cor, flexShrink: 0 }} />
      <input value={nome} onChange={(e) => setNome(e.target.value)}
             onBlur={() => nome.trim() && nome !== g.nome && aoRenomear(g.id, nome.trim())}
             style={{ ...cx.campo, flex: "1 1 150px" }} />
      <span style={{ flex: "2 1 220px", fontSize: 12.5, color: "#8696a0" }}>
        {g.regra === "padrao" ? "o que não se encaixar em nenhum outro grupo" : (regra ? regra.rotulo : g.frente)}
      </span>
      {/* O balaio não pode ser apagado: sem ele, conversa que não casa com
          nenhuma regra fica sem grupo — e some da tela de quem tem acesso por
          grupo, sem avisar ninguém. */}
      {g.regra !== "padrao" && (
        <button style={{ ...cx.botaoFraco, color: "#c0392b" }}
                onClick={() => confirm(`Apagar o grupo “${g.nome}”?`) && aoApagar(g.id)}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ---------- montar uma linha de permissão ----------
function NovoAcesso({ cx, departamentos, grupos, telefones, aoConceder }) {
  const [dep, setDep] = useState("");
  const [grupo, setGrupo] = useState("");
  const [tel, setTel] = useState("");
  const gruposDoDep = grupos.filter((g) => !dep || String(g.departamento_id) === String(dep));
  const telsDoDep = telefones.filter((t) => !dep || String(t.departamento_id) === String(dep));
  const nada = !dep && !grupo && !tel;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={dep} onChange={(e) => { setDep(e.target.value); setGrupo(""); setTel(""); }}
                style={{ ...cx.campo, flex: "1 1 170px" }}>
          <option value="">Departamento — todos</option>
          {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)} style={{ ...cx.campo, flex: "1 1 170px" }}>
          <option value="">Grupo — todos</option>
          {gruposDoDep.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <select value={tel} onChange={(e) => setTel(e.target.value)} style={{ ...cx.campo, flex: "1 1 170px" }}>
          <option value="">Telefone — todos</option>
          {telsDoDep.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12.5, color: "#8696a0", margin: "8px 0" }}>
        {nada
          ? "Escolha ao menos um. Deixar os três em “todos” daria acesso a tudo sem dizer isso em lugar nenhum — por isso não é aceito."
          : "Só entra o que bater em TUDO que você escolheu. Escolher o departamento e o grupo dá acesso àquele grupo daquele departamento, e a mais nada."}
      </div>
      <button style={{ ...cx.botao, opacity: nada ? 0.5 : 1 }} disabled={nada}
              onClick={() => {
                aoConceder({
                  departamento_id: dep || null,
                  grupo_id: grupo || null,
                  telefone_id: tel || null,
                });
                setDep(""); setGrupo(""); setTel("");
              }}>
        <Check size={15} /> Dar este acesso
      </button>
    </div>
  );
}
