// server/routes/api/alerts.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Alert = require('../../Alert'); // Make sure path is correct

// Add middleware to log all requests to this route
router.use((req, res, next) => {
  console.log(`[Alerts API] ${req.method} ${req.originalUrl}`);
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  next();
});

// @route   POST api/alerts
// @desc    Create a new SOS alert
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { userName, latitude, longitude, accuracy, message } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ msg: 'Location coordinates are required' });
    }
    
    const newAlert = new Alert({
      userName: userName || 'Anonymous User',
      location: {
        latitude,
        longitude,
        accuracy: accuracy || 0
      },
      message: message || 'Emergency! Need assistance!'
    });
    
    const alert = await newAlert.save();
    
    // Emit the new alert to all connected clients via Socket.io
    const io = req.app.get('io');
    io.emit('new-alert', alert);
    
    res.json(alert);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/alerts
// @desc    Get all alerts
// @access  Public (would be restricted in a real app)
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/alerts/:id
// @desc    Update alert status
// @access  Public (would be restricted in a real app)
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status value' });
    }
    
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!alert) {
      return res.status(404).json({ msg: 'Alert not found' });
    }
    
    // Emit the updated alert to all connected clients
    const io = req.app.get('io');
    io.emit('update-alert', alert);
    
    res.json(alert);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/alerts/:id
// @desc    Delete an alert
// @access  Public (would be restricted in a real app)
router.delete('/:id', async (req, res) => {
  try {
    // Log the ID being passed to debug potential issues
    console.log(`Attempting to delete alert with ID: ${req.params.id}`);
    
    // Check if ID is valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log('Invalid ObjectId format');
      return res.status(400).json({ msg: 'Invalid alert ID format' });
    }
    
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      console.log('Alert not found in database');
      return res.status(404).json({ msg: 'Alert not found' });
    }
    
    // Only allow deletion of resolved alerts
    if (alert.status !== 'resolved') {
      console.log(`Alert status is ${alert.status}, not resolved`);
      return res.status(400).json({ 
        msg: 'Only resolved alerts can be deleted' 
      });
    }
    
    // Delete the alert
    const result = await Alert.findByIdAndDelete(req.params.id);
    console.log('Delete result:', result);
    
    // Emit the deleted alert ID to all connected clients
    const io = req.app.get('io');
    io.emit('delete-alert', req.params.id);
    
    console.log('Alert deleted successfully and notification sent');
    res.json({ msg: 'Alert deleted successfully' });
  } catch (err) {
    console.error('Server error during alert deletion:', err.message);
    res.status(500).json({ 
      msg: 'Server Error', 
      error: err.message 
    });
  }
});

module.exports = router;