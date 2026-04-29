import { db } from './src/services/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

async function debugFirestore() {
  console.log("--- DEBUG FIRESTORE ---");
  
  try {
    console.log("Fetching courses...");
    const coursesSnap = await getDocs(query(collection(db, "courses"), limit(5)));
    console.log("Courses found:", coursesSnap.size);
    coursesSnap.forEach(doc => {
      console.log("Course ID:", doc.id, "Data:", JSON.stringify(doc.data()).substring(0, 100));
    });

    console.log("Fetching users...");
    const usersSnap = await getDocs(query(collection(db, "users"), limit(5)));
    console.log("Users found:", usersSnap.size);
    usersSnap.forEach(doc => {
      console.log("User ID:", doc.id, "Data:", JSON.stringify(doc.data()).substring(0, 100));
    });

  } catch (error) {
    console.error("Debug Error:", error);
  }
}

debugFirestore();
