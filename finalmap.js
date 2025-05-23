document.addEventListener("DOMContentLoaded", function () {
    // ==================== FIREBASE INITIALIZATION ====================
    const firebaseConfig = {
        apiKey: "AIzaSyCEXJsv9mQsQ87F5Q7qjz8phDJWDnx-eLE",
        authDomain: "saferoads-64787.firebaseapp.com",
        projectId: "saferoads-64787",
        storageBucket: "saferoads-64787.firebasestorage.app",
        messagingSenderId: "495431778480",
        appId: "1:495431778480:web:ac876e0c861ec8a0493b75",
        measurementId: "G-WR4LKWMKYK"
    };

    try {
        firebase.initializeApp(firebaseConfig);
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }

    const db = firebase.firestore();
    db.settings({ timestampsInSnapshots: true });

    // ==================== MAP INITIALIZATION ====================
    const icons = {
        'Traffic Jam': L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        }),
        'Bad Weather': L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        }),
        'Repairs': L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        }),
        'Accident': L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        })
    };

    let currentMarker = null;
    const map = L.map('map').setView([36.8065, 10.1815], 13);
    let savedReports = [];

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // ==================== MESSAGE DISPLAY ====================
    const messageContainer = document.createElement('div');
    messageContainer.id = 'message-container';
    messageContainer.style.position = 'fixed';
    messageContainer.style.top = '20px';
    messageContainer.style.left = '50%';
    messageContainer.style.transform = 'translateX(-50%)';
    messageContainer.style.zIndex = '9999';
    messageContainer.style.padding = '10px';
    messageContainer.style.background = '#000';
    messageContainer.style.color = '#fff';
    messageContainer.style.borderRadius = '8px';
    messageContainer.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0,2)';
    messageContainer.style.display = 'none';
    document.body.appendChild(messageContainer);

    function showMessage(msg) {
        messageContainer.innerText = msg;
        messageContainer.style.display = 'block';
        setTimeout(() => messageContainer.style.display = 'none', 3000);
    }

    // ==================== REPORT MANAGEMENT ====================
    function loadReports() {
        
        db.collection('reports').onSnapshot(
            (querySnapshot) => {
                savedReports = [];
                querySnapshot.forEach((doc) => {
                    const report = doc.data();

                    // (24-hour expiry)
                    const now = new Date();
                    const reportDate = report.timestamp.toDate();
                    const hoursDiff = (now - reportDate) / (1000 * 60 * 60);

                    if (hoursDiff >= 24) {
                        
                        db.collection('reports').doc(doc.id).delete();
                        return;
                    }

                    
                    if (report.notValid >= 3) {
                        db.collection('reports').doc(doc.id).delete();
                        return;
                    }

                    savedReports.push(report);
                });

            
                map.eachLayer(layer => {
                    if (layer instanceof L.Marker) {
                        map.removeLayer(layer);
                    }
                });

                savedReports.forEach(report => {
                    addReportToMap(report);
                });
                updateStats();
            },
            (error) => {
                console.error("Error loading reports:", error);
                showMessage("⚠️ Error loading reports. Trying again...");
                setTimeout(loadReports, 5000);
            }
        );
    }

    loadReports();

    function addReportToMap(report) {
        // Convert Firestore GeoPoint to Leaflet LatLng
        const latLng = report.coordinates instanceof firebase.firestore.GeoPoint
            ? L.latLng(report.coordinates.latitude, report.coordinates.longitude)
            : L.latLng(report.coordinates.lat, report.coordinates.lng);

        const marker = L.marker(latLng, { icon: icons[report.issueType] })
            .addTo(map)
            .bindPopup(createPopupContent(report));

        marker.reportId = report.id;

        marker.on('popupopen', function () {
            document.querySelectorAll('.vote-btn').forEach(btn => {
                btn.addEventListener('click', handleVote);
            });
        });
    }

    function createPopupContent(report) {
        return `
            <div class="popup-vote">
                <h4>${report.issueType}</h4>
                <p>${report.location}</p>
                <div class="vote-counts">
                    <span>Valid: ${report.valid || 0}</span>
                    <span>Not Valid: ${report.notValid || 0}</span>
                </div>
                <div class="vote-buttons">
                    <button class="vote-btn" data-report-id="${report.id}" data-vote-type="valid">Valid</button>
                    <button class="vote-btn" data-report-id="${report.id}" data-vote-type="notValid">Not Valid</button>
                </div>
            </div>
        `;
    }


    // ==================== VOTING SYSTEM ====================
    async function handleVote(e) {
        const button = e.target;
        const reportId = button.dataset.reportId;
        const voteType = button.dataset.voteType;

    
        button.disabled = true;

        try {
            
            let user = firebase.auth().currentUser;

            if (!user) {
                showMessage("⚠️ Please sign in to vote");
                button.disabled = false;
                return;
            }

            const userId = user.uid;
            console.log("Voting with user ID:", userId); // Debug log

            const reportRef = db.collection('reports').doc(reportId);
            const voteRef = db.collection('votes').doc(`${userId}_${reportId}`);

            
            await db.runTransaction(async (transaction) => {
                
                const reportDoc = await transaction.get(reportRef);
                const voteDoc = await transaction.get(voteRef);

                if (!reportDoc.exists) {
                    throw new Error("Report not found");
                }

                const currentVote = voteDoc.exists ? voteDoc.data().voteType : null;
                const reportData = reportDoc.data();
                const newValidCount = reportData.valid || 0;
                const newNotValidCount = reportData.notValid || 0;

                if (currentVote === voteType) {
                    
                    transaction.update(reportRef, {
                        [voteType]: firebase.firestore.FieldValue.increment(-1)
                    });
                    transaction.delete(voteRef);
                } else {
                    
                    if (currentVote) {
                        
                        transaction.update(reportRef, {
                            [currentVote]: firebase.firestore.FieldValue.increment(-1)
                        });
                    }

                    
                    transaction.update(reportRef, {
                        [voteType]: firebase.firestore.FieldValue.increment(1)
                    });

                    
                    transaction.set(voteRef, {
                        userId,
                        reportId,
                        voteType,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            
            showMessage(voteType === 'valid' ? "✅ Voted as valid" : "⚠️ Voted as not valid");

            // Check if report should be removed (notValid >= 3)
            const updatedReport = await reportRef.get();
            if (updatedReport.data().notValid >= 3) {
                try {
                    await reportRef.delete();
                    showMessage("❌ Report removed due to invalid votes");
                } catch (deleteError) {
                    console.error("Failed to delete report:", deleteError);
                    showMessage("⚠️ Couldn't remove invalid report");
                }
            }

        } catch (error) {
            console.error("Voting error:", error);
            if (error.code === 'permission-denied') {
                showMessage("⚠️ You don't have permission to vote");
            } else {
                showMessage("⚠️ Failed to register vote. Please try again");
            }
        } finally {
            button.disabled = false;
        }
    }

    // ==================== STATISTICS DISPLAY ====================
    function updateStats() {
        const counts = {};
        savedReports.forEach(r => {
            counts[r.issueType] = (counts[r.issueType] || 0) + 1;
        });

        let html = '';
        for (let type in counts) {
            html += `<div><strong>${type}</strong>: ${counts[type]}</div>`;
        }
        const statsElement = document.getElementById('stats-content');
        if (statsElement) {
            statsElement.innerHTML = html || 'No reports yet.';
        }
    }

    // ==================== LOCATION SEARCH FUNCTIONS ====================
    // location search function that can be used by both searches
    async function searchLocationGeneric(inputElement, centerMarker = true) {
        const query = inputElement.value.trim();
        if (!query || query.length < 3) {
            showMessage('⚠️ Please enter a valid address (at least 3 characters)');
            return;
        }

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
            const results = await response.json();

            if (results.length > 0) {
                const result = results[0];
                const center = [parseFloat(result.lat), parseFloat(result.lon)];

                // Only create a marker if centerMarker is true (when reporting)
                if (centerMarker) {
                    const issueType = document.getElementById('issue-type').value || 'Traffic Jam';
                    const selectedIcon = icons[issueType] || icons['Traffic Jam'];

                    if (currentMarker) map.removeLayer(currentMarker);

                    currentMarker = L.marker(center, { icon: selectedIcon })
                        .addTo(map)
                        .bindPopup(result.display_name)
                        .openPopup();

                    // If we're in the report form then update the location input
                    const locationInput = document.getElementById('location');
                    if (locationInput) {
                        locationInput.value = result.display_name;
                    }
                }

                map.setView(center, 15);
                inputElement.value = result.display_name;

                return result;
            } else {
                showMessage('⚠️ Location not found');
                return null;
            }
        } catch (error) {
            console.error('Search error:', error);
            showMessage('⚠️ Search error occurred');
            return null;
        }
    }

    // ==================== INITIAL VIEW LOCATION SEARCH ====================
    const initialLocationInput = document.getElementById('initial-location');
    const initialSearchButton = document.getElementById('initial-search-button');

    
    initialSearchButton.addEventListener('click', function () {
        searchLocationGeneric(initialLocationInput, false); // false means don't add a marker
    });

    
    initialLocationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocationGeneric(initialLocationInput, false);
            return false;
        }
    });

    // ==================== REPORT FORM LOCATION SEARCH ====================
    const locationInput = document.getElementById('location');
    const searchButton = document.getElementById('search-button');


    searchButton.addEventListener('click', function () {
        searchLocationGeneric(locationInput, true); // true means add a marker
    });

    
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocationGeneric(locationInput, true);
            return false;
        }
    });

    // ==================== UI EVENT HANDLERS ====================
    const showReportFormButton = document.getElementById('show-report-form');
    const backToMapButton = document.getElementById('back-to-map');
    const reportInitialView = document.getElementById('report-initial');
    const reportFormView = document.getElementById('report-form');

    showReportFormButton.addEventListener('click', function () {
        reportInitialView.style.display = 'none';
        reportFormView.style.display = 'block';

        // If location was searched in initial view, copy it to report form
        if (initialLocationInput.value) {
            locationInput.value = initialLocationInput.value;
        }
    });

    backToMapButton.addEventListener('click', function () {
        reportFormView.style.display = 'none';
        reportInitialView.style.display = 'block';
    });

    // ==================== MAP CLICK HANDLER ====================
    map.on('click', async (e) => {
        if (currentMarker) map.removeLayer(currentMarker);
        currentMarker = null;

        const issueType = document.getElementById('issue-type').value || 'Traffic Jam';
        const selectedIcon = icons[issueType] || icons['Traffic Jam'];

        currentMarker = L.marker(e.latlng, { icon: selectedIcon })
            .addTo(map)
            .bindPopup("Selected Location")
            .openPopup();

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}&format=json`);
            const result = await response.json();
            const locationName = result.display_name || "Unknown location";

            // Update both location inputs
            locationInput.value = locationName;
            initialLocationInput.value = locationName;
        } catch (error) {
            console.error('Reverse geocode error:', error);
        }
    });


    // ==================== REPORT SUBMISSION ====================
    document.getElementById('reportForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        const issueType = document.getElementById('issue-type').value;
        const location = document.getElementById('location').value;

        
        if (!issueType) {
            showMessage('⚠️ Please select a hazard type');
            return false;
        }

        if (!location) {
            showMessage('⚠️ Please enter a location');
            return false;
        }

        if (!currentMarker) {
            showMessage('⚠️ Please select a location on the map');
            return false;
        }

        const coordinates = currentMarker.getLatLng();

        const newReport = {
            id: Date.now().toString(),
            issueType,
            location,
            coordinates: new firebase.firestore.GeoPoint(coordinates.lat, coordinates.lng),
            valid: 0,
            notValid: 0,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: firebase.auth().currentUser?.uid
        };

        try {
            if (!firebase.apps.length) {
                throw new Error("Firebase not initialized");
            }

            await db.collection('reports').doc(newReport.id).set(newReport);



            document.getElementById('issue-type').value = '';
            locationInput.value = '';

            if (currentMarker) {
                map.removeLayer(currentMarker);
                currentMarker = null;
            }

            showMessage("✅ Report Submitted Successfully!");

            // Return to the initial view after submission
            reportFormView.style.display = 'none';
            reportInitialView.style.display = 'block';

        } catch (error) {
            console.error("Error submitting report:", error);

            if (error.code === 'permission-denied') {
                showMessage("⚠️ You don't have permission to submit reports");
            } else if (error.code === 'unavailable') {
                showMessage("⚠️ Network error. Please check your connection");
            } else {
                showMessage("⚠️ Failed to submit report. Please try again");
            }
        }

        return false;
    });

    
    updateStats();

});