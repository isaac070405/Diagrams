# Third-party notices

This project includes or builds on the work below. Each item keeps its own licence.

## Icons

Sources and licences are in [site/icons/CREDITS.md](site/icons/CREDITS.md).

- Twemoji (copyright Twitter, Inc and other contributors): CC-BY 4.0. The credit must stay with those icons.
- NIAID BioArt (qPCR machine, Ryan Kissinger): public domain.
- BioRender-style icons were supplied by the repository owner. Check the BioRender terms before reuse outside this project.

## Runtime dependencies (`source/package.json`)

The packages are open source, mostly under the MIT licence. Exact licences are in each package's `LICENSE` file.

| Package | Use |
|---|---|
| react, react-dom | Interface |
| Radix UI (`@radix-ui/*`) | Accessible interface primitives |
| smiles-drawer | Molecules from SMILES (diagrams 19, 20) |
| tailwind-merge, class-variance-authority, clsx | Styling helpers |
| lucide-react | Interface icons |
| cmdk, vaul, sonner, embla-carousel-react, react-day-picker, react-resizable-panels, next-themes | Interface components |
| react-hook-form, @hookform/resolvers, zod | Forms and validation |
| date-fns | Date handling |

## Build tools

Parcel, Vite, TypeScript, Tailwind CSS, PostCSS, Autoprefixer, html-inline and oxlint are used to build and check the site. None is shipped as a separate work.

To regenerate a full list with licence texts, run `pnpm licenses list` in `source/`.
