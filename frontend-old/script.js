const authForm = document.getElementById('auth-form');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const toggleLink = document.getElementById('toggle-link');
const toggleHint = document.getElementById('toggle-hint');
const messageEl = document.getElementById('message');

let isLoginMode = true;

const API_BASE_URL = '/api';

if (localStorage.getItem('token')) {
    window.location.href = 'dashboard.html';
}

toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    formTitle.innerText = isLoginMode ? 'Login' : 'Sign Up';
    submitBtn.innerText = isLoginMode ? 'Login' : 'Sign Up';
    toggleHint.innerText = isLoginMode ? "Don't have an account?" : "Already have an account?";
    toggleLink.innerText = isLoginMode ? "Sign up" : "Login";
    messageEl.innerText = '';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isLoginMode ? '/login' : '/signup';

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await response.json();
        } else {
            data = await response.text(); 
        }

        if (!response.ok) {
            messageEl.style.color = 'red';
            messageEl.innerText = data.message || (typeof data === 'string' ? data : 'An error occurred');
            return;
        }

        if (isLoginMode) {
            // Save token and physically redirect the browser
            localStorage.setItem('token', data.token || data);
            window.location.href = 'dashboard.html';
        } else {
            messageEl.style.color = 'green';
            messageEl.innerText = 'Signup successful! Please log in.';
            toggleLink.click(); // Switch to login view naturally
        }
    } catch (error) {
        console.error("Fetch Error:", error); // Logs the exact issue to your F12 console
        messageEl.style.color = 'red';
        messageEl.innerText = 'Failed to connect to the server. Check the F12 Console.';
    }
});