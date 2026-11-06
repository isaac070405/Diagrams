import './globals';
import './ds/bundle.js';
import './lib/xyaxis.js';
import './lib/contour.js';
import './lib/kite.js';
import './ds/tokens.css';
import './ds/bundle.css';
import './app.css';
import { createRoot } from 'react-dom/client';
import App from './App';

const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = 'https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@400;600&display=swap';
document.head.appendChild(fonts);

createRoot(document.getElementById('root')!).render(<App />);
