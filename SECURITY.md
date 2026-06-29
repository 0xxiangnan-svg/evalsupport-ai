# Security Policy

EvalSupport AI is a portfolio project, not a hosted production service. Security reports should focus on the source code, local demo behavior and repository hygiene.

## Supported Version

| Version | Supported |
| --- | --- |
| `0.1.x` | Yes |

## Secret Handling

The repository must not contain real API keys or private credentials.

- Use `.env.local` for real local secrets. It is ignored by git.
- Keep `.env.example` limited to placeholder names and safe defaults.
- BYOK provider keys are entered in the browser UI and stored in browser `localStorage`.
- BYOK keys must not be written to database records, screenshots, docs, test logs or git history.
- Run `npm run test:safety` before committing.

## Reporting A Security Issue

If this repository is public, open a GitHub issue only for non-sensitive security concerns.

For sensitive reports, contact the repository owner privately through the contact method shown on their GitHub profile. Do not paste secrets, exploit payloads or private credentials into public issues.

## Known MVP Limits

- `/admin/*` routes are intentionally unauthenticated for local portfolio demo simplicity.
- Local demo persistence uses process memory and browser storage.
- BYOK is suitable for local demo use, not production-grade key custody.
- Production use would require authentication, rate limiting, tenant isolation, encrypted secret storage and stronger audit logging.
