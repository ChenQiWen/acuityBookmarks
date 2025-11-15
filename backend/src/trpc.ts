import { initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

/**
 * Creates the context for each request.
 * @param {FetchCreateContextFnOptions} opts - The options for creating the context.
 * @returns {object} The context object.
 */
export function createContext({
  req,
  resHeaders
}: FetchCreateContextFnOptions) {
  // For now, we're not using any context, but this is where you would
  // add things like database connections or user authentication.
  return {
    req,
    resHeaders
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create()

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router
export const publicProcedure = t.procedure
