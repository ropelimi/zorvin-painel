//
//  A MARCA — "Ropelimi Zorvin", numa linha só.
//
//  A casa vem primeiro e em negrito; o produto vem depois, no mesmo tamanho
//  mas mais claro. É o desenho de "Ropelimi Teia" e de "Google Analytics":
//  quem bate o olho sabe de cara de quem é o sistema, e o nome do produto
//  fica logo ali sem disputar espaço com isso.
//
//  Antes era "Zorvin" grande com um "by Ropelimi" miúdo por baixo — duas
//  linhas para dizer o que cabe numa, e com o nome da casa justamente no
//  tamanho menor. Invertido.
//
//  POR QUE NUM ARQUIVO SÓ
//  ----------------------
//  A marca aparece em três telas: a de entrada, o topo da lista de conversas e
//  o fundo de quando não há conversa aberta. Escrita três vezes, ela desanda na
//  primeira vez que alguém mexer em uma delas — que foi exatamente o que já
//  tinha acontecido: o topo estava em serifada e a entrada em sem serifa.
//
//  As cores entram de fora porque cada tela tem o seu fundo (a entrada tem
//  cartão, o topo tem a barra, o fundo tem o papel de parede do chat) e a
//  paleta do claro e a do escuro são diferentes. O DESENHO é que é fixo.
//
export default function Marca({ tamanho = 19, cor, corFraca }) {
  return (
    <span
      style={{
        // Sem serifa, como o "Ropelimi Teia": a palavra em destaque agora é o
        // nome da casa, e é assim que a casa o escreve.
        fontSize: tamanho,
        lineHeight: 1.15,
        letterSpacing: "-.01em",
        whiteSpace: "nowrap",
      }}
    >
      <b style={{ fontWeight: 700, color: cor }}>Ropelimi</b>
      {/* Espaço em margem, e não um " " no texto: entre um negrito e um peso
          normal o espaço comum encolhe e as duas palavras quase se encostam.
          Proporcional ao tamanho para o vão ser o mesmo a 19 e a 26. */}
      <span style={{ fontWeight: 400, color: corFraca, marginLeft: tamanho * 0.2 }}>
        Zorvin
      </span>
    </span>
  );
}
