import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import axios from 'axios';
import { io } from 'socket.io-client';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const center = {
  lat: 40.7128, // Default latitude (e.g., NYC)
  lng: -74.0060, // Default longitude (e.g., NYC)
};

const libraries = ['places', 'directions'];

const AdminPanel = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState({ show: false, message: '', type: '' });
  const [confirmDelete, setConfirmDelete] = useState({ show: false, alertId: null });
  const [currentPosition, setCurrentPosition] = useState(null);
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [showDirections, setShowDirections] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    // Get the current position of the admin
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error getting current position:', error);
      }
    );

    // Fetch all alerts when component mounts
    const fetchAlerts = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/alerts');
        setAlerts(res.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching alerts:', error);
        setLoading(false);
      }
    };

    fetchAlerts();

    // Set up Socket.io for real-time updates
    const socket = io('http://localhost:5000');

    socket.on('new-alert', (newAlert) => {
      setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
    });

    socket.on('update-alert', (updatedAlert) => {
      setAlerts((prevAlerts) =>
        prevAlerts.map((alert) =>
          alert._id === updatedAlert._id ? updatedAlert : alert
        )
      );
    });

    socket.on('delete-alert', (deletedAlertId) => {
      setAlerts((prevAlerts) => 
        prevAlerts.filter((alert) => alert._id !== deletedAlertId)
      );
      
      // If the deleted alert is currently selected, deselect it
      if (selectedAlert && selectedAlert._id === deletedAlertId) {
        setSelectedAlert(null);
      }
    });

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('disconnect', (reason) => {
      console.error('Disconnected from server:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedAlert]);

  useEffect(() => {
    // Calculate directions when selectedAlert or currentPosition changes
    if (selectedAlert && currentPosition && showDirections) {
      calculateRoute();
    } else if (!showDirections) {
      setDirections(null);
      setDistance(null);
      setDuration(null);
    }
  }, [selectedAlert, currentPosition, showDirections]);

  const calculateRoute = () => {
    if (!window.google) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: currentPosition,
        destination: {
          lat: selectedAlert.location.latitude,
          lng: selectedAlert.location.longitude,
        },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          
          // Extract distance and duration information
          const route = result.routes[0];
          const leg = route.legs[0];
          setDistance(leg.distance.text);
          setDuration(leg.duration.text);
        } else {
          console.error(`Directions request failed: ${status}`);
        }
      }
    );
  };

  const updateAlertStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:5000/api/alerts/${id}`, { status });
    } catch (error) {
      console.error('Error updating alert status:', error);
    }
  };

  // Show confirmation dialog
  const showDeleteConfirmation = (id) => {
    setConfirmDelete({ show: true, alertId: id });
  };

  // Cancel delete
  const cancelDelete = () => {
    setConfirmDelete({ show: false, alertId: null });
  };

  // Show directions to the user
  const toggleDirections = () => {
    setShowDirections(!showDirections);
  };

  // Open Google Maps with directions
  const openInGoogleMaps = () => {
    if (selectedAlert && currentPosition) {
      const userLat = selectedAlert.location.latitude;
      const userLng = selectedAlert.location.longitude;
      const adminLat = currentPosition.lat;
      const adminLng = currentPosition.lng;
      
      const url = `https://www.google.com/maps/dir/?api=1&origin=${adminLat},${adminLng}&destination=${userLat},${userLng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  };

  // Zoom to fit both the admin's position and the selected alert
  const zoomToFitRoute = () => {
    if (!mapRef.current || !selectedAlert || !currentPosition) return;
    
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(currentPosition);
    bounds.extend({
      lat: selectedAlert.location.latitude,
      lng: selectedAlert.location.longitude
    });
    
    mapRef.current.fitBounds(bounds);
  };

  // Confirm and execute delete
  const confirmDeleteAlert = async () => {
    const id = confirmDelete.alertId;
    if (!id) return;
    
    try {
      // Log the full URL for debugging
      const deleteUrl = `http://localhost:5000/api/alerts/${id}`;
      console.log('Deleting alert with URL:', deleteUrl);
      
      // Try with fetch first for better error handling
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Log the response status
      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response text:', errorText);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Delete successful, server response:', data);
      
      // Update local state to remove the alert
      setAlerts(prevAlerts => prevAlerts.filter(alert => alert._id !== id));
      
      // If deleted alert was selected, deselect it
      if (selectedAlert && selectedAlert._id === id) {
        setSelectedAlert(null);
      }
      
      setDeleteStatus({
        show: true,
        message: 'Alert deleted successfully',
        type: 'success'
      });
      
      // Close the confirmation dialog
      setConfirmDelete({ show: false, alertId: null });
      
      // Auto-hide the status message after 3 seconds
      setTimeout(() => {
        setDeleteStatus({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Error deleting alert:', error);
      
      setDeleteStatus({
        show: true,
        message: `Error deleting alert: ${error.message}`,
        type: 'error'
      });
      
      // Close the confirmation dialog
      setConfirmDelete({ show: false, alertId: null });
      
      // Auto-hide the status message after 3 seconds
      setTimeout(() => {
        setDeleteStatus({ show: false, message: '', type: '' });
      }, 3000);
    }
  };

  if (loading) {
    return <div>Loading alerts...</div>;
  }

  return (
    <div className="admin-panel">
      <h1>Emergency Alerts Dashboard</h1>

      {deleteStatus.show && (
        <div className={`status-message ${deleteStatus.type}`}>
          {deleteStatus.message}
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {confirmDelete.show && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <h3>Delete Alert</h3>
            <p>Are you sure you want to delete this alert? This action cannot be undone.</p>
            <div className="delete-modal-buttons">
              <button 
                className="cancel-btn" 
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-btn" 
                onClick={confirmDeleteAlert}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-layout">
        {/* Map View */}
        <div className="map-container">
          <LoadScript 
            googleMapsApiKey="AIzaSyCf4j40ugggMoTjxiJI1DceQA4eSHOxY5A"
            libraries={libraries}
          >
            {window.google ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={10}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
              >
                {/* Show directions if requested */}
                {directions && showDirections && (
                  <DirectionsRenderer
                    directions={directions}
                    options={{
                      polylineOptions: {
                        strokeColor: '#2E86C1',
                        strokeWeight: 5,
                      },
                    }}
                  />
                )}
                
                {/* Show admin's current position */}
                {currentPosition && (
                  <Marker
                    position={currentPosition}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE || '',
                      fillColor: '#2E86C1',
                      fillOpacity: 1,
                      strokeColor: '#2874A6',
                      strokeWeight: 2,
                      scale: 8,
                    }}
                  />
                )}

                {/* Show all alerts */}
                {alerts.map((alert) => (
                  <Marker
                    key={alert._id}
                    position={{
                      lat: alert.location.latitude,
                      lng: alert.location.longitude,
                    }}
                    onClick={() => {
                      setSelectedAlert(alert);
                      if (mapRef.current) {
                        mapRef.current.panTo({
                          lat: alert.location.latitude,
                          lng: alert.location.longitude,
                        });
                      }
                    }}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE || '',
                      fillColor:
                        alert.status === 'active'
                          ? 'red'
                          : alert.status === 'acknowledged'
                          ? 'orange'
                          : 'green',
                      fillOpacity: 0.6,
                      strokeColor:
                        alert.status === 'active'
                          ? 'red'
                          : alert.status === 'acknowledged'
                          ? 'orange'
                          : 'green',
                      strokeWeight: 2,
                      scale: 10,
                    }}
                  />
                ))}

                {/* Information window for selected alert */}
                {selectedAlert && (
                  <InfoWindow
                    position={{
                      lat: selectedAlert.location.latitude,
                      lng: selectedAlert.location.longitude,
                    }}
                    onCloseClick={() => {
                      setSelectedAlert(null);
                      setShowDirections(false);
                    }}
                  >
                    <div style={{ maxWidth: '300px', padding: '5px' }}>
                      <h3 style={{ margin: '0 0 5px 0' }}>{selectedAlert.userName}</h3>
                      <p style={{ margin: '0 0 5px 0' }}>{selectedAlert.message}</p>
                      <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                        {new Date(selectedAlert.createdAt).toLocaleString()}
                      </p>
                      <p
                        style={{
                          margin: '5px 0 0 0',
                          fontWeight: 'bold',
                          textTransform: 'capitalize',
                        }}
                      >
                        Status: {selectedAlert.status}
                      </p>
                      
                      {/* Location details */}
                      <div style={{ margin: '10px 0' }}>
                        <p style={{ margin: '0', fontSize: '12px' }}>
                          <strong>Location:</strong> {selectedAlert.location.latitude.toFixed(6)},{' '}
                          {selectedAlert.location.longitude.toFixed(6)}
                        </p>
                        {distance && showDirections && (
                          <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>
                            <strong>Distance:</strong> {distance} ({duration} driving)
                          </p>
                        )}
                      </div>
                      
                      {/* Navigation controls */}
                      <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDirections();
                            zoomToFitRoute();
                          }}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: showDirections ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {showDirections ? 'Hide Route' : 'Show Route'}
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInGoogleMaps();
                          }}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Open in Maps
                        </button>
                      </div>
                      
                      {/* Delete button for resolved alerts */}
                      {selectedAlert.status === 'resolved' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showDeleteConfirmation(selectedAlert._id);
                          }}
                          style={{
                            marginTop: '10px',
                            padding: '5px 10px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          Delete Alert
                        </button>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            ) : (
              <div>Loading Google Maps...</div>
            )}
          </LoadScript>
        </div>

        {/* Alerts List */}
        <div className="alerts-container">
          <h2>Recent Alerts</h2>

          {alerts.length === 0 ? (
            <p>No alerts found.</p>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`alert-card ${alert.status}`}
                  onClick={() => {
                    setSelectedAlert(alert);
                    if (mapRef.current) {
                      mapRef.current.panTo({
                        lat: alert.location.latitude,
                        lng: alert.location.longitude,
                      });
                    }
                  }}
                >
                  <div className="alert-header">
                    <h3>{alert.userName}</h3>
                    <span className="date">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="message">{alert.message}</p>

                  <div className="location-details">
                    <p>
                      Location: {alert.location.latitude.toFixed(6)},{' '}
                      {alert.location.longitude.toFixed(6)}
                      {alert.location.accuracy &&
                        ` (Accuracy: ${alert.location.accuracy.toFixed(1)}m)`}
                    </p>
                    
                    {/* Show distance if this alert is selected and directions are visible */}
                    {selectedAlert && 
                     selectedAlert._id === alert._id && 
                     distance && 
                     showDirections && (
                      <p className="distance-info">
                        <strong>Distance:</strong> {distance} ({duration} away)
                      </p>
                    )}
                  </div>

                  <div className="status-controls">
                    <span className="status-label">Status: {alert.status}</span>
                    
                    {/* Navigation buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlert(alert);
                        setShowDirections(true);
                        zoomToFitRoute();
                      }}
                      className="nav-btn route"
                    >
                      Get Directions
                    </button>
                    
                    {/* Status update buttons */}
                    {alert.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAlertStatus(alert._id, 'acknowledged');
                        }}
                        className="status-btn acknowledge"
                      >
                        Acknowledge
                      </button>
                    )}
                    {(alert.status === 'active' ||
                      alert.status === 'acknowledged') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAlertStatus(alert._id, 'resolved');
                        }}
                        className="status-btn resolve"
                      >
                        Resolve
                      </button>
                    )}
                    {alert.status === 'resolved' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showDeleteConfirmation(alert._id);
                        }}
                        className="status-btn delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;