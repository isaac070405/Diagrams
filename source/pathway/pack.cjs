const fs=require('fs');
const src=process.argv[2], tpl=fs.readFileSync(process.argv[3],'utf8'), out=process.argv[4];
let h=fs.readFileSync(src,'utf8');
const o='<script type="__bundler/template">';const i=h.indexOf(o)+o.length;const j=h.indexOf('</script>',i);
const payload=JSON.stringify(tpl).replace(/<\/(script)/gi,'<\\u002f$1');
h=h.slice(0,i)+payload+h.slice(j);
fs.writeFileSync(out,h);console.log(h.length);
