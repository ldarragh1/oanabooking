# If you get a new laptop — how to get back up and running

Follow these steps in order, in the **Terminal** app (Applications → Utilities → Terminal). Copy-paste each block exactly as written.

## 1. Install Homebrew (the tool that installs everything else)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow any on-screen instructions it gives you at the end (it sometimes asks you to run one or two more lines — just copy whatever it tells you to).

## 2. Install the tools you need

```bash
brew install git gh node
```

This installs git (version control), `gh` (GitHub's command-line tool), and Node.js. This step can take a while on an older Mac — just let it run.

## 3. Log into GitHub

```bash
gh auth login
```

Follow the prompts (choose GitHub.com, HTTPS, and "Login with a web browser"). It'll give you a code and open your browser — paste the code in, log into your GitHub account, approve it.

## 4. Download the project

```bash
cd ~
gh repo clone darraghlynch/oanabooking
cd oanabooking
```

(If the repo ends up under a different name or account, adjust that middle line — but this is what we're creating it as.)

## 5. Restore the secret config file

Open your password manager, find the saved note called **"Oana Clinic — config.js"**, and copy its full contents.

In Terminal, run:

```bash
cp config.example.js config.js
open -e config.js
```

This opens `config.js` in TextEdit. Select all (Cmd+A), delete, paste in what you copied from your password manager, save (Cmd+S), and close it.

## 6. Install VS Code and Claude Code

- Download VS Code from [code.visualstudio.com](https://code.visualstudio.com) and install it normally.
- Sign into VS Code with the same account you used before (GitHub or Microsoft) — this restores your extensions and settings automatically.
- Install Claude Code by following [claude.com/code](https://claude.com/claude-code) — sign in with the same account you use now.

## 7. Open the project

In VS Code: **File → Open Folder** → select the `oanabooking` folder you cloned in step 4. Open Claude Code from within VS Code (or Terminal, `cd` into that folder first) and you're back to exactly where you are today.

---

**The one thing you must keep safe outside this laptop:** the password manager note from step 5. Everything else (this document, all the code, your GitHub login) survives on its own regardless of what happens to this specific laptop.
