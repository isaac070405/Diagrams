/* @ds-bundle: {"format":4,"namespace":"SciDiagram","components":[{"name":"Blueprint"},{"name":"ToolButton"},{"name":"Field"},{"name":"Panel"},{"name":"FontPicker"},{"name":"Figure"},{"name":"Canvas"},{"name":"Node"},{"name":"Edge"},{"name":"Compartment"},{"name":"Legend"},{"name":"Callout"},{"name":"ScaleBar"},{"name":"GradientBar"},{"name":"SystemWheel"},{"name":"Codebook"},{"name":"PhyloTree"},{"name":"FlowNode"},{"name":"FlowArrow"},{"name":"FlowStage"},{"name":"PedigreeSymbol"},{"name":"Pedigree"},{"name":"FoodWeb"},{"name":"PunnettSquare"},{"name":"EcoPyramid"},{"name":"DichotomousKey"},{"name":"Iceberg"},{"name":"Formula"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var F = React.Fragment;
  var gid = 0;

  /* ================= chemistry markup =================
     H_2O, NAD^+, Ca^{2+}, SO_4^{2-}, 10^{-7}. Digits without "_" stay on the baseline (ALDH2 is safe). */
  function chem(str) {
    var s = String(str == null ? '' : str), out = [], buf = '', i = 0;
    function flush() { if (buf) { out.push({ t: buf, m: 'n' }); buf = ''; } }
    while (i < s.length) {
      var c = s[i];
      if ((c === '_' || c === '^') && i + 1 < s.length) {
        flush();
        var mode = c === '_' ? 'sub' : 'sup', j = i + 1, part = '';
        if (s[j] === '{') { var k = s.indexOf('}', j); if (k < 0) k = s.length; part = s.slice(j + 1, k); i = k + 1; }
        else if (mode === 'sub') { while (j < s.length && /[0-9n]/.test(s[j])) { part += s[j]; j++; } if (!part) { part = s[j]; j++; } i = j; }
        else { while (j < s.length && /[0-9]/.test(s[j])) { part += s[j]; j++; } if (j < s.length && /[+\-−]/.test(s[j])) { part += s[j]; j++; } if (!part) { part = s[j]; j++; } i = j; }
        out.push({ t: part.replace(/-/g, '−'), m: mode });
      } else { buf += c; i++; }
    }
    flush();
    return out;
  }
  function plain(str) { return chem(str).map(function (p) { return p.t; }).join(''); }
  function ChemText(props) {
    var segs = chem(props.children), kids = [], shift = 0;
    segs.forEach(function (p, i) {
      var target = p.m === 'sub' ? 0.32 : p.m === 'sup' ? -0.42 : 0, dy = target - shift; shift = target;
      kids.push(h('tspan', { key: i, dy: dy ? dy + 'em' : undefined, style: p.m === 'n' ? undefined : { fontSize: '70%' } }, p.t));
    });
    if (shift) kids.push(h('tspan', { key: 'r', dy: (-shift) + 'em' }, '​'));
    var rest = Object.assign({}, props); delete rest.children;
    return h('text', rest, kids);
  }
  function Formula(props) {
    return h('span', { className: 'sd-formula' }, chem(props.children).map(function (p, i) {
      return p.m === 'sub' ? h('sub', { key: i }, p.t) : p.m === 'sup' ? h('sup', { key: i }, p.t) : h(F, { key: i }, p.t);
    }));
  }

  /* ================= diagram fonts ================= */
  var FONTS = [
    { id: 'arial', label: 'Arial' }, { id: 'helvetica', label: 'Helvetica' }, { id: 'roboto', label: 'Roboto' },
    { id: 'open-sans', label: 'Open Sans' }, { id: 'georgia', label: 'Georgia' }, { id: 'times', label: 'Times New Roman' }, { id: 'barlow', label: 'Barlow' }
  ];
  function fontClass(f) { return f && FONTS.some(function (x) { return x.id === f; }) ? ' sd-font-' + f : ''; }

  /* ================= Editor UI ================= */
  function Blueprint(p) {
    var tag = p.as || 'div', rest = Object.assign({}, p); delete rest.as; delete rest.children;
    rest.className = 'sd-bp' + (p.className ? ' ' + p.className : '');
    return h(tag, rest, p.children, h('i', { className: 'sd-corner tl' }), h('i', { className: 'sd-corner tr' }), h('i', { className: 'sd-corner bl' }), h('i', { className: 'sd-corner br' }));
  }
  function ToolButton(p) {
    return h('button', { type: 'button', className: 'sd-tbtn', 'data-on': p.on ? '1' : '0', 'data-compact': p.compact ? '1' : undefined, 'data-primary': p.primary ? '1' : undefined,
      disabled: p.disabled, title: p.title, 'aria-pressed': p.on == null ? undefined : !!p.on, onClick: p.onClick, style: p.style }, p.icon || null, p.children);
  }
  function Field(p) {
    var ctl = p.multiline
      ? h('textarea', { id: p.id, className: 'sd-input' + (p.code ? ' sd-code' : ''), rows: p.rows || 4, value: p.value, placeholder: p.placeholder, onChange: p.onChange, spellCheck: p.code ? false : undefined })
      : h('input', { id: p.id, className: p.type === 'range' ? 'sd-range' : 'sd-input', type: p.type || 'text', value: p.value, placeholder: p.placeholder, min: p.min, max: p.max, step: p.step, onChange: p.onChange });
    return h('label', { className: 'sd-field' }, p.label ? h('span', null, p.label) : null, ctl, p.help ? h('p', { className: 'sd-help' }, p.help) : null);
  }
  function Panel(p) {
    return h('section', { className: 'sd-panel' }, p.kicker ? h('span', { className: 'sd-kicker' }, p.kicker) : null, p.children, p.help ? h('p', { className: 'sd-help' }, p.help) : null);
  }
  function FontPicker(p) {
    var value = p.value || 'arial';
    return h('div', { className: 'sd-panel' },
      p.kicker === false ? null : h('span', { className: 'sd-kicker' }, p.kicker || 'Type'),
      h('div', { className: 'sd-fontlist', role: 'radiogroup', 'aria-label': 'Diagram font', 'data-layout': p.layout || 'column' },
        FONTS.map(function (f) {
          return h('button', { key: f.id, type: 'button', role: 'radio', 'aria-checked': value === f.id, className: 'sd-tbtn', 'data-on': value === f.id ? '1' : '0',
            style: { fontFamily: 'var(--font-' + (f.id === 'barlow' ? 'ui' : f.id) + ')' }, onClick: function () { p.onChange && p.onChange(f.id); } }, f.label);
        })));
  }

  /* ================= markers ================= */
  function mk(id, cls, kind) {
    var common = { id: id, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse', overflow: 'visible' };
    if (kind === 'bar') return h('marker', Object.assign({ viewBox: '0 0 4 14', refX: 2, refY: 7, markerWidth: 4, markerHeight: 14 }, common), h('line', { className: cls, x1: 2, y1: 0, x2: 2, y2: 14 }));
    if (kind === 'open') return h('marker', Object.assign({ viewBox: '0 0 11 10', refX: 10.3, refY: 5, markerWidth: 12, markerHeight: 11 }, common), h('path', { className: cls, d: 'M0.7,0.6 L10.3,5 L0.7,9.4 z' }));
    return h('marker', Object.assign({ viewBox: '0 0 11 9.2', refX: 11, refY: 4.6, markerWidth: 11, markerHeight: 9.2 }, common), h('path', { className: cls, d: 'M0,0 L11,4.6 L0,9.2 z' }));
  }
  function Defs() {
    return h('defs', null,
      mk('sd-m-arrow', 'sd-h-ink'), mk('sd-m-open', 'sd-h-open', 'open'), mk('sd-m-bar', 'sd-h-bar', 'bar'),
      mk('sd-m-induce', 'sd-h-induce'), mk('sd-m-pos', 'sd-h-pos'), mk('sd-m-negbar', 'sd-h-negbar', 'bar'));
  }

  /* ================= Canvas ================= */
  function Canvas(props) {
    var w = props.width || 800, ht = props.height || 450, dots = [];
    if (props.grid) {
      var pitch = props.grid === true ? 17 : props.grid;
      for (var x = pitch; x < w; x += pitch) for (var y = pitch; y < ht; y += pitch) dots.push(h('circle', { key: x + '-' + y, className: 'sd-grid-dot', cx: x, cy: y, r: 0.9 }));
    }
    return h('svg', { className: 'sd-canvas' + fontClass(props.font), viewBox: '0 0 ' + w + ' ' + ht, width: w, height: ht, role: 'img', 'aria-label': props.title || 'Scientific diagram' },
      props.title ? h('title', null, props.title) : null,
      h(Defs), dots.length ? h('g', { 'aria-hidden': 'true' }, dots) : null, props.children);
  }

  /* ================= Icon library (Icon Pack) ================= */
  /* [key, name, group, width/height, asset id]: the pathway editor's icon keys, stored as uploads in this system */
  var ICONS = [
    ['rtk', 'Receptor tyrosine kinase', 'Receptors', 0.45, '9ba54d8f3c79a5684a85c4f14e186aa5'],
    ['rtk-active', 'RTK dimer, phosphorylated', 'Receptors', 0.533, 'fa2f38d487f3fd5864a7e32ea01c3eaf'],
    ['receptor-ligand', 'Receptor with bound ligand', 'Receptors', 0.5, '6461ec2765dbdd204759af50afc8e3da'],
    ['gpcr', 'GPCR', 'Receptors', 0.517, '5de4b9fb06ab7e0722ea845f92f28ef1'],
    ['gpcr-gprotein', 'GPCR with G protein', 'Receptors', 1.221, 'd483de5167d053717f069b53ed02e8f8'],
    ['cytokine-jak', 'Cytokine receptor with JAK', 'Receptors', 0.75, 'f7d4c41aed12405f51a74f8e82867090'],
    ['cytokine-active', 'Activated cytokine receptor', 'Receptors', 0.946, 'fddfec65292d3d78b32e1b2d45113d7e'],
    ['tnf-receptor', 'TNF receptor', 'Receptors', 0.41, '3a1c55f4039f096501266ee15ff091d4'],
    ['receptor-y', 'Generic receptor (Y)', 'Receptors', 0.515, '0a306bc65d00db5c9af16488ccb56988'],
    ['receptor-u', 'Generic receptor (U)', 'Receptors', 0.56, '75a8e44744c5459e41293b35b5c67608'],
    ['transporter', 'Transporter / channel', 'Receptors', 0.827, '7fca53e157e8728d315cd2023c7b93ad'],
    ['ion-channel', 'Ligand-gated channel', 'Receptors', 0.91, 'c7003011476179bfd3f7f5b148f168e9'],
    ['pump', 'Pump (SERCA)', 'Receptors', 0.717, 'aae8b71028f1265af5bce02c32a339e0'],
    ['atp-synthase', 'ATP synthase', 'Receptors', 0.623, 'a090b7c8f36c6c88e72a7a34a3f576dd'],
    ['protein-globular', 'Protein (globular)', 'Proteins', 1.039, 'a885478d56658cc7fbf1666dc4cc275a'],
    ['protein-compact', 'Protein (kinase)', 'Proteins', 0.727, '575b7bb3169fea21c08e1095961a5503'],
    ['protein-arc', 'Protein (adaptor)', 'Proteins', 1.36, '73cccb6a3f48b4abdd1dfe1781aea8f4'],
    ['protein-complex', 'Protein complex / enzyme', 'Proteins', 1.825, '3626386c2b71f53453e149ed3b559031'],
    ['tf-zincfinger', 'Transcription factor (zinc finger)', 'Proteins', 1.037, '7034398cf4891f84d4b3e23168201ce6'],
    ['protein-acetylated', 'Acetylated protein', 'Proteins', 0.831, 'f42a3e1d4c6e8192a33f4636da5e00c2'],
    ['polypeptide', 'Polypeptide', 'Proteins', 0.93, '71b778342393a6a6076c9db870f9ec1c'],
    ['antibody', 'Antibody (IgG)', 'Proteins', 1.079, 'aa3f05377ed48231ff26544556a1bc1d'],
    ['ferritin', 'Ferritin', 'Proteins', 0.983, '126cfbd2d41f16d77cd3110cacccbd82'],
    ['transferrin-r', 'Transferrin receptor', 'Proteins', 0.733, 'c2e7160867d06744d73cb2d9c7a247bd'],
    ['dna', 'DNA', 'Nucleic acids', 2.133, 'b2a4fadedf4c892f4ea5ab6c921351cb'],
    ['dna-bases', 'DNA base pairs', 'Nucleic acids', 2.857, '718ed751810e5bc65133ea4c0b255ebe'],
    ['nucleosome', 'Nucleosome', 'Nucleic acids', 2.353, '111588f400cb8cf5abf1da238e3f21ad'],
    ['rna-polymerase', 'RNA polymerase transcribing', 'Nucleic acids', 1.481, '875a9c40d9fb5ed376ab26a75ae00e7d'],
    ['ribosome', 'Ribosome translating', 'Nucleic acids', 1.429, 'a2c5d26afed98307012821d33b0e2d84'],
    ['promoter', 'Promoter arrow', 'Nucleic acids', 1.656, '18e6f6e822f705f769d9d19d15a037c0'],
    ['atp', 'ATP', 'Small molecules', 1.586, 'a071dc402a9246bd267b8cec04a9ff36'],
    ['adp', 'ADP', 'Small molecules', 1.586, 'cff23a8b8b2813585786b6bbe43be2cb'],
    ['phosphate', 'Phosphate (P)', 'Small molecules', 1.0, '0e69cb4f32d60a5ed1f1f31058c6e195'],
    ['proton', 'Proton (H+)', 'Small molecules', 1.0, 'eb6fc78f43d174a42682cf1de4b241eb'],
    ['ros', 'Reactive oxygen species', 'Small molecules', 1.14, 'd6607081fa8b45cb878deeccaaea865b'],
    ['nucleotide-atp', 'ATP (structure)', 'Small molecules', 1.943, '6f84e90e43a820634b96d4fbf30267ed'],
    ['nucleotide-adp', 'ADP (structure)', 'Small molecules', 1.702, '9aab0bd84dddc19c1aea9b5347949893'],
    ['cycle', 'Cycle (TCA, Calvin…)', 'Small molecules', 1.0, 'cf651539668083e2ca899ff2fc9682ea'],
    ['phospholipid', 'Phospholipid', 'Small molecules', 0.367, 'f6eacd5f838a9aab6190a611fc1361d7'],
    ['triacylglycerol', 'Triacylglycerol', 'Small molecules', 0.469, 'f916c399d32fe00d519c8c0758154761'],
    ['beta-barrel', 'Beta barrel', 'Proteins', 0.582, 'ede5711b659b12eab3eb2c4bcf07347a'],
    ['atpase', 'ATPase', 'Receptors', 0.537, '8ed3828c4219986b89d083bbfd040b94'],
    ['dsdna-circular', 'Circular dsDNA', 'Nucleic acids', 0.997, 'fc688a76d0e574a8c9f753227a15a379'],
    ['plasmid', 'Plasmid', 'Nucleic acids', 0.982, '8ee3ac86826e1c111cae03ea11da354f'],
    ['base-pair-gc', 'G–C base pair', 'Nucleic acids', 3.117, 'eb9e09f01918e56860b53729c05f49c7'],
    ['spheres-1', 'Cytokines — cluster 1', 'Cytokines and immune cells', 1.111, 'fc90b42b91573ff082b929499f368373'],
    ['spheres-2', 'Cytokines — cluster 2', 'Cytokines and immune cells', 1.236, '7bfc341b5cb44af4e3da556cdc77628f'],
    ['spheres-3', 'Cytokines — cluster 3', 'Cytokines and immune cells', 1.071, '3e3914f875e4d30da4ecdeb95155c997'],
    ['spheres-4', 'Cytokines — cluster 4', 'Cytokines and immune cells', 1.05, 'f98c1ebe51db03fa028f1a12428aa22f'],
    ['cytokine-receptor-jak', 'Activated cytokine receptor (JAK)', 'Cytokines and immune cells', 0.948, 'a7ce08858144068f4a312b5fcefc697f'],
    ['cytokine-storm', 'Cytokine storm', 'Cytokines and immune cells', 1.481, '57a73b255eeaa6b99b4662f179fa46f7'],
    ['treg', 'Treg cell', 'Cytokines and immune cells', 0.962, '68a9a9930f4044af7365cc9367a67f7d'],
    ['th1', 'Th1 cell', 'Cytokines and immune cells', 0.963, '63dd21cc2b900b8ff9cdce1e14dcc6f9'],
    ['th2', 'Th2 cell', 'Cytokines and immune cells', 0.964, '0d8bf94d5859fd001a0e72b9bccf3cd2'],
    ['th17', 'Th17 cell', 'Cytokines and immune cells', 0.964, 'd2b08c6b405e873a418f6e0142cc641e'],
    ['treg-cytokines', 'Treg with cytokines', 'Cytokines and immune cells', 0.425, 'e73200b111c88828dee264306a9841c3'],
    ['th1-cytokines', 'Th1 with cytokines', 'Cytokines and immune cells', 0.404, 'c379598f147aeb887c31ea3519599bf6'],
    ['th2-cytokines', 'Th2 with cytokines', 'Cytokines and immune cells', 0.419, 'aeff31b999551c652b98acb3d8e84769'],
    ['th17-cytokines', 'Th17 with cytokines', 'Cytokines and immune cells', 0.419, 'c7a3a73fb885fceb88f758c43a54c1d6'],
    ['cancer-cytokines', 'Cancer cell with cytokines', 'Cytokines and immune cells', 1.088, '0a89816673c35d21b866c34bc52f6337'],
    ['neutrophil-degranulating', 'Neutrophil degranulating', 'Cytokines and immune cells', 1.424, 'd290fd8ec49dd524467675b4eddcd8c1'],
    ['eosinophil-degranulating', 'Eosinophil degranulating', 'Cytokines and immune cells', 1.257, '6a571c989909371849806b760d86f22e'],
    ['mast-cell-degranulating', 'Mast cell degranulating', 'Cytokines and immune cells', 1.26, 'ebf9fc37f47f8338b00693a022cd5010'],
    ['eppendorf', 'Eppendorf tube', 'Lab equipment', 0.547, '3f4f6caa16720e73a0246b4d80b2aa81'],
    ['eppendorf-open', 'Eppendorf tube (open)', 'Lab equipment', 0.547, 'a95fea5d0139b6c863fffab764b53265'],
    ['eppendorf-closed', 'Eppendorf tube (closed, filled)', 'Lab equipment', 0.427, '26bd7e63d1a51549ac1930bb7b6ec4ed'],
    ['falcon-15', 'Falcon tube 15 mL', 'Lab equipment', 0.175, '3735ed14f31d3584a85642432277fdd6'],
    ['falcon-15-filled', 'Falcon tube 15 mL (filled)', 'Lab equipment', 0.194, '8d47f440295c5ef3d820d334fc238911'],
    ['falcon-50', 'Falcon tube 50 mL', 'Lab equipment', 0.306, 'bc7ca1a6f7836b7c31d4e62b05740075'],
    ['falcon-50-filled', 'Falcon tube 50 mL (filled)', 'Lab equipment', 0.321, '970ffee21c8092b3d742cad871448ffa'],
    ['test-tube', 'Test tube', 'Lab equipment', 0.156, '1c285e7ff3860f9cd0a6847d3307a474'],
    ['test-tube-low', 'Test tube (low)', 'Lab equipment', 0.156, 'a6cf9432a5d30a6251e44b4aaf2ad849'],
    ['test-tube-half', 'Test tube (half)', 'Lab equipment', 0.156, '636b258806b5788de5f93ce79e7534b7'],
    ['test-tube-full', 'Test tube (full)', 'Lab equipment', 0.156, 'ed8ff19efe65efe7114cfc959c34d454'],
    ['pipette', 'Pipette', 'Lab equipment', 0.477, '69f0240c16adac3585c69857c01490b7'],
    ['petri-dish', 'Petri dish with cells', 'Lab equipment', 1.377, '69663a090a78e148c5fe92eb8f90de4a'],
    ['pcr-plate', 'PCR plate', 'Lab equipment', 2.992, '9ff913fdcf49b1817f574f4769a9e375'],
    ['cell', 'Cell', 'Cells', 0.971, 'b125b063d546e3593903e41678675bac'],
    ['epithelial-cell', 'Epithelial cell', 'Cells', 0.642, '64608fab11842f04fc8f06dda90ef5d0'],
    ['cancer-cell', 'Cancer cell', 'Cells', 0.994, 'd59a1b3a8e74dfa1c693844fc103555e']
  ];
  var ICON_BY = {}; ICONS.forEach(function (r) { ICON_BY[r[0]] = r; });
  function iconSrc(key) { var r = ICON_BY[key]; return r ? ((window.SciDiagram && window.SciDiagram.iconBase) || '') + '/_blob/' + r[4] : null; }
  var ICON_ROLE = { receptor: 'rtk', gpcr: 'gpcr-gprotein', transporter: 'transporter', channel: 'ion-channel', kinase: 'protein-compact', protein: 'protein-globular', adaptor: 'protein-arc', enzyme: 'protein-complex', tf: 'tf-zincfinger', gene: 'rna-polymerase', dna: 'dna' };

  /* ================= Node ================= */
  var PILL = { metabolite: 1, ligand: 1, messenger: 1 }, BOX = { process: 1, output: 1 };
  function shapeOf(p) { var r = p.role || 'protein'; return r === 'text' ? 'text' : PILL[r] ? 'pill' : BOX[r] ? 'box' : (p.src || p.icon ? 'glyph' : 'plain'); }
  function nodeBox(p) {
    var shape = shapeOf(p), len = plain(p.label).length, sl = p.sub ? plain(p.sub).length : 0;
    if (shape === 'glyph') { var s = p.size || 52; return { x: p.x, y: p.y, w: s, h: s, shape: shape }; }
    var w = p.w || Math.max(shape === 'pill' ? 72 : 56, len * (shape === 'pill' ? 8 : 7.4) + (shape === 'pill' ? 32 : 24), sl * 6.4 + 24);
    var hh = p.h || (shape === 'pill' ? 30 : 28) + (p.sub && shape !== 'pill' ? 15 : 0);
    if (shape === 'text') hh = p.h || 18 + (p.sub ? 15 : 0);
    return { x: p.x, y: p.y, w: w, h: hh, shape: shape };
  }
  function port(p, side, offset) {
    var b = nodeBox(p), o = offset || 0, hw = b.w / 2, hh = b.h / 2;
    var inset = b.shape === 'pill' ? hh * 0.45 : 0;
    switch (side) {
      case 'n': return [b.x + o, b.y - hh]; case 's': return [b.x + o, b.y + hh];
      case 'e': return [b.x + hw, b.y + o]; case 'w': return [b.x - hw, b.y + o];
      case 'ne': return [b.x + hw - inset, b.y - hh]; case 'nw': return [b.x - hw + inset, b.y - hh];
      case 'se': return [b.x + hw - inset, b.y + hh]; case 'sw': return [b.x - hw + inset, b.y + hh];
      default: return [b.x, b.y];
    }
  }
  function Node(p) {
    var b = nodeBox(p), role = p.role || 'protein', x0 = b.x - b.w / 2, y0 = b.y - b.h / 2, kids = [];
    var cls = 'sd-node sd-' + b.shape + ' sd-role-' + role + (p.tone === 'accent' ? ' sd-tone-accent' : '');
    if (b.shape === 'glyph') {
      kids.push(h('image', { key: 'i', href: p.src || iconSrc(p.icon === true ? ICON_ROLE[role] : p.icon), x: x0, y: y0, width: b.w, height: b.h, preserveAspectRatio: 'xMidYMid meet' }));
      kids.push(h(ChemText, { key: 'l', className: 'sd-label', x: b.x, y: y0 + b.h + 11 }, p.label));
      if (p.sub) kids.push(h(ChemText, { key: 's', className: 'sd-sub', x: b.x, y: y0 + b.h + 26 }, p.sub));
    } else {
      if (b.shape !== 'text') kids.push(h('rect', { key: 'r', className: 'sd-shape', x: x0, y: y0, width: b.w, height: b.h, rx: b.shape === 'pill' ? b.h / 2 : 3 }));
      var twoLine = p.sub && b.shape !== 'pill';
      kids.push(h(ChemText, { key: 'l', className: 'sd-label', x: b.x, y: twoLine ? b.y - 7 : b.y }, p.label));
      if (p.sub) kids.push(h(ChemText, { key: 's', className: 'sd-sub', x: b.x, y: twoLine ? b.y + 9 : y0 + b.h + 11 }, p.sub));
    }
    if (p.badge) kids.push(h('g', { key: 'b', className: 'sd-badge' }, h('circle', { cx: x0 + b.w, cy: y0, r: 7.5 }), h('text', { x: x0 + b.w, y: y0 + 0.5 }, p.badge === true ? 'P' : p.badge)));
    return h('g', { className: cls }, kids);
  }

  /* ================= Edge ================= */
  var ETYPES = [['activate', 'Activation'], ['inhibit', 'Inhibition'], ['convert', 'Conversion (metabolic)'], ['induce', 'Induction (expression)'], ['translocate', 'Translocation'], ['feedbackPos', 'Positive feedback'], ['feedbackNeg', 'Negative feedback']];
  var HEAD = { activate: 'sd-m-arrow', inhibit: 'sd-m-bar', convert: 'sd-m-open', induce: 'sd-m-induce', translocate: 'sd-m-arrow', feedbackPos: 'sd-m-pos', feedbackNeg: 'sd-m-negbar' };
  function unit(dx, dy) { var l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  function Edge(p) {
    var type = HEAD[p.type] ? p.type : 'activate', a = p.from, z = p.to, gap = p.gap == null ? 3.4 : p.gap;
    var bend = p.bend != null ? p.bend : (type === 'feedbackPos' || type === 'feedbackNeg' ? 40 : 0);
    var mx = (a[0] + z[0]) / 2, my = (a[1] + z[1]) / 2, n = unit(-(z[1] - a[1]), z[0] - a[0]);
    var cx = mx + n[0] * bend, cy = my + n[1] * bend;
    var us = bend ? unit(cx - a[0], cy - a[1]) : unit(z[0] - a[0], z[1] - a[1]), ue = bend ? unit(z[0] - cx, z[1] - cy) : us;
    var s = [a[0] + us[0] * gap, a[1] + us[1] * gap], e = [z[0] - ue[0] * gap, z[1] - ue[1] * gap];
    var d = bend ? 'M' + s + ' Q' + cx + ',' + cy + ' ' + e : 'M' + s + ' L' + e, label = null;
    if (p.label) {
      var side = p.labelSide === 'left' ? -1 : 1, off = p.labelOffset == null ? 10 : p.labelOffset;
      var bx = bend ? 0.25 * s[0] + 0.5 * cx + 0.25 * e[0] : (s[0] + e[0]) / 2, by = bend ? 0.25 * s[1] + 0.5 * cy + 0.25 * e[1] : (s[1] + e[1]) / 2;
      var nx = n[0] * side, ny = n[1] * side;
      label = h(ChemText, { x: bx + nx * off, y: by + ny * off, textAnchor: Math.abs(nx) > 0.5 ? (nx > 0 ? 'start' : 'end') : 'middle', dominantBaseline: Math.abs(nx) > 0.5 ? 'central' : (ny > 0 ? 'hanging' : 'auto') }, p.label);
    }
    return h('g', { className: 'sd-edge sd-edge-' + type },
      h('path', { className: 'sd-shaft', d: d, markerEnd: 'url(#' + HEAD[type] + ')', markerStart: p.both ? 'url(#' + HEAD[type] + ')' : undefined }), label);
  }
  function legendFor(edges) {
    var used = {}; (edges || []).forEach(function (e) { used[e.type || e] = 1; });
    return ETYPES.filter(function (t) { return used[t[0]]; }).map(function (t) { return { edge: t[0], label: t[1] }; });
  }

  /* ================= Compartment ================= */
  function Compartment(p) {
    var kind = p.kind || 'compartment', x = p.x, y = p.y, w = p.w || 0, ht = p.h || 0, kids = [];
    if (kind === 'membrane') {
      kids.push(h('rect', { key: 'b', className: 'sd-mem-band', x: x, y: y, width: w, height: ht }));
      var horiz = w >= ht, heads = [];
      if (horiz) for (var i = x + 4; i < x + w - 2; i += 8.5) { heads.push(h('circle', { key: 'a' + i, cx: i, cy: y + 3.4, r: 3.1 })); heads.push(h('circle', { key: 'b' + i, cx: i, cy: y + ht - 3.4, r: 3.1 })); }
      else for (var j = y + 4; j < y + ht - 2; j += 8.5) { heads.push(h('circle', { key: 'a' + j, cx: x + 3.4, cy: j, r: 3.1 })); heads.push(h('circle', { key: 'b' + j, cx: x + w - 3.4, cy: j, r: 3.1 })); }
      kids.push(h('g', { key: 'h', className: 'sd-mem-head' }, heads));
      if (p.label) kids.push(horiz ? h('text', { key: 't', x: x + w, y: y - 10, textAnchor: 'end' }, p.label) : h('text', { key: 't', x: x + w / 2, y: y + ht + 16, textAnchor: 'middle' }, p.label));
    } else if (kind === 'compartment') {
      kids.push(h('rect', { key: 'o', className: 'sd-outline', x: x, y: y, width: w, height: ht, rx: 22 }));
      if (p.double) kids.push(h('rect', { key: 'i', className: 'sd-outline', x: x + 5, y: y + 5, width: w - 10, height: ht - 10, rx: 18 }));
      if (p.label) kids.push(h('text', { key: 't', x: x + 20, y: y + 24 }, p.label));
    } else if (p.label) kids.push(h('text', { key: 't', x: x, y: y + 8 }, p.label));
    return h('g', { className: 'sd-comp sd-comp-' + kind }, kids, p.children);
  }

  /* ================= Callout, ScaleBar ================= */
  function Callout(p) {
    var at = p.at, to = p.to, anchor = p.anchor || (to[0] >= at[0] ? 'start' : 'end');
    var tx = to[0] + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0), lines = String(p.text || '').split('\n');
    return h('g', { className: 'sd-callout' }, h('line', { x1: at[0], y1: at[1], x2: to[0], y2: to[1] }), h('circle', { cx: at[0], cy: at[1], r: 2.5 }),
      lines.map(function (t, i) { return h(ChemText, { key: i, x: tx, y: to[1] + i * 15, textAnchor: anchor, dominantBaseline: 'central' }, t); }));
  }
  function ScaleBar(p) {
    var len = p.length || 80;
    return h('g', { className: 'sd-scale' }, h('rect', { x: p.x, y: p.y, width: len, height: 3 }), h('text', { x: p.x + len / 2, y: p.y + 17 }, p.label || ''));
  }

  /* ================= GradientBar ================= */
  var PALETTES = {
    ph: [[0, '#d7191c'], [0.14, '#f46d43'], [0.28, '#fdae61'], [0.42, '#e6e65a'], [0.5, '#5cb85c'], [0.64, '#26a69a'], [0.8, '#3f51b5'], [1, '#6a1b9a']],
    diverge: [[0, '#b2182b'], [0.25, '#ef8a62'], [0.5, '#e6e6e6'], [0.75, '#67a9cf'], [1, '#2166ac']],
    rg: [[0, '#d73027'], [0.5, '#fee08b'], [1, '#1a9850']],
    temp: [[0, '#313695'], [0.35, '#74add1'], [0.5, '#f7f7f7'], [0.7, '#f46d43'], [1, '#a50026']],
    spectrum: [[0, '#61008a'], [0.108, '#6a00ff'], [0.189, '#0050ff'], [0.297, '#00d5ff'], [0.378, '#1fff00'], [0.5, '#e1ff00'], [0.568, '#ffbe00'], [0.649, '#ff3900'], [0.865, '#d10000'], [1, '#610000']],
    viridis: [[0, '#440154'], [0.25, '#3b528b'], [0.5, '#21918c'], [0.75, '#5ec962'], [1, '#fde725']],
    steel: [[0, '#e8eef5'], [1, '#1f3a56']],
    grey: [[0, '#ffffff'], [1, '#1d1f20']]
  };
  function hex2rgb(x) { x = String(x).replace('#', ''); if (x.length === 3) x = x.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(x, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function colorAt(stops, t) {
    var s = stops.slice().sort(function (a, b) { return a[0] - b[0]; });
    if (t <= s[0][0]) return s[0][1]; if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
    for (var i = 1; i < s.length; i++) if (t <= s[i][0]) {
      var a = hex2rgb(s[i - 1][1]), b = hex2rgb(s[i][1]), f = (t - s[i - 1][0]) / ((s[i][0] - s[i - 1][0]) || 1);
      return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); }).join(',') + ')';
    }
    return s[s.length - 1][1];
  }
  function fmtV(v) { var r = Math.round(v * 1e6) / 1e6; if (Object.is(r, -0)) r = 0; return String(r).replace('-', '−'); }

  function GradientBar(p) {
    var H = (p.orient || 'h') === 'h', L = p.length || 800, T = p.lineOnly ? (p.lineWidth || 5) : (p.thickness || 28), fs = p.fontSize || 14, edge = T / 2;
    var X = p.x || 0, Y = p.y || 0, flip = !!p.flip, out = [], key = 0;
    var stops = p.stops || PALETTES[p.palette || 'steel'] || PALETTES.steel;
    var scales = (p.scales || []).map(function (s) { return Object.assign({ side: 'b', format: 'number', from: 0, to: 100, step: 10, minor: 0, labels: '', titlePos: 'start', name: '' }, s); });
    var dom = p.domain || (scales[0] ? [scales[0].from, scales[0].to] : [0, 100]);
    function pu(v) { return (v - dom[0]) / ((dom[1] - dom[0]) || 1) * L; }
    function pt(u, v) { var uu = flip ? L - u : u; return H ? [X + uu, Y + v] : [X + v, Y + L - uu]; }
    function K() { return 'k' + (key++); }
    function line(u1, v1, u2, v2, cls) { var a = pt(u1, v1), b = pt(u2, v2); out.push(h('line', { key: K(), className: cls, x1: a[0], y1: a[1], x2: b[0], y2: b[1] })); }
    /* text placed outward from the bar on a side (-1 = a, +1 = b), off = distance beyond the bar edge */
    function text(u, off, side, str, cls, size, weight) {
      var q = pt(u, side * (edge + off)), attrs = { key: K(), className: cls, style: { fontSize: size + 'px', fontWeight: weight || undefined } };
      if (H) { attrs.x = q[0]; attrs.y = side < 0 ? q[1] - size * 0.22 : q[1] + size * 0.78; attrs.textAnchor = 'middle'; }
      else { attrs.x = q[0] + side * 2; attrs.y = q[1] + size * 0.34; attrs.textAnchor = side < 0 ? 'end' : 'start'; }
      out.push(h(ChemText, attrs, str));
    }
    var ext = { a: 0, b: 0 };

    /* the bar */
    var a0 = pt(0, -edge), a1 = pt(L, edge), rx = Math.min(a0[0], a1[0]), ry = Math.min(a0[1], a1[1]), rw = Math.abs(a1[0] - a0[0]), rh = Math.abs(a1[1] - a0[1]);
    if (p.bands) {
      for (var i = 0; i < p.bands; i++) {
        var b0 = pt(i * L / p.bands, -edge), b1 = pt((i + 1) * L / p.bands, edge);
        out.push(h('rect', { key: K(), x: Math.min(b0[0], b1[0]), y: Math.min(b0[1], b1[1]), width: Math.abs(b1[0] - b0[0]) + 0.5, height: Math.abs(b1[1] - b0[1]) + 0.5, fill: colorAt(stops, (i + 0.5) / p.bands) }));
      }
      if (p.dividers) for (var j = 1; j < p.bands; j++) line(j * L / p.bands, -edge, j * L / p.bands, edge, 'sd-gb-div');
    } else {
      var id = 'sd-grad-' + (++gid), g0 = pt(0, 0), g1 = pt(L, 0);
      out.push(h('defs', { key: K() }, h('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1] },
        stops.map(function (s, k) { return h('stop', { key: k, offset: s[0], style: { stopColor: p.palette && !p.stops ? 'var(--grad-' + p.palette + '-' + (k + 1) + ', ' + s[1] + ')' : s[1] } }); }))));
      out.push(h('rect', { key: K(), x: rx, y: ry, width: rw, height: rh, rx: p.lineOnly ? T / 2 : undefined, fill: 'url(#' + id + ')' }));
    }
    if (p.outline) out.push(h('rect', { key: K(), className: 'sd-gb-outline', x: rx, y: ry, width: rw, height: rh }));

    var tl = 10, gap = 4, row = fs * 1.3;
    ['a', 'b'].forEach(function (sk) {
      var side = sk === 'a' ? -1 : 1, o = 0;
      /* scales */
      scales.filter(function (s) { return s.side === sk; }).forEach(function (s) {
        var span = s.to - s.from; if (!span || !s.step) return;
        var dir = span > 0 ? 1 : -1, v0 = s.start != null && s.format !== 'named' ? s.start : s.from, n = Math.floor(Math.abs(s.to - v0) / s.step + 1e-9), uOf = function (v) { return s.shift != null ? pu(v - s.shift) : (v - s.from) / span * L; };
        var names = s.format === 'named' ? String(s.labels).split('\n') : null;
        for (var m = 0; m <= n; m++) {
          var v = v0 + dir * s.step * m, u = uOf(v);
          line(u, side * (edge + o), u, side * (edge + o + tl), 'sd-tick sd-tick-maj');
          if (s.minor && m < n) for (var q = 1; q <= s.minor; q++) { var um = uOf(v + dir * s.step * q / (s.minor + 1)); line(um, side * (edge + o), um, side * (edge + o + tl * 0.55), 'sd-tick'); }
          if (names) { if (m < n && names[m]) text(uOf(v + dir * s.step / 2), o + tl + gap, side, names[m], '', fs); }
          else text(u, o + tl + gap, side, s.format === 'power' ? '10^{' + fmtV(v) + '}' : fmtV(v), '', fs);
        }
        var used = tl + gap + row;
        if (s.name && s.titlePos === 'start') {
          var first = s.format === 'power' ? 4 : fmtV(s.from).length;
          if (H) { var q0 = pt(-(gap + 6 + first * fs * 0.29), side * (edge + o + tl + gap + row / 2)); out.push(h(ChemText, { key: K(), className: 'sd-gb-name', x: q0[0], y: q0[1] + fs * 0.34, textAnchor: 'end', style: { fontSize: fs + 'px' } }, s.name)); }
          else text(-fs * 1.4, o, side, s.name, 'sd-gb-name', fs);
        } else if (s.name && s.titlePos === 'center') { text(L / 2, o + used + 2, side, s.name, 'sd-gb-name', fs); used += row + 2; }
        o += used + 8;
      });
      /* zones */
      var zs = (p.zones || []).filter(function (z) { return (z.side || 'b') === sk; });
      if (zs.length) {
        zs.forEach(function (z) {
          var u1 = pu(z.from), u2 = pu(z.to), c = o + 8;
          line(u1 + 1, side * (edge + c), u2 - 1, side * (edge + c), 'sd-tick');
          if (z.style !== 'line') { line(u1 + 1, side * (edge + c - 6), u1 + 1, side * (edge + c), 'sd-tick'); line(u2 - 1, side * (edge + c - 6), u2 - 1, side * (edge + c), 'sd-tick'); }
          text((u1 + u2) / 2, c + gap, side, z.label, '', fs);
        });
        o += 8 + gap + row + 8;
      }
      /* range arrows */
      var ars = (p.arrows || []).filter(function (r) { return (r.side || 'b') === sk; });
      if (ars.length) {
        ars.forEach(function (r) {
          var u1 = pu(r.from), u2 = pu(r.to), c = o + 8, bold = r.style === 'bold', hl = bold ? 12 : 9, hw = bold ? 5.5 : 4, dirn = u2 > u1 ? 1 : -1;
          line(u1, side * (edge + c), u2 - dirn * hl * 0.6, side * (edge + c), 'sd-gb-line' + (bold ? ' sd-gb-bold' : ''));
          var t0 = pt(u2, side * (edge + c)), t1 = pt(u2 - dirn * hl, side * (edge + c) - hw), t2 = pt(u2 - dirn * hl, side * (edge + c) + hw);
          out.push(h('polygon', { key: K(), className: 'sd-gb-head', points: [t0, t1, t2].map(function (q) { return q.join(','); }).join(' ') }));
          text((u1 + u2) / 2, c + hw + gap, side, r.label, '', fs, bold ? 600 : undefined);
        });
        o += 8 + 6 + gap + row + 8;
      }
      /* items: staggered levels so labels never collide */
      var its = (p.items || []).filter(function (it) { return (it.side || 'a') === sk; }).map(function (it) { return Object.assign({ u: pu(it.value) }, it); }).sort(function (x, y) { return x.u - y.u; });
      if (its.length) {
        /* level choice: no label overlap on a level, no leader line through a label */
        var placed = [], lvH = row + 4, maxLv = 0;
        its.forEach(function (it) {
          var half = H ? plain(it.label).length * fs * 0.29 + 6 : fs * 0.75, a1 = it.u - half, a2 = it.u + half, best = 0, bestScore = 1e9;
          for (var lv = 0; lv < 9; lv++) {
            var score = 0;
            placed.forEach(function (q) {
              if (q.lv === lv && q.a2 > a1 && q.a1 < a2) score += 100;
              if (q.lv < lv && it.u > q.a1 && it.u < q.a2) score += 10;
              if (q.lv > lv && q.u > a1 && q.u < a2) score += 10;
            });
            score += lv * 0.5;
            if (score < bestScore) { bestScore = score; best = lv; }
          }
          it.lv = best; maxLv = Math.max(maxLv, best);
          placed.push({ lv: best, a1: a1, a2: a2, u: it.u });
        });
        var levels = { length: maxLv + 1 };
        var labels = [];
        its.forEach(function (it) {
          var reach = o + 10 + it.lv * lvH;
          if (it.marker === 'arrow') {
            var t0 = pt(it.u, side * edge), t1 = pt(it.u - 5, side * (edge + 9)), t2 = pt(it.u + 5, side * (edge + 9));
            out.push(h('polygon', { key: K(), className: 'sd-gb-head', points: [t0, t1, t2].map(function (q) { return q.join(','); }).join(' ') }));
            if (reach > 9) line(it.u, side * (edge + 9), it.u, side * (edge + reach), 'sd-tick');
          } else {
            line(it.u, side * edge, it.u, side * (edge + reach), 'sd-tick');
            var d0 = pt(it.u, side * edge); out.push(h('circle', { key: K(), className: 'sd-gb-dot', cx: d0[0], cy: d0[1], r: 2.2 }));
          }
          labels.push([it.u, reach + gap, it.label]);
        });
        labels.forEach(function (l) { text(l[0], l[1], side, l[2], 'sd-gb-item', fs); });
        o += 10 + levels.length * lvH + gap + 4;
      }
      ext[sk] = o;
    });

    /* end labels */
    [[p.startLabel, 0], [p.endLabel, 1]].forEach(function (e) {
      if (!e[0]) return;
      var u = e[1] ? L : 0, sgn = e[1] ? 1 : -1, f2 = fs * 1.1;
      if (H) { var q = pt(u + sgn * (flip ? -1 : 1) * 14, 0); out.push(h(ChemText, { key: K(), className: 'sd-gb-end', x: q[0], y: q[1] + f2 * 0.34, textAnchor: (sgn * (flip ? -1 : 1)) > 0 ? 'start' : 'end', style: { fontSize: f2 + 'px' } }, e[0])); }
      else { var q2 = pt(u + sgn * (flip ? -1 : 1) * (f2 * 1.2), 0); out.push(h(ChemText, { key: K(), className: 'sd-gb-end', x: q2[0], y: q2[1] + f2 * 0.34, textAnchor: 'middle', style: { fontSize: f2 + 'px' } }, e[0])); }
    });
    /* title block */
    if (p.title || p.subtitle) {
      var cx = H ? X + L / 2 : X, ty = H ? Y - edge - ext.a - 18 : Y - (p.endLabel || p.startLabel ? fs * 2.6 : 0) - 18;
      if (p.subtitle) { out.push(h(ChemText, { key: K(), className: 'sd-gb-subtitle', x: cx, y: ty, textAnchor: 'middle', style: { fontSize: fs * 1.05 + 'px' } }, p.subtitle)); ty -= fs * 1.05 * 1.3 + 4; }
      if (p.title) out.push(h(ChemText, { key: K(), className: 'sd-gb-title', x: cx, y: ty, textAnchor: 'middle', style: { fontSize: fs * 2 + 'px' } }, p.title));
    }
    return h('g', { className: 'sd-gbar' }, out);
  }

  /* ================= SystemWheel (System Thinking Circle) ================= */
  var WHEEL_EDGES = [['process', 'Association / pathway'], ['uncertain', 'Uncertain link'], ['label', 'Label / indicates'], ['inhibit', 'Inhibits'], ['moderate', 'Moderates (interaction)']];
  var WHEEL_ROLES = { exposure: { label: 'Exposure', dash: null }, outcome: { label: 'Outcome', dash: null, double: true }, confounder: { label: 'Confounder', dash: 'var(--dash-confounder)' }, mediator: { label: 'Mediator', dash: 'var(--dash-mediator)' }, moderator: { label: 'Moderator', dash: 'var(--dash-moderator)' } };
  function sigMark(e) {
    if (e.sig === 'none') return '';
    var v = e.sig;
    if (!v && e.p != null && e.p !== '') { var pv = parseFloat(String(e.p).replace(/^[<>=≤≥\s]+/, '')); if (!isNaN(pv)) v = /^\s*[>≥]/.test(e.p) ? 'ns' : pv < 0.005 ? '***' : pv <= 0.01 ? '**' : pv <= 0.05 ? '*' : 'ns'; }
    return v === '***' ? '***' : v === '**' ? '**' : v === '*' ? '*' : v === 'ns' ? 'n.s.' : '';
  }
  function wrapWords(text, maxChars, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (t.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines || 3);
  }
  /* clockwise numbering from 12 o'clock, shared by the wheel and the codebook */
  function wheelNumbers(list) {
    var nodes = (list || []).map(function (n, i, a) { return Object.assign({ angle: -Math.PI / 2 + i * 2 * Math.PI / a.length }, n); });
    var f = function (x) { return ((x + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); }, num = {};
    nodes.slice().sort(function (a, b) { return f(a.angle) - f(b.angle); }).forEach(function (n, i) { num[n.id] = i + 1; });
    return num;
  }
  function SystemWheel(p) {
    var cx = p.cx || 400, cy = p.cy || 300, R = p.r || 200, hubR = p.hubR || R * 0.42, fs = p.fontSize || 12.5, ts = p.titleSize || 21;
    var nodes = (p.nodes || []).map(function (n, i, a) { return Object.assign({ radius: 15, angle: -Math.PI / 2 + i * 2 * Math.PI / a.length }, n); });
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
    function pos(n) { return { x: cx + Math.cos(n.angle) * R, y: cy + Math.sin(n.angle) * R }; }
    var num = wheelNumbers(nodes);
    var out = [], labels = [], k = 0;
    function K() { return 'w' + (k++); }
    if (p.guideRing !== false) {
      out.push(h('circle', { key: K(), className: 'sd-wh-ring', cx: cx, cy: cy, r: R }));
      for (var t = 0; t < 12; t++) { var a = t * Math.PI / 6; out.push(h('line', { key: K(), className: 'sd-wh-ring', x1: cx + Math.cos(a) * (R - 5), y1: cy + Math.sin(a) * (R - 5), x2: cx + Math.cos(a) * (R + 5), y2: cy + Math.sin(a) * (R + 5) })); }
    }
    out.push(h('circle', { key: K(), className: 'sd-wh-hub', cx: cx, cy: cy, r: hubR }));
    var tl = wrapWords(p.title || 'Untitled system', Math.max(6, Math.floor(hubR * 1.7 / (ts * 0.48))), 5), lh = ts * 1.1;
    out.push(h('text', { key: K(), className: 'sd-wh-title', x: cx, y: cy - (tl.length - 1) * lh / 2, style: { fontSize: ts + 'px' } }, tl.map(function (ln, i) { return h('tspan', { key: i, x: cx, dy: i ? lh : 0 }, ln); })));
    /* relationships */
    (p.edges || []).forEach(function (e) {
      var A = byId[e.from], B = byId[e.to]; if (!A || !B || A === B) return;
      var pa = pos(A), pb = pos(B), dx = pb.x - pa.x, dy = pb.y - pa.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist, px = -uy, py = ux;
      var s = { x: pa.x + ux * (A.radius + 3), y: pa.y + uy * (A.radius + 3) }, en = { x: pb.x - ux * (B.radius + 3), y: pb.y - uy * (B.radius + 3) };
      var mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, amt = Math.max(14, Math.min(dist * 0.16, 56));
      var bend = e.bend != null ? e.bend * dist : amt * ((px * (mid.x - cx) + py * (mid.y - cy)) >= 0 ? 1 : -1);
      var c = { x: mid.x + px * bend, y: mid.y + py * bend };
      var tx = en.x - c.x, ty = en.y - c.y, tln = Math.hypot(tx, ty) || 1; tx /= tln; ty /= tln;
      var w = e.width || 2, color = e.color || 'var(--wheel-edge)', type = e.type || 'process', ang = Math.atan2(ty, tx) * 180 / Math.PI;
      var hs = 7.5 + w, endPt = en;
      if (type === 'process' || type === 'uncertain') endPt = { x: en.x - tx * hs * 0.74, y: en.y - ty * hs * 0.74 };
      if (type === 'moderate') endPt = { x: en.x - tx * (5 + w * 0.6) * 2, y: en.y - ty * (5 + w * 0.6) * 2 };
      out.push(h('path', { key: K(), className: 'sd-wh-edge sd-wh-' + type, d: 'M' + s.x + ',' + s.y + ' Q' + c.x + ',' + c.y + ' ' + endPt.x + ',' + endPt.y, style: { stroke: color, strokeWidth: w } }));
      var tr = 'translate(' + en.x + ',' + en.y + ') rotate(' + ang + ')';
      if (type === 'process' || type === 'uncertain') out.push(h('path', { key: K(), transform: tr, d: 'M0,0 L' + (-hs) + ',' + hs * 0.5 + ' L' + (-hs * 0.74) + ',0 L' + (-hs) + ',' + (-hs * 0.5) + ' z', style: { fill: color } }));
      else if (type === 'label') out.push(h('circle', { key: K(), cx: en.x, cy: en.y, r: 3.2 + w * 0.4, style: { fill: color } }));
      else if (type === 'inhibit') out.push(h('line', { key: K(), transform: tr, x1: 0, y1: -(7 + w), x2: 0, y2: 7 + w, style: { stroke: color, strokeWidth: w } }));
      else if (type === 'moderate') { var z = 5 + w * 0.6; out.push(h('path', { key: K(), transform: tr, d: 'M0,0 L' + (-z) + ',' + (-z * 0.75) + ' L' + (-2 * z) + ',0 L' + (-z) + ',' + (z * 0.75) + ' z', style: { fill: color } })); }
      var text = [String(e.name || '').replace(/\bconfound(s|ed|ing)?\b/ig, 'Δ'), sigMark(e)].filter(Boolean).join(' ');
      if (text) {
        /* slide the label along the curve until it clears every factor dot */
        var m = null, tw = text.length * 3.2;
        [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75].some(function (t) {
          var mt = 1 - t, q = { x: mt * mt * s.x + 2 * mt * t * c.x + t * t * en.x, y: mt * mt * s.y + 2 * mt * t * c.y + t * t * en.y };
          var clear = Math.hypot(q.x - cx, q.y - cy) > hubR + 10 && nodes.every(function (nn) { var np = pos(nn); return Math.abs(np.x - q.x) > tw + nn.radius + 4 || Math.abs(np.y - q.y) > nn.radius + 12; });
          if (clear) { m = q; return true; } return false;
        }) || (m = { x: 0.25 * s.x + 0.5 * c.x + 0.25 * en.x + px * (bend >= 0 ? 1 : -1) * 18, y: 0.25 * s.y + 0.5 * c.y + 0.25 * en.y + py * (bend >= 0 ? 1 : -1) * 18 }); labels.push(h('text', { key: K(), className: 'sd-wh-elabel', x: m.x + (e.ldx || 0), y: m.y + (e.ldy || 0) }, text)); }
    });
    /* factors */
    nodes.forEach(function (n) {
      var q = pos(n), role = WHEEL_ROLES[n.role];
      out.push(h('circle', { key: K(), className: 'sd-wh-node', cx: q.x, cy: q.y, r: n.radius, style: { fill: n.color || 'var(--wheel-sat-6)' } }));
      if (role) {
        out.push(h('circle', { key: K(), className: 'sd-wh-role', cx: q.x, cy: q.y, r: n.radius + 4, style: { strokeDasharray: role.dash || undefined } }));
        if (role.double) out.push(h('circle', { key: K(), className: 'sd-wh-role', cx: q.x, cy: q.y, r: n.radius + 7 }));
      }
      if (p.numbers) out.push(h('text', { key: K(), className: 'sd-wh-num', x: q.x, y: q.y }, num[n.id]));
      var mode = p.labels || 'Description', code = n.code || '', name = n.name || '';
      var lab = mode === 'Code' ? (code || name) : mode === 'Both' && code && name ? code + ' · ' + name : (name || code);
      var ca = Math.cos(n.angle), sa = Math.sin(n.angle), d0 = n.radius + (role ? 12 : 8);
      var lx = q.x + ca * d0, ly = q.y + sa * d0, anchor = ca > 0.3 ? 'start' : ca < -0.3 ? 'end' : 'middle';
      var lines = wrapWords(lab, p.labelChars || 22), llh = fs * 1.2;
      var y0 = sa > 0.3 ? ly + fs * 0.8 : sa < -0.3 ? ly - (lines.length - 1) * llh - fs * 0.2 : ly - (lines.length - 1) * llh / 2 + fs * 0.35;
      labels.push(h('text', { key: K(), className: 'sd-wh-flabel', x: lx, y: y0, textAnchor: anchor, style: { fontSize: fs + 'px' } }, lines.map(function (ln, i) { return h('tspan', { key: i, x: lx, dy: i ? llh : 0 }, ln); })));
    });
    return h('g', { className: 'sd-wheel' }, out, labels);
  }

  /* ================= Codebook ================= */
  function Codebook(p) {
    var num = wheelNumbers(p.nodes), nodes = (p.nodes || []).slice().sort(function (a, b) { return num[a.id] - num[b.id]; });
    return h('div', { className: 'sd-codebook' },
      p.title === false ? null : h('div', { className: 'sd-cb-title' }, p.title || 'Codebook & colour key'),
      h('table', null,
        h('thead', null, h('tr', null, ['#', 'Code', 'Role', 'Factor', 'Values'].map(function (c) { return h('th', { key: c }, c); }))),
        h('tbody', null, nodes.map(function (n, i) {
          var role = WHEEL_ROLES[n.role];
          return h('tr', { key: n.id || i },
            h('td', { className: 'sd-cb-num' }, h('span', { className: 'sd-cb-dot', style: { background: n.color || 'var(--wheel-sat-6)' } }), num[n.id]),
            h('td', { className: 'sd-cb-code' }, n.code || ''),
            h('td', null, role ? role.label : ''),
            h('td', null, n.name || '', n.units ? h('span', { className: 'sd-cb-units' }, ' (' + n.units + ')') : null),
            h('td', null, (n.values || []).map(function (v, j) { return h('span', { key: j, className: 'sd-cb-val' }, v.v + ' = ' + v.label); })));
        }))),
      p.legend ? h('ul', { className: 'sd-cb-key' }, p.legend.filter(function (l) { return l.label; }).map(function (l, i) { return h('li', { key: i }, h('span', { className: 'sd-cb-dot', style: { background: l.color } }), l.label); })) : null,
      p.note === false ? null : h('p', { className: 'sd-cb-note' }, p.note || '* p < 0.05 · ** p < 0.01 · *** p < 0.005 · n.s. p > 0.05 · Δ confounds'));
  }

  /* ================= shared helpers for the editor figures ================= */
  function notch(x, y, ang, size, cls, style, key) {
    return h('path', { key: key, className: cls, style: style, transform: 'translate(' + x + ',' + y + ') rotate(' + (ang * 180 / Math.PI) + ')',
      d: 'M0,0 L' + (-size) + ',' + (size * 0.5) + ' L' + (-size * 0.7) + ',0 L' + (-size) + ',' + (-size * 0.5) + ' z' });
  }
  function regMarks(x, y, w, ht, k, cls, key) {
    var d = [[x, y], [x + w, y], [x, y + ht], [x + w, y + ht]].map(function (p) { return 'M' + (p[0] - k) + ',' + p[1] + 'h' + (2 * k) + 'M' + p[0] + ',' + (p[1] - k) + 'v' + (2 * k); }).join('');
    return h('path', { key: key, className: cls || 'sd-reg', d: d });
  }
  function textLines(lines, x, y, lh, attrs, key) {
    return h('text', Object.assign({ key: key, x: x, y: y }, attrs), lines.map(function (ln, i) { return h('tspan', { key: i, x: x, dy: i ? lh : 0 }, ln); }));
  }
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  /* ================= PhyloTree (02) ================= */
  /* ICS 2023 chart: [level, name, abbreviation, start Ma, end Ma]; colours are the geo-* tokens */
  var GEO_DARK = ['archean', 'hadean', 'triassic', 'early-triassic', 'eoarchean'];
  var GEO_TIME = [
    ['eon','Phanerozoic','Ph',538.8,0],
    ['eon','Proterozoic','Pt',2500,538.8],
    ['eon','Archean','A',4031,2500],
    ['eon','Hadean','H',4567,4031],
    ['era','Cenozoic','Cz',66,0],
    ['era','Mesozoic','Mz',251.902,66],
    ['era','Paleozoic','Pz',538.8,251.902],
    ['era','Neoproterozoic','NP',1000,538.8],
    ['period','Quaternary','Q',2.58,0],
    ['period','Neogene','N',23.03,2.58],
    ['period','Paleogene','Pg',66,23.03],
    ['period','Cretaceous','K',145,66],
    ['period','Jurassic','J',201.4,145],
    ['period','Triassic','T',251.902,201.4],
    ['period','Permian','P',298.9,251.902],
    ['period','Carboniferous','C',358.9,298.9],
    ['period','Devonian','D',419.2,358.9],
    ['period','Silurian','S',443.8,419.2],
    ['period','Ordovician','O',485.4,443.8],
    ['period','Cambrian','Cm',538.8,485.4],
    ['period','Ediacaran','Ed',635,538.8],
    ['period','Cryogenian','Cr',720,635],
    ['period','Tonian','To',1000,720],
    ['epoch','Holocene','H',0.0117,0],
    ['epoch','Pleistocene','Ple',2.58,0.0117],
    ['epoch','Pliocene','Pli',5.333,2.58],
    ['epoch','Miocene','Mio',23.03,5.333],
    ['epoch','Oligocene','Oli',33.9,23.03],
    ['epoch','Eocene','Eoc',56,33.9],
    ['epoch','Paleocene','Pal',66,56],
    ['epoch','Late Cretaceous','K2',100.5,66],
    ['epoch','Early Cretaceous','K1',145,100.5],
    ['epoch','Late Jurassic','J3',161.5,145],
    ['epoch','Middle Jurassic','J2',174.7,161.5],
    ['epoch','Early Jurassic','J1',201.4,174.7],
    ['epoch','Late Triassic','T3',237,201.4],
    ['epoch','Middle Triassic','T2',247.2,237],
    ['epoch','Early Triassic','T1',251.902,247.2],
    ['era','Mesoproterozoic','MP',1600,1000],
    ['era','Paleoproterozoic','PP',2500,1600],
    ['era','Neoarchean','NA',2800,2500],
    ['era','Mesoarchean','MA',3200,2800],
    ['era','Paleoarchean','PA',3600,3200],
    ['era','Eoarchean','EA',4031,3600],
    ['period','Stenian','Sn',1200,1000],
    ['period','Ectasian','Ec',1400,1200],
    ['period','Calymmian','Cy',1600,1400],
    ['period','Statherian','St',1800,1600],
    ['period','Orosirian','Or',2050,1800],
    ['period','Rhyacian','Rh',2300,2050],
    ['period','Siderian','Sd',2500,2300],
    ['epoch','Lopingian','P3',259.51,251.902],
    ['epoch','Guadalupian','P2',274.4,259.51],
    ['epoch','Cisuralian','P1',298.9,274.4],
    ['epoch','Pennsylvanian','C2',323.4,298.9],
    ['epoch','Mississippian','C1',358.9,323.4],
    ['epoch','Late Devonian','D3',382.7,358.9],
    ['epoch','Middle Devonian','D2',393.3,382.7],
    ['epoch','Early Devonian','D1',419.2,393.3],
    ['epoch','Pridoli','S4',423.0,419.2],
    ['epoch','Ludlow','S3',427.4,423.0],
    ['epoch','Wenlock','S2',433.4,427.4],
    ['epoch','Llandovery','S1',443.8,433.4],
    ['epoch','Late Ordovician','O3',458.2,443.8],
    ['epoch','Middle Ordovician','O2',471.3,458.2],
    ['epoch','Early Ordovician','O1',485.4,471.3],
    ['epoch','Furongian','Cm4',497,485.4],
    ['epoch','Miaolingian','Cm3',506.5,497],
    ['epoch','Series 2','Cm2',521,506.5],
    ['epoch','Terreneuvian','Cm1',538.8,521]
  ];
  function parseNewick(src) {
    var s = String(src || '').trim().replace(/;$/, ''), i = 0;
    function node() {
      var n = { children: [] };
      if (s[i] === '(') {
        i++;
        n.children.push(node());
        while (s[i] === ',') { i++; n.children.push(node()); }
        if (s[i] === ')') i++;
      }
      var lab = '';
      while (i < s.length && ':,()'.indexOf(s[i]) < 0) lab += s[i++];
      if (n.children.length) { if (lab) n.support = lab; } else n.name = lab.replace(/_/g, ' ');
      if (s[i] === ':') { i++; var num = ''; while (i < s.length && ',()'.indexOf(s[i]) < 0) num += s[i++]; n.len = parseFloat(num) || 0; }
      return n;
    }
    return node();
  }
  function PhyloTree(p) {
    var root = typeof p.tree === 'string' || p.newick ? parseNewick(p.newick || p.tree) : p.tree;
    var layout = p.timescale ? 'phylo' : (p.layout || 'rect'), X = p.x || 0, Y = p.y || 0, W = p.w || 520, rowGap = p.rowGap || 26, fs = p.fontSize || 13;
    var tips = [], maxDepth = 0, maxLen = 0;
    (function walk(n, depth, dist) {
      n._depth = depth; n._dist = dist; maxDepth = Math.max(maxDepth, depth); maxLen = Math.max(maxLen, dist);
      if (!n.children.length) { n._row = tips.length; tips.push(n); }
      n.children.forEach(function (c) { walk(c, depth + 1, dist + (c.len || 0)); });
    })(root, 0, 0);
    (function rows(n) { if (n.children.length) { n.children.forEach(rows); n._row = (n.children[0]._row + n.children[n.children.length - 1]._row) / 2; } })(root);
    var labelW = p.labelWidth || 150, treeW = W - labelW;
    (function xs(n) {
      if (layout === 'phylo') n._x = X + (maxLen ? n._dist / maxLen : 0) * treeW;
      else n._x = X + (n.children.length ? (n._depth / maxDepth) * treeW * 0.999 : treeW);
      n._y = Y + n._row * rowGap;
      n.children.forEach(xs);
    })(root);
    if (layout !== 'phylo') (function fixTips() { tips.forEach(function (t) { t._x = X + treeW; }); })();
    var out = [], k = 0, K = function () { return 'p' + (k++); };
    var cladeOf = function (n) { var ts = []; (function w(m) { if (!m.children.length) ts.push(m.name); m.children.forEach(w); })(n); return ts; };
    /* clade bands, drawn first */
    (p.clades || []).forEach(function (c, ci) {
      var target = null;
      (function find(n) { if (target) return; var ts = cladeOf(n); if (c.tips.every(function (t) { return ts.indexOf(t) >= 0; }) && ts.length === c.tips.length) target = n; else n.children.forEach(find); })(root);
      if (!target) return;
      var ts = cladeOf(target).map(function (nm) { return tips.filter(function (t) { return t.name === nm; })[0]; });
      var y0 = Math.min.apply(null, ts.map(function (t) { return t._y; })), y1 = Math.max.apply(null, ts.map(function (t) { return t._y; }));
      var bx0 = target._x - 3, bx1 = X + W + 6;
      out.push(h('rect', { key: K(), className: 'sd-ph-band', x: bx0, y: y0 - rowGap * 0.42, width: bx1 - bx0, height: (y1 - y0) + rowGap * 0.84, style: { fill: c.color || 'var(--wheel-sat-' + (ci + 1) + ')' } }));
      if (c.label) out.push(h('text', { key: K(), className: 'sd-ph-clade', transform: 'translate(' + (bx1 + 12) + ',' + ((y0 + y1) / 2) + ') rotate(-90)', style: { fill: c.color || 'var(--wheel-sat-' + (ci + 1) + ')' } }, c.label));
    });
    /* branches */
    (function br(n) {
      n.children.forEach(function (c) {
        var d = layout === 'slant' ? 'M' + n._x + ',' + n._y + 'L' + c._x + ',' + c._y : 'M' + n._x + ',' + n._y + 'V' + c._y + 'H' + c._x;
        out.push(h('path', { key: K(), className: 'sd-ph-branch', d: d }));
        br(c);
      });
      if (n.children.length && p.showSupport !== false && n.support) out.push(h('text', { key: K(), className: 'sd-ph-support', x: n._x - 3, y: n._y - 4 }, n.support));
    })(root);
    if (layout === 'phylo') out.push(h('path', { key: K(), className: 'sd-ph-branch', d: 'M' + (X - 14) + ',' + root._y + 'H' + root._x }));
    /* tips */
    tips.forEach(function (t) {
      out.push(h('circle', { key: K(), className: 'sd-ph-tip', cx: t._x, cy: t._y, r: 2.4 }));
      if (layout === 'phylo' && t._x < X + treeW - 6) out.push(h('path', { key: K(), className: 'sd-ph-align', d: 'M' + (t._x + 4) + ',' + t._y + 'H' + (X + treeW + 2) }));
      out.push(h('text', { key: K(), className: 'sd-ph-label', x: X + treeW + 8, y: t._y, style: { fontSize: fs + 'px', fontStyle: p.italic === false ? 'normal' : 'italic' } }, t.name));
    });
    /* geological timescale: branch lengths in Ma, youngest tip at tipAge */
    var grid = [];
    if (p.timescale && maxLen) {
      var lv = p.timescale === true ? ['period', 'era'] : [].concat(p.timescale);
      var units = (p.geoUnits || GEO_TIME).map(function (u) { return Array.isArray(u) ? { level: u[0], name: u[1], abbr: u[2], start: u[3], end: u[4] } : u; });
      var tipAge = p.tipAge || 0, rootAge = tipAge + maxLen, ax = function (a) { return X + (rootAge - a) / maxLen * treeW; };
      var gridLv = typeof p.timeGrid === 'string' ? p.timeGrid : (lv.indexOf('period') >= 0 ? 'period' : lv[0]), bh = p.timeRowH || 16, gfs = 10, sy0 = Y + (tips.length - 1) * rowGap + Math.max(14, rowGap * 0.6);
      lv.forEach(function (level, li) {
        var ry = sy0 + li * bh;
        out.push(h('rect', { key: K(), className: 'sd-ph-geo-row', x: X, y: ry, width: treeW, height: bh }));
        units.filter(function (u) { return u.level === level && u.start > tipAge && u.end < rootAge; }).forEach(function (u) {
          var a0 = Math.min(u.start, rootAge), a1 = Math.max(u.end, tipAge), x0 = ax(a0), w = ax(a1) - x0;
          var fill = u.color || 'var(--geo-' + u.name.toLowerCase().replace(/ /g, '-') + ')';
          out.push(h('rect', { key: K(), className: 'sd-ph-geo', x: x0, y: ry, width: w, height: bh, style: { fill: fill } }, h('title', null, u.name + ' (' + u.start + ' to ' + u.end + ' Ma)')));
          var txt = w > u.name.length * gfs * 0.56 + 6 ? u.name : (u.abbr && w > u.abbr.length * gfs * 0.62 + 4 ? u.abbr : '');
          if (txt) out.push(h('text', { key: K(), className: 'sd-ph-geo-label', x: x0 + w / 2, y: ry + bh / 2, style: { fontSize: gfs + 'px', fill: !u.color && GEO_DARK.indexOf(u.name.toLowerCase().replace(/ /g, '-')) >= 0 ? 'var(--geo-text-light)' : (u.textColor || null) } }, txt));
          if (level === gridLv && p.timeGrid !== false && u.start < rootAge) grid.push(h('path', { key: K(), className: 'sd-ph-grid', d: 'M' + x0 + ',' + (Y - rowGap * 0.45) + 'V' + sy0 }));
        });
        out.push(h('text', { key: K(), className: 'sd-ph-geo-level', x: X + treeW + 8, y: ry + bh / 2 }, level === 'custom' ? '' : level.charAt(0).toUpperCase() + level.slice(1)));
      });
      var ay = sy0 + lv.length * bh, st0 = Math.pow(10, Math.floor(Math.log10(maxLen / 4))), st = [1, 2, 5, 10].map(function (m) { return m * st0; }).filter(function (v) { return maxLen / v <= 6; })[0];
      var ticks = 'M' + X + ',' + ay + 'H' + (X + treeW);
      for (var a = Math.ceil(tipAge / st - 1e-9) * st; a <= rootAge + 1e-9; a += st) {
        ticks += 'M' + ax(a) + ',' + ay + 'v5';
        out.push(h('text', { key: K(), className: 'sd-ph-scale', x: ax(a), y: ay + 17 }, String(+a.toFixed(3))));
      }
      out.push(h('path', { key: K(), className: 'sd-ph-branch', d: ticks }));
      out.push(h('text', { key: K(), className: 'sd-ph-geo-level', x: X + treeW + 8, y: ay + 13 }, p.timeUnit || 'Ma'));
    }
    /* scale bar for branch lengths */
    if (layout === 'phylo' && maxLen && !p.timescale) {
      var step = Math.pow(10, Math.floor(Math.log10(maxLen / 3))), sv = [5, 2, 1].map(function (m) { return m * step; }).filter(function (v) { return v <= maxLen / 2.5; })[0] || step;
      var sw = sv / maxLen * treeW, sy = Y + tips.length * rowGap + 4;
      out.push(h('path', { key: K(), className: 'sd-ph-branch', d: 'M' + X + ',' + sy + 'h' + sw + 'M' + X + ',' + (sy - 4) + 'v8M' + (X + sw) + ',' + (sy - 4) + 'v8' }));
      out.push(h('text', { key: K(), className: 'sd-ph-scale', x: X + sw / 2, y: sy + 16 }, String(+sv.toPrecision(2)) + (p.unit ? ' ' + p.unit : '')));
    }
    return h('g', { className: 'sd-phylo' }, grid.concat(out));
  }

  /* ================= Flow diagram (03) ================= */
  var FLOW_SHAPES = ['step', 'decision', 'terminal', 'manual-input', 'io', 'subprocess', 'database', 'manual-op', 'document', 'multidocument', 'delay', 'connector', 'alternate', 'merge', 'preparation', 'offpage', 'note'];
  function flowPath(shape, x, y, w, ht) {
    var r, sl;
    switch (shape) {
      case 'decision': return 'M' + (x + w / 2) + ',' + y + 'L' + (x + w) + ',' + (y + ht / 2) + 'L' + (x + w / 2) + ',' + (y + ht) + 'L' + x + ',' + (y + ht / 2) + 'z';
      case 'terminal': r = ht / 2; return 'M' + (x + r) + ',' + y + 'H' + (x + w - r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + w - r) + ',' + (y + ht) + 'H' + (x + r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + r) + ',' + y + 'z';
      case 'io': sl = Math.min(ht * 0.6, w * 0.16); return 'M' + (x + sl) + ',' + y + 'H' + (x + w) + 'L' + (x + w - sl) + ',' + (y + ht) + 'H' + x + 'z';
      case 'connector': return 'M' + x + ',' + (y + ht / 2) + 'a' + (w / 2) + ',' + (ht / 2) + ' 0 1 0 ' + w + ',0a' + (w / 2) + ',' + (ht / 2) + ' 0 1 0 ' + (-w) + ',0z';
      case 'manual-input': sl = Math.min(ht * 0.5, 22); return 'M' + x + ',' + (y + sl) + 'L' + (x + w) + ',' + y + 'V' + (y + ht) + 'H' + x + 'z';
      case 'manual-op': sl = Math.min(w * 0.14, ht * 0.5); return 'M' + x + ',' + y + 'H' + (x + w) + 'L' + (x + w - sl) + ',' + (y + ht) + 'H' + (x + sl) + 'z';
      case 'delay': r = ht / 2; return 'M' + x + ',' + y + 'H' + (x + w - r) + 'A' + r + ',' + r + ' 0 0 1 ' + (x + w - r) + ',' + (y + ht) + 'H' + x + 'z';
      case 'alternate': r = Math.min(16, ht * 0.24); return 'M' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + ht - r) + 'Q' + (x + w) + ',' + (y + ht) + ' ' + (x + w - r) + ',' + (y + ht) + 'H' + (x + r) + 'Q' + x + ',' + (y + ht) + ' ' + x + ',' + (y + ht - r) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'z';
      case 'merge': return 'M' + x + ',' + y + 'H' + (x + w) + 'L' + (x + w / 2) + ',' + (y + ht) + 'z';
      case 'preparation': sl = Math.min(20, w * 0.14); return 'M' + (x + sl) + ',' + y + 'H' + (x + w - sl) + 'L' + (x + w) + ',' + (y + ht / 2) + 'L' + (x + w - sl) + ',' + (y + ht) + 'H' + (x + sl) + 'L' + x + ',' + (y + ht / 2) + 'z';
      case 'offpage': r = Math.min(ht * 0.4, 28); return 'M' + x + ',' + y + 'H' + (x + w) + 'V' + (y + ht - r) + 'L' + (x + w / 2) + ',' + (y + ht) + 'L' + x + ',' + (y + ht - r) + 'z';
      case 'database': r = Math.min(16, ht * 0.2); return 'M' + x + ',' + (y + r) + 'C' + x + ',' + (y - r * 0.6) + ' ' + (x + w) + ',' + (y - r * 0.6) + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + ht - r) + 'C' + (x + w) + ',' + (y + ht + r * 0.6) + ' ' + x + ',' + (y + ht + r * 0.6) + ' ' + x + ',' + (y + ht - r) + 'z';
      case 'document': case 'multidocument': r = Math.min(ht * 0.18, 12); return 'M' + x + ',' + y + 'H' + (x + w) + 'V' + (y + ht - r) + 'C' + (x + w * 0.75) + ',' + (y + ht - r * 3) + ' ' + (x + w * 0.3) + ',' + (y + ht + r * 1.6) + ' ' + x + ',' + (y + ht - r * 0.4) + 'z';
      default: return 'M' + x + ',' + y + 'H' + (x + w) + 'V' + (y + ht) + 'H' + x + 'z';
    }
  }
  function FlowNode(p) {
    var shape = p.shape || 'step', x = p.x, y = p.y, w = p.w || 180, ht = p.h || 52, out = [];
    var style = { stroke: p.color || undefined, strokeWidth: p.border || (p.color ? 1.6 : undefined) };
    if (shape === 'multidocument') [2, 1].forEach(function (k) { out.push(h('path', { key: 'm' + k, className: 'sd-fl-shape sd-fl-back', d: flowPath('document', x - 6 * k, y - 6 * k, w, ht) })); });
    out.push(h('path', { key: 's', className: 'sd-fl-shape' + (shape === 'note' ? ' sd-fl-note' : ''), d: flowPath(shape, x, y, w, ht), style: style }));
    if (shape === 'subprocess') { var bx = Math.min(9, w * 0.08); out.push(h('path', { key: 'sp', className: 'sd-fl-shape', d: 'M' + (x + bx) + ',' + y + 'v' + ht + 'M' + (x + w - bx) + ',' + y + 'v' + ht, style: style })); }
    if (shape === 'database') { var ry = Math.min(16, ht * 0.2); out.push(h('path', { key: 'db', className: 'sd-fl-shape', d: 'M' + x + ',' + (y + ry) + 'C' + x + ',' + (y + ry * 0.4) + ' ' + (x + w) + ',' + (y + ry * 0.4) + ' ' + (x + w) + ',' + (y + ry), style: style })); }
    if (['step', 'subprocess', 'note'].indexOf(shape) >= 0) out.push(regMarks(x, y, w, ht, 4.5, 'sd-reg', 'rm'));
    var lines = String(p.label || '').split('\n'), lh = (p.fontSize || 13) * 1.3;
    out.push(textLines(lines, x + w / 2, y + ht / 2 - (lines.length - 1) * lh / 2, lh, { className: 'sd-fl-label', style: { fontSize: (p.fontSize || 13) + 'px' } }, 't'));
    return h('g', { className: 'sd-flow-node' }, out);
  }
  function FlowArrow(p) {
    var pts = p.points || [p.from, p.to], w = p.width || 1.4, out = [];
    var last = pts[pts.length - 1], prev = pts[pts.length - 2], ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]), hs = 5 + w * 1.4;
    var trimmed = pts.slice(0, -1).concat([[last[0] - Math.cos(ang) * hs * 0.7, last[1] - Math.sin(ang) * hs * 0.7]]);
    out.push(h('path', { key: 'l', className: 'sd-fl-line' + (p.dash === 'dashed' ? ' sd-fl-dashed' : p.dash === 'dotted' ? ' sd-fl-dotted' : ''), d: 'M' + trimmed.map(function (q) { return q.join(','); }).join('L'), style: { strokeWidth: w, stroke: p.color || undefined } }));
    out.push(notch(last[0], last[1], ang, hs, 'sd-fl-head', { fill: p.color || undefined }, 'h'));
    if (p.label) { var a = pts[Math.floor((pts.length - 1) / 2)], b = pts[Math.floor((pts.length - 1) / 2) + 1]; out.push(h('text', { key: 't', className: 'sd-fl-elabel', x: (a[0] + b[0]) / 2 + (p.labelDx || 6), y: (a[1] + b[1]) / 2 + (p.labelDy || 0) }, p.label)); }
    return h('g', { className: 'sd-flow-arrow' }, out);
  }
  function FlowStage(p) {
    var x = p.x, y0 = p.y0, y1 = p.y1, right = p.side === 'right', d = right ? -1 : 1, cap = p.caps === false ? 0 : 5;
    var col = p.color || null, lab = String(p.label || '').toUpperCase(), n = p.number != null ? String(p.number) + '  ' : '';
    return h('g', { className: 'sd-fl-stage' + (p.band ? ' sd-fl-stage-banded' : '') },
      p.band ? h('rect', { className: 'sd-fl-stage-band', x: right ? x - p.band : x, y: y0, width: p.band, height: y1 - y0, style: col ? { fill: col } : null }) : null,
      h('path', { d: 'M' + (x + d * cap) + ',' + y0 + 'H' + x + 'V' + y1 + 'H' + (x + d * cap), style: col ? { stroke: col } : null }),
      h('text', { transform: 'translate(' + (x - d * 9) + ',' + ((y0 + y1) / 2) + ') rotate(' + (right ? 90 : -90) + ')', style: col ? { fill: col } : null }, n + lab));
  }

  /* ================= Product flow diagram (03b, food industry PFD + HACCP) ================= */
  /* block shapes from the PFD convention: process element, input/output, decision; equipment symbols from the food-industry reference */
  var PFD_EQUIP = [
    ['crusher', 'Crushers / Flakers', 'CR / FL'], ['conditioner', 'Conditioner / Cooker', 'H / V'], ['screwpress', 'Screw Press / Expeller', 'EX / ME'],
    ['extractor', 'Solvent Extractor', 'XT'], ['deodoriser', 'Deodoriser Column', 'V'], ['milling', 'Milling Train', 'MX'],
    ['clarifier', 'Clarifier / Settling Tank', 'T / V'], ['evaporator', 'Multi-Effect Evaporator', 'EV'], ['centrifuge', 'Centrifugal Separator', 'C'],
    ['hydrocyclone', 'Germ Hydrocyclone', 'HC'], ['vacuumfilter', 'Rotary Vacuum Filter', 'F']];
  var PFD_KINDS = [['operation', 'Operation'], ['inspection', 'Inspection'], ['combined', 'Operation + inspection'], ['transport', 'Transport'], ['delay', 'Delay / hold'], ['storage', 'Storage']];
  var PFD_HAZ = { B: 'Biological', C: 'Chemical', P: 'Physical', A: 'Allergen' };
  function pfdGlyph(kind, x, y, key) {
    var c = 'sd-pfd-glyph';
    if (kind === 'inspection') return h('rect', { key: key, className: c, x: x - 5.5, y: y - 5.5, width: 11, height: 11 });
    if (kind === 'combined') return h('g', { key: key }, h('rect', { className: c, x: x - 6, y: y - 6, width: 12, height: 12 }), h('circle', { className: c, cx: x, cy: y, r: 3.6 }));
    if (kind === 'transport') return h('path', { key: key, className: c, d: 'M' + (x - 7) + ',' + (y - 2.5) + 'h7v-4l7,6.5l-7,6.5v-4h-7z' });
    if (kind === 'delay') return h('path', { key: key, className: c, d: 'M' + (x - 5) + ',' + (y - 6) + 'h4a6,6 0 0 1 0,12h-4z' });
    if (kind === 'storage') return h('path', { key: key, className: c, d: 'M' + (x - 7) + ',' + (y - 5.5) + 'h14l-7,12z' });
    return h('circle', { key: key, className: c, cx: x, cy: y, r: 6 });
  }
  /* one equipment symbol centred on (x, y) inside an s x s square */
  function equipShape(kind, x, y, s) {
    var c = 'sd-pfd-eq', f = 'sd-pfd-eq sd-pfd-eqfill', o = [], k = 0, K = function () { return 'q' + (k++); };
    var R = function (cx, cy, w, hh, cls, rx) { o.push(h('rect', { key: K(), className: cls || c, x: cx - w / 2, y: cy - hh / 2, width: w, height: hh, rx: rx || 0 })); };
    var C = function (cx, cy, r) { o.push(h('circle', { key: K(), className: c, cx: cx, cy: cy, r: r })); };
    var P = function (d, cls) { o.push(h('path', { key: K(), className: cls || c, d: d })); };
    if (kind === 'crusher') { var r1 = s * 0.2; C(x - r1, y, r1); C(x + r1, y, r1); }
    else if (kind === 'conditioner') { var w1 = s * 0.38, h1 = s * 0.8; R(x, y, w1, h1); for (var i = 1; i < 5; i++) P('M' + (x - w1 / 2) + ',' + (y - h1 / 2 + i * h1 / 5) + 'h' + w1); }
    else if (kind === 'screwpress') { var w2 = s * 0.95, h2 = s * 0.3; R(x, y, w2, h2); P('M' + (x - w2 / 2 + 5) + ',' + (y - h2 / 2 + 4) + 'L' + (x + w2 / 2 - 6) + ',' + y + 'L' + (x - w2 / 2 + 5) + ',' + (y + h2 / 2 - 4) + 'z', f); }
    else if (kind === 'extractor') { var w3 = s * 0.98, h3 = s * 0.3; R(x, y, w3, h3, c, h3 / 2); for (var j = 1; j < 7; j++) P('M' + (x - w3 / 2 + h3 / 2 + (j - 1) * (w3 - h3) / 5) + ',' + (y - h3 / 2) + 'v' + h3); }
    else if (kind === 'deodoriser') { var w4 = s * 0.36, h4 = s * 0.78, t = y - h4 / 2, b = y + h4 / 2; P('M' + (x - w4 / 2) + ',' + (t + w4 / 2) + 'a' + w4 / 2 + ',' + w4 / 2 + ' 0 0 1 ' + w4 + ',0V' + (b - w4 / 2) + 'a' + w4 / 2 + ',' + w4 / 2 + ' 0 0 1 ' + (-w4) + ',0z'); P('M' + x + ',' + t + 'v-6'); for (var m = 1; m < 5; m++) P('M' + (x - w4 / 2) + ',' + (t + w4 / 2 + m * (h4 - w4) / 5) + 'h' + w4); }
    else if (kind === 'milling') { var r2 = s * 0.16; C(x, y - r2 * 0.95, r2); C(x - r2, y + r2 * 0.75, r2); C(x + r2, y + r2 * 0.75, r2); }
    else if (kind === 'clarifier') { var w5 = s * 0.7, t5 = y - s * 0.36; P('M' + (x - w5 / 2) + ',' + t5 + 'L' + x + ',' + (y + s * 0.26) + 'L' + (x + w5 / 2) + ',' + t5); P('M' + (x - w5 / 2) + ',' + t5 + 'v-' + s * 0.06 + 'M' + (x + w5 / 2) + ',' + t5 + 'v-' + s * 0.06); P('M' + x + ',' + (y + s * 0.26) + 'v' + s * 0.1 + 'M' + (x - 5) + ',' + (y + s * 0.36) + 'h10'); }
    else if (kind === 'evaporator') { var w6 = s * 0.42, h6 = s * 0.8; R(x, y, w6, h6, c, w6 * 0.3); R(x, y + h6 * 0.12, w6, h6 * 0.2, f); }
    else if (kind === 'centrifuge') { var w7 = s * 0.42, h7 = s * 0.7; R(x, y, w7, h7); R(x, y, w7 - 9, h7 - 9, 'sd-pfd-eq sd-pfd-eqdash'); R(x - w7 / 2 + 3.5, y, 4, h7 - 2, f); }
    else if (kind === 'hydrocyclone') { var w8 = s * 0.5; R(x, y - s * 0.26, w8, s * 0.16); P('M' + (x - w8 / 2) + ',' + (y - s * 0.18) + 'L' + x + ',' + (y + s * 0.38) + 'L' + (x + w8 / 2) + ',' + (y - s * 0.18) + 'z'); }
    else if (kind === 'vacuumfilter') { var r3 = s * 0.28, ty = y + s * 0.04; P('M' + (x - r3 - 9) + ',' + ty + 'V' + (ty + r3 * 0.75) + 'H' + (x + r3 + 9) + 'V' + ty); C(x, y - s * 0.02, r3); for (var a = 0; a < 6; a++) { var an = a * Math.PI / 3; P('M' + x + ',' + (y - s * 0.02) + 'l' + (Math.cos(an) * r3) + ',' + (Math.sin(an) * r3)); } }
    else R(x, y, s * 0.7, s * 0.5);
    return o;
  }
  function PfdSymbol(p) {
    var s = p.size || 60, eq = PFD_EQUIP.filter(function (e) { return e[0] === p.kind; })[0] || [p.kind, p.kind, ''];
    var tag = p.tag != null ? p.tag : eq[2];
    return h('g', { className: 'sd-pfd' }, equipShape(p.kind, p.x, p.y, s),
      p.label !== false ? h('text', { className: 'sd-pfd-eqlabel', x: p.x, y: p.y + s / 2 + 12 }, p.label || eq[1]) : null,
      tag ? h('text', { className: 'sd-pfd-eqtag', x: p.x + s / 2 + 6, y: p.y - s / 2 + 6, style: { textAnchor: 'start' } }, tag) : null);
  }
  function ProductFlow(p) {
    var X = p.x || 0, Y = p.y || 0, layout = p.layout || 'column', col = layout === 'column';
    var bw = p.boxW || (col ? 250 : 112), bh = p.boxH || p.stepH || (col ? 44 : 52), hg = p.hGap || 44, vg = p.vGap || p.gap || (col ? 26 : 46), per = p.perRow || 5;
    var steps = p.steps || [], out = [], arrows = [], k = 0, K = function () { return 'f' + (k++); }, at = {}, used = {};
    var X0 = X + (col ? (p.inputW || 170) + 40 : (p.inputW || 0));
    var maxH = steps.some(function (st) { return st.type === 'equipment'; }) ? bh * 1.5 : steps.some(function (st) { return st.type === 'decision'; }) ? bh * 1.25 : bh, pitch = maxH + vg;
    /* place */
    steps.forEach(function (st, i) {
      var c, r;
      if (st.col != null && st.row != null) { c = st.col; r = st.row; }
      else if (col) { c = 0; r = i; }
      else { r = Math.floor(i / per); c = i % per; if (layout === 'snake' && r % 2) c = per - 1 - c; }
      var type = st.type || 'process', hh = type === 'decision' ? bh * 1.25 : (type === 'equipment' ? bh * 1.5 : bh);
      var cx = X0 + c * (bw + hg) + bw / 2, cy = Y + r * pitch + maxH / 2;
      at[st.id] = { st: st, i: i, c: c, r: r, cx: cx, cy: cy, w: type === 'decision' ? bw * 0.86 : bw, h: hh, type: type };
    });
    var port = function (n, side) {
      var sk = n.type === 'io' ? 7 : 0;
      if (side === 'left') return [n.cx - n.w / 2 + sk, n.cy];
      if (side === 'right') return [n.cx + n.w / 2 - sk, n.cy];
      if (side === 'top') return [n.cx, n.cy - n.h / 2];
      return [n.cx, n.cy + n.h / 2];
    };
    var allR = Object.keys(at).map(function (id) { return at[id]; });
    var minY = Math.min.apply(null, allR.map(function (n) { return n.cy - n.h / 2; })), maxY = Math.max.apply(null, allR.map(function (n) { return n.cy + n.h / 2; }));
    var maxX = Math.max.apply(null, allR.map(function (n) { return n.cx + n.w / 2; }));
    /* links: the main chain (each step to the next unless next is given) plus extra links */
    var links = [];
    steps.forEach(function (st, i) {
      var nx = st.next === undefined ? (steps[i + 1] && steps[i + 1].id) : st.next;
      [].concat(nx || []).forEach(function (t) { links.push(typeof t === 'string' ? { from: st.id, to: t } : Object.assign({ from: st.id }, t)); });
    });
    (p.links || []).forEach(function (l) { links.push(l); });
    (p.loops || []).forEach(function (l) { links.push(Object.assign({ route: 'right', dash: true }, l)); });
    var lane = { right: 0, left: 0, over: 0, under: 0 };
    links.forEach(function (l) {
      var a = at[l.from], b = at[l.to]; if (!a || !b) return;
      var pts, route = l.route || 'auto', dash = l.dash || l.kind === 'control' ? 'dashed' : null;
      if (route === 'right' || route === 'left') {
        var sgn = route === 'right' ? 1 : -1, lx = (route === 'right' ? maxX + 18 : X0 - 18) + sgn * 14 * lane[route]++;
        var p0 = port(a, route), p1 = port(b, route); p0 = [p0[0], p0[1] + 6]; p1 = [p1[0], p1[1] + 6];
        pts = [p0, [lx, p0[1]], [lx, p1[1]], p1];
      } else if (route === 'over' || route === 'under') {
        var up = route === 'over', ly = up ? Math.min(a.cy - a.h / 2, b.cy - b.h / 2) - vg / 2 + 6 * lane[route]++ : Math.max(a.cy + a.h / 2, b.cy + b.h / 2) + vg / 2 - 6 * lane[route]++;
        var q0 = port(a, up ? 'top' : 'bottom'), q1 = port(b, up ? 'top' : 'bottom'), sh2 = l.toOffset != null ? l.toOffset : (b.cx > a.cx ? -1 : 1) * b.w * 0.25;
        q1 = [q1[0] + (b.type === 'decision' ? 0 : sh2), q1[1]];
        pts = [q0, [q0[0], ly], [q1[0], ly], q1];
      } else if (Math.abs(a.cy - b.cy) < 1) {
        pts = a.cx < b.cx ? [port(a, 'right'), port(b, 'left')] : [port(a, 'left'), port(b, 'right')];
      } else if (Math.abs(a.cx - b.cx) < 1) {
        pts = a.cy < b.cy ? [port(a, 'bottom'), port(b, 'top')] : [port(a, 'top'), port(b, 'bottom')];
      } else {
        /* elbow: leave sideways, then turn into the target from above or below */
        var s0 = port(a, b.cx > a.cx ? 'right' : 'left'), e0 = port(b, b.cy > a.cy ? 'top' : 'bottom');
        pts = [s0, [e0[0], s0[1]], e0];
      }
      arrows.push(h(FlowArrow, { key: K(), points: pts, dash: dash, color: l.kind === 'control' ? 'var(--pfd-control)' : null }));
      if (l.label && (route === 'right' || route === 'left')) {
        var lx2 = pts[1][0] + (route === 'right' ? 9 : -9);
        arrows.push(h('text', { key: K(), className: 'sd-pfd-loop', transform: 'translate(' + lx2 + ',' + ((pts[1][1] + pts[2][1]) / 2) + ') rotate(' + (route === 'right' ? 90 : -90) + ')' }, l.label));
      } else if (l.label) {
        var lp = pts[0], lq = pts[1], horiz = Math.abs(lq[1] - lp[1]) < 1;
        arrows.push(h('text', { key: K(), className: 'sd-pfd-branch', x: horiz ? (lp[0] + lq[0]) / 2 : lp[0] + 6, y: horiz ? lp[1] - 7 : (lp[1] + Math.min(lq[1], lp[1] + 30)) / 2, style: { textAnchor: horiz ? 'middle' : 'start' } }, l.label));
      }
    });
    /* streams: ingredients, utilities, products and waste on any side of a step */
    var streams = {};
    (p.inputs || []).forEach(function (q) { (streams[q.to] = streams[q.to] || []).push({ label: q.label, side: 'left', dir: 'in' }); });
    (p.outputs || []).forEach(function (q) { (streams[q.from] = streams[q.from] || []).push({ label: q.label, side: 'right', dir: 'out', kind: q.kind || 'waste' }); });
    steps.forEach(function (st) { (st.streams || []).forEach(function (q) { (streams[st.id] = streams[st.id] || []).push(q); }); });
    Object.keys(streams).forEach(function (id) {
      var n = at[id]; if (!n) return;
      var bySide = {}; streams[id].forEach(function (q) { var sd = q.side || (q.dir === 'out' ? 'right' : 'left'); (bySide[sd] = bySide[sd] || []).push(q); });
      Object.keys(bySide).forEach(function (sd) {
        bySide[sd].forEach(function (q, j, arr) {
          var L = 32, off = (j - (arr.length - 1) / 2), pt = port(n, sd), vert = sd === 'top' || sd === 'bottom';
          var sp = vert ? Math.min(34, (n.w - 20) / Math.max(1, arr.length - 1)) : Math.min(14, (n.h - 10) / Math.max(1, arr.length - 1));
          var bx = vert ? pt[0] + off * sp : pt[0], by = vert ? pt[1] : pt[1] + off * sp, dx = sd === 'left' ? -1 : sd === 'right' ? 1 : 0, dy = sd === 'top' ? -1 : sd === 'bottom' ? 1 : 0;
          var far = [bx + dx * L, by + dy * L], inn = q.dir !== 'out', waste = !inn && (q.kind === 'waste'), util = q.kind === 'utility';
          arrows.push(h(FlowArrow, { key: K(), points: inn ? [far, [bx, by]] : [[bx, by], far], color: inn ? (util ? null : 'var(--pfd-input)') : (waste ? 'var(--pfd-waste)' : null) }));
          var tx = far[0] + dx * 5, ty = far[1] + dy * 8, anchor = sd === 'left' ? 'end' : sd === 'right' ? 'start' : 'middle';
          if (vert && arr.length > 1 && j === 0) { anchor = 'end'; tx += 6; } else if (vert && arr.length > 1 && j === arr.length - 1) { anchor = 'start'; tx -= 6; }
          arrows.push(h('text', { key: K(), className: 'sd-pfd-stream' + (waste ? ' sd-pfd-waste' : ''), x: tx, y: ty, style: { textAnchor: anchor } }, q.label));
        });
      });
    });
    /* nodes */
    var nodes = [];
    allR.forEach(function (n) {
      var st = n.st, x0 = n.cx - n.w / 2, y0 = n.cy - n.h / 2, ccp = st.ccp, cls = 'sd-pfd-box' + (ccp ? ' sd-pfd-ccpbox' : '');
      var lines = String(st.label || '').split('\n'), upper = p.uppercase !== false && !col, fsz = col ? 13 : 11.5;
      if (upper) lines = lines.map(function (s) { return s.toUpperCase(); });
      used[n.type] = 1;
      if (n.type === 'io') nodes.push(h('path', { key: K(), className: cls, d: 'M' + (x0 + 12) + ',' + y0 + 'H' + (x0 + n.w) + 'L' + (x0 + n.w - 12) + ',' + (y0 + n.h) + 'H' + x0 + 'z' }));
      else if (n.type === 'decision') nodes.push(h('path', { key: K(), className: cls, d: 'M' + n.cx + ',' + y0 + 'L' + (x0 + n.w) + ',' + n.cy + 'L' + n.cx + ',' + (y0 + n.h) + 'L' + x0 + ',' + n.cy + 'z' }));
      else if (n.type === 'equipment') { used['eq:' + st.equip] = 1; nodes.push(h('rect', { key: K(), className: 'sd-pfd-eqcell' + (ccp ? ' sd-pfd-ccpbox' : ''), x: x0, y: y0, width: n.w, height: n.h })); equipShape(st.equip, n.cx, n.cy - 7, n.h * 0.62).forEach(function (e) { nodes.push(e); }); }
      else nodes.push(h('rect', { key: K(), className: cls, x: x0, y: y0, width: n.w, height: n.h }));
      if (col && n.type === 'process') {
        nodes.push(pfdGlyph(st.kind || 'operation', x0 + 17, n.cy, K())); used['k:' + (st.kind || 'operation')] = 1;
        var sub = st.limit || st.note, ty0 = sub ? n.cy - 7.5 : n.cy;
        nodes.push(h('text', { key: K(), className: 'sd-pfd-label', x: x0 + 34, y: ty0, style: { textAnchor: 'start', fontSize: fsz + 'px' } }, p.numbers === false ? null : h('tspan', { className: 'sd-pfd-no' }, String(st.no != null ? st.no : n.i + 1) + '  '), lines.join(' ')));
        if (sub) nodes.push(h('text', { key: K(), className: 'sd-pfd-sub' + (st.limit ? ' sd-pfd-limit' : ''), x: x0 + 34, y: n.cy + 9 }, sub));
      } else if (n.type === 'equipment') {
        var eq = PFD_EQUIP.filter(function (e) { return e[0] === st.equip; })[0] || ['', '', ''];
        nodes.push(h('text', { key: K(), className: 'sd-pfd-label', x: n.cx, y: y0 + n.h - 9, style: { fontSize: '10.5px' } }, upper ? (st.label || eq[1]).toUpperCase() : (st.label || eq[1])));
        var tg = st.tag != null ? st.tag : eq[2]; if (tg) nodes.push(h('text', { key: K(), className: 'sd-pfd-eqtag', x: x0 + n.w - 4, y: y0 + 9 }, tg));
      } else {
        var lh = fsz + 2.5, sub2 = st.limit || st.note, all = sub2 ? lines.length + 1 : lines.length;
        lines.forEach(function (ln, j) { nodes.push(h('text', { key: K(), className: 'sd-pfd-label', x: n.cx + (n.type === 'io' ? 0 : 0), y: n.cy + (j - (all - 1) / 2) * lh, style: { fontSize: fsz + 'px' } }, ln)); });
        if (sub2) nodes.push(h('text', { key: K(), className: 'sd-pfd-sub' + (st.limit ? ' sd-pfd-limit' : ''), x: n.cx, y: n.cy + (lines.length - (all - 1) / 2) * lh, style: { textAnchor: 'middle', fontSize: '9.5px' } }, sub2));
      }
      if (ccp) {
        var tag = (ccp === true ? 'CCP' : String(ccp)) + (st.hazards ? ' · ' + [].concat(st.hazards).join(' ') : ''), tw = tag.length * 6.1 + 14;
        var tx = n.type === 'decision' ? n.cx - 8 - tw / 2 : x0 + n.w - tw / 2 - 4, tyy = n.type === 'decision' ? y0 + n.h + 12 : y0;
        nodes.push(h('rect', { key: K(), className: 'sd-pfd-tag', x: tx - tw / 2, y: tyy - 8, width: tw, height: 16, rx: 8 }));
        nodes.push(h('text', { key: K(), className: 'sd-pfd-tagt', x: tx, y: tyy }, tag));
      }
    });
    out = arrows.concat(nodes);
    /* key */
    if (p.legend !== false && steps.length) {
      var ly = maxY + (p.legendGap || 44), lx = X, hz = {}, items = [];
      steps.forEach(function (st) { [].concat(st.hazards || []).forEach(function (z) { hz[z] = 1; }); });
      out.push(h('path', { key: K(), className: 'sd-pfd-rule', d: 'M' + X + ',' + (ly - 12) + 'H' + Math.max(maxX + 40, X + 600) }));
      var add = function (draw, label, w) { items.push([draw, label, w]); };
      if (used.process && !col) add(function (x, y) { return h('rect', { className: 'sd-pfd-box', x: x, y: y - 7, width: 22, height: 14 }); }, 'Process element', 26);
      if (used.io) add(function (x, y) { return h('path', { className: 'sd-pfd-box', d: 'M' + (x + 5) + ',' + (y - 7) + 'h20l-5,14h-20z' }); }, 'Input / output', 28);
      if (used.decision) add(function (x, y) { return h('path', { className: 'sd-pfd-box', d: 'M' + (x + 12) + ',' + (y - 8) + 'l12,8l-12,8l-12,-8z' }); }, 'Decision', 28);
      PFD_KINDS.forEach(function (kd) { if (used['k:' + kd[0]]) add(function (x, y) { return pfdGlyph(kd[0], x + 8, y); }, kd[1], 20); });
      if (links.some(function (l) { return l.kind === 'control'; })) add(function (x, y) { return h('path', { className: 'sd-fl-line sd-fl-dashed', style: { stroke: 'var(--pfd-control)', strokeWidth: 1.4 }, d: 'M' + x + ',' + y + 'h26' }); }, 'Control signal', 32);
      if (steps.some(function (st) { return st.ccp; })) add(function (x, y) { return h('g', null, h('rect', { className: 'sd-pfd-tag', x: x, y: y - 8, width: 34, height: 16, rx: 8 }), h('text', { className: 'sd-pfd-tagt', x: x + 17, y: y }, 'CCP')); }, 'Critical control point' + (Object.keys(hz).length ? ': ' + Object.keys(hz).map(function (z) { return z + ' ' + (PFD_HAZ[z] || z).toLowerCase(); }).join(', ') : ''), 40);
      items.forEach(function (it) { out.push(h('g', { key: K() }, it[0](lx, ly))); out.push(h('text', { key: K(), className: 'sd-pfd-key', x: lx + it[2] + 4, y: ly }, it[1])); lx += it[2] + 22 + it[1].length * 5.9; });
    }
    return h('g', { className: 'sd-pfd' }, out);
  }

  /* ================= Pedigree (04) ================= */
  var PED_FLAGS = [['affected', 'Affected'], ['unknownSt', 'Status unknown'], ['carrier', 'Carrier'], ['xcarrier', 'Carrier (X-linked)'], ['adoptedIn', 'Adopted in'], ['adoptedOut', 'Adopted out'], ['deceased', 'Deceased'], ['proband', 'Proband'], ['pregnancy', 'Pregnancy']];
  function pedShape(sex, x, y, r) {
    if (sex === 'm') return h('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r });
    if (sex === 'f') return h('circle', { cx: x, cy: y, r: r });
    return h('path', { d: 'M' + x + ',' + (y - r * 1.25) + 'L' + (x + r * 1.25) + ',' + y + 'L' + x + ',' + (y + r * 1.25) + 'L' + (x - r * 1.25) + ',' + y + 'z' });
  }
  function PedigreeSymbol(p) {
    var x = p.x, y = p.y, r = p.r || 14, sex = p.sex || 'u', f = p, out = [], k = 0, K = function () { return 'y' + (k++); };
    var clip = 'sd-pc-' + (++gid);
    out.push(h('g', { key: K(), className: 'sd-pd-fill' + (f.affected ? ' sd-pd-aff' : '') }, pedShape(sex, x, y, r)));
    if (f.unknownSt && !f.affected) {
      var lines = []; for (var o = -2 * r; o <= 2 * r; o += 4) lines.push('M' + (x + o - r * 1.3) + ',' + (y + r * 1.3) + 'L' + (x + o + r * 1.3) + ',' + (y - r * 1.3));
      out.push(h('defs', { key: K() }, h('clipPath', { id: clip }, pedShape(sex, x, y, r))));
      out.push(h('path', { key: K(), className: 'sd-pd-hatch', d: lines.join(''), clipPath: 'url(#' + clip + ')' }));
    }
    out.push(h('g', { key: K(), className: 'sd-pd-outline' }, pedShape(sex, x, y, r)));
    if ((f.carrier || f.xcarrier) && !f.affected && !f.unknownSt) out.push(h('circle', { key: K(), className: 'sd-pd-dot', cx: x, cy: y, r: r * 0.32 }));
    if (f.xcarrier && !f.affected && !f.unknownSt) out.push(h('circle', { key: K(), className: 'sd-pd-ring', cx: x, cy: y, r: r * 0.62 }));
    if (f.adoptedIn || f.adoptedOut) { var br = r * 1.5, bw = r * 0.42; out.push(h('path', { key: K(), className: 'sd-pd-bracket' + (f.adoptedOut ? ' sd-pd-dash' : ''), d: 'M' + (x - br + bw) + ',' + (y - br) + 'H' + (x - br) + 'V' + (y + br) + 'H' + (x - br + bw) + 'M' + (x + br - bw) + ',' + (y - br) + 'H' + (x + br) + 'V' + (y + br) + 'H' + (x + br - bw) })); }
    if (f.deceased) out.push(h('path', { key: K(), className: 'sd-pd-line', d: 'M' + (x - r * 1.35) + ',' + (y + r * 1.35) + 'L' + (x + r * 1.35) + ',' + (y - r * 1.35) }));
    if (f.pregnancy) out.push(h('text', { key: K(), className: 'sd-pd-p' + (f.affected ? ' sd-pd-p-inv' : ''), x: x, y: y, style: { fontSize: r * 0.95 + 'px' } }, 'P'));
    if (f.proband) { var ax = x - r * 1.5, ay = y + r * 1.85; out.push(h('path', { key: K(), className: 'sd-pd-proband', d: 'M' + (ax - 7) + ',' + (ay + 7) + 'L' + ax + ',' + ay + 'L' + (ax - 1) + ',' + (ay + 5) + 'M' + ax + ',' + ay + 'L' + (ax - 5) + ',' + (ay + 1) })); }
    if (p.name) out.push(h('text', { key: K(), className: 'sd-pd-name', x: x, y: y + r + 15 }, p.name));
    return h('g', { className: 'sd-pd-person' }, out);
  }
  function Pedigree(p) {
    var X = p.x || 0, Y = p.y || 0, gh = p.genGap || 110, r = p.r || 14, people = {}, out = [], k = 0, K = function () { return 'g' + (k++); };
    (p.people || []).forEach(function (q) { people[q.id] = Object.assign({}, q, { _x: X + (q.x || 0), _y: Y + (q.gen || 0) * gh }); });
    var gens = {}; Object.keys(people).forEach(function (id) { gens[people[id].gen || 0] = 1; });
    if (p.showGens !== false) Object.keys(gens).forEach(function (g) { out.push(h('text', { key: K(), className: 'sd-pd-gen', x: X - 40, y: Y + g * gh }, ROMAN[g] || g)); });
    (p.unions || []).forEach(function (u) {
      var a = people[u.a], b = people[u.b]; if (!a || !b) return;
      var L0 = a._x < b._x ? a : b, R0 = a._x < b._x ? b : a, y = a._y, x1 = L0._x + r, x2 = R0._x - r, mx = (L0._x + R0._x) / 2;
      out.push(h('path', { key: K(), className: 'sd-pd-line', d: 'M' + x1 + ',' + y + 'H' + x2 + (u.consang ? 'M' + x1 + ',' + (y + 3) + 'H' + x2 : '') }));
      if (u.divorced) out.push(h('path', { key: K(), className: 'sd-pd-line', d: 'M' + (mx - 5) + ',' + (y + 7) + 'L' + (mx + 1) + ',' + (y - 7) + 'M' + (mx - 1) + ',' + (y + 7) + 'L' + (mx + 5) + ',' + (y - 7) }));
      var kids = (u.children || []).map(function (id) { return people[id]; }).filter(Boolean);
      if (!kids.length) return;
      var sy = y + gh / 2, kx = kids.map(function (c) { return c._x; });
      var d = 'M' + mx + ',' + y + 'V' + sy + 'M' + Math.min.apply(null, kx.concat([mx])) + ',' + sy + 'H' + Math.max.apply(null, kx.concat([mx]));
      kids.forEach(function (c) { d += 'M' + c._x + ',' + sy + 'V' + (c._y - r * (c.sex === 'u' ? 1.25 : 1)); });
      out.push(h('path', { key: K(), className: 'sd-pd-line', d: d }));
    });
    Object.keys(people).forEach(function (id) { var q = people[id]; out.push(h(PedigreeSymbol, Object.assign({ key: id }, q, { x: q._x, y: q._y, r: r }))); });
    return h('g', { className: 'sd-pedigree' }, out);
  }

  /* ================= Food web (05) ================= */
  var WEB_BANDS = [['Producers', 'var(--band-producer)'], ['Primary consumers', 'var(--band-primary)'], ['Secondary consumers', 'var(--band-secondary)'], ['Tertiary consumers', 'var(--band-tertiary)'], ['Apex predators', 'var(--band-apex)']];
  function FoodWeb(p) {
    var X = p.x || 0, Y = p.y || 0, W = p.w || 760, bandH = p.bandH || 96, colW = p.colW || 150, bh = 34, n = (p.bands || WEB_BANDS).length, bands = p.bands || WEB_BANDS;
    var color = p.colorBands !== false, nodes = {}, out = [], k = 0, K = function () { return 'f' + (k++); };
    var bandY = function (b) { return Y + (n - 1 - b) * bandH; };
    bands.forEach(function (b, i) {
      var by = bandY(i);
      out.push(h('text', { key: K(), className: 'sd-fw-band', x: X + 8, y: by + 18, style: { fill: color ? b[1] : undefined } }, String(b[0]).toUpperCase()));
      out.push(h('path', { key: K(), className: 'sd-fw-bandrule', d: 'M' + (X + 8) + ',' + (by + 28) + 'H' + (X + 130), style: { stroke: color ? b[1] : undefined } }));
    });
    (p.nodes || []).forEach(function (q) {
      var w = Math.max(84, String(q.name).length * 7.2 + 26), cx = X + 170 + (q.x || 0) * colW;
      nodes[q.id] = Object.assign({}, q, { w: w, h: bh, cx: cx, cy: bandY(q.band) + bandH * 0.5 + 18 + (q.dy || 0) });
    });
    /* Ports: each node side shares its arrows evenly, ordered by the other end's x, so arrows never pile into one point. */
    var list = (p.edges || []).filter(function (e) { return nodes[e.from] && nodes[e.to] && e.from !== e.to; }), ports = {};
    var sideOf = function (a, b) { var dy = b.cy - a.cy; return Math.abs(dy) < a.h ? (b.cx >= a.cx ? 'r' : 'l') : (dy < 0 ? 't' : 'b'); };
    list.forEach(function (e, i) {
      var a = nodes[e.from], b = nodes[e.to];
      e._s = sideOf(a, b); e._t = sideOf(b, a);
      (ports[e.from + '|' + e._s] = ports[e.from + '|' + e._s] || []).push({ e: e, end: 's', o: b.cx });
      (ports[e.to + '|' + e._t] = ports[e.to + '|' + e._t] || []).push({ e: e, end: 't', o: a.cx });
    });
    Object.keys(ports).forEach(function (key) {
      var parts = key.split('|'), q = nodes[parts[0]], side = parts[1], arr = ports[key];
      arr.sort(function (u, v) { return u.o - v.o; });
      arr.forEach(function (it, i) {
        var f = (i + 1) / (arr.length + 1), pt;
        if (side === 't' || side === 'b') pt = [q.cx - q.w / 2 + q.w * f, q.cy + (side === 't' ? -q.h / 2 : q.h / 2)];
        else pt = [q.cx + (side === 'r' ? q.w / 2 : -q.w / 2), q.cy - q.h / 2 + q.h * f];
        it.e[it.end === 's' ? '_p1' : '_p2'] = pt;
      });
    });
    list.forEach(function (e) {
      var a = nodes[e.from], b = nodes[e.to], p1 = e._p1, p2 = e._p2;
      var w = e.weight === 'major' ? 2.5 : e.weight === 'minor' ? 1.2 : 1.5, col = color ? bands[a.band][1] : 'var(--neutral-500)';
      var vert = e._s === 't' || e._s === 'b', c1, c2, tx, ty, hs = 6 + w;
      if (vert) { var m = Math.max(24, Math.abs(p2[1] - p1[1]) * 0.5), sg = e._s === 't' ? -1 : 1; c1 = [p1[0], p1[1] + sg * m]; c2 = [p2[0], p2[1] - sg * m]; }
      else { var lift = 38 + Math.abs(p2[0] - p1[0]) * 0.12, sx = e._s === 'r' ? 1 : -1; c1 = [p1[0] + sx * 24, p1[1] - lift]; c2 = [p2[0] - sx * 24, p2[1] - lift]; }
      var ang = Math.atan2(p2[1] - c2[1], p2[0] - c2[0]), end = [p2[0] - Math.cos(ang) * hs * 0.68, p2[1] - Math.sin(ang) * hs * 0.68];
      out.push(h('path', { key: K(), className: 'sd-fw-edge' + (e.weight === 'minor' ? ' sd-fw-minor' : ''), 'data-from': e.from, 'data-to': e.to, d: 'M' + p1 + 'C' + c1 + ' ' + c2 + ' ' + end, style: { stroke: col, strokeWidth: w } }));
      out.push(h('g', { key: K(), className: 'sd-fw-head', 'data-from': e.from, 'data-to': e.to }, notch(p2[0], p2[1], ang, hs, '', { fill: col }, K())));
      if (e.label) out.push(h('text', { key: K(), className: 'sd-fw-elabel', x: (p1[0] + p2[0]) / 2, y: (p1[1] + p2[1]) / 2 }, e.label));
    });
    Object.keys(nodes).forEach(function (id) {
      var q = nodes[id], col = q.color || (color ? bands[q.band][1] : 'var(--neutral-400)'), x0 = q.cx - q.w / 2, y0 = q.cy - q.h / 2;
      out.push(h('g', { key: K(), className: 'sd-fw-node', 'data-id': id }, [
        h('rect', { key: 'r', className: 'sd-fw-box', x: x0, y: y0, width: q.w, height: q.h }),
        h('path', { key: 'g', className: 'sd-reg', d: regMarks(x0, y0, q.w, q.h, 4.5).props.d, style: { stroke: col } }),
        h('text', { key: 't', className: 'sd-fw-name', x: q.cx, y: q.cy }, q.name)]));
    });

    return h('g', { className: 'sd-foodweb' }, out);
  }

  /* ================= Punnett square (06) ================= */
  function punnett(pA, pB, traits) {
    var pairs = function (g) { var a = String(g || '').replace(/\s/g, ''), out = []; for (var i = 0; i + 1 < a.length; i += 2) out.push([a[i], a[i + 1]]); return out; };
    var A = pairs(pA), B = pairs(pB);
    if (!A.length || A.length !== B.length) return null;
    var gam = function (P) { return P.reduce(function (acc, pr) { var nx = []; acc.forEach(function (s) { pr.forEach(function (al) { if (nx.indexOf(s + al) < 0 || true) nx.push(s + al); }); }); return nx; }, ['']).filter(function (v, i, a) { return a.indexOf(v) === i; }); };
    var cols = gam(A), rows = gam(B), cells = [], genoCount = {}, phenoCount = {}, phenoOrder = [];
    rows.forEach(function (r, ri) {
      cols.forEach(function (c, ci) {
        var geno = '', ph = [];
        for (var i = 0; i < c.length; i++) {
          var pr = [c[i], r[i]].sort(function (x, y) { var ux = x === x.toUpperCase(), uy = y === y.toUpperCase(); return ux === uy ? (x < y ? -1 : 1) : ux ? -1 : 1; });
          geno += pr.join('');
          var key = pr[0].toUpperCase(), dom = pr.some(function (al) { return al === al.toUpperCase() && al !== al.toLowerCase(); });
          var t = (traits || {})[key];
          ph.push(t ? (dom ? t.dom : t.rec) : (dom ? key : key.toLowerCase()));
        }
        var pheno = ph.join(', ');
        if (phenoOrder.indexOf(pheno) < 0) phenoOrder.push(pheno);
        genoCount[geno] = (genoCount[geno] || 0) + 1; phenoCount[pheno] = (phenoCount[pheno] || 0) + 1;
        cells.push({ ri: ri, ci: ci, geno: geno, pheno: pheno });
      });
    });
    return { cols: cols, rows: rows, cells: cells, genoCount: genoCount, phenoCount: phenoCount, phenoOrder: phenoOrder };
  }
  function PunnettSquare(p) {
    var M = punnett(p.pA, p.pB, p.traits), X = p.x || 0, Y = p.y || 0, out = [], k = 0, K = function () { return 'q' + (k++); };
    if (!M) return h('text', { className: 'sd-pn-empty', x: X, y: Y }, 'Give both parents a genotype like Aa or AaBb.');
    var cell = p.cell || (M.cols.length > 2 ? 72 : 110), nameGap = (p.nameA || p.nameB) ? 26 : 0, gx = X + nameGap + cell, gy = Y + nameGap + cell;
    var gw = cell * M.cols.length, gh = cell * M.rows.length, showPheno = p.showPheno !== false;
    if (p.nameA) out.push(h('text', { key: K(), className: 'sd-pn-parent', x: gx + gw / 2, y: Y + nameGap - 10 }, String(p.nameA).toUpperCase()));
    if (p.nameB) out.push(h('text', { key: K(), className: 'sd-pn-parent', transform: 'translate(' + (X + nameGap - 10) + ',' + (gy + gh / 2) + ') rotate(-90)' }, String(p.nameB).toUpperCase()));
    M.cols.forEach(function (c, i) { out.push(h('text', { key: K(), className: 'sd-pn-gamete', x: gx + cell * (i + 0.5), y: gy - cell * 0.5, style: { fontSize: Math.min(20, cell * 0.34) + 'px' } }, c)); });
    M.rows.forEach(function (r, i) { out.push(h('text', { key: K(), className: 'sd-pn-gamete', x: gx - cell * 0.5, y: gy + cell * (i + 0.5), style: { fontSize: Math.min(20, cell * 0.34) + 'px' } }, r)); });
    M.cells.forEach(function (c) {
      var x = gx + c.ci * cell, y = gy + c.ri * cell, pi = M.phenoOrder.indexOf(c.pheno);
      out.push(h('rect', { key: K(), className: 'sd-pn-cell', x: x, y: y, width: cell, height: cell }));
      if (showPheno) out.push(h('rect', { key: K(), className: 'sd-pn-tint', x: x, y: y, width: cell, height: cell, style: { fill: 'var(--pheno-' + (pi % 8 + 1) + ')' } }));
      out.push(h('rect', { key: K(), className: 'sd-pn-rule', x: x, y: y, width: cell, height: cell }));
      var two = showPheno && cell > 74;
      out.push(h('text', { key: K(), className: 'sd-pn-geno', x: x + cell / 2, y: y + cell * (two ? 0.4 : 0.5), style: { fontSize: Math.min(24, cell * 0.3) + 'px' } }, c.geno));
      if (two) c.pheno.split(', ').forEach(function (wd, i) { out.push(h('text', { key: K(), className: 'sd-pn-pheno', x: x + cell / 2, y: y + cell * (0.63 + i * 0.15), style: { fontSize: Math.min(13, cell * 0.15) + 'px' } }, wd)); });
    });
    out.push(h('rect', { key: K(), className: 'sd-pn-frame', x: gx, y: gy, width: gw, height: gh }));
    out.push(regMarks(gx, gy, gw, gh, 6, 'sd-pn-marks', K()));
    if (p.showRatios !== false) {
      var total = M.cells.length, ry = gy + gh + 28, lineN = 0;
      var row = function (head, entries, per) {
        for (var i = 0; i < entries.length; i += per) {
          out.push(h('text', { key: K(), className: 'sd-pn-ratio', x: gx, y: ry + (lineN++) * 19 }, i ? null : h('tspan', { className: 'sd-pn-rhead' }, head + '  '), (i ? '\u2003\u2003 ' : '') + entries.slice(i, i + per).join('  \u00b7  ')));
        }
      };
      row('Genotype', Object.keys(M.genoCount).map(function (g) { return M.genoCount[g] + ' ' + g; }), 5);
      row('Phenotype', M.phenoOrder.map(function (q) { return M.phenoCount[q] + ' ' + q; }).concat(['n = ' + total]), 3);
    }
    return h('g', { className: 'sd-punnett' }, out);
  }

  /* ================= Ecological pyramid (07) ================= */
  var PYR_KINDS = { energy: ['Pyramid of energy', 'Energy', 'kJ m^{-2} y^{-1}'], biomass: ['Pyramid of biomass', 'Biomass', 'g m^{-2}'], numbers: ['Pyramid of numbers', 'Number', 'individuals'] };
  var PYR_LEVELS = [['PP', 'Producer'], ['PC', 'Primary consumer'], ['SC', 'Secondary consumer'], ['TC', 'Tertiary consumer'], ['QC', 'Quaternary consumer']];
  function fmtNum(v) { return v >= 1000 ? Math.round(v).toLocaleString('en-AU') : String(+v.toPrecision(3)); }
  function EcoPyramid(p) {
    var X = p.x || 0, Y = p.y || 0, W = p.w || 820, th = p.tierH || 58, tiers = p.tiers || [], n = tiers.length, kind = PYR_KINDS[p.kind || 'energy'];
    var lvW = 150, gap = 18, valW = 96, spW = 190, barX0 = X + lvW + gap, barX1 = X + W - spW - gap - valW - gap, barW = barX1 - barX0, cx = (barX0 + barX1) / 2;
    var xVal = barX1 + gap, xSp = xVal + valW + gap, out = [], k = 0, K = function () { return 'y' + (k++); };
    var vals = tiers.map(function (t) { return +t.value || 0; }), max = Math.max.apply(null, vals.concat([1]));
    var log = p.scale === 'log', lo = log ? Math.floor(Math.log10(Math.min.apply(null, vals.filter(function (v) { return v > 0; })))) : 0, hi = log ? Math.ceil(Math.log10(max)) : 0;
    var f = function (v) { return log ? (Math.log10(v) - lo + 1) / (hi - lo + 1) : v / max; };
    var y = Y;
    out.push(h('text', { key: K(), className: 'sd-py-title', x: X, y: y }, kind[0])); y += 30;
    [['TROPHIC LEVEL', X], [kind[1].toUpperCase(), xVal], ['ORGANISM', xSp]].forEach(function (c) { out.push(h('text', { key: K(), className: 'sd-py-head', x: c[1], y: y }, c[0])); });
    y += 16;
    for (var r = 0; r <= n; r++) out.push(h('path', { key: K(), className: 'sd-py-rule', d: 'M' + X + ',' + (y + r * th) + 'H' + (X + W) }));
    tiers.forEach(function (t, i) {
      var ry = y + (n - 1 - i) * th, mid = ry + th / 2, col = t.color || 'var(--tier-a-' + (i % 6 + 1) + ')', v = vals[i], w = v > 0 ? Math.max(3, barW * f(v)) : 0, lv = PYR_LEVELS[i] || ['L' + (i + 1), 'Level ' + (i + 1)];
      if (w) {
        out.push(h('rect', { key: K(), className: 'sd-py-bar', x: cx - w / 2, y: ry, width: w, height: th, style: { fill: col } }));
        out.push(h('rect', { key: K(), className: 'sd-py-barline', x: cx - w / 2, y: ry, width: w, height: th, style: { stroke: col } }));
      }
      out.push(h('text', { key: K(), className: 'sd-py-abbr', x: X, y: mid - 8 }, lv[0]));
      out.push(h('text', { key: K(), className: 'sd-py-lname', x: X, y: mid + 9 }, '(' + lv[1] + ')'));
      out.push(h('text', { key: K(), className: 'sd-py-val', x: xVal, y: mid }, fmtNum(v)));
      if (t.common) out.push(h('text', { key: K(), className: 'sd-py-common', x: xSp, y: t.sci ? mid - 8 : mid }, t.common));
      if (t.sci) out.push(h('text', { key: K(), className: 'sd-py-sci', x: xSp, y: t.common ? mid + 9 : mid }, t.sci));
      if ((p.showTransfer === true || (p.showTransfer !== false && (p.kind || 'energy') === 'energy')) && i > 0 && vals[i - 1] > 0) {
        var pct = vals[i] / vals[i - 1] * 100;
        var px = cx + w / 2 + 8, inside = px + 40 > xVal - 4;
        out.push(h('text', { key: K(), className: 'sd-py-pct', x: inside ? cx + w / 2 - 6 : px, y: ry + th - 4, style: inside ? { textAnchor: 'end' } : null }, '↑ ' + (pct < 10 ? pct.toFixed(1) : Math.round(pct)) + ' %'));
      }
    });
    var inv = []; for (var q = 1; q < n; q++) if (vals[q] > vals[q - 1]) inv.push((PYR_LEVELS[q - 1] || ['L' + q])[0] + ' to ' + (PYR_LEVELS[q] || ['L' + (q + 1)])[0]);
    if (inv.length) out.push(h('text', { key: K(), className: 'sd-py-inv', x: X + W, y: Y + 10, style: { textAnchor: 'end' } }, 'Inverted: ' + inv.join(', ')));
    var fy = y + n * th + 12;
    out.push(h('path', { key: K(), className: 'sd-py-axis', d: 'M' + barX0 + ',' + fy + 'H' + barX1 }));
    if (p.unit !== false) out.push(h(ChemText, { key: K(), className: 'sd-py-unit', x: X, y: fy + 30 }, 'Unit of ' + kind[1].toLowerCase() + ': ' + (p.unit || kind[2]) + (log ? '  (bar width on a log scale)' : '')));
    return h('g', { className: 'sd-pyramid' }, out);
  }

  /* ================= Dichotomous key (08) ================= */
  function keyIndex(root) {
    var num = {}, n = 0, queue = [root];
    while (queue.length) { var q = queue.shift(); if (q.children && q.children.length) { num[q.id || (q.id = 'c' + n)] = ++n; queue = queue.concat(q.children); } }
    return num;
  }
  function DichotomousKey(p) {
    var root = p.root, num = keyIndex(root), view = p.view || 'tree', primes = p.numbering === 'primes';
    if (view !== 'tree') {
      var rows = [];
      (function walk(nd, depth) {
        if (!nd.children || !nd.children.length) return;
        nd.children.forEach(function (c, i) {
          var tag = num[nd.id] + (primes ? (i ? '′' : '') : (i ? 'b' : 'a'));
          var leaf = !c.children || !c.children.length;
          rows.push({ depth: depth, tag: tag, lead: c.lead, to: leaf ? null : num[c.id], name: leaf ? c.name : null, note: leaf ? c.note : null, color: c.color });
          if (view === 'indented') walk(c, depth + 1);
        });
        if (view !== 'indented') nd.children.forEach(function (c) { walk(c, depth); });
      })(root, 0);
      if (view !== 'indented') rows.sort(function (a, b) { return parseFloat(a.tag) - parseFloat(b.tag) || (a.tag < b.tag ? -1 : 1); });
      return h('ol', { className: 'sd-key-text sd-key-' + view }, rows.map(function (r, i) {
        return h('li', { key: i, style: { paddingLeft: view === 'indented' ? r.depth * 22 : 0 } },
          h('span', { className: 'sd-key-tag' }, r.tag),
          h('span', { className: 'sd-key-lead' }, r.lead),
          h('span', { className: 'sd-key-dots' }),
          r.name ? h('span', { className: 'sd-key-out', style: { borderColor: r.color || undefined } }, h('i', null, r.name), r.note ? ' (' + r.note + ')' : '') : h('span', { className: 'sd-key-go' }, 'go to ' + r.to));
      }));
    }
    var X = p.x || 0, Y = p.y || 0, colW = p.colW || 210, rowH = p.rowH || 64, nb = 26, leafW = p.leafW || 170, leafH = 40, out = [], k = 0, K = function () { return 'k' + (k++); };
    var leaves = 0;
    (function place(nd, d) {
      nd._d = d;
      if (!nd.children || !nd.children.length) { nd._row = leaves++; return; }
      nd.children.forEach(function (c) { place(c, d + 1); });
      nd._row = (nd.children[0]._row + nd.children[nd.children.length - 1]._row) / 2;
    })(root, 0);
    var maxD = 0; (function md(nd) { maxD = Math.max(maxD, nd._d); (nd.children || []).forEach(md); })(root);
    (function draw(nd) {
      var leaf = !nd.children || !nd.children.length, cy = Y + nd._row * rowH, x = leaf ? X + maxD * colW : X + nd._d * colW;
      nd._cx = x; nd._cy = cy;
      if (!leaf) {
        nd.children.forEach(function (c) { draw(c); });
        var px = x + nb, midX = px + 16;
        nd.children.forEach(function (c) {
          out.push(h('path', { key: K(), className: 'sd-key-link', d: 'M' + px + ',' + cy + 'H' + midX + 'V' + c._cy + 'H' + c._cx }));
          if (c.lead) {
            var words = wrapWords(c.lead, Math.floor((c._cx - midX - 12) / 6.4), 3);
            words.forEach(function (ln, i) { out.push(h('text', { key: K(), className: 'sd-key-ltext', x: midX + 6, y: c._cy - 6 - (words.length - 1 - i) * 15 }, ln)); });
          }
        });
        out.push(h('rect', { key: K(), className: 'sd-key-num', x: x, y: cy - nb / 2, width: nb, height: nb }));
        out.push(h('text', { key: K(), className: 'sd-key-numt', x: x + nb / 2, y: cy }, num[nd.id]));
      } else {
        out.push(h('rect', { key: K(), className: 'sd-key-leaf', x: x, y: cy - leafH / 2, width: leafW, height: leafH, style: { stroke: nd.color || undefined } }));
        out.push(h('path', { key: K(), className: 'sd-reg', d: regMarks(x, cy - leafH / 2, leafW, leafH, 4.5).props.d, style: { stroke: nd.color || undefined } }));
        out.push(h('text', { key: K(), className: 'sd-key-name', x: x + leafW / 2, y: cy - (nd.note ? 7 : 0) }, nd.name));
        if (nd.note) out.push(h('text', { key: K(), className: 'sd-key-note', x: x + leafW / 2, y: cy + 9 }, nd.note));
      }
    })(root);
    return h('g', { className: 'sd-key' }, out);
  }

  /* ================= Iceberg model (09) ================= */
  /* outline as [u, f]: u = fraction of the ice width; f = rows above (negative) or submerged depth 0..1 (+ past 1 for the keel) */
  var ICE_TIP = [[0.20, 0], [0.25, -0.30], [0.31, -0.42], [0.36, -0.70], [0.40, -0.84], [0.45, -0.66], [0.50, -0.74], [0.56, -0.93], [0.61, -0.80], [0.67, -0.52], [0.72, -0.38], [0.79, -0.14], [0.82, 0]];
  var ICE_KEEL_R = [[0.91, 0.08], [0.97, 0.24], [1.0, 0.42], [0.95, 0.58], [0.97, 0.70], [0.86, 0.84], [0.74, 0.95], [0.62, 1.04]];
  var ICE_KEEL_L = [[0.40, 1.06], [0.27, 0.96], [0.14, 0.86], [0.07, 0.72], [0.0, 0.52], [0.04, 0.36], [0.02, 0.22], [0.10, 0.07]];
  function iceSpan(P, y) {
    var xs = [];
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    return xs.length ? [Math.min.apply(null, xs), Math.max.apply(null, xs)] : null;
  }
  var ICEBERG_LEVELS = [
    { name: 'Events', label: 'React', questions: ['What just happened?'] },
    { name: 'Patterns / Trends', label: 'Anticipate', questions: ['What trends have there been over time?'] },
    { name: 'Underlying Structures', label: 'Design', questions: ['What has influenced the patterns?', 'What are the relationships between the parts?'] },
    { name: 'Mental Models', label: 'Transform', questions: ['What assumptions, beliefs and values hold the system in place?'] }];
  function Iceberg(p) {
    var lvN = p.levels === 3 ? 3 : (p.levels === 4 ? 4 : 0), src = p.sections && p.sections.length ? p.sections : ICEBERG_LEVELS;
    var secs = lvN ? ICEBERG_LEVELS.slice(0, lvN).map(function (d, i) { return Object.assign({}, d, src[i] || {}); }) : src;
    var X = p.x || 60, Y = p.y || 20, W = p.w || 760, rowH = p.rowH || 96, n = secs.length, fs = p.fontSize || 12.5;
    if (!n) return null;
    var out = [], k = 0, K = function () { return 'i' + (k++); }, clip = 'sd-ice-' + (++gid), set = p.colorSet;
    var textW = Math.max(150, W * 0.30), ix0 = X + textW + 8, ix1 = X + W - (p.labelW || 112), IW = ix1 - ix0;
    var waterY = Y + rowH, subH = (n - 1) * rowH, keelH = subH + rowH * 0.34, bottom = waterY + keelH + rowH * 0.2;
    var pt = function (q, under) { return [ix0 + q[0] * IW, under ? waterY + q[1] * keelH : waterY + q[1] * rowH]; };
    var P = ICE_TIP.map(function (q) { return pt(q, false); }).concat(n > 1 ? ICE_KEEL_R.concat(ICE_KEEL_L).map(function (q) { return pt(q, true); }) : [pt([0.6, 0.06], true), pt([0.4, 0.07], true)]);
    var poly = P.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    var skyTop = Y + Math.min(P.reduce(function (m, q) { return Math.min(m, q[1]); }, waterY) - Y, 0) - 8;
    if (p.sky !== false) out.push(h('rect', { key: K(), className: 'sd-ice-sky', x: X, y: skyTop, width: W, height: waterY - skyTop }));
    out.push(h('rect', { key: K(), className: 'sd-ice-sea', x: X, y: waterY, width: W, height: bottom - waterY }));
    if (p.waves !== false) {
      var wsp = iceSpan(P, waterY + 1) || [ix0, ix0], wv = '';
      /* wave marks in the open water between the text columns and the ice */
      [[waterY + 11, 0], [waterY + 25, 16]].forEach(function (r) {
        var yy = r[0], sp = iceSpan(P, yy) || wsp;
        [[ix0 - 4 + r[1], sp[0] - 12], [sp[1] + 12 + r[1], ix1 - 8]].forEach(function (g) {
          for (var wx = g[0]; wx + 28 <= g[1]; wx += 40) wv += 'M' + wx + ',' + yy + 'q7,-4 14,0t14,0';
        });
      });
      if (wv) out.push(h('path', { key: K(), className: 'sd-ice-wave', d: wv }));
    }
    out.push(h('defs', { key: K() }, h('clipPath', { id: clip }, h('polygon', { points: poly }))));
    out.push(h('g', { key: K(), clipPath: 'url(#' + clip + ')' }, secs.map(function (s, i) {
      var y0 = i === 0 ? Y - rowH : Y + i * rowH, hh = i === n - 1 ? bottom - y0 : (i === 0 ? 2 * rowH : rowH);
      var fill = s.color || (set ? 'var(--ice-' + set + '-' + (i % 5 + 1) + ')' : (i === 0 ? 'var(--ice-tip)' : 'var(--ice-body-' + Math.min(4, i) + ')'));
      return h('rect', { key: i, className: 'sd-ice-row', x: ix0 - 2, y: y0, width: IW + 4, height: hh, style: { fill: fill } });
    }), [
      /* facets: light catching the faces of the tip, and two seams in the keel */
      h('path', { key: 'f1', className: 'sd-ice-facet', d: 'M' + pt([0.40, -0.84])[0] + ',' + pt([0.40, -0.84])[1] + 'L' + pt([0.31, -0.36])[0] + ',' + pt([0.31, -0.36])[1] + 'L' + pt([0.27, 0])[0] + ',' + waterY }),
      h('path', { key: 'f2', className: 'sd-ice-facet', d: 'M' + pt([0.56, -0.93])[0] + ',' + pt([0.56, -0.93])[1] + 'L' + pt([0.71, -0.42])[0] + ',' + pt([0.71, -0.42])[1] + 'L' + pt([0.75, 0])[0] + ',' + waterY }),
      n > 2 ? h('path', { key: 'f3', className: 'sd-ice-seam', d: 'M' + pt([0.10, 0.07], true).join(',') + 'L' + pt([0.30, 0.40], true).join(',') + 'L' + pt([0.27, 0.96], true).join(',') }) : null,
      n > 2 ? h('path', { key: 'f4', className: 'sd-ice-seam', d: 'M' + pt([0.91, 0.08], true).join(',') + 'L' + pt([0.72, 0.46], true).join(',') + 'L' + pt([0.74, 0.95], true).join(',') }) : null
    ]));
    out.push(h('polygon', { key: K(), className: 'sd-ice-outline', points: poly }));
    out.push(h('path', { key: K(), className: 'sd-ice-water', d: 'M' + X + ',' + waterY + 'H' + (X + W) }));
    var nameFs = fs + 2.5, nameChars = Math.floor((textW - 30) / (nameFs * 0.66)), qChars = Math.floor((textW - 30) / (fs * 0.5));
    secs.forEach(function (s, i) {
      var names = wrapWords(String(s.name || 'Untitled').toUpperCase(), nameChars, 2);
      var qs = [].concat.apply([], (s.questions || []).map(function (q) { return wrapWords(q, qChars, 4); }));
      var blockH = names.length * (nameFs + 4) + 6 + qs.length * 15, top = Y + i * rowH + (rowH - blockH) / 2, cx = X + 26;
      names.forEach(function (ln, j) { out.push(h('text', { key: K(), className: 'sd-ice-name', x: cx, y: top + nameFs * 0.85 + j * (nameFs + 4), style: { fontSize: nameFs + 'px' } }, ln)); });
      qs.forEach(function (ln, j) { out.push(h('text', { key: K(), className: 'sd-ice-q', x: cx, y: top + names.length * (nameFs + 4) + 6 + fs * 0.8 + j * 15, style: { fontSize: fs + 'px' } }, ln)); });
      if (s.label) out.push(h('text', { key: K(), className: 'sd-ice-label', x: X + W - 14, y: Y + i * rowH + rowH / 2 }, String(s.label).toUpperCase()));
      /* answers wrap to the ice's width at this row, so they stay on the ice */
      var cy = i === 0 ? Y + rowH * 0.66 : Y + i * rowH + rowH / 2, sp = iceSpan(P, cy) || [ix0, ix1];
      var aChars = Math.max(8, Math.floor((sp[1] - sp[0] - 22) / (fs * 0.52)));
      var lines = [].concat.apply([], (s.answers || []).map(function (a) { return wrapWords(a, aChars, 3); }));
      var lh = fs + 4.5;
      lines.forEach(function (a, j) {
        out.push(h('text', { key: K(), className: 'sd-ice-answer', x: (sp[0] + sp[1]) / 2, y: cy + (j - (lines.length - 1) / 2) * lh, style: { fontSize: fs + 'px' } }, a));
      });
    });
    if (p.showLeverage !== false) {
      var ax = X - 34;
      out.push(h('path', { key: K(), className: 'sd-ice-lev', d: 'M' + ax + ',' + (Y + 4) + 'V' + (bottom - 10) }));
      out.push(h('path', { key: K(), className: 'sd-ice-levhead', d: 'M' + ax + ',' + bottom + 'l-6,-12h12z' }));
      out.push(h('text', { key: K(), className: 'sd-ice-levt', transform: 'translate(' + (ax - 15) + ',' + ((Y + bottom) / 2) + ') rotate(-90)' }, 'INCREASING LEVERAGE'));
    }
    if (p.showSeen !== false) {
      var lx = X + W + 18;
      out.push(h('path', { key: K(), className: 'sd-ice-seenrule', d: 'M' + lx + ',' + Y + 'V' + bottom }));
      out.push(h('text', { key: K(), className: 'sd-ice-seen', x: lx + 10, y: Y + rowH / 2 }, 'SEEN'));
      if (n > 1) out.push(h('text', { key: K(), className: 'sd-ice-seen', x: lx + 10, y: waterY + (bottom - waterY) / 2 }, 'UNSEEN'));
    }
    return h('g', { className: 'sd-iceberg' }, out);
  }

  /* ================= Legend ================= */
  function Swatch(it) {
    if (it.edge) {
      var t = HEAD[it.edge] ? it.edge : 'activate';
      return h('svg', { width: 36, height: 14, viewBox: '0 0 36 14', 'aria-hidden': 'true' }, h(Defs), h('g', { className: 'sd-edge sd-edge-' + t }, h('path', { className: 'sd-shaft', d: 'M2,7 L33,7', markerEnd: 'url(#' + HEAD[t] + ')' })));
    }
    if (it.cat) return h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true' }, h('rect', { width: 14, height: 14, style: { fill: 'var(--cat-' + it.cat + ')' } }));
    if (!it.role) return null;
    var sh = shapeOf({ role: it.role });
    return h('svg', { width: 30, height: 16, viewBox: '0 0 30 16', 'aria-hidden': 'true' }, h('g', { className: 'sd-node sd-' + sh + ' sd-role-' + it.role }, h('rect', { className: 'sd-shape', x: 1, y: 1, width: 28, height: 14, rx: sh === 'pill' ? 7 : 2 })));
  }
  function Legend(p) {
    var items = p.items || legendFor(p.edges);
    return h('ul', { className: 'sd-legend', 'aria-label': p.title || 'Legend' }, items.map(function (it, i) { return h('li', { key: i }, h(Swatch, it), h(Formula, null, it.label)); }));
  }

  /* ================= Figure ================= */
  function Figure(p) {
    var sheet = h('figure', { className: 'sd-figure' + fontClass(p.font) },
      (p.title || p.subtitle) ? h('div', null, p.title ? h('h3', { className: 'sd-figure-title' }, p.title) : null, p.subtitle ? h('p', { className: 'sd-figure-sub' }, p.subtitle) : null) : null,
      h('div', { className: 'sd-figure-body' }, p.children),
      p.legend ? h(Legend, Array.isArray(p.legend) ? { items: p.legend } : { edges: p.legend.edges }) : null,
      p.caption ? h('figcaption', { className: 'sd-caption' }, p.number != null ? h('b', null, 'Figure ' + p.number + '. ') : null, typeof p.caption === 'string' ? h(Formula, null, p.caption) : p.caption) : null);
    return p.blueprint ? h(Blueprint, null, sheet) : sheet;
  }

  var api = { Blueprint: Blueprint, ToolButton: ToolButton, Field: Field, Panel: Panel, FontPicker: FontPicker, Figure: Figure, Canvas: Canvas, Node: Node, Edge: Edge, Compartment: Compartment, Legend: Legend, Callout: Callout, ScaleBar: ScaleBar, GradientBar: GradientBar, SystemWheel: SystemWheel, Codebook: Codebook, PhyloTree: PhyloTree, FlowNode: FlowNode, FlowArrow: FlowArrow, FlowStage: FlowStage, ProductFlow: ProductFlow, PfdSymbol: PfdSymbol, PedigreeSymbol: PedigreeSymbol, Pedigree: Pedigree, FoodWeb: FoodWeb, PunnettSquare: PunnettSquare, EcoPyramid: EcoPyramid, DichotomousKey: DichotomousKey, Iceberg: Iceberg, Formula: Formula,
    ChemText: ChemText, chem: chem, port: port, nodeBox: nodeBox, legendFor: legendFor, colorAt: colorAt, FONTS: FONTS, ETYPES: ETYPES, PALETTES: PALETTES, WHEEL_EDGES: WHEEL_EDGES, WHEEL_ROLES: WHEEL_ROLES, sigMark: sigMark, wheelNumbers: wheelNumbers, parseNewick: parseNewick, ICONS: ICONS, iconSrc: iconSrc, ICON_ROLE: ICON_ROLE, GEO_TIME: GEO_TIME, punnett: punnett, FLOW_SHAPES: FLOW_SHAPES, ICEBERG_LEVELS: ICEBERG_LEVELS, PFD_KINDS: PFD_KINDS, PFD_EQUIP: PFD_EQUIP, PED_FLAGS: PED_FLAGS, WEB_BANDS: WEB_BANDS, PYR_LEVELS: PYR_LEVELS };
  window.SciDiagram = Object.assign(window.SciDiagram || {}, api);
})();
