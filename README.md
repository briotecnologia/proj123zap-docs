# proj123zap-docs

Documentação simples para organizar os repositórios da organização `briotecnologia`.

Publicação: **GitHub Pages** (branch `master`, pasta `/docs`).

## Estrutura

- `docs/index.html` -> página visual da documentação
- `docs/data/repos.json` -> inventário de repositórios
- `docs/data/repo-collaborators.json` -> colaboradores por repositório (login + avatar)
- `docs/data/repo-governance.json` -> metadados manuais (`team`, `status`, `note`)
- `scripts/update_repos_data.sh` -> atualiza os dados via GitHub API

## Atualizar dados

```bash
./scripts/update_repos_data.sh
```

## Publicação

A publicação acontece pelo GitHub Pages do próprio repositório:

- Repositório: `briotecnologia/proj123zap-docs`
- Branch: `master`
- Pasta: `/docs`
- URL: `https://briotecnologia.github.io/proj123zap-docs/`

## Objetivo atual

Manter um inventário visual de repositórios com filtro, atividade e colaboradores.
