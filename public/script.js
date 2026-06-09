function logout() { localStorage.removeItem('precifast_auth'); window.location.href = "login.html"; }
const API_BASE = '';
let vendorDetails = {};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-tab');
    event.currentTarget.classList.add('active');
    const titles = { 'summary':'Summary Dashboard', 'sales':'Sales Register', 'purchase':'Purchase Register', 'payments':'Payments Register', 'collections':'Collections Register', 'bank':'Bank Statement Register', 'ledgers':'Sundry Ledgers', 'manual':'Manual Entry', 'upload':'Upload Data'};
    document.getElementById('page-title').innerText = titles[tabId];
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
    
    if (target === 'SECURITY DEPOSITS' && (actual === 'S D' || actual === 'SD')) return true;
    
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

    // Replace the opening table tags to inject height: 100% dynamically
    const sales = document.getElementById('sales-summary-table').outerHTML.replace('<table class="data-table"', '<table class="data-table" style="height: 100%; display: flex; flex-direction: column;"');
    const purchases = document.getElementById('purchase-summary-table').outerHTML.replace('<table class="data-table"', '<table class="data-table" style="height: 100%; display: flex; flex-direction: column;"');
    const payments = document.getElementById('payments-summary-table').outerHTML.replace('<table class="data-table"', '<table class="data-table" style="height: 100%; display: flex; flex-direction: column;"');
    const collections = document.getElementById('collections-summary-table').outerHTML.replace('<table class="data-table"', '<table class="data-table" style="height: 100%; display: flex; flex-direction: column;"');

    return `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #2c3e50; padding: 0; width: 100%; box-sizing: border-box;">
        
        <table style="width: 100%; margin-bottom: 8px; border-collapse: collapse; border: none;">
            <tr>
                <td style="width: 80px; border: none;"></td> 
                <td style="text-align: center; vertical-align: middle; border: none;">
                    <h2 style="color: #2c3e50; margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
                        FINANCE MIS (${formattedDate})
                    </h2>
                </td>
                <td style="text-align: right; vertical-align: middle; border: none; width: 80px;">
                    <img src="logo.png" alt="Precifast Logo" style="height: 35px; object-fit: contain;" />
                </td>
            </tr>
        </table>
        
        <div style="width: 100%; height: 2px; background-color: #bdc3c7; margin: 0 0 15px 0;"></div>
        
        <div style="display: flex; gap: 15px; margin-bottom: 15px; align-items: stretch;">
            <div style="flex: 1; display: flex; flex-direction: column;">
                <h3 style="color: #2980b9; margin: 0 0 5px 0; font-size: 16px; border-bottom: 2px solid #3498db; padding-bottom: 2px;">Sales Summary</h3>
                ${sales}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column;">
                <h3 style="color: #d35400; margin: 0 0 5px 0; font-size: 16px; border-bottom: 2px solid #e67e22; padding-bottom: 2px;">Purchases Summary</h3>
                ${purchases}
            </div>
        </div>

        <div style="display: flex; gap: 15px; align-items: stretch;">
            <div style="flex: 1; display: flex; flex-direction: column;">
                <h3 style="color: #8e44ad; margin: 0 0 5px 0; font-size: 16px; border-bottom: 2px solid #9b59b6; padding-bottom: 2px;">Payments Summary</h3>
                ${payments}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column;">
                <h3 style="color: #27ae60; margin: 0 0 5px 0; font-size: 16px; border-bottom: 2px solid #2ecc71; padding-bottom: 2px;">Collections Summary</h3>
                ${collections}
            </div>
        </div>
    </div>
    `;
}

// Global beautiful CSS injected into both PDF and Word exports
const exportCSS = `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        table.data-table { 
            width: 100%; 
            table-layout: fixed; 
            border-collapse: collapse; 
            font-size: 7.5px; /* Slightly smaller overall text */
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            border: 1px solid #e0e6ed;
        }
        
        /* 2. Force the 'Particulars' column to be wider to stop text wrapping issues */
        table.data-table th:nth-child(1),
        table.data-table td:nth-child(1) {
            width: 40%;
        }
        table.data-table th:nth-child(2),
        table.data-table td:nth-child(2),
        table.data-table th:nth-child(3),
        table.data-table td:nth-child(3) {
            width: 30%;
        }

        th, td { 
            border: 1px solid #e0e6ed; 
            padding: 3px 4px; /* Reduced padding to save space */
            text-align: left; 
            word-wrap: break-word; 
            overflow-wrap: break-word;
        }
        th { 
            background-color: #f4f7fa; 
            color: #34495e; 
            font-weight: 700; 
            text-transform: uppercase; 
            font-size: 7.5px;
        }
        tr:nth-child(even) { background-color: #fafbfc; }
        tfoot th { 
            background-color: #ecf0f1; 
            color: #2c3e50; 
            font-weight: 700; 
            font-size: 8px; /* 3. Decreased Grand Total Font Size */
            border-top: 2px solid #bdc3c7; 
        }
    </style>
`;

function downloadPDF() { 
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = exportCSS + getExportHTML();
    
    // Adjusted margins to give the content enough breathing room to fit on one page
    html2pdf().set({ 
        margin: [0.3, 0.3, 0.3, 0.3], // Top, Right, Bottom, Left margins in inches
        filename: `Summary_Report_${document.getElementById('date-selector').value || 'Current'}.pdf`, 
        html2canvas: { scale: 2, useCORS: true }, // useCORS helps load the logo image properly
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
                @page { size: A4 portrait; margin: 0.4in; }
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
        // OE sub-rows: Bajaj
        const bajajT = Math.round(oeSubAnalysis['BAJAJ']?.today || 0);
        const bajajM = Math.round(oeSubAnalysis['BAJAJ']?.mtd || 0);
        salesRows += `<tr style="background:#f8fbff; color:#555; font-size:12px;">
            <td style="padding-left:28px;">↳ Bajaj</td>
            <td>₹${bajajT.toLocaleString('en-IN')}</td>
            <td>₹${bajajM.toLocaleString('en-IN')}</td>
        </tr>`;
        // OE sub-rows: Gabriel
        const gabrielT = Math.round(oeSubAnalysis['GABRIEL INDIA LIMITED']?.today || 0);
        const gabrielM = Math.round(oeSubAnalysis['GABRIEL INDIA LIMITED']?.mtd || 0);
        salesRows += `<tr style="background:#f8fbff; color:#555; font-size:12px;">
            <td style="padding-left:28px;">↳ Gabriel India Limited</td>
            <td>₹${gabrielT.toLocaleString('en-IN')}</td>
            <td>₹${gabrielM.toLocaleString('en-IN')}</td>
        </tr>`;

        // ── RETAILS ROW (main) ─────────────────────────────────────────────────
        const rRow = analysis.salesAnalysis.find(r => matchCategory('RETAILS', r._id)) || { today: 0, mtd: 0 };
        const rToday = Math.round(rRow.today), rMtd = Math.round(rRow.mtd);
        sTodayTotal += rToday; sMtdTotal += rMtd;
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
        // Retails sub-rows: SS
        const ssRetT = Math.round(retailSubAnalysis['SS']?.today || 0);
        const ssRetM = Math.round(retailSubAnalysis['SS']?.mtd || 0);
        salesRows += `<tr style="background:#f5fff8; color:#555; font-size:12px;">
            <td style="padding-left:28px;">↳ SS</td>
            <td>₹${ssRetT.toLocaleString('en-IN')}</td>
            <td>₹${ssRetM.toLocaleString('en-IN')}</td>
        </tr>`;

        // ── SS DEALERS ROW ─────────────────────────────────────────────────────
        const ssRow = analysis.salesAnalysis.find(r => matchCategory('SS DEALERS', r._id)) || { today: 0, mtd: 0 };
        const ssDToday = Math.round(ssRow.today), ssDMtd = Math.round(ssRow.mtd);
        sTodayTotal += ssDToday; sMtdTotal += ssDMtd;
        salesRows += `<tr style="font-weight:600;">
            <td>SS Dealers</td>
            <td>₹${ssDToday.toLocaleString('en-IN')}</td>
            <td>₹${ssDMtd.toLocaleString('en-IN')}</td>
        </tr>`;

        document.querySelector('#sales-summary-table tbody').innerHTML = salesRows;
        document.getElementById('s-today-total').innerText = `₹${sTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('s-mtd-total').innerText = `₹${sMtdTotal.toLocaleString('en-IN')}`;

        const purCats = ['CONSUMABLES', 'LOGISTICS', 'MAINTANANCE', 'OUTSOURCING', 'PACKING CONSU.', 'RM', 'TOOLS'];
        let pTodayTotal = 0, pMtdTotal = 0;
        document.querySelector('#purchase-summary-table tbody').innerHTML = purCats.map(cat => {
            const row = analysis.purchaseAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            const roundedToday = Math.round(row.today);
            const roundedMtd = Math.round(row.mtd);
            pTodayTotal += roundedToday; 
            pMtdTotal += roundedMtd;
            return `<tr><td>${cat}</td><td>₹${roundedToday.toLocaleString('en-IN')}</td><td>₹${roundedMtd.toLocaleString('en-IN')}</td></tr>`;
        }).join('');
        document.getElementById('p-today-total').innerText = `₹${pTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('p-mtd-total').innerText = `₹${pMtdTotal.toLocaleString('en-IN')}`;

        const payCats = ['RM', 'STATUTORY', 'TOOLS /CONSU/R&M', 'SUNDRY EXP', 'FREIGHT', 'GCD', 'USL', 'OTHERS'];
        let payTodayTotal = 0, payMtdTotal = 0;
        document.querySelector('#payments-summary-table tbody').innerHTML = payCats.map(cat => {
            const row = analysis.paymentAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            const roundedToday = Math.round(row.today);
            const roundedMtd = Math.round(row.mtd);
            payTodayTotal += roundedToday; 
            payMtdTotal += roundedMtd;
            return `<tr><td>${cat}</td><td>₹${roundedToday.toLocaleString('en-IN')}</td><td>₹${roundedMtd.toLocaleString('en-IN')}</td></tr>`;
        }).join('');
        document.getElementById('pay-today-total').innerText = `₹${payTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('pay-mtd-total').innerText = `₹${payMtdTotal.toLocaleString('en-IN')}`;

        const colCats = ['OE', 'RETAILS', 'OTHER INCOME', 'SECURITY DEPOSITS', 'USL', 'BANK INTEREST'];
        let colTodayTotal = 0, colMtdTotal = 0;
        document.querySelector('#collections-summary-table tbody').innerHTML = colCats.map(cat => {
            const row = analysis.collectionAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            const roundedToday = Math.round(row.today);
            const roundedMtd = Math.round(row.mtd);
            colTodayTotal += roundedToday; 
            colMtdTotal += roundedMtd;
            return `<tr><td>${cat}</td><td>₹${roundedToday.toLocaleString('en-IN')}</td><td>₹${roundedMtd.toLocaleString('en-IN')}</td></tr>`;
        }).join('');
        document.getElementById('col-today-total').innerText = `₹${colTodayTotal.toLocaleString('en-IN')}`;
        document.getElementById('col-mtd-total').innerText = `₹${colMtdTotal.toLocaleString('en-IN')}`;

        // 💥 APPLIED Math.round() TO DATA TABLES TOO FOR CONSISTENCY
        document.getElementById('sales-body').innerHTML = tables.receivables.map((inv, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceDate', 'Sales', this)">${formatDate(inv.invoiceDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'customer', 'Sales', this)">${inv.customer || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceNo', 'Sales', this)">${inv.invoiceNo || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceValue', 'Sales', this)">₹${Math.round(inv.invoiceValue || 0).toLocaleString('en-IN')}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'marketier', 'Sales', this)">${(inv.marketier || '').toUpperCase()}</td>
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
            </tr>
        `).join('');

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
    await fetch(`${API_BASE}/api/finance/manual-sale`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceDate: document.getElementById('s-date').value, customer: c === 'Other' ? document.getElementById('s-customer-new').value : c, invoiceNo: document.getElementById('s-invNo').value, invoiceValue: parseFloat(document.getElementById('s-val').value), marketier: document.getElementById('s-marketier').value }) });
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
    document.getElementById('ledgers-body').innerHTML = data.map((l, i) => {
        const color = sectorColors[l.sectorType] || '#95a5a6';
        return `<tr>
            <td><strong>${i + 1}</strong></td>
            <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${l._id}', 'ledgerName', 'Ledger', this)">${l.ledgerName || ''}</td>
            <td>${l.category || ''}</td>
            <td><span style="background:${color}22; color:${color}; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600;">${l.sectorType || ''}</span></td>
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

document.addEventListener('DOMContentLoaded', () => { document.getElementById('date-selector').value = ''; loadFinanceData(); loadSundryLedgers(); });