import React from 'react';

export default function TestApp() {
  console.log('TestApp component is rendering!');
  
  React.useEffect(() => {
    console.log('TestApp mounted successfully!');
    document.title = 'TestApp - VoiceFlow Pro';
  }, []);

  return (
    <div style={{ 
      background: '#1e293b', 
      color: 'white', 
      height: '100vh', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>✅ Test React App Working!</h1>
      <p>If you can see this, React is working perfectly!</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
      <button onClick={() => {
        alert('Button clicked!');
        console.log('Button was clicked successfully!');
      }}>
        Test Button
      </button>
    </div>
  );
}