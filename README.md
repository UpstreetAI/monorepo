# Upstreet Monorepo

This repository contains the open source apps for the Upstreet platform.

## Workspaces

#### Chat:
- Url: https://chat.upstreet.ai
- Directory: [/apps/chat](https://github.com/UpstreetAI/monorepo/tree/main/apps/chat)
- Documentation: [/apps/chat/ReadMe.md](https://github.com/UpstreetAI/monorepo/blob/main/apps/chat/README.md)

#### Docs:
- Url: https://docs.upstreet.ai
- Directory: [/apps/docs](https://github.com/UpstreetAI/monorepo/tree/main/apps/docs)
- Documentation: [/apps/docs/ReadMe.md](https://github.com/UpstreetAI/monorepo/blob/main/apps/chat/README.md)

# Quickstart

## Install
Run install from the root directory:
```bash
npm install
```

## Run
#### Run Chat
From the root directory run:
```bash
npm run chat dev
```
#### Run Docs
From the root directory run:
```bash
npm run docs start
```
#### Install SDK
From the root directory run:
```bash
cd packages/usdk
npm i
npm i -g .
usdk --version
```

# Development

## Install New Packages

#### Chat
```bash
npm i PACKAGE_NAME --workspace=@upstreet/chat
```

#### Docs
```bash
npm i PACKAGE_NAME --workspace=@upstreet/docs
```
