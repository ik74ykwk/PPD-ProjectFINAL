// Initialize Firebase
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

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.querySelector('.content');
    const googleSignBtn = document.getElementById('google-sign');

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = loginForm.querySelector('input[type="email"]').value.trim();
        const password = loginForm.querySelector('input[type="password"]').value.trim();
        if (!email || !password) {
            alert('Please fill in both email and password');
            return;
        }

        if (!validateEmail(email)) {
            alert('Please enter a valid email address');
            return;
        }

        // Firebase email/password authentication
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                window.location.href = 'finalmap.html';
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(`Login error: ${errorMessage}`);
            });
    });
    googleSignBtn.addEventListener('click', function (e) {
        e.preventDefault();
        signInWithGoogle();
    });

    
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();

        auth.signInWithPopup(provider)
            .then((result) => {
                window.location.href = 'finalmap.html';
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(`Google sign-in error: ${errorMessage}`);
            });
    }
});
