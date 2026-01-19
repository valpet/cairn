# Security Policy

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Cairn, please help us by reporting it responsibly.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:
- **Email**: security@cairn-project.org (placeholder - update with actual contact)
- **Subject**: [SECURITY] Vulnerability Report

### What to Include

When reporting a security vulnerability, please include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Any suggested fixes or mitigations
- Your contact information for follow-up

### Our Response Process

1. **Acknowledgment**: We will acknowledge receipt within 48 hours
2. **Investigation**: We will investigate and validate the report
3. **Fix Development**: If confirmed, we will develop and test a fix
4. **Disclosure**: We will coordinate disclosure with you
5. **Release**: We will release the fix and security advisory

### Disclosure Policy

- We follow responsible disclosure practices
- We will credit reporters in security advisories (unless anonymity is requested)
- We aim to release fixes within 90 days of report
- Critical vulnerabilities may be addressed faster

## Security Considerations

### Data Storage
- Cairn stores task data locally in JSONL format
- No data is transmitted to external servers by default
- Users should be aware of local data storage implications

### Dependencies
- We monitor and update dependencies regularly
- Security vulnerabilities in dependencies are addressed promptly
- We use tools like `npm audit` and dependabot for monitoring

### Best Practices for Users
- Keep Cairn and dependencies updated
- Be cautious with task data containing sensitive information
- Use appropriate file permissions for `.cairn` directories
- Consider encryption for sensitive task data

## Contact

For security-related questions or concerns:
- **Email**: peter.valtersson@gmail.com
- **GitHub**: Create a private security advisory

Thank you for helping keep Cairn secure!