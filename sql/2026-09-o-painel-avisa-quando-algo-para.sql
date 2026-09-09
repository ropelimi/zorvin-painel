-- ============================================================
--  O PAINEL AVISA QUANDO ALGO PARA
--
--  >>> RODAR NO SUPABASE DO **ZORVIN** (o das conversas). <<<
--  Dashboard → SQL Editor → New query → cole tudo → Run.
--  Pode rodar de novo sem medo.
--
--  ------------------------------------------------------------
--  O QUE ISTO CONSERTA
--
--  As últimas rodadas encheram a ponte de proteções: a caixa de entrada guarda
--  o evento antes de prometer, a fila tenta de novo sozinha, a saída termina o
--  que está no meio. Todas elas AVISAM quando algo dá errado — no log.
--
--  E ninguém abre o log. Foi assim com a linha do escritório que caiu em 19/08
--  e com o `IMPORT_TOKEN` que nunca foi criado: em ambos os casos a máquina
--  vinha dizendo o que estava errado, para uma tela que ninguém olhava.
--
--  Esta função leva os mesmos sinais para onde as pessoas JÁ estão o dia
--  inteiro: o painel.
--
--  ------------------------------------------------------------
--  POR QUE UMA FUNÇÃO, E NÃO O PAINEL LENDO AS TABELAS
--
--  Porque `eventos_recebidos` guarda conteúdo de cliente — o evento inteiro,
--  com texto e telefone — e nasceu fechada: ninguém logado a alcança. Abrir a
--  tabela para o painel poder contar linhas seria desfazer isso por causa de um
--  número.
--
--  Esta função é `security definer`: ela enxerga o que precisa e devolve
--  CONTAGENS. Nenhum texto de mensagem, nenhum telefone de cliente sai daqui.
--  O único texto que sai é o nome dos telefones do escritório cuja linha caiu,
--  que é justamente o que quem atende precisa ler para saber que não adianta
--  responder por ali.
--
--  ------------------------------------------------------------
--  DEPENDE DE DUAS COISAS JÁ RODADAS
--
--    sql/2026-09-a-caixa-de-entrada-do-webhook.sql        (eventos_recebidos)
--    sql/2026-09-a-mensagem-que-nao-saiu-tenta-de-novo.sql (fila_envio.tentar_em)
--
--  A primeira é conferida aqui dentro: se a tabela não existir, os sinais dela
--  simplesmente não aparecem, e o resto funciona. A segunda é obrigatória — sem
--  a coluna, esta função dá erro, e o painel diz isso na tela em vez de calar.
-- ============================================================

create or replace function public.zorvin_saude()
returns table (sinal text, quantas integer, desde timestamptz, detalhe text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ----------------------------------------------------------
  --  A FILA PAROU: mensagem que a equipe escreveu e não saiu.
  --
  --  Cinco minutos. O ciclo roda de 3 em 3 segundos, então qualquer coisa
  --  parada há cinco minutos não está "demorando" — está parada, e a ponte
  --  provavelmente não está no ar.
  --
  --  O ITEM QUE ESTÁ ESPERANDO A PRÓXIMA TENTATIVA NÃO CONTA. Ele tem hora
  --  marcada e está funcionando exatamente como projetado; contá-lo faria a
  --  retentativa automática acender um alarme a cada falha de rede — e alarme
  --  que toca à toa é alarme que se aprende a ignorar.
  -- ----------------------------------------------------------
  return query
  select 'fila_parada'::text, count(*)::int, min(f.criado_em), null::text
    from fila_envio f
   where f.status = 'pendente'
     and f.criado_em < now() - interval '5 minutes'
     and (f.tentar_em is null or f.tentar_em < now() - interval '1 minute')
  having count(*) > 0;

  -- ----------------------------------------------------------
  --  A FILA TRAVOU: item reivindicado e nunca concluído.
  --
  --  A própria ponte destrava isso depois de cinco minutos. Ver este sinal
  --  quer dizer que nem o destravamento está rodando — ou seja, a ponte está
  --  fora do ar, e é o mesmo diagnóstico do sinal de cima por outro caminho.
  -- ----------------------------------------------------------
  return query
  select 'fila_travada'::text, count(*)::int, min(f.enviando_em), null::text
    from fila_envio f
   where f.status = 'enviando'
     and f.enviando_em < now() - interval '6 minutes'
  having count(*) > 0;

  -- ----------------------------------------------------------
  --  A LINHA DO ESCRITÓRIO CAIU.
  --
  --  É o aviso mais acionável de todos, e o único que diz um nome: enquanto
  --  ninguém reconectar aquele aparelho, NADA sai por ele. Quem está atendendo
  --  por essa linha precisa saber antes de prometer resposta ao cliente.
  --
  --  Meia hora de janela: mais curto perderia a linha que caiu de madrugada,
  --  mais longo manteria o aviso na tela depois de o aparelho voltar.
  -- ----------------------------------------------------------
  return query
  select 'linhas_caidas'::text,
         count(distinct a.id)::int,
         min(f.criado_em),
         string_agg(distinct coalesce(a.nome, a.numero), ', ')
    from fila_envio f
    join conversas c on c.id = f.conversa_id
    join advogados a on a.id = c.advogado_id
   where f.status = 'erro'
     and f.criado_em > now() - interval '30 minutes'
     and (coalesce(f.erro_motivo, '') || ' ' || coalesce(f.erro_detalhe, ''))
         ~* '(desconect|disconnected|not connected|reconectar)'
  having count(*) > 0;

  -- ----------------------------------------------------------
  --  A CAIXA DE ENTRADA — só se ela existir.
  --
  --  `to_regclass` devolve nulo quando a tabela não foi criada. Sem esta
  --  conferência, um banco sem a caixa faria a função inteira dar erro, e o
  --  painel perderia TAMBÉM os três sinais de cima — trocando um aviso que
  --  falta por nenhum aviso.
  -- ----------------------------------------------------------
  if to_regclass('public.eventos_recebidos') is not null then
    -- MENSAGEM DE CLIENTE QUE NÃO ENTROU. O evento falhou cinco vezes e a ponte
    -- parou de tentar. É o sinal mais grave que existe aqui: alguém escreveu
    -- para o escritório e a conversa não mostra. Vai para a tela de todo mundo,
    -- porque muda o que quem atende deve acreditar sobre uma conversa calada.
    return query
    execute $q$
      select 'eventos_desistidos'::text, count(*)::int, min(recebido_em), null::text
        from eventos_recebidos
       where processado_em is null and tentativas >= 5
      having count(*) > 0
    $q$;

    -- A CAIXA ATRASADA. A rodada de recuperação passa de 30 em 30 segundos;
    -- dois minutos de atraso quer dizer que ela não está passando. Diferente do
    -- de cima, isto costuma se resolver sozinho — por isso é aviso de quem
    -- administra, e não da tela de quem atende.
    return query
    execute $q$
      select 'eventos_pendentes'::text, count(*)::int, min(recebido_em), null::text
        from eventos_recebidos
       where processado_em is null
         and tentativas < 5
         and recebido_em < now() - interval '2 minutes'
      having count(*) > 0
    $q$;
  end if;
end $$;

comment on function public.zorvin_saude() is
  'Os sinais de que algo parou, em CONTAGENS — nenhum texto de mensagem e '
  'nenhum telefone de cliente sai daqui. Existe para o painel poder avisar sem '
  'alcançar `eventos_recebidos`, que guarda conteúdo e nasceu fechada.';

-- ------------------------------------------------------------
--  QUEM PODE PERGUNTAR: quem entrou. Mais ninguém.
-- ------------------------------------------------------------
revoke all on function public.zorvin_saude() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.zorvin_saude() from anon';
  end if;
end $$;
grant execute on function public.zorvin_saude() to authenticated;


-- ------------------------------------------------------------
--  CONFERÊNCIA — rode e leia
-- ------------------------------------------------------------
select 'a função existe' as item,
       to_regprocedure('public.zorvin_saude()') is not null as ok
union all
select 'quem entrou pode chamá-la',
       has_function_privilege('authenticated', 'public.zorvin_saude()', 'EXECUTE')
union all
select 'quem NÃO entrou não pode',
       not has_function_privilege('anon', 'public.zorvin_saude()', 'EXECUTE');

-- E o retrato de agora. NENHUMA LINHA é a resposta boa: quer dizer que não há
-- nada parado neste instante. Cada linha que aparecer é um aviso que o painel
-- vai mostrar.
select * from public.zorvin_saude();
