// server/models/Alert.js
const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  userName: {
    type: String,
    default: 'Anonymous User'
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    accuracy: {
      type: Number
    }
  },
  message: {
    type: String,
    default: 'Emergency! Need assistance!'
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Alert', AlertSchema);