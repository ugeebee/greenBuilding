let finalDataPayload = null;

window.onload = () => {
    try {
        const demoDataStr = localStorage.getItem('demoOutput');
        const uCalcDataStr = localStorage.getItem('Ucalculator');

        if (!demoDataStr || !uCalcDataStr) {
            throw new Error("Missing Local Storage data. Please start from the first page.");
        }

        const demoData = JSON.parse(demoDataStr);
        const uCalcData = JSON.parse(uCalcDataStr);

        const l = demoData.room.length;
        const b = demoData.room.breadth;
        const h = demoData.room.height;
        const volume = l * b * h;
        const ori = demoData.room.orientation;
        
        let grossAreas = { N: 0, S: 0, E: 0, W: 0 };
        if (ori === 'NS') {
            grossAreas.E = grossAreas.W = l * h;
            grossAreas.N = grossAreas.S = b * h;
        } else {
            grossAreas.N = grossAreas.S = l * h;
            grossAreas.E = grossAreas.W = b * h;
        }

        let openingsArea = { N: 0, S: 0, E: 0, W: 0 };
        demoData.doors.forEach(d => openingsArea[d.wall] += d.area);
        demoData.windows.forEach(w => openingsArea[w.wall] += w.area);

        const tIn = demoData.temperatures.inside;
        const finalTable = [];

        let totalQci = 0;
        let totalQso = 0;
        let totalQsw = 0;

        function createRow(surfaceName, area, uValue, rso, wallKey, type, customSGF = null) {
            const qc = area * uValue;
            const params = demoData.surfaceParams[wallKey] || { G: 0, alpha: 0, SGF: 0, e: 0 };
            const tOut = demoData.temperatures.outdoor[wallKey] || tIn;
            const deltaT = tOut - tIn;
            const qci = qc * deltaT;

            totalQci += qci;
            
            let finalRso = (type === 'window' || type === 'floor') ? '-' : parseFloat((rso || 0).toFixed(4));
            let finalSGF = (type === 'window') ? (customSGF || 0) : '-'; 
            let finalE   = (type === 'roof') ? (params.e || 0) : '-';    

            let finalQsoi = '-';
            if (type !== 'window' && type !== 'floor') {
                if (type === 'roof') {
                    finalQsoi = qc * ((params.G * params.alpha) - params.e) * finalRso;
                } else {
                    finalQsoi = qc * params.G * params.alpha * finalRso;
                }
                totalQso += finalQsoi;
                finalQsoi = parseFloat(finalQsoi.toFixed(4));
            }

            let finalQswi = '-';
            if (type === 'window') {
                finalQswi = area * params.G * customSGF;
                totalQsw += finalQswi;
                finalQswi = parseFloat(finalQswi.toFixed(4));
            }

            return {
                Surface: surfaceName,
                A: parseFloat(area.toFixed(3)),
                U: parseFloat(uValue.toFixed(4)),
                qc: parseFloat(qc.toFixed(4)),
                Rso: finalRso,
                G: params.G || 0,
                alpha: params.alpha || 0,
                SGF: finalSGF,
                e: finalE,
                Qsoi: finalQsoi,
                Qswi: finalQswi,
                deltaT: parseFloat(deltaT.toFixed(2)),
                Qci: parseFloat(qci.toFixed(4))
            };
        }

        const walls = ['N', 'S', 'E', 'W'];
        walls.forEach(w => {
            const netArea = grossAreas[w] - openingsArea[w];
            const uData = uCalcData.find(item => item.Wall === `W(${w})`) || { U: 0, Rso: 0 };
            finalTable.push(createRow(`W(${w})`, netArea, uData.U, uData.Rso, w, 'wall'));
        });

        demoData.doors.forEach((door, index) => {
            const uValue = door.material.R > 0 ? (1 / door.material.R) : 0;
            const uData = uCalcData.find(item => item.Wall === `W(${door.wall})`) || { Rso: 0 };
            finalTable.push(createRow(`door(${index + 1}) [${door.wall}]`, door.area, uValue, uData.Rso, door.wall, 'door'));
        });

        demoData.windows.forEach((win, index) => {
            const uValue = win.R > 0 ? (1 / win.R) : 0;
            finalTable.push(createRow(`window ${win.wall} ${index + 1}`, win.area, uValue, 0, win.wall, 'window', win.SGF));
        });

        const floorArea = l * b;
        const floorU = demoData.floorMaterial.R > 0 ? (1 / demoData.floorMaterial.R) : 0;
        finalTable.push(createRow(`floor`, floorArea, floorU, 0, 'Floor', 'floor'));

        const roofArea = l * b;
        const roofU = demoData.roofMaterial.R > 0 ? (1 / demoData.roofMaterial.R) : 0;

        const roofRso = demoData.surfaceParams['Roof'] ? demoData.surfaceParams['Roof'].Rso : 0; 
        finalTable.push(createRow(`roof`, roofArea, roofU, roofRso, 'Roof', 'roof'));

        const tbody = document.getElementById('table-body');
        finalTable.forEach(row => {
            const formatCell = (val) => val === '-' ? `<td class="disabled-cell" style="color:#9ca3af;">-</td>` : `<td>${val}</td>`;

            tbody.innerHTML += `
                <tr>
                    <td style="text-align: left; font-weight: bold;">${row.Surface}</td>
                    <td>${row.A}</td>
                    <td>${row.U}</td>
                    <td>${row.qc}</td>
                    ${formatCell(row.Rso)}
                    <td>${row.G}</td>
                    <td>${row.alpha}</td>
                    ${formatCell(row.SGF)}
                    ${formatCell(row.e)}
                    ${formatCell(row.Qsoi)}
                    ${formatCell(row.Qswi)}
                    <td>${row.deltaT}</td>
                    <td style="font-weight: bold; color: #4f46e5;">${row.Qci}</td>
                </tr>
            `;
        });

        const outTemps = demoData.temperatures.outdoor;
        const tOutAvg = (outTemps.N + outTemps.S + outTemps.E + outTemps.W) / 4;
        const deltaTVent = tOutAvg - tIn;

        const qv = (1 / 3) * demoData.ACH * volume * deltaTVent;

        const summarySection = document.getElementById('summary-section');
        summarySection.innerHTML = `
            <div class="summary-card">
                <h4>Qc (Total Conduction)</h4>
                <p>${totalQci.toFixed(2)} W</p>
            </div>
            <div class="summary-card">
                <h4>Qso (Total Solar-Air)</h4>
                <p>${totalQso.toFixed(2)} W</p>
            </div>
            <div class="summary-card">
                <h4>Qsw (Total Solar Gain)</h4>
                <p>${totalQsw.toFixed(2)} W</p>
            </div>
            <div class="summary-card" style="border-color: #4f46e5; background-color: #eef2ff;">
                <h4 style="color: #4f46e5;">Qv (Ventilation Load)</h4>
                <p>${qv.toFixed(2)} W</p>
            </div>
        `;

        finalDataPayload = {
            details: finalTable,
            totals: {
                Qc: parseFloat(totalQci.toFixed(4)),
                Qso: parseFloat(totalQso.toFixed(4)),
                Qsw: parseFloat(totalQsw.toFixed(4)),
                Qv: parseFloat(qv.toFixed(4))
            }
        };

    } catch (error) {
        console.error("Error generating final table:", error);
        alert("Error generating table. Check console for details.");
    }
};

async function saveToServer() {
    if (!finalDataPayload) return alert("Data is not ready to be saved yet.");
    
    // Retrieve credentials for authentication
    const authToken = localStorage.getItem('token');
    const user = localStorage.getItem('username'); 

    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`, // Bearer token for AuthMiddleware
                'X-Username': user // Custom header to identify user for history pruning
            },
            body: JSON.stringify(finalDataPayload)
        });

        const result = await response.json();
        
        if (response.ok) { 
            alert("Success! History saved to EC2."); 
        } else { 
            alert("Server Error: " + (result.message || "Failed to save calculation.")); 
        }
    } catch (error) {
        console.error("Error sending data to server:", error);
        alert("Failed to connect to the server.");
    }
}