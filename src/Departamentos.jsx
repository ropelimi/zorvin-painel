import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada } from "./gravar.js";
import { chamarPonte } from "./ponte.js";
// A ETIQUETA do telefone do escritório — a mesma que a ponte lê para aplicar a
// permissão. Estava escrita aqui dentro; agora tem nome e um só lugar, com o
// contrato explicado. NÃO troque por `chaveDoNumero`: são perguntas
// diferentes, e a explicação está em `numeros.js`.
import { etiquetaDoTelefone } from "./numeros.js";
import { useTemVantoro } from "./temVantoro.js";
import { PalavrasDaCasa } from "./PalavrasDaCasa.jsx";
import { AssuntosDoJaTratei } from "./AssuntosDoJaTratei.jsx";
import { EtapasDoFunil } from "./EtapasDoFunil.jsx";
// A CHAVE SAIU DAQUI para `Chave.jsx`: a tela de Avisos passou a precisar da
// mesma peça, e uma segunda cópia divergiria da primeira no primeiro conserto.
import { Chave } from "./Chave.jsx";
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
  const [aba, setAba] = useState("estrutura"); // 'estrutura' | 'pessoas' | 'notas'
  const temVantoro = useTemVantoro();
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
    // A pergunta é a mesma das outras telas, e agora é a MESMA FUNÇÃO: escrita
    // à mão em cinco lugares, a primeira cópia a divergir seria a que ninguém
    // provou.
    else if (naoGravouNada({ data, error })) setErro(SEM_PERMISSAO);
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
      // A regra do banco lê `usuarios.admin`, que é a marca DO ZORVIN — com
      // Vantoro ela é espelhada de lá, sem Vantoro ela se marca nesta tela.
      // Dizer "no Vantoro" era certo num caso só, e manda quem não tem
      // Vantoro procurar a chave num sistema que ele não usa.
      return "Só quem é administrador no Zorvin pode mexer aqui.";
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
          {/* A ABA DAS NOTAS mora aqui porque aqui é a tela de quem administra,
              e o retroativo é coisa de administrador — ele mexe no histórico de
              todos os clientes de uma vez. Antes ele só existia como um POST
              com token de servidor: não havia como chamá-lo de um navegador, e
              as notas antigas ficaram paradas por isso. */}
          {/* SEM VANTORO ELA NÃO EXISTE. A aba inteira é sobre subir nota para a
              ficha de lá: sem Vantoro ela abre, mostra números zerados e o
              botão não leva a lugar nenhum.
              `=== true` cobre os dois casos que devem mostrar — tem Vantoro, ou
              a pergunta FALHOU (que o módulo já resolve como `true`, para o
              escritório nunca perder a aba por causa de rede). O que esconde é
              a resposta "não tem" e o instante em que a pergunta ainda está no
              ar. Ver `temVantoro.js`. */}
          {temVantoro === true && (
            <button style={cx.aba(aba === "notas")} onClick={() => setAba("notas")}
                    data-aba-notas>Notas no Vantoro</button>
          )}
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
              {/* AS PALAVRAS VÊM PRIMEIRO porque são a primeira coisa que um
                  comprador de outro ramo precisa trocar: sem isto o programa
                  fala de "advogado" na barra lateral dele desde o primeiro dia.
                  Fica nesta aba, e não numa quarta, porque uma aba inteira para
                  três campos é uma aba que ninguém abre. */}
              <PalavrasDaCasa cx={cx} C={C} aoAvisar={setErro} />

              {/* LOGO DEPOIS DAS PALAVRAS, e pelo mesmo motivo: é uma lista
                  que o comprador de outro ramo troca inteira no primeiro dia.
                  Uma aba só para ela seria uma aba que ninguém abre. */}
              <AssuntosDoJaTratei cx={cx} C={C} aoAvisar={setErro} />

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

              {/* AS ETAPAS DO FUNIL (script 017) vêm DEPOIS dos departamentos,
                  e não junto das palavras e dos assuntos: cada funil É de um
                  departamento, e quem cria um departamento novo desce até aqui
                  para dar as etapas a ele. Acima, o seletor de departamento
                  desta seção passava a ser o primeiro da tela — antes do de
                  trazer telefone, que é o gesto de todo dia desta aba.
                  Sem o script, a seção não aparece. */}
              <EtapasDoFunil cx={cx} C={C} departamentos={departamentos} aoAvisar={setErro} />
            </>
          )}

          {!carregando && aba === "pessoas" && (
            <Atendentes cx={cx} C={C} departamentos={departamentos} telefones={telefones}
                        aoAvisar={setErro} />
          )}

          {aba === "notas" && <NotasNoVantoro cx={cx} C={C} />}
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
  // ============================================================
  //  EM QUAL DOS DOIS MUNDOS ESTA TELA ESTÁ — e quem responde é a PONTE.
  //
  //  Com Vantoro, a lista de gente e a permissão moram lá, e esta tela é uma
  //  porta para o cadastro de lá. Sem Vantoro, tudo isso mora aqui — e aí a
  //  tela precisa oferecer o que lá era oferecido pelo outro sistema:
  //  cadastrar pessoa, promover a administradora, desativar.
  //
  //  A resposta vem no `com_vantoro` da própria lista, e não de uma variável
  //  do painel. Quem tem as variáveis do Vantoro é a ponte: uma variável
  //  própria aqui poderia ser posta em desacordo com as de lá, e a tela
  //  ofereceria cadastrar gente num sistema que manda o cadastro para outro
  //  lugar — sem nada na tela dizendo isso.
  //
  //  Começa `null` (ainda não sei) de propósito: começar em `true` faria a
  //  tela piscar sem o botão de cadastrar a cada abertura no cliente que não
  //  tem Vantoro, e começar em `false` ofereceria por um instante, no
  //  escritório, um botão que a ponte recusaria.
  // ============================================================
  const [comVantoro, setComVantoro] = useState(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState({ nome: "", email: "", senha: "" });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await chamarPonte("/permissoes/atendentes");
      setGente(r.usuarios || []);
      setComVantoro(r.com_vantoro !== false);
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
        // O ID VAI JUNTO DO LOGIN. Com Vantoro quem manda é o login (é a chave
        // de lá). Sem Vantoro o login nasce do pedaço do e-mail antes do
        // arroba, e duas pessoas de domínios diferentes podem ter o mesmo —
        // mexer na permissão da pessoa errada é o tipo de engano que ninguém
        // percebe olhando a tela.
        body: JSON.stringify({ usuario: pessoa.login, usuario_id: pessoa.id, ...campos }),
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

  async function criarPessoa() {
    if (criando) return;
    setCriando(true); aoAvisar("");
    try {
      const r = await chamarPonte("/permissoes/pessoa", {
        method: "POST",
        body: JSON.stringify({ nome: nova.nome.trim(), email: nova.email.trim(), senha: nova.senha }),
      });
      // A LISTA É RECARREGADA DO SERVIDOR, e a pessoa nova não é só encaixada
      // aqui. O que a ponte guardou é o que vale: encaixar à mão faria a tela
      // mostrar uma pessoa que talvez não tenha entrado na lista de verdade —
      // e o erro só apareceria na próxima abertura, longe da causa.
      await carregar();
      if (r && r.usuario) setQuem(r.usuario.id);
      setNova({ nome: "", email: "", senha: "" });
      setCadastrando(false);
    } catch (e) {
      aoAvisar(e.message || "Não consegui criar a conta.");
    }
    setCriando(false);
  }

  const meusDeps = pessoa ? (pessoa.zorvin || []) : [];
  const meusFones = pessoa ? (pessoa.zorvin_telefones || []) : [];
  const limitado = Boolean(pessoa && pessoa.zorvin_so_telefones);

  const nomeDep = Object.fromEntries(departamentos.map((d) => [d.id, d.nome]));

  function alternar(lista, valor) {
    return lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ---- a lista de gente ---- */}
      <div style={{ flex: "1 1 230px", minWidth: 210, maxWidth: 320 }}>
        {/* CADASTRAR SÓ APARECE SEM VANTORO. Com ele, quem cadastra gente é o
            Vantoro — oferecer aqui criaria a segunda lista de pessoas, que é
            exatamente o que fez o Vantoro virar a fonte. A ponte recusa esse
            pedido, então o botão seria um gesto que termina em erro. */}
        {comVantoro === false && (
          <div style={{ marginBottom: 10 }} data-equipe-propria>
            {!cadastrando && (
              <button style={{ ...cx.botao, width: "100%", justifyContent: "center" }}
                      onClick={() => { setCadastrando(true); aoAvisar(""); }}
                      data-adicionar-pessoa>+ Adicionar pessoa</button>
            )}
            {cadastrando && (
              <div style={{ ...cx.secao, marginBottom: 0 }} data-form-pessoa>
                <div style={cx.titulo}>Nova pessoa</div>
                <div style={cx.dica}>
                  Ela entra com este e-mail e esta senha. Combine a senha com ela e
                  peça que troque depois.
                </div>
                <input value={nova.nome} placeholder="Nome"
                       onChange={(e) => setNova({ ...nova, nome: e.target.value })}
                       style={{ ...cx.campo, width: "100%", marginBottom: 6 }} data-pessoa-nome />
                <input value={nova.email} placeholder="e-mail" type="email" autoCapitalize="none"
                       onChange={(e) => setNova({ ...nova, email: e.target.value })}
                       style={{ ...cx.campo, width: "100%", marginBottom: 6 }} data-pessoa-email />
                <input value={nova.senha} placeholder="senha (mínimo 8)" type="text"
                       onChange={(e) => setNova({ ...nova, senha: e.target.value })}
                       style={{ ...cx.campo, width: "100%", marginBottom: 8 }} data-pessoa-senha />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={cx.botao} disabled={criando} onClick={criarPessoa} data-pessoa-salvar>
                    {criando ? "Criando…" : "Criar"}
                  </button>
                  <button style={cx.botaoFraco} disabled={criando}
                          onClick={() => { setCadastrando(false); aoAvisar(""); }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar…"
               style={{ ...cx.campo, width: "100%", marginBottom: 8 }} />
        {carregando && <div style={cx.dica}>Carregando…</div>}
        {!carregando && filtradas.length === 0 && <div style={cx.dica}>Ninguém com esse nome.</div>}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {filtradas.map((u) => {
            const on = pessoa && String(pessoa.id) === String(u.id);
            return (
              <div key={u.id} onClick={() => setQuem(u.id)}
                   // O NOME SOZINHO NÃO SERVE PARA ACHAR ESTA LINHA. Atrás
                   // deste painel está a lista de conversas do escritório, cheia
                   // de gente com nome de gente — uma prova que procurasse pelo
                   // texto acabaria clicando numa conversa. Este atributo é o
                   // endereço da pessoa NA EQUIPE.
                   data-pessoa-da-equipe={u.id}
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

        {/* AS DUAS CHAVES SÓ EXISTEM SEM VANTORO. Com ele, `admin` é espelhado
            do superusuário de lá a cada entrada: uma chave aqui seria desfeita
            na entrada seguinte, sem nada na tela dizendo por quê — uma chave
            que volta sozinha é pior do que chave nenhuma. */}
        {pessoa && comVantoro === false && (
          <div style={cx.secao} data-mando-da-pessoa>
            <div style={cx.titulo}>{pessoa.nome || pessoa.login}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Administra o Zorvin</span>
                <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>
                  Enxerga todas as conversas e mexe nesta tela.
                </span>
              </span>
              <Chave ligada={Boolean(pessoa.admin)} rotulo="Administra o Zorvin"
                     aoTrocar={() => mudar({ admin: !pessoa.admin })} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Conta ativa</span>
                <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>
                  Desativada, ela continua existindo e para de alcançar o Zorvin.
                </span>
              </span>
              <Chave ligada={pessoa.ativo !== false} rotulo="Conta ativa"
                     aoTrocar={() => mudar({ ativo: pessoa.ativo === false })} />
            </div>
          </div>
        )}

        {pessoa && pessoa.admin && (
          <div style={cx.secao}>
            {comVantoro !== false && <div style={cx.titulo}>{pessoa.nome || pessoa.login}</div>}
            <div style={{ ...cx.dica, marginBottom: 0 }}>
              É <b>administradora</b>: enxerga todas as conversas, e nenhuma marcação aqui
              mudaria isso.{" "}
              {comVantoro === false
                ? "Para restringir, desligue a chave acima."
                : "Para restringir, tire o superusuário dela no Vantoro."}
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
                  const chave = etiquetaDoTelefone(t.numero);
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

// ---------- as notas do Zorvin no histórico do Vantoro ----------
//
//  POR QUE ESTA ABA EXISTE.
//
//  A nota interna escrita numa conversa sobe para o histórico do cliente no
//  Vantoro. Isso passou a valer para as notas NOVAS — mas as que já estavam
//  gravadas antes ficaram onde estavam, e não havia como trazê-las: o
//  retroativo é um POST que exige o token de servidor do Vantoro, e esse token
//  nunca pode passar pelo navegador. Quer dizer, existia um comando que
//  ninguém do escritório tinha como executar. A Render, no plano gratuito, não
//  dá terminal — então "rode este comando" não é caminho possível aqui.
//
//  Ela roda EM FATIAS, e não de uma vez. Subir uma nota é uma ida ao Vantoro,
//  que é outra hospedagem e que hiberna: centenas de clientes numa requisição
//  só passam do tempo que a Render dá, e a chamada morre no meio sem dizer
//  onde parou. A ponte recorta a lista; esta tela pede a fatia seguinte e vai
//  mostrando quanto já andou.
function NotasNoVantoro({ cx, C }) {
  const [medindo, setMedindo] = useState(true);
  const [conta, setConta] = useState(null);
  const [erro, setErro] = useState("");
  const [simulacao, setSimulacao] = useState(null);
  const [rodando, setRodando] = useState(false);
  const [andado, setAndado] = useState(null);
  const [pronto, setPronto] = useState(null);
  // Pedido de parada. Em `ref` e não em `state` de propósito: o laço lê este
  // valor a cada volta, e um `state` ficaria congelado no valor que existia
  // quando o laço começou — o botão de parar não pararia nada.
  const parar = useRef(false);

  // Meio minuto é o que as outras telas pedem, e não serve aqui: uma fatia
  // percorre dezenas de clientes mandando nota a nota para o Vantoro. Desistir
  // no meio de um trabalho que estava andando faria a tela dizer "demorou
  // demais" para algo que teria terminado.
  const ESPERA = 120000;

  const medir = useCallback(async () => {
    setMedindo(true); setErro("");
    try {
      setConta(await chamarPonte("/vantoro/diagnostico-notas"));
    } catch (e) {
      setConta(null);
      setErro(e.message);
    }
    setMedindo(false);
  }, []);

  useEffect(() => { medir(); }, [medir]);

  async function simular() {
    setErro(""); setSimulacao(null); setPronto(null);
    setRodando(true);
    try {
      // `quantos=tudo` na SIMULAÇÃO: ela não manda nada ao Vantoro, só lê e
      // conta — e um número parcial aqui seria pior que número nenhum, porque
      // é ele que a pessoa vai usar para decidir se aperta.
      const r = await chamarPonte("/vantoro/notas/subir-tudo?simular=1&quantos=tudo",
                                  { method: "POST", espera: ESPERA });
      setSimulacao(r);
    } catch (e) { setErro(e.message); }
    setRodando(false);
  }

  async function subir() {
    setErro(""); setPronto(null); setAndado(null);
    parar.current = false;
    setRodando(true);
    let de = 0, subiram = 0, jaEstavam = 0, falharam = 0;
    const comProblema = [];
    // A FALHA FICA GUARDADA AQUI, e só é escrita na tela DEPOIS da remedição.
    //
    // Escrevê-la antes não funcionava, e a prova pegou: `medir()` começa
    // limpando o erro — precisa, para não deixar recado velho na tela — e
    // apagava a mensagem que esta função tinha acabado de pôr. A tela ficava
    // muda justamente quando havia o que dizer. É o mesmo tropeço que a
    // gravação desta tela já tinha cometido uma vez, algumas centenas de
    // linhas acima.
    let falha = "";
    try {
      for (;;) {
        const r = await chamarPonte(`/vantoro/notas/subir-tudo?de=${de}`,
                                    { method: "POST", espera: ESPERA });
        subiram += r.subiram || 0;
        jaEstavam += r.jaEstavam || 0;
        falharam += r.falharam || 0;
        for (const p of (r.com_problema || [])) if (!comProblema.includes(p)) comProblema.push(p);
        // O PROGRESSO É DESENHADO A CADA FATIA. Uma tela parada por minutos é
        // indistinguível de uma tela travada, e quem está olhando fecha.
        setAndado({ ate: r.ate, total: r.total_clientes, subiram, jaEstavam, falharam });
        // QUEM DIZ QUE ACABOU É A PONTE, e não esta tela: a conta depende de
        // quantos clientes existem e de quantos couberam na fatia, e refeita
        // aqui erraria na primeira vez que uma das duas mudasse.
        if (r.fim) break;
        if (parar.current) break;
        // A fatia seguinte começa onde esta parou. Sem isto o laço repetiria a
        // primeira para sempre.
        de = r.ate;
      }
      setPronto({ subiram, jaEstavam, falharam, comProblema,
                  interrompido: parar.current });
    } catch (e) {
      // O QUE JÁ SUBIU NÃO SE PERDE, e a tela precisa dizer isso: quem lê só
      // "deu erro" acha que tem de recomeçar do zero, e recomeçar do zero é
      // justamente o que dá medo de apertar de novo.
      falha = e.message + " O que já subiu está lá — apertar de novo continua "
              + "de onde parou, sem repetir nada.";
    }
    setRodando(false);
    // A REMEDIÇÃO PRIMEIRO, a mensagem depois — nesta ordem, e é a ordem que
    // importa. Ao contrário, `medir()` apaga o que acabou de ser escrito.
    await medir();
    if (falha) setErro(falha);
  }

  const numero = (v) => (v === null || v === undefined ? "—" : v);

  return (
    <div data-vantoro-notas>
      <div style={cx.secao}>
        <div style={cx.titulo}>Notas internas no histórico do cliente</div>
        <div style={cx.dica}>
          A nota escrita numa conversa vira uma linha no <b>Histórico do cliente</b> do
          Vantoro — mas só quem tem ficha lá tem para onde a nota subir. As notas
          escritas <b>antes</b> de isso existir ficaram paradas; é o que este botão traz.
        </div>

        {erro && (
          <div role="alert" data-vantoro-erro
               style={{ background: C.panel, border: "1px solid #e5573f", color: C.textPrimary, borderLeft: "4px solid #e5573f", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            {erro}
          </div>
        )}

        {medindo && <div style={{ color: C.textSecondary, fontSize: 13.5 }}>Conferindo…</div>}

        {!medindo && conta && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {[["Contatos", conta.contatos],
                ["Com ficha no Vantoro", conta.contatos_com_cadastro_no_vantoro],
                ["Notas escritas", conta.notas],
                ["Já no histórico", conta.notas_que_ja_subiram]].map(([r, v]) => (
                <div key={r} style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: "9px 13px", minWidth: 120 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1 }}>{numero(v)}</div>
                  <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>{r}</div>
                </div>
              ))}
            </div>
            {/* A FRASE VEM DA PONTE, e não é remontada aqui. Ela é quem sabe
                separar "ninguém tem ficha ainda" de "a subida está sendo
                recusada" — e ela admite quando não sabe, em vez de chutar. */}
            <div style={{ ...cx.dica, marginBottom: 0 }} data-vantoro-diagnostico>
              {conta.diagnostico}
            </div>
          </>
        )}
      </div>

      {!medindo && conta && (
        <div style={cx.secao}>
          <div style={cx.titulo}>Subir as notas antigas</div>
          {/* SIMULAR PRIMEIRO. Ver o número antes é o que separa uma decisão de
              um acidente — e a simulação não manda nada, nem grava nada. */}
          <div style={cx.dica}>
            A simulação não envia nada: ela só conta quantas subiriam. Subir de
            verdade pode ser feito quantas vezes quiser — a nota que já está lá é
            reconhecida e não entra duas vezes.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button style={cx.botaoFraco} onClick={simular} disabled={rodando} data-vantoro-simular>
              Simular
            </button>
            <button style={{ ...cx.botao, opacity: rodando ? 0.6 : 1 }} onClick={subir}
                    disabled={rodando} data-vantoro-subir>
              Subir agora
            </button>
            {rodando && (
              <>
                <Loader2 size={15} className="zv-girando" color={C.textSecondary} />
                <button style={cx.botaoFraco} onClick={() => { parar.current = true; }}
                        data-vantoro-parar>Parar</button>
              </>
            )}
          </div>

          {simulacao && (
            <div style={{ ...cx.dica, marginTop: 10, marginBottom: 0 }} data-vantoro-simulacao>
              <b>{simulacao.subiram}</b> nota(s) subiriam agora, de{" "}
              <b>{simulacao.total_clientes}</b> cliente(s). Nada foi enviado.
            </div>
          )}

          {andado && !pronto && (
            <div style={{ ...cx.dica, marginTop: 10, marginBottom: 0 }} data-vantoro-progresso={andado.ate}>
              Cliente <b>{andado.ate}</b> de <b>{andado.total}</b> ·{" "}
              <b>{andado.subiram}</b> nota(s) subiram.
            </div>
          )}

          {pronto && (
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55 }} data-vantoro-fim>
              <b>{pronto.subiram}</b> nota(s) subiram, <b>{pronto.jaEstavam}</b> já
              estavam lá{pronto.falharam ? `, ${pronto.falharam} falharam` : ""}.
              {pronto.interrompido && " Parado a pedido — apertar de novo continua de onde parou."}
              {/* OS QUE FALHARAM, NOMEADOS. "3 falharam" é um dado que ninguém
                  consegue usar: sem saber quais, não há o que refazer. */}
              {pronto.comProblema.length > 0 && (
                <div style={{ ...cx.dica, marginTop: 6, marginBottom: 0 }} data-vantoro-problemas>
                  Ficaram para trás: {pronto.comProblema.slice(0, 20).join(", ")}
                  {pronto.comProblema.length > 20 ? " …" : ""}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
