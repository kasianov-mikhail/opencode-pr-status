import { Rpc } from "@opencode/schema/rpc"

export type Checks = "success" | "failure" | "pending" | "none"

export interface Pull {
  number: number
  title: string
  url: string
  draft: boolean
  current: boolean
  review: string
  checks: Checks
}

export interface PullList {
  pulls: Pull[]
  error?: string
}

const pull = {
  type: "object",
  properties: {
    number: { type: "number" },
    title: { type: "string" },
    url: { type: "string" },
    draft: { type: "boolean" },
    current: { type: "boolean" },
    review: { type: "string" },
    checks: { type: "string" },
  },
  required: ["number", "title", "url", "draft", "current", "review", "checks"],
  additionalProperties: false,
} as const

export const Pulls = Rpc.define({
  id: "pr-status",
  methods: {
    list: {
      input: {
        type: "object",
        properties: { directory: { type: "string" } },
        required: ["directory"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          pulls: { type: "array", items: pull },
          error: { type: "string" },
        },
        required: ["pulls"],
        additionalProperties: false,
      },
    },
  },
  events: {},
} as const)
