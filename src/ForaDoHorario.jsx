import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo, semATabela } from "./gravar.js";
import { Chave } from "./Chave.jsx";
import { Clock, CalendarX2, Plus, Trash2, Check } from "lucide-react";
import {
  DIAS, SEMANA_PADRAO, FUSO_PADRAO, FUSOS, TEXTO_SUGERIDO, TETO_DO_TEXTO,
  semanaCompleta, diasAbertos, problemasDaSemana, temChaves, fraseDoHorario,
} from "./foraDoHorario.js";

// ============================================================
//  A RESPOSTA FORA DO HORÁRIO — a aba de mesmo nome em "Departamentos e
//  acessos" (09/10). Ver `foraDoHorario.js` e o script 021 da ponte.
//
//  UM DEPARTAMENTO POR VEZ, como as etapas do funil: o texto e o horário são
//  de cada um (decisão do Rodrigo). Os FERIADOS são do escritório inteiro e
//  ficam embaixo, uma lista só.
//
//  A PRÉVIA É A CONTA DO BANCO, feita com o que está na tela e ainda não foi
//  salvo: "agora está fechado — volta terça-feira, 13/10, às 08:00". É a
//  mesma conta que decide se o cliente recebe a resposta, então o que a
//  pessoa lê aqui é o que vai acontecer — e é aqui que ela descobre que
//  esqueceu de abrir a sexta.
//
//  SALVAR RELÊ DO BANCO, e não encaixa o que foi digitado: o gatilho do banco
//  arruma a semana ("8:00" vira "08:00") e pode recusar, e a tela tem de
//  mostrar o que ficou gravado de verdade.
// ============================================================

const vazio = () => ({ ligada: false, texto: "", semana: semanaCompleta(SEMANA_PADRAO), fuso: FUSO_PADRAO });
const daLinha = (l) => (l ? { ligada: Boolean(l.ligada), texto: l.texto || "",
                              semana: semanaCompleta(l.semana), fuso: l.fuso || FUSO_PADRAO } : vazio());
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function hojeNoFuso(fuso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso || FUSO_PADRAO, year: "numeric",
    month: "2-digit", day: "2-digit" }).format(new Date());
}
const DIA_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
                       "sexta-feira", "sábado"];
function diaPorExtenso(iso) {
  const [a, m, d] = String(iso).split("-");
  const semana = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return `${DIA_DA_SEMANA[semana]}, ${d}/${m}/${a}`;
}

export function ForaDoHorario({ cx, C, departamentos = [], aoAvisar }) {
  const [existe, setExiste] = useState(null);     // null = ainda lendo
  const [linhas, setLinhas] = useState([]);
  const [depId, setDepId] = useState(() => (departamentos[0] || {}).id ?? null);
  const [edicao, setEdicao] = useState(vazio);
  const [feriados, setFeriados] = useState([]);
  const [previa, setPrevia] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [novoDia, setNovoDia] = useState("");
  const [novoNome, setNovoNome] = useState("");

  useEffect(() => {
    if (depId == null && departamentos.length) setDepId(departamentos[0].id);
  }, [departamentos, depId]);

  const ler = useCallback(async () => {
    const [cfg, fer] = await Promise.all([
      supabase.from("zorvin_fora_do_horario").select("*"),
      supabase.from("zorvin_feriados").select("*").order("dia"),
    ]);
    if (cfg.error) {
      // A tabela que falta (o script 021 não rodou) é o único caso em que
      // sumir é o certo. Qualquer outra falha é DITA — "nenhum departamento
      // configurado" no lugar de "não consegui ler" faria alguém configurar
      // de novo por cima do que existe.
      if (semATabela(cfg.error)) { setExiste(false); return null; }
      aoAvisar(comOCodigo("Não consegui ler a resposta fora do horário.", cfg.error, "ler a configuração"));
      setExiste(true);
      return null;
    }
    if (fer.error) aoAvisar(comOCodigo("Não consegui ler os feriados.", fer.error, "ler os feriados"));
    else setFeriados(fer.data || []);
    setExiste(true);
    setLinhas(cfg.data || []);
    return cfg.data || [];
  }, [aoAvisar]);

  useEffect(() => { ler(); }, [ler]);

  // A LINHA GUARDADA DO DEPARTAMENTO ESCOLHIDO — é contra ela que se mede o
  // "mudou", e é dela que a tela volta ao trocar de departamento.
  const guardada = daLinha(linhas.find((l) => String(l.departamento_id) === String(depId)));
  const chaveGuardada = JSON.stringify(guardada);
  useEffect(() => { setEdicao(JSON.parse(chaveGuardada)); }, [chaveGuardada, depId]);
  const mudou = !igual(edicao, guardada);

  // A PRÉVIA, com o que está na tela. A resposta mais nova vence: digitar
  // depressa dispara várias contas, e uma que volte fora de ordem pintaria a
  // frase de um horário que já não é o da tela.
  //
  // E OS FERIADOS ENTRAM NA CONTA: tirar o de segunda muda "volta terça" para
  // "volta segunda", e a prévia que não refaz a conta ficaria dizendo o que
  // valia antes do clique — a prova pegou exatamente isso.
  const pedido = useRef(0);
  const chaveDosFeriados = feriados.map((f) => f.dia).join(",");
  useEffect(() => {
    if (existe !== true) return undefined;
    const meu = ++pedido.current;
    const relogio = setTimeout(async () => {
      const { data, error } = await supabase.rpc("zorvin_horario_de", {
        p_semana: edicao.semana, p_fuso: edicao.fuso, p_quando: new Date().toISOString(),
      });
      if (meu !== pedido.current) return;
      setPrevia(error ? "Não consegui fazer a conta do horário agora." : fraseDoHorario(data, edicao.fuso));
    }, 250);
    return () => clearTimeout(relogio);
  }, [existe, edicao.semana, edicao.fuso, chaveDosFeriados]);

  function trocarDepartamento(id) {
    if (mudou && !window.confirm("Você mudou a resposta deste departamento e ainda não salvou.\n\n"
                               + "Trocar de departamento descarta o que foi mudado. Trocar mesmo assim?")) {
      return;
    }
    setSalvo(false);
    setDepId(id);
  }

  const mudarDia = (chave, faixa) => setEdicao((e) => ({ ...e, semana: { ...e.semana, [chave]: faixa } }));
  const problemas = problemasDaSemana(edicao.semana);
  const semTexto = !edicao.texto.trim();
  const semDia = diasAbertos(edicao.semana) === 0;
  // LIGAR PEDE AS DUAS COISAS, como o gatilho do banco: sem texto o cliente
  // receberia uma mensagem vazia; sem dia aberto, "voltamos" sem quando.
  const impedeLigar = edicao.ligada && (semTexto || semDia);
  const recusado = "o banco não deixou. Só quem administra o Zorvin muda a resposta fora do horário.";

  async function salvar() {
    if (problemas.length || impedeLigar || depId == null) return;
    setOcupado(true); aoAvisar(""); setSalvo(false);
    const linha = { departamento_id: depId, ligada: edicao.ligada, texto: edicao.texto,
                    semana: edicao.semana, fuso: edicao.fuso };
    const r = await supabase.from("zorvin_fora_do_horario")
      .upsert(linha, { onConflict: "departamento_id" }).select("departamento_id");
    setOcupado(false);
    if (r.error) {
      // A RECUSA DO GATILHO JÁ VEM EM PORTUGUÊS, e diz o que consertar.
      aoAvisar(r.error.code === "23514" ? r.error.message
        : comOCodigo("Não consegui salvar a resposta fora do horário.", r.error, "salvar a resposta"));
      return;
    }
    if (naoGravouNada(r)) { aoAvisar(`Não salvou: ${recusado}`); return; }
    await ler();
    setSalvo(true);
  }

  async function acrescentarFeriado() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novoDia)) { aoAvisar("Escolha o dia do feriado."); return; }
    if (feriados.some((f) => f.dia === novoDia)) { aoAvisar("Esse dia já está na lista de feriados."); return; }
    setOcupado(true); aoAvisar("");
    const r = await supabase.from("zorvin_feriados")
      .insert({ dia: novoDia, nome: novoNome.trim().slice(0, 80) }).select("dia");
    setOcupado(false);
    if (r.error) { aoAvisar(comOCodigo("Não consegui acrescentar o feriado.", r.error, "feriado")); return; }
    if (naoGravouNada(r)) { aoAvisar(`Não acrescentou: ${recusado}`); return; }
    setNovoDia(""); setNovoNome("");
    ler();
  }

  async function tirarFeriado(dia) {
    setOcupado(true); aoAvisar("");
    const r = await supabase.from("zorvin_feriados").delete().eq("dia", dia).select("dia");
    setOcupado(false);
    if (r.error) { aoAvisar(comOCodigo("Não consegui tirar o feriado.", r.error, "feriado")); return; }
    if (naoGravouNada(r)) { aoAvisar(`Não tirou: ${recusado}`); return; }
    ler();
  }

  if (existe === false) {
    return (
      <div style={cx.secao} data-fora-sem-script>
        <div style={cx.dica}>
          A resposta fora do horário ainda não está instalada neste banco — ela chega com a
          próxima atualização da ponte.
        </div>
      </div>
    );
  }
  if (existe === null) return <div style={{ color: C.textSecondary, fontSize: 14 }}>Carregando…</div>;
  if (!departamentos.length) {
    return <div style={cx.dica}>Crie um departamento primeiro: a resposta é de cada um.</div>;
  }

  const hoje = hojeNoFuso(edicao.fuso);
  const proximos = feriados.filter((f) => f.dia >= hoje);
  const passados = feriados.length - proximos.length;
  // O RELÓGIO DO CAMPO DE HORA some no tema escuro sem `colorScheme` — a
  // lição de `EscolherHora.jsx`. O tema não diz o nome, então a cor do painel
  // responde: fundo escuro, tema escuro.
  const escuro = /^#[0-9a-f]{6}$/i.test(C.panel || "") && parseInt(C.panel.slice(1, 3), 16) < 128;
  const esquema = escuro ? "dark" : "light";
  const caixaDeHora = { ...cx.campo, padding: "5px 6px", width: 92, colorScheme: esquema };

  return (
    <>
      <div style={cx.secao} data-fora-do-horario>
        <div style={cx.titulo}><Clock size={16} /> Resposta fora do horário</div>
        <div style={cx.dica}>
          Quem escreve à noite, no fim de semana ou no feriado recebe na hora o texto abaixo —
          <b> uma vez</b> por período fechado, e não a cada mensagem. Se alguém da equipe já
          escreveu na conversa depois do fechamento, ela não sai. A conversa continua na fila de
          espera: o cliente ainda não foi atendido.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>Departamento</span>
          <select data-fora-departamento value={depId ?? ""} style={cx.campo}
                  onChange={(e) => trocarDepartamento(Number(e.target.value) || e.target.value)}>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }} data-fora-ligada={edicao.ligada ? "sim" : "nao"}>
          <Chave ligada={edicao.ligada} rotulo="Responder sozinho fora do horário"
                 aoTrocar={() => setEdicao((e) => ({ ...e, ligada: !e.ligada }))} />
          <span style={{ fontSize: 13.5, color: C.textPrimary }}>
            {edicao.ligada ? "Ligada — responde sozinha fora do horário" : "Desligada — ninguém recebe nada"}
          </span>
        </div>

        <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 4 }}>O que o cliente recebe</div>
        <textarea data-fora-texto value={edicao.texto} rows={4} maxLength={TETO_DO_TEXTO}
                  placeholder={TEXTO_SUGERIDO}
                  onChange={(e) => setEdicao((x) => ({ ...x, texto: e.target.value }))}
                  style={{ ...cx.campo, width: "100%", boxSizing: "border-box", resize: "vertical",
                           fontFamily: "inherit", lineHeight: 1.45 }} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center",
                      fontSize: 11.5, color: C.textSecondary, margin: "3px 0 8px" }}>
          {semTexto ? (
            <button type="button" data-fora-sugerido style={cx.botaoFraco}
                    onClick={() => setEdicao((x) => ({ ...x, texto: TEXTO_SUGERIDO }))}>
              Usar um texto sugerido
            </button>
          ) : <span />}
          <span>{edicao.texto.length}/{TETO_DO_TEXTO}</span>
        </div>
        {/* AS VARIÁVEIS DAS RÁPIDAS NÃO FUNCIONAM AQUI, e quem as usa todo
            dia escreve por hábito. Avisa e não impede — pode ser chave de
            verdade —, como o aviso da variável desconhecida das rápidas. */}
        {temChaves(edicao.texto) && (
          <div data-fora-chaves style={{ fontSize: 12.5, color: C.textPrimary, background: C.panel,
               border: `1px solid ${C.divider}`, borderLeft: "4px solid #d99a1e", borderRadius: 8,
               padding: "7px 10px", marginBottom: 10, lineHeight: 1.45 }}>
            Variáveis como <b>{"{nome}"}</b> não funcionam aqui: a resposta sai sem ninguém ler, e
            iria para o cliente com as chaves.
          </div>
        )}

        <div style={{ fontSize: 12.5, color: C.textSecondary, margin: "6px 0 4px" }}>Horário de atendimento</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {DIAS.map(({ chave, nome }) => {
            const faixa = edicao.semana[chave];
            return (
              <div key={chave} data-fora-dia={chave} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, width: 96, fontSize: 13.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={Array.isArray(faixa)}
                         onChange={(e) => mudarDia(chave, e.target.checked ? ["08:00", "18:00"] : null)} />
                  {nome}
                </label>
                {Array.isArray(faixa) ? (
                  <>
                    <input type="time" data-abre value={faixa[0]} style={caixaDeHora}
                           aria-label={`${nome}: abre às`}
                           onChange={(e) => mudarDia(chave, [e.target.value, faixa[1]])} />
                    <span style={{ fontSize: 12.5, color: C.textSecondary }}>às</span>
                    <input type="time" data-fecha value={faixa[1]} style={caixaDeHora}
                           aria-label={`${nome}: fecha às`}
                           onChange={(e) => mudarDia(chave, [faixa[0], e.target.value])} />
                  </>
                ) : (
                  <span style={{ fontSize: 12.5, color: C.textSecondary }}>fechado</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>Fuso</span>
          <select data-fora-fuso value={edicao.fuso} style={cx.campo}
                  onChange={(e) => setEdicao((x) => ({ ...x, fuso: e.target.value }))}>
            {FUSOS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
            {/* O FUSO GUARDADO QUE NÃO ESTÁ NA LISTA continua escolhido, e
                não vira Brasília calado no primeiro "Salvar". */}
            {!FUSOS.some((f) => f.valor === edicao.fuso) && <option value={edicao.fuso}>{edicao.fuso}</option>}
          </select>
        </div>

        {problemas.length > 0 && (
          <div data-fora-problemas style={{ fontSize: 12.5, color: "#e5573f", marginBottom: 8, lineHeight: 1.45 }}>
            {problemas.join(" ")}
          </div>
        )}
        {impedeLigar && (
          <div data-fora-impede style={{ fontSize: 12.5, color: "#e5573f", marginBottom: 8, lineHeight: 1.45 }}>
            {semTexto ? "Para ligar, escreva o texto que o cliente vai receber."
                      : "Para ligar, abra pelo menos um dia da semana."}
          </div>
        )}
        {/* A PRÉVIA diz o que o horário NA TELA faz agora — e não o guardado:
            é aqui que se descobre o dia esquecido, antes de salvar. */}
        {previa && (
          <div data-fora-previa style={{ fontSize: 13, color: C.textPrimary, background: C.panel,
               border: `1px solid ${C.divider}`, borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
            {previa}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button data-fora-salvar style={{ ...cx.botao, opacity: (ocupado || problemas.length || impedeLigar) ? 0.55 : 1 }}
                  disabled={ocupado || problemas.length > 0 || impedeLigar} onClick={salvar}>
            Salvar
          </button>
          {salvo && !mudou && (
            <span data-fora-salvo style={{ fontSize: 12.5, color: C.verdeTexto || C.green, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Check size={14} /> Salvo
            </span>
          )}
          {mudou && <span style={{ fontSize: 12.5, color: C.textSecondary }}>Ainda não salvo.</span>}
        </div>
      </div>

      <div style={cx.secao} data-feriados>
        <div style={cx.titulo}><CalendarX2 size={16} /> Feriados do escritório</div>
        <div style={cx.dica}>
          Valem para todos os departamentos: nesses dias o escritório conta como fechado o dia
          inteiro. Os feriados nacionais já vêm na lista; Carnaval e Corpus Christi não, porque são
          ponto facultativo — acrescente se o escritório fecha.
        </div>
        {proximos.length === 0 && (
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>Nenhum feriado daqui para a frente.</div>
        )}
        {proximos.map((f) => (
          <div key={f.dia} data-feriado={f.dia} style={cx.linha}>
            <span style={{ flex: 1, fontSize: 13.5 }}>
              <b>{diaPorExtenso(f.dia)}</b>{f.nome ? ` — ${f.nome}` : ""}
            </span>
            <button style={cx.botaoFraco} disabled={ocupado} onClick={() => tirarFeriado(f.dia)}
                    aria-label={`Tirar o feriado de ${diaPorExtenso(f.dia)}`}>
              <Trash2 size={13} /> Tirar
            </button>
          </div>
        ))}
        {passados > 0 && (
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
            E {passados === 1 ? "1 que já passou" : `${passados} que já passaram`}.
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input type="date" data-feriado-dia value={novoDia} onChange={(e) => setNovoDia(e.target.value)}
                 style={{ ...cx.campo, colorScheme: esquema }} aria-label="Dia do feriado" />
          <input data-feriado-nome value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                 maxLength={80} placeholder="Nome (opcional)" style={{ ...cx.campo, flex: 1, minWidth: 140 }} />
          <button data-feriado-acrescentar style={cx.botao} disabled={ocupado} onClick={acrescentarFeriado}>
            <Plus size={15} /> Acrescentar
          </button>
        </div>
      </div>
    </>
  );
}
