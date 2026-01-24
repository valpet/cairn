# Cairn

A CLI tool and Visual Studio Code Extensin for long-term memory through task management for GitHub Copilot.

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

# Multiple issue files
cairn use              # Show current file and list available files
cairn use test         # Switch to test.jsonl
cairn use default      # Switch back to issues.jsonl
```

## Development

This is a monorepo with packages/core and packages/cli.

```bash
npm install
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

The software is intended for development and productivity purposes. Users are responsible for their own use of this software and should exercise appropriate caution and judgment.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting.
