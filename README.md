# ittekimasu

## Getting Started

- Runtime: Bun
- Backend: Java
- Package Manager: Bun
- Development Environment: Devbox

#### PS: When running custom script, make sure you are in the project root directory

## Verify Prerequisites

```sh
nix --version
direnv --version
devbox version
```

## Init local
- Open the terminal, install the devbox if not yet installed:
```bash
curl -fsSL https://get.jetify.com/devbox | bash
```

## Set up as a new project
- Same terminal or new terminal and go to the project root

```bash
cd <project-root>

## install devbox
devbox install

## close the terminal and open a new one
## if direnv is not yet allowed run
direnv allow

## run the env-decrypt script
env-decrypt

# Rename all instances of `ittekimasu` to your project name
# then proceed to Getting Started

## run the init-local script
init-local
```

## Init local manually
- Open the terminal, install the devbox if not yet installed:
```bash
curl -fsSL https://get.jetify.com/devbox | bash
```

## Set up as a new project
- Same terminal or new terminal and go to the project root

```bash
cd <project-root>

## install devbox
devbox install

## close the terminal and open a new one
## if direnv is not yet allowed run
direnv allow

## run the env-decrypt script
env-decrypt

# Rename all instances of `ittekimasu` to your project name
# then proceed to Getting Started
```

- Install dependencies:
```bash
bun install
# or
bun i
```

- Generate cert file
```bash
cert-gen
```

- Sync env
```aiignore
## run env-decrypt script 
## it will decrypt and create a file in `tools/secrets/apps.local.yaml`
env-decrypt

## then run env-sync script
## it will create .env file to the designated directory
env-sync

## if you have new changes in the `tools/secrets/apps.local.yaml` file

## run the env-encrypt script
env-encrypt

## then push the changes to the repo
## so that the encrypted file can be used by other developers
```

- Sync hosts
```bash
sync-hosts
```

- Run the development services:
```bash
dev up
```

## Reset your local
```bash
## Open terminal and go to the project root
## run the following commands
reset-local
```

## View logs of the running services
```bash
## more info of running services is in `process-compose.yaml`
dev logs <service-name>

## example
dev logs postgresql
```

## Add a package to the project
```bash
cd <package-path-folder>
bun add <package-name>

## example
bun add pg

## or use the custom script
bunadd pg <package-path-folder>

## example
bunadd pg apps/site
```

## Add a dev package to the project
```bash
cd <package-path-folder>
bun add -D <package-name>

## example
bun add -D pg

## or use the custom script
bundevadd pg <package-path-folder>

## example
bundevadd pg apps/mobile
```

## Remove a package from the project
```bash
cd <package-path-folder>
bun rm <package-name>

## example
cd apps/mobile
bun rm pg

## or use the custom script
bunrm pg <package-path-folder>

## example
bunrm pg apps/server
```

## Check an outdated package
```bash
bun outdated -r
```

## Update outdated package
```bash
bun update --interactive --recursive
# or
bun update -i -r
```
