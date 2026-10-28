-- DISPENSAR UM AVISO DE FALHA, PARA A EQUIPE INTEIRA.
--
-- >>> RODAR NO SUPABASE DO **ZORVIN** (o das conversas), não no do Vantoro. <<<
--
-- POR QUE ISTO EXISTE. O aviso vermelho de "não deu para enviar" é lido de
-- `fila_envio` com `status = 'erro'`. Dispensar o aviso é gravar
-- `status = 'descartada'` — um estado que a ponte não processa, e que preserva
-- o registro da tentativa para quem for investigar depois.
--
-- Só que 'descartada' é um valor que SÓ O PAINEL usa. Se a coluna tiver uma
-- lista fechada de valores (uma restrição CHECK) escrita a partir do que a
-- ponte grava, o painel apanha um erro ao dispensar — e o aviso ficava na tela
-- para sempre, sem gesto capaz de tirá-lo dali.
--
-- O painel já foi consertado e passou a guardar no próprio aparelho o que foi
-- dispensado, então o botão funciona mesmo sem este script. O que este script
-- resolve é o resto: fazer o aviso sumir TAMBÉM para os colegas, em qualquer
-- computador ou celular.
--
-- É seguro rodar mais de uma vez — e, desde 28/10, rodar de novo não desfaz
-- nada do que a ponte fez depois.
--
-- REESCRITO NA AUDITORIA DE 28/10. A versão anterior APAGAVA toda regra
-- (CHECK) de `status` e recriava uma lista fixa — pendente, enviando, enviada,
-- erro, descartada —, sem o 'cancelada' que a ponte acrescentou depois (script
-- automático 014, o da mensagem agendada). Rodada hoje, ela faria todo
-- "Cancelar" de mensagem agendada ser recusado (23514); e, com uma linha já
-- cancelada no banco, deixava a coluna SEM regra nenhuma. E recriava a
-- permissão valendo também para `anon` — quem não entrou —, que a ponte fechou
-- em `sql/2026-09-a-lista-da-equipe-nao-e-publica.sql`.
--
-- AGORA ELE FAZ COMO O 014 DA PONTE: em cada regra de `status` que ainda não
-- conhece 'descartada' e que é SÓ uma lista de valores, refaz a regra com a
-- MESMA lista mais 'descartada', com o mesmo nome. Nenhum valor que já valia
-- deixa de valer. Regra com qualquer outra coisa dentro não é tocada: o aviso
-- a mostra, e o conserto vira uma conversa. Sem regra nenhuma de status, não
-- há o que fazer — 'descartada' já passa.
--
-- CONFERIDO NUM POSTGRES 16 DE VERDADE (28/10), nos cenários que importam:
--   A) regra com a lista de hoje (com 'cancelada') e sem 'descartada' — a
--      regra ganha 'descartada' e continua aceitando 'cancelada';
--   B) sem regra nenhuma — nada muda, e 'descartada' já passa;
--   C) regra com outra coisa dentro (um "and") — não é tocada, e o aviso diz;
--   D) rodar duas vezes — a segunda não muda nada;
--   E) com RLS ligada: quem entrou dispensa (erro -> descartada), quem não
--      entrou não, e devolver a linha para 'pendente' — que faria a ponte
--      REENVIAR a mensagem ao cliente — é recusado.

-- ---------------------------------------------------------------------------
-- 1) ANTES: o que está lá hoje. Guarde os dois resultados.
-- ---------------------------------------------------------------------------
select 'antes' as quando, con.conname as restricao, pg_get_constraintdef(con.oid) as regra
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and rel.relname = 'fila_envio' and con.contype = 'c';

-- QUE VALORES EXISTEM DE VERDADE NA COLUNA HOJE.
--
-- Um `status` NULO aqui merece atenção à parte: a ponte só despacha
-- `status = 'pendente'`, então uma linha nula é uma mensagem que nunca vai
-- sair. (O painel tinha um caminho assim — o botão "reenviar" gravava sem
-- escrever o status —, já corrigido; se aparecerem nulos, são dessa época.)
select coalesce(status, '(nulo)') as status_encontrado, count(*) as quantas
from public.fila_envio
group by status
order by quantas desc;

-- ---------------------------------------------------------------------------
-- 2) A LISTA DE VALORES PASSA A INCLUIR 'descartada' — SEM TIRAR NENHUM.
--
--    Tudo num bloco só: não existe instante em que a fila fique sem regra, e
--    um erro no meio desfaz o bloco inteiro.
-- ---------------------------------------------------------------------------
do $descartada$
declare
  r record;
  valores text[];
  resto text;
begin
  for r in
    select c.conname, pg_get_constraintdef(c.oid) as def
      from pg_constraint c
     where c.conrelid = 'public.fila_envio'::regclass and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%status%'
       and pg_get_constraintdef(c.oid) !~* '\mdescartada\M'
  loop
    -- OS VALORES DA LISTA: tudo o que está entre aspas simples. O Postgres
    -- escreve a lista de dois jeitos — `ARRAY['a'::text, 'b'::text]` ou
    -- `'{a,b}'::text[]` — e o segundo é um literal só, que se abre aqui.
    select array_agg(v order by n, k)
      into valores
      from regexp_matches(r.def, '''([^'']*)''', 'g') with ordinality as t(m, n),
           lateral unnest(case when m[1] like '{%}'
                               then string_to_array(btrim(m[1], '{}'), ',')
                               else array[m[1]] end) with ordinality as u(v, k);

    -- O QUE SOBRA sem os valores, os tipos e a pontuação tem de ser só a
    -- palavra "status" e as palavras da forma da lista. Qualquer outra coisa
    -- (outra coluna, "AND", "OR", "IS NOT NULL", uma função) = não mexo.
    resto := regexp_replace(r.def, '''[^'']*''', ' ', 'g');
    resto := regexp_replace(resto, '::\s*(text|character varying|varchar|character|bpchar)(\[\])?', ' ', 'gi');
    resto := regexp_replace(resto, '\m(CHECK|status|ANY|ARRAY|IN)\M', ' ', 'gi');
    resto := regexp_replace(resto, '[\s\(\)\[\],=]', '', 'g');

    if resto = '' and coalesce(array_length(valores, 1), 0) > 0 then
      execute format('alter table public.fila_envio drop constraint %I', r.conname);
      execute format(
        'alter table public.fila_envio add constraint %I check (status::text = any (array[%s]::text[]))',
        r.conname,
        (select string_agg(quote_literal(v), ', ') from unnest(array_append(valores, 'descartada')) v));
      raise notice 'a regra % passou a aceitar descartada, e continua aceitando %.', r.conname, valores;
    else
      raise notice 'NAO MEXI na regra % (ela tem mais do que uma lista de valores; me mande esta mensagem): %',
        r.conname, r.def;
    end if;
  end loop;
end $descartada$;

-- ---------------------------------------------------------------------------
-- 3) O PAINEL PODE FAZER ESTA TROCA — E SÓ ELA.
--
--    A outra maneira de o gesto falhar é a regra de acesso: o banco não
--    reclama, ele simplesmente atualiza zero linhas e responde "tudo certo".
--
--    A permissão abaixo é a mais estreita possível: só sai de 'erro', só entra
--    em 'descartada'. Não deixa o painel marcar nada como 'enviada', nem
--    devolver uma linha para 'pendente' (o que faria a ponte REENVIAR a
--    mensagem ao cliente). Se a tabela não estiver com RLS ligada, criar a
--    permissão não muda nada — e não atrapalha.
-- ---------------------------------------------------------------------------
--    SÓ PARA QUEM ENTROU (`authenticated`), como a ponte deixou em
--    `2026-09-a-lista-da-equipe-nao-e-publica.sql`: com `anon` junto, alguém
--    de fora faria sumir todas as bolhas vermelhas do escritório de uma vez.
--
--    O PAPEL É CONFERIDO ANTES. `authenticated` é do Supabase; num Postgres
--    comum ele não existe, e `create policy ... to authenticated` pararia o
--    script com um ERRO vermelho no meio.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'sem o papel "authenticated" (nao e um Supabase?) — pulei a permissao.';
    return;
  end if;
  drop policy if exists "painel dispensa aviso de falha" on public.fila_envio;
  create policy "painel dispensa aviso de falha"
    on public.fila_envio
    for update
    to authenticated
    using (status = 'erro')
    with check (status = 'descartada');
  raise notice 'permissao criada: quem entrou pode trocar erro -> descartada, e so isso.';
end $$;

-- ---------------------------------------------------------------------------
-- 4) DEPOIS: confirmação de que ficou como deveria.
-- ---------------------------------------------------------------------------
select 'depois' as quando, con.conname as restricao, pg_get_constraintdef(con.oid) as regra
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and rel.relname = 'fila_envio' and con.contype = 'c';

select status, count(*) as quantas
from public.fila_envio
group by status
order by quantas desc;
