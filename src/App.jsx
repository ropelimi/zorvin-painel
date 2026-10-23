import React, { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import Login from "./Login.jsx";
import Painel from "./Painel.jsx";
import {
  conferirSessao, esquecerSessaoGuardada, ouvirPedidosDeConferencia, foiSaidaPedida,
} from "./vigiaDaSessao.js";

// ============================================================
//  A PRIMEIRA PERGUNTA DO PAINEL — E ELA NÃO PODE FICAR SEM RESPOSTA
//
//  Esta tela decide o que mostrar: Login ou Painel. Para decidir, ela pergunta
//  à biblioteca do Supabase se há alguém logado.
//
//  O código era este:
//
//      supabase.auth.getSession().then(({ data }) => {
//        setSessao(data.session);
//        setCarregando(false);        // <- só sai daqui se a promessa VOLTAR
//      });
//
//  Sem prazo e sem `catch`. Três linhas, e um jeito de o sistema inteiro
//  parar: se aquela promessa não volta, `carregando` fica `true` para sempre e
//  o escritório olha para "Carregando…" sem nada na tela dizendo o que houve.
//
//  E ELA TEM MOTIVO PARA NÃO VOLTAR. `getSession` não é só ler o navegador:
//  quando o bilhete guardado está vencido, a biblioteca vai renovar pela rede,
//  no Auth do Supabase. Foi o serviço que caiu na manhã de 19/08 — Cloudflare
//  521 — enquanto o banco respondia em 168 ms. Com ele fora, a renovação fica
//  pendurada e a tela nunca sai do lugar.
//
//  O CONSERTO TEM DUAS PARTES, e a segunda é a que importa.
//
//  A primeira: prazo. Passados alguns segundos, a espera acaba de um jeito ou
//  de outro. `setCarregando(false)` acontece SEMPRE — por resposta, por prazo
//  ou por erro. Nenhum caminho sai daqui sem responder.
//
//  A segunda: o que fazer quando o Auth não responde. Desistir e mandar para o
//  Login seria trocar uma tela travada por outra — quem já estava logado seria
//  posto para fora por causa de um serviço de fora do ar. Então a sessão é
//  lida DIRETO do armário da biblioteca, sem rede nenhuma. Se ela existe e não
//  venceu, ela vale: quem usa o painel usa o banco e o tempo real, e nenhum
//  dos dois passa pelo Auth — os dois conferem o bilhete por conta própria,
//  com o segredo do projeto.
//
//  É a mesma ideia da entrada pela ponte, do outro lado: o Auth é necessário
//  para NASCER uma sessão, e não para usá-la.
// ============================================================

// Quanto se espera pela biblioteca antes de seguir sem ela. Seis segundos é
// muito mais do que a resposta normal (que vem do próprio navegador, em
// milissegundos, quando o bilhete está em dia) e pouco o bastante para não
// parecer que travou.
// A bancada encurta isto, senão cada prova da espera custaria seis segundos e
// ninguém rodaria a suíte. Em produção a variável não existe e valem os seis.
const LIMITE_DA_SESSAO_MS = Number(import.meta.env.VITE_LIMITE_SESSAO_MS) || 6000;

// A sessão guardada sem rede e a corrida contra o relógio moraram aqui até
// 22/10; foram para `vigiaDaSessao.js`, que agora também confere a sessão
// DEPOIS da abertura — uma escrita só da régua de 19/08 para as duas horas.

// ------------------------------------------------------------
//  E DEPOIS DE ABRIR, A SESSÃO CONTINUA SENDO CONFERIDA (22/10)
//
//  Ver o alto de `vigiaDaSessao.js`: a biblioteca devolve "sem sessão" sem
//  avisar em alguns caminhos, e o painel ficava aberto sem nada carregar —
//  medido, um navegador passou sete horas assim. A conferência roda:
//
//    - de minuto em minuto;
//    - quando a aba volta à frente (a pessoa voltou a olhar);
//    - na hora, quando o painel pede — uma leitura que falhou com cara de
//      acesso vencido.
//
//  "Talvez" (a rede, ou o Auth calado com o bilhete já vencido) só vira
//  saída se DURAR: um soluço de rede não pode pôr para fora quem está no
//  meio de uma resposta.
// ------------------------------------------------------------
const VIGIA_DA_SESSAO_MS =
  (typeof globalThis !== "undefined" && globalThis.__VIGIA_DA_SESSAO) || 60000;
const TOLERANCIA_DA_SESSAO_MS =
  (typeof globalThis !== "undefined" && globalThis.__TOLERANCIA_DA_SESSAO) || 120000;

// Decide o que mostrar: se ninguém está logado, a tela de Login;
// se há uma sessão ativa, o Painel de atendimento.
export default function App() {
  const [sessao, setSessao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // Entramos pelo caminho de baixo, com o Auth sem responder? A tela de Login
  // usa isto para explicar em vez de só recusar.
  const [authMudo, setAuthMudo] = useState(false);
  // A sessão ACABOU (e não foi o "Sair")? A tela de entrada diz isso, em vez
  // de aparecer do nada no meio do trabalho como se a pessoa tivesse saído.
  const [sessaoTerminou, setSessaoTerminou] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      // A CORRIDA — vence quem chegar primeiro, a biblioteca ou o relógio — e
      // a leitura do que está guardado quando o relógio vence moram em
      // `conferirSessao`. O `catch` lá dentro não é enfeite: `getSession`
      // pode ESTOURAR em vez de demorar, e um `.then` solto numa promessa que
      // estoura deixaria a tela presa em "Carregando…".
      const r = await conferirSessao(LIMITE_DA_SESSAO_MS);
      if (!vivo) return;

      if (r.estado === "serve") {
        if (r.motivo === "mudo") {
          console.log("A conferência da sessão não respondeu a tempo. "
                    + "Seguindo com o que está guardado neste navegador.");
        }
        setSessao(r.sessao);
        setCarregando(false);
        return;
      }

      // A SESSÃO GUARDADA QUE NÃO TEM COMO RENOVAR. Era tratada como "o Auth
      // não respondeu", e a tela de entrada dizia que a conferência tinha
      // demorado demais — mandando esperar por um serviço que estava de pé.
      // A sessão é que tinha acabado.
      if (r.estado === "acabou" && r.motivo === "sem-renovacao") {
        await esquecerSessaoGuardada();
        if (!vivo) return;
        setSessaoTerminou(true);
      }
      // O Auth não respondeu a tempo e não havia sessão em dia aqui.
      if (r.motivo === "mudo") {
        console.log("A conferência da sessão não respondeu a tempo, e não há "
                  + "sessão em dia guardada neste navegador.");
        setAuthMudo(true);
      }
      setSessao(null);
      setCarregando(false);
    })();

    // Fica atento a login/logout para atualizar a tela.
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (!vivo) return;
      // A SAÍDA QUE NINGUÉM PEDIU — a renovação recusada de vez (a conta
      // desativada, a credencial revogada). A do botão "Sair" é marcada antes
      // (`marcarSaidaPedida`), e essa não leva recado.
      if (evento === "SIGNED_OUT" && !foiSaidaPedida()) setSessaoTerminou(true);
      setSessao(s);
      // Chegou sessão por qualquer caminho: a tela já não está no escuro, e os
      // avisos deixariam de ser verdade.
      if (s) { setAuthMudo(false); setSessaoTerminou(false); }
      // E se a resposta vier DEPOIS do prazo, ela ainda serve para destravar.
      setCarregando(false);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const temSessao = Boolean(sessao);
  useEffect(() => {
    if (!temSessao) return undefined;
    let vivo = true;
    let emVoo = false;
    // Desde quando a resposta é "talvez". Volta a nulo na primeira que serve.
    let desde = null;
    const conferir = async () => {
      if (!vivo || emVoo) return;
      emVoo = true;
      try {
        const r = await conferirSessao(LIMITE_DA_SESSAO_MS);
        if (!vivo) return;
        if (r.estado === "serve") { desde = null; return; }
        if (r.estado === "talvez") {
          if (desde === null) desde = Date.now();
          if (Date.now() - desde < TOLERANCIA_DA_SESSAO_MS) return;
        }
        console.log(`A sessão acabou (${r.motivo}). Voltando para a tela de entrada.`);
        await esquecerSessaoGuardada();
        if (!vivo) return;
        setSessaoTerminou(true);
        setSessao(null);
      } finally {
        emVoo = false;
      }
    };
    const relogio = setInterval(conferir, VIGIA_DA_SESSAO_MS);
    const aoVoltarAFrente = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltarAFrente);
    window.addEventListener("focus", conferir);
    const largar = ouvirPedidosDeConferencia(conferir);
    return () => {
      vivo = false;
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltarAFrente);
      window.removeEventListener("focus", conferir);
      largar();
    };
  }, [temSessao]);

  if (carregando) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#667781" }}>
        Carregando…
      </div>
    );
  }

  return sessao ? <Painel sessao={sessao} /> : <Login authMudo={authMudo} sessaoTerminou={sessaoTerminou} />;
}
