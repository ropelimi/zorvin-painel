import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, RefreshCw, Hourglass, MessageCircle, AlertCircle, ChevronDown, Check, Users, UserCheck, Tag, Phone,
         Building2, FilterX } from "lucide-react";
import { nomeDoContato } from "./contato.js";
import { telefoneLegivel } from "./numeros.js";
import { rotuloDaHora } from "./agenda.js";
import { diasDesde, DIAS_DO_VERMELHO } from "./espera.js";
import { rotuloDosMinutos, fraseDoLimite, HA_DIAS_OU_MAIS } from "./esperandoDemais.js";
import { FILTROS_DE_SEMPRE, TODOS_OS_RESPONSAVEIS, SEM_RESPONSAVEL, arrumarFiltros, filtrosMudaram, chaveDosFiltros,
         chaveDasEtiquetas, passaNosFiltros, telefonesOferecidos, comOsDepartamentos, rotuloDaLista, rotuloDoResponsavel,
         tituloDasQueEsperam, fraseDoResponsavelSemResposta, fraseDasQueEsperam } from "./filtrosDaEspera.js";
import { primeiroNome } from "./responsaveisDaLista.js";
import { podeSerEscolhida } from "./quemSaiu.js";
import { encaixarNaJanela } from "./encaixarNaJanela.js";
import CampoDePesquisa, { ComPesquisa } from "./CampoDePesquisa.jsx";
import { PESQUISA_A_PARTIR_DE, casaComAPesquisa, nadaComAPesquisa } from "./pesquisaNosMenus.js";

// ============================================================
//  A TELA "ESPERANDO RESPOSTA" (31/10)
//
//  Aberta pelo ampulheta da barra lateral, pelo ⋮ do topo e pelo "Ver quais"
//  do resumo que aparece ao abrir o Zorvin. Ver "Quem está esperando demais"
//  no CLAUDE.md.
//
//  DUAS PERGUNTAS, e por isso duas ABAS (eram duas seções, uma embaixo da
//  outra, até 02/11 — ver "As duas abas da tela Esperando resposta"):
//
//    - "Clientes sem resposta" — quem escreveu e ainda não recebeu NENHUMA
//      resposta, além do tempo do departamento (30 minutos de expediente, se
//      ninguém mudou). É o cliente novo esperando a primeira palavra;
//    - "Suas conversas esperando há 2 dias ou mais" — as conversas em que
//      VOCÊ é o responsável e o cliente espera há 2 dias de calendário ou
//      mais. Eram 3 até 02/11, a régua do vermelho da lista; o número mora
//      em `DIAS_DAS_ATRASADAS` (`esperandoDemais.js`), e as frases daqui saem
//      dele.
//
//  OS DADOS SÃO DO PAINEL, e esta tela só desenha: o número da barra, o
//  resumo e esta lista têm de dizer a mesma coisa, e três leituras
//  discordariam na hora errada.
//
//  O QUE NÃO VEIO É DITO, e nunca vira "ninguém esperando" — a armadilha nº 2.
//  "Nenhum cliente sem resposta" no lugar de "não consegui ler" faria a
//  pessoa ir embora achando que a fila está em dia.
//
//  OS FILTROS (05/11): responsável, etiquetas, telefones e departamentos,
//  numa barra ACIMA das abas — eles recortam as duas, e o número de cada aba
//  é o do recorte. As contas moram em `filtrosDaEspera.js`. O padrão do
//  responsável é "as suas", o que a tela mostrava antes, e não "todos": é o
//  que a ampulheta e o resumo do alto contam.
// ============================================================

/** EM QUAL ABA A TELA ABRE: na primeira que tem o que mostrar.
 *
 *  Os clientes sem resposta vêm primeiro, porque são o que pede ação agora
 *  (é deles o vermelho do número da barra). Se não há nenhum, a tela abre nas
 *  suas conversas, quando há alguma. E A FALHA CONTA COMO TER O QUE MOSTRAR: a
 *  aba que não carregou abre dizendo isso, em vez de a tela abrir na outra e a
 *  falha ficar escondida atrás de um clique.
 *
 *  `null` é "ainda não dá para saber": uma das leituras não chegou. A tela
 *  mostra a primeira aba enquanto isso, e decide quando as respostas chegarem
 *  — se ninguém tiver escolhido uma aba antes. Decidir antes erraria do jeito
 *  que importa: com as suas conversas lidas e os clientes ainda a caminho, a
 *  tela abriria nas suas conversas e esconderia o cliente sem resposta.
 *
 *  `temAvisoDeEspera` tem três estados (a régua de `temVantoro.js`): `null` é
 *  "ainda não sei se o recurso existe", e conta como uma leitura a caminho. */
export function abaDeComeco({ temAvisoDeEspera, semResposta, nSemResposta, podeContarAtrasadas, atrasadas, nAtrasadas }) {
  const temSR = temAvisoDeEspera === true;
  const temAT = Boolean(podeContarAtrasadas);
  const srProntos = temAvisoDeEspera === false || (temSR && Boolean(semResposta?.erro || semResposta?.lido));
  // `podeContarAtrasadas` NULO É "AINDA NÃO SEI" (02/11), como o
  // `temAvisoDeEspera`: a tela que abre numa guia nova nasce antes de a lista
  // de conversas dizer se o banco tem a espera e o responsável, e "não tenho"
  // ali abriria a tela nos clientes e esconderia as suas conversas.
  const atProntas = podeContarAtrasadas === null ? false : !temAT || Boolean(atrasadas?.erro || atrasadas?.lido);
  const srTem = temSR && Boolean(semResposta?.erro || nSemResposta > 0);
  const atTem = temAT && Boolean(atrasadas?.erro || nAtrasadas > 0);
  if (srTem) return "sem-resposta";
  if (!srProntos) return null;
  if (atTem) return "atrasadas";
  if (!atProntas) return null;
  return temSR ? "sem-resposta" : temAT ? "atrasadas" : null;
}

// ------------------------------------------------------------
//  A BARRA DOS FILTROS (05/11)
//
//  Uma pílula por filtro, que abre o menu dele. MARCAR NÃO FECHA O MENU:
//  escolher várias é o comum ("Jenifer e Ivone"). "As suas" e "Todos os
//  responsáveis" fecham, como o "Todos os responsáveis" do seletor da lista.
//  Fecha com o Esc (o primeiro Esc apaga a pesquisa, se houver) e com o
//  clique fora. A pílula que recorta fora do padrão fica verde cheia, a régua
//  da fita de filtros da lista.
//
//  SÓ APARECE O FILTRO QUE TEM O QUE ESCOLHER: o de telefones com um telefone
//  só, ou o de departamentos com um só, seria uma pílula que não muda nada.
//  E o do responsável só com a coluna do responsável (008).
// ------------------------------------------------------------
function BarraDeFiltros({ C, estreito, filtros, aoMudar, meuId, pessoas, nomeDaPessoa, temResponsavel,
                          etiquetas, telefones, departamentos }) {
  const [aberto, setAberto] = useState(null);
  const barraRef = useRef(null);
  const f = arrumarFiltros(filtros);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (barraRef.current && !barraRef.current.contains(e.target)) setAberto(null); };
    const esc = (e) => { if (e.key === "Escape") setAberto(null); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      window.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const nomeDe = (id) => (nomeDaPessoa ? nomeDaPessoa(id) : "") || "";
  const escolhidos = Array.isArray(f.responsaveis) ? f.responsaveis : [];
  const gente = (pessoas || [])
    .filter((p) => p && p.nome && (podeSerEscolhida(p) || escolhidos.includes(String(p.id))))
    .sort((a, b) => {
      if (meuId && String(a.id) === String(meuId)) return -1;
      if (meuId && String(b.id) === String(meuId)) return 1;
      return String(a.nome).localeCompare(String(b.nome), "pt-BR");
    });
  const tags = (etiquetas || []).filter((t) => t && t.id != null);
  const tels = telefones || [];
  const telsComDep = new Set(tels.map((t) => String(t.departamento_id ?? "")));
  const deps = (departamentos || []).filter((d) => d && telsComDep.has(String(d.id)));
  const oferecidos = telefonesOferecidos(f, tels);
  const nomeDoDep = (id) => (deps.find((d) => String(d.id) === String(id)) || {}).nome || "";

  const mostraResponsavel = Boolean(temResponsavel);
  const mostraEtiquetas = tags.length > 0;
  const mostraTelefones = tels.length > 1;
  const mostraDepartamentos = deps.length > 1;
  if (!mostraResponsavel && !mostraEtiquetas && !mostraTelefones && !mostraDepartamentos) return null;

  const alternar = (lista, id) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const mudar = (novo) => aoMudar(arrumarFiltros({ ...f, ...novo }));

  const ITEM = { width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", border: "none",
                 background: "transparent", cursor: "pointer", color: C.textPrimary, fontSize: 13.5, textAlign: "left",
                 minHeight: estreito ? 44 : 36, boxSizing: "border-box" };
  const caixa = (sim) => (
    <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                   border: `1.5px solid ${sim ? C.green : C.divider}`, background: sim ? C.green : "transparent" }}>
      {sim && <Check size={12} color="#fff" />}
    </span>
  );
  const pilula = (id, Icone, rotulo, ativo, titulo) => (
    <button type="button" data-filtro-da-espera={id} data-filtro-ativo={ativo ? "sim" : undefined}
            aria-haspopup="listbox" aria-expanded={aberto === id} aria-label={rotulo} title={titulo || rotulo}
            onClick={() => setAberto((a) => (a === id ? null : id))}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
                     padding: "5px 9px 5px 10px", borderRadius: 16, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                     border: `1px solid ${ativo ? C.greenDark : C.divider}`, background: ativo ? C.greenDark : C.panel,
                     color: ativo ? "#fff" : C.textPrimary }}>
      <Icone size={14} style={{ flexShrink: 0 }} />
      <span data-rotulo-do-filtro style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotulo}</span>
      <ChevronDown size={14} style={{ flexShrink: 0, transform: aberto === id ? "rotate(180deg)" : "none", transition: "transform .12s" }} />
    </button>
  );
  const menu = (id, titulo, rotuloDaPesquisa, quantos, corpo) => aberto === id && (
    <ComPesquisa>{(pesquisa, setPesquisa) => {
      const comPesquisa = quantos >= PESQUISA_A_PARTIR_DE;
      return (
        <div data-menu-do-filtro={id} role="listbox" aria-multiselectable="true" ref={encaixarNaJanela}
             style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, width: 280,
                      maxWidth: "calc(100vw - 16px)", maxHeight: 380, overflowY: "auto", fontWeight: 400,
                      background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 10,
                      boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>
          <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${C.divider}`, position: "sticky", top: 0, zIndex: 1, background: C.panel }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.3 }}>{titulo}</div>
            {comPesquisa && (
              <div style={{ marginTop: 8 }}>
                <CampoDePesquisa C={C} valor={pesquisa} aoMudar={setPesquisa} rotulo={rotuloDaPesquisa}
                                 focar={!estreito} nome={`filtro-${id}`} />
              </div>
            )}
          </div>
          {corpo(comPesquisa ? pesquisa : "")}
        </div>
      );
    }}</ComPesquisa>
  );
  const nada = (oQue, pesquisa) => (
    <div data-nada-com-a-pesquisa style={{ padding: "14px 12px", fontSize: 13, color: C.textSecondary, textAlign: "center" }}>
      {nadaComAPesquisa(oQue, pesquisa)}
    </div>
  );

  const responsavel = mostraResponsavel && (
    <span style={{ position: "relative", display: "inline-flex", maxWidth: "100%", minWidth: 0 }}>
      {pilula("responsavel", UserCheck, `Responsável: ${rotuloDoResponsavel(f, nomeDe, meuId)}`, f.responsaveis !== null,
              f.responsaveis === null ? "As suas: os clientes sem resposta que são seus ou de ninguém, e as conversas em que você é o responsável" : undefined)}
      {menu("responsavel", "MOSTRAR AS DE", "Pesquisar pessoa", gente.length + 1, (pesquisa) => {
        const achadas = gente.filter((p) => casaComAPesquisa(pesquisa, p.nome));
        const semAparece = casaComAPesquisa(pesquisa, "Sem responsável");
        return (<>
          <button type="button" role="option" data-opcao-do-filtro="suas" aria-selected={f.responsaveis === null}
                  onClick={() => { mudar({ responsaveis: null }); setAberto(null); }}
                  style={{ ...ITEM, alignItems: "flex-start" }}>
            <UserCheck size={16} color={C.textSecondary} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600 }}>As suas</span>
              <span style={{ display: "block", fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 1.35 }}>
                O padrão: os clientes sem resposta que são seus ou de ninguém, e as conversas em que você é o responsável.
              </span>
            </span>
            {f.responsaveis === null && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
          </button>
          <button type="button" role="option" data-opcao-do-filtro={TODOS_OS_RESPONSAVEIS} aria-selected={f.responsaveis === TODOS_OS_RESPONSAVEIS}
                  onClick={() => { mudar({ responsaveis: TODOS_OS_RESPONSAVEIS }); setAberto(null); }}
                  style={{ ...ITEM, fontWeight: 600, borderBottom: `1px solid ${C.divider}` }}>
            <Users size={16} color={C.textSecondary} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Todos os responsáveis</span>
            {f.responsaveis === TODOS_OS_RESPONSAVEIS && <Check size={16} color={C.green} style={{ flexShrink: 0 }} />}
          </button>
          {semAparece && (
            <button type="button" role="option" data-opcao-do-filtro={SEM_RESPONSAVEL} aria-selected={escolhidos.includes(SEM_RESPONSAVEL)}
                    onClick={() => mudar({ responsaveis: alternar(escolhidos, SEM_RESPONSAVEL) })} style={ITEM}>
              {caixa(escolhidos.includes(SEM_RESPONSAVEL))}
              <span style={{ flex: 1, minWidth: 0 }}>Sem responsável</span>
            </button>
          )}
          {achadas.map((p) => {
            const id = String(p.id);
            const sim = escolhidos.includes(id);
            return (
              <button key={id} type="button" role="option" data-opcao-do-filtro={id} aria-selected={sim}
                      onClick={() => mudar({ responsaveis: alternar(escolhidos, id) })} style={ITEM}>
                {caixa(sim)}
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.nome}{meuId && id === String(meuId) ? " (você)" : ""}
                </span>
              </button>
            );
          })}
          {!achadas.length && !semAparece && nada("Ninguém", pesquisa)}
        </>);
      })}
    </span>
  );

  const etiquetasDoFiltro = mostraEtiquetas && (
    <span style={{ position: "relative", display: "inline-flex", maxWidth: "100%", minWidth: 0 }}>
      {pilula("etiquetas", Tag, rotuloDaLista(f.etiquetas, tags, "Etiquetas"), f.etiquetas.length > 0,
              f.etiquetas.length > 1 ? "As conversas com qualquer uma das etiquetas escolhidas" : undefined)}
      {menu("etiquetas", "COM QUALQUER UMA DAS ETIQUETAS", "Pesquisar etiqueta", tags.length, (pesquisa) => {
        const achadas = tags.filter((t) => casaComAPesquisa(pesquisa, t.nome));
        return (<>
          {achadas.map((t) => {
            const id = String(t.id);
            const sim = f.etiquetas.includes(id);
            return (
              <button key={id} type="button" role="option" data-opcao-do-filtro={id} aria-selected={sim}
                      onClick={() => mudar({ etiquetas: alternar(f.etiquetas, id) })} style={ITEM}>
                {caixa(sim)}
                <span style={{ width: 12, height: 12, borderRadius: 3, background: t.cor || C.divider, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</span>
              </button>
            );
          })}
          {!achadas.length && nada("Nenhuma etiqueta", pesquisa)}
        </>);
      })}
    </span>
  );

  const telefonesDoFiltro = mostraTelefones && (
    <span style={{ position: "relative", display: "inline-flex", maxWidth: "100%", minWidth: 0 }}>
      {pilula("telefones", Phone, rotuloDaLista(f.telefones, oferecidos, "Telefones"), f.telefones.length > 0)}
      {menu("telefones", f.departamentos.length ? "TELEFONES DOS DEPARTAMENTOS ESCOLHIDOS" : "TELEFONES", "Pesquisar telefone",
            oferecidos.length, (pesquisa) => {
        const achados = oferecidos.filter((t) => casaComAPesquisa(pesquisa, t.nome, nomeDoDep(t.departamento_id)));
        return (<>
          {achados.map((t) => {
            const id = String(t.id);
            const sim = f.telefones.includes(id);
            const dep = nomeDoDep(t.departamento_id);
            return (
              <button key={id} type="button" role="option" data-opcao-do-filtro={id} aria-selected={sim}
                      onClick={() => mudar({ telefones: alternar(f.telefones, id) })} style={ITEM}>
                {caixa(sim)}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</span>
                  {dep && <span style={{ display: "block", fontSize: 11.5, color: C.textSecondary }}>{dep}</span>}
                </span>
              </button>
            );
          })}
          {!achados.length && nada("Nenhum telefone", pesquisa)}
        </>);
      })}
    </span>
  );

  const departamentosDoFiltro = mostraDepartamentos && (
    <span style={{ position: "relative", display: "inline-flex", maxWidth: "100%", minWidth: 0 }}>
      {pilula("departamentos", Building2, rotuloDaLista(f.departamentos, deps, "Departamentos"), f.departamentos.length > 0)}
      {menu("departamentos", "DEPARTAMENTOS", "Pesquisar departamento", deps.length, (pesquisa) => {
        const achados = deps.filter((d) => casaComAPesquisa(pesquisa, d.nome));
        return (<>
          {achados.map((d) => {
            const id = String(d.id);
            const sim = f.departamentos.includes(id);
            return (
              <button key={id} type="button" role="option" data-opcao-do-filtro={id} aria-selected={sim}
                      onClick={() => aoMudar(comOsDepartamentos(f, alternar(f.departamentos, id), tels))} style={ITEM}>
                {caixa(sim)}
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</span>
              </button>
            );
          })}
          {!achados.length && nada("Nenhum departamento", pesquisa)}
        </>);
      })}
    </span>
  );

  return (
    <div ref={barraRef} data-filtros-da-espera role="group" aria-label="Filtros"
         style={{ maxWidth: 760, margin: "0 auto", padding: "10px 16px 4px", boxSizing: "border-box",
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {responsavel}
      {etiquetasDoFiltro}
      {telefonesDoFiltro}
      {departamentosDoFiltro}
      {filtrosMudaram(f) && (
        <button type="button" data-limpar-filtros-da-espera onClick={() => { aoMudar(FILTROS_DE_SEMPRE); setAberto(null); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent",
                         color: C.verdeTexto || C.green, cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "5px 6px" }}>
          <FilterX size={14} /> Limpar os filtros
        </button>
      )}
    </div>
  );
}

export default function Esperando({
  C, meuId, advogados = [], semResposta, temAvisoDeEspera, atrasadas, podeContarAtrasadas,
  filtros = FILTROS_DE_SEMPRE, aoMudarFiltros, etiquetasDaEspera, temResponsavel = false, pessoas = [], nomeDaPessoa,
  etiquetas = [], departamentos = [], estreito = false,
  aoAbrirConversa, aoAtualizar, aoFechar,
}) {
  const advPorId = useMemo(() => Object.fromEntries(advogados.map((a) => [String(a.id), a])), [advogados]);
  const agora = new Date();
  // O RECORTE DOS FILTROS (05/11) — ver `filtrosDaEspera.js`. No padrão
  // ("as suas"), as duas listas são as de sempre: os clientes sem resposta
  // que são seus ou de ninguém, e as conversas em que você é o responsável.
  //
  // AS ETIQUETAS VÊM DO BANCO numa pergunta própria, e a lista só se recorta
  // com a resposta das etiquetas DE AGORA: com a de antes, ela mostraria por
  // um instante as conversas da etiqueta que acabou de ser desmarcada. E AS
  // CONVERSAS QUE ESPERAM TAMBÉM: a resposta diz de quais filtros ela é
  // (`chave`), e a de outros filtros não é desenhada — trocar o filtro diz
  // "Procurando…", e não a lista de antes com cara de nova.
  const f = arrumarFiltros(filtros);
  const chave = chaveDosFiltros(f);
  const mudados = filtrosMudaram(f);
  const comEtiquetas = f.etiquetas.length > 0;
  const etiquetasProntas = !comEtiquetas || (etiquetasDaEspera?.chave === chaveDasEtiquetas(f) && Boolean(etiquetasDaEspera?.lido));
  const erroDasEtiquetas = comEtiquetas && etiquetasProntas ? (etiquetasDaEspera?.erro || "") : "";
  const recorte = { meuId, advogados, idsDasEtiquetas: etiquetasDaEspera?.ids };
  const srProntos = Boolean(semResposta?.lido) && !semResposta?.erro && etiquetasProntas && !erroDasEtiquetas;
  const meusSemResposta = !srProntos ? []
    : (semResposta?.linhas || []).filter((l) => passaNosFiltros(l, f, { ...recorte, aba: "sem-resposta" }));
  const atProntas = atrasadas?.chave === chave && etiquetasProntas;
  const minhas = !atProntas ? []
    : (atrasadas?.linhas || []).filter((l) => passaNosFiltros(l, f, { ...recorte, aba: "atrasadas" }));
  const nomeDe = (id) => (nomeDaPessoa ? nomeDaPessoa(id) : "") || "";
  // QUEM É O RESPONSÁVEL, escrito na linha quando a tela mostra as de outras
  // pessoas: no padrão as linhas são suas (ou de ninguém), e repetir "com
  // você" em todas seria ruído.
  const comQuem = (l) => {
    if (!l.responsavel_id) return "sem responsável";
    if (f.responsaveis === null) return "";
    if (meuId && String(l.responsavel_id) === String(meuId)) return "com você";
    return `com ${primeiroNome(nomeDe(l.responsavel_id)) || "alguém da equipe"}`;
  };

  // AS ABAS. O número de cada uma só aparece com a leitura feita: "0"
  // enquanto ela vem, ou depois de ela falhar, diria que não há ninguém.
  //
  // E A ABA APARECE ENQUANTO NÃO SE SABE (02/11). Numa guia nova a tela nasce
  // antes de saber se o banco tem a função dos clientes e a espera das suas
  // conversas, e a aba que chegasse um segundo depois empurraria a outra — a
  // fileira pulando debaixo do dedo de quem já ia clicar. Aberta enquanto não
  // se sabe, ela diz "Procurando…". Só some a aba do que este banco NÃO tem.
  const abas = [
    temAvisoDeEspera !== false && {
      id: "sem-resposta", titulo: "Clientes sem resposta", forte: "#e53935", texto: C.erroTexto || "#e53935",
      falhou: Boolean(semResposta?.erro || erroDasEtiquetas), n: srProntos ? meusSemResposta.length : null,
    },
    podeContarAtrasadas !== false && {
      id: "atrasadas", titulo: tituloDasQueEsperam(f, HA_DIAS_OU_MAIS, meuId), forte: "#d99a1e", texto: C.ambarTexto || "#d99a1e",
      falhou: Boolean(atrasadas?.chave === chave && atrasadas?.erro),
      n: atProntas && atrasadas?.lido && !atrasadas?.erro ? minhas.length : null,
    },
  ].filter(Boolean);

  // A ABA ESCOLHIDA: a de começo (ver `abaDeComeco`), ou a que a pessoa
  // clicou. Decidida, ela não muda sozinha: uma lista que esvazia na leitura
  // de minuto em minuto não pode tirar a pessoa da aba em que ela está.
  const dados = { temAvisoDeEspera, semResposta, nSemResposta: meusSemResposta.length,
                  podeContarAtrasadas, atrasadas, nAtrasadas: minhas.length };
  const [escolhida, setEscolhida] = useState(() => abaDeComeco(dados));
  const decidida = abaDeComeco(dados);
  useEffect(() => {
    if (escolhida == null && decidida) setEscolhida(decidida);
  }, [escolhida, decidida]);
  const ativa = abas.some((a) => a.id === escolhida) ? escolhida : abas[0]?.id;

  // AS SETAS DO TECLADO andam entre as abas, como em qualquer fileira de abas.
  const andarComAsSetas = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = abas.findIndex((a) => a.id === ativa);
    if (i < 0) return;
    const proxima = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
    e.preventDefault();
    setEscolhida(proxima.id);
    const el = document.getElementById(`aba-espera-${proxima.id}`);
    if (el) el.focus();
  };

  const painel = (id, filhos) => (
    <section role="tabpanel" id={`painel-espera-${id}`} aria-labelledby={`aba-espera-${id}`} data-secao-da-espera={id}
             style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden" }}>
      {filhos}
    </section>
  );
  const nota = (texto, extra = {}) => (
    <div style={{ padding: "10px 12px", fontSize: 13, color: C.textSecondary, lineHeight: 1.5, background: C.panel, ...extra }}>
      {texto}
    </div>
  );
  const falha = (attr, texto) => (
    <div {...{ [attr]: "" }} role="alert"
         style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", fontSize: 13.5,
                  background: "rgba(229,57,53,.10)", color: C.textPrimary, lineHeight: 1.45 }}>
      <AlertCircle size={17} color="#e53935" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{texto}</span>
      <button onClick={aoAtualizar} style={{ border: "none", background: "transparent", color: C.verdeTexto || C.green,
                                             cursor: "pointer", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
        Tentar de novo
      </button>
    </div>
  );
  // A LISTA VAZIA COM FILTROS diz que é o recorte, e oferece desfazê-lo: sem
  // isso, "nenhum cliente" se leria como "a fila está em dia".
  const vaziaComFiltros = (texto) => (
    <div data-espera-vazia-com-filtros
         style={{ padding: "10px 12px", fontSize: 13, color: C.textSecondary, lineHeight: 1.5, background: C.panel,
                  borderTop: `1px solid ${C.divider}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px" }}>
      <span style={{ flex: "1 1 220px" }}>{texto}</span>
      <button type="button" data-limpar-filtros-da-lista-vazia onClick={() => aoMudarFiltros && aoMudarFiltros(FILTROS_DE_SEMPRE)}
              style={{ border: "none", background: "transparent", color: C.verdeTexto || C.green, cursor: "pointer",
                       fontWeight: 600, fontSize: 13, padding: "4px 0" }}>
        Limpar os filtros
      </button>
    </div>
  );
  const linha = (key, attrs, cv, contato, detalhe, corDetalhe, marca) => {
    const cliente = contato ? nomeDoContato(contato) || telefoneLegivel(contato.numero) : "Cliente";
    const tel = advPorId[String(cv.advogado_id)];
    return (
      <button key={key} type="button" {...attrs} onClick={() => aoAbrirConversa && aoAbrirConversa(cv)}
              title="Abrir a conversa"
              style={{ all: "unset", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 10,
                       width: "100%", padding: "10px 12px", borderTop: `1px solid ${C.divider}`, background: C.panel,
                       cursor: "pointer" }}>
        <MessageCircle size={18} color={C.textSecondary} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span data-cliente-que-espera style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.textPrimary,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cliente}</span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 3, fontSize: 12, color: C.textSecondary }}>
            {tel && <span>{tel.nome}</span>}
            <span data-detalhe-da-espera style={{ color: corDetalhe, fontWeight: 600 }}>{tel ? "· " : ""}{detalhe}</span>
            {marca && <span>· {marca}</span>}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div data-tela="esperando" style={{ position: "fixed", inset: 0, zIndex: 200, background: C.bg || C.headerBar,
                                        display: "flex", flexDirection: "column", color: C.textPrimary }}>
      <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}`, padding: "10px 16px",
                    display: "flex", alignItems: "center", gap: 14 }}>
        {/* A TELA É UMA GUIA (02/11): o botão fecha a guia, e o navegador volta
            para a das conversas. Era a seta "Voltar", de quando a tela abria por
            cima delas. */}
        <button onClick={aoFechar} title="Fechar esta guia" aria-label="Fechar esta guia" data-fechar-a-guia
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <X size={20} color={C.textSecondary} />
        </button>
        <Hourglass size={20} color={C.green} />
        <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Esperando resposta</span>
        <button data-atualizar-espera onClick={aoAtualizar} title="Atualizar" aria-label="Atualizar"
                style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 6, borderRadius: "50%" }}>
          <RefreshCw size={18} color={C.textSecondary} />
        </button>
      </div>

      {/* OS FILTROS (05/11), acima das abas: eles recortam as duas, e o número
          de cada aba é o do recorte. Fora da parte que rola, como as abas. */}
      <div style={{ background: C.headerBar }}>
        <BarraDeFiltros C={C} estreito={estreito} filtros={f} aoMudar={(novo) => aoMudarFiltros && aoMudarFiltros(novo)}
                        meuId={meuId} pessoas={pessoas} nomeDaPessoa={nomeDaPessoa}
                        temResponsavel={temResponsavel}
                        etiquetas={etiquetas} telefones={advogados} departamentos={departamentos} />
      </div>

      {/* AS ABAS (02/11), fora da parte que rola: a lista de um dia cheio passa
          da altura da tela, e a outra aba tem de continuar a um clique.
          Cada aba diz quantos há nela, para a pessoa saber, sem clicar, se a
          outra tem alguém. E o nome não é cortado: no celular ele quebra em
          linhas (três, a 360), e a aba cresce. */}
      {abas.length > 0 && (
        <div style={{ background: C.headerBar, borderBottom: `1px solid ${C.divider}` }}>
          <div data-abas-da-espera role="tablist" aria-label="O que está esperando resposta" onKeyDown={andarComAsSetas}
               style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", display: "flex", gap: 6 }}>
            {abas.map((a) => {
              const sel = a.id === ativa;
              return (
                <button key={a.id} type="button" role="tab" id={`aba-espera-${a.id}`} aria-selected={sel}
                        aria-controls={`painel-espera-${a.id}`} tabIndex={sel ? 0 : -1}
                        data-aba-da-espera={a.id} data-aba-ativa={sel ? "sim" : undefined}
                        onClick={() => setEscolhida(a.id)}
                        style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                 gap: 8, border: "none", borderBottom: `3px solid ${sel ? a.forte : "transparent"}`,
                                 background: "transparent", color: sel ? a.texto : C.textSecondary, fontSize: 12.5,
                                 fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.3, textAlign: "center",
                                 padding: "11px 4px 8px", marginBottom: -1, cursor: sel ? "default" : "pointer" }}>
                  <span data-nome-da-aba-da-espera style={{ minWidth: 0 }}>{a.titulo.toUpperCase()}</span>
                  {a.falhou ? (
                    <AlertCircle data-aba-da-espera-falhou size={16} color="#e53935" style={{ flexShrink: 0 }}
                                 aria-label="não carregou" />
                  ) : a.n != null && (
                    <span data-contagem-da-espera={a.n}
                          style={{ flexShrink: 0, minWidth: 22, height: 20, padding: "0 6px", borderRadius: 10, boxSizing: "border-box",
                                   display: "inline-flex", alignItems: "center", justifyContent: "center",
                                   fontSize: 11.5, fontWeight: 700, letterSpacing: 0,
                                   background: a.n > 0 ? a.forte : C.divider, color: a.n > 0 ? "#fff" : C.textSecondary }}>
                      {a.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* A CHAVE É A ABA: trocar de aba começa a lista do alto, e não da
          altura em que a outra estava rolada. */}
      <div key={ativa || "nenhuma"} style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 16px 40px" }}>
          {ativa === "sem-resposta" && painel("sem-resposta", <>
              {nota(<>Quem escreveu e ainda não recebeu <b>nenhuma</b> resposta, {meusSemResposta.length
                ? fraseDoLimite(meusSemResposta) : "além do tempo do departamento"} de expediente. {fraseDoResponsavelSemResposta(f, nomeDe, meuId)}</>,
                { borderBottom: "none" })}
              {semResposta?.erro ? falha("data-espera-falhou-sem-resposta", semResposta.erro)
                : erroDasEtiquetas ? falha("data-espera-falhou-etiquetas", erroDasEtiquetas)
                : !srProntos ? nota("Procurando…")
                : meusSemResposta.length === 0 ? (mudados
                  ? vaziaComFiltros("Nenhum cliente sem resposta além do tempo combinado, com estes filtros.")
                  : nota("Nenhum cliente sem resposta além do tempo combinado.", { borderTop: `1px solid ${C.divider}` }))
                : meusSemResposta.map((l) => {
                    const quem = comQuem(l);
                    return linha(`sr-${l.conversa_id}`, { "data-sem-resposta-linha": l.conversa_id },
                      { id: l.conversa_id, advogado_id: l.advogado_id }, l.contato,
                      `sem resposta há ${rotuloDosMinutos(l.minutos)} de expediente`, "#e53935",
                      `escreveu ${rotuloDaHora(l.aberto_em, agora)}${quem ? ` · ${quem}` : ""}`);
                  })}
            </>)}

          {ativa === "atrasadas" && painel("atrasadas", <>
              {nota(fraseDasQueEsperam(f, nomeDe, meuId, HA_DIAS_OU_MAIS))}
              {atrasadas?.chave === chave && atrasadas?.erro ? falha("data-espera-falhou-atrasadas", atrasadas.erro)
                : !atProntas || !atrasadas?.lido ? nota("Procurando…")
                : minhas.length === 0 ? (mudados
                  ? vaziaComFiltros(`Nenhuma conversa esperando ${HA_DIAS_OU_MAIS}, com estes filtros.`)
                  : nota(`Nenhuma conversa sua esperando ${HA_DIAS_OU_MAIS}.`, { borderTop: `1px solid ${C.divider}` }))
                : minhas.map((cv) => {
                    const d = diasDesde(cv.esperando_desde);
                    // A COR É A DO RÓTULO DA LISTA (02/11): âmbar com 2 dias,
                    // vermelho a partir de 3 (`DIAS_DO_VERMELHO`). Com os 3 dias
                    // da aba, toda linha daqui era vermelha; com os 2, a de 2
                    // dias seria vermelha aqui e âmbar na lista.
                    return linha(`at-${cv.id}`, { "data-atrasada-linha": cv.id }, cv, cv.contato,
                      `esperando há ${d} dia${d === 1 ? "" : "s"}`,
                      d >= DIAS_DO_VERMELHO ? "#e53935" : (C.ambarTexto || "#d99a1e"), comQuem(cv) || null);
                  })}
              {atProntas && atrasadas?.cortado && nota(`Mostrando as ${minhas.length} que esperam há mais tempo.`, { borderTop: `1px solid ${C.divider}` })}
            </>)}

          {abas.length === 0 && (
            <div data-espera-sem-recurso style={{ fontSize: 14, color: C.textSecondary, padding: 16 }}>
              Esta contagem ainda não está instalada neste banco.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
