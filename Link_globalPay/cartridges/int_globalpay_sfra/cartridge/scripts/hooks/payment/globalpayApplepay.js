/* eslint-disable linebreak-style */
'use strict';
var Resource = require('dw/web/Resource');
var globalpayconstants = require('*/cartridge/scripts/constants/globalPayConstant');
var globalPayPreferences = require('*/cartridge/scripts/helpers/globalPayPreferences');
var globalPayHelper = require('*/cartridge/scripts/helpers/globalPayHelpers');
var Locale = require('dw/util/Locale');
var Site = require('dw/system/Site');
var PaymentInstrumentUtils = require('*/cartridge/scripts/utils/paymentInstrumentUtils');
/**
 * Authorizes a payment using a apple pay.
 * @param {dw.order.order}  -  order data.
 * @param {paymentdata}  -  payment data
 * @return {Object} returns an object in case of success else error object.
 */
function authorize(order, paymentdata) {
    var preferences = globalPayPreferences.getPreferences();
    var captureMode = preferences.captureMode;
    var currentSite = Site.getCurrent();
    var serverErrors = [];
    var applePayData = {
        account_name: globalpayconstants.applePay.account_name,
        channel: globalpayconstants.applePay.channel,
        type: globalpayconstants.applePay.type,
        capture_mode: captureMode.value,
        amount: (order.totalGrossPrice) * 100,
        currency: order.currencyCode,
        reference: order.orderNo,
        country: Locale.getLocale(currentSite.defaultLocale).country,
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

    var applePayresp = globalPayHelper.applePay(applePayData);
    var orderUpdateResult = PaymentInstrumentUtils.applePaymentOrderUpdate(order, applePayresp);
    if (!orderUpdateResult) {
        serverErrors.push(
                 Resource.msg('error.technical', 'checkout', null)
             );
    }
    return orderUpdateResult;
}

exports.authorize = authorize;

