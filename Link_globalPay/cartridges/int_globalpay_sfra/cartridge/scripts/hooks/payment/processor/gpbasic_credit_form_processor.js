'use strict';

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var globalpayconstants = require('*/cartridge/scripts/constants/globalPayConstant');
var array = require('*/cartridge/scripts/util/array');
var CustomerMgr = require('dw/customer/CustomerMgr');
/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;
    var creditCardErrors = {};
    var paymentInstruments;
    var paymentInstrument;

    if (!req.form.storedPaymentUUID) {
        // verify credit card form data
        creditCardErrors = COHelpers.validateCreditCard(paymentForm);
    }

    if (Object.keys(creditCardErrors).length) {
        return {
            fieldErrors: creditCardErrors,
            error: true
        };
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        cardType: {
            value: paymentForm.creditCardFields.cardType.value,
            htmlName: paymentForm.creditCardFields.cardType.htmlName
        },
        cardNumber: {
            value: paymentForm.creditCardFields.cardNumber.value,
            htmlName: paymentForm.creditCardFields.cardNumber.htmlName
        },
        expirationMonth: {
            value: parseInt(
                paymentForm.creditCardFields.expirationMonth.selectedOption
            ),
            htmlName: paymentForm.creditCardFields.expirationMonth.htmlName
        },
        expirationYear: {
            value: parseInt(paymentForm.creditCardFields.expirationYear.value),
            htmlName: paymentForm.creditCardFields.expirationYear.htmlName
        }
    };

    if (req.form.storedPaymentUUID) {
        viewData.storedPaymentUUID = req.form.storedPaymentUUID;
    }

    viewData.saveCard = paymentForm.creditCardFields.saveCard.checked;

    // process payment information
    if (viewData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
    ) {
        paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        paymentInstrument = array.find(paymentInstruments, function (item) {
            return viewData.storedPaymentUUID === item.UUID;
        });

        viewData.paymentInformation.cardNumber.value = paymentInstrument.creditCardNumber;
        viewData.paymentInformation.cardType.value = paymentInstrument.creditCardType;
        viewData.paymentInformation.expirationMonth.value = paymentInstrument.creditCardExpirationMonth;
        viewData.paymentInformation.expirationYear.value = paymentInstrument.creditCardExpirationYear;
        viewData.paymentInformation.creditCardToken = paymentInstrument.raw.creditCardToken;
    }

    return {
        error: false,
        viewData: viewData
    };
}

/**
 * Save the credit card information to login account if save card option is selected
 * @param {Object} req - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 */
function savePaymentInformation(req, basket, billingData) {
    var customer;
    var saveCardResult;
    if (!billingData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
        && billingData.saveCard
        && (billingData.paymentMethod.value === globalpayconstants.creditCardPay.paymentMethod)
    ) {
        customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );

        saveCardResult = COHelpers.savePaymentInstrumentToWallet(
            billingData,
            basket,
            customer
        );

        req.currentCustomer.wallet.paymentInstruments.push({
            creditCardHolder: saveCardResult.creditCardHolder,
            maskedCreditCardNumber: saveCardResult.maskedCreditCardNumber,
            creditCardType: saveCardResult.creditCardType,
            creditCardExpirationMonth: saveCardResult.creditCardExpirationMonth,
            creditCardExpirationYear: saveCardResult.creditCardExpirationYear,
            UUID: saveCardResult.UUID,
            creditCardNumber: Object.hasOwnProperty.call(
                saveCardResult,
                globalpayconstants.creditCardPay.creditCardNumber
            )
                ? saveCardResult.creditCardNumber
                : null,
            raw: saveCardResult
        });
    }
}

exports.processForm = processForm;
exports.savePaymentInformation = savePaymentInformation;
