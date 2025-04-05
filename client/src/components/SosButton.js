import React, { useState } from 'react';
import axios from 'axios';

const SosButton = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [alertSent, setAlertSent] = useState(false);

  const sendSOS = async () => {
    if (loading) return;
    
    setLoading(true);
    setAlertSent(false);
    
    try {
      // Get user's location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Send alert to the server
          await axios.post('http://localhost:5000/api/alerts', {
            userName,
            latitude,
            longitude,
            accuracy,
            message: message || undefined
          });
          
          setAlertSent(true);
          setLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Could not get your location. Please enable location services.');
          setLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } catch (error) {
      console.error('Error sending SOS:', error);
      alert('Failed to send SOS alert. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="sos-container">
      <h1>Emergency SOS</h1>
      
      <div className="form-group">
        <label>Your Name (Optional)</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your name"
        />
      </div>
      
      <div className="form-group">
        <label>Emergency Message (Optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your emergency (optional)"
        />
      </div>
      
      <button
        className={`sos-button ${loading ? 'loading' : ''}`}
        onClick={sendSOS}
        disabled={loading}
      >
        {loading ? 'Sending...' : 'SOS'}
      </button>
      
      {alertSent && (
        <div className="alert-success">
          SOS alert sent successfully! Help is on the way.
        </div>
      )}
      
      <p className="note">
        Note: This will send your current location to the emergency response team.
      </p>
    </div>
  );
};

export default SosButton;
