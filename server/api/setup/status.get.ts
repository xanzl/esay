import { getRepo } from '../../db/client'

export default defineEventHandler(async (event) => {
  try {
    const count = await getRepo(event).countUsers()
    console.log(`[esay] setup/status userCount=${count}`)
    return { initialized: count > 0, userCount: count }
  } catch (error) {
    console.error(JSON.stringify({
      message: 'setup/status failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }))
    throw error
  }
})
