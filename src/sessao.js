// ============================================================
//  INSTALAR UMA SESSÃO QUE JÁ VEIO PRONTA
//
//  A entrada normal é assim: a ponte pede um bilhete de uso único ao Auth do
//  Supabase, o painel troca por uma sessão (`verifyOtp`) e pronto. São duas
//  conversas com o mesmo serviço.
//
//  Em 19/08 esse serviço ficou fora do ar uma manhã inteira e o escritório
//  não entrou. Agora a ponte também sabe assinar a sessão sozinha, com o
//  segredo do projeto, e este arquivo é o que faz o painel aceitá-la.
//
//  POR QUE NÃO `supabase.auth.setSession`. Porque ela também fala com o Auth:
//  antes de guardar a sessão, a biblioteca vai buscar o usuário em
//  `GET /auth/v1/user` para conferir o bilhete. Com o Auth fora, ela falha
//  igual — foi a primeira coisa que eu tentei, e conferi lendo o código da
//  biblioteca instalada. Aqui a sessão é escrita direto no lugar onde a
//  própria biblioteca a guarda, e a página recarrega para ela achá-la ali.
//
//  E O QUE ELA ACHA, ELA ACEITA SEM REDE: `getSession` devolve a sessão
//  guardada quando o prazo dela não venceu, sem chamada nenhuma. Só quando o
//  prazo vence é que a biblioteca vai tentar renovar — e aí, sim, precisa do
//  Auth. Por isso o bilhete assinado dura doze horas em vez de uma: cobre o
//  expediente inteiro.
//
//  A CHAVE E O ARMÁRIO SÃO OS DELA. `supabase.auth.storageKey` e
//  `supabase.auth.storage` são os que a biblioteca usa; se um dia ela mudar o
//  nome da chave, isto acompanha sozinho. Adivinhar o nome ("sb-<projeto>-
//  auth-token") funcionaria hoje e quebraria em silêncio numa atualização.
// ============================================================
import { supabase } from "./supabase.js";

/** Lê o miolo de um bilhete. Não confere nada — quem confere é o banco, com o
 *  segredo. Aqui é só para saber o nome e a foto de quem entrou. */
function mioloDoBilhete(jwt) {
  try {
    const meio = String(jwt).split(".")[1];
    const texto = atob(meio.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(texto)));
  } catch (_e) {
    return null;
  }
}

/** Guarda a sessão pronta e diz se conseguiu.
 *
 *  Devolver `false` em vez de estourar é de propósito: quem chama tem outro
 *  caminho para tentar, e uma exceção aqui apagaria a mensagem de erro certa. */
export async function instalarSessao(sessao) {
  try {
    const armario = supabase.auth && supabase.auth.storage;
    const chave = supabase.auth && supabase.auth.storageKey;
    if (!armario || !chave || !sessao || !sessao.access_token) return false;

    const dentro = mioloDoBilhete(sessao.access_token);
    if (!dentro || !dentro.sub) return false;

    const agora = Math.floor(Date.now() / 1000);
    const ate = Number(sessao.expira_em || dentro.exp || 0);
    if (!ate || ate <= agora) return false;

    await armario.setItem(chave, JSON.stringify({
      access_token: sessao.access_token,
      // SEM NADA QUE RENOVE, e é de propósito. Uma credencial de renovação
      // seria mais uma chave de vida longa guardada no navegador, e o que ela
      // compraria — não ter de entrar de novo amanhã — não paga o risco. A
      // biblioteca exige que este campo EXISTA para considerar a sessão
      // válida; vazio ela aceita, e quando o prazo vencer ela conclui que a
      // sessão acabou, que é exatamente a verdade.
      refresh_token: "",
      token_type: "bearer",
      expires_at: ate,
      expires_in: ate - agora,
      user: {
        id: dentro.sub,
        aud: dentro.aud || "authenticated",
        role: dentro.role || "authenticated",
        email: dentro.email || "",
        app_metadata: dentro.app_metadata || {},
        user_metadata: dentro.user_metadata || {},
        created_at: new Date(agora * 1000).toISOString(),
      },
    }));
    return true;
  } catch (_e) {
    return false;
  }
}
