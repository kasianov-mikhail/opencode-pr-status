import { createSignal, onCleanup } from "solid-js"
import { Command, ComposerPill, createKeyed, Plugin, type IconName } from "@opencode/plugin/gui"
import { Pulls, type Pull, type PullList } from "./rpc"

const icon = (pull: Pull): IconName => {
  if (pull.checks === "failure") return "circle-x"
  if (pull.checks === "pending") return "circle-exclamation"
  if (pull.checks === "success") return "circle-check"
  return "github"
}

const tone = (pull: Pull) => {
  if (pull.checks === "failure") return "danger" as const
  if (pull.checks === "pending") return "warning" as const
  if (pull.checks === "success") return "success" as const
}

const review = (pull: Pull): string => {
  if (pull.review === "APPROVED") return "approved"
  if (pull.review === "CHANGES_REQUESTED") return "changes"
  if (pull.review === "REVIEW_REQUIRED") return "review"
  return ""
}

const shown = 10
const stale = 60_000

export default Plugin.define({
  i18n: {
    en: {
      title: "Pull requests",
      refresh: "Pull requests: refresh",
      all: "All pull requests",
      noSession: "No active session",
      none: "No open pull requests",
    },
  },
  setup(ctx) {
    const [state, setState] = createSignal<Record<string, PullList>>({})

    const load = async (directory: string, signal?: AbortSignal) => {
      try {
        const result = (await ctx.client.rpc(Pulls).list({ directory })) as PullList
        if (!signal?.aborted) setState((previous) => ({ ...previous, [directory]: result }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!signal?.aborted) setState((previous) => ({ ...previous, [directory]: { pulls: [], error: message } }))
      }
    }

    createKeyed(
      () => ctx.sessions.current()?.directory,
      (directory) => {
        const controller = new AbortController()
        void load(directory, controller.signal)
        const timer = setInterval(() => void load(directory, controller.signal), stale)

        onCleanup(() => {
          controller.abort()
          clearInterval(timer)
        })
      },
    )

    ctx.add(Command, () => ({
      id: "refresh",
      title: ctx.t("refresh"),
      keywords: "pr github checks review",
      run: async () => {
        const directory = ctx.sessions.current()?.directory
        if (!directory) {
          ctx.toast.show({ title: ctx.t("title"), description: ctx.t("noSession"), variant: "error" })
          return
        }

        await load(directory)
        const entry = state()[directory]

        if (entry?.error) {
          ctx.toast.show({ title: ctx.t("title"), description: entry.error, variant: "error", duration: 8000 })
          return
        }

        const count = entry?.pulls.length ?? 0
        ctx.toast.show({
          title: ctx.t("title"),
          description: count > 0 ? `${count} open` : ctx.t("none"),
          variant: count > 0 ? "success" : "default",
          icon: "github",
        })
      },
    }))

    ctx.add(ComposerPill, {
      id: "pulls",
      order: 10,
      show: (input) => {
        const entry = state()[input.session.directory]
        if (!entry) return undefined

        if (entry.error) {
          if (/not a git repository|no git remotes/i.test(entry.error)) return undefined

          return {
            icon: "github",
            label: "PR",
            tone: "warning",
            title: entry.error,
            rows: [{ id: "error", label: entry.error }],
          }
        }

        if (entry.pulls.length === 0) return undefined

        const current = entry.pulls.find((pull) => pull.current)
        const focus = current ? [current] : entry.pulls
        const worst = focus.some((pull) => pull.checks === "failure")
          ? "danger"
          : focus.some((pull) => pull.checks === "pending")
            ? "warning"
            : "success"

        const rows = entry.pulls.slice(0, shown).map((pull) => ({
          id: String(pull.number),
          label: `#${pull.number} ${pull.title}`,
          icon: icon(pull),
          tone: tone(pull),
          detail: [pull.draft ? "draft" : "", review(pull)].filter(Boolean).join(" · "),
          run: () => ctx.system.openExternal(pull.url),
        }))

        const rest =
          entry.pulls.length > shown
            ? [
                {
                  id: "all",
                  label: ctx.t("all"),
                  icon: "github" as const,
                  run: () =>
                    ctx.system.openExternal(entry.pulls[0].url.replace(/\/pull\/\d+$/, "/pulls")),
                },
              ]
            : []

        return {
          icon: "github",
          label: current ? `#${current.number}` : `${entry.pulls.length} PR`,
          tone: worst,
          title: ctx.t("title"),
          rows: [...rows, ...rest],
        }
      },
    })
  },
})
