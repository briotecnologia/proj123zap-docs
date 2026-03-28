# proj123zap-docs

Documentação interna de repositórios da organização.
Deploy recomendado: **Cloudflare Worker + Cloudflare Access (IdP Cognito)**.

## Estrutura

- `docs/index.html` -> página visual da documentação
- `docs/data/repos.json` -> inventário de repositórios da organização
- `docs/data/repo-governance.json` -> equipe, responsáveis e estado (`ativo`, `revisao`, `legado`, `desabilitado`)
- `docs/data/repo-collaborators.json` -> snapshot de colaboradores por repo (login + avatar)
- `src/worker.js` -> worker que serve os assets de `docs/`
- `wrangler.jsonc` -> configuração de deploy no Cloudflare Workers
- `scripts/update_repos_data.sh` -> atualiza o inventário via GitHub API

## Atualizar inventário

```bash
./scripts/update_repos_data.sh
```

## Deploy interno com Cognito

1. Deploy do worker:

```bash
npx wrangler deploy
```

2. No Cloudflare Zero Trust (Access):
- Application type: Self-hosted
- Domain: domínio interno da docs
- Identity provider: Cognito (o já existente para projetos internos)
- Policy: permitir somente grupos/usuários internos

Com isso, o acesso fica protegido por login Cognito, sem senha básica no app.

## Governança

- Edite `docs/data/repo-governance.json` para definir:
  - `team`
  - `members` (ex.: `[{ "name": "Pessoa", "avatar": "https://..." }]`)
  - `owners`
  - `status`: `ativo`, `revisao`, `legado`, `desabilitado`
  - `note`
