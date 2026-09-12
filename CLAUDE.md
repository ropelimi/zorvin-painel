# CLAUDE.md — Zorvin Painel (a interface)

> Contexto do projeto para o Claude Code. Leia antes de qualquer alteração.

## Quem é o usuário

Rodrigo (@ropelimi), gerente comercial de um escritório de advocacia. **Não é desenvolvedor** — se descreve como leigo. Explique em linguagem simples, evite jargão, e dê o passo a passo em vez de assumir conhecimento de terminal, Git ou infraestrutura. Fala português (pt-BR).

## O que é o Zorvin

Central de atendimento de WhatsApp da equipe de **Acordos e Execução** do escritório, sob a marca **Ropelimi**. Vários atendentes usam um painel único para responder as conversas de **vários advogados** (hoje ~8, pode crescer até 20).

Sistema **separado** do Vantoro (dashboard comercial do mesmo usuário). Não compartilham banco, login nem código.

## Arquitetura (3 peças)

```
WhatsApp ⇄ Uazapi ⇄ [zorvin-bridge] ⇄ Supabase ⇄ [zorvin-painel]
                     (repo separado)              (ESTE REPO)
```

- **zorvin-painel** (ESTE REPO) — Vite + React. Interface estilo WhatsApp Web. Render **Static Site** (free, não dorme).
- **zorvin-bridge** — Node.js + Express no Render. Faz a ponte com a Uazapi (recebe webhooks, envia mensagens).
- **Supabase** — Postgres + Auth + Realtime + Storage.

## Este repositório

```
index.html
vite.config.js
package.json         — deps: react, @supabase/supabase-js, lucide-react
src/
  main.jsx           — entrada
  App.jsx            — decide entre Login e Painel (checa sessão do Supabase)
  Login.jsx          — e-mail + senha (Supabase Auth)
  Painel.jsx         — a tela principal (99% da lógica está aqui)
  supabase.js        — cliente Supabase (chave anon)
```

Variáveis de ambiente (Render → Static Site):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — chave **anon** (pública, respeita RLS)

Build: `npm install && npm run build` · Publish directory: `dist`

## Como o painel funciona

- **Autenticação**: Supabase Auth (e-mail/senha). Usuários criados manualmente em Authentication → Users. "Confirm email" está desligado.
- **Seletor de advogado** no topo da coluna esquerda ("ATENDENDO COMO") — troca qual advogado está sendo atendido; a lista de conversas recarrega.
- **Lista de conversas**: `conversas` do advogado, ordenadas por `ultima_atividade`, com prévia e contador de não lidas.
- **Conversa aberta**: `mensagens` em ordem cronológica, bolhas verdes à direita (`origem = 'advogado'`) e brancas à esquerda (`origem = 'contato'`).
- **Realtime**: canal Supabase escuta INSERT em `mensagens` e UPDATE em `conversas` — mensagens novas aparecem sem recarregar.
- **Envio**: NÃO chama a Uazapi diretamente. Faz `insert` em `fila_envio` e a ponte cuida do resto.
- **Tema claro/escuro**: objeto `TEMAS` no topo do `Painel.jsx`, alternado pelo ícone lua/sol na barra lateral. Estilos são inline (sem Tailwind/CSS externo).
- **Avatares**: componente `Avatar` mostra `foto_url` se existir; senão a inicial com cor estável derivada do nome.

## Banco de dados (tabelas que o painel lê/escreve)

- `advogados` — lê (id, nome, numero, foto_url) onde `ativo = true`
- `conversas` — lê (com join em `contatos`), atualiza `nao_lidas = 0` ao abrir
- `mensagens` — lê
- `fila_envio` — insere (é assim que envia)

RLS está **ligado** com políticas para o papel `authenticated`. Se uma consulta voltar vazia sem erro, suspeite de RLS antes de qualquer outra coisa.

## Armadilhas já encontradas (não repetir)

1. **RLS**: o painel usa a chave anon e respeita RLS. Ao criar tabela nova, criar a política junto, ou o painel verá vazio sem mensagem de erro.
2. **Erro de leitura engolido** (04/09/2026): `if (error) return;` e `if (!error) setX(...)` faziam a tela desenhar **ausência** no lugar de **falha**. As etiquetas sumiram de todas as conversas do escritório, e as notas internas junto — sem uma palavra na tela. O diagnóstico custou três rodadas para descobrir o que a tela sabia desde o primeiro segundo. Hoje as leituras de etiquetas, notas, respostas rápidas e fila anunciam a falha numa faixa no alto (`data-falha-de-leitura`), com o código do banco. **Ao acrescentar uma leitura nova, trate o `error`** — a prova `a-tela-diz-o-que-nao-carregou` cobre esse contrato.
3. **Política RESTRITIVA que lê outra tabela** (a causa do item acima): existem no banco `zorvin_setor_conversa_tags` e `zorvin_setor_notas`, que conferem `advogados.setor` antes de liberar a linha. Restritiva soma por "e", então **sempre** é avaliada — e, sem permissão na coluna que ela lê, a leitura da tabela inteira morre com `permission denied`. Antes de mexer em permissão de coluna, rode a varredura da parte 3b de `sql/2026-09-a-chave-da-uazapi-fica-guardada.sql` (no repo da ponte).
4. **Duplicação de mensagens enviadas**: já corrigida **na ponte** (ignora eco com `wasSentByApi === true`). Se voltar a duplicar, o problema é lá, não aqui.
5. Chatwoot foi tentado antes e abandonado (estourava a memória do plano free do Render). Não sugerir voltar sem discutir custo.

## Os avisos de que algo parou

A ponte é cheia de proteções que **avisam no log** — e ninguém abre o log. Foi
assim com a linha do escritório que caiu em 19/08 e com o `IMPORT_TOKEN` que
nunca foi criado: a máquina vinha dizendo o que estava errado, para uma tela que
ninguém olhava.

Hoje o painel pergunta `zorvin_saude()` de minuto em minuto e mostra numa faixa
**vermelha** no alto (`data-aviso-de-saude`). A função devolve **contagens**, não
conteúdo: o painel não alcança `eventos_recebidos`, que guarda texto de cliente e
nasceu fechada, e não é por causa de um número que isso muda.

**Duas plateias.** Quem atende vê só o que muda o que ela deve fazer agora —
mensagem que não saiu, linha caída (com o nome do telefone), mensagem de cliente
que não entrou. Quem administra vê também o que se resolve sozinho (a caixa
atrasada). Alarme que não pede ação se aprende a ignorar, e aí o próximo passa
batido junto.

A faixa vermelha e a **âmbar** (`data-falha-de-leitura`) dizem coisas
diferentes: a âmbar é sobre ESTA tela estar incompleta, a vermelha é sobre o
SISTEMA ter parado. As duas moram numa coluna fixa comum — cada uma `fixed` por
si punha uma em cima da outra.

SQL: `sql/2026-09-o-painel-avisa-quando-algo-para.sql`. **Sem a função, tudo como
antes** (aviso no console e nada na tela). Prova:
`o-painel-avisa-quando-algo-para`.

### O tempo real que cai

O canal era assinado com `.subscribe()` **sem retorno de chamada**: o painel
nunca sabia se ele estava de pé. Caindo a conexão, as mensagens novas paravam de
aparecer — e a tela de uma conversa sem mensagem nova é **idêntica** à de uma
conversa em que o cliente não respondeu.

Hoje o estado do canal entra na mesma faixa vermelha, depois de **10 segundos**
de carência (`CARENCIA_TEMPO_REAL_MS`) — um soluço de reconexão não pode fazer a
faixa piscar.

**E a volta RELÊ.** O `postgres_changes` não repete o que passou: o que o banco
publicou durante a queda não chega nunca. Avisar sem reler deixaria a pessoa
informada e a tela errada. A releitura vai por um **espelho** (`reporRef`), e não
pelas dependências do efeito — pôr `carregarMensagens` ali derrubaria o canal a
cada conversa aberta, que é o defeito das "trinta janelas de silêncio" descrito
no próprio arquivo. Prova: `o-tempo-real-que-cai-e-volta`.

### A linha desativada não some

A ponte recusa enviar por um telefone desativado (ver o CLAUDE.md dela). Só que
o painel lia `advogados` com `ativo = true`, e a conta não fechava: as conversas
daquela linha ficavam **gravadas e invisíveis**. O cliente que não soube da
mudança continua escrevendo para o número antigo, a mensagem entra no banco, e
ninguém no escritório alcança.

**Duas metades, e as duas importam:**

- `filtrarPermitidos` corta a desativada **para todo mundo, admin incluído**.
  Dessa lista sai tudo o que a tela OFERECE — nova conversa, encaminhar,
  escolher departamento —, e a ponte recusaria o envio: oferecer o gesto seria
  deixar alguém escrever uma resposta inteira para virar bolha vermelha depois.
- `desativadosVisiveis` traz as conversas de volta, numa seção separada da barra,
  **só para quem administra** — foi ele que desativou, e é ele quem vai querer
  saber o que ainda chega ali. Um atendente não tem o que fazer com elas.

Com a conversa aberta, a caixa de escrever dá lugar à explicação
(`data-linha-desativada`), que diz **o que fazer**: responder por outro telefone,
ou reativar. Prova: `a-linha-desativada-nao-some`.

### Armadilha das provas de navegador: `addInitScript` acumula

Cada chamada acrescenta **mais um** script, e todos rodam a cada carregamento.
Uma bandeira ligada num cenário continua valendo nos seguintes, e a prova passa a
reprovar falando de outro assunto. Aconteceu duas vezes. A saída é o ajudante que
abre a página escrever **todas** as bandeiras, sempre — a última escrita vence.

### O anexo que não vem mais

A tela dizia **"indisponível"** para duas coisas opostas: o arquivo que chega em
dois minutos e o que não existe mais. Quem atende esperava, recarregava, esperava
mais — e no segundo caso esperava por nada, sem saber que precisava pedir ao
cliente que mandasse de novo.

`mensagens.midia_erro` é a resposta **definitiva** da Uazapi, gravada pela ponte
(ela só marca quando a resposta não muda com o tempo; falha passageira continua
sendo tentada e não marca nada). Com ela preenchida, a bolha diz **"não veio —
peça para reenviar"**; sem ela, segue "indisponível". O motivo técnico vai no
`title`, não na bolha.

**Imagem e vídeo sem arquivo não desenhavam NADA** — a condição era
`tipo === "imagem" && midia_url`, então a bolha saía vazia e o cliente mandava
uma foto sem a conversa mostrar que ele mandou. Foi consertado junto; a figurinha
já tinha passado por isso, e a imagem ficara de fora.

SQL: `sql/2026-09-o-anexo-que-nao-vem-mais.sql` (no repo da ponte). Prova:
`o-anexo-que-nao-vem-mais`.

## Pendências / próximos passos

- ~~Mídias em alta resolução~~ e ~~enviar anexos pelo painel~~ — **as duas foram
  feitas**, e esta lista ficou meses dizendo o contrário. Isso tem custo: em
  11/09 uma sessão leu a lista em vez do código e recomendou refazer o que já
  estava pronto. **Ao terminar algo daqui, risque na mesma entrega.**
  - Enviar: `enviarArquivo` cobre imagem, vídeo, áudio, documento e figurinha,
    com prévia local; o microfone grava por `MediaRecorder` (ogg/opus, webm de
    reserva). Vai para `fila_envio` e a ponte envia por `/send/media`.
  - Receber: a ponte baixa pela Uazapi e guarda no Storage (`anexos`). **Em
    aberto, e é empírico**: neste servidor as três rotas de download
    responderam 405 ao POST (medido em 11/09); as tentativas por GET entraram
    depois e ainda não foram confirmadas com anexo de verdade.
- Ícones da barra lateral (telefone, engrenagem) ainda são decorativos.
- **E-mails (Gmail)**: fase futura, fora do escopo atual.

## Preferências de design já acordadas

- Visual o mais parecido possível com o **WhatsApp Web** (cores, bolhas, layout) — a equipe já conhece.
- Modo claro e escuro, alternável.
- Textos da interface em português.

## Fluxo de trabalho — PRs (REGRA IMPORTANTE do Rodrigo)

- **Cada entrega/pedido deve ir numa PR NOVA.** Nunca reutilizar nem estender uma PR já mesclada.
- O Rodrigo faz o merge e, na rodada seguinte, quer **sempre uma PR nova** (não empilhar em cima da anterior).
- Fluxo por rodada: recomeçar a branch a partir da `main` mais recente
  (`git fetch origin main && git checkout -B <branch> origin/main`), aplicar a mudança,
  commit, push e **abrir uma PR nova**.
- Passo a passo (SQL, merge, etc.) vai **no chat**, não na descrição da PR — o Rodrigo não lê a descrição para instruções de setup.
