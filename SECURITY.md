# Security policy — Cardstead

Report vulnerabilities privately to the repository owner; never post credentials, user data, or exploit details in public issues.

- The browser may contain only a **Supabase publishable key**, never a service-role key, customer inventory export, private user JWT, or server secret. All user data is protected by Supabase Auth and RLS.
- Authenticated users have SELECT access only to their own snapshots. Anonymous users have no snapshot access. Client roles cannot directly INSERT/UPDATE/DELETE snapshot rows.
- The public RPC `pokeflip_save_snapshot` is **SECURITY INVOKER** and delegates to a narrow, privileged writer in `pokeflip_private`, a schema **not exposed through the Data API**. The writer derives owner exclusively from `auth.uid()`, validates schema and size, and enforces revision compare-and-swap. No dynamic SQL or user-provided owner is accepted.
- PostgreSQL privileges, not frontend checks, prevent writes to other accounts. The public function does not bypass RLS on its own.
- Cloud auto-backup is opt-in, runs only while the app is open, stops on revision conflicts, and must not be treated as a replacement for periodic JSON backups.
- No actual production user login or cross-account attack test has been completed; do not market the platform as independently penetration tested.
- The app has not passed third-party security review or device-based recognition accuracy studies.
