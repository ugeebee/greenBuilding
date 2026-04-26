const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '../index.html'; 
}
let currentPage = 1;
const totalPages = 4;

const surfaces = ['N', 'S', 'E', 'W', 'Roof'];
const walls = ['N', 'S', 'E', 'W'];
let wallAreas = { N: 0, S: 0, E: 0, W: 0 };

let materialDatabase = [];
let windowDatabase = [];
let sheet2Database = [];

window.onload = async () => {
    generateEnvironmentInputs();
    generateSurfaceParameters(); 
    
    try {
        const [matRes, sheet2Res, sheet3Res, winRes] = await Promise.all([
            fetch('GreenBuildingData_Sheet1.json'),
            fetch('GreenBuildingData_Sheet2.json'),
            fetch('GreenBuildingData_Sheet3.json'),
            fetch('GreenBuildingData_Sheet4.json')
        ]);

        if (!matRes.ok || !sheet2Res.ok || !sheet3Res.ok || !winRes.ok) {
            throw new Error("Failed to load reference JSON databases.Reload");
        }
        
        const matData = await matRes.json();
        const sheet2Data = await sheet2Res.json();
        const sheet3Data = await sheet3Res.json();
        const winData = await winRes.json();

        localStorage.setItem('sheet_materials', JSON.stringify(matData));
        localStorage.setItem('sheet_2', JSON.stringify(sheet2Data));
        localStorage.setItem('sheet_3', JSON.stringify(sheet3Data));
        localStorage.setItem('sheet_windows', JSON.stringify(winData));
        
        materialDatabase = matData;
        windowDatabase = winData;
        sheet2Database = sheet2Data;
        
        populateMaterialDropdowns(); 
        populateSheet2Dropdowns();

    } catch (error) {
        console.error("Database load error:", error);
        alert("Failed to load reference JSON databases.Reload");
    }
};

function convertToMeters(value, unit) {
    const num = parseFloat(value) || 0;
    if (unit === 'mm') return num / 1000;
    if (unit === 'ft') return num * 0.3048;
    return num; 
}

function changePage(direction) {
    if (direction === 1 && !validateCurrentPage()) return;
    if (currentPage === 1 && direction === 1) calculateWallAreas();
    if (currentPage === 2 && direction === 1 && !validateOpeningsArea()) return;

    document.getElementById(`page-${currentPage}`).classList.remove('active');
    currentPage += direction;
    document.getElementById(`page-${currentPage}`).classList.add('active');

    document.getElementById('progress-text').innerText = `Step ${currentPage} of ${totalPages}`;
    document.getElementById('progress-fill').style.width = `${(currentPage / totalPages) * 100}%`;
    document.getElementById('btn-prev').style.display = currentPage === 1 ? 'none' : 'block';
    if (currentPage === totalPages) {
        document.getElementById('btn-next').innerText = "Calculate Results";
        document.getElementById('btn-next').onclick = generateJSON; 
    } else {
        document.getElementById('btn-next').innerText = "Next Step";
        document.getElementById('btn-next').onclick = () => changePage(1); 
    }
}

function validateCurrentPage() {
    if (currentPage === 1) {
        const l = document.getElementById('length').value;
        const b = document.getElementById('breadth').value;
        const h = document.getElementById('height').value;
        if (!l || !b || !h) {
            alert("Please fill in Length, Breadth, and Height.");
            return false;
        }
    }
    return true;
}

function calculateWallAreas() {
    const l = convertToMeters(document.getElementById('length').value, document.getElementById('unit-length').value);
    const b = convertToMeters(document.getElementById('breadth').value, document.getElementById('unit-breadth').value);
    const h = convertToMeters(document.getElementById('height').value, document.getElementById('unit-height').value);

    wallAreas.N = wallAreas.S = l * h;
    wallAreas.E = wallAreas.W = b * h;

    document.getElementById('area-warning').innerText = 
        `Available Area (m²) - N: ${wallAreas.N.toFixed(2)}, S: ${wallAreas.S.toFixed(2)}, E: ${wallAreas.E.toFixed(2)}, W: ${wallAreas.W.toFixed(2)}`;
}

function populateMaterialDropdowns() {
    const selects = document.querySelectorAll('.mat-select');
    let optionsHTML = '<option value="">Select a standard material...</option>';
    materialDatabase.forEach(mat => {
        optionsHTML += `<option value="${mat.Material}" data-k="${mat['Thermal Conductivity  ']}">${mat.Material} (k = ${mat['Thermal Conductivity  ']})</option>`;
    });
    selects.forEach(sel => sel.innerHTML = optionsHTML);
}

function populateSheet2Dropdowns() {
    const selects = document.querySelectorAll('.sheet2-select');
    let optionsHTML = '<option value="0">Select Exposure (from Sheet 2)...</option>';
    sheet2Database.forEach(item => {
        optionsHTML += `<option value="${item['Resistance ']}">${item.Surface} (Rso = ${item['Resistance ']})</option>`;
    });
    selects.forEach(sel => sel.innerHTML = optionsHTML);
}

function toggleMatType(id) {
    const val = document.querySelector(`input[name="type-${id}"]:checked`).value;
    ['std', 'cust', 'cust-wk', 'cust-u'].forEach(type => {
        const el = document.getElementById(`${type}-${id}`);
        if (el) el.style.display = 'none';
    });
    
    if (val === 'standard' && document.getElementById(`std-${id}`)) document.getElementById(`std-${id}`).style.display = 'flex';
    if (val === 'custom' && document.getElementById(`cust-${id}`)) document.getElementById(`cust-${id}`).style.display = 'flex';
    if (val === 'custom_wk' && document.getElementById(`cust-wk-${id}`)) document.getElementById(`cust-wk-${id}`).style.display = 'flex';
    if (val === 'custom_u' && document.getElementById(`cust-u-${id}`)) document.getElementById(`cust-u-${id}`).style.display = 'flex';
}

function getMaterialData(id) {
    const checkedVal = document.querySelector(`input[name="type-${id}"]:checked`).value;
    let name = "", rValue = 0;

    if (checkedVal === 'standard') {
        const sel = document.getElementById(`sel-${id}`);
        const opt = sel.options[sel.selectedIndex];
        name = sel.value;
        const w = parseFloat(document.getElementById(`width-std-${id}`).value) || 0;
        const k = opt && opt.dataset.k ? parseFloat(opt.dataset.k) : 0;
        rValue = (k !== 0) ? (w / k) : 0;
    } 
    else if (checkedVal === 'custom' || checkedVal === 'custom_wk') {
        const p = checkedVal === 'custom' ? 'cust' : 'cust-wk';
        name = document.getElementById(`name-${p}-${id}`).value || "Custom Material";
        const w = parseFloat(document.getElementById(`width-${p}-${id}`).value) || 0;
        const k = parseFloat(document.getElementById(`k-${p}-${id}`).value) || 0;
        rValue = (k !== 0) ? (w / k) : 0;
    } 
    else if (checkedVal === 'custom_u') {
        name = document.getElementById(`name-cust-u-${id}`).value || "Custom Material";
        const u = parseFloat(document.getElementById(`u-cust-u-${id}`).value) || 0;
        rValue = (u !== 0) ? (1 / u) : 0;
    }

    return { type: checkedVal.includes('custom') ? "custom" : "standard", name: name, R: parseFloat(rValue.toFixed(4)) };
}

function addOpening(type) {
    const container = document.getElementById(`${type}-container`);
    const id = Date.now();
    const row = document.createElement('div');
    row.className = 'opening-item';
    row.id = `row-${id}`;
    
    let html = `
        <div class="opening-row">
            <select class="${type}-wall">
                <option value="N">North Wall</option>
                <option value="S">South Wall</option>
                <option value="E">East Wall</option>
                <option value="W">West Wall</option>
            </select>
            <input type="number" step="0.01" class="${type}-area" placeholder="Area (m²)" required>
            <button type="button" class="btn-remove" onclick="document.getElementById('row-${id}').remove()">X</button>
        </div>
    `;

    if (type === 'doors') {
        html += `
            <div style="margin-top: 10px; padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px;">
                <div class="radio-group" style="margin-bottom: 10px;">
                    <label><input type="radio" name="door-type-${id}" value="wk" checked onchange="toggleDoorInput(${id})"> Width & k</label>
                    <label><input type="radio" name="door-type-${id}" value="u" onchange="toggleDoorInput(${id})"> U-Value</label>
                </div>
                <input type="text" class="door-mat-name" id="door-name-${id}" placeholder="Material Name" style="margin-bottom: 10px; width: 100%;">
                
                <div id="door-wk-container-${id}" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <input type="number" step="0.01" class="door-mat-width" id="door-width-${id}" placeholder="Thickness (m)">
                    <input type="number" step="0.01" class="door-mat-k" id="door-k-${id}" placeholder="k (Thermal Cond.)">
                </div>
                <div id="door-u-container-${id}" style="display: none;">
                    <input type="number" step="0.01" class="door-mat-u" id="door-u-${id}" placeholder="U-Value (W/m²K)">
                </div>
            </div>
        `;
    } else if (type === 'windows') {
        let optionsHTML = '<option value="">Select Glazing Type from Database...</option>';
        windowDatabase.forEach(win => {
            optionsHTML += `<option value="${win['Glazing Type']}" data-u="${win['U-Value ']}">${win['Glazing Type']} (${win['Exposure Condition']}) - U: ${win['U-Value ']}</option>`;
        });

        html += `
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <select class="window-mat-select" style="flex: 2;">${optionsHTML}</select>
                <input type="number" step="0.01" class="window-sgf" placeholder="SGF Value" style="flex: 1;" required>
            </div>
        `;
    }

    row.innerHTML = html;
    container.appendChild(row);
}

function toggleDoorInput(id) {
    const isWk = document.querySelector(`input[name="door-type-${id}"]:checked`).value === 'wk';
    document.getElementById(`door-wk-container-${id}`).style.display = isWk ? 'grid' : 'none';
    document.getElementById(`door-u-container-${id}`).style.display = isWk ? 'none' : 'block';
}

function validateOpeningsArea() {
    let usedArea = { N: 0, S: 0, E: 0, W: 0 };
    document.getElementById('doors-container').querySelectorAll('.opening-item').forEach(item => {
        usedArea[item.querySelector('.doors-wall').value] += parseFloat(item.querySelector('.doors-area').value) || 0;
    });
    document.getElementById('windows-container').querySelectorAll('.opening-item').forEach(item => {
        usedArea[item.querySelector('.windows-wall').value] += parseFloat(item.querySelector('.windows-area').value) || 0;
    });

    for (const w of walls) {
        if (usedArea[w] > wallAreas[w]) {
            alert(`Error: Total openings on ${w} wall (${usedArea[w].toFixed(2)}m²) exceed available wall area (${wallAreas[w].toFixed(2)}m²).`);
            return false;
        }
    }
    return true;
}

function generateEnvironmentInputs() {
    const container = document.getElementById('outdoor-temps-container');
    [...surfaces, 'Floor'].forEach(s => {
        container.innerHTML += `<div class="input-group"><label>${s} Temp</label> <input type="number" step="0.1" id="temp-out-${s}"></div>`;
    });
}

function generateSurfaceParameters() {
    const container = document.getElementById('surface-params-container');
    surfaces.forEach(s => {
        let extraInputs = s === 'Roof' ? `<div class="input-group"><label>e Value</label><input type="number" step="0.01" id="e-${s}"></div>` : '';
        
        container.innerHTML += `
            <div class="section-card">
                <h4 style="margin-top:0; border-bottom:1px solid #e5e7eb; padding-bottom:10px;">${s} Surface</h4>
                <div class="surface-grid">
                    <div class="input-group" style="grid-column: span 2;">
                        <label>Exposure Condition (from Sheet 2)</label>
                        <select id="sheet2-${s}" class="sheet2-select" style="width: 100%;"></select>
                    </div>
                    <div class="input-group"><label>G Value</label><input type="number" step="0.01" id="g-${s}"></div>
                    <div class="input-group"><label>Alpha</label><input type="number" step="0.01" id="alpha-${s}"></div>
                    ${extraInputs}
                </div>
            </div>
        `;
    });
}

function generateJSON() {
    const data = {
        room: {
            length: convertToMeters(document.getElementById('length').value, document.getElementById('unit-length').value),
            breadth: convertToMeters(document.getElementById('breadth').value, document.getElementById('unit-breadth').value),
            height: convertToMeters(document.getElementById('height').value, document.getElementById('unit-height').value)
        },
        wallMaterials: { outer: getMaterialData('wall-outer'), central: getMaterialData('wall-central'), inner: getMaterialData('wall-inner') },
        floorMaterial: getMaterialData('floor'),
        roofMaterial: getMaterialData('roof'),
        doors: [], windows: [],
        temperatures: { inside: parseFloat(document.getElementById('temp-inside').value) || 0, outdoor: {} },
        ACH: parseFloat(document.getElementById('ach').value) || 0,
        surfaceParams: {}
    };

    document.getElementById('doors-container').querySelectorAll('.opening-item').forEach((item, index) => {
        const idStr = item.id.split('-')[1];
        const inputType = document.querySelector(`input[name="door-type-${idStr}"]:checked`).value;
        const matName = document.getElementById(`door-name-${idStr}`).value || "Door Material";
        let matR = 0;

        if (inputType === 'wk') {
            const w = parseFloat(document.getElementById(`door-width-${idStr}`).value) || 0;
            const k = parseFloat(document.getElementById(`door-k-${idStr}`).value) || 0;
            matR = (k !== 0) ? (w / k) : 0;
        } else {
            const u = parseFloat(document.getElementById(`door-u-${idStr}`).value) || 0;
            matR = (u !== 0) ? (1 / u) : 0;
        }

        data.doors.push({ 
            id: index + 1, wall: item.querySelector('.doors-wall').value, area: parseFloat(item.querySelector('.doors-area').value) || 0,
            material: { name: matName, R: parseFloat(matR.toFixed(4)) }
        });
    });

    document.getElementById('windows-container').querySelectorAll('.opening-item').forEach((item, index) => {
        const selectEl = item.querySelector('.window-mat-select');
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        const uValue = selectedOpt && selectedOpt.dataset.u ? parseFloat(selectedOpt.dataset.u) : 0;
        const sgfValue = parseFloat(item.querySelector('.window-sgf').value) || 0; 

        data.windows.push({ 
            id: index + 1, wall: item.querySelector('.windows-wall').value, area: parseFloat(item.querySelector('.windows-area').value) || 0,
            glazingDetails: selectedOpt && selectedOpt.value !== "" ? selectedOpt.text : "Unknown Window",
            R: (uValue !== 0) ? parseFloat((1 / uValue).toFixed(4)) : 0,
            SGF: sgfValue
        });
    });

    [...surfaces, 'Floor'].forEach(s => {
        data.temperatures.outdoor[s] = parseFloat(document.getElementById(`temp-out-${s}`).value) || 0;
    });

    surfaces.forEach(s => {
        const sheet2Sel = document.getElementById(`sheet2-${s}`);
        
        data.surfaceParams[s] = {
            exposureCondition: sheet2Sel.options[sheet2Sel.selectedIndex].text,
            Rso: parseFloat(sheet2Sel.value) || 0,
            G: parseFloat(document.getElementById(`g-${s}`).value) || 0,
            alpha: parseFloat(document.getElementById(`alpha-${s}`).value) || 0,
            e: s === 'Roof' ? (parseFloat(document.getElementById(`e-${s}`).value) || 0) : 0
        };
    });
    localStorage.setItem('demoOutput', JSON.stringify(data));
    window.location.href = 'Uvalues.html';
}

function updateCuboid() {
    const l = parseFloat(document.getElementById('length').value) || 0;
    const b = parseFloat(document.getElementById('breadth').value) || 0;
    const h = parseFloat(document.getElementById('height').value) || 0;

    const cuboid = document.getElementById('cuboid');
    if (l === 0 || b === 0 || h === 0) {
        cuboid.style.display = 'none';
        return;
    }
    cuboid.style.display = 'block';

    const faces = {
        front: document.querySelector('.face.front'), back: document.querySelector('.face.back'),
        right: document.querySelector('.face.right'), left: document.querySelector('.face.left'),
        top: document.querySelector('.face.top'), bottom: document.querySelector('.face.bottom')
    };

    const maxDim = Math.max(l, b, h);
    const scale = 120 / maxDim; 
    const pxL = l * scale; const pxB = b * scale; const pxH = h * scale;

    cuboid.style.width = `${pxL}px`; cuboid.style.height = `${pxH}px`;

    faces.front.style.width = `${pxL}px`; faces.front.style.height = `${pxH}px`;
    faces.front.style.transform = `translateZ(${pxB / 2}px)`;

    faces.back.style.width = `${pxL}px`; faces.back.style.height = `${pxH}px`;
    faces.back.style.transform = `rotateY(180deg) translateZ(${pxB / 2}px)`;

    faces.right.style.width = `${pxB}px`; faces.right.style.height = `${pxH}px`;
    faces.right.style.transform = `rotateY(90deg) translateZ(${pxL / 2}px)`;

    faces.left.style.width = `${pxB}px`; faces.left.style.height = `${pxH}px`;
    faces.left.style.transform = `rotateY(-90deg) translateZ(${pxL / 2}px)`;

    faces.top.style.width = `${pxL}px`; faces.top.style.height = `${pxB}px`;
    faces.top.style.transform = `rotateX(90deg) translateZ(${pxH / 2}px)`;

    faces.bottom.style.width = `${pxL}px`; faces.bottom.style.height = `${pxB}px`;
    faces.bottom.style.transform = `rotateX(-90deg) translateZ(${pxH / 2}px)`;
}

document.getElementById('length').addEventListener('input', updateCuboid);
document.getElementById('breadth').addEventListener('input', updateCuboid);
document.getElementById('height').addEventListener('input', updateCuboid);