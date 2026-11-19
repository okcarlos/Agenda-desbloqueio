# IEV Avança — Alteração de nível de acesso do usuário

Base: pacote de publicação GitHub Pages com domínio `desbloqueio.ievavanca.com.br`. Esta atualização preserva status personalizados, suas cores e os workflows existentes.

## O que mudou

O Administrador geral pode acessar **Usuários → Editar**, selecionar um dos quatro perfis, escolher a empresa para Parceiro/Admin. empresa e registrar uma justificativa (mínimo 10 caracteres) quando alterar perfil/vínculo. A tela solicita confirmação antes de salvar. O Administrador da empresa continua restrito a nome e ativação de Parceiros da própria empresa.

O SQL verifica a autorização em `ieva_contexto`, bloqueia mudanças no próprio perfil/vínculo, impede remover o último administrador operacional, rejeita empresas inexistentes/inativas e evita migração de empresa se houver agendamentos ou estatísticas vinculados. O histórico de agendamentos permanece intacto. Alterações são registradas na auditoria operacional de 7 dias.

**Importante:** a promoção de um usuário com registros históricos para perfil global não altera a autoria dos registros. Sessões já abertas devem atualizar o perfil ao fazer foco/refresh (há revalidação periódica), e todas as RPCs devem conferir o perfil diretamente no banco.

## Instalação (na ordem)

1. Faça backup seguro do banco e confirme que há outro Administrador geral ativo. Aplique PRIMEIRO, no **Supabase de homologação**, a migração `supabase/migrations/202611190007_alteracao_perfil_usuario.sql` no SQL Editor, uma única vez, após 001–006. Não execute novamente as migrações anteriores.
2. Confira a função `ieva_alterar_usuario_geral` no Supabase. Teste com contas fictícias: Administrador geral altera Parceiro → Admin. empresa; Administrador da empresa/Parceiro/Desbloqueio não conseguem chamar a RPC; tentativa de autoelevação é negada; troca para papel global zera `empresa_id`; papel empresarial exige empresa ativa; mudanças geram auditoria.
3. No projeto frontend, use os arquivos atualizados `src/pages/AdminEtapa4.jsx` e `src/lib/administracao.js` (já incluídos no ZIP). Não coloque `service_role` no frontend.
4. Em seu computador execute `npm ci`, `npm test` e `npm run build`.
5. Faça commit/push na branch `main`. O workflow existente do GitHub Pages publica a nova interface automaticamente. Não é necessário alterar DNS, domínio, CNAME ou variáveis públicas do Supabase.
6. Teste pelo domínio publicado como Administrador geral. Teste também acesso negado pela RPC com perfil sem privilégio. Confirme que usuários que sofreram alteração de perfil voltam a entrar com o nível correto.

## Limites e precauções

- A alteração do perfil **não altera e-mail ou senha do Supabase Auth**; ambas continuam como antes.
- A função valida `p_perfil_esperado` e `p_empresa_esperada` para evitar gravar por cima de uma mudança concorrente.
- A mudança de empresa de contas com agendamentos ou estatísticas vinculados é negada para preservar a identidade histórica dos registros. Desative a conta antiga e crie outra para a nova empresa.
- Não é uma implementação de exclusão definitiva de usuário.
- Este pacote foi testado estaticamente. A migração SQL ainda exige testes no seu Supabase e o Vite precisa ser compilado em seu ambiente antes de produção.
