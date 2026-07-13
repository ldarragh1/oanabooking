# If you get a new laptop — how to get back up and running

Follow these steps in order, in the **Terminal** app (Applications → Utilities → Terminal). Copy-paste each block exactly as written. You can also read this document directly on github.com (open the `oanabooking` repo → click `RECOVERY.md`) before you've installed anything — see step 3 for logging in first.

## 1. Install Homebrew (the tool that installs everything else)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow any on-screen instructions it gives you at the end (it sometimes asks you to run one or two more lines — just copy whatever it tells you to).

## 2. Install the tools you need

```bash
brew install git gh
```

This installs git (version control) and `gh` (GitHub's command-line tool).

## 3. Log into GitHub

```bash
gh auth login
```

Follow the prompts (choose GitHub.com, HTTPS, and "Login with a web browser"). It'll give you a code and open your browser — paste the code in, log into your GitHub account, approve it.

## 4. Download the project

```bash
cd ~
gh repo clone ldarragh1/oanabooking
cd oanabooking
```

That's it — no secrets to restore separately. `config.js` only contains the backend's public web address, not a password, so it comes down with everything else automatically.

## 5. Install VS Code and Claude Code

- Download VS Code from [code.visualstudio.com](https://code.visualstudio.com) and install it normally.
- Sign into VS Code with the same account you used before (GitHub or Microsoft) — this restores your extensions and settings automatically.
- Install Claude Code by following [claude.com/code](https://claude.com/claude-code) — sign in with the same account you use now.

## 6. Open the project

In VS Code: **File → Open Folder** → select the `oanabooking` folder you cloned in step 4. Open Claude Code from within VS Code (or Terminal, `cd` into that folder first) and you're back to exactly where you are today.

---

Everything here survives on its own regardless of what happens to this specific laptop — the code lives on GitHub, and the actual admin password lives only in Oana's head (and the Supabase secret store), never in a file. The only thing you personally need to keep safe is your GitHub login itself.
