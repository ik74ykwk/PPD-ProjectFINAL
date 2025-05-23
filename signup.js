document.addEventListener('DOMContentLoaded', function () {
    
    const firebaseConfig = {
        apiKey: "AIzaSyCEXJsv9mQsQ87F5Q7qjz8phDJWDnx-eLE",
        authDomain: "saferoads-64787.firebaseapp.com",
        projectId: "saferoads-64787",
        storageBucket: "saferoads-64787.firebasestorage.app",
        messagingSenderId: "495431778480",
        appId: "1:495431778480:web:ac876e0c861ec8a0493b75",
        measurementId: "G-WR4LKWMKYK"
    };

    
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    const form = document.querySelector('.content');
    const googleSignBtn = document.getElementById('google-sign');


    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const firstName = form.querySelector('input[type="text"]:nth-of-type(1)').value.trim();
        const lastName = form.querySelector('input[type="text"]:nth-of-type(2)').value.trim();
        const email = form.querySelector('input[type="email"]').value.trim();
        const password = form.querySelector('input[type="password"]').value.trim();

        if (!firstName || !lastName || !email || !password) {
            alert('Please fill in all fields');
            return;
        }

        if (!validateEmail(email)) {
            alert('Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            alert('Password should be at least 6 characters long');
            return;
        }
        createAccount(firstName, lastName, email, password);
    });

    googleSignBtn.addEventListener('click', function (e) {
        e.preventDefault();
        signUpWithGoogle();
    });

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Create account with Firebase
    async function createAccount(firstName, lastName, email, password) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Store additional user info in Firestore
            await db.collection('users').doc(user.uid).set({
                firstName,
                lastName,
                email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(`Account created successfully for ${firstName} ${lastName}! Redirecting...`);
            window.location.href = 'finalmap.html';
            form.reset();
        } catch (error) {
            console.error('Error creating account:', error);
            alert(getErrorMessage(error));
        }
    }

    // Google sign-up function
    async function signUpWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            if (result.additionalUserInfo.isNewUser) {
                // Store user info in Firestore
                await db.collection('users').doc(user.uid).set({
                    firstName: user.displayName?.split(' ')[0] || '',
                    lastName: user.displayName?.split(' ')[1] || '',
                    email: user.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                window.location.href = 'finalmap.html';
            } else {
                window.location.href = 'finalmap.html';
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            alert(getErrorMessage(error));
        }
    }

    function getErrorMessage(error) {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'This email is already in use.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            case 'auth/popup-closed-by-user':
                return 'Google sign-in was canceled.';
            default:
                return 'An error occurred. Please try again.';
        }
    }
});
