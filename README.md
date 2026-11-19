# Sistema IEV Avança — Etapa 1 (JavaScript + JSX)

Base inicial do Sistema de Agendamentos de Desbloqueio, conforme a especificação aprovada em 17/11/2026.

**Tecnologia:** React + Vite em **JavaScript**, JSX, Supabase Auth e PostgreSQL. **Não há TypeScript ou Firebase.**

> **Escopo desta entrega:** projeto compilável; login com e-mail/senha; solicitação de recuperação; troca de senha provisória; tela Minha Conta; menu responsivo por perfil; Dashboard e Central com estrutura visual sem dados fictícios; SQL inicial para `empresas`, `usuarios`, RLS e RPC `meu_perfil`. **Agendamentos, gestão de usuários/empresas na interface, notificações, indicadores reais, retenção e backup ainda NÃO estão implementados.** Não utilizar em produção antes das próximas etapas e dos testes de segurança.

## 1. Requisitos locais

- Node.js **22.12+** (ou 20.19+) e npm.
- Conta no [Supabase](https://supabase.com/), com um projeto de desenvolvimento.
- Editor de código (por exemplo, VS Code).

## 2. Configure o Supabase

1. Crie um projeto gratuito de desenvolvimento no painel Supabase.
2. Em **Authentication → Settings / General configuration** (os nomes podem mudar), **desative “Allow new users to sign up”**. Desative também logins anônimos. Esta medida no servidor é indispensável; não basta omitir um formulário de cadastro.
3. Em **Authentication → URL Configuration** configure **Site URL:** `http://localhost:5173` e inclua **Redirect URL:** `http://localhost:5173/recuperar-senha`. Para outra origem/porta, atualize essa lista.
4. Em **SQL Editor**, execute o arquivo `supabase/migrations/202611170001_initial_access.sql` inteiro. É a migração de acesso INICIAL, não a estrutura completa do sistema.
5. Em **Project Settings → API Keys** (ou **Connect**, dependendo do painel), copie a URL do projeto e a chave **publicável** (`sb_publishable_...`). Algumas contas ainda exibem a chave pública antiga `anon`; nunca copie `service_role` ou `sb_secret_...` para o React.
6. Para recuperação por e-mail funcionar, configure o remetente/SMTP apropriado. O provedor padrão do Supabase tem limites e não deve ser considerado serviço de e-mail de produção.

### Criar o primeiro Administrador geral

O projeto começa vazio, intencionalmente. Para configurar a primeira conta no **ambiente de desenvolvimento**:

1. No painel Supabase, abra **Authentication → Users → Add user** e crie um usuário com e-mail real e uma senha provisória forte. Confirme o e-mail no painel, quando necessário.
2. Copie o **ID (UUID)** do usuário criado.
3. Execute no SQL Editor, substituindo os valores de exemplo pelos dados reais:

```sql
insert into public.usuarios (
  id, nome, email, perfil, empresa_id, troca_senha_pendente
) values (
  'COLE-AQUI-O-UUID-DO-AUTH',
  'Administrador Inicial',
  'admin@exemplo.com',
  'ADMIN_GERAL',
  null,
  true
);
```

4. Verifique a linha criada:

```sql
select id, nome, email, perfil, ativo, troca_senha_pendente
from public.usuarios
where email = 'admin@exemplo.com';
```

5. Ao entrar na aplicação, a conta deve ser encaminhada para a **troca obrigatória da senha provisória** antes de acessar o Dashboard.

**Importante:** a entrega segura de senha provisória e o fluxo administrativo para criar usuários ainda serão implementados. Não envie senhas em chats, logs ou repositórios. Se um administrador redefinir a senha provisória manualmente pelo painel Auth após a criação, deverá redefinir o campo `troca_senha_pendente` para `true` por operação administrativa autorizada; uma alteração da senha no Auth marca o campo como `false` automaticamente. Não usar esse processo manual em produção.

## 3. Execute no computador

No terminal, dentro da pasta `iev-avanca-js`:

```bash
npm install
cp .env.example .env
```

No Windows PowerShell, use `Copy-Item .env.example .env` no lugar do `cp`.

Abra o arquivo `.env` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_publicavel
```

Depois:

```bash
npm run dev
```

Acesse `http://localhost:5173` no navegador.

Para verificar a compilação:

```bash
npm run build
```

Não coloque dados secretos em variáveis com prefixo `VITE_`; elas ficam disponíveis ao navegador. O arquivo `.env` está ignorado pelo Git.

## 4. Como testar a Etapa 1

1. **Antes de configurar `.env`:** o app informa que a conexão precisa ser configurada.
2. **Antes de entrar:** mostra login sem cadastro público.
3. **Com primeiro usuário (Admin. geral):** ao entrar, abre `/trocar-senha` enquanto `troca_senha_pendente = true`.
4. **Após definir nova senha:** confirma no SQL Editor que a flag passou a `false`, então libera o Dashboard.
5. **Menus:** o Admin. geral vê Dashboard, Central, Novo Agendamento, Empresas, Usuários e Backup; Parceiro/Admin. empresa não devem ver Dashboard/Backup. Para simular outros perfis, crie usuários Auth + linhas SQL no ambiente de teste, vinculando Admin. empresa/Parceiro a uma empresa.
6. **RLS:** uma requisição autenticada de usuário comum **não** deve conseguir fazer `select` direto de `public.usuarios`/`public.empresas` nem ler outros perfis. A única leitura de perfil exposta nesta etapa é `meu_perfil()`, que retorna somente os próprios dados.
7. **Desativação:** no SQL Editor, defina `ativo=false` no perfil de teste (ou `ativa=false` na empresa); aguarde até um minuto ou atualize o navegador e confirme bloqueio. Reverta pelo SQL Editor.
8. **Senha esquecida:** solicite e-mail de recuperação e confirme a rota `/recuperar-senha`, caso o SMTP esteja configurado e o endereço de redirect autorizado.
9. **Central e Dashboard:** só mostram estrutura e indicadores vazios; nenhum agendamento fictício ou botão de gravação disfarçado foi adicionado.

## 5. Estrutura de arquivos

```text
iev-avanca-js/
├── .env.example                  # URL e chave publicável do Supabase
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # rotas e autorização visual
│   ├── styles.css                # Dark Premium e responsividade
│   ├── auth/
│   │   └── AuthContext.jsx       # sessão e RPC meu_perfil
│   ├── components/
│   │   └── Shell.jsx             # menu lateral e topbar
│   ├── lib/
│   │   └── supabase.js           # cliente Supabase público
│   └── pages/
│       ├── Login.jsx             # login e solicitação de recuperação
│       ├── PasswordChange.jsx    # senha provisória/redefinição
│       └── Workspace.jsx        # páginas-base sem dados operacionais
├── supabase/
│   └── migrations/
│       └── 202611170001_initial_access.sql
└── docs/
    └── PROXIMAS_ETAPAS.md
```

## 6. Segurança e limitações desta versão

- A autorização de *menu* é somente UX. A autorização verdadeira das futuras operações de agendamento será definida em RLS/RPC no PostgreSQL. **Não escrever diretamente nas tabelas operacionais pelo navegador.**
- `meu_perfil()` é uma função protegida por permissões e limita o resultado à pessoa autenticada via `auth.uid()`; a interface não consulta a tabela `usuarios` diretamente.
- Revalidação da tela ocorre por evento de sessão, foco da janela e a cada 60 segundos; **isto não substitui** a revalidação no banco de cada ação sensível.
- Recuperação de senha depende de e-mails e URL de redirecionamento configurados. As políticas de força da senha do Auth devem ser configuradas no painel conforme o ambiente; a interface exige 12 caracteres, mas a validação do cliente não é controle de segurança suficiente.
- Não foram implementadas ainda as rotinas de criação de usuários administrativos, o fluxo final de entrega de senha temporária, as 10 tabelas completas ou os testes de carga.
- Os agregados históricos, cron de retenção, exportação de backup criptografado e restauração segura continuam como etapas posteriores.

## Fontes técnicas

- [Vite — Getting Started](https://vite.dev/guide/)
- [Supabase — Auth General Configuration](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase — Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase — Passwords](https://supabase.com/docs/guides/auth/passwords)
- [Supabase — Database Functions](https://supabase.com/docs/guides/database/functions)

## Etapa 2 — Banco e regras de agendamentos

Foi adicionada a migração `supabase/migrations/202611170002_operacao_segura.sql`, a camada JavaScript `src/lib/agendamentos.js` e um guia de aplicação e segurança em `docs/ETAPA_2_BANCO_E_SEGURANCA.md`.

**Execute a migração 002 somente após a migração 001, no ambiente de desenvolvimento.** Esta etapa implementa o núcleo de operações protegidas no banco; o formulário de agendamento e a Central permanecem visuais até a integração seguinte. Leia primeiro o guia para saber as limitações e como validar as políticas.

---

## Etapa 3 — Formulário e Central reais (19/11/2026)

Esta versão incorpora as etapas 1, 2 e 3. O formulário Novo Agendamento e a Central estão conectados ao banco via RLS e RPCs, com paginação 25 e modal operacional.

**Importante:** aplicar a nova migração `supabase/migrations/202611190003_central_consultas.sql` **após** as migrações anteriores. Se 001/002 já foram executadas, execute apenas 003. Consulte instruções, testes, dependências e limitações em `docs/ETAPA_3_FORMULARIO_E_CENTRAL.md`.

O calendário apresenta os registros da página agrupados por dia; uma grade completa será feita em etapa posterior. Realtime depende de habilitar a publicação da tabela no Supabase com RLS revisada. A compilação não foi executada aqui devido à indisponibilidade de acesso ao npm.

---

## Etapa 4 — Gestão, Dashboard e notificações (19/11/2026)

Esta entrega incorpora as etapas 1 a 4. Aplique a migração `supabase/migrations/202611190004_gestao_dashboard.sql` somente depois das migrações 001, 002 e 003. Faça o deploy da Edge Function `supabase/functions/criar-usuario` com verificação JWT habilitada. **Leia `docs/ETAPA_4_GESTAO_DASHBOARD.md` antes de executar.**

O Dashboard usa estatísticas agregadas reais; Empresas e Usuários usam rotinas protegidas; as notificações internas usam leitura por destinatário. Esta entrega **não inclui** backup manual funcional nem substitui a validação de RLS/SQL em ambiente Supabase real.

## Etapa 5 — status personalizados e CPF repetido

Consulte **`docs/ETAPA_5_STATUS_PERSONALIZADOS.md`** para instalar a migração `202611190005_status_personalizados.sql`, cadastrar status no menu de Administrador geral e validar permissões/retention no Supabase de desenvolvimento. **Não executar em produção sem testes.**


## Etapa 6 (a partir do ZIP corrigido do usuário)

Veja `docs/ETAPA_6_CALENDARIO_RETENCAO_BACKUP.md` para calendário mensal, migração 006, cron opcional e serviço protegido de backup manual. O arquivo `.env` original não é incluído no ZIP por segurança.

## Etapa 8 — preparação final para publicação

Consulte `docs/ETAPA_8_PUBLICACAO_E_HOMOLOGACAO.md` para o roteiro de homologação, implantação, Cron, RLS, backup/restauração e critérios de liberação. Execute `npm run test`, `npm run build` e `npm run preflight`. Em configuração real de produção, execute também `npm run preflight:production`. Os preflights são **somente checagens locais**, não certificam a segurança nem validam os serviços remotos.
