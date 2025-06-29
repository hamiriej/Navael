// src/components/AuthManager.tsx
'use client'; // This directive is crucial for client-side components in Next.js App Router

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase'; // Adjust this import path if your firebase.ts is elsewhere
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User // Type for Firebase User object
} from 'firebase/auth';

const AuthManager: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [loading, setLoading] = useState(true); // To indicate initial auth state check

  useEffect(() => {
    // This listener will automatically update `currentUser` when login state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false); // Auth state checked, no longer loading
    });

    // Clean up the subscription when the component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array means this runs once on mount

  const handleSignUp = async () => {
    try {
      if (!email || !password) {
        setAuthMessage('Please enter both email and password.');
        return;
      }
      if (password.length < 6) {
        setAuthMessage('Password must be at least 6 characters long.');
        return;
      }
      await createUserWithEmailAndPassword(auth, email, password);
      setAuthMessage('Account created successfully!');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error("Sign up error:", error.message);
      setAuthMessage(`Sign Up Error: ${error.message}`);
    }
  };

  const handleLogin = async () => {
    try {
      if (!email || !password) {
        setAuthMessage('Please enter both email and password.');
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
      setAuthMessage('Logged in successfully!');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error("Login error:", error.message);
      setAuthMessage(`Login Error: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthMessage('Logged out successfully.');
    } catch (error: any) {
      console.error("Logout error:", error.message);
      setAuthMessage(`Logout Error: ${error.message}`);
    }
  };

  if (loading) {
    return <p>Checking authentication status...</p>;
  }

  return (
    <div style={{ margin: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Firebase Authentication</h2>
      {authMessage && <p style={{ color: authMessage.includes('Error') ? 'red' : 'green' }}>{authMessage}</p>}

      {currentUser ? (
        <div>
          <p>Logged in as: <strong>{currentUser.email}</strong></p>
          <p>UID: {currentUser.uid}</p>
          <button onClick={handleLogout} style={{ padding: '10px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Log Out</button>

          <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <h3>HMS Dashboard Content</h3>
            <p>This is where your main hospital management system features will go, accessible only to logged-in users.</p>
            {/* Your actual app components would be rendered here */}
          </div>
        </div>
      ) : (
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '8px', marginBottom: '10px', width: '250px' }}
          />
          <br />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '8px', marginBottom: '10px', width: '250px' }}
          />
          <br />
          <button onClick={handleSignUp} style={{ padding: '10px 15px', marginRight: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Sign Up</button>
          <button onClick={handleLogin} style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Log In</button>
          <p style={{ marginTop: '15px', fontStyle: 'italic' }}>You can use any valid email (e.g., test@example.com) and a password of at least 6 characters.</p>
        </div>
      )}
    </div>
  );
};

export default AuthManager;
