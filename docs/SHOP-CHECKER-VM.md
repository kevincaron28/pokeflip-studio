# Shop checker on the Oracle VM

**Why:** on its first passes from Supabase, 42 of 45 shops answered **429 (too many requests)** to their very first
request, while the same shops answer normally from a home connection. Shopify is limiting Supabase's shared outbound
address (many other projects use it), not our request rate. We do not work around that (no proxies, no address
rotation). Instead the checker runs on a machine with its own address: the free **Guilded-DB** Oracle VM, the same
way the Goblin Ledger collector runs there (systemd service and timer, own user, settings file under `/etc`, memory
limit, low priority).

**What runs:** the same checker code as the Supabase function (`supabase/functions/_shared/shop-checker.mjs`): public
storefront data only, a named User-Agent, ETags, back-off after 403/429, in-stock changes confirmed on the product page
before any alert. Every 2 minutes, it reads the shops that are due (each about every 4 to 5 minutes), 3 at a time.

**No Supabase secret on the VM.** It uses the public key (the website already ships it) plus its own **checker key**.
The key is made on the VM by the install script and stays there; Supabase stores only its SHA-256. With it the VM can
do five things and nothing else (`migrations/006-checker-key.sql`): read and save shop check state, read and save shop
stock, and add drop events of type "shop check, store seller, medium confidence at most".

| File | What |
| --- | --- |
| `deploy/shop-checker/install.sh` | One-time setup, as root: memory check (stops if under 250 MB available), Node 24 (reuses `/opt/node` from Goblin Ledger), user `cardstead`, `/opt/cardstead-checker/app` (only the checker files), the settings file with a new checker key, systemd units. Safe to run again |
| `deploy/shop-checker/run.sh` | One pass: updates the checker code from `main` at most once an hour, then runs `run.mjs` |
| `deploy/shop-checker/cardstead-checker.service` | The pass, as user `cardstead`: memory limit 192 MB (a pass peaks around 85 MB), lowest CPU and disk priority, first to stop if memory runs out |
| `deploy/shop-checker/cardstead-checker.timer` | Every 2 minutes |
| `/etc/cardstead-checker/checker.env` (server only) | Supabase URL and public key, `CHECKER_KEY`, pacing; mode 0640 root:cardstead, never committed |

## Install (once, after this PR is merged)

Run from Git Bash on the owner's PC.

**1. Connect to the DB VM through the bot server, and look at memory.**

```bash
ssh -i ~/.ssh/guilded_oracle -o "ProxyCommand=ssh -i ~/.ssh/guilded_oracle -W %h:%p ubuntu@168.138.70.194" ubuntu@10.0.0.145
free -m
```

The "available" column should show at least 250 MB. On 23 November it showed 566 MB before the Goblin Ledger
collector was added; the collector itself runs about one minute an hour. The install script checks this again and
stops if there is too little.

**2. Run the install script.**

```bash
curl -fsSL https://raw.githubusercontent.com/kevincaron28/pokeflip-studio/main/deploy/shop-checker/install.sh -o /tmp/cardstead-install.sh
sudo bash /tmp/cardstead-install.sh
```

It ends by printing one SQL line with a 64-character hash. That hash is not the key; the key stays in
`/etc/cardstead-checker/checker.env` on the VM. Never paste the key itself anywhere.

**3. Supabase → SQL Editor.** Run `migrations/006-checker-key.sql` once, then the `insert into public.checker_keys ...`
line the script printed.

**4. Turn off the Supabase cron job.** Supabase → Integrations → Cron → `shop-checker-tick` → disable. Two checkers
must not run at the same time. (The `push-sender` job stays on: it sends what the checker finds.)

**5. First pass by hand, then the timer.**

```bash
sudo systemctl start cardstead-checker.service
sudo journalctl -u cardstead-checker -n 30 --no-pager
```

The last line is a summary such as `{"shops":45,"unchanged":0,"read":44,"refused":0,"failed":1,"events":0}`. The first
read of each shop records what is there without alerting. If most shops show as `refused` here too, stop and report it.
Otherwise turn on the timer:

```bash
sudo systemctl enable --now cardstead-checker.timer
systemctl list-timers cardstead-checker.timer --no-pager
```

## Day to day

| Check | Command (on the VM) |
| --- | --- |
| Next and last pass | `systemctl list-timers cardstead-checker.timer --no-pager` |
| Last passes | `sudo journalctl -u cardstead-checker -n 40 --no-pager` |
| Refusals today | `sudo journalctl -u cardstead-checker --since today --no-pager \| grep -c 'back off'` |
| Memory | `free -m` and `systemctl status cardstead-checker.service` (shows the pass's peak memory) |

The checker code updates itself from `main` (at most once an hour). Re-run step 2 only when `install.sh`, the
`.service` or the `.timer` change.

## Troubleshooting

- **`checker key not accepted`:** the hash in `checker_keys` does not match the VM's key. Re-run the install script
  (it keeps the key and prints its hash again) and insert that line.
- **Killed by the memory limit:** lower `CHECKER_CONCURRENCY` to 1 in `checker.env` (`sudo nano /etc/cardstead-checker/checker.env`).
- **Many 429s from the VM too:** set `CHECKER_CONCURRENCY=1` and `CHECKER_GAP_MS=3000`, and lower `CHECKER_MAX_SHOPS` to 30
  so a pass ends within the 110-second limit.
- **Stop:** `sudo systemctl disable --now cardstead-checker.timer`, then re-enable the Supabase cron job if wanted.
- **Remove everything:** stop as above, then
  `sudo rm /etc/systemd/system/cardstead-checker.* && sudo systemctl daemon-reload && sudo rm -rf /opt/cardstead-checker /etc/cardstead-checker && sudo userdel cardstead`,
  and in Supabase `delete from public.checker_keys where label = 'oracle-guilded-db';`.
