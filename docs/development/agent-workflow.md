# Agent workflow

Read repository AGENTS.md, [contributing](contributing.md), [testing](testing.md), and the relevant consumer guide before changing behavior.

Work in the package checkout, keep application fixtures disposable, and leave sibling table-builder changes untouched. Match PHP, SDK, manifests, React, docs and Boost assets when modifying a public contract.

Run focused checks while editing, then required full gates. Investigate failures; do not add suppressions or reduce coverage. Report the exact dependency/database/browser combinations tested, installation artifacts produced, and remaining limitations.

Repository commands may create local fixtures and archives. Publishing npm/Composer releases, pushing tags or modifying working consumer applications requires explicit task scope. Consumer Boost resources are shipped assets, not instructions to install agent configuration into this repository.
