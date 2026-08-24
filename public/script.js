function logout() { localStorage.removeItem('precifast_auth'); window.location.href = "login.html"; }

function openCashFlow() {
    window.open('cashflow.html', '_blank');
}
const API_BASE = '';
let vendorDetails = {};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-tab');
    event.currentTarget.classList.add('active');
    const titles = { 'summary':'Summary Dashboard', 'sales':'Sales Register', 'purchase':'Purchase Register', 'payments':'Payments Register', 'collections':'Collections Register', 'bank':'Bank Statement Register', 'ledgers':'Sundry Ledgers', 'manual':'Manual Entry', 'upload':'Upload Data', 'trash':'Deleted Records (Trash Bin)' };
    document.getElementById('page-title').innerText = titles[tabId] || '';
    if (tabId === 'trash') loadDeletedRecords();
}

function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.backgroundColor = isError ? "#dc3545" : "#28a745"; 
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 4000);
}

function filterTable(tbodyId, inputId) {
    const input = document.getElementById(inputId).value.toLowerCase();
    const rows = document.getElementById(tbodyId).getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
        const rowText = rows[i].innerText.toLowerCase();
        rows[i].style.display = rowText.includes(input) ? '' : 'none';
    }
}

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
};

const matchCategory = (targetCat, dataCat) => {
    const target = targetCat.toUpperCase().trim();
    const actual = (dataCat || '').toUpperCase().trim();
    if (!actual) return false;
    
    // Catch known abbreviations
    if (target === 'SECURITY DEPOSITS' && (actual === 'S D' || actual === 'SD')) return true;
    
    // 💥 CATCH THE SPELLING TYPO
    if (target === 'STATUTORY' && actual === 'STATUTARY') return true;
    
    return actual === target || actual.includes(target) || target.includes(actual);
};

function handleCustomerChange() {
    const select = document.getElementById('s-customer-select');
    const newCustomerInput = document.getElementById('s-customer-new');
    if (select.value === 'Other') {
        newCustomerInput.style.display = 'block'; newCustomerInput.required = true;
    } else {
        newCustomerInput.style.display = 'none'; newCustomerInput.required = false; newCustomerInput.value = '';
    }
    document.getElementById('s-invNo').value = "INV-S-" + Math.floor(100000 + Math.random() * 900000);
}

function handleVendorChange() {
    const select = document.getElementById('p-vendor-select');
    const newVendorInput = document.getElementById('p-vendor-new');
    const gstinInput = document.getElementById('p-gstin');
    if (select.value === 'Other') {
        newVendorInput.style.display = 'block'; newVendorInput.required = true; gstinInput.value = ''; 
    } else {
        newVendorInput.style.display = 'none'; newVendorInput.required = false; newVendorInput.value = '';
        if (vendorDetails[select.value]) gstinInput.value = vendorDetails[select.value];
    }
    document.getElementById('p-invNo').value = "INV-P-" + Math.floor(100000 + Math.random() * 900000);
}

function autoCalculatePurchase() {
    const taxableValue = parseFloat(document.getElementById('p-tax').value) || 0;
    const igst = parseFloat((taxableValue * 0.18).toFixed(2));
    document.getElementById('p-igst').value = igst;
    document.getElementById('p-val').value = parseFloat((taxableValue + igst).toFixed(2));
}

function getExportHTML() {
    const rawDate = document.getElementById('date-selector').value || new Date().toISOString().split('T')[0];
    const [year, month, day] = rawDate.split('-');
    const formattedDate = `${day}-${month}-${year}`;

    const sales       = document.getElementById('sales-summary-table').outerHTML;
    const purchases   = document.getElementById('purchase-summary-table').outerHTML;
    const payments    = document.getElementById('payments-summary-table').outerHTML;
    const collections = document.getElementById('collections-summary-table').outerHTML;

    const openingBal = document.getElementById('bank-opening-bal')?.innerText || '₹0';
    const closingBal = document.getElementById('bank-closing-bal')?.innerText  || '₹0';

    return `
    <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif; color:#2c3e50; padding:0; width:100%; box-sizing:border-box;">

        <!-- Header -->
        <table style="width:100%; margin-bottom:1px; border-collapse:collapse; border:none;">
            <tr>
                <td style="width:36px; border:none;"></td>
                <td style="text-align:center; vertical-align:middle; border:none;">
                    <h2 style="color:#2c3e50; margin:0; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">FINANCE MIS SUMMARY</h2>
                    <p style="color:#7f8c8d; font-size:8px; margin-top:1px; font-weight:600;">REPORT DATE: ${formattedDate}</p>
                </td>
                <td style="text-align:right; vertical-align:middle; border:none; width:36px;">
                    <img src="logo.png" alt="Precifast Logo" style="height:13px; object-fit:contain;" />
                </td>
            </tr>
        </table>

        <div style="width:100%; height:1px; background-color:#34495e; margin:0 0 2px 0;"></div>

        <!-- 2x2 equal-height grid: Sales & Purchases on row 1, Payments & Collections on row 2 -->
        <div class="pdf-grid">
            <div class="pdf-cell">
                <h3 style="color:#2980b9; border-bottom:1px solid #3498db; background:#f0f7ff;">Sales Summary</h3>
                ${sales}
            </div>
            <div class="pdf-cell">
                <h3 style="color:#d35400; border-bottom:1px solid #e67e22; background:#fff8f0;">Purchases Summary</h3>
                ${purchases}
            </div>
            <div class="pdf-cell">
                <h3 style="color:#8e44ad; border-bottom:1px solid #9b59b6; background:#faf0ff;">Payments Summary</h3>
                ${payments}
            </div>
            <div class="pdf-cell">
                <h3 style="color:#27ae60; border-bottom:1px solid #2ecc71; background:#f0fff4;">Collections Summary</h3>
                ${collections}
            </div>
        </div>

        <!-- Bank Balance Summary -->
        <div style="border:1px solid #d6eaf8; border-radius:3px; overflow:hidden;">
            <h3 style="color:#1abc9c; margin:0; padding:2px 5px; font-size:8px; font-weight:700; text-transform:uppercase; border-bottom:1px solid #1abc9c; background:#f0fdf9; letter-spacing:0.3px;">🏦 Bank Balance Summary (Month-to-Date)</h3>
            <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
                <tr>
                    <td style="width:49%; padding:3px 6px; background:#eaf4fb; border-right:1px solid #d6eaf8; border-left:2px solid #3498db;">
                        <div style="font-size:7px; color:#7f8c8d; font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">🔓 Opening Balance (MTD)</div>
                        <div style="font-size:11px; font-weight:800; color:#2c3e50; margin-top:1px;">${openingBal}</div>
                        <div style="font-size:6.5px; color:#aaa; margin-top:1px;">Balance before first transaction of the month</div>
                    </td>
                    <td style="width:2%; border:none;"></td>
                    <td style="width:49%; padding:3px 6px; background:#f4f6f7; border-left:2px solid #2c3e50;">
                        <div style="font-size:7px; color:#7f8c8d; font-weight:700; text-transform:uppercase; letter-spacing:0.3px;">🔒 Closing Balance (MTD)</div>
                        <div style="font-size:11px; font-weight:800; color:#2c3e50; margin-top:1px;">${closingBal}</div>
                        <div style="font-size:6.5px; color:#aaa; margin-top:1px;">Balance after last transaction of the month</div>
                    </td>
                </tr>
            </table>
        </div>
    </div>
    `;
}

const exportCSS = `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        table.data-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 8.5px;
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            border: 1px solid #dce1e6;
            height: 100%;
        }

        th, td {
            border: 1px solid #dce1e6;
            padding: 1px 2px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            vertical-align: middle;
            line-height: 1.2;
        }

        th {
            background-color: #f0f4f8 !important;
            color: #2c3e50 !important;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 7px;
            letter-spacing: 0.1px;
            white-space: nowrap;
        }

        table.data-table th:nth-child(1), table.data-table td:nth-child(1) { width: 42%; text-align: left; }
        table.data-table th:nth-child(2), table.data-table td:nth-child(2) { width: 29%; text-align: right; white-space: nowrap; }
        table.data-table th:nth-child(3), table.data-table td:nth-child(3) { width: 29%; text-align: right; white-space: nowrap; }

        table.data-table tr:nth-child(even) td { background-color: #f9fbfd !important; }

        /* ── Sub-rows: ↳ Bajaj, ↳ Gabriel India Limited, ↳ Loans, etc. ── */
        table.data-table td[style*="padding-left"] {
            color: #444 !important;
            font-size: 8px !important;
            font-style: normal !important;
            font-weight: 600 !important;
        }

        /* ── Grand Total footer ── */
        table.data-table tfoot th,
        table.data-table tfoot td {
            font-weight: 800 !important;
            background-color: #eef2f5 !important;
            border-top: 1px solid #bdc3c7 !important;
            color: #1a252f !important;
            white-space: nowrap !important;
            font-size: 9px !important;
            text-transform: uppercase !important;
        }

        /* ── Equal-height 2x2 grid for the 4 summary tables ── */
        .pdf-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto;
            gap: 3px;
            margin-bottom: 3px;
        }
        .pdf-cell {
            display: flex;
            flex-direction: column;
            border: 1px solid #dce1e6;
            border-radius: 2px;
            overflow: hidden;
        }
        .pdf-cell h3 {
            margin: 0;
            padding: 2px 4px;
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            flex-shrink: 0;
            letter-spacing: 0.3px;
        }
        .pdf-cell table.data-table {
            flex: 1;
        }
    </style>
`;

function downloadPDF() { 
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = exportCSS + getExportHTML();
    
    html2pdf().set({ 
        margin: [0.1, 0.12, 0.1, 0.12],
        filename: `Finance_MIS_Report_${document.getElementById('date-selector').value || 'Current'}.pdf`, 
        image: { type: 'jpeg', quality: 1 }, 
        html2canvas: { scale: 2.5, useCORS: true, letterRendering: true }, 
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } 
    }).from(tempDiv).save(); 
}

function downloadWord() {
    const fullHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Summary Report</title>
            ${exportCSS}
            <style>
                @page { size: A4 landscape; margin: 0.2in; }
            </style>
        </head>
        <body>${getExportHTML()}</body>
        </html>
    `;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', fullHtml], { type: 'application/msword' }));
    link.download = `Summary_Report_${document.getElementById('date-selector').value || 'Current'}.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function cellKeydown(event, id, field, type, cell) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        cell.blur(); 
        if (confirm("Are you sure you want to permanently save this change?")) {
            let newValue = cell.innerText.trim();
            if (field === 'remarks' || field === 'marketier') {
                newValue = newValue.toUpperCase();
            }
            if (field.toLowerCase().includes('date')) {
                newValue = newValue.replace(/\//g, '-');
            } else if (['invoiceValue', 'taxableValue', 'integratedTax', 'centralTax', 'stateTax', 'debit', 'credit', 'balance', 'finalBalance'].includes(field)) {
                newValue = newValue.replace(/[^0-9.-]+/g, ""); 
            }
            fetch(`${API_BASE}/api/finance/update-record/${type}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value: newValue }) })
            .then(res => res.json()).then(data => { showToast("✅ " + data.message); loadFinanceData(); })
            .catch(err => { showToast("❌ Failed to update.", true); loadFinanceData(); });
        } else loadFinanceData();
    }
}

async function loadFinanceData() {
    try {
        const dateSelector = document.getElementById('date-selector');
        const selectedDate = dateSelector.value;
        const queryParam = selectedDate ? `?date=${selectedDate}` : '';
        const response = await fetch(`${API_BASE}/api/finance/all-data${queryParam}`);
        const data = await response.json();

        if (data.error) return;
        if (!selectedDate && data.currentDate) dateSelector.value = data.currentDate;

        const analysis = data.analysis || { salesAnalysis: [], purchaseAnalysis: [], paymentAnalysis: [], collectionAnalysis: [] };
        const tables = data.tables || { receivables: [], payables: [], bankTransactions: [] };

        const uniqueCustomers = [...new Set(tables.receivables.map(item => item.customer).filter(Boolean))];
        document.getElementById('s-customer-select').innerHTML = '<option value="" disabled selected>Select Customer</option>' + uniqueCustomers.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="Other" style="font-weight:bold; color:#3498db;">+ Other (Add New)</option>';
        vendorDetails = {};
        tables.payables.forEach(p => { if (p.vendor && !vendorDetails[p.vendor]) vendorDetails[p.vendor] = p.gstin || ''; });
        document.getElementById('p-vendor-select').innerHTML = '<option value="" disabled selected>Select Supplier</option>' + Object.keys(vendorDetails).map(v => `<option value="${v}">${v}</option>`).join('') + '<option value="Other" style="font-weight:bold; color:#3498db;">+ Other (Add New)</option>';

        // 💥 APPLIED Math.round() TO ALL SUMMARY DASHBOARD VALUES 
        // This makes >= 0.5 round up to 1, and < 0.5 round down to 0.

        // OE sub-analysis & Retails sub-analysis come from server
        const oeSubAnalysis = analysis.oeSubAnalysis || { BAJAJ: {today:0,mtd:0}, 'GABRIEL INDIA LIMITED': {today:0,mtd:0}, 'OTHER OE': {today:0,mtd:0} };
        const retailSubAnalysis = analysis.retailSubAnalysis || { AUTO: {today:0,mtd:0}, INDUSTRIAL: {today:0,mtd:0}, SS: {today:0,mtd:0} };

        let sTodayTotal = 0, sMtdTotal = 0;
        let salesRows = '';

        // ── OE ROW (main) ──────────────────────────────────────────────────────
        const oeRow = analysis.salesAnalysis.find(r => matchCategory('OE', r._id)) || { today: 0, mtd: 0 };
        const oeToday = Math.round(oeRow.today), oeMtd = Math.round(oeRow.mtd);
        sTodayTotal += oeToday; sMtdTotal += oeMtd;
        salesRows += `<tr style="font-weight:600; background:#f0f7ff;">
            <td>OE</td>
            <td>₹${oeToday.toLocaleString('en-IN')}</td>
            <td>₹${oeMtd.toLocaleString('en-IN')}</td>
        </tr>`;
        // OE sub-rows: Bajaj — only show when non-zero
        const bajajT = Math.round(oeSubAnalysis['BAJAJ']?.today || 0);
        const bajajM = Math.round(oeSubAnalysis['BAJAJ']?.mtd || 0);
        if (bajajT > 0 || bajajM > 0) {
            salesRows += `<tr style="background:#f8fbff; color:#555; font-size:12px;">
                <td style="padding-left:28px;">↳ Bajaj</td>
                <td>₹${bajajT.toLocaleString('en-IN')}</td>
                <td>₹${bajajM.toLocaleString('en-IN')}</td>
            </tr>`;
        }
        // OE sub-rows: Gabriel — only show when non-zero
        const gabrielT = Math.round(oeSubAnalysis['GABRIEL INDIA LIMITED']?.today || 0);
        const gabrielM = Math.round(oeSubAnalysis['GABRIEL INDIA LIMITED']?.mtd || 0);
        if (gabrielT > 0 || gabrielM > 0) {
            salesRows += `<tr style="background:#f8fbff; color:#555; font-size:12px;">
                <td style="padding-left:28px;">↳ Gabriel India Limited</td>
                <td>₹${gabrielT.toLocaleString('en-IN')}</td>
                <td>₹${gabrielM.toLocaleString('en-IN')}</td>
            </tr>`;
        }
        // ── RETAILS ROW (main + merged SS Dealers) ─────────────────────────────
        const rRow = analysis.salesAnalysis.find(r => matchCategory('RETAILS', r._id)) || { today: 0, mtd: 0 };
        const ssRow = analysis.salesAnalysis.find(r => matchCategory('SS DEALERS', r._id)) || { today: 0, mtd: 0 };

        // 1. Combine Retails and SS Dealers for the main Retails total
        const rToday = Math.round(rRow.today) + Math.round(ssRow.today);
        const rMtd = Math.round(rRow.mtd) + Math.round(ssRow.mtd);
        
        sTodayTotal += rToday; 
        sMtdTotal += rMtd;

        salesRows += `<tr style="font-weight:600; background:#f0fff4;">
            <td>Retails</td>
            <td>₹${rToday.toLocaleString('en-IN')}</td>
            <td>₹${rMtd.toLocaleString('en-IN')}</td>
        </tr>`;

        // Retails sub-rows: Auto
        const autoT = Math.round(retailSubAnalysis['AUTO']?.today || 0);
        const autoM = Math.round(retailSubAnalysis['AUTO']?.mtd || 0);
        salesRows += `<tr style="background:#f5fff8; color:#555; font-size:12px;">
            <td style="padding-left:28px;">↳ Auto</td>
            <td>₹${autoT.toLocaleString('en-IN')}</td>
            <td>₹${autoM.toLocaleString('en-IN')}</td>
        </tr>`;

        // Retails sub-rows: Industrial
        const indT = Math.round(retailSubAnalysis['INDUSTRIAL']?.today || 0);
        const indM = Math.round(retailSubAnalysis['INDUSTRIAL']?.mtd || 0);
        salesRows += `<tr style="background:#f5fff8; color:#555; font-size:12px;">
            <td style="padding-left:28px;">↳ Industrial</td>
            <td>₹${indT.toLocaleString('en-IN')}</td>
            <td>₹${indM.toLocaleString('en-IN')}</td>
        </tr>`;

        // 2. Retails sub-rows: SS (Merge existing SS and SS Dealers amounts here)
        const ssRetT = Math.round(retailSubAnalysis['SS']?.today || 0) + Math.round(ssRow.today);
        const ssRetM = Math.round(retailSubAnalysis['SS']?.mtd || 0) + Math.round(ssRow.mtd);
        // ... (Existing SS sub-row logic above) ...
        salesRows += `<tr style="background:#f5fff8; color:#555; font-size:12px;">
            <td style="padding-left:28px;">↳ SS</td>
            <td>₹${ssRetT.toLocaleString('en-IN')}</td>
            <td>₹${ssRetM.toLocaleString('en-IN')}</td>
        </tr>`;

        
        // 3. UNCATEGORIZED ROW (Catches any missing data so Grand Total is correct)
        // 3. UNCATEGORIZED ROW (Catches any missing data so Grand Total is correct)
        const uncategorizedRow = analysis.salesAnalysis.find(r => r._id === 'UNCATEGORIZED') || { today: 0, mtd: 0 };
        const uncToday = Math.round(uncategorizedRow.today);
        const uncMtd = Math.round(uncategorizedRow.mtd);
        
        if (uncToday > 0 || uncMtd > 0) { // <-- This stops empty rows from showing
            sTodayTotal += uncToday;
            sMtdTotal += uncMtd;
            salesRows += `<tr style="font-weight:600; background:#fff3cd; color:#856404;">
                <td>Uncategorized / Other</td>
                <td>₹${uncToday.toLocaleString('en-IN')}</td>
                <td>₹${uncMtd.toLocaleString('en-IN')}</td>
            </tr>`;
        }

        // --- PURCHASES ---
        // --- PURCHASES ---
        const purCats = ['CONSUMABLES', 'LOGISTICS', 'MAINTANANCE', 'OUTSOURCING', 'PACKING CONSU.', 'RM', 'TOOLS'];
        let pTodayTotal = 0, pMtdTotal = 0;
        let purHtml = purCats.map(cat => {
            // 💥 FIX: Filter all matching variations and sum them up
            const matchingRows = analysis.purchaseAnalysis.filter(r => matchCategory(cat, r._id));
            const totalToday = matchingRows.reduce((sum, r) => sum + (r.today || 0), 0);
            const totalMtd = matchingRows.reduce((sum, r) => sum + (r.mtd || 0), 0);

            const roundedToday = Math.round(totalToday);
            const roundedMtd = Math.round(totalMtd);
            pTodayTotal += roundedToday; 
            pMtdTotal += roundedMtd;
            return `<tr><td>${cat}</td><td>₹${roundedToday.toLocaleString('en-IN')}</td><td>₹${roundedMtd.toLocaleString('en-IN')}</td></tr>`;
        }).join('');

        // ⚖️ BALANCE SALES & PURCHASES ROWS
        let salesCount = (salesRows.match(/<tr/g) || []).length;
        let purCount = (purHtml.match(/<tr/g) || []).length;
        let max1 = Math.max(salesCount, purCount);
        while (salesCount < max1) { salesRows += `<tr><td style="color:transparent;">.</td><td></td><td></td></tr>`; salesCount++; }
        while (purCount < max1) { purHtml += `<tr><td style="color:transparent;">.</td><td></td><td></td></tr>`; purCount++; }

        document.querySelector('#sales-summary-table tbody').innerHTML = salesRows;
        document.getElementById('s-today-total').innerText = `₹${sTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('s-mtd-total').innerText = `₹${sMtdTotal.toLocaleString('en-IN')}`;

        document.querySelector('#purchase-summary-table tbody').innerHTML = purHtml;
        document.getElementById('p-today-total').innerText = `₹${pTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('p-mtd-total').innerText = `₹${pMtdTotal.toLocaleString('en-IN')}`;


        // --- PAYMENTS ---
        const payCats = ['RM', 'STATUTORY', 'TOOLS /CONSU/R&M', 'SUNDRY EXP', 'FREIGHT', 'GCD', 'USL', 'OTHERS'];

        // STATUTORY sub-analysis (Loans, Salaries, Electricity Bill, Bank Charges)
        // Populated by server when bank txns have remarks=STATUTORY and name=<sub-category>
        const statutorySubAnalysis = analysis.statutorySubAnalysis || {
            'LOANS':            { today: 0, mtd: 0 },
            'SALARIES':         { today: 0, mtd: 0 },
            'ELECTRICITY BILL': { today: 0, mtd: 0 },
            'BANK CHARGES':     { today: 0, mtd: 0 }
        };
        const toTitleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

        let payTodayTotal = 0, payMtdTotal = 0;
        let payHtml = payCats.map(cat => {
            // 💥 FIX: Filter all matching variations and sum them up
            const matchingRows = analysis.paymentAnalysis.filter(r => matchCategory(cat, r._id));
            const totalToday = matchingRows.reduce((sum, r) => sum + (r.today || 0), 0);
            const totalMtd = matchingRows.reduce((sum, r) => sum + (r.mtd || 0), 0);

            const roundedToday = Math.round(totalToday);
            const roundedMtd = Math.round(totalMtd);
            payTodayTotal += roundedToday;
            payMtdTotal += roundedMtd;

            // ── STATUTORY: bold parent row + 4 indented sub-rows ──
            if (cat === 'STATUTORY') {
                const subCats = ['LOANS', 'SALARIES', 'ELECTRICITY BILL', 'BANK CHARGES'];
                const subRows = subCats.map(sub => {
                    const subT = Math.round(statutorySubAnalysis[sub]?.today || 0);
                    const subM = Math.round(statutorySubAnalysis[sub]?.mtd || 0);
                    return `<tr style="background:#faf5ff; color:#555; font-size:12px;">
                        <td style="padding-left:28px;">↳ ${toTitleCase(sub)}</td>
                        <td>₹${subT.toLocaleString('en-IN')}</td>
                        <td>₹${subM.toLocaleString('en-IN')}</td>
                    </tr>`;
                }).join('');
                return `<tr style="font-weight:600; background:#f5f0ff;">
                    <td>STATUTORY</td>
                    <td>₹${roundedToday.toLocaleString('en-IN')}</td>
                    <td>₹${roundedMtd.toLocaleString('en-IN')}</td>
                </tr>${subRows}`;
            }

            return `<tr><td>${cat}</td><td>₹${roundedToday.toLocaleString('en-IN')}</td><td>₹${roundedMtd.toLocaleString('en-IN')}</td></tr>`;
        }).join('');

        // --- COLLECTIONS ---
        const colCats = ['OE', 'RETAILS', 'OTHER INCOME', 'SECURITY DEPOSITS', 'USL', 'BANK INTEREST'];
        let colTodayTotal = 0, colMtdTotal = 0;
        let colHtml = colCats.map(cat => {
            // 💥 FIX: Filter all matching variations and sum them up
            const matchingRows = analysis.collectionAnalysis.filter(r => matchCategory(cat, r._id));
            const totalToday = matchingRows.reduce((sum, r) => sum + (r.today || 0), 0);
            const totalMtd = matchingRows.reduce((sum, r) => sum + (r.mtd || 0), 0);

            const roundedToday = Math.round(totalToday);
            const roundedMtd = Math.round(totalMtd);
            colTodayTotal += roundedToday; 
            colMtdTotal += roundedMtd;
            return `<tr><td>${cat}</td><td>₹${roundedToday.toLocaleString('en-IN')}</td><td>₹${roundedMtd.toLocaleString('en-IN')}</td></tr>`;
        }).join('');

        // ⚖️ BALANCE PAYMENTS & COLLECTIONS ROWS (Forces Grand Totals to align perfectly)
        let payCount = (payHtml.match(/<tr/g) || []).length;
        let colCount = (colHtml.match(/<tr/g) || []).length;
        let max2 = Math.max(payCount, colCount);
        while (payCount < max2) { payHtml += `<tr><td style="color:transparent;">.</td><td></td><td></td></tr>`; payCount++; }
        while (colCount < max2) { colHtml += `<tr><td style="color:transparent;">.</td><td></td><td></td></tr>`; colCount++; }

        document.querySelector('#payments-summary-table tbody').innerHTML = payHtml;
        document.getElementById('pay-today-total').innerText = `₹${payTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('pay-mtd-total').innerText = `₹${payMtdTotal.toLocaleString('en-IN')}`;

        document.querySelector('#collections-summary-table tbody').innerHTML = colHtml;
        document.getElementById('col-today-total').innerText = `₹${colTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('col-mtd-total').innerText = `₹${colMtdTotal.toLocaleString('en-IN')}`;

        document.getElementById('sales-body').innerHTML = tables.receivables.map((inv, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceDate', 'Sales', this)">${formatDate(inv.invoiceDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'customer', 'Sales', this)">${inv.customer || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceNo', 'Sales', this)">${inv.invoiceNo || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'debit', 'Sales', this)" style="color:#c0392b; font-weight:bold;">₹${Math.round(inv.debit || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'credit', 'Sales', this)" style="color:#27ae60; font-weight:bold;">₹${Math.round(inv.credit || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'marketier', 'Sales', this)">${(inv.marketier || '').toUpperCase()}</td>
                <td><button onclick="deleteRecord('${inv._id}', 'sales')" class="btn-trash" title="Move to Trash"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');

        document.getElementById('purchase-body').innerHTML = tables.payables.map((pay, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'gstin', 'Purchase', this)">${pay.gstin || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'vendor', 'Purchase', this)">${pay.vendor || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'invoiceNumber', 'Purchase', this)">${pay.invoiceNumber || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'invoiceDate', 'Purchase', this)">${formatDate(pay.invoiceDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'matRecDate', 'Purchase', this)">${formatDate(pay.matRecDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'invoiceValue', 'Purchase', this)">₹${Math.round(pay.invoiceValue || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'taxableValue', 'Purchase', this)">₹${Math.round(pay.taxableValue || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'integratedTax', 'Purchase', this)">₹${Math.round(pay.integratedTax || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'centralTax', 'Purchase', this)">₹${Math.round(pay.centralTax || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'stateTax', 'Purchase', this)">₹${Math.round(pay.stateTax || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'remarks', 'Purchase', this)">${(pay.remarks || '').toUpperCase()}</td>
                <td><button onclick="deleteRecord('${pay._id}', 'purchase')" class="btn-trash" title="Move to Trash"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');

        document.getElementById('bank-body').innerHTML = tables.bankTransactions.map((tx, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'transactionDate', 'Bank', this)">${formatDateTime(tx.transactionDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'valueDate', 'Bank', this)">${formatDate(tx.valueDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'chequeNo', 'Bank', this)">${tx.chequeNo || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'description', 'Bank', this)">${tx.description || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'branchCode', 'Bank', this)">${tx.branchCode || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'head', 'Bank', this)">${tx.head || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'name', 'Bank', this)">${tx.name || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'remarks', 'Bank', this)">${(tx.remarks || '').toUpperCase()}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'debit', 'Bank', this)" style="color:#c0392b; font-weight:bold;">₹${Math.round(tx.debit || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'credit', 'Bank', this)" style="color:#27ae60; font-weight:bold;">₹${Math.round(tx.credit || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'balance', 'Bank', this)">₹${Math.round(tx.balance || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'finalBalance', 'Bank', this)">₹${Math.round(tx.finalBalance || 0).toLocaleString('en-IN')}</td>
                <td><button onclick="deleteRecord('${tx._id}', 'bank')" class="btn-trash" title="Move to Trash"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');

        // ── Bank Balance Summary tiles ────────────────────────────────────────
        document.getElementById('bank-opening-bal').innerText  = `₹${Math.round(analysis.openingBalance || 0).toLocaleString('en-IN')}`;
        document.getElementById('bank-closing-bal').innerText  = `₹${Math.round(analysis.closingBalance  || 0).toLocaleString('en-IN')}`;


    } catch (error) { console.error(error); }
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uploadBtn = document.getElementById('upload-btn');
    uploadBtn.innerText = "⏳ Processing..."; uploadBtn.style.backgroundColor = "#f39c12"; uploadBtn.disabled = true; 

    const formData = new FormData(); formData.append('file', document.getElementById('file-input').files[0]);
    try {
        const res = await fetch(`${API_BASE}/api/finance/upload-excel`, { method: 'POST', body: formData });
        const result = await res.json();
        uploadBtn.innerText = "Upload & Sync Data"; uploadBtn.style.backgroundColor = "#3498db"; uploadBtn.disabled = false;
        showToast("✅ " + result.message); document.getElementById('date-selector').value = ''; loadFinanceData();
    } catch (err) { 
        uploadBtn.innerText = "Upload & Sync Data"; uploadBtn.style.backgroundColor = "#3498db"; uploadBtn.disabled = false;
        showToast("❌ Upload Failed.", true); 
    }
});

document.getElementById('manual-sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = document.getElementById('s-customer-select').value;
    const saleValue = parseFloat(document.getElementById('s-val').value) || 0;
    await fetch(`${API_BASE}/api/finance/manual-sale`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            invoiceDate: document.getElementById('s-date').value, 
            customer: c === 'Other' ? document.getElementById('s-customer-new').value : c, 
            invoiceNo: document.getElementById('s-invNo').value, 
            invoiceValue: saleValue, 
            debit: saleValue, // <-- This ensures it shows up in your table!
            marketier: document.getElementById('s-marketier').value 
        }) 
    });
    showToast("✅ Sale Saved"); document.getElementById('manual-sale-form').reset(); document.getElementById('s-customer-new').style.display = 'none'; loadFinanceData();
});

document.getElementById('manual-purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = document.getElementById('p-vendor-select').value;
    await fetch(`${API_BASE}/api/finance/manual-purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gstin: document.getElementById('p-gstin').value, vendor: v === 'Other' ? document.getElementById('p-vendor-new').value : v, invoiceNumber: document.getElementById('p-invNo').value, invoiceDate: document.getElementById('p-date').value, matRecDate: document.getElementById('p-matDate').value || null, invoiceValue: parseFloat(document.getElementById('p-val').value) || 0, taxableValue: parseFloat(document.getElementById('p-tax').value) || 0, integratedTax: parseFloat(document.getElementById('p-igst').value) || 0, centralTax: parseFloat(document.getElementById('p-cgst').value) || 0, stateTax: parseFloat(document.getElementById('p-sgst').value) || 0, remarks: document.getElementById('p-remarks').value }) });
    showToast("✅ Purchase Saved"); document.getElementById('manual-purchase-form').reset(); document.getElementById('p-vendor-new').style.display = 'none'; loadFinanceData();
});

document.getElementById('manual-bank-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const txType = document.getElementById('b-type').value;
    const amount = parseFloat(document.getElementById('b-amount').value) || 0;
    const debitVal = txType === 'Debit' ? amount : 0;
    const creditVal = txType === 'Credit' ? amount : 0;

    const newBankTx = {
        transactionDate: document.getElementById('b-tDate').value,
        valueDate: document.getElementById('b-vDate').value || null,
        chequeNo: document.getElementById('b-cheque').value,
        description: document.getElementById('b-desc').value,
        branchCode: document.getElementById('b-branch').value,
        head: document.getElementById('b-head').value,
        name: document.getElementById('b-name').value,
        debit: debitVal,
        credit: creditVal,
        balance: parseFloat(document.getElementById('b-bal').value) || 0,
        finalBalance: parseFloat(document.getElementById('b-finalBal').value) || 0,
        remarks: document.getElementById('b-remarks').value
    };

    await fetch(`${API_BASE}/api/finance/manual-bank`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newBankTx) });
    showToast("✅ Bank Transaction Saved"); document.getElementById('manual-bank-form').reset(); loadFinanceData();
});


// ─── SUNDRY LEDGERS ───────────────────────────────────────────────────────────

let allLedgersData = [];

async function loadSundryLedgers() {
    try {
        const res = await fetch(`${API_BASE}/api/finance/sundry-ledgers`);
        allLedgersData = await res.json();
        renderLedgersTable(allLedgersData);
    } catch (e) { console.error('Failed to load ledgers', e); }
}

function renderLedgersTable(data) {
    // Update stat cards
    document.getElementById('ledger-stat-auto').innerText = data.filter(l => l.sectorType === 'Auto').length;
    document.getElementById('ledger-stat-ind').innerText = data.filter(l => l.sectorType === 'Industrial').length;
    document.getElementById('ledger-stat-ss').innerText = data.filter(l => l.sectorType === 'SS').length;
    document.getElementById('ledger-stat-oe').innerText = data.filter(l => l.sectorType === 'OE').length;
    document.getElementById('ledger-stat-total').innerText = data.length;

    const sectorColors = { Auto: '#3498db', Industrial: '#e67e22', SS: '#9b59b6', OE: '#27ae60', Other: '#95a5a6' };
    
    // Dropdown options
    const catOptions = ["AUTO SECTOR CUSTOMERS", "INDUSTRIAL CUSTOMERS", "SS DEALERS", "OE - BAJAJ", "OE - GABRIEL INDIA LIMITED", "OTHER"];
    const secOptions = ["Auto", "Industrial", "SS", "OE", "Other"];

    document.getElementById('ledgers-body').innerHTML = data.map((l, i) => {
        const color = sectorColors[l.sectorType] || '#95a5a6';
        
        // Build the dynamic HTML for the select menus
        const catHtml = catOptions.map(c => `<option value="${c}" ${l.category === c ? 'selected' : ''}>${c}</option>`).join('');
        const secHtml = secOptions.map(s => `<option value="${s}" ${l.sectorType === s ? 'selected' : ''}>${s}</option>`).join('');

        return `<tr>
            <td><strong>${i + 1}</strong></td>
            <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${l._id}', 'ledgerName', 'Ledger', this)">${l.ledgerName || ''}</td>
            
            <td>
                <select onchange="dropdownChange('${l._id}', 'category', 'Ledger', this)" style="padding:4px; border:1px solid transparent; background:transparent; cursor:pointer; width:100%; font-family: inherit;">
                    <option value="" disabled>Select...</option>
                    ${catHtml}
                </select>
            </td>
            
            <td>
                <select onchange="dropdownChange('${l._id}', 'sectorType', 'Ledger', this)" style="padding:4px 8px; border:1px solid ${color}44; background:${color}11; color:${color}; border-radius:12px; font-size:12px; font-weight:600; cursor:pointer; outline:none; text-align:center;">
                    ${secHtml}
                </select>
            </td>
            
            <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${l._id}', 'gstin', 'Ledger', this)">${l.gstin || ''}</td>
            <td><button onclick="deleteLedger('${l._id}')" style="background:#e74c3c; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}

function filterLedgersTable() {
    const search = (document.getElementById('ledger-search').value || '').toLowerCase();
    const sector = document.getElementById('ledger-sector-filter').value;
    const filtered = allLedgersData.filter(l => {
        const matchSearch = !search || (l.ledgerName || '').toLowerCase().includes(search) || (l.category || '').toLowerCase().includes(search);
        const matchSector = !sector || l.sectorType === sector;
        return matchSearch && matchSector;
    });
    renderLedgersTable(filtered);
}

function showAddLedgerForm() {
    const wrap = document.getElementById('add-ledger-form-wrap');
    wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

async function saveLedgerEntry() {
    const name = document.getElementById('l-name').value.trim();
    const category = document.getElementById('l-category').value;
    const gstin = document.getElementById('l-gstin').value.trim();
    const sectorType = document.getElementById('l-sector').value;

    if (!name || !category) { showToast('❌ Ledger Name and Category are required', true); return; }

    try {
        await fetch(`${API_BASE}/api/finance/sundry-ledger`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ledgerName: name, category, gstin: gstin || null, sectorType })
        });
        showToast('✅ Ledger Saved!');
        document.getElementById('l-name').value = '';
        document.getElementById('l-gstin').value = '';
        document.getElementById('add-ledger-form-wrap').style.display = 'none';
        loadSundryLedgers();
    } catch (e) { showToast('❌ Failed to save ledger', true); }
}

async function deleteLedger(id) {
    if (!confirm('Delete this ledger entry?')) return;
    try {
        await fetch(`${API_BASE}/api/finance/sundry-ledger/${id}`, { method: 'DELETE' });
        showToast('✅ Ledger Deleted');
        loadSundryLedgers();
    } catch (e) { showToast('❌ Failed to delete', true); }
}

function exportLedgers() {
    const headers = ['S.No', 'Ledger Name', 'Category', 'Sector Type', 'GSTIN'];
    const rows = allLedgersData.map((l, i) => [i + 1, l.ledgerName, l.category, l.sectorType, l.gstin || '']);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
    link.download = 'Sundry_Ledgers.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ─── DELETE / RESTORE / TRASH FUNCTIONS ──────────────────────────────────────

async function deleteRecord(id, type) {
    const label = { sales: 'Sale', purchase: 'Purchase', bank: 'Bank Transaction' };
    if (!confirm(`Move this ${label[type] || 'record'} to Trash?\nIt will be saved with today's date and can be restored anytime.`)) return;
    try {
        const res = await fetch(`${API_BASE}/api/finance/${type}/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        showToast(`✅ ${label[type]} moved to Trash. Go to "Deleted Records" to restore.`);
        loadFinanceData();
    } catch (e) { showToast('❌ Failed to delete: ' + (e.message || ''), true); }
}

async function loadDeletedRecords() {
    const tbody = document.getElementById('trash-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#999; padding:40px;"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
    try {
        const res = await fetch(`${API_BASE}/api/finance/deleted-records`);
        const records = await res.json();
        renderTrashTable(records);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#e74c3c; padding:30px;">❌ Failed to load deleted records.</td></tr>';
    }
}

function renderTrashTable(records) {
    const tbody = document.getElementById('trash-body');
    if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:50px; color:#27ae60;">
            <i class="fas fa-check-circle" style="font-size:30px; display:block; margin-bottom:10px;"></i>
            Trash is empty — all records are intact!
        </td></tr>`;
        return;
    }
    tbody.innerHTML = records.map((rec, i) => {
        const d = rec.data || {};
        let typeBadge = '', keyInfo = '', amount = '', origDate = '';

        if (rec.originalCollection === 'Invoice') {
            typeBadge = `<span style="background:#ebf5fb; color:#2980b9; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; letter-spacing:0.5px;">SALE</span>`;
            keyInfo   = d.customer || '—';
            amount    = `<span style="color:#2980b9; font-weight:600;">₹${Math.round(d.invoiceValue || d.debit || 0).toLocaleString('en-IN')}</span>`;
            origDate  = formatDate(d.invoiceDate);
        } else if (rec.originalCollection === 'Payable') {
            typeBadge = `<span style="background:#fef5e7; color:#d35400; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; letter-spacing:0.5px;">PURCHASE</span>`;
            keyInfo   = d.vendor || '—';
            amount    = `<span style="color:#e67e22; font-weight:600;">₹${Math.round(d.invoiceValue || d.taxableValue || 0).toLocaleString('en-IN')}</span>`;
            origDate  = formatDate(d.matRecDate || d.invoiceDate);
        } else {
            typeBadge = `<span style="background:#e8f8f5; color:#16a085; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; letter-spacing:0.5px;">BANK</span>`;
            keyInfo   = d.description || d.name || '—';
            const cr = d.credit || 0, dr = d.debit || 0;
            amount    = cr > 0
                ? `<span style="color:#27ae60; font-weight:600;">+₹${Math.round(cr).toLocaleString('en-IN')}</span>`
                : `<span style="color:#c0392b; font-weight:600;">-₹${Math.round(dr).toLocaleString('en-IN')}</span>`;
            origDate  = formatDateTime(d.transactionDate);
        }

        const deletedOn = formatDate(rec.deletedAt);

        return `<tr>
            <td><strong>${i + 1}</strong></td>
            <td>${typeBadge}</td>
            <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${keyInfo}">${keyInfo}</td>
            <td>${amount}</td>
            <td style="font-size:12px;">${origDate}</td>
            <td style="font-size:12px; color:#e74c3c;">${deletedOn}</td>
            <td style="white-space:nowrap;">
                <button onclick="restoreRecord('${rec._id}')" class="btn-restore" title="Restore this record">
                    <i class="fas fa-undo"></i> Restore
                </button>
                <button onclick="permanentDelete('${rec._id}')" class="btn-danger" style="margin-left:5px; font-size:11px;" title="Delete forever">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function restoreRecord(trashId) {
    if (!confirm('Restore this record back to its original table?\nThe Summary Dashboard will update automatically.')) return;
    try {
        const res = await fetch(`${API_BASE}/api/finance/restore/${trashId}`, { method: 'POST' });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        showToast('✅ Record restored! Summary updated.');
        loadDeletedRecords();
        loadFinanceData();
    } catch (e) { showToast('❌ Failed to restore: ' + (e.message || ''), true); }
}

async function permanentDelete(trashId) {
    if (!confirm('⚠️ Permanently delete this record?\nThis action CANNOT be undone!')) return;
    try {
        const res = await fetch(`${API_BASE}/api/finance/trash/${trashId}`, { method: 'DELETE' });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        showToast('🗑️ Record permanently deleted.');
        loadDeletedRecords();
    } catch (e) { showToast('❌ Failed to permanently delete: ' + (e.message || ''), true); }
}

document.addEventListener('DOMContentLoaded', () => { document.getElementById('date-selector').value = ''; loadFinanceData(); loadSundryLedgers(); });

function dropdownChange(id, field, type, selectElement) {
    if (confirm(`Are you sure you want to update this ${field}?`)) {
        const newValue = selectElement.value;
        
        // AUTO-SYNC LOGIC: If changing Sector, automatically update the Category too
        if (field === 'sectorType') {
            let linkedCategory = 'OTHER';
            if (newValue === 'Auto') linkedCategory = 'AUTO SECTOR CUSTOMERS';
            if (newValue === 'Industrial') linkedCategory = 'INDUSTRIAL CUSTOMERS';
            if (newValue === 'SS') linkedCategory = 'SS DEALERS';
            if (newValue === 'OE') linkedCategory = 'OE - BAJAJ';
            
            // Send the linked category update in the background
            fetch(`${API_BASE}/api/finance/update-record/${type}/${id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ field: 'category', value: linkedCategory }) 
            });
        }

        // Send the main dropdown update
        fetch(`${API_BASE}/api/finance/update-record/${type}/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ field: field, value: newValue }) 
        })
        .then(res => res.json())
        .then(data => { 
            showToast("✅ Updated Successfully"); 
            loadSundryLedgers(); // Refresh table to show changes
        })
        .catch(err => { 
            showToast("❌ Failed to update.", true); 
            loadSundryLedgers(); 
        });
    } else {
        // Reset dropdown if user clicks cancel
        loadSundryLedgers(); 
    }
}


// ── FIXED scrollbar always pinned to bottom of browser window ──
(function () {

    // Build the bar and inject into body
    const bar = document.createElement('div');
    bar.id = 'hscroll-fixed';
    bar.innerHTML = '<div id="hscroll-fixed-inner"></div>';
    document.body.appendChild(bar);

    let activeWrapper = null;
    let syncing = false;

    // Drag fixed bar → scroll the real table wrapper
    bar.addEventListener('scroll', () => {
        if (syncing || !activeWrapper) return;
        syncing = true;
        activeWrapper.scrollLeft = bar.scrollLeft;
        syncing = false;
    });

    function attachToWrapper(wrapper) {
        activeWrapper = wrapper;
        const inner = document.getElementById('hscroll-fixed-inner');
        const scrollable = wrapper.scrollWidth - wrapper.clientWidth;

        if (scrollable < 5) {
            bar.style.display = 'none';
            return;
        }

        inner.style.width = wrapper.scrollWidth + 'px';
        bar.scrollLeft = wrapper.scrollLeft;
        bar.style.display = 'block';
    }

    function detachBar() {
        activeWrapper = null;
        bar.style.display = 'none';
    }

    function hookWrapper(wrapper) {
        if (wrapper._hscrollHooked) return;
        wrapper._hscrollHooked = true;

        // Keep fixed bar thumb in sync when user scrolls the real wrapper
        wrapper.addEventListener('scroll', () => {
            if (syncing) return;
            syncing = true;
            bar.scrollLeft = wrapper.scrollLeft;
            syncing = false;
        });

        // Update bar width if table content changes (rows added/removed)
        new MutationObserver(() => {
            if (activeWrapper === wrapper) attachToWrapper(wrapper);
        }).observe(wrapper, { childList: true, subtree: true });
    }

    // ── Core: find the visible table-wrapper in the active tab and attach ──
    function refreshActiveWrapper() {
        // The active tab section
        const activeSection = document.querySelector('.tab-content.active-tab');
        if (!activeSection) { detachBar(); return; }

        // All .table-wrapper elements inside the active tab
        const wrappers = activeSection.querySelectorAll('.table-wrapper');
        if (!wrappers.length) { detachBar(); return; }

        // Pick the first wrapper that contains a table
        let chosen = null;
        wrappers.forEach(w => {
            if (!chosen && w.querySelector('table')) chosen = w;
        });

        if (!chosen) { detachBar(); return; }

        // Use the inner table's natural scrollWidth so we catch
        // cases where the table fits on wide screens but still
        // benefits from a fixed bar (Sales has 8 cols, fits at 1920px
        // but overflows at 1366px — bar should always be ready)
        const table = chosen.querySelector('table');
        const tableNaturalWidth = table ? table.scrollWidth : chosen.scrollWidth;
        const wrapperWidth = chosen.clientWidth;

        // Always show bar if table is wider than its wrapper by any amount,
        // OR if the table has more than 5 columns (Sales, Purchase, Bank etc.)
        const cols = chosen.querySelectorAll('thead th').length;
        if (tableNaturalWidth > wrapperWidth || cols > 5) {
            hookWrapper(chosen);
            attachToWrapper(chosen);
        } else {
            detachBar();
        }
    }

    function init() {
        // Hook all wrappers so their scroll events stay in sync
        document.querySelectorAll('.table-wrapper').forEach(hookWrapper);
        refreshActiveWrapper();
    }

    // Re-run whenever a tab is switched
    const _origSwitch = window.switchTab;
    window.switchTab = function (...a) {
        _origSwitch.apply(this, a);
        setTimeout(refreshActiveWrapper, 100);
    };

    // Re-run after every data load
    const _orig = loadFinanceData;
    loadFinanceData = async function (...a) {
        await _orig.apply(this, a);
        setTimeout(init, 300);
    };

    // Also refresh on window resize (bar left offset depends on sidebar width)
    window.addEventListener('resize', refreshActiveWrapper);

    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
})();