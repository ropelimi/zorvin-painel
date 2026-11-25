import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, RefreshCw, ChevronDown, ChevronRight, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "./supabase.js";
import { comOCodigo } from "./gravar.js";
import { nomeDoContato } from "./contato.js";
import { enderecoDaConversa } from "./guias.js";
import { NOME_DA_SITUACAO } from "./abasDaSituacao.js";
import { NOME_DO_ASSISTENTE } from "./assistente.js";
import { RostoDoAssistente } from "./RostoDoAssistente.jsx";
import { corDaEspera } from "./espera.js";
import {
  TETO_DAS_MENSAGENS_DO_QUAZAR, FILTROS_DA_ESPERA, FILTRO_PADRAO, semAColunaDoQuazar,
  resumoDaConversa, passaNaEspera, fraseDaEspera, horaDeBrasilia, textoDaMensagem,
  ehDoQuazar, ehDoCliente,
} from "./conversasDoQuazar.js";

// ============================================================
//  A TELA "CONVERSAS DO QUAZAR" (25/11)
//
//  Pedido do Rodrigo: ver todas as mensagens que o Quazar conversou com o
//  cliente que estava aguardando há mais de 7 dias. Abre numa guia própria,
//  pelo menu ⋮ do topo, como o Funil e as Tarefas. As contas sem tela moram
//  em `conversasDoQuazar.js`.
//
//  SÓ LÊ, E A REGRA DE ACESSO DECIDE: cada pessoa vê as conversas dos
//  telefones que atende, como em qualquer leitura do painel.
//
//  A LEITURA, de cima para baixo:
//    1. as mensagens do Quazar (`pelo_quazar`), as mais recentes, até 500;
//    2. as conversas delas e os clientes, em lotes;
//    3. as mensagens dessas conversas, só com as colunas que contam a espera
//       (quem escreveu e quando) — o texto vem só quando a linha abre.
//
//  TRÊS DESFECHOS, e cada um diz o seu: o banco sem a marca do Quazar (o 059
//  da ponte não rodou); a leitura que falha, com o código (e nunca "nenhuma
//  conversa"); e a lista vazia de verdade.
// ============================================================

const LOTE = 150;
const LOTE_DAS_MENSAGENS = 50;
const PAGINA = 1000;
const PAGINAS_POR_LOTE = 10;
// Na conversa aberta da linha: as últimas mensagens da espera, e o começo do
// que veio depois. Uma espera de três semanas pode ter trinta mensagens do
// cliente, e a tela diz quantas ficaram de fora.
const DA_ESPERA_NA_TELA = 10;
const DEPOIS_NA_TELA = 30;

function emLotes(lista, n) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += n) lotes.push(lista.slice(i, i + n));
  return lotes;
}

export default function ConversasDoQuazar({ C, meuId, pessoas = {}, advogados = [], aoFechar }) {
  const [existe, setExiste] = useState(null);
  const [falha, setFalha] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [linhas, setLinhas] = useState(null);       // null = ainda lendo
  const [cortado, setCortado] = useState(false);
  const [mensagensCortadas, setMensagensCortadas] = useState(false);
  const [filtro, setFiltro] = useState(FILTRO_PADRAO);
  const [abertas, setAbertas] = useState({});       // conversa → { estado, mensagens, erro }
  const leitura = useRef(0);

  const nomeDoTelefone = useCallback((id) => {
    const a = advogados.find((x) => String(x.id) === String(id));
    return (a && a.nome) || "Outro telefone";
  }, [advogados]);

  const nomeDaPessoa = useCallback((id) => {
    if (!id) return null;
    if (String(id) === String(meuId)) return "você";
    const p = pessoas[String(id)];
    return (p && p.nome) || "alguém que saiu da equipe";
  }, [pessoas, meuId]);

  const ler = useCallback(async () => {
    const minha = ++leitura.current;
    setCarregando(true);
    setFalha(null);
    try {
      // 1. AS MENSAGENS DO QUAZAR, as mais recentes.
      const rq = await supabase.from("mensagens").select("id, conversa_id, criado_em")
        .eq("pelo_quazar", true).order("criado_em", { ascending: false }).limit(TETO_DAS_MENSAGENS_DO_QUAZAR);
      if (minha !== leitura.current) return;
      if (rq.error) {
        if (semAColunaDoQuazar(rq.error)) { setExiste(false); return; }
        setFalha(comOCodigo("Não consegui ler as mensagens do Quazar.", rq.error, "conversas do Quazar"));
        return;
      }
      setExiste(true);
      const doQuazar = rq.data || [];
      setCortado(doQuazar.length >= TETO_DAS_MENSAGENS_DO_QUAZAR);
      // A ordem da lista é a da mensagem mais recente do Quazar em cada
      // conversa: a primeira aparição, porque a leitura veio da mais nova.
      const ids = [];
      const vistas = new Set();
      for (const m of doQuazar) {
        const id = String(m.conversa_id);
        if (!vistas.has(id)) { vistas.add(id); ids.push(id); }
      }
      if (!ids.length) { setLinhas([]); return; }

      // 2. AS CONVERSAS E OS CLIENTES.
      const conversas = {};
      for (const lote of emLotes(ids, LOTE)) {
        const rc = await supabase.from("conversas").select("*").in("id", lote);
        if (minha !== leitura.current) return;
        if (rc.error) { setFalha(comOCodigo("Não consegui ler as conversas do Quazar.", rc.error, "conversas do Quazar")); return; }
        for (const c of rc.data || []) conversas[String(c.id)] = c;
      }
      const idsDosContatos = [...new Set(Object.values(conversas).map((c) => String(c.contato_id)).filter(Boolean))];
      const contatos = {};
      for (const lote of emLotes(idsDosContatos, LOTE)) {
        const rt = await supabase.from("contatos").select("*").in("id", lote);
        if (minha !== leitura.current) return;
        if (rt.error) { setFalha(comOCodigo("Não consegui ler os nomes dos clientes.", rt.error, "clientes do Quazar")); return; }
        for (const c of rt.data || []) contatos[String(c.id)] = c;
      }

      // 3. AS MENSAGENS DESSAS CONVERSAS, só quem escreveu e quando. Da mais
      // nova para a mais velha: no teto, o que fica de fora é o mais antigo,
      // e a tela diz que cortou.
      const idsQueVemos = ids.filter((id) => conversas[id]);
      const porConversa = {};
      let cortouMensagens = false;
      for (const lote of emLotes(idsQueVemos, LOTE_DAS_MENSAGENS)) {
        for (let p = 0; p < PAGINAS_POR_LOTE; p++) {
          const rm = await supabase.from("mensagens").select("id, conversa_id, origem, automatica, pelo_quazar, criado_em")
            .in("conversa_id", lote).order("criado_em", { ascending: false }).order("id", { ascending: false })
            .range(p * PAGINA, (p + 1) * PAGINA - 1);
          if (minha !== leitura.current) return;
          if (rm.error) { setFalha(comOCodigo("Não consegui ler as mensagens das conversas do Quazar.", rm.error, "mensagens das conversas do Quazar")); return; }
          for (const m of rm.data || []) (porConversa[String(m.conversa_id)] ||= []).push(m);
          if ((rm.data || []).length < PAGINA) break;
          if (p === PAGINAS_POR_LOTE - 1) cortouMensagens = true;
        }
      }
      setMensagensCortadas(cortouMensagens);

      const novas = [];
      for (const id of idsQueVemos) {
        const conversa = conversas[id];
        const resumo = resumoDaConversa(porConversa[id] || []);
        if (!resumo) continue;
        novas.push({ id, conversa, contato: contatos[String(conversa.contato_id)] || null, resumo });
      }
      setLinhas(novas);
    } catch (e) {
      if (minha === leitura.current) setFalha(comOCodigo("Não consegui ler as conversas do Quazar.", e, "conversas do Quazar"));
    } finally {
      if (minha === leitura.current) setCarregando(false);
    }
  }, []);

  useEffect(() => { ler(); }, [ler]);

  // A CONVERSA DE UMA LINHA, ao abrir: o texto das mensagens da espera e do
  // que veio depois, pelos ids que a leitura de cima já achou.
  const abrir = useCallback(async (linha) => {
    const id = linha.id;
    const atual = abertas[id];
    if (atual && atual.estado !== "falhou") {
      setAbertas((a) => { const n = { ...a }; delete n[id]; return n; });
      return;
    }
    const p = linha.resumo.principal;
    const daEspera = p.idsDaEspera.slice(-DA_ESPERA_NA_TELA);
    const depois = p.ids.slice(0, DEPOIS_NA_TELA);
    const quais = [...daEspera, ...depois];
    setAbertas((a) => ({ ...a, [id]: { estado: "carregando" } }));
    const r = quais.length
      ? await supabase.from("mensagens").select("*").in("id", quais)
      : { data: [], error: null };
    if (r.error) {
      setAbertas((a) => ({ ...a, [id]: { estado: "falhou", erro: comOCodigo("Não consegui abrir as mensagens desta conversa.", r.error, "mensagens do Quazar") } }));
      return;
    }
    const porId = Object.fromEntries((r.data || []).map((m) => [String(m.id), m]));
    setAbertas((a) => ({ ...a, [id]: {
      estado: "pronto",
      espera: daEspera.map((x) => porId[String(x)]).filter(Boolean),
      esperaDeFora: p.idsDaEspera.length - daEspera.length,
      depois: depois.map((x) => porId[String(x)]).filter(Boolean),
      depoisDeFora: p.ids.length - depois.length,
    } }));
  }, [abertas]);

  const contagens = useMemo(() => Object.fromEntries(FILTROS_DA_ESPERA.map((f) =>
    [f.id, (linhas || []).filter((l) => passaNaEspera(l.resumo, f.id)).length])), [linhas]);
  const visiveis = (linhas || []).filter((l) => passaNaEspera(l.resumo, filtro));
  const filtroAtual = FILTROS_DA_ESPERA.find((f) => f.id === filtro) || FILTROS_DA_ESPERA[0];

  const BOTAO_REDONDO = { border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" };

  // FUNÇÕES QUE DESENHAM, e não componentes declarados aqui dentro: um
  // componente declarado dentro de outro é um tipo novo a cada desenho, e o
  // React trocaria a linha inteira a cada releitura.
  function desenharMensagem(m) {
    const doQuazar = ehDoQuazar(m);
    const doCliente = ehDoCliente(m);
    return (
      <div key={m.id} data-mensagem-da-conversa-do-quazar={doQuazar ? "quazar" : doCliente ? "cliente" : "outra"}
           style={{ display: "flex", justifyContent: doQuazar ? "flex-end" : "flex-start", margin: "5px 0" }}>
        <div style={{ maxWidth: "85%", minWidth: 0, background: doQuazar ? C.bubbleOut : C.bubbleIn, color: C.textPrimary,
                      borderRadius: 8, padding: "6px 9px 4px", boxShadow: "0 1px 0.5px rgba(0,0,0,.13)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, marginBottom: 2,
                        color: doQuazar ? (C.verdeTexto || C.green) : C.textSecondary }}>
            {doQuazar && <RostoDoAssistente tamanho={14} />}
            {doQuazar ? `${NOME_DO_ASSISTENTE} · assistente virtual` : "Cliente"}
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{textoDaMensagem(m)}</div>
          <div style={{ fontSize: 11, color: doQuazar ? (C.horaNaSaida || C.textSecondary) : C.textSecondary, textAlign: "right", marginTop: 2 }}>
            {horaDeBrasilia(m.criado_em)}
          </div>
        </div>
      </div>
    );
  }

  function desenharLinha(l) {
    const p = l.resumo.principal;
    const c = l.conversa;
    const aberta = abertas[l.id];
    const aba = c.arquivada ? "Arquivada" : (c.situacao && NOME_DA_SITUACAO[c.situacao]) || null;
    const responsavel = nomeDaPessoa(c.responsavel_id);
    const corDaFrase = p.dias >= 2 ? corDaEspera(p.dias, C) : C.textSecondary;
    const outros = l.resumo.episodios.length - 1;
    return (
      <div key={l.id} data-conversa-do-quazar={l.id} data-espera-dias={p.dias}
           style={{ borderBottom: `1px solid ${C.divider}`, padding: "11px 4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 8px" }}>
              <span data-cliente-do-quazar style={{ fontSize: 14.5, fontWeight: 700, color: C.textPrimary, wordBreak: "break-word" }}>
                {nomeDoContato(l.contato) || "Cliente"}
              </span>
              <span data-telefone-do-quazar style={{ fontSize: 12, color: C.textSecondary }}>{nomeDoTelefone(c.advogado_id)}</span>
            </div>
            <div data-frase-da-espera style={{ fontSize: 13, marginTop: 3, color: corDaFrase, fontWeight: p.dias >= 7 ? 600 : 400, lineHeight: 1.4 }}>
              {fraseDaEspera(p)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 3, fontSize: 12, color: C.textSecondary }}>
              <span data-quantas-do-quazar>
                {l.resumo.quantasDoQuazar} {l.resumo.quantasDoQuazar === 1 ? "mensagem" : "mensagens"} do {NOME_DO_ASSISTENTE}
              </span>
              <span data-cliente-respondeu={p.clienteRespondeu ? "sim" : "nao"}>
                · {p.clienteRespondeu ? "o cliente respondeu depois" : "o cliente ainda não respondeu"}
              </span>
              {p.equipeEntrouEm && <span data-equipe-entrou>· a equipe entrou em {horaDeBrasilia(p.equipeEntrouEm)}</span>}
              {aba && <span data-aba-do-quazar>· {aba}</span>}
              <span data-responsavel-do-quazar>
                · {responsavel ? `com ${responsavel}${c.responsavel_em ? ` desde ${horaDeBrasilia(c.responsavel_em).split(" ")[0]}` : ""}` : "sem responsável"}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <button type="button" data-ver-conversa-do-quazar={l.id} onClick={() => abrir(l)} aria-expanded={!!aberta && aberta.estado !== "falhou"}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${C.divider}`, background: "transparent",
                               color: C.textPrimary, borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", minHeight: 32 }}>
                {aberta && aberta.estado !== "falhou" ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                {aberta && aberta.estado !== "falhou" ? "Esconder as mensagens" : "Ver as mensagens"}
              </button>
              {/* UM LINK DE VERDADE: o Ctrl+clique e o "abrir em nova guia"
                  funcionam como em qualquer link, e a guia nova não alcança
                  esta (`noopener`). */}
              <a data-abrir-conversa-do-quazar={l.id} data-abre-guia target="_blank" rel="noopener"
                 href={enderecoDaConversa({ conversaId: c.id, advogadoId: c.advogado_id })}
                 style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${C.green}`, color: C.verdeTexto || C.green,
                          borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, textDecoration: "none", minHeight: 32, boxSizing: "border-box" }}>
                <ExternalLink size={14} /> Abrir a conversa
              </a>
            </div>
          </div>
        </div>
        {aberta && (
          <div data-mensagens-do-quazar={l.id} style={{ marginTop: 10, background: C.chatBg || C.bg, borderRadius: 10, padding: "8px 10px" }}>
            {aberta.estado === "carregando" && (
              <div style={{ fontSize: 13, color: C.textSecondary, padding: 6 }}>Abrindo as mensagens…</div>
            )}
            {aberta.estado === "falhou" && (
              <div data-falha-da-conversa-do-quazar style={{ fontSize: 13, color: C.erroTexto, padding: 6 }}>{aberta.erro}</div>
            )}
            {aberta.estado === "pronto" && (
              <>
                {aberta.esperaDeFora > 0 && (
                  <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", margin: "2px 0 6px" }}>
                    … e mais {aberta.esperaDeFora} {aberta.esperaDeFora === 1 ? "mensagem" : "mensagens"} do cliente antes destas
                  </div>
                )}
                {aberta.espera.length > 0 && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSecondary, margin: "2px 0 4px", letterSpacing: 0.3 }}>
                    O CLIENTE ESPERAVA
                  </div>
                )}
                {aberta.espera.map(desenharMensagem)}
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textSecondary, margin: "8px 0 4px", letterSpacing: 0.3 }}>
                  A CONVERSA COM O {NOME_DO_ASSISTENTE.toUpperCase()}
                </div>
                {aberta.depois.map(desenharMensagem)}
                {aberta.depoisDeFora > 0 && (
                  <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", margin: "6px 0 2px" }}>
                    … e mais {aberta.depoisDeFora} {aberta.depoisDeFora === 1 ? "mensagem" : "mensagens"} — abra a conversa para ver tudo
                  </div>
                )}
                {p.equipeEntrouEm && (
                  <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", margin: "6px 0 2px" }}>
                    Depois, a equipe entrou na conversa em {horaDeBrasilia(p.equipeEntrouEm)}.
                  </div>
                )}
                {outros > 0 && (
                  <div style={{ fontSize: 12, color: C.textSecondary, textAlign: "center", margin: "6px 0 2px" }}>
                    O {NOME_DO_ASSISTENTE} também escreveu nesta conversa em {outros === 1 ? "outro momento" : `outros ${outros} momentos`}.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const CHIP = (ativo) => ({
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 16, padding: "6px 12px", minHeight: 32, cursor: "pointer",
    fontSize: 13, fontWeight: ativo ? 700 : 500, border: `1px solid ${ativo ? C.botao || C.green : C.divider}`,
    background: ativo ? (C.botao || C.green) : "transparent", color: ativo ? "#fff" : C.textPrimary,
  });

  return (
    <div data-tela="quazar" style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg || C.headerBar,
                                     display: "flex", flexDirection: "column", color: C.textPrimary }}>
      <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={aoFechar} title="Fechar esta guia" aria-label="Fechar esta guia" data-fechar-a-guia style={BOTAO_REDONDO}>
          <X size={20} color={C.textSecondary} />
        </button>
        <RostoDoAssistente tamanho={24} />
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1, minWidth: 0 }}>Conversas do {NOME_DO_ASSISTENTE}</span>
        <button data-atualizar-quazar onClick={() => ler()} title="Atualizar" aria-label="Atualizar" style={BOTAO_REDONDO}>
          <RefreshCw size={18} color={C.textSecondary} style={{ opacity: carregando ? 0.4 : 1 }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 16px 40px" }}>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.45, marginBottom: 10 }}>
            As conversas em que o {NOME_DO_ASSISTENTE} escreveu ao cliente, da mais recente para a mais antiga. A espera conta da
            primeira mensagem do cliente depois da última resposta da equipe até a primeira mensagem do {NOME_DO_ASSISTENTE}.
          </div>

          {existe === false && (
            <div data-quazar-sem-coluna style={{ fontSize: 14, color: C.textSecondary, padding: "24px 4px", lineHeight: 1.5 }}>
              Este Zorvin ainda não tem as respostas do {NOME_DO_ASSISTENTE}: falta a atualização do banco que as marca (script 059 da ponte).
            </div>
          )}

          {falha && (
            <div data-falha-do-quazar style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "12px", borderRadius: 10,
                                               border: `1px solid ${C.erroTexto}`, color: C.erroTexto, fontSize: 13.5, lineHeight: 1.45, marginBottom: 12 }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                {falha}
                <div>
                  <button data-tentar-de-novo-quazar onClick={() => ler()}
                          style={{ marginTop: 8, border: `1px solid ${C.erroTexto}`, background: "transparent", color: C.erroTexto,
                                   borderRadius: 8, padding: "5px 10px", fontSize: 13, cursor: "pointer" }}>Tentar de novo</button>
                </div>
              </div>
            </div>
          )}

          {existe !== false && !falha && linhas === null && (
            <div data-quazar-lendo style={{ fontSize: 14, color: C.textSecondary, padding: "24px 4px" }}>Lendo as conversas do {NOME_DO_ASSISTENTE}…</div>
          )}

          {existe === true && !falha && linhas && linhas.length === 0 && (
            <div data-quazar-vazio style={{ fontSize: 14, color: C.textSecondary, padding: "24px 4px", lineHeight: 1.5 }}>
              O {NOME_DO_ASSISTENTE} ainda não conversou com nenhum cliente dos telefones que você atende.
            </div>
          )}

          {!falha && linhas && linhas.length > 0 && (
            <>
              <div data-filtros-do-quazar style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {FILTROS_DA_ESPERA.map((f) => (
                  <button key={f.id} type="button" data-filtro-quazar={f.id} data-contagem={contagens[f.id]} aria-pressed={filtro === f.id}
                          onClick={() => setFiltro(f.id)} style={CHIP(filtro === f.id)}>
                    {f.rotulo}
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{contagens[f.id]}</span>
                  </button>
                ))}
              </div>
              {(cortado || mensagensCortadas) && (
                <div data-quazar-cortado style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8, lineHeight: 1.4 }}>
                  {cortado
                    ? `Mostrando as conversas das ${TETO_DAS_MENSAGENS_DO_QUAZAR} mensagens mais recentes do ${NOME_DO_ASSISTENTE} — pode haver outras, mais antigas.`
                    : "Algumas conversas são longas, e só as mensagens mais recentes delas foram lidas: uma espera muito antiga pode aparecer menor."}
                </div>
              )}
              {visiveis.length === 0 && (
                <div data-quazar-vazio-no-filtro style={{ fontSize: 14, color: C.textSecondary, padding: "18px 4px", lineHeight: 1.5 }}>
                  Nenhuma conversa em que o cliente esperava {filtroAtual.dias === 7 ? "há 7 dias ou mais" : "há 2 dias ou mais"}.
                  {" "}Veja em “Todas”.
                </div>
              )}
              {visiveis.map(desenharLinha)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
