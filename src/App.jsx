import React, { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import Login from "./Login.jsx";
import Painel from "./Painel.jsx";

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

/** A sessão guardada no navegador, lida SEM REDE.
 *
 *  A chave e o armário são os da própria biblioteca (`storageKey` e
 *  `storage`): adivinhar o nome funcionaria hoje e quebraria calado numa
 *  atualização dela.
 *
 *  Devolve `null` para tudo que não seja uma sessão válida e dentro do prazo.
 *  Aqui não se inventa nada: sem sessão boa, o certo é a tela de Login. */
async function sessaoGuardadaSemRede() {
  try {
    const armario = supabase.auth && supabase.auth.storage;
    const chave = supabase.auth && supabase.auth.storageKey;
    if (!armario || !chave) return null;
    const cru = await armario.getItem(chave);
    if (!cru) return null;
    const guardada = typeof cru === "string" ? JSON.parse(cru) : cru;
    if (!guardada || !guardada.access_token) return null;
    // `expires_at` é em segundos, como o `exp` de dentro do bilhete.
    const ate = Number(guardada.expires_at || 0);
    if (!ate || ate * 1000 <= Date.now()) return null;
    return guardada;
  } catch (_e) {
    return null;
  }
}

/** Uma promessa que se resolve sozinha depois de `ms`, com `marca`. */
function prazo(ms, marca) {
  return new Promise((resolve) => setTimeout(() => resolve(marca), ms));
}

// Decide o que mostrar: se ninguém está logado, a tela de Login;
// se há uma sessão ativa, o Painel de atendimento.
export default function App() {
  const [sessao, setSessao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // Entramos pelo caminho de baixo, com o Auth sem responder? A tela de Login
  // usa isto para explicar em vez de só recusar.
  const [authMudo, setAuthMudo] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      // A CORRIDA. Vence quem chegar primeiro: a biblioteca ou o relógio.
      //
      // O `catch` no meio não é enfeite. `getSession` pode ESTOURAR em vez de
      // demorar, e um `.then` solto numa promessa que estoura deixa a tela
      // exatamente onde ela estava — presa, e agora com um erro no console
      // que ninguém no escritório vai ler.
      const resposta = await Promise.race([
        (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            return { respondeu: true, sessao: (data && data.session) || null };
          } catch (_e) {
            return { respondeu: false };
          }
        })(),
        prazo(LIMITE_DA_SESSAO_MS, { respondeu: false }),
      ]);

      if (!vivo) return;

      if (resposta.respondeu) {
        setSessao(resposta.sessao);
        setCarregando(false);
        return;
      }

      // O Auth não respondeu a tempo. Vale o que está guardado aqui.
      console.log("A conferência da sessão não respondeu a tempo. "
                + "Seguindo com o que está guardado neste navegador.");
      const guardada = await sessaoGuardadaSemRede();
      if (!vivo) return;
      setSessao(guardada);
      setAuthMudo(!guardada);
      setCarregando(false);
    })();

    // Fica atento a login/logout para atualizar a tela.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!vivo) return;
      setSessao(s);
      // Chegou sessão por qualquer caminho: a tela já não está no escuro, e o
      // aviso deixaria de ser verdade.
      if (s) setAuthMudo(false);
      // E se a resposta vier DEPOIS do prazo, ela ainda serve para destravar.
      setCarregando(false);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (carregando) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#667781" }}>
        Carregando…
      </div>
    );
  }

  return sessao ? <Painel sessao={sessao} /> : <Login authMudo={authMudo} />;
}
