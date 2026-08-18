# Provas do painel

    npm install
    npm run prova            # tudo
    npm run prova etiquetas  # só uma

## Como funciona

As provas abrem o painel **de verdade** num navegador e conferem o que aparece
na tela. Do outro lado não há Supabase nenhum: o `src/bancada.js` responde no
lugar dele quando o Vite roda com `VITE_BANCADA=1`.

A bancada não é um banco de brinquedo. Ela tem, de propósito:

- **um telefone com 1.200 conversas e 1.100 não lidas** — porque o teto de
  1.000 linhas da API do Supabase corta e não avisa, e defeito de teto só
  aparece acima do teto;
- **o mesmo teto de 1.000 linhas**, pelo mesmo motivo: uma bancada que devolve
  tudo esconde o defeito que mais se repete neste projeto;
- **`ilike` e `or` de verdade** — enquanto eram cano vazio, a bancada devolvia
  tudo para qualquer termo e a busca parecia achar o que nunca procurou;
- **atraso na consulta de conversas**, para o "pisca" entre o clique e a
  resposta durar o suficiente para ser medido;
- **mensagens nascidas de um roteiro de atendimentos**, com horário e espera
  reais — sem isso, tudo o que depende de tempo mede zero e passa.

## Dois servidores, de propósito

| prova | servidor | por quê |
|---|---|---|
| `painel` | `vite` (desenvolvimento) | importa `src/supabase.js` direto para trocar o estado da bancada no meio do teste |
| `desempenho` | `vite preview` (produção) | o React de desenvolvimento gasta em verificações que não existem em produção; medir ali mediria o instrumento |
| `busca`, `telas`, `etiquetas` | qualquer um | |

O `npm run prova` cuida disso sozinho.

## O que elas cobrem

| | |
|---|---|
| **painel** | os números do Painel contra o roteiro da bancada; os filtros de período, usuário, telefone e departamento; o que muda para quem não administra; e o aviso quando falta rodar o SQL |
| **busca** | acha pelos três nomes que uma pessoa pode ter, pelo número escrito à mão e pelo que foi **dito** na conversa — inclusive na conversa 1.151 de 1.200, que a lista não carregou |
| **telas** | abre cada tela e cada modal escutando o console: no React 18 um erro não derruba a tela, mata a árvore onde aconteceu — um botão para de responder e mais nada acontece |
| **desempenho** | quantas linhas a lista desenha, o tamanho do DOM, a latência de uma tecla num computador 4× mais lento, e se dá para chegar na conversa 1.200 |
| **etiquetas** | a conversa fixada sobe ao topo mesmo morando na página 6 do banco, e o filtro por etiqueta acha as que estão fora da lista carregada |

## Se o navegador não abrir

O padrão é o Chromium que o Playwright instala (`npx playwright install
chromium`). Para usar outro:

    PLAYWRIGHT_CHROMIUM=/caminho/do/chrome npm run prova
