# IEV Avança — Publicação com domínio personalizado no GitHub Pages

**Endereço do frontend:** https://desbloqueio.ievavanca.com.br/

Este pacote deriva da Etapa 8 e mantém os ajustes das cores dos status personalizados. Nenhuma migração SQL é necessária para estas alterações de hospedagem.

## Arquivos adicionados ou alterados
- `vite.config.js`: `base: '/'` para o domínio personalizado.
- `public/CNAME`: preserva o domínio no artefato publicado.
- `.github/workflows/publicar-pages.yml`: testes, pré-verificação, build, fallback de rotas e deploy.
- `src/main.jsx`: **inalterado**, continua `BrowserRouter`, importante para a recuperação de senha do Supabase.

## Configuração obrigatória do GitHub
1. Garanta que os arquivos estejam na **raiz** do repositório (package.json e vite.config.js no nível superior). Se a raiz real estiver em uma subpasta, ajuste o workflow ou mova o projeto.
2. Confirme se a branch principal é `main`; caso seja outra, altere `branches: [main]` no workflow.
3. **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. **Settings → Environments → github-pages → Environment variables** (ou repository variables se preferir) crie:
   - `VITE_SUPABASE_URL`: `https://SEU-ID.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: apenas chave publicável/anon do Supabase.
   - `VITE_IEVA_BACKUP_API_URL`: HTTPS do serviço Node no Render, **somente depois de ele estar configurado e testado**. Sem essa variável, o backup ficará indisponível; não apresentar a publicação como operação completa.
5. Execute o workflow por push em `main` ou **Actions → Publicar IEV Avança no GitHub Pages → Run workflow**.

**Nunca** salve `service_role`, `sb_secret_*`, senha do banco, chave de criptografia nem variáveis secretas do Render em `VITE_*`. Vite incorpora esses valores no JavaScript do navegador.

## DNS do domínio
- Em **Settings → Pages → Custom domain**, configure `desbloqueio.ievavanca.com.br`.
- No provedor de DNS que administra `ievavanca.com.br`, crie/ajuste **somente o registro do subdomínio**:
  - Tipo: `CNAME`
  - Host/nome: `desbloqueio`
  - Destino: `<DONO-DO-REPOSITORIO>.github.io` (sem o nome do repositório; obtenha o valor correto no GitHub).
- Remova **somente os registros conflitantes desse subdomínio**, após conferir o provedor. Não altere o domínio raiz nem outros serviços da organização.
- Aguarde propagação/verificação e habilite **Enforce HTTPS** no GitHub Pages.
- Se houver Cloudflare proxy, verifique os requisitos específicos de DNS e HTTPS antes de ativá-lo.

## Supabase Auth
Em **Authentication → URL Configuration**, deixe `Site URL` como `https://desbloqueio.ievavanca.com.br` e inclua nos **Redirect URLs**:
- `https://desbloqueio.ievavanca.com.br/recuperar-senha`
- `http://localhost:5173/recuperar-senha` (somente se ainda usa o fluxo local)

Confirme que cadastro público/anonymous sign-in estão bloqueados. Teste solicitação de recuperação e alteração de senha depois da publicação.

## Rotas do React
O projeto continua com `BrowserRouter`, evitando mudar a forma como o Supabase processa os links de recuperação de senha. O workflow copia `index.html` para `404.html` no site publicado. Ao abrir diretamente `/central`, `/login`, `/recuperar-senha` etc., o GitHub Pages devolve fallback HTML e o React renderiza a rota. **A resposta HTTP de uma rota profunda pode continuar sendo 404**, mesmo que a tela renderize; é uma limitação do GitHub Pages estático. Se um status HTTP 200 for obrigatório para todas as rotas, hospede o frontend em um serviço com fallback SPA/rewrite apropriado, em vez de depender desse mecanismo.

## Validação local
```bash
npm ci
npm test
npm run build
npm run preflight
```
O preflight lê `.env` local; no GitHub Actions ele recebe as variáveis configuradas no GitHub. `npm run preflight:production` também exige o backup, mas **não substitui** os testes de RLS, load test, Cron e restauração.

## Checklist anterior à liberação real
- [ ] Pipeline de CI/CD concluído sem falhas
- [ ] Domínio com HTTPS e DNS corretos
- [ ] Login / logout e recuperação de senha
- [ ] Rotas diretas e atualização de página
- [ ] Supabase Auth redirects e CORS do serviço Render
- [ ] Isolamento RLS testado também via API
- [ ] Serviço de backup privado implantado, download criptografado e restauração testada
- [ ] Cron de retenção de 7 dias ativado de forma controlada
- [ ] Testes de carga e revisão de proteção de dados realizados

**Observação**: o workflow é compatível com repositórios com código na raiz, branch `main` e publicação pela plataforma GitHub Pages; adapte ao repositório real se a estrutura divergir.
