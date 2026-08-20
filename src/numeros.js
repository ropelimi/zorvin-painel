// ============================================================
//  TELEFONE: A FORMA DE GRAVAR E A FORMA DE COMPARAR
//
//  Duas perguntas diferentes, e é por confundi-las que o mesmo cliente vira
//  dois contatos:
//
//    numeroCanonico  — "como este número deve ser GRAVADO?"   → 5511999998888
//    chaveDoNumero   — "estes dois são a MESMA linha?"        → 11999998888
//
//  Isto morava dentro do componente do painel, e a ficha do cliente precisou
//  da mesma resposta. Copiar seria plantar a próxima divergência.
//
//  Aqui não há React nem DOM de propósito: assim estas regras se provam em
//  Node, sem navegador, que é onde erro de número é barato de achar.
//
//  ------------------------------------------------------------------
//  NÃO UNIFIQUE ISTO COM A CHAVE DE `Departamentos.jsx`.
//
//  Existe lá uma função quase igual, e ela responde a OUTRA pergunta:
//  "qual é a etiqueta deste telefone DO ESCRITÓRIO?". O painel grava essa
//  etiqueta no perfil do Vantoro (`zorvin_telefones`) e a ponte lê para
//  aplicar a permissão — as duas pontas de um mesmo acordo, e por isso a
//  ponte tem a mesma função, idêntica, em `index.js`.
//
//  Trocar uma das pontas pela chave daqui faria o painel gravar uma etiqueta
//  e a ponte procurar outra: quem tivesse telefone marcado deixaria de ver as
//  conversas dele, sem erro nenhum na tela. Num escritório de advocacia, esse
//  é o pior tipo de defeito — silencioso e do lado de quem não pode ver.
//
//  Nos telefones do escritório (55 + DDD + 9 dígitos, que é como toda linha
//  conectada chega) as duas dão o MESMO resultado. Elas só divergem no
//  celular escrito na forma antiga, sem o nono dígito — que ali não aparece.
//  ------------------------------------------------------------------
// ============================================================

// COMO O NÚMERO É GRAVADO.
//
// O WhatsApp devolve sempre com o código do país. Quando o painel gravava sem
// ele, a ponte não achava ninguém com aquele texto ao chegar a resposta, e
// criava um SEGUNDO contato com uma segunda conversa: a mensagem enviada numa,
// a resposta na outra.
//
// O 55 entra só quando o número tem cara de brasileiro (10 ou 11 dígitos: DDD
// mais o telefone). Número que já vem com código de país, ou estrangeiro, passa
// intacto — o WhatsApp do escritório fala com o mundo todo, e prefixar 55 num
// número de Portugal criaria justamente o problema que se quer evitar.
export function numeroCanonico(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// A CHAVE PARA COMPARAR DOIS TELEFONES ESCRITOS DE JEITOS DIFERENTES.
//
// O mesmo telefone aparece de quatro formas no dia a dia, e as quatro precisam
// se reconhecer:
//
//     5511999999999      como o WhatsApp manda
//     11999999999        como a pessoa digita
//     (11) 999999999     copiado de um e-mail
//     (11) 99999-9999    copiado do cadastro
//
// A chave joga fora a pontuação e o código do país, sobrando "11999999999" nos
// quatro casos.
//
// O 55 só sai quando o que sobra tem cara de telefone brasileiro (10 ou 11
// dígitos). Assim um número de fora que por acaso comece com 55 continua
// inteiro.
export function chaveDoNumero(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  const nacional = (d.startsWith("55") && (d.length === 12 || d.length === 13)) ? d.slice(2) : d;
  // O NONO DÍGITO ENTRA NA CHAVE.
  //
  // Tirar o 55 não basta: o mesmo celular aparece com 8 e com 9 dígitos locais,
  // porque o Brasil pôs um 9 na frente e o WhatsApp devolve umas contas na
  // forma antiga. "31 99945-6790" e "31 9945-6790" são a MESMA linha, e era
  // essa diferença que criava duas conversas para a mesma pessoa.
  //
  // A chave é sempre a forma COM o 9. Só para celular: fixo tem 8 dígitos
  // começando em 2..5, e pôr um 9 nele inventaria um número que não existe.
  if (nacional.length === 10 && "6789".includes(nacional[2])) {
    return nacional.slice(0, 2) + "9" + nacional.slice(2);
  }
  return nacional;
}

// DÁ PARA CHAMAR ESTE NÚMERO?
//
// Menos de 10 dígitos é DDD faltando, e sem DDD não há para onde ligar. É a
// mesma régua que a busca do Vantoro já usava; agora ela tem nome, porque
// passou a ser usada em dois lugares.
export function daParaChamar(bruto) {
  return chaveDoNumero(bruto).length >= 10;
}

// 5511997303331 → (11) 99730-3331. Só para LER; o que vale é sempre o cru.
export function telefoneLegivel(valor) {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor || "—";
}

// OS OUTROS NÚMEROS DESTE CLIENTE — os que dão para chamar e que NÃO são o
// desta conversa.
//
// É o miolo do botão "conversar por este número", e está aqui, longe da tela,
// porque as três armadilhas dele são de dado e não de desenho:
//
//   1. O MESMO NÚMERO ESCRITO DIFERENTE. O cadastro tem "(11) 99730-3331" no
//      `telefone` e "5511997303331" no `telefone2` — o mesmo aparelho. Sem
//      comparar por chave, a ficha ofereceria "conversar pelo outro número"
//      para abrir a conversa em que a pessoa já está.
//   2. O CAMPO PELA METADE. Quem está digitando o segundo número passa por
//      "11", "119", "1199"… Cada tecla ofereceria um botão que abriria uma
//      conversa com um número que não existe, e criaria o contato.
//   3. OS DOIS IGUAIS ENTRE SI. Cadastro com `telefone` e `telefone2` iguais
//      mostraria o mesmo botão duas vezes.
//
// `numeroDaConversa` pode ser qualquer um dos dois: a ficha abre pelo número da
// conversa, e ele tanto pode ser o principal do cadastro quanto o segundo.
export function outrosNumeros(cadastro, numeroDaConversa) {
  const aqui = chaveDoNumero(numeroDaConversa);
  const vistos = new Set(aqui ? [aqui] : []);
  const fora = [];
  for (const bruto of [cadastro?.telefone, cadastro?.telefone2]) {
    if (!daParaChamar(bruto)) continue;
    const chave = chaveDoNumero(bruto);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    fora.push({ chave, cru: numeroCanonico(bruto), legivel: telefoneLegivel(bruto) });
  }
  return fora;
}
