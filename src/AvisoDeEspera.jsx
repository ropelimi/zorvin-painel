import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { Chave } from "./Chave.jsx";
import { DIAS } from "./foraDoHorario.js";
import { Hourglass, RefreshCw } from "lucide-react";

// ============================================================
//  O AVISO DE CLIENTE SEM RESPOSTA — a aba "Aviso de espera" em
//  "Departamentos e acessos" (31/10). Ver o script 041 da ponte e "Quem está
//  esperando demais" no CLAUDE.md.
//
//  Por departamento: o aviso ligado ou não, e depois de quantos minutos de
//  EXPEDIENTE sem resposta ele toca. O expediente é o da aba Fora do horário
//  — a mesma semana que decide a resposta automática —, e esta tela só o
//  mostra, para quem administra saber o que "30 minutos" quer dizer ali.
//
//  SEM LINHA, VALE O PADRÃO (ligado, 30 minutos), e é o que a tela desenha: a
//  linha só nasce quando alguém muda alguma coisa. Desenhar "desligado" para
//  o departamento sem linha mentiria sobre um aviso que está tocando.
//
//  FALHA DE LEITURA É DITA, e nunca vira o padrão desenhado — a armadilha nº
//  2. Uma chave desenhada ligada porque a leitura falhou poderia esconder que
//  alguém desligou; e quem visse "30" poderia salvar "30" por cima dos 45 que
//  estão gravados.
//
//  GRAVAR RELÊ DO BANCO, como em Fora do horário e Distribuição: é o que mostra
//  o que ficou gravado de verdade.
// ============================================================

export const PADRAO_DO_AVISO = { ligado: true, minutos: 30 };
export const MINUTOS_MIN = 5;
export const MINUTOS_MAX = 480;
const RECUSADO = "o banco não deixou. Só quem administra o Zorvin muda o aviso de espera.";

/** "segunda a sexta, das 08:00 às 18:00; sábado, das 08:00 às 12:00". Os dias
 *  seguidos com o mesmo horário viram um trecho só. Devolve `null` sem semana
 *  (o departamento que nunca abriu a aba Fora do horário) e "" com todos os
 *  dias fechados — são frases diferentes para quem lê. */
export function resumoDoExpediente(semana) {
  if (!semana || typeof semana !== "object") return null;
  const faixa = (i) => (Array.isArray(semana[DIAS[i].chave]) ? semana[DIAS[i].chave] : null);
  const nome = (i) => DIAS[i].nome.toLowerCase();
  const partes = [];
  for (let i = 0; i < DIAS.length;) {
    const f = faixa(i);
    if (!f) { i += 1; continue; }
    let j = i;
    while (j + 1 < DIAS.length && faixa(j + 1) && faixa(j + 1)[0] === f[0] && faixa(j + 1)[1] === f[1]) j += 1;
    const dias = i === j ? nome(i) : j === i + 1 ? `${nome(i)} e ${nome(j)}` : `${nome(i)} a ${nome(j)}`;
    partes.push(`${dias}, das ${f[0]} às ${f[1]}`);
    i = j + 1;
  }
  return partes.join("; ");
}

export function minutosValidos(texto) {
  const n = Number(String(texto).trim());
  return String(texto).trim() !== "" && Number.isInteger(n) && n >= MINUTOS_MIN && n <= MINUTOS_MAX ? n : null;
}

export function AvisoDeEspera({ cx, C, departamentos = [], aoAvisar }) {
  const [existe, setExiste] = useState(null);        // null = ainda lendo
  const [linhas, setLinhas] = useState(null);        // as de zorvin_aviso_de_espera
  const [erro, setErro] = useState("");
  const [semanas, setSemanas] = useState(null);      // departamento_id → semana
  const [erroSemanas, setErroSemanas] = useState("");
  const [rascunho, setRascunho] = useState({});      // departamento_id → o que está no campo
  const [ocupado, setOcupado] = useState("");

  const ler = useCallback(async () => {
    const [r, f] = await Promise.all([
      supabase.from("zorvin_aviso_de_espera").select("*"),
      supabase.from("zorvin_fora_do_horario").select("departamento_id, semana"),
    ]);
    if (r.error) {
      // A TABELA QUE FALTA (o 041 não rodou) é o único caso em que sumir é o
      // certo; a aba nem aparece. Qualquer outra falha é dita no lugar.
      if (semATabela(r.error)) { setExiste(false); return; }
      setExiste(true);
      setErro(comOCodigo("Não consegui ler o aviso de cada departamento.", r.error, "ler o aviso de espera"));
    } else {
      setExiste(true);
      setErro("");
      setLinhas(r.data || []);
      setRascunho({});
    }
    if (f.error) {
      // SEM O 021 não há expediente escrito em lugar nenhum: o aviso conta o
      // relógio inteiro, e é isso que a frase de cada departamento diz.
      if (semATabela(f.error)) { setSemanas({}); setErroSemanas(""); }
      else setErroSemanas(comOCodigo("Não consegui ler o expediente dos departamentos.", f.error, "ler o expediente"));
    } else {
      setSemanas(Object.fromEntries((f.data || []).map((x) => [String(x.departamento_id), x.semana])));
      setErroSemanas("");
    }
  }, []);
  useEffect(() => { ler(); }, [ler]);

  const valeEm = (id) => ({
    ...PADRAO_DO_AVISO,
    ...((linhas || []).find((l) => String(l.departamento_id) === String(id)) || {}),
  });

  async function gravar(d, mudanca, oQue) {
    setOcupado(String(d.id)); aoAvisar("");
    const atual = valeEm(d.id);
    // A LINHA INTEIRA, e não só o que mudou: o departamento sem linha nasce
    // aqui, e nasceria com o padrão do banco no campo que não foi mandado —
    // o que está na tela é o que tem de ficar gravado.
    const r = await supabase.from("zorvin_aviso_de_espera")
      .upsert({ departamento_id: d.id, ligado: atual.ligado, minutos: atual.minutos, ...mudanca },
              { onConflict: "departamento_id" })
      .select("departamento_id");
    setOcupado("");
    if (r.error) aoAvisar(comOCodigo(`Não consegui ${oQue} de ${d.nome}.`, r.error, "aviso de espera"));
    else if (naoGravouNada(r)) aoAvisar(`Não gravou ${oQue === "salvar os minutos" ? "os minutos" : "o aviso"} de ${d.nome}: ${RECUSADO}`);
    await ler();
  }

  if (existe === false) return null;
  if (existe === null) return <div style={{ color: C.textSecondary, fontSize: 14 }}>Carregando…</div>;
  if (!departamentos.length) {
    return <div style={cx.dica}>Crie um departamento primeiro: o aviso é de cada um.</div>;
  }
  const aviso = { fontSize: 12.5, color: C.textPrimary, background: C.panel, border: `1px solid ${C.divider}`,
                  borderLeft: "4px solid #e5573f", borderRadius: 8, padding: "7px 10px", lineHeight: 1.45 };
  const campo = { width: 64, padding: "5px 7px", borderRadius: 6, border: `1px solid ${C.divider}`,
                  background: C.inputBg || C.panel, color: C.textPrimary, fontSize: 13.5, textAlign: "center" };

  return (
    <div style={cx.secao} data-aviso-de-espera>
      <div style={cx.titulo}><Hourglass size={16} /> Aviso de cliente sem resposta</div>
      <div style={cx.dica}>
        Quando um cliente escreve e <b>ninguém responde</b>, o Zorvin toca o som e mostra um aviso
        depois do tempo escolhido aqui — contando só o <b>expediente</b> do departamento, o da aba
        Fora do horário. Se a conversa tem responsável, o aviso vai só para ele; se não tem, para
        todo mundo que atende aquele telefone. Todos os departamentos começam ligados, com 30
        minutos.
      </div>

      {erro ? (
        <div data-aviso-de-espera-falhou style={aviso}>
          {erro}{" "}
          <button style={{ ...cx.botaoFraco, marginLeft: 6 }} onClick={ler}>
            <RefreshCw size={12} /> Tentar de novo
          </button>
        </div>
      ) : departamentos.map((d) => {
        const v = valeEm(d.id);
        const texto = rascunho[String(d.id)] ?? String(v.minutos);
        const n = minutosValidos(texto);
        const mudou = n !== null && n !== Number(v.minutos);
        const semana = semanas ? semanas[String(d.id)] : undefined;
        const resumo = resumoDoExpediente(semana);
        return (
          <div key={d.id} data-aviso-de-espera-departamento={d.id} data-ligado={v.ligado ? "sim" : "nao"}
               data-minutos={v.minutos}
               style={{ ...cx.linha, alignItems: "flex-start", flexWrap: "nowrap", padding: "10px 0" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{d.nome}</span>
              <span data-aviso-de-espera-expediente style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 1.45 }}>
                {erroSemanas ? erroSemanas
                  : semanas === null ? "Lendo o expediente…"
                  : resumo === null ? "Sem horário escrito na aba Fora do horário: o aviso conta o relógio inteiro, de dia e de noite."
                  : resumo === "" ? "Todos os dias fechados na aba Fora do horário: o aviso nunca toca."
                  : `Expediente: ${resumo}.`}
              </span>
              <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6, fontSize: 13,
                             opacity: v.ligado ? 1 : 0.55 }}>
                Avisar depois de
                <input data-minutos-do-aviso type="number" inputMode="numeric" min={MINUTOS_MIN} max={MINUTOS_MAX}
                       value={texto} disabled={!v.ligado || ocupado === String(d.id)}
                       aria-label={`Minutos de expediente sem resposta em ${d.nome}`}
                       onChange={(e) => setRascunho((r) => ({ ...r, [String(d.id)]: e.target.value }))}
                       style={campo} />
                minutos de expediente sem resposta.
                {mudou && v.ligado && (
                  <button data-salvar-minutos-do-aviso disabled={Boolean(ocupado)}
                          onClick={() => gravar(d, { minutos: n }, "salvar os minutos")}
                          style={{ ...cx.botao, padding: "5px 12px" }}>Salvar</button>
                )}
              </span>
              {v.ligado && n === null && (
                <span data-minutos-invalidos style={{ display: "block", fontSize: 12, color: C.erroTexto || "#e5573f", marginTop: 4 }}>
                  Escreva um número inteiro de {MINUTOS_MIN} a {MINUTOS_MAX}.
                </span>
              )}
            </span>
            <Chave ligada={Boolean(v.ligado)} rotulo={`Avisar quando um cliente de ${d.nome} esperar demais`}
                   aoTrocar={() => { if (!ocupado) gravar(d, { ligado: !v.ligado }, v.ligado ? "desligar o aviso" : "ligar o aviso"); }} />
          </div>
        );
      })}
    </div>
  );
}
