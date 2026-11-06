// ============================================================
//  A VISÃO GERAL DO PAINEL (05/11) — a tela
//
//  Pedido do Rodrigo: "A tela 'Painel' preciso de um dashboard de verdade,
//  que seja inteligente e interativa. Com cards, gráficos de pizza, etc. Tem
//  que fazer sentido também as informações que me ajudem a melhorar o
//  atendimento, organizar a equipe e dar feedbacks e fazer cobranças de forma
//  correta."
//
//  O QUE ELA MOSTRA, de cima para baixo:
//    - os INDICADORES: o prazo, o tempo até a 1ª resposta em expediente, os
//      atendimentos do período, o que espera resposta agora e a fila sem
//      responsável;
//    - os DESTAQUES: as frases que dizem o que fazer, o mais urgente primeiro
//      (`destaques`, em visaoGeral.js), cada uma com o caminho até o lugar de
//      agir;
//    - três ROSCAS: o prazo do período, a situação dos protocolos e os
//      protocolos por departamento — esta, clicável: escolhe o departamento
//      na barra do alto.
//
//  NENHUMA LEITURA NOVA. Tudo sai das leituras que a tela já faz (os
//  protocolos e a carteira, `useLeitura` em PainelNumeros.jsx): uma seção
//  que perguntasse por si dobraria as idas ao banco a cada troca de período.
//
//  SEM `tabindex` NOS DESENHOS: o teclado chega pelas legendas, que são
//  botões quando o clique faz algo, e pela tabela de cada rosca.
// ============================================================
import { useState } from "react";
import {
  LayoutDashboard, OctagonAlert, TriangleAlert, CircleCheck, Info, ArrowRight, ExternalLink, RefreshCw,
} from "lucide-react";
import { Titulo, Grafico } from "./blocosDoPainel.jsx";
import { enderecoDaTela } from "./guias.js";
import { Faisca } from "./TendenciasDoPainel.jsx";
import { fluxoPorDia, prazoPorDia, pontosDaFaisca } from "./tendencias.js";
import {
  lerPrazo, porcento, fraseDoLimite, variacaoDoPrazo, tempoCurto, resumoDaCarteira, diasDaCarteira,
  fatiasDoPrazo, fatiasDaSituacao, fatiasDosDepartamentos, destaques, rotuloDasAtrasadas, carteiraDe,
} from "./visaoGeral.js";

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");

/** AS CORES DA VISÃO GERAL, conferidas no validador de paleta (05/11), nos
 *  dois temas:
 *    - o STATUS (o prazo e os destaques) é fixo nos dois temas, e nunca vai
 *      sozinho: sempre com o ícone e a palavra. No tema claro o âmbar fica
 *      abaixo de 3:1 contra o branco, por desenho — é o ícone e a palavra
 *      que carregam o sentido;
 *    - a SITUAÇÃO usa o azul e o verde da tela ("chegou" e "saiu") e o âmbar
 *      do aviso;
 *    - os DEPARTAMENTOS, oito cores numa ordem fixa, e cada departamento fica
 *      com a sua (a da posição dele na lista de departamentos), e não a da
 *      posição na rosca: escolher outro período não troca a cor de ninguém;
 *    - o cinza é o "Outros" e o que não tem departamento. */
export const CORES_DO_STATUS = { bom: "#0ca30c", atencao: "#fab219", critico: "#d03b3b" };
export const CORES_DA_VISAO = {
  claro: {
    status: CORES_DO_STATUS,
    situacao: { em_atendimento: "#2a78d6", finalizados: "#008069", sem_resposta: "#c98500" },
    categorias: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
    outros: "#98a5ac",
  },
  escuro: {
    status: CORES_DO_STATUS,
    situacao: { em_atendimento: "#3987e5", finalizados: "#00a884", sem_resposta: "#c98500" },
    categorias: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
    outros: "#6b7a83",
  },
};

/** O NÍVEL DE CADA DESTAQUE: o ícone na cor do status e a palavra numa cor de
 *  TEXTO, que é a que passa no contraste (a cor do status escrita em letra
 *  pequena sumiria no branco). */
const NIVEL = {
  critico: { rotulo: "Urgente", Icone: OctagonAlert, cor: (V) => V.status.critico, texto: (C) => C.erroTexto },
  atencao: { rotulo: "Atenção", Icone: TriangleAlert, cor: (V) => V.status.atencao, texto: (C) => C.ambarTexto },
  bom: { rotulo: "Bom sinal", Icone: CircleCheck, cor: (V) => V.status.bom, texto: (C) => C.verdeTexto },
  info: { rotulo: "Para saber", Icone: Info, cor: (V, C) => C.textSecondary, texto: (C) => C.textSecondary },
};

export default function VisaoGeral({ C, estilos, modo = "claro", lProtocolos, lCarteira, departamentos = [], departamento = null,
                                     quem = null, nome = "", sou = false, souAdmin = false, rotuloPeriodo = "",
                                     aoIrPara, aoEscolherDepartamento, deIso = null, ateIso = null }) {
  const V = CORES_DA_VISAO[modo] || CORES_DA_VISAO.claro;
  const carregando = lProtocolos.carregando || lCarteira.carregando;
  const faltaP = lProtocolos.semFuncao || Boolean(lProtocolos.dados && lProtocolos.dados.falta);
  const faltaC = lCarteira.semFuncao || Boolean(lCarteira.dados && lCarteira.dados.falta);
  const p = !carregando && !lProtocolos.erro && !faltaP ? lProtocolos.dados : null;
  const c = !carregando && !lCarteira.erro && !faltaC ? lCarteira.dados : null;

  // O QUE FICOU DE FORA. A falta de uma função é dita a quem administra (é
  // quem pode fazer alguma coisa); a falha, a todo mundo — falha não é
  // ausência (armadilha nº 2). O motivo, com o código, está na seção dela.
  const ficouDeFora = [
    !p && (lProtocolos.erro || (faltaP && souAdmin)) ? "os protocolos" : null,
    !c && (lCarteira.erro || (faltaC && souAdmin)) ? "a carteira" : null,
  ].filter(Boolean);

  if (!carregando && !p && !c && !ficouDeFora.length) return null;

  const pessoa = quem != null;

  return (
    <div data-visao-geral>
      <Titulo C={C} primeiro>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <LayoutDashboard size={16} /> Visão geral
        </span>
      </Titulo>

      {carregando && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, padding: "10px 0 6px" }} data-visao-carregando>
          <RefreshCw size={16} /> Montando a visão geral…
        </div>
      )}

      {!carregando && (
        <>
          <div style={{ ...estilos.nota, marginBottom: 12 }} data-visao-escopo>
            {pessoa
              ? <>Recortada em <b style={{ color: C.textPrimary }}>{sou ? "você" : nome}</b>: os atendimentos de que {sou ? "você" : "a pessoa"} participou{rotuloPeriodo ? <> em <b style={{ color: C.textPrimary }}>{rotuloPeriodo}</b></> : null} e {carteiraDe({ sou, nome })}, agora.
                  {" "}O prazo não aparece com uma pessoa escolhida: ele é da equipe — quem pega a conversa esquecida não foi quem a esqueceu.</>
              : <>Os números {rotuloPeriodo ? <>de <b style={{ color: C.textPrimary }}>{rotuloPeriodo}</b></> : "do período escolhido no alto"}, nos telefones que você alcança.
                  {" "}O que tem a marca <b style={{ color: C.textPrimary }}>agora</b> é a foto deste momento, e não usa o período.</>}
          </div>

          <Indicadores C={C} V={V} estilos={estilos} p={p} c={c} quem={quem} sou={sou} nome={nome} deIso={deIso} ateIso={ateIso} />

          {(p || c) && (
            <Destaques C={C} V={V} estilos={estilos}
                       lista={destaques({ protocolos: p, carteira: c, quem, nome, sou })}
                       aoIrPara={aoIrPara} aoEscolherDepartamento={aoEscolherDepartamento} />
          )}

          {p && <Roscas C={C} V={V} estilos={estilos} p={p} departamentos={departamentos} departamento={departamento}
                        aoEscolherDepartamento={aoEscolherDepartamento} />}

          {ficouDeFora.length > 0 && (
            <div style={{ ...estilos.nota, color: C.ambarTexto, marginTop: 10 }} data-visao-ficou-de-fora>
              Ficou de fora da visão geral o que vem {ficouDeFora.length === 2 ? "dos protocolos e da carteira" : ficouDeFora[0] === "os protocolos" ? "dos protocolos" : "da carteira"}:
              o motivo está na seção {ficouDeFora.length === 2 ? "de cada um" : ficouDeFora[0] === "os protocolos" ? "dos protocolos" : "da carteira"}, mais abaixo.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================
   OS INDICADORES
   ================================================================ */
function Indicadores({ C, V, estilos, p, c, quem, sou, nome, deIso, ateIso }) {
  // AS FAÍSCAS (06/11): a tendência do período dentro do cartão, dos mesmos
  // `por_dia` do gráfico grande das tendências. Só com o período conhecido.
  const comDias = Boolean(p && deIso && ateIso);
  const fluxo = comDias ? fluxoPorDia(p.por_dia, deIso, ateIso) : null;
  const prazoDia = comDias ? prazoPorDia(p.por_dia, deIso, ateIso) : null;
  const faiscaDoPrazo = prazoDia && prazoDia.existe && quem == null && prazoDia.dias.length > 1
    ? <Faisca pontos={pontosDaFaisca(prazoDia.dias, null, { razao: ["noPrazo", "julgados"] })} formatar={(v) => `${v}% no prazo`}
              rotulo="A parte no prazo, dia a dia, no período" cor={V.categorias[0]} corApagada={V.outros} marca="prazo" />
    : null;
  const faiscaDosAtendimentos = fluxo && fluxo.dias.length > 1
    ? <Faisca pontos={pontosDaFaisca(fluxo.dias, "iniciados")} formatar={(v) => `${fmt(v)} ${v === 1 ? "atendimento" : "atendimentos"}`}
              rotulo="Os atendimentos começados, dia a dia, no período" cor={V.situacao.em_atendimento} corApagada={V.outros} marca="atendimentos" />
    : null;
  const prazo = lerPrazo(p && p.prazo);
  const antes = lerPrazo(p && p.antes && p.antes.prazo);
  const delta = variacaoDoPrazo(prazo, antes);
  const limite = fraseDoLimite(prazo);
  const pr = (p && p.tempos && p.tempos.primeira_resposta) || null;
  const com052 = Boolean(pr) && Object.prototype.hasOwnProperty.call(pr, "mediana_expediente");
  const t = (p && p.total) || null;
  const carteira = resumoDaCarteira(c, quem);
  const dias = diasDaCarteira(c);

  const lista = [];
  if (prazo && prazo.julgados > 0) {
    lista.push(
      <Indicador key="prazo" C={C} estilos={estilos} id="prazo" rotulo="No prazo" valor={porcento(prazo.pct)} bruto={prazo.pct}
        faisca={faiscaDoPrazo}
        sub={<>{fmt(prazo.noPrazo)} de {fmt(prazo.julgados)} {prazo.julgados === 1 ? "cliente" : "clientes"}{limite ? <> · prazo de {limite} de expediente</> : null}</>}
        comparacao={delta == null ? null
          : delta === 0 ? <>igual ao período anterior</>
          : <>{delta > 0 ? "↑" : "↓"} {Math.abs(delta)} {Math.abs(delta) === 1 ? "ponto" : "pontos"} que no período anterior ({porcento(antes.pct)})</>}
        ajuda="Dos clientes que abriram atendimento no período, quantos tiveram a primeira resposta (ou foram finalizados) antes de o prazo vencer. O prazo conta só o horário de expediente, e é o da aba “Aviso de espera” de cada departamento. Quem ainda está dentro do prazo não entra na conta." />,
    );
  }
  if (pr && Number(pr.quantos) > 0) {
    lista.push(com052
      ? <Indicador key="primeira" C={C} estilos={estilos} id="primeira-resposta" rotulo="1ª resposta"
          valor={tempoCurto(pr.mediana_expediente)} bruto={pr.mediana_expediente}
          sub={<>de expediente · a mediana de {fmt(pr.quantos)} {Number(pr.quantos) === 1 ? "cliente" : "clientes"}</>}
          comparacao={<>no relógio: {tempoCurto(pr.mediana)}</>}
          ajuda="Mediana do tempo entre o cliente abrir o atendimento e a primeira resposta da equipe, contando só o horário de expediente do departamento. No relógio, a noite, o fim de semana e o feriado entram na conta — e quem chega às 8h e responde a fila da noite parece lento." />
      : <Indicador key="primeira" C={C} estilos={estilos} id="primeira-resposta" rotulo="1ª resposta"
          valor={tempoCurto(pr.mediana)} bruto={pr.mediana}
          sub={<>no relógio, contando noite e fim de semana · a mediana de {fmt(pr.quantos)} {Number(pr.quantos) === 1 ? "cliente" : "clientes"}</>}
          ajuda="Mediana do tempo entre o cliente abrir o atendimento e a primeira resposta da equipe, no relógio." />);
  }
  if (t) {
    const a = p.antes || {};
    const va = Number(a.atendimentos || 0), vb = Number(t.atendimentos || 0);
    const pct = va >= 10 ? Math.round(((vb - va) / va) * 100) : null;
    lista.push(
      <Indicador key="atendimentos" C={C} estilos={estilos} id="atendimentos" rotulo="Atendimentos" valor={fmt(t.atendimentos)} bruto={t.atendimentos}
        faisca={faiscaDosAtendimentos}
        sub={<>{fmt(t.finalizados)} {Number(t.finalizados) === 1 ? "finalizado" : "finalizados"} · {fmt(t.em_atendimento)} em atendimento</>}
        comparacao={!a.existe ? null
          : pct != null && Math.abs(pct) <= 300
          ? <>{pct > 0 ? "↑" : pct < 0 ? "↓" : "="} {Math.abs(pct)}% que no período anterior</>
          : <>no período anterior: {fmt(va)}</>}
        ajuda="Protocolos abertos no período em que a equipe começou o atendimento: respondeu, finalizou, ou foi ela que abriu a conversa. O que o cliente abriu e ninguém tocou não entra — fica em “Esperando resposta”." />,
    );
  }
  if (carteira) {
    lista.push(
      <Indicador key="esperando" C={C} estilos={estilos} id="esperando-agora" agora rotulo="Esperando resposta"
        valor={fmt(carteira.esperando)} bruto={carteira.esperando}
        sub={<><b style={{ color: carteira.atrasadas ? C.erroTexto : C.textPrimary }} data-atrasadas-do-indicador={carteira.atrasadas}>{fmt(carteira.atrasadas)}</b> {rotuloDasAtrasadas(dias).toLowerCase()}{carteira.de === "pessoa" ? <> · {carteiraDe({ sou, nome }, "na")}</> : null}</>}
        ajuda={`Conversas em que o cliente escreveu e ainda não teve resposta, agora${carteira.de === "pessoa" ? "" : " — com responsável ou não"}. Não usa o período. “${rotuloDasAtrasadas(dias)}” são as que esperam há ${dias} dias de calendário ou mais.`} />,
    );
    if (carteira.semDono) {
      lista.push(
        <Indicador key="sem-dono" C={C} estilos={estilos} id="sem-responsavel" agora rotulo="Sem responsável"
          valor={fmt(carteira.semDono.conversas)} bruto={carteira.semDono.conversas}
          sub={<>{fmt(carteira.semDono.esperando)} esperando resposta</>}
          ajuda="Conversas abertas que ainda não têm responsável, agora. Quem responder primeiro assume — ou a distribuição automática, onde está ligada." />,
      );
    }
  }
  if (!lista.length) return null;
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))" }} data-indicadores>
      {lista}
    </div>
  );
}

/** UM INDICADOR: o rótulo curto (numa linha, para os números dos cartões
 *  vizinhos ficarem na mesma altura), o número, e embaixo o que ele quer
 *  dizer. A marca "agora" vai na linha de baixo, e não no rótulo: no rótulo
 *  ela empurrava o ⓘ para uma segunda linha. */
function Indicador({ C, estilos, id, rotulo, valor, bruto, sub, comparacao, ajuda, agora = false, faisca = null }) {
  return (
    <div style={{ ...estilos.cartao, display: "flex", flexDirection: "column" }} data-indicador={id} data-valor={bruto == null ? "" : String(bruto)}>
      <div style={{ ...estilos.rotulo, display: "flex", alignItems: "center", gap: 5 }}>
        <span>{rotulo}</span>
        {ajuda && <span title={ajuda} style={{ display: "flex", cursor: "help", flexShrink: 0 }}><Info size={12} /></span>}
      </div>
      <div style={estilos.valor} data-valor-do-indicador>{valor}</div>
      {(sub || agora) && (
        <div style={{ ...estilos.nota, marginTop: 4 }}>
          {agora && (
            <span data-marca-agora title="A foto deste momento: não usa o período."
                  style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                           color: C.textSecondary, border: `1px solid ${C.divider}`, borderRadius: 8, padding: "0 5px",
                           lineHeight: "15px", marginRight: 6, verticalAlign: "1px" }}>
              agora
            </span>
          )}
          {sub}
        </div>
      )}
      {comparacao && <div style={{ ...estilos.nota, marginTop: 2 }} data-comparacao-do-indicador>{comparacao}</div>}
      {faisca}
    </div>
  );
}

/* ================================================================
   OS DESTAQUES — o que fazer, o mais urgente primeiro
   ================================================================ */
function Destaques({ C, V, estilos, lista, aoIrPara, aoEscolherDepartamento }) {
  return (
    <div style={{ ...estilos.cartao, marginTop: 12 }} data-destaques data-bloco-de-impressao>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Destaques</div>
        <div style={{ ...estilos.nota, fontSize: 12 }}>o que os números dizem, o mais urgente primeiro</div>
      </div>
      {!lista.length && (
        <div style={{ ...estilos.nota, marginTop: 10 }} data-destaques-vazio>Nada fora do comum neste recorte.</div>
      )}
      {lista.map((d, i) => {
        const N = NIVEL[d.nivel] || NIVEL.info;
        return (
          <div key={d.id} data-destaque-da-visao={d.id} data-nivel={d.nivel}
               style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap",
                        padding: "12px 0 2px", marginTop: i ? 10 : 6, borderTop: i ? `1px solid ${C.divider}` : "none" }}>
            <span data-nivel-do-destaque
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "0 0 auto", minWidth: 104,
                           fontSize: 12, fontWeight: 700, color: N.texto(C), paddingTop: 1 }}>
              <N.Icone size={16} color={N.cor(V, C)} style={{ flexShrink: 0 }} aria-hidden="true" /> {N.rotulo}
            </span>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }} data-titulo-do-destaque>{d.titulo}</div>
              {d.detalhe && <div style={{ ...estilos.nota, marginTop: 2 }} data-detalhe-do-destaque>{d.detalhe}</div>}
            </div>
            {d.acao && (
              <div data-nao-imprime style={{ flex: "0 0 auto" }}>
                <AcaoDoDestaque C={C} acao={d.acao} aoIrPara={aoIrPara} aoEscolherDepartamento={aoEscolherDepartamento} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AcaoDoDestaque({ C, acao, aoIrPara, aoEscolherDepartamento }) {
  const estilo = { font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 32, padding: "5px 12px",
                   borderRadius: 8, border: `1px solid ${C.divider}`, background: "transparent", color: C.verdeTexto,
                   fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap",
                   boxSizing: "border-box" };
  if (acao.tipo === "guia") {
    return (
      <a href={enderecoDaTela(acao.tela)} target="_blank" rel="noopener" data-abre-guia data-acao-do-destaque="guia" style={estilo}>
        {acao.rotulo} <ExternalLink size={13} aria-hidden="true" />
      </a>
    );
  }
  if (acao.tipo === "secao" && aoIrPara) {
    return (
      <button type="button" onClick={() => aoIrPara(acao.secao)} data-acao-do-destaque="secao" style={estilo}>
        {acao.rotulo} <ArrowRight size={13} aria-hidden="true" />
      </button>
    );
  }
  if (acao.tipo === "departamento" && aoEscolherDepartamento) {
    return (
      <button type="button" onClick={() => aoEscolherDepartamento(acao.id)} data-acao-do-destaque="departamento" style={estilo}>
        {acao.rotulo} <ArrowRight size={13} aria-hidden="true" />
      </button>
    );
  }
  return null;
}

/* ================================================================
   AS ROSCAS — o prazo, a situação, os departamentos
   ================================================================ */
function Roscas({ C, V, estilos, p, departamentos, departamento, aoEscolherDepartamento }) {
  const prazo = lerPrazo(p.prazo);
  const limite = fraseDoLimite(prazo);
  const ICONES = { no_prazo: CircleCheck, atrasados: TriangleAlert, sem_acao: OctagonAlert };
  const CORES = { no_prazo: V.status.bom, atrasados: V.status.atencao, sem_acao: V.status.critico };
  const fPrazo = fatiasDoPrazo(prazo).map((f) => ({ ...f, cor: CORES[f.id], Icone: ICONES[f.id] }));
  const fSituacao = fatiasDaSituacao(p.total, p.so_meu).map((f) => ({ ...f, cor: V.situacao[f.id] }));

  // A COR DE CADA DEPARTAMENTO é a da posição dele na lista, e não a da fatia.
  const corDoDepartamento = (id) => {
    const i = departamentos.findIndex((d) => String(d.id) === String(id));
    return i < 0 ? V.outros : V.categorias[i % V.categorias.length];
  };
  const porDep = p.por_departamento || null;
  const fDeps = porDep ? fatiasDosDepartamentos(porDep).map((f) => ({ ...f, cor: f.outros || f.id == null ? V.outros : corDoDepartamento(f.id) })) : [];
  // A ROSCA DOS DEPARTAMENTOS só faz sentido com dois ou mais, e sem um
  // departamento escolhido na barra (com ele, ela seria uma fatia só).
  const mostrarDeps = !departamento && fDeps.length >= 2;

  const soma = (fs) => fs.reduce((n, f) => n + f.valor, 0);
  const cartoes = [];
  if (fPrazo.length) {
    cartoes.push(
      <CartaoDaRosca key="prazo" C={C} estilos={estilos} id="prazo" titulo="O prazo do período" fatias={fPrazo}
        centro={{ valor: porcento(prazo.pct), rotulo: "no prazo" }}
        colunas={["Desfecho", "Clientes", "Parte"]}
        linhas={[...fPrazo.map((f) => [f.nome, fmt(f.valor), porcento(f.valor / prazo.julgados)]),
                 ["Aguardando, ainda no prazo", fmt(prazo.aguardando), "—"]]}
        nota={<>{limite ? <>Prazo: {limite} de expediente, o da aba “Aviso de espera” de cada departamento. </> : null}
          {prazo.aguardando > 0
            ? <>E {fmt(prazo.aguardando)} {prazo.aguardando === 1 ? "cliente ainda está" : "clientes ainda estão"} dentro do prazo, sem resposta: {prazo.aguardando === 1 ? "fica" : "ficam"} fora da conta até o prazo vencer.</>
            : null}</>} />,
    );
  }
  if (fSituacao.length) {
    const total = soma(fSituacao);
    cartoes.push(
      <CartaoDaRosca key="situacao" C={C} estilos={estilos} id="situacao" titulo="Os protocolos do período" fatias={fSituacao}
        centro={{ valor: fmt(total), rotulo: total === 1 ? "protocolo" : "protocolos" }}
        colunas={["Situação", "Protocolos", "Parte"]}
        linhas={fSituacao.map((f) => [f.nome, fmt(f.valor), porcento(f.valor / total)])}
        nota={p.so_meu ? "Os de que a pessoa participou. Os que esperam resposta ainda não são de ninguém, e ficam de fora." : "Cada protocolo está em um, e num só."} />,
    );
  }
  if (mostrarDeps) {
    const total = soma(fDeps);
    cartoes.push(
      <CartaoDaRosca key="departamentos" C={C} estilos={estilos} id="departamentos" titulo="Protocolos por departamento" fatias={fDeps}
        centro={{ valor: fmt(total), rotulo: total === 1 ? "protocolo" : "protocolos" }}
        aoClicar={aoEscolherDepartamento}
        colunas={["Departamento", "Protocolos", "Sem resposta", "No prazo", "1ª resp. (exped.)"]}
        linhas={porDep.map((d) => {
          const pz = lerPrazo(d.prazo);
          return [d.nome || "(sem departamento)",
                  fmt(Number(d.atendimentos || 0) + Number(d.sem_resposta || 0)),
                  d.sem_resposta == null ? "—" : fmt(d.sem_resposta),
                  pz && pz.julgados ? `${porcento(pz.pct)} (${fmt(pz.noPrazo)} de ${fmt(pz.julgados)})` : "—",
                  tempoCurto(d.primeira_mediana_expediente)];
        })}
        nota={<>Os começados pela equipe e os que esperam resposta.{" "}
          {/* No papel não se clica: a frase do clique fica só na tela. */}
          <span data-nao-imprime>Clique num departamento para ver a tela inteira só dele; a tabela tem o prazo e o tempo de cada um.</span></>} />,
    );
  }
  if (!cartoes.length) return null;
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }} data-roscas>
      {cartoes}
    </div>
  );
}

function CartaoDaRosca({ C, estilos, id, titulo, fatias, centro, colunas, linhas, nota, aoClicar = null }) {
  const [sobre, setSobre] = useState(null);
  const total = fatias.reduce((n, f) => n + f.valor, 0);
  return (
    <Grafico C={C} estilos={estilos} legenda={null} titulo={titulo} atributos={{ "data-rosca": id, "data-bloco-de-impressao": "" }}
      colunas={colunas} linhas={linhas} vazio={!total} rodape={nota}
      desenho={() => (
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Rosca C={C} fatias={fatias} total={total} centro={centro} sobre={sobre} setSobre={setSobre} titulo={titulo} />
          <Legenda C={C} fatias={fatias} total={total} sobre={sobre} setSobre={setSobre} aoClicar={aoClicar} />
        </div>
      )} />
  );
}

/** A ROSCA, em SVG: um anel fino, com 2px da cor do cartão entre as fatias
 *  (é o respiro que separa uma da outra, e não uma borda), e o número do
 *  meio. Passando o mouse numa fatia — ou na linha dela, na legenda —, o meio
 *  diz o número dela, e as outras esmaecem. */
const chaveDe = (f) => (f.id != null ? String(f.id) : `outros:${f.nome}`);
function Rosca({ C, fatias, total, centro, sobre, setSobre, titulo, tamanho = 150, espessura = 20 }) {
  const r = (tamanho - espessura) / 2;
  const L = 2 * Math.PI * r;
  const visiveis = fatias.filter((f) => f.valor > 0);
  const respiro = visiveis.length > 1 ? 2 : 0;
  const atual = sobre != null ? fatias.find((f) => chaveDe(f) === sobre) : null;
  let andou = 0;
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho, flexShrink: 0, margin: "0 auto" }} data-desenho-da-rosca>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} role="img"
           aria-label={`${titulo}: ${fatias.map((f) => `${f.nome} ${fmt(f.valor)}`).join(", ")}`}
           style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={C.divider} strokeWidth={espessura} />
        {visiveis.map((f) => {
          const comprimento = (f.valor / total) * L;
          const traco = Math.max(0.6, comprimento - respiro);
          const k = chaveDe(f);
          const el = (
            <circle key={k} cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={f.cor} strokeWidth={espessura}
                    strokeDasharray={`${traco} ${L - traco}`} strokeDashoffset={-andou}
                    data-fatia={f.id != null ? String(f.id) : "outros"} data-valor={String(f.valor)}
                    onMouseEnter={() => setSobre(k)} onMouseLeave={() => setSobre(null)}
                    style={{ opacity: atual && chaveDe(atual) !== k ? 0.35 : 1, transition: "opacity .12s" }}>
              <title>{`${f.nome}: ${fmt(f.valor)} (${porcento(f.valor / total)})`}</title>
            </circle>
          );
          andou += comprimento;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", pointerEvents: "none", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.1, color: C.textPrimary }} data-centro-da-rosca>
          {atual ? fmt(atual.valor) : centro.valor}
        </div>
        <div style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.25, marginTop: 2,
                      maxWidth: tamanho - espessura * 2 - 12 }} data-rotulo-do-centro>
          {atual ? atual.nome : centro.rotulo}
        </div>
      </div>
    </div>
  );
}

/** A LEGENDA É A LEITURA EXATA: o nome, o número e a parte de cada fatia. Na
 *  rosca dos departamentos, cada linha é um botão que escolhe o departamento
 *  na barra do alto — é por ela que o teclado chega à rosca. */
function Legenda({ C, fatias, total, sobre, setSobre, aoClicar }) {
  return (
    <div style={{ flex: "1 1 210px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }} data-legenda-da-rosca>
      {fatias.map((f) => {
        const k = chaveDe(f);
        const clica = Boolean(aoClicar) && !f.outros && f.id != null;
        const Linha = clica ? "button" : "div";
        const Icone = f.Icone;
        return (
          <Linha key={k} type={clica ? "button" : undefined} data-linha-da-legenda={f.id != null ? String(f.id) : "outros"}
                 data-valor={String(f.valor)}
                 onClick={clica ? () => aoClicar(String(f.id)) : undefined}
                 onMouseEnter={() => setSobre(k)} onMouseLeave={() => setSobre(null)}
                 onFocus={clica ? () => setSobre(k) : undefined} onBlur={clica ? () => setSobre(null) : undefined}
                 title={clica ? `Ver só ${f.nome}` : f.ajuda || undefined}
                 aria-label={clica ? `${f.nome}: ${fmt(f.valor)} (${porcento(total ? f.valor / total : 0)}). Ver só este departamento.` : undefined}
                 style={{ font: "inherit", display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 30,
                          boxSizing: "border-box", padding: "4px 6px", border: "none", borderRadius: 8, textAlign: "left",
                          background: sobre === k ? C.listActive : "transparent", color: C.textPrimary,
                          cursor: clica ? "pointer" : "default" }}>
            {Icone
              ? <Icone size={14} color={f.cor} style={{ flexShrink: 0 }} aria-hidden="true" />
              : <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: f.cor, flexShrink: 0 }} />}
            <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.nome}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(f.valor)}</span>
            <span style={{ fontSize: 12, color: C.textSecondary, minWidth: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {porcento(total ? f.valor / total : 0)}
            </span>
          </Linha>
        );
      })}
    </div>
  );
}
