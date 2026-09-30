// COMO UM CONTATO SE CHAMA NA TELA.
//
// Sem nome salvo, mostra-se o número — mas GRUPO não tem número: a chave dele é
// o identificador do WhatsApp (`grupo:120363…`), e imprimir isso com um "+" na
// frente dá "+grupo:120363021070929710", que não é nada. Antes deste conserto,
// mensagem de grupo caía numa conversa cujo título era um pedaço desse
// identificador ("+70929710") — sem nome, porque o nome do grupo era ignorado.
//
// O CADASTRO MANDA. Quem já tem ficha no Vantoro aparece aqui com o nome da
// ficha, não com o nome que veio do WhatsApp — porque esse é o que a própria
// pessoa escreveu no aparelho dela ("Jô 💜", "Eu", o nome da loja) e não é o
// nome com que o escritório trata o processo. Quem não tem ficha continua
// aparecendo como o WhatsApp mandou.
export function nomeDoContato(contato) {
  if (!contato) return "";
  if (contato.vantoro_nome) return contato.vantoro_nome;
  // O NOME QUE A EQUIPE DEU AQUI DENTRO. Fica entre o cadastro e o WhatsApp,
  // e a ordem é a resposta a duas perguntas diferentes: quem tem ficha é
  // conhecido pelo nome dela (o painel não é dono do nome de quem o Vantoro já
  // conhece); quem não tem — um lead, quase sempre — passa a poder ser
  // chamado pelo nome de verdade sem que se crie um cadastro só para isso.
  if (contato.nome_zorvin) return contato.nome_zorvin;
  if (contato.nome) return contato.nome;
  const numero = String(contato.numero || "");
  return numero.startsWith("grupo:") ? "Grupo" : "+" + numero;
}
