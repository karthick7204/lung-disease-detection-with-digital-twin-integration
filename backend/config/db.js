import mongoose from 'mongoose';

let memoryServer = null;

function sanitizeUri(uri) {
  if (!uri) return 'undefined';
  return uri.replace(
    /\/\/([^:]+):([^@]+)@/,
    (match, user) => `//${user}:******@`
  );
}

/**
 * Establishes MongoDB connection with automatic fallback.
 * If Atlas connection drops or encounters SSL/whitelist errors,
 * it automatically switches to an in-memory development database.
 */
export async function connectDB() {
  let uri = process.env.MONGODB_URI;
  const forceLocal = process.env.USE_LOCAL_DB === 'true';
  const isPlaceholder = !uri || uri.includes('<username>') || uri.includes('<password>');

  mongoose.connection.on('connected', () => {
    console.log(`✅ MongoDB connected successfully`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected.');
  });

  if (!forceLocal && !isPlaceholder) {
    try {
      console.log(`📡 Connecting to MongoDB Atlas (${sanitizeUri(uri)})...`);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.warn(`⚠️ Could not connect to MongoDB Atlas (${error.message}).`);
      console.log(`🔄 Switching to in-memory MongoDB development database...`);
    }
  }

  // Fallback to fast, reliable in-memory MongoDB
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'lungtwin',
        },
      });
    }
    const memUri = memoryServer.getUri();
    const conn = await mongoose.connect(memUri);
    console.log(`✅ In-Memory MongoDB connected for development at: ${memUri}`);
    return conn;
  } catch (memError) {
    console.error('❌ Failed to launch in-memory MongoDB fallback:', memError.message);
    return null;
  }
}

export async function closeDB() {
  try {
    await mongoose.connection.close();
    if (memoryServer) {
      await memoryServer.stop();
    }
    console.log('MongoDB connection closed cleanly due to app termination');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
  }
}
