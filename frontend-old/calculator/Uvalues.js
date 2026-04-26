const token = localStorage.getItem('token');

if (!token) {
    // If there is no token, redirect them back to the login page
    window.location.href = '../index.html'; 
}
window.onload = () => {
    try {
        const demoOutputString = localStorage.getItem('demoOutput');
        
        if (!demoOutputString) {
            throw new Error("Missing Local Storage data. Please start from the first page.");
        }

        const demoOutput = JSON.parse(demoOutputString);

        const walls = ['N', 'S', 'E', 'W'];
        const uCalculator = walls.map(w => ({
            Wall: `W(${w})`, 
            Rso: 0, 
            Rb: 0, 
            Rsi: 0.123, 
            Raa: 0,     
            U: 0
        }));

        const mat = demoOutput.wallMaterials;
        const Rb = (mat.outer.R || 0) + (mat.central.R || 0) + (mat.inner.R || 0);

        uCalculator.forEach(row => {
            const direction = row.Wall.match(/\((.*?)\)/)[1]; 
            const Rso = demoOutput.surfaceParams[direction].Rso || 0;

            row.Rso = Rso;
            row.Rb = parseFloat(Rb.toFixed(4));
            row.Raa = parseFloat((row.Rsi + row.Rb + row.Rso).toFixed(4));
            row.U = row.Raa > 0 ? parseFloat((1 / row.Raa).toFixed(4)) : 0;
        });

        localStorage.setItem('Ucalculator', JSON.stringify(uCalculator));

        const tbody = document.getElementById('results-body');
        uCalculator.forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${row.Wall}</strong></td>
                    <td>${row.Rso}</td>
                    <td>${row.Rb}</td>
                    <td>${row.Rsi}</td>
                    <td style="font-weight: bold;">${row.Raa.toFixed(4)}</td>
                    <td style="font-weight: bold; color: #4f46e5;">${row.U.toFixed(4)}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Calculation Error:", error);
        alert("Error calculating intermediate results: " + error.message);
    }
};