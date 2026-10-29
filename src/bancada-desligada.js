// O LUGAR DA BANCADA NO PACOTE QUE VAI PARA O AR (auditoria de 27/10).
//
// `supabase.js` importa a bancada para poder usá-la com `VITE_BANCADA=1`, e
// um `import` no alto do arquivo entra no pacote mesmo quando não é usado.
// Entrava inteiro: ~35 KB a mais por abertura do painel, e o módulo RODAVA a
// cada abertura — montando milhares de linhas de mentira (as conversas, as
// mensagens e os contatos da bancada) que ninguém ia ler. Medido, ~50 ms de
// processador só para isso, no navegador de cada atendente.
//
// Sem a bancada ligada, o `vite.config.js` troca o módulo de verdade por este,
// que não tem nada dentro. Com ela ligada (as provas, o servidor de teste), a
// troca não acontece.
export const supabase = null;
