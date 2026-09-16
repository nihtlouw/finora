# Finora Bootstrap Workspace Hotfix

## Fixed
New user signup could fail on the first dashboard load with:

`PrismaClientKnownRequestError: Unique constraint failed on Workspace_slug_key`

The workspace bootstrap path is now race-safe for parallel server renders/navigation. If two requests attempt to create the same initial workspace at the same time, the losing request re-reads the workspace membership created by the winning request instead of crashing.

## User action
No new database migration is required for this hotfix.

Restart the dev server after replacing the files, then create/sign in with the new account again.
