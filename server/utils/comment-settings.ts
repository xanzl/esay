import type { H3Event } from 'h3'
import { getRepo } from '../db/client'

export interface CommentSettings {
  enable_comment: boolean
  require_approval: boolean
}

const SETTINGS_KEY = 'comment.settings'

const DEFAULTS: CommentSettings = { enable_comment: true, require_approval: false }

export async function getCommentSettings(event: H3Event): Promise<CommentSettings> {
  const raw = await getRepo(event).getSetting(SETTINGS_KEY)
  if (!raw) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(raw) as Partial<CommentSettings>
    return {
      enable_comment: parsed.enable_comment !== false,
      require_approval: parsed.require_approval === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function setCommentSettings(event: H3Event, settings: CommentSettings): Promise<void> {
  await getRepo(event).setSetting(SETTINGS_KEY, JSON.stringify(settings))
}