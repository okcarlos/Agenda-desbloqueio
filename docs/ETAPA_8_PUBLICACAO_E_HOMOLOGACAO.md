# Etapa 8 — Publicação controlada e homologação final

**Base do código:** Etapa 7, que preserva a correção de cores enviada pelo usuário na Etapa 5. **Linguagem:** JavaScript / JSX (React + Vite); backend Supabase/PostgreSQL e serviço de backup Node.js. Não há alteração das regras de negócio.

## Entregas reais desta etapa

1. `scripts/preflight.mjs`: verifica presença das migrações 001–006, arquivos essenciais, endereço Supabase e uso apenas de chave publicável no frontend. Bloqueia URL HTTP remota para backup e variáveis públicas que parecem conter segredos. Não conecta à internet ou banco.
2. `tests/preflight.test.js`: testes automatizados para configurações inválidas.
3. Roteiro de implantação, validação de RLS, retenção, restauração, performance e decisões de liberação.
4. Integração das verificações no workflow GitHub Actions.

**Esta etapa NÃO equivale à implantação real.** Sem credenciais, acesso ao projeto Supabase e servidor de hospedagem, não é possível afirmar que backup, limpeza automática, RLS ou aplicação estão operando em produção.

## Ordem de execução — ambiente de homologação

1. Faça cópia de segurança de sua versão local e do banco de homologação. Nunca rode migrações não testadas primeiro em produção.
2. Use Node 22 compatível. Na pasta do projeto execute: `npm ci`, `npm test`, `npm run build`.
3. Configure `.env` local a partir de `.env.example` com **somente** a URL do Supabase e sua chave publicável. Não adicione `service_role`, senha do PostgreSQL ou tokens privados em `VITE_*`.
4. Rode `npm run preflight` (com `.env` configurado). `npm run preflight:production` exige adicionalmente a URL do serviço de backup — mas **não** substitui testes reais.
5. Confirme no histórico de migrações do Supabase que `001` a `006` foram aplicadas **nessa ordem**. Esta Etapa 8 **não** traz nova migração obrigatória.
6. Configure as URLs de autenticação e recuperação de senha no painel Supabase e desative cadastro público. Garanta HTTPS no frontend e no serviço de backup.
7. Implante a Edge Function `criar-usuario` segundo a documentação da Etapa 4; use chave privilegiada exclusivamente no servidor. Teste a criação de parceiros e o impedimento de elevação de privilégio.
8. Faça os testes abaixo com duas empresas fictícias (X/Y), contas de cada perfil e dados fictícios. Registre evidências e resultado.

## Portões obrigatórios para autorização de publicação

| Área | Verificação obrigatória | Resultado atual |
| --- | --- | --- |
| Compilação | `npm ci`, testes, `npm run build` em máquina com dependências | A executar no seu ambiente |
| Auth | cadastro público desativado, senha provisória com troca obrigatória, recuperação, contas inativas | A homologar |
| RLS | Parceiro X não lê Y nem altera registros alheios; Admin empresa não cria perfis globais; Desbloqueio não edita cadastro; bloqueios valem por API | A homologar |
| Agendamento | CPF repetido permitido; 6º aviso sem bloqueio; horário de 15 min; idempotência e concorrência | A homologar |
| Status | seis cores padrão e cor customizada; regras de transição, ocupação e retenção respeitadas | Testes locais parciais; banco a homologar |
| Calendário / Dashboard | calendário mostra mês inteiro por perfil; indicadores preservados com totais corretos | A homologar |
| Notificações | novo/reagendamento só Desbloqueio; cancelamento/mudança só Admin empresa | A homologar |
| Retenção | limpar **somente** itens elegíveis após 7 dias; preservar agregados; revisar exceções legais | Não ativar sem teste de restauração |
| Backup | Admin geral apenas; criptografar; baixar; decriptografar, listar dump, restaurar em banco isolado | Serviço preparado, **não validado** |
| Autenticação em desastre | recuperação de Auth/Storage e contas, que não estão no dump de `public` | Plano complementar pendente |
| Carga | 21, 35 e 50 usuários simultâneos; até 500 agendamentos/dia; latência/erros/Realtime | Pendente |
| LGPD / operação | base legal, titular, retenções, incidentes e armazenamento dos backups | Revisão humana pendente |

**Critério de publicação:** todos os itens relevantes aprovados e responsáveis designados. Um teste local bem-sucedido não implica aprovação para uso comercial.

## Ativação controlada do Cron

- O SQL `supabase/manual/ativar_cron_retencao.sql` é **manual**, não ativado automaticamente. Confira disponibilidade de `pg_cron` no plano/projeto, privilégios, fuso da agenda e SQL real da função.
- Prepare banco descartável ou base de homologação; crie registros fictícios com status ativos e encerrados em datas distintas e confira o que **seria elegível** antes de rodar limpeza.
- Faça backup + teste de restauração primeiro. Então execute a rotina uma vez em homologação e confira logs/estatísticas/histórico. Só depois autorize o agendamento no ambiente de produção.
- Verifique `cron.job` e `cron.job_run_details`; monitore falhas. Lembre que agendar `03:10` no servidor não significa necessariamente `03:10` em São Paulo.
- Exceções legais de retenção e regras de privacidade devem ser revisadas antes de executar exclusões automáticas.

## Backup e recuperação

O worker em `backup-worker/` usa `pg_dump --schema=public`, verificações básicas e criptografia AES-256-GCM. **Não inclui Auth, Storage, outros schemas ou automaticamente secrets/configuração da infraestrutura.** Assim, não é um plano completo de recuperação do sistema. Antes da publicação:

1. Hospede o serviço Node em infraestrutura protegida atrás de proxy HTTPS com controle de acesso de rede, logs sem segredos, limitação de taxa e monitoramento; configure `backup-worker/.env.example` apenas no servidor.
2. Teste que Parceiro, Admin empresa e Desbloqueio recebem acesso negado e que Admin geral inativo não consegue operar.
3. Admin geral gera arquivo de backup; confirme que não é vazio e o arquivo foi recebido. Guarde senha de criptografia **separadamente** e respeite política de retenção.
4. Em ambiente **isolado**, descriptografe com `node backup-worker/decrypt.js arquivo.ieva saida.dump` passando `IEV_BACKUP_PASSPHRASE` pelo ambiente local seguro. Execute `pg_restore --list saida.dump` e teste uma restauração *somente no banco descartável*.
5. Confirme existência de tabelas, funções, índices, dados autorizados, RLS e capacidade de consultar com perfis fictícios. Planeje recuperação de Auth e Storage separadamente.
6. Documente responsável pelo armazenamento e descarte de cópias, rotação de senhas/chaves, prazo, controle de acesso e procedimento de recuperação.

**Nunca restaure um dump em produção como primeiro teste.** A restauração de uma cópia antiga não pode reintroduzir dados que já deveriam ter sido eliminados.

## Publicação do frontend

1. Em hospedagem HTTPS compatível com SPA React, configure variáveis de build `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_IEVA_BACKUP_API_URL` (endpoint HTTPS do worker).
2. Execute `npm ci && npm run check && npm run preflight:production` (com as variáveis presentes). Publique o conteúdo de `dist/` em hospedagem estática com fallback de rotas para `/index.html`.
3. Configure domínio, redirect URLs e Site URL no Supabase Auth. Teste login, refresh de rotas internas e recuperação de senha no domínio real.
4. Restrinja CORS no serviço de backup à origem exata do frontend; realize teste de ponta a ponta sob HTTPS.
5. Registre a versão implantada, plano de rollback do frontend, responsável pela aprovação e monitoramento dos erros.

## Ordem de rollback

Se houver falha após publicação, desative novos acessos ou retorne a versão anterior do **frontend**. Não reverta migrações SQL por cópia/cola sem análise de dados e dependências. Suspender o cron pode ser necessário diante de comportamento inesperado, mediante procedimento de incidentes. Preserve evidências e controle de acesso.

## Status desta entrega

Código e verificações locais estão no ZIP. A **homologação externa não foi feita** e não foi atribuído estado de produção aprovado.
