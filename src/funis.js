// ============================================================
//  O FUNIL DE CADA TELEFONE (02/11) — as contas, fora da tela
//
//  Pedido do Rodrigo: "Haverão etapas diferentes no funil de cada
//  departamento, ideal também ter a opção de funil para cada telefone". O
//  script 043 da ponte guarda em `zorvin_funis` quais telefones têm funil
//  próprio; sem linha, ou com ele desligado, o telefone usa o funil do
//  departamento, como sempre.
//
//  UM FUNIL É UM PAR (departamento, telefone), e o telefone NULO é o funil do
//  departamento. Toda tela que lê ou grava um cartão pergunta aqui qual é o
//  funil — a conversa aberta, a tela de colunas, a administração —, e
//  nenhuma decide sozinha: divergir aqui seria a etapa da conversa ser de um
//  funil e o cartão da tela de colunas ser de outro, sem nada dizendo isso.
//
//  SEM O 043, NADA MUDA: a coluna `advogado_id` não existe, e nenhuma
//  consulta pode mencioná-la (morreria com 42703). Quem diz se ela existe é
//  `lerFunisDosTelefones` — a tabela que falta é o único "não tem"; qualquer
//  outro tropeço é DITO, e não vira "nenhum telefone tem funil próprio"
//  (armadilha nº 2): com ele, a conversa das Audiências mostraria a etapa do
//  funil do departamento.
// ============================================================

import { supabase } from "./supabase.js";
import { semATabela, comOCodigo } from "./gravar.js";

/**
 * O texto que identifica um funil, para chave de cache, de React e o valor da
 * escolha nas telas: "3" é o funil do departamento 3, "3|<telefone>" o de um
 * telefone. O do departamento continua sendo o número sozinho, como era antes
 * do 043 — quem escolhe o departamento pelo número continua acertando.
 */
export function chaveDoFunil(f) {
  if (!f) return "";
  return f.telefoneId ? `${f.departamentoId}|${f.telefoneId}` : String(f.departamentoId);
}

/** Os telefones com funil próprio EM USO, num conjunto de ids em texto. */
export function telefonesComFunilProprio(funis) {
  return new Set((funis || []).filter((f) => f && f.ativo && f.advogado_id).map((f) => String(f.advogado_id)));
}

/**
 * O funil das conversas de um telefone: o dele, se tiver um em uso; senão, o
 * do departamento dele. Nulo quando não há funil nenhum (telefone sem
 * departamento e sem funil próprio) — e é por isso que grupo e telefone solto
 * não mostram etapa.
 */
export function funilDoTelefone(advogadoId, advogados, funis) {
  if (advogadoId == null) return null;
  const proprio = (funis || []).find((f) => f && f.ativo && String(f.advogado_id) === String(advogadoId));
  if (proprio) return { departamentoId: proprio.departamento_id, telefoneId: proprio.advogado_id };
  const adv = (advogados || []).find((a) => String(a.id) === String(advogadoId));
  if (!adv || adv.departamento_id == null) return null;
  return { departamentoId: adv.departamento_id, telefoneId: null };
}

/**
 * Os telefones cujas conversas caem neste funil: o próprio, no funil de um
 * telefone; no do departamento, os telefones dele que NÃO têm funil próprio.
 * É de onde a tela de colunas tira a conversa que o clique no cartão abre.
 */
export function telefonesDoFunil(f, advogados, funis) {
  if (!f) return [];
  if (f.telefoneId) return [f.telefoneId];
  const com = telefonesComFunilProprio(funis);
  return (advogados || [])
    .filter((a) => String(a.departamento_id) === String(f.departamentoId) && !com.has(String(a.id)))
    .map((a) => a.id);
}

/** "Sucesso do Cliente", ou "Sucesso do Cliente · Audiências". */
export function nomeDoFunil(f, departamentos, advogados) {
  if (!f) return "";
  const dep = (departamentos || []).find((d) => String(d.id) === String(f.departamentoId));
  const nomeDep = dep ? dep.nome : "Departamento";
  if (!f.telefoneId) return nomeDep;
  const adv = (advogados || []).find((a) => String(a.id) === String(f.telefoneId));
  return `${nomeDep} · ${adv ? adv.nome : "telefone"}`;
}

/**
 * Os funis para escolher, na ordem da tela: o de cada departamento e, logo
 * abaixo dele, o de cada telefone dele que tem funil próprio em uso, pelo
 * nome do telefone. Só os telefones que estão em `advogados` — quem chama
 * passa os que a pessoa alcança, e o funil de um telefone que ela não atende
 * abriria vazio, e vazio se lê como "ninguém".
 */
export function listaDeFunis(departamentos, advogados, funis) {
  const lista = [];
  const alcanca = new Map((advogados || []).map((a) => [String(a.id), a]));
  for (const d of departamentos || []) {
    lista.push({ departamentoId: d.id, telefoneId: null });
    const proprios = (funis || [])
      .filter((f) => f && f.ativo && f.advogado_id && String(f.departamento_id) === String(d.id)
                     && alcanca.has(String(f.advogado_id)))
      .map((f) => ({ departamentoId: d.id, telefoneId: f.advogado_id,
                     nome: String(alcanca.get(String(f.advogado_id)).nome || "") }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    for (const p of proprios) lista.push({ departamentoId: p.departamentoId, telefoneId: p.telefoneId });
  }
  return lista;
}

/**
 * O recorte do funil numa consulta: o departamento e, com o 043, o telefone
 * (ou "do departamento", que é o telefone nulo). Sem o 043 a coluna não é
 * mencionada — num banco sem ela, a consulta morreria com 42703.
 */
export function noFunil(consulta, f, comTelefone) {
  const q = consulta.eq("departamento_id", f.departamentoId);
  if (!comTelefone) return q;
  return f.telefoneId ? q.eq("advogado_id", f.telefoneId) : q.is("advogado_id", null);
}

/**
 * Lê os funis próprios dos telefones (ligados e desligados — a
 * administração precisa dos dois). Três desfechos:
 *   { existe: false }            sem o 043: nada muda na tela;
 *   { existe: true, lista }      a resposta;
 *   { existe: true, erro }       não deu para saber — e isto é DITO.
 */
export async function lerFunisDosTelefones() {
  const frase = "Não consegui saber quais telefones têm funil próprio.";
  try {
    const { data, error } = await supabase.from("zorvin_funis").select("*").not("advogado_id", "is", null);
    if (error) {
      if (semATabela(error)) return { existe: false, lista: [], erro: "" };
      return { existe: true, lista: [], erro: comOCodigo(frase, error, "funis dos telefones") };
    }
    return { existe: true, lista: data || [], erro: "" };
  } catch (e) {
    return { existe: true, lista: [], erro: comOCodigo(frase, e, "funis dos telefones") };
  }
}
