# Security Policy

## Supported versions

Only the latest build on `main`, published at https://isaac070405.github.io/Diagrams/, receives fixes.

## Reporting a vulnerability

Report privately through [GitHub security advisories](https://github.com/isaac070405/Diagrams/security/advisories/new). Do not open a public issue.

Include the affected diagram type, steps to reproduce and the browser used.
The maintainer aims to acknowledge a report within 7 days and to share a fix plan within 30 days.

## Scope

The workspace runs entirely in the browser. Images, diagrams and custom icons stay on the device, stored in the browser's local storage.
In scope: script injection through imported files, pasted data or SVG export, and unsafe handling of uploaded images.
Out of scope: vulnerabilities in third-party dependencies with no effect on this project, and issues that need a modified browser.
