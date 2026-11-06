// ============================================================
//  O ENSAIO DO QUAZAR À NOITE (script 055 da ponte, 06/11)
//
//  Pedido do Rodrigo: o Quazar responde à noite quem escreve com o
//  escritório fechado. Decidido com ele, começa por um ENSAIO: o cliente
//  continua recebendo a mensagem pronta, e o Quazar escreve a resposta que
//  daria, SEM ENVIAR. De manhã a equipe lê na conversa e marca se ele acertou.
//
//  A BOLHA NÃO PARECE MENSAGEM QUE SAIU: fica no meio, tracejada, com o rosto
//  do Quazar e a frase "não foi enviada ao cliente". Uma bolha verde à
//  direita seria lida como algo que o cliente recebeu.
//
//  AVALIAR GRAVA SÓ A AVALIAÇÃO E O COMENTÁRIO (as colunas que o 055 deixa a
//  tela mudar); quem avaliou e quando são do gatilho. A recusa calada (zero
//  linhas) é dita, e o botão volta como estava.
// ============================================================
import React, { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { NOME_DO_ASSISTENTE } from "./assistente.js";
import { RostoDoAssistente } from "./RostoDoAssistente.jsx";

/** A linha de `zorvin_quazar_noturno` vira um item da linha do tempo. A hora
 *  é a de quando a resposta ficou pronta (quando ela sairia). */
export function bolhaDoEnsaio(r, convId) {
  return {
    id: "ensaio-" + r.id,
    conversa_id: convId,
    origem: "ensaio",
    tipo: "texto",
    texto: r.texto || "",
    criado_em: r.pronta_em || r.criada_em,
    _ensaioId: r.id,
    _status: r.status,
    _resumo: r.resumo || "",
    _motivo: r.motivo || "",
    _avaliacao: r.avaliacao || null,
    _comentario: r.comentario || "",
  };
}

const horaCurta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export function BolhaDoEnsaio({ m, C, estreito }) {
  const [avaliacao, setAvaliacao] = useState(m._avaliacao);
  const [comentario, setComentario] = useState(m._comentario);
  const [escrevendo, setEscrevendo] = useState(false);
  const [rascunho, setRascunho] = useState(m._comentario);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const calada = m._status === "calada";

  async function gravar(nova, texto) {
    setGravando(true); setErro("");
    const r = await supabase.from("zorvin_quazar_noturno")
      .update({ avaliacao: nova, comentario: (texto || "").trim().slice(0, 500) || null })
      .eq("id", m._ensaioId).select("id, avaliacao, comentario");
    setGravando(false);
    if (r.error) { setErro(comOCodigo("Não consegui guardar a avaliação.", r.error, "avaliar o ensaio")); return false; }
    if (naoGravouNada(r)) { setErro("O banco não deixou guardar a avaliação."); return false; }
    const linha = (r.data || [])[0] || {};
    setAvaliacao(linha.avaliacao || null);
    setComentario(linha.comentario || "");
    return true;
  }

  async function clicar(nova) {
    if (gravando) return;
    if (avaliacao === nova) {          // o mesmo botão de novo desfaz
      if (await gravar(null, "")) { setEscrevendo(false); setRascunho(""); }
      return;
    }
    if (await gravar(nova, nova === "ruim" ? comentario : "")) {
      // "RUIM" PERGUNTA O QUE ESTAVA ERRADO, sem obrigar: é o que mais ensina.
      setEscrevendo(nova === "ruim");
      if (nova !== "ruim") setRascunho("");
    }
  }

  const botao = (qual, Icone, rotulo) => {
    const ativo = avaliacao === qual;
    const cor = qual === "boa" ? C.verdeTexto : C.erroTexto;
    return (
      <button type="button" data-avaliar-ensaio={qual} aria-pressed={ativo} disabled={gravando}
              onClick={() => clicar(qual)} title={ativo ? "Clique de novo para desfazer" : rotulo}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 14,
                       fontSize: 12.5, fontWeight: 600, cursor: gravando ? "default" : "pointer",
                       border: `1px solid ${ativo ? cor : C.divider}`, background: ativo ? C.panel : "transparent",
                       color: ativo ? cor : C.textSecondary }}>
        <Icone size={13} /> {rotulo}
      </button>
    );
  };

  return (
    <div data-msg-id={m.id} data-ensaio-do-quazar={m._status} data-ensaio-avaliacao={avaliacao || ""}
         style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
      <div style={{ width: estreito ? "92%" : "min(78%, 560px)", boxSizing: "border-box", background: C.panel,
                    color: C.textPrimary, borderRadius: 10, padding: "8px 11px 9px", border: `1.5px dashed ${C.divider}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600,
                      color: C.textSecondary, marginBottom: 5 }}>
          <RostoDoAssistente tamanho={20} />
          <span style={{ minWidth: 0 }}>
            Ensaio do {NOME_DO_ASSISTENTE} à noite · <span data-ensaio-nao-enviada>não foi enviada ao cliente</span>
          </span>
          <span style={{ marginLeft: "auto", flexShrink: 0, fontWeight: 400 }}>{horaCurta(m.criado_em)}</span>
        </div>
        {calada ? (
          <div data-ensaio-calado style={{ fontSize: 13.5, lineHeight: 1.45, color: C.textSecondary }}>
            O {NOME_DO_ASSISTENTE} não responderia{m._motivo ? `: ${String(m._motivo).replace(/[.\s]+$/, "")}.` : "."}
          </div>
        ) : (
          <div data-ensaio-texto style={{ fontSize: 14.2, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {m.texto}
          </div>
        )}
        {m._resumo && (
          <div data-ensaio-resumo style={{ fontSize: 12.5, lineHeight: 1.4, color: C.textSecondary, marginTop: 6 }}>
            <b>Para a equipe:</b> {m._resumo}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: C.textSecondary, marginRight: 2 }}>
            {calada ? "Ficar calado foi certo?" : "Ele acertou?"}
          </span>
          {botao("boa", ThumbsUp, "Boa")}
          {botao("ruim", ThumbsDown, "Ruim")}
        </div>
        {avaliacao === "ruim" && (escrevendo ? (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <input data-ensaio-comentario value={rascunho} maxLength={500} autoFocus
                   onChange={(e) => setRascunho(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); gravar("ruim", rascunho).then((ok) => ok && setEscrevendo(false)); } }}
                   placeholder="O que estava errado? (opcional)"
                   style={{ flex: "1 1 200px", minWidth: 0, fontSize: 16, padding: "6px 9px", borderRadius: 8,
                            border: `1px solid ${C.divider}`, background: C.inputBg || C.panel, color: C.textPrimary }} />
            <button type="button" data-ensaio-comentario-salvar disabled={gravando}
                    onClick={() => gravar("ruim", rascunho).then((ok) => ok && setEscrevendo(false))}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.botao, color: "#fff",
                             fontSize: 13, fontWeight: 600, cursor: gravando ? "default" : "pointer" }}>
              Guardar
            </button>
          </div>
        ) : comentario ? (
          <div data-ensaio-comentario-guardado style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 6, lineHeight: 1.4 }}>
            O que estava errado: {comentario}{" "}
            <button type="button" onClick={() => { setRascunho(comentario); setEscrevendo(true); }}
                    style={{ border: "none", background: "none", padding: 0, color: C.verdeTexto, fontSize: 12.5, cursor: "pointer" }}>
              mudar
            </button>
          </div>
        ) : null)}
        {erro && <div data-ensaio-erro style={{ fontSize: 12, color: C.erroTexto, marginTop: 6 }}>{erro}</div>}
      </div>
    </div>
  );
}

// ============================================================
//  A SEÇÃO DA ABA "FORA DO HORÁRIO": o modo do departamento e as últimas
//  respostas do ensaio, para quem administra ler todas de uma vez sem abrir
//  conversa por conversa.
//
//  O MODO SE GRAVA SOZINHO, sem o "Salvar" da resposta: são duas decisões, e
//  misturar faria o "Ainda não salvo" de uma segurar a outra. A recusa calada
//  é dita.
//
//  SÓ COM A COLUNA DO 055 (alguma linha do departamento traz `quazar`): sem
//  ela, a seção não aparece. Sem a linha do departamento, ela pede para
//  salvar a resposta primeiro — não há onde gravar o modo.
// ============================================================
const MODOS = [
  { valor: "desligado", rotulo: "Desligado" },
  { valor: "ensaio", rotulo: "Ensaio: ele escreve a resposta, mas ela não vai para o cliente" },
];

export function QuazarANoite({ cx, C, depId, linha, temColuna, aoMudar, aoAvisar }) {
  const [gravando, setGravando] = useState(false);
  const [lista, setLista] = useState(null);       // null = lendo
  const [falha, setFalha] = useState("");
  const [telefonesDoDep, setTelefonesDoDep] = useState(null);

  const modo = linha && linha.quazar ? linha.quazar : "desligado";

  React.useEffect(() => {
    if (!temColuna || depId == null) return undefined;
    let vivo = true;
    (async () => {
      setLista(null); setFalha("");
      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      // TRÊS PERGUNTAS SIMPLES, e não uma com tabelas embutidas: os telefones
      // do departamento, as respostas da semana, e as conversas e os contatos
      // delas. A regra de acesso de `conversas` vale em cada uma.
      const [tels, ens] = await Promise.all([
        supabase.from("advogados").select("id, departamento_id").eq("departamento_id", depId),
        supabase.from("zorvin_quazar_noturno")
          .select("id, conversa_id, texto, resumo, motivo, status, avaliacao, comentario, pronta_em, criada_em")
          .in("status", ["pronta", "calada"]).gte("criada_em", desde)
          .order("criada_em", { ascending: false }).limit(200),
      ]);
      if (!vivo) return;
      if (tels.error || ens.error) {
        if (ens.error && semATabela(ens.error)) { setLista([]); return; }
        setFalha(comOCodigo(`Não consegui ler as respostas do ensaio do ${NOME_DO_ASSISTENTE}.`, tels.error || ens.error, "ler o ensaio"));
        return;
      }
      const ids = new Set((tels.data || []).map((t) => String(t.id)));
      setTelefonesDoDep(ids);
      const idsDasConversas = [...new Set((ens.data || []).map((e) => e.conversa_id))];
      let conversas = [], contatos = [];
      if (idsDasConversas.length) {
        const cv = await supabase.from("conversas").select("id, advogado_id, contato_id").in("id", idsDasConversas);
        if (!vivo) return;
        if (cv.error) { setFalha(comOCodigo(`Não consegui ler as conversas do ensaio do ${NOME_DO_ASSISTENTE}.`, cv.error, "ler o ensaio")); return; }
        conversas = cv.data || [];
        const idsDosContatos = [...new Set(conversas.map((c) => c.contato_id).filter(Boolean))];
        if (idsDosContatos.length) {
          const ct = await supabase.from("contatos").select("id, nome, numero").in("id", idsDosContatos);
          if (!vivo) return;
          contatos = ct.data || [];      // sem o nome, a linha diz "Cliente"
        }
      }
      const conversaDe = new Map(conversas.map((c) => [String(c.id), c]));
      const contatoDe = new Map(contatos.map((c) => [String(c.id), c]));
      setLista((ens.data || []).map((e) => {
        const c = conversaDe.get(String(e.conversa_id));
        return c ? { ...e, conversa: { ...c, contato: contatoDe.get(String(c.contato_id)) || null } } : null;
      }).filter((e) => e && ids.has(String(e.conversa.advogado_id))));
    })();
    return () => { vivo = false; };
  }, [temColuna, depId]);

  if (!temColuna) return null;

  async function mudarModo(valor) {
    if (!linha || valor === modo) return;
    setGravando(true); aoAvisar("");
    const r = await supabase.from("zorvin_fora_do_horario").update({ quazar: valor })
      .eq("departamento_id", depId).select("departamento_id, quazar");
    setGravando(false);
    if (r.error) { aoAvisar(comOCodigo(`Não consegui mudar o ${NOME_DO_ASSISTENTE} à noite.`, r.error, "mudar o modo")); return; }
    if (naoGravouNada(r)) { aoAvisar(`Não mudou: o banco não deixou. Só quem administra o Zorvin muda o ${NOME_DO_ASSISTENTE} à noite.`); return; }
    aoMudar();
  }

  const contas = (lista || []).reduce((a, e) => {
    a.total += 1;
    if (e.avaliacao === "boa") a.boas += 1; else if (e.avaliacao === "ruim") a.ruins += 1; else a.sem += 1;
    if (e.status === "calada") a.caladas += 1;
    return a;
  }, { total: 0, boas: 0, ruins: 0, sem: 0, caladas: 0 });

  return (
    <div style={cx.secao} data-quazar-a-noite={modo}>
      <div style={cx.titulo}><RostoDoAssistente tamanho={20} /> O {NOME_DO_ASSISTENTE} à noite</div>
      <div style={cx.dica}>
        Com o escritório fechado, o {NOME_DO_ASSISTENTE} responde o cliente no lugar da mensagem pronta, dizendo
        que é o assistente virtual do escritório e quando a equipe volta. Ele não diz o andamento do processo,
        não promete prazo nem valor e não pede senha. Quando alguém da equipe responde, ele sai da conversa.
        <br />
        <b>No ensaio, nada vai para o cliente:</b> a mensagem pronta continua saindo, e a resposta que o{" "}
        {NOME_DO_ASSISTENTE} daria aparece na conversa, tracejada, para a equipe marcar se ele acertou.
      </div>
      {!linha ? (
        <div data-quazar-sem-linha style={{ fontSize: 13, color: C.textSecondary }}>
          Salve a resposta fora do horário deste departamento primeiro: o {NOME_DO_ASSISTENTE} usa o mesmo horário.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {MODOS.map((m) => (
            <label key={m.valor} data-quazar-modo={m.valor}
                   style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: gravando ? "default" : "pointer" }}>
              <input type="radio" name={`quazar-${depId}`} checked={modo === m.valor} disabled={gravando}
                     onChange={() => mudarModo(m.valor)} />
              {m.rotulo}
            </label>
          ))}
        </div>
      )}
      {falha && <div data-quazar-ensaio-falhou style={{ fontSize: 13, color: C.erroTexto, marginTop: 6 }}>{falha}</div>}
      {!falha && lista === null && telefonesDoDep === null && (
        <div style={{ fontSize: 13, color: C.textSecondary }}>Lendo as respostas do ensaio…</div>
      )}
      {!falha && lista && (
        <>
          <div data-quazar-ensaio-contas style={{ fontSize: 13, color: C.textPrimary, margin: "6px 0" }}>
            {contas.total === 0
              ? "Nenhuma resposta de ensaio nos últimos 7 dias neste departamento."
              : `Nos últimos 7 dias: ${contas.total} ${contas.total === 1 ? "resposta" : "respostas"} de ensaio`
                + `${contas.caladas ? ` (${contas.caladas} em que ele ficaria calado)` : ""} — `
                + `${contas.boas} ${contas.boas === 1 ? "boa" : "boas"}, ${contas.ruins} ${contas.ruins === 1 ? "ruim" : "ruins"}, `
                + `${contas.sem} sem avaliação.`}
          </div>
          {lista.slice(0, 30).map((e) => {
            const ct = (e.conversa && e.conversa.contato) || {};
            const quando = new Date(e.pronta_em || e.criada_em);
            const href = `?conversa=${encodeURIComponent(e.conversa_id)}&linha=${encodeURIComponent((e.conversa && e.conversa.advogado_id) || "")}`;
            return (
              <div key={e.id} data-quazar-ensaio-linha={e.id} data-ensaio-avaliacao={e.avaliacao || ""} style={cx.linha}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {ct.nome || ct.numero || "Cliente"}
                    <span style={{ fontWeight: 400, color: C.textSecondary }}>
                      {" "}· {Number.isNaN(quando.getTime()) ? "" : quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {e.avaliacao === "boa" ? " · marcada boa" : e.avaliacao === "ruim" ? " · marcada ruim" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4, overflow: "hidden",
                                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>
                    {e.status === "calada" ? `Ficaria calado${e.motivo ? `: ${e.motivo}` : "."}` : e.texto}
                  </div>
                  {e.comentario && (
                    <div style={{ fontSize: 12.5, color: C.erroTexto, marginTop: 2 }}>O que estava errado: {e.comentario}</div>
                  )}
                </div>
                <a href={href} target="_blank" rel="noopener noreferrer" data-abre-guia data-quazar-ensaio-abrir
                   style={{ ...cx.botaoFraco, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Abrir a conversa
                </a>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

