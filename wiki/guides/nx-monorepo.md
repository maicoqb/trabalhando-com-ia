---
title: Monorepo com Nx + TypeScript
tags: [guide, nx, monorepo, typescript, build, eslint, prettier]
---

# Guia — Monorepo com Nx + TypeScript

Padrão que uso na maioria dos projetos (minimacli, estudo-kubernetes, estudo-de-caso-arquiteturas-eda): um monorepo **Nx** com **TypeScript**, apps e libs organizados por responsabilidade.

## Estrutura básica

```
apps/          # aplicações executáveis (APIs, workers, CLIs)
libs/          # código compartilhado entre apps
nx.json        # configuração do Nx (targets, plugins, cache)
tsconfig.base.json   # config TS raiz + paths dos pacotes internos
package.json   # deps e scripts
```

Apps e libs são separados por responsabilidade, não por nomear cada arquivo — módulos aparecem, somem e são renomeados.

## Convenções

- **Código e documentação em inglês.**
- Preferir **código autoexplicativo** a comentários.
- **`async`/`await`, nunca cadeias `.then()`/`.catch()`.**
- Estilo garantido por **Prettier + ESLint** (o lint entra como plugin do Nx, target `lint`).

## Comandos comuns

Rodados da raiz do repo:

```sh
npx nx build <projeto>     # build de um app/lib
npx nx lint <projeto>      # lint
npx nx serve <projeto>     # dev (quando aplicável)
```

O Nx tem **cache** nos targets de build (`dependsOn: ^build`), então builds repetidos de projetos sem mudança são instantâneos.

## Paths internos

Pacotes internos são referenciados por alias no `tsconfig.base.json`, em vez de caminhos relativos longos. Ex.:

```json
"paths": {
  "@minimacli/plugin": ["./libs/minimacli-plugin/src/index.ts"]
}
```

Assim um import vira `import { ... } from '@minimacli/plugin'` de qualquer lugar do monorepo.

## Notas

- Versões do ecossistema Nx andam juntas (todos os `@nx/*` na mesma versão do `nx`); ao atualizar, subir tudo junto evita incompatibilidade.
- `moduleResolution: "bundler"` é o padrão usado, combinando com esbuild/webpack no build dos apps.
