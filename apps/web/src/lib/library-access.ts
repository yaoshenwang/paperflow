import { questionItems, sourceDocuments } from '@/db/schema'
import { and, eq, inArray, isNull, ne, or, type SQL } from 'drizzle-orm'
import { hasPermission, type SessionUser } from '@/lib/auth'

export type LibraryScope = 'public' | 'school' | 'all'

export const PUBLIC_REVIEW_STATUSES = ['approved', 'published'] as const
export const FORMAL_RIGHTS_STATUSES = ['public_domain', 'cc', 'school_owned', 'licensed'] as const
const PUBLIC_RIGHTS_STATUSES = ['public_domain', 'cc', 'licensed'] as const

export function resolveLibraryScope(rawScope: string | null, user: SessionUser | null): LibraryScope {
  if (rawScope === 'school') {
    return user?.orgId ? 'school' : 'public'
  }
  if (rawScope === 'all') {
    return user?.orgId ? 'all' : 'public'
  }
  return 'public'
}

export function canReviewItems(user: SessionUser | null): boolean {
  return user ? hasPermission(user.role, 'items:review') : false
}

export function canManageRights(user: SessionUser | null): boolean {
  return user ? hasPermission(user.role, 'items:manage_rights') : false
}

export function buildItemVisibilityCondition(
  user: SessionUser | null,
  scope: LibraryScope,
): SQL<unknown> {
  const publicCondition = and(
    inArray(questionItems.rightsStatus, [...PUBLIC_RIGHTS_STATUSES]),
    excludeAiLabItems(),
  )

  const schoolCondition = user?.orgId
    ? and(
        eq(questionItems.rightsStatus, 'school_owned'),
        excludeAiLabItems(),
        or(
          eq(sourceDocuments.ownerOrgId, user.orgId),
          user.orgName ? eq(questionItems.school, user.orgName) : undefined,
        ),
      )
    : undefined

  if (scope === 'school') {
    return schoolCondition ?? eq(questionItems.id, '__no_visible_school_items__')
  }

  if (scope === 'all' && schoolCondition) {
    return or(publicCondition, schoolCondition) as SQL<unknown>
  }

  return publicCondition as SQL<unknown>
}

export function buildSourceDocumentVisibilityCondition(
  user: SessionUser | null,
  scope: LibraryScope,
): SQL<unknown> {
  const publicCondition = and(
    inArray(sourceDocuments.rightsStatus, [...PUBLIC_RIGHTS_STATUSES]),
    ne(sourceDocuments.sourceType, 'ai_lab'),
  )

  const schoolCondition = user?.orgId
    ? and(
        eq(sourceDocuments.rightsStatus, 'school_owned'),
        eq(sourceDocuments.ownerOrgId, user.orgId),
        ne(sourceDocuments.sourceType, 'ai_lab'),
      )
    : undefined

  if (scope === 'school') {
    return schoolCondition ?? eq(sourceDocuments.id, '__no_visible_school_documents__')
  }

  if (scope === 'all' && schoolCondition) {
    return or(publicCondition, schoolCondition) as SQL<unknown>
  }

  return publicCondition as SQL<unknown>
}

export function excludeAiLabItems(): SQL<unknown> {
  return or(isNull(questionItems.sourceDocumentId), ne(sourceDocuments.sourceType, 'ai_lab')) as SQL<unknown>
}
