# sample-repo

Pre-seeded EchoDev example. Run from the repo root:

```bash
echodev --repo examples/sample-repo list
echodev --repo examples/sample-repo recall src/auth/login.ts
echodev --repo examples/sample-repo graph --format mermaid
echodev --repo examples/sample-repo check examples/sample-repo/fixtures/conflicting.diff
```

Seeded decisions:

- **001** JWT in HttpOnly cookie (auth)
- **002** Refresh token rotation — *inherits* 001
- **003** Shared Redis cache (cache) — *superseded by* 004
- **004** Per-service cache — *conflicts with* 003

`fixtures/conflicting.diff` hits an expiry condition of 001 (switching to
server-side sessions) and should be flagged by `echodev check`.
