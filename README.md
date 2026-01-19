# Cairn

A CLI tool for long-term memory through task management for GitHub Copilot.

## Installation

```bash
npm install -g @cairn/cli
```

## Usage

```bash
cairn create "My Task"
cairn list
cairn update <id> --status closed
cairn dep add <child> <parent> --type blocks
```

## Development

This is a monorepo with packages/core and packages/cli.

```bash
npm install
npm run build
```