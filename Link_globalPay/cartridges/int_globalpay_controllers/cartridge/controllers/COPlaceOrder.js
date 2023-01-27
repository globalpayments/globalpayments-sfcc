'use strict';

/**
 * Controller that creates an order from the current basket. It's a pure processing controller and does
 * no page rendering. The controller is used by checkout and is called upon the triggered place order action.
 * It contains the actual logic to authorize the payment and create the order. The controller communicates the result
 * of the order creation process and uses a status object PlaceOrderError to set proper error states.
 * The calling controller is must handle the results of the order creation and evaluate any errors returned by it.
 *
 * @module controllers/COPlaceOrder
 */

/* API Includes */
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');

/* Script Modules */
var globalpayconstants = require('*/cartridge/scripts/constants/globalPayConstant');
var app = require(globalpayconstants.APP);
var guard = require(globalpayconstants.GUARD);
var gpapp = require(globalpayconstants.GPAPP);

var Cart = app.getModel('Cart');
var Order = app.getModel('Order');

var PaymentProcessor = require('*/cartridge/scripts/models/PaymentProcessorModel');
var globalPayPreferences = require('*/cartridge/scripts/helpers/globalPayPreferences');
var authorizationResult;
var paymentInstrument;
var paymentInstruments;
var handlePaymentTransaction;
var handlePaymentsResult;
var saveCCResult;
/**
 * Responsible for payment handling. This function uses PaymentProcessorModel methods to
 * handle payment processing specific to each payment instrument. It returns an
 * error if any of the authorizations failed or a payment
 * instrument is of an unknown payment method. If a payment method has no
 * payment processor assigned, the payment is accepted as authorized.
 *
 * @transactional
 * @param {dw.order.Order} order - the order to handle payments for.
 * @return {Object} JSON object containing information about missing payments,
 * errors, or an empty object if the function is successful.
 */
function handlePayments(order) {
    var result = {};
    if (order.getTotalNetPrice().value !== 0.00) {
        paymentInstruments = order.getPaymentInstruments();

        if (paymentInstruments.length === 0) {
            result.missingPaymentInfo = true;
        }
        /**
         * Sets the transaction ID for the payment instrument.
         */
        handlePaymentTransaction = function () {
            paymentInstrument.getPaymentTransaction().setTransactionID(order.getOrderNo());
        };

        for (var i = 0; i < paymentInstruments.length; i++) {
            paymentInstrument = paymentInstruments[i];

            if (PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor() === null) {
                Transaction.wrap(handlePaymentTransaction);
            } else {
                authorizationResult = PaymentProcessor.authorize(order, paymentInstrument);
                result.authorizationResult = authorizationResult;
                if (authorizationResult.not_supported || authorizationResult.error) {
                    result.error = true;
                }
            }
        }
    }

    return result;
}

/**
 * The entry point for order creation. This function is not exported, as this controller must only
 * be called by another controller.
 *
 * @transactional
 * @return {Object} JSON object that is empty, contains error information, or PlaceOrderError status information.
 */
function clearForms() {
  // Clears all forms used in the checkout process.
    session.forms.singleshipping.clearFormElement();
    session.forms.multishipping.clearFormElement();
    session.forms.billing.clearFormElement();
}
/**
 * To changes the Payment status
 * @param {*object} order
 */
function changeOrderStatus(order) {
    var preferences = globalPayPreferences.getPreferences();
    Transaction.wrap(function () {
        if (preferences.captureMode.value === globalpayconstants.captureMode.auto) {
            order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_PAID);
        } else if (preferences.captureMode.value === globalpayconstants.captureMode.later) {
            order.setPaymentStatus(dw.order.Order.PAYMENT_STATUS_NOTPAID);
        }
    });
}
function start() {
    var cart = Cart.get();

    if (!cart) {
        app.getController('Cart').Show();
        return {};
    }

    var COShipping = app.getController('COShipping');

    // Clean shipments.
    COShipping.PrepareShipments(cart);

    // Make sure there is a valid shipping address, accounting for gift
    // certificates that do not have one.
    if (cart.getProductLineItems().size() > 0 && cart.getDefaultShipment().getShippingAddress() === null) {
        COShipping.Start();
        return {};
    }

    // Make sure the billing step is fulfilled, otherwise restart checkout.
    if (!session.forms.billing.fulfilled.value) {
        app.getController('COCustomer').Start();
        return {};
    }

    Transaction.wrap(function () {
        cart.calculate();
    });

    var COBilling = gpapp.getController('COBilling');

    Transaction.wrap(function () {
        if (!COBilling.ValidatePayment(cart)) {
            COBilling.Start();
            return {};
        }
    });

    // Recalculate the payments. If there is only gift certificates, make sure it covers the order total, if not
    // back to billing page.
    Transaction.wrap(function () {
        if (!cart.calculatePaymentTransactionTotal()) {
            COBilling.Start();
            return {};
        }
    });

    // Handle used addresses and credit cards.
    saveCCResult = COBilling.SaveCreditCard();

    if (!saveCCResult) {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
        };
    }
    // Creates a new order. This will internally ReserveInventoryForOrder and will create a new Order with status
    // 'Created'.
    var order = cart.createOrder();

    if (!order) {
        app.getController('Cart').Show();

        return {};
    }
    handlePaymentsResult = handlePayments(order);

    if (handlePaymentsResult.error) {
        return Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, Resource.msg('checkout.status.declined', 'globalpay', null))
            };
        });
    } else if (handlePaymentsResult.missingPaymentInfo) {
        return Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
            };
        });
    }

    var orderPlacementStatus = Order.submit(order);
    if (!orderPlacementStatus.error) {
        clearForms();
        changeOrderStatus(order);
    }
    return orderPlacementStatus;
}

/**
 * handle payment transaction for Gpay and Paypal
 * @returns
 */
function handlePayment() {
    var cart = Cart.get();

    var order = cart.createOrder();

    if (!order) {
        //   need to pass BasketStatus to Cart-Show ?
        app.getController('Cart').Show();

        return {};
    }
    paymentInstrument = PaymentProcessor.handle(order, app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.value);
    handlePaymentsResult = handlePayments(order);

    if (handlePaymentsResult.error || handlePaymentsResult.missingPaymentInfo) {
        Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'confirm.error.technical')
            };
        });
    }
    if (!handlePaymentsResult.authorizationResult.error && app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.value === 'GP_DW_PAYPAL') {
        // redirect to Paypal site if authrization is success
        var paypalresult = handlePaymentsResult.authorizationResult.paypalresp;
        response.redirect(paypalresult.paymentMethod.apm.provider_redirect_url);
    } else if (!handlePaymentsResult.authorizationResult.error) {
        // submit order for Gpay
        var orderPlacementStatus = Order.submit(order);
        if (!orderPlacementStatus.error) {
            changeOrderStatus(order);
            clearForms();
        }
        app.getController('COSummary').ShowConfirmation(order);
    } else {
        response.redirect(URLUtils.https('COShipping-Start')); // redirect to shipping page if there is any error
    }
}

/**
 * Asynchronous Callbacks for OCAPI. These functions result in a JSON response.
 * Sets the payment instrument information in the form from values in the httpParameterMap.
 * Checks that the payment instrument selected is valid and authorizes the payment. Renders error
 * message information if the payment is not authorized.
 */
function submitPaymentJSON() {
    var order = Order.get(request.httpParameterMap.order_id.stringValue);
    if (!order.object || request.httpParameterMap.order_token.stringValue !== order.getOrderToken()) {
        app.getView().render('checkout/components/faults');
        return;
    }
    session.forms.billing.paymentMethods.clearFormElement();

    var requestObject = JSON.parse(request.httpParameterMap.requestBodyAsString);
    var form = session.forms.billing.paymentMethods;

    for (var requestObjectItem in requestObject) {
        var asyncPaymentMethodResponse = requestObject[requestObjectItem];

        var terms = requestObjectItem.split('_');
        if (terms[0] === 'creditCard') {
            var value = (terms[1] === 'month' || terms[1] === 'year') ?
                Number(asyncPaymentMethodResponse) : asyncPaymentMethodResponse;
            form.creditCard[terms[1]].setValue(value);
        } else if (terms[0] === 'selectedPaymentMethodID') {
            form.selectedPaymentMethodID.setValue(asyncPaymentMethodResponse);
        }
    }

    if (app.getController('COBilling').HandlePaymentSelection('cart').error || handlePayments().error) {
        app.getView().render('checkout/components/faults');
        return;
    }
    app.getView().render('checkout/components/payment_methods_success');
}

/*
 * Asynchronous Callbacks for SiteGenesis.
 * Identifies if an order exists, submits the order, and shows a confirmation message.
 */
function submit() {
    var order = Order.get(request.httpParameterMap.order_id.stringValue);
    var orderPlacementStatus;
    if (order.object && request.httpParameterMap.order_token.stringValue === order.getOrderToken()) {
        orderPlacementStatus = Order.submit(order.object);
        if (!orderPlacementStatus.error) {
            clearForms();
            return app.getController('COSummary').ShowConfirmation(order.object);
        }
    }
    app.getController('COSummary').Start();
}

/**
 * COPlaceOrder-PayPalReturn : The COPlaceOrder-PayPalReturn endpoint invokes paypal return
 * @name Base/COPlaceOrder-PayPalReturn
 * @function
 * @memberof COPlaceOrder
 */
function payPalReturn() {
    var orderId = request.httpParameterMap.id.toString().split('_')[2];
    var order = Order.get(orderId).object;
    if (dw.system.HookMgr.hasHook('app.payment.processor.GLOBALPAY_PAYPAL')) {
        var paymentFormResult = dw.system.HookMgr.callHook('app.payment.processor.GLOBALPAY_PAYPAL',
                   'Capture',
                   order
               );
    }
    if (!empty(paymentFormResult) && (paymentFormResult.status === globalpayconstants.paypalData.captureStatus || paymentFormResult.status === globalpayconstants.paypalData.authorizedStatus)) {
        var orderPlacementStatus = Order.submit(order);
        if (!orderPlacementStatus.error) {
            app.getController('COSummary').ShowConfirmation(order);
            changeOrderStatus(order);
            clearForms();
        }
    }
}
/**
 * COPlaceOrder-PayPalCancel : The COPlaceOrder-PayPalCancel endpoint invokes paypal Cancel
 * @name Base/COPlaceOrder-PayPalCancel
 * @function
 * @memberof COPlaceOrder
 */
function payPalCancel() {
    var orderId = request.httpParameterMap.id.toString().split('_')[2];
    var order = Order.get(orderId).object;
    Transaction.wrap(function () {
        OrderMgr.failOrder(order);
        return {
            error: true,
            FailedOrderError: new Status(Status.ERROR, 'confirm.error.technical')
        };
    });
    response.redirect(URLUtils.https('Cart-Show', 'orderID', order.orderNo, 'orderToken', order.orderToken));
}
/*
 * Module exports
 */

/*
 * Web exposed methods
 */
/** @see module:controllers/COPlaceOrder~submitPaymentJSON */
exports.SubmitPaymentJSON = guard.ensure(['https'], submitPaymentJSON);
/** @see module:controllers/COPlaceOrder~submitPaymentJSON */
exports.Submit = guard.ensure(['https'], submit);
exports.PayPalReturn = guard.ensure(['https'], payPalReturn);
exports.PayPalCancel = guard.ensure(['https'], payPalCancel);
/*
 * Local methods
 */
exports.Start = start;
exports.HandlePayment = handlePayment;
