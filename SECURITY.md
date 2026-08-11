# Security

ATH, Again is a read-only portfolio viewer. It never needs a seed phrase, private key, trading permission, or withdrawal permission.

## Exchange credentials

- Create a dedicated API key with balance-reading permissions only.
- Do not enable trading or withdrawals.
- Credentials are sent over HTTPS, used in memory for one request, and are not persisted by the application.
- Revoke the key from the exchange after use if you do not intend to reuse it.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for issues that could expose credentials, user data, or provider access. Do not include live API keys in a report.
