import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { lerFunisDosTelefones, chaveDoFunil, noFunil } from "./funis.js";
import { IaDoFunil } from "./IaDoFunil.jsx";
import { AcompanhamentoDaEtapa } from "./AcompanhamentoDaEtapa.jsx";
import { semOAcompanhamento } from "./acompanhamento.js";
import { SquareKanban, Plus, Loader2, Check, EyeOff, Eye, ArrowUp, ArrowDown, Sparkles, Smartphone, Undo2, PenLine } from "lucide-react";

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
//
//  O FUNIL DE CADA TELEFONE (02/11, script 043 da ponte). A escolha do alto
//  lista, dentro de cada departamento, o funil dele e cada telefone dele:
//
//    - o telefone que USA O DO DEPARTAMENTO diz isso, e oferece "Criar um
//      funil só para este telefone" — as etapas nascem copiadas das do
//      departamento, e os clientes dele no funil do departamento ganham
//      cartão no novo, na etapa de mesmo nome;
//    - o telefone COM FUNIL PRÓPRIO mostra as etapas dele, que se editam como
//      as do departamento, e oferece "Voltar a usar o funil do departamento".
//      Voltar não apaga nada: o funil dele fica guardado, e pode voltar;
//    - os números do que aconteceu (quantas etapas, quantos clientes) saem do
//      banco (`zorvin_funil_do_telefone`), e não de uma conta daqui.
//
//  Sem o 043 a escolha é a de antes, só os departamentos — e nenhuma
//  consulta menciona a coluna do telefone.
//
//  A IA QUE MOVE O FUNIL (02/11, script 044 da ponte). Cada funil de verdade
//  (o do departamento, ou o de um telefone com funil próprio) ganha a chave
//  "A IA move os clientes de etapa" (`IaDoFunil.jsx`), e cada etapa ganha uma
//  DESCRIÇÃO: o que ela quer dizer. É o que a IA lê para decidir — "Proposta
//  enviada" sozinha diz menos do que "mandamos a proposta e esperamos a
//  resposta do cliente". Sem o 044, nem a chave nem as descrições aparecem:
//  a coluna que falta é perguntada uma vez, quando a seção abre.
//
//  O ACOMPANHAMENTO POR ETAPA (02/11, script 045 da ponte). Cada etapa em uso
//  ganha os seus LEMBRETES DE ACOMPANHAMENTO (`AcompanhamentoDaEtapa.jsx`):
//  depois de quantos dias sem resposta do cliente quem cuida dele recebe uma
//  tarefa com a mensagem pronta. As regras do funil escolhido vêm numa
//  pergunta só, e são relidas a cada gravação. Sem o 045 a tabela falta, e
//  nada aparece; a leitura que falha por outro motivo é DITA, e os lembretes
//  não são desenhados (desenhados vazios, convidariam a escrever de novo um
//  lembrete que existe).
// ============================================================

export const ETAPAS_SUGERIDAS = [
  ["Novo contato", "#53bdeb"], ["Em atendimento", "#00a884"], ["Aguardando cliente", "#ffb02e"],
  ["Proposta/acordo enviado", "#a78bfa"], ["Acordo fechado", "#25d366"], ["Em execução", "#0ea5e9"],
  ["Encerrado", "#8696a0"],
];
const CORES = ["#53bdeb", "#00a884", "#ffb02e", "#a78bfa", "#25d366", "#0ea5e9", "#f472b6", "#e5573f", "#8696a0"];

export function EtapasDoFunil({ cx, C, departamentos = [], telefones = [], aoAvisar, meuNome = "" }) {
  const [existe, setExiste] = useState(null);   // null = ainda lendo
  // A ESCOLHA é um par (departamento, telefone): o telefone nulo é o funil do
  // departamento. Um telefone escolhido pode ainda NÃO ter funil próprio — é
  // assim que se chega ao botão de criar.
  const [escolha, setEscolha] = useState(() => ((departamentos[0] || {}).id != null
    ? { departamentoId: departamentos[0].id, telefoneId: null } : null));
  const depId = escolha ? escolha.departamentoId : null;
  const [etapas, setEtapas] = useState([]);
  const [novo, setNovo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null);   // { id, nome }
  // OS FUNIS DOS TELEFONES (043): `null` lendo; `{ existe, lista, erro }`.
  const [funis, setFunis] = useState(null);
  const [feito, setFeito] = useState("");   // a frase do que o banco fez, em verde, e não na faixa de erro
  // AS DESCRIÇÕES DAS ETAPAS (044): `null` perguntando; `false` sem a coluna.
  const [comDescricao, setComDescricao] = useState(null);
  const [descrevendo, setDescrevendo] = useState(null);   // { id, texto }
  useEffect(() => {
    let vivo = true;
    supabase.from("zorvin_etapas").select("descricao").limit(1).then(({ error }) => {
      if (!vivo) return;
      // SÓ A COLUNA QUE FALTA esconde: um tropeço qualquer mostra, e a
      // gravação dirá o que houver (a régua dos três estados).
      setComDescricao(!(error && (String(error.code) === "42703" || /descricao/.test(String(error.message || "")))));
    });
    return () => { vivo = false; };
  }, []);

  // Os departamentos chegam depois da primeira pintura (Departamentos lê o
  // banco): sem isto a seção ficaria presa em "nenhum departamento".
  useEffect(() => {
    if (!escolha && departamentos.length) setEscolha({ departamentoId: departamentos[0].id, telefoneId: null });
  }, [departamentos, escolha]);

  const releFunis = useCallback(async () => {
    const r = await lerFunisDosTelefones();
    setFunis(r);
    if (r.erro) aoAvisar(r.erro);
    return r;
  }, [aoAvisar]);
  useEffect(() => { releFunis(); }, [releFunis]);
  const comTelefone = !!(funis && funis.existe && !funis.erro);
  const funilDoEscolhido = escolha && escolha.telefoneId && funis
    ? (funis.lista || []).find((f) => String(f.advogado_id) === String(escolha.telefoneId)) || null : null;
  // O telefone escolhido TEM funil próprio em uso? Só aí há etapas dele para
  // mostrar; sem isso, a seção diz que ele usa o do departamento.
  const temFunilProprio = !!(funilDoEscolhido && funilDoEscolhido.ativo);
  const usaODoDepartamento = !!(escolha && escolha.telefoneId && comTelefone && !temFunilProprio);
  const telefoneEscolhido = escolha && escolha.telefoneId
    ? telefones.find((t) => String(t.id) === String(escolha.telefoneId)) || null : null;
  const chaveEscolha = chaveDoFunil(escolha);

  // A RESPOSTA MAIS NOVA VENCE, e a lista é DO DEPARTAMENTO ESCOLHIDO
  // (auditoria de 07/10): trocando de departamento, as etapas do anterior
  // continuavam na tela sob o nome do novo até a leitura voltar — ou para
  // sempre, se ela voltasse fora de ordem —, e renomear, reordenar e conferir
  // nome repetido agiam sobre a lista errada.
  const pedido = useRef(0);
  const jaLeu = useRef(false);
  const escolhaRef = useRef(escolha);
  escolhaRef.current = escolha;
  const ler = useCallback(async () => {
    const e0 = escolhaRef.current;
    if (!e0) return;
    const meu = ++pedido.current;
    // O TELEFONE QUE AINDA USA O DO DEPARTAMENTO não tem etapas para ler: a
    // seção mostra o botão de criar, e não uma lista vazia que se leria como
    // "um funil sem etapas".
    if (e0.telefoneId && !temFunilProprioRef.current) { setEtapas([]); return; }
    const { data, error } = await noFunil(supabase.from("zorvin_etapas").select("*"), e0, comTelefoneRef.current)
      .order("ordem");
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
  }, [aoAvisar]);
  const temFunilProprioRef = useRef(temFunilProprio);
  temFunilProprioRef.current = temFunilProprio;
  const comTelefoneRef = useRef(comTelefone);
  comTelefoneRef.current = comTelefone;

  useEffect(() => { setEtapas([]); ler(); }, [ler, chaveEscolha, temFunilProprio, comTelefone]);

  // OS LEMBRETES DE ACOMPANHAMENTO (045) das etapas deste funil, numa
  // pergunta só. São TRÊS ESTADOS em `existe`, pela régua de `temVantoro.js`:
  // `null` ainda não se sabe (nada aparece — sem isto, num banco sem o 045 o
  // botão piscaria na tela até a primeira resposta), `false` sem o 045, `true`
  // com ele. E o que se sabe FICA ao trocar de funil: muda só a `lista`, que é
  // `null` enquanto a pergunta deste funil não volta. A RESPOSTA MAIS NOVA
  // VENCE, como as etapas: trocando de funil no meio, os lembretes do de antes
  // não aparecem sob as etapas do novo.
  const [regras, setRegras] = useState({ existe: null, lista: null, erro: "" });
  const pedidoDasRegras = useRef(0);
  const idsLidos = useRef(null);
  const idsDasEtapas = etapas.map((e) => e.id).join(",");
  const lerRegras = useCallback(async () => {
    const ids = idsDasEtapas ? idsDasEtapas.split(",") : [];
    const meu = ++pedidoDasRegras.current;
    // OUTRO FUNIL: os lembretes do de antes saem da tela até a resposta. O
    // MESMO funil relido (depois de gravar, ou o "Tentar de novo") fica como
    // está até a resposta — sem piscar a cada gravação.
    if (idsLidos.current !== idsDasEtapas) {
      idsLidos.current = idsDasEtapas;
      setRegras((r) => ({ ...r, lista: null, erro: "" }));
    }
    if (!ids.length) return;
    const { data, error } = await supabase.from("zorvin_acompanhamentos").select("*").in("etapa_id", ids);
    if (meu !== pedidoDasRegras.current) return;
    if (error) {
      if (semOAcompanhamento(error)) { setRegras({ existe: false, lista: null, erro: "" }); return; }
      setRegras({ existe: true, lista: null,
                  erro: comOCodigo("Não consegui ler os lembretes de acompanhamento.", error, "lembretes de acompanhamento") });
      return;
    }
    setRegras({ existe: true, lista: data || [], erro: "" });
  }, [idsDasEtapas]);
  useEffect(() => { lerRegras(); }, [lerRegras]);
  const comAcompanhamento = regras.existe === true;
  // A frase do que o banco fez some quando se escolhe OUTRO funil — e não
  // quando a lista dos funis é relida logo depois de criar, que é justamente
  // a hora em que ela tem de ser lida.
  useEffect(() => { setFeito(""); setDescrevendo(null); }, [chaveEscolha]);

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
      // A etapa do funil de um telefone leva o telefone junto (043).
      ...(escolha && escolha.telefoneId ? { advogado_id: escolha.telefoneId } : {}),
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

  // A DESCRIÇÃO VAZIA VAI COMO NULA: "sem descrição" é uma coisa só, e a IA
  // lê só o nome.
  async function salvarDescricao() {
    const texto = String(descrevendo.texto || "").replace(/\s+/g, " ").trim();
    if (texto.length > 500) { aoAvisar("A descrição pode ter até 500 caracteres."); return; }
    if (await gravar(descrevendo.id, { descricao: texto || null }, "salvar a descrição da etapa")) {
      setDescrevendo(null); ler(false);
    }
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

  // DAR OU TIRAR O FUNIL PRÓPRIO de um telefone. A frase sai do que o banco
  // DEVOLVEU (quantas etapas, quantos clientes), e não de uma conta daqui.
  async function funilProprio(ligar) {
    const tel = escolha && escolha.telefoneId;
    if (!tel) return;
    const nomeTel = telefoneEscolhido ? telefoneEscolhido.nome : "este telefone";
    if (!ligar && !window.confirm(`O telefone ${nomeTel} volta a usar o funil do departamento. O funil dele fica guardado, com os cartões, e pode voltar depois. Continuar?`)) return;
    setOcupado(true); aoAvisar(""); setFeito("");
    const r = await supabase.rpc("zorvin_funil_do_telefone", { p_telefone: tel, p_ligar: ligar });
    setOcupado(false);
    if (r.error) {
      aoAvisar(comOCodigo(ligar ? "Não consegui criar o funil deste telefone." : "Não consegui voltar ao funil do departamento.",
                          r.error, "funil do telefone"));
      return;
    }
    const d = r.data || {};
    const n = Number(d.cartoes) || 0;
    const clientes = `${n} ${n === 1 ? "cliente" : "clientes"}`;
    if (ligar) {
      setFeito(Number(d.etapas) > 0
        ? `Funil próprio criado para ${nomeTel}: ${d.etapas} etapas copiadas do departamento, e ${clientes} do funil do departamento ${n === 1 ? "ganhou" : "ganharam"} cartão nele, na mesma etapa.`
        : `${nomeTel} voltou a usar o funil próprio. ${n ? `${clientes} que ${n === 1 ? "chegou" : "chegaram"} enquanto ele estava desligado ${n === 1 ? "entrou" : "entraram"} nele.` : ""}`.trim());
    } else {
      setFeito(`${nomeTel} voltou a usar o funil do departamento.${n ? ` ${clientes} que só ${n === 1 ? "estava" : "estavam"} no funil dele ${n === 1 ? "ganhou" : "ganharam"} cartão no do departamento.` : ""} O funil dele ficou guardado.`);
    }
    await releFunis();
  }

  if (existe === false || !departamentos.length) return null;

  const ativas = etapas.filter((e) => e.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const fora = etapas.filter((e) => e.ativo === false);
  const botaoFraco = { ...cx.botao, background: "transparent", color: C.textSecondary, border: `1px solid ${C.divider}`, whiteSpace: "nowrap" };

  return (
    <div style={cx.secao} data-etapas-do-funil>
      <div style={cx.titulo}><SquareKanban size={16} /> Etapas do funil</div>
      <div style={cx.dica}>
        Cada departamento tem o seu funil{comTelefone ? ", e cada telefone pode ter um só dele" : ""}. As etapas são
        as colunas, nesta ordem. Os clientes novos entram sozinhos na primeira. <b>Renomear conserta o passado
        inteiro</b> — para trocar de etapa, use “Parar de usar” e crie uma nova. Os clientes de uma etapa que parou
        de ser usada não somem: ficam numa coluna própria até alguém movê-los.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {comTelefone ? (
          <select data-etapas-departamento value={chaveEscolha}
                  onChange={(e) => {
                    const [dep, tel] = e.target.value.split("|");
                    setEditando(null);
                    setEscolha({ departamentoId: Number(dep) || dep, telefoneId: tel || null });
                  }}
                  style={{ ...cx.campo, flex: "0 0 auto", maxWidth: "100%" }} aria-label="Qual funil">
            {departamentos.map((d) => (
              <optgroup key={d.id} label={d.nome}>
                <option value={String(d.id)}>{d.nome} — funil do departamento</option>
                {telefones.filter((t) => String(t.departamento_id) === String(d.id)).map((t) => {
                  const f = (funis.lista || []).find((x) => String(x.advogado_id) === String(t.id));
                  return (
                    <option key={t.id} value={`${d.id}|${t.id}`} data-opcao-telefone={f && f.ativo ? "proprio" : "departamento"}>
                      {t.nome} — {f && f.ativo ? "funil próprio" : "usa o do departamento"}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        ) : (
          <select data-etapas-departamento value={depId ?? ""}
                  onChange={(e) => { setEditando(null); setEscolha({ departamentoId: Number(e.target.value) || e.target.value, telefoneId: null }); }}
                  style={{ ...cx.campo, flex: "0 0 auto" }} aria-label="Departamento do funil">
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        )}
        {!usaODoDepartamento && (
          <>
            <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nova etapa" data-etapa-nova
                   onKeyDown={(e) => e.key === "Enter" && !ocupado && novo.trim() && criar([novo.trim()])}
                   style={{ ...cx.campo, flex: 1, minWidth: 140 }} />
            <button style={cx.botao} onClick={() => (novo.trim() ? criar([novo.trim()]) : aoAvisar("Escreva o nome da etapa."))}
                    disabled={ocupado} data-etapa-criar>
              {ocupado ? <Loader2 size={14} className="zv-girando" /> : <Plus size={15} />} Criar
            </button>
          </>
        )}
      </div>

      {feito && (
        <div data-funil-do-telefone-feito role="status"
             style={{ fontSize: 13, color: C.textPrimary, borderLeft: `3px solid ${C.green || "#00a884"}`,
                      padding: "6px 10px", marginBottom: 10, lineHeight: 1.5 }}>
          {feito}
        </div>
      )}

      {/* A CHAVE DA IA, só num funil de verdade: o telefone que usa o do
          departamento não tem funil para a IA cuidar. */}
      {existe && !usaODoDepartamento && escolha && (
        <IaDoFunil cx={cx} C={C} aoAvisar={aoAvisar}
                   funil={{ departamentoId: depId, telefoneId: escolha.telefoneId || null }}
                   nomeDoFunil={(() => {
                     const d = departamentos.find((x) => String(x.id) === String(depId));
                     const nd = d ? d.nome : "este departamento";
                     return escolha.telefoneId ? `${nd} · ${telefoneEscolhido ? telefoneEscolhido.nome : "este telefone"}` : nd;
                   })()} />
      )}

      {usaODoDepartamento && (
        <div data-telefone-usa-o-do-departamento
             style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: C.textSecondary, flex: "1 1 260px", lineHeight: 1.5 }}>
            <b style={{ color: C.textPrimary }}>{telefoneEscolhido ? telefoneEscolhido.nome : "Este telefone"}</b> usa o
            funil do departamento{(() => { const d = departamentos.find((x) => String(x.id) === String(depId)); return d ? ` ${d.nome}` : ""; })()}.
            {funilDoEscolhido
              ? " Ele já teve um funil próprio, que ficou guardado com os cartões."
              : " Com um funil só dele, as etapas nascem copiadas das do departamento, e os clientes dele no funil do departamento ganham cartão no novo, na mesma etapa."}
          </span>
          <button style={cx.botao} onClick={() => funilProprio(true)} disabled={ocupado} data-criar-funil-do-telefone>
            {ocupado ? <Loader2 size={14} className="zv-girando" /> : <Smartphone size={15} />}
            {funilDoEscolhido ? "Voltar a usar o funil próprio" : "Criar um funil só para este telefone"}
          </button>
        </div>
      )}

      {temFunilProprio && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button style={botaoFraco} onClick={() => funilProprio(false)} disabled={ocupado} data-voltar-ao-funil-do-departamento>
            <Undo2 size={15} /> Voltar a usar o funil do departamento
          </button>
        </div>
      )}

      {existe && etapas.length === 0 && !usaODoDepartamento && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: C.textSecondary }}>
            {escolha && escolha.telefoneId ? "O funil deste telefone ainda não tem etapas." : "Este departamento ainda não tem funil."}
          </span>
          <button style={cx.botao} onClick={() => criar(ETAPAS_SUGERIDAS)} disabled={ocupado} data-etapas-sugeridas>
            <Sparkles size={15} /> Criar as etapas sugeridas
          </button>
        </div>
      )}

      {comAcompanhamento && ativas.length > 0 && !usaODoDepartamento && (
        <div data-dica-do-acompanhamento style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, margin: "2px 0 8px" }}>
          <b style={{ color: C.textPrimary }}>Lembretes de acompanhamento:</b> em cada etapa, depois de quantos dias sem
          resposta do cliente a equipe é lembrada, e com qual mensagem pronta. Quem cuida do cliente recebe uma tarefa,
          confere e manda — nada sai para o cliente sozinho.
          {regras.erro && (
            <span data-falha-dos-lembretes role="alert" style={{ display: "block", marginTop: 4, color: C.ambarTexto || "#b26a00" }}>
              {regras.erro}{" "}
              <button onClick={lerRegras} data-reler-lembretes
                      style={{ border: "none", background: "transparent", color: C.verdeTexto || C.green, cursor: "pointer",
                               fontWeight: 600, padding: 0, fontSize: 12.5 }}>
                Tentar de novo
              </button>
            </span>
          )}
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
                <span style={{ flex: 1, fontSize: 13.5, minWidth: 120 }}>
                  <span style={{ textDecoration: e.ativo !== false ? "none" : "line-through" }}>{e.nome}</span>
                  {e.ativo === false && <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textSecondary }}>fora de uso</span>}
                  {posicao === 0 && <span style={{ marginLeft: 8, fontSize: 11.5, color: C.textSecondary }}>onde os novos entram</span>}
                  {comDescricao && e.descricao && (
                    <span data-etapa-descricao style={{ display: "block", fontSize: 12, color: C.textSecondary, lineHeight: 1.45, marginTop: 2 }}>
                      {e.descricao}
                    </span>
                  )}
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
                {comDescricao && e.ativo !== false && (
                  <button onClick={() => setDescrevendo({ id: e.id, texto: e.descricao || "" })} disabled={ocupado}
                          data-etapa-descrever style={botaoFraco} title="O que esta etapa quer dizer — é o que a IA lê">
                    <PenLine size={14} /> {e.descricao ? "Descrição" : "Descrever"}
                  </button>
                )}
                <button onClick={async () => {
                          if (await gravar(e.id, { ativo: e.ativo === false }, e.ativo !== false ? "parar de usar a etapa" : "voltar a usar a etapa")) ler(false);
                        }}
                        disabled={ocupado} data-etapa-ativa={e.ativo !== false ? "sim" : "nao"} style={botaoFraco}>
                  {e.ativo !== false ? <EyeOff size={15} /> : <Eye size={15} />}
                  {e.ativo !== false ? "Parar de usar" : "Voltar a usar"}
                </button>
              </>
            )}
            {descrevendo && descrevendo.id === e.id && (
              <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 6, paddingLeft: 18 }}>
                <textarea value={descrevendo.texto} autoFocus rows={2} maxLength={500} data-etapa-descricao-editando
                          placeholder="O que esta etapa quer dizer. Ex.: mandamos a proposta e esperamos a resposta do cliente."
                          onChange={(ev) => setDescrevendo({ ...descrevendo, texto: ev.target.value })}
                          onKeyDown={(ev) => { if (ev.key === "Escape") setDescrevendo(null); }}
                          style={{ ...cx.campo, resize: "vertical", minHeight: 52, fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button style={cx.botao} onClick={salvarDescricao} disabled={ocupado} data-etapa-descricao-salvar>
                    <Check size={15} /> Salvar
                  </button>
                  <button onClick={() => setDescrevendo(null)} style={botaoFraco}>Cancelar</button>
                  <span style={{ fontSize: 11.5, color: C.textSecondary }}>{String(descrevendo.texto || "").length}/500</span>
                </div>
              </div>
            )}
            {/* OS LEMBRETES DESTA ETAPA (045), só nas etapas em uso, e só
                com a leitura certa: falhando, a dica acima diz por quê. */}
            {comAcompanhamento && regras.lista && e.ativo !== false && !(editando && editando.id === e.id) && (
              <AcompanhamentoDaEtapa cx={cx} C={C} etapa={e} meuNome={meuNome}
                                     regras={regras.lista.filter((r) => String(r.etapa_id) === String(e.id))}
                                     aoMudou={lerRegras} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EtapasDoFunil;
