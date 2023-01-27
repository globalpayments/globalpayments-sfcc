'use strict';
var server = require('server');

var OrderMgr = require('dw/order/OrderMgr');
var checkoutHelper = require('*/cartridge/scripts/checkout/checkoutHelpers');
var OrderModel = require('*/cartridge/models/order');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
var fraudDetection = require('*/cartridge/scripts/hooks/fraudDetection');
var fraudDetectionStatus;
var fraudError;
var orderPlacementStatus;
var config = {
    numberOfLineItems: '*'
};
var orderModel;
var passwordForm;

server.post('Submit', csrfProtection.generateToken, function (req, res, next) {
    var order = OrderMgr.getOrder(req.querystring.order_id);

    if (!order && req.querystring.order_token !== order.getOrderToken()) {
        return next(new Error('Order token does not match'));
    }

    fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', order,
  fraudDetection.fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () {OrderMgr.failOrder(order);});

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);
        fraudError = Resource.msg('error.technical', 'checkout', null);
        return next(new Error(fraudError));
    }
    orderPlacementStatus = checkoutHelper.placeOrder(order, fraudDetectionStatus);

    if (orderPlacementStatus.error) {
        return next(new Error('Could not place order'));
    }


    orderModel = new OrderModel(order, {config: config});
    if (!req.currentCustomer.profile) {
        passwordForm = server.forms.getForm('newPasswords');
        passwordForm.clear();
        res.render('checkout/confirmation/confirmation', {
            order: orderModel,
            returningCustomer: false,
            passwordForm: passwordForm
        });
    } else {
        res.render('checkout/confirmation/confirmation', {
            order: orderModel,
            returningCustomer: true
        });
    }
    return next();
});

module.exports = server.exports();
