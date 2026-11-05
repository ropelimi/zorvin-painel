// ============================================================
//  OS FILTROS DA TELA "ESPERANDO RESPOSTA" (05/11)
//
//  Pedido do Rodrigo: "Na tela de 'Esperando resposta' eu preciso ter um
//  filtro de responsável, também filtro de etiquetas, telefones e
//  departamentos."
//
//  AS CONTAS QUE NÃO PRECISAM DE TELA, num lugar só: o que a lista mostra, o
//  número de cada aba, a pergunta ao banco e o que cada filtro escreve saem
//  daqui. Escrita em cada um, a regra divergiria no primeiro conserto — e
//  divergir aqui é a aba dizer um número e a lista mostrar outra coisa.
//
//  OS QUATRO FILTROS SOMAM ("e"), e dentro de cada um vale qualquer das
//  escolhas ("ou"): Jenifer ou Ivone, no SAC, com a etiqueta Urgente.
// ============================================================
import { SEM_RESPONSAVEL, passaNosResponsaveis, recortarPelosResponsaveis, rotuloDosResponsaveis,
         fraseDosResponsaveis } from "./responsaveisDaLista.js";

export { SEM_RESPONSAVEL };

/** "De qualquer responsável, e as sem responsável." */
export const TODOS_OS_RESPONSAVEIS = "todos";

/** O RESPONSÁVEL TEM TRÊS FORMAS, e o padrão não é "todos":
 *
 *  - `null`, AS SUAS — o que a tela mostrava antes dos filtros, e o que o
 *    número da ampulheta e o resumo do alto contam. Clientes sem resposta: os
 *    seus e os sem responsável (a régua do aviso, `ehParaMim`); conversas que
 *    esperam: as suas. Abrir a tela com "todos" faria a aba dizer um número e
 *    a ampulheta outro;
 *  - `TODOS_OS_RESPONSAVEIS`: de qualquer responsável, e as sem responsável;
 *  - uma lista: as pessoas escolhidas, e `SEM_RESPONSAVEL` para as sem dono.
 *
 *  Os outros três filtros são listas de ids, e lista vazia é "sem recorte". */
export const FILTROS_DE_SEMPRE = Object.freeze({ responsaveis: null, etiquetas: [], telefones: [], departamentos: [] });

const ids = (lista) => [...new Set((lista || []).map((x) => String(x || "")).filter(Boolean))].sort();

/** Os filtros arrumados: ids em texto, sem repetição, e a lista de
 *  responsáveis vazia volta a ser "as suas" — desmarcar a última pessoa não
 *  pode deixar a tela num estado que nenhum rótulo diz. */
export function arrumarFiltros(f) {
  const r = f && f.responsaveis;
  const responsaveis = r === TODOS_OS_RESPONSAVEIS ? r : Array.isArray(r) && ids(r).length ? ids(r) : null;
  return { responsaveis, etiquetas: ids(f && f.etiquetas), telefones: ids(f && f.telefones),
           departamentos: ids(f && f.departamentos) };
}

/** Algum filtro fora do padrão? É o que acende o "Limpar os filtros". */
export function filtrosMudaram(f) {
  const a = arrumarFiltros(f);
  return a.responsaveis !== null || a.etiquetas.length > 0 || a.telefones.length > 0 || a.departamentos.length > 0;
}

/** Os filtros como uma chave estável: a PERGUNTA que a tela faz ao banco, para
 *  as dependências de quem lê (e não o objeto, que nasce de novo a cada
 *  desenho). Também diz de qual pergunta uma resposta é. */
export function chaveDosFiltros(f) {
  const a = arrumarFiltros(f);
  const r = a.responsaveis === null ? "suas" : a.responsaveis === TODOS_OS_RESPONSAVEIS ? "todos" : a.responsaveis.join(",");
  return `r:${r}|e:${a.etiquetas.join(",")}|t:${a.telefones.join(",")}|d:${a.departamentos.join(",")}`;
}

/** A chave só das etiquetas: as conversas de cada etiqueta vêm do banco numa
 *  pergunta própria, e a resposta tem de ser das etiquetas de agora. */
export function chaveDasEtiquetas(f) {
  return arrumarFiltros(f).etiquetas.join(",");
}

/** O id da conversa de uma linha: a de "clientes sem resposta" vem da função
 *  do banco (`conversa_id`), e a das conversas que esperam é a própria
 *  conversa (`id`). */
export const idDaConversa = (l) => String((l && (l.conversa_id ?? l.id)) || "");

/** A LINHA PASSA NO RESPONSÁVEL? `aba` decide o padrão ("as suas"). */
export function passaNoResponsavel(l, f, meuId, aba) {
  const r = arrumarFiltros(f).responsaveis;
  const dono = l && l.responsavel_id ? String(l.responsavel_id) : "";
  if (r === null) {
    if (aba === "sem-resposta") return !dono || dono === String(meuId || "");
    return Boolean(dono) && dono === String(meuId || "");
  }
  if (r === TODOS_OS_RESPONSAVEIS) return true;
  return passaNosResponsaveis(l, r);
}

/** OS TELEFONES QUE O RECORTE DEIXA: `null` é sem recorte. Departamento e
 *  telefone somam: escolhido o departamento Acordos, só os telefones dele; e,
 *  dentro dele, só os telefones escolhidos. */
export function telefonesDoRecorte(f, advogados) {
  const a = arrumarFiltros(f);
  if (!a.telefones.length && !a.departamentos.length) return null;
  return (advogados || []).filter((t) =>
    (!a.departamentos.length || a.departamentos.includes(String(t.departamento_id ?? "")))
    && (!a.telefones.length || a.telefones.includes(String(t.id)))).map((t) => String(t.id));
}

/** Os telefones que o filtro de telefones OFERECE: os do departamento
 *  escolhido, ou todos. Oferecer o SAC com o departamento Acordos escolhido
 *  seria oferecer uma lista vazia. */
export function telefonesOferecidos(f, advogados) {
  const deps = arrumarFiltros(f).departamentos;
  return (advogados || []).filter((t) => !deps.length || deps.includes(String(t.departamento_id ?? "")));
}

/** Trocado o departamento, os telefones escolhidos que saíram dele saem da
 *  escolha: escondidos e marcados, eles recortariam a lista sem nada na tela
 *  dizendo por quê. */
export function comOsDepartamentos(f, departamentos, advogados) {
  const novo = arrumarFiltros({ ...arrumarFiltros(f), departamentos });
  const oferecidos = new Set(telefonesOferecidos(novo, advogados).map((t) => String(t.id)));
  return { ...novo, telefones: novo.telefones.filter((id) => oferecidos.has(id)) };
}

/** A LINHA PASSA EM TODOS OS FILTROS? `idsDasEtiquetas` é o conjunto de
 *  conversas com alguma das etiquetas escolhidas, lido do banco; sem
 *  etiqueta escolhida, ele não é perguntado. */
export function passaNosFiltros(l, f, { meuId, aba, advogados, idsDasEtiquetas }) {
  if (!passaNoResponsavel(l, f, meuId, aba)) return false;
  const permitidos = telefonesDoRecorte(f, advogados);
  if (permitidos && !permitidos.includes(String(l && l.advogado_id))) return false;
  if (arrumarFiltros(f).etiquetas.length && !(idsDasEtiquetas && idsDasEtiquetas.has(idDaConversa(l)))) return false;
  return true;
}

/** O MESMO RECORTE, NO BANCO, para as conversas que esperam há dias. Elas vêm
 *  com um teto (as 500 que esperam há mais tempo), e recortar só o que veio
 *  mostraria "as da Jenifer entre as 500" com cara de "as da Jenifer".
 *  Devolve `null` quando o recorte não deixa telefone nenhum: não há o que
 *  perguntar. As etiquetas vão à parte (`.in("id", …)`, em lotes). */
export function recortarAsQueEsperamNoBanco(q, f, meuId, advogados) {
  const a = arrumarFiltros(f);
  if (a.responsaveis === null) q = q.eq("responsavel_id", meuId);
  else if (a.responsaveis !== TODOS_OS_RESPONSAVEIS) q = recortarPelosResponsaveis(q, a.responsaveis);
  const permitidos = telefonesDoRecorte(a, advogados);
  if (permitidos) {
    if (!permitidos.length) return null;
    q = q.in("advogado_id", permitidos);
  }
  return q;
}

/** O que a pílula de cada lista escreve: o nome do filtro, sem escolha; o
 *  nome da escolhida; ou a primeira e quantas mais ("Urgente +2"). A
 *  PRIMEIRA NA ORDEM DO MENU (`itens`, com `id` e `nome`), e não na do
 *  clique nem na dos ids: o mesmo recorte escreve sempre a mesma coisa, como
 *  o seletor de responsáveis do alto da lista. Pela ordem dos ids, que no
 *  banco são aleatórios, a pílula escreveria uma etiqueta qualquer. */
export function rotuloDaLista(escolhidos, itens, vazio) {
  const sim = new Set((escolhidos || []).map(String));
  if (!sim.size) return vazio;
  const naOrdem = (itens || []).filter((t) => t && sim.has(String(t.id)));
  const primeiro = naOrdem.length ? String(naOrdem[0].nome || "") || "?" : `${vazio}: ${sim.size}`;
  return naOrdem.length && sim.size > 1 ? `${primeiro} +${sim.size - 1}` : primeiro;
}

/** O que a pílula do responsável escreve. "As suas" no padrão, e não
 *  "Responsável": o padrão já recorta, e um rótulo neutro se leria como
 *  "todos". */
export function rotuloDoResponsavel(f, nomeDe, meuId) {
  const r = arrumarFiltros(f).responsaveis;
  if (r === null) return "As suas";
  if (r === TODOS_OS_RESPONSAVEIS) return "Todos";
  return rotuloDosResponsaveis(r, nomeDe, meuId);
}

/** O nome da aba das conversas que esperam: "Suas conversas…" só quando são
 *  as suas (o padrão, ou só você escolhido). Com a Jenifer escolhida, "suas"
 *  mentiria. */
export function tituloDasQueEsperam(f, haDias, meuId) {
  const r = arrumarFiltros(f).responsaveis;
  const suas = r === null || (Array.isArray(r) && r.length === 1 && r[0] === String(meuId || ""));
  return suas ? `Suas conversas esperando ${haDias}` : `Conversas esperando ${haDias}`;
}

/** A frase da aba dos clientes sem resposta sobre o responsável. */
export function fraseDoResponsavelSemResposta(f, nomeDe, meuId) {
  const r = arrumarFiltros(f).responsaveis;
  if (r === null) return "Os que têm outra pessoa como responsável aparecem só para ela.";
  if (r === TODOS_OS_RESPONSAVEIS) return "De qualquer responsável, e os sem responsável.";
  return `Mostrando só os clientes ${fraseDosResponsaveis(r, nomeDe, meuId)}.`;
}

/** A frase da aba das conversas que esperam. */
export function fraseDasQueEsperam(f, nomeDe, meuId, haDias) {
  const r = arrumarFiltros(f).responsaveis;
  if (r === null) return `As conversas em que você é o responsável e o cliente espera resposta ${haDias}.`;
  if (r === TODOS_OS_RESPONSAVEIS) return `As conversas de qualquer responsável, e as sem responsável, em que o cliente espera resposta ${haDias}.`;
  const frase = fraseDosResponsaveis(r, nomeDe, meuId);
  return frase === "sem responsável"
    ? `As conversas sem responsável em que o cliente espera resposta ${haDias}.`
    : `As conversas ${frase}${frase.includes(", ou ") ? "," : ""} e o cliente espera resposta ${haDias}.`;
}
