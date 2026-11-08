# Respiratory Project Website Roadmap

This roadmap orders the changes needed to turn the current single-user diagram
site into a friendly, account-private website for multiple users.

## 1. Protect user data — highest urgency

- Add account registration and sign-in.
- Use secure sessions with HTTPS, `HttpOnly`, `SameSite` cookies, logout, password
  reset, email verification, and optional MFA.
- Move user-created content out of browser-only storage and into a backend database.
- Give every diagram, draft, saved version, uploaded image, and custom icon an
  `owner_id`.
- Enforce ownership on the server for every read, create, update, delete, export,
  and download operation.
- Add database row-level security so a user can only access their own records.
- Keep diagrams private by default; add explicit, revocable sharing permissions
  only if sharing is later required.

## 2. Secure uploaded and exported content

- Store uploaded images and custom icons in private object storage.
- Use short-lived signed URLs instead of public file URLs.
- Validate file type, size, dimensions, and content.
- Sanitize SVG, HTML, and other user-controlled content before rendering.
- Apply rate limits to sign-in, password reset, saving, uploading, and exporting.
- Protect backups, logs, admin tools, and error reports from exposing private
  diagrams or credentials.

## 3. Migrate existing browser data safely

- Detect existing `localStorage` drafts, saved sheets, pathway versions, and
  custom icons.
- Offer an explicit “Import my existing work” step after first sign-in.
- Show what will be imported and report failures clearly.
- Keep downloaded JSON/project files as a fallback.
- Offer an opt-in cleanup of imported browser data after successful migration.

## 4. Create a personal workspace

- Replace the generic home experience with a signed-in dashboard.
- Add “My diagrams,” recent work, search, sorting, filters, thumbnails, and
  last-edited timestamps.
- Support rename, duplicate, archive/trash, restore, and permanent delete.
- Use clear ownership language such as “Private to you” and “My saved diagrams.”
- Add account settings, profile information, sign-out, and account deletion.

## 5. Make saving dependable

- Add visible states for `Saving…`, `Saved just now`, and `Save failed`.
- Autosave drafts to the server with retry handling and conflict detection.
- Preserve undo/redo and recoverable work after refresh or browser failure.
- Add version history with restore and clear replacement warnings.
- Keep manual JSON/project export and import for backup and portability.

## 6. Improve the editing workflow

- Provide a consistent flow:
  `Sign in → Dashboard → New/open diagram → Edit → Autosave → Export/share`.
- Add a clear account header, breadcrumbs, and return-to-dashboard navigation.
- Improve empty, loading, offline, expired-session, invalid-file, and save-error
  states with actionable instructions.
- Confirm destructive actions and provide undo after deletion where possible.
- Make template replacement visibly reversible.

## 7. Improve usability and accessibility

- Make the editor usable on tablets and smaller screens with a collapsible
  controls panel.
- Preserve a usable canvas while editing forms.
- Add keyboard navigation, visible focus states, screen-reader labels, and
  sufficient contrast.
- Do not communicate meaning through colour alone.
- Add a short first-use tour covering creation, saving, reopening, export, and
  import.

## 8. Operational readiness

- Add automated tests for authorization, ownership isolation, migration, saving,
  deletion, and sharing permissions.
- Add monitoring for failed saves, authentication errors, storage failures, and
  unexpected data access.
- Maintain encrypted backups and a tested recovery process.
- Document privacy, retention, deletion, and support procedures.
- Separate administrator access from normal users and audit administrative access.

## Recommended delivery flow

1. Authentication, secure sessions, backend database, ownership checks, and
   row-level security.
2. Private file storage and upload validation.
3. Browser-data migration and reliable server-backed autosave.
4. Personal dashboard and diagram management.
5. Save status, recovery, version history, and import/export improvements.
6. Responsive/accessibility and onboarding improvements.
7. Sharing, collaboration, and operational hardening.

The frontend must not be the security boundary: hiding another user's diagram in
the interface is insufficient unless the backend also rejects unauthorized
access.
