# proj123zap-docs

Clique aqui para acessar nossa documentação:

➡️ **https://briotecnologia.github.io/proj123zap-docs/**

## Estrutura

- `docs/index.html` -> página visual da documentação
- `docs/data/repos.json` -> inventário de repositórios da organização
- `docs/data/repo-governance.json` -> equipe, responsáveis e estado (`ativo`, `revisao`, `legado`, `desabilitado`)
- `scripts/update_repos_data.sh` -> atualiza o inventário via GitHub API

## Atualizar inventário

```bash
./scripts/update_repos_data.sh
```

## Governança

- Edite `docs/data/repo-governance.json` para definir:
  - `team`
  - `owners`
  - `status`: `ativo`, `revisao`, `legado`, `desabilitado`
  - `note`
