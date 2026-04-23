import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function clearCache() {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) return console.log("No key");
  
  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
    });
  }
  
  let databaseId = undefined;
  try {
    const configData = fs.readFileSync('firebase-applet-config.json', 'utf8');
    databaseId = JSON.parse(configData).firestoreDatabaseId;
  } catch (e) {}

  const db = getFirestore(databaseId);
  const snapshot = await db.collection('prices').get();
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    console.log("Deleting cached price:", doc.id, doc.data());
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log("Cleared all cached prices.");
}

clearCache();
