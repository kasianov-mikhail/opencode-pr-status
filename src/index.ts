import { Plugin } from "@opencode/plugin"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Pulls, type Checks, type Pull } from "./rpc"

const exec = promisify(execFile)

const fields = "number,title,url,headRefName,isDraft,reviewDecision,statusCheckRollup"

interface Check {
  __typename?: string
  status?: string
  conclusion?: string
  state?: string
}

interface GhPull {
  number: number
  title: string
  url: string
  headRefName: string
  isDraft: boolean
  reviewDecision: string
  statusCheckRollup: Check[] | null
}

const failed = new Set(["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"])

const checks = (rollup: Check[] | null): Checks => {
  if (!rollup || rollup.length === 0) return "none"

  const states = rollup.flatMap((check) => [check.conclusion, check.state])
  if (states.some((state) => state && failed.has(state))) return "failure"
  if (states.some((state) => state === "PENDING" || state === "EXPECTED")) return "pending"
  if (rollup.some((check) => check.status && check.status !== "COMPLETED")) return "pending"
  return "success"
}

const branch = async (directory: string): Promise<string> => {
  try {
    const { stdout } = await exec("git", ["symbolic-ref", "--short", "HEAD"], { cwd: directory })
    return stdout.trim()
  } catch {
    return ""
  }
}

const pull = (row: GhPull, head: string): Pull => ({
  number: row.number,
  title: row.title,
  url: row.url,
  draft: row.isDraft,
  current: head !== "" && row.headRefName === head,
  review: row.reviewDecision ?? "",
  checks: checks(row.statusCheckRollup),
})

const reason = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    const stderr = "stderr" in error ? String(error.stderr).trim() : ""
    if (stderr) return stderr
    if ("message" in error) return String(error.message)
  }
  return String(error)
}

export default Plugin.define({
  id: "pr-status",
  async setup(ctx) {
    await ctx.rpc.register(Pulls, {
      list: async (input) => {
        const { directory } = input as { directory: string }

        try {
          const { stdout } = await exec("gh", ["pr", "list", "--json", fields, "--limit", "30"], { cwd: directory })
          const rows = JSON.parse(stdout) as GhPull[]
          const head = await branch(directory)
          const pulls = rows.map((row) => pull(row, head))
          return { pulls: pulls.sort((left, right) => Number(right.current) - Number(left.current)) }
        } catch (error) {
          return { pulls: [], error: reason(error) }
        }
      },
    })
  },
})
