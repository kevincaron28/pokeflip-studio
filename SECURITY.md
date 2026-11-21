# Security notes

Please report security vulnerabilities privately to the repository owner rather than posting tokens or exploit details in public issues.

The public Supabase publishable key is safe to expose only with enforced RLS. Never expose a service-role key, user JWT, private backups, or customer inventory. Authentication and permission checks are required for every cloud operation. The authorized `SECURITY DEFINER` RPC must derive owner from auth.uid(), validate inputs, enforce revisions, and not grant direct table writes.

The app has not passed a third-party security review, production pen test, real-device camera accuracy study, or guaranteed availability audit.
