# Etapa 2 — Banco PostgreSQL e operações autorizadas

## Entregue nesta etapa

- Migração `202611170002_operacao_segura.sql` **para executar após** a migração da Etapa 1.
- Oito novas tabelas, totalizando dez tabelas de aplicação (além do Supabase Auth).
- RLS de leitura por empresa/perfil; escrita de agendamento somente via RPC com autorização no banco.
- Criação com CPF validado, aviso para 6º+ agendamento global, duplicidade consultada **apenas na empresa** e idempotência.
- Reagendamento sem criar registro novo; cancelamento justificado; transições de resultado; tratativas; histórico.
- Notificações segundo destinatários definidos, estatísticas agregadas e função administrativa de limpeza.
- Biblioteca JavaScript `src/lib/agendamentos.js` para futura integração às telas.

**Não é um sistema pronto para produção.** Nesta etapa não foram conectadas as telas operacionais, nem implementados a gestão administrativa de usuários, CRUD de empresas, edição cadastral, exclusão manual, tela de backup, execução agendada da limpeza, Dashboard real ou testes completos de concorrência/RLS. A etapa não prova conformidade LGPD.

## Instalação

1. Faça **backup/snapshot do seu banco de desenvolvimento antes de migrar**. Não execute em produção.
2. No Supabase > SQL Editor, confirme que a migração `202611170001_initial_access.sql` já foi executada.
3. Abra e execute `supabase/migrations/202611170002_operacao_segura.sql` **inteiro, de uma vez**. O script foi escrito para uma instalação nova e não é idempotente: não rode uma segunda vez no mesmo banco.
4. Execute em seu terminal `npm install` e `npm run build`; depois `npm run dev`.
5. Teste com usuários de laboratório vinculados às empresas e perfis já previstos na Etapa 1.

## Segurança e decisões operacionais

- Nunca use `service_role`/chave secreta no `.env` do React. Autentique via Supabase Auth; as RPCs usam `auth.uid()` e conferem o estado atual da conta e da empresa.
- Nenhuma inserção/alteração de agendamento está concedida diretamente a `authenticated`; apenas RPCs explicitamente autorizadas são expostas.
- A checagem de **lotação é global**, mas o alerta de **CPF repetido é restrito à empresa** (decisão provisória documentada). Na duplicidade entram registros não CANCELADOS, inclusive DESBLOQUEADO, até a retenção eliminar os registros.
- Para a ocupação contam apenas AGENDADO, EM ATENDIMENTO e REAGENDADO. A contagem é revalidada dentro da transação; se houver pelo menos cinco ocupações, a RPC devolve `CONFIRMACAO_NECESSARIA`, `ocupacao`, `aviso_lotacao` e `cpf_duplicado`. A UI deve mostrar aviso e reenviar **a mesma** `operacaoId` com `confirmarLotacao=true`, `contagemConfirmada=<ocupacao>` e/ou `confirmarDuplicidade=true`. Se a contagem mudar, o banco exigirá nova confirmação. Não há limite físico.
- Use UUID aleatório uma vez por tentativa lógica de criação, por exemplo `crypto.randomUUID()` no navegador, e mantenha **o mesmo UUID** até o sucesso para evitar duplicatas em falhas de rede.
- O CPF é normalizado e validado no servidor, a data deve estar no futuro de São Paulo, o horário deve usar múltiplos de 15 minutos, e o responsável sempre é o autor da criação.
- As RPCs de reagendamento, cancelamento e resultado exigem a versão atual; recarregue os dados se houver erro de concorrência.
- O banco contém uma função de limpeza, mas **nenhum cron é habilitado por esta entrega**. A limpeza só deve ser agendada após testes da política e restauração.
- A função `ieva_letras()` usa a classe de caracteres POSIX `[:alpha:]`; **valide a collation/Unicode do banco** com justificativas acentuadas e letras não latinas antes de ativar cancelamentos em produção.
- O backup real e a recuperação do Auth continuam pendentes e necessitam executor externo seguro.

## Consultas de verificação no SQL Editor

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in (
 'empresas','usuarios','agendamentos','historico_agendamentos','tratativas',
 'notificacoes','auditoria','estatisticas_diarias','configuracoes','operacoes_administrativas');

select public.ieva_cpf_valido('529.982.247-25') as cpf_teste_valido;
select public.ieva_letras('ação teste') as letras_acentuadas;
select count(*) from public.agendamentos;
```

**Atenção:** consultas no SQL Editor com papel administrador **não testam RLS do navegador**. Para verificar isolamento use tokens de contas de laboratório em cada perfil. Tente SELECT de outra empresa, POST direto em `agendamentos`, chamada de RPC com empresa alheia, edição de terceiro, acesso como usuário inativo e transições ilegais. Todos devem ser rejeitados.

## Continuação

Integrar a página Novo Agendamento usando `src/lib/agendamentos.js`, Central com modal e paginação, testes de concorrência, gestão administrativa protegida e rotina Cron de limpeza. Somente após isso avançar para estatísticas do Dashboard e backup manual.
