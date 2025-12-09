// Firebase Statistics Module

let db;
let isFirebaseInitialized = false;

function initFirebase() {
    if (isFirebaseInitialized) return true;

    if (!window.firebase || !window.firebase.firestore) {
        console.error("Firebase libraries not loaded.");
        return false;
    }

    if (!window.firebaseConfig || window.firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
        console.warn("Firebase config is missing or using placeholders. Stats will not be tracked.");
        return false;
    }

    try {
        firebase.initializeApp(window.firebaseConfig);
        db = firebase.firestore();
        isFirebaseInitialized = true;
        console.log("Firebase initialized successfully.");
        return true;
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        return false;
    }
}

/**
 * Increment the match count for a specific metaphysical system.
 * Uses a transaction to safely increment the counter.
 * @param {string} systemName - The name of the system (e.g., "Stoicism")
 */
async function incrementSystemCount(systemName) {
    if (!initFirebase()) return;

    // Use a clean ID for the document
    const docId = systemName.toLowerCase().replace(/\s+/g, '-');
    const docRef = db.collection('system_stats').doc(docId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
                // Create if it doesn't exist
                transaction.set(docRef, { name: systemName, count: 1 });
            } else {
                // Increment
                const newCount = (doc.data().count || 0) + 1;
                transaction.update(docRef, { count: newCount });
            }
        });
        console.log(`Updated stats for ${systemName}`);
    } catch (error) {
        console.error("Error updating stats:", error);
    }
}

/**
 * Fetch counts for all systems.
 * @returns {Promise<Object>} Object mapping system names to counts, e.g. { "Stoicism": 10, "Idealism": 5 }
 */
async function getSystemStats() {
    if (!initFirebase()) return {};

    try {
        const snapshot = await db.collection('system_stats').get();
        const stats = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            // Use the stored name for display, or capitalize the ID if name missing
            const name = data.name || doc.id;
            stats[name] = data.count || 0;
        });

        return stats;
    } catch (error) {
        console.error("Error fetching stats:", error);
        return {};
    }
}

// Expose functions to global scope
window.initFirebase = initFirebase;
window.incrementSystemCount = incrementSystemCount;
window.getSystemStats = getSystemStats;
