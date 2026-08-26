-- OS SELOS DE TODOS OS TELEFONES NUMA IDA SÓ.
--
-- RODAR NO SUPABASE DO **ZORVIN** (o projeto das tabelas `conversas`,
-- `mensagens`, `contatos`), no SQL Editor. Não é no Supabase do Vantoro.
--
-- POR QUE ISTO EXISTE
--
-- O painel mostra, na barra lateral, quantas conversas não lidas cada telefone
-- tem. Ele perguntava isso um telefone de cada vez: com treze telefones eram
-- treze consultas, mais duas das arquivadas — quinze viagens à internet para
-- produzir treze números pequenos.
--
-- E ele repetia essas quinze A CADA MENSAGEM QUE CHEGA. Medido na bancada:
-- 31 idas ao banco por mensagem recebida, em cada aba aberta do escritório.
-- Vinte mensagens numa rajada custavam 620 consultas. É isso que engasgava a
-- tela em horário de movimento — não uma consulta lenta, uma multidão delas.
--
-- Somar por telefone é o que um `group by` faz numa passada só. Com esta
-- função a mesma resposta cabe em UMA viagem.
--
-- É SEGURO RODAR MAIS DE UMA VEZ. `create or replace` substitui a versão
-- anterior; não cria tabela, não apaga nada, não altera nenhuma linha.
--
-- ENQUANTO NÃO FOR RODADA o painel continua funcionando: ele tenta a função,
-- recebe "não existe" (PGRST202) e volta ao jeito antigo, uma vez por sessão.
-- Ou seja: rodar isto deixa mais rápido; não rodar não quebra nada.

-- A versão de assinatura antiga sai antes, se existir. `create or replace` só
-- substitui quando a assinatura é idêntica; com um parâmetro a mais ele criaria
-- uma SEGUNDA função com o mesmo nome, e o PostgREST não saberia qual chamar.
drop function if exists public.nao_lidas_por_telefone(text);

create or replace function public.nao_lidas_por_telefone(
  p_advogado  text   default null,
  -- OS TELEFONES QUE QUEM PERGUNTOU PODE VER.
  --
  -- O painel mostra a cada atendente só os telefones a que ele tem permissão
  -- (tabela `permissoes`). Uma contagem que voltasse com TODOS entregaria ao
  -- navegador o movimento de telefones que aquela pessoa não abre — e o
  -- navegador é do lado de lá, onde qualquer um lê a resposta. Então a lista
  -- vai junto na pergunta e o corte é feito aqui, no banco.
  --
  -- `null` quer dizer "sem recorte", para quem vê tudo.
  p_telefones text[] default null)
returns json
language sql
stable
-- `security invoker`: a função enxerga exatamente o que quem chamou enxerga.
-- Com `definer` ela passaria por cima das políticas de acesso e um atendente
-- veria a contagem de telefones que não são dele.
security invoker
set search_path = public
as $$
  select json_build_object(
    -- { "id-do-telefone": quantas }, só para quem tem alguma.
    -- Quem não aparecer aqui tem zero, e é o painel que preenche o zero: a
    -- lista de telefones da tela é dele, e ele sabe quais perguntou.
    'por_telefone', coalesce((
      select json_object_agg(advogado_id::text, n)
        from (
          select advogado_id, count(*) as n
            from public.conversas
           where nao_lidas > 0
             -- ARQUIVADA NÃO CONTA: ninguém vai atendê-la, e o selo tem de
             -- bater com o que a pessoa consegue contar olhando a lista.
             -- `coalesce` porque a coluna aceita nulo nas linhas antigas.
             and coalesce(arquivada, false) = false
             and advogado_id is not null
             and (p_telefones is null or advogado_id::text = any(p_telefones))
           group by advogado_id
        ) t
    ), '{}'::json),
    -- As arquivadas do telefone ABERTO. Vem junto de propósito: são números
    -- que a tela mostra lado a lado, e em duas consultas separadas um deles
    -- piscaria com o valor novo enquanto o outro ainda tem o velho.
    -- Sem telefone aberto, `null` — que o painel lê como "não perguntei",
    -- diferente de zero.
    'arquivadas', case when p_advogado is null then null else (
      select json_build_object(
        'total', count(*),
        'nao_lidas', count(*) filter (where nao_lidas > 0)
      )
        from public.conversas
       where advogado_id::text = p_advogado
         and coalesce(arquivada, false) = true
    ) end
  );
$$;

-- Quem pode chamar: os mesmos papéis que já leem `conversas` pelo painel.
grant execute on function public.nao_lidas_por_telefone(text, text[]) to anon, authenticated;

-- ÍNDICE PARA A CONTAGEM. Sem ele o `group by` varre a tabela inteira toda vez;
-- com ele o banco lê só as linhas que interessam, que são poucas.
-- `if not exists` para poder rodar este arquivo de novo sem erro.
create index if not exists conversas_nao_lidas_por_telefone
  on public.conversas (advogado_id)
  where nao_lidas > 0;

-- CONFERÊNCIA. Rode depois e compare com os selos da tela:
--   select public.nao_lidas_por_telefone();
