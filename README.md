# Upstreet Monorepo
## Available Workspaces

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

# Development

## Install New Packages

#### Chat
```bash
npm i PACKAGE_NAME --workspace=@upstreet/chat
```

#### Login
```bash
npm i PACKAGE_NAME --workspace=@upstreet/login
```

#### Docs
```bash
npm i PACKAGE_NAME --workspace=@upstreet/docs
```
