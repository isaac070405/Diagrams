# Biological pathway source

`public/pathway.html` is a bundle. `template.html` here is its readable page (markup, styles and the editor script).

Edit `template.html`, then from `source/`:

```
node pathway/pack.cjs public/pathway.html pathway/template.html public/pathway.html
cp public/pathway.html ../site/pathway.html
```

`pack.cjs` swaps the page inside the bundle. Fonts, React and the bundle loader stay as they are.
