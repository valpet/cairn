# Horizon

A CLI tool for long-horizon memory through task management for GitHub Copilot.

## Installation

```bash
npm install -g @horizon/cli
```

## Usage

```bash
horizon create "My Task"
horizon list
horizon update <id> --status closed
horizon dep add <child> <parent> --type blocks
```

## Development

This is a monorepo with packages/core and packages/cli.

```bash
npm install
npm run build
```