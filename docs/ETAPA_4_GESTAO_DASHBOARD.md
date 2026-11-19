# Etapa 4 — Empresas, Usuários, Dashboard e Notificações

## Conteúdo

- `supabase/migrations/202611190004_gestao_dashboard.sql`: funções RPC autorizadas para empresas, usuários e estatísticas (sem escrita direta nas tabelas).
- `supabase/functions/criar-usuario/index.ts`: Edge Function protegida, única parte escrita em TypeScript para runtime Deno do Supabase; frontend continua React + JavaScript/JSX.
- `src/pages/AdminEtapa4.jsx`: telas reais de Dashboard (7 cards), Empresas, Usuários e Notificações.
- `src/lib/administracao.js`: chamadas às RPCs e à Edge Function.

## Implantação em projeto de desenvolvimento

1. Faça backup e confira que as migrações `001`, `002`, `003` foram aplicadas com sucesso. A migração `004` depende delas.
2. No SQL Editor do Supabase execute **uma vez** `supabase/migrations/202611190004_gestao_dashboard.sql`.
3. Instale a CLI Supabase e autentique-se conforme a documentação oficial. Com o projeto vinculado execute `supabase functions deploy criar-usuario` (sem `--no-verify-jwt`). Confirme nas configurações da função que a verificação de JWT está habilitada.
4. Configure os segredos `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` **somente no ambiente da função**. Em projetos hospedados pelo Supabase esses nomes geralmente já são disponibilizados automaticamente; confirme antes do deploy. **Nunca copie a service_role para `.env` do Vite.**
5. No frontend mantenha só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env` (conforme `.env.example`). Execute `npm install` e `npm run dev`.
6. Criar o primeiro Administrador geral requer procedimento inicial separado com acesso administrativo ao Supabase (a Etapa 1 descreve `usuarios` e `meu_perfil`). Nenhum cadastro público é criado pelo sistema; desabilite Sign ups públicos no painel Auth.

## Testes recomendados

1. Login de Administrador geral: cadastrar empresa e desativá-la; verificar que contas vinculadas não podem operar.
2. Criar Parceiro com senha provisória; conferir que primeiro login exige troca obrigatória e que senha não aparece em logs.
3. Login de Administrador da empresa: criar apenas Parceiro da própria empresa; testar chamada à função com `perfil=ADMIN_GERAL` para confirmar bloqueio.
4. Login de Parceiro ou Desbloqueio: tentar chamar RPC `ieva_salvar_empresa` e Edge Function de criação; confirmar erro de autorização.
5. Dashboard: verificar filtros (período, empresa, responsável, status, horário) e consistência do total com os seis estados.
6. Notificações: criar, reagendar, cancelar e alterar status; confirmar destinatários conforme regras, inexistência de avisos duplicados e marcação de lida restrita ao próprio destinatário.
7. Certifique-se de que nenhuma conta inativa, conta com troca de senha pendente ou empresa inativa consegue operar por chamadas diretas às RPCs.

## Escopo e limites desta entrega

- O Dashboard consulta `estatisticas_diarias`, preservada após a retenção, e não expõe nomes/CPF/telefone de clientes.
- A interface de gestão de usuários permite **criar** e **editar nome/ativação**. Alterações de papel, transferência de empresa, redefinição administrativa de senha e exclusão de contas deliberadamente **não são liberadas** nesta versão.
- A lista de notificações usa RLS e consulta sob demanda; a regra de tempo real continua **somente na Central**.
- O link de notificação leva à Central, não abre automaticamente o modal do agendamento. Não mostra dados de registros expirados.
- O calendário em grade completa, backup manual real, retenção automatizada e testes de carga ainda são etapas posteriores.
- A Edge Function retorna a senha temporária apenas ao administrador que criou a conta; definir um **canal seguro de entrega** antes do uso real. Atenção: credenciais temporárias não devem ser enviadas por conversas ou e-mails inseguros.
- O código foi preparado localmente e não foi testado contra o banco real ou serviço Supabase da sua conta. **Não implante em produção sem testes de segurança, revisão LGPD e recuperação.**
