function logout() { localStorage.removeItem('precifast_auth'); window.location.href = "login.html"; }

const API_BASE = 'http://localhost:3000';
let vendorDetails = {};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-tab');
    event.currentTarget.classList.add('active');
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

// STRICT UTC rendering to prevent "One Day Back" timezone shifting
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const matchCategory = (targetCat, dataCat) => {
    const target = targetCat.toUpperCase().trim();
    const actual = (dataCat || '').toUpperCase().trim();
    if (!actual) return false;
    return actual === target || actual.includes(target) || target.includes(actual);
};

function handleCustomerChange() {
    const select = document.getElementById('s-customer-select');
    const newCustomerInput = document.getElementById('s-customer-new');
    
    if (select.value === 'Other') {
        newCustomerInput.style.display = 'block';
        newCustomerInput.required = true;
    } else {
        newCustomerInput.style.display = 'none';
        newCustomerInput.required = false;
        newCustomerInput.value = '';
    }
    document.getElementById('s-invNo').value = "INV-S-" + Math.floor(100000 + Math.random() * 900000);
}

function handleVendorChange() {
    const select = document.getElementById('p-vendor-select');
    const newVendorInput = document.getElementById('p-vendor-new');
    const gstinInput = document.getElementById('p-gstin');
    
    if (select.value === 'Other') {
        newVendorInput.style.display = 'block';
        newVendorInput.required = true;
        gstinInput.value = ''; 
    } else {
        newVendorInput.style.display = 'none';
        newVendorInput.required = false;
        newVendorInput.value = '';
        if (vendorDetails[select.value]) gstinInput.value = vendorDetails[select.value];
    }
    document.getElementById('p-invNo').value = "INV-P-" + Math.floor(100000 + Math.random() * 900000);
}

function autoCalculatePurchase() {
    const taxableValue = parseFloat(document.getElementById('p-tax').value) || 0;
    const igst = parseFloat((taxableValue * 0.18).toFixed(2));
    const invoiceTotal = parseFloat((taxableValue + igst).toFixed(2));
    document.getElementById('p-igst').value = igst;
    document.getElementById('p-val').value = invoiceTotal;
}

function downloadPDF() {
    const element = document.getElementById('summary-export-content');
    html2pdf().set({ margin: 0.5, filename: `Summary_Report.pdf`, html2canvas: { scale: 2 }, jsPDF: { orientation: 'landscape' } }).from(element).save();
}

function downloadWord() {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Summary Report</title><style>table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }</style></head><body>`;
    const fullHtml = header + document.getElementById("summary-export-content").innerHTML + "</body></html>";
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Summary_Report.doc`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
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

        const analysis = data.analysis || { salesAnalysis: [], purchaseAnalysis: [] };
        const tables = data.tables || { receivables: [], payables: [] };

        const uniqueCustomers = [...new Set(tables.receivables.map(item => item.customer).filter(Boolean))];
        const customerSelect = document.getElementById('s-customer-select');
        customerSelect.innerHTML = '<option value="" disabled selected>Select Customer</option>' + 
                                   uniqueCustomers.map(c => `<option value="${c}">${c}</option>`).join('') +
                                   '<option value="Other" style="font-weight:bold; color:#3498db;">+ Other (Add New)</option>';

        vendorDetails = {};
        tables.payables.forEach(p => { if (p.vendor && !vendorDetails[p.vendor]) vendorDetails[p.vendor] = p.gstin || ''; });
        
        const vendorSelect = document.getElementById('p-vendor-select');
        vendorSelect.innerHTML = '<option value="" disabled selected>Select Supplier</option>' + 
                                 Object.keys(vendorDetails).map(v => `<option value="${v}">${v}</option>`).join('') +
                                 '<option value="Other" style="font-weight:bold; color:#3498db;">+ Other (Add New)</option>';

        const salesCats = ['OE', 'Retails', 'SS Dealers'];
        let sTodayTotal = 0, sMtdTotal = 0;
        document.querySelector('#sales-summary-table tbody').innerHTML = salesCats.map(cat => {
            const row = analysis.salesAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            sTodayTotal += row.today; sMtdTotal += row.mtd;
            return `<tr><td>${cat}</td><td>₹${row.today.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td>₹${row.mtd.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr>`;
        }).join('');
        document.getElementById('s-today-total').innerText = `₹${sTodayTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        document.getElementById('s-mtd-total').innerText = `₹${sMtdTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        const purCats = ['Consumables', 'Logistics', 'Maintanance', 'Outsourcing', 'Packing consu.', 'RM', 'Tools'];
        let pTodayTotal = 0, pMtdTotal = 0;
        document.querySelector('#purchase-summary-table tbody').innerHTML = purCats.map(cat => {
            const row = analysis.purchaseAnalysis.find(r => matchCategory(cat, r._id)) || { today: 0, mtd: 0 };
            pTodayTotal += row.today; pMtdTotal += row.mtd;
            return `<tr><td>${cat}</td><td>₹${row.today.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td>₹${row.mtd.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr>`;
        }).join('');
        document.getElementById('p-today-total').innerText = `₹${pTodayTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        document.getElementById('p-mtd-total').innerText = `₹${pMtdTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // 💥 COMPLETELY REMOVED THE EXTRA DATE COLUMN
        document.getElementById('sales-body').innerHTML = tables.receivables.map((inv, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${formatDate(inv.invoiceDate)}</td>
                <td>${inv.customer || ''}</td>
                <td>${inv.invoiceNo || ''}</td>
                <td>₹${(inv.invoiceValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>${inv.marketier || ''}</td>
            </tr>
        `).join('');

        document.getElementById('purchase-body').innerHTML = tables.payables.map((pay, index) => `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>${pay.gstin || ''}</td><td>${pay.vendor || ''}</td>
                <td>${pay.invoiceNumber || ''}</td><td>${formatDate(pay.invoiceDate)}</td><td>${formatDate(pay.matRecDate)}</td>
                <td>₹${(pay.invoiceValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>₹${(pay.taxableValue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>₹${(pay.integratedTax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>₹${(pay.centralTax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>₹${(pay.stateTax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td>${pay.remarks || ''}</td>
            </tr>
        `).join('');

    } catch (error) { console.error(error); }
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uploadBtn = document.getElementById('upload-btn');
    uploadBtn.innerText = "⏳ Processing...";
    uploadBtn.style.backgroundColor = "#f39c12"; 
    uploadBtn.disabled = true; 

    const formData = new FormData();
    formData.append('file', document.getElementById('file-input').files[0]);
    
    try {
        const res = await fetch(`${API_BASE}/api/finance/upload-excel`, { method: 'POST', body: formData });
        const result = await res.json();
        
        uploadBtn.innerText = "Upload & Sync Data";
        uploadBtn.style.backgroundColor = "#3498db";
        uploadBtn.disabled = false;
        showToast("✅ " + result.message);
        document.getElementById('date-selector').value = ''; 
        loadFinanceData();
    } catch (err) { 
        uploadBtn.innerText = "Upload & Sync Data";
        uploadBtn.style.backgroundColor = "#3498db";
        uploadBtn.disabled = false;
        showToast("❌ Upload Failed.", true); 
    }
});

document.getElementById('manual-sale-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const custSelect = document.getElementById('s-customer-select').value;
    const finalCustomer = custSelect === 'Other' ? document.getElementById('s-customer-new').value : custSelect;

    const newSale = {
        invoiceDate: document.getElementById('s-date').value,
        customer: finalCustomer,
        invoiceNo: document.getElementById('s-invNo').value,
        invoiceValue: parseFloat(document.getElementById('s-val').value),
        marketier: document.getElementById('s-marketier').value 
    };
    await fetch(`${API_BASE}/api/finance/manual-sale`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSale) });
    showToast("✅ Sale Saved");
    document.getElementById('manual-sale-form').reset();
    document.getElementById('s-customer-new').style.display = 'none';
    loadFinanceData();
});

document.getElementById('manual-purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendSelect = document.getElementById('p-vendor-select').value;
    const finalVendor = vendSelect === 'Other' ? document.getElementById('p-vendor-new').value : vendSelect;

    const newPurchase = {
        gstin: document.getElementById('p-gstin').value,
        vendor: finalVendor,
        invoiceNumber: document.getElementById('p-invNo').value,
        invoiceDate: document.getElementById('p-date').value,
        matRecDate: document.getElementById('p-matDate').value || null,
        invoiceValue: parseFloat(document.getElementById('p-val').value) || 0,
        taxableValue: parseFloat(document.getElementById('p-tax').value) || 0,
        integratedTax: parseFloat(document.getElementById('p-igst').value) || 0,
        centralTax: parseFloat(document.getElementById('p-cgst').value) || 0,
        stateTax: parseFloat(document.getElementById('p-sgst').value) || 0,
        remarks: document.getElementById('p-remarks').value 
    };
    await fetch(`${API_BASE}/api/finance/manual-purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPurchase) });
    showToast("✅ Purchase Saved");
    document.getElementById('manual-purchase-form').reset();
    document.getElementById('p-vendor-new').style.display = 'none';
    loadFinanceData();
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date-selector').value = ''; 
    loadFinanceData();
});