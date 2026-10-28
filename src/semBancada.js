// O LUGAR DA BANCADA NO SITE PUBLICADO: vazio (auditoria de 28/10).
//
// `supabase.js` importa a bancada de forma estática, e o ternário que escolhe
// entre ela e o banco de verdade só é resolvido na hora de rodar. O Rollup não
// pode jogar fora um módulo que faz coisas ao ser carregado — e a bancada monta
// tabelas inteiras no nível de cima. Resultado medido no build de produção:
// os nomes e telefones de mentira (alguns copiados de casos reais, como os dos
// números sem o nono dígito), o `__TABELAS` e o "jwt-de-mentira" iam no
// JavaScript que qualquer pessoa baixa na tela de entrada — 35 KB a mais.
//
// O `vite.config.js` troca `./bancada.js` por este arquivo sempre que o build
// não é da bancada (`VITE_BANCADA` diferente de "1").
export const supabase = null;
