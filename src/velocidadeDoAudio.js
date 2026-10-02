// A VELOCIDADE DOS ÁUDIOS (02/10) — pedido da equipe: "colocar x2 nos áudios
// do Zorvin".
//
// AS TRÊS DO WHATSAPP, NA MESMA ORDEM: 1x → 1,5x → 2x → 1x. A equipe já
// conhece esse botão de lá, e um botão que só liga e desliga o 2x obrigaria a
// ouvir o meio-termo em velocidade normal.
//
// UMA ESCOLHA SÓ PARA TODOS OS ÁUDIOS, e guardada no navegador, como o som do
// aviso: quem ouve em 2x quer ouvir o próximo em 2x também. Escolhida numa
// bolha, todas as outras acompanham na hora — por isso ela mora aqui, fora de
// cada bolha, com quem quiser ouvir avisado da troca. Cada bolha com o seu
// estado faria duas bolhas da mesma conversa tocarem em velocidades
// diferentes, com o botão de cada uma dizendo uma coisa.
//
// O ARMAZENAMENTO PODE FALTAR (janela anônima, cache bloqueado): aí a escolha
// vale até fechar a aba, e nada estoura.
import { useSyncExternalStore } from "react";

export const VELOCIDADES = [1, 1.5, 2];
const CHAVE = "zorvin_velocidade_audio";

function lerGuardada() {
  try {
    const v = Number(localStorage.getItem(CHAVE));
    return VELOCIDADES.includes(v) ? v : 1;
  } catch (_) { return 1; }
}

let atual = lerGuardada();
const ouvintes = new Set();

export function proximaVelocidade() {
  atual = VELOCIDADES[(VELOCIDADES.indexOf(atual) + 1) % VELOCIDADES.length];
  try { localStorage.setItem(CHAVE, String(atual)); } catch (_) { /* vale até fechar a aba */ }
  ouvintes.forEach((f) => f());
}

export function useVelocidadeDoAudio() {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => ouvintes.delete(f); },
    () => atual,
  );
}

/** "1x", "1,5x", "2x" — com vírgula, que é como se escreve aqui. */
export const rotuloDaVelocidade = (v) => `${String(v).replace(".", ",")}x`;
