# Contributing

Thanks for helping improve Diagram Workspace.

## Report a problem or suggest a change

Open an [issue](https://github.com/isaac070405/Diagrams/issues). Include:

- the diagram type (for example, 12 Biological pathway)
- the browser and version
- steps to reproduce, and a screenshot if the figure looks wrong

For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Make a change

1. Fork the repository and create a branch from `main`.
2. Edit the code in `source/`. Build steps are in [source/README.md](source/README.md).
3. Run the tests that cover your change, for example `node tests/xyaxis.test.cjs`, `node tests/contour.test.cjs` or `node tests/kite.test.cjs` from `source/`.
4. Copy the rebuilt `bundle.html` to `site/index.html`. `site/pathway.html` and `site/icons/` stay beside it.
5. Open a pull request that says what changed and why.

## Guidelines

- Keep changes small and focused. One pull request covers one change.
- Add a line to [CHANGELOG.md](CHANGELOG.md) under Unreleased.
- Follow the existing file layout and naming.
- New icons need a source and licence in `site/icons/CREDITS.md`.
- New dependencies need an entry in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Check keyboard use and colour contrast, as described in [ACCESSIBILITY.md](ACCESSIBILITY.md).

By contributing, you agree that your work is released under the [MIT License](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
