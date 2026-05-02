function logout() { localStorage.removeItem('precifast_auth'); window.location.href = "login.html"; }
const API_BASE = '';
let vendorDetails = {};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-tab');
    event.currentTarget.classList.add('active');
    const titles = { 'summary':'Summary Dashboard', 'sales':'Sales Register', 'purchase':'Purchase Register', 'payments':'Payments Register', 'collections':'Collections Register', 'bank':'Bank Statement Register', 'manual':'Manual Entry', 'upload':'Upload Data'};
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
    // This automatically handles small letters by converting everything to UPPERCASE before matching
    const target = targetCat.toUpperCase().trim();
    const actual = (dataCat || '').toUpperCase().trim();
    if (!actual) return false;
    
    // Automatically link "S D" from Excel to "Security Deposits" on the Dashboard
    if (target === 'SECURITY DEPOSITS' && (actual === 'S D' || actual === 'SD')) {
        return true;
    }
    
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
    const date = document.getElementById('date-selector').value || new Date().toISOString().split('T')[0];
    const sales = document.getElementById('sales-summary-table').outerHTML;
    const purchases = document.getElementById('purchase-summary-table').outerHTML;
    const payments = document.getElementById('payments-summary-table').outerHTML;
    const collections = document.getElementById('collections-summary-table').outerHTML;

    return `
    <div style="font-family: Arial, sans-serif; color: #111; padding: 0; width: 100%; box-sizing: border-box;">
        <h2 style="text-align: center; border-bottom: 1px solid #111; padding-bottom: 4px; margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase;">
            PRECIFAST PVT LTD - Summary Dashboard (${date})
        </h2>
        <table style="width: 100%; border-collapse: separate; border-spacing: 5px 15px; border: none; table-layout: fixed;">
            <tr>
                <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                    <h3 style="color: #2980b9; margin: 0 0 4px 0; font-size: 11px;">Sales Summary</h3>
                    ${sales}
                </td>
                <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                    <h3 style="color: #d35400; margin: 0 0 4px 0; font-size: 11px;">Purchases Summary</h3>
                    ${purchases}
                </td>
            </tr>
            <tr>
                <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                    <h3 style="color: #8e44ad; margin: 0 0 4px 0; font-size: 11px;">Payments Summary</h3>
                    ${payments}
                </td>
                <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                    <h3 style="color: #27ae60; margin: 0 0 4px 0; font-size: 11px;">Collections Summary</h3>
                    ${collections}
                </td>
            </tr>
        </table>
    </div>
    `;
}

function downloadPDF() { 
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            table.data-table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
            th, td { border: 0.5px solid #000; padding: 4px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            tfoot th { background-color: #e0e0e0; color: #000; font-weight: bold; }
        </style>
        ${getExportHTML()}
    `;
    
    html2pdf().set({ 
        margin: 0.2, 
        filename: `Summary_Report_${document.getElementById('date-selector').value || 'Current'}.pdf`, 
        html2canvas: { scale: 2 }, 
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } 
    }).from(tempDiv).save(); 
}

function downloadWord() {
    const fullHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Summary Report</title>
        <style>
            @page { size: A4 portrait; margin: 0.4in; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            table.data-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 9px; } 
            th, td { border: 0.5px solid #000; padding: 4px; text-align: left; } 
            th { background-color: #f0f0f0; font-weight: bold; }
            tfoot th { background-color: #e0e0e0; font-weight: bold; }
        </style></head>
        <body>${getExportHTML()}</body></html>
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
            // Optional: If you edit a cell, automatically push it to uppercase before saving
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

        // 💥 FORCED ALL SUMMARY ARRAYS TO UPPERCASE
        const salesCats = ['OE', 'RETAILS', 'SS DEALERS'];
        let sTodayTotal = 0, sMtdTotal = 0;
        document.querySelector('#sales-summary-table tbody').innerHTML = salesCats.map(cat => {
            const row = analysis.salesAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            sTodayTotal += row.today; sMtdTotal += row.mtd;
            return `<tr><td>${cat}</td><td>₹${row.today.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>₹${row.mtd.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>`;
        }).join('');
        document.getElementById('s-today-total').innerText = `₹${sTodayTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        document.getElementById('s-mtd-total').innerText = `₹${sMtdTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

        const purCats = ['CONSUMABLES', 'LOGISTICS', 'MAINTANANCE', 'OUTSOURCING', 'PACKING CONSU.', 'RM', 'TOOLS'];
        let pTodayTotal = 0, pMtdTotal = 0;
        document.querySelector('#purchase-summary-table tbody').innerHTML = purCats.map(cat => {
            const row = analysis.purchaseAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            pTodayTotal += row.today; pMtdTotal += row.mtd;
            return `<tr><td>${cat}</td><td>₹${row.today.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>₹${row.mtd.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>`;
        }).join('');
        document.getElementById('p-today-total').innerText = `₹${pTodayTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        document.getElementById('p-mtd-total').innerText = `₹${pMtdTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

        // 💥 ADDED GCD AND USL TO PAYMENTS
        const payCats = ['RM', 'STATUTORY', 'TOOLS /CONSU/R&M', 'SUNDRY EXP', 'FREIGHT', 'GCD', 'USL', 'OTHERS'];
        let payTodayTotal = 0, payMtdTotal = 0;
        document.querySelector('#payments-summary-table tbody').innerHTML = payCats.map(cat => {
            const row = analysis.paymentAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            payTodayTotal += row.today; payMtdTotal += row.mtd;
            return `<tr><td>${cat}</td><td>₹${row.today.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>₹${row.mtd.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>`;
        }).join('');
        document.getElementById('pay-today-total').innerText = `₹${payTodayTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        document.getElementById('pay-mtd-total').innerText = `₹${payMtdTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

        const colCats = ['OE', 'RETAILS', 'OTHER INCOME', 'SECURITY DEPOSITS', 'USL', 'BANK INTEREST'];
        let colTodayTotal = 0, colMtdTotal = 0;
        document.querySelector('#collections-summary-table tbody').innerHTML = colCats.map(cat => {
            const row = analysis.collectionAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            colTodayTotal += row.today; colMtdTotal += row.mtd;
            return `<tr><td>${cat}</td><td>₹${row.today.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td><td>₹${row.mtd.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td></tr>`;
        }).join('');
        document.getElementById('col-today-total').innerText = `₹${colTodayTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        document.getElementById('col-mtd-total').innerText = `₹${colMtdTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

        // 💥 FORCED REMARKS COLUMNS TO UPPERCASE (.toUpperCase())
        document.getElementById('sales-body').innerHTML = tables.receivables.map((inv, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceDate', 'Sales', this)">${formatDate(inv.invoiceDate)}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'customer', 'Sales', this)">${inv.customer || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceNo', 'Sales', this)">${inv.invoiceNo || ''}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${inv._id}', 'invoiceValue', 'Sales', this)">₹${(inv.invoiceValue || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
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
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'invoiceValue', 'Purchase', this)">₹${(pay.invoiceValue || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'taxableValue', 'Purchase', this)">₹${(pay.taxableValue || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'integratedTax', 'Purchase', this)">₹${(pay.integratedTax || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'centralTax', 'Purchase', this)">₹${(pay.centralTax || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${pay._id}', 'stateTax', 'Purchase', this)">₹${(pay.stateTax || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
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
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'debit', 'Bank', this)" style="color:#c0392b; font-weight:bold;">₹${(tx.debit || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'credit', 'Bank', this)" style="color:#27ae60; font-weight:bold;">₹${(tx.credit || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'balance', 'Bank', this)">₹${(tx.balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                <td class="editable-cell" contenteditable="true" onkeydown="cellKeydown(event, '${tx._id}', 'finalBalance', 'Bank', this)">₹${(tx.finalBalance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
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

document.addEventListener('DOMContentLoaded', () => { document.getElementById('date-selector').value = ''; loadFinanceData(); });