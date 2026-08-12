# Graph Report - .  (2026-08-11)

## Corpus Check
- Corpus is ~3,968 words - fits in a single context window. You may not need a graph.

## Summary
- 237 nodes · 240 edges · 31 communities (15 shown, 16 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.9)
- Token cost: 52,865 input · 13,215 output

## Community Hubs (Navigation)
- Devbox Environment
- Workspace Dependencies
- Biome Linter Rules
- Biome Formatter Config
- Spring Boot Server
- Turbo Pipeline Tasks
- Devbox Package Refs
- Secrets & Cert Flow
- Biome File Patterns
- Maven Wrapper Script
- Turbo Build Config
- Biome Assist Actions
- Postgres DB Scripts
- Bun Package Wrappers
- Dev Orchestrator Script
- Cert Generation Script
- Env Decrypt Script
- Env Encrypt Script
- Env Sync Script
- Bun Add Entry
- Bun Dev Add Entry
- Bun Remove Entry
- Env Gen Key Entry
- Init Local Entry
- Remove Hosts Entry
- Reset DB Entry
- Reset Local Entry
- Run DB Entry
- Sync Hosts Entry
- UI Add Entry
- Server Java Package

## God Nodes (most connected - your core abstractions)
1. `packages` - 14 edges
2. `includes` - 11 edges
3. `Devbox Environment` - 8 edges
4. `rules` - 7 edges
5. `scripts` - 7 edges
6. `tasks` - 7 edges
7. `env-decrypt script` - 6 edges
8. `init-local script` - 6 edges
9. `reset-local script` - 6 edges
10. `ServerApplication (Spring Boot main)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `server upstream localhost:4000` --shares_data_with--> `ServerApplication (Spring Boot main)`  [INFERRED]
  tools/traefik/config.yaml → apps/server/src/main/java/com/arnoldfederis/server/ServerApplication.java
- `ittekimasu README` --conceptually_related_to--> `Root package.json (ittekimasu workspace)`  [INFERRED]
  README.md → package.json
- `SOPS Encryption Config` --conceptually_related_to--> `age package`  [INFERRED]
  .sops.yaml → devbox.json
- `SOPS Encryption Config` --conceptually_related_to--> `sops package`  [INFERRED]
  .sops.yaml → devbox.json
- `traefik process` --conceptually_related_to--> `traefik package`  [INFERRED]
  process-compose.yaml → devbox.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Local Dev Orchestration (devbox + process-compose + traefik)** — devbox_config, process_compose_config, tools_traefik_traefik_static_config, traefik_dynamic_config [INFERRED 0.85]
- **Secrets Management Stack (sops + age)** — sops_config, devbox_pkg_sops, devbox_pkg_age [INFERRED 0.85]
- **Monorepo Task Pipeline (bun workspaces + turbo + biome)** — package_json_root, turbo_config, biome_config, package_json_workspaces_apps [INFERRED 0.85]
- **Local Environment Bootstrap Flow** — tools_nix_scripts_init_local_main, tools_nix_scripts_cert_gen_main, tools_nix_scripts_env_decrypt_main, tools_nix_scripts_env_sync_main, tools_nix_scripts_sync_hosts_main, tools_nix_scripts_dev_main [EXTRACTED 1.00]
- **SOPS Age Secrets Lifecycle** — tools_nix_scripts_env_gen_key_main, tools_nix_scripts_env_encrypt_main, tools_nix_scripts_env_decrypt_main, tools_nix_scripts_env_sync_main, scripts_concept_age_key_file, scripts_concept_secrets_dir [INFERRED 0.95]
- **Bun package management wrappers** — tools_nix_scripts_bunadd_main, tools_nix_scripts_bundevadd_main, tools_nix_scripts_bunrm_main, tools_nix_scripts_uiadd_main [INFERRED 0.85]

## Communities (31 total, 16 thin omitted)

### Community 0 - "Devbox Environment"
Cohesion: 0.10
Nodes (23): Devbox Environment, age package, bun package, mkcert package, postgresql package, process-compose package, sops package, traefik package (+15 more)

### Community 1 - "Workspace Dependencies"
Cohesion: 0.09
Nodes (21): @biomejs/biome, devDependencies, @biomejs/biome, tailwindcss, turbo, @types/bun, turbo, name (+13 more)

### Community 2 - "Biome Linter Rules"
Cohesion: 0.10
Nodes (21): noStaticOnlyClass, noUselessFragments, useExhaustiveDependencies, useParseIntRadix, useUniqueElementIds, next, react, linter (+13 more)

### Community 3 - "Biome Formatter Config"
Cohesion: 0.12
Nodes (18): css, parser, formatter, enabled, indentStyle, indentWidth, quoteStyle, javascript (+10 more)

### Community 4 - "Spring Boot Server"
Cohesion: 0.14
Nodes (15): Server Maven POM, ServerApplication (Spring Boot main), ServerApplication, ServerApplicationTests, ServerApplicationTests, Biome Config, org.junit.jupiter.api.Test, org.springframework.boot.autoconfigure.SpringBootApplication (+7 more)

### Community 5 - "Turbo Pipeline Tasks"
Cohesion: 0.12
Nodes (16): ^lint, cache, cache, persistent, cache, dependsOn, cache, remoteCache (+8 more)

### Community 6 - "Devbox Package Refs"
Cohesion: 0.12
Nodes (15): packages, $schema, age@latest, bun@latest, direnv@latest, fzf@latest, hostctl@latest, mkcert@latest (+7 more)

### Community 7 - "Secrets & Cert Flow"
Cohesion: 0.24
Nodes (15): SOPS age.key file, tools/certs directory, .etchosts file, tools/secrets directory, .sops.yaml config, cert-gen script, dev script, env-decrypt script (+7 more)

### Community 8 - "Biome File Patterns"
Cohesion: 0.15
Nodes (13): files, ignoreUnknown, includes, **, !apps/**/build, !apps/**/components/ui, !apps/**/.dist, !apps/**/.next (+5 more)

### Community 9 - "Maven Wrapper Script"
Cohesion: 0.33
Nodes (6): mvnw script, clean(), die(), exec_maven(), set_java_home(), verbose()

### Community 10 - "Turbo Build Config"
Cohesion: 0.22
Nodes (9): ^build, .env*, .next/**, !.next/cache/**, $TURBO_DEFAULT$, dependsOn, inputs, outputs (+1 more)

### Community 11 - "Biome Assist Actions"
Cohesion: 0.29
Nodes (7): recommended, source, assist, actions, enabled, organizeImports, useSortedAttributes

### Community 12 - "Postgres DB Scripts"
Cohesion: 0.50
Nodes (4): .devbox/virtenv db data, ittekimasu postgres database, reset-db script, rundb script

### Community 13 - "Bun Package Wrappers"
Cohesion: 0.50
Nodes (4): bunadd script, bundevadd script, bunrm script, uiadd script (shadcn)

### Community 14 - "Dev Orchestrator Script"
Cohesion: 0.83
Nodes (3): display_logs(), dev.sh script, usage()

## Knowledge Gaps
- **116 isolated node(s):** `app.ittekimasu:server`, `$schema`, `enabled`, `clientKind`, `useIgnoreFile` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `linter` connect `Biome Linter Rules` to `Biome Formatter Config`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `files` connect `Biome File Patterns` to `Biome Formatter Config`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `app.ittekimasu:server`, `$schema`, `enabled` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Devbox Environment` be split into smaller, more focused modules?**
  _Cohesion score 0.10276679841897234 - nodes in this community are weakly interconnected._
- **Should `Workspace Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Biome Linter Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Biome Formatter Config` be split into smaller, more focused modules?**
  _Cohesion score 0.11695906432748537 - nodes in this community are weakly interconnected._