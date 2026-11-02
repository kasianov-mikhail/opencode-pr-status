# opencode-pr-status

GitHub pull request status in OpenCode Desktop.

A pill above the composer shows the pull request for your current branch: its number, and a
colour for its checks. Without a pull request on the branch, the pill counts every open pull
request and takes the colour of the worst one. Click it to see the list.

Each row shows the check state, the branch, the review state, and a draft marker. Clicking a
row opens the pull request in the browser.

## Requirements

- OpenCode Desktop 2.2 or newer.
- The `gh` CLI, signed in: run `gh auth login` once.

## Install

```sh
git clone https://github.com/kasianov-mikhail/opencode-pr-status.git ~/opencode-pr-status
cd ~/opencode-pr-status
bun install
bunx vite build
```

Add the directory to your global config, `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugins": ["/Users/you/opencode-pr-status"]
}
```

OpenCode reloads config on save. The plugin appears under **Settings → Extensions → Plugins**,
where a switch turns its interface off.

## Use

- The pill appears above the composer in a session whose directory has open pull requests.
- `Pull requests: refresh` in the command palette (Ctrl+P) reloads the data and shows a toast.
  Use it to check that the plugin works in a repository without pull requests.

The data refreshes every 60 seconds and when you switch sessions.

## How it works

- `src/index.ts` is the server part. It runs `gh pr list` in the session directory, maps every
  check to `success`, `failure`, `pending`, or `none`, and serves the result over RPC.
- `src/gui.tsx` is the desktop part. It adds the composer pill and the refresh command.
- `src/rpc.ts` is the contract both parts share.

## Develop

```sh
bun install
bunx tsc --noEmit
bunx vite build
```

The desktop reads `dist/gui-experimental.cjs`, and reloads it in every window after a rebuild.
The server part reloads from `src/index.ts` on save.

## Limits

- Open pull requests only, at most 30, the first 10 listed in the menu.
- The GUI plugin API is experimental and may change between OpenCode releases. Upgrade
  `@opencode/plugin` and rebuild after an OpenCode update.

## License

MIT
