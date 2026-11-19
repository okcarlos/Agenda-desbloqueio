# IEV Avança — Etapa 6 — a partir do ZIP corrigido da Etapa 5

## Base e integridade

Esta entrega deriva especificamente do arquivo **Etapa_5.zip fornecido pelo usuário**, não do ZIP antigo da Etapa 5. A função `corInline` de `src/lib/status.js`, que calcula **texto, borda e fundo** a partir da cor hexadecimal de cada status, foi preservada **sem alteração**. O catálogo de status personalizados e os seis status originais continuam disponíveis.

O `.env` local do ZIP do usuário **foi intencionalmente excluído** do pacote de entrega; use `.env.example` sem inserir chaves de serviço no frontend. Os diretórios `node_modules/`, `.idea/` e arquivos `.temp/` do Supabase também foram omitidos.

## 1. Instalação frontend

Em uma cópia de desenvolvimento, extraia o ZIP, copie `.env.example` para `.env`, use somente URL + chave publicável Supabase e execute:

```bash
npm install
npm run dev
```

Migrações 001–005 devem já existir no seu banco (não reaplique se já foram executadas). Execute **apenas** `supabase/migrations/202611190006_calendario_retencao.sql` em **ambiente de testes**. Não há nova regra de CPF único: o CPF repetido continua permitido, com aviso informativo conforme Etapa 5.

## 2. Calendário mensal de verdade

Na Central, entre em **Calendário** e navegue entre os meses. O resumo mensal busca **todos os registros autorizados do mês** no banco, por dia e status, e não apenas os 25 da página. Ao clicar em um dia, você volta à tabela com filtro da data e paginação de 25. Filtros de empresa, responsável e status aplicam-se à contagem; filtro de horário e busca textual aplicam-se ao consultar a tabela após selecionar o dia. Nenhum dado pessoal é retornado na agregação do calendário. As cores vêm do mesmo `corInline` corrigido pelo usuário.

A rotina do calendário é `SECURITY INVOKER`: continua sujeita ao RLS de agendamentos; a verificação de `ieva_contexto()` bloqueia contas desativadas. Confirme desempenho com índices e volume real.

## 3. Retenção de sete dias

A função `ieva_limpeza_retencao` já existia na Etapa 5. A migração 006 adiciona `ieva_executar_retencao`, que a executa em lote de 500 e registra o resultado em `operacoes_administrativas`. Agendamentos elegíveis em status finais e status personalizados finais, mais auditoria vencida, são eliminados conforme a política anterior; estatísticas históricas **não** são apagadas.

**A migração 006 não ativa automaticamente nenhum cron**, evitando jobs duplicados e falha em projetos sem a extensão. Se `pg_cron` estiver habilitado, revise `supabase/manual/ativar_cron_retencao.sql`; habilite a linha `cron.schedule` manualmente depois de checar `cron.job`. Monitore `cron.job_run_details` e as operações administrativas. Confira o fuso do agendamento (servidor/cron pode usar UTC).

**Antes de ativar o cron:** teste transições de status personalizadas, retenção de `CLIENTE NÃO ATENDEU` e referências para notificações/histórico, e realize uma cópia recuperável da base de teste. Auditoria com sete dias não equivale a conformidade LGPD automática.

## 4. Backup manual — serviço separado

O frontend **não consegue realizar um dump seguro sozinho**. Esta entrega traz `backup-worker/server.js`, um serviço Node.js 20+ **separado**, com estas proteções:

1. Bearer JWT atual do Supabase verificado no Auth; o serviço consulta a tabela `usuarios` e exige `ADMIN_GERAL`, ativo, sem troca de senha pendente.
2. A credencial `service_role` fica **somente no servidor**.
3. `pg_dump --format=custom --schema=public` do PostgreSQL por conta dedicada com permissões suficientes, e checagem com `pg_restore --list`.
4. Criptografia AES-256-GCM com senha informada pelo Administrador geral (chave derivada via scrypt); o arquivo `.ieva` é baixado por canal HTTPS autenticado.
5. Registro de operação em `operacoes_administrativas`. Arquivos temporários excluídos ao finalizar; a proteção do disco temporário (incluindo possíveis vestígios) é responsabilidade do ambiente servidor. Recomenda-se disco criptografado.

**ATENÇÃO — ESCOPO DO BACKUP:** isto é um backup real do schema PostgreSQL **public** da aplicação (estrutura e dados), mas **NÃO é uma recuperação integral do Supabase**: não inclui usuários/senhas do `auth` nem objetos do Storage, secrets nem configurações externas. A restauração de identidades precisa de um plano complementar e testes. O backup é gerado sob demanda e **não fica armazenado** no serviço após o download; faça armazenamento seguro separado, com retenção e eliminação compatíveis com a LGPD. Nunca chame esse arquivo de “backup integral” do Supabase.

### Instalar o worker

No host separado, com **HTTPS obrigatório** via reverse proxy, Node.js 20+, espaço temporário protegido e binários `pg_dump` e `pg_restore` da versão compatível do PostgreSQL:

```bash
cd backup-worker
npm install
# configurar as variáveis de backup-worker/.env.example no AMBIENTE do host, sem subir .env no repositório
npm start
```

Não tente usar `VITE_` para service role ou `PGPASSWORD`. O frontend deve apontar `VITE_IEVA_BACKUP_API_URL` ao endereço HTTPS externo do worker; configure `ALLOWED_ORIGIN` para o endereço real do frontend. **Não exponha o worker sem HTTPS, autenticação e controles de rede**. O exemplo inclui uma trava de apenas um backup por processo; para múltiplas réplicas, acrescente trava distribuída e limite de frequência no proxy.

O servidor precisa ter privilégios suficientes para copiar o esquema e os dados necessários. Se `pg_dump` falhar por permissões, **não** faça downgrade para cópia parcialmente válida; corrija a configuração do serviço e valide em projeto de testes.

### Restaurar arquivo .ieva

Armazene sua senha **fora do banco e fora do arquivo**. Em máquina local protegida, execute `node backup-worker/decrypt.js backup.ieva backup.dump`, definindo previamente a variável `IEV_BACKUP_PASSPHRASE` no ambiente local. Use `pg_restore --list backup.dump` para validar. Depois teste a restauração **em banco separado e isolado**, com usuários/roles necessários e procedimentos de recuperação complementares, antes de cogitar produção. A descriptografia local gera dump sensível em disco; apague conforme política de segurança. Não há botão de restauração para produção.

### Limitações e validação

- Teste a RLS com Admin. geral, Admin. empresa, Parceiro e Desbloqueio.
- Verifique que a rota `/backup` é invisível e a API retorna HTTP 403 para não administradores.
- Teste status personalizados, preservação de cores e ocupação de horário.
- Crie dados de laboratório para testar remoção após sete dias, sem alterar a hora do servidor em produção.
- Valide arquivo `.ieva` com senha correta e senha errada; teste uma restauração controlada.
- Teste comportamento de uma queda de rede durante o download: uma execução registrada como bem-sucedida significa dump gerado, não confirmação de que o navegador salvou o arquivo.
- A compilação e o SQL precisam ser testados na sua instalação Supabase antes de produção; nenhum teste real de banco foi executado nesta entrega.
