import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RefreshCw, Search, Download, X, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { diasDesde } from "./espera.js";
import { situacao, semATabelaDeTarefas, rotuloDaTarefa, ordenarAbertas } from "./tarefas.js";
import { casaComAPesquisa } from "./pesquisaNosMenus.js";
import { chaveDoFunil, listaDeFunis, nomeDoFunil, noFunil, telefonesDoFunil } from "./funis.js";

// ============================================================
//  O FUNIL DE ETAPAS (06/10)
//
//  Pedido do Rodrigo, como segundo passo do Zorvin para CRM: cada cliente
//  numa ETAPA, numa tela de colunas em que o cartão é arrastado de uma para a
//  outra. A conta toda está no script 017 da ponte; esta tela só lê e move.
//
//  DECIDIDO COM ELE:
//
//    - UM FUNIL POR DEPARTAMENTO — o SAC e o SDC têm caminhos diferentes, e a
//      tela abre no departamento que está aberto na barra;
//    - E, DESDE 02/11, UM FUNIL PRÓPRIO PARA O TELEFONE QUE QUISER (script 043
//      da ponte): a escolha do alto lista o funil de cada departamento e,
//      logo abaixo dele, o de cada telefone que tem o seu. A tela abre no
//      funil do telefone que está aberto na barra;
//    - O CARTÃO É O CLIENTE, e não a conversa. Enquanto não há a ficha
//      própria do Zorvin, "cliente" é o CONTATO (um número de WhatsApp): a
//      mesma pessoa por dois números são dois cartões.
//
//  MOVER É ARRASTAR, E TAMBÉM ESCOLHER NUMA LISTA. Arrastar é o gesto que todo
//  CRM ensinou; a lista existe porque arrastar não funciona no celular nem
//  no teclado, e um cartão que só se move com o mouse é um cartão que metade
//  da equipe não consegue mover.
//
//  O ACERTO VISUAL VEM NA FRENTE, A FRASE ESPERA O BANCO — a régua das quatro
//  marcas da conversa. O cartão muda de coluna na hora; se o banco recusar,
//  ele VOLTA para onde estava e a faixa diz por quê, com o código. Um cartão
//  que fica na coluna nova sem ter sido gravado é a tela dizendo "salvei" sem
//  ter salvo (24/09).
//
//  NADA SOME CALADO:
//
//    - o cartão numa etapa DESATIVADA não desaparece: vai para a coluna "Em
//      etapas desativadas", no fim, até alguém movê-lo;
//    - a leitura que falha DIZ que falhou, com o código, e não vira "ninguém
//      neste funil" (armadilha nº 2);
//    - o funil cortado pelo teto da API diz que está cortado.
// ============================================================

const PAGINA = 1000;          // o teto de linhas por pedido do PostgREST
const PAGINAS_NO_MAXIMO = 5;  // 5.000 cartões por funil — e diz quando passa
const LOTE = 150;             // ids por pedido `in(...)`, para a URL não estourar
const RELER_A_CADA_MS = 30000;

function emLotes(lista, n = LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += n) lotes.push(lista.slice(i, i + n));
  return lotes;
}

function Inicial({ nome, cor }) {
  const letra = String(nome || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span aria-hidden="true"
          style={{ width: 30, height: 30, borderRadius: "50%", background: cor, color: "#fff",
                   display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {letra}
    </span>
  );
}

const CORES_DA_INICIAL = ["#00a884", "#53bdeb", "#a78bfa", "#ffb02e", "#e5573f", "#14b8a6", "#f472b6", "#3b82f6"];
function corDe(texto) {
  let h = 0;
  for (const ch of String(texto || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_DA_INICIAL[h % CORES_DA_INICIAL.length];
}

/** "hoje", "ontem", "há 5 dias" — há quanto tempo o cartão está nesta etapa. */
function haQuanto(iso) {
  if (!iso) return "";
  const d = diasDesde(iso);
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export default function Funil({
  C, departamentos = [], advogados = [], souAdmin = false,
  departamentoInicial = null, aoAbrirConversa, aoFechar, comTarefas = false,
  funis = [], comTelefone = false, erroDosFunis = "", funilInicial = null,
}) {
  // O FUNIL ESCOLHIDO é um par (departamento, telefone), e o telefone nulo é o
  // funil do departamento (`funis.js`). Começa no funil do telefone aberto na
  // barra; se ele não estiver entre os que esta pessoa alcança, no do
  // departamento aberto; e, por último, no primeiro da lista.
  const opcoes = listaDeFunis(departamentos, advogados, funis);
  const [escolhido, setEscolhido] = useState(() => {
    const achar = (f) => f && opcoes.find((o) => chaveDoFunil(o) === chaveDoFunil(f));
    return achar(funilInicial)
      || achar(departamentoInicial != null ? { departamentoId: departamentoInicial, telefoneId: null } : null)
      || opcoes[0] || null;
  });
  // OS DEPARTAMENTOS CHEGAM DEPOIS da primeira pintura, às vezes: sem isto a
  // tela ficaria presa em "nenhum funil à vista".
  useEffect(() => {
    if (!escolhido && opcoes.length) setEscolhido(opcoes[0]);
  }, [escolhido, opcoes.length]);  // eslint-disable-line react-hooks/exhaustive-deps
  const depId = escolhido ? escolhido.departamentoId : null;
  const chaveEscolhido = chaveDoFunil(escolhido);
  const [existe, setExiste] = useState(null);   // null = lendo; false = sem o script 017
  const [etapas, setEtapas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [contatos, setContatos] = useState({});  // id → contato
  const [conversas, setConversas] = useState({}); // contato_id → a conversa mais recente
  // A TAREFA ABERTA MAIS URGENTE de cada cliente (contato_id → tarefa), de
  // qualquer conversa dele neste departamento. `falhaTarefas` diz quando não
  // deu para ler — sem isso, um cartão sem o sinal se leria como "sem tarefa".
  const [tarefasPorContato, setTarefasPorContato] = useState({});
  const [falhaTarefas, setFalhaTarefas] = useState(null);
  const [cortado, setCortado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [diasTrazer, setDiasTrazer] = useState(30);
  const [trazendo, setTrazendo] = useState(false);
  const movendo = useRef(0);
  const leitura = useRef(0);
  // O id arrastado também mora num espelho: há navegador que entrega o
  // `dataTransfer` vazio no `drop` (e o arraste feito por teclado ou por
  // ferramenta de acessibilidade nem passa por ele). O espelho é o mesmo dado,
  // lido de um lugar que não depende disso.
  const arrastandoRef = useRef(null);

  // PELO CONTEÚDO, e não pela lista (auditoria de 28/10). O Painel passa um
  // `.filter()` novo a cada desenho dele, e uma mensagem do tempo real
  // redesenha o Painel com o funil aberto: pela lista, `ler` era refeita e o
  // quadro esvaziava e relia tudo — "Lendo o funil…", a rolagem de volta ao
  // começo, o arraste morto no meio e o "Mover para…" fechando sozinho.
  //
  // OS TELEFONES DO FUNIL (02/11): no funil de um telefone, só ele; no do
  // departamento, os telefones dele que NÃO têm funil próprio. É deles que
  // sai a conversa que o clique no cartão abre, e as tarefas do cartão.
  const chaveDosTelefones = telefonesDoFunil(escolhido, advogados, funis).join(",");
  const telefonesDoDep = useMemo(
    () => (chaveDosTelefones ? chaveDosTelefones.split(",") : []),
    [chaveDosTelefones]);
  // O funil escolhido, lido por um espelho dentro de `ler`: o objeto muda a
  // cada desenho, e a chave (texto) é o que entra nas dependências.
  const escolhidoRef = useRef(escolhido);
  escolhidoRef.current = escolhido;

  const avisar = useCallback((t) => {
    setAviso(t);
    if (t) setTimeout(() => setAviso((atual) => (atual === t ? null : atual)), 6000);
  }, []);

  // ------------------------------------------------------------
  //  A LEITURA — etapas, cartões, e o que o cartão mostra
  // ------------------------------------------------------------
  const ler = useCallback(async (mostrarCarregando = true) => {
    const funil = escolhidoRef.current;
    if (!funil) return;
    const minha = ++leitura.current;
    if (mostrarCarregando) setCarregando(true);
    try {
      const re = await noFunil(supabase.from("zorvin_etapas").select("*"), funil, comTelefone).order("ordem");
      if (minha !== leitura.current) return;
      if (re.error) {
        if (semATabela(re.error)) { setExiste(false); return; }
        setFalha(comOCodigo("Não consegui ler as etapas do funil.", re.error, "etapas do funil"));
        setExiste((v) => (v === null ? true : v));
        return;
      }
      setExiste(true);

      // Os cartões vêm em páginas: o PostgREST corta em 1000 sem avisar, e um
      // funil cortado calado se leria como completo (armadilha nº 2).
      const todos = [];
      let passou = false;
      for (let p = 0; p < PAGINAS_NO_MAXIMO; p++) {
        // O DESEMPATE PELO `id` (auditoria de 28/10): o "Trazer conversas"
        // grava todos os cartões num INSERT só, com o mesmo `movido_em`, e o
        // empate não tem ordem garantida de uma consulta para a outra — a
        // página 2 repetia cartões da 1 e deixava outros de fora.
        const rc = await noFunil(supabase.from("zorvin_cartoes").select("*"), funil, comTelefone)
          .order("movido_em", { ascending: false }).order("id")
          .range(p * PAGINA, (p + 1) * PAGINA - 1);
        if (minha !== leitura.current) return;
        if (rc.error) {
          setFalha(comOCodigo("Não consegui ler os cartões do funil.", rc.error, "cartões do funil"));
          return;
        }
        todos.push(...(rc.data || []));
        if ((rc.data || []).length < PAGINA) break;
        if (p === PAGINAS_NO_MAXIMO - 1) passou = true;
      }

      // O nome e o número de cada cliente, e a conversa mais recente dele
      // NESTE funil — é ela que o clique no cartão abre, e é dela que saem a
      // espera e as não lidas.
      const ids = [...new Set(todos.map((c) => c.contato_id))];
      const porId = {};
      const conv = {};
      const contatoDaConversa = {};
      for (const lote of emLotes(ids)) {
        const [rct, rcv] = await Promise.all([
          supabase.from("contatos").select("*").in("id", lote),
          telefonesDoDep.length
            ? supabase.from("conversas").select("*").in("contato_id", lote).in("advogado_id", telefonesDoDep)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (minha !== leitura.current) return;
        if (rct.error || rcv.error) {
          setFalha(comOCodigo("Não consegui ler os nomes dos clientes do funil.",
                              rct.error || rcv.error, "clientes do funil"));
          return;
        }
        for (const c of rct.data || []) porId[c.id] = c;
        for (const c of rcv.data || []) {
          contatoDaConversa[String(c.id)] = c.contato_id;
          const atual = conv[c.contato_id];
          if (!atual || new Date(c.ultima_atividade || 0) > new Date(atual.ultima_atividade || 0)) {
            conv[c.contato_id] = c;
          }
        }
      }
      if (minha !== leitura.current) return;
      // AS TAREFAS ABERTAS dos clientes do funil (script 018): o cartão diz a
      // mais urgente. É um sinal a mais, e a falha dele não derruba o funil —
      // mas é DITA, e não vira "sem tarefa".
      let tarefas = {};
      let erroTarefas = null;
      if (comTarefas) {
        const idsConversa = Object.keys(contatoDaConversa);
        for (const lote of emLotes(idsConversa)) {
          const rt = await supabase.from("zorvin_tarefas").select("*")
            .is("feita_em", null).in("conversa_id", lote);
          if (minha !== leitura.current) return;
          if (rt.error) {
            if (!semATabelaDeTarefas(rt.error)) {
              erroTarefas = comOCodigo("Não consegui ler as tarefas dos clientes.", rt.error, "tarefas do funil");
            }
            tarefas = {};
            break;
          }
          for (const t of ordenarAbertas(rt.data || [])) {
            const ct = contatoDaConversa[String(t.conversa_id)];
            if (ct && !tarefas[ct]) tarefas[ct] = t;
          }
        }
      }
      setEtapas(re.data || []);
      // UM MOVIMENTO EM VOO NÃO É DESFEITO PELA RELEITURA: a resposta do banco
      // pode ser de antes do clique, e o cartão voltaria para a coluna velha
      // por um instante, parecendo que não gravou.
      if (movendo.current === 0) setCartoes(todos);
      setContatos(porId);
      setConversas(conv);
      setTarefasPorContato(tarefas);
      setFalhaTarefas(erroTarefas);
      setCortado(passou);
      setFalha(null);
    } finally {
      if (minha === leitura.current) setCarregando(false);
    }
  }, [chaveEscolhido, telefonesDoDep, comTarefas, comTelefone]);  // eslint-disable-line react-hooks/exhaustive-deps

  // O QUADRO SÓ SE ESVAZIA QUANDO O FUNIL MUDA (28/10): é o único caso em que
  // o que está na tela é de outro funil. Uma releitura do mesmo funil troca
  // os cartões quando a resposta chega, sem buraco.
  useEffect(() => { setCartoes([]); setEtapas([]); }, [chaveEscolhido]);
  useEffect(() => { ler(true); }, [ler]);

  // A RELEITURA SOZINHA, de 30 em 30 segundos enquanto a tela está aberta: é
  // como o colega que moveu um cartão aparece aqui sem ninguém clicar.
  useEffect(() => {
    const t = setInterval(() => { if (movendo.current === 0) ler(false); }, RELER_A_CADA_MS);
    return () => clearInterval(t);
  }, [ler]);

  const ativas = useMemo(() => etapas.filter((e) => e.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)), [etapas]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cartoes;
    const digitos = q.replace(/\D/g, "");
    return cartoes.filter((c) => {
      const ct = contatos[c.contato_id] || {};
      // O nome pela conta dos menus (23/10): sem acento, palavras em qualquer ordem.
      if (casaComAPesquisa(q, nomeDoContato(ct))) return true;
      return digitos.length >= 3 && String(ct.numero || "").includes(digitos);
    });
  }, [cartoes, contatos, busca]);

  const porEtapa = useMemo(() => {
    const m = new Map(ativas.map((e) => [String(e.id), []]));
    const orfaos = [];
    for (const c of filtrados) {
      const lista = m.get(String(c.etapa_id));
      if (lista) lista.push(c); else orfaos.push(c);
    }
    return { m, orfaos };
  }, [filtrados, ativas]);

  // ------------------------------------------------------------
  //  MOVER E TIRAR
  // ------------------------------------------------------------
  async function mover(cartao, etapaId) {
    if (!cartao || String(cartao.etapa_id) === String(etapaId)) return;
    const antes = cartao.etapa_id;
    const destino = ativas.find((e) => String(e.id) === String(etapaId));
    movendo.current++;
    // UMA LEITURA QUE JÁ ESTAVA EM VOO É DE ANTES DESTE MOVIMENTO (auditoria
    // de 07/10): ela terminava depois, trazia o retrato velho e devolvia o
    // cartão para a coluna de onde ele acabou de sair — e o tirado voltava, e
    // o segundo "tirar" ouvia "o banco não deixou". Avançar o número da
    // leitura faz a que está em voo ser descartada.
    leitura.current++;
    // O MOTIVO DA IA SAI JUNTO (044): quem moveu agora foi uma pessoa, e o
    // gatilho do banco o apaga na mesma gravação. Na recusa, ele volta.
    const motivoAntes = cartao.ia_motivo;
    setCartoes((l) => l.map((c) => (c.id === cartao.id
      ? { ...c, etapa_id: etapaId, movido_em: new Date().toISOString(), ia_motivo: null } : c)));
    try {
      const r = await supabase.from("zorvin_cartoes").update({ etapa_id: etapaId })
        .eq("id", cartao.id).select("id");
      if (r.error || naoGravouNada(r)) {
        setCartoes((l) => l.map((c) => (c.id === cartao.id ? { ...c, etapa_id: antes, ia_motivo: motivoAntes } : c)));
        avisar(r.error
          ? comOCodigo("Não consegui mover o cartão — ele voltou para onde estava.", r.error, "mover cartão")
          : "Não consegui mover o cartão: o banco não deixou. Ele voltou para onde estava.");
        return;
      }
      avisar(`${nomeDoContato(contatos[cartao.contato_id])} foi para “${destino ? destino.nome : "outra etapa"}”.`);
    } finally {
      movendo.current--;
      // A leitura descartada acima não apaga o "carregando" que ela acendeu.
      setCarregando(false);
    }
  }

  async function tirar(cartao) {
    const nome = nomeDoContato(contatos[cartao.contato_id]);
    if (!window.confirm(`Tirar ${nome} do funil? A conversa continua; só o cartão sai.`)) return;
    movendo.current++;
    // UMA LEITURA QUE JÁ ESTAVA EM VOO É DE ANTES DESTE MOVIMENTO (auditoria
    // de 07/10): ela terminava depois, trazia o retrato velho e devolvia o
    // cartão para a coluna de onde ele acabou de sair — e o tirado voltava, e
    // o segundo "tirar" ouvia "o banco não deixou". Avançar o número da
    // leitura faz a que está em voo ser descartada.
    leitura.current++;
    try {
      const r = await supabase.from("zorvin_cartoes").delete().eq("id", cartao.id).select("id");
      if (r.error || naoGravouNada(r)) {
        avisar(r.error
          ? comOCodigo("Não consegui tirar o cartão do funil.", r.error, "tirar cartão")
          : "Não consegui tirar o cartão: o banco não deixou.");
        return;
      }
      setCartoes((l) => l.filter((c) => c.id !== cartao.id));
      avisar(`${nome} saiu do funil.`);
    } finally {
      movendo.current--;
      // A leitura descartada acima não apaga o "carregando" que ela acendeu.
      setCarregando(false);
    }
  }

  async function trazer() {
    setTrazendo(true);
    try {
      // O FUNIL DE UM TELEFONE leva o telefone junto (043); o do departamento
      // manda só departamento e dias, que é a chamada que o banco de antes
      // também entende.
      const r = await supabase.rpc("zorvin_funil_trazer", {
        p_departamento: depId, p_dias: Number(diasTrazer),
        ...(escolhido && escolhido.telefoneId ? { p_telefone: escolhido.telefoneId } : {}),
      });
      if (r.error) {
        avisar(comOCodigo("Não consegui trazer as conversas para o funil.", r.error, "trazer para o funil"));
        return;
      }
      const n = Number(r.data) || 0;
      avisar(n === 0
        ? `Nenhum cliente novo: quem conversou nos últimos ${diasTrazer} dias já está no funil.`
        : `${n} ${n === 1 ? "cliente entrou" : "clientes entraram"} em “${ativas[0] ? ativas[0].nome : "a primeira etapa"}”.`);
      await ler(false);
    } finally {
      setTrazendo(false);
    }
  }

  // ------------------------------------------------------------
  //  O DESENHO
  // ------------------------------------------------------------
  const nomeDoEscolhido = nomeDoFunil(escolhido, departamentos, advogados);
  const verde = C.green || "#00a884";
  const total = cartoes.length;

  const botaoFraco = {
    border: `1px solid ${C.divider}`, background: C.panel, color: C.textPrimary, borderRadius: 18,
    padding: "6px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  };

  // FUNÇÕES QUE DESENHAM, e não componentes: um componente declarado aqui dentro
  // seria um TIPO novo a cada desenho, e o React trocaria o elemento inteiro —
  // no meio de um arraste, o que o navegador estava arrastando deixaria de
  // existir, e o arraste morreria sozinho.
  function cartao(c) {
    const ct = contatos[c.contato_id] || {};
    const nome = nomeDoContato(ct) || "Cliente";
    const cv = conversas[c.contato_id];
    const espera = cv && cv.esperando_desde ? diasDesde(cv.esperando_desde) : 0;
    const naoLidas = (cv && cv.nao_lidas) || 0;
    const tarefa = tarefasPorContato[c.contato_id] || null;
    return (
      <div key={c.id} data-cartao-do-funil={c.contato_id} data-etapa={c.etapa_id}
           draggable onDragStart={(e) => {
             arrastandoRef.current = String(c.id); setArrastando(c.id);
             try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(c.id)); } catch (_) { /* o espelho basta */ }
           }}
           onDragEnd={() => { arrastandoRef.current = null; setArrastando(null); setSobre(null); }}
           style={{ background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10, padding: 10,
                    boxShadow: "0 1px 2px rgba(0,0,0,.08)", cursor: "grab",
                    opacity: arrastando === c.id ? 0.5 : 1 }}>
        <button type="button" data-abrir-cartao onClick={() => cv && aoAbrirConversa && aoAbrirConversa(cv)}
                disabled={!cv} title={cv ? "Abrir a conversa" : "Nenhuma conversa deste cliente num telefone que você atende"}
                style={{ all: "unset", display: "flex", alignItems: "center", gap: 8, width: "100%",
                         cursor: cv ? "pointer" : "default", minWidth: 0 }}>
          <Inicial nome={nome} cor={corDe(nome)} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span data-nome-no-cartao style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.textPrimary,
                           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
            <span style={{ display: "block", fontSize: 12, color: C.textSecondary }}>
              {String(ct.numero || "").startsWith("grupo:") ? "Grupo" : telefoneLegivel(ct.numero)}
            </span>
          </span>
          {naoLidas > 0 && (
            <span title={`${naoLidas} não lida${naoLidas === 1 ? "" : "s"}`}
                  style={{ background: verde, color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700,
                           minWidth: 20, height: 20, display: "grid", placeItems: "center", padding: "0 5px" }}>
              {naoLidas}
            </span>
          )}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5,
                      color: C.textSecondary, flexWrap: "wrap" }}>
          <span title="Desde quando o cartão está nesta etapa">Nesta etapa {haQuanto(c.movido_em)}</span>
          {espera >= 1 && (
            <span data-espera-no-cartao style={{ color: espera >= 3 ? "#e53935" : "#d99a1e", fontWeight: 600 }}>
              · esperando há {espera} {espera === 1 ? "dia" : "dias"}
            </span>
          )}
          {!cv && <span>· <MessageCircle size={11} style={{ verticalAlign: -1 }} /> sem conversa à vista</span>}
        </div>
        {/* A IA PÔS AQUI (044): o porquê dela, em até duas linhas, e inteiro
            no `title`. Uma pessoa que move o cartão apaga o motivo — ele
            só fala da etapa que a IA escolheu. */}
        {c.ia_motivo && (
          <div data-cartao-pela-ia title={`A IA pôs aqui: ${c.ia_motivo}`}
               style={{ marginTop: 6, display: "flex", gap: 5, alignItems: "flex-start", fontSize: 11.5,
                        color: C.textSecondary, lineHeight: 1.4 }}>
            <Sparkles size={12} color={verde} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              <b>IA:</b> {c.ia_motivo}
            </span>
          </div>
        )}
        {tarefa && (
          <div data-tarefa-no-cartao={situacao(tarefa)} title={tarefa.texto}
               style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: situacao(tarefa) === "atrasada" ? "#e53935" : situacao(tarefa) === "hoje" ? "#d99a1e" : C.textSecondary }}>
            ⏰ {situacao(tarefa) === "atrasada" ? "Tarefa atrasada" : `Tarefa ${rotuloDaTarefa(tarefa)}`}: {tarefa.texto}
          </div>
        )}
        <select data-mover-cartao value="" aria-label={`Mover ${nome} para outra etapa`}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__tirar") tirar(c); else if (v) mover(c, v);
                }}
                style={{ marginTop: 8, width: "100%", fontSize: 12.5, padding: "5px 6px", borderRadius: 6,
                         border: `1px solid ${C.divider}`, background: C.searchBg || C.panel, color: C.textPrimary }}>
          <option value="">Mover para…</option>
          {ativas.filter((e) => String(e.id) !== String(c.etapa_id)).map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
          <option value="__tirar">Tirar do funil…</option>
        </select>
      </div>
    );
  }

  function coluna(etapa, lista, desativadas = false) {
    const id = etapa ? String(etapa.id) : "__desativadas";
    const alvo = !desativadas && sobre === id;
    return (
      <section key={etapa ? etapa.id : "__desativadas"} data-coluna-do-funil={etapa ? etapa.nome : "Em etapas desativadas"}
               onDragOver={(e) => {
                 if (desativadas) return;
                 e.preventDefault();
                 try { e.dataTransfer.dropEffect = "move"; } catch (_) { /* sem efeito visual, e só */ }
                 setSobre(id);
               }}
               onDragLeave={() => setSobre((s) => (s === id ? null : s))}
               onDrop={(e) => {
                 e.preventDefault(); setSobre(null);
                 let cid = "";
                 try { cid = e.dataTransfer.getData("text/plain"); } catch (_) { /* cai no espelho */ }
                 cid = cid || arrastandoRef.current;
                 arrastandoRef.current = null;
                 const c = cartoes.find((x) => String(x.id) === String(cid));
                 if (c && etapa) mover(c, etapa.id);
               }}
               style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column",
                        background: alvo ? "rgba(0,168,132,.10)" : C.headerBar,
                        border: `1px ${alvo ? "dashed" : "solid"} ${alvo ? verde : C.divider}`,
                        borderRadius: 12, maxHeight: "100%", minHeight: 0 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                         background: etapa ? (etapa.cor || verde) : C.textSecondary }} />
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden",
                         textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {etapa ? etapa.nome : "Em etapas desativadas"}
          </span>
          <span data-contagem-da-coluna style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>{lista.length}</span>
        </header>
        {desativadas && (
          <div style={{ fontSize: 11.5, color: C.textSecondary, padding: "0 12px 8px", lineHeight: 1.4 }}>
            Estes clientes estão numa etapa que foi desativada. Mova cada um para uma etapa em uso.
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
          {lista.map((c) => cartao(c))}
          {lista.length === 0 && !desativadas && (
            <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", padding: "14px 6px" }}>
              Arraste um cartão para cá
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div data-tela="funil"
         style={{ position: "fixed", inset: 0, background: C.bg || C.headerBar, color: C.textPrimary,
                  zIndex: 200, display: "flex", flexDirection: "column" }}>
      {/* ================= A BARRA DO ALTO ================= */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={aoFechar} title="Voltar" aria-label="Voltar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex",
                         padding: 6, marginLeft: -6, borderRadius: 8, color: C.textSecondary }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ fontSize: 17, fontWeight: 700, marginRight: 4 }}>Funil</div>
        {opcoes.length > 1 ? (
          <select data-funil-departamento value={chaveEscolhido}
                  onChange={(e) => setEscolhido(opcoes.find((o) => chaveDoFunil(o) === e.target.value) || null)}
                  aria-label="Qual funil"
                  style={{ ...botaoFraco, padding: "6px 10px", appearance: "auto" }}>
            {opcoes.map((o) => (
              <option key={chaveDoFunil(o)} value={chaveDoFunil(o)} data-opcao-de-funil={o.telefoneId ? "telefone" : "departamento"}>
                {nomeDoFunil(o, departamentos, advogados)}
              </option>
            ))}
          </select>
        ) : escolhido ? <span data-nome-do-funil style={{ color: C.textSecondary, fontSize: 14 }}>{nomeDoEscolhido}</span> : null}
        <span data-total-do-funil style={{ fontSize: 13, color: C.textSecondary }}>
          {existe ? `${total} ${total === 1 ? "cliente" : "clientes"}` : ""}
        </span>
        <div style={{ flex: "1 1 auto" }} />
        <label style={{ ...botaoFraco, cursor: "text", padding: "5px 10px" }}>
          <Search size={15} color={C.textSecondary} />
          <input data-busca-no-funil value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Buscar nome ou número"
                 style={{ border: "none", outline: "none", background: "transparent", color: C.textPrimary,
                          fontSize: 13, width: 170 }} />
          {busca && (
            <button onClick={() => setBusca("")} aria-label="Limpar a busca"
                    style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0 }}>
              <X size={14} color={C.textSecondary} />
            </button>
          )}
        </label>
        <button onClick={() => ler(true)} style={botaoFraco} title="Ler o funil de novo" data-atualizar-funil>
          <RefreshCw size={15} /> Atualizar
        </button>
        {souAdmin && existe && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <button data-trazer-para-o-funil onClick={trazer} disabled={trazendo || !ativas.length} style={botaoFraco}
                    title="Põe na primeira etapa quem conversou no período e ainda não está no funil">
              <Download size={15} /> {trazendo ? "Trazendo…" : "Trazer conversas"}
            </button>
            <select data-dias-para-trazer value={diasTrazer} onChange={(e) => setDiasTrazer(Number(e.target.value))}
                    aria-label="De quantos dias" style={{ ...botaoFraco, padding: "6px 8px", appearance: "auto" }}>
              {[7, 30, 90, 365].map((n) => <option key={n} value={n}>últimos {n} dias</option>)}
            </select>
          </span>
        )}
      </div>

      {(aviso || falha || cortado || falhaTarefas || erroDosFunis) && (
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {/* SEM SABER QUAIS TELEFONES TÊM FUNIL PRÓPRIO (02/11), a lista do
              alto mostra só o de cada departamento — e isso é DITO, senão ela
              se leria como "nenhum telefone tem funil próprio". */}
          {erroDosFunis && (
            <div data-falha-dos-funis style={{ background: "#fff4e5", color: "#7a4b00", border: "1px solid #ffd699",
                                               borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              {erroDosFunis} Os funis próprios dos telefones não estão na lista; feche e abra o funil para tentar de novo.
            </div>
          )}
          {falha && (
            <div data-falha-do-funil style={{ background: "#fff4e5", color: "#7a4b00", border: "1px solid #ffd699",
                                              borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>{falha}</div>
          )}
          {!falha && falhaTarefas && (
            <div data-falha-das-tarefas-do-funil style={{ background: "#fff4e5", color: "#7a4b00", border: "1px solid #ffd699",
                                                          borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              {falhaTarefas} Os cartões estão sem o aviso de tarefa.
            </div>
          )}
          {cortado && (
            <div style={{ background: "#fff4e5", color: "#7a4b00", border: "1px solid #ffd699",
                          borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              Este funil tem mais de {PAGINA * PAGINAS_NO_MAXIMO} clientes, e só os {PAGINA * PAGINAS_NO_MAXIMO} movidos
              mais recentemente estão na tela.
            </div>
          )}
          {aviso && (
            <div data-aviso-do-funil role="status"
                 style={{ background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 8,
                          padding: "8px 12px", fontSize: 13 }}>{aviso}</div>
          )}
        </div>
      )}

      {/* ================= AS COLUNAS ================= */}
      {existe === false ? (
        <div data-funil-sem-script style={{ padding: 32, maxWidth: 560, color: C.textSecondary, lineHeight: 1.5 }}>
          {souAdmin
            ? "O funil ainda não foi instalado neste banco: falta rodar o script 017 (o funil de etapas) no Supabase."
            : "O funil ainda não está disponível. Avise quem administra o Zorvin."}
        </div>
      ) : !escolhido ? (
        <div style={{ padding: 32, color: C.textSecondary }}>Nenhum departamento à vista para mostrar o funil.</div>
      ) : existe && !carregando && !falha && ativas.length === 0 ? (
        <div data-funil-sem-etapas style={{ padding: 32, maxWidth: 560, color: C.textSecondary, lineHeight: 1.5 }}>
          Este funil ainda não tem etapas.
          {souAdmin ? " Crie as etapas em Menu → Departamentos e acessos → Estrutura." : " Avise quem administra o Zorvin."}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden", padding: "12px 16px 16px" }}>
          <div style={{ display: "flex", gap: 12, height: "100%", alignItems: "stretch" }}>
            {ativas.map((e) => coluna(e, porEtapa.m.get(String(e.id)) || []))}
            {porEtapa.orfaos.length > 0 && coluna(null, porEtapa.orfaos, true)}
          </div>
          {existe && !carregando && total === 0 && !falha && (
            <div data-funil-vazio style={{ position: "relative", marginTop: -40, fontSize: 13, color: C.textSecondary }}>
              Ninguém neste funil ainda. Os clientes novos entram sozinhos na primeira etapa
              {souAdmin ? "; os que já conversavam entram por “Trazer conversas”." : "."}
            </div>
          )}
        </div>
      )}
      {carregando && existe !== false && (
        <div style={{ position: "absolute", top: 70, right: 20, fontSize: 12, color: C.textSecondary }}>Lendo o funil…</div>
      )}
    </div>
  );
}
