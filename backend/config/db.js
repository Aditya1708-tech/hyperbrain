import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    return true;
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hyperbrain';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    return true;
  } catch (error) {
    console.warn(`[MongoDB] Warning: Could not connect to MongoDB at ${mongoURI}.`);
    console.warn(`[MongoDB] Reason: ${error.message}`);
    console.warn(`[MongoDB] Express server will continue running. Operations requiring MongoDB will retry or fallback.`);
    
    // Auto-retry in background every 10 seconds without crashing
    setTimeout(() => {
      console.log('[MongoDB] Retrying connection...');
      connectDB().catch(() => {});
    }, 10000);

    return false;
  }
};

export const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    isConnected: mongoose.connection.readyState === 1
  };
};

export default connectDB;
