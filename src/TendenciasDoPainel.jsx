// AS TENDÊNCIAS DO PERÍODO (06/11) — a seção do Painel que ajuda a decidir.
//
// Pedido do Rodrigo: "Sinto que ainda está muito básico, quero algo
// profissional, um dashboard inteligente e interativo de verdade, com
// informações que ajudem a estudar os números, fazer uma boa gestão e tomar
// as melhores decisões."
//
// TRÊS PERGUNTAS, um gráfico cada, e a frase com os números em cima de cada
// um (o gráfico mostra; a frase diz o que ele mostra):
//
//   1. A FILA CRESCE OU ENCOLHE? — o que entrou a cada dia e, disso, o que já
//      foi finalizado, o que está em atendimento e o que espera a primeira
//      resposta;
//   2. EM QUE DIA O PRAZO ESTOUROU? — a parte no prazo de cada dia, com a do
//      período inteiro como régua;
//   3. EM QUE HORA FALTA GENTE? — a parte no prazo pela hora em que o cliente
//      escreveu.
//
// CLICAR NUM DIA recorta a tela inteira naquele dia (`aoVerDia`), e a barra
// oferece voltar ao período de antes. As contas moram em `tendencias.js`; a
// leitura é a dos protocolos, que a tela já faz (`useLeitura`): nenhuma ida a
// mais ao banco.
import { useLayoutEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Titulo, Grafico } from "./blocosDoPainel.jsx";
import { CORES_DA_VISAO } from "./VisaoGeral.jsx";
import { fluxoPorDia, resumoDoFluxo, prazoPorDia, prazoDoPeriodo, prazoPorHora, piorHora } from "./tendencias.js";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "03/11" e, por extenso no que se lê em voz alta, "seg, 03/nov". */
const diaCurto = (q) => `${q.slice(8, 10)}/${q.slice(5, 7)}`;
const diaLongo = (q) => {
  const d = new Date(`${q}T12:00:00`);
  return `${DIAS_DA_SEMANA[d.getDay()]}, ${q.slice(8, 10)}/${MESES[Number(q.slice(5, 7)) - 1]}`;
};
const hora = (h) => `${String(h).padStart(2, "0")}h`;
/** Casos bastantes para a porcentagem de uma hora não ser o acaso. */
export const MINIMO_POR_HORA = 5;

export default function TendenciasDoPainel({ C, estilos, modo = "claro", leitura, deIso, ateIso, quem = null, aoVerDia }) {
  const V = CORES_DA_VISAO[modo] || CORES_DA_VISAO.claro;
  const p = leitura && leitura.dados && !leitura.dados.falta ? leitura.dados : null;
  // SEM OS PROTOCOLOS, A SEÇÃO NÃO EXISTE: a falta e a falha já são ditas na
  // Visão geral e na seção dos protocolos, e repetir aqui seria a terceira
  // frase sobre o mesmo defeito.
  if (!p || leitura.carregando) return null;

  const fluxo = fluxoPorDia(p.por_dia, deIso, ateIso);
  const resumo = resumoDoFluxo(fluxo);
  const prazo = prazoPorDia(p.por_dia, deIso, ateIso);
  const doPeriodo = prazoDoPeriodo(prazo.dias);
  const porHora = prazoPorHora(p.registros, p.total_registros);
  const pior = piorHora(porHora.horas, MINIMO_POR_HORA);
  const piorDia = prazo.dias.filter((d) => d.julgados >= 3 && d.pct != null)
    .sort((a, b) => a.pct - b.pct || b.julgados - a.julgados)[0] || null;
  const temPrazo = prazo.existe && quem == null && doPeriodo;

  const series = fluxo.com052
    ? [{ campo: "finalizados", cor: V.situacao.finalizados, nome: "Já finalizados" },
       { campo: "em_atendimento", cor: V.situacao.em_atendimento, nome: "Em atendimento" },
       { campo: "sem_resposta", cor: V.situacao.sem_resposta, nome: "Esperando resposta" }]
    : [{ campo: "em_atendimento", cor: V.situacao.em_atendimento, nome: "Com atendimento" },
       { campo: "sem_resposta", cor: V.situacao.sem_resposta, nome: "Esperando resposta" }];
  // QUEM NÃO ADMINISTRA (e a pessoa escolhida) não vê "esperando resposta":
  // o banco manda zero ali, e a série some em vez de desenhar zero.
  const comEsperando = fluxo.dias.some((d) => d.sem_resposta > 0) || quem == null;
  const seriesDoFluxo = comEsperando ? series : series.filter((s) => s.campo !== "sem_resposta");

  return (
    <div data-tendencias>
      <Titulo C={C}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <TrendingUp size={16} /> Tendências do período
        </span>
      </Titulo>
      <div style={{ ...estilos.nota, marginBottom: 12 }} data-tendencias-escopo>
        Os protocolos do período, dia a dia e hora a hora, para ver para onde os números vão.
        {aoVerDia ? <> <b style={{ color: C.textPrimary }}>Clique num dia</b> para recortar a tela inteira nele.</> : null}
      </div>

      {/* 1. A FILA CRESCE OU ENCOLHE? */}
      <Grafico C={C} estilos={estilos} titulo="Entrada e saída, dia a dia"
        atributos={{ "data-grafico-fluxo": "", "data-bloco-de-impressao": "" }}
        legenda={seriesDoFluxo.map((s) => ({ nome: s.nome, cor: s.cor }))}
        colunas={["Dia", "Entraram", ...seriesDoFluxo.map((s) => s.nome)]}
        linhas={fluxo.dias.map((d) => [diaLongo(d.quando), fmt(d.entraram), ...seriesDoFluxo.map((s) => fmt(d[s.campo]))])}
        vazio={!resumo.entraram}
        rodape={fluxo.com052
          ? "Cada coluna é o dia em que os protocolos ENTRARAM, dividida no que aconteceu com eles até agora. As colunas mais antigas ficam quase todas verdes; muito azul ou âmbar num dia antigo é atendimento esquecido."
          : "Cada coluna é o dia em que os protocolos entraram. Sem a atualização 052 da ponte, o banco não diz quantos deles já foram finalizados."}
        desenho={() => (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }} data-resumo-do-fluxo>
              Entraram <b>{fmt(resumo.entraram)}</b> {resumo.entraram === 1 ? "protocolo" : "protocolos"}
              {resumo.finalizados != null && (
                <>; <b>{fmt(resumo.finalizados)}</b> já {resumo.finalizados === 1 ? "foi finalizado" : "foram finalizados"} ({resumo.pct}%)
                  e <b>{fmt(resumo.abertos)}</b> {resumo.abertos === 1 ? "continua aberto" : "continuam abertos"}</>
              )}
              {quem == null && resumo.esperando > 0 && (
                <> — <b>{fmt(resumo.esperando)}</b> sem nenhuma resposta ainda</>
              )}.
              {resumo.pico && resumo.pico.entraram > 0 && fluxo.dias.length > 1 && (
                <> O dia de mais entrada foi <b>{diaLongo(resumo.pico.quando)}</b>, com {fmt(resumo.pico.entraram)}.</>
              )}
            </div>
            <ColunasDoPainel C={C} V={V} dados={fluxo.dias.map((d) => ({ chave: d.quando, rotulo: diaCurto(d.quando), longo: diaLongo(d.quando), ...d }))}
              series={seriesDoFluxo} formatar={fmt} total={(x) => x.entraram} marca="fluxo"
              leitura={(x) => <><b style={{ color: C.textPrimary }}>{fmt(x.entraram)}</b> {x.entraram === 1 ? "entrou" : "entraram"}</>}
              aoClicar={aoVerDia ? (x) => aoVerDia(x.chave) : null} />
          </>
        )} />

      {/* 2. EM QUE DIA O PRAZO ESTOUROU? */}
      {temPrazo && (
        <div style={{ marginTop: 12 }}>
          <Grafico C={C} estilos={estilos} titulo="O prazo, dia a dia"
            atributos={{ "data-grafico-prazo-dia": "", "data-bloco-de-impressao": "" }}
            legenda={null}
            colunas={["Dia", "No prazo", "Clientes com desfecho", "Parte no prazo"]}
            linhas={prazo.dias.map((d) => [diaLongo(d.quando), fmt(d.noPrazo), fmt(d.julgados), d.pct == null ? "—" : `${d.pct}%`])}
            vazio={!doPeriodo}
            rodape="A parte dos clientes de cada dia atendida antes de o prazo do departamento vencer, contado só o expediente. Dia sem coluna é dia sem cliente para julgar — e não dia de zero. A linha é a parte do período inteiro."
            desenho={() => (
              <>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }} data-resumo-do-prazo-dia>
                  No período, <b>{doPeriodo.pct}%</b> dos clientes foram atendidos no prazo ({fmt(doPeriodo.noPrazo)} de {fmt(doPeriodo.julgados)}).
                  {piorDia && piorDia.pct < doPeriodo.pct && (
                    <> O pior dia foi <b>{diaLongo(piorDia.quando)}</b>: {piorDia.pct}%, em {fmt(piorDia.julgados)} {piorDia.julgados === 1 ? "cliente" : "clientes"}.</>
                  )}
                </div>
                <ColunasDoPainel C={C} V={V} marca="prazo-dia"
                  dados={prazo.dias.map((d) => ({ chave: d.quando, rotulo: diaCurto(d.quando), longo: diaLongo(d.quando), ...d, valor: d.pct }))}
                  series={[{ campo: "valor", cor: V.categorias[0], nome: "No prazo" }]} max={100}
                  formatar={(v) => `${v}%`} referencia={{ valor: doPeriodo.pct, rotulo: `${doPeriodo.pct}% no período` }}
                  leitura={(x) => x.pct == null
                    ? <>sem cliente para julgar</>
                    : <><b style={{ color: C.textPrimary }}>{x.pct}%</b> no prazo · {fmt(x.noPrazo)} de {fmt(x.julgados)}</>}
                  aoClicar={aoVerDia ? (x) => aoVerDia(x.chave) : null} />
              </>
            )} />
        </div>
      )}

      {/* 3. EM QUE HORA FALTA GENTE? */}
      {temPrazo && porHora.julgados > 0 && (
        <div style={{ marginTop: 12 }}>
          <Grafico C={C} estilos={estilos} titulo="O prazo pela hora em que o cliente escreveu"
            atributos={{ "data-grafico-prazo-hora": "", "data-bloco-de-impressao": "" }}
            legenda={null}
            colunas={["Hora", "No prazo", "Clientes com desfecho", "Parte no prazo"]}
            linhas={porHora.horas.filter((h) => h.julgados).map((h) => [hora(h.hora), fmt(h.noPrazo), fmt(h.julgados), `${h.pct}%`])}
            vazio={!porHora.julgados}
            rodape={`As colunas claras têm menos de ${MINIMO_POR_HORA} clientes: ali a porcentagem ainda é o acaso. A hora é a de Brasília, a da mensagem que abriu o atendimento.`}
            desenho={() => (
              <>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }} data-resumo-do-prazo-hora>
                  {pior && pior.pct < 100
                    ? <>A hora que mais precisa de gente: <b>{hora(pior.hora)}</b> — {pior.pct}% no prazo, em {fmt(pior.julgados)} {pior.julgados === 1 ? "cliente" : "clientes"} que escreveram entre {hora(pior.hora)} e {hora((pior.hora + 1) % 24)}.</>
                    : pior
                    ? <>Em todas as horas com {MINIMO_POR_HORA} clientes ou mais, todos foram atendidos no prazo.</>
                    : <>Nenhuma hora tem {MINIMO_POR_HORA} clientes ou mais ainda: a porcentagem de cada uma é o acaso.</>}
                  {!porHora.completo && (
                    <span style={{ ...estilos.nota, display: "block", marginTop: 4 }} data-prazo-hora-cortado>
                      Contado nos {fmt(porHora.vieram)} protocolos mais recentes do período (o banco manda no máximo esses). Para contar todos, encurte o período.
                    </span>
                  )}
                </div>
                <ColunasDoPainel C={C} V={V} marca="prazo-hora"
                  dados={porHora.horas.map((h) => ({ chave: String(h.hora), rotulo: hora(h.hora), longo: `${hora(h.hora)} às ${hora((h.hora + 1) % 24)}`, ...h, valor: h.pct }))}
                  series={[{ campo: "valor", cor: V.categorias[0], nome: "No prazo" }]} max={100}
                  formatar={(v) => `${v}%`} referencia={{ valor: doPeriodo.pct, rotulo: `${doPeriodo.pct}% no período` }}
                  fraco={(x) => x.julgados > 0 && x.julgados < MINIMO_POR_HORA}
                  cadaRotulo={3}
                  leitura={(x) => !x.julgados
                    ? <>nenhum cliente nesta hora</>
                    : <><b style={{ color: C.textPrimary }}>{x.pct}%</b> no prazo · {fmt(x.noPrazo)} de {fmt(x.julgados)}{x.julgados < MINIMO_POR_HORA ? " (poucos casos)" : ""}</>} />
              </>
            )} />
        </div>
      )}
    </div>
  );
}

/* ================================================================
   AS COLUNAS — empilhadas ou não, com a régua e o clique
   ================================================================
   As regras do método de gráficos (a skill de visualização): coluna de no
   máximo 24px, com a ponta de cima arredondada em 4px e reta no chão; 2px da
   cor do cartão separando as fatias de uma pilha; duas linhas de grade finas;
   a leitura em cima, que lista TODAS as séries do dia apontado (o valor na
   frente, o nome depois); o foco do teclado lê o mesmo que o mouse; e o alvo
   do mouse é a faixa inteira do dia, e não só a tinta da coluna. */
export function ColunasDoPainel({ C, V, dados, series, formatar, max: maxDado = null, total = null, referencia = null,
                                  leitura, aoClicar = null, fraco = null, marca, cadaRotulo = null }) {
  const [sobre, setSobre] = useState(null);
  const alt = 160;
  const somaDe = (x) => (total ? total(x) : series.reduce((s, sr) => s + Number(x[sr.campo] || 0), 0));
  const max = maxDado || Math.max(1, ...dados.map(somaDe));
  const trilho = useRef(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const el = trilho.current;
    if (!el) return undefined;
    const medir = () => setLargura(el.getBoundingClientRect().width);
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const vigia = new ResizeObserver(medir);
    vigia.observe(el);
    return () => vigia.disconnect();
  }, []);
  // UM RÓTULO A CADA `cada` colunas, pela largura que o gráfico tem: no
  // celular de 360, trinta dias não cabem lado a lado.
  const ROTULO_PX = 34;
  const cada = cadaRotulo || Math.max(1, Math.ceil(dados.length / 10), largura ? Math.ceil((dados.length * ROTULO_PX) / largura) : 1);
  const atual = sobre != null ? dados[sobre] : null;
  const yRef = referencia ? Math.round((referencia.valor / max) * (alt - 6)) : null;

  return (
    <div data-colunas={marca}>
      {/* A LEITURA: o dia apontado, e cada série com o seu traço de cor. */}
      <div style={{ minHeight: 20, fontSize: 12.5, color: C.textSecondary, marginBottom: 6, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}
           data-leitura-das-colunas aria-live="polite">
        {atual ? (
          <>
            <b style={{ color: C.textPrimary }}>{atual.longo || atual.rotulo}</b>
            <span>{leitura(atual)}</span>
            {series.length > 1 && series.map((s) => (
              <span key={s.campo} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 2, background: s.cor, borderRadius: 1 }} />
                <b style={{ color: C.textPrimary }}>{formatar(atual[s.campo])}</b> {s.nome.toLowerCase()}
              </span>
            ))}
            {aoClicar && <span style={{ fontStyle: "italic" }}>· clique para ver só este dia</span>}
          </>
        ) : <span>&nbsp;</span>}
      </div>

      <div style={{ position: "relative", height: alt, borderBottom: `1px solid ${C.divider}` }}>
        {[1, 0.5].map((f) => (
          <div key={f} style={{ position: "absolute", left: 0, right: 0, bottom: alt * f,
                                borderTop: `1px solid ${C.divider}`, pointerEvents: "none" }} />
        ))}
        <div style={{ position: "absolute", top: -7, right: 0, fontSize: 11, color: C.textSecondary,
                      background: C.panel, padding: "0 3px", fontVariantNumeric: "tabular-nums" }}>
          {formatar(max)}
        </div>
        {referencia && (
          <div data-referencia-das-colunas={referencia.valor}
               style={{ position: "absolute", left: 0, right: 0, bottom: yRef, borderTop: `1px solid ${C.textSecondary}`,
                        pointerEvents: "none", zIndex: 2 }}>
            <span style={{ position: "absolute", left: 0, top: -17, fontSize: 11, fontWeight: 600, color: C.textSecondary,
                           background: C.panel, padding: "0 4px", whiteSpace: "nowrap" }}>{referencia.rotulo}</span>
          </div>
        )}

        {/* AS COLUNAS POR CIMA DA GRADE (posicionadas, e depois dela): sem
            isso, a linha da grade risca cada coluna no meio. A régua do
            período fica por cima das duas, de propósito. */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", height: "100%", gap: 2 }}>
          {dados.map((x, i) => {
            const soma = somaDe(x);
            const vazio = !series.some((s) => x[s.campo] != null && Number(x[s.campo]) > 0);
            const ativo = sobre === i;
            const clicavel = aoClicar && !vazio;
            // AS FATIAS DE BAIXO PARA CIMA, na ordem das séries; a de cima ganha
            // a ponta arredondada, e o vão de 2px separa uma da outra.
            const visiveis = series.filter((s) => Number(x[s.campo] || 0) > 0);
            const alturaTotal = Math.max(soma > 0 ? 3 : 0, Math.round((Math.min(soma, max) / max) * (alt - 6)));
            return (
              <div key={x.chave} data-coluna={x.chave} data-valor-da-coluna={soma}
                   tabIndex={0} role={clicavel ? "button" : undefined}
                   aria-label={`${x.longo || x.rotulo}: ${series.map((s) => `${s.nome} ${x[s.campo] == null ? "sem número" : formatar(x[s.campo])}`).join(", ")}`}
                   onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)}
                   onFocus={() => setSobre(i)} onBlur={() => setSobre(null)}
                   onClick={clicavel ? () => aoClicar(x) : undefined}
                   onKeyDown={clicavel ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoClicar(x); } } : undefined}
                   style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end",
                            justifyContent: "center", outline: "none", cursor: clicavel ? "pointer" : "default",
                            background: ativo ? C.divider : "transparent", borderRadius: 4 }}>
                <div style={{ width: "70%", maxWidth: 24, minWidth: 3, height: alturaTotal, display: "flex",
                              flexDirection: "column-reverse", gap: visiveis.length > 1 ? 2 : 0,
                              opacity: fraco && fraco(x) ? 0.35 : 1 }}>
                  {visiveis.map((s, k) => {
                    const v = Number(x[s.campo] || 0);
                    const h = soma ? (v / soma) : 0;
                    const ehTopo = k === visiveis.length - 1;
                    return (
                      <div key={s.campo} data-fatia={s.campo}
                           style={{ flex: `${h} 1 0`, minHeight: 1, background: s.cor,
                                    borderRadius: ehTopo ? "4px 4px 0 0" : 0 }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div ref={trilho} style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {dados.map((x, i) => (
          // O PRIMEIRO RÓTULO ENCOSTA À ESQUERDA: centrado numa coluna de 8px,
          // no celular, ele sairia do cartão pela borda.
          <div key={x.chave} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: i === 0 ? "flex-start" : "center",
                                      fontSize: 10.5, color: C.textSecondary,
                                      fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {i % cada === 0 ? x.rotulo : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   A FAÍSCA — a tendência dentro de um cartão da Visão geral
   ================================================================
   Colunas finas no tom apagado, e a última (o fim do período) na cor de
   destaque. Cada coluna tem o seu `<title>`, que o mouse lê, e a faísca
   inteira tem um rótulo para quem não vê. É um enfeite que informa: o
   número exato de cada dia está no gráfico grande, logo abaixo, e na tabela
   dele. */
export function Faisca({ pontos, formatar, rotulo, cor, corApagada, marca }) {
  const validos = (pontos || []).filter((p) => p.v != null);
  if (validos.length < 2) return null;
  const max = Math.max(1, ...validos.map((p) => p.v));
  const L = 120, A = 26, gap = 1;
  const w = (L - gap * (pontos.length - 1)) / pontos.length;
  // O DESTAQUE VAI NO ÚLTIMO PONTO COM NÚMERO: o dia de hoje, quase sempre
  // vazio de manhã, apagaria o destaque.
  const ultimo = pontos.reduce((u, p, i) => (p.v != null && p.v > 0 ? i : u), -1);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="none" role="img"
         aria-label={rotulo} data-faisca={marca} style={{ display: "block", marginTop: "auto", paddingTop: 10 }}>
      {pontos.map((p, i) => {
        const h = p.v == null ? 0 : Math.max(p.v > 0 ? 1.5 : 0, (p.v / max) * (A - 1));
        const dePara = p.de === p.ate ? diaCurto(p.de) : `${diaCurto(p.de)} a ${diaCurto(p.ate)}`;
        return (
          <g key={i}>
            <rect x={i * (w + gap)} y={0} width={w} height={A} fill="transparent">
              <title>{`${dePara}: ${p.v == null ? "sem número" : formatar(p.v)}`}</title>
            </rect>
            {h > 0 && (
              <rect x={i * (w + gap)} y={A - h} width={w} height={h} rx={Math.min(1, w / 2)}
                    fill={i === ultimo ? cor : corApagada} pointerEvents="none" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
