import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { chamarPonte } from "./ponte.js";
import { X, Plus, Trash2, Loader2, Building2, Phone, ShieldCheck } from "lucide-react";

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
  const [aba, setAba] = useState("estrutura"); // 'estrutura' | 'pessoas'
  const [salvando, setSalvando] = useState("");
  // O que o BANCO acha: `null` = não deu para perguntar (base antiga, sem a
  // função), `true`/`false` = a resposta dele.
  const [adminNoBanco, setAdminNoBanco] = useState(null);
  // Sobe a cada releitura. Serve para os campos de texto voltarem ao que o
  // banco tem — inclusive quando o banco NÃO mudou, que é justamente o caso
  // em que o campo estava mentindo.
  const [releituras, setReleituras] = useState(0);

  const recarregar = useCallback(async () => {
    setErro("");
    // Pergunta ao BANCO se ele reconhece esta conta como administradora, com a
    // mesma função que as políticas usam para decidir. É a única resposta que
    // vale: o painel abre esta tela olhando só `usuarios.admin`, e o banco exige
    // `admin E ativo` — dá para ver a tela e mesmo assim não conseguir salvar
    // nada, que era exatamente o que acontecia sem nenhum aviso.
    const [d, t, adm] = await Promise.all([
      supabase.from("departamentos").select("*").order("ordem"),
      supabase.from("advogados").select("id, nome, numero, departamento_id, ativo").order("nome"),
      supabase.rpc("zorvin_admin"),
    ]);
    setAdminNoBanco(adm.error ? null : !!adm.data);
    const falhou = [d, t].find((r) => r.error);
    if (falhou) {
      // A causa quase sempre é a mesma: o SQL de departamentos ainda não foi
      // rodado no Supabase. Dizer isso poupa uma hora de procura.
      setErro(`Não consegui ler os cadastros (${falhou.error.message}). ` +
              "Se esta é a primeira vez, falta rodar o SQL de departamentos no Supabase.");
    }
    setDepartamentos(d.data || []);
    setTelefones(t.data || []);
    setReleituras((n) => n + 1);
    setCarregando(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  // Toda gravação passa por aqui: mostra que está salvando, recarrega no fim e
  // transforma erro do banco em mensagem na tela — nunca numa tela em branco.
  //
  // A ARMADILHA QUE FAZIA ESTA TELA "NÃO FUNCIONAR":
  //
  // Quando a RLS do Postgres barra um UPDATE ou um DELETE, ela NÃO devolve
  // erro. Ela simplesmente não encontra a linha: `error` vem nulo e zero linhas
  // são alteradas. Aqui isso passava por sucesso — a tela recarregava, o valor
  // voltava ao que era, e não havia nada escrito em lugar nenhum. Renomear um
  // departamento parecia não fazer efeito, e a pessoa tentava de novo.
  //
  // (Com INSERT é diferente: ali a RLS levanta erro de verdade. Foi por isso
  // que "Criar departamento" avisava e o resto ficava mudo.)
  //
  // O `.select("id")` no fim de cada gravação é o que revela isso: ele faz o
  // banco devolver as linhas que realmente mudaram. Nenhuma linha de volta =
  // não salvou, e agora a tela diz.
  async function gravar(rotulo, fn) {
    setSalvando(rotulo); setErro("");
    const { data, error } = await fn();
    // O `recarregar()` VEM ANTES de escrever a mensagem, e essa ordem é o
    // conserto principal desta tela.
    //
    // Ele começa com `setErro("")` — precisa, para não deixar erro velho na
    // tela. Só que aqui ele rodava DEPOIS, e apagava a mensagem que a linha
    // acima tinha acabado de escrever. Resultado: mesmo quando o banco recusava
    // com um erro claro, a tela ficava muda. Era isso que fazia esta tela
    // "não funcionar sem dizer nada".
    await recarregar();
    if (error) setErro(traduzir(error.message));
    else if (Array.isArray(data) && data.length === 0) setErro(SEM_PERMISSAO);
    setSalvando("");
  }

  const SEM_PERMISSAO =
    "Não salvou: o banco de dados não deixou. Isso acontece quando a sua conta " +
    "não está marcada como administradora no Zorvin — só ela pode mexer em " +
    "departamentos, telefones e acessos.";

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
          <button style={cx.aba(aba === "pessoas")} onClick={() => setAba("pessoas")}>Atendentes</button>
        </div>

        <div style={cx.corpo}>
          {erro && (
            /* As cores saem do tema, e não escritas à mão. No tema escuro, a
               caixa rosa-clara com letra vermelha ficava gritando no meio de
               uma tela escura — e a mensagem de erro é justamente a que
               precisa ser lida com calma. */
            <div role="alert" style={{ background: C.panel, border: "1px solid #e5573f", color: C.textPrimary, borderLeft: "4px solid #e5573f", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>{erro}</div>
          )}
          {/* O aviso vem ANTES de a pessoa tentar. Descobrir que não tinha
              permissão só depois de renomear três departamentos e ver os três
              voltarem ao nome antigo é o pior jeito de descobrir. */}
          {adminNoBanco === false && (
            <div style={{ background: C.panel, border: `1px solid ${C.divider}`, borderLeft: "4px solid #d99a1e", color: C.textPrimary, borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
              <b>Você consegue ver esta tela, mas não consegue salvar nada nela.</b><br />
              O banco de dados não reconhece a sua conta como administradora do
              Zorvin. Quem administra o Zorvin precisa liberar a sua conta —
              é uma marcação na tabela <code>usuarios</code> do Supabase
              (<code>admin</code> e <code>ativo</code>, as duas ligadas).
            </div>
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
                  telefones={telefones} departamentos={departamentos} releituras={releituras}
                  aoRenomear={(nome) => gravar("dep", () => supabase.from("departamentos").update({ nome }).eq("id", d.id).select("id"))}
                  aoApagar={() => gravar("dep", () => supabase.from("departamentos").delete().eq("id", d.id).select("id"))}
                  aoMoverTelefone={(telId) => gravar("tel", () => supabase.from("advogados").update({ departamento_id: d.id }).eq("id", telId).select("id"))}
                />
              ))}
            </>
          )}

          {!carregando && aba === "pessoas" && (
            <Atendentes cx={cx} C={C} departamentos={departamentos} telefones={telefones}
                        aoAvisar={setErro} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- um departamento, com os telefones que atendem por ele ----------
function Departamento({ d, cx, C, telefones, departamentos, releituras, aoRenomear, aoApagar, aoMoverTelefone }) {
  const nomeDoDepartamento = (id) =>
    (departamentos.find((x) => x.id === id) || {}).nome || "";
  const [nome, setNome] = useState(d.nome);
  // Volta ao que o BANCO tem A CADA RELEITURA — e não só quando o nome muda.
  //
  // Depender de `d.nome` não bastava justamente no caso que importa: se a
  // gravação foi recusada, o nome no banco continua o mesmo, o efeito não roda,
  // e o campo fica exibindo o nome novo como se tivesse sido salvo. A tela
  // dizia uma coisa e o banco tinha outra.
  useEffect(() => { setNome(d.nome); }, [d.nome, releituras]);
  const meus = telefones.filter((t) => t.departamento_id === d.id);
  // TODOS OS QUE NÃO ESTÃO AQUI — e não só os que não estão em lugar nenhum.
  //
  // A lista oferecia apenas os telefones SEM departamento. Quem pusesse um
  // número no departamento errado ficava sem saída: não havia como tirá-lo de
  // lá nem trazê-lo para cá, e a única correção era mexer no banco. Agora
  // aparecem também os que estão em outro departamento, dizendo de onde vêm —
  // sem isso, escolher um da lista seria uma mudança às cegas.
  const deFora = telefones.filter((t) => t.departamento_id !== d.id);

  return (
    <div style={{ ...cx.secao, borderLeft: `4px solid ${d.cor || C.green}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        {/* ENTER TAMBÉM SALVA.
            Só o `onBlur` salvava, e quem digita um nome novo aperta Enter — é o
            gesto. Não acontecia nada: nem salvava, nem avisava. A pessoa
            concluía que a tela estava quebrada e, se saísse dali sem clicar em
            outro lugar, o nome novo ia embora junto.
            O `blur()` no Enter reaproveita o mesmo caminho de sempre, em vez de
            criar um segundo jeito de gravar que pode divergir do primeiro. */}
        <input value={nome} onChange={(e) => setNome(e.target.value)}
               onBlur={() => nome.trim() && nome !== d.nome && aoRenomear(nome.trim())}
               onKeyDown={(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                 if (e.key === "Escape") { e.preventDefault(); setNome(d.nome); }
               }}
               aria-label={`Nome do departamento ${d.nome}`}
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
          <span style={{ flex: 1 }}>{t.nome} <span style={{ color: C.textSecondary }}>· {t.numero}</span></span>
          {!t.ativo && <span style={{ fontSize: 11.5, color: C.textSecondary }}>inativo</span>}
        </div>
      ))}
      {deFora.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {/* `value=""` fixo e sem `defaultValue`: a lista volta para "escolha
              um…" depois de mover, em vez de ficar mostrando o telefone que
              acabou de sair dela. Os dois juntos são o aviso do React de
              "controlado ou não controlado, escolha um". */}
          <select value=""
                  onChange={(e) => e.target.value && aoMoverTelefone(e.target.value)}
                  aria-label={`Trazer um telefone para o departamento ${d.nome}`}
                  style={{ ...cx.campo, width: "100%" }}>
            <option value="">Trazer um telefone para cá…</option>
            {deFora.map((t) => {
              const onde = nomeDoDepartamento(t.departamento_id);
              return (
                <option key={t.id} value={t.id}>
                  {t.nome} · {t.numero}{onde ? ` — hoje em ${onde}` : " — sem departamento"}
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}


// ============================================================
//  ATENDENTES — quem enxerga o quê, sem sair do Zorvin
//
//  Antes, dar acesso a alguém significava abrir o admin do Django. Quem
//  administra o escritório não faz isso, e o resultado era previsível: pedidos
//  de acesso esperando dias por alguém com o Django aberto.
//
//  A PERMISSÃO CONTINUA MORANDO NO VANTORO — esta tela é outra porta para o
//  mesmo dado, não um segundo lugar onde guardá-lo. Ela não escreve na tabela
//  `permissoes` daqui: a Ponte reescreve essas linhas a partir do Vantoro a cada
//  poucos minutos, e o que fosse salvo direto sumiria sozinho na rodada
//  seguinte, sem nada dizendo por quê. A tela grava no Vantoro pela Ponte, e a
//  Ponte aplica no banco na hora.
//
//  DOIS CORTES, e o fino ganha do grosso:
//    - DEPARTAMENTOS: tudo o que entra por aqueles telefones.
//    - CONEXÕES: com a chave ligada, ela vê SÓ os números marcados — inclusive
//      número de departamento que ela não tem.
// ============================================================
function Chave({ ligada, aoTrocar, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-label={rotulo}
            onClick={aoTrocar}
            style={{
              width: 40, height: 22, borderRadius: 20, flexShrink: 0, cursor: "pointer",
              border: "none", padding: 0, position: "relative",
              background: ligada ? "#2e9e6b" : "#6b7280",
              transition: "background .15s",
            }}>
      <span style={{
        position: "absolute", top: 3, left: ligada ? 21 : 3, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left .15s",
      }} />
    </button>
  );
}

// Um cartão de conexão ou de departamento: nome em cima, detalhe embaixo, chave
// à direita. O cartão inteiro é clicável — é o gesto que todo mundo tenta.
function Cartao({ cx, C, titulo, detalhe, cor, ligada, aoTrocar, desligado }) {
  return (
    <div onClick={desligado ? undefined : aoTrocar}
         style={{
           display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
           border: `1px solid ${ligada ? (cor || C.green) : C.divider}`,
           borderRadius: 10, cursor: desligado ? "default" : "pointer",
           opacity: desligado ? 0.45 : 1, minHeight: 46,
         }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor || C.green, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
        {detalhe && <span style={{ display: "block", fontSize: 11.5, color: C.textSecondary }}>{detalhe}</span>}
      </span>
      <Chave ligada={ligada} aoTrocar={(e) => { e.stopPropagation(); if (!desligado) aoTrocar(); }} rotulo={titulo} />
    </div>
  );
}

function Atendentes({ cx, C, departamentos, telefones, aoAvisar }) {
  const [gente, setGente] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [quem, setQuem] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await chamarPonte("/permissoes/atendentes");
      setGente(r.usuarios || []);
    } catch (e) {
      aoAvisar(e.message || "Não consegui ler os atendentes.");
    }
    setCarregando(false);
  }, [aoAvisar]);
  useEffect(() => { carregar(); }, [carregar]);

  const pessoa = gente.find((u) => String(u.id) === String(quem)) || null;
  const filtradas = gente.filter((u) => {
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return `${u.nome || ""} ${u.login || ""} ${u.email || ""}`.toLowerCase().includes(t);
  });

  // Uma gravação por clique, mandando SÓ o que mudou. O estado local muda antes
  // da resposta para a chave não "pular" — mas o que vale é o que o Vantoro
  // devolve, e é ele que fica no fim.
  async function mudar(campos) {
    if (!pessoa) return;
    setSalvando(true); aoAvisar("");
    try {
      const r = await chamarPonte("/permissoes/atendente", {
        method: "POST",
        body: JSON.stringify({ usuario: pessoa.login, ...campos }),
      });
      setGente((lista) => lista.map((u) => (String(u.id) === String(pessoa.id)
        ? { ...u, ...r.usuario, ja_entrou: u.ja_entrou } : u)));
      if (r.aplicada === false) {
        aoAvisar("Salvo. A pessoa ainda não entrou no Zorvin, então a permissão passa a valer na primeira entrada dela.");
      }
    } catch (e) {
      aoAvisar(e.message || "Não consegui salvar.");
      carregar();   // devolve a tela ao que o servidor tem
    }
    setSalvando(false);
  }

  const meusDeps = pessoa ? (pessoa.zorvin || []) : [];
  const meusFones = pessoa ? (pessoa.zorvin_telefones || []) : [];
  const limitado = Boolean(pessoa && pessoa.zorvin_so_telefones);

  // O número como o Vantoro guarda: só dígitos, sem o 55. É por esta chave que
  // os dois lados se acham.
  function chaveDoNumero(bruto) {
    let d = String(bruto || "").replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    return d.length > 11 ? d.slice(-11) : d;
  }
  const nomeDep = Object.fromEntries(departamentos.map((d) => [d.id, d.nome]));

  function alternar(lista, valor) {
    return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ---- a lista de gente ---- */}
      <div style={{ flex: "1 1 230px", minWidth: 210, maxWidth: 320 }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar…"
               style={{ ...cx.campo, width: "100%", marginBottom: 8 }} />
        {carregando && <div style={cx.dica}>Carregando…</div>}
        {!carregando && filtradas.length === 0 && <div style={cx.dica}>Ninguém com esse nome.</div>}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {filtradas.map((u) => {
            const on = pessoa && String(pessoa.id) === String(u.id);
            return (
              <div key={u.id} onClick={() => setQuem(u.id)}
                   style={{
                     display: "flex", flexDirection: "column", gap: 1, padding: "9px 11px",
                     borderRadius: 10, cursor: "pointer", minHeight: 46,
                     background: on ? C.listActive : "transparent",
                   }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {u.nome || u.login}
                  {u.admin && <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 500 }}> · administrador</span>}
                </span>
                <span style={{ fontSize: 11.5, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email || u.login}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- o que a pessoa escolhida alcança ---- */}
      <div style={{ flex: "2 1 340px", minWidth: 280 }}>
        {!pessoa && <div style={cx.dica}>Escolha alguém na lista ao lado.</div>}

        {pessoa && pessoa.admin && (
          <div style={cx.secao}>
            <div style={cx.titulo}>{pessoa.nome || pessoa.login}</div>
            <div style={cx.dica}>
              É <b>administradora</b>: enxerga todas as conversas, e nenhuma marcação aqui
              mudaria isso. Para restringir, tire o superusuário dela no Vantoro.
            </div>
          </div>
        )}

        {pessoa && !pessoa.admin && (
          <>
            <div style={cx.secao}>
              <div style={cx.titulo}>
                {pessoa.nome || pessoa.login}
                {salvando && <Loader2 size={14} className="zv-girando" color={C.textSecondary} />}
              </div>
              <div style={cx.dica}>
                {pessoa.ja_entrou
                  ? "As mudanças valem em segundos — a Ponte aplica na hora."
                  : "Esta pessoa ainda não entrou no Zorvin. Pode marcar agora: a permissão passa a valer na primeira entrada dela."}
              </div>
            </div>

            {/* CONEXÕES primeiro, como no painel que a equipe já conhece: é o
                corte mais fino, e é ele que decide se os departamentos abaixo
                valem alguma coisa. */}
            <div style={cx.secao}>
              <div style={cx.titulo}><Phone size={15} /> Conexões</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Limitar a conexões específicas</span>
                  <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>
                    Ligado, ela vê só os números marcados — e mais nada, mesmo que tenha o departamento deles.
                  </span>
                </span>
                <Chave ligada={limitado} rotulo="Limitar a conexões específicas"
                       aoTrocar={() => mudar({ so_telefones: !limitado })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {telefones.map((t) => {
                  const chave = chaveDoNumero(t.numero);
                  return (
                    <Cartao key={t.id} cx={cx} C={C} cor="#3d7dd6"
                            titulo={t.nome || t.numero}
                            detalhe={nomeDep[t.departamento_id] || "sem departamento"}
                            ligada={meusFones.includes(chave)}
                            desligado={!limitado}
                            aoTrocar={() => mudar({ telefones: alternar(meusFones, chave) })} />
                  );
                })}
              </div>
              {!limitado && (
                <div style={{ ...cx.dica, marginTop: 8, marginBottom: 0 }}>
                  Ligue a chave acima para escolher números. Desligada, ela vê todos os
                  telefones dos departamentos marcados abaixo.
                </div>
              )}
            </div>

            <div style={cx.secao}>
              <div style={cx.titulo}><Building2 size={15} /> Departamentos</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {departamentos.map((d) => (
                  <Cartao key={d.id} cx={cx} C={C} cor={d.cor}
                          titulo={d.nome}
                          detalhe={`${telefones.filter((t) => t.departamento_id === d.id).length} telefone(s)`}
                          ligada={meusDeps.includes(d.slug)}
                          desligado={limitado}
                          aoTrocar={() => mudar({ departamentos: alternar(meusDeps, d.slug) })} />
                ))}
              </div>
              {limitado && (
                <div style={{ ...cx.dica, marginTop: 8, marginBottom: 0 }}>
                  Enquanto a chave das conexões estiver ligada, o departamento não decide
                  nada — quem manda é a lista de números.
                </div>
              )}
              {!limitado && meusDeps.length === 0 && (
                <div style={{ ...cx.dica, marginTop: 8, marginBottom: 0 }}>
                  Sem nenhum departamento marcado, esta pessoa entra e não vê conversa alguma.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
