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
2. **Duplicação de mensagens enviadas**: já corrigida **na ponte** (ignora eco com `wasSentByApi === true`). Se voltar a duplicar, o problema é lá, não aqui.
3. Chatwoot foi tentado antes e abandonado (estourava a memória do plano free do Render). Não sugerir voltar sem discutir custo.

## Pendências / próximos passos

- **Mídias em alta resolução**: hoje imagens exibem só a miniatura vinda do webhook e áudios não têm arquivo. Depende de trabalho na **ponte** (baixar/descriptografar via Uazapi e salvar no Storage do Supabase).
- **Enviar anexos pelo painel**: o clipe e o microfone na caixa de mensagem são só visuais hoje.
- Ícones da barra lateral (telefone, engrenagem) ainda são decorativos.
- **E-mails (Gmail)**: fase futura, fora do escopo atual.

## Preferências de design já acordadas

- Visual o mais parecido possível com o **WhatsApp Web** (cores, bolhas, layout) — a equipe já conhece.
- Modo claro e escuro, alternável.
- Textos da interface em português.
