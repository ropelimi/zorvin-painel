// ============================================================
//  O NAVEGADOR PRECISA SABER QUE O ZORVIN ESTÁ NO ESCURO
//
//  Relato, com foto: no iPhone, ao tocar na caixa de escrever, aparece uma
//  faixa BRANCA em cima do teclado — e umas bordas brancas embaixo. Num app
//  todo escuro, salta aos olhos.
//
//  A faixa é do iPhone, não é nossa: é a barra de navegação de formulário
//  (as setinhas e o "pronto"). Uma página web NÃO pode tirá-la — o aplicativo
//  do WhatsApp consegue porque é um aplicativo de verdade, e ali o teclado é
//  dele. Não há truque de CSS que resolva, e quem promete isso está enganando.
//
//  O QUE DÁ, E É O QUE INCOMODA: ela não precisa ser BRANCA. O Safari desenha
//  as coisas dele — essa barra, as barras de rolagem, os campos, o fundo da
//  página — na cor clara enquanto a página não disser que está no escuro. E a
//  página nunca dizia: o Zorvin pinta tudo por dentro e nunca contou ao
//  navegador qual é o tema.
//
//  São três avisos, e cada um cobre uma parte diferente:
//
//    • `color-scheme`  → o que o Safari desenha (barra do teclado, rolagem,
//                        campos). É o opt-in oficial do WebKit para o escuro.
//    • fundo do `html` → a "borda branca" que aparece quando a tela balança
//                        no fim da rolagem, ou quando o teclado muda a altura
//                        da janela. Esse pedaço não é desenhado por nenhum
//                        componente: é o papel embaixo de tudo, e ele nasce
//                        branco.
//    • `theme-color`   → a barra de endereço do navegador.
//
//  Fica num arquivo à parte porque duas telas precisam: o painel, que tem
//  claro e escuro guardados, e a de ENTRAR, que segue o tema do aparelho.
// ============================================================

/**
 * @param {boolean} escuro  o Zorvin está no tema escuro?
 * @param {string}  cor     a cor sólida que fica por baixo de tudo
 */
export function aplicarAparencia(escuro, cor) {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;

  raiz.style.colorScheme = escuro ? "dark" : "light";
  // O `html` E o `body`. O Safari pinta a área que sobra com o fundo do
  // `html`; deixar só o `body` resolve no Chrome e não resolve no iPhone, que
  // é justamente onde o problema aparece.
  raiz.style.background = cor;
  if (document.body) document.body.style.background = cor;

  let etiqueta = document.querySelector('meta[name="theme-color"]');
  if (!etiqueta) {
    etiqueta = document.createElement("meta");
    etiqueta.setAttribute("name", "theme-color");
    document.head.appendChild(etiqueta);
  }
  etiqueta.setAttribute("content", cor);
}
