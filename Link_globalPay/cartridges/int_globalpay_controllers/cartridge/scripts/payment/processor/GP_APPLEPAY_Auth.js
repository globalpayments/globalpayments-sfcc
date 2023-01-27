'use strict';
var Resource = require('dw/web/Resource');
var globalpayconstants = require('*/cartridge/scripts/constants/globalPayConstant');
var Countries = require('app_storefront_core/cartridge/scripts/util/Countries');
var globalPayPreferences = require('*/cartridge/scripts/helpers/globalPayPreferences');
var globalPayHelper = require('*/cartridge/scripts/helpers/globalPayHelpers');

/**
 * Authorizes a payment using a apple pay.
 * @param {number} orderNumber - The current order'\
 * s number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(order, paymentdata) {
    var countryCode = Countries.getCurrent({
        CurrentRequest: {
            locale: request.locale
        }
    }).countryCode;
    var preferences = globalPayPreferences.getPreferences();
    var captureMode = preferences.captureMode;
    var serverErrors = [];
    var applePayData = {
        account_name: globalpayconstants.applePay.account_name,
        channel: globalpayconstants.applePay.channel,
        type: globalpayconstants.applePay.type,
        capture_mode: captureMode.value,
        amount: (order.totalGrossPrice) * 100,
        currency: order.currencyCode,
        reference: order.orderNo,
        country: countryCode,
        payment_method: {
            name: order.customerName.replace(' ', ''),
            entry_mode: globalpayconstants.applePay.entryMode,
            digital_wallet: {
                provider: globalpayconstants.applePay.provider,
                payment_token: {
                    version: paymentdata.version,
                    data: paymentdata.data,
                    header: {
                        ephemeralPublicKey: paymentdata.header.ephemeralPublicKey,
                        transactionId: paymentdata.header.transactionId,
                        publicKeyHash: paymentdata.header.publicKeyHash
                    }
                }
            }
        }
    };
    var PaymentInstrumentUtils = require('*/cartridge/scripts/util/paymentInstrumentUtils');
    var applePayresp = globalPayHelper.applePay(applePayData);
    var orderUpdateResult = PaymentInstrumentUtils.applePaymentOrderUpdate(order, applePayresp);
    if (!orderUpdateResult) {
        serverErrors.push(
                 Resource.msg('error.technical', 'checkout', null)
             );
    }
    return orderUpdateResult;
}

exports.Authorize = Authorize;
