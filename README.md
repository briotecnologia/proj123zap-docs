# proj123zap-docs

Documentação interna de repositórios da organização.
Deploy recomendado: **AWS S3 + CloudFront** com publicação automática via GitHub Actions.

## Estrutura

- `docs/index.html` -> página visual da documentação
- `docs/data/repos.json` -> inventário de repositórios da organização
- `docs/data/repo-governance.json` -> equipe, responsáveis e estado (`ativo`, `revisao`, `legado`, `desabilitado`)
- `docs/data/repo-collaborators.json` -> snapshot de colaboradores por repo (login + avatar)
- `scripts/update_repos_data.sh` -> atualiza o inventário via GitHub API
- `.github/workflows/deploy-cloudfront.yml` -> deploy automático em S3 + invalidação CloudFront

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

## Governança

- Edite `docs/data/repo-governance.json` para definir:
  - `team`
  - `members` (ex.: `[{ "name": "Pessoa", "avatar": "https://..." }]`)
  - `owners`
  - `status`: `ativo`, `revisao`, `legado`, `desabilitado`
  - `note`
