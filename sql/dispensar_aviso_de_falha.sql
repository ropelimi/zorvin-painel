-- DISPENSAR UM AVISO DE FALHA, PARA A EQUIPE INTEIRA.
--
-- >>> RODAR NO SUPABASE DO **ZORVIN** (o das conversas), não no do Vantoro. <<<
--
-- POR QUE ISTO EXISTE. O aviso vermelho de "não deu para enviar" é lido de
-- `fila_envio` com `status = 'erro'`. Dispensar o aviso é gravar
-- `status = 'descartada'` — um estado que a ponte não processa, e que preserva
-- o registro da tentativa para quem for investigar depois.
--
-- Só que 'descartada' é um valor que SÓ O PAINEL usa: a ponte escreve apenas
-- 'pendente', 'enviando', 'enviada' e 'erro'. Se a coluna tiver uma lista
-- fechada de valores (uma restrição CHECK) escrita a partir do que a ponte
-- grava, o painel apanha um erro ao dispensar — e o aviso ficava na tela para
-- sempre, sem gesto capaz de tirá-lo dali.
--
-- O painel já foi consertado e passou a guardar no próprio aparelho o que foi
-- dispensado, então o botão funciona mesmo sem este script. O que este script
-- resolve é o resto: fazer o aviso sumir TAMBÉM para os colegas, em qualquer
-- computador ou celular.
--
-- É seguro rodar mais de uma vez.
--
-- CONFERIDO NUM POSTGRES DE VERDADE, e não só lido, nos quatro cenários que
-- importam:
--   A) tabela com CHECK que não conhece 'descartada' (o caso do relato) — a
--      restrição velha sai, a nova entra;
--   B) tabela sem CHECK nenhum — a restrição entra;
--   C) tabela com um valor legado fora da lista ('cancelada') — o script NÃO
--      cria a restrição, avisa qual valor atrapalha e deixa tudo como estava;
--   D) com RLS ligada, agindo como `anon`: dispensar (erro -> descartada)
--      passa, e devolver a linha para 'pendente' — que faria a ponte REENVIAR
--      a mensagem ao cliente — é RECUSADO pela permissão.

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
-- Isto não é curiosidade: se houver uma linha com um valor fora da lista, o
-- passo 2 falha ao criar a restrição — e falha com razão, porque criar uma
-- regra que os dados já violam não é conserto, é apagar o problema de vista.
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
-- 2) A LISTA DE VALORES PASSA A INCLUIR 'descartada'.
--
--    Remove qualquer restrição CHECK que fale de `status` e recria UMA, com a
--    lista completa. Remover sem recriar deixaria a coluna aceitar qualquer
--    palavra — e um 'enviadaa' com erro de digitação viraria uma mensagem que
--    nunca sai e ninguém vê.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'fila_envio' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.fila_envio drop constraint %I', c.conname);
    raise notice 'restricao removida: %', c.conname;
  end loop;
end $$;

-- A RESTRIÇÃO SÓ ENTRA SE OS DADOS JÁ COUBEREM NELA.
--
-- Sem esta conferência, uma única linha antiga com um valor fora da lista faz o
-- `alter table` estourar — e o script pararia no meio, com a restrição velha já
-- removida no passo acima. Quer dizer: a coluna ficaria SEM regra nenhuma, que
-- é pior do que estava. Aqui ele avisa qual valor atrapalha e deixa tudo como
-- estava, para a decisão ser de quem conhece o dado.
do $$
declare fora text;
begin
  select string_agg(distinct status, ', ') into fora
  from public.fila_envio
  where status is not null
    and status not in ('pendente', 'enviando', 'enviada', 'erro', 'descartada');

  if fora is not null then
    raise notice 'NAO criei a restricao: ha linhas com status fora da lista (%). Me mande esta mensagem.', fora;
  else
    alter table public.fila_envio
      add constraint fila_envio_status_check
      check (status in ('pendente', 'enviando', 'enviada', 'erro', 'descartada'));
    raise notice 'restricao criada com a lista completa.';
  end if;
end $$;

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
--    OS PAPÉIS SÃO CONFERIDOS ANTES. `anon` e `authenticated` são do Supabase;
--    num Postgres comum eles não existem, e `create policy ... to anon` para o
--    script com um ERRO vermelho no meio — depois de já ter mexido na
--    restrição. Quem estivesse rodando não saberia se o que veio antes valeu.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise notice 'sem o papel "anon" (nao e um Supabase?) — pulei a permissao.';
    return;
  end if;
  drop policy if exists "painel dispensa aviso de falha" on public.fila_envio;
  create policy "painel dispensa aviso de falha"
    on public.fila_envio
    for update
    to anon, authenticated
    using (status = 'erro')
    with check (status = 'descartada');
  raise notice 'permissao criada: o painel pode trocar erro -> descartada, e so isso.';
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
