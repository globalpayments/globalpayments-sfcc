/* eslint-disable linebreak-style */
'use strict';
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var globalPayPreferences = require('*/cartridge/scripts/helpers/globalPayPreferences');
var globalpayconstants = require('*/cartridge/scripts/constants/globalPayConstant');

var orderUpdate = function (order) {
    var preferences = globalPayPreferences.getPreferences();
    var captureMode = preferences.captureMode;
// update order status
    Transaction.wrap(function () {
        OrderMgr.placeOrder(order);
        if (captureMode.value === globalpayconstants.captureMode.auto) {
            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
        } else if (captureMode.value === globalpayconstants.captureMode.later) {
            order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
        }
    });

    return;
};
module.exports = {
    orderUpdate: orderUpdate
};
