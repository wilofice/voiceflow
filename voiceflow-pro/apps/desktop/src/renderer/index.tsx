import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

// Ensure we have a root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  // Create root element if it doesn't exist
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
}

const root = createRoot(document.getElementById('root')!);
// Use React.createElement instead of JSX to avoid transpilation issues
root.render(React.createElement(App));