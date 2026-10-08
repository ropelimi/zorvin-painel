import React, { useState, useEffect, useCallback } from "react";
import { perguntarOsScripts, comoDizerASituacao, valorPreocupa, numeroDe } from "./scriptsDoBanco.js";
import { Database, Loader2, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

// ============================================================
//  A ABA "ATUALIZAÇÕES DO BANCO" — o que a ponte fez ao subir
//
//  Até 08/10 cada mudança de banco era um bloco de SQL que o Rodrigo colava na
//  Supabase, e a última linha dele respondia "deu certo?". Agora a ponte aplica
//  sozinha, e é aqui que se lê o que aconteceu: a situação da última subida, o
//  que entrou nela, o que ficou esperando, e a CONFERÊNCIA de cada script —
//  aquela mesma última linha, que a ponte guarda.
//
//  UMA ABA PRÓPRIA, e não uma seção no fim de "Departamentos e telefones": a
//  faixa vermelha manda a pessoa para cá quando algo falha, e "a seção lá
//  embaixo da terceira lista" é um caminho que ninguém acha com pressa.
//
//  OS COLADOS À MÃO FICAM RECOLHIDOS. São vinte linhas sem conferência nenhuma
//  (a ponte só anotou que eles já estavam lá), e abertas elas empurrariam para
//  fora da vista o script que entrou hoje — que é o que se veio olhar.
// ============================================================

const TONS = { bom: "#2e9e6b", atencao: "#d99a1e", ruim: "#e5573f" };

// "08/10 às 14:32", no relógio de quem lê. A ponte manda a hora em ISO de
// propósito: escrita lá, sairia no fuso da Render.
function quandoLegivel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

// Uma linha da conferência. A forma de quase todas é (o que, resposta) — e
// essa se lê como "o que: resposta". As outras vão como "coluna = valor".
function linhaDaConferencia(linha, i, C) {
  const pares = Object.entries(linha || {});
  const pintar = (v) => (
    <span data-valor-preocupa={valorPreocupa(v) ? "sim" : undefined}
          style={valorPreocupa(v) ? { color: TONS.ruim, fontWeight: 700 } : undefined}>
      {v === null ? "—" : String(v)}
    </span>
  );
  if (pares.length === 2) {
    return (
      <div key={i} data-linha-da-conferencia style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        <span style={{ color: C.textSecondary }}>{String(pares[0][1])}:</span> {pintar(pares[1][1])}
      </div>
    );
  }
  return (
    <div key={i} data-linha-da-conferencia style={{ fontSize: 12.5, lineHeight: 1.5 }}>
      {pares.map(([k, v], j) => (
        <span key={k}>{j > 0 && " · "}<span style={{ color: C.textSecondary }}>{k} =</span> {pintar(v)}</span>
      ))}
    </div>
  );
}

// Um script que a PONTE rodou (ou tentou). Função que desenha, e não
// componente declarado dentro da aba: componente declarado ali dentro é um
// tipo novo a cada desenho, e o React trocaria o pedaço inteiro a cada clique.
function scriptDaPonte(a, C, nestaSubida) {
  const entrouAgora = nestaSubida.has(a.nome);
  return (
    <div key={a.nome} data-script-aplicado={a.nome} data-origem={a.origem}
         data-conferencia-preocupa={a.alerta ? "sim" : undefined}
         style={{ borderTop: `1px solid ${C.divider}`, padding: "9px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13, fontFamily: "monospace" }}>{a.nome}</b>
        {a.sucesso === false ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: TONS.ruim }}>falhou</span>
        ) : (
          <span style={{ fontSize: 12, color: C.textSecondary }}>
            aplicado pela ponte {quandoLegivel(a.aplicado_em)}
            {typeof a.tempo_ms === "number" ? ` (${a.tempo_ms} ms)` : ""}
          </span>
        )}
        {entrouAgora && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: TONS.bom,
                         borderRadius: 10, padding: "1px 8px" }}>nesta subida</span>
        )}
      </div>
      {a.sucesso === false && a.erro && (
        <div style={{ fontSize: 12, color: C.textSecondary, fontFamily: "monospace", marginTop: 4,
                      wordBreak: "break-word" }}>{a.erro}</div>
      )}
      {a.alerta && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: TONS.ruim,
                      fontWeight: 600, marginTop: 4 }}>
          <AlertTriangle size={14} /> A conferência deste script diz que algo não ficou como devia.
        </div>
      )}
      {Array.isArray(a.conferencia) && a.conferencia.length > 0 && (
        <div data-conferencia-do-script style={{ marginTop: 5, paddingLeft: 10,
                                                  borderLeft: `2px solid ${C.divider}` }}>
          {a.conferencia.map((linha, i) => linhaDaConferencia(linha, i, C))}
        </div>
      )}
    </div>
  );
}

export function AtualizacoesDoBanco({ cx, C, aoSaber }) {
  const [resposta, setResposta] = useState(null);   // null = perguntando pela primeira vez
  const [perguntando, setPerguntando] = useState(false);
  const [verAMao, setVerAMao] = useState(false);

  const perguntar = useCallback(async () => {
    setPerguntando(true);
    const r = await perguntarOsScripts();
    setResposta(r);
    setPerguntando(false);
    // A FAIXA ACOMPANHA O QUE A PESSOA ACABOU DE LER. Sem isto, quem pergunta
    // de novo aqui e lê "em dia" continuaria vendo a faixa vermelha da
    // pergunta de quinze minutos atrás — a mesma tela dizendo duas coisas.
    if (r.estado && aoSaber) aoSaber(r.estado);
  }, [aoSaber]);

  useEffect(() => { perguntar(); }, [perguntar]);

  const estado = resposta && resposta.estado;
  const aplicados = (estado && estado.aplicados) || [];
  const daPonte = aplicados.filter((a) => a.origem !== "a_mao")
    .sort((a, b) => String(b.aplicado_em || "").localeCompare(String(a.aplicado_em || ""))
                 || String(b.nome).localeCompare(String(a.nome)));
  const aMao = aplicados.filter((a) => a.origem === "a_mao");
  const nestaSubida = new Set((estado && estado.nesta_subida) || []);
  const jeito = estado ? comoDizerASituacao(estado.situacao) : null;
  const tom = jeito ? TONS[jeito.tom] : null;

  return (
    <div style={cx.secao} data-atualizacoes-do-banco>
      <div style={cx.titulo}><Database size={16} /> Atualizações do banco</div>
      <div style={cx.dica}>
        Quando uma versão nova do Zorvin traz mudança no banco de dados, a ponte a aplica
        sozinha ao subir — antes, cada uma era colada à mão na Supabase. Aqui fica o que
        aconteceu da última vez que ela subiu.
      </div>

      {resposta === null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.textSecondary }}>
          <Loader2 size={15} className="zv-girando" /> Perguntando à ponte…
        </div>
      )}

      {resposta && resposta.erro && (
        <div data-falha-dos-scripts
             style={{ borderLeft: `4px solid ${TONS.atencao}`, background: C.panel, padding: "9px 12px",
                      borderRadius: 8, fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
          {resposta.semARota
            ? "A ponte que está no ar ainda não sabe responder isto — ela é de antes desta tela. "
              + "Depois da próxima publicação dela, a resposta aparece aqui."
            : `Não consegui perguntar à ponte: ${resposta.erro} Isto não quer dizer que algo deu errado no banco — só que a pergunta não chegou.`}
        </div>
      )}

      {estado && (
        <>
          <div data-situacao-dos-scripts={estado.situacao}
               style={{ borderLeft: `4px solid ${tom || C.divider}`, background: C.panel, padding: "10px 12px",
                        borderRadius: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14, color: tom || C.textPrimary }}>{jeito.rotulo}</b>
              {estado.quando && (
                <span style={{ fontSize: 12, color: C.textSecondary }}>· conferido {quandoLegivel(estado.quando)}</span>
              )}
              {estado.ligado && estado.modo === "conferir" && (
                <span style={{ fontSize: 12, color: C.textSecondary }}>· modo conferir (não aplica)</span>
              )}
            </div>
            {estado.mensagem && (
              <div data-mensagem-dos-scripts style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                {estado.mensagem}
              </div>
            )}
            {estado.detalhe && (
              <div data-detalhe-dos-scripts
                   style={{ fontSize: 12, color: C.textSecondary, fontFamily: "monospace", marginTop: 5,
                            wordBreak: "break-word" }}>
                {estado.detalhe}
              </div>
            )}
            {estado.proxima_tentativa && (
              <div data-proxima-tentativa style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 5 }}>
                Próxima tentativa sozinha: {quandoLegivel(estado.proxima_tentativa)}.
              </div>
            )}
          </div>

          {(estado.pendentes || []).length > 0 && (
            <div data-scripts-pendentes style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
              <b>Esperando:</b>{" "}
              <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{estado.pendentes.join(", ")}</span>
            </div>
          )}

          {daPonte.map((a) => scriptDaPonte(a, C, nestaSubida))}

          {aMao.length > 0 && (
            <div data-colados-a-mao style={{ borderTop: `1px solid ${C.divider}`, padding: "9px 0" }}>
              <button onClick={() => setVerAMao((v) => !v)} data-ver-colados-a-mao
                      style={{ ...cx.botaoFraco, display: "inline-flex", alignItems: "center", gap: 5,
                               border: "none", padding: "2px 0" }}>
                {verAMao ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {aMao.length === 1 ? "1 script colado à mão" : `${aMao.length} scripts colados à mão`}
                {" "}antes de a ponte aplicar sozinha ({numeroDe(aMao[0].nome)} a {numeroDe(aMao[aMao.length - 1].nome)})
              </button>
              {verAMao && (
                <div style={{ marginTop: 6, fontSize: 12.5, fontFamily: "monospace", lineHeight: 1.6,
                              color: C.textSecondary }}>
                  {aMao.map((a) => <div key={a.nome} data-script-aplicado={a.nome} data-origem="a_mao">{a.nome}</div>)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {resposta !== null && (
        <div style={{ marginTop: 8 }}>
          <button style={cx.botaoFraco} onClick={perguntar} disabled={perguntando} data-perguntar-de-novo>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {perguntando ? <Loader2 size={13} className="zv-girando" /> : <RefreshCw size={13} />}
              Perguntar de novo
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
