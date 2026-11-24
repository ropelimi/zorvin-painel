import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Volume2, Check } from "lucide-react";
import { chamarPonte } from "./ponte.js";
import { pedirAVoz, aVozFoiEscolhida } from "./copiloto.js";
import { NOME_DO_ASSISTENTE } from "./assistente.js";

// ============================================================
//  A VOZ DO QUAZAR (24/11) — a seção da aba Quazar, em Departamentos e
//  acessos.
//
//  Pedido do Rodrigo: "Crie uma voz única, que seja marcante, difícil de não
//  reconhecer, de forma natural com o jeito do nosso pato Quazar." A voz é
//  DESENHADA pela ElevenLabs a partir de uma descrição, e a ponte devolve três
//  opções, cada uma falando a mesma amostra. QUEM ESCOLHE É QUEM OUVE: a
//  régua dos sons de aviso (quem não ouve o som não o fabrica). Quem
//  administra ouve as três aqui e escolhe uma; a ponte a guarda.
//
//  QUEM FALA COM A ELEVENLABS É A PONTE (`/copiloto/voz…`), onde mora a chave.
//  Daqui não se vê a chave nem o id da voz: só se ela existe, quando foi
//  escolhida e por quem.
//
//  CADA "ESCOLHER ESTA" CRIA UMA VOZ NA BIBLIOTECA DA ELEVENLABS, e gerar
//  opções gasta créditos de lá. As duas coisas ficam ditas na tela.
// ============================================================

const ESPERA_DAS_OPCOES_MS = 130000;
const ESPERA_DE_ESCOLHER_MS = 60000;

function quandoFoi(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A frase de quando a ponte recusa: a de antes desta tela (404) é dita como
 *  tal, e o resto com a frase dela. */
function fraseDaFalha(e, oQue) {
  if (e && e.status === 404) {
    return `A ponte no ar ainda não tem a voz do ${NOME_DO_ASSISTENTE}. Ela entra quando a ponte nova for publicada (confira em “Atualizações do banco”).`;
  }
  return String((e && e.message) || e || `Não consegui ${oQue}.`);
}

export function VozDoQuazar({ cx, C }) {
  // null = lendo; { erro } = falhou; o corpo de `GET /copiloto/voz` = lido.
  const [lido, setLido] = useState(null);
  const [descricao, setDescricao] = useState("");
  const [opcoes, setOpcoes] = useState(null);       // null | [{ id, audio, tipo, segundos }]
  const [ocupado, setOcupado] = useState("");       // "" | "gerando" | id da opção sendo escolhida
  const [recado, setRecado] = useState(null);       // { tipo: "ok" | "erro", frase }
  const [ouvindo, setOuvindo] = useState("");       // "" | "preparando" | "tocando"
  const audioRef = useRef(null);
  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
      if (audioRef.current) { try { audioRef.current.pause(); } catch (_) { /* já parou */ } }
    };
  }, []);

  const ler = useCallback(async () => {
    try {
      const r = await chamarPonte("/copiloto/voz");
      if (!vivoRef.current) return;
      setLido(r);
      setDescricao((atual) => atual || (r.escolhida && r.escolhida.descricao) || r.descricao_padrao || "");
    } catch (e) {
      if (vivoRef.current) setLido({ erro: fraseDaFalha(e, `ler a voz do ${NOME_DO_ASSISTENTE}`) });
    }
  }, []);
  useEffect(() => { ler(); }, [ler]);

  const desc = descricao.replace(/\s+/g, " ").trim();
  const descricaoServe = desc.length >= 20 && desc.length <= 1000;

  async function gerar() {
    if (ocupado || !descricaoServe) return;
    setOcupado("gerando"); setRecado(null); setOpcoes(null);
    try {
      const r = await chamarPonte("/copiloto/voz/opcoes", {
        method: "POST", body: JSON.stringify({ descricao: desc }), espera: ESPERA_DAS_OPCOES_MS,
      });
      if (!vivoRef.current) return;
      const lista = Array.isArray(r && r.opcoes) ? r.opcoes.filter((o) => o && o.id && o.audio) : [];
      if (!lista.length) setRecado({ tipo: "erro", frase: "A ElevenLabs não devolveu nenhuma opção. Tente de novo, ou mude a descrição." });
      setOpcoes(lista);
    } catch (e) {
      if (vivoRef.current) setRecado({ tipo: "erro", frase: fraseDaFalha(e, "gerar as opções") });
    } finally {
      if (vivoRef.current) setOcupado("");
    }
  }

  async function escolher(opcao) {
    if (ocupado) return;
    setOcupado(opcao.id); setRecado(null);
    try {
      const r = await chamarPonte("/copiloto/voz/escolher", {
        method: "POST", body: JSON.stringify({ id: opcao.id, descricao: desc }), espera: ESPERA_DE_ESCOLHER_MS,
      });
      if (!vivoRef.current) return;
      setLido((atual) => ({ ...(atual || {}), escolhida: r.escolhida || null }));
      setOpcoes(null);
      setRecado({ tipo: "ok", frase: `Pronto: esta é a voz do ${NOME_DO_ASSISTENTE}. O botão “Ouvir” já aparece no resumo da conversa.` });
      aVozFoiEscolhida();
    } catch (e) {
      if (vivoRef.current) setRecado({ tipo: "erro", frase: fraseDaFalha(e, "guardar a voz") });
    } finally {
      if (vivoRef.current) setOcupado("");
    }
  }

  // OUVIR A ESCOLHIDA: a mesma amostra, pela voz guardada — o que a equipe vai
  // ouvir no resumo.
  async function ouvirAEscolhida() {
    if (ouvindo === "tocando") {
      if (audioRef.current) { try { audioRef.current.pause(); } catch (_) { /* já parou */ } }
      audioRef.current = null; setOuvindo(""); return;
    }
    if (ouvindo || !lido || !lido.amostra) return;
    setOuvindo("preparando"); setRecado(null);
    try {
      const arquivo = await pedirAVoz(lido.amostra);
      if (!vivoRef.current) return;
      const audio = new Audio(URL.createObjectURL(arquivo));
      audioRef.current = audio;
      audio.onended = () => { if (audioRef.current === audio) { audioRef.current = null; setOuvindo(""); } };
      await audio.play();
      if (vivoRef.current && audioRef.current === audio) setOuvindo("tocando");
    } catch (e) {
      if (!vivoRef.current) return;
      setOuvindo("");
      setRecado({ tipo: "erro", frase: fraseDaFalha(e, "tocar a voz") });
    }
  }

  return (
    <div style={cx.secao} data-voz-do-quazar={!lido ? "lendo" : lido.erro ? "erro" : lido.escolhida ? "escolhida" : "sem-voz"}>
      <div style={cx.titulo}><Volume2 size={17} color={C.green} /> A voz do {NOME_DO_ASSISTENTE}</div>
      <div style={cx.dica}>
        No resumo da conversa (o ícone de pergaminho), o botão <b>Ouvir</b> faz o {NOME_DO_ASSISTENTE} ler o
        resumo em voz alta. A voz é criada pela ElevenLabs a partir da descrição abaixo: gere três opções,
        ouça cada uma e escolha a que tem o jeito dele. Os números de CPF, telefone, e-mail e processo não
        são lidos: a voz diz “dado na tela”.
      </div>

      {lido === null && (
        <div style={{ ...cx.dica, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="zv-girando" /> Perguntando à ponte pela voz…
        </div>
      )}
      {lido && lido.erro && (
        <div data-voz-erro style={{ fontSize: 13, color: C.erroTexto, lineHeight: 1.5 }}>
          {lido.erro}{" "}
          <button style={cx.botaoFraco} onClick={() => { setLido(null); ler(); }}>Tentar de novo</button>
        </div>
      )}

      {lido && !lido.erro && (<>
        {!lido.ligada && (
          <div data-voz-sem-chave style={{ ...cx.dica, color: C.erroTexto, fontWeight: 600 }}>
            Ainda não está ligada: falta a variável ELEVENLABS_API_KEY na Render (serviço da ponte). Enquanto
            ela não existir, o botão “Ouvir” não aparece para a equipe.
          </div>
        )}
        {lido.sem_tabela && (
          <div data-voz-sem-tabela style={{ ...cx.dica, color: C.ambarTexto, fontWeight: 600 }}>
            Falta a atualização 062 do banco, que guarda a voz escolhida. Ela entra sozinha quando a ponte é
            publicada: confira em “Atualizações do banco”.
          </div>
        )}
        <div data-voz-escolhida={lido.escolhida ? "sim" : "nao"}
             style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, fontSize: 13 }}>
          {lido.escolhida ? (<>
            <span style={{ color: C.verdeTexto, fontWeight: 600 }}>
              <Check size={14} style={{ verticalAlign: -2 }} /> Voz escolhida
              {lido.escolhida.escolhida_em ? ` em ${quandoFoi(lido.escolhida.escolhida_em)}` : ""}
              {lido.escolhida.escolhida_por ? `, por ${lido.escolhida.escolhida_por}` : ""}.
            </span>
            {lido.ligada && (
              <button data-voz-ouvir-escolhida={ouvindo || "parado"} style={cx.botaoFraco}
                      disabled={ouvindo === "preparando"} onClick={ouvirAEscolhida}>
                {ouvindo === "preparando" ? "Preparando…" : ouvindo === "tocando" ? "Parar" : "Ouvir a voz escolhida"}
              </button>
            )}
          </>) : (
            <span style={{ color: C.textSecondary }}>
              Nenhuma voz escolhida ainda: até lá, o botão “Ouvir” não aparece no resumo.
            </span>
          )}
        </div>

        {lido.ligada && !lido.sem_tabela && (<>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }} htmlFor="voz-descricao">
            Como é a voz (em inglês, que é a língua em que a ElevenLabs desenha melhor)
          </label>
          <textarea id="voz-descricao" data-voz-descricao value={descricao} rows={6}
                    onChange={(e) => { setDescricao(e.target.value); setRecado(null); }}
                    style={{ ...cx.campo, width: "100%", boxSizing: "border-box", resize: "vertical",
                             fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button data-voz-gerar style={{ ...cx.botao, opacity: descricaoServe && !ocupado ? 1 : 0.5 }}
                    disabled={!descricaoServe || Boolean(ocupado)} onClick={gerar}>
              {ocupado === "gerando" ? <Loader2 size={14} className="zv-girando" /> : <Volume2 size={14} />}
              {ocupado === "gerando" ? "Gerando as opções… (até um minuto)" : "Gerar 3 opções"}
            </button>
            <span data-voz-conta style={{ fontSize: 12, color: descricaoServe ? C.textSecondary : C.erroTexto }}>
              {desc.length.toLocaleString("pt-BR")}/1.000 caracteres{desc.length < 20 ? " — escreva pelo menos 20" : ""}
            </span>
            {lido.descricao_padrao && descricao !== lido.descricao_padrao && (
              <button data-voz-descricao-de-partida style={cx.botaoFraco}
                      onClick={() => { setDescricao(lido.descricao_padrao); setRecado(null); }}>
                Voltar à descrição de partida
              </button>
            )}
          </div>
          <div style={{ ...cx.dica, marginTop: 8, marginBottom: 0 }}>
            Gerar as opções gasta créditos da ElevenLabs, e cada “Escolher esta” cria uma voz na biblioteca de
            lá (as velhas podem ser apagadas por lá).
          </div>
        </>)}

        {opcoes && opcoes.length > 0 && (
          <div data-voz-opcoes style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {lido.amostra && (
              <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>
                As três falam: <i>“{lido.amostra}”</i>
              </div>
            )}
            {opcoes.map((o, i) => (
              <div key={o.id} data-voz-opcao={o.id}
                   style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                            border: `1px solid ${C.divider}`, borderRadius: 10, padding: "8px 10px" }}>
                <b style={{ fontSize: 13, minWidth: 70 }}>Opção {i + 1}</b>
                <audio controls preload="none" src={`data:${o.tipo || "audio/mpeg"};base64,${o.audio}`}
                       style={{ flex: "1 1 220px", minWidth: 0, height: 36 }} />
                <button data-voz-escolher={o.id} style={{ ...cx.botao, opacity: ocupado ? 0.5 : 1 }}
                        disabled={Boolean(ocupado)} onClick={() => escolher(o)}>
                  {ocupado === o.id ? <Loader2 size={14} className="zv-girando" /> : <Check size={14} />}
                  {ocupado === o.id ? "Guardando…" : "Escolher esta"}
                </button>
              </div>
            ))}
          </div>
        )}
      </>)}

      {recado && (
        <div data-voz-recado={recado.tipo}
             style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: recado.tipo === "ok" ? C.verdeTexto : C.erroTexto }}>
          {recado.frase}
        </div>
      )}
    </div>
  );
}

export default VozDoQuazar;
