import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Eraser, AlertCircle, ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";
import { supabase } from "./supabase.js";
import { comOCodigo } from "./gravar.js";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { rotuloDaHora } from "./agenda.js";
import { diasDesde } from "./espera.js";
import { NOME_DA_SITUACAO } from "./abasDaSituacao.js";
import JaTratei from "./JaTratei.jsx";
import { PAGINA_DA_FAXINA, DIAS_DA_FAXINA, DIAS_PADRAO_DA_FAXINA, PAUSA_ENTRE_FINALIZACOES_MS, GRUPOS_DA_FAXINA,
         corteDaFaxina, diasParada, ehGrupoDaFaxina, quantasConversas, resumoDoLote } from "./faxina.js";

// ============================================================
//  A TELA "FAXINA DA FILA" (01/11) — ver `faxina.js` e o CLAUDE.md
//
//  Aberta pelo ⋮ do topo. Uma conversa parada embaixo da outra, com a última
//  mensagem à vista, as últimas mensagens a um clique e o Finalizar na linha
//  — sem abrir conversa por conversa.
//
//  O QUE ELA LÊ, ELA LÊ DO BANCO, em páginas: as paradas de um telefone
//  podem estar fora das 200 conversas que a lista carregou, e a faxina é
//  justamente das esquecidas. Os números de cada grupo também são do banco.
//
//  QUEM GRAVA É O PAINEL (`aoFinalizar`), pela régua de `JaTratei.jsx`: a
//  mesma montagem do registro do botão Finalizar da conversa, e uma escrita
//  só da regra. Esta tela só escolhe QUAIS, e diz o que aconteceu com cada.
//
//  A MARCAÇÃO DOS ASSUNTOS CONTINUA OBRIGATÓRIA, também em lote: limpar a
//  fila não pode virar o botão de sumir com cinquenta conversas sem registro.
// ============================================================

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// A ESCOLHA DA ÚLTIMA VISITA, na memória da aba (e não no navegador): quem abre
// uma conversa para conferir e volta pelo ⋮ encontra a faxina como a deixou —
// o grupo, o telefone, o responsável e os dias. Recarregar volta ao padrão.
const ULTIMA_ESCOLHA = { grupo: "cliente", telefone: "", responsavel: "todas", dias: DIAS_PADRAO_DA_FAXINA };

export default function Faxina({
  C, estreito, meuId, advogados = [], nomeDaPessoa, assuntos = [], erroDosAssuntos = "",
  colunasContato = "nome, numero, foto_url", temArquivada = true, rotularMidia,
  aoAbrirConversa, aoFinalizar, aoTerminarLote, aoAvisar, aoFechar,
}) {
  const [grupo, setGrupo] = useState(ULTIMA_ESCOLHA.grupo);
  // O TELEFONE GUARDADO SÓ VALE se a pessoa ainda o vê: a permissão pode ter
  // mudado desde a última visita.
  const [telefone, setTelefone] = useState(() => (advogados.some((a) => String(a.id) === ULTIMA_ESCOLHA.telefone)
    ? ULTIMA_ESCOLHA.telefone : ""));
  const [responsavel, setResponsavel] = useState(ULTIMA_ESCOLHA.responsavel);
  const [dias, setDias] = useState(ULTIMA_ESCOLHA.dias);
  useEffect(() => {
    Object.assign(ULTIMA_ESCOLHA, { grupo, telefone, responsavel, dias });
  }, [grupo, telefone, responsavel, dias]);
  const [lista, setLista] = useState({ linhas: [], carregando: true, erro: "", temMais: false });
  const [contagens, setContagens] = useState({ cliente: null, equipe: null, erro: "" });
  const [marcadas, setMarcadas] = useState(() => new Set());
  const [abertas, setAbertas] = useState({});      // id → { carregando, mensagens, erro }
  const [problemas, setProblemas] = useState({});  // id → o porquê de não ter finalizado
  const [dialogo, setDialogo] = useState(null);    // { conversas: [...] }
  const [ocupado, setOcupado] = useState(false);
  const [erroDoDialogo, setErroDoDialogo] = useState("");
  const [progresso, setProgresso] = useState(null); // { feitas, total }
  // QUANTAS LEITURAS TERMINARAM (a página e os números juntos). Vai escrito na
  // lista (`data-faxina-leituras`): entre o clique num filtro e a resposta, a
  // tela ainda mostra a lista de antes, e quem confere precisa saber que a
  // nova chegou — e não só que há linhas.
  const [leituras, setLeituras] = useState(0);
  const pararRef = useRef(false);
  const geracaoRef = useRef(0);
  const montadoRef = useRef(true);
  // AS QUE SAÍRAM DO RECORTE E CONTINUAM NA TELA: a que recebeu mensagem no
  // meio da faxina fica na lista, com o porquê, mas o banco já não a conta
  // entre as paradas. A próxima página é pedida pela POSIÇÃO, e a posição
  // conta só as que o banco ainda conta — contando todas as da tela, uma
  // conversa parada pularia sem nunca aparecer.
  const foraDoRecorteRef = useRef(new Set());
  // SAIR DA TELA PARA O LOTE no próximo item: a finalização em voo termina, e
  // a seguinte não começa. Sem isto, fechar a tela no meio continuaria
  // finalizando, para ninguém ver.
  //
  // A MARCA RELIGA A CADA MONTAGEM, e não só nasce ligada: em desenvolvimento
  // o React monta, desmonta e monta de novo de propósito, e os `useRef`
  // sobrevivem a isso. Só desligando na saída, a tela remontada achava que
  // tinha sido fechada e jogava fora toda resposta do banco — foi a primeira
  // rodada da prova, com a lista em "Procurando…" para sempre.
  useEffect(() => {
    montadoRef.current = true;
    pararRef.current = false;
    return () => { montadoRef.current = false; pararRef.current = true; };
  }, []);

  const advPorId = useMemo(() => Object.fromEntries(advogados.map((a) => [String(a.id), a])), [advogados]);
  // OS TELEFONES ENTRAM POR TEXTO, e não pela lista: `advogados` nasce de novo
  // a cada desenho do painel, e com ela nas dependências a leitura seria
  // refeita a cada tecla de quem está atendendo — a lição do relógio órfão.
  const idsDosTelefones = telefone ? String(telefone) : advogados.map((a) => String(a.id)).join(",");

  const filtrar = useCallback((q, qualGrupo) => {
    q = q.in("advogado_id", idsDosTelefones.split(","))
      .in("situacao", ["aguardando", "aberto"])
      // SEM AS CONVERSAS VAZIAS. Medido em 01/11, na tabela inteira: "tem
      // prévia" e "tem mensagem" são a mesma coisa (zero exceções nos dois
      // sentidos), e a prévia é uma coluna da própria conversa — a página e
      // a conta saem certas do banco, sem uma segunda ida.
      .not("ultima_mensagem", "is", null)
      .lt("ultima_atividade", corteDaFaxina(dias).toISOString());
    q = qualGrupo === "cliente" ? q.not("esperando_desde", "is", null) : q.is("esperando_desde", null);
    if (temArquivada) q = q.eq("arquivada", false);
    if (responsavel === "minhas") q = q.eq("responsavel_id", meuId);
    else if (responsavel === "sem") q = q.is("responsavel_id", null);
    return q;
  }, [idsDosTelefones, dias, temArquivada, responsavel, meuId]);

  const recontar = useCallback(async () => {
    if (!idsDosTelefones) { setContagens({ cliente: 0, equipe: 0, erro: "" }); return; }
    const conta = (g) => filtrar(supabase.from("conversas").select("id", { count: "exact", head: true }), g);
    try {
      const [a, b] = await Promise.all([conta("cliente"), conta("equipe")]);
      if (!montadoRef.current) return;
      const erro = a.error || b.error;
      setContagens({
        cliente: a.error ? null : (a.count ?? 0),
        equipe: b.error ? null : (b.count ?? 0),
        erro: erro ? comOCodigo("Não consegui contar as conversas paradas.", erro, "faxina da fila") : "",
      });
    } catch (e) {
      if (montadoRef.current) setContagens({ cliente: null, equipe: null, erro: comOCodigo("Não consegui contar as conversas paradas.", e, "faxina da fila") });
    }
  }, [filtrar, idsDosTelefones]);

  const pedirPagina = useCallback((desde) => filtrar(supabase.from("conversas").select(
    `id, advogado_id, ultima_mensagem, ultima_atividade, esperando_desde, responsavel_id, situacao, protocolo, `
    + `contato:contato_id (${colunasContato}), mensagens(tipo, origem, criado_em, enviado_por)`), grupo)
    // A PARADA HÁ MAIS TEMPO PRIMEIRO, e o id desempata: a página por posição
    // sobre uma ordem com empates pula ou repete linhas.
    .order("ultima_atividade", { ascending: true }).order("id")
    .range(desde, desde + PAGINA_DA_FAXINA - 1)
    // A ÚLTIMA MENSAGEM vem junto, uma só: é dela que sai quem falou por
    // último e o rótulo do anexo ("📄 Documento" no lugar de "[anexo]").
    .order("criado_em", { referencedTable: "mensagens", ascending: false })
    .limit(1, { referencedTable: "mensagens" }), [filtrar, grupo, colunasContato]);

  // A PRIMEIRA PÁGINA, e os números dos dois grupos — de novo a cada filtro.
  const ler = useCallback(async () => {
    const geracao = ++geracaoRef.current;
    foraDoRecorteRef.current = new Set();
    setMarcadas(new Set()); setAbertas({}); setProblemas({});
    setLista({ linhas: [], carregando: true, erro: "", temMais: false });
    if (!idsDosTelefones) {
      recontar();
      setLista({ linhas: [], carregando: false, erro: "", temMais: false });
      setLeituras((n) => n + 1);
      return;
    }
    try {
      const [, { data, error }] = await Promise.all([recontar(), pedirPagina(0)]);
      if (!montadoRef.current || geracao !== geracaoRef.current) return;
      if (error) {
        setLista({ linhas: [], carregando: false, temMais: false,
                   erro: comOCodigo("Não consegui ler as conversas paradas.", error, "faxina da fila") });
      } else {
        const linhas = data || [];
        setLista({ linhas, carregando: false, erro: "", temMais: linhas.length >= PAGINA_DA_FAXINA });
      }
    } catch (e) {
      if (!montadoRef.current || geracao !== geracaoRef.current) return;
      setLista({ linhas: [], carregando: false, temMais: false, erro: comOCodigo("Não consegui ler as conversas paradas.", e, "faxina da fila") });
    }
    setLeituras((n) => n + 1);
  }, [pedirPagina, recontar, idsDosTelefones]);
  useEffect(() => { ler(); }, [ler]);

  async function carregarMais() {
    const geracao = geracaoRef.current;
    const desde = lista.linhas.filter((c) => !foraDoRecorteRef.current.has(c.id)).length;
    setLista((l) => ({ ...l, carregando: true }));
    try {
      const { data, error } = await pedirPagina(desde);
      if (!montadoRef.current || geracao !== geracaoRef.current) return;
      if (error) {
        setLista((l) => ({ ...l, carregando: false,
                           erro: comOCodigo("Não consegui ler mais conversas paradas.", error, "faxina da fila") }));
        setLeituras((n) => n + 1);
        return;
      }
      const novas = data || [];
      setLista((l) => {
        const ja = new Set(l.linhas.map((x) => x.id));
        return { linhas: [...l.linhas, ...novas.filter((x) => !ja.has(x.id))], carregando: false, erro: "",
                 temMais: novas.length >= PAGINA_DA_FAXINA };
      });
    } catch (e) {
      if (montadoRef.current) setLista((l) => ({ ...l, carregando: false, erro: comOCodigo("Não consegui ler mais conversas paradas.", e, "faxina da fila") }));
    }
    if (montadoRef.current && geracao === geracaoRef.current) setLeituras((n) => n + 1);
  }

  // AS ÚLTIMAS MENSAGENS DE UMA CONVERSA, a um clique, sem sair da tela. São
  // oito: o bastante para saber se o "ok" do fim encerrou alguma coisa.
  async function alternarMensagens(c) {
    if (abertas[c.id]) { setAbertas((a) => { const n = { ...a }; delete n[c.id]; return n; }); return; }
    setAbertas((a) => ({ ...a, [c.id]: { carregando: true, mensagens: [], erro: "" } }));
    try {
      const { data, error } = await supabase.from("mensagens").select("*")
        .eq("conversa_id", c.id).order("criado_em", { ascending: false }).limit(8);
      if (!montadoRef.current) return;
      setAbertas((a) => (a[c.id] ? { ...a, [c.id]: error
        ? { carregando: false, mensagens: [], erro: comOCodigo("Não consegui ler as mensagens.", error, "mensagens da faxina") }
        : { carregando: false, mensagens: (data || []).slice().reverse(), erro: "" } } : a));
    } catch (e) {
      if (montadoRef.current) setAbertas((a) => (a[c.id] ? { ...a, [c.id]: { carregando: false, mensagens: [], erro: comOCodigo("Não consegui ler as mensagens.", e, "mensagens da faxina") } } : a));
    }
  }

  function alternarMarca(id) {
    setMarcadas((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  const todasMarcadas = lista.linhas.length > 0 && lista.linhas.every((c) => marcadas.has(c.id));
  function alternarTodas() {
    setMarcadas(todasMarcadas ? new Set() : new Set(lista.linhas.slice(0, PAGINA_DA_FAXINA).map((c) => c.id)));
  }

  function tirarDaLista(ids) {
    if (!ids.length) return;
    const fora = new Set(ids);
    setLista((l) => ({ ...l, linhas: l.linhas.filter((c) => !fora.has(c.id)) }));
    setMarcadas((m) => { const n = new Set(m); ids.forEach((id) => n.delete(id)); return n; });
    setContagens((ct) => (ct[grupo] == null ? ct : { ...ct, [grupo]: Math.max(0, ct[grupo] - ids.length) }));
  }

  function abrirFinalizar(conversas) {
    if (!conversas.length || progresso) return;
    setErroDoDialogo("");
    setDialogo({ conversas });
  }
  function fecharDialogo() { if (!ocupado) { setDialogo(null); setErroDoDialogo(""); } }

  // O Esc FECHA A JANELA, e não a tela: a escada do Esc do painel ouve a
  // janela inteira, e esta chega antes dela (fase de captura). Durante um
  // lote o Esc não faz nada — sair no meio pararia o lote sem querer.
  useEffect(() => {
    if (!dialogo && !progresso) return undefined;
    const aoTeclar = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (dialogo) fecharDialogo();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogo, progresso, ocupado]);

  async function confirmar(ids, descricao) {
    const alvo = dialogo ? dialogo.conversas : [];
    if (!alvo.length || !ids.length) return;
    // UMA SÓ: a janela fica aberta até o banco responder, e o erro aparece
    // nela — como no Finalizar da conversa.
    if (alvo.length === 1) {
      const c = alvo[0];
      setOcupado(true); setErroDoDialogo("");
      const r = await aoFinalizar(c, ids, descricao);
      if (!montadoRef.current) return;
      setOcupado(false);
      if (r && r.ok) {
        setDialogo(null);
        tirarDaLista([c.id]);
        if (aoTerminarLote) aoTerminarLote();
        if (aoAvisar) aoAvisar(r.jaEstava ? "Ela já tinha sido finalizada por outra pessoa." : `Finalizada${r.protocolo ? ` — protocolo ${r.protocolo}` : ""}.`);
        return;
      }
      setErroDoDialogo((r && r.erro) || "Não consegui finalizar.");
      // A QUE MUDOU sai do recorte do banco (ver `foraDoRecorteRef`), e os
      // números dos grupos são contados de novo.
      if (r && r.mudou) {
        foraDoRecorteRef.current.add(c.id);
        setProblemas((p) => ({ ...p, [c.id]: r.erro }));
        setDialogo(null);
        recontar();
      }
      return;
    }

    // EM LOTE: a janela fecha, e o andamento aparece na faixa de cima — as
    // linhas vão saindo da lista uma a uma, que é o que mostra que está
    // andando. Uma de cada vez, com uma pausa entre elas: cada finalização é
    // um aviso do tempo real para cada aba aberta do escritório.
    setDialogo(null);
    pararRef.current = false;
    setProgresso({ feitas: 0, total: alvo.length });
    const feitas = [];
    const novos = {};
    let i = 0;
    for (const c of alvo) {
      if (pararRef.current) break;
      const r = await aoFinalizar(c, ids, descricao);
      if (!montadoRef.current) return;
      if (r && r.ok) { feitas.push(c.id); tirarDaLista([c.id]); }
      else {
        novos[c.id] = (r && r.erro) || "Não consegui finalizar.";
        if (r && r.mudou) foraDoRecorteRef.current.add(c.id);
      }
      i += 1;
      setProgresso({ feitas: i, total: alvo.length });
      if (i < alvo.length && !pararRef.current) await esperar(PAUSA_ENTRE_FINALIZACOES_MS);
    }
    const parou = pararRef.current && i < alvo.length;
    setProblemas((p) => ({ ...p, ...novos }));
    setMarcadas(new Set());
    setProgresso(null);
    if (aoTerminarLote) aoTerminarLote();
    if (aoAvisar) aoAvisar(resumoDoLote(feitas.length, Object.keys(novos).length, parou), 9000);
    recontar();
  }

  const marcadasNaLista = lista.linhas.filter((c) => marcadas.has(c.id));
  const nDoGrupo = contagens[grupo];
  const noRecorte = lista.linhas.filter((c) => !foraDoRecorteRef.current.has(c.id)).length;
  // OS 40 PONTOS DE ALVO DE DEDO no celular vêm da regra geral do painel
  // (`@media (max-width: 767px)`: todo botão e todo `select`), e não são
  // repetidos aqui — a regra existe para ninguém ter de lembrar caso a caso.
  // Repetidos, uma sabotagem que os tirava passava sem ninguém ver.
  const caixa = { padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.divider}`, background: C.panel,
                  color: C.textPrimary, fontSize: 13 };
  const botaoFraco = { border: `1px solid ${C.divider}`, background: "transparent", color: C.textPrimary,
                       borderRadius: 8, padding: "6px 11px", fontSize: 12.5, cursor: "pointer" };

  const linhaDaConversa = (c) => {
    const nome = nomeDoContato(c.contato) || telefoneLegivel(c.contato?.numero) || "Cliente";
    const tel = advPorId[String(c.advogado_id)];
    const ultima = Array.isArray(c.mensagens) ? c.mensagens[0] : null;
    const bruto = c.ultima_mensagem || "";
    const rotulo = ultima && ultima.tipo && ultima.tipo !== "texto" && (bruto === "[anexo]" || bruto === "")
      ? (rotularMidia ? rotularMidia(ultima.tipo) : "") || bruto : bruto;
    const quem = ultima ? (ultima.origem === "contato" ? (ehGrupoDaFaxina(c) ? "Grupo" : "Cliente")
      : (ultima.enviado_por || "Equipe")) : (c.esperando_desde ? "Cliente" : "Equipe");
    const parada = diasParada(c.ultima_atividade);
    const espera = c.esperando_desde ? diasDesde(c.esperando_desde) : 0;
    const aberta = abertas[c.id];
    const problema = problemas[c.id];
    return (
      <div key={c.id} data-faxina-linha={c.id}
           style={{ borderTop: `1px solid ${C.divider}`, background: marcadas.has(c.id) ? (C.listActive || C.panel) : C.panel }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px" }}>
          {/* A CAIXA GANHA UM ALVO DE 40 PONTOS sem mudar o desenho: a regra
              geral do celular deixa as caixas de marcar de fora (esticadas,
              elas viram retângulos), e 18 pontos é pouco para o dedo — e
              marcar é o gesto do lote. Quem cresce é o rótulo em volta. */}
          <label data-faxina-alvo-marcar style={{ display: "flex", padding: 11, margin: -11, cursor: "pointer", flexShrink: 0 }}>
            <input type="checkbox" data-faxina-marcar={c.id} checked={marcadas.has(c.id)} disabled={Boolean(progresso)}
                   onChange={() => alternarMarca(c.id)} aria-label={`Marcar ${nome}`}
                   style={{ width: 18, height: 18, marginTop: 2, accentColor: C.green, cursor: "pointer", flexShrink: 0 }} />
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {ehGrupoDaFaxina(c) && <Users size={14} color={C.textSecondary} style={{ flexShrink: 0 }} />}
              <span data-faxina-nome style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
              {ehGrupoDaFaxina(c) && <span style={{ fontSize: 11, color: C.textSecondary, flexShrink: 0 }}>grupo</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 2, fontSize: 12, color: C.textSecondary }}>
              {tel && <span>{tel.nome}</span>}
              {/* O NOME DO RESPONSÁVEL, pela régua do painel (`nomeDaPessoa`):
                  quem não está na lista da equipe vira "alguém da equipe" — e
                  nunca "sem responsável", que é outra coisa e mudaria quem
                  limpa o quê. */}
              <span data-faxina-dono>{!c.responsavel_id ? "sem responsável"
                : String(c.responsavel_id) === String(meuId) ? "com você"
                : `com ${(nomeDaPessoa && nomeDaPessoa(c.responsavel_id)) || "alguém da equipe"}`}</span>
              <span data-faxina-aba={c.situacao}>{NOME_DA_SITUACAO[c.situacao] || c.situacao}</span>
              <span data-faxina-parada={parada} style={{ color: "#d99a1e", fontWeight: 600 }}>parada há {parada} dias</span>
              {espera >= 1 && (
                <span data-faxina-espera={espera} style={{ color: "#e5573f", fontWeight: 600 }}>esperando há {espera} {espera === 1 ? "dia" : "dias"}</span>
              )}
            </div>
            <div data-faxina-ultima style={{ marginTop: 5, fontSize: 13, color: C.textPrimary, lineHeight: 1.4,
                                             display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              <b data-faxina-quem>{quem}:</b> {rotulo || "(sem texto)"}
              {ultima && ultima.criado_em && (
                <span style={{ color: C.textSecondary, fontSize: 11.5 }}> · {rotuloDaHora(ultima.criado_em)}</span>
              )}
            </div>
            {problema && (
              <div data-faxina-problema style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, color: C.erroTexto || "#e5573f" }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{problema}</span>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <button data-faxina-ver={c.id} onClick={() => alternarMensagens(c)} style={botaoFraco}>
                {aberta ? <ChevronUp size={13} style={{ verticalAlign: -2 }} /> : <ChevronDown size={13} style={{ verticalAlign: -2 }} />}
                {aberta ? " Esconder as mensagens" : " Ver as últimas mensagens"}
              </button>
              <button data-faxina-abrir={c.id} onClick={() => aoAbrirConversa && aoAbrirConversa(c)} style={botaoFraco}>
                Abrir a conversa
              </button>
              <button data-faxina-finalizar={c.id} disabled={Boolean(progresso)} onClick={() => abrirFinalizar([c])}
                      style={{ ...botaoFraco, border: "none", background: progresso ? C.divider : C.green, color: "#fff", fontWeight: 600 }}>
                Finalizar
              </button>
            </div>
            {aberta && (
              <div data-faxina-mensagens={c.id} style={{ marginTop: 8, borderLeft: `3px solid ${C.divider}`, paddingLeft: 10 }}>
                {aberta.carregando ? (
                  <div style={{ fontSize: 12.5, color: C.textSecondary }}>Lendo as mensagens…</div>
                ) : aberta.erro ? (
                  <div data-faxina-mensagens-falhou style={{ fontSize: 12.5, color: C.erroTexto || "#e5573f" }}>{aberta.erro}</div>
                ) : aberta.mensagens.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: C.textSecondary }}>Nenhuma mensagem.</div>
                ) : aberta.mensagens.map((m) => {
                  const midia = m.tipo && m.tipo !== "texto" ? (rotularMidia ? rotularMidia(m.tipo) : "") : "";
                  const texto = m.apagada || m.apagada_em ? "🚫 Mensagem apagada"
                    : [midia, m.transcricao ? `“${m.transcricao}”` : m.texto].filter(Boolean).join(" ") || "(sem texto)";
                  return (
                    <div key={m.id} data-faxina-mensagem style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 4 }}>
                      <b style={{ color: m.origem === "contato" ? C.textPrimary : (C.verdeTexto || C.green) }}>
                        {m.origem === "contato" ? "Cliente" : (m.enviado_por || "Equipe")}
                      </b>
                      <span style={{ color: C.textSecondary }}> · {rotuloDaHora(m.criado_em)}</span>
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{texto}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div data-tela="faxina" style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg || C.headerBar,
                                     display: "flex", flexDirection: "column", color: C.textPrimary }}>
      <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => { if (!progresso) aoFechar(); }} title="Voltar às conversas" aria-label="Voltar às conversas"
                disabled={Boolean(progresso)}
                style={{ border: "none", background: "transparent", cursor: progresso ? "not-allowed" : "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <ArrowLeft size={20} color={C.textSecondary} />
        </button>
        <Eraser size={20} color={C.green} />
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Faxina da fila</span>
        <button data-atualizar-faxina onClick={() => { if (!progresso) ler(); }} title="Atualizar" aria-label="Atualizar"
                disabled={Boolean(progresso)}
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <RefreshCw size={18} color={C.textSecondary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "14px 16px 40px" }}>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
            Conversas <b>sem nenhuma mensagem há mais de {dias} dias</b> que ainda não foram finalizadas. Finalizar
            não manda nada ao cliente: se ele escrever de novo, a conversa volta para “{NOME_DA_SITUACAO.aberto}” com
            um protocolo novo. Antes de cada uma, o Zorvin confere se não chegou mensagem nova.
          </div>

          {/* OS DOIS GRUPOS, com os números do banco. */}
          <div data-faxina-grupos role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {GRUPOS_DA_FAXINA.map((g) => {
              const ativo = grupo === g.chave;
              const n = contagens[g.chave];
              return (
                <button key={g.chave} role="tab" aria-selected={ativo} data-faxina-grupo={g.chave}
                        data-faxina-conta={n == null ? "" : n} disabled={Boolean(progresso)}
                        onClick={() => setGrupo(g.chave)}
                        style={{ border: `1px solid ${ativo ? C.green : C.divider}`, background: ativo ? C.green : "transparent",
                                 color: ativo ? "#fff" : C.textPrimary, borderRadius: 18, padding: "7px 13px",
                                 fontSize: 13, fontWeight: ativo ? 700 : 500, cursor: "pointer" }}>
                  {g.rotulo}{n != null && <span style={{ fontWeight: 700 }}> · {n}</span>}
                </button>
              );
            })}
          </div>
          {contagens.erro && (
            <div data-faxina-conta-falhou style={{ fontSize: 12.5, color: C.erroTexto || "#e5573f", marginBottom: 8 }}>{contagens.erro}</div>
          )}

          {/* OS FILTROS. */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <select data-faxina-telefone value={telefone} disabled={Boolean(progresso)}
                    onChange={(e) => setTelefone(e.target.value)} style={caixa} aria-label="Telefone">
              <option value="">Todos os telefones</option>
              {advogados.map((a) => <option key={a.id} value={String(a.id)}>{a.nome}</option>)}
            </select>
            <select data-faxina-responsavel value={responsavel} disabled={Boolean(progresso)}
                    onChange={(e) => setResponsavel(e.target.value)} style={caixa} aria-label="Responsável">
              <option value="todas">De qualquer responsável</option>
              <option value="minhas">As minhas</option>
              <option value="sem">Sem responsável</option>
            </select>
            <select data-faxina-dias value={dias} disabled={Boolean(progresso)}
                    onChange={(e) => setDias(Number(e.target.value))} style={caixa} aria-label="Parada há mais de">
              {DIAS_DA_FAXINA.map((d) => <option key={d} value={d}>Parada há mais de {d} dias</option>)}
            </select>
          </div>

          {/* A FAIXA DO LOTE: marcar todas, finalizar as marcadas, e o andamento. */}
          {lista.linhas.length > 0 && (
            <div data-faxina-lote style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px",
                                          border: `1px solid ${C.divider}`, borderBottom: "none", borderRadius: "12px 12px 0 0",
                                          background: C.headerBar, fontSize: 13 }}>
              <label data-faxina-alvo-marcar-todas
                     style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", minHeight: 40, margin: "-8px 0" }}>
                <input type="checkbox" data-faxina-marcar-todas checked={todasMarcadas} disabled={Boolean(progresso)}
                       onChange={alternarTodas} style={{ width: 17, height: 17, accentColor: C.green, cursor: "pointer" }} />
                {lista.linhas.length > PAGINA_DA_FAXINA
                  ? `Marcar as primeiras ${PAGINA_DA_FAXINA}`
                  : `Marcar as ${lista.linhas.length} desta página`}
              </label>
              <span style={{ flex: 1 }} />
              {progresso ? (
                <>
                  <span data-faxina-andamento={`${progresso.feitas}/${progresso.total}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={14} className="zv-girando" /> Finalizando {progresso.feitas} de {progresso.total}…
                  </span>
                  <button data-faxina-parar onClick={() => { pararRef.current = true; }} style={botaoFraco}>Parar</button>
                </>
              ) : marcadasNaLista.length > 0 ? (
                <button data-faxina-finalizar-marcadas onClick={() => abrirFinalizar(marcadasNaLista)}
                        style={{ ...botaoFraco, border: "none", background: C.green, color: "#fff", fontWeight: 600 }}>
                  Finalizar {quantasConversas(marcadasNaLista.length)}
                </button>
              ) : (
                <span style={{ color: C.textSecondary, fontSize: 12.5 }}>Marque as conversas para finalizar várias de uma vez.</span>
              )}
            </div>
          )}

          <div data-faxina-estado={lista.carregando ? "procurando" : lista.erro ? "falhou" : "pronta"} data-faxina-leituras={leituras}
               style={{ border: `1px solid ${C.divider}`, borderRadius: lista.linhas.length ? "0 0 12px 12px" : 12, overflow: "hidden" }}>
            {lista.erro && (
              <div data-faxina-falhou role="alert" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px",
                                                            background: "rgba(229,57,53,.10)", fontSize: 13.5, lineHeight: 1.45 }}>
                <AlertCircle size={17} color="#e53935" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ flex: 1 }}>{lista.erro}</span>
                <button onClick={lista.linhas.length ? carregarMais : ler}
                        style={{ border: "none", background: "transparent", color: C.verdeTexto || C.green, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Tentar de novo
                </button>
              </div>
            )}
            {lista.linhas.map(linhaDaConversa)}
            {lista.carregando && (
              <div style={{ padding: "12px", fontSize: 13, color: C.textSecondary, background: C.panel }}>Procurando…</div>
            )}
            {!lista.carregando && !lista.erro && lista.linhas.length === 0 && (
              <div data-faxina-vazia style={{ padding: "14px 12px", fontSize: 13.5, color: C.textSecondary, background: C.panel }}>
                {grupo === "cliente"
                  ? `Nenhuma conversa parada há mais de ${dias} dias com o cliente esperando resposta.`
                  : `Nenhuma conversa parada há mais de ${dias} dias em que a equipe falou por último.`}
              </div>
            )}
            {!lista.carregando && lista.temMais && !lista.erro && (
              <button data-faxina-mais onClick={carregarMais}
                      style={{ width: "100%", border: "none", borderTop: `1px solid ${C.divider}`, background: C.panel,
                               color: C.verdeTexto || C.green, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Carregar mais{nDoGrupo != null ? ` (${Math.max(0, nDoGrupo - noRecorte)} restantes)` : ""}
              </button>
            )}
          </div>
        </div>
      </div>

      {dialogo && (
        <JaTratei C={C} estreito={estreito} finalizar
                  lote={dialogo.conversas.length}
                  nome={dialogo.conversas.length > 1 ? "Faxina da fila"
                    : nomeDoContato(dialogo.conversas[0].contato) || telefoneLegivel(dialogo.conversas[0].contato?.numero) || "Cliente"}
                  dias={dialogo.conversas.length === 1 && dialogo.conversas[0].esperando_desde ? diasDesde(dialogo.conversas[0].esperando_desde) : 0}
                  protocolo={dialogo.conversas.length === 1 ? dialogo.conversas[0].protocolo : null}
                  assuntos={assuntos} erroDosAssuntos={erroDosAssuntos}
                  ocupado={ocupado} erro={erroDoDialogo}
                  aoConfirmar={confirmar} aoFechar={fecharDialogo} />
      )}
    </div>
  );
}
