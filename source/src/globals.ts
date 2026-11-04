// The Scientific Diagram bundle is a classic script that reads window.React.
import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
(window as any).React = React;
(window as any).ReactDOM = { ...ReactDOM, createRoot };
