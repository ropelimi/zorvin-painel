// ============================================================
//  A BUSCA PROCURA EM TODOS OS TELEFONES (04/11)
//
//  Pedido do Rodrigo, com duas fotos: a Jessica Maressa, um lead sem ficha no
//  Vantoro, tem conversa só no telefone do SAC. Procurando o nome dela no SAC,
//  a conversa aparecia; no telefone das Audiências, "Nada encontrado para essa
//  busca". "Não importa em qual telefone o usuário esteja, a busca deve
//  encontrar todas as conversas, com ou sem ficha do Vantoro."
//
//  Quem procura em todos os telefones é o banco (`buscar_conversas` com
//  `p_todos_os_telefones`, script 049 da ponte), e a regra de acesso de
//  `conversas` continua decidindo o que cada pessoa enxerga. As contas desta
//  tela, que não precisam de tela para serem feitas, moram aqui.
// ============================================================

/** O telefone do escritório por onde esta conversa fala, como texto. */
export function telefoneDaConversa(c) {
  return c && c.advogado_id != null ? String(c.advogado_id) : "";
}

/** Esta conversa é de outro telefone que não o aberto na barra? */
export function ehDeOutroTelefone(c, telefoneAberto) {
  const dela = telefoneDaConversa(c);
  return Boolean(dela) && dela !== String(telefoneAberto ?? "");
}

/** A busca pode mostrar esta conversa? Só a que um clique consegue abrir.
 *
 *  A regra de acesso do banco já recorta pelos telefones da pessoa. Esta é a
 *  segunda guarda, e ela existe pelo que a regra não sabe: a LINHA
 *  DESATIVADA. A regra de acesso deixa ver as conversas de um telefone
 *  desativado a quem tem permissão nele, e a barra não o oferece a quem não
 *  administra — o clique terminaria em "Você não tem acesso a este telefone".
 *  Uma linha que não abre não é um resultado: é um beco.
 *
 *  - a do telefone aberto, sempre (quem administra pode estar numa linha
 *    desativada, e procurar nela);
 *  - a de um telefone que a pessoa usa (`permitidos`: os que a barra oferece);
 *  - a de uma linha desativada, só para quem administra (`desativadas`: as que
 *    a barra mostra a quem administra, de todos os departamentos). */
export function aBuscaAlcanca(c, { telefoneAberto, permitidos, desativadas }) {
  const dela = telefoneDaConversa(c);
  if (!dela) return false;
  if (dela === String(telefoneAberto ?? "")) return true;
  return (permitidos || []).some((a) => String(a.id) === dela)
      || (desativadas || []).some((a) => String(a.id) === dela);
}

/** As conversas do telefone aberto primeiro, e as dos outros depois — cada
 *  grupo na ordem em que veio.
 *
 *  Quem procura está trabalhando NESTE telefone: se o cliente tem conversa
 *  aqui, é ela que se quer, e uma conversa de outro telefone mais recente não
 *  pode empurrá-la para baixo. É a mesma ordem que o banco usa para escolher
 *  as oitenta que devolve. */
export function oTelefoneAbertoPrimeiro(lista, telefoneAberto) {
  const daqui = [];
  const deFora = [];
  for (const c of lista || []) (ehDeOutroTelefone(c, telefoneAberto) ? deFora : daqui).push(c);
  return deFora.length ? [...daqui, ...deFora] : daqui;
}
