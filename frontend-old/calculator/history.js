window.onload = async () => {
    const status = document.getElementById('status-msg');
    const container = document.getElementById('history-list');

    try {
        // 'credentials: include' is required for HttpOnly cookies
        const response = await fetch('/api/history', { credentials: 'include' });

        if (response.status === 401) {
            status.innerText = "Unauthorized. Please log in again.";
            return;
        }

        const history = await response.json();
        
        if (!history || history.length === 0) {
            status.innerText = "No calculations found in your history.";
            return;
        }

        status.innerText = ""; // Successfully loaded, hide the message
        container.innerHTML = ""; // Clear list for injection

        history.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'dash-card';
            card.innerHTML = `
                <h4>Calculation #${history.length - index}</h4>
                <p>Saved: ${new Date(item.timestamp).toLocaleDateString()}</p>
                <button class="btn-primary btn-sm">View Result</button>
            `;
            // Attach data to button
            card.querySelector('button').onclick = () => {
                localStorage.setItem('demoOutput', JSON.stringify(item.data.source_demo || {}));
                localStorage.setItem('Ucalculator', JSON.stringify(item.data.details));
                window.location.href = 'result.html';
            };
            container.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        if (status) status.innerText = "Failed to load history. Check server connection.";
    }
};