// O TRABALHADOR DO pdf.js, EMPACOTADO PELO VITE (29/10) — ver `previaDoPdf.js`.
//
// É um arquivo à parte, importado com `?worker&url`, por um motivo só: sair do
// build como `.js`. O do pacote é `.mjs`, e o navegador só aceita um
// trabalhador que o servidor entregue com o tipo de JavaScript — `.mjs` é uma
// extensão que nem todo servidor conhece, e daqui não dá para ver o que o do
// site responde. Um trabalhador recusado deixaria TODA prévia de PDF de fora,
// calada (o cartão continuaria lá, e ninguém ligaria uma coisa à outra).
//
// Ele se liga sozinho ao abrir: o pdf.js, carregado dentro de um trabalhador,
// já começa a ouvir a página.
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
