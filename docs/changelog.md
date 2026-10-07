# Maintaining the changelog

The public changelog is a static page in `src/app/changelog/page.tsx`. Keep entries newest first. Each entry needs a stable section ID, a readable date in a `<time dateTime="YYYY-MM-DD">`, a heading, and short notes about what changed for the person using Keepall. Link to a Help guide when the change needs instructions.

## Publishing a release note

1. Draft the note alongside the feature or fix. Describe the final behavior, any action users need to take, and relevant limits. Leave drafts out of the public page until the change is available.
2. Deploy the change and check the affected workflow on `https://www.keepall.app`. Record the deployed commit and deployment date in the release PR. A passing local test or merged commit alone does not establish a public release.
3. Add the entry to the top of the changelog with that verified release date. Use a section ID such as `2026-10-08-backup-fix`. Group multiple changes from the same release together. Add a version only if the public app has an established release version.
4. Run `pnpm lint` and `pnpm typecheck`, open `/changelog`, and check its links and layout at phone and desktop widths before publishing the note.

## The first entry

The October 7, 2026 entry is a public documentation baseline. Its date records when the public website described those core capabilities, not when they originally shipped. Do not convert it into a launch date or infer earlier release dates from Git history.

The baseline draws on the public About page and Help guides for getting started, collections and tags, Chrome capture, imports, and storage and backups. It intentionally makes no claim that locally integrated upgrades have shipped. Add those upgrades as dated release notes after checking the public app.

Keep unreleased plans, internal checklist items, and implementation details out of the public changelog.
