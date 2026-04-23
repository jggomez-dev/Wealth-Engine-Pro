import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function checkCache() {
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
  const doc = await db.collection('prices').doc('VTSAX').get();
  
  console.log(doc.data());
}

checkCache();
