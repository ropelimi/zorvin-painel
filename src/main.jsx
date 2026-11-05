import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { iniciarAtualizacaoSozinha } from "./atualizacao.js";

// A ATUALIZAÇÃO SOZINHA (05/11) começa antes de qualquer tela: ela vale para
// a entrada, para o painel e para a guia de cada tela. Ver `atualizacao.js`.
iniciarAtualizacaoSozinha();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
