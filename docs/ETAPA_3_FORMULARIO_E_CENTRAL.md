# Etapa 3 — Formulário e Central de Agendamentos

## O que foi implementado

- React em **JavaScript/JSX**, sem TypeScript.
- Formulário real para os três perfis que podem criar (Administrador geral, Administrador da empresa e Parceiro). Responsável/autor são definidos no banco; seleção de empresa apenas pelo Administrador geral.
- Máscara para CPF e telefone, validação de CPF no navegador **e no servidor**, horário em quartos de hora; servidor exige horário futuro em `America/Sao_Paulo`.
- Gravação **exclusivamente via RPC `criar_agendamento`** com UUID de idempotência por tentativa lógica; aviso e confirmação quando há pelo menos cinco ocupações no horário global; aviso de CPF duplicado apenas dentro da empresa, ambos informativos.
- Central de consulta real com filtros por busca (nome/CPF/proposta), período, horário, status, responsável e empresa para perfis globais, com paginação no banco de **25 itens**.
- Exibição em tabela e visão agrupada por dias dos **25 registros da página**. O calendário ainda não é uma grade mensal completa de slots; não inferir disponibilidade do dia usando apenas uma página.
- Modal com dados, histórico e tratativas autorizados, operações de mudança de resultado, reagendamento, cancelamento e inclusão de tratativa, conforme perfil/autor e regras SQL.
- Realtime limitado à empresa vinculada ou à empresa selecionada no filtro de usuário global, sinalizando que é preciso atualizar. Sem canais globais indiscriminados. Com acesso global e filtro “Todas”, **não há assinatura Realtime**: usar botão Atualizar.
- Nova migração com **duas RPCs de leitura mínima** para nomes de empresas/usuários visíveis, sem liberar `SELECT` direto nas tabelas de identidade.

## Como instalar em um ambiente NOVO

1. Extraia este ZIP e abra `iev-avanca-js` no VS Code.
2. Tenha Node.js compatível com Vite 7 (Node 20.19+ ou 22.12+), execute `npm install`.
3. No Supabase **de desenvolvimento**, aplique as migrações na ordem:
   - `supabase/migrations/202611170001_initial_access.sql`
   - `supabase/migrations/202611170002_operacao_segura.sql`
   - `supabase/migrations/202611190003_central_consultas.sql`
4. Se as migrações 001 e 002 **já foram aplicadas**, execute **somente a 003**. Não reaplique 001 ou 002 em projeto que já tem tabelas.
5. Configure `.env` com base em `.env.example`; só utilize URL e **chave pública** do Supabase, nunca `service_role`.
6. Confira nas configurações de Supabase Auth que o cadastro público está desativado. Crie o primeiro usuário Administrador geral por procedimento controlado de bootstrap documentado no README anterior.
7. Execute `npm run dev`, acesse a URL local indicada e faça login.
8. Para receber avisos do Realtime, configure a tabela `public.agendamentos` na publicação `supabase_realtime` e valide que a política de RLS funciona com contas reais. **Não** habilite replicação aberta sem revisar as regras de acesso; se o Realtime estiver desativado, o botão Atualizar continua utilizável.

## Roteiro manual de testes

1. Crie duas empresas e contas de cada perfil no projeto de desenvolvimento; crie dados de teste fictícios e CPF de teste válido, nunca CPF real sem base legal.
2. Parceiro da empresa X deve ver agendamentos de X, mas não de Y; botão de ações de outro Parceiro da X **não** oferece alteração. Teste também chamada direta RPC sem permissão (deve falhar).
3. Registre 5 agendamentos no mesmo dia/slot. O **6º** deve avisar ocupação de cinco e permitir confirmar. Alterar a ocupação entre aviso e confirmação deve exigir nova confirmação com a contagem atual.
4. Registrar CPF já usado no mesmo dia da mesma empresa deve avisar e permitir confirmar; não revelar nome, proposta ou origem de outra empresa.
5. Teste horários 09:00, 09:15, 09:30, 09:45 e rejeite 09:10, além de datas passadas.
6. Teste fluxo AGENDADO → EM ATENDIMENTO → DESBLOQUEADO e a impossibilidade de reabrir. Reagendamento usa o mesmo ID e atualiza horário, status e histórico.
7. Cancelar com justificativa menor que cinco letras deve falhar no servidor. Confira notificações e contadores de estatísticas no banco.
8. Confirme que uma conta/empresa desativada perde acesso à leitura e operações.
9. Simule resposta perdida no cadastro e reenvie **sem alterar formulário**, preservando `operacaoId` e evitando duplicação.
10. Antes de produção, faça testes de carga e segurança segundo o documento principal. SQL e Realtime ainda não foram verificados contra um projeto Supabase real nesta entrega.

## Limites desta entrega

- Falta implementar cadastro/edição de empresas e usuários na interface, edição de campos cadastrais de agendamento, Dashboard real, visualização de calendário mensal/semanal com grade integral, notificações no sino, retenção automatizada/monitorada e backup manual protegido.
- A política de agendamentos e estatísticas depende de a Etapa 2 já estar íntegra; **não** usar em produção sem validação de RLS, regressão, concorrência e retenção.
- Não foi possível rodar `npm install`/`npm run build` neste ambiente por falha DNS ao acessar `registry.npmjs.org`. Os arquivos `.js`/`.jsx` foram verificados com parser TypeScript apenas para sintaxe, não é substituto da compilação real ou testes end-to-end.
