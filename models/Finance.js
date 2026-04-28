const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceDate: Date,
    customer: String,
    invoiceNo: String,
    invoiceValue: Number,
    marketier: String
});

const payableSchema = new mongoose.Schema({
    gstin: String,
    vendor: String, 
    invoiceNumber: String,
    invoiceDate: Date,
    matRecDate: Date, 
    invoiceValue: Number,
    taxableValue: Number,
    integratedTax: Number,
    centralTax: Number,
    stateTax: Number,
    remarks: String 
});

// 💥 NEW: BANK STATEMENT SCHEMA (Captures all columns)
const bankTransactionSchema = new mongoose.Schema({
    transactionDate: Date,
    valueDate: Date,
    chequeNo: String,
    description: String,
    branchCode: String,
    debit: Number,     // Payments
    credit: Number,    // Collections
    balance: Number,
    head: String,
    name: String,
    remarks: String
});

module.exports = {
    Invoice: mongoose.model('Invoice', invoiceSchema),
    Payable: mongoose.model('Payable', payableSchema),
    BankTransaction: mongoose.model('BankTransaction', bankTransactionSchema)
};