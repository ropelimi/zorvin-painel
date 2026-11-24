import { useEffect, useRef, useState } from "react";

// ============================================================
//  O PEDIDO FALADO AO QUAZAR (24/11)
//
//  Pedido do Rodrigo: "No "Sugerir resposta" quando vou pedir uma mudança ao
//  Quazar, quero que seja possível pedir a mudança também enviando um áudio e
//  não só digitando."
//
//  O microfone fica ao lado do "Pedir", na faixa do Quazar. Um toque começa a
//  gravar, outro termina, e a gravação vai à ponte (`POST /copiloto/ouvir`),
//  que devolve o que foi dito. O texto entra no campo e o pedido sai, pelo
//  mesmo caminho do digitado: a lição, o "Aprendi" e o Desfazer são os de
//  sempre. NADA É GRAVADO: nem o áudio, nem o texto.
//
//  UM MINUTO NO MÁXIMO (`TETO_DO_PEDIDO_FALADO_S`): o pedido é uma frase, e a
//  gravação esquecida aberta não pode crescer até o teto da ponte. Passando,
//  ela termina sozinha e vai como está.
//
//  O MICROFONE É DEVOLVIDO AO TERMINAR (as trilhas param): sem isso, o ponto
//  vermelho do navegador ficaria aceso, e o microfone preso para a ligação ou
//  para gravar um áudio ao cliente.
// ============================================================

export const TETO_DO_PEDIDO_FALADO_S =
  (typeof globalThis !== "undefined" && globalThis.__TETO_DO_PEDIDO_FALADO_S) || 60;

// O QUE O NAVEGADOR GRAVA: o Chrome grava webm, o Firefox ogg, o Safari mp4.
// O Groq entende os três.
const TIPOS = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];
function tipoQueGrava() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return TIPOS.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

/** A frase de cada recusa do microfone, com o que fazer. */
export function fraseDoMicrofone(e) {
  const nome = e && e.name;
  if (nome === "NotAllowedError" || nome === "SecurityError") {
    return "O navegador não deixou usar o microfone. Libere no cadeado ao lado do endereço e tente de novo, ou escreva o pedido.";
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") {
    return "Não achei nenhum microfone neste computador. Escreva o pedido.";
  }
  if (nome === "NotReadableError" || nome === "AbortError") {
    return "O microfone está sendo usado por outro programa. Feche-o e tente de novo, ou escreva o pedido.";
  }
  return "Não consegui gravar. Tente de novo, ou escreva o pedido.";
}

/** `0:07` */
export const relogioDoPedido = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Três fases: `parado`, `abrindo` (o navegador pergunta pelo microfone) e
 *  `gravando`. Ouvir (a ida à ponte) é de quem chama: a gravação termina, e
 *  o que vem depois é outra coisa. */
export function useGravadorDoPedido() {
  const [fase, setFase] = useState("parado");
  const [segundos, setSegundos] = useState(0);
  const atual = useRef(null);
  const vivo = useRef(true);

  function devolver(a) {
    if (!a) return;
    clearInterval(a.relogio);
    clearTimeout(a.teto);
    if (a.fluxo) a.fluxo.getTracks().forEach((t) => { try { t.stop(); } catch (_) { /* já parou */ } });
    if (atual.current === a) atual.current = null;
  }
  function voltarAoComeco() {
    if (!vivo.current) return;
    setFase("parado");
    setSegundos(0);
  }

  // A TELA QUE SAI leva a gravação junto, sem mandar nada.
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      const a = atual.current;
      if (!a) return;
      a.cancelado = true;
      try { if (a.gravador && a.gravador.state !== "inactive") a.gravador.stop(); } catch (_) { /* já parou */ }
      devolver(a);
    };
  }, []);

  function parar() {
    const a = atual.current;
    if (!a || !a.gravador) return;
    try {
      if (a.gravador.state !== "inactive") a.gravador.stop();
    } catch (_) {
      devolver(a);
      voltarAoComeco();
    }
  }

  function cancelar() {
    const a = atual.current;
    if (!a) return;
    a.cancelado = true;
    if (a.gravador && a.gravador.state !== "inactive") {
      try { a.gravador.stop(); return; } catch (_) { /* cai para baixo */ }
    }
    devolver(a);
    voltarAoComeco();
  }

  async function comecar({ aoTerminar, aoFalhar }) {
    if (atual.current) return;
    const a = { pedacos: [], cancelado: false };
    atual.current = a;
    setFase("abrindo");
    setSegundos(0);
    let fluxo;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const cancelado = a.cancelado;
      devolver(a);
      voltarAoComeco();
      if (!cancelado) aoFalhar(fraseDoMicrofone(e));
      return;
    }
    a.fluxo = fluxo;
    // CANCELADO ENQUANTO O NAVEGADOR PERGUNTAVA: o microfone volta na hora.
    if (a.cancelado || atual.current !== a) { devolver(a); return; }
    const tipo = tipoQueGrava();
    let gravador;
    try {
      gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
    } catch (e) {
      devolver(a);
      voltarAoComeco();
      aoFalhar(fraseDoMicrofone(e));
      return;
    }
    a.gravador = gravador;
    gravador.ondataavailable = (ev) => { if (ev.data && ev.data.size) a.pedacos.push(ev.data); };
    gravador.onstop = () => {
      const gravacao = new Blob(a.pedacos, { type: gravador.mimeType || tipo || "audio/webm" });
      const cancelado = a.cancelado;
      devolver(a);
      voltarAoComeco();
      if (!cancelado && vivo.current) aoTerminar(gravacao);
    };
    a.inicio = Date.now();
    a.relogio = setInterval(() => {
      if (vivo.current) setSegundos(Math.floor((Date.now() - a.inicio) / 1000));
    }, 250);
    a.teto = setTimeout(parar, TETO_DO_PEDIDO_FALADO_S * 1000);
    gravador.start();
    setFase("gravando");
  }

  return { fase, segundos, comecar, parar, cancelar };
}
