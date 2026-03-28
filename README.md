# proj123zap-docs

Documentação interna de repositórios da organização.
Deploy recomendado: **AWS S3 + CloudFront** com proteção por login GitHub e validação de membro da organização.

## Estrutura

- `docs/index.html` -> página visual da documentação
- `docs/data/repos.json` -> inventário de repositórios da organização
- `docs/data/repo-governance.json` -> equipe, responsáveis e estado (`ativo`, `revisao`, `legado`, `desabilitado`)
- `docs/data/repo-collaborators.json` -> snapshot de colaboradores por repo (login + avatar)
- `scripts/update_repos_data.sh` -> atualiza o inventário via GitHub API
- `.github/workflows/deploy-cloudfront.yml` -> deploy automático em S3 + invalidação CloudFront
- `infra/lambda-edge-auth/index.js` -> auth gateway (GitHub OAuth + validação de org membership)
- `scripts/set_edge_auth_params.sh` -> grava parâmetros de auth no SSM
- `scripts/deploy_edge_auth.sh` -> publica Lambda@Edge e anexa no CloudFront

## Atualizar inventário

```bash
./scripts/update_repos_data.sh
```

## Deploy automático no CloudFront

Configure no repositório do GitHub:

### Repository Variables

- `AWS_REGION`
- `DOCS_S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

### Repository Secret

- `AWS_ROLE_TO_ASSUME` (ARN da role IAM com trust para OIDC do GitHub)

O workflow `Deploy Docs to CloudFront` publica o conteúdo de `docs/` no S3 e invalida o CloudFront a cada push no `master`.

## Proteção com GitHub Org Membership (seguro)

1. Criar OAuth App no GitHub com callback:
   - `https://SEU_DOMAIN/_auth/callback`
2. Gravar segredos no SSM:

```bash
./scripts/set_edge_auth_params.sh \
  "<GITHUB_CLIENT_ID>" \
  "<GITHUB_CLIENT_SECRET>" \
  "<COOKIE_SECRET_FORTE>" \
  "briotecnologia"
```

3. Anexar auth no CloudFront:

```bash
CLOUDFRONT_DISTRIBUTION_ID="<SEU_DIST_ID>" ./scripts/deploy_edge_auth.sh
```

Após isso, somente usuários com membership ativo na org `briotecnologia` acessam a documentação.

## Governança

- Edite `docs/data/repo-governance.json` para definir:
  - `team`
  - `members` (ex.: `[{ "name": "Pessoa", "avatar": "https://..." }]`)
  - `owners`
  - `status`: `ativo`, `revisao`, `legado`, `desabilitado`
  - `note`
