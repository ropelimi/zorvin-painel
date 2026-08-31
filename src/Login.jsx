import React, { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { instalarSessao } from "./sessao.js";
import { aplicarAparencia } from "./aparencia.js";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import Marca from "./Marca";

// Tela de entrada do Zorvin. É o MESMO usuário e a MESMA senha do Vantoro.
//
// Antes, cada pessoa tinha uma conta criada à mão no Supabase, com senha
// própria — duas listas de gente para manter iguais, e ninguém lembra das
// duas. Agora quem confere a senha é o Vantoro: o painel manda usuário e senha
// para a ponte, a ponte pergunta lá e devolve um bilhete de entrada de uso
// único, que viramos numa sessão do Supabase aqui.
//
// A senha não fica guardada em lugar nenhum deste lado.
//
// Visual "premium": tema claro/escuro automático, responsivo (desktop e
// celular) e estilos 100% inline (sem CSS externo), como o resto do app.
const BRIDGE_URL = (import.meta.env.VITE_BRIDGE_URL || "").replace(/\/$/, "");

// Quanto tempo esperar a ponte responder à entrada.
//
// 75 segundos porque o teto tem de ser MAIOR do que o tempo de a Render
// acordar o servidor (30 a 60 segundos na primeira chamada do dia). Um limite
// curto transformaria uma espera que ia dar certo num erro.
//
// Vem de variável para poder ser encurtado na bancada: provar a desistência
// esperando 75 segundos de verdade seria uma prova que ninguém roda. E, se um
// dia a Render ficar mais lenta, muda-se o número sem mexer no código.
const LIMITE_MS = Number(import.meta.env.VITE_LIMITE_LOGIN_MS) || 75000;

// `authMudo` chega do `App` quando a conferência da sessão não respondeu a
// tempo E não havia sessão guardada aqui. Sem isto, a pessoa cai numa tela de
// login comum sem saber que o serviço lá fora está fora do ar — e conclui que
// esqueceu a senha.
export default function Login({ authMudo = false } = {}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  // "A ponte pode estar dormindo". Aparece depois de alguns segundos de espera,
  // e não na hora: a maioria das entradas responde em menos de um segundo, e um
  // aviso que pisca em toda tentativa vira ruído.
  const [demorando, setDemorando] = useState(false);
  // O FATO TÉCNICO, embaixo da frase em português. Quando a entrada falha na
  // rede, a frase sozinha não deixa ninguém investigar: "não consegui falar
  // com o servidor" é igual para servidor fora do ar, telefone sem sinal e
  // endereço errado. Aqui fica QUAL endereço não respondeu e depois de quanto
  // tempo — é o que transforma o próximo relato em fato em vez de palpite.
  const [detalhe, setDetalhe] = useState("");
  const [foco, setFoco] = useState(""); // "email" | "senha" — realce do campo ativo
  const [escuro, setEscuro] = useState(false);

  // Segue o tema do sistema (claro/escuro) e reage se o usuário trocar.
  useEffect(() => {
    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (!mq) return;
    setEscuro(mq.matches);
    const aoTrocar = (e) => setEscuro(e.matches);
    mq.addEventListener ? mq.addEventListener("change", aoTrocar) : mq.addListener(aoTrocar);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", aoTrocar) : mq.removeListener(aoTrocar); };
  }, []);

  const C = escuro ? PALETA.escuro : PALETA.claro;

  // O NAVEGADOR PRECISA SABER O TEMA AQUI TAMBÉM. Esta é a primeira tela do
  // dia, e é a que tem campos: sem o aviso, o iPhone põe uma faixa branca em
  // cima do teclado assim que se toca em "Usuário".
  // A cor sólida é a do fundo do degradê — é ela que aparece nas bordas.
  useEffect(() => {
    aplicarAparencia(escuro, escuro ? "#0b141a" : "#eef2f1");
  }, [escuro]);

  // ACORDA A PONTE ENQUANTO A PESSOA DIGITA A SENHA.
  //
  // A ponte hiberna no plano gratuito da Render, e a primeira chamada do dia
  // leva de trinta a sessenta segundos só para acordá-la. Essa chamada era o
  // próprio "Entrar": a pessoa abria o Zorvin, digitava, apertava — e ficava
  // olhando o botão girar enquanto o servidor levantava. É a primeira coisa
  // que o escritório sente de manhã, e a que fica na memória como "o Zorvin
  // está lento".
  //
  // Aqui o despertador toca ANTES, no instante em que a tela aparece. Os vinte
  // ou trinta segundos que a pessoa leva digitando usuário e senha viram tempo
  // de acordar em vez de tempo de espera; quando ela aperta "Entrar", a ponte
  // muitas vezes já está de pé.
  //
  // `/ping` é o endereço mais barato da ponte: responde 200 vazio, sem banco.
  // `no-cors` e sem `await` porque não lemos a resposta e não esperamos nada —
  // falhar aqui não pode atrapalhar a entrada. É só bater na porta.
  useEffect(() => {
    if (!BRIDGE_URL) return;
    try {
      fetch(BRIDGE_URL + "/ping", { mode: "no-cors", cache: "no-store" }).catch(() => {});
    } catch (_) { /* bater na porta é best-effort, e só */ }
  }, []);

  async function entrar(e) {
    e.preventDefault();
    if (entrando) return;
    setErro("");
    setDetalhe("");
    setEntrando(true);
    setDemorando(false);
    const comecou = Date.now();

    // TEMPO LIMITE E AVISO — os dois faltavam, e o resultado era este:
    // a pessoa apertava Entrar, o botão girava por um minuto e aparecia
    // "Load failed", que é o Safari dizendo em inglês que a conexão não
    // completou. Não diz o que houve nem o que fazer.
    //
    // O QUE COSTUMA SER: a ponte roda no plano gratuito da Render e hiberna
    // quando fica um tempo sem receber nada. A primeira chamada do dia acorda
    // o servidor, e isso leva de trinta segundos a um minuto — mais do que o
    // navegador do celular espera antes de desistir.
    //
    const relogio = new AbortController();
    const avisar = setTimeout(() => setDemorando(true), 4000);
    const estourou = setTimeout(() => relogio.abort(), LIMITE_MS);
    try {
      if (!BRIDGE_URL) throw new Error("O endereço da ponte não está configurado (VITE_BRIDGE_URL).");

      const r = await fetch(`${BRIDGE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: email.trim(), senha }),
        signal: relogio.signal,
      });
      const corpo = await r.json().catch(() => null);
      if (!r.ok || !corpo || !corpo.ok) {
        // A mensagem vem de lá quando existe: ela distingue "senha errada" de
        // "o Vantoro está fora do ar", e essas duas mandam a pessoa fazer
        // coisas diferentes.
        setErro((corpo && corpo.erro) || "Não foi possível entrar agora.");
        setEntrando(false);
        return;
      }

      // ABRIR A SESSÃO — DOIS CAMINHOS, E O SEGUNDO NÃO PRECISA DE NINGUÉM.
      //
      // O de sempre: o bilhete de uso único vira sessão. É o preferido porque
      // a sessão que sai dele se renova sozinha, e a pessoa fica entrada o
      // quanto quiser.
      //
      // O outro: a ponte assina a sessão e ela vem pronta na resposta. É a
      // rede de segurança para o dia 19/08 — o Auth do Supabase fora do ar
      // uma manhã inteira, com o banco de pé, e o escritório na porta.
      //
      // Os dois vêm juntos quando dá, e não é excesso: `generateLink` (na
      // ponte) e `verifyOtp` (aqui) são duas chamadas ao MESMO serviço doente,
      // e elas falham separadas. Ter o segundo no bolso cobre o caso de a
      // primeira ter passado e a segunda não.
      let entrou = false;

      if (corpo.token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: corpo.token_hash, type: "email",
        });
        entrou = !error;
      }

      if (!entrou && corpo.sessao) {
        if (await instalarSessao(corpo.sessao)) {
          // RECARREGA, e não é preguiça: é assim que a biblioteca do Supabase
          // encontra a sessão guardada, pelo caminho normal dela, sem que este
          // arquivo precise saber como ela avisa o resto da tela. Uma
          // recarga logo depois de entrar é a hora mais barata que existe.
          window.location.reload();
          return;
        }
      }

      if (!entrou) {
        setErro("Entrei no Vantoro mas não consegui abrir a sessão. Tente de novo.");
        setEntrando(false);
      }
      // Dando certo pelo primeiro caminho, o App detecta a sessão e troca para
      // o painel sozinho.
    } catch (err) {
      // TRÊS FALHAS DIFERENTES, TRÊS FRASES DIFERENTES. Antes as três caíam na
      // mensagem que o navegador tivesse dado — em inglês, e igual para todas.
      const segundos = Math.round((Date.now() - comecou) / 1000);
      const ondeFalhou = (() => {
        try { return new URL(BRIDGE_URL).host; } catch (_) { return BRIDGE_URL || "(sem endereço)"; }
      })();
      if (err && err.name === "AbortError") {
        setErro("O servidor demorou demais para responder. Tente de novo — e, "
              + "se continuar, avise quem administra.");
        setDetalhe(`${ondeFalhou} não respondeu em ${segundos}s`);
      } else if (err instanceof TypeError) {
        // `TypeError` é o que `fetch` lança quando a conexão nem chegou a
        // acontecer: sem internet, servidor fora do ar, DNS. O Safari escreve
        // "Load failed" e o Chrome, "Failed to fetch" — nenhuma das duas diz
        // nada a quem está tentando entrar.
        setErro("Não consegui falar com o servidor. Verifique a conexão e tente "
              + "de novo; se continuar, avise quem administra.");
        // Quantos segundos separa DOIS casos que a frase junta: a conexão que
        // é recusada na hora (servidor fora do ar, endereço errado) e a que
        // fica pendurada e cai depois (rede ruim, bloqueio no caminho).
        setDetalhe(`não cheguei em ${ondeFalhou} · ${segundos}s`);
      } else {
        setErro((err && err.message) || "Não foi possível entrar agora.");
      }
      setEntrando(false);
    } finally {
      clearTimeout(avisar);
      clearTimeout(estourou);
      setDemorando(false);
    }
  }

  const campoWrap = (ativo) => ({
    display: "flex", alignItems: "center", gap: 10,
    background: C.inputBg, border: `1.5px solid ${ativo ? C.green : C.inputBorder}`,
    borderRadius: 12, padding: "0 12px", marginTop: 7,
    boxShadow: ativo ? `0 0 0 4px ${C.greenGlow}` : "none",
    transition: "border-color .15s, box-shadow .15s",
  });
  const inputEstilo = {
    flex: 1, border: "none", outline: "none", background: "transparent",
    color: C.textPrimary, fontSize: 15, padding: "13px 0",
  };

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, boxSizing: "border-box", background: C.pageBg,
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif", position: "relative", overflow: "hidden",
    }}>
      {/* Estilos globais mínimos: animações e cor do placeholder/autofill. */}
      <style>{`
        @keyframes zv-spin { to { transform: rotate(360deg); } }
        @keyframes zv-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes zv-float { 0%,100% { transform: translate(0,0); } 50% { transform: translate(0,-18px); } }
        .zv-input::placeholder { color: ${C.textSecondary}; opacity: .8; }
        .zv-input:-webkit-autofill { -webkit-text-fill-color: ${C.textPrimary}; transition: background-color 9999s ease-in-out 0s; }
      `}</style>

      {/* Brilhos suaves de fundo (dão o toque "premium"). */}
      <div aria-hidden style={{ position: "absolute", top: "-14%", left: "-8%", width: 420, height: 420, borderRadius: "50%", background: C.blob1, filter: "blur(70px)", animation: "zv-float 11s ease-in-out infinite" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-16%", right: "-10%", width: 460, height: 460, borderRadius: "50%", background: C.blob2, filter: "blur(80px)", animation: "zv-float 13s ease-in-out infinite reverse" }} />

      <div style={{
        position: "relative", width: "100%", maxWidth: 400, boxSizing: "border-box",
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 20,
        boxShadow: C.cardShadow, padding: "38px 30px 30px", animation: "zv-rise .4s ease both",
      }}>
        {/* Cabeçalho / marca */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          {/* O MESMO desenho do ícone da aba, e não um parecido: o arquivo é
              literalmente o mesmo (`public/zorvin.svg`), então a marca da
              entrada e a da aba não têm como divergir no dia em que uma das
              duas for mexida.

              O quadrado verde que ficava aqui atrás saiu junto. O balão já traz
              o próprio campo verde — mantido o quadrado, ficavam dois crachás
              um dentro do outro e o balão encolhia para caber no de fora. A
              sombra passou para a forma: o `drop-shadow` acompanha o contorno
              do balão, inclusive o rabinho. */}
          <img src="/zorvin.svg" alt="" width={74} height={74}
               style={{ display: "block", marginBottom: 14,
                        filter: `drop-shadow(0 10px 22px ${C.greenGlow})` }} />
          {/* A mesma marca do topo da lista de conversas — ver `Marca.jsx`. O
              "· Ropelimi" saiu da linha de baixo porque agora o nome da casa
              está na de cima, e em corpo maior: dizê-lo duas vezes na mesma
              caixa era repetição, não reforço. */}
          <Marca tamanho={26} cor={C.textPrimary} corFraca={C.textSecondary} />
          <div style={{ fontSize: 13.5, color: C.textSecondary, marginTop: 3 }}>Central de atendimento</div>
        </div>

        <form onSubmit={entrar} noValidate>
          {/* `type="text"` e não `email`: o login do Vantoro é "rodrigo.sousa",
              sem arroba, e o navegador recusaria o formulário sozinho. Os dois
              formatos entram — quem decorou o e-mail continua usando ele.

              O exemplo dentro do campo dizia "seu.nome ou voce@escritorio.com",
              e quem lia aquilo tinha de adivinhar QUAL das duas coisas era a
              sua. A resposta é sempre a mesma e agora está escrita: é o mesmo
              usuário do Vantoro, o que a pessoa digita todo dia no outro
              sistema. Não há o que decorar nem inventar. */}
          <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary }}>Usuário do Vantoro</label>
          <div style={campoWrap(foco === "email")}>
            <Mail size={18} color={foco === "email" ? C.green : C.textSecondary} style={{ flexShrink: 0 }} />
            <input
              className="zv-input" type="text" autoComplete="username" autoCapitalize="none"
              // O cursor já começa aqui. É a primeira coisa que se faz nesta
              // tela — não há outra —, e obrigar um clique antes de digitar é
              // um passo que não serve para nada. Quem entra pelo celular
              // ganha o teclado abrindo sozinho.
              autoFocus
              placeholder="Digite o mesmo usuário do Vantoro" value={email}
              onChange={(e) => { setEmail(e.target.value); if (erro) setErro(""); }} onFocus={() => setFoco("email")} onBlur={() => setFoco("")}
              required style={inputEstilo}
            />
          </div>

          <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginTop: 16 }}>Senha</label>
          <div style={campoWrap(foco === "senha")}>
            <Lock size={18} color={foco === "senha" ? C.green : C.textSecondary} style={{ flexShrink: 0 }} />
            <input
              className="zv-input" type={verSenha ? "text" : "password"} autoComplete="current-password"
              placeholder="••••••••" value={senha}
              onChange={(e) => { setSenha(e.target.value); if (erro) setErro(""); }} onFocus={() => setFoco("senha")} onBlur={() => setFoco("")}
              required style={inputEstilo}
            />
            <button type="button" onClick={() => setVerSenha((v) => !v)} title={verSenha ? "Ocultar senha" : "Mostrar senha"}
              style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 4, color: C.textSecondary, flexShrink: 0 }}>
              {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* `role="alert"` faz o leitor de tela ANUNCIAR a mensagem quando ela
              aparece. Sem isso, quem não enxerga a tela aperta "Entrar", não
              acontece nada aparente, e não há como saber que a senha estava
              errada — a mensagem existe, mas em silêncio. */}
          {/* O AVISO DE QUE A CULPA NÃO É DE QUEM ESTÁ ENTRANDO.
              Amarelo e não vermelho: não é um erro do que a pessoa fez, é um
              recado sobre o mundo lá fora. E ele diz para TENTAR, porque a
              entrada pela ponte funciona mesmo com o Auth calado — é
              exatamente para isso que ela existe. */}
          {authMudo && !erro && (
            <div role="status" style={{ color: "#5a4a00", background: "#ffe9a8", fontSize: 13, fontWeight: 500, marginTop: 16, padding: "9px 12px", borderRadius: 10 }}>
              A conferência de quem está entrando demorou demais para responder.
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 400 }}>
                Pode entrar normalmente: o seu login não depende desse serviço.
              </div>
            </div>
          )}
          {erro && (
            <div role="alert" style={{ color: "#fff", background: "#e5573f", fontSize: 13, fontWeight: 500, marginTop: 16, padding: "9px 12px", borderRadius: 10 }}>
              {erro}
              {/* Miúdo e apagado de propósito: quem só quer entrar não precisa
                  ler isto, e quem for investigar precisa que esteja escrito. */}
              {detalhe && (
                <div style={{ marginTop: 5, fontSize: 11, fontWeight: 400, opacity: .85,
                              fontVariantNumeric: "tabular-nums", wordBreak: "break-all" }}>
                  {detalhe}
                </div>
              )}
            </div>
          )}

          <button
            type="submit" disabled={entrando}
            style={{
              width: "100%", marginTop: 22, padding: "13px", border: "none", borderRadius: 12,
              background: entrando ? C.greenDark : `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
              color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: entrando ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 8px 20px ${C.greenGlow}`, transition: "opacity .15s",
            }}
          >
            {entrando && <Loader2 size={18} style={{ animation: "zv-spin 0.8s linear infinite" }} />}
            {entrando ? "Entrando…" : "Entrar"}
          </button>

          {/* A ESPERA EXPLICADA, ENQUANTO ELA ACONTECE.
              Um botão girando sem fim é indistinguível de um travamento: a
              pessoa fecha a página, tenta de novo, e é justamente a segunda
              tentativa que entraria na hora. Dizer o que está havendo é o que
              a faz esperar mais dez segundos em vez de desistir. */}
          {entrando && demorando && (
            <div role="status" style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.5,
                                        color: C.textSecondary, textAlign: "center" }}>
              O servidor estava dormindo e está acordando. A primeira entrada do
              dia pode levar até um minuto — depois dela, tudo fica rápido.
            </div>
          )}
        </form>

        <div style={{ textAlign: "center", fontSize: 12, color: C.textSecondary, marginTop: 22, lineHeight: 1.5 }}>
          {/* Só a linha que serve para alguma coisa. "Acordos e Execução" era
              o nome do setor: quem chega nesta tela já sabe de que setor é, e
              a linha só empurrava para baixo a única frase que responde a uma
              pergunta de verdade — para quem chamar quando a senha não entra. */}
          Problemas para entrar? Fale com o administrador.
        </div>
      </div>
    </div>
  );
}

// Paletas alinhadas ao tema do painel (WhatsApp Web), claro e escuro.
const PALETA = {
  claro: {
    pageBg: "linear-gradient(160deg, #eef2f1 0%, #e5ece9 100%)",
    blob1: "rgba(0,168,132,.20)", blob2: "rgba(37,211,102,.16)",
    card: "#ffffff", cardBorder: "#e6ebe9", cardShadow: "0 18px 50px rgba(11,20,26,.14)",
    inputBg: "#f6f8f7", inputBorder: "#e2e8e5",
    textPrimary: "#111b21", textSecondary: "#667781",
    green: "#00a884", greenDark: "#008069", greenGlow: "rgba(0,168,132,.28)",
  },
  escuro: {
    pageBg: "linear-gradient(160deg, #0b141a 0%, #0e1a17 100%)",
    blob1: "rgba(0,168,132,.22)", blob2: "rgba(0,92,75,.30)",
    card: "#111b21", cardBorder: "#233138", cardShadow: "0 18px 50px rgba(0,0,0,.5)",
    inputBg: "#202c33", inputBorder: "#2a3942",
    textPrimary: "#e9edef", textSecondary: "#8696a0",
    green: "#00a884", greenDark: "#025c4b", greenGlow: "rgba(0,168,132,.22)",
  },
};
